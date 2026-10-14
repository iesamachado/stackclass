import { requireAuth, incrementDigitalWellbeing } from '../../../../../js/common/auth.js';
import { getUrlParams } from '../../../../../js/common/utils.js';
import { saveGameResult } from '../../../../../js/common/db.js';

let currentUserInfo = null;
const urlParams = getUrlParams();
const classId = urlParams.classId;

// Estado del Juego
let score = 0;
let lives = 3;
let activeThreats = [];
let spawnInterval = null;
let gameLoopInterval = null;
let isGameOver = false;
let isIntroOpen = true;
let isGuideOpen = false;
let currentGuideTab = 'firewall';

let statsBlocked = {
  firewall: 0,
  antivirus: 0,
  spam: 0
};

// Catálogo Educativo de Amenazas Cibernéticas (Curriculo 1º ESO - Ciberseguridad)
const THREAT_CATALOG = {
  firewall: [
    {
      id: 'ddos',
      name: 'Ataque DDoS',
      tag: 'Saturación de Red',
      icon: '💥',
      desc: 'Miles de ordenadores zombi (botnets) envían tráfico masivo simultáneo para colapsar y tirar el servidor.',
      blockedMsg: '¡Cortafuegos activado! Filtró el aluvión de paquetes basura de la botnet antes de saturar la red.',
      hitMsg: '¡DDoS consumado! El servidor colapsó por exceso de peticiones no autorizadas (-1 Salud).',
      defenseExplanation: 'El Cortafuegos analiza el caudal de tráfico y bloquea peticiones masivas desde IPs sospechosas.'
    },
    {
      id: 'ssh_brute',
      name: 'Fuerza Bruta SSH',
      tag: 'Adivinación de Clave',
      icon: '🔑',
      desc: 'Un robot prueba automáticamente millones de contraseñas por segundo para adivinar las claves del servidor.',
      blockedMsg: '¡Cortafuegos activado! Cortó la conexión tras múltiples intentos fallidos de contraseña.',
      hitMsg: '¡Fuerza Bruta exitosa! Adivinaron la clave de acceso de un administrador (-1 Salud).',
      defenseExplanation: 'El Cortafuegos bloquea puertos y banea direcciones IP que fallan reiteradamente el acceso.'
    },
    {
      id: 'sql_inj',
      name: 'Inyección SQL',
      tag: 'Ataque a Base de Datos',
      icon: '💉',
      desc: 'Introduce comandos maliciosos a través de formularios web para engañar al servidor y robar la base de datos.',
      blockedMsg: '¡Cortafuegos WAF activado! Limpió caracteres maliciosos de la petición antes de llegar a la base de datos.',
      hitMsg: '¡Inyección SQL sufrida! Se han filtrado datos y contraseñas de la base de datos (-1 Salud).',
      defenseExplanation: 'Un Cortafuegos de aplicaciones web (WAF) detecta y frena sentencias SQL manipuladas.'
    },
    {
      id: 'port_scan',
      name: 'Escaneo de Puertos',
      tag: 'Rastreo de Fallos',
      icon: '📡',
      desc: 'Un ciberatacante envía señales a todos los puertos del servidor para averiguar cuáles están abiertos y sin proteger.',
      blockedMsg: '¡Cortafuegos activado! Ocultó los puertos abiertos haciendo creer al atacante que el servidor está apagado.',
      hitMsg: '¡Escaneo completado! Los atacantes descubrieron un puerto vulnerable desprotegido (-1 Salud).',
      defenseExplanation: 'El Cortafuegos cierra y enmascara los puertos que no necesitan comunicarse con el exterior.'
    }
  ],
  antivirus: [
    {
      id: 'ransomware',
      name: 'Ransomware',
      tag: 'Secuestro de Archivos',
      icon: '🔒',
      desc: 'Malware que cifra fotos, vídeos y documentos personales y exige un rescate en criptomonedas para desbloquearlos.',
      blockedMsg: '¡Antivirus al rescate! Detectó el intento de cifrado no autorizado y envió el archivo a cuarentena.',
      hitMsg: '¡Infección por Ransomware! Archivos del sistema cifrados e inaccesibles (-1 Salud).',
      defenseExplanation: 'El Antivirus analiza firmas y patrones de modificación masiva de archivos en tiempo real.'
    },
    {
      id: 'trojan',
      name: 'Caballo de Troya',
      tag: 'Disfraz Malicioso',
      icon: '🐴',
      desc: 'Se disfraza de videojuego o programa inofensivo, pero al ejecutarlo abre una puerta trasera para que entren hackers.',
      blockedMsg: '¡Antivirus al rescate! Analizó la conducta oculta del ejecutable y detuvo su instalación.',
      hitMsg: '¡Troyano ejecutado! Se abrió una puerta trasera en el sistema para espías (-1 Salud).',
      defenseExplanation: 'El Antivirus examina el código fuente y el comportamiento sospechoso antes de dejar que se ejecute.'
    },
    {
      id: 'spyware',
      name: 'Spyware / Keylogger',
      tag: 'Espía de Teclado',
      icon: '👁️',
      desc: 'Software espía invisible que registra cada tecla pulsada para robar contraseñas, fotos y conversaciones.',
      blockedMsg: '¡Antivirus al rescate! Detectó e interceptó el registro oculto de pulsaciones de teclado.',
      hitMsg: '¡Spyware activo! El malware está retransmitiendo contraseñas capturadas (-1 Salud).',
      defenseExplanation: 'El Antivirus impide que aplicaciones desconocidas lean eventos del teclado o capturen pantalla.'
    },
    {
      id: 'worm',
      name: 'Gusano de Red',
      tag: 'Autopropagación',
      icon: '🪱',
      desc: 'Malware capaz de duplicarse e infectar automáticamente a otros ordenadores de la red local sin que nadie haga clic.',
      blockedMsg: '¡Antivirus al rescate! Neutralizó la copia maliciosa en memoria antes de su propagación.',
      hitMsg: '¡Gusano extendido! El malware saltó e infectó otros equipos de la red escolar (-1 Salud).',
      defenseExplanation: 'El Antivirus monitoriza la memoria RAM y bloquea intentos de duplicación automática entre procesos.'
    }
  ],
  spam: [
    {
      id: 'phishing',
      name: 'Phishing Bancario',
      tag: 'Suplantación Web',
      icon: '🎣',
      desc: 'Correo que imita perfectamente a un banco pidiéndote con urgencia que verifiques tus claves en una web falsa.',
      blockedMsg: '¡Filtro Spam activado! Identificó la dirección del remitente falso y envió el correo a la papelera.',
      hitMsg: '¡Phishing consumado! Un usuario introdujo sus claves reales en la web fraudulenta (-1 Salud).',
      defenseExplanation: 'El filtro antispam analiza la reputación del remitente y comprueba enlaces fraudulentos conocidos.'
    },
    {
      id: 'lottery_scam',
      name: 'Estafa de Lotería',
      tag: 'Premio Falso',
      icon: '🎁',
      desc: 'Mensaje engañoso que promete millones de euros de premio si pagas una supuesta "tasa de gestión" previa.',
      blockedMsg: '¡Filtro Spam activado! Reconoció patrones típicos de estafa millonaria y bloqueó el mensaje.',
      hitMsg: '¡Estafa sufrida! Un usuario cayó en el engaño y compartió datos confidenciales (-1 Salud).',
      defenseExplanation: 'Filtra correos mediante palabras clave de ingeniería social y ofertas irreales.'
    },
    {
      id: 'fake_invoice',
      name: 'Factura Falsa',
      tag: 'Adjunto Peligroso',
      icon: '🧾',
      desc: 'Correo haciéndose pasar por Correos o la compañía de luz con un archivo .zip o .pdf que contiene malware oculto.',
      blockedMsg: '¡Filtro Spam activado! Descartó el correo al detectar una extensión ejecutable camuflada.',
      hitMsg: '¡Factura infectada abierta! Se descargó y ejecutó el adjunto malicioso en el equipo (-1 Salud).',
      defenseExplanation: 'Examina archivos adjuntos en el buzón y bloquea extensiones peligrosas (.exe, .bat, .vbs).'
    },
    {
      id: 'fake_social',
      name: 'Alerta Red Social Falsa',
      tag: 'Robo de Cuentas',
      icon: '📱',
      desc: 'Mensaje alarmante diciendo que cerrarán tu cuenta de Instagram o TikTok si no confirmas tus datos en 24 horas.',
      blockedMsg: '¡Filtro Spam activado! Identificó la falsa urgencia y el dominio no oficial de la red social.',
      hitMsg: '¡Cuenta comprometida! El usuario entregó sus credenciales al formulario falso (-1 Salud).',
      defenseExplanation: 'Compara el dominio del remitente con los dominios oficiales de las plataformas verificadas.'
    }
  ]
};

