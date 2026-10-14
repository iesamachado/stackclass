// ═══════════════════════════════════════════════════════════════════════
//  CLASSHUB — dashboard_teacher.js
// ═══════════════════════════════════════════════════════════════════════

import { requireAuth, currentUser, currentProfile, classroomToken, refreshClassroomToken, updateUserProfileData, isAdmin } from './common/auth.js';
import { getTeacherClasses, createClass, getClassMembers, getClassResults, getStudentResults, addStudentsToClass } from './common/db.js';
import { fetchClassroomCourses, importClassroomStudents } from './common/classroom.js';
import { renderHeader, showToast, showModal, showLoading, hideLoading } from './common/ui.js';
import { COURSES, GAMES, getCourseStats, copyToClipboard, $, escapeHtml, formatDate, getUrlParams } from './common/utils.js';

let myClasses = [];

// ── Guard de autenticación ──────────────────────────────────────
requireAuth({
  allowedRoles: ['teacher'],
  onAuthorized: async (user, profile) => {
    renderHeader(user, profile);
    const displayName = profile.display_name || profile.displayName || user.email?.split('@')[0] || 'Docente';
    $('teacher-welcome').textContent = `Hola, ${displayName} 👋`;

    if (isAdmin(user, profile)) {
      const btnAdmin = $('btn-admin-panel');
      if (btnAdmin) btnAdmin.style.display = 'inline-flex';
    }

    await loadAll(user, profile);
    setupModals();
    renderTeacherCourseCards();
    await loadTeacherHistory(user.id || user.uid);
  }
});

// ── Carga principal ─────────────────────────────────────────────
async function loadAll(user, profile) {
  try {
    myClasses = await getTeacherClasses(user.id || user.uid);
    renderClasses(myClasses);
    updateStats(myClasses);
  } catch (err) {
    console.error('Error cargando clases:', err);
    showToast('Error', 'No se pudieron cargar las clases.', 'error');
  }
}

// ── Renderizar lista de clases ──────────────────────────────────
function renderClasses(classes) {
  const list  = $('classes-list');
  const empty = $('empty-classes');
  if (!list) return;

  if (classes.length === 0) {
    list.innerHTML = '';
    empty.style.display = 'block';
    return;
  }

  empty.style.display = 'none';
  list.innerHTML = classes.map(cls => renderClassCard(cls)).join('');

  // Eventos en las tarjetas
  list.querySelectorAll('[data-action="manage"]').forEach(btn => {
    btn.addEventListener('click', () => {
      window.location.href = `class_detail.html?classId=${btn.dataset.classId}`;
    });
  });
  list.querySelectorAll('[data-action="copy-pin"]').forEach(btn => {
    btn.addEventListener('click', async () => {
      await copyToClipboard(btn.dataset.pin);
      showToast('PIN copiado', `PIN ${btn.dataset.pin} copiado al portapapeles`, 'success', 2000);
    });
  });
}

function renderClassCard(cls) {
  const enabledGames = cls.enabledGames || cls.enabled_games || [];
  const members = cls.members || cls.class_members || [];
  const subjectId = cls.subject_id || cls.subjectId || 'cyr';
  const course = COURSES[subjectId] || COURSES.cyr;
  const levelText = cls.level ? (subjectId === 'tic2' && String(cls.level) === '2' ? '2º Bach' : `${cls.level}º ESO`) : course.level;
  
  return `
    <div class="class-card" style="border-top: 3px solid ${course.color};">
      <div class="class-card-header">
        <div>
          <span class="badge" style="background: ${course.color}20; color: ${course.colorDark || course.color}; font-size: 0.75rem; font-weight: 600; margin-bottom: 6px; display: inline-block;">
            ${course.icon} ${course.shortName} · ${levelText}
          </span>
          <h3 class="class-card-name" style="margin: 0;">${escapeHtml(cls.name)}</h3>
        </div>
        <button class="class-card-pin" data-action="copy-pin" data-pin="${cls.pin}"
                title="Copiar PIN">
          📋 ${cls.pin}
        </button>
      </div>
      <div class="class-card-meta">
        <span>👨‍🎓 ${members.length} alumnos</span>
        <span>🎮 ${enabledGames.length} juegos activos</span>
      </div>
      <div class="class-card-actions">
        <button class="btn btn-primary btn--sm" data-action="manage" data-class-id="${cls.id}">
          ⚙️ Gestionar clase
        </button>
      </div>
    </div>`;
}

