'use client'

import {
  Activity,
  CircleHelp,
  Droplets,
  HeartPulse,
  Lightbulb,
  Moon,
  Sparkles,
  Sprout,
  Sun,
} from 'lucide-react'

import { getCyclePhaseContent } from '@/lib/cyclePhaseContent'
import { useTranslations } from 'next-intl'

const ICONS = {
  droplets: Droplets,
  sprout: Sprout,
  sun: Sun,
  moon: Moon,
  'circle-help': CircleHelp,
}

function InfoSection({ icon, title, children }) {
  return (
    <div className="phase-info-section">
      <div className="phase-info-heading">
        {icon}
        <h4>{title}</h4>
      </div>
      {children}
    </div>
  )
}

export default function CyclePhaseCard({
  phaseKey,
  cycleDay,
  ovulationDay,
  hasData = true,
  className = '',
}) {
  const t = useTranslations('CycleEducation')

  if (!hasData || !phaseKey) {
    return (
      <section className={`cycle-phase-card cycle-phase-empty ${className}`}>
        <div className="phase-empty-icon" aria-hidden="true">
          <Sparkles size={28} />
        </div>
        <div>
          <p className="phase-eyebrow">{t('eyebrow')}</p>
          <h3>{t('title')}</h3>
          <p>
            {t('desc')}
          </p>
        </div>
        <style jsx>{styles}</style>
      </section>
    )
  }

  const content = getCyclePhaseContent(phaseKey)
  const PhaseIcon = ICONS[content.icon] || CircleHelp

  return (
    <section
      className={`cycle-phase-card ${className}`}
      style={{
        '--phase-accent': content.accent,
        '--phase-soft-accent': content.softAccent,
      }}
      aria-labelledby="current-cycle-phase-title"
    >
      <div className="phase-card-header">
        <div className="phase-title-wrap">
          <div className="phase-icon" aria-hidden="true">
            <PhaseIcon size={24} />
          </div>
          <div>
            <p className="phase-eyebrow">{content.eyebrow}</p>
            <h3 id="current-cycle-phase-title">{content.title}</h3>
          </div>
        </div>
        {cycleDay && (
          <span className="phase-day-badge" aria-label={`Cycle day ${cycleDay}`}>
            Day {cycleDay}
          </span>
        )}
      </div>

      <p className="phase-overview">{content.overview}</p>

      <div className="phase-content-grid">
        <InfoSection icon={<Activity size={18} />} title="Hormonal changes">
          <p>{content.hormones}</p>
        </InfoSection>

        <InfoSection icon={<HeartPulse size={18} />} title="Common experiences">
          <ul>
            {content.symptoms.map(item => <li key={item}>{item}</li>)}
          </ul>
        </InfoSection>

        <InfoSection icon={<Lightbulb size={18} />} title="Self-care ideas">
          <ul>
            {content.selfCare.map(item => <li key={item}>{item}</li>)}
          </ul>
        </InfoSection>
      </div>

      {phaseKey === 'ovulation' && ovulationDay && (
        <p className="phase-estimate">
          Estimated ovulation is around cycle day {ovulationDay}. This can vary
          from cycle to cycle.
        </p>
      )}

      <p className="phase-disclaimer">
        Educational information only. Cycle predictions and symptoms vary and
        should not replace advice from a qualified healthcare professional.
      </p>

      <style jsx>{styles}</style>
    </section>
  )
}

