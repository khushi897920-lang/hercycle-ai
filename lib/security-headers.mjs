/**
 * security-headers.mjs — the policy behind the app's HTTP response headers.
 *
 * The .mjs extension is deliberate: `next.config.js` is CommonJS and reaches
 * this module through a dynamic `import()` inside its async `headers()`. With a
 * plain .js extension Node tries CommonJS first, fails, reparses as ESM, and
 * warns about it on every single build.
 *
 * ## Why this module exists
 *
 * Two things were wrong in `next.config.js`, and both were wrong in the same
 * way: the policy was expressed as literals inside a config file, where it
 * could not be reviewed as a whole or tested at all.
 *
 * ### 1. Personal health data was being written to the browser's disk cache
 *
 *     { source: '/api/cycles',         headers: [{ key: 'Cache-Control', value: 'private, max-age=60,  stale-while-revalidate=30' }] }
 *     { source: '/api/log-day/:path*', headers: [{ key: 'Cache-Control', value: 'private, max-age=60,  stale-while-revalidate=30' }] }
 *     { source: '/api/pcod-risk',      headers: [{ key: 'Cache-Control', value: 'private, max-age=300, stale-while-revalidate=60' }] }
 *
 * `private` means "not a shared proxy". It explicitly *permits* the browser to
 * store the response, and browsers store cacheable responses on disk. So the
 * JSON bodies of the cycle history, the daily symptom logs, and the PCOD risk
 * assessment were written to the profile's cache directory in plaintext and
 * served back from there without the server being consulted.
 *
 * Signing out does not clear the HTTP cache. On a shared laptop, within the
 * window, a back navigation or a direct request returns the previous user's
 * cycle history. The app has an entire E2EE layer built so that health data is
 * not readable at rest; caching the decrypted response to disk writes the
 * plaintext straight back out beside it.
 *
 * ### 2. The CSP was one directive
 *
 *     { key: 'Content-Security-Policy', value: "frame-ancestors 'self';" }
 *
 * That is clickjacking protection, and it duplicates the `X-Frame-Options`
 * header on the line above it. In CSP an *absent* directive is not "deny", it
 * is "unrestricted" — so there was no constraint at all on script execution,
 * script origins, `<base href>` hijacking, plugin embedding, or where a form
 * may post to. This app renders user-authored forum content and holds an
 * encryption passphrase in client memory behind a PIN.
 *
 * ## What is here
 *
 * Pure functions and data. No `next/server`, no `NextResponse`, nothing that
 * needs a request to exist — so `next.config.js`, `middleware.js` and
 * `scripts/test-security-headers.js` can all read the same policy.
 */

// ---------------------------------------------------------------------------
// Trusted origins
// ---------------------------------------------------------------------------

/**
 * The third-party origins the browser genuinely talks to.
 *
 * Kept as a registry rather than inlined into the CSP string so that adding a
 * vendor is one obvious edit, and so a reviewer can see the whole external
 * surface of the app in one place.
 *
 * Gemini and Groq are deliberately absent: both are called from Route
 * Handlers, never from the browser, so putting them in `connect-src` would
 * widen the policy for no reason.
 */
export const TRUSTED_ORIGINS = Object.freeze({
  // Clerk serves its SDK and its hosted sign-in components from these.
  clerk: Object.freeze([
    'https://*.clerk.accounts.dev',
    'https://*.clerk.com',
    'https://clerk.hercycle.app',
  ]),
  // Clerk's bot-protection challenge runs in a frame.
  clerkFrames: Object.freeze(['https://*.clerk.accounts.dev', 'https://challenges.cloudflare.com']),
  // Avatar images.
  images: Object.freeze(['https://img.clerk.com', 'https://images.clerk.dev']),
})

/**
 * Derives the Supabase origins the browser needs from the configured URL.
 *
 * The realtime channel is a WebSocket to the same host, which `connect-src`
 * must list separately because `wss:` is a different scheme.
 *
 * @param {string|undefined} supabaseUrl the value of NEXT_PUBLIC_SUPABASE_URL
 * @returns {string[]}
 */
