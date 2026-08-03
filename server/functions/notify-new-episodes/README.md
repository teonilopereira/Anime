# Notificaciones push de nuevos episodios

Avisa a cada usuario cuando un anime que sigue ("Viendo") estrena un episodio.

- **Cliente** (ya en el repo): `js/core/push.js` pide permiso, suscribe al
  navegador y guarda la suscripción en la tabla `push_subscriptions`. El toggle
  "Notificaciones" de `configuracion.html` la enciende/apaga. El service worker
  (`sw.js`) muestra la notificación al recibir el push.
- **Servidor** (esta carpeta): la edge function `notify-new-episodes` corre en
  un cron, mira el calendario de AniList y manda los push.

Mientras no completes los pasos de abajo, la función queda **inerte**: el toggle
avisa "todavía no están configuradas" y la app funciona igual.

## Activación (una vez)

### 1. Generar el par de claves VAPID

```bash
npx web-push generate-vapid-keys
```

Guardá la **pública** y la **privada**.

### 2. Clave pública en el cliente

En tu `.env` (no se sube a Git) agregá:

```
VITE_VAPID_PUBLIC_KEY="<clave pública>"
```

y regenerá la config + build:

```bash
node tools/generate-config.js
npm run build
```

Esto vuelca la clave a `js/core/config.js` (`vapidPublicKey`). Sin este paso el
cliente no puede suscribirse.

### 3. Tabla de suscripciones

Ejecutá `server/migrations/008_push_subscriptions.sql` en el **SQL Editor** de
Supabase.

### 4. Secrets de la edge function

```bash
supabase secrets set VAPID_PUBLIC_KEY="<clave pública>"
supabase secrets set VAPID_PRIVATE_KEY="<clave privada>"
supabase secrets set VAPID_SUBJECT="mailto:tu-correo@dominio.com"
```

`SUPABASE_URL` y `SUPABASE_SERVICE_ROLE_KEY` ya vienen inyectados en el runtime.

### 5. Desplegar la función

```bash
supabase functions deploy notify-new-episodes
```

### 6. Programar el cron

En el SQL Editor (extensiones `pg_cron` + `pg_net`), corriendo cada 15 min:

```sql
select cron.schedule(
  'notify-new-episodes',
  '*/15 * * * *',
  $$
  select net.http_post(
    url := 'https://<PROJECT_REF>.functions.supabase.co/notify-new-episodes',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || '<SUPABASE_ANON_KEY o SERVICE_ROLE_KEY>'
    )
  );
  $$
);
```

Ajustá `VENTANA_MIN` en `index.ts` para que cubra el intervalo del cron (con
`*/15` dejá 20).

## Notas / cosas a revisar

- **Columnas de `item_states`**: la función filtra por `category = 'anime'` y
  `watch_status = 'viendo'`. Verificá esos nombres contra tu esquema y ajustá si
  hace falta.
- **Costo**: cada corrida hace 1+ request a AniList y N envíos. Con `*/15` son
  ~96 corridas/día, dentro del tier gratuito de Supabase para tráfico chico.
- **Privacidad**: solo se guarda endpoint + claves de push por usuario; se borran
  solas cuando el navegador las invalida (404/410) o el usuario apaga el toggle.