const styles = `
  .cycle-phase-card {
  position: relative;
  overflow: hidden;
  padding: 1.5rem;
  border: 1px solid rgba(255, 255, 255, 0.14);
  border-radius: 20px;
  background: rgba(255, 255, 255, 0.075);
  box-shadow: 0 16px 40px rgba(24, 8, 35, 0.18);
  backdrop-filter: blur(16px);
  color: #fff;
  transition: transform 0.25s ease, box-shadow 0.25s ease, border-color 0.25s ease;
  will-change: transform;
}

.cycle-phase-card:hover {
  transform: translateY(-5px);
  box-shadow: 0 22px 52px rgba(24, 8, 35, 0.28), 0 0 0 1px rgba(255, 255, 255, 0.10);
  border-color: rgba(255, 255, 255, 0.24);
}
  .phase-card-header, .phase-title-wrap, .phase-info-heading {
    display: flex;
    align-items: center;
  }
  .phase-card-header {
    justify-content: space-between;
    gap: 1rem;
    margin-bottom: 1rem;
  }
  .phase-title-wrap { gap: 0.85rem; }
  .phase-icon, .phase-empty-icon {
    display: grid;
    flex: 0 0 auto;
    place-items: center;
    width: 46px;
    height: 46px;
    border: 1px solid rgba(255,255,255,.16);
    border-radius: 14px;
    background: var(--phase-soft-accent, rgba(232, 82, 126, 0.15));
    color: var(--phase-accent, #e8527e);
  }
  .phase-eyebrow {
    margin: 0 0 0.2rem;
    color: var(--phase-accent, #e8527e);
    font-size: 0.74rem;
    font-weight: 800;
    letter-spacing: 0.08em;
    text-transform: uppercase;
  }
  h3, h4, p { margin-top: 0; }
  h3 { margin-bottom: 0; font-size: clamp(1.15rem, 2vw, 1.45rem); }
  .phase-day-badge {
    flex: 0 0 auto;
    padding: 0.48rem 0.72rem;
    border: 1px solid rgba(255,255,255,.18);
    border-radius: 999px;
    background: var(--phase-soft-accent);
    color: #fff;
    font-size: 0.78rem;
    font-weight: 800;
  }
  .phase-overview {
    margin-bottom: 1.25rem;
    color: rgba(255, 255, 255, 0.78);
    line-height: 1.65;
  }
  .phase-content-grid {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 0.9rem;
  }
  .phase-info-section {
    padding: 1rem;
    border: 1px solid rgba(255, 255, 255, 0.09);
    border-radius: 14px;
    background: rgba(255, 255, 255, 0.045);
  }
  .phase-info-heading {
    gap: 0.5rem;
    margin-bottom: 0.7rem;
    color: var(--phase-accent);
  }
  .phase-info-heading h4 {
    margin-bottom: 0;
    color: #fff;
    font-size: 0.9rem;
  }
  .phase-info-section p, .phase-info-section li {
    color: rgba(255, 255, 255, 0.7);
    font-size: 0.84rem;
    line-height: 1.55;
  }
  .phase-info-section p, .phase-info-section ul { margin-bottom: 0; }
  .phase-info-section ul { padding-left: 1.1rem; }
  .phase-info-section li + li { margin-top: 0.4rem; }
  .phase-estimate {
    margin: 1rem 0 0;
    padding: 0.75rem 0.9rem;
    border-left: 3px solid var(--phase-accent);
    border-radius: 8px;
    background: var(--phase-soft-accent);
    color: rgba(255, 255, 255, 0.83);
    font-size: 0.84rem;
  }
  .phase-disclaimer {
    margin: 1rem 0 0;
    color: rgba(255, 255, 255, 0.47);
    font-size: 0.72rem;
    line-height: 1.5;
  }
  .cycle-phase-empty {
    display: flex;
    align-items: flex-start;
    gap: 1rem;
  }
  .cycle-phase-empty h3 { margin-bottom: 0.45rem; }
  .cycle-phase-empty p:last-child {
    margin-bottom: 0;
    color: rgba(255, 255, 255, 0.68);
    line-height: 1.6;
  }
  @media (max-width: 900px) {
    .phase-content-grid { grid-template-columns: 1fr; }
  }
  @media (max-width: 520px) {
    .cycle-phase-card { padding: 1.1rem; border-radius: 16px; }
    .phase-card-header { align-items: flex-start; }
    .phase-day-badge { padding: 0.4rem 0.6rem; }
    .cycle-phase-empty { flex-direction: column; }
  }
`
