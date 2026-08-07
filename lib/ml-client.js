/**
 * ml-client.js — the transport policy for the optional ML microservice.
 *
 * ## The bug this exists to prevent
 *
 * `lib/api-helpers.js` reached the ML service with a bare `fetch()`:
 *
 *     const response = await fetch(`${mlServiceUrl}/predict-cycle`, {
 *       method: 'POST',
 *       headers: { 'Content-Type': 'application/json' },
 *       body: JSON.stringify({ ... })
 *     })
 *     if (response.ok) {
 *       const data = await response.json()
 *       if (data && data.prediction) return data.prediction   // <- verbatim
 *     }
 *
 * Three separate failures live in those six lines:
 *
 * 1. **No timeout.** No `AbortController`, no `signal`. A container that accepts
 *    the connection and then never writes a byte — an OOM, a deadlock, a paused
 *    task — leaves that `await` pending forever. `/api/predict-cycle` and
 *    `/api/pcod-risk` then hang until the platform kills the function, even
 *    though a correct rule-based answer was available on the next line.
 *
 * 2. **No retry, and no breaker.** One transient 502 discarded the ML result
 *    entirely; conversely a *permanently* dead service was re-dialled on every
 *    single request, so every prediction paid the full connect-and-fail cost.
 *    Both extremes are wrong: transient faults deserve a retry, sustained ones
 *    deserve to be skipped.
 *
 * 3. **No validation.** `if (data && data.prediction)` accepts a string, an
 *    empty object, `{ confidence: null }` — anything truthy. That value was
 *    returned straight out of the route and rendered, producing `undefined%`
 *    confidence and `Invalid Date` where a correct fallback was one line away.
 *
 * ## The policy
 *
 * | condition                                  | classification | effect                    |
 * |--------------------------------------------|----------------|---------------------------|
 * | 2xx with a schema-valid body               | `success`      | use the ML result         |
 * | 2xx with a body the schema rejects         | `invalid`      | fall back, do NOT retry   |
 * | 400, 401, 403, 404, 409, 422               | `permanent`    | fall back, do NOT retry   |
 * | 408, 425, 429, 5xx, network error, timeout | `transient`    | retry with backoff        |
 *
 * A `permanent` or `invalid` answer means the request will not succeed as
 * written, so retrying only adds latency to a fallback that is already correct.
 * Only `transient` faults are retried, and only a bounded number of times.
 *
 * Consecutive transient failures trip a circuit breaker. While it is open every
 * call short-circuits to the fallback engine immediately, which turns a dead ML
 * service from "every request is slow" into "every request is fast and
 * rule-based". After a cooldown the breaker half-opens and lets exactly one
 * probe through; that probe's outcome closes it or re-opens it.
 *
 * ## Design note
 *
 * The ML service is an **optimisation, never a correctness dependency**. Every
 * failure path in this module ends in `{ ok: false }`, and every caller is
 * expected to answer from the deterministic rule-based engine when it sees one.
 * Nothing here throws.
 *
 * The policy pieces (`classifyMlResponse`, `computeMlBackoffMs`,
 * `createCircuitBreaker`, `resolveMlConfig`) are pure and separately exported so
 * they can be tested exhaustively without a network — see
 * `scripts/test-ml-client.js`.
 */

/** Wall-clock budget for a single ML attempt, before retries. */
export const DEFAULT_ML_TIMEOUT_MS = 4000

/**
 * Retries *after* the first attempt. One retry (two attempts total) is the
 * right default: it covers the single dropped connection that dominates real
 * transient failures, without doubling the latency budget of a service that is
 * genuinely down — the breaker handles that case instead.
 */
export const DEFAULT_ML_RETRIES = 1

/** First retry delay. Deliberately short: a user is waiting on this request. */
export const DEFAULT_ML_BACKOFF_MS = 150

/** Ceiling for the retry backoff. */
export const MAX_ML_BACKOFF_MS = 2000

