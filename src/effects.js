// ── effects.js  Visual effects: floating text, particles, muzzle flash ────────
import { scene, c3, makeCanvasTex } from './engine.js';
import { activeFloatingTexts, activeSpeechBubbles } from './state.js';

// ── Floating combat text ──────────────────────────────────────────────────────
function createTextTexture(text, colorHex) {
  return makeCanvasTex(256, 64, (ctx) => {
    ctx.clearRect(0, 0, 256, 64);
    ctx.font = 'bold 36px Arial';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.strokeStyle = '#000';
    ctx.lineWidth = 4;
    ctx.strokeText(text, 128, 32);
    ctx.fillStyle = '#' + colorHex.toString(16).padStart(6, '0');
    ctx.fillText(text, 128, 32);
  });
}

export function spawnFloatingText(text, position, colorHex = 0xffffff) {
  const tex = createTextTexture(text, colorHex);
  const mat = new BABYLON.StandardMaterial('ftm', scene);
  mat.diffuseTexture = tex;
  mat.emissiveTexture = tex;
  mat.hasAlpha = true;
  mat.disableLighting = true;
  tex.hasAlpha = true;

  const m = BABYLON.MeshBuilder.CreatePlane('ft', { width: 1.6, height: 0.4 }, scene);
  m.material = mat;
  m.position.copyFrom(position);
  m.position.y += 2.2;
  m.billboardMode = BABYLON.Mesh.BILLBOARDMODE_ALL;
  m.isPickable = false;

  activeFloatingTexts.push({ mesh: m, life: 1.2, vy: 1.2 });
}

export function updateFloatingTexts(dt) {
  for (let i = activeFloatingTexts.length - 1; i >= 0; i--) {
    const ft = activeFloatingTexts[i];
    ft.life -= dt;
    ft.mesh.position.y += ft.vy * dt;
    ft.vy *= 0.85;
    const alpha = Math.max(0, ft.life / 1.2);
    ft.mesh.material.alpha = alpha;
    if (ft.life <= 0) {
      ft.mesh.dispose();
      activeFloatingTexts.splice(i, 1);
    }
  }
}

// ── Impact particles ──────────────────────────────────────────────────────────
const _particleMatCache = new Map();
function _getParticleMat(colorHex) {
  if (_particleMatCache.has(colorHex)) return _particleMatCache.get(colorHex);
  const mat = new BABYLON.StandardMaterial('pm_' + colorHex, scene);
  mat.emissiveColor = c3(colorHex);
  mat.disableLighting = true;
  _particleMatCache.set(colorHex, mat);
  return mat;
}

export function spawnImpactParticles(position, colorHex = 0xff4400, count = 8) {
  const sharedMat = _getParticleMat(colorHex);
  for (let i = 0; i < count; i++) {
    const mat = sharedMat;

    const p = BABYLON.MeshBuilder.CreateSphere('part', { diameter: 0.08, segments: 3 }, scene);
    p.material = mat;
    p.position.copyFrom(position);
    const vel = new BABYLON.Vector3(
      (Math.random() - 0.5) * 6,
      Math.random() * 5 + 2,
      (Math.random() - 0.5) * 6
    );
    const life = { val: 0.5 + Math.random() * 0.3 };
    const start = life.val;

    const obs = scene.onBeforeRenderObservable.add(() => {
      const dt = scene.getEngine().getDeltaTime() / 1000;
      life.val -= dt;
      p.position.addInPlace(vel.scale(dt));
      vel.y -= 12 * dt;
      p.visibility = Math.max(0, life.val / start);
      if (life.val <= 0) {
        p.dispose();
        scene.onBeforeRenderObservable.remove(obs);
      }
    });
  }
}

// ── Death burst ───────────────────────────────────────────────────────────────
export function spawnDeathBurst(position, killEffectKey = 'default') {
  if (killEffectKey === 'gold') {
    spawnImpactParticles(position, 0xffd700, 24);
    spawnFloatingText('💰', position, 0xffd700);
  } else if (killEffectKey === 'confetti') {
    const colors = [0xff4466, 0x44ffaa, 0xffff44, 0x44aaff, 0xff88ff];
    colors.forEach(c => spawnImpactParticles(position, c, 6));
    spawnFloatingText('🎉', position, 0xffffff);
  } else if (killEffectKey === 'lightning') {
    spawnImpactParticles(position, 0x88aaff, 20);
    spawnImpactParticles(position, 0xffffff, 10);
    spawnFloatingText('⚡', position, 0x88aaff);
  } else {
    spawnImpactParticles(position, 0xff2200, 16);
    spawnFloatingText('💀', position, 0xff4400);
  }
}

