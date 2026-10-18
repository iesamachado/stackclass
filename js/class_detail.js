import { requireAuth, currentUser, currentProfile, classroomToken, refreshClassroomToken, isAdmin } from './common/auth.js';
import { CLASSROOM_TASKS, TIC2_CLASSROOM_TASKS, CYR_CLASSROOM_TASKS, OFFLINE_RUBRIC } from './common/tasks.js';
import {
  getClass, updateClass, getClassMembers, getClassAssignments,
  toggleGameInClass, toggleTopicInClass, createAssignment, updateAssignment, deleteAssignment,
  getClassRanking, addStudentsToClass, removeStudentFromClass, getStudentResultsInClass,
  getStudentBestScore, getUserProfile
} from './common/db.js';
import { createClassroomAssignment, syncClassroomGrades } from './common/classroom.js';
import { renderHeader, showToast, showLoading, hideLoading, renderPodium, renderRankingTable } from './common/ui.js';
import { GAMES, TOPICS, COURSES, $, $$, escapeHtml, formatDate, getUrlParams, copyToClipboard } from './common/utils.js';
import { getGuildsForSubject, getMedalsForSubject, loadGuilds, initGamification, MEDAL_XP, getLeague } from './common/gamification.js';
import { collection, query, where, getDocs, getDoc, addDoc, updateDoc, deleteDoc, doc, onSnapshot, serverTimestamp, db } from './common/firebase-config.js';
import {
  getCurriculumCriteria,
  getCurriculumActivities,
  getEffectiveCriteriaMapping,
  hasCustomMapping,
  exportCurriculumMatrixCSV
} from './common/curriculum-matrix.js';
import { supabase } from './common/supabase-config.js';
import {
  calculateGradebook,
  exportGradebookCSV,
  getQualitativeGrade,
  getCriteriaForTask,
  getCriteriaForTest,
  getGameIdForTask,
  getSubjectReviewTests
} from './common/gradebook-calc.js';

let classData = null;
let members   = [];
let activeTab = 'games';
let activeGameFilter = '';
let studentsSortOrder = 'alpha';
let rankingInterval = null;

// ── Guard ───────────────────────────────────────────────────────
requireAuth({
  allowedRoles: ['teacher'],
  onAuthorized: async (user, profile) => {
    renderHeader(user, profile);
    const { classId } = getUrlParams();
    if (!classId) { window.location.href = 'dashboard_teacher.html'; return; }

    try {
      classData = await getClass(classId);
      const uid = user.id || user.uid;
      const isOwner = classData && ((classData.teacherId || classData.teacher_id) === uid);
      const userIsAdmin = isAdmin(user, profile);

      if (!classData || (!isOwner && !userIsAdmin)) {
        showToast('Acceso denegado', 'No tienes acceso a esta clase.', 'error');
        setTimeout(() => window.location.href = 'dashboard_teacher.html', 2000);
        return;
      }

      initPage(user, profile);
      initGamification().catch(e => console.warn('Gamification init error:', e));
      await loadGamesTab();
      await loadTopicsTab();
    } catch (err) {
      console.error(err);
      showToast('Error', 'No se pudo cargar la clase.', 'error');
    }
  }
});

// ── Inicialización ──────────────────────────────────────────────
function initPage(user, profile) {
  // Cabecera
  $('class-name').textContent = classData.name;
  const pinBtn = $('class-pin');
  if (pinBtn) {
    pinBtn.textContent = `📋 ${classData.pin}`;
    pinBtn.addEventListener('click', async () => {
      await copyToClipboard(classData.pin);
      showToast('PIN copiado', classData.pin, 'success', 2000);
    });
  }
  if (classData.classroomCourseId) {
    $('classroom-link-meta')?.style && ($('classroom-link-meta').style.display = 'flex');
  }

  const classSubj = classData.subject_id || classData.subjectId || 'cyr';
  const course = COURSES[classSubj];
  const subjectBadge = $('class-subject-badge');
  if (subjectBadge && course) {
    const levelText = classData.level ? (classSubj === 'tic2' && String(classData.level) === '2' ? '2º Bach' : `${classData.level}º ESO`) : course.level;
    subjectBadge.textContent = `${course.icon} ${course.shortName} (${levelText})`;
    subjectBadge.style.background = `${course.color}20`;
    subjectBadge.style.color = course.colorDark || course.color;
    subjectBadge.style.display = 'inline-flex';
  }

  const evalBtn = $('btn-eval-class');
  if (evalBtn && classSubj) {
    evalBtn.href = `evaluation.html?subject=${encodeURIComponent(classSubj)}`;
  }

  // Tabs
  $$('.tab-btn').forEach(btn => {
    btn.addEventListener('click', async () => {
      $$('.tab-btn').forEach(b => b.classList.remove('tab-btn--active'));
      btn.classList.add('tab-btn--active');
      $$('.tab-content').forEach(s => s.style.display = 'none');
      const tab = btn.dataset.tab;
      $(`tab-${tab}`).style.display = 'block';
      activeTab = tab;
      localStorage.setItem('classDetailTab', tab);
      
      if (rankingInterval) {
          clearInterval(rankingInterval);
          rankingInterval = null;
      }

      if (tab === 'students')    await loadStudentsTab();
      if (tab === 'assignments') await loadAssignmentsTab();
      if (tab === 'guilds')      await loadGuildsTab();
      if (tab === 'exams')       await loadExamsTab();
      if (tab === 'offline_tasks') await loadOfflineTasksTab();
      if (tab === 'gradebook') await loadGradebookTab();
      if (tab === 'curriculum_matrix') await loadCurriculumMatrixTab();
      if (tab === 'results') {
          await loadResultsTab();
          rankingInterval = setInterval(() => {
              if (activeTab === 'results') renderResults(false);
          }, 10000);
      }
    });
  });

  // Restore active tab (prefer URL param ?tab=... over localStorage)
  const urlParams = getUrlParams();
  const storedTab = urlParams.tab || localStorage.getItem('classDetailTab') || 'games';
  setTimeout(() => {
      const initialBtn = document.querySelector(`.tab-btn[data-tab="${storedTab}"]`);
      if (initialBtn) initialBtn.click();
  }, 100);

  setupModals(user);
}

// ══════════════════════════════════════════════════════════════
//  TAB: JUEGOS
// ══════════════════════════════════════════════════════════════

async function loadGamesTab() {
  const list = $('games-toggle-list');
  if (!list) return;

  const enabled = classData.enabledGames || [];
  const classSubject = classData.subject_id || classData.subjectId;
  const allGames = Object.values(GAMES);

  const subjectGames = classSubject ? allGames.filter(g => g.subjectId === classSubject) : allGames;
  const otherGames = classSubject ? allGames.filter(g => g.subjectId !== classSubject) : [];

  function renderGameRow(g, badge = null) {
    const isChecked = enabled.includes(g.id);
    return `
      <div class="game-toggle-row" id="game-row-${g.id}">
        <div class="game-toggle-info">
          <span class="game-toggle-icon">${g.icon}</span>
          <div>
            <div style="display:flex; align-items:center; gap:8px;">
              <strong>${escapeHtml(g.name)}</strong>
              ${badge ? `<span class="badge badge--ghost" style="font-size:0.7rem; padding:2px 6px;">${escapeHtml(badge)}</span>` : ''}
            </div>
            <small>${escapeHtml(g.description || '')}</small>
          </div>
        </div>
        <div class="game-toggle-actions">
          <a class="btn btn-ghost btn--sm" href="${g.gamePath}?classId=${classData.id}" target="_blank">🎮 Probar</a>
          <label class="toggle-switch" title="${isChecked ? 'Desactivar' : 'Activar'}">
            <input type="checkbox" 
                   id="toggle-${g.id}"
                   data-game-id="${g.id}"
                   ${isChecked ? 'checked' : ''}>
            <span class="toggle-slider"></span>
          </label>
        </div>
      </div>`;
  }

  let html = subjectGames.map(g => renderGameRow(g)).join('');

  if (otherGames.length > 0) {
    const activeOtherCount = otherGames.filter(g => enabled.includes(g.id)).length;
    html += `
      <details class="more-games-details" style="margin-top:var(--space-4); border:1px solid var(--border); border-radius:var(--radius-md); background:var(--bg-surface); overflow:hidden;">
        <summary style="cursor:pointer; font-weight:600; padding:var(--space-3) var(--space-4); background:var(--bg-body); display:flex; align-items:center; justify-content:space-between; user-select:none;">
          <span style="display:flex; align-items:center; gap:8px;">
            🎮 Más juegos (Otras asignaturas)
            <span class="badge badge--ghost" style="font-size:0.75rem;">${otherGames.length}</span>
          </span>
          <span id="other-games-count-label" style="font-size:var(--text-xs); color:var(--text-muted); font-weight:normal;">
            ${activeOtherCount > 0 ? `(${activeOtherCount} activado${activeOtherCount > 1 ? 's' : ''})` : 'Plegado'} ▾
          </span>
        </summary>
        <div style="padding:var(--space-3); display:flex; flex-direction:column; gap:var(--space-1);">
          <p class="form-hint" style="margin-bottom:var(--space-2); font-size:var(--text-xs);">
            Juegos de otras asignaturas que puedes habilitar para esta clase bajo tu criterio:
          </p>
          ${otherGames.map(g => {
            const course = COURSES?.[g.subjectId];
            const badgeText = course ? course.shortName : (g.subjectId || '').toUpperCase();
            return renderGameRow(g, badgeText);
          }).join('')}
        </div>
      </details>
    `;
  }

  list.innerHTML = html;

  // Eventos toggle
  $$('[data-game-id]').forEach(input => {
    input.addEventListener('change', async () => {
      const gameId = input.dataset.gameId;
      const active = input.checked;
      try {
        await toggleGameInClass(classData.id, gameId, active);
        if (active) {
          classData.enabledGames = [...(classData.enabledGames || []), gameId];
        } else {
          classData.enabledGames = (classData.enabledGames || []).filter(g => g !== gameId);
        }

        // Actualizar contador visual si el juego pertenece a 'otherGames'
        const countLabel = $('other-games-count-label');
        if (countLabel && otherGames.length > 0) {
          const currentActiveOther = otherGames.filter(g => classData.enabledGames.includes(g.id)).length;
          countLabel.textContent = currentActiveOther > 0 ? `(${currentActiveOther} activado${currentActiveOther > 1 ? 's' : ''}) ▾` : 'Plegado ▾';
        }

        showToast(
          active ? `${GAMES[gameId].icon} ${GAMES[gameId].name} activado` : `${GAMES[gameId].name} desactivado`,
          '',
          active ? 'success' : 'info',
          2000
        );
      } catch (err) {
        input.checked = !active; // Revertir
        showToast('Error', err.message, 'error');
      }
    });
  });
}

// ══════════════════════════════════════════════════════════════
//  TAB: TEMARIO Y JUEGOS (sección temas)
// ══════════════════════════════════════════════════════════════

async function loadTopicsTab() {
  const list = $('topics-toggle-list');
  if (!list) return;

  const enabled = classData.enabledTopics || [];
  const classSubject = classData.subject_id || classData.subjectId;
  const filteredTopics = Object.values(TOPICS).filter(t => !classSubject || t.subjectId === classSubject);

  if (filteredTopics.length === 0) {
    list.innerHTML = `<p class="empty-state" style="padding:var(--space-4); text-align:center;">No hay bloques temáticos configurados para esta asignatura.</p>`;
    return;
  }

  list.innerHTML = filteredTopics.map(t => `
    <div class="game-toggle-row" id="topic-row-${t.id}">
      <div class="game-toggle-info">
        <span class="game-toggle-icon">${t.icon}</span>
        <div>
          <strong>${escapeHtml(t.name)}</strong>
          <small>${escapeHtml(t.description || '')}</small>
        </div>
      </div>
      <div class="game-toggle-actions" style="display:flex; align-items:center; gap: 15px;">
        <a href="${t.htmlPath}" target="_blank" class="btn btn-ghost btn--sm" style="text-decoration:none; display:flex; align-items:center; gap:5px;" title="Ver contenido del bloque">
          👁️ Ver
        </a>
        <label class="toggle-switch" title="${enabled.includes(t.id) ? 'Ocultar a alumnos' : 'Mostrar a alumnos'}">
          <input type="checkbox" 
                 id="toggle-topic-${t.id}"
                 data-topic-id="${t.id}"
                 ${enabled.includes(t.id) ? 'checked' : ''}>
          <span class="toggle-slider"></span>
        </label>
      </div>
    </div>`).join('');

  // Eventos toggle para temas
  $$('[data-topic-id]').forEach(input => {
    input.addEventListener('change', async () => {
      const topicId = input.dataset.topicId;
      const active = input.checked;
      try {
        await toggleTopicInClass(classData.id, topicId, active);
        if (active) {
          classData.enabledTopics = [...(classData.enabledTopics || []), topicId];
        } else {
          classData.enabledTopics = (classData.enabledTopics || []).filter(t => t !== topicId);
        }
        showToast(
          active ? `${TOPICS[topicId].icon} ${TOPICS[topicId].name} activado` : `${TOPICS[topicId].name} desactivado`,
          '',
          active ? 'success' : 'info',
          2000
        );
      } catch (err) {
        input.checked = !active; // Revertir
        showToast('Error', err.message, 'error');
      }
    });
  });
}

// ══════════════════════════════════════════════════════════════
//  TAB: ALUMNOS
// ══════════════════════════════════════════════════════════════

async function loadStudentsTab() {
  const list = $('students-list');
  const noMsg = $('no-students');
  if (!list) return;

  try {
    members = await getClassMembers(classData.id);

    if (members.length === 0) {
      list.innerHTML = '';
      noMsg.style.display = 'block';
      return;
    }

    noMsg.style.display = 'none';
    
    if (studentsSortOrder === 'xp') {
      members.sort((a, b) => (b.puntosTotal || 0) - (a.puntosTotal || 0));
    } else {
      members.sort((a, b) => {
        const nameA = (a.displayNameAnonymized || a.displayName || a.name || a.email || '').toLowerCase();
        const nameB = (b.displayNameAnonymized || b.displayName || b.name || b.email || '').toLowerCase();
        return nameA.localeCompare(nameB);
      });
    }

    list.innerHTML = `
      <div class="students-list-header" style="display:flex; justify-content:space-between; align-items:center; margin-bottom:var(--space-3);">
        <span style="font-weight:bold;">${members.length} alumno${members.length !== 1 ? 's' : ''}</span>
        <div>
          <label style="font-size:0.85rem; color:var(--text-muted); margin-right:8px;" for="students-sort-select">Ordenar por:</label>
          <select id="students-sort-select" class="form-control form-control--sm" style="display:inline-block; width:auto;">
            <option value="alpha" ${studentsSortOrder === 'alpha' ? 'selected' : ''}>Alfabético</option>
            <option value="xp" ${studentsSortOrder === 'xp' ? 'selected' : ''}>XP Total</option>
          </select>
        </div>
      </div>
      <div class="students-list-body">
        ${members.map(m => renderStudentRow(m)).join('')}
      </div>`;
      
    document.getElementById('students-sort-select').addEventListener('change', async (e) => {
        studentsSortOrder = e.target.value;
        await loadStudentsTab();
    });

    if (typeof renderGamificationPodium === 'function') {
      renderGamificationPodium();
    }

    // Eventos de eliminación
    list.querySelectorAll('[data-action="remove-student"]').forEach(btn => {
      btn.addEventListener('click', async () => {
        const studentId = btn.dataset.studentId;
        const studentName = btn.dataset.studentName || 'este alumno';
        if (!confirm(`¿Eliminar a ${studentName} de la clase?`)) return;

        try {
          showLoading('Eliminando alumno...');
          await removeStudentFromClass(classData.id, studentId);
          showToast('Alumno eliminado', `${studentName} ya no pertenece a la clase.`, 'info');
          await loadStudentsTab();
        } catch (err) {
          showToast('Error', err.message, 'error');
        } finally {
          hideLoading();
        }
      });
    });

    // Eventos de historial
    list.querySelectorAll('[data-action="view-history"]').forEach(btn => {
      btn.addEventListener('click', () => {
        showStudentHistory(btn.dataset.studentId, btn.dataset.studentName || 'Alumno');
      });
    });
  } catch (err) {
    showToast('Error', err.message, 'error');
  }
}

