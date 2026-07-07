# MAPEO DE ARCHIVOS — Anime Destiny

## Raíz (`Anime Destiny/`)

### HTML (13 páginas)

| Archivo | Propósito |
|---|---|
| `index.html` | Página principal / menú. Carga cadena completa de auth + catálogo. Nav/footer inyectados por `common-ui.js`. |
| `anime.html` | Catálogo de anime. `data-page="anime"`. Carga scripts de catálogo + `api.js`. |
| `manga.html` | Catálogo de manga. Carga `api.js` + `mangadex-api.js`. |
| `novelas.html` | Catálogo de novelas ligeras. Carga `api.js` + `mangadex-api.js`. |
| `top.html` | Ranking de juegos con tabs F2P/P2W. Catálogo parcial (`states.js`, `cards.js`, `pagination.js`; sin `search.js` ni `script.js`). Carga `juegos-tabs.js`. |
| `detalle.html` | Página de detalle (anime, manga, novelas, juegos). Sin scripts de catálogo. Carga `api.js`, `mangadex-api.js`, `detalle.js` y módulos `js/detalle/*.js`. |
| `manga-info.html` | Redirección legacy a `detalle.html`. Solo 15 líneas. |
| `mis-listas.html` | Listas personales del usuario (favoritos, vistos, todo). Carga `mangadex-api.js` pero NO `api.js`. |
| `Login.html` | Inicio de sesión (Google OAuth + email/password). Sin scripts de catálogo; tiene script inline de formulario. |
| `usuario.html` | Perfil de usuario: datos personales, stats (nivel, XP, likes, vistos). Sin scripts de catálogo. |
| `configuracion.html` | Configuración: efectos, animaciones, tamaño de tarjetas, datos locales. Sin scripts de catálogo. |
| `comparar.html` | Comparación lado a lado de dos items del catálogo vía `cat1/id1/cat2/id2` en URL. |
| `view_images.html` | Visor de imágenes de portadas de manga. Sin Supabase/auth. |

### Otros archivos raíz

| Archivo | Propósito |
|---|---|
| `.env` | Credenciales de Supabase (`VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`). Gitignored. |
| `.gitignore` | Excluye `.env`, `js/core/config.js`, `node_modules/`, `dist/`, etc. |
| `manifest.json` | Manifest PWA: nombre, descripción, iconos 192/512, color tema morado neón. |
| `config.js` | Template de configuración (no usado en runtime). Valores vacíos, solo referencia. |

---

## `api/` — Clientes API legacy + configuración Supabase

| Archivo | Propósito |
|---|---|
| `api.js` | Cliente AniList legacy. GraphQL. Cache con `localStorage`. Contraparte antigua de `js/core/api.js`. |
| `supabase-config.js` | Módulo ES que crea el cliente Supabase desde `window.AppConfig`. Expone `window.AppSupabase` con métodos de auth, perfiles, estados y progreso. |
| `datos.json` | Datos estáticos de respaldo (3078 líneas). Arrays de `manga`, `anime`, `juegos`, `novelas` usados cuando falla la API. |

---

## `css/` — 8 hojas de estilo

| Archivo | Propósito |
|---|---|
| `base.css` | Reset CSS y tokens de diseño (variables CSS: `--primary-purple`, `--neon-purple`, `--accent-cyan`, etc.). Fuentes Orbitron (títulos) y Rajdhani (cuerpo). |
| `theme.css` | Tema oscuro cyberpunk: fondo con degradado radial, glows morados/cian. `background-attachment: fixed`. |
| `components.css` | Estilos globales: navbar, botones, modales, formularios, skeletons, barras de progreso, tooltips. 1765 líneas. |
| `cards.css` | Galería de tarjetas, animación flip 3D, modales de episodios/volúmenes, franjas de categoría. 3653 líneas. |
| `responsive.css` | Media queries en 640/768/1024/1280px: cuadrícula, navbar, modales, tipografía. 1051 líneas. |
| `destiny-navbar.css` | Estilos centralizados de navbar y botón de login. NO agregar estilos de login en bloques `<style>` de HTML. |
| `usuario.css` | Estilos de la página de perfil: header, avatar, stats, formularios. |
| `configuracion.css` | Estilos de la página de configuración: toggles, selector de tamaño de tarjetas. |

---

## `js/` — Scripts raíz

