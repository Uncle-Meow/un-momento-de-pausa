// Pruebas de la lógica del recorrido, el puntaje y el envío (sin navegador).
// Ejecutar: node --test pruebas/frontend/

import test from 'node:test';
import assert from 'node:assert/strict';
import { CUESTIONARIO } from '../../js/datos/cuestionario.js';
import { Recorrido, PANTALLAS, ESTADOS_ENVIO } from '../../js/recorrido.js';
import { calcularResumen, formatearPromedio } from '../../js/puntaje.js';
import { enviarEntrega, endpointValido } from '../../js/envio.js';

class AlmacenMemoria {
  constructor() {
    this.m = new Map();
  }
  getItem(k) {
    return this.m.has(k) ? this.m.get(k) : null;
  }
  setItem(k, v) {
    this.m.set(k, String(v));
  }
  removeItem(k) {
    this.m.delete(k);
  }
}

const OPC = { actividad: 'habilidades-liderazgo-2026', clave: 'prueba' };
const nuevo = (almacen = new AlmacenMemoria()) => new Recorrido(CUESTIONARIO, { ...OPC, almacen });

function hastaPreguntas(r) {
  r.empezar();
  r.aceptar(true);
  assert.equal(r.comenzar(), true);
}

test('el cuestionario tiene 10 preguntas con los ID originales y escala 1 a 5', () => {
  assert.equal(CUESTIONARIO.preguntas.length, 10);
  assert.deepEqual(
    CUESTIONARIO.preguntas.map((p) => p.id),
    [1, 3, 4, 7, 8, 11, 13, 15, 16, 17]
  );
  assert.deepEqual(
    CUESTIONARIO.escala.map((o) => `${o.valor}=${o.etiqueta}`),
    ['1=Nunca', '2=Rara vez', '3=Algunas veces', '4=A menudo', '5=Siempre']
  );
});

test('no se comienza sin aceptar la participación', () => {
  const r = nuevo();
  r.empezar();
  assert.equal(r.comenzar(), false);
  assert.equal(r.pantalla, PANTALLAS.INSTRUCCIONES);
  r.aceptar(true);
  assert.equal(r.comenzar(), true);
  assert.equal(r.pantalla, PANTALLAS.PREGUNTA);
});

test('cada pregunta empieza sin respuesta y no se puede avanzar sin elegir', () => {
  const r = nuevo();
  hastaPreguntas(r);
  assert.equal(r.respuestaDe(r.preguntaActual.id), null);
  assert.equal(r.puedeAvanzar(), false);
  assert.equal(r.avanzar(), false);
  assert.equal(r.indice, 0);
  // valores fuera de escala no cuentan
  for (const v of [0, 6, 2.5, '3', null, undefined, NaN]) assert.equal(r.responder(v), false);
  assert.equal(r.puedeAvanzar(), false);
  // el valor central también debe elegirse explícitamente, y entonces sí habilita el avance
  assert.equal(r.responder(3), true);
  assert.equal(r.puedeAvanzar(), true);
  assert.equal(r.avanzar(), true);
  assert.equal(r.indice, 1);
  assert.equal(r.puedeAvanzar(), false, 'la pregunta 2 empieza sin respuesta');
});

test('Anterior no existe en la primera pregunta y conserva respuestas al retroceder', () => {
  const r = nuevo();
  hastaPreguntas(r);
  assert.equal(r.puedeRetroceder(), false);
  assert.equal(r.retroceder(), false);
  r.responder(4);
  r.avanzar();
  r.responder(2);
  assert.equal(r.retroceder(), true);
  assert.equal(r.indice, 0);
  assert.equal(r.respuestaDe(1), 4);
  assert.equal(r.puedeAvanzar(), true, 'pregunta ya respondida: puede avanzar');
  r.avanzar();
  assert.equal(r.respuestaDe(r.preguntas[1].id), 2);
});

test('el progreso se calcula con respuestas reales, no con clics', () => {
  const r = nuevo();
  hastaPreguntas(r);
  assert.equal(r.respondidas(), 0);
  assert.equal(r.pendientes(), 10);
  r.responder(1);
  assert.equal(r.respondidas(), 1);
  r.avanzar();
  r.avanzar(); // sin respuesta: ignorado
  assert.equal(r.indice, 1);
  assert.equal(r.pendientes(), 9);
});

