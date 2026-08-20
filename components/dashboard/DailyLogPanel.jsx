'use client'

import { useTranslations } from 'next-intl'
import { useState } from 'react'
const moods = [
  { emoji: '😊', label: 'Happy' },
  { emoji: '😐', label: 'Okay' },
  { emoji: '😢', label: 'Sad' },
  { emoji: '😡', label: 'Angry' }
]

const symptomIcons = {
  Cramps: "🔥",
  Headache: "🤕",
  Bloating: "🎈",
  Fatigue: "😴",
  Acne: "✨",
  Nausea: "🤢"
}

/**
 * @typedef {object} DailyLogPanelProps
 * @property {string[]} [selectedSymptoms] Array of selected symptom names
 * @property {(symptom: string) => void} [toggleSymptom] Callback to toggle a symptom selection
 * @property {string|null} [selectedMood] Currently selected mood emoji
 * @property {(mood: string|null) => void} [setSelectedMood] Callback to update selected mood
 * @property {string|null} [selectedFlow] Currently selected flow intensity
 * @property {(flow: string|null) => void} [setSelectedFlow] Callback to update selected flow
 * @property {() => void} [handleSaveLog] Callback to save the daily log
 * @property {object} [cycleData] User's current cycle information
 */

/**
 * DailyLogPanel renders interactive controls for tracking symptoms, mood, and flow.
 * @param {DailyLogPanelProps} props
 */
export default function DailyLogPanel({
  selectedSymptoms = [],
  toggleSymptom = () => {},
  selectedMood = null,
  setSelectedMood = () => {},
  selectedFlow = null,
  setSelectedFlow = () => {},
  handleSaveLog = () => {},
  cycleData = null
}) {
  const t = useTranslations('log')
  const tSymp = useTranslations('symptoms')
  const tFlow = useTranslations('flow')

  const [customInput, setCustomInput] = useState('')

  // Mirrors the server-side caps in lib/api-helpers.js (MAX_SYMPTOM_LENGTH /
  // MAX_CUSTOM_SYMPTOMS) — this is a UX nicety only, the backend is what
  // actually enforces it.
  const MAX_CUSTOM_SYMPTOM_LENGTH = 50
  const MAX_CUSTOM_SYMPTOMS = 20

  const baseSymptoms = ['Cramps', 'Headache', 'Bloating', 'Fatigue', 'Acne', 'Nausea']
  const customSymptoms = selectedSymptoms.filter(s => !baseSymptoms.includes(s))
  const allDisplaySymptoms = [...baseSymptoms, ...customSymptoms]

  const handleAddCustom = (e) => {
    e.preventDefault()
    const trimmed = customInput.trim().slice(0, MAX_CUSTOM_SYMPTOM_LENGTH)
    if (!trimmed) return
    if (customSymptoms.length >= MAX_CUSTOM_SYMPTOMS) return
    if (!selectedSymptoms.includes(trimmed)) {
      toggleSymptom(trimmed)
    }
    setCustomInput('')
  }

  return (
    <>
      {/* Symptoms Panel */}
      <div className="panel glass-dim">
        <h4>{t('symptoms')}</h4>

        <div className="panel-subtitle">
          Common Symptoms
        </div>

        <div className="symp-grid symp-grid-scroll-wrapper" role="region" aria-label="Symptoms list">
          {allDisplaySymptoms.map(symptom => {
            const active = selectedSymptoms.includes(symptom)
            const isCustom = !baseSymptoms.includes(symptom)
            const icon = symptomIcons[symptom] || "📌"

            return (
              <button
                key={symptom}
                type="button"
                role="checkbox"
                aria-checked={active}
                className={`symp-chip ${active ? 'active' : ''}`}
                onClick={() => toggleSymptom(symptom)}
              >
                <span className="chip-icon" aria-hidden="true">
                  {icon}
                </span>

                <span>{isCustom ? symptom : tSymp(symptom)}</span>
              </button>
            )
          })}
        </div>

        <form onSubmit={handleAddCustom} style={{ display: 'flex', gap: '8px', marginTop: '12px', marginBottom: '8px' }}>
          <input
            type="text"
            placeholder="Add custom symptom..."
            value={customInput}
            onChange={(e) => setCustomInput(e.target.value)}
            maxLength={MAX_CUSTOM_SYMPTOM_LENGTH}
            style={{
              flex: 1,
              minWidth: 0,
              background: 'rgba(255, 255, 255, 0.08)',
              border: '1px solid rgba(255, 255, 255, 0.15)',
              borderRadius: '50px',
              padding: '8px 16px',
              color: '#fff',
              fontSize: '0.85rem',
              outline: 'none'
            }}
          />
          <button
            type="submit"
            style={{
              background: 'rgba(232, 82, 126, 0.25)',
              border: '1px solid rgba(232, 82, 126, 0.4)',
              borderRadius: '50px',
              padding: '8px 16px',
              color: '#fff',
              fontSize: '0.85rem',
              fontWeight: 600,
              cursor: 'pointer',
              transition: 'all 0.22s',
              flexShrink: 0
            }}
            onMouseOver={(e) => e.target.style.background = 'rgba(232, 82, 126, 0.4)'}
            onMouseOut={(e) => e.target.style.background = 'rgba(232, 82, 126, 0.25)'}
          >
            Add
          </button>
        </form>

        <div className="panel-divider" />

        <div className="selection-info">
          <span>Selected Today</span>

          <strong>
            {selectedSymptoms.length === 0
              ? 'None'
              : `${selectedSymptoms.length} Selected`}
          </strong>
        </div>
      </div>

      {/* Mood & Flow Panel */}
      <div className="panel glass-dim">
        <div className="panel-subtitle">
          Mood
        </div>

        <div className="mood-row" role="radiogroup" aria-label="Mood selection">
          {moods.map(mood => {
            const isSelected = selectedMood === mood.emoji;
            return (
              <button
                key={mood.emoji}
                type="button"
                role="radio"
                aria-checked={isSelected}
                aria-label={mood.label}
                className={`mood-btn ${isSelected ? 'active' : ''}`}
                onClick={() => setSelectedMood(mood.emoji)}
              >
                <span className="emoji" aria-hidden="true">
                  {mood.emoji}
                </span>

                <span className="mood-name">
                  {mood.label}
                </span>
              </button>
            );
          })}
        </div>

        <div className="flow-lbl flow-label">
          {t("flow")}
        </div>

        <div className="flow-scale">
          <span>{tFlow("Light")}</span>
          <span>{tFlow("Very Heavy")}</span>
        </div>

        <div className="flow-row" role="radiogroup" aria-label="Flow intensity selection">
          {[
            { id: "f1", label: "Light" },
            { id: "f2", label: "Medium" },
            { id: "f3", label: "Heavy" },
            { id: "f4", label: "Very Heavy" }
          ].map(flow => {
            const isSelected = selectedFlow === flow.id;
            return (
              <button
                key={flow.id}
                type="button"
                role="radio"
                aria-checked={isSelected}
                aria-label={tFlow(flow.label)}
                className={`flow-dot ${flow.id} ${isSelected ? "active" : ""}`}
                onClick={() => setSelectedFlow(flow.id)}
                title={tFlow(flow.label)}
              />
            );
          })}
        </div>

        <button className="save-btn" onClick={handleSaveLog}>
          {t('save')}
        </button>
      </div>
    </>
  );
}
