// ============================================================
// practica.js — Laboratorio Criptográfico y Modo Práctica RompeCódigos
// ============================================================

import { requireAuth, currentProfile, incrementDigitalWellbeing } from '../../../../js/common/auth.js';
import { renderHeader, showToast, initParticles } from '../../../../js/common/ui.js';
import { saveGameResult, getRompePartidas } from '../../../../js/common/db.js';

// ─── Partida y Misiones Activas (Cargadas exclusivamente desde Supabase) ──────
let PARTIDAS_DATA = [];
let MISIONES = [];

const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';

// ─── Estado del Juego / Lab ──────────────────────────────────
const state = {
  user: null,
  profile: null,
  mode: 'misiones', // 'misiones' | 'sandbox'
  partidaIndex: 0,
  misionIndex: 0,
  difficulty: 'recluta',
  textoCifrado: '',
  textoOriginal: '',
  tablaSustitucion: {}, // { cifrado -> descifrado }
  puntuacionTotal: 0,
  tiempoInicio: null,
  timerInterval: null,
  pistasUsadas: 0,
  frecChart: null,
  misionesCompletadas: new Set(),
  partidasCompletadas: new Set(),
  historialIntentos: []
};

// ─── Inicialización ──────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  initParticles('particles-canvas', '#00e5ff', '#ff3366');

  requireAuth({
    allowedRoles: ['teacher', 'student'],
    onAuthorized: async (user, profile) => {
      if (profile.role === 'student') {
        const allowed = await incrementDigitalWellbeing(user.id, 'game', 'rompecodigos');
        if (!allowed) return;
      }
      state.user = user;
      state.profile = profile;
      renderHeader(user, profile);
      await initApp();
    }
  });
});

async function initApp() {
  buildSustKeyboard();
  initCesarSlider();
  initVigenereHandler();
  initVigenereKnownPlaintext();
  initSubmitHandler();
  initDemosModal();
  initModeSwitcher();
  initSandboxHandlers();
  
  await cargarPartidasDesdeSupabase();

  const initialPartidaIdx = initPartidasSelector() || 0;
  cargarPartida(initialPartidaIdx);

  const diffSelect = document.getElementById('difficulty-select');
  if (diffSelect) {
    const savedDiff = localStorage.getItem('rompecodigos_difficulty');
    if (savedDiff && ['recluta', 'agente', 'maestro'].includes(savedDiff)) {
      diffSelect.value = savedDiff;
      state.difficulty = savedDiff;
    } else {
      state.difficulty = diffSelect.value || 'recluta';
    }
    diffSelect.addEventListener('change', (e) => {
      state.difficulty = e.target.value;
      localStorage.setItem('rompecodigos_difficulty', state.difficulty);
      cargarMision(state.misionIndex);
      const diffName = diffSelect.options[diffSelect.selectedIndex]?.text || state.difficulty;
      showToast(`Dificultad: ${diffName}`, 'info');
    });
  }
}

async function cargarPartidasDesdeSupabase() {
  const select = document.getElementById('partida-select');
  if (select) {
    select.innerHTML = '<option>Cargando operaciones desde Supabase...</option>';
    select.disabled = true;
  }

  try {
    const dbPartidas = await getRompePartidas();
    if (dbPartidas && Array.isArray(dbPartidas) && dbPartidas.length > 0) {
      PARTIDAS_DATA = dbPartidas.map(p => ({
        id: p.numero,
        nombre: p.nombre,
        descripcion: p.descripcion,
        clave_vigenere_1: p.clave_vigenere_1,
        clave_vigenere_2: p.clave_vigenere_2,
        misiones: Array.isArray(p.misiones) ? p.misiones : JSON.parse(p.misiones || '[]')
      }));
      console.log(`[RompeCódigos] ${PARTIDAS_DATA.length} operaciones cargadas exclusivamente desde Supabase.`);
    } else {
      PARTIDAS_DATA = [];
      showToast('No se encontraron partidas en la base de datos Supabase', 'error');
      console.error('[RompeCódigos] Error: La base de datos no devolvió partidas de rompecodigos_partidas.');
    }
  } catch (err) {
    PARTIDAS_DATA = [];
    showToast('Error al conectar con la base de datos Supabase', 'error');
    console.error('[RompeCódigos] Error cargando partidas desde Supabase:', err);
  } finally {
    if (select) select.disabled = false;
  }
}

// ─── Gestión de Partidas / Operaciones ────────────────────────
function initPartidasSelector() {
  const select = document.getElementById('partida-select');
  if (!select) return 0;

  // Cargar partidas completadas guardadas
  try {
    const compStored = localStorage.getItem('rompecodigos_partidas_completadas');
    if (compStored) {
      const arr = JSON.parse(compStored);
      if (Array.isArray(arr)) {
        arr.forEach(id => state.partidasCompletadas.add(id));
      }
    }
  } catch (e) {}

  renderPartidasSelectOptions();

  if (!PARTIDAS_DATA || PARTIDAS_DATA.length === 0) {
    select.disabled = true;
    return 0;
  }
  select.disabled = false;

  // Cargar índice de partida guardado
  let savedIdx = 0;
  try {
    const stored = localStorage.getItem('rompecodigos_partida_idx');
    if (stored !== null) savedIdx = parseInt(stored, 10) || 0;
  } catch (e) {}
  if (savedIdx < 0 || savedIdx >= PARTIDAS_DATA.length) savedIdx = 0;
  select.value = savedIdx.toString();

  select.addEventListener('change', e => {
    const newIdx = parseInt(e.target.value, 10);
    cargarPartida(newIdx);
  });

  const btnRandom = document.getElementById('btn-partida-aleatoria');
  btnRandom?.addEventListener('click', () => {
    if (!PARTIDAS_DATA || PARTIDAS_DATA.length === 0) return;
    const available = [];
    for (let i = 0; i < PARTIDAS_DATA.length; i++) {
      if (i !== state.partidaIndex) available.push(i);
    }
    const randomIdx = available.length > 0 ? available[Math.floor(Math.random() * available.length)] : 0;
    select.value = randomIdx.toString();
    cargarPartida(randomIdx);
    showToast(`🎲 ¡Cargada ${PARTIDAS_DATA[randomIdx]?.nombre}!`, 'info');
  });

  const btnNextPartida = document.getElementById('btn-siguiente-partida');
  btnNextPartida?.addEventListener('click', () => {
    if (!PARTIDAS_DATA || PARTIDAS_DATA.length === 0) return;
    const modalFinal = document.getElementById('modal-resumen-final');
    if (modalFinal) modalFinal.classList.add('hidden');
    const nextIdx = (state.partidaIndex + 1) % PARTIDAS_DATA.length;
    select.value = nextIdx.toString();
    cargarPartida(nextIdx);
    showToast(`▶ Iniciando ${PARTIDAS_DATA[nextIdx]?.nombre}`, 'success');
  });

  return savedIdx;
}

function renderPartidasSelectOptions() {
  const select = document.getElementById('partida-select');
  if (!select) return;
  if (!PARTIDAS_DATA || PARTIDAS_DATA.length === 0) {
    select.innerHTML = '<option value="">⚠️ Sin partidas en Supabase</option>';
    return;
  }
  select.innerHTML = PARTIDAS_DATA.map((p, idx) => {
    const done = state.partidasCompletadas.has(idx);
    return `<option value="${idx}">${done ? '✓ ' : ''}${idx + 1}. ${p.nombre}</option>`;
  }).join('');
}

function actualizarHeaderPartida() {
  const partida = PARTIDAS_DATA[state.partidaIndex];
  const tag = document.getElementById('partida-active-tag');
  const desc = document.getElementById('partida-desc-small');
  const select = document.getElementById('partida-select');

  if (!partida) {
    if (tag) tag.textContent = 'Sin Operación';
    if (desc) desc.textContent = 'No hay partidas cargadas desde Supabase';
    return;
  }
  if (tag) tag.textContent = `Operación ${partida.id}`;
  if (desc) desc.textContent = partida.descripcion;
  if (select && select.value !== state.partidaIndex.toString()) {
    select.value = state.partidaIndex.toString();
  }
}

