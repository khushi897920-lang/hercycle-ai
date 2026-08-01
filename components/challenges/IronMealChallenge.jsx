'use client'
import ChallengeCard from './ChallengeCard'
import { CHALLENGES } from '@/lib/challenges-data'
import fetchWithTimeout from '@/lib/fetch-with-timeout'

export default function IronMealChallenge({ initialProgress, target, onUpdate }) {
  const completed = initialProgress >= target
  const logMeal = async () => {
    const res = await fetchWithTimeout('/api/challenges/progress', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ challenge_type: 'iron', increment: 1 }),
    })
    const json = await res.json()
    if (json.success) onUpdate?.(json.data)
  }
  return (
    <ChallengeCard
      icon="🥬"
      title="Eat an Iron-Rich Meal"
      subtitle="Spinach, beans, dates, or almonds all count"
      points={CHALLENGES.iron.points}
      progress={initialProgress}
      target={target}
      unit=""
      completed={completed}
    >
      {!completed && (
        <button onClick={logMeal} className="btn-pill px-4 py-1.5 text-sm mt-1">I Ate This Today</button>
      )}
    </ChallengeCard>
  )
}