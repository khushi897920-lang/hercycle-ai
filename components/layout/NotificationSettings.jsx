'use client'

import { useState, useEffect } from 'react'
import { Bell, Heart, Mail, Sparkles, Check, CheckCheck, Clock, ShieldAlert, Droplets, Trophy, Trash2, Smartphone } from 'lucide-react'
import { useUser } from '@clerk/nextjs'
import toast from 'react-hot-toast'
import { getPrimaryPartnerNudges, getSharedInsights } from '@/lib/actions/partner'
import { requestNotificationPermission, getNotificationPermissionStatus, sendDeviceNotification, PUSH_STATES } from '@/lib/utils/notifications'
import NotificationPreferences from '@/components/settings/NotificationPreferences'
import ConfirmationModal from '@/components/modals/ConfirmationModal'

import { updatePushPreferences } from '@/lib/actions/push'

const PREFERENCE_ITEMS = [
  {
    key: 'partnerNotes',
    title: 'Partner Love Notes & Care Alerts 💌',
    description: 'Get notified when a love note or reply is sent',
  },
  {
    key: 'forumReplies',
    title: 'Forum Reply Notifications 💬',
    description: 'Get notified when someone replies to your community post or comment',
  },
  {
    key: 'prePeriodAlerts',
    title: 'Pre-Period 48-Hour Advance Warning 🩸',
    description: 'Receive automatic alerts 2 days before cycle start',
  },
  {
    key: 'vibeCheckins',
    title: 'Daily Comfort Vibe Check-ins 💕',
    description: 'Get updates when comfort vibe status changes',
  },
  {
    key: 'careQuests',
    title: 'Daily Care Quest Completions 🍫',
    description: 'Alerts when partner completes daily care actions',
  },
  {
    key: 'selfCareReminders',
    title: 'Hydration & Self-Care Reminders 💧',
    description: 'Daily health & wellness check-in prompts',
  },
]

