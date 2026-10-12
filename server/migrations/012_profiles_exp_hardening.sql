-- =========================================================================
-- 012: que nadie pueda inflarse el nivel ni la EXP del ranking.
--
-- Antes:
--   * authenticated (y anon) tenían UPDATE/INSERT sobre TODAS las columnas de
--     profiles. RLS solo limita la fila (la propia), así que cualquiera podía
--     hacer update({ level: 50, exp: 999999 }) sobre su perfil desde la consola.
--   * add_user_exp verificaba que el usuario fuese el dueño pero aceptaba
--     cualquier p_delta: add_user_exp(mi_id, 999999999) llevaba al nivel 50.
--   * add_user_exp, save_item_state_v2/v3 y upsert_catalog_item se podían
--     ejecutar como anon (vía PUBLIC). Ya rechazaban sin sesión, pero no tienen
--     por qué estar expuestas.
--
-- Ahora:
--   * El cliente solo puede escribir las columnas que la app realmente edita
--     (saveUserProfile y setApodo en api/supabase-client.js). level, exp,
--     total_likes, total_viewed y updated_stats_at quedan solo para las
--     funciones SECURITY DEFINER y los triggers.
--   * add_user_exp acota cada llamada a [-100, 100] (la suma legítima más
--     grande es la importación de MAL: XP_MAL_IMPORT = 100) y la EXP ganada por
--     día a 2000. Lo que excede se descarta en silencio: el cliente encola EXP
--     sin reintentar ante errores, así que una excepción no aportaba nada.
--     Con la curva de niveles (100 * 1.2^n) llegar al 50 son ~3,8 M de EXP:
--     a 2000 por día, hacer trampa deja de tener sentido.
-- =========================================================================

-- ── 1. Columnas de profiles que el cliente puede escribir ────────────────
-- id va en UPDATE porque el upsert de PostgREST lo repite en el SET; la
-- política "update own" impide cambiarlo por otro.
REVOKE INSERT, UPDATE ON public.profiles FROM anon, authenticated;
-- Por si alguna vez se dieron por columna (el REVOKE de tabla no las toca).
REVOKE INSERT, UPDATE (level, exp, total_likes, total_viewed, updated_stats_at, created_at)
    ON public.profiles FROM anon, authenticated;

GRANT INSERT (id, username, display_name, email, photo_url, provider, apodo, updated_at)
    ON public.profiles TO authenticated;
GRANT UPDATE (id, username, display_name, email, photo_url, provider, apodo, updated_at)
    ON public.profiles TO authenticated;

-- ── 2. Tope diario de EXP ────────────────────────────────────────────────
ALTER TABLE public.profiles
    ADD COLUMN IF NOT EXISTS exp_day       DATE,
    ADD COLUMN IF NOT EXISTS exp_day_total INT NOT NULL DEFAULT 0;

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

-- ── 3. Funciones de escritura: solo con sesión ───────────────────────────
-- REVOKE ... FROM anon no alcanza: el EXECUTE venía de PUBLIC.
REVOKE EXECUTE ON FUNCTION public.add_user_exp(UUID, INT) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.save_item_state_v2(UUID, TEXT, TEXT, BOOLEAN, BOOLEAN, JSONB) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.save_item_state_v3(UUID, TEXT, TEXT, BOOLEAN, BOOLEAN, JSONB, TEXT) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.upsert_catalog_item(TEXT, TEXT, TEXT, TEXT, TEXT, TEXT) FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.add_user_exp(UUID, INT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.save_item_state_v2(UUID, TEXT, TEXT, BOOLEAN, BOOLEAN, JSONB) TO authenticated;
GRANT EXECUTE ON FUNCTION public.save_item_state_v3(UUID, TEXT, TEXT, BOOLEAN, BOOLEAN, JSONB, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.upsert_catalog_item(TEXT, TEXT, TEXT, TEXT, TEXT, TEXT) TO authenticated;
