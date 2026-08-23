// ── enemies.js  Enemy types, spawning, AI ─────────────────────────────────────
import { scene, pbr, addShadow, makeCanvasTex, getHeightAtXZ } from './engine.js';
import { enemies, player, gs, wallColliders, BASE_ENEMIES, ENEMIES_PER_LEVEL } from './state.js';
import { createCharacter, enemySkinMat, playerBody } from './player.js';
import { createRiggedCharacter, ENEMY_VARIANTS, ZOMBIE_VARIANTS, jitterVariant, applyOutfit } from './character.js';
import { assetsReady } from './assets.js';
import { playEnemyGunshot } from './audio.js';
import { spawnDeathBurst, spawnImpactParticles, spawnFloatingText } from './effects.js';

// Lazy-resolved callbacks
let _spawnEnemyBullet = null;
let _takeDamage = null;
let _spawnPowerupsForLevel = null;
let _defeatEnemy = null;
let _showMessage = null;
let _hideMessage = null;
let _startDivineHealingEvent = null;

export function registerCombatCallbacks({ spawnEnemyBullet, takeDamage, spawnPowerupsForLevel, defeatEnemy }) {
  _spawnEnemyBullet = spawnEnemyBullet;
  _takeDamage = takeDamage;
  _spawnPowerupsForLevel = spawnPowerupsForLevel;
  _defeatEnemy = defeatEnemy;
}

export function registerUICallbacks({ showMessage, hideMessage }) {
  _showMessage = showMessage;
  _hideMessage = hideMessage;
}

export function registerMapCallbacks({ startDivineHealingEvent }) {
  _startDivineHealingEvent = startDivineHealingEvent;
}

// ── Enemy materials ────────────────────────────────────────────────────────────
const gruntCloth   = pbr(0x8a2727, 0.55, 0.07);
const gruntHelmet  = pbr(0x331010, 0.15, 0.12);
const rusherCloth  = pbr(0xff8c1a, 0.5, 0.08);
const rusherHelmet = pbr(0x402000, 0.2, 0.1);
const heavyCloth   = pbr(0x3a4a3a, 0.6, 0.15);
const heavyHelmet  = pbr(0x1a1a1a, 0.2, 0.3);
const bossCloth    = pbr(0x2a0a3a, 0.4, 0.3, { emissive: 0x6a1bb0, emissiveIntensity: 0.25 });
const bossHelmet   = pbr(0x120018, 0.15, 0.4, { emissive: 0x9b30ff, emissiveIntensity: 0.4 });
const sniperCloth  = pbr(0x225522, 0.7, 0.05);
const sniperHelmet = pbr(0x112211, 0.3, 0.05);
const bomberCloth  = pbr(0xcc4400, 0.5, 0.1);
const bomberHelmet = pbr(0x441100, 0.2, 0.1);
const medicCloth   = pbr(0xffffff, 0.5, 0.05);
const medicHelmet  = pbr(0xdd4444, 0.2, 0.05);

// Zombie skins (apocalypse map only)
const zombieSkinM    = pbr(0x7a8b55, 0.88, 0.01);
const zombieRagM     = pbr(0x1e120a, 0.95, 0.01);
const zombiePinkSkinM= pbr(0xff88aa, 0.55, 0.02);   // chubby pink zombie boss skin
const zombiePinkFleshM= pbr(0xdd5577, 0.6,  0.01);  // slightly darker pink for rags
const zombieEyeM     = pbr(0xffaa00, 0.05, 0, { emissive: 0xff6600, emissiveIntensity: 3.0 });
const ALL_CLOTH_MATS = () => [gruntCloth, rusherCloth, heavyCloth, bossCloth, sniperCloth, bomberCloth, medicCloth,
                              gruntHelmet, rusherHelmet, heavyHelmet, bossHelmet, sniperHelmet, bomberHelmet, medicHelmet];