function cargarPartida(idx) {
  if (!PARTIDAS_DATA || PARTIDAS_DATA.length === 0) {
    actualizarHeaderPartida();
    renderMisionesNav();
    const tituloEl = document.getElementById('mision-title');
    const descEl = document.getElementById('mision-desc');
    if (tituloEl) tituloEl.textContent = 'Sin operaciones disponibles';
    if (descEl) descEl.textContent = 'No se han podido cargar las partidas desde la base de datos de Supabase. Asegúrate de ejecutar el script seed_rompecodigos_partidas.sql en el SQL Editor de Supabase.';
    return;
  }
  if (idx < 0 || idx >= PARTIDAS_DATA.length) idx = 0;
  state.partidaIndex = idx;
  MISIONES = PARTIDAS_DATA[idx]?.misiones || [];
  state.misionesCompletadas.clear();
  try {
    localStorage.setItem('rompecodigos_partida_idx', idx.toString());
  } catch (e) {}
  actualizarHeaderPartida();
  renderMisionesNav();
  if (MISIONES.length > 0) {
    cargarMision(0);
  }
}

// ─── Selector de Modo (Misiones vs Sandbox) ───────────────────
function initModeSwitcher() {
  const btnMisiones = document.getElementById('btn-mode-misiones');
  const btnSandbox = document.getElementById('btn-mode-sandbox');
  const secMisionInfo = document.getElementById('section-mision-info');
  const secSandboxInput = document.getElementById('section-sandbox-input');
  const secPistas = document.getElementById('pistas-section');
  const secMisionesNav = document.getElementById('section-misiones-nav');
  const hudMisionWrap = document.getElementById('hud-mision-wrap');

  btnMisiones?.addEventListener('click', () => {
    state.mode = 'misiones';
    btnMisiones.classList.add('active');
    btnSandbox.classList.remove('active');
    secMisionInfo.classList.remove('hidden');
    secSandboxInput.classList.add('hidden');
    secPistas.classList.remove('hidden');
    secMisionesNav.classList.remove('hidden');
    hudMisionWrap.classList.remove('hidden');
    cargarMision(state.misionIndex);
  });

  btnSandbox?.addEventListener('click', () => {
    state.mode = 'sandbox';
    btnSandbox.classList.add('active');
    btnMisiones.classList.remove('active');
    secMisionInfo.classList.add('hidden');
    secSandboxInput.classList.remove('hidden');
    secPistas.classList.add('hidden');
    secMisionesNav.classList.add('hidden');
    hudMisionWrap.classList.add('hidden');

    const sandboxInput = document.getElementById('sandbox-input-text');
    if (!sandboxInput.value) {
      sandboxInput.value = Caesar.encrypt('ESTE ES UN MENSAJE DE PRUEBA EN EL LABORATORIO CRIPTOGRAFICO', 4);
    }
    aplicarTextoCifradoCustom(sandboxInput.value);
  });
}

// ─── Handlers del Sandbox ─────────────────────────────────────
function initSandboxHandlers() {
  const input = document.getElementById('sandbox-input-text');
  const btnDetectar = document.getElementById('btn-detectar-cifrado');
  const btnEjemplo = document.getElementById('btn-ejemplo-sandbox');
  const detectionResult = document.getElementById('sandbox-detection-result');

  input?.addEventListener('input', e => {
    aplicarTextoCifradoCustom(e.target.value);
  });

  btnEjemplo?.addEventListener('click', () => {
    const ejemplos = [
      { text: Caesar.encrypt('LA COMUNICACION CUANTICA ES EL FUTURO DE LA CIBERSEGURIDAD', 5), tipo: 'César' },
      { text: Vigenere.encrypt('DEFENSA CIBERNETICA ACTIVA CONTRA AMENAZAS DIGITALES', 'ESCUDO'), tipo: 'Vigenère' },
      { text: Caesar.encrypt('EL PROTOCOLO DE SEGURIDAD HA SIDO VALIDADO', 13), tipo: 'ROT13' }
    ];
    const elegido = ejemplos[Math.floor(Math.random() * ejemplos.length)];
    if (input) {
      input.value = elegido.text;
      aplicarTextoCifradoCustom(elegido.text);
      showToast(`Ejemplo cargado: Cifrado ${elegido.tipo}`, 'info');
    }
  });

  btnDetectar?.addEventListener('click', () => {
    const text = input ? input.value.trim() : '';
    if (!text) {
      showToast('Escribe o pega un texto para analizar', 'warning');
      return;
    }

    const ioc = calculateIndexOfCoincidence(text);
    let dictamen = '';

    if (ioc >= 0.065) {
      dictamen = `🔍 <strong>Alta probabilidad de Cifrado Monoalfabético (César o Sustitución simple)</strong>.<br>
                  • Índice de Coincidencia (IoC): <code>${ioc.toFixed(3)}</code> (similar al español ~0.074).<br>
                  • Recomendación: Prueba el slider César o haz clic en "⚡ Fuerza Bruta".`;
    } else if (ioc >= 0.048) {
      dictamen = `🔍 <strong>Probable Sustitución con baja redundancia o clave Vigenère corta</strong>.<br>
                  • Índice de Coincidencia (IoC): <code>${ioc.toFixed(3)}</code>.<br>
                  • Recomendación: Utiliza el análisis de frecuencias y sugiere sustituciones.`;
    } else {
      dictamen = `🛡️ <strong>Alta probabilidad de Cifrado Polialfabético (Vigenère) o Transposición</strong>.<br>
                  • Índice de Coincidencia (IoC): <code>${ioc.toFixed(3)}</code> (letras distribuidas uniformemente).<br>
                  • Recomendación: Introduce posibles claves en la herramienta Vigenère.`;
    }

    if (detectionResult) {
      detectionResult.innerHTML = dictamen;
      detectionResult.classList.remove('hidden');
    }
  });
}

function calculateIndexOfCoincidence(text) {
  const clean = text.toUpperCase().replace(/[^A-Z]/g, '');
  const N = clean.length;
  if (N <= 1) return 0;

  const counts = {};
  for (const ch of clean) {
    counts[ch] = (counts[ch] || 0) + 1;
  }

  let sum = 0;
  for (const count of Object.values(counts)) {
    sum += count * (count - 1);
  }

  return sum / (N * (N - 1));
}

function aplicarTextoCifradoCustom(texto) {
  state.textoCifrado = texto.toUpperCase();
  state.textoOriginal = ''; // En sandbox no hay solución fija
  state.tablaSustitucion = {};
  resetSustInputs();
  renderTextoCifrado();
  renderTextoDescifrado();
  updateFrequencyChart();
  generarFuerzaBrutaCesar();
}

// ─── Modal de Demos Interactivas ──────────────────────────────
function initDemosModal() {
  const modal = document.getElementById('modal-demos');
  const btnOpen = document.getElementById('btn-open-demos');
  const btnClose = document.getElementById('btn-close-demos');
  const btnVerDemoMision = document.getElementById('btn-ver-demo-mision');

  btnOpen?.addEventListener('click', () => {
    modal.classList.remove('hidden');
    renderAllDemos();
  });

  btnClose?.addEventListener('click', () => {
    modal.classList.add('hidden');
  });

  btnVerDemoMision?.addEventListener('click', () => {
    const mision = MISIONES[state.misionIndex];
    if (mision && mision.demoTab) {
      modal.classList.remove('hidden');
      switchDemoTab(mision.demoTab);
      renderAllDemos();
    }
  });

  // Tab switching inside demo modal
  document.querySelectorAll('.demo-tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      switchDemoTab(btn.dataset.tab);
    });
  });

  // Live Demo César controls
  const demoCesarInput = document.getElementById('demo-cesar-input');
  const demoCesarSlider = document.getElementById('demo-cesar-slider');
  demoCesarInput?.addEventListener('input', renderDemoCesar);
  demoCesarSlider?.addEventListener('input', renderDemoCesar);

  // Live Demo Frecuencias controls
  const demoFreqInput = document.getElementById('demo-freq-input');
  demoFreqInput?.addEventListener('input', renderDemoFrecuencias);

  // Live Demo Vigenère controls
  const demoVigMsg = document.getElementById('demo-vig-msg');
  const demoVigKey = document.getElementById('demo-vig-key');
  demoVigMsg?.addEventListener('input', renderDemoVigenere);
  demoVigKey?.addEventListener('input', renderDemoVigenere);

  // Live Demo Transposición controls
  const demoTransInput = document.getElementById('demo-trans-input');
  demoTransInput?.addEventListener('input', renderDemoTransposicion);
}

