// Servidor de prueba local: ejecuta el mismo manejador de la Edge Function contra un Postgres
// local con la migración aplicada, conectándose con el rol service_role (como la función real).
// Solo para pruebas; no se despliega.
//
//   PG_URL=postgres://postgres@127.0.0.1:54329/pausa_e2e ORIGENES_PERMITIDOS=http://127.0.0.1:8765 \
//   deno run -A pruebas/funcion/servidor_local.ts

import postgres from 'npm:postgres@3';
import { crearManejador, type Repositorio } from '../../supabase/functions/registrar-entrega/manejador.ts';

const sql = postgres(Deno.env.get('PG_URL') ?? 'postgres://postgres@127.0.0.1:54329/pausa_e2e', {
  max: 2,
  // Cada sesión actúa como service_role, igual que la clave secreta en Supabase.
  connection: { role: 'service_role' } as Record<string, string>,
});

const CODIGOS = new Set([
  'actividad_no_disponible',
  'version_no_corresponde',
  'respuestas_no_validas',
  'id_pregunta_no_valido',
  'valor_no_valido',
  'respuestas_incompletas',
]);

const repositorio: Repositorio = {
  async obtenerActividad(id) {
    const filas = await sql`
      select a.version_cuestionario, a.abierta, c.item_ids
      from public.actividades a join public.cuestionario_versiones c on c.version = a.version_cuestionario
      where a.id = ${id}`;
    if (!filas.length) return null;
    return { version_cuestionario: filas[0].version_cuestionario, abierta: filas[0].abierta, item_ids: filas[0].item_ids.map(Number) };
  },
  async insertarEntrega(e) {
    try {
      const [f] = await sql`
        insert into public.entregas (id, actividad_id, version_cuestionario, respuestas)
        values (${e.id}, ${e.actividad_id}, ${e.version_cuestionario}, ${sql.json(e.respuestas)})
        returning recibida_en`;
      return { tipo: 'insertada', recibida_en: new Date(f.recibida_en).toISOString() };
    } catch (err) {
      const x = err as { code?: string; message: string };
      if (x.code === '23505') return { tipo: 'duplicada' };
      if (x.code === 'P0001' && CODIGOS.has(x.message)) return { tipo: 'rechazada', codigo: x.message };
      return { tipo: 'error', detalle: `${x.code} ${x.message}` };
    }
  },
  async obtenerEntrega(id) {
    const filas = await sql`select actividad_id, version_cuestionario, respuestas, recibida_en from public.entregas where id = ${id}`;
    if (!filas.length) return null;
    return { ...filas[0], recibida_en: new Date(filas[0].recibida_en).toISOString() } as never;
  },
};

const origenes = (Deno.env.get('ORIGENES_PERMITIDOS') ?? '').split(',').map((s) => s.trim()).filter(Boolean);
const manejar = crearManejador({ repositorio, origenesPermitidos: origenes, registrar: (m) => console.error(m) });
const puerto = Number(Deno.env.get('PUERTO') ?? '8787');
Deno.serve({ port: puerto, hostname: '127.0.0.1' }, manejar);
