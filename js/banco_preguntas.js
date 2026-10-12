import { db, collection, getDocs, addDoc, updateDoc, deleteDoc, doc, serverTimestamp, query, where } from './common/firebase-config.js';
import { renderHeader, showToast, showModal, showLoading, hideLoading } from './common/ui.js';
import { requireAuth } from './common/auth.js';
import { TOPICS, $, escapeHtml, CYR_EVALUATION_DATA } from './common/utils.js';

let preguntas = [];
let filteredPreguntas = [];
let currentPage = 1;
const itemsPerPage = 100;
let selectedIds = new Set();
let currentUser = null;

async function init() {
  requireAuth({
    allowedRoles: ['teacher', 'admin'],
    onAuthorized: async (user, profile) => {
      currentUser = user;
      renderHeader(user, profile);
      populateBlocks();
      setupListeners();
      await loadPreguntas();
    }
  });
}

function populateBlocks() {
  const filterSelect = $('filter-block');
  const formSelect = $('p-block');
  
  if (!filterSelect || !formSelect) return;
  
  Object.keys(TOPICS).forEach(key => {
    const topic = TOPICS[key];
    const optionHTML = `<option value="${key}">${topic.name}</option>`;
    filterSelect.insertAdjacentHTML('beforeend', optionHTML);
    formSelect.insertAdjacentHTML('beforeend', optionHTML);
  });
}

function setupListeners() {
  // Filtros
  $('filter-block')?.addEventListener('change', () => {
    currentPage = 1;
    renderPreguntas();
  });
  
  $('filter-text')?.addEventListener('input', (e) => {
    currentPage = 1;
    renderPreguntas();
  });

  // Paginación
  $('btn-prev-page')?.addEventListener('click', () => {
    if (currentPage > 1) {
      currentPage--;
      renderPreguntas();
    }
  });
  
  $('btn-next-page')?.addEventListener('click', () => {
    const totalPages = Math.ceil(filteredPreguntas.length / itemsPerPage);
    if (currentPage < totalPages) {
      currentPage++;
      renderPreguntas();
    }
  });

  // Modal de Pregunta
  $('btn-nueva-pregunta')?.addEventListener('click', () => {
    $('form-pregunta').reset();
    $('p-id').value = '';
    $('modal-pregunta-title').textContent = 'Nueva Pregunta';
    $('modal-pregunta').classList.add('modal-backdrop--visible');
  });

  $('btn-close-modal')?.addEventListener('click', () => {
    $('modal-pregunta').classList.remove('modal-backdrop--visible');
  });
  
  $('btn-cancel-modal')?.addEventListener('click', () => {
    $('modal-pregunta').classList.remove('modal-backdrop--visible');
  });

  $('form-pregunta')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    await savePregunta();
  });

  // Importar JSON
  $('btn-import-json')?.addEventListener('click', () => {
    $('file-import-json').click();
  });
  
  $('file-import-json')?.addEventListener('change', importJson);

  // Borrado múltiple
  $('btn-delete-selected')?.addEventListener('click', deleteSelected);

  // Checkbox global
  $('chk-all')?.addEventListener('change', (e) => {
    const isChecked = e.target.checked;
    const pageItems = getPageItems();
    
    pageItems.forEach(p => {
      if (isChecked) {
        selectedIds.add(p.id);
      } else {
        selectedIds.delete(p.id);
      }
    });
    
    // Update individual checkboxes
    document.querySelectorAll('.chk-pregunta').forEach(chk => {
      chk.checked = isChecked;
    });
    
    updateSelectionUI();
  });

  // Modal Cobertura
  $('btn-show-coverage')?.addEventListener('click', showCoverage);
  $('btn-close-cobertura')?.addEventListener('click', () => {
    $('modal-cobertura').classList.remove('modal-backdrop--visible');
  });
}

async function loadPreguntas() {
  try {
    const listEl = $('preguntas-list');
    listEl.innerHTML = '<div style="padding:var(--space-6); text-align:center; color:var(--text-muted);">Cargando preguntas...</div>';
    
    const querySnapshot = await getDocs(collection(db, 'preguntas'));
    preguntas = [];
    
    querySnapshot.forEach(docSnap => {
      preguntas.push({
        id: docSnap.id,
        ...docSnap.data()
      });
    });
    
    // Sort by block, then CE
    preguntas.sort((a, b) => {
      if (a.block !== b.block) return a.block.localeCompare(b.block);
      return (a.ce || 0) - (b.ce || 0);
    });
    
    renderPreguntas();
  } catch (error) {
    console.error('Error loading preguntas:', error);
    showToast('Error al cargar preguntas', 'error');
  }
}

