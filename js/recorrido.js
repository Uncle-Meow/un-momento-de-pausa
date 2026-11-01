// Estado del recorrido y reglas de avance. No depende del DOM, por lo que se prueba en Node.
//
// Todas las transiciones pasan por métodos con guardas: si una acción no está permitida
// (por ejemplo, avanzar sin respuesta), el método devuelve false y el estado no cambia,
// sin importar si la orden vino de un botón, del teclado o de una llamada interna.

import { calcularResumen, esValorValido } from './puntaje.js';

export const PANTALLAS = Object.freeze({
  INICIO: 'inicio',
  INSTRUCCIONES: 'instrucciones',
  PREGUNTA: 'pregunta',
  REVISION: 'revision',
  RESULTADO: 'resultado',
});

export const ESTADOS_ENVIO = Object.freeze({
  NINGUNO: 'ninguno',
  ENVIANDO: 'enviando',
  GUARDADO: 'guardado',
  DUPLICADO: 'duplicado',
  FALLIDO: 'fallido',
  INCIERTO: 'incierto',
  RECHAZADO: 'rechazado',
  CERRADO: 'cerrado',
  SIN_CONFIGURACION: 'sin-configuracion',
});

const REINTENTABLES = new Set([ESTADOS_ENVIO.FALLIDO, ESTADOS_ENVIO.INCIERTO, ESTADOS_ENVIO.SIN_CONFIGURACION]);
const FINALIZADOS = new Set([ESTADOS_ENVIO.GUARDADO, ESTADOS_ENVIO.DUPLICADO]);

export function generarIdEntrega(cripto = globalThis.crypto) {
  if (cripto && typeof cripto.randomUUID === 'function') return cripto.randomUUID();
  // Respaldo para contextos sin randomUUID: UUID v4 con getRandomValues.
  const b = new Uint8Array(16);
  cripto.getRandomValues(b);
  b[6] = (b[6] & 0x0f) | 0x40;
  b[8] = (b[8] & 0x3f) | 0x80;
  const h = [...b].map((x) => x.toString(16).padStart(2, '0')).join('');
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}

function estadoVacio() {
  return {
    pantalla: PANTALLAS.INICIO,
    indice: 0,
    aceptado: false,
    respuestas: {},
    desdeRevision: false,
    modoLectura: false,
    entrega: { payload: null, estado: ESTADOS_ENVIO.NINGUNO, detalle: '' },
  };
}

export class Recorrido {
  constructor(cuestionario, { actividad, almacen = null, clave = 'pausa-borrador', generarId = generarIdEntrega } = {}) {
    this.cuestionario = cuestionario;
    this.actividad = actividad;
    this.almacen = almacen;
    this.clave = clave;
    this.generarId = generarId;
    this.estado = estadoVacio();
    this.restaurado = false;
  }

  // ---- Consultas -------------------------------------------------------------------------

  get preguntas() {
    return this.cuestionario.preguntas;
  }
  get total() {
    return this.preguntas.length;
  }
  get pantalla() {
    return this.estado.pantalla;
  }
  get indice() {
    return this.estado.indice;
  }
  get preguntaActual() {
    return this.preguntas[this.estado.indice];
  }
  get entrega() {
    return this.estado.entrega;
  }
  get congelado() {
    // Una vez preparada la entrega, las respuestas quedan fijas para que los reintentos
    // envíen exactamente el mismo contenido con el mismo identificador.
    return this.estado.entrega.payload !== null;
  }

  respuestaDe(id) {
    const v = this.estado.respuestas[id];
    return esValorValido(v, this.cuestionario.escala) ? v : null;
  }
  estaRespondida(indice) {
    const p = this.preguntas[indice];
    return Boolean(p) && this.respuestaDe(p.id) !== null;
  }
  respondidas() {
    return this.preguntas.reduce((n, p) => n + (this.respuestaDe(p.id) !== null ? 1 : 0), 0);
  }
  pendientes() {
    return this.total - this.respondidas();
  }
  completas() {
    return this.pendientes() === 0;
  }
  primeraSinResponder() {
    const i = this.preguntas.findIndex((p) => this.respuestaDe(p.id) === null);
    return i === -1 ? 0 : i;
  }
  esUltima() {
    return this.estado.indice === this.total - 1;
  }
  puedeAvanzar() {
    return this.estado.pantalla === PANTALLAS.PREGUNTA && this.estaRespondida(this.estado.indice);
  }
  puedeRetroceder() {
    const { pantalla, indice, modoLectura } = this.estado;
    if (pantalla === PANTALLAS.PREGUNTA) return indice > 0;
    if (pantalla === PANTALLAS.REVISION) return !modoLectura && !this.congelado;
    if (pantalla === PANTALLAS.INSTRUCCIONES) return true;
    return false;
  }
  puedeEntregar() {
    return (
      this.estado.pantalla === PANTALLAS.REVISION &&
      !this.estado.modoLectura &&
      !this.congelado &&
      this.estado.aceptado &&
      this.completas()
    );
  }
  puedeReintentar() {
    return this.congelado && REINTENTABLES.has(this.estado.entrega.estado);
  }
  resumen() {
    return calcularResumen(this.estado.respuestas, this.preguntas, this.cuestionario.escala);
  }

