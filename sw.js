const CACHE_NAME = 'ud-shipment-tracker-v1';

// Core app shell files to cache on install
const APP_SHELL = [
  '/ud-shipment-tracker/',
  '/ud-shipment-tracker/index.html',
  '/ud-shipment-tracker/manifest.json',
  '/ud-shipment-tracker/icons/icon-192.png',
  '/ud-shipment-tracker/icons/icon-512.png'
];

// Install — cache the app shell
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(APP_SHELL))
      .then(() => self.skipWaiting())
  );
});

// Activate — clean up old caches
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys
          .filter(key => key !== CACHE_NAME)
          .map(key => caches.delete(key))
      )
    ).then(() => self.clients.claim())
  );
});

// Fetch strategy:
// - For the shipments.json data file: network-first, fall through to cache
// - For everything else: cache-first (app shell)
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);

  // Data fetch — network first, no offline fallback needed (page handles it)
  if (url.hostname === 'raw.githubusercontent.com') {
    event.respondWith(
      fetch(event.request)
        .catch(() => {
          // Return a minimal JSON so the dashboard can show the offline banner
          return new Response('[]', {
            headers: { 'Content-Type': 'application/json' }
          });
        })
    );
    return;
  }

  // Google Fonts — network first, skip cache on fail
  if (url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com') {
    event.respondWith(fetch(event.request).catch(() => new Response('')));
    return;
  }

  // App shell — cache first, network fallback
  event.respondWith(
    caches.match(event.request).then(cached => {
      if (cached) return cached;
      return fetch(event.request).then(response => {
        // Cache successful GET responses for app shell files
        if (response.ok && event.request.method === 'GET') {
          const clone = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
        }
        return response;
      });
    })
  );
});
