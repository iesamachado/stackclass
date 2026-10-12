import { requireAuth, currentUser, currentProfile, classroomToken, refreshClassroomToken, isAdmin } from './common/auth.js';
import { CLASSROOM_TASKS, OFFLINE_RUBRIC } from './common/tasks.js';
import {
  getClass, updateClass, getClassMembers, getClassAssignments,
  toggleGameInClass, toggleTopicInClass, createAssignment, updateAssignment, deleteAssignment,
  getClassRanking, addStudentsToClass, removeStudentFromClass, getStudentResultsInClass,
  getStudentBestScore, getUserProfile
} from './common/db.js';
import { createClassroomAssignment, syncClassroomGrades } from './common/classroom.js';
import { renderHeader, showToast, showLoading, hideLoading, renderPodium, renderRankingTable } from './common/ui.js';
import { GAMES, TOPICS, $, $$, escapeHtml, formatDate, getUrlParams, copyToClipboard } from './common/utils.js';
import { GUILDS_CATALOG, MEDALS_CATALOG, MEDAL_XP, getLeague } from './common/gamification.js';
import { collection, query, where, getDocs, getDoc, addDoc, updateDoc, deleteDoc, doc, onSnapshot, serverTimestamp, db } from './common/firebase-config.js';

let classData = null;
let members   = [];
let activeTab = 'games';
let activeGameFilter = '';
let studentsSortOrder = 'alpha';
let rankingInterval = null;

