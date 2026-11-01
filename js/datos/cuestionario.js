// Cuestionario editable.
//
// - "version" identifica esta versión del cuestionario. Si cambian las preguntas, cree una
//   versión nueva y regístrela también en la base de datos (ver README, sección "Cambiar
//   las preguntas").
// - "id" es el identificador estable de cada pregunta (se conserva el número del banco
//   original). En pantalla las posiciones se numeran de forma consecutiva.
// - El total de preguntas se obtiene siempre de la longitud de "preguntas".

export const CUESTIONARIO = Object.freeze({
  version: '2026-11-v2',
  escala: Object.freeze([
    Object.freeze({ valor: 1, etiqueta: 'Nunca' }),
    Object.freeze({ valor: 2, etiqueta: 'Rara vez' }),
    Object.freeze({ valor: 3, etiqueta: 'Algunas veces' }),
    Object.freeze({ valor: 4, etiqueta: 'A menudo' }),
    Object.freeze({ valor: 5, etiqueta: 'Siempre' }),
  ]),
  preguntas: Object.freeze([
    Object.freeze({ id: 1, texto: '¿Terminas tus actividades sintiéndote mentalmente agotado?' }),
    Object.freeze({ id: 3, texto: '¿Sientes agotamiento físico mientras realizas tus actividades habituales?' }),
    Object.freeze({ id: 4, texto: '¿Te cuesta recuperar la energía para la siguiente jornada, incluso después de descansar?' }),
    Object.freeze({ id: 7, texto: '¿Te cuesta interesarte por las actividades que realizas?' }),
    Object.freeze({ id: 8, texto: '¿Sientes rechazo al pensar en retomar tus actividades?' }),
    Object.freeze({ id: 11, texto: '¿Pierdes el hilo de una tarea mientras la estás realizando?' }),
    Object.freeze({ id: 13, texto: '¿Olvidas información que necesitas utilizar en tus tareas habituales?' }),
    Object.freeze({ id: 15, texto: '¿Te cuesta pensar con claridad cuando debes resolver una tarea?' }),
    Object.freeze({ id: 16, texto: '¿Te irritas con facilidad ante dificultades habituales de tus actividades?' }),
    Object.freeze({ id: 17, texto: '¿Te cuesta recuperar la calma después de un contratiempo relacionado con tus actividades?' }),
  ]),
});
