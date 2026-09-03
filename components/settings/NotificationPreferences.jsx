'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { Droplets, Clock, Save, ChevronDown, Check } from 'lucide-react'
import { useTranslations } from 'next-intl'
import toast from 'react-hot-toast'
import {
  sendDeviceNotification,
  getNotificationPermissionStatus,
} from '@/lib/utils/notifications'
import { getTodayISO } from '@/lib/date-utils'
import { clampNumber, readDailyRecord } from '@/lib/daily-storage'

// ─── Constants ───────────────────────────────────────────────────────────────

const STORAGE_KEY = 'hercycle_hydration_schedule'
const WATER_KEY = 'hercycle_water_intake'
const DAILY_TARGET = 8 // must match HydrationTracker.jsx

const REPEAT_OPTIONS = [
  { label: '30 min', minutes: 30 },
  { label: '1 hour', minutes: 60 },
  { label: '2 hours', minutes: 120 },
  { label: '3 hours', minutes: 180 },
  { label: '4 hours', minutes: 240 },
]

const DEFAULT_SCHEDULE = {
  enabled: false,
  startTime: '08:00',
  endTime: '22:00',
  repeatMinutes: 60,
  skipIfGoalReached: true,
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Convert "HH:MM" string to total minutes since midnight */
function timeToMinutes(timeStr) {
  const [h, m] = timeStr.split(':').map(Number)
  return h * 60 + m
}

/** Convert "HH:MM" 24h string to "HH:MM AM/PM" display format */
function formatTimeDisplay(timeStr) {
  const [h, m] = timeStr.split(':').map(Number)
  const period = h < 12 ? 'AM' : 'PM'
  const hour12 = h === 0 ? 12 : h > 12 ? h - 12 : h
  return `${String(hour12).padStart(2, '0')}:${String(m).padStart(2, '0')} ${period}`
}

/** Generate 30-minute slot options from 00:00 to 23:30 */
function generateTimeOptions() {
  const options = []
  for (let h = 0; h < 24; h++) {
    for (let m = 0; m < 60; m += 30) {
      const value = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
      options.push({ value, label: formatTimeDisplay(value) })
    }
  }
  return options
}

const TIME_OPTIONS = generateTimeOptions()

/** Calculate estimated reminders between startTime and endTime for a given interval */
function calcEstimatedReminders(startTime, endTime, repeatMinutes) {
  const start = timeToMinutes(startTime)
  const end = timeToMinutes(endTime)
  if (end <= start || repeatMinutes <= 0) return 0
  return Math.max(0, Math.floor((end - start) / repeatMinutes))
}

/** Read today's water count from localStorage */
function getTodayWaterCount() {
  const { value } = readDailyRecord(WATER_KEY, {
    sanitize: (stored) => clampNumber(stored.count, { min: 0, max: 99, fallback: 0, integer: true }),
    fallback: () => 0,
    onNewDay: () => 0,
    today: getTodayISO(),
  })

  return value
}

/** Read today's target cup count dynamically from hydration settings */
function getTodayWaterTarget() {
  try {
    const raw = localStorage.getItem('hercycle_hydration_settings')
    if (raw) {
      const parsed = JSON.parse(raw)
      const goal = Number(parsed.dailyGoal) || 2000
      const capacity = Number(parsed.cupCapacity) || 250
      return Math.max(1, Math.round(goal / capacity))
    }
  } catch (_) {}
  return DAILY_TARGET
}

// ─── DarkSelect — custom dropdown (native <select> ignores option colors on ──
//     Windows Chrome/Edge, so we use a div-based listbox for full theming)   ──

/**
 * @param {{ id: string, value: string|number, options: {value:string|number, label:string}[], onChange: (v:string|number)=>void }} props
 */
function DarkSelect({ id, value, options, onChange }) {
  const [open, setOpen] = useState(false)
  const containerRef = useRef(null)
  const listRef = useRef(null)

  const selectedOption = options.find((o) => String(o.value) === String(value))

  // Close on outside click
  useEffect(() => {
    if (!open) return
    function handleOutside(e) {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handleOutside)
    return () => document.removeEventListener('mousedown', handleOutside)
  }, [open])

  // Scroll selected option into view when list opens
  useEffect(() => {
    if (!open || !listRef.current) return
    const selected = listRef.current.querySelector('[data-selected="true"]')
    if (selected) selected.scrollIntoView({ block: 'nearest' })
  }, [open])

  // Keyboard navigation
  function handleKeyDown(e) {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      setOpen((o) => !o)
    } else if (e.key === 'Escape') {
      setOpen(false)
    } else if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault()
      const idx = options.findIndex((o) => String(o.value) === String(value))
      const next =
        e.key === 'ArrowDown'
          ? Math.min(idx + 1, options.length - 1)
          : Math.max(idx - 1, 0)
      onChange(options[next].value)
    }
  }

  return (
    <div ref={containerRef} className="relative min-w-[140px]" id={id}>
      {/* Trigger button */}
      <button
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        onKeyDown={handleKeyDown}
        className="flex items-center justify-between gap-2 w-full text-sm bg-slate-800 border border-white/10 text-white rounded-xl px-3 py-1.5 cursor-pointer focus:outline-none focus:ring-1 focus:ring-blue-400 hover:bg-slate-700/80 transition-colors"
      >
        <span>{selectedOption?.label ?? '—'}</span>
        <ChevronDown
          className={`w-3.5 h-3.5 text-slate-400 shrink-0 transition-transform duration-150 ${open ? 'rotate-180' : ''}`}
        />
      </button>

      {/* Dropdown list */}
      {open && (
        <ul
          ref={listRef}
          role="listbox"
          className="absolute z-50 right-0 mt-1.5 w-full max-h-52 overflow-y-auto rounded-xl bg-slate-800 border border-white/10 shadow-2xl py-1 scrollbar-thin"
          style={{ scrollbarWidth: 'thin', scrollbarColor: '#334155 transparent' }}
        >
          {options.map((opt) => {
            const isSelected = String(opt.value) === String(value)
            return (
              <li
                key={opt.value}
                role="option"
                aria-selected={isSelected}
                data-selected={isSelected}
                onClick={() => {
                  onChange(opt.value)
                  setOpen(false)
                }}
                className={`flex items-center justify-between px-3 py-2 text-sm cursor-pointer transition-colors ${
                  isSelected
                    ? 'bg-blue-600/30 text-blue-200 font-medium'
                    : 'text-slate-200 hover:bg-slate-700/70'
                }`}
              >
                <span>{opt.label}</span>
                {isSelected && <Check className="w-3.5 h-3.5 text-blue-400 shrink-0" />}
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function NotificationPreferences() {
  const t = useTranslations('HydrationReminder')

  const [schedule, setSchedule] = useState(DEFAULT_SCHEDULE)
  const [saved, setSaved] = useState(DEFAULT_SCHEDULE)
  const lastFiredRef = useRef(null) // timestamp (ms) of last notification sent

  // Load persisted schedule on mount
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY)
      if (raw) {
        const parsed = { ...DEFAULT_SCHEDULE, ...JSON.parse(raw) }
        setSchedule(parsed)
        setSaved(parsed)
      }
    } catch (_) {}
  }, [])

  // ── Scheduling interval ────────────────────────────────────────────────────
  const checkAndNotify = useCallback(() => {
    // Must be enabled
    if (!saved.enabled) return

    // Must have notification permission
    if (getNotificationPermissionStatus() !== 'granted') return

    const now = new Date()
    const currentMinutes = now.getHours() * 60 + now.getMinutes()
    const startMinutes = timeToMinutes(saved.startTime)
    const endMinutes = timeToMinutes(saved.endTime)

    // Must be within the active window
    if (currentMinutes < startMinutes || currentMinutes >= endMinutes) return

    // Must be at least repeatMinutes since last notification
    const nowMs = now.getTime()
    if (
      lastFiredRef.current !== null &&
      nowMs - lastFiredRef.current < saved.repeatMinutes * 60 * 1000
    ) {
      return
    }

    // Skip if goal already reached
    if (saved.skipIfGoalReached && getTodayWaterCount() >= getTodayWaterTarget()) return

    // Fire notification
    lastFiredRef.current = nowMs
    sendDeviceNotification(
      t('notificationTitle') || '💧 Hydration Reminder',
      t('notificationBody') || 'Time to drink water! Stay hydrated and feel your best. 🌸',
      '/self-care'
    )
  }, [saved, t])

  useEffect(() => {
    const interval = setInterval(checkAndNotify, 60 * 1000) // check every minute
    return () => clearInterval(interval)
  }, [checkAndNotify])

  // ── Derived state ──────────────────────────────────────────────────────────
  const estimated = calcEstimatedReminders(
    schedule.startTime,
    schedule.endTime,
    schedule.repeatMinutes
  )

  // ── Handlers ───────────────────────────────────────────────────────────────
  const handleChange = (field, value) => {
    setSchedule((prev) => ({ ...prev, [field]: value }))
  }

  const handleSave = () => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(schedule))
      setSaved(schedule)
      lastFiredRef.current = null // reset so next check can fire immediately if due
      toast.success(t('savedSuccess'))
    } catch (_) {
      toast.error(t('savedError'))
    }
  }

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="mt-4 p-4 rounded-2xl bg-blue-950/40 border border-blue-400/20 space-y-4">
      {/* Card header */}
      <div className="flex items-center gap-2">
        <div className="w-8 h-8 rounded-xl bg-blue-500/20 border border-blue-400/30 flex items-center justify-center shrink-0">
          <Droplets className="w-4 h-4 text-blue-300" />
        </div>
        <div>
          <h4 className="text-sm font-bold text-white">{t('title')}</h4>
          <p className="text-xs text-slate-400">{t('subtitle')}</p>
        </div>
      </div>

      {/* Enable toggle */}
      <div className="flex items-center justify-between p-3 rounded-xl bg-slate-900/70 border border-white/10">
        <div>
          <p className="text-sm font-semibold text-white">{t('statusLabel')}</p>
          <p className="text-xs text-slate-400">{t('statusDesc')}</p>
        </div>
        <label className="relative inline-flex items-center cursor-pointer">
          <input
            id="hydration-reminder-enabled"
            type="checkbox"
            checked={schedule.enabled}
            onChange={(e) => handleChange('enabled', e.target.checked)}
            className="sr-only peer"
          />
          <div className="w-10 h-5 bg-slate-700 peer-focus:outline-none rounded-full peer peer-checked:bg-blue-500 transition-colors after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:after:translate-x-5" />
        </label>
      </div>

      {/* Schedule controls — only visible when enabled */}
      {schedule.enabled && (
        <div className="space-y-3">
          <p className="text-xs font-semibold text-blue-300 uppercase tracking-wider flex items-center gap-1.5">
            <Clock className="w-3.5 h-3.5" />
            {t('scheduleLabel')}
          </p>

          {/* Start Time */}
          <div className="flex items-center justify-between gap-3">
            <label
              htmlFor="hydration-start-time"
              className="text-sm text-slate-300 shrink-0"
            >
              {t('startTime')}
            </label>
            <DarkSelect
              id="hydration-start-time"
              value={schedule.startTime}
              options={TIME_OPTIONS}
              onChange={(v) => handleChange('startTime', v)}
            />
          </div>

          {/* End Time */}
          <div className="flex items-center justify-between gap-3">
            <label
              htmlFor="hydration-end-time"
              className="text-sm text-slate-300 shrink-0"
            >
              {t('endTime')}
            </label>
            <DarkSelect
              id="hydration-end-time"
              value={schedule.endTime}
              options={TIME_OPTIONS}
              onChange={(v) => handleChange('endTime', v)}
            />
          </div>

          {/* Repeat Every */}
          <div className="flex items-center justify-between gap-3">
            <label
              htmlFor="hydration-repeat"
              className="text-sm text-slate-300 shrink-0"
            >
              {t('repeatEvery')}
            </label>
            <DarkSelect
              id="hydration-repeat"
              value={schedule.repeatMinutes}
              options={REPEAT_OPTIONS.map((o) => ({ value: o.minutes, label: o.label }))}
              onChange={(v) => handleChange('repeatMinutes', Number(v))}
            />
          </div>

          {/* Estimated reminders */}
          <div className="flex items-center justify-between p-3 rounded-xl bg-blue-900/30 border border-blue-400/15">
            <p className="text-xs text-slate-400">{t('estimatedLabel')}</p>
            <span className="text-sm font-bold text-blue-300">
              {estimated} {t('remindersUnit')}
            </span>
          </div>

          {/* Skip if goal reached */}
          <label
            htmlFor="hydration-skip-goal"
            className="flex items-start gap-3 p-3 rounded-xl bg-slate-900/70 border border-white/10 cursor-pointer hover:bg-slate-800/70 transition-colors"
          >
            <input
              id="hydration-skip-goal"
              type="checkbox"
              checked={schedule.skipIfGoalReached}
              onChange={(e) =>
                handleChange('skipIfGoalReached', e.target.checked)
              }
              className="mt-0.5 w-4 h-4 accent-blue-400 cursor-pointer shrink-0"
            />
            <span className="text-xs text-slate-300 leading-relaxed">
              {t('skipIfGoalReached')}
            </span>
          </label>
        </div>
      )}

      {/* Save button */}
      <button
        id="hydration-reminder-save"
        onClick={handleSave}
        className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-700 hover:to-cyan-700 text-white text-sm font-bold shadow-md transition-all active:scale-95"
      >
        <Save className="w-4 h-4" />
        {t('saveBtn')}
      </button>
    </div>
  )
}
