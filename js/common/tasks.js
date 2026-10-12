// ═══════════════════════════════════════════════════════════════════════
//  STACKCLASS — Tasks (Tareas Classroom y Rúbricas Offline)
// ═══════════════════════════════════════════════════════════════════════

export const OFFLINE_RUBRIC = [
  { id: "comprension", title: "1. Comprensión del Concepto", desc: "Entiende perfectamente el concepto principal de la tarea.", levels: [ { points: 0, desc: "Nada" }, { points: 0.5, desc: "A medias" }, { points: 1, desc: "Perfecto" } ] },
  { id: "resolucion", title: "2. Resolución de Problemas", desc: "Resuelve los problemas técnicos de forma eficaz.", levels: [ { points: 0, desc: "Nada" }, { points: 0.5, desc: "A medias" }, { points: 1, desc: "Perfecto" } ] },
  { id: "herramientas", title: "3. Uso de Herramientas", desc: "Maneja adecuadamente las herramientas/apps solicitadas.", levels: [ { points: 0, desc: "Nada" }, { points: 0.5, desc: "A medias" }, { points: 1, desc: "Perfecto" } ] },
  { id: "organizacion", title: "4. Organización del Trabajo", desc: "El trabajo está bien estructurado y es fácil de seguir.", levels: [ { points: 0, desc: "Nada" }, { points: 0.5, desc: "A medias" }, { points: 1, desc: "Perfecto" } ] },
  { id: "creatividad", title: "5. Creatividad y Originalidad", desc: "Aporta ideas propias, no se limita a copiar lo básico.", levels: [ { points: 0, desc: "Nada" }, { points: 0.5, desc: "A medias" }, { points: 1, desc: "Perfecto" } ] },
  { id: "formato", title: "6. Presentación Visual", desc: "El formato, colores y estética son atractivos y limpios.", levels: [ { points: 0, desc: "Nada" }, { points: 0.5, desc: "A medias" }, { points: 1, desc: "Perfecto" } ] },
  { id: "ortografia", title: "7. Redacción y Ortografía", desc: "Sin faltas de ortografía y bien redactado.", levels: [ { points: 0, desc: "Nada" }, { points: 0.5, desc: "A medias" }, { points: 1, desc: "Perfecto" } ] },
  { id: "autonomia", title: "8. Autonomía", desc: "Ha trabajado de forma autónoma sin depender del profesor.", levels: [ { points: 0, desc: "Nada" }, { points: 0.5, desc: "A medias" }, { points: 1, desc: "Perfecto" } ] },
  { id: "instrucciones", title: "9. Sigue las Instrucciones", desc: "Ha cumplido con absolutamente todos los pasos requeridos.", levels: [ { points: 0, desc: "Nada" }, { points: 0.5, desc: "A medias" }, { points: 1, desc: "Perfecto" } ] },
  { id: "profundidad", title: "10. Nivel de Detalle", desc: "Profundidad en las respuestas y esfuerzo destacable.", levels: [ { points: 0, desc: "Nada" }, { points: 0.5, desc: "A medias" }, { points: 1, desc: "Perfecto" } ] }
];

import { TASK_1_DEFAULT_RUBRIC } from './rubric.js';

