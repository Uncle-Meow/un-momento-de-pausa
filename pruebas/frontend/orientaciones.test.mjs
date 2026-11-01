import test from 'node:test';
import assert from 'node:assert/strict';
import { CUESTIONARIO } from '../../js/datos/cuestionario.js';
import { ORIENTACIONES } from '../../js/datos/orientaciones.js';
import { calcularResumen } from '../../js/puntaje.js';

function resumenConTotal(total) {
  let resto = total - 10;
  const respuestas = Object.fromEntries(CUESTIONARIO.preguntas.map((p) => {
    const adicional = Math.min(resto, 4);
    resto -= adicional;
    return [p.id, 1 + adicional];
  }));
  return calcularResumen(respuestas, CUESTIONARIO.preguntas, CUESTIONARIO.escala);
}

test('los 41 totales posibles pertenecen exactamente a los cinco rangos acordados', () => {
  const rangos = [[10, 14], [15, 24], [25, 34], [35, 44], [45, 50]];
  for (let total = 10; total <= 50; total++) {
    const r = resumenConTotal(total);
    const esperado = rangos.findIndex(([min, max]) => total >= min && total <= max) + 1;
    assert.equal(r.suma, total);
    assert.equal(r.nivelFrecuencia, esperado, `total ${total}`);
  }
});

test('cada rango tiene tres recomendaciones y una frase; se conserva la edición del equipo', () => {
  assert.deepEqual(ORIENTACIONES.map((o) => o.nivel), [1, 2, 3, 4, 5]);
  for (const o of ORIENTACIONES) {
    assert.equal(o.recomendaciones.length, 3);
    assert.ok(o.frase && o.titulo && o.frecuencia);
  }
  assert.equal(ORIENTACIONES[0].recomendaciones[1], 'Procura dormir 7 horas o más.');
});

test('una respuesta extrema no se convierte en un diagnóstico global', () => {
  const r = resumenConTotal(14); // un 5 y nueve 1
  assert.equal(r.promedio, 1.4);
  assert.equal(r.nivelFrecuencia, 1);
  assert.equal(ORIENTACIONES[0].frecuencia, 'Nunca');
});

test('no se calcula un resultado parcial o sin preguntas', () => {
  assert.equal(calcularResumen({}, CUESTIONARIO.preguntas, CUESTIONARIO.escala), null);
  assert.equal(calcularResumen({}, [], CUESTIONARIO.escala), null);
});
