import { requireAuth, currentUser, currentProfile, isAdmin } from '../../../../js/common/auth.js';
import { renderHeader, showToast, initParticles } from '../../../../js/common/ui.js';
import { $ } from '../../../../js/common/utils.js';

document.addEventListener('DOMContentLoaded', () => {
    initParticles('particles-canvas', '#00e5ff', '#ff3366');

    requireAuth({
        allowedRoles: ['teacher', 'student'],
        onAuthorized: (user, profile) => {
            renderHeader(user, profile);
            setupUI(user, profile);
        }
    });
});

function setupUI(user, profile) {
    const isTeacherOrAdmin = profile.role === 'teacher' || isAdmin(user, profile);
    
    if (isTeacherOrAdmin) {
        const teacherSection = $('teacher-section');
        if (teacherSection) teacherSection.style.display = 'flex';
        
        const btnCrear = $('btn-crear-sala');
        if (btnCrear) {
            btnCrear.addEventListener('click', () => {
                window.location.href = 'sala_profesor.html';
            });
        }
    }
    
    const formUnirse = $('form-unirse');
    if (formUnirse) {
        formUnirse.addEventListener('submit', (e) => {
            e.preventDefault();
            const code = $('input-codigo').value.trim().toUpperCase();
            if (code.length > 0) {
                window.location.href = `sala_alumno.html?code=${encodeURIComponent(code)}`;
            } else {
                showToast('Por favor, introduce un código de sala.', 'error');
            }
        });
    }
}