function renderStudentRow(m) {
  const sid = m.uid || m.id || m.student_id;
  const displayName = m.displayNameAnonymized || m.displayName || m.display_name_anon || m.display_name || m.name || (m.email ? m.email.split('@')[0] : 'Alumno');
  const identifier = sid || m.email;

  if (m.pending) {
    return `<div class="student-row student-row--pending" style="display:flex; align-items:center; justify-content:space-between; gap:var(--space-3); padding:var(--space-3); border-bottom:1px solid var(--border);">
      <div style="display:flex; align-items:center; gap:var(--space-3);">
        <div class="student-row-avatar student-row-avatar--pending">⏳</div>
        <div class="student-row-info">
          <strong>${escapeHtml(m.name || m.email)}</strong>
          <small style="display:block; color:var(--text-muted);">${escapeHtml(m.email)} — <em>Pendiente de registro</em></small>
        </div>
      </div>
      <div style="display:flex; align-items:center; gap:var(--space-2);">
        <span class="badge badge--warning">Pendiente</span>
        <button class="btn btn-ghost btn--sm" data-action="remove-student" data-student-id="${escapeHtml(identifier)}" data-student-name="${escapeHtml(m.email)}" title="Eliminar de la clase" style="color:var(--error); padding:4px 8px;">
          🗑️
        </button>
      </div>
    </div>`;
  }

  const pts = m.puntosTotal ?? m.xp ?? 0;
  const gremioVal = m.gremio || m.guild_id;
  const classGuilds = getGuildsForSubject(classData?.subject_id);
  const foundGuild = gremioVal ? classGuilds.find(g => g.id === gremioVal || g.name === gremioVal) : null;
  const guildName = foundGuild ? `${foundGuild.icon || '🛡️'} ${foundGuild.name}` : (gremioVal ? `🛡️ ${gremioVal}` : '');
  const gremioInfo = guildName ? `<span class="badge" style="background:${foundGuild?.color ? foundGuild.color + '1a' : '#eee'}; color:${foundGuild?.color || '#333'}; border:1px solid ${foundGuild?.color ? foundGuild.color + '40' : '#ccc'}; font-weight:600;">${escapeHtml(guildName)}</span>` : '';
  const xpBadge = `<span class="badge badge--warning">⭐ ${pts} XP</span>`;
  const photo = m.photoURL || m.avatar || `https://api.dicebear.com/7.x/bottts/svg?seed=${sid}`;

  return `<div class="student-row" style="display:flex; align-items:center; justify-content:space-between; gap:var(--space-3); padding:var(--space-3); border-bottom:1px solid var(--border);">
    <div style="display:flex; align-items:center; gap:var(--space-3);">
      <img class="student-row-avatar"
           src="${escapeHtml(photo)}"
           alt="${escapeHtml(displayName)}"
           onerror="this.src='https://api.dicebear.com/7.x/bottts/svg?seed=${sid}'">
      <div class="student-row-info">
        <strong>${escapeHtml(displayName)}</strong>
        <small style="display:block; color:var(--text-muted);">${escapeHtml(m.email || '')}</small>
        <div style="margin-top:4px; display:flex; gap:4px;">${gremioInfo}${xpBadge}</div>
      </div>
    </div>
    <div style="display:flex; align-items:center; gap:var(--space-2);">
      <span class="badge ${m.source === 'classroom' ? 'badge--accent' : 'badge--muted'}">
        ${m.source === 'classroom' ? 'Classroom' : 'Directo / PIN'}
      </span>
      <button class="btn btn-ghost btn--sm" onclick="window._showMedallas('${escapeHtml(sid)}')" title="Ver medallas" style="padding:4px 8px;">
        🏅
      </button>
      <button class="btn btn-ghost btn--sm" data-action="view-history" data-student-id="${escapeHtml(sid)}" data-student-name="${escapeHtml(displayName)}" title="Ver historial de partidas" style="padding:4px 8px;">
        📊
      </button>
      <button class="btn btn-ghost btn--sm" data-action="remove-student" data-student-id="${escapeHtml(identifier)}" data-student-name="${escapeHtml(displayName)}" title="Eliminar de la clase" style="color:var(--error); padding:4px 8px;">
        🗑️
      </button>
    </div>
  </div>`;
}

async function showStudentHistory(studentId, studentName) {
  if (!studentId || studentId === 'undefined') {
    showToast('Error', 'ID de alumno no disponible.', 'error');
    return;
  }
  const GAME_NAMES = Object.fromEntries(Object.values(GAMES).map(g => [g.id, `${g.icon} ${g.name}`]));

  let modal = document.getElementById('modal-student-history');
  if (!modal) {
    modal = document.createElement('div');
    modal.id = 'modal-student-history';
    modal.className = 'modal-backdrop';
    modal.setAttribute('role', 'dialog');
    modal.setAttribute('aria-modal', 'true');
    modal.innerHTML = `
      <div class="modal-box" style="max-width:850px; width:95%;">
        <div class="modal-header">
          <h3 id="history-modal-title"></h3>
          <button class="modal-close" id="close-history-modal" aria-label="Cerrar">✕</button>
        </div>
        <div class="modal-body" style="padding:0; max-height: 70vh; overflow-y: auto;">
          <div id="history-modal-body" style="overflow-x:auto;"></div>
        </div>
      </div>`;
    document.body.appendChild(modal);
    document.getElementById('close-history-modal').addEventListener('click', () => modal.classList.remove('modal-backdrop--visible'));
    modal.addEventListener('click', e => { if (e.target === modal) modal.classList.remove('modal-backdrop--visible'); });
  }

  document.getElementById('history-modal-title').textContent = `📊 Actividad de ${studentName}`;
  document.getElementById('history-modal-body').innerHTML = '<div style="padding:32px; text-align:center;"><div class="spinner"></div> Calculando XP y cargando historial...</div>';
  modal.classList.add('modal-backdrop--visible');

  let timeline = [];
  try {
    const { computeGameXP } = await import('./common/gamification.js');
    
    let studentIds = [studentId];
    try {
      const { getLegacyStudentIds } = await import('./common/db.js');
      const leg = await getLegacyStudentIds(studentId);
      if (leg && leg.length > 0) studentIds.push(...leg);
    } catch (_) {}

    // 1. Juegos (globales para calcular XP correcta, pero luego marcamos si es de la clase)
    const snapGames = await getDocs(query(collection(db, 'game_results'), where('studentId', 'in', studentIds)));
    const games = snapGames.docs.map(d => ({ id: d.id, ...d.data() }));
    games.sort((a, b) => {
      const ta = a.timestamp?.seconds || (a.createdAt ? new Date(a.createdAt).getTime() / 1000 : 0);
      const tb = b.timestamp?.seconds || (b.createdAt ? new Date(b.createdAt).getTime() / 1000 : 0);
      return ta - tb;
    });
    
    const userGamesCount = {};
    const userMaxScores = {};
    const userTotalXP = {};
    games.forEach(r => {
      const gid = r.gameId;
      if (!userGamesCount[gid]) {
        userGamesCount[gid] = 0;
        userMaxScores[gid] = 0;
        userTotalXP[gid] = 0;
      }
      userGamesCount[gid]++;
      const nPartidas = userGamesCount[gid];
      
      const previousMaxScore = nPartidas > 1 ? userMaxScores[gid] : 0;
      
      let xp = computeGameXP(gid, r.score, nPartidas, previousMaxScore);
      
      if (userTotalXP[gid] + xp > 750) {
         xp = Math.max(0, 750 - userTotalXP[gid]);
      }
      userTotalXP[gid] += xp;
      
      if (r.score > userMaxScores[gid]) {
        userMaxScores[gid] = r.score;
      }
      
      timeline.push({
        type: 'game',
        classId: r.classId,
        title: GAME_NAMES[gid] || gid,
        scoreInfo: `Puntos: ${r.score}`,
        metadata: r.metadata,
        xp: xp,
        timestamp: r.timestamp?.toDate ? r.timestamp.toDate() : (r.createdAt ? new Date(r.createdAt) : new Date(0))
      });
    });

    // 2. Tests de Repaso
    const snapTests = await getDocs(query(collection(db, 'test_teoria_respuestas'), where('uid', 'in', studentIds)));
    const tests = snapTests.docs.map(d => d.data());
    tests.sort((a, b) => {
      const ta = a.fecha?.seconds || (a.createdAt ? new Date(a.createdAt).getTime() / 1000 : 0);
      const tb = b.fecha?.seconds || (b.createdAt ? new Date(b.createdAt).getTime() / 1000 : 0);
      return ta - tb;
    });
    
    const userTestsState = {};
    tests.forEach(r => {
      const topicId = r.topicId;
      const score = r.score;
      if (!userTestsState[topicId]) userTestsState[topicId] = { passed: false, outstanding: false, count: 0 };
      const state = userTestsState[topicId];
      let xp = 0;
      if (score < 3) {
         xp = 0;
      } else {
        if (state.count === 0) {
           xp = 5;
           if (score >= 5) xp += 5;
           if (score > 9) xp += 5;
        } else {
           xp = 2;
           if (score >= 5) xp += state.passed ? 1 : 5;
           if (score > 9) xp += state.outstanding ? 1 : 5;
        }
      }
      if (score >= 5) state.passed = true;
      if (score > 9) state.outstanding = true;
      state.count++;
      
      timeline.push({
        type: 'test',
        classId: null, // Global
        title: `📝 Test Repaso (${topicId})`,
        scoreInfo: `Nota: ${score}/10`,
        metadata: null,
        xp: xp,
        timestamp: r.fecha?.toDate ? r.fecha.toDate() : (r.createdAt ? new Date(r.createdAt) : new Date(0))
      });
    });
    
    // 3. Exámenes
    const snapExams = await getDocs(query(collection(db, 'respuestas_test'), where('uid', 'in', studentIds)));
    snapExams.forEach(d => {
      const r = d.data();
      if (!r.calculado || r.calculado.nota === undefined) return;
      const nota = r.calculado.nota;
      let xp = 5 + (nota >= 5 ? 5 : 0) + (nota > 9 ? 5 : 0);
      
      timeline.push({
        type: 'exam',
        classId: r.classId || null,
        title: `📄 Examen`,
        scoreInfo: `Nota: ${nota.toFixed(2)}/10`,
        metadata: null,
        xp: xp,
        timestamp: r.fecha?.toDate ? r.fecha.toDate() : (r.createdAt ? new Date(r.createdAt) : new Date(0))
      });
    });
    
    // 4. Tareas Offline
    const snapOffline = await getDocs(query(collection(db, 'offline_grades'), where('studentId', 'in', studentIds)));
    snapOffline.forEach(d => {
      const r = d.data();
      if (r.finalGrade === undefined) return;
      let xp = Math.round(r.finalGrade * 15);
      
      const taskObj = CLASSROOM_TASKS.find(t => t.id === r.taskId);
      const taskName = taskObj ? taskObj.title : r.taskId;
      
      timeline.push({
        type: 'offline',
        classId: r.classId,
        title: `📁 Tarea: ${taskName}`,
        scoreInfo: `Nota: ${r.finalGrade}/10`,
        metadata: null,
        xp: xp,
        timestamp: r.updatedAt?.toDate ? r.updatedAt.toDate() : (r.updated_at ? new Date(r.updated_at) : new Date(0))
      });
    });

    // 5. Medallas Obtenidas
    const userSnap = await getDoc(doc(db, 'users', studentId));
    const userData = userSnap.data() || {};
    const userLogros = userData.logros || userData.medals || [];
    const subjectMedals = getMedalsForSubject(classData?.subject_id) || [];
    
    userLogros.forEach(medal => {
        const medalId = typeof medal === 'string' ? medal : (medal.id || medal.medal_id);
        const meta = (typeof medal === 'object' && medal.name) ? medal : (subjectMedals.find(m => m.id === medalId) || { name: medalId, icon: '🏅', desc: '' });
        const extraXP = medal.xp_value || MEDAL_XP[medalId] || meta.xp || 0;
        timeline.push({
            type: 'medal',
            title: `🏅 Medalla: ${meta.icon || '🏅'} ${meta.name || medalId}`,
            scoreInfo: meta.desc || medal.desc || '',
            metadata: null,
            xp: extraXP,
            timestamp: medal.fecha ? new Date(medal.fecha) : new Date(0)
        });
    });
    timeline.sort((a, b) => b.timestamp - a.timestamp);

  } catch(e) {
    console.error('Error cargando historial:', e);
    document.getElementById('history-modal-body').innerHTML = `<div style="padding:24px; text-align:center; color:var(--error);">⚠️ Error al cargar: ${escapeHtml(e.message)}</div>`;
    return;
  }

  const rows = timeline.length === 0
    ? '<tr><td colspan="5" style="text-align:center;color:var(--text-muted);padding:16px;">Sin actividad registrada.</td></tr>'
    : timeline.map(r => {
        const dateStr = r.timestamp.getTime() > 0 ? r.timestamp.toLocaleDateString('es-ES', { day:'2-digit', month:'short', year:'numeric', hour:'2-digit', minute:'2-digit' }) : '—';
        
        let detail = r.scoreInfo;
        if (r.type === 'game' && r.metadata) {
          const wpm = r.metadata.wpm ?? '—';
          const acc = r.metadata.accuracy != null ? r.metadata.accuracy + '%' : '—';
          if (wpm !== '—') detail += ` <small style="color:var(--text-muted)">(${wpm} PPM / ${acc})</small>`;
        }
        

        let xpBadge = '';
        if (r.type === 'medal') {
            xpBadge = `<span style="display:inline-block; padding:2px 8px; border-radius:12px; font-size:0.8rem; font-weight:bold; background:var(--warning-light); color:var(--warning); border: 1px solid var(--warning);">+${r.xp} XP</span>`;
        } else {
            xpBadge = `<span style="display:inline-block; padding:2px 8px; border-radius:12px; font-size:0.8rem; font-weight:bold; background:var(--primary-light); color:var(--primary);">+${r.xp} XP</span>`;
        }
        if (r.xp === 0) xpBadge = `<span style="color:var(--text-muted); font-size:0.85rem;">0 XP</span>`;

        // Si es de otra clase, lo ponemos un poco transparente
        const isCurrentClass = (r.type === 'test' || r.classId === classData.id);
        const opacity = isCurrentClass ? '1' : '0.6';
        const classNote = !isCurrentClass ? `<br><small style="color:var(--text-muted); font-size:0.7rem;">Otra clase</small>` : '';

        return `<tr style="border-bottom:1px solid var(--border); opacity:${opacity};">
          <td style="padding:10px 12px; font-weight:500;">${escapeHtml(r.title)}${classNote}</td>
          <td style="padding:10px 12px;">${detail}</td>
          <td style="padding:10px 12px; text-align:center;">${xpBadge}</td>
          <td style="padding:10px 12px; color:var(--text-muted); font-size:0.85rem;">${dateStr}</td>
        </tr>`;
      }).join('');

  document.getElementById('history-modal-body').innerHTML = `
    <table style="width:100%; border-collapse:collapse; font-size:0.9rem;">
      <thead>
        <tr style="border-bottom:2px solid var(--border); background:var(--surface-2); position:sticky; top:0; z-index:10;">
          <th style="padding:10px 12px; text-align:left;">Actividad</th>
          <th style="padding:10px 12px; text-align:left;">Resultado</th>
          <th style="padding:10px 12px; text-align:center;">XP Ganada</th>
          <th style="padding:10px 12px; text-align:left;">Fecha</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>`;
}
// ══════════════════════════════════════════════════════════════
//  TAB: TAREAS
// ══════════════════════════════════════════════════════════════

