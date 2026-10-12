import { db, doc, getDoc, setDoc, updateDoc, serverTimestamp, onSnapshot } from './common/firebase-config.js';
import { requireAuth } from './common/auth.js';
import { renderHeader, showToast, showLoading, hideLoading } from './common/ui.js';
import { $, $$, escapeHtml, getUrlParams } from './common/utils.js';

let user;
let currentProfile = null;
let examen = null;
let respuestaDoc = null;
let respuestaRef = null;
let currentQIndex = 0;
let timerInterval = null;
let warnings = 0;
let exId = null;

async function init() {
  exId = getUrlParams().id;
  if (!exId) {
    showFinished('El examen no existe.');
    return;
  }
  
  requireAuth({
    allowedRoles: ['student', 'teacher', 'admin'],
    onAuthorized: async (u, profile) => {
      user = u;
      currentProfile = profile;
      
      $('#ex-student').textContent = `${profile.nombre || 'Alumno'}`;
      
      onSnapshot(doc(db, 'examenes_test', exId), (snap) => {
        if (!snap.exists()) {
          showFinished('El examen no existe.');
          return;
        }
        
        examen = snap.data();
        examen.id = snap.id;
        $('#ex-title').textContent = examen.titulo || 'Examen Test';
        
        checkExamenStatus();
      });
    }
  });

  $('#btn-entregar').addEventListener('click', () => confirmarEntregarExamen());
  $('#btn-prev').addEventListener('click', () => prevQuestion());
  $('#btn-next').addEventListener('click', () => nextQuestion());
}

async function checkExamenStatus() {
  respuestaRef = doc(db, 'respuestas_test', `${exId}_${user.uid}`);
  const rSnap = await getDoc(respuestaRef);
  
  if (rSnap.exists()) {
    respuestaDoc = rSnap.data();
  }
  
  if (respuestaDoc && respuestaDoc.entregadoEn) {
    stopExamAndShowResults();
    return;
  }
  
  if (examen.estado !== 'activo') {
    showFinished('El examen no está disponible en este momento.');
    return;
  }
  
  if (!respuestaDoc) {
    await initStudentState();
  } else {
    startTimer();
    renderNav();
    showQuestion(0);
    setupAntiCheat();
    
    $('#loading-ui').style.display = 'none';
    $('#exam-ui').style.display = 'flex';
  }
}

async function initStudentState() {
  const qIndices = Array.from({length: examen.preguntas.length}, (_, i) => i);
  shuffleArray(qIndices);
  
  const oIndicesMap = {};
  examen.preguntas.forEach(q => {
    const oIndices = Array.from({length: q.opciones.length}, (_, i) => i);
    shuffleArray(oIndices);
    oIndicesMap[q.id] = oIndices;
  });
  
  respuestaDoc = {
    examenId: exId,
    uid: user.uid,
    claseId: examen.claseId,
    ordenPreguntas: qIndices,
    ordenOpciones: oIndicesMap,
    respuestas: {},
    empezadoEn: serverTimestamp(),
    entregadoEn: null,
    anuladoPorTrampas: false
  };
  
  await setDoc(respuestaRef, respuestaDoc);
  
  startTimer();
  renderNav();
  showQuestion(0);
  setupAntiCheat();
  
  $('#loading-ui').style.display = 'none';
  $('#exam-ui').style.display = 'flex';
}

function startTimer() {
  if (timerInterval) clearInterval(timerInterval);
  
  if (!examen.activadoEn || !examen.tiempoMinutos) {
    $('#timer').textContent = '--:--';
    return;
  }
  
  const startTime = examen.activadoEn.toDate().getTime();
  const endTime = startTime + (examen.tiempoMinutos * 60 * 1000);
  
  timerInterval = setInterval(async () => {
    const now = new Date().getTime();
    const diff = endTime - now;
    
    if (diff <= 0) {
      clearInterval(timerInterval);
      $('#timer').textContent = '00:00';
      showToast('Tiempo agotado. Entregando examen automáticamente...', 'error');
      await entregarExamen();
      return;
    }
    
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    const seconds = Math.floor((diff % (1000 * 60)) / 1000);
    
    $('#timer').textContent = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    
    if (diff < 60000) {
      $('#timer').classList.add('danger');
    } else {
      $('#timer').classList.remove('danger');
    }
  }, 1000);
}

