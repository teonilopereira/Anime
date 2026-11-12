-- ════════════════════════════════════════════════════════════════
-- 014: Blindaje del registro de actividad + topes de lectura
--
-- Nota de numeración: NO existe una migración 011 (se saltó el
-- número; no falta ningún archivo). El orden de aplicación es
-- 001 … 010, 012, 013, 014.
--
-- Corrige lo que señaló la revisión de Supabase:
--
--   1. user_activity_log tenía la policy "activity: insert own":
--      cualquier usuario logueado podía insertar filas a mano
--      (p. ej. action = 'liked' sobre cualquier obra) y, desde 009,
--      eso aparecía en el muro público. El log lo escribe SOLO el
--      triggers log_item_state_change() y log_progress_activity()
--      (SECURITY DEFINER, corren como
--      owner y no necesitan la policy). El cliente no inserta directo:
--      no hay ninguna referencia a user_activity_log en js/ ni api/.
--      → Se borra la policy y se quita el privilegio INSERT.
--      (Único cambio NO aditivo de esta migración: quita un permiso.)
--
--   2. cleanup_old_activity() (>90 días) existía pero nadie la
--      llamaba. → Job diario de pg_cron, mismo patrón que 010.
--
--   3. get_profiles_by_ids(p_ids) no tenía tope: con un array enorme
--      se podía volcar el padrón (es ejecutable por anon desde 002).
--      → Se usan como máximo los primeros 200 ids. Misma firma.
--
-- Idempotente: se puede correr más de una vez.
-- Ejecutar en Supabase → SQL Editor. Requiere pg_cron (Database →
-- Extensions), igual que 010.
-- ════════════════════════════════════════════════════════════════


-- ─── 1. user_activity_log: solo los triggers escriben ───────────
DROP POLICY IF EXISTS "activity: insert own" ON public.user_activity_log;
REVOKE INSERT ON public.user_activity_log FROM anon, authenticated;


-- ─── 2. Limpieza diaria del registro (>90 días) ─────────────────
CREATE EXTENSION IF NOT EXISTS pg_cron;

SELECT cron.unschedule('activity-cleanup')
WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'activity-cleanup');

SELECT cron.schedule(
    'activity-cleanup',
    '30 4 * * *',
    $$ SELECT public.cleanup_old_activity(); $$
);


-- ─── 3. get_profiles_by_ids: máximo 200 ids por llamada ─────────
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
    MAX_IDS CONSTANT INT := 200;
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

GRANT EXECUTE ON FUNCTION public.get_profiles_by_ids(UUID[]) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_profiles_by_ids(UUID[]) TO anon;


-- ════════════════════════════════════════════════════════════════
-- Verificación rápida (SQL Editor):
--   SELECT policyname FROM pg_policies WHERE tablename = 'user_activity_log';
--     -- solo "activity: read own"
--   SELECT jobname, schedule FROM cron.job WHERE jobname = 'activity-cleanup';
--   SELECT count(*) FROM public.get_profiles_by_ids(
--     ARRAY(SELECT gen_random_uuid() FROM generate_series(1, 500)));  -- 0, sin error
-- ════════════════════════════════════════════════════════════════
