// ═══════════════════════════════════════════════════════════════════════
//  STACKCLASS — temario.js (Visor dinámico universal y motor de tests)
// ═══════════════════════════════════════════════════════════════════════

import { requireAuth, currentUser, currentProfile, incrementDigitalWellbeing } from "./common/auth.js";
import { getTopic, getTopicQuestions, saveTopicTestResult, getSubject } from "./common/db.js";
import { $, $$, escapeHtml, getUrlParams } from "./common/utils.js";
import { showToast, showModal } from "./common/ui.js";

let currentTopic = null;
let currentQuestions = [];
let userAnswers = [];
let currentQ = 0;
let testActive = false;
let blurWarnings = 0;

// Presentation mode state
let presentationSlides = [];
let currentSlide = 0;

document.addEventListener("DOMContentLoaded", () => {
  requireAuth({
    allowedRoles: ["student", "teacher"],
    onAuthorized: async (user, profile) => {
      await initTopicPage(user, profile);
    }
  });
});

async function initTopicPage(user, profile) {
  const params = getUrlParams();
  const topicId = params.topicId || params.topic || params.id || "block1";

  try {
    currentTopic = await getTopic(topicId);
    if (!currentTopic) {
      $("topic-loading").innerHTML = `
        <h2 style="color:var(--error);">Tema no encontrado</h2>
        <p>No se pudo cargar el tema <code>${escapeHtml(topicId)}</code>.</p>
        <a href="../dashboard_student.html" class="btn btn-primary" style="margin-top:20px;">Volver al Dashboard</a>
      `;
      return;
    }

    // Actualizar badge de asignatura
    const subject = await getSubject(currentTopic.subject_id);
    const badge = $("subject-badge");
    if (badge && subject) {
      badge.textContent = `${subject.icon || "📚"} ${subject.name}`;
      badge.style.background = (subject.color || "#6366f1") + "20";
      badge.style.color = subject.color || "#6366f1";
    }

    document.title = `${currentTopic.name} — StackClass`;

    // Renderizar contenido del tema
    renderTopicContent(currentTopic);

    // Preparar eventos de presentación y test
    setupPresentationMode();
    setupTestEngine();

    // Auto-iniciar test si se solicita por parámetro en la URL
    if (params.startTest === "true" || params.startTest === "1" || params.test === "true" || params.test === "1") {
      setTimeout(() => {
        $("btn-start-test")?.click();
      }, 200);
    }

  } catch (err) {
    console.error("Error al cargar el tema:", err);
    $("topic-loading").innerHTML = `
      <h2 style="color:var(--error);">Error al cargar</h2>
      <p>${escapeHtml(err.message)}</p>
    `;
  }
}

