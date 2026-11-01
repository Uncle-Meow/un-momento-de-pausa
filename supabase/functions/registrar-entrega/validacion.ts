// Validación pura de la entrega (sin red ni base de datos), reutilizada por las pruebas.

export type Respuestas = Record<string, number>;

export interface EntregaValidada {
  id_entrega: string;
  actividad: string;
  version: string;
  respuestas: Respuestas;
}

export type ResultadoValidacion =
  | { ok: true; datos: EntregaValidada }
  | { ok: false; codigo: string };

const CAMPOS = ['id_entrega', 'actividad', 'version', 'respuestas'];
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const ACTIVIDAD = /^[a-z0-9][a-z0-9-]{2,63}$/;
const VERSION = /^[A-Za-z0-9._-]{1,32}$/;
const ID_PREGUNTA = /^[0-9]{1,4}$/;

function esObjetoPlano(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

// Estructura general: campos exactos, tipos y formatos. No consulta la base de datos.
export function validarEstructura(cuerpo: unknown): ResultadoValidacion {
  if (!esObjetoPlano(cuerpo)) return { ok: false, codigo: 'cuerpo_no_valido' };
  const claves = Object.keys(cuerpo);
  if (claves.length !== CAMPOS.length || !CAMPOS.every((c) => claves.includes(c))) {
    return { ok: false, codigo: 'campos_no_validos' };
  }
  const { id_entrega, actividad, version, respuestas } = cuerpo;
  if (typeof id_entrega !== 'string' || !UUID.test(id_entrega)) return { ok: false, codigo: 'id_entrega_no_valido' };
  if (typeof actividad !== 'string' || !ACTIVIDAD.test(actividad)) return { ok: false, codigo: 'actividad_no_valida' };
  if (typeof version !== 'string' || !VERSION.test(version)) return { ok: false, codigo: 'version_no_valida' };
  if (!esObjetoPlano(respuestas)) return { ok: false, codigo: 'respuestas_no_validas' };
  const entradas = Object.entries(respuestas);
  if (entradas.length === 0 || entradas.length > 100) return { ok: false, codigo: 'respuestas_no_validas' };
  const limpias: Respuestas = {};
  for (const [id, valor] of entradas) {
    if (!ID_PREGUNTA.test(id)) return { ok: false, codigo: 'id_pregunta_no_valido' };
    if (typeof valor !== 'number' || !Number.isInteger(valor) || valor < 1 || valor > 5) {
      return { ok: false, codigo: 'valor_no_valido' };
    }
    limpias[String(Number(id))] = valor;
  }
  if (Object.keys(limpias).length !== entradas.length) return { ok: false, codigo: 'id_pregunta_no_valido' };
  return { ok: true, datos: { id_entrega: id_entrega.toLowerCase(), actividad, version, respuestas: limpias } };
}

// Acepta solo y exactamente los identificadores de la versión; devuelve las respuestas en
// el orden de la versión.
export function validarContraVersion(
  respuestas: Respuestas,
  itemIds: number[],
): { ok: true; respuestas: Respuestas } | { ok: false; codigo: string } {
  const esperadas = new Set(itemIds.map((n) => String(n)));
  const recibidas = Object.keys(respuestas);
  for (const id of recibidas) {
    if (!esperadas.has(id)) return { ok: false, codigo: 'id_pregunta_no_valido' };
  }
  if (recibidas.length !== esperadas.size) return { ok: false, codigo: 'respuestas_incompletas' };
  const ordenadas: Respuestas = {};
  for (const id of itemIds) ordenadas[String(id)] = respuestas[String(id)];
  return { ok: true, respuestas: ordenadas };
}

export function calcularTotales(respuestas: Respuestas): { total: number; promedio: number } {
  const valores = Object.values(respuestas);
  const total = valores.reduce((a, b) => a + b, 0);
  return { total, promedio: Math.round((total / valores.length) * 100) / 100 };
}

export function mismasRespuestas(a: Respuestas, b: Respuestas): boolean {
  const ka = Object.keys(a);
  const kb = Object.keys(b);
  if (ka.length !== kb.length) return false;
  return ka.every((k) => Number(a[k]) === Number(b[k]));
}
