import { supabase } from '../../../../../js/common/supabase-config.js';
import { currentUser, currentProfile, updateUserProfileData } from '../../../../../js/common/auth.js';
import { saveGameResult } from '../../../../../js/common/db.js';

const DataService = {
  currentBotId: null,
  currentBotName: '',
  currentBotScript: null,
  currentBotWinRate: 0,
  currentBotWins: 0,
  currentBotLevel: 1,

  setCurrentBot(id, name, script, winRate = 0, wins = 0, level = 1) {
    this.currentBotId = id;
    this.currentBotName = name;
    this.currentBotScript = script;
    this.currentBotWinRate = winRate;
    this.currentBotWins = wins;
    this.currentBotLevel = level;
  },

  clearCurrentBot() {
    this.currentBotId = null;
    this.currentBotName = '';
    this.currentBotScript = null;
    this.currentBotWinRate = 0;
    this.currentBotWins = 0;
    this.currentBotLevel = 1;
  },

  getPlayerName() {
    return currentUser?.displayName || 'Piloto';
  },

  getPlayerColor() {
    return localStorage.getItem('arenabots_player_color') || 'cyan';
  },

  savePlayerColor(color) {
    localStorage.setItem('arenabots_player_color', color);
  },

  getAvatarConfig() {
    try {
      return JSON.parse(localStorage.getItem('arenabots_player_avatar'));
    } catch { return null; }
  },

  saveAvatarConfig(config) {
    localStorage.setItem('arenabots_player_avatar', JSON.stringify(config));
  },

  _packCode(script, color, avatar) {
    const meta = { color: color || 'cyan', avatar: avatar || {} };
    return `// __META__=${JSON.stringify(meta)}\n` + (script || '');
  },

  _unpackBot(rawBot) {
    if (!rawBot) return null;
    let rawCode = rawBot.code || rawBot.script || '';
    let color = 'cyan';
    let avatar = { seed: 'bot', face: 'round01' };

    const metaMatch = rawCode.match(/^\/\/\s*__META__=(.*)$/m);
    if (metaMatch) {
      try {
        const meta = JSON.parse(metaMatch[1]);
        if (meta.color) color = meta.color;
        if (meta.avatar) avatar = meta.avatar;
      } catch (_) {}
    }
    const cleanScript = rawCode.replace(/^\/\/\s*__META__=.*\n?/m, '');

    const wins = rawBot.wins || 0;
    const losses = rawBot.losses || 0;
    const matches = wins + losses;
    const winRate = matches > 0 ? Math.round((wins / matches) * 100) : 0;
    const level = this.calculateLevel(wins, matches);

    return {
      id: rawBot.id,
      name: rawBot.name,
      ownerId: rawBot.owner_id || rawBot.ownerId,
      ownerName: rawBot.users?.display_name || rawBot.ownerName || 'Piloto',
      code: cleanScript,
      script: cleanScript,
      color,
      avatar,
      wins,
      losses,
      matches,
      winRate,
      level,
      public: rawBot.public ?? true,
      createdAt: rawBot.created_at || rawBot.createdAt,
      updatedAt: rawBot.updated_at || rawBot.updatedAt
    };
  },

  // Guardar bot en Supabase table 'arena_bots'
  async saveBot(botData) {
    const user = currentUser;
    if (!user) return { success: false, error: 'No user authenticated' };
    const uid = user.id || user.uid;
    const code = this._packCode(botData.script || botData.code, botData.color, botData.avatar);
    try {
      const { data, error } = await supabase
        .from('arena_bots')
        .insert({
          owner_id: uid,
          name: botData.name,
          code: code,
          wins: 0,
          losses: 0,
          public: true
        })
        .select()
        .single();
      if (error) throw error;
      return { success: true, id: data.id };
    } catch (e) {
      return { success: false, error: e.message };
    }
  },

  async updateBot(botId, botData) {
    try {
      const code = this._packCode(botData.script || botData.code, botData.color, botData.avatar);
      const { error } = await supabase
        .from('arena_bots')
        .update({
          name: botData.name,
          code: code,
          wins: 0,
          losses: 0
        })
        .eq('id', botId);
      if (error) throw error;
      return { success: true };
    } catch (e) {
      return { success: false, error: e.message };
    }
  },

  async getSavedBots() {
    const user = currentUser;
    if (!user) return [];
    const uid = user.id || user.uid;
    try {
      const { data, error } = await supabase
        .from('arena_bots')
        .select('*')
        .eq('owner_id', uid)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data || []).map(b => this._unpackBot(b));
    } catch {
      return [];
    }
  },

  async deleteBot(botId) {
    try {
      const { error } = await supabase
        .from('arena_bots')
        .delete()
        .eq('id', botId);
      if (error) throw error;
      return { success: true };
    } catch (e) {
      return { success: false, error: e.message };
    }
  },

  calculateLevel(wins = 0, matches = 0) {
    const losses = Math.max(0, matches - wins);
    return Math.max(1, Math.floor(wins - (losses / 2)));
  },

  async getRandomOpponent(targetLevel, excludeBotId, targetClassId) {
    try {
      const uid = currentUser?.id || currentUser?.uid;
      let q = supabase.from('arena_bots').select('*, users(display_name)').eq('public', true);
      if (uid) q = q.neq('owner_id', uid);
      if (excludeBotId) q = q.neq('id', excludeBotId);
      const { data, error } = await q.limit(50);
      if (error || !data || data.length === 0) return this.getFallbackSystemBot(targetLevel);
      const bots = data.map(b => this._unpackBot(b));
      const matching = bots.filter(b => b.level === targetLevel);
      const pool = matching.length > 0 ? matching : bots;
      return pool[Math.floor(Math.random() * pool.length)];
    } catch {
      return this.getFallbackSystemBot(targetLevel);
    }
  },

  getFallbackSystemBot(level) {
    return {
      id: 'SYSTEM_BOT', name: 'CPU (Sistema)', color: 'red', ownerId: 'SYSTEM',
      wins: 0, matches: 0, winRate: 0, level: level,
      avatar: { seed: 'cpu1', face: 'round01' },
      script: 'escanear()\ndisparar()\ngirarDerecha()'
    };
  },

  async updateBotStats(botId, isWin) {
    if (!botId || botId === 'SYSTEM_BOT') return;
    try {
      const { data: bot, error } = await supabase
        .from('arena_bots')
        .select('wins, losses')
        .eq('id', botId)
        .maybeSingle();
      if (error || !bot) return;
      const newWins = (bot.wins || 0) + (isWin ? 1 : 0);
      const newLosses = (bot.losses || 0) + (isWin ? 0 : 1);
      await supabase
        .from('arena_bots')
        .update({ wins: newWins, losses: newLosses })
        .eq('id', botId);
    } catch (e) {
      console.error(e);
    }
  },

  async getLeaderboard(limitCount = 20) {
    try {
      const { data, error } = await supabase
        .from('arena_bots')
        .select('*, users(display_name)')
        .eq('public', true);
      if (error || !data) return [];
      const bots = data.map(b => this._unpackBot(b)).filter(b => b.matches > 0);
      bots.sort((a, b) => {
        if (b.winRate !== a.winRate) return b.winRate - a.winRate;
        return (b.wins || 0) - (a.wins || 0);
      });
      return bots.slice(0, limitCount);
    } catch {
      return [];
    }
  },

  async saveMatchResult(res) {
    const isWin = res.outcome === 'victoria';
    await this.updateBotStats(this.currentBotId, isWin);
    const uid = currentUser?.id || currentUser?.uid;
    await saveGameResult('arenabots', uid, null, isWin ? 10 : 0, {
      duration: res.duration || 0,
      turns: res.turnsPlayed || 0,
      outcome: res.outcome
    });
  }
};

