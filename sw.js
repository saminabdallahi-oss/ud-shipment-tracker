const CACHE_NAME = 'ud-shipment-tracker-v3';

// Static assets to cache — everything EXCEPT index.html
const APP_SHELL = [
  '/ud-shipment-tracker/manifest.json',
  '/ud-shipment-tracker/icons/icon-192.png',
  '/ud-shipment-tracker/icons/icon-512.png'
];

// Install — cache static assets only (not index.html)
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

self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);

  // GitHub data files — always network first, no caching
  if (url.hostname === 'raw.githubusercontent.com') {
    event.respondWith(
      fetch(event.request).catch(() =>
        new Response('[]', { headers: { 'Content-Type': 'application/json' } })
      )
    );
    return;
  }

  // Google Fonts — network first, skip on fail
  if (url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com') {
    event.respondWith(fetch(event.request).catch(() => new Response('')));
    return;
  }

  // index.html — ALWAYS network first so token updates reach everyone immediately
  if (url.pathname === '/ud-shipment-tracker/' || url.pathname === '/ud-shipment-tracker/index.html') {
    event.respondWith(
      fetch(event.request)
        .then(response => {
          // Update cache with fresh version
          const clone = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
          return response;
        })
        .catch(() => {
          // Offline fallback — serve cached version if available
          return caches.match(event.request);
        })
    );
    return;
  }

  // Everything else (icons, manifest) — cache first, network fallback
  event.respondWith(
    caches.match(event.request).then(cached => {
      if (cached) return cached;
      return fetch(event.request).then(response => {
        if (response.ok && event.request.method === 'GET') {
          const clone = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
        }
        return response;
      });
    })
  );
});
