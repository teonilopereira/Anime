-- ════════════════════════════════════════════════════════════════
-- SCHEMA OPTIMIZADO — Mirudoku v2
-- ────────────────────────────────────────────────────────────────
-- ⚠ FUENTE DE VERDAD: server/migrations/001 … 016 (no existe 011).
--   Si este archivo y una migración difieren, MANDA LA MIGRACIÓN.
--   Este script es una foto de referencia para proyectos NUEVOS: empieza
--   con DROP TABLE … CASCADE, así que NO correrlo sobre una base con datos.
--   En una base VACÍA este archivo deja lo mismo que 001-016 aplicadas
--   (tablas, columnas, constraints, policies, funciones, vistas, índices
--   y permisos), salvo los jobs de pg_cron: 'notify-new-episodes' y
--   'push-sent-cleanup' (010) y 'activity-cleanup' (014) dependen de
--   extensiones y de la edge function desplegada; para tenerlos, correr
--   010 y 014 después (son idempotentes). Verificado en Postgres 16
--   local con stubs de auth/storage/cron: pg_dump -s de "schema.sql" y de
--   "schema viejo + 001…016" dan la misma estructura y los mismos permisos.
--   OJO: 001 y 002 NO son re-ejecutables sobre una base al día (001 choca
--   con el RETURNS de get_ranking_profiles; 002 hace ADD CONSTRAINT sin
--   IF NOT EXISTS). 003-016 sí se pueden volver a correr.
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
-- get_ranking_profiles cambió su RETURNS (005, 015): CREATE OR REPLACE no alcanza.
DROP FUNCTION IF EXISTS public.get_ranking_profiles(INT, INT);

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
    apodo            TEXT        DEFAULT 'novato',
    -- 013: opt-in del perfil público / muro. Default conservador (privado).
    updated_stats_at TIMESTAMPTZ,
    created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    -- 012: tope diario de EXP (lo usa add_user_exp)
    exp_day          DATE,
    exp_day_total    INT         NOT NULL DEFAULT 0,
    -- 013: opt-in del perfil público / muro. Default conservador (privado).
    is_public        BOOLEAN     NOT NULL DEFAULT false,
    -- 001
    CONSTRAINT profiles_level_check CHECK (level BETWEEN 1 AND 50),
    CONSTRAINT profiles_exp_check   CHECK (exp >= 0)
);

DROP TRIGGER IF EXISTS trg_profiles_updated_at ON public.profiles;
CREATE TRIGGER trg_profiles_updated_at
    BEFORE UPDATE ON public.profiles
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- 001: se elimina la vieja policy USING(true) que exponía email/provider.
DROP POLICY IF EXISTS "profiles: read public fields" ON public.profiles;

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
    -- 003: estado de seguimiento
    watch_status TEXT      NOT NULL DEFAULT ''
        CHECK (watch_status IN ('', 'viendo', 'pendiente', 'pausado', 'abandonado')),
    -- 016: total de episodios/capítulos/volúmenes (NULL = desconocido)
    total      INTEGER,
    CONSTRAINT item_states_total_check CHECK (total IS NULL OR total BETWEEN 1 AND 100000),
    PRIMARY KEY (user_id, category, item_id),
    CONSTRAINT meta_size_limit CHECK (octet_length(meta::text) < 500),
    -- 001
    CONSTRAINT item_states_category_check CHECK (category IN ('anime', 'manga', 'novelas', 'listas'))
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
    PRIMARY KEY (user_id, category, item_id, pkey),
    -- 001
    CONSTRAINT progress_keys_category_check CHECK (category IN ('anime', 'manga', 'novelas'))
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
--    - cleanup_old_activity() (>90 días), job pg_cron diario 'activity-cleanup' (014)
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

