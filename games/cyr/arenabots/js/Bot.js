/**
 * Bot.js
 * ─────────────────────────────────────────────────────────────────
 * Clase que representa un Bot en la Arena.
 * Gestiona: posición, rotación, salud, escudo, proyectiles y
 * el historial de comandos ejecutados.
 * ─────────────────────────────────────────────────────────────────
 */

// ── CONSTANTES DEL BOT ─────────────────────────────────────────
const BOT_RADIUS       = 22;    // Radio del cuerpo (píxeles lógicos)
const MOVE_DISTANCE    = 48;    // Píxeles por comando avanzar/retroceder
const ROTATION_STEP    = 45;    // Grados por girar
const PROJECTILE_SPEED = 6;     // Velocidad del proyectil (px/frame)
const PROJECTILE_SIZE  = 5;     // Radio del proyectil
const SHOOT_DAMAGE     = 25;    // Daño por impacto de proyectil
const SHIELD_REDUCTION = 0.5;   // El escudo reduce el daño al 50%
const MAX_HP           = 100;   // Puntos de vida máximos
const MAX_ENERGY       = 100;   // Energía máxima

// Mapa de colores de neón disponibles para el bot del jugador
export const BOT_COLORS = {
  cyan:   { main: '#00f5ff', glow: 'rgba(0,245,255,0.6)',   dark: '#006070' },
  green:  { main: '#39ff14', glow: 'rgba(57,255,20,0.6)',   dark: '#0e5f00' },
  yellow: { main: '#ffe600', glow: 'rgba(255,230,0,0.6)',   dark: '#5f5000' },
  purple: { main: '#bf5fff', glow: 'rgba(191,95,255,0.6)',  dark: '#4a0070' },
};

// ─────────────────────────────────────────────────────────────────
// CLASE Projectile (Proyectil / Láser)
// ─────────────────────────────────────────────────────────────────
export class Projectile {
  /**
   * @param {number} x         - Posición X inicial
   * @param {number} y         - Posición Y inicial
   * @param {number} angle     - Ángulo de disparo (grados)
   * @param {string} owner     - 'player' | 'enemy'
   * @param {string} color     - Color del proyectil
   */
  constructor(x, y, angle, owner, color) {
    this.x      = x;
    this.y      = y;
    this.angle  = angle;        // en grados
    this.owner  = owner;
    this.color  = color;
    this.active = true;
    this.trail  = [];           // Para el efecto de estela
    this.damage = SHOOT_DAMAGE;

    // Calcular velocidad en componentes X e Y
    const rad  = (angle * Math.PI) / 180;
    this.vx    = Math.cos(rad) * PROJECTILE_SPEED;
    this.vy    = Math.sin(rad) * PROJECTILE_SPEED;
  }

  /**
   * Actualiza la posición del proyectil y su estela.
   */
  update() {
    // Guardar posición anterior para la estela
    this.trail.push({ x: this.x, y: this.y });
    if (this.trail.length > 8) this.trail.shift();

    this.x += this.vx;
    this.y += this.vy;
  }

  /**
   * Dibuja el proyectil en el canvas.
   * @param {CanvasRenderingContext2D} ctx
   */
  draw(ctx) {
    if (!this.active) return;

    // Dibujar estela
    for (let i = 0; i < this.trail.length; i++) {
      const t = this.trail[i];
      const alpha = (i / this.trail.length) * 0.4;
      const size  = PROJECTILE_SIZE * (i / this.trail.length) * 0.8;
      ctx.beginPath();
      ctx.arc(t.x, t.y, size, 0, Math.PI * 2);
      ctx.fillStyle = this.color.replace(')', `, ${alpha})`).replace('rgb', 'rgba');
      ctx.fill();
    }

    // Núcleo brillante
    ctx.save();
    ctx.shadowBlur  = 14;
    ctx.shadowColor = this.color;
    ctx.beginPath();
    ctx.arc(this.x, this.y, PROJECTILE_SIZE, 0, Math.PI * 2);
    ctx.fillStyle = '#ffffff';
    ctx.fill();
    ctx.beginPath();
    ctx.arc(this.x, this.y, PROJECTILE_SIZE * 0.6, 0, Math.PI * 2);
    ctx.fillStyle = this.color;
    ctx.fill();
    ctx.restore();
  }
}

