// ═══════════════════════════════════════════════════════════════════════
//  CLASSHUB — dashboard_student.js
// ═══════════════════════════════════════════════════════════════════════

import { db, collection, query, where, getDocs } from "./common/firebase-config.js";
import { requireAuth, currentUser, currentProfile } from './common/auth.js';
import { getStudentClasses, joinClassByPin, getStudentResults, getClassAssignments } from './common/db.js';
import { renderHeader, showToast, showLoading, hideLoading } from './common/ui.js';
import { GAMES, TOPICS, $, $$, escapeHtml, formatDate, getUrlParams } from './common/utils.js';
import { CLASSROOM_TASKS, OFFLINE_RUBRIC } from './common/tasks.js';

let myClasses = [];

// ── Guard ───────────────────────────────────────────────────────
requireAuth({
  allowedRoles: ['student', 'teacher'],
  onAuthorized: async (user, profile) => {
    renderHeader(user, profile);
    const name = profile.displayNameAnonymized || profile.displayName || 'Alumno';
    $('student-welcome').textContent = `¡Hola, ${name.split(' ')[0]}! 👋`;

    // Gamification
    const pts = profile.puntosTotal || 0;
    const { getLeague } = await import('./common/gamification.js');
    const league = getLeague(pts);
    
    if ($('hero-league-icon')) $('hero-league-icon').textContent = league.icon;
    if ($('hero-league-name')) $('hero-league-name').textContent = league.name;
    if ($('hero-xp')) $('hero-xp').textContent = pts + ' XP';
    
    if (profile.gremio && $('hero-guild-info')) {
      $('hero-guild-info').style.display = 'block';
      if ($('hero-guild-name')) $('hero-guild-name').textContent = profile.gremio;
    }

    checkNoAccessAlert();
    await loadClasses(user);
    await loadExams(user, myClasses);
    await loadAssignments(user);
    await loadOfflineTasks(user);
    await loadHistory(user);
    await loadGrades(user);
    setupModals(user);
  }
});

// ── Mostrar aviso si venía sin acceso a un juego ────────────────
function checkNoAccessAlert() {
  const { noAccess } = getUrlParams();
  if (!noAccess) return;
  const game = GAMES[noAccess];
  const alertEl = $('no-access-alert');
  const msgEl   = $('no-access-msg');
  if (alertEl && msgEl && game) {
    msgEl.innerHTML = `No tienes acceso a <strong>${escapeHtml(game.name)}</strong> ${game.icon}. 
      Tu docente aún no ha habilitado ese juego en ninguna de tus clases.`;
    alertEl.style.display = 'flex';
  }
}

// ── Cargar clases del alumno ────────────────────────────────────
async function loadClasses(user) {
  try {
    myClasses = await getStudentClasses(user.uid);
    renderStudentClasses(myClasses);
    updateStats(myClasses);
  } catch (err) {
    console.error('Error cargando clases:', err);
    showToast('Error', 'No se pudieron cargar tus clases.', 'error');
  }
}

function renderStudentClasses(classes) {
  const list    = $('student-classes-list');
  const noMsg   = $('no-classes-msg');
  if (!list) return;

  if (classes.length === 0) {
    list.innerHTML = '';
    noMsg.style.display = 'block';
    return;
  }
  noMsg.style.display = 'none';

  list.innerHTML = classes.map(cls => renderStudentClassCard(cls)).join('');
}

