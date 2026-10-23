import { requireAuth, currentUser, incrementDigitalWellbeing } from '../../../../js/common/auth.js';
import { getUrlParams } from '../../../../js/common/utils.js';
import { saveGameResult } from '../../../../js/common/db.js';

let currentUserInfo = null;
const urlParams = getUrlParams();
const classId = urlParams.classId;

const LEVELS = [
  // FASE 1: LINEAL (3 Bloques)
  { text: "Nivel 1: El cliente quiere un pitido al hacer click en Botón Acción.", slots: ['sensor', 'event', 'action'], req: { sensor: 'btn_action', event: 'click', action: 'sound' }, successMsg: "¡Bip! ¡Botón funcional!" },
  { text: "Nivel 2: Enciende la linterna automáticamente si el usuario agita el móvil.", slots: ['sensor', 'event', 'action'], req: { sensor: 'accelerometer', event: 'shake', action: 'flashlight' }, successMsg: "¡Lumos! Linterna encendida." },
  { text: "Nivel 3: Ahorra batería bajando el brillo cuando el sensor de luz detecte oscuridad.", slots: ['sensor', 'event', 'action'], req: { sensor: 'light_sensor', event: 'dark', action: 'brightness_down' }, successMsg: "Brillo bajado." },
  { text: "Nivel 4: Manda una notificación si el sensor de batería detecta un nivel crítico.", slots: ['sensor', 'event', 'action'], req: { sensor: 'battery', event: 'low_level', action: 'notify' }, successMsg: "Usuario avisado de batería baja." },
  { text: "Nivel 5: Desbloquea el teléfono cuando la cámara detecte un rostro.", slots: ['sensor', 'event', 'action'], req: { sensor: 'camera', event: 'face_detect', action: 'unlock' }, successMsg: "¡FaceID Correcto!" },
  { text: "Nivel 6: Realiza un pago cuando el lector NFC se acerque a un datáfono.", slots: ['sensor', 'event', 'action'], req: { sensor: 'nfc', event: 'scan', action: 'pay' }, successMsg: "Pago procesado con NFC." },
  { text: "Nivel 7: Llama a emergencias si el botón de SOS se mantiene pulsado.", slots: ['sensor', 'event', 'action'], req: { sensor: 'btn_action', event: 'long_press', action: 'call_911' }, successMsg: "Llamando al 112..." },

  // FASE 2: ACCIÓN DOBLE (4 Bloques)
  { text: "Nivel 8: Si la batería es crítica, baja el brillo Y también notifica al usuario.", slots: ['sensor', 'event', 'action_1', 'action_2'], req: { sensor: 'battery', event: 'low_level', action_1: 'brightness_down', action_2: 'notify' }, successMsg: "Doble acción ejecutada." },
  { text: "Nivel 9: Al llegar a casa (GPS), pon música Y quita el modo silencio.", slots: ['sensor', 'event', 'action_1', 'action_2'], req: { sensor: 'gps', event: 'arrive', action_1: 'music', action_2: 'sound' }, successMsg: "Ambiente relajante listo." },
  { text: "Nivel 10: Si el micrófono detecta un ruido muy fuerte, activa sonido de alarma Y linterna.", slots: ['sensor', 'event', 'action_1', 'action_2'], req: { sensor: 'mic', event: 'loud_noise', action_1: 'sound', action_2: 'flashlight' }, successMsg: "¡Alarma anti-intrusos disparada!" },
  { text: "Nivel 11: Si hay exceso de temperatura, avisa con notificación Y llama a emergencias.", slots: ['sensor', 'event', 'action_1', 'action_2'], req: { sensor: 'thermometer', event: 'high_temp', action_1: 'notify', action_2: 'call_911' }, successMsg: "Evitando un desastre por calentamiento." },

  // FASE 3: LÓGICA / CONDICIONALES (4 Bloques)
  { text: "Nivel 12: Pon el móvil en silencio al llegar a un sitio, pero SOLO SI es de mañana.", slots: ['sensor', 'event', 'logic', 'action'], req: { sensor: 'gps', event: 'arrive', logic: 'if_morning', action: 'silent_mode' }, successMsg: "Silencio escolar activado." },
  { text: "Nivel 13: Permite pagar con NFC al acercar el móvil, pero SOLO SI hay conexión Wi-Fi segura.", slots: ['sensor', 'event', 'logic', 'action'], req: { sensor: 'nfc', event: 'scan', logic: 'if_wifi', action: 'pay' }, successMsg: "Pago seguro online completado." },
  { text: "Nivel 14: Modo Conducción: No molestar al detectar movimiento brusco, SI vas conduciendo.", slots: ['sensor', 'event', 'logic', 'action'], req: { sensor: 'accelerometer', event: 'shake', logic: 'if_driving', action: 'dnd_mode' }, successMsg: "Conducción segura priorizada." },
  { text: "Nivel 15: Pon música a tope si haces click, SOLO SI es de noche (fiesta).", slots: ['sensor', 'event', 'logic', 'action'], req: { sensor: 'btn_action', event: 'click', logic: 'if_night', action: 'music' }, successMsg: "¡A bailar toda la noche!" },

  // FASE 4: AVANZADA (MULTISENSOR / COMPLEJA) (4-5 Bloques)
  { text: "Nivel 16: MODO CINE: Si detecta oscuridad Y ADEMÁS está boca abajo, activa No Molestar.", slots: ['sensor_1', 'logic', 'sensor_2', 'action'], req: { sensor_1: 'light_sensor', logic: 'and_facedown', sensor_2: 'gyroscope', action: 'dnd_mode' }, successMsg: "Modo Cine activado." },
  { text: "Nivel 17: MODO AHORRO MAX: Batería baja, SI no hay wifi, baja el brillo.", slots: ['sensor', 'event', 'logic', 'action'], req: { sensor: 'battery', event: 'low_level', logic: 'if_no_wifi', action: 'brightness_down' }, successMsg: "Energía reservada." },
  { text: "Nivel 18: ANTI-ROBO: Ruido fuerte, Y ADEMÁS el giroscopio se mueve, notifica y suena alarma.", slots: ['sensor_1', 'logic', 'sensor_2', 'action_1', 'action_2'], req: { sensor_1: 'mic', logic: 'and_moving', sensor_2: 'gyroscope', action_1: 'notify', action_2: 'sound' }, successMsg: "¡Alarma antirrobo!" },
  { text: "Nivel 19: Si intentas desbloquear (Rostro) Y vas conduciendo, bloquealo con Modo Silencio.", slots: ['sensor', 'event', 'logic', 'action'], req: { sensor: 'camera', event: 'face_detect', logic: 'if_driving', action: 'silent_mode' }, successMsg: "Prohibido usar móvil al volante." },
  { text: "Nivel 20: Pago en tienda rápida: Lector NFC, al escanear, Y si hay wifi, paga y notifica.", slots: ['sensor', 'event', 'logic', 'action_1', 'action_2'], req: { sensor: 'nfc', event: 'scan', logic: 'if_wifi', action_1: 'pay', action_2: 'notify' }, successMsg: "Operación de tienda perfecta." },

  // FASE 5: MASTER (Ritmo frenético)
  { text: "Nivel 21: Pitido rápido al agitar el móvil.", slots: ['sensor', 'event', 'action'], req: { sensor: 'accelerometer', event: 'shake', action: 'sound' }, successMsg: "Maracas digitales." },
  { text: "Nivel 22: Desbloqueo facial SOLO si es de mañana.", slots: ['sensor', 'event', 'logic', 'action'], req: { sensor: 'camera', event: 'face_detect', logic: 'if_morning', action: 'unlock' }, successMsg: "Buenos días." },
  { text: "Nivel 23: GPS llega a zona cálida, Exceso de Temp, notifica y baja brillo.", slots: ['sensor', 'event', 'action_1', 'action_2'], req: { sensor: 'thermometer', event: 'high_temp', action_1: 'notify', action_2: 'brightness_down' }, successMsg: "Evitando sobrecalentamiento." },
  { text: "Nivel 24: Linterna al mantener pulsado Botón Acción, SI es de noche.", slots: ['sensor', 'event', 'logic', 'action'], req: { sensor: 'btn_action', event: 'long_press', logic: 'if_night', action: 'flashlight' }, successMsg: "No tropezarás." },
  { text: "Nivel 25: Emergencia automática. Ruido fuerte Y ADEMÁS movimiento brusco, llama al 112.", slots: ['sensor_1', 'logic', 'sensor_2', 'action'], req: { sensor_1: 'mic', logic: 'and_moving', sensor_2: 'gyroscope', action: 'call_911' }, successMsg: "Emergencias avisadas." }
,
  // FASE 6: GENERACIÓN PROCEDURAL EXTREMA
  { text: "Pedido 26: Combo de acción doble solicitado.", slots: ['sensor', 'event', 'action_1', 'action_2'], req: { sensor: 'battery', event: 'low_level', action_1: 'brightness_down', action_2: 'dnd_mode' }, successMsg: "¡Combo completado!" },
  { text: "Pedido 27: Aplica un filtro condicional a este evento.", slots: ['sensor', 'event', 'logic', 'action'], req: { sensor: 'camera', event: 'face_detect', logic: 'if_wifi', action: 'music' }, successMsg: "¡Lógica perfecta!" },
  { text: "Pedido 28: Aplica un filtro condicional a este evento.", slots: ['sensor', 'event', 'logic', 'action'], req: { sensor: 'light_sensor', event: 'dark', logic: 'if_driving', action: 'silent_mode' }, successMsg: "¡Lógica perfecta!" },
  { text: "Pedido 29: Haz que funcione esta lógica rápida.", slots: ['sensor', 'event', 'action'], req: { sensor: 'accelerometer', event: 'shake', action: 'brightness_down' }, successMsg: "¡Siguiente!" },
  { text: "Pedido 30: Haz que funcione esta lógica rápida.", slots: ['sensor', 'event', 'action'], req: { sensor: 'thermometer', event: 'high_temp', action: 'sound' }, successMsg: "¡Siguiente!" },
  { text: "Pedido 31: Aplica un filtro condicional a este evento.", slots: ['sensor', 'event', 'logic', 'action'], req: { sensor: 'battery', event: 'low_level', logic: 'and_moving', action: 'flashlight' }, successMsg: "¡Lógica perfecta!" },
  { text: "Pedido 32: Aplica un filtro condicional a este evento.", slots: ['sensor', 'event', 'logic', 'action'], req: { sensor: 'thermometer', event: 'high_temp', logic: 'if_wifi', action: 'brightness_down' }, successMsg: "¡Lógica perfecta!" },
  { text: "Pedido 33: Aplica un filtro condicional a este evento.", slots: ['sensor', 'event', 'logic', 'action'], req: { sensor: 'btn_action', event: 'click', logic: 'if_wifi', action: 'silent_mode' }, successMsg: "¡Lógica perfecta!" },
  { text: "Pedido 34: Combo de acción doble solicitado.", slots: ['sensor', 'event', 'action_1', 'action_2'], req: { sensor: 'battery', event: 'low_level', action_1: 'brightness_down', action_2: 'silent_mode' }, successMsg: "¡Combo completado!" },
  { text: "Pedido 35: Aplica un filtro condicional a este evento.", slots: ['sensor', 'event', 'logic', 'action'], req: { sensor: 'gyroscope', event: 'shake', logic: 'if_no_wifi', action: 'notify' }, successMsg: "¡Lógica perfecta!" },
  { text: "Pedido 36: Aplica un filtro condicional a este evento.", slots: ['sensor', 'event', 'logic', 'action'], req: { sensor: 'battery', event: 'low_level', logic: 'if_night', action: 'unlock' }, successMsg: "¡Lógica perfecta!" },
  { text: "Pedido 37: Combo de acción doble solicitado.", slots: ['sensor', 'event', 'action_1', 'action_2'], req: { sensor: 'battery', event: 'low_level', action_1: 'sound', action_2: 'music' }, successMsg: "¡Combo completado!" },
  { text: "Pedido 38: Aplica un filtro condicional a este evento.", slots: ['sensor', 'event', 'logic', 'action'], req: { sensor: 'camera', event: 'face_detect', logic: 'if_morning', action: 'unlock' }, successMsg: "¡Lógica perfecta!" },
  { text: "Pedido 39: Aplica un filtro condicional a este evento.", slots: ['sensor', 'event', 'logic', 'action'], req: { sensor: 'thermometer', event: 'high_temp', logic: 'and_facedown', action: 'pay' }, successMsg: "¡Lógica perfecta!" },
  { text: "Pedido 40: Combo de acción doble solicitado.", slots: ['sensor', 'event', 'action_1', 'action_2'], req: { sensor: 'nfc', event: 'scan', action_1: 'pay', action_2: 'call_911' }, successMsg: "¡Combo completado!" },
  { text: "Pedido 41: Complejo multisesor. Combina dos inputs.", slots: ['sensor_1', 'logic', 'sensor_2', 'action'], req: { sensor_1: 'light_sensor', logic: 'and_facedown', sensor_2: 'nfc', action: 'music' }, successMsg: "¡Ingeniería avanzada!" },
  { text: "Pedido 42: Haz que funcione esta lógica rápida.", slots: ['sensor', 'event', 'action'], req: { sensor: 'light_sensor', event: 'dark', action: 'call_911' }, successMsg: "¡Siguiente!" },
  { text: "Pedido 43: Aplica un filtro condicional a este evento.", slots: ['sensor', 'event', 'logic', 'action'], req: { sensor: 'thermometer', event: 'high_temp', logic: 'if_no_wifi', action: 'notify' }, successMsg: "¡Lógica perfecta!" },
  { text: "Pedido 44: Complejo multisesor. Combina dos inputs.", slots: ['sensor_1', 'logic', 'sensor_2', 'action'], req: { sensor_1: 'nfc', logic: 'and_facedown', sensor_2: 'btn_action', action: 'sound' }, successMsg: "¡Ingeniería avanzada!" },
  { text: "Pedido 45: Aplica un filtro condicional a este evento.", slots: ['sensor', 'event', 'logic', 'action'], req: { sensor: 'mic', event: 'loud_noise', logic: 'if_driving', action: 'notify' }, successMsg: "¡Lógica perfecta!" },
  { text: "Pedido 46: Aplica un filtro condicional a este evento.", slots: ['sensor', 'event', 'logic', 'action'], req: { sensor: 'accelerometer', event: 'shake', logic: 'and_facedown', action: 'call_911' }, successMsg: "¡Lógica perfecta!" },
  { text: "Pedido 47: Combo de acción doble solicitado.", slots: ['sensor', 'event', 'action_1', 'action_2'], req: { sensor: 'mic', event: 'loud_noise', action_1: 'call_911', action_2: 'brightness_down' }, successMsg: "¡Combo completado!" },
  { text: "Pedido 48: Combo de acción doble solicitado.", slots: ['sensor', 'event', 'action_1', 'action_2'], req: { sensor: 'camera', event: 'face_detect', action_1: 'call_911', action_2: 'notify' }, successMsg: "¡Combo completado!" },
  { text: "Pedido 49: Combo de acción doble solicitado.", slots: ['sensor', 'event', 'action_1', 'action_2'], req: { sensor: 'camera', event: 'face_detect', action_1: 'pay', action_2: 'dnd_mode' }, successMsg: "¡Combo completado!" },
  { text: "Pedido 50: Complejo multisesor. Combina dos inputs.", slots: ['sensor_1', 'logic', 'sensor_2', 'action'], req: { sensor_1: 'nfc', logic: 'and_facedown', sensor_2: 'camera', action: 'notify' }, successMsg: "¡Ingeniería avanzada!" },
  { text: "Pedido 51: Aplica un filtro condicional a este evento.", slots: ['sensor', 'event', 'logic', 'action'], req: { sensor: 'btn_action', event: 'long_press', logic: 'and_facedown', action: 'notify' }, successMsg: "¡Lógica perfecta!" },
  { text: "Pedido 52: Combo de acción doble solicitado.", slots: ['sensor', 'event', 'action_1', 'action_2'], req: { sensor: 'light_sensor', event: 'dark', action_1: 'music', action_2: 'call_911' }, successMsg: "¡Combo completado!" },
  { text: "Pedido 53: Complejo multisesor. Combina dos inputs.", slots: ['sensor_1', 'logic', 'sensor_2', 'action'], req: { sensor_1: 'accelerometer', logic: 'and_facedown', sensor_2: 'light_sensor', action: 'pay' }, successMsg: "¡Ingeniería avanzada!" },
  { text: "Pedido 54: Haz que funcione esta lógica rápida.", slots: ['sensor', 'event', 'action'], req: { sensor: 'accelerometer', event: 'shake', action: 'music' }, successMsg: "¡Siguiente!" },
  { text: "Pedido 55: Combo de acción doble solicitado.", slots: ['sensor', 'event', 'action_1', 'action_2'], req: { sensor: 'nfc', event: 'scan', action_1: 'music', action_2: 'pay' }, successMsg: "¡Combo completado!" },
  { text: "Pedido 56: Haz que funcione esta lógica rápida.", slots: ['sensor', 'event', 'action'], req: { sensor: 'battery', event: 'low_level', action: 'pay' }, successMsg: "¡Siguiente!" },
  { text: "Pedido 57: Aplica un filtro condicional a este evento.", slots: ['sensor', 'event', 'logic', 'action'], req: { sensor: 'gyroscope', event: 'shake', logic: 'if_wifi', action: 'music' }, successMsg: "¡Lógica perfecta!" },
  { text: "Pedido 58: Aplica un filtro condicional a este evento.", slots: ['sensor', 'event', 'logic', 'action'], req: { sensor: 'mic', event: 'loud_noise', logic: 'and_moving', action: 'unlock' }, successMsg: "¡Lógica perfecta!" },
  { text: "Pedido 59: Haz que funcione esta lógica rápida.", slots: ['sensor', 'event', 'action'], req: { sensor: 'accelerometer', event: 'shake', action: 'dnd_mode' }, successMsg: "¡Siguiente!" },
  { text: "Pedido 60: Combo de acción doble solicitado.", slots: ['sensor', 'event', 'action_1', 'action_2'], req: { sensor: 'nfc', event: 'scan', action_1: 'dnd_mode', action_2: 'brightness_down' }, successMsg: "¡Combo completado!" }];

