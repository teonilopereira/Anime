/* sw.js - Service Worker for Anime Destiny */
const CACHE_NAME = 'anime-destiny-v16';
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
          if (key !== CACHE_NAME) {
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
    event.request.url.includes('api.mangadex.org')
  ) {
    return;
  }

  var url = event.request.url;
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
