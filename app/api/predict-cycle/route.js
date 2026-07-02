import { NextResponse } from 'next/server'
import { predictNextPeriod } from '@/lib/api-helpers'
import { getAuthUserId } from '@/lib/clerk-server'
import { getSupabaseAdmin } from '@/lib/supabase-admin'
import { isAllowed } from '@/lib/rate-limiter'
import { logger } from '@/lib/logger'

export async function POST() {
  try {
    const userId = await getAuthUserId()
    if (!userId) {
      logger.warn('Unauthenticated access attempt to POST /api/predict-cycle');
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    // Rate Limiting (20 requests/minute)
    if (!isAllowed(userId, 'predict_cycle', 20)) {
      logger.warn(`Rate limit exceeded for user ${userId} on POST /api/predict-cycle`);
      return NextResponse.json({ success: false, error: 'Too Many Requests' }, { status: 429 })
    }

    const supabaseAdmin = getSupabaseAdmin()
    const { data: cycles, error } = await supabaseAdmin
      .from('cycles')
      .select('*')
      .eq('user_id', userId)
      .order('start_date', { ascending: false })
      .limit(12)

    if (error) {
      logger.error(`Database error fetching cycles for prediction for user ${userId}:`, error.message);
      return NextResponse.json({ success: false, error: error.message }, { status: 500 })
    }

    const prediction = predictNextPeriod(cycles || [])
    logger.info(`Successfully generated cycle prediction for user ${userId}`);
    return NextResponse.json({ success: true, prediction })
  } catch (error) {
    logger.error('Error predicting cycle:', error.message || error)
    return NextResponse.json({ success: false, error: `Failed to predict cycle: ${error.message || error}` }, { status: 500 })
  }
}
