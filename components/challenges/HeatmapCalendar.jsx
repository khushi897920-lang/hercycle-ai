'use client'
import { useEffect, useState } from 'react'
import fetchWithTimeout from '@/lib/fetch-with-timeout'

function getIntensity(count) {
  if (!count) return 'rgba(255,255,255,0.10)'
  if (count <= 1) return 'rgba(232, 82, 126, 0.35)'
  if (count <= 3) return 'rgba(232, 82, 126, 0.65)'
  return 'linear-gradient(135deg, var(--rose-bright), var(--rose-mid))'
}

export default function HeatmapCalendar() {
  const [counts, setCounts] = useState(null)

  useEffect(() => {
    fetchWithTimeout('/api/challenges/heatmap').then((r) => r.json()).then((json) => json.success && setCounts(json.data.counts)).catch(console.error)
  }, [])

  if (!counts) return null

  const days = []
  for (let i = 29; i >= 0; i--) {
    const d = new Date()
    d.setDate(d.getDate() - i)
    const key = d.toISOString().slice(0, 10)
    days.push({ key, count: counts[key] || 0, label: d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) })
  }

  return (
    <div className="glass rounded-3xl p-5">
      <div className="flex items-center justify-between mb-3">
        <h2 className="font-semibold" style={{ fontFamily: 'var(--serif)', color: 'var(--text-white)' }}>
          Last 30 Days
        </h2>
        <span className="text-xs" style={{ color: 'var(--text-faint)' }}>
          {Object.values(counts).filter((c) => c > 0).length} active days
        </span>
      </div>
      <div className="grid grid-cols-10 gap-1.5 heatmap-grid">
        {days.map((day) => (
          <div
            key={day.key}
            title={`${day.label} — ${day.count} completion${day.count === 1 ? '' : 's'}`}
            className="aspect-square rounded-md transition-transform hover:scale-110"
            style={{ background: getIntensity(day.count) }}
          />
        ))}
      </div>
      <div className="flex items-center gap-1.5 mt-3 justify-end">
        <span className="text-xs" style={{ color: 'var(--text-faint)' }}>Less</span>
        <div className="w-3 h-3 rounded-sm" style={{ background: 'rgba(255,255,255,0.10)' }} />
        <div className="w-3 h-3 rounded-sm" style={{ background: 'rgba(232, 82, 126, 0.35)' }} />
        <div className="w-3 h-3 rounded-sm" style={{ background: 'rgba(232, 82, 126, 0.65)' }} />
        <div className="w-3 h-3 rounded-sm" style={{ background: 'linear-gradient(135deg, var(--rose-bright), var(--rose-mid))' }} />
        <span className="text-xs" style={{ color: 'var(--text-faint)' }}>More</span>
      </div>
    </div>
  )
  
}