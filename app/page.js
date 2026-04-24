'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase-client'
import toast from 'react-hot-toast'

import Navbar from '@/components/layout/Navbar'
import Footer from '@/components/layout/Footer'
import HeroSection from '@/components/dashboard/HeroSection'
import CycleCalendar from '@/components/dashboard/CycleCalendar'
import FeaturesSection from '@/components/dashboard/FeaturesSection'
import PCODRiskCard from '@/components/dashboard/PCODRiskCard'
import ChatAssistant from '@/components/dashboard/ChatAssistant'
import DailyLogPanel from '@/components/dashboard/DailyLogPanel'
import OnboardingModal from '@/components/dashboard/OnboardingModal'
import PredictionCard from '@/components/dashboard/PredictionCard'
import { t } from '@/lib/i18n'

const MONTH_NAMES = ['January','February','March','April','May','June','July','August','September','October','November','December']

/**
 * Derives the four date-type Sets from raw API cycle data.
 * Handles both column naming conventions:
 *   - Supabase actual:  start_date / end_date
 *   - User description: period_start / period_end
 */
function deriveDateSets(cycleData) {
  const periodDays    = new Set()  // 'YYYY-MM-DD' strings
  const ovulationDays = new Set()
  const predictedDays = new Set()
  const today         = new Date().toISOString().split('T')[0]

  const cycles = cycleData?.cycles || []
  const toISO  = (d) => d.toISOString().split('T')[0]

  cycles.forEach(cycle => {
    const startStr = cycle.start_date
    const endStr   = cycle.end_date
    if (!startStr) return

    const start = new Date(startStr)
    const end = new Date(endStr || startStr)
    
    // Period days
    for(let d = new Date(start); d <= end; d.setDate(d.getDate()+1)){
      periodDays.add(toISO(d))
    }

    // Ovulation window: days 11-15 after period start
    for(let i = 11; i <= 15; i++){
      const d = new Date(start)
      d.setDate(d.getDate() + i)
      ovulationDays.add(toISO(d))
    }
  })

  // Predicted: days -1 to +5 around nextPeriodDate
  if (cycleData?.nextPeriodDate) {
    const pred = new Date(cycleData.nextPeriodDate)
    if (!isNaN(pred)) {
      for(let i = -1; i <= 5; i++){
        const d = new Date(pred)
        d.setDate(d.getDate() + i)
        predictedDays.add(toISO(d))
      }
    }
  }

  return { periodDays, ovulationDays, predictedDays, today }
}

/**
 * Builds the calendarDays array for a given year/month.
 * Uses pre-derived ISO-date Sets (YYYY-MM-DD) for O(1) lookups.
 */
function buildCalendarDays(year, month, periodDays, ovulationDays, predictedDays, todayStr) {
  const firstDay       = new Date(year, month, 1).getDay()
  const daysInMonth    = new Date(year, month + 1, 0).getDate()
  const daysInPrevMonth = new Date(year, month, 0).getDate()

  const days = []
  ;['S','M','T','W','T','F','S'].forEach(h => days.push({ type: 'header', label: h }))

  // Prev-month overflow cells
  for (let i = firstDay - 1; i >= 0; i--) {
    days.push({ type: 'empty', label: daysInPrevMonth - i })
  }

  // Actual days
  for (let i = 1; i <= daysInMonth; i++) {
    const iso    = `${year}-${String(month + 1).padStart(2,'0')}-${String(i).padStart(2,'0')}`
    const isToday = iso === todayStr
    let type = 'normal'
    if (periodDays?.has(iso))                         type = 'period'
    else if (predictedDays?.has(iso))                 type = 'predicted'
    else if (ovulationDays?.has(iso))                 type = 'ovulation'
    if (isToday) type = type === 'normal' ? 'today' : type  // today badge on top of any type
    days.push({ type, label: i, isToday })
  }

  return days
}

