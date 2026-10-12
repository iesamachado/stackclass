import { db, doc, getDoc, getDocs, collection, query, where, updateDoc, serverTimestamp } from './common/firebase-config.js';
import { renderHeader, showToast } from './common/ui.js';
import { requireAuth } from './common/auth.js';
import { $, $$, escapeHtml, getUrlParams, TOPICS } from './common/utils.js';
import { addXPAndCheckLogros, awardMedal } from './common/gamification.js';

let examenId = null;
let examen = null;
let entregas = [];
let usersMap = {};

async function init() {
  examenId = getUrlParams().id;
  if (!examenId) return;
  
  requireAuth({
    allowedRoles: ['teacher', 'admin'],
    onAuthorized: async (user, profile) => {
      renderHeader(profile);
      await loadExamen();
      setupTabs();
      setupModals();
      
      $('#btn-toggle-state').addEventListener('click', toggleExamenState);
      $('#btn-toggle-results').addEventListener('click', toggleResultados);
      $('#btn-print').addEventListener('click', printExams);
    }
  });
}

async function loadExamen() {
  const snap = await getDoc(doc(db, 'examenes_test', examenId));
  if (!snap.exists()) return;
  
  examen = snap.data();
  examen.id = snap.id;
  
  $('#ex-title').textContent = examen.titulo;
  $('#ex-meta').textContent = `${examen.preguntas.length} preguntas · ${examen.tiempoMinutos} min`;
  
  const stateBtn = $('#btn-toggle-state');
  stateBtn.style.display = 'inline-block';
  if (examen.estado === 'activo') {
    stateBtn.textContent = 'Cerrar Examen';
    stateBtn.className = 'btn btn-ghost badge--error';
  } else {
    stateBtn.textContent = 'Activar Examen';
    stateBtn.className = 'btn btn-ghost badge--success';
  }
  
  const resultsBtn = $('#btn-toggle-results');
  if (examen.resultadosPublicados) {
    resultsBtn.textContent = 'Resultados Publicados';
    resultsBtn.disabled = true;
  }
  
  await loadEntregas();
}

async function loadEntregas() {
  const q = query(collection(db, 'respuestas_test'), where('examenId', '==', examenId));
  const snaps = await getDocs(q);
  
  entregas = [];
  const uids = new Set();
  
  snaps.forEach(doc => {
    const data = doc.data();
    data.id = doc.id;
    entregas.push(data);
    uids.add(data.uid);
  });
  
  // Fetch user data
  if (uids.size > 0) {
    for (let uid of uids) {
      const uSnap = await getDoc(doc(db, 'users', uid));
      if (uSnap.exists()) {
        usersMap[uid] = uSnap.data();
      }
    }
  }
  
  await processAndRenderEntregas();
}

async function processAndRenderEntregas() {
  const list = $('#resultados-list');
  list.innerHTML = '';
  
  if (entregas.length === 0) {
    list.innerHTML = '<tr><td colspan="5" style="text-align:center; padding:24px;">No hay entregas todavía.</td></tr>';
    return;
  }
  
  // Calculate scores
  for (let entrega of entregas) {
    const aciertos = Object.keys(entrega.respuestas || {}).filter(qId => 
      examen.correcciones && examen.correcciones[qId] === entrega.respuestas[qId]
    ).length;
    
    const respondidas = Object.keys(entrega.respuestas || {}).length;
    const errores = respondidas - aciertos;
    const blancos = examen.preguntas.length - respondidas;
    
    const penalizacion = errores / 3.0;
    const aciertosNetos = Math.max(0, aciertos - penalizacion);
    const nota = (aciertosNetos / examen.preguntas.length) * 10;
    
    entrega.calculado = { aciertos, errores, blancos, nota };
    
    // Auto-update if it hasn't been saved yet or changed
    if (!entrega.nota || Math.abs(entrega.nota - nota) > 0.01) {
      try {
        await updateDoc(doc(db, 'respuestas_test', entrega.id), {
          nota: nota
        });
        entrega.nota = nota;
      } catch (err) {
        console.error("Error updating score", err);
      }
    }
  }
  
  entregas.sort((a, b) => (b.calculado.nota || 0) - (a.calculado.nota || 0));
  
  let html = '';
  entregas.forEach(entrega => {
    const user = usersMap[entrega.uid] || { nombre: 'Desconocido' };
    const date = entrega.entregadoEn ? entrega.entregadoEn.toDate().toLocaleString() : 'No entregado';
    const c = entrega.calculado;
    
    html += `
      <tr>
        <td style="text-align:left;"><strong>${escapeHtml(user.nombre)}</strong></td>
        <td>${date}</td>
        <td>
          <span style="color:var(--success,#27ae60); font-weight:bold;">${c.aciertos}</span> / 
          <span style="color:var(--error,#e74c3c); font-weight:bold;">${c.errores}</span> / 
          <span style="color:var(--warning,#f39c12); font-weight:bold;">${c.blancos}</span>
        </td>
        <td><strong>${c.nota.toFixed(2)}</strong></td>
        <td class="no-print">
          <button class="btn btn-ghost" onclick="reviewStudent('${entrega.id}')">Revisar</button>
        </td>
      </tr>
    `;
  });
  
  list.innerHTML = html;
  generateAnalysis();
}