function renderTopicContent(topic) {
  const container = $("topic-content");
  let html = "";

  if (Array.isArray(topic.blocks) && topic.blocks.length > 0) {
    topic.blocks.forEach(block => {
      if (block.type === "html") {
        html += block.content;
      } else if (block.type === "h1") {
        html += `<h1>${escapeHtml(block.content)}</h1>`;
      } else if (block.type === "h2") {
        html += `<h2>${escapeHtml(block.content)}</h2>`;
      } else if (block.type === "p") {
        html += `<p>${escapeHtml(block.content)}</p>`;
      } else if (block.type === "ul" && Array.isArray(block.items)) {
        html += `<ul>${block.items.map(it => `<li>${escapeHtml(it)}</li>`).join("")}</ul>`;
      } else if (block.type === "img") {
        html += `<img src="../${escapeHtml(block.src)}" alt="${escapeHtml(block.alt || "")}" style="max-width:100%; border-radius:8px; margin:20px auto; display:block;" />`;
      }
    });
  } else {
    html = `<p>Este tema aún no tiene contenido cargado.</p>`;
  }

  // Corregir rutas relativas de assets si vienen sin prefijo ../
  html = html.replace(/src="assets\//g, 'src="../assets/');

  container.innerHTML = html;
  $("topic-loading").style.display = "none";
  container.style.display = "block";

  // Interceptar botones y enlaces que apunten a test.html para abrir el test modal directamente
  container.querySelectorAll('a[href*="test.html"]').forEach(link => {
    link.addEventListener('click', (e) => {
      e.preventDefault();
      $("btn-start-test")?.click();
    });
  });
}

// ──────────────────────────────────────────────────────────────────────
//  MODO PRESENTACIÓN
// ──────────────────────────────────────────────────────────────────────
function setupPresentationMode() {
  $("btn-presentation")?.addEventListener("click", () => {
    buildSlides();
    showPresentationOverlay();
  });
}

function buildSlides() {
  const container = $("topic-content");
  presentationSlides = [];

  // Dividir por secciones h2
  const children = Array.from(container.children);
  let currentSlideHtml = "";

  children.forEach(el => {
    if (el.tagName === "H2" && currentSlideHtml.trim()) {
      presentationSlides.push(currentSlideHtml);
      currentSlideHtml = "";
    }
    currentSlideHtml += el.outerHTML;
  });

  if (currentSlideHtml.trim()) {
    presentationSlides.push(currentSlideHtml);
  }

  if (presentationSlides.length === 0) {
    presentationSlides.push(container.innerHTML);
  }
}

function showPresentationOverlay() {
  let overlay = $("presentation-overlay");
  if (!overlay) {
    overlay = document.createElement("div");
    overlay.id = "presentation-overlay";
    overlay.style.cssText = "position:fixed;inset:0;background:#f8fafc;z-index:99999;display:flex;flex-direction:column;font-family:system-ui,sans-serif;";
    overlay.innerHTML = `
      <div id="pres-slide-box" style="flex:1;overflow-y:auto;padding:50px 10%;display:flex;flex-direction:column;align-items:center;justify-content:center;font-size:1.4rem;line-height:1.6;"></div>
      <div style="background:#1e293b;color:white;padding:15px 30px;display:flex;align-items:center;gap:15px;justify-content:space-between;">
        <button id="pres-btn-prev" class="btn btn-secondary">⬅ Anterior</button>
        <span id="pres-counter" style="font-weight:bold;font-size:1.1rem;">1 / 1</span>
        <button id="pres-btn-next" class="btn btn-primary">Siguiente ➡</button>
        <button id="pres-btn-close" class="btn btn-outline" style="color:white;border-color:white;margin-left:auto;">✕ Cerrar</button>
      </div>
    `;
    document.body.appendChild(overlay);

    $("pres-btn-prev").addEventListener("click", () => {
      if (currentSlide > 0) { currentSlide--; updateSlide(); }
    });
    $("pres-btn-next").addEventListener("click", () => {
      if (currentSlide < presentationSlides.length - 1) { currentSlide++; updateSlide(); }
    });
    $("pres-btn-close").addEventListener("click", () => {
      overlay.style.display = "none";
    });

    document.addEventListener("keydown", (e) => {
      if (overlay.style.display === "none") return;
      if (e.key === "ArrowRight" || e.key === "Space") {
        if (currentSlide < presentationSlides.length - 1) { currentSlide++; updateSlide(); }
      } else if (e.key === "ArrowLeft") {
        if (currentSlide > 0) { currentSlide--; updateSlide(); }
      } else if (e.key === "Escape") {
        overlay.style.display = "none";
      }
    });
  }

  currentSlide = 0;
  updateSlide();
  overlay.style.display = "flex";
}

function updateSlide() {
  const box = $("pres-slide-box");
  const counter = $("pres-counter");
  if (box) box.innerHTML = `<div style="max-width:900px;width:100%;">${presentationSlides[currentSlide] || ""}</div>`;
  if (counter) counter.textContent = `${currentSlide + 1} / ${presentationSlides.length}`;
}

// ──────────────────────────────────────────────────────────────────────
//  MOTOR DE TEST
// ──────────────────────────────────────────────────────────────────────
function setupTestEngine() {
  $("btn-start-test")?.addEventListener("click", async () => {
    // Comprobar bienestar digital
    const ok = await incrementDigitalWellbeing(currentUser.id, "test", currentTopic.id);
    if (!ok) return;

    startTest();
  });

  $("btn-close-test")?.addEventListener("click", () => {
    if (!testActive) {
      $("test-overlay").style.display = "none";
      return;
    }
    showModal({
      title: "Salir del Test",
      body: "¿Seguro que quieres salir? Perderás las respuestas no entregadas.",
      confirmText: "Salir",
      cancelText: "Continuar",
      onConfirm: () => {
        testActive = false;
        $("test-overlay").style.display = "none";
      }
    });
  });

  $("btn-prev-q")?.addEventListener("click", () => {
    if (currentQ > 0) { currentQ--; renderQuestion(); }
  });

  $("btn-next-q")?.addEventListener("click", () => {
    if (currentQ < currentQuestions.length - 1) {
      currentQ++;
      renderQuestion();
    } else {
      finishTestConfirm();
    }
  });

  $("btn-finish-test")?.addEventListener("click", () => {
    $("test-overlay").style.display = "none";
  });

  // Anti-chuletas
  window.addEventListener("blur", handleFocusLoss);
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") handleFocusLoss();
  });
}

