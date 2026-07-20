'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth, useUser } from '@clerk/nextjs'
import { useLocale } from 'next-intl'
import { getSharedInsights, acceptPairingCode } from '@/lib/actions/partner'
import toast from 'react-hot-toast'
import Navbar from '@/components/layout/Navbar'
import { Heart, Activity, Calendar, FileText, Droplets, Clock, Smile, RefreshCw } from 'lucide-react'

// Phase config: color accents and emoji per phase
const PHASE_CONFIG = {
  Menstrual: { emoji: '🩸', color: 'bg-red-500/20', textColor: 'text-red-400', label: 'Menstrual' },
  Follicular: { emoji: '🌱', color: 'bg-emerald-500/20', textColor: 'text-emerald-400', label: 'Follicular' },
  Ovulation: { emoji: '🌸', color: 'bg-pink-500/20', textColor: 'text-pink-400', label: 'Ovulation' },
  Luteal: { emoji: '🌙', color: 'bg-purple-500/20', textColor: 'text-purple-400', label: 'Luteal' },
}

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

export default function PartnerPage() {
  const router = useRouter()
  const { isLoaded, isSignedIn } = useAuth()
  const { user } = useUser()
  const locale = useLocale()

  const [insights, setInsights] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [refreshing, setRefreshing] = useState(false)
  const [code, setCode] = useState('')
  const [accepting, setAccepting] = useState(false)

  useEffect(() => {
    if (!isLoaded || !user) return
    if (!isSignedIn) {
      router.push(`/${locale}/auth/login`)
      return
    }
    const role = user?.publicMetadata?.role
    if (!role) {
      router.push(`/${locale}/onboarding`)
      return
    }
    if (role === 'primary') {
      router.push(`/${locale}`)
      return
    }
    fetchInsights()
  }, [isLoaded, isSignedIn, user, locale])

  const fetchInsights = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true)
    try {
      const data = await getSharedInsights()
      setInsights(data)
      setError(null)
    } catch (err) {
      console.error(err)
      setError('Failed to load insights')
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [])

  // Auto-refresh every 60 seconds
  useEffect(() => {
    if (!insights?.connected) return
    const interval = setInterval(() => fetchInsights(true), 60000)
    return () => clearInterval(interval)
  }, [insights?.connected, fetchInsights])

  const handleAcceptCode = async (e) => {
    e.preventDefault()
    if (!code || code.length < 12) return
    setAccepting(true)
    try {
      await acceptPairingCode(code)
      toast.success('Successfully paired!')
      await fetchInsights()
    } catch (err) {
      toast.error(err.message || 'Invalid pairing code')
    } finally {
      setAccepting(false)
    }
  }

  // --- Loading state ---
  if (loading) {
    return (
      <div className="page flex flex-col min-h-screen">
        <Navbar />
        <div className="flex-1 flex justify-center items-center">
          <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full"></div>
        </div>
      </div>
    )
  }

  // --- Error state ---
  if (error) {
    return (
      <div className="page flex flex-col min-h-screen">
        <Navbar />
        <div className="flex-1 flex flex-col justify-center items-center px-4 pb-20">
          <div className="glass p-8 rounded-3xl w-full max-w-sm shadow-2xl text-center">
            <div className="text-4xl mb-4">😔</div>
            <h2 className="text-xl font-bold text-white mb-2">Something went wrong</h2>
            <p className="text-white/60 text-sm mb-6">{error}</p>
            <button
              onClick={() => { setError(null); setLoading(true); fetchInsights() }}
              className="bg-primary hover:bg-primary-dark text-white font-medium py-2.5 px-6 rounded-xl transition-colors"
            >
              Try Again
            </button>
          </div>
        </div>
      </div>
    )
  }

  // --- Not connected state ---
  if (!insights?.connected) {
    return (
      <div className="page flex flex-col min-h-screen">
        <Navbar />
        <div className="flex-1 flex flex-col justify-center items-center w-full max-w-md mx-auto px-4 pb-20">
          <div className="glass p-8 rounded-3xl w-full shadow-2xl relative overflow-hidden text-center">
            <Heart className="w-12 h-12 text-primary mx-auto mb-4" />
            <h1 className="text-2xl font-bold text-white mb-2">Partner Access</h1>
            <p className="text-white/70 mb-8 text-sm">
              Enter the pairing code shared by your partner to view their cycle insights.
            </p>
            <form onSubmit={handleAcceptCode} className="space-y-4">
              <input
                type="text"
                placeholder="Enter 12-character code"
                value={code}
                onChange={(e) => {
                  const value = e.target.value
                    .toUpperCase()
                    .replace(/[^0-9A-F]/g, '');

                  setCode(value);
                }}
                className="w-full bg-white/5 border border-white/10 text-white placeholder-white/40 px-4 py-3 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary text-center font-mono text-lg uppercase tracking-widest"
                maxLength={12}
                required
              />
              <button
                type="submit"
                disabled={accepting || code.length < 12}
                className="w-full bg-primary hover:bg-primary-dark text-white font-medium py-3 rounded-xl transition-colors disabled:opacity-50"
              >
                {accepting ? 'Connecting...' : 'Connect'}
              </button>
            </form>
          </div>
        </div>
      </div>
    )
  }

  // --- Connected: Shared Insights ---
  const phaseConfig = PHASE_CONFIG[insights.phase] || PHASE_CONFIG.Follicular
  const hasNoCycleData = !insights.phase

  return (
    <div className="page flex flex-col min-h-screen">
      <Navbar />

      <div className="flex-1 w-full max-w-3xl mx-auto px-4 py-8 pb-24 flex flex-col items-center">
        {/* Header */}
        <div className="mb-8 text-center">
          <h1 className="text-3xl font-bold text-white mb-1">Shared Insights</h1>
          <div className="flex items-center justify-center gap-2 text-white/50 text-sm">
            {insights.lastLoggedAt && (
              <>
                <Clock className="w-3.5 h-3.5" />
                <span>Updated {timeAgo(insights.lastLoggedAt)}</span>
              </>
            )}
            <button
              onClick={() => fetchInsights(true)}
              disabled={refreshing}
              className="ml-1 p-1 rounded-full hover:bg-white/10 transition-colors disabled:opacity-50"
              aria-label="Refresh"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>

        {hasNoCycleData ? (
          /* No cycle data yet */
          <div className="glass p-8 rounded-3xl w-full max-w-md text-center">
            <div className="text-5xl mb-4">📋</div>
            <h2 className="text-xl font-semibold text-white mb-2">No cycle data yet</h2>
            <p className="text-white/60 text-sm">
              Your partner hasn't logged any cycle data yet. Check back once they start tracking!
            </p>
          </div>
        ) : (
          <div className="flex flex-wrap justify-center gap-4 w-full">

            {/* Card 1: Current Phase (always shown) */}
            <div className="glass p-6 rounded-3xl relative overflow-hidden w-full md:w-[calc(50%-0.5rem)] max-w-md">
              <div className="flex items-center gap-3 mb-4">
                <div className={`w-10 h-10 rounded-full ${phaseConfig.color} flex items-center justify-center`}>
                  <span className="text-lg">{phaseConfig.emoji}</span>
                </div>
                <h2 className="text-lg font-semibold text-white">Current Phase</h2>
              </div>
              <p className={`text-3xl font-bold ${phaseConfig.textColor} mb-1`}>
                {phaseConfig.label}
              </p>
              <p className="text-white/60 text-sm">
                Day {insights.cycleDay} of ~{insights.avgCycleLength}
              </p>
              {insights.expectedPeriod && (
                <p className="text-white/40 text-xs mt-1">
                  Next period: {insights.expectedPeriod}
                </p>
              )}
            </div>

            {/* Card 2: Flow Intensity (shown during menstrual phase) */}
            {insights.phase === 'Menstrual' && insights.flow && (
              <div className="glass p-6 rounded-3xl relative overflow-hidden w-full md:w-[calc(50%-0.5rem)] max-w-md">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 rounded-full bg-red-500/20 flex items-center justify-center">
                    <Droplets className="w-5 h-5 text-red-400" />
                  </div>
                  <h2 className="text-lg font-semibold text-white">Flow Intensity</h2>
                </div>
                <p className="text-2xl font-medium text-white capitalize">{insights.flow}</p>
              </div>
            )}

            {/* Card 3: Fertile Window (permission-controlled) */}
            {insights.permissions.show_fertile_window && insights.fertileWindow && (
              <div className="glass p-6 rounded-3xl relative overflow-hidden w-full md:w-[calc(50%-0.5rem)] max-w-md">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 rounded-full bg-blue-500/20 flex items-center justify-center">
                    <Activity className="w-5 h-5 text-blue-400" />
                  </div>
                  <h2 className="text-lg font-semibold text-white">Fertile Window</h2>
                </div>
                <p className="text-xl font-medium text-white mb-1">
                  {insights.fertileWindow.start} – {insights.fertileWindow.end}
                </p>
                <p className="text-white/60 text-sm">High chance of conception</p>
              </div>
            )}

            {/* Card 4: Today's Mood (permission-controlled) */}
            {insights.permissions.show_mood && (
              <div className="glass p-6 rounded-3xl relative overflow-hidden w-full md:w-[calc(50%-0.5rem)] max-w-md">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 rounded-full bg-yellow-500/20 flex items-center justify-center">
                    <Smile className="w-5 h-5 text-yellow-400" />
                  </div>
                  <h2 className="text-lg font-semibold text-white">Today's Mood</h2>
                </div>
                {insights.mood ? (
                  <p className="text-2xl font-medium text-white">{insights.mood}</p>
                ) : (
                  <p className="text-white/50 text-sm italic">Not logged yet today</p>
                )}
              </div>
            )}

            {/* Card 5: Today's Symptoms (permission-controlled) */}
            {insights.permissions.show_symptoms && (
              <div className="glass p-6 rounded-3xl relative overflow-hidden w-full md:w-[calc(50%-0.5rem)] max-w-md">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 rounded-full bg-purple-500/20 flex items-center justify-center">
                    <FileText className="w-5 h-5 text-purple-400" />
                  </div>
                  <h2 className="text-lg font-semibold text-white">Today's Symptoms</h2>
                </div>
                {insights.symptoms && insights.symptoms.length > 0 ? (
                  <div className="flex flex-wrap gap-2">
                    {insights.symptoms.map((sym, i) => (
                      <span key={i} className="bg-white/10 px-3 py-1 rounded-full text-sm text-white">
                        {sym}
                      </span>
                    ))}
                  </div>
                ) : (
                  <p className="text-white/50 text-sm italic">No symptoms logged today</p>
                )}
              </div>
            )}

          </div>
        )}
      </div>
    </div>
  )
}