function renderNav() {
  const nav = $('#q-nav');
  nav.innerHTML = '';
  $('#q-total-num').textContent = respuestaDoc.ordenPreguntas.length;
  
  let answered = 0;
  
  respuestaDoc.ordenPreguntas.forEach((qIdx, renderIdx) => {
    const btn = document.createElement('div');
    btn.className = 'q-btn';
    btn.textContent = renderIdx + 1;
    btn.id = `nav-btn-${renderIdx}`;
    btn.addEventListener('click', () => showQuestion(renderIdx));
    
    const realQ = examen.preguntas[qIdx];
    if (respuestaDoc.respuestas && respuestaDoc.respuestas[realQ.id] !== undefined) {
      btn.classList.add('answered');
      answered++;
    }
    
    nav.appendChild(btn);
  });
  
  $('#count-ans').textContent = answered;
  $('#count-pend').textContent = respuestaDoc.ordenPreguntas.length - answered;
}

function showQuestion(renderIdx) {
  currentQIndex = renderIdx;
  
  $$('.q-btn').forEach(btn => btn.classList.remove('active'));
  $(`#nav-btn-${renderIdx}`).classList.add('active');
  
  const qIdx = respuestaDoc.ordenPreguntas[renderIdx];
  const q = examen.preguntas[qIdx];
  const oIndices = respuestaDoc.ordenOpciones[q.id];
  const answeredIdx = respuestaDoc.respuestas ? respuestaDoc.respuestas[q.id] : undefined;
  
  $('#q-current-num').textContent = renderIdx + 1;
  $('#q-tema-badge').textContent = q.tema || 'General';
  $('#q-text').innerHTML = escapeHtml(q.enunciado).replace(/\n/g, '<br>');
  
  const optsContainer = $('#q-options');
  optsContainer.innerHTML = '';
  
  const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  
  oIndices.forEach((optOrigIdx, idx) => {
    const opt = q.opciones[optOrigIdx];
    const lbl = document.createElement('label');
    lbl.className = `option-label ${answeredIdx === optOrigIdx ? 'selected' : ''}`;
    
    const circle = document.createElement('div');
    circle.className = `option-circle ${answeredIdx === optOrigIdx ? 'checked' : ''}`;
    circle.textContent = letters[idx];
    
    const text = document.createElement('div');
    text.style.flexGrow = '1';
    text.innerHTML = escapeHtml(opt.texto);
    
    lbl.appendChild(circle);
    lbl.appendChild(text);
    
    lbl.addEventListener('click', () => selectOption(q.id, optOrigIdx, renderIdx));
    optsContainer.appendChild(lbl);
  });
  
  $('#btn-prev').disabled = renderIdx === 0;
  $('#btn-next').disabled = renderIdx === respuestaDoc.ordenPreguntas.length - 1;
}

async function selectOption(qId, optOrigIdx, renderIdx) {
  if (examen.estado !== 'activo') return;
  
  const isSelected = respuestaDoc.respuestas && respuestaDoc.respuestas[qId] === optOrigIdx;
  
  if (!respuestaDoc.respuestas) respuestaDoc.respuestas = {};
  
  if (isSelected) {
    delete respuestaDoc.respuestas[qId];
  } else {
    respuestaDoc.respuestas[qId] = optOrigIdx;
  }
  
  // Optimistic UI
  showQuestion(renderIdx);
  renderNav();
  $(`#nav-btn-${renderIdx}`).classList.add('active'); // re-apply active state
  
  // Save in background
  try {
    await updateDoc(respuestaRef, {
      [`respuestas.${qId}`]: isSelected ? null : optOrigIdx
    });
  } catch (err) {
    console.error(err);
    showToast('Error al guardar respuesta', 'error');
  }
}

function prevQuestion() {
  if (currentQIndex > 0) showQuestion(currentQIndex - 1);
}

function nextQuestion() {
  if (currentQIndex < respuestaDoc.ordenPreguntas.length - 1) showQuestion(currentQIndex + 1);
}

