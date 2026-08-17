import { jsonSuccess, jsonError } from '@/lib/api-helpers'
import { getAuthUserId } from '@/lib/clerk-server'
import { getSupabaseAdmin } from '@/lib/supabase-admin'
import { logger } from '@/lib/logger'

export async function GET(request) {
  try {
    const userId = await getAuthUserId()
    if (!userId) {
      return jsonError('Unauthorized', 401)
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
      return jsonError('Database error', 500)
    }

    // Fetch user cycles
    const { data: cycles, error: cyclesError } = await supabase
      .from('cycles')
      .select('*')
      .eq('user_id', userId)

    if (cyclesError) {
      logger.error('Error fetching user cycles for export:', cyclesError)
      return jsonError('Database error', 500)
    }

    // Fetch user daily logs
    const { data: logs, error: logsError } = await supabase
      .from('daily_logs')
      .select('*')
      .eq('user_id', userId)

    if (logsError) {
      logger.error('Error fetching user logs for export:', logsError)
      return jsonError('Database error', 500)
    }

    return jsonSuccess({
      profile: profile || {},
      cycles: cycles || [],
      logs: logs || []
    })
  } catch (err) {
    logger.error('Data Export GET error:', err)
    return jsonError('Internal Server Error', 500)
  }
}

