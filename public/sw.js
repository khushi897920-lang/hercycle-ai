// Service Worker for HerCycle AI
//
// Responsibilities:
//   1. Web Push notifications (unchanged from before).
//   2. PWA installability + offline asset/page caching.
//
// Caching strategy:
//   - Static build assets (_next/static, _next/image, /images, icons, fonts) -> Cache First
//   - Page navigations (HTML documents)                                      -> Network First, falling back to
//     the cache, and finally to a static offline shell
//   - Other same-origin GET requests (e.g. RSC/page-data fetches)            -> Stale While Revalidate
//   - Everything else (POST/PATCH/DELETE, cross-origin, /api/*, range
//     requests such as audio streaming)                                     -> left completely untouched
//
// NOTE: App data (cycles, daily logs, sync queue) is already cached and
// synced through IndexedDB by lib/OfflineContext.jsx + lib/db.js, entirely
// on the client. This service worker is only responsible for making the app
// shell (HTML/JS/CSS/static assets) available offline so that code can boot
// and read from IndexedDB when there is no network. It deliberately never
// intercepts /api/* calls so it can't interfere with that existing sync,
// encryption, or auth logic.

const CACHE_VERSION = 'v2'
const STATIC_CACHE = `hercycle-static-${CACHE_VERSION}`
const PAGES_CACHE = `hercycle-pages-${CACHE_VERSION}`
const OFFLINE_URL = '/offline.html'

// Small, known-safe set of assets to have ready before the first offline
// visit. Everything else is cached lazily as it's requested.
const PRECACHE_URLS = [
  OFFLINE_URL,
  '/manifest.json',
  '/favicon.svg',
  '/icon-192.png',
  '/icon-512.png',
]

async function precacheAssets() {
  const cache = await caches.open(STATIC_CACHE)
  // Cache each URL independently so one missing/failed asset can't stop the
  // service worker from installing.
  await Promise.all(
    PRECACHE_URLS.map((url) =>
      cache.add(url).catch((err) => console.error('Service Worker: failed to precache', url, err))
    )
  )
}

self.addEventListener('install', (event) => {
  event.waitUntil(precacheAssets().then(() => self.skipWaiting()))
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(
        keys
          .filter((key) => key !== STATIC_CACHE && key !== PAGES_CACHE)
          .map((key) => caches.delete(key))
      ))
      .then(() => self.clients.claim())
  )
})

// --- helpers -------------------------------------------------------------

function isApiRequest(url) {
  return url.pathname.startsWith('/api/')
}

function isStaticAsset(request, url) {
  if (url.pathname.startsWith('/_next/static/')) return true
  if (url.pathname.startsWith('/_next/image')) return true
  if (url.pathname.startsWith('/images/')) return true
  return ['style', 'script', 'font', 'image'].includes(request.destination)
}

function isNavigationRequest(request) {
  if (request.mode === 'navigate') return true
  return request.method === 'GET' && (request.headers.get('accept') || '').includes('text/html')
}

// Cache First: serve from cache when available, otherwise fetch, cache a
// copy for next time, and return the network response.
//
// The cache write is registered with event.waitUntil() rather than just
// awaited inline. respondWith() only needs the *response*; waitUntil() is
// what actually keeps the worker alive long enough for the write to land,
// since the browser is free to suspend an idle worker as soon as the
// respondWith() promise settles.
async function cacheFirst(event, request) {
  const cached = await caches.match(request)
  if (cached) return cached

  try {
    const response = await fetch(request)
    if (response && response.ok) {
      const copy = response.clone()
      event.waitUntil(
        caches.open(STATIC_CACHE).then((cache) => cache.put(request, copy))
      )
    }
    return response
  } catch (err) {
    return cached || Response.error()
  }
}

// Network First: prefer a fresh network response; fall back to whatever is
// cached for this URL, and finally to the offline shell page.
async function networkFirst(event, request) {
  try {
    const response = await fetch(request)
    if (response && response.ok) {
      const copy = response.clone()
      event.waitUntil(
        caches.open(PAGES_CACHE).then((cache) => cache.put(request, copy))
      )
    }
    return response
  } catch (err) {
    const cache = await caches.open(PAGES_CACHE)
    const cachedPage = await cache.match(request)
    if (cachedPage) return cachedPage

    const offlineShell = await caches.match(OFFLINE_URL)
    if (offlineShell) return offlineShell

    return Response.error()
  }
}

// Stale While Revalidate: return the cached copy immediately if there is
// one (fast + works offline), while updating the cache from the network in
// the background for next time. The background update is registered with
// event.waitUntil() so it isn't cut off once the cached response has
// already been returned.
async function staleWhileRevalidate(event, request) {
  const cache = await caches.open(STATIC_CACHE)
  const cached = await cache.match(request)

  const networkFetch = fetch(request)
    .then((response) => {
      if (response && response.ok) cache.put(request, response.clone())
      return response
    })
    .catch(() => cached || Response.error())

  event.waitUntil(networkFetch.catch(() => { }))

  return cached || networkFetch
}

self.addEventListener('fetch', (event) => {
  const { request } = event

  // Only ever handle simple, same-origin GET requests. Everything else
  // (mutations, cross-origin calls, range requests used by the audio
  // player, /api/* calls handled by OfflineContext) passes straight through
  // to the network untouched.
  if (request.method !== 'GET') return
  if (request.headers.has('range')) return

  const url = new URL(request.url)
  if (url.origin !== self.location.origin) return
  if (isApiRequest(url)) return

  if (isNavigationRequest(request)) {
    event.respondWith(networkFirst(event, request))
    return
  }

  if (isStaticAsset(request, url)) {
    event.respondWith(cacheFirst(event, request))
    return
  }

  event.respondWith(staleWhileRevalidate(event, request))
})

// --- web push notifications (unchanged) -----------------------------------

self.addEventListener('push', function (event) {
  if (!event.data) return

  try {
    const data = event.data.json()
    const title = data.title || 'HerCycle AI 🌸'
    const options = {
      body: data.body || 'You have a new companion notification.',
      icon: data.icon || '/icon-192.png',
      badge: '/icon-192.png',
      vibrate: [100, 50, 100],
      data: {
        url: data.url || '/',
      },
    }

    event.waitUntil(self.registration.showNotification(title, options))
  } catch (err) {
    console.error('Error showing push notification:', err)
  }
})

self.addEventListener('notificationclick', function (event) {
  event.notification.close()
  const targetUrl = event.notification.data?.url || '/'

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function (clientList) {
      for (let i = 0; i < clientList.length; i++) {
        const client = clientList[i]
        if (client.url && 'focus' in client) {
          return client.focus()
        }
      }
      if (clients.openWindow) {
        return clients.openWindow(targetUrl)
      }
    })
  )
})