/**
 * GameEngine.js
 * ─────────────────────────────────────────────────────────────────
 * Motor del juego. Responsable de:
 *   - El bucle principal via requestAnimationFrame
 *   - Renderizado del canvas (arena, bots, efectos)
 *   - Orquestar la ejecución secuencial de comandos
 *   - Detectar condiciones de victoria/derrota
 * ─────────────────────────────────────────────────────────────────
 */

import { Bot, BOT_COLORS } from './Bot.js';

// ── Configuración de la arena ───────────────────────────────────
const ARENA_COLS    = 10;    // Columnas de la cuadrícula
const ARENA_ROWS    = 6;     // Filas de la cuadrícula
const CMD_DELAY_MS  = 600;   // Milisegundos entre comandos

// Scripts predefinidos de la CPU (IA enemiga) optimizados para energía
const CPU_SCRIPTS = [
  ['escanear', 'avanzar', 'escanear', 'disparar', 'esperar', 'girarDerecha', 'avanzar', 'escanear', 'disparar'],
  ['avanzar', 'girarDerecha', 'escanear', 'disparar', 'esperar', 'avanzar', 'escanear', 'disparar', 'esperar'],
  ['escanear', 'disparar', 'esperar', 'escanear', 'disparar', 'girarDerecha', 'esperar', 'escudo', 'escanear', 'disparar'],
];

// Costes de energía por comando
const ENERGY_COSTS = {
  'avanzar': 10,
  'retroceder': 10,
  'girarDerecha': 5,
  'girarIzquierda': 5,
  'escanear': 5,
  'disparar': 30,
  'escudo': 40,
  'esperar': 0
};
const PASSIVE_ENERGY_RECHARGE = 15;
const WAIT_ENERGY_BONUS = 25;

export class GameEngine {
  /**
   * @param {HTMLCanvasElement} canvas         - El elemento canvas
   * @param {Object}            options
   * @param {Function}          options.onMatchEnd    - Callback cuando termina la partida
   * @param {Function}          options.onLogEntry    - Callback para añadir entradas al log
   * @param {Function}          options.onHpUpdate    - Callback cuando cambian los HP
   * @param {Function}          options.onCommandStep - Callback cuando se ejecuta un comando
   */
  constructor(canvas, options = {}) {
    this.canvas  = canvas;
    this.ctx     = canvas.getContext('2d');
    this.options = options;

    // Estado interno
    this.running       = false;
    this.animationId   = null;
    this.playerBot     = null;
    this.enemyBot      = null;
    this.matchOver     = false;
    this.turnCount     = 0;
    this.startTime     = 0;

    // Cola de comandos pendientes
    this.commandQueue  = [];
    this.cmdTimerRef   = null;
    this.isExecuting   = false;

    // Partículas de arena
    this.particles     = [];

    // Líneas de cuadrícula pre-calculadas
    this._gridLines    = null;

    // Dimensiones lógicas del canvas (independientes del CSS)
    this.W = 800;
    this.H = 450;

    this._initCanvas();
    this._drawIdleScreen();
  }

  // ════════════════════════════════════════════════════════════════
  // INICIALIZACIÓN
  // ════════════════════════════════════════════════════════════════

  /**
   * Configura las dimensiones del canvas para ser nítido
   * en pantallas de alta densidad (Retina, HiDPI).
   * @private
   */
  _initCanvas() {
    const dpr = window.devicePixelRatio || 1;
    this.canvas.width  = this.W * dpr;
    this.canvas.height = this.H * dpr;
    this.ctx.scale(dpr, dpr);

    // Alias para facilitar referencia
    this.ctx.imageSmoothingEnabled = true;
    this.ctx.imageSmoothingQuality = 'high';

    // Recalcular al cambiar el tamaño de ventana
    window.addEventListener('resize', () => this._handleResize());
    this._handleResize();
  }

  /** Adapta el canvas al contenedor CSS. @private */
  _handleResize() {
    // El tamaño CSS se gestiona por el contenedor; el canvas interno
    // mantiene sus dimensiones lógicas (W x H).
    // No hace falta redibujar aquí porque el bucle ya lo hace.
  }

  // ════════════════════════════════════════════════════════════════
  // API PÚBLICA: Iniciar partida
  // ════════════════════════════════════════════════════════════════

