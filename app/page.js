'use client'

import { useState, useEffect } from 'react'

import Navbar from '@/components/layout/Navbar'
import Footer from '@/components/layout/Footer'
import HeroSection from '@/components/dashboard/HeroSection'
import CycleCalendar from '@/components/dashboard/CycleCalendar'
import FeaturesSection from '@/components/dashboard/FeaturesSection'
import PCODRiskCard from '@/components/dashboard/PCODRiskCard'
import ChatAssistant from '@/components/dashboard/ChatAssistant'
import DailyLogPanel from '@/components/dashboard/DailyLogPanel'

const HerCycleApp = () => {
  const [activeNav, setActiveNav] = useState('Dashboard')
  const [activeLang, setActiveLang] = useState('EN')
  const [currentMonth, setCurrentMonth] = useState('April 2026')
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

  useEffect(() => {
    fetchCycleData()
    fetchPCODRisk()
  }, [])

  const fetchCycleData = async () => {
    try {
      const response = await fetch('/api/cycles')
      const data = await response.json()
      if (data.success) {
        setCycleData(data.data)
      }
    } catch (error) {
      console.error('Error fetching cycle data:', error)
    }
  }

  const fetchPCODRisk = async () => {
    try {
      const response = await fetch('/api/pcod-risk')
      const data = await response.json()
      if (data.success) {
        setPcodRisk(data.data)
      }
    } catch (error) {
      console.error('Error fetching PCOD risk:', error)
    }
  }

  const handleSendMessage = async () => {
    if (!chatInput.trim()) return

    const userMessage = chatInput
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
          context: cycleData 
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
        alert('Day logged successfully! 💕')
        setSelectedSymptoms([])
        setSelectedMood(null)
        setSelectedFlow(null)
        fetchCycleData()
      }
    } catch (error) {
      console.error('Error logging day:', error)
      alert('Failed to log day. Please try again.')
    }
  }

  const toggleSymptom = (symptom) => {
    setSelectedSymptoms(prev => 
      prev.includes(symptom) 
        ? prev.filter(s => s !== symptom)
        : [...prev, symptom]
    )
  }

  const generateCalendarDays = () => {
    const days = []
    const headers = ['S', 'M', 'T', 'W', 'T', 'F', 'S']
    
    headers.forEach(h => days.push({ type: 'header', label: h }))
    
    const prevMonthDays = [29, 30, 31]
    prevMonthDays.forEach(d => days.push({ type: 'empty', label: d }))
    
    for (let i = 1; i <= 30; i++) {
      let dayType = 'normal'
      if (i === 10) dayType = 'today'
      if (i >= 1 && i <= 5) dayType = 'period'
      if (i >= 27 && i <= 30) dayType = 'predicted'
      if (i >= 13 && i <= 15) dayType = 'ovulation'
      days.push({ type: dayType, label: i })
    }
    
    return days
  }

  const calendarDays = generateCalendarDays()

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

      <div className="page">
        <Navbar 
          activeNav={activeNav} 
          setActiveNav={setActiveNav} 
          activeLang={activeLang} 
          setActiveLang={setActiveLang} 
        />

        <div className="hero">
          <HeroSection />
          <CycleCalendar 
            calendarDays={calendarDays} 
            currentMonth={currentMonth} 
            setCurrentMonth={setCurrentMonth} 
          />
        </div>

        <FeaturesSection />

        <h2 className="sec-head">Health Insights</h2>
        <div className="dual-row">
          <PCODRiskCard pcodRisk={pcodRisk} />
          <ChatAssistant 
            chatMessages={chatMessages} 
            isTyping={isTyping} 
            chatInput={chatInput} 
            setChatInput={setChatInput} 
            handleSendMessage={handleSendMessage} 
            activeLang={activeLang} 
          />
        </div>

        <h2 className="sec-head">Log Your Day</h2>
        <div className="bottom-grid">
          <DailyLogPanel 
            selectedSymptoms={selectedSymptoms} 
            toggleSymptom={toggleSymptom} 
            selectedMood={selectedMood} 
            setSelectedMood={setSelectedMood} 
            selectedFlow={selectedFlow} 
            setSelectedFlow={setSelectedFlow} 
            handleSaveLog={handleSaveLog} 
            cycleData={cycleData} 
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