# Guardado en Google Sheets

La hoja de respuestas pertenece a la cuenta personal elegida para esta actividad. No se comparte con los participantes. El sitio no pide nombres, correos, edad ni texto libre.

Cada fila de «Respuestas» contiene una fecha de recepción del servidor, UUID de entrega, actividad, versión, las diez respuestas en su orden visible, total, promedio y rango descriptivo. El servicio calcula los tres últimos campos a partir de las respuestas. «Resumen» calcula los recuentos y promedios mediante fórmulas.

## Proyecto y despliegue

El proyecto vinculado a la hoja contiene `Codigo.gs`. Antes del primer despliegue:

1. Verificar en `PAUSA` el origen del sitio, actividad, versión e identificadores de preguntas. El ID de la hoja se obtiene al preparar la hoja vinculada y se guarda exclusivamente en las propiedades privadas del proyecto de Apps Script.
2. Guardar el código y recargar la hoja. Aparece el menú **Actividad** para sus editores.
3. Elegir **Actividad > Preparar hoja**. La persona propietaria debe revisar y conceder la autorización de Google. El servicio abre la hoja cuyo ID conserva en las propiedades privadas; el permiso que solicita Google para el servicio de hojas de cálculo puede abarcar otras hojas de la cuenta. El ID y los datos de la hoja no se incluyen en el repositorio público.
4. En Apps Script elegir **Implementar > Nueva implementación > Aplicación web**. Ejecutar como la persona propietaria y permitir acceso a cualquier persona, incluidas las no autenticadas. La hoja mantiene sus permisos privados.
5. Copiar la URL terminada en `/exec` a `endpointEntregas` en `js/config.js` y publicar los archivos actualizados en GitHub.

Después de modificar el código del servicio, actualizar la implementación a una versión nueva. Guardar el editor por sí solo no cambia la versión pública.

## Recepción de entregas

El navegador abre un marco oculto de HtmlService y espera un aviso con un canal aleatorio. Comprueba el dominio de Google y que el remitente pertenece al marco abierto. El puente solo recibe mensajes del origen de GitHub configurado y llama a `registrarEntrega` mediante `google.script.run`. Las respuestas no se incluyen en parámetros de URL. No se usa `fetch` en modo `no-cors` ni se considera que cargar un marco equivalga a guardar datos.

`registrarEntrega` comprueba los campos exactos del objeto, actividad y versión, UUID, los diez ID y valores enteros de 1 a 5. Un bloqueo de script protege la consulta y escritura: un reintento con el mismo UUID y contenido devuelve la confirmación existente; con otro contenido se rechaza. La confirmación del primer guardado se devuelve después de `SpreadsheetApp.flush()`.

Si se pierde la confirmación, la interfaz conserva el UUID y permite reintentar. No debe cambiarse el UUID de una entrega al reintentar.

## Uso por el equipo

- Abrir la hoja privada para consultar «Resumen» y «Respuestas».
- **Actividad > Cerrar recepción** deja de admitir nuevas entregas. Un reintento de una entrega ya registrada puede confirmar su guardado.
- **Actividad > Abrir recepción** vuelve a admitir entregas.
- Las funciones administrativas terminan en `_` y no se exponen a `google.script.run`.

El acceso es anónimo: el UUID evita duplicados del mismo envío, no verifica la identidad ni impide que una persona empiece de nuevo. Un cliente deliberado puede intentar enviar datos al servicio público. El control de origen del puente no constituye autenticación. Google y GitHub pueden conservar registros técnicos de conexión. La hoja y el servicio están sujetos a las cuotas de la cuenta de Google.

## Comprobación

`npm test` comprueba el recorrido y el transporte del navegador. `npm run test:google` comprueba el servicio con una hoja simulada: escritura, los 41 totales, límites, datos inválidos, duplicados, actividad cerrada y reintento después de un fallo. Estas pruebas no sustituyen una entrega real desde el sitio publicado ni la revisión de su fila en la hoja.

## Documentación de consulta

Google. (s. f.). *Web apps*. https://developers.google.com/apps-script/guides/web

Google. (s. f.). *HTML service: Communicate with server functions*. https://developers.google.com/apps-script/guides/html/communication

Google. (s. f.). *Class HtmlOutput*. https://developers.google.com/apps-script/reference/html/html-output
