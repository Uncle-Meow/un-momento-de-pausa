// Lógica HTTP de la función: CORS, límites, validación, idempotencia y respuestas.
// El acceso a datos se inyecta (Repositorio) para poder probar el manejador sin Supabase.

import {
  calcularTotales,
  mismasRespuestas,
  type Respuestas,
  validarContraVersion,
  validarEstructura,
} from './validacion.ts';

export interface Actividad {
  version_cuestionario: string;
  abierta: boolean;
  item_ids: number[];
}

export interface EntregaGuardada {
  actividad_id: string;
  version_cuestionario: string;
  respuestas: Respuestas;
  recibida_en: string;
}

export type ResultadoInsercion =
  | { tipo: 'insertada'; recibida_en: string }
  | { tipo: 'duplicada' }
  | { tipo: 'rechazada'; codigo: string }
  | { tipo: 'error'; detalle: string };

export interface Repositorio {
  obtenerActividad(id: string): Promise<Actividad | null>;
  insertarEntrega(e: {
    id: string;
    actividad_id: string;
    version_cuestionario: string;
    respuestas: Respuestas;
  }): Promise<ResultadoInsercion>;
  obtenerEntrega(id: string): Promise<EntregaGuardada | null>;
}

export interface OpcionesManejador {
  repositorio: Repositorio;
  origenesPermitidos: string[];
  tamanoMaximo?: number;
  registrar?: (mensaje: string) => void;
}

export function crearManejador({ repositorio, origenesPermitidos, tamanoMaximo = 4096, registrar = () => {} }: OpcionesManejador) {
  const permitirTodo = origenesPermitidos.includes('*');

  function cabecerasCors(origen: string | null): Record<string, string> {
    const h: Record<string, string> = {
      'Vary': 'Origin',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'content-type',
      'Access-Control-Max-Age': '86400',
    };
    if (origen && (permitirTodo || origenesPermitidos.includes(origen))) {
      h['Access-Control-Allow-Origin'] = permitirTodo ? '*' : origen;
    }
    return h;
  }

  function json(estado: number, cuerpo: unknown, origen: string | null): Response {
    return new Response(JSON.stringify(cuerpo), {
      status: estado,
      headers: {
        ...cabecerasCors(origen),
        'Content-Type': 'application/json; charset=utf-8',
        'Cache-Control': 'no-store',
        'X-Content-Type-Options': 'nosniff',
      },
    });
  }

  const error = (estado: number, codigo: string, origen: string | null) => json(estado, { ok: false, codigo }, origen);

  return async function manejar(req: Request): Promise<Response> {
    const origen = req.headers.get('origin');
    const origenValido = !origen || permitirTodo || origenesPermitidos.includes(origen);

    if (req.method === 'OPTIONS') {
      if (!origenValido) return new Response(null, { status: 403, headers: { 'Vary': 'Origin' } });
      return new Response(null, { status: 204, headers: cabecerasCors(origen) });
    }
    if (req.method !== 'POST') return error(405, 'metodo_no_permitido', origen);
    // Los navegadores siempre envían Origin en solicitudes entre sitios. Las solicitudes sin
    // Origin (por ejemplo, curl) se aceptan porque CORS no protege fuera del navegador.
    if (!origenValido) return error(403, 'origen_no_permitido', origen);

    const tipo = req.headers.get('content-type') ?? '';
    if (!tipo.toLowerCase().startsWith('application/json')) return error(415, 'tipo_contenido_no_valido', origen);

    const longitud = Number(req.headers.get('content-length') ?? '0');
    if (longitud > tamanoMaximo) return error(413, 'cuerpo_demasiado_grande', origen);
    const texto = await req.text();
    if (new TextEncoder().encode(texto).length > tamanoMaximo) return error(413, 'cuerpo_demasiado_grande', origen);

    let cuerpo: unknown;
    try {
      cuerpo = JSON.parse(texto);
    } catch {
      return error(400, 'json_no_valido', origen);
    }

    const estructura = validarEstructura(cuerpo);
    if (!estructura.ok) return error(400, estructura.codigo, origen);
    const { id_entrega, actividad, version } = estructura.datos;

    let act: Actividad | null;
    try {
      act = await repositorio.obtenerActividad(actividad);
    } catch (e) {
      registrar(`obtenerActividad: ${(e as Error).message}`);
      return error(500, 'error_interno', origen);
    }
    if (!act || !act.abierta) return error(403, 'actividad_no_disponible', origen);
    if (act.version_cuestionario !== version) return error(400, 'version_no_corresponde', origen);

    const contraVersion = validarContraVersion(estructura.datos.respuestas, act.item_ids);
    if (!contraVersion.ok) return error(400, contraVersion.codigo, origen);
    const respuestas = contraVersion.respuestas;
    const { total, promedio } = calcularTotales(respuestas);

    const resultado = await repositorio.insertarEntrega({
      id: id_entrega,
      actividad_id: actividad,
      version_cuestionario: version,
      respuestas,
    });

    switch (resultado.tipo) {
      case 'insertada':
        return json(201, { ok: true, id_entrega, total, promedio, duplicado: false, recibida_en: resultado.recibida_en }, origen);
      case 'duplicada': {
        // Reintento de la misma entrega: si el contenido coincide, se confirma sin duplicar.
        let previa: EntregaGuardada | null = null;
        try {
          previa = await repositorio.obtenerEntrega(id_entrega);
        } catch (e) {
          registrar(`obtenerEntrega: ${(e as Error).message}`);
          return error(500, 'error_interno', origen);
        }
        if (
          previa &&
          previa.actividad_id === actividad &&
          previa.version_cuestionario === version &&
          mismasRespuestas(previa.respuestas, respuestas)
        ) {
          return json(200, { ok: true, id_entrega, total, promedio, duplicado: true, recibida_en: previa.recibida_en }, origen);
        }
        return error(409, 'conflicto_id_entrega', origen);
      }
      case 'rechazada':
        return error(resultado.codigo === 'actividad_no_disponible' ? 403 : 400, resultado.codigo, origen);
      default:
        registrar(`insertarEntrega: ${resultado.detalle}`);
        return error(500, 'error_interno', origen);
    }
  };
}
