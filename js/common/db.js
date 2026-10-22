// ═══════════════════════════════════════════════════════════════════════
//  STACKCLASS — DB (Capa de datos Supabase unificada)
//  -----------------------------------------------------------------------
//  Tablas principales:
//    users, subjects, guilds, medals, classes, class_members
//    assignments, topics, topic_questions, topic_test_results
//    exam_questions, exams, exam_results, game_results
//    live_sessions, live_participants, mecanoclass_texts
//    arena_bots, offline_tasks, offline_grades
//    allowed_teachers, allowed_students
// ═══════════════════════════════════════════════════════════════════════

import { supabase } from './supabase-config.js';
import { LOCAL_TOPICS } from './topics_data.js';
export { supabase };

// ══════════════════════════════════════════════════════════════════
//  USUARIOS
// ══════════════════════════════════════════════════════════════════

export async function getUserProfile(uid) {
  const { data, error } = await supabase
    .from('users').select('*').eq('id', uid).maybeSingle();
  if (error) throw error;
  return data || null;
}

export async function syncCurrentUserProfile() {
  const { data, error } = await supabase.rpc('sync_current_user_profile');
  if (error) {
    console.error('Error in sync_current_user_profile:', error);
    return null;
  }
  return data || null;
}

export async function updateUserProfile(uid, data) {
  const mapped = { ...data };
  if (mapped.displayName !== undefined && mapped.display_name === undefined) {
    mapped.display_name = mapped.displayName;
  }
  delete mapped.displayName;

  if (mapped.photoURL !== undefined && mapped.avatar === undefined) {
    mapped.avatar = mapped.photoURL;
  }
  delete mapped.photoURL;
  delete mapped.photo_url;
  delete mapped.avatarUrl;
  delete mapped.avatar_url;

  if (mapped.displayNameAnonymized !== undefined && mapped.display_name_anon === undefined) {
    mapped.display_name_anon = mapped.displayNameAnonymized;
  }
  delete mapped.displayNameAnonymized;

  if (mapped.puntosTotal !== undefined && mapped.xp === undefined) {
    mapped.xp = mapped.puntosTotal;
  }
  delete mapped.puntosTotal;
  delete mapped.points;

  if (mapped.subjectId !== undefined && mapped.subject_id === undefined) {
    mapped.subject_id = mapped.subjectId;
  }
  delete mapped.subjectId;

  if (mapped.guildId !== undefined && mapped.guild_id === undefined) {
    mapped.guild_id = mapped.guildId;
  }
  if (mapped.gremio !== undefined && mapped.guild_id === undefined) {
    mapped.guild_id = mapped.gremio;
  }
  delete mapped.guildId;
  delete mapped.gremio;

  delete mapped.uid;
  delete mapped.id;

  const { error } = await supabase
    .from('users').update(mapped).eq('id', uid);
  if (error) throw error;
}

export async function upsertUserProfile(uid, data) {
  const mapped = { ...data };
  if (mapped.displayName !== undefined && mapped.display_name === undefined) {
    mapped.display_name = mapped.displayName;
  }
  delete mapped.displayName;

  if (mapped.photoURL !== undefined && mapped.avatar === undefined) {
    mapped.avatar = mapped.photoURL;
  }
  delete mapped.photoURL;
  delete mapped.photo_url;
  delete mapped.avatarUrl;
  delete mapped.avatar_url;

  if (mapped.displayNameAnonymized !== undefined && mapped.display_name_anon === undefined) {
    mapped.display_name_anon = mapped.displayNameAnonymized;
  }
  delete mapped.displayNameAnonymized;

  if (mapped.puntosTotal !== undefined && mapped.xp === undefined) {
    mapped.xp = mapped.puntosTotal;
  }
  delete mapped.puntosTotal;
  delete mapped.points;

  if (mapped.subjectId !== undefined && mapped.subject_id === undefined) {
    mapped.subject_id = mapped.subjectId;
  }
  delete mapped.subjectId;

  if (mapped.guildId !== undefined && mapped.guild_id === undefined) {
    mapped.guild_id = mapped.guildId;
  }
  if (mapped.gremio !== undefined && mapped.guild_id === undefined) {
    mapped.guild_id = mapped.gremio;
  }
  delete mapped.guildId;
  delete mapped.gremio;

  delete mapped.uid;
  mapped.id = uid;

  const { data: res, error } = await supabase
    .from('users').upsert(mapped, { onConflict: 'id' }).select().single();
  if (error) throw error;
  return res;
}

export async function getUserByEmail(email) {
  if (!email) return null;
  const clean = email.toLowerCase().trim();
  const { data, error } = await supabase
    .from('users').select('*').eq('email', clean).limit(1);
  if (error || !data || data.length === 0) return null;
  return data[0];
}

export async function getAllStudents() {
  const { data } = await supabase
    .from('users').select('*').eq('role', 'student').order('display_name');
  return data || [];
}

// ══════════════════════════════════════════════════════════════════
//  ASIGNATURAS
// ══════════════════════════════════════════════════════════════════

export async function getSubjects() {
  const { data } = await supabase
    .from('subjects').select('*').eq('active', true).order('name');
  return data || [];
}

export async function getSubject(id) {
  const { data, error } = await supabase
    .from('subjects').select('*').eq('id', id).maybeSingle();
  if (error) throw error;
  return data || null;
}

// ══════════════════════════════════════════════════════════════════
//  GREMIOS Y MEDALLAS (desde Supabase)
// ══════════════════════════════════════════════════════════════════

export async function getGuilds(subjectId = null) {
  let query = supabase.from('guilds').select('*');
  if (subjectId) {
    query = query.eq('subject_id', subjectId);
  }
  const { data, error } = await query;
  if (error) {
    console.error('Error fetching guilds:', error);
    return [];
  }
  return (data || []).map(g => ({
    ...g,
    image: g.image_url || g.image || ''
  }));
}

export async function getMedals(subjectId = null) {
  let query = supabase.from('medals').select('*');
  if (subjectId) {
    query = query.eq('subject_id', subjectId);
  }
  const { data, error } = await query;
  if (error) {
    console.error('Error fetching medals:', error);
    return [];
  }
  return data || [];
}

// ══════════════════════════════════════════════════════════════════
//  LIGAS Y CONFIGURACIÓN XP DE JUEGOS (desde Supabase)
// ══════════════════════════════════════════════════════════════════

export async function getLeagues() {
  const { data, error } = await supabase
    .from('leagues')
    .select('*')
    .order('sort_order', { ascending: true });
  if (error) {
    console.error('Error fetching leagues:', error);
    return [];
  }
  return data || [];
}

export async function getGameXPConfigs() {
  const { data, error } = await supabase
    .from('game_xp_configs')
    .select('*');
  if (error) {
    console.error('Error fetching game_xp_configs:', error);
    return [];
  }
  return data || [];
}

// ══════════════════════════════════════════════════════════════════
//  AUTORIZADOS
// ══════════════════════════════════════════════════════════════════

export async function isTeacherAuthorized(email) {
  if (!email) return null;
  const clean = email.toLowerCase().trim();

  const { data, error } = await supabase
    .from('allowed_teachers').select('*').eq('email', clean).maybeSingle();

  if (!error && data && data.active) {
    return {
      email: clean,
      role: 'teacher',
      name: data.name,
      subjectId: data.subject_id,
      addedBy: data.added_by,
      isSuperAdmin: !!data.is_superadmin
    };
  }

  // Comprobar también si el usuario en users ya está marcado como teacher o superadmin
  const { data: uData } = await supabase
    .from('users').select('*').eq('email', clean).maybeSingle();
  if (uData && (uData.role === 'teacher' || uData.is_superadmin)) {
    return {
      email: clean,
      role: 'teacher',
      name: uData.display_name,
      isSuperAdmin: !!uData.is_superadmin
    };
  }

  return null;
}