// ─────────────────────────────────────────────────────────────────
// CLASE Bot
// ─────────────────────────────────────────────────────────────────
export class Bot {
  /**
   * @param {Object} config
   * @param {number} config.x           - Posición X inicial
   * @param {number} config.y           - Posición Y inicial
   * @param {number} config.angle       - Ángulo inicial (grados, 0 = derecha)
   * @param {string} config.type        - 'player' | 'enemy'
   * @param {string} config.colorKey    - Clave de color (ej: 'cyan')
   * @param {string} config.name        - Nombre del bot
   * @param {number} config.arenaW      - Ancho de la arena
   * @param {number} config.arenaH      - Alto de la arena
   */
  constructor(config) {
    // ── Identificación ──────────────────────────────────────────
    this.type      = config.type;
    this.name      = config.name || (config.type === 'player' ? 'Tu Bot' : 'CPU Bot');
    this.colorKey  = config.colorKey || 'cyan';
    this.avatarUrl = config.avatarUrl || null;
    this.avatarImg  = null;

    if (this.avatarUrl) {
      this.avatarImg = new Image();
      this.avatarImg.src = this.avatarUrl;
    }

    // Colores según tipo y colorKey
    if (config.type === 'player') {
      const c = BOT_COLORS[this.colorKey] || BOT_COLORS.cyan;
      this.color     = c.main;
      this.glowColor = c.glow;
      this.darkColor = c.dark;
    } else {
      // Enemigo siempre en magenta
      this.color     = '#ff00aa';
      this.glowColor = 'rgba(255,0,170,0.6)';
      this.darkColor = '#550040';
    }

    // ── Física ──────────────────────────────────────────────────
    this.x          = config.x;
    this.y          = config.y;
    this.angle      = config.angle ?? 0;   // En grados
    this.arenaW     = config.arenaW;
    this.arenaH     = config.arenaH;

    // Posición objetivo para interpolación suave
    this.targetX    = this.x;
    this.targetY    = this.y;
    this.targetAngle = this.angle;
    this.lerping    = false;

    // ── Estado de combate ────────────────────────────────────────
    this.hp         = MAX_HP;
    this.maxHp      = MAX_HP;
    this.energy     = MAX_ENERGY;
    this.maxEnergy  = MAX_ENERGY;
    this.alive      = true;
    this.shieldActive  = false;
    this.shieldFlash   = 0;  // Frames restantes del efecto de escudo
    this.hitFlash      = 0;  // Frames restantes del efecto de impacto

    // ── Proyectiles disparados por este bot ──────────────────────
    this.projectiles = [];

    // ── Animación ────────────────────────────────────────────────
    this.animFrame  = 0;      // Contador de frames para animaciones
    this.isScanning = false;  // Efecto de escaneo activo
    this.scanFrames = 0;

    // ── Partículas de explosión ──────────────────────────────────
    this.deathParticles = [];
  }

  // ════════════════════════════════════════════════════════════════
  // COMANDOS DEL SCRIPT
  // ════════════════════════════════════════════════════════════════

  /**
   * Mueve el bot hacia adelante en la dirección actual.
   * Incluye colisión con los bordes de la arena.
   */
  avanzar() {
    const rad  = (this.angle * Math.PI) / 180;
    const newX = this.x + Math.cos(rad) * MOVE_DISTANCE;
    const newY = this.y + Math.sin(rad) * MOVE_DISTANCE;
    this.targetX = this._clampX(newX);
    this.targetY = this._clampY(newY);
    this.lerping = true;
  }

  /**
   * Mueve el bot hacia atrás en la dirección contraria.
   */
  retroceder() {
    const rad  = (this.angle * Math.PI) / 180;
    const newX = this.x - Math.cos(rad) * MOVE_DISTANCE;
    const newY = this.y - Math.sin(rad) * MOVE_DISTANCE;
    this.targetX = this._clampX(newX);
    this.targetY = this._clampY(newY);
    this.lerping = true;
  }

