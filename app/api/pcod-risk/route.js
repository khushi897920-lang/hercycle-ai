import { NextResponse } from 'next/server'
import { calculatePCODRisk } from '@/lib/api-helpers'
import { getAuthUserId } from '@/lib/clerk-server'
import { getSupabaseAdmin } from '@/lib/supabase-admin'
import { aiLimiter, getRateLimitIdentifier } from '@/lib/rateLimiter'

export async function GET(request) {
  // ============ RATE LIMITING (NEW CODE) ============
  try {
    const identifier = await getRateLimitIdentifier(request);
    await aiLimiter.check(5, identifier); // 5 requests per minute
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
  // ==================================================

  try {
    const userId = await getAuthUserId()
    if (!userId) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    const supabaseAdmin = getSupabaseAdmin()
    const { data: cycles } = await supabaseAdmin
      .from('cycles')
      .select('*')
      .eq('user_id', userId)
      .order('start_date', { ascending: false })
      .limit(12)

    const { data: logs } = await supabaseAdmin
      .from('daily_logs')
      .select('symptoms')
      .eq('user_id', userId)
      .order('date', { ascending: false })
      .limit(30)

    const allSymptoms = logs?.flatMap(log => log.symptoms || []) || []
    const risk = calculatePCODRisk(cycles || [], allSymptoms)

    return NextResponse.json({ success: true, data: risk })
  } catch (error) {
    console.error('Error calculating PCOD risk:', error)
    return NextResponse.json({
      success: false,
      error: `Failed to calculate PCOD risk: ${error.message || error}`,
      data: {
        score: 25, label: 'LOW RISK',
        factors: ['Regular cycle length maintained', 'No significant hormonal symptoms'],
        recommendation: 'Keep tracking your cycle and maintaining healthy habits.'
      }
    })
  }
}
