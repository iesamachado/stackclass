import { CYR_EVALUATION_DATA, TIC2_EVALUATION_DATA, EVALUATION_DATA, COURSES, GAMES, TOPICS, $, escapeHtml, getUrlParams } from './common/utils.js';
import { CLASSROOM_TASKS } from './common/tasks.js';
import { renderHeader } from './common/ui.js';
import { requireAuth } from './common/auth.js';
import {
  getCurriculumCriteria,
  getCurriculumActivities,
  getEffectiveCriteriaMapping,
  exportCurriculumMatrixCSV
} from './common/curriculum-matrix.js';

let currentSubject = 'cyr';
let currentMode = 'criterion';
let currentLevel = '1';

document.addEventListener('DOMContentLoaded', () => {
  requireAuth({
    allowedRoles: ['teacher'],
    onAuthorized: async (user, profile) => {
      renderHeader(user, profile);
      initEvaluationPage();
    }
  });
});

function calculateTaskWeightsForSubject(tasks, ces) {
  const crit_tasks = {};
  tasks.forEach(t => {
    t.total_weight = 0.0;
    if (t.crit) {
      t.crit.split(',').map(s => s.trim()).forEach(c => {
        if (!crit_tasks[c]) crit_tasks[c] = [];
        crit_tasks[c].push(t);
      });
    }
  });

  const numCes = Object.keys(ces).length;
  if (numCes === 0) return;
  const ce_weight = 100.0 / numCes;

  Object.values(ces).forEach(crits => {
    const crit_weight = ce_weight / crits.length;
    crits.forEach(c => {
      const t_list = crit_tasks[c] || [];
      const num_tasks = t_list.length;
      if (num_tasks > 0) {
        const task_weight = crit_weight / num_tasks;
        t_list.forEach(t => {
          t.total_weight += task_weight;
        });
      }
    });
  });
}

function calculateAllTaskWeights() {
  const cyrCes = {
    '1': ['1.1', '1.2', '1.3', '1.4'],
    '2': ['2.1', '2.2', '2.3'],
    '3': ['3.1'],
    '4': ['4.1', '4.2'],
    '5': ['5.1', '5.2'],
    '6': ['6.1', '6.2', '6.3', '6.4']
  };

  const tic2Ces = {
    '1': ['1.1'],
    '2': ['2.1', '2.2'],
    '3': ['3.1'],
    '4': ['4.1'],
    '5': ['5.1', '5.2', '5.3']
  };

  const cyrTasks = CLASSROOM_TASKS.filter(t => t.subjectId === 'cyr');
  const tic2Tasks = CLASSROOM_TASKS.filter(t => t.subjectId === 'tic2');

  calculateTaskWeightsForSubject(cyrTasks, cyrCes);
  calculateTaskWeightsForSubject(tic2Tasks, tic2Ces);
}

function getSubjectTasks(subjectId = currentSubject) {
  return CLASSROOM_TASKS.filter(t => t.subjectId === subjectId);
}

function updatePageHeader() {
  const desc = $('page-desc');
  if (desc) {
    if (currentSubject === 'tic2') {
      desc.textContent = 'Planificación basada en la normativa de Tecnologías de la Información y Comunicación II (2º Bachillerato).';
    } else {
      desc.textContent = 'Planificación basada en la normativa de Computación y Robótica de Andalucía.';
    }
  }
}

function populateLevelSelect() {
  const levelSelect = $('level-select');
  if (!levelSelect) return;

  if (currentSubject === 'tic2') {
    levelSelect.innerHTML = `<option value="2">2º Bachillerato</option>`;
    currentLevel = '2';
  } else {
    levelSelect.innerHTML = `
      <option value="1">1º ESO</option>
      <option value="2">2º ESO</option>
      <option value="3">3º ESO</option>
    `;
    if (!['1', '2', '3'].includes(currentLevel)) {
      currentLevel = '1';
    }
  }
  levelSelect.value = currentLevel;
}

function resetDetailPanel() {
  const panel = $('task-detail-panel');
  if (panel) {
    panel.innerHTML = `
      <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100%; color: var(--text-muted); text-align: center;">
        <span style="font-size: 3rem; margin-bottom: 10px;">👈</span>
        <p>Selecciona una tarea de la tabla<br>para ver su descripción y copiarla.</p>
      </div>
    `;
  }
}

