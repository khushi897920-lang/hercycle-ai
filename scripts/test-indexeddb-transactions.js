/**
 * Regression suite for lib/db.js — IndexedDB transaction lifetime.
 *
 * The bug this guards: lib/OfflineContext.jsx opened a `readwrite` transaction
 * and then awaited `decrypt()` inside the write loop. Per the IndexedDB spec a
 * transaction auto-commits as soon as control returns to the event loop with no
 * request pending, so every `put` after the first decrypt threw
 * `TransactionInactiveError`. Because `store.clear()` had already run, the
 * offline cache was left *empty* — the PWA showed no data at all for any user
 * with end-to-end encryption enabled.
 *
 * Node has no IndexedDB, and pulling in a polyfill would add a dependency to
 * fix a bug. Instead this file ships a small, spec-faithful fake whose single
 * job is to model the one rule that matters:
 *
 *   A transaction is active only for the duration of the task that created it
 *   (and during its request callbacks). Awaiting anything that settles in a
 *   *later* task loses it.
 *
 * The fake deactivates on a `setTimeout(0)` — i.e. at the end of the current
 * macrotask. That is exactly right: `await Promise.resolve()` stays inside the
 * same macrotask and keeps the transaction alive, while awaiting a real async
 * operation (Web Crypto, fetch, a timer) does not. Test 1 below uses that to
 * reproduce the original failure before asserting the fix.
 *
 *   node scripts/test-indexeddb-transactions.js
 */

// ---------------------------------------------------------------------------
// Minimal IndexedDB fake
// ---------------------------------------------------------------------------

class FakeDOMException extends Error {
  constructor(message, name) {
    super(message)
    this.name = name
  }
}

class FakeRequest {
  constructor() {
    this.onsuccess = null
    this.onerror = null
    this.result = undefined
    this.error = null
  }
}

class FakeObjectStore {
  constructor(name, keyPath, records, tx, autoIncrement) {
    this.name = name
    this.keyPath = keyPath
    this.autoIncrement = Boolean(autoIncrement)
    this._records = records
    this._tx = tx
  }

  /** Every store operation must first prove the transaction is still active. */
  _assertActive() {
    if (!this._tx._active) {
      throw new FakeDOMException(
        `Failed to execute on 'IDBObjectStore': The transaction has finished.`,
        'TransactionInactiveError',
      )
    }
    if (this._tx._mode === 'readonly') return
  }

  _assertWritable() {
    this._assertActive()
    if (this._tx._mode === 'readonly') {
      throw new FakeDOMException('The transaction is read-only.', 'ReadOnlyError')
    }
  }

  _schedule(request, compute) {
    const tx = this._tx
    tx._pending += 1

    const run = () => {
      if (tx._finished) {
        tx._pending -= 1
        return
      }
      // The spec re-activates the transaction while a request callback runs.
      tx._active = true
      try {
        request.result = compute()
        if (request.onsuccess) request.onsuccess({ target: request })
        tx._pending -= 1
      } catch (err) {
        request.error = err
        tx._pending -= 1
        if (request.onerror) request.onerror({ target: request })
        else tx._abort(err)
      } finally {
        tx._active = false
        tx._maybeCommit()
      }
    }

    // A transaction whose scope overlaps a running readwrite transaction has
    // not started yet; its requests queue until the blocking one commits.
    if (tx._started) setTimeout(run, 0)
    else tx._queue.push(run)

    return request
  }

  put(value) {
    this._assertWritable()
    const request = new FakeRequest()
    return this._schedule(request, () => {
      let key = value?.[this.keyPath]
      if (key === undefined && this.autoIncrement) {
        key = this._records.size + 1
        // eslint-disable-next-line no-param-reassign
        value = { ...value, [this.keyPath]: key }
      }
      if (key === undefined) {
        throw new FakeDOMException('No key supplied and store is not auto-incrementing', 'DataError')
      }
      this._records.set(key, value)
      return key
    })
  }

  get(key) {
    this._assertActive()
    return this._schedule(new FakeRequest(), () => this._records.get(key))
  }

