'use client'

import { useState, useEffect } from 'react'
import * as Dialog from '@radix-ui/react-dialog'
import * as Switch from '@radix-ui/react-switch'
import { X, Bell } from 'lucide-react'

export default function NotificationSettings({ isOpen, setIsOpen }) {
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
    <Dialog.Root open={isOpen} onOpenChange={setIsOpen}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[100] animate-in fade-in" />
        <Dialog.Content className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[90vw] max-w-md z-[101] max-h-[85vh] overflow-y-auto animate-in zoom-in-95 duration-200 rounded-3xl">
          
          <div className="glass p-6 sm:p-8 rounded-3xl space-y-6 shadow-2xl relative overflow-hidden" style={{ background: 'rgba(50, 10, 40, 0.45)' }}>
            {/* Subtle glow behind the card */}
            <div className="absolute top-[-50%] right-[-50%] w-[100%] h-[100%] bg-white/5 blur-3xl rounded-full pointer-events-none"></div>

            <div className="flex justify-between items-center relative z-10">
              <div className="flex items-center gap-2">
                <Bell className="w-6 h-6 text-white" />
                <Dialog.Title className="text-2xl font-bold text-white">Notifications</Dialog.Title>
              </div>
              <Dialog.Description className="sr-only">
                Manage your notification preferences including period reminders, ovulation alerts, and daily prompts.
              </Dialog.Description>
              <Dialog.Close asChild>
                <button className="text-white/70 hover:text-white transition-colors bg-white/10 hover:bg-white/20 p-2 rounded-full focus:outline-none focus:ring-2 focus:ring-white/50">
                  <X className="w-5 h-5" />
                </button>
              </Dialog.Close>
            </div>

            <div className="space-y-5 relative z-10">
              <p className="text-white/70 text-sm mb-4">
                Choose which updates you'd like to receive to stay on top of your cycle.
              </p>

              {/* Period Reminders */}
              <div className="flex items-center justify-between bg-white/5 p-4 rounded-xl border border-white/10">
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
              <div className="flex items-center justify-between bg-white/5 p-4 rounded-xl border border-white/10">
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
              <div className="flex items-center justify-between bg-white/5 p-4 rounded-xl border border-white/10">
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
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
