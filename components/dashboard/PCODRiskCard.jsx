export default function PCODRiskCard({ pcodRisk }) {
  return (
    <div className="risk-card glass">
      <div className="risk-header">
        <div>
          <h3>PCOD Risk Assessment</h3>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-faint)', marginTop: '4px' }}>
            Based on your cycle history and symptoms
          </p>
        </div>
        <div className="risk-badge">
          {pcodRisk ? pcodRisk.label : 'LOW RISK'}
        </div>
      </div>

      <div className="gauge">
        <div className="gauge-fill" style={{ width: `${pcodRisk?.score || 25}%` }}></div>
      </div>

      <ul className="risk-factors">
        <li>Regular cycle length (28-day average)</li>
        <li>No significant hormonal symptoms reported</li>
        <li>Healthy BMI range maintained</li>
        <li>No irregular bleeding patterns</li>
      </ul>

      <button className="export-btn">📄 Export Doctor Report</button>
    </div>
  );
}
