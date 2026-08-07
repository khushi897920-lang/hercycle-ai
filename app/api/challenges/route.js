import { NextResponse } from 'next/server'
import { getAuthUserId, ensureUserExists } from '@/lib/clerk-server'
import { getSupabaseAdmin } from '@/lib/supabase-admin'
import { crudLimiter } from '@/lib/rateLimiter'
import { logger } from '@/lib/logger'
import { CHALLENGES } from '@/lib/challenges-data'
import { resolveRequestDay } from '@/lib/request-day'

// GET /api/challenges — today's progress + earned badges
export async function GET(request) {
  try {
    await crudLimiter.check(request)
  } catch (rateLimitError) {
    console.warn(`[Rate Limit] Challenges GET endpoint: ${rateLimitError.message}`)
    return NextResponse.json({ success: false, message: 'Too many requests, please slow down.' }, { status: 429 })
  }

  try {
    const userId = await getAuthUserId()
    if (!userId) {
      logger.warn('Unauthenticated access attempt to GET /api/challenges')
      return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 })
    }
    await ensureUserExists(userId)

    // The caller's calendar day, not the server's UTC one — otherwise a user
    // in UTC+5:30 opening this page at 02:00 is shown yesterday's progress.
    const today = resolveRequestDay(request)
    const supabaseAdmin = getSupabaseAdmin()

    const { data: todayProgress, error: progressError } = await supabaseAdmin
      .from('challenge_progress')
      .select('*')
      .eq('user_id', userId)
      .eq('date', today)

    if (progressError) {
      logger.error(`Database error fetching challenge progress for user ${userId}:`, progressError.message)
      return NextResponse.json({ success: false, message: progressError.message }, { status: 500 })
    }

    const { data: badges, error: badgesError } = await supabaseAdmin
      .from('user_badges')
      .select('badge_key, earned_at')
      .eq('user_id', userId)

    if (badgesError) {
      logger.error(`Database error fetching badges for user ${userId}:`, badgesError.message)
      return NextResponse.json({ success: false, message: badgesError.message }, { status: 500 })
    }

    logger.info(`Successfully fetched challenges for user ${userId}`)
    return NextResponse.json({
      success: true,
      data: {
        challenges: CHALLENGES,
        progress: todayProgress || [],
        badges: badges || [],
      },
    })
  } catch (error) {
    logger.error('Error fetching challenges:', error.message || error)
    return NextResponse.json({ success: false, message: `Failed to fetch challenges: ${error.message || error}` }, { status: 500 })
  }
}