function generateAnalysis() {
  if (entregas.length === 0 || !examen.correcciones) return;
  
  const qStats = {};
  examen.preguntas.forEach(q => {
    qStats[q.id] = { aciertos: 0, errores: 0, blancos: 0 };
  });
  
  entregas.forEach(entrega => {
    examen.preguntas.forEach(q => {
      const ans = entrega.respuestas ? entrega.respuestas[q.id] : undefined;
      const corr = examen.correcciones[q.id];
      if (ans === undefined) {
        qStats[q.id].blancos++;
      } else if (ans === corr) {
        qStats[q.id].aciertos++;
      } else {
        qStats[q.id].errores++;
      }
    });
  });
  
  let analysisHtml = `<div style="margin-bottom:20px;"><h3>Análisis por Pregunta</h3><table class="ranking-table" style="width:100%; text-align:left;">
    <thead><tr><th>Pregunta</th><th>Aciertos</th><th>Errores</th><th>Blancos</th><th>Acción</th></tr></thead><tbody>`;
    
  examen.preguntas.forEach((q, idx) => {
    const st = qStats[q.id];
    const total = entregas.length;
    const pAc = Math.round((st.aciertos / total) * 100) || 0;
    
    analysisHtml += `
      <tr>
        <td>${idx + 1}. ${escapeHtml(q.enunciado).substring(0, 50)}...</td>
        <td><span style="color:var(--success,#27ae60)">${st.aciertos} (${pAc}%)</span></td>
        <td><span style="color:var(--error,#e74c3c)">${st.errores}</span></td>
        <td><span style="color:var(--warning,#f39c12)">${st.blancos}</span></td>
        <td><button class="btn btn-ghost" onclick="showQuestionDetails('${q.id}')">Ver Detalle</button></td>
      </tr>
    `;
  });
  analysisHtml += `</tbody></table></div>`;
  $('#analysis-container').innerHTML = analysisHtml;
  
  window.qStats = qStats; // for modals
}

async function toggleExamenState() {
  const newState = examen.estado === 'activo' ? 'cerrado' : 'activo';
  try {
    await updateDoc(doc(db, 'examenes_test', examenId), { estado: newState });
    if (newState === 'activo') {
      await updateDoc(doc(db, 'examenes_test', examenId), { activadoEn: serverTimestamp() });
    }
    showToast(`Examen marcado como ${newState}`);
    await loadExamen();
  } catch (e) {
    console.error(e);
    showToast('Error al cambiar estado', 'error');
  }
}

async function toggleResultados() {
  if (examen.resultadosPublicados) return;
  const div = document.createElement('div');
  div.className = 'modal-backdrop modal-backdrop--visible';
  div.innerHTML = `
    <div class="modal-box">
      <div class="modal-header"><h3>Publicar Resultados</h3></div>
      <div class="modal-body">
        <p>¿Seguro que quieres publicar los resultados? Esto otorgará XP y medallas a los alumnos.</p>
        <div style="display:flex; justify-content:flex-end; gap:10px; margin-top:20px;">
          <button class="btn btn-ghost" onclick="this.closest('.modal-backdrop').remove()">Cancelar</button>
          <button class="btn btn-primary" onclick="this.closest('.modal-backdrop').remove(); window._toggleResultadosReal()">Sí, Publicar</button>
        </div>
      </div>
    </div>
  `;
  document.body.appendChild(div);
  
  window._toggleResultadosReal = async () => {
  
  try {
    await updateDoc(doc(db, 'examenes_test', examenId), { resultadosPublicados: true });
    
    for (let entrega of entregas) {
      if (entrega.puntosOtorgados) continue;
      const nota = entrega.calculado.nota;
      let xp = 5 + (nota >= 5 ? 5 : 0) + (nota > 9 ? 5 : 0);
      
      await addXPAndCheckLogros(entrega.uid, xp);
      await awardMedal(entrega.uid, 'primer_examen');
      if (nota >= 9.5) await awardMedal(entrega.uid, 'maestro_teoria');
      if (nota >= 8.5 && nota < 9.5) await awardMedal(entrega.uid, 'casi_perfecto');
      if (Math.abs(nota - 5.0) < 0.1) await awardMedal(entrega.uid, 'por_los_pelos');
      
      await updateDoc(doc(db, 'respuestas_test', entrega.id), { puntosOtorgados: true });
    }
    
    showToast('Resultados publicados con éxito');
    await loadExamen();
  } catch (e) {
    console.error(e);
    showToast('Error al publicar', 'error');
  }
  };
}

