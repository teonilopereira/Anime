# Backlog Mirudoku — Plan 1 · Mejora

Estado al commit `82c770d` (12-nov-2026; 471 tests unitarios y 33 e2e en verde). Lo armé con los informes `mejora-*`, `retencion-*` e `impl-*`.
Arriba va lo pendiente, ordenado por impacto ÷ esfuerzo (Alto=3, Medio=2, Bajo=1; horas estimadas [Suposición]). Lo de esta sesión está en "Hecho (esta sesión)".
Sigue sin aplicarse nada en Supabase: el dueño corre a mano 013 → 014 → 015 → 016 en el SQL Editor. Hasta entonces el cliente degrada (el muro y `?u=` exponen como en la 009 y el toggle de perfil revierte) [Seguro: `impl-comunidad*.md`].

## Pendiente

| # | Tarea | Impacto | Esfuerzo (h) | Depende de | Archivos | Aceptación |
|---|-------|---------|--------------|------------|----------|------------|
| 1 | Aplicar en orden 013, 014, 015 y 016 en Supabase y probar `?u=`, el muro y el ranking en un navegador real | Alto | 0.5 | #3 (antes de correr la 016) | `server/migrations/013_*.sql` … `016_item_states_total.sql` | Pasan las consultas de verificación de cada archivo, `cron.job` lista activity-cleanup, el ranking enlaza solo a públicos y `?u=` oculta a los privados, en móvil y escritorio |
| 2 | `sw.js`: revisar el precache ahora que `configuracion.html` carga `utils.js` y `states.js` | Medio | 0.5 | — | `sw.js:64` (lista de precache), `configuracion.html` | Configuración offline (después de una visita) abre sin errores de script; smoke e2e en verde |
| 3 | Decidir y documentar la semántica de NULL en `save_item_state_v4` (no pisa el estado) frente a v3, antes de aplicar la 016 | Medio | 0.5 | — | `server/migrations/016_item_states_total.sql`, `api/supabase-client.js` (llamadas v3/v4) | Hay un comentario en la 016 y un test que fija qué hace NULL en `watch_status` y en `total` con v3 y con v4 |
| 4 | `UNIQUE lower(username)` antes de difundir `?u=` | Alto | 1 | Consulta de duplicados (dueño); #1 | `server/migrations/017_*.sql` (próxima libre) | 0 duplicados, índice creado y "Foo" contra "foo" da un error claro en Login |
| 5 | Usar `grantProgressXp` en lugar de la XP local en la ficha [Probable: `render.js:~700`] | Bajo | 0.5 | — | `js/detalle/render.js`, `api/supabase-client.js:354` (solo lectura) | La ficha y el +1 de la home dan la misma XP por la misma ruta, con test |
| 6 | Sacar "No especificado" de las interacciones de la ficha (relleno y capítulos) [Seguro: `interactions.js:160,220`] | Bajo | 0.5 | — | `js/detalle/interactions.js:160,220`, `detailMissingTotalLabel` en `render-sections.js:47-55` | Mismos textos que el resto del detalle ("En emisión (sin total)" / "Sin dato") |
| 7 | Los comentarios no tienen que enlazar a autores privados: `get_profiles_by_ids` devuelve `is_public` | Medio | 1 | #1 | migración 017+ (puede ir con #4), `js/detalle/comments.js` (renderComment) | Un autor privado se muestra sin enlace y uno público enlaza a `?u=` |
| 8 | Actualizar `docs/SETUP_SUPABASE.md`: orden 001-016, pg_cron, 011 inexistente, 001/002 no re-ejecutables | Medio | 1 | #3 | `docs/SETUP_SUPABASE.md` | Alguien que monta desde cero sigue el doc y llega a lo mismo que `schema.sql` |
| 9 | E2E con sesión simulada: fav/visto/Viendo, +1 en la home, cola que se vacía al volver online | Alto | 3 | — | `tests/e2e/flujos.spec.js` (stub de `AppSupabase`) | Verde en viewport móvil y escritorio, con Supabase OK y con Supabase caído |
| 10 | `comment_likes`: lectura solo de los propios + contador público | Medio | 2 | #7 | migración 017+, `js/detalle/comments.js` | Anon no puede listar quién likeó y el contador y el estado propio siguen bien |
| 11 | `push_subscriptions`: `register_push_subscription` DEFINER (cambio de usuario en el mismo navegador) | Medio | 2 | — | migración 017+, `js/core/push.js` | Logout A + login B: enable() = ok y la suscripción queda a nombre de B |
| 12 | RPC DEFINER de agregados diarios (viewed / progress_updated / completed por día, sin user_id) | Medio | 2 | #1 | migración 017+ | `daily_counts(30)` devuelve solo fecha y conteos, solo para service role o admin |
| 13 | Dedup de novelas por `links.al/mal` + aviso "portada de la serie" en tomos sin portada propia | Medio | 2 | — | `js/core/api-mangadex.js:279`, `js/pages/volumenes.js:196` | Los títulos no latinos no se colapsan y los tomos con la portada general lo avisan |
| 14 | Hacer 001 y 002 re-ejecutables sobre una base al día (o marcarlas "solo base nueva") | Bajo | 1 | #8 | `server/migrations/001_*.sql`, `002_*.sql` | Correrlas dos veces no falla, o el encabezado lo prohíbe y `SETUP_SUPABASE.md` lo dice |
| 15 | Helper único de progreso: los tres parsers de `mis-listas.js` (1558 líneas), el bug `lastChapter` (máximo, no el último iterado) y el regex `ch:` | Alto | 4 | #9 | `js/core/progress-keys.js` (nuevo), `js/pages/mis-listas.js` (volver a mapear rangos), `js/pages/inicio.js` | Mismo resultado en listas y home, "último capítulo" = máximo, con tests |
| 16 | `last_seen_date` en `profiles` (solo fecha, declarado en la política) para medir el retorno a 7 y 30 días | Medio | 3 | #12 | migración 017+, `js/core/auth.js:207-262`, `privacidad.html` | Se escribe como máximo una vez por día y la cohorte sale por RPC agregada |
| 17 | Preferencias de notificación y recordatorios en el servidor (`profiles.preferences`), y que el push respete pausa, límite y silencio | Medio | 4 | #11 | migración 017+, `js/core/notif-prefs.js`, `js/core/reminders.js`, `supabase/functions/notify-new-episodes` | Las preferencias cruzan dispositivos y el push del servidor no sale en horario de silencio |
| 18 | Cortes seguros de archivos grandes: `api-personajes.js`, `search-recientes.js`, `mis-listas-stats.js` y `mis-listas-recs.js` | Medio | 4 | #9, #15 | `js/core/api.js`, `js/catalog/search.js:301-485`, `js/pages/mis-listas.js`, `tools/build.js` (JS_SOURCES), `sw.js` | Mismo comportamiento, unit y e2e en verde y `npm run map` actualizado |
| 19 | Novedades: "ya salió" con dato real (episodios emitidos, no inferido de la cadencia semanal) | Bajo | 2 | — | `js/core/novedades.js`, `js/core/api.js` (airingSchedule pasado) | El ítem "Nuevo" coincide con un episodio emitido según AniList |