-- 014: sin policy de INSERT. El log lo escribe solo el trigger
-- log_item_state_change() y log_progress_activity() (SECURITY
-- DEFINER); si el cliente pudiera
-- insertar, podría fabricar acciones que aparecerían en el muro público.
DROP POLICY IF EXISTS "activity: insert own" ON public.user_activity_log;


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
    s.watch_status,   -- 003
    s.updated_at,
    c.titulo,
    c.img,
    c.info,
    c.status,
    s.total           -- 016
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
-- Versión de 012: tope de [-100, 100] por llamada y 2000 de EXP por día.
CREATE OR REPLACE FUNCTION public.add_user_exp(p_user_id UUID, p_delta INT)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    MAX_POR_LLAMADA CONSTANT INT := 100;
    MAX_POR_DIA     CONSTANT INT := 2000;
    v_level INT;
    v_exp   INT;
    v_need  INT;
    v_day   DATE;
    v_total INT;
    v_hoy   DATE := (NOW() AT TIME ZONE 'UTC')::DATE;
    v_delta INT := LEAST(GREATEST(COALESCE(p_delta, 0), -MAX_POR_LLAMADA), MAX_POR_LLAMADA);
BEGIN
    IF p_user_id IS DISTINCT FROM auth.uid() THEN
        RAISE EXCEPTION 'No podes modificar la experiencia de otro usuario';
    END IF;

    SELECT level, exp, exp_day, exp_day_total
      INTO v_level, v_exp, v_day, v_total
    FROM public.profiles WHERE id = p_user_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RETURN;
    END IF;

    IF v_day IS DISTINCT FROM v_hoy THEN
        v_day := v_hoy;
        v_total := 0;
    END IF;

    -- Solo lo que se gana cuenta para el tope; restar (desmarcar) siempre vale.
    IF v_delta > 0 THEN
        v_delta := LEAST(v_delta, GREATEST(MAX_POR_DIA - v_total, 0));
        v_total := v_total + v_delta;
    END IF;

    v_exp := GREATEST(v_exp + v_delta, 0);
    v_need := 100;

    WHILE v_exp >= v_need AND v_level < 50 LOOP
        v_exp  := v_exp - v_need;
        v_level := v_level + 1;
        v_need := FLOOR(v_need * 1.2);
    END LOOP;

    UPDATE public.profiles
    SET level = v_level,
        exp = v_exp,
        exp_day = v_day,
        exp_day_total = v_total,
        updated_stats_at = NOW()
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
-- save_item_state_v3() — v2 + watch_status (003). Es la que usa el
--    cliente; si no existe, cae a v2 (api/supabase-client.js).
-- ────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.save_item_state_v3(
    p_user_id      UUID,
    p_category     TEXT,
    p_item_id      TEXT,
    p_fav          BOOLEAN DEFAULT FALSE,
    p_viewed       BOOLEAN DEFAULT FALSE,
    p_item_data    JSONB   DEFAULT NULL,
    p_watch_status TEXT    DEFAULT ''
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

    -- Si no queda ningún estado, limpiar la fila
    IF NOT p_fav AND NOT p_viewed AND COALESCE(p_watch_status, '') = '' THEN
        DELETE FROM public.item_states
        WHERE user_id = p_user_id AND category = p_category AND item_id = p_item_id;
        IF p_category <> 'listas' THEN
            DELETE FROM public.item_states
            WHERE user_id = p_user_id AND category = 'listas' AND item_id = p_item_id;
        END IF;
        RETURN;
    END IF;

    -- Upsert del estado del usuario
    INSERT INTO public.item_states (user_id, category, item_id, fav, viewed, watch_status, meta, updated_at)
    VALUES (p_user_id, p_category, p_item_id, p_fav, p_viewed, COALESCE(p_watch_status, ''), '{}'::jsonb, NOW())
    ON CONFLICT (user_id, category, item_id) DO UPDATE SET
        fav          = p_fav,
        viewed       = p_viewed,
        watch_status = COALESCE(p_watch_status, ''),
        updated_at   = NOW();
END;
$$;

GRANT EXECUTE ON FUNCTION public.save_item_state_v3(UUID, TEXT, TEXT, BOOLEAN, BOOLEAN, JSONB, TEXT) TO authenticated;


-- ────────────────────────────────────────────────────────────────
-- save_item_state_v4() — v3 + p_total (016). El cliente la usa cuando
--    meta.total > 0 y cae a v3/v2 si no existe. NULL = no tocar.
-- ────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.save_item_state_v4(
    p_user_id      UUID,
    p_category     TEXT,
    p_item_id      TEXT,
    p_fav          BOOLEAN DEFAULT FALSE,
    p_viewed       BOOLEAN DEFAULT FALSE,
    p_item_data    JSONB   DEFAULT NULL,
    p_watch_status TEXT    DEFAULT NULL,
    p_total        INTEGER DEFAULT NULL
) RETURNS void LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public AS $$
DECLARE
    v_ws    TEXT;
    v_total INTEGER := CASE WHEN p_total BETWEEN 1 AND 100000 THEN p_total ELSE NULL END;
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

    -- watch_status efectivo: el pedido, o el guardado si viene NULL.
    v_ws := COALESCE(
        p_watch_status,
        (SELECT s.watch_status FROM public.item_states s
          WHERE s.user_id = p_user_id AND s.category = p_category AND s.item_id = p_item_id),
        ''
    );

    -- Si no queda ningún estado, limpiar la fila (igual que v3)
    IF NOT p_fav AND NOT p_viewed AND v_ws = '' THEN
        DELETE FROM public.item_states
        WHERE user_id = p_user_id AND category = p_category AND item_id = p_item_id;
        IF p_category <> 'listas' THEN
            DELETE FROM public.item_states
            WHERE user_id = p_user_id AND category = 'listas' AND item_id = p_item_id;
        END IF;
        RETURN;
    END IF;

    INSERT INTO public.item_states (user_id, category, item_id, fav, viewed, watch_status, total, meta, updated_at)
    VALUES (p_user_id, p_category, p_item_id, p_fav, p_viewed, v_ws, v_total, '{}'::jsonb, NOW())
    ON CONFLICT (user_id, category, item_id) DO UPDATE SET
        fav          = p_fav,
        viewed       = p_viewed,
        watch_status = v_ws,
        total        = COALESCE(v_total, item_states.total),
        updated_at   = NOW();
END;
$$;

GRANT EXECUTE ON FUNCTION public.save_item_state_v4(UUID, TEXT, TEXT, BOOLEAN, BOOLEAN, JSONB, TEXT, INTEGER) TO authenticated;


-- ────────────────────────────────────────────────────────────────
-- get_ranking_profiles() — Ranking seguro para todos los usuarios
--    SECURITY DEFINER: bypasea RLS para devolver solo campos
--    públicos (id, username, display_name, photo_url, level, exp,
--    apodo, is_public).
--    Reemplaza el SELECT directo sobre profiles_public que
--    exponía todas las columnas via USING(true) policy.
-- ────────────────────────────────────────────────────────────────
-- Versión de 015: topes de 007, desempate por id e is_public para el enlace.
CREATE FUNCTION public.get_ranking_profiles(
    p_limit  INT DEFAULT 50,
    p_offset INT DEFAULT 0
) RETURNS TABLE (
    id           UUID,
    username     TEXT,
    display_name TEXT,
    photo_url    TEXT,
    level        INT,
    exp          INT,
    apodo        TEXT,
    is_public    BOOLEAN
) LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = public AS $$
DECLARE
    v_limit  INT := LEAST(GREATEST(COALESCE(p_limit, 50), 1), 100);
    v_offset INT := GREATEST(COALESCE(p_offset, 0), 0);
BEGIN
    RETURN QUERY
    SELECT
        p.id,
        p.username,
        p.display_name,
        p.photo_url,
        p.level,
        p.exp,
        p.apodo,
        p.is_public
    FROM public.profiles p
    ORDER BY p.level DESC, p.exp DESC, p.total_likes DESC, p.id
    LIMIT v_limit OFFSET v_offset;
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
) LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = public AS $$
DECLARE
    MAX_IDS CONSTANT INT := 200;  -- 014: tope anti-volcado
