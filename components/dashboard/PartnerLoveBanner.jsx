'use client'

import { useState, useEffect } from 'react'
import { Heart, Mail, Sparkles, Send, X, Clock, MessageSquare } from 'lucide-react'
import toast from 'react-hot-toast'
import { getPrimaryPartnerNudges } from '@/lib/actions/partner'
import PartnerChatBox from '@/components/partner/PartnerChatBox'

function timeAgo(dateStr) {
  if (!dateStr) return null
  const diff = Date.now() - new Date(dateStr).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'Just now'
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  const days = Math.floor(hrs / 24)
  return `${days}d ago`
}

export default function PartnerLoveBanner() {
  const [mounted, setMounted] = useState(false)
  const [data, setData] = useState({ connected: false, nudges: [], currentUserId: null })
  const [loading, setLoading] = useState(true)
  const [isChatOpen, setIsChatOpen] = useState(false)
  const [lastSeenTime, setLastSeenTime] = useState(0)

  useEffect(() => {
    setMounted(true)
    const stored = localStorage.getItem('hercycle_chat_last_seen')
    if (stored) setLastSeenTime(parseInt(stored, 10))
    loadNudges()
  }, [])

  const loadNudges = async () => {
    try {
      const res = await getPrimaryPartnerNudges()
      setData(res)
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }

  // Auto-refresh chat every 15 seconds
  useEffect(() => {
    if (!data.connected) return
    const interval = setInterval(loadNudges, 15000)
    return () => clearInterval(interval)
  }, [data.connected])

  const handleOpenChat = () => {
    setIsChatOpen(true)
    const now = Date.now()
    setLastSeenTime(now)
    localStorage.setItem('hercycle_chat_last_seen', now.toString())
  }

  if (!mounted || loading) {
    return (
      <div className="w-full my-6 p-6 rounded-3xl bg-white/5 border border-white/10 animate-pulse h-28 flex items-center justify-center">
        <span className="text-white/40 text-sm">Loading partner care notes...</span>
      </div>
    )
  }

  if (!data.connected) {
    return null // Don't block dashboard if not connected
  }

  // Calculate unread count (messages created after lastSeenTime and not sent by me)
  const unreadCount = data.nudges.filter(n => {
    const time = new Date(n.created_at).getTime()
    return time > lastSeenTime && n.sender_id !== data.currentUserId
  }).length

  const latestNudge = data.nudges && data.nudges.length > 0 ? data.nudges[data.nudges.length - 1] : null

  return (
    <section className="w-full my-8">
      {/* Section Title Header */}
      <div className="flex items-center justify-between mb-3 px-1">
        <div className="flex items-center gap-2">
          <span className="text-xl select-none">💌</span>
          <h2 className="text-xl font-bold text-white tracking-tight">
            Partner Care & Love Notes
          </h2>
        </div>

        <button
          onClick={handleOpenChat}
          className={`text-xs px-3.5 py-1.5 rounded-full font-medium transition-all flex items-center gap-1.5 border ${
            unreadCount > 0
              ? 'bg-rose-500 text-white border-rose-400 shadow-lg animate-bounce'
              : 'text-rose-200 hover:text-white bg-rose-500/20 hover:bg-rose-500/30 border-rose-500/30'
          }`}
        >
          <MessageSquare className="w-3.5 h-3.5" />
          {unreadCount > 0 ? (
            <span>💖 {unreadCount} new message(s)</span>
          ) : (
            <span>Open Love Chat</span>
          )}
        </button>
      </div>

      {/* Main Dashboard Preview Card */}
      <div className="w-full relative overflow-hidden rounded-3xl bg-gradient-to-r from-rose-950/40 via-purple-950/40 to-pink-950/40 border border-rose-400/30 p-6 shadow-2xl backdrop-blur-xl transition-all">
        {/* Ambient lighting */}
        <div className="absolute -top-12 -right-12 w-40 h-40 bg-pink-500/20 rounded-full blur-3xl pointer-events-none"></div>
        <div className="absolute -bottom-12 -left-12 w-40 h-40 bg-rose-500/20 rounded-full blur-3xl pointer-events-none"></div>

        {latestNudge ? (
          <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 rounded-2xl bg-rose-500/20 border border-rose-500/40 flex items-center justify-center shrink-0 shadow-inner">
                {latestNudge.nudge_type === 'letter' ? (
                  <Mail className="w-6 h-6 text-rose-300" />
                ) : (
                  <Heart className="w-6 h-6 text-pink-300 fill-pink-300" />
                )}
              </div>

              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-xs font-semibold uppercase tracking-wider text-rose-200 flex items-center gap-1">
                    Latest Note from Partner <Sparkles className="w-3.5 h-3.5 text-amber-300" />
                  </span>
                  <span className="text-[11px] text-white/40 flex items-center gap-1 font-mono">
                    <Clock className="w-3 h-3" />
                    {timeAgo(latestNudge.created_at)}
                  </span>
                </div>

                <p className="text-white text-base md:text-lg font-medium leading-relaxed line-clamp-2">
                  {latestNudge.message || `Sent you a ${latestNudge.nudge_type} 💕`}
                </p>
              </div>
            </div>

            {/* Actions */}
            <div className="flex items-center gap-3 self-end md:self-center shrink-0">
              <button
                onClick={handleOpenChat}
                className="bg-gradient-to-r from-rose-500 to-pink-500 hover:from-rose-600 hover:to-pink-600 text-white text-xs px-5 py-2.5 rounded-xl font-medium shadow-lg transition-all flex items-center gap-1.5"
              >
                <MessageSquare className="w-4 h-4 text-white" />
                <span>Open Love Chat</span>
              </button>
            </div>
          </div>
        ) : (
          <div className="relative z-10 flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-pink-500/20 flex items-center justify-center">
                <Heart className="w-5 h-5 text-pink-300 fill-pink-300" />
              </div>
              <div>
                <h3 className="text-white font-semibold text-sm">Partner Care & Love Notes Connected 💕</h3>
                <p className="text-white/60 text-xs">Your partner can view your shared insights & send you cute love notes!</p>
              </div>
            </div>

            <button
              onClick={handleOpenChat}
              className="bg-gradient-to-r from-rose-500 to-pink-500 text-white text-xs px-4 py-2 rounded-xl font-medium"
            >
              Start Chat
            </button>
          </div>
        )}
      </div>

      {/* ── EXPANDED FULL PROPER CHAT MODAL ── */}
      {isChatOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fade-in">
          <div className="relative w-full max-w-xl">
            <button
              onClick={() => setIsChatOpen(false)}
              className="absolute -top-10 right-0 p-1.5 rounded-full text-white/70 hover:text-white bg-white/10 hover:bg-white/20 transition-colors z-50"
              aria-label="Close"
            >
              <X className="w-5 h-5" />
            </button>

            <PartnerChatBox
              nudges={data.nudges}
              currentUserId={data.currentUserId}
              onRefresh={loadNudges}
              title="Partner Love & Care Chat 💌"
              showPresetChips={false}
            />
          </div>
        </div>
      )}
    </section>
  )
}
