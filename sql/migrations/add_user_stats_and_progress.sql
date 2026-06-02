-- ============================================================
-- MIGRATION: Agregar estadísticas de usuario y tabla de progreso
-- ============================================================
-- Esta migración combina:
-- 1. Campos en 'profiles' para nivel, exp, likes, vistos
-- 2. Tabla 'user_progress' para estadísticas consolidadas
-- 3. Triggers automáticos para sincronizar progress_keys con user_progress

-- ────────────────────────────────────────────────────────────
-- 1. ACTUALIZAR tabla 'profiles' con campos de estadísticas
-- ────────────────────────────────────────────────────────────
ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS level INT DEFAULT 1,
ADD COLUMN IF NOT EXISTS exp INT DEFAULT 0,
ADD COLUMN IF NOT EXISTS total_likes INT DEFAULT 0,
ADD COLUMN IF NOT EXISTS total_viewed INT DEFAULT 0,
ADD COLUMN IF NOT EXISTS updated_stats_at TIMESTAMP DEFAULT NOW();

-- ────────────────────────────────────────────────────────────
-- 2. CREAR tabla 'user_progress' para progreso consolidado
-- ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS user_progress (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    category TEXT NOT NULL CHECK (category IN ('anime', 'manga', 'novelas', 'juegos')),
    item_id TEXT NOT NULL,
    episodes_viewed INT DEFAULT 0,
    chapters_viewed INT DEFAULT 0,
    volumes_viewed INT DEFAULT 0,
    total_episodes INT,
    total_chapters INT,
    total_volumes INT,
    progress_percentage FLOAT DEFAULT 0 CHECK (progress_percentage >= 0 AND progress_percentage <= 100),
    updated_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(user_id, category, item_id)
);

-- ────────────────────────────────────────────────────────────
-- 3. CREAR tabla 'user_activity_log' para auditoría
-- ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS user_activity_log (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    action TEXT NOT NULL,
    category TEXT,
    item_id TEXT,
    value INT,
    created_at TIMESTAMP DEFAULT NOW()
);

-- ────────────────────────────────────────────────────────────
-- 4. CREAR índices para mejor performance
-- ────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_user_progress_user_id ON user_progress(user_id);
CREATE INDEX IF NOT EXISTS idx_user_progress_category ON user_progress(user_id, category);
CREATE INDEX IF NOT EXISTS idx_user_activity_user_id ON user_activity_log(user_id);
CREATE INDEX IF NOT EXISTS idx_user_activity_created_at ON user_activity_log(created_at DESC);

-- ────────────────────────────────────────────────────────────
-- 5. HABILITAR RLS en las nuevas tablas
-- ────────────────────────────────────────────────────────────
ALTER TABLE user_progress ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_activity_log ENABLE ROW LEVEL SECURITY;

-- ────────────────────────────────────────────────────────────
-- 6. CREAR políticas RLS para 'user_progress'
-- ────────────────────────────────────────────────────────────
CREATE POLICY "Users can view their own progress"
  ON user_progress FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own progress"
  ON user_progress FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own progress"
  ON user_progress FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own progress"
  ON user_progress FOR DELETE
  USING (auth.uid() = user_id);

-- ────────────────────────────────────────────────────────────
-- 7. CREAR políticas RLS para 'user_activity_log'
-- ────────────────────────────────────────────────────────────
CREATE POLICY "Users can view their own activity"
  ON user_activity_log FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own activity"
  ON user_activity_log FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- ────────────────────────────────────────────────────────────
-- 8. FUNCIÓN: Actualizar timestamp en 'profiles'
-- ────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION update_profiles_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_profiles_timestamp_trigger ON profiles;
CREATE TRIGGER update_profiles_timestamp_trigger
BEFORE UPDATE ON profiles
FOR EACH ROW
EXECUTE FUNCTION update_profiles_timestamp();

-- ────────────────────────────────────────────────────────────
-- 9. FUNCIÓN: Actualizar contadores en 'profiles' desde 'item_states'
-- ────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION update_user_stats_on_item_change()
RETURNS TRIGGER AS $$
DECLARE
  v_total_likes INT;
  v_total_viewed INT;
BEGIN
  -- Contar me gusta
  SELECT COUNT(*) INTO v_total_likes
  FROM item_states
  WHERE user_id = NEW.user_id AND fav = true;

  -- Contar vistos
  SELECT COUNT(*) INTO v_total_viewed
  FROM item_states
  WHERE user_id = NEW.user_id AND viewed = true;

  -- Actualizar profiles
  UPDATE profiles
  SET total_likes = v_total_likes, total_viewed = v_total_viewed, updated_stats_at = NOW()
  WHERE id = NEW.user_id;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_user_stats_trigger ON item_states;
