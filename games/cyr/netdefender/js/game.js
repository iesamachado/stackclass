import { requireAuth, incrementDigitalWellbeing } from '../../../../../js/common/auth.js';
import { getUrlParams } from '../../../../../js/common/utils.js';
import { saveGameResult } from '../../../../../js/common/db.js';

let currentUserInfo = null;
const urlParams = getUrlParams();
const classId = urlParams.classId;

let score = 0;
let lives = 3;
let activeThreats = [];
let spawnInterval;
let gameLoopInterval;
let isGameOver = false;

const TYPES = [
  { id: 'firewall', labels: ['DDoS Attack', 'Intento SSH', 'Inyección SQL'] },
  { id: 'antivirus', labels: ['virus.exe', 'troyano.bat', 'ransomware'] },
  { id: 'spam', labels: ['Premio 1M€', 'Tu banco: Urgente', 'Viagra Barata'] }
];

const area = document.getElementById('game-area');
const scoreEl = document.getElementById('score');
const livesEl = document.getElementById('lives');

function initGame() {
  document.querySelectorAll('.def-btn').forEach(btn => {
    btn.addEventListener('click', () => handleDefense(btn.getAttribute('data-def')));
  });
  
  document.getElementById('btn-restart').addEventListener('click', () => {
    window.location.href = '../../../dashboard_student.html';
  });
  
  startGame();
}

function startGame() {
  score = 0;
  lives = 3;
  activeThreats = [];
  isGameOver = false;
  updateUI();
  
  spawnInterval = setInterval(spawnThreat, 2000);
  gameLoopInterval = setInterval(gameLoop, 50);
}

function spawnThreat() {
  if (isGameOver) return;
  
  const typeObj = TYPES[Math.floor(Math.random() * TYPES.length)];
  const label = typeObj.labels[Math.floor(Math.random() * typeObj.labels.length)];
  
  const el = document.createElement('div');
  el.className = `threat threat-${typeObj.id}`;
  el.innerText = label;
  
  // Random horizontal position (20% to 80%)
  el.style.left = `${20 + Math.random() * 60}%`;
  
  // Speed increases with score
  const duration = Math.max(2, 6 - (score * 0.1)); 
  el.style.animationDuration = `${duration}s`;
  
  area.appendChild(el);
  
  activeThreats.push({
    el: el,
    type: typeObj.id,
    spawnTime: Date.now()
  });
}

function handleDefense(defType) {
  if (isGameOver || activeThreats.length === 0) return;
  
  // Find the lowest threat of this type (oldest spawn time usually, or highest bounding box)
  let targetIdx = -1;
  let maxBottom = -1;
  
  for (let i = 0; i < activeThreats.length; i++) {
    if (activeThreats[i].type === defType) {
      const rect = activeThreats[i].el.getBoundingClientRect();
      if (rect.bottom > maxBottom) {
        maxBottom = rect.bottom;
        targetIdx = i;
      }
    }
  }
  
  if (targetIdx !== -1) {
    // Destroyed
    area.removeChild(activeThreats[targetIdx].el);
    activeThreats.splice(targetIdx, 1);
    score++;
    scoreEl.innerText = score;
  }
}

function gameLoop() {
  if (isGameOver) return;
  
  const serverRect = document.querySelector('.server-base').getBoundingClientRect();
  
  for (let i = activeThreats.length - 1; i >= 0; i--) {
    const t = activeThreats[i];
    const rect = t.el.getBoundingClientRect();
    
    if (rect.bottom >= serverRect.top) {
      // Hit!
      area.removeChild(t.el);
      activeThreats.splice(i, 1);
      lives--;
      updateUI();
      
      // Flash screen red
      area.style.backgroundColor = '#450a0a';
      setTimeout(() => area.style.backgroundColor = '', 200);
      
      if (lives <= 0) {
        endGame();
      }
    }
  }
}

function updateUI() {
  scoreEl.innerText = score;
  livesEl.innerText = '♥'.repeat(Math.max(0, lives));
}

async function endGame() {
  isGameOver = true;
  clearInterval(spawnInterval);
  clearInterval(gameLoopInterval);
  
  document.getElementById('go-score').innerText = score;
  document.getElementById('game-over').style.display = 'flex';
  
  if (classId && currentUserInfo) {
    try {
      await saveGameResult('netdefender', currentUserInfo.user.uid, classId, score * 10, { survived: score });
    } catch(e) {}
  }
}

requireAuth({
  allowedRoles: ['student', 'teacher'],
  onAuthorized: async (user, profile) => {
    if (profile.role === 'student') {
      const allowed = await incrementDigitalWellbeing(user.id, 'game', 'netdefender');
      if (!allowed) return;
    }
    currentUserInfo = { user, profile };
    initGame();
  }
});
