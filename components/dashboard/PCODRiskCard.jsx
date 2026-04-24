'use client'

import { useEffect, useState } from 'react'
import { t } from '@/lib/i18n'
import generateReport from '@/lib/generateReport'

// ── Tier normalization ────────────────────────────────────────────────────────
// Accepts both "MEDIUM RISK" (label) and "MEDIUM" (tier) from the API
function normalizeLabel(raw) {
  if (!raw) return 'LOW RISK'
  const up = raw.toUpperCase()
  if (up.includes('HIGH'))   return 'HIGH RISK'
  if (up.includes('MED'))    return 'MEDIUM RISK'
  return 'LOW RISK'
}

// ── Tier → visual tokens ──────────────────────────────────────────────────────
const TIER_TOKENS = {
  'LOW RISK': {
    gaugeColor:  'linear-gradient(90deg, #34d399, #059669)',
    badgeBg:     'rgba(52,211,153,0.18)',
    badgeBorder: 'rgba(52,211,153,0.45)',
    badgeColor:  '#34d399',
    dotColor:    '#34d399',
    glowColor:   'rgba(52,211,153,0.12)',
  },
  'MEDIUM RISK': {
    gaugeColor:  'linear-gradient(90deg, #fbbf24, #d97706)',
    badgeBg:     'rgba(251,191,36,0.18)',
    badgeBorder: 'rgba(251,191,36,0.45)',
    badgeColor:  '#fbbf24',
    dotColor:    '#fbbf24',
    glowColor:   'rgba(251,191,36,0.10)',
  },
  'HIGH RISK': {
    gaugeColor:  'linear-gradient(90deg, #f87171, #dc2626)',
    badgeBg:     'rgba(248,113,113,0.18)',
    badgeBorder: 'rgba(248,113,113,0.45)',
    badgeColor:  '#f87171',
    dotColor:    '#f87171',
    glowColor:   'rgba(248,113,113,0.12)',
  },
}

// ── Skeleton row ──────────────────────────────────────────────────────────────
function SkeletonRow({ width = '100%' }) {
  return (
    <div
      className="risk-skeleton-row"
      style={{ width }}
    />
  )
}