function initEvaluationPage() {
  calculateAllTaskWeights();

  const params = getUrlParams();
  const requestedSubject = params.subject || params.subjectId || params.course || params.courseId;
  if (requestedSubject && (requestedSubject === 'tic2' || requestedSubject === 'cyr')) {
    currentSubject = requestedSubject;
  }

  const subjectSelect = $('subject-select');
  const levelSelect = $('level-select');
  const viewMode = $('view-mode');
  const courseContainer = $('course-selector-container');

  if (subjectSelect) {
    subjectSelect.value = currentSubject;
    subjectSelect.addEventListener('change', () => {
      currentSubject = subjectSelect.value;
      populateLevelSelect();
      updatePageHeader();
      resetDetailPanel();
      renderView();
    });
  }

  populateLevelSelect();
  updatePageHeader();

  if (params.level && (currentSubject === 'cyr' ? ['1', '2', '3'].includes(params.level) : params.level === '2')) {
    currentLevel = params.level;
    if (levelSelect) levelSelect.value = currentLevel;
  }

  if (levelSelect) {
    levelSelect.addEventListener('change', () => {
      currentLevel = levelSelect.value;
      resetDetailPanel();
      renderView();
    });
  }

  if (params.mode && ['criterion', 'block', 'task', 'matrix'].includes(params.mode)) {
    currentMode = params.mode;
    if (viewMode) viewMode.value = currentMode;
    if (currentMode === 'matrix' || currentMode === 'criterion') {
      courseContainer.style.display = 'block';
    } else {
      courseContainer.style.display = 'none';
    }
  }

  if (viewMode) {
    viewMode.addEventListener('change', () => {
      currentMode = viewMode.value;
      if (currentMode === 'criterion' || currentMode === 'matrix') {
        courseContainer.style.display = 'block';
      } else {
        courseContainer.style.display = 'none';
      }
      resetDetailPanel();
      renderView();
    });
  }

  renderView();
}

function renderView() {
  if (currentMode === 'criterion') {
    renderByCriterion(currentLevel);
  } else if (currentMode === 'block') {
    renderByBlock();
  } else if (currentMode === 'task') {
    renderByTask();
  } else if (currentMode === 'matrix') {
    renderByMatrix(currentLevel);
  }
  bindTaskClicks();
}

function getTaskButton(t) {
  const isGame = isNaN(t.id) || (t.title && t.title.toLowerCase().startsWith('juego:'));
  const extraClass = isGame ? 'btn-game-task' : 'btn-outline';
  const weightBadge = t.total_weight ? `<div style="font-size:0.75rem; margin-top:4px; opacity:0.8; font-weight: 500;">⚖️ Peso: ${t.total_weight.toFixed(2)}%</div>` : '';
  const label = isNaN(t.id) ? `🎮 ${escapeHtml(t.title)}` : `📝 Tarea ${t.id}: <strong>${escapeHtml(t.title)}</strong>`;

  return `<button class="btn btn-sm ${extraClass} btn-task-detail" data-task-id="${t.id}" style="display:block; width:100%; text-align:left; white-space:normal; line-height: 1.4; height:100%;">
            ${label}
            ${weightBadge}
          </button>`;
}

function renderByCriterion(level) {
  const evalData = currentSubject === 'tic2' ? TIC2_EVALUATION_DATA : CYR_EVALUATION_DATA;
  const criteriaList = evalData[level] || evalData[Object.keys(evalData)[0]] || [];

  $('eval-thead').innerHTML = `
    <tr>
      <th style="width:10%;">Crit.</th>
      <th style="width:50%;">Descripción (Andalucía)</th>
      <th style="width:40%;">Tareas Classroom</th>
    </tr>
  `;

  const tasks = getSubjectTasks(currentSubject);
  const isEvaluatedLevel = (currentSubject === 'cyr' && level == 1) || (currentSubject === 'tic2' && level == 2);

  let html = '';
  criteriaList.forEach(c => {
    const matchingTasks = isEvaluatedLevel
      ? tasks.filter(t => t.crit && t.crit.split(',').map(s => s.trim()).includes(c.crit))
      : [];

    let tasksHtml = '<span style="color:var(--text-muted)">-</span>';
    if (matchingTasks.length > 0) {
      tasksHtml = `<div style="display:flex; flex-direction:column; gap:8px;">
        ${matchingTasks.map(getTaskButton).join('')}
      </div>`;
    }

    html += `
      <tr>
        <td style="font-weight:bold; color:var(--primary); font-size: 1.1rem;">${c.crit}</td>
        <td>
          <div style="font-weight: 500; margin-bottom: 5px;">${escapeHtml(c.text)}</div>
          <span class="badge">${escapeHtml(c.block)}</span>
        </td>
        <td>${tasksHtml}</td>
      </tr>
    `;
  });

  $('eval-tbody').innerHTML = html;
}