export const ENEMY_TYPES = {
  grunt:   { cloth: gruntCloth,   helmet: gruntHelmet,   scale: 1,    speedMult: 1,    healthMult: 1,    shootRange: 45, shootInterval: [1.3, 2.5], scoreValue: 15 },
  rusher:  { cloth: rusherCloth,  helmet: rusherHelmet,  scale: 0.92, speedMult: 2.3,  healthMult: 0.5,  meleeOnly: true, meleeRange: 2.0, meleeDamage: 30, meleeInterval: 0.9, scoreValue: 22 },
  heavy:   { cloth: heavyCloth,   helmet: heavyHelmet,   scale: 1.55, speedMult: 0.55, healthMult: 2.4,  shootRange: 40, shootInterval: [2.0, 3.0], bulletDamageMult: 1.8, scoreValue: 40 },
  boss:    { cloth: bossCloth,    helmet: bossHelmet,    scale: 2.6,  speedMult: 0.7,  healthMult: 5,    shootRange: 60, shootInterval: [1.0, 1.6], pellets: 3, spreadShot: true, bulletDamageMult: 1.5, scoreValue: 250 },
  sniper:  { cloth: sniperCloth,  helmet: sniperHelmet,  scale: 1.05, speedMult: 0.6,  healthMult: 0.8,  shootRange: 90, shootInterval: [4.0, 7.0], scoreValue: 30, isSniper: true },
  bomber:  { cloth: bomberCloth,  helmet: bomberHelmet,  scale: 0.95, speedMult: 3.0,  healthMult: 0.7,  meleeOnly: true, meleeRange: 1.8, meleeDamage: 0, meleeInterval: 1.0, scoreValue: 35, isBomber: true },
  medic:   { cloth: medicCloth,   helmet: medicHelmet,   scale: 1.0,  speedMult: 0.9,  healthMult: 0.9,  shootRange: 30, shootInterval: [2.5, 4.0], scoreValue: 20, isMedic: true, healRange: 12, healAmount: 8, healInterval: 2.0 },
};

// ── Spawn ─────────────────────────────────────────────────────────────────────
export function spawnEnemy(x, z, health = 40, typeKey = 'grunt') {
  const def = ENEMY_TYPES[typeKey] || ENEMY_TYPES.grunt;
  const isZombieMap = gs.mapId === 'apocalypse';

  // Rigged GLB path (fallback: primitive rig)
  let rig = null;
  if (assetsReady && !localStorage.getItem('sniperstrike-classic-rigs')) {
    const vsrc = (isZombieMap ? ZOMBIE_VARIANTS : ENEMY_VARIANTS)[typeKey]
              || (isZombieMap ? ZOMBIE_VARIANTS.grunt : ENEMY_VARIANTS.grunt);
    const variant = jitterVariant(vsrc);
    rig = createRiggedCharacter(variant);
    // Real clothing geometry (team-colored shirt/pants, armor plate for
    // heavy/boss/bomber) — zombies skip clothes and just show tinted skin.
    if (rig && !isZombieMap) {
      applyOutfit(rig, { shirtColor: variant.shirtColor, armorColor: variant.armorColor, sleeves: true });
    }
  }

  let enemy, head, armLeft, armRight, gun, legLeft, legRight;
  if (rig) {
    enemy = rig.bodyGroup;
    head = rig.head; armLeft = rig.armLeft; armRight = rig.armRight;
    legLeft = rig.legLeft; legRight = rig.legRight; gun = rig.gun;
    enemy._rig = rig;
    // Zombies pose both arms procedurally (reach/lurch/axe); others are pure animation.
    rig._alwaysPose = isZombieMap ? ['armLeft', 'armRight'] : [];
    rig._idleClip = 'idle';
    // Free the rig's observer + anim groups when the enemy is disposed.
    const _origDispose = enemy.dispose.bind(enemy);
    enemy.dispose = (...a) => { rig.disposeExtras(); _origDispose(...a); };
  } else {
    ({ bodyGroup: enemy, head, armLeft, armRight, gun, legLeft, legRight } =
      createCharacter(def.cloth, enemySkinMat, def.helmet, 0.25, -0.15, 0.4));
    const hatMesh = enemy.getChildMeshes(false).find(m => m.name === 'hat');
    if (hatMesh) hatMesh.material = def.helmet;
  }

  enemy.gun = gun;
  enemy.parts = { armLeft, armRight, legLeft, legRight, head };
  enemy.type = typeKey;
  enemy.scaling.setAll(def.scale);
  enemy.speed = (1.2 + Math.random() * 1.6) * def.speedMult;
  enemy.position.set(x, 0, z);
  enemy.health = health * def.healthMult;
  enemy.maxHealth = enemy.health;
  enemy.scoreValue = def.scoreValue;
  const si = def.shootInterval;
  enemy.shootTimer = def.meleeOnly ? Infinity : (si ? si[0] + Math.random() * (si[1] - si[0]) : Infinity);
  enemy.meleeTimer = def.meleeInterval || 0;
  enemy.hitRadius = 2.4 * def.scale;
  enemy.headRadius = 1.8 * def.scale;
  enemy._frozen = 0;
  enemy._staggerTimer = 0;
  enemy._chargeTimer = 0;
  enemy._isCharging = false;
  enemy._healTimer = def.healInterval || 2.0;

  // Zombie look for apocalypse map
  if (isZombieMap) {
    if (rig) {
      // Skeleton models ARE the zombies — just flag the melee AI.
      enemy._isZombie = true;
      enemy.shootTimer = Infinity;
    } else {
      applyZombieLook(enemy, typeKey);
    }
    if (typeKey === 'boss') {
      // Chubby pink zombie boss: wide body, fixed 300 HP, giant axe
      enemy.scaling.set(4.0, 2.2, 4.0);
      enemy.health = 300;
      enemy.maxHealth = 300;
      enemy.hitRadius  = 5.0;
      enemy.headRadius = 3.5;
      enemy.speed *= 0.65;
      buildZombieBossAxe(enemy);
    }
  }

  // Medic: green cross above the head
  if (def.isMedic && head) {
    const crossParent = rig ? enemy : head;   // rigged: float above bodyGroup (billboard-ish)
    const crossY = rig ? 2.35 : 0.25;
    const crossZ = rig ? 0 : -0.5;
    const crossMat = pbr(0x44ff44, 0.5, 0.1, { emissive: 0x22cc22, emissiveIntensity: 0.6 });
    const h = BABYLON.MeshBuilder.CreateBox('cross_h', { width: 0.35, height: 0.08, depth: 0.08 }, scene);
    h.material = crossMat; h.parent = crossParent; h.position.set(0, crossY, crossZ); h.isPickable = false;
    const v = BABYLON.MeshBuilder.CreateBox('cross_v', { width: 0.08, height: 0.35, depth: 0.08 }, scene);
    v.material = crossMat; v.parent = crossParent; v.position.set(0, crossY, crossZ); v.isPickable = false;
  }

  // Bomber: glowing vest
  if (def.isBomber) {
    enemy._fuseTimer = 5 + Math.random() * 2;
  }

  // Health bar (floating plane above enemy)
  attachHealthBar(enemy, def.scale);

  enemies.push(enemy);
}