// Ciber-Consejos para la pantalla de Game Over
const CYBER_TIPS = [
  'Usa contraseñas largas y diferentes para cada servicio; si descubren una, las demás estarán a salvo.',
  'Activa siempre la verificación en dos pasos (2FA) en tus cuentas de redes sociales, correo y videojuegos.',
  'Desconfía de mensajes que te metan prisa asegurando que vas a perder tu cuenta o que has ganado un premio.',
  'Nunca descargues archivos adjuntos con extensiones .exe, .bat o .vbs de correos de remitentes desconocidos.',
  'Antes de escribir contraseñas en internet, revisa que la dirección web comience por https:// y esté bien escrita.',
  'Mantén tu ordenador, móvil y antivirus siempre actualizados con los últimos parches de seguridad.',
  'Nunca compartas contraseñas ni códigos temporales que recibas por SMS, ni siquiera con amigos.',
  'Haz copias de seguridad periódicas de tus fotos y trabajos importantes en la nube o en un pendrive.'
];

// Elementos del DOM
const area = document.getElementById('game-area');
const scoreEl = document.getElementById('score');
const livesEl = document.getElementById('lives');
const socTag = document.getElementById('soc-tag');
const socText = document.getElementById('soc-text');

const introModal = document.getElementById('intro-modal');
const guideModal = document.getElementById('guide-modal');
const gameOverModal = document.getElementById('game-over');

