// ═══════════════════════════════════════════════════════════════════════
//  STACKCLASS — Gamificación Centralizada (XP, Ligas, Medallas, Gremios)
//  Librería única que gestiona la adquisición de XP y medallas.
//  Los datos de medallas, gremios, ligas y configuración de juegos se
//  cargan dinámicamente desde la base de datos Supabase (sin hardcodeo).
// ═══════════════════════════════════════════════════════════════════════

import { supabase } from './supabase-config.js';
import { getUserProfile, updateUserProfile, getMedals, getGuilds, getLeagues, getGameXPConfigs } from './db.js';
import { showToast, triggerConfetti } from './ui.js';

// ──────────────────────────────────────────────────────────────────────
//  ESTADO Y CATÁLOGOS EN MEMORIA (CARGADOS DINÁMICAMENTE DESDE LA BBDD)
// ──────────────────────────────────────────────────────────────────────
export const DEFAULT_TIC2_GUILDS = [
  { id: 'turing', subject_id: 'tic2', name: 'La Hermandad de Turing', icon: '🗝️', color: '#8e44ad', image: 'img/turing.png', desc: 'Herederos del mismísimo Alan Turing. Maestros de la lógica y la criptografía. Su objetivo es descifrar los secretos mejor guardados del ciberespacio.' },
  { id: 'lovelace', subject_id: 'tic2', name: 'Los Hijos de Lovelace', icon: '⚙️', color: '#2980b9', image: 'img/lovelace.png', desc: 'Bajo el manto de Ada Lovelace, la primera programadora de la historia. Son los arquitectos del código, estructurados, analíticos y elegantes.' },
  { id: 'hopper', subject_id: 'tic2', name: 'El Escuadrón de Hopper', icon: '🐛', color: '#16a085', image: 'img/hopper.png', desc: 'Inspirados en Grace Hopper. Compiladores natos, depuradores incansables y siempre listos para encontrar y aplastar cualquier "bug" en el código.' },
  { id: 'stallman', subject_id: 'tic2', name: 'La Resistencia de Stallman', icon: '🐃', color: '#e67e22', image: 'img/stallman.png', desc: 'Devotos del Software Libre y herederos de la filosofía GNU de Richard Stallman. Luchan por la libertad del código y el conocimiento sin cadenas.' }
];

export const DEFAULT_CYR_GUILDS = [
  { id: 'r2d2', subject_id: 'cyr', name: 'La Brigada R2-D2', icon: '🔵', color: '#00bcd4', image: 'img/gremios/r2d2.png', desc: 'Fieles, valientes y siempre listos para la misión. Inspirados en el famoso astromecánico de Star Wars.' },
  { id: 'walle', subject_id: 'cyr', name: 'El Colectivo WALL·E', icon: '🟠', color: '#ff9800', image: 'img/gremios/walle.png', desc: 'Curiosos, creativos y con un enorme corazón. Como el robot de Pixar, valoran la creatividad.' },
  { id: 'baymax', subject_id: 'cyr', name: 'La Unidad Baymax', icon: '🤍', color: '#e53935', image: 'img/gremios/baymax.png', desc: 'Pacíficos, empáticos y siempre dispuestos a ayudar. Destacan por su compañerismo.' },
  { id: 'terminator', subject_id: 'cyr', name: 'La Orden Terminator', icon: '💀', color: '#607d8b', image: 'img/gremios/terminator.png', desc: 'Imparables, determinados y forjados en acero. Como el T-800, no conocen el abandono.' }
];

export const LEAGUES = [];
export const GAME_XP_CONFIG = {};
export const MEDALS_CATALOG = [];
export const TIC2_MEDALS_CATALOG = [];
export const CYR_MEDALS_CATALOG = [];
export const MEDAL_XP = {};
export const GUILDS_CATALOG = [...DEFAULT_TIC2_GUILDS, ...DEFAULT_CYR_GUILDS];
export const TIC2_GUILDS_CATALOG = [...DEFAULT_TIC2_GUILDS];
export const CYR_GUILDS_CATALOG = [...DEFAULT_CYR_GUILDS];

let _initPromise = null;

// ──────────────────────────────────────────────────────────────────────
//  CARGADORES DINÁMICOS DESDE SUPABASE
// ──────────────────────────────────────────────────────────────────────

