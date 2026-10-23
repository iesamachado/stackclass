// ============================================================
// practica.js — Laboratorio Criptográfico y Modo Práctica RompeCódigos
// ============================================================

import { requireAuth, currentProfile, incrementDigitalWellbeing } from '../../../../js/common/auth.js';
import { renderHeader, showToast, initParticles } from '../../../../js/common/ui.js';
import { saveGameResult } from '../../../../js/common/db.js';

// ─── Misiones de Práctica ────────────────────────────────────
const MISIONES = [
  {
    id: 1,
    titulo: 'Misión 1: Cifrado César Básico',
    tipo: 'caesar',
    tipoBadge: 'César',
    demoTab: 'demo-cesar',
    descripcion: 'El mensaje ha sido desplazado un número fijo de posiciones en el alfabeto. Analiza las frecuencias y usa las herramientas César para descubrirlo.',
    textoOriginal: 'EL CODIGO SECRETO HA SIDO DESCIFRADO CON EXITO',
    shift: 3,
    pistas: [
      'Fíjate en el gráfico de frecuencias: una letra destaca claramente sobre todas las demás. En español, esa letra suele ser la E o la A.',
      'Observa el bloque azul más alto del gráfico. Compara su posición en el alfabeto con la de la E (5ª letra). La diferencia te dará el desplazamiento.',
      'Prueba los desplazamientos sugeridos en el panel azul debajo del slider. Uno de ellos debería producir texto legible.'
    ]
  },
  {
    id: 2,
    titulo: 'Misión 2: Interceptación Espacial',
    tipo: 'caesar',
    tipoBadge: 'César',
    demoTab: 'demo-cesar',
    descripcion: 'Un mensaje interceptado de la base lunar. Las frecuencias del texto te revelarán el desplazamiento exacto si sabes interpretarlas.',
    textoOriginal: 'LA BASE LUNAR NECESITA SUMINISTROS DE ENERGIA DE INMEDIATO',
    shift: 7,
    pistas: [
      'En el texto cifrado aparecen varios grupos de dos letras iguales. En español, palabras como "DE" o "LA" son muy comunes. Busca palabras cortas repetidas.',
      'La tabla de fuerza bruta (botón ⚡) muestra los 25 posibles descifrados. Busca la fila que contiene palabras con sentido completo.',
      'El desplazamiento que buscas está entre el 5 y el 10. Comprueba cada uno en la tabla de fuerza bruta y busca el que produce una frase sobre recursos o energía.'
    ]
  },
  {
    id: 3,
    titulo: 'Misión 3: Criptoanálisis de Sustitución',
    tipo: 'substitution',
    tipoBadge: 'Sustitución',
    demoTab: 'demo-frecuencias',
    descripcion: 'Cifrado monoalfabético: cada letra ha sido reemplazada por otra diferente. El análisis de frecuencias y las palabras cortas son tu mejor arma.',
    textoOriginal: 'LA CRIPTOGRAFIA PROTEGE LA INFORMACION MEDIANTE ALGORITMOS MATEMATICOS',
    substMap: {
      'A': 'X', 'B': 'Y', 'C': 'Z', 'D': 'A', 'E': 'B', 'F': 'C', 'G': 'D', 'H': 'E',
      'I': 'F', 'J': 'G', 'K': 'H', 'L': 'I', 'M': 'J', 'N': 'K', 'O': 'L', 'P': 'M',
      'Q': 'N', 'R': 'O', 'S': 'P', 'T': 'Q', 'U': 'R', 'V': 'S', 'W': 'T', 'X': 'U',
      'Y': 'V', 'Z': 'W'
    },
    pistas: [
      'Las palabras cortas son la clave. Fíjate en las palabras de 2 letras que se repiten en el texto cifrado — en español casi siempre son LA, DE, EL, EN o AL.',
      'Pulsa "✨ Sugerir Sustitución" para obtener un punto de partida basado en frecuencias. No será perfecto, pero te dará las vocales principales.',
      'Una vez tengas las vocales colocadas, las consonantes se deducen solas: si ves _N_ORMACION ya sabes que esas letras son I y F. Usa el panel de palabras cortas.'
    ]
  },
  {
    id: 4,
    titulo: 'Misión 4: Cifrado Polialfabético',
    tipo: 'vigenere',
    tipoBadge: 'Vigenère',
    demoTab: 'demo-vigenere',
    descripcion: 'Un cifrado más sofisticado usa una palabra como clave para variar el desplazamiento en cada posición. El análisis de frecuencias ya no funciona directamente.',
    textoOriginal: 'LA CLAVE SECRETA ABRE TODAS LAS PUERTAS DEL SISTEMA CENTRAL',
    key: 'ROBOT',
    pistas: [
      'Este cifrado usa el Índice de Coincidencia: si el texto parece tener frecuencias uniformes (las barras del gráfico están muy igualadas), es polialfabético. La clave tiene una longitud relacionada con la tecnología que estudias en clase.',
      'Prueba palabras cortas del vocabulario del tema: los robots siguen instrucciones, los ordenadores ejecutan programas, las máquinas tienen motores...',
      'La clave tiene 5 letras y es el nombre de una máquina que sigue órdenes automáticamente. Introdúcela en el campo de Vigenère y pulsa Aplicar.'
    ]
  },
  {
    id: 5,
    titulo: 'Misión 5: Reto Final — ROT13',
    tipo: 'caesar',
    tipoBadge: 'ROT13',
    demoTab: 'demo-cesar',
    descripcion: 'Misión final. Este cifrado tiene una propiedad matemática especial: cifrarlo dos veces produce el mensaje original. ¿Cuántos pasos hay en la mitad exacta del alfabeto?',
    textoOriginal: 'FELICIDADES AGENTE HAS DEMOSTRADO UN GRAN DOMINIO DE LA CRIPTOGRAFIA',
    shift: 13,
    pistas: [
      'El alfabeto tiene 26 letras. Este cifrado divide el alfabeto exactamente por la mitad, creando una simetría perfecta: A↔N, B↔O, C↔P...',
      'Si hay 26 letras y el desplazamiento es exactamente la mitad, ¿qué número es la mitad de 26? Ese es el desplazamiento que necesitas.',
      'El slider del desplazamiento César tiene un valor máximo de 25. El desplazamiento correcto es el número 13. Colócalo ahí.'
    ]
  }
];

