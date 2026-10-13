// ============================================================
// juego.js — Agente Analista: Game Logic
// ============================================================

import { requireAuth, incrementDigitalWellbeing } from '../../../../../js/common/auth.js';
import { db, doc, collection, getDoc, updateDoc, addDoc, onSnapshot, serverTimestamp, increment, query, orderBy } from '../../../../../js/common/firebase-config.js';
import { renderHeader, showToast, initParticles } from '../../../../../js/common/ui.js';

// ─── Estado del Agente Analista ──────────────────────────────
const state = {
  sesionId:       null,
  equipoId:       null,
  equipoNombre:   null,
  rondaActual:    0,
  textoCifrado:   '',
  textoOriginal:  null, // revelado al finalizar ronda
  tablaSustitucion: {}, // { cifrado -> descifrado }
  historial:      [],
  puntuacion:     0,
  frecChart:      null,
  selectedChar:   null,
  unsubSesion:    null,
  unsubEquipos:   null,
  unsubRonda:     null,
  timerInterval:  null
};

document.addEventListener('DOMContentLoaded', () => {
  requireAuth({
    allowedRoles: ['teacher', 'student'],
    onAuthorized: async (user, profile) => {
      if (profile.role === 'student') {
        const allowed = await incrementDigitalWellbeing(user.id, 'game', 'rompecodigos');
        if (!allowed) return;
      }
      renderHeader(user, profile);
      initJuego(user);
    }
  });
});

async function initJuego(user) {
  // Recuperar sesión de localStorage
  const sesionId    = localStorage.getItem('rompehielos_sesion');
  const equipoId    = localStorage.getItem('rompehielos_equipo');
  const equipoNombre = localStorage.getItem('rompehielos_equipo_nombre');

  if (!sesionId || !equipoId) {
    showToast('Sin sesión', 'Vuelve al lobby para unirte', 'error');
    setTimeout(() => window.location.href = 'sala_alumno.html', 2000);
    return;
  }

  state.sesionId     = sesionId;
  state.equipoId     = equipoId;
  state.equipoNombre = equipoNombre;

  document.getElementById('hud-equipo').textContent = equipoNombre || 'Equipo';

  initParticles('particles-canvas');
  buildSustKeyboard();
  initCesarSlider();
  initSubmitHandler();
  initVigenereKnownPlaintextJuego();
  listenSesion();
  listenEquiposPuntuacion();
}

// ─── Escuchar sesión ──────────────────────────────────────────
function listenSesion() {
  if (state.unsubSesion) state.unsubSesion();

  state.unsubSesion = onSnapshot(doc(db, 'live_sessions', state.sesionId), snap => {
      if (!snap.exists) return;
      const data = snap.data();

      document.getElementById('hud-ronda').textContent =
        `${data.rondaActual || 0}/${data.totalRondas || 0}`;

      // Si cambia la ronda activa
      if (data.estado === 'en_curso' && data.rondaActual !== state.rondaActual) {
        state.rondaActual = data.rondaActual;
        document.getElementById('ronda-overlay')?.classList.add('hidden');
        loadRondaActiva(data.rondaActual, data.duracionRonda, data.tiempoRestante);
      }

      // Si la ronda finaliza
      if (data.estado === 'espera' && state.rondaActual > 0) {
        stopTimer();
        // Mostrar overlay de espera entre rondas (a menos que ya esté visible)
        const overlay = document.getElementById('ronda-overlay');
        if (overlay && overlay.classList.contains('hidden')) {
          showRondaOverlay(false, null, null);
        }
      }
    });
}

