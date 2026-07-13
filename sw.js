/* sw.js - Service Worker for Anime Destiny */
const CACHE_NAME = 'anime-destiny-v13';
const ASSETS = [
  '/',
  '/index.html',
  '/anime.html',
  '/manga.html',
  '/novelas.html',
  '/detalle.html',
  '/mis-listas.html',
  '/top.html',
  '/Login.html',
  '/configuracion.html',
  '/usuario.html',
  '/comparar.html',
  '/privacidad.html',
  '/terminos.html',
  '/404.html',
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
          if (key !== CACHE_NAME) {
            return caches.delete(key);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  // Ignorar peticiones a Supabase / Anilist / APIs externas para almacenamiento directo
  if (
    event.request.url.includes('supabase.co') ||
    event.request.url.includes('graphql.anilist.co') ||
    event.request.url.includes('api.mangadex.org')
  ) {
    return;
  }

  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      if (cachedResponse) {
        return cachedResponse;
      }
      return fetch(event.request).then((response) => {
        // Guardar peticiones exitosas de recursos locales en caché
        if (
          response &&
          response.status === 200 &&
          response.type === 'basic' &&
          (event.request.url.includes('.css') || event.request.url.includes('.js') || event.request.url.includes('.png'))
        ) {
          const responseToCache = response.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseToCache);
          });
        }
        return response;
      });
    }).catch(() => {
      // Fallback offline para navegación si falla la red y no está en caché
      if (event.request.mode === 'navigate') {
        return caches.match('/404.html');
      }
    })
  );
});
