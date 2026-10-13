// ═══════════════════════════════════════════════════════════════════════
//  STACKCLASS — Utils (helpers + catálogo unificado de juegos)
// ═══════════════════════════════════════════════════════════════════════

// ──────────────────────────────────────────────────────────────────────
//  DOM helpers
// ──────────────────────────────────────────────────────────────────────
export const $ = (id) => document.getElementById(id);
export const $$ = (sel, ctx = document) => [...ctx.querySelectorAll(sel)];

export function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

export function formatDate(ts) {
  if (!ts) return '—';
  const d = ts instanceof Date ? ts : new Date(ts);
  return d.toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

export function formatDateTime(ts) {
  if (!ts) return '—';
  const d = ts instanceof Date ? ts : new Date(ts);
  return d.toLocaleString('es-ES', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
}

export function timeAgo(ts) {
  if (!ts) return '—';
  const d = ts instanceof Date ? ts : new Date(ts);
  const now = new Date();
  const diffSec = Math.floor((now - d) / 1000);
  if (diffSec < 60) return 'hace un momento';
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `hace ${diffMin} min`;
  const diffHours = Math.floor(diffMin / 60);
  if (diffHours < 24) return `hace ${diffHours} h`;
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 30) return `hace ${diffDays} d`;
  return formatDate(d);
}

// ──────────────────────────────────────────────────────────────────────
//  URL helpers
// ──────────────────────────────────────────────────────────────────────
export function getUrlParams() {
  const params = {};
  new URLSearchParams(window.location.search).forEach((v, k) => { params[k] = v; });
  return params;
}

export function getAppUrl(path = '') {
  const origin = window.location.origin;
  const pathname = window.location.pathname;

  let basePath = '';
  const gamesIdx = pathname.indexOf('/games/');
  if (gamesIdx !== -1) {
    basePath = pathname.substring(0, gamesIdx);
  } else {
    const parts = pathname.split('/');
    parts.pop(); // quitar archivo actual
    basePath = parts.join('/');
  }

  basePath = basePath.replace(/\/+$/, '');
  const cleanPath = path ? (path.startsWith('/') ? path : '/' + path) : '';

  return `${origin}${basePath}${cleanPath}`;
}

export function scoreToGrade(score, targetScore = 100) {
  if (!score || score <= 0) return 0;
  if (!targetScore || targetScore <= 0) return Math.min(10, score);
  const ratio = Math.min(1, score / targetScore);
  return Math.round(ratio * 10 * 100) / 100;
}

export async function copyToClipboard(text) {
  try {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
    const input = document.createElement('textarea');
    input.value = text;
    document.body.appendChild(input);
    input.select();
    document.execCommand('copy');
    document.body.removeChild(input);
    return true;
  } catch (err) {
    console.error('Error al copiar al portapapeles:', err);
    return false;
  }
}

// ──────────────────────────────────────────────────────────────────────
//  Generadores de avatar (emoji deterministicos)
// ──────────────────────────────────────────────────────────────────────
const STUDENT_AVATARS = ['🦁','🐯','🐺','🦊','🐻','🐼','🐨','🦝','🦦','🦥','🐸','🦋'];
const TEACHER_AVATARS = ['👨‍🏫','👩‍🏫','🧑‍🏫','👨‍💻','👩‍💻','🧑‍💻','👨‍🔬','👩‍🔬'];

function hashString(str) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) hash = ((hash << 5) - hash) + str.charCodeAt(i);
  return Math.abs(hash);
}

export function generateAvatar(email) {
  return STUDENT_AVATARS[hashString(email || '') % STUDENT_AVATARS.length];
}

export function generateTeacherAvatar(email) {
  return TEACHER_AVATARS[hashString(email || '') % TEACHER_AVATARS.length];
}

export function anonymizeName(name) {
  if (!name) return 'Estudiante';
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].charAt(0).toUpperCase() + '***';
  return parts[0] + ' ' + parts[1].charAt(0).toUpperCase() + '.';
}

// ──────────────────────────────────────────────────────────────────────
//  PIN generator (6 dígitos)
// ──────────────────────────────────────────────────────────────────────
export function generatePin() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

