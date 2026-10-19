// ═══════════════════════════════════════════════════════════════════════
//  gradebook-calc.js — Motor de Cálculo del Cuaderno Docente LOMLOE
//  Evaluación continua por Criterios, Competencias Específicas, Tareas,
//  Juegos de Aula y Tests de Repaso (siempre tomando el último intento)
// ═══════════════════════════════════════════════════════════════════════

import { TOPICS, GAMES, scoreToGrade } from './utils.js';

/**
 * Mapeo oficial de tareas de aula a identificadores de juegos.
 * Regla: Los juegos solo se evalúan académicamente si tienen una tarea asociada.
 */
export const TASK_TO_GAME_MAP = {
  // CyR (1º ESO)
  '4':  'mecanoclass',
  '5':  'trivial',
  '16': 'moon',
  '17': 'helados',
  '24': 'arenabots',
  '25': 'cybersmith',
  '27': 'appflow',
  '34': 'asimov',
  '38': 'rompecodigos',
  '39': 'netdefender',
  // TIC2 (2º Bachillerato)
  'Game_CC':   'cc_trivial',
  'Game_Cert': 'cert_arcade',
  'Game_Hex':  'hex_invaders'
};

/**
 * Puntuaciones objetivo estándar para calificar juegos con nota 10/10.
 * Si la tarea tiene un assignment con targetScore personalizado, este se respeta.
 */
export const DEFAULT_GAME_TARGET_SCORES = {
  mecanoclass:  60,   // 60 WPM
  trivial:      100,  // 10 preguntas
  cc_trivial:   100,
  cert_arcade:  100,
  hex_invaders: 500,
  helados:      500,
  moon:         100,
  rompecodigos: 100,
  netdefender:  500,
  arenabots:    100,
  cybersmith:   100,
  appflow:      100,
  asimov:       100,
  kanban_hero:  100,
  databreach:   100,
  default:      100
};

/**
 * Normaliza cualquier formato de fecha o timestamp a milisegundos para ordenación temporal precisa.
 */
export function getTimestampMs(record) {
  if (!record) return 0;
  const raw = record.created_at || record.fecha || record.timestamp || record.updated_at || record.createdAt;
  if (!raw) return 0;
  if (typeof raw === 'number') return raw > 1e11 ? raw : raw * 1000;
  if (typeof raw.toDate === 'function') return raw.toDate().getTime();
  if (typeof raw.seconds === 'number') return raw.seconds * 1000 + (raw.nanoseconds ? raw.nanoseconds / 1e6 : 0);
  if (typeof raw === 'string') {
    const parsed = Date.parse(raw);
    return isNaN(parsed) ? 0 : parsed;
  }
  if (raw instanceof Date) return raw.getTime();
  return 0;
}

/**
 * Normaliza identificadores de temas de tests de repaso para tolerar variaciones legacy.
 */
export function normalizeTopicId(tid) {
  if (!tid) return '';
  const s = String(tid).toLowerCase().trim();
  if (s === '1' || s === 'bloque1' || s === 'bloque_1' || s === 'block_1') return 'block1';
  if (s === '2' || s === 'bloque2' || s === 'bloque_2' || s === 'block_2') return 'block2';
  if (s === '3' || s === 'bloque3' || s === 'bloque_3' || s === 'block_3') return 'block3';
  if (s === '4' || s === 'bloque4' || s === 'bloque_4' || s === 'block_4') return 'block4';
  if (s === '5' || s === 'bloque5' || s === 'bloque_5' || s === 'block_5') return 'block5';
  return s;
}

/**
 * Normaliza identificadores de juegos para tolerar alias (ej. cyr_trivial -> trivial).
 */
export function normalizeGameId(gid) {
  if (!gid) return '';
  const s = String(gid).toLowerCase().trim();
  if (s === 'cyr_trivial' || s === 'cyrtrivial') return 'trivial';
  if (s === 'h3l4d0s') return 'helados';
  if (s === 'radio_trivial' || s === 'radio_trivial_cc') return 'cc_trivial';
  return s;
}

/**
 * Normaliza la nota de un test para asegurar escala LOMLOE 0.00 a 10.00.
 */