export async function isStudentInAnyClass(email, currentUserId = null) {
  if (!email) return false;
  const clean = email.toLowerCase().trim();

  // 1. Comprobar si está en allowed_students como autorizado
  try {
    const { data, error } = await supabase
      .from('allowed_students').select('allowed').eq('email', clean).maybeSingle();
    if (!error && data?.allowed === true) return true;
  } catch (_) {}

  // 2. Comprobar si ya existe en users como alumno preexistente
  // (p. ej. importado de Firebase o dado de alta por el profesor con ID legacy o datos académicos)
  let userRow = null;
  try {
    const { data: u, error: uErr } = await supabase
      .from('users').select('id, role, subject_id, guild_id, xp').eq('email', clean).maybeSingle();
    if (!uErr && u && (u.role === 'student' || u.role === 'alumn' || !u.role)) {
      userRow = u;
      // Si el id es distinto al de Google Auth actual, es un alumno legacy esperando vinculación
      if (currentUserId && u.id !== currentUserId) {
        return true;
      }
      // Si tiene asignatura, gremio o XP previo, es un alumno preexistente
      if (u.subject_id || u.guild_id || (u.xp && u.xp > 0)) {
        return true;
      }
    }
  } catch (_) {}

  // 3. Comprobar si pertenece a alguna clase en class_members
  try {
    const idsToCheck = [currentUserId, userRow?.id].filter(Boolean);
    if (idsToCheck.length > 0) {
      const { data: mems } = await supabase
        .from('class_members')
        .select('class_id')
        .in('student_id', idsToCheck)
        .limit(1);
      if (mems && mems.length > 0) {
        return true;
      }
    }
  } catch (_) {}

  // No permitir acceso a cuentas no dadas de alta, aunque pertenezcan al dominio @iesamachado.org
  return false;
}

export async function getAllowedTeachers() {
  const { data, error } = await supabase
    .from('allowed_teachers')
    .select('*')
    .order('created_at', { ascending: false });
  if (error) {
    console.error('Error fetching allowed_teachers:', error);
    return [];
  }
  return (data || []).map(row => ({
    id: row.email,
    email: row.email,
    name: row.name,
    role: 'teacher',
    subjectId: row.subject_id,
    addedBy: row.added_by,
    createdAt: row.created_at,
    active: row.active,
    isSuperAdmin: row.is_superadmin === true
  }));
}
export const getAllAllowedTeachers = getAllowedTeachers;

export async function authorizeTeacher(email, { name, role = 'teacher', subjectId = null, addedBy = null, isSuperAdmin = false } = {}) {
  const clean = (email || '').toLowerCase().trim();
  if (!clean || !clean.includes('@')) throw new Error('Correo electrónico inválido.');

  const updateData = {
    email: clean,
    role: 'teacher',
    active: true,
    is_superadmin: !!isSuperAdmin
  };
  if (name !== undefined) updateData.name = name;
  if (subjectId !== undefined) updateData.subject_id = subjectId;
  if (addedBy !== undefined) updateData.added_by = addedBy;

  const { error } = await supabase.from('allowed_teachers')
    .upsert(updateData, { onConflict: 'email' });
  if (error) throw error;

  // Sincronizar rol y superadmin en users si ya existe
  await supabase.from('users')
    .update({ role: 'teacher', is_superadmin: !!isSuperAdmin })
    .eq('email', clean);

  return true;
}
export const addAllowedTeacher = authorizeTeacher;

export async function removeAllowedTeacher(email) {
  const clean = (email || '').toLowerCase().trim();
  const { data: existing } = await supabase
    .from('allowed_teachers').select('is_superadmin').eq('email', clean).maybeSingle();

  if (existing?.is_superadmin) {
    throw new Error('No se puede revocar a un Superadministrador.');
  }

  const { error } = await supabase.from('allowed_teachers')
    .delete().eq('email', clean);
  if (error) throw error;

  // Degradar rol en users si existía
  await supabase.from('users')
    .update({ role: 'student', is_superadmin: false })
    .eq('email', clean);

  return true;
}

// ══════════════════════════════════════════════════════════════════
//  CLASES
// ══════════════════════════════════════════════════════════════════

export async function createClass(teacherId, arg1, arg2, arg3, arg4) {
  let subjectId = 'cyr';
  let name = '';
  let level = '1';
  let classroomCourseId = null;

  if (typeof arg1 === 'object') {
    // createClass(teacherId, { name, subjectId, level, classroomCourseId })
    name = arg1.name;
    subjectId = arg1.subjectId || 'cyr';
    level = arg1.level || '1';
    classroomCourseId = arg1.classroomCourseId || null;
  } else if (arg3 !== undefined && typeof arg3 !== 'object') {
    // createClass(teacherId, subjectId, name, level, options)
    subjectId = arg1;
    name = arg2;
    level = arg3;
    if (arg4 && typeof arg4 === 'object') {
      classroomCourseId = arg4.classroomCourseId || null;
    }
  } else {
    // Legacy: createClass(teacherId, name, level, options)
    name = arg1;
    level = arg2 || '1';
    if (arg3 && typeof arg3 === 'object') {
      classroomCourseId = arg3.classroomCourseId || null;
    }
    const nameLower = String(name || '').toLowerCase();
    const levelStr = String(level || '').toLowerCase();
    const isTic2 = levelStr.includes('bach') ||
      nameLower.includes('bachillerato') ||
      nameLower.includes('bach') ||
      /\b(tic|tic2|ticii|tic-2)\b/i.test(nameLower) ||
      nameLower.includes('tecnologías de la información');
    subjectId = isTic2 ? 'tic2' : 'cyr';
  }

  // Asegurar que la asignatura sea válida
  if (!['cyr', 'tic2'].includes(subjectId)) {
    subjectId = 'cyr';
  }

  const defaultGames = subjectId === 'tic2'
    ? ['kanban_hero', 'cc_trivial', 'cert_arcade', 'databreach', 'hex_invaders']
    : ['trivial', 'appflow', 'arenabots', 'asimov', 'cybersmith', 'helados', 'mecanoclass', 'moon', 'netdefender', 'rompecodigos'];

  const defaultTopics = subjectId === 'tic2'
    ? ['topic_kanban', 'topic_drive', 'topic_multimedia', 'topic_cms', 'topic_cyber', 'topic_html', 'topic_js', 'topic_js_adv']
    : ['block1', 'block2', 'block3', 'block4', 'block5'];

  const pin = Math.floor(100000 + Math.random() * 900000).toString();
  const { data, error } = await supabase.from('classes')
    .insert({
      teacher_id: teacherId,
      subject_id: subjectId,
      name,
      level: String(level),
      pin,
      enabled_games: defaultGames,
      enabled_topics: defaultTopics,
      classroom_id: classroomCourseId
    })
    .select().single();
  if (error) throw error;
  return data;
}

export async function getClass(classId) {
  if (!classId) return null;
  const { data, error } = await supabase
    .from('classes')
    .select('*, class_members(student_id)')
    .eq('id', classId)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  return {
    ...data,
    teacherId: data.teacher_id,
    enabledGames: data.enabled_games || [],
    enabledTopics: data.enabled_topics || [],
    criteriaMapping: data.criteria_mapping || (() => {
      try {
        const cached = localStorage.getItem(`class_criteria_mapping_${classId}`);
        return cached ? JSON.parse(cached) : {};
      } catch (_) { return {}; }
    })(),
    classroomCourseId: data.classroom_id,
    members: (data.class_members || []).map(m => m.student_id)
  };
}

