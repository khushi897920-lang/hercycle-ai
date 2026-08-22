import { NextResponse } from 'next/server'
import { getAuthUserId, ensureUserExists } from '@/lib/clerk-server'
import { getSupabaseAdmin } from '@/lib/supabase-admin'
import { crudLimiter } from '@/lib/rateLimiter'
import { logger } from '@/lib/logger'
import { z } from 'zod'
import { eventBus } from '@/lib/events'
import { isoCalendarDate } from '@/lib/date-schemas'
import { sanitizeSymptomList, sanitizeText, getPaginationParams, formatPaginatedResponse } from '@/lib/api-helpers'
import { pcodRiskCache } from '@/lib/cache'

const logPostSchema = z.object({
  // Shape alone is not enough: the old `/^\d{4}-\d{2}-\d{2}$/` accepted
  // "2026-02-31" and "2026-13-45", and this route answered 200 for a day that
  // does not exist.
  date: isoCalendarDate({ label: 'date' }),
  symptoms: z.array(z.string()).optional(),
  mood: z.string().nullable().optional(),
  flow: z.string().nullable().optional(),
  cervical_discharge: z.string().nullable().optional(),
  encrypted_data: z.any().optional()
})

// GET /api/log-day — fetch a single day's log (via ?date=...) or paginated lists of daily logs
export async function GET(request) {
  // ============ RATE LIMITING ============
  try {
    await crudLimiter.check(request);
  } catch (rateLimitError) {
    console.warn(`[Rate Limit] Log-day GET endpoint: ${rateLimitError.message}`);
    return NextResponse.json(
      { success: false, message: 'Too many requests, please slow down.' },
      { status: 429 }
    );
  }
  // =======================================

  try {
    const userId = await getAuthUserId()
    if (!userId) {
      logger.warn('Unauthenticated access attempt to GET /api/log-day');
      return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 })
    }

    await ensureUserExists(userId)

    const url = new URL(request.url)
    const dateParam = url.searchParams.get('date')

    const supabaseAdmin = getSupabaseAdmin()

    // If a specific date is requested, retain single-item lookup behavior
    if (dateParam) {
      const { data, error } = await supabaseAdmin
        .from('daily_logs')
        .select('*')
        .eq('user_id', userId)
        .eq('date', dateParam)
        .maybeSingle()

      if (error) {
        logger.error(`Database error fetching daily log for user ${userId}:`, error.message);
        return NextResponse.json({ success: false, message: error.message }, { status: 500 })
      }

      logger.info(`Successfully fetched daily log for user ${userId}`);
      // Re-sanitize on the way out too, so rows written before this endpoint
      // enforced sanitization can't still surface raw markup to the client.
      const safeData = data
        ? {
            ...data,
            symptoms: sanitizeSymptomList(data.symptoms),
            mood: data.mood ? sanitizeText(data.mood) : data.mood,
            flow: data.flow ? sanitizeText(data.flow) : data.flow,
            cervical_discharge: data.cervical_discharge ? sanitizeText(data.cervical_discharge) : data.cervical_discharge,
          }
        : null
      return NextResponse.json({ success: true, data: safeData })
    }

    // Otherwise, support paginated multi-record fetching via Issue #590 requirements
    const { limit, cursor } = getPaginationParams(url.searchParams, 30, 100)

    const { count: totalCount, error: countError } = await supabaseAdmin
      .from('daily_logs')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId)

    if (countError) {
      logger.error(`Error counting daily logs for user ${userId}:`, countError.message);
    }

    let query = supabaseAdmin
      .from('daily_logs')
      .select('*')
      .eq('user_id', userId)
      .order('date', { ascending: false })
      .order('id', { ascending: false })
      .limit(limit)

    if (cursor) {
      const [cursorDate, cursorId] = cursor.split('_')
      if (cursorDate && cursorId) {
        query = query.or(`date.lt.${cursorDate},and(date.eq.${cursorDate},id.lt.${cursorId})`)
      }
    }

    const { data: logs, error } = await query

    if (error) {
      logger.error(`Error querying daily logs list for user ${userId}:`, error.message);
      return NextResponse.json({ success: false, message: error.message }, { status: 500 })
    }

    const rows = logs || []
    logger.info(`Successfully fetched ${rows.length} daily logs for user ${userId}`);

    const sanitizedRows = rows.map(item => ({
      ...item,
      symptoms: sanitizeSymptomList(item.symptoms),
      mood: item.mood ? sanitizeText(item.mood) : item.mood,
      flow: item.flow ? sanitizeText(item.flow) : item.flow,
      cervical_discharge: item.cervical_discharge ? sanitizeText(item.cervical_discharge) : item.cervical_discharge,
    }))

    const paginatedResult = formatPaginatedResponse(
      sanitizedRows,
      limit,
      totalCount || sanitizedRows.length,
      (item) => `${item.date}_${item.id}`
    )

    return NextResponse.json(paginatedResult, { status: 200 })
  } catch (error) {
    logger.error('Error fetching day log:', error.message || error);
    return NextResponse.json({ success: false, message: `Failed to fetch daily log: ${error.message || error}` }, { status: 500 })
  }
}

