# Mirudoku

Sitio estático (HTML + CSS + JS sin framework). Se publica tal cual está en
`main` (GitHub Pages y Netlify). Datos: AniList/MangaDex; cuentas: Supabase.
Castellano rioplatense en código, commits y textos.

## No leer (son generados o enormes)

`*.min.css`, `*.min.js`, `js/vendor/`, `package-lock.json`, `code-map.json`,
`images/`, `tools/*-sheets/`. Editá siempre la fuente. Para ubicar algo, primero
`docs/segundo-cerebro.md` (mapa por archivo); no barras el repo.

## Dónde está cada cosa

- Página `X.html` → lógica en `js/pages/X.js`, estilos en `css/X.css` o en un
  `<style>` dentro del propio HTML.
- Compartido: `css/base.css` (tokens), `css/theme.css` (tema claro),
  `js/core/` (va al bundle), `js/ui/`, `api/supabase-client.js`.
- Textos: `js/core/i18n.js` y `js/core/i18n-en.js` (claves en los dos).
- Diseño: `docs/DESIGN.md`.

## Reglas

- Después de tocar HTML/CSS/JS: `npm run build` (dos veces: la primera a veces
  no estampa versiones) y commiteá lo generado. CI falla si no coincide. Que
  cambie `?v=` en todos los HTML y `sw.js` es normal.
- El `<meta>` del CSP en los HTML lo genera el build desde `netlify.toml`
  (`vercel.json` debe coincidir). No editarlo a mano. Sin scripts inline.
- Íconos: Lucide; solo existen los listados en `tools/lucide-entry.js`.
- `UserStore` vive en memoria, no en localStorage.

## Verificar

```bash
npm ci            # si no hay node_modules
npm run check && npm test && npm run test:e2e
```

Capturas antes/después de una página: `node tools/capturas.cjs <pagina>
antes|despues <carpeta>` (levanta y cierra su propio servidor).

Servidor a mano: `PORT=8130 node tools/serve.cjs &` y cerrarlo con
`kill <PID>` (no `pkill -f`, mata tu propio shell).
