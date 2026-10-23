import { requireAuth, currentUser, incrementDigitalWellbeing } from '../../../../js/common/auth.js';
import { getUrlParams } from '../../../../js/common/utils.js';
import { saveGameResult } from '../../../../js/common/db.js';

let currentUserInfo = null;
const urlParams = getUrlParams();
const classId = urlParams.classId;

// Game State
let stats = {
  hap: 50, // Happiness
  eff: 50, // Efficiency
  eth: 50  // Ethics/Security
};

let currentDay = 0;
const MAX_DAYS = 20;
let gameOver = false;

// Cards Database
const CARDS = [
  {
    icon: '🚗',
    title: 'Coches Autónomos',
    desc: 'El alcalde propone que las IAs de los coches prioricen salvar a los peatones antes que al conductor en un accidente.',
    leftText: 'Priorizar conductor',
    rightText: 'Priorizar peatones',
    leftEff: { hap: 10, eff: 0, eth: -15 },
    rightEff: { hap: -10, eff: 0, eth: 15 }
  },
  {
    icon: '👁️',
    title: 'Cámaras Escolares',
    desc: 'Instalar reconocimiento facial en los colegios para detectar peleas y acoso automáticamente.',
    leftText: 'Es privacidad',
    rightText: 'Por seguridad',
    leftEff: { hap: 15, eff: -10, eth: 5 },
    rightEff: { hap: -15, eff: 15, eth: -10 }
  },
  {
    icon: '👨‍🏫',
    title: 'Profesores Robot',
    desc: 'Sustituir a los profesores de repaso por IAs que no se cansan y personalizan el aprendizaje.',
    leftText: 'No, humanos',
    rightText: 'Sí, IAs',
    leftEff: { hap: 5, eff: -15, eth: 10 },
    rightEff: { hap: -5, eff: 20, eth: -10 }
  },
  {
    icon: '🏥',
    title: 'Predicción Médica',
    desc: 'Vender datos anónimos de los hospitales a una empresa de IA para que investigue curas contra el cáncer.',
    leftText: 'Datos privados',
    rightText: 'Vender datos',
    leftEff: { hap: -5, eff: -10, eth: 20 },
    rightEff: { hap: 10, eff: 15, eth: -15 }
  },
  {
    icon: '🛒',
    title: 'Neveras IA',
    desc: 'Obligar a que las neveras inteligentes bloqueen la compra de dulces si el dueño tiene sobrepeso.',
    leftText: 'Libertad',
    rightText: 'Salud',
    leftEff: { hap: 15, eff: 0, eth: -5 },
    rightEff: { hap: -20, eff: 10, eth: 10 }
  },
  {
    icon: '📱',
    title: 'Censura Automática',
    desc: 'Activar un filtro de IA en redes sociales que borre inmediatamente los comentarios sarcásticos que puedan ofender.',
    leftText: 'Sin filtro',
    rightText: 'Activar filtro',
    leftEff: { hap: 10, eff: -5, eth: -10 },
    rightEff: { hap: -15, eff: 10, eth: 15 }
  },
  {
    icon: '🚔',
    title: 'Policía Predictiva',
    desc: 'Usar un algoritmo para detener a personas que tienen un 90% de probabilidad estadística de cometer un crimen mañana.',
    leftText: 'Es injusto',
    rightText: 'Prevención',
    leftEff: { hap: 5, eff: -15, eth: 20 },
    rightEff: { hap: -15, eff: 20, eth: -25 }
  },
  {
    icon: '🤖',
    title: 'Derechos de los Robots',
    desc: 'Un grupo ecologista pide que desenchufar a un asistente de IA avanzado sea considerado "Daño Psicológico".',
    leftText: 'Son máquinas',
    rightText: 'Otorgar derechos',
    leftEff: { hap: 10, eff: 10, eth: -15 },
    rightEff: { hap: -10, eff: -10, eth: 20 }
  },
  {
    icon: '🏭',
    title: 'Despidos IA',
    desc: 'Una fábrica local quiere despedir a 500 humanos y sustituirlos por brazos robóticos más eficientes.',
    leftText: 'Prohibir despidos',
    rightText: 'Permitir robots',
    leftEff: { hap: 20, eff: -20, eth: 5 },
    rightEff: { hap: -20, eff: 25, eth: -5 }
  },
  {
    icon: '🎨',
    title: 'Arte Generativo',
    desc: 'Un museo quiere sustituir a los artistas humanos por pantallas que generan cuadros por IA al gusto de cada visitante.',
    leftText: 'Arte humano',
    rightText: 'Arte de IA',
    leftEff: { hap: 10, eff: -10, eth: 10 },
    rightEff: { hap: -5, eff: 15, eth: -10 }
  },
  {
    icon: '📦',
    title: 'Drones de Reparto',
    desc: 'Permitir que miles de drones vuelen a baja altura para entregar paquetes en 10 minutos, aumentando el ruido urbano.',
    leftText: 'Priorizar calma',
    rightText: 'Permitir entregas',
    leftEff: { hap: 10, eff: -15, eth: 5 },
    rightEff: { hap: -10, eff: 20, eth: -5 }
  },
  {
    icon: '🐕',
    title: 'Mascotas Robóticas',
    desc: 'Sustituir mascotas reales por perros robot en residencias de ancianos para reducir costes de veterinario y cuidados.',
    leftText: 'Animales reales',
    rightText: 'Perros robot',
    leftEff: { hap: 15, eff: -10, eth: 5 },
    rightEff: { hap: -10, eff: 15, eth: -10 }
  },
  {
    icon: '🎙️',
    title: 'Altavoces Domésticos',
    desc: 'Hacer obligatorio un asistente de voz en cada hogar que grabe conversaciones para detectar emergencias médicas a tiempo.',
    leftText: 'Privacidad',
    rightText: 'Vigilancia médica',
    leftEff: { hap: 10, eff: -5, eth: 15 },
    rightEff: { hap: -15, eff: 15, eth: -20 }
  },
  {
    icon: '✍️',
    title: 'Deberes con IA',
    desc: 'Los estudiantes usan generadores de texto para hacer todos sus ensayos. ¿Prohibir el uso de IA en los colegios?',
    leftText: 'Permitir IA',
    rightText: 'Prohibir IA',
    leftEff: { hap: 15, eff: 10, eth: -15 },
    rightEff: { hap: -10, eff: -5, eth: 15 }
  },
  {
    icon: '🚦',
    title: 'Semáforos Inteligentes',
    desc: 'Cámaras con IA dan prioridad a conductores con coches de alta gama porque pagan más impuestos municipales.',
    leftText: 'Igualdad',
    rightText: 'Premio fiscal',
    leftEff: { hap: 15, eff: -5, eth: 20 },
    rightEff: { hap: -25, eff: 15, eth: -25 }
  },
  {
    icon: '🗣️',
    title: 'Clonación de Voz',
    desc: 'Permitir que una app clone la voz de personas fallecidas para que sus familiares puedan seguir hablando con ellas.',
    leftText: 'Prohibir app',
    rightText: 'Permitir app',
    leftEff: { hap: -5, eff: 0, eth: 15 },
    rightEff: { hap: 10, eff: 10, eth: -15 }
  },
  {
    icon: '💡',
    title: 'Apagón Nocturno',
    desc: 'Una IA decide apagar el 70% de las farolas de noche para reducir la huella de carbono y gasto energético.',
    leftText: 'Mantener luces',
    rightText: 'Ahorro energía',
    leftEff: { hap: 15, eff: -20, eth: 5 },
    rightEff: { hap: -20, eff: 25, eth: -5 }
  },
  {
    icon: '🧹',
    title: 'Robots Limpiaplayas',
    desc: 'Desplegar robots nocturnos en las playas, aunque sus ruedas y luces molestan a las aves y fauna marina.',
    leftText: 'Cuidar fauna',
    rightText: 'Playas limpias',
    leftEff: { hap: 5, eff: -15, eth: 15 },
    rightEff: { hap: 10, eff: 20, eth: -20 }
  },
  {
    icon: '🏫',
    title: 'Plazas Escolares IA',
    desc: 'Un algoritmo secreto asigna el colegio de cada niño según su potencial genético y cognitivo.',
    leftText: 'Elección libre',
    rightText: 'Algoritmo óptimo',
    leftEff: { hap: 20, eff: -10, eth: 20 },
    rightEff: { hap: -25, eff: 25, eth: -25 }
  },
  {
    icon: '⚖️',
    title: 'Juez Algorítmico',
    desc: 'Poner una IA a dictar sentencias y multas de tráfico al instante sin opción de recurso ante un juez humano.',
    leftText: 'Jueces humanos',
    rightText: 'Justicia rápida',
    leftEff: { hap: 10, eff: -15, eth: 15 },
    rightEff: { hap: -15, eff: 20, eth: -20 }
  }
];

