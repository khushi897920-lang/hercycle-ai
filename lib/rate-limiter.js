/**
 * rate-limiter.js — the in-process fixed-window counter and the request
 * identity helpers shared by lib/rateLimiter.js.
 *
 * ## Why this module exists
 *
 * `lib/rateLimiter.js` enforces limits in Postgres via the `enforce_rate_limit`
 * RPC, which is the only correct place for them once the app runs on more than
 * one instance. But a limiter that depends on the database has to answer one
 * question the database cannot: *what happens when the database is down?*
 *
 * The answer must not be "allow everything", because a database under load is
 * exactly the moment rate limiting matters most, and the AI endpoints spend
 * money per call. So this module provides a degraded-mode counter that lives in
 * the process. It is deliberately conservative:
 *
 *   - per-container state, so a serverless fleet of N containers enforces at
 *     most N x the configured limit rather than no limit at all
 *   - lost on recycle, which is acceptable for a fallback that only runs during
 *     an outage
 *
 * ⚠️ It is NOT a replacement for the database limiter in normal operation.
 *
 * Nothing here imports from `next/*` or from Clerk, so the module is usable
 * from Route Handlers, Middleware and plain Node scripts alike.
 */

import { createHash } from 'node:crypto'

/** Default window length, matching the `interval` the exported limiters use. */
export const DEFAULT_INTERVAL_MS = 60 * 1000

/** Windows older than this are dropped by the sweeper. */
const STALE_AFTER_MS = 5 * 60 * 1000

/** How often the sweeper runs. */
const CLEANUP_INTERVAL_MS = 5 * 60 * 1000

/** cacheKey -> { windowStart: number, requests: number } */
const rateLimits = new Map()

// Periodic cleanup of expired windows so a long-lived container does not
// accumulate one Map entry per identifier seen since boot.
//
// `unref()` matters: without it this timer keeps the Node event loop alive, so
// any script that imports this module hangs instead of exiting.
if (typeof globalThis !== 'undefined' && !globalThis.__hercycleRateLimitSweeper) {
  const sweeper = setInterval(() => {
    const now = Date.now()
    for (const [key, window] of rateLimits.entries()) {
      if (now - window.windowStart > STALE_AFTER_MS) {
        rateLimits.delete(key)
      }
    }
  }, CLEANUP_INTERVAL_MS)

  if (typeof sweeper.unref === 'function') sweeper.unref()
  globalThis.__hercycleRateLimitSweeper = sweeper
}

/**
 * Records one request against `key` and reports whether it is within `limit`.
 *
 * Fixed window: the first request starts a window of `intervalMs`, and the
 * counter resets on the first request after the window closes.
 *
 * @param {string} key identifier for the caller, already namespaced by route
 * @param {{ limit: number, intervalMs?: number, now?: number }} options
 * @returns {{ allowed: boolean, count: number, remaining: number, resetAt: number }}
 */
export function consume(key, { limit, intervalMs = DEFAULT_INTERVAL_MS, now = Date.now() } = {}) {
  // A missing, zero or negative limit is a misconfiguration. Rejecting is the
  // safe reading of it: this is a security control, and a control that treats
  // "I don't know the limit" as "no limit" is the bug this module was written
  // to remove.
  const safeLimit = Number.isFinite(limit) && limit > 0 ? Math.floor(limit) : 0
  const safeInterval = Number.isFinite(intervalMs) && intervalMs > 0 ? intervalMs : DEFAULT_INTERVAL_MS

  let window = rateLimits.get(key)

  if (!window || now - window.windowStart >= safeInterval) {
    window = { windowStart: now, requests: 0 }
  }

  window.requests += 1
  rateLimits.set(key, window)

  return {
    allowed: window.requests <= safeLimit,
    count: window.requests,
    remaining: Math.max(0, safeLimit - window.requests),
    resetAt: window.windowStart + safeInterval,
  }
}

/**
 * Backwards-compatible wrapper over {@link consume}.
 *
 * @param {string} key
 * @param {string} route
 * @param {number} limit
 * @returns {boolean} true when the request is within the limit
 */
export function isAllowed(key, route, limit) {
  return consume(`${key}:${route}`, { limit }).allowed
}

/**
 * Drops all in-memory windows. Exported for tests; not used at runtime.
 */
export function resetInMemoryRateLimits() {
  rateLimits.clear()
}

/**
 * Robust client IP extraction across proxy stacks.
 *
 * Order of preference matches how reverse proxies forward the real client:
 *  1. `x-forwarded-for` — standard chain; the left-most entry is the client.
 *  2. `x-real-ip`      — nginx/Vercel commonly set this directly.
 *  3. `cf-connecting-ip` — Cloudflare's direct client header.
 *
 * Returns `null` when no usable address is present so callers can decide how
 * to handle the unidentifiable case (see buildAnonymousIdentifier).
 *
 * @param {Request} request
 * @returns {string|null}
 */
export function extractClientIp(request) {
  if (!request?.headers) return null

  const forwarded = request.headers.get('x-forwarded-for')
  if (forwarded) {
    const first = forwarded.split(',')[0].trim()
    if (first && first !== 'unknown') return first
  }

  const realIp = request.headers.get('x-real-ip')
  if (realIp && realIp.trim() && realIp.trim() !== 'unknown') return realIp.trim()

  const cfIp = request.headers.get('cf-connecting-ip')
  if (cfIp && cfIp.trim()) return cfIp.trim()

  return null
}

/**
 * Headers used to build a coarse identity for a caller we cannot attribute to a
 * user or an IP. They are chosen because they are stable for a given client
 * across requests — which is the only property that matters here.
 */
const FINGERPRINT_HEADERS = [
  'user-agent',
  'accept-language',
  'sec-ch-ua',
  'sec-ch-ua-platform',
]

/**
 * The bucket every caller falls into when nothing at all can be derived from
 * the request. Shared on purpose: one strict bucket is the safe failure mode,
 * because the alternative — a bucket per request — is no limit at all.
 */
export const UNATTRIBUTED_IDENTIFIER = 'anon:unattributed'

/**
 * Builds a **stable** identifier for a request with no resolvable user and no
 * resolvable IP.
 *
 * This replaces `anon:${Math.random()...}`, which produced a fresh identifier on
 * every call — so the limiter looked up a bucket it had never seen, found a
 * count of 1, and allowed the request. No value of `limit` could ever be
 * exceeded on that path, which made the limiter a no-op for every caller that
 * did not present a forwarding header (self-hosted and Docker deployments,
 * local and preview environments, and any client that simply omits them).
 *
 * The fingerprint is coarse and easy to vary deliberately. That is fine: it is
 * a fallback for a request that already told us nothing, and varying it is no
 * cheaper than rotating an IP. What matters is that a client that does *not*
 * try to evade is counted consistently instead of being waved through.
 *
 * @param {Request} request
 * @returns {string}
 */
export function buildAnonymousIdentifier(request) {
  if (!request?.headers) return UNATTRIBUTED_IDENTIFIER

  const parts = []
  for (const header of FINGERPRINT_HEADERS) {
    const value = request.headers.get(header)
    if (value && value.trim()) parts.push(`${header}=${value.trim()}`)
  }

  if (parts.length === 0) return UNATTRIBUTED_IDENTIFIER

  const digest = createHash('sha256').update(parts.join('|')).digest('hex')
  return `anon:${digest.slice(0, 24)}`
}
