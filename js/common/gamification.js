// ═══════════════════════════════════════════════════════════════════════
//  STACKCLASS — Gamificación (XP, Ligas, Medallas, Gremios)
//  Los catálogos de medallas y gremios se cargan desde Supabase
//  (tabla medals y guilds), filtrados por subject_id.
// ═══════════════════════════════════════════════════════════════════════

import { supabase } from './supabase-config.js';
import { getUserProfile, updateUserProfile, getMedals, getGuilds } from './db.js';

// ──────────────────────────────────────────────────────────────────────
//  LIGAS (globales, idénticas para todas las asignaturas)
// ──────────────────────────────────────────────────────────────────────
export const LEAGUES = [
  { id: 'maestro',  name: 'Liga Maestro',  pts: 25000, icon: '🏆', color: '#f1c40f' },
  { id: 'diamante', name: 'Liga Diamante', pts: 10000, icon: '💎', color: '#00d2d3' },
  { id: 'platino',  name: 'Liga Platino',  pts:  5000, icon: '⭐', color: '#9b59b6' },
  { id: 'oro',      name: 'Liga Oro',      pts:  2000, icon: '🥇', color: '#f39c12' },
  { id: 'plata',    name: 'Liga Plata',    pts:   500, icon: '🥈', color: '#bdc3c7' },
  { id: 'bronce',   name: 'Liga Bronce',   pts:     0, icon: '🥉', color: '#cd6133' }
];

export function getLeague(xp) {
  for (const league of LEAGUES) {
    if (xp >= league.pts) return league;
  }
  return LEAGUES[LEAGUES.length - 1];
}

// ──────────────────────────────────────────────────────────────────────
//  Cache local para no recargar desde Supabase en cada llamada
// ──────────────────────────────────────────────────────────────────────
const _medalsCache  = new Map(); // subjectId → medals[]
const _guildsCache  = new Map(); // subjectId → guilds[]

export async function loadMedals(subjectId) {
  if (_medalsCache.has(subjectId)) return _medalsCache.get(subjectId);
  const medals = await getMedals(subjectId);
  _medalsCache.set(subjectId, medals);
  return medals;
}

export async function loadGuilds(subjectId) {
  if (_guildsCache.has(subjectId)) return _guildsCache.get(subjectId);
  const guilds = await getGuilds(subjectId);
  _guildsCache.set(subjectId, guilds);
  return guilds;
}

export async function getMedalById(medalId, subjectId) {
  const medals = await loadMedals(subjectId);
  return medals.find(m => m.id === medalId) || null;
}

// ──────────────────────────────────────────────────────────────────────
//  XP — Añadir puntos y comprobar logros
// ──────────────────────────────────────────────────────────────────────
export async function addXPAndCheckLogros(userId, xp, subjectId = null) {
  if (!userId || xp <= 0) return { success: false };

  const profile = await getUserProfile(userId);
  if (!profile) return { success: false };

  const prevXP   = profile.xp || 0;
  const newXP    = prevXP + xp;
  const prevLeague = getLeague(prevXP);
  const newLeague  = getLeague(newXP);

  await updateUserProfile(userId, { xp: newXP });

  // Comprobar medallas de progresión por XP
  const sub = subjectId || profile.subject_id;
  if (sub) {
    const newMedals = await _evaluarMedallasPorXP(userId, newXP, profile.logros || [], sub);
    if (newMedals.length) {
      await updateUserProfile(userId, {
        logros: [...new Set([...(profile.logros || []), ...newMedals])]
      });
    }
  }

  const leagueUp = newLeague.id !== prevLeague.id && newXP > prevXP;
  return { success: true, newXP, leagueUp, newLeague, prevLeague };
}

async function _evaluarMedallasPorXP(userId, xp, currentLogros, subjectId) {
  const medals = await loadMedals(subjectId);
  const xpMedals = medals.filter(m => m.description?.includes('Alcanza los'));
  const logrosSet = new Set(currentLogros);
  const nuevas = [];

  for (const medal of xpMedals) {
    if (logrosSet.has(medal.id)) continue;
    // Extraer umbral de XP de la descripción (convención: "Alcanza los X Puntos")
    const match = medal.description.match(/(\d[\d.,]*)/);
    if (!match) continue;
    const threshold = parseInt(match[1].replace(/[.,]/g, ''));
    if (xp >= threshold) {
      nuevas.push(medal.id);
    }
  }
  return nuevas;
}

