import { t } from '@/lib/i18n'

export default function FeaturesSection({ activeLang }) {
  return (
    <>
      <h2 className="sec-head">{t(activeLang, 'features', 'title')}</h2>
      <div className="grid-3">
        <div className="feat-card glass-dim">
          <div className="feat-icon">📅</div>
          <h4>{t(activeLang, 'features', 'feat1Title')}</h4>
          <p>{t(activeLang, 'features', 'feat1Desc')}</p>
          <span className="feat-arrow">→</span>
        </div>
        <div className="feat-card glass-dim">
          <div className="feat-icon">🔮</div>
          <h4>{t(activeLang, 'features', 'feat2Title')}</h4>
          <p>{t(activeLang, 'features', 'feat2Desc')}</p>
          <span className="feat-arrow">→</span>
        </div>
        <div className="feat-card glass-dim">
          <div className="feat-icon">🩺</div>
          <h4>{t(activeLang, 'features', 'feat3Title')}</h4>
          <p>{t(activeLang, 'features', 'feat3Desc')}</p>
          <span className="feat-arrow">→</span>
        </div>
      </div>
    </>
  );
}
