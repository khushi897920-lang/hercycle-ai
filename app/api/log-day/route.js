import { NextResponse } from 'next/server'
import { getAuthUserId } from '@/lib/clerk-server'
import { getSupabaseAdmin } from '@/lib/supabase-admin'

// GET /api/log-day?date=YYYY-MM-DD — fetch a single day's log
export async function GET(request) {
  try {
    const userId = await getAuthUserId()
    if (!userId) return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 })

    const { searchParams } = new URL(request.url)
    const date = searchParams.get('date') || new Date().toISOString().split('T')[0]

    const supabaseAdmin = getSupabaseAdmin()
    const { data, error } = await supabaseAdmin
      .from('daily_logs')
      .select('*')
      .eq('user_id', userId)
      .eq('date', date)
      .maybeSingle()

    if (error) return NextResponse.json({ success: false, message: error.message }, { status: 500 })
    return NextResponse.json({ success: true, data: data || null })
  } catch (error) {
    console.error('Error fetching day log:', error)
    return NextResponse.json({ success: false, message: `Failed to fetch daily log: ${error.message || error}` }, { status: 500 })
  }
}

// POST /api/log-day — upsert a day's log
export async function POST(request) {
  try {
    const userId = await getAuthUserId()
    if (!userId) {
      return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { date, symptoms, mood, flow } = body

    const supabaseAdmin = getSupabaseAdmin()
    const { error } = await supabaseAdmin
      .from('daily_logs')
      .upsert(
        { user_id: userId, date, symptoms, mood, flow, updated_at: new Date().toISOString() },
        { onConflict: 'user_id,date' }
      )

    if (error) {
      console.error('Supabase upsert error:', error)
      return NextResponse.json({ success: false, message: `Failed to log day: ${error.message}` }, { status: 500 })
    }

    return NextResponse.json({ success: true, message: 'Day logged successfully!' })
  } catch (error) {
    console.error('Error logging day:', error)
    return NextResponse.json({ success: false, message: `Internal Server Error: ${error.message || error}` }, { status: 500 })
  }
}
