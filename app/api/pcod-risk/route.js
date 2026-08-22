import { NextResponse } from 'next/server'
import crypto from 'crypto'
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
    
    // Generate ETag for conditional request validation
    const clientEtag = request.headers.get('if-none-match');

    if (cachedRisk !== undefined) {
      const payloadString = JSON.stringify({ success: true, data: cachedRisk });
      const currentEtag = `"${crypto.createHash('md5').update(payloadString).digest('hex')}"`;

      if (clientEtag === currentEtag) {
        return new NextResponse(null, { status: 304 });
      }

      logger.info(`Cache hit for PCOD risk assessment for user ${userId}`);
      return NextResponse.json(
        { success: true, data: cachedRisk },
        {
          status: 200,
          headers: {
            'Cache-Control': 'private, max-age=120, stale-while-revalidate=300',
            'ETag': currentEtag,
          },
        }
      )
    }

    const supabaseAdmin = getSupabaseAdmin()
    const { data: cycles, error: cyclesError } = await supabaseAdmin
      .from('cycles')
      .select('*')
      .eq('user_id', userId)
      .order('start_date', { ascending: false })
      .limit(12)

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

    if (!risk) {
      logger.error(`PCOD risk calculation returned an unusable result for user ${userId}`);
      return NextResponse.json(
        riskUnavailable(RISK_UNAVAILABLE_REASONS.BACKEND),
        { status: 503 }
      )
    }

    // Only a real computation is cached.
    pcodRiskCache.set(cacheKey, risk);

    const responsePayload = { success: true, data: risk };
    const payloadString = JSON.stringify(responsePayload);
    const responseEtag = `"${crypto.createHash('md5').update(payloadString).digest('hex')}"`;

    if (clientEtag === responseEtag) {
      return new NextResponse(null, { status: 304 });
    }

    logger.info(`Successfully calculated PCOD risk assessment for user ${userId}`);
    return NextResponse.json(
      responsePayload,
      {
        status: 200,
        headers: {
          'Cache-Control': 'private, max-age=120, stale-while-revalidate=300',
          'ETag': responseEtag,
        },
      }
    )
  } catch (error) {
    logger.error('Error calculating PCOD risk:', error.message || error)
    return NextResponse.json(
      riskUnavailable(RISK_UNAVAILABLE_REASONS.BACKEND),
      { status: 503 }
    )
  }
}
