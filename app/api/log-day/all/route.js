import { NextResponse } from 'next/server'
import { getAuthUserId } from '@/lib/clerk-server'
import { getSupabaseAdmin } from '@/lib/supabase-admin'
import { logger } from '@/lib/logger'

// GET /api/log-day/all — fetch all daily logs for the user (used by Insights page)
export async function GET() {
  try {
    const userId = await getAuthUserId()
    if (!userId) {
      logger.warn('Unauthenticated access attempt to GET /api/log-day/all');
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    const supabaseAdmin = getSupabaseAdmin()
    const { data, error } = await supabaseAdmin
      .from('daily_logs')
      .select('*')
      .eq('user_id', userId)
      .order('date', { ascending: false })

    if (error) {
      logger.error(`Database error fetching all daily logs for user ${userId}:`, error.message);
      return NextResponse.json({ success: false, error: error.message }, { status: 500 })
    }

    logger.info(`Successfully fetched all daily logs for user ${userId}`);
    return NextResponse.json({ success: true, data: data || [] })
  } catch (error) {
    logger.error('Error fetching all logs:', error.message || error);
    return NextResponse.json({ success: false, error: `Failed to fetch all logs: ${error.message || error}` }, { status: 500 })
  }
}
