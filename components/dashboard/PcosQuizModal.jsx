'use client'

import React, { useState } from 'react'
import { X, ChevronLeft, ChevronRight, RotateCcw, AlertTriangle, Sparkles } from 'lucide-react'
import useModalA11y from '@/lib/a11y/useModalA11y'

const QUESTIONS = [
  {
    id: 1,
    text: "Have you been diagnosed with PCOS by a healthcare professional?",
    weight: 30
  },
  {
    id: 2,
    text: "Are your menstrual cycles usually irregular?",
    weight: 20
  },
  {
    id: 3,
    text: "Do you frequently experience persistent acne?",
    weight: 10
  },
  {
    id: 4,
    text: "Do you have excessive facial or body hair growth?",
    weight: 15
  },
  {
    id: 5,
    text: "Have you experienced unexplained weight gain or difficulty losing weight?",
    weight: 5
  },
  {
    id: 6,
    text: "Have you ever been told you have ovarian cysts?",
    weight: 15
  },
  {
    id: 7,
    text: "Do you often experience scalp hair thinning?",
    weight: 5
  }
]

export default function PcosQuizModal({ onClose }) {
  const [step, setStep] = useState(0) // 0 = disclaimer, 1..7 = questions, 8 = results
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
      setStep(8) // Go to results
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

  // Calculate score and interpretation
  const totalScore = QUESTIONS.reduce((sum, q) => {
    return sum + (answers[q.id] === true ? q.weight : 0)
  }, 0)

  let interpretationText = ""
  let circleColor = "#10b981" // Default green

  if (totalScore <= 24) {
    interpretationText = "Low likelihood based on the selected symptoms."
    circleColor = "#10b981" // Green
  } else if (totalScore <= 49) {
    interpretationText = "Some symptoms are present. Consider monitoring your menstrual health."
    circleColor = "#fbbf24" // Yellow
  } else if (totalScore <= 74) {
    interpretationText = "Several common PCOS symptoms are present. Consider consulting a healthcare professional."
    circleColor = "#f97316" // Orange
  } else {
    interpretationText = "Many common PCOS symptoms are present. It is recommended that you discuss these symptoms with a qualified healthcare professional."
    circleColor = "#f43f5e" // Rose
  }

  const currentQuestion = step >= 1 && step <= 7 ? QUESTIONS[step - 1] : null
  const progressPercent = step >= 1 && step <= 7 ? (step / (QUESTIONS.length + 1)) * 100 : step === 8 ? 100 : 0
  const isAnswered = currentQuestion ? answers[currentQuestion.id] !== undefined : false

  // The heading changes with the step, so the accessible name is taken from
  // whichever heading is currently rendered rather than from a fixed id.
  const titleId = step === 0 ? 'pcos-quiz-disclaimer-title'
    : step === 8 ? 'pcos-quiz-results-title'
      : 'pcos-quiz-question-title'

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
        className="onboard-card relative px-6 md:px-8 py-10 max-w-lg w-full focus:outline-none"
      >
        {/* Close Button */}
        <button
          type="button"
          onClick={onClose}
          data-modal-close=""
          className="absolute top-4 right-4 text-white/50 hover:text-white/80 transition-colors p-1.5 rounded-full hover:bg-white/5"
          aria-label="Close the PCOS screening quiz"
        >
          <X className="w-5 h-5" aria-hidden="true" />
        </button>

        {/* STEP 0: Disclaimer */}
        {step === 0 && (
          <div className="flex flex-col items-center text-center fadeSlideUp">
            <div className="w-12 h-12 rounded-full bg-amber-500/20 border border-amber-500/40 flex items-center justify-center mb-4">
              <AlertTriangle className="w-6 h-6 text-amber-300" />
            </div>
            <h2 id="pcos-quiz-disclaimer-title" className="onboard-title text-2xl mb-4 font-bold text-white">Disclaimer</h2>
            <p className="text-white/85 text-sm leading-relaxed mb-8">
              This screening quiz is for educational purposes only. It is <strong>NOT</strong> a medical diagnosis and should not replace professional medical advice.
            </p>
            <button
              onClick={() => setStep(1)}
              className="w-full bg-gradient-to-r from-rose-500 to-pink-500 hover:from-rose-600 hover:to-pink-600 text-white font-semibold py-3.5 rounded-xl shadow-lg transition-all hover:shadow-[0_0_15px_rgba(232,82,126,0.5)]"
            >
              Start Quiz
            </button>
          </div>
        )}

        {/* STEPS 1-7: Questions */}
        {step >= 1 && step <= 7 && currentQuestion && (
          <div className="flex flex-col text-center fadeSlideUp">
            {/* Progress header */}
            <div className="flex justify-between items-center text-xs text-white/50 mb-2">
              <span>PCOS Screening</span>
              <span>Question {step} of {QUESTIONS.length}</span>
            </div>
            {/* Progress bar */}
            <div
              className="w-full h-1.5 bg-white/10 rounded-full overflow-hidden mb-8"
              role="progressbar"
              aria-valuemin={1}
              aria-valuemax={QUESTIONS.length}
              aria-valuenow={step}
              aria-valuetext={`Question ${step} of ${QUESTIONS.length}`}
            >
              <div
                className="h-full bg-gradient-to-r from-rose-500 to-pink-500 transition-all duration-300"
                style={{ width: `${progressPercent}%` }}
              />
            </div>

            {/* Question Text */}
            <h3 id="pcos-quiz-question-title" className="text-white font-bold text-lg md:text-xl leading-snug mb-8 min-h-[4rem] flex items-center justify-center">
              {currentQuestion.text}
            </h3>

            {/* Yes/No Options */}
            <div className="flex gap-4 mb-10" role="group" aria-labelledby="pcos-quiz-question-title">
              <button
                type="button"
                aria-pressed={answers[currentQuestion.id] === true}
                onClick={() => handleSelectAnswer(true)}
                className={`flex-1 py-4 rounded-2xl border text-sm font-semibold transition-all ${
                  answers[currentQuestion.id] === true
                    ? 'bg-gradient-to-r from-rose-500 to-pink-500 text-white border-rose-400 shadow-lg ring-2 ring-rose-400/50'
                    : 'bg-white/5 hover:bg-white/10 border-white/10 text-white/80'
                }`}
              >
                Yes
              </button>
              <button
                type="button"
                aria-pressed={answers[currentQuestion.id] === false}
                onClick={() => handleSelectAnswer(false)}
                className={`flex-1 py-4 rounded-2xl border text-sm font-semibold transition-all ${
                  answers[currentQuestion.id] === false
                    ? 'bg-gradient-to-r from-rose-500 to-pink-500 text-white border-rose-400 shadow-lg ring-2 ring-rose-400/50'
                    : 'bg-white/5 hover:bg-white/10 border-white/10 text-white/80'
                }`}
              >
                No
              </button>
            </div>

            {/* Navigation buttons */}
            <div className="flex items-center gap-3">
              <button
                onClick={handleBack}
                className="flex items-center justify-center gap-1.5 px-4 py-3 rounded-xl border border-white/20 bg-white/5 hover:bg-white/10 text-white/70 text-sm font-medium transition-colors"
              >
                <ChevronLeft className="w-4 h-4" />
                Back
              </button>
              <button
                onClick={handleNext}
                disabled={!isAnswered}
                className="flex-1 flex items-center justify-center gap-1.5 py-3 rounded-xl bg-gradient-to-r from-rose-500 to-pink-500 disabled:opacity-40 disabled:cursor-not-allowed hover:from-rose-600 hover:to-pink-600 text-white font-semibold text-sm transition-all"
              >
                {step === QUESTIONS.length ? 'View Results' : 'Next'}
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* STEP 8: Results */}
        {step === 8 && (
          <div className="flex flex-col items-center text-center fadeSlideUp">
            <div className="w-10 h-10 rounded-full bg-pink-500/20 flex items-center justify-center mb-3">
              <Sparkles className="w-5 h-5 text-pink-300" />
            </div>
            <h2 id="pcos-quiz-results-title" className="onboard-title text-2xl font-bold text-white mb-1">Quiz Results</h2>
            <p className="text-white/60 text-xs tracking-wide uppercase mb-4">Estimated PCOS Symptom Likelihood</p>

            {/* Circular Gauge */}
            <div className="relative w-32 h-32 mx-auto my-4 flex items-center justify-center">
              <svg className="w-full h-full transform -rotate-90" aria-hidden="true" focusable="false">
                <circle
                  cx="64"
                  cy="64"
                  r="54"
                  className="text-white/5"
                  strokeWidth="8"
                  stroke="currentColor"
                  fill="transparent"
                />
                <circle
                  cx="64"
                  cy="64"
                  r="54"
                  strokeWidth="8"
                  strokeDasharray={339.3}
                  strokeDashoffset={339.3 - (339.3 * totalScore) / 100}
                  strokeLinecap="round"
                  className="transition-all duration-1000 ease-out"
                  stroke={circleColor}
                  fill="transparent"
                />
              </svg>
              <div className="absolute text-center flex flex-col">
                <span className="text-3xl font-black text-white">{totalScore}%</span>
              </div>
            </div>

            {/* Interpretation */}
            <div className="bg-white/5 border border-white/10 rounded-2xl p-4 my-4 max-w-sm w-full" role="status">
              <p className="text-white text-sm font-medium leading-relaxed">
                Estimated likelihood {totalScore} percent. {interpretationText}
              </p>
            </div>

            {/* Educational disclaimer */}
            <p className="text-[11px] text-white/40 leading-relaxed mb-6 max-w-xs">
              This score is an educational estimate based on your answers. It is <strong>NOT</strong> a medical diagnosis.
            </p>

            {/* Retake & Close options */}
            <div className="flex gap-3 w-full">
              <button
                onClick={handleRetake}
                className="flex-1 flex items-center justify-center gap-1.5 py-3 rounded-xl border border-pink-400/30 hover:bg-white/5 text-pink-300 text-sm font-semibold transition-colors"
              >
                <RotateCcw className="w-4 h-4" />
                Retake Quiz
              </button>
              <button
                onClick={onClose}
                className="flex-1 py-3 rounded-xl bg-gradient-to-r from-rose-500 to-pink-500 hover:from-rose-600 hover:to-pink-600 text-white font-semibold text-sm transition-all"
              >
                Close
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
