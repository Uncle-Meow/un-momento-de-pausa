// Parámetros de publicación. Complete estos valores antes de usar el sitio con el grupo.
// Ninguno de ellos es secreto: no coloque aquí claves secretas, contraseñas ni tokens.

export const CONFIG = Object.freeze({
  // Identificador de la actividad; debe coincidir con la configuración del servicio.
  actividad: 'habilidades-liderazgo-2026',

  // URL /exec del despliegue público de Apps Script que recibe las entregas.
  // La conexión se realiza mediante un iframe de HtmlService y google.script.run.
  // Mientras esté vacía, la aplicación funciona pero informa que no puede guardar entregas.
  endpointEntregas: 'https://script.google.com/macros/s/AKfycbwE0wSZZuTfXfOxOlY_meJeZEvZXRR_ymdIXMwhNsxk08-xQN1FEIVVe0osQsh85iE/exec',

  // URL pública HTTPS definitiva del cuestionario en GitHub Pages, con la barra final, por ejemplo:
  //   https://<usuario>.github.io/<repositorio>/
  // El QR del modo de presentación apunta a esta dirección. Si queda vacía, se deduce de la
  // dirección actual cuando el sitio ya está publicado con HTTPS.
  urlPublica: 'https://uncle-meow.github.io/un-momento-de-pausa/',

  // Formato de números (separador decimal) y tiempo máximo de espera del envío.
  idioma: 'es-CR',
  tiempoMaximoEnvioMs: 45000,

  // Clave del borrador en sessionStorage (cambiarla invalida borradores anteriores).
  claveBorrador: 'pausa-borrador-v1',
});
