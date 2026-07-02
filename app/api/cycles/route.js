import { NextResponse } from 'next/server'
import { predictNextPeriod } from '@/lib/api-helpers'
import { getAuthUserId } from '@/lib/clerk-server'
import { getSupabaseAdmin } from '@/lib/supabase-admin'
import { crudLimiter, getRateLimitIdentifier } from '@/lib/rateLimiter'

export async function GET(request) {
  // ============ RATE LIMITING (NEW CODE) ============
  try {
    const identifier = await getRateLimitIdentifier(request);
    await crudLimiter.check(30, identifier); // 30 requests per minute (read-heavy)
  } catch (rateLimitError) {
    console.warn(`[Rate Limit] Cycles GET endpoint: ${rateLimitError.message}`);
    return NextResponse.json(
      { success: false, error: 'Too many requests, please slow down.' },
      { status: 429 }
    );
  }
  // ==================================================

  try {
    const userId = await getAuthUserId()
    if (!userId) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })

    const supabaseAdmin = getSupabaseAdmin()
    const { data: cycles, error } = await supabaseAdmin
      .from('cycles')
      .select('*')
      .eq('user_id', userId)
      .order('start_date', { ascending: false })
      .limit(12)

    if (error && error.code !== 'PGRST116') {
      return NextResponse.json({ success: true, data: { cycles: [], nextPeriodDate: null, confidence: null, averageCycleLength: 28 } })
    }

    const prediction = predictNextPeriod(cycles || [])
    return NextResponse.json({ success: true, data: { cycles: cycles || [], nextPeriodDate: prediction.nextPeriodDate, confidence: prediction.confidence, averageCycleLength: prediction.averageCycleLength } })
  } catch (error) {
    console.error('Error fetching cycles:', error)
    return NextResponse.json({ success: false, error: `Failed to fetch cycles: ${error.message || error}` }, { status: 500 })
  }
}

export async function POST(request) {
  // ============ RATE LIMITING (NEW CODE) ============
  try {
    const identifier = await getRateLimitIdentifier(request);
    await crudLimiter.check(30, identifier); // 30 requests per minute
  } catch (rateLimitError) {
    console.warn(`[Rate Limit] Cycles POST endpoint: ${rateLimitError.message}`);
    return NextResponse.json(
      { success: false, error: 'Too many requests, please slow down.' },
      { status: 429 }
    );
  }
  // ==================================================

  try {
    const userId = await getAuthUserId()
    if (!userId) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })

    const body = await request.json()
    const { start_date, end_date, cycle_length } = body

    const supabaseAdmin = getSupabaseAdmin()
    const { error } = await supabaseAdmin.from('cycles').insert([{
      user_id: userId,
      start_date,
      end_date,
      cycle_length: cycle_length || 28,
      created_at: new Date().toISOString(),
    }])

    if (error) {
      console.error('Insert cycle error:', error)
      return NextResponse.json({ success: false, error: error.message }, { status: 500 })
    }
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error starting period cycle:', error)
    return NextResponse.json({ success: false, error: `Failed to start period: ${error.message || error}` }, { status: 500 })
  }
}

export async function PATCH(request) {
  // ============ RATE LIMITING (NEW CODE) ============
  try {
    const identifier = await getRateLimitIdentifier(request);
    await crudLimiter.check(30, identifier); // 30 requests per minute
  } catch (rateLimitError) {
    console.warn(`[Rate Limit] Cycles PATCH endpoint: ${rateLimitError.message}`);
    return NextResponse.json(
      { success: false, error: 'Too many requests, please slow down.' },
      { status: 429 }
    );
  }
  // ==================================================

  try {
    const userId = await getAuthUserId()
    if (!userId) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })

    const body = await request.json()
    const { id, end_date } = body

    const supabaseAdmin = getSupabaseAdmin()
    const { error } = await supabaseAdmin
      .from('cycles')
      .update({ end_date })
      .eq('id', id)
      .eq('user_id', userId)

    if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 })
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error ending period cycle:', error)
    return NextResponse.json({ success: false, error: `Failed to end period: ${error.message || error}` }, { status: 500 })
  }
}
