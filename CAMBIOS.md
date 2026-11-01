# Revisión del 1 de noviembre de 2026

Se conserva el diseño de bosque nocturno, estrellas y fogata, con la encuesta adaptada al celular.

## Cambios realizados

- Se sustituyeron las 15 preguntas por las 10 seleccionadas por el equipo. La escala sigue siendo de 1 a 5: nunca, rara vez, algunas veces, a menudo y siempre.
- El total posible es ahora de 10 a 50. Se muestra el promedio y uno de cinco rangos descriptivos:

| Puntos | Rango | Frecuencia más cercana al promedio | Cuadro de sugerencias |
|---|---|---|---|
| 10–14 | 1 | Nunca | Cuida tus rutinas |
| 15–24 | 2 | Rara vez | Encuentra tu ritmo |
| 25–34 | 3 | Algunas veces | Haz espacio para una pausa |
| 35–44 | 4 | A menudo | Comparte la carga |
| 45–50 | 5 | Siempre | Date espacio y compañía |

Cada cuadro contiene tres sugerencias breves y una frase de cierre. Los rangos agrupan las respuestas según su promedio; no estiman probabilidad de burnout ni constituyen categorías clínicas. El cuestionario es una elaboración educativa sin validación psicométrica.

- Se compactó el resultado y se dejó el detalle del cálculo en «Cómo se calcula».
- Se ajustó el espacio de los botones y se agregó una indicación para desplazar el contenido cuando no cabe en la pantalla.
- Se conserva la regla de ocultar «Siguiente» hasta que se elija una respuesta, incluso si se desea seleccionar el valor central.
- El QR se oculta cuando falta una dirección pública válida o se usa la dirección de ejemplo.
- Se incorporó la versión `2026-11-v2` al guardado, la validación y las consultas SQL. La migración mantiene las respuestas anteriores en v1 y las separa en las exportaciones.

## Verificación

Pasaron 21 pruebas del frontend y nueve del manejador. Se comprobaron los 41 totales posibles de 10 a 50. También pasaron 77 comprobaciones integradas con Chromium y PostgreSQL local mediante PGlite: recorrido, límites de rango, recomendaciones, guardado y reintento, permisos, migraciones, exportación y pantallas pequeñas.

El guardado se verificó localmente con el manejador y la base de datos de pruebas. No se ha publicado el sitio ni configurado un proyecto real de Supabase.

## Para ponerlo en uso

Siga el `README.md`: configure la URL pública y el endpoint, aplique la migración v2 y despliegue la función en Supabase. Complete una entrega real de prueba y escanee el QR publicado antes de la actividad.