function renderByBlock() {
  $('eval-thead').innerHTML = `
    <tr>
      <th style="width:15%;">Bloque</th>
      <th style="width:85%;">Tareas Asociadas</th>
    </tr>
  `;

  const tasks = getSubjectTasks(currentSubject);
  const blocks = {};
  tasks.forEach(t => {
    const b = t.block || 'Desconocido';
    if (!blocks[b]) blocks[b] = [];
    blocks[b].push(t);
  });

  const sortedBlocks = Object.keys(blocks).sort((a,b) => a.localeCompare(b, undefined, { numeric: true }));

  let html = '';
  sortedBlocks.forEach(b => {
    const tasksHtml = `<div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(250px, 1fr)); gap: 10px;">
      ${blocks[b].map(t => getTaskButton(t)).join('')}
    </div>`;

    html += `
      <tr>
        <td style="font-weight:bold; color:var(--primary); font-size: 1.2rem;">Bloque ${escapeHtml(b)}</td>
        <td>${tasksHtml}</td>
      </tr>
    `;
  });

  $('eval-tbody').innerHTML = html;
}

function renderByTask() {
  $('eval-thead').innerHTML = `
    <tr>
      <th style="width:10%;">ID</th>
      <th style="width:40%;">Título</th>
      <th style="width:10%;">Bloque</th>
      <th style="width:15%;">Criterios</th>
      <th style="width:10%;">Peso</th>
      <th style="width:15%;">Acción</th>
    </tr>
  `;

  const tasks = getSubjectTasks(currentSubject);
  let html = '';
  const sortedTasks = [...tasks].sort((a,b) => {
    const isNumA = !isNaN(a.id);
    const isNumB = !isNaN(b.id);
    if (isNumA && isNumB) return parseInt(a.id, 10) - parseInt(b.id, 10);
    if (isNumA) return -1;
    if (isNumB) return 1;
    return a.id.localeCompare(b.id);
  });

  sortedTasks.forEach(t => {
    html += `
      <tr>
        <td style="font-weight:bold; color:var(--text-muted); font-size: 1.1rem;">#${t.id}</td>
        <td style="font-weight:bold;">${escapeHtml(t.title)}</td>
        <td><span class="badge">Bloque ${escapeHtml(t.block)}</span></td>
        <td>${t.crit ? `<span class="badge badge--primary">Crit. ${escapeHtml(t.crit)}</span>` : '<span style="color:var(--text-muted)">-</span>'}</td>
        <td style="font-weight:bold; color:#000;">${t.total_weight ? t.total_weight.toFixed(2) + '%' : '-'}</td>
        <td><button class="btn btn-sm btn-outline btn-task-detail" data-task-id="${t.id}">Ver Tarea</button></td>
      </tr>
    `;
  });

  $('eval-tbody').innerHTML = html;
}

function bindTaskClicks() {
  document.querySelectorAll('.btn-task-detail').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const taskId = e.currentTarget.getAttribute('data-task-id');
      showTaskDetail(taskId);

      // Resaltar el botón activo
      document.querySelectorAll('.btn-task-detail').forEach(b => {
        b.classList.remove('btn-primary');
        if (!b.classList.contains('btn-game-task')) {
          b.classList.add('btn-outline');
        }
      });

      e.currentTarget.classList.remove('btn-outline');
      e.currentTarget.classList.add('btn-primary');
    });
  });
}