/** Consecutive failed calls that trip the breaker open. */
export const DEFAULT_BREAKER_THRESHOLD = 3

/** How long the breaker stays open before allowing a probe. */
export const DEFAULT_BREAKER_COOLDOWN_MS = 30 * 1000

/** Breaker states. */
export const BREAKER_CLOSED = 'closed'
export const BREAKER_OPEN = 'open'
export const BREAKER_HALF_OPEN = 'half-open'

/**
 * Statuses that mean "this request will never succeed as written".
 *
 * 401/403 are here rather than in the transient set on purpose: a misconfigured
 * ML credential is a deploy-time problem, and retrying it just multiplies the
 * latency of a fallback that was always going to be used.
 */
const PERMANENT_STATUSES = new Set([400, 401, 403, 404, 405, 409, 415, 422])

/** Statuses that are explicitly worth another attempt. */
const TRANSIENT_STATUSES = new Set([408, 425, 429])

/**
 * Reasons a call did not produce a usable ML result. Surfaced on the result
 * object so callers can log *why* they fell back rather than just that they did.
 */
export const ML_FAILURE_REASONS = {
  /** No `ML_SERVICE_URL` configured — the service is simply not in use. */
  DISABLED: 'disabled',
  /** The breaker is open; no request was attempted. */
  CIRCUIT_OPEN: 'circuit_open',
  /** The attempt budget was exhausted by transient faults. */
  TRANSIENT: 'transient',
  /** The service answered with a status that will not change on retry. */
  PERMANENT: 'permanent',
  /** The service answered 2xx with a body the schema rejected. */
  INVALID_RESPONSE: 'invalid_response',
  /** The attempt exceeded the timeout budget. */
  TIMEOUT: 'timeout',
}

/**
 * Reads the ML configuration out of an environment bag.
 *
 * Every numeric knob is clamped rather than trusted, because a typo'd env var
 * (`ML_SERVICE_TIMEOUT_MS=0`, or a value with a stray unit suffix) should
 * degrade to the default rather than disable the timeout or spin the retry loop.
 *
 * @param {Record<string, string|undefined>} [env]
 * @returns {{
 *   baseUrl: string|null,
 *   timeoutMs: number,
 *   retries: number,
 *   breakerThreshold: number,
 *   breakerCooldownMs: number
 * }}
 */
export function resolveMlConfig(env = process.env) {
  const rawUrl = env.ML_SERVICE_URL || env.NEXT_PUBLIC_ML_SERVICE_URL || ''
  const trimmed = String(rawUrl).trim()

  return {
    // A trailing slash plus the leading slash on a path yields `//predict-cycle`,
    // which some routers 404 on. Normalise once, here.
    baseUrl: trimmed ? trimmed.replace(/\/+$/, '') : null,
    timeoutMs: clampInt(env.ML_SERVICE_TIMEOUT_MS, DEFAULT_ML_TIMEOUT_MS, 250, 30000),
    retries: clampInt(env.ML_SERVICE_RETRIES, DEFAULT_ML_RETRIES, 0, 5),
    breakerThreshold: clampInt(env.ML_SERVICE_BREAKER_THRESHOLD, DEFAULT_BREAKER_THRESHOLD, 1, 50),
    breakerCooldownMs: clampInt(
      env.ML_SERVICE_BREAKER_COOLDOWN_MS, DEFAULT_BREAKER_COOLDOWN_MS, 1000, 10 * 60 * 1000
    ),
  }
}

/**
 * Parses an integer from an env value, falling back to `fallback` for anything
 * that is not a finite in-range number.
 *
 * @param {unknown} raw
 * @param {number} fallback
 * @param {number} min
 * @param {number} max
 * @returns {number}
 */
function clampInt(raw, fallback, min, max) {
  if (raw === undefined || raw === null || raw === '') return fallback
  const parsed = Number(raw)
  if (!Number.isFinite(parsed)) return fallback
  return Math.min(max, Math.max(min, Math.round(parsed)))
}

