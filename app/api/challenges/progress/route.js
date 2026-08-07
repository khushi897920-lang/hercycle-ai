import { NextResponse } from 'next/server'
import { getAuthUserId, ensureUserExists } from '@/lib/clerk-server'
import { getSupabaseAdmin } from '@/lib/supabase-admin'
import { crudLimiter } from '@/lib/rateLimiter'
import { logger } from '@/lib/logger'
import { z } from 'zod'
import { CHALLENGES, BADGES } from '@/lib/challenges-data'
import { resolveRequestDay } from '@/lib/request-day'
import { calculateCurrentStreak } from '@/lib/challenge-streaks'

// const progressSchema = z.object({
//   challenge_type: z.enum(['water', 'stretch', 'mood']),
//   increment: z.number().int().positive().max(2000),
// })
const progressSchema = z.object({
  challenge_type: z.enum(['water', 'stretch', 'mood', 'iron', 'sleep']),
  increment: z.number().int().positive().max(2000),
})

export async function POST(request) {
  try {
    await crudLimiter.check(request)
  } catch (rateLimitError) {
    console.warn(`[Rate Limit] Challenges progress POST endpoint: ${rateLimitError.message}`)
    return NextResponse.json({ success: false, message: 'Too many requests, please slow down.' }, { status: 429 })
  }

  try {
    const userId = await getAuthUserId()
    if (!userId) {
      logger.warn('Unauthenticated access attempt to POST /api/challenges/progress')
      return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 })
    }
    await ensureUserExists(userId)

    const json = await request.json()
    const result = progressSchema.safeParse(json)
    if (!result.success) {
      logger.warn(`Malformed challenge progress payload from user ${userId}: ${result.error.message}`)
      return NextResponse.json({ success: false, message: 'Bad Request', details: result.error.errors }, { status: 400 })
    }

    const { challenge_type, increment } = result.data
    const target = CHALLENGES[challenge_type].target
    // The caller's calendar day. Recording against the server's UTC day meant a
    // user in UTC+5:30 logging at 02:00 wrote to yesterday's row — and if that
    // day was already complete, `Math.min(existing + increment, target)`
    // discarded the increment with no feedback at all.
    const today = resolveRequestDay(request)
    const supabaseAdmin = getSupabaseAdmin()

    const { data: existing, error: fetchError } = await supabaseAdmin
      .from('challenge_progress')
      .select('progress_value, completed')
      .eq('user_id', userId)
      .eq('date', today)
      .eq('challenge_type', challenge_type)
      .maybeSingle()

    if (fetchError) {
      logger.error(`Database error fetching existing progress for user ${userId}:`, fetchError.message)
      return NextResponse.json({ success: false, message: fetchError.message }, { status: 500 })
    }

    const newValue = Math.min((existing?.progress_value || 0) + increment, target)
    const justCompleted = !existing?.completed && newValue >= target

    const { error: upsertError } = await supabaseAdmin
      .from('challenge_progress')
      .upsert(
        {
          user_id: userId,
          date: today,
          challenge_type,
          progress_value: newValue,
          completed: newValue >= target,
          completed_at: justCompleted ? new Date().toISOString() : existing?.completed ? undefined : null,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'user_id,date,challenge_type' }
      )

    if (upsertError) {
      logger.error(`Database error upserting challenge progress for user ${userId}:`, upsertError.message)
      return NextResponse.json({ success: false, message: upsertError.message }, { status: 500 })
    }

    let newlyEarnedBadges = []
    if (justCompleted) {
      newlyEarnedBadges = await checkAndAwardBadges(supabaseAdmin, userId, today)
    }

    logger.info(`Successfully updated ${challenge_type} progress for user ${userId}`)
    return NextResponse.json({
      success: true,
      data: { progress_value: newValue, completed: newValue >= target, newBadges: newlyEarnedBadges },
    })
  } catch (error) {
    logger.error('Error updating challenge progress:', error.message || error)
    return NextResponse.json({ success: false, message: `Internal Server Error: ${error.message || error}` }, { status: 500 })
  }
}

async function checkAndAwardBadges(supabaseAdmin, userId, today) {
  const { data: allProgress } = await supabaseAdmin
    .from('challenge_progress')
    .select('challenge_type, completed, date')
    .eq('user_id', userId)
    .eq('completed', true)

  const stats = {
    totalCompletions: allProgress?.length || 0,
    waterCompletions: allProgress?.filter((p) => p.challenge_type === 'water').length || 0,
    streak: calculateCurrentStreak(allProgress || [], today),
  }

  const { data: existingBadges } = await supabaseAdmin.from('user_badges').select('badge_key').eq('user_id', userId)
  const earnedKeys = new Set((existingBadges || []).map((b) => b.badge_key))

  const toAward = Object.values(BADGES).filter((b) => !earnedKeys.has(b.key) && b.check(stats))
  if (toAward.length === 0) return []

  await supabaseAdmin.from('user_badges').insert(toAward.map((b) => ({ user_id: userId, badge_key: b.key })))
  return toAward.map((b) => b.key)
}

