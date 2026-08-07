/**
 * push-subscription.js — the parts of Web Push that are decisions, not I/O.
 *
 * ## Why this module exists
 *
 * Background push in this app could not work. `lib/actions/push.js` wrote the
 * subscription with:
 *
 *     .upsert([{ user_id: userId, subscription, updated_at }], { onConflict: 'user_id' })
 *
 * against a table whose only index on `user_id` is a plain, non-unique one.
 * PostgreSQL answers `ON CONFLICT` on a non-unique column with error 42P10, so
 * every save failed — and the failure was swallowed three times over: the
 * action logged and returned `{ success: false }`, `lib/utils/notifications.js`
 * discarded the return value, and `NotificationSettings` showed a green
 * "enabled" toast plus a *local* notification, which proves nothing because it
 * never leaves the device.
 *
 * Everything that could be checked without a network or a database is here, so
 * the parts that failed silently now fail in a test instead:
 *
 * - Is this actually a `PushSubscription`?
 * - Is the VAPID configuration real, or the placeholder that shipped as a
 *   default?
 * - Does this send failure mean "try later" or "this device is gone forever"?
 * - Did a batch of sends actually deliver anything?
 *
 * No imports, no `fetch`, no `webpush`, no Supabase. Safe on the server, in a
 * Client Component, and in a plain Node script.
 */

// ---------------------------------------------------------------------------
// The placeholders that shipped as defaults
// ---------------------------------------------------------------------------

/**
 * The public key that was hard-coded as `NEXT_PUBLIC_VAPID_PUBLIC_KEY`'s
 * fallback in both `lib/actions/push.js` and `lib/utils/notifications.js`.
 *
 * It reads like the example key from the web-push documentation, and it is
 * long enough to look right at a glance — but it decodes to 64 bytes, one
 * short of the 65 an uncompressed P-256 point needs. Nothing ever checked, so
 * the browser was handed an application server key that could not
 * authenticate a single send, and the subscriptions it produced looked
 * perfectly healthy from the client side.
 */
export const PLACEHOLDER_VAPID_PUBLIC_KEY =
  'BEl62iUYgUivxIkv69yViEuiBIa40yYlK80pvwB8z7x0uE1jA4gR4Jz1fA5mK9_E5-6P_e_E5-6P_e_E5-6P_e'

/**
 * The private key that was hard-coded as `VAPID_PRIVATE_KEY`'s fallback. Not a
 * P-256 scalar at all — 32 ASCII characters, which decode to 24 bytes.
 * `webpush.setVapidDetails` throws on it, and the throw was caught by a block
 * whose entire body was the comment `// Graceful fallback`.
 */
export const PLACEHOLDER_VAPID_PRIVATE_KEY = '1A2B3C4D5E6F7G8H9I0J1K2L3M4N5O6P'

/** An uncompressed P-256 public point is 65 bytes: `0x04` then X and Y. */
const VAPID_PUBLIC_KEY_BYTES = 65

/** A P-256 private scalar is 32 bytes. */
const VAPID_PRIVATE_KEY_BYTES = 32

// ---------------------------------------------------------------------------
// base64url
// ---------------------------------------------------------------------------

/**
 * Decodes base64url to a byte length, without allocating a decoder that only
 * exists on one runtime.
 *
 * Returns `-1` for anything that is not well-formed base64url, which is a
 * meaningful answer here: a key containing a `+`, a `/`, or padding is not a
 * VAPID key, whatever else it might be.
 *
 * @param {string} value
 * @returns {number} the decoded length in bytes, or -1
 */
export function base64UrlByteLength(value) {
  if (typeof value !== 'string' || value.length === 0) return -1

  // Standard base64 characters that base64url replaces, plus padding. Their
  // presence means whoever produced this used the wrong alphabet.
  if (/[+/=]/.test(value)) return -1
  if (!/^[A-Za-z0-9_-]+$/.test(value)) return -1

  const remainder = value.length % 4
  // A base64 group is 4 characters. A remainder of 1 cannot occur: one
  // character carries 6 bits, which is not enough for a byte.
  if (remainder === 1) return -1

  const fullGroups = Math.floor(value.length / 4)
  const extra = remainder === 0 ? 0 : remainder === 2 ? 1 : 2

  return fullGroups * 3 + extra
}

// ---------------------------------------------------------------------------
// VAPID configuration
// ---------------------------------------------------------------------------

/**
 * @typedef {object} VapidStatus
 * @property {boolean} configured   true only when both keys are real
 * @property {string[]} problems    one plain sentence per problem, for an operator
 */

/**
 * Checks a VAPID key pair.
 *
 * The point is that "not configured" becomes a state the application can see
 * and report, rather than something replaced by a placeholder and discovered
 * months later when a user asks why she never gets notifications.
 *
 * @param {{ publicKey?: string, privateKey?: string }} keys
 * @returns {VapidStatus}
 */
