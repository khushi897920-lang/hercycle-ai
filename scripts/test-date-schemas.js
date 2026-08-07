/**
 * Regression suite for lib/date-schemas.js — the calendar-date validation
 * shared by /api/cycles, /api/log-day and /api/weight.
 *
 * Guards the fix for three gaps in the request schemas:
 *
 *   1. `isoDateNotInFuture` in the cycles route was named and documented for
 *      rejecting future dates and never checked. `start_date: "2099-01-01"` was
 *      accepted, and since predictNextPeriod treats the latest entry as the
 *      most recent period, one mistyped year permanently broke prediction for
 *      that account.
 *   2. /api/log-day and /api/weight validated with a bare
 *      /^\d{4}-\d{2}-\d{2}$/, so "2026-02-31" and "2026-13-45" were accepted
 *      and the route answered 200 for a day that does not exist.
 *   3. Nothing bounded the past, so a mistyped year like "0202-07-14" was
 *      stored and then stretched every chart's axis.
 *
 * The whole suite re-runs under a matrix of timezones spanning UTC-11 .. UTC+14,
 * because a bound evaluated in UTC rather than the user's local calendar tells a
 * user in UTC+5:30 that their own "today" is in the future — and that failure is
 * invisible when the test host happens to sit on UTC.
 *
 *   node scripts/test-date-schemas.js            # run the timezone matrix
 *   TZ=Asia/Kolkata node scripts/test-date-schemas.js --single
 */

import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

import {
  EARLIEST_LOGGABLE_DATE,
  endsOnOrAfterStart,
  isoCalendarDate,
  optionalIsoCalendarDate,
} from '../lib/date-schemas.js'

import { addDaysISO, getTodayISO } from '../lib/date-utils.js'

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
  if (Object.is(actual, expected)) {
    passed += 1
    return
  }
  failed += 1
  console.error(`  ❌ ${label}`)
  console.error(`       expected: ${JSON.stringify(expected)}`)
  console.error(`       actual:   ${JSON.stringify(actual)}`)
}

function accepts(schema, value, label) {
  check(schema.safeParse(value).success, true, label)
}

function rejects(schema, value, label) {
  check(schema.safeParse(value).success, false, label)
}

/** The first error message a schema produces, for asserting the copy is useful. */
function firstMessage(schema, value) {
  const result = schema.safeParse(value)
  return result.success ? null : result.error.issues[0]?.message ?? null
}