export function normalizeTestScore(rawScore, maxPossible) {
  if (rawScore === null || rawScore === undefined || isNaN(rawScore)) return null;
  const num = Number(rawScore);
  if (num <= 10) return Math.max(0, Math.min(10, Math.round(num * 100) / 100));
  if (maxPossible && maxPossible > 0) {
    return Math.max(0, Math.min(10, Math.round((num / maxPossible) * 10 * 100) / 100));
  }
  if (num <= 100) return Math.round((num / 10) * 100) / 100;
  return 10.0;
}

/**
 * Devuelve el catálogo de tests de repaso de temario para la asignatura dada.
 */
export function getSubjectReviewTests(subjectId = 'cyr') {
  const normSubject = subjectId === 'tic2' ? 'tic2' : 'cyr';
  return Object.values(TOPICS)
    .filter(t => t.subjectId === normSubject)
    .map(top => ({
      id: top.id,
      key: `test:${top.id}`,
      title: top.name,
      name: top.name,
      icon: top.icon || '📖',
      color: top.color || '#3b82f6',
      type: 'test'
    }));
}

export const COMPETENCIES_DEF = {
  cyr: {
    '1': { code: 'CE 1', name: 'Computación Física y Robótica (Hardware)', short: 'CE1 Hardware', icon: '🤖' },
    '2': { code: 'CE 2', name: 'Algoritmos y Programación con Bloques', short: 'CE2 Algoritmos', icon: '💻' },
    '3': { code: 'CE 3', name: 'Sistemas Físicos y Proyectos de Robótica', short: 'CE3 Sistemas', icon: '⚙️' },
    '4': { code: 'CE 4', name: 'Datos Masivos e Inteligencia Artificial', short: 'CE4 Datos e IA', icon: '🧠' },
    '5': { code: 'CE 5', name: 'Desarrollo y Publicación Web Segura', short: 'CE5 Web', icon: '🌐' },
    '6': { code: 'CE 6', name: 'Ciberseguridad y Bienestar Digital', short: 'CE6 Ciberseguridad', icon: '🛡️' }
  },
  tic2: {
    '1': { code: 'CE 1', name: 'Desarrollo e Industria del Software', short: 'CE1 Industria', icon: '🏭' },
    '2': { code: 'CE 2', name: 'Seguridad Informática y Privacidad', short: 'CE2 Privacidad', icon: '🔒' },
    '3': { code: 'CE 3', name: 'Publicación Web y Accesibilidad', short: 'CE3 Web', icon: '🌍' },
    '4': { code: 'CE 4', name: 'Trabajo Colaborativo y Multimedia', short: 'CE4 Multimedia', icon: '🎙️' },
    '5': { code: 'CE 5', name: 'Programación y Algoritmia Avanzada', short: 'CE5 Programación', icon: '⚡' }
  }
};

/**
 * Devuelve la calificación cualitativa LOMLOE para una nota cuantitativa (0..10)
 */
export function getQualitativeGrade(grade) {
  if (grade === null || grade === undefined || isNaN(grade)) {
    return { code: '—', label: 'Sin calificar', badgeClass: 'badge--muted', color: 'var(--text-muted)' };
  }
  const n = Number(grade);
  if (n < 5.0)  return { code: 'IN', label: 'Insuficiente',  badgeClass: 'badge--error',   color: 'var(--error)' };
  if (n < 6.0)  return { code: 'SU', label: 'Suficiente',    badgeClass: 'badge--warning', color: 'var(--warning, #b45309)' };
  if (n < 7.0)  return { code: 'BI', label: 'Bien',          badgeClass: 'badge--info',    color: '#0284c7' };
  if (n < 9.0)  return { code: 'NT', label: 'Notable',       badgeClass: 'badge--accent',  color: '#6366f1' };
  return               { code: 'SB', label: 'Sobresaliente', badgeClass: 'badge--success', color: 'var(--success)' };
}

/**
 * Resuelve qué criterios están vinculados a una tarea dada.
 * Cumple la regla: los juegos solo se evalúan si tienen una tarea asociada.
 */
export function getCriteriaForTask(task, criteriaMapping = {}) {
  if (!task) return [];
  const taskKey = `task:${task.id}`;
  if (criteriaMapping && Array.isArray(criteriaMapping[taskKey]) && criteriaMapping[taskKey].length > 0) {
    return [...criteriaMapping[taskKey]];
  }
  if (criteriaMapping && Array.isArray(criteriaMapping[task.id]) && criteriaMapping[task.id].length > 0) {
    return [...criteriaMapping[task.id]];
  }
  if (task.crit) {
    return String(task.crit).split(',').map(s => s.trim()).filter(Boolean);
  }
  return [];
}

