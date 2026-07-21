-- ════════════════════════════════════════════════════════════════
-- 006: marca de spoiler en comentarios
--
-- Los comentarios se pueden apuntar a un episodio o volumen puntual
-- (migración 002), asi que "el final del ep 25 me rompio" le aparecia tal
-- cual a alguien que va por el 3.
--
-- La marca manual cubre el caso obvio, pero el tapado automatico no necesita
-- esta columna: el cliente compara ref_number contra el progreso que ya lleva
-- el usuario. Por eso el default es false y nadie esta obligado a marcar nada.
-- ════════════════════════════════════════════════════════════════
ALTER TABLE public.comments
    ADD COLUMN IF NOT EXISTS spoiler BOOLEAN NOT NULL DEFAULT false;
