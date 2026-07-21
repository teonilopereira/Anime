-- ════════════════════════════════════════════════════════════════
-- 005: apodo equipado en el ranking
--
-- top.html ya sabe pintar el apodo debajo del nombre (rank-player-apodo),
-- pero get_ranking_profiles() no devolvia la columna, asi que la fila
-- llegaba sin apodo y nunca se mostraba. Se agrega al RETURNS TABLE.
--
-- CREATE OR REPLACE no puede cambiar el tipo de retorno de una funcion:
-- hay que dropearla primero (los GRANT se pierden y se rehacen abajo).
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
    apodo        TEXT
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
        p.exp,
        p.apodo
    FROM public.profiles p
    ORDER BY p.level DESC, p.exp DESC, p.total_likes DESC
    LIMIT p_limit OFFSET p_offset;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_ranking_profiles TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_ranking_profiles TO anon;