// POST /api/log-day — upsert a day's log
export async function POST(request) {
  // ============ RATE LIMITING ============
  try {
    await crudLimiter.check(request);
  } catch (rateLimitError) {
    console.warn(`[Rate Limit] Log-day POST endpoint: ${rateLimitError.message}`);
    return NextResponse.json(
      { success: false, message: 'Too many requests, please slow down.' },
      { status: 429 }
    );
  }
  // =======================================

  try {
    const userId = await getAuthUserId()
    if (!userId) {
      logger.warn('Unauthenticated access attempt to POST /api/log-day');
      return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 })
    }

    await ensureUserExists(userId)

    let json;
    try {
      json = await request.json();
    } catch (parseError) {
      logger.warn(`Malformed JSON payload in log-day POST: ${parseError.message}`);
      return NextResponse.json({ success: false, message: 'Bad Request: Invalid JSON payload' }, { status: 400 });
    }
    const result = logPostSchema.safeParse(json)
    if (!result.success) {
      logger.warn(`Malformed daily log upsert payload from user ${userId}: ${result.error.message}`);
      return NextResponse.json({ success: false, message: 'Bad Request', details: result.error.errors }, { status: 400 })
    }

    const { date, symptoms, mood, flow, cervical_discharge, encrypted_data } = result.data

    // Sanitize every free-text field before it ever reaches the database:
    // strip HTML/script tags, trim whitespace, and cap custom-symptom
    // length (50 chars) and count (20 items) to prevent stored XSS/injection.
    const sanitizedSymptoms = sanitizeSymptomList(symptoms)
    const sanitizedMood = mood ? sanitizeText(mood) : null
    const sanitizedFlow = flow ? sanitizeText(flow) : null
    const sanitizedCervicalDischarge = cervical_discharge ? sanitizeText(cervical_discharge) : null

    const supabaseAdmin = getSupabaseAdmin()

    // Build the upsert payload — only include encrypted_data when the
    // client actually sent it, so this route works whether or not the
    // daily_logs table has been migrated to add the E2EE column yet.
    const upsertPayload = {
      user_id: userId,
      date,
      symptoms: sanitizedSymptoms,
      mood: sanitizedMood,
      flow: sanitizedFlow,
      cervical_discharge: sanitizedCervicalDischarge,
      updated_at: new Date().toISOString()
    }
    if (encrypted_data !== undefined && encrypted_data !== null) {
      upsertPayload.encrypted_data = encrypted_data
    }

    const { error } = await supabaseAdmin
      .from('daily_logs')
      .upsert(upsertPayload, { onConflict: 'user_id,date' })

    if (error) {
      logger.error(`Database error upserting daily log for user ${userId}:`, error.message);
      return NextResponse.json({ success: false, message: `Failed to log day: ${error.message}` }, { status: 500 })
    }

    logger.info(`Successfully upserted daily log for user ${userId}`);

    // Invalidate cached PCOD risk calculation immediately when new daily logs are submitted
    if (typeof pcodRiskCache.invalidatePattern === 'function') {
      pcodRiskCache.invalidatePattern(`pcod-risk:${userId}`);
    } else {
      pcodRiskCache.invalidate(`pcod-risk:${userId}`);
    }

    // Emit event for daily logs update
    eventBus.emit('daily_logs:updated', { userId });

    return NextResponse.json({ success: true, message: 'Day logged successfully!' })
  } catch (error) {
    logger.error('Error logging day:', error.message || error);
    return NextResponse.json({ success: false, message: `Internal Server Error: ${error.message || error}` }, { status: 500 })
  }
}
