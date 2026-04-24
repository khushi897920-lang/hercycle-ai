'use client'
import { useRouter } from 'next/navigation'
import { useLanguage } from '@/lib/LanguageContext'

export default function HeroSection({ activeLang, cycleDayInfo }) {
  const { useTranslation } = useLanguage()
  const router = useRouter()

  const title1   = useTranslation('hero', 'heroTitle')  || useTranslation('hero', 'title1')
  const title2   = useTranslation('hero', 'title2')
  const subtitle = useTranslation('hero', 'heroSubtitle') || useTranslation('hero', 'subtitle')

  const handleStartTracking = () => router.push('/track')

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
        {cycleDayInfo?.text || useTranslation('hero', 'status')}
      </div>
      <h1>
        {title1} <br/><span className="gradient-text">{title2}</span>
      </h1>
      <p>{subtitle}</p>
      <div className="hero-btns">
        <button className="btn-white" onClick={handleStartTracking}>
          {useTranslation('hero', 'btn1') || 'Start Tracking ✨'}
        </button>
        <button className="btn-outline" onClick={handleCheckPCOD}>
          {useTranslation('hero', 'btn2') || 'Check PCOD Risk'}
        </button>
      </div>
    </div>
  )
}
