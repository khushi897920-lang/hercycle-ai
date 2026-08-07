/**
 * Regression suite for the staleness handling in predictNextPeriod.
 *
 * The bug this guards: the projection advanced by exactly ONE cycle length,
 * unconditionally, and confidence was derived purely from the *regularity* of
 * past gaps without ever referencing today. A user with a clean, regular but
 * stale history was therefore shown a "next period" months in the PAST, at 95%
 * confidence:
 *
 *   today: Thu Jul 30 2026
 *   predictNextPeriod([
 *     { start_date: '2026-01-05', cycle_length: 28 },
 *     { start_date: '2026-02-02', cycle_length: 28 },
 *   ])
 *   -> { nextPeriodDate: 'Mar 2, 2026', confidence: '95%' }   // 150 days in the past
 *
 * That same bad date was printed into the PDF doctor report.
 *
 * Every case below pins the clock explicitly so the assertions never drift.
 *
 *   node scripts/test-stale-prediction.js
 */

import { predictNextPeriod } from '../lib/api-helpers.js'

let passed = 0
let failed = 0

function check(actual, expected, label) {
  if (Object.is(actual, expected)) {
    passed += 1
  } else {
    failed += 1
    console.error(`  ❌ ${label}\n       expected: ${JSON.stringify(expected)}\n       actual:   ${JSON.stringify(actual)}`)
  }
}

function checkTrue(condition, label) {
  check(Boolean(condition), true, label)
}

