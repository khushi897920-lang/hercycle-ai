/**
 * symptom-correlation.js — where in the cycle a symptom actually lands.
 *
 * ## Why this exists
 *
 * The Insights page reported symptoms as one flat all-time total:
 *
 *     dailyLogs.forEach(log => {
 *       log.symptoms.forEach(s => { symptomCounts[key] = (symptomCounts[key] || 0) + 1 })
 *     })
 *
 * "Cramps: 34" is true and almost useless. The clinically interesting question
 * — and the one the app already has every piece of data to answer — is *when*
 * in the cycle they happen. Cramps concentrated in the luteal phase read very
 * differently from cramps scattered uniformly, and a headache pattern that is
 * overwhelmingly pre-menstrual is actionable in a way a raw count is not.
 *
 * Everything needed was already in the repo and simply never joined up:
 * `lib/calculateCyclePhase.js` maps a date to a phase, `fetchAllLogs()` returns
 * every log with its date and symptoms, and `fetchCycles()` returns the history
 * the phase calculation needs. The Insights page loaded all three and threw the
 * relationship away.
 *
 * ## The trap this module exists to avoid
 *
 * The obvious implementation — count occurrences per phase, pick the largest —
 * is **biased by exposure**. The luteal phase is the longest phase in most
 * cycles, so more logged days fall in it, so it accumulates the most
 * occurrences of *every* symptom. A naive engine would confidently report that
 * every symptom the user has ever logged is "a luteal pattern", which is an
 * artefact of phase length rather than a finding.
 *
 * The fix is to normalise: for each phase, divide the symptom's occurrences by
 * the number of **logged days that fell in that phase**, giving a per-day rate.
 * Only then are phases comparable. The headline figure is the *lift* — how many
 * times more likely the symptom is in its peak phase than across the cycle as a
 * whole — which is exposure-free by construction.
 *
 * ## The second trap: small samples
 *
 * With five logged days, a symptom that happened once is 100% "concentrated" in
 * whatever phase it landed in. That is noise, and rendering it as a pattern in
 * a health app is worse than rendering nothing. Every result therefore carries
 * an explicit suppression reason and a confidence tier, and the UI is expected
 * to show the reason rather than the pattern when `isReportable` is false.
 *
 * This module is pure — no React, no I/O, no clock beyond what is passed in —
 * so all of the above is exhaustively testable. See
 * `scripts/test-symptom-correlation.js`.
 */

import { calculateCyclePhase } from './calculateCyclePhase.js'

/** The phases a logged day can be attributed to, in cycle order. */
export const PHASES = ['menstrual', 'follicular', 'ovulation', 'luteal']

/**
 * Logged days needed before any pattern is reported at all.
 *
 * Two full cycles' worth of days. Below this the phase buckets are too sparse
 * for a rate to mean anything.
 */
export const MIN_LOGGED_DAYS = 14

/** Occurrences of a specific symptom needed before that symptom is reported. */
export const MIN_SYMPTOM_OCCURRENCES = 4

/**
 * Distinct phases that must have at least one logged day.
 *
 * A user who only logs during their period has every symptom "concentrated" in
 * the menstrual phase by definition. Requiring coverage of at least two phases
 * is what stops that from being reported as a finding.
 */
export const MIN_PHASES_COVERED = 2

/**
 * Lift below which a distribution is called even rather than concentrated.
 *
 * 1.0 would be exactly uniform; 1.35 leaves room for ordinary sampling noise
 * before a pattern is claimed.
 */
export const MIN_MEANINGFUL_LIFT = 1.35

/** Lift at or above which a pattern is called strong. */
export const STRONG_LIFT = 2

/** Why a symptom's pattern is not being reported. */
export const SUPPRESSION_REASONS = {
  NOT_ENOUGH_DAYS: 'not_enough_logged_days',
  NOT_ENOUGH_OCCURRENCES: 'not_enough_occurrences',
  NOT_ENOUGH_PHASES: 'not_enough_phases_covered',
  NO_PATTERN: 'evenly_distributed',
}

/** Confidence tiers, from the amount of evidence behind a reported pattern. */
export const CONFIDENCE = {
  LOW: 'low',
  MODERATE: 'moderate',
  HIGH: 'high',
}

