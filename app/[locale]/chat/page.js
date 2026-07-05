'use client'

import { useState, useEffect } from 'react'
import { useAuth } from '@clerk/nextjs'
import Navbar from '@/components/layout/Navbar'
import Footer from '@/components/layout/Footer'
import ChatAssistant from '@/components/dashboard/ChatAssistant'
import { useTranslations, useLocale } from 'next-intl'
import { useRouter } from 'next/navigation'
import { useOffline } from '@/lib/OfflineContext'

export default function ChatPage() {
  const t = useTranslations('pages.chat')
  const tChat = useTranslations('Chat')
  const locale = useLocale()
  const router   = useRouter()
  const { isLoaded, isSignedIn } = useAuth()
  const { offlineClient } = useOffline()

  const [cycleData,     setCycleData]     = useState(null)
  const [chatMessages,  setChatMessages]  = useState([])
  const [chatInput,   setChatInput]   = useState('')
  const [isTyping,    setIsTyping]    = useState(false)

  useEffect(() => {
    if (!isLoaded) return
    if (!isSignedIn) { router.push('/auth/login'); return }
    
    const init = async () => {
      try {
        const data = await offlineClient.fetchCycles()
        if (data.success) setCycleData(data.data)
      } catch (err) {
        console.error('Failed to fetch cycles', err)
      }
    }
    init()
    
    // Set initial greeting after mount to avoid hydration mismatch
    setChatMessages([{ role: 'ai', text: tChat('greeting') }])
  }, [isLoaded, isSignedIn, router, offlineClient, tChat])

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
        body: JSON.stringify({ message: userMessage, language: locale, context: cycleData }),
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
        text: tChat('error'),
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
            🤖 <span className="gradient-text">{t('title')}</span>
          </h1>
          <p style={{ color: 'rgba(255,255,255,0.65)', marginBottom: '1.5rem' }}>
            {t('subtitle')}
          </p>

        <div style={{ flex: 1 }}>
            <ChatAssistant
              chatMessages={chatMessages}
              isTyping={isTyping}
              chatInput={chatInput}
              setChatInput={setChatInput}
              handleSendMessage={handleSendMessage}
              nextPeriodDate={cycleData?.nextPeriodDate}
            />
          </div>
        </div>

        <Footer />
      </div>
    </>
  )
}
