'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { useAuth } from '@clerk/nextjs'
import toast from 'react-hot-toast'

export default function OnboardingModal({ onComplete, onSkip }) {
  const { userId } = useAuth()
  const t = useTranslations('onboarding')
  const [lastPeriodDate, setLastPeriodDate] = useState('')
  const [cycleLength, setCycleLength] = useState(28)
  const [periodLength, setPeriodLength] = useState(5)
  const [step, setStep] = useState(1)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState(null)

  const handleSubmit = async () => {
    if (!lastPeriodDate) return
    setSaving(true)
    setSaveError(null)

    try {
      if (!userId) {
        setSaveError('No session found - user not logged in')
        setSaving(false)
        return
      }

      const startDate = new Date(lastPeriodDate)
      const endDate = new Date(startDate)
      endDate.setDate(endDate.getDate() + periodLength - 1)

      // MUST be YYYY-MM-DD
      const periodStart = startDate.toISOString().split('T')[0]
      const periodEnd = endDate.toISOString().split('T')[0]

      const { data, error } = await supabase
        .from('cycles')
        .insert([{
          user_id: userId,
          start_date: periodStart,
          end_date: periodEnd,
          cycle_length: cycleLength,
          created_at: new Date().toISOString()
        }])
        .select()

      if (error) {
        const errMsg = error?.message || error?.details || error?.hint || JSON.stringify(error) || 'Unknown error'
        console.error('Insert error details:', {
          message: error?.message,
          details: error?.details, 
          hint: error?.hint,
          code: error?.code,
          full: error
        })
        setSaveError(errMsg)
        setSaving(false)
        return
      }
      localStorage.setItem('onboarding_complete', 'true')
      toast.success('✅ Cycle saved! Your calendar is now updated.')
      setSaving(false)
      onComplete()
    } catch (err) {
      console.error('Onboarding error:', err)
      setSaveError(err.message || 'An unexpected error occurred.')
      setSaving(false)
    }
  }

  const handleSkip = () => {
    localStorage.setItem('onboarding_complete', 'skipped')
    onSkip()
  }

  // Today's date as max for input
  const today = new Date().toISOString().split('T')[0]

  return (
    <div className="onboard-overlay" role="dialog" aria-modal="true">
      <div className="onboard-card">
        {/* Decorative top */}
        <div className="onboard-header-art">
          <span className="onboard-emoji">🌸</span>
          <div className="onboard-rings">
            <div className="ring ring-1"></div>
            <div className="ring ring-2"></div>
            <div className="ring ring-3"></div>
          </div>
        </div>

        <h2 className="onboard-title">
          {t('welcome')}
        </h2>
        <p className="onboard-subtitle">
          {t('subtitle')}
        </p>

        {step === 1 && (
          <div className="onboard-form fadeSlideUp">
            <div className="onboard-field">
              <label htmlFor="last-period-date">
                {t('lastPeriod')}
              </label>
              <input
                id="last-period-date"
                type="date"
                value={lastPeriodDate}
                max={today}
                onChange={(e) => setLastPeriodDate(e.target.value)}
                className="onboard-input"
              />
            </div>

            <button
              className="onboard-next-btn"
              disabled={!lastPeriodDate}
              onClick={() => setStep(2)}
            >
              {t('continue')}
            </button>
          </div>
        )}

        {step === 2 && (
          <div className="onboard-form fadeSlideUp">
            <div className="onboard-field">
              <label htmlFor="cycle-length">
                {t('avgCycle')}
              </label>
              <div className="onboard-slider-row">
                <input
                  id="cycle-length"
                  type="range"
                  min="21"
                  max="40"
                  value={cycleLength}
                  onChange={(e) => setCycleLength(Number(e.target.value))}
                  className="onboard-slider"
                />
                <span className="onboard-slider-val">{cycleLength}</span>
              </div>
            </div>

            <div className="onboard-field">
              <label htmlFor="period-length">
                {t('periodLength')}
              </label>
              <div className="onboard-slider-row">
                <input
                  id="period-length"
                  type="range"
                  min="2"
                  max="9"
                  value={periodLength}
                  onChange={(e) => setPeriodLength(Number(e.target.value))}
                  className="onboard-slider"
                />
                <span className="onboard-slider-val">{periodLength}</span>
              </div>
            </div>

            <div className="onboard-btn-row">
              {saveError && (
                <div style={{ color: '#ff4d4f', fontSize: '0.85rem', marginBottom: '1rem', width: '100%', textAlign: 'center' }}>
                  Error: {saveError}
                </div>
              )}
              <button className="onboard-back-btn" onClick={() => setStep(1)}>
                ← {t('back')}
              </button>
              <button
                className="onboard-next-btn"
                onClick={handleSubmit}
                disabled={saving}
              >
                {saving
                  ? t('saving')
                  : t('start')}
              </button>
            </div>
          </div>
        )}

        {/* Skip link */}
        <button className="onboard-skip" onClick={handleSkip}>
          {t('skip')}
        </button>
      </div>
    </div>
  )
}