function renderStudentClassCard(cls) {
  const enabledGames = cls.enabledGames || [];
  const enabledTopics = cls.enabledTopics || [];

  if (enabledGames.length === 0 && enabledTopics.length === 0) {
    return `
      <div class="class-card">
        <div class="class-card-header">
          <h3 class="class-card-name">${escapeHtml(cls.name)}</h3>
        </div>
        <p class="empty-state" style="padding:var(--space-4) 0; font-size:var(--text-sm)">
          Ningún contenido o juego habilitado en esta clase todavía.
        </p>
      </div>`;
  }

  const topicCards = enabledTopics.map(tid => {
    const t = TOPICS[tid];
    if (!t) return '';
    // Como las páginas del temario estarán en root/temario/blockN.html
    return `
      <a class="game-card" href="${t.htmlPath}" target="_blank"
         style="--game-color:${t.color}; --game-color-dark:${t.color}; filter: brightness(1.1);">
        <div class="game-card-icon">${t.icon}</div>
        <div class="game-card-name">${escapeHtml(t.name)}</div>
        <div class="game-card-desc">Ver temario</div>
      </a>`;
  }).join('');

  const gameCards = enabledGames.map(gid => {
    const g = GAMES[gid];
    if (!g) return '';
    return `
      <a class="game-card" href="${g.gamePath}?classId=${cls.id}"
         style="--game-color:${g.color}; --game-color-dark:${g.colorDark}">
        <div class="game-card-icon">${g.icon}</div>
        <div class="game-card-name">${escapeHtml(g.name)}</div>
        <div class="game-card-desc">${escapeHtml(g.description)}</div>
      </a>`;
  }).join('');

  let badges = [];
  if (enabledTopics.length > 0) badges.push(`📚 ${enabledTopics.length} tema${enabledTopics.length !== 1 ? 's' : ''}`);
  if (enabledGames.length > 0) badges.push(`🎮 ${enabledGames.length} juego${enabledGames.length !== 1 ? 's' : ''}`);

  return `
    <div class="class-card">
      <div class="class-card-header">
        <h3 class="class-card-name">${escapeHtml(cls.name)}</h3>
        <div style="display:flex; gap:8px;">
          ${badges.map(b => `<span class="badge badge--accent">${b}</span>`).join('')}
        </div>
      </div>
      
      ${topicCards ? `
        <h4 style="font-size:0.9rem; color:var(--text-secondary); margin:15px 0 10px 0; border-bottom:1px solid var(--border-subtle); padding-bottom:5px;">📚 Bloques Temáticos (Teoría)</h4>
        <div class="games-grid student-games-grid" style="margin-bottom:20px;">${topicCards}</div>
      ` : ''}
      
      ${gameCards ? `
        <h4 style="font-size:0.9rem; color:var(--text-secondary); margin:15px 0 10px 0; border-bottom:1px solid var(--border-subtle); padding-bottom:5px;">🎮 Juegos Educativos (Práctica)</h4>
        <div class="games-grid student-games-grid">${gameCards}</div>
      ` : ''}
    </div>`;
}

// ── Stats ───────────────────────────────────────────────────────
function updateStats(classes) {
  const totalGames = new Set(classes.flatMap(c => c.enabledGames || [])).size;
  if ($('stat-my-classes')) $('stat-my-classes').textContent = classes.length;
  if ($('stat-available-games')) $('stat-available-games').textContent = totalGames;
}

// ── Tareas pendientes del alumno ────────────────────────────────
async function loadAssignments(user) {
  const container = $('student-assignments-list');
  const section   = $('section-assignments');
  if (!container || !section) return;

  try {
    // Recoger todas las tareas de todas las clases del alumno
    const allAssignments = [];
    for (const cls of myClasses) {
      const assignments = await getClassAssignments(cls.id);
      for (const a of assignments) {
        allAssignments.push({ ...a, classId: cls.id, className: cls.name });
      }
    }

    if (allAssignments.length === 0) return; // No hay tareas → sección oculta

    // Mostrar la sección ya (con puntuación 0) para que no se quede en blanco
    section.style.display = 'block';
    container.innerHTML = allAssignments.map(a => renderAssignmentCard({ ...a, bestScore: 0 })).join('');

    // Obtener TODAS las partidas del alumno de una sola consulta (evita índices compuestos)
    const allResults = await getStudentResults(user.uid, 500);

    // Calcular el mejor score por (classId, gameId) en memoria
    const bestByKey = {};
    for (const r of allResults) {
      const key = `${r.classId}__${r.gameId}`;
      if (!bestByKey[key] || r.score > bestByKey[key]) {
        bestByKey[key] = r.score;
      }
    }

    // Enriquecer con las puntuaciones reales
    const withProgress = allAssignments.map(a => ({
      ...a,
      bestScore: bestByKey[`${a.classId}__${a.gameId}`] || 0
    }));

    // Ordenar: primero las no superadas, luego las completadas
    withProgress.sort((a, b) => {
      const aDone = a.bestScore >= a.targetScore;
      const bDone = b.bestScore >= b.targetScore;
      if (aDone !== bDone) return aDone ? 1 : -1;
      return (a.className || '').localeCompare(b.className || '');
    });

    container.innerHTML = withProgress.map(a => renderAssignmentCard(a)).join('');
  } catch (err) {
    console.error('Error cargando tareas:', err);
  }
}


