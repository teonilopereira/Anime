# Backlog Mirudoku — Plan 1 · Mejora

Lo armé con los informes de los agentes `mejora-*` y `retencion-*` (11-nov-2026), revisando a mano los hallazgos clave en el código.
Está ordenado por impacto ÷ esfuerzo (Alto=3, Medio=2, Bajo=1; horas estimadas [Suposición]). Lo que está "En curso (esta sesión)" va al final y no entra en el orden.
Sigue sin aplicarse todo lo que haga falta en Supabase: cada migración nueva (014+) la corre el dueño a mano en el SQL Editor, después de la 013.

| # | Tarea | Impacto | Esfuerzo (h) | Depende de | Archivos | Aceptación |
|---|-------|---------|--------------|------------|----------|------------|
| 1 | Proxy MangaDex: no cachear respuestas no-ok (429/5xx hoy se cachean 300 s en la CDN) [Seguro] | Alto | 0.5 | — | `netlify/functions/mdapi-cors.mjs:75` | Con upstream 429/5xx la respuesta sale con `Cache-Control: no-store`, y con 200 sigue en `max-age=300` |
| 2 | Que quitar fav/visto no borre "Viendo" en el servidor: pasar `watchStatus` [Seguro: `data.js:176` no lo manda → v2 hace DELETE, `schema.sql:523`] | Alto | 0.5 | — | `js/detalle/data.js:176`, `api/supabase-client.js:264-284` (solo lectura) | Marcar Viendo, poner fav y sacarlo: al recargar sigue en Viendo, con y sin la migración 003 |
| 3 | Navbar accesible: sacar `role="menu"` sin menuitem, `<nav>` en `.nav-links`, `alt=""` en el logo | Medio | 0.5 | — | `js/core/common-ui.js:83,137,140` | axe sin errores de ARIA en la navbar, que el lector anuncie "navegación" y que el menú móvil funcione igual |
| 4 | Migración 014 de hardening: quitar la policy INSERT own de `user_activity_log`, programar `cleanup_old_activity()` con pg_cron y poner tope `cardinality(p_ids)` en `get_profiles_by_ids` (Supabase 7, 9 y 11) | Alto | 1 | 013 aplicada | `server/migrations/014_hardening_activity.sql` (nuevo) | Un `INSERT` directo desde el cliente falla, los triggers siguen logueando, `cron.job` lista el cleanup y >200 ids da error. Idempotente |
| 5 | Guard de invitado al marcar episodio o tomo: `pedirLogin()` y no encolar sin sesión [Seguro: el handler `render.js:1063-1080` no tiene guard] | Alto | 1 | — | `js/detalle/render.js:1063-1080` (+ el handler de tomos), `js/detalle/progress.js:110-137` | Sin sesión: tocar un episodio no lo marca, abre el pedido de login y `progressSyncQueue` queda vacío; al loguear con otra cuenta no aparecen marcas ajenas |
| 6 | Crear el estado "Viendo" al marcar el primer episodio o tomo si no hay `wstatus` (recorrido 1) | Alto | 1 | #5 (mismo handler); se ve en "Seguí donde lo dejaste" (#25) | `js/detalle/render.js:528,1063-1080` | Obra sin estado: al marcar el ep. 1 pasa a Viendo en el servidor y aparece en la home; desmarcar no la saca. Anime y manga, móvil y escritorio |
| 7 | Actualizar `privacidad.html`: muro, perfil `?u=`, `is_public` (default false, 013), ranking que sigue siendo público, comentarios y likes públicos, log ≤90 días, localStorage por dispositivo (rachas, misiones, cola) y fecha | Alto | 1 | 013 decidida | `privacidad.html:84-104`, claves `privacy.*` en `js/core/i18n.js` / `i18n-en.js` | Cada superficie pública de `mejora-privacidad.md` aparece nombrada, con fecha nov-2026 y el texto en ES y EN |
| 8 | Username único sin distinguir mayúsculas: `UNIQUE lower(username)` antes de difundir `?u=` | Alto | 1 | Que el dueño consulte duplicados antes; 013 | `server/migrations/015_username_unique.sql` (nuevo) | La consulta de duplicados da 0 filas y después el índice existe; crear "Foo" con "foo" ya existente falla con un mensaje claro en Login |
| 9 | Modal `#resumenModal` accesible (`role="dialog"`, `aria-modal`, `aria-labelledby`, Escape, trampa y devolución de foco) + `btn-ver-mas` como `<button>` | Alto | 1.5 | — | `detalle.html:118,174-185` (sin tocar el `<meta>` CSP), `js/core/common-ui.js:627-631` | Con teclado: abre, Tab no se escapa, Escape cierra y el foco vuelve al disparador; "Ver más" anda con Enter y Espacio |
| 10 | Login: un solo `<h1>`, pestañas con `role=tab`/`aria-selected` y `Login.html?modo=registro` (recorrido 4) | Medio | 1 | — | `Login.html:46,51,53-54`, `js/pages/login.js:315`, `index.html:119` (solo el href, coordinarlo con la sesión principal) | Un solo h1, el lector anuncia la pestaña activa y el CTA "Crear cuenta" abre directo en Registro |
| 11 | Pruebas unitarias de los flujos críticos de progreso: guard de invitado, alta de Viendo y `watchStatus` en `saveDetailStateToSupabase` | Alto | 2 | #2, #5, #6 | `tests/unit/progress-flow.test.js` (nuevo) | `npm test` en verde, con casos con y sin sesión y con fallo de Supabase (rechazo controlado, sin throw) |
| 12 | CSS base: `prefers-reduced-motion` global, token `--neon-purple-text` para texto (el violeta falla AA 4.45/4.12 sobre card/panel) y botones de cierre ≥44px | Medio | 1.5 | — | `css/base.css` (`:root`), `css/components.css:293,610-612,1649,1860`, `css/detalle-premium.css:543-544` | Contraste ≥4.5 en el footer, animaciones cortadas con reduce-motion y áreas táctiles ≥44px en móvil |
| 13 | Contador local de errores de sync y cola pendiente visible en Configuración (métricas 1) | Medio | 1.5 | Que la sesión cierre `configuracion.*` (notif-prefs) | `js/catalog/states.js:15-80`, `js/pages/configuracion.js`, `configuracion.html` | `ad:metrics:sync {ok,fail,retry,lastCode,lastAt}` se actualiza y Configuración muestra "N cambios pendientes"; no sale nada del dispositivo |
| 14 | Temporadas: no mezclar `chapters \|\| volumes` (dos unidades distintas) | Medio | 1.5 | — | `js/core/api.js:94,113`, `tests/unit/seasons.test.js` | Un manga con volúmenes y sin capítulos no muestra "N capítulos", y se agrega un test |
| 15 | Catálogo: mapear `cancelled`→CANCELLED, `UNKNOWN`→"Sin estado" en tono neutro, sin default RELEASING, y el año en las cards (`startDate{year}` y copiar `attrs.year`) | Medio | 2 | — | `js/core/api-mangadex.js:225,236-242`, `js/core/mangadex-api.js:150`, `js/catalog/cards.js:262-315,675`, `js/core/api.js:182,296` | Que ninguna card muestre "UNKNOWN" crudo, que una cancelada diga Cancelado y que el año aparezca en las cards de manga de AniList y MangaDex |
| 16 | Sincronizar `server/schema.sql` con 003-013 y anotar que la 011 no existe | Medio | 2 | #4 | `server/schema.sql`, `server/migrations/README` o encabezado | `schema.sql` en una base vacía queda igual que 001-013 aplicadas (comment_likes, feed, push, watch_status, is_public) |
| 17 | RPC DEFINER de agregados diarios (viewed / progress_updated / completed por día, sin user_id) (métricas 2) | Medio | 2 | #4 | `server/migrations/014_*.sql` o la 016 | `SELECT * FROM daily_counts(30)` devuelve solo fecha y conteos, solo para service role o admin |
| 18 | `comment_likes`: lectura solo de los propios + contador público (Supabase 3) | Medio | 2 | Revisar los usos en `js/detalle/comments.js` | migración nueva, `js/detalle/comments.js` | Anon no puede listar quién likeó, el contador sigue visible y el botón de like refleja el estado propio |
| 19 | `push_subscriptions`: `register_push_subscription` DEFINER para cambiar de usuario en el mismo navegador (Supabase 8) | Medio | 2 | Que la sesión cierre `js/core/push.js` | migración nueva, `js/core/push.js` | Logout A + login B en el mismo navegador: enable() = ok y la suscripción queda a nombre de B |
| 20 | E2E de invitado y de sesión: marcar episodio, fav/visto/Viendo, home con Supabase caído | Alto | 3 | #11 | `tests/e2e/flujos.spec.js` (nuevo) | Playwright en verde en viewport móvil y escritorio y con las APIs bloqueadas (la página no rompe) |
| 21 | Helper único de progreso: unificar los tres parsers de `mis-listas.js` y `loadAllProgress`, más los bugs `lastChapter` (`mis-listas.js:839`), regex `ch:` y `inicio.js:303-320` sin render | Alto | 4 | #25 y #26 cerrados; #11 | `js/core/progress-keys.js` (nuevo), `js/pages/mis-listas.js:383-402,606-640,821-843`, `js/pages/inicio.js:303-320` | Mismo resultado que hoy en listas y home, con "último capítulo" = máximo y no el último iterado; ante un fallo la home muestra un mensaje; con tests |
| 22 | Caché MangaDex: TTL en `md_*` y poda selectiva (no borrar todo ante cuota) + dedup de novelas por `links.al/mal` | Medio | 3 | #15 | `js/core/mangadex-api.js:19-26`, `js/core/api-mangadex.js:279` | Las claves vencen, con cuota llena se borran solo las más viejas y los títulos japoneses o coreanos no se colapsan entre sí |
| 23 | `last_seen_date` en `profiles` (solo fecha, declarado en la política) para medir el retorno a 7 y 30 días (métricas 3) | Medio | 3 | #7, #17 | migración nueva, `js/core/auth.js:207-262` | Se escribe como máximo una vez por día y la cohorte 7d/30d sale por RPC agregada |
| 24 | Cortes seguros de archivos grandes: `api-personajes.js`, `search-recientes.js`, `mis-listas-stats.js` y `mis-listas-recs.js` | Medio | 4 | #15, #21; la sesión cerró `mis-listas.js` | `js/core/api.js:770-838,1068-1431`, `js/catalog/search.js:301-485`, `js/pages/mis-listas.js:809-1143`, `build.js:89` (JS_SOURCES), `<script>` en `mis-listas.html` | Mismo comportamiento, `npm test` y smoke en verde, sin globales reasignadas y `npm run map` actualizado |
| 25 | **En curso (esta sesión)**: "Seguí donde lo dejaste" con siguiente paso y +1 rápido (cubre recorrido 5) | Alto | — | — | `js/pages/inicio.js`, `css/inicio.css`, `index.html` | Lo cierra la sesión principal |
| 26 | **En curso (esta sesión)**: muro de actividad + perfil público `?u=` + migración 013 (`is_public`) | Alto | — | — | `usuario.html`, `js/pages/usuario.js`, `api/supabase-client.js`, `server/migrations/013_*.sql` | Lo cierra la sesión principal |
| 27 | **En curso (esta sesión)**: calendario "Solo lo que sigo" + recordatorios opt-in + preferencias por categoría (`notif-prefs.js`) | Medio | — | — | `js/pages/calendario.js`, `js/core/reminders.js`, `js/core/notif-prefs.js`, `js/pages/configuracion.js` | Lo cierra la sesión principal |
| 28 | **En curso (esta sesión)**: logros y misiones por progreso real (cubre investigación 4) | Medio | — | — | `js/core/missions.js` | Lo cierra la sesión principal |
| 29 | **En curso (esta sesión)**: `js/core/recommend.js` con motivos (título real, filtro +18) | Medio | — | — | `js/core/recommend.js`, `js/detalle/render-sections.js`, `js/pages/mis-listas.js` | Lo cierra la sesión principal |
| 30 | **En curso (esta sesión)**: `js/core/novedades.js` | Medio | — | — | `js/core/novedades.js`, `tests/unit/novedades.test.js` | Lo cierra la sesión principal |

