-- ============================================================================
-- Un momento de pausa: almacenamiento privado de entregas.
--
-- Modelo de acceso:
--   * Los participantes nunca hablan con la base de datos. El navegador envía la entrega a la
--     Edge Function "registrar-entrega", que valida y escribe con la clave secreta del backend.
--   * anon y authenticated no tienen permisos sobre ninguna tabla y RLS está activo sin
--     políticas: aunque alguien tuviera la clave publicable, no puede leer, insertar, editar
--     ni borrar entregas por la API de datos.
--   * service_role (clave secreta, solo en la Edge Function) recibe únicamente SELECT e INSERT.
--     Las entregas son inmutables: no hay UPDATE para nadie desde la API.
--   * La consulta y exportación se hace desde el SQL Editor del panel de Supabase.
-- ============================================================================

-- Versiones del cuestionario y sus identificadores estables de pregunta.
create table if not exists public.cuestionario_versiones (
  version text primary key check (version ~ '^[A-Za-z0-9._-]{1,32}$'),
  item_ids smallint[] not null check (cardinality(item_ids) between 1 and 100),
  creada_en timestamptz not null default now()
);

-- Actividades (por ejemplo, una presentación concreta). "abierta" permite cerrar la recepción.
create table if not exists public.actividades (
  id text primary key check (id ~ '^[a-z0-9][a-z0-9-]{2,63}$'),
  version_cuestionario text not null references public.cuestionario_versiones (version),
  abierta boolean not null default true,
  creada_en timestamptz not null default now()
);

-- Entregas: exclusivamente identificador aleatorio, actividad, versión, respuestas y fecha de
-- recepción del servidor. Sin nombres, correos, IP, huellas del dispositivo ni texto libre.
create table if not exists public.entregas (
  id uuid primary key,
  actividad_id text not null references public.actividades (id),
  version_cuestionario text not null references public.cuestionario_versiones (version),
  respuestas jsonb not null,
  recibida_en timestamptz not null default now()
);

create index if not exists entregas_actividad_recibida_idx on public.entregas (actividad_id, recibida_en);

-- ----------------------------------------------------------------------------
-- Validación en el servidor (segunda línea de defensa, además de la Edge Function)
-- ----------------------------------------------------------------------------
create schema if not exists privado;
revoke all on schema privado from public;

create or replace function privado.validar_entrega()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_version text;
  v_abierta boolean;
  v_items smallint[];
  v_clave text;
  v_valor jsonb;
  v_n integer := 0;
begin
  if tg_op = 'UPDATE' then
    raise exception 'entrega_inmutable' using errcode = 'P0001';
  end if;

  select a.version_cuestionario, a.abierta
    into v_version, v_abierta
    from public.actividades a
   where a.id = new.actividad_id;
  if not found or not v_abierta then
    raise exception 'actividad_no_disponible' using errcode = 'P0001';
  end if;
  if new.version_cuestionario is distinct from v_version then
    raise exception 'version_no_corresponde' using errcode = 'P0001';
  end if;

  select c.item_ids into v_items
    from public.cuestionario_versiones c
   where c.version = new.version_cuestionario;

  if jsonb_typeof(new.respuestas) is distinct from 'object' then
    raise exception 'respuestas_no_validas' using errcode = 'P0001';
  end if;

  for v_clave, v_valor in select key, value from jsonb_each(new.respuestas) loop
    if v_clave !~ '^[0-9]{1,4}$' or not (v_clave::smallint = any (v_items)) then
      raise exception 'id_pregunta_no_valido' using errcode = 'P0001';
    end if;
    -- Solo enteros del 1 al 5 (se rechazan 3.0, "3", true, null, etc.).
    if jsonb_typeof(v_valor) <> 'number' or v_valor::text !~ '^[1-5]$' then
      raise exception 'valor_no_valido' using errcode = 'P0001';
    end if;
    v_n := v_n + 1;
  end loop;

  if v_n <> cardinality(v_items) then
    raise exception 'respuestas_incompletas' using errcode = 'P0001';
  end if;

  -- La fecha siempre la fija el servidor.
  new.recibida_en := now();
  return new;
end;
$$;

revoke all on function privado.validar_entrega() from public;

drop trigger if exists entregas_validar on public.entregas;
create trigger entregas_validar
  before insert or update on public.entregas
  for each row execute function privado.validar_entrega();

-- ----------------------------------------------------------------------------
-- Row Level Security y permisos
-- ----------------------------------------------------------------------------
alter table public.cuestionario_versiones enable row level security;
alter table public.actividades enable row level security;
alter table public.entregas enable row level security;
-- Intencionalmente no se crean políticas: con RLS activo y sin políticas, ninguna fila es
-- visible ni modificable para anon o authenticated.

revoke all on table public.cuestionario_versiones, public.actividades, public.entregas
  from public, anon, authenticated, service_role;

-- La Edge Function (service_role) solo puede leer la configuración e insertar entregas.
-- Los GRANT explícitos definen los permisos necesarios sin depender de los valores
-- por defecto del proyecto.
grant select on table public.cuestionario_versiones, public.actividades to service_role;
grant select, insert on table public.entregas to service_role;

-- ----------------------------------------------------------------------------
-- Datos iniciales: versión 2026-11-v1 (15 preguntas) y la actividad del curso.
-- Deben coincidir con js/datos/cuestionario.js y js/config.js.
-- ----------------------------------------------------------------------------
insert into public.cuestionario_versiones (version, item_ids)
values ('2026-11-v1', '{1,2,3,4,5,6,7,8,9,10,12,15,18,19,20}')
on conflict (version) do nothing;

insert into public.actividades (id, version_cuestionario, abierta)
values ('habilidades-liderazgo-2026', '2026-11-v1', true)
on conflict (id) do nothing;
