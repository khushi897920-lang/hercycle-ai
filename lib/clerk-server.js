import { auth } from '@clerk/nextjs/server'
import { getSupabaseAdmin } from './supabase-admin'
import { logger } from './logger'

/** Returns the authenticated user's Clerk ID, or null if not logged in */
export async function getAuthUserId() {
  const { userId } = await auth({ clockSkewInMs: 30000 })
  return userId ?? null
}

/** Ensures that a record for the Clerk user exists in the public.users table (important for FK cascading constraints) */
export async function ensureUserExists(userId) {
  if (!userId) return;
  try {
    const supabaseAdmin = getSupabaseAdmin()
    const { data, error } = await supabaseAdmin
      .from('users')
      .select('id')
      .eq('id', userId)
      .maybeSingle()

    if (error) {
      logger.error(`Error checking user existence: ${error.message}`);
      return;
    }

    if (!data) {
      logger.info(`User ${userId} not found in database. Inserting dynamically...`);
      const { error: insertError } = await supabaseAdmin
        .from('users')
        .insert([{ id: userId }])
      if (insertError) {
        logger.error(`Failed to insert user dynamically: ${insertError.message}`);
      }
    }
  } catch (err) {
    logger.error(`ensureUserExists failed: ${err.message || err}`);
  }
}
