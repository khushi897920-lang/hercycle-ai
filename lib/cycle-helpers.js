/**
 * cycle-helpers.js
 *
 * Shared helpers for cycle/period date logic, used by DayLogDrawer and (if needed)
 * track/page.js. All date comparisons use plain YYYY-MM-DD string comparisons to
 * avoid timezone-parsing bugs that arise from `new Date("YYYY-MM-DD")` being parsed
 * as UTC midnight (which is the previous evening in IST and other UTC+ timezones).
 *
 * ISO date strings sort correctly lexicographically, so `"2026-07-22" >= "2026-07-21"`
 * is always correct without any Date object construction.
 */

import { getTodayISO as getLocalTodayISO, toISODate } from './date-utils.js'

/**
 * Returns the ISO date string for today in local time (YYYY-MM-DD).
 *
 * Delegates to lib/date-utils so "today" is built from the local calendar
 * accessors. The previous implementation used `toISOString()`, which yields the
 * UTC day and therefore resolved to the wrong date for every user outside UTC —
 * the exact hazard this file's own header warns about.
 */
export function getTodayISO() {
  return getLocalTodayISO()
}

/**
 * Normalises a date value from the API to a plain YYYY-MM-DD string.
 * Handles both plain date strings ("2026-07-21") and full ISO timestamps
 * ("2026-07-21T00:00:00+00:00") that some Supabase configurations return.
 *
 * @param {string|null|undefined} dateVal
 * @returns {string|null}
 */
export function toDateStr(dateVal) {
  if (!dateVal) return null
  return toISODate(dateVal) || null
}

/**
 * Returns the cycle from the given array that contains `dateISO` within its
 * [start_date, end_date] range (inclusive), or undefined if none match.
 *
 * This is the single source of truth for "is this date inside an open/active cycle"
 * used by DayLogDrawer to decide whether to show "Start Period" or "End Period".
 *
 * A cycle is considered to include a date if:
 *   start_date <= dateISO  AND  (no end_date  OR  end_date >= dateISO)
 *
 * All comparisons are plain string comparisons on YYYY-MM-DD values to avoid
 * Date object timezone issues.
 *
 * @param {Array}  cycles   - The cycles array from cycleData.cycles
 * @param {string} dateISO  - A YYYY-MM-DD string (the clicked calendar day)
 * @returns {object|undefined}
 */
export function findCycleContainingDate(cycles, dateISO) {
  if (!cycles || !dateISO) return undefined
  return cycles.find(c => {
    const start = toDateStr(c.start_date)
    const end = toDateStr(c.end_date)
    if (!start) return false
    return start <= dateISO && (!end || end >= dateISO)
  })
}
