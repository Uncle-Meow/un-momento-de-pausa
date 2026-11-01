-- Pruebas de la migración en un Postgres local (ver pruebas/README-pruebas.md).
-- Cada bloque lanza una excepción si el comportamiento no es el esperado.
\set ON_ERROR_STOP on

create schema if not exists prueba;

create or replace function prueba.espera_error(p_rol text, p_sql text, p_esperado text)
returns void language plpgsql as $$
declare
  v_estado text;
  v_mensaje text;
begin
  execute format('set local role %I', p_rol);
  begin
    execute p_sql;
  exception when others then
    get stacked diagnostics v_estado = returned_sqlstate, v_mensaje = message_text;
    reset role;
    if v_estado = p_esperado or v_mensaje = p_esperado then
      raise notice 'OK  [%] % -> % (%)', p_rol, left(p_sql, 70), v_estado, v_mensaje;
      return;
    end if;
    raise exception 'FALLO [%] %: se esperaba %, se obtuvo % (%)', p_rol, p_sql, p_esperado, v_estado, v_mensaje;
  end;
  reset role;
  raise exception 'FALLO [%] %: se esperaba el error %, pero la sentencia funcionó', p_rol, p_sql, p_esperado;
end $$;

-- Respuestas válidas de la versión 2026-11-v2
create or replace function prueba.r(p jsonb default '{}') returns jsonb language sql as $$
  select '{"1":3,"3":3,"4":3,"7":3,"8":3,"11":3,"13":3,"15":3,"16":3,"17":3}'::jsonb || p
$$;
grant usage on schema prueba to anon, authenticated, service_role;
grant execute on all functions in schema prueba to anon, authenticated, service_role;

begin;

-- 1. La Edge Function (service_role) inserta una entrega válida; la fecha la fija el servidor.
set local role service_role;
insert into public.entregas (id, actividad_id, version_cuestionario, respuestas, recibida_en)
values ('11111111-1111-4111-8111-111111111111', 'habilidades-liderazgo-2026', '2026-11-v2', prueba.r(), '2000-01-01');
do $$ begin
  if (select recibida_en < now() - interval '1 minute' from public.entregas where id = '11111111-1111-4111-8111-111111111111') then
    raise exception 'FALLO: recibida_en no la fijó el servidor';
  end if;
  raise notice 'OK  inserción válida con fecha del servidor';
end $$;
reset role;

-- 2. Mismo identificador: violación de unicidad (la función la convierte en reintento idempotente).
select prueba.espera_error('service_role',
  $q$insert into public.entregas (id, actividad_id, version_cuestionario, respuestas) values ('11111111-1111-4111-8111-111111111111','habilidades-liderazgo-2026','2026-11-v2', prueba.r())$q$,
  '23505');

-- 3. Datos inválidos rechazados por el disparador.
select prueba.espera_error('service_role',
  $q$insert into public.entregas values (gen_random_uuid(),'habilidades-liderazgo-2026','2026-11-v2', prueba.r() - '17')$q$,
  'respuestas_incompletas');
select prueba.espera_error('service_role',
  $q$insert into public.entregas values (gen_random_uuid(),'habilidades-liderazgo-2026','2026-11-v2', prueba.r('{"20":2}'))$q$,
  'id_pregunta_no_valido');
select prueba.espera_error('service_role',
  $q$insert into public.entregas values (gen_random_uuid(),'habilidades-liderazgo-2026','2026-11-v2', prueba.r('{"4":6}'))$q$,
  'valor_no_valido');
select prueba.espera_error('service_role',
  $q$insert into public.entregas values (gen_random_uuid(),'habilidades-liderazgo-2026','2026-11-v2', prueba.r('{"4":0}'))$q$,
  'valor_no_valido');
select prueba.espera_error('service_role',
  $q$insert into public.entregas values (gen_random_uuid(),'habilidades-liderazgo-2026','2026-11-v2', prueba.r('{"4":3.5}'))$q$,
  'valor_no_valido');
select prueba.espera_error('service_role',
  $q$insert into public.entregas values (gen_random_uuid(),'habilidades-liderazgo-2026','2026-11-v2', prueba.r('{"4":3.0}'))$q$,
  'valor_no_valido');
