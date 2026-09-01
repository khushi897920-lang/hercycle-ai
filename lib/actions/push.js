'use server'

/**
 * push.js — server actions for Web Push subscriptions.
 *
 * Background push has never worked in this codebase. The upsert below used to
 * read:
 *
 *     .upsert([{ user_id: userId, subscription, updated_at }], { onConflict: 'user_id' })
 *
 * against a table with only a plain, non-unique index on `user_id`. PostgreSQL
 * answers that with 42P10, so every save failed — and the failure was
 * swallowed at three consecutive layers: this action logged and returned
 * `{ success: false }`, `lib/utils/notifications.js` discarded the return
 * value, and `NotificationSettings` showed a green toast plus a *local*
 * notification, which proves nothing because it never leaves the device.
 *
 * `supabase/02_push_subscription_endpoint.sql` adds the key, and this file
 * stops hiding the outcomes:
 *
 * - The VAPID configuration is checked instead of being replaced by a
 *   placeholder that cannot work.
 * - Subscriptions are keyed by endpoint, so a user can have more than one
 *   device.
 * - Send results are inspected, so "delivered" means delivered.
 * - Endpoints the push service reports as permanently gone are deleted rather
 *   than retried forever.
 *
 * The decisions — what a valid subscription looks like, what each failure
 * status means — live in `lib/push-subscription.js` and are unit-tested there.
 */

import { auth } from '@clerk/nextjs/server'
import webpush from 'web-push'

import { getSupabaseAdmin } from '@/lib/supabase-admin'
import { logger } from '@/lib/logger'
import {
  FAILURE_KINDS,
  classifySendFailure,
  describeVapidConfig,
  normaliseSubscription,
  summariseSendResults,
} from '@/lib/push-subscription'

const VAPID_SUBJECT = 'mailto:support@hercycle.app'

/** Set once the keys have been handed to web-push, so we do not repeat it. */
let vapidReady = false
/** Whether the "push is not configured" warning has already been logged. */
let warnedUnconfigured = false

/**
 * Configures web-push, or reports why it cannot be configured.
 *
 * The keys are no longer defaulted. The old module read:
 *
 *     const VAPID_PUBLIC_KEY  = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || 'BEl62iUYgUivx…'
 *     const VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY || '1A2B3C4D5E6F7G8H9I0J1K2L3M4N5O6P'
 *
 * Neither default is a real key. `setVapidDetails` threw on them, and the
 * `catch` discarded the error with a comment calling it a graceful fallback —
 * leaving the module in a state where every send would fail with nothing
 * anywhere saying so.
 *
 * @returns {{ ok: boolean, problems: string[] }}
 */
function ensureVapidConfigured() {
  const status = describeVapidConfig({
    publicKey: process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY,
    privateKey: process.env.VAPID_PRIVATE_KEY,
  })

  if (!status.configured) {
    if (!warnedUnconfigured) {
      warnedUnconfigured = true
      logger.error(`Web Push is not configured: ${status.problems.join(' ')}`)
    }
    return { ok: false, problems: status.problems }
  }

  if (!vapidReady) {
    try {
      webpush.setVapidDetails(
        VAPID_SUBJECT,
        process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY,
        process.env.VAPID_PRIVATE_KEY
      )
      vapidReady = true
    } catch (error) {
      // Reachable only if web-push rejects a pair that passed our own checks.
      // Still reported rather than swallowed.
      logger.error(`web-push rejected the VAPID key pair: ${error.message || error}`)
      return { ok: false, problems: ['The configured VAPID key pair was rejected by web-push.'] }
    }
  }

  return { ok: true, problems: [] }
}

/**
 * Saves a browser push subscription for the logged-in user.
 *
 * @param {unknown} subscription the serialised `PushSubscription`
 * @param {Record<string, boolean>} [preferences] optional notification preferences
 * @returns {Promise<{ success: boolean, reason?: string }>}
 */
