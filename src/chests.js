// ── chests.js  Three-tier treasure chests: Normal / Rare / VIP ───────────────
import { scene, engine, camera, grp, pbr } from './engine.js';
import { gs, player, interactableObjects, wallColliders,
         inventory, saveInventory, saveCoins, PLAYER_MAX_HEALTH } from './state.js';
import { playerBody } from './player.js';
import { spawnFloatingText, spawnImpactParticles } from './effects.js';
import { collidesWithWalls } from './maps/index.js';
import { WEAPON_DEFS } from './armory/weapons.js';
import { ARMOR_DEFS } from './armory/armor.js';
import { SKIN_DEFS } from './armory/skins.js';
import { CLOTHES_DEFS } from './armory/clothes.js';
import { EMOTE_DEFS } from './armory/emotes.js';
import { playPickup, playHealChime, playCoinEarn, playChestOpen } from './audio.js';

export const activeChests = [];
const flyingItems = [];

// ── Chest tier definitions ────────────────────────────────────────────────────
const TIERS = {
  normal: {
    bodyHex:    0x7B3F00,
    lidHex:     0x5C2E00,
    trimHex:    0xFFD700,
    glowR: 1.0, glowG: 0.82, glowB: 0.20,
    glowIntensity: 0.6,
    label: 'Open Chest',
  },
  rare: {
    bodyHex:    0x0b1e4a,
    lidHex:     0x071230,
    trimHex:    0x22ddff,
    glowR: 0.1, glowG: 0.6,  glowB: 1.0,
    glowIntensity: 1.4,
    label: 'Open Rare Chest',
  },
  vip: {
    bodyHex:    0x0a0a0a,
    lidHex:     0x050505,
    trimHex:    0xffd700,
    glowR: 1.0, glowG: 0.85, glowB: 0.0,
    glowIntensity: 2.2,
    label: 'Open VIP Chest',
  },
};

