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
export { supabase };

export const SUPERADMIN_EMAIL = 'bernatcosta@iesamachado.org';

// ══════════════════════════════════════════════════════════════════
//  USUARIOS
// ══════════════════════════════════════════════════════════════════

export async function getUserProfile(uid) {
  const { data, error } = await supabase
    .from('users').select('*').eq('id', uid).single();
  if (error && error.code !== 'PGRST116') throw error;
  return data || null;
}

export async function updateUserProfile(uid, data) {
  const { error } = await supabase
    .from('users').upsert({ id: uid, ...data }, { onConflict: 'id' });
  if (error) throw error;
}

export async function getUserByEmail(email) {
  const { data } = await supabase
    .from('users').select('*').eq('email', email.toLowerCase()).single();
  return data || null;
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
  const { data } = await supabase
    .from('subjects').select('*').eq('id', id).single();
  return data || null;
}

// ══════════════════════════════════════════════════════════════════
//  GREMIOS Y MEDALLAS (por asignatura, desde Supabase)
// ══════════════════════════════════════════════════════════════════

export async function getGuilds(subjectId) {
  const { data } = await supabase
    .from('guilds').select('*').eq('subject_id', subjectId);
  return data || [];
}

export async function getMedals(subjectId) {
  const { data } = await supabase
    .from('medals').select('*').eq('subject_id', subjectId);
  return data || [];
}

// ══════════════════════════════════════════════════════════════════
//  AUTORIZADOS
// ══════════════════════════════════════════════════════════════════

export async function isTeacherAuthorized(email) {
  if (!email) return null;
  const clean = email.toLowerCase().trim();

  if (clean === SUPERADMIN_EMAIL.toLowerCase()) {
    return { email: clean, role: 'admin', name: 'Superadmin', isSuperAdmin: true };
  }

  const { data } = await supabase
    .from('allowed_teachers').select('*').eq('email', clean).single();
  if (!data || !data.active) return null;
  return { email: clean, role: 'teacher', name: data.name, subjectId: data.subject_id };
}

export async function isStudentInAnyClass(email) {
  if (!email) return false;
  const { data } = await supabase
    .from('allowed_students').select('allowed').eq('email', email.toLowerCase()).single();
  return data?.allowed === true;
}

export async function addAllowedTeacher(email, name, subjectId) {
  const { error } = await supabase.from('allowed_teachers')
    .upsert({ email: email.toLowerCase(), name, subject_id: subjectId, active: true },
            { onConflict: 'email' });
  if (error) throw error;
}

export async function getAllAllowedTeachers() {
  const { data } = await supabase.from('allowed_teachers').select('*').order('email');
  return data || [];
}

// ══════════════════════════════════════════════════════════════════
//  CLASES
// ══════════════════════════════════════════════════════════════════

export async function createClass(teacherId, subjectIdOrName, nameOrLevel, levelOpt) {
  let subjectId = 'cyr';
  let name = '';
  let level = '';

  if (levelOpt !== undefined) {
    subjectId = subjectIdOrName;
    name = nameOrLevel;
    level = levelOpt;
  } else {
    name = subjectIdOrName;
    level = nameOrLevel;
    subjectId = (String(level).includes('Bach') || String(name).toLowerCase().includes('tic')) ? 'tic2' : 'cyr';
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
      level,
      pin,
      enabled_games: defaultGames,
      enabled_topics: defaultTopics
    })
    .select().single();
  if (error) throw error;
  return data;
}

export async function getClass(classId) {
  const { data } = await supabase
    .from('classes').select('*').eq('id', classId).single();
  return data || null;
}

export async function getTeacherClasses(teacherId) {
  const { data } = await supabase
    .from('classes').select('*').eq('teacher_id', teacherId)
    .eq('active', true).order('created_at', { ascending: false });
  return data || [];
}

export async function updateClass(classId, updates) {
  const { error } = await supabase
    .from('classes').update(updates).eq('id', classId);
  if (error) throw error;
}

// ══════════════════════════════════════════════════════════════════
//  MEMBRESÍAS DE CLASE
// ══════════════════════════════════════════════════════════════════

export async function getStudentClasses(studentId) {
  const { data } = await supabase
    .from('class_members')
    .select('class_id, classes(*)')
    .eq('student_id', studentId);
  return (data || []).map(row => row.classes).filter(Boolean);
}

export async function getClassMembers(classId) {
  const { data } = await supabase
    .from('class_members')
    .select('student_id, joined_at, users(id, email, display_name, display_name_anon, avatar, xp, guild_id, logros)')
    .eq('class_id', classId);
  return (data || []).map(row => ({ ...row.users, joined_at: row.joined_at }));
}