const HerCycleApp = () => {
  const router = useRouter()
  const supabase = createClient()
  const now = new Date()
  const [activeNav, setActiveNav] = useState('Dashboard')
  const [activeLang, setActiveLang] = useState('EN')
  const [viewYear, setViewYear] = useState(now.getFullYear())
  const [viewMonth, setViewMonth] = useState(now.getMonth()) // 0-indexed
  const [chatMessages, setChatMessages] = useState([
    { role: 'ai', text: 'Hello! I\'m your health assistant. Ask me anything about your cycle or health. 💕' }
  ])
  const [chatInput, setChatInput] = useState('')
  const [isTyping, setIsTyping] = useState(false)
  const [selectedSymptoms, setSelectedSymptoms] = useState([])
  const [selectedMood, setSelectedMood] = useState(null)
  const [selectedFlow, setSelectedFlow] = useState(null)
  const [cycleData, setCycleData] = useState(null)
  const [pcodRisk, setPcodRisk] = useState(null)
  const [pcodRiskLoading, setPcodRiskLoading] = useState(true)
  const [isLogOpen, setIsLogOpen] = useState(false)
  const [showOnboarding, setShowOnboarding] = useState(false)
  const [dataLoaded, setDataLoaded] = useState(false)

  const openLogDrawer  = () => setIsLogOpen(true)
  const closeLogDrawer = () => setIsLogOpen(false)

  const goToPrevMonth = () => {
    if (viewMonth === 0) { setViewYear(y => y - 1); setViewMonth(11) }
    else setViewMonth(m => m - 1)
  }
  const goToNextMonth = () => {
    if (viewMonth === 11) { setViewYear(y => y + 1); setViewMonth(0) }
    else setViewMonth(m => m + 1)
  }

  // Close drawer on Escape key
  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') closeLogDrawer() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  // Check session on mount and load data
  useEffect(() => {
    const initData = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) {
        router.push('/auth/login')
        return
      }

      await Promise.all([
        fetchCycleData(),
        fetchPCODRisk()
      ])
    }
    initData()
  }, [router, supabase.auth])

  const fetchCycleData = async () => {
    try {
      const response = await fetch('/api/cycles')
      const data = await response.json()
      if (data.success) {
        setCycleData(data.data)
        
        const onboardingDone = localStorage.getItem('onboarding_complete')
        if (onboardingDone) {
          setShowOnboarding(false)
        } else if (!data.data.cycles || data.data.cycles.length === 0) {
          setShowOnboarding(true)
        }
      }
    } catch (error) {
      console.error('Error fetching cycle data:', error)
    } finally {
      setDataLoaded(true)
    }
  }

  const handleOnboardingComplete = () => {
    setShowOnboarding(false)
    fetchCycleData() // refresh to show the new cycle in the calendar
  }

  const handleOnboardingSkip = () => {
    setShowOnboarding(false)
  }

  const fetchPCODRisk = async () => {
    setPcodRiskLoading(true)
    try {
      const response = await fetch('/api/pcod-risk')
      const data = await response.json()
      if (data.success) {
        setPcodRisk(data.data)
      }
    } catch (error) {
      console.error('Error fetching PCOD risk:', error)
    } finally {
      setPcodRiskLoading(false)
    }
  }

  const handleSendMessage = async (directMessage) => {
    const userMessage = directMessage || chatInput
    if (!userMessage.trim()) return

    setChatMessages(prev => [...prev, { role: 'user', text: userMessage }])
    setChatInput('')
    setIsTyping(true)

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          message: userMessage,
          language: activeLang,
          context: { ...cycleData, currentPhase: cycleDayInfo }
        })
      })

      const data = await response.json()
      setIsTyping(false)

      if (data.success) {
        setChatMessages(prev => [...prev, { role: 'ai', text: data.response }])
      }
    } catch (error) {
      setIsTyping(false)
      setChatMessages(prev => [...prev, { 
        role: 'ai', 
        text: 'Sorry, I encountered an error. Please try again.' 
      }])
    }
  }

  const handleSaveLog = async () => {
    try {
      const response = await fetch('/api/log-day', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          date: new Date().toISOString().split('T')[0],
          symptoms: selectedSymptoms,
          mood: selectedMood,
          flow: selectedFlow
        })
      })

      const data = await response.json()
      if (data.success) {
        toast.success('✅ Log saved!')
        setSelectedSymptoms([])
        setSelectedMood(null)
        setSelectedFlow(null)
        fetchCycleData()
      } else {
        toast.error('❌ Failed to save')
      }
    } catch (error) {
      toast.error('❌ Failed to save')
    }
  }

  const toggleSymptom = (symptom) => {
    setSelectedSymptoms(prev => 
      prev.includes(symptom) 
        ? prev.filter(s => s !== symptom)
        : [...prev, symptom]
    )
  }

  // Derive the four ISO-date Sets from the API cycle data
  const dateSets     = deriveDateSets(cycleData)
  const calendarDays = buildCalendarDays(
    viewYear, viewMonth,
    dateSets.periodDays,
    dateSets.ovulationDays,
    dateSets.predictedDays,
    dateSets.today
  )
  const { periodDays, ovulationDays, predictedDays, today: todayStr } = dateSets

  // Days until next period
  const daysUntilNext = cycleData?.nextPeriodDate
    ? Math.max(0, Math.round((new Date(cycleData.nextPeriodDate) - new Date()) / 86400000))
    : null

  // Calculate current cycle day and phase
  let cycleDayInfo = {
    text: 'Start tracking to see your cycle phase',
    color: '#a0aec0',
    dot: '#a0aec0',
    phase: null,
    day: null
  }

  if (cycleData?.cycles?.length > 0) {
    const sortedCycles = [...cycleData.cycles].sort((a, b) => {
      const aDate = new Date(a.start_date)
      const bDate = new Date(b.start_date)
      return bDate - aDate
    })
    
    const mostRecentCycle = sortedCycles[0]
    const lastPeriodStart = new Date(mostRecentCycle.start_date)
    const todayObj = new Date()
    
    // Normalize times to midnight to get accurate day difference
    todayObj.setHours(0,0,0,0)
    lastPeriodStart.setHours(0,0,0,0)
    
    const cycleDay = Math.floor((todayObj - lastPeriodStart) / (1000 * 60 * 60 * 24)) + 1
    cycleDayInfo.day = cycleDay

    if (cycleDay >= 1 && cycleDay <= 5) {
      cycleDayInfo.phase = 'Menstrual Phase'
      cycleDayInfo.color = '#ff4757'
      cycleDayInfo.dot = '#ff4757'
    } else if (cycleDay >= 6 && cycleDay <= 11) {
      cycleDayInfo.phase = 'Follicular Phase'
      cycleDayInfo.color = '#a29bfe'
      cycleDayInfo.dot = '#a29bfe'
    } else if (cycleDay >= 12 && cycleDay <= 16) {
      cycleDayInfo.phase = 'Ovulation Window'
      cycleDayInfo.color = '#00b894'
      cycleDayInfo.dot = '#00b894'
    } else if (cycleDay >= 17 && cycleDay <= 28) {
      cycleDayInfo.phase = 'Luteal Phase'
      cycleDayInfo.color = '#fdcb6e'
      cycleDayInfo.dot = '#fdcb6e'
    } else {
      cycleDayInfo.phase = 'Late / Irregular'
      cycleDayInfo.color = '#636e72'
      cycleDayInfo.dot = '#636e72'
    }
    
    if (cycleDay >= 1) {
      cycleDayInfo.text = `Cycle Day ${cycleDay} · ${cycleDayInfo.phase}`
    }
  }

  return (
    <>
      <div className="blob"></div>
      <div className="blob"></div>
      <div className="blob"></div>

      <div className="particle" style={{left:'8%', animationDuration:'13s', animationDelay:'0s'}}>✨</div>
      <div className="particle" style={{left:'22%', animationDuration:'17s', animationDelay:'3.5s'}}>🌸</div>
      <div className="particle" style={{left:'38%', animationDuration:'14s', animationDelay:'7s'}}>💫</div>
      <div className="particle" style={{left:'52%', animationDuration:'19s', animationDelay:'1s'}}>🌷</div>
      <div className="particle" style={{left:'67%', animationDuration:'11s', animationDelay:'5s'}}>✨</div>
      <div className="particle" style={{left:'80%', animationDuration:'16s', animationDelay:'2s'}}>💕</div>
      <div className="particle" style={{left:'91%', animationDuration:'12s', animationDelay:'8s'}}>🌸</div>

      {/* ── Onboarding Modal ── */}
      {showOnboarding && (
        <OnboardingModal
          activeLang={activeLang}
          onComplete={handleOnboardingComplete}
          onSkip={handleOnboardingSkip}
        />
      )}

      {/* ── Log Today Drawer ── */}
      {isLogOpen && (
        <div className="drawer-overlay" onClick={closeLogDrawer} role="dialog" aria-modal="true" aria-label="Log Your Day">
          <div className="drawer-panel" onClick={(e) => e.stopPropagation()}>
            <div className="drawer-header">
              <h2>{t(activeLang, 'log', 'title')}</h2>
              <button className="drawer-close" onClick={closeLogDrawer} aria-label={t(activeLang, 'btn', 'close')}>✕</button>
            </div>
            <div className="drawer-grid">
              <DailyLogPanel
                selectedSymptoms={selectedSymptoms}
                toggleSymptom={toggleSymptom}
                selectedMood={selectedMood}
                setSelectedMood={setSelectedMood}
                selectedFlow={selectedFlow}
                setSelectedFlow={setSelectedFlow}
                handleSaveLog={async () => { await handleSaveLog(); closeLogDrawer() }}
                cycleData={cycleData}
                activeLang={activeLang}
              />
            </div>
          </div>
        </div>
      )}

      <div className="page">
        <Navbar />

        <div className="hero">
          <HeroSection activeLang={activeLang} cycleDayInfo={cycleDayInfo} />
          <CycleCalendar 
            calendarDays={calendarDays}
            currentMonth={`${MONTH_NAMES[viewMonth]} ${viewYear}`}
            onPrevMonth={goToPrevMonth}
            onNextMonth={goToNextMonth}
            averageCycleLength={cycleData?.averageCycleLength || 28}
            daysUntilNext={daysUntilNext}
            activeLang={activeLang}
          />
        </div>

        <FeaturesSection activeLang={activeLang} />

        <h2 className="sec-head" id="pcod-risk-section">{t(activeLang, 'headings', 'insights')}</h2>
        <div className="dual-row">
          <PCODRiskCard
            pcodRisk={pcodRisk}
            loading={pcodRiskLoading}
            cycleCount={cycleData?.cycles?.length ?? 0}
            cycles={cycleData?.cycles ?? []}
            recentSymptoms={selectedSymptoms}
            activeLang={activeLang}
          />
          <ChatAssistant
            chatMessages={chatMessages}
            isTyping={isTyping}
            chatInput={chatInput}
            setChatInput={setChatInput}
            handleSendMessage={handleSendMessage}
            activeLang={activeLang}
            nextPeriodDate={cycleData?.nextPeriodDate}
            cycleDayInfo={cycleDayInfo}
          />
        </div>

        <h2 className="sec-head">{t(activeLang, 'headings', 'log')}</h2>
        <div className="bottom-grid" id="daily-log-section">
          <DailyLogPanel 
            selectedSymptoms={selectedSymptoms} 
            toggleSymptom={toggleSymptom} 
            selectedMood={selectedMood} 
            setSelectedMood={setSelectedMood} 
            selectedFlow={selectedFlow} 
            setSelectedFlow={setSelectedFlow} 
            handleSaveLog={handleSaveLog} 
            cycleData={cycleData} 
            activeLang={activeLang}
          />
          <PredictionCard cycleData={cycleData} activeLang={activeLang} />
        </div>

        <Footer />
      </div>
    </>
  )
}

const App = () => {
  return <HerCycleApp />
}

export default App