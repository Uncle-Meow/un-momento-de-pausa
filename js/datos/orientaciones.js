// Contenido educativo acordado por el equipo, editable sin alterar el cálculo.
// Los cinco rangos describen la frecuencia media; no son grados de burnout.
// La asignación de sugerencias es editorial, no un tratamiento validado por puntaje.

export const ORIENTACIONES = Object.freeze([
  {
    nivel: 1, frecuencia: 'Nunca', titulo: 'Cuida tus rutinas',
    recomendaciones: [
      'Prueba una caminata de 10 minutos, a tu ritmo.',
      'Procura dormir 7 horas o más.',
      'Reserva un momento para algo que disfrutes.',
    ],
    frase: 'Los pequeños cuidados también cuentan.',
  },
  {
    nivel: 2, frecuencia: 'Rara vez', titulo: 'Encuentra tu ritmo',
    recomendaciones: [
      'Prueba bloques de 25 minutos con pausas de 5; ajústalos si lo necesitas.',
      'Silencia notificaciones mientras haces una tarea.',
      'Define una hora para cerrar tus actividades.',
    ],
    frase: 'Puedes avanzar sin hacerlo todo de una vez.',
  },
  {
    nivel: 3, frecuencia: 'Algunas veces', titulo: 'Haz espacio para una pausa',
    recomendaciones: [
      'Elige una prioridad y aplaza lo que pueda esperar.',
      'Toma una pausa sin trabajo, estudio ni pendientes en paralelo.',
      'Comparte con alguien qué te está costando.',
    ],
    frase: 'No tienes que resolverlo todo hoy.',
  },
  {
    nivel: 4, frecuencia: 'A menudo', titulo: 'Comparte la carga',
    recomendaciones: [
      'Conversa con tu docente o jefatura sobre plazos y cargas.',
      'Pide colaboración con una tarea concreta.',
      'Protege un espacio de descanso fuera de tus obligaciones.',
    ],
    frase: 'Tu tiempo y tu energía merecen límites.',
  },
  {
    nivel: 5, frecuencia: 'Siempre', titulo: 'Date espacio y compañía',
    recomendaciones: [
      'Revisa qué compromiso puedes aplazar o renegociar.',
      'Busca compañía para organizar lo que estás viviendo.',
      'Considera conversar con orientación estudiantil o un profesional.',
    ],
    frase: 'Mereces apoyo y tiempo para cuidarte.',
  },
].map((o) => Object.freeze({ ...o, recomendaciones: Object.freeze(o.recomendaciones) })));