const BLOCKS = {
  sensors: [
    { id: 'btn_action', label: '🔘 Botón Acción', type: 'sensor' },
    { id: 'accelerometer', label: '🔄 Acelerómetro', type: 'sensor' },
    { id: 'light_sensor', label: '☀️ Sensor Luz', type: 'sensor' },
    { id: 'gps', label: '📍 GPS', type: 'sensor' },
    { id: 'battery', label: '🔋 Batería', type: 'sensor' },
    { id: 'gyroscope', label: '🧭 Giroscopio', type: 'sensor' },
    { id: 'mic', label: '🎙️ Micrófono', type: 'sensor' },
    { id: 'nfc', label: '💳 Lector NFC', type: 'sensor' },
    { id: 'camera', label: '📷 Cámara (FaceID)', type: 'sensor' },
    { id: 'thermometer', label: '🌡️ Termómetro', type: 'sensor' }
  ],
  events: [
    { id: 'click', label: '👆 Click', type: 'event' },
    { id: 'long_press', label: '⏱️ Mantener Puls.', type: 'event' },
    { id: 'shake', label: '📳 Al Agitar', type: 'event' },
    { id: 'dark', label: '🌙 Oscuridad', type: 'event' },
    { id: 'arrive', label: '🏫 Al llegar', type: 'event' },
    { id: 'low_level', label: '📉 Nivel Bajo', type: 'event' },
    { id: 'loud_noise', label: '🔊 Ruido Fuerte', type: 'event' },
    { id: 'scan', label: '📡 Al Acercar', type: 'event' },
    { id: 'face_detect', label: '😎 Cara Detectada', type: 'event' },
    { id: 'high_temp', label: '🔥 Exceso Calor', type: 'event' }
  ],
  logic: [
    { id: 'if_morning', label: '🌅 SI es de mañana', type: 'logic' },
    { id: 'if_night', label: '🌌 SI es de noche', type: 'logic' },
    { id: 'if_wifi', label: '📶 SI hay Wi-Fi', type: 'logic' },
    { id: 'if_no_wifi', label: '🚫 SI NO hay Wi-Fi', type: 'logic' },
    { id: 'if_driving', label: '🚗 SI va conduciendo', type: 'logic' },
    { id: 'and_facedown', label: '➕ Y está boca abajo', type: 'logic' },
    { id: 'and_moving', label: '➕ Y hay movimiento', type: 'logic' }
  ],
  actions: [
    { id: 'sound', label: '🔊 Sonido/Alarma', type: 'action' },
    { id: 'flashlight', label: '🔦 Linterna', type: 'action' },
    { id: 'brightness_down', label: '🔅 Bajar Brillo', type: 'action' },
    { id: 'silent_mode', label: '🔇 Modo Silencio', type: 'action' },
    { id: 'notify', label: '💬 Notificar', type: 'action' },
    { id: 'dnd_mode', label: '⛔ No Molestar', type: 'action' },
    { id: 'pay', label: '💶 Pagar', type: 'action' },
    { id: 'unlock', label: '🔓 Desbloquear', type: 'action' },
    { id: 'call_911', label: '🚑 Llamar 112', type: 'action' },
    { id: 'music', label: '🎵 Música', type: 'action' }
  ]
};

