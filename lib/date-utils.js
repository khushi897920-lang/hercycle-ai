/**
 * date-utils.js — the single source of truth for calendar-date handling.
 *
 * ## Why this module exists
 *
 * HerCycle AI stores days as plain `YYYY-MM-DD` strings (Postgres `date`
 * columns, IndexedDB keys, `daily_logs` upsert keys). Converting between those
 * strings and JavaScript `Date` objects is where two classic bugs come from:
 *
 * 1. `new Date().toISOString().split('T')[0]` yields the **UTC** calendar date,
 *    not the user's. For the app's primary audience (India, UTC+5:30) every
 *    write between 00:00 and 05:30 IST lands on *yesterday*. For users west of
 *    UTC, every write after ~19:00 local lands on *tomorrow*.
 *
 * 2. `new Date('2026-07-21')` is defined by ECMA-262 to parse as **UTC
 *    midnight**. Reading it back with the local accessors (`getFullYear`,
 *    `getMonth`, `getDate`) therefore returns 20 July in any UTC-negative
 *    timezone — a silent off-by-one on every rendered date.
 *
 * Every helper here works in the **user's local calendar frame** and is
 * lossless when round-tripping `parse -> format`. There is exactly one rule:
 *
 *   > A `YYYY-MM-DD` string names a calendar day, never an instant.
 *   > Parse it with `parseDateValue`, render it with `toISODate`.
 *
 * The module has no imports, so it is safe in Server Components, Route
 * Handlers, Client Components and plain Node scripts alike.
 */

/** Matches a bare calendar date, e.g. "2026-07-21". */
const ISO_DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/

/** Matches a calendar date followed by a time component, e.g. Supabase timestamptz. */
const ISO_DATETIME_PREFIX_RE = /^(\d{4})-(\d{2})-(\d{2})[T ]/

const MS_PER_DAY = 24 * 60 * 60 * 1000

const MONTH_ABBREVIATIONS = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
]

/**
 * True when `value` is a bare `YYYY-MM-DD` string that names a real calendar
 * day. Rejects structurally-valid-but-nonexistent dates such as "2026-02-31"
 * (which `new Date` would silently roll over to 3 March).
 *
 * @param {unknown} value
 * @returns {boolean}
 */
export function isISODateString(value) {
  if (typeof value !== 'string') return false
  const match = ISO_DATE_RE.exec(value)
  if (!match) return false

  const year = Number(match[1])
  const month = Number(match[2])
  const day = Number(match[3])

  if (month < 1 || month > 12) return false
  if (day < 1 || day > 31) return false

  // Round-trip through a local Date to reject overflow (e.g. 2026-02-31).
  const probe = new Date(year, month - 1, day)
  return (
    probe.getFullYear() === year &&
    probe.getMonth() === month - 1 &&
    probe.getDate() === day
  )
}

/**
 * Parses any date-ish value into a `Date` pinned to **local midnight**.
 *
 * Accepted inputs:
 *   - `Date`                          -> normalised to local midnight
 *   - `"YYYY-MM-DD"`                  -> that calendar day, local frame
 *   - `"YYYY-MM-DDTHH:mm:ss..."`      -> the leading calendar day is taken
 *     verbatim, so a Supabase `timestamptz` never shifts a day either way
 *   - `number` (epoch millis)         -> the local day containing that instant
 *
 * Returns `null` for anything unparseable, so callers can branch explicitly
 * instead of propagating an `Invalid Date`.
 *
 * @param {Date|string|number|null|undefined} value
 * @returns {Date|null}
 */
export function parseDateValue(value) {
  if (value === null || value === undefined || value === '') return null

  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) return null
    return new Date(value.getFullYear(), value.getMonth(), value.getDate())
  }

  if (typeof value === 'number') {
    if (!Number.isFinite(value)) return null
    const fromEpoch = new Date(value)
    if (Number.isNaN(fromEpoch.getTime())) return null
    return new Date(fromEpoch.getFullYear(), fromEpoch.getMonth(), fromEpoch.getDate())
  }

  if (typeof value !== 'string') return null

  const trimmed = value.trim()
  if (!trimmed) return null

  // Bare calendar date — build it directly in the local frame. Using the
  // three-argument Date constructor (rather than Date.parse) is what keeps
  // this from being interpreted as UTC midnight.
  if (isISODateString(trimmed)) {
    const [year, month, day] = trimmed.split('-').map(Number)
    return new Date(year, month - 1, day)
  }

  // Timestamp with a date prefix — trust the prefix. Letting the engine parse
  // the full string and then reading local accessors is exactly the bug this
  // module exists to prevent.
  const prefix = ISO_DATETIME_PREFIX_RE.exec(trimmed)
  if (prefix) {
    const year = Number(prefix[1])
    const month = Number(prefix[2])
    const day = Number(prefix[3])
    const candidate = new Date(year, month - 1, day)
    return Number.isNaN(candidate.getTime()) ? null : candidate
  }

  // Anything else (RFC 2822, locale strings, ...) — fall back to the engine
  // and normalise whatever local day it lands on.
  const parsed = new Date(trimmed)
  if (Number.isNaN(parsed.getTime())) return null
  return new Date(parsed.getFullYear(), parsed.getMonth(), parsed.getDate())
}