// ── Main component ────────────────────────────────────────────────────────────
export default function PCODRiskCard({ pcodRisk, loading, cycleCount = 0, cycles = [], recentSymptoms = [], activeLang }) {
  // Animate gauge width on mount / data change
  const [gaugeWidth, setGaugeWidth] = useState(0)

  const label          = normalizeLabel(pcodRisk?.label || pcodRisk?.tier)
  const score          = pcodRisk?.score  ?? 0
  const factors        = pcodRisk?.factors ?? []
  const recommendation = pcodRisk?.recommendation ?? ''
  const tokens         = TIER_TOKENS[label] ?? TIER_TOKENS['LOW RISK']

  useEffect(() => {
    if (!loading && pcodRisk) {
      // Slight delay so CSS transition fires visibly after paint
      const t = setTimeout(() => setGaugeWidth(score), 120)
      return () => clearTimeout(t)
    }
    setGaugeWidth(0)
  }, [loading, pcodRisk, score])

  // ── Loading skeleton ────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="risk-card glass">
        <div className="risk-header">
          <div>
            <div className="risk-skeleton-row" style={{ width: '55%', height: '1.5rem', marginBottom: 8 }} />
            <div className="risk-skeleton-row" style={{ width: '70%', height: '0.75rem' }} />
          </div>
          <div className="risk-skeleton-row" style={{ width: 80, height: 26, borderRadius: 50 }} />
        </div>
        <div className="risk-skeleton-row" style={{ height: 12, borderRadius: 50, marginBottom: 8 }} />
        <div className="risk-skeleton-row" style={{ width: '30%', height: '0.7rem', marginBottom: 20 }} />
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 20 }}>
          <SkeletonRow width="90%" />
          <SkeletonRow width="75%" />
          <SkeletonRow width="82%" />
        </div>
        <div className="risk-skeleton-row" style={{ height: 42, borderRadius: 12 }} />
      </div>
    )
  }

  // ── Empty / insufficient data fallback ─────────────────────────────────────
  if (!pcodRisk || cycleCount < 2) {
    return (
      <div className="risk-card glass">
        <div className="risk-header">
          <div>
            <h3>{t(activeLang, 'risk', 'title')}</h3>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-faint)', marginTop: 4 }}>
              {t(activeLang, 'risk', 'riskSub')}
            </p>
          </div>
          <div className="risk-badge" style={{
            background: 'rgba(255,255,255,0.08)',
            border: '1px solid rgba(255,255,255,0.15)',
            color: 'var(--text-faint)',
          }}>
            {activeLang === 'हि' ? 'डेटा नहीं' : 'No Data'}
          </div>
        </div>

        <div className="risk-empty-state">
          <div className="risk-empty-icon">🩺</div>
          <p className="risk-empty-msg">
            {activeLang === 'हि'
              ? 'PCOD जोखिम मूल्यांकन देखने के लिए कम से कम 2 चक्र लॉग करें।'
              : 'Log at least 2 cycles to see your risk assessment.'}
          </p>
          <p className="risk-empty-sub">
            {activeLang === 'हि'
              ? `आपके पास अभी ${cycleCount} चक्र हैं।`
              : `You currently have ${cycleCount} cycle${cycleCount === 1 ? '' : 's'} recorded.`}
          </p>
        </div>

        <button className="export-btn" disabled style={{ opacity: 0.4 }}>
          {t(activeLang, 'btn', 'exportDoc')}
        </button>
      </div>
    )
  }

  // ── Live data view ──────────────────────────────────────────────────────────
  return (
    <div className="risk-card glass" style={{ '--risk-glow': tokens.glowColor }}>
      {/* Header row */}
      <div className="risk-header">
        <div>
          <h3>{t(activeLang, 'risk', 'title')}</h3>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-faint)', marginTop: 4 }}>
            {t(activeLang, 'risk', 'riskSub')}
          </p>
        </div>

        {/* Live tier badge */}
        <div
          className="risk-badge"
          style={{
            background:   tokens.badgeBg,
            border:       `1px solid ${tokens.badgeBorder}`,
            color:        tokens.badgeColor,
            transition:   'all 0.4s ease',
          }}
        >
          {label === 'HIGH RISK'   ? t(activeLang, 'risk', 'high') :
           label === 'MEDIUM RISK' ? t(activeLang, 'risk', 'med')  :
           t(activeLang, 'risk', 'low')}
        </div>
      </div>

      {/* Animated gauge bar */}
      <div className="gauge" title={`Risk score: ${score}/100`}>
        <div
          className="gauge-fill"
          style={{
            width:      `${gaugeWidth}%`,
            background: tokens.gaugeColor,
            transition: 'width 1s cubic-bezier(0.22,1,0.36,1), background 0.4s ease',
            boxShadow:  `0 0 10px ${tokens.badgeBorder}`,
          }}
        />
      </div>

      {/* Numeric score */}
      <p style={{ fontSize: '0.78rem', color: 'var(--text-faint)', marginBottom: 16 }}>
        {t(activeLang, 'risk', 'riskScore')}:{' '}
        <strong style={{ color: tokens.badgeColor }}>{score}/100</strong>
      </p>

      {/* Contributing factors from API */}
      <ul className="risk-factors">
        {factors.length > 0
          ? factors.map((f, i) => (
              <li key={i} style={{ '--dot-color': tokens.dotColor }}>
                {f}
              </li>
            ))
          : (
            <li style={{ color: 'var(--text-faint)', fontStyle: 'italic' }}>
              {activeLang === 'हि' ? 'कोई जोखिम कारक नहीं मिला।' : 'No risk factors identified.'}
            </li>
          )
        }
      </ul>

      {/* API recommendation */}
      {recommendation && (
        <p style={{
          fontSize:   '0.82rem',
          color:      'var(--text-faint)',
          marginTop:  12,
          padding:    '10px 14px',
          background: `rgba(255,255,255,0.04)`,
          borderRadius: '10px',
          border:     '1px solid rgba(255,255,255,0.07)',
          lineHeight: 1.55,
        }}>
          💡 {recommendation}
        </p>
      )}

      <button className="export-btn" onClick={() => generateReport({ userName: 'khushji', email: 'khushi79916234@gmail.com', cycles, pcod: pcodRisk, recentSymptoms })}>
        {t(activeLang, 'btn', 'exportDoc')}
      </button>
    </div>
  )
}
