'use client'

import { useState, useEffect } from 'react'
import { toast } from 'sonner'
import { Loader2 } from 'lucide-react'

const CONDITIONS_OPTIONS = [
  'PCOS',
  'Endometriosis',
  'Thyroid Issues',
  'PMDD',
  'None'
]

export default function HealthProfileSettings() {
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [formData, setFormData] = useState({
    age: '',
    weight_kg: '',
    height_cm: '',
    known_conditions: [],
    cycle_goal: ''
  })

  useEffect(() => {
    fetchProfile()
  }, [])

  const fetchProfile = async () => {
    try {
      setLoading(true)
      const res = await fetch('/api/profile')
      const data = await res.json()
      if (data.success && data.profile) {
        setFormData({
          age: data.profile.age || '',
          weight_kg: data.profile.weight_kg || '',
          height_cm: data.profile.height_cm || '',
          known_conditions: data.profile.known_conditions || [],
          cycle_goal: data.profile.cycle_goal || ''
        })
      }
    } catch (err) {
      toast.error('Failed to load profile')
    } finally {
      setLoading(false)
    }
  }

  const handleChange = (e) => {
    const { name, value } = e.target
    setFormData(prev => ({ ...prev, [name]: value }))
  }

  const handleConditionChange = (condition) => {
    setFormData(prev => {
      let updatedConditions = [...prev.known_conditions]
      if (condition === 'None') {
        updatedConditions = ['None']
      } else {
        // Remove 'None' if another condition is selected
        updatedConditions = updatedConditions.filter(c => c !== 'None')
        if (updatedConditions.includes(condition)) {
          updatedConditions = updatedConditions.filter(c => c !== condition)
        } else {
          updatedConditions.push(condition)
        }
      }
      return { ...prev, known_conditions: updatedConditions }
    })
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setSaving(true)
    try {
      const payload = {
        age: formData.age ? parseInt(formData.age) : null,
        weight_kg: formData.weight_kg ? parseFloat(formData.weight_kg) : null,
        height_cm: formData.height_cm ? parseFloat(formData.height_cm) : null,
        known_conditions: formData.known_conditions,
        cycle_goal: formData.cycle_goal
      }

      const res = await fetch('/api/profile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      })

      const data = await res.json()
      if (data.success) {
        toast.success('Health profile saved successfully!')
      } else {
        toast.error(data.error || 'Failed to save profile')
      }
    } catch (err) {
      toast.error('An error occurred while saving')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center p-8 text-white/50 space-y-4">
        <Loader2 className="w-8 h-8 animate-spin" />
        <p>Loading your profile...</p>
      </div>
    )
  }

  return (
    <div className="p-4 sm:p-6 w-full max-w-lg mx-auto animate-in fade-in duration-300">
      <div className="mb-6 text-center">
        <h2 className="text-2xl font-bold text-white mb-2">Health Profile</h2>
        <p className="text-white/70 text-sm">
          Share some details to help Gemini AI provide more personalized insights and predictions for your cycle.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-2">
            <label className="text-sm font-medium text-white/90">Age</label>
            <input
              type="number"
              name="age"
              value={formData.age}
              onChange={handleChange}
              min="1"
              max="120"
              className="w-full bg-white/10 border border-white/20 rounded-xl px-4 py-2 text-white placeholder:text-white/40 focus:outline-none focus:ring-2 focus:ring-pink-500/50"
              placeholder="e.g. 28"
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-white/90">Weight (kg)</label>
            <input
              type="number"
              name="weight_kg"
              value={formData.weight_kg}
              onChange={handleChange}
              step="0.1"
              min="1"
              className="w-full bg-white/10 border border-white/20 rounded-xl px-4 py-2 text-white placeholder:text-white/40 focus:outline-none focus:ring-2 focus:ring-pink-500/50"
              placeholder="e.g. 65.5"
            />
          </div>
          
          <div className="space-y-2 sm:col-span-2">
            <label className="text-sm font-medium text-white/90">Height (cm)</label>
            <input
              type="number"
              name="height_cm"
              value={formData.height_cm}
              onChange={handleChange}
              step="0.1"
              min="1"
              className="w-full bg-white/10 border border-white/20 rounded-xl px-4 py-2 text-white placeholder:text-white/40 focus:outline-none focus:ring-2 focus:ring-pink-500/50"
              placeholder="e.g. 165"
            />
          </div>
        </div>

        <div className="space-y-3">
          <label className="text-sm font-medium text-white/90">Known Health Conditions</label>
          <div className="flex flex-wrap gap-2">
            {CONDITIONS_OPTIONS.map((condition) => (
              <button
                key={condition}
                type="button"
                onClick={() => handleConditionChange(condition)}
                className={`px-3 py-1.5 rounded-full text-sm font-medium border transition-colors ${
                  formData.known_conditions.includes(condition)
                    ? 'bg-pink-500 text-white border-pink-500 shadow-md shadow-pink-500/20'
                    : 'bg-white/5 text-white/70 border-white/10 hover:bg-white/10'
                }`}
              >
                {condition}
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium text-white/90">Primary Cycle Goal</label>
          <select
            name="cycle_goal"
            value={formData.cycle_goal}
            onChange={handleChange}
            className="w-full bg-white/10 border border-white/20 rounded-xl px-4 py-2.5 text-white focus:outline-none focus:ring-2 focus:ring-pink-500/50 appearance-none [&>option]:text-black"
          >
            <option value="">Select a goal...</option>
            <option value="Track Health">General Health Tracking</option>
            <option value="Avoid Pregnancy">Avoid Pregnancy</option>
            <option value="Conceive">Trying to Conceive</option>
            <option value="Manage Symptoms">Manage Symptoms (e.g., PMS)</option>
          </select>
        </div>

        <div className="pt-4 border-t border-white/10">
          <button
            type="submit"
            disabled={saving}
            className="w-full bg-pink-500 hover:bg-pink-600 text-white font-medium py-3 rounded-xl transition-all shadow-lg shadow-pink-500/20 disabled:opacity-70 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {saving ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                Saving...
              </>
            ) : (
              'Save Profile'
            )}
          </button>
        </div>
      </form>
    </div>
  )
}