/**
 * Resuelve qué criterios están vinculados a un test de repaso dado en la matriz didáctica.
 */
export function getCriteriaForTest(topicId, criteriaMapping = {}) {
  if (!topicId) return [];
  const normId = normalizeTopicId(topicId);
  const testKey = `test:${normId}`;
  if (criteriaMapping && Array.isArray(criteriaMapping[testKey]) && criteriaMapping[testKey].length > 0) {
    return [...criteriaMapping[testKey]];
  }
  if (criteriaMapping && Array.isArray(criteriaMapping[normId]) && criteriaMapping[normId].length > 0) {
    return [...criteriaMapping[normId]];
  }
  return [];
}

/**
 * Resuelve el identificador de juego asociado a una tarea.
 */
export function getGameIdForTask(task) {
  if (!task) return null;
  if (task.gameId) return normalizeGameId(task.gameId);
  const mapped = TASK_TO_GAME_MAP[task.id] || TASK_TO_GAME_MAP[String(task.id)];
  if (mapped) return normalizeGameId(mapped);
  if (task.title && task.title.toLowerCase().startsWith('juego:')) {
    const rawName = task.title.replace(/^juego:\s*/i, '').trim().toLowerCase();
    for (const gid of Object.keys(GAMES)) {
      const g = GAMES[gid];
      if (g.name.toLowerCase() === rawName || gid.toLowerCase() === rawName) {
        return normalizeGameId(gid);
      }
    }
  }
  return null;
}

/**
 * Calcula todo el cuaderno docente para un conjunto de alumnos, tareas, calificaciones,
 * tests de repaso (tomando SIEMPRE el último intento) y partidas de juegos.
 */
