'use client'

import { useState, useEffect } from 'react'
import { CheckSquare, Square, Trophy, Sparkles, CheckCircle2 } from 'lucide-react'
import toast from 'react-hot-toast'
import { getPartnerQuests, togglePartnerQuest } from '@/lib/actions/quests'

export default function CareQuestsCard() {
  const [quests, setQuests] = useState([])
  const [loading, setLoading] = useState(true)
  const [togglingId, setTogglingId] = useState(null)

  useEffect(() => {
    loadQuests()
  }, [])

  const loadQuests = async () => {
    try {
      const res = await getPartnerQuests()
      setQuests(res.quests || [])
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }

  const handleToggle = async (quest) => {
    setTogglingId(quest.id)
    try {
      const res = await togglePartnerQuest(quest.id, quest.completed, quest.quest_title)
      toast.success(res.completed ? 'Care Quest Completed! 🎉' : 'Quest updated')
      loadQuests()
    } catch (err) {
      toast.error('Failed to update quest')
    } finally {
      setTogglingId(null)
    }
  }

  const completedCount = quests.filter(q => q.completed).length

  if (loading) {
    return (
      <div className="glass p-6 rounded-3xl w-full animate-pulse h-48 flex items-center justify-center">
        <span className="text-white/40 text-sm">Loading daily care quests...</span>
      </div>
    )
  }

  return (
    <div className="w-full glass p-5 sm:p-6 rounded-3xl relative overflow-hidden shadow-2xl border border-white/10">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center">
            <Trophy className="w-5 h-5 text-amber-300" />
          </div>
          <div>
            <h3 className="text-white font-bold text-base flex items-center gap-1.5">
              Daily Partner Care Quests <Sparkles className="w-4 h-4 text-amber-300" />
            </h3>
            <p className="text-white/50 text-xs">Complete daily actions to support her cycle</p>
          </div>
        </div>

        <span className="text-xs font-mono bg-amber-500/20 border border-amber-500/30 text-amber-200 px-3 py-1 rounded-full font-semibold">
          {completedCount} / {quests.length} Done
        </span>
      </div>

      <div className="space-y-2.5">
        {quests.map((quest) => (
          <button
            key={quest.id}
            onClick={() => handleToggle(quest)}
            disabled={togglingId === quest.id}
            className={`w-full p-3.5 rounded-2xl border text-left text-xs transition-all flex items-center gap-3 ${
              quest.completed
                ? 'bg-emerald-500/20 border-emerald-400/40 text-emerald-100 font-medium'
                : 'bg-white/5 hover:bg-white/10 border-white/10 text-white/90'
            }`}
          >
            {quest.completed ? (
              <CheckCircle2 className="w-5 h-5 text-emerald-300 shrink-0" />
            ) : (
              <Square className="w-5 h-5 text-white/40 shrink-0" />
            )}
            <span className={`flex-1 ${quest.completed ? 'line-through opacity-80' : ''}`}>
              {quest.quest_title}
            </span>
          </button>
        ))}
      </div>
    </div>
  )
}