  getAll() {
    this._assertActive()
    return this._schedule(new FakeRequest(), () => [...this._records.values()])
  }

  delete(key) {
    this._assertWritable()
    return this._schedule(new FakeRequest(), () => {
      this._records.delete(key)
      return undefined
    })
  }

  clear() {
    this._assertWritable()
    return this._schedule(new FakeRequest(), () => {
      this._records.clear()
      return undefined
    })
  }
}

class FakeTransaction {
  constructor(db, storeNames, mode) {
    this.db = db
    this._mode = mode
    this._storeNames = storeNames
    this._active = true
    this._started = false
    this._pending = 0
    this._finished = false
    this._queue = []
    this._onFinish = []
    this._snapshot = null
    this.error = null
    this.oncomplete = null
    this.onerror = null
    this.onabort = null

    for (const name of storeNames) {
      if (!db._stores.has(name)) {
        throw new FakeDOMException(`No object store named ${name}`, 'NotFoundError')
      }
    }

    // End of the current macrotask: control has returned to the event loop, so
    // the transaction is no longer active. This is the rule the old code broke.
    // Note this fires whether or not the transaction has *started* — real
    // IndexedDB behaves the same way, which is why every request must be issued
    // from the creating task or from a request callback.
    setTimeout(() => {
      this._active = false
      this._maybeCommit()
    }, 0)

    db._register(this)
  }

  /**
   * Begins execution. Deferred while an overlapping readwrite transaction is
   * still running, matching the spec's rule that transactions with overlapping
   * scopes cannot run concurrently when either is readwrite.
   */
  _start() {
    if (this._started || this._finished) return
    this._started = true

    if (this._mode === 'readwrite') {
      // Snapshot for rollback: an aborted transaction must not half-apply.
      this._snapshot = this._storeNames.map((name) => [name, new Map(this.db._stores.get(name).records)])
    }

    const queued = this._queue
    this._queue = []
    for (const run of queued) setTimeout(run, 0)

    this._maybeCommit()
  }

  objectStore(name) {
    if (!this._storeNames.includes(name)) {
      throw new FakeDOMException(`Store ${name} is not part of this transaction`, 'NotFoundError')
    }
    const meta = this.db._stores.get(name)
    return new FakeObjectStore(name, meta.keyPath, meta.records, this, meta.autoIncrement)
  }

  _maybeCommit() {
    if (this._finished || !this._started || this._active || this._pending > 0) return
    if (this._queue.length > 0) return
    this._finished = true
    this.db._unregister(this)
    if (this.oncomplete) this.oncomplete({ target: this })
  }

  _abort(err) {
    if (this._finished) return
    this._finished = true
    this._active = false
    this._queue = []

    // Roll the stores back to their pre-transaction contents.
    if (this._snapshot) {
      for (const [name, records] of this._snapshot) {
        const meta = this.db._stores.get(name)
        meta.records.clear()
        for (const [key, value] of records) meta.records.set(key, value)
      }
    }

    this.error = err || new FakeDOMException('Transaction aborted', 'AbortError')
    this.db._unregister(this)
    if (this.onabort) this.onabort({ target: this })
  }

  abort() {
    this._abort(new FakeDOMException('Transaction aborted', 'AbortError'))
  }
}

class FakeDatabase {
  constructor(name) {
    this.name = name
    this._stores = new Map()
    /** Transactions created but not yet finished, in creation order. */
    this._live = []
    this.objectStoreNames = {
      contains: (storeName) => this._stores.has(storeName),
    }
  }

  createObjectStore(name, options = {}) {
    this._stores.set(name, {
      keyPath: options.keyPath,
      autoIncrement: Boolean(options.autoIncrement),
      records: new Map(),
    })
    return { name }
  }

  /**
   * Enforces the spec's concurrency rule: a transaction may not start while an
   * earlier, unfinished transaction shares a store with it and either of the
   * two is readwrite. Without this, two concurrent read-modify-write flows
   * could both observe the pre-write state.
   */
  _register(tx) {
    const blocker = this._live.find(
      (other) =>
        !other._finished &&
        (other._mode === 'readwrite' || tx._mode === 'readwrite') &&
        other._storeNames.some((name) => tx._storeNames.includes(name)),
    )

    this._live.push(tx)

    if (blocker) blocker._onFinish.push(() => tx._start())
    else tx._start()
  }

