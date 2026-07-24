'use client'

import { savePushSubscription } from '@/lib/actions/push'

/**
 * Registers the Service Worker for background push notifications.
 */
export async function registerServiceWorker() {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator)) return null

  try {
    const registration = await navigator.serviceWorker.register('/sw.js')
    return registration
  } catch (err) {
    console.error('Service Worker registration failed:', err)
    return null
  }
}

/**
 * Requests device push notification permission from the user and registers push endpoint.
 */
export async function requestNotificationPermission() {
  if (typeof window === 'undefined' || !('Notification' in window)) return 'unsupported'

  try {
    const permission = await Notification.requestPermission()
    if (permission === 'granted') {
      const reg = await registerServiceWorker()
      if (reg && reg.pushManager) {
        try {
          let sub = await reg.pushManager.getSubscription()
          if (!sub) {
            sub = await reg.pushManager.subscribe({
              userVisibleOnly: true,
              applicationServerKey: process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || 'BEl62iUYgUivxIkv69yViEuiBIa40yYlK80pvwB8z7x0uE1jA4gR4Jz1fA5mK9_E5-6P_e_E5-6P_e_E5-6P_e'
            })
          }
          if (sub) {
            await savePushSubscription(JSON.parse(JSON.stringify(sub)))
          }
        } catch (e) {
          console.error('PushManager subscription error:', e)
        }
      }
    }
    return permission
  } catch (err) {
    console.error('Error requesting notification permission:', err)
    return 'denied'
  }
}

/**
 * Gets current notification permission status.
 */
export function getNotificationPermissionStatus() {
  if (typeof window === 'undefined' || !('Notification' in window)) return 'unsupported'
  return Notification.permission
}

/**
 * Triggers a native system device notification banner (Works on Desktop, Android & iOS PWA).
 */
export function sendDeviceNotification(title, body, url = '/') {
  if (typeof window === 'undefined' || !('Notification' in window)) return
  if (Notification.permission !== 'granted') return

  try {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.ready.then((registration) => {
        registration.showNotification(title, {
          body: body,
          icon: '/favicon.ico',
          badge: '/favicon.ico',
          vibrate: [200, 100, 200],
          tag: 'hercycle-alert',
          renotify: true,
          data: { url },
        })
      })
    } else {
      new Notification(title, {
        body: body,
        icon: '/favicon.ico',
      })
    }
  } catch (err) {
    console.error('Error triggering device notification:', err)
  }
}
