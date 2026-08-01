/**
 * Regression suite for lib/date-utils.js and the date handling in
 * lib/api-helpers.js / lib/cycle-helpers.js / lib/utils.js.
 *
 * Guards the fix for the local-vs-UTC date bug: "today" used to be derived from
 * `toISOString()` (the UTC day) while rendered dates were produced with the
 * local accessors, so logs landed on the wrong calendar day and predicted dates
 * displayed one day early.
 *
 * The whole suite is re-run under a matrix of timezones spanning the full
 * UTC-11 .. UTC+14 range, because these bugs are invisible when the test host
 * happens to sit on UTC.
 *
 *   node scripts/test-date-utils.js            # run the timezone matrix
 *   TZ=America/New_York node scripts/test-date-utils.js --single
 */

import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

import {
  addDays,
  addDaysISO,
  compareDates,
  diffInDays,
  eachDayISO,
  formatDisplayDate,
  getTodayISO,
  isISODateString,
  isSameDay,
  parseDateValue,
  startOfLocalDay,
  toISODate,
} from '../lib/date-utils.js'

import { predictNextPeriod } from '../lib/api-helpers.js'
import { getTodayISO as cycleHelpersToday, toDateStr } from '../lib/cycle-helpers.js'
import { formatDateForCSV, toYMD } from '../lib/utils.js'

// Spans the real-world extremes: UTC-11, UTC-5/-4 (DST), UTC, UTC+5:30 (the
// app's primary market), UTC+13 and UTC+14.
const TIMEZONES = [
  'UTC',
  'Asia/Kolkata',
  'America/New_York',
  'America/Los_Angeles',
  'Europe/London',
  'Pacific/Midway',
  'Pacific/Kiritimati',
  'Australia/Sydney',
]

let passed = 0
let failed = 0

function check(actual, expected, label) {
  const ok = Object.is(actual, expected)
  if (ok) {
    passed += 1
  } else {
    failed += 1
    console.error(`  ❌ ${label}\n       expected: ${JSON.stringify(expected)}\n       actual:   ${JSON.stringify(actual)}`)
  }
}

function checkTrue(condition, label) {
  check(Boolean(condition), true, label)
}

function checkDeep(actual, expected, label) {
  check(JSON.stringify(actual), JSON.stringify(expected), label)
}

// ---------------------------------------------------------------------------
// isISODateString
// ---------------------------------------------------------------------------
function testIsISODateString() {
  check(isISODateString('2026-07-21'), true, 'isISODateString accepts a valid day')
  check(isISODateString('2024-02-29'), true, 'isISODateString accepts a leap day')
  check(isISODateString('2026-02-29'), false, 'isISODateString rejects a non-leap 29 Feb')
  check(isISODateString('2026-02-31'), false, 'isISODateString rejects 31 Feb (no silent rollover)')
  check(isISODateString('2026-13-01'), false, 'isISODateString rejects month 13')
  check(isISODateString('2026-00-10'), false, 'isISODateString rejects month 0')
  check(isISODateString('2026-07-32'), false, 'isISODateString rejects day 32')
  check(isISODateString('2026-7-21'), false, 'isISODateString requires zero padding')
  check(isISODateString('2026-07-21T00:00:00Z'), false, 'isISODateString rejects a timestamp')
  check(isISODateString(20260721), false, 'isISODateString rejects a number')
  check(isISODateString(null), false, 'isISODateString rejects null')
}