function getPageItems() {
  const startIndex = (currentPage - 1) * itemsPerPage;
  return filteredPreguntas.slice(startIndex, startIndex + itemsPerPage);
}

function renderPreguntas() {
  const blockFilter = $('filter-block')?.value;
  const textFilter = $('filter-text')?.value.toLowerCase();
  
  filteredPreguntas = preguntas.filter(p => {
    const matchesBlock = !blockFilter || p.block === blockFilter;
    const matchesText = !textFilter || (p.enunciado && p.enunciado.toLowerCase().includes(textFilter));
    return matchesBlock && matchesText;
  });
  
  const totalPages = Math.ceil(filteredPreguntas.length / itemsPerPage) || 1;
  if (currentPage > totalPages) currentPage = totalPages;
  
  const listEl = $('preguntas-list');
  listEl.innerHTML = '';
  
  if (filteredPreguntas.length === 0) {
    listEl.innerHTML = '<div style="padding:var(--space-6); text-align:center; color:var(--text-muted);">No hay preguntas que coincidan con los filtros.</div>';
  } else {
    const pageItems = getPageItems();
    
    pageItems.forEach(p => {
      const blockName = TOPICS[p.block]?.name || p.block;
      const row = document.createElement('div');
      row.className = 'question-row';
      row.innerHTML = `
        <div><input type="checkbox" class="chk-pregunta" data-id="${p.id}" ${selectedIds.has(p.id) ? 'checked' : ''}></div>
        <div title="${escapeHtml(blockName)}"><span class="badge badge--muted" style="max-width:160px; overflow:hidden; text-overflow:ellipsis; display:inline-block; white-space:nowrap;">${escapeHtml(blockName)}</span></div>
        <div>CE ${p.ce || '-'}</div>
        <div>${escapeHtml(p.criterio || '-')}</div>
        <div class="question-text" title="${escapeHtml(p.enunciado)}">${escapeHtml(p.enunciado)}</div>
        <div><span class="badge badge--${getDificultadColor(p.dificultad)}">${p.dificultad || 'media'}</span></div>
        <div style="text-align:right; display:flex; gap:var(--space-1); justify-content:flex-end;">
          <button class="btn btn-ghost btn--sm" onclick="editPregunta('${p.id}')" title="Editar">✏️</button>
          <button class="btn btn-ghost btn--sm" onclick="deletePregunta('${p.id}')" title="Borrar" style="color:var(--error);">🗑️</button>
        </div>
      `;
      listEl.appendChild(row);
    });

    // Añadir listeners a checkboxes individuales
    document.querySelectorAll('.chk-pregunta').forEach(chk => {
      chk.addEventListener('change', (e) => {
        const id = e.target.dataset.id;
        if (e.target.checked) {
          selectedIds.add(id);
        } else {
          selectedIds.delete(id);
          $('chk-all').checked = false;
        }
        updateSelectionUI();
      });
    });
  }
  
  // Actualizar paginación
  const startIndex = filteredPreguntas.length > 0 ? (currentPage - 1) * itemsPerPage + 1 : 0;
  const endIndex = Math.min(currentPage * itemsPerPage, filteredPreguntas.length);
  $('page-info').textContent = `Mostrando ${startIndex}-${endIndex} de ${filteredPreguntas.length}`;
  
  $('btn-prev-page').disabled = currentPage === 1;
  $('btn-next-page').disabled = currentPage === totalPages;
  
  // Actualizar checkbox global según los items de la página actual
  const pageItemIds = getPageItems().map(p => p.id);
  const allPageItemsSelected = pageItemIds.length > 0 && pageItemIds.every(id => selectedIds.has(id));
  if ($('chk-all')) {
    $('chk-all').checked = allPageItemsSelected;
  }
  
  updateSelectionUI();
}

function getDificultadColor(dificultad) {
  switch (dificultad) {
    case 'baja': return 'success';
    case 'media': return 'warning';
    case 'alta': return 'error';
    default: return 'muted';
  }
}

