import { requireAuth } from './common/auth.js';
import { renderHeader, showToast } from './common/ui.js';
import { $, escapeHtml } from './common/utils.js';
import { getLeague, MEDALS_CATALOG, MEDAL_XP, LEAGUES, GUILDS_CATALOG } from './common/gamification.js';
import { getStudentClasses, getClassMembers } from './common/db.js';
import { db, doc, updateDoc, deleteField } from './common/firebase-config.js';

requireAuth({
  allowedRoles: ['student', 'teacher', 'admin'],
  onAuthorized: async (user, profile) => {
    renderHeader(user, profile);

  // Render hero
  const xp = profile.puntosTotal || 0;
  const league = getLeague(xp);
  const userLogros = profile.logros || [];

  const avatarUrl = profile.photoURL || `https://api.dicebear.com/7.x/bottts/svg?seed=${user.uid}`;
  const displayName = profile.displayName || profile.email?.split('@')[0] || 'Alumno';

  $('logros-avatar').src = avatarUrl;
  $('logros-name').textContent = displayName;
  $('stat-xp').textContent = xp;
  $('stat-league-icon').textContent = league.icon;
  $('stat-league-name').textContent = league.name;
  $('stat-league-card').style.borderColor = league.color;
  $('stat-league-card').style.color = league.color;
  $('stat-medals').textContent = userLogros.length;

  // Render gremios
  await renderGremioSection(user, profile);

  // Render ligas
  renderLeagues(xp, league);

  // Render medallas
  renderMedals(userLogros);

  // Modal de Detalle de XP
  const btnXpDetail = $('btn-xp-detail');
  const modalXpDetail = $('modal-xp-detail');
  if (btnXpDetail && modalXpDetail) {
    $('close-xp-modal').addEventListener('click', () => modalXpDetail.classList.remove('modal-backdrop--visible'));
    modalXpDetail.addEventListener('click', e => { if (e.target === modalXpDetail) modalXpDetail.classList.remove('modal-backdrop--visible'); });
    
    btnXpDetail.addEventListener('click', async () => {
      modalXpDetail.classList.add('modal-backdrop--visible');
      const body = $('xp-modal-body');
      body.innerHTML = '<div style="padding:32px; text-align:center;"><div class="spinner"></div> Calculando tu XP y cargando historial...</div>';
      
      try {
        const { computeGameXP } = await import('./common/gamification.js');
        const { getDocs, getDoc, doc, query, collection, where } = await import('./common/firebase-config.js');
        const { CLASSROOM_TASKS } = await import('./common/tasks.js');
        const { GAMES } = await import('./common/utils.js');
        const GAME_NAMES = Object.fromEntries(Object.values(GAMES).map(g => [g.id, `${g.icon} ${g.name}`]));
        
        const studentId = user.uid;
        let timeline = [];
        
        // 1. Juegos
        const snapGames = await getDocs(query(collection(db, 'game_results'), where('studentId', '==', studentId)));
        const games = snapGames.docs.map(d => ({ id: d.id, ...d.data() }));
        games.sort((a, b) => (a.timestamp?.seconds || 0) - (b.timestamp?.seconds || 0));
        
        const userGamesCount = {};
        const userMaxScores = {};
        const userTotalXP = {};
        games.forEach(r => {
          const gid = r.gameId;
          if (!userGamesCount[gid]) {
            userGamesCount[gid] = 0;
            userMaxScores[gid] = 0;
            userTotalXP[gid] = 0;
          }
          userGamesCount[gid]++;
          const nPartidas = userGamesCount[gid];
          
          const previousMaxScore = nPartidas > 1 ? userMaxScores[gid] : 0;
          
          let xp = computeGameXP(gid, r.score, nPartidas, previousMaxScore);
          
          if (userTotalXP[gid] + xp > 750) {
             xp = Math.max(0, 750 - userTotalXP[gid]);
          }
          userTotalXP[gid] += xp;
          
          if (r.score > userMaxScores[gid]) {
            userMaxScores[gid] = r.score;
          }
          
          timeline.push({
            type: 'game',
            title: GAME_NAMES[gid] || gid,
            scoreInfo: `Puntos: ${r.score}`,
            metadata: r.metadata,
            xp: xp,
            timestamp: r.timestamp?.toDate ? r.timestamp.toDate() : new Date(0)
          });
        });
        
        // 2. Tests de Repaso
        const snapTests = await getDocs(query(collection(db, 'test_teoria_respuestas'), where('uid', '==', studentId)));
        const tests = snapTests.docs.map(d => d.data());
        tests.sort((a, b) => (a.fecha?.seconds || 0) - (b.fecha?.seconds || 0));
        
        const userTestsState = {};
        tests.forEach(r => {
          const topicId = r.topicId;
          const score = r.score;
          if (!userTestsState[topicId]) userTestsState[topicId] = { passed: false, outstanding: false, count: 0 };
          const state = userTestsState[topicId];
          let xp = 0;
          if (score < 3) {
             xp = 0;
          } else {
            if (state.count === 0) {
               xp = 5 + (score >= 5 ? 5 : 0) + (score > 9 ? 5 : 0);
            } else {
               xp = 2 + (score >= 5 ? (state.passed ? 1 : 5) : 0) + (score > 9 ? (state.outstanding ? 1 : 5) : 0);
            }
          }
          if (score >= 5) state.passed = true;
          if (score > 9) state.outstanding = true;
          state.count++;
          
          timeline.push({
            type: 'test',
            title: `📝 Test Repaso (${topicId})`,
            scoreInfo: `Nota: ${score}/10`,
            metadata: null,
            xp: xp,
            timestamp: r.fecha?.toDate ? r.fecha.toDate() : new Date(0)
          });
        });
        
        // 3. Exámenes
        const snapExams = await getDocs(query(collection(db, 'respuestas_test'), where('uid', '==', studentId)));
        snapExams.forEach(d => {
          const r = d.data();
          if (!r.calculado || r.calculado.nota === undefined) return;
          const nota = r.calculado.nota;
          let xp = 5 + (nota >= 5 ? 5 : 0) + (nota > 9 ? 5 : 0);
          
          timeline.push({
            type: 'exam',
            title: `📄 Examen Final`,
            scoreInfo: `Nota: ${nota.toFixed(2)}/10`,
            metadata: null,
            xp: xp,
            timestamp: r.fecha?.toDate ? r.fecha.toDate() : new Date(0)
          });
        });
        
        // 4. Tareas Offline
        const snapOffline = await getDocs(query(collection(db, 'offline_grades'), where('studentId', '==', studentId)));
        snapOffline.forEach(d => {
          const r = d.data();
          if (r.finalGrade === undefined) return;
          let xp = Math.round(r.finalGrade * 15);
          const taskObj = CLASSROOM_TASKS.find(t => t.id === r.taskId);
          const taskName = taskObj ? taskObj.title : r.taskId;
          
          timeline.push({
            type: 'offline',
            title: `📁 Tarea: ${taskName}`,
            scoreInfo: `Nota: ${r.finalGrade}/10`,
            metadata: null,
            xp: xp,
            timestamp: r.updatedAt?.toDate ? r.updatedAt.toDate() : new Date(0)
          });
        });
        

        // 5. Medallas Obtenidas
        const userSnap = await getDoc(doc(db, 'users', studentId));
        const userLogros = userSnap.data()?.logros || [];
        
        // Mapeo de XP para las medallas conocidas
        const MEDAL_XP = {
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
            madrugador: 10, finde: 10, constancia: 10 // Assuming 10 XP for global time medals if any, usually 0 in code but just in case
        };
        
        userLogros.forEach(medal => {
            const extraXP = MEDAL_XP[medal.id] || 0;
            timeline.push({
                type: 'medal',
                title: `🏅 Medalla: ${medal.icon} ${medal.name}`,
                scoreInfo: medal.desc,
                metadata: null,
                xp: extraXP,
                timestamp: medal.fecha ? new Date(medal.fecha) : new Date(0)
            });
        });
        timeline.sort((a, b) => b.timestamp - a.timestamp);
        
        const rows = timeline.length === 0
          ? '<tr><td colspan="4" style="text-align:center;color:var(--text-muted);padding:16px;">Sin actividad registrada.</td></tr>'
          : timeline.map(r => {
              const dateStr = r.timestamp.getTime() > 0 ? r.timestamp.toLocaleDateString('es-ES', { day:'2-digit', month:'short', year:'numeric', hour:'2-digit', minute:'2-digit' }) : '—';
              let detail = r.scoreInfo;
              if (r.type === 'game' && r.metadata) {
                const wpm = r.metadata.wpm ?? '—';
                const acc = r.metadata.accuracy != null ? r.metadata.accuracy + '%' : '—';
                if (wpm !== '—') detail += ` <small style="color:var(--text-muted)">(${wpm} PPM / ${acc})</small>`;
              }

              let xpBadge = '';
              if (r.type === 'medal') {
                  xpBadge = `<span style="display:inline-block; padding:2px 8px; border-radius:12px; font-size:0.8rem; font-weight:bold; background:var(--warning-light); color:var(--warning); border: 1px solid var(--warning);">+${r.xp} XP</span>`;
              } else {
                  xpBadge = `<span style="display:inline-block; padding:2px 8px; border-radius:12px; font-size:0.8rem; font-weight:bold; background:var(--primary-light); color:var(--primary);">+${r.xp} XP</span>`;
              }
              if (r.xp === 0) xpBadge = `<span style="color:var(--text-muted); font-size:0.85rem;">0 XP</span>`;
              
              return `<tr style="border-bottom:1px solid var(--border);">
                <td style="padding:10px 12px; font-weight:500;">${escapeHtml(r.title)}</td>
                <td style="padding:10px 12px;">${detail}</td>
                <td style="padding:10px 12px; text-align:center;">${xpBadge}</td>
                <td style="padding:10px 12px; color:var(--text-muted); font-size:0.85rem;">${dateStr}</td>
              </tr>`;
            }).join('');
            
        body.innerHTML = `
          <table style="width:100%; border-collapse:collapse; font-size:0.9rem;">
            <thead>
              <tr style="border-bottom:2px solid var(--border); background:var(--surface-2); position:sticky; top:0; z-index:10;">
                <th style="padding:10px 12px; text-align:left;">Actividad</th>
                <th style="padding:10px 12px; text-align:left;">Resultado</th>
                <th style="padding:10px 12px; text-align:center;">XP Ganada</th>
                <th style="padding:10px 12px; text-align:left;">Fecha</th>
              </tr>
            </thead>
            <tbody>${rows}</tbody>
          </table>`;
      } catch(e) {
        console.error(e);
        body.innerHTML = `<div style="padding:24px; text-align:center; color:var(--error);">⚠️ Error al cargar el detalle: ${escapeHtml(e.message)}</div>`;
      }
    });
  }
  }
});