async function loadAssignmentsTab() {
  const list = $('assignments-list');
  if (!list) return;

  try {
    const assignments = await getClassAssignments(classData.id);
    const noMsg = $('no-assignments');

    if (assignments.length === 0) {
      noMsg && (noMsg.style.display = 'block');
      return;
    }
    noMsg && (noMsg.style.display = 'none');

    list.innerHTML = assignments.map(a => {
      const g = GAMES[a.gameId] || { icon: '🎮', name: a.gameId };
      const canPublish = classData.classroomCourseId && !a.classroomCourseWorkId;
      return `<div class="assignment-row">
        <div class="assignment-info">
          <span class="assignment-game-icon">${g.icon}</span>
          <div>
            <strong>${escapeHtml(a.title)}</strong>
            <small>${escapeHtml(g.name)} · Objetivo: ${a.targetScore} pts${a.dueDate ? ` · ${formatDate({ toDate: () => new Date(a.dueDate) })}` : ''}</small>
          </div>
        </div>
        <div class="assignment-actions">
          <button class="btn btn-ghost btn--sm" data-assignment-id="${a.id}"
                  data-game-id="${a.gameId}" data-target="${a.targetScore}"
                  data-title="${escapeHtml(a.title)}" onclick="window._viewProgress(this)">
            👥 Ver progreso
          </button>
          ${a.classroomCourseWorkId ? `
            <button class="btn btn-ghost btn--sm" data-assignment-id="${a.id}"
                    data-game-id="${a.gameId}" data-target="${a.targetScore}"
                    data-coursework="${a.classroomCourseWorkId}" onclick="window._syncGrade(this)">
              📤 Sincronizar notas
            </button>` : ''}
          ${canPublish ? `
            <button class="btn btn-ghost btn--sm" data-assignment-id="${a.id}"
                    data-game-id="${a.gameId}" data-target="${a.targetScore}"
                    data-title="${escapeHtml(a.title)}" data-due="${a.dueDate || ''}"
                    onclick="window._publishToClassroom(this)">
              🔗 Publicar en Classroom
            </button>` : ''}
          <span class="badge ${a.classroomCourseWorkId ? 'badge--accent' : 'badge--muted'}">
            ${a.classroomCourseWorkId ? '🔗 Classroom' : 'Solo ClassHub'}
          </span>
        </div>
      </div>`;
    }).join('');

    // Handler de ver progreso de la tarea
    window._viewProgress = async (btn) => {
      const { gameId, target, title } = btn.dataset;
      const targetScore = parseInt(target);

      // Crear o reutilizar el modal de progreso
      let modal = document.getElementById('modal-assignment-progress');
      if (!modal) {
        modal = document.createElement('div');
        modal.id = 'modal-assignment-progress';
        modal.className = 'modal-backdrop';
        modal.setAttribute('role', 'dialog');
        modal.setAttribute('aria-modal', 'true');
        modal.innerHTML = `
          <div class="modal-box" style="max-width:700px; width:95%;">
            <div class="modal-header">
              <h3 id="progress-modal-title"></h3>
              <button class="modal-close" id="close-progress-modal" aria-label="Cerrar">✕</button>
            </div>
            <div class="modal-body" style="padding:0;">
              <div id="progress-modal-body" style="overflow-x:auto;"></div>
            </div>
          </div>`;
        document.body.appendChild(modal);
        document.getElementById('close-progress-modal').addEventListener('click', () => modal.classList.remove('modal-backdrop--visible'));
        modal.addEventListener('click', e => { if (e.target === modal) modal.classList.remove('modal-backdrop--visible'); });
      }

      document.getElementById('progress-modal-title').textContent = `👥 Progreso: ${title}`;
      document.getElementById('progress-modal-body').innerHTML = '<div style="padding:32px; text-align:center;">⏳ Cargando...</div>';
      modal.classList.add('modal-backdrop--visible');

      try {
        // Cargar miembros y sus puntuaciones en paralelo
        const currentMembers = members.length > 0 ? members : await getClassMembers(classData.id);
        const activeMembers = currentMembers.filter(m => !m.pending);

        const rows = await Promise.all(activeMembers.map(async m => {
          const score = await getStudentBestScore(m.uid, gameId, classData.id);
          const grade = Math.min(10, Math.round((score / targetScore) * 10 * 10) / 10);
          const pct   = Math.min(100, Math.round((score / targetScore) * 100));
          const done  = score >= targetScore;
          const name  = m.displayNameAnonymized || m.displayName || m.email || 'Alumno';

          let statusBadge;
          if (done)        statusBadge = '<span class="badge badge--success">✅ Superada</span>';
          else if (score > 0) statusBadge = '<span class="badge badge--warning">⏳ En progreso</span>';
          else             statusBadge = '<span class="badge badge--muted">❌ Sin jugar</span>';

          return { name, score, grade, pct, done, statusBadge };
        }));

        // Ordenar: completadas abajo, sin jugar arriba
        rows.sort((a, b) => {
          if (a.done !== b.done) return b.done ? -1 : 1;
          return b.score - a.score;
        });

        if (activeMembers.length === 0) {
          document.getElementById('progress-modal-body').innerHTML =
            '<p class="empty-state" style="padding:24px">No hay alumnos registrados en esta clase.</p>';
          return;
        }

        // Estadísticas resumen
        const nDone   = rows.filter(r => r.done).length;
        const nPlayed = rows.filter(r => r.score > 0 && !r.done).length;
        const nNone   = rows.filter(r => r.score === 0).length;

        document.getElementById('progress-modal-body').innerHTML = `
          <div style="display:flex; gap:var(--space-4); padding:var(--space-4); border-bottom:1px solid var(--border); flex-wrap:wrap;">
            <div style="text-align:center; flex:1">
              <div style="font-size:1.5rem; font-weight:700; color:var(--success)">${nDone}</div>
              <div style="font-size:var(--text-xs); color:var(--text-muted)">Superada</div>
            </div>
            <div style="text-align:center; flex:1">
              <div style="font-size:1.5rem; font-weight:700; color:var(--warning)">${nPlayed}</div>
              <div style="font-size:var(--text-xs); color:var(--text-muted)">En progreso</div>
            </div>
            <div style="text-align:center; flex:1">
              <div style="font-size:1.5rem; font-weight:700; color:var(--text-muted)">${nNone}</div>
              <div style="font-size:var(--text-xs); color:var(--text-muted)">Sin jugar</div>
            </div>
          </div>
          <table style="width:100%; border-collapse:collapse; font-size:0.9rem;">
            <thead>
              <tr style="border-bottom:2px solid var(--border); background:var(--surface-2);">
                <th style="padding:10px 12px; text-align:left;">Alumno</th>
                <th style="padding:10px 12px; text-align:center;">Puntuación</th>
                <th style="padding:10px 12px; text-align:center;">Nota</th>
                <th style="padding:10px 12px; text-align:center;">Progreso</th>
                <th style="padding:10px 12px; text-align:center;">Estado</th>
              </tr>
            </thead>
            <tbody>
              ${rows.map(r => `
                <tr style="border-bottom:1px solid var(--border);">
                  <td style="padding:8px 12px;">${escapeHtml(r.name)}</td>
                  <td style="padding:8px 12px; text-align:center;">${r.score}</td>
                  <td style="padding:8px 12px; text-align:center; font-weight:600; color:${r.done ? 'var(--success)' : r.score > 0 ? 'var(--warning)' : 'var(--text-muted)'}">
                    ${r.score > 0 ? r.grade + '/10' : '—'}
                  </td>
                  <td style="padding:8px 12px; min-width:120px;">
                    <div style="background:var(--border); border-radius:99px; height:6px; overflow:hidden;">
                      <div style="background:${r.done ? 'var(--success)' : 'var(--primary)'}; width:${r.pct}%; height:100%; border-radius:99px;"></div>
                    </div>
                  </td>
                  <td style="padding:8px 12px; text-align:center;">${r.statusBadge}</td>
                </tr>`).join('')}
            </tbody>
          </table>`;
      } catch (err) {
        document.getElementById('progress-modal-body').innerHTML =
          `<div style="padding:24px; text-align:center; color:var(--error);">⚠️ Error: ${escapeHtml(err.message)}</div>`;
      }
    };

    // Handler de sincronizar
    window._syncGrade = async (btn) => {
      const { assignmentId, gameId, target, coursework } = btn.dataset;
      if (!classroomToken) {
        showToast('Token expirado', 'Vuelve a iniciar sesión como docente para sincronizar.', 'warning');
        return;
      }
      try {
        showLoading('Sincronizando notas...');
        const count = await syncClassroomGrades(
          classroomToken,
          classData.classroomCourseId,
          classData.id,
          coursework,
          { targetScore: parseInt(target), gameId }
        );
        showToast('Notas sincronizadas', `${count} alumno${count !== 1 ? 's' : ''} actualizado${count !== 1 ? 's' : ''} en Classroom.`, 'success');
      } catch (err) {
        showToast('Error', err.message, 'error');
      } finally {
        hideLoading();
      }
    };

    // Handler de publicar tarea existente en Classroom
    window._publishToClassroom = async (btn) => {
      let token = classroomToken;
      if (!token) {
        try { token = await refreshClassroomToken(); } catch { return; }
      }
      const { assignmentId, gameId, target, title, due } = btn.dataset;
      try {
        showLoading('Publicando en Classroom...');
        const settings = await import('./common/db.js').then(m => m.getSiteSettings());
        const result = await createClassroomAssignment(token, classData.classroomCourseId, classData.id, {
          gameId, title, targetScore: parseInt(target),
          dueDate: due || null,
          siteUrl: settings.siteUrl,
          skipFirestore: true
        });
        // Actualizar el documento existente en Firestore con el ID de Classroom
        await updateAssignment(classData.id, assignmentId, {
          classroomCourseId: classData.classroomCourseId,
          classroomCourseWorkId: result.id
        });
        showToast('Tarea publicada en Classroom', title, 'success');
        await loadAssignmentsTab();
      } catch (err) {
        showToast('Error', err.message, 'error');
      } finally {
        hideLoading();
      }
    };

  } catch (err) {
    showToast('Error', err.message, 'error');
  }
}


// ══════════════════════════════════════════════════════════════
//  TAB: RESULTADOS
// ══════════════════════════════════════════════════════════════

async function loadResultsTab() {
  // Filter pills
  const pillsContainer = $('game-filter-pills');
  if (pillsContainer && pillsContainer.children.length === 1) {
    Object.values(GAMES).forEach(g => {
      const btn = document.createElement('button');
      btn.className = 'filter-pill';
      btn.dataset.game = g.id;
      btn.textContent = `${g.icon} ${g.name}`;
      btn.addEventListener('click', () => setGameFilter(g.id));
      pillsContainer.appendChild(btn);
    });
    pillsContainer.querySelector('[data-game=""]')?.addEventListener('click', () => setGameFilter(''));
  }

  await renderResults();
}

async function setGameFilter(gameId) {
  activeGameFilter = gameId;
  $$('.filter-pill').forEach(p => {
    p.classList.toggle('filter-pill--active', p.dataset.game === gameId);
  });
  await renderResults();
}

async function renderResults(showLoader = true) {
  try {
    if (showLoader) showLoading('Cargando resultados...');
    if (members.length === 0) {
      members = await getClassMembers(classData.id);
    }
    const ranking = await getClassRanking(classData.id, activeGameFilter || null);

    // Enriquecer con perfiles (filtrando a los que no son alumnos de la clase, como el profe)
    const filteredRanking = ranking.filter(r => {
      const sid = r.studentId || r.student_id;
      return members.some(m => (m.uid || m.id) === sid);
    });
    
    const enriched = filteredRanking.map(r => {
      const sid = r.studentId || r.student_id;
      const member = members.find(m => (m.uid || m.id) === sid);
      const displayName = member?.displayNameAnonymized || member?.displayName || member?.display_name_anon || member?.display_name || r.displayName || 'Alumno';
      const photoURL = member?.photoURL || member?.avatar || r.photoURL || `https://api.dicebear.com/7.x/bottts/svg?seed=${sid}`;
      const scoreVal = r.score ?? r.total_game_score ?? 0;
      
      return {
        ...r,
        studentId: sid,
        score: scoreVal,
        total_game_score: scoreVal,
        displayNameAnonymized: displayName,
        displayName: displayName,
        photoURL: photoURL
      };
    });

    renderPodium(enriched, 'results-podium');
    renderRankingTable(enriched, 'results-ranking');
  } catch (err) {
    console.error(err);
    const podium = document.getElementById('results-podium');
    if (podium) {
        podium.innerHTML = `<div class="empty-state" style="color:var(--error); padding: 20px; text-align: center;">
            ⚠️ Firebase aún está construyendo el índice de rendimiento.<br>
            Este proceso suele tardar de <strong>3 a 5 minutos</strong>.<br><br>
            <small style="color:var(--text-muted)">Detalle técnico: ${err.message}</small>
        </div>`;
    }
    const ranking = document.getElementById('results-ranking');
    if (ranking) ranking.innerHTML = '';
  } finally {
    hideLoading();
  }
}

// ══════════════════════════════════════════════════════════════
//  MODALES
// ══════════════════════════════════════════════════════════════

async function loadGuildsTab() {
  if (!members || members.length === 0) {
    showLoading('Cargando gremios...');
    try {
      members = await getClassMembers(classData.id);
    } catch(e) {
      console.error(e);
      showToast('Error', 'No se pudieron cargar los alumnos', 'error');
    } finally {
      hideLoading();
    }
  }

  let guilds = await loadGuilds(classData?.subject_id);
  if (!guilds || guilds.length === 0) {
    guilds = getGuildsForSubject(classData?.subject_id);
  }

  const counts = {};
  const points = {};
  guilds.forEach(g => { counts[g.id] = 0; points[g.id] = 0; });

  (members || []).forEach(m => {
    const rawGuild = m.gremio || m.guild_id;
    if (!rawGuild) return;
    const g = guilds.find(x => x.id === rawGuild || x.name === rawGuild);
    if (g) {
      counts[g.id] = (counts[g.id] || 0) + 1;
      points[g.id] = (points[g.id] || 0) + (m.puntosTotal ?? m.xp ?? 0);
    }
  });

  const ranking = guilds.map(g => ({
    id: g.id,
    name: g.name,
    icon: g.icon,
    image: g.image || g.image_url || '',
    color: g.color || '#3498db',
    points: points[g.id] || 0,
    members: counts[g.id] || 0
  })).sort((a,b) => b.points - a.points);

  const rankingHtml = ranking.map((g, idx) => {
    const isFirst = idx === 0;
    const isSecond = idx === 1;
    const isThird = idx === 2;
    let badge = '';
    let scale = '1';
    let border = g.color;
    let bg = 'var(--bg-card)';

    // Buscar a todos los miembros de este gremio
    const guildMembers = (members || []).filter(m => {
      const raw = m.gremio || m.guild_id;
      return raw && (raw === g.id || raw === g.name);
    }).sort((a,b) => ((b.puntosTotal ?? b.xp ?? 0) - (a.puntosTotal ?? a.xp ?? 0)));

    const mvp = guildMembers.length > 0 ? guildMembers[0] : null;
    const mvpPts = mvp ? (mvp.puntosTotal ?? mvp.xp ?? 0) : 0;
    let mvpHtml = '';
    if (mvp && mvpPts > 0) {
      mvpHtml = `<div style="margin-top:12px; background:rgba(0,0,0,0.05); border-radius:8px; padding:6px 12px; display:inline-block; border-left:3px solid ${g.color};">
        <span style="font-size:0.85rem; text-transform:uppercase; color:var(--text-muted); font-weight:bold;">👑 MVP:</span> 
        <span style="font-weight:bold; color:var(--text-primary); margin-left:5px;">${escapeHtml(mvp.displayNameAnonymized || mvp.displayName || mvp.name || mvp.email?.split('@')[0])}</span> 
        <span style="color:var(--warning); font-weight:bold; font-size:0.9rem;">(⭐ ${mvpPts})</span>
      </div>`;
    }

    // Chips de los miembros del gremio
    let membersListHtml = '';
    if (guildMembers.length > 0) {
      membersListHtml = `
        <div style="margin-top:10px; display:flex; flex-wrap:wrap; gap:6px;">
          ${guildMembers.map(m => {
            const mPts = m.puntosTotal ?? m.xp ?? 0;
            const mName = escapeHtml(m.displayNameAnonymized || m.displayName || m.name || m.email?.split('@')[0]);
            return `<span class="badge" style="background:rgba(0,0,0,0.05); border:1px solid rgba(0,0,0,0.1); color:var(--text-primary); font-size:0.8rem; padding:3px 8px; border-radius:12px;">
              ${mName} <strong style="color:var(--warning); margin-left:3px;">⭐ ${mPts}</strong>
            </span>`;
          }).join('')}
        </div>
      `;
    } else {
      membersListHtml = `
        <div style="margin-top:8px; font-size:0.85rem; color:var(--text-muted); font-style:italic;">
          Sin miembros asignados en esta clase
        </div>
      `;
    }

    // Calcular distancia con el anterior
    let distanceHtml = '';
    if (idx > 0 && ranking[idx-1].points > 0) {
      const diff = ranking[idx-1].points - g.points;
      if (diff > 0) {
        distanceHtml = `<div style="color:var(--error); font-size:0.85rem; font-weight:bold; margin-top:5px; text-transform:uppercase; background:#ffeaa7; padding:4px 8px; border-radius:4px; border:1px solid #fdcb6e; display:inline-block;">
          🔥 ¡A solo ${diff} XP de subir de puesto!
        </div>`;
      }
    }

    if (isFirst) { badge = '🥇 LÍDERES ABSOLUTOS'; scale = '1.02'; border = '#f1c40f'; bg = '#fffdf5'; }
    else if (isSecond) { badge = '🥈 SEGUNDO PUESTO'; scale = '1.0'; border = '#bdc3c7'; bg = '#f8f9fa'; }
    else if (isThird) { badge = '🥉 TERCER PUESTO'; scale = '0.98'; border = '#cd6133'; bg = '#fdfbf7'; }
    else { badge = `${idx+1}º Puesto`; scale = '0.95'; border = 'var(--border)'; bg = 'var(--bg-card)'; }

    return `
      <div class="card animate-fade-up delay-${idx+1}" style="display:flex; align-items:center; gap:var(--space-4); padding:var(--space-4); background:${bg}; border:4px solid ${border}; transform:scale(${scale}); transform-origin:center; position:relative; overflow:hidden; box-shadow:6px 6px 0px rgba(0,0,0,${isFirst ? '0.2' : '0.1'}); margin-bottom:12px;">
        ${isFirst ? `<div style="position:absolute; top:-10px; right:-10px; font-size:7rem; opacity:0.1; transform:rotate(-15deg); pointer-events:none;">${g.icon}</div>` : ''}
        
        <div style="width:80px; height:80px; border-radius:50%; background-color:${g.color}; display:flex; align-items:center; justify-content:center; border:4px solid var(--text-primary); box-shadow:4px 4px 0px rgba(0,0,0,1); flex-shrink:0;">
          <img src="${g.image}" alt="" style="width:100%; height:100%; object-fit:contain; mix-blend-mode:multiply;" onerror="this.onerror=null; this.style.display='none'; this.parentNode.innerHTML='<span style=\\'font-size:2.5rem;\\'>${g.icon}</span>';">
        </div>
        
        <div style="flex:1;">
          <div style="font-size:0.8rem; font-weight:bold; color:${isFirst ? '#d35400' : 'var(--text-muted)'}; margin-bottom:2px; text-transform:uppercase; letter-spacing:2px;">${badge}</div>
          <h3 style="margin:0; font-size:1.8rem; color:${g.color}; text-shadow:1px 1px 0px var(--text-primary); -webkit-text-stroke: 1px var(--text-primary); line-height: 1.1;">${escapeHtml(g.name)}</h3>
          <div style="margin-top:5px; font-size:0.95rem; color:var(--text-primary); font-weight:bold;">
            👥 ${g.members} valientes aportando experiencia
          </div>
          ${mvpHtml}
          ${membersListHtml}
        </div>
        
        <div style="text-align:right; z-index:2; background:rgba(255,255,255,0.85); padding:8px 15px; border-radius:10px; border:2px solid var(--text-primary); box-shadow:3px 3px 0px rgba(0,0,0,1); display:flex; flex-direction:column; align-items:flex-end;">
          <div style="font-size:0.8rem; font-weight:bold; color:var(--text-primary); text-transform:uppercase; letter-spacing:1px; margin-bottom:2px;">Puntos Totales</div>
          <div style="font-size:2.5rem; font-weight:900; color:var(--warning); text-shadow:1px 1px 0px var(--text-primary), -1px -1px 0 #000, 1px -1px 0 #000, -1px 1px 0 #000, 1px 1px 0 #000; line-height:1;">
            ⭐ ${g.points.toLocaleString()}
          </div>
          ${distanceHtml}
        </div>
      </div>
    `;
  }).join('');

  // Identificar alumnos sin gremio en la clase
  const unassigned = (members || []).filter(m => !m.gremio && !m.guild_id);
  let unassignedHtml = '';
  if (unassigned.length > 0) {
    unassignedHtml = `
      <div class="card" style="margin-top:20px; border-left:4px solid var(--text-muted); background:var(--bg-card); padding:var(--space-3) var(--space-4);">
        <h4 style="margin:0 0 8px 0; color:var(--text-muted); font-size:0.95rem;">
          ⚪ Alumnos sin gremio asignado (${unassigned.length}):
        </h4>
        <div style="display:flex; flex-wrap:wrap; gap:6px;">
          ${unassigned.map(m => `<span class="badge badge--muted" style="font-size:0.8rem;">${escapeHtml(m.displayName || m.displayNameAnonymized || m.email?.split('@')[0])}</span>`).join('')}
        </div>
      </div>
    `;
  }

  $('guilds-ranking-list').innerHTML = rankingHtml + unassignedHtml;
}