BEGIN
    IF p_ids IS NULL OR cardinality(p_ids) = 0 THEN
        RETURN;
    END IF;

    RETURN QUERY
    SELECT
        p.id,
        p.username,
        p.display_name,
        p.photo_url
    FROM public.profiles p
    WHERE p.id = ANY(p_ids[1:MAX_IDS]);
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
--    Programada por 014 como job pg_cron 'activity-cleanup' (diario 04:30 UTC).
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

-- Activity log: limpieza global por fecha (001)
CREATE INDEX IF NOT EXISTS idx_activity_created
    ON public.user_activity_log (created_at);

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
-- profiles: SELECT de tabla; INSERT/UPDATE SOLO por columna (007/012/013).
-- level, exp, total_likes, total_viewed, updated_stats_at, exp_day y
-- exp_day_total quedan para las funciones SECURITY DEFINER y los triggers.
GRANT SELECT                        ON public.profiles          TO authenticated;
REVOKE INSERT, UPDATE ON public.profiles FROM anon, authenticated;
REVOKE INSERT, UPDATE (level, exp, total_likes, total_viewed, updated_stats_at, created_at)
    ON public.profiles FROM anon, authenticated;
GRANT INSERT (id, username, display_name, email, photo_url, provider, apodo, updated_at)
    ON public.profiles TO authenticated;
