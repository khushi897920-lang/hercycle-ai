import { NextResponse } from 'next/server'
import { predictNextPeriod } from '@/lib/api-helpers'
import { getAuthUserId } from '@/lib/clerk-server'
import { getSupabaseAdmin } from '@/lib/supabase-admin'
import { aiLimiter, getRateLimitIdentifier } from '@/lib/rateLimiter'

export async function POST(request) {
  // ============ RATE LIMITING (NEW CODE) ============
  try {
    const identifier = await getRateLimitIdentifier(request);
    await aiLimiter.check(5, identifier); // 5 requests per minute
  } catch (rateLimitError) {
    console.warn(`[Rate Limit] Predict cycle endpoint: ${rateLimitError.message}`);
    return NextResponse.json(
      { 
        success: false, 
        error: 'Too many requests, please slow down. Cycle prediction is rate limited.' 
      },
      { status: 429 }
    );
  }
  // ==================================================

  try {
    const userId = await getAuthUserId()
    if (!userId) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    const supabaseAdmin = getSupabaseAdmin()
    const { data: cycles } = await supabaseAdmin
      .from('cycles')
      .select('*')
      .eq('user_id', userId)
      .order('start_date', { ascending: false })
      .limit(12)

    const prediction = predictNextPeriod(cycles || [])
    return NextResponse.json({ success: true, prediction })
  } catch (error) {
    console.error('Error predicting cycle:', error)
    return NextResponse.json({ success: false, error: `Failed to predict cycle: ${error.message || error}` }, { status: 500 })
  }
}
