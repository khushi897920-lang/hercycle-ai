/**
 * Regression suite for lib/symptom-correlation.js — the symptom-to-cycle-phase
 * analysis behind the Insights section.
 *
 * The two failures this engine exists to avoid, and that this suite pins:
 *
 *   1. **Exposure bias.** Counting occurrences per phase and picking the
 *      largest is the obvious implementation, and it is wrong. The luteal phase
 *      is the longest in most cycles, so more logged days fall in it, so it
 *      accumulates the most occurrences of *every* symptom. A naive engine
 *      confidently reports that everything is "a luteal pattern" — an artefact
 *      of phase length, not a finding. The engine therefore compares per-day
 *      rates, normalised by how many logged days fall in each phase.
 *
 *   2. **Small-sample noise.** With five logged days, a symptom that happened
 *      once is 100% "concentrated" in whatever phase it landed in. Rendering
 *      that as a pattern in a health app is worse than rendering nothing.
 *
 * Timezone correctness is also pinned: `new Date('2026-07-21')` parses as UTC
 * midnight, which reads back as the *previous* calendar day for every user west
 * of UTC — and would put a symptom in the wrong phase for exactly the users
 * whose cycle day sits nearest a boundary.
 *
 *   node scripts/test-symptom-correlation.js
 */

import {
  CONFIDENCE,
  MIN_LOGGED_DAYS,
  MIN_SYMPTOM_OCCURRENCES,
  PHASES,
  SUPPRESSION_REASONS,
  analyseSymptomPhases,
  attributeLogsToPhases,
  describePattern,
  gradeConfidence,
  normaliseSymptomName,
  toDisplayName,
} from '../lib/symptom-correlation.js'

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

function checkTrue(actual, label) {
  check(Boolean(actual), true, label)
}

function checkDeep(actual, expected, label) {
  const a = JSON.stringify(actual)
  const b = JSON.stringify(expected)
  if (a === b) {
    passed += 1
    return
  }
  failed += 1
  console.error(`  ❌ ${label}`)
  console.error(`       expected: ${b}`)
  console.error(`       actual:   ${a}`)
}

function section(name) {
  console.log(`\n— ${name}`)
}

/* ────────────────────────────────────────────────────────────────────────────
 * Fixture helpers
 * ────────────────────────────────────────────────────────────────────────── */

