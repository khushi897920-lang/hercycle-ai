/**
 * request-day.js — resolves which calendar day a request belongs to.
 *
 * ## Why this module exists
 *
 * The challenges subsystem decided what "today" was with
 * `new Date().toISOString().slice(0, 10)` — the **UTC** calendar day. The
 * module header of `lib/date-utils.js` calls that expression out by name:
 *
 *   > For the app's primary audience (India, UTC+5:30) every write between
 *   > 00:00 and 05:30 IST lands on *yesterday*.
 *
 * Concretely: a user in IST who logs a glass of water at 02:00 on the 4th
 * writes to the row dated the 3rd. If the 3rd's challenge was already complete
 * the increment is clamped away entirely, the counter does not move, and the
 * streak — which walks backwards day by day and stops at the first gap —
 * develops a hole that also withholds the badges keyed off it.
 *
 * ## Why the server cannot just use its own local day
 *
 * `getTodayISO()` resolves the day in whatever timezone the *server process*
 * runs in, which on Vercel is UTC. It is the right helper for a client, and no
 * better than `toISOString()` for a server. Only the browser knows the user's
 * calendar, so the browser has to say — see `CLIENT_DAY_HEADER`.
 *
 * ## Why the client is not simply trusted
 *
 * The day key decides which row a write lands on and which days a streak spans,
 * so an unchecked client value would let anyone backfill an arbitrary date and
 * mint streaks and badges. Real timezones span UTC-12 to UTC+14, so a client's
 * local day can legitimately differ from the UTC day by at most one. Anything
 * further away is rejected and the server's own day is used instead — the claim
 * is bounded to what a real clock could produce.
 */

import { addDaysISO, compareDates, getTodayISO, isISODateString } from './date-utils.js'

/**
 * Header carrying the client's local calendar day as `YYYY-MM-DD`.
 * Attached automatically by `lib/fetch-with-timeout.js`.
 */
export const CLIENT_DAY_HEADER = 'x-client-day'

/** Query parameter accepted as an alternative, for links and manual testing. */
export const CLIENT_DAY_PARAM = 'day'

/**
 * The UTC calendar day for an instant. This is the reference the client's claim
 * is bounded against — deliberately UTC, because it is the one frame both sides
 * can compute identically.
 *
 * @param {Date} now
 * @returns {string} `YYYY-MM-DD`
 */
function utcDay(now) {
  return now.toISOString().slice(0, 10)
}

/**
 * True when `candidate` is within one calendar day of the UTC day at `now` —
 * the full range any real timezone (UTC-12 .. UTC+14) can produce.
 *
 * @param {string} candidate
 * @param {Date} now
 * @returns {boolean}
 */
export function isPlausibleClientDay(candidate, now = new Date()) {
  if (!isISODateString(candidate)) return false

  const reference = utcDay(now)
  return (
    compareDates(candidate, addDaysISO(reference, -1)) >= 0 &&
    compareDates(candidate, addDaysISO(reference, 1)) <= 0
  )
}

/**
 * Resolves the calendar day a request should be recorded against.
 *
 * Order: the client's claim if it is present and plausible, otherwise the
 * server's own local day. Never throws — a malformed or hostile header simply
 * falls back.
 *
 * @param {Request} request
 * @param {{ now?: Date }} [options]
 * @returns {string} `YYYY-MM-DD`
 */
export function resolveRequestDay(request, { now = new Date() } = {}) {
  const claimed = readClaimedDay(request)

  if (claimed && isPlausibleClientDay(claimed, now)) return claimed

  return getTodayISO(now)
}

/**
 * Reads the client's claimed day from the header, falling back to the query
 * parameter. Returns `null` when neither is present or readable.
 *
 * @param {Request} request
 * @returns {string|null}
 */
function readClaimedDay(request) {
  const fromHeader = request?.headers?.get?.(CLIENT_DAY_HEADER)
  if (fromHeader && fromHeader.trim()) return fromHeader.trim()

  try {
    if (request?.url) {
      const fromQuery = new URL(request.url).searchParams.get(CLIENT_DAY_PARAM)
      if (fromQuery && fromQuery.trim()) return fromQuery.trim()
    }
  } catch {
    // A route handler always receives an absolute URL, but a hand-built
    // Request in a test might not. Not worth failing a write over.
  }

  return null
}

/**
 * The first day of the month containing `day`.
 *
 * Replaces `new Date(y, m, 1).toISOString().slice(0, 10)`, which builds local
 * midnight on the 1st and then reads its **UTC** day. East of UTC that instant
 * is still the last day of the *previous* month, so the monthly recap silently
 * widened its window to include a day belonging to the month before.
 *
 * @param {string} day `YYYY-MM-DD`
 * @returns {string} `YYYY-MM-01`
 */
export function startOfMonthISO(day) {
  if (!isISODateString(day)) return day
  return `${day.slice(0, 7)}-01`
}
