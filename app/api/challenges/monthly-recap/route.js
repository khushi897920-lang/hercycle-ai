import { NextResponse } from 'next/server'
import { getAuthUserId, ensureUserExists } from '@/lib/clerk-server'
import { getSupabaseAdmin } from '@/lib/supabase-admin'
import { crudLimiter } from '@/lib/rateLimiter'
import { logger } from '@/lib/logger'
import { CHALLENGES, MONTHLY_BADGES, getMonthKey } from '@/lib/challenges-data'
import { resolveRequestDay, startOfMonthISO } from '@/lib/request-day'
import { parseDateValue } from '@/lib/date-utils'
import { calculateBestStreak } from '@/lib/challenge-streaks'

export async function GET(request) {
  try {
    await crudLimiter.check(request)
  } catch (rateLimitError) {
    return NextResponse.json({ success: false, message: 'Too many requests, please slow down.' }, { status: 429 })
  }

  try {
    const userId = await getAuthUserId()
    if (!userId) return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 })
    await ensureUserExists(userId)

    // Anchor the month to the caller's calendar day.
    //
    // `new Date(y, m, 1).toISOString().slice(0, 10)` built local midnight on
    // the 1st and then read its **UTC** day. East of UTC that instant is still
    // the last day of the *previous* month, so the recap silently widened its
    // window to include a day belonging to the month before.
    const today = resolveRequestDay(request)
    const monthKey = getMonthKey(parseDateValue(today) || new Date())
    const firstOfMonth = startOfMonthISO(today)
    const supabaseAdmin = getSupabaseAdmin()

    const { data: monthRows, error } = await supabaseAdmin
      .from('challenge_progress')
      .select('challenge_type, date, completed')
      .eq('user_id', userId)
      .eq('completed', true)
      .gte('date', firstOfMonth)

    if (error) {
      logger.error(`Database error fetching monthly recap for user ${userId}:`, error.message)
      return NextResponse.json({ success: false, message: error.message }, { status: 500 })
    }

    const rows = monthRows || []
    const points = rows.reduce((sum, r) => sum + (CHALLENGES[r.challenge_type]?.points || 0), 0)
    const activeDays = new Set(rows.map((r) => r.date)).size
    const stats = {
      totalCompletions: rows.length,
      waterCompletions: rows.filter((r) => r.challenge_type === 'water').length,
      bestStreak: calculateBestStreak(rows),
    }

    const { data: existingBadges } = await supabaseAdmin
      .from('user_badges')
      .select('badge_key')
      .eq('user_id', userId)
      .like('badge_key', `%_${monthKey}`)

    const earnedThisMonth = new Set((existingBadges || []).map((b) => b.badge_key))
    const toAward = Object.entries(MONTHLY_BADGES)
      .filter(([key, badge]) => !earnedThisMonth.has(`${key}_${monthKey}`) && badge.check(stats))
      .map(([key]) => `${key}_${monthKey}`)

    if (toAward.length > 0) {
      await supabaseAdmin.from('user_badges').insert(toAward.map((badge_key) => ({ user_id: userId, badge_key })))
    }

    logger.info(`Fetched monthly recap for user ${userId}, month ${monthKey}`)
    return NextResponse.json({
      success: true,
      data: { monthKey, points, activeDays, totalCompletions: rows.length, badges: [...earnedThisMonth, ...toAward] },
    })
  } catch (err) {
    logger.error('Error fetching monthly recap:', err.message || err)
    return NextResponse.json({ success: false, message: `Internal Server Error: ${err.message || err}` }, { status: 500 })
  }
}

