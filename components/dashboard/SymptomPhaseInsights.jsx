'use client'

/**
 * SymptomPhaseInsights — the "symptom patterns by cycle phase" section of the
 * Insights page.
 *
 * The page already showed symptom *totals*; this shows where in the cycle each
 * one actually lands. All of the analysis lives in `lib/symptom-correlation.js`
 * (pure, tested); this file only renders it.
 *
 * Two rendering decisions follow directly from what the engine returns:
 *
 * 1. **A suppressed symptom is shown as suppressed, not hidden.** "You have
 *    logged Cramps 3 times — 1 more to look for a pattern" is more useful than
 *    silence, and it makes the threshold visible rather than mysterious.
 * 2. **The bar shows share of occurrences; the headline shows lift.** They are
 *    different numbers on purpose. Share is what the distribution looks like;
 *    lift is the finding, because it is the one that is not distorted by some
 *    phases simply having more logged days than others.
 */

import { useMemo } from 'react'
import { useTranslations } from 'next-intl'
import { Activity, Info } from 'lucide-react'
import {
  MIN_SYMPTOM_OCCURRENCES,
  PHASES,
  SUPPRESSION_REASONS,
  analyseSymptomPhases,
} from '@/lib/symptom-correlation'

const TEXT_PRIMARY = '#ffffff'
const TEXT_FAINT = 'rgba(255,255,255,0.65)'

/** One colour per phase, kept in cycle order so the bar reads left to right. */
const PHASE_COLORS = {
  menstrual: '#e8527e',
  follicular: '#7c5cbf',
  ovulation: '#f0a5c0',
  luteal: '#9d3f7a',
}

/** Fallback labels for when a translation key is missing. */
const PHASE_FALLBACKS = {
  menstrual: 'menstrual',
  follicular: 'follicular',
  ovulation: 'ovulation',
  luteal: 'luteal',
}

const CONFIDENCE_STYLES = {
  high: { bg: 'rgba(16,185,129,0.18)', border: 'rgba(16,185,129,0.45)', color: '#6ee7b7' },
  moderate: { bg: 'rgba(251,191,36,0.16)', border: 'rgba(251,191,36,0.4)', color: '#fcd34d' },
  low: { bg: 'rgba(255,255,255,0.08)', border: 'rgba(255,255,255,0.18)', color: TEXT_FAINT },
}

/**
 * @param {object} props
 * @param {Array} props.dailyLogs every daily log, as returned by fetchAllLogs()
 * @param {Array} props.cycles the cycle history
 * @param {number} [props.averageCycleLength] used when a cycle row has no length
 * @param {boolean} [props.loading]
 */
