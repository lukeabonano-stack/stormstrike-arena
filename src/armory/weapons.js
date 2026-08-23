// ── weapons.js  Gun model builders + weapon stat registry ────────────────────
import { box, cyl, sph, cone, grp, cloneM, pbr, makeCanvasTex } from '../engine.js';
import { equipped, inventory } from '../state.js';
import { SKIN_DEFS } from './skins.js';

const PI = Math.PI;

// ── Default gun materials ─────────────────────────────────────────────────────
export const gunMat       = pbr(0x161b20, 0.16, 0.85);
export const gunDetailMat = pbr(0x8a9ba8, 0.18, 0.95);

// ── Skin pattern textures — canvas-drawn, cached per (pattern, primary,
// detail) combo so repeated equips don't regenerate the same art.
const _patternCache = new Map();
const _hex = (h) => '#' + h.toString(16).padStart(6, '0');

const PATTERN_DRAWERS = {
  camo(ctx, W, H, primary, detail) {
    ctx.fillStyle = _hex(primary); ctx.fillRect(0, 0, W, H);
    let seed = 11; const rng = () => { seed = (seed * 16807) % 2147483647; return (seed & 0xfffffff) / 0xfffffff; };
    const blob = (color) => {
      ctx.fillStyle = color;
      for (let i = 0; i < 14; i++) {
        const cx = rng() * W, cy = rng() * H, r = 18 + rng() * 30;
        ctx.beginPath();
        for (let a = 0; a < Math.PI * 2; a += 0.6) {
          const rr = r * (0.7 + rng() * 0.6);
          const x = cx + Math.cos(a) * rr, y = cy + Math.sin(a) * rr;
          a === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
        }
        ctx.closePath(); ctx.fill();
      }
    };
    blob(_hex(detail));
    blob('rgba(20,20,10,0.55)');
  },
  carbon(ctx, W, H, primary, detail) {
    ctx.fillStyle = _hex(primary); ctx.fillRect(0, 0, W, H);
    const cell = 10;
    for (let y = 0; y < H; y += cell) {
      for (let x = 0; x < W; x += cell) {
        const odd = ((x / cell | 0) + (y / cell | 0)) % 2 === 0;
        ctx.fillStyle = odd ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.25)';
        ctx.fillRect(x, y, cell, cell);
      }
    }
    ctx.strokeStyle = _hex(detail); ctx.globalAlpha = 0.15; ctx.lineWidth = 1;
    for (let d = -H; d < W; d += 14) { ctx.beginPath(); ctx.moveTo(d, 0); ctx.lineTo(d + H, H); ctx.stroke(); }
    ctx.globalAlpha = 1;
  },
  flame(ctx, W, H, primary, detail) {
    ctx.fillStyle = _hex(primary); ctx.fillRect(0, 0, W, H);
    let seed = 5; const rng = () => { seed = (seed * 16807) % 2147483647; return (seed & 0xfffffff) / 0xfffffff; };
    for (let i = 0; i < 9; i++) {
      const baseX = (i / 9) * W + rng() * 20, baseY = H;
      const g = ctx.createLinearGradient(baseX, baseY, baseX + (rng() - 0.5) * 40, baseY - 90 - rng() * 60);
      g.addColorStop(0, _hex(detail)); g.addColorStop(0.5, '#ff8800'); g.addColorStop(1, 'rgba(255,220,0,0)');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.moveTo(baseX - 14, baseY);
      ctx.quadraticCurveTo(baseX - 20, baseY - 60, baseX, baseY - 100 - rng() * 40);
      ctx.quadraticCurveTo(baseX + 20, baseY - 60, baseX + 14, baseY);
      ctx.closePath(); ctx.fill();
    }
  },
  hex(ctx, W, H, primary, detail) {
    ctx.fillStyle = _hex(primary); ctx.fillRect(0, 0, W, H);
    const r = 14, w = r * 2, h = Math.sqrt(3) * r;
    ctx.strokeStyle = _hex(detail); ctx.globalAlpha = 0.5; ctx.lineWidth = 1.5;
    for (let row = 0; row * h * 0.75 < H + h; row++) {
      for (let col = 0; col * w * 0.87 < W + w; col++) {
        const cx = col * w * 0.87, cy = row * h * 0.75 + (col % 2 ? h * 0.375 : 0);
        ctx.beginPath();
        for (let a = 0; a < 6; a++) {
          const px = cx + r * Math.cos(a * Math.PI / 3), py = cy + r * Math.sin(a * Math.PI / 3);
          a === 0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py);
        }
        ctx.closePath(); ctx.stroke();
      }
    }
    ctx.globalAlpha = 1;
  },
  nebula(ctx, W, H, primary, detail) {
    ctx.fillStyle = _hex(primary); ctx.fillRect(0, 0, W, H);
    let seed = 77; const rng = () => { seed = (seed * 16807) % 2147483647; return (seed & 0xfffffff) / 0xfffffff; };
    for (let i = 0; i < 5; i++) {
      const cx = rng() * W, cy = rng() * H, r = 30 + rng() * 50;
      const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
      g.addColorStop(0, _hex(detail) + 'aa'); g.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.fill();
    }
    ctx.fillStyle = '#ffffff';
    for (let i = 0; i < 60; i++) { ctx.globalAlpha = rng() * 0.8; ctx.fillRect(rng() * W, rng() * H, 1.5, 1.5); }
    ctx.globalAlpha = 1;
  },
  veins(ctx, W, H, primary, detail) {
    ctx.fillStyle = _hex(primary); ctx.fillRect(0, 0, W, H);
    let seed = 33; const rng = () => { seed = (seed * 16807) % 2147483647; return (seed & 0xfffffff) / 0xfffffff; };
    ctx.strokeStyle = _hex(detail); ctx.lineWidth = 2; ctx.shadowBlur = 6; ctx.shadowColor = _hex(detail);
    for (let i = 0; i < 8; i++) {
      let x = rng() * W, y = rng() * H;
      ctx.beginPath(); ctx.moveTo(x, y);
      for (let s = 0; s < 6; s++) { x += (rng() - 0.5) * 50; y += (rng() - 0.5) * 50; ctx.lineTo(x, y); }
      ctx.stroke();
    }
    ctx.shadowBlur = 0;
  },
  brushed(ctx, W, H, primary, detail) {
    ctx.fillStyle = _hex(primary); ctx.fillRect(0, 0, W, H);
    let seed = 3; const rng = () => { seed = (seed * 16807) % 2147483647; return (seed & 0xfffffff) / 0xfffffff; };
    for (let y = 0; y < H; y++) {
      ctx.strokeStyle = `rgba(255,255,255,${0.03 + rng() * 0.07})`;
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y + (rng() - 0.5) * 3); ctx.stroke();
    }
  },
};