export const TIC2_CLASSROOM_TASKS = [
  {
    "id": "1",
    "title": "Producción: Tablero Kanban de la Redacción",
    "block": "A",
    "crit": "5.2",
    "description": "¡Bienvenidos a la redacción! En grupos de 2 o 3, vais a coordinar vuestro programa de radio creando un tablero Kanban profesional.\n\n⚠️ REQUISITOS MÍNIMOS DE PRODUCCIÓN:\n1. Cada miembro del equipo deberá crear al menos 4 tareas reales del programa.\n2. Debéis asignar responsables a cada tarea y moverlas por los distintos estados (To Do, Doing, Done).\n3. Añadid al Director de Producción al tablero usando el correo: [correo de tu profesor/a]. IMPORTANTE: Limitad los permisos del profesor (modo lectura/observador) para que no pueda romperos las tareas por accidente.\n\nENTREGABLE INDIVIDUAL: Cada miembro del equipo entregará un PDF explicando detalladamente el uso de la herramienta Kanban escogida, justificando por qué habéis elegido esa y no otra (ej. Trello, Jira, Notion), y aportando capturas de pantalla de vuestro tablero en acción. \n\n⚠️ IMPORTANTE: El archivo debe llamarse EXACTAMENTE ApellidosNombre_Tarea1.pdf\n\n📌 Criterio a evaluar: CE 5.2.",
    "customRubric": TASK_1_DEFAULT_RUBRIC
  },
  {
    "id": "2",
    "title": "Guión Técnico y Escaleta del Podcast",
    "block": "B",
    "crit": "1.1",
    "description": "¡Silencio en el estudio! Para que un programa arrase en audiencias, no se puede improvisar. TODO EL GRUPO ENTREGA EL TRABAJO. Elaborad un guión profesional sobre Inteligencia Artificial.\n\n⚠️ LEY FUNDAMENTAL DE LA RADIO: El tiempo es sagrado. La escaleta técnica debe cuadrar EXACTAMENTE en 5 minutos de programa (ni 4:30 ni 5:15). Cronometraos leyendo el guión y anotando cuándo entra cada sintonía o efecto.\n\nPresentad un PDF impecable: Portada, Índice, Introducción, Escaleta de tiempo al segundo, Guión a doble columna (Técnico/Locutorio) y Bibliografía APA. Compartid el Google Docs con [correo de tu profesor/a] con permisos de Comentador. Las nomenclaturas de los archivos deben ser perfectas: El archivo debe llamarse EXACTAMENTE ApellidosNombre_Tarea2.pdf\n\n📌 Criterio a evaluar: CE 1.1."
  },
  {
    "id": "3",
    "title": "ON AIR: Grabación y Postproducción (Audacity)",
    "block": "B",
    "crit": "4.1",
    "description": "¡Grabando! Llevad vuestro guión al estudio (SUM) y convertidlo en magia. En esta tarea entregaréis el archivo MP3 máster de vuestro podcast.\n\nEl resultado debe sonar como en las grandes emisoras profesionales: aplicad filtros, reducción de ruido, ecualización y compresores en Audacity para que las voces suenen profundas y nítidas. \n\n⚠️ REQUISITOS ESTRICTOS: El máster final en MP3 debe durar EXACTAMENTE 5 MINUTOS. Ni un segundo más, ni un segundo menos. Entregad también un 'Manual de Ingeniero de Sonido' (PDF con capturas) explicando cómo habéis limpiado el audio. Nombrad los archivos exactamente como se indica: ApellidosNombre_Tarea3.mp3 y ApellidosNombre_Tarea3.pdf\n\n📌 Criterio a evaluar: CE 4.1."
  },
  {
    "id": "Game_CC",
    "title": "Juego: Radio Trivial CC",
    "block": "B",
    "crit": "4.1",
    "description": "🎙️ Radio Trivial CC. Estás produciendo el podcast de la radio escolar. Responde al trivial para saber qué música o efectos puedes usar legalmente.\n\n📌 Criterio a evaluar: CE 4.1."
  },
  {
    "id": "4",
    "title": "Desarrollo de la Web Oficial de la Cadena",
    "block": "B",
    "crit": "3.1, 2.2",
    "description": "Un programa líder de audiencia necesita una plataforma digital a su altura. Desarrollad la web oficial de vuestro podcast usando WordPress.com (plan gratuito).\n\n⚠️ REQUISITOS TÉCNICOS Y DE CONTENIDO:\n1. **Páginas y Entradas:** Debéis crear tanto Páginas estáticas (ej. 'Sobre nosotros') como Entradas de blog organizadas obligatoriamente por **Categorías**.\n2. **Redacción:** Cada miembro del equipo debe redactar y publicar al menos **2 entradas distintas** sobre la temática del podcast.\n3. **Identidad Visual:** Diseñad un Logotipo Horizontal para la cabecera de la web y un Logotipo Cuadrado para los perfiles de redes sociales.\n4. **Estructura:** Menú de navegación claro, iconos enlazados a vuestras redes sociales, y dejad un espacio/página reservado para incrustar el reproductor del podcast en el futuro.\n5. **Permisos de Redacción:** Añadid a todos los miembros y al Director ([correo de tu profesor/a]) como usuarios con permisos de escritura. Esto es vital para que quede registrado el autor real de cada entrada.\n6. **Visibilidad:** La web debe ser 100% PÚBLICA. Comprobad que se puede navegar por ella abriéndola en una ventana de incógnito.\n\nENTREGABLE: Entregad la URL pública del WordPress (si subís un documento con la URL, nombradlo EXACTAMENTE ApellidosNombre_Tarea4.pdf). ¡Cualquier enlace roto baja la audiencia!\n\n⚠️ PRIVACIDAD: Se evaluará que **ningún miembro del equipo aparezca con su nombre completo** en la web pública y que la web tenga una **Política de Privacidad** básica.\n\n📌 Criterios a evaluar: CE 3.1 y CE 2.2."
  },
  {
    "id": "5",
    "title": "SEO y Analytics",
    "block": "B",
    "crit": "3.1",
    "description": "Optimiza la web del podcast para que aparezca en la primera página de Google. Mejora títulos, metas, URLs y alt-text para escalar posiciones en el ranking.\n\n📌 Criterio a evaluar: CE 3.1."
  },
  {
    "id": "6",
    "title": "Marketing: Campaña de Difusión Nacional",
    "block": "B",
    "crit": "3.1",
    "description": "¡Salgamos a vender el programa! Diseñad una agresiva campaña de publicidad física y digital para reventar las audiencias en el estreno.\n\nEn un documento PDF, detallad la estrategia física (cartelería urbana, pegatinas) y virtual (campañas en redes sociales). Adjuntad un archivo ZIP con todas las imágenes y creatividades diseñadas. \n\n⚠️ CONTROL DE CALIDAD: La resolución (ppi) en GIMP debe ser profesional para imprenta. Nomenclatura estricta: Los archivos a entregar deben llamarse ApellidosNombre_Tarea6.pdf y ApellidosNombre_Tarea6.zip. ¡Si el diseño está pixelado, la campaña fracasa! Tened especial cuidado con los datos personales de los miembros del equipo en la campaña.\n\n📌 Criterio a evaluar: CE 3.1."
  },
  {
    "id": "7",
    "title": "Innovación: Podcast Generado por Inteligencia Artificial",
    "block": "B",
    "crit": "1.1",
    "description": "El futuro de la radio. Buscad un informe técnico (PDF) sobre Ciberseguridad. Alimentad con él a una IA generadora de podcasts (ej. NotebookLM) y producid un episodio de radio sintética de 5 minutos.\n\nPero sois los Directores de Contenido: escuchad críticamente la locución de la IA y anotad sus errores (entonación, fallos de traducción, pausas robóticas). Entregad: El PDF original, el MP3 generado por la IA, y un Google Doc (bien formateado y compartido) con vuestra auditoría de calidad. ¡Audición estricta! Nombra tus archivos como ApellidosNombre_Tarea7.pdf y ApellidosNombre_Tarea7.mp3\n\n📌 Criterio a evaluar: CE 1.1."
  },
  {
    "id": "8",
    "title": "Sindicación: Subida a iVoox y Spotify",
    "block": "B",
    "crit": "4.1",
    "description": "El máster está listo, ahora hay que distribuirlo a nivel global. Cread un canal oficial en iVoox o Spotify para Creadores.\n\nSubid vuestros podcasts. Redactad una sinopsis magnética (show notes) para atraer clics, y rellenad meticulosamente todos los metadatos (etiquetas, portadas, autores).\n\n⚠️ REQUISITO ESTRICTO: Los títulos de los audios en la plataforma deben cumplir la nomenclatura oficial acordada en clase. Entregad el enlace público al canal de distribución.\n\n📌 Criterio a evaluar: CE 4.1."
  },
  {
    "id": "9",
    "title": "Wiki Ciberseguridad",
    "block": "C",
    "crit": "2.1",
    "description": "Registrarse en la wiki de la clase. Cada alumno/a deberá crear una página con su tema escogido de seguridad informática, enlazarla en la página de inicio. Debe haber: título, algún enlace, negrita, alguna tabla, alguna imagen, subtítulo. Entregar enlace a vuestra página y nombre de usuario en comentario privado.\n\n📌 Criterio a evaluar: CE 2.1."
  },
  {
    "id": "10",
    "title": "Creación del UVUS con doble factor de autenticación",
    "block": "C",
    "crit": "2.1",
    "description": "Registrarse para obtener el UVUS. Entregar: Captura de pantalla donde se vea mi identificador y que he conseguido registrarme, y captura de pantalla donde se vea el correo empleado. Entrar en gid.us.es para probar el UVUS.\n\n📌 Criterio a evaluar: CE 2.1."
  },
  {
    "id": "Game_Cert",
    "title": "Juego: Certificado Arcade",
    "block": "C",
    "crit": "2.1",
    "description": "🎮 Certificado Arcade. Acompaña a nuestro personaje a sacarse el Certificado Digital en la vida real.\n\n📌 Criterio a evaluar: CE 2.1."
  },
  {
    "id": "11",
    "title": "Mi primera web en html",
    "block": "A",
    "crit": "3.1",
    "description": "Haz una web con dos páginas mínimo. Una presentandote sin dar datos personales tuyos y otra con tu horario en una tabla. Debe haber: lista, imagen, tabla, párrafos, negritas, enlaces externos e internos, h1 y h2. Subir a Github. Entregar URL del proyecto en github y URL de la web visible.\n\n📌 Criterio a evaluar: CE 3.1."
  },
  {
    "id": "12",
    "title": "Accesibilidad WCAG",
    "block": "A",
    "crit": "3.1",
    "description": "Audita tu primera web con WAVE y el checklist WCAG: alt text, contraste, navegación por teclado, etiquetas de formulario y texto de enlaces descriptivo.\n\n📌 Criterio a evaluar: CE 3.1."
  },
  {
    "id": "Game_Hex",
    "title": "Juego: Hex Invaders",
    "block": "A",
    "crit": "3.1",
    "description": "👾 Hex Invaders. Practica la teoría del color web disparando a los marcianos leyendo su código CSS Hexadecimal.\n\n📌 Criterio a evaluar: CE 3.1."
  },
  {
    "id": "13",
    "title": "SuperMarioBros",
    "block": "A",
    "crit": "5.1",
    "description": "Tarea en github. Ubica con display absolute las imagenes de la pantalla del supermario del proyecto de ejemplo.\n\n📌 Criterio a evaluar: CE 5.1."
  },
  {
    "id": "14",
    "title": "SuperMario Move Move",
    "block": "A",
    "crit": "5.3",
    "description": "Añadiremos código JS. Descarga el proyecto de github classroom. En move.js añade el texto para mover a Mario. Descomentar línea en index.html. Probar de mover algún otro personaje, hacer que vaya mas rápido...\n\n📌 Criterio a evaluar: CE 5.3."
  },
  {
    "id": "15",
    "title": "Crea tu App",
    "block": "A",
    "crit": "5.1, 5.2, 5.3",
    "description": "Con la ayuda de la IA y los agentes integrados en VisualStudio Code o Google Antigravity, inventad una aplicación web, un juego o lo que queráis. Fase 1: App HTML, CSS, JS responsive. Fase 2: Autenticación de Firebase con Google. Fase 3: Base de datos en Firebase. Subir a github pages. Entregar URL en Github y URL web.\n\n📌 Criterio a evaluar: CE 5.1, 5.2, 5.3."
  }
];

