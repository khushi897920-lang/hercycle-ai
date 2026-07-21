"use server";

import { auth, clerkClient } from "@clerk/nextjs/server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { ensureUserExists } from "@/lib/clerk-server";
import { sendServerPushToUser } from "@/lib/actions/push";
import crypto from "crypto";

// ─── Pairing Code Config ───────────────────────────────────
const CODE_EXPIRY_MS = 10 * 60 * 1000;       // 10 minutes
const MAX_ATTEMPTS_PER_MIN = 5;               // rate limit
const LOCKOUT_THRESHOLD = 10;                 // consecutive failures before lockout
const LOCKOUT_DURATION_MS = 15 * 60 * 1000;   // 15-minute lockout

// In-memory attempt tracker (keyed by userId)
const pairingAttempts = new Map();

function getAttemptRecord(userId) {
  if (!pairingAttempts.has(userId)) {
    pairingAttempts.set(userId, { count: 0, windowStart: Date.now(), consecutiveFails: 0, lockedUntil: 0 });
  }
  return pairingAttempts.get(userId);
}

// Helper to generate a random 12-character hex code (6 bytes = 281 trillion values)
function generateCode() {
  return crypto.randomBytes(6).toString("hex").toUpperCase();
}

/**
 * Generates a new pairing code for the primary user.
 * If one already exists (pending), returns the existing one.
 */