function renderAssignmentCard(a) {
  const g = GAMES[a.gameId] || { icon: '🎮', name: a.gameId, gamePath: `${a.gameId}/index.html` };
  const pct     = Math.min(100, Math.round((a.bestScore / a.targetScore) * 100));
  const done    = a.bestScore >= a.targetScore;
  const gameUrl = `${g.gamePath}?classId=${a.classId}`;

  const progressBar = done
    ? `<div style="display:flex; align-items:center; gap:var(--space-2)">
         <span class="badge badge--success" style="font-size:var(--text-sm)">✅ Completada</span>
         <span style="color:var(--text-muted); font-size:var(--text-xs)">${a.bestScore} / ${a.targetScore} pts</span>
       </div>`
    : `<div style="margin-top:var(--space-2)">
         <div style="display:flex; justify-content:space-between; font-size:var(--text-xs); color:var(--text-muted); margin-bottom:4px">
           <span>${a.bestScore} / ${a.targetScore} pts</span>
           <span>${pct}%</span>
         </div>
         <div style="background:var(--border); border-radius:99px; height:8px; overflow:hidden">
           <div style="background:var(--primary); width:${pct}%; height:100%; border-radius:99px; transition:width 0.4s ease"></div>
         </div>
       </div>`;

  return `
    <div class="card" style="margin-bottom:var(--space-3); padding:var(--space-4)">
      <div style="display:flex; align-items:flex-start; justify-content:space-between; gap:var(--space-3); flex-wrap:wrap">
        <div style="flex:1; min-width:0">
          <div style="display:flex; align-items:center; gap:var(--space-2); margin-bottom:var(--space-1)">
            <span style="font-size:1.4rem">${g.icon}</span>
            <div>
              <strong style="display:block">${escapeHtml(a.title)}</strong>
              <small style="color:var(--text-muted)">${escapeHtml(a.className)} · ${escapeHtml(g.name)}</small>
            </div>
          </div>
          ${progressBar}
        </div>
        ${!done ? `<a class="btn btn-primary btn--sm" href="${gameUrl}" style="white-space:nowrap; align-self:center">▶ Jugar</a>` : ''}
      </div>
    </div>`;
}

// ── Historial de partidas ────────────────────────────────────────
async function loadHistory(user) {
  try {
    const results = await getStudentResults(user.uid, 20);
    const tbody   = $('history-tbody');
    const table   = $('history-table');
    const empty   = $('history-empty');

    if (!tbody) return;

    if (results.length === 0) {
      table.style.display = 'none';
      empty.style.display = 'block';
      return;
    }

    // Mejor puntuación global
    const best = Math.max(...results.map(r => r.score || 0));
    if ($('stat-total-score')) $('stat-total-score').textContent = best;

    table.style.display = 'table';
    empty.style.display = 'none';
    tbody.innerHTML = results.map(r => {
      const g = GAMES[r.gameId] || { icon: '🎮', name: r.gameId };
      const cls = myClasses.find(c => c.id === r.classId);
      return `<tr>
        <td>${g.icon} ${escapeHtml(g.name)}</td>
        <td class="ranking-score">${r.score}</td>
        <td>${cls ? escapeHtml(cls.name) : '—'}</td>
        <td style="color:var(--text-muted); font-size:var(--text-xs)">${formatDate(r.timestamp)}</td>
      </tr>`;
    }).join('');
  } catch (err) {
    console.error('Error cargando historial:', err);
  }
}

