/* =====================================================
   Атлас доисторической жизни — Service Worker
   ===================================================== */

// Версия кэша. Поднимайте её при каждом релизе, где меняется
// состав файлов (например, новые иконки или ассеты) —
// это гарантированно сбросит старый кэш у всех посетителей.
const CACHE_VERSION = 'v2';
const CACHE_NAME = `prehistoric-atlas-cache-${CACHE_VERSION}`;

// Файлы, которые почти не меняются и безопасно кэшировать «навсегда»
// (картинки существ, шрифт иконок). Для них — Cache First.
const STATIC_ASSET_PATTERNS = [
  /\.png$/i,
  /\.jpg$/i,
  /\.jpeg$/i,
  /\.svg$/i,
  /\.webp$/i,
  /tabler-icons/i,
];

// Файлы с контентом, которые регулярно обновляются
// (HTML и список существ). Для них — Network First,
// чтобы новые виды появлялись сразу, без устаревшего кэша.
const DYNAMIC_ASSETS = [
  './',
  './index.html',
  './prehistoric_life_atlas.html',
  './creatures.js',
  './manifest.json',
];

// ── Установка: предварительно прогреваем кэш ───────────────
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(DYNAMIC_ASSETS).catch((err) => {
        console.warn('[SW] Не удалось закэшировать часть файлов при установке:', err);
      });
    })
  );
  self.skipWaiting(); // новая версия SW активируется сразу, не дожидаясь закрытия всех вкладок
});

// ── Активация: удаляем все кэши прошлых версий ──────────────
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((name) => name !== CACHE_NAME)
          .map((name) => {
            console.log('[SW] Удаление устаревшего кэша:', name);
            return caches.delete(name);
          })
      );
    }).then(() => self.clients.claim())
  );
});

// ── Перехват запросов ────────────────────────────────────────
self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;

  const url = event.request.url;
  const isStaticAsset = STATIC_ASSET_PATTERNS.some((pattern) => pattern.test(url));

  if (isStaticAsset) {
    event.respondWith(cacheFirst(event.request));
  } else {
    event.respondWith(networkFirst(event.request));
  }
});

// Cache First — для статичных картинок и шрифтов: быстро и не тратит трафик повторно
async function cacheFirst(request) {
  const cached = await caches.match(request);
  if (cached) return cached;

  try {
    const response = await fetch(request);
    if (response && response.status === 200) {
      const cache = await caches.open(CACHE_NAME);
      cache.put(request, response.clone());
    }
    return response;
  } catch {
    return new Response('Ресурс недоступен офлайн.', {
      status: 503,
      statusText: 'Service Unavailable',
    });
  }
}

// Network First — для HTML и creatures.js: всегда пытаемся получить
// свежую версию из сети; кэш используется только как офлайн-резерв
async function networkFirst(request) {
  try {
    const response = await fetch(request, { cache: 'no-store' });
    if (response && response.status === 200) {
      const cache = await caches.open(CACHE_NAME);
      cache.put(request, response.clone());
    }
    return response;
  } catch {
    const cached = await caches.match(request);
    if (cached) return cached;

    return new Response(
      `<!DOCTYPE html><html lang="ru"><head><meta charset="UTF-8">
       <title>Офлайн</title></head>
       <body style="font-family:sans-serif;text-align:center;padding:3rem;">
         <h1>🦕 Нет подключения к интернету</h1>
         <p>Эта страница ещё не была сохранена для офлайн-доступа.</p>
         <button onclick="location.reload()">Повторить попытку</button>
       </body></html>`,
      { headers: { 'Content-Type': 'text/html; charset=utf-8' }, status: 503 }
    );
  }
}