const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';

// ─── Estado del Juego / Lab ──────────────────────────────────
const state = {
  user: null,
  profile: null,
  mode: 'misiones', // 'misiones' | 'sandbox'
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
      initApp();
    }
  });
});

function initApp() {
  buildSustKeyboard();
  initCesarSlider();
  initVigenereHandler();
  initVigenereKnownPlaintext();
  initSubmitHandler();
  initDemosModal();
  initModeSwitcher();
  initSandboxHandlers();
  renderMisionesNav();
  cargarMision(0);

  document.getElementById('difficulty-select')?.addEventListener('change', () => {
    cargarMision(state.misionIndex);
  });
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
  resetSustInputs();

  // Renderizar vistas
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
      showToast('Sustituciones limpiadas', 'info');
    });
  }

  const btnSugerir = document.getElementById('btn-sugerir');
  if (btnSugerir) {
    btnSugerir.addEventListener('click', () => {
      const sugerencias = FrequencyAnalyzer.suggestSubstitutions(state.textoCifrado);
      state.tablaSustitucion = { ...sugerencias };
      
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

      renderTextoCifrado();
      renderTextoDescifrado();
      showToast('Sugerencia de frecuencias aplicada', 'success');
    });
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

  if (state.pistasUsadas === 0) {
    list.innerHTML = '<div class="text-muted" style="font-size:0.8rem">Pulsa en "Pista" si necesitas ayuda (-100 pts).</div>';
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
    showToast('Nueva pista desbloqueada (-100 pts)', 'info');
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
    const pistasPenalizacion = state.pistasUsadas * 100;
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

// ─── Panel de Palabras Cortas ─────────────────────────────────
const PALABRAS_CORTAS_ES = {
  1: ['A', 'Y', 'O', 'U', 'E'],
  2: ['DE', 'LA', 'EL', 'EN', 'UN', 'ES', 'AL', 'LO', 'LE', 'SE', 'YA', 'NO'],
  3: ['LOS', 'LAS', 'DEL', 'CON', 'UNA', 'QUE', 'POR', 'SUS', 'MAS', 'SON'],
  4: ['PARA', 'COMO', 'ESTE', 'ESTA', 'CUAL', 'PERO', 'TODO', 'CADA']
};

function renderPalabrasCortas() {
  const container = document.getElementById('palabras-cortas-panel');
  if (!container) return;

  // Extraer palabras únicas del texto cifrado (separadas por espacios), longitud 1-4
  const words = [...new Set(
    state.textoCifrado.split(/[^A-Z]+/).filter(w => w.length >= 1 && w.length <= 4)
  )].sort((a, b) => a.length - b.length);

  if (!words.length) { container.innerHTML = ''; return; }

  container.innerHTML = `
    <div class="section-title" style="margin-bottom:8px;">🔎 Palabras cortas — punto de ataque</div>
    <div style="font-size:0.75rem; color:var(--text-muted); margin-bottom:8px;">
      Las palabras cortas son el mejor punto de partida. Haz clic en un candidato para aplicar esa correspondencia.
    </div>
    ${words.map(word => {
      const candidates = PALABRAS_CORTAS_ES[word.length] || [];
      return `
        <div style="margin-bottom:10px; background:rgba(0,0,0,0.2); border:1px solid var(--border); border-radius:6px; padding:8px;">
          <div style="display:flex; align-items:center; gap:8px; margin-bottom:6px;">
            <span style="font-family:var(--font-mono); font-size:1rem; color:var(--primary); font-weight:700; letter-spacing:0.12em;">${word}</span>
            <span style="font-size:0.7rem; color:var(--text-muted);">(${word.length} letras)</span>
          </div>
          <div style="display:flex; flex-wrap:wrap; gap:4px;">
            ${candidates.map(cand => `
              <button class="word-cand-btn" data-cipher="${word}" data-plain="${cand}"
                      style="background:rgba(255,255,255,0.05); border:1px solid var(--border);
                             color:var(--text-bright); font-family:var(--font-mono); font-size:0.78rem;
                             padding:3px 8px; border-radius:4px; cursor:pointer; transition:all 0.15s;">
                ${cand}
              </button>`).join('')}
          </div>
        </div>`;
    }).join('')}
  `;

  container.querySelectorAll('.word-cand-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const cipher = btn.dataset.cipher;
      const plain  = btn.dataset.plain;
      // Aplicar correspondencia letra a letra
      for (let i = 0; i < cipher.length; i++) {
        const cChar = cipher[i];
        const pChar = plain[i];
        state.tablaSustitucion[cChar] = pChar;
        const input = document.querySelector(`.sust-key-input[data-char="${cChar}"]`);
        if (input) { input.value = pChar; input.classList.add('filled'); }
      }
      renderTextoCifrado();
      renderTextoDescifrado();
      showToast(`Aplicado: ${cipher} → ${plain}`, 'success');
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
