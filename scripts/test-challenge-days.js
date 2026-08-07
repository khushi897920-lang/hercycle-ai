/**
 * Regression suite for lib/request-day.js and lib/challenge-streaks.js.
 *
 * Guards the fix for the challenges subsystem resolving "today" in UTC. Seven
 * call sites used `new Date().toISOString().slice(0, 10)`, the expression the
 * header of lib/date-utils.js calls out by name:
 *
 *   > For the app's primary audience (India, UTC+5:30) every write between
 *   > 00:00 and 05:30 IST lands on *yesterday*.
 *
 * The whole suite re-runs across a UTC-11 .. UTC+14 timezone matrix, because
 * every one of these assertions passes on a UTC host even with the bug present.
 *
 *   node scripts/test-challenge-days.js            # run the timezone matrix
 *   TZ=Asia/Kolkata node scripts/test-challenge-days.js --single
 */

import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

import {
  CLIENT_DAY_HEADER,
  isPlausibleClientDay,
  resolveRequestDay,
  startOfMonthISO,
} from '../lib/request-day.js'

import { calculateBestStreak, calculateCurrentStreak } from '../lib/challenge-streaks.js'

import { getTodayISO } from '../lib/date-utils.js'

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

/** Minimal stand-in for a Request, with only the surface the resolver touches. */
function fakeRequest({ day = null, url = 'https://hercycle.test/api/challenges' } = {}) {
  const headers = new Map()
  if (day !== null) headers.set(CLIENT_DAY_HEADER, day)
  return {
    url,
    headers: { get: (key) => headers.get(key.toLowerCase()) ?? null },
  }
}

function rows(...dates) {
  return dates.map((date) => ({ date, completed: true }))
}