// ─── Cargar ronda activa ──────────────────────────────────────
async function loadRondaActiva(numRonda, duracion, tiempoRestante) {
  if (state.unsubRonda) state.unsubRonda();

  const rondaRef = doc(db, 'live_sessions', state.sesionId, 'rondas', numRonda.toString());

  state.unsubRonda = onSnapshot(rondaRef, snap => {
    if (!snap.exists) return;
    const ronda = snap.data();

    // Si la ronda acaba de iniciarse o cambia de estado
    if (ronda.estado === 'activa' && ronda.textoCifrado !== state.textoCifrado) {
      state.textoCifrado     = ronda.textoCifrado;
      state.tablaSustitucion = {};
      state.historial        = [];

      renderTextoCifrado();
      calcularYRenderFrecuencias();
      updatePreviewDescifrado();
      resetSustKeyboard();
      renderHistorial();
      actualizarCesarPreview();

      // Pistas
      renderPistas(ronda.pistas || []);

      // Timer
      startTimer(tiempoRestante || duracion || 300);
    }

    // Actualizar pistas si se añaden nuevas
    if (ronda.pistas?.length > 0) {
      renderPistas(ronda.pistas);
    }

    // Ronda finalizada → revelar solución
    if (ronda.estado === 'finalizada') {
      stopTimer();
      showRondaOverlay(
        ronda.ganadorEquipo === state.equipoNombre,
        ronda.ganadorEquipo,
        ronda.solucion
      );
    }
  });
}

// ─── Render texto cifrado ─────────────────────────────────────
function renderTextoCifrado() {
  const container = document.getElementById('texto-cifrado');
  if (!container) return;

  const texto = state.textoCifrado;

  container.innerHTML = texto.split('').map((ch, i) => {
    if (ch === ' ') return `<span class="char-token space"> </span>`;
    const isLetter = /[A-Z]/i.test(ch);
    const upper    = ch.toUpperCase();
    const mapped   = state.tablaSustitucion[upper];
    return `
      <span
        class="char-token ${isLetter ? 'letter' : ''} ${mapped ? 'mapped' : ''}"
        data-char="${upper}"
        data-index="${i}"
        title="${isLetter ? (mapped ? `${upper} → ${mapped}` : upper) : ch}"
      >${ch}</span>
    `;
  }).join('');

  // Click en letra → seleccionar / enfocar campo de sustitución
  container.querySelectorAll('.char-token.letter').forEach(el => {
    el.addEventListener('click', () => {
      const ch = el.dataset.char;
      selectChar(ch);
    });
  });

  renderCesarSuggestionsJuego();
  renderPalabrasCortasJuego();
}

// ─── Seleccionar char ─────────────────────────────────────────
function selectChar(ch) {
  state.selectedChar = ch;

  // Highlight todos los tokens de ese char
  document.querySelectorAll('.char-token.letter').forEach(el => {
    el.classList.toggle('selected', el.dataset.char === ch);
  });

  // Enfocar el input del teclado de sustitución
  const input = document.querySelector(`.sust-key-input[data-source="${ch}"]`);
  if (input) {
    input.focus();
    input.select();
  }
}

