import { requireAuth } from '../../../../../js/common/auth.js';
import { db, doc, collection, setDoc, addDoc, updateDoc, getDoc, query, where, orderBy, limit, arrayUnion, serverTimestamp, onSnapshot } from '../../../../../js/common/firebase-config.js';
import { writeBatch, increment } from '../../../../../js/common/firebase-config.js';
import { saveGameResult } from '../../../../../js/common/db.js';
import { renderHeader, showToast } from '../../../../../js/common/ui.js';
import { generateRoomCode } from '../../../../../js/common/utils.js';

function generateCipherMessage(textoOriginal, tipo, clave) {
  if (tipo === 'caesar') {
    return cifrarCesar(textoOriginal, parseInt(clave));
  } else if (tipo === 'vigenere') {
    return cifrarVigenere(textoOriginal, clave);
  }
  return textoOriginal;
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

let sesionActiva = null;
let dificultadSeleccionada = 'facil';
let mensajesPool = [...MENSAJES_POOL];
let mensajeCustomSeleccionado = null;
let timerInterval = null;
let unsubEquipos = null;
let unsubIntentos = null;
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
    const sesionRef = doc(collection(db, 'live_sessions'), codigo);
    await setDoc(sesionRef, {
      codigo,
      profesorUID:    currentUserObj.uid,
      profesorNombre: currentUserObj.displayName || 'Profesor',
      estado:         'espera',
      rondaActual:    0,
      totalRondas:    rondas,
      duracionRonda:  tiempo,
      dificultad:     dificultadSeleccionada,
      pistasDisponibles: pistas,
      creadaEn:       serverTimestamp()
    });

    const batch = writeBatch(db);
    for (let i = 1; i <= rondas; i++) {
      const msg = mensajesFiltrados[(i - 1) % mensajesFiltrados.length];
      const rondaRef = doc(db, 'live_sessions', codigo, 'rondas', i.toString());
      batch.set(rondaRef, {
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
    await batch.commit();

    sesionActiva = { id: codigo, codigo, rondaActual: 0, totalRondas: rondas, duracionRonda: tiempo, pistasDisponibles: pistas };
    pistasRestantes = pistas;

    window.history.pushState({}, '', `?sesion=${codigo}`);
    showSesionView();
    updateSessionHeader();
    listenEquipos(codigo);
    showToast('Sesión creada', 'success');

  } catch (err) {
    showToast('Error al crear sesión', 'error');
    btnCrear.disabled = false;
    btnCrear.innerHTML = 'Crear Sesión';
  }
}

async function loadExistingSession(sesionId) {
  try {
    const snap = await getDoc(doc(db, 'live_sessions', sesionId));
    if (!snap.exists()) return;
    const data = snap.data();
    if (data.profesorUID !== currentUserObj?.uid) {
      showToast('Esta sesión no es tuya', 'error');
      return;
    }
    sesionActiva = { id: sesionId, ...data };
    pistasRestantes = data.pistasDisponibles || 0;
    showSesionView();
    updateSessionHeader();
    listenEquipos(sesionId);
    if (data.rondaActual > 0 && data.estado === 'en_curso') {
      listenIntentos(sesionId, data.rondaActual);
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
  const sesionRef  = doc(db, 'live_sessions', s.id);
  const rondaRef   = doc(db, 'live_sessions', s.id, 'rondas', nuevaRonda.toString());

  try {
    await updateDoc(sesionRef, {
      estado:      'en_curso',
      rondaActual: nuevaRonda,
      tiempoRestante: s.duracionRonda
    });
    await updateDoc(rondaRef, {
      estado:     'activa',
      iniciadaEn: serverTimestamp()
    });
    sesionActiva.rondaActual = nuevaRonda;
    sesionActiva.estado      = 'en_curso';
    pistasRestantes          = s.pistasDisponibles;

    updateSessionHeader();
    loadMensajeActivo(s.id, nuevaRonda);
    listenIntentos(s.id, nuevaRonda);
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
  const sesionRef = doc(db, 'live_sessions', sesionId);
  const rondaRef  = doc(db, 'live_sessions', sesionId, 'rondas', numRonda.toString());

  try {
    await updateDoc(rondaRef, { estado: 'finalizada' });
    await updateDoc(sesionRef, { estado: 'espera' });
    sesionActiva.estado = 'espera';

    const rondaSnap = await getDoc(rondaRef);
    if(rondaSnap.exists()) {
      mostrarSolucionEnPanel(rondaSnap.data());
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
      updateDoc(doc(db, 'live_sessions', sesionActiva.id), { tiempoRestante: remaining }).catch(() => {});
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

function listenEquipos(sesionId) {
  if (unsubEquipos) unsubEquipos();
  unsubEquipos = onSnapshot(query(collection(db, 'live_sessions', sesionId, 'equipos'), orderBy('puntuacion', 'desc')), snap => {
    const equipos = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    renderEquipos(equipos);
    renderMarcador(equipos);
    const eqEl = document.getElementById('session-equipos');
    if(eqEl) eqEl.textContent = equipos.length;
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

function listenIntentos(sesionId, ronda) {
  if (unsubIntentos) unsubIntentos();
  const list = document.getElementById('intentos-list');
  const countEl = document.getElementById('intentos-count');

  unsubIntentos = onSnapshot(collection(db, 'live_sessions', sesionId, 'equipos'), async equipoSnap => {
    let allIntentos = [];
    
    // Simplification for the migration. We should probably avoid nested onSnapshots.
    // I'll fetch the attempts when teams change. Not fully real-time for nested attempts, 
    // but the original code was also doing .get() inside a teams onSnapshot, which is inefficient.
    // The previous code did:
    // equipos.onSnapshot -> for each team, get intentos for that round. 
    for (const equipoDoc of equipoSnap.docs) {
       const intentosSnap = await getDocs(query(
           collection(db, 'live_sessions', sesionId, 'equipos', equipoDoc.id, 'intentos'), 
           where('ronda', '==', ronda), 
           orderBy('timestamp', 'desc'), 
           limit(10)
       ));
       intentosSnap.docs.forEach(d => {
         allIntentos.push({
           equipo: equipoDoc.data().nombre,
           ...d.data()
         });
       });
    }

    allIntentos.sort((a, b) => (b.timestamp?.seconds || 0) - (a.timestamp?.seconds || 0));
    if (countEl) countEl.textContent = allIntentos.length;
    if (!allIntentos.length && list) {
      list.innerHTML = `<div class="empty-state">Esperando intentos...</div>`;
      return;
    }
    if (list) {
      list.innerHTML = allIntentos.slice(0, 20).map(it => {
        const ts = it.timestamp?.toDate?.() ? new Date(it.timestamp.toDate()) : null;
        const hora = ts ? ts.toLocaleTimeString('es-ES') : '--:--';
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
  });
}

async function loadMensajeActivo(sesionId, numRonda) {
  const rondaSnap = await getDoc(doc(db, 'live_sessions', sesionId, 'rondas', numRonda.toString()));
  if (!rondaSnap.exists()) return;
  mostrarSolucionEnPanel(rondaSnap.data(), false);
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
  const rondaRef = doc(db, 'live_sessions', sesionActiva.id, 'rondas', sesionActiva.rondaActual.toString());
  const rondaSnap = await getDoc(rondaRef);
  if(!rondaSnap.exists()) return;
  const rondaData = rondaSnap.data();

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
    await updateDoc(rondaRef, {
      pistas: arrayUnion({ tipo, texto: pistaTxt, timestamp: new Date().toISOString() })
    });
    await updateDoc(doc(db, 'live_sessions', sesionActiva.id), {
      pistasDisponibles: increment(-1)
    });

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
