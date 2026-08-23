// ── ui.js  HUD, minimap, start screen, map picker, messages ──────────────────
import { gs, player, enemies, wallColliders, powerups, RANK_NAMES, ACHIEVEMENT_DEFS } from './state.js';
import { MAPS, loadMap } from './maps/index.js';
import { activeChests } from './chests.js';

// ── Message overlay ───────────────────────────────────────────────────────────
let _msgTimeout = null;

export function showMessage(text, durationMs) {
  const el = document.getElementById('message');
  if (!el) return;
  el.textContent = text;
  el.classList.remove('hidden');
  if (_msgTimeout) { clearTimeout(_msgTimeout); _msgTimeout = null; }
  if (durationMs) _msgTimeout = setTimeout(hideMessage, durationMs);
}

export function hideMessage() {
  const el = document.getElementById('message');
  if (el) el.classList.add('hidden');
}

// ── HUD update ────────────────────────────────────────────────────────────────
export function updateHUD() {
  const hpFill  = document.getElementById('health-bar-fill');
  const hpLabel = document.getElementById('health-label');
  const s  = document.getElementById('score');
  const c  = document.getElementById('coins');
  const lv = document.getElementById('level');
  const hp = Math.max(0, Math.ceil(player.health));
  const hpRatio = hp / player.maxHealth;
  if (hpFill) {
    hpFill.style.width = (hpRatio * 100).toFixed(1) + '%';
    hpFill.style.background = hpRatio > 0.5
      ? 'linear-gradient(90deg, #44dd44, #88ff44)'
      : hpRatio > 0.25
        ? 'linear-gradient(90deg, #ffd24c, #ff8c00)'
        : 'linear-gradient(90deg, #ff3300, #ff6644)';
  }
  if (hpLabel) hpLabel.textContent = `${hp} HP`;
  if (s)  s.textContent  = `Score: ${player.score}`;
  if (c)  c.textContent  = `Coins: ${gs.coins}`;
  if (lv) lv.textContent = `Level: ${gs.level}`;
  const wn = document.getElementById('weapon');
  if (wn && player.weapon) wn.textContent = player.weapon.name;
}

// ── Minimap ───────────────────────────────────────────────────────────────────
const MINIMAP_SCALE = 0.8; // pixels per world-unit