// ── Stats ───────────────────────────────────────────────────────
async function updateStats(classes) {
  let totalStudents = 0;
  let totalGamesEnabled = 0;

  for (const cls of classes) {
    const members = cls.members || cls.class_members || [];
    const enabledGames = cls.enabledGames || cls.enabled_games || [];
    totalStudents    += members.length;
    totalGamesEnabled += enabledGames.length;
  }

  $('stat-classes').textContent  = classes.length;
  $('stat-students').textContent = totalStudents;
  $('stat-games').textContent    = totalGamesEnabled;
  $('stat-results').textContent  = '—'; // Se podría añadir query de game_results
}

// ── Tarjetas de Cursos para el docente ──────────────────────────
function renderTeacherCourseCards() {
  const grid = $('teacher-courses-grid');
  if (!grid) return;

  grid.innerHTML = Object.values(COURSES).map(c => {
    const stats = getCourseStats(c.id);
    return `
      <div class="class-card" style="border-top: 4px solid ${c.color}; display: flex; flex-direction: column; justify-content: space-between;">
        <div>
          <div class="class-card-header" style="margin-bottom: var(--space-2);">
            <div style="display: flex; align-items: center; gap: var(--space-3);">
              <span style="font-size: 2rem;">${c.icon}</span>
              <div>
                <h3 class="class-card-name" style="margin: 0; font-size: var(--text-lg);">${escapeHtml(c.name)}</h3>
                <span class="badge" style="background: ${c.color}20; color: ${c.colorDark || c.color}; font-weight: 600; margin-top: 4px; display: inline-block;">
                  ${escapeHtml(c.level)}
                </span>
              </div>
            </div>
          </div>
          <p style="font-size: var(--text-sm); color: var(--text-secondary); margin: var(--space-3) 0; line-height: 1.5;">
            ${escapeHtml(c.description)}
          </p>
          <div class="class-card-meta" style="margin-bottom: var(--space-4); display: flex; gap: var(--space-4); flex-wrap: wrap;">
            <span>📚 <strong>${stats.topicsCount}</strong> bloques temáticos</span>
            <span>🎮 <strong>${stats.gamesCount}</strong> juegos educativos</span>
          </div>
        </div>
        <div class="class-card-actions" style="margin-top: var(--space-2);">
          <a href="course_detail.html?courseId=${c.id}" class="btn btn-primary btn--sm" style="width: 100%; text-decoration: none; justify-content: center; display: inline-flex; align-items: center; gap: 6px;">
            <span>Explorar Bloques y Juegos</span> <span>→</span>
          </a>
        </div>
      </div>`;
  }).join('');
}

// ── Historial de partidas del Docente ──────────────────────────
async function loadTeacherHistory(uid) {
  try {
    const results = await getStudentResults(uid, 10);
    const tbody = $('teacher-history-list');
    if (!tbody) return;
    
    if (results.length === 0) {
      tbody.innerHTML = `<tr><td colspan="3" class="text-center text-muted" style="padding: var(--space-6);">Aún no has jugado ninguna partida.</td></tr>`;
      return;
    }
    
    tbody.innerHTML = results.map(r => {
      const gid = r.game_id || r.gameId;
      const gameInfo = GAMES[gid] || Object.values(GAMES).find(g => g.id === gid) || { name: gid, icon: '🎮' };
      const dateStr = formatDate(r.created_at || r.timestamp);
      return `
        <tr>
          <td>
            <div style="display:flex; align-items:center; gap:var(--space-2);">
              <span>${gameInfo.icon}</span>
              <strong>${escapeHtml(gameInfo.name)}</strong>
            </div>
          </td>
          <td style="font-family: var(--font-mono); font-weight: bold; color: var(--accent-light);">
            ${r.score} pts
          </td>
          <td style="color: var(--text-muted); font-size: var(--text-xs);">
            ${dateStr}
          </td>
        </tr>
      `;
    }).join('');
  } catch (err) {
    console.error('Error cargando historial del docente:', err);
  }
}

