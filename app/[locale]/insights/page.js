'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@clerk/nextjs'
import { RefreshCw, Calendar, TrendingUp, Activity, BarChart2 } from 'lucide-react'
import {
  LineChart, Line, BarChart, Bar,
  XAxis, YAxis, Tooltip, CartesianGrid,
  ResponsiveContainer, Cell,
} from 'recharts'
import Navbar from '@/components/layout/Navbar'
import Footer from '@/components/layout/Footer'
import { useOffline } from '@/lib/OfflineContext'
import { useTranslations } from 'next-intl'
import WeightTrendChart from '@/components/dashboard/WeightTrendChart'
import { formatDateForCSV } from '@/lib/utils'
// ─── Design tokens ────────────────────────────────────────────────────────────
const PINK = '#e8527e'
const MAUVE = '#9d3f7a'
const ACCENT = '#e91e8c'
const TEXT_PRIMARY = '#ffffff'
const TEXT_FAINT = 'rgba(255,255,255,0.65)'
const CARD_BG = 'rgba(255,255,255,0.08)'
const CARD_BORDER = '1px solid rgba(255,255,255,0.14)'

const SYMPTOM_LIST = ['Cramps', 'Headache', 'Bloating', 'Fatigue', 'Acne', 'Nausea']
const MOOD_EMOJIS = ['😊', '😐', '😢', '😡']
const MOOD_LABELS = { '😊': 'Happy', '😐': 'Neutral', '😢': 'Sad', '😡': 'Angry' }

// ─── Icon badge wrapper ───────────────────────────────────────────────────────
function IconBadge({ children, size = 'lg' }) {
  const pad = size === 'lg' ? '12px' : '8px'
  return (
    <div style={{
      display: 'inline-flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'rgba(233,30,140,0.15)',
      borderRadius: '12px',
      padding: pad,
      marginBottom: size === 'lg' ? '0.6rem' : 0,
    }}>
      {children}
    </div>
  )
}

// ─── Stat Card ────────────────────────────────────────────────────────────────
function StatCard({ icon, label, value, sub }) {
  return (
    <div className="insight-card interactive-card" style={{
      textAlign: 'center',
      padding: '1.5rem 1rem',
      background: CARD_BG,
      border: CARD_BORDER,
      borderRadius: 16,
      backdropFilter: 'blur(12px)',
    }}>
      <div style={{ marginBottom: '0.5rem' }}>
        <IconBadge size="lg">{icon}</IconBadge>
      </div>
      <div style={{
        fontSize: '2rem', fontWeight: 700,
        background: `linear-gradient(135deg, ${PINK}, ${MAUVE})`,
        WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
      }}>
        {value}
      </div>
      <div style={{ fontSize: '0.88rem', fontWeight: 600, color: TEXT_PRIMARY, marginTop: 4 }}>
        {label}
      </div>
      {sub && (
        <div style={{ fontSize: '0.75rem', color: TEXT_FAINT, marginTop: 2 }}>{sub}</div>
      )}
    </div>
  )
}

// ─── Section card ─────────────────────────────────────────────────────────────
function SectionCard({ icon, title, children }) {
  return (
    <div className="insight-card interactive-card" style={{
      background: CARD_BG,
      border: CARD_BORDER,
      borderRadius: 16,
      backdropFilter: 'blur(12px)',
      padding: '1.5rem',
      marginBottom: '1.5rem',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '1.25rem' }}>
        {icon && <IconBadge size="sm">{icon}</IconBadge>}
        <h3 style={{ color: TEXT_PRIMARY, fontSize: '1.05rem', fontWeight: 600, margin: 0 }}>
          {title}
        </h3>
      </div>
      {children}
    </div>
  )
}

// ─── Custom Recharts tooltip ──────────────────────────────────────────────────
const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null
  return (
    <div style={{
      background: 'rgba(30,12,40,0.95)',
      border: `1px solid ${PINK}55`,
      borderRadius: 10,
      padding: '8px 14px',
      fontSize: '0.82rem',
      color: TEXT_PRIMARY,
    }}>
      <p style={{ color: TEXT_FAINT, marginBottom: 2 }}>{label}</p>
      {payload.map((p, i) => (
        <p key={i} style={{ color: p.color }}>
          <strong>{p.value}</strong> {p.name}
        </p>
      ))}
    </div>
  )
}

const axisProps = { tick: { fill: 'rgba(255,255,255,0.75)', fontSize: 12 } }
const gridProps = { strokeDasharray: '3 3', stroke: 'rgba(255,255,255,0.1)' }

