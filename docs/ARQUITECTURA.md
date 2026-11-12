# ARQUITECTURA — Mirudoku

> Mapa técnico para cambios de estructura (actualizado el 2026-11-12). Complementa
> `docs/MAPEO_ARCHIVOS.md` (qué hace cada archivo) y `tools/build.js` (fuente de
> verdad del bundle). Los números de líneas son de esta fecha: verificalos antes
> de cortar, porque cambian con cada edición.

## 1. Cómo carga una página

Sitio estático, una página `*.html` por sección. Orden típico (ver `index.html`):

1. `js/vendor/lucide.min.js` (`defer`) y `js/core/theme.js` (síncrono, en `<head>`,
   para que no parpadee el tema).
2. Al final del `<body>`, **síncronos y en este orden**: `js/core/config.js`
   (`window.AppConfig`), `js/core/i18n.min.js` (`window.AppI18n`; pide
   `i18n-en.min.js` solo si `pref:lang` es `en`), `js/core/namespace.js`
   (`window.AnimeDestiny`, `reportError`).
3. `api/supabase-config.js` (`type="module" async`): crea `window.AppSupabase`
   solo si hay sesión posible; si no, queda `null` y la página sigue como invitado.
   `api/supabase-client.js` se importa bajo demanda.
4. `js/core-bundle.min.js` (`defer`): todo lo de `JS_SOURCES` (abajo).
5. Scripts propios de la página (`defer`, después del bundle): `js/pages/*.js`,
   `js/detalle/*.js`, `js/core/mangadex-api.js`, etc. Son **scripts clásicos**:
   comparten el scope global, así que el orden de los `<script>` importa.
6. `js/ui/mascot-loader.js` (dentro del bundle) pide `js/mascot.min.js` cuando la
   página ya cargó.

Páginas **sin** `core-bundle` (login, configuración, legales, 404, offline): cargan
sus propios scripts sueltos. `configuracion.html:432` carga `js/core/notif-prefs.js`
aparte por eso.

## 2. Qué entra al bundle (`tools/build.js`)

`JS_SOURCES` (`tools/build.js:89`), en orden de inicialización:

constants, genres, **recommend**, api, api-mangadex, datos, user-store, storage,
streak, auth, sanitizer, validator, utils, toast, ripple, tooltip, tabs,
mascot-loader, states, cards, chapters-modal, search, pagination, common-ui,
**notif-prefs**, reminders, missions, **novedades**.

- Fuera del bundle a propósito: `config.js`, `i18n.js`, `namespace.js` (se cargan
  antes), `mangadex-api.js` (suelto en manga/novelas/detalle/comparar; está en el
  precache de `sw.js`), todo `js/pages/`, `js/detalle/`, `js/personaje/`,
  `js/estudio/`.
- Mascota: bundle aparte `MASCOT` (`tools/build.js:126`): `mascots.js`,
  `characters.js`, `mascot.js` → `js/mascot.min.js`. `mascot-loader.js` necesita el
  marcador `__MASCOT_VERSION__`.
- El build estampa `?v=` en todo `src`/`href` a `js/` y `css/` (`ASSET_RE`), así que
  un archivo suelto nuevo no necesita registrarse, salvo en `sw.js` si tiene que
  andar offline.
- Iconos Lucide nuevos: agregarlos a `tools/lucide-entry.js`.
- Nunca editar generados: `*.min.css`, `js/core-bundle.min.js`, `js/vendor/`,
  `js/core/*.min.js`, ni el `<meta>` de CSP (lo genera el build desde
  `netlify.toml`; `npm run check` lo verifica).

## 3. Módulos grandes (líneas, 2026-11-12)

| Archivo | Líneas | Bundle | Tests |
|---|---:|---|---|
| `js/ui/mascot.js` | 1691 | mascota | no |
| `js/pages/mis-listas.js` | 1558 | no (página) | no |
| `js/core/api.js` | 1449 | sí | `api-multipage` |
| `js/catalog/search.js` | 1219 | sí | no |
| `js/detalle/render.js` | 1121 | no | `detalle-info` |
| `js/pages/retos.js` | 1116 | no | no |
| `js/catalog/cards.js` | 924 | sí | no |
| `js/detalle/comments.js` | 906 | no | no |
| `js/core/mangadex-api.js` | 868 | no (suelto) | no |
| `js/core/i18n.js` | 816 | no (temprano) | `i18n` |
| `js/catalog/states.js` | 783 | sí | `states-sync-queue` |

## 4. Cortes propuestos (sin aplicar)

Regla común: **mismo comportamiento y mismo orden de carga**. Un archivo nuevo que
sale de un módulo del bundle se lista en `JS_SOURCES` justo después (o antes, si
el original lo usa al cargar) del archivo de origen; uno que sale de una página se
agrega como `<script defer>` en el HTML, en la posición equivalente.

