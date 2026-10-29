import { requireAuth, incrementDigitalWellbeing } from "../../../../js/common/auth.js";
import { showToast } from '../../../../js/common/ui.js';
import { saveGameResult } from "../../../../js/common/db.js";

const GAME_ID = 'hex_invaders';
let currentUser = null;
const urlParams = new URLSearchParams(window.location.search);
const classId = urlParams.get('classId') || null;

let score = 0;
let lives = 3;
let targetHex = "";
let isPlaying = false;

// Elementos
const ui = {
  startScreen: document.getElementById('start-screen'),
  gameScreen: document.getElementById('game-screen'),
  resultScreen: document.getElementById('result-screen'),
  score: document.getElementById('score'),
  lives: document.getElementById('lives'),
  targetHex: document.getElementById('target-hex'),
  alienZone: document.getElementById('alien-zone'),
  finalScore: document.getElementById('final-score')
};

// Auth
let isGameAllowed = false;
requireAuth({
  allowedRoles: ['student', 'teacher'],
  onAuthorized: async (user, profile) => {
    currentUser = user;
    const btnStart = document.getElementById('btn-start');
    if (profile.role === 'student') {
      const allowed = await incrementDigitalWellbeing(user.id, 'game', GAME_ID);
      if (!allowed) {
        if (btnStart) { btnStart.disabled = true; btnStart.style.opacity = '0.3'; }
        return;
      }
    }
    isGameAllowed = true;
    if (btnStart) btnStart.onclick = startGame;
    if (document.getElementById('auth-warning')) {
      document.getElementById('auth-warning').style.display = 'none';
    }
  }
});

// Colores fáciles de identificar para empezar
const baseColors = [
  { hex: "#FF0000", name: "Rojo puro" },
  { hex: "#00FF00", name: "Verde puro" },
  { hex: "#0000FF", name: "Azul puro" },
  { hex: "#FFFF00", name: "Amarillo (R+V)" },
  { hex: "#FF00FF", name: "Magenta (R+A)" },
  { hex: "#00FFFF", name: "Cian (V+A)" },
  { hex: "#FFFFFF", name: "Blanco" },
  { hex: "#000000", name: "Negro" },
  { hex: "#888888", name: "Gris" }
];

function getRandomHex() {
  const letters = '0123456789ABCDEF';
  let color = '#';
  for (let i = 0; i < 6; i++) {
    color += letters[Math.floor(Math.random() * 16)];
  }
  return color;
}

function startGame() {
  if (!isGameAllowed) return;
  score = 0;
  lives = 3;
  isPlaying = true;
  updateHUD();
  ui.startScreen.classList.add('hidden');
  ui.resultScreen.classList.add('hidden');
  ui.gameScreen.classList.remove('hidden');
  nextRound();
}

function createAlienSprite(color, idSuffix = 0) {
  const filterId = `alien-filter-${idSuffix}-${Math.floor(Math.random() * 100000)}`;
  return `
    <svg class="alien-sprite" viewBox="-1 -1 13 10" width="100%" height="100%" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <filter id="${filterId}" x="-20%" y="-20%" width="140%" height="140%">
          <feMorphology in="SourceAlpha" result="dilated" operator="dilate" radius="0.25"/>
          <feFlood flood-color="#ffffff" result="white"/>
          <feComposite in="white" in2="dilated" operator="in" result="outline"/>
          <feMerge>
            <feMergeNode in="outline"/>
            <feMergeNode in="SourceGraphic"/>
          </feMerge>
        </filter>
      </defs>
      <g filter="url(#${filterId})" fill="${color}">
        <rect x="2" y="0" width="1" height="1"/>
        <rect x="8" y="0" width="1" height="1"/>
        <rect x="3" y="1" width="1" height="1"/>
        <rect x="7" y="1" width="1" height="1"/>
        <rect x="2" y="2" width="7" height="1"/>
        <rect x="1" y="3" width="2" height="1"/>
        <rect x="4" y="3" width="3" height="1"/>
        <rect x="8" y="3" width="2" height="1"/>
        <rect x="0" y="4" width="11" height="1"/>
        <rect x="0" y="5" width="1" height="1"/>
        <rect x="2" y="5" width="7" height="1"/>
        <rect x="10" y="5" width="1" height="1"/>
        <rect x="0" y="6" width="1" height="1"/>
        <rect x="2" y="6" width="1" height="1"/>
        <rect x="8" y="6" width="1" height="1"/>
        <rect x="10" y="6" width="1" height="1"/>
        <rect x="3" y="7" width="2" height="1"/>
        <rect x="6" y="7" width="2" height="1"/>
      </g>
    </svg>
  `;
}

