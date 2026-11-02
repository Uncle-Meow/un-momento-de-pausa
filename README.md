# Un momento de pausa

Actividad educativa sobre señales de desgaste en los estudios y el trabajo. El sitio estático se publica en GitHub Pages y utiliza Google Apps Script para guardar las entregas en una hoja privada de Google Sheets.

Página: https://uncle-meow.github.io/un-momento-de-pausa/

Pantalla para proyectar el QR: https://uncle-meow.github.io/un-momento-de-pausa/?modo=presentacion

## Cuestionario y cálculo

La versión `2026-11-v2` contiene diez preguntas y escala de 1 a 5: nunca, rara vez, algunas veces, a menudo y siempre. Se suman las respuestas (10–50 puntos) y se divide el total entre diez. El promedio se redondea a la opción de frecuencia más cercana.

| Total | Rango | Frecuencia cercana al promedio |
|---|---|---|
| 10–14 | 1 | Nunca |
| 15–24 | 2 | Rara vez |
| 25–34 | 3 | Algunas veces |
| 35–44 | 4 | A menudo |
| 45–50 | 5 | Siempre |

Cada rango muestra tres sugerencias breves y una frase de cierre. Las preguntas y agrupaciones son una elaboración educativa sin validación psicométrica. No constituyen un diagnóstico ni estiman probabilidad de burnout.

## Guardado en Google Sheets

La configuración y el código están en [google-apps-script/README.md](google-apps-script/README.md). La hoja conserva fecha, código aleatorio, actividad, versión, diez respuestas, total, promedio y rango. No pide nombres ni correos. Las pestañas son «Resumen» y «Respuestas».

`js/config.js` contiene la URL pública de Apps Script. La página solo confirma el guardado si recibe una respuesta válida del servicio con el mismo código de entrega. Ante un fallo conserva las respuestas y el código para reintentar sin duplicar la fila.

El menú **Actividad** de la hoja permite abrir y cerrar la recepción. La hoja mantiene su acceso privado; el servicio público recibe las entregas. Los participantes no necesitan una cuenta de Google.

La implementación anterior para Supabase se conserva como alternativa en `supabase/`. Sus instrucciones están en [supabase/README-configuracion-anterior.md](supabase/README-configuracion-anterior.md), con rutas referidas a la raíz del proyecto.

## Estructura

- `js/datos/cuestionario.js`: diez preguntas, escala y versión.
- `js/datos/orientaciones.js`: sugerencias y frase para cada rango.
- `js/datos/textos.js`: textos y fuentes académicas.
- `js/google-sheets.js`: comunicación con Apps Script.
- `js/envio.js`: confirmación del envío y adaptador HTTP alternativo.
- `google-apps-script/Codigo.gs`: validación, registro y menú de la hoja.
- `css/tema.css` y `css/estilos.css`: paleta, composición y adaptación a pantallas pequeñas.
- `assets/`: bosque, favicon y fuentes con sus licencias.

## Pruebas y desarrollo

Para servir localmente: `python3 -m http.server 8000`. Los módulos necesitan HTTP; no abrir el archivo con doble clic.

- `npm test`: recorrido, cálculo, recomendaciones y transporte del navegador.
- `npm run test:google`: validación y guardado de Apps Script contra una hoja simulada.
- `npm run test:funcion:node`: manejador de la alternativa Supabase.

El puente de Google admite el origen de producción configurado; las pruebas locales del transporte usan objetos simulados. La configuración real debe comprobarse desde el sitio publicado: enviar una entrega, revisar la fila en la hoja, reintentar y comprobar que no se duplica.

## Privacidad y uso

No publique respuestas individuales ni comparta la hoja con los participantes. El UUID impide duplicar el mismo envío, pero no identifica personas ni limita a una entrega por persona. Cierre la recepción después de la actividad. GitHub y Google pueden conservar registros técnicos de conexión.

La fogata permanece animada mientras la pestaña está visible y no tiene botón de pausa. La preferencia de movimiento reducido se aplica a las transiciones de pantalla y al titilar de las estrellas. «Siguiente» permanece oculto hasta responder. Las preguntas, instrucciones, revisión y resultado permiten desplazamiento cuando el contenido no cabe.

Curso Habilidades del Liderazgo. Profesora: Angélica Méndez Varela. Integrantes: Dominique Trejos Álvarez, Marlon Francisco Murillo García y Juan Pablo Morera González.

Recursos de terceros: [TERCEROS.md](TERCEROS.md). Las referencias académicas están en «Sobre esta actividad» y `js/datos/textos.js`.
