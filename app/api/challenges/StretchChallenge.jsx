'use client'
import { useState, useEffect, useRef } from 'react'
import ChallengeCard from './ChallengeCard'

export default function StretchChallenge({ initialProgress, target, onUpdate }) {
  const [progress, setProgress] = useState(initialProgress)
  const [running, setRunning] = useState(false)
  const intervalRef = useRef(null)

  useEffect(() => {
    if (running) {
      intervalRef.current = setInterval(() => setProgress((p) => Math.min(p + 1, target)), 1000)
    }
    return () => clearInterval(intervalRef.current)
  }, [running, target])

  useEffect(() => {
    if (progress >= target && running) {
      setRunning(false)
      fetch('/api/challenges/progress', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ challenge_type: 'stretch', increment: target }),
      }).then((r) => r.json()).then((json) => json.success && onUpdate?.(json.data))
    }
  }, [progress, target, running, onUpdate])

  const mins = Math.floor(progress / 60)
  const secs = progress % 60

  return (
    <ChallengeCard icon="🧘" title="Stretch for 10 minutes" progress={progress} target={target} unit="s" completed={progress >= target}>
      <div className="flex items-center gap-3 pt-1">
        <span className="text-white font-mono text-lg">{mins}:{secs.toString().padStart(2, '0')}</span>
        {progress < target && (
          <button onClick={() => setRunning((r) => !r)} className="btn-pill px-4 py-1.5 text-sm">
            {running ? '⏸ Pause' : '▶ Start'}
          </button>
        )}
      </div>
    </ChallengeCard>
  )
}