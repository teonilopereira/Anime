/* sw.js - Service Worker for Anime Destiny */
const CACHE_NAME = 'anime-destiny-47ff46ea';
const IMG_CACHE_NAME = 'anime-destiny-img-v1';
const IMG_CACHE_MAX = 120;
// CDNs de portadas (cross-origin) que sí conviene cachear en runtime.
const IMG_CDN_HOSTS = ['uploads.mangadex.org', 'anilist.co', 'kitsu.io', 'kitsu.app'];

// Cache-first con tope FIFO para portadas remotas.
function cacheCover(request) {
  return caches.open(IMG_CACHE_NAME).then((cache) => {
    return cache.match(request).then((hit) => {
      if (hit) return hit;
      return fetch(request).then((response) => {
        // Respuestas opacas (no-cors) tienen status 0 pero son cacheables.
        if (response && (response.ok || response.type === 'opaque')) {
          cache.put(request, response.clone());
          cache.keys().then((keys) => {
            if (keys.length > IMG_CACHE_MAX) cache.delete(keys[0]);
          });
        }
        return response;
      });
    });
  });
}
const ASSETS = [
  '/',
  '/index.html',
  '/anime.html',
  '/manga.html',
  '/novelas.html',
  '/detalle.html',
  '/personaje.html',
  '/mis-listas.html',
  '/top.html',
  '/ranking.html',
  '/Login.html',
  '/configuracion.html',
  '/usuario.html',
  '/comparar.html',
  '/privacidad.html',
  '/terminos.html',
  '/404.html',
  '/offline.html',
  '/css/bundle.css',
  '/css/bundle.min.css',
  '/css/detalle.min.css',
  '/css/fonts.css',
  '/fonts/orbitron-latin.woff2',
  '/fonts/rajdhani-300-latin.woff2',
  '/fonts/rajdhani-300-latin-ext.woff2',
  '/fonts/rajdhani-500-latin.woff2',
  '/fonts/rajdhani-500-latin-ext.woff2',
  '/fonts/rajdhani-600-latin.woff2',
  '/fonts/rajdhani-600-latin-ext.woff2',
  '/fonts/rajdhani-700-latin.woff2',
  '/fonts/rajdhani-700-latin-ext.woff2',
  '/js/core-bundle.min.js',
  '/js/core/i18n.js',
  '/js/core/theme.js',
  '/js/pages/offline.js',
  '/manifest.json'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS);
    }).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME && key !== IMG_CACHE_NAME) {
            return caches.delete(key);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// ── Web Push ──────────────────────────────────────────────────────────────
// La edge function (server/functions/notify-new-episodes) manda un JSON con
// { title, body, url, tag }. Sin payload igual mostramos algo genérico para no
// quedarnos con una notificación vacía.
self.addEventListener('push', (event) => {
  let data = {};
  try { data = event.data ? event.data.json() : {}; } catch (e) { data = {}; }
  const title = data.title || 'Anime Destiny';
  const options = {
    body: data.body || 'Hay novedades en tus animes.',
    icon: '/images/icon-192.png',
    badge: '/images/icon-192.png',
    tag: data.tag || undefined,
    data: { url: data.url || '/index.html' },
  };
  event.waitUntil(self.registration.showNotification(title, options));
});

// Al tocar la notificación: enfocar una pestaña ya abierta en esa URL o abrir una.
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const target = (event.notification.data && event.notification.data.url) || '/index.html';
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientsList) => {
      for (const client of clientsList) {
        if (client.url.includes(target) && 'focus' in client) return client.focus();
      }
      if (self.clients.openWindow) return self.clients.openWindow(target);
    })
  );
});

self.addEventListener('fetch', (event) => {
  if (
    event.request.url.includes('supabase.co') ||
    event.request.url.includes('graphql.anilist.co') ||
    event.request.url.includes('api.mangadex.org') ||
    event.request.url.includes('animethemes.moe') ||
    event.request.url.includes('/__reload')
  ) {
    return;
  }

  var url = event.request.url;

  // Portadas remotas de los CDNs conocidos: cache-first en un cache aparte.
  if (event.request.destination === 'image' && IMG_CDN_HOSTS.some((h) => url.includes(h))) {
    event.respondWith(cacheCover(event.request).catch(() => fetch(event.request)));
    return;
  }

  var isCSS = url.includes('.css');
  var isJS = url.includes('.js');

  if (isCSS || isJS) {
    event.respondWith(
      fetch(event.request).then((response) => {
        if (response && response.status === 200 && response.type === 'basic') {
          var responseToCache = response.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseToCache);
          });
        }
        return response;
      }).catch(() => {
        return caches.match(event.request);
      })
    );
    return;
  }

  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      if (cachedResponse) {
        return cachedResponse;
      }
      return fetch(event.request).then((response) => {
        if (
          response &&
          response.status === 200 &&
          response.type === 'basic' &&
          event.request.url.includes('.png')
        ) {
          var responseToCache = response.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseToCache);
          });
        }
        return response;
      });
    }).catch(() => {
      // Sin red y sin copia en caché: mostramos la página de respaldo offline
      // en vez del 404 (que sugiere, erróneamente, que la ruta no existe).
      if (event.request.mode === 'navigate') {
        return caches.match('/offline.html').then((res) => res || caches.match('/404.html'));
      }
    })
  );
});
