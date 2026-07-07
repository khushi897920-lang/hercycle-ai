'use client'

import { useState, useEffect, useRef } from 'react'
import { useTranslations } from 'next-intl'

/**
 * Animated count-up hook.
 * Counts from 0 to `target` over `duration` ms using requestAnimationFrame.
 */
function useCountUp(target, duration = 1800, startDelay = 400) {
  const [value, setValue] = useState(0)
  const started = useRef(false)

  useEffect(() => {
    if (target == null || target <= 0) return
    if (started.current) return
    started.current = true

    const timeout = setTimeout(() => {
      const startTime = performance.now()

      const tick = (now) => {
        const elapsed = now - startTime
        const progress = Math.min(elapsed / duration, 1)
        // ease-out cubic
        const eased = 1 - Math.pow(1 - progress, 3)
        setValue(Math.round(eased * target))

        if (progress < 1) {
          requestAnimationFrame(tick)
        }
      }

      requestAnimationFrame(tick)
    }, startDelay)

    return () => clearTimeout(timeout)
  }, [target, duration, startDelay])

  return value
}

export default function PredictionCard({ cycleData }) {
  const t = useTranslations('Prediction')
  const rawConfidence = cycleData?.confidence
    ? parseInt(cycleData.confidence)
    : null

  const animatedConfidence = useCountUp(rawConfidence, 1800, 600)
  const animatedCycleLen = useCountUp(cycleData?.averageCycleLength, 1000, 300)
  const [revealed, setRevealed] = useState(false)

  useEffect(() => {
    const timer = setTimeout(() => setRevealed(true), 200)
    return () => clearTimeout(timer)
  }, [])

  const nextDate = cycleData?.nextPeriodDate || '—'
  const avgLen = cycleData?.averageCycleLength || 28

  // Confidence color gradient
  const confColor = rawConfidence >= 85
    ? '#34d399'
    : rawConfidence >= 70
      ? '#fbbf24'
      : '#f87171'

  return (
    <div className={`pred-card glass ${revealed ? 'pred-revealed' : ''}`}>
      {/* Top sparkle bar */}
      <div className="pred-sparkle-bar">
        <span>✨</span>
        <span className="pred-badge">
          {t('aiTitle')}
        </span>
        <span>✨</span>
      </div>

      <h3 className="pred-title">
        {t('nextCycle')}
      </h3>

      {/* Predicted date — big hero number */}
      <div className="pred-date-hero">
        <div className="pred-date-label">
          {t('expectedDate')}
        </div>
        <div className="pred-date-value">{nextDate}</div>
      </div>

      {/* Animated confidence ring */}
      <div className="pred-confidence-wrap">
        <div className="pred-ring-container">
          <svg viewBox="0 0 120 120" className="pred-ring-svg">
            <circle
              cx="60" cy="60" r="52"
              fill="none"
              stroke="rgba(255,255,255,0.08)"
              strokeWidth="8"
            />
            <circle
              cx="60" cy="60" r="52"
              fill="none"
              stroke={confColor}
              strokeWidth="8"
              strokeLinecap="round"
              strokeDasharray={`${2 * Math.PI * 52}`}
              strokeDashoffset={`${2 * Math.PI * 52 * (1 - animatedConfidence / 100)}`}
              className="pred-ring-progress"
              style={{ filter: `drop-shadow(0 0 6px ${confColor})` }}
            />
          </svg>
          <div className="pred-ring-label">
            <span className="pred-ring-number" style={{ color: confColor }}>
              {animatedConfidence}
            </span>
            <span className="pred-ring-pct">%</span>
          </div>
        </div>
        <div className="pred-conf-text">
          {t('confidence')}
        </div>
      </div>

      {/* Cycle stats mini row */}
      <div className="pred-stats-row">
        <div className="pred-stat-item">
          <div className="pred-stat-num">{animatedCycleLen}</div>
          <div className="pred-stat-label">
            {t('avgCycle')}
          </div>
        </div>
        <div className="pred-stat-divider"></div>
        <div className="pred-stat-item">
          <div className="pred-stat-num">{cycleData?.cycles?.length || 0}</div>
          <div className="pred-stat-label">
            {t('cyclesRecorded')}
          </div>
        </div>
      </div>

      <p className="pred-footer-note">
        {t('basedOn', { avg: String(avgLen) })}
      </p>
    </div>
  )
}
