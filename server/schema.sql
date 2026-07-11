-- ════════════════════════════════════════════════════════════════
-- SCHEMA OPTIMIZADO — Anime Destiny v2
-- ────────────────────────────────────────────────────────────────
-- Este script reemplaza TODAS las versiones anteriores de SQL.
-- Ejecutar en SQL Editor de Supabase (proyecto nuevo o existente).
--
-- Cambios clave vs schema anterior:
--   ✓ prune_old_activity reescrito (ROW_NUMBER en vez de NOT IN)
--   ✓ progress_keys PK incluye category
--   ✓ catalog_items seguro (sin policies de INSERT/UPDATE directas)
--   ✓ Perfiles públicos para rankings + vista restringida
--   ✓ Eliminada tabla user_progress (redundante)
--   ✓ Trigger cascade reducido (log+prune combinados)
--   ✓ Índices optimizados
--   ✓ Columna meta simplificada (DEFAULT '{}', sin COALESCE)
-- ════════════════════════════════════════════════════════════════

-- ────────────────────────────────────────────────────────────────
-- LIMPIEZA: Eliminar objetos de schemas anteriores si existen
-- ────────────────────────────────────────────────────────────────
DROP TRIGGER IF EXISTS sync_progress_keys_trigger ON public.progress_keys;
DROP TRIGGER IF EXISTS log_item_state_activity_trigger ON public.item_states;
DROP TRIGGER IF EXISTS update_profiles_timestamp_trigger ON public.profiles;
DROP FUNCTION IF EXISTS public.sync_progress_keys_to_user_progress() CASCADE;
DROP FUNCTION IF EXISTS public.rebuild_user_progress_row(UUID, TEXT, TEXT) CASCADE;
DROP FUNCTION IF EXISTS public.log_item_state_activity() CASCADE;
DROP FUNCTION IF EXISTS public.update_profiles_timestamp() CASCADE;

-- Eliminar tablas en orden correcto para evitar conflictos de claves foráneas
DROP TABLE IF EXISTS public.user_activity_log CASCADE;
DROP TABLE IF EXISTS public.progress_keys CASCADE;
DROP TABLE IF EXISTS public.item_states CASCADE;
DROP TABLE IF EXISTS public.catalog_items CASCADE;
DROP TABLE IF EXISTS public.profiles CASCADE;
DROP TABLE IF EXISTS public.user_progress CASCADE;

-- ────────────────────────────────────────────────────────────────
-- FUNCIÓN BASE: set_updated_at
-- Reutilizada por todos los triggers BEFORE UPDATE.
-- ────────────────────────────────────────────────────────────────
DROP FUNCTION IF EXISTS public.set_updated_at() CASCADE;
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql
SET search_path = public AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$;


