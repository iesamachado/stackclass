/**
 * UIManager.js
 * ─────────────────────────────────────────────────────────────────
 * Gestor de la Interfaz de Usuario.
 * Responsabilidades:
 *   - Manejar eventos del DOM (botones, inputs, modales)
 *   - Leer y validar el script del editor
 *   - Actualizar barras de HP, log, ranking
 *   - Mostrar modales de resultado
 *   - Conectar el editor con el GameEngine
 * ─────────────────────────────────────────────────────────────────
 */

import { GameEngine }  from './GameEngine.js';
import DataService     from './DataService.js';

export class UIManager {
  /**
   * @param {HTMLCanvasElement} canvas - Elemento canvas de la arena
   */
  constructor(canvas) {
    this.canvas     = canvas;
    this.engine     = null;
    this.isPlaying  = false;
    this.currentCmdIndex = -1;

    // Refs a elementos del DOM
    this.$ = {};
    this._grabDOMRefs();

    // Inicializar el motor gráfico
    if (this.canvas) {
      this._initEngine();
    }

    // Cargar datos persistidos
    this._loadSavedData();

    // Renderizar leaderboard real
    this._renderLeaderboard();

    // Vincular eventos
    this._bindEvents();

    // Cargar Tema Guardado
    const savedTheme = localStorage.getItem('arenaBotsTheme') || 'sketchbook';
    document.documentElement.setAttribute('data-theme', savedTheme);
    if (this.$.appThemeSelector) {
      this.$.appThemeSelector.value = savedTheme;
      this.$.appThemeSelector.addEventListener('change', (e) => {
        const theme = e.target.value;
        document.documentElement.setAttribute('data-theme', theme);
        localStorage.setItem('arenaBotsTheme', theme);
      });
    }

    // Sincronizar números de línea en el editor
    this._updateLineNumbers();

    console.log('[UIManager] Inicializado correctamente ✅');
    // Call UI setup for auth
    this._onAuthStateChanged(true);
  }

  // ════════════════════════════════════════════════════════════════
  // REFS AL DOM
  // ════════════════════════════════════════════════════════════════

  /**
   * Almacena referencias a todos los elementos del DOM usados.
   * @private
   */
  _grabDOMRefs() {
    const ids = [
      'player-name', 'player-name-display',
      'code-editor', 'line-numbers',
      'validation-area',
      'btn-arena-entrenar', 'btn-arena-competir', 'btn-reset', 'btn-limpiar', 'btn-guardar',
      'btn-ayuda', 'btn-clasificacion',
      'btn-mode-visual', 'btn-mode-texto',
      'editor-visual', 'editor-text',
      'canvas-overlay',
      'hp-player', 'hp-enemy',
      'hp-text-player', 'hp-text-enemy',
      'energy-player', 'energy-enemy',
      'battle-log',
      'ranking-tbody',
      'toast-container',
      // Modales
      'modal-resultado', 'modal-result-icon', 'modal-resultado-titulo',
      'modal-result-subtitle', 'modal-stats', 'modal-fireworks',
      'modal-btn-jugar-de-nuevo', 'modal-btn-cerrar-resultado',
      'modal-ayuda', 'modal-ayuda-cerrar', 'modal-ayuda-ok',
      'modal-clasificacion', 'modal-clasificacion-cerrar', 'modal-clasificacion-ok',
      'full-ranking-tbody',
      // Perfil
      'modal-perfil', 'modal-perfil-cerrar', 'perfil-nombre', 'perfil-apellidos', 'btn-guardar-perfil',
      // Taller de Robots
      'btn-taller', 'modal-taller', 'modal-taller-cerrar', 'btn-taller-aleatorio', 'btn-taller-guardar',
      'taller-preview-img', 'taller-basecolor', 'taller-face', 'taller-eyes', 'taller-mouth', 'taller-top', 'taller-sides', 'taller-texture', 'app-theme-selector',
      // Firebase Auth y Mis Robots
      'app-content', 'dashboard-content', 'arena-content', 'btn-login', 'btn-logout', 'btn-mis-robots', 'player-badge',
      'modal-auth', 'modal-auth-cerrar', 'btn-auth-google', 'auth-error',
      'btn-gestionar-clases', 'modal-clases', 'modal-clases-cerrar', 'btn-sync-classroom', 'lista-clases',
      'panel-torneo-detalle', 'torneo-clase-nombre', 'torneo-estado', 'btn-nuevo-torneo', 'btn-empezar-torneo', 'btn-ver-bracket',
      'modal-bracket', 'modal-bracket-cerrar', 'bracket-container',
      'modal-robots', 'modal-robots-cerrar', 'save-bot-name', 'btn-save-bot', 'saved-bots-list',
      // Dashboard Nav
      'btn-dash-jugar', 'btn-dash-robots', 'btn-dash-clasificacion', 'btn-volver-menu',
      'modo-clase-container', 'toggle-modo-clase'
    ];

    for (const id of ids) {
      const el = document.getElementById(id);
      if (el) {
        // Convertir 'some-id' → 'someId' como clave
        const key = id.replace(/-([a-z])/g, (_, c) => c.toUpperCase());
        this.$[key] = el;
      } else {
        console.warn(`[UIManager] Elemento no encontrado: #${id}`);
      }
    }
  }

  // ════════════════════════════════════════════════════════════════
  // INICIALIZAR EL MOTOR
  // ════════════════════════════════════════════════════════════════

  /** @private */
  _initEngine() {
    this.engine = new GameEngine(this.canvas, {
      onMatchEnd:    (result) => this._onMatchEnd(result),
      onLogEntry:    (msg, type) => this._addLogEntry(msg, type),
      onHpUpdate:    (playerHp, enemyHp, playerEnergy, enemyEnergy) => this._updateHpBars(playerHp, enemyHp, playerEnergy, enemyEnergy),
      onCommandStep: (owner, cmd, turn) => this._highlightCommand(owner, cmd, turn),
    });
  }

  /**
   * Formatea el nombre de un autor para proteger la privacidad (menores de edad).
   * "Juan Perez Garcia" -> "Juan P. G."
   * @private
   */
  _formatAuthorName(fullName) {
    if (!fullName) return 'Anónimo';
    const parts = fullName.trim().split(/\s+/);
    if (parts.length === 1) return parts[0];
    const firstName = parts[0];
    const initials = parts.slice(1).map(p => p[0].toUpperCase() + '.').join(' ');
    return `${firstName} ${initials}`;
  }

  /** Obtiene el nombre del autor priorizando el login de Google */
  _getCurrentAuthorName() {
    let name = 'Piloto';
    if (DataService.currentUser && DataService.currentUser.displayName) {
      name = DataService.currentUser.displayName;
    } else if (DataService.currentUser && DataService.currentUser.email) {
      name = DataService.currentUser.email.split('@')[0];
    }
    return this._formatAuthorName(name);
  }

  // ════════════════════════════════════════════════════════════════
  // FIREBASE: AUTH Y MIS ROBOTS
  // ════════════════════════════════════════════════════════════════
  
  _onAuthStateChanged(user) {
    if (user) {
      // Logueado
      if (this.$.appContent) this.$.appContent.removeAttribute('hidden');
      
      if (window.location.pathname.endsWith('arena.html')) {
        this._showArena();
      } else {
        this._showDashboard();
      }

      this.$.btnLogin.style.display = 'none';
      this.$.playerBadge.style.display = 'flex';
      this.$.btnMisRobots.style.display = 'flex';
      
      this._updatePlayerNameDisplay();
      
      if (this.$.modalAuthCerrar) this.$.modalAuthCerrar.style.display = 'block';
      this._closeModal('modal-auth');
      this._showToast(`Hola, ${user.displayName || user.email}`, 'success');
      
      // Cargar ranking ahora que tenemos permisos de lectura
      this._renderLeaderboard();
    } else {
      // Deslogueado
      if (this.$.appContent) this.$.appContent.setAttribute('hidden', '');
      this.$.btnLogin.style.display = 'inline-flex';
      this.$.playerBadge.style.display = 'none';
      this.$.btnMisRobots.style.display = 'none';
      this._openModal('modal-auth'); // Forzar apertura
      if (this.$.modalAuthCerrar) this.$.modalAuthCerrar.style.display = 'none'; // Ocultar X
    }
  }