function getPatternTexture(kind, primary, detail) {
  const key = kind + '|' + primary + '|' + detail;
  if (_patternCache.has(key)) return _patternCache.get(key);
  const tex = makeCanvasTex(256, 256, (ctx) => {
    const drawer = PATTERN_DRAWERS[kind];
    if (drawer) drawer(ctx, 256, 256, primary, detail);
  });
  _patternCache.set(key, tex);
  return tex;
}

// ── Skin-driven materials ─────────────────────────────────────────────────────
export function getEquippedGunMaterials() {
  const skinKey = equipped.skin;
  if (!skinKey || skinKey === 'default') {
    return { primary: gunMat, detail: gunDetailMat };
  }
  const skin = SKIN_DEFS[skinKey];
  if (!skin) {
    return { primary: gunMat, detail: gunDetailMat };
  }
  const opts = {};
  if (skin.emissive !== undefined) {
    opts.emissive = skin.emissive;
    opts.emissiveIntensity = skin.emissiveIntensity !== undefined ? skin.emissiveIntensity : 1;
  }
  const primaryMat = pbr(skin.primary, 0.16, 0.85, opts);
  if (skin.pattern && PATTERN_DRAWERS[skin.pattern]) {
    // NOTE: DynamicTexture.clone() does NOT copy canvas pixel content in this
    // Babylon build (verified — clone comes back fully transparent/blank),
    // so every skin equip shares the one cached texture object directly
    // rather than cloning it. uScale/vScale are constant across all uses, so
    // this costs nothing.
    const tex = getPatternTexture(skin.pattern, skin.primary, skin.detail);
    tex.uScale = 1; tex.vScale = 1.5;
    primaryMat.albedoTexture = tex;
    // albedoColor MULTIPLIES albedoTexture in PBR — pbr() left it as a solid
    // tint (same hex as the texture's own base fill), which was flattening
    // the pattern into a near-uniform block. White passthrough lets the
    // texture's own colors render as-drawn.
    primaryMat.albedoColor = new BABYLON.Color3(1, 1, 1);
    // Keep emissive readable too: a strong flat emissiveColor also washes
    // out texture contrast, so emit through the texture rather than uniformly.
    if (primaryMat.emissiveColor && !primaryMat.emissiveColor.equalsFloats(0, 0, 0)) {
      primaryMat.emissiveTexture = tex;
    }
  }
  return {
    primary: primaryMat,
    detail:  pbr(skin.detail,  0.18, 0.95, opts),
  };
}

