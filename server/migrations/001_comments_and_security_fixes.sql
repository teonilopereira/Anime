-- ══════════════════════════════════════════════════════════════
-- MIGRACIÓN COMPLETA — Anime Destiny
-- Fecha: 2026-07-10
-- Ejecutar en SQL Editor de Supabase
-- ══════════════════════════════════════════════════════════════

-- ─── 1. FIX: profiles_public con photo_url + SECURITY FIX ──────
-- Agrega photo_url al view para que el ranking muestre imágenes.
-- FIX: Eliminamos la policy USING(true) que exponía TODAS las
-- columnas (email, provider) a anónimos. En su lugar, creamos
-- una función SECURITY DEFINER get_ranking_profiles() que
-- bypasea RLS y devuelve solo campos públicos seguros.
DROP VIEW IF EXISTS public.profiles_public;

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

-- ELIMINAR la policy peligrosa que exponía todas las columnas
DROP POLICY IF EXISTS "profiles: read public fields" ON public.profiles;

-- Función SECURITY DEFINER para ranking (bypasea RLS, solo devuelve campos públicos)
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
) LANGUAGE plpgsql SECURITY DEFINER AS $$
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

-- Permisos para la función de ranking
GRANT EXECUTE ON FUNCTION public.get_ranking_profiles TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_ranking_profiles TO anon;

-- Función para obtener perfiles públicos por IDs (comments, mentions)
CREATE OR REPLACE FUNCTION public.get_profiles_by_ids(
    p_ids UUID[]
) RETURNS TABLE (
    id           UUID,
    username     TEXT,
    display_name TEXT,
    photo_url    TEXT
) LANGUAGE plpgsql SECURITY DEFINER AS $$
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


-- ─── 2. FIX: Restringir cleanup_old_activity ─────────────────
-- Antes cualquier usuario autenticado podía llamar esta función
-- SECURITY DEFINER que borra actividad de TODOS los usuarios.
REVOKE EXECUTE ON FUNCTION public.cleanup_old_activity FROM authenticated;


-- ─── 3. CHECK constraints ────────────────────────────────────

-- item_states: validar categorías
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'item_states_category_check'
    ) THEN
        ALTER TABLE public.item_states
            ADD CONSTRAINT item_states_category_check
            CHECK (category IN ('anime', 'manga', 'novelas', 'listas'));
    END IF;
END $$;

-- progress_keys: validar categorías
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'progress_keys_category_check'
    ) THEN
        ALTER TABLE public.progress_keys
            ADD CONSTRAINT progress_keys_category_check
            CHECK (category IN ('anime', 'manga', 'novelas'));
    END IF;
END $$;

-- profiles: limitar nivel y exp
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'profiles_level_check'
    ) THEN
        ALTER TABLE public.profiles
            ADD CONSTRAINT profiles_level_check CHECK (level BETWEEN 1 AND 50);
    END IF;
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'profiles_exp_check'
    ) THEN
        ALTER TABLE public.profiles
            ADD CONSTRAINT profiles_exp_check CHECK (exp >= 0);
    END IF;
END $$;


-- ─── 4. Index para limpieza global de activity log ────────────
CREATE INDEX IF NOT EXISTS idx_activity_created
    ON public.user_activity_log (created_at);