// Shuffle array
function shuffle(array) {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
}

let deck = [];
let currentCardData = null;
let isIntroOpen = true;

// DOM Elements
const barHap = document.getElementById('bar-hap');
const barEff = document.getElementById('bar-eff');
const barEth = document.getElementById('bar-eth');
const cardEl = document.getElementById('current-card');
const cIcon = document.getElementById('card-icon');
const cTitle = document.getElementById('card-title');
const cDesc = document.getElementById('card-desc');
const bLeft = document.getElementById('btn-left');
const bRight = document.getElementById('btn-right');
const tLeft = document.getElementById('text-left');
const tRight = document.getElementById('text-right');
const daysCount = document.getElementById('days-count');
const endScreen = document.getElementById('end-screen');
const introScreen = document.getElementById('intro-screen');
const btnStartGame = document.getElementById('btn-start-game');
const btnHelp = document.getElementById('btn-help');

function initGame() {
  deck = [...CARDS];
  shuffle(deck);
  
  // Si jugamos más de las cartas disponibles, repetimos mazo
  if (MAX_DAYS > deck.length) {
    let extra = [...CARDS];
    shuffle(extra);
    deck = deck.concat(extra);
  }
  
  updateBars();
  drawCard();
  
  bLeft.addEventListener('click', () => handleChoice('left'));
  bRight.addEventListener('click', () => handleChoice('right'));

  if (btnStartGame && introScreen) {
    btnStartGame.addEventListener('click', () => {
      introScreen.style.display = 'none';
      isIntroOpen = false;
    });
  }

  if (btnHelp && introScreen) {
    btnHelp.addEventListener('click', () => {
      introScreen.style.display = 'flex';
      if (btnStartGame) btnStartGame.innerText = '▶ Continuar Mandato';
      isIntroOpen = true;
    });
  }

  window.addEventListener('keydown', (e) => {
    if (isIntroOpen) {
      if (e.key === 'Enter' || e.key === ' ' || e.key === 'Escape') {
        e.preventDefault();
        if (introScreen) introScreen.style.display = 'none';
        isIntroOpen = false;
      }
      return;
    }
    if (gameOver) return;

    if (e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A') {
      e.preventDefault();
      handleChoice('left');
    } else if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') {
      e.preventDefault();
      handleChoice('right');
    }
  });

  document.getElementById('btn-finish').addEventListener('click', () => {
    window.location.href = '../../../index.html';
  });
}

