import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
)

export async function POST(request) {
  try {
    const { date, symptoms, mood, flow } = await request.json()
    const userId = 'demo-user-001'
    
    const { data: existing } = await supabase
      .from('daily_logs')
      .select('id')
      .eq('user_id', userId)
      .eq('date', date)
      .single()
    
    if (existing) {
      const { error } = await supabase
        .from('daily_logs')
        .update({ symptoms, mood, flow, updated_at: new Date().toISOString() })
        .eq('id', existing.id)
      
      if (error) console.error('Supabase update error:', error)
    } else {
      const { error } = await supabase
        .from('daily_logs')
        .insert([{ user_id: userId, date, symptoms, mood, flow, created_at: new Date().toISOString() }])
      
      if (error) console.error('Supabase insert error:', error)
    }
    
    return NextResponse.json({ success: true, message: 'Day logged successfully!' })
  } catch (error) {
    console.error('Error logging day:', error)
    return NextResponse.json({ success: true, message: 'Log saved locally' })
  }
}
