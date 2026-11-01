# Pruebas de la versión de diez preguntas

## Lógica y envío del frontend

```bash
npm test
```

Comprueba 21 casos de recorrido, consentimiento, restauración, datos incompletos, sumas, envío y recomendaciones. El caso de rangos recorre los 41 totales enteros de 10 a 50 y verifica los límites 14/15, 24/25, 34/35 y 44/45.

## Manejador de la función

Con Node 24 o superior:

```bash
npm run test:funcion:node
```

El lanzador ejecuta los mismos nueve casos del archivo TypeScript con el corredor de Node. La alternativa con Deno 2 se conserva:

```bash
deno test pruebas/funcion/manejador_test.ts
deno check supabase/functions/registrar-entrega/index.ts
```

El manejador se prueba sin credenciales ni solicitudes a Supabase. La verificación del adaptador `index.ts` contra el servicio desplegado requiere el entorno de Supabase y no queda cubierta por esas nueve pruebas.

## Integración: navegador y PostgreSQL local en WASM

Requiere Node 24+, Playwright y PGlite solamente para las pruebas. No son dependencias del sitio publicado.

```bash
npm install --no-save playwright @electric-sql/pglite
npx playwright install chromium
npm run test:e2e
```

El recorrido intercepta las solicitudes del navegador para servir los archivos del proyecto y ejecuta el manejador real contra una base de PostgreSQL local mediante PGlite. No utiliza datos reales ni el proyecto de Supabase. Aplica las dos migraciones, ejecuta el archivo de pruebas SQL y comprueba conservación de v1, cambio a v2, permisos, RLS, exportación, límites de los cinco rangos, recomendaciones, guardado, fallos de conexión y reintento, QR y tamaños de pantalla.

Las capturas y el informe JSON se escriben en una carpeta temporal. Puede definir `PAUSA_QADIR` para elegir otra. Si ya tiene un navegador compatible, `PAUSA_CHROME` indica su ejecutable. `PAUSA_CHROME_SINGLE=1` permite ejecutar en un entorno de proceso único. El lanzador Python anterior remite al nuevo recorrido Node.

Estas pruebas locales no verifican el despliegue de la función ni la configuración de secretos, permisos u orígenes del proyecto real.

## Alternativa: PostgreSQL local instalado

Use una base de pruebas vacía. No ejecute las pruebas en el proyecto de producción.

```bash
createdb pausa_prueba
psql -d pausa_prueba -f pruebas/sql/roles_supabase_locales.sql
psql -d pausa_prueba -f supabase/migrations/20261101120000_crear_entregas.sql
psql -d pausa_prueba -f supabase/migrations/20261101170000_cuestionario_v2.sql
psql -d pausa_prueba -f pruebas/sql/prueba_base_datos.sql
```

## Antes de usarlo con la clase

- Publique el sitio con su URL HTTPS definitiva y compruebe que el QR dirige al inicio.
- Configure `endpointEntregas` y aplique la migración v2 en Supabase.
- Complete una entrega real y verifique la fila y sus diez respuestas.
- Repita el mismo envío y compruebe que no se duplica.
- Escanee el QR proyectado con dos celulares físicos y compruebe la lectura y los botones.
- Borre únicamente las entregas de prueba y confirme que la actividad está abierta.
