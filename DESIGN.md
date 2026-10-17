# Mirudoku — Lenguaje de diseño

> App web para seguir anime, manga y novelas ligeras. Público: fans que llevan su progreso y listas desde el celular o la compu.

Este archivo describe el estilo **tal como está hoy en el código** (extraído de `css/` y de capturas de la app) y marca dónde se aparta de sí mismo. Las secciones "Propuesta" son la dirección para unificar; no están implementadas todavía.

**Cobertura de la extracción:** 27 hojas fuente de `css/` (se excluyen los `*.min.css` generados), estilos calculados en el navegador y capturas de `index`, `anime`, `detalle`, `ranking` y `mis-listas` en oscuro, claro y 390 px. Las APIs externas (AniList, MangaDex) no respondían en el entorno de extracción, así que **las tarjetas del catálogo con pósters no se vieron renderizadas**: su análisis sale solo del CSS.

---

## 1. Tema visual

**Frase del tema:** nocturna, eléctrica, de arcade.

**Carácter:** fondo casi negro con nebulosas violetas, acentos neón cian y violeta con brillo, títulos en mayúsculas con fuente geométrica de ciencia ficción. Paneles translúcidos con desenfoque de fondo (`backdrop-filter`, 35 usos). Una mascota en pixel art le da un tono de juego. El modo claro (lila pálido) es una adaptación del oscuro, que es el tema principal.

**Referencias:** estética cyberpunk / synthwave, interfaces HUD de videojuegos, pantallas de selección de arcade.

---

## 2. Paleta de colores

Fuente de verdad: `css/base.css` (`:root`) y `css/theme.css` (modo claro).

### Primitivos de marca
| Token | Oscuro | Claro | Uso |
|---|---|---|---|
| `--neon-purple` | `#bc13fe` | `#8a10cf` | Acento secundario, bordes, brillos |
| `--accent-cyan` | `#00f2ff` | `#0a8ba6` | Acento principal: títulos, pestaña activa, links |
| `--primary-purple` | `#6a0dad` | — | Casi sin uso |
| `--dark-bg` | `#050505` | `#f4f1fb` | Fondo de página |
| `--purple-gradient` | `#1a0b2e` | `#e9e3f7` | Parte media del degradado de fondo |

Variantes con transparencia ya definidas: `--neon-purple-10/15/18/glow`, `--accent-cyan-10/18`.

### Superficies y texto (semánticos, bien resueltos)
| Token | Valor | Uso |
|---|---|---|
| `--ink-rgb` | `255,255,255` / `28,22,44` | Base para todo texto y línea con alfa (`rgba(var(--ink-rgb), x)`, ~300 usos) |
| `--surface-dark` / `--surface-card` / `--surface-panel-rgb` | translúcidos | Navbar, tarjetas, paneles |
| `--text-main` | `#fff` / `#1b1530` | Texto principal |
| `--text-muted` | ink 72 % | Texto secundario |
| `--text-faint` | ink 35 % | Placeholders, metadatos |

### Acento por sección
`body[data-page]` cambia `--nav-accent`: anime = cian `#00f2ff`, manga = verde `#22c55e`, novelas = rosa `#f43f5e`.

### Semánticos (no hay tokens: están escritos a mano)
| Rol | Valores encontrados |
|---|---|
| Éxito | `#22c55e` (24), `#16a34a`, `#4ade80`, `#86efac`, `#00e676` |
| Error | `#f43f5e` (12), `#e11d48`, `#ef4444`, `#ff6b6b`, `#ff8f8f`, `#fca5a5` |
| Aviso | `#f59e0b`, `#b45309` |
| Info | `#4d86ff`, `#7ea8ff`, `#9db8ff`, `#1c46f0` |

