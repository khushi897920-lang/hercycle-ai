

import { NextResponse } from 'next/server'
import { getAuthUserId } from '@/lib/clerk-server'
import { getSupabaseAdmin } from '@/lib/supabase-admin'
import { crudLimiter } from '@/lib/rateLimiter'
import { logger } from '@/lib/logger'

const DEFAULT_LIMIT = 100
const MAX_LIMIT = 365

// GET /api/log-day/all?page=0&limit=100 — fetch paginated daily logs for the user
export async function GET(request) {
  // ============ RATE LIMITING ============
  try {
    await crudLimiter.check(request);
  } catch (rateLimitError) {
    console.warn(`[Rate Limit] Log-day/all endpoint: ${rateLimitError.message}`);
    return NextResponse.json(
      { success: false, message: 'Too many requests, please slow down.' },
      { status: 429 }
    );
  }
  // =======================================

  try {
    const userId = await getAuthUserId()
    if (!userId) {
      logger.warn('Unauthenticated access attempt to GET /api/log-day/all');
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    // Parse pagination params
    const { searchParams } = new URL(request.url)
    const page  = Math.max(0, parseInt(searchParams.get('page')  || '0', 10))
    const limit = Math.min(MAX_LIMIT, Math.max(1, parseInt(searchParams.get('limit') || String(DEFAULT_LIMIT), 10)))
    const from  = page * limit
    const to    = from + limit - 1

    const supabaseAdmin = getSupabaseAdmin()
    const { data, error, count } = await supabaseAdmin
      .from('daily_logs')
      .select('*', { count: 'exact' })
      .eq('user_id', userId)
      .order('date', { ascending: false })
      .range(from, to)

    if (error) {
      logger.error(`Database error fetching daily logs for user ${userId}:`, error.message);
      return NextResponse.json({ success: false, error: error.message }, { status: 500 })
    }

    logger.info(`Successfully fetched daily logs (page=${page}, limit=${limit}) for user ${userId}`);
    return NextResponse.json({
      success: true,
      data: data || [],
      pagination: {
        page,
        limit,
        total: count ?? null,
        hasMore: count != null ? from + limit < count : (data || []).length === limit,
      },
    })
  } catch (error) {
    logger.error('Error fetching all logs:', error.message || error);
    return NextResponse.json({ success: false, error: `Failed to fetch all logs: ${error.message || error}` }, { status: 500 })
  }
}
