"use server";

import { auth, clerkClient } from "@clerk/nextjs/server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import crypto from "crypto";

// Helper to generate a random 6-character alphanumeric code
function generateCode() {
  return crypto.randomBytes(3).toString("hex").toUpperCase();
}

/**
 * Generates a new pairing code for the primary user.
 * If one already exists (pending), returns the existing one.
 */
export async function generatePairingCode() {
  const { userId } = await auth();
  if (!userId) throw new Error("Unauthorized");

  const supabase = getSupabaseAdmin();

  // Check if a pending code already exists
  const { data: existing } = await supabase
    .from("partner_connections")
    .select("pairing_code")
    .eq("primary_user_id", userId)
    .eq("status", "pending")
    .single();

  if (existing) {
    return { code: existing.pairing_code };
  }

  const code = generateCode();
  
  const { data, error } = await supabase
    .from("partner_connections")
    .insert([
      {
        primary_user_id: userId,
        pairing_code: code,
        status: "pending"
      }
    ])
    .select()
    .single();

  if (error) {
    console.error("Error generating code:", error);
    throw new Error("Failed to generate pairing code");
  }

  // Create default permissions
  await supabase.from("partner_permissions").insert([
    { connection_id: data.id }
  ]);

  return { code };
}

/**
 * Accepts a pairing code as a partner user.
 */
export async function acceptPairingCode(code) {
  const { userId } = await auth();
  if (!userId) throw new Error("Unauthorized");

  const supabase = getSupabaseAdmin();

  // Find the pending connection
  const { data: connection, error: findError } = await supabase
    .from("partner_connections")
    .select("*")
    .eq("pairing_code", code.toUpperCase())
    .eq("status", "pending")
    .single();

  if (findError || !connection) {
    throw new Error("Invalid or expired pairing code");
  }

  // Update connection to active and set partner_user_id
  const { error: updateError } = await supabase
    .from("partner_connections")
    .update({ status: "active", partner_user_id: userId })
    .eq("id", connection.id);

  if (updateError) {
    console.error("Error accepting code:", updateError);
    throw new Error("Failed to accept pairing code");
  }

  // Update Clerk metadata
  const client = await clerkClient();
  await client.users.updateUserMetadata(userId, {
    publicMetadata: { role: "partner" }
  });

  return { success: true };
}

export async function setPrimaryRole() {
  const { userId } = await auth();
  if (!userId) throw new Error("Unauthorized");

  const client = await clerkClient();
  await client.users.updateUserMetadata(userId, {
    publicMetadata: { role: "primary" }
  });

  return { success: true };
}

/**
 * Disconnects a partner connection. Can be called by primary or partner.
 */
export async function disconnectPartner(connectionId) {
  const { userId } = await auth();
  if (!userId) throw new Error("Unauthorized");

  const supabase = getSupabaseAdmin();

  // Ensure the user is either the primary or the partner
  const { data: connection } = await supabase
    .from("partner_connections")
    .select("*")
    .eq("id", connectionId)
    .single();

  if (!connection) {
    throw new Error("Connection not found");
  }

  if (connection.primary_user_id !== userId && connection.partner_user_id !== userId) {
    throw new Error("Unauthorized");
  }

  const { error } = await supabase
    .from("partner_connections")
    .delete()
    .eq("id", connectionId);

  if (error) {
    console.error("Error disconnecting partner:", error);
    throw new Error("Failed to disconnect");
  }

  return { success: true };
}

/**
 * Disconnects the active partner and resets their role.
 */
export async function disconnectAsPartner() {
  const { userId } = await auth();
  if (!userId) throw new Error("Unauthorized");

  const supabase = getSupabaseAdmin();

  const { data: connection } = await supabase
    .from("partner_connections")
    .select("*")
    .eq("partner_user_id", userId)
    .single();

  if (connection) {
    await supabase
      .from("partner_connections")
      .delete()
      .eq("id", connection.id);
  }

  // Reset Clerk role
  const client = await clerkClient();
  await client.users.updateUserMetadata(userId, {
    publicMetadata: { role: null }
  });

  return { success: true };
}

/**
 * Get current partner connection for the primary user.
 */
export async function getPrimaryUserConnection() {
  const { userId } = await auth();
  if (!userId) return null;

  const supabase = getSupabaseAdmin();
  
  const { data } = await supabase
    .from("partner_connections")
    .select(`
      *,
      partner_permissions(*)
    `)
    .eq("primary_user_id", userId)
    .maybeSingle();

  return data;
}

/**
 * Get the connection for the partner user.
 */
export async function getPartnerConnection() {
  const { userId } = await auth();
  if (!userId) return null;

  const supabase = getSupabaseAdmin();

  const { data } = await supabase
    .from("partner_connections")
    .select(`
      *,
      partner_permissions(*)
    `)
    .eq("partner_user_id", userId)
    .eq("status", "active")
    .maybeSingle();

  return data;
}

/**
 * Update permissions for a connection. Only primary user can do this.
 */