function runSuite() {
  const date = isoCalendarDate({ label: 'date' })
  const today = getTodayISO()
  const yesterday = addDaysISO(today, -1)
  const tomorrow = addDaysISO(today, 1)

  // ─────────────────────────────────────────────────────────────────────────
  // Shape
  rejects(date, '21-07-2026', 'a DD-MM-YYYY string is rejected')
  rejects(date, '2026-7-21', 'an unpadded month is rejected')
  rejects(date, '2026-07-21T10:00:00Z', 'a timestamp is rejected')
  rejects(date, '', 'an empty string is rejected')
  rejects(date, null, 'null is rejected')
  rejects(date, undefined, 'undefined is rejected')
  rejects(date, 20260721, 'a number is rejected')
  rejects(date, { date: '2026-07-21' }, 'an object is rejected')

  // ─────────────────────────────────────────────────────────────────────────
  // Real calendar days — the gap that let /api/log-day answer 200 for a day
  // that does not exist.
  rejects(date, '2026-02-31', '31 February is rejected')
  rejects(date, '2026-13-45', 'month 13 / day 45 is rejected')
  rejects(date, '2026-00-10', 'month 00 is rejected')
  rejects(date, '2026-07-00', 'day 00 is rejected')
  rejects(date, '2026-04-31', '31 April is rejected')
  rejects(date, '2026-02-29', '29 February in a non-leap year is rejected')

  accepts(date, '2024-02-29', '29 February in a leap year is accepted')
  accepts(date, '2026-01-31', '31 January is accepted')
  accepts(date, '2025-12-31', '31 December is accepted')

  check(
    firstMessage(date, '2026-02-31'),
    'date must be a real calendar date',
    'the impossible-day message names the problem'
  )

  // ─────────────────────────────────────────────────────────────────────────
  // Not in the future — evaluated in the LOCAL calendar. This is the assertion
  // that fails if the bound is ever computed from toISOString().
  accepts(date, today, "the user's own today is accepted")
  accepts(date, yesterday, 'yesterday is accepted')
  rejects(date, tomorrow, 'tomorrow is rejected')
  rejects(date, '2099-01-01', 'a far-future date is rejected')
  rejects(date, addDaysISO(today, 365), 'a year from now is rejected')

  check(
    firstMessage(date, tomorrow),
    'date cannot be in the future',
    'the future message names the problem'
  )

  // ─────────────────────────────────────────────────────────────────────────
  // Past bound
  rejects(date, '0202-07-14', 'a mistyped year is rejected')
  rejects(date, '1899-12-31', 'the day before the lower bound is rejected')
  accepts(date, EARLIEST_LOGGABLE_DATE, 'the lower bound itself is accepted')
  accepts(date, '1900-01-02', 'the day after the lower bound is accepted')

  // ─────────────────────────────────────────────────────────────────────────
  // Options
  const future = isoCalendarDate({ label: 'due_date', allowFuture: true })
  accepts(future, tomorrow, 'allowFuture lets tomorrow through')
  accepts(future, '2099-01-01', 'allowFuture lets a far-future date through')
  rejects(future, '2026-02-31', 'allowFuture still rejects an impossible day')

  const bounded = isoCalendarDate({ label: 'date', earliest: '2020-01-01' })
  rejects(bounded, '2019-12-31', 'a custom lower bound is enforced')
  accepts(bounded, '2020-01-01', 'a custom lower bound is inclusive')

  // An injected clock keeps the future rule testable without touching the
  // system time.
  const frozen = isoCalendarDate({ label: 'date', today: '2026-06-15' })
  accepts(frozen, '2026-06-15', 'the injected today is accepted')
  accepts(frozen, '2026-06-14', 'the day before the injected today is accepted')
  rejects(frozen, '2026-06-16', 'the day after the injected today is rejected')

  check(
    firstMessage(isoCalendarDate({ label: 'recorded_date' }), tomorrow),
    'recorded_date cannot be in the future',
    'the label appears in the message, so the client can point at the field'
  )

  // ─────────────────────────────────────────────────────────────────────────
  // Optional / nullable — the shape `end_date` has
  const endDate = optionalIsoCalendarDate({ label: 'end_date' })
  accepts(endDate, undefined, 'end_date may be omitted')
  accepts(endDate, null, 'end_date may be null')
  accepts(endDate, yesterday, 'end_date accepts a real past day')
  rejects(endDate, tomorrow, 'end_date is still bounded by today')
  rejects(endDate, '2026-02-31', 'end_date still rejects an impossible day')
  rejects(endDate, '', 'end_date rejects an empty string')

  // ─────────────────────────────────────────────────────────────────────────
  // Range comparison
  check(endsOnOrAfterStart('2026-07-01', '2026-07-05'), true, 'a later end is valid')
  check(endsOnOrAfterStart('2026-07-01', '2026-07-01'), true, 'a same-day end is valid')
  check(endsOnOrAfterStart('2026-07-05', '2026-07-01'), false, 'an earlier end is invalid')
  check(endsOnOrAfterStart('2026-07-01', null), true, 'a missing end is not a range error')
  check(endsOnOrAfterStart(null, '2026-07-01'), true, 'a missing start is not a range error')
  check(endsOnOrAfterStart(undefined, undefined), true, 'two missing bounds are fine')
  check(
    endsOnOrAfterStart('2026-12-31', '2027-01-01'),
    true,
    'a range crossing a year boundary is valid'
  )
}

// ───────────────────────────────────────────────────────────────────────────
const selfPath = fileURLToPath(import.meta.url)

if (process.argv.includes('--single')) {
  runSuite()

  const tz = process.env.TZ || 'system default'
  if (failed > 0) {
    console.error(`\n❌ ${failed} assertion(s) failed, ${passed} passed (TZ=${tz})`)
    process.exit(1)
  }
  console.log(`✅ ${passed} assertions passed (TZ=${tz})`)
} else {
  console.log('Running the date-schema suite across the timezone matrix...')
  let anyFailed = false

  for (const tz of TIMEZONES) {
    const run = spawnSync(process.execPath, [selfPath, '--single'], {
      env: { ...process.env, TZ: tz },
      encoding: 'utf-8',
    })
    const output = `${run.stdout || ''}`.trim()
    if (output) console.log(output)
    if (run.status !== 0) {
      anyFailed = true
      if (run.stderr) console.error(run.stderr.trim())
    }
  }

  if (anyFailed) {
    console.error('\n❌ Date validation regressed in at least one timezone.')
    process.exit(1)
  }
  console.log(`\n✅ All timezones passed (${TIMEZONES.length} zones).`)
}
