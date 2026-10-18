// ═══════════════════════════════════════════════════════════════════════
//  STACKCLASS — admin_temario.js (Editor Enriquecido de Bloques Temáticos)
// ═══════════════════════════════════════════════════════════════════════

import { requireAuth, isAdmin } from './common/auth.js';
import { getTopic, upsertTopic } from './common/db.js';
import { LOCAL_TOPICS } from './common/topics_data.js';
import { renderHeader, showToast, showLoading, hideLoading } from './common/ui.js';
import { $, $$, escapeHtml, getUrlParams } from './common/utils.js';

let currentSubject = 'cyr';
let currentTopicId = 'block1';
let currentTopicData = null;
let isHtmlMode = false;
let isDirty = false;
let savedSelectionRange = null;

// Galería de imágenes predefinidas de la plataforma
const PLATFORM_IMAGES = {
  cyr: [
    { name: 'Esquema Teclado', src: '../img/cyr/teclado_esquema.png' },
    { name: 'Classroom Trabajo', src: '../img/cyr/classroom_trabajo.png' },
    { name: 'Esquema Email', src: '../img/cyr/email_esquema.png' },
    { name: 'Ada Lovelace', src: '../img/cyr/img/ada_lovelace.jpg' },
    { name: 'Grace Hopper', src: '../img/cyr/img/grace_hopper.jpg' },
    { name: 'R2-D2', src: '../img/cyr/img/r2d2.jpg' },
    { name: 'WALL-E', src: '../img/cyr/img/wall-e.jpg' },
    { name: 'Terminator', src: '../img/cyr/img/terminator.jpg' },
    { name: 'RoboCop', src: '../img/cyr/img/robocop.jpg' },
    { name: 'Johnny 5', src: '../img/cyr/img/johnny5.jpg' }
  ],
  tic2: [
    { name: 'Mesa de Mezclas EFX8', src: '../img/tic2/EFX8-2-1.png' },
    { name: 'Cubo de Color RGB', src: '../img/tic2/rgb-cube.png' },
    { name: 'Licencia CC BY', src: '../img/tic2/by.svg' },
    { name: 'Licencia CC SA', src: '../img/tic2/sa.svg' },
    { name: 'Licencia CC NC', src: '../img/tic2/nc.svg' },
    { name: 'Licencia CC ND', src: '../img/tic2/nd.svg' }
  ]
};

// ── Guard de Seguridad ───────────────────────────────────────────────
requireAuth({
  allowedRoles: ['teacher'],
  onAuthorized: async (user, profile) => {
    if (!isAdmin(user, profile)) {
      window.location.href = 'dashboard_teacher.html';
      return;
    }
    renderHeader(user, profile);
    initEditorApp();
  }
});

// ── Inicialización del Editor ─────────────────────────────────────────
function initEditorApp() {
  const params = getUrlParams();
  if (params.subjectId && (params.subjectId === 'cyr' || params.subjectId === 'tic2')) {
    currentSubject = params.subjectId;
  }
  if (params.topicId) {
    currentTopicId = params.topicId;
  } else {
    currentTopicId = currentSubject === 'cyr' ? 'block1' : 'topic_kanban';
  }

  $('select-subject').value = currentSubject;

  setupSelectEvents();
  setupToolbarEvents();
  setupImageModal();
  setupDirtyTracking();

  loadTopicsSelector(currentSubject, currentTopicId);
}

// ── Control de Selectores de Asignatura y Tema ────────────────────────
function setupSelectEvents() {
  $('select-subject').addEventListener('change', (e) => {
    if (isDirty && !confirm('Tienes cambios sin guardar en este tema. ¿Deseas descartarlos y cambiar de asignatura?')) {
      e.target.value = currentSubject;
      return;
    }
    currentSubject = e.target.value;
    const defaultTopic = currentSubject === 'cyr' ? 'block1' : 'topic_kanban';
    loadTopicsSelector(currentSubject, defaultTopic);
  });

  $('select-topic').addEventListener('change', (e) => {
    if (isDirty && !confirm('Tienes cambios sin guardar. ¿Deseas descartarlos y cambiar de tema?')) {
      e.target.value = currentTopicId;
      return;
    }
    currentTopicId = e.target.value;
    loadTopicContent(currentTopicId);
  });

  $('btn-save-topic').addEventListener('click', saveCurrentTopic);
}

