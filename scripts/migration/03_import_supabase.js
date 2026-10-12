// ═══════════════════════════════════════════════════════════════════════
//  03_import_supabase.js — Transformar e importar JSONs a Supabase SQL
// ═══════════════════════════════════════════════════════════════════════

const { createClient } = require("@supabase/supabase-js");
const fs = require("fs");
const path = require("path");

const SUPABASE_URL = process.env.SUPABASE_URL || "https://zokpdbogudfnvxfrayyv.supabase.co";
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "sb_publishable_hutUywsg8e97_GsJ5jBYPg_CagBNhAz";

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

function readJsonSafe(filepath) {
  if (!fs.existsSync(filepath)) return [];
  try {
    return JSON.parse(fs.readFileSync(filepath, "utf8"));
  } catch (e) {
    console.warn(`No se pudo leer ${filepath}: ${e.message}`);
    return [];
  }
}

function normalizeGuild(name, sub) {
  if (!name) return null;
  const n = String(name).toLowerCase();
  if (sub === "tic2") {
    if (n.includes("lovelace")) return "lovelace";
    if (n.includes("turing")) return "turing";
    if (n.includes("hopper")) return "hopper";
    if (n.includes("stallman")) return "stallman";
  } else {
    if (n.includes("r2")) return "r2d2";
    if (n.includes("wall")) return "walle";
    if (n.includes("baymax")) return "baymax";
    if (n.includes("terminator")) return "terminator";
  }
  return null;
}

function normalizeLogros(logros) {
  if (!Array.isArray(logros)) return [];
  return logros.map(l => (typeof l === "object" && l !== null ? l.id : l)).filter(Boolean);
}

async function batchUpsert(table, records, onConflict = "id", batchSize = 100) {
  if (!records.length) return;
  console.log(`  Insertando ${records.length} registros en ${table}...`);
  for (let i = 0; i < records.length; i += batchSize) {
    const chunk = records.slice(i, i + batchSize);
    const { error } = await supabase.from(table).upsert(chunk, { onConflict });
    if (error) {
      console.error(`  ❌ Error en ${table} (chunk ${i}-${i + chunk.length}):`, error.message);
    }
  }
  console.log(`  ✅ ${records.length} registros listos en ${table}`);
}