-- ══════════════════════════════════════════════════════════════
-- 5. TABLA DE COMENTARIOS
-- ══════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.comments (
    id          UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id     UUID         NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    category    TEXT         NOT NULL CHECK (category IN ('anime', 'manga', 'novelas')),
    item_id     TEXT         NOT NULL,
    body        TEXT         NOT NULL CHECK (char_length(body) <= 2000),
    parent_id   UUID         REFERENCES public.comments(id) ON DELETE CASCADE,
    created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- Índice para cargar comentarios de un item rápido
CREATE INDEX IF NOT EXISTS idx_comments_item
    ON public.comments (category, item_id, created_at DESC);

-- Índice para replies (comentarios hijos)
CREATE INDEX IF NOT EXISTS idx_comments_parent
    ON public.comments (parent_id)
    WHERE parent_id IS NOT NULL;


-- ─── RLS ──────────────────────────────────────────────────────
ALTER TABLE public.comments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "comments: read"    ON public.comments;
DROP POLICY IF EXISTS "comments: insert"  ON public.comments;
DROP POLICY IF EXISTS "comments: update"  ON public.comments;
DROP POLICY IF EXISTS "comments: delete"  ON public.comments;

-- Cualquiera puede leer comentarios (logueados y anónimos)
CREATE POLICY "comments: read"
    ON public.comments FOR SELECT USING (true);

-- Solo el propio usuario puede insertar
CREATE POLICY "comments: insert"
    ON public.comments FOR INSERT
    WITH CHECK (auth.uid() = user_id);

-- Solo el propio usuario puede editar su comentario
CREATE POLICY "comments: update"
    ON public.comments FOR UPDATE
    USING (auth.uid() = user_id);

-- Solo el propio usuario puede borrar su comentario
-- (CASCADE borra los replies automáticamente)
CREATE POLICY "comments: delete"
    ON public.comments FOR DELETE
    USING (auth.uid() = user_id);


-- ─── Trigger updated_at ──────────────────────────────────────
DROP TRIGGER IF EXISTS trg_comments_updated_at ON public.comments;
CREATE TRIGGER trg_comments_updated_at
    BEFORE UPDATE ON public.comments
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


-- ─── Permisos ─────────────────────────────────────────────────
GRANT SELECT ON public.comments TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.comments TO authenticated;


-- ══════════════════════════════════════════════════════════════
-- 6. FIX: Search Path Mutable (Supabase Lint 0011)
-- Todas las SECURITY DEFINER functions necesitan SET search_path
-- para evitar ataques de search_path injection.
-- ══════════════════════════════════════════════════════════════

ALTER FUNCTION public.set_updated_at()                SET search_path = public;
ALTER FUNCTION public.handle_new_user()               SET search_path = public;
ALTER FUNCTION public.update_user_stats_on_item_change() SET search_path = public;
ALTER FUNCTION public.add_user_exp(UUID, INT)         SET search_path = public;
ALTER FUNCTION public.upsert_catalog_item(TEXT, TEXT, TEXT, TEXT, TEXT, TEXT) SET search_path = public;
ALTER FUNCTION public.save_item_state_v2(UUID, TEXT, TEXT, BOOLEAN, BOOLEAN, JSONB) SET search_path = public;
ALTER FUNCTION public.log_item_state_change()         SET search_path = public;
ALTER FUNCTION public.log_progress_activity()         SET search_path = public;
ALTER FUNCTION public.cleanup_old_activity()          SET search_path = public;
ALTER FUNCTION public.get_ranking_profiles(INT, INT)  SET search_path = public;
ALTER FUNCTION public.get_profiles_by_ids(UUID[])     SET search_path = public;


-- ══════════════════════════════════════════════════════════════
-- 7. FIX: anon_security_definer_function_executable (Lint 0028)
-- Revocar EXECUTE de funciones SECURITY DEFINER que no necesitan
-- ser accesibles por usuarios anónimos.
-- ══════════════════════════════════════════════════════════════

-- Funciones que SOLO authenticated debe poder llamar:
REVOKE EXECUTE ON FUNCTION public.add_user_exp(UUID, INT) FROM anon;
REVOKE EXECUTE ON FUNCTION public.save_item_state_v2(UUID, TEXT, TEXT, BOOLEAN, BOOLEAN, JSONB) FROM anon;
REVOKE EXECUTE ON FUNCTION public.upsert_catalog_item(TEXT, TEXT, TEXT, TEXT, TEXT, TEXT) FROM anon;
REVOKE EXECUTE ON FUNCTION public.get_profiles_by_ids(UUID[]) FROM anon;
REVOKE EXECUTE ON FUNCTION public.cleanup_old_activity() FROM anon;

-- Funciones internas (triggers): no necesitan ser llamables por nadie vía RPC
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.update_user_stats_on_item_change() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.log_item_state_change() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.log_progress_activity() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.set_updated_at() FROM anon, authenticated;

-- get_ranking_profiles: SÍ debe ser accesible por anon (ranking sin login)
-- Ya tiene GRANT EXECUTE TO anon en la sección de GRANTS.


-- ══════════════════════════════════════════════════════════════
-- 8. FIX: public_bucket_allows_listing (Lint 0025)
-- Bucket avatars: eliminar policy SELECT amplia.
-- Bucket público permite acceso por URL directa sin policy.
-- Sin policy SELECT = sin listing via API.
-- ══════════════════════════════════════════════════════════════

DROP POLICY IF EXISTS "avatars: read public" ON storage.objects;