function loadTopicsSelector(subjectId, selectTopicId = null) {
  const select = $('select-topic');
  select.innerHTML = '';

  const topics = Object.values(LOCAL_TOPICS)
    .filter(t => t.subject_id === subjectId)
    .sort((a, b) => a.sort_order - b.sort_order);

  topics.forEach(t => {
    const opt = document.createElement('option');
    opt.value = t.id;
    opt.textContent = `${t.icon || '📚'} ${t.name}`;
    select.appendChild(opt);
  });

  if (selectTopicId && topics.some(t => t.id === selectTopicId)) {
    select.value = selectTopicId;
    currentTopicId = selectTopicId;
  } else if (topics.length > 0) {
    select.value = topics[0].id;
    currentTopicId = topics[0].id;
  }

  loadTopicContent(currentTopicId);
}

// ── Cargar Contenido del Tema ────────────────────────────────────────
async function loadTopicContent(topicId) {
  try {
    showLoading('Cargando tema...');
    const topic = await getTopic(topicId);
    if (!topic) {
      showToast('Aviso', 'No se encontró el tema seleccionado.', 'warning');
      return;
    }

    currentTopicData = topic;

    // Actualizar metadatos
    $('input-topic-icon').value = topic.icon || '📚';
    $('input-topic-name').value = topic.name || '';
    $('input-topic-desc').value = topic.description || '';

    // Extraer contenido HTML
    let html = '';
    if (Array.isArray(topic.blocks) && topic.blocks.length > 0) {
      html = topic.blocks.map(b => b.content || '').join('\n');
    } else {
      html = '<p>Escribe aquí el contenido del tema...</p>';
    }

    // Inyectar en ambos editores
    $('editor-visual').innerHTML = html;
    $('editor-html').value = formatHtml(html);

    // Ajustar imágenes para visualización correcta en el editor de nivel raíz
    $('editor-visual').querySelectorAll('img').forEach(img => {
      img.addEventListener('error', function onImgErr() {
        const srcAttr = this.getAttribute('src');
        if (srcAttr && srcAttr.startsWith('../')) {
          this.src = srcAttr.replace(/^\.\.\//, '');
        }
      }, { once: true });
    });

    // Actualizar enlace de previsualización
    $('btn-preview-topic').href = `temario/index.html?topicId=${encodeURIComponent(topicId)}&subjectId=${encodeURIComponent(currentSubject)}`;

    setDirty(false);
  } catch (err) {
    console.error('Error cargando tema:', err);
    showToast('Error', 'No se pudo cargar el contenido del tema.', 'error');
  } finally {
    hideLoading();
  }
}

// ── Motor y Barra de Herramientas WYSIWYG ────────────────────────────
function setupToolbarEvents() {
  const visual = $('editor-visual');

  // Guardar rango de selección al interactuar con el lienzo visual
  const saveSelection = () => {
    const sel = window.getSelection();
    if (sel && sel.rangeCount > 0) {
      savedSelectionRange = sel.getRangeAt(0);
    }
  };

  visual.addEventListener('keyup', saveSelection);
  visual.addEventListener('mouseup', saveSelection);
  visual.addEventListener('focus', saveSelection);

  // Botones con comando directo document.execCommand
  $$('#editor-toolbar button[data-cmd]').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      if (isHtmlMode) return;
      visual.focus();
      restoreSelection();
      const cmd = btn.getAttribute('data-cmd');
      document.execCommand(cmd, false, null);
      setDirty(true);
      updateToolbarActiveStates();
    });
  });

  // Selector de formato de bloque (P, H1, H2, H3)
  $('tb-format').addEventListener('change', (e) => {
    if (isHtmlMode) return;
    visual.focus();
    restoreSelection();
    const tag = e.target.value;
    document.execCommand('formatBlock', false, tag);
    setDirty(true);
  });

  // Botón Código en línea
  $('tb-btn-code').addEventListener('click', (e) => {
    e.preventDefault();
    if (isHtmlMode) return;
    visual.focus();
    restoreSelection();
    wrapSelectionInTag('code');
    setDirty(true);
  });

  // Botón Cita en Bloque
  $('tb-btn-quote').addEventListener('click', (e) => {
    e.preventDefault();
    if (isHtmlMode) return;
    visual.focus();
    restoreSelection();
    document.execCommand('formatBlock', false, 'blockquote');
    setDirty(true);
  });

  // Dropdown de componentes didácticos
  const compDropdown = $('dropdown-components');
  $('btn-toggle-components').addEventListener('click', (e) => {
    e.stopPropagation();
    compDropdown.classList.toggle('open');
  });

  document.addEventListener('click', () => {
    compDropdown.classList.remove('open');
  });

  $$('#dropdown-components button[data-insert]').forEach(item => {
    item.addEventListener('click', (e) => {
      e.preventDefault();
      if (isHtmlMode) return;
      const type = item.getAttribute('data-insert');
      insertDidacticComponent(type);
      compDropdown.classList.remove('open');
      setDirty(true);
    });
  });

  // Botón Insertar Enlace
  $('tb-btn-link').addEventListener('click', (e) => {
    e.preventDefault();
    if (isHtmlMode) return;
    visual.focus();
    restoreSelection();
    const url = prompt('Introduce la URL del enlace (ej: https://...):', 'https://');
    if (url && url !== 'https://') {
      document.execCommand('createLink', false, url);
      setDirty(true);
    }
  });

  // Botón Insertar Tabla
  $('tb-btn-table').addEventListener('click', (e) => {
    e.preventDefault();
    if (isHtmlMode) return;
    insertTable(3, 3);
    setDirty(true);
  });

  // Alternador de Modo Visual <--> Modo Código HTML
  $('tb-btn-toggle-html').addEventListener('click', toggleEditorMode);
}

