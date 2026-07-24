'use client'

import { useState, useEffect, useRef } from 'react'
import { Bot, Sparkles, Send, RefreshCw, User, X, MessageSquare } from 'lucide-react'
import toast from 'react-hot-toast'

// Dynamic suggestion chips per cycle phase
const PHASE_SUGGESTIONS = {
  Menstrual: [
    'How to help with cramps? 🩹',
    'Best warm herbal drinks 🍵',
    'Heating pad & rest advice 🛌',
    'Comfort snacks 🍫',
  ],
  Follicular: [
    'High energy date ideas 🚴‍♂️',
    'Nutritional meals for energy 🥑',
    'Supporting her new projects 🌟',
    'Fun outdoor activities 🌅',
  ],
  Ovulation: [
    'Romantic dinner ideas 🍷',
    'Fertile window tips 🌸',
    'Compliments & affection 💖',
    'Social outing ideas 🎟️',
  ],
  Luteal: [
    'PMS comfort & patience 🍫',
    'How to handle mood shifts? 💕',
    'Cozy movie night setup 🍿',
    'Relaxing back massage tips 💆‍♂️',
  ]
}

function formatTime() {
  return new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}

export default function AIPartnerCoach({ phase = 'Follicular', cycleDay = 1, symptoms = [] }) {
  const [isOpen, setIsOpen] = useState(false)
  const [messages, setMessages] = useState([])
  const [loading, setLoading] = useState(true)
  const [inputText, setInputText] = useState('')
  const [isTyping, setIsTyping] = useState(false)
  const chatBottomRef = useRef(null)

  const symptomsKey = JSON.stringify(symptoms || [])
  const currentSuggestions = PHASE_SUGGESTIONS[phase] || PHASE_SUGGESTIONS.Follicular

  // Re-fetch briefing when her phase, cycle day, or logged symptoms change
  useEffect(() => {
    fetchInitialBriefing()
  }, [phase, cycleDay, symptomsKey])

  useEffect(() => {
    if (isOpen) {
      chatBottomRef.current?.scrollIntoView({ behavior: 'smooth' })
    }
  }, [messages, isTyping, isOpen])

  const fetchInitialBriefing = async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/partner-coach', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phase, cycleDay, symptoms, query: '' })
      })
      const data = await res.json()
      if (data.reply) {
        setMessages([
          {
            id: 'briefing-' + Date.now(),
            sender: 'ai',
            text: data.reply,
            time: formatTime()
          }
        ])
      }
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }

  const handleSendMessage = async (textToSend) => {
    const queryText = (textToSend || inputText).trim()
    if (!queryText || isTyping) return

    const userMsg = {
      id: 'user-' + Date.now(),
      sender: 'user',
      text: queryText,
      time: formatTime()
    }

    setMessages((prev) => [...prev, userMsg])
    setInputText('')
    setIsTyping(true)

    try {
      const res = await fetch('/api/partner-coach', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phase, cycleDay, symptoms, query: queryText })
      })
      const data = await res.json()

      const aiMsg = {
        id: 'ai-' + Date.now(),
        sender: 'ai',
        text: data.reply || "I'm here to support you in helping her!",
        time: formatTime()
      }

      setMessages((prev) => [...prev, aiMsg])
    } catch (err) {
      console.error(err)
      toast.error('Failed to get AI answer')
    } finally {
      setIsTyping(false)
    }
  }

  const handleClearChat = () => {
    fetchInitialBriefing()
    toast.success('AI Chat reset')
  }

  return (
    <>
      {/* FLOATING ACTION BUTTON (FAB) - Matching Main Dashboard Chat FAB */}
      {!isOpen && (
        <button
          onClick={() => setIsOpen(true)}
          className="fixed bottom-6 right-6 sm:bottom-8 sm:right-8 z-[100] flex items-center justify-center w-14 h-14 rounded-full bg-gradient-to-tr from-pink-500 to-rose-400 text-white shadow-lg shadow-pink-500/40 hover:shadow-pink-500/60 hover:scale-110 hover:-translate-y-1 transition-all duration-300 outline-none focus-visible:ring-4 focus-visible:ring-pink-500/50"
          aria-label="AI Partner Coach"
          title="AI Partner Coach"
        >
          <Bot className="w-7 h-7 animate-in zoom-in duration-300" />
        </button>
      )}

      {/* FLOATING CHATBOT WINDOW - Matching Main Dashboard Glass Style & Alignment */}
      {isOpen && (
        <div
          className="fixed bottom-6 right-6 sm:bottom-8 sm:right-8 z-[100] w-[calc(100vw-2rem)] sm:w-[420px] h-[550px] max-h-[80vh] flex flex-col rounded-[2rem] shadow-2xl overflow-hidden transition-all duration-300 animate-in zoom-in-95 slide-in-from-bottom-10 fade-in"
          style={{
            background: 'var(--glass-bg)',
            backdropFilter: 'blur(32px) saturate(1.5)',
            WebkitBackdropFilter: 'blur(32px) saturate(1.5)',
            border: '1px solid var(--glass-edge)'
          }}
        >
          {/* Header */}
          <div className="flex justify-between items-center px-5 py-4 border-b border-white/20 bg-white/10 shadow-sm shrink-0">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-2xl bg-pink-500/20 border border-pink-500/40 flex items-center justify-center shrink-0">
                <Bot className="w-5 h-5 text-pink-300" />
              </div>
              <div>
                <h3 className="text-white font-bold text-base font-serif flex items-center gap-1">
                  AI Partner Coach <Sparkles className="w-4 h-4 text-amber-300" />
                </h3>
                <p className="text-white/60 text-xs flex items-center gap-1 font-sans">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                  Active for {phase} phase (Day {cycleDay})
                </p>
              </div>
            </div>

            <div className="flex items-center gap-1.5">
              <button
                onClick={handleClearChat}
                className="text-white/70 hover:text-white bg-white/5 hover:bg-white/20 p-1.5 rounded-full transition-colors"
                title="Reset Chat"
              >
                <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
              </button>
              <button
                onClick={() => setIsOpen(false)}
                className="text-white/70 hover:text-white bg-white/5 hover:bg-white/20 p-1.5 rounded-full transition-colors"
                aria-label="Close Chat"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Messages Stream */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3 scrollbar-thin scrollbar-thumb-white/20 relative z-10">
            {loading ? (
              <div className="h-full flex items-center justify-center text-white/40 text-xs animate-pulse font-sans">
                Loading AI Partner Coach for {phase} phase...
              </div>
            ) : (
              messages.map((msg) => {
                const isUser = msg.sender === 'user'
                return (
                  <div
                    key={msg.id}
                    className={`flex items-start gap-2.5 max-w-[85%] ${isUser ? 'ml-auto flex-row-reverse' : 'mr-auto'}`}
                  >
                    <div
                      className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 text-xs font-bold ${
                        isUser ? 'bg-pink-500 text-white' : 'bg-purple-500/30 text-purple-200 border border-purple-400/40'
                      }`}
                    >
                      {isUser ? <User className="w-4 h-4" /> : <Bot className="w-4 h-4" />}
                    </div>

                    <div
                      className={`p-3.5 rounded-2xl text-xs md:text-sm leading-relaxed shadow-sm border ${
                        isUser
                          ? 'bg-gradient-to-r from-pink-600 to-rose-600 text-white border-pink-400/40 rounded-tr-none'
                          : 'bg-white/10 text-white border-white/20 rounded-tl-none'
                      }`}
                    >
                      <p className="whitespace-pre-wrap font-sans">{msg.text}</p>
                      <span className={`block text-[10px] mt-1 ${isUser ? 'text-white/70 text-right' : 'text-white/50'}`}>
                        {msg.time}
                      </span>
                    </div>
                  </div>
                )
              })
            )}

            {isTyping && (
              <div className="flex items-center gap-2 text-white/60 text-xs italic p-1 font-sans">
                <Bot className="w-4 h-4 animate-spin text-pink-300" />
                <span>AI Coach is typing...</span>
              </div>
            )}
            <div ref={chatBottomRef} />
          </div>

          {/* Dynamic Phase Suggestion Chips */}
          <div className="px-3 py-2 bg-black/30 border-t border-white/10 flex gap-2 overflow-x-auto shrink-0 scrollbar-none">
            {currentSuggestions.map((sug, idx) => (
              <button
                key={idx}
                onClick={() => handleSendMessage(sug)}
                disabled={isTyping}
                className="text-xs px-3 py-1.5 rounded-full bg-white/10 hover:bg-white/20 border border-white/15 text-white/90 whitespace-nowrap transition-all shrink-0 disabled:opacity-50 font-sans"
              >
                {sug}
              </button>
            ))}
          </div>

          {/* Input Form */}
          <form
            onSubmit={(e) => {
              e.preventDefault()
              handleSendMessage()
            }}
            className="p-3 bg-white/5 border-t border-white/10 flex items-center gap-2 shrink-0"
          >
            <input
              type="text"
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              placeholder={`Ask AI Coach about ${phase} phase...`}
              className="flex-1 bg-black/20 border border-white/15 text-white placeholder-white/40 px-4 py-2.5 rounded-2xl text-xs focus:outline-none focus:ring-2 focus:ring-pink-400 font-sans"
            />
            <button
              type="submit"
              disabled={isTyping || !inputText.trim()}
              className="bg-gradient-to-tr from-pink-500 to-rose-400 hover:from-pink-600 hover:to-rose-500 text-white p-2.5 rounded-2xl text-xs font-semibold shadow-lg transition-all disabled:opacity-40 shrink-0"
            >
              <Send className="w-4 h-4" />
            </button>
          </form>
        </div>
      )}
    </>
  )
}
