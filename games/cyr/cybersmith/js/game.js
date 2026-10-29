import { requireAuth, incrementDigitalWellbeing } from '../../../../js/common/auth.js';
import { getUrlParams } from '../../../../js/common/utils.js';
import { saveGameResult } from '../../../../js/common/db.js';

let currentUserInfo = null;
const urlParams = getUrlParams();
const classId = urlParams.classId;

// Game State
let isPlaying = false;
let score = 0;
let timeLeft = 300; // 5 minutos
let timerInterval = null;
let currentOrder = null;
let orderCount = 0;
let currentPrice = 0;

// Referencias DOM
const gameArea = document.getElementById('game-area');
const inventoryEl = document.getElementById('inventory');
const biosTerminal = document.getElementById('bios-content');
const monitorTerminal = document.getElementById('monitor-content');
const monitorLed = document.getElementById('monitor-led');
const priceDisplay = document.getElementById('price-display');
const btnBoot = document.getElementById('btn-boot');
const btnStart = document.getElementById('btn-start-arcade');
const timerDisplay = document.getElementById('timer-display');
const scoreDisplay = document.getElementById('score-display');
const ticketIdEl = document.getElementById('ticket-id');
const ticketTextEl = document.getElementById('ticket-text');
const dropzones = document.querySelectorAll('.dropzone');

// Catálogo de piezas
const CATALOG = [
  // CPUs
  { id: 'cpu_i3', type: 'cpu', name: 'Intel Core i3', img: 'cpu.svg', price: 110 },
  { id: 'cpu_i5', type: 'cpu', name: 'Intel Core i5', img: 'cpu.svg', price: 180 },
  { id: 'cpu_i7', type: 'cpu', name: 'Intel Core i7', img: 'cpu.svg', price: 350 },
  { id: 'cpu_r5', type: 'cpu', name: 'AMD Ryzen 5', img: 'cpu.svg', price: 160 },
  { id: 'cpu_r9', type: 'cpu', name: 'AMD Ryzen 9', img: 'cpu.svg', price: 450 },
  
  // RAM
  { id: 'ram_8', type: 'ram', name: 'RAM 8GB DDR4', img: 'ram.svg', price: 35 },
  { id: 'ram_16', type: 'ram', name: 'RAM 16GB DDR4', img: 'ram.svg', price: 70 },
  { id: 'ram_32', type: 'ram', name: 'RAM 32GB DDR4', img: 'ram.svg', price: 130 },
  { id: 'ram_16_d5', type: 'ram', name: 'RAM 16GB DDR5', img: 'ram.svg', price: 100 },
  
  // GPUs
  { id: 'gpu_gtx', type: 'gpu', name: 'GTX 1060', img: 'gpu.svg', price: 180 },
  { id: 'gpu_3060', type: 'gpu', name: 'RTX 3060', img: 'gpu.svg', price: 320 },
  { id: 'gpu_rtx', type: 'gpu', name: 'RTX 3080', img: 'gpu.svg', price: 650 },
  { id: 'gpu_4090', type: 'gpu', name: 'RTX 4090', img: 'gpu.svg', price: 1600 },
  
  // Storage
  { id: 'hdd_1tb', type: 'hdd', name: 'HDD 1TB', img: 'hdd.svg', price: 45 },
  { id: 'hdd_2tb', type: 'hdd', name: 'HDD 2TB', img: 'hdd.svg', price: 65 },
  { id: 'ssd_500', type: 'hdd', name: 'SSD SATA 500GB', img: 'hdd.svg', price: 50 },
  { id: 'ssd_1tb', type: 'hdd', name: 'SSD SATA 1TB', img: 'hdd.svg', price: 90 },
  { id: 'nvme_1tb', type: 'hdd', name: 'NVMe M.2 1TB', img: 'hdd.svg', price: 110 },
  
  // PSUs
  { id: 'psu_500', type: 'psu', name: 'Fuente 500W Bronze', img: 'psu.svg', price: 50 },
  { id: 'psu_650', type: 'psu', name: 'Fuente 650W Gold', img: 'psu.svg', price: 80 },
  { id: 'psu_800', type: 'psu', name: 'Fuente 850W Gold', img: 'psu.svg', price: 120 },
  { id: 'psu_1000', type: 'psu', name: 'Fuente 1000W Plat.', img: 'psu.svg', price: 200 },
  
  // Peripherals
  { id: 'kb_usb', type: 'keyboard', name: 'Teclado Oficina', img: 'keyboard.svg', price: 15 },
  { id: 'kb_mech', type: 'keyboard', name: 'Teclado Mecánico', img: 'keyboard.svg', price: 60 },
  { id: 'mouse_usb', type: 'mouse', name: 'Ratón Óptico', img: 'mouse.svg', price: 10 },
  { id: 'mouse_gaming', type: 'mouse', name: 'Ratón Gaming', img: 'mouse.svg', price: 50 },
  { id: 'mon_hdmi', type: 'monitor', name: 'Monitor 24"', img: 'monitor.svg', price: 130 },
  { id: 'mon_144hz', type: 'monitor', name: 'Monitor 27" 144Hz', img: 'monitor.svg', price: 250 }
];

