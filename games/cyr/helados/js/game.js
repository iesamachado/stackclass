import { requireGameAccess } from '../../../../../js/common/auth.js';
import { saveGameResult } from '../../../../../js/common/db.js';
import { renderHeader, showToast } from '../../../../../js/common/ui.js';

let currentUser = null;
let currentHighScore = 0;
let currentPlayed = 0;
let currentClassId = null;
let totalItemsServed = 0;

let currentLevelIndex = 0;
let targetStack = [];
let playerStack = [];
let score = 0;
let timeLeft = 90;
let timerInterval = null;
let isPlaying = false;
let mistakes = 0;

const domTime = document.getElementById('time');
const domScore = document.getElementById('score');
const domCardValues = document.getElementById('card-values');
const domCardOps = document.getElementById('card-operations');
const domStack = document.getElementById('stack');
const domIcecreamBuilder = document.getElementById('icecream-builder');
const flavorBtns = document.querySelectorAll('.flavor-btn');
const startScreen = document.getElementById('start-screen');
const gameOverScreen = document.getElementById('game-over-screen');
const startBtn = document.getElementById('start-btn');
const restartBtn = document.getElementById('restart-btn');
const finalScore = document.getElementById('final-score');
const cardEl = document.getElementById('current-card');

// Nuevos controles
const verifyBtn = document.getElementById('verify-btn');
const clearBtn = document.getElementById('clear-btn');
const mistakesCounter = document.getElementById('mistakes-counter');
const solutionScreen = document.getElementById('solution-screen');
const solutionStack = document.getElementById('solution-stack');
const nextLevelBtn = document.getElementById('next-level-btn');

requireGameAccess('helados', {
    onGranted: async (user, profile, classId) => {

        currentUser = user;
        currentClassId = classId;
        renderHeader(user, profile);
        initGame();
    }
});

let isGameInitialized = false;

function initGame() {
    if (isGameInitialized) return;
    isGameInitialized = true;

    startBtn?.addEventListener('click', startGame);
    restartBtn?.addEventListener('click', startGame);
    clearBtn?.addEventListener('click', () => {
        if (!isPlaying) return;
        playerStack = [];
        domStack.innerHTML = '';
    });
    verifyBtn?.addEventListener('click', handleVerify);
    nextLevelBtn?.addEventListener('click', () => {
        solutionScreen.classList.add('hidden');
        isPlaying = true;
        currentLevelIndex++;
        loadLevel(generateRandomLevel());
    });
    flavorBtns.forEach(btn => {
        btn.addEventListener('click', (e) => {
            if (!isPlaying) return;
            e.preventDefault();
            addScoop(parseInt(btn.getAttribute('data-flavor'), 10));
        });
    });
    window.addEventListener('keydown', handleKeyDown);
    const menuBtn = document.getElementById('menu-btn');
    menuBtn?.addEventListener('click', () => { window.location.href = '../../../index.html'; });
}

function handleKeyDown(e) {
    if (e.ctrlKey || e.altKey || e.metaKey) return;

    let flavor = null;
    if (e.key >= '1' && e.key <= '6') {
        flavor = parseInt(e.key, 10);
    } else if (e.code && /^Numpad[1-6]$/.test(e.code)) {
        flavor = parseInt(e.code.replace('Numpad', ''), 10);
    }

    if (flavor !== null) {
        if (!isPlaying) return;
        e.preventDefault();
        addScoop(flavor);

        const btn = document.querySelector(`.flavor-btn[data-flavor="${flavor}"]`);
        if (btn) {
            btn.classList.add('active');
            setTimeout(() => btn.classList.remove('active'), 120);
        }
        return;
    }

    if (isPlaying) {
        if (e.key === 'Enter') {
            e.preventDefault();
            handleVerify();
        } else if (e.key === 'Backspace' || e.key === 'Delete') {
            e.preventDefault();
            playerStack = [];
            domStack.innerHTML = '';
        }
    } else {
        if (e.key === 'Enter' || e.key === ' ') {
            if (startScreen && !startScreen.classList.contains('hidden')) {
                e.preventDefault();
                startGame();
            } else if (solutionScreen && !solutionScreen.classList.contains('hidden')) {
                e.preventDefault();
                nextLevelBtn?.click();
            } else if (gameOverScreen && !gameOverScreen.classList.contains('hidden')) {
                e.preventDefault();
                startGame();
            }
        }
    }
}

