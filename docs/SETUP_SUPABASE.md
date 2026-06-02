# 📊 Setup: Sistema de Estadísticas en Supabase

## 🚀 Pasos para implementar

### 1. Ejecutar la migración SQL

1. Abre tu proyecto en [Supabase](https://supabase.com)
2. Ve a **SQL Editor**
3. Crea una nueva query (+ New query)
4. Copia el contenido de `sql/migrations/add_user_stats_and_progress.sql`
5. Haz click en **Run** ▶️

**Esto crea:**
- Nuevas columnas en `profiles` (level, exp, total_likes, total_viewed)
- Tabla `user_progress` (progreso consolidado)
- Tabla `user_activity_log` (auditoría)
- Triggers automáticos para sincronización
- Políticas RLS para seguridad

---

### 2. Incluir el script en tus HTMLs

En los archivos que usen estadísticas (detalle.html, mis-listas.html, usuario.html):

```html
<!-- Después de supabase-config.js -->
<script src="js/core/user-stats.js" defer></script>
```

---

### 3. Usar la API en JavaScript

#### Cargar estadísticas del usuario
```javascript
const stats = await UserStats.loadStats();
console.log(`Nivel: ${stats.level}, EXP: ${stats.exp}`);
console.log(`Me gusta: ${stats.total_likes}, Vistos: ${stats.total_viewed}`);
```

#### Agregar experiencia (y subir de nivel automáticamente)
```javascript
const result = await UserStats.addExp(50);
console.log(`Nuevo nivel: ${result.newLevel}`);
console.log(`EXP: ${result.newExp}/${result.requiredExp}`);
```

#### Me gusta y Vistos
```javascript
// Incrementar
await UserStats.addLike();  // total_likes + 1
await UserStats.addViewed(); // total_viewed + 1

// Decrementar
await UserStats.removeLike();
await UserStats.removeViewed();
```

#### Guardar progreso de episodios/capítulos
```javascript
await UserStats.saveProgress({
    category: 'anime',
    itemId: 'attack-on-titan',
    episodesViewed: 25,
    totalEpisodes: 139
});

// O para manga:
await UserStats.saveProgress({
    category: 'manga',
    itemId: 'one-piece',
    chaptersViewed: 450,
    totalChapters: 1000
});
```

#### Cargar progreso específico
```javascript
const progress = await UserStats.loadProgress('anime', 'attack-on-titan');
console.log(`Visto: ${progress.episodes_viewed}/${progress.total_episodes}`);
console.log(`Porcentaje: ${progress.progress_percentage}%`);
```

#### Cargar progreso de una categoría completa
```javascript
const allAnime = await UserStats.loadProgressByCategory('anime');
console.log(`Tienes progreso en ${allAnime.length} animes`);
```

#### Obtener estadísticas generales
```javascript
const stats = await UserStats.getProgressStats();
console.log(stats);
// {
//   anime: { count: 5, avgProgress: 60 },
//   manga: { count: 2, avgProgress: 45 },
//   novelas: { count: 1, avgProgress: 0 }
// }
```

#### Obtener historial de actividad
```javascript
const activity = await UserStats.getActivityLog(20); // Últimas 20 actividades
activity.forEach(log => {
    console.log(`${log.action} - ${log.item_id} - ${log.created_at}`);
});
```

---

## 🎨 Ejemplos de integración en UI

### Mostrar perfil del usuario
```javascript
async function loadUserProfile() {
    try {
        const stats = await UserStats.loadStats();
        const levelInfo = UserStats.calculateLevelFromExp(stats.exp);

        // Actualizar elementos HTML
        document.getElementById('userLevel').textContent = stats.level;
        document.getElementById('userLikes').textContent = stats.total_likes;
        document.getElementById('userViewed').textContent = stats.total_viewed;
        
        // Barra de experiencia
        const expPercentage = (levelInfo.currentExp / levelInfo.requiredExp) * 100;
        document.getElementById('userExpBar').style.width = expPercentage + '%';
        document.getElementById('userExpText').textContent = 
            `${levelInfo.currentExp}/${levelInfo.requiredExp}`;

    } catch (error) {
        console.error("Error cargando perfil:", error);
    }
}

// Ejecutar al cargar la página
loadUserProfile();
```

### Mostrar progreso de un anime
```javascript
async function displayAnimeProgress(animeId) {
    const progress = await UserStats.loadProgress('anime', animeId);
    
    if (!progress) {
        console.log("Sin progreso registrado");
        return;
    }
    
    const { episodes_viewed, total_episodes, progress_percentage } = progress;
    
    // Actualizar barra de progreso
    document.getElementById('progressBar').style.width = progress_percentage + '%';
    document.getElementById('progressText').textContent = 
        `${episodes_viewed}/${total_episodes} episodios (${Math.round(progress_percentage)}%)`;
}
```

### Actualizar progreso al marcar un episodio
```javascript
async function markEpisodeViewed(animeId, episodeNumber, totalEpisodes) {
    await UserStats.saveProgress({
        category: 'anime',
        itemId: animeId,
        episodesViewed: episodeNumber,
        totalEpisodes: totalEpisodes
    });
    
    // Agregar puntos exp automáticamente (5 puntos por actualización)
    const stats = await UserStats.loadStats();
    console.log(`Nuevo nivel: ${stats.level}, EXP: ${stats.exp}`);
}
```

---

## 🔒 Seguridad con RLS

Las tablas tienen Row Level Security habilitado:
- Cada usuario solo ve sus propios datos
- Los triggers automáticos generan auditoría
- Los logs de actividad se guardan automáticamente

---

## 📊 Estructura de Datos

### Tabla `profiles` (actualizada)
```
columns:
  - id (UUID) → ID del usuario
  - username (text)
  - level (INT) → Nivel actual
  - exp (INT) → Experiencia acumulada
  - total_likes (INT) → Total de me gusta
  - total_viewed (INT) → Total de vistos
  - updated_stats_at (timestamp)
```

### Tabla `user_progress` (nueva)
```
columns:
  - user_id (UUID) → Quién es
  - category (text) → anime/manga/novelas/juegos
  - item_id (text) → ID del contenido
  - episodes_viewed (INT)
  - chapters_viewed (INT)
  - volumes_viewed (INT)
  - total_episodes (INT)
  - total_chapters (INT)
  - total_volumes (INT)
  - progress_percentage (FLOAT) → 0-100%
  - updated_at (timestamp)
```

### Tabla `user_activity_log` (nueva)
```
columns:
  - user_id (UUID)
  - action (text) → liked/viewed/progress_updated
  - category (text)
  - item_id (text)
  - value (INT)
  - created_at (timestamp)
```

---

## 🔄 Sincronización automática

### `progress_keys` → `user_progress`
Cuando alguien marca un episodio/capítulo:
1. Se actualiza `progress_keys` (tabla actual)
2. Trigger automáticamente calcula el total
3. Actualiza `user_progress` con el consolidado
4. Registra en `user_activity_log`

### `item_states` → `profiles`
Cuando alguien marca me gusta/visto:
1. Se actualiza `item_states`
2. Trigger cuenta el total
3. Actualiza `profiles.total_likes` y `profiles.total_viewed`
4. Registra en `user_activity_log`

---

## 🐛 Troubleshooting

**Error: "Usuario no autenticado"**
- Asegúrate de que el usuario está logueado antes de llamar las funciones
- Verifica que `AppSupabase` está disponible en `window`

**Las estadísticas no se actualizan**
- Verifica que los triggers están activos en Supabase
- Revisa los logs de la base de datos

**Problemas de RLS**
- Verifica que las políticas están habilitadas
- Asegúrate de que el usuario autenticado tiene el mismo ID en todas las tablas

---

## 📝 Próximos pasos

- [ ] Integrar en `detalle.html` para mostrar progreso
- [ ] Integrar en `mis-listas.html` para mostrar perfil
- [ ] Integrar en `usuario.html` para estadísticas detalladas
- [ ] Crear sistema de logros/achievements
- [ ] Agregar rankings entre usuarios