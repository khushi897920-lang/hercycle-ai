'use client'

import React, { useState } from 'react'
import { X, ChevronLeft, ChevronRight, RotateCcw, AlertTriangle, Sparkles, Activity, Shield } from 'lucide-react'
import { useTranslations } from 'next-intl'
import useModalA11y from '@/lib/a11y/useModalA11y'

const QUESTIONS = [
  { id: 1, category: 'ovul', weight: 2 },
  { id: 2, category: 'andro', weight: 1 },
  { id: 3, category: 'andro', weight: 2 },
  { id: 4, category: 'andro', weight: 1 },
  { id: 5, category: 'ir', weight: 2 },
  { id: 6, category: 'ir', weight: 2 },
  { id: 7, category: 'ir', weight: 1 },
  { id: 8, category: 'ovul', weight: 2 },
  { id: 9, category: 'ir', weight: 3 }
]

export default function PcosSymptomProfileModal({ onClose }) {
  const t = useTranslations('PcosSymptomProfile')
  const [step, setStep] = useState(0) // 0 = disclaimer, 1..9 = questions, 10 = results
  const [answers, setAnswers] = useState({}) // { [id]: boolean }

  const { containerRef, backdropRef, onBackdropMouseDown, onBackdropClick } = useModalA11y({
    onClose,
  })

  const handleSelectAnswer = (val) => {
    const currentQuestion = QUESTIONS[step - 1]
    setAnswers(prev => ({
      ...prev,
      [currentQuestion.id]: val
    }))
  }

  const handleNext = () => {
    if (step < QUESTIONS.length) {
      setStep(prev => prev + 1)
    } else {
      setStep(10)
    }
  }

  const handleBack = () => {
    if (step > 0) {
      setStep(prev => prev - 1)
    }
  }

  const handleRetake = () => {
    setAnswers({})
    setStep(1)
  }

  // Scoring logic
  const calculateResult = () => {
    let irScore = 0
    let androScore = 0
    let ovulScore = 0
    let totalScore = 0

    QUESTIONS.forEach(q => {
      const isYes = answers[q.id] === true
      if (isYes) {
        totalScore += q.weight
        if (q.category === 'ir') irScore += q.weight
        if (q.category === 'andro') androScore += q.weight
        if (q.category === 'ovul') ovulScore += q.weight
      }
    })

    const overallLikelihood = Math.round((totalScore / 16) * 100)

    let profileKey = 'low'
    let confidence = 90

    if (totalScore > 3) {
      const irNorm = irScore / 8
      const androNorm = androScore / 4
      const ovulNorm = ovulScore / 4

      if (irNorm >= 0.5 && androNorm >= 0.5) {
        profileKey = 'mixed'
        confidence = Math.round(75 + (totalScore / 16) * 15)
      } else if (irNorm >= 0.5 && irNorm >= androNorm && irNorm >= ovulNorm) {
        profileKey = 'ir'
        confidence = Math.round(70 + irNorm * 20)
      } else if (androNorm >= 0.5 && androNorm >= irNorm && androNorm >= ovulNorm) {
        profileKey = 'andro'
        confidence = Math.round(70 + androNorm * 20)
      } else if (ovulNorm >= 0.5 && ovulNorm >= irNorm && ovulNorm >= androNorm) {
        profileKey = 'ovul'
        confidence = Math.round(70 + ovulNorm * 20)
      } else {
        profileKey = 'mixed'
        confidence = 75
      }
    } else {
      confidence = 95 - (totalScore * 5)
    }

    return {
      overallLikelihood,
      profileKey,
      confidence
    }
  }

  const result = step === 10 ? calculateResult() : null
  const currentQuestion = step >= 1 && step <= 9 ? QUESTIONS[step - 1] : null
  const progressPercent = step >= 1 && step <= 9 ? (step / QUESTIONS.length) * 100 : 0
  const isAnswered = currentQuestion ? answers[currentQuestion.id] !== undefined : false

  // The visible heading changes with the step, so the accessible name follows
  // whichever one is currently rendered.
  const titleId = step === 0 ? 'pcos-profile-disclaimer-title'
    : step === 10 ? 'pcos-profile-results-title'
      : 'pcos-profile-question-title'

  return (
    <div
      ref={backdropRef}
      className="onboard-overlay"
      style={{ zIndex: 1000 }}
      onMouseDown={onBackdropMouseDown}
      onClick={onBackdropClick}
    >
      <div
        ref={containerRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        className="onboard-card relative px-6 md:px-8 py-10 max-w-lg w-full max-h-[90vh] flex flex-col focus:outline-none"
      >
        {/* Close Button */}
        <button
          type="button"
          onClick={onClose}
          data-modal-close=""
          className="absolute top-4 right-4 text-white/50 hover:text-white/80 transition-colors p-1.5 rounded-full hover:bg-white/5 bg-black/20 backdrop-blur-sm z-20"
          aria-label={t('close') || 'Close the PCOS symptom profile'}
        >
          <X className="w-5 h-5" aria-hidden="true" />
        </button>

        {/* STEP 0: Disclaimer */}
        <div className="overflow-y-auto overflow-x-hidden flex-1 pt-2">

          {step === 0 && (
            <div className="flex flex-col items-center text-center fadeSlideUp">
              <div className="w-12 h-12 rounded-full bg-amber-500/20 border border-amber-500/40 flex items-center justify-center mb-4">
                <AlertTriangle className="w-6 h-6 text-amber-300" />
              </div>
              <h2 id="pcos-profile-disclaimer-title" className="onboard-title text-2xl mb-4 font-bold text-white">{t('disclaimerTitle')}</h2>
              <p className="text-white/85 text-sm leading-relaxed mb-8">
                {t('disclaimerText')}
              </p>
              <button
                onClick={() => setStep(1)}
                className="w-full bg-gradient-to-r from-rose-500 to-pink-500 hover:from-rose-600 hover:to-pink-600 text-white font-semibold py-3.5 rounded-xl shadow-lg transition-all hover:shadow-[0_0_15px_rgba(232,82,126,0.5)]"
              >
                {t('startAssessment')}
              </button>
            </div>
          )}

          {/* STEPS 1-9: Questions */}
          {step >= 1 && step <= 9 && currentQuestion && (
            <div className="flex flex-col text-center fadeSlideUp">
              {/* Progress header */}
              <div className="flex justify-between items-center text-xs text-white/50 mb-2">
                <span>{t('progressTitle')}</span>
                <span>{t('questionOf', { current: step, total: QUESTIONS.length })}</span>
              </div>
              {/* Progress bar */}
              <div
              className="w-full h-1.5 bg-white/10 rounded-full overflow-hidden mb-8"
              role="progressbar"
              aria-valuemin={1}
              aria-valuemax={QUESTIONS.length}
              aria-valuenow={step}
              aria-valuetext={`${step} / ${QUESTIONS.length}`}
            >
                <div
                  className="h-full bg-gradient-to-r from-rose-500 to-pink-500 transition-all duration-300"
                  style={{ width: `${progressPercent}%` }}
                />
              </div>

              {/* Question Text */}
              <h3 id="pcos-profile-question-title" className="text-white font-bold text-lg md:text-xl leading-snug mb-8 min-h-[4rem] flex items-center justify-center">
                {t(`questions.q${currentQuestion.id}`)}
              </h3>

              {/* Yes/No Options */}
              <div className="flex gap-4 mb-10" role="group" aria-labelledby="pcos-profile-question-title">
                <button
                  onClick={() => handleSelectAnswer(true)}
                  className={`flex-1 py-4 rounded-2xl border text-sm font-semibold transition-all ${answers[currentQuestion.id] === true
                    ? 'bg-gradient-to-r from-rose-500 to-pink-500 text-white border-rose-400 shadow-lg ring-2 ring-rose-400/50'
                    : 'bg-white/5 hover:bg-white/10 border-white/10 text-white/80'
                    }`}
                >
                  {t('yes')}
                </button>
                <button
                  onClick={() => handleSelectAnswer(false)}
                  className={`flex-1 py-4 rounded-2xl border text-sm font-semibold transition-all ${answers[currentQuestion.id] === false
                    ? 'bg-gradient-to-r from-rose-500 to-pink-500 text-white border-rose-400 shadow-lg ring-2 ring-rose-400/50'
                    : 'bg-white/5 hover:bg-white/10 border-white/10 text-white/80'
                    }`}
                >
                  {t('no')}
                </button>
              </div>

              {/* Navigation buttons */}
              <div className="flex items-center gap-3">
                <button
                  onClick={handleBack}
                  className="flex items-center justify-center gap-1.5 px-4 py-3 rounded-xl border border-white/20 bg-white/5 hover:bg-white/10 text-white/70 text-sm font-medium transition-colors"
                >
                  <ChevronLeft className="w-4 h-4" />
                  {t('back')}
                </button>
                <button
                  onClick={handleNext}
                  disabled={!isAnswered}
                  className="flex-1 flex items-center justify-center gap-1.5 py-3 rounded-xl bg-gradient-to-r from-rose-500 to-pink-500 disabled:opacity-40 disabled:cursor-not-allowed hover:from-rose-600 hover:to-pink-600 text-white font-semibold text-sm transition-all"
                >
                  {step === QUESTIONS.length ? t('viewResults') : t('next')}
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}

          {/* STEP 10: Results */}
          {step === 10 && result && (
            <div className="flex flex-col items-center text-center fadeSlideUp">
              <div className="w-10 h-10 rounded-full bg-pink-500/20 flex items-center justify-center mb-3">
                <Sparkles className="w-5 h-5 text-pink-300 animate-pulse" />
              </div>
              <h2 id="pcos-profile-results-title" className="onboard-title text-2xl font-bold text-white mb-1">{t('resultsTitle')}</h2>
              <p className="text-white/60 text-xs tracking-wide uppercase mb-4">{t('symptomLikelihood')}</p>

              {/* Likelihood & Confidence Row */}
              <div className="flex flex-col sm:flex-row gap-6 items-center justify-center w-full my-4">
                <div className="relative w-28 h-28 flex items-center justify-center">
                  <svg className="w-full h-full transform -rotate-90">
                    <circle cx="56" cy="56" r="46" className="text-white/5" strokeWidth="6" stroke="currentColor" fill="transparent" />
                    <circle
                      cx="56" cy="56" r="46" strokeWidth="6"
                      strokeDasharray={289}
                      strokeDashoffset={289 - (289 * result.overallLikelihood) / 100}
                      strokeLinecap="round"
                      className="transition-all duration-1000 ease-out text-pink-500"
                      stroke="currentColor"
                      fill="transparent"
                    />
                  </svg>
                  <div className="absolute text-center flex flex-col">
                    <span className="text-2xl font-black text-white">{result.overallLikelihood}%</span>
                    <span className="text-[10px] text-white/50">{t('likelihood')}</span>
                  </div>
                </div>

                <div className="flex flex-col text-left space-y-1">
                  <span className="text-xs text-white/50">{t('confidenceTitle')}</span>
                  <span className="text-xl font-bold text-white flex items-center gap-1.5">
                    {result.confidence}% <Shield className="w-4 h-4 text-emerald-400" />
                  </span>
                  <span className="text-xs text-white/60 leading-relaxed max-w-[200px]">
                    {t('confidenceExplanation')}
                  </span>
                </div>
              </div>

              {/* Pattern Card */}
              <div className="bg-white/5 border border-white/10 rounded-2xl p-5 my-4 w-full text-left space-y-3">
                <div>
                  <span className="text-[10px] uppercase tracking-wider text-pink-400 font-semibold">{t('matchingProfile')}</span>
                  <h3 className="text-lg font-bold text-white mt-0.5">
                    {t(`profiles.${result.profileKey}.name`)}
                  </h3>
                </div>
                <p className="text-white/80 text-xs leading-relaxed border-t border-white/5 pt-3">
                  {t(`profiles.${result.profileKey}.explanation`)}
                </p>
              </div>

              {/* Suggested Next Steps */}
              <div className="w-full text-left bg-purple-950/20 border border-purple-500/20 rounded-2xl p-5 mb-5 space-y-3">
                <h4 className="text-sm font-bold text-white flex items-center gap-1.5">
                  <Activity className="w-4 h-4 text-pink-400" />
                  {t('nextStepsTitle')}
                </h4>
                <ul className="text-xs text-white/70 space-y-2 list-none pl-1">
                  {['step1', 'step2', 'step3'].map((stepKey, idx) => (
                    <li key={stepKey} className="flex items-start gap-2">
                      <span className="text-pink-400 font-bold select-none">{idx + 1}.</span>
                      <span>{t(`profiles.${result.profileKey}.${stepKey}`)}</span>
                    </li>
                  ))}
                </ul>
              </div>

              {/* Educational disclaimer */}
              <p className="text-[11px] text-white/40 leading-relaxed mb-6 max-w-sm">
                {t('educationalDisclaimer')}
              </p>

              {/* Retake & Close options */}
              <div className="flex gap-3 w-full shrink-0">
                <button
                  onClick={handleRetake}
                  className="flex-1 flex items-center justify-center gap-1.5 py-3 rounded-xl border border-pink-400/30 hover:bg-white/5 text-pink-300 text-sm font-semibold transition-colors"
                >
                  <RotateCcw className="w-4 h-4" />
                  {t('retakeAssessment')}
                </button>
                <button
                  onClick={onClose}
                  className="flex-1 py-3 rounded-xl bg-gradient-to-r from-rose-500 to-pink-500 hover:from-rose-600 hover:to-pink-600 text-white font-semibold text-sm transition-all"
                >
                  {t('close')}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
