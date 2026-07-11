import React from 'react';

export default function CycleHistoryItem({ cycle, filter }) {
  const start = new Date(cycle.start_date);
  const end = cycle.end_date ? new Date(cycle.end_date) : new Date(start.getTime() + 4 * 24 * 60 * 60 * 1000);
  
  // Calculate period length in days
  const periodLength = Math.max(1, Math.round((end - start) / (1000 * 60 * 60 * 24)) + 1);
  const cycleLength = cycle.cycle_length || 28;

  const startMonth = start.toLocaleString('default', { month: 'short' });
  const startDate = start.getDate();
  const endMonth = end.toLocaleString('default', { month: 'short' });
  const endDate = end.getDate();

  const dateRangeStr = `${startMonth} ${startDate} – ${endMonth} ${endDate}`;

  return (
    <div style={{ marginBottom: '16px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.9rem', color: '#fff', alignItems: 'center' }}>
        <span style={{ fontWeight: 500 }}>{dateRangeStr}</span>
        <span style={{ opacity: 0.7, fontSize: '0.85rem' }}>{periodLength} day period • {cycleLength} day cycle</span>
      </div>
      
      {/* Timeline Bar */}
      <div style={{ 
        position: 'relative', 
        width: '100%', 
        height: '10px', 
        background: 'rgba(255, 255, 255, 0.08)', 
        borderRadius: '5px', 
        overflow: 'hidden' 
      }}>
        {/* Period Segment */}
        {(filter === 'All' || filter === 'Period') && (
          <div 
            title="Period"
            style={{ 
              position: 'absolute', 
              left: 0, 
              top: 0, 
              bottom: 0, 
              width: `${Math.min(100, (periodLength / cycleLength) * 100)}%`, 
              background: '#ff4757',
              borderRadius: '5px',
              zIndex: 2
            }} 
          />
        )}

        {/* Ovulation Segment */}
        {(filter === 'All' || filter === 'Ovulation') && (
          <div 
            title="Ovulation Window"
            style={{ 
              position: 'absolute', 
              left: `${Math.min(100, (11 / cycleLength) * 100)}%`, 
              top: 0, 
              bottom: 0, 
              width: `${Math.min(100, (5 / cycleLength) * 100)}%`, 
              background: '#00b894', 
              borderRadius: '5px',
              zIndex: 1
            }} 
          />
        )}
      </div>
    </div>
  );
}
