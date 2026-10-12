import { requireGameAccess } from '../../../../../js/common/auth.js';
import { saveGameResult } from '../../../../../js/common/db.js';
import { renderHeader, showToast } from '../../../../../js/common/ui.js';

let currentUser = null;
let currentProfile = null;
let currentClassId = null;

const REGISTERS   = ["A", "B", "C", "D"];
const BINARY_OPS  = ["MOV", "AND", "OR", "XOR"];
const MAX_ENERGY  = 3;   
const MAX_BITS    = 8;   

const OP_COST = {
  INC: 2,
  DEC: 2,
  NOT: 1,
  ROL: 1,
  ROR: 1,
  MOV: 1,
  AND: 0.5,
  OR:  0.5,
  XOR: 0.5
};

const state = {
  regs:     { A: 0, B: 0, C: 0, D: 0 },
  targets:  [],
  moves:    0,
  energy:   MAX_ENERGY,
  op:       "INC",
  reg1:     "A",
  reg2:     "B",
  won:      false,
  gameOver: false,
  played:   0,
  wonCount: 0,
  score:    0,    
  highScore:0,    
  numBits:  4     
};

const $    = id => document.getElementById(id);
const mask = () => (1 << state.numBits) - 1;
const bin  = n  => (n & mask()).toString(2).padStart(state.numBits, "0");
const hex  = n  => "0x" + (n & mask()).toString(16).toUpperCase();
const rnd  = () => Math.floor(Math.random() * (1 << state.numBits));

requireGameAccess('moon', {
  onGranted: async (user, profile, classId) => {

    currentUser = user;
    currentProfile = profile;
    currentClassId = classId;
    renderHeader(user, profile);
    // Iniciar el juego solo cuando el acceso esté verificado
    init();
  }
});

const ops = {
  INC: (r, r1)     => { r[r1] = (r[r1] + 1) & mask(); },
  DEC: (r, r1)     => { r[r1] = (r[r1] - 1 + (1 << state.numBits)) & mask(); },
  NOT: (r, r1)     => { r[r1] = (~r[r1]) & mask(); },
  ROL: (r, r1)     => { r[r1] = ((r[r1] << 1) | (r[r1] >> (state.numBits - 1))) & mask(); },
  ROR: (r, r1)     => { r[r1] = ((r[r1] >> 1) | ((r[r1] & 1) << (state.numBits - 1))) & mask(); },
  MOV: (r, r1, r2) => { r[r2] = r[r1]; },
  AND: (r, r1, r2) => { r[r1] = (r[r1] & r[r2]) & mask(); },
  OR:  (r, r1, r2) => { r[r1] = (r[r1] | r[r2]) & mask(); },
  XOR: (r, r1, r2) => { r[r1] = (r[r1] ^ r[r2]) & mask(); }
};

function fmtCost(cost) {
  return cost === 0.5 ? "½⚡" : `-${cost}⚡`;
}

function startNewGame() {
  state.moves    = 0;
  state.won      = false;
  state.gameOver = false;
  state.energy   = MAX_ENERGY;
  state.score    = 0;

  state.regs = {
    A: 0,
    B: rnd(),
    C: rnd(),
    D: rnd()
  };

  state.targets = [];
  let firstTarget;
  do { firstTarget = rnd(); } while (firstTarget === 0);
  state.targets.push(firstTarget);

  state.played++;
  $("stat-played").textContent = state.played;

  REGISTERS.forEach(r => renderRegister(r, null));
  renderTargetsQueue();
  renderMoveCounter();
  renderBattery();
  updateOpButtonsAvailability();
  clearHistory();

  $("victory-overlay").classList.add("hidden");
  $("gameover-overlay").classList.add("hidden");
  $("reg-A").classList.remove("victory-pulse");
  $("target-A").classList.remove("hidden");
}