  _unregister(tx) {
    const index = this._live.indexOf(tx)
    if (index !== -1) this._live.splice(index, 1)

    const callbacks = tx._onFinish
    tx._onFinish = []
    for (const cb of callbacks) cb()
  }

  transaction(storeNames, mode = 'readonly') {
    const names = Array.isArray(storeNames) ? storeNames : [storeNames]
    return new FakeTransaction(this, names, mode)
  }
}

function installFakeIndexedDB() {
  const databases = new Map()

  globalThis.window = globalThis.window || {}
  globalThis.indexedDB = {
    open(name) {
      const request = new FakeRequest()
      setTimeout(() => {
        let db = databases.get(name)
        const isNew = !db
        if (isNew) {
          db = new FakeDatabase(name)
          databases.set(name, db)
        }
        request.result = db
        if (isNew && request.onupgradeneeded) request.onupgradeneeded({ target: request })
        if (request.onsuccess) request.onsuccess({ target: request })
      }, 0)
      return request
    },
    _reset() {
      databases.clear()
    },
  }
}

installFakeIndexedDB()

const {
  bulkPut,
  clearStore,
  deleteFromStore,
  getAllFromStore,
  getFromStore,
  initDB,
  putIntoStore,
  queueSyncRequest,
  replaceAll,
  runTransaction,
} = await import('../lib/db.js')

// ---------------------------------------------------------------------------
// Assertions
// ---------------------------------------------------------------------------

let passed = 0
let failed = 0

function check(actual, expected, label) {
  if (Object.is(actual, expected)) {
    passed += 1
  } else {
    failed += 1
    console.error(`  ❌ ${label}\n       expected: ${JSON.stringify(expected)}\n       actual:   ${JSON.stringify(actual)}`)
  }
}

function checkDeep(actual, expected, label) {
  check(JSON.stringify(actual), JSON.stringify(expected), label)
}

/** Resolves in a *later* macrotask — the shape of crypto.subtle.decrypt. */
function asyncDecrypt(payload) {
  return new Promise((resolve) => setTimeout(() => resolve({ ...payload, decrypted: true }), 0))
}

// ---------------------------------------------------------------------------
// Test 1 — the original bug, reproduced then fixed
// ---------------------------------------------------------------------------
async function testTransactionLifetime() {
  console.log('\n▶ Test 1: awaiting inside a write transaction')

  const records = [
    { id: 'a', encrypted_data: { iv: 'x', ciphertext: 'y' } },
    { id: 'b', encrypted_data: { iv: 'x', ciphertext: 'y' } },
  ]

  // --- the OLD pattern: clear, then decrypt inside the loop -----------------
  const db = await initDB()
  let observedError = null
  try {
    const tx = db.transaction('cycles', 'readwrite')
    const store = tx.objectStore('cycles')
    store.clear()
    for (const record of records) {
      const plain = await asyncDecrypt(record) // yields → tx auto-commits
      store.put(plain)                          // → TransactionInactiveError
    }
  } catch (err) {
    observedError = err
  }

  check(observedError?.name, 'TransactionInactiveError', 'the old decrypt-inside-transaction pattern throws')
  checkDeep(await getAllFromStore('cycles'), [], 'and leaves the store EMPTY — the cache-wipe symptom')

  // --- the NEW pattern: decrypt first, then one atomic write ---------------
  const decrypted = []
  for (const record of records) {
    decrypted.push(await asyncDecrypt(record))
  }
  const written = await replaceAll('cycles', decrypted)

  check(written, 2, 'replaceAll reports both records written')
  const cached = await getAllFromStore('cycles')
  check(cached.length, 2, 'both decrypted records survive in the cache')
  check(cached.every((c) => c.decrypted === true), true, 'records are stored decrypted')
}

