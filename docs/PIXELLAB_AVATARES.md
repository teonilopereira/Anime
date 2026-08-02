# Avatares en pixel art con PixelLab

Genera el avatar del usuario con la API de **PixelLab.ai**, lo guarda en
Supabase Storage y lo deja como `profiles.photo_url`. Toda la lógica que toca
la API key vive en una **Edge Function** — la key nunca llega al navegador.

## Piezas

| Archivo | Qué hace |
|---|---|
| `supabase/functions/generate-avatar/index.ts` | Edge Function: verifica sesión → llama a PixelLab → guarda en Storage → actualiza el perfil. Cachea por hash del prompt. |
| `server/migrations/008_avatars_storage.sql` | Crea el bucket `avatars` (lectura pública, escritura restringida a la carpeta del usuario). |
| `api/supabase-client.js` → `generateAvatar()` | Método cliente que invoca la función. |
| `configuracion.html` / `js/pages/configuracion.js` | UI: caja de texto + botón "GENERAR" en la página de configuración. |

## Flujo

```
Configuración → "GENERAR"
   → AppSupabase.generateAvatar(prompt)
      → supabase.functions.invoke("generate-avatar")   (manda el JWT del usuario)
         → Edge Function
            1. verifica el usuario con el JWT
            2. POST https://api.pixellab.ai/v1/generate-image-pixflux  (Bearer PIXELLAB_API_KEY)
            3. sube el PNG a storage: avatars/<user_id>/<hash>.png
            4. profiles.photo_url = URL pública
         → { url, cached, usd }
   → se pinta el nuevo avatar
```

El nombre del archivo es un hash del prompt+tamaño: pedir **el mismo** avatar
dos veces devuelve el cacheado y **no** vuelve a facturar créditos de PixelLab.

## Despliegue (una sola vez)

1. **Aplicar la migración de Storage** (en el SQL Editor de Supabase o con la CLI):

   ```bash
   supabase db execute -f server/migrations/008_avatars_storage.sql
   ```

2. **Cargar el secreto** con tu token de PixelLab:

   ```bash
   supabase secrets set PIXELLAB_API_KEY=tu-token-de-pixellab
   ```

   > `SUPABASE_URL`, `SUPABASE_ANON_KEY` y `SUPABASE_SERVICE_ROLE_KEY` ya los
   > provee la plataforma; no hay que setearlos.

3. **Desplegar la función**:

   ```bash
   supabase functions deploy generate-avatar
   ```

No hace falta tocar el CSP: la función se sirve desde el mismo host de Supabase
(`llytokoztnjuczuppzgs.supabase.co`) que ya está permitido en `connect-src`, y
las imágenes de Storage entran por `img-src https:`.

## Seguridad

- La API key de PixelLab **solo** existe como secreto de la Edge Function.
- La función exige sesión válida (JWT) antes de generar nada.
- Storage: lectura pública de imágenes; escritura restringida a la carpeta
  propia de cada usuario (`avatars/<user_id>/…`).

## Parámetros de `generateAvatar(description, opts)`

| opción | default | nota |
|---|---|---|
| `description` | — | 3–400 caracteres. Requerido. |
| `opts.width` / `opts.height` | 128 | Se clampa a 32–200 (límite de PixelLab). |
| `opts.noBackground` | `true` | Fondo transparente. |
| `opts.force` | `false` | Saltea el cache y regenera (vuelve a facturar). |