async function startTest() {
  if (currentProfile && currentProfile.role === 'student') {
    const ok = await incrementDigitalWellbeing(currentUser.id, "test", currentTopic.id);
    if (!ok) return;
  }
  currentQuestions = await getTopicQuestions(currentTopic.id, 15);
  if (currentQuestions.length === 0) {
    showToast("Aviso", "No hay preguntas disponibles para este tema.", "info");
    return;
  }

  userAnswers = new Array(currentQuestions.length).fill(null);
  currentQ = 0;
  testActive = true;
  blurWarnings = 0;

  $("test-title").textContent = `Test: ${currentTopic.name}`;
  $("test-view").style.display = "block";
  $("test-results").style.display = "none";
  $("test-overlay").style.display = "flex";

  renderNavigator();
  renderQuestion();
}

function renderNavigator() {
  const nav = $("test-navigator");
  if (!nav) return;
  nav.innerHTML = currentQuestions.map((_, idx) => {
    const isAnswered = userAnswers[idx] !== null;
    const isActive = idx === currentQ;
    return `
      <button class="q-btn ${isActive ? "active" : ""} ${isAnswered ? "answered" : ""}"
              data-idx="${idx}">
        ${idx + 1}
      </button>
    `;
  }).join("");

  nav.querySelectorAll(".q-btn").forEach(btn => {
    btn.addEventListener("click", (e) => {
      currentQ = parseInt(e.currentTarget.dataset.idx);
      renderQuestion();
    });
  });
}

function renderQuestion() {
  renderNavigator();
  const q = currentQuestions[currentQ];
  if (!q) return;

  $("question-text").textContent = `${currentQ + 1}. ${q.enunciado}`;
  const cont = $("options-container");
  cont.innerHTML = "";

  const opciones = Array.isArray(q.opciones) ? q.opciones : [];
  opciones.forEach((op, idx) => {
    const isSel = userAnswers[currentQ] === idx;
    const div = document.createElement("div");
    div.className = `option-item ${isSel ? "selected" : ""}`;
    div.innerHTML = `
      <span style="font-weight:bold; color:#6366f1;">${String.fromCharCode(65 + idx)})</span>
      <span style="flex:1;">${escapeHtml(op.texto)}</span>
    `;
    div.addEventListener("click", () => {
      userAnswers[currentQ] = idx;
      renderQuestion();
    });
    cont.appendChild(div);
  });

  $("btn-prev-q").style.visibility = currentQ > 0 ? "visible" : "hidden";
  const btnNext = $("btn-next-q");
  if (currentQ === currentQuestions.length - 1) {
    btnNext.textContent = "Entregar Test ✔️";
    btnNext.style.background = "#10b981";
  } else {
    btnNext.textContent = "Siguiente ➡";
    btnNext.style.background = "";
  }
}

