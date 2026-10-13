// ═══════════════════════════════════════════════════════════════════════
//  STACKCLASS — Firebase-to-Supabase Adapter (firebase-config.js)
//  Permite que todos los juegos y componentes existentes se comuniquen
//  de forma transparente con Supabase PostgreSQL sin modificar su lógica.
// ═══════════════════════════════════════════════════════════════════════

import { supabase } from "./supabase-config.js";

export { supabase };

const TABLE_MAP = {
  "users": "users",
  "tic2_users": "users",
  "classes": "classes",
  "tic2_classes": "classes",
  "class_members": "class_members",
  "tic2_class_members": "class_members",
  "game_results": "game_results",
  "tic2_game_results": "game_results",
  "tic2_tests_teoria": "topic_test_results",
  "test_teoria_respuestas": "topic_test_results",
  "topic_test_results": "topic_test_results",
  "live_sessions": "live_sessions",
  "tic2_live_sessions": "live_sessions",
  "live_participants": "live_participants",
  "tic2_live_participants": "live_participants",
  "mecanoclass_texts": "mecanoclass_texts",
  "tic2_texts": "mecanoclass_texts",
  "public_bots": "arena_bots",
  "arena_bots": "arena_bots",
  "offline_tasks_config": "offline_tasks",
  "tic2_offline_tasks_config": "offline_tasks",
  "offline_grades": "offline_grades",
  "tic2_offline_grades": "offline_grades",
  "allowed_teachers": "allowed_teachers",
  "tic2_allowed_teachers": "allowed_teachers",
  "allowed_students": "allowed_students",
  "preguntas": "topic_questions",
  "tic2_preguntas": "topic_questions",
  "topic_questions": "topic_questions",
  "exam_questions": "exam_questions",
  "examenes_test": "exams",
  "exams": "exams",
  "respuestas_test": "exam_results",
  "exam_results": "exam_results",
  "assignments": "assignments",
  "tic2_assignments": "assignments"
};

function resolveTable(name) {
  return TABLE_MAP[name] || name;
}

