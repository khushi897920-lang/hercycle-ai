import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { predictNextPeriod } from '@/lib/api-helpers'
import { getAuthUserId } from '@/lib/supabase-server'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
)

export async function GET() {
  try {
    const userId = await getAuthUserId()

    if (!userId) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    const { data: cycles, error } = await supabaseAdmin
      .from('cycles')
      .select('*')
      .eq('user_id', userId)
      .order('start_date', { ascending: false })
      .limit(12)

    if (error && error.code !== 'PGRST116') {
      console.error('Supabase error:', error)
      return NextResponse.json({
        success: true,
        data: { cycles: [], nextPeriodDate: null, confidence: null, averageCycleLength: 28 }
      })
    }

    const prediction = predictNextPeriod(cycles || [])

    return NextResponse.json({
      success: true,
      data: { cycles: cycles || [], nextPeriodDate: prediction.nextPeriodDate, confidence: prediction.confidence, averageCycleLength: prediction.averageCycleLength }
    })
  } catch (error) {
    console.error('Error fetching cycles:', error)
    return NextResponse.json({
      success: true,
      data: { cycles: [], nextPeriodDate: null, confidence: null, averageCycleLength: 28 }
    })
  }
}
