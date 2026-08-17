import { jsonSuccess, jsonError } from '@/lib/api-helpers'
import { getAuthUserId, ensureUserExists } from '@/lib/clerk-server'
import { getSupabaseAdmin } from '@/lib/supabase-admin'
import { crudLimiter } from '@/lib/rateLimiter'
import { logger } from '@/lib/logger'
import { resolveRequestDay } from '@/lib/request-day'
import { addDaysISO } from '@/lib/date-utils'

// GET /api/challenges/heatmap — completion counts per day for the last 30 days
export async function GET(request) {
  try {
    await crudLimiter.check(request)
  } catch (rateLimitError) {
    return jsonError('Too many requests, please slow down.', 429)
  }

  try {
    const userId = await getAuthUserId()
    if (!userId) return jsonError('Unauthorized', 401)
    await ensureUserExists(userId)

    const supabaseAdmin = getSupabaseAdmin()
    const today = resolveRequestDay(request)
    const startDate = addDaysISO(today, -29)

    const { data: rows, error } = await supabaseAdmin
      .from('challenge_progress')
      .select('date, completed')
      .eq('user_id', userId)
      .eq('completed', true)
      .gte('date', startDate)

    if (error) {
      logger.error(`Database error fetching heatmap for user ${userId}:`, error.message)
      return jsonError(error.message, 500)
    }

    const counts = {}
    for (const row of rows || []) {
      counts[row.date] = (counts[row.date] || 0) + 1
    }

    logger.info(`Fetched heatmap data for user ${userId}`)
    return jsonSuccess({ counts, startDate, endDate: today })
  } catch (err) {
    logger.error('Error fetching heatmap:', err.message || err)
    return jsonError(`Internal Server Error: ${err.message || err}`, 500)
  }
}