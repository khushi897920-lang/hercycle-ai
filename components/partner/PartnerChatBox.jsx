'use client'

import { useState, useEffect, useRef } from 'react'
import { Heart, Send, Trash2, Reply, Sparkles, Clock, X, MessageSquare, Check, CheckCheck, RefreshCw } from 'lucide-react'
import toast from 'react-hot-toast'
import { sendPartnerNudge, deletePartnerNudge, clearPartnerNudges, markPartnerNudgesAsRead } from '@/lib/actions/partner'
import { sendDeviceNotification } from '@/lib/utils/notifications'

const PRESET_CHIPS = [
  { label: 'Send Hug 🫂', type: 'hug', msg: '🫂 Sent a virtual hug!' },
  { label: 'Offer Tea 🍵', type: 'tea', msg: '🍵 Offered hot chamomile tea!' },
  { label: 'Bring Snacks 🍫', type: 'snack', msg: '🍫 Brought chocolate & snacks!' },
  { label: 'Drink Water 💧', type: 'water', msg: '💧 Hydration reminder!' },
]

function formatTime(dateStr) {
  if (!dateStr) return ''
  const d = new Date(dateStr)
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}

function getActiveStatus(nudges) {
  if (!nudges || nudges.length === 0) return { label: 'Active now', isOnline: true }
  const latestDate = new Date(nudges[nudges.length - 1].created_at)
  const diffMins = Math.floor((Date.now() - latestDate.getTime()) / 60000)

  if (isNaN(diffMins) || diffMins < 2) {
    return { label: 'Active now', isOnline: true }
  } else if (diffMins < 60) {
    return { label: `Active ${diffMins}m ago`, isOnline: false }
  } else {
    const hrs = Math.floor(diffMins / 60)
    if (hrs < 24) return { label: `Active ${hrs}h ago`, isOnline: false }
    const days = Math.floor(hrs / 24)
    return { label: `Active ${days}d ago`, isOnline: false }
  }
}