export async function getTeacherClasses(teacherId) {
  if (!teacherId) return [];
  const { data, error } = await supabase
    .from('classes')
    .select('*, class_members(student_id)')
    .eq('teacher_id', teacherId)
    .eq('active', true)
    .order('created_at', { ascending: false });
  if (error) {
    console.error('Error fetching teacher classes:', error);
    return [];
  }
  return (data || []).map(cls => ({
    ...cls,
    teacherId: cls.teacher_id,
    enabledGames: cls.enabled_games || [],
    enabledTopics: cls.enabled_topics || [],
    criteriaMapping: cls.criteria_mapping || {},
    classroomCourseId: cls.classroom_id,
    members: (cls.class_members || []).map(m => m.student_id)
  }));
}

export async function updateClass(classId, updates) {
  const formatted = { ...updates };
  if ('teacherId' in formatted) {
    formatted.teacher_id = formatted.teacherId;
    delete formatted.teacherId;
  }
  if ('enabledGames' in formatted) {
    formatted.enabled_games = formatted.enabledGames;
    delete formatted.enabledGames;
  }
  if ('enabledTopics' in formatted) {
    formatted.enabled_topics = formatted.enabledTopics;
    delete formatted.enabledTopics;
  }
  if ('criteriaMapping' in formatted) {
    formatted.criteria_mapping = formatted.criteriaMapping;
    delete formatted.criteriaMapping;
  }
  if ('classroomCourseId' in formatted) {
    formatted.classroom_id = formatted.classroomCourseId;
    delete formatted.classroomCourseId;
  }
  delete formatted.members;
  delete formatted.class_members;

  // Persist locally as fallback/cache if criteria_mapping is present
  if (formatted.criteria_mapping !== undefined) {
    try {
      if (formatted.criteria_mapping && Object.keys(formatted.criteria_mapping).length > 0) {
        localStorage.setItem(`class_criteria_mapping_${classId}`, JSON.stringify(formatted.criteria_mapping));
      } else {
        localStorage.removeItem(`class_criteria_mapping_${classId}`);
      }
    } catch (_) {}
  }

  try {
    const { error } = await supabase
      .from('classes').update(formatted).eq('id', classId);
    if (error) {
      if (formatted.criteria_mapping && error.message && error.message.includes('criteria_mapping')) {
        console.warn('criteria_mapping column not found in Supabase classes table yet. Stored in localStorage fallback.');
        delete formatted.criteria_mapping;
        const { error: errRetry } = await supabase.from('classes').update(formatted).eq('id', classId);
        if (errRetry) throw errRetry;
        return;
      }
      throw error;
    }
  } catch (err) {
    throw err;
  }
}

// ══════════════════════════════════════════════════════════════════
//  MEMBRESÍAS DE CLASE
// ══════════════════════════════════════════════════════════════════

export async function getLegacyStudentIds(studentId) {
  if (!studentId) return [];
  try {
    const { data: userRow } = await supabase.from('users').select('email').eq('id', studentId).maybeSingle();
    let email = userRow?.email || (await supabase.auth.getUser()).data?.user?.email;
    if (!email) return [];
    email = email.toLowerCase().trim();
    const { data: legacyUsers } = await supabase.from('users').select('id')
      .or(`email.eq.${email},email.like.migrated_%_${email},email.like.legacy_%_${email}`);
    return (legacyUsers || []).map(u => u.id).filter(id => id !== studentId);
  } catch (err) {
    console.warn('Error finding legacy student ids:', err);
    return [];
  }
}

export async function getStudentClasses(studentId) {
  if (!studentId) return [];
  const { data, error } = await supabase
    .from('class_members')
    .select('class_id, classes(*)')
    .eq('student_id', studentId);
  if (error) {
    console.error('Error fetching student classes:', error);
  }

  let classesRows = (data || []).filter(row => row.classes);

  // Fallback: Si no hay clases asociadas al studentId actual,
  // buscar si existen membresías con un ID legacy con el mismo email
  if (classesRows.length === 0) {
    try {
      const legacyIds = await getLegacyStudentIds(studentId);
      if (legacyIds.length > 0) {
        const { data: legacyClasses } = await supabase
          .from('class_members')
          .select('class_id, classes(*)')
          .in('student_id', legacyIds);

        const validLegacy = (legacyClasses || []).filter(r => r.classes);
        if (validLegacy.length > 0) {
          classesRows = validLegacy;
          // Auto-reparar la membresía asignando el studentId actual
          for (const r of validLegacy) {
            await supabase.from('class_members')
              .upsert({ class_id: r.class_id, student_id: studentId }, { onConflict: 'class_id,student_id' });
          }
        }
      }
    } catch (e) {
      console.warn('Fallback getStudentClasses warning:', e);
    }
  }

  return classesRows.map(row => {
    const cls = row.classes;
    if (!cls) return null;
    return {
      ...cls,
      teacherId: cls.teacher_id,
      enabledGames: cls.enabled_games || [],
      enabledTopics: cls.enabled_topics || [],
      classroomCourseId: cls.classroom_id
    };
  }).filter(Boolean);
}

export async function getClassMembers(classId) {
  const { data, error } = await supabase
    .from('class_members')
    .select('student_id, joined_at, users(id, email, display_name, display_name_anon, avatar, xp, guild_id, logros)')
    .eq('class_id', classId);
  if (error) {
    console.warn('Error fetching class members:', error);
    return [];
  }
  return (data || []).map(row => {
    const u = row.users || {};
    const uid = u.id || row.student_id;
    const dName = u.display_name || u.display_name_anon || u.email?.split('@')[0] || 'Alumno';
    const dNameAnon = u.display_name_anon || u.display_name || 'Alumno';
    const photo = u.avatar || `https://api.dicebear.com/7.x/bottts/svg?seed=${uid}`;
    const xpVal = u.xp ?? 0;
    const guildVal = u.guild_id || null;
    const logrosVal = u.logros || [];

    return {
      ...u,
      id: uid,
      uid: uid,
      studentId: uid,
      student_id: uid,
      email: u.email || '',
      display_name: u.display_name || '',
      displayName: dName,
      display_name_anon: u.display_name_anon || '',
      displayNameAnonymized: dNameAnon,
      avatar: u.avatar || '',
      photoURL: photo,
      xp: xpVal,
      puntosTotal: xpVal,
      guild_id: guildVal,
      gremio: guildVal,
      logros: logrosVal,
      medals: logrosVal,
      joined_at: row.joined_at
    };
  });
}

export async function joinClassByPin(pin, studentId) {
  // 1. Buscar la clase por PIN
  const { data: cls, error } = await supabase
    .from('classes').select('*').eq('pin', pin).maybeSingle();
  if (error || !cls) throw new Error('PIN incorrecto o clase no encontrada.');

  // 2. Insertar membresía
  const { error: memberError } = await supabase
    .from('class_members')
    .upsert({ class_id: cls.id, student_id: studentId }, { onConflict: 'class_id,student_id' });
  if (memberError) throw memberError;

  // 3. Marcar como alumno autorizado
  const { data: user } = await supabase
    .from('users').select('email').eq('id', studentId).maybeSingle();
  if (user) {
    await supabase.from('allowed_students')
      .upsert({ email: user.email, allowed: true }, { onConflict: 'email' });
  }
  return cls;
}

export async function addStudentToClass(classId, studentId) {
  const { error } = await supabase.from('class_members')
    .upsert({ class_id: classId, student_id: studentId }, { onConflict: 'class_id,student_id' });
  if (error) throw error;
}
export const addMemberToClass = addStudentToClass;
export const findUserByEmail = getUserByEmail;

