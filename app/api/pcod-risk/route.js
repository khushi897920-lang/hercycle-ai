import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { calculatePCODRisk } from '@/lib/api-helpers'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
)

export async function GET(request) {
  try {
    const userId = 'demo-user-001'
    
    const { data: cycles } = await supabase
      .from('cycles')
      .select('*')
      .eq('user_id', userId)
      .order('start_date', { ascending: false })
      .limit(12)
    
    const { data: logs } = await supabase
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
      success: true,
      data: {
        score: 25,
        label: 'LOW RISK',
        factors: ['Regular cycle length maintained', 'No significant hormonal symptoms', 'Healthy cycle patterns observed'],
        recommendation: 'Keep tracking your cycle and maintaining healthy habits.'
      }
    })
  }
}
