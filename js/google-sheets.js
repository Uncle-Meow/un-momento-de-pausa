// Puente con HtmlService y google.script.run. No usa respuestas opacas de fetch/no-cors.
const APP = 'pausa-sheets-v1';

export function esEndpointGoogle(endpoint) {
  try {
    const u = new URL(endpoint);
    return u.protocol === 'https:' && u.hostname === 'script.google.com' &&
      /^\/macros\/s\/[A-Za-z0-9_-]+\/exec$/.test(u.pathname) && !u.search && !u.hash;
  } catch { return false; }
}

export function esOrigenPuente(origen) {
  try {
    const u = new URL(origen);
    return u.protocol === 'https:' && (u.hostname === 'script.google.com' ||
      u.hostname === 'script.googleusercontent.com' || u.hostname.endsWith('-script.googleusercontent.com'));
  } catch { return false; }
}

function perteneceAlMarco(fuente, marco) {
  // HtmlService añade sandboxFrame y userHtmlFrame dentro del marco del servicio.
  // Recorrer únicamente esa cadena de padres conserva la comprobación del remitente.
  try {
    for (let profundidad=0; fuente && profundidad<5; profundidad++) {
      if (fuente === marco) return true;
      const padre=fuente.parent;
      if (padre === fuente) break;
      fuente=padre;
    }
  } catch { /* Un remitente que no permite verificar su ascendencia se ignora. */ }
  return false;
}

export function enviarAGoogle(payload, { endpoint, tiempoMaximoMs = 45000,
  ventana = globalThis.window, documento = globalThis.document, cryptoImpl = globalThis.crypto } = {}) {
  return new Promise((resolve, reject) => {
    if (!esEndpointGoogle(endpoint) || !ventana || !documento || !cryptoImpl) return reject(new Error('Servicio no disponible'));
    const bytes = cryptoImpl.getRandomValues(new Uint8Array(16));
    const canal = [...bytes].map(v => v.toString(16).padStart(2, '0')).join('');
    const iframe = documento.createElement('iframe');
    // HtmlService inicializa marcos internos que necesitan un área de diseño.
    // Mantener un píxel fuera del flujo evita display:none sin alterar la interfaz.
    iframe.setAttribute('style','position:fixed;right:0;bottom:0;width:1px;height:1px;border:0;opacity:.01;pointer-events:none');
    iframe.tabIndex = -1;
    iframe.setAttribute('aria-hidden', 'true');
    iframe.setAttribute('sandbox', 'allow-scripts allow-same-origin allow-forms');
    iframe.referrerPolicy = 'no-referrer';
    iframe.title = 'Servicio de guardado';
    let fuente = null, termino = false;
    const terminar = (error, respuesta) => {
      if (termino) return;
      termino = true;
      clearTimeout(temporizador);
      ventana.removeEventListener('message', recibir);
      iframe.remove();
      if (error) reject(error); else resolve(respuesta);
    };
    const recibir = e => {
      const m = e.data;
      if (!m || m.app !== APP || m.canal !== canal || !esOrigenPuente(e.origin) || !e.source) return;
      if (m.tipo === 'listo' && !fuente) {
        // Solo aceptar un marco descendiente del iframe que acaba de abrirse.
        if (!perteneceAlMarco(e.source,iframe.contentWindow)) return;
        fuente = e.source;
        fuente.postMessage({app:APP,canal,tipo:'guardar',payload},e.origin);
      } else if (m.tipo === 'respuesta' && e.source === fuente) {
        const r = m.datos;
        if (!r || !Number.isInteger(r.status) || r.status < 100 || r.status > 599 || !r.body) return;
        terminar(null, {ok:r.status >= 200 && r.status < 300,status:r.status,json:async()=>r.body});
      }
    };
    const temporizador = setTimeout(() => terminar(new Error('Tiempo de espera agotado')),tiempoMaximoMs);
    iframe.addEventListener('error',() => terminar(new Error('No se pudo abrir el servicio')),{once:true});
    ventana.addEventListener('message',recibir);
    const url = new URL(endpoint);
    url.searchParams.set('canal',canal);
    iframe.src = url.href;
    documento.body.appendChild(iframe);
  });
}
