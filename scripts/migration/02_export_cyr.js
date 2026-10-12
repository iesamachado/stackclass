// ═══════════════════════════════════════════════════════════════════════
//  02_export_cyr.js — Exportar Firestore CyR a ficheros JSON locales
// ═══════════════════════════════════════════════════════════════════════

const { initializeApp, cert } = require("firebase-admin/app");
const { getFirestore } = require("firebase-admin/firestore");
const fs = require("fs");
const path = require("path");

const saPath = path.resolve(__dirname, "serviceAccount_cyr.json");

if (!fs.existsSync(saPath)) {
  console.error(`❌ No se encontró el archivo de credenciales de CyR en: ${saPath}`);
  process.exit(1);
}

const serviceAccount = require(saPath);

const app = initializeApp({
  credential: cert(serviceAccount)
}, "cyr_app");

const db = getFirestore(app);

const COLLECTIONS = [
  "users",
  "classes",
  "class_members",
  "game_results",
  "test_teoria_respuestas",
  "respuestas_test",
  "examenes_test",
  "preguntas",
  "public_bots",
  "mecanoclass_texts",
  "offline_tasks_config",
  "offline_grades",
  "allowed_teachers",
  "allowed_students"
];

async function exportAll() {
  const outDir = path.resolve(__dirname, "data/cyr");
  fs.mkdirSync(outDir, { recursive: true });

  console.log("🚀 Iniciando exportación de CyR (cyrgames-6e3ff)...");

  for (const colName of COLLECTIONS) {
    try {
      process.stdout.write(`📦 Exportando ${colName}... `);
      const snap = await db.collection(colName).get();
      const docs = snap.docs.map(doc => ({
        _id: doc.id,
        ...doc.data()
      }));
      const outFile = path.join(outDir, `${colName}.json`);
      fs.writeFileSync(outFile, JSON.stringify(docs, null, 2), "utf8");
      console.log(`✅ ${docs.length} documentos`);
    } catch (err) {
      console.log(`⚠️ ${err.message}`);
    }
  }

  console.log("🎉 Exportación de CyR completada con éxito!");
  process.exit(0);
}

exportAll().catch(err => {
  console.error("Error fatal:", err);
  process.exit(1);
});
