-- ════════════════════════════════════════════════════════════════
-- 008: bucket de Storage para avatares generados con PixelLab
--
-- La Edge Function `generate-avatar` sube los PNG acá y guarda la URL
-- pública en profiles.photo_url. La función usa la service-role key, así
-- que técnicamente no necesita estas policies; se dejan igual como defensa
-- en profundidad por si alguna vez se sube desde el cliente con el JWT.
--
-- Convención de rutas: avatars/<user_id>/<hash>.png
-- Idempotente: se puede correr varias veces sin romper nada.
-- ════════════════════════════════════════════════════════════════

-- Bucket público (lectura anónima de las imágenes; el <img src> las carga
-- directo). La escritura queda gobernada por las policies de abajo.
INSERT INTO storage.buckets (id, name, public)
VALUES ('avatars', 'avatars', true)
ON CONFLICT (id) DO UPDATE SET public = true;

-- Lectura pública de los avatares.
DROP POLICY IF EXISTS "avatars_public_read" ON storage.objects;
CREATE POLICY "avatars_public_read"
    ON storage.objects FOR SELECT
    USING (bucket_id = 'avatars');

-- Cada usuario solo puede escribir/actualizar/borrar dentro de su propia
-- carpeta (el primer segmento de la ruta debe ser su uid).
DROP POLICY IF EXISTS "avatars_owner_insert" ON storage.objects;
CREATE POLICY "avatars_owner_insert"
    ON storage.objects FOR INSERT
    TO authenticated
    WITH CHECK (
        bucket_id = 'avatars'
        AND (storage.foldername(name))[1] = auth.uid()::text
    );

DROP POLICY IF EXISTS "avatars_owner_update" ON storage.objects;
CREATE POLICY "avatars_owner_update"
    ON storage.objects FOR UPDATE
    TO authenticated
    USING (
        bucket_id = 'avatars'
        AND (storage.foldername(name))[1] = auth.uid()::text
    );

DROP POLICY IF EXISTS "avatars_owner_delete" ON storage.objects;
CREATE POLICY "avatars_owner_delete"
    ON storage.objects FOR DELETE
    TO authenticated
    USING (
        bucket_id = 'avatars'
        AND (storage.foldername(name))[1] = auth.uid()::text
    );