function executeOperation() {
  if (state.won || state.gameOver) return;

  const { op, reg1, reg2 } = state;
  const cost = OP_COST[op];

  if (state.energy < cost) {
    flashNoEnergy();
    return;
  }

  const prev = { ...state.regs };

  ops[op](state.regs, reg1, reg2);
  state.moves++;
  state.energy = Math.max(0, +(state.energy - cost).toFixed(1));

  REGISTERS.forEach(r => renderRegister(r, prev[r]));
  renderMoveCounter();
  renderBattery();
  addHistoryEntry(cost);
  updateOpButtonsAvailability();

  const matchedIdx = state.targets.indexOf(state.regs.A);
  if (matchedIdx !== -1) {
    state.targets.splice(matchedIdx, 1);
    state.wonCount++;
    state.score++;
    $("stat-won").textContent = state.wonCount;
    
    checkLevelUp();
    
    if (state.targets.length === 0) {
      let newTarget;
      do { newTarget = rnd(); } while (newTarget === 0 || state.targets.includes(newTarget));
      state.targets.unshift(newTarget);
    }
    
    renderTargetsQueue();
    
    $("reg-A").classList.add("victory-pulse");
    setTimeout(() => $("reg-A").classList.remove("victory-pulse"), 800);
  }

  if (state.energy <= 0 && state.targets.length >= 4) {
    triggerGameOver();
  }
}

function checkLevelUp() {
  const expectedBits = Math.min(MAX_BITS, 4 + Math.floor(state.score / 10));
  if (expectedBits > state.numBits) {
    state.numBits = expectedBits;
    showLevelUpNotification(expectedBits);
    REGISTERS.forEach(r => renderRegister(r, null));
  }
}

function showLevelUpNotification(bits) {
  const toast = document.createElement("div");
  toast.className = "level-up-toast";
  toast.innerHTML = `🚀 Nivel superado! Arquitectura ampliada a ${bits} BITS`;
  document.body.appendChild(toast);
  setTimeout(() => toast.classList.add("show"), 10);
  setTimeout(() => {
    toast.classList.remove("show");
    setTimeout(() => toast.remove(), 500);
  }, 3000);
}

function reloadEnergy() {
  if (state.won || state.gameOver) return;

  if (state.targets.length >= 4) {
    triggerGameOver();
    return;
  }

  let newTarget;
  do { newTarget = rnd(); } while (newTarget === 0);
  state.targets.unshift(newTarget);
  
  state.energy = MAX_ENERGY;
  
  renderTargetsQueue();
  renderBattery();
  updateOpButtonsAvailability();
}

function triggerVictory() {
  state.won = true;
  state.wonCount++;

  $("stat-won").textContent           = state.wonCount;
  $("victory-bits").textContent       = bin(state.regs.A);
  $("victory-move-count").textContent = state.moves;

  $("reg-A").classList.add("victory-pulse");
  $("victory-overlay").classList.remove("hidden");
}

function triggerGameOver() {
  state.gameOver = true;
  if (state.targets.length > 0) {
    $("gameover-bits").textContent = bin(state.targets[state.targets.length - 1]);
  } else {
    $("gameover-bits").textContent = "----";
  }
  
  $("gameover-score-val").textContent = state.score;
  const msg = $("gameover-score-msg");
  if (state.score === 0) {
    msg.textContent = "¡Ánimo! Seguro que en la próxima partida logras completar algún objetivo.";
  } else if (state.score <= 2) {
    msg.textContent = "¡Buen trabajo! Has resuelto algunos objetivos.";
  } else if (state.score <= 5) {
    msg.textContent = "¡Genial! Tienes buena lógica de programación 👏";
  } else {
    msg.textContent = "¡IMPRESIONANTE! Eres un Hacker de Nivel Dios 🚀🔥";
  }

  if (currentUser) {
    saveGameResult('moon', currentUser.uid, currentClassId, state.score, { level: state.numBits, highScore: state.score });
  }

  $("gameover-overlay").classList.remove("hidden");
}

