/**
 * main.js
 * ─────────────────────────────────────────────────────────────────
 * Punto de entrada de Arena de Bots.
 * Inicializa la aplicación cuando el DOM está listo.
 *
 * Responsabilidades:
 *   - Esperar a que el DOM esté completamente cargado
 *   - Obtener el canvas de la arena
 *   - Instanciar UIManager (que a su vez crea GameEngine)
 *   - Manejo global de errores
 * ─────────────────────────────────────────────────────────────────
 */

import { UIManager } from './UIManager.js';
import { requireGameAccess } from '../../../../../js/common/auth.js';

// ─────────────────────────────────────────────────────────────────
// FUNCIÓN PRINCIPAL DE INICIALIZACIÓN
// ─────────────────────────────────────────────────────────────────

/**
 * Inicializa la aplicación Arena de Bots.
 * Se ejecuta cuando el DOM está completamente cargado.
 */
function initApp() {
  console.log('%c⚡ Arena de Bots', 'color:#00f5ff;font-family:monospace;font-size:18px;font-weight:bold;');
  console.log('%cVersión 1.0.0 · Educativo · 1º ESO', 'color:#8888bb;font-family:monospace;');
  console.log('%cStack: HTML5 + CSS3 + Vanilla JS (ES6 Modules) + Canvas 2D', 'color:#39ff14;font-family:monospace;font-size:11px;');

  // ── Obtener el canvas ────────────────────────────────────────
  const canvas = document.getElementById('arena-canvas');
  if (!canvas) {
    console.warn('[main.js] No se encontró el elemento #arena-canvas en el DOM (probablemente en index.html).');
  } else if (!canvas.getContext) {
    _showFatalError('Tu navegador no soporta Canvas 2D. Por favor, usa Chrome, Firefox o Edge modernos.');
    return;
  }

  // ── Instanciar el UIManager ──────────────────────────────────
  // UIManager inicializa GameEngine internamente.
  try {
    const uiManager = new UIManager(canvas);

    // Exponer en window solo para depuración en desarrollo
    // (eliminar en producción o detrás de un flag)
    if (typeof window !== 'undefined') {
      window.__arenaBots = { uiManager };
      console.log('%c[DEBUG] Accede a window.__arenaBots para depurar.', 'color:#555577;font-size:10px;');
    }

    console.log('%c✅ Aplicación inicializada correctamente. ¡A programar!', 'color:#39ff14;font-family:monospace;');
  } catch (err) {
    console.error('[main.js] Error al inicializar UIManager:', err);
    _showFatalError('Error al inicializar el juego. Comprueba la consola del navegador.');
  }
}

// ─────────────────────────────────────────────────────────────────
// MANEJADOR GLOBAL DE ERRORES NO CAPTURADOS
// ─────────────────────────────────────────────────────────────────

/**
 * Captura errores JavaScript no controlados y los registra.
 * En un entorno de producción con Firebase, aquí iría
 * la integración con Firebase Crashlytics o un servicio de logging.
 *
 * // TODO: FIREBASE INTEGRATION
 * //   import { logEvent } from 'firebase/analytics';
 * //   logEvent(analytics, 'js_error', { message: event.message, stack: event.error?.stack });
 */
window.addEventListener('error', (event) => {
  console.error('[Arena de Bots] Error no controlado:', event.message, event.error);
});

window.addEventListener('unhandledrejection', (event) => {
  console.error('[Arena de Bots] Promesa rechazada no controlada:', event.reason);
});

// ─────────────────────────────────────────────────────────────────
// UTILIDADES PRIVADAS
// ─────────────────────────────────────────────────────────────────

/**
 * Muestra un mensaje de error fatal en el canvas o en la página.
 * @param {string} message
 */
function _showFatalError(message) {
  const canvas = document.getElementById('arena-canvas');
  if (canvas) {
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.fillStyle = '#0a0a16';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.font      = 'bold 20px monospace';
      ctx.fillStyle = '#ff4444';
      ctx.textAlign = 'center';
      ctx.fillText('⚠️ ' + message, canvas.width / 2, canvas.height / 2);
    }
  } else {
    // Fallback: alerta del navegador
    alert('Arena de Bots: ' + message);
  }
}

// ─────────────────────────────────────────────────────────────────
// PUNTO DE ENTRADA
// ─────────────────────────────────────────────────────────────────

// Esperar a que el DOM esté completamente cargado
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    requireGameAccess('arenabots', {
      onGranted: async (user, profile, classId) => {
        initApp();
      }
    });
  });
} else {
  requireGameAccess('arenabots', {
    onGranted: async (user, profile, classId) => {
      initApp();
    }
  });
}
