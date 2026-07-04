import { t } from '@/lib/i18n'

export default function DailyLogPanel({
  selectedSymptoms,
  toggleSymptom,
  selectedMood,
  setSelectedMood,
  selectedFlow,
  setSelectedFlow,
  handleSaveLog,
  cycleData,
  activeLang
}) {
  return (
    <>
      {/* Symptoms Panel */}
      <div className="panel glass-dim">
        <h4>{t(activeLang, 'log', 'symptoms')}</h4>
        <div className="symp-grid">
          {['Cramps', 'Headache', 'Bloating', 'Fatigue', 'Acne', 'Nausea'].map(symptom => (
            <button
              type="button"
              key={symptom}
              className={`symp-chip ${selectedSymptoms.includes(symptom) ? 'active' : ''}`}
              onClick={() => toggleSymptom(symptom)}
              aria-pressed={selectedSymptoms.includes(symptom)}
            >
              {symptom}
            </button>
          ))}
        </div>
      </div>

      {/* Mood & Flow Panel */}
      <div className="panel glass-dim">
        <h4>{t(activeLang, 'log', 'mood')}</h4>
        <div className="mood-row">
          {['😊', '😐', '😢', '😡'].map((emoji, i) => (
            <button
              key={i}
              className={`mood-btn ${selectedMood === emoji ? 'active' : ''}`}
              onClick={() => setSelectedMood(emoji)}
            >
              {emoji}
            </button>
          ))}
        </div>

        <div className="flow-lbl">{t(activeLang, 'log', 'flow')}</div>
        <div className="flow-row">
          {[
            { id: 'f1', label: 'Light' },
            { id: 'f2', label: 'Medium' },
            { id: 'f3', label: 'Heavy' },
            { id: 'f4', label: 'Very Heavy' }
          ].map(flow => (
            <button
              type="button"
              key={flow.id}
              className={`flow-dot ${flow.id} ${selectedFlow === flow.id ? 'active' : ''}`}
              onClick={() => setSelectedFlow(flow.id)}
              title={flow.label}
              aria-label={`${flow.label} flow`}
              aria-pressed={selectedFlow === flow.id}
            ></button>
          ))}
        </div>

        <button className="save-btn" onClick={handleSaveLog}>
          {t(activeLang, 'btn', 'saveLog')}
        </button>
      </div>
    </>
  );
}