export async function renderGremioSection(user, profile) {
  const container = $('gremio-container');
  if (!container) return;
  const mainLayout = document.querySelector('.layout-logros');

  function showGuildConfirm(title, msg, onConfirm) {
    const div = document.createElement('div');
    div.className = 'modal-backdrop modal-backdrop--visible';
    div.innerHTML = `
      <div class="modal-box">
        <div class="modal-header"><h3 style="margin:0;">${title}</h3></div>
        <div class="modal-body">
          <p style="margin-bottom:var(--space-4);">${msg}</p>
          <div style="display:flex; justify-content:flex-end; gap:10px;">
            <button class="btn btn-ghost" onclick="this.closest('.modal-backdrop').remove()">Cancelar</button>
            <button class="btn btn-primary" id="btn-confirm-guild-action">Confirmar</button>
          </div>
        </div>
      </div>
    `;
    document.body.appendChild(div);
    div.querySelector('#btn-confirm-guild-action').addEventListener('click', () => {
      div.remove();
      onConfirm();
    });
  }

  // Registrar funciones globales
  window.leaveGuild = function() {
    showGuildConfirm('Abandonar Gremio', '¿Estás seguro de que quieres abandonar tu gremio? Perderás tu plaza y otro alumno podría ocuparla.', async () => {
      try {
        await updateDoc(doc(db, 'users', user.uid), { gremio: deleteField() });
        profile.gremio = '';
        renderHeader(user, profile);
        await renderGremioSection(user, profile);
        showToast('Gremio abandonado', '', 'info');
      } catch(e) {
        showToast('Error', 'No se pudo abandonar el gremio.', 'error');
      }
    });
  };

  window.joinGuild = function(guildName) {
    showGuildConfirm('Unirse a Gremio', `¿Estás seguro de que quieres unirte a <strong>${escapeHtml(guildName)}</strong>?`, async () => {
      try {
        await updateDoc(doc(db, 'users', user.uid), { gremio: guildName });
        profile.gremio = guildName;
        renderHeader(user, profile);
        await renderGremioSection(user, profile);
        showToast('¡Bienvenido al gremio!', guildName, 'success');
      } catch(e) {
        showToast('Error', 'No se pudo unir al gremio.', 'error');
      }
    });
  };

  // Obtener miembros de la clase para calcular cupos y puntos
  let classMembers = [];
  let totalInClass = 4;
  try {
    const myClasses = await getStudentClasses(user.uid);
    if (myClasses.length > 0) {
      classMembers = await getClassMembers(myClasses[0].id);
      totalInClass = Math.max(4, classMembers.length);
    }
  } catch(e) { console.error('Error obteniendo clase:', e); }

  // Calcular cupos y puntos por gremio
  const maxPerGuild = Math.max(1, Math.ceil(totalInClass / 4));
  const guildCounts = {};
  const guildPoints = {};
  GUILDS_CATALOG.forEach(g => { guildCounts[g.name] = 0; guildPoints[g.name] = 0; });
  classMembers.forEach(m => {
    if (m.gremio && guildCounts[m.gremio] !== undefined) {
      guildCounts[m.gremio]++;
      guildPoints[m.gremio] += (m.puntosTotal || 0);
    }
  });

  const guildRanking = GUILDS_CATALOG.map(g => ({
    name: g.name, icon: g.icon, image: g.image, color: g.color,
    points: guildPoints[g.name] || 0,
    members: guildCounts[g.name] || 0
  })).sort((a,b) => b.points - a.points);

  if (profile.gremio) {
    if (mainLayout) {
      mainLayout.style.flexDirection = '';
      mainLayout.classList.remove('no-guild-layout');
    }
    // TIENE GREMIO: mostrar info del gremio + ranking
    const guildInfo = GUILDS_CATALOG.find(g => g.name === profile.gremio);
    const color = guildInfo?.color || '#6c63ff';
    const icon = guildInfo?.icon || '🛡️';
    const myGuildData = guildRanking.find(g => g.name === profile.gremio);
    const myGuildPos = guildRanking.findIndex(g => g.name === profile.gremio) + 1;
    const myGuildPoints = myGuildData?.points || 0;
    const count = guildCounts[profile.gremio] || 0;

    const membersInMyGuild = classMembers.filter(m => m.gremio === profile.gremio);
    const membersHtml = membersInMyGuild.map(m => `
      <div style="display:flex; align-items:center; gap:8px; background:#f9f9f9; padding:5px 10px; border-radius:20px; border:1px solid #eee;">
        <img src="${escapeHtml(m.photoURL || `https://api.dicebear.com/7.x/bottts/svg?seed=${m.uid}`)}" style="width:24px; height:24px; border-radius:50%;">
        <span style="font-size:0.85rem; font-weight:bold;">${escapeHtml(m.displayNameAnonymized || m.displayName || m.email?.split('@')[0] || 'Alumno')}</span>
      </div>
    `).join('');

    const rankingHtml = guildRanking.map((g, idx) => {
      // Buscar al MVP de este gremio
      const gMembers = classMembers.filter(m => m.gremio === g.name).sort((a,b) => (b.puntosTotal||0) - (a.puntosTotal||0));
      const mvp = gMembers.length > 0 ? gMembers[0] : null;
      let mvpHtml = '';
      if (mvp && mvp.puntosTotal > 0) {
        mvpHtml = `<div style="font-size:0.75rem; color:var(--text-muted); margin-top:2px; margin-left:32px;">
          👑 MVP: <strong style="color:var(--text-primary);">${escapeHtml(mvp.displayNameAnonymized || mvp.displayName || mvp.email?.split('@')[0])}</strong> (${mvp.puntosTotal} XP)
        </div>`;
      }

      // Calcular distancia con el anterior
      let distanceHtml = '';
      if (idx > 0 && guildRanking[idx-1].points > 0) {
        const diff = guildRanking[idx-1].points - g.points;
        if (diff > 0) {
          distanceHtml = `<div style="font-size:0.7rem; font-weight:bold; color:var(--error); margin-top:2px; animation: pulse 2s infinite;">
            🔥 ¡A solo ${diff} XP de subir!
          </div>`;
        }
      }

      return `
        <div class="guild-ranking-row" style="flex-direction:column; align-items:stretch; padding:12px 8px; border-bottom:1px solid var(--border); ${g.name === profile.gremio ? 'background:var(--surface-2,#f9f9f9); border-left:3px solid ' + g.color + ';' : ''}">
          <div style="display:flex; justify-content:space-between; align-items:center;">
            <div style="display:flex; gap:8px; align-items:center;">
              <span style="width:20px; text-align:center;">${idx === 0 ? '🥇' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : `${idx+1}.`}</span>
              <div style="width:24px; height:24px; border-radius:50%; background-color:${g.color}; display:flex; align-items:center; justify-content:center; overflow:hidden; border:1px solid var(--text-primary);">
                <img src="${g.image}" alt="" style="width:100%; height:100%; object-fit:contain; mix-blend-mode:multiply;">
              </div>
              <span style="color:${g.color}; font-weight:${g.name === profile.gremio ? 'bold' : 'normal'};">${escapeHtml(g.name)}</span>
            </div>
            <div style="text-align:right;">
              <span style="color:var(--warning); font-weight:bold;">⭐ ${g.points} XP</span>
            </div>
          </div>
          <div style="display:flex; justify-content:space-between; align-items:flex-start;">
            ${mvpHtml}
            <div style="text-align:right; margin-left:auto;">${distanceHtml}</div>
          </div>
        </div>
      `;
    }).join('');

    container.innerHTML = `
      <div style="display:flex; justify-content:flex-end; margin-bottom:var(--space-3,12px);">
        <button onclick="window.leaveGuild()" class="btn btn-ghost btn--sm" style="color:var(--error,#e74c3c); border:1px solid var(--error,#e74c3c);">🚪 Abandonar gremio</button>
      </div>
      <div style="text-align:center;">
        <div style="margin: 0 auto 15px auto; width: 100px; height: 100px; border-radius: 50%; background-color: ${color}; display: flex; align-items: center; justify-content: center; overflow: hidden; border: 4px solid var(--text-primary); box-shadow: 5px 5px 0px rgba(0,0,0,1);">
          <img src="${guildInfo?.image || ''}" alt="${escapeHtml(profile.gremio)}" style="width: 100%; height: 100%; object-fit: contain; mix-blend-mode: multiply;">
        </div>
        <div style="font-size:1.5rem; font-weight:bold; color:${color};">${escapeHtml(profile.gremio)}</div>
        <div style="margin-top:15px; display:flex; justify-content:center; gap:15px; flex-wrap:wrap;">
          <div style="background:#fdfbf7; border:1px solid #f1c40f; border-radius:8px; padding:8px 15px; text-align:center;">
            <div style="font-size:1.2rem; font-weight:bold; color:#f39c12;">⭐ ${myGuildPoints}</div>
            <div style="font-size:0.75rem; color:#7f8c8d; text-transform:uppercase;">Puntos Gremio</div>
          </div>
          <div style="background:#f4f6f7; border:1px solid #bdc3c7; border-radius:8px; padding:8px 15px; text-align:center;">
            <div style="font-size:1.2rem; font-weight:bold;">#${myGuildPos}</div>
            <div style="font-size:0.75rem; color:#7f8c8d; text-transform:uppercase;">Ranking</div>
          </div>
          <div style="background:#f4f6f7; border:1px solid #bdc3c7; border-radius:8px; padding:8px 15px; text-align:center;">
            <div style="font-size:1.2rem; font-weight:bold;">${count}/${maxPerGuild}</div>
            <div style="font-size:0.75rem; color:#7f8c8d; text-transform:uppercase;">Plazas en tu clase</div>
          </div>
        </div>
        <p style="margin-top:15px; color:var(--text-muted,#888); font-size:0.9rem; max-width:600px; margin-left:auto; margin-right:auto; line-height:1.4;">${escapeHtml(guildInfo?.desc || '')}</p>
        <div style="margin-top:25px; text-align:left; background:var(--bg-card,#fff); padding:15px; border-radius:8px; box-shadow:0 1px 3px rgba(0,0,0,0.05); border-left:3px solid ${color};">
          <h4 style="font-size:0.9rem; margin-bottom:10px; text-transform:uppercase;">👥 Tus compañeros de gremio en tu clase:</h4>
          <div style="display:flex; flex-wrap:wrap; gap:10px;">${membersHtml || '<span style="color:var(--text-muted,#888); font-size:0.85rem;">Aún no hay nadie más en este gremio en tu clase.</span>'}</div>
        </div>
        <div style="margin-top:20px; text-align:left; background:var(--bg-card,#fff); padding:15px; border-radius:8px; box-shadow:0 1px 3px rgba(0,0,0,0.05);">
          <h4 style="font-size:0.9rem; margin-bottom:10px; text-transform:uppercase;">🏆 Ranking de Gremios</h4>
          ${rankingHtml}
        </div>
      </div>
    `;
  } else {
    if (mainLayout) {
      mainLayout.style.flexDirection = '';
      mainLayout.classList.add('no-guild-layout');
    }
    // SIN GREMIO: mostrar selector de gremios
    const cardsHtml = GUILDS_CATALOG.map(g => {
      const count = guildCounts[g.name] || 0;
      const isFull = count >= maxPerGuild;
      return `
        <div class="card" style="display:flex; flex-direction:column; padding:var(--space-3); border-top:5px solid ${g.color}; text-align:center; opacity:${isFull ? '0.6' : '1'}; position:relative;">
          ${isFull ? '<div style="position:absolute; top:5px; right:5px; background:var(--error); color:#fff; padding:2px 6px; font-size:0.6rem; font-weight:bold; border-radius:4px;">LLENO</div>' : ''}
          <div style="margin: 0 auto 10px auto; width: 70px; height: 70px; border-radius: 50%; background-color: ${g.color}; display: flex; align-items: center; justify-content: center; overflow: hidden; border: 3px solid var(--text-primary); box-shadow: 4px 4px 0px rgba(0,0,0,1);">
            <img src="${g.image}" alt="${g.name}" style="width: 100%; height: 100%; object-fit: contain; mix-blend-mode: multiply;">
          </div>
          <h4 style="color:${g.color}; margin-bottom:5px; font-size:1rem;">${escapeHtml(g.name)}</h4>
          <p style="font-size:0.75rem; color:var(--text-muted); flex-grow:1; margin-bottom:10px; line-height:1.2; display:-webkit-box; -webkit-line-clamp:3; -webkit-box-orient:vertical; overflow:hidden;">${escapeHtml(g.desc || '')}</p>
          <div style="background:var(--bg-root); border:1px solid var(--border); padding:2px 8px; font-size:0.75rem; font-weight:bold; margin-bottom:10px; border-radius:4px;">${count}/${maxPerGuild} plazas en clase</div>
          <button class="btn btn-primary btn--sm" style="background:${g.color}; color:#000; width:100%; border:2px solid #000;" ${isFull ? 'disabled' : `onclick="window.joinGuild('${escapeHtml(g.name)}')"`}>
            ${isFull ? 'Cupo máximo' : 'Unirme'}
          </button>
        </div>
      `;
    }).join('');

    container.innerHTML = `
      <div style="text-align:center; margin-bottom:var(--space-4,16px);">
        <h4 style="margin-bottom:5px;">Es hora de elegir tu destino</h4>
        <p style="color:var(--text-muted,#888); font-size:0.9rem;">Los gremios tienen plazas limitadas en tu clase para mantener el equilibrio.</p>
      </div>
      <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(220px,1fr)); gap:var(--space-4,16px);">
        ${cardsHtml}
      </div>
    `;
  }
}

function renderLeagues(currentXp, currentLeague) {
  const container = $('student-leagues-list');
  if (!container) return;

  const sortedLeagues = [...LEAGUES].sort((a,b) => a.pts - b.pts);
  
  const leaguesHtml = sortedLeagues.map((l, index) => {
    const isPast = currentXp >= l.pts;
    const isCurrent = currentLeague.id === l.id;
    const isNext = index > 0 && sortedLeagues[index-1].id === currentLeague.id;
    
    let borderStyle = 'border-bottom: 5px solid var(--border);';
    if (isCurrent) borderStyle = `border-bottom: 5px solid ${l.color}; border-color: ${l.color}; transform: scale(1.05);`;
    else if (isPast) borderStyle = `border-bottom: 5px solid ${l.color};`;

    let html = `
      <div class="card" style="padding:var(--space-4); text-align:center; transition:all 0.3s; ${borderStyle} opacity: ${isPast ? 1 : 0.6}; filter: ${isPast ? 'none' : 'grayscale(100%)'};">
        <div style="font-size:2rem; margin-bottom:10px;">${l.icon}</div>
        <h4 style="color:${isCurrent ? l.color : (isPast ? 'var(--text-secondary)' : 'var(--text-muted)')}; margin-bottom:5px;">${escapeHtml(l.name)}</h4>
        <div style="font-size:0.8rem; color:var(--text-muted);">${l.pts} XP</div>
    `;

    if (isCurrent) {
      const nextL = sortedLeagues[index + 1];
      if (nextL) {
        const required = nextL.pts - l.pts;
        const progress = currentXp - l.pts;
        const pct = Math.min(100, Math.max(0, (progress / required) * 100));
        html += `
          <div style="width:100%; height:8px; background:var(--bg-root); border-radius:4px; margin-top:15px; overflow:hidden; border:1px solid var(--border);">
            <div style="width:${pct}%; height:100%; background:${l.color};"></div>
          </div>
          <div style="font-size:0.75rem; color:var(--text-muted); margin-top:5px; font-weight:bold;">Faltan ${nextL.pts - currentXp} XP</div>
        `;
      } else {
        html += `<div style="font-size:0.8rem; font-weight:bold; color:var(--warning); margin-top:15px; background:var(--warning-subtle); padding:4px; border-radius:4px;">¡Liga Máxima!</div>`;
      }
    } else if (isPast && !isCurrent) {
       html += `<div style="margin-top:15px; color:var(--success); font-weight:bold; font-size:0.8rem;">✅ Superada</div>`;
    }

    html += `</div>`;
    return html;
  }).join('');

  container.innerHTML = leaguesHtml;
  container.style.display = 'grid';
  container.style.gridTemplateColumns = 'repeat(auto-fit, minmax(140px, 1fr))';
  container.style.gap = 'var(--space-3)';
}

function renderMedals(userLogros) {
  const container = $('student-medals-list');
  if (!container) return;

  const unlockedIds = userLogros.map(l => l.id);
  
  // Sort: Unlocked first, then locked (public first, hidden last)
  const sortedMedals = [...MEDALS_CATALOG].sort((a,b) => {
    const aUnl = unlockedIds.includes(a.id);
    const bUnl = unlockedIds.includes(b.id);
    if (aUnl && !bUnl) return -1;
    if (!aUnl && bUnl) return 1;
    return 0;
  });

  const html = sortedMedals.map(m => {
    const isUnlocked = unlockedIds.includes(m.id);
    let icon = m.icon;
    let name = m.name;
    let desc = m.desc;

    if (!isUnlocked && !m.public) {
      icon = '❓';
      name = 'Logro Oculto';
      desc = 'Descubre cómo desbloquearlo jugando...';
    }

    return `
      <div class="card ${isUnlocked ? 'unlocked' : ''}" style="padding:var(--space-3); display:flex; gap:var(--space-3); align-items:center; opacity: ${isUnlocked ? 1 : 0.6}; filter: ${isUnlocked ? 'none' : 'grayscale(100%)'}; transition:all 0.3s; background:${isUnlocked ? 'var(--warning-subtle)' : 'var(--bg-surface)'}; border:2px solid ${isUnlocked ? 'var(--warning)' : 'var(--border)'};">
        <div style="font-size:2.5rem; flex-shrink:0;">${icon}</div>
        <div>
          <h4 style="margin:0 0 5px 0; font-size:1rem; color:${isUnlocked ? 'var(--text-primary)' : 'var(--text-muted)'};">${escapeHtml(name)}</h4>\n          ${MEDAL_XP[m.id] ? `<div style="font-weight:bold; color:var(--warning); margin:4px 0; font-size:0.85rem; background:rgba(243,156,18,0.1); border-radius:4px; padding:2px 4px; display:inline-block;">+${MEDAL_XP[m.id]} XP</div>` : ``}
          <p style="margin:0; font-size:0.85rem; color:var(--text-muted); line-height:1.3;">${escapeHtml(desc)}</p>
          ${isUnlocked ? `<div style="margin-top:5px; font-size:0.75rem; color:var(--success); font-weight:bold;">✓ Desbloqueado</div>` : ''}
        </div>
      </div>
    `;
  }).join('');

  container.innerHTML = `
    <div class="medals-grid-container">
      ${html}
    </div>
  `;
}
