'use client'

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useTranslations } from 'next-intl';
import { Droplet, Settings, X } from 'lucide-react';
import { getTodayISO } from '@/lib/date-utils';

// ─── Constants ──────────────────────────────────────────────────────────────

const INTAKE_KEY = 'hercycle_water_intake';
const SETTINGS_KEY = 'hercycle_hydration_settings';

const DEFAULT_SETTINGS = {
  dailyGoal: 2000,
  cupCapacity: 250,
  cupStyle: 'glass',
};

const CUP_STYLES = ['glass', 'tumbler', 'bottle'];

// ─── Helpers ────────────────────────────────────────────────────────────────

function getTodayString() {
  return getTodayISO();
}

function loadSettings() {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (raw) return { ...DEFAULT_SETTINGS, ...JSON.parse(raw) };
  } catch (_) {}
  return { ...DEFAULT_SETTINGS };
}

function saveSettings(settings) {
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  } catch (_) {}
}

function loadCount() {
  try {
    const saved = JSON.parse(localStorage.getItem(INTAKE_KEY));
    if (saved && saved.date === getTodayString()) return saved.count;
    // New day — reset but write the key so NotificationPreferences reads 0
    localStorage.setItem(INTAKE_KEY, JSON.stringify({ date: getTodayString(), count: 0 }));
  } catch (_) {}
  return 0;
}

function saveCount(count) {
  try {
    localStorage.setItem(INTAKE_KEY, JSON.stringify({ date: getTodayString(), count }));
  } catch (_) {}
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

// ─── Cup SVG icons ───────────────────────────────────────────────────────────

function GlassIcon({ filled, size = 28 }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 28 32"
      fill="none"
      aria-hidden="true"
      style={{ display: 'block' }}
    >
      {/* Outer glass silhouette */}
      <path
        d="M6 2 L4 30 H24 L22 2 Z"
        fill={filled ? 'url(#glFill)' : 'rgba(255,255,255,0.08)'}
        stroke="rgba(255,255,255,0.30)"
        strokeWidth="1.2"
        strokeLinejoin="round"
      />
      {/* Water fill wave (only when filled) */}
      {filled && (
        <path
          d="M5.2 20 Q8 17 11 20 Q14 23 17 20 Q20 17 22.8 20 L23.5 30 H4.5 Z"
          fill="rgba(255,255,255,0.25)"
        />
      )}
      {/* Rim highlight */}
      <line x1="6" y1="2" x2="22" y2="2" stroke="rgba(255,255,255,0.55)" strokeWidth="1.5" strokeLinecap="round" />
      <defs>
        <linearGradient id="glFill" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="var(--rose-mid)" />
          <stop offset="100%" stopColor="var(--lavender)" />
        </linearGradient>
      </defs>
    </svg>
  );
}

function TumblerIcon({ filled, size = 28 }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 28 32"
      fill="none"
      aria-hidden="true"
      style={{ display: 'block' }}
    >
      {/* Straight-sided tumbler */}
      <rect
        x="5" y="2" width="18" height="28" rx="3"
        fill={filled ? 'url(#tbFill)' : 'rgba(255,255,255,0.08)'}
        stroke="rgba(255,255,255,0.30)"
        strokeWidth="1.2"
      />
      {filled && (
        <path
          d="M5 20 Q9 17.5 14 20 Q19 22.5 23 20 L23 29 Q23 30 22 30 H6 Q5 30 5 29 Z"
          fill="rgba(255,255,255,0.22)"
        />
      )}
      {/* Lid line */}
      <line x1="5" y1="7" x2="23" y2="7" stroke="rgba(255,255,255,0.45)" strokeWidth="1.2" />
      <defs>
        <linearGradient id="tbFill" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="var(--rose-mid)" />
          <stop offset="100%" stopColor="var(--lavender)" />
        </linearGradient>
      </defs>
    </svg>
  );
}

