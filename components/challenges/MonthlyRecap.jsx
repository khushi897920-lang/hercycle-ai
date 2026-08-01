'use client'
import { useEffect, useState } from 'react'
import { MONTHLY_BADGES, getMonthLabel } from '@/lib/challenges-data'
import fetchWithTimeout from '@/lib/fetch-with-timeout'

export default function MonthlyRecap() {
  const [recap, setRecap] = useState(null)

  useEffect(() => {
    fetchWithTimeout('/api/challenges/monthly-recap').then((r) => r.json()).then((json) => json.success && setRecap(json.data)).catch(console.error)
  }, [])

  if (!recap) return null

  return (
    <div className="glass rounded-3xl p-5">
      <div className="flex items-center justify-between mb-3">
        <h2 className="font-semibold" style={{ fontFamily: 'var(--serif)', color: 'var(--text-white)' }}>
          {getMonthLabel()} Recap
        </h2>
        <span className="text-xs" style={{ color: 'var(--text-faint)' }}>Resets next month</span>
      </div>
      <div className="grid grid-cols-3 gap-3 mb-4">
        <div className="text-center">
          <p className="text-2xl font-bold" style={{ color: 'var(--text-white)' }}>{recap.totalCompletions}</p>
          <p className="text-xs" style={{ color: 'var(--text-soft)' }}>Completions</p>
        </div>
        <div className="text-center">
          <p className="text-2xl font-bold" style={{ color: 'var(--text-white)' }}>{recap.activeDays}</p>
          <p className="text-xs" style={{ color: 'var(--text-soft)' }}>Active Days</p>
        </div>
        <div className="text-center">
          <p className="text-2xl font-bold" style={{ color: 'var(--text-white)' }}>{recap.points}</p>
          <p className="text-xs" style={{ color: 'var(--text-soft)' }}>Points</p>
        </div>
      </div>
      <div className="flex flex-wrap gap-2">
        {Object.entries(MONTHLY_BADGES).map(([key, badge]) => {
          const earned = recap.badges.some((b) => b.startsWith(key))
          return (
            <span
              key={key}
              className={`badge-chip ${earned ? 'earned' : 'locked'} flex items-center gap-1.5 px-2.5 py-1.5 rounded-2xl text-sm`}
              style={{ background: 'rgba(255,255,255,0.10)', border: '1px solid var(--glass-edge2)', color: 'var(--text-white)' }}
            >
              <span>{badge.icon}</span> {badge.label}
            </span>
          )
        })}
      </div>
    </div>
  )
}