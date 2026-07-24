'use client'

import { Battery, BatteryCharging } from 'lucide-react'

export default function EnergyBatteryGauge({ energyBattery }) {
  if (!energyBattery) return null

  const { level, label, color } = energyBattery

  return (
    <div className="glass p-6 rounded-3xl relative overflow-hidden w-full md:w-[calc(50%-0.5rem)] max-w-md shadow-xl border border-white/10">
      <div className="flex items-center gap-3 mb-4">
        <div className="w-10 h-10 rounded-full bg-amber-500/20 border border-amber-500/30 flex items-center justify-center">
          <span className="text-xl select-none">🌻</span>
        </div>
        <div>
          <h2 className="text-lg font-semibold text-white">
            Energy & Vibe Battery
          </h2>
          <p className="text-white/50 text-xs">Estimated daily stamina level</p>
        </div>
      </div>

      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-2xl font-bold text-white flex items-center gap-2">
            {level}%
          </span>
          <span className="text-xs font-semibold px-3 py-1 rounded-full bg-white/10 text-white/90">
            {label}
          </span>
        </div>

        {/* Battery Progress Bar */}
        <div className="w-full h-3 bg-white/10 rounded-full overflow-hidden p-0.5 border border-white/10">
          <div
            className={`h-full rounded-full transition-all duration-500 ${color}`}
            style={{ width: `${level}%` }}
          />
        </div>

        <p className="text-white/60 text-xs pt-1">
          {level >= 75
            ? '🌻 Great energy window for active dates and social plans.'
            : level >= 50
            ? '🌿 Moderate stamina — balanced activities recommended.'
            : '🪫 Low stamina mode — quiet rest and cozy comfort appreciated.'}
        </p>
      </div>
    </div>
  )
}