export default function PartnerChatBox({ nudges = [], currentUserId, onRefresh, title = "Partner Love Chat 💌", showPresetChips = true }) {
  const [inputText, setInputText] = useState('')
  const [quotedNudge, setQuotedNudge] = useState(null)
  const [sending, setSending] = useState(false)
  const [deletingId, setDeletingId] = useState(null)
  const chatContainerRef = useRef(null)
  const chatBottomRef = useRef(null)

  const activeStatus = getActiveStatus(nudges)

  const isNearBottom = () => {
    const el = chatContainerRef.current
    if (!el) return true
    return el.scrollHeight - el.scrollTop - el.clientHeight < 140
  }

  // Respect user scroll position & mark incoming messages as read
  useEffect(() => {
    if (isNearBottom()) {
      chatBottomRef.current?.scrollIntoView({ behavior: 'smooth' })
    }
    markPartnerNudgesAsRead().catch(() => {})
  }, [nudges?.length])

  const scrollToBottomExplicit = () => {
    setTimeout(() => {
      chatBottomRef.current?.scrollIntoView({ behavior: 'smooth' })
    }, 50)
  }

  const handleSend = async (e) => {
    e?.preventDefault()
    let msgToSend = inputText.trim()
    if (!msgToSend && !quotedNudge) return

    if (quotedNudge) {
      const quoteSnippet = quotedNudge.message || `Sent ${quotedNudge.nudge_type}`
      msgToSend = `Replying to "${quoteSnippet}": ${msgToSend}`
    }

    setSending(true)
    try {
      await sendPartnerNudge('letter', msgToSend || 'Sent a love note 💕')
      sendDeviceNotification('New Love Note 💌', msgToSend || 'Sent a love note 💕')
      setInputText('')
      setQuotedNudge(null)
      scrollToBottomExplicit()
      if (onRefresh) onRefresh()
    } catch (err) {
      toast.error(err.message || 'Failed to send message')
    } finally {
      setSending(false)
    }
  }

  const handleSendChip = async (chip) => {
    try {
      await sendPartnerNudge(chip.type, chip.msg)
      scrollToBottomExplicit()
      if (onRefresh) onRefresh()
    } catch (err) {
      toast.error(err.message || 'Failed to send nudge')
    }
  }

  const handleDeleteSingle = async (nudgeId) => {
    if (!confirm('Delete this message?')) return
    setDeletingId(nudgeId)
    try {
      await deletePartnerNudge(nudgeId)
      toast.success('Message deleted')
      if (onRefresh) onRefresh()
    } catch (err) {
      toast.error(err.message || 'Failed to delete message')
    } finally {
      setDeletingId(null)
    }
  }

  const handleClearAll = async () => {
    if (!confirm('Are you sure you want to clear all chat messages for both of you?')) return
    try {
      await clearPartnerNudges()
      toast.success('All chat history cleared')
      if (onRefresh) onRefresh()
    } catch (err) {
      toast.error(err.message || 'Failed to clear chat')
    }
  }

  return (
    <div className="w-full flex flex-col h-[500px] max-h-[80vh] rounded-3xl bg-slate-950/80 border border-rose-400/30 shadow-2xl backdrop-blur-xl overflow-hidden relative">
      
      {/* Chat Header */}
      <div className="px-5 py-4 bg-gradient-to-r from-rose-900/40 via-purple-900/40 to-slate-950/60 border-b border-white/10 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-rose-500/20 border border-rose-500/40 flex items-center justify-center">
            <Heart className="w-5 h-5 text-rose-300 fill-rose-300 animate-pulse" />
          </div>
          <div>
            <h3 className="text-white font-bold text-base flex items-center gap-2">
              {title}
            </h3>
            <p className="text-white/50 text-xs flex items-center gap-1.5 font-sans">
              <span className={`w-2 h-2 rounded-full ${activeStatus.isOnline ? 'bg-emerald-400 animate-pulse' : 'bg-white/40'}`}></span>
              <span>{activeStatus.label}</span>
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {onRefresh && (
            <button
              onClick={onRefresh}
              className="p-2 rounded-xl bg-white/5 hover:bg-white/10 text-white/70 hover:text-white transition-colors"
              title="Refresh Chat"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
          )}
          {nudges.length > 0 && (
            <button
              onClick={handleClearAll}
              className="flex items-center gap-1 text-xs text-red-300 hover:text-red-200 bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 px-3 py-1.5 rounded-xl transition-all"
              title="Clear Entire Chat"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Clear Chat</span>
            </button>
          )}
        </div>
      </div>

      {/* Chat Bubbles Container */}
      <div ref={chatContainerRef} className="flex-1 overflow-y-auto p-4 space-y-3 scrollbar-thin scrollbar-thumb-white/20">
        {nudges.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center p-6 text-white/40">
            <MessageSquare className="w-12 h-12 text-white/20 mb-2" />
            <p className="text-sm font-medium">No messages yet!</p>
            <p className="text-xs">Send a 1-click nudge below or write your first love note 💌</p>
          </div>
        ) : (
          nudges.map((nudge, index) => {
            // Determine if message was sent by me or partner
            const isMe = currentUserId && nudge.sender_id ? nudge.sender_id === currentUserId : index % 2 === 1
            const isNudgeType = ['hug', 'tea', 'snack', 'water'].includes(nudge.nudge_type)

            return (
              <div
                key={nudge.id || index}
                className={`group relative flex flex-col ${isMe ? 'items-end' : 'items-start'} max-w-[85%] ${isMe ? 'ml-auto' : 'mr-auto'}`}
              >
                {/* Bubble */}
                <div
                  className={`relative p-3.5 rounded-2xl text-sm leading-relaxed shadow-lg border transition-all ${
                    isMe
                      ? 'bg-gradient-to-r from-rose-600 to-pink-600 text-white border-rose-400/40 rounded-br-none'
                      : 'bg-purple-950/60 text-rose-100 border-purple-400/30 rounded-bl-none'
                  }`}
                >
                  <p className="whitespace-pre-wrap font-sans">{nudge.message || `Sent a ${nudge.nudge_type} 💕`}</p>

                  <div className={`flex items-center gap-1.5 mt-1 text-[10px] ${isMe ? 'text-rose-100/70 justify-end' : 'text-purple-200/60 justify-start'}`}>
                    <span>{formatTime(nudge.created_at)}</span>
                    {isMe && (
                      <span title={nudge.read_at ? "Read by partner" : "Delivered"}>
                        {nudge.read_at ? (
                          <CheckCheck className="w-3.5 h-3.5 text-sky-400 font-bold" />
                        ) : (
                          <Check className="w-3 h-3 text-white/70" />
                        )}
                      </span>
                    )}
                  </div>
                </div>

                {/* Individual Action Buttons (Hover / Touch) */}
                <div className={`flex items-center gap-1 mt-1 opacity-80 group-hover:opacity-100 transition-opacity ${isMe ? 'flex-row-reverse' : 'flex-row'}`}>
                  <button
                    onClick={() => setQuotedNudge(nudge)}
                    className="p-1 rounded-full text-white/40 hover:text-white hover:bg-white/10 text-[11px] flex items-center gap-1"
                    title="Reply to message"
                  >
                    <Reply className="w-3 h-3" />
                    <span>Reply</span>
                  </button>

                  <button
                    onClick={() => handleDeleteSingle(nudge.id)}
                    disabled={deletingId === nudge.id}
                    className="p-1 rounded-full text-red-400/60 hover:text-red-300 hover:bg-red-500/10 text-[11px] flex items-center gap-1"
                    title="Delete message"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                </div>
              </div>
            )
          })
        )}
        <div ref={chatBottomRef} />
      </div>

      {/* Quoted Message Preview (if replying) */}
      {quotedNudge && (
        <div className="px-4 py-2 bg-rose-500/20 border-t border-rose-400/30 flex items-center justify-between text-xs text-rose-200 shrink-0">
          <div className="flex items-center gap-2 truncate">
            <Reply className="w-3.5 h-3.5 text-rose-300 shrink-0" />
            <span className="truncate">Replying to: "{quotedNudge.message || quotedNudge.nudge_type}"</span>
          </div>
          <button
            onClick={() => setQuotedNudge(null)}
            className="p-1 rounded-full hover:bg-white/10 text-white/60 hover:text-white"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* 1-Click Preset Chips Bar */}
      {showPresetChips && (
        <div className="px-3 py-2 bg-black/40 border-t border-white/10 flex gap-2 overflow-x-auto shrink-0 scrollbar-none">
          {PRESET_CHIPS.map((chip, idx) => (
            <button
              key={idx}
              onClick={() => handleSendChip(chip)}
              className="text-xs px-3 py-1.5 rounded-full bg-white/5 hover:bg-white/15 border border-white/10 text-white/90 whitespace-nowrap transition-all flex items-center gap-1 shrink-0"
            >
              <span>{chip.label}</span>
            </button>
          ))}
        </div>
      )}

      {/* Textarea Input Form */}
      <form onSubmit={handleSend} className="p-3 bg-slate-950 border-t border-white/10 flex items-center gap-2 shrink-0">
        <input
          type="text"
          value={inputText}
          onChange={(e) => setInputText(e.target.value)}
          placeholder="Write a love note or message..."
          className="flex-1 bg-white/5 border border-white/10 text-white placeholder-white/40 px-4 py-2.5 rounded-2xl text-xs focus:outline-none focus:ring-2 focus:ring-rose-400"
          maxLength={300}
        />
        <button
          type="submit"
          disabled={sending || (!inputText.trim() && !quotedNudge)}
          className="bg-gradient-to-r from-rose-500 to-pink-500 hover:from-rose-600 hover:to-pink-600 text-white p-2.5 rounded-2xl text-xs font-semibold shadow-lg transition-all disabled:opacity-40 shrink-0"
        >
          <Send className="w-4 h-4" />
        </button>
      </form>
    </div>
  )
}