// ── Exámenes Activos ────────────────────────────────────────────
async function loadExams(user, classes) {
  const section = $('section-exams');
  const list = $('student-exams-list');
  if (!section || !list) return;
  
  if (!classes || classes.length === 0) return;
  
  try {
    const { db, collection, query, where, getDocs } = await import('./common/firebase-config.js');
    
    const classIds = classes.map(c => c.id);
    const chunks = [];
    for (let i = 0; i < classIds.length; i += 10) {
      chunks.push(classIds.slice(i, i + 10));
    }
    
    let activeExams = [];
    for (const chunk of chunks) {
      const q = query(
        collection(db, 'examenes_test'),
        where('estado', '==', 'activo'),
        where('claseId', 'in', chunk)
      );
      const snap = await getDocs(q);
      snap.forEach(doc => {
        activeExams.push({ id: doc.id, ...doc.data() });
      });
    }
    
    if (activeExams.length === 0) return;
    
    const answersQ = query(
      collection(db, 'respuestas_test'),
      where('uid', '==', user.uid)
    );
    const answersSnap = await getDocs(answersQ);
    const submittedExamIds = new Set();
    answersSnap.forEach(doc => {
      const data = doc.data();
      if (data.examenId) submittedExamIds.add(data.examenId);
    });
    
    const pendingExams = activeExams.filter(e => !submittedExamIds.has(e.id));
    if (pendingExams.length === 0) return;
    
    section.style.display = 'block';
    list.innerHTML = pendingExams.map(ex => {
      const cls = classes.find(c => c.id === ex.claseId);
      const className = cls ? cls.name : 'Tu clase';
      return `
        <div class="card" style="padding:var(--space-4); border-left:4px solid var(--primary);">
          <h3 style="margin-bottom:var(--space-1); font-size:1.1rem;">${escapeHtml(ex.titulo || 'Examen')}</h3>
          <p style="color:var(--text-muted); font-size:0.9rem; margin-bottom:var(--space-3);">Clase: ${escapeHtml(className)}</p>
          <a href="examen.html?id=${ex.id}" class="btn btn-primary btn--sm" style="width:100%; justify-content:center;">Comenzar Examen</a>
        </div>
      `;
    }).join('');
  } catch (err) {
    console.error('Error cargando exámenes:', err);
  }
}

// ── Modal: Unirse a clase ────────────────────────────────────────
function setupModals(user) {
  const modal     = $('modal-join-class');
  const btnOpen   = $('btn-join-class');
  const btnClose  = $('close-join-modal');
  const btnCancel = $('cancel-join');
  const form      = $('form-join-class');
  const pinInput  = $('pin-input');

  const openModal  = () => { pinInput.value = ''; $('join-error').textContent = ''; modal.setAttribute('aria-hidden', 'false'); pinInput.focus(); };
  const closeModal = () => modal.setAttribute('aria-hidden', 'true');

  btnOpen?.addEventListener('click', openModal);
  btnClose?.addEventListener('click', closeModal);
  btnCancel?.addEventListener('click', closeModal);
  modal?.addEventListener('click', e => { if (e.target === modal) closeModal(); });

  // Solo permitir dígitos en el PIN
  pinInput?.addEventListener('input', () => {
    pinInput.value = pinInput.value.replace(/\D/g, '').slice(0, 6);
  });

  form?.addEventListener('submit', async e => {
    e.preventDefault();
    const pin = pinInput.value.trim();
    if (pin.length !== 6) {
      $('join-error').textContent = 'El PIN debe tener exactamente 6 dígitos.';
      return;
    }
    try {
      showLoading('Uniéndote a la clase...');
      const cls = await joinClassByPin(user.uid, pin);
      closeModal();
      showToast('¡Te has unido!', `Ahora formas parte de "${cls.name}".`, 'success');
      myClasses = await getStudentClasses(user.uid);
      renderStudentClasses(myClasses);
      updateStats(myClasses);
    } catch (err) {
      $('join-error').textContent = err.message;
    } finally {
      hideLoading();
    }
  });
}

