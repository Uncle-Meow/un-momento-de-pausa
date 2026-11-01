// Parámetros de publicación. Complete estos valores antes de usar el sitio con el grupo.
// Ninguno de ellos es secreto: no coloque aquí claves secretas, contraseñas ni tokens.

export const CONFIG = Object.freeze({
  // Identificador de la actividad. Debe existir en la tabla public.actividades de Supabase
  // (la migración incluida la crea con este mismo valor).
  actividad: 'habilidades-liderazgo-2026',

  // URL de la Edge Function que recibe las entregas, por ejemplo:
  //   https://<referencia-del-proyecto>.supabase.co/functions/v1/registrar-entrega
  // Mientras esté vacía, la aplicación funciona pero informa que no puede guardar entregas.
  endpointEntregas: '',

  // URL pública HTTPS definitiva del cuestionario en GitHub Pages, con la barra final, por ejemplo:
  //   https://<usuario>.github.io/<repositorio>/
  // El QR del modo de presentación apunta a esta dirección. Si queda vacía, se deduce de la
  // dirección actual cuando el sitio ya está publicado con HTTPS.
  urlPublica: '',

  // Formato de números (separador decimal) y tiempo máximo de espera del envío.
  idioma: 'es-CR',
  tiempoMaximoEnvioMs: 15000,

  // Clave del borrador en sessionStorage (cambiarla invalida borradores anteriores).
  claveBorrador: 'pausa-borrador-v1',
});