/**
 * Normalises a symptom name for grouping.
 *
 * Symptoms arrive from three places — the fixed tracker list, the custom
 * symptom feature, and older rows written before the list was normalised — so
 * "Cramps", "cramps" and " Cramps " all occur in real data and must be one
 * bucket, not three.
 *
 * @param {unknown} raw
 * @returns {string|null}
 */
export function normaliseSymptomName(raw) {
  if (typeof raw !== 'string') return null
  const trimmed = raw.trim().replace(/\s+/g, ' ')
  return trimmed ? trimmed.toLowerCase() : null
}

/**
 * Restores a normalised name to its display form.
 *
 * Only used for symptoms that have no translation key — the tracker's own list
 * is translated by the UI.
 *
 * @param {string} normalised
 * @returns {string}
 */
export function toDisplayName(normalised) {
  if (typeof normalised !== 'string' || !normalised) return ''
  return normalised.replace(/\b\w/g, (character) => character.toUpperCase())
}

/**
 * Parses a `YYYY-MM-DD` (or ISO) log date into a local calendar day.
 *
 * Uses the same `T00:00:00`-suffix trick as `calculateCyclePhase`, because
 * `new Date('2026-07-21')` parses as UTC midnight — which reads back as the
 * *previous* day for every user west of UTC, and would put a symptom in the
 * wrong phase for exactly the users whose cycle day is nearest a boundary.
 *
 * @param {unknown} value
 * @returns {Date|null}
 */
function toLocalDay(value) {
  if (!value) return null
  const date = new Date(`${String(value).slice(0, 10)}T00:00:00`)
  if (Number.isNaN(date.getTime())) return null
  date.setHours(0, 0, 0, 0)
  return date
}

/**
 * Finds the cycle a given day belongs to: the most recent cycle that started on
 * or before it.
 *
 * A log from before the first recorded cycle has no phase — it is dropped
 * rather than attributed to the earliest cycle, which would place it at a
 * negative cycle day.
 *
 * @param {Array<{start_date: string}>} sortedCycles ascending by start date
 * @param {Date} day
 * @returns {{start_date: string, cycle_length?: number}|null}
 */
function findGoverningCycle(sortedCycles, day) {
  let match = null
  for (const cycle of sortedCycles) {
    const start = toLocalDay(cycle.start_date)
    if (!start) continue
    if (start.getTime() <= day.getTime()) match = cycle
    else break
  }
  return match
}

/**
 * Assigns each logged day to a cycle phase.
 *
 * Returns both the per-day attributions and the phase *exposure* — how many
 * logged days fell in each phase — which is the denominator that makes the
 * later comparison unbiased.
 *
 * @param {Array<{date: string, symptoms?: unknown}>} dailyLogs
 * @param {Array<{start_date: string, cycle_length?: number}>} cycles
 * @param {number} [fallbackCycleLength=28] used when a cycle row has no length
 * @returns {{
 *   days: Array<{ phase: string, symptoms: string[] }>,
 *   exposure: Record<string, number>,
 *   totalDays: number,
 *   skipped: number
 * }}
 */
export function attributeLogsToPhases(dailyLogs, cycles, fallbackCycleLength = 28) {
  const exposure = Object.fromEntries(PHASES.map((phase) => [phase, 0]))
  const days = []
  let skipped = 0

  const sortedCycles = (Array.isArray(cycles) ? cycles : [])
    .filter((cycle) => cycle && toLocalDay(cycle.start_date))
    .sort((a, b) => toLocalDay(a.start_date) - toLocalDay(b.start_date))

  if (sortedCycles.length === 0) {
    return { days, exposure, totalDays: 0, skipped: Array.isArray(dailyLogs) ? dailyLogs.length : 0 }
  }

  // A day can be logged more than once in the data (a duplicate row, an
  // offline entry that also synced). Counting it twice would inflate both the
  // exposure and the occurrence count for that phase, so days are de-duplicated
  // by calendar date, last write winning.
  const byDate = new Map()
  for (const log of Array.isArray(dailyLogs) ? dailyLogs : []) {
    if (!log || !log.date) { skipped += 1; continue }
    const key = String(log.date).slice(0, 10)
    byDate.set(key, log)
  }

  for (const log of byDate.values()) {
    const day = toLocalDay(log.date)
    if (!day) { skipped += 1; continue }

    const cycle = findGoverningCycle(sortedCycles, day)
    if (!cycle) { skipped += 1; continue }

    const { phaseKey, hasData } = calculateCyclePhase({
      periodStart: cycle.start_date,
      cycleLength: Number(cycle.cycle_length) || fallbackCycleLength,
      today: day,
    })

    // `irregular` is what calculateCyclePhase returns for a day past the end of
    // its cycle — a gap where the next period was never logged. Attributing it
    // to `luteal` would inflate exactly the phase this module is trying not to
    // over-report.
    if (!hasData || !PHASES.includes(phaseKey)) { skipped += 1; continue }

    const symptoms = Array.isArray(log.symptoms)
      ? Array.from(new Set(log.symptoms.map(normaliseSymptomName).filter(Boolean)))
      : []

    exposure[phaseKey] += 1
    days.push({ phase: phaseKey, symptoms })
  }

  return { days, exposure, totalDays: days.length, skipped }
}

