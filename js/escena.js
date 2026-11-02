// Escenario decorativo: carga del bosque, cielo estrellado y fogata continua.
// La escena no reacciona a las respuestas: solo existe como ambiente estable.

const SEMILLA_ESTRELLAS = 7331;

function mulberry32(a) {
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export async function cargarBosque(contenedor, url) {
  try {
    const r = await fetch(url, { credentials: 'same-origin' });
    if (!r.ok) throw new Error(String(r.status));
    const texto = await r.text();
    const doc = new DOMParser().parseFromString(texto, 'image/svg+xml');
    const svg = doc.documentElement;
    if (!svg || svg.nodeName.toLowerCase() !== 'svg') throw new Error('SVG no válido');
    svg.querySelector('title')?.remove();
    svg.setAttribute('aria-hidden', 'true');
    contenedor.replaceChildren(document.importNode(svg, true));
    return true;
  } catch (error) {
    // Sin bosque, la interfaz sigue siendo usable sobre el cielo.
    console.warn('No se pudo cargar la ilustración del bosque:', error);
    return false;
  }
}

// Dibuja estrellas pequeñas en el cielo. Dentro de la columna de texto la densidad y el
// brillo se reducen; alrededor de la luna se deja espacio libre.
export function dibujarEstrellas(svg, { zonaTexto, luna, alturaBosque }) {
  const w = window.innerWidth;
  const h = window.innerHeight;
  svg.setAttribute('viewBox', `0 0 ${w} ${h}`);
  svg.setAttribute('preserveAspectRatio', 'none');
  const azar = mulberry32(SEMILLA_ESTRELLAS);
  const limiteCielo = Math.max(0, h - alturaBosque * 0.45);
  const cantidad = Math.min(260, Math.round((w * limiteCielo) / 2300));
  const ns = 'http://www.w3.org/2000/svg';
  const frag = document.createDocumentFragment();
  let titilantes = 0;

  for (let i = 0; i < cantidad; i++) {
    const x = azar() * w;
    // Más densidad arriba: el cielo se aclara hacia el horizonte.
    const y = Math.pow(azar(), 1.25) * limiteCielo;
    const enTexto = zonaTexto && x > zonaTexto.left && x < zonaTexto.right && y > zonaTexto.top && y < zonaTexto.bottom;
    const r0 = azar();
    const sorteo = azar();
    if (enTexto && sorteo > 0.22) continue;
    if (luna) {
      const dx = x - luna.cx;
      const dy = y - luna.cy;
      if (Math.hypot(dx, dy) < luna.r * 1.25) continue;
    }
    let radio = r0 < 0.82 ? 0.55 + azar() * 0.5 : 1.05 + azar() * 0.55;
    let opacidad = 0.35 + azar() * 0.55;
    if (enTexto) {
      radio = Math.min(radio, 0.7);
      opacidad *= 0.45;
    }
    const c = document.createElementNS(ns, 'circle');
    c.setAttribute('cx', x.toFixed(1));
    c.setAttribute('cy', y.toFixed(1));
    c.setAttribute('r', radio.toFixed(2));
    c.style.opacity = opacidad.toFixed(2);
    if (!enTexto && titilantes < 9 && radio > 0.9 && azar() < 0.45) {
      // Unas pocas estrellas varían lentamente su brillo (sin destellos).
      c.classList.add('titila');
      c.style.setProperty('--op', opacidad.toFixed(2));
      c.style.setProperty('--dur', `${(5 + azar() * 4).toFixed(1)}s`);
      c.style.setProperty('--retardo', `${(-azar() * 6).toFixed(1)}s`);
      titilantes += 1;
    }
    frag.append(c);
  }
  svg.replaceChildren(frag);
}

// La fogata permanece activa en la página visible, sin controles manuales.
export function iniciarAmbiente() {
  const raiz = document.documentElement;
  // Con la pestaña oculta se detiene el trabajo de animación.
  const visibilidad = () => {
    raiz.dataset.pestana = document.hidden ? 'oculta' : 'visible';
  };
  document.addEventListener('visibilitychange', visibilidad);
  visibilidad();
}
