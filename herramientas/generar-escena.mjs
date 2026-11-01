// Genera la ilustración original del bosque nocturno y el campamento.
// Uso: node herramientas/generar-escena.mjs
// Produce assets/escena-bosque.svg de forma determinista (misma semilla, mismo dibujo).
//
// Composición: lienzo muy ancho (5400 x 600) con la fogata en el centro. La interfaz lo
// recorta con preserveAspectRatio="xMidYMax slice", de modo que en el celular se ve el
// claro con la fogata y las tiendas, y en pantallas anchas aparece más bosque a los lados.
// Los colores salen de clases CSS con variables (ver css/tema.css), con valores de respaldo
// para que el archivo también se vea correctamente por sí solo.

import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ANCHO = 5400;
const ALTO = 600;
const CX = ANCHO / 2; // centro de la fogata
const SEMILLA = 20261101;

function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const azar = mulberry32(SEMILLA);
const entre = (a, b) => a + azar() * (b - a);
const r1 = (n) => Math.round(n);
const pts = (lista) => lista.map(([x, y]) => `${r1(x)},${r1(y)}`).join(' L');

// Silueta de pino por niveles; devuelve la silueta completa y la mitad iluminada (derecha).
function pino(x, base, alto, ancho) {
  const tronco = alto * 0.07;
  const anchoTronco = Math.max(6, ancho * 0.07);
  const cima = base - alto;
  const baseCopa = base - tronco;
  const altoCopa = baseCopa - cima;
  const niveles = 5 + Math.floor(azar() * 3);
  const lado = (signo) => {
    const p = [];
    for (let i = 0; i < niveles; i++) {
      const t = (i + 1) / niveles;
      const yExt = cima + altoCopa * Math.pow(t, 0.95);
      const wExt = (ancho / 2) * (0.2 + 0.8 * t) * entre(0.88, 1.1);
      p.push([x + signo * wExt, yExt + (altoCopa / niveles) * 0.08]);
      if (i < niveles - 1) {
        const wInt = wExt * entre(0.42, 0.56);
        p.push([x + signo * wInt, yExt - (altoCopa / niveles) * entre(0.08, 0.16)]);
      }
    }
    return p;
  };
  const izq = lado(-1);
  const der = lado(1);
  const xTi = x - anchoTronco / 2;
  const xTd = x + anchoTronco / 2;
  const contorno =
    `M${r1(x)},${r1(cima)} L${pts(izq)} L${r1(xTi)},${r1(baseCopa)} L${r1(xTi)},${r1(base)} ` +
    `L${r1(xTd)},${r1(base)} L${r1(xTd)},${r1(baseCopa)} L${pts([...der].reverse())} Z`;
  const luz = `M${r1(x)},${r1(cima)} L${pts(der)} L${r1(x)},${r1(baseCopa)} Z`;
  const luzIzq = `M${r1(x)},${r1(cima)} L${pts(izq)} L${r1(x)},${r1(baseCopa)} Z`;
  return { contorno, luz, luzIzq };
}

function capaPinos({ clase, claseLuz, claseFuego = null, radioFuego = 0, base, alto, ancho, paso, claro = 0, reducirCerca = 0, saltoRango = null }) {
  const formas = [];
  const luces = [];
  const calidos = [];
  let x = entre(0, paso[0]);
  while (x < ANCHO + 60) {
    const dx = Math.abs(x - CX);
    const fueraDelClaro = dx >= claro;
    const dentroRango = saltoRango ? dx >= saltoRango[0] && dx <= saltoRango[1] : true;
    if (fueraDelClaro && dentroRango) {
      let h = entre(alto[0], alto[1]);
      if (reducirCerca && dx < reducirCerca) h *= 0.72 + 0.28 * (dx / reducirCerca);
      const w = h * entre(ancho[0], ancho[1]);
      const p = pino(x, base + entre(-6, 8), h, w);
      formas.push(p.contorno);
      const cercaDelFuego = claseFuego && dx < radioFuego;
      if (cercaDelFuego) calidos.push(x < CX ? p.luz : p.luzIzq);
      else if (claseLuz) luces.push(p.luz);
    }
    x += entre(paso[0], paso[1]);
  }
  let svg = `<path class="${clase}" d="${formas.join(' ')}"/>`;
  if (claseLuz && luces.length) svg += `\n    <path class="${claseLuz}" d="${luces.join(' ')}"/>`;
  if (calidos.length) svg += `\n    <path class="${claseFuego}" d="${calidos.join(' ')}"/>`;
  return svg;
}

function cerros() {
  let d = `M0,${ALTO} L0,360`;
  for (let x = 0; x <= ANCHO; x += 120) {
    const y = 350 + Math.sin(x / 610) * 22 + Math.sin(x / 233 + 1.3) * 9 + entre(-4, 4);
    d += ` L${x},${r1(y)}`;
  }
  return `<path class="e-cerro" d="${d} L${ANCHO},${ALTO} Z"/>`;
}