/** `2026-07-01` + n days, as a YYYY-MM-DD string. */
function day(offsetFromStart, start = '2026-07-01') {
  const base = new Date(`${start}T00:00:00`)
  base.setDate(base.getDate() + offsetFromStart)
  const y = base.getFullYear()
  const m = String(base.getMonth() + 1).padStart(2, '0')
  const d = String(base.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

/**
 * A 28-day cycle starting 2026-07-01.
 *
 * With periodLength defaulting to 5 and cycleLength 28, calculateCyclePhase
 * gives: days 1-5 menstrual, 6-12 follicular, 13-15 ovulation, 16-28 luteal.
 * So the luteal phase is 13 days against the ovulation phase's 3 — which is
 * exactly the exposure imbalance the engine has to correct for.
 */
const CYCLES = [
  { start_date: '2026-07-01', cycle_length: 28 },
  { start_date: '2026-07-29', cycle_length: 28 },
]

/** Builds a log for cycle-day `n` (1-indexed) of the first cycle. */
function logOn(cycleDay, symptoms, start = '2026-07-01') {
  return { date: day(cycleDay - 1, start), symptoms }
}

/* ────────────────────────────────────────────────────────────────────────────
 * Name normalisation
 * ────────────────────────────────────────────────────────────────────────── */

section('symptom name normalisation')
{
  // Symptoms arrive from the fixed tracker list, the custom-symptom feature,
  // and older rows written before the list was normalised — so all of these
  // occur in real data and must be one bucket, not three.
  check(normaliseSymptomName('Cramps'), 'cramps', 'names are lowercased')
  check(normaliseSymptomName('  Cramps  '), 'cramps', 'names are trimmed')
  check(normaliseSymptomName('back   pain'), 'back pain', 'internal whitespace is collapsed')
  check(normaliseSymptomName(''), null, 'an empty name is dropped')
  check(normaliseSymptomName('   '), null, 'a whitespace-only name is dropped')
  check(normaliseSymptomName(null), null, 'null is dropped')
  check(normaliseSymptomName(42), null, 'a non-string is dropped')

  check(toDisplayName('cramps'), 'Cramps', 'display form is title-cased')
  check(toDisplayName('back pain'), 'Back Pain', 'every word is title-cased')
  check(toDisplayName(''), '', 'an empty name has an empty display form')
}

/* ────────────────────────────────────────────────────────────────────────────
 * Phase attribution
 * ────────────────────────────────────────────────────────────────────────── */

section('phase attribution')
{
  const logs = [
    logOn(1, ['Cramps']),    // menstrual
    logOn(3, ['Cramps']),    // menstrual
    logOn(8, ['Acne']),      // follicular
    logOn(14, ['Nausea']),   // ovulation
    logOn(20, ['Bloating']), // luteal
    logOn(27, ['Bloating']), // luteal
  ]

  const { exposure, totalDays, days } = attributeLogsToPhases(logs, CYCLES)
  check(totalDays, 6, 'every dated log inside a cycle is attributed')
  check(exposure.menstrual, 2, 'menstrual exposure is counted')
  check(exposure.follicular, 1, 'follicular exposure is counted')
  check(exposure.ovulation, 1, 'ovulation exposure is counted')
  check(exposure.luteal, 2, 'luteal exposure is counted')
  check(days[0].symptoms[0], 'cramps', 'symptom names are normalised during attribution')

  // A duplicate row, or an offline entry that also synced, would otherwise
  // inflate both the exposure and the occurrence count for that phase.
  const duped = attributeLogsToPhases(
    [logOn(1, ['Cramps']), logOn(1, ['Cramps']), logOn(1, ['Cramps'])],
    CYCLES
  )
  check(duped.totalDays, 1, 'a day logged more than once counts once')

  // Repeating a symptom within one day's array is the same day, not two.
  const repeated = attributeLogsToPhases([logOn(1, ['Cramps', 'cramps', ' CRAMPS '])], CYCLES)
  check(repeated.days[0].symptoms.length, 1, 'a symptom repeated within one day counts once')
}

section('phase attribution rejects what it cannot place')
{
  const before = attributeLogsToPhases([{ date: '2026-06-01', symptoms: ['Cramps'] }], CYCLES)
  check(
    before.totalDays, 0,
    'a log from before the first recorded cycle is dropped, not given a negative cycle day'
  )

  const noCycles = attributeLogsToPhases([logOn(1, ['Cramps'])], [])
  check(noCycles.totalDays, 0, 'with no cycle history nothing can be attributed')
  check(noCycles.skipped, 1, '…and the log is counted as skipped')

  const malformed = attributeLogsToPhases(
    [null, {}, { date: 'not-a-date', symptoms: ['x'] }, { date: '2026-07-02' }],
    CYCLES
  )
  check(malformed.totalDays, 1, 'malformed logs are skipped; a dateful log with no symptoms still counts as exposure')

  // A day past the end of its cycle, where the next period was never logged,
  // is `irregular`. Attributing it to luteal would inflate exactly the phase
  // this module works hardest not to over-report.
  const overrun = attributeLogsToPhases(
    [{ date: '2026-09-15', symptoms: ['Cramps'] }],
    [{ start_date: '2026-07-29', cycle_length: 28 }]
  )
  check(overrun.totalDays, 0, 'a day past the end of its cycle is not silently attributed to luteal')

  checkDeep(attributeLogsToPhases(null, CYCLES).days, [], 'a null log array is handled')
  checkDeep(attributeLogsToPhases([], null).days, [], 'a null cycle array is handled')
}

section('phase attribution is timezone-safe')
{
  // `new Date('2026-07-21')` is UTC midnight, which reads back as 2026-07-20
  // for anyone west of UTC — putting the symptom one cycle day early. The
  // engine parses with an explicit `T00:00:00` so the date is read as a local
  // calendar day.
  const { days } = attributeLogsToPhases([{ date: '2026-07-05', symptoms: ['Cramps'] }], CYCLES)
  check(days.length, 1, 'the log is attributed')
  check(
    days[0].phase, 'menstrual',
    'cycle day 5 lands in the menstrual phase, not day 4 of the previous phase boundary'
  )

  // A full ISO timestamp must be read by its date part alone.
  const withTime = attributeLogsToPhases(
    [{ date: '2026-07-05T23:45:00.000Z', symptoms: ['Cramps'] }],
    CYCLES
  )
  check(withTime.totalDays, 1, 'a full ISO timestamp is accepted')
  check(withTime.days[0].phase, 'menstrual', '…and read by its calendar day')
}

/* ────────────────────────────────────────────────────────────────────────────
 * The exposure-bias regression — the reason this module exists
 * ────────────────────────────────────────────────────────────────────────── */

section('exposure bias is corrected')
{
  // A symptom logged on EVERY day of a cycle. Raw counts would show 13 luteal
  // occurrences against 3 ovulation ones and declare a strong luteal pattern.
  // Per-day rates are 1.0 everywhere, so the correct answer is "no pattern".
  const everyDay = []
  for (let cycleDay = 1; cycleDay <= 28; cycleDay += 1) {
    everyDay.push(logOn(cycleDay, ['Fatigue']))
  }

  const analysis = analyseSymptomPhases(everyDay, CYCLES)
  const fatigue = analysis.symptoms.find((entry) => entry.symptom === 'fatigue')

  checkTrue(fatigue, 'the symptom is analysed')
  check(fatigue.occurrences, 28, 'all 28 occurrences are counted')

  // The raw count really is highest in luteal — this asserts the bias is
  // present in the data and that the engine simply refuses to be fooled by it.
  const luteal = fatigue.distribution.find((slice) => slice.phase === 'luteal')
  const ovulation = fatigue.distribution.find((slice) => slice.phase === 'ovulation')
  checkTrue(
    luteal.count > ovulation.count,
    'the raw luteal count really is larger — the bias is present in the fixture'
  )
  check(
    luteal.loggedDays, luteal.count,
    '…but the luteal phase also has proportionally more logged days'
  )

  check(fatigue.lift, 1, 'the exposure-normalised lift is exactly 1')
  check(fatigue.isReportable, false, 'a uniformly logged symptom is NOT reported as a phase pattern')
  check(
    fatigue.suppressedBy, SUPPRESSION_REASONS.NO_PATTERN,
    '…and is explained as evenly distributed rather than silently hidden'
  )
  check(fatigue.peakPhase, null, 'a suppressed result names no peak phase')
}

section('a genuine concentration is detected')
{
  // Logged every day of the cycle, but the symptom only ever occurs during the
  // menstrual phase. Rate is 1.0 in menstrual and 0 elsewhere.
  const logs = []
  for (let cycleDay = 1; cycleDay <= 28; cycleDay += 1) {
    logs.push(logOn(cycleDay, cycleDay <= 5 ? ['Cramps'] : []))
  }

  const analysis = analyseSymptomPhases(logs, CYCLES)
  const cramps = analysis.symptoms.find((entry) => entry.symptom === 'cramps')

  check(cramps.occurrences, 5, 'all occurrences are counted')
  check(cramps.peakPhase, 'menstrual', 'the peak phase is identified')
  check(cramps.isReportable, true, 'a real concentration is reported')
  checkTrue(cramps.lift > 2, `the lift reflects the concentration (${cramps.lift}×)`)
  check(cramps.strength, 'strong', 'a large lift is graded strong')
  check(cramps.suppressedBy, null, 'a reportable result has no suppression reason')

  // The share is the *other* number — what the distribution looks like, not
  // what the finding is based on.
  const menstrualSlice = cramps.distribution.find((slice) => slice.phase === 'menstrual')
  check(menstrualSlice.share, 100, 'the display share is 100% for a fully concentrated symptom')
}

section('a luteal concentration survives its own exposure advantage')
{
  // The harder direction: a symptom that really is luteal must still be
  // reported, and the correction must not over-fire and suppress it.
  const logs = []
  for (let cycleDay = 1; cycleDay <= 28; cycleDay += 1) {
    logs.push(logOn(cycleDay, cycleDay >= 16 ? ['Bloating'] : []))
  }

  const bloating = analyseSymptomPhases(logs, CYCLES).symptoms
    .find((entry) => entry.symptom === 'bloating')

  check(bloating.peakPhase, 'luteal', 'a genuinely luteal symptom is still identified as luteal')
  check(bloating.isReportable, true, '…and is reported')
  checkTrue(bloating.lift > 1.35, `its lift clears the threshold (${bloating.lift}×)`)
}

/* ────────────────────────────────────────────────────────────────────────────
 * Small-sample suppression
 * ────────────────────────────────────────────────────────────────────────── */

section('small samples are suppressed')
{
  // Five logged days, one occurrence. 100% "concentrated" — and meaningless.
  const sparse = [
    logOn(2, ['Cramps']),
    logOn(9, []),
    logOn(14, []),
    logOn(18, []),
    logOn(24, []),
  ]

  const analysis = analyseSymptomPhases(sparse, CYCLES)
  check(analysis.totalDays, 5, 'the logged days are counted')
  check(analysis.hasEnoughData, false, `${MIN_LOGGED_DAYS} logged days are required before anything is reported`)
  check(analysis.daysNeeded, MIN_LOGGED_DAYS - 5, 'the shortfall is reported so the UI can name a number')
  check(analysis.reportable.length, 0, 'nothing is reportable')
}

section('a rare symptom is suppressed even with plenty of history')
{
  const logs = []
  for (let cycleDay = 1; cycleDay <= 28; cycleDay += 1) {
    logs.push(logOn(cycleDay, cycleDay === 3 ? ['Nausea'] : []))
  }

  const analysis = analyseSymptomPhases(logs, CYCLES)
  check(analysis.hasEnoughData, true, 'the overall history is sufficient')

  const nausea = analysis.symptoms.find((entry) => entry.symptom === 'nausea')
  check(nausea.occurrences, 1, 'the single occurrence is counted')
  check(nausea.isReportable, false, 'one occurrence is not a pattern, however concentrated it looks')
  check(
    nausea.suppressedBy, SUPPRESSION_REASONS.NOT_ENOUGH_OCCURRENCES,
    `…and the reason names the ${MIN_SYMPTOM_OCCURRENCES}-occurrence threshold`
  )
}

section('logging only during the period is not a finding')
{
  // A user who only logs on period days has every symptom "concentrated" in
  // the menstrual phase by definition. Requiring two covered phases is what
  // stops that from being reported.
  const periodOnly = []
  for (let cycle = 0; cycle < 4; cycle += 1) {
    for (let d = 1; d <= 5; d += 1) {
      periodOnly.push({ date: day((cycle * 28) + (d - 1)), symptoms: ['Cramps'] })
    }
  }

  const cycles = Array.from({ length: 4 }, (_, i) => ({
    start_date: day(i * 28),
    cycle_length: 28,
  }))

  const analysis = analyseSymptomPhases(periodOnly, cycles)
  check(analysis.totalDays, 20, 'all the period days are attributed')
  check(analysis.phasesCovered, 1, 'only one phase has any logged days')
  check(
    analysis.hasEnoughData, false,
    'a single covered phase is not enough to compare against, however many days it holds'
  )
}

/* ────────────────────────────────────────────────────────────────────────────
 * Confidence
 * ────────────────────────────────────────────────────────────────────────── */

section('confidence grading')
{
  check(gradeConfidence(12, 45, 4), CONFIDENCE.HIGH, 'plenty of evidence across all four phases is high')
  check(gradeConfidence(11, 45, 4), CONFIDENCE.MODERATE, 'one occurrence short of high is moderate')
  check(gradeConfidence(12, 44, 4), CONFIDENCE.MODERATE, 'one logged day short of high is moderate')
  check(gradeConfidence(12, 45, 3), CONFIDENCE.MODERATE, 'a phase with no coverage caps confidence at moderate')
  check(gradeConfidence(7, 25, 3), CONFIDENCE.MODERATE, 'the moderate threshold is inclusive')
  check(gradeConfidence(6, 25, 3), CONFIDENCE.LOW, 'below the moderate threshold is low')
  check(gradeConfidence(4, 14, 2), CONFIDENCE.LOW, 'the minimum reportable evidence is low confidence')
}

/* ────────────────────────────────────────────────────────────────────────────
 * Ordering and output shape
 * ────────────────────────────────────────────────────────────────────────── */

section('result ordering is deterministic')
{
  const logs = []
  for (let cycleDay = 1; cycleDay <= 28; cycleDay += 1) {
    const symptoms = []
    if (cycleDay <= 5) symptoms.push('Cramps')          // strongly menstrual
    if (cycleDay >= 16) symptoms.push('Bloating')       // luteal
    symptoms.push('Fatigue')                            // uniform -> suppressed
    logs.push(logOn(cycleDay, symptoms))
  }

  const { symptoms } = analyseSymptomPhases(logs, CYCLES)

  check(symptoms[symptoms.length - 1].symptom, 'fatigue', 'suppressed results sort last')
  checkTrue(symptoms[0].isReportable, 'reportable results sort first')
  checkTrue(
    symptoms[0].lift >= symptoms[1].lift,
    'reportable results are ordered by the strength of the pattern'
  )

  // Insertion order into a Map is not a stable contract to render from.
  const again = analyseSymptomPhases(logs, CYCLES)
  checkDeep(
    again.symptoms.map((entry) => entry.symptom),
    symptoms.map((entry) => entry.symptom),
    'the ordering is stable across runs'
  )
}

section('output shape')
{
  const logs = []
  for (let cycleDay = 1; cycleDay <= 28; cycleDay += 1) {
    logs.push(logOn(cycleDay, cycleDay <= 5 ? ['Cramps'] : []))
  }

  const analysis = analyseSymptomPhases(logs, CYCLES)
  const cramps = analysis.symptoms[0]

  check(cramps.distribution.length, PHASES.length, 'every phase has a slice, including empty ones')
  checkDeep(
    cramps.distribution.map((slice) => slice.phase), PHASES,
    'slices are in cycle order, so the bar reads left to right'
  )
  check(cramps.displayName, 'Cramps', 'a display name is provided')
  checkTrue(Number.isFinite(cramps.lift), 'the lift is a finite number')
  checkTrue(
    cramps.distribution.every((slice) => Number.isFinite(slice.share)),
    'no slice share is NaN'
  )

  const limited = analyseSymptomPhases(logs, CYCLES, { limit: 0 })
  check(limited.symptoms.length, 0, 'the result limit is honoured')
}

section('empty and degenerate inputs')
{
  const empty = analyseSymptomPhases([], [])
  check(empty.hasEnoughData, false, 'no data means no findings')
  check(empty.totalDays, 0, 'no days are counted')
  check(empty.daysNeeded, MIN_LOGGED_DAYS, 'the full threshold is still to go')
  checkDeep(empty.symptoms, [], 'no symptoms are returned')
  checkDeep(empty.reportable, [], 'nothing is reportable')

  const nulls = analyseSymptomPhases(null, null)
  check(nulls.totalDays, 0, 'null inputs are handled without throwing')

  const junkSymptoms = analyseSymptomPhases(
    [{ date: '2026-07-02', symptoms: 'Cramps' }, { date: '2026-07-03', symptoms: [null, 7, ''] }],
    CYCLES
  )
  check(
    junkSymptoms.totalDays, 2,
    'a non-array symptoms field does not lose the day — it still counts as exposure'
  )
  check(junkSymptoms.symptoms.length, 0, '…but nothing unusable is turned into a symptom')
}

section('pattern description')
{
  const logs = []
  for (let cycleDay = 1; cycleDay <= 28; cycleDay += 1) {
    logs.push(logOn(cycleDay, cycleDay <= 5 ? ['Cramps'] : []))
  }
  const cramps = analyseSymptomPhases(logs, CYCLES).reportable[0]

  const sentence = describePattern(cramps, (phase) => phase)
  checkTrue(sentence.includes('Cramps'), 'the description names the symptom')
  checkTrue(sentence.includes('menstrual'), 'the description names the phase')

  // Phrased as an observation about the user's logs, never as a claim about
  // their body: this is a tracker noticing a correlation, not a diagnosis.
  checkTrue(sentence.startsWith('You logged'), 'the description is framed around what was logged')

  check(describePattern(null), '', 'a missing entry produces no sentence')
  check(
    describePattern({ isReportable: false }), '',
    'a suppressed entry produces no sentence, so a caller cannot render one by accident'
  )
}

console.log('')
if (failed > 0) {
  console.error(`❌ ${failed} symptom correlation assertion(s) failed (${passed} passed).`)
  process.exit(1)
}
console.log(`✅ All ${passed} symptom correlation assertions passed.`)