export async function addStudentsToClass(classId, rawEmails) {
  const emailList = Array.isArray(rawEmails)
    ? rawEmails
    : (typeof rawEmails === 'string' ? rawEmails.split(/[\n,;]+/) : []);

  let added = 0;
  let alreadyInClass = 0;
  let invalidEmails = 0;

  for (let raw of emailList) {
    const email = (raw || '').trim().toLowerCase();
    if (!email || !email.includes('@')) {
      if (raw && raw.trim()) invalidEmails++;
      continue;
    }

    // 1. Asegurar en allowed_students
    await supabase.from('allowed_students')
      .upsert({ email, allowed: true }, { onConflict: 'email' });

    // 2. Buscar si ya existe en users
    let { data: user } = await supabase
      .from('users').select('id').eq('email', email).maybeSingle();

    if (!user) {
      const placeholderId = `std_${(typeof crypto !== 'undefined' && crypto.randomUUID) ? crypto.randomUUID() : Math.random().toString(36).substring(2)}`;
      const { data: newUser, error: insertErr } = await supabase.from('users').insert({
        id: placeholderId,
        email,
        display_name: email.split('@')[0],
        role: 'student'
      }).select('id').single();

      if (!insertErr && newUser) {
        user = newUser;
      }
    }

    if (user) {
      // 3. Comprobar si ya está en class_members
      const { data: existingMember } = await supabase.from('class_members')
        .select('id').eq('class_id', classId).eq('student_id', user.id).maybeSingle();

      if (existingMember) {
        alreadyInClass++;
      } else {
        const { error: memErr } = await supabase.from('class_members')
          .insert({ class_id: classId, student_id: user.id });
        if (!memErr) added++;
      }
    }
  }

  return { added, alreadyInClass, invalidEmails };
}

export async function addPendingMember(classId, email, name) {
  return addStudentsToClass(classId, [email]);
}

export async function removeStudentFromClass(classId, studentId) {
  await supabase.from('class_members')
    .delete().eq('class_id', classId).eq('student_id', studentId);
}

export async function resolvePendingStudent(uid, email) {
  if (!email) return;
  const clean = email.toLowerCase().trim();
  try {
    await supabase.from('allowed_students')
      .upsert({ email: clean, allowed: true }, { onConflict: 'email' });
  } catch (_) {}

  // Vincular membresías de clases que tuvieran un ID anterior con este mismo email
  try {
    const { data: legacyUsers } = await supabase.from('users').select('id').eq('email', clean);
    const legacyIds = (legacyUsers || []).map(u => u.id).filter(id => id !== uid);
    if (legacyIds.length > 0) {
      const { data: mems } = await supabase.from('class_members').select('class_id').in('student_id', legacyIds);
      if (mems && mems.length > 0) {
        for (const m of mems) {
          await supabase.from('class_members')
            .upsert({ class_id: m.class_id, student_id: uid }, { onConflict: 'class_id,student_id' });
        }
      }
    }
  } catch (_) {}
}

export async function toggleGameInClass(classId, gameId, active) {
  const { data: cls, error: clsErr } = await supabase.from('classes').select('enabled_games').eq('id', classId).single();
  if (clsErr) throw clsErr;
  let games = new Set(cls?.enabled_games || []);
  if (active) games.add(gameId);
  else games.delete(gameId);
  const { error } = await supabase.from('classes').update({ enabled_games: Array.from(games) }).eq('id', classId);
  if (error) throw error;
}

export async function toggleTopicInClass(classId, topicId, active) {
  const { data: cls, error: clsErr } = await supabase.from('classes').select('enabled_topics').eq('id', classId).single();
  if (clsErr) throw clsErr;
  let topics = new Set(cls?.enabled_topics || []);
  if (active) topics.add(topicId);
  else topics.delete(topicId);
  const { error } = await supabase.from('classes').update({ enabled_topics: Array.from(topics) }).eq('id', classId);
  if (error) throw error;
}

// ══════════════════════════════════════════════════════════════════
//  TAREAS (ASSIGNMENTS)
// ══════════════════════════════════════════════════════════════════

function mapAssignment(a) {
  if (!a) return null;
  const targetScore = a.max_score !== undefined && a.max_score !== null ? Number(a.max_score) : 100;
  return {
    ...a,
    id: a.id,
    classId: a.class_id,
    gameId: a.game_id,
    title: a.title,
    description: a.description,
    dueDate: a.due_date,
    targetScore,
    maxScore: targetScore,
    classroomId: a.classroom_id,
    classroomCourseWorkId: a.classroom_id,
    classroomCourseId: a.classroom_id,
    createdAt: a.created_at
  };
}

export async function createAssignment(classId, data) {
  const payload = {
    class_id: classId,
    title: data.title,
    game_id: data.game_id || data.gameId || null,
    description: data.description || null,
    due_date: (data.due_date || data.dueDate) ? new Date(data.due_date || data.dueDate).toISOString() : null,
    max_score: Number(data.max_score ?? data.target_score ?? data.targetScore) || 100,
    classroom_id: data.classroom_id || data.classroomId || data.classroomCourseWorkId || data.classroomCourseId || null
  };

  const { data: assignment, error } = await supabase
    .from('assignments').insert(payload).select().single();
  if (error) throw error;
  return mapAssignment(assignment);
}

export async function updateAssignment(classId, assignmentId, updates) {
  const payload = {};
  if (updates.title !== undefined) payload.title = updates.title;
  if (updates.game_id !== undefined || updates.gameId !== undefined) {
    payload.game_id = updates.game_id || updates.gameId;
  }
  if (updates.description !== undefined) payload.description = updates.description;
  if (updates.due_date !== undefined || updates.dueDate !== undefined) {
    const d = updates.due_date || updates.dueDate;
    payload.due_date = d ? new Date(d).toISOString() : null;
  }
  if (updates.max_score !== undefined || updates.target_score !== undefined || updates.targetScore !== undefined) {
    payload.max_score = Number(updates.max_score ?? updates.target_score ?? updates.targetScore) || 100;
  }
  if (updates.classroom_id !== undefined || updates.classroomId !== undefined || updates.classroomCourseWorkId !== undefined || updates.classroomCourseId !== undefined) {
    payload.classroom_id = updates.classroom_id || updates.classroomId || updates.classroomCourseWorkId || updates.classroomCourseId;
  }

  const { error } = await supabase.from('assignments').update(payload).eq('id', assignmentId);
  if (error) throw error;
}

export async function getClassAssignments(classId) {
  const { data, error } = await supabase
    .from('assignments').select('*').eq('class_id', classId).order('created_at', { ascending: false });
  if (error) {
    console.warn('Error al cargar assignments de clase:', error);
    return [];
  }
  return (data || []).map(mapAssignment);
}

export async function deleteAssignment(assignmentId) {
  const { error } = await supabase.from('assignments').delete().eq('id', assignmentId);
  if (error) throw error;
}

function mapGameResult(r) {
  if (!r) return null;
  return {
    ...r,
    id: r.id,
    gameId: r.game_id || r.gameId,
    classId: r.class_id || r.classId,
    subjectId: r.subject_id || r.subjectId,
    studentId: r.student_id || r.studentId,
    score: r.score !== undefined ? Number(r.score) : 0,
    timestamp: r.created_at || r.timestamp,
    createdAt: r.created_at || r.createdAt
  };
}