// ── Notas de Teoría ───────────────────────────────────────────────
async function loadGrades(user) {
  try {
    const q = query(collection(db, 'test_teoria_respuestas'), where('uid', '==', user.uid));
    const snap = await getDocs(q);
    
    let tests = [];
    snap.forEach(d => {
      let data = d.data();
      tests.push(data);
    });
    
    // Sort chronologically to find the "last" one properly
    tests.sort((a, b) => {
      const ta = a.fecha ? a.fecha.toMillis() : 0;
      const tb = b.fecha ? b.fecha.toMillis() : 0;
      return ta - tb;
    });
    
    // Determine the last test for each topic
    const lastPerTopic = {};
    tests.forEach(t => {
      lastPerTopic[t.topicId] = t; // Since it's sorted, the last one processed will overwrite
    });
    
    const tbody = $('grades-tbody');
    const table = $('grades-table');
    const empty = $('grades-empty');
    
    if (!tbody) return;

    if (tests.length === 0) {
      table.style.display = 'none';
      empty.style.display = 'block';
      return;
    }
    
    table.style.display = 'table';
    empty.style.display = 'none';
    
    // reverse to show newest first in the list
    tests.reverse();
    
    tbody.innerHTML = tests.map(t => {
      const isLast = (lastPerTopic[t.topicId] === t);
      const isPassed = t.score >= 5;
      
      let dateStr = '—';
      if (t.fecha) {
        const d = t.fecha.toDate();
        dateStr = d.toLocaleDateString() + ' ' + d.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
      }
      
      const badge = isLast 
        ? `<span class="badge badge--primary" style="font-size:0.7rem; margin-left:8px;">✅ NOTA FINAL</span>`
        : `<span class="badge badge--ghost" style="font-size:0.7rem; margin-left:8px; opacity:0.6;">📝 INTENTO ANTERIOR</span>`;
        
      const scoreColor = isPassed ? 'var(--success)' : 'var(--error)';
      
      return `<tr>
        <td style="font-weight:bold;">${escapeHtml(t.topicName || t.topicId)}</td>
        <td style="font-weight:900; font-size:1.1rem; color:${scoreColor}">${t.score} / 10</td>
        <td style="color:var(--text-muted); font-size:var(--text-sm)">${dateStr}</td>
        <td>${badge}</td>
      </tr>`;
    }).join('');
    
  } catch (err) {
    console.error('Error cargando notas de teoría:', err);
  }
}

// ══════════════════════════════════════════════════════════════
//  TAREAS OFFLINE ALUMNO
// ══════════════════════════════════════════════════════════════