// ──────────────────────────────────────────────────────────────────────
//  MEDALLAS — Otorgar una medalla
// ──────────────────────────────────────────────────────────────────────
export async function awardMedal(userId, medalId, subjectId = null) {
  const profile = await getUserProfile(userId);
  if (!profile) return { success: false };

  const logros = profile.logros || [];
  if (logros.includes(medalId)) return { success: false, alreadyHad: true };

  const newLogros = [...logros, medalId];
  await updateUserProfile(userId, { logros: newLogros });

  // Añadir XP de la medalla
  const sub = subjectId || profile.subject_id;
  if (sub) {
    const medal = await getMedalById(medalId, sub);
    if (medal?.xp_value > 0) {
      await addXPAndCheckLogros(userId, medal.xp_value, sub);
    }
  }

  return { success: true, medalId };
}

// ──────────────────────────────────────────────────────────────────────
//  GREMIOS — Asignar gremio al alumno
// ──────────────────────────────────────────────────────────────────────
export async function assignGuild(userId, guildId) {
  await updateUserProfile(userId, { guild_id: guildId });
}

export async function getGuildRanking(classId, subjectId) {
  // Obtener todos los miembros de la clase con su gremio y XP
  const { data } = await supabase
    .from('class_members')
    .select('student_id, users(xp, guild_id)')
    .eq('class_id', classId);

  const guilds = await loadGuilds(subjectId);
  const totals = {};

  for (const row of (data || [])) {
    const user = row.users;
    if (!user?.guild_id) continue;
    totals[user.guild_id] = (totals[user.guild_id] || 0) + (user.xp || 0);
  }

  return guilds.map(g => ({
    ...g,
    totalXP: totals[g.id] || 0
  })).sort((a, b) => b.totalXP - a.totalXP);
}

export const addPointsAndCheckLogros = addXPAndCheckLogros;

