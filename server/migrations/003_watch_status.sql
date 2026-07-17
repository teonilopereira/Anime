-- ════════════════════════════════════════════════════════════════
-- Migración 003: estados de seguimiento (watch_status)
--
-- Agrega la columna watch_status a item_states, crea el RPC
-- save_item_state_v3 (basado en save_item_state_v2 de schema.sql)
-- y recrea la vista item_states_with_details con la columna nueva.
--
-- Cómo aplicarla: pegá este archivo completo en el SQL Editor de
-- Supabase (Dashboard → SQL Editor → New query) y ejecutalo.
-- Es idempotente: se puede correr más de una vez.
--
-- Valores de watch_status:
--   '' (sin estado) | 'viendo' | 'pendiente' | 'pausado' | 'abandonado'
--
-- La app funciona sin esta migración (el estado queda solo en el
-- navegador); al aplicarla se sincroniza entre dispositivos.
-- ════════════════════════════════════════════════════════════════

-- 1. Columna nueva
ALTER TABLE public.item_states
    ADD COLUMN IF NOT EXISTS watch_status TEXT NOT NULL DEFAULT ''
    CHECK (watch_status IN ('', 'viendo', 'pendiente', 'pausado', 'abandonado'));

-- 2. RPC v3 — copia de save_item_state_v2 + watch_status.
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

GRANT EXECUTE ON FUNCTION public.save_item_state_v3 TO authenticated;
REVOKE EXECUTE ON FUNCTION public.save_item_state_v3(UUID, TEXT, TEXT, BOOLEAN, BOOLEAN, JSONB, TEXT) FROM anon;
ALTER FUNCTION public.save_item_state_v3(UUID, TEXT, TEXT, BOOLEAN, BOOLEAN, JSONB, TEXT) SET search_path = public;

-- 3. Vista con la columna nueva (mismas columnas que schema.sql + watch_status)
DROP VIEW IF EXISTS public.item_states_with_details;
CREATE VIEW public.item_states_with_details AS
SELECT
    s.user_id,
    s.category,
    s.item_id  AS id,
    s.fav,
    s.viewed,
    s.watch_status,
    s.updated_at,
    c.titulo,
    c.img,
    c.info,
    c.status
FROM public.item_states s
LEFT JOIN public.catalog_items c ON c.category = s.category AND c.id = s.item_id;

ALTER VIEW public.item_states_with_details SET (security_invoker = true);
GRANT SELECT ON public.item_states_with_details TO authenticated;