// ── Chest visual builder ──────────────────────────────────────────────────────
function buildChest(x, z, tier = 'normal') {
  const t = TIERS[tier];
  const root = grp('chest_' + tier);
  root.position.set(x, 0, z);

  const bodyMat = pbr(t.bodyHex, tier === 'vip' ? 0.05 : 0.72, tier === 'vip' ? 0.9 : 0.1);
  const body = BABYLON.MeshBuilder.CreateBox('cb', { width: 0.9, height: 0.55, depth: 0.65 }, scene);
  body.material = bodyMat;
  body.parent = root;
  body.position.y = 0.275;

  const lidPivot = grp('lp', root);
  lidPivot.position.set(0, 0.55, -0.325);

  const lidMat = pbr(t.lidHex, tier === 'vip' ? 0.05 : 0.68, tier === 'vip' ? 0.85 : 0.14);
  const lid = BABYLON.MeshBuilder.CreateBox('cl', { width: 0.92, height: 0.28, depth: 0.67 }, scene);
  lid.material = lidMat;
  lid.parent = lidPivot;
  lid.position.set(0, 0.14, 0.325);

  // Trim band
  const emissiveOpts = tier === 'normal'
    ? { emissive: 0xFFAA00, emissiveIntensity: 0.25 }
    : tier === 'rare'
      ? { emissive: 0x44ffff, emissiveIntensity: 0.55 }
      : { emissive: 0xffd700, emissiveIntensity: 0.9 };
  const trimMat = pbr(t.trimHex, 0.1, 0.95, emissiveOpts);
  const trim = BABYLON.MeshBuilder.CreateBox('ct', { width: 0.93, height: 0.07, depth: 0.67 }, scene);
  trim.material = trimMat;
  trim.parent = root;
  trim.position.y = 0.55;
  trim.isPickable = false;

  const latch = BABYLON.MeshBuilder.CreateBox('latch', { width: 0.12, height: 0.12, depth: 0.08 }, scene);
  latch.material = trimMat;
  latch.parent = root;
  latch.position.set(0, 0.55, 0.33);
  latch.isPickable = false;

  // Tier-specific decorations
  if (tier === 'rare') {
    // Four cyan corner studs
    [[-0.42,0.55,-0.3],[0.42,0.55,-0.3],[-0.42,0.55,0.3],[0.42,0.55,0.3]].forEach(([sx,sy,sz]) => {
      const stud = BABYLON.MeshBuilder.CreateSphere('st', { diameter: 0.09, segments: 4 }, scene);
      stud.material = trimMat;
      stud.parent = root;
      stud.position.set(sx, sy, sz);
      stud.isPickable = false;
    });
  }

  if (tier === 'vip') {
    // "VIP" canvas label on the front face
    const dynTex = new BABYLON.DynamicTexture('vipTex', { width: 256, height: 128 }, scene);
    const ctx = dynTex.getContext();
    ctx.fillStyle = '#0a0a0a';
    ctx.fillRect(0, 0, 256, 128);
    ctx.fillStyle = '#FFD700';
    ctx.font = 'bold 78px Arial';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('VIP', 128, 64);
    dynTex.update();
    const signMat = new BABYLON.StandardMaterial('vipSignM', scene);
    signMat.diffuseTexture  = dynTex;
    signMat.emissiveTexture = dynTex;
    signMat.disableLighting = true;
    signMat.backFaceCulling = false;
    const sign = BABYLON.MeshBuilder.CreatePlane('vipSign', { width: 0.58, height: 0.28 }, scene);
    sign.material = signMat;
    sign.parent = root;
    sign.position.set(0, 0.42, 0.335);
    sign.isPickable = false;

    // Gold chain rings on corners
    [[- 0.4, 0.55, 0.0], [0.4, 0.55, 0.0]].forEach(([cx,cy,cz]) => {
      const ring = BABYLON.MeshBuilder.CreateTorus('ring', { diameter: 0.14, thickness: 0.04, tessellation: 12 }, scene);
      ring.material = trimMat;
      ring.parent = root;
      ring.position.set(cx, cy, cz);
      ring.rotation.x = Math.PI / 2;
      ring.isPickable = false;
    });
  }

  // Point light
  const glow = new BABYLON.PointLight('cgl', new BABYLON.Vector3(x, 1.2, z), scene);
  glow.diffuse   = new BABYLON.Color3(t.glowR, t.glowG, t.glowB);
  glow.intensity = t.glowIntensity;
  glow.range     = tier === 'vip' ? 8 : 5;

  const chest = {
    root, lid: lidPivot, body, glow, tier,
    position: new BABYLON.Vector3(x, 0.5, z),
    opened: false,
    label: t.label,
    onInteract: () => openChest(chest),
    _bobPhase: Math.random() * Math.PI * 2,
    _sparkles: [],
  };

  body._isChest = true; body._chestRef = chest;
  lid._isChest  = true; lid._chestRef  = chest;

  // VIP chests get orbiting gold sparkle spheres
  if (tier === 'vip') {
    const sparkMat = new BABYLON.StandardMaterial('spkM', scene);
    sparkMat.emissiveColor = new BABYLON.Color3(1, 0.85, 0);
    sparkMat.disableLighting = true;
    for (let i = 0; i < 4; i++) {
      const spk = BABYLON.MeshBuilder.CreateSphere('spk', { diameter: 0.08, segments: 3 }, scene);
      spk.material = sparkMat;
      spk.parent = root;
      spk._phase = (i / 4) * Math.PI * 2;
      spk.isPickable = false;
      chest._sparkles.push(spk);
    }
  }

  interactableObjects.push(chest);
  activeChests.push(chest);
  return chest;
}

// ── Open animation + loot ─────────────────────────────────────────────────────
function openChest(chest) {
  if (chest.opened) return;
  chest.opened = true;

  const idx = interactableObjects.indexOf(chest);
  if (idx >= 0) interactableObjects.splice(idx, 1);

  playChestOpen();

  // Animate lid
  let elapsed = 0;
  const obs = scene.onBeforeRenderObservable.add(() => {
    elapsed += scene.getEngine().getDeltaTime() / 1000;
    const t = Math.min(elapsed / 0.45, 1);
    chest.lid.rotation.x = -(Math.PI * 0.82) * t;
    if (t >= 1) scene.onBeforeRenderObservable.remove(obs);
  });

  const origin = chest.root.position.clone();
  origin.y += 0.7;

  if (chest.tier === 'normal') {
    _lootNormal(origin);
  } else if (chest.tier === 'rare') {
    _lootRare(origin);
  } else {
    _lootVip(origin);
  }

  // Dispose after 3 s
  setTimeout(() => {
    if (chest.glow && !chest.glow.isDisposed()) chest.glow.dispose();
    if (chest.root && !chest.root.isDisposed()) chest.root.dispose();
    const ci = activeChests.indexOf(chest);
    if (ci >= 0) activeChests.splice(ci, 1);
  }, 3000);
}

