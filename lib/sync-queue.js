/**
 * sync-queue.js — the retry policy for the offline mutation queue.
 *
 * ## The bug this exists to prevent
 *
 * `syncData()` drained the queue strictly in `id` order and **stopped at the
 * first failure**:
 *
 *     for (const item of sortedQueue) {
 *       const res = await fetchWithTimeout(item.url, { ... })
 *       if (res.ok || res.status === 400 || ...) {
 *         await deleteFromStore('sync_queue', item.id)
 *       } else {
 *         break            // <- 500 / 429 / 502 abandons the ENTIRE queue
 *       }
 *     }
 *
 * …re-driven unconditionally every 30 seconds. One permanently-failing
 * operation therefore blocked every operation queued behind it **forever**:
 * the poison pill was retried twice a minute for the lifetime of the installed
 * PWA, the healthy items behind it were never attempted, and the pending badge
 * was pinned at a non-zero number with no recovery path short of clearing site
 * data.
 *
 * Worse, `401` was treated as *permanent* and the item was **deleted** — so a
 * user whose Clerk session merely expired while offline had their queued health
 * logs silently destroyed on the next tick.
 *
 * ## The policy
 *
 * | HTTP                         | classification | effect                          |
 * |------------------------------|----------------|---------------------------------|
 * | 2xx                          | `success`      | remove from the queue           |
 * | 400, 403, 404, 409, 422      | `permanent`    | dead-letter, surface to the user|
 * | 401                          | `auth`         | pause the drain, **keep** the item|
 * | 408, 429, 5xx, network error | `transient`    | retry with exponential backoff  |
 *
 * A transient item that exhausts `MAX_ATTEMPTS` is dead-lettered rather than
 * retried forever. Independent items are never blocked by a failing sibling.
 *
 * This module is pure — no IndexedDB, no fetch, no React — so the policy can be
 * unit-tested exhaustively without a browser.
 */

/** Attempts before a transient failure is treated as permanent. */
export const MAX_ATTEMPTS = 6

/** First retry delay. */
export const BASE_BACKOFF_MS = 30 * 1000

/** Ceiling for the exponential backoff. */
export const MAX_BACKOFF_MS = 30 * 60 * 1000

/** Object store holding operations that will not be retried again. */
export const DEAD_LETTER_STORE = 'sync_dead_letter'

/**
 * Statuses that mean "this request will never succeed as written".
 *
 * 401 is deliberately absent: an expired session is recoverable, and deleting
 * the user's queued health data because of one is data loss, not cleanup.
 */
const PERMANENT_STATUSES = new Set([400, 403, 404, 409, 422])

/** Statuses that are explicitly worth retrying. */
const TRANSIENT_STATUSES = new Set([408, 425, 429])

/**
 * Classifies a sync attempt.
 *
 * @param {{ status?: number, ok?: boolean }|null} response the fetch Response,
 *   or `null` when the request threw (network failure / timeout)
 * @returns {'success'|'permanent'|'auth'|'transient'}
 */
export function classifyResponse(response) {
  // A thrown request — offline, DNS failure, or the fetch timeout — is always
  // worth retrying.
  if (!response) return 'transient'

  const status = Number(response.status)
  if (!Number.isFinite(status)) return 'transient'

  if (status >= 200 && status < 300) return 'success'
  if (status === 401) return 'auth'
  if (PERMANENT_STATUSES.has(status)) return 'permanent'
  if (TRANSIENT_STATUSES.has(status)) return 'transient'
  if (status >= 500) return 'transient'

  // Any other 4xx is a client-side problem the payload cannot recover from.
  if (status >= 400) return 'permanent'

  return 'transient'
}

/**
 * Exponential backoff with full jitter.
 *
 * The old loop retried on a flat 30 s tick with no jitter, so a client stuck on
 * a 429 hammered the endpoint twice a minute — which kept it 429'd, a
 * self-sustaining loop the rate limiter could not break. Jitter also stops a
 * fleet of PWAs that went offline together from returning in lockstep.
 *
 * @param {number} attempts how many attempts have already failed (>= 1)
 * @param {() => number} [random] injectable for deterministic tests
 * @returns {number} milliseconds to wait before the next attempt
 */
