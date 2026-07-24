'use client'

import { useState, useEffect } from 'react'
import { generatePairingCode, getPrimaryUserConnection, updatePartnerPermissions, disconnectPartner } from '@/lib/actions/partner'
import toast from 'react-hot-toast'
import { Users, Copy, Check, Trash2 } from 'lucide-react'
import * as Switch from '@radix-ui/react-switch'
import { useTranslations } from 'next-intl'

export default function PartnerSharing() {
  const t = useTranslations('PartnerSharing')
  const [connection, setConnection] = useState(null)
  const [loading, setLoading] = useState(true)
  const [generating, setGenerating] = useState(false)
  const [copied, setCopied] = useState(false)
  
  useEffect(() => {
    loadConnection()
  }, [])

  const loadConnection = async () => {
    try {
      const conn = await getPrimaryUserConnection()
      setConnection(conn)
    } catch (error) {
      console.error(error)
    } finally {
      setLoading(false)
    }
  }

  const handleGenerateCode = async () => {
    setGenerating(true)
    try {
      await generatePairingCode()
      await loadConnection()
      toast.success('Pairing code generated')
    } catch (error) {
      toast.error('Failed to generate code')
    } finally {
      setGenerating(false)
    }
  }

  const copyCode = () => {
    if (connection?.pairing_code) {
      navigator.clipboard.writeText(connection.pairing_code)
      setCopied(true)
      toast.success('Code copied to clipboard')
      setTimeout(() => setCopied(false), 2000)
    }
  }

  const togglePermission = async (field, value) => {
    if (!connection) return
    const prev = connection.partner_permissions[0][field]
    // Optimistic update
    setConnection({
      ...connection,
      partner_permissions: [
        {
          ...connection.partner_permissions[0],
          [field]: value
        }
      ]
    })
    
    try {
      await updatePartnerPermissions(connection.id, { [field]: value })
    } catch (error) {
      toast.error('Failed to update permission')
      // Revert on error
      setConnection({
        ...connection,
        partner_permissions: [
          {
            ...connection.partner_permissions[0],
            [field]: prev
          }
        ]
      })
    }
  }

  const handleDisconnect = async () => {
    if (!confirm('Are you sure you want to disconnect this partner? They will lose access immediately.')) return
    
    try {
      await disconnectPartner(connection.id)
      setConnection(null)
      toast.success('Partner disconnected')
    } catch (error) {
      toast.error('Failed to disconnect partner')
    }
  }

  if (loading) {
    return <div className="animate-pulse h-32 bg-white/5 rounded-2xl"></div>
  }

  return (
    <section className="space-y-4 relative z-10">
      <div className="flex items-center gap-2 mb-2">
        <Users className="w-5 h-5 text-white" />
        <h2 className="text-xl font-semibold text-white">{t('title')}</h2>
      </div>
      <p className="text-white/70 text-sm">
        {t('desc')}
      </p>

      {!connection ? (
        <button 
          onClick={handleGenerateCode}
          disabled={generating}
          className="bg-primary/20 hover:bg-primary/30 text-primary-light px-5 py-2.5 rounded-xl transition-colors font-medium border border-primary/30"
        >
          {generating ? t('generating') : t('generateBtn')}
        </button>
      ) : (
        <div className="space-y-6 mt-4">
          <div className="bg-white/5 border border-white/10 p-4 rounded-xl flex items-center justify-between">
            <div>
              <p className="text-sm text-white/50 mb-1">{t('status')}</p>
              <div className="flex items-center gap-2">
                <div className={`w-2.5 h-2.5 rounded-full ${connection.status === 'active' ? 'bg-green-500' : 'bg-yellow-500 animate-pulse'}`}></div>
                <p className="font-medium text-white capitalize">{connection.status}</p>
              </div>
            </div>
            
            <div className="text-right">
              <p className="text-sm text-white/50 mb-1">{t('pairingCode')}</p>
              <button onClick={copyCode} className="flex items-center gap-2 font-mono text-lg bg-black/20 px-3 py-1 rounded-lg hover:bg-black/40 transition-colors text-white">
                {connection.pairing_code}
                {copied ? <Check className="w-4 h-4 text-green-400" /> : <Copy className="w-4 h-4 text-white/50" />}
              </button>
            </div>
          </div>

          {connection.status === 'active' && connection.partner_permissions && connection.partner_permissions[0] && (
            <div className="space-y-4 bg-white/5 border border-white/10 p-5 rounded-xl">
              <h3 className="font-medium text-white mb-2">{t('privacyControls')}</h3>
              
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-white font-medium">{t('showMood')}</p>
                  <p className="text-white/50 text-sm">{t('showMoodDesc')}</p>
                </div>
                <Switch.Root 
                  checked={connection.partner_permissions[0].show_mood}
                  onCheckedChange={(v) => togglePermission('show_mood', v)}
                  className="w-11 h-6 bg-black/40 rounded-full relative data-[state=checked]:bg-primary outline-none cursor-pointer"
                >
                  <Switch.Thumb className="block w-5 h-5 bg-white rounded-full transition-transform duration-100 translate-x-0.5 will-change-transform data-[state=checked]:translate-x-[22px]" />
                </Switch.Root>
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <p className="text-white font-medium">{t('showSymptoms')}</p>
                  <p className="text-white/50 text-sm">{t('showSymptomsDesc')}</p>
                </div>
                <Switch.Root 
                  checked={connection.partner_permissions[0].show_symptoms}
                  onCheckedChange={(v) => togglePermission('show_symptoms', v)}
                  className="w-11 h-6 bg-black/40 rounded-full relative data-[state=checked]:bg-primary outline-none cursor-pointer"
                >
                  <Switch.Thumb className="block w-5 h-5 bg-white rounded-full transition-transform duration-100 translate-x-0.5 will-change-transform data-[state=checked]:translate-x-[22px]" />
                </Switch.Root>
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <p className="text-white font-medium">{t('showFertile')}</p>
                  <p className="text-white/50 text-sm">{t('showFertileDesc')}</p>
                </div>
                <Switch.Root 
                  checked={connection.partner_permissions[0].show_fertile_window}
                  onCheckedChange={(v) => togglePermission('show_fertile_window', v)}
                  className="w-11 h-6 bg-black/40 rounded-full relative data-[state=checked]:bg-primary outline-none cursor-pointer"
                >
                  <Switch.Thumb className="block w-5 h-5 bg-white rounded-full transition-transform duration-100 translate-x-0.5 will-change-transform data-[state=checked]:translate-x-[22px]" />
                </Switch.Root>
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <p className="text-white font-medium">Show Actionable Care Recommendations</p>
                  <p className="text-white/50 text-sm">Allow partner to see tailored tips on how to support you today</p>
                </div>
                <Switch.Root 
                  checked={connection.partner_permissions[0].show_care_tips !== false}
                  onCheckedChange={(v) => togglePermission('show_care_tips', v)}
                  className="w-11 h-6 bg-black/40 rounded-full relative data-[state=checked]:bg-primary outline-none cursor-pointer"
                >
                  <Switch.Thumb className="block w-5 h-5 bg-white rounded-full transition-transform duration-100 translate-x-0.5 will-change-transform data-[state=checked]:translate-x-[22px]" />
                </Switch.Root>
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <p className="text-white font-medium">Show Energy & Vibe Battery</p>
                  <p className="text-white/50 text-sm">Allow partner to see an estimated stamina level for the day</p>
                </div>
                <Switch.Root 
                  checked={connection.partner_permissions[0].show_energy_battery !== false}
                  onCheckedChange={(v) => togglePermission('show_energy_battery', v)}
                  className="w-11 h-6 bg-black/40 rounded-full relative data-[state=checked]:bg-primary outline-none cursor-pointer"
                >
                  <Switch.Thumb className="block w-5 h-5 bg-white rounded-full transition-transform duration-100 translate-x-0.5 will-change-transform data-[state=checked]:translate-x-[22px]" />
                </Switch.Root>
              </div>
            </div>
          )}

          <div className="pt-2">
            <button 
              onClick={handleDisconnect}
              className="flex items-center gap-2 text-red-400 hover:text-red-300 transition-colors text-sm font-medium"
            >
              <Trash2 className="w-4 h-4" />
              {t('disconnect')}
            </button>
          </div>
        </div>
      )}
    </section>
  )
}