function renderAllDemos() {
  renderDemoCesar();
  renderDemoFrecuencias();
  renderDemoVigenere();
  renderDemoTransposicion();
}

function switchDemoTab(tabId) {
  // Normalize target id (e.g. 'demo-cesar' vs 'demo-tab-cesar')
  const cleanId = tabId.replace(/^demo-tab-/, 'demo-');

  document.querySelectorAll('.demo-tab-btn').forEach(b => {
    const bTab = b.dataset.tab ? b.dataset.tab.replace(/^demo-tab-/, 'demo-') : '';
    b.classList.toggle('active', bTab === cleanId);
  });

  document.querySelectorAll('.demo-tab-content').forEach(content => {
    content.classList.add('hidden');
  });

  const activeContent = document.getElementById(cleanId) 
    || document.getElementById(`demo-tab-${cleanId.replace(/^demo-/, '')}`)
    || document.getElementById(tabId);

  if (activeContent) {
    activeContent.classList.remove('hidden');
  }

  // Refresh active tab
  if (cleanId.includes('cesar')) renderDemoCesar();
  else if (cleanId.includes('frecuencia')) renderDemoFrecuencias();
  else if (cleanId.includes('vigenere')) renderDemoVigenere();
  else if (cleanId.includes('transposicion')) renderDemoTransposicion();
}

function renderDemoCesar() {
  const inputEl = document.getElementById('demo-cesar-input');
  const sliderEl = document.getElementById('demo-cesar-slider');
  const shiftValEl = document.getElementById('demo-cesar-shift-val');
  const mapEl = document.getElementById('demo-cesar-map');
  const outputEl = document.getElementById('demo-cesar-output');
  const ribbonEl = document.getElementById('demo-cesar-ribbon');

  const text = inputEl ? inputEl.value.toUpperCase() : 'HOLA';
  const shift = sliderEl ? parseInt(sliderEl.value, 10) : 3;

  if (shiftValEl) shiftValEl.textContent = shift;
  if (mapEl) mapEl.textContent = ALPHABET[(0 + shift) % 26];

  const encrypted = Caesar.encrypt(text, shift);
  if (outputEl) outputEl.textContent = encrypted;

  if (ribbonEl) {
    ribbonEl.innerHTML = '';
    ALPHABET.split('').forEach((ch, idx) => {
      const token = document.createElement('div');
      token.className = 'alphabet-token';
      const shiftedCh = ALPHABET[(idx + shift) % 26];
      token.innerHTML = `<span style="font-weight:bold; color:#00e5ff;">${ch}</span><span class="sub">${shiftedCh}</span>`;
      ribbonEl.appendChild(token);
    });
  }
}

function renderDemoFrecuencias() {
  const inputEl = document.getElementById('demo-freq-input');
  const statsEl = document.getElementById('demo-freq-stats');
  if (!statsEl) return;

  const text = inputEl ? inputEl.value.toUpperCase().replace(/[^A-Z]/g, '') : '';
  if (!text) {
    statsEl.innerHTML = '<span class="text-muted" style="font-size:0.8rem;">Escribe texto arriba para calcular frecuencias.</span>';
    return;
  }

  const counts = {};
  for (const ch of text) {
    counts[ch] = (counts[ch] || 0) + 1;
  }

  const sorted = Object.entries(counts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8);

  statsEl.innerHTML = '';
  sorted.forEach(([ch, count]) => {
    const pct = ((count / text.length) * 100).toFixed(1);
    const espPct = (FrequencyAnalyzer.SPANISH_FREQS[ch] || 0).toFixed(1);
    const badge = document.createElement('div');
    badge.className = 'vigenere-pair';
    badge.innerHTML = `
      <span class="orig">${ch}</span>
      <span class="ciph" style="font-size:0.8rem;">${count}x (${pct}%)</span>
      <span class="key" style="font-size:0.68rem;">Esp: ${espPct}%</span>
    `;
    statsEl.appendChild(badge);
  });
}

function renderDemoVigenere() {
  const msgEl = document.getElementById('demo-vig-msg');
  const keyEl = document.getElementById('demo-vig-key');
  const pairsEl = document.getElementById('demo-vig-pairs');
  const outputEl = document.getElementById('demo-vig-output');

  const msg = msgEl ? msgEl.value.toUpperCase().replace(/[^A-Z ]/g, '') : 'ATAQUE';
  const key = keyEl ? keyEl.value.toUpperCase().replace(/[^A-Z]/g, '') || 'SOL' : 'SOL';

  const encrypted = Vigenere.encrypt(msg, key);
  if (outputEl) outputEl.textContent = encrypted;

  if (pairsEl) {
    pairsEl.innerHTML = '';
    let keyIdx = 0;
    msg.split('').forEach(ch => {
      if (ALPHABET.includes(ch)) {
        const kChar = key[keyIdx % key.length];
        const shift = ALPHABET.indexOf(kChar);
        const cChar = ALPHABET[(ALPHABET.indexOf(ch) + shift) % 26];
        keyIdx++;

        const pair = document.createElement('div');
        pair.className = 'vigenere-pair';
        pair.innerHTML = `
          <span class="orig">${ch}</span>
          <span class="key">+${kChar}(${shift})</span>
          <span class="ciph">${cChar}</span>
        `;
        pairsEl.appendChild(pair);
      }
    });
  }
}

function renderDemoTransposicion() {
  const inputEl = document.getElementById('demo-trans-input');
  const revEl = document.getElementById('demo-trans-rev');
  const colEl = document.getElementById('demo-trans-col');

  const text = inputEl ? inputEl.value.toUpperCase() : 'CODIGO';
  if (revEl) revEl.textContent = text.split('').reverse().join('');

  // Columnar pares e impares
  const pares = text.split('').filter((_, i) => i % 2 === 0).join('');
  const impares = text.split('').filter((_, i) => i % 2 !== 0).join('');
  if (colEl) colEl.textContent = `${pares} | ${impares}`;
}

// ─── Renderizar navegación de misiones ────────────────────────
function renderMisionesNav() {
  const container = document.getElementById('misiones-nav');
  if (!container) return;
  container.innerHTML = '';

  if (!MISIONES || MISIONES.length === 0) {
    container.innerHTML = '<span style="font-size:0.8rem; color:var(--text-dim); padding:4px 8px;">Sin misiones disponibles</span>';
    return;
  }

  MISIONES.forEach((m, idx) => {
    const btn = document.createElement('button');
    btn.className = `mission-pill ${idx === state.misionIndex ? 'active' : ''} ${state.misionesCompletadas.has(idx) ? 'completed' : ''}`;
    btn.innerHTML = `${state.misionesCompletadas.has(idx) ? '✓ ' : ''}Misión ${idx + 1}`;
    btn.addEventListener('click', () => {
      cargarMision(idx);
    });
    container.appendChild(btn);
  });
}

