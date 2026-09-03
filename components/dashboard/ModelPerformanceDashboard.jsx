'use me' // or 'use client'
'use client'

import React, { useState, useEffect, useCallback } from 'react'
import {
  Activity,
  BarChart2,
  Clock,
  Database,
  Filter,
  Layers,
  RefreshCw,
  Sliders,
  TrendingUp,
  Zap
} from 'lucide-react'
import '@/styles/dashboard.css'
import DatasetLineageGraph from '@/components/dashboard/DatasetLineageGraph'

export default function ModelPerformanceDashboard() {
  const [filters, setFilters] = useState({
    startDate: '',
    endDate: '',
    modelId: 'all',
    dataset: 'all',
    learningRate: 'all',
    batchSize: 'all'
  })

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [data, setData] = useState({
    filterOptions: {
      models: [],
      datasets: [],
      learningRates: [],
      batchSizes: []
    },
    metrics: {
      kpis: {
        latestAccuracy: 0,
        averageAccuracy: 0,
        averageLoss: 0,
        avgInferenceTimeMs: 0,
        totalRuns: 0
      },
      timeSeries: [],
      modelBenchmarks: [],
      hyperparameterHeatmap: [],
      confusionMatrix: null
    }
  })

  const fetchMetrics = useCallback(async () => {
    setLoading(true)
    setError(null)

    try {
      const params = new URLSearchParams()
      if (filters.startDate) params.set('startDate', filters.startDate)
      if (filters.endDate) params.set('endDate', filters.endDate)
      if (filters.modelId && filters.modelId !== 'all') params.set('modelId', filters.modelId)
      if (filters.dataset && filters.dataset !== 'all') params.set('dataset', filters.dataset)
      if (filters.learningRate && filters.learningRate !== 'all') params.set('learningRate', filters.learningRate)
      if (filters.batchSize && filters.batchSize !== 'all') params.set('batchSize', filters.batchSize)

      const response = await fetch(`/api/dashboard/metrics?${params.toString()}`)
      const json = await response.json()

      if (json.success) {
        setData(json.data)
      } else {
        setError(json.error || 'Failed to load model performance metrics')
      }
    } catch (err) {
      console.error('Error loading dashboard metrics:', err)
      setError('Network error: unable to load metrics.')
    } finally {
      setLoading(false)
    }
  }, [filters])

  useEffect(() => {
    fetchMetrics()
  }, [fetchMetrics])

  const handleFilterChange = (key, value) => {
    setFilters((prev) => ({ ...prev, [key]: value }))
  }

  const handleResetFilters = () => {
    setFilters({
      startDate: '',
      endDate: '',
      modelId: 'all',
      dataset: 'all',
      learningRate: 'all',
      batchSize: 'all'
    })
  }

  const { kpis, timeSeries, modelBenchmarks, hyperparameterHeatmap, confusionMatrix } = data.metrics
  const { models, datasets, learningRates, batchSizes } = data.filterOptions

  return (
    <div className="dashboard-container">
      {/* Header */}
      <header className="dashboard-header">
        <div className="dashboard-title-badge">
          <Activity size={16} />
          <span>HerCycle AI Model Telemetry</span>
        </div>
        <h1 className="dashboard-title">Interactive Model Performance Dashboard</h1>
        <p className="dashboard-subtitle">
          Real-time insights and benchmarks for accuracy, loss, inference latency, and hyper-parameter optimizations.
        </p>
      </header>

      {/* Filter Control Panel */}
      <section className="glass-card filters-panel" aria-label="Dashboard Filters">
        <div className="filter-group">
          <label htmlFor="filter-start-date" className="filter-label">
            Start Date
          </label>
          <input
            id="filter-start-date"
            type="date"
            className="filter-input"
            value={filters.startDate}
            onChange={(e) => handleFilterChange('startDate', e.target.value)}
          />
        </div>

        <div className="filter-group">
          <label htmlFor="filter-end-date" className="filter-label">
            End Date
          </label>
          <input
            id="filter-end-date"
            type="date"
            className="filter-input"
            value={filters.endDate}
            onChange={(e) => handleFilterChange('endDate', e.target.value)}
          />
        </div>

        <div className="filter-group">
          <label htmlFor="filter-model" className="filter-label">
            Model
          </label>
          <select
            id="filter-model"
            className="filter-select"
            value={filters.modelId}
            onChange={(e) => handleFilterChange('modelId', e.target.value)}
          >
            <option value="all">All Models</option>
            {models.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name}
              </option>
            ))}
          </select>
        </div>

        <div className="filter-group">
          <label htmlFor="filter-dataset" className="filter-label">
            Dataset
          </label>
          <select
            id="filter-dataset"
            className="filter-select"
            value={filters.dataset}
            onChange={(e) => handleFilterChange('dataset', e.target.value)}
          >
            <option value="all">All Datasets</option>
            {datasets.map((d) => (
              <option key={d} value={d}>
                {d}
              </option>
            ))}
          </select>
        </div>

        <div className="filter-group">
          <label htmlFor="filter-lr" className="filter-label">
            Learning Rate
          </label>
          <select
            id="filter-lr"
            className="filter-select"
            value={filters.learningRate}
            onChange={(e) => handleFilterChange('learningRate', e.target.value)}
          >
            <option value="all">All Learning Rates</option>
            {learningRates.map((lr) => (
              <option key={lr} value={lr}>
                {lr}
              </option>
            ))}
          </select>
        </div>

        <div className="filter-group">
          <label htmlFor="filter-batch" className="filter-label">
            Batch Size
          </label>
          <select
            id="filter-batch"
            className="filter-select"
            value={filters.batchSize}
            onChange={(e) => handleFilterChange('batchSize', e.target.value)}
          >
            <option value="all">All Batch Sizes</option>
            {batchSizes.map((bs) => (
              <option key={bs} value={bs}>
                {bs}
              </option>
            ))}
          </select>
        </div>

        <div className="filter-group">
          <button
            type="button"
            className="reset-button"
            onClick={handleResetFilters}
            title="Reset Filters"
          >
            Reset Filters
          </button>
        </div>
      </section>

      {/* KPI Summary Cards */}
      <section className="kpi-grid" aria-label="Key Performance Indicators">
        <div className="glass-card kpi-card">
          <div className="kpi-icon-container kpi-icon-indigo">
            <TrendingUp size={24} />
          </div>
          <div className="kpi-details">
            <span className="kpi-title">Top Accuracy</span>
            <span className="kpi-value">{kpis.latestAccuracy}%</span>
            <span className="kpi-subtext">Avg: {kpis.averageAccuracy}%</span>
          </div>
        </div>

        <div className="glass-card kpi-card">
          <div className="kpi-icon-container kpi-icon-amber">
            <Activity size={24} />
          </div>
          <div className="kpi-details">
            <span className="kpi-title">Average Loss</span>
            <span className="kpi-value">{kpis.averageLoss}</span>
            <span className="kpi-subtext">Training & Validation</span>
          </div>
        </div>

        <div className="glass-card kpi-card">
          <div className="kpi-icon-container kpi-icon-emerald">
            <Clock size={24} />
          </div>
          <div className="kpi-details">
            <span className="kpi-title">Avg Latency</span>
            <span className="kpi-value">{kpis.avgInferenceTimeMs}ms</span>
            <span className="kpi-subtext">Per inference call</span>
          </div>
        </div>

        <div className="glass-card kpi-card">
          <div className="kpi-icon-container kpi-icon-cyan">
            <Database size={24} />
          </div>
          <div className="kpi-details">
            <span className="kpi-title">Evaluation Runs</span>
            <span className="kpi-value">{kpis.totalRuns}</span>
            <span className="kpi-subtext">Filtered training logs</span>
          </div>
        </div>
      </section>

      {/* Loading / Error States */}
      {loading && (
        <div className="state-container">
          <div className="spinner"></div>
          <span>Loading performance metrics...</span>
        </div>
      )}

      {error && (
        <div className="state-container" style={{ color: '#f87171' }}>
          <span>{error}</span>
        </div>
      )}

      {!loading && !error && (
        <main className="dashboard-main-grid">
          {/* Line Chart Section: Accuracy & Loss Progress */}
          <section className="glass-card">
            <div className="chart-header">
              <h2 className="chart-title">
                <TrendingUp size={18} /> Accuracy & Loss Progress
              </h2>
              <span className="chart-badge">Chronological Timeline</span>
            </div>

            {timeSeries.length === 0 ? (
              <div className="state-container">No runs match selected filters.</div>
            ) : (
              <div className="time-series-list">
                {timeSeries.map((item) => (
                  <div key={item.id} className="time-series-item">
                    <span className="ts-date">{item.date}</span>
                    <div className="ts-bar-bg" title={`Accuracy: ${item.accuracy}%, Loss: ${item.loss}`}>
                      <div className="ts-bar-fill" style={{ width: `${item.accuracy}%` }} />
                    </div>
                    <span className="ts-acc">{item.accuracy}%</span>
                    <span className="ts-loss">L:{item.loss}</span>
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* Bar Graph Section: Model Benchmark Comparisons */}
          <section className="glass-card">
            <div className="chart-header">
              <h2 className="chart-title">
                <BarChart2 size={18} /> Model Benchmarks
              </h2>
              <span className="chart-badge">Accuracy & Latency</span>
            </div>

            {modelBenchmarks.length === 0 ? (
              <div className="state-container">No model benchmarks available.</div>
            ) : (
              <div className="benchmark-bars">
                {modelBenchmarks.map((bm) => (
                  <div key={bm.modelId} className="benchmark-item">
                    <div className="bm-header">
                      <span className="bm-name">{bm.modelName}</span>
                      <span className="bm-metrics">
                        {bm.avgAccuracy}% acc | {bm.avgInferenceTimeMs}ms latency
                      </span>
                    </div>
                    <div className="bm-bar-track">
                      <div className="bm-bar-fill-acc" style={{ width: `${bm.avgAccuracy}%` }} />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* Heatmap Section: 2D Hyperparameter Grid */}
          <section className="glass-card">
            <div className="chart-header">
              <h2 className="chart-title">
                <Sliders size={18} /> Hyperparameter Heatmap
              </h2>
              <span className="chart-badge">Learning Rate × Batch Size</span>
            </div>

            {hyperparameterHeatmap.length === 0 ? (
              <div className="state-container">No hyperparameter data.</div>
            ) : (
              <div className="heatmap-container">
                <div className="heatmap-grid">
                  {hyperparameterHeatmap.map((cell) => {
                    const isHigh = cell.avgAccuracy >= 90
                    const color = isHigh ? '#34d399' : cell.avgAccuracy >= 85 ? '#818cf8' : '#fbbf24'
                    return (
                      <div key={`${cell.learningRate}-${cell.batchSize}`} className="heatmap-cell">
                        <span className="heatmap-label">
                          LR: {cell.learningRate} | BS: {cell.batchSize}
                        </span>
                        <span className="heatmap-val" style={{ color }}>
                          {cell.avgAccuracy}%
                        </span>
                        <span className="heatmap-sub">{cell.runCount} runs</span>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}
          </section>

          {/* Confusion Matrix Section */}
          <section className="glass-card">
            <div className="chart-header">
              <h2 className="chart-title">
                <Layers size={18} /> Classification Matrix
              </h2>
              <span className="chart-badge">Actual vs Predicted</span>
            </div>

            {!confusionMatrix ? (
              <div className="state-container">No matrix data available for current selection.</div>
            ) : (
              <div>
                <table className="cm-table" aria-label="Confusion Matrix Table">
                  <thead>
                    <tr>
                      <th>Actual \ Pred</th>
                      {confusionMatrix.labels.map((lbl) => (
                        <th key={lbl}>{lbl}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {confusionMatrix.values.map((row, rowIdx) => (
                      <tr key={rowIdx}>
                        <th>{confusionMatrix.labels[rowIdx]}</th>
                        {row.map((val, colIdx) => (
                          <td
                            key={colIdx}
                            className={rowIdx === colIdx ? 'cm-diagonal' : ''}
                          >
                            {val}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </main>
      )}

      {/* Dataset Versioning & Lineage Graph Component */}
      {!loading && !error && (
        <DatasetLineageGraph lineageData={data.lineageGraph} />
      )}
    </div>
  )
}

