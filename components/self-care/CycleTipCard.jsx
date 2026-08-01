'use client'

import React from 'react';
import { useTranslations } from 'next-intl';
import { Sparkles } from 'lucide-react';

export default function CycleTipCard({ phaseKey }) {
  const t = useTranslations('SelfCare');

  // If no cycle information is available or invalid phase, do not render the card.
  // Fall back to a general wellness tip when no cycle phase can be determined yet
  const activePhase = ['menstrual', 'follicular', 'ovulation', 'luteal'].includes(phaseKey)
    ? phaseKey
    : 'general';

  const phaseTitle = t(`cycleTips.${activePhase}.title`);
  const tip1 = t(`cycleTips.${activePhase}.tip1`);
  const tip2 = t(`cycleTips.${activePhase}.tip2`);
  const tip3 = t(`cycleTips.${activePhase}.tip3`);

  return (
    <section className="bg-white/5 border border-white/10 rounded-3xl p-6 sm:p-8 space-y-6">
      <div className="flex items-center gap-2">
        <Sparkles className="w-6 h-6 text-rose-300 animate-pulse" />
        <h2 className="text-2xl font-bold text-white tracking-tight">
          {t('cycleTipTitle')}
        </h2>
      </div>

      <div className="bg-white/5 border border-white/10 rounded-2xl p-5 space-y-4">
        <h3 className="text-lg font-semibold text-white/90 flex items-center gap-2">
          {phaseTitle}
        </h3>
        <ul className="space-y-2.5 text-white/80 text-sm leading-relaxed list-none pl-1">
          <li className="flex items-start gap-2">
            <span className="text-rose-400 mt-1 select-none">•</span>
            <span>{tip1}</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-rose-400 mt-1 select-none">•</span>
            <span>{tip2}</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-rose-400 mt-1 select-none">•</span>
            <span>{tip3}</span>
          </li>
        </ul>
      </div>
    </section>
  );
}