// ─── Cargar Misión ───────────────────────────────────────────
function cargarMision(idx) {
  if (!MISIONES || MISIONES.length === 0 || !MISIONES[idx]) {
    return;
  }
  state.misionIndex = idx;
  const mision = MISIONES[idx];
  state.textoOriginal = mision.textoOriginal;
  state.tablaSustitucion = {};
  state.pistasUsadas = 0;
  state.historialIntentos = [];

  // Generar texto cifrado
  if (mision.tipo === 'caesar') {
    state.textoCifrado = Caesar.encrypt(mision.textoOriginal, mision.shift);
  } else if (mision.tipo === 'vigenere') {
    state.textoCifrado = Vigenere.encrypt(mision.textoOriginal, mision.key);
  } else if (mision.tipo === 'substitution') {
    state.textoCifrado = mision.textoOriginal.split('').map(ch => {
      const upper = ch.toUpperCase();
      return mision.substMap[upper] || ch;
    }).join('');
  }

  // Actualizar HUD e info de misión
  document.getElementById('hud-mision').textContent = `${idx + 1} / ${MISIONES.length}`;
  document.getElementById('mision-title').textContent = mision.titulo;
  document.getElementById('mision-tipo').textContent = mision.tipoBadge;
  document.getElementById('mision-desc').textContent = mision.descripcion;
  document.getElementById('hud-pistas-left').textContent = mision.pistas.length - state.pistasUsadas;

  // En nivel Maestro, ocultar el tipo de cifrado
  const tipoEl = document.getElementById('mision-tipo');
  const difficultySelect = document.getElementById('difficulty-select');
  state.difficulty = difficultySelect ? difficultySelect.value : 'recluta';
  if (tipoEl) {
    tipoEl.style.visibility = state.difficulty === 'maestro' ? 'hidden' : 'visible';
  }

  // Reset de controles
  const cesarSlider = document.getElementById('cesar-slider');
  if (cesarSlider) {
    cesarSlider.value = 0;
    updateCesarValue(0);
  }
  const vigenereKeyInput = document.getElementById('vigenere-key-input');
  if (vigenereKeyInput) vigenereKeyInput.value = '';
  const vigenereKnownWord = document.getElementById('vigenere-known-word');
  if (vigenereKnownWord) vigenereKnownWord.value = '';
  const vigenereKnownResult = document.getElementById('vigenere-known-result');
  if (vigenereKnownResult) vigenereKnownResult.innerHTML = '';

  // Dossier de pistas previas para misiones Vigenère
  const vigenereDossier = document.getElementById('vigenere-intel-dossier');
  const vigenereClues = document.getElementById('vigenere-intel-clues');
  if (mision.tipo === 'vigenere' && mision.pistasPrevias && mision.pistasPrevias.length > 0) {
    if (vigenereClues) {
      vigenereClues.innerHTML = mision.pistasPrevias.map(p => `
        <div style="padding:4px 8px; background:rgba(0,0,0,0.25); border-radius:4px; border-left:3px solid var(--accent); margin-bottom:2px;">
          ${p}
        </div>
      `).join('');
    }
    if (vigenereDossier) vigenereDossier.classList.remove('hidden');
  } else {
    if (vigenereDossier) vigenereDossier.classList.add('hidden');
  }

  resetSustInputs();

  // En modos accesibles (Recluta: 3 letras frecuentes, Agente: 1 letra), precargar letras como ayuda
  if (mision.tipo === 'substitution' && mision.substMap) {
    const numLetrasAyuda = state.difficulty === 'recluta' ? 3 : (state.difficulty === 'agente' ? 1 : 0);
    if (numLetrasAyuda > 0) {
      const charCounts = {};
      for (const ch of mision.textoOriginal.toUpperCase()) {
        if (ALPHABET.includes(ch)) {
          charCounts[ch] = (charCounts[ch] || 0) + 1;
        }
      }
      const sortedPlainChars = Object.keys(charCounts).sort((a, b) => charCounts[b] - charCounts[a]);
      let aplicadas = 0;
      for (const pChar of sortedPlainChars) {
        if (aplicadas >= numLetrasAyuda) break;
        const cChar = mision.substMap[pChar];
        if (cChar) {
          state.tablaSustitucion[cChar] = pChar;
          const input = document.querySelector(`.sust-key-input[data-char="${cChar}"]`);
          if (input) {
            input.value = pChar;
            input.classList.add('filled');
          }
          aplicadas++;
        }
      }
    }
  }
  renderTextoCifrado();
  renderTextoDescifrado();
  renderPistas();
  renderHistorial();
  updateFrequencyChart();
  renderMisionesNav();
  generarFuerzaBrutaCesar();
  renderCesarSuggestions();
  renderPalabrasCortas();

  // Iniciar timer
  startTimer();

  // Limpiar campo de solución
  const inputSolucion = document.getElementById('input-solucion');
  if (inputSolucion) inputSolucion.value = '';
  const feedback = document.getElementById('submit-feedback');
  if (feedback) feedback.className = 'submit-feedback hidden';
}

// ─── Renderizar Texto Cifrado ─────────────────────────────────
function renderTextoCifrado() {
  const container = document.getElementById('texto-cifrado');
  if (!container) return;
  container.innerHTML = '';

  state.textoCifrado.split('').forEach(ch => {
    const span = document.createElement('span');
    if (ALPHABET.includes(ch)) {
      span.className = 'char-token letter';
      span.textContent = ch;
      if (state.tablaSustitucion[ch]) {
        span.classList.add('mapped');
      }
      span.addEventListener('click', () => {
        focusSustKey(ch);
      });
    } else if (ch === ' ') {
      span.className = 'char-token space';
      span.innerHTML = '&nbsp;';
    } else {
      span.className = 'char-token';
      span.textContent = ch;
    }
    container.appendChild(span);
  });
}

// ─── Renderizar Texto Descifrado ──────────────────────────────
function renderTextoDescifrado() {
  const container = document.getElementById('texto-descifrado');
  if (!container) return;

  const descifrado = applySubstitution(state.textoCifrado, state.tablaSustitucion);
  container.textContent = descifrado || '— escribe sustituciones para ver el preview';
}

// ─── Teclado de Sustitución ───────────────────────────────────
function buildSustKeyboard() {
  const container = document.getElementById('sust-keyboard');
  if (!container) return;
  container.innerHTML = '';

  ALPHABET.split('').forEach(ch => {
    const keyWrap = document.createElement('div');
    keyWrap.className = 'sust-key';

    const label = document.createElement('div');
    label.className = 'sust-key-label';
    label.textContent = ch;

    const input = document.createElement('input');
    input.type = 'text';
    input.maxLength = 1;
    input.className = 'sust-key-input';
    input.dataset.char = ch;
    input.autocomplete = 'off';
    input.spellcheck = false;

    input.addEventListener('input', e => {
      const val = e.target.value.toUpperCase().replace(/[^A-Z]/g, '');
      e.target.value = val;

      if (val) {
        state.tablaSustitucion[ch] = val;
        e.target.classList.add('filled');
      } else {
        delete state.tablaSustitucion[ch];
        e.target.classList.remove('filled');
      }

      renderTextoCifrado();
      renderTextoDescifrado();
      if (MISIONES[state.misionIndex]?.tipo === 'substitution') {
        renderPalabrasCortas();
      }
    });

    keyWrap.appendChild(label);
    keyWrap.appendChild(input);
    container.appendChild(keyWrap);
  });

  const btnReset = document.getElementById('btn-reset-sust');
  if (btnReset) {
    btnReset.addEventListener('click', () => {
      state.tablaSustitucion = {};
      resetSustInputs();
      renderTextoCifrado();
      renderTextoDescifrado();
      if (MISIONES[state.misionIndex]?.tipo === 'substitution') {
        renderPalabrasCortas();
      }
      showToast('Sustituciones limpiadas', 'info');
    });
  }

  const btnRevelar = document.getElementById('btn-revelar-letra');
  if (btnRevelar) {
    btnRevelar.addEventListener('click', () => {
      revelarLetraAyuda();
    });
  }

  const btnSugerir = document.getElementById('btn-sugerir');
  if (btnSugerir) {
    btnSugerir.addEventListener('click', () => {
      const mision = MISIONES[state.misionIndex];
      if (mision && mision.tipo === 'substitution' && mision.substMap) {
        // En misiones guiadas de sustitución, sugerir vocales y letras clave frecuentes
        // sin sobrescribir las letras que el usuario ya haya colocado
        const frecuentesEsp = ['E', 'A', 'O', 'S', 'R', 'N', 'I', 'D', 'L'];
        let aplicadas = 0;
        for (const plain of frecuentesEsp) {
          const cipher = mision.substMap[plain];
          if (cipher && !state.tablaSustitucion[cipher]) {
            state.tablaSustitucion[cipher] = plain;
            aplicadas++;
            if (aplicadas >= 3) break;
          }
        }

        document.querySelectorAll('.sust-key-input').forEach(input => {
          const ch = input.dataset.char;
          if (state.tablaSustitucion[ch]) {
            input.value = state.tablaSustitucion[ch];
            input.classList.add('filled');
          }
        });

        renderTextoCifrado();
        renderTextoDescifrado();
        renderPalabrasCortas();
        showToast(aplicadas > 0 ? 'Sugerencias de frecuencias aplicadas' : 'No hay más sugerencias pendientes', 'success');
      } else {
        const sugerencias = FrequencyAnalyzer.suggestSubstitutions(state.textoCifrado);
        state.tablaSustitucion = { ...state.tablaSustitucion, ...sugerencias };

        document.querySelectorAll('.sust-key-input').forEach(input => {
          const ch = input.dataset.char;
          if (state.tablaSustitucion[ch]) {
            input.value = state.tablaSustitucion[ch];
            input.classList.add('filled');
          }
        });

        renderTextoCifrado();
        renderTextoDescifrado();
        if (MISIONES[state.misionIndex]?.tipo === 'substitution') {
          renderPalabrasCortas();
        }
        showToast('Sugerencia de frecuencias aplicada', 'success');
      }
    });
  }
}

