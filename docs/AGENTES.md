# Agentes de Mirudoku

Roles definidos en `.claude/agents/*.md`. Se invocan desde Claude Code con el
`Agent` tool (`subagent_type: <name>`) o pidiéndolos por nombre. Cada archivo
lleva el contexto del proyecto y las reglas comunes (no editar generados, no
correr `npm run build`, no commitear: eso lo hace la sesión principal).

Los roles previos (`tester`, `disenador`, `negocio`) siguen vigentes.

## Plan 1 · Mejora de Mirudoku (`mejora-*`)

| Agente | Subagentes | Implementa |
|---|---|---|
| `mejora-coordinador` — backlog por impacto ÷ esfuerzo, dueños por archivo → `docs/BACKLOG.md` | `mejora-investigacion` (flujos, deuda, funciones a medio hacer) · `mejora-metricas` (qué medir, qué instrumentar, privacidad) | Solo docs |
| `mejora-experiencia` — estados, progreso, navegación, errores | `mejora-recorrido` (registro → búsqueda → ficha → progreso → retorno) · `mejora-accesibilidad` (teclado, contraste, responsive) | Sí |
| `mejora-comunidad` — muro de actividad y perfil público con privacidad | `mejora-supabase` (funciones, RLS, migraciones) · `mejora-privacidad` (qué se muestra, defaults, opt-out) | Sí |
| `mejora-descubrimiento` — recomendaciones explicables, filtros, relacionados | `mejora-recomendaciones` (criterios explicables, sin historial) · `mejora-catalogo` (cobertura y límites de AniList/MangaDex) | Sí |
| `mejora-eficiencia` — mantener barato el sitio estático | `mejora-arquitectura` (módulos grandes, dependencias, build) · `mejora-pruebas` (Vitest, Playwright, chequeos en `tools/`) | Sí |

Etapas: 1) base y prioridades · 2) experiencia principal · 3) funciones sociales ·
4) descubrimiento y eficiencia en paralelo · 5) integración y revisión (`tester`).

## Plan 2 · Retención (`retencion-*`)

| Agente | Subagentes | Implementa |
|---|---|---|
| `retencion-coordinador` — iniciativas por impacto, métricas de retorno → `docs/RETENCION.md` | `retencion-analisis-uso` (señales existentes de retorno/abandono) · `retencion-usuarios` (segmentos: nuevas, activas, inactivas) | Solo docs |
| `retencion-continuidad` — retomar con un toque | `retencion-seguir-viendo` (home: próximo episodio/capítulo, +1 rápido, filtro en curso) · `retencion-calendario` (estrenos de lo seguido, recordatorios opt-in) | Sí |
| `retencion-descubrimiento` — motivos relevantes para volver | `retencion-recomendaciones` (motivo visible por sugerencia) · `retencion-novedades` (sección "Novedades para vos") | Sí |
| `retencion-engagement` — visible sin presionar | `retencion-notificaciones` (categorías, límites, pausa) · `retencion-logros` (hitos por progreso real, sin castigo) | Sí |

Etapas: 1) retomar con menos pasos · 2) volver por novedades relevantes ·
3) descubrir algo nuevo · 4) reconocer el progreso · 5) aprender y ajustar.

## Reparto de archivos cuando corren en paralelo

| Archivos | Dueño |
|---|---|
| `index.html` (bloque home), `js/pages/inicio.js`, `css/inicio.css`, bloque "en curso" y filtros de `js/pages/mis-listas.js` | `retencion-seguir-viendo` |
| `calendario.*`, `js/core/reminders.js` | `retencion-calendario` |
| `configuracion.*`, `js/core/push.js`, `js/core/notif-prefs.js` | `retencion-notificaciones` |
| `js/core/streak.js`, `js/core/missions.js`, `retos.*`, `js/pages/mis-listas-logros.js` | `retencion-logros` |
| `js/core/recommend.js`, `renderRecommendations` de `mis-listas.js`, `js/detalle/render-sections.js` | `retencion-recomendaciones` |
| `js/core/novedades.js` | `retencion-novedades` |
| `usuario.*`, `api/supabase-client.js`, `server/migrations/`, `docs/FASE1_SOCIAL.md` | `mejora-comunidad` |
| `tests/`, `tools/check-quality.js` | `mejora-pruebas` |

Claves i18n (`js/core/i18n.js` + `js/core/i18n-en.js`): cada agente agrega solo las
suyas, en un bloque con comentario de su nombre.
