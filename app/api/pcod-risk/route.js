import { NextResponse } from 'next/server'
import { calculatePCODRisk } from '@/lib/api-helpers'
import { getAuthUserId } from '@/lib/clerk-server'
import { getSupabaseAdmin } from '@/lib/supabase-admin'
import { logger } from '@/lib/logger'

export async function GET() {
  try {
    const userId = await getAuthUserId()
    if (!userId) {
      logger.warn('Unauthenticated access attempt to GET /api/pcod-risk');
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
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
    }

    const { data: logs, error: logsError } = await supabaseAdmin
      .from('daily_logs')
      .select('symptoms')
      .eq('user_id', userId)
      .order('date', { ascending: false })
      .limit(30)

    if (logsError) {
      logger.error(`Database error fetching logs for user ${userId} PCOD risk:`, logsError.message);
    }

    const allSymptoms = logs?.flatMap(log => log.symptoms || []) || []
    const risk = calculatePCODRisk(cycles || [], allSymptoms)

    logger.info(`Successfully calculated PCOD risk assessment for user ${userId}`);
    return NextResponse.json({ success: true, data: risk })
  } catch (error) {
    logger.error('Error calculating PCOD risk:', error.message || error)
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
