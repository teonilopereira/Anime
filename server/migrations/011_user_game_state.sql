-- 011_user_game_state.sql
-- Racha, misiones y Retos sincronizados entre dispositivos.
-- Ejecutar en el SQL Editor de Supabase.
--
-- js/core/game-sync.js guarda acá una copia del estado de juego que vive en
-- localStorage (racha diaria, misiones del día/semana/mes y el reto de hoy),
-- una fila por usuario. Al entrar desde otro dispositivo, el cliente mezcla
-- esta fila con lo local. Si la tabla no existe, la app sigue funcionando
-- solo con localStorage, como antes.

CREATE TABLE IF NOT EXISTS public.user_game_state (
    user_id    UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    data       JSONB NOT NULL DEFAULT '{}'::jsonb,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    -- Tope de tamaño para que nadie use la fila como almacenamiento libre.
    CONSTRAINT user_game_state_data_size CHECK (pg_column_size(data) < 65536)
);

-- ─── RLS: cada usuario solo ve/gestiona su propia fila ───
ALTER TABLE public.user_game_state ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "game_state: select own" ON public.user_game_state;
CREATE POLICY "game_state: select own" ON public.user_game_state
    FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "game_state: insert own" ON public.user_game_state;
CREATE POLICY "game_state: insert own" ON public.user_game_state
    FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "game_state: update own" ON public.user_game_state;
CREATE POLICY "game_state: update own" ON public.user_game_state
    FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "game_state: delete own" ON public.user_game_state;
CREATE POLICY "game_state: delete own" ON public.user_game_state
    FOR DELETE USING (auth.uid() = user_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_game_state TO authenticated;