### Desvíos detectados
- **85 hex distintos y 242 `rgba()` distintos.** Solo `#00f2ff` aparece escrito literal 33 veces, y `rgba(0,242,255,…)` lo hace con 12 opacidades distintas.
- **Más de 300 usos literales del cian y el violeta neón fuera de `theme.css`** (top: `components.css` 49, `usuario.css` 48, `cards.css` 32). Esos literales **no cambian en modo claro**.
- **Bug de contraste confirmado:** `body[data-page="anime"]` fija `--nav-accent: #00f2ff` también en modo claro. El subrayado de la pestaña activa queda en **1,24:1** sobre el fondo lila (WCAG pide 3:1 para elementos de interfaz). Manga (`#22c55e`, 2,04:1) y novelas (`#f43f5e`, 3,29:1) tampoco tienen versión clara.
- El cian del modo claro (`#0a8ba6`) da 3,58:1 sobre el fondo: alcanza para títulos grandes, no para texto chico.

### Propuesta
Agregar tokens semánticos con su par claro/oscuro y reemplazar los literales:
`--color-success`, `--color-danger`, `--color-warning`, `--color-info`, y `--nav-accent` por sección definido en ambos temas. Para las transparencias, usar `rgb(var(--accent-cyan-rgb) / <alfa>)` en lugar de un `rgba` escrito a mano por cada caso.

---

## 3. Tipografía

**Familias:**
- Títulos / display: **Orbitron** (`--font-display`), local en `fonts/`. Mayúsculas, espaciado amplio.
- Cuerpo / interfaz: **Rajdhani** (`--font-body`), local en `fonts/`.

**Pesos en uso:** 700 (83), 600 (43), 500, 800; `bold` aparece 6 veces y debería ser 700.

**Escala actual: sin sistema.** Hay **74 tamaños distintos**, casi todos entre 0,5 y 1,2 rem (0,62 · 0,64 · 0,65 · 0,66 · 0,68 · 0,7 · 0,72 · 0,75 · 0,76 · 0,78 · 0,8 · 0,82 · 0,85 · 0,88 · 0,9 · 0,92 · 0,95…). Diferencias de 0,02 rem no se perciben y solo agregan ruido.

**Desvíos:** `font-family` se escribe literal 53 veces (`'Orbitron', sans-serif`, `'Rajdhani'` sin respaldo, etc.) en lugar de usar los tokens.

**`text-transform: uppercase`** en 70 reglas: es parte de la identidad. Va con Orbitron y `letter-spacing` entre 0,04 y 0,08 em.

### Propuesta de escala (relación ~1,2, base 16 px)
| Token | Tamaño | Peso | Interlineado | Uso | Reemplaza |
|---|---|---|---|---|---|
| `--text-2xs` | 0,65 rem | 600 | 1,2 | Etiquetas en mayúsculas, badges | 0,52–0,68 |
| `--text-xs` | 0,75 rem | 600 | 1,3 | Metadatos, pestañas | 0,7–0,78 |
| `--text-sm` | 0,875 rem | 500 | 1,4 | Texto secundario, botones | 0,8–0,92 |
| `--text-base` | 1 rem | 500 | 1,5 | Cuerpo | 0,95–1,05 |
| `--text-lg` | 1,2 rem | 700 | 1,3 | Títulos de tarjeta | 1,1–1,3 |
| `--text-xl` | 1,5 rem | 700 | 1,2 | Títulos de sección (h2) | 1,4–1,6 |
| `--text-2xl` | 2 rem | 700 | 1,1 | Título de página (h1) | 2 rem |
| `--text-display` | `clamp(2.4rem, 5vw, 4rem)` | 700 | 1 | Logo/hero | clamps actuales |

Rajdhani es angosta y se lee chica: **no bajar de 0,75 rem para texto que hay que leer** (hoy hay usos de 0,5–0,62 rem).

---

## 4. Componentes