let currentLevel = 0;
let score = 0;
let timeLeft = 180; // 3 minutos iniciales (es un Time Attack, ganas tiempo al acertar)
let timerInterval = null;
let isPlaying = false;

// DOM
const ticketText = document.getElementById('ticket-text');
const levelDisplay = document.getElementById('level-display');
const scoreDisplay = document.getElementById('score-display');
const timerDisplay = document.getElementById('timer-display');
const btnCompile = document.getElementById('btn-compile');
const btnClear = document.getElementById('btn-clear');
const feedback = document.getElementById('app-feedback');
const mobileSim = document.getElementById('mobile-sim');
const flowContainer = document.getElementById('flow-container');

function initGame() {
  renderInventory();
  loadLevel(currentLevel);
  
  btnCompile.addEventListener('click', compileApp);
  btnClear.addEventListener('click', clearBoard);
  
  isPlaying = true;
  startTimer();
}

function startTimer() {
  updateTimerDisplay();
  timerInterval = setInterval(() => {
    if (!isPlaying) return;
    timeLeft--;
    updateTimerDisplay();
    
    if (timeLeft <= 0) {
      timeLeft = 0;
      updateTimerDisplay();
      handleTimeOut();
    }
  }, 1000);
}

function updateTimerDisplay() {
  const m = Math.floor(timeLeft / 60).toString().padStart(2, '0');
  const s = (timeLeft % 60).toString().padStart(2, '0');
  timerDisplay.innerText = `${m}:${s}`;
  
  if (timeLeft <= 30) {
    timerDisplay.style.color = 'red';
    timerDisplay.style.animation = 'shake 0.5s infinite';
  } else {
    timerDisplay.style.color = 'var(--accent)';
    timerDisplay.style.animation = 'none';
  }
}