  /**
   * Arranca una nueva partida.
   * @param {string[]} playerCommands - Array de nombres de comandos del jugador
   * @param {string}   playerColorKey - Color del bot del jugador
   * @param {string}   playerName     - Nombre del jugador
   * @param {string}   playerAvatarUrl - URL del SVG del avatar del jugador
   * @param {Object}   enemyData      - Datos del robot enemigo { name, color, avatar, script }
   */
  startMatch(playerCommands, playerColorKey = 'cyan', playerName = 'Tu Bot', playerAvatarUrl = null, enemyData = null) {
    this._reset();

    // Crear los bots
    this.playerBot = new Bot({
      x: this.W * 0.22,
      y: this.H / 2,
      angle: 0,
      type: 'player',
      colorKey: playerColorKey,
      name: playerName,
      arenaW: this.W,
      arenaH: this.H,
      avatarUrl: playerAvatarUrl,
    });

    let cpuAvatarUrl = null;
    if (enemyData && enemyData.avatar) {
      const a = enemyData.avatar;
      const params = new URLSearchParams({
        seed: a.seed || 'cpu',
        face: a.face || 'round01',
        eyes: a.eyes || 'robocop',
        mouth: a.mouth || 'grill01',
        top: a.top || 'antenna',
        sides: a.sides || 'cables01',
        texture: a.texture || 'circuits',
        backgroundColor: 'transparent'
      });
      if (a.baseColor) params.append('baseColor', a.baseColor);
      cpuAvatarUrl = `https://api.dicebear.com/7.x/bottts/svg?${params.toString()}`;
    } else {
      const cpuAvatars = ['Destructor', 'Terminator', 'X9', 'Obliterator', 'Goliath'];
      const cpuAvatar = cpuAvatars[Math.floor(Math.random() * cpuAvatars.length)];
      cpuAvatarUrl = `https://api.dicebear.com/7.x/bottts/svg?seed=${encodeURIComponent(cpuAvatar)}&backgroundColor=transparent`;
    }

    this.enemyBot = new Bot({
      x: this.W * 0.78,
      y: this.H / 2,
      angle: 180,
      type: 'enemy',
      colorKey: enemyData?.color || 'magenta',
      name: enemyData?.name || 'CPU-X9',
      arenaW: this.W,
      arenaH: this.H,
      avatarUrl: cpuAvatarUrl,
    });

    // Seleccionar script de la CPU
    let cpuScript = [];
    if (enemyData && enemyData.script) {
      const { commands } = GameEngine.parseScript(enemyData.script);
      if (commands.length > 0) cpuScript = commands;
    }
    if (cpuScript.length === 0) {
      cpuScript = CPU_SCRIPTS[Math.floor(Math.random() * CPU_SCRIPTS.length)];
    }

    // Construir la cola de comandos intercalando jugador y CPU
    this._buildCommandQueue(playerCommands, cpuScript);

    this.matchOver  = false;
    this.turnCount  = 0;
    this.startTime  = Date.now();
    this.running    = true;

    this._log('⚡ ¡La batalla ha comenzado!', 'system');
    this._log(`🤖 ${playerName} vs ${this.enemyBot.name}`, 'system');

    // Iniciar el bucle de renderizado
    this._loop();

    // Iniciar la ejecución de comandos con retardo
    this.cmdTimerRef = setTimeout(() => this._executeNextCommand(), CMD_DELAY_MS / 2);
  }

  /**
   * Detiene la partida y el bucle de animación.
   */
  stop() {
    this.running = false;
    if (this.animationId) {
      cancelAnimationFrame(this.animationId);
      this.animationId = null;
    }
    if (this.cmdTimerRef) {
      clearTimeout(this.cmdTimerRef);
      this.cmdTimerRef = null;
    }
  }

  // ════════════════════════════════════════════════════════════════
  // PARSEO Y COLA DE COMANDOS
  // ════════════════════════════════════════════════════════════════