// ── Loot tables ───────────────────────────────────────────────────────────────
function _lootNormal(origin) {
  // 3-5 health orbs (30 HP each)
  const orbs = 3 + Math.floor(Math.random() * 3);
  for (let i = 0; i < orbs; i++)
    setTimeout(() => _spawnOrb(origin, 'health', 30), i * 120);
  // 10-50 coins
  const coins = 10 + Math.floor(Math.random() * 41);
  const coinV = Math.ceil(coins / 6);
  for (let i = 0; i < 6; i++)
    setTimeout(() => _spawnOrb(origin, 'coin', coinV), i * 80);
  // 1 random non-VIP weapon
  setTimeout(() => _spawnWeapon(origin, false), 250);
}

function _lootRare(origin) {
  // 10-15 health orbs (80 HP each)
  const orbs = 10 + Math.floor(Math.random() * 6);
  for (let i = 0; i < orbs; i++)
    setTimeout(() => _spawnOrb(origin, 'health', 80), i * 80);
  // 2000 coins
  for (let i = 0; i < 10; i++)
    setTimeout(() => _spawnOrb(origin, 'coin', 200), i * 60);
  // One item per category (non-VIP only)
  setTimeout(() => _spawnWeapon(origin, false), 200);
  setTimeout(() => _spawnItem(origin, 'armor'), 350);
  setTimeout(() => _spawnItem(origin, 'skin'), 500);
  setTimeout(() => _spawnItem(origin, 'clothes'), 650);
  setTimeout(() => _spawnItem(origin, 'emote'), 800);
}

function _lootVip(origin) {
  // Invincibility for 20 s
  player.invincibleTimer = 20;
  player.health = PLAYER_MAX_HEALTH;
  spawnFloatingText('⭐ INVINCIBLE! 20s', playerBody.position.add(new BABYLON.Vector3(0, 2, 0)), 0xffd700);
  // Infinite coins until next purchase
  gs.infiniteCoins = true;
  spawnFloatingText('💰 INFINITE COINS!', playerBody.position.add(new BABYLON.Vector3(0, 2.8, 0)), 0xffd700);
  // Particle burst
  spawnImpactParticles(origin, 0xffd700, 50);
  spawnImpactParticles(origin, 0xffffff, 30);
  // 1 random secret VIP item
  setTimeout(() => _spawnSecretVip(origin), 300);
}

// ── Item spawners ─────────────────────────────────────────────────────────────
function _spawnOrb(origin, type, value) {
  const isHealth = type === 'health';
  const mat = new BABYLON.StandardMaterial('fo_' + type + Math.random(), scene);
  mat.emissiveColor = isHealth
    ? new BABYLON.Color3(0.15, 0.55, 1.0)
    : new BABYLON.Color3(1.0, 0.82, 0.0);
  mat.disableLighting = true;

  const mesh = BABYLON.MeshBuilder.CreateSphere('fo', { diameter: isHealth ? 0.22 : 0.16, segments: 5 }, scene);
  mesh.material = mat;
  mesh.position.set(
    origin.x + (Math.random() - 0.5) * 0.6,
    origin.y,
    origin.z + (Math.random() - 0.5) * 0.6
  );
  mesh.isPickable = false;

  let light = null;
  if (isHealth) {
    light = new BABYLON.PointLight('obl', mesh.position.clone(), scene);
    light.diffuse   = new BABYLON.Color3(0.2, 0.5, 1);
    light.intensity = 0.5; light.range = 3;
  }
  flyingItems.push({ mesh, light, type, value, phase: 'up', timer: 0 });
}