let unsubscribeExams = null;

async function loadExamsTab() {
  if (!members || members.length === 0) {
    members = await getClassMembers(classData.id);
  }

  if (unsubscribeExams) unsubscribeExams();
  unsubscribeExams = onSnapshot(examsRef, (snap) => {
    const exams = [];
    const docs = snap?.docs || (Array.isArray(snap) ? snap : []);
    if (typeof snap?.forEach === 'function') {
      snap.forEach(d => exams.push({ id: d.id, ...d.data() }));
    } else {
      docs.forEach(d => exams.push({ id: d.id, ...(typeof d.data === 'function' ? d.data() : d) }));
    }
    
    const list = $('examenes-test-list');
    if (!exams.length) {
      list.innerHTML = '<tr><td colspan="6" class="text-center text-muted">No hay exámenes generados.</td></tr>';
    } else {
      list.innerHTML = exams.map(ex => `
        <tr>
          <td><strong>${escapeHtml(ex.titulo)}</strong></td>
          <td>${ex.numPreguntas} preg.</td>
          <td>${ex.tiempoMinutos} min</td>
          <td>
            <span class="badge ${ex.activo ? 'badge--success' : 'badge--muted'}">
              ${ex.activo ? 'Activo' : 'Cerrado'}
            </span>
          </td>
          <td>${ex.creadoEn?.toDate ? ex.creadoEn.toDate().toLocaleDateString() : ''}</td>
          <td>
            ${ex.activo 
              ? `<button class="btn btn-ghost btn--sm" onclick="window._cerrarExamenTest('${ex.id}')" title="Cerrar examen">🔒</button>`
              : `<button class="btn btn-ghost btn--sm" onclick="window._activarExamenTest('${ex.id}')" title="Abrir examen">🔓</button>`}
            <button class="btn btn-ghost btn--sm" onclick="window._deleteExamenTest('${ex.id}')" title="Eliminar" style="color:var(--error)">🗑️</button>
          </td>
        </tr>
      `).join('');
    }
  });

  // Cargar resultados de los Tests de Teoría (Control de Lectura)
  const teoriaList = $('teoria-test-list');
  if (teoriaList) {
    const studentIds = members.map(m => m.uid || m.id || m.student_id);
    if (studentIds.length === 0) {
      teoriaList.innerHTML = '<tr><td colspan="5" class="text-center text-muted">No hay alumnos en esta clase.</td></tr>';
      return;
    }
    
    // Firebase 'in' max is 10, so we just fetch recent ones or we split chunks. For simplicity in CyR we can just get docs.
    // Assuming class size < 30, we can fetch all or just chunk them.
    // Instead of complex chunks, we can just get ALL from the collection and filter by class. (Since we are teacher).
    getDocs(collection(db, 'test_teoria_respuestas')).then(snap => {
      let results = [];
      const docs = snap?.docs || (Array.isArray(snap) ? snap : []);
      const cb = d => {
        let data = typeof d.data === 'function' ? d.data() : d;
        if (studentIds.includes(data.uid)) {
          results.push(data);
        }
      };
      if (typeof snap?.forEach === 'function') snap.forEach(cb);
      else docs.forEach(cb);
      
      // Filtrar para quedarse solo con el último intento de cada alumno en cada bloque
      // Agrupamos por uid_topicId y nos quedamos con la fecha más reciente
      let latestResults = {};
      results.forEach(r => {
        const key = `${r.uid}_${r.topicId}`;
        const t = r.fecha?.toMillis ? r.fecha.toMillis() : 0;
        if (!latestResults[key] || t > latestResults[key].t) {
          latestResults[key] = { ...r, t };
        }
      });
      
      let finalResults = Object.values(latestResults);
      finalResults.sort((a,b) => b.t - a.t);
      
      if (finalResults.length === 0) {
        teoriaList.innerHTML = '<tr><td colspan="5" class="text-center text-muted">Aún no hay resultados de teoría.</td></tr>';
      } else {
        teoriaList.innerHTML = finalResults.map(r => {
          const mMatch = members.find(m => (m.uid || m.id || m.student_id) === r.uid);
          const studentName = r.alumnoNombre || (mMatch ? (mMatch.displayNameAnonymized || mMatch.displayName || mMatch.name) : 'Alumno');
          return `
          <tr>
            <td>
              <div style="display:flex; align-items:center; gap:10px;">
                <img src="https://api.dicebear.com/7.x/bottts/svg?seed=${r.uid}" style="width:30px; border-radius:50%; background:#eee;">
                <strong>${escapeHtml(studentName)}</strong>
              </div>
            </td>
            <td>${escapeHtml(r.topicName || r.topicId)}</td>
            <td>
              <span class="badge ${r.score >= 5 ? 'badge--success' : 'badge--error'}" style="font-size:1.1rem;">
                ${r.score.toFixed(1)} / 10
              </span>
            </td>
            <td class="text-muted">${r.fecha?.toDate ? r.fecha.toDate().toLocaleString() : 'Reciente'}</td>
            <td>
              <button class="btn btn-ghost btn--sm" onclick="window._deleteStudentTests('${r.uid}', '${r.topicId}', '${escapeHtml(studentName)}')" title="Borrar todos los intentos de este tema" style="color:var(--error)">🗑️</button>
            </td>
          </tr>`;
        }).join('');
      }
    }).catch(e => {
      console.error(e);
      teoriaList.innerHTML = '<tr><td colspan="5" class="text-center text-error">Error al cargar resultados.</td></tr>';
    });
  }
}

window._activarExamenTest = async (id) => {
  await updateDoc(doc(db, 'classes', classData.id, 'examenes_test', id), { activo: true });
};
window._cerrarExamenTest = async (id) => {
  await updateDoc(doc(db, 'classes', classData.id, 'examenes_test', id), { activo: false });
};
window._deleteExamenTest = async (id) => {
  if (confirm('¿Seguro que deseas eliminar este examen?')) {
    await deleteDoc(doc(db, 'classes', classData.id, 'examenes_test', id));
  }
};

function renderGamificationPodium() {
  const container = $('gamification-podium');
  if (!container) return;
  const sorted = [...members].filter(m => !m.pending && (m.puntosTotal ?? m.xp ?? 0) > 0).sort((a,b) => (b.puntosTotal ?? b.xp ?? 0) - (a.puntosTotal ?? a.xp ?? 0));
  if (sorted.length === 0) {
    container.innerHTML = '';
    return;
  }
  
  const top3 = sorted.slice(0, 3);
  let html = `<div style="display:flex; justify-content:center; gap:16px; margin-bottom:16px; align-items:flex-end;">`;
  
  const renderPos = (m, pos, height, color, emoji) => {
    if (!m) return '';
    const sid = m.uid || m.id || m.student_id;
    const name = m.displayNameAnonymized || m.displayName || m.display_name_anon || m.display_name || m.name || (m.email ? m.email.split('@')[0] : 'Alumno');
    const photo = m.photoURL || m.avatar || `https://api.dicebear.com/7.x/bottts/svg?seed=${sid}`;
    const pts = m.puntosTotal ?? m.xp ?? 0;
    return `
      <div style="display:flex; flex-direction:column; align-items:center; width:100px;">
        <div style="font-size:1.5rem; margin-bottom:4px;">${emoji}</div>
        <img src="${escapeHtml(photo)}" style="width:40px; height:40px; border-radius:50%; margin-bottom:8px; border:2px solid ${color};">
        <div style="font-size:0.8rem; text-align:center; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; width:100%;">${escapeHtml(name)}</div>
        <div style="font-weight:bold; color:${color}; font-size:0.9rem;">${pts} XP</div>
        <div style="width:100%; background:${color}; height:${height}px; border-radius:8px 8px 0 0; margin-top:8px; opacity:0.8; display:flex; justify-content:center; align-items:center; color:white; font-weight:bold; font-size:1.2rem;">${pos}</div>
      </div>
    `;
  };
  
  html += renderPos(top3[1], 2, 60, '#C0C0C0', '🥈');
  html += renderPos(top3[0], 1, 80, '#FFD700', '🥇');
  html += renderPos(top3[2], 3, 40, '#CD7F32', '🥉');
  
  html += `</div>`;
  container.innerHTML = html;
}

function setupModals(user) {
  // Modal Medallas
  window._showMedallas = (uid) => {
    const student = members.find(m => (m.uid || m.id || m.student_id) === uid);
    if (!student) return;
    const name = student.displayNameAnonymized || student.displayName || student.display_name_anon || student.display_name || student.name || (student.email ? student.email.split('@')[0] : 'Alumno');
    $('medallas-alumno-nombre').textContent = `Medallero de ${name}`;
    
    const logrosObtenidos = student.logros || student.medals || [];
    
    const conseguidas = [];
    const noConseguidas = [];
    
    const subjectMedals = getMedalsForSubject(classData?.subject_id);
    subjectMedals.forEach(m => {
      if (logrosObtenidos.some(l => (typeof l === 'string' ? l === m.id : (l.id || l.medal_id) === m.id))) {
        conseguidas.push(m);
      } else {
        noConseguidas.push(m);
      }
    });
    
    const renderMedal = (m, tiene) => {
      const filter = tiene ? 'none' : 'grayscale(100%) opacity(0.6)';
      const bg = tiene ? 'var(--warning-light, rgba(243,156,18,0.1))' : 'var(--bg-card)';
      const border = tiene ? 'var(--warning)' : 'var(--border)';
      const boxShadow = tiene ? '4px 4px 0px var(--warning)' : '4px 4px 0px rgba(0,0,0,0.1)';
      return `
        <div style="border:2px solid ${border}; padding:15px; border-radius:8px; background:${bg}; filter:${filter}; display:flex; flex-direction:column; align-items:center; text-align:center; box-shadow: ${boxShadow};">
          <div style="font-size:2.5rem; margin-bottom:8px; line-height: 1;">${m.icon}</div>
          <strong style="display:block; margin-bottom:5px; font-size:0.95rem; color:var(--text-primary);">${m.name}</strong>\n          ${MEDAL_XP[m.id] ? `<div style="font-weight:bold; color:var(--warning); margin:4px 0; font-size:0.85rem; background:rgba(243,156,18,0.1); border-radius:4px; padding:2px 4px; display:inline-block;">+${MEDAL_XP[m.id]} XP</div>` : ``}
          <small style="color:var(--text-secondary); font-size:0.75rem; line-height:1.2;">${m.desc}</small>
        </div>
      `;
    };

    const listEl = $('medallas-alumno-list');
    listEl.style.gridTemplateColumns = '1fr 1fr';
    listEl.style.gap = '15px';
    listEl.style.padding = '10px 5px';
    listEl.style.maxHeight = '60vh';
    listEl.style.overflowY = 'auto';
    
    const allHTML = [
      ...conseguidas.map(m => renderMedal(m, true)),
      ...noConseguidas.map(m => renderMedal(m, false))
    ].join('');
    
    listEl.innerHTML = allHTML || '<p>No hay medallas disponibles.</p>';
    
    $('modal-medallas').classList.add('modal-backdrop--visible');
  };
  $('btn-close-medallas')?.addEventListener('click', () => $('modal-medallas').classList.remove('modal-backdrop--visible'));

  // Modal Nuevo Examen
  $('btn-new-exam')?.addEventListener('click', () => {
    $('modal-new-exam').classList.add('modal-backdrop--visible');
  });
  $('btn-close-new-exam')?.addEventListener('click', () => $('modal-new-exam').classList.remove('modal-backdrop--visible'));
  $('btn-cancel-new-exam')?.addEventListener('click', () => $('modal-new-exam').classList.remove('modal-backdrop--visible'));
  
  $('btn-save-examen')?.addEventListener('click', async () => {
    const titulo = $('gen-titulo').value.trim();
    const tiempo = parseInt($('gen-tiempo').value);
    const num = parseInt($('gen-num').value);
    const topic = $('gen-topic').value;
    
    if (!titulo || !tiempo || !num) {
      showToast('Error', 'Completa los campos', 'error');
      return;
    }
    
    try {
      showLoading('Generando...');
      await addDoc(collection(db, 'classes', classData.id, 'examenes_test'), {
        titulo,
        tiempoMinutos: tiempo,
        numPreguntas: num,
        topicFilter: topic || null,
        activo: false,
        creadoEn: serverTimestamp()
      });
      $('modal-new-exam').classList.remove('modal-backdrop--visible');
      showToast('Examen generado', 'Ya puedes activarlo', 'success');
      $('gen-titulo').value = '';
    } catch (e) {
      showToast('Error', e.message, 'error');
    } finally {
      hideLoading();
    }
  });  // Modal nueva tarea
  const modalAssignment = $('modal-new-assignment');
  const formAssignment  = $('form-new-assignment');
  const btnNew          = $('btn-new-assignment');
  const closeBtn        = $('close-new-assignment');
  const cancelBtn       = $('cancel-new-assignment');

  // Rellenar select de juegos
  const gameSelect = $('assignment-game');
  if (gameSelect) {
    Object.values(GAMES).forEach(g => {
      const opt = document.createElement('option');
      opt.value = g.id;
      opt.textContent = `${g.icon} ${g.name}`;
      gameSelect.appendChild(opt);
    });

    gameSelect.addEventListener('change', async () => {
      const criteriaContainer = $('assignment-criteria-suggestion');
      if (!criteriaContainer) return;
      const gameId = gameSelect.value;
      
      try {
        const { GAMES_CRITERIA_MAPPING } = await import('./common/utils.js');
        const mapping = GAMES_CRITERIA_MAPPING[gameId];
        
        if (mapping && Object.keys(mapping).length > 0) {
          const listItems = Object.entries(mapping)
            .map(([lvl, crit]) => `<li><strong>${escapeHtml(lvl)}:</strong> ${escapeHtml(crit)}</li>`)
            .join('');
          criteriaContainer.innerHTML = `
            <strong>💡 Sugerencia de Criterios (Andalucía)</strong><br>
            <ul style="margin:4px 0 0 16px; padding:0;">
              ${listItems}
            </ul>
          `;
          criteriaContainer.style.display = 'block';
        } else {
          criteriaContainer.style.display = 'none';
        }
      } catch (e) {
        console.warn('No se pudo cargar el mapeo de criterios', e);
      }
    });
  }

  // Mostrar nota si no hay Classroom vinculado
  if (!classData.classroomCourseId) {
    $('assignment-classroom-note').style.display = 'block';
  }

  const openModal  = () => { 
    formAssignment?.reset(); 
    if ($('assignment-criteria-suggestion')) $('assignment-criteria-suggestion').style.display = 'none';
    $('assignment-error').textContent = ''; 
    modalAssignment.classList.add('modal-backdrop--visible'); 
    modalAssignment.setAttribute('aria-hidden', 'false'); 
  };
  const closeModal = () => { modalAssignment.classList.remove('modal-backdrop--visible'); modalAssignment.setAttribute('aria-hidden', 'true'); };

  btnNew?.addEventListener('click', openModal);
  closeBtn?.addEventListener('click', closeModal);
  cancelBtn?.addEventListener('click', closeModal);
  modalAssignment?.addEventListener('click', e => { if (e.target === modalAssignment) closeModal(); });

  formAssignment?.addEventListener('submit', async e => {
    e.preventDefault();
    const gameId = $('assignment-game').value;
    const title  = $('assignment-title').value.trim();
    const target = parseInt($('assignment-target').value);
    const due    = $('assignment-due').value;

    if (!gameId || !title || !target) {
      $('assignment-error').textContent = 'Completa todos los campos obligatorios.';
      return;
    }

    try {
      showLoading('Creando tarea...');
      $('assignment-error').textContent = '';

      let classroomCourseWorkId = null;

      // Si tiene Classroom y hay token, publicar la tarea
      if (classData.classroomCourseId && classroomToken) {
        const settings = await import('./common/db.js').then(m => m.getSiteSettings());
        const result = await createClassroomAssignment(classroomToken, classData.classroomCourseId, classData.id, {
          gameId, title, targetScore: target,
          dueDate: due || null,
          siteUrl: settings.siteUrl
        });
        classroomCourseWorkId = result.id;
        showToast('Tarea publicada en Classroom', title, 'success');
      } else {
        // Solo guardar en Firestore
        await createAssignment(classData.id, {
          gameId, title, targetScore: target,
          dueDate: due || null,
          classroomCourseId: classData.classroomCourseId || null
        });
        showToast('Tarea online creada', 'Guardada en StackClass.', 'success');
      }

      closeModal();
      await loadAssignmentsTab();
    } catch (err) {
      $('assignment-error').textContent = err.message;
    } finally {
      hideLoading();
    }
  });

  // Sincronizar alumnos desde Classroom
  $('btn-sync-students')?.addEventListener('click', async () => {
    if (!classData.classroomCourseId) {
      showToast('Sin Classroom', 'Esta clase no está vinculada a un curso de Classroom.', 'warning');
      return;
    }
    let token = classroomToken;
    if (!token) {
      try { token = await refreshClassroomToken(); } catch { return; }
    }
    try {
      showLoading('Sincronizando alumnos...');
      const { importClassroomStudents } = await import('./common/classroom.js');
      const { matched, pending } = await importClassroomStudents(token, classData.classroomCourseId, classData.id);
      showToast('Alumnos sincronizados', `${matched} vinculados, ${pending} pendientes de registro.`, 'success');
      await loadStudentsTab();
    } catch (err) {
      showToast('Error', err.message, 'error');
    } finally {
      hideLoading();
    }
  });

  // Modal añadir alumnos manualmente
  const modalAddStudents  = $('modal-add-students');
  const formAddStudents   = $('form-add-students');
  const btnAddStudents    = $('btn-add-students');
  const closeAddStudents  = $('close-add-students');
  const cancelAddStudents = $('cancel-add-students');

  const openAddStudents = () => {
    formAddStudents?.reset();
    modalAddStudents?.classList.add('modal-backdrop--visible');
    modalAddStudents?.setAttribute('aria-hidden', 'false');
  };
  const closeAddModal = () => {
    modalAddStudents?.classList.remove('modal-backdrop--visible');
    modalAddStudents?.setAttribute('aria-hidden', 'true');
  };

  btnAddStudents?.addEventListener('click', openAddStudents);
  closeAddStudents?.addEventListener('click', closeAddModal);
  cancelAddStudents?.addEventListener('click', closeAddModal);
  modalAddStudents?.addEventListener('click', e => { if (e.target === modalAddStudents) closeAddModal(); });

  formAddStudents?.addEventListener('submit', async e => {
    e.preventDefault();
    const rawEmails = $('manual-students-input')?.value || '';
    if (!rawEmails.trim()) {
      showToast('Atención', 'Introduce al menos un correo electrónico.', 'warning');
      return;
    }

    try {
      showLoading('Añadiendo alumnos...');
      const result = await addStudentsToClass(classData.id, rawEmails);
      closeAddModal();

      let msg = `${result.added} alumno(s) añadido(s).`;
      if (result.alreadyInClass > 0) msg += ` (${result.alreadyInClass} ya estaban en la clase).`;
      if (result.invalidEmails > 0) msg += ` (${result.invalidEmails} correos con formato inválido).`;

      showToast('Alumnos procesados', msg, 'success', 5000);
      await loadStudentsTab();
    } catch (err) {
      showToast('Error', err.message, 'error');
    } finally {
      hideLoading();
    }
  });
}