export const TIC2_MEDALS_CATALOG = [
  // Generales y Progresión
  { id: 'first_blood', name: 'Primera Sangre', desc: 'Resuelve tu primer reto o minijuego.', icon: '🩸', public: true },
  { id: 'novato', name: 'Novato', desc: 'Alcanza los 3500 Puntos de Experiencia.', icon: '🌱', public: true },
  { id: 'aprendiz', name: 'Aprendiz', desc: 'Alcanza los 12000 Puntos de Experiencia.', icon: '🎓', public: true },
  { id: 'veterano', name: 'Veterano', desc: 'Alcanza los 35000 Puntos de Experiencia.', icon: '⚔️', public: true },
  { id: 'leyenda', name: 'Leyenda Viva', desc: 'Alcanza los 100000 Puntos de Experiencia.', icon: '👑', public: true },
  { id: 'perfeccionista', name: 'Perfeccionista', desc: 'Termina un minijuego sin fallos o saca un 10 en un test.', icon: '✨', public: true },

  // Constancia y Tiempo
  { id: 'madrugador', name: 'El Madrugador', desc: 'Completa una actividad entre las 6:00 y las 8:00 AM.', icon: '🌅', public: true },
  { id: 'nocturno', name: 'Ave Nocturna', desc: 'Completa una actividad entre las 00:00 y las 4:00 AM.', icon: '🦉', public: true },
  { id: 'finde', name: 'Sin Descanso', desc: 'Realiza una actividad durante el fin de semana.', icon: '🏖️', public: true },
  { id: 'constancia', name: 'Constancia', desc: 'Entra a TIC2Hub tres días seguidos.', icon: '🔥', public: true },
  { id: 'hora_bruja', name: 'La Hora Bruja', desc: '?????', icon: '👻', public: false }, // Oculto: 3:33 AM
  { id: 'relampago', name: 'Rayo', desc: 'Termina un minijuego en tiempo récord.', icon: '⚡', public: true },

  // Exámenes / Tests
  { id: 'maestro_teoria', name: 'Maestro de la Teoría', desc: 'Saca un 10 absoluto en un examen.', icon: '💯', public: true },
  { id: 'casi_perfecto', name: 'Casi Perfecto', desc: 'Saca un 9 en un examen.', icon: '🎯', public: true },
  { id: 'por_los_pelos', name: 'Por los Pelos', desc: 'Saca exactamente un 5 en un examen.', icon: '😅', public: true },
  { id: 'remontada', name: 'La Remontada', desc: 'Saca más de un 8 habiendo suspendido el anterior.', icon: '📈', public: true },
  { id: 'erudito', name: 'Erudito', desc: 'Realiza 5 exámenes distintos.', icon: '📚', public: true },
  { id: 'suerte_ciega', name: 'Suerte Ciega', desc: '?????', icon: '🎲', public: false }, // Oculto: Aprobar contestando en menos de 1 min

  // Databreach (Ciberseguridad)
  { id: 'hacker_novato', name: 'Hacker Novato', desc: 'Completa el primer nivel de Databreach.', icon: '💻', public: true },
  { id: 'bypass_maestro', name: 'Bypass Maestro', desc: 'Usa una inyección SQL para saltarte un login.', icon: '🔓', public: true },
  { id: 'mr_robot', name: 'Mr. Robot', desc: 'Completa todos los niveles de Databreach.', icon: '🥷', public: true },
  { id: 'inyector_sql', name: 'Inyector SQL', desc: '?????', icon: '💉', public: false }, // Oculto: Usa UNION SELECT
  { id: 'rastro_borrado', name: 'Rastro Borrado', desc: '?????', icon: '🗑️', public: false }, // Oculto: DROP TABLE logs;
  { id: 'curioso_db', name: 'Curiosidad Peligrosa', desc: '?????', icon: '🐈', public: false }, // Oculto: SELECT * FROM passwords;

  // CC Trivial (Propiedad Intelectual)
  { id: 'abogado_novato', name: 'Abogado Junior', desc: 'Acierta 5 preguntas seguidas en CC Trivial.', icon: '⚖️', public: true },
  { id: 'juez_supremo', name: 'Juez Supremo', desc: 'Acierta TODAS las preguntas de CC Trivial.', icon: '👨‍⚖️', public: true },
  { id: 'fair_use', name: 'Fair Use', desc: 'Responde correctamente a la pregunta de Derecho de Cita.', icon: '📝', public: true },
  { id: 'dominio_publico', name: 'Dominio Público', desc: 'Termina el CC Trivial muy rápido.', icon: '⏱️', public: true },
  { id: 'pirata_arrepentido', name: 'Pirata Arrepentido', desc: '?????', icon: '🏴‍☠️', public: false }, // Oculto: Fallar pregunta obvia de piratería

  // Cert Arcade (Certificados)
  { id: 'burocrata', name: 'Burócrata', desc: 'Consigue tu primer certificado en Cert Arcade.', icon: '📜', public: true },
  { id: 'firma_digital', name: 'Firma Digital', desc: 'Tramita 5 firmas correctas seguidas.', icon: '✒️', public: true },
  { id: 'ciudadano_ejemplar', name: 'Ciudadano Ejemplar', desc: 'Consigue más de 500 puntos en Cert Arcade.', icon: '🏛️', public: true },
  { id: 'dnie_master', name: 'DNIe Master', desc: 'Llega al nivel máximo de dificultad en Cert Arcade.', icon: '💳', public: true },
  { id: 'revocado', name: 'Certificado Revocado', desc: '?????', icon: '❌', public: false }, // Oculto: Fallar 3 veces un cert inválido

  // Kanban Hero
  { id: 'agilista', name: 'Agilista', desc: 'Completa un Sprint de Kanban Hero sobreviviendo hasta el final.', icon: '🏃‍♂️', public: true },
  { id: 'multitarea', name: 'Multitarea', desc: 'Mantén el límite de WIP al máximo en Kanban Hero.', icon: '🤹', public: true },
  { id: 'productividad_extrema', name: 'Productividad Extrema', desc: 'Consigue más de 200 puntos en Kanban Hero.', icon: '🚀', public: true },
  { id: 'burnout', name: 'Burnout', desc: '?????', icon: '🔥', public: false }, // Oculto: Dejar que el Todo colapse muy rápido

  // Hex Invaders
  { id: 'matematico', name: 'Matemático', desc: 'Destruye 10 naves en Hex Invaders.', icon: '🧮', public: true },
  { id: 'francotirador_hex', name: 'Francotirador Hex', desc: 'Destruye 5 naves seguidas sin fallar un disparo.', icon: '🎯', public: true },
  { id: 'overflow', name: 'Stack Overflow', desc: 'Consigue más de 1000 puntos en Hex Invaders.', icon: '💥', public: true },
  { id: 'hexadecimal_boss', name: 'Jefe Hexadecimal', desc: 'Supera el nivel 5 en Hex Invaders.', icon: '👾', public: true },
  { id: 'panic_button', name: 'Panic Button', desc: '?????', icon: '😱', public: false }, // Oculto: Disparar a lo loco y fallar 10 seguidas

  // Teoría (Aprobando el test del final del tema)
  { id: 'raton_biblioteca', name: 'Ratón de Biblioteca', desc: 'Aprueba tu primer test de un bloque de teoría.', icon: '📖', public: true },
  { id: 'experto_multimedia', name: 'Productor Multimedia', desc: 'Aprueba el test de Edición Multimedia.', icon: '🎙️', public: true },
  { id: 'experto_multimedia_oro', name: 'Productor de Oro', desc: 'Saca más de un 9 en el test de Edición Multimedia.', icon: '🎧', public: true },
  { id: 'maestro_cms', name: 'Webmaster CMS', desc: 'Aprueba el test de WordPress y SEO.', icon: '🌐', public: true },
  { id: 'maestro_cms_oro', name: 'Webmaster de Oro', desc: 'Saca más de un 9 en el test de WordPress y SEO.', icon: '🌍', public: true },
  { id: 'dev_web', name: 'Desarrollador Web', desc: 'Aprueba el test de HTML y JS.', icon: '🖥️', public: true },
  { id: 'dev_web_oro', name: 'Desarrollador de Oro', desc: 'Saca más de un 9 en el test de HTML y JS.', icon: '💻', public: true },
  { id: 'sysadmin', name: 'Sysadmin', desc: 'Aprueba el test de Ciberseguridad.', icon: '🔒', public: true },
  { id: 'sysadmin_oro', name: 'Sysadmin de Oro', desc: 'Saca más de un 9 en el test de Ciberseguridad.', icon: '🛡️', public: true },
  { id: 'kanban_master', name: 'Scrum Master', desc: 'Aprueba el test de Industria del Software.', icon: '📋', public: true },
  { id: 'kanban_master_oro', name: 'Scrum de Oro', desc: 'Saca más de un 9 en el test de Industria del Software.', icon: '📊', public: true }
];
export const CYR_MEDALS_CATALOG = [
  // Progresión
  { id: 'primer_circuito',     name: 'Primer Circuito',        desc: 'Completa tu primera partida a cualquier juego.',                   icon: '🔌', public: true },
  { id: 'novato',              name: 'Novato Digital',          desc: 'Alcanza los 500 Puntos de Experiencia.',                           icon: '🌱', public: true },
  { id: 'aprendiz',            name: 'Aprendiz Digital',        desc: 'Alcanza los 2.000 Puntos de Experiencia.',                         icon: '🎓', public: true },
  { id: 'veterano',            name: 'Veterano',                desc: 'Alcanza los 5.000 Puntos de Experiencia.',                         icon: '⚔️', public: true },
  { id: 'maestro_xp',         name: 'Maestro Cibernético',     desc: 'Alcanza los 15.000 Puntos de Experiencia.',                        icon: '👑', public: true },
  { id: 'cibernauta',         name: 'Cibernauta',              desc: 'Alcanza los 30.000 Puntos de Experiencia.',                        icon: '🚀', public: true },
  // NetDefender
  { id: 'defensor',           name: 'Defensor',                desc: 'Consigue tu primera puntuación en NetDefender.',                   icon: '🛡️', public: true },
  { id: 'netdefender_300',    name: 'Cortafuegos Activo',      desc: 'Supera los 300 pts en NetDefender.',                               icon: '🔥', public: true },
  { id: 'guardian_red',       name: 'Guardián de la Red',      desc: 'Supera los 500 pts en NetDefender.',                               icon: '🌐', public: true },
  { id: 'netdefender_700',    name: 'SysAdmin',                desc: 'Supera los 700 pts en NetDefender.',                               icon: '🖥️', public: true },
  { id: 'netdefender_1000',   name: 'Dios de la Red',          desc: 'Supera los 1000 pts en NetDefender.',                              icon: '⚡', public: true },
  // MecanoClass
  { id: 'tecleador',          name: 'Tecleador',               desc: 'Juega tu primera partida de MecanoClass.',                         icon: '📝', public: true },
  { id: 'mecanoclass_20',     name: 'Pulsador',                desc: 'Supera las 20 PPM en MecanoClass.',                                icon: '⌨️', public: true },
  { id: 'mecanografo',        name: 'Mecanógrafo',             desc: 'Supera las 40 PPM en MecanoClass.',                                icon: '📝', public: true },
  { id: 'mecanoclass_60',     name: 'Dedos Ágiles',            desc: 'Supera las 60 PPM en MecanoClass.',                                icon: '🏃', public: true },
  { id: 'velocista',          name: 'Velocista',               desc: 'Supera las 70 PPM en MecanoClass.',                                icon: '⚡', public: true },
  { id: 'mecanoclass_100',    name: 'Piano Hacker',            desc: 'Supera las 100 PPM en MecanoClass.',                               icon: '🎹', public: true },
  // RompeCódigos
  { id: 'descifrador',        name: 'Descifrador',             desc: 'Completa RompeCódigos por primera vez.',                           icon: '🔐', public: true },
  { id: 'rompecodigos_200',   name: 'Espía Novato',            desc: 'Supera los 200 pts en RompeCódigos.',                              icon: '🕵️', public: true },
  { id: 'rompecodigos_500',   name: 'Analista de Datos',       desc: 'Supera los 500 pts en RompeCódigos.',                              icon: '📊', public: true },
  { id: 'criptologo',         name: 'Criptólogo',              desc: 'Supera los 800 pts en RompeCódigos.',                              icon: '🔑', public: true },
  { id: 'rompecodigos_1200',  name: 'Enigma Master',           desc: 'Supera los 1200 pts en RompeCódigos.',                             icon: '🧠', public: true },
  // H3L4D0S
  { id: 'heladero',           name: 'Heladero',                desc: 'Completa el primer nivel de H3L4D0S.',                             icon: '🍦', public: true },
  { id: 'programador_bloques',name: 'Programador en Bloques',  desc: 'Supera los 200 pts en H3L4D0S.',                                   icon: '🧩', public: true },
  { id: 'helados_500',        name: 'Heladero Bronce',         desc: 'Consigue más de 500 pts en H3L4D0S.',                              icon: '🥉', public: true },
  { id: 'helados_1000',       name: 'Heladero Plata',          desc: 'Consigue más de 1000 pts en H3L4D0S.',                             icon: '🥈', public: true },
  { id: 'helados_1500',       name: 'Heladero Oro',            desc: 'Consigue más de 1500 pts en H3L4D0S.',                             icon: '🥇', public: true },
  { id: 'helados_2000',       name: 'Heladero Platino',        desc: 'Consigue más de 2000 pts en H3L4D0S.',                             icon: '⭐', public: true },
  { id: 'helados_2500',       name: 'Heladero Diamante',       desc: 'Consigue más de 2500 pts en H3L4D0S.',                             icon: '💎', public: true },
  { id: 'helados_3000',       name: 'Leyenda Heladera',        desc: 'Consigue más de 3000 pts en H3L4D0S.',                             icon: '👑', public: true },
  { id: 'helados_35000',      name: 'Dios de los Helados',     desc: 'Consigue más de 35000 pts en H3L4D0S.',                            icon: '🌟', public: true },
  // MOON
  { id: 'astronauta',         name: 'Astronauta',              desc: 'Completa MOON.',                                                   icon: '🌙', public: true },
  { id: 'moon_3',             name: 'Cadete Espacial',         desc: 'Llega al nivel 3 en MOON.',                                        icon: '🚀', public: true },
  { id: 'explorador_lunar',   name: 'Explorador Lunar',        desc: 'Llega al nivel 5 en MOON.',                                        icon: '🌑', public: true },
  { id: 'moon_10',            name: 'Comandante',              desc: 'Llega al nivel 10 en MOON.',                                       icon: '👨‍🚀', public: true },
  { id: 'moon_15',            name: 'Conquistador Galáctico',  desc: 'Llega al nivel 15 en MOON.',                                       icon: '🌌', public: true },
  // ArenaBots
  { id: 'robotizador',        name: 'Robotizador',             desc: 'Completa tu primera partida en ArenaBots.',                        icon: '🤖', public: true },
  { id: 'arenabots_50',       name: 'Tuerca Floja',            desc: 'Consigue 50 pts en ArenaBots.',                                    icon: '🔧', public: true },
  { id: 'arenabots_100',      name: 'Soldador',                desc: 'Consigue 100 pts en ArenaBots.',                                   icon: '🔥', public: true },
  { id: 'arenabots_150',      name: 'Ingeniero de Combate',    desc: 'Consigue 150 pts en ArenaBots.',                                   icon: '⚔️', public: true },
  { id: 'arquitecto_bot',     name: 'Arquitecto de Robots',    desc: 'Consigue 250 pts en ArenaBots.',                                   icon: '🏆', public: true },
  // CyberSmith
  { id: 'smith',              name: 'CyberSmith',              desc: 'Monta tu primer PC en CyberSmith.',                                icon: '🛠️', public: true },
  { id: 'cybersmith_100',     name: 'Ensamblador',             desc: 'Consigue 100 pts en CyberSmith.',                                  icon: '🪛', public: true },
  { id: 'cybersmith_250',     name: 'Técnico de Hardware',     desc: 'Consigue 250 pts en CyberSmith.',                                  icon: '💻', public: true },
  { id: 'ingeniero',          name: 'Ingeniero',               desc: 'Consigue 400 pts en CyberSmith.',                                  icon: '⚙️', public: true },
  { id: 'cybersmith_600',     name: 'Overclocker',             desc: 'Consigue 600 pts en CyberSmith.',                                  icon: '🚀', public: true },
  // Asimov.IO
  { id: 'etico_ia',           name: 'Ético de la IA',          desc: 'Completa Asimov.IO por primera vez.',                              icon: '⚖️', public: true },
  { id: 'asimov_20',          name: 'Aprendiz de Asimov',      desc: 'Consigue 20 pts en Asimov.IO.',                                    icon: '📖', public: true },
  { id: 'asimov_50',          name: 'Filósofo Sintético',      desc: 'Consigue 50 pts en Asimov.IO.',                                    icon: '🧠', public: true },
  { id: 'leyes_robotica',     name: 'Leyes de la Robótica',    desc: 'Consigue 80 pts en Asimov.IO.',                                    icon: '📜', public: true },
  { id: 'asimov_100',         name: 'Cerebro Positrónico',     desc: 'Consigue 100 pts en Asimov.IO.',                                   icon: '🤖', public: true },
  // AppFlow
  { id: 'dev_app',            name: 'Dev de Apps',             desc: 'Completa AppFlow por primera vez.',                                icon: '📱', public: true },
  { id: 'appflow_50',         name: 'Programador Junior',      desc: 'Consigue 50 pts en AppFlow.',                                      icon: '💻', public: true },
  { id: 'appflow_100',        name: 'Desarrollador Senior',    desc: 'Consigue 100 pts en AppFlow.',                                     icon: '🚀', public: true },
  { id: 'unicornio',          name: 'Unicornio',               desc: 'Consigue 200 pts en AppFlow.',                                     icon: '🦄', public: true },
  { id: 'appflow_300',        name: 'Tech Lead',               desc: 'Consigue 300 pts en AppFlow.',                                     icon: '👑', public: true },
  // Trivial
  { id: 'preguntador',        name: 'Curioso',                 desc: 'Juega tu primera partida de Trivial.',                             icon: '❓', public: true },
  { id: 'trivial_30',         name: 'Estudiante Aplicado',     desc: 'Consigue 30 pts en Trivial.',                                      icon: '📚', public: true },
  { id: 'trivial_60',         name: 'Rata de Biblioteca',      desc: 'Consigue 60 pts en Trivial.',                                      icon: '🐀', public: true },
  { id: 'sabiondo',           name: 'Sabiondo',                desc: 'Consigue 100 pts en Trivial.',                                     icon: '🧠', public: true },
  // Exámenes
  { id: 'primer_examen',      name: 'Primer Examen',           desc: 'Entrega tu primer examen tipo test.',                               icon: '📝', public: true },
  { id: 'maestro_teoria',     name: 'Maestro de la Teoría',    desc: 'Saca un 10 absoluto en un examen.',                                 icon: '💯', public: true },
  { id: 'aprobado_teoria',      name: 'Aprobado Teórico',        desc: 'Saca más de un 5 en un examen.',                               icon: '🎓', public: true },
  { id: 'casi_perfecto',      name: 'Casi Perfecto',           desc: 'Saca un 9 en un examen.',                                           icon: '🎯', public: true },
  { id: 'por_los_pelos',      name: 'Por los Pelos',           desc: 'Saca exactamente un 5 en un examen.',                               icon: '😅', public: true },
  { id: 'remontada',          name: 'La Remontada',            desc: 'Saca más de un 8 habiendo suspendido el examen anterior.',          icon: '📈', public: true },
  { id: 'erudito',            name: 'Erudito',                 desc: 'Realiza 5 exámenes distintos.',                                     icon: '📚', public: true },
  // Tiempo
  { id: 'madrugador',         name: 'El Madrugador',           desc: 'Completa una actividad entre las 6:00 y las 8:00 AM.',              icon: '🌅', public: true },
  { id: 'finde',              name: 'Sin Descanso',            desc: 'Realiza una actividad durante el fin de semana.',                   icon: '🏖️', public: true },
  { id: 'constancia',         name: 'Constancia',              desc: 'Entra a CyR Hub tres días seguidos.',                               icon: '🔥', public: true },
  // Gremios
  { id: 'rey_gremio',         name: 'Rey del Gremio',          desc: 'Tu gremio llega al nº1 en el ranking de la clase.',                 icon: '🥇', public: true },
  { id: 'leal',               name: 'Leal al Gremio',          desc: 'Permanece en tu gremio hasta el fin de la evaluación.',            icon: '🤝', public: true },
  // Ocultas
  { id: 'hora_bruja',         name: '?????',                   desc: 'Completa una actividad a una hora muy especial de la noche...',     icon: '👻', public: false },
  { id: 'nocturno',           name: '?????',                   desc: 'Las mejores ideas llegan de madrugada...',                          icon: '🦉', public: false },
  { id: 'asimov_rebelde',     name: '?????',                   desc: 'A veces las reglas se hacen para romperse...',                      icon: '🤖', public: false },
  { id: 'exterminador',       name: '?????',                   desc: 'Una victoria aplastante e imparable...',                            icon: '💥', public: false },
  { id: 'suerte_ciega',       name: '?????',                   desc: 'La rapidez puede ser una forma de sabiduría...',                    icon: '🎲', public: false },
  { id: 'adicto',             name: '?????',                   desc: 'Dicen que la práctica hace al maestro...',                          icon: '🤓', public: false },
];
export const MEDALS_CATALOG = [...TIC2_MEDALS_CATALOG, ...CYR_MEDALS_CATALOG];

