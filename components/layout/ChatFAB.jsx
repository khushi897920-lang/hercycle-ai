'use client'

import { useState, useEffect } from 'react'
import { usePathname, useSearchParams, useRouter } from 'next/navigation'
import { useLocale, useTranslations } from 'next-intl'
import { MessageCircle, X } from 'lucide-react'
import ChatAssistant from '@/components/dashboard/ChatAssistant'
import { useOffline } from '@/lib/OfflineContext'

export default function ChatFAB() {
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const router = useRouter()
  const locale = useLocale()
  const { offlineClient } = useOffline()

  const isChatOpen = searchParams.get('chat') === 'open'
  const [isOpen, setIsOpen] = useState(isChatOpen)
  const [isRendered, setIsRendered] = useState(isChatOpen)
  const [isAnimatingOut, setIsAnimatingOut] = useState(false)

  useEffect(() => {
    setIsOpen(searchParams.get('chat') === 'open')
  }, [searchParams])

  useEffect(() => {
    if (isOpen) {
      setIsRendered(true)
      setIsAnimatingOut(false)
    } else if (isRendered) {
      setIsAnimatingOut(true)
      const timer = setTimeout(() => {
        setIsRendered(false)
        setIsAnimatingOut(false)
      }, 300)
      return () => clearTimeout(timer)
    }
  }, [isOpen, isRendered])

  const toggleChat = () => {
    const nextState = !isOpen
    setIsOpen(nextState) // Optimistic immediate update for zero delay

    const newParams = new URLSearchParams(searchParams.toString())
    if (nextState) {
      newParams.set('chat', 'open')
    } else {
      newParams.delete('chat')
    }
    // Only add ? query if there are params, else just push pathname
    const query = newParams.toString()
    router.push(query ? `${pathname}?${query}` : pathname, { scroll: false })
  }

  // Chat State
  const [cycleData, setCycleData] = useState(null)
  const [chatMessages, setChatMessages] = useState([])
  const [chatInput, setChatInput] = useState('')
  const [isTyping, setIsTyping] = useState(false)

  const tChat = useTranslations('Chat')

  // Load chat context when opened
  useEffect(() => {
    if (isOpen && chatMessages.length === 0) {
      setChatMessages([{ role: 'ai', text: tChat('greeting') }])
      const init = async () => {
        try {
          const data = await offlineClient.fetchCycles()
          if (data.success) setCycleData(data.data)
        } catch (err) {
          console.error(err)
        }
      }
      init()
    }
  }, [isOpen, chatMessages.length, offlineClient, tChat])

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

  const tNavbar = useTranslations('Navbar')

  if (pathname?.includes('/auth') || pathname?.includes('/sign-in') || pathname?.includes('/sign-up') || pathname?.includes('/login') || pathname?.includes('/partner') || pathname?.includes('/onboarding')) {
    return null
  }

  return (
    <>
      {/* Floating Window */}
      {isRendered && (
        <div
          className={`fixed bottom-6 right-4 sm:right-8 sm:bottom-8 z-[100] w-[calc(100vw-32px)] sm:w-[420px] h-[600px] max-h-[85vh] flex flex-col shadow-2xl rounded-3xl overflow-hidden ${isAnimatingOut
              ? 'animate-out zoom-out-95 slide-out-to-bottom-10 fade-out duration-300'
              : 'animate-in zoom-in-95 slide-in-from-bottom-10 fade-in duration-300'
            }`}
          style={{
            background: 'var(--glass-bg)',
            backdropFilter: 'blur(32px) saturate(1.5)',
            WebkitBackdropFilter: 'blur(32px) saturate(1.5)',
            border: '1px solid var(--glass-edge)'
          }}
        >
          {/* Header */}
          <div className="flex justify-between items-center px-5 py-4 border-b border-white/20 bg-white/10 shadow-sm">
            <h3 className="text-white font-bold text-lg font-serif flex items-center gap-2">
              <span className="text-2xl">🤖</span> {tChat('header')}
            </h3>
            <button
              onClick={toggleChat}
              className="text-white/70 hover:text-white bg-white/5 hover:bg-white/20 p-1.5 rounded-full transition-colors"
              aria-label="Close Chat"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Content Area - ChatAssistant fills this */}
          <div className="flex-1 overflow-hidden p-0 relative chat-floating-container">
            <style jsx global>{`
              /* Override ChatAssistant card styles to fit seamlessly in the modal */
              .chat-floating-container .chat-card {
                box-shadow: none !important;
                border: none !important;
                background: transparent !important;
                backdrop-filter: none !important;
                -webkit-backdrop-filter: none !important;
                margin: 0 !important;
                height: 100% !important;
                width: 100% !important;
                border-radius: 0 !important;
                display: flex;
                flex-direction: column;
                overflow: hidden !important;
              }
              .chat-floating-container .chat-header {
                display: none !important; /* Hide original header since modal has one */
              }
              .chat-floating-container .chat-messages {
                flex: 1;
                max-height: none !important;
                overflow-y: auto;
                overflow-x: hidden;
              }
              .chat-floating-container .chat-input-row {
                flex-shrink: 0;
              }
            `}</style>

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
      )}

      {/* Trigger Button (FAB) */}
      {!isRendered && (
        <button
          onClick={toggleChat}
          className="fixed bottom-6 right-6 sm:bottom-8 sm:right-8 z-[100] flex items-center justify-center w-14 h-14 rounded-full bg-gradient-to-tr from-pink-500 to-rose-400 text-white shadow-lg shadow-pink-500/40 hover:shadow-pink-500/60 hover:scale-110 hover:-translate-y-1 transition-all duration-300 outline-none focus-visible:ring-4 focus-visible:ring-pink-500/50"
          aria-label={tNavbar('chat')}
        >
          <MessageCircle className="w-7 h-7 animate-in zoom-in duration-300" />
        </button>
      )}
    </>
  )
}