export function drawMinimap(playerPos) {
  const canvas = document.getElementById('minimap-canvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  const w = canvas.width, h = canvas.height;
  const cx = w / 2, cy = h / 2;
  const scale = Math.min(cx, cy) / gs.MAP_RADIUS * 0.92;

  ctx.clearRect(0, 0, w, h);

  // Background
  ctx.fillStyle = 'rgba(0,0,0,0.5)';
  ctx.beginPath();
  ctx.arc(cx, cy, cx, 0, Math.PI * 2);
  ctx.fill();

  // Road bands
  ctx.strokeStyle = '#555';
  ctx.lineWidth = 2;
  gs.activeRoadBands.forEach(rz => {
    const my = cy + rz * scale;
    ctx.beginPath(); ctx.moveTo(0, my); ctx.lineTo(w, my); ctx.stroke();
  });

  // Wall colliders
  ctx.fillStyle = 'rgba(160,160,200,0.35)';
  wallColliders.forEach(wc => {
    const mx = cx + wc.minX * scale;
    const mz = cy + wc.minZ * scale;
    const wd = (wc.maxX - wc.minX) * scale;
    const ht = (wc.maxZ - wc.minZ) * scale;
    ctx.fillRect(mx, mz, wd, ht);
  });

  // Enemies
  ctx.fillStyle = '#ff3300';
  enemies.forEach(e => {
    if (e.health <= 0) return;
    const ex = cx + (e.position.x - playerPos.x) * scale;
    const ez = cy + (e.position.z - playerPos.z) * scale;
    ctx.beginPath(); ctx.arc(ex, ez, 3, 0, Math.PI * 2); ctx.fill();
  });

  // Powerups (cyan dots)
  ctx.fillStyle = '#00eeff';
  powerups.forEach(p => {
    if (!p || p.isDisposed?.()) return;
    const px2 = cx + (p.position.x - playerPos.x) * scale;
    const pz2 = cy + (p.position.z - playerPos.z) * scale;
    ctx.beginPath(); ctx.arc(px2, pz2, 3, 0, Math.PI * 2); ctx.fill();
  });

  // Chests (gold squares)
  ctx.fillStyle = '#ffd700';
  activeChests.forEach(c => {
    if (!c?.root || c.opened) return;
    const cpx = cx + (c.root.position.x - playerPos.x) * scale;
    const cpz = cy + (c.root.position.z - playerPos.z) * scale;
    ctx.fillRect(cpx - 3, cpz - 3, 6, 6);
  });

  // Player (always center, white dot with direction tick)
  ctx.fillStyle = '#ffffff';
  ctx.beginPath(); ctx.arc(cx, cy, 4, 0, Math.PI * 2); ctx.fill();

  // Clip to circle
  ctx.globalCompositeOperation = 'destination-in';
  ctx.beginPath(); ctx.arc(cx, cy, cx - 1, 0, Math.PI * 2); ctx.fill();
  ctx.globalCompositeOperation = 'source-over';
}

// ── Tube countdown overlay ────────────────────────────────────────────────────
export function showTubeCountdown(count, onDone) {
  const el    = document.getElementById('tube-countdown');
  const numEl = document.getElementById('tube-countdown-num');
  const lblEl = document.getElementById('tube-countdown-lbl');
  if (!el || !numEl || !lblEl) { onDone(); return; }
  lblEl.textContent = `${count}v${count} ARENA`;
  el.classList.remove('hidden');
  let n = 3;
  numEl.textContent = n;
  numEl.classList.add('countdown-pop');
  const tick = () => {
    numEl.classList.remove('countdown-pop');
    void numEl.offsetWidth; // force reflow for re-trigger
    n--;
    if (n <= 0) {
      el.classList.add('hidden');
      onDone();
    } else {
      numEl.textContent = n;
      numEl.classList.add('countdown-pop');
      setTimeout(tick, 1000);
    }
  };
  setTimeout(tick, 1000);
}

// ── Start screen → Map picker flow ────────────────────────────────────────────
export function showStartScreen() {
  const ss = document.getElementById('start-screen');
  if (ss) { ss.classList.remove('hidden'); ss.style.display = ''; }
}

export function hideStartScreen() {
  const ss = document.getElementById('start-screen');
  if (ss) ss.classList.add('hidden');
}

export function showMapPicker(onSelect) {
  const el = document.getElementById('map-picker-screen');
  if (!el) return;

  // Rebuild grid cards each time
  const grid = document.getElementById('map-picker-grid');
  if (grid) {
    grid.innerHTML = '';
    Object.entries(MAPS).forEach(([id, def]) => {
      const card = document.createElement('div');
      card.className = 'map-card';

      const name = document.createElement('div');
      name.className = 'map-card-name';
      name.textContent = def.label;
      card.appendChild(name);

      if (def.desc) {
        const desc = document.createElement('div');
        desc.className = 'map-card-desc';
        desc.textContent = def.desc;
        card.appendChild(desc);
      }

      const btn = document.createElement('button');
      btn.className = 'map-card-deploy';
      btn.textContent = 'Deploy';
      btn.addEventListener('click', () => {
        el.classList.add('hidden');
        onSelect(id);
      });
      card.appendChild(btn);
      grid.appendChild(card);
    });
  }

  el.classList.remove('hidden');

  // Custom scrollbar sync
  const thumb = document.getElementById('mp-scroll-thumb');
  const track = document.getElementById('mp-scrollbar');
  const syncThumb = () => {
    if (!grid || !thumb || !track) return;
    const trackH = track.clientHeight;
    const ratio = grid.clientHeight / grid.scrollHeight;
    const thumbH = Math.max(28, ratio * trackH);
    const maxTop = trackH - thumbH;
    const pct = grid.scrollHeight > grid.clientHeight
      ? grid.scrollTop / (grid.scrollHeight - grid.clientHeight) : 0;
    thumb.style.height = thumbH + 'px';
    thumb.style.top = (pct * maxTop) + 'px';
  };
  if (grid._thumbSync) grid.removeEventListener('scroll', grid._thumbSync);
  grid._thumbSync = syncThumb;
  grid.addEventListener('scroll', syncThumb);
  requestAnimationFrame(syncThumb);
}

export function hideMapPicker() {
  const el = document.getElementById('map-picker-screen');
  if (el) el.classList.add('hidden');
}

// ── Interactable proximity prompt ─────────────────────────────────────────────
export function showInteractPrompt(text) {
  let el = document.getElementById('interact-prompt');
  if (!el) {
    el = document.createElement('div');
    el.id = 'interact-prompt';
    document.body.appendChild(el);
  }
  el.textContent = text;
  el.classList.remove('hidden');
}

export function hideInteractPrompt() {
  const el = document.getElementById('interact-prompt');
  if (el) el.classList.add('hidden');
}

// ── Armor bar ─────────────────────────────────────────────────────────────────
export function updateArmorBar() {
  const bar = document.getElementById('armor-bar');
  if (!bar) return;
  const deflect = player.armorDeflectChance || 0;
  bar.style.width = `${Math.min(100, deflect * 100)}%`;
  bar.title = `Deflect ${Math.round(deflect * 100)}%`;
}

// ── Crosshair dot (CSS positioned by main.js) ─────────────────────────────────
export function updateCrosshair(isZoomed) {
  const c = document.getElementById('crosshair');
  if (!c) return;
  c.classList.toggle('zoomed', !!isZoomed);
}

// ── XP bar + rank label ───────────────────────────────────────────────────────
export function updateXPBar() {
  const fill  = document.getElementById('xp-bar-fill');
  const label = document.getElementById('rank-label');
  if (!fill && !label) return;
  const rank = gs.rank || 0;
  const { RANK_XP } = window.__rankXP || {};
  const xpStart = RANK_XP ? (RANK_XP[rank] || 0) : 0;
  const xpEnd   = RANK_XP ? (RANK_XP[rank + 1] || xpStart + 1000) : (xpStart + 1000);
  const pct = Math.min(1, (gs.xp - xpStart) / (xpEnd - xpStart)) * 100;
  if (fill)  fill.style.width = pct + '%';
  if (label) label.textContent = RANK_NAMES ? RANK_NAMES[rank] || `Rank ${rank}` : `Rank ${rank}`;
}

// ── Map name display (flashes on map load) ────────────────────────────────────
export function showMapNameDisplay(name) {
  const el = document.getElementById('map-name-display');
  if (!el) return;
  el.textContent = name;
  el.classList.remove('hidden');
  el.classList.add('map-name-visible');
  setTimeout(() => {
    el.classList.remove('map-name-visible');
    el.classList.add('hidden');
  }, 3000);
}

// ── Pause screen ──────────────────────────────────────────────────────────────
export function showPauseScreen() {
  const el = document.getElementById('pause-screen');
  if (el) el.classList.remove('hidden');
}

export function hidePauseScreen() {
  const el = document.getElementById('pause-screen');
  if (el) el.classList.add('hidden');
}

// ── Stats screen ──────────────────────────────────────────────────────────────
export function showStatsScreen() {
  const el = document.getElementById('stats-screen');
  if (!el) return;
  const s = gs.stats || {};
  el.querySelector('#stats-kills').textContent   = s.allTimeKills    || 0;
  el.querySelector('#stats-hs').textContent       = s.allTimeHeadshots || 0;
  el.querySelector('#stats-coins').textContent    = s.totalCoins      || 0;
  el.querySelector('#stats-score').textContent    = s.bestScore       || 0;
  el.querySelector('#stats-level').textContent    = s.bestLevel       || 0;
  el.querySelector('#stats-shots').textContent    = gs.stats?.shotsTotal || player?.sessionShots || 0;
  el.querySelector('#stats-rank').textContent     = RANK_NAMES[gs.rank] || `Rank ${gs.rank}`;
  el.querySelector('#stats-xp').textContent       = gs.xp             || 0;
  const hs = gs.highScores || [];
  const hsList = el.querySelector('#stats-highscores');
  if (hsList) {
    hsList.innerHTML = hs.slice(0, 10).map((row, i) =>
      `<div class="hs-row"><span class="hs-rank">#${i+1}</span><span class="hs-score">${row.score.toLocaleString()}</span><span class="hs-level">L${row.level}</span></div>`
    ).join('') || '<div class="hs-empty">No scores yet</div>';
  }
  el.classList.remove('hidden');
}

export function hideStatsScreen() {
  const el = document.getElementById('stats-screen');
  if (el) el.classList.add('hidden');
}

// ── Achievements screen ───────────────────────────────────────────────────────
export function showAchievementsScreen() {
  const el = document.getElementById('achievements-screen');
  if (!el) return;
  const list = el.querySelector('#achievements-list');
  if (list) {
    list.innerHTML = Object.entries(ACHIEVEMENT_DEFS).map(([key, def]) => {
      const unlocked = !!(gs.achievements && gs.achievements[key]);
      return `<div class="achievement-row${unlocked ? '' : ' achievement-locked'}">
        <span class="ach-icon">${unlocked ? '🏆' : '🔒'}</span>
        <div class="ach-info">
          <div class="ach-name">${def.name}</div>
          <div class="ach-desc">${def.desc}</div>
        </div>
      </div>`;
    }).join('');
  }
  el.classList.remove('hidden');
}

export function hideAchievementsScreen() {
  const el = document.getElementById('achievements-screen');
  if (el) el.classList.add('hidden');
}
