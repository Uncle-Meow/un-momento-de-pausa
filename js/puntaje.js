// Cálculo transparente del resumen individual: suma y promedio de las respuestas.
// Rangos descriptivos: redondeo del promedio a la opción de frecuencia más cercana.
// No son puntos de corte ni interpretaciones clínicas.

export function valoresEscala(escala) {
  return escala.map((o) => o.valor);
}

export function esValorValido(valor, escala) {
  return Number.isInteger(valor) && valoresEscala(escala).includes(valor);
}

// Devuelve null si falta alguna respuesta válida.
export function calcularResumen(respuestas, preguntas, escala) {
  if (!preguntas.length || !escala.length) return null;
  const valores = valoresEscala(escala);
  const minimo = Math.min(...valores);
  const maximo = Math.max(...valores);
  let suma = 0;
  for (const p of preguntas) {
    const v = respuestas[p.id];
    if (!esValorValido(v, escala)) return null;
    suma += v;
  }
  const n = preguntas.length;
  return {
    suma,
    promedio: suma / n,
    sumaMinima: n * minimo,
    sumaMaxima: n * maximo,
    escalaMinima: minimo,
    escalaMaxima: maximo,
    n,
    // Con 10 preguntas: 10–14, 15–24, 25–34, 35–44 y 45–50 puntos.
    nivelFrecuencia: Math.round(suma / n),
  };
}

export function formatearPromedio(promedio, idioma = 'es-CR') {
  return new Intl.NumberFormat(idioma, { minimumFractionDigits: 1, maximumFractionDigits: 1 }).format(promedio);
}