window.reviewStudent = function(entregaId) {
  const entrega = entregas.find(e => e.id === entregaId);
  const user = usersMap[entrega.uid];
  
  $('#review-student-name').textContent = `Revisión: ${user.nombre}`;
  
  let html = `<div style="margin-bottom:16px;"><strong>Nota:</strong> ${entrega.calculado.nota.toFixed(2)}</div>`;
  
  entrega.ordenPreguntas.forEach((qIdx, renderIdx) => {
    const q = examen.preguntas[qIdx];
    const ansIdx = entrega.respuestas ? entrega.respuestas[q.id] : undefined;
    const correctIdx = examen.correcciones ? examen.correcciones[q.id] : undefined;
    
    const isCorrect = ansIdx !== undefined && ansIdx === correctIdx;
    const isBlank = ansIdx === undefined;
    const isError = !isCorrect && !isBlank;
    
    let stateColor = isCorrect ? 'var(--success,#27ae60)' : (isError ? 'var(--error,#e74c3c)' : 'var(--warning,#f39c12)');
    let stateIcon = isCorrect ? '✓' : (isError ? '✗' : '—');
    
    html += `
      <div style="border:1px solid var(--border,#ddd); border-radius:8px; margin-bottom:16px; padding:16px; border-left:4px solid ${stateColor};">
        <div style="display:flex; justify-content:space-between; margin-bottom:8px;">
          <strong style="color:${stateColor};">Pregunta ${renderIdx + 1}</strong>
          <span style="color:${stateColor}; font-weight:bold;">${stateIcon}</span>
        </div>
        <div style="font-size:1.1rem; margin-bottom:12px;">${escapeHtml(q.enunciado).replace(/\n/g, '<br>')}</div>
    `;
    
    entrega.ordenOpciones[q.id].forEach((optOrigIdx, idx) => {
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
        badge = `<span class="badge badge--error" style="float:right;">Respuesta Alumno</span>`;
      } else if (isAns) {
        badge = `<span class="badge badge--success" style="float:right;">Respuesta Alumno</span>`;
      }
      
      html += `<div style="${optStyle}">${'ABCD'[idx]}. ${escapeHtml(opt.texto)} ${badge}</div>`;
    });
    html += `</div>`;
  });
  
  $('#review-student-body').innerHTML = html;
  $('#modal-review').classList.add('active');
};

window.showQuestionDetails = function(qId) {
  const q = examen.preguntas.find(p => p.id === qId);
  const stats = window.qStats[qId];
  
  let html = `
    <div style="margin-bottom:16px;"><strong>Enunciado:</strong><br>${escapeHtml(q.enunciado)}</div>
    <div class="stats-grid">
      <div class="card stat-card stat-card--success"><div class="stat-value">${stats.aciertos}</div><div class="stat-label">Aciertos</div></div>
      <div class="card stat-card stat-card--error"><div class="stat-value">${stats.errores}</div><div class="stat-label">Errores</div></div>
      <div class="card stat-card stat-card--warning"><div class="stat-value">${stats.blancos}</div><div class="stat-label">Blancos</div></div>
    </div>
  `;
  
  $('#qdetail-body').innerHTML = html;
  $('#modal-qdetail').classList.add('active');
};

function setupTabs() {
  $$('.tab-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      $$('.tab-btn').forEach(b => b.classList.remove('tab-btn--active'));
      $$('.tab-content').forEach(c => c.style.display = 'none');
      e.target.classList.add('tab-btn--active');
      $(`#tab-${e.target.dataset.tab}`).style.display = 'block';
    });
  });
}

function setupModals() {
  $('#btn-close-review').addEventListener('click', () => $('#modal-review').classList.remove('active'));
  $('#btn-close-qdetail').addEventListener('click', () => $('#modal-qdetail').classList.remove('active'));
}

function printExams() {
  const printArea = $('#print-area');
  
  let html = `<div class="page-break">
    <div class="print-header"><h2>${escapeHtml(examen.titulo)} - VERSIÓN A</h2><p>Nombre: ___________________________________ Fecha: ____________</p></div>
  `;
  
  examen.preguntas.forEach((q, idx) => {
    html += `<div class="print-q"><strong>${idx+1}. ${escapeHtml(q.enunciado)}</strong><br>`;
    q.opciones.forEach((o, oidx) => {
      html += `<div class="print-opt">${'ABCD'[oidx]}. ${escapeHtml(o.texto)}</div>`;
    });
    html += `</div>`;
  });
  html += `</div>`;
  
  printArea.innerHTML = html;
  printArea.style.display = 'block';
  window.print();
  printArea.style.display = 'none';
}

document.addEventListener('DOMContentLoaded', init);
