'use client'

import { useState, useEffect } from 'react'
import { useAuth } from '@clerk/nextjs'
import * as Switch from '@radix-ui/react-switch'
import toast from 'react-hot-toast'
import { Download } from 'lucide-react'

export default function PrivacySettingsContent() {
  const { getToken } = useAuth()
  const [isExporting, setIsExporting] = useState(false)
  const [allowAI, setAllowAI] = useState(true)
  const [isUpdating, setIsUpdating] = useState(false)

  useEffect(() => {
    fetch('/api/profile')
      .then(res => res.json())
      .then(data => {
        if (data.success && data.profile) {
          setAllowAI(data.profile.allow_ai_analysis ?? true)
        }
      })
      .catch(console.error)
  }, [])

  const handleToggleAI = async (checked) => {
    const message = checked 
      ? 'Are you sure you want to enable AI analysis? Your anonymized data will be used to provide personalized insights and chat guidance.'
      : 'Are you sure you want to disable AI analysis? The AI assistant will be disabled and you will no longer receive personalized insights.';
      
    if (!window.confirm(message)) {
      return;
    }

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
      const token = await getToken()
      const res = await fetch('/api/user/export', {
        headers: {
          Authorization: `Bearer ${token}`
        }
      })
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
    <div className="p-4 sm:p-8 flex flex-col h-full animate-in fade-in duration-300 mt-2 max-w-2xl mx-auto w-full space-y-6">
      
      <div className="space-y-2 mb-4">
        <h2 className="text-2xl font-bold text-white tracking-tight">Data & Privacy</h2>
        <p className="text-white/60 text-sm">
          Manage your data privacy settings, AI analysis permissions, and export your health data.
        </p>
      </div>

      {/* AI Toggle Section */}
      <div className="w-full flex flex-col sm:flex-row sm:items-center justify-between gap-6 p-6 bg-white/5 rounded-2xl border border-white/10 shadow-lg hover:bg-white/10 transition-colors">
        <div className="space-y-1.5 pr-4 flex-1">
          <h3 className="font-semibold text-white text-lg flex items-center gap-2">
            AI Analysis
          </h3>
          <p className="text-sm text-white/70 leading-relaxed">
            Allow AI to analyze my anonymized data for personalized insights and chat guidance.
          </p>
        </div>
        <Switch.Root
          checked={allowAI}
          onCheckedChange={handleToggleAI}
          disabled={isUpdating}
          className={`w-[48px] h-[28px] rounded-full relative outline-none cursor-pointer disabled:opacity-50 transition-colors shrink-0 ${allowAI ? 'bg-pink-500' : 'bg-white/20'}`}
        >
          <Switch.Thumb className="block w-[24px] h-[24px] bg-white rounded-full transition-transform translate-x-[2px] data-[state=checked]:translate-x-[22px] shadow-md" />
        </Switch.Root>
      </div>

      {/* Export Section */}
      <div className="w-full flex flex-col sm:flex-row sm:items-center justify-between gap-6 p-6 bg-white/5 rounded-2xl border border-white/10 shadow-lg hover:bg-white/10 transition-colors">
        <div className="space-y-1.5 pr-4 flex-1">
          <h3 className="font-semibold text-white text-lg flex items-center gap-2">
            Export Your Data
          </h3>
          <p className="text-sm text-white/70 leading-relaxed">
            Download a complete archive of your logged cycles, symptoms, and health metrics in JSON format.
          </p>
        </div>
        <button
          onClick={!isExporting ? handleExportData : undefined}
          disabled={isExporting}
          className={`shrink-0 flex items-center justify-center gap-2 bg-white/10 hover:bg-white/20 text-white px-5 py-2.5 rounded-xl transition-all font-medium border border-white/10 ${isExporting ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer active:scale-95'}`}
        >
          <Download className={`w-4 h-4 ${isExporting ? 'animate-bounce' : ''}`} />
          {isExporting ? 'Exporting...' : 'Download Archive'}
        </button>
      </div>

    </div>
  )
}