function buildZombieBossAxe(enemy) {
  const gun = enemy.gun;
  if (!gun) return;
  gun.position.set(0.18, -0.3, 0.35);

  const handleMat = pbr(0x2a1a0a, 0.85, 0.1);
  const bladeMat  = pbr(0xb0b0b0, 0.1, 0.92, { emissive: 0x222222, emissiveIntensity: 0.12 });
  const bloodMat  = pbr(0x6a0f0f, 0.35, 0.6);

  // Long handle
  const handle = BABYLON.MeshBuilder.CreateCylinder('axeHandle',
    { diameter: 0.1, height: 2.4, tessellation: 8 }, scene);
  handle.material = handleMat; handle.parent = gun; handle.position.set(0, 0, 0);
  handle.isPickable = false; addShadow(handle);

  // Grip wrap at centre
  const wrap = BABYLON.MeshBuilder.CreateCylinder('axeWrap',
    { diameter: 0.16, height: 0.32, tessellation: 8 }, scene);
  wrap.material = bloodMat; wrap.parent = gun; wrap.position.set(0, 0.05, 0);
  wrap.isPickable = false;

  // Top blade head
  const topBlade = BABYLON.MeshBuilder.CreateBox('axeBladeTop',
    { width: 1.5, height: 0.72, depth: 0.07 }, scene);
  topBlade.material = bladeMat; topBlade.parent = gun; topBlade.position.set(0, 1.05, 0);
  topBlade.isPickable = false; addShadow(topBlade);

  // Top blade blood-stained cutting edge
  const topEdge = BABYLON.MeshBuilder.CreateBox('axeEdgeTop',
    { width: 1.52, height: 0.1, depth: 0.06 }, scene);
  topEdge.material = bloodMat; topEdge.parent = gun; topEdge.position.set(0, 0.72, 0);
  topEdge.isPickable = false;

  // Bottom blade head (mirrored)
  const botBlade = BABYLON.MeshBuilder.CreateBox('axeBladeBot',
    { width: 1.5, height: 0.72, depth: 0.07 }, scene);
  botBlade.material = bladeMat; botBlade.parent = gun; botBlade.position.set(0, -1.05, 0);
  botBlade.isPickable = false; addShadow(botBlade);

  const botEdge = BABYLON.MeshBuilder.CreateBox('axeEdgeBot',
    { width: 1.52, height: 0.1, depth: 0.06 }, scene);
  botEdge.material = bloodMat; botEdge.parent = gun; botEdge.position.set(0, -0.72, 0);
  botEdge.isPickable = false;
}

