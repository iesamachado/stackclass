// ═══════════════════════════════════════════════════════════════════════
//  curriculum-matrix.js — Matriz de Criterios LOMLOE y Actividades
//  Programación didáctica interactiva: genérica y por aula
// ═══════════════════════════════════════════════════════════════════════

import {
  TIC2_EVALUATION_DATA,
  CYR_EVALUATION_DATA,
  GAMES,
  TOPICS,
  DEFAULT_GAMES
} from './utils.js';

import {
  TIC2_CLASSROOM_TASKS,
  CYR_CLASSROOM_TASKS
} from './tasks.js';

// ──────────────────────────────────────────────────────────────────────
//  1. PROGRAMACIÓN GENÉRICA POR DEFECTO (Normativa LOMLOE)
// ──────────────────────────────────────────────────────────────────────
// Cada actividad tiene asignado 1 criterio por defecto (con excepciones)
export const GENERIC_CRITERIA_MAPPING = {
  tic2: {
    '2': {
      // 🎮 Minijuegos TIC2 (2º Bachillerato)
      'game:kanban_hero': ['5.2'],
      'game:cc_trivial':  ['4.1'],
      'game:cert_arcade': ['2.1', '2.2'],
      'game:databreach':  ['2.2'],
      'game:hex_invaders':['3.1'],

      // 📖 Tests de repaso Temario TIC2
      'test:topic_kanban':    ['5.2'],
      'test:topic_drive':     ['4.1'],
      'test:topic_multimedia':['4.1'],
      'test:topic_cms':       ['3.1'],
      'test:topic_cyber':     ['2.1', '2.2'],
      'test:topic_html':      ['3.1'],
      'test:topic_js':        ['5.1'],
      'test:topic_js_adv':    ['5.3'],

      // 📝 Tareas offline TIC2
      'task:1':        ['5.2'],
      'task:2':        ['1.1'],
      'task:3':        ['4.1'],
      'task:Game_CC':  ['4.1'],
      'task:4':        ['3.1', '2.2'],
      'task:5':        ['3.1'],
      'task:6':        ['3.1'],
      'task:7':        ['1.1'],
      'task:8':        ['4.1'],
      'task:9':        ['2.1'],
      'task:10':       ['2.1'],
      'task:Game_Cert':['2.1'],
      'task:11':       ['3.1'],
      'task:12':       ['3.1'],
      'task:Game_Hex': ['3.1'],
      'task:13':       ['5.1'],
      'task:14':       ['5.3'],
      'task:15':       ['5.1', '5.2', '5.3']
    }
  },
  cyr: {
    '1': {
      // 🎮 Minijuegos CyR (1º ESO)
      'game:trivial':      ['1.1', '6.1'],
      'game:appflow':      ['2.2'],
      'game:arenabots':    ['1.4', '2.1'],
      'game:asimov':       ['1.2'],
      'game:cybersmith':   ['1.1', '3.1'],
      'game:helados':      ['1.3', '2.1'],
      'game:mecanoclass':  ['1.1', '6.1'],
      'game:moon':         ['1.3'],
      'game:netdefender':  ['6.4'],
      'game:rompecodigos': ['6.1', '6.4'],

      // 📖 Tests de repaso Temario CyR
      'test:block1': ['1.1'],
      'test:block2': ['2.1'],
      'test:block3': ['1.4'],
      'test:block4': ['2.2'],
      'test:block5': ['4.2'],

      // 📝 Tareas offline CyR (1º ESO)
      'task:0':  ['5.1'],
      'task:1':  ['1.1'],
      'task:2':  ['6.2'],
      'task:3':  ['6.1'],
      'task:4':  ['1.1'],
      'task:5':  ['1.1', '6.1'],
      'task:6':  ['2.1'],
      'task:7':  ['2.1'],
      'task:8':  ['2.1'],
      'task:9':  ['1.3'],
      'task:10': ['2.2', '5.2'],
      'task:11': ['1.3', '2.2'],
      'task:12': ['1.3'],
      'task:13': ['5.2'],
      'task:14': ['5.1'],
      'task:15': ['5.1'],
      'task:16': ['1.3'],
      'task:17': ['2.1'],
      'task:18': ['1.1'],
      'task:19': ['1.2'],
      'task:20': ['2.2'],
      'task:21': ['3.1'],
      'task:22': ['1.4'],
      'task:23': ['3.1', '1.4'],
      'task:24': ['1.4'],
      'task:25': ['3.1'],
      'task:26': ['1.1'],
      'task:27': ['2.2'],
      'task:28': ['4.1'],
      'task:29': ['4.1'],
      'task:30': ['4.2'],
      'task:31': ['4.2'],
      'task:32': ['4.1'],
      'task:33': ['4.1'],
      'task:34': ['1.2'],
      'task:35': ['6.3'],
      'task:36': ['6.3'],
      'task:37': ['6.4'],
      'task:38': ['6.1'],
      'task:39': ['6.4']
    },
    '2': {},
    '3': {}
  }
};

