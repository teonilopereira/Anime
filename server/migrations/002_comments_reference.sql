-- 002_comments_reference.sql
-- Agrega soporte para referencia (episodio/volumen/chapter) en comentarios.
-- Ejecutar en SQL Editor de Supabase.

-- 1. Columnas de referencia
ALTER TABLE public.comments
    ADD COLUMN IF NOT EXISTS ref_type TEXT
        CHECK (ref_type IN ('episode', 'volume', 'chapter'));

ALTER TABLE public.comments
    ADD COLUMN IF NOT EXISTS ref_number INTEGER
        CHECK (ref_number > 0);

-- 2. Constraint: ambos juntos o ambos null
ALTER TABLE public.comments
    ADD CONSTRAINT comments_ref_check
    CHECK (
        (ref_type IS NULL AND ref_number IS NULL)
        OR
        (ref_type IS NOT NULL AND ref_number IS NOT NULL)
    );

-- 3. Index para filtrar por referencia
CREATE INDEX IF NOT EXISTS idx_comments_ref
    ON public.comments (category, item_id, ref_type, ref_number);

-- 4. Permitir que anónicos vean nombres de autores
GRANT EXECUTE ON FUNCTION public.get_profiles_by_ids(UUID[]) TO anon;
