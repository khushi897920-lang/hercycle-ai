/**
 * Regression suite for lib/encryption-policy.js.
 *
 * Guards the fix for the E2EE fail-open bug: every write path in
 * lib/OfflineContext.jsx wrapped `encrypt()` in a try/catch that only logged,
 * then POSTed the payload anyway — plaintext `symptoms`, `mood`, `flow` and
 * `cervical_discharge` included. Because `encrypt()` throws whenever the AES
 * key is not held (which is the case after every page load until the PIN is
 * entered), the *common* path transmitted special-category health data in the
 * clear while the UI reported "Log Saved ✓".
 *
 * The assertions below are written from the attacker's point of view: for every
 * failure mode, prove that **no sensitive field survives on the wire**.
 *
 *   node scripts/test-encryption-policy.js
 */

// The policy module reads localStorage through `window`. Provide a minimal
// stand-in before importing it so the storage helpers are exercised for real
// rather than short-circuited by the SSR guard.
const storage = new Map()
globalThis.window = {
  localStorage: {
    getItem: (key) => (storage.has(key) ? storage.get(key) : null),
    setItem: (key, value) => storage.set(key, String(value)),
    removeItem: (key) => storage.delete(key),
  },
  dispatchEvent: (event) => {
    globalThis.__dispatched.push(event)
    return true
  },
}
globalThis.__dispatched = []
globalThis.CustomEvent = class CustomEvent {
  constructor(type, options = {}) {
    this.type = type
    this.detail = options.detail
  }
}

const {
  E2EE_ENABLED_STORAGE_KEY,
  ENCRYPTION_FAILURE_REASONS,
  EncryptionUnavailableError,
  SENSITIVE_CYCLE_FIELDS,
  SENSITIVE_DAILY_LOG_FIELDS,
  assertNoPlaintext,
  isE2EEEnabled,
  isEncryptionFailure,
  notifyEncryptionLocked,
  pickFields,
  sealPayload,
  setE2EEEnabled,
  stripPlaintext,
  toEncryptionFailure,
} = await import('../lib/encryption-policy.js')

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

/** The single most important assertion in this file. */
function checkNoPlaintext(payload, fields, label) {
  const serialised = JSON.stringify(payload)
  const leakedKeys = fields.filter((field) => field in payload)
  check(leakedKeys.length, 0, `${label} — no sensitive keys remain`)

  // Also check the serialised body, so a value smuggled under a different key
  // (or nested) still trips the assertion.
  for (const value of ['cramps', 'anxious', 'heavy', 'eggwhite']) {
    if (serialised.includes(value)) {
      failed += 1
      console.error(`  ❌ ${label} — plaintext value "${value}" found in the request body`)
      return
    }
  }
  passed += 1
}

const LOG = Object.freeze({
  date: '2026-07-30',
  symptoms: ['cramps', 'acne'],
  mood: 'anxious',
  flow: 'heavy',
  cervical_discharge: 'eggwhite',
  updated_at: '2026-07-30T10:00:00.000Z',
})

const workingEncrypt = async (data) => ({ iv: 'aXY=', ciphertext: Buffer.from(JSON.stringify(data)).toString('base64') })
const lockedEncrypt = async () => { throw new Error('Encryption key not derived yet') }

// ---------------------------------------------------------------------------
// The opt-in flag
// ---------------------------------------------------------------------------
function testEnabledFlag() {
  console.log('\n▶ Test 1: the E2EE opt-in flag')

  storage.clear()
  check(isE2EEEnabled(), false, 'a fresh device is not opted in')

  setE2EEEnabled(true)
  check(storage.get(E2EE_ENABLED_STORAGE_KEY), 'true', 'opting in persists to localStorage')
  check(isE2EEEnabled(), true, 'the flag reads back as enabled')

  setE2EEEnabled(false)
  check(isE2EEEnabled(), false, 'opting out clears the flag')
  check(storage.has(E2EE_ENABLED_STORAGE_KEY), false, 'the key is removed rather than set to "false"')

  // Safari private mode throws on localStorage access rather than returning null.
  const realLocalStorage = globalThis.window.localStorage
  globalThis.window.localStorage = {
    getItem() { throw new Error('SecurityError') },
    setItem() { throw new Error('SecurityError') },
    removeItem() { throw new Error('SecurityError') },
  }
  check(isE2EEEnabled(), false, 'a throwing localStorage degrades to "not enabled"')
  check(setE2EEEnabled(true), false, 'a throwing localStorage cannot claim success')
  globalThis.window.localStorage = realLocalStorage
}