// ── Rebuild helper — swaps meshes under an existing TransformNode ─────────────
export function rebuildGunVisual(gunNode, buildFn) {
  gunNode.getDescendants(false).slice().forEach(d => { if (!d.isDisposed()) d.dispose(); });
  gunNode.muzzle = null;
  const temp = buildFn();
  temp.getChildren(null, false).slice().forEach(child => { child.parent = gunNode; });
  gunNode.muzzle = temp.muzzle;
  temp.dispose(true);
}

// ── Gun builder functions ─────────────────────────────────────────────────────

function createSniperGun(mats = { primary: gunMat, detail: gunDetailMat }) {
  const gun = grp('gun');

  const stock = box(0.18, 0.12, 0.36, mats.primary, gun);
  stock.position.z = -0.18;

  const body = box(0.12, 0.08, 0.7, mats.primary, gun);
  body.position.y = 0.01;
  body.position.z = 0.15;

  const barrel = cyl(0.05, 0.05, 0.85, mats.primary, gun, 10);
  barrel.rotation.x = PI / 2;
  barrel.position.z = 0.7;

  const muzzle = grp('muzzle', gun);
  muzzle.position.z = 0.85;
  gun.muzzle = muzzle;

  const scope = cyl(0.08, 0.08, 0.28, mats.detail, gun, 10);
  scope.rotation.x = PI / 2;
  scope.position.x = 0.12;
  scope.position.y = 0.12;
  scope.position.z = 0.15;

  const grip = box(0.08, 0.24, 0.08, mats.detail, gun);
  grip.position.x = 0;
  grip.position.y = -0.12;
  grip.position.z = 0.05;

  return gun;
}

function createPistol(mats = { primary: gunMat, detail: gunDetailMat }) {
  const gun = grp('gun');

  const body = box(0.1, 0.14, 0.32, mats.primary, gun);
  body.position.z = 0.05;

  const barrel = cyl(0.035, 0.035, 0.22, mats.primary, gun, 8);
  barrel.rotation.x = PI / 2;
  barrel.position.y = 0.02;
  barrel.position.z = 0.28;

  const grip = box(0.09, 0.22, 0.1, mats.detail, gun);
  grip.position.y = -0.16;
  grip.position.z = -0.06;
  grip.rotation.x = 0.3;

  const muzzle = grp('muzzle', gun);
  muzzle.position.y = 0.02;
  muzzle.position.z = 0.4;
  gun.muzzle = muzzle;

  return gun;
}