// ── Muzzle flash ──────────────────────────────────────────────────────────────
export function spawnMuzzleFlash(position) {
  const mat = new BABYLON.StandardMaterial('mf', scene);
  mat.emissiveColor = new BABYLON.Color3(1, 0.92, 0.65);
  mat.disableLighting = true;
  mat.alpha = 0.85;

  const m = BABYLON.MeshBuilder.CreatePlane('mflash', { size: 0.45 }, scene);
  m.material = mat;
  m.position.copyFrom(position);
  m.billboardMode = BABYLON.Mesh.BILLBOARDMODE_ALL;
  m.isPickable = false;

  const fl = new BABYLON.PointLight('fl', position.clone(), scene);
  fl.diffuse = new BABYLON.Color3(1, 0.9, 0.6);
  fl.intensity = 4;
  fl.range = 8;

  setTimeout(() => {
    if (!m.isDisposed()) m.dispose();
    if (!fl.isDisposed()) fl.dispose();
  }, 55);
}

// ── Bullet trail ──────────────────────────────────────────────────────────────
export function spawnBulletTrail(from, to, trailKey = 'default') {
  const colors = {
    default: 0xffee44,
    blue:    0x44aaff,
    gold:    0xffd700,
    red:     0xff3300,
    rainbow: Math.floor(Math.random() * 0xffffff),
  };
  const color = colors[trailKey] || colors.default;
  const dir = to.subtract(from);
  const len = dir.length();
  if (len < 0.1) return;
  const mat = new BABYLON.StandardMaterial('trail', scene);
  mat.emissiveColor = c3(color);
  mat.disableLighting = true;
  mat.alpha = 0.6;
  const m = BABYLON.MeshBuilder.CreateCylinder('trail', { height: len, diameter: 0.05, tessellation: 4 }, scene);
  m.material = mat;
  const mid = from.add(to).scale(0.5);
  m.position.copyFrom(mid);
  m.lookAt(to);
  m.rotation.x += Math.PI / 2;
  setTimeout(() => { if (!m.isDisposed()) m.dispose(); }, 80);
}

// ── Gold / silver deflect sparks ──────────────────────────────────────────────
export function spawnDeflectSparks(position, isVip = false) {
  spawnImpactParticles(position, isVip ? 0xffd700 : 0xc0c8e8, isVip ? 14 : 8);
}

// ── Freeze effect ─────────────────────────────────────────────────────────────
export function spawnFreezeEffect(position) {
  spawnImpactParticles(position, 0xaaddff, 20);
  spawnFloatingText('❄️ FROZEN!', position, 0xaaddff);
}

// ── Shield burst ──────────────────────────────────────────────────────────────
export function spawnShieldBurst(position) {
  spawnImpactParticles(position, 0x4488ff, 12);
  spawnImpactParticles(position, 0xffffff, 6);
}

// ── Nuke wave ─────────────────────────────────────────────────────────────────
export function spawnNukeEffect(position) {
  for (let r = 0; r < 5; r++) {
    setTimeout(() => {
      const angle = Math.random() * Math.PI * 2;
      const spread = r * 8;
      const pos = new BABYLON.Vector3(
        position.x + Math.cos(angle) * spread,
        0.5,
        position.z + Math.sin(angle) * spread
      );
      spawnImpactParticles(pos, 0xff6600, 12);
      spawnImpactParticles(pos, 0xffcc00, 8);
    }, r * 200);
  }
  spawnFloatingText('☢️ NUKE!', position, 0xff8800);
}

// ── Combo text ────────────────────────────────────────────────────────────────
export function spawnComboText(position, combo) {
  const colors = [0xffffff, 0xffff44, 0xff8844, 0xff4444, 0xff44ff, 0x44ffff];
  const col = colors[Math.min(combo - 2, colors.length - 1)] || 0xffffff;
  spawnFloatingText(`x${combo} COMBO!`, position, col);
}

// ── Rank-up text ──────────────────────────────────────────────────────────────
export function spawnRankUpText(position, rankName) {
  spawnFloatingText(`RANK UP! ${rankName}`, position, 0xffd700);
}

