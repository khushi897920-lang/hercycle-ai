import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { predictNextPeriod } from '@/lib/api-helpers'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
)

export async function POST(request) {
  try {
    const userId = 'demo-user-001'
    
    const { data: cycles } = await supabase
      .from('cycles')
      .select('*')
      .eq('user_id', userId)
      .order('start_date', { ascending: false })
      .limit(12)
    
    const prediction = predictNextPeriod(cycles || [])
    
    return NextResponse.json({ success: true, prediction })
  } catch (error) {
    console.error('Error predicting cycle:', error)
    return NextResponse.json({ success: false, error: 'Failed to predict cycle' }, { status: 500 })
  }
}
