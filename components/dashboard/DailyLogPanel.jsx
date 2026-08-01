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

export default function DailyLogPanel({
  selectedSymptoms,
  toggleSymptom,
  selectedMood,
  setSelectedMood,
  selectedFlow,
  setSelectedFlow,
  handleSaveLog,
  cycleData
}) {
  const t = useTranslations('log')
  const tSymp = useTranslations('symptoms')
  const tFlow = useTranslations('flow')

  const [customInput, setCustomInput] = useState('')

  const handleAddCustom = (e) => {
    e.preventDefault()
    const trimmed = customInput.trim()
    if (!trimmed) return
    if (!selectedSymptoms.includes(trimmed)) {
      toggleSymptom(trimmed)
    }
    setCustomInput('')
  }

  const baseSymptoms = ['Cramps', 'Headache', 'Bloating', 'Fatigue', 'Acne', 'Nausea']
  const customSymptoms = selectedSymptoms.filter(s => !baseSymptoms.includes(s))
  const allDisplaySymptoms = [...baseSymptoms, ...customSymptoms]

  return (
    <>
      {/* Symptoms Panel */}
      <div className="panel glass-dim">
        <h4>{t('symptoms')}</h4>

        <div className="panel-subtitle">
          Common Symptoms
        </div>

        <div className="symp-grid">
          {allDisplaySymptoms.map(symptom => {
            const active = selectedSymptoms.includes(symptom)
            const isCustom = !baseSymptoms.includes(symptom)
            const icon = symptomIcons[symptom] || "📌"

            return (
              <button
                key={symptom}
                type="button"
                className={`symp-chip ${active ? 'active' : ''}`}
                onClick={() => toggleSymptom(symptom)}
              >
                <span className="chip-icon">
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
            style={{
              flex: 1,
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
              transition: 'all 0.2s'
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

        <div className="mood-row">
          {moods.map(mood => (
            <button
              key={mood.emoji}
              className={`mood-btn ${selectedMood === mood.emoji ? 'active' : ''
                }`}
              onClick={() => setSelectedMood(mood.emoji)}
            >
              <span className="emoji">
                {mood.emoji}
              </span>

              <span className="mood-name">
                {mood.label}
              </span>
            </button>
          ))}
        </div>

        <div className="flow-lbl">
          {t("flow")}
        </div>

        <div className="flow-scale">
          <span>{tFlow("Light")}</span>
          <span>{tFlow("Very Heavy")}</span>
        </div>

        <div className="flow-row">
          {[
            { id: "f1", label: "Light" },
            { id: "f2", label: "Medium" },
            { id: "f3", label: "Heavy" },
            { id: "f4", label: "Very Heavy" }
          ].map(flow => (
            <button
              key={flow.id}
              type="button"
              className={`flow-dot ${flow.id} ${selectedFlow === flow.id ? "active" : ""
                }`}
              onClick={() => setSelectedFlow(flow.id)}
              title={tFlow(flow.label)}
            />
          ))}
        </div>

        <button className="save-btn" onClick={handleSaveLog}>
          {t('save')}
        </button>
      </div>
    </>
  );
}
