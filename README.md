# Un momento de pausa

Aplicación web estática para una actividad universitaria sobre señales de desgaste en los estudios y el trabajo. Los participantes escanean un QR proyectado, contestan 10 preguntas en el celular sobre una escena nocturna con fogata y reciben un resumen descriptivo. Las entregas se guardan, sin datos personales, en Supabase mediante una Edge Function que valida en servidor.

El cuestionario es una elaboración educativa del equipo. No es una versión validada del BAT ni del BAT-S y los cinco rangos del resumen describen frecuencia, no gravedad ni categorías clínicas.

## 1. Datos que debe aportar

Ningún valor de esta lista es secreto; todos se escriben en archivos públicos o en el panel de Supabase.

| Dato | Ejemplo de forma (no real) | Dónde se usa |
|---|---|---|
| Usuario u organización de GitHub y nombre del repositorio | `<usuario>` y `<repositorio>` | URL pública y origen permitido |
| URL pública de GitHub Pages | `https://<usuario>.github.io/<repositorio>/` | `urlPublica` en `js/config.js` |
| Referencia del proyecto de Supabase | `<referencia>` | URL de la función en `js/config.js` |
| Origen permitido para la función | `https://<usuario>.github.io` | secreto `ORIGENES_PERMITIDOS` en Supabase |
| Identificador de la actividad (opcional) | `habilidades-liderazgo-2026` | `js/config.js` y tabla `actividades` |

La clave secreta de Supabase nunca se copia a ningún archivo: la Edge Function la recibe automáticamente del entorno de Supabase.

## 2. Estructura

```
index.html                 Página única (inicio, instrucciones, preguntas, revisión, resultado, presentación)
css/tema.css               Colores, tipografía y medidas editables (incluye los colores de la ilustración)
css/estilos.css            Estructura y componentes
js/config.js               Parámetros de publicación (actividad, URL de la función, URL pública)
js/datos/cuestionario.js   Versión, escala y las 10 preguntas con sus ID estables
js/datos/textos.js         Textos, créditos y referencias
js/datos/orientaciones.js  Tres sugerencias y una frase para cada uno de los cinco rangos
js/recorrido.js            Estado y reglas de avance (guardas), borrador en sessionStorage
js/escala.js               Deslizador de cinco posiciones y opciones pulsables
js/envio.js                Envío a la Edge Function y lectura de su respuesta
js/escena.js               Bosque, estrellas y control de animaciones
js/presentacion.js         Modo de presentación con QR local
js/vendor/qrcode.mjs       Generador de QR (MIT, Kazuhiko Arase)
assets/escena-bosque.svg   Ilustración original (generada por herramientas/generar-escena.mjs)
assets/fuentes/            Fraunces y Atkinson Hyperlegible (OFL), servidas localmente
supabase/migrations/       Tablas, RLS, permisos y validación en base de datos
supabase/functions/registrar-entrega/   Edge Function (index.ts, manejador.ts, validacion.ts)
supabase/sql/              Exportación CSV, resumen del grupo y administración
pruebas/                   Pruebas unitarias, de la función, de SQL y de navegador
```

## 3. Puesta en marcha local

Los módulos de JavaScript necesitan un servidor HTTP; abrir `index.html` con doble clic no funciona.

```bash
python3 -m http.server 8000
# abrir http://localhost:8000/
```

Sin `endpointEntregas` configurado, la aplicación funciona completa y, al entregar, informa que el guardado no está configurado. No simula ningún guardado.

## 4. Backend en Supabase

### 4.1 Crear tablas, permisos y RLS

Opción A, panel: abra **SQL Editor**, ejecute primero `supabase/migrations/20261101120000_crear_entregas.sql` y después `supabase/migrations/20261101170000_cuestionario_v2.sql`. Si ya instaló la versión anterior, ejecute solamente la segunda. Esta registra v2 sin borrar entregas v1; si la actividad estaba cerrada, la conserva cerrada.

Opción B, CLI:

```bash
supabase login
supabase link --project-ref <referencia>
supabase db push
```

La migración crea `cuestionario_versiones`, `actividades` y `entregas`; activa RLS sin políticas; retira todo permiso a `anon` y `authenticated`; concede a `service_role` solo `SELECT` e `INSERT`; e instala un disparador que vuelve a validar cada entrega (ID exactos de la versión, enteros del 1 al 5, actividad abierta) y fija la fecha de recepción del servidor. Las entregas no pueden modificarse desde la API.

### 4.2 Desplegar la Edge Function

```bash
supabase functions deploy registrar-entrega --no-verify-jwt
supabase secrets set ORIGENES_PERMITIDOS=https://<usuario>.github.io
```

`supabase/config.toml` ya declara `verify_jwt = false` para esta función. Es necesario porque los participantes no inician sesión y las claves publicables nuevas no son JWT; la protección está en la validación de la función, los permisos de la base de datos y RLS (Supabase, s. f.-d).