// ── Evaluación por Criterios ────────────────────────────────────
$('btn-view-criteria')?.addEventListener('click', async () => {
  $('modal-criteria').classList.add('modal-backdrop--visible');
  const container = $('criteria-table-container');
  container.innerHTML = '<div style="text-align:center; padding:40px;"><div class="spinner"></div> Calculando notas...</div>';
  
  try {
    // Obtenemos todas las respuestas de exámenes (el profesor tiene acceso a todas)
    const snap = await getDocs(collection(db, 'test_teoria_respuestas'));
    const allTests = [];
    snap.forEach(d => allTests.push(d.data()));
    
    // Ordenar por fecha cronológicamente
    allTests.sort((a, b) => {
      const ta = a.fecha ? a.fecha.toMillis() : 0;
      const tb = b.fecha ? b.fecha.toMillis() : 0;
      return ta - tb;
    });

    // Quedarse SÓLO con el ÚLTIMO test de cada bloque para cada alumno
    const validTestsMap = {};
    allTests.forEach(test => {
      if (test.uid && test.topicId) {
        validTestsMap[test.uid + '_' + test.topicId] = test;
      }
    });
    const validTests = Object.values(validTestsMap);
    
    // Diccionario: studentUid -> { criterioStr -> { aciertos: 0, fallos: 0, blancos: 0, total: 0 } }
    const studentGrades = {};
    const allCriterios = new Set();
    
    // Inicializar alumnos de esta clase
    members.forEach(m => {
      const sid = m.uid || m.id || m.student_id;
      studentGrades[sid] = {};
    });
    
    validTests.forEach(test => {
      // Filtrar solo alumnos de la clase
      const testUid = test.uid || test.student_id;
      if (!studentGrades[testUid]) return;
      
      const stats = studentGrades[testUid];
      
      // Analizar cada pregunta
      if (test.respuestas && Array.isArray(test.respuestas)) {
        test.respuestas.forEach(r => {
          if (!r.criterio) return; // Exámenes antiguos que no guardaron criterio
          
          allCriterios.add(r.criterio);
          if (!stats[r.criterio]) {
            stats[r.criterio] = { aciertos: 0, fallos: 0, blancos: 0, total: 0 };
          }
          
          stats[r.criterio].total++;
          if (r.isBlanco) {
            stats[r.criterio].blancos++;
          } else if (r.isCorrect) {
            stats[r.criterio].aciertos++;
          } else {
            stats[r.criterio].fallos++;
          }
        });
      }
    });
    
    const critList = Array.from(allCriterios).sort((a,b) => a.localeCompare(b, undefined, {numeric: true}));
    
    if (critList.length === 0) {
      container.innerHTML = '<div class="empty-state">No hay datos suficientes con criterios LOMLOE.<br>Los exámenes antiguos no guardaban esta información, espera a que los alumnos realicen tests nuevos.</div>';
      return;
    }
    
    let html = `
      <table class="ranking-table" style="font-size:0.85rem;">
        <thead>
          <tr>
            <th style="position:sticky; left:0; background:var(--surface-1); z-index:2; min-width:180px;">Alumno</th>
    `;
    
    critList.forEach(c => {
      html += `<th>Crit. ${c}</th>`;
    });
    
    html += `</tr></thead><tbody>`;
    
    members.sort((a, b) => {
      const na = a.displayNameAnonymized || a.displayName || a.name || '';
      const nb = b.displayNameAnonymized || b.displayName || b.name || '';
      return na.localeCompare(nb);
    }).forEach(m => {
      const sid = m.uid || m.id || m.student_id;
      const name = m.displayNameAnonymized || m.displayName || m.name || m.email;
      html += `
        <tr>
          <td style="position:sticky; left:0; background:var(--bg-card); font-weight:bold;">${escapeHtml(name)}</td>
      `;
      
      critList.forEach(c => {
        const d = studentGrades[sid] ? studentGrades[sid][c] : null;
        if (!d) {
          html += `<td style="color:var(--text-muted); opacity:0.5;">—</td>`;
        } else {
          let score = d.aciertos - (d.fallos * 0.33);
          let grade = (score / d.total) * 10;
          if (grade < 0) grade = 0;
          
          const gradeStr = grade.toFixed(2);
          const color = grade >= 5 ? 'var(--success)' : 'var(--error)';
          
          html += `
            <td style="color:${color}; font-weight:900;" title="Aciertos: ${d.aciertos}, Fallos: ${d.fallos}, Blancos: ${d.blancos}">
              ${gradeStr}
            </td>
          `;
        }
      });
      
      html += `</tr>`;
    });
    
    html += `</tbody></table>`;
    container.innerHTML = html;
    
  } catch (err) {
    console.error('Error calculando criterios:', err);
    container.innerHTML = '<div class="alert alert-error">Error al calcular las notas por criterios.</div>';
  }
});

$('btn-close-criteria')?.addEventListener('click', () => {
  $('modal-criteria').classList.remove('modal-backdrop--visible');
});

window._deleteStudentTests = async (uid, topicId, studentName) => {
  if (confirm(`¿Seguro que deseas eliminar TODOS los intentos del test "${topicId}" para el alumno ${studentName}?`)) {
    try {
      showLoading('Eliminando exámenes...');
      const snap = await getDocs(query(collection(db, 'test_teoria_respuestas'), where('uid', '==', uid)));
      
      const deletePromises = [];
      snap.forEach(d => {
        if (d.data().topicId === topicId) {
          deletePromises.push(deleteDoc(doc(db, 'test_teoria_respuestas', d.id)));
        }
      });
      
      await Promise.all(deletePromises);
      showToast('Eliminados', `Se han borrado ${deletePromises.length} intentos de teoría.`, 'success');
      
      // Reload tab to update view
      const activeTab = document.querySelector('.tab-btn.active').dataset.target;
      if (activeTab === 'tab-tests') loadTestsTab();
      
    } catch (e) {
      console.error(e);
      showToast('Error', e.message, 'error');
    } finally {
      hideLoading();
    }
  }
};

// ══════════════════════════════════════════════════════════════
//  TAB: TAREAS OFFLINE Y RÚBRICAS
// ══════════════════════════════════════════════════════════════

let offlineTasksConfig = {};

async function loadOfflineTasksTab() {
  const container = $('offline-tasks-container');
  if (!container) return;
  
  if (members.length === 0) {
     members = await getClassMembers(classData.id);
  }

  // Cargar configuración de tareas
  const configSnap = await getDocs(query(collection(db, 'offline_tasks_config'), where('classId', '==', classData.id)));
  offlineTasksConfig = {};
  const iterateSnap = (s, cb) => {
    if (s && typeof s.forEach === 'function') s.forEach(cb);
    else if (s && Array.isArray(s.docs)) s.docs.forEach(cb);
  };
  iterateSnap(configSnap, d => {
    const data = typeof d.data === 'function' ? d.data() : d;
    offlineTasksConfig[data.taskId] = { id: d.id, ...data };
  });

  // Cargar notas offline
  const gradesSnap = await getDocs(query(collection(db, 'offline_grades'), where('classId', '==', classData.id)));
  const offlineGrades = {};
  iterateSnap(gradesSnap, d => {
    const data = typeof d.data === 'function' ? d.data() : d;
    if (!offlineGrades[data.taskId]) offlineGrades[data.taskId] = {};
    offlineGrades[data.taskId][data.studentId] = { id: d.id, ...data };
  });

  let html = `<div class="accordion-list">`;
  CLASSROOM_TASKS.forEach((task, index) => {
    const config = offlineTasksConfig[task.id] || { isActive: false, rubricPublished: false, gradesPublished: false, dueDate: '' };
    
    const displayTitle = config.customTitle || task.title;
    const displayDesc = config.customDescription || task.description;
    
    html += `
      <div class="task-accordion-item" style="border: 1px solid var(--border); border-radius: var(--radius); margin-bottom: 10px; background: var(--bg-surface); overflow:hidden;">
        <!-- Cabecera Tarea -->
        <div class="task-accordion-header" style="display:flex; justify-content:space-between; align-items:center; padding: 15px; cursor:pointer; background:#f8fafc;" data-task="${task.id}">
          <div style="flex:1;">
            <h3 style="margin:0; color:var(--primary); font-size:1.1rem; display:flex; align-items:center; gap:10px;">
              <span class="task-expand-icon">▶️</span>
              ${index + 1}. ${escapeHtml(displayTitle)}
              <button class="btn-ghost btn-edit-task" data-task="${task.id}" style="font-size:0.9rem; padding:4px; margin-left:5px;" title="Personalizar tarea" onclick="event.stopPropagation()">✏️</button>
              <span class="badge" style="background:#e2e8f0; color:#475569; font-size:0.75rem;">Bloque ${task.block} | Crit ${task.crit}</span>
            </h3>
          </div>
          <!-- Toggle Activo -->
          <div style="display:flex; align-items:center; gap:10px;" onclick="event.stopPropagation()">
            <span style="font-size:0.9rem; color:var(--text-muted);">Visible Alumnos</span>
            <label class="toggle-switch">
              <input type="checkbox" class="offline-config-toggle" data-task="${task.id}" data-field="isActive" ${config.isActive ? 'checked' : ''}>
              <span class="toggle-slider"></span>
            </label>
          </div>
        </div>

        <!-- Contenido Tarea -->
        <div class="task-accordion-content" id="task-content-${task.id}" style="display:none; padding:15px; border-top:1px solid var(--border);">
          <p style="font-size:0.9rem; color:var(--text-secondary); margin-bottom:15px; white-space:pre-wrap; max-height: 80px; overflow-y:auto; border:1px solid #e2e8f0; padding:10px; border-radius:4px; background:#fff;">${escapeHtml(displayDesc)}</p>

          
          <div style="display:flex; gap:20px; margin-bottom:20px; padding:10px; background:#f1f5f9; border-radius:8px; flex-wrap:wrap; align-items:center;">
            <div style="display:flex; align-items:center; gap:10px; font-size:0.9rem;">
              <span>📅 Fecha Entrega:</span>
              <input type="date" class="form-input offline-config-date" data-task="${task.id}" value="${config.dueDate || ''}" style="padding:4px 8px; font-size:0.9rem; width:130px;">
            </div>
            <div style="display:flex; align-items:center; gap:10px; font-size:0.9rem;">
              <span>📋 Publicar Rúbrica:</span>
              <label class="toggle-switch">
                <input type="checkbox" class="offline-config-toggle" data-task="${task.id}" data-field="rubricPublished" ${config.rubricPublished ? 'checked' : ''}>
                <span class="toggle-slider"></span>
              </label>
            </div>
            <div style="display:flex; align-items:center; gap:10px; font-size:0.9rem;">
              <span>📊 Publicar Nota:</span>
              <label class="toggle-switch">
                <input type="checkbox" class="offline-config-toggle" data-task="${task.id}" data-field="gradesPublished" ${config.gradesPublished ? 'checked' : ''}>
                <span class="toggle-slider"></span>
              </label>
            </div>
          </div>

          <h4 style="font-size:1rem; margin-bottom:10px; color:var(--text-primary);">Alumnos</h4>
          <div style="display:flex; flex-direction:column; gap:5px;">
    `;
    
    members.forEach(member => {
      const mUid = member.uid || member.id || member.student_id;
      const grade = offlineGrades[task.id] && (offlineGrades[task.id][mUid] || offlineGrades[task.id][member.uid] || offlineGrades[task.id][member.id]);
      const hasGrade = grade && typeof grade.finalGrade === 'number';
      const gradeColor = !hasGrade ? 'var(--text-muted)' : (grade.finalGrade >= 5 ? 'var(--success)' : 'var(--danger)');
      const mName = member.displayNameAnonymized || member.displayName || member.display_name_anon || member.display_name || (member.email ? member.email.split('@')[0] : 'Alumno');
      
      html += `
            <div style="border:1px solid #e2e8f0; border-radius:6px; overflow:hidden;">
              <div class="student-accordion-header" style="padding:10px 15px; background:${hasGrade ? '#f0fdf4' : '#fff'}; display:flex; justify-content:space-between; align-items:center; cursor:pointer;" data-task="${task.id}" data-uid="${mUid}">
                <div style="display:flex; align-items:center; gap:10px;">
                  <span class="student-expand-icon" style="font-size:0.8rem; color:#94a3b8;">▶️</span>
                  <span style="font-weight:bold;">${escapeHtml(mName)}</span>
                </div>
                <span style="font-weight:bold; color:${gradeColor};">
                  ${hasGrade ? grade.finalGrade.toFixed(2) : 'Sin evaluar'}
                </span>
              </div>
              <div class="student-accordion-content" id="student-rubric-${task.id}-${mUid}" style="display:none; padding:15px; border-top:1px solid #e2e8f0; background:#f8fafc;">
                <div style="text-align:center;"><div class="spinner"></div></div>
              </div>
            </div>
      `;
    });
    
    html += `
          </div>
        </div>
      </div>
    `;
  });
  html += `</div>`;
  
  container.innerHTML = html;

  // Eventos de Toggles de Configuración
  $$('.offline-config-toggle').forEach(el => {
    el.addEventListener('change', async (e) => {
      const taskId = e.target.dataset.task;
      const field = e.target.dataset.field;
      const value = e.target.checked;
      
      try {
        let docId;
        if (offlineTasksConfig[taskId]) {
          docId = offlineTasksConfig[taskId].id;
          await updateDoc(doc(db, 'offline_tasks_config', docId), { [field]: value });
          offlineTasksConfig[taskId][field] = value;
        } else {
          const newDoc = { classId: classData.id, taskId, isActive: false, rubricPublished: false, gradesPublished: false, dueDate: '', [field]: value };
          const ref = await addDoc(collection(db, 'offline_tasks_config'), newDoc);
          offlineTasksConfig[taskId] = { id: ref.id, ...newDoc };
        }
        showToast('Guardado', 'Configuración actualizada', 'success', 1500);
      } catch(err) {
        e.target.checked = !value;
        showToast('Error', err.message, 'error');
      }
    });
  });

  // Evento para Fecha de Entrega
  $$('.offline-config-date').forEach(el => {
    el.addEventListener('change', async (e) => {
      const taskId = e.target.dataset.task;
      const value = e.target.value;
      
      try {
        let docId;
        if (offlineTasksConfig[taskId]) {
          docId = offlineTasksConfig[taskId].id;
          await updateDoc(doc(db, 'offline_tasks_config', docId), { dueDate: value });
          offlineTasksConfig[taskId].dueDate = value;
        } else {
          const newDoc = { classId: classData.id, taskId, isActive: false, rubricPublished: false, gradesPublished: false, dueDate: value };
          const ref = await addDoc(collection(db, 'offline_tasks_config'), newDoc);
          offlineTasksConfig[taskId] = { id: ref.id, ...newDoc };
        }
        showToast('Guardado', 'Fecha de entrega actualizada', 'success', 1500);
      } catch(err) {
        showToast('Error', err.message, 'error');
      }
    });
  });

  // Eventos para expandir tareas
  $$('.task-accordion-header').forEach(header => {
    header.addEventListener('click', () => {
      const taskId = header.dataset.task;
      const content = $(`task-content-${taskId}`);
      const icon = header.querySelector('.task-expand-icon');
      if (content.style.display === 'none') {
        content.style.display = 'block';
        icon.textContent = '🔽';
      } else {
        content.style.display = 'none';
        icon.textContent = '▶️';
      }
    });
  });

  // Evento Editar Tarea
  $$('.btn-edit-task').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const taskId = btn.dataset.task;
      const task = CLASSROOM_TASKS.find(t => t.id === taskId);
      const config = offlineTasksConfig[taskId] || {};
      
      $('edit-task-id').value = taskId;
      $('edit-task-title').value = config.customTitle || task.title;
      $('edit-task-desc').value = config.customDescription || task.description;
      $('modal-edit-task').setAttribute('aria-hidden', 'false');
    });
  });

  // Eventos para expandir alumnos
  $$('.student-accordion-header').forEach(header => {
    header.addEventListener('click', async () => {
      const taskId = header.dataset.task;
      const uid = header.dataset.uid;
      const content = $(`student-rubric-${taskId}-${uid}`);
      const icon = header.querySelector('.student-expand-icon');
      
      if (content.style.display === 'none') {
        content.style.display = 'block';
        icon.textContent = '🔽';
        if (content.querySelector('.spinner')) {
          await renderInlineRubric(taskId, uid, content);
        }
      } else {
        content.style.display = 'none';
        icon.textContent = '▶️';
      }
    });
  });

  // Botón Exportar Séneca
  const exportBtn = $('btn-export-seneca');
  if (exportBtn) {
    exportBtn.onclick = () => exportToSeneca(offlineGrades);
  }
}

