import { jsonSuccess, jsonError } from '@/lib/api-helpers'
import { getAuthUserId, ensureUserExists } from '@/lib/clerk-server'
import { getSupabaseAdmin } from '@/lib/supabase-admin'
import { crudLimiter } from '@/lib/rateLimiter'
import { logger } from '@/lib/logger'
import { z } from 'zod'
import { eventBus } from '@/lib/events'
import { pcodRiskCache } from '@/lib/cache'
import { endsOnOrAfterStart, isoCalendarDate, optionalIsoCalendarDate } from '@/lib/date-schemas'

/**
 * Physiologically valid cycle length: 15–90 days covers all clinical edge cases
 * (Polymenorrhea threshold: 21 days; longest documented cycles: ~90 days).
 */
const validCycleLength = z
  .number({ invalid_type_error: 'cycle_length must be a number' })
  .int('cycle_length must be a whole number')
  .min(15, 'cycle_length must be at least 15 days')
  .max(90, 'cycle_length must be no more than 90 days');

const cyclePostSchema = z
  .object({
    id: z.string().uuid('Must be a valid UUID').optional(),
    start_date: isoCalendarDate({ label: 'start_date' }),
    end_date: optionalIsoCalendarDate({ label: 'end_date' }),
    cycle_length: validCycleLength.optional(),
    encrypted_data: z.any().optional()
  })
  .refine(
    (data) => endsOnOrAfterStart(data.start_date, data.end_date),
    { message: 'end_date must be on or after start_date', path: ['end_date'] }
  );

const cyclePatchSchema = z
  .object({
    id: z.string().uuid('Must be a valid UUID'),
    start_date: isoCalendarDate({ label: 'start_date' }).optional(),
    end_date: optionalIsoCalendarDate({ label: 'end_date' }),
    cycle_length: validCycleLength.optional(),
    encrypted_data: z.any().optional()
  })
  .refine(
    (data) => endsOnOrAfterStart(data.start_date, data.end_date),
    { message: 'end_date must be on or after start_date', path: ['end_date'] }
  );

  /**
 * Maps a Postgres CHECK constraint violation (code 23514) to a clean,
 * user-facing message. Falls back to the raw error for anything else.
 */
function toCleanCycleError(error) {
  if (error?.code === '23514') {
    if (error.message?.includes('check_end_date_after_start')) {
      return { message: 'End date cannot be before the start date.', status: 400 }
    }
    if (error.message?.includes('check_cycle_length_bounds')) {
      return { message: 'Cycle length must be between 10 and 120 days.', status: 400 }
    }
    return { message: 'Invalid cycle data submitted.', status: 400 }
  }
  return { message: error?.message || 'Unknown database error', status: 500 }
}

export async function GET(request) {
  // ============ RATE LIMITING ============
  try {
    await crudLimiter.check(request); 
  } catch (rateLimitError) {
    console.warn(`[Rate Limit] Cycles GET endpoint: ${rateLimitError.message}`);
    return jsonError('Too many requests, please slow down.', 429)
  }
  // =======================================

  try {
    const userId = await getAuthUserId()
    if (!userId) {
      logger.warn('Unauthenticated access attempt to GET /api/cycles');
      return jsonError('Unauthorized', 401)
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
      return jsonSuccess({ cycles: [], nextPeriodDate: null, confidence: null, averageCycleLength: 28 })
    }

    logger.info(`Successfully fetched cycles for user ${userId}`);
    return jsonSuccess({ cycles: cycles || [] })
  } catch (error) {
    logger.error('Error fetching cycles:', error.message || error);
    return jsonError(`Failed to fetch cycles: ${error.message || error}`, 500)
  }
}