/**
 * Rounds to one decimal, avoiding the `0.30000000000000004` that reaches the UI
 * when a rate is rendered directly.
 *
 * @param {number} value
 * @returns {number}
 */
function round1(value) {
  return Math.round(value * 10) / 10
}

/**
 * Grades the evidence behind a reported pattern.
 *
 * Deliberately conservative: the difference between "we noticed something" and
 * "this is a pattern" is the difference between a useful prompt and a false
 * claim about someone's health.
 *
 * @param {number} occurrences
 * @param {number} totalDays
 * @param {number} phasesCovered
 * @returns {'low'|'moderate'|'high'}
 */
export function gradeConfidence(occurrences, totalDays, phasesCovered) {
  if (occurrences >= 12 && totalDays >= 45 && phasesCovered === PHASES.length) return CONFIDENCE.HIGH
  if (occurrences >= 7 && totalDays >= 25 && phasesCovered >= 3) return CONFIDENCE.MODERATE
  return CONFIDENCE.LOW
}

/**
 * Analyses one symptom's distribution across the phases.
 *
 * @param {object} options
 * @param {string} options.symptom normalised name
 * @param {Record<string, number>} options.counts occurrences per phase
 * @param {Record<string, number>} options.exposure logged days per phase
 * @param {number} options.totalDays
 * @returns {object} a display model; see {@link analyseSymptomPhases}
 */
function analyseOne({ symptom, counts, exposure, totalDays }) {
  const occurrences = PHASES.reduce((sum, phase) => sum + (counts[phase] || 0), 0)
  const phasesCovered = PHASES.filter((phase) => exposure[phase] > 0).length

  // Per-day rate within each phase. This is the whole point: comparing raw
  // counts would just rediscover which phase has the most logged days.
  const rates = {}
  for (const phase of PHASES) {
    rates[phase] = exposure[phase] > 0 ? (counts[phase] || 0) / exposure[phase] : 0
  }

  const distribution = PHASES.map((phase) => ({
    phase,
    count: counts[phase] || 0,
    loggedDays: exposure[phase],
    // Share of *occurrences*, for the stacked bar. Not used for the finding —
    // it carries exactly the exposure bias the rate exists to remove.
    share: occurrences > 0 ? Math.round(((counts[phase] || 0) / occurrences) * 100) : 0,
    ratePerDay: round1(rates[phase] * 100) / 100,
  }))

  const overallRate = totalDays > 0 ? occurrences / totalDays : 0

  // The peak is chosen among phases that actually have logged days; a phase
  // with zero exposure has a rate of 0 and cannot win, but being explicit here
  // keeps the tie-break below well-defined.
  const eligible = PHASES.filter((phase) => exposure[phase] > 0)
  const peakPhase = eligible.reduce(
    (best, phase) => (best === null || rates[phase] > rates[best] ? phase : best),
    null
  )

  const peakRate = peakPhase ? rates[peakPhase] : 0
  const lift = overallRate > 0 ? peakRate / overallRate : 0

  let suppressedBy = null
  if (totalDays < MIN_LOGGED_DAYS) suppressedBy = SUPPRESSION_REASONS.NOT_ENOUGH_DAYS
  else if (occurrences < MIN_SYMPTOM_OCCURRENCES) suppressedBy = SUPPRESSION_REASONS.NOT_ENOUGH_OCCURRENCES
  else if (phasesCovered < MIN_PHASES_COVERED) suppressedBy = SUPPRESSION_REASONS.NOT_ENOUGH_PHASES
  else if (lift < MIN_MEANINGFUL_LIFT) suppressedBy = SUPPRESSION_REASONS.NO_PATTERN

  return {
    symptom,
    displayName: toDisplayName(symptom),
    occurrences,
    distribution,
    peakPhase: suppressedBy ? null : peakPhase,
    lift: round1(lift),
    isReportable: suppressedBy === null,
    suppressedBy,
    strength: lift >= STRONG_LIFT ? 'strong' : 'moderate',
    confidence: gradeConfidence(occurrences, totalDays, phasesCovered),
    phasesCovered,
  }
}