function revelarLetraAyuda() {
  const mision = MISIONES[state.misionIndex];
  if (!mision) return;

  if (mision.tipo === 'substitution' && mision.substMap) {
    // Buscar letras del texto original que aún no estén en state.tablaSustitucion o estén incorrectas
    const charCounts = {};
    for (const ch of mision.textoOriginal.toUpperCase()) {
      if (ALPHABET.includes(ch)) {
        charCounts[ch] = (charCounts[ch] || 0) + 1;
      }
    }
    const sortedPlainChars = Object.keys(charCounts).sort((a, b) => charCounts[b] - charCounts[a]);

    let revealed = null;
    for (const pChar of sortedPlainChars) {
      const cChar = mision.substMap[pChar];
      if (cChar && state.tablaSustitucion[cChar] !== pChar) {
        state.tablaSustitucion[cChar] = pChar;
        const input = document.querySelector(`.sust-key-input[data-char="${cChar}"]`);
        if (input) {
          input.value = pChar;
          input.classList.add('filled');
        }
        revealed = { cipher: cChar, plain: pChar };
        break;
      }
    }

    if (revealed) {
      renderTextoCifrado();
      renderTextoDescifrado();
      renderPalabrasCortas();
      showToast(`Letra revelada: ${revealed.cipher} = ${revealed.plain}`, 'success');
    } else {
      showToast('¡Todas las letras del mensaje ya están descifradas!', 'info');
    }
  } else if (mision.tipo === 'caesar') {
    const slider = document.getElementById('cesar-slider');
    if (slider) {
      slider.value = mision.shift;
      updateCesarValue(mision.shift);
      applyCesarShift(mision.shift);
    }
    showToast(`Desplazamiento César revelado: +${mision.shift}`, 'success');
  } else if (mision.tipo === 'vigenere') {
    const inputKey = document.getElementById('vigenere-key-input');
    if (inputKey) {
      inputKey.value = mision.key;
    }
    const descifrado = Vigenere.decrypt(state.textoCifrado, mision.key);
    const descContainer = document.getElementById('texto-descifrado');
    if (descContainer) descContainer.textContent = descifrado;
    showToast(`Clave Vigenère revelada: "${mision.key}"`, 'success');
  } else {
    showToast('En el modo libre puedes experimentar con tus propios textos', 'info');
  }
}

function focusSustKey(char) {
  const input = document.querySelector(`.sust-key-input[data-char="${char}"]`);
  if (input) {
    input.focus();
    input.select();
  }
}

function resetSustInputs() {
  document.querySelectorAll('.sust-key-input').forEach(input => {
    input.value = '';
    input.classList.remove('filled');
  });
}

// ─── Slider César & Escáner Fuerza Bruta ───────────────────────
function initCesarSlider() {
  const slider = document.getElementById('cesar-slider');
  const btnReset = document.getElementById('btn-reset-cesar');
  const btnToggleBrute = document.getElementById('btn-toggle-bruteforce');
  const bruteWrap = document.getElementById('cesar-bruteforce-wrap');

  if (slider) {
    slider.addEventListener('input', e => {
      const shift = parseInt(e.target.value, 10);
      updateCesarValue(shift);
      applyCesarShift(shift);
    });
  }

  if (btnReset) {
    btnReset.addEventListener('click', () => {
      if (slider) slider.value = 0;
      updateCesarValue(0);
      applyCesarShift(0);
    });
  }

  if (btnToggleBrute && bruteWrap) {
    btnToggleBrute.addEventListener('click', () => {
      bruteWrap.classList.toggle('hidden');
    });
  }
}

function updateCesarValue(shift) {
  const valEl = document.getElementById('cesar-val');
  const mapEl = document.getElementById('cesar-char-map');
  if (valEl) valEl.textContent = shift;
  if (mapEl) {
    const targetIdx = (0 + shift) % 26;
    mapEl.textContent = ALPHABET[targetIdx];
  }
}

function applyCesarShift(shift) {
  ALPHABET.split('').forEach((ch, idx) => {
    if (shift === 0) {
      delete state.tablaSustitucion[ch];
    } else {
      const descIdx = ((idx - shift) + 26) % 26;
      state.tablaSustitucion[ch] = ALPHABET[descIdx];
    }
  });

  document.querySelectorAll('.sust-key-input').forEach(input => {
    const ch = input.dataset.char;
    if (state.tablaSustitucion[ch]) {
      input.value = state.tablaSustitucion[ch];
      input.classList.add('filled');
    } else {
      input.value = '';
      input.classList.remove('filled');
    }
  });

  const preview = Caesar.decrypt(state.textoCifrado, shift);
  const cesarPreviewEl = document.getElementById('cesar-preview');
  if (cesarPreviewEl) cesarPreviewEl.textContent = preview;

  renderTextoCifrado();
  renderTextoDescifrado();
}

function generarFuerzaBrutaCesar() {
  const list = document.getElementById('cesar-bruteforce-list');
  if (!list) return;
  list.innerHTML = '';

  const shifts = Caesar.bruteForce(state.textoCifrado);
  shifts.forEach(item => {
    const row = document.createElement('div');
    row.className = 'bruteforce-row';
    row.innerHTML = `
      <span class="bruteforce-shift">Shift +${item.shift}:</span>
      <span class="bruteforce-text">${item.text}</span>
    `;
    row.addEventListener('click', () => {
      const slider = document.getElementById('cesar-slider');
      if (slider) slider.value = item.shift;
      updateCesarValue(item.shift);
      applyCesarShift(item.shift);
      showToast(`Desplazamiento +${item.shift} seleccionado`, 'info');
    });
    list.appendChild(row);
  });
}

// ─── Herramienta Vigenère ─────────────────────────────────────
function initVigenereHandler() {
  const btnAplicar = document.getElementById('btn-aplicar-vigenere');
  const inputKey = document.getElementById('vigenere-key-input');

  if (btnAplicar && inputKey) {
    btnAplicar.addEventListener('click', () => {
      const key = inputKey.value.trim().toUpperCase();
      if (!key) {
        showToast('Introduce una clave para descifrar con Vigenère', 'error');
        return;
      }
      const descifrado = Vigenere.decrypt(state.textoCifrado, key);
      const descContainer = document.getElementById('texto-descifrado');
      if (descContainer) descContainer.textContent = descifrado;
      showToast(`Clave "${key}" aplicada a la vista previa`, 'info');
    });
  }
}