function flashNoEnergy() {
  const display = $("battery-display");
  display.classList.add("empty");
  $("btn-execute").classList.add("shake");
  setTimeout(() => {
    display.classList.remove("empty");
    $("btn-execute").classList.remove("shake");
  }, 600);
}

function renderRegister(reg, prevValue) {
  const val = state.regs[reg];

  $(`hex-${reg}`).textContent = hex(val);
  $(`dec-${reg}`).textContent = val;

  const container = $(`bits-${reg}`);
  
  if (container.children.length !== state.numBits) {
    container.innerHTML = "";
    for (let i = state.numBits - 1; i >= 0; i--) {
      const cell = document.createElement("div");
      cell.className = "bit-cell";
      cell.dataset.pos = i;
      cell.innerHTML = `<span class="bit-power">${1 << i}</span><span class="bit-val">0</span><span class="bit-pos">b${i}</span>`;
      container.appendChild(cell);
    }
  }

  const bitCells = container.querySelectorAll(".bit-cell");
  bitCells.forEach((cell, idx) => {
    const bitIndex = state.numBits - 1 - idx;
    const bitVal   = (val >> bitIndex) & 1;
    const prevBit  = prevValue !== null ? (prevValue >> bitIndex) & 1 : bitVal;

    if (prevValue !== null && prevBit !== bitVal) {
      cell.classList.add("flip");
      cell.addEventListener("animationend", () => cell.classList.remove("flip"), { once: true });
    }

    cell.querySelector(".bit-val").textContent = bitVal;
    cell.classList.toggle("on", bitVal === 1);
  });
}

function renderTargetsQueue() {
  const container = $("targets-queue");
  container.innerHTML = "";
  for (let i = 0; i < 4; i++) {
    const slot = document.createElement("div");
    if (i < state.targets.length) {
      slot.className = "target-slot filled";
      if (i === 3) slot.classList.add("danger"); 
      slot.innerHTML = `<span class="obj-bits">${bin(state.targets[i])}</span>`;
    } else {
      slot.className = "target-slot empty";
    }
    container.appendChild(slot);
  }
}

function renderMoveCounter() {
  $("move-count").textContent = state.moves;
}

function renderBattery() {
  const e        = state.energy;
  const display  = $("battery-display");
  const pipsEl   = $("battery-pips");
  const valEl    = $("battery-val");

  valEl.textContent = e % 1 === 0 ? e : e.toFixed(1);

  pipsEl.innerHTML = "";
  for (let i = 0; i < MAX_ENERGY; i++) {
    const pip = document.createElement("div");
    if (i + 1 <= Math.floor(e)) {
      pip.className = "battery-pip";
    } else if (i < e) {
      pip.className = "battery-pip half";   
    } else {
      pip.className = "battery-pip empty-pip";
    }
    pipsEl.appendChild(pip);
  }

  display.classList.remove("warn", "empty");
  if (e <= 0) {
    display.classList.add("empty");
  } else if (e <= 1) {
    display.classList.add("warn");
  }
}

function updateOpButtonsAvailability() {
  const btns = $("op-selector").querySelectorAll(".op-btn");
  btns.forEach(btn => {
    const cost = parseFloat(btn.dataset.cost);
    btn.classList.toggle("no-energy", state.energy < cost);
  });
}

function renderPreview() {
  const { op, reg1, reg2 } = state;
  const isBinary = BINARY_OPS.includes(op);
  const cost     = OP_COST[op];
  const isMov    = op === 'MOV';
  const arrow    = isMov ? '→' : '←';
  const [left, right] = isMov ? [reg1, reg2] : [reg1, reg2];

  $("instr-preview").innerHTML = isBinary
    ? `<span class="preview-op">${op}</span>
       <span class="preview-r1">${left}</span>
       <span class="preview-arrow">${arrow}</span>
       <span class="preview-r2">${right}</span>
       <span class="preview-cost">(${fmtCost(cost)})</span>`
    : `<span class="preview-op">${op}</span>
       <span class="preview-r1">${reg1}</span>
       <span class="preview-cost">(${fmtCost(cost)})</span>`;

  const g = $("reg2-group");
  g.style.opacity       = isBinary ? "1"    : "0.3";
  g.style.pointerEvents = isBinary ? "auto" : "none";
}