function applyZombieLook(enemy, typeKey) {
  const isBoss = typeKey === 'boss';
  const ragMat  = isBoss ? zombiePinkFleshM : zombieRagM;
  const skinMat = isBoss ? zombiePinkSkinM  : zombieSkinM;
  const clothSet = ALL_CLOTH_MATS();
  enemy.getChildMeshes(false).forEach(m => {
    if (!m.material) return;
    if (clothSet.includes(m.material)) m.material = ragMat;
    if (m.material === enemySkinMat) m.material = skinMat;
    if (m.name === 'eyeL' || m.name === 'eyeR') {
      m.material = zombieEyeM;
      m.scaling.setAll(isBoss ? 2.0 : 1.5);
    }
  });
  if (enemy.gun) enemy.gun.getChildMeshes(true).forEach(m => { m.isVisible = false; });
  enemy._isZombie = true;
  enemy.shootTimer = Infinity;
  enemy.meleeTimer = 0;
}

function attachHealthBar(enemy, scale) {
  const W = 128, H = 14;
  const tex = new BABYLON.DynamicTexture('hpTex' + Math.random(), { width: W, height: H }, scene, false);
  tex.hasAlpha = true;

  const mat = new BABYLON.StandardMaterial('hpMat', scene);
  mat.diffuseTexture = tex;
  mat.emissiveColor = new BABYLON.Color3(1, 1, 1);
  mat.disableLighting = true;
  mat.backFaceCulling = false;
  mat.diffuseTexture.hasAlpha = true;

  const plane = BABYLON.MeshBuilder.CreatePlane('hpBar', { width: 1.6, height: 0.18 }, scene);
  plane.material = mat;
  plane.billboardMode = BABYLON.Mesh.BILLBOARDMODE_ALL;
  plane.isPickable = false;
  plane.isVisible = false; // hidden until first damage

  enemy._hpBar = plane;
  enemy._hpTex = tex;
  enemy._hpBarScale = scale;
}

function updateEnemyHealthBar(enemy) {
  if (!enemy._hpBar || !enemy._hpTex) return;
  const ratio = Math.max(0, enemy.health / enemy.maxHealth);

  // Only show after first damage
  if (ratio < 1) enemy._hpBar.isVisible = true;

  const sc = enemy._hpBarScale || 1;
  enemy._hpBar.position.set(
    enemy.position.x,
    enemy.position.y + 3.2 * sc,
    enemy.position.z
  );

  // Skip canvas redraw if ratio hasn't changed meaningfully
  if (Math.abs((enemy._lastHpRatio ?? 2) - ratio) < 0.005) return;
  enemy._lastHpRatio = ratio;

  const ctx = enemy._hpTex.getContext();
  const W = 128, H = 14;
  ctx.clearRect(0, 0, W, H);
  ctx.fillStyle = 'rgba(0,0,0,0.7)';
  ctx.fillRect(0, 0, W, H);
  const r = Math.round(255 * (1 - ratio));
  const g2 = Math.round(255 * ratio);
  ctx.fillStyle = `rgb(${r},${g2},0)`;
  ctx.fillRect(2, 2, Math.round((W - 4) * ratio), H - 4);
  enemy._hpTex.update();
}

export function clearEnemies() {
  while (enemies.length) {
    const e = enemies.pop();
    if (e && !e.isDisposed()) {
      if (e._hpBar && !e._hpBar.isDisposed()) e._hpBar.dispose();
      e.dispose();
    }
  }
}