export function supabaseOrigins(supabaseUrl) {
  if (typeof supabaseUrl !== 'string' || supabaseUrl.trim().length === 0) return []

  try {
    const { origin, host } = new URL(supabaseUrl)
    return [origin, `wss://${host}`]
  } catch {
    // A malformed URL widens nothing: the directive simply omits it, and the
    // resulting CSP violation is a much better signal than a silently
    // permissive policy.
    return []
  }
}

// ---------------------------------------------------------------------------
// Content-Security-Policy
// ---------------------------------------------------------------------------

/**
 * Builds the CSP header value.
 *
 * Notes on the choices that are not obvious:
 *
 * - **`script-src` supports two modes.** Given a nonce it emits
 *   `'nonce-…' 'strict-dynamic'`, which is the strong form: Next.js reads the
 *   nonce out of the CSP on the *incoming request* and stamps it onto its own
 *   script tags, and `'strict-dynamic'` extends that trust to the chunks they
 *   load. Without one it falls back to `'self' 'unsafe-inline'` plus the host
 *   allow-list.
 *
 *   The fallback is what ships today, and it is a deliberate, temporary
 *   compromise. Propagating a nonce requires `NextResponse.next({ request:
 *   { headers } })` so Next sees it on the request — and `middleware.js`
 *   hands its response to `next-intl`'s middleware, which builds its own
 *   rewrite response and has no seam for injected request headers.
 *   Restructuring that is a change worth making on its own, not as a rider on
 *   a header patch. Everything else in this policy — `default-src`,
 *   `connect-src`, `object-src`, `base-uri`, `form-action` — was *entirely
 *   absent* before, and an absent directive in CSP means unrestricted, so the
 *   fallback is still a large net gain.
 * - **`style-src` keeps `'unsafe-inline'`.** Not an oversight. The app styles
 *   through `style` attributes throughout (`PCODRiskCard` alone has a dozen),
 *   and a `style` attribute cannot carry a nonce. Removing it means rewriting
 *   the components first; a CSP that breaks the product gets reverted, and a
 *   reverted CSP protects nothing. `script-src` is where the value is.
 * - **`'unsafe-eval'` in development only.** React Refresh needs it. Shipping
 *   it to production would give back most of what `script-src` buys.
 * - **`object-src 'none'`, `base-uri 'self'`, `form-action 'self'`.** All
 *   three were missing entirely, and all three are directives an absent CSP
 *   leaves wide open. `base-uri` in particular: a single injected `<base>` tag
 *   redirects every relative script URL on the page.
 *
 * @param {{ nonce?: string, isDev?: boolean, supabaseUrl?: string }} [options]
 * @returns {string}
 */
export function buildContentSecurityPolicy(options = {}) {
  const { nonce, isDev = false, supabaseUrl } = options

  const scriptSrc = ["'self'"]
  if (nonce) {
    // 'strict-dynamic' makes the browser ignore the host allow-list below, so
    // it is only correct alongside a nonce.
    scriptSrc.push(`'nonce-${nonce}'`, "'strict-dynamic'")
  } else {
    scriptSrc.push("'unsafe-inline'")
  }
  // React Refresh needs eval. Shipping it to production would give back most
  // of what script-src buys.
  if (isDev) scriptSrc.push("'unsafe-eval'")
  scriptSrc.push(...TRUSTED_ORIGINS.clerk)

  const connectSrc = ["'self'", ...supabaseOrigins(supabaseUrl), ...TRUSTED_ORIGINS.clerk]
  if (isDev) connectSrc.push('ws://localhost:*', 'http://localhost:*')

  const directives = [
    ["default-src", ["'self'"]],
    ['script-src', scriptSrc],
    // `data:` for the inline SVG icons; blob: for next/image.
    ['style-src', ["'self'", "'unsafe-inline'"]],
    ['img-src', ["'self'", 'data:', 'blob:', ...TRUSTED_ORIGINS.images]],
    ['font-src', ["'self'", 'data:']],
    ['connect-src', connectSrc],
    // The service worker and any Worker the PWA spins up.
    ['worker-src', ["'self'", 'blob:']],
    ['manifest-src', ["'self'"]],
    ['media-src', ["'self'"]],
    ['frame-src', ["'self'", ...TRUSTED_ORIGINS.clerkFrames]],
    ['object-src', ["'none'"]],
    ['base-uri', ["'self'"]],
    ['form-action', ["'self'"]],
    ['frame-ancestors', ["'self'"]],
  ]

  const parts = directives.map(([name, values]) => `${name} ${dedupe(values).join(' ')}`)

  // Not in development: it rewrites http://localhost sub-resource requests to
  // https and breaks the dev server.
  if (!isDev) parts.push('upgrade-insecure-requests')

  return `${parts.join('; ')};`
}

