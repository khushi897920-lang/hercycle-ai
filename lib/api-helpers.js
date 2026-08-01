import { addDays, compareDates, diffInDays, formatDisplayDate, getTodayISO, parseDateValue } from './date-utils.js'

// A history this far behind cannot support a meaningful projection: past this
// point the app is guessing, and prolonged amenorrhea is itself a PCOD signal
// worth surfacing rather than papering over with a confident-looking date.
const MAX_MEANINGFUL_MISSED_CYCLES = 3

// Confidence lost per missed cycle. Combined with the floor below, three or more
// missed cycles can never report a high-confidence prediction.
const CONFIDENCE_PENALTY_PER_MISSED_CYCLE = 12

// Confidence never drops below this while a date is still being shown.
const MIN_STALE_CONFIDENCE = 20

/**
 * Projects `startDate` forward by whole `cycleLength`-day cycles until the
 * result is on or after today.
 *
 * predictNextPeriod used to advance by exactly ONE cycle, unconditionally. Since
 * `avgLength` is clamped to [21, 45], a single hop can never cover a gap of more
 * than 45 days — so a user who stopped logging two months ago was shown a "next
 * period" months in the past.
 *
 * @param {Date} startDate the last logged period start
 * @param {number} cycleLength days per cycle
 * @param {Date} today
 * @returns {{ nextPeriod: Date, missedCycles: number }} missedCycles counts the
 *   extra cycles skipped to reach the future (0 for fresh history)
 */
function projectForward(startDate, cycleLength, today) {
  const safeLength = Math.max(1, Math.round(cycleLength) || 28)
  const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate())

  const firstProjection = new Date(startDate)
  firstProjection.setDate(firstProjection.getDate() + safeLength)

  // Compute the number of extra cycles arithmetically rather than by looping,
  // so a start date decades in the past is handled in constant time and there
  // is no iteration bound to get wrong.
  //
  // Both operands are projected onto a UTC grid *after* their local calendar day
  // has been taken, so a DST transition inside the span cannot shift the count.
  const projectionUTC = Date.UTC(
    firstProjection.getFullYear(), firstProjection.getMonth(), firstProjection.getDate()
  )
  const todayUTC = Date.UTC(todayStart.getFullYear(), todayStart.getMonth(), todayStart.getDate())

  const daysBehind = Math.round((todayUTC - projectionUTC) / 86400000)
  const missedCycles = daysBehind > 0 ? Math.ceil(daysBehind / safeLength) : 0

  const nextPeriod = new Date(firstProjection)
  if (missedCycles > 0) {
    nextPeriod.setDate(nextPeriod.getDate() + missedCycles * safeLength)
  }

  return { nextPeriod, missedCycles }
}

/**
 * Applies the staleness penalty to a variance-derived confidence.
 *
 * Confidence used to be a pure function of gap *regularity*, never referencing
 * today — so a perfectly regular but five-month-old history reported 95%.
 *
 * @param {number} baseConfidence 0-100, from gap variance
 * @param {number} missedCycles
 * @returns {number} 0-100
 */
function applyStalenessPenalty(baseConfidence, missedCycles) {
  if (missedCycles <= 0) return baseConfidence
  const penalised = baseConfidence - missedCycles * CONFIDENCE_PENALTY_PER_MISSED_CYCLE
  return Math.max(MIN_STALE_CONFIDENCE, Math.round(penalised))
}

// Shared helper: removes duplicate/near-duplicate cycle entries
// (entries less than 20 days apart are treated as the same period)
//
// Every date value here is routed through lib/date-utils so a `YYYY-MM-DD`
// column is read as that calendar day in the user's timezone.
// `new Date('2026-07-21')` parses as UTC *midnight*, so reading it back with the
// local accessors shifted every gap and every rendered date by a day for users
// west of UTC.
function dedupeCycles(cycleHistory) {
  if (!cycleHistory || cycleHistory.length === 0) return []

  const validHistory = cycleHistory.filter(c => Boolean(c) && parseDateValue(c.start_date) !== null)

  if (validHistory.length === 0) return []

  const sorted = [...validHistory].sort((a, b) => compareDates(a.start_date, b.start_date))

  const deduped = [sorted[0]]
  for (let i = 1; i < sorted.length; i++) {
    const gapDays = diffInDays(deduped[deduped.length - 1].start_date, sorted[i].start_date)
    if (gapDays !== null && gapDays >= 20) deduped.push(sorted[i])
  }
  return deduped
}

