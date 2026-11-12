# Backlog Mirudoku — Plan 1 · Mejora

Estado al cierre de la sesión del 12-nov-2026 (commits `bc71ffc` y `af34bc6`; 404 tests unitarios y 23 e2e de humo en verde). Lo armé con los informes `mejora-*`, `retencion-*` e `impl-*`.
Arriba va lo pendiente, ordenado por impacto ÷ esfuerzo (Alto=3, Medio=2, Bajo=1; horas estimadas [Suposición]). Lo de esta sesión está en "Hecho (esta sesión)".
Hay cosas que no corren hasta que el dueño aplique a mano la 013 y la 014 en el SQL Editor de Supabase: hasta entonces el muro y `?u=` exponen como en la 009 y el log acepta INSERT directo [Seguro: `impl-comunidad*.md`].

## Pendiente

| # | Tarea | Impacto | Esfuerzo (h) | Depende de | Archivos | Aceptación |
|---|-------|---------|--------------|------------|----------|------------|
| 1 | Aplicar la 013 y la 014 en Supabase y probar el perfil público y el muro en un navegador real (nunca se probó) | Alto | 0.5 | — | `server/migrations/013_social_privacy_public_profile.sql`, `014_activity_log_hardening.sql` | Pasan las consultas de verificación del final de cada archivo, `cron.job` lista activity-cleanup y `?u=` muestra un perfil público y oculta uno privado, en móvil y escritorio |
| 2 | `drainProgressQueue` no tiene que intentar sin sesión [Seguro: `progress.js:66-72` solo chequea `setProgress`] | Medio | 0.5 | — | `js/detalle/progress.js:66` | Sin sesión la cola no se toca ni se manda; al loguear se vacía con la cuenta correcta. Test en `progress-sync-queue.test.js` |
| 3 | Completar `privacidad.html` sección 4: rachas, misiones, cola de sync, `ad:metrics:sync`, preferencias de notificación y recordatorios (todo local, por dispositivo); log de actividad ≤90 días; ranking visible aunque el perfil sea privado [Seguro: `privacidad.html:108` solo menciona tema y sesión] | Alto | 1 | — | `privacidad.html:96-108`, `privacy.*` en `js/core/i18n.js` / `i18n-en.js` | Cada clave local y cada superficie pública aparece nombrada, en ES y EN |
| 4 | "Seguir viendo" abre la ficha en `#epGrid` (recorrido 5) | Medio | 0.5 | — | `js/pages/inicio.js` (enlaces del stage), `js/detalle/render.js:378` | Desde la home la ficha abre con la grilla de episodios a la vista y el foco ahí |
| 5 | `UNIQUE lower(username)` antes de difundir `?u=` | Alto | 1 | Consulta de duplicados (dueño); #1 | `server/migrations/015_username_unique.sql` (nuevo) | 0 duplicados, índice creado y "Foo" contra "foo" da un error claro en Login |
| 6 | Mostrar `AppSyncMetrics` en Configuración: cambios pendientes, último error y botón "Reintentar" | Medio | 1 | #3 (declararlo) | `js/pages/configuracion.js`, `configuracion.html`, `css/configuracion.css` | Configuración muestra "N cambios pendientes" y el último código; reintentar llama a `AppSyncMetrics.drain()`; sin sesión, oculto |
| 7 | Detalle sin "No especificado" cuando falta el total: "En emisión (sin total)" o "Sin dato", y `render-sections.js` pasa `chapters`/`volumes` | Medio | 1.5 | — | `js/detalle/render.js:117,158,199,981`, `js/detalle/render-sections.js:71` | Una obra en emisión sin total dice "En emisión (sin total)", y una terminada sin dato dice "Sin dato" |
| 8 | Toasts: no mostrar dos al marcar el primer episodio, y que el toast de misión no consuma el límite diario de avisos | Bajo | 1 | — | `js/catalog/states.js`, `js/core/missions.js:149-158` | El primer episodio da un solo toast y el límite diario cuenta solo los avisos reales |
| 9 | `schema.sql`: agregar lo que falta (comment_likes, push_subscriptions/push_sent, save_item_state_v3, permisos por columna) | Medio | 1.5 | — | `server/schema.sql` | En una base vacía, `schema.sql` deja lo mismo que 001-014 aplicadas |
| 10 | +1 de la home con XP (misma ruta que `maybeGrantProgressXp`) y `loadItemStates` con `meta.total` | Medio | 1.5 | — | `js/pages/inicio.js` (~454), `js/detalle/render.js`, `api/supabase-client.js` | El +1 desde la home da la misma XP que en la ficha; "Ep. N de M" muestra M en las obras del servidor |
| 11 | Ranking y privacidad: decidir si `get_ranking_profiles` filtra `is_public`, o no enlazar a `?u=` a los privados (hoy el enlace lleva a un estado vacío) | Medio | 1.5 | #1; decisión del dueño | migración nueva, `js/pages/ranking.js` (nickHtml) | O el ranking solo muestra públicos, o los privados aparecen sin enlace; documentado en #3 |
| 12 | Racha: un día de gracia y textos sin presión | Medio | 1.5 | — | `js/core/streak.js`, `js/pages/inicio.js:60-62`, `js/core/reminders.js:118-121` | Faltar un día no corta la racha y no queda ningún "para no perderla" |
| 13 | E2E de flujos: invitado marca episodio → pedido de login; con sesión fav/visto/Viendo; home con Supabase bloqueado (hoy hay solo humo por página) [Seguro: `tests/e2e/smoke.spec.js`] | Alto | 3 | #2 | `tests/e2e/flujos.spec.js` (nuevo) | Verde en viewport móvil y escritorio y con las APIs bloqueadas |
| 14 | Recordatorio de correo de confirmación con reenvío y aviso de spam (recorrido 6) | Bajo | 1 | — | `js/pages/login.js:238`, `Login.html` | Después del registro hay un botón "Reenviar" con espera y la nota de spam |
| 15 | `comment_likes`: lectura solo de los propios + contador público | Medio | 2 | Revisar los usos en `comments.js` | migración nueva, `js/detalle/comments.js` | Anon no puede listar quién likeó y el contador y el estado propio siguen bien |
| 16 | `push_subscriptions`: `register_push_subscription` DEFINER (cambio de usuario en el mismo navegador) | Medio | 2 | — | migración nueva, `js/core/push.js` | Logout A + login B: enable() = ok y la suscripción queda a nombre de B |
| 17 | RPC DEFINER de agregados diarios (viewed / progress_updated / completed por día, sin user_id) | Medio | 2 | #1 | migración nueva | `daily_counts(30)` devuelve solo fecha y conteos, solo para service role o admin |
| 18 | Dedup de novelas por `links.al/mal` + aviso "portada de la serie" en tomos sin portada propia | Medio | 2 | — | `js/core/api-mangadex.js:279`, `js/pages/volumenes.js:196` | Los títulos no latinos no se colapsan y los tomos con la portada general lo avisan |
| 19 | `usuario.html`: `data-i18n` en el perfil público y el muro | Bajo | 1 | — | `usuario.html`, `js/core/i18n.js`, `i18n-en.js` | `check-quality` en verde y el perfil público traducido en EN |
| 20 | Calendario "faltan X de Y": pedir `episodes` en `WEEKLY_AIRING_QUERY` | Bajo | 1 | — | `js/core/api.js:897`, `js/pages/calendario.js` | Las cards de seguidos muestran cuántos episodios faltan |
| 21 | Novedades: recibir estados y progreso desde `inicio.js` (hoy los carga dos veces) | Bajo | 1 | — | `js/core/novedades.js`, `js/pages/inicio.js:596` | Una sola llamada a `loadItemStates` y `loadAllProgress` por carga de home |
| 22 | Helper único de progreso: los tres parsers de `mis-listas.js` (ahora 1558 líneas), el bug `lastChapter` (máximo, no el último iterado) y el regex `ch:` | Alto | 4 | #13 | `js/core/progress-keys.js` (nuevo), `js/pages/mis-listas.js` (revisar rangos: crecieron), `js/pages/inicio.js` | Mismo resultado en listas y home, "último capítulo" = máximo, con tests |
| 23 | `last_seen_date` en `profiles` (solo fecha, declarado) para medir el retorno a 7 y 30 días | Medio | 3 | #3, #17 | migración nueva, `js/core/auth.js:207-262` | Se escribe como máximo una vez por día y la cohorte sale por RPC agregada |
| 24 | Preferencias de notificación y recordatorios en el servidor (`profiles.preferences`), y que el push respete pausa, límite y silencio | Medio | 4 | #16 | migración nueva, `js/core/notif-prefs.js`, `js/core/reminders.js`, `supabase/functions/notify-new-episodes` | Las preferencias cruzan dispositivos y el push del servidor no sale en horario de silencio |
| 25 | Cortes seguros de archivos grandes: `api-personajes.js`, `search-recientes.js`, `mis-listas-stats.js` y `mis-listas-recs.js` | Medio | 4 | #13, #22 | `js/core/api.js`, `js/catalog/search.js:301-485`, `js/pages/mis-listas.js`, `tools/build.js` (JS_SOURCES), `sw.js` | Mismo comportamiento, unit y e2e en verde y `npm run map` actualizado |