function suelo() {
  let d = `M0,${ALTO} L0,530`;
  for (let x = 0; x <= ANCHO; x += 90) {
    const dx = Math.abs(x - CX);
    const subida = dx > 900 ? Math.min(40, (dx - 900) / 30) : 0;
    const y = 522 - subida + Math.sin(x / 170) * 4 + entre(-2, 2);
    d += ` L${x},${r1(y)}`;
  }
  return `<path class="e-suelo" fill="url(#g-suelo)" d="${d} L${ANCHO},${ALTO} Z"/>`;
}

function tienda(x, base, claseTela, ladoFuego) {
  // ladoFuego: +1 si la fogata queda a la derecha de la tienda, -1 si queda a la izquierda.
  const alto = 128;
  const medio = 104;
  const cima = base - alto;
  const id = ladoFuego > 0 ? 'g-tienda-der' : 'g-tienda-izq';
  const xIzq = x - medio;
  const xDer = x + medio;
  return `
    <g class="tienda">
      <line class="e-cuerda" x1="${x}" y1="${cima + 4}" x2="${x - 170}" y2="${base + 4}"/>
      <line class="e-cuerda" x1="${x}" y1="${cima + 4}" x2="${x + 170}" y2="${base + 4}"/>
      <path class="${claseTela}" d="M${x},${cima} L${xDer},${base} L${xIzq},${base} Z"/>
      <path fill="url(#${id})" d="M${x},${cima} L${xDer},${base} L${xIzq},${base} Z"/>
      <path class="e-tienda-sombra" d="M${x},${cima + 26} L${x + 26},${base} L${x - 26},${base} Z"/>
      <path class="e-tienda-solapa" d="M${x},${cima + 26} L${x + ladoFuego * 26},${base} L${x + ladoFuego * 44},${base} Z"/>
      <path class="e-tienda-borde" d="M${x},${cima} L${xDer},${base} M${x},${cima} L${xIzq},${base}"/>
      <rect class="e-estaca" x="${x - 3}" y="${cima - 10}" width="6" height="12" rx="2"/>
    </g>`;
}

function tronco(cx, cy, largo, grosor, angulo) {
  const x = cx - largo / 2;
  const y = cy - grosor / 2;
  return `
    <g transform="rotate(${angulo} ${cx} ${cy})">
      <rect class="e-tronco" x="${x}" y="${y}" width="${largo}" height="${grosor}" rx="${grosor / 2}"/>
      <rect class="e-tronco-luz" x="${x + 10}" y="${y + 3}" width="${largo - 24}" height="${grosor * 0.28}" rx="${grosor * 0.14}"/>
      <ellipse class="e-tronco-corte" cx="${x + largo - grosor * 0.2}" cy="${cy}" rx="${grosor * 0.32}" ry="${grosor / 2 - 1}"/>
      <ellipse class="e-tronco-anillo" cx="${x + largo - grosor * 0.2}" cy="${cy}" rx="${grosor * 0.16}" ry="${grosor * 0.26}"/>
    </g>`;
}

function piedras() {
  const atras = [];
  const frente = [];
  const n = 11;
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2 + 0.2;
    const x = CX + Math.cos(a) * 96;
    const y = 563 + Math.sin(a) * 19;
    const rx = entre(18, 25);
    const ry = entre(11, 15);
    const piedra =
      `<ellipse class="e-piedra" cx="${r1(x)}" cy="${r1(y)}" rx="${r1(rx)}" ry="${r1(ry)}"/>` +
      `<ellipse class="e-piedra-luz" cx="${r1(x - rx * 0.12)}" cy="${r1(y - ry * 0.42)}" rx="${r1(rx * 0.62)}" ry="${r1(ry * 0.38)}"/>`;
    (Math.sin(a) < 0 ? atras : frente).push(piedra);
  }
  return { atras: atras.join(''), frente: frente.join('') };
}

function llama(x0, y0, h, w) {
  const d =
    `M${x0},${y0} ` +
    `C${r1(x0 - w * 0.55)},${y0 - 2} ${r1(x0 - w * 0.62)},${r1(y0 - h * 0.45)} ${r1(x0 - w * 0.18)},${r1(y0 - h * 0.72)} ` +
    `C${r1(x0 - w * 0.05)},${r1(y0 - h * 0.82)} ${r1(x0 - w * 0.02)},${r1(y0 - h * 0.92)} ${r1(x0 + w * 0.06)},${r1(y0 - h)} ` +
    `C${r1(x0 + w * 0.12)},${r1(y0 - h * 0.86)} ${r1(x0 + w * 0.32)},${r1(y0 - h * 0.7)} ${r1(x0 + w * 0.4)},${r1(y0 - h * 0.52)} ` +
    `C${r1(x0 + w * 0.62)},${r1(y0 - h * 0.3)} ${r1(x0 + w * 0.52)},${y0 - 2} ${x0},${y0} Z`;
  return d;
}