export async function loadLeagues() {
  try {
    const list = await getLeagues();
    if (list && list.length > 0) {
      LEAGUES.length = 0;
      list.forEach(l => {
        LEAGUES.push({
          id: l.id,
          name: l.name,
          min_xp: Number(l.min_xp) || 0,
          pts: Number(l.min_xp) || 0,
          icon: l.icon || '🥉',
          color: l.color || '#888',
          sort_order: l.sort_order || 0
        });
      });
      // Ordenar de mayor a menor para getLeague
      LEAGUES.sort((a, b) => b.min_xp - a.min_xp);
      return LEAGUES;
    }
  } catch (err) {
    console.error('Error cargando ligas desde la BBDD:', err);
  }
  return LEAGUES;
}

export async function loadGameXPConfigs() {
  try {
    const configs = await getGameXPConfigs();
    if (configs && configs.length > 0) {
      for (const k of Object.keys(GAME_XP_CONFIG)) delete GAME_XP_CONFIG[k];
      configs.forEach(c => {
        GAME_XP_CONFIG[c.game_id] = {
          maxRef: Number(c.max_ref) || 100,
          base: Number(c.base) || 70
        };
      });
    }
  } catch (err) {
    console.error('Error cargando configs de XP por juego desde la BBDD:', err);
  }
  if (!GAME_XP_CONFIG['default']) {
    GAME_XP_CONFIG['default'] = { maxRef: 100, base: 70 };
  }
  return GAME_XP_CONFIG;
}

export async function loadMedals(subjectId = null) {
  try {
    const list = await getMedals(subjectId);
    if (list && list.length > 0) {
      if (!subjectId) {
        MEDALS_CATALOG.length = 0;
        TIC2_MEDALS_CATALOG.length = 0;
        CYR_MEDALS_CATALOG.length = 0;
        for (const k of Object.keys(MEDAL_XP)) delete MEDAL_XP[k];

        list.forEach(m => {
          const item = {
            id: m.id,
            subject_id: m.subject_id,
            name: m.name,
            desc: m.description,
            description: m.description,
            icon: m.icon,
            xp_value: Number(m.xp_value) || 0,
            public: m.public !== false
          };
          MEDALS_CATALOG.push(item);
          if (m.subject_id === 'tic2') TIC2_MEDALS_CATALOG.push(item);
          if (m.subject_id === 'cyr') CYR_MEDALS_CATALOG.push(item);
          if (m.xp_value !== undefined && m.xp_value !== null) {
            MEDAL_XP[m.id] = Number(m.xp_value) || 0;
          }
        });
        return MEDALS_CATALOG;
      } else {
        return list.map(m => ({
          id: m.id,
          subject_id: m.subject_id,
          name: m.name,
          desc: m.description,
          description: m.description,
          icon: m.icon,
          xp_value: Number(m.xp_value) || 0,
          public: m.public !== false
        }));
      }
    }
  } catch (err) {
    console.error('Error cargando medallas desde la BBDD:', err);
  }
  return subjectId ? getMedalsForSubject(subjectId) : MEDALS_CATALOG;
}

export async function loadGuilds(subjectId = null) {
  try {
    const list = await getGuilds(subjectId);
    if (list && list.length > 0) {
      if (!subjectId) {
        GUILDS_CATALOG.length = 0;
        TIC2_GUILDS_CATALOG.length = 0;
        CYR_GUILDS_CATALOG.length = 0;
        list.forEach(g => {
          const item = {
            id: g.id,
            subject_id: g.subject_id,
            name: g.name,
            icon: g.icon,
            image: g.image_url || g.image || (g.subject_id === 'tic2' ? `img/${g.id}.png` : `img/gremios/${g.id}.png`),
            color: g.color,
            desc: g.description,
            description: g.description
          };
          GUILDS_CATALOG.push(item);
          if (g.subject_id === 'tic2') TIC2_GUILDS_CATALOG.push(item);
          if (g.subject_id === 'cyr') CYR_GUILDS_CATALOG.push(item);
        });
        return GUILDS_CATALOG;
      } else {
        const mapped = list.map(g => ({
          id: g.id,
          subject_id: g.subject_id,
          name: g.name,
          icon: g.icon,
          image: g.image_url || g.image || (g.subject_id === 'tic2' ? `img/${g.id}.png` : `img/gremios/${g.id}.png`),
          color: g.color,
          desc: g.description,
          description: g.description
        }));
        if (String(subjectId).toLowerCase().includes('tic')) {
          TIC2_GUILDS_CATALOG.length = 0;
          TIC2_GUILDS_CATALOG.push(...mapped);
        } else {
          CYR_GUILDS_CATALOG.length = 0;
          CYR_GUILDS_CATALOG.push(...mapped);
        }
        return mapped;
      }
    }
  } catch (err) {
    console.error('Error cargando gremios desde la BBDD:', err);
  }
  return subjectId ? getGuildsForSubject(subjectId) : GUILDS_CATALOG;
}

