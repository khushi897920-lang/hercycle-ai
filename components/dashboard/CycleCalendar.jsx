'use client'

import { useTranslations, useLocale } from 'next-intl'
import { useRef, useState } from 'react'
/**
 * @typedef {object} CalendarDayItem
 * @property {'header'|'empty'|'normal'|'period'|'ovulation'|'predicted'|'today'} type
 * @property {string|number} label
 * @property {boolean} [isToday]
 * @property {string} [iso]
 */

/**
 * @typedef {object} CycleCalendarProps
 * @property {CalendarDayItem[]} [calendarDays] Pre-built calendar day cells
 * @property {Set<string>} [periodDays] Set of ISO dates for menstrual period days
 * @property {Set<string>} [ovulationDays] Set of ISO dates for fertile window days
 * @property {Set<string>} [predictedDays] Set of ISO dates for predicted future cycle days
 * @property {string} [today] Current ISO date (YYYY-MM-DD)
 * @property {number} [viewYear] Currently displayed calendar year
 * @property {number} [viewMonth] Currently displayed calendar month index (0-11)
 * @property {string} [currentMonth] Human-readable current month title
 * @property {() => void} [onPrevMonth] Handler for previous month button
 * @property {() => void} [onNextMonth] Handler for next month button
 * @property {number} [averageCycleLength] Average cycle duration in days
 * @property {number|null} [daysUntilNext] Days remaining until the next predicted cycle
 * @property {(isoDate: string) => void} [onDayClick] Callback when clicking a date cell
 * @property {string|null} [selectedDate] Currently active ISO date
 */

