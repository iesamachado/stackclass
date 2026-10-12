// ═══════════════════════════════════════════════════════════════════════
//  STACKCLASS — Realtime (Supabase Channels)
//  Reemplaza onSnapshot de Firebase para juegos multijugador en vivo.
// ═══════════════════════════════════════════════════════════════════════

import { supabase } from './supabase-config.js';

// Mapa de channels activos para poder unsuscribirse
const _channels = new Map();

/**
 * Escuchar cambios en una sesión en vivo.
 * Equivalente a: onSnapshot(doc(db, 'live_sessions', pin), onChange)
 *
 * @param {string} pin
 * @param {Function} onChange - callback({ new: sessionData })
 * @returns {Function} unsubscribe
 */
export function listenToLiveSession(pin, onChange) {
  const channelName = `live_session_${pin}`;

  const channel = supabase
    .channel(channelName)
    .on('postgres_changes', {
      event: '*',
      schema: 'public',
      table: 'live_sessions',
      filter: `pin=eq.${pin}`
    }, (payload) => {
      onChange(payload.new || payload.old);
    })
    .subscribe();

  _channels.set(channelName, channel);

  return () => {
    supabase.removeChannel(channel);
    _channels.delete(channelName);
  };
}

/**
 * Escuchar cambios en los participantes de una sesión.
 * Equivalente a: onSnapshot(query(participants, where('sessionId','==',pin)), onChange)
 *
 * @param {string} pin
 * @param {Function} onChange - callback(allParticipants[])
 * @returns {Function} unsubscribe
 */
export function listenToLiveParticipants(pin, onChange) {
  const channelName = `live_participants_${pin}`;

  // Estado local de participantes (Supabase Realtime envía cambios individuales)
  let _participants = {};

  const channel = supabase
    .channel(channelName)
    .on('postgres_changes', {
      event: 'INSERT',
      schema: 'public',
      table: 'live_participants',
      filter: `session_pin=eq.${pin}`
    }, (payload) => {
      _participants[payload.new.student_id] = payload.new;
      onChange(Object.values(_participants));
    })
    .on('postgres_changes', {
      event: 'UPDATE',
      schema: 'public',
      table: 'live_participants',
      filter: `session_pin=eq.${pin}`
    }, (payload) => {
      _participants[payload.new.student_id] = payload.new;
      onChange(Object.values(_participants));
    })
    .on('postgres_changes', {
      event: 'DELETE',
      schema: 'public',
      table: 'live_participants',
      filter: `session_pin=eq.${pin}`
    }, (payload) => {
      delete _participants[payload.old.student_id];
      onChange(Object.values(_participants));
    })
    .subscribe();

  _channels.set(channelName, channel);

  return () => {
    supabase.removeChannel(channel);
    _channels.delete(channelName);
  };
}

/**
 * Escuchar cambios en los bots públicos de ArenaBots.
 * @param {Function} onChange
 * @returns {Function} unsubscribe
 */
export function listenToPublicBots(onChange) {
  const channelName = 'public_bots';

  const channel = supabase
    .channel(channelName)
    .on('postgres_changes', {
      event: '*',
      schema: 'public',
      table: 'arena_bots',
      filter: 'public=eq.true'
    }, (payload) => onChange(payload))
    .subscribe();

  _channels.set(channelName, channel);

  return () => {
    supabase.removeChannel(channel);
    _channels.delete(channelName);
  };
}

/**
 * Enviar un mensaje de broadcast a todos los participantes de un canal.
 * Útil para MecanoClass (host → todos) o RompeCódigos (pistas, etc.)
 *
 * @param {string} channelName
 * @param {string} event
 * @param {object} payload
 */
export async function broadcastToChannel(channelName, event, payload) {
  const ch = _channels.get(channelName);
  if (ch) {
    await ch.send({ type: 'broadcast', event, payload });
  }
}

/**
 * Suscribirse a mensajes de broadcast en un canal.
 * @param {string} channelName
 * @param {string} event
 * @param {Function} onMessage
 * @returns {Function} unsubscribe
 */
export function listenToBroadcast(channelName, event, onMessage) {
  const ch = _channels.get(channelName) ||
    supabase.channel(channelName).subscribe();

  ch.on('broadcast', { event }, (msg) => onMessage(msg.payload));

  if (!_channels.has(channelName)) {
    _channels.set(channelName, ch);
  }

  return () => {
    supabase.removeChannel(ch);
    _channels.delete(channelName);
  };
}

/**
 * Desconectar todos los channels activos (llamar al salir de la página)
 */
export function disconnectAll() {
  for (const [name, ch] of _channels.entries()) {
    supabase.removeChannel(ch);
    _channels.delete(name);
  }
}