const btnStart = document.getElementById('btn-start');
const btnGuide = document.getElementById('btn-guide');
const btnCloseGuide = document.getElementById('btn-close-guide');
const btnOpenGuideIntro = document.getElementById('btn-open-guide-intro');
const btnPlayAgain = document.getElementById('btn-play-again');
const btnRestart = document.getElementById('btn-restart');

const threatListContainer = document.getElementById('threat-list-container');
const guideTabBtns = document.querySelectorAll('.guide-tab-btn');

function initGame() {
  // Listeners de botones de defensa
  document.querySelectorAll('.def-btn').forEach(btn => {
    btn.addEventListener('click', () => handleDefense(btn.getAttribute('data-def')));
  });

  // Modal Intro
  if (btnStart) {
    btnStart.addEventListener('click', () => {
      introModal.style.display = 'none';
      isIntroOpen = false;
      startGame();
    });
  }

  if (btnOpenGuideIntro) {
    btnOpenGuideIntro.addEventListener('click', () => {
      openGuide();
    });
  }

  // Ciber-Guía
  if (btnGuide) {
    btnGuide.addEventListener('click', () => {
      openGuide();
    });
  }

  if (btnCloseGuide) {
    btnCloseGuide.addEventListener('click', () => {
      closeGuide();
    });
  }

  // Pestañas de la Ciber-Guía
  guideTabBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      guideTabBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      currentGuideTab = btn.getAttribute('data-tab');
      renderGuideThreats(currentGuideTab);
    });
  });

  // Game Over
  if (btnPlayAgain) {
    btnPlayAgain.addEventListener('click', () => {
      gameOverModal.style.display = 'none';
      startGame();
    });
  }

  if (btnRestart) {
    btnRestart.addEventListener('click', () => {
      window.location.href = '../../../index.html';
    });
  }

  // Controles por teclado: 1/Q (Firewall), 2/W (Antivirus), 3/E (Spam), Espacio/Escape (Guía)
  window.addEventListener('keydown', (e) => {
    if (isIntroOpen) {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        introModal.style.display = 'none';
        isIntroOpen = false;
        startGame();
      }
      return;
    }

    if (isGuideOpen) {
      if (e.key === 'Escape' || e.key === ' ' || e.key === 'Enter') {
        e.preventDefault();
        closeGuide();
      }
      return;
    }

    if (isGameOver) {
      if (e.key === 'Enter') {
        e.preventDefault();
        gameOverModal.style.display = 'none';
        startGame();
      }
      return;
    }

    const key = e.key.toLowerCase();
    if (key === '1' || key === 'q') {
      e.preventDefault();
      handleDefense('firewall');
    } else if (key === '2' || key === 'w') {
      e.preventDefault();
      handleDefense('antivirus');
    } else if (key === '3' || key === 'e') {
      e.preventDefault();
      handleDefense('spam');
    } else if (key === 'escape') {
      e.preventDefault();
      openGuide();
    }
  });

  // Render inicial de la guía
  renderGuideThreats('firewall');
}

