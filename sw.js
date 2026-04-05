var CACHE_ADI = 'yakinda-ne-var-v7';
// Sadece Leaflet cache-first, HTML/JS her zaman ağdan
var CACHE_STATIK = [
  '/yakinda-ne-var/manifest.json',
  '/yakinda-ne-var/icon-192.png',
  '/yakinda-ne-var/icon-512.png',
  'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css',
  'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js'
];

self.addEventListener('install', function(event) {
  event.waitUntil(
    caches.open(CACHE_ADI).then(function(cache) {
      return cache.addAll(CACHE_STATIK);
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
    }).then(function() {
      return self.clients.claim();
    })
  );
  self.clients.matchAll({ type: 'window' }).then(function(clients) {
    clients.forEach(function(client) {
      client.postMessage({ tip: 'GUNCELLEME_VAR' });
    });
  });
});

self.addEventListener('fetch', function(event) {
  if (event.request.url.includes('railway.app')) return;
  if (event.request.method !== 'GET') return;

  var url = event.request.url;

  // Navigate istekleri ve HTML/JS: her zaman ağdan al
  var networkFirst =
    event.request.mode === 'navigate' ||
    url.includes('/yakinda-ne-var/app.js') ||
    url.includes('/yakinda-ne-var/index.html');

  if (networkFirst) {
    event.respondWith(
      fetch(event.request, { cache: 'no-cache' }).then(function(networkResponse) {
        if (networkResponse.status === 200) {
          var klon = networkResponse.clone();
          caches.open(CACHE_ADI).then(function(cache) { cache.put(event.request, klon); });
        }
        return networkResponse;
      }).catch(function() {
        return caches.match('/yakinda-ne-var/index.html');
      })
    );
    return;
  }

  // Leaflet vb. statik dosyalar: cache-first
  event.respondWith(
    caches.match(event.request).then(function(cachedResponse) {
      if (cachedResponse) return cachedResponse;
      return fetch(event.request).then(function(networkResponse) {
        if (networkResponse.status === 200) {
          var klon = networkResponse.clone();
          caches.open(CACHE_ADI).then(function(cache) { cache.put(event.request, klon); });
        }
        return networkResponse;
      });
    })
  );
});