function addTimeBonus(secs) {
  timeLeft += secs;
  updateTimerDisplay();
  const bonus = document.createElement('span');
  bonus.innerText = `+${secs}s`;
  bonus.style.cssText = 'position:absolute; color:green; font-weight:bold; animation: fadeUp 1s forwards; margin-left:10px;';
  timerDisplay.appendChild(bonus);
}

function subtractTimePenalty(secs) {
  timeLeft -= secs;
  if (timeLeft < 0) timeLeft = 0;
  updateTimerDisplay();
  const penalty = document.createElement('span');
  penalty.innerText = `-${secs}s`;
  penalty.style.cssText = 'position:absolute; color:red; font-weight:bold; animation: fadeUp 1s forwards; margin-left:10px;';
  timerDisplay.appendChild(penalty);
}

// Estilo inyectado para las animaciones flotantes de tiempo
const style = document.createElement('style');
style.innerHTML = `@keyframes fadeUp { 0% { opacity: 1; transform: translateY(0); } 100% { opacity: 0; transform: translateY(-20px); } }`;
document.head.appendChild(style);

function renderInventory() {
  const renderList = (list, containerId, cssClass) => {
    const container = document.getElementById(containerId);
    container.innerHTML = '';
    list.forEach(item => {
      const el = document.createElement('div');
      el.className = `block-item ${cssClass}`;
      el.draggable = true;
      el.dataset.id = item.id;
      el.dataset.type = item.type; // sensor, event, logic, action
      el.innerText = item.label;
      
      el.addEventListener('dragstart', (e) => {
        e.dataTransfer.setData('text/plain', JSON.stringify({ id: item.id, type: item.type, label: item.label, cssClass }));
        setTimeout(() => el.style.opacity = '0.5', 0);
      });
      el.addEventListener('dragend', () => el.style.opacity = '1');
      
      container.appendChild(el);
    });
  };

  renderList(BLOCKS.sensors, 'inventory-sensors', 'block-sensor');
  renderList(BLOCKS.events, 'inventory-events', 'block-event');
  renderList(BLOCKS.logic, 'inventory-logic', 'block-logic');
  renderList(BLOCKS.actions, 'inventory-actions', 'block-action');
}

