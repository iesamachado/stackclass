// ============================================================
// alumno.js — Agente Analista Lobby Logic (Supabase)
// ============================================================

import { requireAuth } from '../../../../js/common/auth.js';
import { renderHeader, showToast } from '../../../../js/common/ui.js';
import { getSession, joinSession, listenSession } from './RompeDb.js';

let sesionEncontrada = null;
let equipoId = null;
let unsubSesion = null;
let currentUserObj = null;

document.addEventListener('DOMContentLoaded', () => {
  requireAuth({
    allowedRoles: ['teacher', 'student'],
    onAuthorized: (user, profile) => {
      currentUserObj = user;
      renderHeader(user, profile);
      initAlumno(user);
    }
  });
});

function initAlumno(user) {
  initCodeInput();
  initJoinBtn();
}

// ─── Code Input ───────────────────────────────────────────────
function initCodeInput() {
  const input = document.getElementById('input-codigo');
  if (!input) return;

  input.addEventListener('input', (e) => {
    e.target.value = e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '');
    document.getElementById('sala-encontrada')?.classList.add('hidden');
    sesionEncontrada = null;
  });

  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') document.getElementById('btn-buscar-sala')?.click();
  });
}

// ─── Buscar Sala ──────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('btn-buscar-sala')?.addEventListener('click', buscarSala);
});

async function buscarSala() {
  const codigo = document.getElementById('input-codigo')?.value.trim().toUpperCase();
  if (!codigo || codigo.length < 4) {
    showToast('Código inválido', 'Introduce al menos 4 caracteres', 'error');
    return;
  }

  const btn = document.getElementById('btn-buscar-sala');
  btn.disabled = true;
  btn.innerHTML = '<span class="spinner"></span>';

  try {
    const session = await getSession(codigo);

    if (!session || session.status === 'finished') {
      showToast('Sala no encontrada', 'Verifica el código o que la sesión esté activa', 'error');
      btn.disabled = false;
      btn.textContent = 'Buscar';
      return;
    }

    sesionEncontrada = session;
    const numEquipos = Object.keys(session.equipos || {}).length;

    document.getElementById('sala-profesor').textContent   = sesionEncontrada.profesorNombre || 'Desconocido';
    document.getElementById('sala-dificultad').textContent = capitalize(sesionEncontrada.dificultad || '—');
    document.getElementById('sala-equipos').textContent    = numEquipos + ' equipos';
    document.getElementById('sala-encontrada').classList.remove('hidden');

    showToast('¡Sala encontrada!', `Creada por ${sesionEncontrada.profesorNombre}`, 'success');

  } catch (err) {
    showToast('Error', err.message, 'error');
  } finally {
    btn.disabled = false;
    btn.textContent = 'Buscar';
  }
}

// ─── Unirse a Sala ────────────────────────────────────────────
function initJoinBtn() {
  document.getElementById('btn-unirse')?.addEventListener('click', unirseASala);
}

async function unirseASala() {
  if (!sesionEncontrada) {
    showToast('Busca primero una sala', '', 'error');
    return;
  }

  const nombreEquipo = document.getElementById('input-equipo')?.value.trim();
  if (!nombreEquipo) {
    showToast('Falta el nombre del equipo', '', 'error');
    return;
  }

  const user = currentUserObj;
  if (!user) return;

  const btn = document.getElementById('btn-unirse');
  btn.disabled = true;
  btn.innerHTML = '<span class="spinner"></span> Uniéndome...';

  try {
    const res = await joinSession(sesionEncontrada.codigo, nombreEquipo, user);
    equipoId = res.equipoId;

    // Guardar en localStorage para recuperar en juego.html
    localStorage.setItem('rompehielos_sesion',  sesionEncontrada.codigo);
    localStorage.setItem('rompehielos_equipo',  equipoId);
    localStorage.setItem('rompehielos_codigo',  sesionEncontrada.codigo);
    localStorage.setItem('rompehielos_equipo_nombre', nombreEquipo);

    showWaitingRoom(nombreEquipo);
    listenSesionUpdates(sesionEncontrada.codigo, nombreEquipo);

  } catch (err) {
    showToast('Error', err.message, 'error');
    btn.disabled = false;
    btn.innerHTML = '🚀 Unirme a la Misión';
  }
}

// ─── Mostrar sala de espera ───────────────────────────────────
function showWaitingRoom(equipoNombre) {
  document.getElementById('step-join').classList.add('hidden');
  const waiting = document.getElementById('step-waiting');
  waiting.classList.remove('hidden');

  document.getElementById('waiting-equipo-name').textContent = equipoNombre;
  document.getElementById('waiting-codigo').textContent      = sesionEncontrada.codigo;
}

// ─── Escuchar estado de sesión y equipos ──────────────────────
function listenSesionUpdates(sesionId, miEquipo) {
  if (unsubSesion) unsubSesion();

  unsubSesion = listenSession(sesionId, data => {
    if (!data) return;

    // Si la sesión pasa a en_curso, redirigir al juego
    if (data.estado === 'en_curso' && data.rondaActual > 0) {
      showToast('¡La misión comienza!', 'Redirigiendo...', 'success');
      setTimeout(() => {
        window.location.href = 'juego.html';
      }, 1500);
    }

    // Equipos en sala de espera
    const equipos = Object.values(data.equipos || {});
    const list = document.getElementById('equipos-waiting-list');
    if (!list) return;

    if (!equipos.length) {
      list.innerHTML = '<div class="text-muted" style="text-align:center; padding: 1rem; font-size:0.85rem">Sois el primer equipo</div>';
      return;
    }

    list.innerHTML = equipos.map(eq => `
      <div class="equipo-waiting-item ${eq.nombre === miEquipo ? 'my-team' : ''}">
        <span class="status-dot online"></span>
        <span class="equipo-waiting-nombre">${eq.nombre}</span>
        <span class="equipo-waiting-badge">
          ${eq.nombre === miEquipo ? '<span class="badge badge-secondary">Tu equipo</span>' : `<span class="text-muted" style="font-size:0.78rem">${(eq.miembros||[]).length} miembro(s)</span>`}
        </span>
      </div>
    `).join('');
  });
}

// ─── Utils ───────────────────────────────────────────────────
function capitalize(str) {
  return str.charAt(0).toUpperCase() + str.slice(1);
}