// ── Level spawning ────────────────────────────────────────────────────────────
export function spawnEnemiesForLevel(l) {
  clearEnemies();
  if (gs.mapId === 'lobby') return; // lobby has no enemies

  // Game mode overrides
  const isHorde = gs.gameMode === 'horde';
  const isBossRush = gs.gameMode === 'bossrush';
  const isOneShot = gs.gameMode === 'oneshot';

  let count = BASE_ENEMIES + (l - 1) * ENEMIES_PER_LEVEL;
  if (isHorde) count = Math.round(count * 5);
  if (isBossRush) count = 0;
  // Tube lobby override: spawn exactly N enemies on first level
  if (gs.tubeEnemyCount > 0) { count = gs.tubeEnemyCount; gs.tubeEnemyCount = 0; }

  const health = isOneShot ? 999999 : (130 + l * 28);
  const roads = gs.activeRoadBands;
  const isInRoad = (z) => roads.some(rz => Math.abs(z - rz) < 5);

  const R = gs.MAP_RADIUS;
  for (let i = 0; i < count; i++) {
    let x, z, tries = 0;
    do {
      const angle = Math.random() * Math.PI * 2;
      // Spawn near the perimeter: 55%–90% of map radius from center
      const radius = R * 0.55 + Math.random() * (R * 0.35);
      x = Math.round(Math.cos(angle) * radius);
      z = Math.round(Math.sin(angle) * radius);
      tries++;
    } while (tries < 120 && (isInRoad(z) || gs.isInsideMapInterior(x, z) || collidesWithWalls(x, z)));

    if (gs.isInsideMapInterior(x, z) || collidesWithWalls(x, z)) {
      // Last-resort fallback: try a random perimeter point
      const a = Math.random() * Math.PI * 2;
      x = Math.round(Math.cos(a) * R * 0.7);
      z = Math.round(Math.sin(a) * R * 0.7);
    }

    let typeKey = 'grunt';
    if (!isHorde) {
      const roll = Math.random();
      if (l >= 2  && roll < 0.08) typeKey = 'sniper';
      else if (l >= 3 && roll < 0.14) typeKey = 'medic';
      else if (l >= 3 && roll < 0.22) typeKey = 'rusher';
      else if (l >= 4 && roll < 0.28) typeKey = 'bomber';
      else if (l >= 3 && roll < 0.36) typeKey = 'heavy';
    } else {
      // Horde: mostly grunts and rushers
      const roll = Math.random();
      typeKey = roll < 0.4 ? 'rusher' : 'grunt';
    }
    spawnEnemy(x, z, health, typeKey);
  }

  // Boss spawn
  const isBossLevel = isBossRush || l % 5 === 0;
  if (isBossLevel) {
    const bossCount = isBossRush ? 1 + Math.floor(l / 3) : 1;
    for (let b = 0; b < bossCount; b++) {
      let x, z, tries = 0;
      do {
        const angle = Math.random() * Math.PI * 2;
        const radius = R * 0.6 + Math.random() * (R * 0.3);
        x = Math.round(Math.cos(angle) * radius);
        z = Math.round(Math.sin(angle) * radius);
        tries++;
      } while (tries < 120 && (isInRoad(z) || gs.isInsideMapInterior(x, z) || collidesWithWalls(x, z)));
      if (gs.isInsideMapInterior(x, z) || collidesWithWalls(x, z)) {
        const a = Math.random() * Math.PI * 2;
        x = Math.round(Math.cos(a) * R * 0.7);
        z = Math.round(Math.sin(a) * R * 0.7);
      }
      spawnEnemy(x, z, health, 'boss');
    }
  }

  // One-shot mode: player health = 1
  if (isOneShot) player.maxHealth = 1;

  const levelUI = document.getElementById('level');
  if (levelUI) levelUI.textContent = `Level: ${l}`;

  if (isBossLevel) {
    if (_showMessage) _showMessage(`Level ${l} — BOSS INCOMING`, 2400);
  } else {
    if (_showMessage) _showMessage(`Level ${l} — Clear all enemies`);
    setTimeout(() => { if (_hideMessage) _hideMessage(); }, 1400);
  }

  if (gs.mapId === 'metro' && _startDivineHealingEvent) _startDivineHealingEvent();
  if (_spawnPowerupsForLevel) _spawnPowerupsForLevel();
}