function renderFlowContainer(slots) {
  flowContainer.innerHTML = '';
  slots.forEach((slotName, index) => {
    let acceptType = slotName; 
    if (slotName.startsWith('sensor')) acceptType = 'sensor';
    if (slotName.startsWith('action')) acceptType = 'action';

    const dropzone = document.createElement('div');
    dropzone.className = 'dropzone';
    dropzone.id = `drop-${slotName}`;
    dropzone.dataset.accept = acceptType;
    dropzone.dataset.label = slotName.split('_')[0].toUpperCase();

    flowContainer.appendChild(dropzone);

    if (index < slots.length - 1) {
      const arrow = document.createElement('div');
      arrow.className = 'arrow';
      arrow.innerText = (slots[index+1].startsWith('action') && slotName.startsWith('action')) ? '➕' : '➡️';
      flowContainer.appendChild(arrow);
    }
  });

  setupDragAndDrop();
}

function setupDragAndDrop() {
  const dropzones = document.querySelectorAll('.dropzone');
  
  dropzones.forEach(zone => {
    zone.addEventListener('dragover', (e) => {
      e.preventDefault();
      zone.classList.add('dragover');
    });
    
    zone.addEventListener('dragleave', () => {
      zone.classList.remove('dragover');
    });
    
    zone.addEventListener('drop', (e) => {
      e.preventDefault();
      zone.classList.remove('dragover');
      
      try {
        const data = JSON.parse(e.dataTransfer.getData('text/plain'));
        if (data.type === zone.dataset.accept) {
          zone.innerHTML = `<div class="block-item ${data.cssClass}" style="margin:0; width: 100%; height: 100%; display:flex; align-items:center; justify-content:center;" data-id="${data.id}">${data.label}</div>`;
        } else {
          showFeedback(`❌ Necesitas un bloque de tipo [${zone.dataset.accept.toUpperCase()}] aquí (-10 pts)`, "red");
          applyPenalty();
        }
      } catch (err) {}
    });
  });
}

