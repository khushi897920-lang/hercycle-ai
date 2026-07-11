

import { NextResponse } from 'next/server'
import { getAuthUserId } from '@/lib/clerk-server'
import { getSupabaseAdmin } from '@/lib/supabase-admin'
import { crudLimiter } from '@/lib/rateLimiter'
import { logger } from '@/lib/logger'
import { z } from 'zod'

const logPostSchema = z.object({
  date_hash: z.string().min(1, 'Missing date hash'),
  encrypted_data: z.string().min(1, 'Missing encrypted payload')
})

// GET /api/log-day?date_hash=... — fetch a single day's log
export async function GET(request) {
  // ============ RATE LIMITING ============
  try {
    await crudLimiter.check(request); // 30 requests per minute (see lib/rateLimiter.js)
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

    const { searchParams } = new URL(request.url)
    const dateHash = searchParams.get('date_hash')
    
    if (!dateHash) {
      return NextResponse.json({ success: false, message: 'Bad Request: Missing date hash.' }, { status: 400 })
    }

    const supabaseAdmin = getSupabaseAdmin()
    const { data, error } = await supabaseAdmin
      .from('daily_logs')
      .select('*')
      .eq('user_id', userId)
      .eq('date_hash', dateHash)
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

    const json = await request.json()
    const result = logPostSchema.safeParse(json)
    if (!result.success) {
      logger.warn(`Malformed daily log upsert payload from user ${userId}: ${result.error.message}`);
      return NextResponse.json({ success: false, message: 'Bad Request', details: result.error.errors }, { status: 400 })
    }

    const { date_hash, encrypted_data } = result.data

    const supabaseAdmin = getSupabaseAdmin()
    const { error } = await supabaseAdmin
      .from('daily_logs')
      .upsert(
        { user_id: userId, date_hash, encrypted_data, updated_at: new Date().toISOString() },
        { onConflict: 'user_id,date_hash' } // Requires updating constraint on Supabase if date was previously the unique key
      )

    if (error) {
      logger.error(`Database error upserting daily log for user ${userId}:`, error.message);
      return NextResponse.json({ success: false, message: `Failed to log day: ${error.message}` }, {status: 500 })
    }

    logger.info(`Successfully upserted daily log for user ${userId}`);
    return NextResponse.json({ success: true, message: 'Day logged successfully!' })
  } catch (error) {
    logger.error('Error logging day:', error.message || error);
    return NextResponse.json({ success: false, message: `Internal Server Error: ${error.message || error}` }, { status: 500 })
  }
}