async function renderInlineRubric(taskId, uid, container) {
  const task = CLASSROOM_TASKS.find(t => t.id === taskId);
  
  let gradeData = null;
  try {
    const snap = await getDocs(query(collection(db, 'offline_grades'), where('classId', '==', classData.id), where('taskId', '==', taskId), where('studentId', '==', uid)));
    if (!snap.empty) {
      gradeData = { id: snap.docs[0].id, ...snap.docs[0].data() };
    }
  } catch(e) {
    console.error(e);
  }

  const scores = gradeData ? (gradeData.rubricScores || {}) : {};
  const feedback = gradeData ? (gradeData.teacherFeedback || '') : '';
  
  let html = `<div class="inline-rubric-form" data-task="${taskId}" data-uid="${uid}" data-gradeid="${gradeData ? gradeData.id : ''}">`;
  
  const activeRubric = task.customRubric || OFFLINE_RUBRIC;
  
  activeRubric.forEach(crit => {
    html += `
      <div style="margin-bottom:10px; border:1px solid #e2e8f0; border-radius:6px; overflow:hidden; background:#fff;">
        <div style="background:#f1f5f9; padding:5px 10px; font-size:0.9rem; font-weight:bold; border-bottom:1px solid #e2e8f0;">
          ${crit.title} <span style="font-weight:normal; font-size:0.8rem; color:var(--text-muted); margin-left:5px;">${crit.desc}</span>
        </div>
        <div style="display:flex;">
    `;
    crit.levels.forEach(lvl => {
      const selected = scores[crit.id] === lvl.points;
      html += `
          <label style="flex:1; display:flex; flex-direction:column; align-items:center; padding:5px; border-right:1px solid #f1f5f9; cursor:pointer; background:${selected ? '#e0e7ff' : 'transparent'};">
            <input type="radio" name="rubric_${taskId}_${uid}_${crit.id}" value="${lvl.points}" ${selected ? 'checked' : ''} style="margin-bottom:5px;">
            <span style="font-size:0.8rem; text-align:center;">${lvl.desc}</span>
            <span style="font-size:0.75rem; font-weight:bold; color:var(--primary);">${lvl.points} pts</span>
          </label>
      `;
    });
    html += `</div></div>`;
  });
  
  html += `
    <div style="margin-top:15px;">
      <label class="form-label" style="font-size:0.9rem;">Comentarios / Feedback:</label>
      <textarea class="form-input rubric-feedback-input" rows="2" style="width:100%; resize:vertical;">${escapeHtml(feedback)}</textarea>
    </div>
    <div style="margin-top:15px; display:flex; justify-content:flex-end; align-items:center; gap:15px;">
      <span style="font-weight:bold; font-size:1.1rem;">Nota: <span class="rubric-live-grade">0.00</span></span>
      <button class="btn btn-primary btn--sm btn-save-inline-rubric">Guardar Calificación</button>
    </div>
  </div>`;
  
  container.innerHTML = html;
  
  // Logic
  const form = container.querySelector('.inline-rubric-form');
  const gradeSpan = form.querySelector('.rubric-live-grade');
  
  const updateInlineGrade = () => {
    let sum = 0;
    activeRubric.forEach(crit => {
      const checked = form.querySelector(`input[name="rubric_${taskId}_${uid}_${crit.id}"]:checked`);
      if (checked) {
        sum += parseFloat(checked.value);
      }
    });
    gradeSpan.textContent = sum.toFixed(2);
    
    // Highlight
    form.querySelectorAll('label').forEach(lbl => {
      const radio = lbl.querySelector('input');
      if (radio && radio.checked) lbl.style.background = '#e0e7ff';
      else lbl.style.background = 'transparent';
    });
  };
  
  form.querySelectorAll('input[type="radio"]').forEach(r => r.addEventListener('change', updateInlineGrade));
  updateInlineGrade();
  
  form.querySelector('.btn-save-inline-rubric').onclick = async (e) => {
    const btn = e.target;
    btn.disabled = true;
    btn.textContent = 'Guardando...';
    
    let sum = 0, count = 0;
    const newScores = {};
    activeRubric.forEach(crit => {
      const checked = form.querySelector(`input[name="rubric_${taskId}_${uid}_${crit.id}"]:checked`);
      if (checked) {
        const val = parseFloat(checked.value);
        newScores[crit.id] = val;
        sum += val;
        count++;
      }
    });
    
    if (count !== activeRubric.length) {
      showToast('Aviso', 'Faltan criterios por evaluar', 'warning');
      btn.disabled = false;
      btn.textContent = 'Guardar Calificación';
      return;
    }
    
    const finalGrade = sum;
    const fb = form.querySelector('.rubric-feedback-input').value.trim();
    
    const docData = {
      classId: classData.id,
      taskId: taskId,
      studentId: uid,
      rubricScores: newScores,
      finalGrade: finalGrade,
      teacherFeedback: fb,
      updatedAt: serverTimestamp()
    };
    
    try {
      const gradeId = form.dataset.gradeid;
      if (gradeId) {
        await updateDoc(doc(db, 'offline_grades', gradeId), docData);
      } else {
        const ref = await addDoc(collection(db, 'offline_grades'), docData);
        form.dataset.gradeid = ref.id;
      }
      showToast('Guardado', 'Calificación guardada', 'success');
      
      // Update header UI
      const header = document.querySelector(`.student-accordion-header[data-task="${taskId}"][data-uid="${uid}"]`);
      if (header) {
        header.style.background = '#f0fdf4';
        header.children[1].textContent = finalGrade.toFixed(2);
        header.children[1].style.color = finalGrade >= 5 ? 'var(--success)' : 'var(--danger)';
      }
      
    } catch(err) {
      showToast('Error', err.message, 'error');
    } finally {
      btn.disabled = false;
      btn.textContent = 'Guardar Calificación';
    }
  };
}

function exportToSeneca(offlineGrades) {
  let csv = "Apellidos y Nombre;";
  CLASSROOM_TASKS.forEach(t => {
    csv += `"${t.title.replace(/"/g, '""')}";`;
  });
  csv += "\n";
  
  members.forEach(m => {
    let nameToPrint = m.displayName || m.displayNameAnonymized || m.name || m.email;
    csv += `"${nameToPrint}";`;
    
    CLASSROOM_TASKS.forEach(t => {
      const sid = m.uid || m.id || m.student_id;
      const grade = offlineGrades[t.id] && (offlineGrades[t.id][sid] || offlineGrades[t.id][m.uid] || offlineGrades[t.id][m.id]);
      if (grade && typeof grade.finalGrade === 'number') {
        csv += `"${grade.finalGrade.toFixed(2).replace('.', ',')}";`;
      } else {
        csv += `;"`;
      }
    });
    csv += "\n";
  });
  
  const blob = new Blob(["\uFEFF" + csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.setAttribute("href", url);
  a.setAttribute("download", `Clase_${classData.name}_Seneca.csv`);
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}

// Edit Task Modal Events
if ($('btn-close-edit-task')) {
  $('btn-close-edit-task').addEventListener('click', () => $('modal-edit-task').setAttribute('aria-hidden', 'true'));
  $('btn-cancel-edit-task').addEventListener('click', () => $('modal-edit-task').setAttribute('aria-hidden', 'true'));
  $('modal-edit-task').addEventListener('click', e => {
    if (e.target === $('modal-edit-task')) $('modal-edit-task').setAttribute('aria-hidden', 'true');
  });

  $('form-edit-task').addEventListener('submit', async (e) => {
    e.preventDefault();
    const taskId = $('edit-task-id').value;
    const customTitle = $('edit-task-title').value.trim();
    const customDescription = $('edit-task-desc').value.trim();
    
    if (!taskId) return;
    
    try {
      if (offlineTasksConfig[taskId]) {
        await updateDoc(doc(db, 'offline_tasks_config', offlineTasksConfig[taskId].id), { customTitle, customDescription });
        offlineTasksConfig[taskId].customTitle = customTitle;
        offlineTasksConfig[taskId].customDescription = customDescription;
      } else {
        const newDoc = { classId: classData.id, taskId, isActive: false, rubricPublished: false, gradesPublished: false, dueDate: '', customTitle, customDescription };
        const ref = await addDoc(collection(db, 'offline_tasks_config'), newDoc);
        offlineTasksConfig[taskId] = { id: ref.id, ...newDoc };
      }
      $('modal-edit-task').setAttribute('aria-hidden', 'true');
      showToast('Guardado', 'Tarea actualizada', 'success', 1500);
      
      // Actualizar el DOM sin recargar la página (al menos el título)
      const headerTitle = document.querySelector(`.task-accordion-header[data-task="${taskId}"] h3`);
      if (headerTitle) {
        // Encontrar el task original para mantener el bloque/criterio
        const task = CLASSROOM_TASKS.find(t => t.id === taskId);
        const index = CLASSROOM_TASKS.findIndex(t => t.id === taskId);
        headerTitle.innerHTML = `
          <span class="task-expand-icon">▶️</span>
          ${index + 1}. ${escapeHtml(customTitle)}
          <button class="btn-ghost btn-edit-task" data-task="${taskId}" style="font-size:0.9rem; padding:4px; margin-left:5px;" title="Personalizar tarea" onclick="event.stopPropagation()">✏️</button>
          <span class="badge" style="background:#e2e8f0; color:#475569; font-size:0.75rem;">Bloque ${task.block} | Crit ${task.crit}</span>
        `;
        
        // Update edit button listener again since we replaced HTML
        const newEditBtn = headerTitle.querySelector('.btn-edit-task');
        if (newEditBtn) {
          newEditBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            $('edit-task-id').value = taskId;
            $('edit-task-title').value = offlineTasksConfig[taskId].customTitle || task.title;
            $('edit-task-desc').value = offlineTasksConfig[taskId].customDescription || task.description;
            $('modal-edit-task').setAttribute('aria-hidden', 'false');
          });
        }
      }
      
      const contentDesc = document.querySelector(`#task-content-${taskId} p`);
      if (contentDesc) {
        contentDesc.innerHTML = escapeHtml(customDescription);
      }
      
    } catch(err) {
      showToast('Error', err.message, 'error');
    }
  });
}

// ══════════════════════════════════════════════════════════════
//  TAB: MATRIZ DE CRITERIOS (PROGRAMACIÓN DIDÁCTICA)
// ══════════════════════════════════════════════════════════════

let matrixWorkingMapping = null;
let matrixAutoSaveTimeout = null;