// ---------------------------------------------------------------------------
// THE BUG: locked key must refuse, never downgrade
// ---------------------------------------------------------------------------
async function testFailsClosed() {
  console.log('\n▶ Test 2: a locked key refuses the write')

  let thrown = null
  try {
    await sealPayload({
      payload: LOG,
      fields: SENSITIVE_DAILY_LOG_FIELDS,
      encrypt: lockedEncrypt,
      required: true,
      unlocked: false,
    })
  } catch (err) {
    thrown = err
  }

  check(thrown instanceof EncryptionUnavailableError, true, 'a locked key throws EncryptionUnavailableError')
  check(thrown?.reason, 'encryption-locked', 'the reason is machine-readable')
  check(/unlock/i.test(thrown?.message || ''), true, 'the message tells the user what to do')

  // The old code caught this and sent the payload regardless.
  const failure = toEncryptionFailure(thrown)
  check(failure?.success, false, 'the failure maps to a { success: false } result')
  check(isEncryptionFailure(failure), true, 'the UI helper recognises it')

  // Encryption enabled and unlocked, but encrypt() itself blows up: still no
  // plaintext fallback.
  let encryptFailure = null
  try {
    await sealPayload({
      payload: LOG,
      fields: SENSITIVE_DAILY_LOG_FIELDS,
      encrypt: lockedEncrypt,
      required: true,
      unlocked: true,
    })
  } catch (err) {
    encryptFailure = err
  }
  check(encryptFailure?.reason, 'encryption-failed', 'a throwing encrypt() is fatal, not a fallback')

  // A stub that resolves to nothing must not be mistaken for success.
  let emptyFailure = null
  try {
    await sealPayload({
      payload: LOG,
      fields: SENSITIVE_DAILY_LOG_FIELDS,
      encrypt: async () => null,
      required: true,
      unlocked: true,
    })
  } catch (err) {
    emptyFailure = err
  }
  check(emptyFailure?.reason, 'encryption-failed', 'an empty ciphertext is rejected')

  // Missing encrypt function entirely.
  let missingFn = null
  try {
    await sealPayload({
      payload: LOG,
      fields: SENSITIVE_DAILY_LOG_FIELDS,
      encrypt: undefined,
      required: true,
      unlocked: true,
    })
  } catch (err) {
    missingFn = err
  }
  check(missingFn?.reason, 'encryption-locked', 'a missing encrypt function refuses too')
}

// ---------------------------------------------------------------------------
// The happy path strips plaintext
// ---------------------------------------------------------------------------
async function testSealedPayload() {
  console.log('\n▶ Test 3: a sealed payload carries no plaintext')

  const { payload, encrypted } = await sealPayload({
    payload: LOG,
    fields: SENSITIVE_DAILY_LOG_FIELDS,
    encrypt: workingEncrypt,
    required: true,
    unlocked: true,
  })

  check(encrypted, true, 'the result is flagged as encrypted')
  check(Boolean(payload.encrypted_data), true, 'encrypted_data is attached')
  checkNoPlaintext(payload, SENSITIVE_DAILY_LOG_FIELDS, 'sealed daily log')
  check(payload.date, '2026-07-30', 'non-sensitive fields are preserved')
  check(payload.updated_at, LOG.updated_at, 'metadata is preserved')

  // Cycles carry a different sensitive set.
  const cycle = { id: 'c1', start_date: '2026-07-01', end_date: '2026-07-05', cycle_length: 28, created_at: 'x' }
  const sealedCycle = await sealPayload({
    payload: cycle,
    fields: SENSITIVE_CYCLE_FIELDS,
    encrypt: workingEncrypt,
    required: true,
    unlocked: true,
  })
  checkNoPlaintext(sealedCycle.payload, SENSITIVE_CYCLE_FIELDS, 'sealed cycle')
  check(sealedCycle.payload.id, 'c1', 'the row id survives so the server can address the row')

  // The input must not be mutated — the caller still needs plaintext locally.
  check(LOG.mood, 'anxious', 'sealPayload does not mutate its input')
  check(cycle.start_date, '2026-07-01', 'sealPayload does not mutate a cycle input')
}

