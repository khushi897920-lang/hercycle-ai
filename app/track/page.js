'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase-client'
import toast from 'react-hot-toast'
import Navbar from '@/components/layout/Navbar'
import Footer from '@/components/layout/Footer'
import CycleCalendar from '@/components/dashboard/CycleCalendar'
import DailyLogPanel from '@/components/dashboard/DailyLogPanel'

const MONTH_NAMES = [
  'January','February','March','April','May','June',
  'July','August','September','October','November','December',
]

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

function buildCalendarDays(year, month, periodDays, ovulationDays, predictedDays, todayStr) {
  const firstDay        = new Date(year, month, 1).getDay()
  const daysInMonth     = new Date(year, month + 1, 0).getDate()
  const daysInPrevMonth = new Date(year, month, 0).getDate()
  const days = []
  ;['S','M','T','W','T','F','S'].forEach(h => days.push({ type: 'header', label: h }))
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
  const router   = useRouter()
  const supabase = createClient()
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
      const res  = await fetch('/api/cycles')
      const data = await res.json()
      if (data.success) setCycleData(data.data)
    } catch (e) { console.error(e) }
    finally { setLoading(false) }
  }

  const fetchTodayLog = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) return
      const today = new Date().toISOString().split('T')[0]
      const { data } = await supabase
        .from('daily_logs')
        .select('*')
        .eq('user_id', session.user.id)
        .eq('date', today)
        .single()
      
      if (data) {
        if (data.symptoms) setSelectedSymptoms(data.symptoms)
        if (data.mood) setSelectedMood(data.mood)
        if (data.flow) setSelectedFlow(data.flow)
      }
    } catch (e) { console.error(e) }
  }

  useEffect(() => {
    const init = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) { router.push('/auth/login'); return }
      await Promise.all([fetchCycleData(), fetchTodayLog()])
    }
    init()
  }, [router, supabase])

  const handleSaveLog = async () => {
    try {
      const res  = await fetch('/api/log-day', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          date: new Date().toISOString().split('T')[0],
          symptoms: selectedSymptoms,
          mood: selectedMood,
          flow: selectedFlow,
        }),
      })
      const data = await res.json()
      if (data.success) {
        toast.success('✅ Log saved!')
        setSelectedSymptoms([])
        setSelectedMood(null)
        setSelectedFlow(null)
        fetchCycleData()
      } else {
        toast.error('❌ Failed to save')
      }
    } catch {
      toast.error('❌ Failed to save')
    }
  }

  const handleStartPeriod = async () => {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) return

    const today   = new Date()
    const endDate = new Date(today)
    endDate.setDate(endDate.getDate() + 5)

    const { error } = await supabase.from('cycles').insert([{
      user_id:      session.user.id,
      start_date:   today.toISOString().split('T')[0],
      end_date:     endDate.toISOString().split('T')[0],
      cycle_length: cycleData?.averageCycleLength || 28,
      created_at:   new Date().toISOString(),
    }])

    if (error) {
      toast.error('❌ Could not start period')
      return
    }
    toast.success('🌸 Period started! Your cycle is now being tracked.')
    fetchCycleData()
  }

  const handleEndPeriod = async () => {
    const today  = new Date().toISOString().split('T')[0]
    const cycles = cycleData?.cycles || []

    // Find most recent open cycle (no end_date, or end_date in future)
    const open = cycles.find(c => {
      if (!c.end_date) return true
      return new Date(c.end_date) > new Date()
    })
    if (!open) { toast.error('No open period found to end'); return }

    const { error } = await supabase.from('cycles').update({ end_date: today }).eq('id', open.id)
    if (error) { toast.error('❌ Could not end period'); return }
    toast.success('✅ Period ended!')
    fetchCycleData()
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
  const calendarDays = buildCalendarDays(viewYear, viewMonth, periodDays, ovulationDays, predictedDays, today)
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
            🗓️ <span className="gradient-text">Cycle Tracker</span>
          </h1>
          <p style={{ color: TEXT_FAINT, marginBottom: '2rem' }}>
            Log your daily symptoms and manage your cycle timeline.
          </p>

          {/* Period action buttons */}
          <div style={{ display: 'flex', gap: '1rem', marginBottom: '2rem', flexWrap: 'wrap' }}>
            <button
              className="btn-white"
              onClick={handleStartPeriod}
              style={{ padding: '0.75rem 1.75rem', fontSize: '0.95rem', fontWeight: 600 }}
            >
              🔴 Start Period Today
            </button>
            {openCycle && (
              <button
                className="btn-outline"
                onClick={handleEndPeriod}
                style={{ padding: '0.75rem 1.75rem', fontSize: '0.95rem', fontWeight: 600 }}
              >
                ✅ End Period Today
              </button>
            )}
          </div>

          {/* Status banner when no cycles exist */}
          {!loading && !hasCycles && (
            <div style={{
              background: 'rgba(232,82,126,0.12)',
              border: '1px solid rgba(232,82,126,0.35)',
              borderRadius: 12,
              padding: '0.9rem 1.2rem',
              marginBottom: '1.5rem',
              color: TEXT_PRIMARY,
              fontSize: '0.9rem',
            }}>
              💡 <strong>No cycles recorded yet.</strong> Click <em>"🔴 Start Period Today"</em> to begin tracking your first cycle. Saving daily logs separately will not create a cycle record.
            </div>
          )}

          {/* Calendar */}
          <div style={{ marginBottom: '2rem' }}>
            <CycleCalendar
              calendarDays={calendarDays}
              currentMonth={`${MONTH_NAMES[viewMonth]} ${viewYear}`}
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
            📝 Log Today&apos;s Symptoms
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
