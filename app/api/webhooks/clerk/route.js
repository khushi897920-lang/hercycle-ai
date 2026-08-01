import { NextResponse } from 'next/server'
import { Webhook } from 'svix'
import { getSupabaseAdmin } from '@/lib/supabase-admin'
import { logger } from '@/lib/logger'

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

  // 5. Handle user.deleted event (idempotency is guaranteed by cascading delete query filters)
  const eventType = evt.type
  const eventId = svix_id
  logger.info(`Received Clerk webhook event: ${eventType}`);

  if (eventType === 'user.created') {
    const { id: clerkUserId } = evt.data
    try {
      const supabaseAdmin = getSupabaseAdmin()
      const { error } = await supabaseAdmin
        .from('users')
        .insert([{ id: clerkUserId }])
      
      if (error) {
        logger.error(`Webhook: failed to insert user ${clerkUserId}:`, error.message);
        throw new Error(error.message);
      }
      logger.info(`Webhook user.created: Inserted user ${clerkUserId}`);
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
      const supabaseAdmin = getSupabaseAdmin()

      // Prevent duplicate processing of retried Clerk webhooks
const { data: existingEvent } = await supabaseAdmin
  .from('clerk_webhook_audit')
  .select('event_id')
  .eq('event_id', eventId)
  .maybeSingle();

if (existingEvent) {
  logger.warn(
    `Duplicate Clerk webhook ignored. Event ID: ${eventId}`
  );

  return NextResponse.json({
    success: true,
    duplicate: true,
    message: 'Webhook already processed'
  });
}
      
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

      const { error: auditError } = await supabaseAdmin
  .from('clerk_webhook_audit')
  .insert({
    event_id: eventId,
    event_type: eventType
  });

if (auditError) {
  logger.error(
    `Webhook: failed to record audit event ${eventId}:`,
    auditError.message
  );
  throw new Error(auditError.message);
}

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