// Shared shape for the "we have no usable history" answer, so the two callers
// below cannot drift apart.
function unknownPrediction() {
  return {
    nextPeriodDate: formatDisplayDate(addDays(getTodayISO(), 28)),
    confidence: '0%',
    averageCycleLength: 28
  }
}

// Helper: compute the median of a numeric array (assumes length >= 1)
function median(arr) {
  const sorted = [...arr].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  return sorted.length % 2 !== 0
    ? sorted[mid]
    : (sorted[mid - 1] + sorted[mid]) / 2
}

// Helper: filter outliers that deviate > 2.5 standard deviations from the median.
// Returns the filtered array, or the original if filtering would leave < minKeep items.
function filterOutliers(values, minKeep = 2) {
  if (values.length < 3) return values // need at least 3 to meaningfully detect outliers

  const med = median(values)
  const mean = values.reduce((a, b) => a + b, 0) / values.length
  const variance = values.reduce((sum, v) => sum + Math.pow(v - mean, 2), 0) / values.length
  const stdDev = Math.sqrt(variance)

  if (stdDev === 0) return values // all identical — nothing to filter

  const filtered = values.filter(v => Math.abs(v - med) <= 2.5 * stdDev)
  return filtered.length >= minKeep ? filtered : values
}

/**
 * Predicts the next period start date.
 *
 * @param {Array} cycleHistory rows from the `cycles` table
 * @param {Date} [today] injectable clock, so the staleness logic is testable
 * @returns {{
 *   nextPeriodDate: string,
 *   confidence: string,
 *   averageCycleLength: number,
 *   missedCycles?: number,
 *   isStale?: boolean,
 *   hasEnoughRecentData?: boolean,
 *   lastLoggedDate?: string
 * }} The first three fields are unchanged, so the three existing call sites
 *   (/api/predict-cycle, the offline client, and the PDF report) keep working.
 */
