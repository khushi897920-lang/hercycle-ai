import { validateEnv } from "@/lib/env";
import { jsonSuccess, jsonError } from '@/lib/api-helpers'
import { createClient } from '@supabase/supabase-js'
import { getAuthUserId } from '@/lib/clerk-server'
import { devLimiter, getRateLimitIdentifier } from '@/lib/rateLimiter'
import { logger } from '@/lib/logger'
import { toISODate } from '@/lib/date-utils'

const CYCLE_LENGTHS = [28, 27, 29, 28, 28, 27]
const PERIOD_LENGTHS = [5, 5, 6, 5, 6, 5]

const MOOD_LABELS = {
  SAD: '😢',
  NEUTRAL: '😐',
  HAPPY: '😊',
}

function addDays(date, n) {
  const d = new Date(date)
  d.setDate(d.getDate() + n)
  return d
}
function fmt(date) { return toISODate(date) }
function pick(arr) { return arr[Math.floor(Math.random() * arr.length)] }
function shuffle(arr) { return [...arr].sort(() => Math.random() - 0.5) }
function flowPattern(day, totalDays) {
  if (day === 0) return 'f1'
  if (day === 1 || day === 2) return 'f3'
  if (day === totalDays - 1) return 'f1'
  return 'f2'
}

function buildCycles() {
  const today = new Date();
  today.setHours(0, 0, 0, 0); // Normalize to midnight
  const cycles = [];
  const totalDays = CYCLE_LENGTHS.reduce((a, b) => a + b, 0);
  let cycleStart = new Date(today);
  cycleStart.setDate(cycleStart.getDate() - totalDays); // Start of oldest cycle
  for (let i = 0; i < CYCLE_LENGTHS.length; i++) {
    const cycleLen = CYCLE_LENGTHS[i];
    const periodLen = PERIOD_LENGTHS[i];
    const start = new Date(cycleStart);
    const end = new Date(start);
    end.setDate(end.getDate() + cycleLen - 1); // End of CYCLE
    cycles.push({ start, end, periodLen, cycleLen });
    cycleStart = new Date(end);
    cycleStart.setDate(cycleStart.getDate() + 1); // Next cycle starts day after this ends
  }
  return cycles; // Chronological: Oldest -> Newest
}

export const dynamic = 'force-dynamic'