export async function getStudentResultsInClass(classId, studentId) {
  let query = supabase.from('game_results')
    .select('*')
    .eq('student_id', studentId);
  if (classId) query = query.eq('class_id', classId);
  let { data } = await query.order('created_at', { ascending: false });

  if ((!data || data.length === 0) && studentId) {
    try {
      const legacyIds = await getLegacyStudentIds(studentId);
      if (legacyIds.length > 0) {
        let legQuery = supabase.from('game_results')
          .select('*')
          .in('student_id', legacyIds);
        if (classId) legQuery = legQuery.eq('class_id', classId);
        const { data: legacyData } = await legQuery.order('created_at', { ascending: false });
        if (legacyData && legacyData.length > 0) {
          data = legacyData;
        }
      }
    } catch (_) {}
  }

  return (data || []).map(mapGameResult);
}

// ══════════════════════════════════════════════════════════════════
//  TEMARIO (topics)
// ══════════════════════════════════════════════════════════════════

export async function getTopics(subjectId) {
  try {
    const { data } = await supabase
      .from('topics').select('id, name, description, icon, color, sort_order')
      .eq('subject_id', subjectId).order('sort_order');
    if (data && data.length > 0) return data;
  } catch (err) {
    console.warn('Error fetching topics from Supabase, using local fallback:', err);
  }
  return Object.values(LOCAL_TOPICS)
    .filter(t => t.subject_id === subjectId)
    .map(t => ({
      id: t.id,
      name: t.name,
      description: t.description,
      icon: t.icon,
      color: t.color,
      sort_order: t.sort_order
    }))
    .sort((a, b) => a.sort_order - b.sort_order);
}

export async function getTopic(topicId) {
  try {
    const { data, error } = await supabase
      .from('topics').select('*').eq('id', topicId).maybeSingle();
    if (!error && data) return data;
  } catch (err) {
    console.warn('Error fetching topic from Supabase, using local fallback:', err);
  }
  // Revisar si hay versión editada en localStorage
  try {
    const cached = localStorage.getItem('stackclass_topic_' + topicId);
    if (cached) return JSON.parse(cached);
  } catch (_) {}
  return LOCAL_TOPICS[topicId] || null;
}

export async function upsertTopic(topic) {
  let sbError = null;
  try {
    const { error } = await supabase
      .from('topics').upsert(topic, { onConflict: 'id' });
    if (error) sbError = error;
  } catch (err) {
    sbError = err;
  }

  // Actualizar siempre caché local en memoria y en localStorage
  if (topic && topic.id) {
    LOCAL_TOPICS[topic.id] = { ...LOCAL_TOPICS[topic.id], ...topic };
    try {
      localStorage.setItem('stackclass_topic_' + topic.id, JSON.stringify(LOCAL_TOPICS[topic.id]));
    } catch (_) {}
  }

  if (sbError) {
    console.warn('Advertencia al guardar en Supabase, cambios guardados localmente:', sbError);
  }
}

// ══════════════════════════════════════════════════════════════════
//  PREGUNTAS DE TEST DE TEORÍA
// ══════════════════════════════════════════════════════════════════

export async function getTopicQuestions(topicId, limit = 20) {
  const { data } = await supabase
    .from('topic_questions')
    .select('*')
    .eq('topic_id', topicId)
    .eq('active', true);
  if (!data || data.length === 0) return [];
  // Selección aleatoria hasta `limit`
  const shuffled = data.sort(() => Math.random() - 0.5);
  return shuffled.slice(0, Math.min(limit, data.length));
}

export async function insertTopicQuestions(questions) {
  const { error } = await supabase.from('topic_questions').insert(questions);
  if (error) throw error;
}

// ══════════════════════════════════════════════════════════════════
//  RESULTADOS DE TESTS DE TEORÍA
// ══════════════════════════════════════════════════════════════════

export async function saveTopicTestResult(result) {
  const { data, error } = await supabase
    .from('topic_test_results').insert(result).select().single();
  if (error) throw error;
  return data;
}

export async function getStudentTopicResults(studentId, topicId = null) {
  let q = supabase.from('topic_test_results').select('*')
    .eq('student_id', studentId).order('created_at', { ascending: false });
  if (topicId) q = q.eq('topic_id', topicId);
  let { data } = await q;

  if ((!data || data.length === 0) && studentId) {
    try {
      const { data: userRow } = await supabase.from('users').select('email').eq('id', studentId).maybeSingle();
      const email = userRow?.email || (await supabase.auth.getUser()).data?.user?.email;
      if (email) {
        const { data: legacyUsers } = await supabase.from('users').select('id').eq('email', email.toLowerCase());
        const legacyIds = (legacyUsers || []).map(u => u.id).filter(id => id !== studentId);
        if (legacyIds.length > 0) {
          let legacyQ = supabase.from('topic_test_results').select('*')
            .in('student_id', legacyIds).order('created_at', { ascending: false });
          if (topicId) legacyQ = legacyQ.eq('topic_id', topicId);
          const { data: legacyData } = await legacyQ;
          if (legacyData && legacyData.length > 0) {
            data = legacyData;
          }
        }
      }
    } catch (_) {}
  }

  return (data || []).map(row => ({
    id: row.id,
    topicId: row.topic_id,
    subjectId: row.subject_id,
    studentId: row.student_id,
    score: row.score,
    rawScore: row.raw_score,
    maxPossible: row.max_possible,
    respuestas: row.respuestas,
    fecha: row.created_at,
    timestamp: row.created_at
  }));
}

export async function getClassTopicResults(classId, topicId = null) {
  // Obtener student_ids de la clase
  const members = await getClassMembers(classId);
  const ids = members.map(m => m.id);
  if (!ids.length) return [];

  let q = supabase.from('topic_test_results')
    .select('*, users(display_name, display_name_anon, avatar)')
    .in('student_id', ids).order('created_at', { ascending: false });
  if (topicId) q = q.eq('topic_id', topicId);
  const { data } = await q;
  return data || [];
}

// ══════════════════════════════════════════════════════════════════
//  BANCO DE PREGUNTAS EXAMEN
// ══════════════════════════════════════════════════════════════════

export async function getExamQuestions(classId) {
  const { data } = await supabase
    .from('exam_questions').select('*').eq('class_id', classId);
  return data || [];
}

export async function insertExamQuestion(question) {
  const { data, error } = await supabase
    .from('exam_questions').insert(question).select().single();
  if (error) throw error;
  return data;
}

export async function deleteExamQuestion(id) {
  await supabase.from('exam_questions').delete().eq('id', id);
}

// ══════════════════════════════════════════════════════════════════
//  EXÁMENES OFICIALES
// ══════════════════════════════════════════════════════════════════

export async function createExam(classId, createdBy, title, questionIds, durationMins = 45) {
  const { data, error } = await supabase.from('exams')
    .insert({ class_id: classId, created_by: createdBy, title, question_ids: questionIds, duration_mins: durationMins })
    .select().single();
  if (error) throw error;
  return data;
}

export async function getActiveExam(classId) {
  const { data, error } = await supabase
    .from('exams').select('*').eq('class_id', classId).eq('active', true).maybeSingle();
  if (error) throw error;
  return data || null;
}

export async function saveExamResult(result) {
  const { data, error } = await supabase
    .from('exam_results').insert(result).select().single();
  if (error) throw error;
  return data;
}

export async function getStudentExamResult(examId, studentId) {
  const { data, error } = await supabase
    .from('exam_results').select('*').eq('exam_id', examId).eq('student_id', studentId).maybeSingle();
  if (error) throw error;
  return data || null;
}

// ══════════════════════════════════════════════════════════════════
//  RESULTADOS DE JUEGOS
// ══════════════════════════════════════════════════════════════════