export async function initGamification() {
  if (!_initPromise) {
    _initPromise = Promise.all([
      loadLeagues(),
      loadGameXPConfigs(),
      loadMedals(),
      loadGuilds()
    ]).catch(err => {
      console.warn('Advertencia durante la precarga de gamificación:', err);
    });
  }
  return _initPromise;
}

// Iniciar precarga inmediata al importar el módulo
initGamification();

// ──────────────────────────────────────────────────────────────────────
//  LIGAS UNIFICADAS
// ──────────────────────────────────────────────────────────────────────

export function getLeague(xp) {
  const points = Number(xp) || 0;
  for (const league of LEAGUES) {
    const min = league.pts !== undefined ? league.pts : (league.min_xp || 0);
    if (points >= min) return league;
  }
  return LEAGUES[LEAGUES.length - 1] || { id: 'bronce', name: 'Liga Bronce', pts: 0, min_xp: 0, icon: '🥉', color: '#cd6133' };
}

export function renderLeagueCard(points) {
  const liga = getLeague(points);
  return `
    <div class="gamification-card" style="border: 2px solid ${liga.color}; border-radius: 8px; padding: 15px; text-align: center;">
      <div style="font-size: 2.5rem;">${liga.icon}</div>
      <h4 style="color: ${liga.color}; margin: 10px 0 5px 0;">${liga.name}</h4>
      <p style="margin: 0; font-size: 1.1rem; font-weight: bold;">${points} XP</p>
    </div>
  `;
}

// ──────────────────────────────────────────────────────────────────────
//  CONFIGURACIÓN XP POR JUEGO
// ──────────────────────────────────────────────────────────────────────

/**
 * Calcula XP ganado en base a la puntuación del juego.
 * Tolera argumentos tanto (gameId, score) como (score, gameId).
 */
export function computeGameXP(arg1, arg2, nPartidas = 1, previousMaxScore = 0) {
  let gameId = 'default';
  let score = 0;

  if (typeof arg1 === 'number' && typeof arg2 === 'string') {
    score = arg1; gameId = arg2;
  } else {
    gameId = String(arg1 || 'default'); score = Number(arg2) || 0;
  }

  if (score <= 0) return 5; // Mínimo 5 XP por participar

  const cfg = GAME_XP_CONFIG[gameId] || GAME_XP_CONFIG['default'] || { maxRef: 100, base: 70 };
  const basePlay = 5;

  const getScoreXP = (s) => {
    const ratio = Math.min(2.0, s / Math.max(1, cfg.maxRef));
    const scoreFactor = Math.pow(ratio, 0.65);
    return cfg.base * scoreFactor;
  };

  if (nPartidas <= 1) {
    return Math.max(5, Math.round(basePlay + getScoreXP(score)));
  } else {
    if (score > previousMaxScore) {
      const delta = getScoreXP(score) - getScoreXP(previousMaxScore);
      return Math.max(5, Math.round(basePlay + Math.max(0, delta)));
    } else {
      return basePlay;
    }
  }
}

// ──────────────────────────────────────────────────────────────────────
//  GREMIOS POR ASIGNATURA
// ──────────────────────────────────────────────────────────────────────
export function getGuildsForSubject(subjectId) {
  const sub = String(subjectId || '').toLowerCase();
  if (sub.includes('tic')) {
    return TIC2_GUILDS_CATALOG.length > 0 ? TIC2_GUILDS_CATALOG : GUILDS_CATALOG.filter(g => g.subject_id === 'tic2');
  }
  return CYR_GUILDS_CATALOG.length > 0 ? CYR_GUILDS_CATALOG : GUILDS_CATALOG.filter(g => g.subject_id === 'cyr');
}

// ──────────────────────────────────────────────────────────────────────
//  MEDALLAS POR ASIGNATURA
// ──────────────────────────────────────────────────────────────────────
export function getMedalsForSubject(subjectId) {
  const sub = String(subjectId || '').toLowerCase();
  if (sub.includes('tic')) {
    return TIC2_MEDALS_CATALOG.length > 0 ? TIC2_MEDALS_CATALOG : MEDALS_CATALOG.filter(m => m.subject_id === 'tic2');
  }
  return CYR_MEDALS_CATALOG.length > 0 ? CYR_MEDALS_CATALOG : MEDALS_CATALOG.filter(m => m.subject_id === 'cyr');
}

