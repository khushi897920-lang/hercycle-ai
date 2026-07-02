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
  logger.info(`Received Clerk webhook event: ${eventType}`);

  if (eventType === 'user.deleted') {
    const { id: clerkUserId } = evt.data

    if (!clerkUserId) {
      logger.warn('Webhook user.deleted event contains no user id');
      return NextResponse.json({ error: 'Missing user id' }, { status: 400 })
    }

    try {
      const supabaseAdmin = getSupabaseAdmin()
      
      logger.info(`Webhook user.deleted: Purging database records for user ${clerkUserId}`);
      
      // Perform deletion across cycles and daily_logs tables
      const { error: cyclesErr } = await supabaseAdmin
        .from('cycles')
        .delete()
        .eq('user_id', clerkUserId)

      if (cyclesErr) {
        logger.error(`Webhook: failed to delete cycles for user ${clerkUserId}:`, cyclesErr.message);
        throw new Error(cyclesErr.message);
      }

      const { error: logsErr } = await supabaseAdmin
        .from('daily_logs')
        .delete()
        .eq('user_id', clerkUserId)

      if (logsErr) {
        logger.error(`Webhook: failed to delete logs for user ${clerkUserId}:`, logsErr.message);
        throw new Error(logsErr.message);
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
