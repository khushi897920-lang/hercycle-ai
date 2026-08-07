/**
 * date-schemas.js — reusable zod schemas for the `YYYY-MM-DD` calendar dates
 * that the write endpoints accept.
 *
 * ## Why this module exists
 *
 * `/api/cycles`, `/api/log-day` and `/api/weight` each validated their dates
 * with a bare `/^\d{4}-\d{2}-\d{2}$/`. A regex checks the *shape* of a string,
 * not whether it names a real day, so `2026-13-45` and `2026-02-31` were
 * accepted and written to the database.
 *
 * Two of the three also accepted dates arbitrarily far in the future, and the
 * one schema that was *named* for rejecting them —
 *
 *     // ISO date string must be a valid calendar date and must not be in the future.
 *     const isoDateNotInFuture = z.string().min(1).regex(...).refine(d => !isNaN(Date.parse(d)))
 *
 * — never checked. A `start_date` of `2099-01-01` was accepted, and because
 * `predictNextPeriod()` sorts the history and treats the last entry as the most
 * recent period, one mistyped year permanently broke prediction, the cycle-phase
 * ring and the PCOD screening for that account.
 *
 * `lib/date-utils.js` already had `isISODateString()`, written for exactly this
 * and correctly rejecting overflow dates. It was simply never wired in.
 *
 * ## The rules
 *
 *   1. A date must name a real calendar day.
 *   2. A date must not be in the future — health data is a record of what
 *      happened, and there is no valid reason to log a period, a symptom or a
 *      weight for tomorrow.
 *   3. A date must not be absurdly far in the past, which catches a mistyped
 *      year like `0202-07-14` while leaving every real entry valid.
 *
 * Rules 2 and 3 are evaluated in the **user's local calendar** via
 * `getTodayISO()`, not in UTC — otherwise a user in UTC+5:30 logging just after
 * midnight is told their own "today" is in the future.
 */

import { z } from 'zod'

import { compareDates, getTodayISO, isISODateString } from './date-utils.js'

/** Matches the shape; {@link isISODateString} decides whether it is a real day. */
const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/

/**
 * Lower bound for any logged date. Comfortably before any plausible user's
 * date of birth, so it only ever catches a typo.
 */
export const EARLIEST_LOGGABLE_DATE = '1900-01-01'

/**
 * Builds a schema for a `YYYY-MM-DD` calendar date.
 *
 * `today` is resolved lazily, inside the refinement, rather than captured when
 * the schema is constructed — a module-level schema is built once at import and
 * would otherwise pin "today" to whenever the server process booted.
 *
 * @param {object} [options]
 * @param {string} [options.label='date'] field name, used in the error messages
 * @param {boolean} [options.allowFuture=false] skip the not-in-future rule
 * @param {string} [options.earliest=EARLIEST_LOGGABLE_DATE] inclusive lower bound
 * @param {string} [options.today] injectable clock, as `YYYY-MM-DD`; for tests
 * @returns {import('zod').ZodTypeAny}
 */
export function isoCalendarDate(options = {}) {
  const {
    label = 'date',
    allowFuture = false,
    earliest = EARLIEST_LOGGABLE_DATE,
    today = null,
  } = options

  const resolveToday = () => today || getTodayISO()

  return z
    .string({
      required_error: `${label} is required`,
      invalid_type_error: `${label} must be a string`,
    })
    .regex(ISO_DATE_RE, `${label} must be in YYYY-MM-DD format`)
    .refine((value) => isISODateString(value), {
      message: `${label} must be a real calendar date`,
    })
    .refine((value) => !isISODateString(value) || compareDates(value, earliest) >= 0, {
      message: `${label} cannot be earlier than ${earliest}`,
    })
    .refine((value) => {
      if (allowFuture) return true
      if (!isISODateString(value)) return true // already reported above
      return compareDates(value, resolveToday()) <= 0
    }, {
      message: `${label} cannot be in the future`,
    })
}

/**
 * {@link isoCalendarDate}, but the field may be `null` or omitted — the shape
 * `end_date` has on both the cycle POST and PATCH payloads.
 *
 * @param {Parameters<typeof isoCalendarDate>[0]} [options]
 * @returns {import('zod').ZodTypeAny}
 */
export function optionalIsoCalendarDate(options = {}) {
  return isoCalendarDate(options).nullable().optional()
}

/**
 * True when `end` is on or after `start`, treating a missing value on either
 * side as "nothing to compare".
 *
 * Used instead of `new Date(end) >= new Date(start)`: those parse as UTC
 * midnight, which is fine for two same-format strings but silently wrong the
 * moment either side becomes a timestamp. Routing through `compareDates` keeps
 * every date comparison in the app on one code path.
 *
 * @param {string|null|undefined} start
 * @param {string|null|undefined} end
 * @returns {boolean}
 */
export function endsOnOrAfterStart(start, end) {
  if (!start || !end) return true
  return compareDates(end, start) >= 0
}
