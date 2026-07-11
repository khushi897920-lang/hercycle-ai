import { NextResponse } from 'next/server'
import { z } from 'zod'

import { getAuthUserId } from '@/lib/clerk-server'
import { getSupabaseAdmin } from '@/lib/supabase-admin'
import { crudLimiter } from '@/lib/rateLimiter'
import { logger } from '@/lib/logger'

const dateSchema = z.string().regex(
  /^\d{4}-\d{2}-\d{2}$/,
  'Date must use YYYY-MM-DD format'
)

const weightEntrySchema = z.object({
  recorded_date: dateSchema,
  weight_kg: z.coerce.number().min(20).max(350),
  waist_cm: z.coerce.number().min(30).max(250).nullable().optional(),
  height_cm: z.coerce.number().min(100).max(250),
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

    const json = await request.json()
    const parsed = weightEntrySchema.safeParse(json)

    if (!parsed.success) {
      return NextResponse.json(
        {
          success: false,
          error: 'Please check the entered values.',
          details: parsed.error.flatten(),
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