function showTaskDetail(taskId) {
  const tasks = getSubjectTasks(currentSubject);
  const task = tasks.find(t => String(t.id) === String(taskId));
  if (!task) return;

  const panel = $('task-detail-panel');
  panel.innerHTML = `
    <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:15px;">
      <h3 style="margin:0; color:var(--text-primary); font-size:1.5rem;">${escapeHtml(task.title)}</h3>
    </div>
    <div style="display:flex; gap: 10px; margin-bottom:20px; flex-wrap: wrap;">
      <span class="badge">Bloque ${escapeHtml(task.block)}</span>
      ${task.crit ? `<span class="badge badge--primary">Criterio ${escapeHtml(task.crit)}</span>` : `<span class="badge badge--accent">No evaluable</span>`}
      ${task.total_weight ? `<span class="badge" style="background:#ffeb3b; color:#000;">Ponderación Final: ${task.total_weight.toFixed(2)}%</span>` : ''}
    </div>
    <p style="color:var(--text-secondary); margin-bottom:10px; font-weight:600;">Descripción de la tarea:</p>
    <div class="task-desc">${escapeHtml(task.description)}</div>
    <button id="btn-copy-task" class="btn btn-primary btn-lg" style="width:100%; font-size:1.1rem;">📋 Copiar Texto para Classroom</button>
  `;

  $('btn-copy-task').addEventListener('click', () => {
    navigator.clipboard.writeText(task.description).then(() => {
      const btn = $('btn-copy-task');
      const originalText = btn.innerHTML;
      btn.innerHTML = '✅ ¡Copiado con éxito!';
      btn.style.backgroundColor = 'var(--success)';
      btn.style.borderColor = 'var(--success)';

      setTimeout(() => {
        btn.innerHTML = originalText;
        btn.style.backgroundColor = '';
        btn.style.borderColor = '';
      }, 2000);
    });
  });
}

function renderByMatrix(level) {
  const criteria = getCurriculumCriteria(currentSubject, level);
  const activities = getCurriculumActivities(currentSubject, level);
  const effective = getEffectiveCriteriaMapping(currentSubject, level, null);

  $('eval-thead').innerHTML = `
    <tr>
      <th style="min-width:240px; position:sticky; left:0; background:var(--bg-body); z-index:5;">
        Criterio LOMLOE (${criteria.length})
      </th>
      ${activities.map(a => `
        <th style="min-width:105px; text-align:center; padding:10px 6px;" title="${escapeHtml(a.name)}">
          <div style="font-size:0.68rem; font-weight:700; text-transform:uppercase; color:var(--text-muted);">${a.typeLabel}</div>
          <div style="font-size:1.2rem;">${a.icon}</div>
          <div style="font-size:0.75rem; font-weight:600; line-height:1.2;">
            ${escapeHtml(a.name.length > 20 ? a.name.substring(0, 18) + '…' : a.name)}
          </div>
        </th>
      `).join('')}
      <th style="min-width:60px; text-align:center;">Total</th>
    </tr>
  `;

  let html = '';
  criteria.forEach(c => {
    let rowCount = 0;
    const cells = activities.map(a => {
      const assigned = (effective[a.key] || []).includes(c.crit);
      if (assigned) rowCount++;
      return `
        <td style="text-align:center; padding:8px; cursor:pointer;" class="btn-matrix-cell" data-act-key="${a.key}" data-act-type="${a.type}" data-act-id="${a.id}" data-crit="${c.crit}" title="${escapeHtml(a.name)}: CE ${c.crit}">
          ${assigned ? '<span class="badge" style="font-size:0.8rem; font-weight:bold; background:#dcfce7; color:#15803d; border-radius:999px; padding:2px 8px;">✓</span>' : '<span style="color:var(--text-muted); opacity:0.3;">-</span>'}
        </td>
      `;
    }).join('');

    html += `
      <tr>
        <td style="position:sticky; left:0; background:var(--bg-surface); z-index:4; border-right:2px solid var(--border);" title="${escapeHtml(c.text)}">
          <div style="font-weight:bold; color:var(--primary);">CE ${c.crit} <span class="badge" style="font-size:0.7rem; margin-left:5px;">${escapeHtml(c.block)}</span></div>
          <div style="font-size:0.8rem; color:var(--text-secondary); line-height:1.3; margin-top:2px; display:-webkit-box; -webkit-line-clamp:2; -webkit-box-orient:vertical; overflow:hidden;">${escapeHtml(c.text)}</div>
        </td>
        ${cells}
        <td style="text-align:center; font-weight:bold;">
          <span class="badge" style="background:${rowCount > 0 ? '#e0e7ff' : '#fee2e2'}; color:${rowCount > 0 ? '#3730a3' : '#991b1b'};">${rowCount}</span>
        </td>
      </tr>
    `;
  });

  // Footer con recuentos por actividad
  html += `
    <tr style="background:var(--bg-body); font-weight:bold; border-top:2px solid var(--border);">
      <td style="position:sticky; left:0; background:var(--bg-body); z-index:5; padding:10px 12px;">Criterios por actividad:</td>
      ${activities.map(a => {
        const count = (effective[a.key] || []).length;
        const color = count === 1 ? '#15803d' : count > 1 ? '#b45309' : '#b91c1c';
        const bg = count === 1 ? '#dcfce7' : count > 1 ? '#fef3c7' : '#fee2e2';
        return `
          <td style="text-align:center; padding:8px;">
            <span class="badge" style="background:${bg}; color:${color}; font-size:0.8rem; font-weight:700; border-radius:999px; padding:2px 8px;">${count}</span>
          </td>
        `;
      }).join('')}
      <td style="text-align:center;">-</td>
    </tr>
  `;

  $('eval-tbody').innerHTML = html;

  // Clicks en celdas de la matriz para ver detalle en el panel lateral
  document.querySelectorAll('.btn-matrix-cell').forEach(cell => {
    cell.addEventListener('click', () => {
      const actType = cell.dataset.actType;
      const actId = cell.dataset.actId;
      const crit = cell.dataset.crit;
      if (actType === 'task') {
        showTaskDetail(actId);
      } else {
        showActivityDetail(actType, actId, crit, effective);
      }
    });
  });
}

