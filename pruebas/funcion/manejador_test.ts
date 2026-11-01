// Pruebas del manejador de la Edge Function con un repositorio en memoria.
// Ejecutar: deno test pruebas/funcion/manejador_test.ts

import { deepStrictEqual } from 'node:assert/strict';

const assertEquals = (real: unknown, esperado: unknown, msg?: string) => deepStrictEqual(real, esperado, msg);
import { crearManejador, type Repositorio } from '../../supabase/functions/registrar-entrega/manejador.ts';
import { validarEstructura } from '../../supabase/functions/registrar-entrega/validacion.ts';

const IDS = [1, 3, 4, 7, 8, 11, 13, 15, 16, 17];
const ORIGEN = 'https://equipo.github.io';

function respuestas(valor = 3, extra: Record<string, unknown> = {}) {
  const r: Record<string, unknown> = {};
  for (const id of IDS) r[String(id)] = valor;
  return { ...r, ...extra };
}

function cuerpo(sobre: Record<string, unknown> = {}) {
  return {
    id_entrega: crypto.randomUUID(),
    actividad: 'habilidades-liderazgo-2026',
    version: '2026-11-v2',
    respuestas: respuestas(),
    ...sobre,
  };
}

function repoMemoria() {
  const filas = new Map<string, { actividad_id: string; version_cuestionario: string; respuestas: Record<string, number>; recibida_en: string }>();
  let abierta = true;
  const repo: Repositorio = {
    obtenerActividad(id) {
      return Promise.resolve(id === 'habilidades-liderazgo-2026' ? { version_cuestionario: '2026-11-v2', abierta, item_ids: IDS } : null);
    },
    insertarEntrega(e) {
      if (filas.has(e.id)) return Promise.resolve({ tipo: 'duplicada' as const });
      const recibida_en = new Date().toISOString();
      filas.set(e.id, { actividad_id: e.actividad_id, version_cuestionario: e.version_cuestionario, respuestas: e.respuestas, recibida_en });
      return Promise.resolve({ tipo: 'insertada' as const, recibida_en });
    },
    obtenerEntrega(id) {
      return Promise.resolve(filas.get(id) ?? null);
    },
  };
  return { repo, filas, cerrar: () => (abierta = false) };
}

function solicitud(datos: unknown, { origen = ORIGEN, metodo = 'POST', tipo = 'application/json' } = {}) {
  const headers: Record<string, string> = { 'content-type': tipo };
  if (origen) headers.origin = origen;
  return new Request('http://local/registrar-entrega', {
    method: metodo,
    headers,
    body: metodo === 'POST' ? (typeof datos === 'string' ? datos : JSON.stringify(datos)) : undefined,
  });
}

Deno.test('guarda una entrega válida y recalcula total y promedio', async () => {
  const { repo, filas } = repoMemoria();
  const h = crearManejador({ repositorio: repo, origenesPermitidos: [ORIGEN] });
  const c = cuerpo({ respuestas: { ...respuestas(4), '1': 1 } });
  const r = await h(solicitud(c));
  assertEquals(r.status, 201);
  const j = await r.json();
  assertEquals(j.ok, true);
  assertEquals(j.id_entrega, c.id_entrega);
  assertEquals(j.total, 37);
  assertEquals(j.promedio, 3.7);
  assertEquals(r.headers.get('access-control-allow-origin'), ORIGEN);
  assertEquals(filas.size, 1);
});

Deno.test('suma mínima 10 y máxima 50', async () => {
  const { repo } = repoMemoria();
  const h = crearManejador({ repositorio: repo, origenesPermitidos: [ORIGEN] });
  const min = await (await h(solicitud(cuerpo({ respuestas: respuestas(1) })))).json();
  const max = await (await h(solicitud(cuerpo({ respuestas: respuestas(5) })))).json();
  assertEquals([min.total, min.promedio, max.total, max.promedio], [10, 1, 50, 5]);
});

Deno.test('reintento con el mismo identificador no duplica y confirma', async () => {
  const { repo, filas } = repoMemoria();
  const h = crearManejador({ repositorio: repo, origenesPermitidos: [ORIGEN] });
  const c = cuerpo();
  assertEquals((await h(solicitud(c))).status, 201);
  const r2 = await h(solicitud(c));
  assertEquals(r2.status, 200);
  assertEquals((await r2.json()).duplicado, true);
  assertEquals(filas.size, 1);
});