// ──────────────────────────────────────────────────────────────────────
//  2. GET CRITERIOS DE EVALUACIÓN
// ──────────────────────────────────────────────────────────────────────
export function getCurriculumCriteria(subjectId = 'cyr', level = '1') {
  const normSubject = subjectId === 'tic2' ? 'tic2' : 'cyr';
  const normLevel = normSubject === 'tic2' ? '2' : String(level || '1');
  const data = normSubject === 'tic2' ? TIC2_EVALUATION_DATA : CYR_EVALUATION_DATA;
  return data[normLevel] || data[Object.keys(data)[0]] || [];
}

// ──────────────────────────────────────────────────────────────────────
//  3. GET CATÁLOGO DE ACTIVIDADES
// ──────────────────────────────────────────────────────────────────────
export function getCurriculumActivities(subjectId = 'cyr', level = '1') {
  const normSubject = subjectId === 'tic2' ? 'tic2' : 'cyr';
  const activities = [];

  // A) Minijuegos
  const gameIds = DEFAULT_GAMES[normSubject] || [];
  gameIds.forEach(id => {
    const game = GAMES[id];
    if (game) {
      activities.push({
        key: `game:${id}`,
        id,
        type: 'game',
        typeLabel: 'Minijuego',
        name: game.name || id,
        icon: game.icon || '🎮',
        color: game.color || '#4f46e5'
      });
    }
  });

  // B) Tests de repaso (Temario)
  const topics = Object.values(TOPICS).filter(t => t.subjectId === normSubject);
  topics.forEach(top => {
    activities.push({
      key: `test:${top.id}`,
      id: top.id,
      type: 'test',
      typeLabel: 'Test Repaso',
      name: top.name,
      icon: top.icon || '📖',
      color: top.color || '#3b82f6'
    });
  });

  // C) Tareas offline
  const tasks = normSubject === 'tic2' ? TIC2_CLASSROOM_TASKS : CYR_CLASSROOM_TASKS;
  tasks.forEach(t => {
    const isGame = isNaN(t.id) || (t.title && t.title.toLowerCase().startsWith('juego:'));
    activities.push({
      key: `task:${t.id}`,
      id: String(t.id),
      type: 'task',
      typeLabel: isGame ? 'Juego Aula' : 'Tarea Offline',
      name: isNaN(t.id) ? t.title : `Tarea ${t.id}: ${t.title}`,
      icon: isGame ? '🕹️' : '📝',
      color: isGame ? '#f43f5e' : '#10b981',
      block: t.block
    });
  });

  return activities;
}

// ──────────────────────────────────────────────────────────────────────
//  4. RESOLUCIÓN DE MAPEO EFECTIVO (GENÉRICO + SOBREESCRITURAS DE CLASE)
// ──────────────────────────────────────────────────────────────────────
export function getEffectiveCriteriaMapping(subjectId = 'cyr', level = '1', classOverrides = null) {
  const normSubject = subjectId === 'tic2' ? 'tic2' : 'cyr';
  const normLevel = normSubject === 'tic2' ? '2' : String(level || '1');

  const generic = (GENERIC_CRITERIA_MAPPING[normSubject] && GENERIC_CRITERIA_MAPPING[normSubject][normLevel]) || {};
  const effective = { ...generic };

  if (classOverrides && typeof classOverrides === 'object') {
    Object.keys(classOverrides).forEach(key => {
      if (Array.isArray(classOverrides[key])) {
        effective[key] = [...classOverrides[key]];
      }
    });
  }

  return effective;
}

// ──────────────────────────────────────────────────────────────────────
//  5. COMPROBAR SI LA CLASE TIENE PERSONALIZACIÓN
// ──────────────────────────────────────────────────────────────────────
export function hasCustomMapping(classData) {
  if (!classData) return false;
  const mapping = classData.criteriaMapping || classData.criteria_mapping;
  if (!mapping || typeof mapping !== 'object') return false;
  return Object.keys(mapping).length > 0;
}

// ──────────────────────────────────────────────────────────────────────
//  6. EXPORTAR MATRIZ A CSV
// ──────────────────────────────────────────────────────────────────────
export function exportCurriculumMatrixCSV(subjectId = 'cyr', level = '1', mapping = {}) {
  const criteria = getCurriculumCriteria(subjectId, level);
  const activities = getCurriculumActivities(subjectId, level);

  const header = ['Criterio', 'Bloque', 'Descripción', ...activities.map(a => `"${a.typeLabel}: ${a.name.replace(/"/g, '""')}"`)];
  const rows = [header.join(';')];

  criteria.forEach(c => {
    const row = [
      `"${c.crit}"`,
      `"${(c.block || '').replace(/"/g, '""')}"`,
      `"${(c.text || '').replace(/"/g, '""')}"`
    ];
    activities.forEach(a => {
      const assigned = (mapping[a.key] || []).includes(c.crit);
      row.push(assigned ? '"X"' : '""');
    });
    rows.push(row.join(';'));
  });

  return rows.join('\r\n');
}