export async function saveGameResult(arg1, arg2, arg3, arg4, arg5, arg6 = {}) {
  let studentId, classId, subjectId, gameId, score, opts;

  // Detectar firma:
  // Patrón A (habitual en los 15 juegos): saveGameResult(gameId, studentId, classId, score, opts)
  // Patrón B: saveGameResult(studentId, classId, subjectId, gameId, score, opts)
  if (typeof arg4 === 'number' || (typeof arg4 === 'string' && !isNaN(Number(arg4)) && isNaN(Number(arg3)))) {
    gameId    = String(arg1);
    studentId = String(arg2);
    classId   = arg3 || null;
    score     = Number(arg4) || 0;
    opts      = (typeof arg5 === 'object' && arg5 !== null) ? arg5 : {};
    subjectId = opts.subject_id || null;
  } else {
    studentId = String(arg1);
    classId   = arg2 || null;
    subjectId = arg3 || null;
    gameId    = String(arg4);
    score     = Number(arg5) || 0;
    opts      = (typeof arg6 === 'object' && arg6 !== null) ? arg6 : {};
  }

  // Normalizar classId si vino como objeto
  if (classId && typeof classId === 'object') {
    classId = classId.id || null;
  }
  if (classId === 'null' || classId === 'undefined') {
    classId = null;
  }

  // Deducir subjectId si no viene indicado
  if (!subjectId && classId) {
    try {
      const cls = await getClass(classId);
      if (cls?.subject_id) subjectId = cls.subject_id;
    } catch (e) {}
  }
  if (!subjectId) {
    const ticGames = ['kanban_hero', 'cc_trivial', 'cert_arcade', 'databreach', 'hex_invaders'];
    subjectId = ticGames.includes(gameId) ? 'tic2' : 'cyr';
  }

  // Si classId es null (modo práctica, partida libre o docente testeando),
  // auto-resolver una clase para asociar la puntuación y satisfacer NOT NULL
  if (!classId && studentId) {
    try {
      // 1. Buscar si el alumno está matriculado en alguna clase de la asignatura
      const { data: mems } = await supabase
        .from('class_members')
        .select('class_id, classes(id, subject_id)')
        .eq('student_id', studentId);

      const validMems = (mems || []).filter(m => m.classes);
      const matchMem = validMems.find(m => m.classes.subject_id === subjectId) || validMems[0];
      if (matchMem) {
        classId = matchMem.class_id;
      } else {
        // 2. Si el usuario es docente/admin, buscar en sus clases
        const { data: teacherClasses } = await supabase
          .from('classes')
          .select('id, subject_id')
          .eq('teacher_id', studentId);

        const matchTeacher = (teacherClasses || []).find(c => c.subject_id === subjectId) || teacherClasses?.[0];
        if (matchTeacher) {
          classId = matchTeacher.id;
        } else {
          // 3. Fallback: cualquier clase de la asignatura o del sistema
          const { data: fallbackClass } = await supabase
            .from('classes')
            .select('id')
            .eq('subject_id', subjectId)
            .limit(1)
            .maybeSingle();

          if (fallbackClass) {
            classId = fallbackClass.id;
          } else {
            const { data: anyClass } = await supabase
              .from('classes')
              .select('id')
              .limit(1)
              .maybeSingle();
            if (anyClass) classId = anyClass.id;
          }
        }
      }
    } catch (err) {
      console.warn('Could not auto-resolve classId in saveGameResult:', err);
    }
  }

  // Control de Bienestar Digital (máximo 5 partidas al día por juego para alumnos)
  if (studentId) {
    try {
      const { checkDigitalWellbeing, currentProfile } = await import('./auth.js');
      let role = currentProfile?.role;
      if (!role) {
        const { data: u } = await supabase.from('users').select('role').eq('id', studentId).maybeSingle();
        if (u) role = u.role;
      }
      if (role === 'student') {
        const count = await checkDigitalWellbeing(studentId, 'game', gameId);
        if (count >= 5) {
          console.warn(`[Bienestar Digital] Límite de 5 partidas alcanzado hoy para ${gameId}`);
          throw new Error('Límite de bienestar digital alcanzado (máximo 5 partidas al día para este juego)');
        }
      }
    } catch (e) {
      if (e.message?.includes('bienestar digital') || e.message?.includes('Bienestar Digital')) {
        throw e;
      }
    }
  }

  const { data, error } = await supabase.from('game_results')
    .insert({
      student_id: studentId,
      class_id: classId,
      subject_id: subjectId,
      game_id: gameId,
      score,
      duration_secs: opts.duration_secs || null,
      metadata: opts.metadata || (opts.level !== undefined || opts.survived !== undefined ? opts : {}),
      forced_fail: opts.forced_fail || false
    }).select().single();
  if (error) throw error;

  // Si tras guardar la partida el alumno ha alcanzado el límite de 5 partidas diarias, activar Bienestar Digital
  if (studentId) {
    try {
      const { checkDigitalWellbeing, incrementDigitalWellbeing, currentProfile } = await import('./auth.js');
      let role = currentProfile?.role;
      if (!role) {
        const { data: u } = await supabase.from('users').select('role').eq('id', studentId).maybeSingle();
        if (u) role = u.role;
      }
      if (role === 'student') {
        const todayCount = await checkDigitalWellbeing(studentId, 'game', gameId);
        if (todayCount >= 5) {
          await incrementDigitalWellbeing(studentId, 'game', gameId);
        }
      }
    } catch (_) {}
  }

  return data;
}


export async function getStudentResults(studentId, limit = 50) {
  if (!studentId) return [];
  let { data } = await supabase
    .from('game_results').select('*').eq('student_id', studentId)
    .order('created_at', { ascending: false }).limit(limit);

  if ((!data || data.length === 0) && studentId) {
    try {
      const legacyIds = await getLegacyStudentIds(studentId);
      if (legacyIds.length > 0) {
        const { data: legacyData } = await supabase
          .from('game_results').select('*').in('student_id', legacyIds)
          .order('created_at', { ascending: false }).limit(limit);
        if (legacyData && legacyData.length > 0) {
          data = legacyData;
          // Auto-migrar resultados al nuevo studentId
          try {
            await supabase.from('game_results')
              .update({ student_id: studentId })
              .in('student_id', legacyIds);
          } catch (_) {}
        }
      }
    } catch (e) {
      console.warn('Fallback getStudentResults warning:', e);
    }
  }

  return (data || []).map(mapGameResult);
}

export async function getStudentBestScore(studentId, gameId, classId) {
  if (!studentId) return 0;
  let { data } = await supabase
    .from('game_results').select('score')
    .eq('student_id', studentId).eq('game_id', gameId).eq('class_id', classId)
    .eq('forced_fail', false).order('score', { ascending: false }).limit(1);

  if ((!data || data.length === 0) && studentId) {
    try {
      const legacyIds = await getLegacyStudentIds(studentId);
      if (legacyIds.length > 0) {
        const { data: legData } = await supabase
          .from('game_results').select('score')
          .in('student_id', legacyIds).eq('game_id', gameId).eq('class_id', classId)
          .eq('forced_fail', false).order('score', { ascending: false }).limit(1);
        if (legData && legData.length > 0) {
          data = legData;
        }
      }
    } catch (_) {}
  }

  return data?.[0]?.score || 0;
}

export async function getClassResults(classId, gameId = null, limit = 200) {
  let q = supabase.from('game_results').select('*')
    .eq('class_id', classId).order('created_at', { ascending: false }).limit(limit);
  if (gameId) q = q.eq('game_id', gameId);
  const { data } = await q;
  return data || [];
}

