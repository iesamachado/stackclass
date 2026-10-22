// ═══════════════════════════════════════════════════════════════════════
//  CLASSHUB — admin.js (Panel de Administración)
// ═══════════════════════════════════════════════════════════════════════

import { requireAuth, currentUser, currentProfile, isAdmin } from './common/auth.js';
import { getAllowedTeachers, authorizeTeacher, removeAllowedTeacher } from './common/db.js';
import { renderHeader, showToast, showLoading, hideLoading } from './common/ui.js';
import { $, $$, escapeHtml, formatDate, copyToClipboard } from './common/utils.js';

let teacherList = [];
let searchQuery = '';

// ── Guard de Administrador ──────────────────────────────────────────
requireAuth({
  allowedRoles: ['teacher'],
  onAuthorized: async (user, profile) => {
    if (!isAdmin(user, profile)) {
      window.location.href = 'dashboard_teacher.html';
      return;
    }
    renderHeader(user, profile);
    setupEvents(user);
    await loadTeachers();
  }
});

// ── Carga de Docentes ───────────────────────────────────────────────
async function loadTeachers() {
  try {
    showLoading('Cargando docentes autorizados...');
    const list = await getAllowedTeachers();
    teacherList = list;
    updateStats(teacherList);
    renderTeacherList();
  } catch (err) {
    console.error('Error cargando docentes autorizados:', err);
    showToast('Error', 'No se pudieron cargar los docentes autorizados.', 'error');
  } finally {
    hideLoading();
  }
}

// ── Actualizar Estadísticas ─────────────────────────────────────────
function updateStats(list) {
  const total = list.length;
  const admins = list.filter(t => t.isSuperAdmin || t.is_superadmin).length;
  
  const domains = new Set(
    list.map(t => {
      const parts = t.email.split('@');
      return parts[1] || '';
    }).filter(Boolean)
  );

  $('stat-total-teachers').textContent = total;
  $('stat-admins').textContent = admins;
  $('stat-domains').textContent = domains.size;
  $('teachers-count-subtitle').textContent = `${total} usuario(s) registrado(s)`;
}

