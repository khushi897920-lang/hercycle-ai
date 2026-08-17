import { jsonSuccess, jsonError } from '@/lib/api-helpers'
import { Webhook } from 'svix'
import { getSupabaseAdmin } from '@/lib/supabase-admin'
import { logger } from '@/lib/logger'

async function isDuplicateEvent(supabaseAdmin, eventId) {
  const { data: existingEvent } = await supabaseAdmin
    .from('clerk_webhook_audit')
    .select('event_id')
    .eq('event_id', eventId)
    .maybeSingle()

  return Boolean(existingEvent)
}

async function recordAuditEvent(supabaseAdmin, eventId, eventType) {
  const { error: auditError } = await supabaseAdmin
    .from('clerk_webhook_audit')
    .insert({ event_id: eventId, event_type: eventType })

  if (auditError) {
    logger.error(`Webhook: failed to record audit event ${eventId}:`, auditError.message);
  }
}

export async function POST(request) {
  // 1. Retrieve webhook secret
  const WEBHOOK_SECRET = process.env.CLERK_WEBHOOK_SECRET
  if (!WEBHOOK_SECRET) {
    logger.error('CLERK_WEBHOOK_SECRET is missing in environment variables.');
    return jsonError('Webhook configuration error', 500)
  }

  // 2. Fetch Svix headers for signature verification
  const headerPayload = request.headers
  const svix_id = headerPayload.get("svix-id")
  const svix_timestamp = headerPayload.get("svix-timestamp")
  const svix_signature = headerPayload.get("svix-signature")

  if (!svix_id || !svix_timestamp || !svix_signature) {
    logger.warn('Missing Svix signature headers in webhook request');
    return jsonError('Missing svix headers', 400)
  }

  // 3. Retrieve raw request body text
  const payload = await request.text()

  let evt
  // 4. Verify signature using Clerk's official standard Svix library
  try {
    const wh = new Webhook(WEBHOOK_SECRET)
    evt = wh.verify(payload, {
      "svix-id": svix_id,
      "svix-timestamp": svix_timestamp,
      "svix-signature": svix_signature,
    })
  } catch (err) {
    logger.error('Clerk Webhook signature verification failed:', err.message || err);
    return jsonError('Invalid signature', 400)
  }

  const eventType = evt.type
  const eventId = svix_id
  const supabaseAdmin = getSupabaseAdmin()

  // 5. Deduplicate across ALL event types before any database write.
  try {
    if (await isDuplicateEvent(supabaseAdmin, eventId)) {
      logger.warn(`Duplicate Clerk webhook delivery ignored. Event ID: ${eventId}, type: ${eventType}`);
      return jsonSuccess({ duplicate: true }, 'Webhook already processed');
    }
  } catch (err) {
    logger.error(`Webhook: duplicate check failed for event ${eventId}:`, err.message || err);
  }

  logger.info(`Received Clerk webhook event: ${eventType}`);

  if (eventType === 'user.created') {
    const { id: clerkUserId } = evt.data
    try {
      const { error } = await supabaseAdmin
        .from('users')
        .upsert([{ id: clerkUserId }], { onConflict: 'id' })

      if (error) {
        logger.error(`Webhook: failed to upsert user ${clerkUserId}:`, error.message);
        throw new Error(error.message);
      }

      await recordAuditEvent(supabaseAdmin, eventId, eventType);

      logger.info(`Webhook user.created: Upserted user ${clerkUserId}`);
      return jsonSuccess(null, 'User created successfully')
    } catch (err) {
      logger.error(`Webhook: user creation failed for user ${clerkUserId}:`, err.message || err);
      return jsonError('Database operation failed', 500)
    }
  }

  if (eventType === 'user.deleted') {
    const { id: clerkUserId } = evt.data

    if (!clerkUserId) {
      logger.warn('Webhook user.deleted event contains no user id');
      return jsonError('Missing user id', 400)
    }

    try {
      logger.info(`Webhook user.deleted: Purging database records for user ${clerkUserId}`);

      // Delete from users table (cascades to cycles and daily_logs)
      const { error } = await supabaseAdmin
        .from('users')
        .delete()
        .eq('id', clerkUserId)

      if (error) {
        logger.error(`Webhook: failed to delete user ${clerkUserId}:`, error.message);
        throw new Error(error.message);
      }

      await recordAuditEvent(supabaseAdmin, eventId, eventType);

      logger.info(`Webhook user.deleted: Successfully purged all database records for user ${clerkUserId}`);
      return jsonSuccess(null, 'User data purged successfully')

    } catch (err) {
      logger.error(`Webhook: database delete execution failed for user ${clerkUserId}:`, err.message || err);
      return jsonError('Database operation failed', 500)
    }
  }

  // Acknowledge other event types to ensure Clerk doesn't retry
  return jsonSuccess({ received: true })
}

