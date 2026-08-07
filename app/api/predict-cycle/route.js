import { NextResponse } from 'next/server'
import { predictNextPeriod } from '@/lib/api-helpers'
import { getAuthUserId } from '@/lib/clerk-server'
import { getSupabaseAdmin } from '@/lib/supabase-admin'
import { aiLimiter, getRateLimitIdentifier } from '@/lib/rateLimiter'
import { logger } from '@/lib/logger'

export async function POST(request) {
  // ============ RATE LIMITING ============
  try {
    const identifier = await getRateLimitIdentifier(request);
    await aiLimiter.check(5, identifier);
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
  // =======================================

  try {
    const userId = await getAuthUserId()
    if (!userId) {
      logger.warn('Unauthenticated access attempt to POST /api/predict-cycle');
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
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

    // Gracefully handle new users / empty cycle history using default prediction baseline
    const cycleHistory = Array.isArray(cycles) ? cycles : []
    const prediction = await predictNextPeriod(cycleHistory)

    if (!cycleHistory.length) {
      logger.info(`New user or empty cycle history for user ${userId}; returned default baseline prediction`);
    } else {
      logger.info(`Successfully generated cycle prediction for user ${userId}`);
    }

    return NextResponse.json({ success: true, prediction })
  } catch (error) {
    logger.error('Error predicting cycle:', error.message || error)
    return NextResponse.json({ success: false, error: `Failed to predict cycle: ${error.message || error}` }, { status: 500 })
  }
}