/**
 * @param {string[]} values
 * @returns {string[]}
 */
function dedupe(values) {
  return [...new Set(values.filter((value) => typeof value === 'string' && value.length > 0))]
}

/**
 * Which CSP header to send.
 *
 * A tightening this large can break a page in a way no amount of local testing
 * finds, and a CSP that breaks the product gets reverted wholesale. Report-Only
 * is the default so the policy ships collecting violations, and an operator
 * turns it on by setting `CSP_REPORT_ONLY=false` once the reports are clean.
 *
 * @param {boolean} reportOnly
 * @returns {string}
 */
export function cspHeaderName(reportOnly) {
  return reportOnly ? 'Content-Security-Policy-Report-Only' : 'Content-Security-Policy'
}

/**
 * Reads the report-only switch.
 *
 * Defaults to `true` — enforcing has to be a decision someone made, not
 * something that happens on merge.
 *
 * @param {string|undefined} value
 * @returns {boolean}
 */
export function isReportOnly(value) {
  if (typeof value !== 'string') return true
  return value.trim().toLowerCase() !== 'false'
}

// ---------------------------------------------------------------------------
// Cache policy
// ---------------------------------------------------------------------------

/**
 * API paths whose responses carry personal health data.
 *
 * Written down once, here, rather than as three separate `source:` blocks in
 * `next.config.js` — which is how `/api/user/export` and `/api/export-data`
 * came to be missing from the list while `/api/cycles` was on it.
 *
 * A prefix match, because `/api/log-day/all` must be covered by the entry for
 * `/api/log-day`.
 */
export const SENSITIVE_API_PREFIXES = Object.freeze([
  '/api/cycles',
  '/api/log-day',
  '/api/pcod-risk',
  '/api/predict-cycle',
  '/api/weight',
  '/api/profile',
  '/api/export-data',
  '/api/user/export',
  '/api/partner-coach',
  '/api/chat',
  '/api/challenges',
])

/**
 * Whether a path returns data that must not be stored.
 *
 * @param {string} pathname
 * @returns {boolean}
 */