/**
 * Classifies one ML attempt.
 *
 * @param {{ status?: number, ok?: boolean }|null} response the fetch Response,
 *   or `null` when the request threw (network failure, DNS, abort)
 * @returns {'success'|'permanent'|'transient'}
 */
export function classifyMlResponse(response) {
  // A thrown request — offline, DNS failure, connection reset, or our own
  // abort — is always worth one more try.
  if (!response) return 'transient'

  const status = Number(response.status)
  if (!Number.isFinite(status)) return 'transient'

  if (status >= 200 && status < 300) return 'success'
  if (PERMANENT_STATUSES.has(status)) return 'permanent'
  if (TRANSIENT_STATUSES.has(status)) return 'transient'
  if (status >= 500) return 'transient'

  // Any other 4xx is a request the payload cannot recover from.
  if (status >= 400) return 'permanent'

  // 1xx/3xx reaching here means a redirect the fetch layer did not follow.
  return 'transient'
}

/**
 * Exponential backoff with full jitter, floored at half the ceiling.
 *
 * Jitter matters even on a two-attempt budget: a fleet of serverless instances
 * that all failed against the same ML restart would otherwise retry in lockstep
 * and knock it over a second time.
 *
 * @param {number} attempt how many attempts have already failed (>= 1)
 * @param {() => number} [random] injectable for deterministic tests
 * @param {number} [baseMs]
 * @returns {number} milliseconds to wait before the next attempt
 */
export function computeMlBackoffMs(attempt, random = Math.random, baseMs = DEFAULT_ML_BACKOFF_MS) {
  const safeAttempt = Number.isFinite(attempt) && attempt > 0 ? Math.floor(attempt) : 1
  // Cap the exponent before the shift so a corrupted counter cannot overflow.
  const exponent = Math.min(safeAttempt - 1, 16)
  const ceiling = Math.min(baseMs * 2 ** exponent, MAX_ML_BACKOFF_MS)
  const floor = ceiling / 2
  return Math.round(floor + random() * floor)
}

/**
 * A three-state circuit breaker.
 *
 * Closed  — requests flow; `threshold` consecutive failures opens it.
 * Open    — requests short-circuit; after `cooldownMs` it becomes half-open.
 * Half-open — exactly one probe is allowed through. Success closes the breaker
 *             and resets the counter; failure re-opens it and restarts the
 *             cooldown.
 *
 * The half-open state is what stops a recovering service from being hit by the
 * full request volume the instant the cooldown expires.
 *
 * State is per-process, which is the correct scope here: each serverless
 * instance learns about the ML service's health from its own traffic, and there
 * is no shared store to keep consistent.
 *
 * @param {{ threshold?: number, cooldownMs?: number }} [options]
 */