export function getMedalById(medalId, subjectId = null) {
  if (subjectId) {
    const list = getMedalsForSubject(subjectId);
    const found = list.find(m => m.id === medalId);
    if (found) return found;
  }
  return MEDALS_CATALOG.find(m => m.id === medalId) || null;
}

// ──────────────────────────────────────────────────────────────────────
//  RANKING DE GREMIOS POR CLASE (ESTRICTAMENTE AISLADO)
// ──────────────────────────────────────────────────────────────────────
export async function getGuildRanking(classId, subjectId) {
  if (!classId) return [];

  const guilds = await loadGuilds(subjectId);
  const { data, error } = await supabase
    .from('class_members')
    .select('student_id, users(id, xp, guild_id, display_name, display_name_anon, avatar)')
    .eq('class_id', classId);

  if (error || !data) return guilds.map(g => ({ ...g, points: 0, members: 0, totalXP: 0 }));

  const counts = {};
  const points = {};
  const membersByGuild = {};

  guilds.forEach(g => {
    counts[g.name] = 0;
    points[g.name] = 0;
    membersByGuild[g.name] = [];
  });

  data.forEach(row => {
    const u = row.users;
    if (!u) return;
    const gName = guilds.find(g => g.id === u.guild_id || g.name === u.guild_id)?.name;
    if (gName && counts[gName] !== undefined) {
      counts[gName]++;
      points[gName] += (u.xp || 0);
      membersByGuild[gName].push({
        uid: u.id,
        displayName: u.display_name,
        displayNameAnonymized: u.display_name_anon,
        photoURL: u.avatar,
        puntosTotal: u.xp || 0
      });
    }
  });

  return guilds.map(g => {
    const gMembers = (membersByGuild[g.name] || []).sort((a,b) => b.puntosTotal - a.puntosTotal);
    return {
      ...g,
      points: points[g.name] || 0,
      totalXP: points[g.name] || 0,
      members: counts[g.name] || 0,
      mvp: gMembers[0] || null,
      memberList: gMembers
    };
  }).sort((a, b) => b.points - a.points);
}

// ──────────────────────────────────────────────────────────────────────
//  XP Y MEDALLAS — ADQUISICIÓN UNIFICADA
// ──────────────────────────────────────────────────────────────────────
export async function addXP(userId, xp, subjectId = null, eventType = null) {
  if (!userId || xp <= 0) return { success: false };

  // Asegurar que las ligas y medallas estén cargadas
  await initGamification();

  const profile = await getUserProfile(userId);
  if (!profile) return { success: false };

  const prevXP     = profile.xp || profile.puntosTotal || 0;
  const newXP      = prevXP + xp;
  const prevLeague = getLeague(prevXP);
  const newLeague  = getLeague(newXP);

  await updateUserProfile(userId, { xp: newXP, puntosTotal: newXP });

  // Evaluar medallas automáticas si aún no las otorgó el trigger SQL
  const sub = subjectId || profile.subject_id;
  const nuevasMedallas = await _evaluarMedallasAutomaticas(userId, newXP, profile.logros || [], sub, eventType);

  const leagueUp = newLeague.id !== prevLeague.id && newXP > prevXP;
  return { success: true, newXP, prevXP, leagueUp, newLeague, prevLeague, nuevasMedallas };
}

export const addXPAndCheckLogros = addXP;
export const addPointsAndCheckLogros = addXP;

export async function awardMedal(userId, medalId, subjectId = null) {
  await initGamification();

  const profile = await getUserProfile(userId);
  if (!profile) return { success: false };

  const logros = profile.logros || [];
  const hasMedal = logros.some(m => (typeof m === 'string' ? m : m.id) === medalId);
  if (hasMedal) return { success: false, alreadyHad: true };

  const medal = getMedalById(medalId, subjectId || profile.subject_id);
  const medalEntry = medal ? {
    id: medal.id,
    name: medal.name,
    icon: medal.icon,
    desc: medal.description || medal.desc,
    fecha: new Date().toISOString()
  } : medalId;

  const newLogros = [...logros, medalEntry];
  const medalXP = (medal && medal.xp_value) ? medal.xp_value : (MEDAL_XP[medalId] || 0);

  const updates = { logros: newLogros };
  if (medalXP > 0) {
    const curXP = profile.xp || profile.puntosTotal || 0;
    updates.xp = curXP + medalXP;
    updates.puntosTotal = curXP + medalXP;
  }

  await updateUserProfile(userId, updates);
  return { success: true, medal: medal || { id: medalId }, xpAwarded: medalXP };
}