function updateSelectionUI() {
  const btn = $('btn-delete-selected');
  const count = $('delete-count');
  if (!btn || !count) return;
  
  count.textContent = selectedIds.size;
  btn.disabled = selectedIds.size === 0;
}

async function savePregunta() {
  try {
    const id = $('p-id').value;
    const btn = $('btn-save-pregunta');
    btn.disabled = true;
    btn.textContent = 'Guardando...';
    
    // Obtener opciones
    const opciones = [];
    const inputs = document.querySelectorAll('.p-opcion');
    const correctIndex = parseInt(document.querySelector('input[name="p-correcta"]:checked')?.value || '0', 10);
    
    inputs.forEach((input, index) => {
      opciones.push({
        texto: input.value,
        correcta: index === correctIndex
      });
    });
    
    const data = {
      block: $('p-block').value,
      ce: parseInt($('p-ce').value, 10) || 1,
      criterio: $('p-criterio').value || '',
      dificultad: $('p-dificultad').value || 'media',
      enunciado: $('p-enunciado').value,
      opciones: opciones
    };
    
    if (id) {
      // Update
      await updateDoc(doc(db, 'preguntas', id), data);
      showToast('Pregunta actualizada con éxito', 'success');
      
      // Update in memory
      const index = preguntas.findIndex(p => p.id === id);
      if (index !== -1) {
        preguntas[index] = { ...preguntas[index], ...data };
      }
    } else {
      // Create
      data.creadaEn = serverTimestamp();
      const docRef = await addDoc(collection(db, 'preguntas'), data);
      showToast('Pregunta creada con éxito', 'success');
      
      // Add to memory
      preguntas.push({ id: docRef.id, ...data });
    }
    
    $('modal-pregunta').classList.remove('modal-backdrop--visible');
    renderPreguntas();
    
  } catch (error) {
    console.error('Error saving pregunta:', error);
    showToast('Error al guardar la pregunta', 'error');
  } finally {
    const btn = $('btn-save-pregunta');
    btn.disabled = false;
    btn.textContent = 'Guardar Pregunta';
  }
}

window.editPregunta = (id) => {
  const p = preguntas.find(x => x.id === id);
  if (!p) return;
  
  $('p-id').value = p.id;
  $('p-block').value = p.block;
  $('p-ce').value = p.ce || 1;
  $('p-criterio').value = p.criterio || '';
  $('p-dificultad').value = p.dificultad || 'media';
  $('p-enunciado').value = p.enunciado || '';
  
  const inputs = document.querySelectorAll('.p-opcion');
  const radios = document.querySelectorAll('.p-correcta');
  
  p.opciones.forEach((opt, index) => {
    if (inputs[index]) inputs[index].value = opt.texto;
    if (radios[index] && opt.correcta) radios[index].checked = true;
  });
  
  $('modal-pregunta-title').textContent = 'Editar Pregunta';
  $('modal-pregunta').classList.add('modal-backdrop--visible');
};

window.deletePregunta = (id) => {
  showModal({
    title: 'Borrar Pregunta',
    body: '<p>¿Estás seguro de que deseas borrar esta pregunta de forma permanente?</p>',
    confirmText: 'Borrar',
    cancelText: 'Cancelar',
    dangerous: true,
    onConfirm: async () => {
      try {
        await deleteDoc(doc(db, 'preguntas', id));
        preguntas = preguntas.filter(p => p.id !== id);
        selectedIds.delete(id);
        renderPreguntas();
        showToast('Pregunta borrada', 'success');
      } catch (error) {
        console.error('Error deleting pregunta:', error);
        showToast('Error al borrar la pregunta', 'error');
      }
    }
  });
};

async function deleteSelected() {
  if (selectedIds.size === 0) return;
  
  showModal({
    title: 'Borrar Múltiples Preguntas',
    body: `<p>¿Estás seguro de que deseas borrar las <strong>${selectedIds.size}</strong> preguntas seleccionadas?</p><p>Esta acción no se puede deshacer.</p>`,
    confirmText: 'Borrar Seleccionadas',
    cancelText: 'Cancelar',
    dangerous: true,
    onConfirm: async () => {
      const btn = $('btn-delete-selected');
      btn.disabled = true;
      btn.textContent = 'Borrando...';
      
      try {
        let deletedCount = 0;
        for (const id of selectedIds) {
          await deleteDoc(doc(db, 'preguntas', id));
          deletedCount++;
        }
        
        preguntas = preguntas.filter(p => !selectedIds.has(p.id));
        selectedIds.clear();
        renderPreguntas();
        showToast(`${deletedCount} preguntas borradas con éxito`, 'success');
      } catch (error) {
        console.error('Error in batch deletion:', error);
        showToast('Error al borrar algunas preguntas', 'error');
      } finally {
        updateSelectionUI();
        btn.innerHTML = `🗑️ Borrar Seleccionados (<span id="delete-count">0</span>)`;
      }
    }
  });
}