/**
 * Renders a date-ish value as a `YYYY-MM-DD` string in the **local** calendar.
 *
 * This is the inverse of {@link parseDateValue}: for any accepted input,
 * `toISODate(parseDateValue(x)) === toISODate(x)`.
 *
 * @param {Date|string|number|null|undefined} value
 * @returns {string} the calendar day, or `''` when the input is unusable
 */
export function toISODate(value) {
  const date = parseDateValue(value)
  if (!date) return ''

  const year = String(date.getFullYear()).padStart(4, '0')
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

/**
 * Today's calendar day in the user's timezone, as `YYYY-MM-DD`.
 *
 * Replaces `new Date().toISOString().split('T')[0]`, which returns the UTC day.
 *
 * @param {Date} [now] injectable clock, for tests
 * @returns {string}
 */
export function getTodayISO(now = new Date()) {
  return toISODate(now)
}

/**
 * Local midnight for the day containing `value`.
 *
 * @param {Date|string|number|null|undefined} value
 * @returns {Date|null}
 */
export function startOfLocalDay(value) {
  return parseDateValue(value)
}

/**
 * Adds `days` calendar days, staying on local midnight across DST boundaries.
 *
 * `Date.prototype.setDate` already handles month/year rollover; re-normalising
 * afterwards keeps the result at midnight even when the day crossed a DST
 * transition (where +24h would land at 23:00 or 01:00).
 *
 * @param {Date|string|number|null|undefined} value
 * @param {number} days may be negative
 * @returns {Date|null}
 */
export function addDays(value, days) {
  const date = parseDateValue(value)
  if (!date) return null
  if (!Number.isFinite(days)) return date

  const shifted = new Date(date.getFullYear(), date.getMonth(), date.getDate() + Math.trunc(days))
  return new Date(shifted.getFullYear(), shifted.getMonth(), shifted.getDate())
}

/**
 * {@link addDays}, returning a `YYYY-MM-DD` string.
 *
 * @param {Date|string|number|null|undefined} value
 * @param {number} days
 * @returns {string}
 */
export function addDaysISO(value, days) {
  return toISODate(addDays(value, days))
}

/**
 * Whole calendar days from `from` to `to` (`to - from`).
 *
 * Both operands are projected onto a UTC grid *after* their local calendar day
 * has been extracted, so the subtraction is immune to DST: two dates one day
 * apart always differ by exactly 1, even when the local day was 23 or 25 hours
 * long.
 *
 * @param {Date|string|number|null|undefined} from
 * @param {Date|string|number|null|undefined} to
 * @returns {number|null} `null` when either side is unparseable
 */
export function diffInDays(from, to) {
  const start = parseDateValue(from)
  const end = parseDateValue(to)
  if (!start || !end) return null

  const startUTC = Date.UTC(start.getFullYear(), start.getMonth(), start.getDate())
  const endUTC = Date.UTC(end.getFullYear(), end.getMonth(), end.getDate())
  return Math.round((endUTC - startUTC) / MS_PER_DAY)
}

/**
 * Chronological comparison of two calendar days, suitable for `Array#sort`.
 * Unparseable values sort last.
 *
 * @param {Date|string|number|null|undefined} a
 * @param {Date|string|number|null|undefined} b
 * @returns {number} negative if `a < b`, positive if `a > b`, `0` if equal
 */
export function compareDates(a, b) {
  const left = toISODate(a)
  const right = toISODate(b)
  if (!left && !right) return 0
  if (!left) return 1
  if (!right) return -1
  // ISO date strings are lexicographically ordered, so string compare is exact.
  if (left < right) return -1
  if (left > right) return 1
  return 0
}

/**
 * True when both values name the same calendar day.
 *
 * @param {Date|string|number|null|undefined} a
 * @param {Date|string|number|null|undefined} b
 * @returns {boolean}
 */
export function isSameDay(a, b) {
  const left = toISODate(a)
  const right = toISODate(b)
  return Boolean(left) && left === right
}

/**
 * Human-readable date, e.g. `"Jul 21, 2026"`.
 *
 * Uses the same month table the previous inline formatters used, so existing
 * copy and PDF layouts are unchanged — only the underlying parse is fixed.
 *
 * @param {Date|string|number|null|undefined} value
 * @param {string} [fallback=''] returned when the value cannot be parsed
 * @returns {string}
 */
export function formatDisplayDate(value, fallback = '') {
  const date = parseDateValue(value)
  if (!date) return fallback
  return `${MONTH_ABBREVIATIONS[date.getMonth()]} ${date.getDate()}, ${date.getFullYear()}`
}

/**
 * Every calendar day from `start` to `end`, inclusive, as `YYYY-MM-DD`.
 *
 * Returns `[]` when either bound is unparseable or `end` precedes `start`.
 * `maxDays` guards against a corrupted row producing an unbounded loop — the
 * calendar views that consume this only ever render a handful of months.
 *
 * @param {Date|string|number|null|undefined} start
 * @param {Date|string|number|null|undefined} end
 * @param {number} [maxDays=400]
 * @returns {string[]}
 */
export function eachDayISO(start, end, maxDays = 400) {
  const from = parseDateValue(start)
  const to = parseDateValue(end)
  if (!from || !to) return []

  const span = diffInDays(from, to)
  if (span === null || span < 0) return []

  const days = []
  const limit = Math.min(span, Math.max(0, maxDays - 1))
  for (let offset = 0; offset <= limit; offset += 1) {
    days.push(addDaysISO(from, offset))
  }
  return days
}