// ── AI update ─────────────────────────────────────────────────────────────────
export function updateEnemies(dt) {
  if (!gs.started || player.health <= 0) return;
  const px = playerBody.position.x;
  const pz = playerBody.position.z;

  enemies.forEach(enemy => {
    if (enemy.health <= 0) return;

    // Terrain follow — no-op (lerps toward 0) on flat maps with no active heightfield.
    enemy.position.y += (getHeightAtXZ(enemy.position.x, enemy.position.z) - enemy.position.y) * 0.35;

    // Frozen
    if (enemy._frozen > 0) {
      enemy._frozen -= dt;
      enemy._wasFreezed = true;
      // Flash blue while frozen
      if (Math.floor(enemy._frozen * 6) % 2 === 0) {
        enemy.getChildMeshes(false).forEach(m => {
          if (m.material) m.material.emissiveColor = new BABYLON.Color3(0.3, 0.7, 1);
        });
      }
      updateEnemyHealthBar(enemy);
      return; // frozen enemies don't move or shoot
    } else {
      // Restore normal color after freeze ends
      if (enemy._wasFreezed) {
        enemy._wasFreezed = false;
        enemy.getChildMeshes(false).forEach(m => {
          if (m.material) m.material.emissiveColor = new BABYLON.Color3(0, 0, 0);
        });
      }
    }

    const dx = px - enemy.position.x;
    const dz = pz - enemy.position.z;
    const dist = Math.hypot(dx, dz);

    enemy.rotation.y = Math.atan2(dx, dz);

    const def = ENEMY_TYPES[enemy.type] || ENEMY_TYPES.grunt;

    // Hit stagger
    if (enemy._staggerTimer > 0) {
      enemy._staggerTimer -= dt;
      updateEnemyHealthBar(enemy);
      return;
    }

    // Zombie melee AI (all non-bomber zombies on apocalypse map)
    if (enemy._isZombie && !def.isBomber) {
      const isBossZombie = enemy.type === 'boss';
      const mRange = isBossZombie ? 3.8 : 1.8;
      if (dist > mRange) {
        const spd = enemy.speed * dt;
        let mdx = dx / dist, mdz = dz / dist;
        enemies.forEach(other => {
          if (other === enemy || other.health <= 0) return;
          const sdx = enemy.position.x - other.position.x;
          const sdz = enemy.position.z - other.position.z;
          const sd = Math.hypot(sdx, sdz);
          if (sd > 0 && sd < 1.8) { mdx += (sdx / sd) * 0.5; mdz += (sdz / sd) * 0.5; }
        });
        const mlen = Math.hypot(mdx, mdz) || 1;
        const nx = enemy.position.x + (mdx / mlen) * spd;
        const nz = enemy.position.z + (mdz / mlen) * spd;
        if (!collidesWithWalls(nx, enemy.position.z)) enemy.position.x = nx;
        if (!collidesWithWalls(enemy.position.x, nz)) enemy.position.z = nz;
      } else {
        enemy.meleeTimer -= dt;
        if (enemy.meleeTimer <= 0) {
          if (isBossZombie) {
            enemy.meleeTimer = 2.0;
            enemy._swingPhase = 0;
            dealMeleeDamage(45);
            spawnFloatingText('🪓 CLEAVE!', enemy.position, 0xff2200);
          } else {
            enemy.meleeTimer = 1.1;
            dealMeleeDamage(20);
          }
        }
      }
      // Animation
      const lurch = Math.sin(performance.now() * 0.003 * enemy.speed) * 0.35;
      if (enemy.parts) {
        enemy.parts.legLeft.rotation.x  =  lurch;
        enemy.parts.legRight.rotation.x = -lurch;
        if (isBossZombie) {
          // Axe swing or idle hold
          if (enemy._swingPhase !== undefined) {
            enemy._swingPhase += dt * 4.5;
            const swing = Math.sin(enemy._swingPhase) * 2.0;
            enemy.parts.armRight.rotation.x = -0.8 - swing;
            enemy.parts.armLeft.rotation.x  = -0.6 + swing * 0.5;
            enemy.parts.armRight.rotation.z = -0.2;
            enemy.parts.armLeft.rotation.z  =  0.2;
            if (enemy._swingPhase >= Math.PI) enemy._swingPhase = undefined;
          } else {
            // Idle: axe raised, menacing
            enemy.parts.armRight.rotation.x = -0.85 + lurch * 0.2;
            enemy.parts.armRight.rotation.z = -0.2;
            enemy.parts.armLeft.rotation.x  = -0.6  + lurch * 0.2;
            enemy.parts.armLeft.rotation.z  =  0.2;
          }
        } else {
          enemy.parts.armLeft.rotation.x  = -1.3 + lurch * 0.25;
          enemy.parts.armLeft.rotation.z  =  0.22;
          enemy.parts.armRight.rotation.x = -1.3 - lurch * 0.25;
          enemy.parts.armRight.rotation.z = -0.22;
        }
      }
      if (enemy._rig) updateRiggedLocomotion(enemy, dist);
      updateEnemyHealthBar(enemy);
      return;
    }

    if (def.isBomber) {
      // Bomber: sprint to player, explode on contact
      if (dist > def.meleeRange) {
        const spd = enemy.speed * dt;
        const nx = enemy.position.x + (dx / dist) * spd;
        const nz = enemy.position.z + (dz / dist) * spd;
        if (!collidesWithWalls(nx, enemy.position.z)) enemy.position.x = nx;
        if (!collidesWithWalls(enemy.position.x, nz)) enemy.position.z = nz;
      } else {
        // Explode on player!
        if (!enemy._exploded) {
          enemy._exploded = true;
          if (_takeDamage) _takeDamage(200);
          spawnImpactParticles(enemy.position, 0xff6600, 30);
          spawnFloatingText('💥 BOMBER!', enemy.position, 0xff8800);
          import('./audio.js').then(m => m.playExplosion());
          // Award coins/XP/score via the defeat callback
          if (_defeatEnemy) _defeatEnemy(enemy, 'bomber');
          else {
            // fallback: manual cleanup if callback not yet registered
            enemy.health = 0;
            enemy.isVisible = false;
            enemy.getChildMeshes(false).forEach(m => { m.isVisible = false; });
            if (enemy._hpBar) { enemy._hpBar.dispose(); enemy._hpBar = null; }
            setTimeout(() => { if (!enemy.isDisposed()) enemy.dispose(); }, 100);
            const idx = enemies.indexOf(enemy);
            if (idx !== -1) enemies.splice(idx, 1);
          }
        }
        return;
      }

    } else if (def.isMedic) {
      // Medic: heal nearby allies, then shoot if player in range
      enemy._healTimer -= dt;
      if (enemy._healTimer <= 0) {
        enemy._healTimer = def.healInterval;
        let healed = false;
        enemies.forEach(ally => {
          if (ally === enemy || ally.health <= 0) return;
          const ad = BABYLON.Vector3.Distance(ally.position, enemy.position);
          if (ad < def.healRange && ally.health < ally.maxHealth) {
            ally.health = Math.min(ally.maxHealth, ally.health + def.healAmount);
            spawnFloatingText(`+${def.healAmount}`, ally.position, 0x44ff88);
            healed = true;
          }
        });
      }
      // Move toward wounded allies or keep distance from player
      let targetX = px, targetZ = pz;
      let needsMove = true;
      enemies.forEach(ally => {
        if (ally === enemy || ally.health <= 0) return;
        const ad = BABYLON.Vector3.Distance(ally.position, enemy.position);
        const healthRatio = ally.health / ally.maxHealth;
        if (healthRatio < 0.5 && ad < 20) {
          targetX = ally.position.x; targetZ = ally.position.z;
        }
      });
      if (dist < 15) {
        // Flee from player
        targetX = enemy.position.x - dx;
        targetZ = enemy.position.z - dz;
      }
      if (needsMove) {
        const tdx = targetX - enemy.position.x;
        const tdz = targetZ - enemy.position.z;
        const td = Math.hypot(tdx, tdz);
        if (td > 2) {
          const spd = enemy.speed * dt;
          const nx = enemy.position.x + (tdx / td) * spd;
          const nz = enemy.position.z + (tdz / td) * spd;
          if (!collidesWithWalls(nx, enemy.position.z)) enemy.position.x = nx;
          if (!collidesWithWalls(enemy.position.x, nz)) enemy.position.z = nz;
        }
      }
      // Shoot if in range
      enemy.shootTimer -= dt;
      if (enemy.shootTimer <= 0 && dist < def.shootRange) {
        const si = def.shootInterval;
        enemy.shootTimer = si[0] + Math.random() * (si[1] - si[0]);
        if (_spawnEnemyBullet) _spawnEnemyBullet(enemy, def);
        playEnemyGunshot();
      }

    } else if (def.isSniper) {
      // Sniper: stand at long range, charge a shot
      const preferredDist = 55;
      if (dist < preferredDist - 5) {
        // Back away
        const spd = enemy.speed * dt;
        const nx = enemy.position.x - (dx / dist) * spd;
        const nz = enemy.position.z - (dz / dist) * spd;
        if (!collidesWithWalls(nx, enemy.position.z)) enemy.position.x = nx;
        if (!collidesWithWalls(enemy.position.x, nz)) enemy.position.z = nz;
      }

      enemy.shootTimer -= dt;
      if (enemy.shootTimer <= 0 && dist < def.shootRange) {
        const si = def.shootInterval;
        enemy.shootTimer = si[0] + Math.random() * (si[1] - si[0]);

        if (!enemy._isCharging) {
          // Start charge
          enemy._isCharging = true;
          enemy._chargeTimer = 2.0;
          // Show laser dot on player
          const dot = document.createElement('div');
          dot.id = `laser-${Date.now()}`;
          dot.className = 'laser-dot';
          document.getElementById('overlay')?.appendChild(dot);
          enemy._laserDot = dot;
        }
      }

      if (enemy._isCharging) {
        enemy._chargeTimer -= dt;
        if (enemy._chargeTimer <= 0) {
          enemy._isCharging = false;
          if (enemy._laserDot) { enemy._laserDot.remove(); enemy._laserDot = null; }
          // Fire a powerful single shot
          if (_spawnEnemyBullet) {
            const sniperDef = { ...def, spreadShot: false };
            _spawnEnemyBullet(enemy, sniperDef);
          }
          playEnemyGunshot();
        }
      }

    } else if (def.meleeOnly) {
      if (dist > def.meleeRange) {
        const spd = enemy.speed * dt;
        let mdx = dx / dist, mdz = dz / dist;
        // Separation from nearby enemies
        enemies.forEach(other => {
          if (other === enemy || other.health <= 0) return;
          const sdx = enemy.position.x - other.position.x;
          const sdz = enemy.position.z - other.position.z;
          const sd = Math.hypot(sdx, sdz);
          if (sd > 0 && sd < 2.0) { mdx += (sdx / sd) * 0.6; mdz += (sdz / sd) * 0.6; }
        });
        const mlen = Math.hypot(mdx, mdz) || 1;
        mdx /= mlen; mdz /= mlen;
        const nx = enemy.position.x + mdx * spd;
        const nz = enemy.position.z + mdz * spd;
        if (!collidesWithWalls(nx, enemy.position.z)) enemy.position.x = nx;
        else if (!collidesWithWalls(nx, enemy.position.z + mdz * spd * 0.5)) { enemy.position.x = nx; }
        if (!collidesWithWalls(enemy.position.x, nz)) enemy.position.z = nz;
        else if (!collidesWithWalls(enemy.position.x + mdx * spd * 0.5, nz)) { enemy.position.z = nz; }
      } else {
        enemy.meleeTimer -= dt;
        if (enemy.meleeTimer <= 0) {
          enemy.meleeTimer = def.meleeInterval;
          if (_takeDamage) dealMeleeDamage(def.meleeDamage);
        }
      }
    } else {
      const shootRange = def.shootRange * enemy.scaling.x;
      if (dist > shootRange * 0.6) {
        const spd = enemy.speed * dt;
        let mdx = dx / dist, mdz = dz / dist;
        // Separation
        enemies.forEach(other => {
          if (other === enemy || other.health <= 0) return;
          const sdx = enemy.position.x - other.position.x;
          const sdz = enemy.position.z - other.position.z;
          const sd = Math.hypot(sdx, sdz);
          if (sd > 0 && sd < 2.4) { mdx += (sdx / sd) * 0.5; mdz += (sdz / sd) * 0.5; }
        });
        const mlen = Math.hypot(mdx, mdz) || 1;
        mdx /= mlen; mdz /= mlen;
        const nx = enemy.position.x + mdx * spd;
        const nz = enemy.position.z + mdz * spd;
        // Wall-avoidance: try X, then Z independently if blocked
        if (!collidesWithWalls(nx, enemy.position.z)) enemy.position.x = nx;
        else if (!collidesWithWalls(enemy.position.x, nz)) enemy.position.x = nx;
        if (!collidesWithWalls(enemy.position.x, nz)) enemy.position.z = nz;
        else if (!collidesWithWalls(nx, enemy.position.z)) enemy.position.z = nz;
      }
      enemy.shootTimer -= dt;
      if (enemy.shootTimer <= 0 && dist < shootRange) {
        const si = def.shootInterval;
        enemy.shootTimer = si[0] + Math.random() * (si[1] - si[0]);
        if (_spawnEnemyBullet) _spawnEnemyBullet(enemy, def);
        playEnemyGunshot();
      }
    }

    // Locomotion animation
    if (enemy._rig) {
      updateRiggedLocomotion(enemy, dist);
    } else {
      const walkSpeed = Math.min(1, enemy.speed * 0.3);
      const legSwing = Math.sin(performance.now() * 0.005 * enemy.speed) * 0.5 * walkSpeed;
      if (enemy.parts) {
        enemy.parts.legLeft.rotation.x  = legSwing;
        enemy.parts.legRight.rotation.x = -legSwing;
        enemy.parts.armLeft.rotation.x  = -legSwing * 0.5 + Math.PI / 10;
        enemy.parts.armRight.rotation.x = legSwing * 0.5 - 1.25;
      }
    }

    updateEnemyHealthBar(enemy);
  });
}

