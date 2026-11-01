// Controlador de la interfaz: conecta el estado del recorrido con el DOM.

import { CONFIG } from './config.js';
import { CUESTIONARIO } from './datos/cuestionario.js';
import { ORIENTACIONES } from './datos/orientaciones.js';
import { TEXTOS } from './datos/textos.js';
import { Recorrido, PANTALLAS, ESTADOS_ENVIO } from './recorrido.js';
import { crearEscala } from './escala.js';
import { enviarEntrega, endpointValido } from './envio.js';
import { formatearPromedio } from './puntaje.js';
import { cargarBosque, dibujarEstrellas, crearControlMovimiento } from './escena.js';

const $ = (id) => document.getElementById(id);
const movimientoReducido = window.matchMedia('(prefers-reduced-motion: reduce)');

function texto(ruta) {
  return ruta.split('.').reduce((o, k) => (o == null ? undefined : o[k]), TEXTOS);
}

function aplicarTextos(raiz = document) {
  raiz.querySelectorAll('[data-t]').forEach((el) => {
    const v = texto(el.dataset.t);
    if (typeof v === 'string') el.textContent = v;
  });
}

function almacenSesion() {
  try {
    const s = window.sessionStorage;
    s.setItem('__prueba_pausa', '1');
    s.removeItem('__prueba_pausa');
    return s;
  } catch {
    return null;
  }
}

function elemento(tag, props = {}, hijos = []) {
  const el = document.createElement(tag);
  for (const [clave, valor] of Object.entries(props)) {
    if (clave === 'ariaHidden') el.setAttribute('aria-hidden', valor);
    else el[clave] = valor;
  }
  for (const h of [].concat(hijos)) el.append(h);
  return el;
}

// ---------------------------------------------------------------------------------------
// Contenido estático que proviene de los archivos de datos
// ---------------------------------------------------------------------------------------

function llenarContenidoFijo() {
  document.title = TEXTOS.app.tituloDocumento;
  aplicarTextos();
  $('texto-proposito').replaceChildren(...TEXTOS.inicio.proposito.map((t) => elemento('p', { textContent: t })));
  $('duracion-inicio').textContent = TEXTOS.inicio.duracion(CUESTIONARIO.preguntas.length);
  $('datos-instrucciones').textContent = TEXTOS.instrucciones.datos(CUESTIONARIO.preguntas.length);
  $('fuentes-orientaciones').replaceChildren(...TEXTOS.acerca.fuentes.map((f) =>
    elemento('li', {}, [f.texto, ' ', elemento('a', { href: f.url, textContent: f.url, rel: 'noopener', target: '_blank' })])
  ));
  $('lista-integrantes').replaceChildren(
    ...TEXTOS.acerca.integrantesNombres.map((n) => elemento('li', { textContent: n }))
  );
  const ref = TEXTOS.acerca.referencia;
  $('referencia-apa').replaceChildren(
    `${ref.autores} ${ref.titulo} `,
    elemento('i', { textContent: ref.revista }),
    `${ref.resto} `,
    elemento('a', { href: ref.doi, textContent: ref.doi, rel: 'noopener', target: '_blank' })
  );
  $('marcas-resultado').replaceChildren(
    ...CUESTIONARIO.escala.map((o) =>
      elemento('li', {}, [elemento('strong', { textContent: String(o.valor) }), o.etiqueta])
    )
  );
  $('leyenda-escala').textContent = TEXTOS.resultado.leyendaEscala;
}

// ---------------------------------------------------------------------------------------
// Escena
// ---------------------------------------------------------------------------------------