// ---------------------------------------------------------------------------
// Test 2 — runTransaction resolves on commit, not on request dispatch
// ---------------------------------------------------------------------------
async function testCommitBarrier() {
  console.log('\n▶ Test 2: runTransaction waits for the commit')

  await clearStore('daily_logs')
  await runTransaction('daily_logs', 'readwrite', (store) => {
    store.put({ date: '2026-07-01', mood: 'calm' })
    store.put({ date: '2026-07-02', mood: 'tired' })
    store.put({ date: '2026-07-03', mood: 'happy' })
  })

  // If runTransaction resolved before the commit, this read could race and see
  // fewer than three rows.
  const rows = await getAllFromStore('daily_logs')
  check(rows.length, 3, 'all three writes are visible immediately after the await')

  const value = await runTransaction('daily_logs', 'readonly', (store, tx) => {
    check(typeof tx.objectStore, 'function', 'the executor receives the transaction')
    return store.name
  })
  check(value, 'daily_logs', 'runTransaction returns the executor result')

  const stores = await runTransaction(['cycles', 'daily_logs'], 'readonly', (map) =>
    Object.keys(map).sort().join(','),
  )
  check(stores, 'cycles,daily_logs', 'multi-store transactions expose a name→store map')
}

// ---------------------------------------------------------------------------
// Test 3 — errors surface instead of being swallowed
// ---------------------------------------------------------------------------
async function testErrorsSurface() {
  console.log('\n▶ Test 3: failures propagate')

  let rejected = null
  try {
    // No keyPath value and no autoIncrement on `cycles` → DataError.
    await runTransaction('cycles', 'readwrite', (store) => {
      store.put({ notTheKeyPath: true })
    })
  } catch (err) {
    rejected = err
  }
  check(rejected?.name, 'DataError', 'a failed write rejects instead of resolving silently')

  let missingStore = null
  try {
    await runTransaction('does_not_exist', 'readonly', () => {})
  } catch (err) {
    missingStore = err
  }
  check(missingStore?.name, 'NotFoundError', 'an unknown store rejects')

  let thrown = null
  try {
    await runTransaction('cycles', 'readwrite', () => {
      throw new Error('executor blew up')
    })
  } catch (err) {
    thrown = err
  }
  check(thrown?.message, 'executor blew up', 'an executor throw aborts and rejects')
}

// ---------------------------------------------------------------------------
// Test 4 — replaceAll is atomic
// ---------------------------------------------------------------------------
async function testReplaceAllAtomicity() {
  console.log('\n▶ Test 4: replaceAll never leaves the store empty on failure')

  await replaceAll('cycles', [
    { id: 'keep-1', start_date: '2026-05-01' },
    { id: 'keep-2', start_date: '2026-06-01' },
  ])
  check((await getAllFromStore('cycles')).length, 2, 'baseline cache is populated')

  let failure = null
  try {
    // The second record has no key, so the batch fails after the clear.
    await replaceAll('cycles', [{ id: 'new-1' }, { missingKey: true }])
  } catch (err) {
    failure = err
  }
  check(failure?.name, 'DataError', 'a bad record rejects the whole replaceAll')

  // The old code cleared in a dead transaction and then failed every put,
  // destroying the cache. A rolled-back transaction must not.
  const survivors = await getAllFromStore('cycles')
  check(survivors.length, 2, 'the previous cache survives a failed replaceAll')
  checkDeep(survivors.map((c) => c.id).sort(), ['keep-1', 'keep-2'], 'the original records are intact')

  check(await replaceAll('cycles', []), 0, 'replaceAll([]) clears the store')
  check((await getAllFromStore('cycles')).length, 0, 'the store is empty afterwards')
  check(await replaceAll('cycles', null), 0, 'replaceAll(null) is tolerated')
}

