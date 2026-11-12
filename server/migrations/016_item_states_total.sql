-- ════════════════════════════════════════════════════════════════
-- 016: total de episodios/capítulos/volúmenes en item_states
--
-- El cliente ya sabe leer `total` de item_states_with_details
-- (mapItemStateRow en api/supabase-client.js lo pone en meta.total),
-- pero la columna no existía: el total solo vivía en el navegador.
--
--   1. item_states.total INTEGER, NULL permitido (= desconocido).
--   2. item_states_with_details expone total (y sigue con watch_status).
--   3. save_item_state_v4 = v3 + p_total. v3 y v2 NO se tocan: el
--      cliente usa v4 cuando hay meta.total > 0 y, si la base no
--      tiene v4 (016 sin aplicar), cae a v3 / v2 como antes.
--
--   Diferencia con v3 a propósito: en v4, p_watch_status y p_total en
--   NULL significan "no tocar" (se conserva lo guardado). Así guardar
--   solo el total no borra el estado de seguimiento, y viceversa.
--
-- Idempotente y aditiva. Requiere 003 (watch_status).
-- Ejecutar en Supabase → SQL Editor.
-- ════════════════════════════════════════════════════════════════

-- ─── 1. Columna ─────────────────────────────────────────────────
ALTER TABLE public.item_states
    ADD COLUMN IF NOT EXISTS total INTEGER;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'item_states_total_check'
    ) THEN
        ALTER TABLE public.item_states
            ADD CONSTRAINT item_states_total_check
            CHECK (total IS NULL OR total BETWEEN 1 AND 100000);
    END IF;
END $$;


-- ─── 2. Vista con total ─────────────────────────────────────────
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
    c.status,
    s.total
FROM public.item_states s
LEFT JOIN public.catalog_items c ON c.category = s.category AND c.id = s.item_id;

ALTER VIEW public.item_states_with_details SET (security_invoker = true);
GRANT SELECT ON public.item_states_with_details TO authenticated;


-- ─── 3. save_item_state_v4 ──────────────────────────────────────
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

REVOKE EXECUTE ON FUNCTION public.save_item_state_v4(UUID, TEXT, TEXT, BOOLEAN, BOOLEAN, JSONB, TEXT, INTEGER) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.save_item_state_v4(UUID, TEXT, TEXT, BOOLEAN, BOOLEAN, JSONB, TEXT, INTEGER) TO authenticated;
