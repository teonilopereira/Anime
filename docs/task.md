# Tareas de Integración de MangaDex y Portadas

- [x] Crear el helper `js/core/mangadex-api.js` con soporte para búsquedas, detalles y obtención de portadas.
- [x] Importar `js/core/mangadex-api.js` en los archivos HTML correspondientes (`manga.html`, `novelas.html`, `detalle.html`, `mis-listas.html`).
- [x] Modificar `buscarEnApi` en `js/core/api.js` para incorporar los resultados de MangaDex cuando la búsqueda de AniList falle o para complementar.
- [x] Modificar `cargarDetalleDesdeApi` en `js/detalle/interactions.js` para que acepte identificadores UUID y llame a `window.getMangaDexById`.
- [x] Actualizar `showEpisodeInfoModal` en `js/detalle/interactions.js` para que busque la portada de MangaDex y la dibuje en el modal.
