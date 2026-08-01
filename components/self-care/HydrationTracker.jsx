'use client'

import React, { useState, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { Plus, Minus, Droplet } from 'lucide-react';
import { getTodayISO } from '@/lib/date-utils';

const DAILY_TARGET = 8;
const STORAGE_KEY = 'hercycle_water_intake';

function getTodayString() {
  return getTodayISO();
}

export default function HydrationTracker({ phaseKey }) {
  const t = useTranslations('SelfCare');
  const [glasses, setGlasses] = useState(0);

  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
      if (saved && saved.date === getTodayString()) {
        setGlasses(saved.count);
      } else {
        localStorage.setItem(STORAGE_KEY, JSON.stringify({ date: getTodayString(), count: 0 }));
        setGlasses(0);
      }
    } catch (err) {
      setGlasses(0);
    }
  }, []);

  const updateGlasses = (newCount) => {
    const clamped = Math.max(0, Math.min(newCount, DAILY_TARGET));
    setGlasses(clamped);
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ date: getTodayString(), count: clamped }));
  };

  const percentage = Math.round((glasses / DAILY_TARGET) * 100);
  const tipKey = phaseKey && ['menstrual', 'follicular', 'ovulation', 'luteal'].includes(phaseKey)
    ? phaseKey
    : 'default';

  const radius = 54;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (percentage / 100) * circumference;

  return (
    <section className="bg-white/5 border border-white/10 rounded-3xl p-6 sm:p-8 space-y-6">
      <div className="flex items-center gap-2">
        <span className="text-2xl">💧</span>
        <h2 className="text-2xl font-bold text-white tracking-tight">
          {t('hydrationTitle')}
        </h2>
      </div>

      <div className="flex flex-col sm:flex-row items-center gap-8">
        <div className="relative w-36 h-36 shrink-0">
          <svg viewBox="0 0 120 120" className="w-full h-full -rotate-90">
            <circle cx="60" cy="60" r={radius} fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth="10" />
            <circle
              cx="60" cy="60" r={radius} fill="none"
              stroke="url(#hydrationGradient)"
              strokeWidth="10"
              strokeLinecap="round"
              strokeDasharray={circumference}
              strokeDashoffset={strokeDashoffset}
              style={{ transition: 'stroke-dashoffset 0.5s ease' }}
            />
            <defs>
              <linearGradient id="hydrationGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="var(--rose-mid)" />
                <stop offset="100%" stopColor="var(--lavender)" />
              </linearGradient>
            </defs>
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <Droplet className="w-5 h-5 text-white/70 mb-1" />
            <span className="text-white font-bold text-lg">{glasses}/{DAILY_TARGET}</span>
          </div>
        </div>

        <div className="flex-1 w-full space-y-4">
          <p className="text-white/80 text-sm">
            {t('glasses', { count: glasses, target: DAILY_TARGET })}
          </p>

          <div className="flex items-center gap-4">
            <button
              onClick={() => updateGlasses(glasses - 1)}
              disabled={glasses <= 0}
              aria-label={t('removeGlass')}
              className="w-12 h-12 rounded-full bg-white/10 hover:bg-white/20 border border-white/20 text-white flex items-center justify-center transition-all active:scale-90 disabled:opacity-30 disabled:cursor-not-allowed"
            >
              <Minus className="w-5 h-5" />
            </button>

            <button
              onClick={() => updateGlasses(glasses + 1)}
              disabled={glasses >= DAILY_TARGET}
              aria-label={t('addGlass')}
              className="w-12 h-12 rounded-full btn-pill !p-0 flex items-center justify-center transition-all active:scale-90 disabled:opacity-30 disabled:cursor-not-allowed"
            >
              <Plus className="w-5 h-5" />
            </button>
          </div>

          {glasses >= DAILY_TARGET && (
            <p className="text-white/90 text-sm font-medium">{t('hydrationGoalReached')}</p>
          )}
        </div>
      </div>

      <div className="bg-white/5 border border-white/10 rounded-2xl p-4">
        <p className="text-white/70 text-sm leading-relaxed">
          💡 {t(`hydrationTips.${tipKey}`)}
        </p>
      </div>
    </section>
  );
}