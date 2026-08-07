/**
 * Regression suite for lib/security-headers.mjs.
 *
 * Two bugs, both from writing policy as literals inside next.config.js where
 * nothing could read it as a whole:
 *
 * 1. `/api/cycles`, `/api/log-day` and `/api/pcod-risk` were served with
 *    `Cache-Control: private, max-age=60` (300 for the risk score). `private`
 *    only means "not a shared proxy" — it explicitly permits the *browser* to
 *    store the response, and browsers store cacheable responses on disk.
 *    Signing out does not clear the HTTP cache, so on a shared machine the
 *    next person could read the previous user's cycle history out of it. It
 *    also walks straight around the app's E2EE layer, which exists so that
 *    health data is not readable at rest.
 * 2. The entire Content-Security-Policy was `frame-ancestors 'self';` — which
 *    duplicates the X-Frame-Options header set beside it. In CSP an absent
 *    directive is not "deny", it is "unrestricted", so there was no constraint
 *    on script execution, script origins, `<base href>` or form targets, in an
 *    app that renders user-authored forum content.
 *
 *   node scripts/test-security-headers.js
 */

import {
  NO_STORE,
  SENSITIVE_API_PREFIXES,
  TRUSTED_ORIGINS,
  buildContentSecurityPolicy,
  cacheControlFor,
  cspHeaderName,
  isReportOnly,
  isSensitiveApiPath,
  parseAllowedOrigins,
  resolveCorsHeaders,
  staticSecurityHeaders,
  supabaseOrigins,
} from '../lib/security-headers.mjs'

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

/** Pulls one directive's value out of a CSP string. */
function directive(csp, name) {
  const match = csp.split(';').map((part) => part.trim()).find((part) => part.startsWith(`${name} `))
  return match ? match.slice(name.length + 1).trim() : null
}

/**
 * A directive's source list as exact tokens.
 *
 * Membership rather than `String.includes`: a CSP directive is a
 * space-separated token list, and a substring test both over-matches
 * (`'self'` inside `'unsafe-inline'`… no, but `https://a.com` inside
 * `https://a.com.evil.test` yes) and under-states what the assertion means.
 * The exact-token form is what these tests are actually claiming.
 */
function sources(csp, name) {
  const value = directive(csp, name)
  return value === null ? [] : value.split(/\s+/).filter(Boolean)
}

/** Whether a source list contains a host — checked as a whole token. */
function allows(csp, name, source) {
  return sources(csp, name).includes(source)
}

/**
 * The host part of a CSP source expression, or '' for a keyword like `'self'`.
 *
 * Lets the "this vendor must not be here" assertions match on the host rather
 * than on a substring of the whole token.
 */
