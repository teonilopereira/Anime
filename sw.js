/* sw.js - Service Worker for Anime Destiny */
const CACHE_NAME = 'anime-destiny-50a6af5f';
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
  '/css/bundle.css',
  '/css/bundle.min.css',
  '/js/core-bundle.min.js',
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
      if (event.request.mode === 'navigate') {
        return caches.match('/404.html');
      }
    })
  );
});
