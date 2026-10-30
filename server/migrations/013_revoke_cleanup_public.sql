-- 013_revoke_cleanup_public.sql
-- cleanup_old_activity() borra el log de actividad de más de 90 días de TODOS
-- los usuarios y es SECURITY DEFINER. 001 le sacó EXECUTE a authenticated y a
-- anon, pero ese permiso venía de PUBLIC (el default de Postgres para toda
-- función nueva), así que cualquiera con la anon key la seguía pudiendo llamar.
-- Es el mismo caso que 012 arregló para add_user_exp y compañía.
--
-- Queda solo para postgres/service_role (SQL Editor o un cron).
--
-- get_profiles_by_ids NO se toca: 002 le da EXECUTE a anon a propósito, para
-- mostrar los autores de los comentarios a quien no inició sesión.

REVOKE EXECUTE ON FUNCTION public.cleanup_old_activity() FROM PUBLIC, anon, authenticated;

-- Verificación (las dos tienen que dar false):
--   SELECT has_function_privilege('anon', 'public.cleanup_old_activity()', 'execute');
--   SELECT has_function_privilege('authenticated', 'public.cleanup_old_activity()', 'execute');
