import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

// Use service role key if available (bypasses RLS), fall back to anon
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
)

const USER_ID      = '00000000-0000-0000-0000-000000000001'
const CYCLE_LENGTHS  = [28, 27, 29, 28, 28, 27]
const PERIOD_LENGTHS = [5,   5,  6,  5,  6,  5]

function addDays(date, n) {
  const d = new Date(date)
  d.setDate(d.getDate() + n)
  return d
}
function fmt(date) { return date.toISOString().split('T')[0] }
function pick(arr) { return arr[Math.floor(Math.random() * arr.length)] }
function shuffle(arr) { return [...arr].sort(() => Math.random() - 0.5) }

function flowPattern(day, totalDays) {
  if (day === 0)              return 'f1'
  if (day === 1 || day === 2) return 'f3'
  if (day === totalDays - 1)  return 'f1'
  return 'f2'
}

function buildCycles() {
  const today  = new Date()
  const cycles = []
  let runningStart = new Date(today)

  for (let i = CYCLE_LENGTHS.length - 1; i >= 0; i--) {
    runningStart = addDays(runningStart, -CYCLE_LENGTHS[i])
    const start = new Date(runningStart)
    const end   = addDays(start, PERIOD_LENGTHS[i] - 1)
    cycles.push({ start, end, periodLen: PERIOD_LENGTHS[i], cycleLen: CYCLE_LENGTHS[i] })
  }
  return cycles.sort((a, b) => a.start - b.start)
}

export const dynamic = 'force-dynamic'

export async function GET() {
  const PERIOD_SYMPTOMS  = ['Cramps', 'Bloating', 'Fatigue', 'Headache']
  const PMS_SYMPTOMS     = ['Bloating', 'Headache', 'Acne', 'Fatigue']
  const OVUL_SYMPTOMS    = ['Fatigue']

  try {
    // 0. Ensure user exists to satisfy foreign key constraints
    const { data: userResp, error: userCheckErr } = await supabase.auth.admin.getUserById(USER_ID)
    
    if (userCheckErr && userCheckErr.status === 404) {
      // User doesn't exist, create them
      const { error: createErr } = await supabase.auth.admin.createUser({
        id: USER_ID,
        email: 'demo@hercycle.test',
        password: 'password123',
        email_confirm: true
      })
      if (createErr) {
        return NextResponse.json({ success: false, error: `Auth create: ${createErr.message}` }, { status: 500 })
      }
    }

    // 1. Clear existing data
    await supabase.from('daily_logs').delete().eq('user_id', USER_ID)
    await supabase.from('cycles').delete().eq('user_id', USER_ID)

    const cycles = buildCycles()

    // 2. Insert cycles
    const cycleRows = cycles.map(({ start, end }) => ({
      user_id:    USER_ID,
      start_date: fmt(start),
      end_date:   fmt(end),
    }))

    const { error: cycleErr } = await supabase.from('cycles').insert(cycleRows)
    if (cycleErr) {
      return NextResponse.json({ success: false, error: `Cycles: ${cycleErr.message}` }, { status: 500 })
    }

    // 3. Build daily logs
    const logRows = []
    for (const { start, end, periodLen, cycleLen } of cycles) {
      const cycleStart = new Date(start)
      for (let day = 0; day < cycleLen; day++) {
        const date     = addDays(cycleStart, day)
        const dateStr  = fmt(date)
        const isPeriod = day < periodLen
        const isPMS    = day >= 20
        const isOvul   = day >= 12 && day <= 15

        let symptoms = []
        let mood     = null
        let flow     = null

        if (isPeriod) {
          symptoms = shuffle(PERIOD_SYMPTOMS).slice(0, Math.floor(Math.random() * 3) + 1)
          mood     = day <= 2 ? '😢' : pick(['😐', '😊'])
          flow     = flowPattern(day, periodLen)
        } else if (isPMS) {
          symptoms = shuffle(PMS_SYMPTOMS).slice(0, 2)
          mood     = pick(['😐', '😡'])
        } else if (isOvul) {
          symptoms = Math.random() > 0.5 ? OVUL_SYMPTOMS : []
          mood     = pick(['😊', '😐'])
        } else {
          if (Math.random() < 0.6) {
            mood = pick(['😊', '😊', '😐'])
          } else {
            continue
          }
        }

        logRows.push({
          user_id:  USER_ID,
          date:     dateStr,
          symptoms: symptoms.length ? symptoms : null,
          mood,
          flow,
        })
      }
    }

    const { error: logErr } = await supabase
      .from('daily_logs')
      .upsert(logRows, { onConflict: 'user_id,date' })

    if (logErr) {
      return NextResponse.json({ success: false, error: `Logs: ${logErr.message}` }, { status: 500 })
    }

    const avgLen     = Math.round(CYCLE_LENGTHS.reduce((a, b) => a + b) / CYCLE_LENGTHS.length)
    const lastCycle  = cycles[cycles.length - 1]
    const nextPeriod = addDays(lastCycle.start, avgLen)

    return NextResponse.json({
      success: true,
      message: `✅ Seeded ${cycles.length} cycles and ${logRows.length} daily logs for demo-user`,
      summary: {
        cycles:      cycles.length,
        dailyLogs:   logRows.length,
        firstCycle:  fmt(cycles[0].start),
        lastCycle:   fmt(lastCycle.start),
        nextPeriod:  fmt(nextPeriod),
        avgCycleLen: avgLen,
      }
    })
  } catch (err) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 })
  }
}