export function isSensitiveApiPath(pathname) {
  if (typeof pathname !== 'string' || pathname.length === 0) return false

  return SENSITIVE_API_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`) || pathname.startsWith(`${prefix}?`)
  )
}

/**
 * `no-store`, spelled out for the caches that only understand some of it.
 *
 * `no-store` alone is enough for a modern browser. `no-cache` and
 * `must-revalidate` are there for intermediaries that predate it, and
 * `max-age=0` for the ones that ignore all three.
 */
export const NO_STORE = 'no-store, no-cache, must-revalidate, max-age=0'

/**
 * The `Cache-Control` value for a path, or `null` to leave it alone.
 *
 * @param {string} pathname
 * @returns {string|null}
 */
export function cacheControlFor(pathname) {
  return isSensitiveApiPath(pathname) ? NO_STORE : null
}

// ---------------------------------------------------------------------------
// CORS
// ---------------------------------------------------------------------------

/**
 * Parses the allow-list.
 *
 * @param {string|undefined} value comma-separated origins
 * @returns {string[]}
 */
export function parseAllowedOrigins(value) {
  if (typeof value !== 'string') return []

  return value
    .split(',')
    .map((entry) => entry.trim().replace(/\/+$/, ''))
    .filter((entry) => entry.length > 0)
}

/**
 * Decides the CORS headers for one request.
 *
 * The previous configuration applied, to **every response in the app**
 * including HTML documents and static assets:
 *
 *     { key: 'Access-Control-Allow-Origin',  value: process.env.NEXT_PUBLIC_APP_URL || '' }
 *     { key: 'Access-Control-Allow-Methods', value: 'GET, POST, PUT, PATCH, DELETE, OPTIONS' }
 *     { key: 'Access-Control-Allow-Headers', value: 'Content-Type, Authorization' }
 *
 * Three problems, all fixed here:
 *
 * - With `NEXT_PUBLIC_APP_URL` unset that emits `Access-Control-Allow-Origin:`
 *   with an empty value on every response. An empty ACAO is not valid, and
 *   some intermediaries treat a malformed CORS header as a reason to reject.
 * - No `Vary: Origin`. A single-valued ACAO without it is a cache-poisoning
 *   hazard the moment anything in front of the app caches.
 * - `Allow-Methods` and `Allow-Headers` are preflight-response headers.
 *   Sending them on every ordinary response is noise that advertises a method
 *   surface the routes do not implement.
 *
 * Returns an empty object when the request has no `Origin` (a same-origin
 * navigation, a curl, a server-to-server call) or when the origin is not on
 * the list. Omitting the header is the correct refusal — the browser blocks
 * the read, and no header has to say so.
 *
 * @param {{ origin?: string|null, allowedOrigins?: string[], isPreflight?: boolean }} request
 * @returns {Record<string, string>}
 */
export function resolveCorsHeaders(request = {}) {
  const { origin, allowedOrigins = [], isPreflight = false } = request

  // Always set, whether or not the origin is allowed: the response body varies
  // by Origin either way, and a cache that does not know that will serve one
  // origin's response to another.
  const headers = { Vary: 'Origin' }

  if (typeof origin !== 'string' || origin.length === 0) return headers
  if (allowedOrigins.length === 0) return headers

  const normalised = origin.replace(/\/+$/, '')
  if (!allowedOrigins.includes(normalised)) return headers

  headers['Access-Control-Allow-Origin'] = normalised
  // The app authenticates with cookies, so a cross-origin caller needs this to
  // send them — and the spec forbids pairing it with `*`, which is another
  // reason the origin is echoed rather than wildcarded.
  headers['Access-Control-Allow-Credentials'] = 'true'

  if (isPreflight) {
    headers['Access-Control-Allow-Methods'] = 'GET, POST, PATCH, DELETE, OPTIONS'
    headers['Access-Control-Allow-Headers'] = 'Content-Type, Authorization'
    headers['Access-Control-Max-Age'] = '86400'
  }

  return headers
}

// ---------------------------------------------------------------------------
// Static headers
// ---------------------------------------------------------------------------

/**
 * Headers that are the same on every response.
 *
 * `Strict-Transport-Security`, `Permissions-Policy` and
 * `Cross-Origin-Opener-Policy` were all missing.
 *
 * `Permissions-Policy` denies the features this app has no use for. It does
 * *not* deny notifications, which the PWA needs — the point is to shrink the
 * surface, not to break the product.
 *
 * @param {{ isDev?: boolean }} [options]
 * @returns {Array<{ key: string, value: string }>}
 */
export function staticSecurityHeaders(options = {}) {
  const { isDev = false } = options

  const headers = [
    { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
    { key: 'X-Content-Type-Options', value: 'nosniff' },
    { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
    { key: 'X-Permitted-Cross-Domain-Policies', value: 'none' },
    {
      key: 'Permissions-Policy',
      value: [
        'camera=()',
        'microphone=()',
        'geolocation=()',
        'payment=()',
        'usb=()',
        'magnetometer=()',
        'gyroscope=()',
        'accelerometer=()',
        'interest-cohort=()',
      ].join(', '),
    },
    // same-origin-allow-popups rather than same-origin: Clerk's OAuth flow
    // opens a popup and talks back to the opener.
    { key: 'Cross-Origin-Opener-Policy', value: 'same-origin-allow-popups' },
  ]

  // HSTS over http://localhost would pin the browser to https for localhost
  // across every project on the machine.
  if (!isDev) {
    headers.push({
      key: 'Strict-Transport-Security',
      value: 'max-age=63072000; includeSubDomains; preload',
    })
  }

  return headers
}