function startGame() {
    score = 0;
    timeLeft = 90;
    currentLevelIndex = 0;
    totalItemsServed = 0;
    isPlaying = true;
    
    updateHUD();
    
    startScreen.classList.add('hidden');
    gameOverScreen.classList.add('hidden');
    solutionScreen.classList.add('hidden');
    
    loadLevel(generateRandomLevel());
    
    clearInterval(timerInterval);
    timerInterval = setInterval(() => {
        timeLeft--;
        updateHUD();
        
        if (timeLeft <= 10) {
            domTime.classList.add('danger');
        } else {
            domTime.classList.remove('danger');
        }
        
        if (timeLeft <= 0) {
            endGame();
        }
    }, 1000);
}

function endGame() {
    isPlaying = false;
    clearInterval(timerInterval);
    domTime.classList.remove('danger');
    finalScore.innerText = score;
    gameOverScreen.classList.remove('hidden');
    
    if (currentUser) {
        saveGameResult('helados', currentUser.uid, currentClassId, score, { level: currentLevelIndex, itemsServed: totalItemsServed });
    }
}

function updateHUD() {
    domScore.innerText = score;
    domTime.innerText = timeLeft;
    mistakesCounter.innerText = `Fallos: ${mistakes}/3`;
}

function generateRandomLevel() {
    const difficulty = Math.min(3, Math.floor(currentLevelIndex / 3));
    
    const getAscending = (minVal, maxVal, len) => {
        const maxStart = maxVal - len + 1;
        const start = Math.floor(Math.random() * (maxStart - minVal + 1)) + minVal;
        return Array.from({length: len}, (_, i) => start + i);
    };
    
    const getDescending = (minVal, maxVal, len) => {
        const minStart = minVal + len - 1;
        const start = Math.floor(Math.random() * (maxVal - minStart + 1)) + minStart;
        return Array.from({length: len}, (_, i) => start - i);
    };
    
    const templatesEasy = [
        () => ({
            values: getAscending(1, 6, Math.floor(Math.random() * 2) + 2),
            ops: ['A']
        }),
        () => ({
            values: getDescending(1, 6, Math.floor(Math.random() * 2) + 2),
            ops: ['A']
        })
    ];

    const templatesMed = [
        () => ({
            values: getAscending(1, 6, Math.floor(Math.random() * 2) + 3),
            ops: ['A', 'A']
        }),
        () => ({
            values: getAscending(1, 5, Math.floor(Math.random() * 2) + 3),
            ops: ['A+1']
        }),
        () => ({
            values: getDescending(2, 6, Math.floor(Math.random() * 2) + 3),
            ops: ['A-1']
        })
    ];

    const templatesHard = [
        () => ({
            values: getAscending(1, 3, Math.floor(Math.random() * 2) + 2),
            ops: ['A', 'A+A']
        }),
        () => {
            const c = Math.floor(Math.random() * 6) + 1;
            return {
                values: getAscending(1, 6, Math.floor(Math.random() * 2) + 3),
                ops: ['A', c.toString()]
            };
        },
        () => ({
            values: getAscending(2, 5, Math.floor(Math.random() * 2) + 2),
            ops: ['A-1', 'A+1']
        })
    ];
    
    const templatesExpert = [
         () => ({
            values: getAscending(1, 3, Math.floor(Math.random() * 2) + 2),
            ops: ['A', 'A+1', 'A+A']
        }),
        () => ({
            values: getDescending(2, 6, Math.floor(Math.random() * 3) + 3),
            ops: ['A', 'A-1']
        })
    ];
    
    let pool = templatesEasy;
    if (difficulty === 1) pool = templatesMed;
    if (difficulty === 2) pool = templatesHard;
    if (difficulty >= 3) pool = templatesExpert;
    
    return pool[Math.floor(Math.random() * pool.length)]();
}

