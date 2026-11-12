-- ════════════════════════════════════════════════════════════════
-- 015: el ranking informa si cada perfil es público
--
-- js/pages/ranking.js enlaza el nombre de cada jugador a
-- usuario.html?u=<username>. Desde 013 un perfil privado abre un estado
-- vacío, pero get_ranking_profiles() no devolvía is_public y el cliente
-- no podía saberlo: enlazaba a todos. Ahora devuelve is_public y el
-- cliente enlaza SOLO cuando is_public === true.
--
-- El ranking sigue listando a todos (nombre, nivel, EXP, apodo, como
-- desde 005/007): esto no cambia quién aparece, solo a quién se enlaza.
--
-- CREATE OR REPLACE no puede cambiar el tipo de retorno: DROP + CREATE
-- + GRANT, como en 005. Se conservan los topes de 007 (limit 1..100,
-- offset >= 0) y se suma p.id como desempate para un paginado estable.
--
-- Idempotente. Requiere 013 (columna profiles.is_public).
-- Ejecutar en Supabase → SQL Editor.
-- ════════════════════════════════════════════════════════════════
DROP FUNCTION IF EXISTS public.get_ranking_profiles(INT, INT);

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

GRANT EXECUTE ON FUNCTION public.get_ranking_profiles(INT, INT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_ranking_profiles(INT, INT) TO anon;
