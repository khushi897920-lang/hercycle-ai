import { t } from '@/lib/i18n'

/**
 * CycleCalendar — renders a monthly grid with period/ovulation/predicted/today markers.
 *
 * Props (two modes, both supported):
 *  MODE A — pre-built array (current):
 *    calendarDays: Array<{ type: 'header'|'empty'|'normal'|'period'|'ovulation'|'predicted'|'today', label, isToday? }>
 *
 *  MODE B — explicit date Sets (new, as requested):
 *    periodDays:    Set<'YYYY-MM-DD'>
 *    ovulationDays: Set<'YYYY-MM-DD'>
 *    predictedDays: Set<'YYYY-MM-DD'>
 *    today:         'YYYY-MM-DD'
 *    viewYear:      number
 *    viewMonth:     number   (0-indexed)
 *
 *  Shared props:
 *    currentMonth, onPrevMonth, onNextMonth, averageCycleLength, daysUntilNext, activeLang
 */
export default function CycleCalendar({
  // Mode A
  calendarDays: calendarDaysProp,
  // Mode B
  periodDays,
  ovulationDays,
  predictedDays,
  today: todayStr,
  viewYear,
  viewMonth,
  // Shared
  currentMonth,
  onPrevMonth,
  onNextMonth,
  averageCycleLength,
  daysUntilNext,
  activeLang,
}) {
  // Build calendar from explicit Sets if Mode B props are provided
  let calendarDays = calendarDaysProp
  if (!calendarDays && viewYear != null && viewMonth != null) {
    const firstDay        = new Date(viewYear, viewMonth, 1).getDay()
    const daysInMonth     = new Date(viewYear, viewMonth + 1, 0).getDate()
    const daysInPrevMonth = new Date(viewYear, viewMonth, 0).getDate()
    const days = []
    ;['S','M','T','W','T','F','S'].forEach(h => days.push({ type: 'header', label: h }))
    for (let i = firstDay - 1; i >= 0; i--) {
      days.push({ type: 'empty', label: daysInPrevMonth - i })
    }
    for (let i = 1; i <= daysInMonth; i++) {
      const iso = `${viewYear}-${String(viewMonth + 1).padStart(2,'0')}-${String(i).padStart(2,'0')}`
      const isToday = iso === todayStr
      let type = 'normal'
      if (periodDays?.has(iso))                 type = 'period'
      else if (predictedDays?.has(iso))         type = 'predicted'
      else if (ovulationDays?.has(iso))         type = 'ovulation'
      if (isToday && type === 'normal')         type = 'today'
      days.push({ type, label: i, isToday })
    }
    calendarDays = days
  }

  return (
    <div className="cycle-card glass">
      <div className="cycle-card-header">
        <h3>{currentMonth}</h3>
        <div className="month-nav">
          <button onClick={onPrevMonth} aria-label="Previous month">‹</button>
          <button onClick={onNextMonth} aria-label="Next month">›</button>
        </div>
      </div>

      <div className="mini-cal">
        {(calendarDays || []).map((day, i) => (
          <div
            key={i}
            className={[
              'cal-d',
              day.type === 'header'    ? 'header'    : '',
              day.type === 'empty'     ? 'empty'     : '',
              day.type === 'period'    ? 'period'    : '',
              day.type === 'predicted' ? 'predicted' : '',
              day.type === 'ovulation' ? 'ovulation' : '',
              day.type === 'today'     ? 'today'     : '',
              day.isToday && day.type !== 'today' ? 'today-ring' : '',
            ].join(' ').trim()}
          >
            {day.label}
          </div>
        ))}
      </div>

      <div className="cal-legend">
        <div className="legend-item">
          <div className="legend-dot" style={{ background: 'linear-gradient(135deg, rgba(232,82,126,0.35), rgba(157,63,122,0.30))' }}></div>
          <span>{t(activeLang, 'cycle', 'period')}</span>
        </div>
        <div className="legend-item">
          <div className="legend-dot" style={{ background: 'rgba(232,82,126,0.15)', border: '1.5px dashed rgba(232,82,126,0.5)' }}></div>
          <span>{t(activeLang, 'cycle', 'predicted')}</span>
        </div>
        <div className="legend-item">
          <div className="legend-dot" style={{ background: 'rgba(110,231,183,0.20)', border: '1px solid rgba(110,231,183,0.4)' }}></div>
          <span>{t(activeLang, 'cycle', 'ovulation')}</span>
        </div>
      </div>

      <div className="stat-row">
        <div className="stat-tile">
          <label>{t(activeLang, 'cycle', 'cycleLen')}</label>
          <div className="val">{averageCycleLength}<span>{t(activeLang, 'cycle', 'days')}</span></div>
        </div>
        <div className="stat-tile">
          <label>{t(activeLang, 'cycle', 'nextPeriod')}</label>
          <div className="val">
            {daysUntilNext !== null ? daysUntilNext : '—'}
            <span>{daysUntilNext !== null ? t(activeLang, 'cycle', 'days') : ''}</span>
          </div>
        </div>
      </div>
    </div>
  )
}
