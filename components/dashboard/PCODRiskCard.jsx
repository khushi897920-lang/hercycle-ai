'use client'

import { useEffect, useState } from 'react'
import { useUser } from '@clerk/nextjs'
import generateReport from '@/lib/generateReport'
import { useTranslations, useLocale } from 'next-intl'
import { RISK_UNAVAILABLE_REASONS, normaliseRiskResult } from '@/lib/pcod-risk-result'

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
export default function PCODRiskCard({ pcodRisk, unavailableReason = null, loading, cycleCount = 0, cycles = [], recentSymptoms = [] }) {
  // Animate gauge width on mount / data change
  const [gaugeWidth, setGaugeWidth] = useState(0)
  const [exporting, setExporting] = useState(false)
  const { user } = useUser()
  const t = useTranslations('Risk')
  const tFactors = useTranslations('factors')
  const tRec = useTranslations('recommendations')
  const locale = useLocale()

  // A payload that does not validate is treated as absent. It used to be
  // coerced into "LOW RISK" by the old normalizeLabel default, which meant an
  // error payload and a genuine low-risk assessment rendered identically.
  const result         = normaliseRiskResult(pcodRisk)
  const label          = result?.tier ?? null
  const score          = result?.score ?? 0
  const factors        = result?.factors ?? []
  const recommendation = result?.recommendation ?? ''
  const tokens         = TIER_TOKENS[label] ?? TIER_TOKENS['LOW RISK']

  useEffect(() => {
    if (!loading && result) {
      // Slight delay so CSS transition fires visibly after paint
      const t = setTimeout(() => setGaugeWidth(score), 120)
      return () => clearTimeout(t)
    }
    setGaugeWidth(0)
  }, [loading, result, score])

  // generateReport awaits the Devanagari font before it draws anything, so the
  // click handler has to await it too. Firing and forgetting meant a font
  // fetch or a jsPDF failure surfaced as an unhandled rejection and a button
  // that appeared to do nothing at all.
  const handleExport = async () => {
    if (exporting) return
    setExporting(true)
    try {
      await generateReport({
        userName: user?.fullName || user?.firstName || 'User',
        email: user?.primaryEmailAddress?.emailAddress || '',
        cycles,
        pcod: result,
        recentSymptoms,
        locale,
        currentPhase: label,
      })
    } catch (error) {
      console.error('Failed to generate the doctor report', error)
    } finally {
      setExporting(false)
    }
  }

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

  // ── Assessment could not be run ────────────────────────────────────────────
  // Distinct from the "not enough data yet" state below: here we genuinely do
  // not know, and saying so is the only honest option. The card must not fall
  // back to a tier, because the whole point of this screening is to surface a
  // risk the user has not noticed.
  if (!result && unavailableReason) {
    const isOffline = unavailableReason === RISK_UNAVAILABLE_REASONS.OFFLINE

    return (
      <div className="risk-card glass">
        <div className="risk-header">
          <div>
            <h3>{t('title')}</h3>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-faint)', marginTop: 4 }}>
              {t('riskSub')}
            </p>
          </div>
          <div className="risk-badge" style={{
            background: 'rgba(255,255,255,0.08)',
            border: '1px solid rgba(255,255,255,0.15)',
            color: 'var(--text-faint)',
          }}>
            {t('unavailableBadge')}
          </div>
        </div>

        <div className="risk-empty-state" role="status">
          <div className="risk-empty-icon">⚠️</div>
          <p className="risk-empty-msg">
            {isOffline ? t('unavailableOffline') : t('unavailableBackend')}
          </p>
          <p className="risk-empty-sub">
            {t('unavailableSub')}
          </p>
        </div>

        <button className="export-btn" disabled style={{ opacity: 0.4 }}>
          {t('exportDoc')}
        </button>
      </div>
    )
  }

  // ── Empty / insufficient data fallback ─────────────────────────────────────
  if (!result || cycleCount < 2) {
    return (
      <div className="risk-card glass">
        <div className="risk-header">
          <div>
            <h3>{t('title')}</h3>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-faint)', marginTop: 4 }}>
              {t('riskSub')}
            </p>
          </div>
          <div className="risk-badge" style={{
            background: 'rgba(255,255,255,0.08)',
            border: '1px solid rgba(255,255,255,0.15)',
            color: 'var(--text-faint)',
          }}>
            {t('noData')}
          </div>
        </div>

        <div className="risk-empty-state">
          <div className="risk-empty-icon">🩺</div>
          <p className="risk-empty-msg">
            {t('logTwoCycles')}
          </p>
          <p className="risk-empty-sub">
            {t('currentCycles', { count: cycleCount })}
          </p>
        </div>

        <button className="export-btn" disabled style={{ opacity: 0.4 }}>
          {t('exportDoc')}
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
          <h3>{t('title')}</h3>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-faint)', marginTop: 4 }}>
            {t('riskSub')}
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
          {label === 'HIGH RISK'   ? t('high') :
           label === 'MEDIUM RISK' ? t('med')  :
           t('low')}
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
        {t('riskScore')}:{' '}
        <strong style={{ color: tokens.badgeColor }}>{score}/100</strong>
      </p>

      {/* Contributing factors from API */}
      <ul className="risk-factors">
        {factors.length > 0
          ? factors.map((f, i) => (
              <li key={i} style={{ '--dot-color': tokens.dotColor }}>
                {tFactors(f)}
              </li>
            ))
          : (
            <li style={{ color: 'var(--text-faint)', fontStyle: 'italic' }}>
              {t('noRiskFactors')}
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
          💡 {tRec(
            recommendation.includes('consulting') ? 'consult' :
            recommendation.includes('Keep tracking') ? 'keepTracking' :
            recommendation
          )}
        </p>
      )}

      <button
        className="export-btn"
        disabled={exporting}
        onClick={handleExport}
      >
        {t('exportDoc')}
      </button>
    </div>
  )
}