GRANT UPDATE (id, username, display_name, email, photo_url, provider, apodo, updated_at)
    ON public.profiles TO authenticated;
GRANT SELECT                        ON public.catalog_items     TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.item_states       TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.progress_keys     TO authenticated;
GRANT SELECT                        ON public.user_activity_log  TO authenticated;  -- 014: sin INSERT
REVOKE INSERT ON public.user_activity_log FROM anon, authenticated;  -- 014: solo escriben los triggers

-- Vistas
GRANT SELECT ON public.item_states_with_details TO authenticated;
GRANT SELECT ON public.profiles_public          TO authenticated;

-- Funciones RPC
GRANT EXECUTE ON FUNCTION public.add_user_exp         TO authenticated;
GRANT EXECUTE ON FUNCTION public.save_item_state_v2   TO authenticated;
GRANT EXECUTE ON FUNCTION public.upsert_catalog_item  TO authenticated;
GRANT EXECUTE ON FUNCTION public.save_item_state_v3(UUID, TEXT, TEXT, BOOLEAN, BOOLEAN, JSONB, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_ranking_profiles  TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_ranking_profiles  TO anon;
GRANT EXECUTE ON FUNCTION public.get_profiles_by_ids   TO authenticated;

-- REVOKE: funciones SECURITY DEFINER que NO deben ser llamables por anon
-- 012: el EXECUTE venía de PUBLIC, así que se revoca de PUBLIC también.
REVOKE EXECUTE ON FUNCTION public.add_user_exp(UUID, INT) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.save_item_state_v2(UUID, TEXT, TEXT, BOOLEAN, BOOLEAN, JSONB) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.save_item_state_v3(UUID, TEXT, TEXT, BOOLEAN, BOOLEAN, JSONB, TEXT) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.save_item_state_v4(UUID, TEXT, TEXT, BOOLEAN, BOOLEAN, JSONB, TEXT, INTEGER) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.upsert_catalog_item(TEXT, TEXT, TEXT, TEXT, TEXT, TEXT) FROM PUBLIC, anon;
-- get_profiles_by_ids: 002 la habilita para anon (comentarios sin login).
GRANT EXECUTE ON FUNCTION public.get_profiles_by_ids TO anon;
REVOKE EXECUTE ON FUNCTION public.cleanup_old_activity FROM anon, authenticated;  -- 001

-- REVOKE: funciones internas (triggers) que no deben ser llamables vía RPC
REVOKE EXECUTE ON FUNCTION public.handle_new_user FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.update_user_stats_on_item_change FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.log_item_state_change FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.log_progress_activity FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.set_updated_at FROM anon, authenticated;

-- Anon (para ranking sin login — vía función SECURITY DEFINER)
GRANT SELECT ON public.catalog_items   TO anon;


-- ════════════════════════════════════════════════════════════════
-- COMMENTS (001 + 002 referencia + 006 spoiler + 009 likes_count)
-- ════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS public.comments (
    id          UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id     UUID         NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    category    TEXT         NOT NULL CHECK (category IN ('anime', 'manga', 'novelas')),
    item_id     TEXT         NOT NULL,
    body        TEXT         NOT NULL CHECK (char_length(body) <= 2000),
    parent_id   UUID         REFERENCES public.comments(id) ON DELETE CASCADE,
    created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    ref_type    TEXT         CHECK (ref_type IN ('episode', 'volume', 'chapter')),     -- 002
    ref_number  INTEGER      CHECK (ref_number > 0),                                   -- 002
    spoiler     BOOLEAN      NOT NULL DEFAULT false,                                   -- 006
    likes_count INT          NOT NULL DEFAULT 0,                                       -- 009
    CONSTRAINT comments_ref_check CHECK (
        (ref_type IS NULL AND ref_number IS NULL)
        OR
        (ref_type IS NOT NULL AND ref_number IS NOT NULL)
    )
);

CREATE INDEX IF NOT EXISTS idx_comments_item
    ON public.comments (category, item_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_comments_parent
    ON public.comments (parent_id)
    WHERE parent_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_comments_ref
    ON public.comments (category, item_id, ref_type, ref_number);

ALTER TABLE public.comments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "comments: read"    ON public.comments;
DROP POLICY IF EXISTS "comments: insert"  ON public.comments;
DROP POLICY IF EXISTS "comments: update"  ON public.comments;
DROP POLICY IF EXISTS "comments: delete"  ON public.comments;
CREATE POLICY "comments: read"
    ON public.comments FOR SELECT USING (true);
CREATE POLICY "comments: insert"
    ON public.comments FOR INSERT
    WITH CHECK (auth.uid() = user_id);
CREATE POLICY "comments: update"
    ON public.comments FOR UPDATE
    USING (auth.uid() = user_id);
CREATE POLICY "comments: delete"
    ON public.comments FOR DELETE
    USING (auth.uid() = user_id);

DROP TRIGGER IF EXISTS trg_comments_updated_at ON public.comments;
CREATE TRIGGER trg_comments_updated_at
    BEFORE UPDATE ON public.comments
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

GRANT SELECT ON public.comments TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.comments TO authenticated;


-- ════════════════════════════════════════════════════════════════
-- COMMENT_LIKES (009) + trigger que mantiene comments.likes_count
-- ════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS public.comment_likes (
    comment_id UUID        NOT NULL REFERENCES public.comments(id) ON DELETE CASCADE,
    user_id    UUID        NOT NULL REFERENCES auth.users(id)      ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (comment_id, user_id)
);

ALTER TABLE public.comment_likes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "comment_likes: read"       ON public.comment_likes;
CREATE POLICY "comment_likes: read"
    ON public.comment_likes FOR SELECT
    USING (true);
DROP POLICY IF EXISTS "comment_likes: insert own" ON public.comment_likes;
CREATE POLICY "comment_likes: insert own"
    ON public.comment_likes FOR INSERT
    WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "comment_likes: delete own" ON public.comment_likes;
CREATE POLICY "comment_likes: delete own"
    ON public.comment_likes FOR DELETE
    USING (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.update_comment_likes_count()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        UPDATE public.comments
        SET likes_count = likes_count + 1
        WHERE id = NEW.comment_id;
        RETURN NEW;
    ELSIF TG_OP = 'DELETE' THEN
        UPDATE public.comments
        SET likes_count = GREATEST(0, likes_count - 1)
        WHERE id = OLD.comment_id;
        RETURN OLD;
    END IF;
    RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_comment_likes_count ON public.comment_likes;
CREATE TRIGGER trg_comment_likes_count
    AFTER INSERT OR DELETE ON public.comment_likes
    FOR EACH ROW EXECUTE FUNCTION public.update_comment_likes_count();

CREATE INDEX IF NOT EXISTS idx_comment_likes_user
    ON public.comment_likes (user_id, comment_id);

GRANT SELECT                 ON public.comment_likes TO anon;
GRANT SELECT, INSERT, DELETE ON public.comment_likes TO authenticated;
REVOKE EXECUTE ON FUNCTION public.update_comment_likes_count() FROM anon, authenticated;


-- ════════════════════════════════════════════════════════════════
-- PUSH_SUBSCRIPTIONS (008) — Web Push de nuevos episodios
--    La edge function notify-new-episodes la lee con service role.
-- ════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS public.push_subscriptions (
    id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id    UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    endpoint   TEXT NOT NULL UNIQUE,
    p256dh     TEXT NOT NULL,
    auth       TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS push_subscriptions_user_id_idx
    ON public.push_subscriptions (user_id);

DROP TRIGGER IF EXISTS push_subscriptions_set_updated_at ON public.push_subscriptions;
CREATE TRIGGER push_subscriptions_set_updated_at
    BEFORE UPDATE ON public.push_subscriptions
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "push: select own" ON public.push_subscriptions;
CREATE POLICY "push: select own" ON public.push_subscriptions
    FOR SELECT USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "push: insert own" ON public.push_subscriptions;
CREATE POLICY "push: insert own" ON public.push_subscriptions
    FOR INSERT WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "push: update own" ON public.push_subscriptions;
CREATE POLICY "push: update own" ON public.push_subscriptions
    FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "push: delete own" ON public.push_subscriptions;
CREATE POLICY "push: delete own" ON public.push_subscriptions
    FOR DELETE USING (auth.uid() = user_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.push_subscriptions TO authenticated;


-- ════════════════════════════════════════════════════════════════
-- PUSH_SENT (010) — avisos ya enviados, para no repetir.
--    RLS sin policies: solo la service role (edge function) la usa.
--    Los jobs de pg_cron de 010 NO se crean acá (ver encabezado).
-- ════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS public.push_sent (
    user_id    UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    tag        TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (user_id, tag)
);

ALTER TABLE public.push_sent ENABLE ROW LEVEL SECURITY;


-- ════════════════════════════════════════════════════════════════
-- CAPA SOCIAL (009 + 013) — muro y perfil público, solo is_public
--    Versión vigente: 013_social_privacy_public_profile.sql.
-- ════════════════════════════════════════════════════════════════
GRANT UPDATE (is_public) ON public.profiles TO authenticated;
COMMENT ON COLUMN public.profiles.is_public IS
    'Opt-in del usuario: si es true aparece en get_activity_feed() y get_public_profile(). Lo escribe el cliente desde configuracion.html (prefPublic).';

CREATE OR REPLACE FUNCTION public.get_activity_feed(
    p_limit  INT DEFAULT 30,
    p_offset INT DEFAULT 0
) RETURNS TABLE (
    actor_id     UUID,
    username     TEXT,
    display_name TEXT,
    photo_url    TEXT,
    action       TEXT,
    category     TEXT,
    item_id      TEXT,
    titulo       TEXT,
    img          TEXT,
    created_at   TIMESTAMPTZ
) LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = public AS $$
DECLARE
    v_limit  INT := LEAST(GREATEST(COALESCE(p_limit, 30), 1), 100);
    v_offset INT := LEAST(GREATEST(COALESCE(p_offset, 0), 0), 1000);
BEGIN
    RETURN QUERY
    SELECT a.user_id, p.username, p.display_name, p.photo_url,
           a.action, a.category, a.item_id, c.titulo, c.img, a.created_at
    FROM public.user_activity_log a
    JOIN public.profiles p ON p.id = a.user_id
    LEFT JOIN public.catalog_items c ON c.category = a.category AND c.id = a.item_id
    WHERE a.action IN ('liked', 'viewed')
      AND a.item_id IS NOT NULL
      AND p.is_public IS TRUE
    ORDER BY a.created_at DESC
    LIMIT v_limit OFFSET v_offset;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_public_profile(
    p_username TEXT
) RETURNS TABLE (
    id           UUID,
    username     TEXT,
    display_name TEXT,
    photo_url    TEXT,
    level        INT,
    exp          INT,
    apodo        TEXT,
    total_likes  INT,
    total_viewed INT,
    created_at   TIMESTAMPTZ
) LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = public AS $$
BEGIN
    IF p_username IS NULL OR length(btrim(p_username)) = 0 OR length(p_username) > 128 THEN
        RETURN;
    END IF;
    RETURN QUERY
    SELECT p.id, p.username, p.display_name, p.photo_url, p.level, p.exp,
           p.apodo, p.total_likes, p.total_viewed, p.created_at
    FROM public.profiles p
    WHERE lower(p.username) = lower(btrim(p_username))
      AND p.is_public IS TRUE
    ORDER BY p.created_at ASC
    LIMIT 1;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_activity_feed(INT, INT) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.get_public_profile(TEXT)    TO authenticated, anon;

CREATE INDEX IF NOT EXISTS idx_activity_feed_recent
    ON public.user_activity_log (created_at DESC)
    WHERE action IN ('liked', 'viewed') AND item_id IS NOT NULL;

-- El job pg_cron 'activity-cleanup' NO se crea acá (requiere la extensión):
-- lo programa 014_activity_log_hardening.sql.


-- ════════════════════════════════════════════════════════════════
-- FIN — 9 tablas, 2 vistas, 16 funciones (RPC + triggers), 13 índices
--       (+ jobs de pg_cron de 010 y 014, fuera de este archivo)
-- ════════════════════════════════════════════════════════════════
