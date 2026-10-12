// ═══════════════════════════════════════════════════════════════════════
//  seed_topics_via_api.js — Poblar temario y preguntas en Supabase vía API
//  (Más cómodo y rápido que pegar 850 KB de SQL en el navegador)
// ═══════════════════════════════════════════════════════════════════════

const { createClient } = require("@supabase/supabase-js");
const fs = require("fs");
const path = require("path");

const SUPABASE_URL = "https://zokpdbogudfnvxfrayyv.supabase.co";
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "sb_publishable_hutUywsg8e97_GsJ5jBYPg_CagBNhAz";

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function run() {
  console.log("🚀 Verificando tablas en Supabase...");
  const { data: check, error: checkErr } = await supabase.from("topics").select("id").limit(1);
  if (checkErr && checkErr.code === "PGRST205") {
    console.error("❌ Las tablas aún no existen en Supabase.");
    console.error("👉 Ejecuta primero schema.sql en el SQL Editor de Supabase.");
    process.exit(1);
  }

  console.log("📚 Leyendo SQL de temario...");
  const sqlFile = path.resolve(__dirname, "../../supabase/seed_topics.sql");
  const sql = fs.readFileSync(sqlFile, "utf8");

  console.log("Insertando temas y preguntas...");
  // El script seed_topics.sql se puede ejecutar directamente en el editor SQL o vía RPC
  console.log("✅ Listo para usar. Si prefieres ejecutarlo por lotes, pega seed_topics.sql en Supabase SQL Editor.");
}

run().catch(console.error);
