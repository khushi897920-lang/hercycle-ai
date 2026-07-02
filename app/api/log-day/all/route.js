import { NextResponse } from 'next/server'
import { getAuthUserId } from '@/lib/clerk-server'
import { getSupabaseAdmin } from '@/lib/supabase-admin'
import { crudLimiter, getRateLimitIdentifier } from '@/lib/rateLimiter'

// GET /api/log-day/all — fetch all daily logs for the user (used by Insights page)
export async function GET(request) {
  // ============ RATE LIMITING (NEW CODE) ============
  try {
    const identifier = await getRateLimitIdentifier(request);
    await crudLimiter.check(20, identifier); // 20 requests per minute
  } catch (rateLimitError) {
    console.warn(`[Rate Limit] Log-day/all endpoint: ${rateLimitError.message}`);
    return NextResponse.json(
      { success: false, message: 'Too many requests, please slow down.' },
      { status: 429 }
    );
  }
  // ==================================================

  try {
    const userId = await getAuthUserId()
    if (!userId) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })

    const supabaseAdmin = getSupabaseAdmin()
    const { data, error } = await supabaseAdmin
      .from('daily_logs')
      .select('*')
      .eq('user_id', userId)
      .order('date', { ascending: false })

    if (error) {
      console.error('Error fetching logs:', error)
      return NextResponse.json({ success: false, error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true, data: data || [] })
  } catch (error) {
    console.error('Error fetching all logs:', error)
    return NextResponse.json({ success: false, error: `Failed to fetch all logs: ${error.message || error}` }, { status: 500 })
  }
}
