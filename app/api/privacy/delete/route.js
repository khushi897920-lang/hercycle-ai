import { getAuthUserId } from '@/lib/clerk-server';
import { clerkClient } from '@clerk/nextjs/server';
import { logger } from '@/lib/logger';
import { crudLimiter } from '@/lib/rateLimiter';
import { jsonSuccess, jsonError } from '@/lib/api-helpers';
import { purgeUserData } from '@/lib/user-purge';
import { logAuditEvent } from '@/lib/audit-logger';

export const dynamic = 'force-dynamic';

export async function POST(request) {
  try {
    await crudLimiter.check(request);
  } catch (rateLimitError) {
    logger.warn(`[Rate Limit] Privacy delete endpoint: ${rateLimitError.message}`);
    return jsonError('Too many requests, please slow down.', 429);
  }

  try {
    const userId = await getAuthUserId();
    if (!userId) {
      logger.warn('Unauthenticated access attempt to Privacy Delete API');
      return jsonError('Unauthorized', 401);
    }

    // 1. Log GDPR audit compliance record before purging rows
    await logAuditEvent({
      userId,
      action: 'ACCOUNT_DELETION',
      details: {
        timestamp: new Date().toISOString(),
        initiatedVia: 'self_service_privacy_modal',
      },
    });

    // 2. Perform cascading deletion across all database tables
    const purgeResult = await purgeUserData(userId);

    // 3. Revoke Clerk authentication sessions & delete user from auth backend
    try {
      const client = typeof clerkClient === 'function' ? await clerkClient() : clerkClient;
      if (client?.users?.deleteUser) {
        await client.users.deleteUser(userId);
      }
    } catch (clerkErr) {
      logger.warn(`Clerk deleteUser warning for ${userId}: ${clerkErr.message}`);
    }

    logger.info(`GDPR Account deletion executed for user ${userId}, auditHash: ${purgeResult.auditHash}`);
    return jsonSuccess(
      { auditHash: purgeResult.auditHash, success: true },
      'Account and associated user data permanently purged.'
    );
  } catch (error) {
    logger.error('Error in privacy account deletion handler:', error.message || error);
    return jsonError(`Failed to delete account: ${error.message || error}`, 500);
  }
}

export async function DELETE(request) {
  return POST(request);
}
