-- Diez preguntas depuradas. Registrar una versión NUEVA conserva las entregas v1.
-- Ejecutar después de 20261101120000_crear_entregas.sql.
begin;

insert into public.cuestionario_versiones (version, item_ids)
values ('2026-11-v2', '{1,3,4,7,8,11,13,15,16,17}')
on conflict (version) do nothing;

do $$ begin
  if (select item_ids from public.cuestionario_versiones where version = '2026-11-v2')
      is distinct from array[1,3,4,7,8,11,13,15,16,17]::smallint[] then
    raise exception 'La versión 2026-11-v2 ya existe con otros ID; no se modifica el histórico';
  end if;
end $$;

insert into public.actividades (id, version_cuestionario, abierta)
values ('habilidades-liderazgo-2026', '2026-11-v2', true)
on conflict (id) do update
  set version_cuestionario = excluded.version_cuestionario;
-- Si la actividad estaba cerrada, permanece cerrada.

commit;
