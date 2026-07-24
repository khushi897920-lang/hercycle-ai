'use client'

import { useState, useEffect } from 'react'
import { Bell, Heart, Mail, Sparkles, Check, CheckCheck, Clock, ShieldAlert, Droplets, Trophy, Trash2, Smartphone } from 'lucide-react'
import { useUser } from '@clerk/nextjs'
import toast from 'react-hot-toast'
import { getPrimaryPartnerNudges, getSharedInsights } from '@/lib/actions/partner'
import { requestNotificationPermission, getNotificationPermissionStatus, sendDeviceNotification } from '@/lib/utils/notifications'

export default function NotificationSettings() {
  const { user } = useUser()
  const role = user?.publicMetadata?.role
  const isPartner = role === 'partner'

  const [activeTab, setActiveTab] = useState('feed') // 'feed' | 'settings'
  const [notifications, setNotifications] = useState([])
  const [loading, setLoading] = useState(true)
  const [devicePermission, setDevicePermission] = useState('default')

  // Notification Preferences State (persisted in localStorage)
  const [preferences, setPreferences] = useState({
    partnerNotes: true,
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
    const status = await requestNotificationPermission()
    setDevicePermission(status)
    if (status === 'granted') {
      toast.success('Device push notifications enabled! 🔔')
      sendDeviceNotification('HerCycle AI Notifications Active 🌸', 'You will now receive instant lock screen & push alerts for love notes & period updates!')
    } else if (status === 'denied') {
      toast.error('Notification permission was blocked in browser settings.')
    }
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
    toast.success('Notification settings updated!')
  }

  const handleMarkAllRead = () => {
    setNotifications((prev) => prev.map((item) => ({ ...item, read: true })))
    toast.success('All notifications marked as read')
  }

  const handleClearAllNotifications = () => {
    setNotifications([])
    toast.success('All notifications cleared')
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
    <div className="p-4 sm:p-6 w-full max-w-2xl mx-auto space-y-6 animate-in fade-in duration-300">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-white/10 pb-4 flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-rose-500/20 border border-rose-500/40 flex items-center justify-center">
            <Bell className="w-5 h-5 text-rose-300" />
          </div>
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-white tracking-tight flex items-center gap-2">
              Notifications & Alerts
              {unreadCount > 0 && (
                <span className="text-xs bg-rose-500 text-white font-mono px-2 py-0.5 rounded-full">
                  {unreadCount} new
                </span>
              )}
            </h1>
            <p className="text-white/70 text-xs sm:text-sm">Auto-deletes read alerts after 24h</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {unreadCount > 0 && (
            <button
              onClick={handleMarkAllRead}
              className="text-xs text-rose-300 hover:text-white bg-white/5 hover:bg-white/10 border border-white/10 px-3 py-1.5 rounded-xl transition-all flex items-center gap-1.5"
            >
              <CheckCheck className="w-3.5 h-3.5" />
              <span>Mark read</span>
            </button>
          )}

          {notifications.length > 0 && (
            <button
              onClick={handleClearAllNotifications}
              className="text-xs text-red-300 hover:text-white bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 px-3 py-1.5 rounded-xl transition-all flex items-center gap-1.5"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Clear All</span>
            </button>
          )}
        </div>
      </div>

      {/* Device Push Permission Card */}
      <div className="p-4 rounded-2xl bg-gradient-to-r from-rose-950/80 via-purple-950/80 to-slate-900/90 border border-rose-400/30 flex items-center justify-between gap-3 shadow-lg">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-rose-500/20 border border-rose-400/40 flex items-center justify-center text-xl shrink-0">
            📲
          </div>
          <div>
            <h4 className="text-sm font-bold text-white">Device System Push Banners 🔔</h4>
            <p className="text-xs text-slate-300">
              {devicePermission === 'granted'
                ? 'Active: System banners & lock screen alerts enabled'
                : 'Enable phone/desktop notifications like WhatsApp & Instagram'}
            </p>
          </div>
        </div>

        {devicePermission === 'granted' ? (
          <span className="text-xs font-semibold px-3 py-1 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 flex items-center gap-1 shrink-0">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping"></span>
            Active 🟢
          </span>
        ) : (
          <button
            onClick={handleEnableDevicePush}
            className="text-xs px-3.5 py-2 rounded-xl bg-gradient-to-r from-rose-500 to-pink-500 hover:from-rose-600 hover:to-pink-600 text-white font-bold shadow-md transition-all shrink-0"
          >
            Enable Alerts 🔔
          </button>
        )}
      </div>

      {/* Tabs Switcher */}
      <div className="flex bg-black/40 p-1 rounded-2xl border border-white/10">
        <button
          onClick={() => setActiveTab('feed')}
          className={`flex-1 py-2 rounded-xl text-xs sm:text-sm font-semibold transition-all flex items-center justify-center gap-2 ${
            activeTab === 'feed'
              ? 'bg-gradient-to-r from-rose-600 to-pink-600 text-white shadow-lg'
              : 'text-white/60 hover:text-white'
          }`}
        >
          <Bell className="w-4 h-4" />
          <span>Activity Inbox ({notifications.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('settings')}
          className={`flex-1 py-2 rounded-xl text-xs sm:text-sm font-semibold transition-all flex items-center justify-center gap-2 ${
            activeTab === 'settings'
              ? 'bg-gradient-to-r from-rose-600 to-pink-600 text-white shadow-lg'
              : 'text-white/60 hover:text-white'
          }`}
        >
          <Sparkles className="w-4 h-4" />
          <span>Alert Preferences</span>
        </button>
      </div>

      {/* TAB 1: ACTIVITY INBOX FEED */}
      {activeTab === 'feed' && (
        <div className="space-y-3">
          {loading ? (
            <div className="glass p-8 rounded-2xl text-center text-white/50 text-sm animate-pulse">
              Loading activity notifications...
            </div>
          ) : notifications.length === 0 ? (
            <div className="glass p-8 rounded-2xl text-center text-white/50 text-sm">
              No notifications remaining!
            </div>
          ) : (
            notifications.map((item) => (
              <div
                key={item.id}
                className={`p-4 rounded-2xl border transition-all flex items-start gap-3.5 shadow-md ${
                  item.read
                    ? 'bg-slate-900/80 border-white/10 text-white/80'
                    : 'bg-gradient-to-r from-rose-950/60 to-purple-950/60 border-rose-400/40 text-white ring-1 ring-rose-400/30'
                }`}
              >
                <div className="text-2xl shrink-0 p-2 bg-white/10 rounded-xl border border-white/10">
                  {item.icon}
                </div>

                <div className="flex-1 space-y-1">
                  <div className="flex items-center justify-between">
                    <h4 className="text-sm font-bold text-white tracking-tight">{item.title}</h4>
                    <span className="text-[11px] text-white/50 font-mono flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {formatTime(item.time)}
                    </span>
                  </div>

                  <p className="text-xs text-slate-200 leading-relaxed font-sans">{item.message}</p>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* TAB 2: ALERT PREFERENCES SETTINGS */}
      {activeTab === 'settings' && (
        <div className="glass p-5 rounded-2xl border border-white/15 space-y-4">
          <h3 className="text-sm font-bold text-white uppercase tracking-wider text-rose-300">
            Push & Alert Controls
          </h3>

          <div className="space-y-3">
            {/* Preference Item 1 */}
            <div className="flex items-center justify-between p-3.5 rounded-xl bg-slate-900/80 border border-white/10">
              <div>
                <h4 className="text-sm font-bold text-white">Partner Love Notes & Care Alerts 💌</h4>
                <p className="text-xs text-slate-300">Get notified when a love note or reply is sent</p>
              </div>
              <input
                type="checkbox"
                checked={preferences.partnerNotes}
                onChange={() => handleTogglePref('partnerNotes')}
                className="w-5 h-5 accent-rose-500 rounded cursor-pointer"
              />
            </div>

            {/* Preference Item 2 */}
            <div className="flex items-center justify-between p-3.5 rounded-xl bg-slate-900/80 border border-white/10">
              <div>
                <h4 className="text-sm font-bold text-white">Pre-Period 48-Hour Advance Warning 🩸</h4>
                <p className="text-xs text-slate-300">Receive automatic alerts 2 days before cycle start</p>
              </div>
              <input
                type="checkbox"
                checked={preferences.prePeriodAlerts}
                onChange={() => handleTogglePref('prePeriodAlerts')}
                className="w-5 h-5 accent-rose-500 rounded cursor-pointer"
              />
            </div>

            {/* Preference Item 3 */}
            <div className="flex items-center justify-between p-3.5 rounded-xl bg-slate-900/80 border border-white/10">
              <div>
                <h4 className="text-sm font-bold text-white">Daily Comfort Vibe Check-ins 💕</h4>
                <p className="text-xs text-slate-300">Get updates when comfort vibe status changes</p>
              </div>
              <input
                type="checkbox"
                checked={preferences.vibeCheckins}
                onChange={() => handleTogglePref('vibeCheckins')}
                className="w-5 h-5 accent-rose-500 rounded cursor-pointer"
              />
            </div>

            {/* Preference Item 4 */}
            <div className="flex items-center justify-between p-3.5 rounded-xl bg-slate-900/80 border border-white/10">
              <div>
                <h4 className="text-sm font-bold text-white">Daily Care Quest Completions 🍫</h4>
                <p className="text-xs text-slate-300">Alerts when partner completes daily care actions</p>
              </div>
              <input
                type="checkbox"
                checked={preferences.careQuests}
                onChange={() => handleTogglePref('careQuests')}
                className="w-5 h-5 accent-rose-500 rounded cursor-pointer"
              />
            </div>

            {/* Preference Item 5 */}
            <div className="flex items-center justify-between p-3.5 rounded-xl bg-slate-900/80 border border-white/10">
              <div>
                <h4 className="text-sm font-bold text-white">Hydration & Self-Care Reminders 💧</h4>
                <p className="text-xs text-slate-300">Daily health & wellness check-in prompts</p>
              </div>
              <input
                type="checkbox"
                checked={preferences.selfCareReminders}
                onChange={() => handleTogglePref('selfCareReminders')}
                className="w-5 h-5 accent-rose-500 rounded cursor-pointer"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  )
}


