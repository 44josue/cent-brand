const CACHE_VERSION = 'cent-v4';

// Static assets that rarely change — cache aggressively
const STATIC_ASSETS = [
  '/',
  '/css/tokens.css',
  '/css/reset.css',
  '/css/global.css',
  '/css/components.css',
  '/css/nav.css',
  '/css/footer.css',
  '/products/',
  '/cart/',
  '/account/',
  '/order-tracking/',
  '/offline.html',
];

// Install: pre-cache critical shell assets
self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE_VERSION).then(cache =>
      cache.addAll(STATIC_ASSETS).catch(() => {})
    ).then(() => self.skipWaiting())
  );
});

// Activate: delete old caches
self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_VERSION).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

// Fetch strategy:
// - Supabase API / Edge Functions → network only (always fresh data)
// - Google Fonts / CDN → cache first, fallback to network
// - CSS/JS → stale-while-revalidate (serve cached, update in background)
// - Images → cache first (long-lived), then network
// - HTML pages → network first, fallback to cache
self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);

  // Skip non-GET and browser extension requests
  if (e.request.method !== 'GET') return;
  if (!url.protocol.startsWith('http')) return;

  // Supabase API & Edge Functions — always fresh
  if (url.hostname.includes('supabase.co') || url.hostname.includes('supabase.in')) {
    return; // Let browser handle normally (no SW intercept)
  }

  // Google Fonts & external CDN — cache first
  if (url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com' ||
      url.hostname === 'cdn.jsdelivr.net' || url.hostname === 'esm.sh') {
    e.respondWith(cacheFirst(e.request, 'cent-cdn'));
    return;
  }

  // Product images (product-images bucket) — cache first, long TTL
  if (url.pathname.includes('/storage/v1/object/public/product-images/')) {
    e.respondWith(cacheFirst(e.request, 'cent-images'));
    return;
  }

  // JS and CSS — stale-while-revalidate
  if (url.pathname.match(/\.(js|css)$/)) {
    e.respondWith(staleWhileRevalidate(e.request));
    return;
  }

  // HTML pages — network first, cache fallback
  if (e.request.headers.get('accept')?.includes('text/html')) {
    e.respondWith(networkFirst(e.request));
    return;
  }
});

async function cacheFirst(request, cacheName = CACHE_VERSION) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request);
  if (cached) return cached;
  try {
    const response = await fetch(request);
    if (response.ok) cache.put(request, response.clone());
    return response;
  } catch {
    return new Response('Offline', { status: 503 });
  }
}

async function staleWhileRevalidate(request) {
  const cache = await caches.open(CACHE_VERSION);
  const cached = await cache.match(request);
  const networkPromise = fetch(request).then(response => {
    if (response.ok) cache.put(request, response.clone());
    return response;
  }).catch(() => null);
  return cached || await networkPromise || new Response('Offline', { status: 503 });
}

async function networkFirst(request) {
  const cache = await caches.open(CACHE_VERSION);
  try {
    const response = await fetch(request);
    if (response.ok) cache.put(request, response.clone());
    return response;
  } catch {
    const cached = await cache.match(request);
    if (cached) return cached;
    // Return offline page for navigation requests
    const offline = await cache.match('/offline.html');
    return offline || new Response('<h1>You are offline</h1>', {
      headers: { 'Content-Type': 'text/html' }
    });
  }
}