// ---------------------------------------------------------------------------
// parseDateValue / toISODate — the round-trip that used to shift by a day
// ---------------------------------------------------------------------------
function testParseAndFormat() {
  // The core regression: a bare calendar date must survive parse -> format
  // unchanged in every timezone. `new Date('2026-07-21')` is UTC midnight, so
  // the old code returned "2026-07-20" west of UTC.
  for (const iso of ['2026-01-01', '2026-07-21', '2026-12-31', '2024-02-29']) {
    check(toISODate(iso), iso, `round-trip preserves ${iso}`)
  }

  const parsed = parseDateValue('2026-07-21')
  check(parsed.getFullYear(), 2026, 'parseDateValue keeps the year')
  check(parsed.getMonth(), 6, 'parseDateValue keeps the month (0-indexed July)')
  check(parsed.getDate(), 21, 'parseDateValue keeps the day of month')
  check(parsed.getHours(), 0, 'parseDateValue pins to local midnight')
  check(parsed.getMinutes(), 0, 'parseDateValue zeroes the minutes')

  // Supabase can return a `date` column as a full timestamptz. The leading
  // calendar day must be taken verbatim rather than re-projected.
  check(toISODate('2026-07-21T00:00:00+00:00'), '2026-07-21', 'timestamptz keeps its date prefix')
  check(toISODate('2026-07-21T23:59:59Z'), '2026-07-21', 'late-evening timestamp keeps its date prefix')
  check(toISODate('2026-07-21 08:30:00'), '2026-07-21', 'space-separated timestamp is accepted')

  // Date instances are normalised, not re-interpreted.
  check(toISODate(new Date(2026, 6, 21, 23, 30)), '2026-07-21', 'Date at 23:30 stays on its local day')
  check(toISODate(new Date(2026, 6, 21, 0, 1)), '2026-07-21', 'Date at 00:01 stays on its local day')

  // Unusable input yields '' rather than "Invalid Date" or a thrown error.
  check(toISODate(null), '', 'toISODate(null) is empty')
  check(toISODate(undefined), '', 'toISODate(undefined) is empty')
  check(toISODate(''), '', 'toISODate("") is empty')
  check(toISODate('not-a-date'), '', 'toISODate(garbage) is empty')
  check(parseDateValue('not-a-date'), null, 'parseDateValue(garbage) is null')
  check(parseDateValue(Number.NaN), null, 'parseDateValue(NaN) is null')
  check(parseDateValue(new Date('nope')), null, 'parseDateValue(Invalid Date) is null')

  checkTrue(startOfLocalDay('2026-07-21') instanceof Date, 'startOfLocalDay returns a Date')
  check(startOfLocalDay('2026-07-21').getHours(), 0, 'startOfLocalDay is at midnight')
}

// ---------------------------------------------------------------------------
// getTodayISO — must agree with the local clock, not the UTC clock
// ---------------------------------------------------------------------------
function testGetTodayISO() {
  const now = new Date()
  const expected = [
    String(now.getFullYear()).padStart(4, '0'),
    String(now.getMonth() + 1).padStart(2, '0'),
    String(now.getDate()).padStart(2, '0'),
  ].join('-')

  check(getTodayISO(), expected, 'getTodayISO matches the local calendar day')
  check(cycleHelpersToday(), expected, 'cycle-helpers getTodayISO matches the local calendar day')

  // The two documented failure windows, driven by a fixed instant so the
  // assertion is deterministic regardless of when the suite runs.
  const istEarlyMorning = new Date('2026-07-22T02:00:00+05:30')
  const nyEvening = new Date('2026-07-21T20:30:00-04:00')

  if (process.env.TZ === 'Asia/Kolkata') {
    check(getTodayISO(istEarlyMorning), '2026-07-22', '02:00 IST is still 22 Jul in India')
    check(istEarlyMorning.toISOString().split('T')[0], '2026-07-21', 'the old UTC-based expression returned 21 Jul')
  }

  if (process.env.TZ === 'America/New_York') {
    check(getTodayISO(nyEvening), '2026-07-21', '20:30 EDT is still 21 Jul in New York')
    check(nyEvening.toISOString().split('T')[0], '2026-07-22', 'the old UTC-based expression returned 22 Jul')
  }
}