export async function getClassRanking(classId, gameId = null) {
  if (gameId) {
    const { data, error } = await supabase
      .from('game_results')
      .select('student_id, score, created_at, users(id, display_name, display_name_anon, avatar, email)')
      .eq('class_id', classId)
      .eq('game_id', gameId)
      .eq('forced_fail', false)
      .order('score', { ascending: false });

    if (error || !data) {
      console.warn('Error fetching game ranking:', error);
      return [];
    }

    const bestMap = new Map();
    data.forEach(row => {
      const sid = row.student_id;
      if (!bestMap.has(sid) || (row.score > bestMap.get(sid).score)) {
        const u = row.users || {};
        const dName = u.display_name || u.display_name_anon || u.email?.split('@')[0] || 'Alumno';
        const dNameAnon = u.display_name_anon || u.display_name || 'Alumno';
        const photo = u.avatar || `https://api.dicebear.com/7.x/bottts/svg?seed=${sid}`;
        bestMap.set(sid, {
          studentId: sid,
          student_id: sid,
          score: row.score,
          total_game_score: row.score,
          displayName: dName,
          displayNameAnonymized: dNameAnon,
          photoURL: photo,
          avatar: photo
        });
      }
    });

    return Array.from(bestMap.values()).sort((a, b) => b.score - a.score);
  }

  // Si no hay gameId (ranking global de la clase)
  const { data, error } = await supabase.from('class_ranking').select('*').eq('class_id', classId);
  if (error || !data) {
    console.warn('Error fetching class ranking:', error);
    return [];
  }

  return data.map(r => {
    const sid = r.student_id || r.studentId;
    const scoreVal = r.total_game_score ?? r.score ?? 0;
    const dName = r.display_name || r.displayName || r.display_name_anon || 'Alumno';
    const dNameAnon = r.display_name_anon || r.displayNameAnonymized || r.display_name || 'Alumno';
    const photo = r.avatar || r.photoURL || `https://api.dicebear.com/7.x/bottts/svg?seed=${sid}`;
    return {
      ...r,
      studentId: sid,
      student_id: sid,
      score: scoreVal,
      total_game_score: scoreVal,
      displayName: dName,
      displayNameAnonymized: dNameAnon,
      photoURL: photo,
      avatar: photo
    };
  }).sort((a, b) => b.score - a.score);
}

// ══════════════════════════════════════════════════════════════════
//  SESIONES EN VIVO
// ══════════════════════════════════════════════════════════════════

function generatePin() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

export async function createLiveSession(hostId, gameId, classId = null, config = {}) {
  let pin, ok = false;
  while (!ok) {
    pin = generatePin();
    const { data } = await supabase.from('live_sessions').select('pin').eq('pin', pin);
    if (!data || data.length === 0) ok = true;
  }
  const { data, error } = await supabase.from('live_sessions')
    .insert({ pin, host_id: hostId, game_id: gameId, class_id: classId, config })
    .select().single();
  if (error) throw error;
  return pin;
}

export async function getLiveSession(pin) {
  const { data, error } = await supabase.from('live_sessions').select('*').eq('pin', pin).maybeSingle();
  if (error) throw error;
  return data || null;
}

export async function updateLiveSession(pin, updates) {
  const { error } = await supabase.from('live_sessions').update(updates).eq('pin', pin);
  if (error) throw error;
}

export async function joinLiveSession(pin, studentId, displayName) {
  const session = await getLiveSession(pin);
  if (!session) throw new Error('Sesión no encontrada.');
  if (session.status !== 'lobby') throw new Error('La sesión ya ha comenzado o finalizado.');

  const { error } = await supabase.from('live_participants')
    .upsert({ session_pin: pin, student_id: studentId, display_name: displayName, score: 0, progress: 0, status: 'waiting' },
            { onConflict: 'session_pin,student_id' });
  if (error) throw error;
  return session;
}

export async function updateLiveParticipant(pin, studentId, updates) {
  const { error } = await supabase.from('live_participants')
    .update(updates).eq('session_pin', pin).eq('student_id', studentId);
  if (error) throw error;
}

export async function getLiveParticipants(pin) {
  const { data } = await supabase.from('live_participants').select('*').eq('session_pin', pin);
  return data || [];
}

// ══════════════════════════════════════════════════════════════════
//  TEXTOS DE MECANOGRAFÍA
// ══════════════════════════════════════════════════════════════════

export async function getMecanoTexts(classId = null) {
  let q = supabase.from('mecanoclass_texts').select('*').eq('active', true);
  if (classId) q = q.or(`class_id.eq.${classId},class_id.is.null`);
  else q = q.is('class_id', null);
  const { data } = await q;
  return data || [];
}

export async function getRandomMecanoText(classId = null) {
  const texts = await getMecanoTexts(classId);
  if (!texts.length) return null;
  return texts[Math.floor(Math.random() * texts.length)];
}

export async function insertMecanoText(text) {
  const { data, error } = await supabase.from('mecanoclass_texts').insert(text).select().single();
  if (error) throw error;
  return data;
}

// ══════════════════════════════════════════════════════════════════
//  BOTS DE ARENABOTS
// ══════════════════════════════════════════════════════════════════

export async function saveArenaBot(ownerId, name, code) {
  const { data, error } = await supabase.from('arena_bots')
    .upsert({ owner_id: ownerId, name, code }, { onConflict: 'owner_id,name' })
    .select().single();
  if (error) throw error;
  return data;
}

export async function getPublicBots() {
  const { data } = await supabase.from('arena_bots').select('*, users(display_name)')
    .eq('public', true).order('wins', { ascending: false });
  return data || [];
}

export async function getMyBots(ownerId) {
  const { data } = await supabase.from('arena_bots').select('*').eq('owner_id', ownerId);
  return data || [];
}

// ══════════════════════════════════════════════════════════════════
//  TAREAS OFFLINE Y CALIFICACIONES
// ══════════════════════════════════════════════════════════════════

export async function createOfflineTask(classId, title, description, rubric, maxScore = 10) {
  const { data, error } = await supabase.from('offline_tasks')
    .insert({ class_id: classId, title, description, rubric, max_score: maxScore })
    .select().single();
  if (error) throw error;
  return data;
}

export async function getClassOfflineTasks(classId) {
  const { data } = await supabase.from('offline_tasks').select('*').eq('class_id', classId);
  return data || [];
}

export async function saveOfflineGrade(taskId, studentId, classId, score, feedback, gradedBy) {
  const { data, error } = await supabase.from('offline_grades')
    .upsert({ task_id: taskId, student_id: studentId, class_id: classId, score, feedback, graded_by: gradedBy },
            { onConflict: 'task_id,student_id' })
    .select().single();
  if (error) throw error;
  return data;
}

export async function getStudentGrades(studentId, classId = null) {
  let q = supabase.from('offline_grades')
    .select('*, offline_tasks(title, max_score)').eq('student_id', studentId);
  if (classId) q = q.eq('class_id', classId);
  const { data } = await q;
  return data || [];
}

// ══════════════════════════════════════════════════════════════════
//  CONFIG GLOBAL
// ══════════════════════════════════════════════════════════════════

export async function getSiteSettings() {
  return { siteUrl: window.location.origin };
}

// ══════════════════════════════════════════════════════════════════
//  BANCO DE PREGUNTAS (TOPIC QUESTIONS CRUD)
// ══════════════════════════════════════════════════════════════════

export async function getAllTopicQuestions() {
  const { data, error } = await supabase.from('topic_questions').select('*').order('topic_id').order('ce');
  if (error) throw error;
  return data || [];
}

export async function createTopicQuestion(data) {
  const { data: row, error } = await supabase.from('topic_questions').insert({
    topic_id: data.block || data.topic_id || data.topicId,
    ce: data.ce,
    criterio: data.criterio,
    dificultad: data.dificultad || 'media',
    enunciado: data.enunciado,
    opciones: data.opciones
  }).select().single();
  if (error) throw error;
  return row;
}

