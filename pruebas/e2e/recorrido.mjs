// Verificación local: navegador real + manejador real + Postgres en WASM (PGlite).
// No contacta un proyecto de Supabase ni requiere datos de participantes.
// Node 24+; instalar para estas pruebas: npm install --no-save playwright @electric-sql/pglite
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { crearManejador } from '../../supabase/functions/registrar-entrega/manejador.ts';
import { CUESTIONARIO } from '../../js/datos/cuestionario.js';
import { ORIENTACIONES } from '../../js/datos/orientaciones.js';
const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const { PGlite } = require(process.env.PAUSA_PGLITE_MODULE || '@electric-sql/pglite');
const raiz = fileURLToPath(new URL('../../', import.meta.url));
const salida = process.env.PAUSA_QADIR || await fs.mkdtemp(path.join(os.tmpdir(), 'pausa-qa-'));
await fs.mkdir(salida, { recursive: true });
const pruebas = [];
function ok(nombre, valor = true) { assert.ok(valor, nombre); pruebas.push(nombre); console.log('OK', nombre); }
const leer = (p) => fs.readFile(path.join(raiz, p), 'utf8');
const db = new PGlite();
const rol = (fn) => db.transaction(async (tx) => { await tx.exec('set local role service_role'); return fn(tx); });

// Primero aplicar las migraciones y comprobar que la v1 no se sobrescribe.
await db.exec(await leer('pruebas/sql/roles_supabase_locales.sql'));
await db.exec(await leer('supabase/migrations/20261101120000_crear_entregas.sql'));
const idsV1 = [1,2,3,4,5,6,7,8,9,10,12,15,18,19,20];
const idHistorico = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
await db.query('insert into public.entregas(id, actividad_id, version_cuestionario, respuestas) values ($1,$2,$3,$4::jsonb)',
  [idHistorico, 'habilidades-liderazgo-2026', '2026-11-v1', JSON.stringify(Object.fromEntries(idsV1.map((id) => [id, 3])))]);
const migracion = await leer('supabase/migrations/20261101170000_cuestionario_v2.sql');
await db.exec(migracion);
await db.exec(migracion); // idempotente
ok('migración v2 conserva la entrega v1', (await db.query('select count(*)::int as n from public.entregas where id=$1', [idHistorico])).rows[0].n === 1);
ok('la actividad usa v2', (await db.query('select version_cuestionario from public.actividades')).rows[0].version_cuestionario === CUESTIONARIO.version);
await db.query('delete from public.entregas where id=$1', [idHistorico]);
// Ejecutar el archivo SQL, adaptando únicamente los comandos de la consola psql.
let sqlPruebas = (await leer('pruebas/sql/prueba_base_datos.sql')).replace(/^\\set.*$/gm, '').replace(/^\\echo.*$/gm, '');
sqlPruebas = sqlPruebas.replace(/^\\i supabase\/sql\/exportar_respuestas.sql$/gm, await leer('supabase/sql/exportar_respuestas.sql'));
await db.exec(sqlPruebas);
ok('pruebas SQL: validación, unicidad, RLS, permisos y exportación');

