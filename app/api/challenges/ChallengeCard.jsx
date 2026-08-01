'use client'
export default function ChallengeCard({ icon, title, progress, target, unit, completed, children }) {
  const pct = Math.min(100, Math.round((progress / target) * 100))
  return (
    <div className="glass rounded-3xl p-5 space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-white font-bold text-lg flex items-center gap-2">
          <span>{icon}</span> {title}
        </h3>
        {completed && <span className="text-xs font-semibold px-2 py-1 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">Done 🎉</span>}
      </div>
      <div className="w-full h-2.5 rounded-full bg-white/10 overflow-hidden">
        <div className="h-full bg-gradient-to-r from-rose-400 to-pink-500 transition-all duration-500" style={{ width: `${pct}%` }} />
      </div>
      <p className="text-white/70 text-sm">{progress}{unit} / {target}{unit}</p>
      {children}
    </div>
  )
}