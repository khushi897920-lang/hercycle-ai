'use client'
import ChallengeCard from './ChallengeCard'
import { CHALLENGES } from '@/lib/challenges-data'
import fetchWithTimeout from '@/lib/fetch-with-timeout'

export default function SleepChallenge({ initialProgress, target, onUpdate }) {
  const completed = initialProgress >= target
  const logSleep = async () => {
    const res = await fetchWithTimeout('/api/challenges/progress', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ challenge_type: 'sleep', increment: 1 }),
    })
    const json = await res.json()
    if (json.success) onUpdate?.(json.data)
  }
  return (
    <ChallengeCard
      icon="😴"
      title="Sleep Before 11 PM"
      subtitle="Rest supports hormone balance"
      points={CHALLENGES.sleep.points}
      progress={initialProgress}
      target={target}
      unit=""
      completed={completed}
    >
      {!completed && (
        <button onClick={logSleep} className="btn-pill px-4 py-1.5 text-sm mt-1">I Did This</button>
      )}
    </ChallengeCard>
  )
}