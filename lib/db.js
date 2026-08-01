/**
 * db.js — IndexedDB access layer for the offline PWA cache.
 *
 * ## The transaction lifetime rule
 *
 * Per the IndexedDB specification an `IDBTransaction` is only *active* while
 * control stays inside the task that created it (or inside one of its request
 * callbacks). As soon as control returns to the event loop with no request
 * pending, the transaction **auto-commits** and every later `put`/`get` against
 * it throws `TransactionInactiveError`.
 *
 * That makes this pattern silently fatal:
 *
 *     const tx = db.transaction('cycles', 'readwrite')
 *     const store = tx.objectStore('cycles')
 *     for (const record of records) {
 *       const plain = await decrypt(record)   // <-- yields; tx auto-commits here
 *       await store.put(plain)                // <-- TransactionInactiveError
 *     }
 *
 * A second, quieter defect compounds it: `store.put()` returns an `IDBRequest`,
 * which is **not** a thenable. `await`ing one resolves on the next microtask
 * without waiting for the write, and nothing ever binds `request.onerror` — so
 * every IndexedDB failure is discarded. The code only *looks* like it awaits.
 *
 * This module therefore enforces two rules:
 *
 *   1. Every request goes through `promisifyRequest`, which binds both
 *      `onsuccess` and `onerror`, so failures surface instead of vanishing.
 *   2. Anything touching a transaction runs inside `runTransaction`, whose
 *      executor is **synchronous**. It cannot await, so it cannot lose the
 *      transaction. Do all async work (decryption, network) *before* calling it.
 */

const DB_NAME = 'hercycle-db';
// v2 adds `sync_dead_letter`, holding operations that will not be retried again
// so they can be surfaced to the user instead of blocking the queue forever.
const DB_VERSION = 2;

/**
 * Cached connection promise. Re-opening the database on every call is wasteful
 * and makes it easy to interleave an `open` with an in-flight transaction.
 * @type {Promise<IDBDatabase>|null}
 */
let dbPromise = null;

/**
 * Wraps an IDBRequest in a real Promise.
 *
 * This is the piece the previous implementation was missing: `await request`
 * resolves immediately because an IDBRequest is not a thenable, so both the
 * result and any error were lost.
 *
 * @template T
 * @param {IDBRequest<T>} request
 * @returns {Promise<T>}
 */
export function promisifyRequest(request) {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error('IndexedDB request failed'));
  });
}

export function initDB() {
  if (dbPromise) return dbPromise;

  dbPromise = new Promise((resolve, reject) => {
    if (typeof window === 'undefined' || typeof indexedDB === 'undefined') {
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

      // Operations that have been given up on. Kept rather than discarded so
      // the user can review, retry or delete them — the previous code silently
      // dropped 401s and retried everything else forever.
      if (!db.objectStoreNames.contains('sync_dead_letter')) {
        db.createObjectStore('sync_dead_letter', { keyPath: 'id', autoIncrement: true });
      }
    };

    request.onsuccess = (event) => {
      resolve(event.target.result);
    };

    request.onerror = (event) => {
      // Clear the cache so a later call can retry rather than being stuck with
      // a permanently rejected promise.
      dbPromise = null;
      reject(event.target.error || new Error('Failed to open IndexedDB'));
    };

    request.onblocked = () => {
      dbPromise = null;
      reject(new Error('IndexedDB upgrade blocked by another open tab'));
    };
  });

  return dbPromise;
}

/**
 * Runs `executor` inside a transaction and resolves once the transaction has
 * actually **committed** — not merely once the last request was issued.
 *
 * `executor` receives the object store (or, for multi-store transactions, a
 * `{ [name]: store }` map) plus the transaction itself. It **must be
 * synchronous**: awaiting inside it would hand control back to the event loop
 * and auto-commit the transaction out from under the remaining writes. Do
 * decryption, network calls and any other async work *before* calling this.
 *
 * @template T
 * @param {string|string[]} storeNames
 * @param {IDBTransactionMode} mode
 * @param {(stores: IDBObjectStore|Record<string, IDBObjectStore>, tx: IDBTransaction) => T} executor
 * @returns {Promise<T>} the executor's return value, once the transaction commits
 */
export async function runTransaction(storeNames, mode, executor) {
  const db = await initDB();
  const names = Array.isArray(storeNames) ? storeNames : [storeNames];

  return new Promise((resolve, reject) => {
    let tx;
    try {
      tx = db.transaction(names, mode);
    } catch (err) {
      reject(err);
      return;
    }

    let result;
    let settled = false;

    const fail = (err) => {
      if (settled) return;
      settled = true;
      reject(err instanceof Error ? err : new Error(String(err ?? 'IndexedDB transaction failed')));
    };

    tx.oncomplete = () => {
      if (settled) return;
      settled = true;
      resolve(result);
    };
    tx.onerror = () => fail(tx.error || new Error('IndexedDB transaction failed'));
    tx.onabort = () => fail(tx.error || new Error('IndexedDB transaction aborted'));

    try {
      const stores = Array.isArray(storeNames)
        ? Object.fromEntries(names.map((name) => [name, tx.objectStore(name)]))
        : tx.objectStore(names[0]);

      result = executor(stores, tx);
    } catch (err) {
      // Settle with the executor's own error FIRST: aborting fires `onabort`,
      // whose generic "transaction aborted" would otherwise mask the real cause.
      fail(err);
      try {
        // Abort so the transaction cannot half-apply.
        tx.abort();
      } catch {
        // Already finished — nothing to roll back.
      }
    }
  });
}