export async function generatePairingCode() {
  const { userId } = await auth();
  if (!userId) throw new Error("Unauthorized");

  await ensureUserExists(userId);

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
        status: "pending",
        created_at: new Date().toISOString()
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
 * Protected by: rate limiting, lockout after consecutive failures, and code expiry.
 */
export async function acceptPairingCode(code) {
  const { userId } = await auth();
  if (!userId) throw new Error("Unauthorized");

  const cleanCode = code ? code.trim().toUpperCase().replace(/[^0-9A-F]/g, "") : "";
  if (!cleanCode || cleanCode.length < 12) {
    throw new Error("Please enter a valid 12-character pairing code");
  }

  // ── Lockout check ──
  const record = getAttemptRecord(userId);
  const now = Date.now();

  if (record.lockedUntil > now) {
    const minsLeft = Math.ceil((record.lockedUntil - now) / 60000);
    throw new Error(`Too many failed attempts. Try again in ${minsLeft} minute(s).`);
  }

  // ── Rate limit check (sliding 1-min window) ──
  if (now - record.windowStart > 60000) {
    record.count = 0;
    record.windowStart = now;
  }
  record.count += 1;
  if (record.count > MAX_ATTEMPTS_PER_MIN) {
    throw new Error("Too many pairing attempts. Please wait a minute.");
  }

  const supabase = getSupabaseAdmin();

  // 1. Check if this code is ALREADY active for this partner
  const { data: alreadyActive } = await supabase
    .from("partner_connections")
    .select("*")
    .eq("pairing_code", cleanCode)
    .eq("partner_user_id", userId)
    .eq("status", "active")
    .maybeSingle();

  if (alreadyActive) {
    try {
      const client = await clerkClient();
      await client.users.updateUserMetadata(userId, {
        publicMetadata: { role: "partner" }
      });
    } catch (e) {
      console.warn("Clerk metadata update warning:", e);
    }
    return { success: true };
  }

  // 2. Find the pending connection
  const { data: connection, error: findError } = await supabase
    .from("partner_connections")
    .select("*")
    .eq("pairing_code", cleanCode)
    .eq("status", "pending")
    .maybeSingle();

  if (findError || !connection) {
    record.consecutiveFails += 1;
    if (record.consecutiveFails >= LOCKOUT_THRESHOLD) {
      record.lockedUntil = now + LOCKOUT_DURATION_MS;
      record.consecutiveFails = 0;
      throw new Error("Too many failed attempts. You have been locked out for 15 minutes.");
    }
    throw new Error("Invalid or expired pairing code. Please generate a new code in Settings.");
  }

  // Guard: prevent primary user from pairing with themselves
  if (connection.primary_user_id === userId) {
    throw new Error("You cannot pair with yourself! Please log into a separate partner account.");
  }

  // ── Expiry check ──
  const createdAt = new Date(connection.created_at).getTime();
  if (now - createdAt > CODE_EXPIRY_MS) {
    await supabase.from("partner_connections").delete().eq("id", connection.id);
    throw new Error("This pairing code has expired. Please generate a new one in Settings.");
  }

  record.consecutiveFails = 0;

  // Ensure partner user exists in public.users to satisfy FK constraint
  await ensureUserExists(userId);

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
  try {
    const client = await clerkClient();
    await client.users.updateUserMetadata(userId, {
      publicMetadata: { role: "partner" }
    });
  } catch (err) {
    console.warn("Clerk metadata update warning:", err);
  }

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

import { 
  getBiologicalPhaseContext, 
  getActionableCareTips, 
  calculateEnergyBattery, 
  getPmsAlert 
} from "@/lib/partner-insights";

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

  // Allowlist: boolean flags that may be updated.
  const { show_mood, show_symptoms, show_fertile_window, show_notes, show_care_tips, show_energy_battery } = updates;
  const safeUpdates = { show_mood, show_symptoms, show_fertile_window, show_notes, show_care_tips, show_energy_battery };

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

  // 5. Compute enhanced biological insights
  const symptomsList = perms.show_symptoms ? (todayLog?.symptoms || []) : [];
  const phaseContext = phase ? getBiologicalPhaseContext(phase) : null;
  const careTips = (perms.show_care_tips !== false && phase)
    ? getActionableCareTips(phase, symptomsList, todayLog?.flow)
    : [];
  const energyBattery = (perms.show_energy_battery !== false && phase)
    ? calculateEnergyBattery(phase, cycleDay, symptomsList)
    : null;
  const pmsAlert = phase ? getPmsAlert(phase, cycleDay) : { active: false };

  // Fetch recent partner nudges/letters
  let recentNudges = [];
  try {
    const { data: nudges } = await supabase
      .from("partner_nudges")
      .select("*")
      .eq("connection_id", connection.id)
      .order("created_at", { ascending: true })
      .limit(30);
    recentNudges = nudges || [];
  } catch (e) {
    // If partner_nudges table not migrated yet, fall back gracefully
    recentNudges = [];
  }

  // 6. Build the response, only including permitted fields
  const result = {
    connected: true,
    connectionId: connection.id,
    currentUserId: userId,
    phase,
    cycleDay,
    avgCycleLength,
    expectedPeriod,
    fertileWindow,
    flow: todayLog?.flow || null,
    mood: perms.show_mood ? (todayLog?.mood || null) : null,
    symptoms: symptomsList,
    lastLoggedAt: todayLog?.updated_at || null,
    phaseContext,
    careTips,
    energyBattery,
    pmsAlert,
    recentNudges,
    permissions: {
      show_mood: !!perms.show_mood,
      show_symptoms: !!perms.show_symptoms,
      show_fertile_window: !!perms.show_fertile_window,
      show_notes: !!perms.show_notes,
      show_care_tips: perms.show_care_tips !== false,
      show_energy_battery: perms.show_energy_battery !== false,
    },
  };

  return result;
}

/**
 * Sends a partner nudge or cute love letter.
 */
export async function sendPartnerNudge(nudgeType, message = null) {
  const { userId } = await auth();
  if (!userId) throw new Error("Unauthorized");

  const supabase = getSupabaseAdmin();

  // Get active connection (for partner or primary user)
  const { data: connection, error: connError } = await supabase
    .from("partner_connections")
    .select("id")
    .or(`partner_user_id.eq.${userId},primary_user_id.eq.${userId}`)
    .eq("status", "active")
    .maybeSingle();

  if (connError || !connection) {
    throw new Error("No active partner connection found. Please pair with your partner first.");
  }

  const payload = {
    connection_id: connection.id,
    nudge_type: nudgeType,
    message: message ? message.trim() : null,
    sender_id: userId,
  };

  let { data, error } = await supabase
    .from("partner_nudges")
    .insert([payload])
    .select()
    .maybeSingle();

  // If sender_id column is missing in Supabase DB table, retry without sender_id
  if (error && (error.code === '42703' || error.message?.includes('sender_id') || error.message?.includes('column'))) {
    delete payload.sender_id;
    const retry = await supabase
      .from("partner_nudges")
      .insert([payload])
      .select()
      .maybeSingle();
    data = retry.data;
    error = retry.error;
  }

  if (error) {
    console.error("Error sending nudge:", error);
    if (error.code === '42P01' || error.message?.includes('partner_nudges') || error.message?.includes('relation')) {
      throw new Error("Database table missing: Please run 03_enhance_partner_schema.sql in your Supabase SQL editor.");
    }
    throw new Error(error.message || "Failed to send love note");
  }

  // Trigger background server push notification to recipient's phone/desktop
  const recipientUserId = connection.primary_user_id === userId ? connection.partner_user_id : connection.primary_user_id;
  if (recipientUserId) {
    sendServerPushToUser(recipientUserId, {
      title: 'New Love Note 💌',
      body: message || `Sent a ${nudgeType} 💕`,
    }).catch(() => {});
  }

  return { success: true, nudge: data };
}

/**
 * Deletes a single partner nudge by ID.
 */
export async function deletePartnerNudge(nudgeId) {
  const { userId } = await auth();
  if (!userId) throw new Error("Unauthorized");

  const supabase = getSupabaseAdmin();

  // Find active connection for user
  const { data: connection } = await supabase
    .from("partner_connections")
    .select("id")
    .or(`partner_user_id.eq.${userId},primary_user_id.eq.${userId}`)
    .eq("status", "active")
    .maybeSingle();

  if (!connection) {
    throw new Error("No active partner connection found");
  }

  const { error } = await supabase
    .from("partner_nudges")
    .delete()
    .eq("id", nudgeId)
    .eq("connection_id", connection.id);

  if (error) {
    console.error("Error deleting nudge:", error);
    throw new Error("Failed to delete message");
  }

  return { success: true };
}

/**
 * Clears all partner love notes / nudges for an active connection.
 */
export async function clearPartnerNudges() {
  const { userId } = await auth();
  if (!userId) throw new Error("Unauthorized");

  const supabase = getSupabaseAdmin();

  // Find active connection for primary or partner user
  const { data: connection } = await supabase
    .from("partner_connections")
    .select("id")
    .or(`partner_user_id.eq.${userId},primary_user_id.eq.${userId}`)
    .eq("status", "active")
    .maybeSingle();

  if (!connection) {
    throw new Error("No active partner connection found");
  }

  const { error } = await supabase
    .from("partner_nudges")
    .delete()
    .eq("connection_id", connection.id);

  if (error) {
    console.error("Error clearing nudges:", error);
    throw new Error("Failed to clear chat history");
  }

  return { success: true };
}

/**
 * Fetches recent partner nudges and love letters for the primary user's dashboard.
 */
export async function getPrimaryPartnerNudges() {
  const { userId } = await auth();
  if (!userId) return { connected: false, nudges: [], currentUserId: null };

  const supabase = getSupabaseAdmin();

  // Find active connection for primary user
  const { data: connection } = await supabase
    .from("partner_connections")
    .select("id")
    .eq("primary_user_id", userId)
    .eq("status", "active")
    .maybeSingle();

  if (!connection) {
    return { connected: false, nudges: [], currentUserId: userId };
  }

  try {
    const { data: nudges } = await supabase
      .from("partner_nudges")
      .select("*")
      .eq("connection_id", connection.id)
      .order("created_at", { ascending: true })
      .limit(30);

    return { connected: true, nudges: nudges || [], currentUserId: userId };
  } catch (err) {
    console.error("Error fetching primary partner nudges:", err);
    return { connected: true, nudges: [], currentUserId: userId };
  }
}

/**
 * Marks incoming partner nudges/messages as read for the active connection.
 */
export async function markPartnerNudgesAsRead() {
  const { userId } = await auth();
  if (!userId) return { success: false };

  const supabase = getSupabaseAdmin();

  // Find active connection for primary or partner user
  const { data: connection } = await supabase
    .from("partner_connections")
    .select("id")
    .or(`partner_user_id.eq.${userId},primary_user_id.eq.${userId}`)
    .eq("status", "active")
    .maybeSingle();

  if (!connection) return { success: false };

  try {
    // Update all incoming nudges sent by partner where read_at is null
    await supabase
      .from("partner_nudges")
      .update({ read_at: new Date().toISOString() })
      .eq("connection_id", connection.id)
      .neq("sender_id", userId)
      .is("read_at", null);

    return { success: true };
  } catch (err) {
    console.error("Error marking nudges as read:", err);
    return { success: false };
  }
}