// Tipos de pedidos Dinámicos (Generadores)
function pick(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

const ORDER_TEMPLATES = [
  {
    type: 'ofimatica',
    generator: () => {
      const cpu = pick(['cpu_i3', 'cpu_i5']);
      const ram = pick(['ram_8', 'ram_16']);
      const hdd = pick(['hdd_1tb', 'ssd_500']);
      const psu = 'psu_500';
      return {
        desc: `PC de oficina. Instala un ${CATALOG.find(c=>c.id===cpu).name}, un módulo de ${CATALOG.find(c=>c.id===ram).name}, y disco ${CATALOG.find(c=>c.id===hdd).name}. Ponle fuente básica de 500W y periféricos estándar. Sin gráfica.`,
        requirements: {
          cpu: [cpu], ram: [ram], hdd: [hdd], psu: [psu],
          keyboard: ['kb_usb'], mouse: ['mouse_usb'], monitor: ['mon_hdmi']
        },
        prohibited: ['gpu']
      };
    }
  },
  {
    type: 'gaming_mid',
    generator: () => {
      const cpu = pick(['cpu_i5', 'cpu_r5']);
      const gpu = pick(['gpu_gtx', 'gpu_3060']);
      const ram = pick(['ram_16', 'ram_16_d5']);
      const hdd = pick(['ssd_1tb', 'nvme_1tb']);
      const psu = 'psu_650';
      return {
        desc: `PC Gaming Medio. Requiero un ${CATALOG.find(c=>c.id===cpu).name}, un módulo de ${CATALOG.find(c=>c.id===ram).name}, almacenamiento de ${CATALOG.find(c=>c.id===hdd).name} y una ${CATALOG.find(c=>c.id===gpu).name}. Fuente de 650W y periféricos gaming (monitor 144Hz).`,
        requirements: {
          cpu: [cpu], ram: [ram], hdd: [hdd], gpu: [gpu], psu: [psu],
          keyboard: ['kb_mech'], mouse: ['mouse_gaming'], monitor: ['mon_144hz']
        }
      };
    }
  },
  {
    type: 'gaming_high',
    generator: () => {
      const cpu = pick(['cpu_i7', 'cpu_r9']);
      const gpu = pick(['gpu_rtx', 'gpu_4090']);
      const ram = pick(['ram_32', 'ram_16']);
      const ramCount = pick([1, 2]); 
      const ramArray = ramCount === 2 ? [ram, ram] : [ram];
      const hdd1 = pick(['nvme_1tb', 'ssd_1tb']);
      const hdd2 = pick(['hdd_1tb', 'hdd_2tb']);
      const psu = gpu === 'gpu_4090' ? 'psu_1000' : 'psu_800';
      return {
        desc: `Máquina Entusiasta. Necesito un ${CATALOG.find(c=>c.id===cpu).name}, ${ramCount} módulo(s) de ${CATALOG.find(c=>c.id===ram).name}, un disco principal ${CATALOG.find(c=>c.id===hdd1).name} y uno secundario ${CATALOG.find(c=>c.id===hdd2).name}. Gráfica: ${CATALOG.find(c=>c.id===gpu).name} con fuente ${CATALOG.find(c=>c.id===psu).name}. Periféricos gaming.`,
        requirements: {
          cpu: [cpu], ram: ramArray, hdd: [hdd1, hdd2], gpu: [gpu], psu: [psu],
          keyboard: ['kb_mech'], mouse: ['mouse_gaming'], monitor: ['mon_144hz']
        }
      };
    }
  },
  {
    type: 'server',
    generator: () => {
      const cpu = pick(['cpu_i5', 'cpu_i7']);
      const ram = pick(['ram_8', 'ram_16']);
      const hdd = pick(['hdd_1tb', 'hdd_2tb']);
      return {
        desc: `Servidor NAS. Procesador ${CATALOG.find(c=>c.id===cpu).name}, doble módulo de ${CATALOG.find(c=>c.id===ram).name}, y DOS discos ${CATALOG.find(c=>c.id===hdd).name} (para RAID). Fuente 500W y periféricos ofimáticos básicos. Sin gráfica.`,
        requirements: {
          cpu: [cpu], ram: [ram, ram], hdd: [hdd, hdd], psu: ['psu_500'],
          keyboard: ['kb_usb'], mouse: ['mouse_usb'], monitor: ['mon_hdmi']
        },
        prohibited: ['gpu']
      };
    }
  }
];

let lastOrderTemplate = null;

let isGameAllowed = false;

requireAuth({
  allowedRoles: ['student', 'teacher'],
  onAuthorized: async (user, profile) => {
    if (profile.role === 'student') {
      const allowed = await incrementDigitalWellbeing(user.id, 'game', 'cybersmith');
      if (!allowed) {
        if (btnStart) { btnStart.disabled = true; btnStart.style.opacity = '0.3'; }
        return;
      }
    }
    isGameAllowed = true;
    currentUserInfo = { user, profile };
  }
});

function printBios(msg, type = '') {
  const line = document.createElement('div');
  line.className = `status-line ${type}`;
  line.textContent = `> ${msg}`;
  biosTerminal.appendChild(line);
  biosTerminal.parentElement.scrollTop = biosTerminal.parentElement.scrollHeight;
}

function clearBios() {
  biosTerminal.innerHTML = '';
}

function printMonitor(msg, type = '') {
  const hasMonitor = document.querySelector('#drop-monitor.filled');
  if (!hasMonitor) return; // Si no hay monitor físico conectado, no mostramos nada
  
  const line = document.createElement('div');
  line.className = `status-line ${type}`;
  if (type === 'html') {
    line.innerHTML = msg;
  } else {
    line.textContent = msg;
  }
  monitorTerminal.appendChild(line);
  monitorTerminal.parentElement.scrollTop = monitorTerminal.parentElement.scrollHeight;
}

function clearMonitor() {
  monitorTerminal.innerHTML = '';
  updateMonitorState();
}

function updateMonitorState() {
  const hasMonitor = document.querySelector('#drop-monitor.filled');
  const monitorStatus = document.getElementById('monitor-status-text');
  
  if (!hasMonitor) {
    monitorLed.classList.remove('active');
    monitorLed.style.background = '#ef4444';
    if (monitorStatus) monitorStatus.textContent = 'STANDBY · NO SIGNAL';
    monitorTerminal.innerHTML = '<div class="status-line" style="color: #ef4444; font-weight: bold;">[ NO SIGNAL · SIN SEÑAL DE VÍDEO ]</div><div class="status-line" style="color: #94a3b8; font-size: 0.72rem;">Conecta un Monitor al puerto HDMI del panel I/O (a la izquierda).</div>';
  } else {
    monitorLed.classList.add('active');
    monitorLed.style.background = '#22c55e';
    if (monitorStatus) monitorStatus.textContent = 'HDMI-1 ACTIVO · 1080p';
    if (monitorTerminal.textContent.includes('NO SIGNAL')) {
      monitorTerminal.innerHTML = '<div class="status-line ok" style="color: #39ff14; font-weight: bold;">[ SEÑAL DETECTADA · HDMI-1 ACTIVO ]</div><div class="status-line" style="color: #cbd5e1; font-size: 0.72rem;">Monitor conectado correctamente. Pulsa "Arrancar Sistema ⚡" cuando completes el montaje.</div>';
    }
  }
}

function updateTotalPrice() {
  currentPrice = 0;
  document.querySelectorAll('.dropzone.filled').forEach(zone => {
    const id = zone.dataset.placedId;
    const item = CATALOG.find(c => c.id === id);
    if (item) currentPrice += item.price;
  });
  priceDisplay.textContent = currentPrice;
  updateMonitorState();
}

function getDropzoneDefaultHTML(zone) {
  const labels = {
    'drop-cpu': '<span class="slot-icon">🔲</span><span class="slot-name">SOCKET CPU</span>',
    'drop-ram1': '<span class="slot-icon">📼</span><span class="slot-name">DIMM 1</span>',
    'drop-ram2': '<span class="slot-icon">📼</span><span class="slot-name">DIMM 2</span>',
    'drop-gpu': '<span class="slot-icon">🎮</span><span class="slot-name">RANURA PCIe (GPU)</span>',
    'drop-hdd1': '<span class="slot-icon">💾</span><span class="slot-name">SATA 1</span>',
    'drop-hdd2': '<span class="slot-icon">💾</span><span class="slot-name">SATA 2</span>',
    'drop-psu': '<span class="slot-icon">⚡</span><span class="slot-name">FUENTE ATX</span>',
    'drop-keyboard': '<span class="slot-icon">⌨️</span><span class="slot-name">TECLADO</span>',
    'drop-mouse': '<span class="slot-icon">🖱️</span><span class="slot-name">RATÓN</span>',
    'drop-monitor': '<span class="slot-icon">🖥️</span><span class="slot-name">MONITOR</span>'
  };
  return labels[zone.id] || `<span class="slot-name">${zone.dataset.accept.toUpperCase()}</span>`;
}

function getDropzoneDefaultTitle(zone) {
  const titles = {
    'drop-cpu': 'Instalar Procesador (CPU)',
    'drop-ram1': 'Instalar Módulo RAM 1',
    'drop-ram2': 'Instalar Módulo RAM 2',
    'drop-gpu': 'Instalar Tarjeta Gráfica (PCIe)',
    'drop-hdd1': 'Instalar Disco Principal (SATA 1)',
    'drop-hdd2': 'Instalar Disco Secundario (SATA 2)',
    'drop-psu': 'Instalar Fuente de Alimentación (ATX)',
    'drop-keyboard': 'Conectar Teclado USB',
    'drop-mouse': 'Conectar Ratón USB',
    'drop-monitor': 'Conectar Monitor (HDMI/DP)'
  };
  return titles[zone.id] || `Instalar ${zone.dataset.accept}`;
}

function getComponentIcon(type) {
  const icons = {
    cpu: '🔲',
    ram: '📼',
    gpu: '🎮',
    hdd: '💾',
    psu: '⚡',
    keyboard: '⌨️',
    mouse: '🖱️',
    monitor: '🖥️'
  };
  return icons[type] || '📦';
}

// Tooltip flotante al pasar el ratón por encima
const tooltipHud = document.getElementById('component-tooltip-hud');

function showTooltipForZone(zone, e) {
  if (!zone.classList.contains('filled') || !zone.dataset.placedId) return;
  const item = CATALOG.find(c => c.id === zone.dataset.placedId);
  if (!item || !tooltipHud) return;

  tooltipHud.innerHTML = `
    <div class="tooltip-hud-header">
      <span class="tooltip-hud-icon">${getComponentIcon(item.type)}</span>
      <span class="tooltip-hud-name">${item.name}</span>
    </div>
    <div class="tooltip-hud-body">
      <span class="tooltip-hud-price">${item.price} €</span>
      <span class="tooltip-hud-action">✕ Clic para extraer</span>
    </div>
  `;

  tooltipHud.classList.remove('hidden');
  positionTooltip(e);
}

function positionTooltip(e) {
  if (!tooltipHud || tooltipHud.classList.contains('hidden') || !e) return;
  const offset = 14;
  let x = e.clientX + offset;
  let y = e.clientY + offset;

  const rect = tooltipHud.getBoundingClientRect();
  if (x + rect.width > window.innerWidth - 10) {
    x = e.clientX - rect.width - offset;
  }
  if (y + rect.height > window.innerHeight - 10) {
    y = e.clientY - rect.height - offset;
  }

  tooltipHud.style.left = `${Math.max(10, x)}px`;
  tooltipHud.style.top = `${Math.max(10, y)}px`;
}

function hideTooltip() {
  if (tooltipHud) tooltipHud.classList.add('hidden');
}

// Aplica el componente visual y semántico a la ranura
function applyInstalledComponent(zone, item) {
  zone.classList.add('filled');
  zone.dataset.placedId = item.id;
  zone.title = `${item.name} (${item.price} €) - Haz clic para extraer`;
  
  zone.innerHTML = `
    <div class="installed-component">
      <img src="assets/${item.img}" alt="${item.name}" class="installed-img">
      <div class="installed-model-badge" title="${item.name}">${item.name}</div>
    </div>
  `;
  updateTotalPrice();
  printBios(`Instalado: ${item.name}`, 'ok');
}

function clearInstalledComponent(zone) {
  zone.classList.remove('filled');
  delete zone.dataset.placedId;
  zone.innerHTML = getDropzoneDefaultHTML(zone);
  zone.title = getDropzoneDefaultTitle(zone);
}

// INSTALACIÓN DE COMPONENTE (Soporte Clic y Drag)
function installItem(item) {
  if (!isPlaying) return false;
  // Buscar primera ranura libre que acepte este tipo
  const availableZone = Array.from(dropzones).find(z => z.dataset.accept === item.type && !z.classList.contains('filled'));
  if (!availableZone) {
    printBios(`[AVISO] No hay ranuras libres para ${item.name}.`, 'error');
    return false;
  }
  
  applyInstalledComponent(availableZone, item);
  return true;
}

// INVENTARIO
function renderInventory() {
  inventoryEl.innerHTML = `<h3 style="font-size: 0.85rem; color: var(--text-secondary); text-transform: uppercase; letter-spacing: 1px; border-bottom: 1px solid var(--border-subtle); padding-bottom: 6px; margin: 0 0 6px 0;">📦 Componentes</h3>`;
  
  const categories = {
    cpu: 'Procesadores',
    ram: 'Memoria RAM',
    hdd: 'Almacenamiento',
    gpu: 'Tarj. Gráficas',
    psu: 'Fuentes Alimentación',
    monitor: 'Monitores',
    keyboard: 'Teclados',
    mouse: 'Ratones'
  };

  for (const [type, title] of Object.entries(categories)) {
    const items = CATALOG.filter(c => c.type === type);
    if (items.length === 0) continue;

    const details = document.createElement('details');
    details.open = true;
    details.style.marginBottom = '6px';
    
    details.innerHTML = `<summary style="cursor: pointer; font-weight: bold; margin-bottom: 6px; color: var(--accent); padding: 4px 8px; background: rgba(0,255,136,0.1); border-radius: 4px; border-left: 3px solid var(--accent); list-style: none; font-size: 0.8rem;">📂 ${title}</summary>`;
    
    const grid = document.createElement('div');
    grid.style.display = 'grid';
    grid.style.gridTemplateColumns = '1fr 1fr';
    grid.style.gap = '6px';
    grid.style.marginBottom = '8px';
    
    items.forEach(item => {
      const el = document.createElement('div');
      el.className = 'pieza';
      el.draggable = true;
      el.dataset.type = item.type;
      el.dataset.id = item.id;
      el.title = `Haz clic o arrastra para instalar ${item.name}`;
      el.innerHTML = `
        <img src="assets/${item.img}" alt="${item.name}">
        <div style="font-size: 0.75rem; margin-top: 3px; line-height: 1.15; font-weight: 500;">${item.name}</div>
        <div style="color: var(--success); font-weight: bold; font-size: 0.75rem; margin-top: 2px;">${item.price} €</div>
      `;
      
      // Doble soporte: Arrastrar y Clic
      el.addEventListener('dragstart', handleDragStart);
      el.addEventListener('dragend', handleDragEnd);
      el.addEventListener('click', () => {
        if (!isPlaying) return;
        installItem(item);
      });

      grid.appendChild(el);
    });
    
    details.appendChild(grid);
    inventoryEl.appendChild(details);
  }
}

let draggedData = null;
let draggedElement = null;

function handleDragStart(e) {
  if (!isPlaying) return;
  draggedElement = this;
  draggedData = {
    type: this.dataset.type,
    id: this.dataset.id
  };
  e.dataTransfer.setData('text/plain', this.dataset.type);
  this.style.opacity = '0.5';
}

function handleDragEnd(e) {
  this.style.opacity = '1';
  draggedData = null;
  draggedElement = null;
}

// DROPZONES
function initDropzones() {
  dropzones.forEach(zone => {
    // Inicializar etiquetas y títulos por defecto
    zone.innerHTML = getDropzoneDefaultHTML(zone);
    zone.title = getDropzoneDefaultTitle(zone);

    zone.addEventListener('dragover', (e) => {
      e.preventDefault();
      if (!zone.classList.contains('filled')) {
        zone.classList.add('drag-over');
      }
    });

    zone.addEventListener('dragleave', () => {
      zone.classList.remove('drag-over');
    });

    zone.addEventListener('drop', (e) => {
      e.preventDefault();
      zone.classList.remove('drag-over');
      if (!isPlaying || !draggedData) return;
      
      const typeDropped = e.dataTransfer.getData('text/plain');
      const acceptType = zone.dataset.accept;
      
      if (typeDropped === acceptType && !zone.classList.contains('filled')) {
        const item = CATALOG.find(c => c.id === draggedData.id);
        if (item) {
          applyInstalledComponent(zone, item);
        }
      } else {
        printBios(`[ERROR] Puerto incompatible.`, 'error');
      }
    });
    
    // Clic para extraer componente
    zone.addEventListener('click', () => {
      if (!isPlaying || !zone.classList.contains('filled')) return;
      clearInstalledComponent(zone);
      updateTotalPrice();
      printBios(`Componente extraído.`, '');
      hideTooltip();
    });

    // Eventos de ratón para mostrar el modelo en el Tooltip HUD
    zone.addEventListener('mouseenter', (e) => showTooltipForZone(zone, e));
    zone.addEventListener('mousemove', (e) => positionTooltip(e));
    zone.addEventListener('mouseleave', hideTooltip);
  });
}

function resetDropzones() {
  dropzones.forEach(zone => {
    clearInstalledComponent(zone);
  });
  updateTotalPrice();
  hideTooltip();
}

// Inicializar de una vez
initDropzones();

// GAME LOOP
btnStart.addEventListener('click', startGame);

function startGame() {
  if (!isGameAllowed) return;
  isPlaying = true;
  score = 0;
  timeLeft = 300;
  scoreDisplay.textContent = score;
  btnStart.style.display = 'none';
  gameArea.style.opacity = '1';
  gameArea.style.pointerEvents = 'auto';
  btnBoot.removeAttribute('disabled');
  
  renderInventory();
  startNextOrder();
  
  timerInterval = setInterval(() => {
    timeLeft--;
    const m = Math.floor(timeLeft / 60).toString().padStart(2, '0');
    const s = (timeLeft % 60).toString().padStart(2, '0');
    timerDisplay.textContent = `${m}:${s}`;
    
    if (timeLeft <= 0) {
      endGame();
    }
  }, 1000);
}

function startNextOrder() {
  orderCount++;
  ticketIdEl.textContent = orderCount.toString().padStart(3, '0');
  
  // Pick a random order template that is different from the last one
  let template;
  do {
    template = pick(ORDER_TEMPLATES);
  } while (template === lastOrderTemplate && ORDER_TEMPLATES.length > 1);
  lastOrderTemplate = template;
  
  currentOrder = template.generator();
  ticketTextEl.textContent = currentOrder.desc;
  
  // Reset motherboard
  resetDropzones();
  clearBios();
  clearMonitor();
  printBios('POST Listo. Esperando hardware...');
}

btnBoot.addEventListener('click', () => {
  if (!isPlaying) return;
  checkBuild();
});

function getPlacedItems() {
  const placed = {
    cpu: [], ram: [], gpu: [], hdd: [], psu: [], keyboard: [], mouse: [], monitor: []
  };
  
  document.querySelectorAll('.dropzone.filled').forEach(zone => {
    const type = zone.dataset.accept;
    const id = zone.dataset.placedId;
    if (placed[type]) placed[type].push(id);
  });
  return placed;
}

async function checkBuild() {
  btnBoot.setAttribute('disabled', 'true');
  const placed = getPlacedItems();
  let errors = [];

  // Check required
  for (const type in currentOrder.requirements) {
    const requiredList = currentOrder.requirements[type];
    const placedList = [...placed[type]];
    
    for (const reqId of requiredList) {
      const idx = placedList.indexOf(reqId);
      if (idx !== -1) {
        placedList.splice(idx, 1); // Found it
      } else {
        const itemName = CATALOG.find(c => c.id === reqId)?.name || reqId;
        errors.push(`Falta/Incorrecto: ${itemName}`);
      }
    }
  }

  // Check prohibited
  if (currentOrder.prohibited) {
    currentOrder.prohibited.forEach(type => {
      if (placed[type].length > 0) {
        errors.push(`No debe incluir: ${type.toUpperCase()}`);
      }
    });
  }

  // Comprobar básicos mínimos (independientemente del pedido, un PC necesita esto para encender)
  if (placed.cpu.length === 0) errors.push('Falta procesador.');
  if (placed.psu.length === 0) errors.push('Falta fuente alimentación.');
  if (placed.ram.length === 0) errors.push('Falta memoria RAM.');
  if (placed.monitor.length === 0) errors.push('No hay monitor.');

  if (errors.length > 0) {
    printBios('--- ERROR DE BOOT ---', 'error');
    errors.forEach(e => printBios(e, 'error'));
    btnBoot.removeAttribute('disabled');
    return;
  }

  // SUCCESS! Animación Linux
  printBios('POST completado con éxito. Pasando control al SO...', 'ok');
  await playLinuxBootAnim();
  
  score++;
  scoreDisplay.textContent = score;
  
  setTimeout(() => {
    startNextOrder();
    btnBoot.removeAttribute('disabled');
  }, 2000);
}

function playLinuxBootAnim() {
  return new Promise(resolve => {
    clearMonitor();
    
    const tux = `<pre style="color: #bbb; line-height: 1; font-size: 0.7rem; margin-bottom: 20px;">
       _
     _(_)_
    ( o o )
    /  V  \\
  /(       )\\
    ^^^^^^^
</pre>`;
    printMonitor(tux, 'html');
    
    const lines = [
      '[    0.000000] Linux version 6.5.0-generic (buildd@lcy02)',
      '[    0.043212] x86/cpu: CyberSmith Architecture detected',
      '[    0.512345] PCI: Using ACPI for IRQ routing',
      '[    1.892311] usb 1-1: new high-speed USB device using xhci_hcd',
      '[    2.123123] input: CyberSmith Keyboard as /devices/input0',
      '[    2.542312] systemd[1]: Started System Initialization.',
      '[  <span style="color:#39ff14;">OK</span>  ] Reached target Basic System.',
      '[  <span style="color:#39ff14;">OK</span>  ] Started D-Bus System Message Bus.',
      '[  <span style="color:#39ff14;">OK</span>  ] Reached target Graphical Interface.',
      ' ',
      '<span style="color:#00ffff; font-size: 1.2rem;">Welcome to CyberSmith OS!</span>',
      '<span style="color:#39ff14;">cybersmith@classhub:~$</span> <span class="blink">_</span>'
    ];
    
    let i = 0;
    const interval = setInterval(() => {
      if (i < lines.length) {
        printMonitor(lines[i], 'html');
        i++;
      } else {
        clearInterval(interval);
        resolve();
      }
    }, 150);
  });
}

async function endGame() {
  isPlaying = false;
  clearInterval(timerInterval);
  timerDisplay.textContent = '00:00';
  gameArea.style.pointerEvents = 'none';
  gameArea.style.opacity = '0.5';
  
  alert(`¡Tiempo terminado! Has ensamblado ${score} ordenadores.`);
  
  if (currentUserInfo && currentUserInfo.user) {
    try {
      const studentId = currentUserInfo.user.id || currentUserInfo.user.uid;
      await saveGameResult('cybersmith', studentId, classId || null, score, {
        completed: true
      });
    } catch (e) {
      console.error('Error guardando puntuación de CyberSmith:', e);
    }
  }
  
  window.location.href = '../../../index.html';
}