// ── Rigged enemy locomotion ───────────────────────────────────────────────────
// Enemies always animate (idle/walk/jog) so they never snap to bind pose.
// GPU skinning + alwaysSelectAsActiveMesh keep the horde affordable.
function updateRiggedLocomotion(enemy, dist) {
  const rig = enemy._rig;
  if (!rig || rig._mode === 'pose') return;
  if (rig._current && !rig._current.isPlaying && rig._currentName) rig._current.play(true);
  const clip = enemy._isZombie ? 'walk'
             : enemy.speed > 2.4 ? 'jog'
             : 'walk';
  rig.playAnim(clip, { speedRatio: Math.max(0.6, Math.min(2.2, enemy.speed / 2.0)) });
}

// ── Wall collision ────────────────────────────────────────────────────────────
function collidesWithWalls(x, z, r = 0.35) {
  return wallColliders.some(w => x + r > w.minX && x - r < w.maxX && z + r > w.minZ && z - r < w.maxZ);
}

// ── Melee damage ──────────────────────────────────────────────────────────────
function dealMeleeDamage(baseDamage) {
  if (player.isDodging) return; // dodge is invincible
  if (player.shieldTimer > 0) return;
  const deflectChance = player.armorDeflectChance || 0;
  const fullImmune = deflectChance >= 1;
  if (fullImmune || Math.random() < deflectChance) return;
  const reduced = baseDamage * (1 - (player.armorReduction || 0));
  if (_takeDamage) _takeDamage(reduced);
}
