// ═══════════════════════════════════════════════════════════════════════
//  STACKCLASS — index.js (Página de login unificada)
// ═══════════════════════════════════════════════════════════════════════

import { loginStudentGoogle, loginTeacherGoogle, setupAuthListener } from "./common/auth.js";
import { initParticles, showToast } from "./common/ui.js";
import { $ } from "./common/utils.js";

// Inicializar partículas de fondo
initParticles("particles-canvas");

// ── Comprobar mensajes de error en URL ─────────────────────────
const urlParams = new URLSearchParams(window.location.search);
if (urlParams.get('error') === 'not_authorized') {
  showError('⚠️ Tu cuenta no está registrada en ninguna clase de StackClass. Si eres alumno/a, tu profesor/a de Computación y Robótica o TIC debe darte de alta en su clase para poder acceder.');
  showToast('Acceso no autorizado', 'Tu cuenta no está asignada a ninguna clase activa.', 'error', 7000);
}

// ── Si ya hay sesión activa, redirigir ─────────────────────────
setupAuthListener((user, profile) => {
  if (!user || !profile) return;

  const redirect = sessionStorage.getItem("classhub_redirect");
  sessionStorage.removeItem("classhub_redirect");

  if (redirect && !redirect.includes("index.html")) {
    window.location.href = redirect;
    return;
  }

  const isTeacher = profile.role === "teacher" || profile.role === "admin" || profile.is_superadmin;
  if (isTeacher) {
    window.location.href = "./dashboard_teacher.html";
  } else {
    window.location.href = "./dashboard_student.html";
  }
});

// ── Botón DOCENTE (Google + Classroom) ─────────────────────────
$("btn-teacher-google")?.addEventListener("click", async () => {
  try {
    setLoading(true);
    showError("");
    await loginTeacherGoogle();
  } catch (err) {
    showError(`Error al iniciar como docente: ${err.message}`);
    showToast("Acceso Denegado", err.message, "error", 6000);
    setLoading(false);
  }
});

// ── Botón ALUMNO (Google) ───────────────────────────────────────
$("btn-student-google")?.addEventListener("click", async () => {
  try {
    setLoading(true);
    showError("");
    await loginStudentGoogle();
  } catch (err) {
    showError(`Error al iniciar sesión: ${err.message}`);
    setLoading(false);
  }
});

function setLoading(isLoading) {
  const btns = [$("btn-teacher-google"), $("btn-student-google")];
  btns.forEach(b => {
    if (b) {
      b.disabled = isLoading;
      b.style.opacity = isLoading ? "0.7" : "1";
    }
  });
}

function showError(msg) {
  const el = $("login-error");
  if (el) el.textContent = msg;
}
