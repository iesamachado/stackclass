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
import { getUserProfile, getUserByEmail, updateUserProfile, isStudentInAnyClass,
         isTeacherAuthorized, resolvePendingStudent, syncCurrentUserProfile } from './db.js';
import { generateAvatar, generateTeacherAvatar, anonymizeName,
         getUrlParams, getAppUrl } from './utils.js';

export let currentUser    = null;
export let currentProfile = null;
export let classroomToken = (typeof sessionStorage !== 'undefined' ? sessionStorage.getItem('classroom_token') : null);

export function isAdmin(user = currentUser, profile = currentProfile) {
  if (!user && !profile) return false;
  return profile?.is_superadmin === true;
}

export async function refreshClassroomToken() {
  const { data } = await supabase.auth.getSession();
  if (data?.session?.provider_token) {
    classroomToken = data.session.provider_token;
    try { sessionStorage.setItem('classroom_token', classroomToken); } catch (_) {}
  }
  return classroomToken;
}

export async function updateUserProfileData(updates) {
  if (!currentUser) throw new Error('No hay usuario autenticado.');
  await updateUserProfile(currentUser.id, updates);
  if (currentProfile) {
    Object.assign(currentProfile, updates);
    if (updates.avatar) currentProfile.photoURL = updates.avatar;
    if (updates.display_name) currentProfile.displayName = updates.display_name;
  }
  return currentProfile;
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
  const email = (user.email || '').toLowerCase().trim();

  // 1. Sincronizar / obtener perfil vía RPC en Postgres (con privilegios SECURITY DEFINER)
  let profile = await syncCurrentUserProfile();

  // 2. Fallback de lectura directa si el RPC no devolvió perfil
  if (!profile) {
    profile = await getUserProfile(user.id);
  }

  // 3. Comprobar autorización docente y perfil previo por email (p. ej. importado de Firebase)
  const teacher = await isTeacherAuthorized(email);
  const isSuperAdmin = !!(profile?.is_superadmin || teacher?.isSuperAdmin || teacher?.is_superadmin);
  const legacyUser = await getUserByEmail(email);

  if (profile) {
    if (legacyUser && legacyUser.id !== user.id) {
      // Combinar datos históricos de Firebase con el nuevo UUID
      const enriched = {};
      if ((!profile.xp || profile.xp === 0) && legacyUser.xp > 0) {
        profile.xp = legacyUser.xp;
        enriched.xp = legacyUser.xp;
      }
      if (!profile.guild_id && legacyUser.guild_id) {
        profile.guild_id = legacyUser.guild_id;
        enriched.guild_id = legacyUser.guild_id;
      }
      if ((!profile.logros || profile.logros.length === 0) && legacyUser.logros?.length > 0) {
        profile.logros = legacyUser.logros;
        enriched.logros = legacyUser.logros;
      }
      if ((!profile.display_name || profile.display_name === email.split('@')[0]) && legacyUser.display_name) {
        profile.display_name = legacyUser.display_name;
        enriched.display_name = legacyUser.display_name;
      }
      if (!profile.display_name_anon && legacyUser.display_name_anon) {
        profile.display_name_anon = legacyUser.display_name_anon;
        enriched.display_name_anon = legacyUser.display_name_anon;
      }
      if ((!profile.avatar || profile.avatar.includes('bottts')) && legacyUser.avatar) {
        profile.avatar = legacyUser.avatar;
        enriched.avatar = legacyUser.avatar;
      }
      if (!profile.subject_id && legacyUser.subject_id) {
        profile.subject_id = legacyUser.subject_id;
        enriched.subject_id = legacyUser.subject_id;
      }

      if (Object.keys(enriched).length > 0) {
        try {
          await updateUserProfile(user.id, enriched);
        } catch (_) {}
      }

      // Migrar membresías de clases históricas
      try {
        const { data: legacyMems } = await supabase.from('class_members').select('class_id').eq('student_id', legacyUser.id);
        if (legacyMems && legacyMems.length > 0) {
          for (const m of legacyMems) {
            await supabase.from('class_members').upsert({ class_id: m.class_id, student_id: user.id }, { onConflict: 'class_id,student_id' });
          }
        }
      } catch (_) {}
    }
  } else {
    // Si no existía perfil con user.id
    if (legacyUser) {
      profile = {
        ...legacyUser,
        id: user.id,
        email
      };
      try {
        await updateUserProfile(user.id, profile);
      } catch (err) {
        console.warn('Could not upsert legacy profile:', err);
      }
    } else {
      const role = teacher ? 'teacher' : 'student';
      const isStud = role === 'student' ? await isStudentInAnyClass(email) : false;

      if (role === 'student' && !isStud && !isSuperAdmin) {
        await supabase.auth.signOut();
        throw new Error('NOT_AUTHORIZED');
      }

      const newProfile = {
        id:                user.id,
        email,
        display_name:      user.user_metadata?.full_name || email.split('@')[0],
        display_name_anon: anonymizeName(user.user_metadata?.full_name || email),
        role,
        is_superadmin:     isSuperAdmin,
        avatar:            role === 'teacher'
                             ? generateTeacherAvatar(email)
                             : generateAvatar(email),
        created_at:        new Date().toISOString()
      };

      try {
        await updateUserProfile(user.id, newProfile);
      } catch (err) {
        console.warn('Could not upsert user profile directly:', err);
      }
      profile = newProfile;

      // Resolver miembros pendientes por email
      if (role === 'student') {
        await resolvePendingStudent(user.id, email);
      }
      return profile;
    }
  }

  // 4. Sincronización de roles en memoria y en base de datos
  if (teacher) {
    profile.role = 'teacher';
    profile.is_superadmin = isSuperAdmin;
  } else if (!teacher && profile.role === 'teacher') {
    // Docente cuyo acceso ha sido revocado
    profile.role = 'student';
    profile.is_superadmin = false;
    try {
      await updateUserProfile(profile.id, { role: 'student', is_superadmin: false });
    } catch (_) {}
  }

  // 5. Normalizar campos para compatibilidad (camelCase / snake_case)
  const metaName = user.user_metadata?.full_name || user.user_metadata?.name;
  const metaAvatar = user.user_metadata?.avatar_url || user.user_metadata?.picture;

  profile.id           = profile.id || user.id;
  profile.uid          = profile.id;
  profile.display_name = profile.display_name || profile.displayName || metaName || email.split('@')[0];
  profile.displayName  = profile.display_name;
  profile.display_name_anon = profile.display_name_anon || profile.displayNameAnonymized || anonymizeName(profile.display_name);
  profile.displayNameAnonymized = profile.display_name_anon;
  profile.puntosTotal  = profile.xp !== undefined ? profile.xp : (profile.puntosTotal || 0);
  profile.xp           = profile.puntosTotal;
  profile.gremio       = profile.guild_id || profile.gremio || '';
  profile.guild_id     = profile.gremio;
  profile.avatar       = profile.avatar || profile.photoURL || metaAvatar || (isSuperAdmin || teacher ? generateTeacherAvatar(email) : generateAvatar(email));
  profile.photoURL     = profile.avatar;
  user.uid             = user.id;

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

    if (session.provider_token) {
      classroomToken = session.provider_token;
      try { sessionStorage.setItem('classroom_token', classroomToken); } catch (_) {}
    }

    const user = session.user;
    try {
      const profile = await ensureProfile(user);
      currentUser    = user;
      currentProfile = profile;

      if (allowedRoles && !allowedRoles.includes(profile.role) && !isAdmin(user, profile)) {
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
    allowedRoles: ['student', 'teacher'],
    onAuthorized: async (user, profile) => {
      if (profile.role !== 'student') {
        if (onGranted) await onGranted(user, profile, null);
        return;
      }

      // 1. Bienestar Digital: Comprobación PREVIA antes de cargar o iniciar partida
      const allowed = await incrementDigitalWellbeing(user.id, 'game', gameId);
      if (!allowed) {
        document.querySelectorAll('button[id*="start"], button[id*="play"], .btn-start, #btn-start, #btnCreateLive').forEach(btn => {
          btn.disabled = true;
          btn.style.pointerEvents = 'none';
          btn.style.opacity = '0.3';
        });
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
//  Bienestar Digital — Horario de Descanso Escolar y Límite Diario
// ──────────────────────────────────────────────────────────────────────
export function getMadridHour() {
  return parseInt(new Intl.DateTimeFormat('es-ES', {
    timeZone: 'Europe/Madrid',
    hour: 'numeric',
    hour12: false
  }).format(new Date()), 10);
}

export function isNightRestTime() {
  const h = getMadridHour();
  return h >= 23 || h < 7;
}

export async function checkDigitalWellbeing(uid, type, specificId) {
  // Fecha local en formato YYYY-MM-DD según la zona horaria peninsular (Europe/Madrid)
  const madridDate = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Madrid' }).format(new Date());
  const now = new Date();
  const utcDate = new Date(now.toLocaleString('en-US', { timeZone: 'UTC' }));
  const tzDate  = new Date(now.toLocaleString('en-US', { timeZone: 'Europe/Madrid' }));
  const diffHours = Math.round((tzDate - utcDate) / 3600000);
  const pad = n => String(Math.abs(n)).padStart(2, '0');
  const sign = diffHours >= 0 ? '+' : '-';
  const tzOffset = `${sign}${pad(diffHours)}:00`;
  const startOfDay = `${madridDate}T00:00:00${tzOffset}`;

  const table  = type === 'game' ? 'game_results' : 'topic_test_results';
  const column = type === 'game' ? 'game_id'      : 'topic_id';

  const { count } = await supabase
    .from(table)
    .select('id', { count: 'exact', head: true })
    .eq('student_id', uid)
    .eq(column, specificId)
    .gte('created_at', startOfDay);

  return count || 0;
}

export async function incrementDigitalWellbeing(uid, type, specificId) {
  // Los profesores no tienen restricciones
  if (currentProfile && currentProfile.role !== 'student') {
    return true;
  }

  const { showModal } = await import('./ui.js');
  const { getAppUrl } = await import('./utils.js');

  // 1. BLOQUEO PREVIO: Horario de descanso escolar (23:00 - 07:00)
  if (isNightRestTime()) {
    document.querySelectorAll('button[id*="start"], button[id*="play"], .btn-start, #btn-start, #btnCreateLive').forEach(btn => {
      btn.disabled = true;
      btn.style.pointerEvents = 'none';
      btn.style.opacity = '0.3';
    });

    showModal({
      title: '¡Hora de descansar! 🌙😴',
      className: 'modal-wellbeing',
      body: `
        <div style="text-align:center;">
          <p style="font-size:3.5rem;margin-bottom:12px;">🛌💤</p>
          <h3 style="margin-bottom:8px;font-size:1.15rem;font-weight:700;">
            Horario de descanso escolar (23:00 a 07:00)
          </h3>
          <p style="opacity:.85;line-height:1.5;margin-bottom:8px;">
            Por bienestar digital y salud escolar, los juegos y cuestionarios están desactivados durante la noche.
          </p>
          <p style="opacity:.8;font-size:var(--text-sm);">
            ¡Apaga la pantalla, descansa bien y vuelve mañana con las pilas cargadas!
          </p>
        </div>`,
      confirmText: 'Entendido, voy a dormir 🛌',
      hideCancel: true,
      onConfirm: () => { window.location.href = getAppUrl('dashboard_student.html'); }
    });
    return false; // Bloqueado ANTES de jugar
  }

  // 2. BLOQUEO PREVIO: Límite diario de 5 partidas / intentos
  const count = await checkDigitalWellbeing(uid, type, specificId);
  if (count >= 5) {
    document.querySelectorAll('button[id*="start"], button[id*="play"], .btn-start, #btn-start, #btnCreateLive').forEach(btn => {
      btn.disabled = true;
      btn.style.pointerEvents = 'none';
      btn.style.opacity = '0.3';
    });

    showModal({
      title: 'Descanso Digital Recomendado 🧘',
      className: 'modal-wellbeing',
      body: `
        <div style="text-align:center;">
          <p style="font-size:3.5rem;margin-bottom:12px;">🌿✨</p>
          <h3 style="margin-bottom:8px;font-size:1.15rem;font-weight:700;">
            Límite diario alcanzado
          </h3>
          <p style="line-height:1.5;margin-bottom:8px;">
            Ya has completado el máximo de <strong>5 ${type === 'game' ? 'partidas' : 'intentos'} hoy</strong> en este ${type === 'game' ? 'minijuego' : 'test'}.
          </p>
          <p style="opacity:.8;font-size:var(--text-sm);">
            El descanso y la moderación son esenciales para tu aprendizaje. ¡Has cumplido por hoy! Podrás continuar mañana.
          </p>
        </div>`,
      confirmText: 'Volver a Mis Clases',
      hideCancel: true,
      onConfirm: () => { window.location.href = getAppUrl('dashboard_student.html'); }
    });
    return false; // Bloqueado ANTES de jugar
  }

  return true; // Acceso permitido
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
    if (session.provider_token) {
      classroomToken = session.provider_token;
      try { sessionStorage.setItem('classroom_token', classroomToken); } catch (_) {}
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
