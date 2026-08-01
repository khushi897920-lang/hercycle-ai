'use client'
import { useState } from 'react'
import ChallengeCard from './ChallengeCard'

export default function WaterChallenge({ initialProgress, target, onUpdate }) {
  const [progress, setProgress] = useState(initialProgress)
  const [loading, setLoading] = useState(false)

  const addWater = async (ml) => {
    setLoading(true)
    try {
      const res = await fetch('/api/challenges/progress', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ challenge_type: 'water', increment: ml }),
      })
      const json = await res.json()
      if (json.success) {
        setProgress(json.data.progress_value)
        onUpdate?.(json.data)
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <ChallengeCard icon="💧" title="Drink 2L Water" progress={progress} target={target} unit="ml" completed={progress >= target}>
      <div className="flex gap-2 pt-1">
        <button disabled={loading || progress >= target} onClick={() => addWater(250)} className="btn-pill px-4 py-1.5 text-sm disabled:opacity-40">+250ml</button>
        <button disabled={loading || progress >= target} onClick={() => addWater(500)} className="btn-pill px-4 py-1.5 text-sm disabled:opacity-40">+500ml</button>
      </div>
    </ChallengeCard>
  )
}