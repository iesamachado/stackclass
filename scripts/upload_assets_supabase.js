// ═══════════════════════════════════════════════════════════════════════
//  upload_assets_supabase.js — Subir imágenes de img/ a Supabase Storage
// ═══════════════════════════════════════════════════════════════════════

const { createClient } = require("@supabase/supabase-js");
const fs = require("fs");
const path = require("path");

const SUPABASE_URL = "https://zokpdbogudfnvxfrayyv.supabase.co";
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "sb_publishable_hutUywsg8e97_GsJ5jBYPg_CagBNhAz";

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

function getMimeType(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  if (ext === ".png") return "image/png";
  if (ext === ".jpg" || ext === ".jpeg") return "image/jpeg";
  if (ext === ".svg") return "image/svg+xml";
  if (ext === ".gif") return "image/gif";
  if (ext === ".webp") return "image/webp";
  if (ext === ".pdf") return "application/pdf";
  return "application/octet-stream";
}

async function uploadFolder(localDir, remotePrefix = "") {
  const entries = fs.readdirSync(localDir, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = path.join(localDir, entry.name);
    const remotePath = remotePrefix ? `${remotePrefix}/${entry.name}` : entry.name;

    if (entry.isDirectory()) {
      await uploadFolder(fullPath, remotePath);
    } else if (entry.isFile() && !entry.name.endsWith(".py") && !entry.name.endsWith(".md")) {
      const fileBuffer = fs.readFileSync(fullPath);
      const contentType = getMimeType(fullPath);

      process.stdout.write(`📤 Subiendo ${remotePath}... `);
      const { data, error } = await supabase.storage
        .from("assets")
        .upload(remotePath, fileBuffer, {
          contentType,
          upsert: true
        });

      if (error) {
        console.log(`❌ Error: ${error.message}`);
      } else {
        console.log(`✅ OK (${(fileBuffer.length / 1024).toFixed(1)} KB)`);
      }
    }
  }
}

async function run() {
  console.log("🚀 Iniciando subida de imágenes a Supabase Storage (bucket: assets)...");
  
  // Asegurar que el bucket existe
  const { data: buckets } = await supabase.storage.listBuckets();
  const exists = (buckets || []).some(b => b.name === "assets");
  if (!exists) {
    console.log("Creando bucket publico assets...");
    await supabase.storage.createBucket("assets", { public: true });
  }

  const imgDir = path.resolve(__dirname, "../img");
  await uploadFolder(imgDir);

  console.log("🎉 Todas las imágenes se han subido a Supabase Storage!");
}

run().catch(console.error);
