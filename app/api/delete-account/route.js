import { getAuthUserId } from '@/lib/clerk-server'
import { clerkClient } from '@clerk/nextjs/server'
import { logger } from '@/lib/logger'
import { crudLimiter } from '@/lib/rateLimiter'

export const dynamic = 'force-dynamic'

export async function POST(request) {
  // ============ RATE LIMITING ============
  try {
    await crudLimiter.check(request)
  } catch (rateLimitError) {
    logger.warn(`[Rate Limit] Delete account endpoint: ${rateLimitError.message}`)
    return new Response(JSON.stringify({ error: 'Too many requests, please slow down.' }), {
      status: 429,
      headers: { 'Content-Type': 'application/json' },
    })
  }
  // =======================================

  try {
    const userId = await getAuthUserId()
    if (!userId) {
      logger.warn('Unauthenticated access attempt to Delete Account API')
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    // Handle Clerk version differences (v4 vs v5/v6)
    const client = typeof clerkClient === 'function' ? await clerkClient() : clerkClient
    
    // Deleting the user from Clerk's backend will automatically trigger the user.deleted webhook
    await client.users.deleteUser(userId)

    logger.info(`User ${userId} account deleted successfully via backend API`)
    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    })
  } catch (error) {
    logger.error(`Error deleting account: ${error.message}`, error.stack)
    return new Response(JSON.stringify({ error: 'Failed to delete account' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    })
  }
}
