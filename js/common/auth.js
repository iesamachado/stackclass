// ═══════════════════════════════════════════════════════════════════════
//  STACKCLASS — Auth (Autenticación unificada con Supabase)
//  -----------------------------------------------------------------------
//  Gestiona:
//   - Login con Google OAuth (alumno y profesor)
//   - Guard de autenticación (requireAuth)
//   - Guard de acceso a juego (requireGameAccess)
//   - Estado global: currentUser, currentProfile
// ═══════════════════════════════════════════════════════════════════════

import { supabase } from './supabase-config.js';
import { getUserProfile, updateUserProfile, isStudentInAnyClass,
         isTeacherAuthorized, resolvePendingStudent } from './db.js';
import { generateAvatar, generateTeacherAvatar, anonymizeName,
         getUrlParams, getAppUrl } from './utils.js';

export const SUPERADMIN_EMAIL = 'bernatcosta@iesamachado.org';

// ──────────────────────────────────────────────────────────────────────
//  Estado global exportado
// ──────────────────────────────────────────────────────────────────────
export let currentUser    = null;
export let currentProfile = null;

export function isAdmin(user = currentUser, profile = currentProfile) {
  if (!user) return false;
  const email = (user.email || '').toLowerCase().trim();
  if (email === SUPERADMIN_EMAIL.toLowerCase()) return true;
  return profile?.role === 'admin';
}

// ──────────────────────────────────────────────────────────────────────
//  LOGIN — Google OAuth (alumno)
// ──────────────────────────────────────────────────────────────────────
export async function loginStudentGoogle() {
  const { error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: `${getAppUrl()}/dashboard_student.html`,
      scopes: 'email profile'
    }
  });
  if (error) throw error;
}

// ──────────────────────────────────────────────────────────────────────
//  LOGIN — Google OAuth (docente con scopes de Classroom)
// ──────────────────────────────────────────────────────────────────────
export async function loginTeacherGoogle() {
  const { error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: `${getAppUrl()}/dashboard_teacher.html`,
      scopes: [
        'email', 'profile',
        'https://www.googleapis.com/auth/classroom.courses.readonly',
        'https://www.googleapis.com/auth/classroom.coursework.students',
        'https://www.googleapis.com/auth/classroom.rosters.readonly',
        'https://www.googleapis.com/auth/classroom.profile.emails'
      ].join(' ')
    }
  });
  if (error) throw error;
}

// ──────────────────────────────────────────────────────────────────────
//  LOGOUT
// ──────────────────────────────────────────────────────────────────────
export async function logout() {
  await supabase.auth.signOut();
  currentUser    = null;
  currentProfile = null;
  window.location.href = 'index.html';
}

// ──────────────────────────────────────────────────────────────────────
//  CREAR / ACTUALIZAR PERFIL en primera sesión
// ──────────────────────────────────────────────────────────────────────
async function ensureProfile(user) {
  let profile = await getUserProfile(user.id);
  const email = (user.email || '').toLowerCase().trim();

  if (!profile) {
    // Si el usuario fue importado desde Firebase, su perfil existe asociado a su email
    const existing = await getUserByEmail(email);
    if (existing) {
      // Actualizar el ID para vincularlo al ID de sesión de Supabase
      await updateUserProfile(existing.id, { id: user.id });
      profile = await getUserProfile(user.id) || existing;
      return profile;
    }

    // Primera vez: determinar rol
    const teacher = await isTeacherAuthorized(email);

    const role    = teacher ? teacher.role : 'student';
    const isStud  = role === 'student' ? await isStudentInAnyClass(email) : false;

    if (role === 'student' && !isStud && email !== SUPERADMIN_EMAIL.toLowerCase()) {
      await supabase.auth.signOut();
      throw new Error('NOT_AUTHORIZED');
    }

    const newProfile = {
      id:                user.id,
      email,
      display_name:      user.user_metadata?.full_name || email.split('@')[0],
      display_name_anon: anonymizeName(user.user_metadata?.full_name || email),
      role,
      avatar:            role === 'teacher'
                           ? generateTeacherAvatar(email)
                           : generateAvatar(email),
      created_at:        new Date().toISOString()
    };

    await updateUserProfile(user.id, newProfile);
    profile = newProfile;

    // Resolver miembros pendientes por email
    if (role === 'student') {
      await resolvePendingStudent(user.id, email);
    }
  }

  return profile;
}