function _pickUnowned(defs, inv) {
  const keys = Object.keys(defs).filter(k => {
    const d = defs[k];
    if (d.secretVip) return false; // secret VIP items only from VIP chests
    if (d.vipOnly && !inventory.vip) return false;
    return !inv.includes(k);
  });
  return keys.length ? keys[Math.floor(Math.random() * keys.length)] : null;
}

function _spawnWeapon(origin, allowVip) {
  const key = _pickUnowned(WEAPON_DEFS, inventory.weapons);
  if (!key) return;
  _spawnProp(origin, 'weapon', key, WEAPON_DEFS[key].name, 0xcc44ff, { width: 0.55, height: 0.12, depth: 0.12 });
}

function _spawnItem(origin, cat) {
  const DEFS = { armor: ARMOR_DEFS, skin: SKIN_DEFS, clothes: CLOTHES_DEFS, emote: EMOTE_DEFS };
  const INV  = { armor: inventory.armor, skin: inventory.skins, clothes: inventory.clothes, emote: inventory.emotes };
  const key = _pickUnowned(DEFS[cat], INV[cat]);
  if (!key) return;
  const name = DEFS[cat][key].name;
  const colors = { armor: 0x88aaff, skin: 0xff88cc, clothes: 0x88ffcc, emote: 0xffcc44 };
  _spawnProp(origin, cat, key, name, colors[cat], { width: 0.45, height: 0.45, depth: 0.1 });
}

function _spawnSecretVip(origin) {
  const candidates = [
    ...Object.entries(WEAPON_DEFS).filter(([k,d]) => d.secretVip && !inventory.weapons.includes(k)).map(([k,d]) => ({ k, d, cat: 'weapon', inv: inventory.weapons })),
    ...Object.entries(ARMOR_DEFS).filter(([k,d]) => d.secretVip && !inventory.armor.includes(k)).map(([k,d]) => ({ k, d, cat: 'armor', inv: inventory.armor })),
    ...Object.entries(SKIN_DEFS).filter(([k,d]) => d.secretVip && !inventory.skins.includes(k)).map(([k,d]) => ({ k, d, cat: 'skin', inv: inventory.skins })),
    ...Object.entries(CLOTHES_DEFS).filter(([k,d]) => d.secretVip && !inventory.clothes.includes(k)).map(([k,d]) => ({ k, d, cat: 'clothes', inv: inventory.clothes })),
    ...Object.entries(EMOTE_DEFS).filter(([k,d]) => d.secretVip && !inventory.emotes.includes(k)).map(([k,d]) => ({ k, d, cat: 'emote', inv: inventory.emotes })),
  ];
  if (!candidates.length) {
    // Already found everything — bonus coins instead
    _spawnOrb(origin, 'coin', 5000);
    return;
  }
  const pick = candidates[Math.floor(Math.random() * candidates.length)];
  _spawnProp(origin, pick.cat + '_secret', pick.k, '⭐ ' + pick.d.name, 0xffd700, { width: 0.5, height: 0.5, depth: 0.12 }, pick.inv);
}

function _spawnProp(origin, cat, key, label, color, size, inv) {
  const mat = new BABYLON.StandardMaterial('fp_' + key, scene);
  mat.emissiveColor = new BABYLON.Color3((color >> 16 & 0xff) / 255, (color >> 8 & 0xff) / 255, (color & 0xff) / 255);
  mat.disableLighting = true;
  const mesh = BABYLON.MeshBuilder.CreateBox('fp', size, scene);
  mesh.material = mat;
  mesh.position.copyFrom(origin);
  mesh.isPickable = false;
  flyingItems.push({ mesh, light: null, type: 'item', cat, key, label, inv, phase: 'up', timer: 0 });
}

