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

/**
 * Returns the ISO date string for today in local time (YYYY-MM-DD).
 * Uses the same approach as deriveDateSets in page.js.
 */
export function getTodayISO() {
  return new Date().toISOString().split('T')[0]
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
  // If already a plain date string, return as-is
  if (/^\d{4}-\d{2}-\d{2}$/.test(dateVal)) return dateVal
  // Otherwise parse and extract date part
  return dateVal.split('T')[0]
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
