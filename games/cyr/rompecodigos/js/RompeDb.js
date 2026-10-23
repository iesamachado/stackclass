// ═══════════════════════════════════════════════════════════════════════
//  STACKCLASS — RompeCódigos Database Adapter (Supabase)
//  Gestiona sesiones multijugador, rondas, equipos e intentos en tiempo real.
// ═══════════════════════════════════════════════════════════════════════

import { supabase } from '../../../../js/common/supabase-config.js';
import { saveGameResult } from '../../../../js/common/db.js';

export function formatSession(row) {
  if (!row) return null;
  const cfg = row.config || {};
  return {
    id: row.pin,
    pin: row.pin,
    codigo: row.pin,
    status: row.status,
    estado: cfg.estado || (row.status === 'running' ? 'en_curso' : (row.status === 'finished' ? 'finalizada' : 'espera')),
    profesorUID: cfg.profesorUID || row.host_id,
    profesorNombre: cfg.profesorNombre || 'Profesor',
    rondaActual: cfg.rondaActual || 0,
    totalRondas: cfg.totalRondas || 0,
    duracionRonda: cfg.duracionRonda || 300,
    tiempoRestante: cfg.tiempoRestante !== undefined ? cfg.tiempoRestante : (cfg.duracionRonda || 300),
    dificultad: cfg.dificultad || 'facil',
    pistasDisponibles: cfg.pistasDisponibles !== undefined ? cfg.pistasDisponibles : 2,
    rondas: cfg.rondas || {},
    equipos: cfg.equipos || {}
  };
}

export function listenSession(pin, onChange) {
  if (!pin) return () => {};
  const channelName = `live_rompecodigos_${pin}_${Date.now()}`;

  // Carga inicial inmediata
  supabase.from('live_sessions').select('*').eq('pin', pin).maybeSingle()
    .then(({ data }) => {
      if (data) onChange(formatSession(data));
    })
    .catch(err => console.warn('Error fetching live session:', err));

  const channel = supabase
    .channel(channelName)
    .on('postgres_changes', {
      event: '*',
      schema: 'public',
      table: 'live_sessions',
      filter: `pin=eq.${pin}`
    }, (payload) => {
      if (payload.new) onChange(formatSession(payload.new));
    })
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
}

export async function createSession({ codigo, hostId, hostNombre, totalRondas, duracionRonda, dificultad, pistasDisponibles, rondas }) {
  const rondasMap = {};
  rondas.forEach(r => {
    rondasMap[r.numero.toString()] = r;
  });

  const config = {
    codigo,
    profesorUID: hostId,
    profesorNombre: hostNombre,
    estado: 'espera',
    rondaActual: 0,
    totalRondas,
    duracionRonda,
    tiempoRestante: duracionRonda,
    dificultad,
    pistasDisponibles,
    rondas: rondasMap,
    equipos: {}
  };

  const { data, error } = await supabase.from('live_sessions').insert({
    pin: codigo,
    host_id: hostId,
    game_id: 'rompecodigos',
    status: 'lobby',
    config
  }).select().single();

  if (error) throw error;
  return formatSession(data);
}

export async function getSession(pin) {
  const { data, error } = await supabase.from('live_sessions').select('*').eq('pin', pin).maybeSingle();
  if (error) throw error;
  return formatSession(data);
}

export async function updateSessionConfig(pin, updater) {
  const { data: current, error: getErr } = await supabase.from('live_sessions').select('config, status').eq('pin', pin).single();
  if (getErr) throw getErr;

  const currentCfg = current?.config || {};
  const patch = typeof updater === 'function' ? updater(currentCfg) : updater;
  const newConfig = { ...currentCfg, ...patch };

  let status = current.status;
  if (newConfig.estado === 'en_curso') status = 'running';
  else if (newConfig.estado === 'finalizada') status = 'finished';
  else if (newConfig.estado === 'espera') status = 'lobby';

  const { error } = await supabase.from('live_sessions').update({ config: newConfig, status }).eq('pin', pin);
  if (error) throw error;
}

