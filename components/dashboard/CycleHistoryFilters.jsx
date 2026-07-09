import React from 'react';

export default function CycleHistoryFilters({ currentFilter, onFilterChange }) {
  const filters = ['All', 'Period', 'Ovulation'];

  return (
    <div style={{ display: 'flex', gap: '8px', marginBottom: '20px', flexWrap: 'wrap' }}>
      {filters.map(filter => {
        const active = currentFilter === filter;
        return (
          <button
            key={filter}
            type="button"
            className={`symp-chip ${active ? 'active' : ''}`}
            onClick={() => onFilterChange(filter)}
            style={{ padding: '6px 16px', fontSize: '0.9rem' }}
          >
            {filter}
          </button>
        );
      })}
    </div>
  );
}
