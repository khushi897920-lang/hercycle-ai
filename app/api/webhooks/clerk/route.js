import { NextResponse } from 'next/server'
import { Webhook } from 'svix'
import { getSupabaseAdmin } from '@/lib/supabase-admin'
import { logger } from '@/lib/logger'

/**
 * Returns true when a webhook delivery for `eventId` was already processed.
 *
 * Clerk retries deliveries when a handler returns a non-2xx, and may resend
 * on a network hiccup — both would otherwise re-run the DB write. The audit
 * table makes every duplicate a cheap read + early 200.
 *
 * @param {ReturnType<getSupabaseAdmin>} supabaseAdmin
 * @param {string} eventId
 * @returns {Promise<boolean>}
 */
async function isDuplicateEvent(supabaseAdmin, eventId) {
  const { data: existingEvent } = await supabaseAdmin
    .from('clerk_webhook_audit')
    .select('event_id')
    .eq('event_id', eventId)
    .maybeSingle()

  return Boolean(existingEvent)
}

/**
 * Records a processed webhook delivery so later duplicates are ignored.
 *
 * A write failure here must NOT fail the underlying user mutation — the
 * mutation already succeeded. Log it loudly instead so an operator can spot
 * the gap, and let the idempotent upsert/delete queries absorb a rare retry.
 *
 * @param {ReturnType<getSupabaseAdmin>} supabaseAdmin
 * @param {string} eventId
 * @param {string} eventType
 * @returns {Promise<void>}
 */
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
    return NextResponse.json({ error: 'Webhook configuration error' }, { status: 500 })
  }

  // 2. Fetch Svix headers for signature verification
  const headerPayload = request.headers
  const svix_id = headerPayload.get("svix-id")
  const svix_timestamp = headerPayload.get("svix-timestamp")
  const svix_signature = headerPayload.get("svix-signature")

  if (!svix_id || !svix_timestamp || !svix_signature) {
    logger.warn('Missing Svix signature headers in webhook request');
    return new Response('Error: Missing svix headers', { status: 400 })
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
    return new Response('Error: Invalid signature', { status: 400 })
  }

  const eventType = evt.type
  const eventId = svix_id
  const supabaseAdmin = getSupabaseAdmin()

  // 5. Deduplicate across ALL event types before any database write. A
  // redundant upsert is wasted work at best and a correctness hazard at worst.
  try {
    if (await isDuplicateEvent(supabaseAdmin, eventId)) {
      logger.warn(`Duplicate Clerk webhook delivery ignored. Event ID: ${eventId}, type: ${eventType}`);
      return NextResponse.json({
        success: true,
        duplicate: true,
        message: 'Webhook already processed'
      });
    }
  } catch (err) {
    // Fail-open on the dedup read: a transient audit-table error should not
    // silently drop a real user creation. The idempotent queries below and the
    // audit insert keep retries safe.
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
      return NextResponse.json({ success: true, message: 'User created successfully' })
    } catch (err) {
      logger.error(`Webhook: user creation failed for user ${clerkUserId}:`, err.message || err);
      return NextResponse.json({ error: 'Database operation failed' }, { status: 500 })
    }
  }

  if (eventType === 'user.deleted') {
    const { id: clerkUserId } = evt.data

    if (!clerkUserId) {
      logger.warn('Webhook user.deleted event contains no user id');
      return NextResponse.json({ error: 'Missing user id' }, { status: 400 })
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
      return NextResponse.json({ success: true, message: 'User data purged successfully' })

    } catch (err) {
      logger.error(`Webhook: database delete execution failed for user ${clerkUserId}:`, err.message || err);
      return NextResponse.json({ error: 'Database operation failed' }, { status: 500 })
    }
  }

  // Acknowledge other event types to ensure Clerk doesn't retry
  return NextResponse.json({ success: true, received: true })
}
