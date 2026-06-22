import { NextResponse } from 'next/server'
import { predictNextPeriod } from '@/lib/api-helpers'
import { getAuthUserId } from '@/lib/clerk-server'
import { getSupabaseAdmin } from '@/lib/supabase-admin'

export async function POST() {
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

    const prediction = predictNextPeriod(cycles || [])
    return NextResponse.json({ success: true, prediction })
  } catch (error) {
    console.error('Error predicting cycle:', error)
    return NextResponse.json({ success: false, error: `Failed to predict cycle: ${error.message || error}` }, { status: 500 })
  }
}