  // ---- Acciones --------------------------------------------------------------------------

  empezar() {
    if (this.estado.pantalla !== PANTALLAS.INICIO) return false;
    this.estado.pantalla = PANTALLAS.INSTRUCCIONES;
    return this._cambio();
  }

  aceptar(valor) {
    if (this.estado.pantalla !== PANTALLAS.INSTRUCCIONES) return false;
    this.estado.aceptado = valor === true;
    return this._cambio();
  }

  comenzar() {
    if (this.estado.pantalla !== PANTALLAS.INSTRUCCIONES || !this.estado.aceptado) return false;
    this.estado.pantalla = PANTALLAS.PREGUNTA;
    this.estado.indice = this.primeraSinResponder();
    this.estado.desdeRevision = false;
    return this._cambio();
  }

  responder(valor) {
    if (this.estado.pantalla !== PANTALLAS.PREGUNTA || this.congelado) return false;
    if (!esValorValido(valor, this.cuestionario.escala)) return false;
    this.estado.respuestas[this.preguntaActual.id] = valor;
    return this._cambio();
  }

  // Acción principal de la pantalla de pregunta: «Siguiente», «Revisar respuestas»
  // o «Volver a la revisión». Siempre exige una respuesta en la pregunta actual.
  avanzar() {
    if (!this.puedeAvanzar()) return false;
    if (this.estado.desdeRevision || this.esUltima()) {
      this.estado.pantalla = PANTALLAS.REVISION;
      this.estado.desdeRevision = false;
      this.estado.modoLectura = false;
    } else {
      this.estado.indice += 1;
    }
    return this._cambio();
  }

  retroceder() {
    if (!this.puedeRetroceder()) return false;
    const { pantalla } = this.estado;
    if (pantalla === PANTALLAS.PREGUNTA) {
      this.estado.indice -= 1;
    } else if (pantalla === PANTALLAS.REVISION) {
      this.estado.pantalla = PANTALLAS.PREGUNTA;
      this.estado.indice = this.total - 1;
      this.estado.desdeRevision = false;
    } else if (pantalla === PANTALLAS.INSTRUCCIONES) {
      this.estado.pantalla = PANTALLAS.INICIO;
    }
    return this._cambio();
  }

  editar(indice) {
    if (this.estado.pantalla !== PANTALLAS.REVISION || this.estado.modoLectura || this.congelado) return false;
    if (!Number.isInteger(indice) || indice < 0 || indice >= this.total) return false;
    this.estado.pantalla = PANTALLAS.PREGUNTA;
    this.estado.indice = indice;
    this.estado.desdeRevision = true;
    return this._cambio();
  }

  // Congela las respuestas y crea (una sola vez) el identificador aleatorio de la entrega.
  prepararEntrega() {
    if (!this.puedeEntregar() && !this.puedeReintentar()) return null;
    if (!this.congelado) {
      const respuestas = {};
      for (const p of this.preguntas) respuestas[String(p.id)] = this.respuestaDe(p.id);
      this.estado.entrega.payload = {
        id_entrega: this.generarId(),
        actividad: this.actividad,
        version: this.cuestionario.version,
        respuestas,
      };
    }
    this.estado.entrega.estado = ESTADOS_ENVIO.ENVIANDO;
    this.estado.entrega.detalle = '';
    this._cambio();
    return this.estado.entrega.payload;
  }

  registrarResultadoEnvio({ estado, detalle = '' }) {
    if (!this.congelado || this.estado.entrega.estado !== ESTADOS_ENVIO.ENVIANDO) return false;
    if (!Object.values(ESTADOS_ENVIO).includes(estado) || estado === ESTADOS_ENVIO.ENVIANDO) return false;
    this.estado.entrega.estado = estado;
    this.estado.entrega.detalle = detalle;
    this.estado.pantalla = PANTALLAS.RESULTADO;
    this.estado.modoLectura = false;
    return this._cambio();
  }

  verRespuestas() {
    if (this.estado.pantalla !== PANTALLAS.RESULTADO) return false;
    this.estado.pantalla = PANTALLAS.REVISION;
    this.estado.modoLectura = true;
    return this._cambio();
  }

  volverAlResumen() {
    if (this.estado.pantalla !== PANTALLAS.REVISION || !this.estado.modoLectura) return false;
    this.estado.pantalla = PANTALLAS.RESULTADO;
    this.estado.modoLectura = false;
    return this._cambio();
  }

