'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@clerk/nextjs'
import toast from 'react-hot-toast'
import Navbar from '@/components/layout/Navbar'
import Footer from '@/components/layout/Footer'
import CycleCalendar from '@/components/dashboard/CycleCalendar'
import DailyLogPanel from '@/components/dashboard/DailyLogPanel'
import { useOffline } from '@/lib/OfflineContext'
import { useTranslations, useLocale } from 'next-intl'
import WeightTracker from '@/components/dashboard/WeightTracker'

const TEXT_PRIMARY = '#ffffff'
const TEXT_FAINT   = 'rgba(255,255,255,0.65)'

function deriveDateSets(cycleData) {
  const periodDays    = new Set()
  const ovulationDays = new Set()
  const predictedDays = new Set()
  const today         = new Date().toISOString().split('T')[0]
  const cycles        = cycleData?.cycles || []
  const toISO         = (d) => d.toISOString().split('T')[0]

  cycles.forEach(cycle => {
    const startStr = cycle.start_date
    const endStr   = cycle.end_date
    if (!startStr) return
    const start = new Date(startStr)
    const end   = endStr ? new Date(endStr) : new Date(start.getTime() + 5 * 86400000)

    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
      periodDays.add(toISO(new Date(d)))
    }
    for (let ov = 12; ov <= 16; ov++) {
      ovulationDays.add(toISO(new Date(start.getTime() + ov * 86400000)))
    }
  })

  if (cycleData?.nextPeriodDate) {
    const predStart = new Date(cycleData.nextPeriodDate)
    if (!isNaN(predStart)) {
      for (let p = 0; p < 7; p++) {
        predictedDays.add(toISO(new Date(predStart.getTime() + p * 86400000)))
      }
    }
  }
  return { periodDays, ovulationDays, predictedDays, today }
}

function buildCalendarDays(year, month, periodDays, ovulationDays, predictedDays, todayStr, locale) {
  const firstDay        = new Date(year, month, 1).getDay()
  const daysInMonth     = new Date(year, month + 1, 0).getDate()
  const daysInPrevMonth = new Date(year, month, 0).getDate()
  const days = []
  
  const weekDays = locale === 'hi' ? ['र', 'सो', 'मं', 'बु', 'गु', 'शु', 'श'] : ['S','M','T','W','T','F','S']
  weekDays.forEach(h => days.push({ type: 'header', label: h }))
  
  for (let i = firstDay - 1; i >= 0; i--) days.push({ type: 'empty', label: daysInPrevMonth - i })
  for (let i = 1; i <= daysInMonth; i++) {
    const iso     = `${year}-${String(month + 1).padStart(2,'0')}-${String(i).padStart(2,'0')}`
    const isToday = iso === todayStr
    let type = 'normal'
    if (periodDays?.has(iso))         type = 'period'
    else if (predictedDays?.has(iso)) type = 'predicted'
    else if (ovulationDays?.has(iso)) type = 'ovulation'
    if (isToday && type === 'normal') type = 'today'
    days.push({ type, label: i, isToday })
  }
  return days
}