## Dueño por archivo

| Archivo(s) | Dueño | Notas |
|---|---|---|
| `js/detalle/render.js`, `progress.js`, `data.js` | mejora-recorrido | #2, #5, #6 en un mismo cambio |
| `Login.html`, `js/pages/login.js` | mejora-accesibilidad | #10, incluye `?modo=registro` |
| `detalle.html`, `js/core/common-ui.js`, `css/base.css`, `css/components.css`, `css/detalle-premium.css` | mejora-accesibilidad | #3, #9, #12; nunca el `<meta>` CSP |
| `netlify/functions/mdapi-cors.mjs`, `js/core/api.js`, `api-mangadex.js`, `mangadex-api.js`, `js/catalog/cards.js` | mejora-catalogo | #1, #14, #15, #22; arquitectura recién después (#24) |
| `server/migrations/014+`, `server/schema.sql` | mejora-supabase | #4, #8, #16-#19, #23; métricas y privacidad proponen el SQL, supabase lo escribe |
| `privacidad.html`, `terminos.html` | mejora-privacidad | #7 |
| `js/catalog/states.js` | mejora-metricas | #13 |
| `tests/unit/*`, `tests/e2e/*` | mejora-pruebas | #11, #20 |
| `js/catalog/search.js`, cortes nuevos y `build.js` (JS_SOURCES) | mejora-arquitectura | #24, último |
| `js/pages/inicio.js`, `mis-listas.js`, `calendario.js`, `usuario.js`, `configuracion.js`, `api/supabase-client.js`, `js/core/missions.js`, `reminders.js`, `push.js`, `recommend.js`, `novedades.js`, `notif-prefs.js`, `index.html`, `usuario.html`, `configuracion.html` | sesión principal | Congelados hasta que se commitee lo que está en curso |
| `js/core/i18n.js`, `i18n-en.js` | sesión principal (integra) | Cada agente manda sus claves con un prefijo propio (`privacy.*`, `a11y.*`, `catalog.*`) |

