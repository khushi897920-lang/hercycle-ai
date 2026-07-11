'use client'

import { useEffect, useMemo, useState } from 'react'
import { Activity, Scale } from 'lucide-react'
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'

const cardStyle = {
  background: 'rgba(255,255,255,0.08)',
  border: '1px solid rgba(255,255,255,0.14)',
  borderRadius: 16,
  backdropFilter: 'blur(12px)',
  padding: '1.5rem',
  marginBottom: '1.5rem',
}

function formatDate(value) {
  return new Date(`${value}T00:00:00`).toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
  })
}

export default function WeightTrendChart({ refreshKey = 0 }) {
  const [entries, setEntries] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let active = true

    async function loadEntries() {
      setLoading(true)
      try {
        const response = await fetch('/api/weight', { cache: 'no-store' })
        const result = await response.json()
        if (active && response.ok && result.success) {
          setEntries(result.data || [])
        }
      } catch (error) {
        console.error('Failed to load weight history:', error)
      } finally {
        if (active) setLoading(false)
      }
    }

    loadEntries()
    return () => {
      active = false
    }
  }, [refreshKey])

  const chartData = useMemo(
    () => entries.map(entry => ({
      ...entry,
      label: formatDate(entry.recorded_date),
      weight: Number(entry.weight_kg),
      waist: entry.waist_cm == null ? null : Number(entry.waist_cm),
      bmi: Number(entry.bmi),
    })),
    [entries]
  )

  const latest = chartData.at(-1)
  const first = chartData[0]
  const weightChange = latest && first
    ? Number((latest.weight - first.weight).toFixed(1))
    : null

  return (
    <section style={cardStyle} aria-labelledby="weight-trend-title">
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        gap: 16,
        flexWrap: 'wrap',
        marginBottom: 18,
      }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
            <Scale size={22} color="#e91e8c" />
            <h3 id="weight-trend-title" style={{ margin: 0, fontSize: '1.05rem' }}>
              Weight and waist trend
            </h3>
          </div>
          <p style={{ color: 'rgba(255,255,255,0.62)', margin: '6px 0 0' }}>
            Measurements are shown in chronological order.
          </p>
        </div>

        {latest && (
          <div style={{ textAlign: 'right' }}>
            <strong style={{ display: 'block', fontSize: '1.3rem' }}>
              {latest.weight} kg
            </strong>
            <span style={{ color: 'rgba(255,255,255,0.62)', fontSize: '0.82rem' }}>
              BMI {latest.bmi}
              {weightChange !== null && chartData.length > 1
                ? ` · ${weightChange > 0 ? '+' : ''}${weightChange} kg overall`
                : ''}
            </span>
          </div>
        )}
      </div>

      {loading ? (
        <p style={{ color: 'rgba(255,255,255,0.65)' }}>Loading measurements…</p>
      ) : chartData.length === 0 ? (
        <div style={{
          minHeight: 180,
          display: 'grid',
          placeItems: 'center',
          textAlign: 'center',
          color: 'rgba(255,255,255,0.62)',
        }}>
          <div>
            <Activity size={30} style={{ marginBottom: 8 }} />
            <p style={{ margin: 0 }}>
              No measurements yet. Add the first entry from the Track page.
            </p>
          </div>
        </div>
      ) : (
        <div style={{ width: '100%', height: 300 }}>
          <ResponsiveContainer>
            <LineChart data={chartData} margin={{ top: 8, right: 12, left: -8, bottom: 4 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
              <XAxis
                dataKey="label"
                tick={{ fill: 'rgba(255,255,255,0.72)', fontSize: 12 }}
              />
              <YAxis
                yAxisId="weight"
                tick={{ fill: 'rgba(255,255,255,0.72)', fontSize: 12 }}
                domain={['dataMin - 3', 'dataMax + 3']}
              />
              <YAxis
                yAxisId="waist"
                orientation="right"
                tick={{ fill: 'rgba(255,255,255,0.72)', fontSize: 12 }}
                domain={['dataMin - 5', 'dataMax + 5']}
              />
              <Tooltip
                contentStyle={{
                  background: 'rgba(30,12,40,0.96)',
                  border: '1px solid rgba(232,82,126,0.5)',
                  borderRadius: 10,
                }}
                labelStyle={{ color: '#fff' }}
              />
              <Legend />
              <Line
                yAxisId="weight"
                type="monotone"
                dataKey="weight"
                name="Weight (kg)"
                stroke="#e8527e"
                strokeWidth={3}
                activeDot={{ r: 6 }}
              />
              <Line
                yAxisId="waist"
                type="monotone"
                dataKey="waist"
                name="Waist (cm)"
                stroke="#a98bff"
                strokeWidth={2}
                connectNulls
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}
    </section>
  )
}
