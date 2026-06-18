const CACHE_NAME = 'prehistoric-atlas-cache-v1';
const ASSETS_TO_CACHE = [
  './prehistoric_life_atlas.html',
  './manifest.json',
  'https://cdn.jsdelivr.net/npm/@tabler/icons-webfont@latest/tabler-icons.min.css'
];

// Установка Service Worker и кэширование базовых ресурсов
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('[Service Worker] Кэширование ресурсов');
      return cache.addAll(ASSETS_TO_CACHE);
    })
  );
  self.skipWaiting();
});

// Активация и очистка старого кэша
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cache) => {
          if (cache !== CACHE_NAME) {
            console.log('[Service Worker] Удаление старого кэша', cache);
            return caches.delete(cache);
          }
        })
      );
    })
  );
  self.clients.claim();
});

// Перехват сетевых запросов (Стратегия: Кэш по возможности, иначе Сеть)
self.addEventListener('fetch', (event) => {
  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      if (cachedResponse) {
        return cachedResponse;
      }
      return fetch(event.request).then((networkResponse) => {
        // Кэшируем динамически запрашиваемые ресурсы (например, картинки видов, если они загружаются по URL)
        if (event.request.url.startsWith('http') && networkResponse.status === 200) {
          return caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, networkResponse.clone());
            return networkResponse;
          });
        }
        return networkResponse;
      }).catch(() => {
        // Если сеть недоступна и ресурса нет в кэше
        return new Response('Офлайн-режим. Ресурс недоступен без интернета.', {
          status: 503,
          statusText: 'Service Unavailable'
        });
      });
    })
  );
});