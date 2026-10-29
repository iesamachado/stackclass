import { requireAuth } from '../../../../js/common/auth.js';
import { saveGameResult } from '../../../../js/common/db.js';
import { renderHeader, showToast } from '../../../../js/common/ui.js';
import { generateRoomCode } from '../../../../js/common/utils.js';
import {
  createSession,
  getSession,
  updateSessionConfig,
  listenSession,
  emitHint as dbEmitHint
} from './RompeDb.js';

function generateCipherMessage(textoOriginal, tipo, clave) {
  const texto = (textoOriginal || '').toUpperCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  if (tipo === 'caesar') {
    if (typeof Caesar !== 'undefined' && Caesar.encrypt) return Caesar.encrypt(texto, parseInt(clave));
    if (typeof cifrarCesar !== 'undefined') return cifrarCesar(texto, parseInt(clave));
  } else if (tipo === 'vigenere') {
    if (typeof Vigenere !== 'undefined' && Vigenere.encrypt) return Vigenere.encrypt(texto, clave.toString());
    if (typeof cifrarVigenere !== 'undefined') return cifrarVigenere(texto, clave.toString());
  }
  return texto;
}

function formatTime(seconds) {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

function copyToClipboard(text, msg) {
  navigator.clipboard.writeText(text).then(() => {
    showToast('Copiado', msg, 'info', 2000);
  });
}

// ─── Pool de Mensajes por Defecto ─────────────────────────────
const DEFAULT_MENSAJES_POOL = [
  // Fácil (César simple)
  {
    id: 'facil_1',
    tematica: 'Misión Secreta',
    nivelDificultad: 'facil',
    tipoCifrado: 'caesar',
    clave: 3,
    textoOriginal: 'EL CODIGO SECRETO HA SIDO DESCIFRADO CON EXITO',
    textoCifrado: 'HO FRGLJR VHFUHWR KD VLGR GHVFUIUDGR FRQ HALWR'
  },
  {
    id: 'facil_2',
    tematica: 'Ciberseguridad',
    nivelDificultad: 'facil',
    tipoCifrado: 'caesar',
    clave: 4,
    textoOriginal: 'PROTEGE SIEMPRE TUS CONTRASENAS CON CARACTERES SEGUROS',
    textoCifrado: 'TVSXIKI WMIQTVI XYW GSRXVEWIREW GSR GEVEGXIVIW WIKYVSW'
  },
  {
    id: 'facil_3',
    tematica: 'Base Espacial',
    nivelDificultad: 'facil',
    tipoCifrado: 'caesar',
    clave: 2,
    textoOriginal: 'LA ESTACION ESPACIAL RECIBE LA TRANSMISION DE DATOS',
    textoCifrado: 'NC GUVCEKQP GURCEKCN TGEKDG NC VTCPUOKUKQP FG FCVQU'
  },
  {
    id: 'facil_4',
    tematica: 'Inteligencia Digital',
    nivelDificultad: 'facil',
    tipoCifrado: 'caesar',
    clave: 5,
    textoOriginal: 'TODO SISTEMA INFORMATICO REQUIERE COPIAS DE SEGURIDAD',
    textoCifrado: 'YTIT XNXYJRF NSKTWRFYNHT WJVZNJWJ HUTNFX IJ XJLZWNIPI'
  },
  {
    id: 'facil_5',
    tematica: 'Redes Seguras',
    nivelDificultad: 'facil',
    tipoCifrado: 'caesar',
    clave: 3,
    textoOriginal: 'LA INFORMACION VIAJA ENCRIPTADA POR LA FIBRA OPTICA',
    textoCifrado: 'OD LQIRUPDFLRQ YLDMD HQFULSWDGD SRU OD ILEUD RSWLFD'
  },

  // Medio (César avanzado)
  {
    id: 'medio_1',
    tematica: 'Protocolo Enigma',
    nivelDificultad: 'medio',
    tipoCifrado: 'caesar',
    clave: 13,
    textoOriginal: 'EL ALGORITMO ROT13 DIVIDE EL ALFABETO POR LA MITAD',
    textoCifrado: 'RY NYTBEVGZB EBG13 QVIVQR RY NYSNORGB CBE YN ZVGNY'
  },
  {
    id: 'medio_2',
    tematica: 'Interceptación Lunar',
    nivelDificultad: 'medio',
    tipoCifrado: 'caesar',
    clave: 7,
    textoOriginal: 'LA BASE LUNAR NECESITA SUMINISTROS DE ENERGIA DE INMEDIATO',
    textoCifrado: 'SH IHZL SBUHY ULJLZPAH ZBTPUPZAYVZ KL LULYNPH KL PUTLKPHAV'
  },
  {
    id: 'medio_3',
    tematica: 'Criptografía Clásica',
    nivelDificultad: 'medio',
    tipoCifrado: 'caesar',
    clave: 11,
    textoOriginal: 'JULIO CESAR USABA ESTE METODO PARA MENSAJES MILITARES',
    textoCifrado: 'UFWTZ NPDLC FDLML PDEP XPEZOZ ALCL XPYDNUPD XTWTELCPD'
  },
  {
    id: 'medio_4',
    tematica: 'Defensa de Redes',
    nivelDificultad: 'medio',
    tipoCifrado: 'caesar',
    clave: 9,
    textoOriginal: 'EL CORTAFUEGOS DETECTO ACCESOS NO AUTORIZADOS EN EL SERVIDOR',
    textoCifrado: 'NU LXACJODNPXB MNCNLCX JLLNBXB WX JDCXARIJMXB NW NU BNAERMXA'
  },
  {
    id: 'medio_5',
    tematica: 'Frecuencias Ocultas',
    nivelDificultad: 'medio',
    tipoCifrado: 'caesar',
    clave: 14,
    textoOriginal: 'EL ANALISIS DE FRECUENCIAS REVELA LAS VOCALES MAS COMUNES',
    textoCifrado: 'SZ OBOZWGWG RS TFSQISBQWOG FSJSZO ZOG JCQOZSG TOG QCAIBSE'
  },

  // Difícil (Vigenère)
  {
    id: 'dificil_1',
    tematica: 'Clave Polialfabética',
    nivelDificultad: 'dificil',
    tipoCifrado: 'vigenere',
    clave: 'ROBOT',
    textoOriginal: 'LA CLAVE SECRETA ABRE TODAS LAS PUERTAS DEL SISTEMA CENTRAL',
    textoCifrado: 'CO DZTMS TSVISUO TSFF HHUOT ZT DVSVHVH RSP TKHVOAE DFBYEON'
  },
  {
    id: 'dificil_2',
    tematica: 'Agente Doble',
    nivelDificultad: 'dificil',
    tipoCifrado: 'vigenere',
    clave: 'ENIGMA',
    textoOriginal: 'EL AGENTE DOBLE ACTIVA EL PROTOCOLO DE DESCONEXION TOTAL',
    textoCifrado: 'IY IMQNXR LUNLI NKZUVE RT VDOXUSOYW HR JMGOUZILWUZ ACZOT'
  },
  {
    id: 'dificil_3',
    tematica: 'Criptoanálisis',
    nivelDificultad: 'dificil',
    tipoCifrado: 'vigenere',
    clave: 'CYBER',
    textoOriginal: 'UN MENSAJE CIFRADO CON VIGENERE RESISTE LA FUERZA BRUTA SIMPLE',
    textoCifrado: 'WL NIEUYKI TKDSEUQ APR MKEFRVT IILGJTF NC WYYTCX DTWYC JGNRNX'
  },
  {
    id: 'dificil_4',
    tematica: 'Redes Globales',
    nivelDificultad: 'dificil',
    tipoCifrado: 'vigenere',
    clave: 'STACK',
    textoOriginal: 'LOS SERVIDORES PRINCIPALES DE LA NUBE ESTAN RESTRINGIDOS',
    textoCifrado: 'DHS UOJOIFYJXS RBAGCKZSEEU NW DN VMNW WLVTC JEKLBVQSILOA'
  },
  {
    id: 'dificil_5',
    tematica: 'Copia de Respaldo',
    nivelDificultad: 'dificil',
    tipoCifrado: 'vigenere',
    clave: 'TOKEN',
    textoOriginal: 'LA SEGURIDAD EN INTERNET DEPENDE DE BUENOS PROTOCOLOS',
    textoCifrado: 'EO CITNFSHNW SX MAMSBRRM ROTRGQR HR PNRBFB IKHGHPIZHH'
  }
];

const MENSAJES_POOL = (typeof window !== 'undefined' && window.MENSAJES_POOL) || DEFAULT_MENSAJES_POOL;

let sesionActiva = null;
let dificultadSeleccionada = 'facil';
let mensajesPool = [...MENSAJES_POOL];
let mensajeCustomSeleccionado = null;
let timerInterval = null;
let unsubSession = null;
let pistasRestantes = 2;
let currentUserObj = null;

document.addEventListener('DOMContentLoaded', () => {
  requireAuth({
    allowedRoles: ['teacher', 'student'],
    onAuthorized: (user, profile) => {
      currentUserObj = user;
      renderHeader(user, profile);
      initProfesor(user);
    }
  });
});

function initProfesor(user) {
  initDifficultyPicker();
  renderMensajesPool();
  initCustomMensaje();
  initSessionControls();

  const params = new URLSearchParams(window.location.search);
  const sesionId = params.get('sesion');
  if (sesionId) {
    loadExistingSession(sesionId);
  }
}

function initDifficultyPicker() {
  const btns = document.querySelectorAll('.diff-btn');
  btns.forEach(btn => {
    btn.addEventListener('click', () => {
      btns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      dificultadSeleccionada = btn.dataset.diff;
      renderMensajesPool();
    });
  });
}

function renderMensajesPool() {
  const list = document.getElementById('mensaje-pool-list');
  if (!list) return;
  const filtrados = mensajesPool.filter(m => m.nivelDificultad === dificultadSeleccionada);
  if (!filtrados.length) {
    list.innerHTML = '<p class="text-muted" style="font-size:0.8rem; padding: 0.5rem">No hay mensajes para este nivel</p>';
    return;
  }
  list.innerHTML = filtrados.map((m, i) => `
    <div class="pool-item" data-id="${m.id}" title="${m.textoOriginal}">
      <span class="pool-item-tema">${m.tematica}</span>
      <span class="pool-item-text">${m.textoCifrado}</span>
      <span class="pool-item-diff badge ${
        m.nivelDificultad === 'facil' ? 'badge-accent' :
        m.nivelDificultad === 'medio' ? 'badge-warning' : 'badge-danger'
      }">${m.tipoCifrado}</span>
    </div>
  `).join('');

  list.querySelectorAll('.pool-item').forEach((item, idx) => {
    item.addEventListener('click', () => {
      list.querySelectorAll('.pool-item').forEach(i => i.classList.remove('selected'));
      item.classList.add('selected');
      mensajeCustomSeleccionado = filtrados[idx];
      showToast('Mensaje seleccionado', filtrados[idx].tematica, 'info');
    });
  });
}

function initCustomMensaje() {
  const btnPreview = document.getElementById('btn-preview-custom');
  const btnAdd     = document.getElementById('btn-add-custom');
  const preview    = document.getElementById('custom-preview');
  const previewTxt = document.getElementById('custom-preview-text');
  const tipoSel    = document.getElementById('custom-tipo');
  const claveSel   = document.getElementById('custom-clave');
  const textoInput = document.getElementById('custom-texto');

  btnPreview?.addEventListener('click', () => {
    const texto = textoInput.value.trim();
    const tipo  = tipoSel.value;
    const clave = claveSel.value.trim();
    if (!texto || !clave) {
      showToast('Faltan datos', 'error');
      return;
    }
    try {
      const cifrado = generateCipherMessage(texto, tipo, clave);
      previewTxt.textContent = cifrado;
      preview.classList.remove('hidden');
    } catch (e) {
      showToast('Error al cifrar', 'error');
    }
  });

  btnAdd?.addEventListener('click', () => {
    const texto = textoInput.value.trim();
    const tipo  = tipoSel.value;
    const clave = claveSel.value.trim();
    if (!texto || !clave) return;
    try {
      const textoCifrado = generateCipherMessage(texto, tipo, clave);
      const nuevo = {
        id: 'custom_' + Date.now(),
        tematica: 'Personalizado',
        nivelDificultad: dificultadSeleccionada,
        tipoCifrado: tipo,
        clave: tipo === 'caesar' ? parseInt(clave) : clave,
        textoOriginal: texto.toUpperCase().normalize('NFD').replace(/[\u0300-\u036f]/g, ''),
        textoCifrado
      };
      mensajesPool.unshift(nuevo);
      mensajeCustomSeleccionado = nuevo;
      renderMensajesPool();
      setTimeout(() => {
        const firstItem = document.querySelector('.pool-item');
        if (firstItem) firstItem.click();
      }, 50);
      showToast('Mensaje añadido', 'success');
      textoInput.value = '';
      claveSel.value = '';
      preview.classList.add('hidden');
    } catch (e) {
      showToast('Error', 'error');
    }
  });
}

function initSessionControls() {
  const btnCrear = document.getElementById('btn-crear-sesion');
  btnCrear?.addEventListener('click', crearSesion);
}

async function crearSesion() {
  const btnCrear = document.getElementById('btn-crear-sesion');
  if (!currentUserObj) return;

  const rondas   = parseInt(document.getElementById('cfg-rondas').value);
  const tiempo   = parseInt(document.getElementById('cfg-tiempo').value);
  const pistas   = parseInt(document.getElementById('cfg-pistas').value);
  const codigo   = generateRoomCode();

  const mensajesFiltrados = mensajesPool.filter(m => m.nivelDificultad === dificultadSeleccionada);
  if (!mensajesFiltrados.length) {
    showToast('Sin mensajes', 'error');
    return;
  }

  btnCrear.disabled = true;
  btnCrear.innerHTML = `<span class="spinner"></span> Creando...`;

  try {
    const rondasList = [];
    for (let i = 1; i <= rondas; i++) {
      const msg = (mensajeCustomSeleccionado && i === 1) ? mensajeCustomSeleccionado : mensajesFiltrados[(i - 1) % mensajesFiltrados.length];
      rondasList.push({
        numero:      i,
        textoCifrado: msg.textoCifrado,
        solucion:    msg.textoOriginal,
        tipoCifrado: msg.tipoCifrado,
        tematica:    msg.tematica,
        clave:       msg.clave,
        estado:      'pendiente',
        ganadorEquipo: null,
        pistas:      [],
        iniciadaEn:  null
      });
    }

    const uid = currentUserObj.id || currentUserObj.uid;
    await createSession({
      codigo,
      hostId: uid,
      hostNombre: currentUserObj.displayName || 'Profesor',
      totalRondas: rondas,
      duracionRonda: tiempo,
      dificultad: dificultadSeleccionada,
      pistasDisponibles: pistas,
      rondas: rondasList
    });

    sesionActiva = {
      id: codigo,
      codigo,
      rondaActual: 0,
      totalRondas: rondas,
      duracionRonda: tiempo,
      pistasDisponibles: pistas,
      estado: 'espera'
    };
    pistasRestantes = pistas;

    window.history.pushState({}, '', `?sesion=${codigo}`);
    showSesionView();
    updateSessionHeader();
    listenSessionUpdates(codigo);
    showToast('Sesión creada', 'success');

  } catch (err) {
    console.error(err);
    showToast('Error al crear sesión', 'error');
    btnCrear.disabled = false;
    btnCrear.innerHTML = 'Crear Sesión';
  }
}

async function loadExistingSession(sesionId) {
  try {
    const data = await getSession(sesionId);
    if (!data) return;
    const uid = currentUserObj?.id || currentUserObj?.uid;
    if (data.profesorUID !== uid) {
      showToast('Esta sesión no es tuya', 'error');
      return;
    }
    sesionActiva = { id: sesionId, ...data };
    pistasRestantes = data.pistasDisponibles !== undefined ? data.pistasDisponibles : 0;
    showSesionView();
    updateSessionHeader();
    listenSessionUpdates(sesionId);
    if (data.rondaActual > 0 && data.estado === 'en_curso') {
      loadMensajeActivo(sesionId, data.rondaActual);
      startTimer(data.tiempoRestante || data.duracionRonda);
    }
  } catch (err) {
    console.error(err);
  }
}

function showSesionView() {
  document.getElementById('view-setup').classList.add('hidden');
  document.getElementById('view-session').classList.remove('hidden');

  document.getElementById('btn-iniciar-ronda')?.addEventListener('click', iniciarRonda);
  document.getElementById('btn-emitir-pista')?.addEventListener('click', () => {
    document.getElementById('pista-modal')?.classList.remove('hidden');
  });
  document.getElementById('btn-finalizar-ronda')?.addEventListener('click', finalizarRondaManual);
  document.getElementById('pista-modal-close')?.addEventListener('click', () => {
    document.getElementById('pista-modal')?.classList.add('hidden');
  });
  document.querySelectorAll('.pista-btn').forEach(btn => {
    btn.addEventListener('click', () => emitirPista(btn.dataset.tipo));
  });

  document.getElementById('session-code')?.addEventListener('click', () => {
    const code = sesionActiva?.codigo || '';
    copyToClipboard(code, `Código ${code} copiado`);
  });
}

function updateSessionHeader() {
  const s = sesionActiva;
  if (!s) return;
  document.getElementById('session-code').textContent  = s.codigo;
  document.getElementById('session-ronda').textContent = `${s.rondaActual}/${s.totalRondas}`;
  document.getElementById('pistas-count').textContent  = pistasRestantes;

  const estadoBadge = document.getElementById('session-estado-badge');
  const estados = {
    espera:    { text: 'En Espera',  cls: 'badge-warning' },
    en_curso:  { text: 'En Curso',   cls: 'badge-accent' },
    finalizada:{ text: 'Finalizada', cls: 'badge-secondary' }
  };
  const e = estados[s.estado] || estados.espera;
  if(estadoBadge) {
      estadoBadge.textContent = e.text;
      estadoBadge.className   = `badge ${e.cls}`;
  }
}

async function iniciarRonda() {
  const s = sesionActiva;
  if (!s) return;
  if (s.rondaActual >= s.totalRondas) {
    showToast('Todas las rondas han finalizado', 'info');
    return;
  }
  const nuevaRonda = s.rondaActual + 1;

  try {
    await updateSessionConfig(s.id, (cfg) => {
      const rondas = cfg.rondas || {};
      if (rondas[nuevaRonda.toString()]) {
        rondas[nuevaRonda.toString()].estado = 'activa';
        rondas[nuevaRonda.toString()].iniciadaEn = new Date().toISOString();
      }
      return {
        estado: 'en_curso',
        rondaActual: nuevaRonda,
        tiempoRestante: s.duracionRonda,
        rondas
      };
    });

    sesionActiva.rondaActual = nuevaRonda;
    sesionActiva.estado      = 'en_curso';
    pistasRestantes          = s.pistasDisponibles;

    updateSessionHeader();
    loadMensajeActivo(s.id, nuevaRonda);
    startTimer(s.duracionRonda);

    document.getElementById('btn-iniciar-ronda').disabled  = true;
    document.getElementById('btn-emitir-pista').disabled   = false;
    document.getElementById('btn-finalizar-ronda').disabled = false;
    showToast('¡Ronda iniciada!', 'success');
  } catch (err) {
    showToast('Error al iniciar', 'error');
  }
}

async function finalizarRondaManual() {
  if (!sesionActiva) return;
  stopTimer();
  await finalizarRonda(sesionActiva.id, sesionActiva.rondaActual);
}

async function finalizarRonda(sesionId, numRonda) {
  try {
    await updateSessionConfig(sesionId, (cfg) => {
      const rondas = cfg.rondas || {};
      if (rondas[numRonda.toString()]) {
        rondas[numRonda.toString()].estado = 'finalizada';
      }
      return {
        estado: 'espera',
        rondas
      };
    });

    sesionActiva.estado = 'espera';

    const ses = await getSession(sesionId);
    const rondaData = ses?.rondas?.[numRonda.toString()];
    if (rondaData) {
      mostrarSolucionEnPanel(rondaData);
    }

    document.getElementById('btn-iniciar-ronda').disabled   = false;
    document.getElementById('btn-emitir-pista').disabled    = true;
    document.getElementById('btn-finalizar-ronda').disabled = true;

    updateSessionHeader();
    showToast('Ronda finalizada', 'info');
  } catch (err) {
    showToast('Error al finalizar', 'error');
  }
}

function startTimer(seconds) {
  stopTimer();
  let remaining = seconds;
  const el = document.getElementById('session-timer');
  if(!el) return;
  const tick = async () => {
    el.textContent = formatTime(remaining);
    el.className = 'timer-display';
    if (remaining <= 30) el.classList.add('warning');
    if (remaining <= 10) el.classList.add('danger');
    if (remaining <= 0) {
      stopTimer();
      await finalizarRonda(sesionActiva.id, sesionActiva.rondaActual);
      return;
    }
    if (remaining % 5 === 0) {
      updateSessionConfig(sesionActiva.id, { tiempoRestante: remaining }).catch(() => {});
    }
    remaining--;
  };
  tick();
  timerInterval = setInterval(tick, 1000);
}

function stopTimer() {
  if (timerInterval) {
    clearInterval(timerInterval);
    timerInterval = null;
  }
}

function listenSessionUpdates(sesionId) {
  if (unsubSession) unsubSession();

  unsubSession = listenSession(sesionId, data => {
    if (!data) return;
    sesionActiva = { ...sesionActiva, ...data };

    // Equipos
    const equiposMap = data.equipos || {};
    const equipos = Object.values(equiposMap);
    equipos.sort((a, b) => (b.puntuacion || 0) - (a.puntuacion || 0));

    renderEquipos(equipos);
    renderMarcador(equipos);
    const eqEl = document.getElementById('session-equipos');
    if (eqEl) eqEl.textContent = equipos.length;

    // Intentos recopilados de todos los equipos
    const rondaActual = data.rondaActual;
    let allIntentos = [];
    equipos.forEach(eq => {
      (eq.intentosList || []).forEach(it => {
        if (!rondaActual || it.ronda === rondaActual) {
          allIntentos.push({ equipo: eq.nombre, ...it });
        }
      });
    });
    allIntentos.sort((a, b) => (b.timestamp?.seconds || 0) - (a.timestamp?.seconds || 0));

    const countEl = document.getElementById('intentos-count');
    if (countEl) countEl.textContent = allIntentos.length;
    const list = document.getElementById('intentos-list');
    if (list) {
      if (!allIntentos.length) {
        list.innerHTML = `<div class="empty-state">Esperando intentos...</div>`;
      } else {
        list.innerHTML = allIntentos.slice(0, 20).map(it => {
          const hora = it.hora || '--:--';
          return `
            <div class="intento-item ${it.correcto ? 'correcto' : ''}">
              <div class="intento-equipo">${it.equipo}</div>
              <div class="intento-texto">${it.texto}</div>
              ${it.correcto ? '<span class="badge badge-accent">✓</span>' : ''}
              <div class="intento-tiempo">${hora}</div>
            </div>
          `;
        }).join('');
      }
    }
  });
}

function renderEquipos(equipos) {
  const list = document.getElementById('equipos-list');
  if (!list) return;
  if (!equipos.length) {
    list.innerHTML = `<div class="empty-state" style="padding: 2rem;">Esperando equipos...</div>`;
    return;
  }
  const rankSymbols = ['🥇', '🥈', '🥉'];
  list.innerHTML = equipos.map((eq, idx) => `
    <div class="equipo-item connected">
      <div class="equipo-rank ${idx === 0 ? 'gold' : idx === 1 ? 'silver' : idx === 2 ? 'bronze' : ''}">
        ${rankSymbols[idx] || `#${idx + 1}`}
      </div>
      <div class="equipo-info">
        <div class="equipo-nombre">${eq.nombre || 'Equipo ' + (idx+1)}</div>
      </div>
      <div class="equipo-score">${eq.puntuacion || 0} pts</div>
    </div>
  `).join('');
}

function renderMarcador(equipos) {
  const panel = document.getElementById('marcador-panel');
  if (!panel || !equipos.length) return;
  panel.innerHTML = equipos.map((eq, idx) => `
    <div class="marcador-item">
      <div class="marcador-pos">${['🥇','🥈','🥉'][idx] || `#${idx+1}`}</div>
      <div style="flex: 1;">
        <div style="font-weight:700;">${eq.nombre}</div>
      </div>
      <div style="color:var(--accent); font-weight:700;">${eq.puntuacion || 0} pts</div>
    </div>
  `).join('');
}

async function loadMensajeActivo(sesionId, numRonda) {
  const ses = await getSession(sesionId);
  const rondaData = ses?.rondas?.[numRonda.toString()];
  if (!rondaData) return;
  mostrarSolucionEnPanel(rondaData, false);
}

function mostrarSolucionEnPanel(data, revelarSolucion = true) {
  const panel = document.getElementById('mensaje-activo-panel');
  if (!panel) return;
  panel.innerHTML = `
    <div class="mensaje-campo">
      <div class="mensaje-campo-label">Temática</div>
      <div class="mensaje-campo-val">${data.tematica || '—'}</div>
    </div>
    <div class="mensaje-campo">
      <div class="mensaje-campo-label">Tipo de Cifrado</div>
      <div class="mensaje-campo-val">${data.tipoCifrado || '—'} · Clave: ${data.clave || '—'}</div>
    </div>
    <div class="mensaje-campo">
      <div class="mensaje-campo-label">Texto Cifrado (público)</div>
      <div class="mensaje-campo-val cifrado">${data.textoCifrado || '—'}</div>
    </div>
    ${revelarSolucion ? `
    <div class="mensaje-campo">
      <div class="mensaje-campo-label">✅ Solución (solo profesor)</div>
      <div class="mensaje-campo-val original">${data.solucion || '—'}</div>
    </div>
    ` : ''}
  `;
}

async function emitirPista(tipo) {
  if (!sesionActiva || pistasRestantes <= 0) return;
  const ses = await getSession(sesionActiva.id);
  const rondaData = ses?.rondas?.[sesionActiva.rondaActual.toString()];
  if (!rondaData) return;

  let pistaTxt = '';
  switch (tipo) {
    case 'tipo_cifrado':  pistaTxt = `Tipo: ${rondaData.tipoCifrado}`; break;
    case 'primera_letra': pistaTxt = `Primera letra: "${rondaData.solucion?.[0] || '?'}"`; break;
    case 'longitud':      pistaTxt = `Longitud: ${rondaData.solucion?.length || '?'} caracteres`; break;
    case 'palabra_clave': {
      const words = (rondaData.solucion || '').split(' ').filter(w => w.length > 3);
      const word  = words[Math.floor(Math.random() * words.length)] || '???';
      pistaTxt = `Pista: contiene la palabra "${word}"`;
    } break;
  }

  try {
    await dbEmitHint(sesionActiva.id, sesionActiva.rondaActual, tipo, pistaTxt);
    pistasRestantes--;
    const pEl = document.getElementById('pistas-count');
    if(pEl) pEl.textContent = pistasRestantes;
    document.getElementById('pista-modal')?.classList.add('hidden');
    showToast('Pista emitida', 'info');

    if (pistasRestantes <= 0) {
      document.getElementById('btn-emitir-pista').disabled = true;
    }
  } catch (err) {
    showToast('Error', 'error');
  }
}