function fogata() {
  const base = 552;
  const llamas = [
    { n: 1, dx: 0, h: 150, w: 104, clase: 'e-llama-exterior' },
    { n: 2, dx: -28, h: 104, w: 62, clase: 'e-llama-lateral' },
    { n: 3, dx: 30, h: 118, w: 60, clase: 'e-llama-lateral' },
    { n: 4, dx: 2, h: 112, w: 70, clase: 'e-llama-media' },
    { n: 5, dx: 0, h: 66, w: 40, clase: 'e-llama-nucleo' },
  ];
  const grupos = llamas
    .map((l) => `<g class="llama llama-${l.n}"><path class="${l.clase}" d="${llama(CX + l.dx, base, l.h, l.w)}"/></g>`)
    .join('\n      ');
  const brasas = [];
  for (let i = 0; i < 9; i++) {
    const x = CX + entre(-34, 34);
    const y = entre(455, 482);
    const deriva = r1(entre(-16, 16));
    brasas.push(
      `<circle class="brasa brasa-${i + 1}" style="--deriva:${deriva}px" cx="${r1(x)}" cy="${r1(y)}" r="${r1(entre(2.2, 3.6))}"/>`
    );
  }
  return `
    <g class="fogata">
      <ellipse class="e-brasero" cx="${CX}" cy="${base + 4}" rx="58" ry="10"/>
      <path class="e-lena" d="M${CX - 62},${base + 8} L${CX + 40},${base - 22} L${CX + 48},${base - 12} L${CX - 54},${base + 16} Z"/>
      <path class="e-lena" d="M${CX + 64},${base + 8} L${CX - 38},${base - 22} L${CX - 46},${base - 12} L${CX + 56},${base + 16} Z"/>
      ${grupos}
      ${brasas.join('\n      ')}
    </g>`;
}

const capas = [
  cerros(),
  capaPinos({ clase: 'e-pino-1', base: 478, alto: [140, 220], ancho: [0.36, 0.46], paso: [26, 40], reducirCerca: 420 }),
  capaPinos({ clase: 'e-pino-2', claseLuz: 'e-pino-2-luz', base: 505, alto: [180, 290], ancho: [0.36, 0.44], paso: [38, 58], claro: 250, reducirCerca: 700 }),
  capaPinos({ clase: 'e-pino-3', claseLuz: 'e-pino-3-luz', claseFuego: 'e-pino-3-fuego', radioFuego: 760, base: 532, alto: [230, 350], ancho: [0.34, 0.42], paso: [58, 88], claro: 420, reducirCerca: 900 }),
];

const p = piedras();