export function predictNextPeriod(cycleHistory, today = new Date()) {
  if (!cycleHistory || cycleHistory.length === 0) {
    return unknownPrediction()
  }

  const deduped = dedupeCycles(cycleHistory)

  if (deduped.length === 0) {
    return unknownPrediction()
  }

  // Need at least 2 data points to calculate a meaningful average
  if (deduped.length < 2) {
    let avgLen = parseInt(deduped[0].cycle_length, 10)
    if (isNaN(avgLen) || avgLen < 21 || avgLen > 45) {
      avgLen = 28
    }
    const { nextPeriod, missedCycles } = projectForward(lastPeriod, avgLen, today)
    const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
    return {
      nextPeriodDate: `${months[nextPeriod.getMonth()]} ${nextPeriod.getDate()}, ${nextPeriod.getFullYear()}`,
      confidence: `${applyStalenessPenalty(75, missedCycles)}%`,
      averageCycleLength: avgLen,
      missedCycles,
      isStale: missedCycles > 0,
      hasEnoughRecentData: missedCycles < MAX_MEANINGFUL_MISSED_CYCLES,
      lastLoggedDate: deduped[0].start_date
    }
  }

  // Calculate gap-based cycle lengths from deduplicated entries
  const gapLengths = []
  for (let i = 1; i < deduped.length; i++) {
    const gap = diffInDays(deduped[i - 1].start_date, deduped[i].start_date)
    if (gap !== null) gapLengths.push(gap)
  }

  // Filter outliers: remove cycle gaps that deviate > 2.5σ from the median
  const filteredGaps = filterOutliers(gapLengths)

  // Also factor in explicit cycle_length values where available
  const explicitLengths = deduped
    .filter(c => c.cycle_length && c.cycle_length >= 20 && c.cycle_length <= 45)
    .map(c => c.cycle_length)

  // Apply the same outlier filter to explicit lengths
  const filteredExplicit = filterOutliers(explicitLengths)

  let avgLength
  if (filteredExplicit.length >= 2) {
    const explicitAvg = filteredExplicit.reduce((a, b) => a + b, 0) / filteredExplicit.length
    const gapAvg = filteredGaps.reduce((a, b) => a + b, 0) / filteredGaps.length
    avgLength = Math.round(explicitAvg * 0.6 + gapAvg * 0.4)
  } else {
    avgLength = Math.round(filteredGaps.reduce((a, b) => a + b, 0) / filteredGaps.length)
  }

  avgLength = Math.max(21, Math.min(45, avgLength || 28))

  const lastLoggedStart = deduped[deduped.length - 1].start_date
  const lastPeriod = new Date(lastLoggedStart)

  // Advance by WHOLE cycles until the projection is in the future. Adding a
  // single cycle length unconditionally is what produced predictions months in
  // the past for users whose history had gone stale.
  const { nextPeriod, missedCycles } = projectForward(lastPeriod, avgLength, today)

  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
  const formattedDate = `${months[nextPeriod.getMonth()]} ${nextPeriod.getDate()}, ${nextPeriod.getFullYear()}`

  // Confidence is based on the filtered gaps (outliers excluded → more stable)
  let variance = 0
  for (let i = 0; i < filteredGaps.length; i++) {
    variance += Math.abs(filteredGaps[i] - avgLength)
  }
  const avgVariance = variance / filteredGaps.length
  const regularity  = Math.max(60, Math.min(95, 95 - avgVariance * 2))

  // Regularity alone is not confidence: a perfectly regular history that stopped
  // five months ago cannot support 95%.
  const confidence = applyStalenessPenalty(regularity, missedCycles)

  return {
    nextPeriodDate:    formattedDate,
    confidence:        `${Math.round(confidence)}%`,
    averageCycleLength: avgLength,
    missedCycles,
    isStale:           missedCycles > 0,
    hasEnoughRecentData: missedCycles < MAX_MEANINGFUL_MISSED_CYCLES,
    lastLoggedDate:    lastLoggedStart
  }
}