export function createCircuitBreaker(options = {}) {
  const threshold = Number.isFinite(options.threshold) && options.threshold > 0
    ? Math.floor(options.threshold)
    : DEFAULT_BREAKER_THRESHOLD
  const cooldownMs = Number.isFinite(options.cooldownMs) && options.cooldownMs > 0
    ? Math.floor(options.cooldownMs)
    : DEFAULT_BREAKER_COOLDOWN_MS

  let consecutiveFailures = 0
  let openedAt = 0
  let probeInFlight = false

  /**
   * The breaker's state as of `now`. Reading is what promotes open ->
   * half-open, so there is no timer to leak in a serverless process.
   *
   * @param {number} now epoch millis
   * @returns {'closed'|'open'|'half-open'}
   */
  function state(now) {
    if (consecutiveFailures < threshold) return BREAKER_CLOSED
    if (now - openedAt >= cooldownMs) return BREAKER_HALF_OPEN
    return BREAKER_OPEN
  }

  return {
    state,

    /**
     * Whether a request may be attempted right now.
     *
     * In half-open only the first caller gets through; concurrent callers are
     * refused so a recovering service sees one probe, not a thundering herd.
     *
     * @param {number} now epoch millis
     * @returns {boolean}
     */
    allowRequest(now) {
      const current = state(now)
      if (current === BREAKER_CLOSED) return true
      if (current === BREAKER_OPEN) return false

      if (probeInFlight) return false
      probeInFlight = true
      return true
    },

    /** Records a successful call: closes the breaker and clears the counter. */
    onSuccess() {
      consecutiveFailures = 0
      openedAt = 0
      probeInFlight = false
    },

    /**
     * Records a failed call. Opens the breaker on the `threshold`-th
     * consecutive failure, and restarts the cooldown when a half-open probe
     * fails.
     *
     * @param {number} now epoch millis
     */
    onFailure(now) {
      const wasHalfOpen = state(now) === BREAKER_HALF_OPEN
      probeInFlight = false
      consecutiveFailures += 1

      if (wasHalfOpen || consecutiveFailures === threshold) {
        openedAt = now
      }
    },

    /** Test/ops hook: forget everything the breaker has learned. */
    reset() {
      consecutiveFailures = 0
      openedAt = 0
      probeInFlight = false
    },

    /** Introspection, for logging and tests. */
    snapshot(now) {
      return { state: state(now), consecutiveFailures, openedAt, threshold, cooldownMs, probeInFlight }
    },
  }
}

/** The process-wide breaker guarding the ML service. */
export const mlBreaker = createCircuitBreaker()

/**
 * Performs one ML request with an enforced timeout.
 *
 * Returns `null` instead of throwing on any transport failure, so the caller's
 * classification table has a single "no response" case to reason about rather
 * than a mix of thrown errors and status codes.
 *
 * @param {string} url
 * @param {unknown} payload
 * @param {{ timeoutMs: number, fetchImpl: typeof fetch }} deps
 * @returns {Promise<{ response: Response|null, timedOut: boolean }>}
 */
async function attemptOnce(url, payload, { timeoutMs, fetchImpl }) {
  const controller = new AbortController()
  let timedOut = false

  const timer = setTimeout(() => {
    timedOut = true
    controller.abort()
  }, timeoutMs)

  try {
    const response = await fetchImpl(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal: controller.signal,
    })
    return { response, timedOut: false }
  } catch {
    // AbortError (ours or the caller's), DNS failure, ECONNREFUSED, a TLS
    // error — all of them mean "no usable response", which is the only
    // distinction the policy needs.
    return { response: null, timedOut }
  } finally {
    // Always clear: a leaked timer keeps a serverless instance alive past the
    // response, which is billed time for nothing.
    clearTimeout(timer)
  }
}

/**
 * Reads a response body as JSON without letting a malformed body throw.
 *
 * A 200 carrying HTML — an ingress error page, a login redirect that was
 * followed — is a real production shape, and it must be classified as an
 * invalid response rather than crashing the route.
 *
 * @param {Response} response
 * @returns {Promise<unknown|null>}
 */
async function readJson(response) {
  try {
    return await response.json()
  } catch {
    return null
  }
}

/**
 * Calls an ML endpoint and returns a validated result, or an explained failure.
 *
 * Never throws and never returns an unvalidated payload.
 *
 * @param {string} path endpoint path, e.g. `/predict-cycle`
 * @param {unknown} payload request body
 * @param {object} [options]
 * @param {(raw: unknown) => {ok: true, value: any}|{ok: false, reason: string}} options.parse
 *   schema check applied to the parsed body; anything it rejects is treated as
 *   `invalid` and falls back
 * @param {Record<string, string|undefined>} [options.env]
 * @param {typeof fetch} [options.fetchImpl]
 * @param {() => number} [options.now]
 * @param {() => number} [options.random]
 * @param {(ms: number) => Promise<void>} [options.sleep]
 * @param {ReturnType<typeof createCircuitBreaker>} [options.breaker]
 * @param {{ warn: Function, debug?: Function }} [options.log]
 * @returns {Promise<{ ok: true, value: any, attempts: number }
 *                 | { ok: false, reason: string, attempts: number, status?: number }>}
 */
