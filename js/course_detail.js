// ═══════════════════════════════════════════════════════════════════════
//  STACKCLASS — course_detail.js (Vista de Detalle de Curso)
// ═══════════════════════════════════════════════════════════════════════

import { requireAuth, isAdmin } from './common/auth.js';
import { renderHeader, showToast } from './common/ui.js';
import {
  COURSES, TOPICS, GAMES, GAMES_CRITERIA_MAPPING, getCourseStats,
  $, $$, escapeHtml, getUrlParams
} from './common/utils.js';
import { getTopics } from './common/db.js';

let currentCourse = null;
let currentCourseId = 'cyr';
let courseTopics = [];
let courseGames = [];
let activeLevelFilter = 'all';

// ── Guard de autenticación ──────────────────────────────────────
requireAuth({
  allowedRoles: ['teacher'],
  onAuthorized: async (user, profile) => {
    renderHeader(user, profile);
    await initCoursePage();
  }
});

// ── Inicialización de la vista ──────────────────────────────────
async function initCoursePage() {
  const params = getUrlParams();
  currentCourseId = params.courseId || params.subjectId || 'cyr';
  currentCourse = COURSES[currentCourseId] || COURSES.cyr;

  // Título de la pestaña
  document.title = `${currentCourse.name} — StackClass`;

  // Renderizar Hero
  renderHero(currentCourse);

  // Cargar y renderizar temas
  await loadAndRenderTopics(currentCourse.id);

  // Cargar y renderizar juegos
  loadAndRenderGames(currentCourse.id);

  // Configurar pestañas
  setupTabs();
}

// ── Renderizar Hero del Curso ───────────────────────────────────
function renderHero(course) {
  const hero = $('course-hero');
  if (hero) {
    hero.style.setProperty('--course-color', course.color);
    hero.style.setProperty('--course-color-dark', course.colorDark);
  }

  $('course-icon').textContent = course.icon;
  $('course-title').textContent = course.name;
  
  const badge = $('course-badge');
  badge.textContent = course.level;
  badge.style.background = `${course.color}20`;
  badge.style.color = course.colorDark || course.color;

  $('course-desc').textContent = course.description;

  const stats = getCourseStats(course.id);
  $('stat-topics-count').textContent = `${stats.topicsCount} bloques temáticos`;
  $('stat-games-count').textContent = `${stats.gamesCount} juegos educativos`;

  const evalBtn = $('btn-course-eval');
  if (evalBtn && course?.id) {
    evalBtn.href = `evaluation.html?subject=${encodeURIComponent(course.id)}`;
  }

  const roadmapBtn = $('btn-course-roadmap');
  if (roadmapBtn && course?.id) {
    roadmapBtn.href = `roadmap.html?subject=${encodeURIComponent(course.id)}`;
  }
}

// ── Cargar y renderizar Temario ─────────────────────────────────
async function loadAndRenderTopics(courseId) {
  const grid = $('course-topics-grid');
  if (!grid) return;

  grid.innerHTML = `<div class="class-card skeleton" style="height:180px"></div><div class="class-card skeleton" style="height:180px"></div>`;

  try {
    const dbTopics = await getTopics(courseId);
    if (dbTopics && dbTopics.length > 0) {
      courseTopics = dbTopics.map(t => {
        const local = TOPICS[t.id] || {};
        return {
          id: t.id,
          name: t.name,
          description: t.description || local.description || 'Contenido didáctico interactivo',
          icon: t.icon || local.icon || '📖',
          color: t.color || local.color || '#4a90e2',
          htmlPath: local.htmlPath || `temario/index.html?topicId=${t.id}&subjectId=${courseId}`
        };
      });
    } else {
      courseTopics = Object.values(TOPICS).filter(t => t.subjectId === courseId);
    }
  } catch (err) {
    console.warn('Fallback a catálogo estático de temas:', err);
    courseTopics = Object.values(TOPICS).filter(t => t.subjectId === courseId);
  }

  if (courseTopics.length === 0) {
    grid.innerHTML = `<p class="empty-state">No hay bloques temáticos disponibles para este curso.</p>`;
    return;
  }

  grid.innerHTML = courseTopics.map(topic => `
    <div class="topic-card" style="border-top: 4px solid ${topic.color || 'var(--primary)'};">
      <div>
        <div class="topic-card-header">
          <div class="topic-card-icon">${topic.icon || '📖'}</div>
          <div>
            <h3 class="topic-card-title">${escapeHtml(topic.name)}</h3>
          </div>
        </div>
        <p class="topic-card-desc">
          ${escapeHtml(topic.description || 'Consulta los materiales didácticos y resúmenes de este bloque.')}
        </p>
      </div>
      <div style="margin-top: var(--space-3); display: flex; gap: var(--space-2);">
        <a href="${topic.htmlPath || `temario/index.html?topicId=${topic.id}&subjectId=${courseId}`}" 
           class="btn btn-primary btn--sm" style="flex: 1; text-decoration: none; justify-content: center; display: inline-flex; align-items: center; gap: 6px;">
          <span>📖 Ver Contenido</span>
        </a>
      </div>
    </div>
  `).join('');
}