// ---------------------------------------------------------------------------
// E2EE off — plaintext is an explicit decision, not an accident
// ---------------------------------------------------------------------------
async function testOptedOutDevice() {
  console.log('\n▶ Test 4: a device that never opted in')

  const { payload, encrypted } = await sealPayload({
    payload: LOG,
    fields: SENSITIVE_DAILY_LOG_FIELDS,
    encrypt: lockedEncrypt,
    required: false,
    unlocked: false,
  })

  check(encrypted, false, 'the result is flagged as NOT encrypted')
  check(payload.mood, 'anxious', 'plaintext is preserved for a non-E2EE device')
  check('encrypted_data' in payload, false, 'no bogus encrypted_data is attached')
  check(payload === LOG, false, 'a copy is returned, not the caller\'s object')
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function testHelpers() {
  console.log('\n▶ Test 5: stripPlaintext / pickFields / assertNoPlaintext')

  const stripped = stripPlaintext(LOG, SENSITIVE_DAILY_LOG_FIELDS)
  checkNoPlaintext(stripped, SENSITIVE_DAILY_LOG_FIELDS, 'stripPlaintext')
  check(stripped.date, '2026-07-30', 'stripPlaintext keeps everything else')
  check(LOG.symptoms.length, 2, 'stripPlaintext does not mutate its input')

  checkDeep(
    pickFields(LOG, SENSITIVE_DAILY_LOG_FIELDS),
    { symptoms: ['cramps', 'acne'], mood: 'anxious', flow: 'heavy', cervical_discharge: 'eggwhite' },
    'pickFields extracts exactly the sensitive set',
  )

  // An explicitly-cleared value must round-trip as "cleared", not "absent".
  checkDeep(pickFields({ mood: null, date: 'x' }, ['mood', 'flow']), { mood: null }, 'pickFields preserves explicit nulls')

  let leak = null
  try {
    assertNoPlaintext({ date: 'x', encrypted_data: {}, mood: 'anxious' }, SENSITIVE_DAILY_LOG_FIELDS)
  } catch (err) {
    leak = err
  }
  check(leak?.reason, 'plaintext-leak', 'assertNoPlaintext catches a field that escaped stripping')
  check(/mood/.test(leak?.message || ''), true, 'the error names the leaked field')

  check(assertNoPlaintext({ date: 'x', encrypted_data: {} }, SENSITIVE_DAILY_LOG_FIELDS), undefined, 'a clean payload passes')

  check(toEncryptionFailure(new Error('unrelated')), null, 'unrelated errors are not swallowed as encryption failures')
  check(isEncryptionFailure({ success: false, reason: 'network' }), false, 'a network failure is not an encryption failure')
  check(isEncryptionFailure({ success: true }), false, 'a success is not a failure')
  check(isEncryptionFailure(null), false, 'null is handled')
  check(ENCRYPTION_FAILURE_REASONS.length, 3, 'all three refusal reasons are enumerated')
}

function testNotification() {
  console.log('\n▶ Test 6: the locked notification')

  globalThis.__dispatched = []
  notifyEncryptionLocked('encryption-locked')
  check(globalThis.__dispatched.length, 1, 'an event is dispatched')
  check(globalThis.__dispatched[0].type, 'hercycle:encryption-locked', 'with the expected event name')
  check(globalThis.__dispatched[0].detail.reason, 'encryption-locked', 'carrying the reason')
}

async function main() {
  console.log('Running encryption policy tests...')

  testEnabledFlag()
  await testFailsClosed()
  await testSealedPayload()
  await testOptedOutDevice()
  testHelpers()
  testNotification()

  if (failed > 0) {
    console.error(`\n❌ ${failed} assertion(s) failed, ${passed} passed.`)
    process.exit(1)
  }
  console.log(`\n✅ All ${passed} assertions passed.`)
}

await main()
