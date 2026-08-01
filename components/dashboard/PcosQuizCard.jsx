'use client'

import React from 'react'
import { Clipboard, Sparkles } from 'lucide-react'

export default function PcosQuizCard({ onClick }) {
  return (
    <div className="w-full my-4 p-5 rounded-3xl bg-gradient-to-r from-purple-950/40 via-pink-950/40 to-slate-950/60 border border-pink-400/30 shadow-xl backdrop-blur-xl">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-start gap-4">
          <div className="w-12 h-12 rounded-2xl bg-pink-500/20 border border-pink-500/40 flex items-center justify-center shrink-0 shadow-inner">
            <Clipboard className="w-6 h-6 text-pink-300" />
          </div>
          <div>
            <h3 className="text-white font-bold text-base flex items-center gap-1.5">
              PCOS Screening Quiz <Sparkles className="w-3.5 h-3.5 text-amber-300" />
            </h3>
            <p className="text-white/60 text-xs mt-1">
              Take a short, optional quiz to check your likelihood of PCOS symptoms.
            </p>
          </div>
        </div>
        <button
          onClick={onClick}
          className="bg-gradient-to-r from-rose-500 to-pink-500 hover:from-rose-600 hover:to-pink-600 text-white text-xs px-5 py-2.5 rounded-xl font-semibold shadow-lg transition-all self-start sm:self-center shrink-0 hover:shadow-[0_0_15px_rgba(232,82,126,0.5)]"
        >
          Take Quiz
        </button>
      </div>
    </div>
  )
}
