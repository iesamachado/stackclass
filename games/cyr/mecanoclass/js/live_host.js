import { requireAuth, currentUser, currentProfile } from '../../../../js/common/auth.js';
import { createLiveSession, updateLiveSession, listenToLiveSession, listenToLiveParticipants, getUserProfile } from '../../../../js/common/db.js';
import { renderHeader, showToast } from '../../../../js/common/ui.js';

let gamePin = null;
let participants = [];
let gameText = "Texto de carrera cargando...";
let playerProfilesCache = {};

const LANE_HEIGHT = 60;
const LANE_GAP = 16;

document.addEventListener('DOMContentLoaded', () => {
    requireAuth({
        allowedRoles: ['teacher', 'student'],
        onAuthorized: (user, profile) => {
            renderHeader(user, profile);
            initGame(user.uid);
            
            document.getElementById('btnJoinAsPlayer').addEventListener('click', joinAsPlayer);
            document.getElementById('btnExitGame').addEventListener('click', exitGame);
            document.getElementById('startGameBtn').addEventListener('click', startGame);
            
            document.getElementById('forceEndGameBtn').addEventListener('click', () => {
                if (confirm('¿Estás seguro de finalizar la carrera ahora?')) {
                    updateLiveSession(gamePin, { status: 'finished' });
                    showPodium(participants);
                }
            });
        }
    });
});

async function initGame(hostId) {
    try {
        if (typeof initialTexts !== 'undefined' && initialTexts.length > 0) {
            const randomIdx = Math.floor(Math.random() * initialTexts.length);
            gameText = initialTexts[randomIdx].text;
        } else {
            gameText = "La velocidad es importante pero la precision es fundamental para ganar esta carrera.";
        }

        // Use createLiveSession(hostId, 'mecanoclass', { text: selectedText })
        gamePin = await createLiveSession(hostId, 'mecanoclass', { text: gameText });
        document.getElementById('gamePin').innerText = gamePin;

        listenToLiveParticipants(gamePin, updateLobby);

    } catch (error) {
        console.error("Error creating game:", error);
        showToast("Error al crear la partida.", 'error');
    }
}

function updateLobby(updatedParticipants) {
    participants = updatedParticipants;

    const grid = document.getElementById('playersGrid');
    grid.innerHTML = '';

    participants.forEach(async p => {
        let profile = playerProfilesCache[p.userId || p.studentId];
        if (!profile) {
            profile = await getUserProfile(p.userId || p.studentId);
            if (!profile) profile = { displayName: 'Player', photoURL: '' };
            playerProfilesCache[p.userId || p.studentId] = profile;
        }

        const el = `
            <div class="text-center fade-in">
                <img src="${profile.photoURL}" class="rounded-circle border border-2 border-white mb-2" style="width: 60px; height: 60px;">
                <p class="text-white small mb-0">${profile.displayName}</p>
            </div>
        `;
        grid.insertAdjacentHTML('beforeend', el);
    });

    updateRaceTracks(participants);
}

function startGame() {
    if (participants.length === 0) return showToast("Espera a que se unan jugadores.", 'warning');

    updateLiveSession(gamePin, { status: 'running' });

    document.getElementById('lobbyView').classList.add('d-none');
    document.getElementById('raceView').classList.remove('d-none');
    document.getElementById('raceView').classList.add('d-block');

    initRaceTracks();
}

async function initRaceTracks() {
    const tracksContainer = document.getElementById('raceTracks');
    tracksContainer.innerHTML = '';

    const totalHeight = participants.length * (LANE_HEIGHT + LANE_GAP);
    tracksContainer.style.height = `${totalHeight}px`;

    for (let index = 0; index < participants.length; index++) {
        const p = participants[index];
        const uid = p.userId || p.studentId;
        let profile = playerProfilesCache[uid];
        if (!profile) {
            profile = await getUserProfile(uid);
            if (!profile) profile = { displayName: 'Player', photoURL: '' };
            playerProfilesCache[uid] = profile;
        }

        const initialTop = index * (LANE_HEIGHT + LANE_GAP);

        const trackHtml = `
            <div class="racer-lane" id="lane-${uid}" style="top: ${initialTop}px;">
                <div class="racer-name text-truncate" style="max-width: 100px;">${profile.displayName}</div>
                <div class="racer-track"></div>
                <img src="${profile.photoURL}" class="racer-avatar" style="left: 0%;">
            </div>
        `;
        tracksContainer.insertAdjacentHTML('beforeend', trackHtml);
    }
}