export function computeBackoffMs(attempts, random = Math.random) {
  const safeAttempts = Number.isFinite(attempts) && attempts > 0 ? Math.floor(attempts) : 1
  // Cap the exponent before the shift so a corrupted counter cannot overflow.
  const exponent = Math.min(safeAttempts - 1, 20)
  const ceiling = Math.min(BASE_BACKOFF_MS * 2 ** exponent, MAX_BACKOFF_MS)

  // Full jitter, but never less than half the ceiling, so a long-failing item
  // does not drift back to retrying almost immediately.
  const jitterFloor = ceiling / 2
  return Math.round(jitterFloor + random() * jitterFloor)
}

/**
 * Whether a queued item is due for another attempt.
 *
 * Items with no `nextAttemptAt` (including everything queued by the previous
 * version of the code) are due immediately, so an upgrade does not strand them.
 *
 * @param {{ nextAttemptAt?: number }} item
 * @param {number} now epoch millis
 * @returns {boolean}
 */
export function isDue(item, now) {
  if (!item) return false
  const due = Number(item.nextAttemptAt)
  if (!Number.isFinite(due)) return true
  return due <= now
}

/**
 * Computes what should happen to an item after an attempt.
 *
 * Returns an action rather than performing it, so the storage layer stays
 * separable from the policy and this can be tested without IndexedDB.
 *
 * @param {object} options
 * @param {{ id?: any, attempts?: number }} options.item
 * @param {'success'|'permanent'|'auth'|'transient'} options.classification
 * @param {number} options.now epoch millis
 * @param {string} [options.errorMessage]
 * @param {() => number} [options.random]
 * @returns {{ action: 'remove'|'dead-letter'|'retry'|'pause', item?: object, reason?: string, retryInMs?: number }}
 */
export function planNextAttempt({ item, classification, now, errorMessage, random }) {
  const attempts = Number.isFinite(item?.attempts) ? item.attempts : 0

  if (classification === 'success') {
    return { action: 'remove' }
  }

  if (classification === 'permanent') {
    return {
      action: 'dead-letter',
      reason: 'permanent',
      item: { ...item, attempts: attempts + 1, lastError: errorMessage || 'Rejected by the server', failedAt: now },
    }
  }

  if (classification === 'auth') {
    // Stop the drain so the rest of the queue is not burned against an expired
    // session — but keep every item, including this one.
    return { action: 'pause', reason: 'auth' }
  }

  const nextAttempts = attempts + 1
  if (nextAttempts >= MAX_ATTEMPTS) {
    return {
      action: 'dead-letter',
      reason: 'max-attempts',
      item: {
        ...item,
        attempts: nextAttempts,
        lastError: errorMessage || 'Gave up after repeated failures',
        failedAt: now,
      },
    }
  }

  const retryInMs = computeBackoffMs(nextAttempts, random)
  return {
    action: 'retry',
    retryInMs,
    item: {
      ...item,
      attempts: nextAttempts,
      nextAttemptAt: now + retryInMs,
      lastError: errorMessage || 'Temporary failure, will retry',
    },
  }
}

/**
 * Orders the queue for draining: due items first (oldest first), then the rest.
 *
 * Sorting by `id` alone is what let a single blocked item at the head starve
 * everything behind it.
 *
 * @param {object[]} queue
 * @param {number} now
 * @returns {object[]} a new array; the input is not mutated
 */
export function orderForDrain(queue, now) {
  return [...(queue || [])]
    .filter(Boolean)
    .sort((a, b) => {
      const aDue = isDue(a, now)
      const bDue = isDue(b, now)
      if (aDue !== bDue) return aDue ? -1 : 1

      const aId = Number(a.id)
      const bId = Number(b.id)
      if (Number.isFinite(aId) && Number.isFinite(bId)) return aId - bId
      return 0
    })
}

/**
 * A short, human-readable description of a dead-lettered operation, for the UI.
 *
 * @param {{ url?: string, method?: string, body?: object }} item
 * @returns {string}
 */
export function describeQueueItem(item) {
  if (!item) return 'Unknown change'
  if (item.url === '/api/log-day') return `Daily log for ${item.body?.date || 'an unknown date'}`
  if (item.url === '/api/cycles' && item.method === 'POST') return 'A period you started'
  if (item.url === '/api/cycles' && item.method === 'PATCH') return 'A period you ended'
  return `${item.method || 'REQUEST'} ${item.url || 'unknown endpoint'}`
}
