# Mirudoku

App web para seguir anime, manga y novelas ligeras: catálogo, fichas de detalle,
listas personales, ranking de usuarios, retos diarios y notificaciones de nuevos
episodios. Los datos vienen de AniList y MangaDex; las cuentas y el progreso, de
Supabase.

- Sitio: GitHub Pages (`teonilopereira.github.io/Anime`) y Netlify
  (`mirudoku.netlify.app`).
- Es un sitio **estático**: no hay build en el servidor. Lo que se publica es
  exactamente lo que está en `main`.

## Trabajar en local

```bash
npm install
node tools/serve.cjs      # servidor estático local
npm test                  # tests (Vitest)
npm run test:e2e          # humo en navegador (Playwright): cada página carga sin errores ni violaciones del CSP
npm run check             # mojibake en HTML y sintaxis del JS
npm run build             # regenera bundles y estampa versiones
```

**Después de tocar cualquier HTML, CSS o JS, corré `npm run build` y commiteá
lo que genera** (`css/*.min.css`, `js/core-bundle.min.js`, `js/vendor/`, las
versiones estampadas en los HTML y `sw.js`). El CI (`verificar`) falla si los
generados no coinciden con las fuentes.

## Estructura

| Carpeta | Qué hay |
|---|---|
| raíz (`*.html`) | Una página por sección. Quedan en la raíz a propósito: GitHub Pages las sirve por ruta. |
| `css/` | Fuentes de estilos + bundles generados. |
| `js/` | `core/` (infraestructura, va al bundle), `catalog/`, `detalle/`, `pages/` (una por página), `ui/`, `security/`, `vendor/` (generado). |
| `api/` | Cliente de Supabase. |
| `server/` | Schema, migraciones y edge function de Supabase. |
| `netlify/` | Funciones de Netlify (proxy de MangaDex). |
| `tools/` | Build, servidor local y scripts de mantenimiento. |
| `tests/` | Tests unitarios. |
| `docs/` | Documentación: [mapa de archivos](docs/MAPEO_ARCHIVOS.md), [Supabase](docs/SETUP_SUPABASE.md), [estadísticas](docs/README_ESTADISTICAS.md). |
| `viz/` | Visualizaciones internas del código (no son parte de la app). |

## Configuración

El CSP se define una sola vez, en `netlify.toml` (y `vercel.json` debe coincidir).
`npm run build` lo copia como `<meta>` en cada HTML para que también rija en
GitHub Pages, que no manda cabeceras; ese `<meta>` no se edita a mano.

`js/core/config.js` se versiona a propósito: solo tiene la URL y la clave
anónima de Supabase y la clave VAPID pública. Los permisos reales los controla
RLS en la base. Para regenerarlo desde un `.env`: `node tools/generate-config.cjs`.
