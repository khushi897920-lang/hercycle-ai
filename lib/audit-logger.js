import { getSupabaseAdmin } from './supabase-admin.js';
import { logger } from './logger.js';

/**
 * Logs a GDPR compliance audit event to the audit_log table.
 *
 * @param {Object} params
 * @param {string} params.userId - Clerk User ID
 * @param {string} params.action - Event action (e.g. 'DATA_EXPORT', 'ACCOUNT_DELETION', 'PRIVACY_UPDATE')
 * @param {Object} [params.details] - Additional event details or metadata
 * @param {string} [params.ipAddress] - Optional IP address of client
 */
export async function logAuditEvent({ userId, action, details = {}, ipAddress = null }) {
  if (!userId || !action) {
    logger.warn('[Audit Logger] Cannot log audit event: missing userId or action');
    return null;
  }

  try {
    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from('audit_log')
      .insert([
        {
          user_id: userId,
          action,
          details,
          ip_address: ipAddress,
          created_at: new Date().toISOString(),
        },
      ])
      .select()
      .maybeSingle();

    if (error) {
      logger.error(`[Audit Logger] Failed to log ${action} event for ${userId}: ${error.message}`);
      return null;
    }

    logger.info(`[Audit Logger] Recorded audit event '${action}' for user ${userId}`);
    return data;
  } catch (err) {
    logger.error(`[Audit Logger] Exception logging audit event: ${err.message || err}`);
    return null;
  }
}
