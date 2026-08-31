'use client'

/**
 * notifications.js — the browser half of Web Push.
 *
 * This file used to end an "enable notifications" flow with:
 *
 *     if (sub) {
 *       await savePushSubscription(JSON.parse(JSON.stringify(sub)))
 *     }
 *
 * — the return value discarded. The server action it calls could not succeed
 * (see `lib/actions/push.js`), so the subscription was never stored, and the
 * caller still went on to show a success toast. What follows returns a state
 * rather than a bare permission string, so the UI can only claim success when
 * the subscription actually reached the server.
 *
 * It also no longer carries a fallback `applicationServerKey`. The old default
 * was the placeholder key from the web-push docs, which meant a deployment
 * with no VAPID configuration produced subscriptions bound to a key pair
 * nobody holds — subscriptions that look fine in the browser and can never be
 * delivered to.
 */

import { savePushSubscription } from '@/lib/actions/push'
import { PUSH_STATES, describePushState } from '@/lib/push-subscription'

export { PUSH_STATES, describePushState } from '@/lib/push-subscription'

/**
 * Registers the Service Worker for background push notifications.
 *
 * @returns {Promise<ServiceWorkerRegistration|null>}
 */
export async function registerServiceWorker() {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator)) return null

  try {
    return await navigator.serviceWorker.register('/sw.js')
  } catch (err) {
    console.error('Service Worker registration failed:', err)
    return null
  }
}

/**
 * Whether this build has a VAPID public key at all.
 *
 * `NEXT_PUBLIC_VAPID_PUBLIC_KEY` is inlined at build time, so this is a
 * compile-time fact rather than a runtime one — which is why it can be
 * answered before the permission prompt is shown, and why asking a user for
 * notification permission the server cannot honour is avoidable.
 *
 * @returns {boolean}
 */
export function isPushConfigured() {
  const key = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY
  return typeof key === 'string' && key.trim().length > 0
}

/**
 * @typedef {object} PushResult
 * @property {string} state       one of {@link PUSH_STATES}
 * @property {string} permission  the raw browser permission, for the caller's own state
 * @property {string} message     plain-language explanation
 */

/**
 * @param {string} state
 * @param {string} permission
 * @returns {PushResult}
 */
function result(state, permission) {
  return { state, permission, message: describePushState(state) }
}

/**
 * Requests notification permission and registers the push endpoint.
 *
 * Ordering matters: the configuration check comes *before* the permission
 * prompt. A user who is asked for permission and grants it has spent the one
 * prompt a browser gives you — asking when the server cannot deliver anything
 * burns it for nothing, and on most browsers a dismissed prompt cannot be
 * shown again without the user going into settings.
 *
 * @returns {Promise<PushResult>}
 */
export async function requestNotificationPermission() {
  if (typeof window === 'undefined' || !('Notification' in window)) {
    return result(PUSH_STATES.UNSUPPORTED, 'unsupported')
  }
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
    return result(PUSH_STATES.UNSUPPORTED, Notification.permission)
  }
  if (!isPushConfigured()) {
    return result(PUSH_STATES.NOT_CONFIGURED, Notification.permission)
  }

  let permission
  try {
    permission = await Notification.requestPermission()
  } catch (err) {
    console.error('Error requesting notification permission:', err)
    return result(PUSH_STATES.DENIED, 'denied')
  }

  if (permission === 'denied') return result(PUSH_STATES.DENIED, permission)
  // 'default' means the prompt was dismissed rather than refused — a distinct
  // thing to tell the user, because it can be asked again.
  if (permission !== 'granted') return result(PUSH_STATES.DISMISSED, permission)

  const registration = await registerServiceWorker()
  if (!registration || !registration.pushManager) {
    return result(PUSH_STATES.SAVE_FAILED, permission)
  }

  let subscription
  try {
    subscription = await registration.pushManager.getSubscription()
    if (!subscription) {
      subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY,
      })
    }
  } catch (err) {
    console.error('PushManager subscription error:', err)
    return result(PUSH_STATES.SAVE_FAILED, permission)
  }

  if (!subscription) return result(PUSH_STATES.SAVE_FAILED, permission)

  try {
    let prefs = null
    try {
      const stored = localStorage.getItem('hercycle_notification_prefs')
      if (stored) prefs = JSON.parse(stored)
    } catch (_) {}

    // The round trip through JSON is what turns the native PushSubscription
    // into the plain object a Server Action can accept.
    const saved = await savePushSubscription(JSON.parse(JSON.stringify(subscription)), prefs)

    if (!saved?.success) {
      return result(
        saved?.reason === 'not_configured' ? PUSH_STATES.NOT_CONFIGURED : PUSH_STATES.SAVE_FAILED,
        permission
      )
    }
  } catch (err) {
    console.error('Failed to store push subscription:', err)
    return result(PUSH_STATES.SAVE_FAILED, permission)
  }

  return result(PUSH_STATES.ENABLED, permission)
}

/**
 * Current notification permission status.
 *
 * @returns {string} 'unsupported' | 'default' | 'granted' | 'denied'
 */
export function getNotificationPermissionStatus() {
  if (typeof window === 'undefined' || !('Notification' in window)) return 'unsupported'
  return Notification.permission
}

/**
 * Triggers a native system notification banner from the page.
 *
 * Worth being clear about what this is: a *local* notification, shown by this
 * tab. It does not involve the push service, the server, or a subscription. It
 * was previously used as the confirmation that push had been enabled, which it
 * cannot demonstrate — it works identically on a device that will never
 * receive a background notification.
 */
export function sendDeviceNotification(title, body, url = '/') {
  if (typeof window === 'undefined' || !('Notification' in window)) return
  if (Notification.permission !== 'granted') return

  try {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.ready.then((registration) => {
        registration.showNotification(title, {
          body,
          icon: '/icon-192.png',
          badge: '/icon-192.png',
          vibrate: [200, 100, 200],
          tag: 'hercycle-alert',
          renotify: true,
          data: { url },
        })
      })
    } else {
      new Notification(title, { body, icon: '/icon-192.png' })
    }
  } catch (err) {
    console.error('Error triggering device notification:', err)
  }
}
