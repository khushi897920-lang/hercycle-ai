'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth, useUser } from '@clerk/nextjs'
import toast from 'react-hot-toast'
import CyclePhaseCard from '@/components/dashboard/CyclePhaseCard'
import {
  calculateCyclePhase,
  getLatestCycle,
} from '@/lib/calculateCyclePhase'
import Navbar from '@/components/layout/Navbar'
import Footer from '@/components/layout/Footer'
import HeroSection from '@/components/dashboard/HeroSection'
import CycleCalendar from '@/components/dashboard/CycleCalendar'
import PartnerLoveBanner from '@/components/dashboard/PartnerLoveBanner'
import VibeCheckin from '@/components/dashboard/VibeCheckin'
import PCODRiskCard from '@/components/dashboard/PCODRiskCard'
import ChatAssistant from '@/components/dashboard/ChatAssistant'
import DailyLogPanel from '@/components/dashboard/DailyLogPanel'
import OnboardingModal from '@/components/dashboard/OnboardingModal'
import PredictionCard from '@/components/dashboard/PredictionCard'
import CycleHistoryCard from '@/components/dashboard/CycleHistoryCard'
import CervicalDischargeTracker from '@/components/dashboard/CervicalDischargeTracker'
import { useOffline } from '@/lib/OfflineContext'
import { useLocale, useTranslations } from 'next-intl'

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
  const { isLoaded, isSignedIn } = useAuth()
  const { user } = useUser()
  const { offlineClient } = useOffline()
  const now = new Date()
  const [activeNav, setActiveNav] = useState('Dashboard')
  const locale = useLocale()
  const tHeadings = useTranslations('headings')
  const tChat = useTranslations('Chat')
  
  // We keep activeLang to pass to legacy components temporarily. 
  // Map 'en' -> 'EN' and 'hi' -> 'हि'
  const activeLang = locale === 'hi' ? 'हि' : 'EN'
  const tCycle = useTranslations('cycle')
  
  const [viewYear, setViewYear] = useState(now.getFullYear())
  const [viewMonth, setViewMonth] = useState(now.getMonth()) // 0-indexed
  const [chatMessages, setChatMessages] = useState([])
  const [chatInput, setChatInput] = useState('')
  const [isTyping, setIsTyping] = useState(false)
  const [selectedSymptoms, setSelectedSymptoms] = useState([])
  const [selectedMood, setSelectedMood] = useState(null)
  const [selectedFlow, setSelectedFlow] = useState(null)
  const [selectedDischarge, setSelectedDischarge] = useState(null)
  const [saveTrigger, setSaveTrigger] = useState(0)
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
    if (!isLoaded) return
    if (!isSignedIn) {
      router.push(`/${locale}/auth/login`)
      return
    }
    if (!user) return

    const role = user?.publicMetadata?.role
    if (!role) {
      router.push(`/${locale}/onboarding`)
      return
    }
    if (role === 'partner') {
      router.push(`/${locale}/partner`)
      return
    }

    Promise.all([fetchCycleData(), fetchPCODRisk()])
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoaded, isSignedIn, user?.id, locale])

  // Set initial greeting once on mount (tChat is intentionally excluded from deps
  // because it creates a new reference every render and would cause an infinite loop)
  useEffect(() => {
    setChatMessages([{ role: 'ai', text: tChat('greeting') }])
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const fetchCycleData = async () => {
    try {
      const data = await offlineClient.fetchCycles()
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
      const data = await offlineClient.fetchPCODRisk() // PCOD risk calculates locally now if offline, maybe we need to pass encryptionKey there too if it fetches? Wait, fetchPCODRisk just reads IndexedDB which has decrypted data.
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
        text: tChat('error')
      }])
    }
  }

  const handleSaveLog = async () => {
    try {
      const logData = {
        date: new Date().toISOString().split('T')[0],
        symptoms: selectedSymptoms,
        mood: selectedMood,
        flow: selectedFlow,
        cervical_discharge: selectedDischarge
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
        setSelectedDischarge(null)
        setSaveTrigger(prev => prev + 1)
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
    text: tCycle('startTracking'),
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
      cycleDayInfo.phase = tCycle('menstrualPhase')
      cycleDayInfo.color = '#ff4757'
      cycleDayInfo.dot = '#ff4757'
    } else if (cycleDay >= 6 && cycleDay <= 11) {
      cycleDayInfo.phase = tCycle('follicularPhase')
      cycleDayInfo.color = '#a29bfe'
      cycleDayInfo.dot = '#a29bfe'
    } else if (cycleDay >= 12 && cycleDay <= 16) {
      cycleDayInfo.phase = tCycle('ovulationWindow')
      cycleDayInfo.color = '#00b894'
      cycleDayInfo.dot = '#00b894'
    } else if (cycleDay >= 17 && cycleDay <= 28) {
      cycleDayInfo.phase = tCycle('lutealPhase')
      cycleDayInfo.color = '#fdcb6e'
      cycleDayInfo.dot = '#fdcb6e'
    } else {
      cycleDayInfo.phase = tCycle('lateIrregular')
      cycleDayInfo.color = '#636e72'
      cycleDayInfo.dot = '#636e72'
    }
    
    if (cycleDay >= 1) {
      cycleDayInfo.text = tCycle('cycleDay', { day: cycleDay, phase: cycleDayInfo.phase })
    }
  }

  
  const latestCycle = getLatestCycle(cycleData?.cycles)

const periodStart =
  latestCycle?.start_date ||
  latestCycle?.period_start ||
  null

const periodEnd =
  latestCycle?.end_date ||
  latestCycle?.period_end ||
  null

const inferredPeriodLength = periodStart && periodEnd
  ? Math.max(
      1,
      Math.round(
        (
          new Date(`${periodEnd}T00:00:00`) -
          new Date(`${periodStart}T00:00:00`)
        ) / 86400000
      ) + 1
    )
  : 5

const phaseInfo = calculateCyclePhase({
  periodStart,
  cycleLength:
    latestCycle?.cycle_length ||
    cycleData?.averageCycleLength ||
    28,
  periodLength: inferredPeriodLength,
})

  return (
    <>
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
              <h2>{tHeadings('log')} 💕</h2>
              <button className="drawer-close" onClick={closeLogDrawer} aria-label="Close">✕</button>
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
            currentMonth={`${new Intl.DateTimeFormat(locale === 'hi' ? 'hi-IN' : 'en-US', { month: 'long' }).format(new Date(viewYear, viewMonth))} ${viewYear}`}
            onPrevMonth={goToPrevMonth}
            onNextMonth={goToNextMonth}
            averageCycleLength={cycleData?.averageCycleLength || 28}
            daysUntilNext={daysUntilNext}
            activeLang={activeLang}
          />
        </div>
        
        <div style={{ marginTop: '1.5rem' }}>
        <CyclePhaseCard
        phaseKey={phaseInfo.phaseKey}
        cycleDay={phaseInfo.cycleDay}
        ovulationDay={phaseInfo.ovulationDay}
        hasData={phaseInfo.hasData}
        />
        </div>

        <VibeCheckin />
        <PartnerLoveBanner />

        <h2 className="sec-head" id="pcod-risk-section">{tHeadings('insights')}</h2>
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

        <h2 className="sec-head">{tHeadings('log')}</h2>
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

        <div className="half-row">
          <CycleHistoryCard cycleData={cycleData} />
          <CervicalDischargeTracker 
            selectedDischarge={selectedDischarge} 
            setSelectedDischarge={setSelectedDischarge} 
            saveTrigger={saveTrigger} 
          />
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