async function runImport() {
  console.log("🚀 Iniciando importación hacia Supabase PostgreSQL...");

  const tic2Dir = path.resolve(__dirname, "data/tic2");
  const cyrDir = path.resolve(__dirname, "data/cyr");

  // 1. USUARIOS
  console.log("👤 Procesando usuarios...");
  const tic2Users = readJsonSafe(path.join(tic2Dir, "tic2_users.json")).map(u => ({
    id: u.uid || u._id,
    email: (u.email || "").toLowerCase().trim(),
    display_name: u.displayName || u.email?.split("@")[0],
    display_name_anon: u.displayNameAnonymized || u.displayName,
    role: u.role || "student",
    avatar: u.avatar || u.photoURL || null,
    subject_id: "tic2",
    guild_id: normalizeGuild(u.gremio || u.guildId, "tic2"),
    xp: u.puntosTotal || u.xp || 0,
    logros: normalizeLogros(u.logros)
  }));

  const cyrUsers = readJsonSafe(path.join(cyrDir, "users.json")).map(u => ({
    id: u.uid || u._id,
    email: (u.email || "").toLowerCase().trim(),
    display_name: u.displayName || u.email?.split("@")[0],
    display_name_anon: u.displayNameAnonymized || u.displayName,
    role: u.role || "student",
    avatar: u.avatar || u.photoURL || null,
    subject_id: "cyr",
    guild_id: normalizeGuild(u.gremio || u.guildId, "cyr"),
    xp: u.puntosTotal || u.xp || 0,
    logros: normalizeLogros(u.logros)
  }));

  const allUsersMap = new Map();
  for (const u of [...tic2Users, ...cyrUsers]) {
    if (u.id && u.email) allUsersMap.set(u.id, u);
  }
  await batchUpsert("users", Array.from(allUsersMap.values()), "id");

  // 2. CLASES Y MEMBRESÍAS
  console.log("🏫 Procesando clases y membresías...");
  const rawTic2Classes = readJsonSafe(path.join(tic2Dir, "tic2_classes.json"));
  const rawCyrClasses = readJsonSafe(path.join(cyrDir, "classes.json"));

  const tic2Classes = rawTic2Classes.map(c => ({
    id: c.id || c._id,
    teacher_id: c.teacherId,
    subject_id: "tic2",
    name: c.name,
    level: String(c.level || "2º Bachillerato"),
    pin: c.pin || Math.floor(100000 + Math.random() * 900000).toString(),
    classroom_id: c.classroomCourseId || null,
    enabled_games: c.enabledGames || [],
    enabled_topics: c.enabledTopics || []
  }));

  const cyrClasses = rawCyrClasses.map(c => ({
    id: c.id || c._id,
    teacher_id: c.teacherId,
    subject_id: "cyr",
    name: c.name,
    level: String(c.level || "1º ESO"),
    pin: c.pin || Math.floor(100000 + Math.random() * 900000).toString(),
    classroom_id: c.classroomCourseId || null,
    enabled_games: c.enabledGames || [],
    enabled_topics: c.enabledTopics || []
  }));

  await batchUpsert("classes", [...tic2Classes, ...cyrClasses], "id");

  const classMembers = [];
  for (const c of [...rawTic2Classes, ...rawCyrClasses]) {
    const cid = c.id || c._id;
    const members = c.members || [];
    for (const m of members) {
      if (typeof m === "string" && m.trim()) {
        classMembers.push({ class_id: cid, student_id: m.trim() });
      }
    }
  }
  await batchUpsert("class_members", classMembers, "class_id,student_id");

  // 3. RESULTADOS DE JUEGOS
  console.log("🎮 Procesando resultados de juegos...");
  const tic2GameResults = readJsonSafe(path.join(tic2Dir, "tic2_game_results.json")).map(g => ({
    student_id: g.studentId,
    class_id: g.classId,
    subject_id: "tic2",
    game_id: g.gameId,
    score: g.score || 0,
    created_at: g.timestamp?._seconds ? new Date(g.timestamp._seconds * 1000).toISOString() : new Date().toISOString()
  })).filter(g => g.student_id && g.class_id && g.game_id);

  const cyrGameResults = readJsonSafe(path.join(cyrDir, "game_results.json")).map(g => ({
    student_id: g.studentId,
    class_id: g.classId,
    subject_id: "cyr",
    game_id: g.gameId,
    score: g.score || 0,
    created_at: g.timestamp?._seconds ? new Date(g.timestamp._seconds * 1000).toISOString() : new Date().toISOString()
  })).filter(g => g.student_id && g.class_id && g.game_id);

  await batchUpsert("game_results", [...tic2GameResults, ...cyrGameResults]);

  // 4. RESULTADOS DE TESTS DE TEORÍA
  console.log("📝 Procesando resultados de tests de teoría...");
  const tic2TestResults = readJsonSafe(path.join(tic2Dir, "tic2_tests_teoria.json")).map(t => ({
    student_id: t.uid || t.studentId,
    topic_id: t.topicId || t.topic || "unknown",
    subject_id: "tic2",
    score: t.score || 0,
    raw_score: t.rawScore || t.score || 0,
    max_possible: t.maxPossible || 10,
    respuestas: t.respuestas || [],
    created_at: t.timestamp?._seconds ? new Date(t.timestamp._seconds * 1000).toISOString() : new Date().toISOString()
  })).filter(t => t.student_id);

  const cyrTestResults = readJsonSafe(path.join(cyrDir, "test_teoria_respuestas.json")).map(t => ({
    student_id: t.uid || t.studentId,
    topic_id: t.topicId || t.block || "unknown",
    subject_id: "cyr",
    score: t.score || 0,
    raw_score: t.rawScore || t.score || 0,
    max_possible: t.maxPossible || 10,
    respuestas: t.respuestas || [],
    created_at: t.timestamp?._seconds ? new Date(t.timestamp._seconds * 1000).toISOString() : new Date().toISOString()
  })).filter(t => t.student_id);

  await batchUpsert("topic_test_results", [...tic2TestResults, ...cyrTestResults]);

  // 5. AUTORIZADOS
  console.log("🔐 Procesando autorizados...");
  const allowedStudsTic2 = readJsonSafe(path.join(tic2Dir, "tic2_allowed_students.json")).map(s => ({ email: (s.email || s._id).toLowerCase().trim(), allowed: true }));
  const allowedStudsCyr = readJsonSafe(path.join(cyrDir, "allowed_students.json")).map(s => ({ email: (s.email || s._id).toLowerCase().trim(), allowed: true }));
  await batchUpsert("allowed_students", [...allowedStudsTic2, ...allowedStudsCyr], "email");

  const allowedTeachTic2 = readJsonSafe(path.join(tic2Dir, "tic2_allowed_teachers.json")).map(t => ({ email: (t.email || t._id).toLowerCase().trim(), name: t.name || "", subject_id: "tic2", active: true }));
  const allowedTeachCyr = readJsonSafe(path.join(cyrDir, "allowed_teachers.json")).map(t => ({ email: (t.email || t._id).toLowerCase().trim(), name: t.name || "", subject_id: "cyr", active: true }));
  await batchUpsert("allowed_teachers", [...allowedTeachTic2, ...allowedTeachCyr], "email");

  console.log("🎉 ¡Importación completa de datos históricos finalizada con éxito!");
}

runImport().catch(console.error);
