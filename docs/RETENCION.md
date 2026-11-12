# Retención en Mirudoku

Plan 2 · coordinador: `retencion-coordinador` · mapa de agentes en `docs/AGENTES.md`.
Fuentes: informes de `retencion-analisis-uso`, `retencion-usuarios`, `mejora-recorrido`,
`mejora-metricas`, `mejora-recomendaciones`, `mejora-privacidad` y `mejora-supabase`,
más verificación puntual en el código. Las horas son estimaciones [Suposición]; los
umbrales de segmento también.

## Principios

- **Continuidad antes que frecuencia.** El objetivo es que quien vuelve encuentre su
  siguiente episodio/capítulo y lo marque, no que abra la app más veces.
- **La gamificación acompaña, no obliga.** Rachas (`js/core/streak.js`), misiones
  (`js/core/missions.js`) y retos (`retos.*`) suman reconocimiento; ningún flujo de
  progreso depende de ellas ni castiga por cortar una racha.
- **Conectar antes que inventar.** Antes de una mecánica nueva se arregla la que ya
  existe (hoy, marcar episodios no alimenta el bloque de la home: ver #2).

## Segmentos

"Señal" = el máximo entre `user_activity_log.created_at` (`server/schema.sql:260-267`),
`item_states.updated_at` (`:174`) y `progress_keys.updated_at` (`:222`). Hoy no existe
"última visita" en servidor: quien entra y solo mira no deja señal [Seguro]
(`profiles.updated_at` solo cambia al editar el perfil, `:73-79`).

| Segmento | Criterio verificable (SQL) | Necesidad | Qué la atiende |
|---|---|---|---|
| Nueva | `profiles.created_at` < 7 días y < 3 filas en `item_states` | Sembrar la lista, descubrir | #homeJoin, reco (vacía con 0 obras), #13 |
| Activa | Señal en los últimos 7 días | Retomar en un toque, novedades de lo que sigue | #2, #15, #16, #17 |
| Dejó de volver | Sin señal en 30 días y ≥ 1 fila en `item_states` o `progress_keys` | Retomar sin culpa, saber qué salió | #15 (orden por `updated_at`), #10 |

Mientras no exista #11 (`last_seen_date`), "dejó de volver" incluye a quien entra sin
marcar nada: el segmento sobreestima el abandono [Seguro, por construcción].

## Iniciativas

Orden por impacto (1-5) ÷ esfuerzo (h). "En curso (esta sesión)" = se está
implementando ahora; queda en la tabla para medirla y para que no se duplique.

| # | Etapa | Iniciativa | Impacto | Esfuerzo (h) | Agente | Archivos | Métrica | Aceptación |
|---|---|---|---|---|---|---|---|---|
| 1 | 1 Retomar | `loadAllProgress` pide `updated_at` (hoy no: `api/supabase-client.js:435-445`). `inicio.js:546-547` ya lo consume si llega. | 4 | 0,5 | `mejora-comunidad` | `api/supabase-client.js` | Orden de "Seguí donde lo dejaste" por última marca real | El select incluye `updated_at`; si falla, devuelve `[]` como hoy; ningún consumidor rompe con el campo extra |
| 2 | 1 Retomar | Marcar el primer episodio/tomo sin estado crea "viendo" (`window.setWatchStatus`, mismo objeto que `js/detalle/render.js:528`). Hoy el handler (`js/detalle/render.js:1064-1080`) solo llama `saveProgressToSupabase`. | 5 | 1 | `mejora-experiencia` | `js/detalle/render.js` | % de cuentas con `progress_updated` en 7 días que tienen fila "viendo" | Marcar ep. 1 de una obra sin estado → aparece en la home; si ya tenía estado (pendiente, visto, pausado) no se pisa; desmarcar no borra el estado |
| 3 | 1 Retomar | Guard de invitado en episodios/tomos: `window.pedirLogin()` y no encolar en `progressSyncQueue` sin sesión (hoy encola y lo manda a la próxima cuenta que entre, `js/detalle/progress.js:110-137`) | 4 | 1 | `mejora-experiencia` | `js/detalle/render.js`, `js/detalle/progress.js` | Errores de sync de progreso (local) | Sin sesión: se pide login y vuelve a la ficha; no queda nada en la cola |
| 4 | 1 Retomar | Quitar fav/visto no borra "viendo": pasar `watchStatus` en `saveDetailStateToSupabase` (`js/detalle/data.js:160-187`; `save_item_state_v2` hace DELETE si `!fav && !viewed`, `server/schema.sql:523-524`) | 4 | 1 | `mejora-experiencia` | `js/detalle/data.js` | Filas "viendo" que desaparecen sin acción del usuario (0 esperado) | Quitar favorito de una obra "viendo" la deja en la home tras recargar |
| 5 | 5 Aprender | Programar `cleanup_old_activity()` (`server/schema.sql:721`) con pg_cron; hoy es manual | 2 | 0,5 | `mejora-comunidad` | `server/migrations/014_*.sql` | Antigüedad máxima del log ≤ 90 días | Migración idempotente; el plazo coincide con lo que dice `privacidad.html` |
| 6 | 5 Aprender | Actualizar `privacidad.html`: log de acciones ≤ 90 días, claves locales (rachas, misiones, `pref:notif:*`, cola), y lo que agreguen #11 y #20 **antes** de recolectarlo | 3 | 1 | `mejora-comunidad` | `privacidad.html`, `js/core/i18n.js`, `js/core/i18n-en.js` | — (prerrequisito de #11, #12, #21) | Cada dato nuevo figura con qué es, plazo y cómo borrarlo |
| 7 | 2 Novedades | Confirmar en Supabase que 010 está aplicada y que hay claves VAPID (sin ellas push es inerte, `js/core/push.js:9-11`); recién ahí ofrecer push, siempre detrás de `AppNotifPrefs` | 3 | 1 | `retencion-notificaciones` + dueño | `js/core/push.js`, consola Supabase | Suscripciones activas (`push_subscriptions`) por segmento | Sin VAPID el toggle no aparece; con VAPID respeta categoría, pausa y límite diario |
| 8 | 1 Retomar | Home: si falla `loadItemStates`/`loadAllProgress`, mostrar lo local y un aviso en vez de cortar en silencio (`js/pages/inicio.js:524-529`) [Probable: revisar tras #15] | 3 | 1 | `retencion-seguir-viendo` | `js/pages/inicio.js` | — | Supabase caído → la home muestra lo que hay en `UserStore` y no borra nada |
| 9 | 5 Aprender | Estadísticas de sesiones/minutos de `usuario.js:292-298`: hoy se reinician en cada carga y `totalMinutes` nunca se escribe. Retirar las tarjetas o rotularlas "en este dispositivo" con dato real | 2 | 1 | `mejora-comunidad` | `js/pages/usuario.js`, `usuario.html` | — | No se muestra ningún número que no se calcule de verdad |
| 10 | 1 Retomar | Bienvenida para quien vuelve tras ≥ 14 días: "Seguías *X*, te toca el ep. N+1", sin mencionar racha perdida | 4 | 3 | `retencion-seguir-viendo` | `js/pages/inicio.js`, `index.html`, `css/inicio.css` | % que actualiza progreso tras volver (segmento "dejó de volver") | Depende de #1 y #15; aparece una vez por vuelta; se cierra y no reaparece ese día |
| 11 | 5 Aprender | `profiles.last_seen_date DATE` (sin hora, se pisa, sin historial), escrito una vez por día desde el chequeo de `lastDailyLogin` (`js/core/auth.js:207-262`) | 3 | 2 | `mejora-comunidad` | `server/migrations/014_*.sql`, `api/supabase-client.js` | Base de retorno 7/30 días que incluye a quien solo mira | Depende de #6; GRANT por columna como 007/012; si la columna falta, el cliente sigue sin error |
| 12 | 5 Aprender | Función SQL de cohortes que devuelve **solo conteos** (ver Medición), ejecutable por el dueño o service role, no por `anon`/`authenticated` | 3 | 3 | `mejora-comunidad` | `server/migrations/014_*.sql` | Retorno 7/30 días, % progreso tras volver | Depende de #5 y #6; ninguna fila con `user_id` sale de la función |
| 13 | 3 Descubrir | Arranque para cuentas nuevas: fila "Popular en <categoría>" / "En emisión" (criterios H/G de `mejora-recomendaciones`) + invitación a marcar 3 obras. `recommend.js` descarta candidatos sin relación, así que esto va aparte y **sin** decir "para vos" | 4 | 4 | `retencion-recomendaciones` + `retencion-seguir-viendo` | `js/core/recommend.js`, `js/pages/inicio.js`, `index.html` | % de cuentas nuevas con ≥ 3 `item_states` a 7 días | Con 0 obras no queda vacío; AniList caído → se oculta la fila sin romper la home |
| 14 | 1 Retomar | Helper único de progreso (hoy tres parsers de claves en `js/pages/mis-listas.js` + el de `inicio.js`) y bug de `lastChapter` (`mis-listas.js:839-840`, regex sin `ch:`) [Verificar qué cubrió #15] | 3 | 4 | `retencion-seguir-viendo` + `mejora-experiencia` | `js/pages/mis-listas.js`, `js/pages/inicio.js` | — | Home y Mis listas muestran el mismo "siguiente" para la misma obra |
| 15 | 1 Retomar | "Seguí donde lo dejaste" con siguiente paso concreto, +1 rápido y filtro "en curso" — **En curso (esta sesión)** | 5 | 6 | `retencion-seguir-viendo` | `js/pages/inicio.js`, `index.html`, `css/inicio.css`, `js/pages/mis-listas.js` | % que actualiza progreso tras volver; uso del +1 | +1 en un toque con y sin hover (móvil); sin sesión no aparece; con fallo de red no descuenta |
| 16 | 2 Novedades | Calendario "Solo lo que sigo" + recordatorio opt-in por título — **En curso (esta sesión)** | 4 | 5 | `retencion-calendario` | `js/pages/calendario.js`, `calendario.html`, `css/calendario.css`, `js/core/reminders.js` | Títulos con recordatorio activo; retorno 7d de quien activó ≥ 1 | Apagado por defecto; se activa por título; pasa por `AppNotifPrefs` |
| 17 | 2 Novedades | `js/core/novedades.js` "Novedades para vos" en `#homeNovedades` — **En curso (esta sesión)** | 4 | 5 | `retencion-novedades` | `js/core/novedades.js`, `index.html` | Clics en novedades / sesiones con novedades visibles | Solo títulos seguidos o que encajan con sus géneros; sin nada relevante, la sección queda `hidden` |
| 18 | 4 Progreso | `js/core/notif-prefs.js`: categorías, pausa 1/7 días, silencio nocturno, límite diario — **En curso (esta sesión)** | 3 | 4 | `retencion-notificaciones` | `js/core/notif-prefs.js`, `configuracion.html`, `js/pages/configuracion.js`, `js/core/reminders.js` | % que pausa o apaga categorías (señal de molestia) | Todo aviso pasa por `AppNotifPrefs`; pausar corta todos los canales |
| 19 | 4 Progreso | Logros por progreso real (episodios, capítulos, obras terminadas) — **En curso (esta sesión)** | 3 | 4 | `retencion-logros` | `js/pages/mis-listas-logros.js`, `js/core/missions.js` | Logros obtenidos por segmento | Se calculan desde `progress_keys`/`item_states`, no desde clics; nada se pierde por inactividad |
| 20 | 5 Aprender | Contadores diarios **sin identidad** para reco, novedades, recordatorios, calendario y retos (ver Medición) | 3 | 4 | `mejora-comunidad` (tabla/RPC) + dueños de cada archivo (llamada) | `server/migrations/014_*.sql`, `js/core/recommend.js`, `js/core/novedades.js`, `js/core/reminders.js`, `js/pages/retos.js` | Uso de recordatorios/recomendaciones/retos por segmento | Depende de #6; lista cerrada de eventos; si la RPC falla, la acción del usuario sigue igual |
| 21 | 2 Novedades | Sincronizar `pref:notif:*` entre dispositivos (`profiles.preferences JSONB`, `mejora-supabase` cambio 1) | 2 | 3 | `mejora-comunidad` + `retencion-notificaciones` | `server/migrations/`, `api/supabase-client.js`, `js/core/notif-prefs.js` | Discrepancias de prefs entre dispositivos | Sin sesión sigue local; con columna ausente, cae a local |
| 22 | 4 Progreso | Racha calculada desde señal del servidor (hoy solo `localStorage`, `js/core/streak.js:13-17`, se rompe al cambiar de dispositivo) | 2 | 3 | `retencion-logros` | `js/core/streak.js` | — | Depende de #11; nunca baja una racha por un fallo de red |
| 23 | 3 Descubrir | Motivo visible por tarjeta en `js/core/recommend.js` (adiós "Porque viste <primer título>" engañoso de `inicio.js`) — **En curso (esta sesión)** | 3 | 5 | `retencion-recomendaciones` | `js/core/recommend.js`, `js/pages/mis-listas.js` (`renderRecommendations`), `js/detalle/render-sections.js` | Clics en reco / reco mostradas, por tipo de motivo | Cada tarjeta dice por qué; respeta `pref:nsfw`; sin señal no se muestra |

Dependencias críticas: #1 → #10 · #2 es lo que hace útil #15 para quien solo marca
episodios · #6 → #11, #12, #20 · #5 → #12 · #11 → #22.

## Medición

**Antes de cualquier despliegue de lo "En curso"**: el dueño corre las consultas de
abajo una vez y guarda solo los números (línea de base). El log se poda a 500 filas
por usuario y, con #5, a 90 días: si se espera, la base se pierde.

### Qué existe hoy

| Pregunta | Señal existente | Alcance | Hueco |
|---|---|---|---|
| Retorno 7/30 días | `user_activity_log.created_at` (triggers, `server/schema.sql:630-710`; índice `(user_id, created_at)`) | servidor | Solo registra escrituras; RLS "read own": la cohorte solo sale desde SQL Editor o función DEFINER (#12) |
| Progreso tras volver | `action = 'progress_updated'` (`server/schema.sql:705`) | servidor | No guarda qué capítulo; vuelta "solo mirando" invisible hasta #11 |
| Abandono | máximo de las tres señales | servidor | Poda 500 filas/90 días confunde "abandonó" con "nunca activó" |
| Recordatorios | `ad:remind:*` (dedupe, `js/core/reminders.js:60-110`) | local | Solo "se mostró"; no viaja |
| Push | `push_subscriptions`, `push_sent` (7 días) | servidor | Sin historial; 010 sin confirmar |
| Recomendaciones / novedades | nada | — | Sin impresión ni clic (#20) |
| Retos / misiones / rachas | `ad:quiz:*`, `ad:mis:*`, `ad:streak:*` | local | No viajan; sirven para UX, no para medir |
| Analítica del sitio | Umami previsto, `ANALYTICS.id` vacío (`build.js:50-70`) | inactivo | Decisión del dueño |

### Definiciones y consultas

Las consultas corren en el SQL Editor (rol dueño), devuelven conteos y no se exportan
filas por usuario. Zona horaria `America/Argentina/Buenos_Aires` [Suposición].

**Retorno a 7 y 30 días.** De quienes tuvieron señal el día D, % con señal en D+1..D+7
y en D+1..D+30.

```sql
with dias as (
  select distinct user_id, (created_at at time zone 'America/Argentina/Buenos_Aires')::date d
  from public.user_activity_log
)
select a.d,
       count(distinct a.user_id) as activas,
       count(distinct b.user_id) filter (where b.d <= a.d + 7)  as volvieron_7d,
       count(distinct b.user_id) filter (where b.d <= a.d + 30) as volvieron_30d
from dias a
left join dias b on b.user_id = a.user_id and b.d > a.d and b.d <= a.d + 30
where a.d between current_date - 60 and current_date - 30
group by a.d order by a.d;
```

Sesgo: subestima (solo escrituras) y la poda de 500 filas recorta el pasado de las
más activas. Con #11 se suma `last_seen_date`, pero como no tiene historial sirve para
"volvió desde D", no para cohortes completas; si hace falta la serie, `mejora-metricas`
propone una tabla `daily_active(day, active_users, new_users, returning_7d,
returning_30d)` llenada por pg_cron, solo con totales.

**% que actualiza progreso tras volver.** Vuelta = primer día con señal tras ≥ 14 días
sin señal. Éxito = `progress_updated` ese día o los 2 siguientes.

```sql
with dias as (select distinct user_id, created_at::date d from public.user_activity_log),
g as (select user_id, d, d - lag(d) over (partition by user_id order by d) as gap from dias),
vueltas as (select user_id, d from g where gap >= 14)
select count(*) as vueltas,
       count(*) filter (where exists (
         select 1 from public.user_activity_log l
         where l.user_id = v.user_id and l.action = 'progress_updated'
           and l.created_at::date between v.d and v.d + 2)) as con_progreso
from vueltas v;
```

**Por segmento.** Se agrega `join public.profiles p using (user_id)` y se clasifica con
los criterios de la tabla de segmentos; la salida es `segmento, conteo`.

**Uso de recordatorios, recomendaciones y retos (#20).** Tabla
`client_event_counts(day date, event text, segment text, n int, primary key (day, event, segment))`
y RPC `increment_counter(event, segment)` SECURITY DEFINER con lista cerrada:
`reco_shown`, `reco_click`, `novedades_click`, `reminder_on`, `reminder_off`,
`calendar_follow_on`, `quick_plus_one`, `quiz_play`, `mission_done`, `notif_pause`.
El cliente manda como mucho uno por evento por día (dedupe local) y un segmento grueso
(`nueva`/`activa`/`vuelve`/`invitado`). Ruido por abuso de `anon`: posible y aceptado
porque no hay identidad que exponer; si molesta, restringir a `authenticated`.

**Push:** suscripciones activas por segmento (`push_subscriptions`). **Las aperturas de
notificación nunca son el indicador de éxito**: si algún día se cuentan, van siempre
junto a retorno y progreso marcado. La pregunta es si quien recibe el aviso marca
progreso. Hoy ni siquiera se cuentan.

### Qué se guarda, cuánto tiempo y privacidad

| Dato | Dónde | Plazo | Identidad |
|---|---|---|---|
| Log de acciones (ya existe) | `user_activity_log` | ≤ 90 días (#5) y ≤ 500 filas | propia, RLS read own |
| `last_seen_date` (#11) | `profiles` | se pisa cada día; se borra con la cuenta | propia; sin hora |
| Contadores (#20) | `client_event_counts` | 13 meses, luego se borran | ninguna: sin `user_id`, sin IP, sin título |
| Prefs de avisos | `localStorage` (`pref:notif:*`) | hasta que la persona las borre | local |

Reglas: nada se instrumenta hasta que #6 esté publicado; no se registran títulos,
búsquedas ni horarios; ningún tercero (Umami u otro) se activa sin decisión explícita
del dueño; un interruptor en Configuración permite apagar los contadores (valor por
defecto: decisión del dueño, documentada en `privacidad.html`).

## Criterios de aceptación transversales

- **Optativo:** recordatorios, push y novedades por canal externo arrancan apagados;
  se activan por título o por categoría, nunca en bloque al registrarse.
- **Configurable:** todo aviso pasa por `AppNotifPrefs` (categoría, pausa 1/7 días,
  silencio nocturno, límite diario); apagar una categoría corta todos los canales.
- **Relevante:** solo títulos seguidos (fav, visto, viendo, pendiente; nunca
  abandonado) o recomendaciones con motivo visible; sin nada relevante, la sección se
  oculta en lugar de rellenarse con populares disfrazados de "para vos".
- **Con y sin sesión:** sin sesión, nada lanza error ni encola datos para otra cuenta;
  se invita a entrar con `pedirLogin()` y se vuelve al mismo lugar.
- **Móvil y escritorio:** acciones rápidas (+1, recordatorio) usables con toque, sin
  depender de hover; objetivos táctiles ≥ 44 px; tokens de `css/base.css`.
- **Fallos externos:** si cae AniList, MangaDex o Supabase, la sección afectada se
  oculta o muestra aviso, la página sigue, y **nunca se borra ni se pisa progreso**
  local o remoto por una respuesta vacía o con error.
- **Sin culpa:** ningún texto menciona rachas perdidas ni días sin entrar.
- **i18n:** textos nuevos con clave en `js/core/i18n.js` y `js/core/i18n-en.js`.

## Etapa 5: aprender y ajustar

**Semana 0 (antes de desplegar):** línea de base de retorno 7d/30d y % progreso tras
volver, total y por segmento; anotar fecha de despliegue de #2, #15-#19, #23.

**Semana 4:**
- Retorno 7d por segmento contra la base. Mirar sobre todo "activa" (lo que más tocan
  #2 y #15).
- Fila "viendo" en cuentas con progreso (#2): debería acercarse al 100 %.
- `quick_plus_one`, `reco_click / reco_shown`, `novedades_click`, `reminder_on` vs
  `reminder_off` (si #20 ya está).
- `notif_pause` y categorías apagadas: si suben, bajar el límite diario por defecto.

**Semana 8:**
- Retorno 30d y % que actualiza progreso tras volver (segmento "dejó de volver", #10).
- Cuentas nuevas con ≥ 3 obras a 7 días (#13).
- Uso de retos/misiones: si es marginal, se dejan como están (pasivos), sin empujarlos.

**Qué se retira o simplifica si no aporta:**
- Novedades (#17) o filas de reco (#23) con clics ínfimos frente a lo mostrado y sin
  diferencia de retorno: se reduce a una sola fila o se mueve al calendario.
- Recordatorios con más `reminder_off` que `reminder_on`: se revisa el texto y la
  frecuencia antes de sumar canales; push (#7) no se amplía.
- Tarjetas de estadísticas sin dato real (#9): fuera.
- Cualquier contador que nadie consultó en 8 semanas: se borra la llamada y el evento.

Con la cantidad de usuarias actual [Suposición: pocas decenas activas], si una cohorte
tiene menos de 30 personas no se sacan conclusiones: se mira la dirección y se decide
con el criterio del dueño, sin inventar significancia.