function redibujarEstrellas() {
  const w = window.innerWidth;
  const h = window.innerHeight;
  const estilo = getComputedStyle(document.documentElement);
  const margen = 16;
  const anchoColumna = Math.min(w - margen * 2, parseFloat(estilo.fontSize) * 44);
  const altoBosque = $('bosque').getBoundingClientRect().height || h * 0.3;
  const luna = document.querySelector('.luna').getBoundingClientRect();
  dibujarEstrellas($('estrellas'), {
    zonaTexto: { left: (w - anchoColumna) / 2, right: (w + anchoColumna) / 2, top: h * 0.03, bottom: h - altoBosque * 0.7 },
    luna: { cx: luna.left + luna.width / 2, cy: luna.top + luna.height / 2, r: luna.width / 2 },
    alturaBosque: altoBosque,
  });
}

// Marca las pantallas que tienen contenido oculto por debajo (para el desvanecido inferior).
function actualizarIndicadorDesplazamiento() {
  let mostrarPista = false;
  document.querySelectorAll('.pantalla:not([hidden])').forEach((s) => {
    const resto = s.scrollHeight - s.clientHeight - s.scrollTop;
    s.classList.toggle('mas-abajo', resto > 4);
    s.classList.toggle('desplazada', s.scrollTop > 2);
    if (['resultado', 'revision', 'instrucciones'].includes(s.dataset.pantalla) && resto > 4) mostrarPista = true;
  });
  $('pista-desplazamiento').hidden = !mostrarPista;
}

// ---------------------------------------------------------------------------------------
// Diálogos
// ---------------------------------------------------------------------------------------

function abrirDialogo(dialogo) {
  if (typeof dialogo.showModal === 'function') dialogo.showModal();
  else dialogo.setAttribute('open', '');
  dialogo.scrollTop = 0;
  dialogo.querySelector('[autofocus]')?.focus({ preventScroll: true });
}

function confirmar({ titulo, cuerpo, aceptar }) {
  const dialogo = $('dialogo-confirmar');
  if (typeof dialogo.showModal !== 'function') return Promise.resolve(window.confirm(`${titulo}\n\n${cuerpo}`));
  $('titulo-confirmar').textContent = titulo;
  $('texto-confirmar').textContent = cuerpo;
  $('confirmar-aceptar').textContent = aceptar;
  $('confirmar-cancelar').textContent = TEXTOS.confirmaciones.botonCancelar;
  dialogo.returnValue = '';
  return new Promise((resolve) => {
    dialogo.addEventListener('close', () => resolve(dialogo.returnValue === 'aceptar'), { once: true });
    dialogo.showModal();
    $('confirmar-cancelar').focus();
  });
}

// ---------------------------------------------------------------------------------------
// Modo de presentación
// ---------------------------------------------------------------------------------------

async function iniciarModoPresentacion() {
  document.body.classList.add('modo-presentacion');
  $('pantalla-presentacion').hidden = false;
  document.title = `${TEXTOS.presentacion.titulo} · QR`;
  const { iniciarPresentacion } = await import('./presentacion.js');
  iniciarPresentacion({
    config: CONFIG,
    textos: TEXTOS.presentacion,
    elementos: {
      lienzo: $('qr-lienzo'),
      enlace: $('enlace-publico'),
      aviso: $('aviso-presentacion'),
      botonPng: $('descargar-png'),
      botonSvg: $('descargar-svg'),
    },
  });
}

// ---------------------------------------------------------------------------------------
// Cuestionario
// ---------------------------------------------------------------------------------------