/**
 * @deprecated Returns a store whose transaction auto-commits the moment the
 * caller awaits anything. Kept so external callers keep working; prefer
 * `runTransaction`, which cannot lose its transaction.
 *
 * @param {string} storeName
 * @param {IDBTransactionMode} mode
 * @returns {Promise<IDBObjectStore>}
 */
export async function getStore(storeName, mode = 'readonly') {
  const db = await initDB();
  const transaction = db.transaction(storeName, mode);
  return transaction.objectStore(storeName);
}

/**
 * @param {string} storeName
 * @returns {Promise<any[]>}
 */
export async function getAllFromStore(storeName) {
  const db = await initDB();
  const tx = db.transaction(storeName, 'readonly');
  // A lone read needs no commit barrier: the pending request itself keeps the
  // transaction alive until it settles.
  return promisifyRequest(tx.objectStore(storeName).getAll());
}

/**
 * @param {string} storeName
 * @param {IDBValidKey} key
 * @returns {Promise<any|undefined>}
 */
export async function getFromStore(storeName, key) {
  const db = await initDB();
  const tx = db.transaction(storeName, 'readonly');
  return promisifyRequest(tx.objectStore(storeName).get(key));
}

/**
 * @param {string} storeName
 * @param {any} item
 * @returns {Promise<IDBValidKey|undefined>} the stored key
 */
export async function putIntoStore(storeName, item) {
  let key;
  await runTransaction(storeName, 'readwrite', (store) => {
    store.put(item).onsuccess = (event) => {
      key = event.target.result;
    };
  });
  return key;
}

/**
 * Writes many records in a **single** transaction.
 *
 * Every `put` is issued synchronously, so the transaction stays active for the
 * whole batch and commits once — far cheaper than one transaction per record,
 * and atomic: a failure part-way rolls the batch back instead of leaving the
 * store half-written.
 *
 * @param {string} storeName
 * @param {any[]} items
 * @returns {Promise<number>} the number of records written
 */
export async function bulkPut(storeName, items) {
  const records = Array.isArray(items) ? items.filter(Boolean) : [];
  if (records.length === 0) return 0;

  await runTransaction(storeName, 'readwrite', (store) => {
    for (const record of records) {
      store.put(record);
    }
  });
  return records.length;
}

/**
 * Atomically replaces a store's entire contents.
 *
 * The clear and the repopulate share one transaction, so the cache can never be
 * left empty by a failure part-way through. The previous code cleared in one
 * (already auto-committed) transaction and then failed every subsequent write,
 * wiping the offline cache outright.
 *
 * Callers must resolve every record **before** calling this — see the module
 * header on transaction lifetime.
 *
 * @param {string} storeName
 * @param {any[]} items
 * @returns {Promise<number>} the number of records written
 */
export async function replaceAll(storeName, items) {
  const records = Array.isArray(items) ? items.filter(Boolean) : [];

  await runTransaction(storeName, 'readwrite', (store) => {
    store.clear();
    for (const record of records) {
      store.put(record);
    }
  });
  return records.length;
}

/**
 * @param {string} storeName
 * @param {IDBValidKey} key
 * @returns {Promise<void>}
 */
export async function deleteFromStore(storeName, key) {
  await runTransaction(storeName, 'readwrite', (store) => {
    store.delete(key);
  });
}

/**
 * @param {string} storeName
 * @returns {Promise<void>}
 */
export async function clearStore(storeName) {
  await runTransaction(storeName, 'readwrite', (store) => {
    store.clear();
  });
}

/**
 * Queues an offline mutation for later replay.
 *
 * The read-modify-write of the queue happens inside one `readwrite`
 * transaction, so two rapid saves for the same day cannot both observe "no
 * existing entry" and both append. The previous implementation read in one
 * transaction and wrote in another, leaving that race open.
 *
 * @param {string} url
 * @param {string} method
 * @param {object} body
 * @returns {Promise<void>}
 */
export async function queueSyncRequest(url, method, body) {
  // Which field identifies "the same logical operation" per endpoint, so a
  // repeated edit replaces the queued entry rather than stacking up behind it.
  const dedupeKey =
    url === '/api/log-day' && method === 'POST' ? 'date'
      : url === '/api/cycles' && method === 'PATCH' ? 'id'
        : null;

  await runTransaction('sync_queue', 'readwrite', (store) => {
    if (!dedupeKey || body?.[dedupeKey] === undefined) {
      store.put({ url, method, body, timestamp: Date.now() });
      return;
    }

    // This callback runs while the transaction is still active, so the
    // follow-up put below belongs to the same atomic unit.
    store.getAll().onsuccess = (event) => {
      const queued = event.target.result || [];
      const existing = queued.find(
        (item) => item.url === url && item.method === method && item.body?.[dedupeKey] === body[dedupeKey]
      );

      if (existing) {
        store.put({ ...existing, body, timestamp: Date.now() });
      } else {
        store.put({ url, method, body, timestamp: Date.now() });
      }
    };
  });
}
