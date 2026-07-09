import React, { useState } from 'react';
import CycleHistoryFilters from './CycleHistoryFilters';
import CycleHistoryItem from './CycleHistoryItem';

export default function CycleHistoryCard({ cycleData }) {
  const [filter, setFilter] = useState('All');
  
  const cycles = cycleData?.cycles || [];
  
  // Sort cycles by start_date descending
  const sortedCycles = [...cycles].sort((a, b) => new Date(b.start_date) - new Date(a.start_date));
  
  // Group by year
  const groupedCycles = sortedCycles.reduce((acc, cycle) => {
    const year = new Date(cycle.start_date).getFullYear();
    if (!acc[year]) acc[year] = [];
    acc[year].push(cycle);
    return acc;
  }, {});

  return (
    <div className="panel glass" style={{ display: 'flex', flexDirection: 'column', height: '420px', overflow: 'hidden' }}>
      <div style={{ marginBottom: '16px' }}>
        <h3 style={{ margin: '0 0 4px 0', fontSize: '1.2rem', color: '#fff', fontWeight: 600 }}>Cycle History</h3>
        <div style={{ opacity: 0.7, fontSize: '0.9rem', color: '#fff' }}>{cycles.length} recorded cycles</div>
      </div>
      
      <CycleHistoryFilters currentFilter={filter} onFilterChange={setFilter} />
      
      <div 
        style={{ 
          flex: 1, 
          overflowY: 'auto', 
          paddingRight: '8px',
          scrollbarWidth: 'thin',
          scrollbarColor: 'rgba(255,255,255,0.2) transparent'
        }}
        className="custom-scrollbar"
      >
        {Object.keys(groupedCycles).sort((a, b) => b - a).map(year => (
          <div key={year} style={{ marginBottom: '24px' }}>
            <h5 style={{ margin: '0 0 12px 0', fontSize: '1rem', opacity: 0.8, color: '#fff', fontWeight: 500 }}>{year}</h5>
            {groupedCycles[year].map(cycle => (
              <CycleHistoryItem key={cycle.id || cycle.start_date} cycle={cycle} filter={filter} />
            ))}
          </div>
        ))}
        {cycles.length === 0 && (
          <div style={{ opacity: 0.5, fontSize: '0.9rem', color: '#fff' }}>No cycle history available yet.</div>
        )}
      </div>
    </div>
  );
}
