import { requireGameAccess } from '../../../../../js/common/auth.js';
import { getClassAssignments } from '../../../../../js/common/db.js';
import { renderHeader } from '../../../../../js/common/ui.js';

const $ = id => document.getElementById(id);

let currentClassId = null;

requireGameAccess('moon', {
  onGranted: async (user, profile, classId) => {
    currentClassId = classId;
    renderHeader(user, profile);
    
    $("tasks-actions-teacher").style.display = "none";
    await loadStudentTasks();
  }
});

async function loadStudentTasks() {
  $("tasks-list").innerHTML = "<p class='text-dim'>Cargando misiones...</p>";
  
  if (!currentClassId) return;
  
  try {
    const assignments = await getClassAssignments(currentClassId);
    
    if (!assignments || assignments.length === 0) {
      $("tasks-list").innerHTML = "<p class='text-dim'>No tienes misiones pendientes.</p>";
      return;
    }
    
    let html = '<ul style="list-style: none; padding: 0;">';
    assignments.forEach(task => {
       html += `<li style="padding: 15px; margin-bottom: 15px; background: rgba(0,0,0,0.3); border: 1px solid var(--accent-cyan); border-radius: 8px;">
         <h3 style="color: var(--accent-cyan); margin-bottom: 8px; font-family: var(--font-display);">${task.title || 'Misión'}</h3>
         <p style="color: var(--text-dim); line-height: 1.5;">${task.description || 'Sin descripción'}</p>
       </li>`;
    });
    html += '</ul>';
    $("tasks-list").innerHTML = html;
    
  } catch (err) {
     console.error(err);
     $("tasks-list").innerHTML = "<p class='text-dim'>Error al cargar misiones.</p>";
  }
}