// ─── Gráfico de Frecuencias (Chart.js) ─────────────────────────
function updateFrequencyChart() {
  const ctx = document.getElementById('freq-chart')?.getContext('2d');
  if (!ctx) return;

  const cipherFreqs = FrequencyAnalyzer.analyze(state.textoCifrado);
  const labels = ALPHABET.split('');
  
  const cipherData = labels.map(ch => {
    const found = cipherFreqs.find(f => f.char === ch);
    return found ? found.percent.toFixed(1) : 0;
  });

  const spanishData = labels.map(ch => FrequencyAnalyzer.SPANISH_FREQS[ch] || 0);

  if (state.frecChart) {
    state.frecChart.data.datasets[0].data = cipherData;
    state.frecChart.data.datasets[1].data = spanishData;
    state.frecChart.update();
    return;
  }

  state.frecChart = new Chart(ctx, {
    type: 'bar',
    data: {
      labels,
      datasets: [
        {
          label: 'Texto Cifrado (%)',
          data: cipherData,
          backgroundColor: 'rgba(0, 229, 255, 0.65)',
          borderColor: '#00e5ff',
          borderWidth: 1,
          borderRadius: 2
        },
        {
          label: 'Español Estándar (%)',
          data: spanishData,
          type: 'line',
          borderColor: '#00ff88',
          borderWidth: 2,
          pointRadius: 2,
          pointBackgroundColor: '#00ff88',
          tension: 0.2
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          labels: {
            color: '#a0aec0',
            font: { size: 10, family: 'Rajdhani' }
          }
        },
        tooltip: {
          callbacks: {
            label: (item) => `${item.dataset.label}: ${item.raw}%`
          }
        }
      },
      scales: {
        x: {
          ticks: { color: '#718096', font: { size: 9, family: 'JetBrains Mono' } },
          grid: { color: 'rgba(255,255,255,0.04)' }
        },
        y: {
          beginAtZero: true,
          ticks: { color: '#718096', font: { size: 9 } },
          grid: { color: 'rgba(255,255,255,0.04)' }
        }
      }
    }
  });
}

// ─── Gestión de Pistas ────────────────────────────────────────
function renderPistas() {
  const mision = MISIONES[state.misionIndex];
  const list = document.getElementById('pistas-list');
  const btnPista = document.getElementById('btn-pedir-pista');
  const hudCount = document.getElementById('hud-pistas-left');

  if (hudCount) hudCount.textContent = Math.max(0, mision.pistas.length - state.pistasUsadas);

  if (!list) return;
  list.innerHTML = '';

  const costText = state.difficulty === 'recluta' ? 'Gratis en modo Recluta' : (state.difficulty === 'agente' ? '-50 pts' : '-100 pts');

  if (state.pistasUsadas === 0) {
    list.innerHTML = `<div class="text-muted" style="font-size:0.8rem">Pulsa en "Pista" si necesitas ayuda (${costText}).</div>`;
    return;
  }

  for (let i = 0; i < state.pistasUsadas; i++) {
    const div = document.createElement('div');
    div.className = 'pista-item';
    div.innerHTML = `<span>💡</span><div><strong>Pista ${i + 1}:</strong> ${mision.pistas[i]}</div>`;
    list.appendChild(div);
  }

  if (btnPista) {
    btnPista.disabled = state.pistasUsadas >= mision.pistas.length;
  }
}

document.getElementById('btn-pedir-pista')?.addEventListener('click', () => {
  const mision = MISIONES[state.misionIndex];
  if (state.pistasUsadas < mision.pistas.length) {
    state.pistasUsadas++;
    renderPistas();
    const costText = state.difficulty === 'recluta' ? 'Gratis en Recluta' : (state.difficulty === 'agente' ? '-50 pts' : '-100 pts');
    showToast(`Nueva pista desbloqueada (${costText})`, 'info');
  } else {
    showToast('No quedan más pistas para esta misión', 'warning');
  }
});

// ─── Enviar y Validar Solución ────────────────────────────────
function initSubmitHandler() {
  const btnEnviar = document.getElementById('btn-enviar-solucion');
  const inputSolucion = document.getElementById('input-solucion');
  const btnCopiar = document.getElementById('btn-copiar-preview');

  if (btnCopiar && inputSolucion) {
    btnCopiar.addEventListener('click', () => {
      const previewText = document.getElementById('texto-descifrado')?.textContent || '';
      if (previewText && !previewText.startsWith('—')) {
        inputSolucion.value = previewText.trim();
        showToast('Vista previa copiada a la solución', 'info');
      } else {
        showToast('Primero ajusta el descifrado para generar la vista previa', 'warning');
      }
    });
  }

  if (btnEnviar && inputSolucion) {
    btnEnviar.addEventListener('click', () => {
      verificarSolucion();
    });

    inputSolucion.addEventListener('keydown', e => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        verificarSolucion();
      }
    });
  }
}

