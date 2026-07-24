import React, { useState, useEffect } from 'react'
import * as Dialog from '@radix-ui/react-dialog'
import * as Switch from '@radix-ui/react-switch'
import { Download, AlertTriangle, X, Shield } from 'lucide-react'
import toast from 'react-hot-toast'

export default function PrivacyModal({ trigger, initialProfile, onDeleteAccount }) {
  const [allowAI, setAllowAI] = useState(true)
  const [isExporting, setIsExporting] = useState(false)
  const [isUpdating, setIsUpdating] = useState(false)

  useEffect(() => {
    if (initialProfile !== undefined) {
      setAllowAI(initialProfile?.allow_ai_analysis ?? true)
    } else {
      // Fetch profile
      fetch('/api/profile')
        .then(res => res.json())
        .then(data => {
          if (data.success && data.profile) {
            setAllowAI(data.profile.allow_ai_analysis ?? true)
          }
        })
        .catch(console.error)
    }
  }, [initialProfile])

  const handleToggleAI = async (checked) => {
    setAllowAI(checked)
    setIsUpdating(true)
    const toastId = toast.loading('Updating privacy settings...')
    try {
      const res = await fetch('/api/profile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ allow_ai_analysis: checked })
      })
      if (!res.ok) throw new Error('Failed to update')
      toast.success('Privacy settings updated', { id: toastId })
    } catch (error) {
      setAllowAI(!checked) // revert
      toast.error('Failed to update privacy settings', { id: toastId })
    } finally {
      setIsUpdating(false)
    }
  }

  const handleExportData = async () => {
    setIsExporting(true)
    const toastId = toast.loading('Preparing your data...')
    try {
      const res = await fetch('/api/user/export')
      if (!res.ok) {
        throw new Error('Failed to export data')
      }
      const blob = await res.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = 'my-hercycle-data.json'
      document.body.appendChild(a)
      a.click()
      window.URL.revokeObjectURL(url)
      a.remove()
      toast.success('Data exported successfully!', { id: toastId })
    } catch (error) {
      console.error(error)
      toast.error('Could not export data. Please try again.', { id: toastId })
    } finally {
      setIsExporting(false)
    }
  }

  return (
    <Dialog.Root>
      <Dialog.Trigger asChild>
        {trigger}
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 transition-opacity" />
        <Dialog.Content className="fixed top-[50%] left-[50%] translate-x-[-50%] translate-y-[-50%] bg-[#1a1a2e] text-white rounded-3xl p-6 sm:p-8 w-[95vw] max-w-lg shadow-2xl z-50 border border-white/10 focus:outline-none">
          <div className="flex justify-between items-start mb-6">
            <Dialog.Title className="text-2xl font-bold flex items-center gap-2">
              <Shield className="w-6 h-6 text-pink-400" />
              Privacy & Data Control
            </Dialog.Title>
            <Dialog.Close asChild>
              <button className="text-white/50 hover:text-white transition-colors p-1" aria-label="Close">
                <X className="w-5 h-5" />
              </button>
            </Dialog.Close>
          </div>
          
          <div className="space-y-6">
            {/* AI Toggle Section */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 bg-white/5 rounded-2xl border border-white/10">
              <div className="space-y-1 pr-4">
                <h3 className="font-semibold text-white text-lg">AI Analysis</h3>
                <p className="text-sm text-white/70 leading-relaxed">
                  Allow AI to analyze my anonymized data for personalized insights and chat guidance.
                </p>
              </div>
              <Switch.Root
                checked={allowAI}
                onCheckedChange={handleToggleAI}
                disabled={isUpdating}
                className={`w-[42px] h-[25px] rounded-full relative outline-none cursor-pointer disabled:opacity-50 transition-colors ${allowAI ? 'bg-pink-500' : 'bg-white/20'}`}
              >
                <Switch.Thumb className="block w-[21px] h-[21px] bg-white rounded-full transition-transform translate-x-[2px] data-[state=checked]:translate-x-[19px] shadow-md" />
              </Switch.Root>
            </div>

            <hr className="border-white/10" />

            {/* Export Section */}
            <div className="space-y-3">
              <h3 className="font-semibold text-white">Export Your Data</h3>
              <p className="text-sm text-white/70">
                Download a JSON copy of all your health data, including your profile, cycle logs, and daily logs.
              </p>
              <button
                onClick={handleExportData}
                disabled={isExporting}
                className="flex items-center gap-2 bg-white/10 hover:bg-white/20 text-white px-5 py-2.5 rounded-xl transition-colors font-medium disabled:opacity-50 w-full sm:w-auto justify-center"
              >
                <Download className="w-4 h-4" />
                {isExporting ? 'Exporting...' : 'Download My Data'}
              </button>
            </div>

            <hr className="border-white/10" />

            {/* Delete Account Section */}
            <div className="bg-red-500/10 border border-red-500/20 p-4 rounded-2xl flex gap-3">
              <AlertTriangle className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
              <div className="space-y-2">
                <h3 className="font-semibold text-red-300">Account Deletion</h3>
                <p className="text-red-300/70 text-sm leading-relaxed">
                  Deleting your account via Clerk will automatically trigger a cascading deletion, permanently purging all your cycle logs, predictions, and profile data from our databases. This is irreversible.
                </p>
              </div>
            </div>
            
            <div className="flex justify-end pt-2">
              <Dialog.Close asChild>
                <button className="bg-pink-500 hover:bg-pink-600 text-white px-6 py-2.5 rounded-xl font-medium transition-colors">
                  Done
                </button>
              </Dialog.Close>
            </div>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