// ──────────────────────────────────────────────
// ✅ EVERYTHING BELOW IS INSIDE THE GET FUNCTION
// ──────────────────────────────────────────────
export async function GET(request) {
  validateEnv();

  // ✅ FIX #5: REQUIRE SERVICE ROLE KEY (No Anon Fallback)
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceRoleKey) {
    logger.error('Missing SUPABASE_SERVICE_ROLE_KEY env var');
    return jsonError('Server config error: Missing Service Role Key', 500);
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    serviceRoleKey,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    }
  );

  // 1. Restrict to development only
  if (process.env.NODE_ENV === 'production') {
    logger.warn('Seed route invocation attempt in production blocked');
    return jsonError('Forbidden', 403)
  }

  // ============ RATE LIMITING ============
  try {
    const identifier = await getRateLimitIdentifier(request);
    await devLimiter.check(request); // 2 requests per minute
  } catch (rateLimitError) {
    console.warn(`[Rate Limit] Seed endpoint: ${rateLimitError.message}`);
    return jsonError('Too many requests. Seed route is heavily rate limited.', 429)
  }
  // =======================================

  // 2. Require Clerk authentication
  try {
    const userId = await getAuthUserId()
    if (!userId) {
      logger.warn('Unauthenticated access attempt to seed API');
      return jsonError('Unauthorized', 401)
    }

    const PERIOD_SYMPTOMS = ['Cramps', 'Bloating', 'Fatigue', 'Headache']
    const PMS_SYMPTOMS = ['Bloating', 'Headache', 'Acne', 'Fatigue']
    const OVUL_SYMPTOMS = ['Fatigue']

    // 0. Ensure user exists (No-op: user_id is text type and does not reference auth.users due to Clerk migration)

    // 1. Clear existing data FOR THIS USER
    logger.info(`Seeding DB: clearing existing data for user ${userId}`);
    await supabase.from('daily_logs').delete().eq('user_id', userId)
    await supabase.from('cycles').delete().eq('user_id', userId)

    const cycles = buildCycles()

    // 2. Insert cycles FOR THIS USER
    const cycleRows = cycles.map(({ start, end }) => ({
      user_id: userId,
      start_date: fmt(start),
      end_date: fmt(end),
    }))

    const { error: cycleErr } = await supabase.from('cycles').insert(cycleRows)
    if (cycleErr) {
      logger.error('Seeding DB: Cycles insertion error:', cycleErr.message);
      return jsonError(`Cycles: ${cycleErr.message}`, 500)
    }

    // 3. Build daily logs
    const logRows = []
    for (const { start, periodLen, cycleLen } of cycles) {
      const cycleStart = new Date(start)
      for (let day = 0; day < cycleLen; day++) {
        const date = addDays(cycleStart, day)
        const dateStr = fmt(date)
        
        // ✅ FIX #7: Dynamic Phase Calculation (based on cycleLen)
        const ovulationDay = Math.round(cycleLen / 2)
        const isPeriod = day < periodLen
        const isOvul = day === ovulationDay || day === ovulationDay + 1
        const isPMS = day >= cycleLen - 7 // Last 7 days

        let symptoms = []
        let mood = null
        let flow = null

        if (isPeriod) {
          symptoms = shuffle(PERIOD_SYMPTOMS).slice(0, Math.floor(Math.random() * 3) + 1)
          mood = day <= 2 ? MOOD_LABELS.SAD : pick([MOOD_LABELS.NEUTRAL, MOOD_LABELS.HAPPY])
          flow = flowPattern(day, periodLen)
        } else if (isPMS) {
          symptoms = shuffle(PMS_SYMPTOMS).slice(0, 2)
          mood = pick([MOOD_LABELS.NEUTRAL, MOOD_LABELS.SAD])
        } else if (isOvul) {
          symptoms = Math.random() > 0.5 ? OVUL_SYMPTOMS : []
          mood = pick([MOOD_LABELS.HAPPY, MOOD_LABELS.NEUTRAL])
        } else {
          if (Math.random() < 0.6) {
            mood = pick([MOOD_LABELS.HAPPY, MOOD_LABELS.HAPPY, MOOD_LABELS.NEUTRAL])
          } else {
            continue
          }
        }

        logRows.push({
          user_id: userId,
          date: dateStr,
          symptoms: symptoms.length ? symptoms : null,
          mood,
          mood,
          flow,
        })
      }
    }

    const { error: logErr } = await supabase
      .from('daily_logs')
      .upsert(logRows, { onConflict: 'user_id,date' })

    if (logErr) {
      logger.error('Seeding DB: Logs insertion error:', logErr.message);
      return jsonError(`Logs: ${logErr.message}`, 500)
    }

    const avgLen = Math.round(CYCLE_LENGTHS.reduce((a, b) => a + b) / CYCLE_LENGTHS.length)
    const lastCycle = cycles[cycles.length - 1]
    const nextPeriod = addDays(lastCycle.start, avgLen)

    logger.info(`Seeding DB: seeding complete successfully for user ${userId}`);
    return jsonSuccess({
      summary: {
        cycles: cycles.length,
        dailyLogs: logRows.length,
        firstCycle: fmt(cycles[0].start),
        lastCycle: fmt(lastCycle.start),
        nextPeriod: fmt(nextPeriod),
        avgCycleLen: avgLen,
      }
    }, `✅ Seeded ${cycles.length} cycles and ${logRows.length} daily logs for user ${userId}`)
  } catch (err) {
    logger.error('Seeding DB: unexpected error:', err.message || err);
    return jsonError(err.message, 500)
  }
}