export async function updatePartnerPermissions(connectionId, updates) {
  const { userId } = await auth();
  if (!userId) throw new Error("Unauthorized");

  const supabase = getSupabaseAdmin();

  // Verify ownership
  const { data: connection } = await supabase
    .from("partner_connections")
    .select("*")
    .eq("id", connectionId)
    .eq("primary_user_id", userId)
    .single();

  if (!connection) {
    throw new Error("Unauthorized or connection not found");
  }

  // Allowlist: only these 4 boolean flags may be updated.
  // Any extra keys supplied by the caller (connection_id, id, user_id, etc.) are silently dropped.
  const { show_mood, show_symptoms, show_fertile_window, show_notes } = updates;
  const safeUpdates = { show_mood, show_symptoms, show_fertile_window, show_notes };

  // Guard: reject if caller passed nothing but disallowed fields
  if (Object.values(safeUpdates).every(v => v === undefined)) {
    throw new Error("No valid permission fields provided.");
  }

  const { error } = await supabase
    .from("partner_permissions")
    .update(safeUpdates)
    .eq("connection_id", connectionId);

  if (error) {
    console.error("Error updating permissions:", error);
    throw new Error("Failed to update permissions");
  }

  return { success: true };
}

/**
 * Fetches real shared insights for the partner.
 * Reads the primary user's cycles + daily_logs, filtered by permissions.
 */
export async function getSharedInsights() {
  const { userId } = await auth();
  if (!userId) throw new Error("Unauthorized");

  const supabase = getSupabaseAdmin();

  // 1. Get the active connection and permissions
  const { data: connection } = await supabase
    .from("partner_connections")
    .select(`*, partner_permissions(*)`)
    .eq("partner_user_id", userId)
    .eq("status", "active")
    .maybeSingle();

  if (!connection) {
    return { connected: false };
  }

  const perms = connection.partner_permissions?.[0] || {};
  const primaryUserId = connection.primary_user_id;

  // 2. Fetch the primary user's cycles (last 12, sorted newest first)
  const { data: cycles } = await supabase
    .from("cycles")
    .select("*")
    .eq("user_id", primaryUserId)
    .order("start_date", { ascending: false })
    .limit(12);

  // 3. Fetch today's daily log for mood/symptoms/flow
  const today = new Date().toISOString().split("T")[0];
  const { data: todayLog } = await supabase
    .from("daily_logs")
    .select("*")
    .eq("user_id", primaryUserId)
    .eq("date", today)
    .maybeSingle();

  // 4. Compute cycle phase and day
  const sortedCycles = (cycles || []).sort(
    (a, b) => new Date(b.start_date) - new Date(a.start_date)
  );

  let phase = null;
  let cycleDay = null;
  let avgCycleLength = 28;
  let expectedPeriod = null;
  let fertileWindow = null;

  if (sortedCycles.length > 0) {
    const lastCycle = sortedCycles[0];
    const lastStart = new Date(lastCycle.start_date);
    const todayDate = new Date(today);
    const daysSinceStart = Math.floor(
      (todayDate - lastStart) / (1000 * 60 * 60 * 24)
    );

    avgCycleLength = lastCycle.cycle_length || 28;

    // Calculate average from history if we have multiple cycles
    if (sortedCycles.length >= 2) {
      const chronological = [...sortedCycles].reverse();
      let totalLen = 0;
      let count = 0;
      for (let i = 1; i < chronological.length; i++) {
        const gap = Math.round(
          (new Date(chronological[i].start_date) - new Date(chronological[i - 1].start_date)) /
            (1000 * 60 * 60 * 24)
        );
        if (gap >= 20 && gap <= 45) {
          totalLen += gap;
          count++;
        }
      }
      if (count > 0) avgCycleLength = Math.round(totalLen / count);
    }

    cycleDay = daysSinceStart + 1; // 1-indexed

    // Determine phase
    const periodLength = lastCycle.end_date
      ? Math.floor(
          (new Date(lastCycle.end_date) - lastStart) / (1000 * 60 * 60 * 24)
        ) + 1
      : 5; // default period length

    if (daysSinceStart < periodLength && (!lastCycle.end_date || todayDate <= new Date(lastCycle.end_date))) {
      phase = "Menstrual";
    } else if (daysSinceStart < Math.round(avgCycleLength * 0.38)) {
      phase = "Follicular";
    } else if (daysSinceStart < Math.round(avgCycleLength * 0.5)) {
      phase = "Ovulation";
    } else {
      phase = "Luteal";
    }

    // Expected next period
    const nextPeriodDate = new Date(lastStart);
    nextPeriodDate.setDate(nextPeriodDate.getDate() + avgCycleLength);
    const months = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
    expectedPeriod = `${months[nextPeriodDate.getMonth()]} ${nextPeriodDate.getDate()}, ${nextPeriodDate.getFullYear()}`;

    // Fertile window (ovulation day ~14 days before next period, window is ±2 days)
    if (perms.show_fertile_window) {
      const ovulationDay = avgCycleLength - 14;
      const fertileStart = new Date(lastStart);
      fertileStart.setDate(fertileStart.getDate() + ovulationDay - 2);
      const fertileEnd = new Date(lastStart);
      fertileEnd.setDate(fertileEnd.getDate() + ovulationDay + 2);
      fertileWindow = {
        start: `${months[fertileStart.getMonth()]} ${fertileStart.getDate()}`,
        end: `${months[fertileEnd.getMonth()]} ${fertileEnd.getDate()}`,
      };
    }
  }

  // 5. Build the response, only including permitted fields
  const result = {
    connected: true,
    phase,
    cycleDay,
    avgCycleLength,
    expectedPeriod,
    fertileWindow,
    flow: todayLog?.flow || null,
    mood: perms.show_mood ? (todayLog?.mood || null) : null,
    symptoms: perms.show_symptoms ? (todayLog?.symptoms || []) : null,
    lastLoggedAt: todayLog?.updated_at || null,
    permissions: {
      show_mood: !!perms.show_mood,
      show_symptoms: !!perms.show_symptoms,
      show_fertile_window: !!perms.show_fertile_window,
      show_notes: !!perms.show_notes,
    },
  };

  return result;
}
