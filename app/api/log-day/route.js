import { NextResponse } from 'next/server'
import { getAuthUserId, ensureUserExists } from '@/lib/clerk-server'
import { getSupabaseAdmin } from '@/lib/supabase-admin'
import { crudLimiter } from '@/lib/rateLimiter'
import { logger } from '@/lib/logger'
import { z } from 'zod'

const logPostSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Must be YYYY-MM-DD'),
  symptoms: z.array(z.string()).optional(),
  mood: z.string().nullable().optional(),
  flow: z.string().nullable().optional(),
  cervical_discharge: z.string().nullable().optional(),
})

// GET /api/log-day?date=... — fetch a single day's log
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

    const { searchParams } = new URL(request.url)
    const date = searchParams.get('date')
    
    if (!date) {
      return NextResponse.json({ success: false, message: 'Bad Request: Missing date.' }, { status: 400 })
    }

    const supabaseAdmin = getSupabaseAdmin()
    const { data, error } = await supabaseAdmin
      .from('daily_logs')
      .select('*')
      .eq('user_id', userId)
      .eq('date', date)
      .maybeSingle()

    if (error) {
      logger.error(`Database error fetching daily log for user ${userId}:`, error.message);
      return NextResponse.json({ success: false, message: error.message }, { status: 500 })
    }

    logger.info(`Successfully fetched daily log for user ${userId}`);
    return NextResponse.json({ success: true, data: data || null })
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

    const json = await request.json()
    const result = logPostSchema.safeParse(json)
    if (!result.success) {
      logger.warn(`Malformed daily log upsert payload from user ${userId}: ${result.error.message}`);
      return NextResponse.json({ success: false, message: 'Bad Request', details: result.error.errors }, { status: 400 })
    }

    const { date, symptoms, mood, flow, cervical_discharge } = result.data

    const supabaseAdmin = getSupabaseAdmin()
    const { error } = await supabaseAdmin
      .from('daily_logs')
      .upsert(
        { 
          user_id: userId, 
          date, 
          symptoms: symptoms || [], 
          mood: mood || null, 
          flow: flow || null, 
          cervical_discharge: cervical_discharge || null, 
          updated_at: new Date().toISOString() 
        },
        { onConflict: 'user_id,date' }
      )

    if (error) {
      logger.error(`Database error upserting daily log for user ${userId}:`, error.message);
      return NextResponse.json({ success: false, message: `Failed to log day: ${error.message}` }, { status: 500 })
    }

    logger.info(`Successfully upserted daily log for user ${userId}`);
    return NextResponse.json({ success: true, message: 'Day logged successfully!' })
  } catch (error) {
    logger.error('Error logging day:', error.message || error);
    return NextResponse.json({ success: false, message: `Internal Server Error: ${error.message || error}` }, { status: 500 })
  }
}