function startGame() {
  score = 0;
  lives = 3;
  statsBlocked = { firewall: 0, antivirus: 0, spam: 0 };
  isGameOver = false;
  isIntroOpen = false;
  isGuideOpen = false;

  // Limpiar amenazas existentes en pantalla
  activeThreats.forEach(t => {
    if (t.el && t.el.parentNode) t.el.parentNode.removeChild(t.el);
  });
  activeThreats = [];

  area.classList.remove('paused');
  updateUI();
  updateSoc('SOC LISTO', 'Centro de operaciones activo. Monitorizando amenazas de red...', 'default');

  clearInterval(spawnInterval);
  clearInterval(gameLoopInterval);

  spawnInterval = setInterval(spawnThreat, 2200);
  gameLoopInterval = setInterval(gameLoop, 50);
}

function spawnThreat() {
  if (isGameOver || isIntroOpen || isGuideOpen) return;

  const categories = ['firewall', 'antivirus', 'spam'];
  const category = categories[Math.floor(Math.random() * categories.length)];
  const threatsInCategory = THREAT_CATALOG[category];
  const threatData = threatsInCategory[Math.floor(Math.random() * threatsInCategory.length)];

  const el = document.createElement('div');
  el.className = `threat threat-${category}`;
  el.innerHTML = `
    <div class="threat-main">
      <span class="threat-icon">${threatData.icon}</span>
      <span class="threat-name">${threatData.name}</span>
    </div>
    <div class="threat-tag">${threatData.tag}</div>
  `;

  // Posición horizontal aleatoria equilibrada
  el.style.left = `${20 + Math.random() * 60}%`;

  // Velocidad de descenso progresiva según la puntuación
  const duration = Math.max(3.2, 6.5 - (score * 0.08));
  el.style.animationDuration = `${duration}s`;

  area.appendChild(el);

  activeThreats.push({
    el: el,
    type: category,
    threat: threatData,
    spawnTime: Date.now()
  });
}

function handleDefense(defType) {
  if (isGameOver || isIntroOpen || isGuideOpen || activeThreats.length === 0) return;

  // Encontrar la amenaza de este tipo más cercana al servidor (rect.bottom más grande)
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
    const intercepted = activeThreats[targetIdx];

    // Eliminar del área
    if (intercepted.el && intercepted.el.parentNode) {
      area.removeChild(intercepted.el);
    }
    activeThreats.splice(targetIdx, 1);

    score++;
    statsBlocked[defType]++;
    updateUI();

    // Mensaje educativo en consola SOC
    updateSoc('INTERCEPTADO', intercepted.threat.blockedMsg, 'success');
  } else {
    // Si pulsa una defensa que no tiene amenazas en pantalla
    const defNames = { firewall: 'Firewall (Red)', antivirus: 'Antivirus (Malware)', spam: 'Filtro Spam (Correo)' };
    updateSoc('SIN AMENAZA', `Ningún ataque de tipo ${defNames[defType]} en curso. ¡Observa los vectores!`, 'default');
  }
}