// ──────────────────────────────────────────────────────────────────────
//  GUARD: requireAuth
//  Uso: requireAuth({ allowedRoles: ['student'], onAuthorized: async (user, profile) => {} })
// ──────────────────────────────────────────────────────────────────────
export function requireAuth({ allowedRoles = null, onAuthorized, onUnauthorized } = {}) {
  supabase.auth.onAuthStateChange(async (event, session) => {
    if (!session) {
      window.location.href = 'index.html';
      return;
    }

    const user = session.user;
    try {
      const profile = await ensureProfile(user);
      currentUser    = user;
      currentProfile = profile;

      if (allowedRoles && !allowedRoles.includes(profile.role) && !isAdmin()) {
        if (onUnauthorized) { onUnauthorized(user, profile); return; }
        window.location.href = profile.role === 'teacher'
          ? 'dashboard_teacher.html'
          : 'dashboard_student.html';
        return;
      }

      if (onAuthorized) await onAuthorized(user, profile);

    } catch (err) {
      if (err.message === 'NOT_AUTHORIZED') {
        window.location.href = 'index.html?error=not_authorized';
      } else {
        console.error('Auth error:', err);
        window.location.href = 'index.html';
      }
    }
  });
}

// ──────────────────────────────────────────────────────────────────────
//  GUARD: requireGameAccess
//  Comprueba que el alumno tiene la clase con ese juego habilitado.
// ──────────────────────────────────────────────────────────────────────
export function requireGameAccess(gameId, { onGranted, onDenied } = {}) {
  requireAuth({
    allowedRoles: ['student', 'teacher', 'admin'],
    onAuthorized: async (user, profile) => {
      if (profile.role !== 'student') {
        if (onGranted) await onGranted(user, profile, null);
        return;
      }

      const { getStudentClasses } = await import('./db.js');
      const { classId } = getUrlParams();
      const classes = await getStudentClasses(user.id);

      const accessClass = classes.find(cls =>
        (classId ? cls.id === classId : true) &&
        (cls.enabled_games || []).includes(gameId)
      );

      if (accessClass) {
        if (onGranted) await onGranted(user, profile, accessClass);
      } else {
        if (onDenied) {
          onDenied(user, profile);
        } else {
          window.location.href = `dashboard_student.html?noAccess=${gameId}`;
        }
      }
    }
  });
}

// ──────────────────────────────────────────────────────────────────────
//  Bienestar Digital — límite de 5 partidas/intentos al día por juego
// ──────────────────────────────────────────────────────────────────────
export async function checkDigitalWellbeing(uid, type, specificId) {
  const today = new Date().toISOString().slice(0, 10); // 'YYYY-MM-DD'

  const table  = type === 'game' ? 'game_results' : 'topic_test_results';
  const column = type === 'game' ? 'game_id'      : 'topic_id';

  const { count } = await supabase
    .from(table)
    .select('id', { count: 'exact', head: true })
    .eq('student_id', uid)
    .eq(column, specificId)
    .gte('created_at', `${today}T00:00:00Z`);

  return count || 0;
}

export async function incrementDigitalWellbeing(uid, type, specificId) {
  const { showModal } = await import('./ui.js');
  const count = await checkDigitalWellbeing(uid, type, specificId);

  if (count >= 5) {
    const { getAppUrl } = await import('./utils.js');
    showModal({
      title: 'Descanso Digital Recomendado 🧘',
      body: `
        <div style="text-align:center;">
          <p style="font-size:3rem;margin-bottom:10px;">🌿</p>
          <p>Has alcanzado el límite diario de <strong>5 ${type === 'game' ? 'partidas en este juego' : 'intentos en este test'}</strong>.</p>
          <p style="opacity:.8;margin-top:15px;">El bienestar digital es fundamental. ¡Descansa, da un paseo o lee un libro!</p>
        </div>`,
      confirmText: 'Entendido',
      hideCancel: true,
      onConfirm: () => { window.location.href = getAppUrl(); }
    });
    return false; // Bloqueado
  }
  return true; // Permitido
}

// ──────────────────────────────────────────────────────────────────────
//  Render de cabecera de usuario (navbar)
// ──────────────────────────────────────────────────────────────────────
export function renderHeader(user, profile) {
  const { renderNavbar } = window;
  if (typeof renderNavbar === 'function') {
    renderNavbar(user, profile);
    return;
  }
  // Fallback: buscar elementos comunes
  const nameEl   = document.getElementById('user-name');
  const avatarEl = document.getElementById('user-avatar');
  if (nameEl)   nameEl.textContent = profile?.display_name || user?.email || '';
  if (avatarEl) avatarEl.textContent = profile?.avatar || '🎓';
}

export function setupAuthListener(callback) {
  supabase.auth.onAuthStateChange(async (event, session) => {
    if (!session) {
      callback(null, null);
      return;
    }
    try {
      const profile = await ensureProfile(session.user);
      currentUser = session.user;
      currentProfile = profile;
      callback(session.user, profile);
    } catch(e) {
      callback(null, null);
    }
  });
}