// ── Apply loot when item reaches player ──────────────────────────────────────
function _applyLoot(item) {
  if (item.type === 'health') {
    const gain = Math.min(item.value, PLAYER_MAX_HEALTH - player.health);
    if (gain > 0) { player.health += gain; spawnFloatingText(`+${gain} HP`, playerBody.position, 0x44aaff); playHealChime(); }
  } else if (item.type === 'coin') {
    gs.coins += item.value; saveCoins();
    spawnFloatingText(`+${item.value}`, playerBody.position.add(new BABYLON.Vector3((Math.random()-0.5)*1.5, 0.5, (Math.random()-0.5)*1.5)), 0xffd700);
    playCoinEarn();
  } else if (item.type === 'item' || item.type?.endsWith('_secret')) {
    const added = _addToInventory(item.cat.replace('_secret',''), item.key, item.inv);
    if (added) {
      spawnFloatingText(`🔓 ${item.label} UNLOCKED!`, playerBody.position.add(new BABYLON.Vector3(0, 1, 0)), item.type?.endsWith('_secret') ? 0xffd700 : 0xcc44ff);
      playPickup();
    }
  }
}

function _addToInventory(cat, key, inv) {
  if (!inv || inv.includes(key)) return false;
  inv.push(key);
  saveInventory();
  return true;
}

// ── Update loop ───────────────────────────────────────────────────────────────
export function updateChests(dt) {
  const t = gs.timeAccum;

  activeChests.forEach(c => {
    if (c.opened || !c.root || c.root.isDisposed()) return;
    c.root.position.y  = Math.sin(t * 1.4 + c._bobPhase) * 0.06;
    c.root.rotation.y += dt * (c.tier === 'vip' ? 0.7 : 0.4);
    if (c.glow) c.glow.intensity = TIERS[c.tier].glowIntensity * (0.75 + Math.sin(t * 2.5 + c._bobPhase) * 0.25);
    // Orbit sparkles on VIP chests
    c._sparkles.forEach((s, i) => {
      const a = t * 1.8 + s._phase;
      s.position.set(Math.cos(a) * 0.62, 0.55 + Math.sin(t * 3 + i) * 0.12, Math.sin(a) * 0.62);
    });
  });

  for (let i = flyingItems.length - 1; i >= 0; i--) {
    const item = flyingItems[i];
    item.timer += dt;
    if (item.phase === 'up') {
      item.mesh.position.y += dt * 4;
      item.mesh.rotation.y += dt * 5;
      if (item.timer > 0.5) { item.phase = 'home'; item.timer = 0; }
    } else {
      if (!item.mesh || item.mesh.isDisposed?.()) { flyingItems.splice(i, 1); continue; }
      const tx = playerBody.position.x;
      const ty = playerBody.position.y + 1.0;
      const tz = playerBody.position.z;
      const dx = tx - item.mesh.position.x;
      const dy = ty - item.mesh.position.y;
      const dz = tz - item.mesh.position.z;
      const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);
      if (dist < 0.7) {
        _applyLoot(item);
        if (item.light && !item.light.isDisposed()) item.light.dispose();
        if (!item.mesh.isDisposed()) item.mesh.dispose();
        flyingItems.splice(i, 1);
        continue;
      }
      const speed = (4 + (1 / Math.max(dist, 0.3)) * 12) * dt / Math.max(dist, 0.001);
      item.mesh.position.x += dx * speed;
      item.mesh.position.y += dy * speed;
      item.mesh.position.z += dz * speed;
      item.mesh.rotation.y += dt * 8;
      if (item.light) {
        item.light.position.x = item.mesh.position.x;
        item.light.position.y = item.mesh.position.y;
        item.light.position.z = item.mesh.position.z;
      }
    }
  }
}

// ── Spawn chests on map load ──────────────────────────────────────────────────
export function spawnChests() {
  clearChests();
  const R = gs.MAP_RADIUS - 4;
  const spots = _findHiddenSpots(10, R);
  spots.forEach(({ x, z }, i) => {
    // Tier distribution: 6 normal, 3 rare, 1 VIP
    const tier = i === 9 ? 'vip' : i >= 6 ? 'rare' : 'normal';
    buildChest(x, z, tier);
  });
}

// ── Clear chests on map teardown ──────────────────────────────────────────────
export function clearChests() {
  for (const item of flyingItems) {
    if (item.light && !item.light.isDisposed()) item.light.dispose();
    if (!item.mesh.isDisposed()) item.mesh.dispose();
  }
  flyingItems.length = 0;
  for (const c of activeChests) {
    const ii = interactableObjects.indexOf(c);
    if (ii >= 0) interactableObjects.splice(ii, 1);
    if (c.glow && !c.glow.isDisposed()) c.glow.dispose();
    if (c.root && !c.root.isDisposed()) c.root.dispose();
  }
  activeChests.length = 0;
}

