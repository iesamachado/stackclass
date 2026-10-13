// ============================================================
// index.js — Portal de Modos de Juego MecanoClass
// ============================================================

import { requireAuth, isAdmin } from '../../../../../js/common/auth.js';
import { renderHeader, showToast } from '../../../../../js/common/ui.js';
import { $, getUrlParams } from '../../../../../js/common/utils.js';
import { getHostLiveSessions, getLiveParticipants, getUserProfile } from '../../../../../js/common/db.js';

document.addEventListener('DOMContentLoaded', () => {
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

    // Reenviar classId al modo entrenamiento si existe
    const params = getUrlParams();
    const classId = params.classId;
    if (classId) {
        const btnPractice = $('btn-practice-mode');
        if (btnPractice) {
            btnPractice.href = `practice.html?classId=${classId}`;
        }
    }

    // Mostrar panel docente
    if (isTeacherOrAdmin) {
        const teacherSection = $('teacher-section');
        if (teacherSection) teacherSection.style.display = 'flex';

        const btnCrear = $('btn-crear-carrera');
        if (btnCrear) {
            btnCrear.addEventListener('click', () => {
                window.location.href = 'live_host.html';
            });
        }
        
        const btnHistorial = $('btn-historial-carreras');
        if (btnHistorial) {
            btnHistorial.addEventListener('click', () => {
                $('historialModal').classList.remove('d-none');
                $('historialModal').style.display = 'flex';
                loadHistorial(user.uid);
            });
        }
        
        const btnClose = $('closeHistorialBtn');
        if (btnClose) {
            btnClose.addEventListener('click', () => {
                $('historialModal').classList.add('d-none');
                $('historialModal').style.display = 'none';
            });
        }
    }

    // Formulario unirse a carrera alumno
    const formUnirse = $('form-unirse-carrera');
    if (formUnirse) {
        formUnirse.addEventListener('submit', (e) => {
            e.preventDefault();
            const pinInput = $('input-pin-carrera');
            const pin = pinInput ? pinInput.value.trim().toUpperCase() : '';

            if (pin.length > 0) {
                window.location.href = `live_player.html?pin=${encodeURIComponent(pin)}`;
            } else {
                showToast('Por favor, introduce el PIN de la carrera.', 'warning');
            }
        });
    }
}

async function loadHistorial(uid) {
    const list = $('historialList');
    const loading = $('historialLoading');
    
    list.innerHTML = '';
    loading.classList.remove('d-none');
    
    try {
        const sessions = await getHostLiveSessions(uid, 'mecanoclass');
        if (sessions.length === 0) {
            list.innerHTML = '<p class="text-center text-white-50 py-4">No has creado ninguna carrera en vivo aún.</p>';
            return;
        }
        
        for (const session of sessions) {
            const dateStr = session.createdAt ? session.createdAt.toDate().toLocaleString() : 'Fecha desconocida';
            const statusLabel = session.status === 'finished' ? '<span class="badge bg-success">Finalizada</span>' : 
                                session.status === 'running' ? '<span class="badge bg-warning text-dark">En curso</span>' : 
                                '<span class="badge bg-secondary">Lobby</span>';
                                
            // Get participants
            const participants = await getLiveParticipants(session.pin);
            
            // Sort by wpm descending
            participants.sort((a, b) => (b.wpm || 0) - (a.wpm || 0));
            
            let html = `
                <div class="glass-panel p-3" style="border-left: 4px solid #818cf8;">
                    <div class="d-flex justify-content-between align-items-center mb-2">
                        <h4 class="text-white mb-0" style="font-family: 'JetBrains Mono', monospace;">PIN: ${session.pin}</h4>
                        <div>${statusLabel}</div>
                    </div>
                    <div class="text-white-50 small mb-3">📅 ${dateStr} | 👥 ${participants.length} participantes</div>
            `;
            
            if (participants.length > 0) {
                html += `
                    <div class="table-responsive bg-dark rounded">
                        <table class="table table-dark table-sm mb-0">
                            <thead>
                                <tr>
                                    <th>#</th>
                                    <th>Jugador</th>
                                    <th>PPM</th>
                                    <th>Errores</th>
                                    <th>Estado</th>
                                </tr>
                            </thead>
                            <tbody>
                `;
                
                for (let i = 0; i < participants.length; i++) {
                    const p = participants[i];
                    const uid = p.userId || p.studentId;
                    const profile = await getUserProfile(uid) || { displayName: 'Alumno' };
                    const errors = p.accuracy !== undefined ? (100 - p.accuracy).toFixed(1) + '%' : '-';
                    const isDisq = p.status === 'disqualified';
                    const statusText = isDisq ? 'DESC.' : (p.progress || 0) + '%';
                    
                    html += `
                        <tr class="${isDisq ? 'text-danger' : ''}">
                            <td>${i + 1}</td>
                            <td>${profile.displayName}</td>
                            <td>${p.wpm || 0}</td>
                            <td>${errors}</td>
                            <td>${statusText}</td>
                        </tr>
                    `;
                }
                
                html += `
                            </tbody>
                        </table>
                    </div>
                `;
            } else {
                html += `<div class="text-white-50 small">Nadie participó en esta sala.</div>`;
            }
            
            html += `</div>`;
            list.insertAdjacentHTML('beforeend', html);
        }
        
    } catch (err) {
        console.error(err);
        list.innerHTML = `<div class="alert alert-danger">Error al cargar el historial: ${err.message}</div>`;
    } finally {
        loading.classList.add('d-none');
    }
}