function loadLevel(idx) {
  if (idx >= LEVELS.length) {
    endGame(true);
    return;
  }
  const lvl = LEVELS[idx];
  levelDisplay.innerText = `Pedido ${idx + 1}/${LEVELS.length}`;
  ticketText.innerText = lvl.text;
  
  renderFlowContainer(lvl.slots);
  showFeedback("Esperando compilación...", "#333");
}

function clearBoard() {
  document.querySelectorAll('.dropzone').forEach(z => z.innerHTML = '');
}

function showFeedback(msg, color) {
  feedback.innerText = msg;
  feedback.style.color = color;
  feedback.classList.add('visible');
  
  mobileSim.classList.remove('anim-shake');
  void mobileSim.offsetWidth;
  if (color === 'red') {
    mobileSim.classList.add('anim-shake');
  }
}

function applyPenalty() {
  score = Math.max(0, score - 25);
  scoreDisplay.innerText = score;
  subtractTimePenalty(10);
}

async function compileApp() {
  if (!isPlaying) return;
  const currentReq = LEVELS[currentLevel].req;
  const slots = LEVELS[currentLevel].slots;
  
  let success = true;
  
  for (let slot of slots) {
    const blockEl = document.querySelector(`#drop-${slot} > div`);
    if (!blockEl) {
      showFeedback(`❌ Falta un bloque en la ranura ${slot.toUpperCase()}`, "red");
      return;
    }
    if (blockEl.dataset.id !== currentReq[slot]) {
      success = false;
    }
  }
  
  if (success) {
    score += 100;
    scoreDisplay.innerText = score;
    let bonus = Math.max(3, 15 - Math.floor(currentLevel / 4));
    addTimeBonus(bonus); // Bono de tiempo cada vez menor
    showFeedback(`✅ ${LEVELS[currentLevel].successMsg}`, "green");
    
    btnCompile.disabled = true;
    setTimeout(() => {
      currentLevel++;
      loadLevel(currentLevel);
      btnCompile.disabled = false;
    }, 1500);
    
  } else {
    showFeedback("❌ Lógica incorrecta. Crash inminente. (-25 pts, -10 seg)", "red");
    applyPenalty();
  }
}

