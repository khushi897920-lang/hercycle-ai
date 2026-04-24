/**
 * HerCycle AI — Demo Data Seeder
 * Seeds 6 months of realistic cycle + daily log data for demo-user-001.
 * Run: node scripts/seed-demo-data.js
 */

const { createClient } = require('@supabase/supabase-js')

// ── Config ────────────────────────────────────────────────────────────────
const SUPABASE_URL     = process.env.NEXT_PUBLIC_SUPABASE_URL
const SUPABASE_ANON    = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

if (!SUPABASE_URL || !SUPABASE_ANON) {
  console.error("Missing Supabase credentials in environment variables.");
  process.exit(1);
}

// The live Supabase table has user_id as UUID type.
// Use a fixed UUID for demo-user-001 across all seed + API routes.
const USER_ID = '00000000-0000-0000-0000-000000000001'

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON)

// ── Helpers ───────────────────────────────────────────────────────────────
function addDays(date, n) {
  const d = new Date(date)
  d.setDate(d.getDate() + n)
  return d
}

function fmt(date) {
  return date.toISOString().split('T')[0]  // YYYY-MM-DD
}

function pick(arr) {
  return arr[Math.floor(Math.random() * arr.length)]
}

function shuffle(arr) {
  return [...arr].sort(() => Math.random() - 0.5)
}

// ── Realistic Demo Cycles (6 months back from today) ──────────────────────
// Slightly varied cycle lengths (27-29 days) = regular but human
const CYCLE_LENGTHS  = [28, 27, 29, 28, 28, 27]   // 6 cycles
const PERIOD_LENGTHS = [5,   5,  6,  5,  6,  5]    // days of bleeding

// We generate backwards so the last cycle ends ~today
const today     = new Date()
const CYCLES    = []

let runningStart = new Date(today)

for (let i = CYCLE_LENGTHS.length - 1; i >= 0; i--) {
  const cycleLen  = CYCLE_LENGTHS[i]
  const periodLen = PERIOD_LENGTHS[i]

  // Shift back for all previous cycles
  if (i < CYCLE_LENGTHS.length - 1) {
    runningStart = addDays(runningStart, -CYCLE_LENGTHS[i + 1])
  } else {
    // Latest cycle started cycleLen days ago
    runningStart = addDays(today, -cycleLen)
  }

  const start = new Date(runningStart)
  const end   = addDays(start, periodLen - 1)

  CYCLES.push({ start, end, periodLen })
}

// Sort oldest first
CYCLES.sort((a, b) => a.start - b.start)

// ── Symptom / mood pools ──────────────────────────────────────────────────
const PERIOD_SYMPTOMS   = ['Cramps', 'Bloating', 'Fatigue', 'Headache']
const OVULATION_SYMPTOMS= ['Fatigue']
const PMS_SYMPTOMS      = ['Bloating', 'Headache', 'Acne', 'Fatigue']
const MOODS             = ['😊', '😐', '😢', '😡']
const FLOWS             = ['f1', 'f2', 'f3', 'f4'] // light → very heavy

// Build flow pattern for a period: ramps up then down
function flowPattern(day, totalDays) {
  if (day === 0)                    return 'f1'  // Day 1: spotting
  if (day === 1 || day === 2)       return 'f3'  // Days 2-3: heavy
  if (day === totalDays - 1)        return 'f1'  // Last day: light
  return 'f2'                                    // Middle: medium
}

// ── Main seeder ───────────────────────────────────────────────────────────
async function seed() {
  console.log('🌸 HerCycle AI — Seeding demo data...\n')

  // 1. Clear existing demo data
  console.log('🗑  Clearing old demo data...')
  await supabase.from('cycles').delete().eq('user_id', USER_ID)
  await supabase.from('daily_logs').delete().eq('user_id', USER_ID)
  console.log('   Done.\n')

  // 2. Insert cycles
  console.log('📅 Inserting cycles...')
  const cycleRows = CYCLES.map(({ start, end }) => ({
    user_id:    USER_ID,
    start_date: fmt(start),
    end_date:   fmt(end),
  }))

  const { error: cycleErr } = await supabase.from('cycles').insert(cycleRows)
  if (cycleErr) {
    console.error('❌ Cycle insert error:', cycleErr.message)
    process.exit(1)
  }
  console.log(`   ✓ Inserted ${cycleRows.length} cycles`)
  cycleRows.forEach(c => console.log(`     ${c.start_date} → ${c.end_date}`))
  console.log()

  // 3. Insert daily logs
  console.log('📝 Inserting daily logs...')
  const logRows = []

  for (const { start, end, periodLen } of CYCLES) {
    const cycleStart = new Date(start)

    for (let day = 0; day < 28; day++) {
      const date     = addDays(cycleStart, day)
      const dateStr  = fmt(date)
      const isPeriod = day < periodLen
      const isPMS    = day >= 20 && day < periodLen + 28  // last week of cycle
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
        symptoms = Math.random() > 0.5 ? OVULATION_SYMPTOMS : []
        mood     = pick(['😊', '😐'])
      } else {
        // Normal days — log ~60% of the time
        if (Math.random() < 0.6) {
          mood = pick(['😊', '😊', '😐'])
          symptoms = []
        } else {
          continue  // Skip some days (realistic — no one logs every day)
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

  // Upsert by (user_id, date) to handle any existing rows safely
  const { error: logErr } = await supabase
    .from('daily_logs')
    .upsert(logRows, { onConflict: 'user_id,date' })

  if (logErr) {
    console.error('❌ Daily log insert error:', logErr.message)
    process.exit(1)
  }
  console.log(`   ✓ Inserted ${logRows.length} daily log entries\n`)

  // 4. Summary
  console.log('✅ Seeding complete!\n')
  console.log('📊 Summary:')
  console.log(`   Cycles seeded:    ${CYCLES.length}`)
  console.log(`   Daily logs:       ${logRows.length}`)
  console.log(`   First cycle:      ${fmt(CYCLES[0].start)}`)
  console.log(`   Last cycle:       ${fmt(CYCLES[CYCLES.length - 1].start)}`)

  const lastStart   = CYCLES[CYCLES.length - 1].start
  const avgLen      = Math.round(CYCLE_LENGTHS.reduce((a,b)=>a+b,0) / CYCLE_LENGTHS.length)
  const nextPeriod  = addDays(lastStart, avgLen)
  console.log(`   Predicted next:   ${fmt(nextPeriod)} (avg ${avgLen}-day cycle)`)
  console.log('\n🌸 Open http://localhost:3000 to see the live data!')
}

seed().catch(err => {
  console.error('Fatal error:', err)
  process.exit(1)
})
