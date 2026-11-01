-- Operaciones administrativas frecuentes (SQL Editor del panel de Supabase).

-- Cerrar la recepción al terminar la actividad (la función responderá "actividad no disponible").
update public.actividades set abierta = false where id = 'habilidades-liderazgo-2026';

-- Reabrir la recepción.
-- update public.actividades set abierta = true where id = 'habilidades-liderazgo-2026';

-- Crear otra actividad con la misma versión del cuestionario (por ejemplo, otro grupo).
-- insert into public.actividades (id, version_cuestionario) values ('otro-grupo-2026', '2026-11-v2');

-- Registrar una versión nueva del cuestionario si cambian las preguntas. Los ID deben ser los
-- mismos que en js/datos/cuestionario.js, y la versión debe coincidir con "version".
-- insert into public.cuestionario_versiones (version, item_ids) values ('2026-12-v2', '{1,2,3}');

-- Comprobar que anon y authenticated no tienen permisos sobre las tablas.
select grantee, table_name, privilege_type
from information_schema.role_table_grants
where table_schema = 'public'
  and table_name in ('entregas', 'actividades', 'cuestionario_versiones')
order by grantee, table_name, privilege_type;

-- Comprobar que RLS está activo.
select relname, relrowsecurity from pg_class
where relname in ('entregas', 'actividades', 'cuestionario_versiones');

-- Borrar entregas de prueba (solo si hizo pruebas antes de la actividad real).
-- delete from public.entregas where recibida_en < '2026-11-05 00:00:00-06';