export async function savePushSubscription(subscription, preferences) {
  const { userId } = await auth()
  if (!userId) throw new Error('Unauthorized')

  // Refusing to store a subscription the server could never send to is the
  // honest answer: the user is about to be told notifications are on.
  const config = ensureVapidConfigured()
  if (!config.ok) {
    return { success: false, reason: 'not_configured' }
  }

  // The old check was `subscription && subscription.endpoint`, which accepts a
  // subscription with no `keys` — the push service takes the request and the
  // browser cannot decrypt the payload, so it fails in a way that looks like
  // success from here.
  const normalised = normaliseSubscription(subscription)
  if (!normalised) {
    logger.warn(`Rejected a malformed push subscription for user ${userId}`)
    return { success: false, reason: 'invalid_subscription' }
  }

  if (preferences && typeof preferences === 'object') {
    normalised.preferences = preferences
  }

  const supabase = getSupabaseAdmin()

  try {
    const { error } = await supabase.from('user_push_subscriptions').upsert(
      {
        user_id: userId,
        endpoint: normalised.endpoint,
        subscription: normalised,
        updated_at: new Date().toISOString(),
      },
      // Matches the constraint added by
      // supabase/02_push_subscription_endpoint.sql. Keyed on the endpoint so a
      // second device adds a row instead of replacing the first one.
      { onConflict: 'user_id,endpoint' }
    )

    if (error) {
      // 42P10 here means the migration has not been applied. Say so, rather
      // than logging a bare Postgres string for the third year running.
      const hint =
        error.code === '42P10'
          ? ' — supabase/02_push_subscription_endpoint.sql has not been applied to this database.'
          : ''
      logger.error(`Failed to save push subscription for user ${userId}: ${error.message}${hint}`)
      return { success: false, reason: 'save_failed' }
    }

    logger.info(`Registered a push subscription for user ${userId}`)
    return { success: true }
  } catch (err) {
    logger.error(`Push subscription error for user ${userId}: ${err.message || err}`)
    return { success: false, reason: 'save_failed' }
  }
}

/**
 * Updates push notification preferences for all subscriptions belonging to the logged-in user.
 *
 * @param {Record<string, boolean>} preferences
 * @returns {Promise<{ success: boolean }>}
 */
export async function updatePushPreferences(preferences) {
  try {
    const { userId } = await auth()
    if (!userId || !preferences) return { success: false }

    const supabase = getSupabaseAdmin()
    const { data: rows, error: selectErr } = await supabase
      .from('user_push_subscriptions')
      .select('id, subscription')
      .eq('user_id', userId)

    if (selectErr || !rows || rows.length === 0) {
      return { success: false }
    }

    for (const row of rows) {
      const updatedSub = {
        ...(row.subscription || {}),
        preferences: {
          ...(row.subscription?.preferences || {}),
          ...preferences,
        },
      }
      await supabase
        .from('user_push_subscriptions')
        .update({ subscription: updatedSub, updated_at: new Date().toISOString() })
        .eq('id', row.id)
    }

    return { success: true }
  } catch (err) {
    logger.error(`Failed to update push preferences: ${err.message || err}`)
    return { success: false }
  }
}

/**
 * Sends a Web Push notification to a post/comment author when someone replies to their content.
 *
 * @param {object} params
 * @param {string} params.targetUserId — User ID of the target author to notify
 * @param {string} [params.authorAlias] — Alias of the person who replied
 * @param {string} [params.postTitle] — Title of the post
 * @param {string} params.postId — ID of the post for URL construction
 * @returns {Promise<{ success: boolean, delivered?: number, reason?: string }>}
 */
export async function notifyOnReply({ targetUserId, authorAlias, postTitle, postId }) {
  if (!targetUserId) return { success: false, delivered: 0, reason: 'no_target' }

  try {
    const supabase = getSupabaseAdmin()

    // Fetch target user's subscriptions
    const { data: rows, error } = await supabase
      .from('user_push_subscriptions')
      .select('endpoint, subscription')
      .eq('user_id', targetUserId)

    if (error || !rows || rows.length === 0) {
      return { success: false, delivered: 0, reason: 'no_subscriptions' }
    }

    // Filter out subscriptions where user explicitly turned off forumReplies preference
    const eligibleRows = rows.filter((row) => {
      const prefs = row.subscription?.preferences
      return !prefs || prefs.forumReplies !== false
    })

    if (eligibleRows.length === 0) {
      return { success: false, delivered: 0, reason: 'disabled_by_preference' }
    }

    const shortTitle = postTitle ? (postTitle.length > 40 ? `${postTitle.slice(0, 40)}…` : postTitle) : 'discussion'
    const notificationTitle = 'New Reply in Community 💬'
    const notificationBody = authorAlias
      ? `${authorAlias} replied to your post "${shortTitle}"`
      : `Someone replied to your discussion "${shortTitle}"`
    const targetUrl = `/community/post/${postId}`

    return await sendServerPushToUser(targetUserId, {
      title: notificationTitle,
      body: notificationBody,
      url: targetUrl,
    })
  } catch (err) {
    logger.error(`Error sending reply push notification to user ${targetUserId}: ${err.message || err}`)
    return { success: false, delivered: 0, reason: 'send_failed' }
  }
}

/**
 * Removes a subscription — used when a browser reports its subscription has
 * changed, and by the pruning path below.
 *
 * @param {string} endpoint
 * @returns {Promise<{ success: boolean }>}
 */