function createShotgun(mats = { primary: gunMat, detail: gunDetailMat }) {
  const gun = grp('gun');

  const stock = box(0.14, 0.14, 0.32, mats.detail, gun);
  stock.position.z = -0.2;
  stock.position.y = -0.01;

  const barrel = cyl(0.07, 0.07, 0.95, mats.primary, gun, 10);
  barrel.rotation.x = PI / 2;
  barrel.position.y = 0.02;
  barrel.position.z = 0.35;

  const pump = box(0.1, 0.09, 0.3, mats.detail, gun);
  pump.position.y = -0.06;
  pump.position.z = 0.3;

  const muzzle = grp('muzzle', gun);
  muzzle.position.y = 0.02;
  muzzle.position.z = 0.85;
  gun.muzzle = muzzle;

  return gun;
}

function createSMG(mats = { primary: gunMat, detail: gunDetailMat }) {
  const gun = grp('gun');

  const body = box(0.1, 0.12, 0.42, mats.primary, gun);
  body.position.z = 0.05;

  const barrel = cyl(0.03, 0.03, 0.3, mats.primary, gun, 8);
  barrel.rotation.x = PI / 2;
  barrel.position.y = 0.02;
  barrel.position.z = 0.42;

  const magazine = box(0.06, 0.26, 0.08, mats.detail, gun);
  magazine.position.y = -0.18;
  magazine.position.z = 0.1;
  magazine.rotation.x = -0.25;

  const stock = box(0.07, 0.08, 0.2, mats.detail, gun);
  stock.position.z = -0.28;

  const muzzle = grp('muzzle', gun);
  muzzle.position.y = 0.02;
  muzzle.position.z = 0.58;
  gun.muzzle = muzzle;

  return gun;
}

function createRocketLauncher(mats = { primary: gunMat, detail: gunDetailMat }) {
  const gun = grp('gun');

  const tube = cyl(0.13, 0.13, 1.1, mats.primary, gun, 12);
  tube.rotation.x = PI / 2;
  tube.position.y = 0.02;
  tube.position.z = 0.35;

  const sight = box(0.05, 0.12, 0.18, mats.detail, gun);
  sight.position.y = 0.16;
  sight.position.z = 0.1;

  const grip = box(0.08, 0.22, 0.08, mats.detail, gun);
  grip.position.y = -0.16;
  grip.position.z = -0.05;
  grip.rotation.x = 0.25;

  const muzzle = grp('muzzle', gun);
  muzzle.position.y = 0.02;
  muzzle.position.z = 0.9;
  gun.muzzle = muzzle;

  return gun;
}

function createMinigun(mats = { primary: gunMat, detail: gunDetailMat }) {
  const gun = grp('gun');

  const drum = cyl(0.2, 0.2, 0.3, mats.detail, gun, 12);
  drum.rotation.x = PI / 2;
  drum.position.y = -0.05;
  drum.position.z = 0.05;

  // Rotating barrel cluster — stored so controls.js can spin it while firing
  const barrelGroup = grp('barrelGroup', gun);
  barrelGroup.position.y = -0.05;
  barrelGroup.position.z = 0.55;
  gun.barrelGroup = barrelGroup;

  for (let i = 0; i < 6; i++) {
    const angle = (i / 6) * PI * 2;
    const b = cyl(0.045, 0.045, 1.1, mats.primary, barrelGroup, 8);
    b.rotation.x = PI / 2;
    b.position.x = Math.cos(angle) * 0.13;
    b.position.y = Math.sin(angle) * 0.13;
    b.position.z = 0;
  }

  const grip = box(0.14, 0.32, 0.14, mats.detail, gun);
  grip.position.y = -0.28;
  grip.position.z = -0.05;
  grip.rotation.x = 0.25;

  const muzzle = grp('muzzle', gun);
  muzzle.position.y = -0.05;
  muzzle.position.z = 1.1;
  gun.muzzle = muzzle;

  return gun;
}

