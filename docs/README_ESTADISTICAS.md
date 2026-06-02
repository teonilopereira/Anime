# 📊 Sistema de Estadísticas de Usuario

## 🎯 Descripción General

Este sistema sincroniza automáticamente los datos de:
- **Nivel y Experiencia** (nivel, exp)
- **Me Gusta** (total_likes)
- **Visto** (total_viewed)
- **Progreso Detallado** (episodios/capítulos/volúmenes vistos)

Todo se guarda en Supabase y se sincroniza entre `progress_keys`, `item_states`, `profiles`, `user_progress` y `user_activity_log` automáticamente mediante triggers.

---

## 🏗️ Arquitectura

```
UI (HTML/JS)
    ↓
UserStats API (js/core/user-stats.js)
    ↓
Supabase Client (AppSupabase)
    ↓
BaseDatos PostgreSQL
    ├── profiles (nivel, exp, likes, vistos)
    ├── progress_keys (episodios individuales) [YA EXISTE]
    ├── item_states (fav/viewed) [YA EXISTE]
    ├── user_progress (consolidado progreso)
    └── user_activity_log (auditoría)
```

---

## 🔄 Flujo de Sincronización

### Flujo 1: Marcar episodio como visto
```
Usuario marca episodio (UI)
    ↓
AppSupabase.setProgress({...})
    ↓
progress_keys se actualiza
    ↓
Trigger 'sync_progress_keys_trigger'
    ↓
user_progress se actualiza automáticamente
user_activity_log registra la acción
    ↓
UI se refresca (barra de progreso, contador)
```

### Flujo 2: Marcar como me gusta
```
Usuario marca ❤ (UI)
    ↓
AppSupabase.saveItemState({fav: true})
    ↓
item_states se actualiza
    ↓
Trigger 'update_user_stats_trigger'
    ↓
profiles.total_likes se actualiza automáticamente
user_activity_log registra 'liked'
    ↓
UI muestra el contador actualizado
```

---

## 💾 Datos Guardados Automáticamente

### En `profiles`
- `level`: Nivel del usuario (calculado desde exp)
- `exp`: Experiencia total acumulada
- `total_likes`: Contador de ítems con fav=true
- `total_viewed`: Contador de ítems con viewed=true

### En `user_progress`
- `episodes_viewed`: Total episodios vistos
- `chapters_viewed`: Total capítulos vistos
- `volumes_viewed`: Total volúmenes vistos
- `progress_percentage`: Porcentaje completado (0-100%)

### En `user_activity_log`
- Cada acción (liked, viewed, progress_updated, etc)
- Timestamp y detalles del ítem
- Permite crear historial de actividades

---

## 🎮 Cálculo de Niveles

```
Nivel 1: 0 - 100 exp
Nivel 2: 100 - 220 exp (100 base * 1.2)
Nivel 3: 220 - 384 exp (120 base * 1.2)
Nivel 4: 384 - 621 exp (144 base * 1.2)
...
```

Cada nivel requiere más experiencia. Los puntos se ganan:
- +5 exp por actualizar progreso
- +10 exp por marcar como me gusta
- +10 exp por marcar como visto

---

## 🔐 Seguridad

Todas las tablas nuevas tienen:
- **RLS Habilitado**: Cada usuario solo ve sus datos
- **Validaciones**: Checks en progres_percentage (0-100)
- **Integridad Referencial**: Borrar usuario borra datos automáticamente
- **Auditoría**: Logs de todas las acciones