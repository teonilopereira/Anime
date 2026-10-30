# Setup de Supabase

Todo el SQL vive en `server/`. No hay otro lugar: las guías viejas que hablaban
de `sql/migrations/…` o de `js/core/user-stats.js` describían archivos que ya
no existen.

## Proyecto nuevo

1. En Supabase, abrí **SQL Editor** → **New query**.
2. Pegá y ejecutá `server/schema.sql`.
   > ⚠️ **Es destructivo**: empieza con `DROP TABLE … CASCADE` de `profiles`,
   > `item_states`, `progress_keys` y el resto. Correrlo en un proyecto con
   > usuarios **borra todos sus datos**. Solo para un proyecto vacío.
3. Ejecutá las migraciones de `server/migrations/` **en orden numérico**
   (`001_…`, `002_…`, …, `013_…`; no hay `011`). `schema.sql` no tiene todo:
   comentarios, suscripciones push, `save_item_state_v3` y los arreglos de
   seguridad de 007, 012 y 013 llegan con las migraciones.

## Proyecto existente

No vuelvas a correr `schema.sql`. Aplicá solo las migraciones que falten,
en orden.

## Cliente

- La URL y la anon key van en `js/core/config.js` (`supabaseUrl`, …). Ese
  archivo está en Git a propósito: la anon key es pública (ver `.gitignore`).
- `api/supabase-config.js` carga el SDK solo cuando hace falta.
- `api/supabase-client.js` tiene las llamadas (perfil, estados de los ítems,
  EXP, ranking).

## Push y cron

La función `notify-new-episodes` tiene su propia guía en
`server/functions/notify-new-episodes/README.md`.

## Más contexto

- [Mapa de archivos](MAPEO_ARCHIVOS.md): qué hace cada archivo de `server/`.
- [Estadísticas](README_ESTADISTICAS.md).