/**
 * Analyses every symptom in the log history against the cycle phases.
 *
 * @param {Array<{date: string, symptoms?: unknown}>} dailyLogs
 * @param {Array<{start_date: string, cycle_length?: number}>} cycles
 * @param {{ fallbackCycleLength?: number, limit?: number }} [options]
 * @returns {{
 *   hasEnoughData: boolean,
 *   totalDays: number,
 *   daysNeeded: number,
 *   exposure: Record<string, number>,
 *   phasesCovered: number,
 *   symptoms: object[],
 *   reportable: object[]
 * }}
 */
export function analyseSymptomPhases(dailyLogs, cycles, options = {}) {
  const { fallbackCycleLength = 28, limit = 8 } = options

  const { days, exposure, totalDays } = attributeLogsToPhases(dailyLogs, cycles, fallbackCycleLength)
  const phasesCovered = PHASES.filter((phase) => exposure[phase] > 0).length

  // Occurrences per symptom per phase.
  const counts = new Map()
  for (const day of days) {
    for (const symptom of day.symptoms) {
      if (!counts.has(symptom)) {
        counts.set(symptom, Object.fromEntries(PHASES.map((phase) => [phase, 0])))
      }
      counts.get(symptom)[day.phase] += 1
    }
  }

  const symptoms = Array.from(counts.entries())
    .map(([symptom, perPhase]) => analyseOne({ symptom, counts: perPhase, exposure, totalDays }))
    .sort((a, b) => {
      // Reportable findings first, then by strength of the pattern, then by
      // how much evidence is behind it, then alphabetically so the order is
      // stable across renders rather than dependent on Map insertion order.
      if (a.isReportable !== b.isReportable) return a.isReportable ? -1 : 1
      if (b.lift !== a.lift) return b.lift - a.lift
      if (b.occurrences !== a.occurrences) return b.occurrences - a.occurrences
      return a.symptom.localeCompare(b.symptom)
    })
    .slice(0, limit)

  return {
    hasEnoughData: totalDays >= MIN_LOGGED_DAYS && phasesCovered >= MIN_PHASES_COVERED,
    totalDays,
    daysNeeded: Math.max(0, MIN_LOGGED_DAYS - totalDays),
    exposure,
    phasesCovered,
    symptoms,
    reportable: symptoms.filter((entry) => entry.isReportable),
  }
}

/**
 * A one-line, non-clinical summary of a reported pattern.
 *
 * Phrased as an observation about the user's *logs*, never as a claim about
 * their body: this is a tracker noticing a correlation in self-reported data,
 * not a diagnosis, and the wording has to keep that distinction visible.
 *
 * @param {object} entry a reportable result from {@link analyseSymptomPhases}
 * @param {(key: string) => string} [translatePhase] maps a phase key to a label
 * @returns {string}
 */
export function describePattern(entry, translatePhase = (key) => key) {
  if (!entry || !entry.isReportable || !entry.peakPhase) return ''

  const phase = translatePhase(entry.peakPhase)
  const times = entry.lift >= 2 ? `${entry.lift}×` : `${Math.round((entry.lift - 1) * 100)}%`
  const comparison = entry.lift >= 2 ? `${times} more often` : `${times} more often`

  return `You logged ${entry.displayName} ${comparison} during your ${phase} phase than across the rest of your cycle.`
}
