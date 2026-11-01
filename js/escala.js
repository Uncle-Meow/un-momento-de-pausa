// Escala de respuesta: deslizador de cinco posiciones discretas más cinco opciones pulsables.
//
// Accesibilidad: el control accesible es un grupo de botones de opción nativos (teclado,
// lectores de pantalla y selección explícita incluso del valor central). La pista deslizable
// es una ayuda para puntero, sin función exclusiva, y se oculta a tecnologías de asistencia
// para no duplicar el mismo control (WCAG 2.5.7: siempre hay alternativa sin arrastrar).
//
// Estado inicial: ninguna opción marcada y sin pulgar visible. Solo una acción explícita
// del usuario (pulsar una opción, tocar o arrastrar la pista, o usar el teclado) registra valor.

export function crearEscala(contenedor, { escala, textos, etiquetadoPor, alSeleccionar }) {
  const nombre = `respuesta-${Math.random().toString(36).slice(2, 8)}`;

  const valor = document.createElement('p');
  valor.className = 'escala-valor';
  valor.id = 'valor-escala';

  const pista = document.createElement('div');
  pista.className = 'escala-pista sin-valor';
  pista.setAttribute('aria-hidden', 'true');
  const linea = document.createElement('span');
  linea.className = 'pista-linea';
  pista.append(linea);
  escala.forEach((_, i) => {
    const marca = document.createElement('span');
    marca.className = 'pista-marca';
    marca.style.setProperty('--i', String(i));
    pista.append(marca);
  });
  const pulgar = document.createElement('span');
  pulgar.className = 'pista-pulgar';
  pista.append(pulgar);

  const grupo = document.createElement('div');
  grupo.className = 'escala-opciones';
  grupo.setAttribute('role', 'radiogroup');
  if (etiquetadoPor) grupo.setAttribute('aria-labelledby', etiquetadoPor);
  grupo.setAttribute('aria-describedby', valor.id);

  const radios = escala.map((opcion) => {
    const etiqueta = document.createElement('label');
    etiqueta.className = 'opcion';
    const input = document.createElement('input');
    input.type = 'radio';
    input.name = nombre;
    input.value = String(opcion.valor);
    input.setAttribute('aria-label', `${opcion.valor}, ${opcion.etiqueta}`);
    const cara = document.createElement('span');
    cara.className = 'opcion-cara';
    cara.setAttribute('aria-hidden', 'true');
    const num = document.createElement('span');
    num.className = 'opcion-numero';
    num.textContent = String(opcion.valor);
    const txt = document.createElement('span');
    txt.className = 'opcion-etiqueta';
    txt.textContent = opcion.etiqueta;
    cara.append(num, txt);
    etiqueta.append(input, cara);
    grupo.append(etiqueta);
    input.addEventListener('change', () => {
      if (input.checked) alSeleccionar(opcion.valor);
    });
    return input;
  });

  contenedor.replaceChildren(valor, pista, grupo);

  let actual = null;

  function mostrar(v) {
    actual = Number.isInteger(v) ? v : null;
    const indice = escala.findIndex((o) => o.valor === actual);
    radios.forEach((r, i) => {
      r.checked = i === indice;
    });
    if (indice >= 0) {
      pista.classList.remove('sin-valor');
      pista.style.setProperty('--pos', String(indice));
      valor.textContent = textos.valor(escala[indice].valor, escala[indice].etiqueta);
      valor.classList.add('con-valor');
    } else {
      pista.classList.add('sin-valor');
      valor.textContent = textos.sinRespuesta;
      valor.classList.remove('con-valor');
    }
  }

  // ---- Interacción con la pista (tocar o arrastrar en horizontal) --------------------------
  // touch-action: pan-y deja el desplazamiento vertical al navegador; si el gesto es vertical,
  // el navegador cancela el puntero y no se registra ningún valor.
  let inicio = null;
  let arrastrando = false;

  function indiceDesdeX(clientX) {
    const r = pista.getBoundingClientRect();
    const relativo = (clientX - r.left) / r.width; // 0..1
    const i = Math.floor(relativo * escala.length);
    return Math.min(escala.length - 1, Math.max(0, i));
  }

  function seleccionarIndice(i) {
    const v = escala[i].valor;
    if (v === actual) return;
    radios[i].checked = true;
    alSeleccionar(v);
  }

  pista.addEventListener('pointerdown', (e) => {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    inicio = { x: e.clientX, y: e.clientY, id: e.pointerId };
    arrastrando = false;
  });

  pista.addEventListener('pointermove', (e) => {
    if (!inicio || e.pointerId !== inicio.id) return;
    const dx = e.clientX - inicio.x;
    const dy = e.clientY - inicio.y;
    if (!arrastrando && Math.abs(dx) > 8 && Math.abs(dx) > Math.abs(dy)) {
      arrastrando = true;
      try {
        pista.setPointerCapture(e.pointerId);
      } catch {
        /* sin captura disponible */
      }
    }
    if (arrastrando) {
      e.preventDefault();
      seleccionarIndice(indiceDesdeX(e.clientX));
    }
  });

  pista.addEventListener('pointerup', (e) => {
    if (!inicio || e.pointerId !== inicio.id) return;
    if (!arrastrando) {
      const dy = Math.abs(e.clientY - inicio.y);
      if (dy < 12) seleccionarIndice(indiceDesdeX(e.clientX)); // toque simple
    }
    inicio = null;
    arrastrando = false;
  });

  const cancelar = () => {
    inicio = null;
    arrastrando = false;
  };
  pista.addEventListener('pointercancel', cancelar);
  pista.addEventListener('lostpointercapture', () => {
    arrastrando = false;
  });

  mostrar(null);

  return {
    mostrar,
    elementoValor: valor,
    enfocarSeleccion() {
      const marcado = radios.find((r) => r.checked) || radios[0];
      marcado.focus();
    },
  };
}
