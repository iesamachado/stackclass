// ═══════════════════════════════════════════════════════════════════════
//  01_export_tic2.js — Exportar Firestore TIC2 a ficheros JSON locales
// ═══════════════════════════════════════════════════════════════════════

const { initializeApp, cert } = require("firebase-admin/app");
const { getFirestore } = require("firebase-admin/firestore");
const fs = require("fs");
const path = require("path");

const saPath = path.resolve(__dirname, "serviceAccount_tic2.json");

if (!fs.existsSync(saPath)) {
  console.error(`❌ No se encontró el archivo de credenciales de TIC2 en: ${saPath}`);
  process.exit(1);
}

const serviceAccount = require(saPath);

const app = initializeApp({
  credential: cert(serviceAccount)
}, "tic2_app");

const db = getFirestore(app);

const COLLECTIONS = [
  "tic2_users",
  "tic2_classes",
  "tic2_class_members",
  "tic2_game_results",
  "tic2_tests_teoria",
  "respuestas_test",
  "examenes_test",
  "preguntas",
  "tic2_offline_grades",
  "tic2_offline_tasks_config",
  "tic2_allowed_teachers",
  "tic2_allowed_students"
];

async function exportAll() {
  const outDir = path.resolve(__dirname, "data/tic2");
  fs.mkdirSync(outDir, { recursive: true });

  console.log("🚀 Iniciando exportación de TIC2 (rompehielos-fe104)...");

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

  console.log("🎉 Exportación de TIC2 completada con éxito!");
  process.exit(0);
}

exportAll().catch(err => {
  console.error("Error fatal:", err);
  process.exit(1);
});
