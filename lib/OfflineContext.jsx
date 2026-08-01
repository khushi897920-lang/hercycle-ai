
'use client'

import React, { createContext, useContext, useState, useEffect, useMemo, useRef } from 'react'
import { getAllFromStore, putIntoStore, deleteFromStore, queueSyncRequest, replaceAll } from './db'
import { predictNextPeriod, calculatePCODRisk } from './api-helpers'
import { useEncryption } from './EncryptionContext'
import {
  DEAD_LETTER_STORE,
  classifyResponse,
  describeQueueItem,
  isDue,
  orderForDrain,
  planNextAttempt,
} from './sync-queue'
import fetchWithTimeout from './fetch-with-timeout'
import toast from 'react-hot-toast'

const OfflineContext = createContext({
  isOffline: false,
  pendingSyncCount: 0,
  failedSyncItems: [],
  isSyncing: false,
  syncData: async () => { },
  retryFailedSync: async () => { },
  discardFailedSync: async () => { },
  offlineClient: {}
})

/**
 * Resolves every record's `encrypted_data` into plain fields.
 *
 * This MUST complete before any IndexedDB write transaction is opened. An
 * IndexedDB transaction auto-commits as soon as control returns to the event
 * loop with no request pending, and `crypto.subtle.decrypt` settles in a later
 * task — so decrypting *inside* a write loop killed the transaction and made
 * every subsequent `put` throw `TransactionInactiveError`.
 *
 * A record that cannot be decrypted is kept in its original form rather than
 * dropped, so a single bad row never costs the user the rest of their history.
 *
 * @param {any[]} records
 * @param {(payload: any) => Promise<any>} decrypt
 * @param {string} label used only for logging
 * @returns {Promise<any[]>}
 */
async function decryptRecords(records, decrypt, label) {
  if (!Array.isArray(records)) return []

  const resolved = []
  for (const record of records) {
    if (!record) continue
    if (!record.encrypted_data) {
      resolved.push(record)
      continue
    }
    try {
      const decryptedFields = await decrypt(record.encrypted_data)
      resolved.push({ ...record, ...decryptedFields })
    } catch (e) {
      console.error(`Failed to decrypt ${label}`, e)
      resolved.push(record)
    }
  }
  return resolved
}

/**
 * Replaces a cache store's contents, treating a cache write failure as
 * non-fatal: the caller already holds fresh server data and should return it
 * even if the local mirror could not be refreshed.
 *
 * @param {string} storeName
 * @param {any[]} records
 * @returns {Promise<void>}
 */
async function cacheRecords(storeName, records) {
  try {
    await replaceAll(storeName, records)
  } catch (e) {
    console.error(`Failed to refresh the ${storeName} offline cache`, e)
  }
}

/**
 * Newest period first. Uses plain YYYY-MM-DD string ordering, which is exact
 * for ISO dates and needs no Date construction.
 *
 * @param {any[]} cycles
 * @returns {any[]} a new array; the input is not mutated
 */
function sortByStartDateDesc(cycles) {
  return [...(cycles || [])].sort((a, b) => {
    const left = String(a?.start_date || '')
    const right = String(b?.start_date || '')
    if (left === right) return 0
    return left < right ? 1 : -1
  })
}

// Helper to generate robust UUIDs client-side
const generateUUID = () => {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
};