/** Local midnight, so the comparison matches how the helper reads "today". */
function at(year, month, day) {
  return new Date(year, month - 1, day)
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

/** Parses the helper's "Mon D, YYYY" output back into a Date for comparison. */
function parsePredicted(formatted) {
  const match = /^([A-Z][a-z]{2}) (\d{1,2}), (\d{4})$/.exec(formatted)
  if (!match) return null
  return new Date(Number(match[3]), MONTHS.indexOf(match[1]), Number(match[2]))
}

function checkInFuture(result, today, label) {
  const predicted = parsePredicted(result.nextPeriodDate)
  if (!predicted) {
    failed += 1
    console.error(`  ❌ ${label} — could not parse "${result.nextPeriodDate}"`)
    return
  }
  if (predicted >= today) {
    passed += 1
  } else {
    failed += 1
    console.error(`  ❌ ${label}\n       "${result.nextPeriodDate}" is in the PAST (today ${today.toDateString()})`)
  }
}

// ---------------------------------------------------------------------------
// Test 1 — the exact reported case
// ---------------------------------------------------------------------------
async function testReportedCase() {
  console.log('\n▶ Test 1: the reported case')

  const today = at(2026, 7, 30)
  const result = await predictNextPeriod([
    { start_date: '2026-01-05', cycle_length: 28 },
    { start_date: '2026-02-02', cycle_length: 28 },
  ], today)

  check(result.nextPeriodDate === 'Mar 2, 2026', false, 'no longer returns the old past date "Mar 2, 2026"')
  checkInFuture(result, today, 'the prediction is in the future')
  check(result.isStale, true, 'the result is flagged as stale')
  check(result.missedCycles, 6, 'six cycles were skipped to reach the future')
  check(result.hasEnoughRecentData, false, 'the history is too stale to be meaningful')
  check(result.lastLoggedDate, '2026-02-02', 'the last logged date is reported so the UI can explain why')

  const confidence = parseInt(result.confidence, 10)
  check(confidence < 95, true, `confidence dropped from 95% (now ${result.confidence})`)
  check(confidence <= 40, true, 'confidence is low, not merely reduced')
}

// ---------------------------------------------------------------------------
// Test 2 — fresh history is untouched
// ---------------------------------------------------------------------------
async function testFreshHistoryUnchanged() {
  console.log('\n▶ Test 2: fresh history behaves exactly as before')

  const today = at(2026, 7, 30)
  const result = await predictNextPeriod([
    { start_date: '2026-06-05', cycle_length: 28 },
    { start_date: '2026-07-03', cycle_length: 28 },
  ], today)

  check(result.nextPeriodDate, 'Jul 31, 2026', 'one cycle past the last start, as before')
  check(result.confidence, '95%', 'a regular recent history keeps full confidence')
  check(result.averageCycleLength, 28, 'the average is unchanged')
  check(result.missedCycles, 0, 'nothing was skipped')
  check(result.isStale, false, 'not flagged as stale')
  check(result.hasEnoughRecentData, true, 'the history is usable')
}

// ---------------------------------------------------------------------------
// Test 3 — boundary conditions
// ---------------------------------------------------------------------------
async function testBoundaries() {
  console.log('\n▶ Test 3: boundaries')

  const history = (lastStart) => [
    { start_date: '2026-05-01', cycle_length: 28 },
    { start_date: lastStart, cycle_length: 28 },
  ]

  // Last period 2026-05-29, +28 days = 2026-06-26. If today IS that day, the
  // prediction is due today and must not be pushed forward.
  const dueToday = await predictNextPeriod(history('2026-05-29'), at(2026, 6, 26))
  check(dueToday.nextPeriodDate, 'Jun 26, 2026', 'a prediction due today is kept, not advanced')
  check(dueToday.missedCycles, 0, 'due-today counts as zero missed cycles')

  // One day later, it has been missed exactly once.
  const oneDayLate = await predictNextPeriod(history('2026-05-29'), at(2026, 6, 27))
  check(oneDayLate.missedCycles, 1, 'one day past due counts as one missed cycle')
  check(oneDayLate.nextPeriodDate, 'Jul 24, 2026', 'it advances by exactly one more cycle')
  check(parseInt(oneDayLate.confidence, 10), 83, 'one missed cycle costs 12 points')

  // Two missed cycles is still considered workable; three is not.
  const twoMissed = await predictNextPeriod(history('2026-05-29'), at(2026, 7, 25))
  check(twoMissed.missedCycles, 2, 'two missed cycles detected')
  check(twoMissed.hasEnoughRecentData, true, 'two missed cycles is still shown as a prediction')

  const threeMissed = await predictNextPeriod(history('2026-05-29'), at(2026, 8, 22))
  check(threeMissed.missedCycles, 3, 'three missed cycles detected')
  check(threeMissed.hasEnoughRecentData, false, 'three missed cycles is no longer meaningful')
}

// ---------------------------------------------------------------------------
// Test 4 — the single-entry path
// ---------------------------------------------------------------------------
async function testSingleEntry() {
  console.log('\n▶ Test 4: the single-entry path')

  const today = at(2026, 7, 30)

  const fresh = await predictNextPeriod([{ start_date: '2026-07-01', cycle_length: 30 }], today)
  check(fresh.nextPeriodDate, 'Jul 31, 2026', 'a fresh single entry is unchanged')
  check(fresh.confidence, '75%', 'and keeps its 75% confidence')
  check(fresh.missedCycles, 0, 'nothing skipped')

  const stale = await predictNextPeriod([{ start_date: '2026-01-05', cycle_length: 30 }], today)
  checkInFuture(stale, today, 'a stale single entry still predicts into the future')
  check(stale.isStale, true, 'flagged as stale')
  check(parseInt(stale.confidence, 10) < 75, true, 'confidence is reduced below the 75% baseline')
  check(stale.averageCycleLength, 30, 'the stored cycle length is respected')
}

// ---------------------------------------------------------------------------
// Test 5 — confidence never claims more than the data supports
// ---------------------------------------------------------------------------
async function testConfidenceDecay() {
  console.log('\n▶ Test 5: confidence decays with staleness')

  const history = [
    { start_date: '2026-01-01', cycle_length: 28 },
    { start_date: '2026-01-29', cycle_length: 28 },
  ]

  let previous = 101
  let monotonic = true
  const samples = []

  // Walk the clock forward a cycle at a time; confidence must never increase.
  for (let month = 2; month <= 11; month += 1) {
    const result = await predictNextPeriod(history, at(2026, month, 15))
    const confidence = parseInt(result.confidence, 10)
    samples.push(confidence)
    if (confidence > previous) monotonic = false
    previous = confidence
  }

  check(monotonic, true, 'confidence never rises as the history ages')
  check(samples[samples.length - 1] >= 20, true, 'confidence has a floor rather than going negative')
  check(samples[samples.length - 1] <= 30, true, 'a year-old history reports very low confidence')

  // An irregular but recent history should still outrank a regular stale one.
  const irregularRecent = await predictNextPeriod([
    { start_date: '2026-05-01', cycle_length: 28 },
    { start_date: '2026-06-10', cycle_length: 40 },
    { start_date: '2026-07-05', cycle_length: 25 },
  ], at(2026, 7, 30))
  const regularStale = await predictNextPeriod(history, at(2026, 7, 30))
  check(parseInt(irregularRecent.confidence, 10) > parseInt(regularStale.confidence, 10), true,
    'recent-but-irregular beats regular-but-stale')
}

// ---------------------------------------------------------------------------
// Test 6 — degenerate input still returns a well-formed shape
// ---------------------------------------------------------------------------
async function testDegenerateInput() {
  console.log('\n▶ Test 6: degenerate input')

  const today = at(2026, 7, 30)

  const empty = await predictNextPeriod([], today)
  check(empty.confidence, '0%', 'empty history reports 0%')
  check(empty.averageCycleLength, 28, 'empty history falls back to 28 days')
  checkTrue(/^[A-Z][a-z]{2} \d{1,2}, \d{4}$/.test(empty.nextPeriodDate), 'empty history still formats a date')

  const malformed = await predictNextPeriod([{ start_date: 'not-a-date' }, { start_date: null }], today)
  check(malformed.confidence, '0%', 'unparseable history reports 0%')

  // A start date far in the past must terminate rather than spin.
  const ancient = await predictNextPeriod([
    { start_date: '1990-01-01', cycle_length: 28 },
    { start_date: '1990-01-29', cycle_length: 28 },
  ], today)
  checkTrue(Number.isFinite(ancient.missedCycles), 'an ancient history produces a finite missed count')
  checkTrue(ancient.missedCycles > 0, 'and is flagged as stale')

  // Called without an explicit clock, the default must still be sane.
  const defaultClock = await predictNextPeriod([
    { start_date: '2020-01-01', cycle_length: 28 },
    { start_date: '2020-01-29', cycle_length: 28 },
  ])
  checkInFuture(defaultClock, new Date(new Date().getFullYear(), new Date().getMonth(), new Date().getDate()),
    'the default clock also projects into the future')
}

async function main() {
  console.log('Running stale-prediction tests...')

  await testReportedCase()
  await testFreshHistoryUnchanged()
  await testBoundaries()
  await testSingleEntry()
  await testConfidenceDecay()
  await testDegenerateInput()

  if (failed > 0) {
    console.error(`\n❌ ${failed} assertion(s) failed, ${passed} passed.`)
    process.exit(1)
  }
  console.log(`\n✅ All ${passed} assertions passed.`)
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
