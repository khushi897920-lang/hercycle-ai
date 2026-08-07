/**
 * Regression suite for lib/push-subscription.js.
 *
 * The bug this is part of fixing: `lib/actions/push.js` wrote subscriptions
 * with `onConflict: 'user_id'` against a table that has only a *plain* index
 * on `user_id`, so PostgreSQL answered every save with 42P10 and background
 * push has never worked. The failure was invisible at three consecutive
 * layers — the action swallowed it, the caller discarded the return value, and
 * the UI showed a success toast plus a local notification that proves nothing.
 *
 * The database half is fixed by supabase/02_push_subscription_endpoint.sql.
 * This suite covers the half that was making the failure *silent*, because
 * that is what let it survive: the placeholder keys nothing rejected, the
 * "success" that was computed from `results.length` rather than from what was
 * delivered, and the dead endpoints nothing ever removed.
 *
 *   node scripts/test-push-subscription.js
 */

import {
  FAILURE_KINDS,
  PLACEHOLDER_VAPID_PRIVATE_KEY,
  PLACEHOLDER_VAPID_PUBLIC_KEY,
  PUSH_STATES,
  base64UrlByteLength,
  classifySendFailure,
  describePushState,
  describeVapidConfig,
  isPushEnabled,
  normaliseEndpoint,
  normaliseSubscription,
  summariseSendResults,
} from '../lib/push-subscription.js'

let passed = 0
let failed = 0

function check(actual, expected, label) {
  if (Object.is(actual, expected)) {
    passed += 1
    return
  }
  failed += 1
  console.error(`  ❌ ${label}`)
  console.error(`       expected: ${JSON.stringify(expected)}`)
  console.error(`       actual:   ${JSON.stringify(actual)}`)
}

function checkDeep(actual, expected, label) {
  const a = JSON.stringify(actual)
  const b = JSON.stringify(expected)
  if (a === b) {
    passed += 1
    return
  }
  failed += 1
  console.error(`  ❌ ${label}`)
  console.error(`       expected: ${b}`)
  console.error(`       actual:   ${a}`)
}

function checkTruthy(value, label) {
  check(Boolean(value), true, label)
}

function section(title) {
  console.log(`\n${title}`)
}

/** A real-shaped subscription, of the kind Chrome hands back. */
function validSubscription(overrides = {}) {
  return {
    endpoint: 'https://fcm.googleapis.com/fcm/send/dK3mQ:APA91bF-example-endpoint',
    expirationTime: null,
    keys: {
      p256dh: 'BNcRdreALRFXTkOOUHK1EtK2wtaz5Ry4YfYCA_0QTpQtUbVlUls0VJXg7A8u-Ts1XbjhazAkj7I99e8QcYP7DkM',
      auth: 'tBHItJI5svbpez7KI4CCXg',
    },
    ...overrides,
  }
}

// ---------------------------------------------------------------------------

section('base64url')

check(base64UrlByteLength('AAAA'), 3, 'four characters decode to three bytes')
check(base64UrlByteLength('AAAAAAAA'), 6, 'eight characters decode to six bytes')
check(base64UrlByteLength('AAA'), 2, 'a three-character group decodes to two bytes')
check(base64UrlByteLength('AA'), 1, 'a two-character group decodes to one byte')
check(base64UrlByteLength('A'), -1, 'a one-character group is impossible')
check(base64UrlByteLength('AAAA='), -1, 'padding is not base64url')
check(base64UrlByteLength('AA+A'), -1, "'+' belongs to standard base64, not base64url")
check(base64UrlByteLength('AA/A'), -1, "'/' belongs to standard base64, not base64url")
check(base64UrlByteLength('AA-_'), 3, "'-' and '_' are the base64url alphabet")
check(base64UrlByteLength(''), -1, 'an empty string decodes to nothing')
check(base64UrlByteLength(null), -1, 'null is not a key')
check(base64UrlByteLength('hello world'), -1, 'a space is not base64url')

// ---------------------------------------------------------------------------

section('VAPID configuration — the placeholders that shipped as defaults')

const unset = describeVapidConfig({})
check(unset.configured, false, 'no keys at all is not configured')
check(unset.problems.length, 2, 'both missing keys are reported, not just the first')

const placeholders = describeVapidConfig({
  publicKey: PLACEHOLDER_VAPID_PUBLIC_KEY,
  privateKey: PLACEHOLDER_VAPID_PRIVATE_KEY,
})
check(placeholders.configured, false, 'the shipped placeholder pair is not configured')
checkTruthy(
  placeholders.problems.some((p) => p.includes('web-push generate-vapid-keys')),
  'the operator is told how to generate a real pair'
)

