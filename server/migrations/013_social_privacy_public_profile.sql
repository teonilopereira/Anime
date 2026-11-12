-- ════════════════════════════════════════════════════════════════
-- 013: Privacidad de la capa social (perfil público + muro)
--
-- Contexto: 009 creó get_activity_feed() y get_public_profile(),
-- ambas SECURITY DEFINER y ejecutables por anon. Las dos devolvían
-- datos de TODOS los usuarios, sin ninguna forma de optar por no
-- aparecer. La preferencia "Perfil público" de configuracion.html
-- (pref:privacidad) vivía solo en localStorage: la base no la conocía.
--
-- Esta migración:
--   1. Agrega profiles.is_public BOOLEAN NOT NULL DEFAULT false.
--      Default CONSERVADOR: nadie queda expuesto en el muro ni en
--      usuario.html?u=<username> hasta que lo active a mano desde
--      Configuración → Privacidad → Perfil público.
--   2. Deja que el dueño escriba SOLO esa columna (grant por columna,
--      igual que 007/012; la policy "profiles: update own" limita la fila).
--   3. Reescribe get_activity_feed() y get_public_profile() con la
--      MISMA firma y tipo de retorno (CREATE OR REPLACE alcanza, el
--      cliente no cambia) pero filtrando por is_public en la base.
--      Un perfil privado y uno inexistente devuelven lo mismo (0 filas):
--      no se puede averiguar si un username existe.
--   4. Acota el offset del muro (anti-volcado) y agrega un índice
--      parcial para el ORDER BY created_at del feed.
--
-- Idempotente y aditiva: se puede correr más de una vez; no borra ni
-- modifica datos existentes. Requiere 009 aplicada.
-- Ejecutar en Supabase → SQL Editor.
-- ════════════════════════════════════════════════════════════════


-- ─── 1. Columna de visibilidad ──────────────────────────────────
ALTER TABLE public.profiles
    ADD COLUMN IF NOT EXISTS is_public BOOLEAN NOT NULL DEFAULT false;

COMMENT ON COLUMN public.profiles.is_public IS
    'Opt-in del usuario: si es true aparece en get_activity_feed() y get_public_profile(). Lo escribe el cliente desde configuracion.html (prefPublic).';


-- ─── 2. El dueño puede cambiar su visibilidad ───────────────────
-- Grant por columna: no reabre level/exp (ver 012). La fila la limita
-- la policy "profiles: update own" (auth.uid() = id).
GRANT UPDATE (is_public) ON public.profiles TO authenticated;
REVOKE UPDATE (is_public) ON public.profiles FROM anon;


-- ─── 3a. get_activity_feed(): solo actividad de perfiles públicos ─
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
    -- Tope de paginado: el muro es "lo reciente", no un histórico completo.
    v_offset INT := LEAST(GREATEST(COALESCE(p_offset, 0), 0), 1000);
BEGIN
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
      AND p.is_public IS TRUE
    ORDER BY a.created_at DESC
    LIMIT v_limit OFFSET v_offset;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_activity_feed(INT, INT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_activity_feed(INT, INT) TO anon;


-- ─── 3b. get_public_profile(): 0 filas si es privado ─────────────
-- Misma firma que 009. El cliente (getPublicProfile) igual descarta
-- id/exp/created_at y se queda con la lista blanca de campos públicos.
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
    WHERE lower(p.username) = lower(btrim(p_username))
      AND p.is_public IS TRUE
    ORDER BY p.created_at ASC
    LIMIT 1;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_public_profile(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_public_profile(TEXT) TO anon;


-- ─── 4. Índice para el ORDER BY del muro ────────────────────────
CREATE INDEX IF NOT EXISTS idx_activity_feed_recent
    ON public.user_activity_log (created_at DESC)
    WHERE action IN ('liked', 'viewed') AND item_id IS NOT NULL;


-- ════════════════════════════════════════════════════════════════
-- FIN — 1 columna, 1 grant por columna, 2 funciones reescritas
-- (misma firma), 1 índice parcial.
--
-- Verificación rápida (SQL Editor):
--   SELECT count(*) FROM public.get_activity_feed(100, 0);   -- 0 hasta que alguien opte
--   UPDATE public.profiles SET is_public = true WHERE id = '<tu uuid>';
--   SELECT * FROM public.get_public_profile('<tu username>'); -- 1 fila
-- ════════════════════════════════════════════════════════════════
