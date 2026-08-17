import { jsonSuccess, jsonError } from '@/lib/api-helpers'
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
    return jsonError('Too many requests, please slow down.', 429)
  }
  // =======================================

  try {
    const userId = await getAuthUserId()
    if (!userId) {
      logger.warn('Unauthenticated access attempt to Delete Account API')
      return jsonError('Unauthorized', 401)
    }

    // Handle Clerk version differences (v4 vs v5/v6)
    const client = typeof clerkClient === 'function' ? await clerkClient() : clerkClient

    // Deleting the user from Clerk's backend will automatically trigger the user.deleted webhook
    await client.users.deleteUser(userId)

    logger.info(`User ${userId} account deleted successfully via backend API`)
    return jsonSuccess(null, 'Account deleted successfully')
  } catch (error) {
    logger.error(`Error deleting account for user ${userId}: ${error?.message || error}`, error?.stack)
    return jsonError('Failed to delete account', 500)
  }
}

export async function DELETE(request) {
  return POST(request)
}


