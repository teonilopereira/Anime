/* sw.js - Service Worker for Mirudoku */
const CACHE_NAME = 'anime-destiny-e96ccef9';
// v2: descarta las respuestas de error opacas que guardaba la v1.
const IMG_CACHE_NAME = 'anime-destiny-img-v2';
const IMG_CACHE_MAX = 120;
// CDNs de portadas (cross-origin) que sí conviene cachear en runtime.
// Deben coincidir con los hosts de portadas de connect-src en el CSP
// (netlify.toml / vercel.json): el fetch() del service worker se rige por
// connect-src, no por img-src, y sin ellos las portadas fallan.
const IMG_CDN_HOSTS = ['uploads.mangadex.org', 's4.anilist.co', 'media.kitsu.io', 'media.kitsu.app'];

// Cache-first con tope FIFO para portadas remotas.
// Las <img> piden en modo no-cors y la respuesta es opaca (status 0): no se
// distingue un 200 de un 404 o un 429, y cachearla guardaba también los
// errores, con lo que la portada quedaba rota en cada visita hasta que el tope
// la desalojara. Por eso se pide con CORS (los CDNs de portadas lo habilitan)
// y solo se cachea lo que vuelve ok. Si un CDN no lo habilitara, se cae al
// pedido original y se cachea la opaca como antes. Se respeta la política de
// referrer del pedido: MangaDex reemplaza la tapa si recibe un referrer ajeno.
function putCover(cache, request, response) {
  cache.put(request, response.clone());
  cache.keys().then((keys) => {
    if (keys.length > IMG_CACHE_MAX) cache.delete(keys[0]);
  });
}

function cacheCover(request) {
  return caches.open(IMG_CACHE_NAME).then((cache) => {
    return cache.match(request).then((hit) => {
      if (hit) return hit;
      return fetch(request.url, {
        mode: 'cors',
        credentials: 'omit',
        referrer: request.referrer,
        referrerPolicy: request.referrerPolicy
      }).then((response) => {
        if (response.ok) putCover(cache, request, response);
        return response;
      }, () => {
        return fetch(request).then((response) => {
          if (response && response.type === 'opaque') putCover(cache, request, response);
          return response;
        });
      });
    });
  });
}
// Rutas RELATIVAS a sw.js, no absolutas: en GitHub Pages el sitio vive en
// /Anime/ y '/index.html' apuntaba a la raiz del dominio (404). Con un solo
// 404, cache.addAll falla entero y el service worker no se instalaba.
const ASSETS = [
  './',
  'index.html',
  'anime.html',
  'manga.html',
  'novelas.html',
  'detalle.html',
  'volumenes.html',
  'personaje.html',
  'mis-listas.html',
  'top.html',
  'ranking.html',
  'Login.html',
  'configuracion.html',
  'usuario.html',
  'comparar.html',
  'privacidad.html',
  'terminos.html',
  '404.html',
  'offline.html',
  'css/bundle.min.css',
  'css/bundle-lite.min.css',
  'css/detalle.min.css',
  'css/volumenes.css',
  'css/fonts.css',
  'fonts/orbitron-latin.woff2',
  'fonts/rajdhani-300-latin.woff2',
  'fonts/rajdhani-300-latin-ext.woff2',
  'fonts/rajdhani-500-latin.woff2',
  'fonts/rajdhani-500-latin-ext.woff2',
  'fonts/rajdhani-600-latin.woff2',
  'fonts/rajdhani-600-latin-ext.woff2',
  'fonts/rajdhani-700-latin.woff2',
  'fonts/rajdhani-700-latin-ext.woff2',
  'js/core-bundle.min.js',
  'js/core/i18n.min.js',
  'js/core/theme.js',
  'js/core/mangadex-api.js',
  'js/pages/volumenes.js',
  'js/pages/offline.js',
  'manifest.json'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      // cache: 'reload' saltea la caché HTTP del navegador. GitHub Pages manda
      // max-age=600: sin esto, si el SW nuevo se instalaba en los 10 minutos
      // siguientes a un deploy, guardaba los HTML viejos y los seguía sirviendo.
      return cache.addAll(ASSETS.map((u) => new Request(u, { cache: 'reload' })));
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
  const title = data.title || 'Mirudoku';
  const options = {
    body: data.body || 'Hay novedades en tus animes.',
    icon: 'images/icon-192.png',
    badge: 'images/icon-192.png',
    tag: data.tag || undefined,
    data: { url: data.url || 'index.html' },
  };
  event.waitUntil(self.registration.showNotification(title, options));
});