// ---------------------------------------------------------------------------
// addDays / diffInDays — DST-safe arithmetic
// ---------------------------------------------------------------------------
function testArithmetic() {
  check(addDaysISO('2026-07-21', 1), '2026-07-22', 'addDays +1')
  check(addDaysISO('2026-07-21', -1), '2026-07-20', 'addDays -1')
  check(addDaysISO('2026-07-21', 0), '2026-07-21', 'addDays 0 is identity')
  check(addDaysISO('2026-07-31', 1), '2026-08-01', 'addDays rolls over a month')
  check(addDaysISO('2026-12-31', 1), '2027-01-01', 'addDays rolls over a year')
  check(addDaysISO('2024-02-28', 1), '2024-02-29', 'addDays reaches a leap day')
  check(addDaysISO('2026-02-28', 1), '2026-03-01', 'addDays skips a non-existent leap day')
  check(addDaysISO('2026-07-21', 28), '2026-08-18', 'addDays spans a full cycle')
  check(addDaysISO(null, 5), '', 'addDays on null is empty')
  check(addDays('2026-07-21', Number.NaN).getDate(), 21, 'addDays ignores a NaN offset')

  // US DST transitions: 8 Mar 2026 (spring forward), 1 Nov 2026 (fall back).
  // A naive `+ 86400000` lands at 23:00 or 01:00 and can flip the rendered day.
  check(addDaysISO('2026-03-07', 1), '2026-03-08', 'addDays across spring-forward')
  check(addDaysISO('2026-03-08', 1), '2026-03-09', 'addDays out of spring-forward')
  check(addDaysISO('2026-10-31', 1), '2026-11-01', 'addDays across fall-back')
  check(diffInDays('2026-03-07', '2026-03-09'), 2, 'diffInDays across spring-forward is exactly 2')
  check(diffInDays('2026-10-31', '2026-11-02'), 2, 'diffInDays across fall-back is exactly 2')

  check(diffInDays('2026-07-21', '2026-07-21'), 0, 'diffInDays of the same day is 0')
  check(diffInDays('2026-07-21', '2026-08-18'), 28, 'diffInDays over a cycle is 28')
  check(diffInDays('2026-08-18', '2026-07-21'), -28, 'diffInDays is signed')
  check(diffInDays('2026-07-21', null), null, 'diffInDays with a null bound is null')

  check(compareDates('2026-07-21', '2026-07-22'), -1, 'compareDates orders ascending')
  check(compareDates('2026-07-22', '2026-07-21'), 1, 'compareDates orders descending')
  check(compareDates('2026-07-21', '2026-07-21'), 0, 'compareDates detects equality')
  check(compareDates(null, '2026-07-21'), 1, 'compareDates sorts unparseable values last')

  checkTrue(isSameDay('2026-07-21', '2026-07-21T18:00:00Z'), 'isSameDay matches across representations')
  check(isSameDay('2026-07-21', '2026-07-22'), false, 'isSameDay rejects different days')
  check(isSameDay(null, null), false, 'isSameDay(null, null) is false')
}

// ---------------------------------------------------------------------------
// eachDayISO — powers the calendar period/ovulation shading
// ---------------------------------------------------------------------------
function testEachDayISO() {
  checkDeep(
    eachDayISO('2026-07-21', '2026-07-25'),
    ['2026-07-21', '2026-07-22', '2026-07-23', '2026-07-24', '2026-07-25'],
    'eachDayISO is inclusive at both ends',
  )
  checkDeep(eachDayISO('2026-07-21', '2026-07-21'), ['2026-07-21'], 'eachDayISO of a single day')
  checkDeep(eachDayISO('2026-07-25', '2026-07-21'), [], 'eachDayISO rejects a reversed range')
  checkDeep(eachDayISO(null, '2026-07-21'), [], 'eachDayISO rejects a null bound')
  check(eachDayISO('2026-01-01', '2030-01-01').length, 400, 'eachDayISO caps a runaway range at maxDays')
  check(eachDayISO('2026-01-01', '2026-01-31', 5).length, 5, 'eachDayISO honours a custom maxDays')
  checkDeep(
    eachDayISO('2026-02-27', '2026-03-02'),
    ['2026-02-27', '2026-02-28', '2026-03-01', '2026-03-02'],
    'eachDayISO crosses a month boundary',
  )
}

// ---------------------------------------------------------------------------
// formatDisplayDate — the user-visible string that used to be a day early
// ---------------------------------------------------------------------------
function testFormatDisplayDate() {
  check(formatDisplayDate('2026-07-21'), 'Jul 21, 2026', 'formatDisplayDate renders the stored day')
  check(formatDisplayDate('2026-01-01'), 'Jan 1, 2026', 'formatDisplayDate renders 1 Jan')
  check(formatDisplayDate('2026-12-31'), 'Dec 31, 2026', 'formatDisplayDate renders 31 Dec')
  check(formatDisplayDate('2026-07-21T00:00:00+00:00'), 'Jul 21, 2026', 'formatDisplayDate handles a timestamptz')
  check(formatDisplayDate(null), '', 'formatDisplayDate(null) is empty')
  check(formatDisplayDate('garbage', '—'), '—', 'formatDisplayDate uses the supplied fallback')
}

// ---------------------------------------------------------------------------
// Downstream consumers
// ---------------------------------------------------------------------------
function testCycleHelpers() {
  check(toDateStr('2026-07-21'), '2026-07-21', 'toDateStr passes a bare date through')
  check(toDateStr('2026-07-21T00:00:00+00:00'), '2026-07-21', 'toDateStr strips a timestamp')
  check(toDateStr(null), null, 'toDateStr(null) is null')
  check(toDateStr(''), null, 'toDateStr("") is null')
}