function showActivityDetail(type, id, critCode, effective) {
  const panel = $('task-detail-panel');
  if (!panel) return;

  if (type === 'game') {
    const game = GAMES[id];
    const assigned = effective[`game:${id}`] || [];
    panel.innerHTML = `
      <div style="margin-bottom:15px;">
        <span class="badge" style="text-transform:uppercase; background:#ede9fe; color:#6d28d9; font-weight:700;">Minijuego</span>
        <h3 style="margin:5px 0 0; color:var(--text-primary); font-size:1.5rem;">${game ? game.icon : '🎮'} ${game ? escapeHtml(game.name) : id}</h3>
      </div>
      <div style="display:flex; gap:8px; margin-bottom:15px; flex-wrap:wrap;">
        <span class="badge badge--primary">Criterios asignados: ${assigned.join(', ') || 'Ninguno'}</span>
      </div>
      <p style="color:var(--text-secondary); margin-bottom:10px; font-weight:600;">Descripción del juego:</p>
      <div class="task-desc">${game ? escapeHtml(game.description || '') : 'Sin descripción'}</div>
    `;
  } else if (type === 'test') {
    const topic = TOPICS[id];
    const assigned = effective[`test:${id}`] || [];
    panel.innerHTML = `
      <div style="margin-bottom:15px;">
        <span class="badge" style="text-transform:uppercase; background:#dbeafe; color:#1e40af; font-weight:700;">Test de Repaso</span>
        <h3 style="margin:5px 0 0; color:var(--text-primary); font-size:1.5rem;">${topic ? topic.icon : '📖'} ${topic ? escapeHtml(topic.name) : id}</h3>
      </div>
      <div style="display:flex; gap:8px; margin-bottom:15px; flex-wrap:wrap;">
        <span class="badge badge--accent">Criterios asignados: ${assigned.join(', ') || 'Ninguno'}</span>
      </div>
      <p style="color:var(--text-secondary); margin-bottom:10px; font-weight:600;">Temario:</p>
      <div class="task-desc">Test teórico de preguntas tipo test vinculadas al temario de la materia. Evalúa comprensión conceptual de los contenidos del bloque.</div>
    `;
  }
}