function clearHistory() {
  $("history-list").innerHTML = '<li class="history-empty">— sin operaciones aún —</li>';
}

function addHistoryEntry(cost) {
  const list  = $("history-list");
  const empty = list.querySelector(".history-empty");
  if (empty) empty.remove();

  const { op, reg1, reg2 } = state;
  const isBinary = BINARY_OPS.includes(op);

  const li = document.createElement("li");
  li.className = "history-item";
  li.innerHTML = `<span class="h-num">${state.moves}.</span>
    <span class="h-op">${op}</span>
    <span class="h-r1">${reg1}</span>
    ${isBinary ? `<span class="h-arrow">←</span><span class="h-r2">${reg2}</span>` : ""}
    <span class="h-cost">${fmtCost(cost)}</span>`;
  list.prepend(li);
}

function initEvents() {

  $("op-selector").addEventListener("click", e => {
    const btn = e.target.closest(".op-btn");
    if (!btn) return;
    $("op-selector").querySelectorAll(".op-btn").forEach(b => b.classList.remove("active"));
    btn.classList.add("active");
    state.op = btn.dataset.op;
    renderPreview();
  });

  $("reg1-selector").addEventListener("click", e => {
    const btn = e.target.closest(".reg-btn");
    if (!btn) return;
    $("reg1-selector").querySelectorAll(".reg-btn").forEach(b => b.classList.remove("active"));
    btn.classList.add("active");
    state.reg1 = btn.dataset.reg;
    renderPreview();
  });

  $("reg2-selector").addEventListener("click", e => {
    const btn = e.target.closest(".reg-btn");
    if (!btn) return;
    $("reg2-selector").querySelectorAll(".reg-btn").forEach(b => b.classList.remove("active"));
    btn.classList.add("active");
    state.reg2 = btn.dataset.reg;
    renderPreview();
  });

  $("btn-execute").addEventListener("click", executeOperation);

  const btnReload = $("btn-reload");
  if (btnReload) {
    btnReload.addEventListener("click", reloadEnergy);
  }

  $("btn-new-game").addEventListener("click", startNewGame);

  const btnHelp = $("btn-help");
  const btnCloseHelp = $("btn-close-help");
  const helpOverlay = $("help-overlay");
  if (btnHelp && btnCloseHelp && helpOverlay) {
    btnHelp.addEventListener("click", () => helpOverlay.classList.remove("hidden"));
    btnCloseHelp.addEventListener("click", () => helpOverlay.classList.add("hidden"));
    helpOverlay.addEventListener("click", e => {
      if (e.target === helpOverlay) helpOverlay.classList.add("hidden");
    });
  }

  const btnRanking = $("btn-ranking");
  if (btnRanking) {
     btnRanking.remove();
  }

  $("btn-next-round").addEventListener("click", startNewGame);
  $("btn-retry").addEventListener("click", startNewGame);

  document.addEventListener("keydown", e => {
    if (e.key === "Enter") executeOperation();
  });
}

(function injectShakeCSS() {
  const style = document.createElement("style");
  style.textContent = `
    @keyframes shake-btn {
      0%,100% { transform: translateX(0); }
      20%     { transform: translateX(-6px); }
      40%     { transform: translateX(6px); }
      60%     { transform: translateX(-4px); }
      80%     { transform: translateX(4px); }
    }
    #btn-execute.shake { animation: shake-btn 0.4s ease; }
    .h-cost { color: rgba(255,181,71,0.6); font-size: 0.7rem; margin-left: 4px; }
  `;
  document.head.appendChild(style);
})();

function init() {
  initEvents();
  renderPreview();
  startNewGame();
}
// init() se llama desde requireGameAccess.onGranted — no se llama aquí directamente