// ─── Calcular frecuencias y renderizar chart ──────────────────
function calcularYRenderFrecuencias() {
  const freqs = FrequencyAnalyzer.analyze(state.textoCifrado);
  const labels = freqs.map(f => f.char);
  const cipherData  = freqs.map(f => parseFloat(f.percent.toFixed(1)));
  const spanishData = freqs.map(f =>
    parseFloat((FrequencyAnalyzer.SPANISH_FREQS[f.char] || 0).toFixed(1))
  );

  const ctx = document.getElementById('freq-chart');
  if (!ctx) return;

  if (state.frecChart) state.frecChart.destroy();

  state.frecChart = new Chart(ctx, {
    type: 'bar',
    data: {
      labels,
      datasets: [
        {
          label: 'Texto cifrado (%)',
          data: cipherData,
          backgroundColor: 'rgba(0, 212, 255, 0.5)',
          borderColor: 'rgba(0, 212, 255, 0.9)',
          borderWidth: 1,
          borderRadius: 2
        },
        {
          label: 'Español estándar (%)',
          data: spanishData,
          type: 'line',
          borderColor: 'rgba(0, 255, 136, 0.7)',
          pointBackgroundColor: 'rgba(0, 255, 136, 0.7)',
          pointRadius: 2,
          fill: false,
          tension: 0.3,
          borderWidth: 1.5
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: { mode: 'index', intersect: false },
      plugins: {
        legend: {
          labels: {
            color: '#6b8aaa',
            font: { size: 10, family: "'Inter', sans-serif" },
            boxWidth: 10
          }
        },
        tooltip: {
          backgroundColor: '#0a1628',
          borderColor: 'rgba(0,212,255,0.2)',
          borderWidth: 1,
          titleColor: '#e0f0ff',
          bodyColor: '#6b8aaa',
          callbacks: {
            label: ctx => `${ctx.dataset.label}: ${ctx.formattedValue}%`
          }
        }
      },
      scales: {
        x: {
          ticks: {
            color: '#5a7898',
            font: { size: 8, family: "'JetBrains Mono', monospace" }
          },
          grid: { color: 'rgba(255,255,255,0.03)' }
        },
        y: {
          ticks: { color: '#5a7898', font: { size: 8 } },
          grid: { color: 'rgba(255,255,255,0.03)' },
          beginAtZero: true
        }
      }
    }
  });
}

// ─── Build substitution keyboard ─────────────────────────────
function buildSustKeyboard() {
  const keyboard = document.getElementById('sust-keyboard');
  if (!keyboard) return;

  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';

  keyboard.innerHTML = alphabet.split('').map(ch => `
    <div class="sust-key">
      <div class="sust-key-label">${ch}</div>
      <input
        type="text"
        class="sust-key-input"
        data-source="${ch}"
        maxlength="1"
        autocomplete="off"
        spellcheck="false"
        placeholder="?"
      >
    </div>
  `).join('');

  keyboard.querySelectorAll('.sust-key-input').forEach(input => {
    input.addEventListener('input', (e) => {
      const ch    = input.dataset.source;
      const value = e.target.value.toUpperCase().replace(/[^A-Z]/g, '');
      input.value = value;

      if (value) {
        input.classList.add('filled');
        state.tablaSustitucion[ch] = value;
      } else {
        input.classList.remove('filled');
        delete state.tablaSustitucion[ch];
      }

      updatePreviewDescifrado();
      renderTextoCifrado();
      guardarSustitucionEnFirestore();
    });

    // Tab navigation
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Tab') {
        // let default tab work
        return;
      }
      if (e.key === 'Enter') {
        document.getElementById('input-solucion')?.focus();
      }
    });

    // Click → seleccionar todos los tokens de esa letra
    input.addEventListener('focus', () => {
      selectChar(input.dataset.source);
    });
  });

  // Botón sugerir
  document.getElementById('btn-sugerir')?.addEventListener('click', aplicarSugerencias);

  // Botón reset
  document.getElementById('btn-reset-sust')?.addEventListener('click', resetSustKeyboard);
}

// ─── Reset keyboard ───────────────────────────────────────────
function resetSustKeyboard() {
  state.tablaSustitucion = {};
  document.querySelectorAll('.sust-key-input').forEach(input => {
    input.value = '';
    input.classList.remove('filled');
  });
  updatePreviewDescifrado();
  renderTextoCifrado();
}

// ─── Apply frequency suggestions ─────────────────────────────
function aplicarSugerencias() {
  const sugs = FrequencyAnalyzer.suggestSubstitutions(state.textoCifrado);

  Object.entries(sugs).forEach(([cipher, plain]) => {
    const input = document.querySelector(`.sust-key-input[data-source="${cipher}"]`);
    if (input && !input.value) {
      input.value = plain;
      input.classList.add('filled');
      state.tablaSustitucion[cipher] = plain;
    }
  });

  updatePreviewDescifrado();
  renderTextoCifrado();
  showToast('Sugerencias aplicadas', 'Basadas en frecuencias del español', 'info');
}

// ─── Update decrypted preview ─────────────────────────────────
function updatePreviewDescifrado() {
  const el = document.getElementById('texto-descifrado');
  if (!el) return;

  if (!state.textoCifrado) {
    el.textContent = '— escribe sustituciones para ver el preview';
    return;
  }

  const preview = applySubstitution(state.textoCifrado, state.tablaSustitucion);
  el.textContent = preview;
}

// ─── César slider ─────────────────────────────────────────────
function initCesarSlider() {
  const slider = document.getElementById('cesar-slider');
  const valEl  = document.getElementById('cesar-val');

  slider?.addEventListener('input', () => {
    valEl.textContent = slider.value;
    actualizarCesarPreview();
  });
}