// Neither placeholder is a usable key, and neither was ever checked. The
// public one reads like the example key from the web-push docs but is one byte
// short of a P-256 point, so `subscribe()` in the browser was being handed
// something that could never authenticate a send.
check(
  base64UrlByteLength(PLACEHOLDER_VAPID_PUBLIC_KEY),
  64,
  'the placeholder public key decodes to 64 bytes, one short of a P-256 point'
)
// The private placeholder is not even the right length.
check(
  base64UrlByteLength(PLACEHOLDER_VAPID_PRIVATE_KEY),
  24,
  'the placeholder private key decodes to 24 bytes, not 32'
)

// 65 bytes of public key, 32 bytes of private key.
const REAL_PUBLIC = 'B'.repeat(87)
const REAL_PRIVATE = 'C'.repeat(43)
check(base64UrlByteLength(REAL_PUBLIC), 65, 'the stand-in public key is 65 bytes')
check(base64UrlByteLength(REAL_PRIVATE), 32, 'the stand-in private key is 32 bytes')

const good = describeVapidConfig({ publicKey: REAL_PUBLIC, privateKey: REAL_PRIVATE })
check(good.configured, true, 'a correctly sized pair is accepted')
check(good.problems.length, 0, 'a correctly sized pair reports no problems')

check(
  describeVapidConfig({ publicKey: 'B'.repeat(43), privateKey: REAL_PRIVATE }).configured,
  false,
  'a public key of the wrong length is rejected'
)
check(
  describeVapidConfig({ publicKey: REAL_PUBLIC, privateKey: 'C'.repeat(87) }).configured,
  false,
  'a private key of the wrong length is rejected'
)
check(
  describeVapidConfig({ publicKey: REAL_PUBLIC }).configured,
  false,
  'a public key without a private key is not configured'
)

// ---------------------------------------------------------------------------

section('subscriptions')

const normalised = normaliseSubscription(validSubscription())
checkTruthy(normalised, 'a well-formed subscription is accepted')
check(normalised.endpoint, validSubscription().endpoint, 'the endpoint is preserved')
check(normalised.keys.auth, 'tBHItJI5svbpez7KI4CCXg', 'the auth key is preserved')

// The old guard was `subscription && subscription.endpoint`. Everything below
// passes that check and then fails at send time — once per notification,
// forever, because nothing removed it.
check(normaliseSubscription(validSubscription({ keys: undefined })), null, 'a subscription with no keys is rejected')
check(normaliseSubscription(validSubscription({ keys: {} })), null, 'a subscription with empty keys is rejected')
check(
  normaliseSubscription(validSubscription({ keys: { p256dh: 'abc' } })),
  null,
  'a subscription missing the auth key is rejected'
)
check(
  normaliseSubscription(validSubscription({ keys: { p256dh: '', auth: 'x' } })),
  null,
  'a blank p256dh is rejected'
)
check(normaliseSubscription(null), null, 'null is rejected')
check(normaliseSubscription('a string'), null, 'a string is rejected')
check(normaliseSubscription({}), null, 'an empty object is rejected')
check(normaliseSubscription(validSubscription({ endpoint: '' })), null, 'a blank endpoint is rejected')

checkDeep(
  normaliseSubscription(validSubscription({ expirationTime: 12345 })).expirationTime,
  null,
  'a non-string expirationTime is normalised away rather than stored as-is'
)

section('endpoints')

check(
  normaliseEndpoint('  https://fcm.googleapis.com/fcm/send/abc  '),
  'https://fcm.googleapis.com/fcm/send/abc',
  'surrounding whitespace is trimmed'
)
check(normaliseEndpoint('http://example.com/push'), null, 'a plain-http endpoint is rejected')
check(normaliseEndpoint('/relative/path'), null, 'a relative path is rejected')
check(normaliseEndpoint('file:///etc/passwd'), null, 'a non-https scheme is rejected')
check(normaliseEndpoint(''), null, 'an empty endpoint is rejected')
check(normaliseEndpoint(null), null, 'null is rejected')
check(
  normaliseEndpoint('HTTPS://updates.push.services.mozilla.com/wpush/v2/abc'),
  'HTTPS://updates.push.services.mozilla.com/wpush/v2/abc',
  'the scheme check is case-insensitive'
)

// ---------------------------------------------------------------------------

section('send failures — which ones mean "delete this device"')

check(classifySendFailure({ statusCode: 404 }), FAILURE_KINDS.GONE, '404 is permanently gone')
check(classifySendFailure({ statusCode: 410 }), FAILURE_KINDS.GONE, '410 Gone is permanently gone')
check(classifySendFailure({ status: 410 }), FAILURE_KINDS.GONE, 'the status field is read under either name')

check(classifySendFailure({ statusCode: 401 }), FAILURE_KINDS.MISCONFIGURED, '401 is our VAPID identity, not the device')
check(classifySendFailure({ statusCode: 403 }), FAILURE_KINDS.MISCONFIGURED, '403 is our keys')
check(classifySendFailure({ statusCode: 400 }), FAILURE_KINDS.MISCONFIGURED, '400 is our payload')
check(classifySendFailure({ statusCode: 413 }), FAILURE_KINDS.MISCONFIGURED, '413 is our payload size')