async function loadCurriculumMatrixTab() {
  const container = $('curriculum-matrix-table-container');
  if (!container || !classData) return;

  const classSubject = classData.subject_id || classData.subjectId || 'cyr';
  const classLevel = classSubject === 'tic2'
    ? '2'
    : ((classData.level && classData.level.includes('2')) ? '2' : (classData.level && classData.level.includes('3')) ? '3' : '1');

  // Inicializar mapping de trabajo a partir de la clase (o vacío para usar genérico)
  if (!matrixWorkingMapping) {
    const rawMapping = classData.criteriaMapping || classData.criteria_mapping || {};
    matrixWorkingMapping = JSON.parse(JSON.stringify(rawMapping));
  }

  const allCriteria = getCurriculumCriteria(classSubject, classLevel);
  const allActivities = getCurriculumActivities(classSubject, classLevel);

  // Poblar selector de bloques si está vacío
  const blockSelect = $('matrix-filter-block');
  if (blockSelect && blockSelect.options.length <= 1) {
    const blocks = Array.from(new Set(allCriteria.map(c => c.block).filter(Boolean))).sort();
    blocks.forEach(b => {
      const opt = document.createElement('option');
      opt.value = b;
      opt.textContent = b;
      blockSelect.appendChild(opt);
    });
  }

  updateMatrixStatusBadge();

  function updateMatrixStatusBadge() {
    const badge = $('matrix-status-badge');
    if (!badge) return;
    const isCustom = hasCustomMapping({ criteriaMapping: matrixWorkingMapping });
    if (isCustom) {
      badge.textContent = '🟡 Programación Personalizada (Aula)';
      badge.style.background = '#fef3c7';
      badge.style.color = '#92400e';
    } else {
      badge.textContent = '🟢 Programación Genérica (LOMLOE)';
      badge.style.background = '#d1fae5';
      badge.style.color = '#065f46';
    }
  }

  function renderMatrix() {
    const typeFilter = $('matrix-filter-type')?.value || 'all';
    const blockFilter = $('matrix-filter-block')?.value || 'all';
    const searchQuery = ($('matrix-search')?.value || '').trim().toLowerCase();

    const effective = getEffectiveCriteriaMapping(classSubject, classLevel, matrixWorkingMapping);

    // Filtrar actividades
    let activities = allActivities.filter(a => {
      if (typeFilter !== 'all' && a.type !== typeFilter) return false;
      if (searchQuery) {
        const matchesAct = a.name.toLowerCase().includes(searchQuery) || a.typeLabel.toLowerCase().includes(searchQuery);
        const matchesCrit = allCriteria.some(c =>
          (c.crit.toLowerCase().includes(searchQuery) || c.text.toLowerCase().includes(searchQuery)) &&
          (effective[a.key] || []).includes(c.crit)
        );
        if (!matchesAct && !matchesCrit) return false;
      }
      return true;
    });

    // Filtrar criterios
    let criteria = allCriteria.filter(c => {
      if (blockFilter !== 'all' && c.block !== blockFilter) return false;
      if (searchQuery) {
        const matchesCrit = (c.crit || '').toLowerCase().includes(searchQuery) ||
                            (c.text || '').toLowerCase().includes(searchQuery) ||
                            (c.block || '').toLowerCase().includes(searchQuery);
        const matchesLinkedAct = activities.some(a =>
          a.name.toLowerCase().includes(searchQuery) && (effective[a.key] || []).includes(c.crit)
        );
        if (!matchesCrit && !matchesLinkedAct) return false;
      }
      return true;
    });

    if (criteria.length === 0 || activities.length === 0) {
      container.innerHTML = `
        <div style="padding:40px; text-align:center; color:var(--text-muted);">
          <span style="font-size:2rem; display:block; margin-bottom:10px;">🔍</span>
          No se encontraron criterios o actividades que coincidan con los filtros seleccionados.
        </div>
      `;
      return;
    }

    // Recuentos
    const actCounts = {};
    activities.forEach(a => {
      actCounts[a.key] = (effective[a.key] || []).length;
    });

    const critCounts = {};
    criteria.forEach(c => {
      critCounts[c.crit] = 0;
      activities.forEach(a => {
        if ((effective[a.key] || []).includes(c.crit)) {
          critCounts[c.crit]++;
        }
      });
    });

    let html = `
      <table class="matrix-table">
        <thead>
          <tr>
            <th class="matrix-corner-th" style="text-align:left;">
              <div style="font-weight:700; color:var(--text-primary); font-size:0.9rem;">Criterio LOMLOE</div>
              <div style="font-size:0.75rem; color:var(--text-muted); font-weight:normal;">${criteria.length} criterios · ${activities.length} actividades</div>
            </th>
            ${activities.map(a => {
              const pillClass = a.type === 'game' ? 'pill-game' : a.type === 'test' ? 'pill-test' : 'pill-task';
              return `
                <th class="matrix-th-activity" title="${escapeHtml(a.name)}">
                  <div class="activity-card-header">
                    <span class="activity-type-pill ${pillClass}">${a.typeLabel}</span>
                    <span style="font-size:1.3rem;">${a.icon}</span>
                    <span style="font-weight:600; font-size:0.8rem; line-height:1.2; word-break:break-word; max-width:130px;">
                      ${escapeHtml(a.name.length > 25 ? a.name.substring(0, 23) + '…' : a.name)}
                    </span>
                  </div>
                </th>
              `;
            }).join('')}
            <th class="matrix-corner-right-th">Total Act.</th>
          </tr>
        </thead>
        <tbody>
    `;

    criteria.forEach(c => {
      const critTotal = critCounts[c.crit] || 0;
      html += `
        <tr data-crit-row="${c.crit}">
          <th class="matrix-col-crit" title="${escapeHtml(c.text)}">
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:2px;">
              <strong style="color:var(--primary); font-size:0.95rem;">CE ${c.crit}</strong>
              <span class="badge" style="font-size:0.7rem; padding:2px 6px; background:#f1f5f9; color:#475569;">${escapeHtml(c.block)}</span>
            </div>
            <div style="font-size:0.78rem; color:var(--text-secondary); line-height:1.3; display:-webkit-box; -webkit-line-clamp:2; -webkit-box-orient:vertical; overflow:hidden;">
              ${escapeHtml(c.text)}
            </div>
          </th>
          ${activities.map(a => {
            const assigned = (effective[a.key] || []).includes(c.crit);
            return `
              <td class="matrix-cell ${assigned ? 'cell-active' : ''}" data-act-key="${a.key}" data-crit="${c.crit}" title="Asignar CE ${c.crit} a ${escapeHtml(a.name)}">
                <input type="checkbox" class="matrix-checkbox" data-act-key="${a.key}" data-crit="${c.crit}" ${assigned ? 'checked' : ''}>
              </td>
            `;
          }).join('')}
          <td class="matrix-col-total">
            <span class="badge-count ${critTotal > 0 ? 'badge-count-1' : 'badge-count-0'}" id="row-count-${c.crit.replace(/\./g, '_')}">${critTotal}</span>
          </td>
        </tr>
      `;
    });

    html += `
        </tbody>
        <tfoot>
          <tr class="matrix-footer-tr">
            <th class="matrix-footer-corner-left" style="text-align:left; padding:10px 12px;">
              <div style="font-weight:700;">Criterios asignados</div>
              <div style="font-size:0.75rem; color:var(--text-muted); font-weight:normal;">1 óptimo · >1 excepción</div>
            </th>
            ${activities.map(a => {
              const count = actCounts[a.key] || 0;
              const badgeClass = count === 1 ? 'badge-count-1' : count > 1 ? 'badge-count-multi' : 'badge-count-0';
              const cleanId = a.key.replace(/[:.]/g, '_');
              return `
                <td style="padding:10px 8px;">
                  <span class="badge-count ${badgeClass}" id="col-count-${cleanId}">${count}</span>
                </td>
              `;
            }).join('')}
            <td class="matrix-footer-corner-right" id="matrix-grand-total">
              ${Object.values(critCounts).reduce((acc, cur) => acc + cur, 0)}
            </td>
          </tr>
        </tfoot>
      </table>
    `;

    container.innerHTML = html;
    bindMatrixCellEvents(activities, criteria);
  }

  function bindMatrixCellEvents(activities, criteria) {
    const cells = container.querySelectorAll('.matrix-cell');
    cells.forEach(td => {
      td.addEventListener('click', (e) => {
        const checkbox = td.querySelector('input.matrix-checkbox');
        if (e.target !== checkbox) {
          checkbox.checked = !checkbox.checked;
        }
        handleToggle(checkbox.dataset.actKey, checkbox.dataset.crit, checkbox.checked, td, activities, criteria);
      });
    });
  }

  function handleToggle(actKey, critCode, isChecked, td, activities, criteria) {
    if (td) {
      if (isChecked) td.classList.add('cell-active');
      else td.classList.remove('cell-active');
    }

    // Inicializar si aún no tiene sobreescritura
    if (!matrixWorkingMapping[actKey]) {
      const generic = getEffectiveCriteriaMapping(classSubject, classLevel, null);
      matrixWorkingMapping[actKey] = [...(generic[actKey] || [])];
    }

    let list = matrixWorkingMapping[actKey] || [];
    if (isChecked) {
      if (!list.includes(critCode)) list.push(critCode);
    } else {
      list = list.filter(c => c !== critCode);
    }
    matrixWorkingMapping[actKey] = list;

    // Actualizar recuento de columna
    const colCountEl = $(`col-count-${actKey.replace(/[:.]/g, '_')}`);
    if (colCountEl) {
      const newCount = list.length;
      colCountEl.textContent = newCount;
      colCountEl.className = `badge-count ${newCount === 1 ? 'badge-count-1' : newCount > 1 ? 'badge-count-multi' : 'badge-count-0'}`;
    }

    // Actualizar recuento de fila
    const effective = getEffectiveCriteriaMapping(classSubject, classLevel, matrixWorkingMapping);
    const rowCountEl = $(`row-count-${critCode.replace(/\./g, '_')}`);
    if (rowCountEl) {
      let rCount = 0;
      activities.forEach(a => {
        if ((effective[a.key] || []).includes(critCode)) rCount++;
      });
      rowCountEl.textContent = rCount;
      rowCountEl.className = `badge-count ${rCount > 0 ? 'badge-count-1' : 'badge-count-0'}`;
    }

    // Actualizar gran total
    const grandTotalEl = $('matrix-grand-total');
    if (grandTotalEl) {
      let total = 0;
      activities.forEach(a => {
        total += (effective[a.key] || []).length;
      });
      grandTotalEl.textContent = total;
    }

    updateMatrixStatusBadge();

    // Debounced auto-save
    if (matrixAutoSaveTimeout) clearTimeout(matrixAutoSaveTimeout);
    matrixAutoSaveTimeout = setTimeout(() => {
      saveMatrixChanges(true);
    }, 2500);
  }

  // Filtros
  const filterType = $('matrix-filter-type');
  if (filterType) filterType.onchange = () => renderMatrix();

  const filterBlock = $('matrix-filter-block');
  if (filterBlock) filterBlock.onchange = () => renderMatrix();

  const searchInput = $('matrix-search');
  if (searchInput) searchInput.oninput = () => renderMatrix();

  // Guardar manual
  const saveBtn = $('btn-save-matrix');
  if (saveBtn) {
    saveBtn.onclick = async () => {
      await saveMatrixChanges(false);
    };
  }

  // Reset a genérica
  const resetBtn = $('btn-reset-matrix');
  if (resetBtn) {
    resetBtn.onclick = async () => {
      if (!confirm('¿Restablecer la programación de esta clase a los valores genéricos de la normativa? Se descartarán las modificaciones personalizadas de este aula.')) {
        return;
      }
      try {
        showLoading();
        matrixWorkingMapping = {};
        await updateClass(classData.id, { criteriaMapping: {} });
        classData.criteriaMapping = {};
        hideLoading();
        showToast('Restablecido', 'Programación restablecida a la genérica LOMLOE', 'success');
        updateMatrixStatusBadge();
        renderMatrix();
      } catch (err) {
        hideLoading();
        showToast('Error', err.message, 'error');
      }
    };
  }

  // Exportar CSV
  const exportBtn = $('btn-export-matrix-csv');
  if (exportBtn) {
    exportBtn.onclick = () => {
      const effective = getEffectiveCriteriaMapping(classSubject, classLevel, matrixWorkingMapping);
      const csv = exportCurriculumMatrixCSV(classSubject, classLevel, effective);
      const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.setAttribute('href', url);
      link.setAttribute('download', `matriz_criterios_${classSubject}_${classData.name.replace(/\s+/g, '_')}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    };
  }

  async function saveMatrixChanges(isAutoSave = false) {
    try {
      if (matrixAutoSaveTimeout) clearTimeout(matrixAutoSaveTimeout);
      if (!isAutoSave) showLoading();
      await updateClass(classData.id, { criteriaMapping: matrixWorkingMapping });
      classData.criteriaMapping = { ...matrixWorkingMapping };
      if (!isAutoSave) {
        hideLoading();
        showToast('Guardado', 'Matriz de criterios guardada correctamente', 'success');
      } else {
        showToast('Auto-guardado', 'Cambios guardados en la nube', 'info');
      }
      updateMatrixStatusBadge();
    } catch (err) {
      if (!isAutoSave) hideLoading();
      showToast('Error', err.message, 'error');
    }
  }

  renderMatrix();
}

// ══════════════════════════════════════════════════════════════
//  TAB: CUADERNO DOCENTE (EVALUACIÓN CONTINUA LOMLOE)
// ══════════════════════════════════════════════════════════════

let gradebookData = null;
let gradebookView = 'competencies'; // 'competencies' | 'criteria' | 'tasks'
let gradebookSearchQuery = '';
let gradebookStatusFilter = 'all'; // 'all' | 'passed' | 'failed' | 'pending'
let gradebookControlsAttached = false;

async function loadGradebookTab() {
  const container = $('gradebook-table-container');
  if (!container || !classData) return;

  container.innerHTML = `
    <div style="text-align:center; padding:50px;">
      <div class="spinner"></div>
      <p style="margin-top:10px; color:var(--text-muted);">Calculando calificaciones y ponderación curricular...</p>
    </div>`;

  try {
    if (!members || members.length === 0) {
      members = await getClassMembers(classData.id);
    }

    const classSubject = classData.subject_id || classData.subjectId || 'cyr';
    const classLevel = classSubject === 'tic2'
      ? '2'
      : ((classData.level && String(classData.level).includes('2')) ? '2' : (classData.level && String(classData.level).includes('3')) ? '3' : '1');

    // Tareas según la asignatura
    const tasks = classSubject === 'tic2' ? TIC2_CLASSROOM_TASKS : CYR_CLASSROOM_TASKS;

    // Recopilar IDs y alias de todos los alumnos de la clase (incluyendo legacy UIDs)
    const studentIds = members.map(m => m.id || m.uid).filter(Boolean);
    const studentIdAliases = {};
    members.forEach(m => {
      const sid = m.id || m.uid;
      if (sid) {
        studentIdAliases[sid] = [m.id, m.uid].filter(Boolean);
      }
    });

    try {
      const { getLegacyStudentIds } = await import('./common/db.js');
      await Promise.all(members.map(async m => {
        const sid = m.id || m.uid;
        if (!sid) return;
        const leg = await getLegacyStudentIds(sid);
        if (leg && leg.length > 0) {
          leg.forEach(lid => {
            if (!studentIds.includes(lid)) studentIds.push(lid);
            if (!studentIdAliases[sid].includes(lid)) studentIdAliases[sid].push(lid);
          });
        }
      }));
    } catch (_) {}

    // Cargar en paralelo: calificaciones offline, tests de repaso, partidas de juegos y assignments
    const [gradesSnap, topicTestsRes, gamesRes, assignments] = await Promise.all([
      getDocs(query(collection(db, 'offline_grades'), where('classId', '==', classData.id))),
      supabase.from('topic_test_results').select('*').in('student_id', studentIds).order('created_at', { ascending: false }),
      supabase.from('game_results').select('*').in('student_id', studentIds).order('created_at', { ascending: false }),
      getClassAssignments(classData.id).catch(() => [])
    ]);

    const offlineGrades = {};
    const iterateSnap = (s, cb) => {
      if (s && typeof s.forEach === 'function') s.forEach(cb);
      else if (s && Array.isArray(s.docs)) s.docs.forEach(cb);
    };
    iterateSnap(gradesSnap, d => {
      const data = typeof d.data === 'function' ? d.data() : d;
      const tid = data.taskId || data.task_id;
      const sid = data.studentId || data.student_id;
      if (tid && sid) {
        if (!offlineGrades[tid]) offlineGrades[tid] = {};
        offlineGrades[tid][sid] = { id: d.id, ...data };
      }
    });

    const topicTestResults = topicTestsRes.data || [];
    const gameResults = gamesRes.data || [];
    const reviewTests = getSubjectReviewTests(classSubject);

    // Matriz de criterios efectiva y catálogo normativo
    const rawMapping = classData.criteriaMapping || classData.criteria_mapping || null;
    const criteriaMapping = getEffectiveCriteriaMapping(classSubject, classLevel, rawMapping);
    const criteriaList = getCurriculumCriteria(classSubject, classLevel);

    // Calcular el cuaderno docente
    gradebookData = calculateGradebook({
      members,
      tasks,
      reviewTests,
      offlineGrades,
      topicTestResults,
      gameResults,
      assignments: assignments || [],
      criteriaMapping,
      criteriaList,
      subjectId: classSubject,
      level: classLevel,
      studentIdAliases
    });

    // Actualizar Tarjetas KPI de Aula
    updateGradebookKPIs(gradebookData);

    // Adjuntar escuchadores de interfaz (búsqueda, filtros, vistas, exportación)
    attachGradebookControls();

    // Renderizar la tabla con la vista activa
    renderGradebookTable();

  } catch (err) {
    console.error('Error cargando cuaderno docente:', err);
    container.innerHTML = `
      <div class="empty-state" style="color:var(--error); padding: 30px; text-align: center;">
        ⚠️ Error al calcular el cuaderno docente.<br>
        <small style="color:var(--text-muted);">${escapeHtml(err.message)}</small>
      </div>`;
  }
}

function updateGradebookKPIs(data) {
  if (!data || !data.stats) return;
  const { stats, tasks } = data;

  // 1. Nota media del aula
  const avgEl = $('gb-stat-class-avg');
  const qualBadgeEl = $('gb-stat-qualitative-badge');
  if (avgEl && qualBadgeEl) {
    if (stats.classAverage !== null) {
      avgEl.textContent = stats.classAverage.toFixed(2);
      const q = getQualitativeGrade(stats.classAverage);
      qualBadgeEl.textContent = `${q.label} (${q.code})`;
      qualBadgeEl.className = `badge ${q.badgeClass}`;
      qualBadgeEl.style.display = 'inline-block';
    } else {
      avgEl.textContent = '—';
      qualBadgeEl.style.display = 'none';
    }
  }

  // 2. Tasa de aprobados
  const passEl = $('gb-stat-pass-rate');
  const countEl = $('gb-stat-pass-count');
  if (passEl && countEl) {
    if (stats.studentsWithGrade > 0) {
      passEl.textContent = `${stats.passRate}%`;
      const passedCount = Math.round((stats.passRate / 100) * stats.studentsWithGrade);
      countEl.textContent = `(${passedCount}/${stats.studentsWithGrade} evaluados)`;
      passEl.style.color = stats.passRate >= 75 ? 'var(--success)' : stats.passRate >= 50 ? '#eab308' : 'var(--error)';
    } else {
      passEl.textContent = '—';
      countEl.textContent = '(0 evaluados)';
      passEl.style.color = 'var(--text-muted)';
    }
  }

  // 3. Criterio a reforzar
  const reinfEl = $('gb-stat-reinforce');
  if (reinfEl) {
    if (stats.criteriaToReinforce && stats.criteriaToReinforce.length > 0) {
      const topIssue = stats.criteriaToReinforce[0];
      reinfEl.textContent = `Crit. ${topIssue.crit} (${topIssue.average.toFixed(2)})`;
      reinfEl.style.color = '#b45309';
      reinfEl.title = `Criterio ${topIssue.crit}: ${topIssue.text} - Media de aula: ${topIssue.average.toFixed(2)}`;
    } else if (stats.studentsWithGrade > 0) {
      reinfEl.textContent = 'Todos superados (≥ 5.0)';
      reinfEl.style.color = 'var(--success)';
      reinfEl.title = 'Todos los criterios evaluados tienen una nota media superior a 5.0';
    } else {
      reinfEl.textContent = 'Sin datos suficientes';
      reinfEl.style.color = 'var(--text-muted)';
      reinfEl.title = '';
    }
  }

  // 4. Total actividades evaluables
  const tasksEl = $('gb-stat-tasks-count');
  if (tasksEl) {
    const gameCount = tasks.filter(t => Boolean(getGameIdForTask(t))).length;
    const normalCount = tasks.length - gameCount;
    const testsCount = data.reviewTests ? data.reviewTests.length : 0;
    tasksEl.textContent = `${data.stats.totalActivitiesCount}`;
    tasksEl.title = `${normalCount} tareas de aula, ${gameCount} juegos evaluables y ${testsCount} tests de repaso de temario`;
  }
}

function getGradeBadgeClass(grade) {
  if (grade === null || grade === undefined || isNaN(grade)) return 'gb-badge--empty';
  const n = Number(grade);
  if (n >= 9.0) return 'gb-badge--sb';
  if (n >= 7.0) return 'gb-badge--nt';
  if (n >= 6.0) return 'gb-badge--bi';
  if (n >= 5.0) return 'gb-badge--su';
  return 'gb-badge--in';
}

function renderGradeCell(grade, tooltip = '') {
  if (grade === null || grade === undefined || isNaN(grade)) {
    return `<td style="text-align:center;" title="${escapeHtml(tooltip)}"><span class="gb-badge-grade gb-badge--empty">—</span></td>`;
  }
  const cls = getGradeBadgeClass(grade);
  return `
    <td style="text-align:center;" title="${escapeHtml(tooltip)}">
      <span class="gb-badge-grade ${cls}">
        ${Number(grade).toFixed(1)}
      </span>
    </td>`;
}

function renderGradebookTable() {
  const container = $('gradebook-table-container');
  if (!container || !gradebookData) return;

  const { studentRows, competencies, criteriaList, tasks } = gradebookData;

  // Filtrado de alumnos
  let filtered = studentRows.filter(sr => {
    if (gradebookSearchQuery) {
      const q = gradebookSearchQuery.toLowerCase();
      const matchName = sr.displayName.toLowerCase().includes(q);
      const matchEmail = (sr.email || '').toLowerCase().includes(q);
      if (!matchName && !matchEmail) return false;
    }
    if (gradebookStatusFilter === 'passed') {
      return sr.globalGrade !== null && sr.globalGrade >= 5.0;
    }
    if (gradebookStatusFilter === 'failed') {
      return sr.globalGrade !== null && sr.globalGrade < 5.0;
    }
    if (gradebookStatusFilter === 'pending') {
      return sr.globalGrade === null;
    }
    return true;
  });

  if (filtered.length === 0) {
    container.innerHTML = `
      <div style="text-align:center; padding:40px; color:var(--text-muted);">
        <p style="font-size:1.1rem; margin-bottom:8px;">🔍 No se encontraron alumnos con los filtros seleccionados.</p>
        <button type="button" class="btn btn-ghost btn--sm" id="btn-gb-clear-filters">Limpiar filtros</button>
      </div>`;
    $('btn-gb-clear-filters')?.addEventListener('click', () => {
      gradebookSearchQuery = '';
      gradebookStatusFilter = 'all';
      if ($('gradebook-search')) $('gradebook-search').value = '';
      if ($('gradebook-filter-status')) $('gradebook-filter-status').value = 'all';
      renderGradebookTable();
    });
    return;
  }

  let html = `<table class="gradebook-table"><thead><tr>`;

  // Columna 1 fija: Alumno
  html += `<th class="gb-col-student">Alumno (${filtered.length})</th>`;

  if (gradebookView === 'competencies') {
    // Columnas de Competencias Específicas
    competencies.forEach(comp => {
      html += `
        <th title="${escapeHtml(comp.code + ': ' + comp.name)}">
          <div style="font-size:0.75rem; text-transform:uppercase; color:var(--text-muted);">${escapeHtml(comp.code)}</div>
          <div style="font-weight:700; max-width:130px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">
            ${comp.icon || ''} ${escapeHtml(comp.short || comp.name)}
          </div>
        </th>`;
    });
  } else if (gradebookView === 'criteria') {
    // Columnas de Criterios
    criteriaList.forEach(c => {
      html += `
        <th title="Criterio ${escapeHtml(c.crit)}: ${escapeHtml(c.text || '')}">
          <div style="font-size:0.72rem; color:var(--primary); font-weight:700;">Crit. ${escapeHtml(c.crit)}</div>
          <div style="font-size:0.68rem; color:var(--text-muted); max-width:90px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">
            ${escapeHtml(c.block || '')}
          </div>
        </th>`;
    });
  } else {
    // Columnas de Tareas de aula y juegos
    tasks.forEach(t => {
      const isGame = Boolean(getGameIdForTask(t));
      html += `
        <th title="${escapeHtml(t.title || `Tarea ${t.id}`)}">
          <div style="font-size:0.68rem; text-transform:uppercase; font-weight:700; color:${isGame ? '#e11d48' : '#059669'};">
            ${isGame ? '🕹️ Juego' : '📝 Tarea'}
          </div>
          <div style="font-size:0.8rem; font-weight:600; max-width:130px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">
            ${escapeHtml(t.title || `Tarea ${t.id}`)}
          </div>
        </th>`;
    });
    // Columnas de Tests de Repaso
    (gradebookData.reviewTests || []).forEach(top => {
      html += `
        <th title="Test de Repaso: ${escapeHtml(top.title || top.name)} (Se evalúa SIEMPRE el último intento)">
          <div style="font-size:0.68rem; text-transform:uppercase; font-weight:700; color:#2563eb;">
            📖 Test Repaso
          </div>
          <div style="font-size:0.8rem; font-weight:600; max-width:130px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">
            ${escapeHtml(top.title || top.name)}
          </div>
        </th>`;
    });
    html += `<th style="text-align:center;">% Completadas</th>`;
  }

  // Columnas finales fijas: Nota Global LOMLOE y Calificación
  html += `
    <th class="gb-col-global">Nota Global</th>
    <th class="gb-col-global">Calificación</th>
  </tr></thead><tbody>`;

  // Filas de alumnos
  filtered.forEach(sr => {
    html += `<tr data-student-id="${escapeHtml(sr.studentId)}" class="gb-student-row">`;

    // Celda alumno (clickeable)
    html += `
      <td class="gb-col-student" style="cursor:pointer;" title="Haz clic para ver la ficha completa de evolución del alumno">
        <div style="display:flex; align-items:center; gap:10px;">
          <img src="${escapeHtml(sr.photoURL)}" alt="" style="width:32px; height:32px; border-radius:50%; background:#eee;">
          <div>
            <div style="color:var(--text-primary); font-weight:bold; display:flex; align-items:center; gap:6px;">
              <span>${escapeHtml(sr.displayName)}</span>
              <span style="font-size:0.75rem; color:var(--text-muted); opacity:0.8;">👁️</span>
            </div>
            <small style="color:var(--text-muted); font-size:0.75rem; display:block; max-width:180px; overflow:hidden; text-overflow:ellipsis;">
              ${escapeHtml(sr.email)}
            </small>
          </div>
        </div>
      </td>`;

    if (gradebookView === 'competencies') {
      competencies.forEach(comp => {
        const cg = sr.compGrades[comp.key];
        const val = cg?.grade;
        html += renderGradeCell(val, `${comp.code}: ${cg?.evaluatedCriteriaCount || 0}/${cg?.totalCriteriaCount || 0} criterios evaluados`);
      });
    } else if (gradebookView === 'criteria') {
      criteriaList.forEach(c => {
        const crg = sr.criteriaGrades[c.crit];
        const val = crg?.grade;
        html += renderGradeCell(val, `Crit. ${c.crit}: ${crg?.evaluatedActivitiesCount || 0}/${crg?.totalLinkedActivitiesCount || 0} actividades evaluadas (${crg?.evaluatedTasksCount || 0} tareas, ${crg?.evaluatedTestsCount || 0} tests)`);
      });
    } else {
      tasks.forEach(t => {
        const tg = sr.taskGrades[t.id];
        const val = tg?.grade;
        let tooltip = tg?.feedback || (val !== null ? 'Calificada' : 'Sin entregar');
        if (tg?.isGame && tg?.gameScoreInfo) {
          tooltip = `${tg.feedback || 'Partida de juego'} (${tg.gameScoreInfo})`;
        }
        html += renderGradeCell(val, tooltip);
      });
      (gradebookData.reviewTests || []).forEach(top => {
        const tstg = sr.testGrades[top.id];
        const val = tstg?.grade;
        let tooltip = 'Sin realizar';
        if (val !== null && val !== undefined) {
          const dateStr = tstg.attemptDate ? formatDate({ toDate: () => new Date(tstg.attemptDate) }) : 'Fecha guardada';
          tooltip = `Último intento: ${dateStr}\nNota: ${val.toFixed(2)}/10 (${tstg.attemptsCount} intento${tstg.attemptsCount > 1 ? 's' : ''})`;
        }
        html += renderGradeCell(val, tooltip);
      });
      html += `
        <td style="text-align:center; font-weight:600;">
          <span style="font-size:0.85rem; color:${sr.progressPct >= 75 ? 'var(--success)' : sr.progressPct >= 50 ? '#eab308' : 'var(--text-muted)'};">
            ${sr.progressPct}%
          </span>
          <div style="font-size:0.7rem; color:var(--text-muted);">(${sr.gradedActivitiesCount}/${sr.totalActivitiesCount})</div>
        </td>`;
    }

    // Nota Global y Badge
    if (sr.globalGrade !== null) {
      const q = sr.qualitative;
      html += `
        <td class="gb-col-global" style="font-size:1.05rem;">
          <span class="gb-badge-grade ${getGradeBadgeClass(sr.globalGrade)}">
            ${sr.globalGrade.toFixed(2)}
          </span>
        </td>
        <td class="gb-col-global">
          <span class="badge ${q.badgeClass}" style="font-size:0.78rem;">
            ${q.code} · ${q.label}
          </span>
        </td>`;
    } else {
      html += `
        <td class="gb-col-global"><span class="gb-badge-grade gb-badge--empty">—</span></td>
        <td class="gb-col-global"><span class="badge badge--muted" style="font-size:0.75rem;">Sin calificar</span></td>`;
    }

    html += `</tr>`;
  });

  html += `</tbody></table>`;
  container.innerHTML = html;

  // Eventos de clic en filas para abrir Ficha de Evolución
  container.querySelectorAll('.gb-student-row').forEach(row => {
    row.addEventListener('click', () => {
      const sid = row.dataset.studentId;
      openStudentEvolutionModal(sid);
    });
  });
}

function openStudentEvolutionModal(studentId) {
  if (!gradebookData || !studentId) return;
  const sr = gradebookData.studentRows.find(s => s.studentId === studentId);
  if (!sr) return;

  const modal = $('modal-student-evolution');
  if (!modal) return;

  // Header info
  $('m-evo-avatar').src = sr.photoURL;
  $('m-evo-name').textContent = sr.displayName;
  $('m-evo-email').textContent = sr.email || 'Alumno de la clase';

  const q = sr.qualitative;
  $('m-evo-global-grade').textContent = sr.globalGrade !== null ? sr.globalGrade.toFixed(2) : '—';
  $('m-evo-qualitative-badge').textContent = `${q.label} (${q.code})`;
  $('m-evo-qualitative-badge').className = `badge ${q.badgeClass}`;

  // Progreso
  $('m-evo-progress-text').textContent = `${sr.gradedActivitiesCount} / ${sr.totalActivitiesCount} actividades (${sr.progressPct}%)`;
  $('m-evo-progress-bar').style.width = `${sr.progressPct}%`;
  $('m-evo-progress-bar').style.background = sr.progressPct >= 75 ? 'var(--success)' : sr.progressPct >= 50 ? '#eab308' : 'var(--primary)';

  // Competencias Específicas
  const compListContainer = $('m-evo-competencies-list');
  compListContainer.innerHTML = gradebookData.competencies.map(comp => {
    const cg = sr.compGrades[comp.key];
    const val = cg?.grade;
    const hasGrade = val !== null && val !== undefined;
    const pct = hasGrade ? Math.round(val * 10) : 0;
    const color = hasGrade ? (val >= 7 ? 'var(--success)' : val >= 5 ? '#eab308' : 'var(--error)') : '#94a3b8';
    const qCe = getQualitativeGrade(val);

    return `
      <div class="comp-bar-item">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:6px;">
          <div style="display:flex; align-items:center; gap:8px;">
            <span>${comp.icon || '📌'}</span>
            <strong>${escapeHtml(comp.code)}: ${escapeHtml(comp.name)}</strong>
          </div>
          <div style="display:flex; align-items:center; gap:8px;">
            <span style="font-size:0.8rem; color:var(--text-muted);">${cg?.evaluatedCriteriaCount || 0}/${cg?.totalCriteriaCount || 0} criterios</span>
            <span style="font-size:1.05rem; font-weight:800; color:${color};">${hasGrade ? val.toFixed(2) : '—'}</span>
            <span class="badge ${qCe.badgeClass}" style="font-size:0.7rem;">${qCe.code}</span>
          </div>
        </div>
        <div style="width:100%; height:6px; background:#e2e8f0; border-radius:999px; overflow:hidden;">
          <div style="height:100%; width:${pct}%; background:${color}; transition: width 0.3s ease;"></div>
        </div>
      </div>`;
  }).join('');

  // Criterios de Evaluación
  const passedCount = sr.criteriaPassed;
  const failedCount = sr.criteriaFailed;
  const totalCriteria = gradebookData.criteriaList.length;
  const pendingCount = totalCriteria - (passedCount + failedCount);

  $('m-evo-crit-passed-badge').textContent = `✅ ${passedCount} Adquiridos`;
  $('m-evo-crit-failed-badge').textContent = `⚠️ ${failedCount} En desarrollo`;
  $('m-evo-crit-pending-badge').textContent = `⏳ ${pendingCount} Sin evaluar`;

  const chipsContainer = $('m-evo-criteria-chips');
  chipsContainer.innerHTML = gradebookData.criteriaList.map(c => {
    const crg = sr.criteriaGrades[c.crit];
    const val = crg?.grade;
    let chipClass = 'crit-chip--pending';
    let icon = '⏳';
    let gradeText = 'Sin nota';

    if (val !== null && val !== undefined) {
      if (val >= 5.0) {
        chipClass = 'crit-chip--passed';
        icon = '✅';
        gradeText = val.toFixed(1);
      } else {
        chipClass = 'crit-chip--failed';
        icon = '⚠️';
        gradeText = val.toFixed(1);
      }
    }

    return `
      <div class="crit-chip ${chipClass}" title="Crit. ${escapeHtml(c.crit)}: ${escapeHtml(c.text || '')} (Bloque: ${escapeHtml(c.block || '')})">
        <span>${icon}</span>
        <strong>Crit. ${escapeHtml(c.crit)}</strong>
        <span>(${gradeText})</span>
      </div>`;
  }).join('');

  // Desglose de Actividades (Tareas de aula, juegos y tests de repaso)
  const tasksTbody = $('m-evo-tasks-tbody');
  const classSubject = classData.subject_id || classData.subjectId || 'cyr';
  const classLevel = classSubject === 'tic2' ? '2' : '1';
  const rawMapping = classData.criteriaMapping || classData.criteria_mapping || null;
  const criteriaMapping = getEffectiveCriteriaMapping(classSubject, classLevel, rawMapping);

  const taskRowsHtml = gradebookData.tasks.map(t => {
    const tg = sr.taskGrades[t.id];
    const val = tg?.grade;
    const hasGrade = val !== null && val !== undefined;
    const crits = getCriteriaForTask(t, criteriaMapping);
    const isGame = Boolean(getGameIdForTask(t));

    let sourceNote = '';
    if (tg?.source === 'teacher_rubric') {
      sourceNote = '<span class="badge badge--ghost" style="font-size:0.65rem; color:#6366f1; margin-left:6px;">Rúbrica docente</span>';
    } else if (tg?.source === 'game_result') {
      sourceNote = '<span class="badge badge--ghost" style="font-size:0.65rem; color:#e11d48; margin-left:6px;">Partida juego</span>';
    }

    return `
      <tr>
        <td>
          <div style="display:flex; align-items:center; gap:8px;">
            <span>${isGame ? '🕹️' : '📝'}</span>
            <div>
              <strong>${escapeHtml(t.title || `Tarea ${t.id}`)}</strong>
              ${sourceNote}
            </div>
          </div>
        </td>
        <td style="text-align:center;">
          ${crits.length > 0 
            ? crits.map(cr => `<span class="badge badge--ghost" style="font-size:0.7rem; margin:1px;">${escapeHtml(cr)}</span>`).join('') 
            : '<span style="color:var(--text-muted); font-size:0.75rem;">—</span>'}
        </td>
        <td style="text-align:center;">
          ${hasGrade 
            ? `<span class="gb-badge-grade ${getGradeBadgeClass(val)}">${val.toFixed(2)}</span>` 
            : '<span class="gb-badge-grade gb-badge--empty">Sin calificar</span>'}
        </td>
        <td style="color:var(--text-secondary); font-size:0.8rem;">
          ${tg?.feedback ? escapeHtml(tg.feedback) : '<span style="color:var(--text-muted); font-style:italic;">Sin comentarios</span>'}
        </td>
      </tr>`;
  }).join('');

  const testRowsHtml = (gradebookData.reviewTests || []).map(top => {
    const tstg = sr.testGrades[top.id];
    const val = tstg?.grade;
    const hasGrade = val !== null && val !== undefined;
    const crits = getCriteriaForTest(top.id, criteriaMapping);
    const dateStr = tstg?.attemptDate ? formatDate({ toDate: () => new Date(tstg.attemptDate) }) : '';

    return `
      <tr style="background:rgba(59, 130, 246, 0.03);">
        <td>
          <div style="display:flex; align-items:center; gap:8px;">
            <span>📖</span>
            <div>
              <strong>Test: ${escapeHtml(top.title || top.name)}</strong>
              <span class="badge badge--ghost" style="font-size:0.65rem; color:#2563eb; margin-left:6px;">Test Repaso</span>
            </div>
          </div>
        </td>
        <td style="text-align:center;">
          ${crits.length > 0 
            ? crits.map(cr => `<span class="badge badge--ghost" style="font-size:0.7rem; margin:1px;">${escapeHtml(cr)}</span>`).join('') 
            : '<span style="color:var(--text-muted); font-size:0.75rem;">—</span>'}
        </td>
        <td style="text-align:center;">
          ${hasGrade 
            ? `<span class="gb-badge-grade ${getGradeBadgeClass(val)}">${val.toFixed(2)}</span>` 
            : '<span class="gb-badge-grade gb-badge--empty">Sin realizar</span>'}
        </td>
        <td style="color:var(--text-secondary); font-size:0.8rem;">
          ${hasGrade 
            ? `Último intento: ${escapeHtml(dateStr)} (${tstg.attemptsCount} intento${tstg.attemptsCount > 1 ? 's' : ''})` 
            : '<span style="color:var(--text-muted); font-style:italic;">Sin intentos registrados</span>'}
        </td>
      </tr>`;
  }).join('');

  tasksTbody.innerHTML = taskRowsHtml + testRowsHtml;

  modal.classList.add('modal-backdrop--visible');
}

function attachGradebookControls() {
  if (gradebookControlsAttached) return;
  gradebookControlsAttached = true;

  // View Switcher Buttons
  const viewBtns = document.querySelectorAll('.gradebook-view-btn');
  viewBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      viewBtns.forEach(b => b.classList.remove('gradebook-view-btn--active'));
      btn.classList.add('gradebook-view-btn--active');
      gradebookView = btn.dataset.view;
      renderGradebookTable();
    });
  });

  // Búsqueda
  $('gradebook-search')?.addEventListener('input', (e) => {
    gradebookSearchQuery = e.target.value.trim();
    renderGradebookTable();
  });

  // Filtro estado
  $('gradebook-filter-status')?.addEventListener('change', (e) => {
    gradebookStatusFilter = e.target.value;
    renderGradebookTable();
  });

  // Exportar CSV
  $('btn-gradebook-export-csv')?.addEventListener('click', () => {
    if (!gradebookData) return;
    const classSubject = classData.subject_id || classData.subjectId || 'cyr';
    const csv = exportGradebookCSV(gradebookData, gradebookView);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `cuaderno_${classSubject}_${gradebookView}_${classData.name.replace(/\s+/g, '_')}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  });

  // Imprimir
  $('btn-gradebook-print')?.addEventListener('click', () => {
    window.print();
  });

  // Cerrar Modal Ficha
  const modal = $('modal-student-evolution');
  $('btn-close-evolution-modal')?.addEventListener('click', () => {
    modal.classList.remove('modal-backdrop--visible');
  });
  $('btn-close-evolution-modal-footer')?.addEventListener('click', () => {
    modal.classList.remove('modal-backdrop--visible');
  });
  modal?.addEventListener('click', (e) => {
    if (e.target === modal) modal.classList.remove('modal-backdrop--visible');
  });
}