function BottleIcon({ filled, size = 28 }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 28 36"
      fill="none"
      aria-hidden="true"
      style={{ display: 'block' }}
    >
      {/* Neck */}
      <rect x="10" y="1" width="8" height="7" rx="2"
        fill={filled ? 'url(#btFill)' : 'rgba(255,255,255,0.08)'}
        stroke="rgba(255,255,255,0.30)"
        strokeWidth="1"
      />
      {/* Body */}
      <path
        d="M8 8 Q4 10 4 14 L4 32 Q4 35 7 35 H21 Q24 35 24 32 L24 14 Q24 10 20 8 Z"
        fill={filled ? 'url(#btFill)' : 'rgba(255,255,255,0.08)'}
        stroke="rgba(255,255,255,0.30)"
        strokeWidth="1.2"
      />
      {filled && (
        <path
          d="M4.5 23 Q8 20.5 14 23 Q20 25.5 23.5 23 L23.5 32 Q23.5 34.5 21 34.5 H7 Q4.5 34.5 4.5 32 Z"
          fill="rgba(255,255,255,0.22)"
        />
      )}
      <defs>
        <linearGradient id="btFill" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="var(--rose-mid)" />
          <stop offset="100%" stopColor="var(--lavender)" />
        </linearGradient>
      </defs>
    </svg>
  );
}

function CupIcon({ style, filled, size }) {
  if (style === 'tumbler') return <TumblerIcon filled={filled} size={size} />;
  if (style === 'bottle') return <BottleIcon filled={filled} size={size} />;
  return <GlassIcon filled={filled} size={size} />;
}

// ─── Settings Modal ──────────────────────────────────────────────────────────

