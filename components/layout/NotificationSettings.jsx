'use client'

import { useState, useEffect } from 'react'
import * as Switch from '@radix-ui/react-switch'
import { Bell } from 'lucide-react'

export default function NotificationSettings() {
  const [preferences, setPreferences] = useState({
    periodReminders: true,
    ovulationAlerts: true,
    dailyPrompts: false,
  })

  // Load preferences from localStorage on mount
  useEffect(() => {
    try {
      const saved = localStorage.getItem('notification_preferences')
      if (saved) {
        setPreferences(JSON.parse(saved))
      }
    } catch (e) {
      console.error('Failed to load notification preferences', e)
    }
  }, [])

  // Save preferences to localStorage whenever they change
  const handleToggle = (key, value) => {
    const updated = { ...preferences, [key]: value }
    setPreferences(updated)
    try {
      localStorage.setItem('notification_preferences', JSON.stringify(updated))
    } catch (e) {
      console.error('Failed to save notification preferences', e)
    }
  }

  return (
    <div className="p-4 sm:p-8 flex flex-col h-full animate-in fade-in duration-300 w-full max-w-lg mx-auto">
      <div className="flex items-center gap-2 mb-6">
        <Bell className="w-6 h-6 text-white" />
        <h1 className="text-2xl sm:text-3xl font-bold text-white tracking-tight">Notifications</h1>
      </div>
      
      <p className="text-white/70 text-sm mb-6">
        Choose which updates you'd like to receive to stay on top of your cycle.
      </p>

      <div className="space-y-4 w-full">
        {/* Period Reminders */}
        <div className="flex items-center justify-between bg-white/5 p-4 rounded-xl border border-white/10 w-full text-left">
          <div className="pr-4">
            <p className="text-white font-medium">Period Reminders</p>
            <p className="text-white/50 text-xs mt-1">Get notified a few days before your period begins.</p>
          </div>
          <Switch.Root 
            checked={preferences.periodReminders}
            onCheckedChange={(v) => handleToggle('periodReminders', v)}
            className="w-11 h-6 bg-black/40 rounded-full relative data-[state=checked]:bg-pink-400 outline-none cursor-pointer shrink-0"
          >
            <Switch.Thumb className="block w-5 h-5 bg-white rounded-full transition-transform duration-100 translate-x-0.5 will-change-transform data-[state=checked]:translate-x-[22px]" />
          </Switch.Root>
        </div>

        {/* Ovulation Alerts */}
        <div className="flex items-center justify-between bg-white/5 p-4 rounded-xl border border-white/10 w-full text-left">
          <div className="pr-4">
            <p className="text-white font-medium">Ovulation Alerts</p>
            <p className="text-white/50 text-xs mt-1">Know when your fertile window is approaching.</p>
          </div>
          <Switch.Root 
            checked={preferences.ovulationAlerts}
            onCheckedChange={(v) => handleToggle('ovulationAlerts', v)}
            className="w-11 h-6 bg-black/40 rounded-full relative data-[state=checked]:bg-pink-400 outline-none cursor-pointer shrink-0"
          >
            <Switch.Thumb className="block w-5 h-5 bg-white rounded-full transition-transform duration-100 translate-x-0.5 will-change-transform data-[state=checked]:translate-x-[22px]" />
          </Switch.Root>
        </div>

        {/* Daily Prompts */}
        <div className="flex items-center justify-between bg-white/5 p-4 rounded-xl border border-white/10 w-full text-left">
          <div className="pr-4">
            <p className="text-white font-medium">Daily Symptom Log Prompts</p>
            <p className="text-white/50 text-xs mt-1">A daily nudge to log your symptoms and mood.</p>
          </div>
          <Switch.Root 
            checked={preferences.dailyPrompts}
            onCheckedChange={(v) => handleToggle('dailyPrompts', v)}
            className="w-11 h-6 bg-black/40 rounded-full relative data-[state=checked]:bg-pink-400 outline-none cursor-pointer shrink-0"
          >
            <Switch.Thumb className="block w-5 h-5 bg-white rounded-full transition-transform duration-100 translate-x-0.5 will-change-transform data-[state=checked]:translate-x-[22px]" />
          </Switch.Root>
        </div>
      </div>
    </div>
  )
}


