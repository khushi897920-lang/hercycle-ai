export default function CycleCalendar({ calendarDays, currentMonth, setCurrentMonth }) {
  return (
    <div className="cycle-card glass">
      <div className="cycle-card-header">
        <h3>{currentMonth}</h3>
        <div className="month-nav">
          <button onClick={() => setCurrentMonth('December 2024')}>‹</button>
          <button onClick={() => setCurrentMonth('February 2025')}>›</button>
        </div>
      </div>

      <div className="mini-cal">
        {calendarDays.map((day, i) => (
          <div
            key={i}
            className={`cal-d ${day.type === 'header' ? 'header' : ''} 
              ${day.type === 'empty' ? 'empty' : ''}
              ${day.type === 'period' ? 'period' : ''}
              ${day.type === 'predicted' ? 'predicted' : ''}
              ${day.type === 'ovulation' ? 'ovulation' : ''}
              ${day.type === 'today' ? 'today' : ''}`}
          >
            {day.label}
          </div>
        ))}
      </div>

      <div className="cal-legend">
        <div className="legend-item">
          <div className="legend-dot" style={{ background: 'linear-gradient(135deg, rgba(232,82,126,0.35), rgba(157,63,122,0.30))' }}></div>
          <span>Period</span>
        </div>
        <div className="legend-item">
          <div className="legend-dot" style={{ background: 'rgba(232,82,126,0.15)', border: '1.5px dashed rgba(232,82,126,0.5)' }}></div>
          <span>Predicted</span>
        </div>
        <div className="legend-item">
          <div className="legend-dot" style={{ background: 'rgba(110,231,183,0.20)', border: '1px solid rgba(110,231,183,0.4)' }}></div>
          <span>Ovulation</span>
        </div>
      </div>

      <div className="stat-row">
        <div className="stat-tile">
          <label>Cycle Length</label>
          <div className="val">28<span>days</span></div>
        </div>
        <div className="stat-tile">
          <label>Next Period</label>
          <div className="val">17<span>days</span></div>
        </div>
      </div>
    </div>
  );
}
