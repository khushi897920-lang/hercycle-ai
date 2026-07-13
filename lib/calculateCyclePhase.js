const DAY_IN_MS = 24 * 60 * 60 * 1000

function toLocalDateOnly(value) {
  if (!value) return null
  const date = new Date(`${String(value).slice(0, 10)}T00:00:00`)
  if (Number.isNaN(date.getTime())) return null
  date.setHours(0, 0, 0, 0)
  return date
}

export function calculateCyclePhase({
  periodStart,
  cycleLength = 28,
  periodLength = 5,
  today = new Date(),
}) {
  const start = toLocalDateOnly(periodStart)
  if (!start) {
    return {
      phaseKey: null,
      cycleDay: null,
      ovulationDay: null,
      hasData: false,
      reason: 'missing-period-start',
    }
  }

  const current = new Date(today)
  current.setHours(0, 0, 0, 0)
  const cycleDay = Math.floor((current.getTime() - start.getTime()) / DAY_IN_MS) + 1

  if (cycleDay < 1) {
    return {
      phaseKey: null,
      cycleDay,
      ovulationDay: null,
      hasData: false,
      reason: 'future-period-start',
    }
  }

  const safeCycleLength = Number.isFinite(Number(cycleLength))
    ? Math.min(60, Math.max(21, Math.round(Number(cycleLength))))
    : 28

  const safePeriodLength = Number.isFinite(Number(periodLength))
    ? Math.min(10, Math.max(1, Math.round(Number(periodLength))))
    : 5

  const ovulationDay = Math.max(safePeriodLength + 2, safeCycleLength - 14)
  const ovulationWindowStart = Math.max(safePeriodLength + 1, ovulationDay - 1)
  const ovulationWindowEnd = Math.min(safeCycleLength, ovulationDay + 1)

  let phaseKey = 'irregular'
  if (cycleDay <= safePeriodLength) phaseKey = 'menstrual'
  else if (cycleDay < ovulationWindowStart) phaseKey = 'follicular'
  else if (cycleDay <= ovulationWindowEnd) phaseKey = 'ovulation'
  else if (cycleDay <= safeCycleLength) phaseKey = 'luteal'

  return {
    phaseKey,
    cycleDay,
    ovulationDay,
    cycleLength: safeCycleLength,
    periodLength: safePeriodLength,
    hasData: true,
    reason: null,
  }
}

export function getLatestCycle(cycles = []) {
  return [...cycles]
    .filter(cycle => cycle?.start_date || cycle?.period_start)
    .sort((a, b) => {
      const aTime = new Date(a.start_date || a.period_start).getTime()
      const bTime = new Date(b.start_date || b.period_start).getTime()
      return bTime - aTime
    })[0] || null
}
