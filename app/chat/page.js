'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase-client'
import Navbar from '@/components/layout/Navbar'
import Footer from '@/components/layout/Footer'
import ChatAssistant from '@/components/dashboard/ChatAssistant'

export default function ChatPage() {
  const router   = useRouter()
  const supabase = createClient()

  const [cycleData,     setCycleData]     = useState(null)
  const [chatMessages,  setChatMessages]  = useState([
    { role: 'ai', text: "Hello! I'm your HerCycle AI health assistant. Ask me anything about your cycle or health. 💕" }
  ])
  const [chatInput,   setChatInput]   = useState('')
  const [isTyping,    setIsTyping]    = useState(false)

  useEffect(() => {
    const init = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) { router.push('/auth/login'); return }

      const res  = await fetch('/api/cycles')
      const data = await res.json()
      if (data.success) setCycleData(data.data)
    }
    init()
  }, [router, supabase.auth])

  const handleSendMessage = async (directMessage) => {
    const userMessage = directMessage || chatInput
    if (!userMessage.trim()) return

    setChatMessages(prev => [...prev, { role: 'user', text: userMessage }])
    setChatInput('')
    setIsTyping(true)

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: userMessage, language: 'EN', context: cycleData }),
      })
      const data = await res.json()
      setIsTyping(false)
      if (data.success) {
        setChatMessages(prev => [...prev, { role: 'ai', text: data.response }])
      }
    } catch {
      setIsTyping(false)
      setChatMessages(prev => [...prev, {
        role: 'ai',
        text: 'Sorry, I encountered an error. Please try again.',
      }])
    }
  }

  return (
    <>
      <div className="blob"></div>
      <div className="blob"></div>
      <div className="page">
        <Navbar />

        <div style={{
          maxWidth: 780,
          margin: '0 auto',
          padding: '2rem 1.5rem',
          display: 'flex',
          flexDirection: 'column',
          minHeight: 'calc(100vh - 80px)',
        }}>
          <h1 style={{ fontSize: '2rem', marginBottom: '0.25rem' }}>
            🤖 <span className="gradient-text">Health Assistant</span>
          </h1>
          <p style={{ color: 'rgba(255,255,255,0.65)', marginBottom: '1.5rem' }}>
            Ask me anything about your cycle, symptoms, or reproductive health.
          </p>

          <div style={{ flex: 1 }}>
            <ChatAssistant
              chatMessages={chatMessages}
              isTyping={isTyping}
              chatInput={chatInput}
              setChatInput={setChatInput}
              handleSendMessage={handleSendMessage}
              activeLang="EN"
              nextPeriodDate={cycleData?.nextPeriodDate}
            />
          </div>
        </div>

        <Footer />
      </div>
    </>
  )
}