function iniciarCuestionario() {
  const recorrido = new Recorrido(CUESTIONARIO, {
    actividad: CONFIG.actividad,
    almacen: almacenSesion(),
    clave: CONFIG.claveBorrador,
  });
  recorrido.restaurar();

  const T = TEXTOS;
  const nav = $('navegacion');
  const botonPrimario = $('boton-primario');
  const botonSecundario = $('boton-secundario');
  const bloque = $('bloque-pregunta');
  const cuerpo = $('cuerpo-pregunta');
  const contenedorEscala = $('escala');
  const textoPregunta = $('texto-pregunta');
  const casilla = $('casilla-aceptacion');

  let pantallaMostrada = null;
  let indiceMostrado = null;
  let enviando = false;
  let temporizadorTransicion = null;

  const escala = crearEscala(contenedorEscala, {
    escala: CUESTIONARIO.escala,
    textos: T.pregunta,
    etiquetadoPor: 'texto-pregunta',
    alSeleccionar(valor) {
      // La selección solo registra el valor; nunca avanza de pregunta por sí sola.
      if (recorrido.responder(valor)) {
        escala.mostrar(valor);
        actualizarProgreso();
        renderNavegacion();
      }
    },
  });

  // ---- Navegación compartida ------------------------------------------------------------

  function configurarBoton(boton, cfg) {
    if (!cfg) {
      boton.hidden = true;
      boton.dataset.accion = '';
      return;
    }
    boton.hidden = false;
    boton.dataset.accion = cfg.accion;
    const partes = [];
    if (cfg.flechaAntes) partes.push(elemento('span', { className: 'flecha', textContent: cfg.flechaAntes, ariaHidden: 'true' }));
    partes.push(elemento('span', { className: 'texto-boton', textContent: cfg.texto }));
    if (cfg.flecha) partes.push(elemento('span', { className: 'flecha', textContent: cfg.flecha, ariaHidden: 'true' }));
    boton.replaceChildren(...partes);
    boton.title = cfg.flechaAntes ? cfg.texto : '';
    // Oculto con espacio reservado: invisible, sin foco y fuera del árbol de accesibilidad.
    const reservado = Boolean(cfg.reservado);
    boton.classList.toggle('reservado', reservado);
    boton.inert = reservado;
    if (reservado) boton.setAttribute('aria-hidden', 'true');
    else boton.removeAttribute('aria-hidden');
    boton.disabled = Boolean(cfg.deshabilitado);
    // «Comenzar» sin aceptación: sigue enfocable y, al pulsarlo, lleva a la casilla.
    if (cfg.inactivo) boton.setAttribute('aria-disabled', 'true');
    else boton.removeAttribute('aria-disabled');
    if (cfg.ocupado) boton.setAttribute('aria-busy', 'true');
    else boton.removeAttribute('aria-busy');
  }

  function renderNavegacion() {
    const p = recorrido.pantalla;
    let primario = null;
    let secundario = null;
    let modo = 'paso';
    switch (p) {
      case PANTALLAS.INICIO:
        modo = 'un-boton';
        primario = { texto: T.inicio.botonEmpezar, accion: 'empezar' };
        break;
      case PANTALLAS.INSTRUCCIONES:
        secundario = { texto: T.instrucciones.botonVolver, flechaAntes: '‹', accion: 'retroceder' };
        primario = { texto: T.instrucciones.botonComenzar, accion: 'comenzar', inactivo: !recorrido.estado.aceptado };
        break;
      case PANTALLAS.PREGUNTA: {
        secundario = {
          texto: T.pregunta.botonAnterior,
          flechaAntes: '‹',
          accion: 'retroceder',
          reservado: !recorrido.puedeRetroceder(),
        };
        let etiqueta = T.pregunta.botonSiguiente;
        let flecha = '›';
        if (recorrido.estado.desdeRevision) {
          etiqueta = T.pregunta.botonVolverRevision;
          flecha = null;
        } else if (recorrido.esUltima()) {
          etiqueta = T.pregunta.botonRevisar;
          flecha = null;
        }
        // REGLA: sin respuesta explícita, el control de avance no existe para el usuario.
        primario = { texto: etiqueta, flecha, accion: 'avanzar', reservado: !recorrido.puedeAvanzar() };
        break;
      }
      case PANTALLAS.REVISION:
        if (recorrido.estado.modoLectura) {
          modo = 'un-boton';
          primario = { texto: T.revision.botonVolverResumen, accion: 'volver-resumen' };
        } else {
          secundario = { texto: T.revision.botonAnterior, flechaAntes: '‹', accion: 'retroceder', deshabilitado: enviando };
          primario = {
            texto: enviando ? T.revision.botonEnviando : T.revision.botonEntregar,
            accion: 'entregar',
            deshabilitado: enviando || !recorrido.puedeEntregar(),
            ocupado: enviando,
          };
        }
        break;
      case PANTALLAS.RESULTADO:
        modo = 'par';
        secundario = { texto: T.resultado.botonVerRespuestas, accion: 'ver-respuestas', deshabilitado: enviando };
        primario = { texto: T.resultado.botonTerminar, accion: 'terminar', deshabilitado: enviando };
        break;
      default:
        break;
    }
    nav.hidden = false;
    nav.classList.toggle('un-boton', modo === 'un-boton');
    nav.classList.toggle('paso', modo === 'paso');
    configurarBoton(botonSecundario, secundario);
    configurarBoton(botonPrimario, primario);
  }

  // ---- Pantalla de pregunta ---------------------------------------------------------------

  function actualizarProgreso() {
    const total = recorrido.total;
    const respondidas = recorrido.respondidas();
    $('progreso-posicion').textContent = T.pregunta.posicion(recorrido.indice + 1, total);
    $('progreso-pendientes').textContent = T.pregunta.pendientes(recorrido.pendientes());
    const barra = $('progreso-barra');
    barra.setAttribute('aria-label', T.pregunta.etiquetaProgreso);
    barra.setAttribute('aria-valuemax', String(total));
    barra.setAttribute('aria-valuenow', String(respondidas));
    barra.setAttribute('aria-valuetext', T.pregunta.textoProgreso(respondidas, total));
    $('progreso-relleno').style.setProperty('--progreso', String(respondidas / total));
  }

  function calibrarAlturaPregunta() {
    // Reserva la altura de la pregunta más larga para que la escala no cambie de posición.
    if ($('pantalla-pregunta').hidden) return;
    const medidor = $('medidor-pregunta');
    medidor.style.width = `${bloque.clientWidth}px`;
    let max = 0;
    for (const p of recorrido.preguntas) {
      medidor.textContent = p.texto;
      max = Math.max(max, medidor.getBoundingClientRect().height);
    }
    medidor.textContent = '';
    document.documentElement.style.setProperty('--alto-pregunta', `${Math.ceil(max)}px`);
  }

  function mostrarPregunta({ conTransicion }) {
    const pregunta = recorrido.preguntaActual;
    const aplicar = () => {
      textoPregunta.textContent = pregunta.texto;
      escala.mostrar(recorrido.respuestaDe(pregunta.id));
    };
    clearTimeout(temporizadorTransicion);
    if (!conTransicion || movimientoReducido.matches) {
      bloque.classList.remove('desvanecido');
      contenedorEscala.classList.remove('desvanecido');
      cuerpo.inert = false;
      aplicar();
      return false;
    }
    // Transición breve de opacidad: confirma el cambio sin desplazar el contenido.
    cuerpo.inert = true;
    bloque.classList.add('desvanecido');
    contenedorEscala.classList.add('desvanecido');
    temporizadorTransicion = setTimeout(() => {
      aplicar();
      bloque.classList.remove('desvanecido');
      contenedorEscala.classList.remove('desvanecido');
      cuerpo.inert = false;
      textoPregunta.focus({ preventScroll: true });
    }, 140);
    return true;
  }

  function renderPregunta(cambioPantalla, enfocar) {
    actualizarProgreso();
    if (cambioPantalla) calibrarAlturaPregunta();
    if (cambioPantalla || indiceMostrado !== recorrido.indice) {
      const conTransicion = !cambioPantalla && indiceMostrado !== null;
      const diferido = mostrarPregunta({ conTransicion });
      if (!diferido && enfocar && !cambioPantalla) textoPregunta.focus({ preventScroll: true });
      indiceMostrado = recorrido.indice;
    } else {
      escala.mostrar(recorrido.respuestaDe(recorrido.preguntaActual.id));
    }
  }

  // ---- Revisión ---------------------------------------------------------------------------

  function renderRevision() {
    const lectura = recorrido.estado.modoLectura;
    $('descripcion-revision').textContent = lectura ? T.revision.descripcionLectura : T.revision.descripcion;
    const faltan = recorrido.pendientes();
    const aviso = $('faltan-revision');
    aviso.hidden = lectura || faltan === 0;
    aviso.textContent = faltan ? T.revision.faltan(faltan) : '';
    const sinConfig = $('aviso-sin-configuracion');
    sinConfig.hidden = lectura || recorrido.congelado || endpointValido(CONFIG.endpointEntregas);
    sinConfig.textContent = T.revision.sinConfiguracion;
    const items = recorrido.preguntas.map((p, i) => {
      const v = recorrido.respuestaDe(p.id);
      const opcion = CUESTIONARIO.escala.find((o) => o.valor === v);
      const respuesta = elemento('span', {
        className: `item-revision-respuesta${opcion ? '' : ' sin-responder'}`,
        textContent: opcion ? T.pregunta.valor(opcion.valor, opcion.etiqueta) : T.revision.sinResponder,
      });
      const li = elemento('li', { className: 'item-revision' }, [
        elemento('span', { className: 'item-revision-numero', textContent: String(i + 1), ariaHidden: 'true' }),
        elemento('p', { className: 'item-revision-texto' }, [
          elemento('span', { className: 'sr-solo', textContent: `${T.pregunta.posicion(i + 1, recorrido.total)}. ` }),
          p.texto,
          respuesta,
        ]),
      ]);
      if (!lectura && !recorrido.congelado) {
        const b = elemento('button', { type: 'button', className: 'boton-cambiar', textContent: T.revision.botonCambiar });
        b.dataset.accion = 'editar';
        b.dataset.indice = String(i);
        b.setAttribute('aria-label', T.revision.etiquetaCambiar(i + 1));
        li.append(b);
      }
      return li;
    });
    $('lista-revision').replaceChildren(...items);
    $('estado-envio-revision').textContent = enviando ? T.revision.enviando : '';
    $('acciones-revision').hidden = lectura || recorrido.congelado;
  }

  // ---- Resultado --------------------------------------------------------------------------

  function renderResultado() {
    const r = recorrido.resumen();
    if (r) {
      $('valor-suma').textContent = String(r.suma);
      $('valor-promedio').textContent = formatearPromedio(r.promedio, CONFIG.idioma);
      $('rango-suma').textContent = T.resultado.rangoSuma(r.sumaMinima, r.sumaMaxima);
      $('marcador-promedio').style.setProperty('--promedio', String(r.promedio));
      const orientacion = ORIENTACIONES.find((o) => o.nivel === r.nivelFrecuencia);
      if (orientacion) {
        $('orientacion').dataset.nivel = String(orientacion.nivel);
        $('rango-frecuencia').textContent = T.resultado.rangoFrecuencia(orientacion.nivel);
        $('titulo-orientacion').textContent = orientacion.titulo;
        $('frecuencia-media').textContent = T.resultado.frecuencia(orientacion.frecuencia);
        $('lista-ideas').replaceChildren(...orientacion.recomendaciones.map((t) => elemento('li', { textContent: t })));
        $('frase-orientacion').textContent = orientacion.frase;
      }
    }
    const { estado, detalle } = recorrido.entrega;
    const caja = $('estado-guardado');
    const p = $('estado-guardado-texto');
    const reintentar = $('boton-reintentar');
    let tipo = 'error';
    let mensaje = '';
    if (enviando) {
      tipo = 'espera';
      mensaje = T.guardado.enviando;
    } else {
      switch (estado) {
        case ESTADOS_ENVIO.GUARDADO:
          tipo = 'ok';
          mensaje = T.guardado.guardado;
          break;
        case ESTADOS_ENVIO.DUPLICADO:
          tipo = 'ok';
          mensaje = T.guardado.duplicado;
          break;
        case ESTADOS_ENVIO.INCIERTO:
          mensaje = T.guardado.incierto;
          break;
        case ESTADOS_ENVIO.RECHAZADO:
          mensaje = T.guardado.rechazado(detalle);
          break;
        case ESTADOS_ENVIO.CERRADO:
          mensaje = T.guardado.cerrado;
          break;
        case ESTADOS_ENVIO.SIN_CONFIGURACION:
          mensaje = T.guardado.sinConfiguracion;
          break;
        default:
          mensaje = T.guardado.fallido;
      }
    }
    caja.dataset.tipo = tipo;
    caja.setAttribute('aria-busy', enviando ? 'true' : 'false');
    p.textContent = mensaje;
    const puede =
      !enviando &&
      recorrido.puedeReintentar() &&
      (estado !== ESTADOS_ENVIO.SIN_CONFIGURACION || endpointValido(CONFIG.endpointEntregas));
    reintentar.hidden = !puede;
  }

  // ---- Render general ---------------------------------------------------------------------

  function render({ enfocar = true } = {}) {
    const p = recorrido.pantalla;
    const cambioPantalla = p !== pantallaMostrada;
    if (cambioPantalla) {
      document.querySelectorAll('.pantalla').forEach((s) => {
        s.hidden = s.dataset.pantalla !== p;
      });
      document.body.dataset.pantalla = p;
      if (p !== PANTALLAS.PREGUNTA) indiceMostrado = null;
    }
    switch (p) {
      case PANTALLAS.INSTRUCCIONES:
        casilla.checked = recorrido.estado.aceptado;
        $('pista-aceptacion').hidden = recorrido.estado.aceptado;
        break;
      case PANTALLAS.PREGUNTA:
        renderPregunta(cambioPantalla, enfocar);
        break;
      case PANTALLAS.REVISION:
        renderRevision();
        break;
      case PANTALLAS.RESULTADO:
        renderResultado();
        break;
      default:
        break;
    }
    renderNavegacion();
    if (cambioPantalla && enfocar) {
      const seccion = document.querySelector(`.pantalla[data-pantalla="${p}"]`);
      seccion.scrollTop = 0;
      const titulo = seccion.querySelector('[tabindex="-1"]');
      if (titulo) titulo.focus({ preventScroll: true });
    }
    pantallaMostrada = p;
    requestAnimationFrame(actualizarIndicadorDesplazamiento);
  }

  // ---- Acciones ---------------------------------------------------------------------------

  async function entregar() {
    if (enviando) return;
    const payload = recorrido.prepararEntrega();
    if (!payload) return;
    enviando = true;
    render({ enfocar: false });
    const resultado = await enviarEntrega(payload, {
      endpoint: CONFIG.endpointEntregas,
      tiempoMaximoMs: CONFIG.tiempoMaximoEnvioMs,
    });
    enviando = false;
    recorrido.registrarResultadoEnvio(resultado);
    render();
  }

  async function ejecutar(accion, origen) {
    switch (accion) {
      case 'empezar':
        recorrido.empezar();
        break;
      case 'comenzar':
        if (!recorrido.comenzar()) {
          // Sin aceptación no se comienza: se muestra la casilla y la indicación.
          const pista = $('pista-aceptacion');
          pista.hidden = false;
          casilla.closest('.aceptacion').scrollIntoView({ block: 'center', behavior: movimientoReducido.matches ? 'auto' : 'smooth' });
          casilla.focus({ preventScroll: true });
          return;
        }
        break;
      case 'retroceder':
        if (enviando) return;
        recorrido.retroceder();
        break;
      case 'avanzar':
        // La guarda vive en el estado: sin respuesta no se avanza, venga de donde venga la orden.
        if (!recorrido.avanzar()) return;
        break;
      case 'editar':
        recorrido.editar(Number(origen?.dataset.indice));
        break;
      case 'entregar':
      case 'reintentar':
        await entregar();
        return;
      case 'ver-respuestas':
        if (enviando) return;
        recorrido.verRespuestas();
        break;
      case 'volver-resumen':
        recorrido.volverAlResumen();
        break;
      case 'terminar': {
        if (enviando) return;
        const guardado = [ESTADOS_ENVIO.GUARDADO, ESTADOS_ENVIO.DUPLICADO].includes(recorrido.entrega.estado);
        const ok = await confirmar({
          titulo: T.confirmaciones.terminarTitulo,
          cuerpo: guardado ? T.confirmaciones.terminarTexto : T.confirmaciones.terminarSinGuardar,
          aceptar: T.confirmaciones.botonConfirmarTerminar,
        });
        if (!ok) return;
        recorrido.reiniciar();
        break;
      }
      case 'borrar-sesion': {
        const ok = await confirmar({
          titulo: T.confirmaciones.borrarTitulo,
          cuerpo: T.confirmaciones.borrarTexto,
          aceptar: T.confirmaciones.botonConfirmar,
        });
        if (!ok) return;
        recorrido.reiniciar();
        break;
      }
      case 'abrir-acerca':
        abrirDialogo($('dialogo-acerca'));
        return;
      default:
        return;
    }
    render();
  }

  [botonPrimario, botonSecundario].forEach((b) => {
    b.addEventListener('click', () => {
      if (b.classList.contains('reservado') || b.disabled) return;
      ejecutar(b.dataset.accion, b);
    });
  });

  document.addEventListener('click', (e) => {
    const el = e.target.closest('[data-accion]');
    if (!el || el === botonPrimario || el === botonSecundario) return;
    ejecutar(el.dataset.accion, el);
  });

  casilla.addEventListener('change', () => {
    recorrido.aceptar(casilla.checked);
    $('pista-aceptacion').hidden = recorrido.estado.aceptado;
    renderNavegacion();
  });

  let temporizadorRedimension = null;
  window.addEventListener('resize', () => {
    clearTimeout(temporizadorRedimension);
    temporizadorRedimension = setTimeout(() => {
      redibujarEstrellas();
      calibrarAlturaPregunta();
      actualizarIndicadorDesplazamiento();
    }, 150);
  });
  document.querySelectorAll('.pantalla').forEach((s) =>
    s.addEventListener('scroll', actualizarIndicadorDesplazamiento, { passive: true })
  );
  document.fonts?.ready.then(calibrarAlturaPregunta);

  // Los botones pueden crecer por salto de línea o aumento del texto del dispositivo.
  // Reservar su altura real evita que tapen la última parte del resultado o la revisión.
  if (typeof ResizeObserver === 'function') {
    new ResizeObserver(() => {
      const alto = nav.getBoundingClientRect().height;
      if (alto > 0) document.documentElement.style.setProperty('--alto-navegacion-real', `${Math.ceil(alto)}px`);
      actualizarIndicadorDesplazamiento();
    }).observe(nav);
  }

  render({ enfocar: false });

  // Ganchos de solo lectura para las pruebas automatizadas (no permiten saltarse las guardas).
  window.__pausa = Object.freeze({
    estado: () => JSON.parse(JSON.stringify(recorrido.estado)),
    intentarAvanzar: () => {
      const ok = recorrido.avanzar();
      if (ok) render();
      return ok;
    },
  });
}

// ---------------------------------------------------------------------------------------
// Arranque
// ---------------------------------------------------------------------------------------

function arrancar() {
  llenarContenidoFijo();
  crearControlMovimiento($('control-movimiento'), TEXTOS.movimiento);
  cargarBosque($('bosque'), 'assets/escena-bosque.svg');
  redibujarEstrellas();
  const parametros = new URLSearchParams(window.location.search);
  if (parametros.get('modo') === 'presentacion') {
    iniciarModoPresentacion();
  } else {
    iniciarCuestionario();
  }
}

arrancar();