Deno.test('mismo identificador con otras respuestas: conflicto 409', async () => {
  const { repo, filas } = repoMemoria();
  const h = crearManejador({ repositorio: repo, origenesPermitidos: [ORIGEN] });
  const c = cuerpo();
  await h(solicitud(c));
  const r = await h(solicitud({ ...c, respuestas: respuestas(5) }));
  assertEquals(r.status, 409);
  assertEquals(filas.size, 1);
});

Deno.test('rechaza datos inválidos', async () => {
  const { repo, filas } = repoMemoria();
  const h = crearManejador({ repositorio: repo, origenesPermitidos: [ORIGEN] });
  const casos: Array<[unknown, number, string]> = [
    [cuerpo({ respuestas: respuestas(3, { '17': 6 }) }), 400, 'valor_no_valido'],
    [cuerpo({ respuestas: respuestas(3, { '17': 0 }) }), 400, 'valor_no_valido'],
    [cuerpo({ respuestas: respuestas(3, { '17': 2.5 }) }), 400, 'valor_no_valido'],
    [cuerpo({ respuestas: respuestas(3, { '17': '3' }) }), 400, 'valor_no_valido'],
    [cuerpo({ respuestas: respuestas(3, { '20': 3 }) }), 400, 'id_pregunta_no_valido'],
    [cuerpo({ respuestas: respuestas(3, { 'abc': 3 }) }), 400, 'id_pregunta_no_valido'],
    [cuerpo({ respuestas: Object.fromEntries(IDS.slice(1).map((i) => [String(i), 3])) }), 400, 'respuestas_incompletas'],
    [cuerpo({ respuestas: [3, 3, 3] }), 400, 'respuestas_no_validas'],
    [cuerpo({ id_entrega: 'no-es-uuid' }), 400, 'id_entrega_no_valido'],
    [cuerpo({ version: 'otra-version' }), 400, 'version_no_corresponde'],
    [cuerpo({ actividad: 'actividad-inexistente' }), 403, 'actividad_no_disponible'],
    [{ ...cuerpo(), nombre: 'Ana' }, 400, 'campos_no_validos'],
    ['{no es json', 400, 'json_no_valido'],
  ];
  for (const [datos, estado, codigo] of casos) {
    const r = await h(solicitud(datos));
    const j = await r.json();
    assertEquals([r.status, j.codigo], [estado, codigo], JSON.stringify(datos).slice(0, 80));
  }
  assertEquals(filas.size, 0);
});

Deno.test('origen no permitido, método y tipo de contenido', async () => {
  const { repo } = repoMemoria();
  const h = crearManejador({ repositorio: repo, origenesPermitidos: [ORIGEN] });
  assertEquals((await h(solicitud(cuerpo(), { origen: 'https://otro-sitio.example' }))).status, 403);
  assertEquals((await h(solicitud(null, { metodo: 'GET' }))).status, 405);
  assertEquals((await h(solicitud(cuerpo(), { tipo: 'text/plain' }))).status, 415);
  const pre = await h(new Request('http://local/x', { method: 'OPTIONS', headers: { origin: ORIGEN } }));
  assertEquals(pre.status, 204);
  assertEquals(pre.headers.get('access-control-allow-origin'), ORIGEN);
  const preMal = await h(new Request('http://local/x', { method: 'OPTIONS', headers: { origin: 'https://malo.example' } }));
  assertEquals(preMal.status, 403);
});

Deno.test('cuerpo demasiado grande', async () => {
  const { repo } = repoMemoria();
  const h = crearManejador({ repositorio: repo, origenesPermitidos: [ORIGEN] });
  const r = await h(solicitud(cuerpo({ respuestas: respuestas(3, { relleno: 'x'.repeat(5000) }) })));
  assertEquals(r.status, 413);
});

Deno.test('actividad cerrada', async () => {
  const { repo, cerrar } = repoMemoria();
  const h = crearManejador({ repositorio: repo, origenesPermitidos: [ORIGEN] });
  cerrar();
  const r = await h(solicitud(cuerpo()));
  assertEquals(r.status, 403);
  assertEquals((await r.json()).codigo, 'actividad_no_disponible');
});

Deno.test('validarEstructura normaliza el identificador a minúsculas', () => {
  const v = validarEstructura(cuerpo({ id_entrega: 'AAAAAAAA-AAAA-4AAA-8AAA-AAAAAAAAAAAA' }));
  assertEquals(v.ok && v.datos.id_entrega, 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa');
});
