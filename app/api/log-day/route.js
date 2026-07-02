import { NextResponse } from 'next/server'
import { getAuthUserId } from '@/lib/clerk-server'
import { getSupabaseAdmin } from '@/lib/supabase-admin'
import { isAllowed } from '@/lib/rate-limiter'
import { logger } from '@/lib/logger'
import { z } from 'zod'

const logPostSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Must be in YYYY-MM-DD format'),
  symptoms: z.array(z.string().max(100)).max(50),
  mood: z.string().max(50).nullable().optional(),
  flow: z.string().max(10).nullable().optional()
})

// GET /api/log-day?date=YYYY-MM-DD — fetch a single day's log
export async function GET(request) {
  try {
    const userId = await getAuthUserId()
    if (!userId) {
      logger.warn('Unauthenticated access attempt to GET /api/log-day');
      return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const date = searchParams.get('date') || new Date().toISOString().split('T')[0]

    // Verify date parameter format
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      logger.warn(`Invalid date format requested by user ${userId}: ${date}`);
      return NextResponse.json({ success: false, message: 'Bad Request: Invalid date format. Use YYYY-MM-DD.' }, { status: 400 })
    }

    const supabaseAdmin = getSupabaseAdmin()
    const { data, error } = await supabaseAdmin
      .from('daily_logs')
      .select('*')
      .eq('user_id', userId)
      .eq('date', date)
      .maybeSingle()

    if (error) {
      logger.error(`Database error fetching daily log for user ${userId} on date ${date}:`, error.message);
      return NextResponse.json({ success: false, message: error.message }, { status: 500 })
    }

    logger.info(`Successfully fetched daily log for user ${userId} on date ${date}`);
    return NextResponse.json({ success: true, data: data || null })
  } catch (error) {
    logger.error('Error fetching day log:', error.message || error);
    return NextResponse.json({ success: false, message: `Failed to fetch daily log: ${error.message || error}` }, { status: 500 })
  }
}

// POST /api/log-day — upsert a day's log
export async function POST(request) {
  try {
    const userId = await getAuthUserId()
    if (!userId) {
      logger.warn('Unauthenticated access attempt to POST /api/log-day');
      return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 })
    }

    // Rate Limiting (30 requests/minute)
    if (!isAllowed(userId, 'log_day_write', 30)) {
      logger.warn(`Rate limit exceeded for user ${userId} on POST /api/log-day`);
      return NextResponse.json({ success: false, message: 'Too Many Requests' }, { status: 429 })
    }

    // Payload Validation
    const json = await request.json()
    const result = logPostSchema.safeParse(json)
    if (!result.success) {
      logger.warn(`Malformed daily log upsert payload from user ${userId}: ${result.error.message}`);
      return NextResponse.json({ success: false, message: 'Bad Request', details: result.error.errors }, { status: 400 })
    }

    const { date, symptoms, mood, flow } = result.data

    const supabaseAdmin = getSupabaseAdmin()
    const { error } = await supabaseAdmin
      .from('daily_logs')
      .upsert(
        { user_id: userId, date, symptoms, mood, flow, updated_at: new Date().toISOString() },
        { onConflict: 'user_id,date' }
      )

    if (error) {
      logger.error(`Database error upserting daily log for user ${userId} on date ${date}:`, error.message);
      return NextResponse.json({ success: false, message: `Failed to log day: ${error.message}` }, { status: 500 })
    }

    logger.info(`Successfully upserted daily log for user ${userId} on date ${date}`);
    return NextResponse.json({ success: true, message: 'Day logged successfully!' })
  } catch (error) {
    logger.error('Error logging day:', error.message || error);
    return NextResponse.json({ success: false, message: `Internal Server Error: ${error.message || error}` }, { status: 500 })
  }
}