## Hecho (esta sesión)

| Tarea | Dónde quedó |
|---|---|
| "Seguí donde lo dejaste" con siguiente paso y +1 rápido | `js/pages/inicio.js:200,~360,~454`, `tests/unit/inicio-next-step.test.js` |
| Muro + perfil público `?u=` + migración 013 (`is_public`, default false) | `js/pages/usuario.js`, `api/supabase-client.js:554-605`, `server/migrations/013_*.sql` |
| Calendario "Solo lo que sigo", recordatorios por título, `notif-prefs.js` | `js/pages/calendario.js`, `js/core/reminders.js:74-143`, `js/core/notif-prefs.js` |
| Logros por progreso real; misiones que respetan `isAllowed('retos')` | `js/pages/mis-listas-logros.js`, `js/core/missions.js:149-158` |
| `recommend.js` con motivos y filtro +18 | `js/core/recommend.js`, `js/pages/inicio.js:150-186`, `js/detalle/render-sections.js` |
| `novedades.js` en la home, con estados y progreso pasados desde inicio (una sola carga) | `js/core/novedades.js` (`render(host,{states,progress})`), `index.html:79` |
| El proxy MangaDex no cachea errores | `netlify/functions/mdapi-cors.mjs:68-86` |
| `data.js` manda `watchStatus` | `js/detalle/data.js:160-185` |
| Accesibilidad 1-10 (modal, Login, navbar, "Ver más", contraste, 44px, reduced-motion, `?modo=registro`) | `detalle.html:175`, `js/core/common-ui.js:666-722`, `Login.html`, `css/base.css` |
| Migración 014: sin INSERT en el log, cron de limpieza, tope de 200 ids | `server/migrations/014_activity_log_hardening.sql` |
| Guard de invitado y "Viendo" al primer episodio o tomo | `js/detalle/progress.js:113-147`, `js/detalle/render.js` |
| Cola de progreso con owner: sin sesión no se envía | `js/detalle/progress.js:64-93`, `js/pages/inicio.js:459-482` |
| Política de privacidad: social, secciones 1 y 4 y nota de ranking | `privacidad.html` |
| "Seguir viendo" enlaza a `#epGrid` con scroll y foco | `js/pages/inicio.js`, `js/detalle/render-sections.js:70` |
| `AppSyncMetrics` + bloque "Sincronización" en Configuración | `js/catalog/states.js:34-82`, `configuracion.html:411-418`, `js/pages/configuracion.js:689-775` |
| Detalle sin total: `detailMissingTotalLabel` y `seasonCardCounts` | `js/detalle/render-sections.js:47-55` |
| Toast único al primer episodio; el toast de misión no gasta el límite diario (sin `recordSent`) | `js/catalog/states.js`, `js/core/missions.js` |
| Catálogo: UNKNOWN/CANCELLED, año, temporadas por unidad, "sin total", TTL de la caché MangaDex | `js/core/api-mangadex.js`, `js/catalog/cards.js`, `js/core/api.js:91-140,307` |
| `schema.sql` = 001-016 (verificado con pg_dump) | `server/schema.sql` |
| XP del +1 de la home por `grantProgressXp`; migración 016 (`item_states.total`, `save_item_state_v4`) | `api/supabase-client.js:354`, `server/migrations/016_item_states_total.sql` |
| Migración 015: el ranking devuelve `is_public` y enlaza solo a públicos | `server/migrations/015_ranking_is_public.sql`, `js/pages/ranking.js` |
| Racha con día de gracia y `daysLeft`; textos sin presión | `js/core/streak.js`, `js/pages/inicio.js`, `js/core/reminders.js` |
| E2E de flujos de invitado (10 tests) | `tests/e2e/flujos.spec.js` (el de sesión queda en #9) |
| Reenvío del correo de confirmación | `js/pages/login.js:103-190` |
| `data-i18n` en `usuario.html` | `usuario.html`, `js/core/i18n.js`, `i18n-en.js` |
| Calendario "Faltan X de Y" (`episodes` en `WEEKLY_AIRING_QUERY`) | `js/core/api.js`, `js/pages/calendario.js` |
| Tests de las colas de progreso y sync; `loadAllProgress` con `updated_at`; `check-quality` (enlaces, ids, i18n); `docs/ARQUITECTURA.md`; `?u=` desde comentarios | `tests/unit/*`, `tools/check-quality.js`, `docs/`, `js/detalle/comments.js` |

## Dueño por archivo

| Archivo(s) | Dueño | Tareas |
|---|---|---|
| `server/migrations/017+`, `server/schema.sql`, `docs/SETUP_SUPABASE.md` | mejora-supabase | #3, #4, #7 (SQL), #8, #10-#12, #14, #16, #17 (SQL) |
| Aplicar migraciones en Supabase | dueño del proyecto | #1 |
| `sw.js`, `tools/build.js` | mejora-arquitectura | #2, #18 |
| `js/detalle/render.js`, `interactions.js`, `render-sections.js` | mejora-recorrido | #5, #6 |
| `js/detalle/comments.js`, `js/pages/ranking.js` | mejora-comunidad | #7, #10 (cliente) |
| `tests/e2e/*`, `tests/unit/*` | mejora-pruebas | #9 y los tests de cada tarea |
| `js/core/push.js`, `notif-prefs.js`, `reminders.js`, `supabase/functions/` | retencion-notificaciones | #11 (cliente), #17 |
| `js/core/api-mangadex.js`, `js/pages/volumenes.js`, `js/core/novedades.js` | mejora-catalogo | #13, #19 |
| `js/pages/mis-listas.js`, `js/pages/inicio.js`, `js/catalog/search.js` | mejora-arquitectura | #15, #18 (al final) |
| `js/core/auth.js`, `privacidad.html` | mejora-metricas + mejora-privacidad | #16 (código: métricas, texto: privacidad) |
| `js/core/i18n.js`, `i18n-en.js` | sesión principal (integra) | Claves con prefijo por agente |

## Riesgos de integración

- Nada de 013-016 está aplicado [Probable]: el cliente degrada, pero las funciones nuevas (`grantProgressXp`, v4, `is_public` en el ranking) no se probaron contra una base real.
- La 016 cambia la escritura de estados (v4): si NULL tiene otra semántica que en v3, un cliente viejo cacheado por el SW puede pisar o no pisar `watch_status` (#3 antes de #1).
- Las migraciones 017+ las numera un solo dueño (supabase); conviene juntar #4 y #7 en la misma.
- `configuracion.html` ahora depende de `utils.js` y `states.js`: si el precache o el orden de scripts falla, Configuración rompe offline (#2).
- `inicio.js` y `progress.js` comparten `progressSyncQueue` con owner: #5, #9 y #15 tienen que respetar ese formato.
- `mis-listas.js` en 1558 líneas: los rangos de corte de `mejora-arquitectura.md` ya no valen; hay que volver a mapear antes de #15 y #18.
- `notif-prefs` y recordatorios viven solo en el navegador: el push del servidor ignora pausa, límite y silencio hasta #17.

## Qué no hacer todavía

- No partir `mascot.js` ni `retos.js` hasta tener #9.
- No cambiar la firma de `get_activity_feed` (cursor `p_before`): la 013 ya acota el offset.
- No activar analítica de terceros (Umami) ni recomendaciones colaborativas en Supabase.
- No arreglar sesiones y minutos de `usuario.js:292-298` sin decidir antes si se miden (es dato nuevo y va declarado).

## Pendientes que dejaron los agentes

- Aplicar 013, 014, 015 y 016 en ese orden → #1.
- Comentarios que enlazan a autores privados (`get_profiles_by_ids` sin `is_public`) → #7.
- `docs/SETUP_SUPABASE.md` desactualizado → #8.
- `render.js:~700` podría usar `grantProgressXp` → #5.
- `interactions.js:160,220` con "No especificado" → #6.
- E2E con sesión simulada (falta el flujo con sesión en `flujos.spec.js`) → #9.
- Semántica de NULL en `save_item_state_v4` (no pisa) frente a v3 → #3.
- Migraciones 001 y 002 no re-ejecutables sobre una base al día → #14.
- `configuracion.html` carga `utils.js` y `states.js`: revisar el precache de `sw.js` → #2.
- "Ya salió" en novedades sigue inferido → #19.
- Arrastrados de rondas anteriores: dedup de novelas y "portada de la serie" (#13); push sin respetar preferencias y categoría "comunidad" sin avisos (#17); manga en novedades y "Al Día" exacto (sin fecha); motivo por recomendaciones de AniList en Mis listas (sin tarea, por costo de API).