function testUtils() {
  check(toYMD('2026-07-21'), '2026-07-21', 'toYMD preserves a bare date')
  check(toYMD('2026-07-21T18:00:00+05:30'), '2026-07-21', 'toYMD strips a timestamp')
  check(toYMD(''), '', 'toYMD("") is empty')
  check(toYMD('garbage'), 'garbage', 'toYMD echoes an unparseable value')

  check(formatDateForCSV('2026-07-21'), '2026-07-21', 'CSV export preserves a bare date')
  check(formatDateForCSV('2026-07-21T18:00:00+05:30'), '2026-07-21', 'CSV export strips a timestamp')
  check(formatDateForCSV(null), '', 'CSV export of null is empty')
  check(formatDateForCSV('garbage'), '', 'CSV export of garbage is empty')
}

function testPredictNextPeriod() {
  // Two clean 28-day cycles: the projection is exactly one cycle past the last
  // start date, and must render as that day in every timezone.
  const history = [
    { start_date: '2026-05-01', cycle_length: 28 },
    { start_date: '2026-05-29', cycle_length: 28 },
  ]
  const result = predictNextPeriod(history)
  check(result.nextPeriodDate, 'Jun 26, 2026', 'prediction lands on 29 May + 28 days')
  check(result.averageCycleLength, 28, 'prediction reports a 28-day average')

  // Single-entry path.
  const single = predictNextPeriod([{ start_date: '2026-07-01', cycle_length: 30 }])
  check(single.nextPeriodDate, 'Jul 31, 2026', 'single-entry prediction adds the stored cycle length')
  check(single.averageCycleLength, 30, 'single-entry prediction keeps a valid cycle length')

  // Timestamptz rows must behave identically to bare dates.
  const fromTimestamps = predictNextPeriod([
    { start_date: '2026-05-01T00:00:00+00:00', cycle_length: 28 },
    { start_date: '2026-05-29T00:00:00+00:00', cycle_length: 28 },
  ])
  check(fromTimestamps.nextPeriodDate, 'Jun 26, 2026', 'timestamptz history predicts the same day')

  // Empty / unusable history still returns a well-formed shape.
  const empty = predictNextPeriod([])
  check(empty.confidence, '0%', 'empty history reports 0% confidence')
  check(empty.averageCycleLength, 28, 'empty history falls back to 28 days')
  checkTrue(/^[A-Z][a-z]{2} \d{1,2}, \d{4}$/.test(empty.nextPeriodDate), 'empty history still formats a date')

  const malformed = predictNextPeriod([{ start_date: 'not-a-date' }, { start_date: null }])
  check(malformed.confidence, '0%', 'malformed history reports 0% confidence')
}

function runAll() {
  testIsISODateString()
  testParseAndFormat()
  testGetTodayISO()
  testArithmetic()
  testEachDayISO()
  testFormatDisplayDate()
  testCycleHelpers()
  testUtils()
  testPredictNextPeriod()
}

// ---------------------------------------------------------------------------
// Entry point
// ---------------------------------------------------------------------------
const selfPath = fileURLToPath(import.meta.url)

if (process.argv.includes('--single')) {
  console.log(`\n▶ TZ=${process.env.TZ || 'system default'}`)
  runAll()
  if (failed > 0) {
    console.error(`\n❌ ${failed} assertion(s) failed, ${passed} passed (TZ=${process.env.TZ})`)
    process.exit(1)
  }
  console.log(`✅ ${passed} assertions passed (TZ=${process.env.TZ || 'system default'})`)
} else {
  console.log('Running the date-utils suite across the timezone matrix...')
  let anyFailed = false

  for (const tz of TIMEZONES) {
    const run = spawnSync(process.execPath, [selfPath, '--single'], {
      env: { ...process.env, TZ: tz },
      encoding: 'utf-8',
    })
    const output = `${run.stdout || ''}${run.stderr || ''}`.trim()
    if (output) console.log(output)
    if (run.status !== 0) anyFailed = true
  }

  if (anyFailed) {
    console.error('\n❌ Date handling regressed in at least one timezone.')
    process.exit(1)
  }
  console.log(`\n✅ All timezones passed (${TIMEZONES.length} zones).`)
}