// Convert camelCase keys to snake_case for PostgreSQL
function toSnakeCase(obj) {
  if (!obj || typeof obj !== "object" || Array.isArray(obj)) return obj;
  const out = {};
  for (const [k, v] of Object.entries(obj)) {
    const snake = k.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`);
    out[snake] = v;
  }
  return out;
}

function makeTimestamp(val) {
  if (!val) return val;
  if (typeof val === "object" && typeof val.toDate === "function") return val;
  const d = new Date(val);
  const time = isNaN(d.getTime()) ? Date.now() : d.getTime();
  const dateObj = new Date(time);
  return {
    toDate: () => dateObj,
    toMillis: () => time,
    seconds: Math.floor(time / 1000),
    nanoseconds: 0,
    toISOString: () => dateObj.toISOString(),
    toString: () => dateObj.toISOString()
  };
}

// Convert snake_case to camelCase
function toCamelCase(obj) {
  if (!obj || typeof obj !== "object") return obj;
  if (Array.isArray(obj)) return obj.map(toCamelCase);
  const out = {};
  for (const [k, v] of Object.entries(obj)) {
    const camel = k.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase());
    let val = v;
    if (typeof val === "string" && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/.test(val)) {
      val = makeTimestamp(val);
    } else if (val && typeof val === "object" && !val.toDate) {
      val = toCamelCase(val);
    }
    out[k] = val; // keep original
    out[camel] = val; // also provide camelCase
  }

  // Cross-compatibility aliases for Firebase Firestore consumers
  if (out.studentId || out.student_id) {
    const sId = out.studentId || out.student_id;
    if (!out.uid) out.uid = sId;
  }
  if (out.uid) {
    if (!out.studentId) out.studentId = out.uid;
    if (!out.student_id) out.student_id = out.uid;
  }
  if (out.createdAt || out.created_at) {
    const ts = out.createdAt || out.created_at;
    if (!out.creadoEn) out.creadoEn = ts;
    if (!out.creadaEn) out.creadaEn = ts;
    if (!out.fecha) out.fecha = ts;
  }
  if (out.topicId || out.topic_id) {
    const tid = out.topicId || out.topic_id;
    if (!out.block) out.block = tid;
    if (!out.topic) out.topic = tid;
  }
  if (out.block && !out.topicId) {
    out.topicId = out.block;
    out.topic_id = out.block;
  }
  if (out.title && !out.titulo) out.titulo = out.title;
  if (out.titulo && !out.title) out.title = out.titulo;
  if (out.active !== undefined && out.activo === undefined) out.activo = out.active;
  if (out.activo !== undefined && out.active === undefined) out.active = out.activo;
  if (out.durationMins || out.duration_mins) {
    const dm = out.durationMins || out.duration_mins;
    if (!out.tiempoMinutos) out.tiempoMinutos = dm;
  }
  if (out.questionIds || out.question_ids) {
    const qIds = out.questionIds || out.question_ids;
    if (Array.isArray(qIds) && out.numPreguntas === undefined) out.numPreguntas = qIds.length;
  }

  return out;
}

export const db = { type: "supabase_db" };

export function doc(dbOrCol, ...paths) {
  let table = "";
  let id = "";

  if (typeof dbOrCol === "string") {
    table = resolveTable(dbOrCol);
    id = paths[0];
  } else if (dbOrCol?.type === "collection") {
    table = dbOrCol.table;
    id = paths[0];
  } else if (paths.length >= 2) {
    table = resolveTable(paths[0]);
    id = paths[1];
  } else if (paths.length === 1) {
    const parts = paths[0].split("/");
    table = resolveTable(parts[0]);
    id = parts[1];
  }

  return { type: "doc", table, id };
}

export function collection(dbOrRef, ...paths) {
  let table = "";
  const constraints = [];
  if (typeof dbOrRef === "string") {
    table = resolveTable(dbOrRef);
  } else if (paths.length > 0) {
    table = resolveTable(paths[paths.length - 1]);
    if (paths.length === 3 && resolveTable(paths[0]) === "classes") {
      constraints.push({ type: "where", field: "class_id", op: "==", value: paths[1] });
    }
  }
  return { type: "collection", table, constraints };
}

export function query(colRef, ...constraints) {
  return {
    type: "query",
    table: colRef.table,
    constraints: [...(colRef.constraints || []), ...constraints].filter(Boolean)
  };
}

export function where(field, op, value) {
  return { type: "where", field, op, value };
}

export function orderBy(field, direction = "asc") {
  return { type: "orderBy", field, direction };
}

export function limit(count) {
  return { type: "limit", count };
}

export async function getDoc(docRef) {
  if (!docRef?.id) return { exists: () => false, data: () => null, id: null };
  const idCol = docRef.table === "live_sessions" ? "pin" : "id";
  const { data, error } = await supabase
    .from(docRef.table)
    .select("*")
    .eq(idCol, docRef.id)
    .maybeSingle();

  if (error || !data) {
    return { exists: () => false, data: () => null, id: docRef.id };
  }
  const item = { ...data };
  if (docRef.table === "offline_tasks" && item.rubric && typeof item.rubric === "object") {
    Object.assign(item, item.rubric);
  }
  const camel = toCamelCase(item);
  return {
    exists: () => true,
    data: () => camel,
    get: (f) => camel[f],
    id: data.id || data.pin
  };
}

export async function getDocs(queryOrCol) {
  if (!queryOrCol || !queryOrCol.table) {
    return {
      empty: true,
      size: 0,
      docs: [],
      forEach() {},
      docChanges: () => []
    };
  }

  const table = queryOrCol.table;
  let req = supabase.from(table).select("*");

  const constraints = queryOrCol.constraints || [];
  const clientFilters = [];

  for (const c of constraints) {
    if (c.type === "where") {
      let field = c.field.replace(/[A-Z]/g, l => `_${l.toLowerCase()}`);

      // Handle virtual fields for offline_tasks
      if (table === "offline_tasks" && field !== "class_id" && field !== "id") {
        clientFilters.push(c);
        continue;
      }

      // Aliases and transformations for PostgreSQL compatibility
      let fieldVal = c.value;
      if (table === "topic_questions") {
        if (field === "block" || field === "topic") field = "topic_id";
      }
      if (table === "topic_test_results") {
        if (field === "block" || field === "topic") field = "topic_id";
        if (field === "uid") field = "student_id";
        if (field === "clase_id") field = "class_id";
      }
      if (table === "exams") {
        if (field === "clase_id") field = "class_id";
        if (field === "estado") {
          field = "active";
          if (fieldVal === "activo") fieldVal = true;
          else if (fieldVal === "inactivo" || fieldVal === "cerrado") fieldVal = false;
        }
      }
      if (table === "exam_results") {
        if (field === "uid") field = "student_id";
        if (field === "clase_id") field = "class_id";
        if (field === "examen_id") field = "exam_id";
      }
      if (table === "offline_grades") {
        if (field === "uid" || field === "student_id") field = "student_id";
        if (field === "clase_id") field = "class_id";
      }

      if (c.op === "==") req = req.eq(field, fieldVal);
      else if (c.op === "in") req = req.in(field, Array.isArray(fieldVal) ? fieldVal : [fieldVal]);
      else if (c.op === ">=") req = req.gte(field, fieldVal);
      else if (c.op === "<=") req = req.lte(field, fieldVal);
      else if (c.op === ">") req = req.gt(field, fieldVal);
      else if (c.op === "<") req = req.lt(field, fieldVal);
      else if (c.op === "array-contains") req = req.contains(field, [fieldVal]);
    } else if (c.type === "orderBy") {
      const field = c.field.replace(/[A-Z]/g, l => `_${l.toLowerCase()}`);
      if (table === "offline_tasks" && field !== "created_at" && field !== "id") continue;
      req = req.order(field, { ascending: c.direction !== "desc" });
    } else if (c.type === "limit") {
      req = req.limit(c.count);
    }
  }

  const { data, error } = await req;
  if (error) {
    console.warn(`getDocs warning on ${table}:`, error);
  }
  let items = data || [];

  // Unpack virtual properties
  items = items.map(raw => {
    const item = { ...raw };
    if (table === "offline_tasks" && item.rubric && typeof item.rubric === "object") {
      Object.assign(item, item.rubric);
    }
    if (table === "offline_grades") {
      if (item.score !== undefined && item.finalGrade === undefined) item.finalGrade = item.score;
      if (item.feedback !== undefined && item.teacherFeedback === undefined) item.teacherFeedback = item.feedback;
      if (item.task_id && !item.taskId) item.taskId = item.task_id;
      if (item.student_id && !item.studentId) item.studentId = item.student_id;
      if (item.class_id && !item.classId) item.classId = item.class_id;
    }
    if (table === "exams") {
      if (item.title && !item.titulo) item.titulo = item.title;
      if (item.question_ids && item.numPreguntas === undefined) item.numPreguntas = item.question_ids.length;
      if (item.duration_mins && item.tiempoMinutos === undefined) item.tiempoMinutos = item.duration_mins;
      if (item.active !== undefined && item.activo === undefined) item.activo = item.active;
      if (item.active !== undefined && item.estado === undefined) item.estado = item.active ? "activo" : "inactivo";
      if (item.class_id && !item.claseId) item.claseId = item.class_id;
    }
    if (table === "exam_results") {
      if (item.exam_id && !item.examenId) item.examenId = item.exam_id;
      if (item.student_id && !item.uid) item.uid = item.student_id;
      if (item.class_id && !item.claseId) item.claseId = item.class_id;
    }
    if (table === "topic_test_results") {
      if (item.topic_id && !item.topicId) item.topicId = item.topic_id;
      if (item.student_id && !item.uid) item.uid = item.student_id;
      if (item.class_id && !item.claseId) item.claseId = item.class_id;
    }
    return item;
  });

  // Client-side filtering for virtual fields if any
  if (clientFilters.length > 0) {
    items = items.filter(item => {
      const camel = toCamelCase(item);
      for (const cf of clientFilters) {
        const val = camel[cf.field];
        if (cf.op === "==" && val !== cf.value) return false;
      }
      return true;
    });
  }

  const docs = items.map(item => {
    const camelData = toCamelCase(item);
    return {
      id: item.id || item.pin,
      exists: () => true,
      data: () => camelData,
      get: (f) => camelData[f]
    };
  });

  return {
    empty: docs.length === 0,
    size: docs.length,
    docs,
    forEach(callback) {
      docs.forEach(callback);
    },
    docChanges: () => []
  };
}

export async function setDoc(docRef, data, opts = {}) {
  let payload = toSnakeCase(data);
  const idCol = docRef.table === "live_sessions" ? "pin" : "id";
  if (docRef.id) payload[idCol] = docRef.id;

  if (docRef.table === "offline_tasks") {
    payload = {
      [idCol]: docRef.id || payload.task_id || payload.id || crypto.randomUUID(),
      class_id: payload.class_id,
      title: payload.custom_title || payload.title || payload.task_id || "Tarea",
      description: payload.custom_description || payload.description || "",
      rubric: { ...payload }
    };
  }

  if (docRef.table === "topic_questions") {
    const topicId = payload.topic_id || payload.topic || payload.block || "block1";
    const subjectId = payload.subject_id || (String(topicId).startsWith("topic_") ? "tic2" : "cyr");
    payload.topic_id = topicId;
    payload.subject_id = subjectId;
    if (payload.ce !== undefined && payload.ce !== null) payload.ce = String(payload.ce);
    if (!payload.dificultad) payload.dificultad = "media";
    if (payload.active === undefined) payload.active = true;
    if (payload.creada_en && !payload.created_at) payload.created_at = payload.creada_en;
    if (payload.creado_en && !payload.created_at) payload.created_at = payload.creado_en;
    delete payload.block;
    delete payload.topic;
    delete payload.creada_en;
    delete payload.creado_en;
  }

  const { error } = await supabase
    .from(docRef.table)
    .upsert(payload, { onConflict: idCol });
  if (error) console.error("setDoc error:", error);
}

export async function updateDoc(docRef, data) {
  let payload = toSnakeCase(data);
  const idCol = docRef.table === "live_sessions" ? "pin" : "id";

  if (docRef.table === "offline_tasks") {
    const { data: existing } = await supabase.from("offline_tasks").select("rubric").eq(idCol, docRef.id).maybeSingle();
    const currentRubric = existing?.rubric || {};
    const newRubric = { ...currentRubric, ...data };
    payload = {
      title: data.customTitle || currentRubric.customTitle || "Tarea",
      description: data.customDescription || currentRubric.customDescription || "",
      rubric: newRubric
    };
  }

  if (docRef.table === "offline_grades") {
    if (payload.final_grade !== undefined) payload.score = payload.final_grade;
    if (payload.teacher_feedback !== undefined) payload.feedback = payload.teacher_feedback;
    delete payload.final_grade;
    delete payload.teacher_feedback;
    delete payload.rubric_scores;
  }

  if (docRef.table === "topic_questions") {
    if (payload.block || payload.topic) {
      payload.topic_id = payload.topic_id || payload.topic || payload.block;
    }
    if (payload.topic_id && !payload.subject_id) {
      payload.subject_id = String(payload.topic_id).startsWith("topic_") ? "tic2" : "cyr";
    }
    if (payload.ce !== undefined && payload.ce !== null) payload.ce = String(payload.ce);
    if (payload.creada_en && !payload.created_at) payload.created_at = payload.creada_en;
    if (payload.creado_en && !payload.created_at) payload.created_at = payload.creado_en;
    delete payload.block;
    delete payload.topic;
    delete payload.creada_en;
    delete payload.creado_en;
  }

  const { error } = await supabase
    .from(docRef.table)
    .update(payload)
    .eq(idCol, docRef.id);
  if (error) console.error("updateDoc error:", error);
}

export async function addDoc(colRef, data) {
  let payload = toSnakeCase(data);

  if (colRef.table === "offline_tasks") {
    const taskId = data.taskId || payload.task_id || crypto.randomUUID();
    payload = {
      id: taskId,
      class_id: payload.class_id,
      title: data.customTitle || data.title || taskId,
      description: data.customDescription || data.description || "",
      rubric: { ...data, taskId }
    };
  }

  if (colRef.table === "offline_grades") {
    if (payload.task_id && payload.class_id) {
      await supabase.from("offline_tasks").upsert({
        id: payload.task_id,
        class_id: payload.class_id,
        title: payload.task_id
      }, { onConflict: "id" });
    }
    if (payload.final_grade !== undefined) payload.score = payload.final_grade;
    if (payload.teacher_feedback !== undefined) payload.feedback = payload.teacher_feedback;
  }

  if (colRef.table === "topic_questions") {
    const topicId = payload.topic_id || payload.topic || payload.block || "block1";
    const subjectId = payload.subject_id || (String(topicId).startsWith("topic_") ? "tic2" : "cyr");
    payload.topic_id = topicId;
    payload.subject_id = subjectId;
    if (payload.ce !== undefined && payload.ce !== null) payload.ce = String(payload.ce);
    if (!payload.dificultad) payload.dificultad = "media";
    if (payload.active === undefined) payload.active = true;
    if (payload.creada_en && !payload.created_at) payload.created_at = payload.creada_en;
    if (payload.creado_en && !payload.created_at) payload.created_at = payload.creado_en;
    delete payload.block;
    delete payload.topic;
    delete payload.creada_en;
    delete payload.creado_en;
  }

  const { data: inserted, error } = await supabase
    .from(colRef.table)
    .insert(payload)
    .select()
    .single();

  if (error) {
    console.error("addDoc error:", error);
    throw error;
  }
  return { id: inserted.id || inserted.pin };
}

export async function deleteDoc(docRef) {
  const idCol = docRef.table === "live_sessions" ? "pin" : "id";
  await supabase.from(docRef.table).delete().eq(idCol, docRef.id);
}

export function onSnapshot(ref, callback, errCallback) {
  if (!ref || !ref.table) {
    const dummySnap = { empty: true, size: 0, docs: [], forEach() {}, docChanges: () => [] };
    if (typeof callback === "function") callback(dummySnap);
    return () => {};
  }
  const table = ref.table;
  const channelName = `sub_${table}_${Date.now()}_${Math.random()}`;

  const notify = () => {
    if (ref.type === "doc") {
      getDoc(ref)
        .then(snap => { if (typeof callback === "function") callback(snap); })
        .catch(err => { if (typeof errCallback === "function") errCallback(err); else console.warn("onSnapshot getDoc warning:", err); });
    } else {
      getDocs(ref)
        .then(snap => { if (typeof callback === "function") callback(snap); })
        .catch(err => { if (typeof errCallback === "function") errCallback(err); else console.warn("onSnapshot getDocs warning:", err); });
    }
  };

  // Initial fetch
  notify();

  const channel = supabase
    .channel(channelName)
    .on("postgres_changes", { event: "*", schema: "public", table }, notify)
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
}

export function serverTimestamp() {
  return new Date().toISOString();
}

export const Timestamp = {
  now: () => ({ seconds: Math.floor(Date.now() / 1000) }),
  fromDate: (d) => ({ seconds: Math.floor(d.getTime() / 1000) })
};

export function arrayUnion(...elements) {
  return elements;
}

export function arrayRemove(...elements) {
  return elements;
}

export function increment(n) {
  return n;
}

export function deleteField() {
  return null;
}

export function writeBatch(db) {
  const ops = [];
  return {
    set(docRef, data) { ops.push(() => setDoc(docRef, data)); },
    update(docRef, data) { ops.push(() => updateDoc(docRef, data)); },
    delete(docRef) { ops.push(() => deleteDoc(docRef)); },
    async commit() {
      for (const op of ops) await op();
    }
  };
}

export class GoogleAuthProvider {
  setCustomParameters() {}
}

export const googleProvider = new GoogleAuthProvider();
export const auth = { currentUser: null };