function runSuite() {
  // ─────────────────────────────────────────────────────────────────────────
  // The headline case: 02:00 on 4 August in IST is still 3 August in UTC.
  const istEarlyMorning = new Date('2026-08-04T02:00:00+05:30')
  check(
    istEarlyMorning.toISOString().slice(0, 10),
    '2026-08-03',
    'the old expression resolves an IST early morning to the previous day'
  )
  check(
    resolveRequestDay(fakeRequest({ day: '2026-08-04' }), { now: istEarlyMorning }),
    '2026-08-04',
    "the resolver honours the client's own calendar day"
  )

  // And the mirror image: 19:00 on 3 August in Los Angeles is 4 August in UTC.
  const pacificEvening = new Date('2026-08-03T19:00:00-07:00')
  check(
    pacificEvening.toISOString().slice(0, 10),
    '2026-08-04',
    'the old expression resolves a Pacific evening to the next day'
  )
  check(
    resolveRequestDay(fakeRequest({ day: '2026-08-03' }), { now: pacificEvening }),
    '2026-08-03',
    'the resolver honours a client a day behind UTC'
  )

  // ─────────────────────────────────────────────────────────────────────────
  // The claim is bounded, so a client cannot backfill an arbitrary day and
  // mint a streak.
  const now = new Date('2026-08-03T12:00:00Z')

  check(isPlausibleClientDay('2026-08-03', now), true, 'the UTC day itself is plausible')
  check(isPlausibleClientDay('2026-08-04', now), true, 'one day ahead is plausible (UTC+14)')
  check(isPlausibleClientDay('2026-08-02', now), true, 'one day behind is plausible (UTC-12)')
  check(isPlausibleClientDay('2026-08-05', now), false, 'two days ahead is rejected')
  check(isPlausibleClientDay('2026-08-01', now), false, 'two days behind is rejected')
  check(isPlausibleClientDay('2020-01-01', now), false, 'a far-past claim is rejected')
  check(isPlausibleClientDay('2026-02-31', now), false, 'an impossible day is rejected')
  check(isPlausibleClientDay('not-a-date', now), false, 'garbage is rejected')
  check(isPlausibleClientDay('', now), false, 'an empty claim is rejected')
  check(isPlausibleClientDay(null, now), false, 'a null claim is rejected')

  check(
    resolveRequestDay(fakeRequest({ day: '2020-01-01' }), { now }),
    getTodayISO(now),
    'an implausible claim falls back to the server day instead of being honoured'
  )
  check(
    resolveRequestDay(fakeRequest({ day: '<script>' }), { now }),
    getTodayISO(now),
    'a hostile claim falls back rather than throwing'
  )
  check(
    resolveRequestDay(fakeRequest(), { now }),
    getTodayISO(now),
    'a request with no claim falls back to the server day'
  )
  check(
    resolveRequestDay(null, { now }),
    getTodayISO(now),
    'a missing request does not throw'
  )

  // The query parameter is accepted as an alternative to the header.
  check(
    resolveRequestDay(
      { url: 'https://hercycle.test/api/challenges?day=2026-08-04', headers: { get: () => null } },
      { now }
    ),
    '2026-08-04',
    'the day query parameter is honoured'
  )

  // ─────────────────────────────────────────────────────────────────────────
  // Month boundary. `new Date(y, m, 1).toISOString()` west of UTC yields the
  // last day of the *previous* month, so the recap included an extra day.
  check(startOfMonthISO('2026-08-04'), '2026-08-01', 'the month starts on the 1st')
  check(startOfMonthISO('2026-08-01'), '2026-08-01', 'the 1st maps to itself')
  check(startOfMonthISO('2026-01-31'), '2026-01-01', 'January is handled')
  check(startOfMonthISO('2026-12-31'), '2026-12-01', 'December is handled')
  // Demonstrate the bug the replacement removes: `new Date(y, m, 1)` builds
  // local midnight on the 1st, and east of UTC that instant is still the last
  // day of the previous month in UTC — so reading its UTC day widened the
  // recap window by one day.
  const oldMonthStart = new Date(2026, 7, 1).toISOString().slice(0, 10)
  if (isEastOfUTC()) {
    check(oldMonthStart, '2026-07-31', 'east of UTC the old expression lands in the previous month')
  } else {
    check(oldMonthStart, '2026-08-01', 'at or west of UTC the old expression happened to be right')
  }
  check(startOfMonthISO('2026-08-04'), '2026-08-01', 'the replacement is correct in every zone')

  // ─────────────────────────────────────────────────────────────────────────
  // Current streak
  const today = '2026-08-03'

  check(calculateCurrentStreak(rows(), today), 0, 'no completions is a streak of zero')
  check(calculateCurrentStreak(rows('2026-08-03'), today), 1, 'today alone is a streak of one')
  check(
    calculateCurrentStreak(rows('2026-08-03', '2026-08-02', '2026-08-01'), today),
    3,
    'three consecutive days ending today'
  )
  check(
    calculateCurrentStreak(rows('2026-08-02', '2026-08-01'), today),
    0,
    'a streak that ended yesterday is not current'
  )
  check(
    calculateCurrentStreak(rows('2026-08-03', '2026-08-01'), today),
    1,
    'a gap ends the streak'
  )
  check(
    calculateCurrentStreak(rows('2026-08-03', '2026-08-03', '2026-08-02'), today),
    2,
    'two challenges completed on the same day count once'
  )
  check(
    calculateCurrentStreak(rows('2026-08-01', '2026-07-31', '2026-07-30'), '2026-08-01'),
    3,
    'a streak spanning a month boundary is unbroken'
  )
  check(
    calculateCurrentStreak(rows('2026-01-01', '2025-12-31', '2025-12-30'), '2026-01-01'),
    3,
    'a streak spanning a year boundary is unbroken'
  )
  check(
    calculateCurrentStreak(rows('2024-03-01', '2024-02-29', '2024-02-28'), '2024-03-01'),
    3,
    'a streak spanning a leap day is unbroken'
  )
  check(calculateCurrentStreak(null, today), 0, 'a null row set is tolerated')

  // ─────────────────────────────────────────────────────────────────────────
  // Best streak
  check(calculateBestStreak([]), 0, 'no rows is a best streak of zero')
  check(calculateBestStreak(rows('2026-08-01')), 1, 'one day is a best streak of one')
  check(
    calculateBestStreak(rows('2026-08-01', '2026-08-02', '2026-08-05', '2026-08-06', '2026-08-07')),
    3,
    'the longest run wins, not the first'
  )
  check(
    calculateBestStreak(rows('2026-08-07', '2026-08-06', '2026-08-05')),
    3,
    'input order does not matter'
  )
  check(
    calculateBestStreak(rows('2026-08-01', '2026-08-01', '2026-08-02')),
    2,
    'duplicate days count once'
  )
  check(
    calculateBestStreak(rows('2026-03-01', '2026-02-28', '2026-02-27')),
    3,
    'a run across a non-leap February boundary is unbroken'
  )
  check(calculateBestStreak(null), 0, 'a null row set is tolerated')
}

/**
 * True when the host timezone is ahead of UTC, which is where the old
 * month-start expression broke. `getTimezoneOffset()` returns UTC-minus-local
 * in minutes, so a negative value means the zone is east.
 */
function isEastOfUTC() {
  return new Date(2026, 7, 1).getTimezoneOffset() < 0
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
  console.log('Running the challenge-day suite across the timezone matrix...')
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
    console.error('\n❌ Challenge day handling regressed in at least one timezone.')
    process.exit(1)
  }
  console.log(`\n✅ All timezones passed (${TIMEZONES.length} zones).`)
}
