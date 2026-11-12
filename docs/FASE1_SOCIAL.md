# Fase 1 — Capa social

Primer paso para convertir Mirudoku de una app de tracking a una comunidad.
Todo se apoya en tablas que **ya existían** (`comments`, `user_activity_log`,
`profiles`), sin romper nada del flujo actual.

## Qué entra en esta fase

| Pieza | Estado | Dónde |
|---|---|---|
| **Likes en comentarios** | ✅ Completo (base + cliente + UI) | `comments.js`, `supabase-client.js`, `009_social_phase1.sql` |
| **Muro de actividad** (backend) | ✅ Función + cliente listos | `get_activity_feed()`, `loadActivityFeed()` |
| **Perfil público** (backend) | ✅ Función + cliente listos | `get_public_profile()`, `getPublicProfile()` |
| Muro de actividad (página/UI) | ✅ Sección en `usuario.html`, paginada | `loadMuroPagina()` en `js/pages/usuario.js` |
| Perfil público (ruta `usuario.html?u=`) | ✅ | `initPerfilPublico()` en `js/pages/usuario.js` |
| Opt-in de visibilidad en la base | ✅ | `profiles.is_public`, `013_social_privacy_public_profile.sql` |

La UI visible que entra ahora es **el like en comentarios**. El feed y el
perfil público quedan con su capa de datos completa y probada; falta solo
pintarlos (una sección/página nueva), que es trabajo de front acotado.

## Cómo aplicarlo

### 1. Migración de base de datos

En **Supabase → SQL Editor**, ejecutar el contenido de:

```
server/migrations/009_social_phase1.sql
```

Crea:
- Tabla `comment_likes` (con RLS: leer todos, escribir/borrar lo propio).
- Columna `comments.likes_count` + trigger que la mantiene en O(1).
- Función `get_activity_feed(limit, offset)` — muro público.
- Función `get_public_profile(username)` — tarjeta pública de otro usuario.

Es **idempotente y aditiva**: se puede correr sobre la base actual sin tocar
datos existentes. Si todavía no se aplica, el front degrada elegante — los
corazones aparecen vacíos y `loadComments` reintenta sin `likes_count`.

### 2. Front

Ya está en el código. `npm run build` reestampa las versiones (`?v=`) y
regenera `css/detalle.min.css`. No hace falta nada más.

## API nueva (`window.AppSupabase`)

```js
await AppSupabase.likeComment(commentId);       // idempotente
await AppSupabase.unlikeComment(commentId);
await AppSupabase.loadMyCommentLikes([...ids]);  // Set de IDs likeados por mí
await AppSupabase.loadActivityFeed(30, 0);       // [{ username, action, titulo, img, ... }]
await AppSupabase.getPublicProfile("nombre");    // { username, level, apodo, total_likes, ... }
```

## Cómo se comporta el like

- Visible para todos; si no hay sesión, invita a loguearse.
- Corazón lleno (♥) si el usuario ya reaccionó, vacío (♡) si no.
- Actualización **optimista**: pinta al instante y sincroniza en segundo
  plano; si la base falla, revierte y avisa por toast.
- Un guard evita dobles envíos mientras el like está en vuelo.

## Privacidad (migración 013)

Aplicar **después de 009**, en Supabase → SQL Editor:

```
server/migrations/013_social_privacy_public_profile.sql
```

Qué hace (idempotente y aditiva):

- `profiles.is_public BOOLEAN NOT NULL DEFAULT false`. Default **conservador**:
  nadie aparece en el muro ni en `usuario.html?u=` hasta activarlo a mano.
- `GRANT UPDATE (is_public)` a `authenticated` (grant por columna, como 007/012;
  la fila la limita la policy `profiles: update own`).
- `get_activity_feed()` y `get_public_profile()` con la **misma firma** pero
  filtrando `p.is_public IS TRUE` en la base. Privado e inexistente devuelven
  lo mismo (0 filas): no se puede averiguar si un username existe.
