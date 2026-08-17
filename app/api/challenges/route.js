import { jsonSuccess, jsonError } from '@/lib/api-helpers'
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
    return jsonError('Too many requests, please slow down.', 429)
  }

  try {
    const userId = await getAuthUserId()
    if (!userId) {
      logger.warn('Unauthenticated access attempt to GET /api/challenges')
      return jsonError('Unauthorized', 401)
    }
    await ensureUserExists(userId)

    const today = resolveRequestDay(request)
    const supabaseAdmin = getSupabaseAdmin()

    const { data: todayProgress, error: progressError } = await supabaseAdmin
      .from('challenge_progress')
      .select('*')
      .eq('user_id', userId)
      .eq('date', today)

    if (progressError) {
      logger.error(`Database error fetching challenge progress for user ${userId}:`, progressError.message)
      return jsonError(progressError.message, 500)
    }

    const { data: badges, error: badgesError } = await supabaseAdmin
      .from('user_badges')
      .select('badge_key, earned_at')
      .eq('user_id', userId)

    if (badgesError) {
      logger.error(`Database error fetching badges for user ${userId}:`, badgesError.message)
      return jsonError(badgesError.message, 500)
    }

    logger.info(`Successfully fetched challenges for user ${userId}`)
    return jsonSuccess({
      challenges: CHALLENGES,
      progress: todayProgress || [],
      badges: badges || [],
    })
  } catch (error) {
    logger.error('Error fetching challenges:', error.message || error)
    return jsonError(`Failed to fetch challenges: ${error.message || error}`, 500)
  }
}