const DB_NAME = 'hercycle-db';
const DB_VERSION = 1;

export function initDB() {
  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined') {
      reject(new Error('IndexedDB is only available in the browser'));
      return;
    }
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      
      // Store user's cycles
      if (!db.objectStoreNames.contains('cycles')) {
        db.createObjectStore('cycles', { keyPath: 'id' });
      }

      // Store user's daily logs
      if (!db.objectStoreNames.contains('daily_logs')) {
        db.createObjectStore('daily_logs', { keyPath: 'date' });
      }

      // Store sync queue operations
      if (!db.objectStoreNames.contains('sync_queue')) {
        db.createObjectStore('sync_queue', { keyPath: 'id', autoIncrement: true });
      }
    };

    request.onsuccess = (event) => {
      resolve(event.target.result);
    };

    request.onerror = (event) => {
      reject(event.target.error);
    };
  });
}

export async function getStore(storeName, mode = 'readonly') {
  const db = await initDB();
  const transaction = db.transaction(storeName, mode);
  return transaction.objectStore(storeName);
}

export async function getAllFromStore(storeName) {
  const store = await getStore(storeName, 'readonly');
  return new Promise((resolve, reject) => {
    const request = store.getAll();
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function putIntoStore(storeName, item) {
  const store = await getStore(storeName, 'readwrite');
  return new Promise((resolve, reject) => {
    const request = store.put(item);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function deleteFromStore(storeName, key) {
  const store = await getStore(storeName, 'readwrite');
  return new Promise((resolve, reject) => {
    const request = store.delete(key);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

export async function clearStore(storeName) {
  const store = await getStore(storeName, 'readwrite');
  return new Promise((resolve, reject) => {
    const request = store.clear();
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

export async function queueSyncRequest(url, method, body) {
  // For daily logs, if we already have a pending POST for the same date, update it
  if (url === '/api/log-day' && method === 'POST') {
    try {
      const allQueued = await getAllFromStore('sync_queue');
      const existing = allQueued.find(item => item.url === '/api/log-day' && item.method === 'POST' && item.body.date === body.date);
      if (existing) {
        existing.body = body;
        existing.timestamp = Date.now();
        await putIntoStore('sync_queue', existing);
        return;
      }
    } catch (e) {
      console.error('Failed to deduplicate log-day sync request:', e);
    }
  }
  
  // For cycles, if we have a pending PATCH for the same ID, update it
  if (url === '/api/cycles' && method === 'PATCH') {
    try {
      const allQueued = await getAllFromStore('sync_queue');
      const existing = allQueued.find(item => item.url === '/api/cycles' && item.method === 'PATCH' && item.body.id === body.id);
      if (existing) {
        existing.body = body;
        existing.timestamp = Date.now();
        await putIntoStore('sync_queue', existing);
        return;
      }
    } catch (e) {
      console.error('Failed to deduplicate cycles sync request:', e);
    }
  }

  // Default: add new operation
  const op = {
    url,
    method,
    body,
    timestamp: Date.now()
  };
  await putIntoStore('sync_queue', op);
}
