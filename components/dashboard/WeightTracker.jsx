'use client'

import { useEffect, useMemo, useState } from 'react'
import { Activity, Ruler, Scale, Save } from 'lucide-react'
import toast from 'react-hot-toast'
import { useTranslations } from 'next-intl'

const cardStyle = {
  background: 'rgba(255,255,255,0.08)',
  border: '1px solid rgba(255,255,255,0.14)',
  borderRadius: 16,
  backdropFilter: 'blur(12px)',
  padding: '1.5rem',
}

const fieldStyle = {
  width: '100%',
  padding: '0.75rem 0.85rem',
  borderRadius: 10,
  border: '1px solid rgba(255,255,255,0.18)',
  background: 'rgba(255,255,255,0.08)',
  color: '#fff',
  outline: 'none',
}

function todayISO() {
  return new Date().toISOString().split('T')[0]
}

function bmiLabel(bmi) {
  if (!bmi) return 'Not calculated'
  if (bmi < 18.5) return 'Below healthy range'
  if (bmi < 25) return 'Healthy range'
  if (bmi < 30) return 'Above healthy range'
  return 'High range'
}

export default function WeightTracker({ onSaved }) {
  const t = useTranslations('WeightTracker')
  const [form, setForm] = useState({
    recorded_date: todayISO(),
    weight_kg: '',
    waist_cm: '',
    height_cm: '',
  })
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    try {
      const savedHeight = localStorage.getItem('hercycle-height-cm')
      if (savedHeight) {
        setForm(current => ({ ...current, height_cm: savedHeight }))
      }
    } catch {
      // Local storage can be unavailable in privacy-restricted browsers.
    }
  }, [])

  const bmi = useMemo(() => {
    const weight = Number(form.weight_kg)
    const height = Number(form.height_cm) / 100
    if (!weight || !height) return null
    return Number((weight / (height * height)).toFixed(1))
  }, [form.weight_kg, form.height_cm])

  const setField = (name, value) => {
    setForm(current => ({ ...current, [name]: value }))
  }

  const handleSubmit = async event => {
    event.preventDefault()
    setSaving(true)

    try {
      const response = await fetch('/api/weight', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          recorded_date: form.recorded_date,
          weight_kg: Number(form.weight_kg),
          waist_cm: form.waist_cm ? Number(form.waist_cm) : null,
          height_cm: Number(form.height_cm),
        }),
      })

      const result = await response.json()
      if (!response.ok || !result.success) {
        throw new Error(result.error || 'Unable to save the measurement.')
      }

      localStorage.setItem('hercycle-height-cm', form.height_cm)
      toast.success('Measurement saved successfully')
      setForm(current => ({
        ...current,
        weight_kg: '',
        waist_cm: '',
      }))
      onSaved?.(result.data)
    } catch (error) {
      toast.error(error.message || 'Unable to save the measurement.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <section style={cardStyle} aria-labelledby="weight-tracker-title">
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
        <Scale size={24} color="#e91e8c" />
        <h2 id="weight-tracker-title" style={{ margin: 0, fontSize: '1.2rem' }}>
          {t('title')}
        </h2>
      </div>

      <p style={{ color: 'rgba(255,255,255,0.68)', marginTop: 0, marginBottom: 20 }}>
        {t('desc')}
      </p>

      <form onSubmit={handleSubmit}>
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
          gap: 14,
        }}>
          <label>
            <span style={{ display: 'block', marginBottom: 6 }}>{t('date')}</span>
            <input
              type="date"
              value={form.recorded_date}
              max={todayISO()}
              onChange={e => setField('recorded_date', e.target.value)}
              required
              style={fieldStyle}
            />
          </label>

          <label>
            <span style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
              <Scale size={15} /> {t('weight')}
            </span>
            <input
              type="number"
              min="20"
              max="350"
              step="0.1"
              value={form.weight_kg}
              onChange={e => setField('weight_kg', e.target.value)}
              placeholder="e.g. 62.5"
              required
              style={fieldStyle}
            />
          </label>

          <label>
            <span style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
              <Ruler size={15} /> {t('waist')}
            </span>
            <input
              type="number"
              min="30"
              max="250"
              step="0.1"
              value={form.waist_cm}
              onChange={e => setField('waist_cm', e.target.value)}
              placeholder={t('optional')}
              style={fieldStyle}
            />
          </label>

          <label>
            <span style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
              <Ruler size={15} /> {t('height')}
            </span>
            <input
              type="number"
              min="100"
              max="250"
              step="0.1"
              value={form.height_cm}
              onChange={e => setField('height_cm', e.target.value)}
              placeholder="e.g. 165"
              required
              style={fieldStyle}
            />
          </label>
        </div>

        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: 16,
          flexWrap: 'wrap',
          marginTop: 18,
        }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            color: 'rgba(255,255,255,0.78)',
          }}>
            <Activity size={18} color="#e91e8c" />
            <span>
              {t('bmi')}: <strong style={{ color: '#fff' }}>{bmi ?? '—'}</strong>
              {bmi ? ` · ${bmiLabel(bmi)}` : ''}
            </span>
          </div>

          <button
            type="submit"
            disabled={saving}
            style={{
              border: 0,
              borderRadius: 10,
              padding: '0.8rem 1.1rem',
              background: 'linear-gradient(135deg, #e8527e, #9d3f7a)',
              color: '#fff',
              fontWeight: 700,
              cursor: saving ? 'not-allowed' : 'pointer',
              opacity: saving ? 0.7 : 1,
              display: 'inline-flex',
              alignItems: 'center',
              gap: 8,
            }}
          >
            <Save size={17} />
            {saving ? t('saving') : t('saveBtn')}
          </button>
        </div>
      </form>

      <p style={{
        color: 'rgba(255,255,255,0.52)',
        fontSize: '0.78rem',
        lineHeight: 1.5,
        marginBottom: 0,
        marginTop: 16,
      }}>
        {t('disclaimer')}
      </p>
    </section>
  )
}