La función usa la clave secreta `default` que Supabase inyecta en `SUPABASE_SECRET_KEYS`; si el proyecto solo tiene claves heredadas, usa `SUPABASE_SERVICE_ROLE_KEY` (Supabase, s. f.-b). Si creó una clave secreta con otro nombre, defina además el secreto `NOMBRE_CLAVE_SECRETA` con ese nombre. Las claves se administran en **Settings > API Keys** (Supabase, s. f.-a).

Alternativa sin CLI: en **Edge Functions** cree la función `registrar-entrega` con los tres archivos de `supabase/functions/registrar-entrega/`, desactive **Verify JWT** y agregue el secreto `ORIGENES_PERMITIDOS` en **Edge Functions > Secrets**.

### 4.3 Conectar el sitio

En `js/config.js`:

```js
endpointEntregas: 'https://<referencia>.supabase.co/functions/v1/registrar-entrega',
```

Prueba rápida desde una terminal (debe responder `201` y luego `200` con `"duplicado": true` si repite el mismo comando):

```bash
curl -i -X POST 'https://<referencia>.supabase.co/functions/v1/registrar-entrega' \
  -H 'Content-Type: application/json' \
  -d '{"id_entrega":"00000000-0000-4000-8000-000000000001","actividad":"habilidades-liderazgo-2026","version":"2026-11-v2","respuestas":{"1":3,"3":3,"4":3,"7":3,"8":3,"11":3,"13":3,"15":3,"16":3,"17":3}}'
```

Borre esa fila de prueba antes de la actividad (ver `supabase/sql/administracion.sql`).

## 5. Publicación en GitHub Pages

1. Suba el contenido de esta carpeta a la raíz de un repositorio.
2. En **Settings > Pages**, elija **Deploy from a branch**, rama `main`, carpeta `/ (root)` (GitHub, s. f.).
3. La dirección será `https://<usuario>.github.io/<repositorio>/`. Todas las rutas del sitio son relativas, por lo que funciona dentro de la subcarpeta del repositorio.
4. Escriba esa dirección, con la barra final, en `urlPublica` de `js/config.js` y publique el cambio.

El archivo `.nojekyll` evita el procesamiento de Jekyll. Todo el repositorio queda público; no contiene secretos.

## 6. Modo de presentación y QR

Abra `https://<usuario>.github.io/<repositorio>/?modo=presentacion` en la computadora del proyector. Muestra la escena, el título, una instrucción breve, el QR (oscuro sobre blanco, con zona de silencio de cuatro módulos, sin animación) y el enlace visible. Los botones descargan el QR en PNG (1600 px) o SVG para insertarlo en las diapositivas.

El QR apunta al inicio normal del cuestionario (`urlPublica`), nunca al modo de presentación. Si `urlPublica` está vacía y el sitio ya corre en HTTPS, se usa la dirección actual sin parámetros; en `localhost`, en direcciones de ejemplo o con una URL inválida, se muestra un aviso y se oculta el QR para evitar compartir un enlace que no funciona.

Antes de la presentación, escanee el QR proyectado con dos celulares distintos (uno iOS y uno Android) y complete una entrega de prueba.

## 7. Consulta y exportación privada

1. Ingrese al panel de Supabase con la cuenta del responsable y abra **SQL Editor**.
2. Ejecute `supabase/sql/exportar_respuestas.sql`: devuelve una fila por entrega con las 10 respuestas (columnas `p01` a `p10` según su posición visible; los ID estables son 1, 3, 4, 7, 8, 11, 13, 15, 16 y 17), la hora de recepción en Costa Rica, la suma y el promedio.
3. Descargue el resultado como CSV con la opción de exportación del editor.
4. `supabase/sql/resumen_grupo.sql` produce estadísticos descriptivos, distribución por pregunta y recuento en los cinco rangos de frecuencia. Las consultas actuales filtran v2 para no mezclar cuestionarios distintos. Para el histórico v1 se conserva `supabase/sql/exportar_respuestas_v1.sql`.
5. Al terminar la actividad, cierre la recepción con la primera sentencia de `supabase/sql/administracion.sql`.

No publique el CSV ni capturas con respuestas individuales.

## 8. Personalización

**Preguntas.** Edite `js/datos/cuestionario.js`. Si cambian los ID o la cantidad, cambie también `version` y registre la nueva versión y su actividad en la base (ejemplos comentados en `supabase/sql/administracion.sql`); el servidor solo acepta los ID de la versión asociada a la actividad. El total de preguntas se calcula siempre del arreglo.

**Textos y cuadros.** Los textos generales están en `js/datos/textos.js`. Los títulos, las tres sugerencias y la frase de cada rango están en `js/datos/orientaciones.js`. Los cinco rangos se calculan redondeando el promedio a la frecuencia más cercana: 10–14, 15–24, 25–34, 35–44 y 45–50. Esta agrupación es editorial y descriptiva, no una escala clínica validada. El mínimo y máximo visibles se calculan desde el arreglo de preguntas. Si modifica la escala o la cantidad, revise también los rangos y sus consultas SQL.

