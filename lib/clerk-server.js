import { getSupabaseAdmin } from './supabase-admin.js'
import { logger } from './logger.js'

/** Returns the authenticated user's Clerk ID, or null if not logged in */
export async function getAuthUserId() {
  if (process.env.NEXT_PUBLIC_MOCK_AUTH === 'true') {
    try {
      const nextHeaders = await import('next/headers')
      if (nextHeaders?.headers) {
        const headersList = await nextHeaders.headers()
        if (headersList.get('x-mock-unauthorized') === 'true') {
          return null
        }
      }
    } catch (e) {
      // ignore
    }
    return process.env.MOCK_USER_ID || 'mock_user_12345'
  }
  try {
    const clerkServer = await import('@clerk/nextjs/server')
    if (clerkServer?.auth) {
      const { userId } = await clerkServer.auth({ clockSkewInMs: 30000 })
      return userId ?? null
    }
  } catch (err) {
    logger.warn(`[Clerk Auth] Failed to authenticate user: ${err.message || err}`)
  }
  return null
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