function restoreSelection() {
  if (savedSelectionRange) {
    const sel = window.getSelection();
    sel.removeAllRanges();
    sel.addRange(savedSelectionRange);
  }
}

function wrapSelectionInTag(tagName) {
  const sel = window.getSelection();
  if (!sel.rangeCount) return;
  const range = sel.getRangeAt(0);
  const selectedText = range.toString();

  const element = document.createElement(tagName);
  if (selectedText) {
    element.textContent = selectedText;
    range.deleteContents();
    range.insertNode(element);
  } else {
    element.innerHTML = 'codigo_aqui';
    range.insertNode(element);
  }
}

function insertDidacticComponent(type) {
  const visual = $('editor-visual');
  visual.focus();
  restoreSelection();

  let htmlSnippet = '';
  switch (type) {
    case 'info-box':
      htmlSnippet = `
        <div class="info-box">
          <h3>ℹ️ Título Informativo</h3>
          <p>Escribe aquí la explicación destacada para los alumnos...</p>
        </div><p></p>
      `;
      break;
    case 'prompt-box':
      htmlSnippet = `
        <div class="prompt-box">
          <strong>Ejemplo de Prompt para Antigravity:</strong><br><br>
          "Actúa como desarrollador web experto. Explica paso a paso cómo..."
        </div><p></p>
      `;
      break;
    case 'alert-warning':
      htmlSnippet = `
        <div class="alert alert-warning">
          <strong>⚠️ Atención:</strong> Recuerda guardar tus cambios antes de continuar.
        </div><p></p>
      `;
      break;
    case 'defense-card':
      htmlSnippet = `
        <div class="defense-card">
          <h4>🛡️ Medida de Seguridad</h4>
          <p>Explicación de la protección o buena práctica digital...</p>
        </div><p></p>
      `;
      break;
    case 'threat-card':
      htmlSnippet = `
        <div class="threat-card">
          <h4>🛑 Amenaza / Riesgo Digital</h4>
          <p>Descripción del malware, ataque o riesgo informático...</p>
        </div><p></p>
      `;
      break;
    case 'sms-mockup':
      htmlSnippet = `
        <div class="sms-mockup">
          💬 <strong>Mensaje de Texto (SMS):</strong><br>
          "Tu paquete ha sido retenido. Pulsa en este enlace falso para liberarlo."
        </div><p></p>
      `;
      break;
    case 'task-link':
      htmlSnippet = `
        <div class="task-link">
          🎯 <strong>Tarea Práctica:</strong> Realiza la actividad asignada en Classroom.
        </div><p></p>
      `;
      break;
  }

  if (htmlSnippet) {
    document.execCommand('insertHTML', false, htmlSnippet);
  }
}

