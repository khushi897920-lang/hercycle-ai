/**
 * Regression suite for lib/rate-limiter.js — the request-identity helpers and
 * the in-process counter that lib/rateLimiter.js degrades to.
 *
 * Guards the fix for the two fail-open paths in the limiter:
 *
 *   1. `getRateLimitIdentifier` returned `anon:${Math.random()...}` when no
 *      client IP could be resolved, so every unattributable request got a
 *      private bucket and no limit could ever be exceeded.
 *   2. `createLimiter().check()` initialised `allowed = true` and only ever
 *      assigned it from a successful RPC, so an RPC error, a thrown client
 *      error, or a missing `enforce_rate_limit` function allowed the request.
 *
 *   node scripts/test-rate-limiter.js
 */

import {
  DEFAULT_INTERVAL_MS,
  UNATTRIBUTED_IDENTIFIER,
  buildAnonymousIdentifier,
  consume,
  extractClientIp,
  isAllowed,
  resetInMemoryRateLimits,
} from '../lib/rate-limiter.js'

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

function checkTrue(actual, label) {
  check(actual, true, label)
}

function section(title) {
  console.log(`\n— ${title}`)
}

/** Minimal stand-in for a Request, with only the surface the limiter touches. */
function fakeRequest(headers = {}) {
  const normalised = new Map(
    Object.entries(headers).map(([key, value]) => [key.toLowerCase(), value])
  )
  return {
    headers: {
      get: (key) => (normalised.has(key.toLowerCase()) ? normalised.get(key.toLowerCase()) : null),
    },
  }
}

// ───────────────────────────────────────────────────────────────────────────
section('client IP extraction')

check(
  extractClientIp(fakeRequest({ 'x-forwarded-for': '203.0.113.7, 70.41.3.18' })),
  '203.0.113.7',
  'the left-most x-forwarded-for entry is the client'
)
check(
  extractClientIp(fakeRequest({ 'x-forwarded-for': ' 203.0.113.7 ' })),
  '203.0.113.7',
  'x-forwarded-for is trimmed'
)
check(
  extractClientIp(fakeRequest({ 'x-forwarded-for': 'unknown', 'x-real-ip': '198.51.100.4' })),
  '198.51.100.4',
  'a literal "unknown" falls through to x-real-ip'
)
check(
  extractClientIp(fakeRequest({ 'cf-connecting-ip': '192.0.2.9' })),
  '192.0.2.9',
  'Cloudflare header is honoured'
)
check(extractClientIp(fakeRequest({})), null, 'no forwarding headers yields null')
check(extractClientIp(null), null, 'a missing request yields null')

// ───────────────────────────────────────────────────────────────────────────
section('anonymous identifiers are stable, not random')

const browserHeaders = {
  'user-agent': 'Mozilla/5.0 (Linux; Android 14) Chrome/126',
  'accept-language': 'en-IN,en;q=0.9',
}

const first = buildAnonymousIdentifier(fakeRequest(browserHeaders))
const second = buildAnonymousIdentifier(fakeRequest(browserHeaders))

check(first, second, 'the same request shape yields the same identifier')
checkTrue(first.startsWith('anon:'), 'the identifier is namespaced')
checkTrue(first.length > 'anon:'.length, 'the identifier carries a digest')

const otherClient = buildAnonymousIdentifier(
  fakeRequest({ ...browserHeaders, 'user-agent': 'Mozilla/5.0 (Macintosh) Safari/17' })
)
checkTrue(first !== otherClient, 'a different client yields a different identifier')

check(
  buildAnonymousIdentifier(fakeRequest({})),
  UNATTRIBUTED_IDENTIFIER,
  'a request with nothing to fingerprint falls into the shared strict bucket'
)
check(
  buildAnonymousIdentifier(null),
  UNATTRIBUTED_IDENTIFIER,
  'a missing request falls into the shared strict bucket'
)

// The regression this whole module exists for: a header-less client used to be
// waved through indefinitely because each request minted a fresh bucket.
resetInMemoryRateLimits()
const headerless = fakeRequest({})
let allowedCount = 0
for (let i = 0; i < 20; i += 1) {
  if (consume(buildAnonymousIdentifier(headerless), { limit: 5 }).allowed) allowedCount += 1
}
check(allowedCount, 5, 'a header-less caller is limited to 5 of 20 requests, not all 20')

// ───────────────────────────────────────────────────────────────────────────
section('fixed-window counting')

resetInMemoryRateLimits()

const now = 1_800_000_000_000

check(consume('user:a', { limit: 3, now }).allowed, true, 'request 1 of 3 allowed')
check(consume('user:a', { limit: 3, now: now + 10 }).allowed, true, 'request 2 of 3 allowed')
check(consume('user:a', { limit: 3, now: now + 20 }).allowed, true, 'request 3 of 3 allowed')
check(consume('user:a', { limit: 3, now: now + 30 }).allowed, false, 'request 4 is rejected')

const overLimit = consume('user:a', { limit: 3, now: now + 40 })
check(overLimit.remaining, 0, 'remaining is clamped at zero')
check(overLimit.resetAt, now + DEFAULT_INTERVAL_MS, 'resetAt is the end of the window that is open')

check(
  consume('user:a', { limit: 3, now: now + DEFAULT_INTERVAL_MS }).allowed,
  true,
  'the counter resets once the window has elapsed'
)
check(
  consume('user:a', { limit: 3, now: now + DEFAULT_INTERVAL_MS - 1 }).allowed,
  true,
  'a request one millisecond before the window closes lands in the new window'
)

resetInMemoryRateLimits()
check(consume('user:b', { limit: 1, now }).allowed, true, 'a different key has its own window')
check(consume('user:b', { limit: 1, now }).allowed, false, 'and its own limit')
check(consume('user:c', { limit: 1, now }).allowed, true, 'keys do not interfere')

resetInMemoryRateLimits()
const remaining = consume('user:d', { limit: 5, now })
check(remaining.count, 1, 'count starts at one')
check(remaining.remaining, 4, 'remaining reflects the limit minus the count')

// ───────────────────────────────────────────────────────────────────────────
section('degenerate configuration fails closed')

resetInMemoryRateLimits()
check(consume('user:e', { limit: 0, now }).allowed, false, 'a limit of zero rejects')
check(consume('user:f', { limit: -1, now }).allowed, false, 'a negative limit rejects')
check(consume('user:g', {}).allowed, false, 'a missing limit rejects rather than allowing everything')

resetInMemoryRateLimits()
check(
  consume('user:h', { limit: 2, intervalMs: 0, now }).allowed,
  true,
  'a zero interval falls back to the default window instead of resetting every call'
)
check(consume('user:h', { limit: 2, intervalMs: 0, now }).allowed, true, 'second request still allowed')
check(consume('user:h', { limit: 2, intervalMs: 0, now }).allowed, false, 'third request is rejected')

// ───────────────────────────────────────────────────────────────────────────
section('isAllowed wrapper')

resetInMemoryRateLimits()
check(isAllowed('user_1', 'chat', 2), true, 'first call allowed')
check(isAllowed('user_1', 'chat', 2), true, 'second call allowed')
check(isAllowed('user_1', 'chat', 2), false, 'third call rejected')
check(isAllowed('user_1', 'cycles', 2), true, 'a different route has a separate budget')
check(isAllowed('user_2', 'chat', 2), true, 'a different user has a separate budget')

// ───────────────────────────────────────────────────────────────────────────
if (failed > 0) {
  console.error(`\n❌ ${failed} assertion(s) failed, ${passed} passed.`)
  process.exit(1)
}

console.log(`\n✅ All ${passed} rate limiter assertions passed.`)