**Colores y medidas.** `css/tema.css` concentra la paleta de la interfaz y de la ilustración, las fuentes, la altura del bosque y la fracción que ocupa la fogata.

**Ilustración.** `node herramientas/generar-escena.mjs` vuelve a generar `assets/escena-bosque.svg`; la composición se ajusta con los parámetros del script.

## 9. Privacidad y seguridad

Se registra exclusivamente: identificador aleatorio de la entrega, identificador de la actividad, versión del cuestionario, respuestas por ID estable y fecha de recepción del servidor. No se piden nombres, correos, edad ni texto libre, y no hay analítica ni huellas del dispositivo.

El identificador de la entrega se crea al pulsar «Entregar» y solo sirve para que los reintentos no dupliquen la fila; no identifica a la persona entre actividades. El borrador vive en `sessionStorage` de la pestaña y se elimina al confirmarse el guardado o al elegir «Borrar mis respuestas» o «Terminar».

La base no es consultable públicamente: RLS sin políticas y sin permisos para `anon` ni `authenticated` (Supabase, s. f.-c). El navegador no usa ninguna clave de Supabase.

Limitaciones conocidas: GitHub y Supabase pueden registrar datos técnicos de las conexiones en sus propios registros, como cualquier servicio web; la función no tiene limitación de frecuencia, por lo que conviene cerrar la actividad al terminar; el control de origen (CORS) solo restringe a los navegadores.

## 10. Accesibilidad y movimiento

La escala es un grupo de botones de opción nativos (teclado y lectores de pantalla) con una pista deslizable como ayuda para puntero; siempre existe una alternativa sin arrastrar (W3C, s. f.-b). «Siguiente» no existe para el usuario mientras no haya respuesta: queda invisible, inerte y fuera del árbol de accesibilidad, con su espacio reservado. Las animaciones decorativas se pausan con el botón de la esquina, con la preferencia de movimiento reducido o cuando la pestaña está oculta (W3C, s. f.-a). No hay sonido.

## 11. Pruebas de esta revisión

Ver `pruebas/README-pruebas.md`. Se comprobaron 21 casos de lógica del frontend y nueve del manejador, incluyendo los 41 totales posibles y todos los límites de los rangos. También pasaron 77 comprobaciones integradas en Chromium y PostgreSQL mediante PGlite, que abarcan las dos migraciones, validación, permisos, RLS, conservación de entregas v1, exportación y recorrido visual.

El recorrido de navegador se ejecuta con `npm run test:e2e`; consulta el detalle y los requisitos en el archivo de pruebas. La configuración utilizada para probar no modifica `js/config.js` ni registra respuestas en un proyecto real.

Pendiente antes de usarlo con la clase: configurar `endpointEntregas`, ejecutar la migración v2 en el proyecto real, comprobar un guardado y escanear el QR publicado desde dos celulares físicos. La URL y el endpoint se mantienen vacíos; esta revisión no publica un sitio ni modifica un servicio externo.

## 12. Créditos y referencias

Actividad del curso Habilidades del Liderazgo, profesora Angélica Méndez Varela. Integrantes: Dominique Trejos Álvarez, Marlon Francisco Murillo García y Juan Pablo Morera González.

Carmona-Halty, M., Alarcón-Castillo, K., Semir-González, C., Sepúlveda-Páez, G., & Schaufeli, W. B. (2024). Burnout Assessment Tool for Students (BAT-S): Evidence of validity in a Chilean sample of undergraduate university students. *Frontiers in Psychology, 15*, Article 1434412. https://doi.org/10.3389/fpsyg.2024.1434412

GitHub. (s. f.). *What is GitHub Pages?* https://docs.github.com/en/pages/getting-started-with-github-pages/what-is-github-pages

Supabase. (s. f.-a). *API keys*. https://supabase.com/docs/guides/getting-started/api-keys

Supabase. (s. f.-b). *Environment variables*. https://supabase.com/docs/guides/functions/secrets

Supabase. (s. f.-c). *Row level security*. https://supabase.com/docs/guides/database/postgres/row-level-security

Supabase. (s. f.-d). *Authorization headers*. https://supabase.com/docs/guides/functions/auth-headers

World Wide Web Consortium. (s. f.-a). *Understanding Success Criterion 2.3.3: Animation from interactions*. https://www.w3.org/WAI/WCAG22/Understanding/animation-from-interactions.html

World Wide Web Consortium. (s. f.-b). *Understanding Success Criterion 2.5.7: Dragging movements*. https://www.w3.org/WAI/WCAG22/Understanding/dragging-movements.html

Recursos de terceros: ver `TERCEROS.md`.