async function loadOfflineTasks(user) {
  if (myClasses.length === 0) return;
  
  const container = $('student-offline-tasks-list');
  if (!container) return;
  
  let html = '';
  
  for (const c of myClasses) {
    try {
      const configSnap = await getDocs(query(collection(db, 'offline_tasks_config'), where('classId', '==', c.id), where('isActive', '==', true)));
      if (configSnap.empty) continue;
      
      const gradesSnap = await getDocs(query(collection(db, 'offline_grades'), where('classId', '==', c.id), where('studentId', '==', user.uid)));
      const gradesMap = {};
      gradesSnap.forEach(g => {
        gradesMap[g.data().taskId] = g.data();
      });
      
      let classHtml = `<div class="card" style="margin-bottom:var(--space-4);">
        <h3 style="margin-bottom:15px; color:var(--text-secondary); font-size:1.1rem; border-bottom:1px solid var(--border); padding-bottom:5px;">🏫 ${escapeHtml(c.name)}</h3>
        <div class="accordion-list">`;
        
      // Ordenamos las configs por ID de tarea para mantener el mismo orden
      const configs = [];
      configSnap.forEach(d => configs.push(d.data()));
      configs.sort((a,b) => parseInt(a.taskId) - parseInt(b.taskId));
        
      configs.forEach(config => {
        const taskIndex = CLASSROOM_TASKS.findIndex(t => t.id === config.taskId);
        if (taskIndex === -1) return;
        const task = CLASSROOM_TASKS[taskIndex];
        
        const displayTitle = config.customTitle || task.title;
        const displayDesc = config.customDescription || task.description;
        
        const gradeInfo = gradesMap[task.id];
        
        let gradeBadge = '';
        let gradeDetails = '';
        if (config.gradesPublished && gradeInfo && typeof gradeInfo.finalGrade === 'number') {
           const color = gradeInfo.finalGrade >= 5 ? 'var(--success)' : 'var(--danger)';
           gradeBadge = `<span style="font-weight:bold; color:${color}; padding:4px 8px; border-radius:4px; border:1px solid ${color}; font-size:0.9rem;">Nota: ${gradeInfo.finalGrade.toFixed(2)}</span>`;
           
           if (gradeInfo.teacherFeedback) {
             gradeDetails = `<div style="margin-bottom:15px; padding:10px; background:#f8fafc; border-left:4px solid var(--primary); border-radius:0 4px 4px 0; font-size:0.9rem; font-style:italic;">
                " ${escapeHtml(gradeInfo.teacherFeedback)} "
             </div>`;
           }
        }
        
        let dateBadge = '';
        if (config.dueDate) {
           const parts = config.dueDate.split('-');
           const formattedDate = `${parts[2]}/${parts[1]}/${parts[0]}`;
           dateBadge = `<span style="font-size:0.8rem; color:var(--text-muted); display:flex; align-items:center; gap:5px;">📅 ${formattedDate}</span>`;
        }
        
        let rubricHtml = '';
        if (config.rubricPublished) {
           rubricHtml = `<h5 style="margin:20px 0 10px 0; font-size:1rem; border-bottom:1px solid var(--border); padding-bottom:5px;">📊 Rúbrica de Evaluación</h5>`;
           const activeRubric = task.customRubric || OFFLINE_RUBRIC;
           const scores = gradeInfo ? (gradeInfo.rubricScores || {}) : {};
           
           activeRubric.forEach(crit => {
             const studentScore = scores[crit.id];
             
             rubricHtml += `
               <div style="margin-bottom:10px; border:1px solid #e2e8f0; border-radius:6px; overflow:hidden;">
                 <div style="background:#f8fafc; padding:8px 12px; border-bottom:1px solid #e2e8f0;">
                   <h6 style="margin:0; font-size:0.95rem;">${crit.title}</h6>
                   <p style="margin:0; font-size:0.8rem; color:var(--text-muted);">${crit.desc}</p>
                 </div>
                 <div style="display:flex; flex-direction:column;">
             `;
             crit.levels.forEach((lvl) => {
               const isSelected = studentScore === lvl.points;
               rubricHtml += `
                   <div style="display:flex; align-items:center; padding:8px 12px; border-bottom:1px solid #f1f5f9; background:${isSelected ? '#e0e7ff' : '#fff'};">
                     ${isSelected ? '✅ ' : '<span style="color:#cbd5e1; margin-right:5px;">⚪</span> '}
                     <div style="flex:1; margin-left:5px;">
                       <span style="font-weight:${isSelected?'bold':'normal'}; color:${isSelected?'var(--primary)':'#64748b'}; display:inline-block; width:45px; font-size:0.85rem;">${lvl.points} pts</span>
                       <span style="font-size:0.85rem; font-weight:${isSelected?'bold':'normal'};">${lvl.desc}</span>
                     </div>
                   </div>
               `;
             });
             rubricHtml += `</div></div>`;
           });
        }
        
        classHtml += `
          <div class="student-task-accordion" style="border: 1px solid var(--border); border-radius: var(--radius); margin-bottom: 10px; background: var(--bg-surface); overflow:hidden;">
            <div class="st-accordion-header" style="display:flex; justify-content:space-between; align-items:center; padding: 15px; cursor:pointer; background:#f8fafc;" data-target="st-content-${task.id}">
              <div style="flex:1;">
                <h4 style="margin:0; color:var(--primary); font-size:1.05rem; display:flex; align-items:center; gap:10px;">
                  <span class="st-expand-icon">▶️</span>
                  ${taskIndex + 1}. ${escapeHtml(displayTitle)} 
                </h4>
                <div style="margin-top:5px; margin-left:30px; display:flex; align-items:center; gap:15px;">
                  <span class="badge" style="background:#e2e8f0; color:#475569; font-size:0.7rem;">Bloque ${task.block}</span>
                  ${dateBadge}
                </div>
              </div>
              <div>
                ${gradeBadge}
              </div>
            </div>
            
            <div class="st-accordion-content" id="st-content-${task.id}" style="display:none; padding:15px; border-top:1px solid var(--border);">
              <p style="white-space:pre-wrap; font-size:0.95rem; line-height:1.5; color:var(--text-secondary); margin-bottom:15px; background:#fff; padding:10px; border:1px solid #e2e8f0; border-radius:4px;">${escapeHtml(displayDesc)}</p>
              ${gradeDetails}
              ${rubricHtml}
            </div>
          </div>
        `;
      });
      
      classHtml += `</div></div>`;
      html += classHtml;
      
    } catch(e) {
      console.error(e);
    }
  }
  
  if (html) {
    $('section-offline-tasks').style.display = 'block';
    container.innerHTML = html;
    
    $$('.st-accordion-header').forEach(header => {
      header.addEventListener('click', () => {
        const contentId = header.dataset.target;
        const content = $(contentId);
        const icon = header.querySelector('.st-expand-icon');
        if (content.style.display === 'none') {
          content.style.display = 'block';
          icon.textContent = '🔽';
        } else {
          content.style.display = 'none';
          icon.textContent = '▶️';
        }
      });
    });
  }
}