function gameLoop() {
  if (isGameOver || isIntroOpen || isGuideOpen) return;

  const serverBase = document.querySelector('.server-base');
  if (!serverBase) return;
  const serverRect = serverBase.getBoundingClientRect();

  for (let i = activeThreats.length - 1; i >= 0; i--) {
    const t = activeThreats[i];
    const rect = t.el.getBoundingClientRect();

    if (rect.bottom >= serverRect.top) {
      // Impacto en el servidor
      if (t.el && t.el.parentNode) {
        area.removeChild(t.el);
      }
      const breachThreat = t.threat;
      activeThreats.splice(i, 1);
      lives--;
      updateUI();

      // Efecto visual de daño
      area.style.backgroundColor = '#7f1d1d';
      setTimeout(() => {
        area.style.backgroundColor = '';
      }, 250);

      // Explicación pedagógica de la brecha de seguridad
      updateSoc('BRECHA', breachThreat.hitMsg, 'alert');

      if (lives <= 0) {
        endGame();
        return;
      }
    }
  }
}

function updateUI() {
  scoreEl.innerText = score;
  livesEl.innerText = '♥'.repeat(Math.max(0, lives));
}

function updateSoc(tag, message, variant = 'default') {
  if (!socTag || !socText) return;
  socTag.innerText = tag;
  socTag.className = 'soc-tag';
  if (variant === 'success') socTag.classList.add('soc-tag-success');
  if (variant === 'alert') socTag.classList.add('soc-tag-alert');

  socText.innerText = message;
}

function openGuide() {
  isGuideOpen = true;
  area.classList.add('paused');
  clearInterval(spawnInterval);
  clearInterval(gameLoopInterval);
  guideModal.style.display = 'flex';
  renderGuideThreats(currentGuideTab);
}

function closeGuide() {
  isGuideOpen = false;
  guideModal.style.display = 'none';

  // Si la partida está en curso, reanudar
  if (!isIntroOpen && !isGameOver) {
    area.classList.remove('paused');
    spawnInterval = setInterval(spawnThreat, 2200);
    gameLoopInterval = setInterval(gameLoop, 50);
  }
}

function renderGuideThreats(tab) {
  if (!threatListContainer) return;
  threatListContainer.innerHTML = '';

  const threats = THREAT_CATALOG[tab] || [];
  const tabColors = {
    firewall: '#f59e0b',
    antivirus: '#10b981',
    spam: '#818cf8'
  };
  const borderCol = tabColors[tab] || '#38bdf8';

  threats.forEach(t => {
    const card = document.createElement('div');
    card.className = 'threat-card';
    card.style.borderLeftColor = borderCol;
    card.innerHTML = `
      <div class="threat-card-header">
        <div class="threat-card-title">${t.icon} ${t.name}</div>
        <span class="threat-card-tag">${t.tag}</span>
      </div>
      <p class="threat-card-desc"><strong>¿Qué es?</strong> ${t.desc}</p>
      <div class="threat-card-defense">
        <strong>🛡️ ¿Por qué lo frena esta defensa?</strong> ${t.defenseExplanation}
      </div>
    `;
    threatListContainer.appendChild(card);
  });
}

async function endGame() {
  isGameOver = true;
  clearInterval(spawnInterval);
  clearInterval(gameLoopInterval);

  // Limpiar elementos restantes
  activeThreats.forEach(t => {
    if (t.el && t.el.parentNode) t.el.parentNode.removeChild(t.el);
  });
  activeThreats = [];

  // Reporte Forense en Game Over
  document.getElementById('go-score').innerText = score;
  const repF = document.getElementById('rep-firewall');
  const repA = document.getElementById('rep-antivirus');
  const repS = document.getElementById('rep-spam');
  if (repF) repF.innerText = statsBlocked.firewall;
  if (repA) repA.innerText = statsBlocked.antivirus;
  if (repS) repS.innerText = statsBlocked.spam;

  // Consejo aleatorio de ciberseguridad
  const randomTip = CYBER_TIPS[Math.floor(Math.random() * CYBER_TIPS.length)];
  const tipEl = document.getElementById('tip-text');
  if (tipEl) tipEl.innerText = randomTip;

  gameOverModal.style.display = 'flex';

  if (currentUserInfo && currentUserInfo.user) {
    try {
      const studentId = currentUserInfo.user.id || currentUserInfo.user.uid;
      await saveGameResult('netdefender', studentId, classId || null, score * 10, {
        survived: score,
        blocked: statsBlocked
      });
    } catch (e) {
      console.error('Error guardando partida de NetDefender:', e);
    }
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