export function describeVapidConfig(keys = {}) {
  const { publicKey, privateKey } = keys
  const problems = []

  if (!publicKey) {
    problems.push('NEXT_PUBLIC_VAPID_PUBLIC_KEY is not set.')
  } else if (publicKey === PLACEHOLDER_VAPID_PUBLIC_KEY) {
    problems.push(
      'NEXT_PUBLIC_VAPID_PUBLIC_KEY is the placeholder key from the web-push docs. Generate your own with `npx web-push generate-vapid-keys`.'
    )
  } else if (base64UrlByteLength(publicKey) !== VAPID_PUBLIC_KEY_BYTES) {
    problems.push(
      `NEXT_PUBLIC_VAPID_PUBLIC_KEY does not decode to ${VAPID_PUBLIC_KEY_BYTES} bytes, so it is not a P-256 public key.`
    )
  }

  if (!privateKey) {
    problems.push('VAPID_PRIVATE_KEY is not set.')
  } else if (privateKey === PLACEHOLDER_VAPID_PRIVATE_KEY) {
    problems.push('VAPID_PRIVATE_KEY is the placeholder value that shipped as a default. Generate a real key pair.')
  } else if (base64UrlByteLength(privateKey) !== VAPID_PRIVATE_KEY_BYTES) {
    problems.push(
      `VAPID_PRIVATE_KEY does not decode to ${VAPID_PRIVATE_KEY_BYTES} bytes, so it is not a P-256 private key.`
    )
  }

  return { configured: problems.length === 0, problems }
}

// ---------------------------------------------------------------------------
// Subscriptions
// ---------------------------------------------------------------------------

/**
 * @typedef {object} NormalisedSubscription
 * @property {string} endpoint
 * @property {string|null} expirationTime
 * @property {{ p256dh: string, auth: string }} keys
 */

/**
 * Validates and normalises a browser `PushSubscription`.
 *
 * The old code checked `subscription && subscription.endpoint` and stored
 * whatever it was given. A subscription missing its `keys` is accepted by that
 * check and then fails at send time, once per notification, forever — because
 * nothing ever removes it.
 *
 * Returns `null` for anything unusable, so a bad subscription is rejected at
 * the point it arrives rather than at every future send.
 *
 * @param {unknown} raw
 * @returns {NormalisedSubscription|null}
 */
export function normaliseSubscription(raw) {
  if (!raw || typeof raw !== 'object') return null

  const endpoint = normaliseEndpoint(raw.endpoint)
  if (!endpoint) return null

  const keys = raw.keys
  if (!keys || typeof keys !== 'object') return null

  const p256dh = typeof keys.p256dh === 'string' ? keys.p256dh.trim() : ''
  const auth = typeof keys.auth === 'string' ? keys.auth.trim() : ''

  // Without both of these the push service can accept the request and the
  // browser still cannot decrypt the payload — a failure that looks like
  // success from the server side.
  if (p256dh.length === 0 || auth.length === 0) return null

  return {
    endpoint,
    expirationTime:
      typeof raw.expirationTime === 'string' || raw.expirationTime === null
        ? raw.expirationTime
        : null,
    keys: { p256dh, auth },
  }
}

/**
 * Normalises a push endpoint into the value used as the deduplication key.
 *
 * The endpoint is the natural key for a subscription: it identifies one
 * browser installation on one device. Keying on `user_id` instead — which is
 * what `onConflict: 'user_id'` intended — means a user who enables
 * notifications on her phone and then on her laptop silently loses the phone.
 *
 * @param {unknown} endpoint
 * @returns {string|null}
 */