const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${ANCHO} ${ALTO}" preserveAspectRatio="xMidYMax slice" class="bosque-svg" focusable="false">
  <title>Bosque nocturno con fogata y tiendas de campaña</title>
  <style>
    .e-cerro{fill:var(--esc-cerro,#143954)}
    .e-pino-1{fill:var(--esc-pino-1,#17405A)}
    .e-pino-2{fill:var(--esc-pino-2,#11354B)}
    .e-pino-2-luz{fill:var(--esc-pino-2-luz,#164259)}
    .e-pino-3{fill:var(--esc-pino-3,#0B2C3A)}
    .e-pino-3-luz{fill:var(--esc-pino-3-luz,#0D3D45)}
    .e-pino-3-fuego{fill:var(--esc-pino-3-fuego,#2B3A33)}
    .e-pino-4{fill:var(--esc-pino-4,#071E28)}
    .e-pino-4-fuego{fill:var(--esc-pino-4-fuego,#1F2622)}
    .e-pino-4-luz{fill:var(--esc-pino-4-luz,#0A2A31)}
    .e-pino-5{fill:var(--esc-pino-5,#04131A)}
    .e-cuerda{stroke:var(--esc-cuerda,rgba(244,235,221,.16));stroke-width:2}
    .e-tela-a{fill:var(--esc-tela-a,#2B5553)}
    .e-tela-b{fill:var(--esc-tela-b,#5B4A37)}
    .e-tienda-sombra{fill:var(--esc-tienda-sombra,#0A1A20)}
    .e-tienda-solapa{fill:var(--esc-tienda-solapa,#3C3328)}
    .e-tienda-borde{stroke:var(--esc-tienda-borde,rgba(244,235,221,.18));stroke-width:3;fill:none;stroke-linecap:round}
    .e-estaca{fill:var(--esc-estaca,#2A2019)}
    .e-tronco{fill:var(--esc-tronco,#3B2A20)}
    .e-tronco-luz{fill:var(--esc-tronco-luz,#7A5233)}
    .e-tronco-corte{fill:var(--esc-tronco-corte,#A07448)}
    .e-tronco-anillo{fill:none;stroke:var(--esc-tronco-anillo,#6E4B2E);stroke-width:3}
    .e-piedra{fill:var(--esc-piedra,#33424C)}
    .e-piedra-luz{fill:var(--esc-piedra-luz,#9C6E49);opacity:.55}
    .e-brasero{fill:var(--esc-brasero,#E8892F);opacity:.8}
    .e-lena{fill:var(--esc-lena,#2A1C15)}
    .e-llama-exterior{fill:var(--esc-llama-1,#E2762B)}
    .e-llama-lateral{fill:var(--esc-llama-2,#EE9737)}
    .e-llama-media{fill:var(--esc-llama-3,#F5B44B)}
    .e-llama-nucleo{fill:var(--esc-llama-4,#FCE6AE)}
    .brasa{fill:var(--esc-brasa,#FFD48C)}
  </style>
  <defs>
    <linearGradient id="g-suelo" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#0A2833"/>
      <stop offset="1" stop-color="#05151D"/>
    </linearGradient>
    <linearGradient id="g-bruma" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#1B4A68" stop-opacity="0"/>
      <stop offset="1" stop-color="#1B4A68" stop-opacity=".35"/>
    </linearGradient>
    <radialGradient id="g-resplandor" cx="0.5" cy="0.5" r="0.5">
      <stop offset="0" stop-color="#F5B44B" stop-opacity=".34"/>
      <stop offset=".45" stop-color="#F09A3E" stop-opacity=".14"/>
      <stop offset="1" stop-color="#F09A3E" stop-opacity="0"/>
    </radialGradient>
    <radialGradient id="g-charco" cx="0.5" cy="0.5" r="0.5">
      <stop offset="0" stop-color="#F5B44B" stop-opacity=".30"/>
      <stop offset="1" stop-color="#F5B44B" stop-opacity="0"/>
    </radialGradient>
    <radialGradient id="g-piedras" cx="0.5" cy="0.5" r="0.5">
      <stop offset="0" stop-color="#FFC56A" stop-opacity=".42"/>
      <stop offset="1" stop-color="#FFC56A" stop-opacity="0"/>
    </radialGradient>
    <linearGradient id="g-tienda-der" x1="0" y1="0" x2="1" y2="0">
      <stop offset=".45" stop-color="#F5B44B" stop-opacity="0"/>
      <stop offset="1" stop-color="#F5B44B" stop-opacity=".34"/>
    </linearGradient>
    <linearGradient id="g-tienda-izq" x1="1" y1="0" x2="0" y2="0">
      <stop offset=".45" stop-color="#F5B44B" stop-opacity="0"/>
      <stop offset="1" stop-color="#F5B44B" stop-opacity=".34"/>
    </linearGradient>
  </defs>
  <g class="capa-fondo">
    ${capas.join('\n    ')}
    <rect x="0" y="360" width="${ANCHO}" height="200" fill="url(#g-bruma)"/>
  </g>
  ${suelo()}
  <circle class="resplandor" cx="${CX}" cy="470" r="340" fill="url(#g-resplandor)"/>
  <ellipse cx="${CX}" cy="560" rx="580" ry="82" fill="url(#g-charco)"/>
  <g class="capa-cercana">
    ${capaPinos({ clase: 'e-pino-4', claseLuz: 'e-pino-4-luz', claseFuego: 'e-pino-4-fuego', radioFuego: 980, base: 585, alto: [330, 470], ancho: [0.33, 0.4], paso: [90, 140], claro: 560 })}
  </g>
  ${tienda(CX - 330, 548, 'e-tela-a', 1)}
  ${tienda(CX + 330, 548, 'e-tela-b', -1)}
  ${tronco(CX - 214, 566, 168, 30, -7)}
  ${tronco(CX + 214, 566, 160, 28, 6)}
  <g class="piedras-atras">${p.atras}</g>
  ${fogata()}
  <g class="piedras-frente">${p.frente}</g>
  <ellipse class="resplandor-piedras" cx="${CX}" cy="556" rx="190" ry="54" fill="url(#g-piedras)"/>
  <g class="capa-primer-plano">
    ${capaPinos({ clase: 'e-pino-5', base: 650, alto: [470, 560], ancho: [0.34, 0.4], paso: [120, 190], saltoRango: [640, 99999] })}
  </g>
</svg>
`;

const destino = resolve(dirname(fileURLToPath(import.meta.url)), '..', 'assets', 'escena-bosque.svg');
mkdirSync(dirname(destino), { recursive: true });
writeFileSync(destino, svg);
console.log(`Escena generada: ${destino} (${(svg.length / 1024).toFixed(1)} KB)`);
