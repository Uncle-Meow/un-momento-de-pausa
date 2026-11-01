-- Resumen académico descriptivo. Solo v2: no mezclar escalas de 15 y 10 preguntas.
-- Los cinco rangos son frecuencias medias redondeadas, no categorías clínicas.

-- 1. Totales del grupo (promedio por entrega; denominador obtenido de los datos).
with t as (
  select e.id, sum(r.value::int) as total, count(*) as n
  from public.entregas e
  cross join lateral jsonb_each_text(e.respuestas) r
  where e.actividad_id = 'habilidades-liderazgo-2026'
    and e.version_cuestionario = '2026-11-v2'
  group by e.id
)
select count(*) as entregas, round(avg(total), 1) as suma_media,
  min(total) as suma_minima, max(total) as suma_maxima,
  round(stddev_samp(total), 1) as suma_desviacion,
  round(avg(total::numeric / n), 2) as promedio_medio_por_pregunta
from t;

-- 2. Distribución de respuestas por pregunta (ID estable, consultar cuestionario.js).
select r.key::int as id_pregunta, count(*) as n,
  round(avg(r.value::int), 2) as promedio,
  count(*) filter (where r.value::int = 1) as nunca,
  count(*) filter (where r.value::int = 2) as rara_vez,
  count(*) filter (where r.value::int = 3) as algunas_veces,
  count(*) filter (where r.value::int = 4) as a_menudo,
  count(*) filter (where r.value::int = 5) as siempre
from public.entregas e
cross join lateral jsonb_each_text(e.respuestas) r
where e.actividad_id = 'habilidades-liderazgo-2026'
  and e.version_cuestionario = '2026-11-v2'
group by r.key::int
order by r.key::int;

-- 3. Cinco rangos de frecuencia. Incluye los rangos sin entregas; sin participantes,
-- el porcentaje queda NULL (no aplicable), no se simulan datos.
with t as (
  select e.id, floor(avg(r.value::numeric) + 0.5)::int as rango
  from public.entregas e
  cross join lateral jsonb_each_text(e.respuestas) r
  where e.actividad_id = 'habilidades-liderazgo-2026'
    and e.version_cuestionario = '2026-11-v2'
  group by e.id
), rangos(nivel, frecuencia, puntos) as (
  values (1, 'Cercana a Nunca', '10–14'), (2, 'Cercana a Rara vez', '15–24'),
    (3, 'Cercana a Algunas veces', '25–34'), (4, 'Cercana a A menudo', '35–44'),
    (5, 'Cercana a Siempre', '45–50')
)
select r.nivel as rango_frecuencia, r.frecuencia, r.puntos,
  count(t.id) as entregas,
  round(100.0 * count(t.id) / nullif((select count(*) from t), 0), 1) as porcentaje_del_grupo
from rangos r
left join t on t.rango = r.nivel
group by r.nivel, r.frecuencia, r.puntos
order by r.nivel;