// Al tocar la notificación: enfocar una pestaña ya abierta en esa URL o abrir una.
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  // Se resuelve contra el scope del service worker para que funcione igual en
  // la raiz (Netlify) que en /Anime/ (GitHub Pages).
  const target = new URL((event.notification.data && event.notification.data.url) || 'index.html', self.registration.scope).href;
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
    event.request.url.includes('/mdapi/') ||
    event.request.url.includes('animethemes.moe') ||
    event.request.url.includes('/__reload')
  ) {
    return;
  }

  var url = event.request.url;
  var host = new URL(url).hostname;

  // Portadas remotas de los CDNs conocidos: cache-first en un cache aparte.
  // Portadas de MangaDex servidas por la función propia (ver
  // netlify/functions/mdapi-cors.mjs): se cachean igual que las de los CDNs.
  // En Netlify es el mismo origen; en GitHub Pages la función se llama en
  // mirudoku.netlify.app, así que se acepta ese host también.
  var isCoverProxy = (host === self.location.hostname || host === 'mirudoku.netlify.app') &&
    url.includes('/.netlify/functions/mdapi-cors?cover=');
  if (event.request.destination === 'image' && (IMG_CDN_HOSTS.includes(host) || isCoverProxy)) {
    event.respondWith(cacheCover(event.request).catch(() => fetch(event.request)));
    return;
  }

  // Cualquier otro recurso de otro dominio (portadas de MAL, miniaturas de
  // YouTube, etc.) lo resuelve el navegador directamente. Si pasara por el
  // fetch() del service worker quedaría bloqueado por connect-src del CSP y la
  // imagen se rompería.
  if (host !== self.location.hostname) {
    return;
  }

  var isCSS = url.includes('.css');
  var isJS = url.includes('.js');

  // CSS y JS con ?v=hash: el build cambia el hash cuando cambia el contenido,
  // así que la copia cacheada nunca queda vieja. Cache-first evita esperar a la
  // red en cada página (antes eran ~10 pedidos por visita aunque no cambiara nada).
  if ((isCSS || isJS) && /[?&]v=[0-9a-f]+/.test(url)) {
    event.respondWith(
      caches.open(CACHE_NAME).then((cache) => {
        return cache.match(event.request).then((hit) => {
          if (hit) return hit;
          return fetch(event.request).then((response) => {
            if (response && response.status === 200 && response.type === 'basic') {
              cache.put(event.request, response.clone());
            }
            return response;
          });
        });
      })
    );
    return;
  }

  // Sin versión (dev, sw.js, config.js): red primero, caché si no hay red.
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

  // Páginas (HTML): red primero, así cada deploy se ve en la siguiente visita.
  // La copia en caché queda solo para cuando no hay conexión.
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request, { cache: 'no-cache' }).then((response) => {
        if (response && response.status === 200 && response.type === 'basic' && !url.includes('?')) {
          var responseToCache = response.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseToCache);
          });
        }
        return response;
      }).catch(() => {
        return caches.match(event.request).then((res) =>
          res || caches.match('offline.html').then((off) => off || caches.match('404.html')));
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
        return caches.match('offline.html').then((res) => res || caches.match('404.html'));
      }
    })
  );
});