export async function removePushSubscription(endpoint) {
  const { userId } = await auth()
  if (!userId) throw new Error('Unauthorized')
  if (typeof endpoint !== 'string' || endpoint.length === 0) return { success: false }

  const supabase = getSupabaseAdmin()

  try {
    const { error } = await supabase
      .from('user_push_subscriptions')
      .delete()
      .eq('user_id', userId)
      .eq('endpoint', endpoint)

    if (error) {
      logger.error(`Failed to remove push subscription for user ${userId}: ${error.message}`)
      return { success: false }
    }
    return { success: true }
  } catch (err) {
    logger.error(`Push subscription removal error: ${err.message || err}`)
    return { success: false }
  }
}

/**
 * Deletes endpoints a push service has declared permanently gone.
 *
 * Nothing did this before, so a revoked endpoint — the ordinary result of
 * clearing site data or uninstalling a PWA — stayed in the table and was
 * retried on every notification for the rest of time.
 *
 * Not exported: pruning is a consequence of sending, never something a caller
 * should ask for directly, and a `'use server'` module exports actions
 * reachable from the client.
 *
 * @param {object} supabase
 * @param {string} userId
 * @param {string[]} endpoints
 */
async function pruneGoneEndpoints(supabase, userId, endpoints) {
  if (!endpoints || endpoints.length === 0) return

  try {
    const { error } = await supabase
      .from('user_push_subscriptions')
      .delete()
      .eq('user_id', userId)
      .in('endpoint', endpoints)

    if (error) {
      logger.error(`Failed to prune ${endpoints.length} dead push endpoints: ${error.message}`)
      return
    }

    logger.info(`Pruned ${endpoints.length} dead push endpoint(s) for user ${userId}`)
  } catch (err) {
    logger.error(`Error pruning dead push endpoints: ${err.message || err}`)
  }
}

/**
 * Dispatches a background Web Push alert to every device a user has
 * registered.
 *
 * @param {string} targetUserId
 * @param {{ title?: string, body?: string, url?: string }} payload
 * @returns {Promise<{ success: boolean, delivered: number, attempted: number, reason?: string }>}
 */
export async function sendServerPushToUser(targetUserId, payload) {
  if (!targetUserId) return { success: false, delivered: 0, attempted: 0, reason: 'no_target' }

  const config = ensureVapidConfigured()
  if (!config.ok) {
    return { success: false, delivered: 0, attempted: 0, reason: 'not_configured' }
  }

  const supabase = getSupabaseAdmin()

  try {
    const { data: rows, error } = await supabase
      .from('user_push_subscriptions')
      .select('endpoint, subscription')
      .eq('user_id', targetUserId)

    if (error) {
      logger.error(`Failed to load push subscriptions for user ${targetUserId}: ${error.message}`)
      return { success: false, delivered: 0, attempted: 0, reason: 'lookup_failed' }
    }

    if (!rows || rows.length === 0) {
      // Not an error — the user simply has no device registered. Distinct from
      // a failure so the caller can tell the difference.
      return { success: false, delivered: 0, attempted: 0, reason: 'no_subscriptions' }
    }

    const pushPayload = JSON.stringify({
      title: payload?.title || 'HerCycle AI 🌸',
      body: payload?.body || 'You have a new companion notification.',
      url: payload?.url || '/',
      icon: '/icon-192.png',
    })

    const results = await Promise.all(
      rows.map(async (row) => {
        try {
          await webpush.sendNotification(row.subscription, pushPayload)
          return { endpoint: row.endpoint, ok: true }
        } catch (error) {
          // Every failure is captured with its endpoint so the summary can say
          // which subscriptions to delete. The previous Promise.allSettled
          // discarded the results entirely and returned `{ success: true }`.
          return { endpoint: row.endpoint, ok: false, error }
        }
      })
    )

    const summary = summariseSendResults(results)

    await pruneGoneEndpoints(supabase, targetUserId, summary.goneEndpoints)

    if (summary.misconfigured) {
      logger.error(
        `Push sends were rejected as misconfigured for user ${targetUserId} — check the VAPID key pair.`
      )
    }
    if (summary.failed > 0 && !summary.misconfigured) {
      const kinds = results
        .filter((r) => !r.ok)
        .map((r) => classifySendFailure(r.error))
        .filter((kind) => kind !== FAILURE_KINDS.GONE)
      if (kinds.length > 0) {
        logger.warn(`${kinds.length} push send(s) failed transiently for user ${targetUserId}`)
      }
    }

    return {
      success: summary.success,
      delivered: summary.delivered,
      attempted: summary.attempted,
    }
  } catch (err) {
    logger.error(`Error sending server push notification: ${err.message || err}`)
    return { success: false, delivered: 0, attempted: 0, reason: 'send_failed' }
  }
}