export function generateRoomCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  return Array.from({ length: 6 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
}

// ──────────────────────────────────────────────────────────────────────
//  CATÁLOGO UNIFICADO DE JUEGOS (TIC2 + CyR)
//  subjectId indica el origen/asignatura por defecto del juego.
//  El docente puede asignar cualquier juego a cualquier clase.
// ──────────────────────────────────────────────────────────────────────
export const GAMES = {
  // ── TIC2 ─────────────────────────────────────────────────────────
  kanban_hero: {
    id: 'kanban_hero', subjectId: 'tic2',
    name: 'Kanban Hero',
    description: 'Simulador ágil. Arrastra tareas y respeta los límites WIP.',
    icon: '📋', type: 'arcade',
    gamePath: 'games/tic2/kanban_hero/index.html',
    color: '#e74c3c', colorDark: '#c0392b'
  },
  cc_trivial: {
    id: 'cc_trivial', subjectId: 'tic2',
    name: 'Radio Trivial CC',
    description: 'Trivial sobre Creative Commons y propiedad intelectual.',
    icon: '🎙️', type: 'quiz',
    gamePath: 'games/tic2/cc_trivial/index.html',
    color: '#f5a623', colorDark: '#c4841a'
  },
  cert_arcade: {
    id: 'cert_arcade', subjectId: 'tic2',
    name: 'Cert Arcade',
    description: 'Tramita certificados digitales y firmas electrónicas.',
    icon: '📜', type: 'simulation',
    gamePath: 'games/tic2/cert_arcade/index.html',
    color: '#9b59b6', colorDark: '#7d3c98'
  },
  databreach: {
    id: 'databreach', subjectId: 'tic2',
    name: 'Data Breach',
    description: 'Audita sistemas mediante consultas e inyecciones SQL.',
    icon: '💻', type: 'puzzle',
    gamePath: 'games/tic2/databreach/index.html',
    color: '#10b981', colorDark: '#059669'
  },
  hex_invaders: {
    id: 'hex_invaders', subjectId: 'tic2',
    name: 'Hex Invaders',
    description: 'Space Invaders con números hexadecimales.',
    icon: '👾', type: 'arcade',
    gamePath: 'games/tic2/hex_invaders/index.html',
    color: '#3498db', colorDark: '#2980b9'
  },

  // ── CyR ──────────────────────────────────────────────────────────
  trivial: {
    id: 'trivial', subjectId: 'cyr',
    name: 'CyR Trivial',
    description: 'Demuestra lo que sabes respondiendo rápido.',
    icon: '❓', type: 'quiz',
    gamePath: 'games/cyr/trivial/index.html',
    color: '#eab308', colorDark: '#a16207'
  },
  appflow: {
    id: 'appflow', subjectId: 'cyr',
    name: 'AppFlow',
    description: 'Conecta eventos y sensores en aplicaciones móviles.',
    icon: '📱', type: 'simulation',
    gamePath: 'games/cyr/appflow/index.html',
    color: '#bb86fc', colorDark: '#9965f4'
  },
  arenabots: {
    id: 'arenabots', subjectId: 'cyr',
    name: 'ArenaBots',
    description: 'Programa tu robot para la batalla.',
    icon: '🤖', type: 'programming',
    gamePath: 'games/cyr/arenabots/index.html',
    color: '#00e5ff', colorDark: '#0099aa'
  },
  asimov: {
    id: 'asimov', subjectId: 'cyr',
    name: 'Asimov.IO',
    description: 'Simulador ético de Inteligencia Artificial.',
    icon: '⚖️', type: 'simulation',
    gamePath: 'games/cyr/asimov/index.html',
    color: '#3b82f6', colorDark: '#1d4ed8'
  },
  cybersmith: {
    id: 'cybersmith', subjectId: 'cyr',
    name: 'CyberSmith',
    description: 'Monta tu ordenador y aprende hardware.',
    icon: '🛠️', type: 'simulation',
    gamePath: 'games/cyr/cybersmith/index.html',
    color: '#b8e986', colorDark: '#7ed321'
  },
  helados: {
    id: 'helados', subjectId: 'cyr',
    name: 'H3L4D0S',
    description: 'Sirve helados y aprende programación.',
    icon: '🍦', type: 'arcade',
    gamePath: 'games/cyr/helados/game.html',
    color: '#ff8fab', colorDark: '#cc5a7a'
  },
  mecanoclass: {
    id: 'mecanoclass', subjectId: 'cyr',
    name: 'MecanoClass',
    description: 'Mecanografía con modo en vivo multijugador.',
    icon: '⌨️', type: 'live',
    gamePath: 'games/cyr/mecanoclass/index.html',
    color: '#00d4ff', colorDark: '#007a99'
  },
  moon: {
    id: 'moon', subjectId: 'cyr',
    name: 'MOON',
    description: 'Aventura espacial de plataformas con robótica.',
    icon: '🌙', type: 'platform',
    gamePath: 'games/cyr/moon/game.html',
    color: '#a8d8ea', colorDark: '#5a9bb5'
  },
  netdefender: {
    id: 'netdefender', subjectId: 'cyr',
    name: 'NetDefender',
    description: 'Defiende la red contra ataques informáticos.',
    icon: '🛡️', type: 'arcade',
    gamePath: 'games/cyr/netdefender/index.html',
    color: '#ef4444', colorDark: '#b91c1c'
  },
  rompecodigos: {
    id: 'rompecodigos', subjectId: 'cyr',
    name: 'RompeCódigos',
    description: 'Descifra mensajes cifrados en equipo (en vivo).',
    icon: '🔐', type: 'live',
    gamePath: 'games/cyr/rompecodigos/index.html',
    color: '#ff6b35', colorDark: '#c44a1a'
  }
};

// Juegos por defecto de cada asignatura (para inicializar clases nuevas)
export const DEFAULT_GAMES = {
  tic2: ['kanban_hero', 'cc_trivial', 'cert_arcade', 'databreach', 'hex_invaders'],
  cyr:  ['trivial', 'appflow', 'arenabots', 'asimov', 'cybersmith',
         'helados', 'mecanoclass', 'moon', 'netdefender', 'rompecodigos']
};

// ──────────────────────────────────────────────────────────────────────
//  Mapeo de criterios de evaluación (para mostrar en class_detail)
// ──────────────────────────────────────────────────────────────────────
export const GAMES_CRITERIA_MAPPING = {
  // TIC2
  hex_invaders:  { '2º Bachillerato': 'TIC2.3.1 (Contenidos en la web)' },
  cert_arcade:   { '2º Bachillerato': 'TIC2.2.1 / TIC2.2.2 (Seguridad y Privacidad)' },
  kanban_hero:   { '2º Bachillerato': 'TIC2.5.2 (Metodologías de desarrollo)' },
  cc_trivial:    { '2º Bachillerato': 'TIC2.4.1 (Trabajo colaborativo y derechos)' },
  databreach:    { '2º Bachillerato': 'TIC2.2.3 (Ciberamenazas y vulnerabilidades)' },
  // CyR
  mecanoclass:   { '1º ESO': 'CYR.1.F.1 / CYR.1.I.1', '2º ESO': 'CYR.2.F.1 / CYR.2.I.1', '3º ESO': 'CYR.3.F.1 / CYR.3.I.2' },
  rompecodigos:  { '1º ESO': 'CYR.1.I.1 / CYR.1.I.3', '2º ESO': 'CYR.2.I.1 / CYR.2.I.2' },
  helados:       { '1º ESO': 'CYR.1.A.3 / CYR.1.A.4' },
  arenabots:     { '2º ESO': 'CYR.2.P.1 / CYR.2.P.2', '3º ESO': 'CYR.3.P.1 / CYR.3.R.1' },
  moon:          { '2º ESO': 'CYR.2.R.1 / CYR.2.R.2', '3º ESO': 'CYR.3.R.1 / CYR.3.R.2' },
  cybersmith:    { '1º ESO': 'CYR.1.F.1', '2º ESO': 'CYR.2.F.1 / CYR.2.F.2' },
  asimov:        { '3º ESO': 'CYR.3.IA.1 / CYR.3.IA.2' },
  appflow:       { '2º ESO': 'CYR.2.A.1 / CYR.2.M.1', '3º ESO': 'CYR.3.M.1' },
  netdefender:   { '1º ESO': 'CYR.1.I.2 / CYR.1.I.3', '2º ESO': 'CYR.2.I.1 / CYR.2.I.2' },
  trivial:       { '1º ESO': 'CYR.1 (Evaluación general)', '2º ESO': 'CYR.2 (Evaluación general)' }
};

export const TIC2_EVALUATION_DATA = {
  2: [
    { crit: '1.1', text: 'Analizar y valorar el impacto de la industria de desarrollo de software en la sociedad actual.', block: 'A. Desarrollo de Software', current: '-', prop: 'Podcast IA' },
    { crit: '2.1', text: 'Emplear medidas de seguridad informática necesarias.', block: 'C. Seguridad Informática', current: 'Certificado Arcade', prop: 'Wiki Ciberseguridad, UVUS' },
    { crit: '2.2', text: 'Proteger la privacidad en Internet.', block: 'C. Seguridad Informática', current: '-', prop: 'Wiki Ciberseguridad, Web WordPress' },
    { crit: '3.1', text: 'Elaborar y publicar contenidos en la web.', block: 'B. Publicación de contenidos', current: '-', prop: 'Web WordPress, SEO y Analytics, Marketing GIMP, Web HTML, Accesibilidad WCAG, Hex Invaders' },
    { crit: '4.1', text: 'Trabajar colaborativamente respetando los derechos de autor.', block: 'B. Publicación de contenidos', current: 'CC Trivial', prop: 'Audacity, Subida iVoox' },
    { crit: '5.1', text: 'Desarrollar una variedad de aplicaciones informáticas.', block: 'A. Desarrollo de Software', current: '-', prop: 'SuperMarioBros, Crea tu App' },
    { crit: '5.2', text: 'Aplicar los principales pasos del ciclo de vida de una aplicación.', block: 'A. Desarrollo de Software', current: '-', prop: 'Tablero Kanban, Crea tu App' },
    { crit: '5.3', text: 'Analizar y resolver problemas de tratamiento de la información.', block: 'A. Desarrollo de Software', current: '-', prop: 'SuperMario Move Move, Crea tu App' }
  ]
};

export const CYR_EVALUATION_DATA = {
  1: [
    { crit: '1.1', text: 'Comprender el funcionamiento global de los sistemas de computación física y sus componentes.', block: 'F. Computación física (Hardware)', current: 'MecanoClass, CyberSmith', prop: '1. Carpetas, 3. Mecanografía, N1. Usuarios' },
    { crit: '1.2', text: 'Reconocer el papel de la robótica en nuestra sociedad.', block: 'C. Robótica', current: '-', prop: '15. Dispositivos/Red, 17. Test Asimov' },
    { crit: '1.3', text: 'Entender la estructura básica de un programa informático.', block: 'A. Programación', current: 'H3L4D0S, MOON', prop: '7. Oso Polar, 8. Escarabajo, 9. Elefante, 11. Gato Bross, 12. Code.org' },
    { crit: '1.4', text: 'Comprender los principios básicos de ingeniería en los que se basan los robots.', block: 'C. Robótica', current: 'ArenaBots', prop: '20. Cutebot Siguelíneas, N4. Esquiva-obstáculos' },
    { crit: '2.1', text: 'Conocer y resolver problemas desarrollando un programa informático con bloques.', block: 'A. Programación', current: 'H3L4D0S, ArenaBots', prop: '4. Píxeles, 5. Diagramas, 6. Test Algoritmos, N3. Depuración' },
    { crit: '2.2', text: 'Entender el funcionamiento interno de las aplicaciones y cómo se construyen.', block: 'D. Desarrollo', current: '-', prop: '10. Mapa Interactivo, 18. Juego Micro:bit' },
    { crit: '3.1', text: 'Construir un sistema de computación o robótico.', block: 'C/F. Proyecto Físico', current: 'CyberSmith', prop: '19. Código Morse, 21. Coche Teledirigido' },
    { crit: '4.1', text: 'Conocer distintos tipos de datos, analizarlos y visualizarlos.', block: 'G. Datos masivos', current: '-', prop: '22. Canción IA, 23. Dibujando IA, 26. La sed de ChatGPT' },
    { crit: '4.2', text: 'Comprender los principios básicos de agentes inteligentes y aprendizaje automático.', block: 'H. Inteligencia Artificial', current: '-', prop: '24. Entrena IA, 25. Test IA, N5. Cómic IA' },
    { crit: '5.1', text: 'Conocer la construcción de aplicaciones web y de forma segura.', block: 'E. Desarrollo Web', current: '-', prop: '0. Quién eres, N2. Gestión Archivos' },
    { crit: '5.2', text: 'Resolver la variedad de problemas de una aplicación web.', block: 'E. Desarrollo Web', current: '-', prop: '13. Felicitación GIMP, 14. Crea tu web' },
    { crit: '6.1', text: 'Adoptar conductas y hábitos que permitan la protección en la red.', block: 'I. Ciberseguridad', current: 'RompeCódigos', prop: '16. Bienestar Digital, N7. Phishing' },
    { crit: '6.2', text: 'Acceder a servicios de publicación aplicando criterios de seguridad.', block: 'I. Ciberseguridad', current: '-', prop: '2. Envío eMails, N6. Retos INCIBE' },
    { crit: '6.3', text: 'Reconocer los derechos de los materiales alojados en la web.', block: 'I. Ciberseguridad', current: '-', prop: '27. Creative Commons, 28. Infografía Ciberseg.' },
    { crit: '6.4', text: 'Adoptar conductas de seguridad activa y pasiva en protección de datos.', block: 'I. Ciberseguridad', current: 'RompeCódigos', prop: '29. Contraseñas seguras, N8. Seguridad Act/Pas.' }
  ],
  2: [
    { crit: '1.1', text: 'Comprender el funcionamiento de los sistemas de computación física.', block: 'F. Computación física', current: 'MecanoClass, CyberSmith', prop: '-' },
    { crit: '1.2', text: 'Reconocer el papel de la robótica, conociendo las aplicaciones más comunes.', block: 'C. Robótica', current: '-', prop: 'Asimov.IO' },
    { crit: '1.3', text: 'Entender cómo funciona un programa, elaborarlo y sus componentes.', block: 'A. Programación', current: 'H3L4D0S, MOON', prop: '-' },
    { crit: '1.4', text: 'Comprender los principios de ingeniería de los robots y su funcionamiento.', block: 'C. Robótica', current: 'ArenaBots', prop: '-' },
    { crit: '2.1', text: 'Conocer y resolver problemas desarrollando un programa informático.', block: 'A. Programación', current: 'H3L4D0S, ArenaBots', prop: '-' },
    { crit: '2.2', text: 'Entender el funcionamiento interno de las aplicaciones móviles y cómo se construyen.', block: 'D. Desarrollo móvil', current: '-', prop: 'AppFlow' },
    { crit: '2.3', text: 'Resolver problemas desarrollando una aplicación móvil.', block: 'D. Desarrollo móvil', current: '-', prop: 'AppFlow' },
    { crit: '3.1', text: 'Construir un sistema de computación o robótico automatizado.', block: 'C/F. Proyecto', current: 'CyberSmith', prop: '-' },
    { crit: '4.1', text: 'Conocer aplicaciones de Big Data, metadatos y emplear espíritu crítico.', block: 'G. Datos masivos', current: '-', prop: 'DataScope' },
    { crit: '4.2', text: 'Comprender el aprendizaje automático para resolver situaciones con IA.', block: 'H. Inteligencia Artificial', current: '-', prop: 'NeuroBot' },
    { crit: '5.1', text: 'Conocer la construcción de aplicaciones informáticas y web de forma responsable.', block: 'E. Desarrollo Web', current: '-', prop: 'WebBuilder' },
    { crit: '5.2', text: 'Resolver problemas presentes en el desarrollo de una aplicación web.', block: 'E. Desarrollo Web', current: '-', prop: 'WebBuilder' },
    { crit: '6.1', text: 'Adoptar conductas que permitan la protección en la red.', block: 'I. Ciberseguridad', current: 'RompeCódigos', prop: 'NetDefender' },
    { crit: '6.2', text: 'Acceder a servicios de publicación aplicando seguridad.', block: 'I. Ciberseguridad', current: '-', prop: 'El Moderador' },
    { crit: '6.3', text: 'Reconocer los derechos de propiedad intelectual en Internet.', block: 'I. Ciberseguridad', current: '-', prop: 'El Moderador' },
    { crit: '6.4', text: 'Adoptar conductas de seguridad y protección de datos.', block: 'I. Ciberseguridad', current: 'RompeCódigos', prop: 'NetDefender' }
  ],
  3: [
    { crit: '1.1', text: 'Comprender el funcionamiento de sistemas de computación física.', block: 'F. Computación física', current: 'MecanoClass, CyberSmith', prop: '-' },
    { crit: '1.2', text: 'Reconocer los conceptos de la robótica y configuraciones morfológicas.', block: 'C. Robótica', current: 'ArenaBots', prop: 'Asimov.IO' },
    { crit: '1.3', text: 'Entender cómo funciona un programa y sus principales componentes.', block: 'A. Programación', current: 'H3L4D0S, MOON', prop: '-' },
    { crit: '1.4', text: 'Comprender los principios de ingeniería de los robots.', block: 'C. Robótica', current: 'ArenaBots', prop: '-' },
    { crit: '2.1', text: 'Resolver problemas desarrollando programas informáticos.', block: 'A. Programación', current: 'H3L4D0S, ArenaBots', prop: '-' },
    { crit: '2.2', text: 'Entender el funcionamiento interno de aplicaciones móviles.', block: 'D. Desarrollo móvil', current: '-', prop: 'AppFlow' },
    { crit: '2.3', text: 'Resolver problemas desarrollando una aplicación móvil.', block: 'D. Desarrollo móvil', current: '-', prop: 'AppFlow' },
    { crit: '3.1', text: 'Construir un sistema de computación o robótico.', block: 'C/F. Proyecto', current: 'CyberSmith', prop: '-' },
    { crit: '4.1', text: 'Conocer la naturaleza de los distintos tipos de metadatos (Big Data).', block: 'G. Datos masivos', current: '-', prop: 'DataScope' },
    { crit: '4.2', text: 'Comprender el funcionamiento de agentes inteligentes e IA.', block: 'H. Inteligencia Artificial', current: '-', prop: 'NeuroBot' },
    { crit: '4.3', text: 'Comprender los principios de funcionamiento del Data Scraping.', block: 'G. Datos masivos', current: '-', prop: 'DataScope' },
    { crit: '5.1', text: 'Construcción de aplicaciones web y de forma segura.', block: 'E. Desarrollo Web', current: '-', prop: 'WebBuilder' },
    { crit: '5.2', text: 'Resolver variedad de problemas en aplicaciones web.', block: 'E. Desarrollo Web', current: '-', prop: 'WebBuilder' },
    { crit: '6.1', text: 'Adoptar conductas que permitan la protección en la red.', block: 'I. Ciberseguridad', current: 'RompeCódigos', prop: 'NetDefender' },
    { crit: '6.2', text: 'Intercambio y publicación de información digital con seguridad.', block: 'I. Ciberseguridad', current: '-', prop: 'El Moderador' },
    { crit: '6.3', text: 'Reconocer y comprender la propiedad intelectual.', block: 'I. Ciberseguridad', current: '-', prop: 'El Moderador' },
    { crit: '6.4', text: 'Estrategias de ciberseguridad que garantizan protección a usuarios.', block: 'I. Ciberseguridad', current: 'RompeCódigos', prop: 'NetDefender' }
  ]
};

export const EVALUATION_DATA = {
  tic2: TIC2_EVALUATION_DATA,
  cyr: CYR_EVALUATION_DATA
};

export const TOPICS = {
  // TIC2
  topic_kanban: { id: "topic_kanban", subjectId: "tic2", name: "1. Ingeniería e Industria del Software", icon: "📋", color: "#4a90e2", htmlPath: "temario/index.html?topicId=topic_kanban&subjectId=tic2" },
  topic_drive: { id: "topic_drive", subjectId: "tic2", name: "2. Ofimática Colaborativa", icon: "☁️", color: "#34a853", htmlPath: "temario/index.html?topicId=topic_drive&subjectId=tic2" },
  topic_multimedia: { id: "topic_multimedia", subjectId: "tic2", name: "3. Edición Multimedia y Propiedad Intelectual", icon: "🎨", color: "#f39c12", htmlPath: "temario/index.html?topicId=topic_multimedia&subjectId=tic2" },
  topic_cms: { id: "topic_cms", subjectId: "tic2", name: "4. CMS, Wikis y SEO", icon: "📰", color: "#2980b9", htmlPath: "temario/index.html?topicId=topic_cms&subjectId=tic2" },
  topic_cyber: { id: "topic_cyber", subjectId: "tic2", name: "5. Ciberseguridad y Privacidad", icon: "🔐", color: "#d0021b", htmlPath: "temario/index.html?topicId=topic_cyber&subjectId=tic2" },
  topic_html: { id: "topic_html", subjectId: "tic2", name: "6. Desarrollo Web y Accesibilidad", icon: "🌐", color: "#e34c26", htmlPath: "temario/index.html?topicId=topic_html&subjectId=tic2" },
  topic_js: { id: "topic_js", subjectId: "tic2", name: "7. Programación (Algoritmos, JS y SQL)", icon: "💻", color: "#f1c40f", htmlPath: "temario/index.html?topicId=topic_js&subjectId=tic2" },
  topic_js_adv: { id: "topic_js_adv", subjectId: "tic2", name: "8. JS Avanzado y Antigravity", icon: "🚀", color: "#34495e", htmlPath: "temario/index.html?topicId=topic_js_adv&subjectId=tic2" },
  // CyR
  block1: { id: "block1", subjectId: "cyr", name: "Bloque 1: Alfabetización Digital", icon: "💻", color: "#4a90e2", htmlPath: "temario/index.html?topicId=block1&subjectId=cyr" },
  block2: { id: "block2", subjectId: "cyr", name: "Bloque 2: Programación", icon: "🧩", color: "#f5a623", htmlPath: "temario/index.html?topicId=block2&subjectId=cyr" },
  block3: { id: "block3", subjectId: "cyr", name: "Bloque 3: Robótica", icon: "🤖", color: "#d0021b", htmlPath: "temario/index.html?topicId=block3&subjectId=cyr" },
  block4: { id: "block4", subjectId: "cyr", name: "Bloque 4: IoT y Móvil", icon: "📱", color: "#00bcd4", htmlPath: "temario/index.html?topicId=block4&subjectId=cyr" },
  block5: { id: "block5", subjectId: "cyr", name: "Bloque 5: Inteligencia Artificial", icon: "🧠", color: "#9013fe", htmlPath: "temario/index.html?topicId=block5&subjectId=cyr" }
};

// ──────────────────────────────────────────────────────────────────────
//  CURSOS / MATERIAS OFICIALES
// ──────────────────────────────────────────────────────────────────────
export const COURSES = {
  cyr: {
    id: 'cyr',
    name: 'Computación y Robótica',
    shortName: 'CyR',
    level: '1º a 3º ESO',
    icon: '🤖',
    color: '#6c63ff',
    colorDark: '#4f46e5',
    description: 'Alfabetización digital, programación por bloques, robótica, IA y ciberseguridad para Educación Secundaria.',
    levels: ['1º ESO', '2º ESO', '3º ESO']
  },
  tic2: {
    id: 'tic2',
    name: 'Tecnologías de la Información y Comunicación II',
    shortName: 'TIC II',
    level: '2º Bachillerato',
    icon: '💻',
    color: '#0073aa',
    colorDark: '#005177',
    description: 'Desarrollo web, ciberseguridad, programación, bases de datos y metodologías ágiles.',
    levels: ['2º Bachillerato']
  }
};

export const SUBJECTS = COURSES;

export function getCourseStats(courseId) {
  const topics = Object.values(TOPICS).filter(t => t.subjectId === courseId);
  const games = Object.values(GAMES).filter(g => g.subjectId === courseId);
  return {
    topicsCount: topics.length,
    gamesCount: games.length,
    topics,
    games
  };
}

