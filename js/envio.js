// Envío de la entrega a la Edge Function de Supabase.
// Solo se confirma el guardado cuando el servidor responde con éxito y devuelve el mismo
// identificador de entrega. Cualquier otra situación se informa como no guardada.

import { ESTADOS_ENVIO } from './recorrido.js';

const HOSTS_LOCALES = new Set(['localhost', '127.0.0.1', '[::1]']);

export function endpointValido(endpoint) {
  if (typeof endpoint !== 'string' || endpoint.trim() === '') return false;
  try {
    const u = new URL(endpoint);
    if (u.protocol === 'https:') return true;
    // http solo se admite para pruebas locales (por ejemplo, supabase functions serve).
    return u.protocol === 'http:' && HOSTS_LOCALES.has(u.hostname);
  } catch {
    return false;
  }
}

const DETALLES = {
  json_no_valido: 'formato no válido',
  cuerpo_no_valido: 'formato no válido',
  campos_no_validos: 'campos no válidos',
  id_entrega_no_valido: 'código de entrega no válido',
  actividad_no_valida: 'actividad no válida',
  version_no_valida: 'versión no válida',
  version_no_corresponde: 'la versión del cuestionario no corresponde a la actividad',
  respuestas_no_validas: 'respuestas no válidas',
  respuestas_incompletas: 'faltan respuestas',
  id_pregunta_no_valido: 'pregunta no reconocida',
  valor_no_valido: 'valor fuera de la escala',
  conflicto_id_entrega: 'el código de entrega ya se usó con otras respuestas',
  origen_no_permitido: 'este sitio no está autorizado para enviar entregas',
  tipo_contenido_no_valido: 'formato no válido',
  cuerpo_demasiado_grande: 'formato no válido',
};

export async function enviarEntrega(payload, { endpoint, tiempoMaximoMs = 15000, fetchImpl = globalThis.fetch } = {}) {
  if (!endpointValido(endpoint)) return { estado: ESTADOS_ENVIO.SIN_CONFIGURACION };

  const control = new AbortController();
  const temporizador = setTimeout(() => control.abort(), tiempoMaximoMs);
  let respuesta;
  try {
    respuesta = await fetchImpl(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal: control.signal,
      credentials: 'omit',
      cache: 'no-store',
      referrerPolicy: 'no-referrer',
    });
  } catch (error) {
    clearTimeout(temporizador);
    // Si se agotó el tiempo, el servidor pudo haber recibido la entrega: el reintento es seguro.
    return { estado: control.signal.aborted ? ESTADOS_ENVIO.INCIERTO : ESTADOS_ENVIO.FALLIDO };
  }
  clearTimeout(temporizador);

  let datos = null;
  try {
    datos = await respuesta.json();
  } catch {
    datos = null;
  }

  if (respuesta.ok) {
    if (datos && datos.ok === true && datos.id_entrega === payload.id_entrega) {
      return { estado: datos.duplicado ? ESTADOS_ENVIO.DUPLICADO : ESTADOS_ENVIO.GUARDADO, datos };
    }
    return { estado: ESTADOS_ENVIO.INCIERTO };
  }

  const codigo = datos && typeof datos.codigo === 'string' ? datos.codigo : '';
  if (respuesta.status === 403 && codigo === 'actividad_no_disponible') return { estado: ESTADOS_ENVIO.CERRADO };
  if (respuesta.status === 429 || respuesta.status >= 500) return { estado: ESTADOS_ENVIO.FALLIDO };
  if (respuesta.status >= 400) {
    return { estado: ESTADOS_ENVIO.RECHAZADO, detalle: DETALLES[codigo] || `código ${respuesta.status}` };
  }
  return { estado: ESTADOS_ENVIO.INCIERTO };
}