export function calculateGradebook({
  members = [],
  tasks = [],
  reviewTests = null,
  offlineGrades = {},
  topicTestResults = [],
  gameResults = [],
  assignments = [],
  criteriaMapping = {},
  criteriaList = [],
  subjectId = 'cyr',
  level = '1',
  studentIdAliases = {}
}) {
  const normSubject = subjectId === 'tic2' ? 'tic2' : 'cyr';
  const compDefs = COMPETENCIES_DEF[normSubject] || COMPETENCIES_DEF.cyr;

  // Si no se proporcionaron tests de repaso explícitos, obtener el catálogo del temario
  const actualReviewTests = Array.isArray(reviewTests) && reviewTests.length > 0
    ? reviewTests
    : getSubjectReviewTests(normSubject);

  // Filtrar miembros activos (no pendientes)
  const activeMembers = members.filter(m => !m.pending);

  // 1. Mapeo bidireccional Tarea/Test <-> Criterios
  const taskCriteriaMap = {};
  const testCriteriaMap = {};
  const criteriaActivitiesMap = {};

  // Inicializar mapa de criterios
  criteriaList.forEach(c => {
    criteriaActivitiesMap[c.crit] = {
      tasks: [],
      tests: []
    };
  });

  // Mapear Tareas
  tasks.forEach(t => {
    const crits = getCriteriaForTask(t, criteriaMapping);
    taskCriteriaMap[t.id] = crits;
    crits.forEach(cKey => {
      if (!criteriaActivitiesMap[cKey]) {
        criteriaActivitiesMap[cKey] = { tasks: [], tests: [] };
      }
      criteriaActivitiesMap[cKey].tasks.push(t);
    });
  });

  // Mapear Tests de repaso
  actualReviewTests.forEach(top => {
    const crits = getCriteriaForTest(top.id, criteriaMapping);
    testCriteriaMap[top.id] = crits;
    crits.forEach(cKey => {
      if (!criteriaActivitiesMap[cKey]) {
        criteriaActivitiesMap[cKey] = { tasks: [], tests: [] };
      }
      criteriaActivitiesMap[cKey].tests.push(top);
    });
  });

  // 2. Extraer lista de Competencias Específicas presentes en los criterios
  const ceKeys = Array.from(new Set(criteriaList.map(c => c.crit.split('.')[0]))).sort((a, b) => Number(a) - Number(b));
  const competencies = ceKeys.map(ceKey => {
    const def = compDefs[ceKey] || { code: `CE ${ceKey}`, name: `Competencia Específica ${ceKey}`, short: `CE ${ceKey}`, icon: '📌' };
    const relatedCriteria = criteriaList.filter(c => c.crit.split('.')[0] === ceKey);
    return {
      key: ceKey,
      ...def,
      criteria: relatedCriteria
    };
  });

  // 3. Estructura de resultados por alumno
  const studentRows = activeMembers.map(m => {
    const sid = m.uid || m.id || m.student_id;
    const displayName = m.displayNameAnonymized || m.displayName || m.display_name_anon || m.display_name || m.name || (m.email ? m.email.split('@')[0] : 'Alumno');
    const photo = m.photoURL || m.avatar || `https://api.dicebear.com/7.x/bottts/svg?seed=${sid}`;

    // Conjunto de identificadores válidos para este alumno (soporta UIDs legacy de Firebase y Supabase)
    const aliases = new Set([
      sid,
      m.uid,
      m.id,
      m.student_id,
      ...(studentIdAliases[sid] || []),
      ...(studentIdAliases[m.uid] || []),
      ...(studentIdAliases[m.id] || [])
    ].filter(Boolean));

    // A) Notas por Tarea (Classroom + Juegos evaluables)
    const taskGrades = {};
    let gradedTasksCount = 0;

    tasks.forEach(t => {
      const associatedGameId = getGameIdForTask(t);
      const isGame = Boolean(associatedGameId);

      // 1º Comprobar si el docente ha calificado la tarea manualmente con rúbrica
      let gEntry = null;
      for (const alias of aliases) {
        if (offlineGrades[t.id] && offlineGrades[t.id][alias]) {
          gEntry = offlineGrades[t.id][alias];
          break;
        }
      }

      const hasManualGrade = gEntry && typeof gEntry.finalGrade === 'number' && !isNaN(gEntry.finalGrade);

      let val = null;
      let source = 'none';
      let feedback = gEntry?.feedback || gEntry?.teacherFeedback || '';
      let updatedAt = gEntry?.updatedAt || gEntry?.updated_at || null;
      let gameScoreInfo = null;

      if (hasManualGrade) {
        // Prevalece la rúbrica manual del docente
        val = Number(gEntry.finalGrade);
        source = 'teacher_rubric';
      } else if (isGame) {
        // 2º Si es tarea de juego y no hay nota manual, buscar en partidas jugadas (game_results)
        const matchingPlays = gameResults.filter(r => {
          const rSid = r.student_id || r.studentId || r.uid;
          const rGid = normalizeGameId(r.game_id || r.gameId);
          return aliases.has(rSid) && rGid === associatedGameId && !r.forced_fail;
        });

        if (matchingPlays.length > 0) {
          // Tomar la mejor puntuación histórica obtenida por el alumno en ese juego
          const bestScore = Math.max(...matchingPlays.map(p => Number(p.score) || 0));
          const latestPlay = matchingPlays.reduce((acc, p) => getTimestampMs(p) > getTimestampMs(acc) ? p : acc, matchingPlays[0]);

          // Puntuación objetivo (si hay assignment de aula específico se respeta)
          const asg = assignments.find(a => normalizeGameId(a.game_id || a.gameId) === associatedGameId);
          const targetScore = Number(asg?.targetScore || asg?.target_score) || DEFAULT_GAME_TARGET_SCORES[associatedGameId] || 100;

          val = scoreToGrade(bestScore, targetScore);
          source = 'game_result';
          gameScoreInfo = `${bestScore} / ${targetScore} pts`;
          updatedAt = latestPlay.created_at || latestPlay.timestamp || null;
          if (!feedback) {
            feedback = `Puntuación juego: ${bestScore} pts (Objetivo 10/10: ${targetScore} pts)`;
          }
        }
      }

      if (val !== null) gradedTasksCount++;

      taskGrades[t.id] = {
        taskId: t.id,
        title: t.title || `Tarea ${t.id}`,
        grade: val,
        source,
        feedback,
        updatedAt,
        isGame,
        gameId: associatedGameId,
        gameScoreInfo
      };
    });

    // B) Notas por Test de Repaso del Temario (SIEMPRE el último intento)
    const testGrades = {};
    let gradedTestsCount = 0;

    actualReviewTests.forEach(top => {
      const normTopId = normalizeTopicId(top.id);

      // Filtrar todos los intentos de este alumno para este tema
      const studentAttempts = topicTestResults.filter(r => {
        const rSid = r.student_id || r.studentId || r.uid;
        const rTid = normalizeTopicId(r.topic_id || r.topicId);
        return aliases.has(rSid) && rTid === normTopId;
      });

      if (studentAttempts.length > 0) {
        // Ordenar por fecha de forma descendente (el más reciente primero)
        studentAttempts.sort((a, b) => getTimestampMs(b) - getTimestampMs(a));
        const latestAttempt = studentAttempts[0];

        const rawScore = latestAttempt.score !== undefined && latestAttempt.score !== null
          ? latestAttempt.score
          : (latestAttempt.finalScore !== undefined ? latestAttempt.finalScore : latestAttempt.raw_score);

        const normalizedScore = normalizeTestScore(rawScore, latestAttempt.max_possible);

        if (normalizedScore !== null) {
          gradedTestsCount++;
          testGrades[top.id] = {
            topicId: top.id,
            title: top.title || top.name,
            grade: normalizedScore,
            rawScore,
            maxPossible: latestAttempt.max_possible || 10,
            attemptDate: latestAttempt.created_at || latestAttempt.fecha || latestAttempt.timestamp || null,
            attemptsCount: studentAttempts.length,
            isLatest: true
          };
        } else {
          testGrades[top.id] = {
            topicId: top.id,
            title: top.title || top.name,
            grade: null,
            attemptDate: null,
            attemptsCount: studentAttempts.length,
            isLatest: false
          };
        }
      } else {
        testGrades[top.id] = {
          topicId: top.id,
          title: top.title || top.name,
          grade: null,
          attemptDate: null,
          attemptsCount: 0,
          isLatest: false
        };
      }
    });

    // C) Notas por Criterio (Media de tareas + tests de repaso vinculados que estén evaluados)
    const criteriaGrades = {};
    let criteriaSum = 0;
    let criteriaCount = 0;
    let criteriaPassed = 0;
    let criteriaFailed = 0;

    criteriaList.forEach(c => {
      const links = criteriaActivitiesMap[c.crit] || { tasks: [], tests: [] };
      const evaluatedGrades = [];

      // Calificaciones de tareas vinculadas
      links.tasks.forEach(t => {
        const tg = taskGrades[t.id]?.grade;
        if (tg !== null && tg !== undefined) {
          evaluatedGrades.push({ grade: tg, activity: t, type: 'task' });
        }
      });

      // Calificaciones de tests de repaso vinculados (último intento)
      links.tests.forEach(top => {
        const tstg = testGrades[top.id]?.grade;
        if (tstg !== null && tstg !== undefined) {
          evaluatedGrades.push({ grade: tstg, activity: top, type: 'test' });
        }
      });

      const totalLinkedCount = links.tasks.length + links.tests.length;

      if (evaluatedGrades.length > 0) {
        const sum = evaluatedGrades.reduce((acc, v) => acc + v.grade, 0);
        const avg = Math.round((sum / evaluatedGrades.length) * 100) / 100;

        criteriaGrades[c.crit] = {
          grade: avg,
          evaluatedActivitiesCount: evaluatedGrades.length,
          totalLinkedActivitiesCount: totalLinkedCount,
          evaluatedTasksCount: evaluatedGrades.filter(e => e.type === 'task').length,
          evaluatedTestsCount: evaluatedGrades.filter(e => e.type === 'test').length
        };

        criteriaSum += avg;
        criteriaCount++;
        if (avg >= 5.0) criteriaPassed++;
        else criteriaFailed++;
      } else {
        criteriaGrades[c.crit] = {
          grade: null,
          evaluatedActivitiesCount: 0,
          totalLinkedActivitiesCount: totalLinkedCount,
          evaluatedTasksCount: 0,
          evaluatedTestsCount: 0
        };
      }
    });

    // D) Notas por Competencia Específica (Media de criterios evaluados de esa CE)
    const compGrades = {};
    let ceSum = 0;
    let ceEvaluatedCount = 0;

    competencies.forEach(comp => {
      const ceCrits = comp.criteria;
      const ceGradesList = [];

      ceCrits.forEach(c => {
        const cg = criteriaGrades[c.crit]?.grade;
        if (cg !== null && cg !== undefined) {
          ceGradesList.push(cg);
        }
      });

      if (ceGradesList.length > 0) {
        const ceAvg = Math.round((ceGradesList.reduce((acc, v) => acc + v, 0) / ceGradesList.length) * 100) / 100;
        compGrades[comp.key] = {
          grade: ceAvg,
          evaluatedCriteriaCount: ceGradesList.length,
          totalCriteriaCount: ceCrits.length
        };
        ceSum += ceAvg;
        ceEvaluatedCount++;
      } else {
        compGrades[comp.key] = {
          grade: null,
          evaluatedCriteriaCount: 0,
          totalCriteriaCount: ceCrits.length
        };
      }
    });

    // E) Nota Global LOMLOE del Alumno (Media de las Competencias Específicas evaluadas)
    let globalGrade = null;
    if (ceEvaluatedCount > 0) {
      globalGrade = Math.round((ceSum / ceEvaluatedCount) * 100) / 100;
    }

    const qualitative = getQualitativeGrade(globalGrade);
    const totalActivitiesCount = tasks.length + actualReviewTests.length;
    const totalGradedCount = gradedTasksCount + gradedTestsCount;
    const progressPct = totalActivitiesCount > 0 ? Math.round((totalGradedCount / totalActivitiesCount) * 100) : 0;

    return {
      studentId: sid,
      displayName,
      photoURL: photo,
      email: m.email || '',
      taskGrades,
      testGrades,
      criteriaGrades,
      compGrades,
      globalGrade,
      qualitative,
      gradedTasksCount,
      totalTasksCount: tasks.length,
      gradedTestsCount,
      totalTestsCount: actualReviewTests.length,
      gradedActivitiesCount: totalGradedCount,
      totalActivitiesCount,
      progressPct,
      criteriaPassed,
      criteriaFailed,
      criteriaCount
    };
  });

  // 4. Estadísticas del Grupo de Aula
  let classGlobalSum = 0;
  let studentsWithGrade = 0;
  let studentsPassed = 0;

  studentRows.forEach(sr => {
    if (sr.globalGrade !== null) {
      classGlobalSum += sr.globalGrade;
      studentsWithGrade++;
      if (sr.globalGrade >= 5.0) {
        studentsPassed++;
      }
    }
  });

  const classAverage = studentsWithGrade > 0
    ? Math.round((classGlobalSum / studentsWithGrade) * 100) / 100
    : null;
  const passRate = studentsWithGrade > 0
    ? Math.round((studentsPassed / studentsWithGrade) * 100)
    : 0;

  // Promedios por criterio para detectar "Criterios a reforzar"
  const criteriaAverages = criteriaList.map(c => {
    let sum = 0;
    let count = 0;
    studentRows.forEach(sr => {
      const g = sr.criteriaGrades[c.crit]?.grade;
      if (g !== null && g !== undefined) {
        sum += g;
        count++;
      }
    });
    const avg = count > 0 ? Math.round((sum / count) * 100) / 100 : null;
    return {
      crit: c.crit,
      text: c.text,
      block: c.block,
      average: avg,
      evaluatedStudents: count
    };
  });

  // Criterios ordenados por menor nota media (los que tienen nota y están peor)
  const criteriaToReinforce = criteriaAverages
    .filter(ca => ca.average !== null && ca.average < 6.0)
    .sort((a, b) => a.average - b.average);

  // Catálogo unificado de actividades para vistas y exportación
  const activities = [
    ...tasks.map(t => ({
      id: t.id,
      key: `task:${t.id}`,
      type: 'task',
      title: t.title || `Tarea ${t.id}`,
      icon: getGameIdForTask(t) ? '🕹️' : '📝',
      isGame: Boolean(getGameIdForTask(t)),
      gameId: getGameIdForTask(t)
    })),
    ...actualReviewTests.map(top => ({
      id: top.id,
      key: `test:${top.id}`,
      type: 'test',
      title: top.title || top.name,
      icon: '📖',
      isGame: false,
      gameId: null
    }))
  ];

  return {
    subjectId: normSubject,
    level,
    tasks,
    reviewTests: actualReviewTests,
    activities,
    criteriaList,
    competencies,
    studentRows,
    stats: {
      totalStudents: activeMembers.length,
      studentsWithGrade,
      classAverage,
      passRate,
      criteriaToReinforce,
      totalTasksCount: tasks.length,
      totalTestsCount: actualReviewTests.length,
      totalActivitiesCount: activities.length
    }
  };
}