function confirmarEntregarExamen() {
  const answered = Object.keys(respuestaDoc.respuestas || {}).length;
  const total = respuestaDoc.ordenPreguntas.length;
  const pend = total - answered;
  
  let warningHtml = pend > 0 ? `<p style="color:var(--error); font-weight:bold;">¡ATENCIÓN! Tienes ${pend} pregunta(s) sin responder.</p>` : '';
  
  const div = document.createElement('div');
  div.className = 'modal-backdrop modal-backdrop--visible';
  div.innerHTML = `
    <div class="modal-box">
      <div class="modal-header"><h3>Entregar Examen</h3></div>
      <div class="modal-body">
        ${warningHtml}
        <p>¿Seguro que quieres entregar el examen? Ya no podrás cambiar tus respuestas.</p>
        <div style="display:flex; justify-content:flex-end; gap:10px; margin-top:20px;">
          <button class="btn btn-ghost" onclick="this.closest('.modal-backdrop').remove()">Cancelar</button>
          <button class="btn btn-primary" onclick="this.closest('.modal-backdrop').remove(); window._entregarDefinitivo()">Sí, Entregar</button>
        </div>
      </div>
    </div>
  `;
  document.body.appendChild(div);
  window._entregarDefinitivo = entregarExamen;
}

async function entregarExamen() {
  try {
    showLoading();
    $('#exam-header').style.display = 'none';
    if (timerInterval) clearInterval(timerInterval);
    
    window.removeEventListener('blur', handleFocusLost);
    document.removeEventListener('visibilitychange', handleVisibilityChange);
    
    await updateDoc(respuestaRef, {
      entregadoEn: serverTimestamp()
    });
    
    const rSnap = await getDoc(respuestaRef);
    respuestaDoc = rSnap.data();
    
    hideLoading();
    stopExamAndShowResults();
  } catch (err) {
    hideLoading();
    console.error(err);
    showToast('Error al entregar el examen', 'error');
  }
}

function stopExamAndShowResults() {
  $('#exam-header').style.display = 'none';
  $('#loading-ui').style.display = 'none';
  $('#exam-ui').style.display = 'none';
  $('#finished-ui').style.display = 'block';
  
  if (examen.resultadosPublicados && respuestaDoc.entregadoEn) {
    showGrades();
  } else if (respuestaDoc.anuladoPorTrampas) {
    showFinished('Tu examen ha sido anulado por salir de la pestaña.', 'error');
  } else {
    showFinished('Tus respuestas han sido registradas correctamente. Espera a que el profesor publique las notas.');
  }
}

function showFinished(msg, type = 'success') {
  $('#loading-ui').style.display = 'none';
  $('#exam-ui').style.display = 'none';
  $('#finished-ui').style.display = 'block';
  $('#finished-ui').innerHTML = `
    <div style="font-size:4rem; color:var(--${type === 'error' ? 'error' : 'success'}); margin-bottom:var(--space-3,12px);">
      ${type === 'error' ? '❌' : '✓'}
    </div>
    <h1 style="margin-bottom:var(--space-2,8px);">${type === 'error' ? 'Examen Anulado' : 'Examen Entregado'}</h1>
    <p style="color:var(--text-muted,#888); font-size:1.1rem; margin-bottom:var(--space-5,20px);">${escapeHtml(msg)}</p>
    <div>
      <a href="dashboard_student.html" class="btn btn-primary">Volver a mis clases</a>
    </div>
  `;
}

