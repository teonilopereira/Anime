# 🧠 Segundo Cerebro — Anime Destiny

> Mapa del proyecto por **dominios** (carpetas) y **archivos** reales. Generado a partir de `code-map.json`.
> Versión interactiva: [`viz/segundo-cerebro.html`](../viz/segundo-cerebro.html) — tocá cualquier nodo para ver qué hace y qué contiene.

**39** archivos JS · **15** páginas · **693** funciones · **18.208** líneas · **24** sin tests

---

## Páginas  
`(raíz)` — 15 archivos · 4072 líneas · 0 funciones · 7/15 con tests

Las páginas HTML que ve el usuario: portada, catálogos (anime/manga/novelas), detalle, listas, ranking, login y páginas legales. Cargan los scripts del núcleo y arman la interfaz.

| Archivo | Líneas | Funciones | Tests | Qué expone |
|---|--:|--:|:--:|---|
| **mis-listas.html** | 1298 | 0 | — | — |
| **top.html** | 513 | 0 | ✅ | — |
| **ranking.html** | 394 | 0 | ✅ | — |
| **usuario.html** | 321 | 0 | ✅ | — |
| **configuracion.html** | 273 | 0 | — | — |
| **detalle.html** | 201 | 0 | ✅ | — |
| **novelas.html** | 133 | 0 | ✅ | — |
| **anime.html** | 132 | 0 | ✅ | — |
| **manga.html** | 132 | 0 | ✅ | — |
| **privacidad.html** | 125 | 0 | — | — |
| **index.html** | 117 | 0 | — | — |
| **404.html** | 111 | 0 | — | — |
| **comparar.html** | 109 | 0 | — | — |
| **terminos.html** | 108 | 0 | — | — |
| **Login.html** | 105 | 0 | — | — |

## API / Backend  
`api/` — 2 archivos · 683 líneas · 34 funciones · 0/2 con tests

Puente con el backend. Inicializa el cliente de Supabase, maneja sesión, login (Google/email) y guarda/lee el estado del usuario (progreso, favoritos, perfil, experiencia).

| Archivo | Líneas | Funciones | Tests | Qué expone |
|---|--:|--:|:--:|---|
| **supabase-client.js** | 606 | 27 | — | `supabaseUserName`, `profileUsername`, `getCurrentUserAsync`, `ensureCurrentUserProfile`, `saveUserProfile` … |
| **supabase-config.js** | 77 | 7 | — | `cargarClienteSupabase`, `haySesionGuardada`, `window.__loadSupabase`, `window.__puedeHaberSesion`, `window.AppSupabaseReady` |

## Núcleo JS  
`js/` — 3 archivos · 261 líneas · 31 funciones · 2/3 con tests

Utilidades base y datos de arranque que comparten todas las páginas: helpers de formato, parámetros de URL, escape de HTML y carga de datos por categoría.

| Archivo | Líneas | Funciones | Tests | Qué expone |
|---|--:|--:|:--:|---|
| **utils.js** | 191 | 22 | ✅ | `formatMediaStatus`, `formatDate`, `truncateText`, `parseUrlParams`, `normalizeText` … |
| **datos.js** | 69 | 8 | ✅ | `_capitalize`, `obtenerItemsCategoria`, `obtenerItemCategoria`, `obtenerDetalleItem`, `window.escapeHtml` |
| **reload.js** | 1 | 1 | — | `onmessage` |

## Catálogo  
`js/catalog/` — 4 archivos · 2224 líneas · 113 funciones · 1/4 con tests

El catálogo: renderizado de tarjetas, scroll infinito con paginación, buscador con sugerencias y sincronización del estado de cada ítem (visto, favorito) con la nube.

| Archivo | Líneas | Funciones | Tests | Qué expone |
|---|--:|--:|:--:|---|
| **search.js** | 754 | 32 | ✅ | `getBrowsePref`, `setBrowsePref`, `showNsfwAgeGate`, `inicializarBusquedaCatalogo`, `setSuggestionsOpen` … |
| **states.js** | 673 | 47 | — | `getSyncQueue`, `saveSyncQueue`, `enqueueSync`, `drainSyncQueue`, `isSessionExpired` … |
| **cards.js** | 552 | 20 | — | `renderSkeletonCards`, `getApiPoster`, `getApiCatalogInfo`, `normalizeCatalogGenre`, `getApiGenresList` … |
| **pagination.js** | 245 | 14 | — | `alScrollearPorPrimeraVez`, `getSentinel`, `hideLoadingIndicator`, `showNoMoreMessage`, `loadNextPage` |

## Core  
`js/core/` — 11 archivos · 3358 líneas · 153 funciones · 3/11 con tests

El corazón del sistema: llamadas a las APIs externas (AniList, MangaDex), autenticación, i18n (idiomas), navegación común, almacenamiento local, constantes y configuración.

