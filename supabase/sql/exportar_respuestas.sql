-- Exportación privada de la versión 2026-11-v2: diez preguntas.
-- p01...p10 siguen el orden visible; sus ID estables son 1,3,4,7,8,11,13,15,16,17.
-- Ejecutar en SQL Editor y descargar CSV. No publicar respuestas individuales.
select
  e.id as id_entrega,
  e.actividad_id,
  e.version_cuestionario,
  to_char(e.recibida_en at time zone 'America/Costa_Rica', 'YYYY-MM-DD HH24:MI:SS') as recibida_hora_cr,
  (e.respuestas ->> '1')::int as p01,
  (e.respuestas ->> '3')::int as p02,
  (e.respuestas ->> '4')::int as p03,
  (e.respuestas ->> '7')::int as p04,
  (e.respuestas ->> '8')::int as p05,
  (e.respuestas ->> '11')::int as p06,
  (e.respuestas ->> '13')::int as p07,
  (e.respuestas ->> '15')::int as p08,
  (e.respuestas ->> '16')::int as p09,
  (e.respuestas ->> '17')::int as p10,
  t.total,
  round(t.total::numeric / t.n, 2) as promedio,
  floor(t.total::numeric / t.n + 0.5)::int as rango_frecuencia
from public.entregas e
cross join lateral (
  select sum(value::int) as total, count(*) as n
  from jsonb_each_text(e.respuestas)
) t
where e.actividad_id = 'habilidades-liderazgo-2026'
  and e.version_cuestionario = '2026-11-v2'
order by e.recibida_en;