export default function TrackPage() {
  const t = useTranslations('pages.track')
  const locale = useLocale()
  const router   = useRouter()
  const { isLoaded, isSignedIn } = useAuth()
  const { offlineClient } = useOffline()
  const now      = new Date()

  const [viewYear,  setViewYear]  = useState(now.getFullYear())
  const [viewMonth, setViewMonth] = useState(now.getMonth())
  const [cycleData, setCycleData] = useState(null)
  const [selectedSymptoms, setSelectedSymptoms] = useState([])
  const [selectedMood,     setSelectedMood]     = useState(null)
  const [selectedFlow,     setSelectedFlow]     = useState(null)
  const [loading, setLoading] = useState(true)

  const fetchCycleData = async () => {
    try {
      const data = await offlineClient.fetchCycles()
      if (data.success) setCycleData(data.data)
    } catch (e) { console.error(e) }
    finally { setLoading(false) }
  }

  const fetchTodayLog = async () => {
    try {
      const today = new Date().toISOString().split('T')[0]
      const data = await offlineClient.fetchTodayLog(today)
      if (data.success && data.data) {
        if (data.data.symptoms) setSelectedSymptoms(data.data.symptoms)
        if (data.data.mood)     setSelectedMood(data.data.mood)
        if (data.data.flow)     setSelectedFlow(data.data.flow)
      }
    } catch (e) { console.error(e) }
  }

  useEffect(() => {
    if (!isLoaded) return
    if (!isSignedIn) { router.push('/auth/login'); return }
    Promise.all([fetchCycleData(), fetchTodayLog()])
  }, [isLoaded, isSignedIn, router])

  const handleSaveLog = async () => {
    try {
      const logData = {
        date: new Date().toISOString().split('T')[0],
        symptoms: selectedSymptoms,
        mood: selectedMood,
        flow: selectedFlow,
      }
      const data = await offlineClient.saveDailyLog(logData)
      if (data.success) {
        if (data.offline) {
          toast.success('💾 Saved offline! Will sync when online.')
        } else {
          toast.success('✅ Log saved!')
        }
        setSelectedSymptoms([])
        setSelectedMood(null)
        setSelectedFlow(null)
        fetchCycleData()
      } else {
        toast.error(`❌ Failed to save: ${data.message || data.error || 'Unknown error'}`)
      }
    } catch (err) {
      toast.error(`❌ Failed to save: ${err.message || err}`)
    }
  }

  const handleStartPeriod = async () => {
    const today   = new Date()
    const endDate = new Date(today)
    endDate.setDate(endDate.getDate() + 5)
    const cycleDataObj = {
      start_date:   today.toISOString().split('T')[0],
      end_date:     endDate.toISOString().split('T')[0],
      cycle_length: cycleData?.averageCycleLength || 28,
    }

    try {
      const data = await offlineClient.startPeriod(cycleDataObj)
      if (!data.success) { 
        toast.error(`❌ Could not start period: ${data.error || data.message || 'Unknown error'}`)
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
    const today  = new Date().toISOString().split('T')[0]
    const cycles = cycleData?.cycles || []
    const open   = cycles.find(c => !c.end_date || new Date(c.end_date) > new Date())
    if (!open) { toast.error('No open period found to end'); return }

    try {
      const data = await offlineClient.endPeriod(open.id, today)
      if (!data.success) { 
        toast.error(`❌ Could not end period: ${data.error || data.message || 'Unknown error'}`)
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
  const openCycle = cycleData?.cycles?.find(c => !c.end_date || new Date(c.end_date) > new Date())

  return (
    <>
      <div className="blob"></div>
      <div className="blob"></div>
      <div className="blob"></div>

      <div className="page">
        <Navbar />

        <div style={{ maxWidth: 900, margin: '0 auto', padding: '2rem 1.5rem' }}>

          {/* Page header */}
          <h1 style={{ fontSize: '2rem', marginBottom: '0.25rem' }}>
            🗓️ <span className="gradient-text">{t('title')}</span>
          </h1>
          <p style={{ color: TEXT_FAINT, marginBottom: '2rem' }}>
            {t('subtitle')}
          </p>

          {/* Period action buttons */}
          <div style={{ display: 'flex', gap: '1rem', marginBottom: '2rem', flexWrap: 'wrap' }}>
            <button
              className="btn-white"
              onClick={handleStartPeriod}
              style={{ padding: '0.75rem 1.75rem', fontSize: '0.95rem', fontWeight: 600 }}
            >
              {t('startPeriod')}
            </button>
            {openCycle && (
              <button
                className="btn-outline"
                onClick={handleEndPeriod}
                style={{ padding: '0.75rem 1.75rem', fontSize: '0.95rem', fontWeight: 600 }}
              >
                {t('endPeriod')}
              </button>
            )}
          </div>

          <div style={{ marginTop: '1.5rem' }}>
            <WeightTracker />
          </div>

          {/* Status banner when no cycles exist */}
          {!loading && !hasCycles && (
            <div style={{
              background: 'rgba(232,82,126,0.12)',
              border: '1px solid rgba(232,82,126,0.35)',
              borderRadius: 12,
              padding: '0.9rem 1.2rem',
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
            />
          </div>

          {/* Daily log panel */}
          <h2 style={{
            color: TEXT_PRIMARY,
            fontSize: '1.4rem',
            fontWeight: 700,
            marginBottom: '1.25rem',
          }}>
            {t('logToday')}
          </h2>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.25rem' }}>
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
    </>
  )
}