  /**
   * Parsea el texto del script del jugador y devuelve un array
   * de nombres de comandos válidos. Maneja bucles repetir(N){}.
   * @param {string} scriptText - Texto del editor de código
   * @returns {{ commands: string[], errors: string[] }}
   */
  static parseScript(scriptText) {
    const VALID_COMMANDS = [
      'avanzar', 'retroceder', 'girarDerecha', 'girarIzquierda',
      'disparar', 'escanear', 'escudo', 'esperar',
    ];
    const commands = [];
    const errors   = [];

    const lines = scriptText.split('\n').map(l => l.trim()).filter(l => l && !l.startsWith('//'));

    let i = 0;
    while (i < lines.length) {
      const line = lines[i];

      // ── Detectar bucle: repetir(N){ ─────────────────────────
      const repeatMatch = line.match(/^repetir\((\d+)\)\{?$/);
      if (repeatMatch) {
        const times = parseInt(repeatMatch[1], 10);
        if (isNaN(times) || times < 1 || times > 20) {
          errors.push(`Línea ${i + 1}: repetir(N) – N debe ser 1-20.`);
          i++;
          continue;
        }
        // Recopilar comandos dentro del bloque hasta encontrar '}'
        const loopBody = [];
        i++;
        while (i < lines.length && lines[i].trim() !== '}') {
          const inner = lines[i].replace(/\(\)$/, '').trim();
          if (VALID_COMMANDS.includes(inner)) {
            loopBody.push(inner);
          } else if (lines[i].trim() !== '') {
            errors.push(`Línea ${i + 1}: '${lines[i]}' no es un comando válido dentro del bucle.`);
          }
          i++;
        }

        // Expandir el bucle N veces
        for (let r = 0; r < times; r++) {
          commands.push(...loopBody);
        }
        i++; // saltar el '}'
        continue;
      }

      // ── Comando normal ───────────────────────────────────────
      const cmdName = line.replace(/\(\)$/, '').trim();
      if (cmdName === '}') { i++; continue; } // cierre huérfano
      if (VALID_COMMANDS.includes(cmdName)) {
        commands.push(cmdName);
      } else {
        errors.push(`Línea ${i + 1}: '${line}' no es un comando válido.`);
      }
      i++;
    }

    return { commands, errors };
  }

  /**
   * Construye la cola de comandos intercalando turnos de jugador y CPU.
   * @param {string[]} playerCmds
   * @param {string[]} cpuCmds
   * @private
   */
  _buildCommandQueue(playerCmds, cpuCmds) {
    this.commandQueue = [];
    
    // Si algún bot no tiene comandos, evitar fallos
    if (!playerCmds || playerCmds.length === 0) playerCmds = ['esperar'];
    if (!cpuCmds || cpuCmds.length === 0) cpuCmds = ['esperar'];

    // Límite de turnos para evitar batallas infinitas (ej. 150 turnos por bot)
    const MAX_TURNS = 150; 
    
    for (let i = 0; i < MAX_TURNS; i++) {
      this.commandQueue.push({ owner: 'player', cmd: playerCmds[i % playerCmds.length] });
      this.commandQueue.push({ owner: 'cpu', cmd: cpuCmds[i % cpuCmds.length] });
    }
  }

  /**
   * Ejecuta el siguiente comando de la cola y programa el siguiente.
   * @private
   */
  _executeNextCommand() {
    if (this.matchOver || !this.running) return;

    if (this.commandQueue.length === 0) {
      // No quedan comandos: terminar por tiempo/empate
      this._endMatch('empate');
      return;
    }

    const { owner, cmd } = this.commandQueue.shift();
    const bot    = owner === 'player' ? this.playerBot : this.enemyBot;
    const enemy  = owner === 'player' ? this.enemyBot  : this.playerBot;
    const label  = owner === 'player' ? 'player' : 'enemy';

    this.turnCount++;

    // Notificar al UIManager para resaltar el comando
    if (typeof this.options.onCommandStep === 'function') {
      this.options.onCommandStep(owner, cmd, this.turnCount);
    }

    const cost = ENERGY_COSTS[cmd] || 0;

    // Verificar si hay suficiente energía
    if (bot.energy < cost) {
      this._log(`⚠️ ${bot.name} intentó ${cmd}() pero no tiene energía! (-${cost} requeridos)`, 'system');
      // Falla el comando, pero recarga la pasiva
      bot.energy = Math.min(bot.maxEnergy, bot.energy + PASSIVE_ENERGY_RECHARGE);
    } else {
      // Consumir energía
      bot.energy -= cost;

      // Ejecutar el comando en el bot correspondiente
      switch (cmd) {
        case 'avanzar':       bot.avanzar();         this._log(`${bot.name} ▶ avanzar()`, label); break;
        case 'retroceder':    bot.retroceder();      this._log(`${bot.name} ▶ retroceder()`, label); break;
        case 'girarDerecha':  bot.girarDerecha();    this._log(`${bot.name} ▶ girarDerecha()`, label); break;
        case 'girarIzquierda':bot.girarIzquierda();  this._log(`${bot.name} ▶ girarIzquierda()`, label); break;
        case 'escanear':      bot.escanear(enemy);   this._log(`${bot.name} ▶ escanear() 📡 ¡Enemigo localizado!`, label); break;
        case 'escudo':        bot.escudo();          this._log(`${bot.name} ▶ escudo() 🛡️ ¡Escudo activo!`, label); break;
        case 'esperar':
          bot.esperar();
          bot.energy = Math.min(bot.maxEnergy, bot.energy + WAIT_ENERGY_BONUS);
          this._log(`${bot.name} ▶ esperar() 🔋 Recargando energía...`, label);
          break;
        case 'disparar': {
          bot.disparar();
          this._log(`${bot.name} ▶ disparar() 🔫`, label);
          // Registrar partículas de destello
          this._spawnMuzzleFlash(bot.x, bot.y, bot.angle, bot.color);
          break;
        }
        default:
          this._log(`⚠️ Comando desconocido: ${cmd}`, 'system');
      }

      // Recarga pasiva al final del turno
      bot.energy = Math.min(bot.maxEnergy, bot.energy + PASSIVE_ENERGY_RECHARGE);
    }

    // Comprobar condición de victoria tras cada acción
    if (this._checkVictory()) return;

    // Programar el siguiente comando
    this.cmdTimerRef = setTimeout(() => this._executeNextCommand(), CMD_DELAY_MS);
  }

  // ════════════════════════════════════════════════════════════════
  // CONDICIÓN DE VICTORIA
  // ════════════════════════════════════════════════════════════════

  /**
   * Comprueba si alguno de los bots ha sido eliminado.
   * @returns {boolean} true si la partida terminó.
   * @private
   */
  _checkVictory() {
    if (!this.playerBot.alive && !this.enemyBot.alive) {
      this._endMatch('empate');
      return true;
    }
    if (!this.enemyBot.alive) {
      this._endMatch('victoria');
      return true;
    }
    if (!this.playerBot.alive) {
      this._endMatch('derrota');
      return true;
    }
    return false;
  }

  /**
   * Finaliza la partida y notifica al UIManager.
   * @param {'victoria'|'derrota'|'empate'} outcome
   * @private
   */
  _endMatch(outcome) {
    this.matchOver = true;
    this.running   = false;

    if (this.cmdTimerRef) {
      clearTimeout(this.cmdTimerRef);
      this.cmdTimerRef = null;
    }

    const icons = { victoria: '🏆', derrota: '💀', empate: '🤝' };
    this._log(`${icons[outcome]} ¡Partida terminada! Resultado: ${outcome.toUpperCase()}`, 'system');

    // Notificar al exterior (UIManager)
    if (typeof this.options.onMatchEnd === 'function') {
      this.options.onMatchEnd({
        outcome,
        playerHpLeft: this.playerBot.hp,
        enemyHpLeft:  this.enemyBot.hp,
        turnsPlayed:  this.turnCount,
        duration:     Math.round((Date.now() - this.startTime) / 1000),
      });
    }

    // Detener el bucle de animación después de 3 segundos
    // (para que se vea la animación de muerte)
    setTimeout(() => this.stop(), 3000);
  }

  // ════════════════════════════════════════════════════════════════
  // BUCLE PRINCIPAL DE JUEGO
  // ════════════════════════════════════════════════════════════════

  /**
   * Bucle principal del juego usando requestAnimationFrame.
   * Se llama recursivamente mientras running === true.
   * @private
   */
  _loop() {
    if (!this.running && !this.matchOver) return;

    // Actualizar lógica
    this._update();

    // Renderizar
    this._render();

    // Notificar HP y Energía al UIManager
    if (typeof this.options.onHpUpdate === 'function') {
      this.options.onHpUpdate(
        this.playerBot?.hp ?? 0,
        this.enemyBot?.hp  ?? 0,
        this.playerBot?.energy ?? 0,
        this.enemyBot?.energy  ?? 0
      );
    }

    if (this.running || this.matchOver) {
      this.animationId = requestAnimationFrame(() => this._loop());
    }
  }

  /**
   * Actualiza la lógica del juego (bots, partículas).
   * @private
   */
  _update() {
    if (this.playerBot) this.playerBot.update(this.enemyBot);
    if (this.enemyBot)  this.enemyBot.update(this.playerBot);
    this._updateParticles();
  }

  // ════════════════════════════════════════════════════════════════
  // RENDERIZADO
  // ════════════════════════════════════════════════════════════════

  /**
   * Renderiza un frame completo en el canvas.
   * @private
   */
  _render() {
    const ctx = this.ctx;
    const W = this.W, H = this.H;

    // ── Limpiar ────────────────────────────────────────────────
    ctx.clearRect(0, 0, W, H);

    // ── Fondo de la arena ──────────────────────────────────────
    this._drawBackground(ctx, W, H);

    // ── Cuadrícula de combate ──────────────────────────────────
    this._drawGrid(ctx, W, H);

    // ── Decoraciones de la arena ───────────────────────────────
    this._drawArenaDecorations(ctx, W, H);

    // ── Partículas ambientales ─────────────────────────────────
    this._drawParticles(ctx);

    // ── Bots ───────────────────────────────────────────────────
    if (this.enemyBot)  this.enemyBot.draw(ctx);
    if (this.playerBot) this.playerBot.draw(ctx);
  }

  /**
   * Dibuja la pantalla de espera (antes de iniciar partida).
   * @private
   */
  _drawIdleScreen() {
    const ctx = this.ctx;
    const W = this.W, H = this.H;

    ctx.clearRect(0, 0, W, H);
    this._drawBackground(ctx, W, H);
    this._drawGrid(ctx, W, H);
    this._drawArenaDecorations(ctx, W, H);
  }

  /**
   * Dibuja el fondo degradado de la arena.
   * @private
   */
  _drawBackground(ctx, W, H) {
    const grad = ctx.createRadialGradient(W / 2, H / 2, 20, W / 2, H / 2, W * 0.7);
    grad.addColorStop(0, '#0d0d25');
    grad.addColorStop(0.5, '#080818');
    grad.addColorStop(1, '#050510');

    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, W, H);
  }

