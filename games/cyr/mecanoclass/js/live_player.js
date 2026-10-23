import { requireAuth } from '../../../../js/common/auth.js';
import { joinLiveSession, updateLiveParticipant, listenToLiveSession, saveGameResult } from '../../../../js/common/db.js';
import { renderHeader, showToast } from '../../../../js/common/ui.js';
import { getUrlParams } from '../../../../js/common/utils.js';

let currentUser = null;
let currentProfile = null;
let currentPin = null;
let engine = null;

let lastUpdate = 0;
const UPDATE_INTERVAL = 2000;

document.addEventListener('DOMContentLoaded', () => {
    requireAuth({
        allowedRoles: ['student', 'teacher'],
        onAuthorized: async (user, profile) => {

            currentUser = user;
            currentProfile = profile;
            
            renderHeader(user, profile);

            const params = getUrlParams();
            if (params.pin) {
                document.getElementById('gamePinInput').value = params.pin;
            }

            document.getElementById('btnJoinGame').addEventListener('click', joinGame);
        }
    });
});

async function joinGame() {
    const pinInput = document.getElementById('gamePinInput');
    const pin = pinInput.value.trim();

    if (!pin) return showToast("Introduce el PIN", 'warning');

    try {
        currentPin = pin;
        await joinLiveSession(pin, currentUser.uid, currentProfile.displayName);

        document.getElementById('joinScreen').classList.add('d-none');
        document.getElementById('waitingScreen').classList.remove('d-none');
        document.getElementById('waitingScreen').classList.add('d-flex');

        listenToLiveSession(pin, handleSessionUpdate);

    } catch (error) {
        console.error("Error joining game:", error);
        showToast(error.message, 'error');
    }
}

function handleSessionUpdate(sessionData) {
    if (!sessionData) return;
    
    if (sessionData.status === 'running') {
        if (!engine) {
            startGame(sessionData.text);
        }
    } else if (sessionData.status === 'finished') {
        if (engine && !engine.endTime) {
            engine.stop();
        }
    }
}

function startGame(text) {
    document.getElementById('waitingScreen').classList.remove('d-flex');
    document.getElementById('waitingScreen').classList.add('d-none');

    document.getElementById('gameScreen').classList.remove('d-none');
    document.getElementById('gameScreen').classList.add('d-flex');

    document.getElementById('hiddenInput').focus();

    engine = new TypingEngine(text, {
        onUpdate: (wpm, accuracy) => {
            document.getElementById('wpmDisplay').innerText = wpm;

            const progress = Math.min(100, Math.round((engine.currentIndex / engine.fullText.length) * 100));
            document.getElementById('progressDisplay').innerText = progress + '%';

            const now = Date.now();
            if (now - lastUpdate > UPDATE_INTERVAL) {
                lastUpdate = now;
                updateLiveParticipant(currentPin, currentUser.uid, {
                    wpm,
                    progress,
                    accuracy,
                    status: 'playing'
                });
            }
        },
        onComplete: async (stats) => {
            const isDisqualified = stats.accuracy < 90;
            const finalStatus = isDisqualified ? 'disqualified' : 'finished';

            await updateLiveParticipant(currentPin, currentUser.uid, {
                wpm: stats.wpm,
                progress: 100,
                accuracy: stats.accuracy,
                status: finalStatus
            });

            if (isDisqualified) {
                const overlay = document.getElementById('resultOverlay');
                overlay.classList.remove('d-none');
                overlay.classList.add('d-flex');

                overlay.innerHTML = `
                    <div class="overlay-card overlay-card--danger">
                        <div class="overlay-icon">❌</div>
                        <h2 class="overlay-title-danger">Descalificado</h2>
                        <p style="color: #f1f5f9; margin: 0; font-size: 0.95rem;">Precisión Insuficiente: <strong style="color:#f87171;">${stats.accuracy}%</strong></p>
                        <p style="color: var(--text-dim); margin: 0; font-size: 0.85rem;">Necesitas al menos 90% para clasificar.</p>
                        <div class="overlay-actions mt-3">
                            <button class="btn-secondary-glow" onclick="window.history.back()">⬅️ Salir</button>
                        </div>
                    </div>
                `;
            } else {
                // We use saveGameResult from common module
                await saveGameResult('mecanoclass', currentUser.uid, null, stats.wpm, {
                    wpm: stats.wpm,
                    accuracy: stats.accuracy,
                    duration: null,
                    mode: 'live',
                    pin: currentPin
                });

                document.getElementById('resultOverlay').classList.remove('d-none');
                document.getElementById('resultOverlay').classList.add('d-flex');
            }
        }
    });

    engine.start();
}
