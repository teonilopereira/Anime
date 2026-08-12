-- ════════════════════════════════════════════════════════════════
-- 009: Fase 1 — Capa social
--
-- Tres piezas que convierten el tracking en comunidad, todas sobre
-- tablas que YA existen (comments, user_activity_log, profiles):
--
--   1. comment_likes  → reacciones (me gusta) en comentarios.
--   2. get_activity_feed() → muro público "X marcó/likeó tal obra".
--   3. get_public_profile() → perfil visible para otros usuarios.
--
-- Filosofía consistente con el schema base:
--   • Contadores incrementales O(1) vía trigger (no COUNT(*)).
--   • Lecturas cruzadas entre usuarios SOLO por funciones
--     SECURITY DEFINER que exponen campos públicos (nunca email).
--   • RLS estricto: cada quien escribe/borra lo suyo.
--
-- Ejecutar en el SQL Editor de Supabase.
-- ════════════════════════════════════════════════════════════════


-- ════════════════════════════════════════════════════════════════
-- 1. COMMENT_LIKES — "me gusta" en comentarios
--    PK (comment_id, user_id): un like por persona por comentario,
--    idempotente por diseño (un segundo INSERT choca con la PK).
-- ════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS public.comment_likes (
    comment_id UUID        NOT NULL REFERENCES public.comments(id) ON DELETE CASCADE,
    user_id    UUID        NOT NULL REFERENCES auth.users(id)      ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (comment_id, user_id)
);

-- Contador desnormalizado en el propio comentario (se mantiene por trigger).
-- Evita un COUNT(*) por comentario al pintar la lista.
ALTER TABLE public.comments
    ADD COLUMN IF NOT EXISTS likes_count INT NOT NULL DEFAULT 0;

ALTER TABLE public.comment_likes ENABLE ROW LEVEL SECURITY;

-- Lectura pública: cualquiera puede ver quién likeó (necesario para que el
-- usuario logueado sepa cuáles marcó él mismo).
DROP POLICY IF EXISTS "comment_likes: read"   ON public.comment_likes;
CREATE POLICY "comment_likes: read"
    ON public.comment_likes FOR SELECT
    USING (true);

-- Solo se puede likear en nombre propio.
DROP POLICY IF EXISTS "comment_likes: insert own" ON public.comment_likes;
CREATE POLICY "comment_likes: insert own"
    ON public.comment_likes FOR INSERT
    WITH CHECK (auth.uid() = user_id);

-- Solo se puede quitar el propio like.
DROP POLICY IF EXISTS "comment_likes: delete own" ON public.comment_likes;
CREATE POLICY "comment_likes: delete own"
    ON public.comment_likes FOR DELETE
    USING (auth.uid() = user_id);


-- ────────────────────────────────────────────────────────────────
-- Trigger: mantiene comments.likes_count en O(1).
--    GREATEST(0, ...) evita negativos si algo se desincroniza.
-- ────────────────────────────────────────────────────────────────
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

-- Índice para "¿qué likeó este usuario?" (marca el corazón lleno al cargar).
CREATE INDEX IF NOT EXISTS idx_comment_likes_user
    ON public.comment_likes (user_id, comment_id);


-- ════════════════════════════════════════════════════════════════
-- 2. get_activity_feed() — Muro de actividad pública
--    Cruza user_activity_log con profiles y catalog_items para
--    devolver un feed listo para pintar: quién, qué acción, sobre
--    qué obra (con título e imagen).
--
--    Solo expone acciones "presentables" (liked / viewed): el resto
--    del log (unliked, item_removed, progress_updated…) es ruido de
--    auditoría que no aporta al muro.
--
--    SECURITY DEFINER: user_activity_log tiene RLS "read own", así
--    que un SELECT directo solo vería lo propio. La función bypasea
--    RLS pero devuelve únicamente campos públicos (nunca email).
-- ════════════════════════════════════════════════════════════════
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
) LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public AS $$
BEGIN
    -- Tope defensivo: nadie pide más de 100 de una.
    IF p_limit IS NULL OR p_limit > 100 THEN p_limit := 100; END IF;
    IF p_limit < 1 THEN p_limit := 1; END IF;
    IF p_offset IS NULL OR p_offset < 0 THEN p_offset := 0; END IF;

    RETURN QUERY
    SELECT
        a.user_id,
        p.username,
        p.display_name,
        p.photo_url,
        a.action,
        a.category,
        a.item_id,
        c.titulo,
        c.img,
        a.created_at
    FROM public.user_activity_log a
    JOIN public.profiles p       ON p.id = a.user_id
    LEFT JOIN public.catalog_items c
           ON c.category = a.category AND c.id = a.item_id
    WHERE a.action IN ('liked', 'viewed')
      AND a.item_id IS NOT NULL
    ORDER BY a.created_at DESC
    LIMIT p_limit OFFSET p_offset;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_activity_feed(INT, INT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_activity_feed(INT, INT) TO anon;


-- ════════════════════════════════════════════════════════════════
-- 3. get_public_profile() — Perfil visible por otros
--    Busca por username y devuelve la tarjeta pública (con stats de
--    gamificación). No expone email ni provider.
--    Reutilizable para la futura ruta usuario.html?u=<username>.
-- ════════════════════════════════════════════════════════════════
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
        p.apodo,
        p.total_likes,
        p.total_viewed,
        p.created_at
    FROM public.profiles p
    WHERE lower(p.username) = lower(p_username)
    ORDER BY p.created_at ASC
    LIMIT 1;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_public_profile(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_public_profile(TEXT) TO anon;


-- ════════════════════════════════════════════════════════════════
-- GRANTS / REVOKES
-- ════════════════════════════════════════════════════════════════

-- comment_likes: leer todos; escribir/borrar lo propio (lo filtra RLS).
GRANT SELECT                 ON public.comment_likes TO anon;
GRANT SELECT, INSERT, DELETE ON public.comment_likes TO authenticated;

-- El trigger no debe ser invocable como RPC.
REVOKE EXECUTE ON FUNCTION public.update_comment_likes_count() FROM anon, authenticated;


-- ════════════════════════════════════════════════════════════════
-- FIN — 1 tabla, 1 columna, 3 funciones (2 RPC + 1 trigger), 1 índice
-- ════════════════════════════════════════════════════════════════
