import { NextResponse } from 'next/server'
import { getAuthUserId, ensureUserExists } from '@/lib/clerk-server'
import { getSupabaseAdmin } from '@/lib/supabase-admin'
import { crudLimiter } from '@/lib/rateLimiter'
import { logger } from '@/lib/logger'

// GET /api/challenges/heatmap — completion counts per day for the last 30 days
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

    const supabaseAdmin = getSupabaseAdmin()
    const thirtyDaysAgo = new Date()
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 29)
    const startDate = thirtyDaysAgo.toISOString().slice(0, 10)

    const { data: rows, error } = await supabaseAdmin
      .from('challenge_progress')
      .select('date, completed')
      .eq('user_id', userId)
      .eq('completed', true)
      .gte('date', startDate)

    if (error) {
      logger.error(`Database error fetching heatmap for user ${userId}:`, error.message)
      return NextResponse.json({ success: false, message: error.message }, { status: 500 })
    }

    const counts = {}
    for (const row of rows || []) {
      counts[row.date] = (counts[row.date] || 0) + 1
    }

    logger.info(`Fetched heatmap data for user ${userId}`)
    return NextResponse.json({ success: true, data: { counts, startDate } })
  } catch (err) {
    logger.error('Error fetching heatmap:', err.message || err)
    return NextResponse.json({ success: false, message: `Internal Server Error: ${err.message || err}` }, { status: 500 })
  }
}