// ── Speech bubbles ────────────────────────────────────────────────────────────
function createBubbleTex(text, isPlayer) {
  return makeCanvasTex(512, 152, (ctx, w, h) => {
    const bg = isPlayer ? '#1a3a6b' : '#6b1a1a';
    const border = isPlayer ? '#4a9eff' : '#ff4a4a';
    ctx.fillStyle = bg;
    ctx.strokeStyle = border;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.roundRect(4, 4, w - 8, h - 30, 14);
    ctx.fill(); ctx.stroke();
    ctx.beginPath();
    if (isPlayer) {
      ctx.moveTo(60, h - 26); ctx.lineTo(44, h - 4); ctx.lineTo(84, h - 26);
    } else {
      ctx.moveTo(w - 60, h - 26); ctx.lineTo(w - 44, h - 4); ctx.lineTo(w - 84, h - 26);
    }
    ctx.fillStyle = bg; ctx.fill();
    ctx.strokeStyle = border; ctx.stroke();
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 22px Arial';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const maxW = w - 24;
    const words = text.split(' ');
    let line = '', y = 36;
    words.forEach(word => {
      const test = line ? line + ' ' + word : word;
      if (ctx.measureText(test).width > maxW) {
        ctx.fillText(line, w / 2, y); y += 28; line = word;
      } else line = test;
    });
    if (line) ctx.fillText(line, w / 2, y);
  });
}

export function spawnSpeechBubble(text, anchorMesh, isPlayer) {
  const tex = createBubbleTex(text, isPlayer);
  tex.hasAlpha = true;
  const mat = new BABYLON.StandardMaterial('sb', scene);
  mat.diffuseTexture = tex;
  mat.emissiveTexture = tex;
  mat.hasAlpha = true;
  mat.disableLighting = true;

  const m = BABYLON.MeshBuilder.CreatePlane('bubble', { width: 2.6, height: 0.78 }, scene);
  m.material = mat;
  m.billboardMode = BABYLON.Mesh.BILLBOARDMODE_ALL;
  m.isPickable = false;

  activeSpeechBubbles.push({ mesh: m, anchor: anchorMesh, life: 5.0 });
}

export function updateSpeechBubbles(dt) {
  for (let i = activeSpeechBubbles.length - 1; i >= 0; i--) {
    const sb = activeSpeechBubbles[i];
    sb.life -= dt;
    if (sb.anchor && !sb.anchor.isDisposed()) {
      const pos = sb.anchor.getAbsolutePosition ? sb.anchor.getAbsolutePosition() : sb.anchor.position;
      sb.mesh.position.set(pos.x, pos.y + 3.2, pos.z);
    }
    const alpha = sb.life < 1 ? sb.life : 1;
    if (sb.mesh.material) sb.mesh.material.alpha = alpha;
    if (sb.life <= 0) {
      sb.mesh.dispose();
      activeSpeechBubbles.splice(i, 1);
    }
  }
}

// ── Powerup mesh ──────────────────────────────────────────────────────────────
export const POWERUP_TYPES = {
  health:        { color: 0x4cff6e, icon: '❤️',  label: 'Health' },
  speed:         { color: 0x4cc9ff, icon: '⚡',  label: 'Speed Boost' },
  damage:        { color: 0xff4c4c, icon: '🔥',  label: 'Damage Boost' },
  rapidfire:     { color: 0xffd24c, icon: '⏱️',  label: 'Rapid Fire' },
  shield:        { color: 0x4488ff, icon: '🛡️',  label: 'Shield Bubble' },
  freeze:        { color: 0xaaddff, icon: '❄️',  label: 'Freeze Bomb' },
  scoremult:     { color: 0xffaa00, icon: '🎰',  label: 'Score x2' },
  coinmagnet:    { color: 0xffd700, icon: '🧲',  label: 'Coin Magnet' },
  doublecoins:   { color: 0xffcc44, icon: '💰',  label: 'Double Coins' },
  ammobox:       { color: 0x88cc44, icon: '📦',  label: 'Ammo Box' },
  nuke:          { color: 0xff6600, icon: '☢️',  label: 'Nuke Strike' },
};

export function createPowerupMesh(type) {
  const def = POWERUP_TYPES[type] || POWERUP_TYPES.health;
  const mat = new BABYLON.PBRMaterial('pu', scene);
  mat.albedoColor = c3(def.color);
  mat.emissiveColor = c3(def.color).scale(0.9);
  mat.roughness = 0.25; mat.metallic = 0.3;

  const m = BABYLON.MeshBuilder.CreatePolyhedron('pu', { type: 1, size: 0.45 }, scene);
  m.material = mat;
  m.position.y = 1.2;
  m.isPickable = false;
  m._puType = type;
  m._puBobPhase = Math.random() * Math.PI * 2;
  return m;
}
