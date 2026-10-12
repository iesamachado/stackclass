// ═══════════════════════════════════════════════════════════════════════
//  CLASSHUB — admin.js (Panel de Administración)
// ═══════════════════════════════════════════════════════════════════════

import { requireAuth, currentUser, currentProfile, SUPERADMIN_EMAIL } from './common/auth.js';
import { getAllowedTeachers, authorizeTeacher, removeAllowedTeacher } from './common/db.js';
import { renderHeader, showToast, showLoading, hideLoading } from './common/ui.js';
import { $, $$, escapeHtml, formatDate } from './common/utils.js';

let teacherList = [];
let searchQuery = '';

// ── Guard de Administrador ──────────────────────────────────────────
requireAuth({
  allowedRoles: ['admin'],
  onAuthorized: async (user, profile) => {
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

    // Asegurar que el superadmin aparezca si aún no está en Firestore
    const hasSuperAdmin = list.some(t => t.email.toLowerCase() === SUPERADMIN_EMAIL.toLowerCase());
    if (!hasSuperAdmin) {
      list.unshift({
        id: SUPERADMIN_EMAIL.toLowerCase(),
        email: SUPERADMIN_EMAIL.toLowerCase(),
        name: 'Superadministrador Principal',
        role: 'admin',
        isSuperAdmin: true,
        createdAt: null,
        addedBy: 'Sistema'
      });
    }

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
  const admins = list.filter(t => t.role === 'admin' || t.email.toLowerCase() === SUPERADMIN_EMAIL.toLowerCase()).length;
  
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
    const matchRole  = (t.role || '').toLowerCase().includes(query);
    return matchEmail || matchName || matchRole;
  });

  if (filtered.length === 0) {
    container.innerHTML = '';
    emptyMsg.style.display = 'block';
    return;
  }

  emptyMsg.style.display = 'none';

  container.innerHTML = filtered.map(t => {
    const isSuperAdmin = t.email.toLowerCase() === SUPERADMIN_EMAIL.toLowerCase();
    const isAdminRole = t.role === 'admin' || isSuperAdmin;
    const roleBadge = isAdminRole
      ? `<span class="badge" style="background:#ffc300; color:#000; font-weight:800; border:1px solid #000;">👑 Admin</span>`
      : `<span class="badge badge--accent" style="font-weight:700;">👨‍🏫 Docente</span>`;

    const dateStr = t.createdAt ? formatDate(t.createdAt) : 'Creador inicial';
    const addedByStr = t.addedBy ? `Por: ${escapeHtml(t.addedBy)}` : '';

    return `
      <div class="teacher-item-row" id="teacher-row-${escapeHtml(t.id)}">
        <div class="teacher-item-info">
          <div class="teacher-item-avatar">
            ${isAdminRole ? '👑' : '👨‍🏫'}
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
              🔒 Superadmin Principal
            </span>
          ` : `
            <button class="btn btn-outline btn--sm" data-action="toggle-role" data-email="${escapeHtml(t.email)}" data-current-role="${t.role || 'teacher'}">
              ${isAdminRole ? 'Convertir en Docente' : 'Hacer Admin'}
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
  container.querySelectorAll('[data-action="toggle-role"]').forEach(btn => {
    btn.addEventListener('click', async () => {
      const email = btn.dataset.email;
      const current = btn.dataset.currentRole;
      const newRole = current === 'admin' ? 'teacher' : 'admin';
      const roleName = newRole === 'admin' ? 'Administrador' : 'Docente';

      if (!confirm(`¿Cambiar el rol de ${email} a "${roleName}"?`)) return;

      try {
        showLoading('Actualizando rol...');
        await authorizeTeacher(email, { role: newRole, addedBy: currentUser.email });
        showToast('Rol actualizado', `${email} ahora es ${roleName}.`, 'success');
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
    const role      = $('select-teacher-role')?.value || 'teacher';

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
          role: role,
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

  // Gamification Migration
  $('btn-migrate-xp')?.addEventListener('click', async () => {
    try {
      const btn = $('btn-migrate-xp');
      const status = $('migrate-xp-status');
      if (btn.disabled) return;
      
      btn.disabled = true;
      status.textContent = 'Calculando... (puede tardar unos segundos)';
      showLoading('Recalculando XP y medallas...');
      
      const { collection, getDocs, doc, updateDoc, query, orderBy } = await import('./common/firebase-config.js');
      const { db } = await import('./common/firebase-config.js');
      const { computeGameXP, addXPAndCheckLogros, awardMedal } = await import('./common/gamification.js');
      
      let userXP = {}; // { uid: totalXP }
      let usersUpdated = new Set();
      
      // 1. Procesar Juegos (game_results)
      const snapGames = await getDocs(query(collection(db, 'game_results'), orderBy('timestamp', 'asc')));
      const userGames = {};
      snapGames.forEach(d => {
        const data = d.data();
        const uid = data.studentId;
        const gid = data.gameId;
        if (!uid || !gid || data.score === undefined) return;
        
        if (!userGames[uid]) userGames[uid] = {};
        if (!userGames[uid][gid]) {
            userGames[uid][gid] = { scores: [], totalXP: 0 };
        }
        
        const gameData = userGames[uid][gid];
        const nPartidas = gameData.scores.length + 1;
        const previousMaxScore = nPartidas > 1 ? Math.max(...gameData.scores) : 0;
        
        gameData.scores.push(data.score);
        
        let xp = computeGameXP(gid, data.score, nPartidas, previousMaxScore);
        
        if (gameData.totalXP + xp > 750) {
            xp = Math.max(0, 750 - gameData.totalXP);
        }
        gameData.totalXP += xp;
        
        userXP[uid] = (userXP[uid] || 0) + xp;
        
        // Medallas
        if (nPartidas === 1) {
           awardMedal(uid, 'primer_circuito');
           if (gid === 'netdefender') awardMedal(uid, 'defensor');
           if (gid === 'mecanoclass') awardMedal(uid, 'tecleador');
           if (gid === 'rompecodigos') awardMedal(uid, 'descifrador');
           if (gid === 'helados') awardMedal(uid, 'heladero');
           if (gid === 'moon') awardMedal(uid, 'astronauta');
           if (gid === 'arenabots') awardMedal(uid, 'robotizador');
           if (gid === 'cybersmith') awardMedal(uid, 'smith');
           if (gid === 'asimov') awardMedal(uid, 'etico_ia');
           if (gid === 'appflow') awardMedal(uid, 'dev_app');
           if (gid === 'trivial') awardMedal(uid, 'preguntador');
        }
        
        const tryAward = (medalId, extraXP = 0) => {
            if (!userGames[uid].medals) userGames[uid].medals = new Set();
            if (!userGames[uid].medals.has(medalId)) {
                userGames[uid].medals.add(medalId);
                userXP[uid] = (userXP[uid] || 0) + extraXP;
                awardMedal(uid, medalId);
            }
        };

        if (gid === 'netdefender') {
            if (data.score >= 300) tryAward('netdefender_300', 50);
            if (data.score >= 500) tryAward('guardian_red', 100);
            if (data.score >= 700) tryAward('netdefender_700', 150);
            if (data.score >= 1000) tryAward('netdefender_1000', 200);
        } else if (gid === 'mecanoclass') {
            if (data.score >= 20) tryAward('mecanoclass_20', 20);
            if (data.score >= 40) tryAward('mecanografo', 50);
            if (data.score >= 60) tryAward('mecanoclass_60', 100);
            if (data.score >= 70) tryAward('velocista', 120);
            if (data.score >= 100) tryAward('mecanoclass_100', 250);
        } else if (gid === 'rompecodigos') {
            if (data.score >= 200) tryAward('rompecodigos_200', 50);
            if (data.score >= 500) tryAward('rompecodigos_500', 100);
            if (data.score >= 800) tryAward('criptologo', 150);
            if (data.score >= 1200) tryAward('rompecodigos_1200', 200);
        } else if (gid === 'helados') {
            if (data.score >= 200) tryAward('programador_bloques', 0);
            if (data.score >= 500) tryAward('helados_500', 0);
            if (data.score >= 1000) tryAward('helados_1000', 100);
            if (data.score >= 1500) tryAward('helados_1500', 150);
            if (data.score >= 2000) tryAward('helados_2000', 200);
            if (data.score >= 2500) tryAward('helados_2500', 250);
            if (data.score >= 3000) tryAward('helados_3000', 300);
            if (data.score >= 35000) tryAward('helados_35000', 1000);
        } else if (gid === 'moon') {
            if (data.metadata && data.metadata.level >= 3) tryAward('moon_3', 50);
            if (data.metadata && data.metadata.level >= 5) tryAward('explorador_lunar', 100);
            if (data.metadata && data.metadata.level >= 10) tryAward('moon_10', 150);
            if (data.metadata && data.metadata.level >= 15) tryAward('moon_15', 200);
        } else if (gid === 'arenabots') {
            if (data.score >= 50) tryAward('arenabots_50', 50);
            if (data.score >= 100) tryAward('arenabots_100', 100);
            if (data.score >= 150) tryAward('arenabots_150', 150);
            if (nPartidas >= 3) tryAward('arquitecto_bot', 250);
        } else if (gid === 'cybersmith') {
            if (data.score >= 100) tryAward('cybersmith_100', 50);
            if (data.score >= 250) tryAward('cybersmith_250', 100);
            if (data.score >= 400) tryAward('ingeniero', 150);
            if (data.score >= 600) tryAward('cybersmith_600', 200);
        } else if (gid === 'asimov') {
            if (data.score >= 20) tryAward('asimov_20', 30);
            if (data.score >= 50) tryAward('asimov_50', 60);
            if (data.score >= 80) tryAward('leyes_robotica', 100);
            if (data.score >= 100) tryAward('asimov_100', 150);
        } else if (gid === 'appflow') {
            if (data.score >= 50) tryAward('appflow_50', 50);
            if (data.score >= 100) tryAward('appflow_100', 100);
            if (data.score >= 200) tryAward('unicornio', 150);
            if (data.score >= 300) tryAward('appflow_300', 200);
        } else if (gid === 'trivial') {
            if (data.score >= 30) tryAward('trivial_30', 30);
            if (data.score >= 60) tryAward('trivial_60', 60);
            if (data.score >= 100) tryAward('sabiondo', 100);
        }
      });

      // 2. Procesar Tests de Repaso (test_teoria_respuestas)
      const snapTests = await getDocs(query(collection(db, 'test_teoria_respuestas'), orderBy('fecha', 'asc')));
      const userTests = {};
      snapTests.forEach(d => {
        const data = d.data();
        const uid = data.uid;
        const topicId = data.topicId;
        const score = data.score;
        if (!uid || !topicId || score === undefined) return;
        
        if (!userTests[uid]) userTests[uid] = {};
        if (!userTests[uid][topicId]) userTests[uid][topicId] = { passed: false, outstanding: false, count: 0 };
        
        const state = userTests[uid][topicId];
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
        
        userXP[uid] = (userXP[uid] || 0) + xp;
      });
      
      // 3. Procesar Exámenes (respuestas_test)
      const snapExams = await getDocs(collection(db, 'respuestas_test'));
      snapExams.forEach(d => {
        const data = d.data();
        const uid = data.uid;
        if (!uid || !data.puntosOtorgados || !data.calculado || data.calculado.nota === undefined) return;
        const nota = data.calculado.nota;
        let xp = 5 + (nota >= 5 ? 5 : 0) + (nota > 9 ? 5 : 0);
        userXP[uid] = (userXP[uid] || 0) + xp;
        
        awardMedal(uid, 'primer_examen');
        if (nota >= 9.5) awardMedal(uid, 'maestro_teoria');
        if (nota >= 8.5 && nota < 9.5) awardMedal(uid, 'casi_perfecto');
        if (Math.abs(nota - 5.0) < 0.1) awardMedal(uid, 'por_los_pelos');
        if (nota > 5) awardMedal(uid, 'aprobado_teoria');
      });
      
      // 4. Aplicar los resultados a los usuarios
      let totalXPAwarded = 0;
      for (const [uid, xp] of Object.entries(userXP)) {
         if (xp > 0) {
            await updateDoc(doc(db, 'users', uid), { puntosTotal: 0 }); // resetear para aplicar el nuevo cálculo exacto
            await addXPAndCheckLogros(uid, xp);
            totalXPAwarded += xp;
            usersUpdated.add(uid);
         }
      }
      
      status.textContent = `¡Listo! Se recalculó la XP retroactiva: ${totalXPAwarded} XP a ${usersUpdated.size} alumnos.`;
      status.style.color = 'var(--success)';
      showToast('Recálculo completado', `XP y Medallas retroactivas actualizadas.`);
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