function showGrades() {
  $('#grade-container').style.display = 'block';
  $('#review-container').style.display = 'block';
  
  const aciertos = Object.keys(respuestaDoc.respuestas || {}).filter(qId => 
    examen.correcciones && examen.correcciones[qId] === respuestaDoc.respuestas[qId]
  ).length;
  
  const total = examen.preguntas.length;
  const respondidas = Object.keys(respuestaDoc.respuestas || {}).length;
  const errores = respondidas - aciertos;
  const blancos = total - respondidas;
  
  $('#final-grade').textContent = respuestaDoc.nota ? respuestaDoc.nota.toFixed(2) : '-';
  $('#stat-correct').textContent = aciertos;
  $('#stat-incorrect').textContent = errores;
  $('#stat-blank').textContent = blancos;
  
  const revList = $('#review-list');
  revList.innerHTML = '';
  
  respuestaDoc.ordenPreguntas.forEach((qIdx, renderIdx) => {
    const q = examen.preguntas[qIdx];
    const ansIdx = respuestaDoc.respuestas ? respuestaDoc.respuestas[q.id] : undefined;
    const correctIdx = examen.correcciones ? examen.correcciones[q.id] : undefined;
    
    const isCorrect = ansIdx !== undefined && ansIdx === correctIdx;
    const isBlank = ansIdx === undefined;
    const isError = !isCorrect && !isBlank;
    
    let stateColor = isCorrect ? 'var(--success,#27ae60)' : (isError ? 'var(--error,#e74c3c)' : 'var(--warning,#f39c12)');
    let stateIcon = isCorrect ? '✓' : (isError ? '✗' : '—');
    
    const div = document.createElement('div');
    div.style.cssText = `border:1px solid var(--border,#ddd); border-radius:var(--radius-md,8px); margin-bottom:var(--space-4,16px); padding:var(--space-4,16px); border-left:4px solid ${stateColor};`;
    
    let html = `
      <div style="display:flex; justify-content:space-between; margin-bottom:var(--space-2,8px);">
        <strong style="color:${stateColor};">Pregunta ${renderIdx + 1}</strong>
        <span style="color:${stateColor}; font-weight:bold;">${stateIcon}</span>
      </div>
      <div style="font-size:1.1rem; margin-bottom:var(--space-3,12px);">${escapeHtml(q.enunciado).replace(/\n/g, '<br>')}</div>
    `;
    
    respuestaDoc.ordenOpciones[q.id].forEach((optOrigIdx, idx) => {
      const opt = q.opciones[optOrigIdx];
      const isAns = ansIdx === optOrigIdx;
      const isCorr = correctIdx === optOrigIdx;
      
      let optStyle = `padding:8px 12px; margin-bottom:4px; border-radius:4px; background:#f8f9fa;`;
      let badge = '';
      
      if (isCorr) {
        optStyle = `padding:8px 12px; margin-bottom:4px; border-radius:4px; background:rgba(39,174,96,0.1); border:1px solid var(--success,#27ae60); font-weight:bold;`;
        badge = `<span class="badge badge--success" style="float:right;">Correcta</span>`;
      } else if (isAns && isError) {
        optStyle = `padding:8px 12px; margin-bottom:4px; border-radius:4px; background:rgba(231,76,60,0.1); border:1px solid var(--error,#e74c3c);`;
        badge = `<span class="badge badge--error" style="float:right;">Tu respuesta</span>`;
      } else if (isAns) {
        badge = `<span class="badge badge--success" style="float:right;">Tu respuesta</span>`;
      }
      
      html += `<div style="${optStyle}">
        ${'ABCD'[idx]}. ${escapeHtml(opt.texto)}
        ${badge}
      </div>`;
    });
    
    div.innerHTML = html;
    revList.appendChild(div);
  });
}

function handleFocusLost() {
  if (examen.estado !== 'activo' || !respuestaDoc || respuestaDoc.entregadoEn) return;
  
  warnings++;
  if (warnings === 1) {
    showToast('⚠️ ADVERTENCIA', 'Has salido de la pestaña del examen. Si vuelves a salir, se entregará automáticamente.', 'warning');
  } else {
    showToast('❌ ADVERTENCIA', 'Has salido repetidamente. El examen será anulado y entregado.', 'error');
    updateDoc(respuestaRef, {
      entregadoEn: serverTimestamp(),
      anuladoPorTrampas: true
    }).then(() => {
      window.location.reload();
    });
  }
}

function handleVisibilityChange() {
  if (document.hidden) handleFocusLost();
}

function setupAntiCheat() {
  window.addEventListener('blur', handleFocusLost);
  document.addEventListener('visibilitychange', handleVisibilityChange);
}

function shuffleArray(array) {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
}

document.addEventListener('DOMContentLoaded', init);