-- ════════════════════════════════════════════════════════════════
-- 1. PROFILES
--    Datos de usuario. Creado automáticamente via trigger en auth.users.
--    Contadores incrementales (total_likes, total_viewed) se mantienen
--    via trigger en item_states.
--    NOTA: Lectura pública habilitada para rankings entre usuarios.
-- ════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS public.profiles (
    id               UUID        PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    username         TEXT        NOT NULL,
    display_name     TEXT,
    email            TEXT,
    photo_url        TEXT,
    provider         TEXT        NOT NULL DEFAULT 'email',
    level            INT         NOT NULL DEFAULT 1,
    exp              INT         NOT NULL DEFAULT 0,
    total_likes      INT         NOT NULL DEFAULT 0,
    total_viewed     INT         NOT NULL DEFAULT 0,
    updated_stats_at TIMESTAMPTZ,
    created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

DROP TRIGGER IF EXISTS trg_profiles_updated_at ON public.profiles;
CREATE TRIGGER trg_profiles_updated_at
    BEFORE UPDATE ON public.profiles
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Lectura restringida: solo el propio usuario puede ver su perfil completo (email, etc.)
-- Para rankings/comparación usar la función get_ranking_profiles() (no expone email).
DROP POLICY IF EXISTS "profiles: read own"    ON public.profiles;
DROP POLICY IF EXISTS "profiles: read public" ON public.profiles;
CREATE POLICY "profiles: read own"
    ON public.profiles FOR SELECT
    USING (auth.uid() = id);

DROP POLICY IF EXISTS "profiles: insert own"  ON public.profiles;
CREATE POLICY "profiles: insert own"
    ON public.profiles FOR INSERT
    WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS "profiles: update own"  ON public.profiles;
CREATE POLICY "profiles: update own"
    ON public.profiles FOR UPDATE
    USING (auth.uid() = id);

-- ════════════════════════════════════════════════════════════════
-- Vista pública restringida para rankings
-- Expone solo campos seguros (sin email ni provider).
-- Nota: security_invoker aplica las policies del caller sobre profiles.
-- Para rankings (incluyendo anónimos) usar get_ranking_profiles().
-- ═══════════════════════════════════════════════════════════════
CREATE OR REPLACE VIEW public.profiles_public AS
SELECT
    id,
    username,
    display_name,
    photo_url,
    level,
    exp
FROM public.profiles;

ALTER VIEW public.profiles_public SET (security_invoker = true);


-- ════════════════════════════════════════════════════════════════
-- 2. CATALOG_ITEMS
--    Una fila por ítem (compartida entre todos los usuarios).
--    Evita repetir datos en cada fila de item_states.
--    SEGURIDAD: Solo escribible via funciones SECURITY DEFINER
--    (save_item_state_v2, upsert_catalog_item). No hay policies
--    de INSERT/UPDATE directas para evitar manipulación del catálogo.
-- ════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS public.catalog_items (
    id         TEXT        NOT NULL,
    category   TEXT        NOT NULL CHECK (category IN ('anime', 'manga', 'novelas', 'juegos')),
    titulo     TEXT        NOT NULL,
    img        TEXT,
    info       TEXT,
    status     TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (category, id)
);

DROP TRIGGER IF EXISTS trg_catalog_items_updated_at ON public.catalog_items;
CREATE TRIGGER trg_catalog_items_updated_at
    BEFORE UPDATE ON public.catalog_items
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.catalog_items ENABLE ROW LEVEL SECURITY;

-- Lectura: todos pueden ver el catálogo
DROP POLICY IF EXISTS "catalog_items: read all" ON public.catalog_items;
CREATE POLICY "catalog_items: read all"
    ON public.catalog_items FOR SELECT
    USING (true);

-- ⛔ NO hay policies de INSERT/UPDATE/DELETE directas.
-- Las escrituras pasan exclusivamente por funciones SECURITY DEFINER
-- (save_item_state_v2 y upsert_catalog_item) que bypassean RLS.
DROP POLICY IF EXISTS "catalog_items: upsert auth" ON public.catalog_items;
DROP POLICY IF EXISTS "catalog_items: update auth" ON public.catalog_items;


-- ════════════════════════════════════════════════════════════════
-- 3. ITEM_STATES
--    fav / viewed por usuario-ítem.
--    meta se mantiene por compatibilidad pero siempre es '{"ref":true}'.
--    Trigger: update_user_stats_on_item_change() actualiza
--    profiles.total_likes / total_viewed de forma incremental O(1).
-- ════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS public.item_states (
    user_id    UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    category   TEXT        NOT NULL,
    item_id    TEXT        NOT NULL,
    fav        BOOLEAN     NOT NULL DEFAULT FALSE,
    viewed     BOOLEAN     NOT NULL DEFAULT FALSE,
    meta       JSONB       NOT NULL DEFAULT '{}',
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (user_id, category, item_id),
    CONSTRAINT meta_size_limit CHECK (octet_length(meta::text) < 500)
);

DROP TRIGGER IF EXISTS trg_item_states_updated_at ON public.item_states;
CREATE TRIGGER trg_item_states_updated_at
    BEFORE UPDATE ON public.item_states
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.item_states ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "item_states: read own"   ON public.item_states;
CREATE POLICY "item_states: read own"
    ON public.item_states FOR SELECT
    USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "item_states: insert own"  ON public.item_states;
CREATE POLICY "item_states: insert own"
    ON public.item_states FOR INSERT
    WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "item_states: update own"  ON public.item_states;
CREATE POLICY "item_states: update own"
    ON public.item_states FOR UPDATE
    USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "item_states: delete own"  ON public.item_states;
CREATE POLICY "item_states: delete own"
    ON public.item_states FOR DELETE
    USING (auth.uid() = user_id);


-- ════════════════════════════════════════════════════════════════
-- 4. PROGRESS_KEYS
--    Progreso por episodio/capítulo/volumen.
--    Formato pkey: 's:N|ep:N' (anime), 'ch:N' (manga), 'vol:N'.
--    value=true = marcado como visto. Si se desmarca, se borra la fila.
--
--    ⚡ FIX: PK incluye category para evitar colisiones entre
--    un anime y un manga con el mismo item_id.
-- ════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS public.progress_keys (
    user_id      UUID         NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    category     TEXT         NOT NULL,
    item_id      TEXT         NOT NULL,
    pkey         TEXT         NOT NULL,
    value        BOOLEAN      NOT NULL DEFAULT TRUE,
    updated_at   TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    PRIMARY KEY (user_id, category, item_id, pkey)
);

DROP TRIGGER IF EXISTS trg_progress_keys_updated_at ON public.progress_keys;
CREATE TRIGGER trg_progress_keys_updated_at
    BEFORE UPDATE ON public.progress_keys
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.progress_keys ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "progress_keys: read own"   ON public.progress_keys;
CREATE POLICY "progress_keys: read own"
    ON public.progress_keys FOR SELECT
    USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "progress_keys: insert own"  ON public.progress_keys;
CREATE POLICY "progress_keys: insert own"
    ON public.progress_keys FOR INSERT
    WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "progress_keys: update own"  ON public.progress_keys;
CREATE POLICY "progress_keys: update own"
    ON public.progress_keys FOR UPDATE
    USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "progress_keys: delete own"  ON public.progress_keys;
CREATE POLICY "progress_keys: delete own"
    ON public.progress_keys FOR DELETE
    USING (auth.uid() = user_id);


-- ════════════════════════════════════════════════════════════════
-- 5. USER_ACTIVITY_LOG
--    Auditoría de acciones. Poda automática:
--    - Máx 500 filas por usuario (pruning eficiente con ROW_NUMBER)
--    - Cleanup manual via cleanup_old_activity() (>90 días)
-- ════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS public.user_activity_log (
    id         UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id    UUID         NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    action     TEXT         NOT NULL,
    category   TEXT,
    item_id    TEXT,
    value      INT,
    created_at TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

ALTER TABLE public.user_activity_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "activity: read own"  ON public.user_activity_log;
CREATE POLICY "activity: read own"
    ON public.user_activity_log FOR SELECT
    USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "activity: insert own" ON public.user_activity_log;
CREATE POLICY "activity: insert own"
    ON public.user_activity_log FOR INSERT
    WITH CHECK (auth.uid() = user_id);


-- ════════════════════════════════════════════════════════════════
-- VISTA: item_states_with_details
--    JOIN con catalog_items para obtener titulo, img, info, status.
--    Compatible con el formato que espera el frontend.
-- ════════════════════════════════════════════════════════════════
DROP VIEW IF EXISTS public.item_states_with_details;
CREATE OR REPLACE VIEW public.item_states_with_details AS
SELECT
    s.user_id,
    s.category,
    s.item_id  AS id,
    s.fav,
    s.viewed,
    s.updated_at,
    c.titulo,
    c.img,
    c.info,
    c.status
FROM public.item_states s
LEFT JOIN public.catalog_items c ON c.category = s.category AND c.id = s.item_id;

ALTER VIEW public.item_states_with_details SET (security_invoker = true);


-- ════════════════════════════════════════════════════════════════
-- FUNCIONES
-- ════════════════════════════════════════════════════════════════

-- ────────────────────────────────────────────────────────────────
-- handle_new_user() — Crea perfil automático al registrarse
-- ────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER SECURITY DEFINER LANGUAGE plpgsql
SET search_path = public AS $$
DECLARE
    v_username TEXT;
    v_provider TEXT;
BEGIN
    v_username := COALESCE(
        NEW.raw_user_meta_data->>'username',
        NEW.raw_user_meta_data->>'full_name',
        NEW.raw_user_meta_data->>'name',
        split_part(NEW.email, '@', 1)
    );
    v_provider := COALESCE(NEW.raw_app_meta_data->>'provider', 'email');

    INSERT INTO public.profiles (id, username, display_name, email, photo_url, provider)
    VALUES (
        NEW.id,
        v_username,
        COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', v_username),
        NEW.email,
        COALESCE(NEW.raw_user_meta_data->>'avatar_url', NEW.raw_user_meta_data->>'picture', ''),
        v_provider
    )
    ON CONFLICT (id) DO UPDATE SET
        username     = EXCLUDED.username,
        display_name = EXCLUDED.display_name,
        email        = EXCLUDED.email,
        photo_url    = EXCLUDED.photo_url,
        provider     = EXCLUDED.provider,
        updated_at   = NOW();

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();


-- ────────────────────────────────────────────────────────────────
-- update_user_stats_on_item_change() — Contadores O(1)
--    En vez de COUNT(*) cada vez, suma/resta incremental.
--    Maneja INSERT, UPDATE y DELETE correctamente.
-- ────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.update_user_stats_on_item_change()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public AS $$
DECLARE
    v_likes_delta  INT := 0;
    v_viewed_delta INT := 0;
    v_user_id      UUID;
BEGIN
    IF TG_OP = 'DELETE' THEN
        v_user_id := OLD.user_id;
        IF OLD.fav    IS TRUE THEN v_likes_delta  := -1; END IF;
        IF OLD.viewed IS TRUE THEN v_viewed_delta := -1; END IF;
    ELSIF TG_OP = 'INSERT' THEN
        v_user_id := NEW.user_id;
        IF NEW.fav    IS TRUE THEN v_likes_delta  := 1; END IF;
        IF NEW.viewed IS TRUE THEN v_viewed_delta := 1; END IF;
    ELSIF TG_OP = 'UPDATE' THEN
        v_user_id := NEW.user_id;
        -- Solo cambiar si el valor realmente cambió
        IF NEW.fav IS DISTINCT FROM OLD.fav THEN
            v_likes_delta := CASE WHEN NEW.fav THEN 1 ELSE -1 END;
        END IF;
        IF NEW.viewed IS DISTINCT FROM OLD.viewed THEN
            v_viewed_delta := CASE WHEN NEW.viewed THEN 1 ELSE -1 END;
        END IF;
    END IF;

    -- Solo hacer UPDATE si hay algo que cambiar (evita writes innecesarios)
    IF v_likes_delta <> 0 OR v_viewed_delta <> 0 THEN
        UPDATE public.profiles
        SET
            total_likes      = GREATEST(0, total_likes  + v_likes_delta),
            total_viewed     = GREATEST(0, total_viewed + v_viewed_delta),
            updated_stats_at = NOW()
        WHERE id = v_user_id;
    END IF;

    RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS update_user_stats_trigger ON public.item_states;
CREATE TRIGGER update_user_stats_trigger
    AFTER INSERT OR UPDATE OR DELETE ON public.item_states
    FOR EACH ROW EXECUTE FUNCTION public.update_user_stats_on_item_change();


-- ────────────────────────────────────────────────────────────────
-- add_user_exp() — Suma experiencia y recalcula nivel
--    Nivel 1-50. Cada nivel requiere ×1.2 más exp que el anterior.
-- ────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.add_user_exp(
    p_user_id UUID,
    p_delta   INT
) RETURNS void LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public AS $$
DECLARE
    v_level INT;
    v_exp   INT;
    v_need  INT;
BEGIN
    IF p_user_id IS DISTINCT FROM auth.uid() THEN
        RAISE EXCEPTION 'No podes modificar la experiencia de otro usuario';
    END IF;

    SELECT level, exp INTO v_level, v_exp
    FROM public.profiles WHERE id = p_user_id
    FOR UPDATE;

    v_exp := v_exp + p_delta;
    v_need := 100;

    WHILE v_exp >= v_need AND v_level < 50 LOOP
        v_exp  := v_exp - v_need;
        v_level := v_level + 1;
        v_need := FLOOR(v_need * 1.2);
    END LOOP;

    UPDATE public.profiles
    SET level = v_level, exp = v_exp, updated_stats_at = NOW()
    WHERE id = p_user_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.add_user_exp TO authenticated;


-- ────────────────────────────────────────────────────────────────
-- upsert_catalog_item() — Crea o actualiza un ítem en catalog_items
--    Llamado desde el frontend al marcar fav/viewed.
--    SECURITY DEFINER: bypasea RLS (catalog_items no tiene
--    policies de escritura directa).
-- ────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.upsert_catalog_item(
    p_category TEXT,
    p_id       TEXT,
    p_titulo   TEXT,
    p_img      TEXT DEFAULT NULL,
    p_info     TEXT DEFAULT NULL,
    p_status   TEXT DEFAULT NULL
) RETURNS void LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public AS $$
BEGIN
    -- Solo usuarios autenticados pueden modificar el catálogo
    IF auth.uid() IS NULL THEN
        RAISE EXCEPTION 'Tenés que iniciar sesión para modificar el catálogo';
    END IF;

    INSERT INTO public.catalog_items (category, id, titulo, img, info, status)
    VALUES (p_category, p_id, p_titulo, p_img, p_info, p_status)
    ON CONFLICT (category, id) DO UPDATE SET
        titulo     = COALESCE(NULLIF(EXCLUDED.titulo, ''), catalog_items.titulo),
        img        = COALESCE(NULLIF(EXCLUDED.img, ''), catalog_items.img),
        info       = COALESCE(NULLIF(EXCLUDED.info, ''), catalog_items.info),
        status     = COALESCE(NULLIF(EXCLUDED.status, ''), catalog_items.status),
        updated_at = NOW();
END;
$$;

GRANT EXECUTE ON FUNCTION public.upsert_catalog_item TO authenticated;


-- ────────────────────────────────────────────────────────────────
-- save_item_state_v2() — Versión optimizada para el frontend
--    Upsert en item_states con meta mínimo y registro en catalog_items.
--    ⚡ FIX: Validación de auth ANTES de escribir en catalog_items.
-- ────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.save_item_state_v2(
    p_user_id   UUID,
    p_category  TEXT,
    p_item_id   TEXT,
    p_fav       BOOLEAN DEFAULT FALSE,
    p_viewed    BOOLEAN DEFAULT FALSE,
    p_item_data JSONB   DEFAULT NULL
) RETURNS void LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public AS $$
BEGIN
    -- Validar identidad PRIMERO (antes de cualquier escritura)
    IF p_user_id IS DISTINCT FROM auth.uid() THEN
        RAISE EXCEPTION 'No podes modificar el estado de otro usuario';
    END IF;

    -- Upsert en catalog_items (datos compartidos del ítem)
    IF p_item_data IS NOT NULL AND p_item_data ? 'titulo' THEN
        INSERT INTO public.catalog_items (category, id, titulo, img, info, status)
        VALUES (
            p_category,
            p_item_id,
            p_item_data->>'titulo',
            p_item_data->>'img',
            p_item_data->>'info',
            p_item_data->>'status'
        )
        ON CONFLICT (category, id) DO UPDATE SET
            titulo     = COALESCE(NULLIF(EXCLUDED.titulo, ''), catalog_items.titulo),
            img        = COALESCE(NULLIF(EXCLUDED.img, ''), catalog_items.img),
            info       = COALESCE(NULLIF(EXCLUDED.info, ''), catalog_items.info),
            status     = COALESCE(NULLIF(EXCLUDED.status, ''), catalog_items.status),
            updated_at = NOW();
    END IF;

    -- Si no es fav ni viewed, limpiar el estado
    IF NOT p_fav AND NOT p_viewed THEN
        DELETE FROM public.item_states
        WHERE user_id = p_user_id AND category = p_category AND item_id = p_item_id;
        IF p_category <> 'listas' THEN
            DELETE FROM public.item_states
            WHERE user_id = p_user_id AND category = 'listas' AND item_id = p_item_id;
        END IF;
        RETURN;
    END IF;

    -- Upsert del estado del usuario
    INSERT INTO public.item_states (user_id, category, item_id, fav, viewed, meta, updated_at)
    VALUES (p_user_id, p_category, p_item_id, p_fav, p_viewed, '{}'::jsonb, NOW())
    ON CONFLICT (user_id, category, item_id) DO UPDATE SET
        fav        = p_fav,
        viewed     = p_viewed,
        updated_at = NOW();
END;
$$;

GRANT EXECUTE ON FUNCTION public.save_item_state_v2 TO authenticated;


-- ────────────────────────────────────────────────────────────────
-- get_ranking_profiles() — Ranking seguro para todos los usuarios
--    SECURITY DEFINER: bypasea RLS para devolver solo campos
--    públicos (id, username, display_name, photo_url, level, exp).
--    Reemplaza el SELECT directo sobre profiles_public que
--    exponía todas las columnas via USING(true) policy.
-- ────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.get_ranking_profiles(
    p_limit  INT DEFAULT 50,
    p_offset INT DEFAULT 0
) RETURNS TABLE (
    id           UUID,
    username     TEXT,
    display_name TEXT,
    photo_url    TEXT,
    level        INT,
    exp          INT
) LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public AS $$
BEGIN
    RETURN QUERY
    SELECT
        p.id,
        p.username,
        p.display_name,
        p.photo_url,
        p.level,
        p.exp
    FROM public.profiles p
    ORDER BY p.level DESC, p.exp DESC, p.total_likes DESC
    LIMIT p_limit OFFSET p_offset;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_ranking_profiles TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_ranking_profiles TO anon;


-- ────────────────────────────────────────────────────────────────
-- get_profiles_by_ids() — Perfiles públicos por lista de IDs
--    SECURITY DEFINER: bypasea RLS para devolver campos públicos
--    de múltiples usuarios (para comments, mentions, etc.).
-- ────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.get_profiles_by_ids(
    p_ids UUID[]
) RETURNS TABLE (
    id           UUID,
    username     TEXT,
    display_name TEXT,
    photo_url    TEXT
) LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public AS $$
BEGIN
    RETURN QUERY
    SELECT
        p.id,
        p.username,
        p.display_name,
        p.photo_url
    FROM public.profiles p
    WHERE p.id = ANY(p_ids);
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_profiles_by_ids TO authenticated;


-- ────────────────────────────────────────────────────────────────
-- log_and_prune_activity() — Logging + Pruning COMBINADOS
--    ⚡ OPTIMIZACIÓN: Un solo trigger en vez de dos separados.
--    El pruning solo se ejecuta cada ~20 inserts (probabilístico)
--    para reducir carga. Usa ROW_NUMBER en vez de NOT IN.
-- ────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.log_item_state_change()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public AS $$
DECLARE
    v_action  TEXT;
    v_user_id UUID;
BEGIN
    v_user_id := COALESCE(NEW.user_id, OLD.user_id);

    -- Determinar la acción real
    IF TG_OP = 'DELETE' THEN
        v_action := 'item_removed';
    ELSIF TG_OP = 'INSERT' THEN
        IF NEW.fav IS TRUE THEN v_action := 'liked';
        ELSIF NEW.viewed IS TRUE THEN v_action := 'viewed';
        ELSE v_action := 'item_state_changed';
        END IF;
    ELSIF TG_OP = 'UPDATE' THEN
        IF NEW.fav IS DISTINCT FROM OLD.fav THEN
            v_action := CASE WHEN NEW.fav THEN 'liked' ELSE 'unliked' END;
        ELSIF NEW.viewed IS DISTINCT FROM OLD.viewed THEN
            v_action := CASE WHEN NEW.viewed THEN 'viewed' ELSE 'unviewed' END;
        ELSE
            -- Sin cambio real en fav/viewed, no loguear
            RETURN COALESCE(NEW, OLD);
        END IF;
    END IF;

    -- Insertar el log
    INSERT INTO public.user_activity_log (user_id, action, category, item_id, created_at)
    VALUES (
        v_user_id,
        v_action,
        COALESCE(NEW.category, OLD.category),
        COALESCE(NEW.item_id, OLD.item_id),
        NOW()
    );

    -- ⚡ Pruning probabilístico: solo ejecutar ~5% de las veces
    -- Esto reduce la carga de DELETE de cada INSERT a 1-de-cada-20.
    IF random() < 0.05 THEN
        DELETE FROM public.user_activity_log
        WHERE id IN (
            SELECT id FROM (
                SELECT id, ROW_NUMBER() OVER (
                    PARTITION BY user_id ORDER BY created_at DESC
                ) AS rn
                FROM public.user_activity_log
                WHERE user_id = v_user_id
            ) ranked
            WHERE rn > 500
        );
    END IF;

    RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS trg_log_item_states ON public.item_states;
CREATE TRIGGER trg_log_item_states
    AFTER INSERT OR UPDATE OR DELETE ON public.item_states
    FOR EACH ROW EXECUTE FUNCTION public.log_item_state_change();

-- ⚠️ NO hay trigger separado prune_old_activity.
-- El pruning está integrado en log_item_state_change() arriba.
DROP TRIGGER IF EXISTS trg_prune_activity ON public.user_activity_log;
DROP FUNCTION IF EXISTS public.prune_old_activity() CASCADE;


-- ────────────────────────────────────────────────────────────────
-- log_progress_activity() — Auditoría de progreso
--    Solo loguea si el valor cambió (evita duplicados en UPDATE sin cambio).
-- ────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.log_progress_activity()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public AS $$
BEGIN
    -- En UPDATE, solo loguear si value cambió
    IF TG_OP = 'UPDATE' AND NEW.value IS NOT DISTINCT FROM OLD.value THEN
        RETURN NEW;
    END IF;

    INSERT INTO public.user_activity_log (user_id, action, category, item_id, value, created_at)
    VALUES (NEW.user_id, 'progress_updated', NEW.category, NEW.item_id, 1, NOW());
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_log_progress ON public.progress_keys;
CREATE TRIGGER trg_log_progress
    AFTER INSERT OR UPDATE ON public.progress_keys
    FOR EACH ROW EXECUTE FUNCTION public.log_progress_activity();


-- ────────────────────────────────────────────────────────────────
-- cleanup_old_activity() — Limpieza manual (>90 días)
--    Ejecutar periódicamente: SELECT cleanup_old_activity();
--    Ideal: configurar como pg_cron job si disponible.
-- ────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.cleanup_old_activity()
RETURNS void LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public AS $$
BEGIN
    DELETE FROM public.user_activity_log
    WHERE created_at < NOW() - INTERVAL '90 days';
END;
$$;


-- ════════════════════════════════════════════════════════════════
-- STORAGE (avatares)
-- Bucket público: acceso por URL directa (storage.objects NO
-- necesita policy SELECT — el flag "public" del bucket ya lo
-- permite. Sin policy SELECT = sin listing via API).
-- ════════════════════════════════════════════════════════════════
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
    'avatars',
    'avatars',
    true,
    2097152,
    ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif']
)
ON CONFLICT (id) DO NOTHING;

-- ⚠️ NO crear policy SELECT en storage.objects para el bucket avatars.
-- Bucket público = acceso por URL directa sin necesidad de policy.
-- Esto previene el lint "public_bucket_allows_listing".

DROP POLICY IF EXISTS "avatars: read public" ON storage.objects;

DROP POLICY IF EXISTS "avatars: insert own" ON storage.objects;
CREATE POLICY "avatars: insert own"
    ON storage.objects FOR INSERT
    WITH CHECK (
        bucket_id = 'avatars'
        AND auth.role() = 'authenticated'
        AND (storage.foldername(name))[1] = auth.uid()::text
    );

DROP POLICY IF EXISTS "avatars: update own" ON storage.objects;
CREATE POLICY "avatars: update own"
    ON storage.objects FOR UPDATE
    USING (
        bucket_id = 'avatars'
        AND auth.role() = 'authenticated'
        AND (storage.foldername(name))[1] = auth.uid()::text
    );

DROP POLICY IF EXISTS "avatars: delete own" ON storage.objects;
CREATE POLICY "avatars: delete own"
    ON storage.objects FOR DELETE
    USING (
        bucket_id = 'avatars'
        AND auth.role() = 'authenticated'
        AND (storage.foldername(name))[1] = auth.uid()::text
    );


-- ════════════════════════════════════════════════════════════════
-- ÍNDICES
-- ════════════════════════════════════════════════════════════════

-- Activity log: búsqueda por usuario + orden cronológico
CREATE INDEX IF NOT EXISTS idx_activity_user_created
    ON public.user_activity_log (user_id, created_at DESC);

-- Progress keys: búsqueda principal del frontend (user + category + item)
-- Parcial: solo filas marcadas como vistas (las únicas que importan)
CREATE INDEX IF NOT EXISTS idx_progress_keys_user_cat_item
    ON public.progress_keys (user_id, category, item_id)
    WHERE value = TRUE;

-- Item states: filtrado rápido de favoritos por usuario
CREATE INDEX IF NOT EXISTS idx_item_states_user_likes
    ON public.item_states (user_id)
    WHERE fav = TRUE;

-- Item states: filtrado rápido de vistos por usuario
CREATE INDEX IF NOT EXISTS idx_item_states_user_viewed
    ON public.item_states (user_id)
    WHERE viewed = TRUE;

-- Item states: optimizar el JOIN de la vista item_states_with_details
CREATE INDEX IF NOT EXISTS idx_item_states_cat_item
    ON public.item_states (category, item_id);

-- Profiles: ranking por nivel (para la página de rankings)
CREATE INDEX IF NOT EXISTS idx_profiles_ranking
    ON public.profiles (level DESC, exp DESC, total_likes DESC);

-- Limpieza: eliminar índices redundantes del schema anterior
DROP INDEX IF EXISTS idx_progress_keys_user_item;
DROP INDEX IF EXISTS idx_progress_keys_value;


-- ════════════════════════════════════════════════════════════════
-- GRANTS — Permisos para el rol 'authenticated'
-- ════════════════════════════════════════════════════════════════

-- Tablas: el acceso real lo controla RLS, pero necesitan permisos base
GRANT SELECT, INSERT, UPDATE        ON public.profiles          TO authenticated;
GRANT SELECT                        ON public.catalog_items     TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.item_states       TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.progress_keys     TO authenticated;
GRANT SELECT, INSERT                ON public.user_activity_log  TO authenticated;

-- Vistas
GRANT SELECT ON public.item_states_with_details TO authenticated;
GRANT SELECT ON public.profiles_public          TO authenticated;

-- Funciones RPC
GRANT EXECUTE ON FUNCTION public.add_user_exp         TO authenticated;
GRANT EXECUTE ON FUNCTION public.save_item_state_v2   TO authenticated;
GRANT EXECUTE ON FUNCTION public.upsert_catalog_item  TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_ranking_profiles  TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_ranking_profiles  TO anon;
GRANT EXECUTE ON FUNCTION public.get_profiles_by_ids   TO authenticated;

-- REVOKE: funciones SECURITY DEFINER que NO deben ser llamables por anon
REVOKE EXECUTE ON FUNCTION public.add_user_exp FROM anon;
REVOKE EXECUTE ON FUNCTION public.save_item_state_v2 FROM anon;
REVOKE EXECUTE ON FUNCTION public.upsert_catalog_item FROM anon;
REVOKE EXECUTE ON FUNCTION public.get_profiles_by_ids FROM anon;
REVOKE EXECUTE ON FUNCTION public.cleanup_old_activity FROM anon;

-- REVOKE: funciones internas (triggers) que no deben ser llamables vía RPC
REVOKE EXECUTE ON FUNCTION public.handle_new_user FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.update_user_stats_on_item_change FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.log_item_state_change FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.log_progress_activity FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.set_updated_at FROM anon, authenticated;

-- Anon (para ranking sin login — vía función SECURITY DEFINER)
GRANT SELECT ON public.catalog_items   TO anon;


-- ════════════════════════════════════════════════════════════════
-- FIN — 5 tablas, 2 vistas, 8 funciones/triggers, 6 índices
-- ════════════════════════════════════════════════════════════════