export default DataService;

// Ensure currentUser has .uid property for backward compatibility
Object.defineProperty(DataService, 'currentUser', {
  get: () => {
    if (!currentUser) return null;
    if (!currentUser.uid && currentUser.id) currentUser.uid = currentUser.id;
    return currentUser;
  }
});
Object.defineProperty(DataService, 'userProfile', { get: () => currentProfile });

// Auth stubs & helpers
DataService.loginWithGoogle = async () => { return { success: true }; };
DataService.logout = async () => { await supabase.auth.signOut(); };
DataService.updateUserProfile = async (updates) => {
  try {
    await updateUserProfileData(updates);
    return { success: true };
  } catch (e) {
    return { success: false, error: e.message };
  }
};

// Tournament and class methods
DataService.getMyClassId = async () => currentProfile?.classId || currentProfile?.class_id || null;

DataService.getTournament = async (classId) => {
  if (!classId) return null;
  try {
    const { data } = await supabase.from('classes').select('config').eq('id', classId).maybeSingle();
    return data?.config?.tournament || null;
  } catch {
    return null;
  }
};

DataService.enrollTournament = async (classId, bot) => {
  try {
    const uid = currentUser?.id || currentUser?.uid;
    const { data: cls } = await supabase.from('classes').select('config').eq('id', classId).maybeSingle();
    if (!cls) return { success: false, error: 'No tournament found' };
    const config = cls.config || {};
    const tourney = config.tournament;
    if (!tourney) return { success: false, error: 'No tournament found' };
    if (tourney.participants?.find(p => p.userId === uid)) {
      return { success: false, error: 'Already enrolled' };
    }
    const p = { userId: uid, botId: bot.id, snapshotData: bot };
    tourney.participants = [...(tourney.participants || []), p];
    const { error } = await supabase.from('classes').update({ config }).eq('id', classId);
    if (error) throw error;
    return { success: true };
  } catch (e) {
    return { success: false, error: e.message };
  }
};

DataService.createTournament = async (classId, name) => {
  try {
    const { data: cls } = await supabase.from('classes').select('config').eq('id', classId).maybeSingle();
    const config = cls?.config || {};
    config.tournament = {
      classId,
      name,
      status: 'inscription',
      participants: [],
      bracket: []
    };
    const { error } = await supabase.from('classes').update({ config }).eq('id', classId);
    if (error) throw error;
    return { success: true };
  } catch (e) {
    return { success: false, error: e.message };
  }
};

DataService.updateTournament = async (classId, data) => {
  try {
    const { data: cls } = await supabase.from('classes').select('config').eq('id', classId).maybeSingle();
    const config = cls?.config || {};
    config.tournament = { ...(config.tournament || {}), ...data };
    const { error } = await supabase.from('classes').update({ config }).eq('id', classId);
    if (error) throw error;
    return { success: true };
  } catch (e) {
    return { success: false, error: e.message };
  }
};

DataService.getTeacherClasses = async () => {
  try {
    const uid = currentUser?.id || currentUser?.uid;
    const { data } = await supabase.from('classes').select('*').eq('teacher_id', uid);
    return data || [];
  } catch {
    return [];
  }
};