/**
 * Genera exportación CSV formateada para Séneca / Excel del Cuaderno Docente
 */
export function exportGradebookCSV(calculatedGradebook, mode = 'competencies') {
  if (!calculatedGradebook || !calculatedGradebook.studentRows) return '';

  const { studentRows, competencies, criteriaList, tasks, reviewTests, activities } = calculatedGradebook;
  const delimiter = ';';
  const lines = [];

  if (mode === 'competencies') {
    // Modo 1: Competencias Específicas + Nota Global
    const header = [
      'Alumno',
      'Correo',
      ...competencies.map(c => `"${c.code}: ${c.name.replace(/"/g, '""')}"`),
      'Nota Global',
      'Calificación LOMLOE'
    ];
    lines.push(header.join(delimiter));

    studentRows.forEach(sr => {
      const row = [
        `"${sr.displayName.replace(/"/g, '""')}"`,
        `"${sr.email}"`,
        ...competencies.map(c => {
          const g = sr.compGrades[c.key]?.grade;
          return g !== null && g !== undefined ? String(g).replace('.', ',') : '';
        }),
        sr.globalGrade !== null ? String(sr.globalGrade).replace('.', ',') : '',
        `"${sr.qualitative.label} (${sr.qualitative.code})"`
      ];
      lines.push(row.join(delimiter));
    });

  } else if (mode === 'criteria') {
    // Modo 2: Criterios LOMLOE detallados
    const header = [
      'Alumno',
      'Correo',
      ...criteriaList.map(c => `"Crit. ${c.crit}: ${(c.text || '').slice(0, 50).replace(/"/g, '""')}..."`),
      'Nota Global',
      'Calificación'
    ];
    lines.push(header.join(delimiter));

    studentRows.forEach(sr => {
      const row = [
        `"${sr.displayName.replace(/"/g, '""')}"`,
        `"${sr.email}"`,
        ...criteriaList.map(c => {
          const g = sr.criteriaGrades[c.crit]?.grade;
          return g !== null && g !== undefined ? String(g).replace('.', ',') : '';
        }),
        sr.globalGrade !== null ? String(sr.globalGrade).replace('.', ',') : '',
        `"${sr.qualitative.code}"`
      ];
      lines.push(row.join(delimiter));
    });

  } else {
    // Modo 3: Sábana de Actividades (Tareas de Aula, Tareas de Juegos y Tests de Repaso)
    const taskHeaders = tasks.map(t => {
      const isGame = getGameIdForTask(t);
      const prefix = isGame ? '[Juego]' : '[Tarea]';
      return `"${prefix} ${(t.title || `Tarea ${t.id}`).replace(/"/g, '""')}"`;
    });

    const testHeaders = (reviewTests || []).map(top => {
      return `"[Test Repaso] ${(top.title || top.name).replace(/"/g, '""')}"`;
    });

    const header = [
      'Alumno',
      'Correo',
      ...taskHeaders,
      ...testHeaders,
      '% Completadas',
      'Nota Global'
    ];
    lines.push(header.join(delimiter));

    studentRows.forEach(sr => {
      const taskValues = tasks.map(t => {
        const g = sr.taskGrades[t.id]?.grade;
        return g !== null && g !== undefined ? String(g).replace('.', ',') : '';
      });

      const testValues = (reviewTests || []).map(top => {
        const g = sr.testGrades[top.id]?.grade;
        return g !== null && g !== undefined ? String(g).replace('.', ',') : '';
      });

      const row = [
        `"${sr.displayName.replace(/"/g, '""')}"`,
        `"${sr.email}"`,
        ...taskValues,
        ...testValues,
        `"${sr.progressPct}%"`,
        sr.globalGrade !== null ? String(sr.globalGrade).replace('.', ',') : ''
      ];
      lines.push(row.join(delimiter));
    });
  }

  return '\uFEFF' + lines.join('\r\n');
}
