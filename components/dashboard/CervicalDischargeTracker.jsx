import React, { useState, useEffect } from 'react';
import { useOffline } from '@/lib/OfflineContext';
import { useEncryption } from '@/lib/EncryptionContext';

const dischargeOptions = [
  { id: 'none', label: 'No Discharge', insight: 'No discharge is also a normal variation during some phases of the menstrual cycle.' },
  { id: 'sticky', label: 'Sticky', insight: 'Sticky discharge is commonly observed after menstruation.' },
  { id: 'creamy', label: 'Creamy', insight: 'Creamy discharge is often seen before ovulation.' },
  { id: 'watery', label: 'Watery', insight: 'Watery discharge commonly occurs around the fertile window.' },
  { id: 'egg-white', label: 'Egg-white', insight: 'Egg-white discharge is commonly associated with peak fertility.' }
];

export default function CervicalDischargeTracker({ selectedDischarge, setSelectedDischarge, saveTrigger }) {
  const { offlineClient } = useOffline();
  const { encryptionKey } = useEncryption();
  const [savedDischarge, setSavedDischarge] = useState(null);
  const [activeTab, setActiveTab] = useState("Today's Entry");
  const [recentEntries, setRecentEntries] = useState([]);

  useEffect(() => {
    const fetchLog = async () => {
      const today = new Date().toISOString().split('T')[0];
      const res = await offlineClient.fetchTodayLog(today, encryptionKey);
      if (res.success && res.data && res.data.cervical_discharge) {
        setSavedDischarge(res.data.cervical_discharge);
      }
    };

    const fetchRecentLogs = async () => {
      const res = await offlineClient.fetchAllLogs(encryptionKey);
      if (res.success && res.data) {
        // filter for logs with cervical_discharge
        const filtered = res.data.filter(log => log.cervical_discharge !== null && log.cervical_discharge !== undefined);
        // limit to latest 5
        setRecentEntries(filtered.slice(0, 5));
      }
    };

    if (offlineClient && encryptionKey) {
      fetchLog();
      fetchRecentLogs();
    }
  }, [offlineClient, saveTrigger, encryptionKey]);

  const activeOption = dischargeOptions.find(opt => opt.id === selectedDischarge);
  const savedOption = dischargeOptions.find(opt => opt.id === savedDischarge);

  const tabs = ["Today's Entry", "Recent Entries"];

  return (
    <div className="panel glass" style={{ display: 'flex', flexDirection: 'column', height: '420px', overflow: 'hidden' }}>
      <div style={{ marginBottom: '16px' }}>
        <h3 style={{ margin: '0 0 4px 0', fontSize: '1.2rem', color: '#fff', fontWeight: 600 }}>Cervical Discharge</h3>
        <div style={{ opacity: 0.7, fontSize: '0.9rem', color: '#fff' }}>Track today's cervical discharge</div>
      </div>

      {/* Tabs / Filters */}
      <div style={{ display: 'flex', gap: '8px', marginBottom: '16px', flexWrap: 'wrap' }}>
        {tabs.map(tab => (
          <button
            key={tab}
            type="button"
            className={`symp-chip ${activeTab === tab ? 'active' : ''}`}
            onClick={() => setActiveTab(tab)}
            style={{ padding: '6px 16px', fontSize: '0.9rem' }}
          >
            {tab}
          </button>
        ))}
      </div>

      <div
        style={{
          flex: 1,
          overflowY: 'auto',
          display: 'flex',
          flexDirection: 'column',
          gap: '12px',
          paddingRight: '8px',
          scrollbarWidth: 'thin',
          scrollbarColor: 'rgba(255,255,255,0.2) transparent'
        }}
        className="custom-scrollbar"
      >
        {activeTab === "Today's Entry" ? (
          <>
            {/* Saved Status */}
            <div style={{
              background: 'rgba(255, 255, 255, 0.05)',
              padding: '12px 16px',
              borderRadius: '12px',
              border: '1px solid rgba(255, 255, 255, 0.1)',
            }}>
              <p style={{ color: 'rgba(255,255,255,0.7)', fontSize: '0.85rem', margin: '0 0 4px 0' }}>Today's Entry</p>
              {savedOption ? (
                <p style={{ color: '#fff', fontSize: '1rem', margin: 0, fontWeight: 500 }}>
                  <span style={{ marginRight: '8px' }}>🟢</span>{savedOption.label}
                </p>
              ) : (
                <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: '0.9rem', margin: 0 }}>Not recorded yet.</p>
              )}
            </div>

            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '8px', marginTop: '4px' }}>
              {dischargeOptions.map(option => (
                <button
                  key={option.id}
                  onClick={() => setSelectedDischarge(option.id)}
                  style={{
                    background: selectedDischarge === option.id ? 'rgba(255, 255, 255, 0.2)' : 'rgba(255, 255, 255, 0.05)',
                    border: `1px solid ${selectedDischarge === option.id ? 'rgba(255, 255, 255, 0.5)' : 'rgba(255, 255, 255, 0.1)'}`,
                    color: '#fff',
                    padding: '8px 16px',
                    borderRadius: '20px',
                    fontSize: '0.9rem',
                    cursor: 'pointer',
                    transition: 'all 0.2s ease',
                    fontWeight: selectedDischarge === option.id ? '500' : '400',
                  }}
                >
                  {option.label}
                </button>
              ))}
            </div>

            {activeOption && (
              <div style={{
                background: 'rgba(255, 255, 255, 0.05)',
                padding: '16px',
                borderRadius: '12px',
                border: '1px solid rgba(255, 255, 255, 0.1)'
              }}>
                <p style={{ color: '#fff', fontSize: '0.95rem', margin: '0 0 12px 0', lineHeight: 1.5 }}>
                  {activeOption.insight}
                </p>
                <p style={{ color: 'rgba(255, 255, 255, 0.5)', fontSize: '0.8rem', margin: 0, fontStyle: 'italic' }}>
                  Educational information only. This is not medical advice.
                </p>
              </div>
            )}
          </>
        ) : (
          /* Recent Entries Status */
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {recentEntries.length > 0 ? (
              recentEntries.map((log) => {
                const opt = dischargeOptions.find(o => o.id === log.cervical_discharge);
                return (
                  <div key={log.id || log.date} style={{
                    background: 'rgba(255, 255, 255, 0.05)',
                    padding: '12px 16px',
                    borderRadius: '12px',
                    border: '1px solid rgba(255, 255, 255, 0.1)',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center'
                  }}>
                    <span style={{ color: 'rgba(255,255,255,0.7)', fontSize: '0.9rem' }}>
                      {new Date(log.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
                    </span>
                    <span style={{ color: '#fff', fontSize: '0.95rem', fontWeight: 500 }}>
                      {opt ? opt.label : log.cervical_discharge}
                    </span>
                  </div>
                );
              })
            ) : (
              <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: '0.9rem', margin: '16px 0', textAlign: 'center' }}>
                No recent entries found.
              </p>
            )}
          </div>
        )}
      </div>

      <div style={{ marginTop: '16px' }}>
        {activeTab === "Today's Entry" && (
          <p style={{
            color: 'rgba(255, 255, 255, 0.7)',
            fontSize: '0.85rem',
            margin: 0,
            display: 'flex',
            alignItems: 'center',
            gap: '6px'
          }}>
            <span>ℹ️</span> Your selection will be saved with today's Daily Log.
          </p>
        )}
      </div>
    </div>
  );
}