async function importJson(e) {
  const file = e.target.files[0];
  if (!file) return;
  
  const reader = new FileReader();
  reader.onload = async (event) => {
    try {
      const data = JSON.parse(event.target.result);
      if (!Array.isArray(data)) throw new Error('El JSON debe contener un array de preguntas');
      
      showModal({
        title: 'Importar Banco de Preguntas',
        body: `<p>Se van a importar <strong>${data.length}</strong> preguntas desde el archivo JSON.</p><p>¿Continuar con la importación?</p>`,
        confirmText: 'Importar',
        cancelText: 'Cancelar',
        onConfirm: async () => {
          showLoading(`Importando ${data.length} preguntas... por favor, no cierres esta ventana.`);
          let count = 0;
          
          try {
            // Importación secuencial para respetar Firebase rate limits
            for (const item of data) {
              if (!item.enunciado || !item.opciones || item.opciones.length < 2) continue;
              
              const cleanData = {
                block: item.block || 'block1',
                ce: parseInt(item.ce, 10) || 1,
                criterio: item.criterio || '',
                dificultad: item.dificultad || 'media',
                enunciado: item.enunciado,
                opciones: item.opciones.map(o => ({
                  texto: o.texto || '',
                  correcta: !!o.correcta
                })),
                creadaEn: serverTimestamp()
              };
              
              const docRef = await addDoc(collection(db, 'preguntas'), cleanData);
              preguntas.push({ id: docRef.id, ...cleanData });
              count++;
            }
            
            showToast(`${count} preguntas importadas con éxito`, 'success');
          } catch (err) {
            console.error('Error durante la inserción en BD:', err);
            showToast('Error al importar algunas preguntas.', 'error');
          } finally {
            hideLoading();
            renderPreguntas();
          }
        }
      });
      
    } catch (error) {
      console.error('Error importing JSON:', error);
      showToast('Error: Formato de archivo JSON inválido', 'error');
    } finally {
      e.target.value = ''; // Reset input
    }
  };
  reader.readAsText(file);
}

