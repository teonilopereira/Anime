# MAPEO DE ARCHIVOS — Anime Destiny

> Referencia del árbol real del repositorio (actualizada el 2026-10-03). Sitio
> **estático** publicado en GitHub Pages y Netlify **sin paso de build remoto**: los artefactos (`css/bundle*.css`,
> `js/core-bundle*.js`, `js/vendor/*`) se generan con `npm run build` y **se
> versionan en git** a propósito. El CI verifica que estén al día.

---

## Raíz — HTML (22 páginas)

Cada página lleva `data-page="…"`; el navbar y el footer los inyecta
`js/core/common-ui.js`.

| Archivo | `data-page` | Propósito |
|---|---|---|
| `index.html` | `index` | Página principal / menú. Cadena completa de auth + catálogo. |
| `anime.html` | `anime` | Catálogo de anime. Scripts de catálogo + `api.js`. |
| `manga.html` | `manga` | Catálogo de manga. `api.js` + `mangadex-api.js`. |
| `novelas.html` | `novelas` | Catálogo de novelas ligeras. `api.js` + `mangadex-api.js`. |
| `top.html` | `top` | Ranking de juegos con tabs. Catálogo parcial. |
| `detalle.html` | `detalle` | Detalle de anime/manga/novelas/juegos. Módulos `js/detalle/*.js`. |
| `mis-listas.html` | `listas` | Listas personales (favoritos, vistos, todo), logros, apodos, puntos. |
| `comparar.html` | `comparar` | Comparación lado a lado vía `cat1/id1/cat2/id2` en la URL. |
| `ranking.html` | `ranking` | Ranking de usuarios (nivel, XP, apodos). |
| `usuario.html` | `usuario` | Perfil: datos personales, stats (nivel, XP, likes, vistos). |
| `configuracion.html` | `configuracion` | Efectos, animaciones, tamaño de tarjetas, datos locales, fondo. |
| `Login.html` | `login` | Inicio de sesión (Google OAuth + email/password). |
| `privacidad.html` | `privacidad` | Política de privacidad. |
| `terminos.html` | `terminos` | Términos y condiciones. |
| `404.html` | `404` | Página de error 404. |
| `volumenes.html` | `volumenes` | Volúmenes / capítulos / episodios de una obra con su portada. |
| `personaje.html` | `personaje` | Ficha de personaje o de su actor de voz (`js/personaje/render.js`). |
| `estudio.html` | `estudio` | Ficha de un estudio de animación (`js/estudio/render.js`). |
| `personajes.html` | `personajes` | Selector de personaje / mascota. |
| `calendario.html` | `calendario` | Calendario semanal de estrenos. |
| `retos.html` | `retos` | Retos: adiviná el anime/personaje, ¿cuál es más popular?, misiones, resumen del mes. |
| `offline.html` | `offline` | Respaldo sin conexión que sirve el service worker. |

---

## Raíz — Otros archivos

| Archivo | Propósito |
|---|---|
| `manifest.json` | Manifest PWA: nombre, iconos 192/512, color tema morado neón. |
| `sw.js` | Service worker (caché offline de la PWA). |
| `netlify.toml` | Cabeceras de seguridad (CSP, HSTS, etc.). **Sin comando de build.** |
| `vercel.json` / `.vercelignore` | Config de Vercel (espejo de `netlify.toml`). Hoy no se usa para publicar. |
| `_redirects` | Reglas de redirección de Netlify (incluye el proxy `/mdapi/*` a MangaDex). |
| `robots.txt` | Directivas para crawlers. Bloquea `/api/`, `/tools/`, `/viz/`, `/scratch/`. |
| `sitemap.xml` | Mapa del sitio para SEO. |
| `code-map.json` | Mapa del código (archivos, exports, métricas). Generado por `tools/code-map.js`. |
| `package.json` | Scripts (`build`, `map`, `test`) y dependencias (`@supabase/supabase-js`, `lucide`). |
| `vitest.config.js` | Configuración de Vitest (entorno jsdom). |
| `.gitattributes` / `.gitignore` | `.gitignore` excluye `.env`, `node_modules/`, `dist/`, `scratch/`, etc. `js/core/config.js` **sí** se versiona (solo claves públicas). |

---

## `api/` — Cliente Supabase

| Archivo | Propósito |
|---|---|
| `supabase-config.js` | Bootstrap: crea el cliente desde `window.AppConfig` e importa `supabase-client.js` de forma diferida. Expone `window.AppSupabase` y `window.AppSupabaseReady`. |
| `supabase-client.js` | Implementación de auth y datos: perfiles, estados de item, progreso, XP. Se carga **dinámicamente** desde `supabase-config.js`. |