- Offset del muro acotado a 1000 y límite a 100 (anti-volcado), índice parcial
  `idx_activity_feed_recent` para el `ORDER BY created_at DESC`.

**Sin 013:** el muro y los perfiles quedan expuestos como en 009, y el switch
de Configuración no se puede guardar (revierte y avisa).

### Cómo se persiste `prefPublic`

- `configuracion.html` → Privacidad → «Perfil público» (`#prefPublic`).
- `js/pages/configuracion.js` (`wirePublicToggle`): con sesión lee
  `AppSupabase.getProfileVisibility()` y escribe con
  `AppSupabase.setProfileVisibility(bool)` → `UPDATE profiles SET is_public`.
  La base es la fuente de verdad; `localStorage['pref:privacidad']`
  (`publica`/`privada`, default ahora `privada`) es solo cache.
- Sin sesión no se puede activar (no hay perfil que publicar).

### Qué expone cada cosa

| Fuente | Campos que llegan a la UI |
|---|---|
| `getPublicProfile()` | `username, display_name, photo_url, level, apodo, total_likes, total_viewed` (lista blanca en el cliente; la RPC también trae `id, exp, created_at`, que se descartan) |
| `loadActivityFeed()` | `username, display_name, photo_url, action, category, item_id, titulo, img, created_at` (se descarta `actor_id`) |

Nunca email ni provider. Además `armarPerfilPublico()` / `armarItemMuro()` en
`usuario.js` filtran URLs de imagen (solo `https:` o `data:image/`) y pintan
todo con `textContent`. Tests: `tests/unit/usuario-publico.test.js`.

### UI

- `usuario.html?u=<username>`: tarjeta pública (nombre, @usuario, apodo, nivel,
  favoritos, vistos) o estado vacío «Este perfil no está disponible». Funciona
  sin sesión (carga el SDK bajo demanda con `__loadSupabase`).
- Muro «Muro de la comunidad» al pie de `usuario.html` (con y sin sesión): pide
  21 filas para mostrar 20 y saber si hay más; botón «Cargar más». Se carga
  recién cuando la sección entra en pantalla.

## Migración 014 — log de actividad y topes

Aplicar después de 013, en Supabase → SQL Editor (requiere la extensión
`pg_cron`, igual que 010):

```
server/migrations/014_activity_log_hardening.sql
```

- **Sin INSERT directo en `user_activity_log`**: se borra la policy
  `activity: insert own` y se revoca `INSERT` a `anon`/`authenticated`. Antes
  cualquier usuario podía fabricar un `liked` que salía en el muro. El log lo
  siguen escribiendo los triggers `log_item_state_change()` y
  `log_progress_activity()` (SECURITY DEFINER). El cliente no inserta directo
  (no hay referencias a `user_activity_log` en `js/` ni `api/`). Es el único
  cambio no aditivo: quita un permiso.
- **Limpieza programada**: job pg_cron `activity-cleanup` (diario 04:30 UTC) que
  corre `cleanup_old_activity()` (borra lo de más de 90 días).
- **`get_profiles_by_ids`**: usa como máximo los primeros 200 ids (misma firma).
- No existe una migración 011: el orden es 001…010, 012, 013, 014.
  `server/schema.sql` quedó sincronizado con 013/014, pero si difiere de una
  migración, manda la migración.

## Enlaces al perfil público

- Ranking (`js/pages/ranking.js`, `nickHtml`): el nombre de cada jugador enlaza
  a `usuario.html?u=<username>`.
- Comentarios (`js/detalle/comments.js`, `renderComment`): el autor enlaza al
  mismo destino.
- Sin `username` (perfil no cargado) queda el texto sin enlace, como antes. El
  ranking y los comentarios no conocen `is_public`: si el perfil es privado, el
  enlace abre el estado vacío «Este perfil no está disponible».
