'use client'
import ChallengeCard from './ChallengeCard'
import { CHALLENGES } from '@/lib/challenges-data'
import fetchWithTimeout from '@/lib/fetch-with-timeout'

export default function MoodChallenge({ initialProgress, target, onUpdate }) {
  const completed = initialProgress >= target
  const logMood = async () => {
    const res = await fetchWithTimeout('/api/challenges/progress', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ challenge_type: 'mood', increment: 1 }),
    })
    const json = await res.json()
    if (json.success) onUpdate?.(json.data)
  }
 return (
    <ChallengeCard
      icon="😊"
      title="Log Today's Mood"
      subtitle="Takes 5 seconds, helps your predictions"
      points={CHALLENGES.mood.points}
      progress={initialProgress}
      target={target}
      unit=""
      completed={completed}
    >
      {!completed && (
        <button onClick={logMood} className="btn-pill px-4 py-1.5 text-sm mt-1">I Logged My Mood</button>
      )}
    </ChallengeCard>
  )
}