export const TIC2_GUILDS_CATALOG = [
  {
    id: 'turing',
    name: 'La Hermandad de Turing',
    icon: '🗝️',
    image: 'img/turing.png',
    color: '#8e44ad',
    desc: 'Herederos del mismísimo Alan Turing. Maestros de la lógica y la criptografía. Su objetivo es descifrar los secretos mejor guardados del ciberespacio.'
  },
  {
    id: 'lovelace',
    name: 'Los Hijos de Lovelace',
    icon: '⚙️',
    image: 'img/lovelace.png',
    color: '#2980b9',
    desc: 'Bajo el manto de Ada Lovelace, la primera programadora de la historia. Son los arquitectos del código, estructurados, analíticos y elegantes.'
  },
  {
    id: 'hopper',
    name: 'El Escuadrón de Hopper',
    icon: '🐛',
    image: 'img/hopper.png',
    color: '#16a085',
    desc: 'Inspirados en Grace Hopper. Compiladores natos, depuradores incansables y siempre listos para encontrar y aplastar cualquier "bug" en el código.'
  },
  {
    id: 'stallman',
    name: 'La Resistencia de Stallman',
    icon: '🐃',
    image: 'img/stallman.png',
    color: '#e67e22',
    desc: 'Devotos del Software Libre y herederos de la filosofía GNU de Richard Stallman. Luchan por la libertad del código y el conocimiento sin cadenas.'
  }
];
export const CYR_GUILDS_CATALOG = [
  {
    id: 'r2d2',
    name: 'La Brigada R2-D2',
    icon: '🔵',
    image: 'img/gremios/r2d2.png',
    color: '#00bcd4',
    desc: 'Fieles, valientes y siempre listos para la misión. Inspirados en el famoso astromecánico de Star Wars, esta brigada destaca por su lealtad y su capacidad para resolver problemas en los momentos más críticos.'
  },
  {
    id: 'walle',
    name: 'El Colectivo WALL·E',
    icon: '🟠',
    image: 'img/gremios/walle.png',
    color: '#ff9800',
    desc: 'Curiosos, creativos y con un enorme corazón. Como el robot de Pixar, este colectivo valora la creatividad por encima de todo y cree que incluso la tarea más pequeña puede cambiar el mundo.'
  },
  {
    id: 'baymax',
    name: 'La Unidad Baymax',
    icon: '🤍',
    image: 'img/gremios/baymax.png',
    color: '#e53935',
    desc: 'Pacíficos, empáticos y siempre dispuestos a ayudar. Inspirados en el robot asistente médico, los miembros de esta unidad destacan por su compañerismo y su capacidad para sanar los errores del código en equipo.'
  },
  {
    id: 'terminator',
    name: 'La Orden Terminator',
    icon: '💀',
    image: 'img/gremios/terminator.png',
    color: '#607d8b',
    desc: 'Imparables, determinados y forjados en acero. Como el T-800, los miembros de esta orden no conocen el abandono. Una vez que se proponen un objetivo, nada ni nadie puede detenerlos.'
  }
];
export const GUILDS_CATALOG = [...TIC2_GUILDS_CATALOG, ...CYR_GUILDS_CATALOG];

export const MEDAL_XP = {
    netdefender_300: 50, guardian_red: 100, netdefender_700: 150, netdefender_1000: 200,
    mecanoclass_20: 20, mecanografo: 50, mecanoclass_60: 100, velocista: 120, mecanoclass_100: 250,
    rompecodigos_200: 50, rompecodigos_500: 100, criptologo: 150, rompecodigos_1200: 200,
    helados_1000: 100, helados_1500: 150, helados_2000: 200, helados_2500: 250, helados_3000: 300, helados_35000: 1000,
    moon_3: 50, explorador_lunar: 100, moon_10: 150, moon_15: 200,
    arenabots_50: 50, arenabots_100: 100, arenabots_150: 150, arquitecto_bot: 250,
    cybersmith_100: 50, cybersmith_250: 100, ingeniero: 150, cybersmith_600: 200,
    asimov_20: 30, asimov_50: 60, leyes_robotica: 100, asimov_100: 150,
    appflow_50: 50, appflow_100: 100, unicornio: 150, appflow_300: 200,
    trivial_30: 30, trivial_60: 60, sabiondo: 100,
    madrugador: 10, finde: 10, constancia: 10
};