export function OfflineProvider({ children }) {
  const [isOffline, setIsOffline] = useState(false)
  const [pendingSyncCount, setPendingSyncCount] = useState(0)
  const [isSyncing, setIsSyncing] = useState(false)
  // Operations that will not be retried again, kept so the user can review,
  // retry or discard them instead of losing them silently.
  const [failedSyncItems, setFailedSyncItems] = useState([])

  const isSyncingRef = useRef(false)

  const { encrypt, decrypt, isUnlocked, isEncryptionEnabled } = useEncryption()

  useEffect(() => {
    if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js')
        .then((reg) => {
          console.log('Service Worker registered successfully with scope:', reg.scope);
        })
        .catch((err) => {
          console.error('Service Worker registration failed:', err);
        });

      let refreshing = false;
      const handleControllerChange = () => {
        if (refreshing) return;
        refreshing = true;
        window.location.reload();
      };

      navigator.serviceWorker.addEventListener('controllerchange', handleControllerChange);

      return () => {
        navigator.serviceWorker.removeEventListener('controllerchange', handleControllerChange);
      };
    }
  }, [])

  const updateSyncCount = async () => {
    try {
      const queue = await getAllFromStore('sync_queue');
      setPendingSyncCount(queue.length);
    } catch (e) {
      console.error('Failed to update sync count:', e);
    }

    try {
      const failed = await getAllFromStore(DEAD_LETTER_STORE);
      setFailedSyncItems(failed.map(item => ({ ...item, description: describeQueueItem(item) })));
    } catch (e) {
      console.error('Failed to read dead-lettered sync operations:', e);
    }
  }

  /**
   * Puts a dead-lettered operation back on the queue for another try — the
   * manual recovery path the old code had no equivalent of.
   */
  const retryFailedSync = async (deadLetterId) => {
    try {
      const failed = await getAllFromStore(DEAD_LETTER_STORE);
      const candidates = deadLetterId === undefined
        ? failed
        : failed.filter(item => item.id === deadLetterId);

      for (const item of candidates) {
        // Requeue as a fresh operation: drop the dead-letter bookkeeping and
        // reset the attempt counter so it is retried immediately.
        await queueSyncRequest(item.url, item.method, item.body);
        await deleteFromStore(DEAD_LETTER_STORE, item.id);
      }
    } catch (e) {
      console.error('Failed to requeue a dead-lettered operation:', e);
    } finally {
      await updateSyncCount();
    }
    syncData();
  }

  /** Permanently discards a dead-lettered operation at the user's request. */
  const discardFailedSync = async (deadLetterId) => {
    try {
      await deleteFromStore(DEAD_LETTER_STORE, deadLetterId);
    } catch (e) {
      console.error('Failed to discard a dead-lettered operation:', e);
    } finally {
      await updateSyncCount();
    }
  }

  /**
   * Moves an operation out of the retry queue and into the dead-letter store,
   * so it stays visible to the user instead of being silently dropped or
   * retried forever.
   */
  const deadLetter = async (item, reason) => {
    const { id, ...rest } = item;
    try {
      await putIntoStore(DEAD_LETTER_STORE, { ...rest, reason, deadLetteredAt: Date.now() });
    } catch (e) {
      console.error('Failed to record a dead-lettered sync operation:', e);
    }
    await deleteFromStore('sync_queue', id);
  };

  const syncData = async () => {
    if (!navigator.onLine || isSyncingRef.current) return;

    try {
      const queue = await getAllFromStore('sync_queue');
      if (queue.length === 0) {
        setPendingSyncCount(0);
        return;
      }

      isSyncingRef.current = true;
      setIsSyncing(true);

      const now = Date.now();
      let gaveUpCount = 0;

      for (const item of orderForDrain(queue, now)) {
        // Not due yet — its backoff has not elapsed. Skip to the next item
        // rather than abandoning the whole queue.
        if (!isDue(item, now)) continue;

        let response = null;
        let errorMessage = null;

        try {
          response = await fetchWithTimeout(item.url, {
            method: item.method,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(item.body)
          });
        } catch (fetchErr) {
          errorMessage = fetchErr?.message || 'Network request failed';
        }

        const classification = classifyResponse(response);
        const plan = planNextAttempt({
          item,
          classification,
          now: Date.now(),
          errorMessage: errorMessage || (response ? `Server responded ${response.status}` : null)
        });

        if (plan.action === 'remove') {
          await deleteFromStore('sync_queue', item.id);
          continue;
        }

        if (plan.action === 'pause') {
          // The session expired. Stop draining so the rest of the queue is not
          // burned against a dead session — but keep every item, including this
          // one. The old code DELETED on 401, destroying queued health logs.
          console.warn('Sync paused: authentication required. Queued changes are preserved.');
          break;
        }

        if (plan.action === 'dead-letter') {
          await deadLetter(plan.item, plan.reason);
          gaveUpCount += 1;
          continue;
        }

        // Transient: record the attempt and its backoff, then move on to the
        // next item. A failing operation no longer blocks its siblings.
        await putIntoStore('sync_queue', plan.item);
      }

      if (gaveUpCount > 0) {
        toast.error(
          gaveUpCount === 1
            ? '⚠️ 1 offline change could not be saved and needs your attention.'
            : `⚠️ ${gaveUpCount} offline changes could not be saved and need your attention.`
        );
      }
    } catch (e) {
      console.error('Error in background sync:', e);
    } finally {
      isSyncingRef.current = false;
      setIsSyncing(false);
      updateSyncCount();
    }
  };

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const handleOnline = () => {
      setIsOffline(false);
      toast.success('📶 Back online! Syncing your data...');
      syncData();
    };

    const handleOffline = () => {
      setIsOffline(true);
      toast.error('⚠️ You are offline. Changes will be saved locally.');
    };

    setIsOffline(!navigator.onLine);
    updateSyncCount();

    if (navigator.onLine) {
      syncData();
    }

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    const interval = setInterval(() => {
      if (navigator.onLine) {
        syncData();
      } else {
        updateSyncCount();
      }
    }, 30000);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      clearInterval(interval);
    };
  }, []);



  const offlineClient = useMemo(() => ({
    fetchCycles: async () => {
      const isOnline = navigator.onLine;
      if (isOnline) {
        try {
          const res = await fetchWithTimeout('/api/cycles');
          const data = await res.json();
          if (data.success) {
            // Decrypt everything FIRST. Awaiting inside a readwrite transaction
            // auto-commits it, after which every remaining put throws
            // TransactionInactiveError — which used to leave the store cleared
            // but never repopulated.
            const cycles = await decryptRecords(data.data.cycles, decrypt, 'cycle');

            // One atomic clear+repopulate, no interleaved awaits.
            await cacheRecords('cycles', cycles);

            const prediction = predictNextPeriod(sortByStartDateDesc(cycles));
            return {
              success: true,
              data: {
                cycles,
                nextPeriodDate: prediction.nextPeriodDate,
                confidence: prediction.confidence,
                averageCycleLength: prediction.averageCycleLength
              }
            };
          }
        } catch (e) {
          console.warn('Fetch cycles failed, falling back to IndexedDB', e);
        }
      }

      const cachedCycles = await getAllFromStore('cycles');
      const sortedCycles = sortByStartDateDesc(cachedCycles);
      const prediction = predictNextPeriod(sortedCycles);

      return {
        success: true,
        data: {
          cycles: sortedCycles,
          nextPeriodDate: prediction.nextPeriodDate,
          confidence: prediction.confidence,
          averageCycleLength: prediction.averageCycleLength
        }
      };
    },

    fetchTodayLog: async (date) => {
      const isOnline = navigator.onLine;
      if (isOnline) {
        try {
          const res = await fetchWithTimeout(`/api/log-day?date=${date}`);
          if (res.ok) {
            const data = await res.json();
            if (data.success && data.data) {
              let log = data.data;
              if (log.encrypted_data) {
                try {
                  const decryptedFields = await decrypt(log.encrypted_data);
                  log = { ...log, ...decryptedFields };
                } catch (e) {
                  console.error('Failed to decrypt daily log', e);
                }
              }
              await putIntoStore('daily_logs', log);
              return { success: true, data: log };
            }
            return { success: true, data: null };
          }
        } catch (e) {
          console.warn('Fetch today log failed, falling back to IndexedDB', e);
        }
      }

      const logs = await getAllFromStore('daily_logs');
      const log = logs.find(l => l.date === date) || null;
      return { success: true, data: log };
    },

    fetchAllLogs: async () => {
      const isOnline = navigator.onLine;
      if (isOnline) {
        try {
          const res = await fetchWithTimeout('/api/log-day/all');
          if (res.ok) {
            const data = await res.json();
            if (data.success && data.data) {
              // Same ordering rule as fetchCycles: decrypt fully, then write in
              // a single transaction that never yields.
              const logs = await decryptRecords(data.data, decrypt, 'daily log');
              await cacheRecords('daily_logs', logs);
              data.data = logs;
            }
            return data;
          }
        } catch (e) {
          console.warn('Fetch all logs failed, falling back to IndexedDB', e);
        }
      }

      const logs = await getAllFromStore('daily_logs');
      const sortedLogs = [...logs].sort((a, b) => new Date(b.date) - new Date(a.date));
      return { success: true, data: sortedLogs };
    },

    fetchPCODRisk: async () => {
      const isOnline = navigator.onLine;
      if (isOnline) {
        try {
          const res = await fetchWithTimeout('/api/pcod-risk');
          if (res.ok) {
            const data = await res.json();
            if (data.success) {
              localStorage.setItem('pcod_risk_cache', JSON.stringify(data.data));
            }
            return data;
          }
        } catch (e) {
          console.warn('Fetch PCOD risk failed, calculating locally/falling back to cache', e);
        }
      }

      try {
        const cachedCycles = await getAllFromStore('cycles');
        const cachedLogs = await getAllFromStore('daily_logs');
        const allSymptoms = cachedLogs.flatMap(log => log.symptoms || []);

        if (cachedCycles.length > 0) {
          const localRisk = calculatePCODRisk(cachedCycles, allSymptoms);
          return { success: true, data: localRisk };
        }
      } catch (e) {
        console.error('Local PCOD calculation failed:', e);
      }

      const cached = localStorage.getItem('pcod_risk_cache');
      if (cached) {
        return { success: true, data: JSON.parse(cached) };
      }

      return {
        success: false,
        error: 'Offline, no cached data',
        data: { score: 25, label: 'LOW RISK', factors: [], recommendation: 'Offline mode active.' }
      };
    },

    saveDailyLog: async (log) => {
      const localLog = {
        ...log,
        updated_at: new Date().toISOString()
      };

      // Seal BEFORE touching local storage. If encryption is required but
      // unavailable the write is refused outright, so the device is not left
      // holding an entry that can never be synced.
      let payload;
      try {
        ({ payload } = await sealPayload({
          payload: localLog,
          fields: SENSITIVE_DAILY_LOG_FIELDS,
          encrypt,
          required: isEncryptionEnabled,
          unlocked: isUnlocked
        }));
      } catch (e) {
        const failure = toEncryptionFailure(e);
        if (!failure) throw e;
        notifyEncryptionLocked(failure.reason);
        return failure;
      }

      await putIntoStore('daily_logs', localLog);

      const isOnline = navigator.onLine;
      if (isOnline) {
        try {
          const res = await fetchWithTimeout('/api/log-day', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
          });
          const data = await res.json();
          if (data.success) {
            return { success: true };
          }
          console.warn('Server rejected log, queuing for retry:', data.message);
        } catch (e) {
          console.warn('Save daily log network request failed, queuing', e);
        }
      }

      await queueSyncRequest('/api/log-day', 'POST', payload);
      updateSyncCount();
      return { success: true, offline: true };
    },

    startPeriod: async (cycle) => {
      const clientCycle = {
        ...cycle,
        id: cycle.id || generateUUID(),
        created_at: new Date().toISOString()
      };

      let payload;
      try {
        ({ payload } = await sealPayload({
          payload: clientCycle,
          fields: SENSITIVE_CYCLE_FIELDS,
          encrypt,
          required: isEncryptionEnabled,
          unlocked: isUnlocked
        }));
      } catch (e) {
        const failure = toEncryptionFailure(e);
        if (!failure) throw e;
        notifyEncryptionLocked(failure.reason);
        return failure;
      }

      await putIntoStore('cycles', clientCycle);

      const isOnline = navigator.onLine;
      if (isOnline) {
        try {
          const res = await fetchWithTimeout('/api/cycles', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
          });
          const data = await res.json();
          if (data.success) {
            return { success: true };
          }
          return { success: false, error: data.error || 'Failed to start period' };
        } catch (e) {
          console.warn('Start period network request failed, queuing', e);
        }
      }

      await queueSyncRequest('/api/cycles', 'POST', payload);
      updateSyncCount();
      return { success: true, offline: true };
    },

    endPeriod: async (id, end_date) => {
      const cachedCycles = await getAllFromStore('cycles');
      const cycle = cachedCycles.find(c => c.id === id);

      const updatedCycle = cycle ? { ...cycle, end_date } : null;

      // Without the cached cycle there is nothing to encrypt, so an E2EE device
      // cannot seal this update — refuse rather than PATCH a plaintext date.
      if (!updatedCycle && isEncryptionEnabled) {
        notifyEncryptionLocked('encryption-locked');
        return {
          success: false,
          reason: 'encryption-locked',
          error: 'This period is not available on this device, so it could not be ended securely.'
        };
      }

      let payload;
      try {
        const sealed = await sealPayload({
          payload: updatedCycle || { id, end_date },
          fields: SENSITIVE_CYCLE_FIELDS,
          encrypt,
          required: isEncryptionEnabled,
          unlocked: isUnlocked
        });
        // PATCH only needs the row id plus whichever representation applies —
        // the sealed blob, or the plaintext end_date when E2EE is off. Keeping
        // this explicit avoids widening the request body.
        payload = sealed.encrypted
          ? { id, encrypted_data: sealed.payload.encrypted_data }
          : { id, end_date };
      } catch (e) {
        const failure = toEncryptionFailure(e);
        if (!failure) throw e;
        notifyEncryptionLocked(failure.reason);
        return failure;
      }

      if (updatedCycle) {
        await putIntoStore('cycles', updatedCycle);
      }

      const isOnline = navigator.onLine;

      if (isOnline) {
        try {
          const res = await fetchWithTimeout('/api/cycles', {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
          });
          const data = await res.json();
          if (data.success) {
            return { success: true };
          }
          return { success: false, error: data.error || 'Failed to end period' };
        } catch (e) {
          console.warn('End period network request failed, queuing', e);
        }
      }

      await queueSyncRequest('/api/cycles', 'PATCH', payload);
      updateSyncCount();
      return { success: true, offline: true };
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }), [encrypt, decrypt, isUnlocked, isEncryptionEnabled]) // rebuilt when the encryption state changes; otherwise stable

  return (
    <OfflineContext.Provider value={{
      isOffline,
      pendingSyncCount,
      failedSyncItems,
      isSyncing,
      syncData,
      retryFailedSync,
      discardFailedSync,
      offlineClient
    }}>
      {children}
    </OfflineContext.Provider>
  )
}

export function useOffline() {
  return useContext(OfflineContext)
}