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
    const { data, error } = await supabase
      .from('user_profiles')
      .select('*')
      .eq('user_id', userId)
      .maybeSingle()

    if (error) {
      logger.error('Error fetching user profile:', error)
      return jsonError('Database error', 500)
    }

    return jsonSuccess({ profile: data || {} })
  } catch (err) {
    logger.error('Profile GET error:', err)
    return jsonError('Internal Server Error', 500)
  }
}

export async function POST(request) {
  try {
    const userId = await getAuthUserId()
    if (!userId) {
      return jsonError('Unauthorized', 401)
    }

    let body
    try {
      body = await request.json()
    } catch (parseError) {
      logger.warn(`Malformed JSON payload in profile POST: ${parseError.message}`)
      return jsonError('Bad Request: Invalid JSON payload', 400)
    }

    if (!body || typeof body !== 'object' || Array.isArray(body)) {
      return jsonError('Invalid payload', 400)
    }

    const { age, weight_kg, height_cm, known_conditions, cycle_goal, allow_ai_analysis, cycleLength } = body

    let parsedAge = null
    if (age !== undefined && age !== null && age !== '') {
      parsedAge = Number(age)
      if (!Number.isFinite(parsedAge) || parsedAge < 1 || parsedAge > 120) {
        return jsonError('Age must be a valid number between 1 and 120', 400)
      }
    }

    let parsedWeight = null
    if (weight_kg !== undefined && weight_kg !== null && weight_kg !== '') {
      parsedWeight = Number(weight_kg)
      if (!Number.isFinite(parsedWeight) || parsedWeight < 1 || parsedWeight > 500) {
        return jsonError('Weight must be a valid number between 1 and 500 kg', 400)
      }
    }

    let parsedHeight = null
    if (height_cm !== undefined && height_cm !== null && height_cm !== '') {
      parsedHeight = Number(height_cm)
      if (!Number.isFinite(parsedHeight) || parsedHeight < 1 || parsedHeight > 300) {
        return jsonError('Height must be a valid number between 1 and 300 cm', 400)
      }
    }

    if (cycleLength !== undefined && cycleLength !== null && cycleLength !== '') {
      const parsedCycleLength = Number(cycleLength)
      if (!Number.isFinite(parsedCycleLength) || parsedCycleLength < 15 || parsedCycleLength > 60) {
        return jsonError('Cycle length must be between 15 and 60 days', 400)
      }
    }

    const profileRecord = {
      user_id: userId,
      age: parsedAge,
      weight_kg: parsedWeight,
      height_cm: parsedHeight,
      known_conditions: Array.isArray(known_conditions) ? known_conditions : [],
      cycle_goal: cycle_goal || null,
      allow_ai_analysis: typeof allow_ai_analysis === 'boolean' ? allow_ai_analysis : true,
      updated_at: new Date().toISOString()
    }

    const supabase = getSupabaseAdmin()
    const { data, error } = await supabase
      .from('user_profiles')
      .upsert(profileRecord, { onConflict: 'user_id' })
      .select()

    if (error) {
      logger.error('Error saving user profile:', error)
      return jsonError('Database error', 500)
    }

    const savedProfile = Array.isArray(data) ? (data[0] || profileRecord) : (data || profileRecord)

    return jsonSuccess({ profile: savedProfile })
  } catch (err) {
    logger.error('Profile POST error:', err)
    return jsonError('Internal Server Error', 500)
  }
}