// ---------------------------------------------------------------------------
// Test 5 — single-record helpers
// ---------------------------------------------------------------------------
async function testSingleRecordHelpers() {
  console.log('\n▶ Test 5: put / get / delete / bulkPut')

  await clearStore('daily_logs')

  const key = await putIntoStore('daily_logs', { date: '2026-07-10', mood: 'calm' })
  check(key, '2026-07-10', 'putIntoStore returns the stored key')
  check((await getFromStore('daily_logs', '2026-07-10')).mood, 'calm', 'getFromStore reads it back')

  await putIntoStore('daily_logs', { date: '2026-07-10', mood: 'anxious' })
  check((await getFromStore('daily_logs', '2026-07-10')).mood, 'anxious', 'put upserts on the key path')
  check((await getAllFromStore('daily_logs')).length, 1, 'an upsert does not duplicate the row')

  await deleteFromStore('daily_logs', '2026-07-10')
  check(await getFromStore('daily_logs', '2026-07-10'), undefined, 'deleteFromStore removes the row')

  check(await bulkPut('daily_logs', [{ date: '2026-07-11' }, { date: '2026-07-12' }]), 2, 'bulkPut reports its count')
  check((await getAllFromStore('daily_logs')).length, 2, 'bulkPut wrote both rows')
  check(await bulkPut('daily_logs', []), 0, 'bulkPut([]) is a no-op')
  check(await bulkPut('daily_logs', [null, undefined]), 0, 'bulkPut skips empty entries')
}

// ---------------------------------------------------------------------------
// Test 6 — sync queue dedupe happens in one transaction
// ---------------------------------------------------------------------------
async function testQueueSyncRequest() {
  console.log('\n▶ Test 6: queueSyncRequest dedupe')

  await clearStore('sync_queue')

  await queueSyncRequest('/api/log-day', 'POST', { date: '2026-07-20', mood: 'calm' })
  await queueSyncRequest('/api/log-day', 'POST', { date: '2026-07-21', mood: 'tired' })
  check((await getAllFromStore('sync_queue')).length, 2, 'different dates queue separately')

  await queueSyncRequest('/api/log-day', 'POST', { date: '2026-07-20', mood: 'anxious' })
  const afterDedupe = await getAllFromStore('sync_queue')
  check(afterDedupe.length, 2, 'a repeat save for the same date replaces its queued entry')
  check(afterDedupe.find((i) => i.body.date === '2026-07-20').body.mood, 'anxious', 'the newest body wins')

  await queueSyncRequest('/api/cycles', 'PATCH', { id: 'cycle-1', end_date: '2026-07-25' })
  await queueSyncRequest('/api/cycles', 'PATCH', { id: 'cycle-1', end_date: '2026-07-26' })
  const cyclePatches = (await getAllFromStore('sync_queue')).filter((i) => i.url === '/api/cycles')
  check(cyclePatches.length, 1, 'repeat PATCHes for one cycle collapse to a single entry')
  check(cyclePatches[0].body.end_date, '2026-07-26', 'the newest cycle patch wins')

  // POSTs to /api/cycles carry no dedupe key and must always append.
  await queueSyncRequest('/api/cycles', 'POST', { id: 'cycle-2', start_date: '2026-08-01' })
  await queueSyncRequest('/api/cycles', 'POST', { id: 'cycle-3', start_date: '2026-09-01' })
  check((await getAllFromStore('sync_queue')).length, 5, 'un-keyed operations always append')

  // Concurrent saves for the same date must not both append. Serialised by the
  // single read-modify-write transaction inside queueSyncRequest.
  await clearStore('sync_queue')
  await Promise.all([
    queueSyncRequest('/api/log-day', 'POST', { date: '2026-08-05', mood: 'a' }),
    queueSyncRequest('/api/log-day', 'POST', { date: '2026-08-05', mood: 'b' }),
  ])
  check((await getAllFromStore('sync_queue')).length, 1, 'concurrent saves for one date do not double-queue')
}

// ---------------------------------------------------------------------------
async function main() {
  console.log('Running IndexedDB transaction-lifetime tests...')

  await testTransactionLifetime()
  await testCommitBarrier()
  await testErrorsSurface()
  await testReplaceAllAtomicity()
  await testSingleRecordHelpers()
  await testQueueSyncRequest()

  if (failed > 0) {
    console.error(`\n❌ ${failed} assertion(s) failed, ${passed} passed.`)
    process.exit(1)
  }
  console.log(`\n✅ All ${passed} assertions passed.`)
}

await main()
