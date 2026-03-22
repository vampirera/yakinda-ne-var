var CACHE_ADI = 'yakinda-ne-var-v3';
var CACHE_DOSYALARI = [
  '/yakinda-ne-var/',
  '/yakinda-ne-var/index.html',
  '/yakinda-ne-var/app.js',
  '/yakinda-ne-var/manifest.json',
  '/yakinda-ne-var/icon-192.png',
  '/yakinda-ne-var/icon-512.png',
  'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css',
  'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js'
];

self.addEventListener('install', function(event) {
  event.waitUntil(
    caches.open(CACHE_ADI).then(function(cache) {
      return cache.addAll(CACHE_DOSYALARI);
    })
  );
  self.skipWaiting();
});

self.addEventListener('activate', function(event) {
  event.waitUntil(
    caches.keys().then(function(anahtarlar) {
      return Promise.all(
        anahtarlar.filter(function(anahtar) {
          return anahtar !== CACHE_ADI;
        }).map(function(anahtar) {
          return caches.delete(anahtar);
        })
      );
    })
  );
  self.clients.claim();
});

self.addEventListener('fetch', function(event) {
  // Railway API isteklerini asla cache'leme
  if (event.request.url.includes('railway.app')) return;

  event.respondWith(
    caches.match(event.request).then(function(cachedResponse) {
      if (cachedResponse) return cachedResponse;
      return fetch(event.request).then(function(networkResponse) {
        // Sadece başarılı GET isteklerini cache'le
        if (
          event.request.method === 'GET' &&
          networkResponse.status === 200 &&
          !event.request.url.includes('railway.app')
        ) {
          var klon = networkResponse.clone();
          caches.open(CACHE_ADI).then(function(cache) {
            cache.put(event.request, klon);
          });
        }
        return networkResponse;
      }).catch(function() {
        // Ağ yoksa ve cache'de index.html varsa döndür
        if (event.request.mode === 'navigate') {
          return caches.match('/yakinda-ne-var/index.html');
        }
      });
    })
  );
});
