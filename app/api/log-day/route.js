import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getAuthUserId } from '@/lib/supabase-server'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
)

export async function POST(request) {
  try {
    const userId = await getAuthUserId()
    console.log("API called with userId:", userId)

    if (!userId) {
      return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    console.log("Log day request:", body)
    const { date, symptoms, mood, flow } = body

    const { error } = await supabaseAdmin
      .from('daily_logs')
      .upsert(
        { user_id: userId, date, symptoms, mood, flow, updated_at: new Date().toISOString() },
        { onConflict: 'user_id,date' }
      )

    if (error) {
      console.error('Supabase upsert error:', error)
      return NextResponse.json({ success: false, message: 'Failed to log day' }, { status: 500 })
    }

    return NextResponse.json({ success: true, message: 'Day logged successfully!' })
  } catch (error) {
    console.error('Error logging day:', error)
    return NextResponse.json({ success: false, message: 'Internal Server Error' }, { status: 500 })
  }
}
