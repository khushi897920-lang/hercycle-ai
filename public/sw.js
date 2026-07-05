const CACHE_NAME = 'hercycle-v1';
const PRECACHE_ASSETS = [
  '/favicon.svg',
  '/manifest.json',
  '/icon-192.png',
  '/icon-512.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      const promises = PRECACHE_ASSETS.map((asset) => {
        return fetch(asset)
          .then((response) => {
            if (response.ok) {
              return cache.put(asset, response);
            }
          })
          .catch((err) => {
            console.warn(`Failed to precache ${asset}:`, err);
          });
      });
      return Promise.all(promises);
    }).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // Avoid intercepting API calls, Clerk authentication, or hot reload websocket
  if (
    url.pathname.startsWith('/api') || 
    url.pathname.startsWith('/_next/webpack-hmr') ||
    url.hostname.includes('clerk')
  ) {
    return;
  }

  // Check if it's a document/page request or static asset
  const isPage = event.request.mode === 'navigate';

  if (isPage) {
    // Network-First with Cache fallback
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          if (response.status === 200) {
            const responseClone = response.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(event.request, responseClone);
            });
          }
          return response;
        })
        .catch(() => {
          return caches.match(event.request).then((cachedResponse) => {
            if (cachedResponse) return cachedResponse;
            // Fallback if both fail
            return caches.match('/');
          });
        })
    );
  } else {
    // Stale-While-Revalidate for static assets
    event.respondWith(
      caches.match(event.request).then((cachedResponse) => {
        const fetchPromise = fetch(event.request).then((networkResponse) => {
          if (
            networkResponse.status === 200 &&
            (url.pathname.startsWith('/_next/') || url.pathname.includes('/public/') || url.pathname.endsWith('.svg') || url.pathname.endsWith('.png') || url.pathname.endsWith('.woff2'))
          ) {
            const responseClone = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(event.request, responseClone);
            });
          }
          return networkResponse;
        }).catch(() => null);

        return cachedResponse || fetchPromise;
      })
    );
  }
});
