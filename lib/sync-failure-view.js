/**
 * sync-failure-view.js — turning dead-lettered sync operations into something a
 * person can read and act on.
 *
 * ## Why this exists
 *
 * `lib/sync-queue.js` classifies a failed offline mutation and dead-letters it
 * when it will never succeed, or when it has exhausted `MAX_ATTEMPTS`.
 * `lib/OfflineContext.jsx` honours that, moves the operation into the
 * `sync_dead_letter` store, and exposes the recovery API:
 *
 *     failedSyncItems: [],
 *     retryFailedSync: async () => { },
 *     discardFailedSync: async () => { },
 *
 * **Nothing consumed any of it.** `grep -rn "retryFailedSync|discardFailedSync|
 * failedSyncItems" components app` returned only the definitions — no panel, no
 * badge, no settings entry. One transient toast fired during the drain saying
 * "N offline changes could not be saved and need your attention", and then
 * offered nowhere to attend to them.
 *
 * For a user that means: you log three days of symptoms on the train with no
 * signal, two sync, the third is rejected, a toast flashes while your phone is
 * in your pocket, the pending badge returns to zero, and the log now exists
 * only in a browser store you cannot see — lost the moment you clear site data
 * or switch devices. The `lib/sync-queue.js` docstring promises the opposite:
 *
 *   > | 400, 403, 404, 409, 422 | `permanent` | dead-letter, **surface to the user** |
 *
 * The surfacing half was never built. This module is that half's logic.
 *
 * ## What lives here
 *
 * The decisions: what a raw record *means* in plain language, how records
 * collapse into one problem per affected thing, and how urgent the whole set
 * is. All pure — no React, no IndexedDB, no ambient clock — so the wording and
 * grouping rules are testable. See `scripts/test-sync-failure-view.js`.
 */

/**
 * Why an operation was given up on. Mirrors the `reason` written by
 * `OfflineContext.deadLetter`, which comes from `planNextAttempt`.
 */
export const FAILURE_KINDS = {
  /** The server rejected the payload; retrying it unchanged cannot work. */
  REJECTED: 'rejected',
  /** Repeated transient failures exhausted the attempt budget. */
  GAVE_UP: 'gave_up',
  /** The record predates this classification, or carries something unexpected. */
  UNKNOWN: 'unknown',
}

/** How much attention the set as a whole needs. */
export const SEVERITY = {
  NONE: 'none',
  /** Worth retrying — the server may simply have been down. */
  RETRYABLE: 'retryable',
  /** Needs a decision from the user; retrying will not help on its own. */
  ACTION_REQUIRED: 'action_required',
}

/** Kinds that a plain "Retry" is likely to resolve. */
const RETRYABLE_KINDS = new Set([FAILURE_KINDS.GAVE_UP, FAILURE_KINDS.UNKNOWN])

/**
 * Maps a raw dead-letter `reason` onto a {@link FAILURE_KINDS} value.
 *
 * Unrecognised reasons become `UNKNOWN` rather than being dropped: an item the
 * UI cannot categorise is still an item the user has lost, and hiding it would
 * reproduce the exact bug this module exists to fix.
 *
 * @param {unknown} reason
 * @returns {string}
 */
export function classifyFailure(reason) {
  if (reason === 'permanent') return FAILURE_KINDS.REJECTED
  if (reason === 'max-attempts') return FAILURE_KINDS.GAVE_UP
  return FAILURE_KINDS.UNKNOWN
}

/**
 * A stable, human-meaningful identity for what an operation was trying to
 * change.
 *
 * This is what makes de-duplication possible. A user who edits the same day
 * three times while offline queues three operations against the same log; when
 * the server rejects that day's payload, all three dead-letter. Showing three
 * identical rows implies three separate losses, when there is one affected day
 * and one decision to make.
 *
 * @param {{url?: string, method?: string, body?: object}} item
 * @returns {string}
 */