/**
 * CycleCalendar renders a monthly grid with period, ovulation, predicted, and today markers.
 * @param {CycleCalendarProps} props
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
  currentMonth = '',
  onPrevMonth = () => {},
  onNextMonth = () => {},
  onToday = () => {},
  averageCycleLength = 28,
  daysUntilNext = null,
  onDayClick = () => {},
  selectedDate = null
}) {
  const t = useTranslations('cycle')
  const locale = useLocale()
  const cellRefs = useRef([])
  const [focusedIndex, setFocusedIndex] = useState(null)
  const COLS = 7
  // Build calendar from explicit Sets if Mode B props are provided
  let calendarDays = calendarDaysProp
  if (!calendarDays && viewYear != null && viewMonth != null) {
    const firstDay = new Date(viewYear, viewMonth, 1).getDay()
    const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate()
    const daysInPrevMonth = new Date(viewYear, viewMonth, 0).getDate()
    const days = []

    const weekDays = locale === 'hi' ? ['र', 'सो', 'मं', 'बु', 'गु', 'शु', 'श'] : ['S', 'M', 'T', 'W', 'T', 'F', 'S']
    weekDays.forEach(h => days.push({ type: 'header', label: h }))

    for (let i = firstDay - 1; i >= 0; i--) {
      days.push({ type: 'empty', label: daysInPrevMonth - i })
    }
    for (let i = 1; i <= daysInMonth; i++) {
      const iso = `${viewYear}-${String(viewMonth + 1).padStart(2, '0')}-${String(i).padStart(2, '0')}`
      const isToday = iso === todayStr
      let type = 'normal'
      if (periodDays?.has(iso)) type = 'period'
      else if (predictedDays?.has(iso)) type = 'predicted'
      else if (ovulationDays?.has(iso)) type = 'ovulation'
      if (isToday && type === 'normal') type = 'today'
      days.push({ type, label: i, isToday, iso })
    }
    calendarDays = days
  }

  const defaultFocusIndex = calendarDays.findIndex(d => d.type === 'today')
  const initialFocusIndex = defaultFocusIndex !== -1
    ? defaultFocusIndex
    : calendarDays.findIndex(d => d.type !== 'header' && d.type !== 'empty')

  const handleCellKeyDown = (e, index) => {
    const day = calendarDays[index]
    const isClickable = day.type !== 'header' && day.type !== 'empty'
    if (!isClickable) return

    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      if (onDayClick && day.iso) onDayClick(day.iso)
      return
    }

    let nextIndex
    if (e.key === 'ArrowRight') nextIndex = index + 1
    else if (e.key === 'ArrowLeft') nextIndex = index - 1
    else if (e.key === 'ArrowDown') nextIndex = index + COLS
    else if (e.key === 'ArrowUp') nextIndex = index - COLS
    else return

    e.preventDefault()

    const step = nextIndex > index ? 1 : -1
    while (
      nextIndex >= 0 &&
      nextIndex < calendarDays.length &&
      (calendarDays[nextIndex].type === 'header' || calendarDays[nextIndex].type === 'empty')
    ) {
      nextIndex += step
    }

    if (nextIndex >= 0 && nextIndex < calendarDays.length) {
      setFocusedIndex(nextIndex)
      cellRefs.current[nextIndex]?.focus()
    }
  }

  return (
    <div className="cycle-card glass">
      <div className="cycle-card-header">
        <h3>{currentMonth}</h3>
        <div className="month-nav">
          <button onClick={onToday} aria-label="Today">Today</button>
          <button onClick={onPrevMonth} aria-label="Previous month">�</button>
          <button onClick={onNextMonth} aria-label="Next month">�</button>
        </div>
      </div>

      <div className="mini-cal" role="grid">
        {(calendarDays || []).map((day, i) => {
          const isClickable = day.type !== 'header' && day.type !== 'empty';
          const isSelected = Boolean(selectedDate && day.iso === selectedDate);
          return (
            <div
              key={i}
              ref={(el) => (cellRefs.current[i] = el)}
              role={isClickable ? 'gridcell' : undefined}
              tabIndex={isClickable ? (i === (focusedIndex ?? initialFocusIndex) ? 0 : -1) : undefined}
              onKeyDown={(e) => handleCellKeyDown(e, i)}
              onFocus={() => isClickable && setFocusedIndex(i)}
              className={[
                'cal-d',
                day.type === 'header' ? 'header' : '',
                day.type === 'empty' ? 'empty' : '',
                day.type === 'period' ? 'period' : '',
                day.type === 'predicted' ? 'predicted' : '',
                day.type === 'ovulation' ? 'ovulation' : '',
                day.type === 'today' ? 'today' : '',
                day.isToday && day.type !== 'today' ? 'today-ring' : '',
                isSelected ? 'selected-day' : '',
              ].join(' ').trim()}
              onClick={(e) => {
                if (isClickable && onDayClick && day.iso) {
                  e.stopPropagation();
                  onDayClick(day.iso);
                }
              }}
              style={{
                cursor: isClickable ? 'pointer' : 'default'
              }}
              title={isClickable ? `Click to log or edit ${day.iso}` : undefined}
              data-date={day.iso}
            >
              {day.label}
            </div>
          )
        })}
      </div>

      <div className="cal-legend">
        <div className="legend-item">
          <div className="legend-dot" style={{ background: 'linear-gradient(135deg, rgba(232,82,126,0.35), rgba(157,63,122,0.30))' }}></div>
          <span>{t('period')}</span>
        </div>
        <div className="legend-item">
          <div className="legend-dot" style={{ background: 'rgba(232,82,126,0.15)', border: '1.5px dashed rgba(232,82,126,0.5)' }}></div>
          <span>{t('predicted')}</span>
        </div>
        <div className="legend-item">
          <div className="legend-dot" style={{ background: 'rgba(110,231,183,0.20)', border: '1px solid rgba(110,231,183,0.4)' }}></div>
          <span>{t('ovulation')}</span>
        </div>
      </div>

      <div className="stat-row">
        <div className="stat-tile">
          <label>{t('cycleLen')}</label>
          <div className="val">{averageCycleLength}<span>{t('days')}</span></div>
        </div>
        <div className="stat-tile">
          <label>{t('nextPeriod')}</label>
          <div className="val">
            {daysUntilNext !== null ? daysUntilNext : '—'}
            <span>{daysUntilNext !== null ? t('days') : ''}</span>
          </div>
        </div>
      </div>
    </div>
  )
}




