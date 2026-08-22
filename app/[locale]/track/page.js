'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@clerk/nextjs'
import toast from 'react-hot-toast'
import { Plus } from 'lucide-react'
import Navbar from '@/components/layout/Navbar'
import Footer from '@/components/layout/Footer'
import CycleCalendar from '@/components/dashboard/CycleCalendar'
import DailyLogPanel from '@/components/dashboard/DailyLogPanel'
import DayLogDrawer from '@/components/dashboard/DayLogDrawer'
import { useOffline } from '@/lib/OfflineContext'
import { useTranslations, useLocale } from 'next-intl'
import WeightTracker from '@/components/dashboard/WeightTracker'
import { isEncryptionFailure } from '@/lib/encryption-policy'
import { getTodayISO, eachDayISO, addDaysISO, toISODate } from '@/lib/date-utils'

const TEXT_PRIMARY = '#ffffff'
// Was a hardcoded rgba literal that bypassed the app's theme system, so it
// never picked up the higher-contrast value .dark already defines for
// secondary text (see --text-soft in app/globals.css). Using the CSS
// variable directly fixes contrast on dark cards without touching every
// call site below.
const TEXT_FAINT = 'var(--text-soft)'

function deriveDateSets(cycleData) {
  const periodDays = new Set()
  const ovulationDays = new Set()
  const predictedDays = new Set()
  const today = getTodayISO()
  const cycles = cycleData?.cycles || []

  cycles.forEach(cycle => {
    const startStr = cycle.start_date
    const endStr = cycle.end_date
    if (!startStr) return
    // Default an open period to a 5-day span (start + 5 days, inclusive of start).
    const endISO = endStr || addDaysISO(startStr, 5)

    eachDayISO(startStr, endISO).forEach(day => periodDays.add(day))

    for (let ov = 12; ov <= 16; ov++) {
      const day = addDaysISO(startStr, ov)
      if (day) ovulationDays.add(day)
    }
  })

  if (cycleData?.nextPeriodDate) {
    for (let p = 0; p < 7; p++) {
      const day = addDaysISO(cycleData.nextPeriodDate, p)
      if (day) predictedDays.add(day)
    }
  }
  return { periodDays, ovulationDays, predictedDays, today }
}

function buildCalendarDays(year, month, periodDays, ovulationDays, predictedDays, todayStr, locale) {
  const firstDay = new Date(year, month, 1).getDay()
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const daysInPrevMonth = new Date(year, month, 0).getDate()
  const days = []

  const weekDays = locale === 'hi' ? ['र', 'सो', 'मं', 'बु', 'गु', 'शु', 'श'] : ['S', 'M', 'T', 'W', 'T', 'F', 'S']
  weekDays.forEach(h => days.push({ type: 'header', label: h }))

  for (let i = firstDay - 1; i >= 0; i--) days.push({ type: 'empty', label: daysInPrevMonth - i })
  for (let i = 1; i <= daysInMonth; i++) {
    const iso = `${year}-${String(month + 1).padStart(2, '0')}-${String(i).padStart(2, '0')}`
    const isToday = iso === todayStr
    let type = 'normal'
    if (periodDays?.has(iso)) type = 'period'
    else if (predictedDays?.has(iso)) type = 'predicted'
    else if (ovulationDays?.has(iso)) type = 'ovulation'
    if (isToday && type === 'normal') type = 'today'
    days.push({ type, label: i, isToday, iso })
  }
  return days
}