function hostOf(source) {
  if (source.startsWith("'")) return ''
  try {
    return new URL(source.replace(/^wss:/, 'https:')).host
  } catch {
    return source.replace(/^[a-z]+:\/\//, '').split('/')[0]
  }
}

const SUPABASE_URL = 'https://abcdefgh.supabase.co'

// ---------------------------------------------------------------------------

section('the cache bug — health data must not reach the disk')

for (const prefix of SENSITIVE_API_PREFIXES) {
  check(isSensitiveApiPath(prefix), true, `${prefix} is recognised as sensitive`)
  check(cacheControlFor(prefix), NO_STORE, `${prefix} is no-store`)
}

// The three paths that actually carried `private, max-age=…`.
check(cacheControlFor('/api/cycles'), NO_STORE, 'cycle history is no longer cached to disk')
check(cacheControlFor('/api/log-day'), NO_STORE, 'daily symptom logs are no longer cached to disk')
check(cacheControlFor('/api/pcod-risk'), NO_STORE, 'the PCOD risk assessment is no longer cached to disk')

// `/api/log-day/all` is a sub-path. A prefix match is what stops it being
// missed the way the config's one-source-per-route list missed things.
check(isSensitiveApiPath('/api/log-day/all'), true, 'sub-paths inherit the policy')
check(isSensitiveApiPath('/api/challenges/heatmap'), true, 'nested challenge routes are covered')
check(isSensitiveApiPath('/api/cycles?limit=12'), true, 'a query string does not defeat the match')

// Paths that carry no personal data are left alone rather than blanket
// no-store'd, which would throw away caching that is doing useful work.
check(isSensitiveApiPath('/api/forum/posts'), false, 'the public forum feed is not health data')
check(isSensitiveApiPath('/api/forum/categories'), false, 'category listings are not health data')
check(isSensitiveApiPath('/api/webhooks/clerk'), false, 'the webhook endpoint is not health data')
check(cacheControlFor('/api/forum/posts'), null, 'a non-sensitive path gets no Cache-Control override')
check(cacheControlFor('/'), null, 'the landing page is untouched')

// A prefix must not match a longer sibling by accident.
check(isSensitiveApiPath('/api/cyclesomething'), false, '/api/cyclesomething is not /api/cycles')
check(isSensitiveApiPath('/api/profiles-public'), false, '/api/profiles-public is not /api/profile')

check(isSensitiveApiPath(''), false, 'an empty path is not sensitive')
check(isSensitiveApiPath(null), false, 'null is not sensitive')
check(isSensitiveApiPath(undefined), false, 'undefined is not sensitive')

checkTruthy(NO_STORE.includes('no-store'), 'the header actually says no-store')
checkTruthy(!NO_STORE.includes('private'), "and does not say 'private', which permits disk storage")
checkTruthy(!NO_STORE.includes('stale-while-revalidate'), 'and carries no revalidation window')

// ---------------------------------------------------------------------------

section('the CSP — the directives that were absent entirely')

const csp = buildContentSecurityPolicy({ supabaseUrl: SUPABASE_URL })

// Every one of these was missing. An absent CSP directive is unrestricted.
for (const name of [
  'default-src',
  'script-src',
  'style-src',
  'img-src',
  'font-src',
  'connect-src',
  'worker-src',
  'frame-src',
  'object-src',
  'base-uri',
  'form-action',
  'frame-ancestors',
]) {
  checkTruthy(directive(csp, name) !== null, `${name} is present`)
}

check(directive(csp, 'object-src'), "'none'", 'plugin embedding is denied outright')
check(directive(csp, 'base-uri'), "'self'", 'a <base> tag cannot redirect relative script URLs off-origin')
check(directive(csp, 'form-action'), "'self'", 'a form cannot post credentials to another origin')
check(directive(csp, 'frame-ancestors'), "'self'", 'clickjacking protection is retained')
check(directive(csp, 'default-src'), "'self'", 'everything not named falls back to same-origin')

checkTruthy(csp.includes('upgrade-insecure-requests'), 'sub-resources are upgraded to https in production')

section('connect-src is an allow-list, not a wildcard')

const connectSources = sources(csp, 'connect-src')
checkTruthy(allows(csp, 'connect-src', "'self'"), 'the app can call itself')
checkTruthy(allows(csp, 'connect-src', SUPABASE_URL), 'the configured Supabase project is allowed')
checkTruthy(
  allows(csp, 'connect-src', 'wss://abcdefgh.supabase.co'),
  'and its realtime WebSocket, which is a separate scheme'
)
checkTruthy(
  TRUSTED_ORIGINS.clerk.every((origin) => connectSources.includes(origin)),
  'Clerk is allowed'
)
checkTruthy(!connectSources.includes('*'), 'connect-src is not a bare wildcard')
checkTruthy(!connectSources.includes('https:'), 'nor a bare https: scheme source, which is nearly as wide')

// Gemini and Groq are called from Route Handlers, never the browser. Listing
// them would widen the policy for nothing.
//
// Checked host by host rather than by substring: a source list entry is a whole
// token, and `connect.includes('groq.com')` would also be satisfied by
// `https://groq.com.evil.test`, which is the opposite of what this asserts.
checkTruthy(
  !connectSources.some((source) => /(^|\.)googleapis\.com$/.test(hostOf(source))),
  'Gemini is not in connect-src — it is a server-side call'
)
checkTruthy(
  !connectSources.some((source) => /(^|\.)groq\.com$/.test(hostOf(source))),
  'Groq is not in connect-src — it is a server-side call'
)

section('supabaseOrigins')

checkDeep(
  supabaseOrigins('https://abc.supabase.co'),
  ['https://abc.supabase.co', 'wss://abc.supabase.co'],
  'both the https origin and the wss host are derived'
)
checkDeep(supabaseOrigins('https://abc.supabase.co/rest/v1'), ['https://abc.supabase.co', 'wss://abc.supabase.co'], 'a path is stripped')
checkDeep(supabaseOrigins(''), [], 'an empty URL contributes nothing')
checkDeep(supabaseOrigins(undefined), [], 'an unset URL contributes nothing')
checkDeep(supabaseOrigins('not a url'), [], 'a malformed URL contributes nothing rather than widening the policy')

section('script-src modes')

// The mode that ships today: no nonce, so 'unsafe-inline' plus a host list.
const withoutNonce = directive(buildContentSecurityPolicy({}), 'script-src')
checkTruthy(withoutNonce.includes("'unsafe-inline'"), 'without a nonce, inline scripts are allowed')
checkTruthy(
  !withoutNonce.includes("'strict-dynamic'"),
  "and 'strict-dynamic' is absent — it would make the browser ignore both 'unsafe-inline' and the host list"
)
checkTruthy(
  TRUSTED_ORIGINS.clerk.every((o) => withoutNonce.split(/\s+/).includes(o)),
  'the host allow-list is what carries the policy'
)

// The stronger mode, available once a nonce can be propagated to the request.
const withNonce = directive(buildContentSecurityPolicy({ nonce: 'abc123' }), 'script-src')
checkTruthy(withNonce.includes("'nonce-abc123'"), 'a nonce is emitted when one is supplied')
checkTruthy(withNonce.includes("'strict-dynamic'"), "and 'strict-dynamic' with it")
checkTruthy(!withNonce.includes("'unsafe-inline'"), "and 'unsafe-inline' is dropped, which is the whole point")

section('development vs production')

const dev = buildContentSecurityPolicy({ isDev: true, supabaseUrl: SUPABASE_URL })
const prod = buildContentSecurityPolicy({ isDev: false, supabaseUrl: SUPABASE_URL })

checkTruthy(directive(dev, 'script-src').includes("'unsafe-eval'"), 'React Refresh gets eval in development')
checkTruthy(!directive(prod, 'script-src').includes("'unsafe-eval'"), "and production does not — that is most of what script-src buys")
checkTruthy(allows(dev, 'connect-src', 'ws://localhost:*'), 'the dev server websocket is allowed in development')
checkTruthy(
  !sources(prod, 'connect-src').some((source) => hostOf(source).startsWith('localhost')),
  'and never in production'
)
checkTruthy(!dev.includes('upgrade-insecure-requests'), 'http://localhost is not upgraded, which would break the dev server')

section('report-only')

check(cspHeaderName(true), 'Content-Security-Policy-Report-Only', 'report-only uses the report-only header')
check(cspHeaderName(false), 'Content-Security-Policy', 'enforcing uses the enforcing header')

// A CSP that breaks the product gets reverted wholesale, so enforcing must be
// a decision someone made rather than something that happens on merge.
check(isReportOnly(undefined), true, 'unset means report-only')
check(isReportOnly(''), true, 'empty means report-only')
check(isReportOnly('true'), true, "'true' means report-only")
check(isReportOnly('false'), false, "only an explicit 'false' enforces")
check(isReportOnly('FALSE'), false, 'the check is case-insensitive')
check(isReportOnly(' false '), false, 'surrounding whitespace is tolerated')
check(isReportOnly('no'), true, 'anything else stays report-only')

// ---------------------------------------------------------------------------

section('CORS — per request, against an allow-list')

const allowed = ['https://hercycle.app', 'https://www.hercycle.app']

const sameOrigin = resolveCorsHeaders({ origin: null, allowedOrigins: allowed })
checkDeep(sameOrigin, { Vary: 'Origin' }, 'a request with no Origin gets Vary and nothing else')

const good = resolveCorsHeaders({ origin: 'https://hercycle.app', allowedOrigins: allowed })
check(good['Access-Control-Allow-Origin'], 'https://hercycle.app', 'an allowed origin is echoed back')
check(good['Access-Control-Allow-Credentials'], 'true', 'credentials are permitted, since the app authenticates by cookie')
check(good.Vary, 'Origin', 'Vary: Origin is set — its absence was a cache-poisoning hazard')
check(good['Access-Control-Allow-Methods'], undefined, 'preflight headers are not sent on an ordinary response')
check(good['Access-Control-Allow-Headers'], undefined, 'nor are the allowed request headers')

const bad = resolveCorsHeaders({ origin: 'https://evil.example', allowedOrigins: allowed })
check(bad['Access-Control-Allow-Origin'], undefined, 'a disallowed origin gets no ACAO at all')
check(bad.Vary, 'Origin', 'but still gets Vary, because the response does vary by origin')

const preflight = resolveCorsHeaders({ origin: 'https://hercycle.app', allowedOrigins: allowed, isPreflight: true })
check(preflight['Access-Control-Allow-Methods'], 'GET, POST, PATCH, DELETE, OPTIONS', 'a preflight is told the methods')
check(preflight['Access-Control-Allow-Headers'], 'Content-Type, Authorization', 'and the headers')
check(preflight['Access-Control-Max-Age'], '86400', 'and how long it may cache the answer')
checkTruthy(
  !preflight['Access-Control-Allow-Methods'].includes('PUT'),
  'PUT is not advertised — no route implements it'
)

// This is the case that produced `Access-Control-Allow-Origin:` with an empty
// value on every response in the app, including static assets.
const unconfigured = resolveCorsHeaders({ origin: 'https://hercycle.app', allowedOrigins: [] })
check(unconfigured['Access-Control-Allow-Origin'], undefined, 'with no allow-list configured, no ACAO is emitted')
checkTruthy(
  !Object.values(unconfigured).includes(''),
  'and certainly not an empty one, which is not a valid header value'
)

// Credentialed CORS forbids a wildcard origin, which is the other reason the
// origin is echoed rather than starred.
checkTruthy(good['Access-Control-Allow-Origin'] !== '*', 'the origin is never wildcarded alongside credentials')

const trailingSlash = resolveCorsHeaders({ origin: 'https://hercycle.app/', allowedOrigins: allowed })
check(trailingSlash['Access-Control-Allow-Origin'], 'https://hercycle.app', 'a trailing slash on the Origin is normalised')

section('parseAllowedOrigins')

checkDeep(parseAllowedOrigins('https://a.com,https://b.com'), ['https://a.com', 'https://b.com'], 'a comma-separated list parses')
checkDeep(parseAllowedOrigins(' https://a.com , https://b.com '), ['https://a.com', 'https://b.com'], 'whitespace is trimmed')
checkDeep(parseAllowedOrigins('https://a.com/'), ['https://a.com'], 'trailing slashes are normalised away')
checkDeep(parseAllowedOrigins('https://a.com,,'), ['https://a.com'], 'empty entries are dropped')
checkDeep(parseAllowedOrigins(''), [], 'an empty value is an empty list')
checkDeep(parseAllowedOrigins(undefined), [], 'an unset value is an empty list')

// ---------------------------------------------------------------------------

section('static headers — the ones that were missing')

const staticProd = staticSecurityHeaders({ isDev: false })
const keys = staticProd.map((header) => header.key)

for (const key of [
  'X-Frame-Options',
  'X-Content-Type-Options',
  'Referrer-Policy',
  'Permissions-Policy',
  'Cross-Origin-Opener-Policy',
  'X-Permitted-Cross-Domain-Policies',
  'Strict-Transport-Security',
]) {
  checkTruthy(keys.includes(key), `${key} is set`)
}

const hsts = staticProd.find((header) => header.key === 'Strict-Transport-Security')
checkTruthy(hsts.value.includes('includeSubDomains'), 'HSTS covers subdomains')

// HSTS on localhost would pin the browser to https for localhost across every
// project on the machine.
const staticDev = staticSecurityHeaders({ isDev: true })
checkTruthy(
  !staticDev.some((header) => header.key === 'Strict-Transport-Security'),
  'HSTS is not sent in development'
)

const permissions = staticProd.find((header) => header.key === 'Permissions-Policy').value
for (const feature of ['camera', 'microphone', 'geolocation', 'payment']) {
  checkTruthy(permissions.includes(`${feature}=()`), `${feature} is denied`)
}
// The PWA needs notifications, so the policy must not deny them. The point is
// to shrink the surface, not to break the product.
checkTruthy(!permissions.includes('notifications='), 'notifications are not denied — the PWA needs them')

const coop = staticProd.find((header) => header.key === 'Cross-Origin-Opener-Policy').value
check(coop, 'same-origin-allow-popups', "COOP allows popups, because Clerk's OAuth flow opens one")

// ---------------------------------------------------------------------------

console.log(`\n${failed === 0 ? '✅' : '❌'} ${passed} passed, ${failed} failed`)
process.exit(failed === 0 ? 0 : 1)
