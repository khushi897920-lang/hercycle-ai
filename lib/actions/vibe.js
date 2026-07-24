'use server'

import { auth } from '@clerk/nextjs/server'
import { getSupabaseAdmin } from '@/lib/supabase-admin'
import { sendPartnerNudge } from './partner'

export async function setHerVibe(vibeType, vibeNote = '') {
  const { userId } = await auth()
  if (!userId) throw new Error("Unauthorized")

  const supabase = getSupabaseAdmin()

  const { data: connection } = await supabase
    .from("partner_connections")
    .select("id")
    .eq("primary_user_id", userId)
    .eq("status", "active")
    .maybeSingle()

  if (!connection) return { success: false }

  try {
    const { data } = await supabase
      .from("partner_vibes")
      .insert([{
        connection_id: connection.id,
        vibe_type: vibeType,
        vibe_note: vibeNote || null
      }])
      .select()
      .maybeSingle()

    // Send nudge update for partner
    await sendPartnerNudge('letter', vibeType)

    return { success: true, vibe: data }
  } catch (err) {
    console.error("Error setting vibe:", err)
    return { success: false }
  }
}

export async function getHerLatestVibe() {
  const { userId } = await auth()
  if (!userId) return { vibe: null }

  const supabase = getSupabaseAdmin()

  const { data: connection } = await supabase
    .from("partner_connections")
    .select("id")
    .or(`partner_user_id.eq.${userId},primary_user_id.eq.${userId}`)
    .eq("status", "active")
    .maybeSingle()

  if (!connection) return { vibe: null }

  try {
    const { data: vibes } = await supabase
      .from("partner_vibes")
      .select("*")
      .eq("connection_id", connection.id)
      .order("created_at", { ascending: false })
      .limit(1)

    return { vibe: vibes && vibes.length > 0 ? vibes[0] : null }
  } catch (err) {
    console.error("Error fetching latest vibe:", err)
    return { vibe: null }
  }
}
