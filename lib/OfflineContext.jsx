
'use client'

import React, { createContext, useContext, useState, useEffect } from 'react'
import { initDB, getAllFromStore, putIntoStore, deleteFromStore, queueSyncRequest } from './db'
import { predictNextPeriod, calculatePCODRisk } from './api-helpers'
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
    fetchCycles: async () => {
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
            for (const c of data.data.cycles) {
              await store.put(c);
            }
            return data;
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

    fetchTodayLog: async (date) => {
      const isOnline = navigator.onLine;
      if (isOnline) {
        try {
          const res = await fetch(`/api/log-day?date=${date}`);
          if (res.ok) {
            const data = await res.json();
            if (data.success && data.data) {
              await putIntoStore('daily_logs', data.data);
            }
            return data;
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

    // FIXED: now returns explicitly on a server-rejected response,
    // instead of falling through to the sync queue for non-network failures.
    saveDailyLog: async (log) => {
      const localLog = {
        ...log,
        updated_at: new Date().toISOString()
      };
      await putIntoStore('daily_logs', localLog);

      const isOnline = navigator.onLine;
      if (isOnline) {
        try {
          const res = await fetch('/api/log-day', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(log)
          });
          const data = await res.json();
          if (data.success) {
            return { success: true };
          }
          // Server responded but rejected the request — don't queue, surface the error
          return { success: false, error: data.error || 'Failed to save log' };
        } catch (e) {
          console.warn('Save daily log network request failed, queuing', e);
          // Only genuine network/fetch errors fall through to the queue below
        }
      }

      await queueSyncRequest('/api/log-day', 'POST', log);
      updateSyncCount();
      return { success: true, offline: true };
    },

    // FIXED: same pattern as saveDailyLog
    startPeriod: async (cycle) => {
      const clientCycle = {
        ...cycle,
        id: cycle.id || generateUUID(),
        created_at: new Date().toISOString()
      };
      await putIntoStore('cycles', clientCycle);

      const isOnline = navigator.onLine;
      if (isOnline) {
        try {
          const res = await fetch('/api/cycles', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(clientCycle)
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

      await queueSyncRequest('/api/cycles', 'POST', clientCycle);
      updateSyncCount();
      return { success: true, offline: true };
    },

    // FIXED: same pattern as saveDailyLog
    endPeriod: async (id, end_date) => {
      const cachedCycles = await getAllFromStore('cycles');
      const cycle = cachedCycles.find(c => c.id === id);
      if (cycle) {
        cycle.end_date = end_date;
        await putIntoStore('cycles', cycle);
      }

      const isOnline = navigator.onLine;
      if (isOnline) {
        try {
          const res = await fetch('/api/cycles', {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id, end_date })
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

      await queueSyncRequest('/api/cycles', 'PATCH', { id, end_date });
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