const repo = {
  async obtenerActividad(id) {
    const r = await rol((tx) => tx.query('select a.version_cuestionario, a.abierta, v.item_ids from public.actividades a join public.cuestionario_versiones v on v.version=a.version_cuestionario where a.id=$1', [id]));
    return r.rows[0] || null;
  },
  async insertarEntrega(e) {
    try {
      const r = await rol((tx) => tx.query('insert into public.entregas(id, actividad_id, version_cuestionario, respuestas) values ($1,$2,$3,$4::jsonb) returning recibida_en', [e.id, e.actividad_id, e.version_cuestionario, JSON.stringify(e.respuestas)]));
      return { tipo: 'insertada', recibida_en: String(r.rows[0].recibida_en) };
    } catch (e) {
      if (e.code === '23505') return { tipo: 'duplicada' };
      return { tipo: e.code === 'P0001' ? 'rechazada' : 'error', codigo: e.message, detalle: e.message };
    }
  },
  async obtenerEntrega(id) {
    const r = await rol((tx) => tx.query('select actividad_id, version_cuestionario, respuestas, recibida_en from public.entregas where id=$1', [id]));
    return r.rows[0] || null;
  },
};
const base = 'https://pausa.test/un-momento-de-pausa/';
const endpoint = 'https://pausa.test/api/entregas';
const manejar = crearManejador({ repositorio: repo, origenesPermitidos: ['https://pausa.test'] });
const navegador = await chromium.launch({ headless: true,
  ...(process.env.PAUSA_CHROME ? { executablePath: process.env.PAUSA_CHROME } : {}),
  args: process.env.PAUSA_CHROME_SINGLE ? ['--no-sandbox', '--single-process', '--no-zygote'] : ['--no-sandbox'],
});
const contexto = await navegador.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, reducedMotion: 'reduce', locale: 'es-CR' });
const errores = [];
const mime = { '.html':'text/html', '.js':'text/javascript', '.mjs':'text/javascript', '.css':'text/css', '.svg':'image/svg+xml', '.woff2':'font/woff2' };