| Archivo | Propósito |
|---|---|
| `datos.js` | Declara `window.DATOS_WEB` con arrays de `manga`, `anime`, `juegos`, `novelas`. Normaliza filas de Supabase. Dispara evento `datosCargados`. |
| `script.js` | Script compartido de catálogo: escucha evento `supabase-auth-changed` para refrescar botones. Gestiona visibilidad de "Continue Watching". |
| `ui.js` | Utilidades de UI: `showElement()`, `hideElement()`, `openModal()`, `closeModal()`, `cargarEstadosBotones()`, `actualizarUI()`. |
| `utils.js` | Utilidades generales: `formatDate()`, `truncateText()`, `parseUrlParams()`, `normalizeText()`, `getCurrentUserId()`. |
| `detalle.js` | Orquestador legacy de la página de detalle (627 líneas). Contraparte de los módulos `js/detalle/*.js`. |
| `juegos-tabs.js` | Sistema de tabs F2P/P2W en `top.html`. Filtra juegos por precio y maneja clicks en tabs. |
| `manga-info.js` | Redirección legacy a `detalle.html`. Solo 5 líneas. |
| `mis-listas.js` | Lógica de listas de usuario: tabs de categoría, carga de estados desde Supabase, renderizado, sección de actividad reciente. |
| `comparar.js` | Lógica de comparación: lee `cat1/id1/cat2/id2` de URL, obtiene detalles, renderiza ambas columnas. |

---

## `js/core/` — Infraestructura central

| Archivo | Propósito |
|---|---|
| `config.js` | **Generado automáticamente** (gitignored). `window.AppConfig` con credenciales reales de Supabase. Producido por `tools/generate-config.js` desde `.env`. |
| `config.template.js` | Template de configuración (trackeado por Git). Muestra la estructura esperada e instrucciones. |
| `api.js` | Cliente actual de AniList (Cache API, TTL 30 min). Funciones: `searchAnilist()`, `getAnilistById()`, `getAnilistDetails()`, `getMultipleByIds()`. Enruta IDs numéricos a AniList, UUIDs a MangaDex. |
| `mangadex-api.js` | Cliente de MangaDex (REST, Cache API, TTL 30 min). Funciones: `searchMangaDex()`, `getMangaDexById()`, `getMangaDexCover()`, `getMangaDexVolumes()`. |
| `auth.js` | Módulo de autenticación. `waitForSupabase()`, `getCurrentUserId()`, `onAuthStateChanged()`, `refreshUserUi()`. Supabase es la única fuente de verdad (sin localStorage para tokens). |
| `common-ui.js` | Inyecta navbar (logo + enlaces) y footer en `#nav-brand-container`, `#nav-links-container`, `#footer-container`. Último script defer en todas las páginas. No depende de auth. |
| `storage.js` | Wrapper sobre `window.UserStore`. `read()`, `write()`, `remove()`, `clear()`. No persiste directamente a localStorage. |
| `user-store.js` | Clase `PersistentStore` (Map en memoria + localStorage bajo clave `animeDestiny:userStore`). Expuesto como `window.UserStore`. |

---

## `js/catalog/` — Sistema de catálogo

| Archivo | Propósito |
|---|---|
| `cards.js` | Renderizado de tarjetas: `renderSkeletonCards()` (40 placeholders), `cargarCatalogo()`, flip 3D, barras de progreso, grilla de episodios/volúmenes. |
| `pagination.js` | Scroll infinito con `IntersectionObserver` en `#scroll-sentinel`. Gestiona `currentPage`, `isLoadingPage`, `hasMorePages`. |
| `search.js` | Búsqueda en vivo (debounce 400ms). Consulta `DATOS_WEB` + AniList + MangaDex. Dropdown de sugerencias, chips de género (18), `window.__activeStateFilter`. |
| `states.js` | Sistema de favoritos/vistos. Cola de sincronización con Supabase. Cálculo de XP y niveles (100 XP por nivel, máx 50). Persistencia local vía `UserStore`. |

---

## `js/detalle/` — Módulos de detalle

| Archivo | Propósito |
|---|---|
| `data.js` | Utilidades: `getParams()` (lee `id`, `nombre`, `cat` de URL), `normalizeDetailItem()`, `getApiChapterTotal()`. |
| `interactions.js` | Interactividad: `wirePremiumDetailInteractions()` configura barra de progreso, grilla de episodios, botones favorito/visto, compartir, toggle de sinopsis. |
| `progress.js` | Sincronización de progreso: `syncProgressFromSupabase()` obtiene claves de progreso desde Supabase y las escribe en `UserStore`. |
| `render.js` | Renderizado: `renderDetalle()` y `renderApiDetalle()` dibujan la página completa (portada, título, sinopsis, metadatos, franquicia, grilla de progreso, botones). |

---

## `js/security/` — Seguridad

| Archivo | Propósito |
|---|---|
| `sanitizer.js` | Sanitización HTML: `escapeHtml()`, `stripTags()`, `sanitizeText()` (strip + escape + trim). |
| `validator.js` | Validación de entrada: `isValidCategory()`, `isValidId()`, `getSafeCategory()`, `getSafeUrlParams()`. |

---

## `tools/` — Scripts CLI (18 archivos)

