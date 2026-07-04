import { useTranslations } from 'next-intl'

export default function FeaturesSection() {
  const t = useTranslations('features')
  
  return (
    <>
      <h2 className="sec-head">{t('title')}</h2>
      <div className="grid-3">
        <div className="feat-card glass-dim">
          <div className="feat-icon">📅</div>
          <h4>{t('feat1Title')}</h4>
          <p>{t('feat1Desc')}</p>
          <span className="feat-arrow">→</span>
        </div>
        <div className="feat-card glass-dim">
          <div className="feat-icon">🔮</div>
          <h4>{t('feat2Title')}</h4>
          <p>{t('feat2Desc')}</p>
          <span className="feat-arrow">→</span>
        </div>
        <div className="feat-card glass-dim">
          <div className="feat-icon">🩺</div>
          <h4>{t('feat3Title')}</h4>
          <p>{t('feat3Desc')}</p>
          <span className="feat-arrow">→</span>
        </div>
      </div>
    </>
  );
}