async function _evaluarMedallasAutomaticas(userId, newXP, currentLogros, subjectId, eventType = null) {
  const logrosSet = new Set(currentLogros.map(l => typeof l === 'string' ? l : l.id));
  const nuevas = [];

  const xpThresholds = [
    { id: 'novato',     pts: 500 },
    { id: 'aprendiz',   pts: 2000 },
    { id: 'veterano',   pts: 5000 },
    { id: 'maestro_xp', pts: 15000 },
    { id: 'cibernauta', pts: 30000 },
    { id: 'leyenda',    pts: 100000 }
  ];

  for (const t of xpThresholds) {
    if (newXP >= t.pts && !logrosSet.has(t.id)) {
      const res = await awardMedal(userId, t.id, subjectId);
      if (res.success) nuevas.push(res.medal);
    }
  }

  // Medallas temporales (Horario peninsular de Madrid)
  // ÚNICAMENTE para actividades interactivas directas del alumno (juegos y tests).
  // Las tareas offline, exámenes o correcciones del docente NUNCA deben otorgar medallas de horario.
  if (eventType === 'game' || eventType === 'topic_test') {
    const h = parseInt(new Intl.DateTimeFormat('es-ES', { timeZone: 'Europe/Madrid', hour: 'numeric', hour12: false }).format(new Date()), 10);
    const d = new Date().getDay();
    if (h >= 7 && h <= 8 && !logrosSet.has('madrugador')) {
      const r = await awardMedal(userId, 'madrugador', subjectId); if (r.success) nuevas.push(r.medal);
    }
    if (h >= 20 && h < 22 && !logrosSet.has('repaso_nocturno')) {
      const r = await awardMedal(userId, 'repaso_nocturno', subjectId); if (r.success) nuevas.push(r.medal);
    }
    if ((d === 0 || d === 6) && !logrosSet.has('finde')) {
      const r = await awardMedal(userId, 'finde', subjectId); if (r.success) nuevas.push(r.medal);
    }
  }

  return nuevas;
}

// ──────────────────────────────────────────────────────────────────────
//  SUSCRIPCIÓN EN TIEMPO REAL A GAMIFICACIÓN (Supabase Realtime)
// ──────────────────────────────────────────────────────────────────────
let _gamificationChannel = null;

export function initGamificationRealtime(userId, onUpdate = null) {
  if (!userId || _gamificationChannel) return;

  _gamificationChannel = supabase
    .channel(`gamification-user-${userId}`)
    .on('postgres_changes', {
      event: 'UPDATE',
      schema: 'public',
      table: 'users',
      filter: `id=eq.${userId}`
    }, payload => {
      const oldXP = payload.old?.xp || 0;
      const newXP = payload.new?.xp || 0;
      const oldLogros = payload.old?.logros || [];
      const newLogros = payload.new?.logros || [];

      // Detectar subida de liga
      const prevLeague = getLeague(oldXP);
      const newLeague  = getLeague(newXP);
      if (newLeague.id !== prevLeague.id && newXP > oldXP) {
        triggerConfetti();
        showToast('¡Ascenso de Liga! 🏆', `¡Has ascendido a ${newLeague.name}! ${newLeague.icon}`, 'success');
      }

      // Detectar nuevas medallas
      const oldSet = new Set(oldLogros.map(m => typeof m === 'string' ? m : m.id));
      const unlocked = newLogros.filter(m => !oldSet.has(typeof m === 'string' ? m : m.id));
      unlocked.forEach(m => {
        const medalId = typeof m === 'string' ? m : m.id;
        const medalObj = getMedalById(medalId);
        triggerConfetti();
        showToast('¡Medalla Desbloqueada! 🎖️', `¡Has conseguido: ${medalObj?.name || medalId}! ${medalObj?.icon || '⭐'}`, 'success');
      });

      if (typeof onUpdate === 'function') {
        onUpdate({
          user: payload.new,
          xpGained: Math.max(0, newXP - oldXP),
          unlockedMedals: unlocked,
          newLeague
        });
      }
    })
    .subscribe();
}