export async function callMlService(path, payload, options = {}) {
  const {
    parse,
    env = process.env,
    fetchImpl = globalThis.fetch,
    now = Date.now,
    random = Math.random,
    sleep = defaultSleep,
    breaker = mlBreaker,
    log = console,
  } = options

  const config = resolveMlConfig(env)

  if (!config.baseUrl) {
    return { ok: false, reason: ML_FAILURE_REASONS.DISABLED, attempts: 0 }
  }

  if (typeof fetchImpl !== 'function') {
    // Node < 18 without a polyfill. Treat as "service not usable" rather than
    // throwing a ReferenceError out of a route handler.
    return { ok: false, reason: ML_FAILURE_REASONS.DISABLED, attempts: 0 }
  }

  if (!breaker.allowRequest(now())) {
    return { ok: false, reason: ML_FAILURE_REASONS.CIRCUIT_OPEN, attempts: 0 }
  }

  const url = `${config.baseUrl}${path}`
  const maxAttempts = config.retries + 1
  let attempts = 0
  let lastStatus

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    attempts = attempt

    const { response, timedOut } = await attemptOnce(url, payload, {
      timeoutMs: config.timeoutMs,
      fetchImpl,
    })

    const classification = classifyMlResponse(response)
    lastStatus = response ? Number(response.status) : undefined

    if (classification === 'permanent') {
      breaker.onFailure(now())
      log.warn?.(
        `[ml-client] ${path} rejected with ${lastStatus}; using the rule-based engine.`
      )
      return { ok: false, reason: ML_FAILURE_REASONS.PERMANENT, attempts, status: lastStatus }
    }

    if (classification === 'success') {
      const body = await readJson(response)
      const parsed = typeof parse === 'function' ? parse(body) : { ok: true, value: body }

      if (parsed.ok) {
        breaker.onSuccess()
        return { ok: true, value: parsed.value, attempts }
      }

      // A 2xx the schema rejects is the service's answer, not a fault of the
      // connection — retrying returns the same body. Count it against the
      // breaker (a service emitting garbage is unhealthy) but stop here.
      breaker.onFailure(now())
      log.warn?.(
        `[ml-client] ${path} returned an unusable payload (${parsed.reason}); ` +
        'using the rule-based engine.'
      )
      return {
        ok: false,
        reason: ML_FAILURE_REASONS.INVALID_RESPONSE,
        attempts,
        status: lastStatus,
      }
    }

    // Transient. Retry if there is budget left.
    if (attempt < maxAttempts) {
      await sleep(computeMlBackoffMs(attempt, random))
      continue
    }

    breaker.onFailure(now())
    const reason = timedOut ? ML_FAILURE_REASONS.TIMEOUT : ML_FAILURE_REASONS.TRANSIENT
    log.warn?.(
      `[ml-client] ${path} failed after ${attempts} attempt(s) (${reason}); ` +
      'using the rule-based engine.'
    )
    return { ok: false, reason, attempts, status: lastStatus }
  }

  /* c8 ignore next 2 — the loop always returns; this satisfies the linter. */
  return { ok: false, reason: ML_FAILURE_REASONS.TRANSIENT, attempts }
}

/**
 * Default backoff sleep.
 *
 * @param {number} ms
 * @returns {Promise<void>}
 */
function defaultSleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

/**
 * True when the ML service is configured at all.
 *
 * @param {Record<string, string|undefined>} [env]
 * @returns {boolean}
 */
export function isMlServiceConfigured(env = process.env) {
  return resolveMlConfig(env).baseUrl !== null
}