function showCoverage() {
  const container = $('cobertura-body');
  container.innerHTML = '';
  
  let totalPreguntas = preguntas.length;

  if (totalPreguntas === 0) {
    container.innerHTML = '<div class="empty-state">No hay preguntas para calcular la cobertura.</div>';
    $('modal-cobertura').classList.add('modal-backdrop--visible');
    return;
  }

  // 1. STATS POR BLOQUES
  const stats = {};
  Object.keys(TOPICS).forEach(key => {
    stats[key] = { total: 0, baja: 0, media: 0, alta: 0 };
  });
  
  preguntas.forEach(p => {
    if (!stats[p.block]) stats[p.block] = { total: 0, baja: 0, media: 0, alta: 0 };
    stats[p.block].total++;
    stats[p.block][p.dificultad || 'media']++;
  });
  
  const blocksTitle = document.createElement('h3');
  blocksTitle.innerHTML = '📊 Resumen por Bloques Temáticos';
  blocksTitle.style.marginBottom = 'var(--space-3)';
  blocksTitle.style.marginTop = '0';
  container.appendChild(blocksTitle);

  const gridStats = document.createElement('div');
  gridStats.style.display = 'grid';
  gridStats.style.gridTemplateColumns = 'repeat(auto-fill, minmax(300px, 1fr))';
  gridStats.style.gap = 'var(--space-4)';
  container.appendChild(gridStats);

  Object.keys(TOPICS).forEach(key => {
    const s = stats[key];
    const name = TOPICS[key].name;
    const percent = totalPreguntas > 0 ? Math.round((s.total / totalPreguntas) * 100) : 0;
    
    const card = document.createElement('div');
    card.className = 'coverage-card';
    card.style.margin = '0';
    card.innerHTML = `
      <div class="coverage-header" style="font-size: 0.9rem;">
        <div style="white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 180px;" title="${escapeHtml(name)}">${escapeHtml(name)}</div>
        <div><span class="badge badge--primary">${s.total} (${percent}%)</span></div>
      </div>
      <div class="coverage-body">
        <ul class="coverage-list" style="display: flex; gap: 10px; border: none; padding-bottom: 0;">
          <li style="border:none; padding:0; flex:1; text-align:center; display:block;">
            <div class="text-muted" style="font-size:0.75rem;">Baja</div>
            <div class="badge badge--success">${s.baja}</div>
          </li>
          <li style="border:none; padding:0; flex:1; text-align:center; display:block;">
            <div class="text-muted" style="font-size:0.75rem;">Media</div>
            <div class="badge badge--warning">${s.media}</div>
          </li>
          <li style="border:none; padding:0; flex:1; text-align:center; display:block;">
            <div class="text-muted" style="font-size:0.75rem;">Alta</div>
            <div class="badge badge--error">${s.alta}</div>
          </li>
        </ul>
      </div>
    `;
    gridStats.appendChild(card);
  });

  // 2. STATS POR CRITERIOS
  const critTitle = document.createElement('h3');
  critTitle.innerHTML = '🎯 Cobertura de Criterios (LOMLOE)';
  critTitle.style.marginTop = 'var(--space-6)';
  critTitle.style.marginBottom = 'var(--space-3)';
  container.appendChild(critTitle);

  const allCriteriosMap = {};
  if (typeof CYR_EVALUATION_DATA !== 'undefined') {
    Object.values(CYR_EVALUATION_DATA).forEach(courseList => {
      courseList.forEach(item => {
         allCriteriosMap[item.crit] = item.text;
      });
    });
  }

  const critCounts = {};
  Object.keys(allCriteriosMap).forEach(c => critCounts[c] = 0);
  
  preguntas.forEach(p => {
    if (p.criterio) {
      if (critCounts[p.criterio] === undefined) {
         critCounts[p.criterio] = 0;
         allCriteriosMap[p.criterio] = 'Criterio personalizado';
      }
      critCounts[p.criterio]++;
    }
  });

  const critCard = document.createElement('div');
  critCard.className = 'coverage-card';
  let critHtml = `<div class="coverage-body" style="max-height: 450px; overflow-y: auto; padding: 0;"><ul class="coverage-list">`;
  
  const grouped = {};
  Object.keys(allCriteriosMap).sort((a,b) => a.localeCompare(b, undefined, {numeric: true})).forEach(c => {
    const ce = c.split('.')[0];
    if (!grouped[ce]) grouped[ce] = [];
    grouped[ce].push(c);
  });

  Object.keys(grouped).sort((a,b) => Number(a) - Number(b)).forEach(ce => {
    critHtml += `<li style="background: var(--surface-2); font-weight: bold; border-top: 1px solid var(--border); padding: 10px 15px; position: sticky; top: 0; z-index: 10;">Competencia Específica ${ce}</li>`;
    grouped[ce].forEach(c => {
      const count = critCounts[c] || 0;
      const text = allCriteriosMap[c];
      const badge = count > 0 
        ? `<span class="badge badge--success">${count} pregs</span>`
        : `<span class="badge badge--error" style="opacity: 0.8;">Sin cubrir</span>`;
      
      const liStyle = count > 0 ? '' : 'opacity: 0.7; background: #fff5f5;';
      
      critHtml += `
        <li style="display:flex; flex-direction:column; gap:5px; align-items:flex-start; padding: 12px 15px; border-bottom: 1px solid var(--border); ${liStyle}">
          <div style="display:flex; justify-content:space-between; width:100%; align-items:center;">
            <strong style="font-size: 0.95rem; color: var(--text-primary);">Criterio ${c}</strong>
            ${badge}
          </div>
          <div style="font-size: 0.85rem; color: var(--text-secondary); line-height: 1.4;">${escapeHtml(text)}</div>
        </li>
      `;
    });
  });

  critHtml += `</ul></div>`;
  critCard.innerHTML = critHtml;
  container.appendChild(critCard);
  
  $('modal-cobertura').classList.add('modal-backdrop--visible');
}

document.addEventListener('DOMContentLoaded', init);
