import { NextResponse } from 'next/server'
import { getAuthUserId } from '@/lib/clerk-server'
import { getSupabaseAdmin } from '@/lib/supabase-admin'
import { logger } from '@/lib/logger'

export async function GET(request) {
  try {
    const userId = await getAuthUserId()
    if (!userId) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    const supabase = getSupabaseAdmin()

    // Fetch user profile
    const { data: profile, error: profileError } = await supabase
      .from('user_profiles')
      .select('*')
      .eq('user_id', userId)
      .single()

    if (profileError && profileError.code !== 'PGRST116') {
      logger.error('Error fetching user profile for export:', profileError)
      return NextResponse.json({ success: false, error: 'Database error' }, { status: 500 })
    }

    // Fetch user cycles
    const { data: cycles, error: cyclesError } = await supabase
      .from('cycles')
      .select('*')
      .eq('user_id', userId)

    if (cyclesError) {
      logger.error('Error fetching user cycles for export:', cyclesError)
      return NextResponse.json({ success: false, error: 'Database error' }, { status: 500 })
    }

    // Fetch user daily logs
    const { data: logs, error: logsError } = await supabase
      .from('daily_logs')
      .select('*')
      .eq('user_id', userId)

    if (logsError) {
      logger.error('Error fetching user logs for export:', logsError)
      return NextResponse.json({ success: false, error: 'Database error' }, { status: 500 })
    }

    return NextResponse.json({
      profile: profile || {},
      cycles: cycles || [],
      logs: logs || []
    }, { status: 200 })
  } catch (err) {
    logger.error('Data Export GET error:', err)
    return NextResponse.json({ success: false, error: 'Internal Server Error' }, { status: 500 })
  }
}
