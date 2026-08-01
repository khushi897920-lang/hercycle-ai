/**
 * encryption-policy.js — decides, in one place, whether a payload may leave the
 * device in plaintext.
 *
 * ## The bug this exists to prevent
 *
 * Every write path in lib/OfflineContext.jsx used to wrap `encrypt()` in a
 * `try/catch` that only logged, and then sent the payload anyway:
 *
 *     let payload = { ...localLog }          // still holds symptoms, mood, flow
 *     try {
 *       payload.encrypted_data = await encrypt({ ... })
 *       delete payload.symptoms              // <- only on the SUCCESS path
 *       delete payload.mood
 *     } catch (e) {
 *       console.error('Failed to encrypt daily log', e)   // <- swallowed
 *     }
 *     // ...payload is POSTed as-is, plaintext included
 *
 * `encrypt()` throws whenever the AES key is not held — which is the case after
 * *every* page load until the user enters their PIN. So the common path
 * transmitted special-category health data in the clear while the UI reported
 * "Log Saved ✓".
 *
 * ## The policy
 *
 * Encryption is opt-in per device. Once a user derives a key we remember that,
 * and from then on their writes **fail closed**:
 *
 *   | E2EE enabled | key held | outcome                                        |
 *   |--------------|----------|------------------------------------------------|
 *   | no           | –        | plaintext, as an explicit documented decision   |
 *   | yes          | yes      | encrypted; plaintext fields stripped            |
 *   | yes          | no       | **refused** — EncryptionUnavailableError        |
 *   | yes          | yes      | encrypt() throws -> **refused**, never plaintext|
 *
 * The module is framework-free so it can be unit-tested directly.
 */

/** localStorage key recording that this device has opted into E2EE. */
export const E2EE_ENABLED_STORAGE_KEY = 'hercycle_e2ee_enabled'

/** Fields of a daily log that must never be transmitted in the clear. */
export const SENSITIVE_DAILY_LOG_FIELDS = Object.freeze([
  'symptoms',
  'mood',
  'flow',
  'cervical_discharge',
])

/** Fields of a cycle record that must never be transmitted in the clear. */
export const SENSITIVE_CYCLE_FIELDS = Object.freeze([
  'start_date',
  'end_date',
  'cycle_length',
])

/**
 * Raised when a payload requires encryption but no usable key is available.
 * Callers surface this to the user and prompt for the PIN — they must never
 * fall through to sending plaintext.
 */
export class EncryptionUnavailableError extends Error {
  /**
   * @param {string} message
   * @param {{ cause?: unknown, reason?: string }} [options]
   */
  constructor(message, options = {}) {
    super(message)
    this.name = 'EncryptionUnavailableError'
    /** Machine-readable discriminator for UI branching. */
    this.reason = options.reason || 'encryption-locked'
    if (options.cause !== undefined) this.cause = options.cause
  }
}

/**
 * Whether this device has opted into end-to-end encryption.
 *
 * Reads localStorage defensively: Safari private mode and some embedded
 * webviews throw on access rather than returning null.
 *
 * @returns {boolean}
 */
export function isE2EEEnabled() {
  if (typeof window === 'undefined') return false
  try {
    return window.localStorage.getItem(E2EE_ENABLED_STORAGE_KEY) === 'true'
  } catch {
    return false
  }
}

/**
 * Records (or clears) this device's opt-in.
 *
 * @param {boolean} enabled
 * @returns {boolean} the value that is now in effect
 */
export function setE2EEEnabled(enabled) {
  if (typeof window === 'undefined') return false
  try {
    if (enabled) {
      window.localStorage.setItem(E2EE_ENABLED_STORAGE_KEY, 'true')
    } else {
      window.localStorage.removeItem(E2EE_ENABLED_STORAGE_KEY)
    }
    return Boolean(enabled)
  } catch {
    return false
  }
}

/**
 * Removes the named fields from a payload, unconditionally.
 *
 * The old code only ran its `delete`s on the success path, so a thrown
 * `encrypt()` left every plaintext field in place. Stripping is now separate
 * from encrypting and cannot be skipped by an early exit.
 *
 * @param {object} payload
 * @param {readonly string[]} fields
 * @returns {object} a new object; the input is not mutated
 */
export function stripPlaintext(payload, fields) {
  const result = { ...payload }
  for (const field of fields) {
    delete result[field]
  }
  return result
}

/**
 * Extracts the named fields into a plain object, preserving explicit nulls so a
 * cleared value round-trips as "cleared" rather than "absent".
 *
 * @param {object} payload
 * @param {readonly string[]} fields
 * @returns {object}
 */