---

## `css/` — Hojas de estilo

**Generado por build (no editar a mano):** `bundle.min.css`, `bundle-lite.min.css` (sin cards), `detalle.min.css`, `mascot.min.css`.
El resto son las fuentes que el build concatena.

| Archivo | Propósito |
|---|---|
| `base.css` | Reset + tokens de diseño (variables CSS, fuentes Orbitron/Rajdhani). |
| `theme.css` | Tema oscuro cyberpunk: fondo radial, glows morados/cian. |
| `components.css` | Navbar, botones, modales, formularios, skeletons, tooltips. |
| `cards.css` | Galería de tarjetas, flip 3D, modales de episodios/volúmenes. |
| `responsive.css` | Media queries (640/768/1024/1280px). |
| `destiny-navbar.css` | Navbar y botón de login (fuente única; no duplicar en `<style>` inline). |
| `inicio.css` | Estilos de la página de inicio. |
| `cards.css` / `advanced-filter.css` | Tarjetas y panel de filtros avanzados. |
| `detalle-local.css`, `detalle-premium.css`, `detalle-responsive.css`, `detalle-extras.css` | Estilos de la página de detalle (repartidos por área). |
| `usuario.css` | Perfil de usuario. |
| `configuracion.css` | Página de configuración (toggles, selector de tamaño). |
| `login.css` | Página de login. |
| `mascot.css` | Mascota / pet interactivo (ver `js/ui/mascot.js`). |
| `fonts.css` | Fuentes auto-hospedadas (Orbitron, Rajdhani) desde `fonts/`. |
| `chapters-modal.css` | Vista rápida de episodios/volúmenes desde el dorso de la card. |
| `volumenes.css`, `personaje.css`, `personajes.css`, `estudio.css`, `calendario.css`, `retos.css` | Estilos de cada página; se cargan sueltos (no entran al bundle). |
| `bundle.min.css` | **Generado.** Concatenación minificada de las fuentes anteriores. |

---

## `js/` — Raíz

**Generado por build:** `core-bundle.min.js` (concatena los
módulos de `js/core/`, `js/catalog/`, `js/security/` y parte de `js/ui/`; las
páginas cargan el `.min`) y `mascot.min.js` (la mascota, cargada aparte).

| Archivo | Propósito |
|---|---|
| `datos.js` | Datos estáticos de respaldo del catálogo (fallback si falla la API). |
| `utils.js` | Utilidades: `formatDate`, `truncateText`, `parseUrlParams`, `normalizeText`, `episodeStorageKey`, etc. |
| `reload.js` | Handler mínimo de recarga (`onmessage`) para el service worker. |

---

## `js/core/` — Infraestructura central (entra al `core-bundle`)

| Archivo | Propósito |
|---|---|
| `config.js` | `window.AppConfig`: URL y clave anónima de Supabase + clave VAPID pública. **Versionado** a propósito (sin secretos). Se regenera con `tools/generate-config.cjs`. |
| `config.template.js` | Template versionado que muestra la estructura esperada. |
| `constants.js` | `window.AnimeDestiny.Constants` (timeouts, límites). |
| `namespace.js` | Crea `window.AnimeDestiny`, `reportError`, toast de estado de conexión. |
| `api.js` | Cliente AniList (GraphQL) + orquestación con MangaDex. Enruta IDs numéricos a AniList, UUIDs a MangaDex. |
| `api-mangadex.js` | Helpers de bajo nivel de MangaDex (mapa de tags, fetch, merge con AniList) que consume `api.js`. Va en el bundle junto a `api.js`. |
| `mangadex-api.js` | Cliente MangaDex de alto nivel (caché de portadas, placeholder, agregados). Cargado suelto en manga/novelas/detalle/comparar. |
| `auth.js` | Autenticación sobre Supabase: `getCurrentUser`, `refreshUserUi`, login/logout, bonus diario. |
| `common-ui.js` | Inyecta navbar y footer en todas las páginas. Último `defer`. |
| `i18n.js` | Internacionalización: `applyTranslations`, `setLang`, `t`, `window.AppI18n`. Se publica como `i18n.min.js`. |
| `i18n-en.js` | Diccionario en inglés, cargado solo si hace falta (`i18n-en.min.js`). |
| `theme.js` | Tema automático / claro / oscuro. Se carga sincrónico en `<head>`. |
| `streak.js` | Racha diaria (`window.AppStreak`). |
| `missions.js` | Misiones diarias y semanales (`window.AppMissions`). |
| `reminders.js` | Recordatorios dentro de la app (`window.AppReminders`). |
| `push.js` | Notificaciones push de nuevos episodios (lado del navegador). |
| `storage.js` | Wrapper sobre `window.UserStore` (`read`/`write`/`readJson`/`remove`). |
| `user-store.js` | `PersistentStore` (Map en memoria + localStorage). Expuesto como `window.UserStore`. |