| Archivo | Líneas | Funciones | Tests | Qué expone |
|---|--:|--:|:--:|---|
| **api.js** | 978 | 57 | ✅ | `anilistFetch`, `done`, `extractTitle`, `extractAltTitle`, `buildSeasonsFromItem` … |
| **common-ui.js** | 659 | 23 | — | `window.__navMoreOpen`, `window.__navMoreClose`, `window.refreshUserUi`, `window.__adSecurityHandlersInstalled`, `window.rememberCatalogPosition` … |
| **i18n.js** | 623 | 8 | ✅ | `resolveKey`, `interpolate`, `getCurrentLang`, `window.applyTranslations`, `window.AppI18n` |
| **mangadex-api.js** | 415 | 26 | — | `safeCacheSet`, `mdFetch`, `getUserLang`, `getMangaDexTitle`, `getMangaDexDescription` … |
| **auth.js** | 382 | 25 | — | `waitForSupabase`, `getCurrentUser`, `displayNameFromUser`, `setMsg`, `displayNameFromProfile` … |
| **namespace.js** | 94 | 3 | — | `showConnectionStatusToast`, `window.AnimeDestiny`, `reportError` |
| **constants.js** | 56 | 1 | ✅ | `window.AnimeDestiny` |
| **user-store.js** | 49 | 1 | — | `window.UserStore` |
| **storage.js** | 42 | 7 | — | `read`, `write`, `readJson`, `writeJson`, `remove` |
| **config.template.js** | 40 | 1 | — | `window.AppConfig` |
| **config.js** | 20 | 1 | — | `window.AppConfig` |

## Detalle  
`js/detalle/` — 7 archivos · 3189 líneas · 136 funciones · 3/7 con tests

La ficha de cada título: render del detalle, temporadas y cadenas de secuelas, comentarios, progreso por episodio/volumen, temas musicales y traducción de sinopsis.

| Archivo | Líneas | Funciones | Tests | Qué expone |
|---|--:|--:|:--:|---|
| **render.js** | 1050 | 29 | — | `formatCountdown`, `startNextEpCountdown`, `tick`, `renderDetalle`, `setMetaTag` … |
| **comments.js** | 812 | 37 | — | `esc`, `isSignedIn`, `getCurrentUser`, `formatDate`, `getInitials` … |
| **themes.js** | 344 | 21 | ✅ | `leerCache`, `guardarCache`, `url`, `artistasDe`, `audioDe` … |
| **interactions.js** | 324 | 10 | — | `fetchJikanEpisode`, `resolveKitsuAnimeId`, `fetchKitsuEpisode`, `showEpisodeInfoModal`, `renderApiResult` |
| **seasons.js** | 262 | 13 | ✅ | `esFormatoDeTemporada`, `esPiezaSuelta`, `relacionesDe`, `vecino`, `aEslabon` |
| **data.js** | 252 | 15 | ✅ | `_translationCacheKey`, `translateText`, `getParams`, `normalizeDetailItem`, `getAnimeStructure` … |
| **progress.js** | 145 | 11 | — | `syncProgressFromSupabase`, `progressSqlKeyVolume`, `progressSqlKeyEpisode`, `detailStatusStorageKey`, `getProgressQueue` |

## Páginas JS  
`js/pages/` — 9 archivos · 4236 líneas · 212 funciones · 4/9 con tests

La lógica específica de cada página: comparador, configuración, importar desde MyAnimeList, login, mis-listas, ranking, portada y perfil de usuario.

| Archivo | Líneas | Funciones | Tests | Qué expone |
|---|--:|--:|:--:|---|
| **mis-listas.js** | 1491 | 62 | — | `extractGenresFromInfo`, `topGenresFromEntries`, `_lsGet`, `_lsSet`, `_achvGrantKey` … |
| **usuario.js** | 560 | 27 | ✅ | `read`, `sanitizeBgUrl`, `applyBackgroundPreference`, `levelFromPoints`, `levelName` … |
| **comparar.js** | 473 | 37 | — | `esIdValido`, `parseParams`, `getDetallesFor`, `getItem`, `compareItemTitle` … |
| **configuracion.js** | 389 | 20 | — | `r`, `w`, `rb`, `$`, `getCurrentUserName` … |
| **import-mal.js** | 359 | 14 | — | `getEl`, `malFetch`, `parseMalXml`, `shouldMarkViewed`, `malStatusToWatchStatus` |
| **ranking.js** | 312 | 17 | ✅ | `escapeHtml`, `getPosHtml`, `getInitials`, `expNeededForNext`, `getApodoHtml` … |
| **ranking-top.js** | 245 | 13 | ✅ | `refrescarIconos`, `posHtml`, `metaHtml`, `generosHtml`, `puntajeHtml` |
| **login.js** | 230 | 13 | — | `isFileProtocol`, `setStatus`, `setMode`, `userDisplayName`, `applyAuthState` |
| **script.js** | 177 | 9 | ✅ | `esqueleto`, `armarSeccion`, `tarjetas`, `sincronizarFlechas`, `conectarNavegacion` |

## Seguridad  
`js/security/` — 2 archivos · 81 líneas · 9 funciones · 2/2 con tests

Capa de seguridad: saneado de HTML (anti-XSS) y validación de categorías/ids/parámetros de URL antes de usarlos.

| Archivo | Líneas | Funciones | Tests | Qué expone |
|---|--:|--:|:--:|---|
| **sanitizer.js** | 44 | 4 | ✅ | `escapeHtml`, `safeUrl`, `window.escapeHtml`, `window.safeUrl` |
| **validator.js** | 37 | 5 | ✅ | `isValidCategory`, `isValidId`, `getSafeCategory`, `getSafeUrlParams`, `window.AppValidator` |

## UI  
`js/ui/` — 1 archivos · 104 líneas · 5 funciones · 0/1 con tests

Componentes de interfaz reutilizables. Hoy: el sistema de notificaciones tipo toast.

| Archivo | Líneas | Funciones | Tests | Qué expone |
|---|--:|--:|:--:|---|
| **toast.js** | 104 | 5 | — | `getContainer`, `showToast`, `dismissToast`, `remove`, `window.Toast` |

---

_Regenerar el mapa base con `npm run map`._
