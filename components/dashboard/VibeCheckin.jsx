'use client'

import { useState, useEffect } from 'react'
import { Sparkles, Heart, Smile } from 'lucide-react'
import toast from 'react-hot-toast'
import { setHerVibe, getHerLatestVibe } from '@/lib/actions/vibe'

const VIBE_OPTIONS = [
  { label: 'Needs Rest 🛌', type: 'Needs Rest 🛌' },
  { label: 'Needs Hugs 🫂', type: 'Needs Hugs 🫂' },
  { label: 'Craving Snacks 🍫', type: 'Craving Snacks 🍫' },
  { label: 'Feeling Great 🌟', type: 'Feeling Great 🌟' },
  { label: 'Need Quiet Space 🌿', type: 'Need Quiet Space 🌿' },
]

export default function VibeCheckin() {
  const [activeVibe, setActiveVibe] = useState(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    loadVibe()
  }, [])

  const loadVibe = async () => {
    try {
      const res = await getHerLatestVibe()
      if (res.vibe) setActiveVibe(res.vibe.vibe_type)
    } catch (e) {
      console.error(e)
    }
  }

  const handleSelectVibe = async (vibeType) => {
    setLoading(true)
    try {
      await setHerVibe(vibeType)
      setActiveVibe(vibeType)
      toast.success(`Vibe updated: ${vibeType}! Shared with partner 💕`)
    } catch (err) {
      toast.error('Failed to update vibe')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="w-full my-4 p-5 rounded-3xl bg-gradient-to-r from-purple-950/40 via-pink-950/40 to-slate-950/60 border border-pink-400/30 shadow-xl backdrop-blur-xl">
      <div className="flex items-center gap-2 mb-3">
        <Smile className="w-5 h-5 text-pink-300" />
        <h3 className="text-white font-bold text-sm tracking-tight flex items-center gap-1.5">
          How are you feeling right now? <Sparkles className="w-3.5 h-3.5 text-amber-300" />
        </h3>
      </div>

      <div className="flex flex-wrap gap-2">
        {VIBE_OPTIONS.map((vibe) => {
          const isSelected = activeVibe === vibe.type
          return (
            <button
              key={vibe.type}
              onClick={() => handleSelectVibe(vibe.type)}
              disabled={loading}
              className={`text-xs px-3.5 py-2 rounded-2xl border transition-all flex items-center gap-1.5 ${
                isSelected
                  ? 'bg-gradient-to-r from-rose-500 to-pink-500 text-white font-semibold border-rose-400 shadow-md ring-2 ring-rose-400/50'
                  : 'bg-white/5 hover:bg-white/10 border-white/10 text-white/80'
              }`}
            >
              <span>{vibe.label}</span>
            </button>
          )
        })}
      </div>
    </div>
  )
}