export async function joinClassByPin(pin, studentId) {
  // 1. Buscar la clase por PIN
  const { data: cls, error } = await supabase
    .from('classes').select('*').eq('pin', pin).single();
  if (error || !cls) throw new Error('PIN incorrecto o clase no encontrada.');

  // 2. Insertar membresía
  const { error: memberError } = await supabase
    .from('class_members')
    .upsert({ class_id: cls.id, student_id: studentId }, { onConflict: 'class_id,student_id' });
  if (memberError) throw memberError;

  // 3. Marcar como alumno autorizado
  const { data: user } = await supabase
    .from('users').select('email').eq('id', studentId).single();
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

export async function removeStudentFromClass(classId, studentId) {
  await supabase.from('class_members')
    .delete().eq('class_id', classId).eq('student_id', studentId);
}

export async function resolvePendingStudent(uid, email) {
  // En Supabase no hay alumnos "pendientes" como en Firestore; el PIN lo resuelve todo.
  // Simplemente marcar como autorizado.
  if (!email) return;
  await supabase.from('allowed_students')
    .upsert({ email: email.toLowerCase(), allowed: true }, { onConflict: 'email' });
}

// ══════════════════════════════════════════════════════════════════
//  TAREAS (ASSIGNMENTS)
// ══════════════════════════════════════════════════════════════════

export async function createAssignment(classId, data) {
  const { data: assignment, error } = await supabase
    .from('assignments').insert({ class_id: classId, ...data }).select().single();
  if (error) throw error;
  return assignment;
}

export async function getClassAssignments(classId) {
  const { data } = await supabase
    .from('assignments').select('*').eq('class_id', classId).order('created_at', { ascending: false });
  return data || [];
}

export async function deleteAssignment(assignmentId) {
  await supabase.from('assignments').delete().eq('id', assignmentId);
}

// ══════════════════════════════════════════════════════════════════
//  TEMARIO (topics)
// ══════════════════════════════════════════════════════════════════

export async function getTopics(subjectId) {
  const { data } = await supabase
    .from('topics').select('id, name, description, icon, color, sort_order')
    .eq('subject_id', subjectId).order('sort_order');
  return data || [];
}

export async function getTopic(topicId) {
  const { data } = await supabase
    .from('topics').select('*').eq('id', topicId).single();
  return data || null;
}

export async function upsertTopic(topic) {
  const { error } = await supabase
    .from('topics').upsert(topic, { onConflict: 'id' });
  if (error) throw error;
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
  const { data } = await q;
  return data || [];
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
  const { data } = await supabase
    .from('exams').select('*').eq('class_id', classId).eq('active', true).single();
  return data || null;
}

export async function saveExamResult(result) {
  const { data, error } = await supabase
    .from('exam_results').insert(result).select().single();
  if (error) throw error;
  return data;
}

export async function getStudentExamResult(examId, studentId) {
  const { data } = await supabase
    .from('exam_results').select('*').eq('exam_id', examId).eq('student_id', studentId).single();
  return data || null;
}

// ══════════════════════════════════════════════════════════════════
//  RESULTADOS DE JUEGOS
// ══════════════════════════════════════════════════════════════════

export async function saveGameResult(studentId, classId, subjectId, gameId, score, opts = {}) {
  const { data, error } = await supabase.from('game_results')
    .insert({
      student_id: studentId, class_id: classId, subject_id: subjectId,
      game_id: gameId, score,
      duration_secs: opts.duration_secs || null,
      metadata:      opts.metadata      || {},
      forced_fail:   opts.forced_fail   || false
    }).select().single();
  if (error) throw error;
  return data;
}

export async function getStudentResults(studentId, limit = 50) {
  const { data } = await supabase
    .from('game_results').select('*').eq('student_id', studentId)
    .order('created_at', { ascending: false }).limit(limit);
  return data || [];
}

export async function getStudentBestScore(studentId, gameId, classId) {
  const { data } = await supabase
    .from('game_results').select('score')
    .eq('student_id', studentId).eq('game_id', gameId).eq('class_id', classId)
    .eq('forced_fail', false).order('score', { ascending: false }).limit(1);
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
  // Usa la vista class_ranking de PostgreSQL
  let q = supabase.from('class_ranking').select('*').eq('class_id', classId);
  const { data } = await q;
  if (!data) return [];
  return data.sort((a, b) => b.total_game_score - a.total_game_score);
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
  const { data } = await supabase.from('live_sessions').select('*').eq('pin', pin).single();
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