export default function TrackPage() {
  const t = useTranslations('pages.track')
  const locale = useLocale()
  const router = useRouter()
  const { isLoaded, isSignedIn } = useAuth()
  const { offlineClient } = useOffline()
  const now = new Date()

  const [viewYear, setViewYear] = useState(now.getFullYear())
  const [viewMonth, setViewMonth] = useState(now.getMonth())
  const [cycleData, setCycleData] = useState(null)
  const [selectedSymptoms, setSelectedSymptoms] = useState([])
  const [selectedMood, setSelectedMood] = useState(null)
  const [selectedFlow, setSelectedFlow] = useState(null)
  const [loading, setLoading] = useState(true)

  const [drawerOpen, setDrawerOpen] = useState(false)
  const [selectedDate, setSelectedDate] = useState(null)

  const handleDayClick = (iso) => {
    setSelectedDate(iso)
    setDrawerOpen(true)
  }

  const fetchCycleData = useCallback(async () => {
    try {
      const data = await offlineClient.fetchCycles()
      if (data.success) setCycleData(data.data)
    } catch (e) { console.error(e) }
    finally { setLoading(false) }
  }, [offlineClient])

  const fetchTodayLog = useCallback(async () => {
    try {
      const today = getTodayISO()
      const data = await offlineClient.fetchTodayLog(today)
      if (data.success && data.data) {
        if (data.data.symptoms) setSelectedSymptoms(data.data.symptoms)
        if (data.data.mood) setSelectedMood(data.data.mood)
        if (data.data.flow) setSelectedFlow(data.data.flow)
      }
    } catch (e) { console.error(e) }
  }, [offlineClient])

  useEffect(() => {
    if (!isLoaded) return
    if (!isSignedIn) { router.push('/auth/login'); return }
    Promise.all([fetchCycleData(), fetchTodayLog()])
  }, [isLoaded, isSignedIn, router, fetchCycleData, fetchTodayLog])

  const handleSaveLog = async () => {
    try {
      const logData = {
        date: getTodayISO(),
        symptoms: selectedSymptoms,
        mood: selectedMood,
        flow: selectedFlow,
      }
      const data = await offlineClient.saveDailyLog(logData)
      if (data.success) {
        if (data.offline) {
          toast.success('💾 Saved offline! Will sync when online.')
        } else {
          toast.success('Log saved!')
        }
        setSelectedSymptoms([])
        setSelectedMood(null)
        setSelectedFlow(null)
        fetchCycleData()
      } else if (isEncryptionFailure(data)) {
        // Fail-closed: nothing was sent, so keep the form populated for retry
        // after unlocking rather than clearing the user's input.
        toast.error(`🔒 ${data.error}`)
      } else {
        toast.error(`❌ Failed to save: ${data.message || data.error || 'Unknown error'}`)
      }
    } catch (err) {
      toast.error(`❌ Failed to save: ${err.message || err}`)
    }
  }

  const handleStartPeriod = async () => {
    const today = getTodayISO()
    const cycleDataObj = {
      start_date: today,
      end_date: null,   // no end date on period start — user will log it when it ends
      cycle_length: cycleData?.averageCycleLength || 28,
    }

    try {
      const data = await offlineClient.startPeriod(cycleDataObj)
      if (!data.success) {
        toast.error(isEncryptionFailure(data)
          ? `🔒 ${data.error}`
          : `❌ Could not start period: ${data.error || data.message || 'Unknown error'}`)
        return
      }
      if (data.offline) {
        toast.success('🌸 Period started! Saved offline, will sync when online.')
      } else {
        toast.success('🌸 Period started! Your cycle is now being tracked.')
      }
      fetchCycleData()
    } catch (err) {
      toast.error(`❌ Could not start period: ${err.message || err}`)
    }
  }

  const handleEndPeriod = async () => {
    const today = getTodayISO()
    const cycles = cycleData?.cycles || []
    // ISO date strings compare correctly lexicographically, so this needs no
    // Date construction — and therefore cannot drift by a day across timezones.
    const open = cycles.find(c => !c.end_date || toISODate(c.end_date) > today)
    if (!open) { toast.error('No open period found to end'); return }

    try {
      const data = await offlineClient.endPeriod(open.id, today)
      if (!data.success) {
        toast.error(isEncryptionFailure(data)
          ? `🔒 ${data.error}`
          : `❌ Could not end period: ${data.error || data.message || 'Unknown error'}`)
        return
      }
      if (data.offline) {
        toast.success('✅ Period ended! Saved offline, will sync when online.')
      } else {
        toast.success('✅ Period ended!')
      }
      fetchCycleData()
    } catch (err) {
      toast.error(`❌ Could not end period: ${err.message || err}`)
    }
  }

  const toggleSymptom = (s) =>
    setSelectedSymptoms(prev => prev.includes(s) ? prev.filter(x => x !== s) : [...prev, s])

  const goToPrevMonth = () => {
    if (viewMonth === 0) { setViewYear(y => y - 1); setViewMonth(11) }
    else setViewMonth(m => m - 1)
  }
  const goToNextMonth = () => {
    if (viewMonth === 11) { setViewYear(y => y + 1); setViewMonth(0) }
    else setViewMonth(m => m + 1)
  }

  const { periodDays, ovulationDays, predictedDays, today } = deriveDateSets(cycleData)
  const calendarDays = buildCalendarDays(viewYear, viewMonth, periodDays, ovulationDays, predictedDays, today, locale)
  const daysUntilNext = cycleData?.nextPeriodDate
    ? Math.max(0, Math.round((new Date(cycleData.nextPeriodDate) - new Date()) / 86400000))
    : null

  const hasCycles = (cycleData?.cycles?.length ?? 0) > 0
  // A period is "open" only when it has no end_date yet — the user started it but hasn't ended it.
  // Using !c.end_date avoids any timezone comparison issues.
  const openCycle = cycleData?.cycles?.find(c => !c.end_date)

  return (
    <>
      <div className="blob"></div>
      <div className="blob"></div>
      <div className="blob"></div>

      <div className="page">
        <Navbar />

        <div className="max-w-[900px] mx-auto px-3 sm:px-6 py-6 w-full">

          {/* Page header */}
          <h1 className="text-2xl sm:text-3xl font-bold mb-1">
            🗓️ <span className="gradient-text">{t('title')}</span>
          </h1>
          <p style={{ color: TEXT_FAINT }} className="text-sm sm:text-base mb-6">
            {t('subtitle')}
          </p>

          {/* Period action buttons — mutually exclusive: Start shown when no active period, End shown when one is active */}
          <div className="flex flex-wrap gap-3 mb-6 w-full">
            {!openCycle && (
              <button
                className="btn-white w-full sm:w-auto text-center font-semibold"
                onClick={handleStartPeriod}
              >
                {t('startPeriod')}
              </button>
            )}
            {openCycle && (
              <button
                className="btn-outline w-full sm:w-auto text-center font-semibold"
                onClick={handleEndPeriod}
              >
                {t('endPeriod')}
              </button>
            )}
          </div>

          <div style={{ marginTop: '1.5rem', marginBottom: '0.5rem' }}>
            <WeightTracker />
          </div>

          {/* Status banner when no cycles exist */}
          {!loading && !hasCycles && (
            <div style={{
              background: 'rgba(232,82,126,0.12)',
              border: '1px solid rgba(232,82,126,0.35)',
              borderRadius: 12,
              padding: '0.9rem 1.2rem',
              margin: '1.5rem 0',
            }}>
              {t('noCycles')}
            </div>
          )}

          {/* Calendar */}
          <div style={{ marginBottom: '2rem' }}>
            <CycleCalendar
              calendarDays={calendarDays}
              currentMonth={`${new Intl.DateTimeFormat(locale === 'hi' ? 'hi-IN' : 'en-US', { month: 'long' }).format(new Date(viewYear, viewMonth))} ${viewYear}`}
              onPrevMonth={goToPrevMonth}
              onNextMonth={goToNextMonth}
              averageCycleLength={cycleData?.averageCycleLength || 28}
              daysUntilNext={daysUntilNext}
              activeLang="EN"
              onDayClick={handleDayClick}
              selectedDate={selectedDate}
            />
          </div>

          {/* Daily log panel */}
          <h2 id="daily-log-section" className="sec-head" style={{
            marginBottom: '1.25rem',
          }}>
            {t('logToday')}
          </h2>
          <div className="daily-log-grid">
            <DailyLogPanel
              selectedSymptoms={selectedSymptoms}
              toggleSymptom={toggleSymptom}
              selectedMood={selectedMood}
              setSelectedMood={setSelectedMood}
              selectedFlow={selectedFlow}
              setSelectedFlow={setSelectedFlow}
              handleSaveLog={handleSaveLog}
              cycleData={cycleData}
              activeLang="EN"
            />
          </div>

        </div>

        <Footer />
      </div>

      <DayLogDrawer
        isOpen={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        selectedDate={selectedDate}
        cycleData={cycleData}
        onSaved={() => {
          fetchCycleData();
          if (selectedDate === getTodayISO()) {
            fetchTodayLog();
          }
        }}
      />

      {/* Mobile quick-log FAB */}
      <button
        onClick={() => handleDayClick(getTodayISO())}
        className="quick-log-fab md:hidden"
        aria-label={t('logToday')}
      >
        <Plus className="w-5 h-5" strokeWidth={2.5} />
        <span>{t('logToday')}</span>
      </button>
    </>
  )
}