// ─── Page ─────────────────────────────────────────────────────────────────────
export default function InsightsPage() {
  const t = useTranslations('pages.insights')
  const tSymp = useTranslations('symptoms')
  const tMood = useTranslations('moods')
  const tRisk = useTranslations('Risk')
  const router = useRouter()
  const { isLoaded, isSignedIn } = useAuth()
  const { offlineClient } = useOffline()

  const [cycleData, setCycleData] = useState(null)
  const [pcodRisk, setPcodRisk] = useState(null)
  const [dailyLogs, setDailyLogs] = useState([])
  const [copied, setCopied] = useState(false)
  const [loading, setLoading] = useState(true)
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
    if (!isLoaded) return
    if (!isSignedIn) { router.push('/auth/login'); return }

    const init = async () => {
      const [cycleRes, pcodRes, logsRes] = await Promise.all([
        offlineClient.fetchCycles(),
        offlineClient.fetchPCODRisk(),
        offlineClient.fetchAllLogs(),
      ])
      if (cycleRes.success) setCycleData(cycleRes.data)
      if (pcodRes.success) setPcodRisk(pcodRes.data)
      setDailyLogs(logsRes.success ? logsRes.data : [])
      setLoading(false)
    }
    init()
  }, [isLoaded, isSignedIn, router])

  // ── Derived data ──────────────────────────────────────────────────────────
  const cycles = cycleData?.cycles || []
  const avgCycle = cycleData?.averageCycleLength || 28
  const totalCycles = cycles.length
  const totalLogs = dailyLogs.length

  let nextDate = '—'
  if (cycleData?.nextPeriodDate) {
    const nextPeriodDateObj = new Date(cycleData.nextPeriodDate)
    if (!isNaN(nextPeriodDateObj.getTime())) {
      nextDate = nextPeriodDateObj.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })
    }
  }

  const cycleLengthData = cycles
    .slice(0, 6)
    .reverse()
    .map((c, i) => ({ name: `C${i + 1}`, days: c.cycle_length || 28 }))

  const symptomCounts = {}
  SYMPTOM_LIST.forEach(s => { symptomCounts[s] = 0 })
  dailyLogs.forEach(log => {
    if (!log) return
    const syms = Array.isArray(log.symptoms) ? log.symptoms : []
    syms.forEach(s => {
      const key = SYMPTOM_LIST.find(k => k.toLowerCase() === s.toLowerCase())
      if (key) symptomCounts[key] = (symptomCounts[key] || 0) + 1
    })
  })
  const symptomFreq = SYMPTOM_LIST.map(s => ({ name: tSymp(s), count: symptomCounts[s] }))

  const moodCounts = { '😊': 0, '😐': 0, '😢': 0, '😡': 0 }
  dailyLogs.forEach(log => {
    if (!log) return
    if (log.mood && moodCounts[log.mood] !== undefined) moodCounts[log.mood]++
  })
  const moodData = MOOD_EMOJIS.map(emoji => ({
    emoji,
    label: tMood(MOOD_LABELS[emoji]),
    pct: totalLogs > 0 ? Math.round((moodCounts[emoji] / totalLogs) * 100) : 0,
  }))

  const recordedValue = totalCycles > 0 ? totalCycles : totalLogs
  const recordedLabel = totalCycles > 0 ? t('cyclesRecorded') : t('daysLogged')
  const recordedSub = totalCycles > 0 ? t('cycles') : t('entries')

  const handleCSVExport = () => {
    if (!cycles.length) return
    const header = 'start_date,end_date,cycle_length'
    const rows = cycles.map(c =>
      `${formatDateForCSV(c.start_date)},${formatDateForCSV(c.end_date)},${c.cycle_length || ''}`
    )
    const blob = new Blob([[header, ...rows].join('\n')], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'hercycle-cycles.csv'
    a.click()
    URL.revokeObjectURL(url)
  }

  const riskTier = pcodRisk?.tier || pcodRisk?.label || 'LOW RISK'
  const riskLevelWord =
    riskTier === 'HIGH RISK' ? 'High' :
      riskTier === 'MEDIUM RISK' ? 'Medium' : 'Low'

  const thirtyDaysAgo = new Date()
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)

  const recentSymptomNames = new Set()
  dailyLogs.forEach(log => {
    if (!log || !log.date) return
    const logDate = new Date(log.date)
    if (isNaN(logDate.getTime()) || logDate < thirtyDaysAgo) return
    const syms = Array.isArray(log.symptoms) ? log.symptoms : []
    syms.forEach(s => {
      const key = SYMPTOM_LIST.find(k => k.toLowerCase() === s.toLowerCase())
      if (key) recentSymptomNames.add(tSymp(key))
    })
  })
  const recentSymptomsText = recentSymptomNames.size > 0
    ? Array.from(recentSymptomNames).join(', ')
    : t('noSymptomsLogged')

  const handleCopySummary = async () => {
    const summaryText = `🌸 HerCycle AI Health Summary
- Avg Cycle Length: ${avgCycle} Days
- Recent PCOD Risk: ${riskLevelWord}
- Logged Symptoms (Last 30 Days): ${recentSymptomsText}`

    try {
      if (navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
        await navigator.clipboard.writeText(summaryText)
        setCopied(true)
        setTimeout(() => setCopied(false), 2000)
      } else {
        const textArea = document.createElement('textarea')
        textArea.value = summaryText
        textArea.style.position = 'fixed'
        textArea.style.left = '-999999px'
        textArea.style.top = '-999999px'
        document.body.appendChild(textArea)
        textArea.focus()
        textArea.select()
        const successful = document.execCommand('copy')
        document.body.removeChild(textArea)
        if (successful) {
          setCopied(true)
          setTimeout(() => setCopied(false), 2000)
        } else {
          throw new Error('Fallback copy failed')
        }
      }
    } catch (err) {
      console.error('Could not copy summary', err)
    }
  }

  if (!mounted) {
    return (
      <div style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', background: '#0e0314' }}>
        <p style={{ color: TEXT_FAINT }}>Loading Insights...</p>
      </div>
    )
  }

  return (
    <>
      <div className="blob"></div>
      <div className="blob"></div>
      <div className="blob"></div>

      <div className="page">
        <Navbar />

        <div style={{ maxWidth: 1000, margin: '0 auto', padding: '2rem 1.5rem' }}>

          {/* ── Page header ── */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px' }}>
            <div style={{
              background: 'rgba(255,255,255,0.2)',
              borderRadius: '12px',
              padding: '8px',
              display: 'flex',
              alignItems: 'center',
            }}>
              <BarChart2 size={28} color="white" strokeWidth={1.5} />
            </div>
            <h1 style={{ margin: 0, fontSize: '2rem', flex: 1 }}>{t('title')}</h1>
            
            {!loading && (
              <div style={{
                background: 'rgba(233,30,140,0.15)',
                border: `1px solid ${PINK}55`,
                padding: '6px 14px',
                borderRadius: '20px',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
              }}>
                <RefreshCw size={16} color={PINK} />
                <span style={{ fontSize: '0.9rem', fontWeight: 600, color: '#ffb3d9' }}>
                  {t('avgCycle')}: {avgCycle}d
                </span>
              </div>
            )}
          </div>
          <p style={{ color: TEXT_FAINT, marginBottom: '2rem' }}>
            {t('subtitle')}
          </p>

          {/* ── Stat Cards ── */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
            gap: '1rem',
            marginBottom: '2rem',
          }}>
            <StatCard
              icon={<RefreshCw size={28} color={ACCENT} strokeWidth={1.5} />}
              label={t('avgCycle')}
              value={`${avgCycle}d`}
              sub="days"
            />
            <StatCard
              icon={<Calendar size={28} color={ACCENT} strokeWidth={1.5} />}
              label={recordedLabel}
              value={loading ? '…' : recordedValue}
              sub={recordedSub}
            />
            <StatCard
              icon={<span style={{ fontSize: '1.75rem', lineHeight: 1 }}>🌸</span>}
              label={t('nextPeriod')}
              value={loading ? '…' : nextDate}
              sub={t('predicted')}
            />
            <StatCard
              icon={<span style={{ fontSize: '1.75rem', lineHeight: 1 }}>🩺</span>}
              label={t('pcodRisk')}
              value={loading ? '…' : `${pcodRisk?.score ?? 0}/100`}
              sub={
                riskTier === 'HIGH RISK' ? tRisk('high')
                  : riskTier === 'MEDIUM RISK' ? tRisk('med')
                    : tRisk('low')
              }
            />
          </div>

          {/* ── Export Buttons ── */}
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', flexWrap: 'wrap', marginBottom: '1.5rem' }}>
            <button
              onClick={handleCopySummary}
              className="export-btn"
              style={{ width: 'auto', padding: '10px 20px' }}
            >
              {copied ? `✅ ${t('copiedSummary')}` : `📋 ${t('copySummary')}`}
            </button>
            {cycles.length > 0 && (
              <button
                onClick={handleCSVExport}
                className="export-btn"
                style={{ width: 'auto', padding: '10px 20px' }}
              >
                ⬇️ {t('exportCsv')}
              </button>
            )}
          </div>

          {/* ── Cycle Length Trend ── */}
          <SectionCard
            icon={<TrendingUp size={18} color={ACCENT} strokeWidth={1.5} />}
            title={t('trendTitle')}
          >
            {cycleLengthData.length < 1 ? (
              <p style={{ color: TEXT_FAINT, textAlign: 'center', padding: '2rem 0' }}>
                {t('trendEmpty')}
              </p>
            ) : (
              <ResponsiveContainer width="100%" height={220}>
                <LineChart
                  data={cycleLengthData}
                  margin={{ top: 5, right: 20, left: -10, bottom: 5 }}
                >
                  <defs>
                    <filter
                      id="cycleGlow"
                      x="-50%"
                      y="-50%"
                      width="200%"
                      height="200%"
                    >
                      <feGaussianBlur
                        in="SourceGraphic"
                        stdDeviation="4"
                        result="blur"
                      />
                      <feMerge>
                        <feMergeNode in="blur" />
                        <feMergeNode in="SourceGraphic" />
                      </feMerge>
                    </filter>
                  </defs>

                  <CartesianGrid
                    vertical={false}
                    stroke="rgba(255,255,255,0.05)"
                  />

                  <XAxis
                    dataKey="name"
                    {...axisProps}
                  />

                  <YAxis
                    domain={[20, 40]}
                    {...axisProps}
                  />

                  <Tooltip content={<CustomTooltip />} />

                  <Line
                    type="monotone"
                    dataKey="days"
                    name="days"
                    stroke={PINK}
                    strokeWidth={2.5}
                    filter="url(#cycleGlow)"
                    dot={{
                      fill: PINK,
                      stroke: PINK,
                      strokeWidth: 2,
                      r: 5,
                    }}
                    activeDot={{
                      r: 8,
                      fill: MAUVE,
                      stroke: PINK,
                      strokeWidth: 3,
                    }}
                  />
                </LineChart>
              </ResponsiveContainer>
            )}
          </SectionCard>

          <WeightTrendChart />

          {/* ── Symptom Frequency ── */}
          <SectionCard
            icon={<Activity size={18} color={ACCENT} strokeWidth={1.5} />}
            title={t('symptomTitle')}
          >
            {totalLogs === 0 ? (
              <p style={{ color: TEXT_FAINT, textAlign: 'center', padding: '2rem 0' }}>
                {t('symptomEmpty')}
              </p>
            ) : (
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={symptomFreq} margin={{ top: 5, right: 20, left: -10, bottom: 5 }}>
                  <CartesianGrid {...gridProps} />
                  <XAxis dataKey="name" {...axisProps} />
                  <YAxis allowDecimals={false} {...axisProps} />
                  <Tooltip content={<CustomTooltip />} />
                  <Bar dataKey="count" name="occurrences" radius={[6, 6, 0, 0]}>
                    {symptomFreq.map((_, i) => (
                      <Cell key={i} fill={i % 2 === 0 ? PINK : MAUVE} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </SectionCard>

          {/* ── Mood Distribution ── */}
          <SectionCard
            icon={null}
            title={t('moodTitle')}
          >
            {totalLogs === 0 ? (
              <p style={{ color: TEXT_FAINT, textAlign: 'center', padding: '1rem 0' }}>
                {t('moodEmpty')}
              </p>
            ) : (
              <>
                <div className="mood-distribution-grid">
                  {moodData.map(({ emoji, label, pct }) => (
                    <div key={label} className="mood-summary-card interactive-card" style={{
                      textAlign: 'center', padding: '1rem 0.5rem',
                      background: 'rgba(255,255,255,0.06)',
                      borderRadius: 12,
                      border: '1px solid rgba(255,255,255,0.1)',
                    }}>
                      <div style={{ fontSize: '1.8rem' }}>{emoji}</div>
                      <div style={{
                        fontSize: '1.2rem', fontWeight: 700,
                        background: `linear-gradient(135deg, ${PINK}, ${MAUVE})`,
                        WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
                        marginTop: 4,
                      }}>
                        {pct}%
                      </div>
                      <div style={{ fontSize: '0.78rem', color: TEXT_PRIMARY, marginTop: 2 }}>
                        {label}
                      </div>
                    </div>
                  ))}
                </div>
                <p style={{ fontSize: '0.72rem', color: TEXT_FAINT, marginTop: '0.75rem' }}>
                  {t('moodBasedOn', { count: totalLogs, entryLabel: totalLogs === 1 ? t('entry') : t('entries') })}
                </p>
              </>
            )}
          </SectionCard>

        </div>

        <Footer />
      </div>
    </>
  )
}
