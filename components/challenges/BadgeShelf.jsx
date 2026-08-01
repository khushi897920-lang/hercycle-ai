'use client'
import { BADGES } from '@/lib/challenges-data'

export default function BadgeShelf({ earnedKeys }) {
  const earnedSet = new Set(earnedKeys)
  return (
    <div className="glass rounded-3xl p-5">
      <h2 className="font-semibold mb-3" style={{ fontFamily: 'var(--serif)', color: 'var(--text-white)' }}>
        Your Badges
      </h2>
      <div className="flex flex-wrap gap-3">
        {Object.values(BADGES).map((b) => {
          const earned = earnedSet.has(b.key)
          return (
            <div
              key={b.key}
              className={`badge-chip ${earned ? 'earned' : 'locked'} flex items-center gap-2 px-3 py-2 rounded-2xl`}
              style={{ background: 'rgba(255,255,255,0.10)', border: '1px solid var(--glass-edge2)' }}
              title={earned ? b.label : `Locked — ${b.label}`}
            >
              <span className="text-xl">{b.icon}</span>
              <span className="text-sm font-medium" style={{ color: 'var(--text-white)' }}>{b.label}</span>
            </div>
          )
        })}
      </div>
    </div>
  )
}