// ── Renderizado de la Lista ─────────────────────────────────────────
function renderTeacherList() {
  const container = $('teachers-list-container');
  const emptyMsg  = $('empty-teachers-msg');
  if (!container) return;

  const query = searchQuery.trim().toLowerCase();
  const filtered = teacherList.filter(t => {
    if (!query) return true;
    const matchEmail = (t.email || '').toLowerCase().includes(query);
    const matchName  = (t.name || '').toLowerCase().includes(query);
    return matchEmail || matchName;
  });

  if (filtered.length === 0) {
    container.innerHTML = '';
    emptyMsg.style.display = 'block';
    return;
  }

  emptyMsg.style.display = 'none';

  container.innerHTML = filtered.map(t => {
    const isSuperAdmin = t.isSuperAdmin === true || t.is_superadmin === true;
    const roleBadge = isSuperAdmin
      ? `<span class="badge" style="background:#8e44ad; color:#fff; font-weight:800; border:1px solid #000;">⚡ Superadmin</span>`
      : `<span class="badge badge--accent" style="font-weight:700;">👨‍🏫 Docente</span>`;

    const dateStr = t.createdAt ? formatDate(t.createdAt) : 'Creador inicial';
    const addedByStr = t.addedBy ? `Por: ${escapeHtml(t.addedBy)}` : '';

    return `
      <div class="teacher-item-row" id="teacher-row-${escapeHtml(t.id)}">
        <div class="teacher-item-info">
          <div class="teacher-item-avatar">
            ${isSuperAdmin ? '⚡' : '👨‍🏫'}
          </div>
          <div>
            <div style="display:flex; align-items:center; gap:var(--space-2); flex-wrap:wrap;">
              <strong style="font-size:var(--text-base); color:var(--text-primary);">${escapeHtml(t.email)}</strong>
              ${roleBadge}
            </div>
            <div style="font-size:var(--text-xs); color:var(--text-muted); margin-top:2px;">
              ${t.name ? `<span>${escapeHtml(t.name)}</span> · ` : ''}
              <span>${dateStr}</span>
              ${addedByStr ? ` · <span>${addedByStr}</span>` : ''}
            </div>
          </div>
        </div>

        <div class="teacher-item-actions">
          ${isSuperAdmin ? `
            <span class="badge" style="background:var(--bg-body); border:1px solid var(--border); color:var(--text-muted);">
              🔒 Superadministrador
            </span>
          ` : `
            <button class="btn btn-outline btn--sm" data-action="toggle-admin" data-email="${escapeHtml(t.email)}" data-is-superadmin="${isSuperAdmin}">
              ${isSuperAdmin ? 'Quitar Superadmin' : 'Hacer Superadmin'}
            </button>
            <button class="btn btn-ghost btn--sm" data-action="remove" data-email="${escapeHtml(t.email)}" style="color:var(--error); padding:6px 10px;" title="Revocar autorización">
              🗑️ Revocar
            </button>
          `}
        </div>
      </div>
    `;
  }).join('');

  // Event Listeners en botones de acción
  container.querySelectorAll('[data-action="toggle-admin"]').forEach(btn => {
    btn.addEventListener('click', async () => {
      const email = btn.dataset.email;
      const currentIsSuper = btn.dataset.isSuperadmin === 'true';
      const newSuper = !currentIsSuper;
      const label = newSuper ? 'Superadministrador' : 'Docente';

      if (!confirm(`¿Cambiar permisos de ${email} a "${label}"?`)) return;

      try {
        showLoading('Actualizando permisos...');
        await authorizeTeacher(email, { role: 'teacher', isSuperAdmin: newSuper, addedBy: currentUser.email });
        showToast('Permisos actualizados', `${email} ahora es ${label}.`, 'success');
        await loadTeachers();
      } catch (err) {
        showToast('Error', err.message, 'error');
      } finally {
        hideLoading();
      }
    });
  });

  container.querySelectorAll('[data-action="remove"]').forEach(btn => {
    btn.addEventListener('click', async () => {
      const email = btn.dataset.email;
      if (!confirm(`¿Revocar el acceso docente a ${email}?\nYa no podrá iniciar sesión como profesor.`)) return;

      try {
        showLoading('Revocando acceso...');
        await removeAllowedTeacher(email);
        showToast('Acceso revocado', `${email} ha sido eliminado de la lista de docentes autorizados.`, 'info');
        await loadTeachers();
      } catch (err) {
        showToast('Error', err.message, 'error');
      } finally {
        hideLoading();
      }
    });
  });
}

