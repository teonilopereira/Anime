-- ════════════════════════════════════════════════════════════════
-- 004: apodo equipado en profiles
--
-- La columna ya existía en la base de producción (se agregó a mano), pero
-- no en server/schema.sql: una base creada desde cero se quedaba sin ella y
-- equipar un apodo fallaba en silencio. Idempotente, se puede correr igual.
-- ════════════════════════════════════════════════════════════════
ALTER TABLE public.profiles
    ADD COLUMN IF NOT EXISTS apodo TEXT DEFAULT 'novato';

-- Nota: el cliente guarda el apodo con UPDATE, no con upsert. Con upsert,
-- Postgres valida username NOT NULL antes de resolver el ON CONFLICT y la
-- escritura revienta con 23502 aunque la fila ya exista.
