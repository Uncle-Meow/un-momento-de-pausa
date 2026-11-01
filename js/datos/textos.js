// Textos de la interfaz. Se pueden editar libremente sin tocar la lógica.
// Las funciones reciben números ya calculados y devuelven el texto que se muestra.

export const TEXTOS = {
  app: {
    titulo: 'Un momento de pausa',
    subtitulo: 'Señales de desgaste en los estudios y el trabajo',
    tituloDocumento: 'Un momento de pausa · Señales de desgaste',
  },

  inicio: {
    // Propósito en tres frases: actividad educativa, participación voluntaria, no es diagnóstico,
    // y guardado sin nombre ni datos de contacto.
    proposito: [
      'Esta es una actividad educativa para reflexionar sobre experiencias de desgaste en los estudios o en el trabajo.',
      'Participar es voluntario y el resultado que verás no es un diagnóstico.',
      'Tus respuestas se guardarán sin nombre ni datos de contacto para elaborar un resumen académico del grupo.',
    ],
    duracion: (total) => `Son ${total} preguntas breves. Puedes responder a tu ritmo.`,
    botonEmpezar: 'Empezar',
    acerca: 'Sobre esta actividad',
  },

  instrucciones: {
    titulo: 'Antes de comenzar',
    indicacion:
      'Piensa en tus últimas cuatro semanas. Responde considerando tus estudios o tu trabajo y mantén el mismo ámbito durante todo el cuestionario. Indica con qué frecuencia has experimentado cada situación.',
    datosTitulo: 'Qué se guarda',
    datos: (total) =>
      `Tus ${total} respuestas, un código aleatorio de la entrega, la versión del cuestionario y la fecha de recepción. No se piden nombres ni datos de contacto. Los servicios de alojamiento pueden conservar registros técnicos de la conexión.`,
    aceptacion: 'Acepto participar de forma voluntaria en esta actividad.',
    pistaAceptacion: 'Marca la casilla para comenzar.',
    botonVolver: 'Volver',
    botonComenzar: 'Comenzar',
  },

  pregunta: {
    posicion: (actual, total) => `Pregunta ${actual} de ${total}`,
    pendientes: (n) => (n === 0 ? 'Todas respondidas' : n === 1 ? '1 sin responder' : `${n} sin responder`),
    etiquetaProgreso: 'Preguntas respondidas',
    textoProgreso: (respondidas, total) => `${respondidas} de ${total} respondidas`,
    sinRespuesta: 'Elige una opción para continuar',
    valor: (valor, etiqueta) => `${valor} · ${etiqueta}`,
    etiquetaEscala: 'Frecuencia',
    botonAnterior: 'Anterior',
    botonSiguiente: 'Siguiente',
    botonRevisar: 'Revisar respuestas',
    botonVolverRevision: 'Volver a la revisión',
  },

  revision: {
    titulo: 'Revisa tus respuestas',
    descripcion: 'Puedes cambiar cualquier respuesta antes de entregar.',
    descripcionLectura: 'Estas son las respuestas que enviaste.',
    sinResponder: 'Sin responder',
    botonCambiar: 'Cambiar',
    etiquetaCambiar: (posicion) => `Cambiar la respuesta de la pregunta ${posicion}`,
    faltan: (n) => (n === 1 ? 'Falta 1 respuesta para poder entregar.' : `Faltan ${n} respuestas para poder entregar.`),
    botonAnterior: 'Anterior',
    botonEntregar: 'Entregar',
    botonEnviando: 'Enviando…',
    enviando: 'Enviando tus respuestas…',
    botonVolverResumen: 'Volver al resumen',
    borrar: 'Borrar mis respuestas y salir',
    sinConfiguracion:
      'Aviso: este sitio aún no tiene configurado el servicio de guardado. Al entregar verás tu resumen, pero tu entrega no se registrará.',
  },

  resultado: {
    titulo: 'Tu resumen',
    suma: 'Tus puntos',
    rangoSuma: (minimo, maximo) => `De ${minimo} a ${maximo} puntos`,
    promedio: 'Tu promedio',
    rangoPromedio: 'Escala de 1 a 5',
    explicacion: 'Una puntuación mayor indica que reportaste con más frecuencia las situaciones consultadas.',
    nota: 'Actividad educativa. Los rangos describen frecuencia, no gravedad ni diagnóstico.',
    rangoFrecuencia: (nivel) => `Rango ${nivel} de 5 · Según tu promedio`,
    frecuencia: (etiqueta) => `Promedio cercano a «${etiqueta}»`,
    detalleTitulo: 'Cómo se calcula',
    metodo: 'Se suman las respuestas y se dividen entre el número de preguntas. El promedio se redondea a la opción de frecuencia más cercana para elegir uno de los cinco rangos descriptivos. Las sugerencias son orientaciones generales, no un tratamiento asignado por puntuación.',
    leyendaEscala: 'Tu promedio sobre la escala original de respuesta, que empieza en 1.',
    ayuda:
      'Si el malestar se mantiene o afecta tu vida cotidiana, considera buscar orientación profesional, por ejemplo en los servicios de apoyo de tu universidad o de tu lugar de trabajo.',
    botonVerRespuestas: 'Ver mis respuestas',
    botonTerminar: 'Terminar',
    acerca: 'Sobre esta actividad',
  },

  guardado: {
    enviando: 'Enviando tu entrega…',
    guardado: 'Entrega guardada. Gracias por participar.',
    duplicado: 'Tu entrega ya estaba guardada. Gracias por participar.',
    fallido:
      'No se pudo guardar tu entrega porque falló la conexión. Tus respuestas siguen en esta pestaña; puedes reintentar el envío.',
    incierto:
      'No pudimos confirmar si tu entrega se guardó. Reintentar es seguro: no se crearán entregas duplicadas.',
    rechazado: (detalle) => `El servidor no aceptó la entrega${detalle ? ` (${detalle})` : ''}. Tu entrega no se guardó.`,
    cerrado: 'La actividad ya no está recibiendo respuestas. Tu entrega no se guardó.',
    sinConfiguracion:
      'Este sitio todavía no tiene configurado el servicio de guardado, así que tu entrega no se registró. Tu resumen individual sigue disponible.',
    botonReintentar: 'Reintentar envío',
  },

  confirmaciones: {
    borrarTitulo: '¿Borrar tus respuestas?',
    borrarTexto: 'Se eliminarán las respuestas guardadas temporalmente en esta pestaña y volverás al inicio.',
    terminarTitulo: '¿Terminar la actividad?',
    terminarTexto: 'Se borrarán de esta pestaña tus respuestas y tu resumen.',
    terminarSinGuardar:
      'Tu entrega no se guardó. Si terminas ahora, se borrarán tus respuestas de esta pestaña y no podrás reintentar el envío.',
    botonConfirmar: 'Sí, borrar',
    botonConfirmarTerminar: 'Terminar',
    botonCancelar: 'Cancelar',
  },

  movimiento: {
    pausar: 'Pausar animaciones',
    reanudar: 'Reanudar animaciones',
  },

  acerca: {
    titulo: 'Sobre esta actividad',
    curso: 'Curso',
    cursoNombre: 'Habilidades del Liderazgo',
    profesora: 'Profesora',
    profesoraNombre: 'Angélica Méndez Varela',
    integrantes: 'Integrantes',
    integrantesNombres: ['Dominique Trejos Álvarez', 'Marlon Francisco Murillo García', 'Juan Pablo Morera González'],
    explicacion:
      'Las preguntas son una elaboración del equipo para una actividad educativa. Esta selección y sus rangos descriptivos no tienen validación psicométrica y no deben interpretarse como una medición clínica.',
    alcanceRecomendaciones: 'Las sugerencias se asignan mediante una regla editorial de frecuencia, no por gravedad clínica. La caminata de diez minutos es una propuesta inicial, no una dosis terapéutica; los bloques de actividad y pausa pueden ajustarse. Las siete horas de sueño o más corresponden a adultos; para adolescentes de 13 a 17 años se recomiendan entre ocho y diez horas. Si el malestar persiste o afecta tu vida cotidiana, puedes consultar a un profesional independientemente del puntaje.',
    fuentesTitulo: 'Fuentes de las recomendaciones',
    fuentes: [
      { texto: 'Centers for Disease Control and Prevention. (2024, 15 de mayo). About sleep.', url: 'https://www.cdc.gov/sleep/about/' },
      { texto: 'Organización Mundial de la Salud. (2024, 26 de junio). Physical activity.', url: 'https://www.who.int/news-room/fact-sheets/detail/physical-activity' },
      { texto: 'Organización Mundial de la Salud. (2026, 15 de septiembre). Mental health at work.', url: 'https://www.who.int/news-room/fact-sheets/detail/mental-health-at-work' },
      { texto: 'Smits, E. J. C., Wenzel, N., & de Bruin, A. (2025). Investigating the effectiveness of self-regulated, Pomodoro, and Flowtime break-taking techniques among students. Behavioral Sciences, 15(7), Article 861.', url: 'https://doi.org/10.3390/bs15070861' },
    ],
    marco:
      'Como marco de consulta se revisó la literatura sobre el Burnout Assessment Tool para estudiantes (BAT-S). Esta selección de preguntas no es una versión validada de ese instrumento.',
    referenciaTitulo: 'Referencia',
    referencia: {
      autores:
        'Carmona-Halty, M., Alarcón-Castillo, K., Semir-González, C., Sepúlveda-Páez, G., & Schaufeli, W. B. (2024).',
      titulo:
        'Burnout Assessment Tool for Students (BAT-S): Evidence of validity in a Chilean sample of undergraduate university students.',
      revista: 'Frontiers in Psychology, 15',
      resto: ', Article 1434412.',
      doi: 'https://doi.org/10.3389/fpsyg.2024.1434412',
    },
    cerrar: 'Cerrar',
  },

  presentacion: {
    titulo: 'Un momento de pausa',
    subtitulo: 'Señales de desgaste en los estudios y el trabajo',
    instruccion: 'Escanea el código con la cámara de tu celular para participar.',
    alternativa: 'O abre esta dirección:',
    descargarPng: 'Descargar QR (PNG)',
    descargarSvg: 'Descargar QR (SVG)',
    etiquetaQr: (url) => `Código QR que abre ${url}`,
    avisoLocal:
      'El código estará disponible al publicar el cuestionario con una dirección HTTPS real. Configura la dirección antes de compartirlo.',
  },

  sinScript: 'Esta actividad necesita JavaScript activado para funcionar.',
};
