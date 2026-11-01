// Edge Function "registrar-entrega": recibe entregas del cuestionario y las guarda en
// public.entregas. Se despliega con verify_jwt = false porque los participantes no inician
// sesión; la protección está en la validación, los permisos de la base de datos y RLS.
//
// Secretos y variables (nunca en el código público):
//   SUPABASE_URL ................ la provee Supabase automáticamente.
//   SUPABASE_SECRET_KEYS ........ la provee Supabase (JSON con las claves secretas sb_secret_...).
//   SUPABASE_SERVICE_ROLE_KEY ... clave heredada; se usa solo si no hay claves secretas nuevas.
//   NOMBRE_CLAVE_SECRETA ........ opcional; nombre de la clave secreta a usar (por defecto "default").
//   ORIGENES_PERMITIDOS ......... obligatorio; orígenes separados por comas, por ejemplo
//                                 https://usuario.github.io

import { createClient } from 'npm:@supabase/supabase-js@2';
import { crearManejador, type Repositorio } from './manejador.ts';

function claveSecreta(): string {
  const nombre = Deno.env.get('NOMBRE_CLAVE_SECRETA') || 'default';
  const nuevas = Deno.env.get('SUPABASE_SECRET_KEYS');
  if (nuevas) {
    try {
      const clave = JSON.parse(nuevas)[nombre];
      if (typeof clave === 'string' && clave) return clave;
    } catch {
      /* formato inesperado: se intenta la clave heredada */
    }
  }
  const heredada = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (heredada) return heredada;
  throw new Error('No hay clave secreta disponible en el entorno de la función');
}

const url = Deno.env.get('SUPABASE_URL');
if (!url) throw new Error('Falta SUPABASE_URL');

const db = createClient(url, claveSecreta(), {
  auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
});

const CODIGOS_TRIGGER = new Set([
  'actividad_no_disponible',
  'version_no_corresponde',
  'respuestas_no_validas',
  'id_pregunta_no_valido',
  'valor_no_valido',
  'respuestas_incompletas',
]);

const repositorio: Repositorio = {
  async obtenerActividad(id) {
    const { data, error } = await db
      .from('actividades')
      .select('version_cuestionario, abierta, cuestionario_versiones ( item_ids )')
      .eq('id', id)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!data) return null;
    // deno-lint-ignore no-explicit-any
    const version = (data as any).cuestionario_versiones;
    const itemIds = Array.isArray(version) ? version[0]?.item_ids : version?.item_ids;
    if (!Array.isArray(itemIds)) return null;
    return { version_cuestionario: data.version_cuestionario, abierta: data.abierta, item_ids: itemIds.map(Number) };
  },

  async insertarEntrega(e) {
    const { data, error } = await db.from('entregas').insert(e).select('recibida_en').single();
    if (!error) return { tipo: 'insertada', recibida_en: data.recibida_en };
    if (error.code === '23505') return { tipo: 'duplicada' };
    if (error.code === 'P0001' && CODIGOS_TRIGGER.has(error.message)) return { tipo: 'rechazada', codigo: error.message };
    return { tipo: 'error', detalle: `${error.code ?? ''} ${error.message}` };
  },

  async obtenerEntrega(id) {
    const { data, error } = await db
      .from('entregas')
      .select('actividad_id, version_cuestionario, respuestas, recibida_en')
      .eq('id', id)
      .maybeSingle();
    if (error) throw new Error(error.message);
    return data ?? null;
  },
};

const origenes = (Deno.env.get('ORIGENES_PERMITIDOS') ?? '')
  .split(',')
  .map((s) => s.trim().replace(/\/$/, ''))
  .filter(Boolean);

if (origenes.length === 0) {
  console.error('ORIGENES_PERMITIDOS está vacío: se rechazarán las solicitudes desde navegadores.');
}

const manejar = crearManejador({
  repositorio,
  origenesPermitidos: origenes,
  // Solo se registran códigos de error, nunca el contenido de las respuestas.
  registrar: (m) => console.error(m),
});

Deno.serve(manejar);