  async _showDashboard() {
    if (!window.location.pathname.endsWith('index.html') && !window.location.pathname.endsWith('/arenabots/')) {
      window.location.href = 'index.html';
      return;
    }
    
    if (this.$.dashboardContent) this.$.dashboardContent.style.display = 'flex';
    if (this.$.arenaContent) this.$.arenaContent.setAttribute('hidden', '');
    if (this.$.btnVolverMenu) this.$.btnVolverMenu.style.display = 'none';
    if (this.$.btnAyuda) this.$.btnAyuda.style.display = 'none';

    // Comprobar si pertenece a una clase
    const myClassId = await DataService.getMyClassId();
    if (myClassId && this.$.modoClaseContainer) {
      this.currentStudentClassId = myClassId;
      this.$.modoClaseContainer.style.display = 'block';
    } else if (this.$.modoClaseContainer) {
      this.currentStudentClassId = null;
      this.$.modoClaseContainer.style.display = 'none';
      if (this.$.toggleModoClase) this.$.toggleModoClase.checked = false;
    }
  }

  _showArena() {
    if (!window.location.pathname.endsWith('arena.html')) {
      window.location.href = 'arena.html';
      return;
    }
    
    if (this.$.dashboardContent) this.$.dashboardContent.style.display = 'none';
    if (this.$.arenaContent) this.$.arenaContent.removeAttribute('hidden');
    if (this.$.btnVolverMenu) this.$.btnVolverMenu.style.display = 'inline-flex';
    if (this.$.btnAyuda) this.$.btnAyuda.style.display = 'inline-flex';
  }

  async _handleGoogleLogin() {
    this.$.authError.textContent = 'Conectando...';
    const res = await DataService.loginWithGoogle();
    if (!res.success) this.$.authError.textContent = res.error;
  }

  async _openMisRobots() {
    this._openModal('modal-robots');
    this.$.savedBotsList.innerHTML = '<p style="color:var(--text-secondary)">Cargando robots...</p>';
    
    // Comprobar si hay un torneo de clase en fase de inscripción
    let activeTournament = null;
    const myClassId = await DataService.getMyClassId();
    if (myClassId) {
      const t = await DataService.getTournament(myClassId);
      if (t && t.status === 'inscription') {
        activeTournament = t;
      }
    }

    const bots = await DataService.getSavedBots();
    
    this.$.savedBotsList.innerHTML = '';
    
    if (activeTournament) {
      const banner = document.createElement('div');
      banner.style.padding = '10px';
      banner.style.marginBottom = '15px';
      banner.style.background = 'rgba(255, 215, 0, 0.1)';
      banner.style.border = '1px solid var(--neon-yellow)';
      banner.style.borderRadius = '8px';
      banner.style.color = 'var(--neon-yellow)';
      
      const isEnrolled = activeTournament.participants.find(p => p.userId === DataService.currentUser.uid);
      if (isEnrolled) {
        banner.innerHTML = '🏆 Ya estás inscrito en el torneo de tu clase con el robot <strong>' + bots.find(b => b.id === isEnrolled.botId)?.name + '</strong>.';
      } else {
        banner.innerHTML = '🏆 ¡Hay un torneo activo en tu clase! Apunta uno de tus robots.';
      }
      this.$.savedBotsList.appendChild(banner);
    }

    if (bots.length === 0) {
      this.$.savedBotsList.innerHTML += '<p style="color:var(--text-secondary)">No tienes robots guardados.</p>';
      return;
    }

    bots.forEach(bot => {
      const card = document.createElement('div');
      card.className = 'saved-bot-card';
      
      const avatarHtml = `<div class="saved-bot-avatar">
        <img src="https://api.dicebear.com/7.x/bottts/svg?seed=${bot.avatar?.seed || 'x'}&face=${bot.avatar?.face || 'round01'}&eyes=${bot.avatar?.eyes || 'robocop'}&mouth=${bot.avatar?.mouth || 'grill01'}&top=${bot.avatar?.top || 'antenna'}&sides=${bot.avatar?.sides || 'cables01'}&texture=${bot.avatar?.texture || 'circuits'}&backgroundColor=transparent${bot.avatar?.baseColor ? '&baseColor='+bot.avatar.baseColor : ''}" />
      </div>`;

      let actionButtons = `
        <button class="btn-secondary btn-load" data-id="${bot.id}">Cargar</button>
        <button class="btn-secondary btn-del" data-id="${bot.id}" style="color:#ff4444; border-color:#ff4444">X</button>
      `;

      if (activeTournament && !activeTournament.participants.find(p => p.userId === DataService.currentUser.uid)) {
        actionButtons = `<button class="btn-primary btn-apuntar" data-id="${bot.id}" style="margin-right:10px;">🏆 Apuntar al Torneo</button>` + actionButtons;
      }

      card.innerHTML = `
        ${avatarHtml}
        <div class="saved-bot-info">
          <div class="saved-bot-name">${this._escapeHtml(bot.name)}</div>
          <div style="font-size:11px; color:var(--text-secondary)">Color: <span style="color:var(--neon-${bot.color})">${bot.color}</span></div>
          <div style="font-size:11px; color:var(--text-secondary)">Nivel <strong style="color:var(--neon-cyan)">${bot.level || 1}</strong> (${bot.wins || 0}G / ${bot.matches || 0}J)</div>
        </div>
        <div class="saved-bot-actions">
          ${actionButtons}
        </div>
      `;

      card.querySelector('.btn-load').addEventListener('click', () => this._loadCloudBot(bot));
      card.querySelector('.btn-del').addEventListener('click', () => this._deleteCloudBot(bot.id));
      
      const btnApuntar = card.querySelector('.btn-apuntar');
      if (btnApuntar) {
        btnApuntar.addEventListener('click', async () => {
          btnApuntar.textContent = 'Apuntando...';
          btnApuntar.disabled = true;
          const res = await DataService.enrollTournament(myClassId, bot);
          if (res.success) {
            this._showToast('¡Inscrito correctamente al torneo!', 'success');
            this._openMisRobots(); // Refresh
          } else {
            this._showToast(res.error, 'error');
            btnApuntar.textContent = '🏆 Apuntar al Torneo';
            btnApuntar.disabled = false;
          }
        });
      }

      this.$.savedBotsList.appendChild(card);
    });
  }

  async _saveCurrentBotToCloud() {
    const name = this.$.saveBotName.value.trim();
    if (!name) {
      this._showToast('Ponle un nombre a tu robot', 'error');
      return;
    }

    const botData = {
      name: name,
      script: this.$.codeEditor.value,
      color: DataService.getPlayerColor(),
      avatar: DataService.getAvatarConfig() || {},
      ownerName: this._getCurrentAuthorName()
    };

    const btn = this.$.btnSaveBot;
    btn.textContent = 'Guardando...';
    btn.disabled = true;

    let res;
    if (DataService.currentBotId) {
      res = await DataService.updateBot(DataService.currentBotId, botData);
    } else {
      res = await DataService.saveBot(botData);
    }
    
    btn.textContent = 'Guardar Robot Actual';
    btn.disabled = false;

    if (res.success) {
      this._showToast('Robot guardado en la nube', 'success');
      this.$.saveBotName.value = '';
      DataService.setCurrentBot(res.id, botData.name, botData.script, 0, 0, 1); // Stats reseteadas
      this._openMisRobots(); // recargar lista
    } else {
      this._showToast('Error al guardar: ' + res.error, 'error');
    }
  }

  _loadCloudBot(bot) {
    if (bot.script) this.$.codeEditor.value = bot.script;
    if (bot.color) {
      DataService.savePlayerColor(bot.color);
      document.querySelectorAll('.color-btn').forEach(btn => btn.classList.remove('active'));
      const activeBtn = document.querySelector(`.color-btn[data-color="${bot.color}"]`);
      if (activeBtn) activeBtn.classList.add('active');
    }
    if (bot.avatar) {
      DataService.saveAvatarConfig(bot.avatar);
    }
    this.$.saveBotName.value = bot.name || '';
    DataService.setCurrentBot(bot.id, bot.name || 'Robot', bot.script, bot.winRate || 0, bot.wins || 0, bot.level || 1);

    this._showToast(`Robot cargado: ${bot.name} (Nivel ${bot.level || 1})`, 'success');
    this._closeModal('modal-robots');
    this._showArena(); // Ir automáticamente a la arena
  }

