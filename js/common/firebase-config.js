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
  "tic2_allowed_students": "allowed_students",
  "preguntas": "exam_questions",
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

// Convert snake_case to camelCase
function toCamelCase(obj) {
  if (!obj || typeof obj !== "object") return obj;
  if (Array.isArray(obj)) return obj.map(toCamelCase);
  const out = {};
  for (const [k, v] of Object.entries(obj)) {
    const camel = k.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase());
    out[k] = v; // keep original
    out[camel] = v; // also provide camelCase
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
  if (typeof dbOrRef === "string") {
    table = resolveTable(dbOrRef);
  } else if (paths.length > 0) {
    table = resolveTable(paths[paths.length - 1]);
  }
  return { type: "collection", table };
}

export function query(colRef, ...constraints) {
  return {
    type: "query",
    table: colRef.table,
    constraints: constraints.filter(Boolean)
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
  const { data, error } = await supabase
    .from(docRef.table)
    .select("*")
    .eq("id", docRef.id)
    .maybeSingle();

  if (error || !data) {
    return { exists: () => false, data: () => null, id: docRef.id };
  }
  return {
    exists: () => true,
    data: () => toCamelCase(data),
    id: data.id
  };
}

export async function getDocs(queryOrCol) {
  const table = queryOrCol.table;
  let req = supabase.from(table).select("*");

  const constraints = queryOrCol.constraints || [];
  for (const c of constraints) {
    if (c.type === "where") {
      const field = c.field.replace(/[A-Z]/g, l => `_${l.toLowerCase()}`);
      if (c.op === "==") req = req.eq(field, c.value);
      else if (c.op === ">=") req = req.gte(field, c.value);
      else if (c.op === "<=") req = req.lte(field, c.value);
      else if (c.op === ">") req = req.gt(field, c.value);
      else if (c.op === "<") req = req.lt(field, c.value);
      else if (c.op === "array-contains") req = req.contains(field, [c.value]);
    } else if (c.type === "orderBy") {
      const field = c.field.replace(/[A-Z]/g, l => `_${l.toLowerCase()}`);
      req = req.order(field, { ascending: c.direction !== "desc" });
    } else if (c.type === "limit") {
      req = req.limit(c.count);
    }
  }

  const { data, error } = await req;
  const items = data || [];

  return {
    empty: items.length === 0,
    docs: items.map(item => ({
      id: item.id || item.pin,
      data: () => toCamelCase(item)
    }))
  };
}

export async function setDoc(docRef, data, opts = {}) {
  const payload = toSnakeCase(data);
  if (docRef.id) payload.id = docRef.id;

  const { error } = await supabase
    .from(docRef.table)
    .upsert(payload, { onConflict: docRef.table === "live_sessions" ? "pin" : "id" });
  if (error) console.error("setDoc error:", error);
}

export async function updateDoc(docRef, data) {
  const payload = toSnakeCase(data);
  const idCol = docRef.table === "live_sessions" ? "pin" : "id";
  const { error } = await supabase
    .from(docRef.table)
    .update(payload)
    .eq(idCol, docRef.id);
  if (error) console.error("updateDoc error:", error);
}

export async function addDoc(colRef, data) {
  const payload = toSnakeCase(data);
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

export function onSnapshot(ref, callback) {
  const table = ref.table;
  const channelName = `sub_${table}_${Date.now()}_${Math.random()}`;

  // Initial fetch
  if (ref.type === "doc") {
    getDoc(ref).then(callback);
  } else {
    getDocs(ref).then(callback);
  }

  const channel = supabase
    .channel(channelName)
    .on("postgres_changes", { event: "*", schema: "public", table }, () => {
      if (ref.type === "doc") {
        getDoc(ref).then(callback);
      } else {
        getDocs(ref).then(callback);
      }
    })
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