export default function SymptomPhaseInsights({
  dailyLogs = [],
  cycles = [],
  averageCycleLength = 28,
  loading = false,
}) {
  const t = useTranslations('SymptomPhases')
  const tSymptoms = useTranslations('symptoms')

  // The analysis walks every logged day, so it is memoised against the two
  // arrays it reads rather than recomputed on each render of the page.
  const analysis = useMemo(
    () => analyseSymptomPhases(dailyLogs, cycles, { fallbackCycleLength: averageCycleLength }),
    [dailyLogs, cycles, averageCycleLength]
  )

  const phaseLabel = (phase) => {
    const translated = t(`phase_${phase}`)
    // next-intl echoes the key back when it is missing; fall back rather than
    // rendering "phase_luteal" to the user.
    return translated && !translated.startsWith('phase_') ? translated : PHASE_FALLBACKS[phase]
  }

  /**
   * Prefers the tracker's own translated symptom name, falling back to the
   * user's own text for custom symptoms, which have no key.
   */
  const symptomLabel = (entry) => {
    const key = entry.displayName
    try {
      const translated = tSymptoms(key)
      if (translated && translated !== key) return translated
    } catch {
      // Custom symptom — not in the message catalogue, which is expected.
    }
    return entry.displayName
  }

  const card = {
    background: 'rgba(255,255,255,0.08)',
    border: '1px solid rgba(255,255,255,0.14)',
    borderRadius: 16,
    backdropFilter: 'blur(12px)',
    padding: '1.5rem',
    marginBottom: '1.5rem',
  }

  const header = (
    <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '0.5rem' }}>
      <div style={{
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        background: 'rgba(233,30,140,0.15)', borderRadius: '12px', padding: '8px',
      }}>
        <Activity size={18} color="#e91e8c" strokeWidth={1.5} aria-hidden="true" />
      </div>
      <h3 style={{ color: TEXT_PRIMARY, fontSize: '1.05rem', fontWeight: 600, margin: 0 }}>
        {t('title')}
      </h3>
    </div>
  )

  if (loading) {
    return (
      <div className="insight-card" style={card}>
        {header}
        <p style={{ color: TEXT_FAINT, textAlign: 'center', padding: '2rem 0' }}>{t('loading')}</p>
      </div>
    )
  }

  // Not enough history yet. Say exactly how much more is needed rather than
  // showing an empty chart — a number the user can act on beats "no data".
  if (!analysis.hasEnoughData) {
    return (
      <div className="insight-card" style={card}>
        {header}
        <p style={{ color: TEXT_FAINT, fontSize: '0.85rem', marginBottom: '1rem' }}>{t('subtitle')}</p>
        <div style={{
          textAlign: 'center', padding: '2rem 1rem',
          background: 'rgba(255,255,255,0.05)', borderRadius: 12,
          border: '1px dashed rgba(255,255,255,0.15)',
        }}>
          <p style={{ color: TEXT_PRIMARY, fontWeight: 600, marginBottom: '0.4rem' }}>
            {t('needMoreTitle')}
          </p>
          <p style={{ color: TEXT_FAINT, fontSize: '0.85rem', margin: 0 }}>
            {analysis.daysNeeded > 0
              ? t('needMoreDays', { count: analysis.daysNeeded })
              : t('needMorePhases')}
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="insight-card" style={card}>
      {header}
      <p style={{ color: TEXT_FAINT, fontSize: '0.85rem', marginBottom: '1.25rem' }}>
        {t('subtitle')}
      </p>

      {/* Exposure, stated up front. The whole analysis rests on how many days
          fall in each phase, so hiding it would make the results look more
          authoritative than the underlying data supports. */}
      <div style={{
        display: 'flex', flexWrap: 'wrap', gap: '0.5rem', marginBottom: '1.25rem',
      }}>
        {PHASES.map((phase) => (
          <span
            key={phase}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 6,
              fontSize: '0.72rem', color: TEXT_FAINT,
              background: 'rgba(255,255,255,0.05)',
              border: '1px solid rgba(255,255,255,0.1)',
              borderRadius: 999, padding: '4px 10px',
            }}
          >
            <span
              aria-hidden="true"
              style={{
                width: 8, height: 8, borderRadius: '50%',
                background: PHASE_COLORS[phase], display: 'inline-block',
              }}
            />
            {phaseLabel(phase)} · {t('daysCount', { count: analysis.exposure[phase] })}
          </span>
        ))}
      </div>

      {analysis.symptoms.length === 0 ? (
        <p style={{ color: TEXT_FAINT, textAlign: 'center', padding: '1.5rem 0' }}>
          {t('noSymptoms')}
        </p>
      ) : (
        <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'grid', gap: '1rem' }}>
          {analysis.symptoms.map((entry) => {
            const label = symptomLabel(entry)
            const confidenceStyle = CONFIDENCE_STYLES[entry.confidence] || CONFIDENCE_STYLES.low

            return (
              <li
                key={entry.symptom}
                tabIndex={0}
                aria-label={`${label}, ${t('loggedTimes', { count: entry.occurrences })}`}
                style={{
                  background: 'rgba(255,255,255,0.05)',
                  border: '1px solid rgba(255,255,255,0.1)',
                  borderRadius: 12,
                  padding: '0.9rem 1rem',
                }}
              >
                <div style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  gap: '0.75rem', flexWrap: 'wrap', marginBottom: '0.6rem',
                }}>
                  <span style={{ color: TEXT_PRIMARY, fontWeight: 600, fontSize: '0.95rem' }}>
                    {label}
                  </span>
                  <span style={{ color: TEXT_FAINT, fontSize: '0.72rem' }}>
                    {t('loggedTimes', { count: entry.occurrences })}
                  </span>
                </div>

                {/* Share of occurrences per phase. Labelled as such, because it
                    is deliberately not the number the finding is based on. */}
                <div
                  role="img"
                  aria-label={t('barLabel', {
                    symptom: label,
                    breakdown: entry.distribution
                      .filter((slice) => slice.count > 0)
                      .map((slice) => `${phaseLabel(slice.phase)} ${slice.share}%`)
                      .join(', ') || t('none'),
                  })}
                  style={{
                    display: 'flex', height: 10, borderRadius: 999, overflow: 'hidden',
                    background: 'rgba(255,255,255,0.08)', marginBottom: '0.6rem',
                  }}
                >
                  {entry.distribution.map((slice) => {
                    const safeShare = Number.isFinite(slice.share) && slice.share > 0 ? slice.share : 0
                    return safeShare > 0 ? (
                      <div
                        key={slice.phase}
                        style={{ width: `${safeShare}%`, background: PHASE_COLORS[slice.phase] }}
                      />
                    ) : null
                  })}
                </div>

                {entry.isReportable ? (
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.6rem', flexWrap: 'wrap' }}>
                    <p style={{ color: TEXT_PRIMARY, fontSize: '0.85rem', margin: 0, flex: 1, minWidth: 220 }}>
                      {t('finding', {
                        symptom: label,
                        phase: phaseLabel(entry.peakPhase),
                        lift: entry.lift,
                      })}
                    </p>
                    <span style={{
                      fontSize: '0.68rem', fontWeight: 600, whiteSpace: 'nowrap',
                      background: confidenceStyle.bg,
                      border: `1px solid ${confidenceStyle.border}`,
                      color: confidenceStyle.color,
                      borderRadius: 999, padding: '3px 9px',
                    }}>
                      {t(`confidence_${entry.confidence}`)}
                    </span>
                  </div>
                ) : (
                  <p style={{ color: TEXT_FAINT, fontSize: '0.8rem', margin: 0 }}>
                    {entry.suppressedBy === SUPPRESSION_REASONS.NO_PATTERN
                      ? t('evenlySpread', { symptom: label })
                      : entry.suppressedBy === SUPPRESSION_REASONS.NOT_ENOUGH_PHASES
                        ? t('needMorePhases')
                        : t('needMoreOccurrences', {
                          count: Math.max(0, MIN_SYMPTOM_OCCURRENCES - entry.occurrences),
                        })}
                  </p>
                )}
              </li>
            )
          })}
        </ul>
      )}

      {/* This is a tracker noticing a correlation in self-reported data, and
          the copy has to keep saying so. */}
      <p style={{
        display: 'flex', alignItems: 'flex-start', gap: '0.5rem',
        color: TEXT_FAINT, fontSize: '0.72rem', marginTop: '1.25rem', marginBottom: 0,
        lineHeight: 1.5,
      }}>
        <Info size={14} style={{ flexShrink: 0, marginTop: 2 }} aria-hidden="true" />
        {t('disclaimer')}
      </p>
    </div>
  )
}