// ── Hidden-spot finder ────────────────────────────────────────────────────────
function _findHiddenSpots(count, R) {
  const spots = [];
  const shuffled = [...wallColliders].sort(() => Math.random() - 0.5);
  for (const wc of shuffled) {
    if (spots.length >= count) break;
    const cx = (wc.minX + wc.maxX) / 2, cz = (wc.minZ + wc.maxZ) / 2;
    const candidates = [
      { x: wc.minX - 1.8, z: cz + (Math.random()-0.5)*2 },
      { x: wc.maxX + 1.8, z: cz + (Math.random()-0.5)*2 },
      { x: cx + (Math.random()-0.5)*2, z: wc.minZ - 1.8 },
      { x: cx + (Math.random()-0.5)*2, z: wc.maxZ + 1.8 },
    ];
    for (const { x, z } of candidates) {
      if (Math.abs(x) > R || Math.abs(z) > R) continue;
      if (collidesWithWalls(x, z, 1.0)) continue;
      if (!spots.some(p => Math.hypot(p.x-x, p.z-z) < 12)) { spots.push({ x, z }); break; }
    }
  }
  let attempts = 0;
  while (spots.length < count && attempts < 600) {
    attempts++;
    const angle = Math.random() * Math.PI * 2;
    const dist  = R * (0.4 + Math.random() * 0.55);
    const x = Math.cos(angle) * dist, z = Math.sin(angle) * dist;
    if (collidesWithWalls(x, z, 1.0)) continue;
    if (!spots.some(p => Math.hypot(p.x-x, p.z-z) < 12)) spots.push({ x, z });
  }
  return spots;
}

// ── Screen-space hover check (no open) ───────────────────────────────────────
function _screenDist(chest, screenX, screenY) {
  if (!chest.root || chest.root.isDisposed()) return Infinity;
  try {
    const worldPos = chest.root.getAbsolutePosition().clone(); worldPos.y += 0.5;
    const vp = camera.viewport.toGlobal(engine.getRenderWidth(), engine.getRenderHeight());
    const sp = BABYLON.Vector3.Project(worldPos, BABYLON.Matrix.Identity(), scene.getTransformMatrix(), vp);
    if (sp.z < 0 || sp.z > 1) return Infinity;
    return Math.hypot(screenX - sp.x, screenY - sp.y);
  } catch { return Infinity; }
}

export function isChestAtScreen(screenX, screenY) {
  const pick = scene.pick(screenX, screenY, m => !!m._isChest && !m._chestRef?.opened);
  if (pick?.hit && pick.pickedMesh?._chestRef && !pick.pickedMesh._chestRef.opened) {
    const dist = BABYLON.Vector3.Distance(pick.pickedMesh._chestRef.position, playerBody.position);
    if (dist <= 14) return true;
  }
  for (const c of activeChests) {
    if (c.opened) continue;
    const dist3d = BABYLON.Vector3.Distance(c.root?.getAbsolutePosition() ?? c.position, playerBody.position);
    if (dist3d > 14) continue;
    if (_screenDist(c, screenX, screenY) < 70) return true;
  }
  return false;
}

export function tryClickChest(screenX, screenY) {
  const pick = scene.pick(screenX, screenY, m => !!m._isChest && !m._chestRef?.opened);
  if (pick?.hit && pick.pickedMesh?._chestRef && !pick.pickedMesh._chestRef.opened) {
    const c = pick.pickedMesh._chestRef;
    if (BABYLON.Vector3.Distance(c.position, playerBody.position) <= 14) { c.onInteract(); return true; }
  }
  let best = null, bestPx = 70;
  for (const c of activeChests) {
    if (c.opened) continue;
    const dist3d = BABYLON.Vector3.Distance(c.root?.getAbsolutePosition() ?? c.position, playerBody.position);
    if (dist3d > 14) continue;
    const px = _screenDist(c, screenX, screenY);
    if (px < bestPx) { bestPx = px; best = c; }
  }
  if (best) { best.onInteract(); return true; }
  return false;
}