function insertTable(rows = 3, cols = 3) {
  const visual = $('editor-visual');
  visual.focus();
  restoreSelection();

  let tableHtml = '<table class="ranking-table" style="width:100%; margin:20px 0; border:1px solid #cbd5e1; border-collapse:collapse;"><thead><tr>';
  for (let c = 1; c <= cols; c++) {
    tableHtml += `<th style="border:1px solid #cbd5e1; padding:8px 12px; background:#f1f5f9;">Encabezado ${c}</th>`;
  }
  tableHtml += '</tr></thead><tbody>';
  for (let r = 1; r < rows; r++) {
    tableHtml += '<tr>';
    for (let c = 1; c <= cols; c++) {
      tableHtml += `<td style="border:1px solid #cbd5e1; padding:8px 12px;">Dato fila ${r}, col ${c}</td>`;
    }
    tableHtml += '</tr>';
  }
  tableHtml += '</tbody></table><p></p>';

  document.execCommand('insertHTML', false, tableHtml);
}

// ── Alternador entre Modo Visual y Modo Código HTML ─────────────────
function toggleEditorMode() {
  const visual = $('editor-visual');
  const textarea = $('editor-html');
  const toggleBtnText = $('toggle-mode-text');

  if (!isHtmlMode) {
    // Pasar a modo código HTML
    textarea.value = formatHtml(visual.innerHTML);
    visual.style.display = 'none';
    textarea.style.display = 'block';
    textarea.focus();
    toggleBtnText.textContent = 'Ver Visual (WYSIWYG)';
    $('tb-btn-toggle-html').classList.add('is-active');
    isHtmlMode = true;
  } else {
    // Volver a modo visual WYSIWYG
    visual.innerHTML = textarea.value;
    textarea.style.display = 'none';
    visual.style.display = 'block';
    visual.focus();
    toggleBtnText.textContent = 'Ver HTML';
    $('tb-btn-toggle-html').classList.remove('is-active');
    isHtmlMode = false;
  }
}

function updateToolbarActiveStates() {
  if (isHtmlMode) return;
  const cmds = ['bold', 'italic', 'underline', 'strikeThrough'];
  cmds.forEach(cmd => {
    const btn = $(`#editor-toolbar button[data-cmd="${cmd}"]`);
    if (btn) {
      if (document.queryCommandState(cmd)) {
        btn.classList.add('is-active');
      } else {
        btn.classList.remove('is-active');
      }
    }
  });
}

// ── Modal de Galería de Imágenes ────────────────────────────────────
function setupImageModal() {
  const modal = $('modal-image-picker');
  const grid = $('img-gallery-grid');
  let selectedImgSrc = '';

  $('tb-btn-img').addEventListener('click', (e) => {
    e.preventDefault();
    if (isHtmlMode) return;
    renderGalleryTab(currentSubject);
    modal.classList.add('open');
  });

  $('btn-close-img-modal').addEventListener('click', () => modal.classList.remove('open'));
  $('btn-cancel-img').addEventListener('click', () => modal.classList.remove('open'));

  // Pestañas
  $('tab-gallery-cyr').addEventListener('click', () => {
    switchGalleryTab('cyr');
  });
  $('tab-gallery-tic2').addEventListener('click', () => {
    switchGalleryTab('tic2');
  });
  $('tab-gallery-custom').addEventListener('click', () => {
    switchGalleryTab('custom');
  });

  function switchGalleryTab(tab) {
    $('tab-gallery-cyr').classList.toggle('is-active', tab === 'cyr');
    $('tab-gallery-tic2').classList.toggle('is-active', tab === 'tic2');
    $('tab-gallery-custom').classList.toggle('is-active', tab === 'custom');

    if (tab === 'custom') {
      $('gallery-container').style.display = 'none';
      $('input-modal-img-src').value = 'https://';
      $('input-modal-img-src').focus();
    } else {
      $('gallery-container').style.display = 'block';
      renderGalleryTab(tab);
    }
  }

  function renderGalleryTab(sub) {
    grid.innerHTML = '';
    const list = PLATFORM_IMAGES[sub] || [];
    list.forEach(item => {
      const card = document.createElement('div');
      card.className = 'img-gallery-item';
      const thumbSrc = item.src.startsWith('../') ? item.src.substring(3) : item.src;
      card.innerHTML = `
        <img src="${thumbSrc}" alt="${escapeHtml(item.name)}" onerror="this.onerror=null; this.src='img/favicon.svg'">
        <span>${escapeHtml(item.name)}</span>
      `;
      card.addEventListener('click', () => {
        $$('.img-gallery-item').forEach(c => c.classList.remove('selected'));
        card.classList.add('selected');
        $('input-modal-img-src').value = item.src;
        $('input-modal-img-alt').value = item.name;
        selectedImgSrc = item.src;
      });
      grid.appendChild(card);
    });
  }

  // Confirmar inserción de imagen
  $('btn-confirm-insert-img').addEventListener('click', () => {
    const src = $('input-modal-img-src').value.trim();
    const alt = $('input-modal-img-alt').value.trim() || 'Imagen del tema';

    if (!src) {
      alert('Por favor selecciona una imagen o introduce su URL.');
      return;
    }

    modal.classList.remove('open');
    $('editor-visual').focus();
    restoreSelection();

    const imgHtml = `<img src="${escapeHtml(src)}" alt="${escapeHtml(alt)}" style="max-width:100%; height:auto; border-radius:8px; margin:20px auto; display:block; box-shadow:0 4px 6px -1px rgba(0,0,0,0.1);"><p></p>`;
    document.execCommand('insertHTML', false, imgHtml);
    setDirty(true);
  });
}

