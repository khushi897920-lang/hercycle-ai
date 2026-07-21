'use server'

import { auth } from '@clerk/nextjs/server'
import { getSupabaseAdmin } from '@/lib/supabase-admin'
import webpush from 'web-push'

// Configure VAPID details (standard web-push configuration)
const VAPID_PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || 'BEl62iUYgUivxIkv69yViEuiBIa40yYlK80pvwB8z7x0uE1jA4gR4Jz1fA5mK9_E5-6P_e_E5-6P_e_E5-6P_e'
const VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY || '1A2B3C4D5E6F7G8H9I0J1K2L3M4N5O6P'

try {
  webpush.setVapidDetails(
    'mailto:support@hercycle.app',
    VAPID_PUBLIC_KEY,
    VAPID_PRIVATE_KEY
  )
} catch (e) {
  // Graceful fallback
}

/**
 * Saves a browser push subscription for the logged-in user.
 */
export async function savePushSubscription(subscription) {
  const { userId } = await auth()
  if (!userId) throw new Error('Unauthorized')
  if (!subscription || !subscription.endpoint) return { success: false }

  const supabase = getSupabaseAdmin()

  try {
    const { error } = await supabase
      .from('user_push_subscriptions')
      .upsert(
        [
          {
            user_id: userId,
            subscription: subscription,
            updated_at: new Date().toISOString(),
          },
        ],
        { onConflict: 'user_id' }
      )

    if (error) {
      console.error('Error saving push subscription:', error)
      return { success: false }
    }

    return { success: true }
  } catch (err) {
    console.error('Push subscription error:', err)
    return { success: false }
  }
}

/**
 * Dispatches a background Web Push alert to a target user's device.
 */
export async function sendServerPushToUser(targetUserId, payload) {
  if (!targetUserId) return { success: false }

  const supabase = getSupabaseAdmin()

  try {
    const { data: subs } = await supabase
      .from('user_push_subscriptions')
      .select('subscription')
      .eq('user_id', targetUserId)

    if (!subs || subs.length === 0) return { success: false }

    const pushPayload = JSON.stringify({
      title: payload.title || 'HerCycle AI 🌸',
      body: payload.body || 'You have a new companion notification.',
      url: payload.url || '/',
      icon: '/favicon.ico',
    })

    const results = await Promise.allSettled(
      subs.map((subObj) =>
        webpush.sendNotification(subObj.subscription, pushPayload)
      )
    )

    return { success: true, count: results.length }
  } catch (err) {
    console.error('Error sending server push notification:', err)
    return { success: false }
  }
}