export function targetKey(item) {
  if (!item) return 'unknown'

  const url = typeof item.url === 'string' ? item.url : 'unknown'
  const method = typeof item.method === 'string' ? item.method.toUpperCase() : 'REQUEST'

  // A daily log is identified by its date, not by the request — that is the
  // thing the user recognises and the thing they would lose.
  if (url === '/api/log-day' && item.body?.date) return `log-day:${item.body.date}`
  if (url === '/api/cycles' && method === 'POST') return `cycle-start:${item.body?.start_date ?? 'unknown'}`
  if (url === '/api/cycles' && method === 'PATCH') return `cycle-end:${item.body?.id ?? 'unknown'}`
  if (url === '/api/weight' && item.body?.date) return `weight:${item.body.date}`

  return `${method} ${url}`
}

/**
 * A short description of what the change *was*, in the user's terms.
 *
 * Deliberately never mentions HTTP. "A daily log for 12 August" is something a
 * person can decide about; "POST /api/log-day failed with 422" is not.
 *
 * @param {{url?: string, method?: string, body?: object}} item
 * @param {(isoDate: string) => string} [formatDate] locale-aware date formatter
 * @returns {string}
 */
export function describeTarget(item, formatDate = (value) => value) {
  if (!item) return 'An unknown change'

  const url = typeof item.url === 'string' ? item.url : ''
  const method = typeof item.method === 'string' ? item.method.toUpperCase() : 'REQUEST'

  if (url === '/api/log-day') {
    const date = item.body?.date
    return date ? `Your daily log for ${formatDate(date)}` : 'A daily log'
  }
  if (url === '/api/cycles' && method === 'POST') {
    const date = item.body?.start_date
    return date ? `A period you started on ${formatDate(date)}` : 'A period you started'
  }
  if (url === '/api/cycles' && method === 'PATCH') {
    return 'A period you marked as ended'
  }
  if (url === '/api/weight') {
    const date = item.body?.date
    return date ? `A weight entry for ${formatDate(date)}` : 'A weight entry'
  }

  return url ? `A change to ${url}` : 'An unknown change'
}

/**
 * Formats an elapsed duration as a coarse relative time.
 *
 * The clock is passed in rather than read, so the output is deterministic and
 * the boundaries are testable. Coarse on purpose — "3 days ago" is what matters
 * about a lost health log; "3 days, 4 hours and 11 minutes ago" is noise.
 *
 * @param {number} timestamp epoch millis
 * @param {number} now epoch millis
 * @returns {string}
 */