export default function NotificationSettings() {
  const { user } = useUser()
  const role = user?.publicMetadata?.role
  const isPartner = role === 'partner'

  const [activeTab, setActiveTab] = useState('feed') // 'feed' | 'settings'
  const [notifications, setNotifications] = useState([])
  const [loading, setLoading] = useState(true)
  const [devicePermission, setDevicePermission] = useState('default')
  const [showClearConfirm, setShowClearConfirm] = useState(false)

  // Notification Preferences State (persisted in localStorage)
  const [preferences, setPreferences] = useState({
    partnerNotes: true,
    forumReplies: true,
    prePeriodAlerts: true,
    vibeCheckins: true,
    careQuests: true,
    selfCareReminders: true,
  })

  useEffect(() => {
    // Check current device notification status
    setDevicePermission(getNotificationPermissionStatus())

    // Load preferences
    const saved = localStorage.getItem('hercycle_notification_prefs')
    if (saved) {
      try { setPreferences(JSON.parse(saved)) } catch (e) {}
    }
    loadNotificationsFeed()
  }, [])

  const handleEnableDevicePush = async () => {
    const { state, permission, message } = await requestNotificationPermission()
    setDevicePermission(permission)

    if (state === PUSH_STATES.ENABLED) {
      toast.success('Device push notifications enabled! 🔔')
      sendDeviceNotification(
        'HerCycle AI Notifications Active 🌸',
        'You will now receive instant lock screen & push alerts for love notes & period updates!'
      )
      return
    }

    toast.error(message)
  }

  const loadNotificationsFeed = async () => {
    setLoading(true)
    try {
      let feedItems = []

      if (isPartner) {
        // Fetch insights & nudges for Partner
        const insights = await getSharedInsights()
        if (insights.recentNudges) {
          insights.recentNudges.forEach((nudge) => {
            if (nudge.sender_id !== user?.id) {
              feedItems.push({
                id: nudge.id,
                type: 'love_note',
                icon: '💌',
                title: 'New Reply from Her',
                message: nudge.message || `Sent a ${nudge.nudge_type}`,
                time: nudge.created_at,
                read: false,
              })
            }
          })
        }
        if (insights.pmsAlert?.active) {
          feedItems.push({
            id: 'pms-alert-1',
            type: 'pms_alert',
            icon: '🩸',
            title: insights.pmsAlert.title || 'Pre-Period Sensitivity Alert',
            message: insights.pmsAlert.message || 'Her period is expected in 48 hours. Offer warm tea & dark chocolate!',
            time: new Date().toISOString(),
            read: false,
          })
        }
      } else {
        // Fetch nudges for Her
        const res = await getPrimaryPartnerNudges()
        if (res.nudges) {
          res.nudges.forEach((nudge) => {
            if (nudge.sender_id !== res.currentUserId) {
              const isQuest = nudge.message?.includes('Care Quest')
              feedItems.push({
                id: nudge.id,
                type: isQuest ? 'quest' : 'love_note',
                icon: isQuest ? '🍫' : '💌',
                title: isQuest ? 'Partner Completed Care Quest' : 'New Partner Love Note',
                message: nudge.message || `Partner sent a ${nudge.nudge_type}`,
                time: nudge.created_at,
                read: false,
              })
            }
          })
        }
      }

      // Filter out read notifications older than 24 hours (86,400,000 ms)
      const TWENTY_FOUR_HOURS = 24 * 60 * 60 * 1000
      const now = Date.now()
      feedItems = feedItems.filter((item) => {
        if (!item.read) return true // Always keep unread messages
        const age = now - new Date(item.time).getTime()
        return age < TWENTY_FOUR_HOURS // Auto-delete if read & > 24 hours old
      })

      // Add default system notifications if feed is light
      if (feedItems.length === 0) {
        feedItems = [
          {
            id: 'sys-1',
            type: 'system',
            icon: '🌸',
            title: 'Welcome to HerCycle Notifications',
            message: isPartner ? 'You will receive alerts here when she logs vibes or replies to notes.' : 'You will receive partner love notes and period alerts here.',
            time: new Date().toISOString(),
            read: true,
          }
        ]
      }

      setNotifications(feedItems)
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  const handleTogglePref = (key) => {
    const updated = { ...preferences, [key]: !preferences[key] }
    setPreferences(updated)
    localStorage.setItem('hercycle_notification_prefs', JSON.stringify(updated))
    updatePushPreferences(updated).catch(() => {})
    toast.success('Notification settings updated!')
  }

  const handleMarkAllRead = () => {
    setNotifications((prev) => prev.map((item) => ({ ...item, read: true })))
    toast.success('All notifications marked as read')
  }

  const handleClearAllNotifications = () => {
    setNotifications([])
    setShowClearConfirm(false)
    toast.success('All notifications cleared', { duration: 5000 })
    // Note: this clears the locally-rendered feed for this session only.
    // Partner love notes/nudges remain in the database and may reappear
    // on next load, since the feed is rebuilt from partner_nudges each time.
  }

  const formatTime = (timeStr) => {
    if (!timeStr) return ''
    const diff = Math.floor((Date.now() - new Date(timeStr).getTime()) / 60000)
    if (isNaN(diff) || diff < 1) return 'Just now'
    if (diff < 60) return `${diff}m ago`
    const hrs = Math.floor(diff / 60)
    if (hrs < 24) return `${hrs}h ago`
    return `${Math.floor(hrs / 24)}d ago`
  }

  const unreadCount = notifications.filter((n) => !n.read).length

  return (
    <div className="p-2.5 sm:p-6 w-full max-w-2xl mx-auto space-y-4 sm:space-y-6 animate-in fade-in duration-300 font-sans min-w-0">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-white/15 pb-4 gap-3 sm:gap-4">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-10 h-10 rounded-2xl bg-rose-500/20 border border-rose-400/40 flex items-center justify-center shrink-0 shadow-sm">
            <Bell className="w-5 h-5 text-rose-300" />
          </div>
          <div className="min-w-0">
            <h1 className="text-xl sm:text-2xl font-bold text-white tracking-tight flex items-center gap-2 flex-wrap">
              <span>Notifications & Alerts</span>
              {unreadCount > 0 && (
                <span className="text-xs bg-rose-500 text-white font-mono font-bold px-2.5 py-0.5 rounded-full shadow-sm">
                  {unreadCount} new
                </span>
              )}
            </h1>
            <p className="text-slate-200 text-xs sm:text-sm font-normal">Auto-deletes read alerts after 24h</p>
          </div>
        </div>

        <div className="flex items-center gap-2.5 w-full sm:w-auto justify-start sm:justify-end shrink-0">
          {unreadCount > 0 && (
            <button
              type="button"
              onClick={handleMarkAllRead}
              className="flex-1 sm:flex-none text-xs font-semibold text-rose-200 hover:text-white bg-white/10 hover:bg-white/20 border border-white/15 px-3 py-2 rounded-xl transition-all flex items-center justify-center gap-1.5 cursor-pointer shadow-sm active:scale-95"
            >
              <CheckCheck className="w-3.5 h-3.5 text-rose-300" />
              <span>Mark read</span>
            </button>
          )}

                  {notifications.length > 0 && (
            <button
              type="button"
              // onClick={() => setShowClearConfirm(true)}
              onClick={() => { alert('CLICKED'); setShowClearConfirm(true) }}
              className="flex-1 sm:flex-none text-xs font-semibold text-red-200 hover:text-white bg-red-500/15 hover:bg-red-500/25 border border-red-500/30 px-3 py-2 rounded-xl transition-all flex items-center justify-center gap-1.5 cursor-pointer shadow-sm active:scale-95"
            >
              <Trash2 className="w-3.5 h-3.5 text-red-300" />
              <span>Clear All</span>
            </button>
          )}
        </div>
      </div>

      <ConfirmationModal
        isOpen={showClearConfirm}
        onClose={() => setShowClearConfirm(false)}
        onConfirm={handleClearAllNotifications}
        title="Clear all notifications?"
        description="This will clear your notification feed for this session. Partner love notes and alerts are not permanently deleted and may reappear on next load."
        confirmText="Clear All"
        cancelText="Cancel"
        isDanger={false}
        requireKeyword={false}
      />

      {/* Device Push Permission Card */}
      <div className="p-3.5 sm:p-5 rounded-2xl bg-gradient-to-r from-rose-950/90 via-purple-950/80 to-slate-900/90 border border-rose-400/30 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 sm:gap-4 shadow-lg min-w-0">
        <div className="flex items-start sm:items-center gap-3 sm:gap-3.5 flex-1 min-w-0">
          <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-2xl bg-rose-500/20 border border-rose-400/40 flex items-center justify-center text-lg sm:text-xl shrink-0 shadow-sm">
            📲
          </div>
          <div className="space-y-0.5 min-w-0">
            <h4 className="text-sm sm:text-base font-bold text-white tracking-tight flex items-center gap-1.5 flex-wrap">
              <span>Device System Push Banners</span>
              <span className="text-sm">🔔</span>
            </h4>
            <p className="text-xs sm:text-sm text-slate-200 leading-relaxed font-sans break-words">
              {devicePermission === 'granted'
                ? 'Active: System banners & lock screen alerts enabled'
                : 'Enable phone/desktop notifications like WhatsApp & Instagram'}
            </p>
          </div>
        </div>

        <div className="w-full sm:w-auto flex justify-end shrink-0">
          {devicePermission === 'granted' ? (
            <span className="w-full sm:w-auto text-xs font-semibold px-3.5 py-2 rounded-xl bg-emerald-500/20 text-emerald-200 border border-emerald-500/40 flex items-center justify-center gap-2 shrink-0 shadow-sm">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping shrink-0" />
              Active 🟢
            </span>
          ) : (
            <button
              type="button"
              onClick={handleEnableDevicePush}
              className="w-full sm:w-auto text-xs px-4 py-2.5 rounded-xl bg-gradient-to-r from-rose-500 to-pink-500 hover:from-rose-600 hover:to-pink-600 text-white font-bold shadow-md transition-all shrink-0 cursor-pointer active:scale-95 text-center"
            >
              Enable Alerts 🔔
            </button>
          )}
        </div>
      </div>

      {/* Tabs Switcher */}
      <div className="flex bg-black/50 p-1 sm:p-1.5 rounded-2xl border border-white/15 gap-1 sm:gap-1.5 shadow-inner min-w-0">
        <button
          type="button"
          onClick={() => setActiveTab('feed')}
          className={`flex-1 min-w-0 py-2 sm:py-2.5 px-2 sm:px-3 rounded-xl text-xs sm:text-sm font-semibold transition-all flex items-center justify-center gap-1.5 sm:gap-2 cursor-pointer ${
            activeTab === 'feed'
              ? 'bg-gradient-to-r from-rose-600 to-pink-600 text-white shadow-md font-bold'
              : 'text-slate-300 hover:text-white hover:bg-white/5'
          }`}
        >
          <Bell className="w-4 h-4 shrink-0" />
          <span className="truncate">Activity Inbox ({notifications.length})</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('settings')}
          className={`flex-1 min-w-0 py-2 sm:py-2.5 px-2 sm:px-3 rounded-xl text-xs sm:text-sm font-semibold transition-all flex items-center justify-center gap-1.5 sm:gap-2 cursor-pointer ${
            activeTab === 'settings'
              ? 'bg-gradient-to-r from-rose-600 to-pink-600 text-white shadow-md font-bold'
              : 'text-slate-300 hover:text-white hover:bg-white/5'
          }`}
        >
          <Sparkles className="w-4 h-4 shrink-0" />
          <span className="truncate">Alert Preferences</span>
        </button>
      </div>

      {/* TAB 1: ACTIVITY INBOX FEED */}
      {activeTab === 'feed' && (
        <div className="space-y-3 min-w-0">
          {loading ? (
            <div className="glass p-8 rounded-2xl text-center text-slate-300 text-sm font-sans animate-pulse border border-white/10">
              Loading activity notifications...
            </div>
          ) : notifications.length === 0 ? (
            <div className="glass p-8 rounded-2xl text-center text-slate-300 text-sm font-sans border border-white/10">
              No notifications remaining!
            </div>
          ) : (
            notifications.map((item) => (
              <div
                key={item.id}
                className={`p-3 sm:p-4 rounded-2xl border transition-all flex items-start gap-2.5 sm:gap-3.5 shadow-md min-w-0 ${
                  item.read
                    ? 'bg-slate-900/90 border-white/15 text-slate-200'
                    : 'bg-gradient-to-r from-rose-950/70 via-purple-950/60 to-slate-900/90 border-rose-400/50 text-white ring-1 ring-rose-400/40 shadow-rose-950/40'
                }`}
              >
                <div className="text-xl sm:text-2xl shrink-0 p-2 sm:p-2.5 bg-white/10 rounded-xl border border-white/15 shadow-sm">
                  {item.icon}
                </div>

                <div className="flex-1 min-w-0 space-y-1">
                  <div className="flex items-center justify-between gap-2 flex-wrap sm:flex-nowrap">
                    <h4 className="text-sm sm:text-base font-bold text-white tracking-tight break-words leading-snug">{item.title}</h4>
                    <span className="text-[11px] text-slate-300 font-mono flex items-center gap-1 shrink-0">
                      <Clock className="w-3 h-3 text-slate-400" />
                      {formatTime(item.time)}
                    </span>
                  </div>

                  <p className="text-xs sm:text-sm text-slate-200 leading-relaxed font-sans break-words">{item.message}</p>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* TAB 2: ALERT PREFERENCES SETTINGS */}
      {activeTab === 'settings' && (
        <div className="glass p-3.5 sm:p-6 rounded-2xl border border-white/15 space-y-4 shadow-xl min-w-0">
          <h3 className="text-xs sm:text-sm font-bold text-rose-300 uppercase tracking-wider flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-rose-400" />
            Push & Alert Controls
          </h3>

          <div className="space-y-3 min-w-0">
            {PREFERENCE_ITEMS.map((item) => (
              <div
                key={item.key}
                className="flex items-center justify-between p-3.5 sm:p-4 rounded-xl bg-slate-900/90 border border-white/15 hover:border-white/25 transition-all gap-3 sm:gap-4 shadow-sm min-w-0"
              >
                <div className="space-y-0.5 min-w-0 flex-1">
                  <h4 className="text-sm sm:text-base font-semibold text-white tracking-tight font-sans break-words">{item.title}</h4>
                  <p className="text-xs sm:text-sm text-slate-200 font-sans leading-normal break-words">{item.description}</p>
                </div>

                {/* Custom Glassmorphic Toggle Switch */}
                <button
                  type="button"
                  role="switch"
                  aria-checked={preferences[item.key]}
                  aria-label={item.title}
                  onClick={() => handleTogglePref(item.key)}
                  className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-rose-400 focus:ring-offset-2 focus:ring-offset-slate-900 ${
                    preferences[item.key]
                      ? 'bg-gradient-to-r from-rose-500 to-pink-500 shadow-sm'
                      : 'bg-slate-700/80'
                  }`}
                >
                  <span
                    className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-md ring-0 transition duration-200 ease-in-out ${
                      preferences[item.key] ? 'translate-x-5' : 'translate-x-0'
                    }`}
                  />
                </button>
              </div>
            ))}

            {/* Hydration Reminder Schedule — Issue #455 */}
            <NotificationPreferences />
          </div>
        </div>
      )}
    </div>
  )
}