export function pickFields(payload, fields) {
  const picked = {}
  for (const field of fields) {
    if (field in payload) picked[field] = payload[field]
  }
  return picked
}

/**
 * Defence in depth: proves a sealed payload carries no plaintext.
 *
 * Called on the encrypted path right before the payload is handed to `fetch`,
 * so a future edit that forgets to strip a newly-added sensitive field fails
 * loudly here instead of leaking it silently.
 *
 * @param {object} payload
 * @param {readonly string[]} fields
 * @throws {EncryptionUnavailableError} if any sensitive field survived
 */
export function assertNoPlaintext(payload, fields) {
  const leaked = fields.filter((field) => field in payload)
  if (leaked.length > 0) {
    throw new EncryptionUnavailableError(
      `Refusing to transmit plaintext health fields: ${leaked.join(', ')}`,
      { reason: 'plaintext-leak' },
    )
  }
}

/**
 * Prepares a payload for transmission according to the policy table above.
 *
 * @param {object} options
 * @param {object} options.payload            the full record, plaintext fields included
 * @param {readonly string[]} options.fields  which fields are sensitive
 * @param {(data: object) => Promise<any>} options.encrypt
 * @param {boolean} options.required          is E2EE enabled on this device?
 * @param {boolean} options.unlocked          is a key currently held?
 * @returns {Promise<{ payload: object, encrypted: boolean }>}
 * @throws {EncryptionUnavailableError} when encryption is required but unavailable
 */
export async function sealPayload({ payload, fields, encrypt, required, unlocked }) {
  if (!required) {
    // E2EE is off for this device. Sending plaintext is the documented
    // behaviour here — an explicit decision, not a swallowed exception.
    return { payload: { ...payload }, encrypted: false }
  }

  if (!unlocked || typeof encrypt !== 'function') {
    throw new EncryptionUnavailableError(
      'Your health data is end-to-end encrypted. Unlock with your PIN to save this entry.',
      { reason: 'encryption-locked' },
    )
  }

  let encryptedData
  try {
    encryptedData = await encrypt(pickFields(payload, fields))
  } catch (err) {
    // Any failure here is fatal to the write. Falling through would put
    // plaintext on the wire, which is precisely the bug being fixed.
    throw new EncryptionUnavailableError(
      'Could not encrypt this entry, so it was not saved. Unlock with your PIN and try again.',
      { reason: 'encryption-failed', cause: err },
    )
  }

  if (!encryptedData) {
    throw new EncryptionUnavailableError(
      'Encryption produced no output, so the entry was not saved.',
      { reason: 'encryption-failed' },
    )
  }

  const sealed = stripPlaintext({ ...payload, encrypted_data: encryptedData }, fields)
  assertNoPlaintext(sealed, fields)

  return { payload: sealed, encrypted: true }
}

/** Reasons the offline client reports when it refuses a write. */
export const ENCRYPTION_FAILURE_REASONS = Object.freeze([
  'encryption-locked',
  'encryption-failed',
  'plaintext-leak',
])

/**
 * Normalises a thrown value into the `{ success: false }` shape the offline
 * client returns, so every write path reports a locked key identically.
 *
 * @param {unknown} error
 * @returns {{ success: false, reason: string, error: string }|null} null if the
 *   error is not encryption-related and should propagate
 */
export function toEncryptionFailure(error) {
  if (!(error instanceof EncryptionUnavailableError)) return null
  return { success: false, reason: error.reason, error: error.message }
}

/**
 * True when an offline-client result was refused for an encryption reason, so
 * the UI can show the actionable "unlock and retry" message instead of a
 * generic save failure — and, critically, keep the user's input on screen.
 *
 * @param {{ success?: boolean, reason?: string }|null|undefined} result
 * @returns {boolean}
 */
export function isEncryptionFailure(result) {
  return Boolean(result) && result.success === false && ENCRYPTION_FAILURE_REASONS.includes(result.reason)
}

/**
 * Broadcasts that a write was refused because the key is locked, so the UI can
 * prompt for the PIN. A DOM CustomEvent keeps `lib/` free of React imports.
 *
 * @param {string} reason
 */
export function notifyEncryptionLocked(reason = 'encryption-locked') {
  if (typeof window === 'undefined' || typeof window.dispatchEvent !== 'function') return
  window.dispatchEvent(new CustomEvent('hercycle:encryption-locked', { detail: { reason } }))
}
