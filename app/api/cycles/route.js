import { NextResponse } from 'next/server'
import { predictNextPeriod } from '@/lib/api-helpers'
import { getAuthUserId } from '@/lib/clerk-server'
import { getSupabaseAdmin } from '@/lib/supabase-admin'
import { isAllowed } from '@/lib/rate-limiter'
import { logger } from '@/lib/logger'
import { z } from 'zod'

const cyclePostSchema = z.object({
  start_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Must be in YYYY-MM-DD format'),
  end_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Must be in YYYY-MM-DD format').optional().nullable(),
  cycle_length: z.number().int().min(21).max(45).optional().nullable()
})

const cyclePatchSchema = z.object({
  id: z.string().uuid('Must be a valid UUID'),
  end_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Must be in YYYY-MM-DD format')
})

export async function GET() {
  try {
    const userId = await getAuthUserId()
    if (!userId) {
      logger.warn('Unauthenticated access attempt to GET /api/cycles');
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    const supabaseAdmin = getSupabaseAdmin()
    const { data: cycles, error } = await supabaseAdmin
      .from('cycles')
      .select('*')
      .eq('user_id', userId)
      .order('start_date', { ascending: false })
      .limit(12)

    if (error && error.code !== 'PGRST116') {
      logger.error(`Error querying cycles for user ${userId}:`, error.message);
      return NextResponse.json({ success: true, data: { cycles: [], nextPeriodDate: null, confidence: null, averageCycleLength: 28 } })
    }

    const prediction = predictNextPeriod(cycles || [])
    logger.info(`Successfully fetched cycles and calculated predictions for user ${userId}`);
    return NextResponse.json({ success: true, data: { cycles: cycles || [], nextPeriodDate: prediction.nextPeriodDate, confidence: prediction.confidence, averageCycleLength: prediction.averageCycleLength } })
  } catch (error) {
    logger.error('Error fetching cycles:', error.message || error);
    return NextResponse.json({ success: false, error: `Failed to fetch cycles: ${error.message || error}` }, { status: 500 })
  }
}

export async function POST(request) {
  try {
    const userId = await getAuthUserId()
    if (!userId) {
      logger.warn('Unauthenticated access attempt to POST /api/cycles');
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    // Rate Limiting (30 requests/minute)
    if (!isAllowed(userId, 'cycles_write', 30)) {
      logger.warn(`Rate limit exceeded for user ${userId} on POST /api/cycles`);
      return NextResponse.json({ success: false, error: 'Too Many Requests' }, { status: 429 })
    }

    // Payload Validation
    const json = await request.json()
    const result = cyclePostSchema.safeParse(json)
    if (!result.success) {
      logger.warn(`Malformed cycle insertion payload from user ${userId}: ${result.error.message}`);
      return NextResponse.json({ success: false, error: 'Bad Request', details: result.error.errors }, { status: 400 })
    }

    const { start_date, end_date, cycle_length } = result.data

    const supabaseAdmin = getSupabaseAdmin()
    const { error } = await supabaseAdmin.from('cycles').insert([{
      user_id: userId,
      start_date,
      end_date,
      cycle_length: cycle_length || 28,
      created_at: new Date().toISOString(),
    }])

    if (error) {
      logger.error(`Database error inserting cycle for user ${userId}:`, error.message);
      return NextResponse.json({ success: false, error: error.message }, { status: 500 })
    }

    logger.info(`Successfully added new period cycle for user ${userId}`);
    return NextResponse.json({ success: true })
  } catch (error) {
    logger.error('Error starting period cycle:', error.message || error);
    return NextResponse.json({ success: false, error: `Failed to start period: ${error.message || error}` }, { status: 500 })
  }
}

export async function PATCH(request) {
  try {
    const userId = await getAuthUserId()
    if (!userId) {
      logger.warn('Unauthenticated access attempt to PATCH /api/cycles');
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    // Rate Limiting (30 requests/minute)
    if (!isAllowed(userId, 'cycles_write', 30)) {
      logger.warn(`Rate limit exceeded for user ${userId} on PATCH /api/cycles`);
      return NextResponse.json({ success: false, error: 'Too Many Requests' }, { status: 429 })
    }

    // Payload Validation
    const json = await request.json()
    const result = cyclePatchSchema.safeParse(json)
    if (!result.success) {
      logger.warn(`Malformed cycle update payload from user ${userId}: ${result.error.message}`);
      return NextResponse.json({ success: false, error: 'Bad Request', details: result.error.errors }, { status: 400 })
    }

    const { id, end_date } = result.data

    const supabaseAdmin = getSupabaseAdmin()
    const { error } = await supabaseAdmin
      .from('cycles')
      .update({ end_date })
      .eq('id', id)
      .eq('user_id', userId)

    if (error) {
      logger.error(`Database error updating cycle ${id} for user ${userId}:`, error.message);
      return NextResponse.json({ success: false, error: error.message }, { status: 500 })
    }

    logger.info(`Successfully updated period cycle ${id} end_date for user ${userId}`);
    return NextResponse.json({ success: true })
  } catch (error) {
    logger.error('Error ending period cycle:', error.message || error);
    return NextResponse.json({ success: false, error: `Failed to end period: ${error.message || error}` }, { status: 500 })
  }
}
