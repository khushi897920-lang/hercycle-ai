import { NextResponse } from 'next/server'
import { z } from 'zod'

import { getAuthUserId } from '@/lib/clerk-server'
import { getSupabaseAdmin } from '@/lib/supabase-admin'
import { crudLimiter } from '@/lib/rateLimiter'
import { logger } from '@/lib/logger'
import { isoCalendarDate } from '@/lib/date-schemas'

const dateSchema = isoCalendarDate({ label: 'recorded_date' })

const weightEntrySchema = z.object({
  recorded_date: dateSchema,
  weight_kg: z
    .coerce.number({ required_error: 'weight_kg is required', invalid_type_error: 'weight_kg must be a number' })
    .min(20, 'weight_kg must be at least 20 kg')
    .max(350, 'weight_kg cannot exceed 350 kg'),
  height_cm: z
    .coerce.number({ required_error: 'height_cm is required', invalid_type_error: 'height_cm must be a number' })
    .min(100, 'height_cm must be at least 100 cm')
    .max(250, 'height_cm cannot exceed 250 cm'),
  waist_cm: z
    .coerce.number({ invalid_type_error: 'waist_cm must be a number' })
    .min(30, 'waist_cm must be at least 30 cm')
    .max(250, 'waist_cm cannot exceed 250 cm')
    .nullable()
    .optional(),
})

function calculateBMI(weightKg, heightCm) {
  const heightMetres = heightCm / 100
  return Number((weightKg / (heightMetres * heightMetres)).toFixed(2))
}

async function checkRateLimit(request, method) {
  try {
    await crudLimiter.check(request)
    return null
  } catch (error) {
    logger.warn(`[Rate Limit] Weight ${method}: ${error.message}`)
    return NextResponse.json(
      { success: false, error: 'Too many requests, please slow down.' },
      { status: 429 }
    )
  }
}

export async function GET(request) {
  const rateLimitResponse = await checkRateLimit(request, 'GET')
  if (rateLimitResponse) return rateLimitResponse

  try {
    const userId = await getAuthUserId()
    if (!userId) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const supabaseAdmin = getSupabaseAdmin()
    const { data, error } = await supabaseAdmin
      .from('weight_entries')
      .select('*')
      .eq('user_id', userId)
      .order('recorded_date', { ascending: true })
      .limit(365)

    if (error) {
      logger.error(`Unable to fetch weight entries for ${userId}:`, error.message)
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 500 }
      )
    }

    return NextResponse.json({ success: true, data: data || [] })
  } catch (error) {
    logger.error('Weight GET failed:', error.message || error)
    return NextResponse.json(
      { success: false, error: 'Failed to fetch weight history.' },
      { status: 500 }
    )
  }
}

export async function POST(request) {
  const rateLimitResponse = await checkRateLimit(request, 'POST')
  if (rateLimitResponse) return rateLimitResponse

  try {
    const userId = await getAuthUserId()
    if (!userId) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      )
    }

    let json;
    try {
      json = await request.json();
    } catch (parseError) {
      logger.warn(`Malformed JSON payload in weight POST: ${parseError.message}`);
      return NextResponse.json(
        { success: false, error: 'Bad Request: Invalid JSON payload' },
        { status: 400 }
      );
    }
    const parsed = weightEntrySchema.safeParse(json)

    if (!parsed.success) {
      const errorMessage = parsed.error.issues.map(i => i.message).join('; ')
      logger.warn(`Validation failed for weight POST from user ${userId}: ${errorMessage}`)
      return NextResponse.json(
        {
          success: false,
          error: errorMessage || 'Please check the entered values.',
          details: parsed.error.flatten(),
          issues: parsed.error.issues,
        },
        { status: 400 }
      )
    }

    const { recorded_date, weight_kg, waist_cm = null, height_cm } = parsed.data
    const bmi = calculateBMI(weight_kg, height_cm)

    const supabaseAdmin = getSupabaseAdmin()
    const { data, error } = await supabaseAdmin
      .from('weight_entries')
      .upsert(
        {
          user_id: userId,
          recorded_date,
          weight_kg,
          waist_cm,
          height_cm,
          bmi,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'user_id,recorded_date' }
      )
      .select()
      .single()

    if (error) {
      logger.error(`Unable to save weight entry for ${userId}:`, error.message)
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 500 }
      )
    }

    return NextResponse.json({ success: true, data })
  } catch (error) {
    logger.error('Weight POST failed:', error.message || error)
    return NextResponse.json(
      { success: false, error: 'Failed to save the weight entry.' },
      { status: 500 }
    )
  }
}