  async _deleteCloudBot(botId) {
    if (!confirm('¿Seguro que quieres borrar este robot?')) return;
    await DataService.deleteBot(botId);
    this._openMisRobots(); // recargar lista
  }

  // ════════════════════════════════════════════════════════════════
  // EVENTOS DEL DOM
  // ════════════════════════════════════════════════════════════════

  /** Vincula todos los eventos de la interfaz. @private */
  _bindEvents() {
    // ── Dashboard Navigation ───────────────────────────────────
    this.$.btnDashJugar?.addEventListener('click', () => this._showArena());
    this.$.btnDashRobots?.addEventListener('click', () => this._openMisRobots());
    this.$.btnDashClasificacion?.addEventListener('click', () => {
      this._renderFullLeaderboard();
      this._openModal('modal-clasificacion');
    });
    this.$.btnDashClases?.addEventListener('click', () => {
        this._openModal('modal-clases');
        this._renderListaClases();
    });
    this.$.btnVolverMenu?.addEventListener('click', () => this._showDashboard());

    // ── Botón principal: Entrenar vs IA ──────────────────────────
    this.$.btnArenaEntrenar?.addEventListener('click', () => {
      this._startMatch(true); // isTraining = true
    });

    // ── Botón principal: Competir en Ranking ─────────────────────
    this.$.btnArenaCompetir?.addEventListener('click', () => {
      this._startMatch(false); // isTraining = false
    });

    // ── GESTIÓN DE CLASES Y TORNEOS ────────────────────────────
    this.$.btnGestionarClases?.addEventListener('click', () => {
      this._openModal('modal-clases');
      this._renderListaClases();
    });

    this.$.modalClasesCerrar?.addEventListener('click', () => {
      this._closeModal('modal-clases');
    });

    this.$.btnSyncClassroom?.addEventListener('click', async () => {
      await this._handleSyncClassroom();
    });

    this.$.btnNuevoTorneo?.addEventListener('click', async () => {
      if (!this.currentSelectedClass) return;
      this.$.btnNuevoTorneo.textContent = 'Creando...';
      const res = await DataService.createTournament(this.currentSelectedClass.id, this.currentSelectedClass.name);
      this.$.btnNuevoTorneo.textContent = '🏆 Abrir Inscripciones';
      if (res.success) {
        this._showToast('Inscripciones abiertas.', 'success');
        this._selectClassForTournament(this.currentSelectedClass); // refresh
      } else {
        this._showToast(res.error, 'error');
      }
    });

    this.$.btnEmpezarTorneo?.addEventListener('click', async () => {
      if (!this.currentSelectedClass) return;
      const t = await DataService.getTournament(this.currentSelectedClass.id);
      if (!t || t.participants.length < 2) {
        this._showToast('Se necesitan al menos 2 participantes', 'warning');
        return;
      }
      
      // Construir bracket simple
      const shuffled = [...t.participants].sort(() => Math.random() - 0.5);
      const bracket = [];
      for (let i = 0; i < shuffled.length; i += 2) {
        bracket.push({
          id: `m_${i}`,
          p1: shuffled[i],
          p2: shuffled[i + 1] || null, // Pasa automáticamente si es impar
          winner: shuffled[i + 1] ? null : 'p1' 
        });
      }

      await DataService.updateTournament(this.currentSelectedClass.id, {
        status: 'active',
        bracket: bracket
      });
      this._showToast('Torneo iniciado.', 'success');
      this._selectClassForTournament(this.currentSelectedClass); // refresh
    });

    this.$.btnVerBracket?.addEventListener('click', () => {
      this._renderBracket();
    });

    this.$.modalBracketCerrar?.addEventListener('click', () => {
      this._closeModal('modal-bracket');
    });

    // ── MIS ROBOTS Y RENDERIZADO ────────────────────────────────────────────
    this.$.btnReset?.addEventListener('click', () => this._resetGame());

    // ── Editor: limpiar, guardar, cargar ───────────────────────
    this.$.btnLimpiar?.addEventListener('click', () => {
      if (this.$.codeEditor) this.$.codeEditor.value = '';
    });
    this.$.btnGuardar?.addEventListener('click', () => {
      if (DataService.currentUser) {
        this._saveCurrentBotToCloud();
      } else {
        this._showToast('Debes iniciar sesión para guardar', 'error');
      }
    });

    // ── Cambio de modo del editor ──────────────────────────────
    this.$.btnModeVisual?.addEventListener('click', () => this._setEditorMode('visual'));
    this.$.btnModeTexto?.addEventListener('click',  () => this._setEditorMode('text'));

    // ── Paleta de comandos visuales ────────────────────────────
    document.querySelectorAll('.cmd-block').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const cmd = e.currentTarget.dataset.cmd;
        if (cmd) this._insertCommand(cmd);
      });
    });

    // ── Selección de color del bot ─────────────────────────────
    document.querySelectorAll('.color-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        document.querySelectorAll('.color-btn').forEach(b => b.classList.remove('active'));
        e.currentTarget.classList.add('active');
        const color = e.currentTarget.dataset.color;
        DataService.savePlayerColor(color);
      });
    });

    // ── Nombre del jugador (Input oculto, pero mantenemos compatibilidad) ──
    this.$.playerName?.addEventListener('input', (e) => {
      // Ya no hace nada visible, el nombre se coge de Google
    });

    // ── Actualizar números de línea en tiempo real ─────────────
    this.$.codeEditor?.addEventListener('input', () => {
      this._updateLineNumbers();
      this._validateScript(false); // validación suave (sin toast)
    });

    this.$.codeEditor?.addEventListener('keydown', (e) => {
      // Tab → insertar 2 espacios en lugar de cambiar el foco
      if (e.key === 'Tab') {
        e.preventDefault();
        const start = e.target.selectionStart;
        const end   = e.target.selectionEnd;
        e.target.value = e.target.value.slice(0, start) + '  ' + e.target.value.slice(end);
        e.target.selectionStart = e.target.selectionEnd = start + 2;
        this._updateLineNumbers();
      }
    });

    // ── Botón de Ayuda ─────────────────────────────────────────
    this.$.btnAyuda?.addEventListener('click', () => this._openModal('modal-ayuda'));
    this.$.modalAyudaCerrar?.addEventListener('click', () => this._closeModal('modal-ayuda'));
    this.$.modalAyudaOk?.addEventListener('click',     () => this._closeModal('modal-ayuda'));

    // ── Botón de Clasificación ─────────────────────────────────
    this.$.btnClasificacion?.addEventListener('click', () => {
      this._renderFullLeaderboard();
      this._openModal('modal-clasificacion');
    });
    this.$.modalClasificacionCerrar?.addEventListener('click', () => this._closeModal('modal-clasificacion'));
    this.$.modalClasificacionOk?.addEventListener('click',     () => this._closeModal('modal-clasificacion'));

    // ── Botones del modal de resultado ─────────────────────────
    this.$.modalBtnJugarDeNuevo?.addEventListener('click', () => {
      this._closeModal('modal-resultado');
      this._resetGame();
    });
    this.$.modalBtnCerrarResultado?.addEventListener('click', () => {
      this._closeModal('modal-resultado');
    });

    // ── Taller de Robots ───────────────────────────────────────
    this.$.btnTaller?.addEventListener('click', () => this._openTaller());
    this.$.modalTallerCerrar?.addEventListener('click', () => this._closeModal('modal-taller'));
    this.$.btnTallerAleatorio?.addEventListener('click', () => this._randomizeTaller());
    this.$.btnTallerGuardar?.addEventListener('click', () => this._saveTaller());

    const tallerSelects = ['tallerBasecolor', 'tallerFace', 'tallerEyes', 'tallerMouth', 'tallerTop', 'tallerSides', 'tallerTexture'];
    tallerSelects.forEach(id => {
      this.$[id]?.addEventListener('change', () => this._updateTallerPreview());
    });

    this.$.appThemeSelector?.addEventListener('change', (e) => {
      const theme = e.target.value;
      document.documentElement.setAttribute('data-theme', theme);
      localStorage.setItem('arenaBotsTheme', theme);
    });

    // ── Perfil de Usuario ──────────────────────────────────────
    document.addEventListener('click', (e) => {
      if (e.target.id === 'player-name-display' || e.target.closest('#player-name-display')) {
        if (!DataService.currentUser) return;
        if (this.$.perfilNombre) this.$.perfilNombre.value = DataService.currentUser.displayName || 'Piloto';
        if (this.$.perfilApellidos) this.$.perfilApellidos.value = DataService.userProfile?.lastName || '';
        this._openModal('modal-perfil');
      }
    });
    this.$.modalPerfilCerrar?.addEventListener('click', () => this._closeModal('modal-perfil'));
    this.$.btnGuardarPerfil?.addEventListener('click', async () => {
      const apellidos = this.$.perfilApellidos.value.trim();
      this._showToast('Guardando perfil...', 'info');
      await DataService.updateUserProfile({ lastName: apellidos });
      this._updatePlayerNameDisplay();
      this._closeModal('modal-perfil');
      this._showToast('Perfil guardado con éxito', 'success');
    });

    // ── Auth y Mis Robots ──────────────────────────────────────
    this.$.btnLogin?.addEventListener('click', () => this._openModal('modal-auth'));
    this.$.modalAuthCerrar?.addEventListener('click', () => this._closeModal('modal-auth'));
    this.$.btnAuthGoogle?.addEventListener('click', () => this._handleGoogleLogin());
    this.$.btnLogout?.addEventListener('click', () => DataService.logout());

    this.$.btnMisRobots?.addEventListener('click', () => this._openMisRobots());
    this.$.modalRobotsCerrar?.addEventListener('click', () => this._closeModal('modal-robots'));
    this.$.btnSaveBot?.addEventListener('click', () => this._saveCurrentBotToCloud());

    // ── Cerrar modales al clicar fuera ─────────────────────────
    document.querySelectorAll('.modal-overlay').forEach(overlay => {
      overlay.addEventListener('click', (e) => {
        if (e.target === overlay) this._closeModal(overlay.id);
      });
    });

    // ── Evento de impacto (desde Bot.js) ──────────────────────
    document.addEventListener('botHit', (e) => {
      const { attacker, victim, damage } = e.detail;
      const attackerName = attacker === 'player'
        ? (this.$.playerName?.value.trim() || 'Tu Bot')
        : 'CPU-X9';
      this._addLogEntry(
        `💥 ${attackerName} impacta: -${damage} HP al ${victim === 'player' ? 'jugador' : 'CPU'}`,
        'hit'
      );
    });

    // ── Tecla Escape para cerrar modales ──────────────────────
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        document.querySelectorAll('.modal-overlay:not([hidden])').forEach(m => {
          if (m.id !== 'modal-resultado') this._closeModal(m.id);
        });
      }
    });
  }

  // ════════════════════════════════════════════════════════════════
  // LÓGICA DE BATALLA
  // ════════════════════════════════════════════════════════════════

  /**
   * Valida el script e inicia la batalla si todo es correcto.
   * @param {boolean} isTraining - Si true, busca un NPC. Si false, busca un Humano.
   * @private
   */
  _startMatch(isTraining = false) {
    if (this.isPlaying) return;

    const script = this.$.codeEditor ? this.$.codeEditor.value.trim() : '';
    if (!script.trim()) {
      this._showValidation('El script está vacío. Usa los botones o escribe código.', 'warn');
      return;
    }

    const { commands, errors } = GameEngine.parseScript(script);

    if (errors.length > 0) {
      this._showValidation(errors.join(' | '), 'error');
      return;
    } else {
      this._showValidation('', '');
    }

    // Entrar en modo juego
    this.isPlaying = true;
    this.$.btnArenaEntrenar?.setAttribute('disabled', 'true');
    this.$.btnArenaCompetir?.setAttribute('disabled', 'true');
    this.$.codeEditor?.setAttribute('disabled', 'true');
    document.querySelectorAll('.cmd-block').forEach(b => b.setAttribute('disabled', 'true'));
    this.$.canvasOverlay?.classList.add('hidden');

    // Limpiar log
    if (this.$.battleLog) this.$.battleLog.innerHTML = '';

    // Obtener configuración del jugador
    const botName = DataService.currentBotName || 'Robot Local';
    const authorName = this._getCurrentAuthorName();
    const playerNameDisplay = `${botName} (${authorName})`;

    const playerColor = DataService.getPlayerColor();
    const avatarConfig = DataService.getAvatarConfig();
    let playerAvatarUrl = null;
    if (avatarConfig) {
      const params = new URLSearchParams({
        seed: avatarConfig.seed || playerName,
        backgroundColor: 'transparent',
        face: avatarConfig.face || 'round01',
        eyes: avatarConfig.eyes || 'robocop',
        mouth: avatarConfig.mouth || 'grill01',
        top: avatarConfig.top || 'antenna',
        sides: avatarConfig.sides || 'cables01',
        texture: avatarConfig.texture || 'circuits',
      });
      if (avatarConfig.baseColor) params.append('baseColor', avatarConfig.baseColor);
      playerAvatarUrl = `https://api.dicebear.com/7.x/bottts/svg?${params.toString()}`;
    }

    // Matchmaking: Buscar oponente
    const currentLevel = DataService.currentBotId ? DataService.currentBotLevel : 1;
    const isClassMode = this.$.toggleModoClase && this.$.toggleModoClase.checked;
    const targetClassId = isClassMode ? this.currentStudentClassId : null;

    if (isClassMode) {
      this._addLogEntry(`Buscando oponente en Modo Clase...`, 'system');
    } else {
      this._addLogEntry(`Buscando oponente de Nivel ${currentLevel}...`, 'system');
    }
    
    DataService.getRandomOpponent(currentLevel, DataService.currentBotId, targetClassId).then(enemyData => {
      this.currentEnemyBotId = enemyData.id;
      
      // Formatear el nombre del enemigo para mostrar "(Autor)" si es humano
      let enemyNameDisplay = enemyData.name;
      if (enemyData.ownerId !== 'SYSTEM' && enemyData.ownerName) {
        enemyNameDisplay = `${enemyData.name} (${enemyData.ownerName})`;
      }
      const enemyDataToRender = { ...enemyData, name: enemyNameDisplay };

      // Iniciar el motor
      this.engine.startMatch(commands, playerColor, playerNameDisplay, playerAvatarUrl, enemyDataToRender);
      this._showToast(`¡Batalla iniciada! Oponente: ${enemyDataToRender.name} (Nivel ${enemyDataToRender.level || 1})`, 'success');
    });
  }

  /**
   * Reinicia el juego para una nueva partida.
   * @private
   */
  _resetGame() {
    this.engine.stop();
    this.isPlaying = false;

    // Reiniciar HP y Energía en UI
    this._updateHpBars(100, 100, 100, 100);

    // Restaurar UI
    this.$.btnArena?.removeAttribute('disabled');
    this.$.btnReset?.classList.add('hidden');
    this.$.codeEditor?.removeAttribute('disabled');
    document.querySelectorAll('.cmd-block').forEach(b => b.removeAttribute('disabled'));
    this.$.canvasOverlay?.classList.remove('hidden');

    // Limpiar resaltado de comandos
    this._clearCommandHighlight();
    this._showValidation('', '');

    // Reiniciar el motor
    this._initEngine();

    this._showToast('Nueva partida lista. ¡Modifica tu script!', 'info');
  }

  // ════════════════════════════════════════════════════════════════
  // CALLBACKS DEL MOTOR
  // ════════════════════════════════════════════════════════════════

  /**
   * Se llama cuando el motor detecta el fin de la partida.
   * @param {Object} result
   * @private
   */
  _onMatchEnd(result) {
    const playerName = this.$.playerName?.value.trim() || 'Piloto';

    // Guardar resultado
    DataService.saveMatchResult({
      playerName,
      outcome:      result.outcome,
      playerHpLeft: result.playerHpLeft,
      enemyHpLeft:  result.enemyHpLeft,
      turnsPlayed:  result.turnsPlayed,
    });

    // Actualizar clasificación en UI
    this._renderLeaderboard();

    // Actualizar stats de la partida global en Firebase
    const isWin = result.outcome === 'victoria';
    if (this.isRankedMatch) {
      if (DataService.currentBotId) {
        DataService.updateBotStats(DataService.currentBotId, isWin);
      }
      if (this.currentEnemyBotId) {
        // En ranked, sumamos derrota al rival (si es humano, currentEnemyBotId ya existe)
        DataService.updateBotStats(this.currentEnemyBotId, result.outcome === 'derrota');
      }
    } else if (this.currentTournamentMatch) {
      // ── GUARDAR RESULTADO DEL TORNEO ──────────────────────────────
      const tClassId = this.currentTournamentMatch.classId;
      const mIndex = this.currentTournamentMatch.matchIndex;
      const winnerId = isWin ? 'p1' : 'p2';

      DataService.getTournament(tClassId).then(t => {
        if (t && t.bracket && t.bracket[mIndex]) {
          t.bracket[mIndex].winner = winnerId;
          DataService.updateTournament(tClassId, { bracket: t.bracket });
        }
      });
      // Limpiar estado
      this.currentTournamentMatch = null;
    }
    
    // Mostrar modal de resultado
    setTimeout(() => this._showResultModal(result, playerName), 800);
  }

  /**
   * Actualiza las barras de HP y Energía en el header de la arena.
   * @param {number} playerHp
   * @param {number} enemyHp
   * @param {number} playerEnergy
   * @param {number} enemyEnergy
   * @private
   */
  _updateHpBars(playerHp, enemyHp, playerEnergy = 100, enemyEnergy = 100) {
    const maxHp = 100;
    const maxEnergy = 100;

    if (this.$.hpPlayer) {
      this.$.hpPlayer.style.width = `${Math.max(0, (playerHp / maxHp) * 100)}%`;
    }
    if (this.$.hpEnemy) {
      this.$.hpEnemy.style.width = `${Math.max(0, (enemyHp / maxHp) * 100)}%`;
    }
    if (this.$.hpTextPlayer) this.$.hpTextPlayer.textContent = `${Math.max(0, playerHp)} HP`;
    if (this.$.hpTextEnemy)  this.$.hpTextEnemy.textContent  = `${Math.max(0, enemyHp)} HP`;

    if (this.$.energyPlayer) {
      this.$.energyPlayer.style.width = `${Math.max(0, (playerEnergy / maxEnergy) * 100)}%`;
    }
    if (this.$.energyEnemy) {
      this.$.energyEnemy.style.width = `${Math.max(0, (enemyEnergy / maxEnergy) * 100)}%`;
    }
  }

  /**
   * Resalta el comando actualmente en ejecución en el editor.
   * @param {string} owner - 'player' | 'cpu'
   * @param {string} cmd
   * @param {number} turn
   * @private
   */
  _highlightCommand(owner, cmd, turn) {
    if (owner !== 'player') return; // Solo resaltamos comandos del jugador

    const lines = (this.$.codeEditor?.value || '').split('\n');
    this.currentCmdIndex++;

    // Resaltar visualmente el número de línea en los números de línea
    const lineNums = this.$.lineNumbers?.querySelectorAll('.ln-num');
    if (lineNums) {
      lineNums.forEach(ln => ln.classList.remove('ln-active'));
      if (lineNums[this.currentCmdIndex]) {
        lineNums[this.currentCmdIndex].classList.add('ln-active');
      }
    }
  }

  /** Elimina todos los resaltados de comandos. @private */
  _clearCommandHighlight() {
    this.currentCmdIndex = -1;
    const lineNums = this.$.lineNumbers?.querySelectorAll('.ln-num');
    if (lineNums) lineNums.forEach(ln => ln.classList.remove('ln-active'));
  }

  // ════════════════════════════════════════════════════════════════
  // LOG DE BATALLA
  // ════════════════════════════════════════════════════════════════

  /**
   * Añade una entrada al log de batalla.
   * @param {string} message
   * @param {'player'|'enemy'|'system'|'hit'} type
   * @private
   */
  _addLogEntry(message, type = 'system') {
    if (!this.$.battleLog) return;

    const now  = new Date();
    const time = `${String(now.getSeconds()).padStart(2, '0')}.${String(now.getMilliseconds()).padStart(3, '0')}`;

    const entry = document.createElement('div');
    entry.className = `log-entry log-${type}`;
    entry.innerHTML = `<span class="log-time">[${time}]</span><span>${message}</span>`;

    this.$.battleLog.appendChild(entry);

    // Auto-scroll al final
    this.$.battleLog.scrollTop = this.$.battleLog.scrollHeight;

    // Limitar a 100 entradas para no saturar el DOM
    const entries = this.$.battleLog.querySelectorAll('.log-entry');
    if (entries.length > 100) entries[0].remove();
  }

  // ════════════════════════════════════════════════════════════════
  // EDITOR DE CÓDIGO
  // ════════════════════════════════════════════════════════════════

  /**
   * Inserta un comando en la posición actual del cursor del editor.
   * @param {string} cmd - Texto del comando a insertar
   * @private
   */
  _insertCommand(cmd) {
    const editor = this.$.codeEditor;
    if (!editor || editor.disabled) return;

    const start = editor.selectionStart;
    const end   = editor.selectionEnd;
    const val   = editor.value;
    const before = val.slice(0, start);
    const after  = val.slice(end);

    // Añadir salto de línea si no está al inicio de una línea
    const needsNewline = before.length > 0 && !before.endsWith('\n');
    const insertion    = (needsNewline ? '\n' : '') + cmd + '\n';

    editor.value = before + insertion + after;
    const newPos = start + insertion.length;
    editor.setSelectionRange(newPos, newPos);
    editor.focus();

    this._updateLineNumbers();
    this._validateScript(false);

    // Pequeña animación en el botón
    const btn = document.querySelector(`[data-cmd="${cmd}"]`);
    if (btn) {
      btn.style.transform = 'scale(0.92)';
      setTimeout(() => { btn.style.transform = ''; }, 120);
    }
  }

  /**
   * Valida el script del editor y muestra el resultado.
   * @param {boolean} showToast - Si true, muestra un toast con el resultado.
   * @private
   */
  _validateScript(showToast = true) {
    const text = this.$.codeEditor?.value?.trim() || '';
    if (!text) {
      this._showValidation('', '');
      return;
    }

    const { commands, errors } = GameEngine.parseScript(text);

    if (errors.length > 0) {
      this._showValidation(`❌ ${errors[0]}`, 'error');
      if (showToast) this._showToast(errors[0], 'error');
    } else if (commands.length === 0) {
      this._showValidation('⚠️ No hay comandos válidos.', 'warn');
    } else {
      this._showValidation(`✅ ${commands.length} comandos válidos.`, 'ok');
    }
  }

  /**
   * Actualiza el área de números de línea del editor.
   * @private
   */
  _updateLineNumbers() {
    const editor = this.$.codeEditor;
    if (!editor || !this.$.lineNumbers) return;

    const lines = editor.value.split('\n');
    const nums  = lines.map((_, i) => `<span class="ln-num" data-line="${i + 1}">${i + 1}</span>`).join('\n');
    this.$.lineNumbers.innerHTML = nums;
  }

  /**
   * Muestra/oculta el mensaje de validación del script.
   * @param {string} msg
   * @param {'ok'|'error'|'warn'|''} type
   * @private
   */
  _showValidation(msg, type) {
    const el = this.$.validationArea;
    if (!el) return;
    el.className = 'validation-area';
    el.textContent = msg;
    if (type) el.classList.add(`validation-${type}`);
  }

  /** Limpia el editor de código. @private */
  _clearEditor() {
    if (this.$.codeEditor) {
      this.$.codeEditor.value = '';
      this._updateLineNumbers();
      this._showValidation('', '');
    }
  }

  /** Guarda el script actual en la nube directamente desde el editor. @private */
  async _saveScript() {
    const script = this.$.codeEditor?.value?.trim() || '';
    if (!script) {
      this._showToast('El script está vacío.', 'warning');
      return;
    }

    if (!DataService.currentBotId) {
      // Robot nuevo, abrimos Mis Robots para que le ponga nombre
      this._showToast('Guarda tu robot por primera vez desde aquí.', 'info');
      this._openMisRobots();
      return;
    }

    // Comprobar si hay cambios
    if (script === (DataService.currentBotScript || '').trim()) {
      this._showToast('No hay cambios que guardar.', 'info');
      return;
    }

    // Robot existente, pedir confirmación por la pérdida de victorias
    if (!confirm('Vas a sobrescribir este robot modificado. ¡Se resetearán sus victorias a 0! ¿Estás seguro?')) {
      return;
    }

    const botData = {
      name: DataService.currentBotName || 'Robot Modificado',
      script: script,
      color: DataService.getPlayerColor(),
      avatar: DataService.getAvatarConfig() || {},
      ownerName: this._getCurrentAuthorName()
    };

    const btn = this.$.btnGuardar;
    if (btn) {
      btn.textContent = 'Guardando...';
      btn.disabled = true;
    }

    const res = await DataService.updateBot(DataService.currentBotId, botData);
    
    if (btn) {
      btn.innerHTML = '💾 Guardar';
      btn.disabled = false;
    }

    if (res.success) {
      this._showToast('Cambios guardados. Nivel reseteado a 1.', 'success');
      DataService.setCurrentBot(DataService.currentBotId, botData.name, botData.script, 0, 0, 1);
    } else {
      this._showToast('Error al guardar: ' + res.error, 'error');
    }
  }

  /**
   * Cambia el modo del editor (visual/texto).
   * @param {'visual'|'text'} mode
   * @private
   */
  _setEditorMode(mode) {
    const isVisual = mode === 'visual';
    this.$.editorVisual?.classList.toggle('hidden', !isVisual);
    this.$.editorText?.classList.toggle('hidden',   isVisual);
    this.$.btnModeVisual?.classList.toggle('active', isVisual);
    this.$.btnModeTexto?.classList.toggle('active', !isVisual);
  }

  // ════════════════════════════════════════════════════════════════
  // CLASIFICACIÓN / RANKING
  // ════════════════════════════════════════════════════════════════

  /**
   * Renderiza la tabla de clasificación en el panel lateral.
   * @private
   */
  async _renderLeaderboard() {
    const tbody = this.$.rankingTbody;
    if (!tbody) return;

    tbody.innerHTML = '<tr><td colspan="5" style="text-align:center; color:var(--text-secondary);">Cargando...</td></tr>';
    
    const entries = await DataService.getLeaderboard(5);

    if (entries.length === 0) {
      tbody.innerHTML = '<tr><td colspan="5" class="ranking-empty">¡Nadie ha luchado aún!</td></tr>';
      return;
    }

    tbody.innerHTML = entries.map((entry, idx) => {
      const rank    = idx + 1;
      const rate    = entry.winRate || 0;
      const rankCls = rank <= 3 ? `rank-${rank}` : '';
      const badge   = rank <= 3
        ? `<span class="rank-badge">${['🥇','🥈','🥉'][rank - 1]}</span>`
        : rank;

      return `
        <tr class="${rankCls}" role="row">
          <td role="cell">${badge}</td>
          <td role="cell">
            <strong>${this._escapeHtml(entry.name)}</strong><br>
            <span style="font-size: 0.8em; color: var(--text-secondary);">por ${this._escapeHtml(entry.ownerName || 'Anónimo')}</span>
          </td>
          <td role="cell">Nivel ${entry.level || 1}</td>
          <td role="cell">${entry.wins || 0}</td>
          <td role="cell">${entry.matches || 0}</td>
        </tr>
      `;
    }).join('');
  }

  /**
   * Renderiza la clasificación completa en el modal.
   * @private
   */
  async _renderFullLeaderboard() {
    const tbody = this.$.fullRankingTbody;
    if (!tbody) return;

    tbody.innerHTML = '<tr><td colspan="5" style="text-align:center; color:var(--text-secondary);">Cargando...</td></tr>';

    const entries = await DataService.getLeaderboard(50);

    if (entries.length === 0) {
      tbody.innerHTML = '<tr><td colspan="5" class="ranking-empty">Sin datos aún</td></tr>';
      return;
    }

    tbody.innerHTML = entries.map((entry, idx) => {
      const rank = idx + 1;
      const rate = entry.winRate || 0;
      const rankCls = rank <= 3 ? `rank-${rank}` : '';
      return `
        <tr class="${rankCls}">
          <td>${rank <= 3 ? ['🥇','🥈','🥉'][rank - 1] : rank}</td>
          <td>
            <strong>${this._escapeHtml(entry.name)}</strong><br>
            <span style="font-size: 0.8em; color: var(--text-secondary);">por ${this._escapeHtml(entry.ownerName || 'Anónimo')}</span>
          </td>
          <td>Nivel ${entry.level || 1}</td>
          <td>${entry.wins || 0}</td>
          <td>${entry.matches || 0}</td>
        </tr>
      `;
    }).join('');
  }

  // ════════════════════════════════════════════════════════════════
  // MODAL DE RESULTADO
  // ════════════════════════════════════════════════════════════════

  /**
   * Muestra el modal de resultado de la partida.
   * @param {Object} result - Datos del resultado
   * @param {string} playerName
   * @private
   */
  _showResultModal(result, playerName) {
    const { outcome, playerHpLeft, enemyHpLeft, turnsPlayed, duration } = result;

    const icons = { victoria: '🏆', derrota: '💀', empate: '🤝' };
    const titles = {
      victoria: '¡VICTORIA!',
      derrota:  '¡DERROTA!',
      empate:   '¡EMPATE!',
    };
    const subtitles = {
      victoria: `${playerName} ha destruido al CPU-X9 🎉`,
      derrota:  `CPU-X9 ha ganado esta vez. ¡Mejora tu estrategia!`,
      empate:   `Ningún bot ha sobrevivido. ¡Próxima vez más cuidado!`,
    };

    // Actualizar contenido del modal
    if (this.$.modalResultIcon)        this.$.modalResultIcon.textContent = icons[outcome];
    if (this.$.modalResultadoTitulo)   this.$.modalResultadoTitulo.textContent = titles[outcome];
    if (this.$.modalResultSubtitle)    this.$.modalResultSubtitle.textContent = subtitles[outcome];

    // Estadísticas
    if (this.$.modalStats) {
      this.$.modalStats.innerHTML = `
        <div class="modal-stat">
          <div class="modal-stat-value">${Math.max(0, playerHpLeft)}</div>
          <div class="modal-stat-label">HP restante</div>
        </div>
        <div class="modal-stat">
          <div class="modal-stat-value">${turnsPlayed}</div>
          <div class="modal-stat-label">Turnos</div>
        </div>
        <div class="modal-stat">
          <div class="modal-stat-value">${duration}s</div>
          <div class="modal-stat-label">Duración</div>
        </div>
        <div class="modal-stat">
          <div class="modal-stat-value">${Math.max(0, enemyHpLeft)}</div>
          <div class="modal-stat-label">HP CPU</div>
        </div>
      `;
    }

    // Clase de resultado para estilos
    const card = document.querySelector('.modal-resultado-card');
    if (card) {
      card.classList.remove('victoria', 'derrota', 'empate');
      card.classList.add(outcome);
    }

    // Fuegos artificiales solo en victoria
    if (outcome === 'victoria') {
      this._launchFireworks();
    } else if (this.$.modalFireworks) {
      this.$.modalFireworks.innerHTML = '';
    }

    this._openModal('modal-resultado');
  }

  /**
   * Crea animación de fuegos artificiales en el modal.
   * @private
   */
  _launchFireworks() {
    const container = this.$.modalFireworks;
    if (!container) return;
    container.innerHTML = '';

    const colors = ['#00f5ff', '#ff00aa', '#39ff14', '#ffe600', '#bf5fff'];

    for (let i = 0; i < 30; i++) {
      const p = document.createElement('div');
      p.className = 'firework-particle';
      const color = colors[Math.floor(Math.random() * colors.length)];
      const tx    = (Math.random() - 0.5) * 300;
      const ty    = -(60 + Math.random() * 120);
      const dur   = 0.8 + Math.random() * 0.8;
      const delay = Math.random() * 0.6;

      p.style.cssText = `
        left: ${20 + Math.random() * 60}%;
        top:  ${30 + Math.random() * 40}%;
        background: ${color};
        box-shadow: 0 0 6px ${color};
        --tx: ${tx}px;
        --ty: ${ty}px;
        --dur: ${dur}s;
        animation-delay: ${delay}s;
      `;
      container.appendChild(p);
    }
  }

  _updatePlayerNameDisplay() {
    if (!DataService.currentUser) return;
    const profile = DataService.userProfile || {};
    const baseName = DataService.currentUser.displayName?.split(' ')[0] || 'Piloto';
    const lastName = profile.lastName ? ` (${profile.lastName})` : '';
    const fullName = baseName + lastName;
    
    this.$.playerNameDisplay.textContent = fullName;
    if (this.$.playerName) {
      this.$.playerName.value = fullName;
    }
  }

  // ════════════════════════════════════════════════════════════════
  // TOASTS Y MODALES
  // ════════════════════════════════════════════════════════════════

  /**
   * Abre un modal por su ID.
   * @param {string} modalId
   * @private
   */
  _openModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
      modal.removeAttribute('hidden');
      // Foco accesible en el primer elemento interactivo
      const focusable = modal.querySelector('button, [tabindex="0"]');
      if (focusable) setTimeout(() => focusable.focus(), 100);
    }
  }

  /**
   * Cierra un modal por su ID.
   * @param {string} modalId
   * @private
   */
  _closeModal(modalId) {
    if (modalId === 'modal-auth' && (!DataService.currentUser)) {
      // Bloquear cierre si no está logueado
      return;
    }
    const modal = document.getElementById(modalId);
    if (modal) modal.setAttribute('hidden', '');
  }

  // ════════════════════════════════════════════════════════════════
  // TALLER DE ROBOTS
  // ════════════════════════════════════════════════════════════════

  /** Abre el modal del taller y carga la configuración guardada */
  _openTaller() {
    const config = DataService.getAvatarConfig() || {
      seed: this.$.playerName?.value.trim() || 'Piloto',
      baseColor: '', face: 'round01', eyes: 'robocop', mouth: 'grill01',
      top: 'antenna', sides: 'cables01', texture: 'circuits'
    };

    if (this.$.tallerBasecolor) this.$.tallerBasecolor.value = config.baseColor || '';
    if (this.$.tallerFace) this.$.tallerFace.value = config.face || 'round01';
    if (this.$.tallerEyes) this.$.tallerEyes.value = config.eyes || 'robocop';
    if (this.$.tallerMouth) this.$.tallerMouth.value = config.mouth || 'grill01';
    if (this.$.tallerTop) this.$.tallerTop.value = config.top || 'antenna';
    if (this.$.tallerSides) this.$.tallerSides.value = config.sides || 'cables01';
    if (this.$.tallerTexture) this.$.tallerTexture.value = config.texture || 'circuits';

    this._updateTallerPreview();
    this._openModal('modal-taller');
  }

  /** Actualiza la imagen de vista previa del taller basándose en los selects */
  _updateTallerPreview() {
    if (!this.$.tallerPreviewImg) return;
    
    // Dicebear genera siempre lo mismo si no cambia el seed,
    // usamos el nombre del jugador como seed base para el estilo general
    const seed = this.$.playerName?.value.trim() || 'Piloto';
    
    const params = new URLSearchParams({
      seed: seed,
      backgroundColor: 'transparent',
      face: this.$.tallerFace?.value || 'round01',
      eyes: this.$.tallerEyes?.value || 'robocop',
      mouth: this.$.tallerMouth?.value || 'grill01',
      top: this.$.tallerTop?.value || 'antenna',
      sides: this.$.tallerSides?.value || 'cables01',
      texture: this.$.tallerTexture?.value || 'circuits',
    });
    const bc = this.$.tallerBasecolor?.value;
    if (bc) params.append('baseColor', bc);

    this.$.tallerPreviewImg.style.opacity = '0.5';
    this.$.tallerPreviewImg.src = `https://api.dicebear.com/7.x/bottts/svg?${params.toString()}`;
    
    this.$.tallerPreviewImg.onload = () => {
      this.$.tallerPreviewImg.style.opacity = '1';
    };
  }

  /** Elige opciones aleatorias en todos los selects del taller */
  _randomizeTaller() {
    const selects = ['tallerBasecolor', 'tallerFace', 'tallerEyes', 'tallerMouth', 'tallerTop', 'tallerSides', 'tallerTexture'];
    selects.forEach(id => {
      const el = this.$[id];
      if (el && el.options.length > 0) {
        const randomIndex = Math.floor(Math.random() * el.options.length);
        el.selectedIndex = randomIndex;
      }
    });
    this._updateTallerPreview();
  }

  /** Guarda la configuración actual del taller en localStorage */
  _saveTaller() {
    const seed = this.$.playerName?.value.trim() || 'Piloto';
    const config = {
      seed: seed,
      baseColor: this.$.tallerBasecolor?.value,
      face: this.$.tallerFace?.value,
      eyes: this.$.tallerEyes?.value,
      mouth: this.$.tallerMouth?.value,
      top: this.$.tallerTop?.value,
      sides: this.$.tallerSides?.value,
      texture: this.$.tallerTexture?.value,
    };
    
    DataService.saveAvatarConfig(config);
    this._showToast('✅ Avatar guardado correctamente', 'success');
    this._closeModal('modal-taller');
  }

  // ════════════════════════════════════════════════════════════════
  // GOOGLE CLASSROOM Y TORNEOS (PROFESOR)
  // ════════════════════════════════════════════════════════════════

  async _handleSyncClassroom() {
    this.$.btnSyncClassroom.textContent = 'Autenticando...';
    this.$.btnSyncClassroom.disabled = true;

    const res = await DataService.connectClassroom();
    if (!res.success) {
      this._showToast('Error de autenticación con Google Classroom.', 'error');
      this.$.btnSyncClassroom.textContent = '🔄 Sincronizar Classroom';
      this.$.btnSyncClassroom.disabled = false;
      return;
    }

    if (!DataService.classroomToken) {
      this._showToast('No se obtuvo el token de Classroom. Quizás cancelaste los permisos.', 'error');
      this.$.btnSyncClassroom.textContent = '🔄 Sincronizar Classroom';
      this.$.btnSyncClassroom.disabled = false;
      return;
    }

    this.$.btnSyncClassroom.textContent = 'Descargando clases...';
    
    const courses = await DataService.fetchClassroomCourses(DataService.classroomToken);
    
    if (courses.length === 0) {
      this._showToast('No se encontraron clases activas en tu Classroom.', 'warning');
      this.$.btnSyncClassroom.textContent = '🔄 Sincronizar Classroom';
      this.$.btnSyncClassroom.disabled = false;
      return;
    }

    let importedCount = 0;
    this.$.btnSyncClassroom.textContent = 'Importando alumnos...';

    for (const course of courses) {
      const students = await DataService.fetchClassroomStudents(DataService.classroomToken, course.id);
      const importRes = await DataService.importClass(course, students);
      if (importRes.success) importedCount++;
    }

    this._showToast(`Se han sincronizado ${importedCount} clases correctamente.`, 'success');
    this.$.btnSyncClassroom.textContent = '🔄 Sincronizar Classroom';
    this.$.btnSyncClassroom.disabled = false;

    this._renderListaClases();
  }

  async _renderListaClases() {
    if (!this.$.listaClases) return;
    this.$.listaClases.innerHTML = '<p style="text-align:center; color:var(--text-secondary)">Cargando...</p>';
    
    const classes = await DataService.getTeacherClasses();
    
    if (classes.length === 0) {
      this.$.listaClases.innerHTML = '<p style="text-align:center; color:var(--text-secondary)">No tienes clases sincronizadas.</p>';
      return;
    }

    this.$.listaClases.innerHTML = '';
    classes.forEach(c => {
      const div = document.createElement('div');
      div.className = 'saved-bot-card';
      div.style.cursor = 'pointer';
      div.innerHTML = `
        <div class="saved-bot-info">
          <div class="saved-bot-name" style="color:var(--neon-cyan)">${this._escapeHtml(c.name)}</div>
          <div style="font-size:11px; color:var(--text-secondary)">${c.studentEmails?.length || 0} alumnos sincronizados</div>
        </div>
      `;
      div.addEventListener('click', () => {
        document.querySelectorAll('#lista-clases .saved-bot-card').forEach(el => el.style.borderColor = 'transparent');
        div.style.borderColor = 'var(--neon-cyan)';
        this._selectClassForTournament(c);
      });
      this.$.listaClases.appendChild(div);
    });
  }

  async _selectClassForTournament(c) {
    if (this.$.panelTorneoDetalle) this.$.panelTorneoDetalle.style.display = 'block';
    if (this.$.torneoClaseNombre) this.$.torneoClaseNombre.textContent = c.name;
    
    this.currentSelectedClass = c;

    const t = await DataService.getTournament(c.id);

    if (!t) {
      if (this.$.torneoEstado) this.$.torneoEstado.textContent = 'Estado: Sin torneo activo';
      if (this.$.btnNuevoTorneo) this.$.btnNuevoTorneo.style.display = 'flex';
      if (this.$.btnEmpezarTorneo) this.$.btnEmpezarTorneo.style.display = 'none';
      if (this.$.btnVerBracket) this.$.btnVerBracket.style.display = 'none';
    } else if (t.status === 'inscription') {
      if (this.$.torneoEstado) this.$.torneoEstado.textContent = `Estado: INSCRIPCIÓN ABIERTA (${t.participants.length} alumnos apuntados)`;
      if (this.$.btnNuevoTorneo) this.$.btnNuevoTorneo.style.display = 'none';
      if (this.$.btnEmpezarTorneo) this.$.btnEmpezarTorneo.style.display = 'flex';
      if (this.$.btnVerBracket) this.$.btnVerBracket.style.display = 'none';
    } else {
      if (this.$.torneoEstado) this.$.torneoEstado.textContent = `Estado: TORNEO ACTIVO`;
      if (this.$.btnNuevoTorneo) this.$.btnNuevoTorneo.style.display = 'none';
      if (this.$.btnEmpezarTorneo) this.$.btnEmpezarTorneo.style.display = 'none';
      if (this.$.btnVerBracket) this.$.btnVerBracket.style.display = 'flex';
    }
  }

  async _renderBracket() {
    if (!this.currentSelectedClass) return;
    this._openModal('modal-bracket');
    if (this.$.bracketContainer) this.$.bracketContainer.innerHTML = '<p style="color:var(--neon-cyan)">Cargando cuadro...</p>';

    const t = await DataService.getTournament(this.currentSelectedClass.id);
    if (!t || !t.bracket) {
      if (this.$.bracketContainer) this.$.bracketContainer.innerHTML = '<p>No hay datos del bracket.</p>';
      return;
    }

    if (this.$.bracketContainer) this.$.bracketContainer.innerHTML = '';
    const roundDiv = document.createElement('div');
    roundDiv.style.display = 'flex';
    roundDiv.style.flexDirection = 'column';
    roundDiv.style.gap = '15px';

    t.bracket.forEach((match, index) => {
      const matchBox = document.createElement('div');
      matchBox.style.border = '1px solid var(--neon-purple)';
      matchBox.style.borderRadius = '8px';
      matchBox.style.padding = '10px';
      matchBox.style.background = 'rgba(0,0,0,0.5)';
      matchBox.style.width = '250px';
      
      const p1Name = match.p1 ? match.p1.snapshotData.name : '???';
      const p2Name = match.p2 ? match.p2.snapshotData.name : '--- Pasa Directo ---';
      
      matchBox.innerHTML = `
        <div style="margin-bottom:5px; padding:5px; background: ${match.winner === 'p1' ? 'rgba(0,255,0,0.2)' : 'rgba(255,255,255,0.1)'}; display:flex; justify-content:space-between">
          <span>${this._escapeHtml(p1Name)}</span>
          ${match.winner === 'p1' ? '🏆' : ''}
        </div>
        <div style="padding:5px; background: ${match.winner === 'p2' ? 'rgba(0,255,0,0.2)' : 'rgba(255,255,255,0.1)'}; display:flex; justify-content:space-between">
          <span>${this._escapeHtml(p2Name)}</span>
          ${match.winner === 'p2' ? '🏆' : ''}
        </div>
      `;

      if (!match.winner && match.p2) {
        const btnPlay = document.createElement('button');
        btnPlay.className = 'btn-primary';
        btnPlay.style.width = '100%';
        btnPlay.style.marginTop = '10px';
        btnPlay.style.fontSize = '0.8em';
        btnPlay.innerHTML = '⚔️ Ver Combate';
        btnPlay.addEventListener('click', () => {
          this._playTournamentMatch(t, match, index);
        });
        matchBox.appendChild(btnPlay);
      }

      roundDiv.appendChild(matchBox);
    });

    if (this.$.bracketContainer) this.$.bracketContainer.appendChild(roundDiv);
  }

  _playTournamentMatch(t, match, index) {
    this._closeModal('modal-bracket');
    this._closeModal('modal-clases');
    this._showArena();

    const p1 = match.p1.snapshotData;
    const p2 = match.p2.snapshotData;

    // Engañamos a UIManager para que el P1 sea el jugador local a efectos visuales
    this.currentEnemyBotId = p2.id;
    
    // Almacenamos el match para saber que estamos en un torneo
    this.currentTournamentMatch = { classId: t.classId, matchIndex: index, p1Id: p1.id, p2Id: p2.id };

    // Usar GameEngine.parseScript (estático)
    const { commands } = GameEngine.parseScript(p1.script || '');
    this.engine.startMatch(
      commands, 
      p1.color || 'var(--neon-cyan)', 
      `${p1.name} (${p1.ownerName})`, 
      '', 
      { ...p2, name: `${p2.name} (${p2.ownerName})` }
    );
    this._showToast(`TORNEO: ${p1.name} vs ${p2.name}`, 'warning');
  }

  // ════════════════════════════════════════════════════════════════
  // PERSISTENCIA: Cargar datos guardados
  // ════════════════════════════════════════════════════════════════

  /**
   * Carga datos persistidos en localStorage y los aplica a la UI.
   * @private
   */
  _loadSavedData() {
    // Nombre del jugador
    const savedName = DataService.getPlayerName();
    if (this.$.playerName)        this.$.playerName.value = savedName;
    if (this.$.playerNameDisplay) this.$.playerNameDisplay.textContent = savedName;

    // Color del bot
    const savedColor = DataService.getPlayerColor();
    document.querySelectorAll('.color-btn').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.color === savedColor);
    });
  }

  // ════════════════════════════════════════════════════════════════
  // NOTIFICACIONES TOAST
  // ════════════════════════════════════════════════════════════════

  /**
   * Muestra una notificación toast temporal.
   * @param {string} message
   * @param {'success'|'error'|'info'|'warning'} type
   * @param {number} durationMs - Duración en ms (por defecto 3000)
   * @private
   */
  _showToast(message, type = 'info', durationMs = 3000) {
    const container = this.$.toastContainer;
    if (!container) return;

    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.setAttribute('role', 'alert');
    toast.style.setProperty('--delay', `${durationMs / 1000 - 0.3}s`);

    const icons = { success: '✅', error: '❌', info: 'ℹ️', warning: '⚠️' };
    toast.innerHTML = `<span>${icons[type] || 'ℹ️'}</span><span>${this._escapeHtml(message)}</span>`;

    container.appendChild(toast);

    // Eliminar después de la animación
    setTimeout(() => {
      toast.remove();
    }, durationMs);
  }

  // ════════════════════════════════════════════════════════════════
  // UTILIDADES
  // ════════════════════════════════════════════════════════════════

  /**
   * Escapa caracteres HTML para prevenir XSS.
   * @param {string} text
   * @returns {string}
   * @private
   */
  _escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }
}
