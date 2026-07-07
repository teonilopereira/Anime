# Plan de Implementación: Integración de la API de MangaDex y Portadas de Volúmenes

Este plan describe el diseño e implementación para integrar la API de MangaDex en Anime Destiny. Permitirá buscar mangas y novelas no listados en AniList, visualizar sus detalles, marcar sus volúmenes y renderizar las portadas reales de cada volumen específico al presionar el botón de "Resumen" en la cuadrícula de progreso.

## User Review Required

> [!IMPORTANT]
> **Compatibilidad de Identificadores (IDs)**:
> MangaDex utiliza identificadores UUID (cadenas de texto con guiones de 36 caracteres, ej: `391b0423-db55-47e6-8f2c-e1df6d12f3ad`), a diferencia de AniList que usa enteros numéricos.
> Modificaremos el enrutamiento y la carga de detalles en el frontend para detectar dinámicamente si el ID es un UUID y, de ser así, redireccionar la consulta a MangaDex en lugar de a AniList. Esto no requiere cambios en Supabase porque sus columnas `item_id` ya están definidas como `TEXT`.

> [!TIP]
> **Origen de Datos de Portadas de Volúmenes**:
> Para mostrar la imagen del volumen correspondiente al abrir el resumen, MangaDex provee la relación de imágenes de portada por número de volumen (`volume`). Mapearemos esto consultando el endpoint `/cover` de MangaDex para cada obra de MangaDex que sea renderizada.

---

## Proposed Changes

### 1. MangaDex API Helper
#### [NEW] [mangadex-api.js](file:///c:/Users/Usuario/OneDrive/Escritorio/Errores%201/Experimento%2010/Anime%20Destiny/js/core/mangadex-api.js)
Crearemos un módulo helper que proveerá las siguientes funciones globales:
- `window.buscarEnMangaDex(query)`: Realiza búsquedas de mangas en MangaDex.
- `window.getMangaDexById(id)`: Recupera los detalles de un manga por su UUID y los mapea al formato de objeto compatible del frontend ("formato Jikan simulado").
- `window.getMangaDexCoverForVolume(mangaId, volumeNumber)`: Retorna la URL de la portada de un volumen específico buscando en las relaciones de `cover_art` de MangaDex.

### 2. Capa de API Global
#### [MODIFY] [api.js](file:///c:/Users/Usuario/OneDrive/Escritorio/Errores%201/Experimento%2010/Anime%20Destiny/js/core/api.js)
- Modificar `window.buscarEnApi(query, type)` para que, si el tipo es `manga` o `novelas`, primero consulte AniList y, si no hay resultados o para enriquecer la búsqueda, consulte a MangaDex mediante `buscarEnMangaDex()` y agregue los resultados a la lista sin duplicar.

### 3. Página de Detalles
#### [MODIFY] [interactions.js](file:///c:/Users/Usuario/OneDrive/Escritorio/Errores%201/Experimento%2010/Anime%20Destiny/js/detalle/interactions.js)
- Actualizar `cargarDetalleDesdeApi` para admitir IDs de tipo UUID (verificando la expresión regular de UUID).
- Si es UUID, redirigir la carga de detalles a `window.getMangaDexById`.
- Modificar `showEpisodeInfoModal` para que, si la obra proviene de MangaDex, consulte la portada del volumen correspondiente con `getMangaDexCoverForVolume(mangaId, volumeNumber)` y renderice la imagen dentro del modal de resumen.

---

## Verification Plan

### Manual Verification
1. **Búsqueda en Catálogo**:
   - Abrir la sección Manga o Novelas.
   - Buscar un título específico que no exista en AniList pero sí en MangaDex.
   - Confirmar que la búsqueda retorna los resultados de MangaDex, mostrando las tarjetas en el catálogo.
2. **Carga del Detalle**:
   - Hacer clic en la tarjeta del manga de MangaDex.
   - Verificar que la URL sea `detalle.html?cat=manga&id={UUID}` y que la página cargue correctamente su sinopsis, estado, cantidad de volúmenes y géneros.
3. **Resumen de Volumen con Imagen**:
   - En la sección de volúmenes, marcar uno como "Visto".
   - Presionar el botón "Resumen".
   - Confirmar que el modal se abre y muestra la **portada real y correcta** del volumen seleccionado junto con su título.
