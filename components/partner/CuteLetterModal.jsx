'use client'

import { useState } from 'react'
import { Mail, Heart, Send, Sparkles, X } from 'lucide-react'
import toast from 'react-hot-toast'
import { sendPartnerNudge } from '@/lib/actions/partner'

const LETTER_PRESETS = [
  'Rest well today my love 💌',
  'On my way with your favorite snacks 🍫',
  'Proud of you always 🌸',
  'Sending warm hugs 💕',
  'Making hot tea for you 🍵',
  'Take it easy today, I got you 💖',
]

export default function CuteLetterModal({ isOpen, onClose, onSent }) {
  const [selectedPreset, setSelectedPreset] = useState('')
  const [customMessage, setCustomMessage] = useState('')
  const [sending, setSending] = useState(false)

  if (!isOpen) return null

  const activeText = customMessage || selectedPreset

  const handleSend = async (e) => {
    e?.preventDefault()
    if (!activeText.trim()) {
      toast.error('Please write a note or pick a preset!')
      return
    }

    setSending(true)
    try {
      await sendPartnerNudge('letter', activeText.trim())
      setCustomMessage('')
      setSelectedPreset('')
      if (onSent) onSent()
      onClose()
    } catch (err) {
      console.error(err)
      toast.error(err.message || 'Failed to send love note')
    } finally {
      setSending(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
      <div className="relative w-full max-w-lg overflow-hidden bg-gradient-to-b from-rose-950/90 via-slate-900/90 to-purple-950/90 border border-white/20 rounded-3xl shadow-2xl p-6 md:p-8">
        
        {/* Decorative background glow */}
        <div className="absolute -top-12 -right-12 w-40 h-40 bg-pink-500/20 rounded-full blur-3xl pointer-events-none"></div>
        <div className="absolute -bottom-12 -left-12 w-40 h-40 bg-rose-500/20 rounded-full blur-3xl pointer-events-none"></div>

        {/* Header */}
        <div className="flex items-center justify-between mb-6 relative z-10">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-rose-500/20 border border-rose-500/30 flex items-center justify-center">
              <Mail className="w-5 h-5 text-rose-300" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-white flex items-center gap-1.5">
                Send a Cute Love Note <Sparkles className="w-4 h-4 text-amber-300" />
              </h2>
              <p className="text-white/60 text-xs">Write a sweet letter to brighten her day</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-full text-white/50 hover:text-white hover:bg-white/10 transition-colors"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Envelope / Parchment Card View */}
        <div className="relative bg-amber-50/10 border border-rose-300/30 rounded-2xl p-5 mb-6 backdrop-blur-md shadow-inner">
          <div className="flex items-center justify-between text-xs text-rose-200/70 mb-2 font-mono">
            <span>To My Love 💖</span>
            <span className="flex items-center gap-1"><Heart className="w-3.5 h-3.5 text-rose-400 fill-rose-400" /> Sealed with Love</span>
          </div>

          <textarea
            value={customMessage}
            onChange={(e) => {
              setCustomMessage(e.target.value)
              if (selectedPreset) setSelectedPreset('')
            }}
            placeholder="Type your sweet letter here or pick a quick message below..."
            className="w-full bg-transparent border-0 text-white placeholder-white/40 focus:outline-none text-base resize-none min-h-[110px] leading-relaxed font-sans"
            maxLength={300}
          />

          <div className="text-right text-xs text-white/40 font-mono mt-1">
            {customMessage.length}/300
          </div>
        </div>

        {/* Quick Presets */}
        <div className="mb-6">
          <p className="text-xs font-semibold text-white/60 uppercase tracking-wider mb-2.5">
            Quick Heart-Warming Templates:
          </p>
          <div className="flex flex-wrap gap-2 max-h-36 overflow-y-auto pr-1">
            {LETTER_PRESETS.map((preset, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => {
                  setSelectedPreset(preset)
                  setCustomMessage(preset)
                }}
                className={`text-xs px-3 py-2 rounded-xl transition-all border text-left ${
                  selectedPreset === preset
                    ? 'bg-rose-500/30 border-rose-400 text-white font-medium shadow-sm'
                    : 'bg-white/5 hover:bg-white/10 border-white/10 text-white/80'
                }`}
              >
                {preset}
              </button>
            ))}
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center justify-end gap-3 pt-2 border-t border-white/10">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2.5 rounded-xl text-sm text-white/70 hover:bg-white/10 transition-colors"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSend}
            disabled={sending || !activeText.trim()}
            className="flex items-center gap-2 bg-gradient-to-r from-rose-500 to-pink-500 hover:from-rose-600 hover:to-pink-600 text-white px-6 py-2.5 rounded-xl font-medium shadow-lg transition-all disabled:opacity-50"
          >
            {sending ? (
              <span>Sending...</span>
            ) : (
              <>
                <Send className="w-4 h-4" />
                <span>Send Letter 💌</span>
              </>
            )}
          </button>
        </div>

      </div>
    </div>
  )
}
