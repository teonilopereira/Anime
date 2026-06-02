-- ================================================================
-- schema-supabase.sql
-- Tablas necesarias en Supabase (PostgreSQL) para el proyecto
-- Ejecutar en el SQL Editor de tu proyecto en supabase.com
-- ================================================================

-- ────────────────────────────────────────────────────────────────
-- 1. PROFILES
--    Almacena los datos del usuario sincronizados con auth.users.
--    Se crea automáticamente al iniciar sesión con Google.
-- ────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.profiles (
  id           UUID        PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  username     TEXT        NOT NULL,
  display_name TEXT,
  email        TEXT,
  photo_url    TEXT,
  provider     TEXT        NOT NULL DEFAULT 'google',
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Actualizar updated_at automáticamente
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

CREATE OR REPLACE TRIGGER trg_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Row Level Security: cada usuario sólo accede a su propio perfil
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "profiles: read own"
  ON public.profiles FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "profiles: upsert own"
  ON public.profiles FOR INSERT
  WITH CHECK (auth.uid() = id);

CREATE POLICY "profiles: update own"
  ON public.profiles FOR UPDATE
  USING (auth.uid() = id);


-- ────────────────────────────────────────────────────────────────
-- 2. ITEM_STATES
--    Guarda si un ítem (anime, manga, novela, juego) está marcado
--    como favorito o como visto por el usuario.
-- ────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.item_states (
  user_id    UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  category   TEXT        NOT NULL,   -- 'anime' | 'manga' | 'novelas' | 'juegos'
  item_id    TEXT        NOT NULL,
  fav        BOOLEAN     NOT NULL DEFAULT FALSE,
  viewed     BOOLEAN     NOT NULL DEFAULT FALSE,
  meta       JSONB       NOT NULL DEFAULT '{}',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, category, item_id)
);

-- Evitar que usuarios malintencionados saturen la base de datos con JSON gigantes
ALTER TABLE public.item_states ADD CONSTRAINT meta_size_limit CHECK (octet_length(meta::text) < 5000);

CREATE OR REPLACE TRIGGER trg_item_states_updated_at
  BEFORE UPDATE ON public.item_states
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.item_states ENABLE ROW LEVEL SECURITY;

CREATE POLICY "item_states: read own"
  ON public.item_states FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "item_states: insert own"
  ON public.item_states FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "item_states: update own"
  ON public.item_states FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "item_states: delete own"
  ON public.item_states FOR DELETE
  USING (auth.uid() = user_id);


-- ────────────────────────────────────────────────────────────────
-- 3. PROGRESS_KEYS
--    Registra el progreso a nivel de episodio o capítulo.
--    Cada fila representa una "clave de progreso" marcada como
--    vista (value = true) o no vista (se elimina la fila).
--
--    Formato de pkey (ejemplos):
--      's:1|ep:3'   → Temporada 1, Episodio 3 (anime)
--      'ch:12'      → Capítulo 12 (manga)
--      'vol:2'      → Volumen 2 (manga)
-- ────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.progress_keys (
  user_id    UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  category   TEXT        NOT NULL,
  item_id    TEXT        NOT NULL,
  pkey       TEXT        NOT NULL,
  value      BOOLEAN     NOT NULL DEFAULT FALSE,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, category, item_id, pkey)
);

CREATE OR REPLACE TRIGGER trg_progress_keys_updated_at
  BEFORE UPDATE ON public.progress_keys
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.progress_keys ENABLE ROW LEVEL SECURITY;

CREATE POLICY "progress_keys: read own"
  ON public.progress_keys FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "progress_keys: insert own"
  ON public.progress_keys FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "progress_keys: update own"
  ON public.progress_keys FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "progress_keys: delete own"
  ON public.progress_keys FOR DELETE
  USING (auth.uid() = user_id);


-- ────────────────────────────────────────────────────────────────
-- 4. AUTOMATIC PROFILE CREATION TRIGGER
--    Crea automáticamente un perfil en public.profiles cuando un
--    usuario se registra en auth.users (vía Email o Google).
--    Ejecutar esto en el SQL Editor de Supabase.
-- ────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  username_val TEXT;
  display_name_val TEXT;
  provider_val TEXT;
  photo_url_val TEXT;
BEGIN
  -- Obtener el nombre de usuario desde los metadatos o fallback a email
  username_val := COALESCE(
    NEW.raw_user_meta_data->>'username',
    NEW.raw_user_meta_data->>'full_name',
    NEW.raw_user_meta_data->>'name',
    split_part(NEW.email, '@', 1)
  );

  display_name_val := COALESCE(
    NEW.raw_user_meta_data->>'full_name',
    NEW.raw_user_meta_data->>'name',
    username_val
  );

  photo_url_val := COALESCE(
    NEW.raw_user_meta_data->>'avatar_url',
    NEW.raw_user_meta_data->>'picture',
    ''
  );

  -- Determinar el proveedor
  IF NEW.raw_app_meta_data->>'provider' IS NOT NULL THEN
    provider_val := NEW.raw_app_meta_data->>'provider';
  ELSE
    provider_val := 'email';
  END IF;

  INSERT INTO public.profiles (id, username, display_name, email, photo_url, provider)
  VALUES (
    NEW.id,
    username_val,
    display_name_val,
    NEW.email,
    photo_url_val,
    provider_val
  )
  ON CONFLICT (id) DO UPDATE
  SET
    username = EXCLUDED.username,
    display_name = EXCLUDED.display_name,
    email = EXCLUDED.email,
    photo_url = EXCLUDED.photo_url,
    provider = EXCLUDED.provider,
    updated_at = NOW();

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger asociado
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
