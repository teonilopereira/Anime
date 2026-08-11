# Fase 1 — Capa social

Primer paso para convertir Anime Destiny de una app de tracking a una comunidad.
Todo se apoya en tablas que **ya existían** (`comments`, `user_activity_log`,
`profiles`), sin romper nada del flujo actual.

## Qué entra en esta fase

| Pieza | Estado | Dónde |
|---|---|---|
| **Likes en comentarios** | ✅ Completo (base + cliente + UI) | `comments.js`, `supabase-client.js`, `009_social_phase1.sql` |
| **Muro de actividad** (backend) | ✅ Función + cliente listos | `get_activity_feed()`, `loadActivityFeed()` |
| **Perfil público** (backend) | ✅ Función + cliente listos | `get_public_profile()`, `getPublicProfile()` |
| Muro de actividad (página/UI) | ⏳ Siguiente paso | — |
| Perfil público (ruta `usuario.html?u=`) | ⏳ Siguiente paso | — |

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

## Notas de privacidad

El muro de actividad expone acciones públicas (`liked` / `viewed`) con el
nombre y la obra — nunca email ni provider, igual que el ranking que ya era
público. Cuando se sume la UI del feed conviene ofrecer un opt-out en
`configuracion.html` antes de darle mucha visibilidad.
