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
    const { data, error } = await supabase
      .from('user_profiles')
      .select('*')
      .eq('user_id', userId)
      .single()

    if (error && error.code !== 'PGRST116') { // PGRST116 means no rows found (not an error if user hasn't created profile yet)
      logger.error('Error fetching user profile:', error)
      return NextResponse.json({ success: false, error: 'Database error' }, { status: 500 })
    }

    return NextResponse.json({ success: true, profile: data || {} }, { status: 200 })
  } catch (err) {
    logger.error('Profile GET error:', err)
    return NextResponse.json({ success: false, error: 'Internal Server Error' }, { status: 500 })
  }
}

export async function POST(request) {
  try {
    const userId = await getAuthUserId()
    if (!userId) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { age, weight_kg, height_cm, known_conditions, cycle_goal } = body

    const supabase = getSupabaseAdmin()
    const { data, error } = await supabase
      .from('user_profiles')
      .upsert({
        user_id: userId,
        age: age ? parseInt(age, 10) : null,
        weight_kg: weight_kg ? parseFloat(weight_kg) : null,
        height_cm: height_cm ? parseFloat(height_cm) : null,
        known_conditions: Array.isArray(known_conditions) ? known_conditions : [],
        cycle_goal: cycle_goal || null,
        updated_at: new Date().toISOString()
      }, { onConflict: 'user_id' })
      .select()
      .single()

    if (error) {
      logger.error('Error saving user profile:', error)
      return NextResponse.json({ success: false, error: 'Database error' }, { status: 500 })
    }

    return NextResponse.json({ success: true, profile: data }, { status: 200 })
  } catch (err) {
    logger.error('Profile POST error:', err)
    return NextResponse.json({ success: false, error: 'Internal Server Error' }, { status: 500 })
  }
}