function createBurstRifle(mats = { primary: gunMat, detail: gunDetailMat }) {
  const gun = grp('gun');

  const body = box(0.11, 0.1, 0.55, mats.primary, gun);
  body.position.z = 0.1;

  const barrel = cyl(0.04, 0.04, 0.5, mats.primary, gun, 8);
  barrel.rotation.x = PI / 2;
  barrel.position.y = 0.01;
  barrel.position.z = 0.55;

  const sight = box(0.05, 0.1, 0.12, mats.detail, gun);
  sight.position.y = 0.1;
  sight.position.z = 0.1;

  const grip = box(0.08, 0.2, 0.08, mats.detail, gun);
  grip.position.y = -0.14;
  grip.position.z = -0.1;
  grip.rotation.x = 0.25;

  const mag = box(0.06, 0.22, 0.08, mats.detail, gun);
  mag.position.y = -0.16;
  mag.position.z = 0.05;
  mag.rotation.x = -0.2;

  const muzzle = grp('muzzle', gun);
  muzzle.position.y = 0.01;
  muzzle.position.z = 0.82;
  gun.muzzle = muzzle;

  return gun;
}

function createRevolver(mats = { primary: gunMat, detail: gunDetailMat }) {
  const gun = grp('gun');

  const body = box(0.09, 0.12, 0.22, mats.primary, gun);
  body.position.z = -0.02;

  const drum = cyl(0.07, 0.07, 0.14, mats.detail, gun, 10);
  drum.rotation.z = PI / 2;
  drum.position.y = 0.01;
  drum.position.z = 0.05;

  const barrel = cyl(0.03, 0.03, 0.32, mats.primary, gun, 8);
  barrel.rotation.x = PI / 2;
  barrel.position.y = 0.01;
  barrel.position.z = 0.32;

  const grip = box(0.09, 0.22, 0.1, mats.detail, gun);
  grip.position.y = -0.16;
  grip.position.z = -0.12;
  grip.rotation.x = 0.35;

  const muzzle = grp('muzzle', gun);
  muzzle.position.y = 0.01;
  muzzle.position.z = 0.48;
  gun.muzzle = muzzle;

  return gun;
}

function createLMG(mats = { primary: gunMat, detail: gunDetailMat }) {
  const gun = grp('gun');

  const body = box(0.13, 0.14, 0.75, mats.primary, gun);
  body.position.y = 0.02;
  body.position.z = 0.15;

  const barrel = cyl(0.045, 0.045, 0.6, mats.primary, gun, 10);
  barrel.rotation.x = PI / 2;
  barrel.position.y = 0.02;
  barrel.position.z = 0.7;

  const drum = cyl(0.16, 0.16, 0.12, mats.detail, gun, 12);
  drum.position.y = -0.2;
  drum.position.z = 0.05;

  const bipodLeft = box(0.03, 0.3, 0.03, mats.detail, gun);
  bipodLeft.position.set(-0.08, -0.15, 0.55);
  bipodLeft.rotation.z = 0.3;

  const bipodRight = cloneM(bipodLeft, gun);
  bipodRight.position.x = 0.08;
  bipodRight.rotation.z = -0.3;

  const grip = box(0.09, 0.22, 0.09, mats.detail, gun);
  grip.position.y = -0.18;
  grip.position.z = -0.18;
  grip.rotation.x = 0.3;

  const muzzle = grp('muzzle', gun);
  muzzle.position.y = 0.02;
  muzzle.position.z = 1.0;
  gun.muzzle = muzzle;

  return gun;
}