// ── Modales ─────────────────────────────────────────────────────
function setupModals() {

  // ─ Modal nueva clase ─
  const modalNewClass  = $('modal-new-class');
  const formNewClass   = $('form-new-class');
  const openNewClass   = $('btn-new-class');
  const closeNewClass  = $('close-new-class');
  const cancelNewClass = $('cancel-new-class');

  const syncNewClassSubjectLevels = () => {
    const subjectSelect = $('class-subject-input');
    const levelSelect = $('class-level-input');
    const nameInput = $('class-name-input');
    if (!subjectSelect || !levelSelect) return;

    const subject = subjectSelect.value;
    if (subject === 'tic2') {
      levelSelect.innerHTML = `<option value="2" selected>2º Bachillerato</option>`;
      if (nameInput) nameInput.placeholder = 'Ej: 2º Bachillerato TIC II Grupo A';
    } else {
      levelSelect.innerHTML = `
        <option value="1" selected>1º ESO</option>
        <option value="2">2º ESO</option>
        <option value="3">3º ESO</option>
      `;
      if (nameInput) nameInput.placeholder = 'Ej: 1º ESO Computación y Robótica Grupo A';
    }
  };

  $('class-subject-input')?.addEventListener('change', syncNewClassSubjectLevels);

  openNewClass?.addEventListener('click', () => {
    $('class-name-input').value = '';
    const stInput = $('class-students-input');
    if (stInput) stInput.value = '';
    const subjectSelect = $('class-subject-input');
    if (subjectSelect) subjectSelect.value = 'cyr';
    syncNewClassSubjectLevels();
    modalNewClass.classList.add('modal-backdrop--visible');
    modalNewClass.setAttribute('aria-hidden', 'false');
  });
  const closeModalNew = () => {
    modalNewClass.classList.remove('modal-backdrop--visible');
    modalNewClass.setAttribute('aria-hidden', 'true');
  };
  closeNewClass?.addEventListener('click', closeModalNew);
  cancelNewClass?.addEventListener('click', closeModalNew);
  modalNewClass?.addEventListener('click', e => { if (e.target === modalNewClass) closeModalNew(); });

  formNewClass?.addEventListener('submit', async e => {
    e.preventDefault();
    const subjectId = $('class-subject-input')?.value || 'cyr';
    const name = $('class-name-input').value.trim();
    if (!name) return;
    const level = $('class-level-input')?.value || (subjectId === 'tic2' ? '2' : '1');
    const studentsRaw = $('class-students-input')?.value || '';

    try {
      showLoading('Creando clase...');
      const teacherId = currentUser.id || currentUser.uid;
      const cls = await createClass(teacherId, subjectId, name, level);
      
      let addedInfo = '';
      if (studentsRaw.trim()) {
        const studentResult = await addStudentsToClass(cls.id, studentsRaw);
        if (studentResult.added > 0) {
          addedInfo = ` (${studentResult.added} alumnos añadidos)`;
        }
      }

      closeModalNew();
      showToast('Clase creada', `PIN: ${cls.pin}${addedInfo} — ya puedes compartirlo con tus alumnos.`, 'success', 5000);
      
      myClasses = await getTeacherClasses(teacherId);
      renderClasses(myClasses);
      updateStats(myClasses);
    } catch (err) {
      showToast('Error', err.message, 'error');
    } finally {
      hideLoading();
    }
  });

  // ─ Modal importar Classroom ─
  const modalImport  = $('modal-import-classroom');
  const btnImport    = $('btn-import-classroom');
  const closeImport  = $('close-import-classroom');

  btnImport?.addEventListener('click', async () => {
    modalImport.classList.add('modal-backdrop--visible');
    modalImport.setAttribute('aria-hidden', 'false');
    await loadClassroomCourses();
  });
  const closeModalImport = () => {
    modalImport.classList.remove('modal-backdrop--visible');
    modalImport.setAttribute('aria-hidden', 'true');
  };
  closeImport?.addEventListener('click', closeModalImport);
  modalImport?.addEventListener('click', e => { if (e.target === modalImport) closeModalImport(); });

  // ─ Modal editar nombre ─

}