// ── Control de Cambios sin Guardar (Dirty Tracking) ──────────────────
function setupDirtyTracking() {
  $('editor-visual').addEventListener('input', () => setDirty(true));
  $('editor-html').addEventListener('input', () => setDirty(true));
  $('input-topic-icon').addEventListener('input', () => setDirty(true));
  $('input-topic-name').addEventListener('input', () => setDirty(true));
  $('input-topic-desc').addEventListener('input', () => setDirty(true));

  window.addEventListener('beforeunload', (e) => {
    if (isDirty) {
      e.preventDefault();
      e.returnValue = '';
    }
  });
}

function setDirty(dirty) {
  isDirty = dirty;
  const pill = $('save-status-pill');
  if (pill) {
    if (dirty) {
      pill.className = 'status-pill status-pill--dirty';
      pill.textContent = '🟡 Cambios sin guardar';
    } else {
      pill.className = 'status-pill status-pill--clean';
      pill.textContent = '🟢 Guardado';
    }
  }
}

// ── Guardar Tema ────────────────────────────────────────────────────
async function saveCurrentTopic() {
  const saveBtn = $('btn-save-topic');
  try {
    saveBtn.disabled = true;
    saveBtn.innerHTML = `<span>⏳</span> Guardando...`;

    // Sincronizar contenido si está en modo HTML
    if (isHtmlMode) {
      $('editor-visual').innerHTML = $('editor-html').value;
    }

    const currentHtml = $('editor-visual').innerHTML;
    const name = $('input-topic-name').value.trim();
    const description = $('input-topic-desc').value.trim();
    const icon = $('input-topic-icon').value.trim() || '📚';

    if (!name) {
      showToast('Aviso', 'El título del tema no puede estar vacío.', 'warning');
      return;
    }

    const topicPayload = {
      ...(currentTopicData || {}),
      id: currentTopicId,
      subject_id: currentSubject,
      name,
      description,
      icon,
      blocks: [
        { type: 'html', content: currentHtml }
      ],
      updated_at: new Date().toISOString()
    };

    await upsertTopic(topicPayload);
    currentTopicData = topicPayload;

    // Actualizar nombre en el selector
    const currentOpt = $(`#select-topic option[value="${currentTopicId}"]`);
    if (currentOpt) {
      currentOpt.textContent = `${icon} ${name}`;
    }

    setDirty(false);
    showToast('Éxito', `El tema "${name}" se ha guardado correctamente.`, 'success');
  } catch (err) {
    console.error('Error al guardar el tema:', err);
    showToast('Error', 'No se pudo guardar el tema. Revisa la conexión.', 'error');
  } finally {
    saveBtn.disabled = false;
    saveBtn.innerHTML = `<span>💾</span> Guardar Cambios`;
  }
}

// ── Formateador Básico de HTML ──────────────────────────────────────
function formatHtml(html) {
  // Indentación básica legible para el modo código
  return html
    .replace(/></g, '>\n<')
    .replace(/(<\/h[1-4]>|<\/p>|<\/div>|<\/ul>|<\/ol>|<\/table>)/gi, '$1\n')
    .trim();
}
