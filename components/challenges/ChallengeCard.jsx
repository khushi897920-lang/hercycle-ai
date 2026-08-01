
'use client'
export default function ChallengeCard({ icon, title, subtitle, progress, target, unit, points, completed, children }) {
  const pct = Math.min(100, Math.round((progress / target) * 100))
  return (
    <div className={`glass rounded-3xl p-6 space-y-4 challenge-card ${completed ? 'is-complete' : ''}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <div
            className={`w-12 h-12 rounded-2xl flex items-center justify-center text-2xl flex-shrink-0 ${completed ? 'celebrate-burst' : ''}`}
            style={{ background: 'linear-gradient(135deg, var(--rose-soft), var(--lavender))' }}
          >
            {completed ? '✅' : icon}
          </div>
          <div>
            <h3 className="font-bold text-lg" style={{ fontFamily: 'var(--serif)', color: 'var(--text-white)' }}>{title}</h3>
            {subtitle && <p className="text-xs" style={{ color: 'var(--text-soft)' }}>{subtitle}</p>}
          </div>
        </div>
        <span
          className="text-xs font-semibold px-2.5 py-1 rounded-full whitespace-nowrap"
          style={{ background: 'rgba(255,255,255,0.14)', color: 'var(--text-white)' }}
        >
          +{points} pts
        </span>
      </div>

      <div>
        <div className="w-full h-3 rounded-full progress-track" style={{ background: 'rgba(255,255,255,0.12)' }}>
          <div
            className={`h-full rounded-full progress-fill transition-all duration-700 ease-out ${!completed && pct > 0 ? 'shine' : ''}`}
            style={{
              width: `${pct}%`,
              background: completed
                ? 'linear-gradient(90deg, #34d399, #10b981)'
                : 'linear-gradient(90deg, var(--rose-bright), var(--rose-mid))',
            }}
          />
        </div>
        <div className="flex items-center justify-between mt-1.5">
          <p className="text-sm" style={{ color: 'var(--text-soft)' }}>{progress}{unit} / {target}{unit}</p>
          {completed && (
            <p className="text-sm font-semibold" style={{ color: '#6ee7b7' }}>Complete 🎉</p>
          )}
        </div>
      </div>

      {!completed && children}
    </div>
  )
}