---

## `js/catalog/` — Sistema de catálogo

| Archivo | Propósito |
|---|---|
| `cards.js` | Renderizado de tarjetas, skeletons, flip 3D, barras de progreso. |
| `pagination.js` | Scroll infinito con `IntersectionObserver`; memoria de posición. |
| `search.js` | Búsqueda en vivo (debounce), sugerencias, chips de género, age-gate NSFW. |
| `chapters-modal.js` | Vista rápida de episodios/volúmenes de una card. |
| `states.js` | Favoritos/vistos, cola de sincronización con Supabase, XP/niveles, watch-status. |

---

## `js/detalle/` — Página de detalle

| Archivo | Propósito |
|---|---|
| `data.js` | Utilidades: `getParams`, `normalizeDetailItem`, traducción, estructura de temporadas. |
| `render.js` | Render principal (`renderDetalle`, `renderApiDetalle`), countdown del próximo episodio, meta tags. |
| `render-sections.js` | Render de secciones auxiliares del detalle. |
| `interactions.js` | Interactividad: modal de episodio, resolución de portadas MangaDex, carga desde API. |
| `progress.js` | Sincronización de progreso con Supabase (cola offline). |
| `comments.js` | Sistema de comentarios (spoilers, referencias, ordenamiento, filtros). |
| `seasons.js` | Cadena de temporadas/relaciones (`window.DetalleTemporadas`). |
| `themes.js` | Openings/endings vía AnimeThemes (caché, reproductor de audio). |
| `watch-links.js` | Sección "Dónde ver / Dónde leer" (solo fuentes oficiales). |

---

## `js/personaje/` y `js/estudio/`

| Archivo | Propósito |
|---|---|
| `personaje/render.js` | Ficha de personaje o actor de voz (`personaje.html`). |
| `estudio/render.js` | Ficha de estudio (`estudio.html`). |

---

## `js/pages/` — Lógica por página

| Archivo | Propósito |
|---|---|
| `script.js` | Script compartido de catálogo (secciones, flechas, estados de botones). |
| `mis-listas.js` | Núcleo de las listas del usuario (categorías, géneros, estados). |
| `mis-listas-logros.js` | Sistema de logros. |
| `mis-listas-apodos.js` | Apodos del usuario. |
| `mis-listas-puntos.js` | Puntos. |
| `ranking.js` | Ranking de usuarios (render, filtros, carga incremental). |
| `ranking-top.js` | Tabla del top (filas, tabs, iconos). |
| `usuario.js` | Perfil: nivel/puntos, fondo personalizado, render de datos. |
| `configuracion.js` | Toggles, colores personalizados, fondo, tamaño de tarjetas. |
| `comparar.js` | Comparación de dos items (parseo de params, stats, columnas). |
| `login.js` | Formulario de login, estados de auth, redirección. |
| `import-mal.js` | Importación de listas de MyAnimeList (parseo XML, lookup AniList, progreso). |
| `inicio.js` | Bloques de retención de la portada (solo con sesión y datos). |
| `volumenes.js` | Página de volúmenes. |
| `personajes.js` | Selector de personaje / mascota. |
| `calendario.js` | Calendario semanal (AniList `airingSchedule`). |
| `retos.js` | Retos: adiviná el anime/personaje, misiones, resumen del mes. |
| `retos-juegos.js` | Juegos "¿Cuál es más popular?" y "¿De qué anime es?". |
| `offline.js` | Lógica de `offline.html`. |

---

## `js/ui/` — Componentes de UI

| Archivo | Propósito |
|---|---|
| `toast.js` | Sistema de toasts (`window.Toast`: `showToast`, `dismissToast`). |
| `mascot.js` | Mascota / pet interactivo 2D (sprite animado). |
| `mascot-loader.js` | Carga la mascota después del contenido (fuera del bundle principal). |
| `mascots.js` / `characters.js` | Registros de mascotas y personajes. **Generados** por `tools/generate-mascots.js` y `tools/slice-characters.py`. |