// ── Eventos de la Interfaz ──────────────────────────────────────────
function setupEvents(user) {
  // Buscador
  const searchInput = $('input-search-teacher');
  searchInput?.addEventListener('input', e => {
    searchQuery = e.target.value;
    renderTeacherList();
  });

  // Formulario para autorizar nuevo docente o lote de docentes
  const form = $('form-add-teacher');
  form?.addEventListener('submit', async e => {
    e.preventDefault();

    const rawEmails = $('input-teacher-emails')?.value || '';
    const nameNote  = $('input-teacher-name')?.value.trim() || '';
    const isSuperAdmin = $('select-teacher-role')?.value === 'superadmin';

    const emails = rawEmails
      .split(/[\n,;]+/)
      .map(e => e.trim().toLowerCase())
      .filter(e => e.includes('@'));

    if (emails.length === 0) {
      showToast('Atención', 'Introduce al menos un correo electrónico válido.', 'warning');
      return;
    }

    try {
      showLoading(`Autorizando ${emails.length} docente(s)...`);
      let successCount = 0;

      for (const email of emails) {
        await authorizeTeacher(email, {
          name: nameNote || undefined,
          role: 'teacher',
          isSuperAdmin: isSuperAdmin,
          addedBy: user.email || 'Admin'
        });
        successCount++;
      }

      form.reset();
      showToast('Docente(s) autorizados', `Se concedió acceso a ${successCount} cuenta(s).`, 'success', 4000);
      await loadTeachers();
    } catch (err) {
      showToast('Error', err.message, 'error');
    } finally {
      hideLoading();
    }
  });

  // Copiar plantilla de invitación
  $('btn-copy-invite-link')?.addEventListener('click', () => {
    const origin = window.location.origin;
    const msg = `¡Hola! Has sido dado de alta como docente en StackClass.\n\nPuedes acceder iniciando sesión con tu cuenta de Google en:\n${origin}/index.html\n\n¡Bienvenido/a a la plataforma!`;
    copyToClipboard(msg);
    showToast('Plantilla copiada', 'Mensaje de invitación copiado al portapapeles.', 'success');
  });

  // Copiar comando de migración de Firebase
  $('btn-copy-migrate-cmd')?.addEventListener('click', () => {
    copyToClipboard('npm run migrate:firebase');
    showToast('Comando copiado', 'npm run migrate:firebase copiado al portapapeles.', 'success');
  });

  // Gamification Migration
  $('btn-migrate-xp')?.addEventListener('click', async () => {
    try {
      const btn = $('btn-migrate-xp');
      const status = $('migrate-xp-status');
      if (btn.disabled) return;
      
      btn.disabled = true;
      status.textContent = 'Calculando... (puede tardar unos segundos)';
      const { supabase } = await import('./common/supabase-config.js');
      const { computeGameXP, loadMedals, MEDAL_XP, TIC2_MEDALS_CATALOG, CYR_MEDALS_CATALOG } = await import('./common/gamification.js');
      const { HISTORICAL_USER_MEDALS } = await import('./common/historical_medals.js');
      await loadMedals();

      const { data: allUsers } = await supabase.from('users').select('id, email, subject_id, logros, xp');
      const { data: classMembers } = await supabase.from('class_members').select('student_id, classes(subject_id)');

      const userSubject = {};
      const userXP = {};
      const userMedals = {};
      const emailToUid = {};

      (allUsers || []).forEach(u => {
        const cleanEmail = (u.email || '').toLowerCase().trim();
        emailToUid[cleanEmail] = u.id;
        const cm = (classMembers || []).find(c => c.student_id === u.id);
        const sub = u.subject_id || cm?.classes?.subject_id || HISTORICAL_USER_MEDALS[cleanEmail]?.subject || 'cyr';
        userSubject[u.id] = sub;
        userXP[u.id] = 0; // Se suma actividad real

        // Medallas base auténticas consolidadas de Firebase si existen, o del perfil
        const baseMedalsList = HISTORICAL_USER_MEDALS[cleanEmail]?.medals || (u.logros || []).map(l => typeof l === 'string' ? l : (l.id || l.medal_id));
        const validMedalCatalog = sub === 'tic2' ? TIC2_MEDALS_CATALOG : CYR_MEDALS_CATALOG;
        const validMedalIds = new Set(validMedalCatalog.map(m => m.id));

        const cleanMedals = new Set();
        (baseMedalsList || []).forEach(mId => {
          if (validMedalIds.has(mId)) {
            cleanMedals.add(mId);
          }
        });
        userMedals[u.id] = cleanMedals;
      });

      // 1. Procesar Juegos (game_results) ordenados cronológicamente
      const { data: gamesRaw } = await supabase.from('game_results')
        .select('student_id, game_id, score, created_at, metadata, forced_fail')
        .eq('forced_fail', false)
        .order('created_at', { ascending: true });

      const games = (gamesRaw || []).map(r => ({
        ...r,
        studentId: r.student_id,
        gameId: r.game_id
      }));

      const userGames = {};
      games.forEach(data => {
        const uid = data.studentId || data.student_id;
        const gid = data.gameId || data.game_id;
        if (!uid || !gid || data.score === undefined) return;

        if (!userGames[uid]) userGames[uid] = {};
        if (!userGames[uid][gid]) userGames[uid][gid] = { scores: [], totalXP: 0 };

        const gameData = userGames[uid][gid];
        const nPartidas = gameData.scores.length + 1;
        const previousMaxScore = nPartidas > 1 ? Math.max(...gameData.scores) : 0;
        gameData.scores.push(data.score);

        let xp = computeGameXP(gid, data.score, nPartidas, previousMaxScore);
        if (gameData.totalXP + xp > 750) {
          xp = Math.max(0, 750 - gameData.totalXP);
        }
        gameData.totalXP += xp;

        if (userXP[uid] !== undefined) userXP[uid] += xp;
      });

      // 2. Procesar Tests de Repaso (topic_test_results) ordenados cronológicamente
      const { data: testsRaw } = await supabase.from('topic_test_results')
        .select('student_id, topic_id, score, created_at, forced_fail')
        .eq('forced_fail', false)
        .order('created_at', { ascending: true });

      const userTests = {};
      (testsRaw || []).forEach(data => {
        const uid = data.student_id;
        const topicId = data.topic_id;
        const score = data.score;
        if (!uid || !topicId || score === undefined) return;

        if (!userTests[uid]) userTests[uid] = {};
        if (!userTests[uid][topicId]) userTests[uid][topicId] = { passed: false, outstanding: false, count: 0 };

        const state = userTests[uid][topicId];
        let xp = 0;
        if (score >= 3) {
          if (state.count === 0) {
            xp = 5 + (score >= 5 ? 5 : 0) + (score > 9 ? 5 : 0);
          } else {
            xp = 2 + (score >= 5 ? (state.passed ? 1 : 5) : 0) + (score > 9 ? (state.outstanding ? 1 : 5) : 0);
          }
        }
        if (score >= 5) state.passed = true;
        if (score > 9) state.outstanding = true;
        state.count++;

        if (userXP[uid] !== undefined) userXP[uid] += xp;
      });

      // 3. Procesar Exámenes (exam_results)
      const { data: examsRaw } = await supabase.from('exam_results')
        .select('student_id, score')
        .not('score', 'is', null)
        .order('created_at', { ascending: true });

      (examsRaw || []).forEach(data => {
        const uid = data.student_id;
        const nota = data.score;
        if (!uid || nota === undefined) return;

        let xp = 5 + (nota >= 5 ? 5 : 0) + (nota > 9 ? 5 : 0);
        if (userXP[uid] !== undefined) userXP[uid] += xp;
      });

      // 4. Procesar Tareas Offline (offline_grades)
      const { data: offlineRaw } = await supabase.from('offline_grades')
        .select('student_id, score')
        .not('score', 'is', null)
        .order('updated_at', { ascending: true });

      (offlineRaw || []).forEach(data => {
        const uid = data.student_id;
        const grade = data.score;
        if (!uid || grade === undefined) return;

        const xp = Math.round(grade * 15);
        if (userXP[uid] !== undefined) userXP[uid] += xp;
      });

      // 5. Medallas de Progresión y Suma de Medallas
      for (const uid of Object.keys(userXP)) {
        let curXP = userXP[uid];
        const medals = userMedals[uid] || new Set();
        const sub = userSubject[uid];

        if (sub === 'tic2') {
          if (curXP >= 3500) medals.add('novato');
          if (curXP >= 12000) medals.add('aprendiz');
          if (curXP >= 35000) medals.add('veterano');
          if (curXP >= 100000) medals.add('leyenda');
        } else {
          // CyR
          if (curXP >= 500) medals.add('novato');
          if (curXP >= 2000) medals.add('aprendiz');
          if (curXP >= 5000) medals.add('veterano');
          if (curXP >= 15000) medals.add('maestro_xp');
        }

        let medalsXP = 0;
        medals.forEach(mId => {
          medalsXP += (MEDAL_XP[mId] || 0);
        });

        // Guardar actualización limpia y atómica
        const finalXP = curXP + medalsXP;
        await supabase.from('users').update({
          xp: finalXP,
          logros: Array.from(medals)
        }).eq('id', uid);
      }

      status.textContent = `¡Listo! XP y medallas recalculadas de forma exacta para ${Object.keys(userXP).length} alumnos.`;
      status.style.color = 'var(--success)';
      showToast('Recálculo completado', `XP y medallas actualizadas de forma limpia.`);
    } catch(err) {
      console.error(err);
      $('migrate-xp-status').textContent = 'Error: ' + err.message;
      $('migrate-xp-status').style.color = 'var(--error)';
      showToast('Error', 'Fallo al recalcular XP', 'error');
    } finally {
      hideLoading();
      $('btn-migrate-xp').disabled = false;
    }
  });
}