// Helper function to calculate PCOD risk (mock ML model)
export function calculatePCODRisk(cycleHistory, symptoms) {
  if (!cycleHistory || cycleHistory.length === 0) {
    return { score: 0, tier: 'LOW RISK', factors: [] }
  }

  const deduped = dedupeCycles(cycleHistory)

  let riskScore = 0
  let riskFactors = []

  // Factor 1: Cycle irregularity
  if (deduped.length >= 3) {
    let cycleLengths = []
    for (let i = 1; i < deduped.length; i++) {
      const diff = diffInDays(deduped[i - 1].start_date, deduped[i].start_date)
      if (diff !== null) cycleLengths.push(Math.abs(diff))
    }

    if (cycleLengths.length > 0) {
      const avgLength = cycleLengths.reduce((a, b) => a + b, 0) / cycleLengths.length
      const variance = cycleLengths.reduce((sum, len) => sum + Math.pow(len - avgLength, 2), 0) / cycleLengths.length
      const stdDev = Math.sqrt(variance)

      if (stdDev > 7) {
        riskScore += 20
        riskFactors.push('Irregular cycle patterns detected')
      }

      if (avgLength < 21 || avgLength > 35) {
        riskScore += 15
        riskFactors.push('Cycle length outside normal range')
      }
    }
  }

  // Factor 2: Symptoms analysis & recurrence mapping over 90-day window
  if (symptoms && Array.isArray(symptoms) && symptoms.length > 0) {
    const highRiskSymptoms = ['acne', 'fatigue', 'bloating', 'headache', 'hirsutism', 'weight gain', 'hair loss', 'irregular periods']

    // Normalize symptom entries with optional dates
    const entries = []
    for (const item of symptoms) {
      if (!item) continue
      if (typeof item === 'string') {
        entries.push({ name: item.trim().toLowerCase(), date: null })
      } else if (typeof item === 'object') {
        const rawDate = item.date || item.created_at || item.timestamp
        // parseDateValue pins the value to local midnight, so the month bucket
        // below cannot slip into an adjacent month for logs recorded on the 1st.
        const validDate = rawDate ? parseDateValue(rawDate) : null

        if (Array.isArray(item.symptoms)) {
          for (const s of item.symptoms) {
            if (typeof s === 'string' && s.trim()) {
              entries.push({ name: s.trim().toLowerCase(), date: validDate })
            }
          }
        } else {
          const sName = item.symptom || item.name
          if (typeof sName === 'string' && sName.trim()) {
            entries.push({ name: sName.trim().toLowerCase(), date: validDate })
          }
        }
      }
    }

    // Determine reference date for 90-day window filtering
    const datedEntries = entries.filter(e => e.date !== null)
    let validEntries = entries

    if (datedEntries.length > 0) {
      const latestTime = Math.max(...datedEntries.map(e => e.date.getTime()))
      const windowCutoff = latestTime - (90 * 24 * 60 * 60 * 1000)
      validEntries = entries.filter(e => !e.date || e.date.getTime() >= windowCutoff)
    }

    // Map frequency of high-risk symptoms
    const frequencyMap = {}
    const monthBuckets = new Set()

    for (const entry of validEntries) {
      if (highRiskSymptoms.includes(entry.name)) {
        frequencyMap[entry.name] = (frequencyMap[entry.name] || 0) + 1
        if (entry.date) {
          const monthKey = `${entry.date.getFullYear()}-${entry.date.getMonth() + 1}`
          monthBuckets.add(monthKey)
        }
      }
    }

    const matchedSymptomTypes = Object.keys(frequencyMap)
    const totalHighRiskOccurrences = Object.values(frequencyMap).reduce((a, b) => a + b, 0)
    const highlyRecurring = matchedSymptomTypes.filter(name => frequencyMap[name] >= 3)
    const recurring = matchedSymptomTypes.filter(name => frequencyMap[name] >= 2)
    const isMultiMonth = monthBuckets.size >= 2

    if (totalHighRiskOccurrences >= 5 || isMultiMonth || highlyRecurring.length > 0) {
      // High recurrence / persistent trend
      if (matchedSymptomTypes.length >= 3 && (totalHighRiskOccurrences >= 5 || isMultiMonth)) {
        riskScore += 35
        riskFactors.push('High symptom recurrence detected across 90-day window')
      } else if (matchedSymptomTypes.length >= 2) {
        riskScore += 25
        riskFactors.push('Persistent recurrence of PCOD-related symptoms over 90 days')
      } else {
        riskScore += 20
        riskFactors.push(`Recurring PCOD symptom pattern detected (${recurring.join(', ') || matchedSymptomTypes.join(', ')})`)
      }
    } else if (matchedSymptomTypes.length >= 3) {
      riskScore += 25
      riskFactors.push('Multiple PCOD-related symptoms reported')
    } else if (matchedSymptomTypes.length >= 2 || totalHighRiskOccurrences >= 2) {
      riskScore += 15
      riskFactors.push('Some hormonal symptoms present')
    } else if (matchedSymptomTypes.length === 1) {
      riskScore += 10
      riskFactors.push('Mild hormonal symptom noted')
    }
  }

  let tier = 'LOW RISK'
  if (riskScore >= 60) {
    tier = 'HIGH RISK'
  } else if (riskScore >= 35) {
    tier = 'MEDIUM RISK'
  }

  if (riskScore < 35 && riskFactors.length === 0) {
    riskFactors = [
      'Regular cycle length maintained',
      'No significant hormonal symptoms'
    ]
  }

  return {
    score: Math.min(riskScore, 85),
    tier,
    factors: riskFactors,
    recommendation: tier === 'HIGH RISK'
      ? 'Consider consulting with a healthcare provider for detailed assessment.'
      : 'Keep tracking your cycle and maintaining healthy habits.'
  }
}
