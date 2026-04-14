export default function FeaturesSection() {
  return (
    <>
      <h2 className="sec-head">Core Features</h2>
      <div className="grid-3">
        <div className="feat-card glass-dim">
          <div className="feat-icon">📅</div>
          <h4>Period Tracking</h4>
          <p>Log your cycle with symptoms, mood, and flow intensity for accurate predictions.</p>
          <span className="feat-arrow">→</span>
        </div>
        <div className="feat-card glass-dim">
          <div className="feat-icon">🔮</div>
          <h4>Smart Predictions</h4>
          <p>AI-powered cycle predictions that adapt to irregular patterns.</p>
          <span className="feat-arrow">→</span>
        </div>
        <div className="feat-card glass-dim">
          <div className="feat-icon">🩺</div>
          <h4>PCOD Risk Analysis</h4>
          <p>Machine learning model assesses your risk based on cycle data and symptoms.</p>
          <span className="feat-arrow">→</span>
        </div>
      </div>
    </>
  );
}
