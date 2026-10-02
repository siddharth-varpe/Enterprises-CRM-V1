/**
 * SR Enterprises CRM - Technician Portal Service Worker
 * Scope: /technician/
 * Application Identity: Enterprises Technician (id: /technician)
 *
 * Cache Boundary Isolation:
 * - Strictly isolated to /technician/ scope
 * - Does NOT cache Admin CRM data, admin pages, customer directory, invoices, or reports
 * - All /api/* calls are strictly NetworkOnly (live auth & live RBAC)
 */

const CACHE_NAME = 'crm-tech-shell-v1';
const PRECACHE_ASSETS = [
  '/technician/',
  '/manifest-technician.webmanifest',
  '/favicon.ico',
  '/apple-touch-icon-technician.png',
  '/crm-logo.png',
  '/pwa-technician-192x192.png',
  '/pwa-technician-512x512.png',
  '/pwa-technician-maskable-512x512.png'
];

self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(PRECACHE_ASSETS).catch((err) => {
        console.warn('[Technician SW] Precache assets partially failed:', err);
      });
    })
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((name) => name.startsWith('crm-tech-') && name !== CACHE_NAME)
          .map((name) => caches.delete(name))
      );
    }).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // 1. Non-GET requests are always network-only
  if (request.method !== 'GET') {
    return;
  }

  // 2. Strict API and Health isolation: ALWAYS NetworkOnly (live auth & live RBAC)
  if (
    url.pathname.startsWith('/api/') ||
    url.pathname.startsWith('/health') ||
    url.pathname.startsWith('/ready')
  ) {
    return;
  }

  // 3. Navigation requests within /technician/ scope: NetworkFirst with fallback to index.html
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response && response.status === 200) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
          }
          return response;
        })
        .catch(async () => {
          const cachedResponse = await caches.match(request);
          if (cachedResponse) return cachedResponse;
          const fallback = await caches.match('/index.html');
          if (fallback) return fallback;
          return caches.match('/technician/');
        })
    );
    return;
  }

  // 4. Static Assets (JS, CSS, Images, Fonts) used by Technician Portal: Stale-While-Revalidate
  const isStaticAsset =
    url.pathname.startsWith('/assets/') ||
    url.pathname.endsWith('.js') ||
    url.pathname.endsWith('.css') ||
    url.pathname.endsWith('.png') ||
    url.pathname.endsWith('.jpg') ||
    url.pathname.endsWith('.ico') ||
    url.pathname.endsWith('.woff2');

  if (isStaticAsset) {
    event.respondWith(
      caches.match(request).then((cachedResponse) => {
        const fetchPromise = fetch(request)
          .then((networkResponse) => {
            if (networkResponse && networkResponse.status === 200) {
              const clone = networkResponse.clone();
              caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
            }
            return networkResponse;
          })
          .catch(() => cachedResponse);

        return cachedResponse || fetchPromise;
      })
    );
  }
});