check(classifySendFailure({ statusCode: 429 }), FAILURE_KINDS.RETRYABLE, '429 is transient')
check(classifySendFailure({ statusCode: 500 }), FAILURE_KINDS.RETRYABLE, '500 is transient')
check(classifySendFailure({ statusCode: 503 }), FAILURE_KINDS.RETRYABLE, '503 is transient')
check(classifySendFailure(new Error('socket hang up')), FAILURE_KINDS.RETRYABLE, 'a network error is transient')
check(classifySendFailure(undefined), FAILURE_KINDS.RETRYABLE, 'an unknown failure is treated as transient')

// A misconfigured send must never delete the subscription: the user would lose
// her registration because an operator got the key pair wrong.
checkTruthy(
  classifySendFailure({ statusCode: 401 }) !== FAILURE_KINDS.GONE,
  'an operator error never causes a device to be unregistered'
)

// ---------------------------------------------------------------------------

section('summarising a batch — "success" must mean delivered')

const allGood = summariseSendResults([
  { endpoint: 'https://a', ok: true },
  { endpoint: 'https://b', ok: true },
])
check(allGood.success, true, 'two deliveries is success')
check(allGood.delivered, 2, 'both are counted')
check(allGood.failed, 0, 'nothing failed')
check(allGood.goneEndpoints.length, 0, 'nothing to prune')

// This is the case the old code got wrong. It returned
// `{ success: true, count: results.length }` without inspecting a single
// result, so ten rejections were reported as ten successes.
const allFailed = summariseSendResults([
  { endpoint: 'https://a', ok: false, error: { statusCode: 500 } },
  { endpoint: 'https://b', ok: false, error: { statusCode: 500 } },
])
check(allFailed.success, false, 'zero deliveries is not success, however many were attempted')
check(allFailed.attempted, 2, 'the attempt count is still reported')
check(allFailed.delivered, 0, 'nothing was delivered')
check(allFailed.failed, 2, 'both failures are counted')

const mixed = summariseSendResults([
  { endpoint: 'https://phone', ok: true },
  { endpoint: 'https://old-laptop', ok: false, error: { statusCode: 410 } },
  { endpoint: 'https://tablet', ok: false, error: { statusCode: 503 } },
])
check(mixed.success, true, 'one delivery out of three is still a delivery')
check(mixed.delivered, 1, 'the delivered count is exact')
checkDeep(mixed.goneEndpoints, ['https://old-laptop'], 'only the 410 endpoint is marked for deletion')
check(mixed.misconfigured, false, 'a transient failure is not an operator error')

const misconfigured = summariseSendResults([
  { endpoint: 'https://a', ok: false, error: { statusCode: 401 } },
])
check(misconfigured.misconfigured, true, 'a 401 flags the configuration')
check(misconfigured.goneEndpoints.length, 0, 'a 401 does not delete the subscription')

const empty = summariseSendResults([])
check(empty.success, false, 'no subscriptions is not success')
check(empty.attempted, 0, 'nothing was attempted')
check(summariseSendResults(null).attempted, 0, 'a null batch is handled')
check(summariseSendResults(undefined).success, false, 'an undefined batch is not success')

// A row with no endpoint cannot be pruned by endpoint, and must not put
// `undefined` into a delete filter.
const noEndpoint = summariseSendResults([{ ok: false, error: { statusCode: 410 } }])
check(noEndpoint.goneEndpoints.length, 0, 'a gone result with no endpoint is not queued for deletion')

// ---------------------------------------------------------------------------

section('UI states — only one of them may claim success')

check(isPushEnabled(PUSH_STATES.ENABLED), true, 'ENABLED is a success')
for (const state of Object.values(PUSH_STATES)) {
  if (state === PUSH_STATES.ENABLED) continue
  check(isPushEnabled(state), false, `${state} is not presented as success`)
  checkTruthy(describePushState(state).length > 0, `${state} has a message for the user`)
}

checkTruthy(
  describePushState(PUSH_STATES.NOT_CONFIGURED).includes('not set up'),
  'an unconfigured server is described as such, not as a permission problem'
)
checkTruthy(
  describePushState(PUSH_STATES.DENIED).includes('browser settings'),
  'a blocked permission tells the user where to change it'
)
checkTruthy(
  describePushState(PUSH_STATES.DISMISSED) !== describePushState(PUSH_STATES.DENIED),
  'a dismissed prompt is not described as a blocked one — it can be asked again'
)
checkTruthy(describePushState('nonsense').length > 0, 'an unknown state still produces a message')

// ---------------------------------------------------------------------------

console.log(`\n${failed === 0 ? '✅' : '❌'} ${passed} passed, ${failed} failed`)
process.exit(failed === 0 ? 0 : 1)
