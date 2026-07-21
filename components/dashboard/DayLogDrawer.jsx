'use client'

import { useState, useEffect } from 'react'
import { useTranslations, useLocale } from 'next-intl'
import toast from 'react-hot-toast'
import DailyLogPanel from './DailyLogPanel'
import { useOffline } from '@/lib/OfflineContext'
import { findCycleContainingDate } from '@/lib/cycle-helpers'

export default function DayLogDrawer({ isOpen, onClose, selectedDate, cycleData, onSaved }) {
  const tTrack = useTranslations('pages.track')
  const locale = useLocale()
  const { offlineClient } = useOffline()

  const [symptoms, setSymptoms] = useState([])
  const [mood, setMood] = useState(null)
  const [flow, setFlow] = useState(null)

  // Fetch the log for this specific date when the drawer opens
  useEffect(() => {
    if (!isOpen || !selectedDate) return

    setSymptoms([])
    setMood(null)
    setFlow(null)

    const fetchLog = async () => {
      try {
        const data = await offlineClient.fetchTodayLog(selectedDate)
        if (data.success && data.data) {
          if (data.data.symptoms) setSymptoms(data.data.symptoms)
          if (data.data.mood) setMood(data.data.mood)
          if (data.data.flow) setFlow(data.data.flow)
        }
      } catch (err) {
        console.error('Error fetching log for date:', err)
      }
    }
    fetchLog()
  }, [isOpen, selectedDate, offlineClient])

  if (!isOpen || !selectedDate) return null

  // Find a cycle whose [start_date, end_date] range contains the clicked date.
  // Uses plain YYYY-MM-DD string comparison to avoid timezone off-by-one bugs.
  const cycles = cycleData?.cycles || []
  const openCycleCurrent = findCycleContainingDate(cycles, selectedDate)

  const handleStartPeriod = async () => {
    if (!selectedDate) return
    const startDate = new Date(selectedDate)
    const endDate = new Date(startDate)
    endDate.setDate(endDate.getDate() + 5)
    
    const cycleDataObj = {
      start_date: startDate.toISOString().split('T')[0],
      end_date: endDate.toISOString().split('T')[0],
      cycle_length: cycleData?.averageCycleLength || 28,
    }

    try {
      const data = await offlineClient.startPeriod(cycleDataObj)
      if (!data.success) {
        toast.error(`❌ Could not start period: ${data.error || data.message || 'Unknown error'}`)
        return
      }
      if (data.offline) toast.success('🌸 Period started! Saved offline.')
      else toast.success('🌸 Period started!')
      
      onSaved() // Refresh calendar
      onClose()
    } catch (err) {
      toast.error(`❌ Could not start period: ${err.message || err}`)
    }
  }

  const handleEndPeriod = async () => {
    if (!selectedDate) return
    if (!openCycleCurrent) { 
      toast.error('No open period found to end')
      return 
    }

    if (new Date(selectedDate) < new Date(openCycleCurrent.start_date)) {
      toast.error('Period cannot end before it starts.')
      return
    }

    try {
      const data = await offlineClient.endPeriod(openCycleCurrent.id, selectedDate)
      if (!data.success) {
        toast.error(`❌ Could not end period: ${data.error || data.message || 'Unknown error'}`)
        return
      }
      if (data.offline) toast.success('✅ Period ended! Saved offline.')
      else toast.success('✅ Period ended!')
      
      onSaved()
      onClose()
    } catch (err) {
      toast.error(`❌ Could not end period: ${err.message || err}`)
    }
  }

  const handleSaveLog = async () => {
    try {
      const logData = {
        date: selectedDate,
        symptoms,
        mood,
        flow,
      }
      const data = await offlineClient.saveDailyLog(logData)
      if (data.success) {
        if (data.offline) toast.success('💾 Saved offline! Will sync when online.')
        else toast.success('✅ Log saved!')
        onSaved()
        onClose()
      } else {
        toast.error(`❌ Failed to save: ${data.message || data.error || 'Unknown error'}`)
      }
    } catch (err) {
      toast.error(`❌ Failed to save: ${err.message || err}`)
    }
  }

  const toggleSymptom = (s) => setSymptoms(prev => prev.includes(s) ? prev.filter(x => x !== s) : [...prev, s])

  // Format date for header
  const dateStr = new Intl.DateTimeFormat(locale === 'hi' ? 'hi-IN' : 'en-US', { 
    weekday: 'long', month: 'long', day: 'numeric' 
  }).format(new Date(selectedDate))

  return (
    <>
      <div 
        className="day-log-drawer-overlay"
        onClick={onClose}
        role="dialog"
        aria-modal="true"
      />
      <div className="day-log-drawer-panel glass">
        <div className="drawer-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
          <h3 style={{ margin: 0, fontSize: '1.25rem', color: '#fff' }}>
            {dateStr}
          </h3>
          <button 
            onClick={onClose} 
            style={{ background: 'none', border: 'none', color: '#fff', fontSize: '1.5rem', cursor: 'pointer' }}
            aria-label="Close"
          >
            &times;
          </button>
        </div>

        <div style={{ display: 'flex', gap: '1rem', marginBottom: '1.5rem', flexWrap: 'wrap' }}>
          {!openCycleCurrent ? (
            <button className="btn-white" onClick={handleStartPeriod} style={{ flex: 1, padding: '0.75rem', fontWeight: 600 }}>
              {tTrack('startPeriod')}
            </button>
          ) : (
            <button className="btn-outline" onClick={handleEndPeriod} style={{ flex: 1, padding: '0.75rem', fontWeight: 600 }}>
              {tTrack('endPeriod')}
            </button>
          )}
        </div>

        <div className="daily-log-grid">
          <DailyLogPanel
            selectedSymptoms={symptoms}
            toggleSymptom={toggleSymptom}
            selectedMood={mood}
            setSelectedMood={setMood}
            selectedFlow={flow}
            setSelectedFlow={setFlow}
            handleSaveLog={handleSaveLog}
            cycleData={cycleData}
            activeLang="EN"
          />
        </div>
      </div>
    </>
  )
}