| Componente | Nivel | Propósito | Variantes / notas |
|---|---|---|---|
| Navbar (`.destiny-navbar`) | Componente | Navegación superior en escritorio | Acento según sección |
| Barra inferior | Componente | Navegación en mobile (Anime, Manga, Novelas, Listas, Más) | Íconos Lucide + etiqueta |
| Tarjeta de sección (inicio) | Componente | Entrada a cada sección | Ícono + título en mayúsculas + bajada |
| Banner "Reto del día" | Componente | Llamada destacada | Degradado violeta→cian, flecha |
| Tarjeta de catálogo (`.catalog-neon-card`, `.catalog-rail-card`, `.wcard`) | Componente | Póster + título + datos | **Tres implementaciones distintas** de lo mismo |
| Buscador (`.catalog-search-*`, `.nav-search-input`, `.cmp-search-input`) | Patrón | Búsqueda con sugerencias y filtro | Tres versiones |
| Pestañas (`.q-tab`) | Primitivo | Cambiar listado | Activa = subrayado con el acento |
| Botón (`.q-btn`, `.btn-resumen`, `.vol-btn`, `.compare-btn`, `.nav-btn`) | Primitivo | Acciones | Sin variantes formales (primario/secundario/fantasma) |
| Chip (`.q-chip`) | Primitivo | Filtros activos | Con botón de quitar |
| Selector de estado (`.watch-status-select`) | Primitivo | Viendo / completado / etc. | — |
| Toast (`.toast-*`) | Componente | Mensajes | success, error, warning, info |
| Tarjeta de error | Componente | Falla de API | Ícono, título, botón "Reintentar" |
| Skeleton (`.skeleton-*`) | Primitivo | Carga | Animación de onda |
| Tooltip | Primitivo | Ayuda contextual | — |
| Modal de capítulos | Componente | Marcar capítulos | — |
| Mascota | Componente | Personaje animado en pixel art | Respeta `prefers-reduced-motion` |

**Estados que faltan o son dispares:** foco visible no unificado (cada botón define el suyo o ninguno); `disabled` sin estilo común; no hay estado vacío compartido entre listas.

**Ambiguo:** `.cuadrado-item`, `.gallery`, `.vol-tomo` parecen variantes de tarjeta y podrían colapsarse en una sola con modificadores.

---

## 5. Layout

**Ancho máximo de contenido:** no hay uno común. `inicio.css` usa 1560 px, otras páginas 1100 px y el buscador 800 px (`--catalog-search-max-width`).

**Espaciado actual:** sin base fija. Los valores más usados son 12, 8, 10, 6, 14 y 16 px; también aparecen 5, 9, 15, 22, 26 y 34. Mezcla de 2 px y 4 px como unidad.

**Grillas:** tarjetas de inicio a 3 columnas en escritorio y 1 en mobile.

**Desvío visible en mobile (390 px):** el banner "Reto del día" queda a 16 px del borde y las tarjetas de sección a ~36 px. Los márgenes laterales no coinciden.

### Propuesta: base 4 px
`--space-1: 4px` · `--space-2: 8px` · `--space-3: 12px` · `--space-4: 16px` · `--space-5: 24px` · `--space-6: 32px` · `--space-7: 48px` · `--space-8: 64px`.
Ajuste: 6→8, 10→8 o 12, 14→12 o 16, 18/20/22→24. Margen lateral de página: `--space-4` en mobile.

### Radios
Tokens existentes: `--radius-sm` 10, `--radius-md` 12, `--radius-lg` 16, `--radius-pill` 999. Pero hay **32 valores distintos**: `8px` escrito a mano 37 veces, `6px` 18 veces, `999px` 21 veces en lugar del token. Propuesta: agregar `--radius-xs: 6px`, decidir si `8px` pasa a `--radius-sm` y reemplazar los literales.

---

## 6. Profundidad

**Capas (`z-index`):** escala tokenizada y buena (`--z-navbar` 100 → `--z-toast` 2000 → `--z-max` 9999). Desvíos: `10000`, `999`, `998`, `95` y `40` escritos a mano.

