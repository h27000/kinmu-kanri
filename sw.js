const CACHE_NAME = 'kinmu-kanri-v4';
const ASSETS = [
  '/kinmu-kanri/',
  '/kinmu-kanri/index.html',
  '/kinmu-kanri/styles.css',
  '/kinmu-kanri/js/db.js',
  '/kinmu-kanri/js/sync.js',
  '/kinmu-kanri/js/main.js',
  '/kinmu-kanri/manifest.json',
  '/kinmu-kanri/icon.svg',
];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(ASSETS))
  );
  self.skipWaiting();
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// Network first, cache fallback
self.addEventListener('fetch', e => {
  e.respondWith(
    fetch(e.request)
      .then(res => {
        const clone = res.clone();
        caches.open(CACHE_NAME).then(cache => cache.put(e.request, clone));
        return res;
      })
      .catch(() => caches.match(e.request))
  );
});