function actualizarCesarPreview() {
  const slider  = document.getElementById('cesar-slider');
  const preview = document.getElementById('cesar-preview');
  if (!slider || !preview) return;

  const n = parseInt(slider.value);
  if (!state.textoCifrado) {
    preview.textContent = '—';
    return;
  }

  const resultado = Caesar.decrypt(state.textoCifrado, n);
  preview.textContent = resultado;
}

// ─── Render Pistas ────────────────────────────────────────────
function renderPistas(pistas) {
  const list = document.getElementById('pistas-list');
  if (!list) return;

  if (!pistas.length) {
    list.innerHTML = '<div class="text-muted" style="font-size:0.8rem">Sin pistas todavía</div>';
    return;
  }

  list.innerHTML = pistas.map(p => `
    <div class="pista-item">
      <span>💡</span>
      <span>${p.texto}</span>
    </div>
  `).join('');
}

// ─── Submit Solution ──────────────────────────────────────────
function initSubmitHandler() {
  document.getElementById('btn-enviar-solucion')?.addEventListener('click', enviarSolucion);

  document.getElementById('input-solucion')?.addEventListener('keydown', (e) => {
    if (e.ctrlKey && e.key === 'Enter') enviarSolucion();
  });
}

async function enviarSolucion() {
  const input   = document.getElementById('input-solucion');
  const feedback = document.getElementById('submit-feedback');
  const propuesta = input?.value.trim().toUpperCase().replace(/\s+/g, ' ');

  if (!propuesta) {
    showToast('Escribe tu solución primero', '', 'error');
    return;
  }

  if (!state.sesionId || !state.equipoId) {
    showToast('Error de sesión', '', 'error');
    return;
  }

  const btn = document.getElementById('btn-enviar-solucion');
  btn.disabled = true;
  btn.innerHTML = '<span class="spinner"></span> Verificando...';

  try {
    // Obtener solución correcta de Firestore (campo `solucion`)
    // NOTA: En producción, usar Cloud Functions para esta verificación
    const rondaSnap = await getDoc(doc(db, 'live_sessions', state.sesionId, 'rondas', state.rondaActual.toString()));

    const rondaData = rondaSnap.data();
    const correcto  = verifySolution(propuesta, rondaData.solucion || '');

    // Guardar intento
    const intentoRef = await addDoc(collection(db, 'live_sessions', state.sesionId, 'equipos', state.equipoId, 'intentos'), {
        texto:     propuesta,
        ronda:     state.rondaActual,
        correcto,
        timestamp: serverTimestamp()
      });

    // Actualizar historial local
    state.historial.unshift({
      texto:    propuesta,
      correcto,
      hora:     new Date().toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })
    });
    renderHistorial();

    if (correcto) {
      // Actualizar puntuación + marcar ganador
      const timerEl = document.getElementById('hud-timer');
      const tiempoActual = parseTiempoRestante(timerEl?.textContent);
      const puntos = calcularPuntos(tiempoActual);

      await updateDoc(doc(db, 'live_sessions', state.sesionId, 'equipos', state.equipoId), {
          puntuacion: increment(puntos),
          intentos:   increment(1)
        });

      await updateDoc(doc(db, 'live_sessions', state.sesionId, 'rondas', state.rondaActual.toString()), {
          estado:         'finalizada',
          ganadorEquipo:  state.equipoNombre
        });

      state.puntuacion += puntos;
      document.getElementById('hud-puntos').textContent = state.puntuacion;

      feedback.textContent  = `✅ ¡CORRECTO! +${puntos} puntos`;
      feedback.className    = 'submit-feedback success';
      feedback.classList.remove('hidden');

      stopTimer();
      showToast('¡CORRECTO! 🎉', `+${puntos} puntos`, 'success');

    } else {
      // Penalizar -5 pts por intento fallido
      await updateDoc(doc(db, 'live_sessions', state.sesionId, 'equipos', state.equipoId), {
          puntuacion: increment(-5),
          intentos:   increment(1)
        });

      state.puntuacion = Math.max(0, state.puntuacion - 5);
      document.getElementById('hud-puntos').textContent = state.puntuacion;

      feedback.textContent = '❌ Incorrecto. Sigue intentando (-5 pts)';
      feedback.className   = 'submit-feedback error';
      feedback.classList.remove('hidden');

      showToast('Incorrecto', 'Revisa tu análisis e inténtalo de nuevo', 'error', 2500);
    }

  } catch (err) {
    showToast('Error', err.message, 'error');
  } finally {
    btn.disabled = false;
    btn.innerHTML = '🚀 Enviar';
  }
}