function SettingsModal({ settings, onSave, onClose, t }) {
  const [draft, setDraft] = useState({ ...settings });
  const modalRef = useRef(null);
  const firstFocusRef = useRef(null);

  // Focus trap — return focus on close
  useEffect(() => {
    const prev = document.activeElement;
    firstFocusRef.current?.focus();
    return () => { prev?.focus(); };
  }, []);

  // Close on Escape
  useEffect(() => {
    function handleKey(e) {
      if (e.key === 'Escape') onClose();
    }
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [onClose]);

  // Click outside to close
  function handleBackdropClick(e) {
    if (e.target === e.currentTarget) onClose();
  }

  function handleSave() {
    const validated = {
      dailyGoal: clamp(Number(draft.dailyGoal) || DEFAULT_SETTINGS.dailyGoal, 500, 5000),
      cupCapacity: clamp(Number(draft.cupCapacity) || DEFAULT_SETTINGS.cupCapacity, 50, 1000),
      cupStyle: CUP_STYLES.includes(draft.cupStyle) ? draft.cupStyle : 'glass',
    };
    onSave(validated);
    onClose();
  }

  const safeGoal = clamp(Number(draft.dailyGoal) || DEFAULT_SETTINGS.dailyGoal, 500, 5000);
  const safeCapacity = clamp(Number(draft.cupCapacity) || DEFAULT_SETTINGS.cupCapacity, 50, 1000);
  const numGlasses = Math.max(1, Math.round(safeGoal / safeCapacity));

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(4px)' }}
      onClick={handleBackdropClick}
      aria-modal="true"
      role="dialog"
      aria-label={t('hydrationSettings')}
    >
      <div
        ref={modalRef}
        className="relative w-full max-w-sm rounded-3xl border border-white/15 p-6 space-y-5"
        style={{ background: 'linear-gradient(145deg, rgba(40,18,45,0.97) 0%, rgba(28,14,34,0.99) 100%)' }}
      >
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-xl">⚙️</span>
            <h3 className="text-base font-bold text-white">{t('hydrationSettings')}</h3>
          </div>
          <button
            ref={firstFocusRef}
            onClick={onClose}
            aria-label={t('hydrationSettingsClose')}
            className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 border border-white/15 flex items-center justify-center text-white/70 hover:text-white transition-all"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Daily Goal */}
        <div className="space-y-1.5">
          <label htmlFor="hydration-daily-goal" className="block text-xs font-semibold text-white/60 uppercase tracking-wider">
            {t('dailyGoalLabel')}
          </label>
          <div className="flex items-center gap-2">
            <input
              id="hydration-daily-goal"
              type="number"
              min={500}
              max={5000}
              step={100}
              value={draft.dailyGoal}
              onChange={(e) => setDraft((d) => ({ ...d, dailyGoal: e.target.value }))}
              className="flex-1 bg-white/10 border border-white/15 rounded-xl px-3 py-2 text-white text-sm focus:outline-none focus:ring-2 focus:ring-pink-400/50"
              style={{ WebkitUserSelect: 'text', userSelect: 'text' }}
            />
            <span className="text-white/50 text-sm shrink-0">ml</span>
          </div>
        </div>

        {/* Cup Capacity */}
        <div className="space-y-1.5">
          <label htmlFor="hydration-cup-capacity" className="block text-xs font-semibold text-white/60 uppercase tracking-wider">
            {t('cupCapacityLabel')}
          </label>
          <div className="flex items-center gap-2">
            <input
              id="hydration-cup-capacity"
              type="number"
              min={50}
              max={1000}
              step={50}
              value={draft.cupCapacity}
              onChange={(e) => setDraft((d) => ({ ...d, cupCapacity: e.target.value }))}
              className="flex-1 bg-white/10 border border-white/15 rounded-xl px-3 py-2 text-white text-sm focus:outline-none focus:ring-2 focus:ring-pink-400/50"
              style={{ WebkitUserSelect: 'text', userSelect: 'text' }}
            />
            <span className="text-white/50 text-sm shrink-0">ml</span>
          </div>
          {numGlasses >= 4 && numGlasses <= 16 && (
            <p className="text-white/40 text-xs">
              → {numGlasses} {numGlasses === 1 ? t('cupStyleGlass').toLowerCase() : t('cupStyleGlass').toLowerCase() + 'es'}
            </p>
          )}
        </div>

        {/* Cup Style */}
        <div className="space-y-2">
          <span className="block text-xs font-semibold text-white/60 uppercase tracking-wider">
            {t('cupStyleLabel')}
          </span>
          <div className="grid grid-cols-3 gap-2">
            {CUP_STYLES.map((style) => {
              const label = t(`cupStyle${style.charAt(0).toUpperCase() + style.slice(1)}`);
              const active = draft.cupStyle === style;
              return (
                <button
                  key={style}
                  type="button"
                  onClick={() => setDraft((d) => ({ ...d, cupStyle: style }))}
                  aria-pressed={active}
                  className={`flex flex-col items-center gap-1.5 p-3 rounded-2xl border transition-all ${
                    active
                      ? 'border-pink-400/60 bg-white/10'
                      : 'border-white/10 bg-white/5 hover:bg-white/8'
                  }`}
                >
                  <CupIcon style={style} filled={active} size={26} />
                  <span className={`text-xs font-medium ${active ? 'text-white' : 'text-white/55'}`}>
                    {label}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Save button */}
        <button
          id="hydration-settings-save"
          onClick={handleSave}
          className="w-full btn-pill py-2.5 text-sm font-semibold"
        >
          {t('hydrationSettingsClose')}
        </button>
      </div>
    </div>
  );
}

// ─── Main Component ──────────────────────────────────────────────────────────

export default function HydrationTracker({ phaseKey }) {
  const t = useTranslations('SelfCare');

  const [settings, setSettings] = useState(DEFAULT_SETTINGS);
  const [count, setCount] = useState(0);
  const [showSettings, setShowSettings] = useState(false);
  const [mounted, setMounted] = useState(false);

  // Load from localStorage on mount (client only)
  useEffect(() => {
    setSettings(loadSettings());
    setCount(loadCount());
    setMounted(true);
  }, []);

  const numGlasses = clamp(Math.round(settings.dailyGoal / settings.cupCapacity), 4, 16);
  const currentMl = count * settings.cupCapacity;
  const percentage = Math.min(100, Math.round((currentMl / settings.dailyGoal) * 100));

  const handleGlassClick = useCallback((index) => {
    // If clicking the last filled glass, unfill it (toggle off)
    const newCount = index + 1 === count ? index : index + 1;
    const clamped = clamp(newCount, 0, numGlasses);
    setCount(clamped);
    saveCount(clamped);
  }, [count, numGlasses]);

  const handleSaveSettings = useCallback((newSettings) => {
    setSettings(newSettings);
    saveSettings(newSettings);
    // Clamp count if numGlasses shrank
    const newNumGlasses = clamp(Math.round(newSettings.dailyGoal / newSettings.cupCapacity), 4, 16);
    if (count > newNumGlasses) {
      setCount(newNumGlasses);
      saveCount(newNumGlasses);
    }
  }, [count]);

  const tipKey = phaseKey && ['menstrual', 'follicular', 'ovulation', 'luteal'].includes(phaseKey)
    ? phaseKey
    : 'default';

  // Circular ring geometry
  const radius = 54;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (percentage / 100) * circumference;

  // How many glasses fit per row (responsive)
  // Render a consistent grid; CSS wraps automatically
  const glassSize = numGlasses > 10 ? 24 : 28;

  return (
    <>
      <section className="bg-white/5 border border-white/10 rounded-3xl p-6 sm:p-8 space-y-6">
        {/* Header row */}
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <span className="text-2xl">💧</span>
            <h2 className="text-2xl font-bold text-white tracking-tight">
              {t('hydrationTitle')}
            </h2>
          </div>
          <button
            id="hydration-settings-btn"
            onClick={() => setShowSettings(true)}
            aria-label={t('openHydrationSettings')}
            title={t('openHydrationSettings')}
            className="w-9 h-9 rounded-full bg-white/10 hover:bg-white/20 border border-white/15 flex items-center justify-center text-white/60 hover:text-white transition-all active:scale-90 focus:outline-none focus:ring-2 focus:ring-pink-400/50"
          >
            <Settings className="w-4 h-4" />
          </button>
        </div>

        {/* Progress row */}
        <div className="flex flex-col sm:flex-row items-center gap-6 sm:gap-8">
          {/* Circular ring */}
          <div className="relative w-32 h-32 shrink-0">
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
              <Droplet className="w-5 h-5 text-white/70 mb-0.5" />
              {mounted ? (
                <span className="text-white font-bold text-base leading-tight text-center">
                  {currentMl}
                  <span className="block text-white/50 text-xs font-normal">/ {settings.dailyGoal} ml</span>
                </span>
              ) : (
                <span className="text-white font-bold text-lg">—</span>
              )}
            </div>
          </div>

          {/* Right side — progress text + glasses grid */}
          <div className="flex-1 w-full space-y-4">
            {/* ml progress label */}
            {mounted && (
              <p className="text-white/80 text-sm">
                {t('hydrationProgress', { current: currentMl, total: settings.dailyGoal })}
              </p>
            )}

            {/* Glass grid */}
            {mounted && (
              <div
                className="flex flex-wrap gap-2"
                role="group"
                aria-label={t('hydrationTitle')}
              >
                {Array.from({ length: numGlasses }, (_, i) => {
                  const filled = i < count;
                  const ariaLabel = filled
                    ? t('glassAriaFilled', { n: i + 1, ml: settings.cupCapacity })
                    : t('glassAriaEmpty', { n: i + 1, ml: settings.cupCapacity });
                  return (
                    <button
                      key={i}
                      onClick={() => handleGlassClick(i)}
                      aria-label={ariaLabel}
                      aria-pressed={filled}
                      className="flex items-center justify-center rounded-xl border transition-all duration-200 active:scale-90 focus:outline-none focus:ring-2 focus:ring-pink-400/60"
                      style={{
                        width: glassSize + 16,
                        height: glassSize + 16,
                        background: filled ? 'rgba(255,255,255,0.12)' : 'rgba(255,255,255,0.05)',
                        borderColor: filled ? 'rgba(255,255,255,0.30)' : 'rgba(255,255,255,0.10)',
                        transform: filled ? 'translateY(-1px)' : 'none',
                        boxShadow: filled ? '0 4px 12px rgba(232,82,126,0.25)' : 'none',
                      }}
                    >
                      <CupIcon style={settings.cupStyle} filled={filled} size={glassSize} />
                    </button>
                  );
                })}
              </div>
            )}

            {/* Goal reached */}
            {mounted && count >= numGlasses && (
              <p className="text-white/90 text-sm font-medium animate-pulse">
                {t('hydrationGoalReached')}
              </p>
            )}
          </div>
        </div>

        {/* Tip box */}
        <div className="bg-white/5 border border-white/10 rounded-2xl p-4">
          <p className="text-white/70 text-sm leading-relaxed">
            💡 {t(`hydrationTips.${tipKey}`)}
          </p>
        </div>
      </section>

      {/* Settings modal */}
      {showSettings && (
        <SettingsModal
          settings={settings}
          onSave={handleSaveSettings}
          onClose={() => setShowSettings(false)}
          t={t}
        />
      )}
    </>
  );
}