import { NextResponse } from 'next/server'
import { calculatePCODRisk } from '@/lib/api-helpers'
import { getAuthUserId } from '@/lib/clerk-server'
import { getSupabaseAdmin } from '@/lib/supabase-admin'
import { aiLimiter, getRateLimitIdentifier } from '@/lib/rateLimiter'
import { logger } from '@/lib/logger'
import { pcodRiskCache } from '@/lib/cache'
import {
  RISK_UNAVAILABLE_REASONS,
  normaliseRiskResult,
  riskUnavailable,
} from '@/lib/pcod-risk-result'


export async function GET(request) {
  // ============ RATE LIMITING ============
  try {
    const identifier = await getRateLimitIdentifier(request);
    await aiLimiter.check(request, identifier);
  } catch (rateLimitError) {
    console.warn(`[Rate Limit] PCOD risk endpoint: ${rateLimitError.message}`);
    return NextResponse.json(
      {
        success: false,
        error: 'Too many requests, please slow down. PCOD risk calculation is rate limited.'
      },
      { status: 429 }
    );
  }
  // =======================================

  try {
    const userId = await getAuthUserId()
    if (!userId) {
      logger.warn('Unauthenticated access attempt to GET /api/pcod-risk');
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    const cacheKey = `pcod-risk:${userId}`;
    const cachedRisk = pcodRiskCache.get(cacheKey);
    if (cachedRisk !== undefined) {
      logger.info(`Cache hit for PCOD risk assessment for user ${userId}`);
      return NextResponse.json({ success: true, data: cachedRisk })
    }

    const supabaseAdmin = getSupabaseAdmin()
    const { data: cycles, error: cyclesError } = await supabaseAdmin
      .from('cycles')
      .select('*')
      .eq('user_id', userId)
      .order('start_date', { ascending: false })
      .limit(12)

    // A failed query must not fall through. `cycles || []` reads as "no
    // history", and calculatePCODRisk answers "no history" with a score of 0 /
    // LOW RISK — so a transient database error used to be reported as a
    // genuine, reassuring assessment, and then cached for five minutes.
    if (cyclesError) {
      logger.error(`Database error fetching cycles for user ${userId} PCOD risk:`, cyclesError.message);
      return NextResponse.json(
        riskUnavailable(RISK_UNAVAILABLE_REASONS.BACKEND),
        { status: 503 }
      )
    }

    const { data: logs, error: logsError } = await supabaseAdmin
      .from('daily_logs')
      .select('date, symptoms')
      .eq('user_id', userId)
      .order('date', { ascending: false })
      .limit(90)

    if (logsError) {
      logger.error(`Database error fetching logs for user ${userId} PCOD risk:`, logsError.message);
      return NextResponse.json(
        riskUnavailable(RISK_UNAVAILABLE_REASONS.BACKEND),
        { status: 503 }
      )
    }

    const risk = normaliseRiskResult(await calculatePCODRisk(cycles || [], logs || []))

    // The ML microservice is allowed to answer instead of the rule-based
    // engine, so the shape is verified rather than assumed. An unrecognisable
    // payload is a failure, not a low-risk reading.
    if (!risk) {
      logger.error(`PCOD risk calculation returned an unusable result for user ${userId}`);
      return NextResponse.json(
        riskUnavailable(RISK_UNAVAILABLE_REASONS.BACKEND),
        { status: 503 }
      )
    }

    // Only a real computation is cached. Caching a failure would serve it back
    // without touching the database for the next five minutes.
    pcodRiskCache.set(cacheKey, risk);

    logger.info(`Successfully calculated PCOD risk assessment for user ${userId}`);
    return NextResponse.json({ success: true, data: risk })
  } catch (error) {
    // No fabricated `data` here. The previous implementation returned a
    // hard-coded score of 25 and the tier "LOW RISK" with HTTP 200, which the
    // UI could not distinguish from a real assessment.
    //
    // The exception text stays in the log rather than being echoed to the
    // client, where it leaked Postgres error strings and connection details.
    logger.error('Error calculating PCOD risk:', error.message || error)
    return NextResponse.json(
      riskUnavailable(RISK_UNAVAILABLE_REASONS.BACKEND),
      { status: 503 }
    )
  }
}