---

## `js/security/` — Seguridad

| Archivo | Propósito |
|---|---|
| `sanitizer.js` | `escapeHtml`, `safeUrl` (también en `window`). |
| `validator.js` | `isValidCategory`, `isValidId`, `getSafeCategory`, `getSafeUrlParams`. |

---

## `js/vendor/` — Dependencias vendorizadas (generadas por build)

| Archivo | Propósito |
|---|---|
| `lucide.min.js` | Subconjunto de iconos Lucide empaquetado desde `tools/lucide-entry.js`. |
| `supabase.esm.js` | SDK de Supabase auto-hospedado (evita abrir el CSP a un CDN externo). |

---

## `tools/` — Scripts CLI

| Archivo | Propósito |
|---|---|
| `build.js` | Pipeline de build: genera `css/bundle*.css`, `js/core-bundle*.js`, `js/vendor/*` y estampa versión. |
| `generate-config.cjs` | Lee `.env` y genera `js/core/config.js` con credenciales de Supabase. |
| `code-map.js` | Genera `code-map.json` (mapa de archivos/exports/métricas). `npm run map`. |
| `check-quality.js` | Chequeos de calidad del código. |
| `lucide-entry.js` | Punto de entrada del bundle reducido de Lucide. |
| `serve.cjs` | Servidor HTTP estático local para desarrollo. |
| `fix_encoding.js` | Corrige caracteres corruptos (mojibake). |
| `auto-html.js` | Consistencia entre HTML (footer, `common-ui.js`, iconos). |
| `add_missing_manga_entries.js` | Agrega entradas de manga faltantes a los datos. |
| `generate-seo-titles.mjs` / `seo-titles.json` | Refresca los títulos para SEO desde AniList. |
| `generate-mascots.js` | Genera mascotas en pixel art con PixelLab. |
| `slice-mascots.py` / `slice-characters.py` | Recortan sprites desde `mascot-sheets/` y `character-sheets/`. |
| `agentes.html` | Panel privado de agentes para revisar código e ideas (no es parte de la app). |

---

## `server/` — Supabase

| Archivo | Propósito |
|---|---|
| `schema.sql` | Schema consolidado v2 (reemplaza versiones anteriores). Ejecutar en el SQL Editor. |
| `migrations/001_…` a `010_…` | Migraciones incrementales: comentarios, referencias, watch-status, apodos, ranking, spoilers, hardening, push, social, cron de push. |
| `functions/notify-new-episodes/` | Edge function de Supabase que manda los push de nuevos episodios (ver su README). |

---

## `netlify/` — Funciones de Netlify

| Archivo | Propósito |
|---|---|
| `functions/mdapi-cors.mjs` | Proxy de MangaDex con CORS para las copias fuera de Netlify (GitHub Pages). |

---

## `docs/` — Documentación

| Archivo | Propósito |
|---|---|
| `MAPEO_ARCHIVOS.md` | Este documento. |
| `README_ESTADISTICAS.md` | Sistema de estadísticas (nivel, XP, likes, vistos, triggers). |
| `SETUP_SUPABASE.md` | Guía de configuración de Supabase. |
| `segundo-cerebro.md` | Mapa del proyecto por dominios, generado desde `code-map.json`. |

---

## `viz/` — Visualizaciones "Segundo Cerebro" (herramientas de desarrollo)

Páginas HTML que visualizan la estructura del código a partir de `code-map.json`.
No forman parte de la app de usuario; están excluidas del indexado en `robots.txt`.

| Archivo | Propósito |
|---|---|
| `index.html` | Hub de las visualizaciones. |
| `segundo-cerebro.html` | Grafo de dominios/archivos con buscador (versión interactiva de `docs/segundo-cerebro.md`). |
| `arbol-diagnostico.html` | Mapa de calor de riesgo: métricas reales (líneas, tests, fragilidad, churn) y buscador de funciones. |

---

## `tests/` — Vitest

`tests/setup.js` + `tests/unit/*.test.js` (seasons, themes, sanitizer, toast,
validator, ranking-top, storage, i18n, user-store, api-multipage, utils,
import-mal, missions, push, streak, supabase-client, supabase-config,
watch-links).
Se ejecutan con `npm test`.

---

## `images/` — Assets

| Archivo | Propósito |
|---|---|
| `Logo.png` | Logo de "Anime Destiny" (navbar). |
| `icon-192.png` / `icon-512.png` | Iconos PWA. |