CREATE TRIGGER update_user_stats_trigger
AFTER INSERT OR UPDATE ON item_states
FOR EACH ROW
EXECUTE FUNCTION update_user_stats_on_item_change();

-- ────────────────────────────────────────────────────────────
-- 10. FUNCIÓN: Sincronizar progress_keys con user_progress
-- ────────────────────────────────────────────────────────────
-- Esta función se ejecuta cada vez que se actualiza progress_keys
-- y actualiza automáticamente user_progress con el resumen
CREATE OR REPLACE FUNCTION sync_progress_keys_to_user_progress()
RETURNS TRIGGER AS $$
DECLARE
  v_count INT;
  v_total INT;
  v_percentage FLOAT;
BEGIN
  -- Contar cuántos pkey=true hay
  SELECT COUNT(*) INTO v_count
  FROM progress_keys
  WHERE user_id = NEW.user_id 
    AND category = NEW.category 
    AND item_id = NEW.item_id 
    AND value = true;

  -- Determinar el total basado en la categoría
  -- (Esto es aproximado, idealmente obtendrías esto de la API)
  v_total := v_count;
  
  -- Si no hay registros completados, asignar 0%
  IF v_count = 0 THEN
    v_percentage := 0;
  ELSE
    -- Calcular porcentaje (asumiendo que contamos los completados)
    v_percentage := (v_count::FLOAT / NULLIF(v_total, 0)) * 100;
  END IF;

  -- Upsert en user_progress
  INSERT INTO user_progress (
    user_id, category, item_id, 
    episodes_viewed, progress_percentage, updated_at
  )
  VALUES (
    NEW.user_id, NEW.category, NEW.item_id,
    v_count, v_percentage, NOW()
  )
  ON CONFLICT (user_id, category, item_id) 
  DO UPDATE SET 
    episodes_viewed = v_count,
    progress_percentage = v_percentage,
    updated_at = NOW();

  -- Registrar en activity log
  INSERT INTO user_activity_log (user_id, action, category, item_id, value, created_at)
  VALUES (NEW.user_id, 'progress_updated', NEW.category, NEW.item_id, v_count, NOW());

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS sync_progress_keys_trigger ON progress_keys;
CREATE TRIGGER sync_progress_keys_trigger
AFTER INSERT OR UPDATE ON progress_keys
FOR EACH ROW
EXECUTE FUNCTION sync_progress_keys_to_user_progress();

-- ────────────────────────────────────────────────────────────
-- 11. FUNCIÓN: Sincronizar item_states con activity log
-- ────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION log_item_state_activity()
RETURNS TRIGGER AS $$
BEGIN
  -- Registrar cambios en item_states
  INSERT INTO user_activity_log (user_id, action, category, item_id, created_at)
  VALUES (
    NEW.user_id,
    CASE 
      WHEN NEW.fav = true THEN 'liked'
      WHEN NEW.viewed = true THEN 'viewed'
      ELSE 'item_state_changed'
    END,
    NEW.category,
    NEW.item_id,
    NOW()
  );

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS log_item_state_activity_trigger ON item_states;
CREATE TRIGGER log_item_state_activity_trigger
AFTER INSERT OR UPDATE ON item_states
FOR EACH ROW
EXECUTE FUNCTION log_item_state_activity();

-- ────────────────────────────────────────────────────────────
-- 12. COMENTARIOS DOCUMENTALES
-- ────────────────────────────────────────────────────────────
COMMENT ON TABLE user_progress IS 'Consolidado de progreso: episodios/capítulos/volúmenes vistos por item';
COMMENT ON TABLE user_activity_log IS 'Log de auditoría de actividades (me gusta, visto, progreso)';
COMMENT ON COLUMN profiles.level IS 'Nivel del usuario (1-100)';
COMMENT ON COLUMN profiles.exp IS 'Experiencia acumulada del usuario';
COMMENT ON COLUMN profiles.total_likes IS 'Total de ítems marcados como me gusta';
COMMENT ON COLUMN profiles.total_viewed IS 'Total de ítems marcados como visto';
COMMENT ON COLUMN user_progress.progress_percentage IS 'Porcentaje de progreso (0-100)';

-- ════════════════════════════════════════════════════════════
-- FIN DE LA MIGRACIÓN
-- ════════════════════════════════════════════════════════════