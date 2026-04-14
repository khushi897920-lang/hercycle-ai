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
  return (
    <>
      {/* Symptoms Panel */}
      <div className="panel glass-dim">
        <h4>Symptoms</h4>
        <div className="symp-grid">
          {['Cramps', 'Headache', 'Bloating', 'Fatigue', 'Acne', 'Nausea'].map(symptom => (
            <div
              key={symptom}
              className={`symp-chip ${selectedSymptoms.includes(symptom) ? 'active' : ''}`}
              onClick={() => toggleSymptom(symptom)}
            >
              {symptom}
            </div>
          ))}
        </div>
      </div>

      {/* Mood & Flow Panel */}
      <div className="panel glass-dim">
        <h4>Mood</h4>
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

        <div className="flow-lbl">Flow Intensity</div>
        <div className="flow-row">
          {[
            { id: 'f1', label: 'Light' },
            { id: 'f2', label: 'Medium' },
            { id: 'f3', label: 'Heavy' },
            { id: 'f4', label: 'Very Heavy' }
          ].map(flow => (
            <div
              key={flow.id}
              className={`flow-dot ${flow.id} ${selectedFlow === flow.id ? 'active' : ''}`}
              onClick={() => setSelectedFlow(flow.id)}
              title={flow.label}
            ></div>
          ))}
        </div>

        <button className="save-btn" onClick={handleSaveLog}>Save Today's Log</button>
      </div>

      {/* Prediction Panel */}
      <div className="panel glass-dim">
        <h4>Next Cycle Prediction</h4>
        <div className="pred-content">
          <div className="pred-date">
            <label>Expected Start Date</label>
            <div className="date">
              {cycleData?.nextPeriodDate || 'Apr 27, 2026'}
            </div>
          </div>
          <p className="pred-info">
            Based on your 28-day average cycle. Ovulation window expected around Apr 13-15.
          </p>
          <div className="confidence">
            Prediction Confidence: {cycleData?.confidence || '92%'}
          </div>
        </div>
      </div>
    </>
  );
}
