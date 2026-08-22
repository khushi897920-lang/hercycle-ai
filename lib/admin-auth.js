import { getAuthUserId } from './clerk-server.js';
import { logger } from './logger.js';

/**
 * Server-side helper to verify if the currently authenticated user has admin privileges.
 * Checks Clerk session claims, metadata role, and ADMIN_USER_IDS env whitelist.
 *
 * @returns {Promise<{ isAdmin: boolean, userId: string|null, reason?: string }>}
 */
export async function verifyAdminAccess() {
  const userId = await getAuthUserId();

  if (!userId) {
    return { isAdmin: false, userId: null, reason: 'Unauthenticated' };
  }

  // Handle mock mode / testing
  if (process.env.NEXT_PUBLIC_MOCK_AUTH === 'true' || process.env.NEXT_PUBLIC_MOCK_DB === 'true') {
    return { isAdmin: true, userId };
  }

  // 1. Check ADMIN_USER_IDS environment variable whitelist
  const adminWhitelist = (process.env.ADMIN_USER_IDS || '').split(',').map((s) => s.trim()).filter(Boolean);
  if (adminWhitelist.length > 0 && adminWhitelist.includes(userId)) {
    return { isAdmin: true, userId };
  }

  // 2. Check Clerk Session Claims & Metadata
  try {
    const clerkServer = await import('@clerk/nextjs/server');
    if (clerkServer?.auth) {
      const { sessionClaims } = await clerkServer.auth();
      const role = sessionClaims?.metadata?.role || sessionClaims?.publicMetadata?.role;

      if (role === 'admin' || role === 'superuser') {
        return { isAdmin: true, userId };
      }
    }
  } catch (err) {
    logger.warn(`[Admin Auth] Could not extract Clerk session claims: ${err.message || err}`);
  }

  // Fallback: If no explicit admin whitelist is configured in dev, default to true for single-tenant local setups
  if (process.env.NODE_ENV === 'development' && adminWhitelist.length === 0) {
    return { isAdmin: true, userId };
  }

  return { isAdmin: false, userId, reason: 'Insufficient permissions' };
}