| Archivo | Propósito |
|---|---|
| `generate-config.js` | Lee `.env` y genera `js/core/config.js` con credenciales reales de Supabase. |
| `auto-html.js` | Automatiza consistencia entre HTML: reemplaza footer, agrega `common-ui.js`, normaliza `config.js`, arregla iconos sociales. |
| `fix-scripts.js` | Corrige etiquetas `<script>` mal cerradas de `config.js`. |
| `replace-nav.js` | Reemplaza navbar/footer hardcodeados con divs placeholder en 11 HTMLs. |
| `replace-pagination.js` | Reemplaza `div.modern-pagination` con `#scroll-sentinel` en anime/manga/novelas. |
| `replace-store.js` | Migra llamadas `localStorage` a `UserStore` en JS. |
| `insert-store.js` | Inserta `<script src="js/core/user-store.js">` en HTMLs. |
| `add-manifest.js` | Agrega `<link rel="manifest">` a HTMLs que lo necesiten. |
| `add-p2w.js` | Marca juegos con `precio >= 40000` como `p2w: true` en `datos.json`. |
| `add_missing_manga_entries.js` | Agrega entradas de manga faltantes a `datos.js`. |
| `clean-duplicates.js` | Elimina CSS duplicado y estilos inline de login de todos los HTMLs. |
| `clean-scriptjs.js` | Elimina bloque duplicado de paginación en `js/script.js`. |
| `fix_all.js` | Corrige caracteres corruptos (mojibake) en HTML y JS. |
| `fix_datos_replacement.js` | Corrige mojibake específico en `datos.js`. |
| `fix_manga_images.js` | Verifica que imágenes de manga existan en `images/manga/`. |
| `fix_text.js` | Corrige mojibake en `mis-listas.js` y `script.js`. |
| `update-html.js` | Script legacy (deprecado). Inserta scripts antiguos en HTMLs. |

---

## `server/` — Schema de Supabase

| Archivo | Propósito |
|---|---|
| `schema-supabase.sql` | Schema inicial (205 líneas): tablas `profiles`, `item_states`, `progress_keys`, trigger `set_updated_at()`, políticas RLS, trigger `handle_new_user()`. |

---

## `sql/` — Migraciones numeradas (01–12)

| Archivo | Propósito |
|---|---|
| `01_schema_base.sql` | Schema base: `profiles`, `item_states`, `progress_keys`, triggers y RLS inicial. |
| `02_fix_handle_new_user.sql` | Corrige `handle_new_user()` para extraer `raw_user_meta_data`. |
| `03_schema_complete.sql` | Schema completo consolidado (copia de referencia). |
| `04_add_profile_stats_columns.sql` | Agrega columnas `level`, `exp`, `total_likes`, `total_viewed`, `updated_stats_at` a `profiles`. |
| `05_update_user_stats_trigger.sql` | Crea trigger que recalcula stats en `profiles` al insertar/actualizar `item_states`. |
| `06_migration_user_progress.sql` | Crea tabla `user_progress` y `user_activity_log`. Triggers de sincronización. |
| `07_fix_rebuild_progress.sql` | Agrega columnas faltantes a `user_progress`. Crea `rebuild_user_progress_row()`. |
| `08_fix_stats_triggers.sql` | Relaja límite de `meta_size_limit` a 15000 bytes. Maneja DELETE en triggers. |
| `09_fix_activity_log.sql` | Corrige `log_item_state_activity()` para DELETE. |
| `10_final_additions.sql` | Política de lectura pública en `profiles`. Función `add_user_exp()`. |
| `11_clean_duplicate_triggers.sql` | Limpia triggers duplicados en `item_states`. Versiones únicas y limpias. |
| `12_fix_user_progress_rls.sql` | Agrega políticas RLS faltantes en `user_progress` (SELECT/INSERT/UPDATE). |

---

## `sql/migrations/`

| Archivo | Propósito |
|---|---|
| `add_user_stats_and_progress.sql` | Migración combinada opcional (250 líneas): stats + progreso + activity log + triggers en un solo archivo. |

---

## `docs/` — Documentación

| Archivo | Propósito |
|---|---|
| `implementation_plan.md` | Plan de integración de MangaDex: enrutamiento UUID, creación de `mangadex-api.js`, búsqueda combinada. |
| `README_ESTADISTICAS.md` | Documentación del sistema de estadísticas: nivel, XP, likes, vistos, progreso, triggers de Supabase. |
| `SETUP_SUPABASE.md` | Guía paso a paso para configurar Supabase: proyecto, migraciones, auth providers, RLS. |
| `task.md` | Checklist de tareas de integración MangaDex (completadas). |
| `walkthrough.md` | Documentación de fixes aplicados: sesión, navbar, sincronización, refresh de tarjetas, progreso. |

---

## `images/` — Assets estáticos

| Archivo | Propósito |
|---|---|
| `icon-192.png` | Icono PWA 192×192 para home screen. |
| `icon-512.png` | Icono PWA 512×512 para splash screens. |
| `Logo.png` | Logo de "Anime Destiny" usado en navbar. |
