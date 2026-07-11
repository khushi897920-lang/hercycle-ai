
'use client'

import React, { createContext, useContext, useState, useEffect } from 'react'
import { initDB, getAllFromStore, putIntoStore, deleteFromStore, queueSyncRequest } from './db'
import { predictNextPeriod, calculatePCODRisk } from './api-helpers'
import { encryptPayload, decryptPayload, hashDate } from './encryption'
import toast from 'react-hot-toast'

const OfflineContext = createContext({
  isOffline: false,
  pendingSyncCount: 0,
  isSyncing: false,
  syncData: async () => {},
  offlineClient: {}
})

// Helper to generate robust UUIDs client-side
const generateUUID = () => {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
};

export function OfflineProvider({ children }) {
  const [isOffline, setIsOffline] = useState(false)
  const [pendingSyncCount, setPendingSyncCount] = useState(0)
  const [isSyncing, setIsSyncing] = useState(false)

  useEffect(() => {
    if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js')
        .then((reg) => {
          console.log('Service Worker registered successfully with scope:', reg.scope);
        })
        .catch((err) => {
          console.error('Service Worker registration failed:', err);
        });
    }
  }, [])

  const updateSyncCount = async () => {
    try {
      const queue = await getAllFromStore('sync_queue');
      setPendingSyncCount(queue.length);
    } catch (e) {
      console.error('Failed to update sync count:', e);
    }
  }

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

  const syncData = async () => {
    if (!navigator.onLine || isSyncing) return;

    try {
      const queue = await getAllFromStore('sync_queue');
      if (queue.length === 0) {
        setPendingSyncCount(0);
        return;
      }

      setIsSyncing(true);

      const sortedQueue = [...queue].sort((a, b) => a.id - b.id);

      for (const item of sortedQueue) {
        try {
          const res = await fetch(item.url, {
            method: item.method,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(item.body)
          });

          if (res.ok || res.status === 400 || res.status === 401 || res.status === 403 || res.status === 422) {
            await deleteFromStore('sync_queue', item.id);
          } else {
            break;
          }
        } catch (fetchErr) {
          break;
        }
      }
    } catch (e) {
      console.error('Error in background sync:', e);
    } finally {
      setIsSyncing(false);
      updateSyncCount();
    }
  };



  const offlineClient = {
    fetchCycles: async (masterKey) => {
      const isOnline = navigator.onLine;
      if (isOnline) {
        try {
          const res = await fetch('/api/cycles');
          const data = await res.json();
          if (data.success) {
            const db = await initDB();
            const tx = db.transaction('cycles', 'readwrite');
            const store = tx.objectStore('cycles');
            await store.clear();
            
            // Decrypt on the fly and store decrypted in IndexedDB
            const decryptedCycles = [];
            for (const c of data.data.cycles) {
              if (c.encrypted_data && masterKey) {
                const dec = await decryptPayload(c.encrypted_data, masterKey);
                if (dec) {
                  const fullObj = { ...c, ...dec };
                  delete fullObj.encrypted_data;
                  decryptedCycles.push(fullObj);
                  await store.put(fullObj);
                }
              }
            }
            // Return decrypted format
            const prediction = predictNextPeriod(decryptedCycles.sort((a,b)=>new Date(b.start_date)-new Date(a.start_date)));
            return {
              success: true,
              data: {
                cycles: decryptedCycles,
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
      const sortedCycles = [...cachedCycles].sort((a, b) => new Date(b.start_date) - new Date(a.start_date));
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

    fetchTodayLog: async (date, masterKey) => {
      const isOnline = navigator.onLine;
      if (isOnline && masterKey) {
        try {
          const dateHash = await hashDate(date, masterKey);
          const res = await fetch(`/api/log-day?date_hash=${dateHash}`);
          if (res.ok) {
            const data = await res.json();
            if (data.success && data.data && data.data.encrypted_data) {
              const dec = await decryptPayload(data.data.encrypted_data, masterKey);
              if (dec) {
                const fullObj = { ...data.data, ...dec };
                delete fullObj.encrypted_data;
                delete fullObj.date_hash;
                await putIntoStore('daily_logs', fullObj);
                return { success: true, data: fullObj };
              }
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
          const res = await fetch('/api/log-day/all');
          if (res.ok) {
            const data = await res.json();
            if (data.success && data.data) {
              const db = await initDB();
              const tx = db.transaction('daily_logs', 'readwrite');
              const store = tx.objectStore('daily_logs');
              await store.clear();
              for (const log of data.data) {
                await store.put(log);
              }
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
          const res = await fetch('/api/pcod-risk');
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

    saveDailyLog: async (log, masterKey) => {
      if (!masterKey) return { success: false, error: 'Encryption key missing' };
      const localLog = {
        ...log,
        updated_at: new Date().toISOString()
      };
      await putIntoStore('daily_logs', localLog);

      const isOnline = navigator.onLine;
      const dateHash = await hashDate(log.date, masterKey);
      const encryptedData = await encryptPayload(log, masterKey);
      
      const payload = { date_hash: dateHash, encrypted_data: encryptedData };

      if (isOnline) {
        try {
          const res = await fetch('/api/log-day', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
          });
          const data = await res.json();
          if (data.success) {
            return { success: true };
          }
          return { success: false, error: data.error || 'Failed to save log' };
        } catch (e) {
          console.warn('Save daily log network request failed, queuing', e);
        }
      }

      await queueSyncRequest('/api/log-day', 'POST', payload);
      updateSyncCount();
      return { success: true, offline: true };
    },

    startPeriod: async (cycle, masterKey) => {
      if (!masterKey) return { success: false, error: 'Encryption key missing' };
      const clientCycle = {
        ...cycle,
        id: cycle.id || generateUUID(),
        created_at: new Date().toISOString()
      };
      await putIntoStore('cycles', clientCycle);

      const isOnline = navigator.onLine;
      const payloadObj = { start_date: clientCycle.start_date, end_date: clientCycle.end_date, cycle_length: clientCycle.cycle_length };
      const encryptedData = await encryptPayload(payloadObj, masterKey);
      const payload = { id: clientCycle.id, encrypted_data: encryptedData };

      if (isOnline) {
        try {
          const res = await fetch('/api/cycles', {
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

    endPeriod: async (id, end_date, masterKey) => {
      if (!masterKey) return { success: false, error: 'Encryption key missing' };
      const cachedCycles = await getAllFromStore('cycles');
      const cycle = cachedCycles.find(c => c.id === id);
      if (cycle) {
        cycle.end_date = end_date;
        await putIntoStore('cycles', cycle);
      }

      const isOnline = navigator.onLine;
      // We must re-encrypt the whole cycle object for PATCH, or PATCH API route expects partial.
      // Since our API expects the full payload to be re-encrypted:
      let payloadObj = { end_date };
      if (cycle) {
        payloadObj = { start_date: cycle.start_date, end_date: end_date, cycle_length: cycle.cycle_length };
      }
      const encryptedData = await encryptPayload(payloadObj, masterKey);
      const payload = { id, encrypted_data: encryptedData };

      if (isOnline) {
        try {
          const res = await fetch('/api/cycles', {
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
  };

  return (
    <OfflineContext.Provider value={{ isOffline, pendingSyncCount, isSyncing, syncData, offlineClient }}>
      {children}
    </OfflineContext.Provider>
  )
}

export function useOffline() {
  return useContext(OfflineContext)
}