  /**
   * Gira el bot 45° a la derecha (sentido horario).
   */
  girarDerecha() {
    this.targetAngle = this.angle + ROTATION_STEP;
    this.lerping = true;
  }

  /**
   * Gira el bot 45° a la izquierda (sentido antihorario).
   */
  girarIzquierda() {
    this.targetAngle = this.angle - ROTATION_STEP;
    this.lerping = true;
  }

  /**
   * Dispara un proyectil en la dirección actual del bot.
   * @returns {Projectile} El proyectil creado.
   */
  disparar() {
    const proj = new Projectile(
      this.x, this.y,
      this.angle,
      this.type,
      this.color
    );
    this.projectiles.push(proj);
    return proj;
  }

  /**
   * Escanea el entorno y apunta al enemigo.
   * @param {Bot} enemy - El bot enemigo.
   * @returns {number} Ángulo hacia el enemigo.
   */
  escanear(enemy) {
    if (!enemy) return this.angle;
    const dx    = enemy.x - this.x;
    const dy    = enemy.y - this.y;
    const angle = Math.atan2(dy, dx) * (180 / Math.PI);
    this.targetAngle = angle;
    this.lerping     = true;
    this.isScanning  = true;
    this.scanFrames  = 40;
    return angle;
  }

  /**
   * Activa el escudo por un turno.
   */
  escudo() {
    this.shieldActive = true;
    this.shieldFlash  = 50;
  }

  /**
   * No hace nada pero se usa para recuperar energía en el motor de juego.
   */
  esperar() {
    // La recuperación de energía se maneja en el GameEngine.
  }

  /**
   * Recibe daño. Aplica reducción de escudo si está activo.
   * @param {number} amount - Cantidad de daño base.
   * @returns {number} Daño real aplicado.
   */
  recibirDaño(amount) {
    if (!this.alive) return 0;

    let damage = amount;
    if (this.shieldActive) {
      damage = Math.floor(amount * SHIELD_REDUCTION);
      this.shieldActive = false; // El escudo se consume al recibir daño
    }

    this.hp        = Math.max(0, this.hp - damage);
    this.hitFlash  = 8;

    if (this.hp <= 0) {
      this.alive = false;
      this._spawnDeathParticles();
    }

    return damage;
  }

  // ════════════════════════════════════════════════════════════════
  // ACTUALIZACIÓN (frame a frame)
  // ════════════════════════════════════════════════════════════════

  /**
   * Actualiza el estado del bot y sus proyectiles cada frame.
   * Se llama desde el bucle principal de GameEngine.
   * @param {Bot} enemy - Bot enemigo (para detección de colisiones)
   */
  update(enemy) {
    this.animFrame++;

    // Interpolación suave de posición y rotación
    if (this.lerping) {
      this.x     = this._lerp(this.x,     this.targetX,     0.18);
      this.y     = this._lerp(this.y,     this.targetY,     0.18);
      this.angle = this._lerpAngle(this.angle, this.targetAngle, 0.2);

      // Detener interpolación cuando alcanza el objetivo
      if (
        Math.abs(this.x - this.targetX)     < 0.5 &&
        Math.abs(this.y - this.targetY)     < 0.5 &&
        Math.abs(this.angle - this.targetAngle) < 0.5
      ) {
        this.x     = this.targetX;
        this.y     = this.targetY;
        this.angle = this.targetAngle;
        this.lerping = false;
      }
    }

    // Efecto de escudo
    if (this.shieldFlash > 0) this.shieldFlash--;

    // Efecto de impacto
    if (this.hitFlash > 0) this.hitFlash--;

    // Efecto de escaneo
    if (this.scanFrames > 0) this.scanFrames--;
    else this.isScanning = false;

    // Actualizar proyectiles
    for (const proj of this.projectiles) {
      if (!proj.active) continue;
      proj.update();

      // Comprobar si sale de la arena
      if (
        proj.x < 0 || proj.x > this.arenaW ||
        proj.y < 0 || proj.y > this.arenaH
      ) {
        proj.active = false;
        continue;
      }

      // Comprobar colisión con el enemigo
      if (enemy && enemy.alive) {
        const dx   = proj.x - enemy.x;
        const dy   = proj.y - enemy.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < BOT_RADIUS + PROJECTILE_SIZE) {
          proj.active = false;
          const damage = enemy.recibirDaño(proj.damage);
          // Emitir evento personalizado para que UIManager lo capture
          document.dispatchEvent(new CustomEvent('botHit', {
            detail: { attacker: this.type, victim: enemy.type, damage }
          }));
        }
      }
    }