test('la última pregunta lleva a revisión solo con respuesta; entrega exige las 10', () => {
  const r = nuevo();
  hastaPreguntas(r);
  for (let i = 0; i < 9; i++) {
    r.responder(5);
    r.avanzar();
  }
  assert.equal(r.esUltima(), true);
  assert.equal(r.avanzar(), false);
  assert.equal(r.pantalla, PANTALLAS.PREGUNTA);
  r.responder(5);
  assert.equal(r.avanzar(), true);
  assert.equal(r.pantalla, PANTALLAS.REVISION);
  assert.equal(r.puedeEntregar(), true);
});

test('editar desde la revisión vuelve a la revisión', () => {
  const r = nuevo();
  hastaPreguntas(r);
  for (let i = 0; i < 10; i++) {
    r.responder(2);
    r.avanzar();
  }
  assert.equal(r.editar(6), true);
  assert.equal(r.indice, 6);
  r.responder(4);
  assert.equal(r.avanzar(), true);
  assert.equal(r.pantalla, PANTALLAS.REVISION);
  assert.equal(r.respuestaDe(r.preguntas[6].id), 4);
});

test('suma mínima 10, máxima 50 y promedio con un decimal', () => {
  const todas = (v) => Object.fromEntries(CUESTIONARIO.preguntas.map((p) => [p.id, v]));
  const min = calcularResumen(todas(1), CUESTIONARIO.preguntas, CUESTIONARIO.escala);
  const max = calcularResumen(todas(5), CUESTIONARIO.preguntas, CUESTIONARIO.escala);
  assert.equal(min.suma, 10);
  assert.equal(max.suma, 50);
  assert.equal(min.promedio, 1);
  assert.equal(max.promedio, 5);
  const mixto = { ...todas(3), 1: 5, 3: 4 };
  const r = calcularResumen(mixto, CUESTIONARIO.preguntas, CUESTIONARIO.escala);
  assert.equal(r.suma, 33);
  assert.equal(formatearPromedio(r.promedio, 'es-CR'), '3,3');
  assert.equal(calcularResumen({ ...todas(3), 17: undefined }, CUESTIONARIO.preguntas, CUESTIONARIO.escala), null);
});

test('el borrador se recupera tras recargar y se elimina al confirmar el guardado', () => {
  const almacen = new AlmacenMemoria();
  const r = nuevo(almacen);
  hastaPreguntas(r);
  r.responder(4);
  r.avanzar();
  r.responder(1);
  const r2 = nuevo(almacen);
  assert.equal(r2.restaurar(), true);
  assert.equal(r2.pantalla, PANTALLAS.PREGUNTA);
  assert.equal(r2.indice, 1);
  assert.equal(r2.respuestaDe(1), 4);
  assert.equal(r2.respuestaDe(r2.preguntas[1].id), 1);
  for (let i = 1; i < 10; i++) {
    r2.responder(3);
    r2.avanzar();
  }
  const payload = r2.prepararEntrega();
  assert.ok(payload.id_entrega);
  assert.equal(Object.keys(payload.respuestas).length, 10);
  r2.registrarResultadoEnvio({ estado: ESTADOS_ENVIO.GUARDADO });
  assert.equal(almacen.getItem('prueba'), null, 'borrador eliminado al terminar');
});

test('un envío fallido conserva el mismo identificador para reintentar y congela las respuestas', () => {
  const almacen = new AlmacenMemoria();
  const r = nuevo(almacen);
  hastaPreguntas(r);
  for (let i = 0; i < 10; i++) {
    r.responder(2);
    r.avanzar();
  }
  const p1 = r.prepararEntrega();
  r.registrarResultadoEnvio({ estado: ESTADOS_ENVIO.FALLIDO });
  assert.equal(r.pantalla, PANTALLAS.RESULTADO);
  assert.equal(r.puedeReintentar(), true);
  // tras recargar durante el reintento
  const p2 = r.prepararEntrega();
  const r2 = nuevo(almacen);
  r2.restaurar();
  assert.equal(r2.entrega.estado, ESTADOS_ENVIO.INCIERTO, 'recarga durante el envío: estado incierto');
  assert.equal(r2.entrega.payload.id_entrega, p1.id_entrega);
  assert.equal(p2.id_entrega, p1.id_entrega);
  assert.equal(r2.verRespuestas(), true);
  assert.equal(r2.editar(0), false, 'respuestas congeladas tras el primer intento');
});