// ── Importación desde Classroom ─────────────────────────────────
async function loadClassroomCourses() {
  const body = $('classroom-modal-body');
  if (!body) return;

  let token = classroomToken;

  if (!token) {
    body.innerHTML = `
      <div class="alert alert--warning" style="margin-bottom:var(--space-4)">
        <span>⚠️</span>
        <div>No hay token de Classroom activo. Debes haber iniciado sesión como <strong>Docente con Google</strong>.</div>
      </div>
      <button class="btn btn-primary btn--full" id="btn-reauth-classroom">
        🔑 Autorizar acceso a Classroom
      </button>`;

    $('btn-reauth-classroom')?.addEventListener('click', async () => {
      try {
        token = await refreshClassroomToken();
        await loadClassroomCourses();
      } catch (err) {
        showToast('Error', err.message, 'error');
      }
    });
    return;
  }

  body.innerHTML = `<div class="loading-content" style="padding:var(--space-8) 0">
    <div class="spinner"></div><p>Cargando cursos...</p></div>`;

  try {
    const courses = await fetchClassroomCourses(token);

    if (courses.length === 0) {
      body.innerHTML = '<p class="empty-state">No se encontraron cursos activos en Classroom.</p>';
      return;
    }

    body.innerHTML = `
      <p style="margin-bottom:var(--space-4); color:var(--text-secondary); font-size:var(--text-sm)">
        Selecciona los cursos que quieres importar. Se creará una clase en ClassHub por cada curso.
      </p>
      <div class="classroom-courses-list">
        ${courses.map(c => `
          <label class="classroom-course-item">
            <input type="checkbox" name="course" value="${escapeHtml(c.id)}" data-name="${escapeHtml(c.name)}">
            <div class="course-info">
              <strong>${escapeHtml(c.name)}</strong>
              <small>${escapeHtml(c.section || c.descriptionHeading || '')}</small>
            </div>
          </label>`).join('')}
      </div>
      <div style="margin-top:var(--space-5)">
        <button class="btn btn-primary btn--full" id="btn-do-import">
          📥 Importar seleccionados
        </button>
      </div>`;

    $('btn-do-import')?.addEventListener('click', () => doImportClassroom(token));

  } catch (err) {
    if (err.code === 'CLASSROOM_TOKEN_EXPIRED') {
      token = null;
      await loadClassroomCourses();
    } else {
      body.innerHTML = `<div class="alert alert--error">${escapeHtml(err.message)}</div>`;
    }
  }
}

async function doImportClassroom(token) {
  const checked = document.querySelectorAll('input[name="course"]:checked');
  if (checked.length === 0) {
    showToast('Selecciona al menos un curso', '', 'warning');
    return;
  }

  try {
    showLoading('Importando clases y alumnos...');
    let imported = 0;

    for (const cb of checked) {
      const courseId = cb.value;
      const name     = cb.dataset.name;

      // 1. Crear clase en base de datos
      const nameLower = name.toLowerCase();
      const detectedSubject = (nameLower.includes('tic') || nameLower.includes('bach') || nameLower.includes('bachillerato')) ? 'tic2' : 'cyr';
      const detectedLevel = detectedSubject === 'tic2' ? '2' : '1';
      const cls = await createClass(currentUser.uid, detectedSubject, name, detectedLevel, { classroomCourseId: courseId });
      
      // 2. Traer alumnos de Classroom
      const { matched, pending } = await importClassroomStudents(token, courseId, cls.id);
      imported++;
      showToast(`Clase "${name}" importada`, `${matched} alumnos vinculados, ${pending} pendientes de registro.`, 'success', 4000);
    }

    $('modal-import-classroom').setAttribute('aria-hidden', 'true');
    myClasses = await getTeacherClasses(currentUser.uid);
    renderClasses(myClasses);
    updateStats(myClasses);

  } catch (err) {
    showToast('Error en importación', err.message, 'error');
  } finally {
    hideLoading();
  }
}