function verificarSolucion() {
  const input = document.getElementById('input-solucion');
  const feedback = document.getElementById('submit-feedback');
  if (!input) return;

  const respuesta = input.value.trim();
  if (!respuesta) {
    showToast('Por favor, escribe una solución antes de enviar', 'warning');
    return;
  }

  if (state.mode === 'sandbox') {
    showToast('¡Validación en Modo Sandbox libre! Texto comprobado.', 'info');
    if (feedback) {
      feedback.textContent = `Texto validado: ${respuesta.length} caracteres`;
      feedback.className = 'submit-feedback success';
    }
    return;
  }

  const esCorrecto = verifySolution(respuesta, state.textoOriginal);
  const now = new Date();
  const timeStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}:${String(now.getSeconds()).padStart(2, '0')}`;

  // Registrar en historial
  state.historialIntentos.unshift({
    texto: respuesta,
    correcto: esCorrecto,
    hora: timeStr
  });
  renderHistorial();

  if (esCorrecto) {
    stopTimer();
    const tiempoSegundos = Math.floor((Date.now() - state.tiempoInicio) / 1000);
    
    // Cálculo de puntuación
    const basePuntos = 1000;
    const tiempoPenalizacion = Math.min(400, tiempoSegundos * 2);
    const costePista = state.difficulty === 'recluta' ? 0 : (state.difficulty === 'agente' ? 50 : 100);
    const pistasPenalizacion = state.pistasUsadas * costePista;
    const puntosRonda = Math.max(200, basePuntos - tiempoPenalizacion - pistasPenalizacion);

    state.puntuacionTotal += puntosRonda;
    document.getElementById('hud-puntos').textContent = state.puntuacionTotal;
    state.misionesCompletadas.add(state.misionIndex);
    renderMisionesNav();

    // Feedback visual
    if (feedback) {
      feedback.textContent = '¡RESPUESTA CORRECTA!';
      feedback.className = 'submit-feedback success';
    }

    // Modal de victoria
    mostrarModalVictoria(puntosRonda, tiempoSegundos);
  } else {
    if (feedback) {
      feedback.textContent = 'Solución incorrecta. Revisa el texto y vuelve a intentarlo.';
      feedback.className = 'submit-feedback error';
    }
    showToast('Código incorrecto, revisa las herramientas', 'error');
  }
}

function renderHistorial() {
  const list = document.getElementById('historial-list');
  if (!list) return;
  list.innerHTML = '';

  if (state.historialIntentos.length === 0) {
    list.innerHTML = '<div class="text-muted" style="font-size:0.78rem; text-align:center">Sin intentos todavía</div>';
    return;
  }

  state.historialIntentos.forEach(item => {
    const div = document.createElement('div');
    div.className = `historial-item ${item.correcto ? 'correcto' : 'incorrecto'}`;
    div.innerHTML = `
      <span class="hist-icon">${item.correcto ? '✅' : '❌'}</span>
      <span class="hist-text">${item.texto}</span>
      <span class="hist-time">${item.hora}</span>
    `;
    list.appendChild(div);
  });
}

// ─── Modales y Flujo ──────────────────────────────────────────
function mostrarModalVictoria(puntos, segundos) {
  const modal = document.getElementById('modal-victoria');
  const solText = document.getElementById('modal-solucion');
  const ptsText = document.getElementById('modal-puntos-ronda');
  const timeText = document.getElementById('modal-tiempo-ronda');
  const btnSig = document.getElementById('btn-siguiente-mision');

  if (solText) solText.textContent = state.textoOriginal;
  if (ptsText) ptsText.textContent = `+${puntos} PTS`;
  
  const min = String(Math.floor(segundos / 60)).padStart(2, '0');
  const sec = String(segundos % 60).padStart(2, '0');
  if (timeText) timeText.textContent = `${min}:${sec}`;

  // Estrellas según pistas usadas
  const estrellas = state.pistasUsadas === 0 ? '⭐⭐⭐' : state.pistasUsadas === 1 ? '⭐⭐☆' : '⭐☆☆';
  const estrellasEl = document.getElementById('modal-estrellas');
  if (estrellasEl) estrellasEl.textContent = estrellas;

  // Mostrar pista de inteligencia desbloqueada para misiones posteriores
  const misionActual = MISIONES[state.misionIndex];
  const clueWrap = document.getElementById('modal-intel-clue-wrap');
  const clueText = document.getElementById('modal-intel-clue-text');
  if (misionActual && misionActual.pistaIntel) {
    if (clueText) clueText.innerHTML = misionActual.pistaIntel;
    if (clueWrap) clueWrap.classList.remove('hidden');
  } else {
    if (clueWrap) clueWrap.classList.add('hidden');
  }

  if (modal) modal.classList.remove('hidden');

  if (btnSig) {
    btnSig.onclick = () => {
      if (modal) modal.classList.add('hidden');
      if (state.misionIndex + 1 < MISIONES.length) {
        cargarMision(state.misionIndex + 1);
      } else {
        finalizarEntrenamientoCompleto();
      }
    };
  }
}

async function finalizarEntrenamientoCompleto() {
  const modalFinal = document.getElementById('modal-resumen-final');
  const totalPtsEl = document.getElementById('final-total-pts');
  if (totalPtsEl) totalPtsEl.textContent = `${state.puntuacionTotal} PTS`;
  if (modalFinal) modalFinal.classList.remove('hidden');

  // Registrar partida como completada y actualizar selector
  state.partidasCompletadas.add(state.partidaIndex);
  try {
    localStorage.setItem('rompecodigos_partidas_completadas', JSON.stringify([...state.partidasCompletadas]));
  } catch (e) {}
  renderPartidasSelectOptions();

  // Guardar partida en Supabase
  if (state.user) {
    try {
      await saveGameResult(
        'rompecodigos',
        state.user.uid,
        currentProfile?.classId || null,
        state.puntuacionTotal,
        {
          mode: 'practice',
          partidaId: PARTIDAS_DATA[state.partidaIndex]?.id,
          partidaNombre: PARTIDAS_DATA[state.partidaIndex]?.nombre,
          misionesTotal: MISIONES.length,
          misionesSuperadas: state.misionesCompletadas.size,
          timestamp: new Date().toISOString()
        }
      );
      showToast('Puntuación guardada en tu perfil', 'success');
    } catch (err) {
      console.warn('Error al guardar resultado de práctica:', err);
    }
  }
}

// ─── Temporizador ─────────────────────────────────────────────
function startTimer() {
  stopTimer();
  state.tiempoInicio = Date.now();
  const timerEl = document.getElementById('hud-timer');

  state.timerInterval = setInterval(() => {
    const elapsed = Math.floor((Date.now() - state.tiempoInicio) / 1000);
    const min = String(Math.floor(elapsed / 60)).padStart(2, '0');
    const sec = String(elapsed % 60).padStart(2, '0');
    if (timerEl) timerEl.textContent = `${min}:${sec}`;
  }, 1000);
}

function stopTimer() {
  if (state.timerInterval) {
    clearInterval(state.timerInterval);
    state.timerInterval = null;
  }
}

// ─── Sugerencias César ────────────────────────────────────────
function renderCesarSuggestions() {
  const container = document.getElementById('cesar-suggestions');
  if (!container || !state.textoCifrado) return;

  const suggestions = suggestCaesarShifts(state.textoCifrado);
  if (!suggestions.length) { container.innerHTML = ''; return; }

  container.innerHTML = `
    <div style="font-size:0.75rem; color:var(--text-muted); margin-bottom:4px;">🔍 Desplazamientos más probables:</div>
    ${suggestions.map(s => `
      <button class="cesar-suggestion-btn" data-shift="${s.shift}"
              style="background:rgba(0,229,255,0.08); border:1px solid rgba(0,229,255,0.25);
                     color:var(--primary); font-family:var(--font-mono); font-size:0.78rem;
                     padding:4px 10px; border-radius:4px; cursor:pointer; margin:2px;
                     transition:all 0.15s;">
        +${s.shift} — ${s.reason}
      </button>`).join('')}
  `;

  container.querySelectorAll('.cesar-suggestion-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const shift = parseInt(btn.dataset.shift);
      const slider = document.getElementById('cesar-slider');
      if (slider) slider.value = shift;
      updateCesarValue(shift);
      applyCesarShift(shift);
      showToast(`Desplazamiento +${shift} aplicado`, 'info');
    });
  });
}

// ─── Panel de Palabras Cortas — Criptoanálisis de Sustitución ───
const PALABRAS_CORTAS_ES = {
  1: [
    'A', 'Y', 'E', 'O', 'U',
    'B', 'C', 'D', 'F', 'G', 'H', 'I', 'J', 'K', 'L', 'M',
    'N', 'P', 'Q', 'R', 'S', 'T', 'V', 'W', 'X', 'Z'
  ],
  2: [
    'LA', 'DE', 'EL', 'EN', 'UN', 'SI', 'ES', 'AL', 'LO', 'LE',
    'SE', 'SU', 'TE', 'MI', 'YA', 'NO', 'ME', 'TU', 'VA', 'HE',
    'NI', 'IP', 'SO', 'EX'
  ],
  3: [
    'LOS', 'LAS', 'DEL', 'CON', 'POR', 'UNA', 'RED', 'FUE', 'QUE',
    'MAS', 'SUS', 'SON', 'SIN', 'VER', 'DOS', 'DAR', 'MUY', 'HAY',
    'WEB', 'LUZ', 'DIA', 'TCP', 'SUR', 'SOL', 'PAN', 'VOZ', 'LEY'
  ],
  4: [
    'PARA', 'SEIS', 'BUEN', 'COMO', 'ESTE', 'ESTA', 'CUAL', 'PERO',
    'TODO', 'CADA', 'VIDA', 'DIAS', 'BIEN', 'HORA', 'SOLO', 'DEBE',
    'UTIL', 'HITO', 'LUNA', 'DIOS', 'CAOS', 'OTRA', 'ERAN', 'AZUL',
    'OTRO', 'CLIC', 'NAVE', 'MUDA', 'HILO', 'FINO', 'OCHO', 'MIDE',
    'CASI', 'GIRA', 'SEGA', 'DURO', 'MURO', 'DEJA', 'CAJA', 'ANOS',
    'TIRA', 'VARA', 'TRES', 'CAPA', 'ROJA'
  ]
};

function renderPalabrasCortas() {
  const container = document.getElementById('palabras-cortas-panel');
  if (!container) return;

  // Extraer palabras únicas del texto cifrado (longitud 1-4)
  const words = [...new Set(
    state.textoCifrado.split(/[^A-Z]+/).filter(w => w.length >= 1 && w.length <= 4)
  )].sort((a, b) => a.length - b.length || a.localeCompare(b));

  if (!words.length) {
    container.innerHTML = '';
    return;
  }

  container.innerHTML = `
    <div class="section-title" style="margin-bottom:6px;">🔎 Análisis de Palabras Cortas</div>
    <div style="font-size:0.75rem; color:var(--text-muted); margin-bottom:10px; line-height:1.4;">
      En español, los artículos y conjunciones cortas (A, Y, LA, EL, EN, DE, UN, SI...) son la clave para descifrar sustituciones monoalfabéticas sin conocer la clave. 
      Los candidatos en <strong style="color:var(--primary);">azul</strong> encajan con tus letras actuales, y los <strong style="color:var(--accent);">verdes (✓)</strong> ya están aplicados.
    </div>
    ${words.map(word => {
      const candidates = PALABRAS_CORTAS_ES[word.length] || [];
      const decodedArr = word.split('').map(ch => state.tablaSustitucion[ch] || '_');
      const decodedStr = decodedArr.join('');
      const hasAnyMapping = decodedArr.some(c => c !== '_');
      const allMapped = decodedArr.every(c => c !== '_');

      return `
        <div style="margin-bottom:10px; background:rgba(15,23,42,0.65); border:1px solid var(--border); border-radius:6px; padding:8px 10px;">
          <div style="display:flex; align-items:center; gap:8px; margin-bottom:6px; flex-wrap:wrap;">
            <span style="font-family:var(--font-mono); font-size:1.05rem; color:var(--primary); font-weight:700; letter-spacing:0.12em;">${word}</span>
            <span style="color:var(--text-muted); font-size:0.8rem;">→</span>
            <span style="font-family:var(--font-mono); font-size:1.05rem; font-weight:700; letter-spacing:0.14em; color:${allMapped ? 'var(--accent)' : 'var(--text-bright)'};">
              ${decodedArr.join(' ')}
            </span>
            <span style="font-size:0.7rem; color:var(--text-dim);">(${word.length} ${word.length === 1 ? 'letra' : 'letras'})</span>
            ${hasAnyMapping ? `
              <button class="btn-clear-word" data-cipher="${word}"
                      style="margin-left:auto; background:transparent; border:1px solid rgba(255,100,100,0.35);
                             color:#ff6b81; font-size:0.7rem; padding:2px 7px; border-radius:4px; cursor:pointer;"
                      title="Quitar correspondencias de esta palabra">
                ✖ Quitar
              </button>` : ''}
          </div>
          <div style="display:flex; flex-wrap:wrap; gap:5px;">
            ${candidates.map(cand => {
              let isCompatible = true;
              const isExactMatch = (decodedStr === cand);

              for (let i = 0; i < word.length; i++) {
                const cCh = word[i];
                const pCh = cand[i];
                if (state.tablaSustitucion[cCh] && state.tablaSustitucion[cCh] !== pCh) {
                  isCompatible = false;
                  break;
                }
                for (const [k, v] of Object.entries(state.tablaSustitucion)) {
                  if (v === pCh && k !== cCh) {
                    isCompatible = false;
                    break;
                  }
                }
                if (!isCompatible) break;
                for (let j = i + 1; j < word.length; j++) {
                  if (word[i] === word[j] && cand[i] !== cand[j]) { isCompatible = false; break; }
                  if (word[i] !== word[j] && cand[i] === cand[j]) { isCompatible = false; break; }
                }
                if (!isCompatible) break;
              }

              let btnStyle = '';
              let label = cand;
              if (isExactMatch) {
                btnStyle = 'background:rgba(0,255,136,0.18); border:1px solid var(--accent); color:var(--accent); font-weight:700;';
                label = `✓ ${cand}`;
              } else if (isCompatible) {
                btnStyle = 'background:rgba(0,229,255,0.12); border:1px solid rgba(0,229,255,0.4); color:var(--primary); font-weight:600;';
              } else {
                btnStyle = 'background:rgba(255,255,255,0.03); border:1px solid rgba(255,255,255,0.08); color:var(--text-dim); opacity:0.35;';
              }

              return `
                <button class="word-cand-btn" data-cipher="${word}" data-plain="${cand}"
                        style="${btnStyle} font-family:var(--font-mono); font-size:0.78rem; padding:3px 8px; border-radius:4px; cursor:pointer; transition:all 0.15s;">
                  ${label}
                </button>`;
            }).join('')}
          </div>
        </div>`;
    }).join('')}
  `;

  // Listener para aplicar candidato
  container.querySelectorAll('.word-cand-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const cipher = btn.dataset.cipher;
      const plain  = btn.dataset.plain;
      for (let i = 0; i < cipher.length; i++) {
        const cChar = cipher[i];
        const pChar = plain[i];
        state.tablaSustitucion[cChar] = pChar;
        const input = document.querySelector(`.sust-key-input[data-char="${cChar}"]`);
        if (input) {
          input.value = pChar;
          input.classList.add('filled');
        }
      }
      renderTextoCifrado();
      renderTextoDescifrado();
      renderPalabrasCortas();
      showToast(`Aplicado: ${cipher} → ${plain}`, 'success');
    });
  });

  // Listener para quitar sustitución individual de palabra
  container.querySelectorAll('.btn-clear-word').forEach(btn => {
    btn.addEventListener('click', () => {
      const cipher = btn.dataset.cipher;
      for (let i = 0; i < cipher.length; i++) {
        const cChar = cipher[i];
        delete state.tablaSustitucion[cChar];
        const input = document.querySelector(`.sust-key-input[data-char="${cChar}"]`);
        if (input) {
          input.value = '';
          input.classList.remove('filled');
        }
      }
      renderTextoCifrado();
      renderTextoDescifrado();
      renderPalabrasCortas();
      showToast(`Sustituciones de ${cipher} eliminadas`, 'info');
    });
  });
}

// ─── Vigenère — Texto Conocido ────────────────────────────────
function initVigenereKnownPlaintext() {
  const btnKnown = document.getElementById('btn-known-plaintext');
  const inputKnown = document.getElementById('vigenere-known-word');
  const resultContainer = document.getElementById('vigenere-known-result');

  btnKnown?.addEventListener('click', () => {
    const word = inputKnown?.value.trim().toUpperCase();
    if (!word) { showToast('Introduce una palabra para buscar', 'warning'); return; }

    const results = knownPlaintextVigenere(state.textoCifrado, word);
    if (!results.length) {
      resultContainer.innerHTML = `<div style="color:var(--text-muted); font-size:0.8rem;">La palabra "${word}" no parece estar en el texto cifrado.</div>`;
      return;
    }

    resultContainer.innerHTML = `
      <div style="font-size:0.75rem; color:var(--text-muted); margin-bottom:6px;">Si "${word}" está en el texto, la clave en esas posiciones sería:</div>
      ${results.slice(0, 5).map(r => `
        <div style="display:flex; align-items:center; gap:8px; margin-bottom:4px;">
          <span style="color:var(--text-muted); font-size:0.72rem;">pos ${r.position}:</span>
          <button class="vig-key-fragment-btn" data-fragment="${r.keyFragment}"
                  style="font-family:var(--font-mono); font-size:0.9rem; color:var(--accent);
                         background:rgba(0,255,136,0.08); border:1px solid rgba(0,255,136,0.2);
                         padding:3px 10px; border-radius:4px; cursor:pointer; font-weight:700;">
            ${r.keyFragment}
          </button>
          <span style="font-size:0.7rem; color:var(--text-muted);">← prueba esta clave</span>
        </div>`).join('')}
    `;

    resultContainer.querySelectorAll('.vig-key-fragment-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const fragment = btn.dataset.fragment;
        const keyInput = document.getElementById('vigenere-key-input');
        if (keyInput) keyInput.value = fragment;
        // Aplicar automáticamente
        const descifrado = Vigenere.decrypt(state.textoCifrado, fragment);
        const descContainer = document.getElementById('texto-descifrado');
        if (descContainer) descContainer.textContent = descifrado;
        showToast(`Clave "${fragment}" aplicada`, 'info');
      });
    });
  });
}
