import { db, doc, collection, getDoc, getDocs, setDoc, addDoc, updateDoc, deleteDoc, query, where, orderBy, limit, serverTimestamp } from '../../../../../js/common/firebase-config.js';
import { currentUser, currentProfile } from '../../../../../js/common/auth.js';
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

  // public_bots
  async saveBot(botData) {
    if (!currentUser) return { success: false, error: 'No user' };
    botData.ownerId = currentUser.uid;
    botData.ownerEmail = currentUser.email;
    botData.wins = 0;
    botData.matches = 0;
    botData.winRate = 0;
    botData.level = 1;
    botData.createdAt = serverTimestamp();
    try {
      const ref = await addDoc(collection(db, 'public_bots'), botData);
      return { success: true, id: ref.id };
    } catch (e) {
      return { success: false, error: e.message };
    }
  },

  async updateBot(botId, botData) {
    try {
      botData.updatedAt = serverTimestamp();
      botData.wins = 0; // resets level
      botData.matches = 0;
      botData.winRate = 0;
      botData.level = 1;
      await updateDoc(doc(db, 'public_bots', botId), botData);
      return { success: true };
    } catch (e) {
      return { success: false, error: e.message };
    }
  },

  async getSavedBots() {
    if (!currentUser) return [];
    try {
      const q = query(collection(db, 'public_bots'), where('ownerId', '==', currentUser.uid));
      const snap = await getDocs(q);
      const bots = [];
      snap.forEach(d => bots.push({ id: d.id, ...d.data() }));
      return bots;
    } catch { return []; }
  },

  async deleteBot(botId) {
    try {
      await deleteDoc(doc(db, 'public_bots', botId));
      return { success: true };
    } catch (e) { return { success: false, error: e.message }; }
  },

  calculateLevel(wins = 0, matches = 0) {
    const losses = Math.max(0, matches - wins);
    return Math.max(1, Math.floor(wins - (losses / 2)));
  },

  async getRandomOpponent(targetLevel, excludeBotId, targetClassId) {
    // simplified for brevity
    try {
      const snap = await getDocs(collection(db, 'public_bots'));
      const candidates = [];
      snap.forEach(doc => {
        const d = doc.data();
        if (d.ownerId !== currentUser?.uid && doc.id !== excludeBotId && (d.level || 1) === targetLevel) {
          candidates.push({ id: doc.id, ...d });
        }
      });
      if (candidates.length === 0) return this.getFallbackSystemBot(targetLevel);
      return candidates[Math.floor(Math.random() * candidates.length)];
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
      const botRef = doc(db, 'public_bots', botId);
      const snap = await getDoc(botRef);
      if (snap.exists()) {
        const d = snap.data();
        const m = (d.matches || 0) + 1;
        const w = (d.wins || 0) + (isWin ? 1 : 0);
        await updateDoc(botRef, {
          wins: w, matches: m, winRate: Math.round((w/m)*100), level: this.calculateLevel(w, m)
        });
      }
    } catch (e) { console.error(e); }
  },

  async getLeaderboard(limitCount = 20) {
    try {
      const snap = await getDocs(collection(db, 'public_bots'));
      const bots = [];
      snap.forEach(d => {
        const data = d.data();
        if (data.matches > 0) bots.push({ id: d.id, ...data });
      });
      bots.sort((a,b) => {
        if (b.winRate !== a.winRate) return b.winRate - a.winRate;
        return (b.wins||0) - (a.wins||0);
      });
      return bots.slice(0, limitCount);
    } catch { return []; }
  },

  async saveMatchResult(res) {
    const isWin = res.outcome === 'victoria';
    await this.updateBotStats(this.currentBotId, isWin);
    // Use common db saveGameResult
    await saveGameResult('arenabots', currentUser?.uid, null, isWin ? 10 : 0, {
      duration: res.duration || 0, turns: res.turnsPlayed || 0, outcome: res.outcome
    });
  }
};

export default DataService;
// Export auth stuff so UIManager can use it
Object.defineProperty(DataService, 'currentUser', { get: () => currentUser });
Object.defineProperty(DataService, 'userProfile', { get: () => currentProfile });

// Shims for removed features
DataService.loginWithGoogle = async () => { return { success: true }; };
DataService.logout = async () => {};
DataService.getMyClassId = async () => null; // Use classId from auth if needed, but keeping simple
DataService.updateUserProfile = async () => {};
DataService.getTournament = async () => null;
DataService.enrollTournament = async () => ({ success: false, error: 'Not implemented' });
DataService.connectClassroom = async () => ({ success: false, error: 'Not implemented' });
DataService.getTeacherClasses = async () => [];
DataService.createTournament = async () => ({ success: false, error: 'Not implemented' });
DataService.updateTournament = async () => ({ success: false, error: 'Not implemented' });

// Tournament and class methods using v10 modular
DataService.getMyClassId = async () => currentProfile?.classId || null;

DataService.getTournament = async (classId) => {
  if (!classId) return null;
  try {
    const snap = await getDoc(doc(db, 'tournaments', classId));
    return snap.exists() ? snap.data() : null;
  } catch { return null; }
};

DataService.enrollTournament = async (classId, bot) => {
  try {
    const snap = await getDoc(doc(db, 'tournaments', classId));
    if (!snap.exists()) return { success: false, error: 'No tournament' };
    const data = snap.data();
    if (data.participants?.find(p => p.userId === currentUser.uid)) {
       return { success: false, error: 'Already enrolled' };
    }
    const p = { userId: currentUser.uid, botId: bot.id, snapshotData: bot };
    await updateDoc(doc(db, 'tournaments', classId), {
       participants: [...(data.participants||[]), p]
    });
    return { success: true };
  } catch (e) { return { success: false, error: e.message }; }
};

DataService.createTournament = async (classId, name) => {
  try {
     await setDoc(doc(db, 'tournaments', classId), {
        classId, name, status: 'inscription', participants: [], bracket: []
     });
     return { success: true };
  } catch(e) { return { success: false, error: e.message }; }
};

DataService.updateTournament = async (classId, data) => {
  try {
     await updateDoc(doc(db, 'tournaments', classId), data);
     return { success: true };
  } catch(e) { return { success: false, error: e.message }; }
};

DataService.getTeacherClasses = async () => {
  try {
     const snap = await getDocs(query(collection(db, 'classes'), where('teacherId', '==', currentUser?.uid)));
     const classes = [];
     snap.forEach(d => classes.push({ id: d.id, ...d.data() }));
     return classes;
  } catch { return []; }
};