| Corte | Rango aprox. | Riesgo | Notas |
|---|---|---|---|
| `api.js` → `api-personajes.js` (`getCharacterById`, `getStaffById`, `getStudioById`, `getCharactersByMediaId`) | 770-838, 1068-fin | medio-bajo | En `JS_SOURCES` tras `api.js`. |
| `api.js` → `api-calendario.js` | 838-960 | medio | Lo usan calendario y novedades. |
| `search.js` → `search-recientes.js` | 301-485 | bajo | Antes de `search.js` en `JS_SOURCES`. |
| `search.js` → `search-sugerencias.js` | 486-606 | medio | |
| `mis-listas.js` → `mis-listas-stats.js` | 809-1032 | bajo | Script clásico: cargar tras `mis-listas.js` y antes de `mis-listas-logros.js`. No reasignar globales (`_sessionUser`, `currentCatFilter`, `currentSort`, `currentView`, `filterModeState`, `_remoteStatesMap`). |
| `mis-listas.js` → `mis-listas-recs.js` | 1033-1143 | bajo | Mismo cuidado de globales. Usa `js/core/recommend.js`. |
| `mis-listas.js` → `mis-listas-calendario.js` | 241-360, 551 | medio | Comparte `_calendarLoading`. |
| `retos.js` → `retos-personaje.js`, `retos-resumen.js` | 522-779, 816-1065 | medio | Patrón de `retos-juegos.js`; `<script>` en `retos.html`. |
| `mascot.js` → `mascot-ataque.js`, `mascot-rival.js` | 687-1098 | **alto** | Estado en closure compartido y sin tests. Agregar a `MASCOT.js`. Último. |
| Archivo nuevo junto a `mangadex-api.js` | — | medio | Hay que tocar 5 HTML y `ASSETS` de `sw.js`. |

Orden sugerido: `api-personajes` + `search-recientes` → `mis-listas-stats/recs` →
`retos-personaje/resumen` → mascota.

Deuda relacionada (no son cortes):
- Progreso: tres parsers de claves `UserStore` en `mis-listas.js` y otro en
  `inicio.js` sobre `loadAllProgress`. Conviene un helper único antes de cortar.
- Helpers duplicados (`escapeHtml`, `detailUrl`, `progressLabel`) en varias
  páginas; el canónico de `escapeHtml` es `js/security/sanitizer.js`.
- Dos módulos MangaDex con nombres parecidos: `api-mangadex.js` (bajo nivel, en el
  bundle) y `mangadex-api.js` (alto nivel, suelto). No son duplicados, pero se
  confunden.
- Dos colas de reintento independientes: `syncQueue` (estados y EXP, en
  `js/catalog/states.js`) y `progressSyncQueue` (episodios/tomos, en
  `js/detalle/progress.js`). Solo la primera cuenta métricas.

## 5. Módulos nuevos de esta sesión

| Archivo | Expone | Carga | Qué hace |
|---|---|---|---|
| `js/core/recommend.js` | `window.AppRecommend` | bundle (tras `genres.js`) | Motor puro de recomendaciones: perfil de gustos, puntaje y motivo visible. Excluye lo ya marcado y +18 sin permiso. Test: `recommend-core.test.js`. |
| `js/core/notif-prefs.js` | `window.AppNotifPrefs` | bundle + suelto en `configuracion.html` | Preferencias de avisos por categoría, pausa, silencio nocturno y tope diario (`pref:notif:*`). Lo consultan `reminders.js` y `push.js`. Test: `notif-prefs.test.js`. |
| `js/core/novedades.js` | `window.AppNovedades` | bundle (último) | "Novedades para vos" en la home: episodios nuevos de lo que seguís y estrenos afines. Lo dispara `inicio.js`. Test: `novedades.test.js`. |
| `server/migrations/013_social_privacy_public_profile.sql` | — | SQL Editor | `profiles.is_public` (default `false`): muro y perfil público solo para quien lo activa. |
| `server/migrations/014_activity_log_hardening.sql` | — | SQL Editor | Saca el insert manual en `user_activity_log` y pone topes de lectura. No existe 011. |

Métrica local nueva: `js/catalog/states.js` guarda en `localStorage`
`ad:metrics:sync` = `{ ok, fail, retry, lastCode, lastAt }` (sin `user_id` ni
mensajes; `lastCode` es un status HTTP, un código PostgREST o `network`/`session`/
`unknown`). Se lee con `window.AppSyncMetrics.get()`; `pending()` da el largo de
`syncQueue`. Pendiente: mostrarlo en configuración y declararlo en
`privacidad.html` (sección de datos locales).

`api/supabase-client.js` `loadAllProgress()` ahora pide `updated_at`; `inicio.js`
("seguir viendo") y `mis-listas.js` ya lo usaban si llegaba.

## 6. Verificaciones automáticas

- `npm test` (Vitest, jsdom): los módulos del navegador se cargan con
  `await import(...)`; los scripts clásicos exponen lo testeable en `window`.
- `npm run check` (`tools/check-quality.js`): mojibake, sintaxis de todo el JS
  propio, CSP igual en `netlify.toml`/`vercel.json`/`<meta>`, y en todos los
  `*.html` de la raíz: enlaces internos a `.html` inexistentes, ids duplicados y
  `data-i18n` sin clave en el diccionario `es`. Para pasar una de estas tres a
  aviso, agregarla a `WARN_ONLY`.
- `npm run test:e2e` (Playwright): humo por página (carga sin errores ni CSP).