function nextRound() {
  if (!isPlaying) return;
  ui.alienZone.innerHTML = '';
  
  // Decide si usar un color fácil (70% prob al inicio) o uno random oscuro/claro
  let correctColor = "";
  if (Math.random() > 0.3 || score < 50) {
    correctColor = baseColors[Math.floor(Math.random() * baseColors.length)].hex;
  } else {
    correctColor = getRandomHex();
  }
  
  targetHex = correctColor;
  if (ui.targetHex) ui.targetHex.innerText = targetHex;

  const cleanHex = targetHex.replace('#', '');
  const elR = document.getElementById('hex-digits-r');
  const elG = document.getElementById('hex-digits-g');
  const elB = document.getElementById('hex-digits-b');
  if (elR) elR.innerText = cleanHex.substring(0, 2);
  if (elG) elG.innerText = cleanHex.substring(2, 4);
  if (elB) elB.innerText = cleanHex.substring(4, 6);

  // Generar opciones falsas
  let options = [correctColor];
  while (options.length < 3) {
    let rand = getRandomHex();
    if (!options.includes(rand)) {
      options.push(rand);
    }
  }
  
  // Barajar
  options.sort(() => Math.random() - 0.5);

  // Crear Aliens y animarlos
  const positions = ['10%', '42%', '75%'];
  let fallSpeed = 1 + (score / 50); // Aumenta velocidad con los puntos
  
  options.forEach((color, index) => {
    const alien = document.createElement('div');
    alien.className = 'alien';
    alien.style.left = positions[index];
    alien.dataset.top = -80; // Empieza fuera de pantalla
    alien.dataset.color = color;
    alien.innerHTML = createAlienSprite(color, index);

    alien.onclick = (e) => shootAlien(alien, color === correctColor, e);
    ui.alienZone.appendChild(alien);
  });

  // Empezar el game loop de caída
  if (window.fallInterval) clearInterval(window.fallInterval);
  window.fallInterval = setInterval(() => {
    if (!isPlaying) {
      clearInterval(window.fallInterval);
      return;
    }
    const aliens = document.querySelectorAll('.alien');
    let hitBottom = false;
    
    aliens.forEach(alien => {
      let currentTop = parseFloat(alien.dataset.top);
      currentTop += fallSpeed;
      alien.dataset.top = currentTop;
      alien.style.top = currentTop + 'px';
      
      if (currentTop > 300) { // Límite inferior
        hitBottom = true;
      }
    });

    if (hitBottom) {
      clearInterval(window.fallInterval);
      handleHit(false, true); // Fallo por invasión
    }
  }, 30);
;
}

function shootAlien(alienDiv, isCorrect, event) {
  if (!isPlaying) return;
  
  // Dibujar láser desde el centro inferior hasta el alien
  const laser = document.createElement('div');
  laser.className = 'laser';
  const alienRect = alienDiv.getBoundingClientRect();
  const zoneRect = ui.alienZone.getBoundingClientRect();
  
  // Posición final del láser
  const targetX = alienRect.left + (alienRect.width/2) - zoneRect.left;
  const targetY = alienRect.top + (alienRect.height/2) - zoneRect.top;
  
  laser.style.left = targetX + 'px';
  laser.style.height = (zoneRect.height - targetY) + 'px';
  laser.style.top = targetY + 'px';
  ui.alienZone.appendChild(laser);
  
  setTimeout(() => {
    laser.remove();
    
    // Si acierta, explota y gana. Si falla, explota la nave equivocada pero la invasión continúa.
    if (isCorrect) {
      alienDiv.innerText = "💥";
      alienDiv.style.backgroundColor = "transparent";
      alienDiv.style.border = "none";
      alienDiv.style.boxShadow = "none";
      setTimeout(() => handleHit(true, false), 150);
    } else {
      // Nave equivocada: No explota, el láser rebota (feedback visual) y sigue cayendo
      alienDiv.style.transform = "rotate(15deg) scale(0.9)";
      setTimeout(() => alienDiv.style.transform = "rotate(0deg) scale(1)", 150);
    }

  }, 100);
}

function handleHit(isCorrect, isCollision) {
  if (!isPlaying) return;
  if (window.fallInterval) clearInterval(window.fallInterval);

  if (isCorrect) {
    score += 10;
    ui.gameScreen.style.backgroundColor = 'rgba(0, 255, 0, 0.1)';
    setTimeout(() => ui.gameScreen.style.backgroundColor = '', 200);
    updateHUD();
    nextRound();
  } else {
    lives--;
    ui.gameScreen.style.backgroundColor = 'rgba(255, 0, 0, 0.2)';
    setTimeout(() => ui.gameScreen.style.backgroundColor = '', 200);
    updateHUD();
    
    if (lives <= 0) {
      endGame();
    } else {
      // Si fue colisión (invasión), un alert rápido o directamente pasa a la sig
      setTimeout(() => nextRound(), 300);
    }
  }
}

function updateHUD() {
  ui.score.innerText = score;
  ui.lives.innerText = "❤️".repeat(lives);
}

async function endGame() {
  isPlaying = false;
  ui.gameScreen.classList.add('hidden');
  ui.resultScreen.classList.remove('hidden');
  ui.finalScore.innerText = score;

  if (currentUser) {
    try {
      await saveGameResult(GAME_ID, currentUser.uid, classId, score);
      console.log('Puntuación Hex Invaders guardada.');
    } catch (e) {
      console.error('Error al guardar puntuación:', e);
    }
  }
}

// Botones
document.getElementById('btn-restart').onclick = () => window.location.reload();