// ── Guard ───────────────────────────────────────────────────────
requireAuth({
  allowedRoles: ['teacher', 'admin'],
  onAuthorized: async (user, profile) => {
    renderHeader(user, profile);
    const { classId } = getUrlParams();
    if (!classId) { window.location.href = 'dashboard_teacher.html'; return; }

    try {
      classData = await getClass(classId);
      const isOwner = classData && classData.teacherId === user.uid;
      const userIsAdmin = isAdmin(user, profile);

      if (!classData || (!isOwner && !userIsAdmin)) {
        showToast('Acceso denegado', 'No tienes acceso a esta clase.', 'error');
        setTimeout(() => window.location.href = 'dashboard_teacher.html', 2000);
        return;
      }

      initPage(user, profile);
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
      if (tab === 'results') {
          await loadResultsTab();
          rankingInterval = setInterval(() => {
              if (activeTab === 'results') renderResults(false);
          }, 10000);
      }
    });
  });

  // Restore active tab
  const storedTab = localStorage.getItem('classDetailTab') || 'games';
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

  list.innerHTML = Object.values(GAMES).map(g => `
    <div class="game-toggle-row" id="game-row-${g.id}">
      <div class="game-toggle-info">
        <span class="game-toggle-icon">${g.icon}</span>
        <div>
          <strong>${escapeHtml(g.name)}</strong>
          <small>${escapeHtml(g.description)}</small>
        </div>
      </div>
      <div class="game-toggle-actions">
        <a class="btn btn-ghost btn--sm" href="${g.gamePath}?classId=${classData.id}" target="_blank">🎮 Probar</a>
        <label class="toggle-switch" title="${enabled.includes(g.id) ? 'Desactivar' : 'Activar'}">
          <input type="checkbox" 
                 id="toggle-${g.id}"
                 data-game-id="${g.id}"
                 ${enabled.includes(g.id) ? 'checked' : ''}>
          <span class="toggle-slider"></span>
        </label>
      </div>
    </div>`).join('');

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

  list.innerHTML = Object.values(TOPICS).map(t => `
    <div class="game-toggle-row" id="topic-row-${t.id}">
      <div class="game-toggle-info">
        <span class="game-toggle-icon">${t.icon}</span>
        <div>
          <strong>${escapeHtml(t.name)}</strong>
          <small>${escapeHtml(t.description)}</small>
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
  const displayName = m.displayNameAnonymized || m.displayName || m.name || m.email || 'Alumno';
  const identifier = m.uid || m.email;

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

  const pts = m.puntosTotal || 0;
  const gremioInfo = m.gremio ? `<span class="badge" style="background:#eee; color:#333;">🛡️ ${escapeHtml(m.gremio)}</span>` : '';
  const xpBadge = `<span class="badge badge--warning">⭐ ${pts} XP</span>`;

  return `<div class="student-row" style="display:flex; align-items:center; justify-content:space-between; gap:var(--space-3); padding:var(--space-3); border-bottom:1px solid var(--border);">
    <div style="display:flex; align-items:center; gap:var(--space-3);">
      <img class="student-row-avatar"
           src="${escapeHtml(m.photoURL || `https://api.dicebear.com/7.x/bottts/svg?seed=${m.uid}`)}"
           alt="${escapeHtml(displayName)}"
           onerror="this.src='https://api.dicebear.com/7.x/bottts/svg?seed=${m.uid}'">
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
      <button class="btn btn-ghost btn--sm" onclick="window._showMedallas('${escapeHtml(m.uid)}')" title="Ver medallas" style="padding:4px 8px;">
        🏅
      </button>
      <button class="btn btn-ghost btn--sm" data-action="view-history" data-student-id="${escapeHtml(m.uid)}" data-student-name="${escapeHtml(displayName)}" title="Ver historial de partidas" style="padding:4px 8px;">
        📊
      </button>
      <button class="btn btn-ghost btn--sm" data-action="remove-student" data-student-id="${escapeHtml(identifier)}" data-student-name="${escapeHtml(displayName)}" title="Eliminar de la clase" style="color:var(--error); padding:4px 8px;">
        🗑️
      </button>
    </div>
  </div>`;
}

async function showStudentHistory(studentId, studentName) {
  if (!studentId) {
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
    
    // 1. Juegos (globales para calcular XP correcta, pero luego marcamos si es de la clase)
    const snapGames = await getDocs(query(collection(db, 'game_results'), where('studentId', '==', studentId)));
    const games = snapGames.docs.map(d => ({ id: d.id, ...d.data() }));
    games.sort((a, b) => (a.timestamp?.seconds || 0) - (b.timestamp?.seconds || 0));
    
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
        timestamp: r.timestamp?.toDate ? r.timestamp.toDate() : new Date(0)
      });
    });

    // 2. Tests de Repaso
    const snapTests = await getDocs(query(collection(db, 'test_teoria_respuestas'), where('uid', '==', studentId)));
    const tests = snapTests.docs.map(d => d.data());
    tests.sort((a, b) => (a.fecha?.seconds || 0) - (b.fecha?.seconds || 0));
    
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
        timestamp: r.fecha?.toDate ? r.fecha.toDate() : new Date(0)
      });
    });
    
    // 3. Exámenes
    const snapExams = await getDocs(query(collection(db, 'respuestas_test'), where('uid', '==', studentId)));
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
        timestamp: r.fecha?.toDate ? r.fecha.toDate() : new Date(0)
      });
    });
    
    // 4. Tareas Offline
    const snapOffline = await getDocs(query(collection(db, 'offline_grades'), where('studentId', '==', studentId)));
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
        timestamp: r.updatedAt?.toDate ? r.updatedAt.toDate() : new Date(0)
      });
    });

    // Ordenar timeline inverso (más reciente primero)

    // 5. Medallas Obtenidas
    const userSnap = await getDoc(doc(db, 'users', studentId));
    const userLogros = userSnap.data()?.logros || [];
    
    // Mapeo de XP para las medallas conocidas
    const MEDAL_XP = {
        netdefender_300: 50, guardian_red: 100, netdefender_700: 150, netdefender_1000: 200,
        mecanoclass_20: 20, mecanografo: 50, mecanoclass_60: 100, velocista: 120, mecanoclass_100: 250,
        rompecodigos_200: 50, rompecodigos_500: 100, criptologo: 150, rompecodigos_1200: 200,
        helados_1000: 100, helados_1500: 150, helados_2000: 200, helados_2500: 250, helados_3000: 300, helados_35000: 1000,
        moon_3: 50, explorador_lunar: 100, moon_10: 150, moon_15: 200,
        arenabots_50: 50, arenabots_100: 100, arenabots_150: 150, arquitecto_bot: 250,
        cybersmith_100: 50, cybersmith_250: 100, ingeniero: 150, cybersmith_600: 200,
        asimov_20: 30, asimov_50: 60, leyes_robotica: 100, asimov_100: 150,
        appflow_50: 50, appflow_100: 100, unicornio: 150, appflow_300: 200,
        trivial_30: 30, trivial_60: 60, sabiondo: 100,
        madrugador: 10, finde: 10, constancia: 10
    };
    
    userLogros.forEach(medal => {
        const extraXP = MEDAL_XP[medal.id] || 0;
        timeline.push({
            type: 'medal',
            title: `🏅 Medalla: ${medal.icon} ${medal.name}`,
            scoreInfo: medal.desc,
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
    const filteredRanking = ranking.filter(r => members.some(m => m.uid === r.studentId));
    
    const enriched = await Promise.all(filteredRanking.map(async r => {
      let member = members.find(m => m.uid === r.studentId);
      let displayName = member?.displayNameAnonymized || member?.displayName || 'Alumno';
      let photoURL = member?.photoURL || `https://api.dicebear.com/7.x/bottts/svg?seed=${r.studentId}`;
      
      return {
        ...r,
        displayNameAnonymized: displayName,
        photoURL: photoURL
      };
    }));

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

  const counts = {};
  const points = {};
  GUILDS_CATALOG.forEach(g => { counts[g.name] = 0; points[g.name] = 0; });
  members.forEach(m => {
    if (m.gremio && counts[m.gremio] !== undefined) {
      counts[m.gremio]++;
      points[m.gremio] += (m.puntosTotal || 0);
    }
  });
  
  const ranking = GUILDS_CATALOG.map(g => ({
    name: g.name, icon: g.icon, image: g.image, color: g.color,
    points: points[g.name], members: counts[g.name]
  })).sort((a,b) => b.points - a.points);
  
  $('guilds-ranking-list').innerHTML = ranking.map((g, idx) => {
    const isFirst = idx === 0;
    const isSecond = idx === 1;
    const isThird = idx === 2;
    let badge = '';
    let scale = '1';
    let border = g.color;
    let bg = 'var(--bg-card)';
    
    // Buscar al MVP de este gremio
    const guildMembers = members.filter(m => m.gremio === g.name).sort((a,b) => (b.puntosTotal||0) - (a.puntosTotal||0));
    const mvp = guildMembers.length > 0 ? guildMembers[0] : null;
    let mvpHtml = '';
    if (mvp && mvp.puntosTotal > 0) {
      mvpHtml = `<div style="margin-top:12px; background:rgba(0,0,0,0.05); border-radius:8px; padding:8px 12px; display:inline-block; border-left:3px solid ${g.color};">
        <span style="font-size:0.85rem; text-transform:uppercase; color:var(--text-muted); font-weight:bold;">👑 MVP:</span> 
        <span style="font-weight:bold; color:var(--text-primary); margin-left:5px;">${escapeHtml(mvp.displayNameAnonymized || mvp.displayName || mvp.email?.split('@')[0])}</span> 
        <span style="color:var(--warning); font-weight:bold; font-size:0.9rem;">(⭐ ${mvp.puntosTotal})</span>
      </div>`;
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
      <div class="card animate-fade-up delay-${idx+1}" style="display:flex; align-items:center; gap:var(--space-4); padding:var(--space-4); background:${bg}; border:4px solid ${border}; transform:scale(${scale}); transform-origin:center; position:relative; overflow:hidden; box-shadow:6px 6px 0px rgba(0,0,0,${isFirst ? '0.2' : '0.1'}); margin-bottom:10px;">
        ${isFirst ? `<div style="position:absolute; top:-10px; right:-10px; font-size:7rem; opacity:0.1; transform:rotate(-15deg);">${g.icon}</div>` : ''}
        
        <div style="width:80px; height:80px; border-radius:50%; background-color:${g.color}; display:flex; align-items:center; justify-content:center; border:4px solid var(--text-primary); box-shadow:4px 4px 0px rgba(0,0,0,1); flex-shrink:0;">
          <img src="${g.image}" alt="" style="width:100%; height:100%; object-fit:contain; mix-blend-mode:multiply;">
        </div>
        
        <div style="flex:1;">
          <div style="font-size:0.8rem; font-weight:bold; color:${isFirst ? '#d35400' : 'var(--text-muted)'}; margin-bottom:2px; text-transform:uppercase; letter-spacing:2px;">${badge}</div>
          <h3 style="margin:0; font-size:1.8rem; color:${g.color}; text-shadow:1px 1px 0px var(--text-primary); -webkit-text-stroke: 1px var(--text-primary); line-height: 1.1;">${escapeHtml(g.name)}</h3>
          <div style="margin-top:5px; font-size:0.95rem; color:var(--text-primary); font-weight:bold;">
            👥 ${g.members} valientes aportando experiencia
          </div>
          ${mvpHtml}
        </div>
        
        <div style="text-align:right; z-index:2; background:rgba(255,255,255,0.7); padding:8px 15px; border-radius:10px; border:2px solid var(--text-primary); box-shadow:3px 3px 0px rgba(0,0,0,1); display:flex; flex-direction:column; align-items:flex-end;">
          <div style="font-size:0.8rem; font-weight:bold; color:var(--text-primary); text-transform:uppercase; letter-spacing:1px; margin-bottom:2px;">Puntos Totales</div>
          <div style="font-size:2.5rem; font-weight:900; color:var(--warning); text-shadow:1px 1px 0px var(--text-primary), -1px -1px 0 #000, 1px -1px 0 #000, -1px 1px 0 #000, 1px 1px 0 #000; line-height:1;">
            ⭐ ${g.points.toLocaleString()}
          </div>
          ${distanceHtml}
        </div>
      </div>
    `;
  }).join('');
}

let unsubscribeExams = null;

async function loadExamsTab() {
  if (!members || members.length === 0) {
    members = await getClassMembers(classData.id);
  }

  if (unsubscribeExams) unsubscribeExams();
  const examsRef = collection(db, 'classes', classData.id, 'examenes_test');
  unsubscribeExams = onSnapshot(examsRef, (snap) => {
    const exams = [];
    snap.forEach(d => exams.push({ id: d.id, ...d.data() }));
    
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
    const studentIds = members.map(m => m.uid);
    if (studentIds.length === 0) {
      teoriaList.innerHTML = '<tr><td colspan="5" class="text-center text-muted">No hay alumnos en esta clase.</td></tr>';
      return;
    }
    
    // Firebase 'in' max is 10, so we just fetch recent ones or we split chunks. For simplicity in CyR we can just get docs.
    // Assuming class size < 30, we can fetch all or just chunk them.
    // Instead of complex chunks, we can just get ALL from the collection and filter by class. (Since we are teacher).
    getDocs(collection(db, 'test_teoria_respuestas')).then(snap => {
      let results = [];
      snap.forEach(d => {
        let data = d.data();
        if (studentIds.includes(data.uid)) {
          results.push(data);
        }
      });
      
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
        teoriaList.innerHTML = finalResults.map(r => `
          <tr>
            <td>
              <div style="display:flex; align-items:center; gap:10px;">
                <img src="https://api.dicebear.com/7.x/bottts/svg?seed=${r.uid}" style="width:30px; border-radius:50%; background:#eee;">
                <strong>${escapeHtml(r.alumnoNombre || 'Alumno')}</strong>
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
              <button class="btn btn-ghost btn--sm" onclick="window._deleteStudentTests('${r.uid}', '${r.topicId}', '${escapeHtml(r.alumnoNombre || 'Alumno')}')" title="Borrar todos los intentos de este tema" style="color:var(--error)">🗑️</button>
            </td>
          </tr>
        `).join('');
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
  const sorted = [...members].filter(m => !m.pending && (m.puntosTotal || 0) > 0).sort((a,b) => (b.puntosTotal||0) - (a.puntosTotal||0));
  if (sorted.length === 0) {
    container.innerHTML = '';
    return;
  }
  
  const top3 = sorted.slice(0, 3);
  let html = `<div style="display:flex; justify-content:center; gap:16px; margin-bottom:16px; align-items:flex-end;">`;
  
  const renderPos = (m, pos, height, color, emoji) => {
    if (!m) return '';
    const name = m.displayNameAnonymized || m.displayName || m.email || 'Alumno';
    return `
      <div style="display:flex; flex-direction:column; align-items:center; width:100px;">
        <div style="font-size:1.5rem; margin-bottom:4px;">${emoji}</div>
        <img src="${m.photoURL || `https://api.dicebear.com/7.x/bottts/svg?seed=${m.uid}`}" style="width:40px; height:40px; border-radius:50%; margin-bottom:8px; border:2px solid ${color};">
        <div style="font-size:0.8rem; text-align:center; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; width:100%;">${escapeHtml(name)}</div>
        <div style="font-weight:bold; color:${color}; font-size:0.9rem;">${m.puntosTotal || 0} XP</div>
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
    const student = members.find(m => m.uid === uid);
    if (!student) return;
    const name = student.displayNameAnonymized || student.displayName || 'Alumno';
    $('medallas-alumno-nombre').textContent = `Medallero de ${name}`;
    
    const logrosObtenidos = student.logros || [];
    
    const conseguidas = [];
    const noConseguidas = [];
    
    MEDALS_CATALOG.forEach(m => {
      if (logrosObtenidos.some(l => l.id === m.id)) {
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
        
        if (mapping) {
          criteriaContainer.innerHTML = `
            <strong>💡 Sugerencia de Criterios (Andalucía)</strong><br>
            <ul style="margin:4px 0 0 16px; padding:0;">
              <li><strong>1º ESO:</strong> ${escapeHtml(mapping['1º ESO'])}</li>
              <li><strong>2º ESO:</strong> ${escapeHtml(mapping['2º ESO'])}</li>
              <li><strong>3º ESO:</strong> ${escapeHtml(mapping['3º ESO'])}</li>
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
        showToast('Tarea creada', 'Guardada en ClassHub (sin Classroom).', 'success');
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
      studentGrades[m.uid] = {};
    });
    
    validTests.forEach(test => {
      // Filtrar solo alumnos de la clase
      if (!studentGrades[test.uid]) return;
      
      const stats = studentGrades[test.uid];
      
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
      const na = a.displayNameAnonymized || a.displayName || '';
      const nb = b.displayNameAnonymized || b.displayName || '';
      return na.localeCompare(nb);
    }).forEach(m => {
      const name = m.displayNameAnonymized || m.displayName || m.email;
      html += `
        <tr>
          <td style="position:sticky; left:0; background:var(--bg-card); font-weight:bold;">${escapeHtml(name)}</td>
      `;
      
      critList.forEach(c => {
        const d = studentGrades[m.uid][c];
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
  configSnap.forEach(d => {
    offlineTasksConfig[d.data().taskId] = { id: d.id, ...d.data() };
  });

  // Cargar notas offline
  const gradesSnap = await getDocs(query(collection(db, 'offline_grades'), where('classId', '==', classData.id)));
  const offlineGrades = {};
  gradesSnap.forEach(d => {
    const data = d.data();
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
      const grade = offlineGrades[task.id] && offlineGrades[task.id][member.uid];
      const hasGrade = grade && typeof grade.finalGrade === 'number';
      const gradeColor = !hasGrade ? 'var(--text-muted)' : (grade.finalGrade >= 5 ? 'var(--success)' : 'var(--danger)');
      
      html += `
            <div style="border:1px solid #e2e8f0; border-radius:6px; overflow:hidden;">
              <div class="student-accordion-header" style="padding:10px 15px; background:${hasGrade ? '#f0fdf4' : '#fff'}; display:flex; justify-content:space-between; align-items:center; cursor:pointer;" data-task="${task.id}" data-uid="${member.uid}">
                <div style="display:flex; align-items:center; gap:10px;">
                  <span class="student-expand-icon" style="font-size:0.8rem; color:#94a3b8;">▶️</span>
                  <span style="font-weight:bold;">${escapeHtml(member.displayName || member.email.split('@')[0])}</span>
                </div>
                <span style="font-weight:bold; color:${gradeColor};">
                  ${hasGrade ? grade.finalGrade.toFixed(2) : 'Sin evaluar'}
                </span>
              </div>
              <div class="student-accordion-content" id="student-rubric-${task.id}-${member.uid}" style="display:none; padding:15px; border-top:1px solid #e2e8f0; background:#f8fafc;">
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
    let nameToPrint = m.displayName || m.email;
    csv += `"${nameToPrint}";`;
    
    CLASSROOM_TASKS.forEach(t => {
      const grade = offlineGrades[t.id] && offlineGrades[t.id][m.uid];
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