// ─── Puntuación ───────────────────────────────────────────────
function calcularPuntos(tiempoRestante) {
  if (tiempoRestante > 240) return 150;
  if (tiempoRestante > 120) return 100;
  if (tiempoRestante > 60)  return 75;
  return 50;
}

function parseTiempoRestante(text) {
  if (!text || text === '--:--') return 0;
  const [m, s] = text.split(':').map(Number);
  return (m || 0) * 60 + (s || 0);
}

// ─── Render historial ─────────────────────────────────────────
function renderHistorial() {
  const list = document.getElementById('historial-list');
  if (!list) return;

  if (!state.historial.length) {
    list.innerHTML = '<div class="text-muted" style="font-size:0.78rem; text-align:center">Sin intentos todavía</div>';
    return;
  }

  list.innerHTML = state.historial.slice(0, 10).map(h => `
    <div class="historial-item ${h.correcto ? 'correcto' : 'incorrecto'}">
      <span class="hist-icon">${h.correcto ? '✅' : '❌'}</span>
      <span class="hist-text">${h.texto}</span>
      <span class="hist-time">${h.hora}</span>
    </div>
  `).join('');
}

// ─── Guardar tabla sustitución en Firestore ───────────────────
let saveTimeout = null;
function guardarSustitucionEnFirestore() {
  if (saveTimeout) clearTimeout(saveTimeout);
  saveTimeout = setTimeout(async () => {
    try {
      await updateDoc(doc(db, 'live_sessions', state.sesionId, 'equipos', state.equipoId), {
          tablaSustitucion: state.tablaSustitucion
        });
    } catch (_) { /* silencioso */ }
  }, 1000);
}

// ─── Escuchar equipos (marcador) ──────────────────────────────
function listenEquiposPuntuacion() {
  if (state.unsubEquipos) state.unsubEquipos();

  state.unsubEquipos = onSnapshot(query(collection(db, 'live_sessions', state.sesionId, 'equipos'), orderBy('puntuacion', 'desc')), snap => {
      const equipos = snap.docs.map(d => ({ id: d.id, ...d.data() }));

      // Actualizar puntuación propia
      const miEquipo = equipos.find(e => e.id === state.equipoId);
      if (miEquipo) {
        state.puntuacion = miEquipo.puntuacion || 0;
        document.getElementById('hud-puntos').textContent = state.puntuacion;
      }

      renderMarcadorLive(equipos);
    });
}