**Sombras:** **150 `box-shadow` distintos.** En la práctica hay dos familias:
- **Brillo neón:** `0 0 Npx <acento con alfa>`, el sello visual.
- **Elevación:** `0 4px 12px rgba(0,0,0,.4)`, `0 8px 24px rgba(0,0,0,.5)`.

**Translucidez:** paneles con `backdrop-filter: blur()` sobre el fondo con nebulosas.

### Propuesta
`--shadow-1` / `--shadow-2` / `--shadow-3` para elevación, y `--glow-sm` / `--glow-md` / `--glow-lg` construidos con `--nav-accent`, para que el brillo siga a la sección y al tema.

---

## 7. Qué hacer y qué evitar

### Hacer
- Usar `var(--accent-cyan)`, `var(--neon-purple)` y `var(--nav-accent)` para todo acento.
- Construir texto y bordes con `rgba(var(--ink-rgb), alfa)`: así funcionan en los dos temas.
- Títulos en Orbitron, en mayúsculas y con `letter-spacing` de 0,04–0,08 em. Cuerpo en Rajdhani.
- Probar cada cambio en oscuro **y** claro, y a 390 px.
- Envolver toda animación nueva en `@media (prefers-reduced-motion: reduce)`.

### Evitar
- Escribir `#00f2ff`, `#bc13fe` o sus `rgba` a mano: rompen el modo claro.
- Inventar tamaños de letra nuevos (0,76 rem, 0,82 rem…): usar la escala.
- Texto de lectura por debajo de 0,75 rem.
- Usar el brillo neón en texto largo: solo en títulos, bordes y elementos activos.
- Crear otra variante de tarjeta, botón o buscador sin revisar las que ya existen.

---

## 8. Responsive

Enfoque desktop-first (`max-width`). Hay **25 breakpoints distintos**; los más usados son 480 (17), 640 (14), 400 (13), 520 (9) y 700 (8).

En mobile, la navbar superior se reemplaza por una barra inferior con 5 destinos y la grilla de inicio pasa a una columna.

### Propuesta
Cuatro cortes: `480px` (celular), `640px` (celular grande), `900px` (tablet) y `1180px` (escritorio). Los demás se mueven al más cercano. Las media queries no aceptan `var()`, así que hay que documentarlos acá y respetarlos a mano.

---

## 9. Guía para agentes

- **No escribir colores a mano.** Todo color sale de un token de `base.css`/`theme.css`. Si falta uno, se agrega a ambos temas antes de usarlo.
- **Todo cambio visual se verifica en oscuro, claro y 390 px.**
- **Tipografía solo con `--font-display` / `--font-body`** y con la escala de la sección 3.
- **Espaciado en múltiplos de 4 px.**
- **Después de tocar CSS, correr `npm run build` y commitear los generados** (`css/*.min.css`, versiones estampadas); si no, el CI falla.

---

## 10. Movimiento

**Duraciones:** 0,2 s domina (118 usos); también 0,15, 0,18, 0,22, 0,25, 0,3 y 0,4 s.
**Curvas:** `ease` (122), `cubic-bezier(0.4, 0, 0.2, 1)` (29), `cubic-bezier(0.25, 1, 0.5, 1)` (7).
**Animaciones con firma propia:** `nav-brand-shimmer`, `nav-edge-sweep`, `hud-scanline`, pulsos de "en emisión" y la mascota (12 animaciones).
**Movimiento reducido:** respetado en 9 hojas (20 bloques).

### Propuesta
`--dur-fast: 150ms` · `--dur-base: 200ms` · `--dur-slow: 300ms` · `--ease-out: cubic-bezier(0.25, 1, 0.5, 1)` · `--ease-standard: cubic-bezier(0.4, 0, 0.2, 1)`.

---

## 11. Voz y tono

Español rioplatense con voseo ("Explorá", "Guardá", "Revisá tu conexión y tocá Reintentar"). Frases cortas y directas. Las etiquetas de interfaz van en mayúsculas por estilo (CSS), no en el texto fuente. Los errores dicen qué pasó y qué hacer.
