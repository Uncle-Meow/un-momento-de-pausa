-- Simula, en un Postgres local de pruebas, los roles de Supabase y sus permisos por defecto
-- más permisivos, para comprobar
-- que la migración bloquea el acceso aunque el proyecto conceda permisos automáticos.
-- NO ejecutar en Supabase.

create role anon nologin;
create role authenticated nologin;
create role service_role nologin bypassrls;

grant usage on schema public to anon, authenticated, service_role;
alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
alter default privileges in schema public grant all on functions to anon, authenticated, service_role;
