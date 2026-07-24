'use server'

import { auth } from '@clerk/nextjs/server'
import { getSupabaseAdmin } from '@/lib/supabase-admin'
import { sendPartnerNudge } from './partner'

const DEFAULT_QUESTS = [
  "🍵 Prepared warm herbal tea for her",
  "🍫 Brought dark chocolate snacks",
  "🫂 Gave a relaxing 10-minute shoulder massage",
  "💧 Filled her water bottle for hydration",
  "🧺 Took care of household chores today"
]

export async function getPartnerQuests() {
  const { userId } = await auth()
  if (!userId) return { connected: false, quests: [] }

  const supabase = getSupabaseAdmin()

  const { data: connection } = await supabase
    .from("partner_connections")
    .select("id")
    .or(`partner_user_id.eq.${userId},primary_user_id.eq.${userId}`)
    .eq("status", "active")
    .maybeSingle()

  if (!connection) return { connected: false, quests: [] }

  try {
    const { data: quests } = await supabase
      .from("partner_quests")
      .select("*")
      .eq("connection_id", connection.id)
      .order("created_at", { ascending: false })

    if (!quests || quests.length === 0) {
      // Seed default quests for new connection
      const seedPayload = DEFAULT_QUESTS.map(title => ({
        connection_id: connection.id,
        quest_title: title,
        completed: false
      }))
      const { data: seeded } = await supabase.from("partner_quests").insert(seedPayload).select()
      return { connected: true, quests: seeded || [] }
    }

    return { connected: true, quests: quests || [] }
  } catch (err) {
    console.error("Error fetching partner quests:", err)
    return { connected: true, quests: [] }
  }
}

export async function togglePartnerQuest(questId, currentCompleted, questTitle) {
  const { userId } = await auth()
  if (!userId) throw new Error("Unauthorized")

  const supabase = getSupabaseAdmin()

  const nextState = !currentCompleted

  const { error } = await supabase
    .from("partner_quests")
    .update({
      completed: nextState,
      completed_at: nextState ? new Date().toISOString() : null
    })
    .eq("id", questId)

  if (error) {
    console.error("Error updating quest:", error)
    throw new Error("Failed to update quest state")
  }

  return { success: true, completed: nextState }
}
