'use client'

import { useState } from 'react'
import { t } from '@/lib/i18n'
import { createClient } from '@/lib/supabase-client'
import toast from 'react-hot-toast'

export default function OnboardingModal({ activeLang, onComplete, onSkip }) {
  const supabase = createClient()
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
      const { data: { session } } = await supabase.auth.getSession()
      const userId = session?.user?.id
      
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

      console.log('Inserting with userId:', userId, typeof userId)

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

      console.log('Supabase response:', data, error)

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

      console.log('Cycle saved successfully:', data)
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
          {activeLang === 'हि' ? 'आपका स्वागत है!' : 'Welcome to HerCycle'}
        </h2>
        <p className="onboard-subtitle">
          {activeLang === 'हि'
            ? 'हमें अपनी आखिरी माहवारी के बारे में बताएं ताकि हम आपके लिए सटीक पूर्वानुमान बना सकें।'
            : 'Tell us about your last period so we can generate accurate predictions for you.'}
        </p>

        {step === 1 && (
          <div className="onboard-form fadeSlideUp">
            <div className="onboard-field">
              <label htmlFor="last-period-date">
                {activeLang === 'हि' ? 'आखिरी माहवारी की तारीख' : 'Last period start date'}
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
              {activeLang === 'हि' ? 'आगे बढ़ें →' : 'Continue →'}
            </button>
          </div>
        )}

        {step === 2 && (
          <div className="onboard-form fadeSlideUp">
            <div className="onboard-field">
              <label htmlFor="cycle-length">
                {activeLang === 'हि' ? 'औसत चक्र अवधि (दिन)' : 'Average cycle length (days)'}
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
                {activeLang === 'हि' ? 'माहवारी की अवधि (दिन)' : 'Period length (days)'}
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
                ← {activeLang === 'हि' ? 'वापस' : 'Back'}
              </button>
              <button
                className="onboard-next-btn"
                onClick={handleSubmit}
                disabled={saving}
              >
                {saving
                  ? (activeLang === 'हि' ? 'सहेज रहे हैं…' : 'Saving…')
                  : (activeLang === 'हि' ? 'शुरू करें ✨' : 'Get Started ✨')}
              </button>
            </div>
          </div>
        )}

        {/* Skip link */}
        <button className="onboard-skip" onClick={handleSkip}>
          {activeLang === 'हि' ? 'बाद में करें' : 'Skip for now'}
        </button>
      </div>
    </div>
  )
}