select prueba.espera_error('service_role',
  $q$insert into public.entregas values (gen_random_uuid(),'habilidades-liderazgo-2026','2026-11-v2', prueba.r('{"4":"3"}'))$q$,
  'valor_no_valido');
select prueba.espera_error('service_role',
  $q$insert into public.entregas values (gen_random_uuid(),'habilidades-liderazgo-2026','2026-11-v2', '[3,3,3]')$q$,
  'respuestas_no_validas');
select prueba.espera_error('service_role',
  $q$insert into public.entregas values (gen_random_uuid(),'actividad-inexistente','2026-11-v2', prueba.r())$q$,
  'actividad_no_disponible');

-- 4. Entregas inmutables y sin borrado desde la API, incluso para service_role.
select prueba.espera_error('service_role', $q$update public.entregas set respuestas = prueba.r('{"1":5}')$q$, '42501');
select prueba.espera_error('service_role', $q$delete from public.entregas$q$, '42501');

-- 5. Participantes (anon) y usuarios autenticados: sin ningún acceso.
select prueba.espera_error('anon', $q$select * from public.entregas$q$, '42501');
select prueba.espera_error('anon', $q$insert into public.entregas values (gen_random_uuid(),'habilidades-liderazgo-2026','2026-11-v2', prueba.r())$q$, '42501');
select prueba.espera_error('anon', $q$update public.entregas set actividad_id = 'x'$q$, '42501');
select prueba.espera_error('anon', $q$delete from public.entregas$q$, '42501');
select prueba.espera_error('anon', $q$select * from public.actividades$q$, '42501');
select prueba.espera_error('anon', $q$select * from public.cuestionario_versiones$q$, '42501');
select prueba.espera_error('authenticated', $q$select * from public.entregas$q$, '42501');
select prueba.espera_error('authenticated', $q$insert into public.entregas values (gen_random_uuid(),'habilidades-liderazgo-2026','2026-11-v2', prueba.r())$q$, '42501');
select prueba.espera_error('authenticated', $q$delete from public.entregas$q$, '42501');

-- 6. Defensa en profundidad: aunque por error se concediera SELECT a anon, RLS sin políticas
--    no devuelve filas.
grant select, delete on public.entregas to anon;
set local role anon;
do $$ begin
  if (select count(*) from public.entregas) <> 0 then raise exception 'FALLO: RLS permitió leer filas'; end if;
  delete from public.entregas;
  raise notice 'OK  RLS sin políticas: 0 filas visibles y 0 borradas para anon aun con permisos';
end $$;
reset role;
revoke select, delete on public.entregas from anon;
do $$ begin
  if (select count(*) from public.entregas) <> 1 then raise exception 'FALLO: se borró una entrega'; end if;
end $$;

-- 7. Cierre de la actividad.
update public.actividades set abierta = false where id = 'habilidades-liderazgo-2026';
select prueba.espera_error('service_role',
  $q$insert into public.entregas values (gen_random_uuid(),'habilidades-liderazgo-2026','2026-11-v2', prueba.r())$q$,
  'actividad_no_disponible');

-- 8. La versión debe corresponder a la actividad.
update public.actividades set abierta = true where id = 'habilidades-liderazgo-2026';
insert into public.cuestionario_versiones (version, item_ids) values ('prueba-v2', '{1,2}');
select prueba.espera_error('service_role',
  $q$insert into public.entregas values (gen_random_uuid(),'habilidades-liderazgo-2026','prueba-v2', '{"1":1,"2":2}')$q$,
  'version_no_corresponde');

rollback;

-- 9. Exportación: la consulta del responsable funciona y calcula total y promedio.
begin;
insert into public.entregas (id, actividad_id, version_cuestionario, respuestas)
values ('22222222-2222-4222-8222-222222222222', 'habilidades-liderazgo-2026', '2026-11-v2',
        '{"1":1,"3":1,"4":1,"7":1,"8":1,"11":1,"13":1,"15":1,"16":1,"17":1}'),
       ('33333333-3333-4333-8333-333333333333', 'habilidades-liderazgo-2026', '2026-11-v2',
        '{"1":5,"3":5,"4":5,"7":5,"8":5,"11":5,"13":5,"15":5,"16":5,"17":5}');
\i supabase/sql/exportar_respuestas.sql
rollback;

\echo 'TODAS LAS PRUEBAS SQL TERMINARON SIN FALLOS'
