# Diseño de Mirudoku

Referencia corta para mantener las páginas coherentes. Antes de inventar un
estilo, buscá acá si ya existe y copiá de la referencia.

## Identidad

Cyberpunk oscuro, neón violeta + cian. Orbitron (`--font-display`) para
títulos y números grandes; Rajdhani (`--font-body`) para todo lo demás. Tema
claro conmutable con los mismos tokens.

## Tokens (`css/base.css`)

| Para | Usar |
|---|---|
| Acentos | `--neon-purple`, `--accent-cyan` (+ variantes `-10/-15/-18`) |
| Texto | `--text-main`, `--text-muted` (secundario), `--text-faint` (solo decorativo) |
| Blanco/negro con alpha | `rgba(var(--ink-rgb), α)` |
| Fondos de tarjeta/panel | `rgba(var(--surface-card-rgb|--surface-panel-rgb), α)` |
| Radios | `--radius-sm/md/lg/pill` (10/12/16/999) |
| Alto de controles | `--control-height` (42px; 44px en móvil) |
| Capas | `--z-*` |

Prohibido: hex o `rgba(255,255,255,…)` fijos (rompen el tema claro), fuentes
o paletas nuevas, glassmorphism genérico.

## Tema claro (`css/theme.css`)

Voltea `--ink-rgb`, superficies, `--text-main` y oscurece los acentos. Toda
anulación nueva va **dos veces**: en `@media (prefers-color-scheme: light)
{ :root:not([data-theme="dark"]) }` y en `:root[data-theme="light"]`.

## Componentes de referencia

| Patrón | Dónde copiar |
|---|---|
| Tarjeta lateral | `.ml-card` — `mis-listas.html:482` |
| Tarjeta con línea de acento arriba | `.ml-cont-card::before` — `mis-listas.html:237` |
| Pestaña con contador | `.res-tab` + `.ml-count` — `mis-listas.html:378,392` |
| Píldora / chip | `.perfil-chip` — `css/usuario.css:39`; valor: `.perfil-pref-val` `:583` |
| Banner de encabezado (degradado violeta→cian + línea neón) | `.perfil-banner` — `css/usuario.css:78` |
| Avatar con anillo de progreso (`conic-gradient`, `--pct`) | `.perfil-avatar-ring` — `css/usuario.css:110` |
| Número grande de estadística (Orbitron, `tabular-nums`) | `.perfil-card-num` — `css/usuario.css:400`; `.ml-totals dd` |
| Rango / etiqueta en píldora | `.perfil-card-rank` — `css/usuario.css:418` |
| Barra de progreso | `.points-track` — `css/components.css:678` |
| Ícono en cuadrito tintado | `.ml-achv-icon` — `mis-listas.html:535` |
| Estado sin sesión | `.perfil-guest` — `css/usuario.css:1093` |
| Mensaje vacío generado por JS | `.ml-recs-empty` — `mis-listas.html:567` |

(Las líneas pueden correrse; buscá la clase.)

## Formato y accesibilidad

- Un foco por sección; secundario en `--text-muted`.
- Números: `font-variant-numeric: tabular-nums`. Textos largos: `max-width: 65ch`.
- Contraste AA. Texto chico violeta sobre oscuro no llega (~4.3:1): usá
  `--text-main` sobre un chip tintado.
- `:focus-visible` en todo lo clicable; objetivos de 44px en móvil; nada que
  parezca clicable sin serlo.
- Animación nueva → apagarla en `@media (prefers-reduced-motion: reduce)`.
- Markup generado por JS: clases, nunca `style="color:…"`.
- Íconos: Lucide (`<i data-lucide>`); si falta, sumarlo a `tools/lucide-entry.js`.

## Páginas ya pulidas

`mis-listas.html`, `usuario.html`. Las demás todavía usan estilos viejos:
alinearlas a esta tabla.
