-- Exportación privada de las entregas (versión 2026-11-v1).
-- Ejecutar en el SQL Editor del panel de Supabase (acceso con la cuenta del responsable) y
-- usar la opción de descarga CSV del resultado. No publique este archivo de resultados.
--
-- Cambie el identificador de la actividad si usa otro.

select
  e.id                                                         as id_entrega,
  e.actividad_id,
  e.version_cuestionario,
  to_char(e.recibida_en at time zone 'America/Costa_Rica', 'YYYY-MM-DD HH24:MI:SS') as recibida_hora_cr,
  (e.respuestas ->> '1')::int  as p01,
  (e.respuestas ->> '2')::int  as p02,
  (e.respuestas ->> '3')::int  as p03,
  (e.respuestas ->> '4')::int  as p04,
  (e.respuestas ->> '5')::int  as p05,
  (e.respuestas ->> '6')::int  as p06,
  (e.respuestas ->> '7')::int  as p07,
  (e.respuestas ->> '8')::int  as p08,
  (e.respuestas ->> '9')::int  as p09,
  (e.respuestas ->> '10')::int as p10,
  (e.respuestas ->> '12')::int as p12,
  (e.respuestas ->> '15')::int as p15,
  (e.respuestas ->> '18')::int as p18,
  (e.respuestas ->> '19')::int as p19,
  (e.respuestas ->> '20')::int as p20,
  t.total,
  round(t.total::numeric / t.n, 2)                              as promedio
from public.entregas e
cross join lateral (
  select sum(value::int) as total, count(*) as n
  from jsonb_each_text(e.respuestas)
) t
where e.actividad_id = 'habilidades-liderazgo-2026'
  and e.version_cuestionario = '2026-11-v1'
order by e.recibida_en;