function finishTestConfirm() {
  const answeredCount = userAnswers.filter(a => a !== null).length;
  const blankCount = currentQuestions.length - answeredCount;

  let msg = "¿Deseas entregar el test?";
  if (blankCount > 0) {
    msg += ` Tienes ${blankCount} pregunta(s) sin contestar (las preguntas en blanco no restan).`;
  }

  showModal({
    title: "Entregar Test",
    body: msg,
    confirmText: "Entregar Ahora",
    cancelText: "Revisar",
    onConfirm: () => processSubmission(false)
  });
}

async function processSubmission(forcedFail = false) {
  testActive = false;

  let score = 0;
  const respuestas = [];

  currentQuestions.forEach((q, idx) => {
    const ans = userAnswers[idx];
    let isCorrect = false;
    let correctaTexto = "?";

    const opciones = Array.isArray(q.opciones) ? q.opciones : [];
    const correctaOp = opciones.find(o => o.correcta);
    if (correctaOp) correctaTexto = correctaOp.texto;

    if (ans !== null && ans !== undefined) {
      if (opciones[ans] && opciones[ans].correcta) {
        score += 1;
        isCorrect = true;
      } else {
        score -= 0.33;
      }
    }

    respuestas.push({
      preguntaId: q.id,
      enunciado: q.enunciado,
      marcada: ans !== null && opciones[ans] ? opciones[ans].texto : "BLANCO",
      correctaTexto,
      isCorrect: forcedFail ? false : isCorrect,
      isBlanco: ans === null
    });
  });

  const totalPossible = currentQuestions.length;
  let finalScore = (score / totalPossible) * 10;
  if (finalScore < 0) finalScore = 0;
  finalScore = Math.round(finalScore * 100) / 100;
  if (forcedFail) finalScore = 0;

  // Guardar en Supabase
  try {
    await saveTopicTestResult({
      student_id: currentUser.id,
      topic_id: currentTopic.id,
      subject_id: currentTopic.subject_id,
      score: finalScore,
      raw_score: score,
      max_possible: totalPossible,
      respuestas,
      forced_fail: forcedFail
    });
  } catch (err) {
    console.error("Error al guardar test:", err);
  }

  // Gamificación gestionada por triggers en PostgreSQL (trg_after_topic_test_insert)
  let medalsAwarded = [];

  // Mostrar vista de resultados
  $("test-view").style.display = "none";
  $("test-results").style.display = "block";

  const isPassed = finalScore >= 5;
  $("results-icon").textContent = isPassed ? "🎉" : "💀";
  $("results-title").textContent = isPassed ? "¡Enhorabuena! Has Aprobado" : "Has Suspendido";
  $("results-score").innerHTML = `
    <span style="color:${isPassed ? "var(--success)" : "var(--error)"};">${finalScore}</span>
    <span style="font-size:1.5rem; color:#94a3b8;">/ 10</span>
  `;
  $("results-msg").textContent = isPassed
    ? "Tus resultados han quedado registrados en tu expediente."
    : "Repasa los contenidos teóricos y vuelve a intentarlo más tarde.";

  const medalsBox = $("results-medals");
  if (medalsAwarded.length > 0) {
    medalsBox.innerHTML = `
      <div style="background:#fef9c3; border:1px solid #facc15; padding:12px; border-radius:10px; display:inline-block;">
        <strong>¡Nuevas Medallas Desbloqueadas!</strong><br>
        ${medalsAwarded.join(" · ")}
      </div>
    `;
  } else {
    medalsBox.innerHTML = "";
  }
}

// Anti-chuletas
function handleFocusLoss() {
  if (!testActive) return;
  if (currentProfile?.role !== "student") return;

  blurWarnings++;
  if (blurWarnings === 1) {
    showModal({
      title: "⚠️ ¡Atención! Actividad sospechosa",
      body: "Has salido de la ventana o cambiado de pestaña.<br>Si vuelves a salir, el test se anulará automáticamente con un 0.",
      confirmText: "Entendido, continuar",
      hideCancel: true
    });
  } else if (blurWarnings >= 2) {
    processSubmission(true);
    showModal({
      title: "❌ Test Anulado",
      body: "Has vuelto a salir de la ventana. El test ha sido calificado con un 0 automático por medidas anti-chuletas.",
      confirmText: "Aceptar",
      hideCancel: true
    });
  }
}
