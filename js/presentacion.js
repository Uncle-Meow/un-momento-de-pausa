// Modo de presentación: título legible a distancia, instrucción breve, QR grande y enlace.
// El QR se genera localmente (sin servicios externos) y apunta al inicio normal del cuestionario.

import qrcode from './vendor/qrcode.mjs';

const HOSTS_LOCALES = new Set(['localhost', '127.0.0.1', '[::1]', '0.0.0.0']);
const COLOR_OSCURO = '#0b1f2e';
const COLOR_CLARO = '#ffffff';
const ZONA_SILENCIO = 4; // módulos de margen libre exigidos por la norma QR

// Determina la URL de destino: la configurada o, si falta, la dirección actual sin parámetros.
export function resolverUrlPublica(configurada, ubicacion = window.location) {
  const valor = (configurada || '').trim();
  if (valor) {
    const u = new URL(valor);
    u.search = '';
    u.hash = '';
    return { url: u.href, configurada: true, local: !esPublica(u) };
  }
  const u = new URL(ubicacion.href);
  u.search = '';
  u.hash = '';
  u.pathname = u.pathname.replace(/index\.html$/, '');
  return { url: u.href, configurada: false, local: !esPublica(u) };
}

function esPublica(url) {
  return url.protocol === 'https:' && !url.username && !url.password &&
    !HOSTS_LOCALES.has(url.hostname) &&
    !['example.com', 'example.org', 'example.net', 'equipo-ejemplo.github.io'].includes(url.hostname) &&
    !url.hostname.endsWith('.example');
}

export function crearMatrizQr(texto) {
  const qr = qrcode(0, 'M');
  qr.addData(texto);
  qr.make();
  const n = qr.getModuleCount();
  const filas = [];
  for (let f = 0; f < n; f++) {
    const fila = [];
    for (let c = 0; c < n; c++) fila.push(qr.isDark(f, c));
    filas.push(fila);
  }
  return filas;
}

export function qrComoSvg(matriz, etiqueta) {
  const n = matriz.length;
  const total = n + ZONA_SILENCIO * 2;
  let d = '';
  for (let f = 0; f < n; f++) {
    for (let c = 0; c < n; c++) {
      if (matriz[f][c]) d += `M${c + ZONA_SILENCIO} ${f + ZONA_SILENCIO}h1v1h-1z`;
    }
  }
  const titulo = etiqueta ? `<title>${escaparXml(etiqueta)}</title>` : '';
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${total} ${total}" shape-rendering="crispEdges" role="img">` +
    `${titulo}<rect width="${total}" height="${total}" fill="${COLOR_CLARO}"/>` +
    `<path fill="${COLOR_OSCURO}" d="${d}"/></svg>`
  );
}

function escaparXml(s) {
  return s.replace(/[<>&"']/g, (ch) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;', "'": '&apos;' })[ch]);
}

function descargar(blob, nombre) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = nombre;
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function qrComoPng(matriz, lado = 1600) {
  const n = matriz.length;
  const total = n + ZONA_SILENCIO * 2;
  const modulo = Math.floor(lado / total);
  const tam = modulo * total;
  const lienzo = document.createElement('canvas');
  lienzo.width = tam;
  lienzo.height = tam;
  const ctx = lienzo.getContext('2d');
  ctx.fillStyle = COLOR_CLARO;
  ctx.fillRect(0, 0, tam, tam);
  ctx.fillStyle = COLOR_OSCURO;
  for (let f = 0; f < n; f++) {
    for (let c = 0; c < n; c++) {
      if (matriz[f][c]) ctx.fillRect((c + ZONA_SILENCIO) * modulo, (f + ZONA_SILENCIO) * modulo, modulo, modulo);
    }
  }
  return new Promise((resolve) => lienzo.toBlob(resolve, 'image/png'));
}

export function iniciarPresentacion({ config, textos, elementos }) {
  const { lienzo, enlace, aviso, botonPng, botonSvg } = elementos;
  let destino;
  try {
    destino = resolverUrlPublica(config.urlPublica);
  } catch {
    destino = { url: '', configurada: true, local: true };
  }
  if (destino.local) {
    lienzo.classList.add('qr-pendiente');
    lienzo.textContent = 'El QR aparecerá cuando el sitio tenga una dirección pública HTTPS.';
    enlace.removeAttribute('href');
    enlace.parentElement.hidden = true;
    botonPng.hidden = true;
    botonSvg.hidden = true;
    aviso.textContent = textos.avisoLocal;
    aviso.hidden = false;
    return destino;
  }
  const matriz = crearMatrizQr(destino.url);
  lienzo.innerHTML = qrComoSvg(matriz, textos.etiquetaQr(destino.url));
  lienzo.dataset.url = destino.url;
  enlace.href = destino.url;
  enlace.textContent = destino.url.replace(/^https?:\/\//, '').replace(/\/$/, '');

  // Si el sitio ya está publicado con HTTPS y no hay URL configurada, la dirección actual es
  // la pública y no se muestra aviso. Solo se advierte cuando el QR apuntaría a un entorno local.
  if (destino.local) {
    aviso.textContent = textos.avisoLocal;
    aviso.hidden = false;
  }

  botonSvg.addEventListener('click', () => {
    descargar(new Blob([qrComoSvg(matriz)], { type: 'image/svg+xml' }), 'qr-un-momento-de-pausa.svg');
  });
  botonPng.addEventListener('click', async () => {
    const blob = await qrComoPng(matriz);
    if (blob) descargar(blob, 'qr-un-momento-de-pausa.png');
  });
  return destino;
}
