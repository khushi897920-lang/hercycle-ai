'use me'
'use client'

import React, { useState, useEffect, useCallback } from 'react'
import {
  Sliders,
  Play,
  Plus,
  Clock,
  Award,
  CheckCircle2,
  Calendar,
  Layers,
  Sparkles,
  RefreshCw,
  X,
  ChevronDown
} from 'lucide-react'

export default function HyperparameterSweeps() {
  const [sweeps, setSweeps] = useState([])
  const [trials, setTrials] = useState([])
  const [globalBest, setGlobalBest] = useState(null)
  const [loading, setLoading] = useState(true)
  const [runningSweepId, setRunningSweepId] = useState(null)
  const [showModal, setShowModal] = useState(false)
  const [notification, setNotification] = useState(null)

  // Form State
  const [formData, setFormData] = useState({
    name: '',
    modelId: 'pcod_risk_classifier',
    modelName: 'PCOD Risk Classifier',
    sweepType: 'grid',
    cronExpression: '0 0 * * *',
    maxTrials: 10,
    learningRates: [0.0001, 0.0005, 0.001],
    batchSizes: [32, 64],
    optimizers: ['Adam', 'AdamW'],
  })

  const fetchSweeps = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/dashboard/sweeps')
      const json = await res.json()
      if (json.success) {
        setSweeps(json.data.sweeps || [])
        setTrials(json.data.trials || [])
        setGlobalBest(json.data.globalBest || null)
      }
    } catch (err) {
      console.error('Error loading sweeps:', err)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchSweeps()
  }, [fetchSweeps])

  const handleTriggerRun = async (sweepId) => {
    setRunningSweepId(sweepId)
    try {
      const res = await fetch(`/api/dashboard/sweeps/${sweepId}/trigger`, { method: 'POST' })
      const json = await res.json()
      if (json.success) {
        setNotification({ type: 'success', text: `Sweep executed successfully! Evaluated new hyperparameter trials.` })
        await fetchSweeps()
      } else {
        setNotification({ type: 'error', text: json.error || 'Failed to run sweep' })
      }
    } catch (err) {
      setNotification({ type: 'error', text: 'Network error triggering sweep.' })
    } finally {
      setRunningSweepId(null)
      setTimeout(() => setNotification(null), 4000)
    }
  }

  const handleCreateSweep = async (e) => {
    e.preventDefault()
    try {
      const payload = {
        name: formData.name || `${formData.modelName} ${formData.sweepType.toUpperCase()} Sweep`,
        modelId: formData.modelId,
        modelName: formData.modelName,
        sweepType: formData.sweepType,
        cronExpression: formData.cronExpression,
        maxTrials: Number(formData.maxTrials),
        hyperparameterSpace: {
          learningRate: formData.learningRates,
          batchSize: formData.batchSizes,
          optimizer: formData.optimizers,
        },
      }

      const res = await fetch('/api/dashboard/sweeps', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const json = await res.json()
      if (json.success) {
        setNotification({ type: 'success', text: `Scheduled sweep created successfully!` })
        setShowModal(false)
        await fetchSweeps()
      } else {
        setNotification({ type: 'error', text: json.error || 'Failed to create sweep' })
      }
    } catch (err) {
      setNotification({ type: 'error', text: 'Error submitting new sweep.' })
    } finally {
      setTimeout(() => setNotification(null), 4000)
    }
  }

  const handleModelSelectChange = (e) => {
    const val = e.target.value
    const nameMap = {
      pcod_risk_classifier: 'PCOD Risk Classifier',
      cycle_length_regressor: 'Cycle Length Predictor',
      symptom_correlation_model: 'Symptom Correlation Model',
      mood_predictor: 'Mood Predictor',
    }
    setFormData((prev) => ({ ...prev, modelId: val, modelName: nameMap[val] || val }))
  }

  return (
    <div className="glass-card sweeps-container" style={{ marginTop: '2rem', padding: '1.75rem' }}>
      {/* Top Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.85rem', fontWeight: 600, color: '#f59e0b', background: 'rgba(245, 158, 11, 0.1)', padding: '0.25rem 0.75rem', borderRadius: '9999px', marginBottom: '0.5rem' }}>
            <Sliders size={14} />
            <span>Automated Hyperparameter Optimization</span>
          </div>
          <h2 style={{ fontSize: '1.25rem', fontWeight: 700, color: '#f8fafc', margin: 0 }}>
            Scheduled Hyper-Parameter Sweeps
          </h2>
          <p style={{ fontSize: '0.85rem', color: '#94a3b8', marginTop: '0.25rem' }}>
            Schedule grid and random parameter search runs to discover optimal learning rates, batch sizes, and architectures.
          </p>
        </div>

        <button
          onClick={() => setShowModal(true)}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.5rem',
            background: 'linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)',
            color: '#ffffff',
            border: 'none',
            padding: '0.65rem 1.25rem',
            borderRadius: '10px',
            fontWeight: 600,
            fontSize: '0.875rem',
            cursor: 'pointer',
            boxShadow: '0 4px 14px rgba(99, 102, 241, 0.35)',
            transition: 'all 0.2s ease'
          }}
        >
          <Plus size={16} /> Schedule New Sweep
        </button>
      </div>

      {notification && (
        <div
          style={{
            padding: '0.75rem 1rem',
            borderRadius: '8px',
            marginBottom: '1rem',
            fontSize: '0.85rem',
            fontWeight: 500,
            background: notification.type === 'error' ? 'rgba(239, 68, 68, 0.15)' : 'rgba(52, 211, 153, 0.15)',
            border: notification.type === 'error' ? '1px solid #ef4444' : '1px solid #34d399',
            color: notification.type === 'error' ? '#fca5a5' : '#6ee7b7'
          }}
        >
          {notification.text}
        </div>
      )}

      {/* Global Best Hyperparameter Card Banner */}
      {globalBest && (
        <div
          style={{
            padding: '1.25rem',
            borderRadius: '12px',
            background: 'linear-gradient(135deg, rgba(245, 158, 11, 0.15) 0%, rgba(99, 102, 241, 0.15) 100%)',
            border: '1px solid rgba(245, 158, 11, 0.3)',
            marginBottom: '1.75rem',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '1rem'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem' }}>
            <div style={{ width: 44, height: 44, borderRadius: '50%', background: 'rgba(245, 158, 11, 0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#f59e0b' }}>
              <Award size={24} />
            </div>
            <div>
              <div style={{ fontSize: '0.75rem', fontWeight: 700, letterSpacing: '0.05em', textTransform: 'uppercase', color: '#f59e0b' }}>
                Top-Performing Hyperparameter Config
              </div>
              <div style={{ fontSize: '1.1rem', fontWeight: 700, color: '#f8fafc' }}>
                {globalBest.modelName} — {(globalBest.accuracy * 100).toFixed(1)}% Accuracy
              </div>
              <div style={{ fontSize: '0.8rem', color: '#cbd5e1', marginTop: '0.2rem' }}>
                Discovered via <strong>{globalBest.sweepName}</strong> (Trial #{globalBest.trialIndex})
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
            <div style={{ background: 'rgba(15, 23, 42, 0.75)', padding: '0.5rem 0.85rem', borderRadius: '8px', border: '1px solid rgba(255, 255, 255, 0.1)', textAlign: 'center' }}>
              <div style={{ fontSize: '0.7rem', color: '#94a3b8' }}>Learning Rate</div>
              <div style={{ fontSize: '0.9rem', fontWeight: 700, color: '#38bdf8', fontFamily: 'monospace' }}>
                {globalBest.hyperparameters.learningRate}
              </div>
            </div>
            <div style={{ background: 'rgba(15, 23, 42, 0.75)', padding: '0.5rem 0.85rem', borderRadius: '8px', border: '1px solid rgba(255, 255, 255, 0.1)', textAlign: 'center' }}>
              <div style={{ fontSize: '0.7rem', color: '#94a3b8' }}>Batch Size</div>
              <div style={{ fontSize: '0.9rem', fontWeight: 700, color: '#a855f7', fontFamily: 'monospace' }}>
                {globalBest.hyperparameters.batchSize}
              </div>
            </div>
            <div style={{ background: 'rgba(15, 23, 42, 0.75)', padding: '0.5rem 0.85rem', borderRadius: '8px', border: '1px solid rgba(255, 255, 255, 0.1)', textAlign: 'center' }}>
              <div style={{ fontSize: '0.7rem', color: '#94a3b8' }}>Optimizer</div>
              <div style={{ fontSize: '0.9rem', fontWeight: 700, color: '#34d399', fontFamily: 'monospace' }}>
                {globalBest.hyperparameters.optimizer || 'Adam'}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Active Scheduled Sweeps Table */}
      <div style={{ marginBottom: '2rem' }}>
        <h3 style={{ fontSize: '1rem', fontWeight: 700, color: '#f8fafc', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <Calendar size={18} color="#38bdf8" /> Active Scheduled Sweeps ({sweeps.length})
        </h3>

        {sweeps.length === 0 ? (
          <div style={{ padding: '1.5rem', textAlign: 'center', color: '#94a3b8', background: 'rgba(15, 23, 42, 0.5)', borderRadius: '8px' }}>
            No scheduled sweeps active. Click "Schedule New Sweep" above to configure one.
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table className="cm-table" style={{ width: '100%' }}>
              <thead>
                <tr>
                  <th>Sweep Name</th>
                  <th>Target Model</th>
                  <th>Type</th>
                  <th>Schedule</th>
                  <th>Next Run</th>
                  <th>Best Accuracy</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {sweeps.map((sweep) => (
                  <tr key={sweep.id}>
                    <td>
                      <strong>{sweep.name}</strong>
                    </td>
                    <td>{sweep.modelName}</td>
                    <td>
                      <span style={{ fontSize: '0.75rem', padding: '0.2rem 0.5rem', borderRadius: '4px', background: sweep.sweepType === 'grid' ? 'rgba(99, 102, 241, 0.2)' : 'rgba(245, 158, 11, 0.2)', color: sweep.sweepType === 'grid' ? '#a5b4fc' : '#fcd34d', fontWeight: 600 }}>
                        {sweep.sweepType.toUpperCase()}
                      </span>
                    </td>
                    <td style={{ fontFamily: 'monospace', fontSize: '0.8rem', color: '#cbd5e1' }}>
                      {sweep.cronExpression}
                    </td>
                    <td style={{ fontSize: '0.8rem', color: '#94a3b8' }}>
                      {new Date(sweep.nextRunAt).toLocaleString()}
                    </td>
                    <td>
                      {sweep.bestTrial ? (
                        <span style={{ color: '#34d399', fontWeight: 700 }}>
                          {(sweep.bestTrial.accuracy * 100).toFixed(1)}%
                        </span>
                      ) : (
                        <span style={{ color: '#94a3b8' }}>Pending</span>
                      )}
                    </td>
                    <td>
                      <button
                        onClick={() => handleTriggerRun(sweep.id)}
                        disabled={runningSweepId === sweep.id}
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '0.35rem',
                          background: 'rgba(52, 211, 153, 0.15)',
                          color: '#34d399',
                          border: '1px solid rgba(52, 211, 153, 0.3)',
                          padding: '0.35rem 0.75rem',
                          borderRadius: '6px',
                          fontSize: '0.75rem',
                          fontWeight: 600,
                          cursor: 'pointer'
                        }}
                      >
                        {runningSweepId === sweep.id ? <RefreshCw size={12} className="spin" /> : <Play size={12} />}
                        {runningSweepId === sweep.id ? 'Running...' : 'Run Now'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Evaluated Trial History Table */}
      <div>
        <h3 style={{ fontSize: '1rem', fontWeight: 700, color: '#f8fafc', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <Layers size={18} color="#a855f7" /> Evaluated Sweep Trials ({trials.length})
        </h3>

        <div style={{ overflowX: 'auto' }}>
          <table className="cm-table" style={{ width: '100%' }}>
            <thead>
              <tr>
                <th>Trial ID</th>
                <th>Learning Rate</th>
                <th>Batch Size</th>
                <th>Optimizer</th>
                <th>Accuracy</th>
                <th>Loss</th>
                <th>Timestamp</th>
              </tr>
            </thead>
            <tbody>
              {trials.map((t) => (
                <tr key={t.id}>
                  <td style={{ fontFamily: 'monospace', fontSize: '0.8rem', color: '#cbd5e1' }}>#{t.id}</td>
                  <td style={{ fontFamily: 'monospace', color: '#38bdf8' }}>{t.hyperparameters.learningRate}</td>
                  <td style={{ fontFamily: 'monospace', color: '#a855f7' }}>{t.hyperparameters.batchSize}</td>
                  <td style={{ color: '#e2e8f0' }}>{t.hyperparameters.optimizer || 'Adam'}</td>
                  <td style={{ fontWeight: 700, color: t.accuracy >= 0.9 ? '#34d399' : '#f8fafc' }}>
                    {(t.accuracy * 100).toFixed(1)}%
                  </td>
                  <td style={{ color: '#fca5a5' }}>{t.loss}</td>
                  <td style={{ fontSize: '0.75rem', color: '#94a3b8' }}>
                    {new Date(t.createdAt).toLocaleString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Create Sweep Modal */}
      {showModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.75)', zIndex: 99, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}>
          <div style={{ background: '#0f172a', border: '1px solid rgba(255,255,255,0.15)', borderRadius: '16px', padding: '1.75rem', width: '100%', maxWidth: '540px', color: '#f8fafc', boxShadow: '0 20px 40px rgba(0,0,0,0.5)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
              <h3 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 700 }}>Schedule Hyperparameter Sweep</h3>
              <button onClick={() => setShowModal(false)} style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer' }}>
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleCreateSweep}>
              <div style={{ marginBottom: '1rem' }}>
                <label style={{ display: 'block', fontSize: '0.8rem', color: '#cbd5e1', marginBottom: '0.35rem' }}>Sweep Label</label>
                <input
                  type="text"
                  placeholder="e.g., Nightly PCOD Model Grid Sweep"
                  className="filter-input"
                  style={{ width: '100%' }}
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', color: '#cbd5e1', marginBottom: '0.35rem' }}>Target Model</label>
                  <select className="filter-select" style={{ width: '100%' }} value={formData.modelId} onChange={handleModelSelectChange}>
                    <option value="pcod_risk_classifier">PCOD Risk Classifier</option>
                    <option value="cycle_length_regressor">Cycle Length Predictor</option>
                    <option value="symptom_correlation_model">Symptom Correlation</option>
                    <option value="mood_predictor">Mood Predictor</option>
                  </select>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', color: '#cbd5e1', marginBottom: '0.35rem' }}>Strategy</label>
                  <select className="filter-select" style={{ width: '100%' }} value={formData.sweepType} onChange={(e) => setFormData({ ...formData, sweepType: e.target.value })}>
                    <option value="grid">Grid Search (Cartesian)</option>
                    <option value="random">Random Search (Sampled)</option>
                  </select>
                </div>
              </div>

              <div style={{ marginBottom: '1rem' }}>
                <label style={{ display: 'block', fontSize: '0.8rem', color: '#cbd5e1', marginBottom: '0.35rem' }}>Schedule Preset / Cron</label>
                <select className="filter-select" style={{ width: '100%' }} value={formData.cronExpression} onChange={(e) => setFormData({ ...formData, cronExpression: e.target.value })}>
                  <option value="0 0 * * *">Nightly at Midnight (0 0 * * *)</option>
                  <option value="0 */6 * * *">Every 6 Hours (0 */6 * * *)</option>
                  <option value="0 */12 * * *">Every 12 Hours (0 */12 * * *)</option>
                  <option value="0 * * * *">Every Hour (0 * * * *)</option>
                </select>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1.25rem' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', color: '#cbd5e1', marginBottom: '0.35rem' }}>Max Trials</label>
                  <input
                    type="number"
                    min="1"
                    max="50"
                    className="filter-input"
                    style={{ width: '100%' }}
                    value={formData.maxTrials}
                    onChange={(e) => setFormData({ ...formData, maxTrials: e.target.value })}
                  />
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '1.5rem' }}>
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  style={{ background: 'rgba(255,255,255,0.1)', color: '#cbd5e1', border: 'none', padding: '0.6rem 1.2rem', borderRadius: '8px', fontWeight: 600, cursor: 'pointer' }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  style={{ background: 'linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)', color: '#ffffff', border: 'none', padding: '0.6rem 1.25rem', borderRadius: '8px', fontWeight: 600, cursor: 'pointer' }}
                >
                  Create & Schedule Sweep
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