## Riesgos de integración

- La 013 deja `is_public` en false por defecto: el muro y `?u=` arrancan vacíos y el ranking (`get_ranking_profiles`) sigue público sin filtro. Hay que declararlo en #7 o decidir explícitamente si se filtra [Seguro: `013:32-42`, el ranking no se toca].
- #5 y #6 tocan el mismo handler de `render.js:1063`, y #6 solo se nota si "Seguí donde lo dejaste" (#25) lee `wstatus`. Van juntos y se prueban sobre lo que deje la sesión.
- #2 depende de que `saveItemState` use v3 cuando llega `watchStatus`. Si la 003 no está aplicada cae a v2 y el DELETE vuelve a pasar [Probable: `supabase-client.js:281-314`].
- Número de migración: la 011 no existe y la 014 la reclaman #4 y #17. El dueño es supabase y numera una sola vez.
- #8 (`UNIQUE lower(username)`) falla si ya hay duplicados: consultar antes, y no correrla dentro de la misma transacción que otras.
- `configuracion.*`, `push.js` y `mis-listas.js` están modificados en esta sesión: #13, #19, #21 y #24 esperan al commit para no pisarse.
- Partir archivos (#24) cambia `JS_SOURCES` en `build.js` y el precache en `sw.js`: si queda mal el orden, la página rompe sin aviso. Solo con smoke e2e en verde.
- `code-map.json` está desactualizado: los agentes no deberían usarlo como fuente de líneas hasta que se corra `npm run map`.

## Qué no hacer todavía

- No partir `mascot.js` (riesgo alto: closure compartido, sin tests) ni `retos.js` hasta tener #20.
- No cambiar la firma de `get_activity_feed` para pasar a cursor `p_before`: la 013 ya acota el offset y el cambio obliga a DROP + GRANT + cliente.
- No activar analítica de terceros (Umami, `ANALYTICS.id` vacío) ni recomendaciones colaborativas en Supabase: no hay volumen ni decisión del dueño.
- No pasar episodios y capítulos de `0` a `null` en todo el catálogo de una vez (`api.js:171-172`): muchos consumidores comparan con 0. Primero el texto "En emisión" en el detalle.
- No arreglar sesiones y minutos de `usuario.js:292-298` hasta definir si se miden (es dato nuevo y tiene que declararse en la política).
