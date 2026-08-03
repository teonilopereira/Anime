-- 008_push_subscriptions.sql
-- Suscripciones Web Push para avisar de nuevos episodios.
-- Ejecutar en el SQL Editor de Supabase.
--
-- El navegador guarda acá su endpoint + claves (vía js/core/push.js). La edge
-- function server/functions/notify-new-episodes lee esta tabla con la service
-- role key (bypasea RLS) y manda las notificaciones con la clave privada VAPID.

CREATE TABLE IF NOT EXISTS public.push_subscriptions (
    id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id    UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    endpoint   TEXT NOT NULL UNIQUE,
    p256dh     TEXT NOT NULL,
    auth       TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS push_subscriptions_user_id_idx
    ON public.push_subscriptions (user_id);

-- updated_at automático (misma función set_updated_at del schema base).
DROP TRIGGER IF EXISTS push_subscriptions_set_updated_at ON public.push_subscriptions;
CREATE TRIGGER push_subscriptions_set_updated_at
    BEFORE UPDATE ON public.push_subscriptions
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ─── RLS: cada usuario solo ve/gestiona sus propias suscripciones ───
ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "push: select own" ON public.push_subscriptions;
CREATE POLICY "push: select own" ON public.push_subscriptions
    FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "push: insert own" ON public.push_subscriptions;
CREATE POLICY "push: insert own" ON public.push_subscriptions
    FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "push: update own" ON public.push_subscriptions;
CREATE POLICY "push: update own" ON public.push_subscriptions
    FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "push: delete own" ON public.push_subscriptions;
CREATE POLICY "push: delete own" ON public.push_subscriptions
    FOR DELETE USING (auth.uid() = user_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.push_subscriptions TO authenticated;