function updateRaceTracks(currentParticipants) {
    const sortedParticipants = [...currentParticipants].sort((a, b) => {
        const aDisq = a.status === 'disqualified';
        const bDisq = b.status === 'disqualified';

        if (aDisq && !bDisq) return 1;
        if (!aDisq && bDisq) return -1;

        if (b.progress !== a.progress) {
            return (b.progress || 0) - (a.progress || 0);
        }

        return (b.wpm || 0) - (a.wpm || 0);
    });

    sortedParticipants.forEach((p, index) => {
        const uid = p.userId || p.studentId;
        const lane = document.getElementById(`lane-${uid}`);
        if (lane) {
            const avatar = lane.querySelector('.racer-avatar');
            avatar.style.left = `calc(${p.progress || 0}% - 25px)`;

            const newTop = index * (LANE_HEIGHT + LANE_GAP);
            lane.style.top = `${newTop}px`;

            if (p.status === 'disqualified') {
                avatar.style.border = '2px solid red';
                avatar.style.opacity = '0.7';
                lane.style.background = 'rgba(248, 113, 113, 0.1)';
            }
        }
    });

    if (currentParticipants.length > 0 && currentParticipants.every(p => (p.progress || 0) >= 100)) {
        showPodium(currentParticipants);
    }
}

function showPodium(finalParticipants) {
    const sortedParticipants = [...finalParticipants].sort((a, b) => {
        const aDisq = a.status === 'disqualified';
        const bDisq = b.status === 'disqualified';
        if (aDisq && !bDisq) return 1;
        if (!aDisq && bDisq) return -1;
        if (b.progress !== a.progress) {
            return (b.progress || 0) - (a.progress || 0);
        }
        return (b.wpm || 0) - (a.wpm || 0);
    });

    const qualifiedParticipants = sortedParticipants.filter(p => p.status !== 'disqualified');
    const [first, second, third] = qualifiedParticipants;

    if (first) setPodiumData('gold', first);
    if (second) setPodiumData('silver', second);
    if (third) setPodiumData('bronze', third);

    // Fill table
    const tableBody = document.getElementById('allParticipantsTableBody');
    tableBody.innerHTML = '';
    sortedParticipants.forEach((p, index) => {
        const uid = p.userId || p.studentId;
        const profile = playerProfilesCache[uid] || { displayName: 'Player' };
        const errors = p.accuracy !== undefined ? (100 - p.accuracy).toFixed(1) + '%' : '-';
        const wpm = p.wpm || 0;
        const progress = p.progress || 0;
        const isDisq = p.status === 'disqualified';
        
        let position = index + 1;
        if (isDisq) position = 'DESC.';

        const tr = `
            <tr class="${isDisq ? 'text-danger opacity-75' : ''}">
                <td>${position}</td>
                <td>
                    <div class="d-flex align-items-center gap-2">
                        <img src="${profile.photoURL || ''}" class="rounded-circle" style="width: 24px; height: 24px; object-fit: cover; background: #333;">
                        ${profile.displayName}
                    </div>
                </td>
                <td>${wpm}</td>
                <td>${errors}</td>
                <td>${progress}%</td>
            </tr>
        `;
        tableBody.insertAdjacentHTML('beforeend', tr);
    });

    document.getElementById('raceView').classList.add('d-none');
    document.getElementById('raceView').classList.remove('d-block');
    document.getElementById('podiumView').classList.remove('d-none');
    document.getElementById('podiumView').classList.add('d-flex');
}

async function setPodiumData(type, participant) {
    const uid = participant.userId || participant.studentId;
    let profile = playerProfilesCache[uid];
    if (!profile) profile = await getUserProfile(uid);

    if (profile) {
        const avatarEl = document.getElementById(`${type}Avatar`);
        if (avatarEl) avatarEl.src = profile.photoURL || '';
    }
    
    const statsEl = document.getElementById(`${type}Stats`);
    if (statsEl) {
        const wpm = participant.wpm || 0;
        const errors = participant.accuracy !== undefined ? (100 - participant.accuracy).toFixed(1) : 0;
        statsEl.innerHTML = `
            <div>${wpm} PPM</div>
            <div class="text-white-50" style="font-size: 0.9em;">${errors}% Err</div>
        `;
    }
}

function exitGame() {
    if (confirm("¿Estás seguro de cerrar la partida?")) {
        window.history.back();
    }
}

function joinAsPlayer() {
    if (!gamePin) return showToast("Espera a que se genere el PIN.", 'warning');
    window.open(`live_player.html?pin=${gamePin}`, '_blank');
}
