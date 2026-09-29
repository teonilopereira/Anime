-- 010_push_sent_and_cron.sql
-- Registro de avisos ya enviados (para no repetir) y cron de la edge function
-- notify-new-episodes. Ejecutar en el SQL Editor de Supabase después de 008 y
-- de desplegar la función.

CREATE TABLE IF NOT EXISTS public.push_sent (
    user_id    UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    tag        TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (user_id, tag)
);

-- Solo la edge function (service role) la usa: RLS sin políticas = nadie más.
ALTER TABLE public.push_sent ENABLE ROW LEVEL SECURITY;

CREATE EXTENSION IF NOT EXISTS pg_net;
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Cada 15 minutos (la función mira los últimos 20). La clave anónima es la
-- pública de js/core/config.js: alcanza para pasar verify_jwt.
SELECT cron.unschedule('notify-new-episodes')
WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'notify-new-episodes');

SELECT cron.schedule(
    'notify-new-episodes',
    '*/15 * * * *',
    $$
    SELECT net.http_post(
        url := 'https://llytokoztnjuczuppzgs.supabase.co/functions/v1/notify-new-episodes',
        headers := jsonb_build_object(
            'Content-Type', 'application/json',
            'Authorization', 'Bearer ' || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxseXRva296dG5qdWN6dXBwemdzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODAwMTE2MTcsImV4cCI6MjA5NTU4NzYxN30.jKU5ZoweR3v5TPyn_4TNs6W01Cns3xEZOkleZGg1UNg'
        ),
        body := '{}'::jsonb
    );
    $$
);

-- Limpieza semanal del registro de enviados.
SELECT cron.unschedule('push-sent-cleanup')
WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'push-sent-cleanup');

SELECT cron.schedule(
    'push-sent-cleanup',
    '0 4 * * 0',
    $$ DELETE FROM public.push_sent WHERE created_at < now() - interval '7 days'; $$
);