    // Limpiar proyectiles inactivos
    this.projectiles = this.projectiles.filter(p => p.active);

    // Actualizar partículas de muerte
    this._updateDeathParticles();
  }

  // ════════════════════════════════════════════════════════════════
  // RENDERIZADO
  // ════════════════════════════════════════════════════════════════

  /**
   * Dibuja el bot en el canvas.
   * @param {CanvasRenderingContext2D} ctx
   */
  draw(ctx) {
    // Dibujar proyectiles primero (detrás del bot)
    for (const proj of this.projectiles) {
      proj.draw(ctx);
    }

    // Partículas de muerte (si ya murió)
    this._drawDeathParticles(ctx);

    if (!this.alive) return;

    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.rotate((this.angle * Math.PI) / 180);

    // ── Efecto de impacto ──────────────────────────────────────
    if (this.hitFlash > 0) {
      ctx.shadowBlur  = 30;
      ctx.shadowColor = '#ffffff';
    }

    // ── Efecto de escudo ───────────────────────────────────────
    if (this.shieldFlash > 0) {
      const alpha = (this.shieldFlash / 50) * 0.3;
      ctx.shadowBlur  = 20;
      ctx.shadowColor = '#ffe600';
    }

    // ── Cuerpo principal del bot ───────────────────────────────
    this._drawBody(ctx);

    // ── Cañón ─────────────────────────────────────────────────
    this._drawCannon(ctx);

    ctx.restore();

    // ── Barra de vida (sin rotación, en posición absoluta) ─────
    this._drawHealthBar(ctx);

    // ── Escudo visual (círculo alrededor) ─────────────────────
    if (this.shieldFlash > 0) {
      this._drawShield(ctx);
    }

    // ── Efecto escaneo ─────────────────────────────────────────
    if (this.isScanning) {
      this._drawScanEffect(ctx);
    }
  }

  /**
   * Dibuja el cuerpo hexagonal del bot.
   * @param {CanvasRenderingContext2D} ctx
   * @private
   */
  _drawBody(ctx) {
    const r = BOT_RADIUS;
    const pulse = Math.sin(this.animFrame * 0.08) * 2; // pequeño pulso

    // Sombra/glow exterior
    ctx.shadowBlur  = 18 + pulse;
    ctx.shadowColor = this.glowColor;

    // Fondo (hexágono oscuro)
    ctx.beginPath();
    for (let i = 0; i < 6; i++) {
      const a = (Math.PI / 3) * i - Math.PI / 6;
      const x = Math.cos(a) * (r + 2);
      const y = Math.sin(a) * (r + 2);
      i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
    }
    ctx.closePath();
    ctx.fillStyle = this.darkColor;
    ctx.fill();

    // Borde exterior brillante (hexágono circular)
    ctx.beginPath();
    for (let i = 0; i < 6; i++) {
      const a = (Math.PI / 3) * i - Math.PI / 6;
      const x = Math.cos(a) * r;
      const y = Math.sin(a) * r;
      i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
    }
    ctx.closePath();
    ctx.strokeStyle = this.color;
    ctx.lineWidth   = 2.5;
    ctx.stroke();

    // ── Renderizado del Avatar o Interior normal ──
    if (this.avatarImg && this.avatarImg.complete && this.avatarImg.naturalHeight !== 0) {
      // Dibujar avatar de DiceBear
      ctx.shadowBlur = 0;
      // Dibujar la imagen centrada. Bottts es cuadrado.
      const size = r * 2.2;
      ctx.drawImage(this.avatarImg, -size/2, -size/2, size, size);
    } else {
      // Interior (gradiente normal)
      const grad = ctx.createRadialGradient(0, -4, 2, 0, 0, r * 0.85);
      grad.addColorStop(0, `${this.color}55`);
      grad.addColorStop(1, `${this.darkColor}aa`);
      ctx.fillStyle = grad;
      ctx.fill();

      // Detalles: líneas internas
      ctx.shadowBlur = 0;
      ctx.strokeStyle = `${this.color}44`;
      ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(-r * 0.4, 0); ctx.lineTo(r * 0.4, 0); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(0, -r * 0.4); ctx.lineTo(0, r * 0.4); ctx.stroke();

      // Ojo central (círculo)
      ctx.shadowBlur  = 10;
      ctx.shadowColor = this.color;
      ctx.beginPath();
      ctx.arc(0, 0, 6, 0, Math.PI * 2);
      ctx.fillStyle = this.color;
      ctx.fill();
      ctx.beginPath();
      ctx.arc(0, 0, 3, 0, Math.PI * 2);
      ctx.fillStyle = '#ffffff';
      ctx.fill();
    }
  }

  /**
   * Dibuja el cañón del bot (apunta hacia la dirección actual).
   * @param {CanvasRenderingContext2D} ctx
   * @private
   */
  _drawCannon(ctx) {
    ctx.shadowBlur  = 8;
    ctx.shadowColor = this.color;

    // Cañón (rectángulo)
    ctx.fillStyle   = this.color;
    ctx.strokeStyle = this.color;
    ctx.lineWidth   = 1;

    const cannonLength = BOT_RADIUS + 14;
    const cannonWidth  = 5;

    ctx.beginPath();
    ctx.roundRect(
      BOT_RADIUS - 4,
      -cannonWidth / 2,
      cannonLength - BOT_RADIUS + 4,
      cannonWidth,
      2
    );
    ctx.fill();

    // Punta del cañón (más brillante)
    ctx.shadowBlur = 12;
    ctx.beginPath();
    ctx.arc(cannonLength, 0, 3.5, 0, Math.PI * 2);
    ctx.fillStyle = '#ffffff';
    ctx.fill();
  }

  /**
   * Dibuja la barra de vida sobre el bot.
   * @param {CanvasRenderingContext2D} ctx
   * @private
   */
  _drawHealthBar(ctx) {
    const barW  = 50;
    const barH  = 5;
    const barX  = this.x - barW / 2;
    const barY  = this.y - BOT_RADIUS - 14;
    const ratio = this.hp / this.maxHp;

    // Fondo
    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    ctx.beginPath();
    ctx.roundRect(barX - 1, barY - 1, barW + 2, barH + 2, 3);
    ctx.fill();

    // Barra de HP con color según nivel
    let barColor;
    if (ratio > 0.6)      barColor = this.color;
    else if (ratio > 0.3) barColor = '#ffe600';
    else                  barColor = '#ff4444';

    ctx.shadowBlur  = 6;
    ctx.shadowColor = barColor;
    ctx.fillStyle   = barColor;
    ctx.beginPath();
    ctx.roundRect(barX, barY, barW * ratio, barH, 3);
    ctx.fill();
    ctx.shadowBlur = 0;

    // ── Barra de Energía ──
    const energyBarY = barY + barH + 2;
    const energyRatio = this.energy / this.maxEnergy;

    // Fondo energía
    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    ctx.beginPath();
    ctx.roundRect(barX - 1, energyBarY - 1, barW + 2, 3 + 2, 2);
    ctx.fill();

    // Relleno energía (Azul eléctrico)
    ctx.fillStyle = '#0088ff';
    ctx.shadowBlur = 4;
    ctx.shadowColor = '#0088ff';
    ctx.beginPath();
    ctx.roundRect(barX, energyBarY, barW * energyRatio, 3, 2);
    ctx.fill();
    ctx.shadowBlur = 0;

    // Nombre del bot
    ctx.font      = `bold 9px 'Share Tech Mono'`;
    ctx.fillStyle = this.color;
    ctx.textAlign = 'center';
    ctx.fillText(this.name, this.x, barY - 4);
  }

  /**
   * Dibuja el efecto de escudo alrededor del bot.
   * @param {CanvasRenderingContext2D} ctx
   * @private
   */
  _drawShield(ctx) {
    const alpha = (this.shieldFlash / 50) * 0.5;
    ctx.save();
    ctx.shadowBlur  = 20;
    ctx.shadowColor = '#ffe600';
    ctx.strokeStyle = `rgba(255,230,0,${alpha})`;
    ctx.lineWidth   = 3;
    ctx.beginPath();
    ctx.arc(this.x, this.y, BOT_RADIUS + 10 + Math.sin(this.animFrame * 0.2) * 3, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }

  /**
   * Dibuja el efecto de escaneo (arco de radar).
   * @param {CanvasRenderingContext2D} ctx
   * @private
   */
  _drawScanEffect(ctx) {
    const progress = 1 - (this.scanFrames / 40);
    const radius   = 80 * progress;
    const alpha    = (1 - progress) * 0.6;

    ctx.save();
    ctx.strokeStyle = `rgba(57,255,20,${alpha})`;
    ctx.lineWidth   = 2;
    ctx.shadowBlur  = 10;
    ctx.shadowColor = '#39ff14';
    ctx.beginPath();
    ctx.arc(this.x, this.y, radius, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }

  // ════════════════════════════════════════════════════════════════
  // PARTÍCULAS DE MUERTE
  // ════════════════════════════════════════════════════════════════

  /** Genera partículas de explosión al morir. @private */
  _spawnDeathParticles() {
    for (let i = 0; i < 24; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 1.5 + Math.random() * 4;
      this.deathParticles.push({
        x: this.x, y: this.y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        life: 1,
        decay: 0.02 + Math.random() * 0.03,
        size: 2 + Math.random() * 5,
        color: [this.color, '#ffffff', '#ff8800'][Math.floor(Math.random() * 3)],
      });
    }
  }

  /** Actualiza las partículas de muerte. @private */
  _updateDeathParticles() {
    for (const p of this.deathParticles) {
      p.x    += p.vx;
      p.y    += p.vy;
      p.vy   += 0.05; // gravedad leve
      p.life -= p.decay;
    }
    this.deathParticles = this.deathParticles.filter(p => p.life > 0);
  }

  /** Dibuja las partículas de muerte. @private */
  _drawDeathParticles(ctx) {
    for (const p of this.deathParticles) {
      ctx.save();
      ctx.globalAlpha = p.life;
      ctx.shadowBlur  = 8;
      ctx.shadowColor = p.color;
      ctx.fillStyle   = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size * p.life, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  }

  // ════════════════════════════════════════════════════════════════
  // UTILIDADES PRIVADAS
  // ════════════════════════════════════════════════════════════════

  _lerp(a, b, t) { return a + (b - a) * t; }

  /** Interpola ángulos correctamente (evita saltos de 360°). */
  _lerpAngle(a, b, t) {
    let diff = b - a;
    while (diff >  180) diff -= 360;
    while (diff < -180) diff += 360;
    return a + diff * t;
  }

  _clampX(x) { return Math.max(BOT_RADIUS + 2, Math.min(this.arenaW - BOT_RADIUS - 2, x)); }
  _clampY(y) { return Math.max(BOT_RADIUS + 2, Math.min(this.arenaH - BOT_RADIUS - 2, y)); }

  /** Devuelve el porcentaje de HP como número entre 0 y 1. */
  get hpRatio() { return this.hp / this.maxHp; }
}

export { BOT_RADIUS, SHOOT_DAMAGE, MAX_HP, MAX_ENERGY };