function loadLevel(level) {
    playerStack = [];
    domStack.innerHTML = '';
    mistakes = 0;
    updateHUD();
    
    cardEl.style.transform = 'translateY(100%) rotateZ(-10deg)';
    cardEl.style.opacity = '0';
    
    setTimeout(() => {
        domCardValues.innerHTML = '';
        level.values.forEach(v => {
            const div = document.createElement('div');
            div.className = `val val-${v}`;
            div.innerText = v;
            domCardValues.appendChild(div);
        });
        
        domCardOps.innerHTML = '';
        level.ops.forEach(op => {
            const div = document.createElement('div');
            div.className = `op-block ${op.includes('-') || op.includes('+') ? 'op-red' : ''}`;
            div.innerText = op;
            domCardOps.appendChild(div);
        });
        
        targetStack = calculateTargetStack(level);
        
        cardEl.style.transition = 'all 0.5s cubic-bezier(0.175, 0.885, 0.32, 1.275)';
        cardEl.style.transform = 'translateY(0) rotateY(5deg)';
        cardEl.style.opacity = '1';
    }, 300);
}

function calculateTargetStack(level) {
    let stack = [];
    for (let i = 0; i < level.values.length; i++) {
        const A = level.values[i];
        for (let j = 0; j < level.ops.length; j++) {
            const op = level.ops[j];
            let flavor = parseOperation(op, A);
            if (flavor > 6) flavor = 6;
            if (flavor < 1) flavor = 1;
            stack.push(flavor);
        }
    }
    return stack;
}

function parseOperation(op, A) {
    if (op === 'A') return A;
    if (op === 'A+1') return A + 1;
    if (op === 'A-1') return A - 1;
    if (op === 'A+A') return A + A;
    if (!isNaN(parseInt(op))) return parseInt(op);
    return A;
}



let lastScoopTime = 0;
let lastScoopFlavor = null;

function addScoop(flavor) {
    if (!isPlaying) return;
    const now = performance.now();
    // Prevenir duplicados accidentales (< 100ms para el mismo sabor, < 30ms para cualquiera)
    if ((now - lastScoopTime < 100 && lastScoopFlavor === flavor) || (now - lastScoopTime < 30)) {
        return;
    }
    lastScoopTime = now;
    lastScoopFlavor = flavor;

    const scoopEl = document.createElement('div');
    scoopEl.className = `scoop flavor-${flavor}`;
    
    domStack.appendChild(scoopEl);
    playerStack.push(flavor);
}

function handleVerify() {
    if (!isPlaying) return;
    
    let isCorrect = playerStack.length === targetStack.length &&
        playerStack.every((v, i) => v === targetStack[i]);
    
    if (isCorrect) {
        levelComplete();
    } else {
        domIcecreamBuilder.classList.add('shake');
        setTimeout(() => domIcecreamBuilder.classList.remove('shake'), 400);
        mistakes++;
        score = Math.max(0, score - 5);
        timeLeft = Math.max(0, timeLeft - 3);
        updateHUD();
        if (mistakes >= 3) showSolution();
    }
}

function levelComplete() {
    score += targetStack.length * 10;
    timeLeft += 3;
    totalItemsServed += targetStack.length;
    updateHUD();
    
    Array.from(domStack.children).forEach(child => {
        child.classList.add('poof');
    });
    
    setTimeout(() => {
        currentLevelIndex++;
        loadLevel(generateRandomLevel());
    }, 600);
}

function showSolution() {
    isPlaying = false; 
    
    solutionStack.innerHTML = '';
    
    const coneEl = document.createElement('div');
    coneEl.className = 'cone';
    coneEl.style.width = '0';
    coneEl.style.height = '0';
    coneEl.style.borderLeft = '30px solid transparent';
    coneEl.style.borderRight = '30px solid transparent';
    coneEl.style.borderTop = '90px solid #e6a86a';
    coneEl.style.marginTop = '10px';
    solutionStack.appendChild(coneEl);

    targetStack.forEach(flavor => {
        const scoopEl = document.createElement('div');
        scoopEl.className = `scoop flavor-${flavor}`;
        solutionStack.appendChild(scoopEl);
    });
    
    solutionScreen.classList.remove('hidden');
}

// Todos los event listeners se registran en initGame(),
// que se llama desde requireGameAccess.onGranted
