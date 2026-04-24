// seed.js — HerCycle AI demo data seeder
// Run with: node seed.js
//
// Actual Supabase schema (verified by introspection):
//   cycles     (id, user_id UUID, start_date, end_date, cycle_length, is_predicted, created_at, updated_at)
//   daily_logs (id, user_id UUID, date, symptoms TEXT[], mood, flow, notes, created_at, updated_at)

const { createClient } = require('@supabase/supabase-js')
require('dotenv').config()

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('❌  Missing SUPABASE_URL / SUPABASE_KEY in environment.')
  process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY)

// UUID used across all /api/* routes for the demo user
const USER_ID = '00000000-0000-0000-0000-000000000001'

// ── Helpers ───────────────────────────────────────────────────────────────────

const addDays = (date, n) => {
  const d = new Date(date)
  d.setDate(d.getDate() + n)
  return d
}
const toISO   = (date) => date.toISOString().split('T')[0]
const pick    = (arr)  => arr[Math.floor(Math.random() * arr.length)]
const randInt = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min

// ── 1. Cycles — 6 months Oct 2025 → Mar 2026 ─────────────────────────────────

const CYCLE_LENGTHS  = [27, 29, 28, 32, 26, 28]
const PERIOD_LENGTHS = [4,  5,  5,  6,  4,  5]

const cycleRows = []
let currentStart = new Date('2025-10-05')

for (let i = 0; i < 6; i++) {
  const endDate = addDays(currentStart, PERIOD_LENGTHS[i] - 1)
  cycleRows.push({
    user_id:      USER_ID,
    start_date:   toISO(currentStart),
    end_date:     toISO(endDate),
    cycle_length: CYCLE_LENGTHS[i],
    is_predicted: false,
  })
  currentStart = addDays(currentStart, CYCLE_LENGTHS[i])
}

// ── 2. Daily logs — 20 entries spread across cycle history ───────────────────

const ALL_SYMPTOMS   = ['cramps', 'bloating', 'fatigue', 'headache', 'acne', 'nausea', 'backache', 'mood swings']
const MOODS          = ['happy', 'sad', 'neutral', 'angry', 'anxious', 'calm']
const FLOW_OPTIONS   = ['light', 'medium', 'heavy', 'very_heavy']

const logRows   = []
const usedDates = new Set()

for (const cycle of cycleRows) {
  const base  = new Date(cycle.start_date)
  const count = randInt(2, 4)

  for (let d = 0; d < count; d++) {
    let candidateDate
    let tries = 0
    do {
      candidateDate = toISO(addDays(base, randInt(0, 7)))
      tries++
    } while (usedDates.has(candidateDate) && tries < 15)

    if (usedDates.has(candidateDate)) continue
    usedDates.add(candidateDate)

    const pool     = [...ALL_SYMPTOMS]
    const symptoms = []
    for (let s = 0; s < randInt(1, 3); s++) {
      symptoms.push(pool.splice(Math.floor(Math.random() * pool.length), 1)[0])
    }

    logRows.push({
      user_id:  USER_ID,
      date:     candidateDate,
      symptoms,
      mood:     pick(MOODS),
      flow:     d === 0 ? pick(['medium', 'heavy']) : pick(FLOW_OPTIONS),
    })
  }
}

// Pad to 20 if short
while (logRows.length < 20) {
  const base      = new Date(cycleRows[randInt(0, cycleRows.length - 1)].start_date)
  const candidate = toISO(addDays(base, randInt(8, 25)))
  if (usedDates.has(candidate)) continue
  usedDates.add(candidate)
  logRows.push({
    user_id:  USER_ID,
    date:     candidate,
    symptoms: [pick(ALL_SYMPTOMS)],
    mood:     pick(MOODS),
    flow:     'light',
  })
}

// ── 3. Insert into Supabase ───────────────────────────────────────────────────

async function seed() {
  console.log('\n🌸  HerCycle AI — Seeding demo data\n')

  // Cycles
  console.log(`📅  Inserting ${cycleRows.length} cycles …`)
  const { error: cyErr } = await supabase
    .from('cycles')
    .upsert(cycleRows, { onConflict: 'user_id,start_date', ignoreDuplicates: true })

  if (cyErr) {
    console.warn('   upsert failed, trying plain insert row-by-row …', cyErr.message)
    for (const row of cycleRows) {
      const { error } = await supabase.from('cycles').insert(row)
      if (error && !error.message.toLowerCase().includes('duplicate')) {
        console.error('   ❌', error.message, '| row:', row.start_date)
      }
    }
  }
  console.log('✅  cycles done')

  // Daily logs
  console.log(`\n📝  Inserting ${logRows.length} daily logs …`)
  const { error: lgErr } = await supabase
    .from('daily_logs')
    .upsert(logRows, { onConflict: 'user_id,date', ignoreDuplicates: true })

  if (lgErr) {
    console.warn('   upsert failed, trying plain insert row-by-row …', lgErr.message)
    for (const row of logRows) {
      const { error } = await supabase.from('daily_logs').insert(row)
      if (error && !error.message.toLowerCase().includes('duplicate')) {
        console.error('   ❌', error.message, '| row:', row.date)
      }
    }
  }
  console.log('✅  daily_logs done')

  // Summary
  console.log('\n🎉  Seeding complete!\n')
  console.log('Cycles inserted:')
  cycleRows.forEach((c, i) =>
    console.log(`  ${i + 1}. ${c.start_date} → ${c.end_date}  (${c.cycle_length}d cycle)`)
  )
  console.log('\nSample daily logs:')
  logRows.slice(0, 6).forEach(l =>
    console.log(`  ${l.date}  mood:${l.mood}  flow:${l.flow}  symptoms:[${l.symptoms.join(', ')}]`)
  )
}

seed().catch((err) => {
  console.error('Unexpected error:', err)
  process.exit(1)
})