export const CYR_CLASSROOM_TASKS = [
  {
    id: '0', title: 'Cuéntame quién eres', block: '1', crit: '',
    description: `Con tu cuenta del instituto (iesamachado), entra en Google Drive y crea una nueva presentación (Nuevo > Presentaciones de Google).

Una vez allí, se abrirá una nueva ventana. Crea una presentación junto con tu compañero/a de ordenador en la que me contéis algo sobre vosotros/as: vuestras aficiones, de qué escuela venís, etc.

⚠️ IMPORTANTE: No incluyáis fotos vuestras ni datos personales (fechas de cumpleaños, número de DNI, dirección de casa, teléfono...).

Intentad cambiar el tema visual que viene por defecto y añadid imágenes que encontréis en Internet (las Presentaciones de Google tienen un buscador de imágenes integrado que funciona bastante bien).

La presentación debe tener la siguiente estructura:
- 1 primera página de portada.
- 3 páginas hablando de cada uno de vosotros (si sois dos personas, la presentación tendrá 7 páginas en total).

Una vez terminada, nombrad el archivo de la siguiente forma: ApellidoNombre1_ApellidoNombre2. Finalmente, entregad la tarea por Google Classroom (solo es necesario que la entregue un miembro de la pareja).`
  },
  {
    id: '1', title: 'Crea carpetas y documentos', block: '1', crit: '1.1',
    description: `En el libro, en la página 24, hay dos ejercicios en los que debéis crear carpetas y documentos en vuestro ordenador.

Quiero que realicéis esta actividad primero en vuestro ordenador local y, a continuación, también en Google Drive. La carpeta de Google Drive debe llamarse exactamente como indica el libro.

Pasos a seguir:
1. Cread las carpetas indicadas en las DOS actividades del libro en vuestro ordenador.
2. Comprimid la carpeta principal del ordenador (que contiene los ejercicios) en un archivo ZIP.
3. Cread la misma estructura de carpetas en Google Drive.
4. Compartid la carpeta de Google Drive con el profesor (bernatcosta@iesamachado.org), otorgándole permisos de "Comentador".

¿Qué debéis entregar de forma individual?
- Subid el archivo ZIP con vuestras carpetas locales a esta tarea.
- Entregad el enlace de la carpeta de Google Drive compartida.

*Tenéis a vuestra disposición una presentación de apoyo y el libro de texto.*`,
    customRubric: [
      { id: "c1", title: "Zip Entregado con nombre correcto", desc: "", levels: [{points:0, desc:"No realizado"},{points:0.25, desc:"Mal"},{points:0.5, desc:"Bien"},{points:0.75, desc:"Casi Perfecto"},{points:1, desc:"Muy Bien"}] },
      { id: "c2", title: "Zip contiene carpetas correctas", desc: "", levels: [{points:0, desc:"No realizado"},{points:0.25, desc:"Regular"},{points:0.5, desc:"Puede mejorar"},{points:0.75, desc:"Bien"},{points:1, desc:"Muy Bien"}] },
      { id: "c3", title: "Contiene ficheros correctamente", desc: "", levels: [{points:0, desc:"No realizado"},{points:0.25, desc:"Regular"},{points:0.5, desc:"Puede mejorar"},{points:0.75, desc:"Bien"},{points:1, desc:"Muy Bien"}] },
      { id: "c4", title: "Contiene ficheros en la carpeta indicada", desc: "", levels: [{points:0, desc:"No realizado"},{points:0.25, desc:"Regular"},{points:0.5, desc:"Puede mejorar"},{points:0.75, desc:"Bien"},{points:1, desc:"Muy Bien"}] },
      { id: "c5", title: "Carpeta en Google Drive compartida", desc: "", levels: [{points:0, desc:"No realizado"},{points:0.25, desc:"Regular"},{points:0.5, desc:"Puede mejorar"},{points:0.75, desc:"Bien"},{points:1, desc:"Muy Bien"}] },
      { id: "c6", title: "Permisos correctos", desc: "", levels: [{points:0, desc:"No realizado"},{points:0.25, desc:"Regular"},{points:0.5, desc:"Puede mejorar"},{points:0.75, desc:"Bien"},{points:1, desc:"Muy Bien"}] },
      { id: "c7", title: "Subcarpetas correctas", desc: "", levels: [{points:0, desc:"No realizado"},{points:0.25, desc:"Regular"},{points:0.5, desc:"Puede mejorar"},{points:0.75, desc:"Bien"},{points:1, desc:"Muy Bien"}] },
      { id: "c8", title: "Ficheros subidos a drive correctamente", desc: "", levels: [{points:0, desc:"No realizado"},{points:0.25, desc:"Regular"},{points:0.5, desc:"Puede mejorar"},{points:0.75, desc:"Bien"},{points:1, desc:"Muy Bien"}] },
      { id: "c9", title: "Cuenta de drive de la persona correcta", desc: "", levels: [{points:0, desc:"No realizado"},{points:0.25, desc:"Regular"},{points:0.5, desc:"Puede mejorar"},{points:0.75, desc:"Bien"},{points:1, desc:"Muy Bien"}] },
      { id: "c10", title: "Entrega a tiempo", desc: "", levels: [{points:0, desc:"No realizado"},{points:0.25, desc:"Regular"},{points:0.5, desc:"Puede mejorar"},{points:0.75, desc:"Bien"},{points:1, desc:"Muy Bien"}] }
    ]
  },
  {
    id: '2', title: 'Envío de eMails', block: '1', crit: '6.2',
    description: `Seguid estas instrucciones EXACTAMENTE paso a paso:

1. Realizad la práctica 3 del libro (pág. 25).
2. Descargad en formato PDF la presentación que creasteis el otro día.
3. Id a la carpeta de Descargas y renombrad el archivo con vuestro apellido y nombre. Por ejemplo: CostaBernat.pdf.
4. Enviad un correo electrónico adjuntando vuestra presentación al compañero/a que se sienta a vuestro lado.
5. A continuación, reenviadme a mí el correo electrónico que os ha mandado el grupo de al lado. 
   - En este correo debéis ponerme a mí (vuestro profesor) en Copia Oculta (CCO).
   - A los autores originales de la presentación en Copia Visible (CC).
   - A otro compañero de clase en el destinatario principal (Para).
   - Acordaos de escribir un Asunto adecuado y un mensaje educado en el cuerpo del correo.
6. Añadid un comentario privado en esta tarea indicando el día y la hora exacta en la que habéis enviado el correo.

Resumen de envío:
- Para: Un compañero/a de clase.
- CC: Autor de la presentación.
- CCO: Vuestro profe.

UNA VEZ FINALIZADO, MARCAD LA TAREA COMO COMPLETADA SIN ADJUNTAR NINGÚN ARCHIVO.`
  },
  {
    id: '3', title: 'Bienestar Digital', block: '1', crit: '6.1',
    description: `Esta tarea consiste en monitorizar y registrar el tiempo que pasáis frente a las pantallas fuera del horario del instituto.

Deberéis anotar, desde el 6 de abril hasta el 30 de abril, las horas y minutos exactos que dedicáis diariamente a cada dispositivo.
Si utilizáis un móvil o tablet (Android o iOS), podéis consultar el apartado de "Bienestar Digital" o "Tiempo de uso" en los ajustes, donde se detalla el tiempo empleado al día y en qué aplicaciones.

Podéis hacer capturas de pantalla desde el móvil y enviároslas a vuestro correo del instituto. De este modo, podréis rellenar fácilmente la hoja de cálculo en las clases de CyR o ir apuntando los tiempos en vuestra agenda.`
  },
  {
    id: '4', title: 'Juego: MecanoClass', block: '1', crit: '1.1',
    description: `🎮 MecanoClass es un entorno virtual para aprender el montaje de hardware y periféricos.
  
Juega a MecanoClass para familiarizarte con los componentes internos de un ordenador y aprender a conectarlos correctamente en la placa base. Debes superar al menos 3 niveles para que se registre tu puntuación.`
  },
  {
    id: '5', title: 'Juego: CyR Trivial', block: '1', crit: '1.1, 6.1',
    description: `🎮 **CyR Trivial** es un concurso rápido (estilo Kahoot) para repasar toda la teoría de Computación y Robótica.

De un banco de preguntas aleatorio, te enfrentarás a un desafío de 10 cuestiones con 4 posibles respuestas cada una (¡y con límite de tiempo!). Deberás demostrar tus conocimientos sobre hardware, Scratch, la placa Micro:bit, Internet de las Cosas (IoT), Inteligencia Artificial y ciudadanía digital. ¡Compite por conseguir la puntuación perfecta!`
  },
  {
    id: '6', title: 'Píxeles, píxeles y más píxeles', block: '2', crit: '2.1',
    description: `🚨🚨🚨 ESTA TAREA LA TIENE QUE ENTREGAR TODO EL MUNDO 🚨🚨🚨

Vamos a utilizar la aplicación Writer de LibreOffice.

Realizad los 3 ejercicios de la práctica 2 del libro (págs. 26 y 27). Cuando terminéis, tendréis 3 archivos guardados con estos nombres:
- UD01_P2_E1_ApellidoNombre
- UD01_P2_E2_ApellidoNombre
- UD01_P2_E3_ApellidoNombre

A continuación, cread un cuarto documento llamado UD01_P2_E4_ApellidoNombre.
En este nuevo documento de Writer, cread una tabla/cuadrícula de 17x17 celdas, donde cada cuadradito mida exactamente 1 cm de alto y 1 cm de ancho.
Usando la herramienta de color de fondo (sombreado) de las celdas, pintad las iniciales de vuestro nombre, píxel a píxel, en esa cuadrícula.
*(Extra: Dibujad algún otro motivo libre en una segunda cuadrícula de 17x17).*

🚨🚨🚨 Entregad los 4 archivos adjuntos en esta tarea de Classroom y marcadla como entregada. 🚨🚨🚨`
  },
  {
    id: '7', title: 'Diagramas de flujo', block: '2', crit: '2.1',
    description: `🚨🚨 TODO EL MUNDO DEBE ENTREGAR ESTA TAREA 🚨🚨

Después de realizar la práctica 6 del libro (pág. 38) y de leer la práctica 5 (para saber qué programa utilizar), haz lo siguiente:

1. Escoge un algoritmo cotidiano de tu día a día (por ejemplo: una receta de cocina, tu rutina desde que te despiertas hasta que llegas al instituto, la estrategia de juego de tu equipo de baloncesto...).
2. Explica ese algoritmo con tus propias palabras redactando entre 5 y 10 líneas en un documento de texto en Google Drive.
3. Realiza el diagrama de flujo correspondiente a ese algoritmo usando LibreOffice Draw y expórtalo a PDF. El diagrama debe contener al menos:
   - Un inicio.
   - Un final.
   - Una decisión (rombo).
   - 5 procesos (rectángulos).

*(Alternativa: Si lo preferís, podéis hacer el diagrama online con excalidraw.com y entregar una captura de pantalla llamada ApellidoNombre_Diagrama.jpg en lugar del PDF).*

¿Qué debes entregar? (3 archivos):
1. El documento de Drive con la explicación: ApellidosNombre_ExplicacionAlgoritmo
2. Tu propio diagrama: ApellidosNombre_Diagrama.pdf (o .jpg).
3. El diagrama de la receta de cocina tal y como aparece en el libro.`
  },
  {
    id: '8', title: 'Test Plickers', block: '2', crit: '2.1',
    description: `Participa en el test interactivo Plickers que realizaremos en clase para evaluar los conceptos de píxeles y diagramas de flujo.`
  },
  {
    id: '9', title: 'Dossier Prácticas Scratch', block: '2', crit: '1.3',
    description: `Agrupación de prácticas de iniciación a Scratch. 
Debes entregar en esta misma tarea los siguientes 3 minijuegos:
1. Oso Polar (Movimiento básico).
2. Escarabajo se mueve (Sigue el puntero del ratón).
3. El Elefante hambriento (Tocar colores).
- Adjunta los tres archivos .sb3 de tus proyectos (obligatorio).`
  },
  {
    id: '10', title: 'Proyecto Mapa', block: '2', crit: '2.2, 5.2',
    description: `Vamos a crear un juego interactivo en Scratch que sirva como examen de geografía.

Requisitos del juego:
- Pon un mapa geográfico como imagen de fondo (escenario).
- Coloca 8 letras (como objetos) repartidas en distintos puntos clave del mapa.
- Programa un personaje protagonista.
- El protagonista debe hacer una pregunta tras otra para comprobar si el jugador sabe ubicar los lugares en el mapa (ej. "¿Dónde está la cordillera Bética? Haz clic en la letra correcta").
- Implementa un sistema de puntuación.
*(Puedes mirar el ejemplo del mapa de Andalucía visto en clase).*

¿Qué debes entregar en Classroom?
- El enlace al proyecto compartido.
- El archivo .sb3 de tu proyecto.`
  },
  {
    id: '11', title: 'Gato Bross', block: '2', crit: '1.3, 2.2',
    description: `Vamos a crear un videojuego de plataformas.
En los siguientes enlaces os dejo un ejemplo de "Gato Bross", un videojuego donde el gato de Scratch debe saltar obstáculos (bananas).

Antes de programar, entra en los proyectos de ejemplo e investiga su código:
1. Intenta entender cómo está estructurado.
2. Fíjate en cómo se mueve hacia los lados y cómo salta.
3. ¿Entiendes cómo cae simulando la gravedad?
4. Observa cómo funciona el sistema para restar vidas.
5. Analiza las condiciones de victoria y derrota.

Ahora que lo has entendido, crea tu propio videojuego con el personaje y escenario que elijas, añadiendo un mínimo de 2 obstáculos.
- ¿Eres capaz de hacer que los obstáculos se muevan?
- ¿Eres capaz de cambiar de nivel y de escenario al avanzar?

Enlaces de referencia:
Gato Bross 1.0 -> https://scratch.mit.edu/projects/1102391685
Gato Bross 2.0 -> https://scratch.mit.edu/projects/1102296655

¿Qué debes entregar en Classroom?
- El enlace a tu proyecto compartido.
- El archivo .sb3 de tu proyecto.`
  },
  {
    id: '12', title: 'Tarea Ampliación', block: '2', crit: '1.3',
    description: `Realiza los retos de programación propuestos en el "Curso Express 2021" de Code.org para seguir mejorando tus habilidades con los bloques lógicos.`
  },
  {
    id: '13', title: 'Felicitación navideña', block: '2', crit: '5.2',
    description: `Usando GIMP (el editor de imágenes libre de GNU/Linux), edita una felicitación navideña combinando varias herramientas de retoque fotográfico.

Requisitos técnicos de la imagen:
- Clona alguna parte de la imagen utilizando el tampón de clonar.
- Escala (redimensiona) alguna de las imágenes.
- Aplica algún filtro artístico o visual.
- Añade personajes recortados de otras fotos de Internet. (Puedes usar herramientas como https://www.remove.bg/es para quitar los fondos fácilmente).
- Incorpora algún texto.
- Modifica los colores y la iluminación usando la herramienta de curvas de nivel.
- El proyecto debe estar organizado en distintas capas.

Nota: Esfuérzate en ser creativo. No es obligatorio que utilices la imagen de ejemplo de la clase como fondo, ¡puedes crearla a tu gusto!

¿Qué debes entregar en Classroom?
1. El archivo de proyecto de GIMP (con las capas): ApellidoNombre_Felicitacion.xcf
2. La imagen final exportada: ApellidoNombre_Felicitacion.jpg
3. Rellenar el formulario adjunto en esta tarea.`
  },
  {
    id: '14', title: 'Crea una página web', block: '2', crit: '5.1',
    description: `Utilizando Google Sites, debéis crear una página web sobre la temática que elijáis (siempre que sea apropiada para un trabajo de clase).

Requisitos mínimos de la web:
- La cabecera debe incluir un menú de navegación con al menos 2 enlaces.
- La cabecera debe tener una imagen de portada apaisada (puedes usar GIMP para recortarla).
- El contenido de la web debe incluir texto explicativo e imágenes.
- Debe estar formada por un mínimo de 3 páginas (la de "Inicio" y 2 páginas secundarias).
- Todas las páginas deben mantener la misma cabecera y el mismo pie de página.
- 🚨 PROHIBIDO incluir información personal (ni fotos vuestras, ni apellidos reales).

Una vez terminada, acuérdate de Publicar la web.

¿Qué debes entregar en Classroom?
- El enlace público a tu página web (el que vería un visitante externo). 
*Consejo: Abre tu propio enlace en una pestaña de incógnito para asegurarte de que es accesible para todo el mundo.*

🚨 TODO EL MUNDO DEBE ENTREGAR LA WEB 🚨`
  },
  {
    id: '15', title: 'Inspeccionando una web por dentro', block: '2', crit: '5.1',
    description: `🎯 **Criterio BOJA:** 5.1 (Desarrollo Web) | **Bloque:** E (Desarrollo Web) | **Ponderación:** 5% de la nota final del bloque.

¡Hoy os vais a convertir en hackers de páginas web (de forma legal)! Vamos a descubrir qué se esconde debajo de las páginas que visitamos a diario.

**Instrucciones:**
1. Abre el navegador Chrome o Firefox y entra en la página web del instituto (o en Wikipedia).
2. Pulsa la tecla **F12** (o clic derecho > Inspeccionar). ¡Bienvenidos al código de la web!
3. Usa la herramienta de selección (el cursor de la esquina superior izquierda de las herramientas) y haz clic sobre un título o noticia.
4. En el código HTML que aparece, haz doble clic sobre el texto y... ¡Cámbialo por una noticia inventada!
5. Identifica dónde están las etiquetas HTML como <h1>, <p> y <img>.

**¿Qué debes entregar en Classroom?**
- 2 capturas de pantalla de la web "modificada" por ti (recuerda que los cambios solo ocurren en tu pantalla y desaparecen al recargar).
- Un documento de texto explicando con tus palabras qué crees que hace la etiqueta <p> y qué hace la etiqueta <img>.`
  },
  {
    id: '16', title: 'Juego: MOON', block: '2', crit: '1.3',
    description: `🎮 MOON es un simulador de arquitectura de computadores basado en un juego de mesa.

En este juego aprenderás cómo funciona una CPU por dentro: la Unidad Lógico Aritmética (ALU), la memoria RAM, los registros y las operaciones binarias fundamentales (AND, OR, NOT, INC, DEC). Tu objetivo será ayudar al ordenador del módulo lunar a procesar las instrucciones para alunizar de forma segura.`
  },
  {
    id: '17', title: 'Juego: H3L4D0S', block: '2', crit: '2.1',
    description: `🎮 H3L4D0S es un entorno interactivo de programación mediante bloques (similar a Scratch).

En este juego deberás programar a un robot heladero para que sirva los pedidos correctos a los clientes. Aprenderás a utilizar secuencias de comandos, bucles, y condicionales lógicos para automatizar el comportamiento del robot. Supera los distintos retos de la heladería.`
  },
  {
    id: '18', title: 'Test Plickers', block: '3', crit: '1.1',
    description: `Participa en el test interactivo Plickers que realizaremos en clase sobre componentes de dispositivos móviles y redes de comunicación.`
  },
  {
    id: '19', title: 'Test Asimov', block: '3', crit: '1.2',
    description: `Participa en el test de evaluación sobre el relato "Círculo Vicioso" de Isaac Asimov y la aplicación ética de sus famosas Leyes de la Robótica.`
  },
  {
    id: '20', title: 'Haz un juego con la micro:bit', block: '3', crit: '2.2',
    description: `En primer lugar, sigue este tutorial en vídeo para programar el clásico juego de Asteroides en tu micro:bit:
📺 http://youtube.com/watch?v=Z06XmC9pQck

Una vez lo hayas terminado y comprendido, diseña y programa tu propio juego aplicando lo aprendido.
Puedes inspirarte creando el juego de la serpiente (Snake), un juego de disparar enemigos, un juego de atrapar objetos siguiendo el ritmo de la música, un juego con niveles... 
Busca ideas en YouTube, inventa tu propia mecánica y sorpréndeme.

Ejemplos para inspirarte:
- https://www.youtube.com/watch?v=kgYpyn9-w1Y
- https://www.youtube.com/watch?v=K7bhmsxyfKU
- https://www.youtube.com/watch?v=NYTMCgbmp1Y

¿Qué debes entregar en Classroom?
1. El archivo .hex y el enlace del proyecto del tutorial: ApellidoNombre_Asteroides
2. El archivo .hex y el enlace de TU PROPIO juego: ApellidoNombre_NombreDeTuJuego`
  },
  {
    id: '21', title: 'Código Morse', block: '3', crit: '3.1',
    description: `Lee la práctica 7 del libro de texto, donde se explica el funcionamiento de la comunicación por radio.

Haciendo uso del módulo de radio de la micro:bit, programa dos placas para que se comuniquen inalámbricamente entre ellas cumpliendo estas reglas:
1. Al pulsar el logo táctil de la micro:bit, ambas placas deben establecer el mismo canal de radio y mostrar el número del canal en la pantalla de LEDs.
2. Si pulso el botón A, se enviará un "punto" (se encenderá el LED central de la pantalla).
3. Si pulso el botón B, se enviará una "raya" (se encenderá la línea horizontal central).
4. Cuando una placa reciba un "punto", emitirá un pitido corto. Cuando reciba una "raya", emitirá un pitido largo.

Conecta el portapilas de tu placa y aléjate por el pasillo para comprobar el alcance máximo de la señal de radio entre los dispositivos.

¿Qué debes entregar en Classroom?
- El enlace al proyecto en MakeCode.
- El archivo .hex.
- Un comentario privado en la tarea indicando la distancia aproximada que ha alcanzado la señal.`
  },
  {
    id: '22', title: 'Cutebot SigueLíneas', block: '3', crit: '1.4',
    description: `TAREA POR PAREJAS

Siguiendo las instrucciones de este vídeo (https://www.youtube.com/watch?v=GVPROyNLXc4), programa tu robot CuteBot para que sea capaz de seguir una línea negra dibujada sobre un papel usando sus sensores infrarrojos.

Prueba tu código en el circuito impreso que viene incluido en la caja del CuteBot.
*Nota: Ten en cuenta que el robot no puede trazar ángulos muy cerrados; asegúrate de que el circuito tiene curvas suaves y sin esquinas pronunciadas.*

¿Qué debéis hacer y entregar TODOS los miembros de la pareja?
1. Enseñar al profesor el robot funcionando físicamente en el circuito.
2. Entregar el enlace del proyecto de MakeCode compartido.
3. Entregar el archivo .hex que habéis descargado a la micro:bit.`
  },
  {
    id: '23', title: 'Proyecto Coche Teledirigido', block: '3', crit: '3.1, 1.4',
    description: `TRABAJO POR PAREJAS (Ambos miembros deben entregar todo en Classroom).

Vamos a construir un coche teledirigido utilizando 2 micro:bits y 1 chasis CuteBot.
Aplicaremos todo lo aprendido: la comunicación inalámbrica por radio (Tarea Código Morse), el control de motores (Tarea SigueLíneas) y la gestión de eventos de botones.

Deberéis programar dos placas independientes que se comunicarán entre sí:
- El Mando: Una micro:bit conectada a un portapilas.
- El Coche: Una micro:bit conectada al CuteBot.

Requisitos mínimos:
El coche debe poder avanzar, retroceder, girar a la izquierda y girar a la derecha al pulsar los botones o inclinar el mando. 

Además, deberéis programar un sistema para cambiar de grupo de radio simultáneamente tanto desde el coche como desde el mando (para evitar interferir con las frecuencias de otros compañeros).

Extras valorables para subir nota:
- Claxon (activable desde el mando o automáticamente si va a chocar).
- Uso del sensor de distancia (ultrasonidos) para frenar y evitar colisiones frontales.
- Faros LED que se enciendan solos en la oscuridad o a voluntad desde el mando.
- "Modo turbo" para dar un acelerón.
- Construir una carrocería de cartón para el robot.
- Melodías personalizadas o movimientos de celebración.

Haremos una competición cronometrada recorriendo un circuito en clase. Chocar con las paredes conllevará penalización de tiempo.

¿Qué debes entregar en Classroom?
- El archivo/enlace del código del Coche (ej. Macqueen_Coche).
- El archivo/enlace del código del Mando (ej. Macqueen_Mando).
*(Recordad incluir el nombre de vuestro vehículo en los archivos).*`
  },
  {
    id: '24', title: 'Juego: ArenaBots', block: '3', crit: '1.4',
    description: `🎮 ArenaBots es un simulador de combate de robots donde tú escribes la inteligencia artificial.

Tu objetivo es programar la estrategia de tu robot utilizando bloques o código para que sea capaz de detectar a los enemigos, esquivar ataques y ganar los combates en la arena. Aprenderás los conceptos básicos de la robótica y el diseño de comportamientos autónomos.`
  },
  {
    id: '25', title: 'Juego: CyberSmith', block: '3', crit: '3.1',
    description: `🎮 CyberSmith te convierte en un ingeniero de sistemas ciberfísicos.

Aprende a diseñar circuitos, conectar sensores, actuadores y microcontroladores (como si fuera una micro:bit o Arduino real). Resuelve los distintos puzles electrónicos para crear sistemas automáticos funcionales.`
  },
  {
    id: '26', title: 'Mi Casa Inteligente (IoT)', block: '4', crit: '1.1',
    description: `🎯 **Criterio BOJA:** 1.1 (Sistemas IoT) | **Bloque:** B (Internet de las Cosas) | **Ponderación:** 10% de la nota final del bloque.

Tras leer el temario sobre el Internet de las Cosas (IoT), vais a diseñar un esquema para domotizar vuestra propia casa.

**Instrucciones:**
1. Abrid Canva o Google Presentaciones.
2. Dibujad (o usad iconos) un plano básico de una casa con 3 habitaciones.
3. Colocad al menos **5 dispositivos IoT** diferentes (ej: termostato inteligente, bombillas Wi-Fi, cámara IP, altavoz, cerradura biométrica).
4. Para cada dispositivo, dibujad una flecha y explicad:
   - ¿Qué **sensor** utiliza?
   - ¿Por qué **red** se comunica (Wi-Fi, Bluetooth, Zigbee)?
   - ¿Qué **actuador** ejecuta la acción física?

**¿Qué debes entregar en Classroom?**
- Un archivo PDF con vuestro plano de la casa inteligente y las explicaciones de los 5 dispositivos.`
  },
  {
    id: '27', title: 'Juego: AppFlow', block: '4', crit: '2.3',
    description: `🎮 **AppFlow** es un puzle de lógica gamificado para aprender cómo funcionan las aplicaciones móviles por dentro.

En este juego te contratan como ingeniero de software junior. Tu objetivo es conectar correctamente los "eventos" (como pulsar un botón o agitar el móvil) con las "acciones" (como reproducir un sonido o mostrar una notificación) para que las apps funcionen antes de lanzarlas al mercado. 

Aprenderás qué son los sensores (GPS, acelerómetro), los eventos y la entrada/salida de datos sin necesidad de escribir código complejo.`
  },
  {
    id: '28', title: 'Crea una canción con IA', block: '5', crit: '4.1',
    description: `Vamos a aprender a crear música utilizando Inteligencia Artificial.

En primer lugar, accede a ChatGPT y pídele que escriba la letra para una canción original. Pídele que tenga estructura de 2 estrofas y 1 estribillo, y especifica la temática que prefieras (siempre desde el respeto).
*Consejo: Interactúa con ChatGPT pidiéndole cambios, un tono más divertido o que incluya ciertas palabras. ¡Cuanto más personalices la letra, mejor será el resultado!*

Una vez tengas tu letra perfecta, utilizaremos una de estas tres plataformas musicales de IA para generar las voces y la música en el estilo que elijas (ej. Rock, Pop, Épico...):
1. https://suno.com/
2. https://song.do/
3. https://www.mureka.ai

Ejemplos de inspiración creados con IA:
- https://suno.com/song/cbdeaa04-5587-4e24-b6cd-47096825688b
- https://suno.com/song/fdc0393b-d115-4468-8719-047ec1131eea

¿Qué debes entregar en Classroom?
- El enlace público a tu canción terminada, o el archivo de audio (.mp3 o .wav).`
  },
  {
    id: '29', title: 'Dibujando con la IA', block: '5', crit: '4.1',
    description: `Las redes neuronales modernas son capaces de "ver" y reconocer patrones en imágenes. Esto nos permite jugar a una especie de Pictionary digital o recibir ayuda al dibujar.

Parte 1: QuickDraw
Esta herramienta de Google te pedirá que dibujes 6 objetos diferentes en menos de 20 segundos cada uno mientras la IA intenta adivinarlos en tiempo real.
Entra en https://quickdraw.withgoogle.com/, juega un par de partidas e intenta que la IA acierte 6 de 6. Haz una captura de pantalla de tu mejor partida.

Parte 2: AutoDraw
Es un lienzo de dibujo libre asistido por IA. A medida que trazas bocetos, la IA intenta adivinar qué es y te sugiere iconos profesionales para reemplazar tu garabato.
Entra en https://www.autodraw.com/ y crea una composición que incluya al menos 3 elementos diferentes reconocidos y mejorados por la IA. Haz una captura de tu dibujo.

¿Qué debes entregar en Classroom? (2 archivos):
1. Una captura de pantalla con los resultados de QuickDraw: ApellidoNombre_QuickDraw
2. Una captura de pantalla de tu ilustración en AutoDraw: ApellidoNombre_Autodraw

*(Recuerda: Puedes usar la tecla "Impr Pant" de tu teclado y renombrar los archivos guardados en tu carpeta de Imágenes > Capturas de pantalla).*`
  },
  {
    id: '30', title: 'Entrena una IA para reconocer imágenes', block: '5', crit: '4.2',
    description: `Utilizando la plataforma LearningML, vamos a entrenar nuestro propio modelo de Inteligencia Artificial para que aprenda a clasificar imágenes.

Pasos a seguir:
1. Decide qué quieres que reconozca tu IA (por ejemplo: Perros vs Gatos, Manzanas vs Plátanos, Piedra vs Papel vs Tijera). Necesitas crear un mínimo de 3 categorías.
2. Crea 3 carpetas en tu ordenador (una por categoría).
3. Busca en Internet 15 fotos de ejemplo para cada categoría y guárdalas en su respectiva carpeta. ¡Estos serán los datos de entrenamiento!
4. Busca 10 fotos más (mezcladas) que la IA NO haya visto nunca. Estas serán tus fotos de TEST.
5. Sube las fotos a LearningML, entrena tu modelo y ponlo a prueba usando las fotos de TEST.

Anota en un Documento de Google los resultados. Inserta cada una de las 10 fotos de TEST e indica al lado si la IA ha acertado o fallado en su predicción.
(Ver ejemplo: https://drive.google.com/drive/folders/1u8zE68gaD2CL19QXiZ6SmPxbUPj4_xq3?usp=sharing)

¿Qué debes entregar en Classroom?
1. Un archivo ZIP con las 45 fotos de entrenamiento: ApellidoNombre_Imagenes.zip
2. El documento de Google con los resultados de la prueba: ApellidoNombre_EntrenandoUnaIA`
  },
  {
    id: '31', title: 'Test IA', block: '5', crit: '4.2',
    description: `Participa en el test interactivo Plickers que realizaremos en clase sobre los conceptos teóricos de Machine Learning e Inteligencia Artificial.`
  },
  {
    id: '32', title: 'La sed de ChatGPT', block: '5', crit: '4.1',
    description: `Con la plataforma Animaker, podemos crear presentaciones animadas o vídeos con avatares explicativos.

Vuestro objetivo es resumir y explicar en un vídeo el impacto medioambiental de la Inteligencia Artificial, basándoos en el artículo "La sed de ChatGPT" publicado por National Geographic:
https://www.nationalgeographic.com.es/ciencia/agua-que-gasta-chatgpt-y-otros-modelos-ia_23812

El vídeo debe tener una duración mínima de 20 segundos, constar de al menos 5 escenas, y explicar de forma didáctica:
1. El inmenso consumo de agua de los centros de datos.
2. Por qué los servidores informáticos necesitan tanta agua (la refrigeración).
3. El elevado consumo de energía y luz eléctrica.
4. Una comparativa visual y comprensible del gasto que supone generar un simple texto o imagen (por ejemplo, comparándolo con botellas de agua evaporadas).
5. Debéis incluir una melodía o música de fondo (aseguraos de que esté libre de derechos de autor).
*(En las páginas 162-163 del libro encontraréis un tutorial para usar Animaker).*

¿Qué debes entregar en Classroom?
- El enlace de visualización pública del vídeo publicado (ej. https://app.animaker.com/animo/...).
- El título del proyecto en Animaker debe ser: ApellidoNombre_LaSedDeChatGPT.`
  },
  {
    id: '33', title: 'Cazadores de Metadatos', block: '5', crit: '4.1',
    description: `🎯 **Criterio BOJA:** 4.1 (Análisis de Datos) | **Bloque:** G (Datos Masivos) | **Ponderación:** 5% de la nota final del bloque.

¿Sabías que cuando haces una foto con el móvil, el archivo guarda en secreto dónde estabas, a qué hora y con qué teléfono la hiciste? Estos datos invisibles se llaman **Metadatos**.

**Instrucciones:**
1. Haz una foto normal con el móvil (con la ubicación GPS activada) y pásala al ordenador.
2. Entra en una herramienta online gratuita como jimpl.com (Exif Viewer).
3. Sube tu foto (no te preocupes, es seguro) y analiza los resultados que extrae.
4. Descubre las coordenadas GPS de la foto y ponlas en Google Maps.

**¿Qué debes entregar en Classroom?**
- Una captura de pantalla donde se vean los metadatos descubiertos.
- Un breve párrafo (3-4 líneas) respondiendo: ¿Qué riesgos para la privacidad crees que tiene enviar fotos originales por Internet sin borrar los metadatos?`
  },
  {
    id: '34', title: 'Juego: Asimov.IO', block: '5', crit: '1.2',
    description: `🎮 **Asimov.IO** es un simulador de ética artificial basado en la toma de decisiones.

En este juego tomas el papel de la IA central de una ciudad inteligente. Se te presentarán dilemas morales y sociales (como la privacidad vs seguridad, o eficiencia vs empleo humano). Tu objetivo es tomar decisiones deslizando a izquierda o derecha, intentando sobrevivir el máximo de días posibles sin que la Felicidad, la Eficiencia o la Ética lleguen a 0 (ni a 100).`
  },
  {
    id: '35', title: 'Test Creative Commons', block: '6', crit: '6.3',
    description: `Test evaluativo sobre propiedad intelectual, derechos de autor y el funcionamiento de las Licencias Creative Commons (CC).`
  },
  {
    id: '36', title: 'Cómic sobre ciberseguridad', block: '6', crit: '6.3',
    description: `Vamos a realizar una presentación visual e interactiva utilizando Prezi (prezi.com) apoyándonos en la IA.

Sigue cuidadosamente estos pasos:
1. Lee atentamente la sección "Recomendaciones básicas de protección" en la página 137 del libro de texto.
2. Elige 4 de las 8 recomendaciones. Acude a una IA generadora de imágenes (o a ChatGPT) y pídele que te diseñe 4 viñetas de cómic ilustrando cada uno de esos 4 consejos.
   *(Cuidado: Las IA generativas a menudo dibujan letras ilegibles. Es recomendable generar la ilustración limpia y añadir los bocadillos de texto tú mismo después).*
3. Regístrate en Prezi con tu cuenta del instituto.
4. Crea una presentación nueva en blanco y BORRA TODO el contenido que aparece por defecto.
5. Añade las 4 viñetas de tu cómic en el lienzo virtual.
6. Utiliza la herramienta de "Marcos" (Frames) de Prezi para configurar las rutas de animación. El objetivo es que la cámara haga un zoom progresivo sobre cada viñeta secuencialmente al avanzar la presentación.
7. Guarda tu trabajo con el nombre: ApellidoNombre_Ciberseguridad.

¿Qué debes entregar en Classroom?
- El enlace público para visualizar tu presentación en Prezi.
*(Ejemplo de cómo debe quedar el movimiento de cámara: https://prezi.com/view/wJY6jt8Zvqdd26EpC5cv/)*`
  },
  {
    id: '37', title: 'Contraseñas seguras', block: '6', crit: '6.4',
    description: `Vamos a utilizar tres herramientas web distintas para aprender a gestionar nuestras claves de acceso. 

Parte 1: Crear contraseñas seguras
Accede al minijuego de CyberScouts (https://cyberscouts.osi.es/) que nos enseña a componer contraseñas robustas. Juega hasta ganar y haz una captura de pantalla de tu victoria.

Parte 2: Analizar su fortaleza frente a ataques
Accede al medidor de fuerza (https://www.passwordmonster.com/). Descubre cuánto tiempo tardaría un ordenador común en descifrar tus claves por fuerza bruta. Juega con distintas combinaciones hasta encontrar una contraseña que puedas recordar fácilmente y que requiera siglos para ser hackeada. 
Haz una captura de pantalla donde se vea el tiempo estimado (IMPORTANTE: Recorta la captura para que el profesor NO pueda leer la contraseña en sí).

Parte 3: Almacenamiento cifrado (Gestores de contraseñas)
Es imposible recordar contraseñas largas, complejas y diferentes para cada sitio web que usamos. Para solucionarlo, usamos gestores encriptados. 
Crea una cuenta en Proton Pass (https://proton.me/es-es/pass) y guarda dentro al menos 2 contraseñas de acceso (por ejemplo, tu cuenta del instituto y otra inventada). 
Haz una captura de pantalla donde se vea que has guardado las credenciales (sin desvelar la contraseña real).

¿Qué debes entregar en Classroom? (3 archivos adjuntos)
1. ApellidoNombre_JuegoPerro.jpg (Captura de CyberScouts)
2. ApellidoNombre_DuracionContrasena.jpg (Captura del medidor de fuerza)
3. ApellidoNombre_ProtonPass.jpg (Captura del gestor de contraseñas)`
  },
  {
    id: '38', title: 'Juego: RompeCódigos', block: '6', crit: '6.1',
    description: `🎮 RompeCódigos es una aventura interactiva sobre ciberseguridad y criptografía.

Ponte en la piel de un analista de seguridad y aprende a identificar ataques de Phishing, proteger tus contraseñas, cifrar mensajes secretos y defenderte contra los peligros de Internet. Supera todos los módulos de entrenamiento para obtener tu certificado de Ciber-Scout.`
  },
  {
    id: '39', title: 'Juego: NetDefender', block: '6', crit: '6.4',
    description: `🎮 **NetDefender** es un simulador de ciberseguridad en el que debes defender un servidor central contra distintas amenazas de la red.

En este juego aprenderás a identificar y contrarrestar ataques cibernéticos en tiempo real. Utiliza el **Firewall** para detener ataques DDoS e intrusiones, el **Filtro Spam** para descartar correos de Phishing, y el **Antivirus** para neutralizar Malware y Troyanos. ¡Sobrevive a todas las oleadas para mantener la salud de tu red intacta!`
  }
];

export const CLASSROOM_TASKS_BY_SUBJECT = {
  tic2: TIC2_CLASSROOM_TASKS,
  cyr: CYR_CLASSROOM_TASKS
};

export function getClassroomTasks(subjectId) {
  return CLASSROOM_TASKS_BY_SUBJECT[subjectId] || [];
}

// Por compatibilidad con código que importa CLASSROOM_TASKS directamente
// Provee todos los items marcados o filtrables
export const CLASSROOM_TASKS = [
  ...TIC2_CLASSROOM_TASKS.map(t => ({ ...t, subjectId: 'tic2' })),
  ...CYR_CLASSROOM_TASKS.map(t => ({ ...t, subjectId: 'cyr' }))
];