  /**
   * Dibuja la cuadrícula táctica de la arena.
   * @private
   */
  _drawGrid(ctx, W, H) {
    const cellW = W / ARENA_COLS;
    const cellH = H / ARENA_ROWS;

    ctx.save();
    ctx.strokeStyle = 'rgba(0,245,255,0.06)';
    ctx.lineWidth   = 0.5;

    // Líneas verticales
    for (let c = 0; c <= ARENA_COLS; c++) {
      ctx.beginPath();
      ctx.moveTo(c * cellW, 0);
      ctx.lineTo(c * cellW, H);
      ctx.stroke();
    }

    // Líneas horizontales
    for (let r = 0; r <= ARENA_ROWS; r++) {
      ctx.beginPath();
      ctx.moveTo(0, r * cellH);
      ctx.lineTo(W, r * cellH);
      ctx.stroke();
    }

    // Intersecciones (puntos de la cuadrícula)
    ctx.fillStyle = 'rgba(0,245,255,0.12)';
    for (let c = 0; c <= ARENA_COLS; c++) {
      for (let r = 0; r <= ARENA_ROWS; r++) {
        ctx.beginPath();
        ctx.arc(c * cellW, r * cellH, 1.5, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    ctx.restore();
  }

  /**
   * Dibuja decoraciones visuales de la arena (bordes, esquinas, línea central).
   * @private
   */
  _drawArenaDecorations(ctx, W, H) {
    ctx.save();
    const theme = document.documentElement.getAttribute('data-theme') || 'neon';

    if (theme === 'neon' || theme === 'glass') {
      // Borde exterior brillante / suave
      ctx.strokeStyle = theme === 'neon' ? 'rgba(0,245,255,0.2)' : 'rgba(0, 122, 255, 0.2)';
      ctx.lineWidth   = 2;
      ctx.shadowBlur  = theme === 'neon' ? 12 : 0;
      ctx.shadowColor = theme === 'neon' ? 'rgba(0,245,255,0.4)' : 'transparent';
      ctx.strokeRect(2, 2, W - 4, H - 4);

      // Línea central (separación de equipos)
      ctx.strokeStyle = theme === 'neon' ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)';
      ctx.lineWidth   = 1;
      ctx.shadowBlur  = 0;
      ctx.setLineDash([8, 12]);
      ctx.beginPath();
      ctx.moveTo(W / 2, 0);
      ctx.lineTo(W / 2, H);
      ctx.stroke();
      ctx.setLineDash([]);

      // Triángulo de esquina (decoración esports)
      const cornerSize = 18;
      ctx.fillStyle  = theme === 'neon' ? 'rgba(0,245,255,0.15)' : 'rgba(0, 122, 255, 0.15)';
      ctx.shadowBlur = theme === 'neon' ? 8 : 0;
      ctx.shadowColor = theme === 'neon' ? 'rgba(0,245,255,0.3)' : 'transparent';

      const corners = [[0, 0], [W, 0], [0, H], [W, H]];
      corners.forEach(([cx, cy]) => {
        ctx.beginPath();
        if (cx === 0 && cy === 0) {
          ctx.moveTo(0, 0); ctx.lineTo(cornerSize, 0); ctx.lineTo(0, cornerSize);
        } else if (cx === W && cy === 0) {
          ctx.moveTo(W, 0); ctx.lineTo(W - cornerSize, 0); ctx.lineTo(W, cornerSize);
        } else if (cx === 0 && cy === H) {
          ctx.moveTo(0, H); ctx.lineTo(cornerSize, H); ctx.lineTo(0, H - cornerSize);
        } else {
          ctx.moveTo(W, H); ctx.lineTo(W - cornerSize, H); ctx.lineTo(W, H - cornerSize);
        }
        ctx.fill();
      });
    } else if (theme === 'sketchbook') {
      // Borde de cuaderno
      ctx.strokeStyle = '#0055ff';
      ctx.lineWidth   = 2;
      ctx.strokeRect(2, 2, W - 4, H - 4);
      // Línea central de rotulador
      ctx.strokeStyle = 'rgba(0,85,255,0.3)';
      ctx.beginPath(); ctx.moveTo(W / 2, 0); ctx.lineTo(W / 2, H); ctx.stroke();
    } else if (theme === 'arcade') {
      ctx.strokeStyle = '#00ffff';
      ctx.lineWidth   = 4;
      ctx.strokeRect(0, 0, W, H);
      ctx.setLineDash([10, 10]);
      ctx.beginPath(); ctx.moveTo(W / 2, 0); ctx.lineTo(W / 2, H); ctx.stroke();
      ctx.setLineDash([]);
    }
    ctx.restore();
  }

  // ════════════════════════════════════════════════════════════════
  // SISTEMA DE PARTÍCULAS AMBIENTALES
  // ════════════════════════════════════════════════════════════════

  /**
   * Genera partículas de destello al disparar.
   * @param {number} x       - Posición X del bot
   * @param {number} y       - Posición Y del bot
   * @param {number} angle   - Ángulo de disparo
   * @param {string} color   - Color del destello
   * @private
   */
  _spawnMuzzleFlash(x, y, angle, color) {
    const rad = (angle * Math.PI) / 180;
    const tipX = x + Math.cos(rad) * 38;
    const tipY = y + Math.sin(rad) * 38;

    for (let i = 0; i < 8; i++) {
      const spread = (Math.random() - 0.5) * 1.5;
      const speed  = 1 + Math.random() * 3;
      this.particles.push({
        x: tipX, y: tipY,
        vx: Math.cos(rad + spread) * speed,
        vy: Math.sin(rad + spread) * speed,
        life: 1,
        decay: 0.08 + Math.random() * 0.1,
        size: 1 + Math.random() * 3,
        color,
      });
    }
  }

  /** Actualiza todas las partículas. @private */
  _updateParticles() {
    for (const p of this.particles) {
      p.x    += p.vx;
      p.y    += p.vy;
      p.life -= p.decay;
    }
    this.particles = this.particles.filter(p => p.life > 0);
  }

  /** Dibuja todas las partículas. @private */
  _drawParticles(ctx) {
    for (const p of this.particles) {
      ctx.save();
      ctx.globalAlpha = p.life;
      ctx.shadowBlur  = 6;
      ctx.shadowColor = p.color;
      ctx.fillStyle   = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size * p.life, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  }

  // ════════════════════════════════════════════════════════════════
  // LOG Y UTILIDADES
  // ════════════════════════════════════════════════════════════════

  /**
   * Añade un mensaje al log de batalla.
   * @param {string} message
   * @param {'player'|'enemy'|'system'|'hit'} type
   * @private
   */
  _log(message, type = 'system') {
    if (typeof this.options.onLogEntry === 'function') {
      this.options.onLogEntry(message, type);
    }
  }

  /**
   * Reinicia el estado completo del motor.
   * @private
   */
  _reset() {
    this.stop();
    this.playerBot   = null;
    this.enemyBot    = null;
    this.matchOver   = false;
    this.running     = false;
    this.commandQueue = [];
    this.particles   = [];
    this.turnCount   = 0;
  }
}
