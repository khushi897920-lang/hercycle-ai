'use client'
import { useRouter } from 'next/navigation'
import { useTranslations, useLocale } from 'next-intl'

export default function HeroSection({ activeLang, cycleDayInfo }) {
  const t = useTranslations('Hero')
  const locale = useLocale()
  const router = useRouter()

  const title1   = t('title1')
  const title2   = t('title2')
  const subtitle = t('subtitle')

  const handleStartTracking = () => router.push(`/${locale}/track`)

  const handleCheckPCOD = () => {
    const el = document.getElementById('pcod-risk-section')
    if (el) el.scrollIntoView({ behavior: 'smooth' })
  }

  const badgeStyle = cycleDayInfo ? {
    color: cycleDayInfo.color,
    borderColor: `${cycleDayInfo.color}40`,
    background: `${cycleDayInfo.color}15`
  } : {}

  const dotStyle = cycleDayInfo ? {
    background: cycleDayInfo.dot,
    boxShadow: `0 0 0 0 ${cycleDayInfo.dot}90`
  } : {}

  return (
    <div className="hero-left">
      <div className="status-badge" style={badgeStyle}>
        <span className="pulse-dot" style={dotStyle}></span>
        {cycleDayInfo?.text || t('status')}
      </div>
      <h1>
        {title1} <br/><span className="gradient-text">{title2}</span>
      </h1>
      <p>{subtitle}</p>
      <div className="hero-btns">
        <button className="btn-white start-tracking-shine" onClick={handleStartTracking}>
          {t('btn1')}
        </button>
        <button className="btn-outline" onClick={handleCheckPCOD}>
          {t('btn2')}
        </button>
      </div>
    </div>
  )
}
