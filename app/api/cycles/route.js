import { NextResponse } from 'next/server'
import { getAuthUserId, ensureUserExists } from '@/lib/clerk-server'
import { getSupabaseAdmin } from '@/lib/supabase-admin'
import { crudLimiter } from '@/lib/rateLimiter'
import { logger } from '@/lib/logger'
import { z } from 'zod'

const cyclePostSchema = z.object({
  id: z.string().uuid('Must be a valid UUID').optional(),
  start_date: z.string().min(1, 'Missing start date'),
  end_date: z.string().nullable().optional(),
  cycle_length: z.number().int().optional()
})

const cyclePatchSchema = z.object({
  id: z.string().uuid('Must be a valid UUID'),
  start_date: z.string().optional(),
  end_date: z.string().nullable().optional(),
  cycle_length: z.number().int().optional()
})

export async function GET(request) {
  // ============ RATE LIMITING ============
  try {
    await crudLimiter.check(request); 
  } catch (rateLimitError) {
    console.warn(`[Rate Limit] Cycles GET endpoint: ${rateLimitError.message}`);
    return NextResponse.json(
      { success: false, error: 'Too many requests, please slow down.' },
      { status: 429 }
    );
  }
  // =======================================

  try {
    const userId = await getAuthUserId()
    if (!userId) {
      logger.warn('Unauthenticated access attempt to GET /api/cycles');
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    await ensureUserExists(userId)

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

    logger.info(`Successfully fetched cycles for user ${userId}`);
    return NextResponse.json({ success: true, data: { cycles: cycles || [] } })
  } catch (error) {
    logger.error('Error fetching cycles:', error.message || error);
    return NextResponse.json({ success: false, error: `Failed to fetch cycles: ${error.message || error}` }, { status: 500 })
  }
}

export async function POST(request) {
  // ============ RATE LIMITING ============
  try {
    await crudLimiter.check(request); 
  } catch (rateLimitError) {
    console.warn(`[Rate Limit] Cycles POST endpoint: ${rateLimitError.message}`);
    return NextResponse.json(
      { success: false, error: 'Too many requests, please slow down.' },
      { status: 429 }
    );
  }
  // =======================================

  try {
    const userId = await getAuthUserId()
    if (!userId) {
      logger.warn('Unauthenticated access attempt to POST /api/cycles');
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    await ensureUserExists(userId)

    // Payload Validation
    const json = await request.json()
    const result = cyclePostSchema.safeParse(json)
    if (!result.success) {
      logger.warn(`Malformed cycle insertion payload from user ${userId}: ${result.error.message}`);
      return NextResponse.json({ success: false, error: 'Bad Request', details: result.error.errors }, { status: 400 })
    }

    const { id, start_date, end_date, cycle_length } = result.data

    const supabaseAdmin = getSupabaseAdmin()
    const insertObj = {
      user_id: userId,
      start_date,
      end_date: end_date || null,
      cycle_length: cycle_length || 28,
      created_at: new Date().toISOString(),
    }
    if (id) {
      insertObj.id = id
    }

    const { error } = await supabaseAdmin.from('cycles').insert([insertObj])

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
  // ============ RATE LIMITING ============
  try {
    await crudLimiter.check(request); 
  } catch (rateLimitError) {
    console.warn(`[Rate Limit] Cycles PATCH endpoint: ${rateLimitError.message}`);
    return NextResponse.json(
      { success: false, error: 'Too many requests, please slow down.' },
      { status: 429 }
    );
  }
  // =======================================

  try {
    const userId = await getAuthUserId()
    if (!userId) {
      logger.warn('Unauthenticated access attempt to PATCH /api/cycles');
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    await ensureUserExists(userId)

    // Payload Validation
    const json = await request.json()
    const result = cyclePatchSchema.safeParse(json)
    if (!result.success) {
      logger.warn(`Malformed cycle update payload from user ${userId}: ${result.error.message}`);
      return NextResponse.json({ success: false, error: 'Bad Request', details: result.error.errors }, { status: 400 })
    }

    const { id, start_date, end_date, cycle_length } = result.data

    const supabaseAdmin = getSupabaseAdmin()
    const updateObj = {}
    if (start_date !== undefined) updateObj.start_date = start_date
    if (end_date !== undefined) updateObj.end_date = end_date
    if (cycle_length !== undefined) updateObj.cycle_length = cycle_length

    const { error } = await supabaseAdmin
      .from('cycles')
      .update(updateObj)
      .eq('id', id)
      .eq('user_id', userId)

    if (error) {
      logger.error(`Database error updating cycle ${id} for user ${userId}:`, error.message);
      return NextResponse.json({ success: false, error: error.message }, { status: 500 })
    }

    logger.info(`Successfully updated period cycle ${id} for user ${userId}`);
    return NextResponse.json({ success: true })
  } catch (error) {
    logger.error('Error ending period cycle:', error.message || error);
    return NextResponse.json({ success: false, error: `Failed to end period: ${error.message || error}` }, { status: 500 })
  }
}