function handleTimeOut() {
  isPlaying = false;
  clearInterval(timerInterval);
  ticketText.innerHTML = `<strong>¡Tiempo Agotado!</strong> Has conseguido ${score} puntos.`;
  btnCompile.disabled = true;
  btnClear.disabled = true;
  flowContainer.innerHTML = '<h2>¡Fin del Turno! 🕰️</h2>';
  showFeedback("⏳ Se acabó el tiempo.", "red");
  
  saveAndRedirect();
}

async function endGame(won) {
  isPlaying = false;
  clearInterval(timerInterval);
  ticketText.innerHTML = `<strong>¡Eres un Máster Ingeniero!</strong> Has completado TODOS los encargos con ${score} puntos.`;
  btnCompile.disabled = true;
  btnClear.disabled = true;
  flowContainer.innerHTML = '<h2>¡Juego Superado! 🏆</h2>';
  
  saveAndRedirect();
}

async function saveAndRedirect() {
  if (currentUserInfo && currentUserInfo.user) {
    try {
      const studentId = currentUserInfo.user.id || currentUserInfo.user.uid;
      await saveGameResult('appflow', studentId, classId || null, score, { completed: true });
    } catch (e) {
      console.error('Error guardando puntuación de AppFlow:', e);
    }
  }
  setTimeout(() => {
    window.location.href = '../../../index.html';
  }, 1500);
}

requireAuth({
  allowedRoles: ['student', 'teacher'],
  onAuthorized: async (user, profile) => {
    if (profile.role === 'student') {
      const allowed = await incrementDigitalWellbeing(user.id, 'game', 'appflow');
      if (!allowed) return;
    }
    currentUserInfo = { user, profile };
    initGame();
  }
});
