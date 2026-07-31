-- ════════════════════════════════════════════════════════════════
-- 007: Blindaje de integridad del ranking + límites de scraping
--
-- Corrige tres debilidades detectadas en la revisión de seguridad:
--
--   1. profiles: las columnas de progresión (level, exp, total_likes,
--      total_viewed) eran escribibles directamente por el cliente vía
--      UPDATE, salteando add_user_exp() y los logros. Ahora el rol
--      `authenticated` solo puede tocar columnas de perfil "cosméticas";
--      la progresión queda exclusivamente en manos de las funciones
--      SECURITY DEFINER (que corren como owner y no dependen de estos
--      grants).
--
--   2. get_ranking_profiles(): p_limit sin tope permitía volcar el
--      padrón completo de usuarios en una sola llamada (incluso anon).
--      Se acota el rango de p_limit / p_offset dentro de la función.
--
-- Idempotente: se puede correr más de una vez sin efectos adversos.
-- ════════════════════════════════════════════════════════════════

-- ─── 1. profiles: grants a nivel de columna ─────────────────────
-- Quitamos el UPDATE amplio y lo devolvemos SOLO sobre las columnas
-- que el cliente edita legítimamente (perfil y apodo equipado).
-- level / exp / total_likes / total_viewed / updated_stats_at quedan
-- fuera: solo add_user_exp() y los triggers (SECURITY DEFINER, dueños
-- de la tabla) pueden modificarlas.
REVOKE UPDATE ON public.profiles FROM authenticated;

GRANT UPDATE (
    username,
    display_name,
    email,
    photo_url,
    provider,
    apodo,
    updated_at
) ON public.profiles TO authenticated;

-- Nota: INSERT sigue siendo a nivel de tabla (necesario para el upsert
-- inicial del perfil vía handle_new_user / saveProfile). La policy
-- "profiles: insert own" ya restringe la fila a auth.uid() = id.


-- ─── 2. get_ranking_profiles: acotar p_limit / p_offset ─────────
-- Mismo tipo de retorno que 005 (incluye apodo), así que CREATE OR
-- REPLACE alcanza y conserva los GRANT existentes.
CREATE OR REPLACE FUNCTION public.get_ranking_profiles(
    p_limit  INT DEFAULT 50,
    p_offset INT DEFAULT 0
) RETURNS TABLE (
    id           UUID,
    username     TEXT,
    display_name TEXT,
    photo_url    TEXT,
    level        INT,
    exp          INT,
    apodo        TEXT
) LANGUAGE plpgsql SECURITY DEFINER
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
        p.apodo
    FROM public.profiles p
    ORDER BY p.level DESC, p.exp DESC, p.total_likes DESC
    LIMIT v_limit OFFSET v_offset;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_ranking_profiles TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_ranking_profiles TO anon;


-- ════════════════════════════════════════════════════════════════
-- FIN 007
-- ════════════════════════════════════════════════════════════════
