// Helper function to calculate next period date
export function predictNextPeriod(cycleHistory) {
  if (!cycleHistory || cycleHistory.length === 0) {
    return {
      nextPeriodDate: 'May 1, 2026',
      confidence: '85%',
      averageCycleLength: 28
    }
  }

  // Sort chronologically (oldest → newest)
  const sorted = [...cycleHistory].sort((a, b) =>
    new Date(a.start_date) - new Date(b.start_date)
  )

  // Deduplicate: keep only one cycle per 20-day window to avoid near-duplicate
  // entries (e.g., caused by re-seeding on top of existing data)
  const deduped = [sorted[0]]
  for (let i = 1; i < sorted.length; i++) {
    const prev = new Date(deduped[deduped.length - 1].start_date)
    const curr = new Date(sorted[i].start_date)
    const gapDays = Math.round((curr - prev) / 86400000)
    if (gapDays >= 20) deduped.push(sorted[i])
  }

  // Need at least 2 data points to calculate a meaningful average
  if (deduped.length < 2) {
    const lastPeriod = new Date(deduped[0].start_date)
    const avgLen = deduped[0].cycle_length || 28
    const nextPeriod = new Date(lastPeriod)
    nextPeriod.setDate(nextPeriod.getDate() + avgLen)
    const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
    return {
      nextPeriodDate: `${months[nextPeriod.getMonth()]} ${nextPeriod.getDate()}, ${nextPeriod.getFullYear()}`,
      confidence: '75%',
      averageCycleLength: avgLen
    }
  }

  // Calculate average cycle length from deduplicated gaps
  let totalLength = 0
  for (let i = 1; i < deduped.length; i++) {
    const prevDate = new Date(deduped[i - 1].start_date)
    const currDate = new Date(deduped[i].start_date)
    totalLength += Math.round((currDate - prevDate) / 86400000)
  }

  // Also factor in explicit cycle_length values where available
  const explicitLengths = deduped
    .filter(c => c.cycle_length && c.cycle_length >= 20 && c.cycle_length <= 45)
    .map(c => c.cycle_length)

  let avgLength
  if (explicitLengths.length >= 2) {
    // Blend: 60% from explicit lengths, 40% from gap calculation
    const explicitAvg = explicitLengths.reduce((a, b) => a + b, 0) / explicitLengths.length
    const gapAvg = Math.round(totalLength / (deduped.length - 1))
    avgLength = Math.round(explicitAvg * 0.6 + gapAvg * 0.4)
  } else {
    avgLength = Math.round(totalLength / (deduped.length - 1))
  }

  // Clamp to realistic range
  avgLength = Math.max(21, Math.min(45, avgLength || 28))

  // Predict from the most recent cycle
  const lastPeriod = new Date(deduped[deduped.length - 1].start_date)
  const nextPeriod  = new Date(lastPeriod)
  nextPeriod.setDate(nextPeriod.getDate() + avgLength)

  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
  const formattedDate = `${months[nextPeriod.getMonth()]} ${nextPeriod.getDate()}, ${nextPeriod.getFullYear()}`

  // Confidence based on regularity of deduped cycles
  let variance = 0
  for (let i = 1; i < deduped.length; i++) {
    const gap = Math.round((new Date(deduped[i].start_date) - new Date(deduped[i-1].start_date)) / 86400000)
    variance += Math.abs(gap - avgLength)
  }
  const avgVariance = variance / (deduped.length - 1)
  const confidence  = Math.max(60, Math.min(95, 95 - avgVariance * 2))

  return {
    nextPeriodDate:    formattedDate,
    confidence:        `${Math.round(confidence)}%`,
    averageCycleLength: avgLength
  }
}


// Helper function to calculate PCOD risk (mock ML model)
export function calculatePCODRisk(cycleHistory, symptoms) {
  if (!cycleHistory || cycleHistory.length === 0) {
    return { score: 0, tier: 'LOW RISK', factors: [] }
  }

  let riskScore = 0
  let riskFactors = []
  
  // Factor 1: Cycle irregularity
  if (cycleHistory.length >= 3) {
    let cycleLengths = []
    for (let i = 1; i < cycleHistory.length; i++) {
      const prevDate = new Date(cycleHistory[i - 1].start_date)
      const currDate = new Date(cycleHistory[i].start_date)
      const diff = Math.floor(Math.abs(currDate - prevDate) / (1000 * 60 * 60 * 24))
      cycleLengths.push(diff)
    }
    
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
  
  // Factor 2: Symptoms analysis
  if (symptoms) {
    const highRiskSymptoms = ['acne', 'fatigue', 'bloating', 'headache']
    const matchedSymptoms = symptoms.filter(s => 
      highRiskSymptoms.includes(s.toLowerCase())
    ).length
    
    if (matchedSymptoms >= 3) {
      riskScore += 25
      riskFactors.push('Multiple PCOD-related symptoms reported')
    } else if (matchedSymptoms >= 2) {
      riskScore += 15
      riskFactors.push('Some hormonal symptoms present')
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