export function formatRelativeTime(timestamp, now) {
  // `Number(null)` and `Number('')` are both 0, not NaN — so a missing
  // timestamp would otherwise be read as the Unix epoch and rendered as
  // "655 months ago". Reject the empty cases before coercing.
  if (timestamp === null || timestamp === undefined || timestamp === '') return 'recently'

  const then = Number(timestamp)
  const reference = Number(now)
  if (!Number.isFinite(then) || !Number.isFinite(reference)) return 'recently'

  const elapsed = reference - then
  // A record stamped in the future is a clock skew, not a prediction. Reading
  // it as "just now" is the honest degradation.
  if (elapsed < 0) return 'just now'

  const minutes = Math.floor(elapsed / 60000)
  if (minutes < 1) return 'just now'
  if (minutes < 60) return `${minutes} minute${minutes === 1 ? '' : 's'} ago`

  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours} hour${hours === 1 ? '' : 's'} ago`

  const days = Math.floor(hours / 24)
  if (days < 30) return `${days} day${days === 1 ? '' : 's'} ago`

  const months = Math.floor(days / 30)
  return `${months} month${months === 1 ? '' : 's'} ago`
}

/**
 * Groups dead-letter records into one entry per affected thing.
 *
 * Ordering is newest-failure-first, so the change the user most likely
 * remembers making is at the top. Ties fall back to the target key, so the list
 * does not reshuffle between renders.
 *
 * @param {Array<object>} items raw records from the `sync_dead_letter` store
 * @param {object} [options]
 * @param {number} [options.now] epoch millis, for the relative timestamps
 * @param {(isoDate: string) => string} [options.formatDate]
 * @returns {Array<{
 *   key: string,
 *   ids: any[],
 *   description: string,
 *   kind: string,
 *   isRetryable: boolean,
 *   occurrences: number,
 *   failedAt: number|null,
 *   failedAtLabel: string,
 *   lastError: string|null
 * }>}
 */
export function groupFailures(items, options = {}) {
  const { now = 0, formatDate } = options
  const groups = new Map()

  for (const item of Array.isArray(items) ? items : []) {
    if (!item) continue

    const key = targetKey(item)
    const kind = classifyFailure(item.reason)
    const failedAt = Number.isFinite(Number(item.deadLetteredAt))
      ? Number(item.deadLetteredAt)
      : (Number.isFinite(Number(item.failedAt)) ? Number(item.failedAt) : null)

    const existing = groups.get(key)
    if (!existing) {
      groups.set(key, {
        key,
        ids: item.id === undefined ? [] : [item.id],
        description: describeTarget(item, formatDate),
        kind,
        isRetryable: RETRYABLE_KINDS.has(kind),
        occurrences: 1,
        failedAt,
        lastError: typeof item.lastError === 'string' ? item.lastError : null,
      })
      continue
    }

    existing.occurrences += 1
    if (item.id !== undefined) existing.ids.push(item.id)

    // Keep the most recent failure's timestamp and error message: it is the
    // state of the world now, and the older attempts are history.
    if (failedAt !== null && (existing.failedAt === null || failedAt > existing.failedAt)) {
      existing.failedAt = failedAt
      if (typeof item.lastError === 'string') existing.lastError = item.lastError
    }

    // A group that contains even one server rejection is not fixed by a plain
    // retry, so the stricter classification wins.
    if (kind === FAILURE_KINDS.REJECTED) {
      existing.kind = FAILURE_KINDS.REJECTED
      existing.isRetryable = false
    }
  }

  return Array.from(groups.values())
    .map((group) => ({ ...group, failedAtLabel: formatRelativeTime(group.failedAt, now) }))
    .sort((a, b) => {
      const aTime = a.failedAt ?? -Infinity
      const bTime = b.failedAt ?? -Infinity
      if (aTime !== bTime) return bTime - aTime
      return a.key.localeCompare(b.key)
    })
}

/**
 * Summarises a set of failures for the badge and the panel header.
 *
 * @param {Array<object>} groups output of {@link groupFailures}
 * @returns {{
 *   total: number,
 *   retryable: number,
 *   actionRequired: number,
 *   severity: string,
 *   anyRetryable: boolean
 * }}
 */
export function summariseFailures(groups) {
  const list = Array.isArray(groups) ? groups : []
  const retryable = list.filter((group) => group.isRetryable).length
  const actionRequired = list.length - retryable

  let severity = SEVERITY.NONE
  if (list.length > 0) {
    // Any server rejection escalates the whole set: those are the ones a retry
    // cannot clear, so they are what the badge should be warning about.
    severity = actionRequired > 0 ? SEVERITY.ACTION_REQUIRED : SEVERITY.RETRYABLE
  }

  return { total: list.length, retryable, actionRequired, severity, anyRetryable: retryable > 0 }
}

/**
 * The explanation shown under a failed change.
 *
 * Returns a message key plus its parameters rather than a sentence, so the
 * copy lives in the message catalogue and stays translatable — this module
 * decides *what* to say, the UI decides how to say it in the user's language.
 *
 * @param {{kind: string, occurrences: number}} group
 * @returns {{ key: string, params: Record<string, unknown> }}
 */
export function explainFailure(group) {
  const occurrences = group?.occurrences ?? 1

  if (group?.kind === FAILURE_KINDS.REJECTED) {
    return { key: 'reason_rejected', params: { occurrences } }
  }
  if (group?.kind === FAILURE_KINDS.GAVE_UP) {
    return { key: 'reason_gave_up', params: { occurrences } }
  }
  return { key: 'reason_unknown', params: { occurrences } }
}