export async function joinSession(pin, teamName, user) {
  const session = await getSession(pin);
  if (!session) throw new Error('Sesión no encontrada');
  if (session.status === 'finished') throw new Error('La sesión ya ha finalizado');

  const uid = user.id || user.uid;
  const displayName = user.displayName || 'Alumno';
  const photo = user.photoURL || null;

  let assignedTeamId = null;

  await updateSessionConfig(pin, (cfg) => {
    const equipos = cfg.equipos || {};
    let found = Object.values(equipos).find(e => e.nombre.toLowerCase() === teamName.toLowerCase());

    const memberObj = { uid, nombre: displayName, foto: photo };

    if (found) {
      if (!found.miembros.some(m => m.uid === uid)) {
        found.miembros.push(memberObj);
      }
      assignedTeamId = found.id;
    } else {
      const eqId = 'eq_' + Math.random().toString(36).substr(2, 9);
      equipos[eqId] = {
        id: eqId,
        nombre: teamName,
        liderUID: uid,
        miembros: [memberObj],
        puntuacion: 0,
        intentos: 0,
        tablaSustitucion: {},
        intentosList: []
      };
      assignedTeamId = eqId;
    }
    return { equipos };
  });

  try {
    await supabase.from('live_participants').upsert({
      session_pin: pin,
      student_id: uid,
      display_name: displayName,
      score: 0,
      progress: 0,
      status: 'waiting',
      metadata: { equipoId: assignedTeamId, equipoNombre: teamName }
    }, { onConflict: 'session_pin,student_id' });
  } catch (_) {}

  return { session, equipoId: assignedTeamId };
}

export async function submitAttempt(pin, teamId, teamNombre, roundNum, proposal, solutionText, studentUid = null) {
  const normA = (proposal || '').toUpperCase().trim().replace(/[^A-ZÁÉÍÓÚÜÑ0-9]/g, '');
  const normB = (solutionText || '').toUpperCase().trim().replace(/[^A-ZÁÉÍÓÚÜÑ0-9]/g, '');
  const correcto = normA === normB && normA.length > 0;

  let pointsEarned = 0;

  await updateSessionConfig(pin, (cfg) => {
    const equipos = cfg.equipos || {};
    const equipo = equipos[teamId];
    const ronda = (cfg.rondas || {})[roundNum.toString()];
    if (!equipo || !ronda) return {};

    const intento = {
      equipo: teamNombre,
      texto: proposal,
      ronda: roundNum,
      correcto,
      timestamp: { seconds: Math.floor(Date.now() / 1000) },
      hora: new Date().toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })
    };

    equipo.intentos = (equipo.intentos || 0) + 1;
    equipo.intentosList = equipo.intentosList || [];
    equipo.intentosList.unshift(intento);

    if (correcto) {
      const rem = cfg.tiempoRestante || 0;
      if (rem > 240) pointsEarned = 150;
      else if (rem > 120) pointsEarned = 100;
      else if (rem > 60) pointsEarned = 75;
      else pointsEarned = 50;

      equipo.puntuacion = (equipo.puntuacion || 0) + pointsEarned;
      ronda.estado = 'finalizada';
      ronda.ganadorEquipo = teamNombre;
    } else {
      equipo.puntuacion = Math.max(0, (equipo.puntuacion || 0) - 5);
    }

    return { equipos, rondas: cfg.rondas };
  });

  if (correcto && studentUid) {
    try {
      await saveGameResult('rompecodigos', studentUid, null, pointsEarned, {
        round: roundNum,
        outcome: 'victoria'
      });
    } catch (_) {}
  }

  return { correcto, points: pointsEarned };
}

export async function updateTeamSubstitution(pin, teamId, substitutionTable) {
  await updateSessionConfig(pin, (cfg) => {
    const equipos = cfg.equipos || {};
    if (equipos[teamId]) {
      equipos[teamId].tablaSustitucion = substitutionTable;
    }
    return { equipos };
  });
}

export async function emitHint(pin, roundNum, tipo, texto) {
  await updateSessionConfig(pin, (cfg) => {
    const rondas = cfg.rondas || {};
    const ronda = rondas[roundNum.toString()];
    if (!ronda) return {};
    ronda.pistas = ronda.pistas || [];
    ronda.pistas.push({ tipo, texto, timestamp: new Date().toISOString() });
    const remPistas = Math.max(0, (cfg.pistasDisponibles || 0) - 1);
    return { rondas, pistasDisponibles: remPistas };
  });
}
