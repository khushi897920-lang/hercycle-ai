

'use client'
import { useEffect, useState } from 'react'
import { useTranslations } from 'next-intl'
import Navbar from '@/components/layout/Navbar'
import WaterChallenge from '@/components/challenges/WaterChallenge'
import StretchChallenge from '@/components/challenges/StretchChallenge'
import MoodChallenge from '@/components/challenges/MoodChallenge'
import BadgeShelf from '@/components/challenges/BadgeShelf'
import { CHALLENGES, BADGES } from '@/lib/challenges-data'
import IronMealChallenge from '@/components/challenges/IronMealChallenge'
import SleepChallenge from '@/components/challenges/SleepChallenge'
import MonthlyRecap from '@/components/challenges/MonthlyRecap'
import HeatmapCalendar from '@/components/challenges/HeatmapCalendar'
import fetchWithTimeout from '@/lib/fetch-with-timeout'


function SkeletonBlock({ className = '' }) {
  return <div className={`rounded-2xl bg-white/10 animate-pulse ${className}`} aria-hidden="true" />
}

function ChallengeCardSkeleton() {
  return (
    <div className="glass rounded-3xl p-5 space-y-4" aria-hidden="true">
      <div className="flex items-center gap-3">
        <SkeletonBlock className="w-12 h-12 rounded-full" />
        <div className="flex-1 space-y-2">
          <SkeletonBlock className="h-4 w-1/2" />
          <SkeletonBlock className="h-3 w-3/4" />
        </div>
      </div>
      <SkeletonBlock className="h-3 w-1/4" />
      <SkeletonBlock className="h-2 w-full" />
      <div className="flex gap-2 pt-2">
        <SkeletonBlock className="h-10 w-24 rounded-full" />
        <SkeletonBlock className="h-10 w-24 rounded-full" />
      </div>
    </div>
  )
}

function ChallengesSkeleton() {
  return (
    <div className="space-y-4">
      {[0, 1, 2, 3, 4].map((i) => <ChallengeCardSkeleton key={i} />)}
    </div>
  )
}


export default function ChallengesPage() {
  const t = useTranslations('Challenges')
  const [data, setData] = useState(null)
  const [newBadge, setNewBadge] = useState(null)

  useEffect(() => {
    fetchWithTimeout('/api/challenges').then((r) => r.json()).then((json) => json.success && setData(json.data)).catch(console.error)
  }, [])

  const handleUpdate = (result) => {
    if (result.newBadges?.length) setNewBadge(result.newBadges[0])
    fetchWithTimeout('/api/challenges').then((r) => r.json()).then((json) => json.success && setData(json.data)).catch(console.error)
  }

  const getProgress = (type) => data?.progress.find((p) => p.challenge_type === type)?.progress_value || 0
  // const completedToday = data?.progress.filter((p) => p.completed).length || 0
  // const pointsToday = data?.progress
  //   .filter((p) => p.completed)
  //   .reduce((sum, p) => sum + (CHALLENGES[p.challenge_type]?.points || 0), 0) || 0
  // const allDone = completedToday === 3
  const completedToday = data?.progress.filter((p) => p.completed).length || 0
  const pointsToday = data?.progress
    .filter((p) => p.completed)
    .reduce((sum, p) => sum + (CHALLENGES[p.challenge_type]?.points || 0), 0) || 0
  const allDone = completedToday === 5

  if (!data) {
    return (
      <div className="page">
        <Navbar />
        <main className="pb-24 pt-6 px-3 sm:px-6 max-w-3xl mx-auto w-full space-y-8" aria-busy="true">
          <div className="space-y-1">
            <SkeletonBlock className="h-8 w-2/3" />
            <SkeletonBlock className="h-4 w-1/3" />
          </div>
          <div className="flex gap-3 overflow-hidden">
            {[0, 1, 2, 3, 4, 5].map((i) => (
              <SkeletonBlock key={i} className="w-16 h-16 rounded-full shrink-0" />
            ))}
          </div>
          <ChallengesSkeleton />
        </main>
      </div>
    )
  }

  return (
    <div className="page">
      <Navbar />
      <main className="challenge-content pb-24 pt-6 px-3 sm:px-6 max-w-3xl mx-auto w-full space-y-8">
        <header className="space-y-1">
          <h1 className="text-2xl sm:text-4xl font-bold drop-shadow-md" style={{ fontFamily: 'var(--serif)', color: 'var(--text-white)' }}>
            🌸 {t('title')}
          </h1>
          <p style={{ color: 'var(--text-soft)' }} className="text-sm sm:text-base">
            {allDone
              ? "You've completed everything today — see you tomorrow! 🌷"
              : `${completedToday} of 5 done · ${pointsToday} points earned today`}
          </p>
        </header>

       <BadgeShelf earnedKeys={(data.badges || []).map((b) => b.badge_key)} />
        <MonthlyRecap />
        <HeatmapCalendar />

        {allDone && (
          <div className="glass rounded-3xl p-6 text-center" style={{ borderColor: 'rgba(110,231,183,0.5)' }}>
            <p className="text-2xl mb-1">🎉</p>
            <p className="font-semibold" style={{ color: 'var(--text-white)' }}>All caught up for today</p>
            <p className="text-sm mt-1" style={{ color: 'var(--text-soft)' }}>New challenges reset at midnight. Come back tomorrow to keep your streak going.</p>
          </div>
        )}

        {/* <section className="space-y-4">
          <WaterChallenge initialProgress={getProgress('water')} target={CHALLENGES.water.target} onUpdate={handleUpdate} />
          <StretchChallenge initialProgress={getProgress('stretch')} target={CHALLENGES.stretch.target} onUpdate={handleUpdate} />
          <MoodChallenge initialProgress={getProgress('mood')} target={CHALLENGES.mood.target} onUpdate={handleUpdate} />
        </section> */}
       
       <section className="space-y-4">
          <WaterChallenge initialProgress={getProgress('water')} target={CHALLENGES.water.target} onUpdate={handleUpdate} />
          <StretchChallenge initialProgress={getProgress('stretch')} target={CHALLENGES.stretch.target} onUpdate={handleUpdate} />
          <MoodChallenge initialProgress={getProgress('mood')} target={CHALLENGES.mood.target} onUpdate={handleUpdate} />
          <IronMealChallenge initialProgress={getProgress('iron')} target={CHALLENGES.iron.target} onUpdate={handleUpdate} />
          <SleepChallenge initialProgress={getProgress('sleep')} target={CHALLENGES.sleep.target} onUpdate={handleUpdate} />
        </section>

        {newBadge && (
          <div className="fixed inset-0 z-[9999] flex items-center justify-center p-6 bg-black/80 backdrop-blur-md" onClick={() => setNewBadge(null)}>
            <div className="glass rounded-3xl p-8 text-center max-w-sm celebrate-burst">
              <div className="text-5xl mb-3">{BADGES[newBadge]?.icon}</div>
              <h3 className="text-xl font-bold" style={{ fontFamily: 'var(--serif)', color: 'var(--text-white)' }}>{t('badgeEarned')}</h3>
              <p className="mt-1" style={{ color: 'var(--text-soft)' }}>{BADGES[newBadge]?.label}</p>
              <button onClick={() => setNewBadge(null)} className="btn-pill px-6 py-2 mt-4 text-sm">Nice!</button>
            </div>
          </div>
        )}
      </main>
    </div>
  )
}