export function normaliseEndpoint(endpoint) {
  if (typeof endpoint !== 'string') return null

  const trimmed = endpoint.trim()
  if (trimmed.length === 0) return null

  // Push endpoints are always absolute https URLs issued by the browser's push
  // service. Anything else is either a bug or an attempt to have the server
  // make a request somewhere it should not.
  if (!/^https:\/\//i.test(trimmed)) return null

  return trimmed
}

// ---------------------------------------------------------------------------
// Send outcomes
// ---------------------------------------------------------------------------

/**
 * What a failed send means for the stored subscription.
 *
 * - `GONE`          the endpoint is permanently dead. Delete the row.
 * - `RETRYABLE`     a transient failure. Keep the row, try next time.
 * - `MISCONFIGURED` our keys or payload are wrong. Keep the row; deleting
 *                   would punish the user for an operator error.
 */
export const FAILURE_KINDS = Object.freeze({
  GONE: 'gone',
  RETRYABLE: 'retryable',
  MISCONFIGURED: 'misconfigured',
})

/**
 * Classifies a `web-push` send failure.
 *
 * Nothing in the previous implementation read a status code at all:
 *
 *     const results = await Promise.allSettled(subs.map(…))
 *     return { success: true, count: results.length }
 *
 * so a subscription the push service had already declared permanently gone was
 * retried on every single notification, forever, and ten rejected sends were
 * reported as ten successes.
 *
 * The status codes come from RFC 8030 and the push services' own behaviour:
 * 404 and 410 are the two that mean the endpoint will never work again.
 *
 * @param {unknown} error a `web-push` WebPushError or any thrown value
 * @returns {string} one of {@link FAILURE_KINDS}
 */
export function classifySendFailure(error) {
  const status = Number(error?.statusCode ?? error?.status)

  if (status === 404 || status === 410) return FAILURE_KINDS.GONE

  // 401/403 are our VAPID identity being rejected; 400 is usually a malformed
  // payload or a bad key. All three are ours to fix, not the subscription's
  // fault, so the row stays.
  if (status === 400 || status === 401 || status === 403) return FAILURE_KINDS.MISCONFIGURED

  // 413 is a payload over the push service's size limit — also ours.
  if (status === 413) return FAILURE_KINDS.MISCONFIGURED

  return FAILURE_KINDS.RETRYABLE
}

/**
 * @typedef {object} SendSummary
 * @property {number} attempted
 * @property {number} delivered
 * @property {number} failed
 * @property {string[]} goneEndpoints  endpoints to delete
 * @property {boolean} misconfigured   at least one failure was ours
 * @property {boolean} success         true only when something was delivered
 */

/**
 * Summarises a batch of send attempts.
 *
 * `success` is `delivered > 0`, not `results.length > 0`. That single
 * difference is what stops `sendServerPushToUser` reporting a delivery that
 * never happened — which is what let a broken push pipeline sit unnoticed
 * behind a caller that does `.catch(() => {})`.
 *
 * Zero subscriptions is not success: it means the user has no device
 * registered, which the caller may want to act on.
 *
 * @param {Array<{ endpoint: string, ok: boolean, error?: unknown }>} results
 * @returns {SendSummary}
 */
export function summariseSendResults(results) {
  const rows = Array.isArray(results) ? results.filter(Boolean) : []

  const goneEndpoints = []
  let delivered = 0
  let misconfigured = false

  for (const row of rows) {
    if (row.ok) {
      delivered += 1
      continue
    }

    const kind = classifySendFailure(row.error)
    if (kind === FAILURE_KINDS.GONE && row.endpoint) goneEndpoints.push(row.endpoint)
    if (kind === FAILURE_KINDS.MISCONFIGURED) misconfigured = true
  }

  return {
    attempted: rows.length,
    delivered,
    failed: rows.length - delivered,
    goneEndpoints,
    misconfigured,
    success: delivered > 0,
  }
}

// ---------------------------------------------------------------------------
// Client-side status
// ---------------------------------------------------------------------------

/**
 * The state the notification settings UI needs to render honestly.
 *
 * `ENABLED` is the only one that should show a success message, and it
 * requires the subscription to have reached the server. The old UI showed
 * "Device push notifications enabled! 🔔" purely on the browser permission
 * prompt being accepted, which is true of a device that will never receive
 * anything.
 */
export const PUSH_STATES = Object.freeze({
  UNSUPPORTED: 'unsupported',
  DENIED: 'denied',
  DISMISSED: 'dismissed',
  NOT_CONFIGURED: 'not_configured',
  SAVE_FAILED: 'save_failed',
  ENABLED: 'enabled',
})

const PUSH_STATE_MESSAGES = Object.freeze({
  [PUSH_STATES.UNSUPPORTED]: 'This browser does not support background notifications.',
  [PUSH_STATES.DENIED]: 'Notification permission is blocked. You can re-enable it in your browser settings.',
  [PUSH_STATES.DISMISSED]: 'No problem — you can turn notifications on any time.',
  [PUSH_STATES.NOT_CONFIGURED]:
    'Background notifications are not set up on this server yet, so nothing would reach your device.',
  [PUSH_STATES.SAVE_FAILED]: 'We could not register this device for notifications. Please try again.',
  [PUSH_STATES.ENABLED]: 'This device is registered for notifications.',
})

/**
 * @param {string} state
 * @returns {string}
 */
export function describePushState(state) {
  return PUSH_STATE_MESSAGES[state] || PUSH_STATE_MESSAGES[PUSH_STATES.SAVE_FAILED]
}

/**
 * Whether a state should be presented to the user as a success.
 *
 * @param {string} state
 * @returns {boolean}
 */
export function isPushEnabled(state) {
  return state === PUSH_STATES.ENABLED
}