function drawCard() {
  if (currentDay >= MAX_DAYS) {
    endGame(true, "¡Mandato Cumplido!");
    return;
  }
  
  currentCardData = deck[currentDay];
  
  // Reset card classes
  cardEl.className = 'dilemma-card';
  void cardEl.offsetWidth; // trigger reflow
  
  cIcon.innerText = currentCardData.icon;
  cTitle.innerText = currentCardData.title;
  cDesc.innerText = currentCardData.desc;
  tLeft.innerText = currentCardData.leftText;
  tRight.innerText = currentCardData.rightText;
  
  daysCount.innerText = currentDay;
}

function updateBars() {
  const clamp = (val) => Math.max(0, Math.min(100, val));
  stats.hap = clamp(stats.hap);
  stats.eff = clamp(stats.eff);
  stats.eth = clamp(stats.eth);
  
  barHap.style.width = stats.hap + '%';
  barEff.style.width = stats.eff + '%';
  barEth.style.width = stats.eth + '%';
  
  // Red color if critical
  barHap.style.background = stats.hap < 20 ? '#f44336' : '#4caf50';
  barEff.style.background = stats.eff < 20 ? '#f44336' : '#2196f3';
  barEth.style.background = stats.eth < 20 ? '#f44336' : '#9c27b0';
}

function checkGameOver() {
  if (stats.hap <= 0) return { over: true, reason: "La población se rebeló por falta de Felicidad." };
  if (stats.eff <= 0) return { over: true, reason: "La ciudad colapsó por falta de Eficiencia." };
  if (stats.eth <= 0) return { over: true, reason: "Fuiste desactivado por violar la Ética Robótica." };
  
  if (stats.hap >= 100) return { over: true, reason: "Diste tanto a los humanos que se volvieron vagos y colapsaron." };
  if (stats.eff >= 100) return { over: true, reason: "La ciudad fue tan eficiente que eliminó a los humanos por ser 'ineficientes'." };
  if (stats.eth >= 100) return { over: true, reason: "Fuiste tan ético que la ciudad quedó paralizada sin poder tomar decisiones." };
  
  return { over: false };
}

function handleChoice(direction) {
  if (gameOver || isIntroOpen) return;
  
  // Animation
  cardEl.classList.add(`swipe-${direction}`);
  
  // Apply effects
  const effs = direction === 'left' ? currentCardData.leftEff : currentCardData.rightEff;
  stats.hap += effs.hap;
  stats.eff += effs.eff;
  stats.eth += effs.eth;
  
  updateBars();
  
  setTimeout(() => {
    const status = checkGameOver();
    if (status.over) {
      endGame(false, status.reason);
    } else {
      currentDay++;
      drawCard();
    }
  }, 300);
}

async function endGame(won, reason) {
  gameOver = true;
  endScreen.style.display = 'flex';
  
  document.getElementById('end-title').innerText = won ? "¡Mandato Cumplido!" : "¡Sistema Detenido!";
  document.getElementById('end-title').style.color = won ? "#4caf50" : "#e94560";
  document.getElementById('end-desc').innerText = reason;
  
  // Score: 5 pts per day survived
  const score = currentDay * 5;
  document.getElementById('final-score').innerText = `${currentDay} días (${score} pts)`;
  
  if (currentUserInfo && currentUserInfo.user) {
    try {
      const studentId = currentUserInfo.user.id || currentUserInfo.user.uid;
      await saveGameResult('asimov', studentId, classId || null, score, { completed: won });
    } catch (e) {
      console.error('Error guardando partida de Asimov:', e);
    }
  }
}

requireAuth({
  allowedRoles: ['student', 'teacher'],
  onAuthorized: async (user, profile) => {
    if (profile.role === 'student') {
      const allowed = await incrementDigitalWellbeing(user.id, 'game', 'asimov');
      if (!allowed) return;
    }
    currentUserInfo = { user, profile };
    initGame();
  }
});
