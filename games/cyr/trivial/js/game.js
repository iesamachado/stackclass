import { requireAuth, incrementDigitalWellbeing } from '../../../../js/common/auth.js';
import { getUrlParams } from '../../../../js/common/utils.js';
import { saveGameResult } from '../../../../js/common/db.js';

let currentUserInfo = null;
const urlParams = getUrlParams();
const classId = urlParams.classId;

const QUESTION_BANK = [
  { q: '¿Qué componente es el "cerebro" del ordenador?', a: 'CPU', wrong: ['RAM', 'Disco Duro', 'Placa Base'] },
  { q: '¿Qué significa IoT?', a: 'Internet of Things', wrong: ['Input Output Tech', 'Internal Object Type', 'Internet of Tools'] },
  { q: 'En Scratch, ¿qué bloque repite una acción sin fin?', a: 'Por siempre', wrong: ['Repetir 10', 'Si... entonces', 'Esperar'] },
  { q: '¿Qué sensor permite a la Micro:bit saber si la agitas?', a: 'Acelerómetro', wrong: ['Brújula', 'Sensor de luz', 'Pin táctil'] },
  { q: 'Un LED es un ejemplo de...', a: 'Actuador', wrong: ['Sensor', 'Procesador', 'Conector'] },
  { q: '¿Qué es el Phishing?', a: 'Suplantar identidad para robar datos', wrong: ['Un virus que borra archivos', 'Un tipo de hardware', 'Una red social'] },
  { q: '¿Para qué sirve la memoria RAM?', a: 'Guardar datos de programas en uso', wrong: ['Almacenar archivos para siempre', 'Procesar gráficos 3D', 'Refrigerar el sistema'] },
  { q: '¿Cuál es la contraseña más segura?', a: 'M1P@ssw0rd_Segur4!', wrong: ['12345678', 'password', 'qwertyuiop'] },
  { q: '¿Qué hace la etiqueta <p> en HTML?', a: 'Crear un párrafo', wrong: ['Poner un título', 'Insertar una imagen', 'Crear un botón'] },
  { q: '¿Qué son los metadatos de una foto?', a: 'Datos ocultos como fecha y GPS', wrong: ['Los píxeles de la imagen', 'El tamaño en Megabytes', 'El filtro de Instagram'] },
  { q: '¿Qué es un algoritmo?', a: 'Pasos ordenados para resolver un problema', wrong: ['Un lenguaje de programación', 'Un tipo de virus', 'Una pieza del PC'] },
  { q: '¿Qué bloque de Scratch toma una decisión?', a: 'Si... entonces', wrong: ['Mover 10 pasos', 'Tocar sonido', 'Esconder'] },
  { q: '¿Qué significan las siglas IA?', a: 'Inteligencia Artificial', wrong: ['Internet Automático', 'Información Avanzada', 'Input Activo'] },
  { q: '¿Qué licencia permite compartir tu obra gratis pero citándote?', a: 'Creative Commons', wrong: ['Copyright', 'Marca Registrada', 'Patente'] },
  { q: 'Un servidor DDoS ataca inundando la red con...', a: 'Tráfico falso masivo', wrong: ['Spam de emails', 'Ransomware', 'Archivos PDF'] }
];

let selectedQuestions = [];
let currentQIndex = 0;
let score = 0;

const TOTAL_Q = 10;

function shuffle(array) {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
}

function initGame() {
  const bank = [...QUESTION_BANK];
  shuffle(bank);
  selectedQuestions = bank.slice(0, TOTAL_Q);
  
  document.getElementById('btn-restart').addEventListener('click', () => {
    window.location.href = '../../../index.html';
  });
  
  loadQuestion();
}

function loadQuestion() {
  if (currentQIndex >= TOTAL_Q) {
    endGame();
    return;
  }
  
  document.getElementById('q-curr').innerText = currentQIndex + 1;
  document.getElementById('q-total').innerText = TOTAL_Q;
  document.getElementById('progress').style.width = `${(currentQIndex / TOTAL_Q) * 100}%`;
  
  const qData = selectedQuestions[currentQIndex];
  document.getElementById('question-text').innerText = qData.q;
  
  let answers = [
    { text: qData.a, correct: true },
    { text: qData.wrong[0], correct: false },
    { text: qData.wrong[1], correct: false },
    { text: qData.wrong[2], correct: false }
  ];
  shuffle(answers);
  
  for (let i=0; i<4; i++) {
    const btn = document.getElementById(`btn-${i}`);
    btn.innerText = answers[i].text;
    btn.disabled = false;
    // Reset colors
    btn.className = `ans-btn ${['ans-red','ans-blue','ans-yellow','ans-green'][i]}`;
    
    // clear old event listeners
    const newBtn = btn.cloneNode(true);
    btn.parentNode.replaceChild(newBtn, btn);
    
    newBtn.addEventListener('click', () => handleAnswer(newBtn, answers[i].correct));
  }
}

function handleAnswer(btn, isCorrect) {
  // Disable all
  for(let i=0; i<4; i++) {
    document.getElementById(`btn-${i}`).disabled = true;
  }
  
  if (isCorrect) {
    btn.classList.add('ans-correct');
    score++;
    document.getElementById('score').innerText = score * 100;
  } else {
    btn.classList.add('ans-incorrect');
    // Highlight correct
    // Find the correct button by text or just highlight the right one
    // Not strictly needed but nice
  }
  
  setTimeout(() => {
    currentQIndex++;
    loadQuestion();
  }, 1500);
}

async function endGame() {
  document.getElementById('progress').style.width = '100%';
  document.getElementById('game-over').style.display = 'flex';
  document.getElementById('go-correct').innerText = score;
  
  if (currentUserInfo && currentUserInfo.user) {
    try {
      const studentId = currentUserInfo.user.id || currentUserInfo.user.uid;
      await saveGameResult('trivial', studentId, classId || null, score * 100, { correct: score });
    } catch(e) {
      console.error('Error guardando partida de trivial:', e);
    }
  }
}

requireAuth({
  allowedRoles: ['student', 'teacher'],
  onAuthorized: async (user, profile) => {
    if (profile.role === 'student') {
      const allowed = await incrementDigitalWellbeing(user.id, 'game', 'trivial');
      if (!allowed) return;
    }
    currentUserInfo = { user, profile };
    initGame();
  }
});
