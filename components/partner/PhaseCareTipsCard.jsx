'use client'

import { HeartHandshake } from 'lucide-react'

export default function PhaseCareTipsCard({ careTips, phaseContext }) {
  if (!careTips || careTips.length === 0) return null

  return (
    <div className="glass p-5 sm:p-6 rounded-3xl relative overflow-hidden w-full shadow-xl border border-white/10">
      <div className="flex items-center gap-3 mb-4">
        <div className="w-10 h-10 rounded-full bg-rose-500/20 border border-rose-500/30 flex items-center justify-center">
          <HeartHandshake className="w-5 h-5 text-rose-300" />
        </div>
        <div>
          <h2 className="text-lg font-semibold text-white">How to Support Her Today</h2>
          <p className="text-white/50 text-xs">Actionable care tips based on her cycle phase</p>
        </div>
      </div>

      {phaseContext?.summary && (
        <p className="text-white/70 text-xs mb-4 p-3 rounded-xl bg-white/5 border border-white/10 leading-relaxed italic">
          "{phaseContext.summary}"
        </p>
      )}

      <ul className="space-y-2.5">
        {careTips.map((tip, idx) => (
          <li key={idx} className="flex items-start gap-2.5 text-sm text-white/90 leading-relaxed">
            <span className="text-base shrink-0 select-none">🌸</span>
            <span>{tip}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}