export async function POST(request) {
  // ============ RATE LIMITING ============
  try {
    await crudLimiter.check(request); 
  } catch (rateLimitError) {
    console.warn(`[Rate Limit] Cycles POST endpoint: ${rateLimitError.message}`);
    return jsonError('Too many requests, please slow down.', 429)
  }
  // =======================================

  try {
    const userId = await getAuthUserId()
    if (!userId) {
      logger.warn('Unauthenticated access attempt to POST /api/cycles');
      return jsonError('Unauthorized', 401)
    }

    await ensureUserExists(userId)

    // Payload Validation
    let json;
    try {
      json = await request.json();
    } catch (parseError) {
      logger.warn(`Malformed JSON payload in cycles POST: ${parseError.message}`);
      return jsonError('Bad Request: Invalid JSON payload', 400)
    }
    const result = cyclePostSchema.safeParse(json)
    if (!result.success) {
      logger.warn(`Malformed cycle insertion payload from user ${userId}: ${result.error.message}`);
      return jsonError('Bad Request', 400, null, result.error.errors)
    }

    const { id, start_date, end_date, cycle_length, encrypted_data } = result.data

    const supabaseAdmin = getSupabaseAdmin()
    const insertObj = {
      user_id: userId,
      start_date: start_date || null,
      end_date: end_date || null,
      cycle_length: cycle_length || 28,
      created_at: new Date().toISOString(),
    }
    if (id) {
      insertObj.id = id
    }
    // Only include encrypted_data if the client sent it — avoids crashing when
    // the cycles table hasn't been migrated to add the E2EE column yet.
    if (encrypted_data !== undefined && encrypted_data !== null) {
      insertObj.encrypted_data = encrypted_data
    }

    const { error } = await supabaseAdmin.from('cycles').insert([insertObj])

    if (error) {
      const clean = toCleanCycleError(error)
      logger.error(`Database error inserting cycle for user ${userId}:`, error.message);
      return jsonError(clean.message, clean.status)
    }

    logger.info(`Successfully added new period cycle for user ${userId}`);
    
    // Automatic LRU cache invalidation for PCOD risk score
    pcodRiskCache.invalidate(`pcod-risk:${userId}`);
    pcodRiskCache.invalidate(userId);

    // Emit event for cycle update
    eventBus.emit('cycles:updated', { userId });

    return jsonSuccess(null, 'Period started successfully')
  } catch (error) {
    logger.error('Error starting period cycle:', error.message || error);
    return jsonError(`Failed to start period: ${error.message || error}`, 500)
  }
}

export async function PATCH(request) {
  // ============ RATE LIMITING ============
  try {
    await crudLimiter.check(request); 
  } catch (rateLimitError) {
    console.warn(`[Rate Limit] Cycles PATCH endpoint: ${rateLimitError.message}`);
    return jsonError('Too many requests, please slow down.', 429)
  }
  // =======================================

  try {
    const userId = await getAuthUserId()
    if (!userId) {
      logger.warn('Unauthenticated access attempt to PATCH /api/cycles');
      return jsonError('Unauthorized', 401)
    }

    await ensureUserExists(userId)

    // Payload Validation
    let json;
    try {
      json = await request.json();
    } catch (parseError) {
      logger.warn(`Malformed JSON payload in cycles PATCH: ${parseError.message}`);
      return jsonError('Bad Request: Invalid JSON payload', 400)
    }
    const result = cyclePatchSchema.safeParse(json)
    if (!result.success) {
      logger.warn(`Malformed cycle update payload from user ${userId}: ${result.error.message}`);
      return jsonError('Bad Request', 400, null, result.error.errors)
    }

    const { id, start_date, end_date, cycle_length, encrypted_data } = result.data

    const supabaseAdmin = getSupabaseAdmin()
    const updateObj = {}
    if (start_date !== undefined) updateObj.start_date = start_date
    if (end_date !== undefined) updateObj.end_date = end_date
    if (cycle_length !== undefined) updateObj.cycle_length = cycle_length
    if (encrypted_data !== undefined) updateObj.encrypted_data = encrypted_data

    const { error } = await supabaseAdmin
      .from('cycles')
      .update(updateObj)
      .eq('id', id)
      .eq('user_id', userId)

   if (error) {
      const clean = toCleanCycleError(error)
      logger.error(`Database error updating cycle ${id} for user ${userId}:`, error.message);
      return jsonError(clean.message, clean.status)
    }
    logger.info(`Successfully updated period cycle ${id} for user ${userId}`);
    
    // Automatic LRU cache invalidation for PCOD risk score
    pcodRiskCache.invalidate(`pcod-risk:${userId}`);
    pcodRiskCache.invalidate(userId);

    // Emit event for cycle update
    eventBus.emit('cycles:updated', { userId });

    return jsonSuccess(null, 'Period updated successfully')
  } catch (error) {
    logger.error('Error ending period cycle:', error.message || error);
    return jsonError(`Failed to end period: ${error.message || error}`, 500)
  }
}