function createCrossbow(mats = { primary: gunMat, detail: gunDetailMat }) {
  const gun = grp('gun');

  const body = box(0.08, 0.08, 0.55, mats.primary, gun);
  body.position.z = 0.05;

  const limb = box(0.7, 0.05, 0.06, mats.detail, gun);
  limb.position.y = 0.02;
  limb.position.z = 0.25;

  const stringL = cyl(0.01, 0.01, 0.36, mats.primary, gun, 6);
  stringL.position.set(-0.17, 0.02, 0.05);
  stringL.rotation.z = PI / 2.3;

  const stringR = cloneM(stringL, gun);
  stringR.position.x = 0.17;
  stringR.rotation.z = -PI / 2.3;

  const grip = box(0.08, 0.24, 0.08, mats.detail, gun);
  grip.position.y = -0.14;
  grip.position.z = -0.18;

  const muzzle = grp('muzzle', gun);
  muzzle.position.y = 0.02;
  muzzle.position.z = 0.55;
  gun.muzzle = muzzle;

  return gun;
}

// ── Weapon stat registry ──────────────────────────────────────────────────────
export const WEAPON_DEFS = {
  sniper:   { name: 'Sniper Rifle',    price: 0,   damage: 85, speed: 42, pellets: 1, spread: 0,    cooldown: 1800, splashRadius: 0,   ammoCapacity: 5,   reloadTime: 2.2, build: createSniperGun },
  pistol:   { name: 'Pistol',          price: 0,   damage: 30, speed: 36, pellets: 1, spread: 0.04, cooldown: 750,  splashRadius: 0,   ammoCapacity: 12,  reloadTime: 1.2, build: createPistol },
  shotgun:  { name: 'Shotgun',         price: 0,   damage: 28, speed: 30, pellets: 6, spread: 0.18, cooldown: 1400, splashRadius: 0,   ammoCapacity: 6,   reloadTime: 1.8, build: createShotgun },
  smg:      { name: 'SMG',             price: 400, damage: 20, speed: 36, pellets: 1, spread: 0.06, cooldown: 280,  splashRadius: 0,   ammoCapacity: 30,  reloadTime: 1.4, build: createSMG },
  rocket:   { name: 'Rocket Launcher', price: 700, damage: 55, speed: 28, pellets: 1, spread: 0,    cooldown: 2500, splashRadius: 5.5, ammoCapacity: 4,   reloadTime: 2.8, build: createRocketLauncher },
  burst:    { name: 'Burst Rifle',     price: 500, damage: 38, speed: 38, pellets: 3, spread: 0.03, cooldown: 900,  splashRadius: 0,   ammoCapacity: 18,  reloadTime: 1.5, build: createBurstRifle },
  revolver: { name: 'Revolver',        price: 450, damage: 70, speed: 38, pellets: 1, spread: 0.02, cooldown: 1200, splashRadius: 0,   ammoCapacity: 6,   reloadTime: 2.0, build: createRevolver },
  lmg:      { name: 'LMG',             price: 600, damage: 25, speed: 36, pellets: 1, spread: 0.08, cooldown: 350,  splashRadius: 0,   ammoCapacity: 50,  reloadTime: 2.4, build: createLMG },
  crossbow: { name: 'Crossbow',        price: 550, damage: 90, speed: 32, pellets: 1, spread: 0,    cooldown: 1800, splashRadius: 0,   ammoCapacity: 8,   reloadTime: 1.8, build: createCrossbow },
  minigun:  { name: 'Minigun',         price: 0, vipOnly: true, damage: 18, speed: 38, pellets: 1, spread: 0.1, cooldown: 80, splashRadius: 0, ammoCapacity: 100, reloadTime: 3.0, build: createMinigun },
  phantomCannon: { name: 'Phantom Cannon', price: 0, vipOnly: true, secretVip: true, damage: 200, speed: 50, pellets: 1, spread: 0, cooldown: 1400, splashRadius: 10, ammoCapacity: 6, reloadTime: 2.5, build: createRocketLauncher },
};