export async function updateTopicQuestion(id, data) {
  const updates = {};
  if (data.block !== undefined || data.topic_id !== undefined) updates.topic_id = data.block || data.topic_id;
  if (data.ce !== undefined) updates.ce = data.ce;
  if (data.criterio !== undefined) updates.criterio = data.criterio;
  if (data.dificultad !== undefined) updates.dificultad = data.dificultad;
  if (data.enunciado !== undefined) updates.enunciado = data.enunciado;
  if (data.opciones !== undefined) updates.opciones = data.opciones;
  const { error } = await supabase.from('topic_questions').update(updates).eq('id', id);
  if (error) throw error;
}

export async function deleteTopicQuestion(id) {
  const { error } = await supabase.from('topic_questions').delete().eq('id', id);
  if (error) throw error;
}

// ══════════════════════════════════════════════════════════════════
//  EXÁMENES OFICIALES (CRUD Y REALTIME)
// ══════════════════════════════════════════════════════════════════

export async function getExam(examId) {
  const { data, error } = await supabase.from('exams').select('*').eq('id', examId).maybeSingle();
  if (error) throw error;
  return data || null;
}

export async function updateExam(examId, updates) {
  const { error } = await supabase.from('exams').update(updates).eq('id', examId);
  if (error) throw error;
}

export async function deleteExam(examId) {
  const { error } = await supabase.from('exams').delete().eq('id', examId);
  if (error) throw error;
}

export async function getExamsByClass(classId) {
  const { data, error } = await supabase.from('exams').select('*').eq('class_id', classId).order('created_at', { ascending: false });
  if (error) throw error;
  return data || [];
}

/** Returns a Supabase realtime channel that fires callback(exams[]) on any change to the class exams */
export function listenToExamsByClass(classId, callback) {
  const fetchAndNotify = async () => {
    const exams = await getExamsByClass(classId);
    callback(exams);
  };
  // Initial load
  fetchAndNotify();
  const channel = supabase.channel(`exams_class_${classId}`)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'exams', filter: `class_id=eq.${classId}` },
      () => fetchAndNotify())
    .subscribe();
  // Return unsubscribe function
  return () => supabase.removeChannel(channel);
}

// ══════════════════════════════════════════════════════════════════
//  RESULTADOS DE EXÁMENES (exam_results)
// ══════════════════════════════════════════════════════════════════

export async function getExamResult(examId, studentId) {
  const { data, error } = await supabase
    .from('exam_results').select('*').eq('exam_id', examId).eq('student_id', studentId).maybeSingle();
  if (error) throw error;
  return data || null;
}

export async function upsertExamResult(examId, studentId, data) {
  const { data: row, error } = await supabase.from('exam_results')
    .upsert({ exam_id: examId, student_id: studentId, ...data }, { onConflict: 'exam_id,student_id' })
    .select().single();
  if (error) throw error;
  return row;
}

export async function updateExamResult(resultId, updates) {
  const { error } = await supabase.from('exam_results').update(updates).eq('id', resultId);
  if (error) throw error;
}

export async function getExamResultsByExam(examId) {
  const { data, error } = await supabase.from('exam_results').select('*').eq('exam_id', examId);
  if (error) throw error;
  return data || [];
}

// ══════════════════════════════════════════════════════════════════
//  TAREAS OFFLINE CONFIG (offline_tasks como tabla de config)
// ══════════════════════════════════════════════════════════════════

export async function getOfflineTasksConfig(classId) {
  const { data, error } = await supabase.from('offline_tasks').select('*').eq('class_id', classId);
  if (error) throw error;
  return (data || []).map(d => ({
    ...d,
    taskId: d.task_id,
    classId: d.class_id,
    isActive: d.is_active,
    rubricPublished: d.rubric_published,
    gradesPublished: d.grades_published,
    dueDate: d.due_date,
    customTitle: d.custom_title,
    customDescription: d.custom_description
  }));
}

export async function upsertOfflineTaskConfig(classId, taskId, updates) {
  // offline_tasks table uses (class_id, task_id) as unique constraint
  const dbUpdates = {};
  if ('isActive' in updates) dbUpdates.is_active = updates.isActive;
  if ('rubricPublished' in updates) dbUpdates.rubric_published = updates.rubricPublished;
  if ('gradesPublished' in updates) dbUpdates.grades_published = updates.gradesPublished;
  if ('dueDate' in updates) dbUpdates.due_date = updates.dueDate;
  if ('customTitle' in updates) dbUpdates.custom_title = updates.customTitle;
  if ('customDescription' in updates) dbUpdates.custom_description = updates.customDescription;

  const { data: existing } = await supabase.from('offline_tasks')
    .select('id').eq('class_id', classId).eq('task_id', taskId).maybeSingle();

  if (existing) {
    const { error } = await supabase.from('offline_tasks').update(dbUpdates).eq('id', existing.id);
    if (error) throw error;
    return { id: existing.id, taskId, classId, ...updates };
  } else {
    const insertData = {
      class_id: classId,
      task_id: taskId,
      is_active: false,
      rubric_published: false,
      grades_published: false,
      due_date: '',
      ...dbUpdates
    };
    const { data: row, error } = await supabase.from('offline_tasks').insert(insertData).select().single();
    if (error) throw error;
    return { id: row.id, taskId, classId, isActive: row.is_active, rubricPublished: row.rubric_published, gradesPublished: row.grades_published, dueDate: row.due_date, customTitle: row.custom_title, customDescription: row.custom_description };
  }
}

export async function getClassOfflineGrades(classId) {
  const { data, error } = await supabase.from('offline_grades').select('*').eq('class_id', classId);
  if (error) throw error;
  return (data || []).map(d => ({
    ...d,
    id: d.id,
    taskId: d.task_id,
    studentId: d.student_id,
    classId: d.class_id,
    finalGrade: d.score,
    teacherFeedback: d.feedback,
    rubricScores: d.rubric_scores
  }));
}

export async function saveOfflineGradeRubric(classId, taskId, studentId, rubricScores, finalGrade, teacherFeedback) {
  const { data: existing } = await supabase.from('offline_grades')
    .select('id').eq('class_id', classId).eq('task_id', taskId).eq('student_id', studentId).maybeSingle();

  const record = {
    class_id: classId,
    task_id: taskId,
    student_id: studentId,
    score: finalGrade,
    feedback: teacherFeedback,
    rubric_scores: rubricScores
  };

  if (existing) {
    const { error } = await supabase.from('offline_grades').update(record).eq('id', existing.id);
    if (error) throw error;
    return existing.id;
  } else {
    const { data: row, error } = await supabase.from('offline_grades').insert(record).select('id').single();
    if (error) throw error;
    return row.id;
  }
}

export async function getStudentOfflineGrade(classId, taskId, studentId) {
  const { data, error } = await supabase.from('offline_grades')
    .select('*').eq('class_id', classId).eq('task_id', taskId).eq('student_id', studentId).maybeSingle();
  if (error) throw error;
  if (!data) return null;
  return {
    ...data,
    taskId: data.task_id,
    studentId: data.student_id,
    classId: data.class_id,
    finalGrade: data.score,
    teacherFeedback: data.feedback,
    rubricScores: data.rubric_scores
  };
}

// ══════════════════════════════════════════════════════════════════
//  TESTS DE TEORÍA (topic_test_results)
// ══════════════════════════════════════════════════════════════════

export async function getAllTopicTestResults() {
  const { data, error } = await supabase.from('topic_test_results').select('*').order('created_at');
  if (error) throw error;
  return data || [];
}

export async function deleteStudentTopicResults(studentId, topicId) {
  let q = supabase.from('topic_test_results').delete().eq('student_id', studentId);
  if (topicId) q = q.eq('topic_id', topicId);
  const { error } = await q;
  if (error) throw error;
}