async function pagina({ sinConfig = false, fallo = false, urlPublica = 'https://grupo-liderazgo.github.io/un-momento-de-pausa/' } = {}) {
  const p = await contexto.newPage();
  p.on('pageerror', (e) => errores.push(String(e)));
  let fallar = fallo;
  await p.route('https://pausa.test/**', async (route) => {
    const req = route.request();
    const u = new URL(req.url());
    if (u.pathname === '/api/entregas') {
      if (fallar) return route.abort('failed');
      const r = await manejar(new Request(req.url(), { method:req.method(), headers:req.headers(), body:req.postData() }));
      return route.fulfill({ status:r.status, headers:Object.fromEntries(r.headers), body:await r.text() });
    }
    if (u.pathname.endsWith('/js/config.js')) return route.fulfill({ contentType:'text/javascript', body:`export const CONFIG = Object.freeze(${JSON.stringify({ actividad:'habilidades-liderazgo-2026', endpointEntregas:sinConfig?'':endpoint, urlPublica, idioma:'es-CR', tiempoMaximoEnvioMs:3000, claveBorrador:'pausa-borrador-v1' })});` });
    const relativo = decodeURIComponent(u.pathname).replace(/^\/un-momento-de-pausa\//, '') || 'index.html';
    const archivo = path.resolve(raiz, relativo);
    if (!archivo.startsWith(path.resolve(raiz) + path.sep)) return route.fulfill({status:403});
    try { return route.fulfill({ body:await fs.readFile(archivo), contentType:mime[path.extname(archivo)] || 'application/octet-stream' }); }
    catch { return route.fulfill({status:404}); }
  });
  return { p, recuperarRed:() => { fallar=false; } };
}
async function empezar(p) {
  await p.goto(base);
  await p.locator('#pantalla-inicio:not([hidden])').waitFor();
  await p.locator('#boton-primario').click();
  await p.locator('#casilla-aceptacion').check();
  await p.locator('#boton-primario').click();
  await p.locator('#pantalla-pregunta:not([hidden])').waitFor();
}
async function responder(p, valor) {
  await p.locator(`.opcion input[value="${valor}"]`).check();
  await p.locator('#boton-primario').click();
  await p.waitForFunction(() => !document.querySelector('#cuerpo-pregunta').inert);
}
function valoresPara(total) {
  let resto=total-10;
  return CUESTIONARIO.preguntas.map(() => {const extra=Math.min(4,resto);resto-=extra;return 1+extra;});
}
async function completar(p, total) {
  for (const v of valoresPara(total)) await responder(p,v);
  await p.locator('#pantalla-revision:not([hidden])').waitFor();
  await p.locator('#boton-primario').click();
  await p.locator('#pantalla-resultado:not([hidden])').waitFor();
}
async function captura(p,nombre) {await p.evaluate(()=>document.fonts.ready);await p.waitForTimeout(200);await p.screenshot({path:path.join(salida,nombre)});}

try {
  const {p}=await pagina();
  await p.goto(base);
  await p.locator('#boton-primario').click();
  await p.locator('#boton-primario').click({force:true});
  ok('sin aceptación no empieza', (await p.evaluate(()=>window.__pausa.estado())).pantalla==='instrucciones');
  await p.locator('#casilla-aceptacion').check();
  await p.locator('#boton-primario').click();
  ok('progreso inicial de diez preguntas', await p.locator('#progreso-posicion').textContent()==='Pregunta 1 de 10' && await p.locator('#progreso-pendientes').textContent()==='10 sin responder');
  ok('Siguiente ausente antes de responder', await p.getByRole('button',{name:'Siguiente',exact:true}).count()===0);
  ok('no hay valor preseleccionado', await p.locator('.opcion input:checked').count()===0);
  ok('la guarda impide avance por llamada interna', await p.evaluate(()=>window.__pausa.intentarAvanzar())===false);
  const antes=await p.locator('#boton-primario').boundingBox();
  await p.locator('.opcion input[value="3"]').check();
  ok('elegir el valor central habilita Siguiente', await p.getByRole('button',{name:'Siguiente',exact:true}).isVisible());
  const despues=await p.locator('#boton-primario').boundingBox();
  ok('sin salto al aparecer Siguiente', Math.abs(antes.y-despues.y)<1 && Math.abs(antes.x-despues.x)<1);
  await captura(p,'pregunta-390.png');
  await p.locator('#boton-primario').click();
  ok('la segunda pregunta vuelve a exigir respuesta', await p.getByRole('button',{name:'Siguiente',exact:true}).count()===0);
  await p.reload();
  ok('recarga recupera posición y respuesta', await p.evaluate(()=>{const e=window.__pausa.estado();return e.indice===1&&e.respuestas[1]===3;}));
  await p.getByRole('button',{name:'Anterior',exact:true}).click();
  ok('retroceder restaura la selección', await p.locator('.opcion input[value="3"]').isChecked());
  await p.close();

  for (const total of [10,14,15,24,25,34,35,44,45,50]) {
    const {p}=await pagina();await empezar(p);await completar(p,total);
    const nivel=Math.round(total/10);
    ok(`resultado ${total}: rango ${nivel}`, await p.locator('#valor-suma').textContent()===String(total) && await p.locator('#orientacion').getAttribute('data-nivel')===String(nivel));
    ok(`resultado ${total}: tres recomendaciones y frase correcta`, await p.locator('#lista-ideas li').count()===3 && await p.locator('#frase-orientacion').textContent()===ORIENTACIONES[nivel-1].frase);
    ok(`resultado ${total}: guardado confirmado por el manejador y Postgres`, (await p.locator('#estado-guardado').getAttribute('data-tipo'))==='ok');
    if ([10,25,50].includes(total)) await captura(p,`resultado-${total}-390.png`);
    // Todo el contenido final puede desplazarse hasta quedar por encima de la navegación.
    await p.locator('#pantalla-resultado').evaluate(el=>{el.scrollTop=el.scrollHeight;});
    const ultima=await p.locator('#pantalla-resultado .enlace-texto').boundingBox();
    const nav=await p.locator('#navegacion').boundingBox();
    ok(`resultado ${total}: contenido final no tapado por botones`, ultima.y+ultima.height<=nav.y);
    if (total===50) {
      await p.locator('#boton-secundario').click();
      ok('consultar respuestas después de guardar no permite editarlas', await p.locator('.item-revision').count()===10 && await p.locator('.boton-cambiar').count()===0);
    }
    await p.close();
  }

  const antesFallo=(await db.query('select count(*)::int as n from public.entregas')).rows[0].n;
  const red=await pagina({fallo:true});await empezar(red.p);await completar(red.p,30);
  ok('un fallo no afirma guardado', (await red.p.locator('#estado-guardado').getAttribute('data-tipo'))!=='ok');
  red.recuperarRed();await red.p.locator('#boton-reintentar').click();
  await red.p.waitForFunction(()=>document.querySelector('#estado-guardado').dataset.tipo==='ok');
  ok('reintento guarda una sola entrega', (await db.query('select count(*)::int as n from public.entregas')).rows[0].n===antesFallo+1);
  await red.p.close();

  const sin=await pagina({sinConfig:true});await empezar(sin.p);await completar(sin.p,20);
  ok('sin configurar el servicio se informa que no se guardó', await sin.p.locator('#estado-guardado-texto').textContent().then(t=>t.includes('no se registró')));
  await sin.p.close();

  for (const [ancho,alto] of [[320,568],[375,667],[844,390],[1600,900]]) {
    const {p}=await pagina();await p.setViewportSize({width:ancho,height:alto});await empezar(p);await completar(p,40);
    ok(`sin desbordamiento horizontal ${ancho}×${alto}`, await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
    await p.locator('#pantalla-resultado').evaluate(el=>{el.scrollTop=el.scrollHeight;});
    const fin=await p.locator('#pantalla-resultado .enlace-texto').boundingBox();
    const nav=await p.locator('#navegacion').boundingBox();
    ok(`resultado desplazable completo ${ancho}×${alto}`, fin.y+fin.height<=nav.y+1);
    await p.waitForTimeout(30);
    ok(`la pista desaparece al llegar al final ${ancho}×${alto}`, !(await p.locator('#pista-desplazamiento').isVisible()));
    await p.locator('#pantalla-resultado').evaluate(el=>{el.scrollTop=0;});
    if (alto<720) {
      await p.waitForTimeout(30);
      ok(`hay indicación de desplazamiento ${ancho}×${alto}`, await p.locator('#pista-desplazamiento').isVisible());
    }
    await captura(p,`resultado-${ancho}x${alto}.png`);await p.close();
  }

  const {p:qr}=await pagina();await qr.setViewportSize({width:1600,height:900});await qr.goto(base+'?modo=presentacion');
  await qr.locator('#qr-lienzo svg').waitFor();
  ok('QR apunta al inicio público sin modo presentación', await qr.locator('#qr-lienzo').getAttribute('data-url')==='https://grupo-liderazgo.github.io/un-momento-de-pausa/');
  await captura(qr,'presentacion.png');await qr.close();
  const {p:ejemplo}=await pagina({urlPublica:'https://equipo-ejemplo.github.io/un-momento-de-pausa/'});
  await ejemplo.goto(base+'?modo=presentacion');await ejemplo.locator('.qr-pendiente').waitFor();
  ok('no se genera QR para la dirección de ejemplo', await ejemplo.locator('#qr-lienzo svg').count()===0 && !(await ejemplo.locator('#descargar-png').isVisible()));
  await ejemplo.close();
  // Las consultas privadas deben funcionar con v2 y devolver cinco rangos.
  const exportacion=await db.exec(await leer('supabase/sql/exportar_respuestas.sql'));
  const resumen=await db.exec(await leer('supabase/sql/resumen_grupo.sql'));
  ok('exportación SQL tiene diez respuestas y rango de frecuencia', exportacion[0].rows.length>0 && 'p10' in exportacion[0].rows[0] && 'rango_frecuencia' in exportacion[0].rows[0]);
  ok('resumen SQL devuelve los cinco rangos', resumen.at(-1).rows.length===5);
  ok('sin errores JavaScript', errores.length===0);
  await fs.writeFile(path.join(salida,'resultado-pruebas.json'),JSON.stringify({pruebas:pruebas.length,correctas:pruebas,errores,baseDatos:(await db.query('select version()')).rows[0].version},null,2));
  console.log(`TERMINADO: ${pruebas.length} comprobaciones. Capturas internas: ${salida}`);
} finally {
  await contexto.close();await navegador.close();await db.close();
}