test('reiniciar borra el borrador', () => {
  const almacen = new AlmacenMemoria();
  const r = nuevo(almacen);
  hastaPreguntas(r);
  r.responder(3);
  r.reiniciar();
  assert.equal(almacen.getItem('prueba'), null);
  assert.equal(r.pantalla, PANTALLAS.INICIO);
});

test('borradores de otra versión se descartan', () => {
  const almacen = new AlmacenMemoria();
  almacen.setItem('prueba', JSON.stringify({ v: 1, version: 'otra', actividad: OPC.actividad, estado: {} }));
  const r = nuevo(almacen);
  assert.equal(r.restaurar(), false);
  assert.equal(almacen.getItem('prueba'), null);
});

// ---- Envío -------------------------------------------------------------------------------

const PAYLOAD = { id_entrega: '0b8a7f8e-2f6c-4c1e-9d7a-0a1b2c3d4e5f', actividad: 'a', version: 'v', respuestas: {} };
const respuesta = (status, cuerpo) => ({ ok: status >= 200 && status < 300, status, json: async () => cuerpo });

test('endpoint: solo HTTPS (o http local para pruebas)', () => {
  assert.equal(endpointValido(''), false);
  assert.equal(endpointValido('http://ejemplo.com/f'), false);
  assert.equal(endpointValido('https://x.supabase.co/functions/v1/registrar-entrega'), true);
  assert.equal(endpointValido('http://127.0.0.1:54321/functions/v1/registrar-entrega'), true);
});

test('sin configuración no se simula el guardado', async () => {
  let llamado = false;
  const r = await enviarEntrega(PAYLOAD, { endpoint: '', fetchImpl: () => (llamado = true) });
  assert.equal(r.estado, ESTADOS_ENVIO.SIN_CONFIGURACION);
  assert.equal(llamado, false);
});

test('éxito solo con respuesta del servidor y el mismo identificador', async () => {
  const ok = await enviarEntrega(PAYLOAD, {
    endpoint: 'https://x/f',
    fetchImpl: async () => respuesta(201, { ok: true, id_entrega: PAYLOAD.id_entrega }),
  });
  assert.equal(ok.estado, ESTADOS_ENVIO.GUARDADO);
  const otro = await enviarEntrega(PAYLOAD, {
    endpoint: 'https://x/f',
    fetchImpl: async () => respuesta(200, { ok: true, id_entrega: 'otro' }),
  });
  assert.equal(otro.estado, ESTADOS_ENVIO.INCIERTO);
  const dup = await enviarEntrega(PAYLOAD, {
    endpoint: 'https://x/f',
    fetchImpl: async () => respuesta(200, { ok: true, id_entrega: PAYLOAD.id_entrega, duplicado: true }),
  });
  assert.equal(dup.estado, ESTADOS_ENVIO.DUPLICADO);
});

test('fallos de red, servidor, rechazo y actividad cerrada', async () => {
  const red = await enviarEntrega(PAYLOAD, { endpoint: 'https://x/f', fetchImpl: async () => { throw new TypeError('Failed to fetch'); } });
  assert.equal(red.estado, ESTADOS_ENVIO.FALLIDO);
  const s500 = await enviarEntrega(PAYLOAD, { endpoint: 'https://x/f', fetchImpl: async () => respuesta(500, {}) });
  assert.equal(s500.estado, ESTADOS_ENVIO.FALLIDO);
  const s400 = await enviarEntrega(PAYLOAD, { endpoint: 'https://x/f', fetchImpl: async () => respuesta(400, { codigo: 'valor_no_valido' }) });
  assert.equal(s400.estado, ESTADOS_ENVIO.RECHAZADO);
  assert.equal(s400.detalle, 'valor fuera de la escala');
  const cerrado = await enviarEntrega(PAYLOAD, { endpoint: 'https://x/f', fetchImpl: async () => respuesta(403, { codigo: 'actividad_no_disponible' }) });
  assert.equal(cerrado.estado, ESTADOS_ENVIO.CERRADO);
});

test('tiempo agotado: estado incierto (reintento seguro)', async () => {
  const r = await enviarEntrega(PAYLOAD, {
    endpoint: 'https://x/f',
    tiempoMaximoMs: 30,
    fetchImpl: (_u, { signal }) =>
      new Promise((_, rechazar) => signal.addEventListener('abort', () => rechazar(new DOMException('abort', 'AbortError')))),
  });
  assert.equal(r.estado, ESTADOS_ENVIO.INCIERTO);
});