  reiniciar() {
    this.estado = estadoVacio();
    this._borrarAlmacen();
    return true;
  }

  // ---- Borrador en sessionStorage ---------------------------------------------------------

  _cambio() {
    this._persistir();
    return true;
  }

  _persistir() {
    if (!this.almacen) return;
    if (FINALIZADOS.has(this.estado.entrega.estado)) {
      // Entrega confirmada: el borrador ya no es necesario.
      this._borrarAlmacen();
      return;
    }
    try {
      this.almacen.setItem(
        this.clave,
        JSON.stringify({ v: 1, version: this.cuestionario.version, actividad: this.actividad, estado: this.estado })
      );
    } catch {
      /* almacenamiento no disponible o lleno: se continúa sin borrador */
    }
  }

  _borrarAlmacen() {
    if (!this.almacen) return;
    try {
      this.almacen.removeItem(this.clave);
    } catch {
      /* sin acceso al almacenamiento */
    }
  }

  // Recupera un borrador válido de la misma versión y actividad. Devuelve true si lo restauró.
  restaurar() {
    if (!this.almacen) return false;
    let datos;
    try {
      datos = JSON.parse(this.almacen.getItem(this.clave) || 'null');
    } catch {
      datos = null;
    }
    if (!datos || datos.v !== 1 || datos.version !== this.cuestionario.version || datos.actividad !== this.actividad) {
      if (datos) this._borrarAlmacen();
      return false;
    }
    const e = datos.estado || {};
    const limpio = estadoVacio();
    const ids = new Set(this.preguntas.map((p) => String(p.id)));
    for (const [id, v] of Object.entries(e.respuestas || {})) {
      if (ids.has(id) && esValorValido(v, this.cuestionario.escala)) limpio.respuestas[id] = v;
    }
    limpio.aceptado = e.aceptado === true;
    limpio.indice = Number.isInteger(e.indice) && e.indice >= 0 && e.indice < this.total ? e.indice : 0;
    limpio.desdeRevision = e.desdeRevision === true;
    limpio.modoLectura = e.modoLectura === true;
    limpio.pantalla = Object.values(PANTALLAS).includes(e.pantalla) ? e.pantalla : PANTALLAS.INICIO;

    const p = e.entrega && e.entrega.payload;
    const payloadValido =
      p &&
      typeof p.id_entrega === 'string' &&
      p.actividad === this.actividad &&
      p.version === this.cuestionario.version &&
      p.respuestas &&
      Object.keys(p.respuestas).length === this.total &&
      this.preguntas.every((q) => esValorValido(p.respuestas[String(q.id)], this.cuestionario.escala));
    if (payloadValido) {
      limpio.entrega.payload = p;
      // Las respuestas visibles son las congeladas en la entrega.
      limpio.respuestas = { ...p.respuestas };
      const est = e.entrega.estado;
      limpio.entrega.estado =
        est === ESTADOS_ENVIO.ENVIANDO || !Object.values(ESTADOS_ENVIO).includes(est) ? ESTADOS_ENVIO.INCIERTO : est;
      limpio.entrega.detalle = typeof e.entrega.detalle === 'string' ? e.entrega.detalle : '';
      if (limpio.pantalla !== PANTALLAS.REVISION) limpio.pantalla = PANTALLAS.RESULTADO;
      if (limpio.pantalla === PANTALLAS.REVISION) limpio.modoLectura = true;
    } else {
      if (limpio.pantalla === PANTALLAS.RESULTADO) limpio.pantalla = PANTALLAS.REVISION;
      limpio.modoLectura = false;
      if (!limpio.aceptado && (limpio.pantalla === PANTALLAS.PREGUNTA || limpio.pantalla === PANTALLAS.REVISION)) {
        limpio.pantalla = PANTALLAS.INSTRUCCIONES;
      }
      if (limpio.pantalla === PANTALLAS.REVISION && !limpio.desdeRevision && !this._completasEn(limpio)) {
        limpio.pantalla = PANTALLAS.PREGUNTA;
        limpio.indice = this._primeraSinResponderEn(limpio);
      }
    }
    if (limpio.pantalla !== PANTALLAS.PREGUNTA) limpio.desdeRevision = false;
    this.estado = limpio;
    this.restaurado = true;
    this._persistir();
    return true;
  }

  _completasEn(estado) {
    return this.preguntas.every((p) => esValorValido(estado.respuestas[p.id], this.cuestionario.escala));
  }
  _primeraSinResponderEn(estado) {
    const i = this.preguntas.findIndex((p) => !esValorValido(estado.respuestas[p.id], this.cuestionario.escala));
    return i === -1 ? 0 : i;
  }
}