// ── Cargar y renderizar Juegos ──────────────────────────────────
function loadAndRenderGames(courseId) {
  courseGames = Object.values(GAMES).filter(g => g.subjectId === courseId);
  setupLevelFilters(courseId);
  renderGamesList();
}

function setupLevelFilters(courseId) {
  const container = $('level-filters-container');
  if (!container) return;

  const course = COURSES[courseId];
  const levels = course?.levels || [];

  if (levels.length <= 1) {
    container.style.display = 'none';
    return;
  }

  container.style.display = 'flex';
  const filterOptions = ['all', ...levels];

  container.innerHTML = filterOptions.map(lvl => `
    <button class="level-filter-btn ${activeLevelFilter === lvl ? 'level-filter-btn--active' : ''}" data-level="${lvl}">
      ${lvl === 'all' ? 'Todos los niveles' : lvl}
    </button>
  `).join('');

  container.querySelectorAll('.level-filter-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      activeLevelFilter = btn.dataset.level;
      container.querySelectorAll('.level-filter-btn').forEach(b => b.classList.remove('level-filter-btn--active'));
      btn.classList.add('level-filter-btn--active');
      renderGamesList();
    });
  });
}

function renderGamesList() {
  const grid = $('course-games-grid');
  if (!grid) return;

  let filtered = courseGames;
  if (activeLevelFilter !== 'all') {
    filtered = courseGames.filter(g => {
      const mapping = GAMES_CRITERIA_MAPPING[g.id];
      return mapping && mapping[activeLevelFilter];
    });
  }

  if (filtered.length === 0) {
    grid.innerHTML = `<p class="empty-state" style="grid-column: 1 / -1;">No hay juegos específicos para ${escapeHtml(activeLevelFilter)}.</p>`;
    return;
  }

  grid.innerHTML = filtered.map(g => {
    const criteriaMapping = GAMES_CRITERIA_MAPPING[g.id] || {};
    const criteriaLevels = Object.keys(criteriaMapping);

    return `
      <div class="game-card" style="--game-color:${g.color}; --game-color-dark:${g.colorDark}; text-decoration: none; cursor: default;">
        <div class="game-card-link" style="pointer-events: none;">
          <div class="game-card-icon">${g.icon}</div>
          <div class="game-card-name">${escapeHtml(g.name)}</div>
          <div class="game-card-desc">${escapeHtml(g.description)}</div>
          
          ${criteriaLevels.length > 0 ? `
            <div style="margin-top: var(--space-3); display: flex; gap: 4px; flex-wrap: wrap; justify-content: center;">
              ${criteriaLevels.map(lvl => `
                <span class="badge badge--sm" style="font-size: 0.7rem; background: var(--bg-surface); color: var(--text-secondary); border: 1px solid var(--border);">
                  ${escapeHtml(lvl)}
                </span>
              `).join('')}
            </div>
          ` : ''}
        </div>
        
        <div style="margin-top: var(--space-3); width: 100%;">
          <a href="${g.gamePath}" class="btn btn-outline btn--sm" style="width: 100%; text-decoration: none; justify-content: center; display: inline-flex; align-items: center; gap: 6px;">
            <span>🚀 Probar Juego</span>
          </a>
        </div>
      </div>
    `;
  }).join('');
}

// ── Pestañas (Tabs) ─────────────────────────────────────────────
function setupTabs() {
  const btnTopics = $('tab-btn-topics');
  const btnGames = $('tab-btn-games');
  const secTopics = $('section-topics');
  const secGames = $('section-games');

  btnTopics?.addEventListener('click', () => {
    btnTopics.classList.add('course-tab-btn--active');
    btnTopics.setAttribute('aria-selected', 'true');
    btnGames.classList.remove('course-tab-btn--active');
    btnGames.setAttribute('aria-selected', 'false');

    secTopics.style.display = 'block';
    secGames.style.display = 'none';
  });

  btnGames?.addEventListener('click', () => {
    btnGames.classList.add('course-tab-btn--active');
    btnGames.setAttribute('aria-selected', 'true');
    btnTopics.classList.remove('course-tab-btn--active');
    btnTopics.setAttribute('aria-selected', 'false');

    secTopics.style.display = 'none';
    secGames.style.display = 'block';
  });
}