## Hecho (esta sesión)

| Ex # | Tarea | Dónde quedó |
|---|---|---|
| 25 | "Seguí donde lo dejaste" con siguiente paso y +1 rápido | `js/pages/inicio.js:200,~360,~454`, `tests/unit/inicio-next-step.test.js` |
| 26 | Muro + perfil público `?u=` + migración 013 (`is_public`, default false) | `js/pages/usuario.js:94-191,663+`, `api/supabase-client.js:554-605`, `server/migrations/013_*.sql` |
| 27 | Calendario "Solo lo que sigo", recordatorios por título y `notif-prefs.js` | `js/pages/calendario.js`, `js/core/reminders.js:74-143`, `js/core/notif-prefs.js`, `configuracion.html:149-212` |
| 28 | Logros por progreso real y misiones que respetan `isAllowed('retos')` | `js/pages/mis-listas-logros.js:75-393`, `js/core/missions.js:149-158` |
| 29 | `recommend.js` con motivos y filtro +18 (también en inicio) | `js/core/recommend.js`, `js/pages/inicio.js:150-186`, `js/detalle/render-sections.js` |
| 30 | `novedades.js` en la home | `js/core/novedades.js`, `index.html:79` |
| 1 | El proxy MangaDex no cachea errores (no-store y 502) | `netlify/functions/mdapi-cors.mjs:68-86` |
| 2 | `data.js` manda `watchStatus` | `js/detalle/data.js:160-185` |
| 3, 9, 10, 12 | Accesibilidad 1-10: modal de resumen, Login con un h1 y aria-pressed, navbar, "Ver más" como botón, `--neon-purple-text`, botones de 44px, reduced-motion global, CTA `?modo=registro` | `detalle.html:175`, `js/core/common-ui.js:666-722`, `Login.html`, `css/base.css` |
| 4 | Migración 014: sin INSERT en el log, cron de limpieza, tope de 200 ids | `server/migrations/014_activity_log_hardening.sql` |
| 5, 6 | Guard de invitado y "Viendo" al primer episodio o tomo | `js/detalle/progress.js:113-147`, `js/detalle/render.js:945,956,1097,1104` |
| 7 | Política de privacidad: sección social | `privacidad.html:100-101` (falta la sección 4: ver #3) |
| 11 | Tests de las colas de progreso y de sync | `tests/unit/progress-sync-queue.test.js`, `states-sync-queue.test.js`, `detalle-progress.test.js` |
| 13 | Contador de errores de sync `AppSyncMetrics` (sin UI: ver #6) | `js/catalog/states.js:34-82` |
| 14, 15, 22 | Catálogo: UNKNOWN/CANCELLED, año, temporadas por unidad, "sin total" en cards y tomos, sinopsis única, TTL de 7 días en la caché MangaDex | `js/core/api-mangadex.js:213-255`, `js/catalog/cards.js:285-327`, `js/core/api.js:91-140,307`, `tests/unit/catalogo-datos.test.js` |
| 16 | `schema.sql` sincronizado con 009/013/014 (parcial: ver #9) | `server/schema.sql` |
| — | `loadAllProgress` con `updated_at` | `api/supabase-client.js:435-441` |
| — | `check-quality`: enlaces rotos, ids duplicados y `data-i18n` sin clave | `tools/check-quality.js` |
| — | `docs/ARQUITECTURA.md`, `MAPEO_ARCHIVOS.md` y `code-map.json` regenerado | `docs/` |
| — | Enlaces a `?u=` desde ranking y comentarios | `js/pages/ranking.js` (nickHtml), `js/detalle/comments.js` (renderComment) |

## Dueño por archivo

| Archivo(s) | Dueño | Tareas |
|---|---|---|
| `server/migrations/015+`, `server/schema.sql` | mejora-supabase | #5, #9, #11 (SQL), #15-#17, #23, #24 (SQL) |
| `privacidad.html`, `terminos.html` | mejora-privacidad | #3 |
| `js/detalle/progress.js`, `render.js`, `render-sections.js` | mejora-recorrido | #2, #4 (ficha), #7, #10 (XP) |
| `js/pages/inicio.js`, `js/core/novedades.js` | retencion-seguir-viendo | #4, #10, #21 |
| `js/pages/configuracion.js`, `configuracion.html` | mejora-metricas | #6 |
| `js/catalog/states.js`, `js/core/missions.js`, `streak.js`, `reminders.js` | retencion-logros | #8, #12 |
| `js/pages/login.js`, `Login.html`, `usuario.html` | mejora-accesibilidad | #14, #19 |
| `js/pages/ranking.js`, `js/detalle/comments.js` | mejora-comunidad | #11 (cliente), #15 (cliente) |
| `js/core/push.js`, `notif-prefs.js`, `supabase/functions/` | retencion-notificaciones | #16 (cliente), #24 |
| `js/core/api.js`, `api-mangadex.js`, `mangadex-api.js`, `js/pages/volumenes.js`, `calendario.js` | mejora-catalogo | #18, #20 |
| `tests/e2e/*`, `tests/unit/*` | mejora-pruebas | #13 y los tests de cada tarea |
| `js/pages/mis-listas.js`, `js/catalog/search.js`, `tools/build.js` | mejora-arquitectura | #22, #25 (al final) |
| `js/core/i18n.js`, `i18n-en.js` | sesión principal (integra) | Claves con prefijo por agente |

## Riesgos de integración

- La 013 y la 014 no están aplicadas en Supabase [Probable]: todo lo social y el hardening del log dependen de #1. Sin la 013, el toggle "Perfil público" revierte y avisa.
- La 013 con `is_public` default false deja el muro vacío al principio; el ranking sigue mostrando a todos y enlaza a perfiles privados (#11).
- `inicio.js` y `progress.js` comparten `progressSyncQueue` (el +1 de la home y la ficha): #2, #10 y #22 tienen que respetar el mismo formato de cola.
- `mis-listas.js` creció a 1558 líneas: los rangos de corte de `mejora-arquitectura.md` ya no valen y hay que volver a mapear antes de #22 y #25.
- Las migraciones nuevas arrancan en 015, y de ahí en adelante la numeración la lleva un solo dueño (supabase).
- `notif-prefs` y recordatorios viven solo en el navegador: el push del servidor ignora pausa, límite y silencio hasta #24.
- `check-quality` ya valida `data-i18n`: cualquier HTML nuevo sin su clave rompe el check.

## Qué no hacer todavía

- No partir `mascot.js` ni `retos.js` hasta tener #13.
- No cambiar la firma de `get_activity_feed` (cursor `p_before`): la 013 ya acota el offset.
- No activar analítica de terceros (Umami) ni recomendaciones colaborativas en Supabase.
- No arreglar sesiones y minutos de `usuario.js:292-298` sin decidir antes si se miden (es dato nuevo y va declarado).

## Pendientes que dejaron los agentes

- `impl-comunidad`: aplicar la 013 en Supabase; `usuario.html` sin `data-i18n`; perfil público sin probar en navegador real → #1, #19.
- `impl-comunidad-2`: aplicar la 014 (pg_cron); `schema.sql` sin comment_likes, push, save_v3 ni permisos por columna; el ranking muestra perfiles privados → #1, #9, #11.
- `impl-eficiencia`: UI de `AppSyncMetrics` en configuración; declarar `ad:metrics:sync`; `drainProgressQueue` sin sesión (`progress.js:66`); `mis-listas.js` en 1558 líneas → #6, #3, #2, #22.
- `impl-experiencia`: dos toasts al primer episodio (`states.js`); el toast de misión gasta el límite diario; ancla `#epGrid`; reenvío de correo; `#detail-ver-mas` aparentemente sin uso → #8, #4, #14 (el último, revisar y borrar si no se usa).
- `impl-catalogo`: "No especificado" en `render.js:117,158,199,981`; `render-sections.js:71`; aviso "portada de la serie"; dedup de novelas → #7, #18.
- `impl-calendario`: recordatorios solo en este navegador; "faltan X de Y" requiere `episodes` (`api.js:897`) → #24, #20.
- `impl-notificaciones`: preferencias sin columna en `profiles`; el push del servidor no respeta pausa, límite ni silencio; categoría "comunidad" sin avisos → #24 (lo de comunidad queda para cuando el muro tenga uso).
- `impl-novedades`: carga estados y progreso dos veces; manga sin implementar → #21 (manga, sin fecha).
- `impl-seguir-viendo`: `loadItemStates` sin `meta.total`; el +1 de la home no da XP → #10.
- `impl-logros`: "Al Día" es aproximado (haría falta guardar `nextAiringEpisode-1`, `render.js:528`, `states.js:105`); día de gracia de la racha → #12 ("Al Día" exacto, sin fecha).
- `impl-recomendaciones`: el motivo por recomendaciones de AniList no se usa en Mis listas (1 request por obra); la exclusión en la ficha usa solo UserStore local → sin tarea por ahora (costo de API).