function renderMarcadorLive(equipos) {
  const panel = document.getElementById('marcador-live');
  if (!panel) return;

  const symbols = ['🥇', '🥈', '🥉'];

  panel.innerHTML = equipos.map((eq, idx) => `
    <div class="marcador-row ${eq.id === state.equipoId ? 'my-team' : ''}">
      <span class="marcador-pos">${symbols[idx] || `#${idx+1}`}</span>
      <span class="marcador-nombre">${eq.nombre}</span>
      <span class="marcador-pts">${eq.puntuacion || 0}</span>
    </div>
  `).join('');
}

// ─── Timer ────────────────────────────────────────────────────
function startTimer(seconds) {
  stopTimer();
  let remaining = seconds;
  const el = document.getElementById('hud-timer');

  const tick = () => {
    if (!el) return;
    el.textContent = formatTime(remaining);
    el.className   = 'hud-timer timer-display';
    if (remaining <= 30) el.classList.add('warning');
    if (remaining <= 10) el.classList.add('danger');

    if (remaining <= 0) {
      stopTimer();
      return;
    }
    remaining--;
  };

  tick();
  state.timerInterval = setInterval(tick, 1000);
}

function stopTimer() {
  if (state.timerInterval) {
    clearInterval(state.timerInterval);
    state.timerInterval = null;
  }
}

// ─── Ronda Overlay ───────────────────────────────────────────
function showRondaOverlay(ganaste, ganadorEquipo, solucion) {
  const overlay   = document.getElementById('ronda-overlay');
  const icon      = document.getElementById('ronda-result-icon');
  const title     = document.getElementById('ronda-result-title');
  const msg       = document.getElementById('ronda-result-msg');
  const solBox    = document.getElementById('ronda-solucion-box');
  const solText   = document.getElementById('ronda-solucion-text');

  if (!overlay) return;

  if (ganaste) {
    icon.textContent  = '🏆';
    title.textContent = '¡VICTORIA!';
    msg.textContent   = `Tu equipo ha descifrado el mensaje. ¡Brillante trabajo!`;
  } else if (ganadorEquipo) {
    icon.textContent  = '😤';
    title.textContent = 'Ronda Finalizada';
    msg.textContent   = `El equipo "${ganadorEquipo}" ha descifrado primero el mensaje.`;
  } else {
    icon.textContent  = '⏰';
    title.textContent = 'Tiempo Agotado';
    msg.textContent   = 'Nadie descifró el mensaje a tiempo.';
  }

  if (solucion) {
    solText.textContent = solucion;
    solBox.classList.remove('hidden');
  }

  overlay.classList.remove('hidden');
}

// ─── Funciones Añadidas para RompeCódigos 2.0 ────────────────

function renderCesarSuggestionsJuego() {
  const container = document.getElementById('cesar-suggestions');
  if (!container || !state.textoCifrado) return;

  // suggestCaesarShifts está definido en cifrado.js (global)
  const suggestions = suggestCaesarShifts(state.textoCifrado);
  if (!suggestions.length) { container.innerHTML = ''; return; }

  container.innerHTML = `
    <div style="font-size:0.72rem; color:rgba(0,212,255,0.6); margin-bottom:4px;">🔍 Más probables:</div>
    ${suggestions.map(s => `
      <button class="cesar-sugg-btn" data-shift="${s.shift}"
              style="background:rgba(0,212,255,0.08); border:1px solid rgba(0,212,255,0.2);
                     color:rgba(0,212,255,0.9); font-family:'JetBrains Mono',monospace; font-size:0.72rem;
                     padding:3px 8px; border-radius:3px; cursor:pointer; margin:2px; display:block; width:100%;
                     text-align:left; transition:all 0.15s;">
        +${s.shift}: ${s.reason}
      </button>`).join('')}
  `;

  container.querySelectorAll('.cesar-sugg-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const shift = parseInt(btn.dataset.shift);
      const slider = document.getElementById('cesar-slider');
      const valEl = document.getElementById('cesar-val');
      if (slider) slider.value = shift;
      if (valEl) valEl.textContent = shift;
      actualizarCesarPreview();
    });
  });
}

const PALABRAS_CORTAS_ES_JUEGO = {
  1: ['A', 'Y', 'O'],
  2: ['DE', 'LA', 'EL', 'EN', 'UN', 'ES', 'AL', 'LO'],
  3: ['LOS', 'LAS', 'DEL', 'CON', 'UNA', 'QUE', 'POR'],
  4: ['PARA', 'COMO', 'ESTE', 'ESTA', 'PERO', 'TODO']
};

function renderPalabrasCortasJuego() {
  const container = document.getElementById('palabras-cortas-juego');
  if (!container) return;

  const words = [...new Set(
    state.textoCifrado.split(/[^A-Z]+/).filter(w => w.length >= 1 && w.length <= 4)
  )].sort((a, b) => a.length - b.length).slice(0, 8);

  if (!words.length) { container.innerHTML = ''; return; }

  container.innerHTML = `
    <div style="font-size:0.72rem; color:rgba(0,212,255,0.6); margin-bottom:6px;">🔎 Palabras cortas — ataca por aquí:</div>
    ${words.map(word => {
      const candidates = PALABRAS_CORTAS_ES_JUEGO[word.length] || [];
      return `<div style="margin-bottom:6px;">
        <span style="font-family:'JetBrains Mono',monospace; color:rgba(0,212,255,0.9); font-weight:700; font-size:0.85rem;">${word}</span>
        <span style="color:rgba(255,255,255,0.25); font-size:0.7rem;"> → </span>
        ${candidates.map(c => `<button class="word-cand-juego" data-cipher="${word}" data-plain="${c}"
                style="background:rgba(255,255,255,0.04); border:1px solid rgba(255,255,255,0.1);
                       color:rgba(255,255,255,0.7); font-size:0.7rem; padding:2px 6px;
                       border-radius:3px; cursor:pointer; margin:1px; font-family:'JetBrains Mono',monospace;">${c}</button>`).join('')}
      </div>`;
    }).join('')}
  `;

  container.querySelectorAll('.word-cand-juego').forEach(btn => {
    btn.addEventListener('click', () => {
      const cipher = btn.dataset.cipher;
      const plain  = btn.dataset.plain;
      for (let i = 0; i < cipher.length; i++) {
        const cChar = cipher[i];
        const pChar = plain[i];
        state.tablaSustitucion[cChar] = pChar;
        const input = document.querySelector(`.sust-key-input[data-source="${cChar}"]`);
        if (input) { input.value = pChar; input.classList.add('filled'); }
      }
      updatePreviewDescifrado();
      renderTextoCifrado();
      guardarSustitucionEnFirestore();
    });
  });
}

function initVigenereKnownPlaintextJuego() {
  const btn = document.getElementById('btn-known-juego');
  const input = document.getElementById('vigenere-known-juego');
  const result = document.getElementById('vigenere-known-result-juego');

  btn?.addEventListener('click', () => {
    const word = input?.value.trim().toUpperCase();
    if (!word) return;
    const results = knownPlaintextVigenere(state.textoCifrado, word);
    if (!results.length) {
      result.innerHTML = `<span style="color:rgba(255,255,255,0.3); font-size:0.72rem;">No encontrado en este texto.</span>`;
      return;
    }
    result.innerHTML = results.slice(0, 4).map(r => `
      <div style="margin-bottom:3px;">
        <span style="color:rgba(255,255,255,0.3); font-size:0.68rem;">pos ${r.position}:</span>
        <button class="vig-frag-juego" data-frag="${r.keyFragment}"
                style="font-family:'JetBrains Mono',monospace; font-size:0.82rem; color:#00ff88;
                       background:rgba(0,255,136,0.08); border:1px solid rgba(0,255,136,0.2);
                       padding:2px 8px; border-radius:3px; cursor:pointer; font-weight:700;">
          ${r.keyFragment}
        </button>
      </div>`).join('');

    result.querySelectorAll('.vig-frag-juego').forEach(b => {
      b.addEventListener('click', () => {
        const frag = b.dataset.frag;
        // Aplicar como descifrado Vigenère
        const descifrado = Vigenere.decrypt(state.textoCifrado, frag);
        // Rellenar el tablaSustitucion letra por letra desde el descifrado
        const textArr = state.textoCifrado.replace(/[^A-Z]/g,'').split('');
        const descArr = descifrado.replace(/[^A-Z]/g,'').split('');
        for (let i = 0; i < textArr.length; i++) {
          if (textArr[i] && descArr[i]) state.tablaSustitucion[textArr[i]] = descArr[i];
        }
        updatePreviewDescifrado();
        renderTextoCifrado();
        showToast(`Clave "${frag}" aplicada como Vigenère`, 'info');
        guardarSustitucionEnFirestore();
      });
    });
  });
}

function updatePuntosPreview(remaining) {
  const el = document.getElementById('puntos-preview');
  if (!el) return;
  let pts;
  if (remaining > 240) pts = 150;
  else if (remaining > 120) pts = 100;
  else if (remaining > 60) pts = 75;
  else pts = 50;
  el.textContent = `Si lo resuelves ahora: +${pts} pts`;
  el.style.color = remaining > 120 ? '#00ff88' : remaining > 60 ? '#ffcc00' : '#ff4466';
}

