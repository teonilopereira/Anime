# Mirudoku

Sitio estático (HTML + JS vanilla, sin framework) para seguir anime, manga y
novelas. Datos de AniList/MangaDex/Jikan; cuentas y progreso en Supabase.
Se publica tal cual desde `main` en GitHub Pages y Netlify (no hay build en el servidor).

## Comandos

```bash
npm test            # Vitest (tests/unit/)
npm run test:e2e    # Playwright: cada página carga sin errores ni violaciones del CSP
npm run check       # mojibake en HTML + sintaxis del JS
npm run build       # regenera bundles y estampa versiones (?v=hash) en HTML y sw.js
npm run map         # regenera code-map.json
```

**Después de editar HTML, CSS o JS: `npm run build` y commitear lo generado.**
El CI (`verificar`) falla si los generados no coinciden con las fuentes.

## Dónde está cada cosa

- `*.html` en la raíz: una página por sección (quedan en la raíz a propósito).
- `js/pages/<pagina>.js`: lógica de cada página.
- `js/core/`: infraestructura compartida (va a `core-bundle.min.js`).
  `api.js` = AniList, `api-mangadex.js`/`mangadex-api.js` = MangaDex,
  `auth.js`, `storage.js`, `user-store.js`, `i18n.js`, `config.js`.
- `js/catalog/`, `js/detalle/`, `js/ui/`, `js/security/` (sanitizer/validator).
- `api/supabase-client.js`: cliente de Supabase.
- `server/`: schema, migraciones y edge function de Supabase.
- `netlify/`: funciones (proxy de MangaDex).
- `tools/build.js`: build; `tools/check-quality.js`: chequeos del CI.
- `docs/MAPEO_ARCHIVOS.md`: mapa detallado de archivos.
- `code-map.json`: tamaño, riesgo y cobertura por archivo. Consultarlo con
  `grep`/`jq` en vez de leerlo entero.

## Archivos generados: no leer ni editar a mano

Son grandes y se regeneran con `npm run build`:

- `js/core-bundle.min.js`, `js/mascot.min.js`, `js/core/i18n*.min.js`
- `js/vendor/` (supabase.esm.js, lucide.min.js)
- `css/*.min.css`
- `package-lock.json`
- El `<meta>` de CSP dentro de cada HTML

## Reglas

- El CSP se define solo en `netlify.toml`; `vercel.json` debe coincidir.
- Script solo propio (`script-src 'self'`): nada de `<script>` inline ni CDNs.
  Una API externa nueva hay que agregarla a `connect-src` en ambos archivos.
- Íconos de Lucide: si usás uno nuevo, agregalo a `tools/lucide-entry.js`.
- `js/core/config.js` se versiona a propósito (solo clave anónima; los permisos los da RLS).
- Para meter texto externo en el DOM existe `js/security/sanitizer.js`.
- Textos de UI: claves en `js/core/i18n.js` (es) y `js/core/i18n-en.js` (en).
