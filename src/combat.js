// ── combat.js  Bullets, hit detection, damage, powerups ──────────────────────
import { scene, c3, addShadow, makeCanvasTex, getHeightAtXZ } from './engine.js';
import { player, gs, enemies, bullets, grenadeObjects, powerups, activeBuffs, wallColliders,
         PLAYER_MAX_HEALTH, POWERUP_DURATION, COIN_VALUES, BOSS_DEFEAT_COINS,
         inventory, equipped, saveInventory, saveCoins, saveLevel,
         saveXP, saveStats, saveAchievements, saveHighScores, saveWeaponMastery,
         ACHIEVEMENT_DEFS, RANK_NAMES, RANK_XP } from './state.js';
import { playerBody, playerGun, playerArmRight } from './player.js';
import { playGunshot, playEnemyGunshot, playHeadshot, playHurt, playArmorDeflect,
         playEnemyDeath, playLevelUp, playPickup, playHealChime, playCoinEarn,
         playBossDefeat, playPlayerDeath, playStreakMilestone,
         playSpeedBuff, playDamageBuff, playRapidfireBuff, playBuffExpire,
         playExplosion, playBlockHit, playReload, playMeleeSwing, playMeleeHit,
         playGrenadeThrow, playShieldUp, playShieldBreak, playFreeze,
         playNukeCharge, playRankUp, playAchievementUnlock, playComboUp,
         playAnnouncer, playBulletHit } from './audio.js';
import { spawnFloatingText, spawnImpactParticles, spawnMuzzleFlash,
         spawnDeathBurst, spawnDeflectSparks, createPowerupMesh, POWERUP_TYPES,
         spawnComboText, spawnRankUpText, spawnFreezeEffect, spawnShieldBurst,
         spawnNukeEffect, spawnBulletTrail } from './effects.js';

// ── Shared bullet material ────────────────────────────────────────────────────
const bulletMat = new BABYLON.StandardMaterial('bmat', scene);
bulletMat.emissiveColor = new BABYLON.Color3(1, 0.88, 0);
bulletMat.disableLighting = true;

const enemyBulletMat = new BABYLON.StandardMaterial('ebmat', scene);
enemyBulletMat.emissiveColor = new BABYLON.Color3(1, 0.25, 0.05);
enemyBulletMat.disableLighting = true;

function createBullet(origin, dir, mat, speed, isEnemy = false) {
  const diameter = isEnemy ? 0.3 : 0.72;
  const m = BABYLON.MeshBuilder.CreateSphere('bul', { diameter, segments: isEnemy ? 4 : 10 }, scene);
  m.material = mat;
  m.position.copyFrom(origin);
  m.isPickable = false;
  m.direction = dir.clone().normalize();
  m.speed = speed;
  m.isEnemy = isEnemy;
  m.age = 0;
  return m;
}

function applySpread(dir, spread) {
  if (!spread) return dir.clone();
  return new BABYLON.Vector3(
    dir.x + (Math.random() - 0.5) * spread,
    dir.y + (Math.random() - 0.5) * spread,
    dir.z + (Math.random() - 0.5) * spread
  ).normalize();
}

// ── Aim rotation ──────────────────────────────────────────────────────────────
let _aimRot = null;
let _concurrentDeaths = 0;   // cap simultaneous rigged death animations (hordes)
export function setAimRotation(ar) { _aimRot = ar; }

// ── Player fires ──────────────────────────────────────────────────────────────
export function spawnPlayerBullet(dirOverride) {
  if (!player.canShoot || player.health <= 0) return;
  if (player.isReloading) return;

  const weapon = player.weapon;
  if (!weapon) return;

  // Ammo check
  if (player.ammo <= 0) {
    startReload();
    return;
  }

  let baseDir;
  if (dirOverride) {
    baseDir = dirOverride.clone().normalize();
  } else if (_aimRot) {
    baseDir = new BABYLON.Vector3(
      Math.sin(_aimRot.y),
      Math.sin(_aimRot.x),
      Math.cos(_aimRot.y)
    ).normalize();
  } else {
    return;
  }

  const origin = new BABYLON.Vector3(
    playerBody.position.x + baseDir.x * 1.8,
    playerBody.position.y + 1.4 + baseDir.y * 1.8,
    playerBody.position.z + baseDir.z * 1.8,
  );

  for (let i = 0; i < weapon.pellets; i++) {
    const dir = applySpread(baseDir, weapon.spread);
    const b = createBullet(origin, dir, bulletMat, weapon.speed);
    b.damage = weapon.damage * player.damageMultiplier;
    b.splashRadius = weapon.splashRadius || 0;
    b._startPos = origin.clone();
    bullets.push(b);
  }

  player.ammo = Math.max(0, player.ammo - 1);
  player.sessionShots++;
  if (gs.stats) gs.stats.shotsTotal = (gs.stats.shotsTotal || 0) + 1;
  player.canShoot = false;
  playGunshot(player.weaponKey);
  spawnMuzzleFlash(origin);

  // Weapon mastery
  const wk = player.weaponKey;
  if (gs.weaponMastery[wk] !== undefined) {
    gs.weaponMastery[wk]++;
    if (gs.weaponMastery[wk] % 100 === 0) saveWeaponMastery();
  }

  const coolMs = weapon.cooldown / player.fireRateMultiplier;
  player.cooldownStart = gs.timeAccum;
  player.cooldownTotal = coolMs / 1000;
  setTimeout(() => { player.canShoot = true; }, coolMs);

  updateAmmoDisplay();
}

// ── Reload ────────────────────────────────────────────────────────────────────
export function startReload() {
  if (player.isReloading) return;
  const weapon = player.weapon;
  if (!weapon) return;
  if (player.ammo >= player.maxAmmo) return;

  player.isReloading = true;
  player.reloadTimer = player.reloadDuration;
  playReload();

  const reloadEl = document.getElementById('reload-indicator');
  if (reloadEl) reloadEl.classList.remove('hidden');
}

export function updateReload(dt) {
  if (!player.isReloading) return;
  player.reloadTimer -= dt;

  const ringFill = document.getElementById('reload-ring-fill');
  if (ringFill) {
    const progress = 1 - Math.max(0, player.reloadTimer) / player.reloadDuration;
    ringFill.style.strokeDashoffset = (113 * (1 - progress)).toFixed(2);
  }

  if (player.reloadTimer <= 0) {
    player.isReloading = false;
    player.ammo = player.maxAmmo;
    updateAmmoDisplay();
    const reloadEl = document.getElementById('reload-indicator');
    if (reloadEl) reloadEl.classList.add('hidden');
    if (ringFill) ringFill.style.strokeDashoffset = '113';
  }
}

function updateAmmoDisplay() {
  const ammoEl = document.getElementById('ammo-display');
  if (ammoEl) {
    ammoEl.textContent = player.isReloading ? 'RELOADING...' : `${player.ammo} / ${player.maxAmmo}`;
    ammoEl.classList.toggle('low', player.ammo <= Math.ceil(player.maxAmmo * 0.25) && !player.isReloading);
  }
  const grenEl = document.getElementById('grenade-count');
  if (grenEl) grenEl.textContent = `💣 ${player.grenades}`;
}

// ── Enemy fires ───────────────────────────────────────────────────────────────
export function spawnEnemyBullet(enemy, def) {
  const origin = enemy.position.clone().add(new BABYLON.Vector3(0, 1.6 * (enemy.scaling.x || 1), 0));
  const target = new BABYLON.Vector3(playerBody.position.x, 1.0, playerBody.position.z);
  const baseDir = target.subtract(origin).normalize();
  const pellets = def.pellets || 1;

  for (let i = 0; i < pellets; i++) {
    const dir = applySpread(baseDir, def.spreadShot ? 0.18 : 0.04);
    const b = createBullet(origin, dir, enemyBulletMat, 22, true);
    b.damage = 3 * (def.bulletDamageMult || 1);
    bullets.push(b);
  }
}

// ── Bullet update ─────────────────────────────────────────────────────────────
export function updateBullets(dt) {
  const playerRadius = 0.65;

  for (let i = bullets.length - 1; i >= 0; i--) {
    const b = bullets[i];
    const prevPos = b.position.clone();
    b.position.addInPlace(b.direction.scale(b.speed * dt));
    b.age = (b.age || 0) + 1;

    const { x, z } = b.position;
    if (
      Math.abs(x) > gs.MAP_RADIUS + 10 || Math.abs(z) > gs.MAP_RADIUS + 10 ||
      (b.age > 3 && wallColliders.some(w => x > w.minX && x < w.maxX && z > w.minZ && z < w.maxZ))
    ) {
      if (!b.isEnemy && b._startPos) spawnBulletTrail(b._startPos, b.position, window.__killEffectKey || 'default');
      spawnImpactParticles(b.position, 0x888888, 4);
      b.dispose();
      bullets.splice(i, 1);
      continue;
    }

    if (b.isEnemy) {
      if (player.health > 0) {
        const dx = b.position.x - playerBody.position.x;
        const dz = b.position.z - playerBody.position.z;
        const xzDist = Math.sqrt(dx * dx + dz * dz);
        const relY = b.position.y - playerBody.position.y;
        if (xzDist < 1.0 && relY >= -0.3 && relY <= 2.2) {
          const hitHead = relY > 1.4;
          resolvePlayerHit(b.damage, hitHead, b.position);
          b.dispose();
          bullets.splice(i, 1);
        }
      }
    } else {
      let hit = false;
      for (let j = 0; j < enemies.length; j++) {
        const e = enemies[j];
        if (e.health <= 0) continue;
        const dist = BABYLON.Vector3.Distance(b.position, e.position);
        if (dist < e.hitRadius) {
          const hitHead = dist < e.headRadius;
          player.sessionHits++;
          if (b.splashRadius > 0) {
            resolveExplosion(b.position, b.splashRadius, b.damage);
          } else {
            damageEnemy(e, hitHead ? b.damage * 2.4 : b.damage, hitHead, b.position);
          }
          // Hitmarker
          showHitmarker(hitHead);
          playBulletHit();
          hit = true;
          break;
        }
      }
      if (hit) {
        if (b._startPos) spawnBulletTrail(b._startPos, b.position, window.__killEffectKey || 'default');
        spawnImpactParticles(b.position, 0xffd700, 5);
        b.dispose();
        bullets.splice(i, 1);
      }
    }
  }
}

function showHitmarker(isHead) {
  const hm = document.getElementById('hitmarker');
  if (!hm) return;
  hm.className = 'hitmarker-active' + (isHead ? ' hitmarker-head' : '');
  clearTimeout(hm._t);
  hm._t = setTimeout(() => { hm.className = ''; }, 120);
}

// ── Player hit ────────────────────────────────────────────────────────────────
function resolvePlayerHit(damage, hitHead, hitPos) {
  // VIP invincibility buff
  if (player.invincibleTimer > 0) {
    spawnDeflectSparks(playerBody.position, true);
    spawnFloatingText('INVINCIBLE!', playerBody.position, 0xffd700);
    return;
  }
  // Shield bubble absorbs all damage
  if (player.shieldTimer > 0) {
    spawnDeflectSparks(playerBody.position, true);
    spawnFloatingText('SHIELDED!', playerBody.position, 0x4488ff);
    return;
  }

  const deflect = player.armorDeflectChance || 0;
  const fullImmune = deflect >= 1;
  const hitTorso = !hitHead;
  if (fullImmune || (hitTorso && Math.random() < deflect)) {
    spawnDeflectSparks(playerBody.position, fullImmune);
    spawnFloatingText(fullImmune ? 'DEFLECTED!' : 'BLOCKED!', playerBody.position,
      fullImmune ? 0xffd700 : 0x88aaff);
    if (fullImmune) playArmorDeflect(); else playBlockHit();
    return;
  }
  const finalDmg = damage * (1 - (player.armorReduction || 0));
  takeDamage(finalDmg, hitPos);
}

export function takeDamage(amount, hitPos) {
  if (player.health <= 0) return;
  if (player.isDodging) return; // invincible during dodge

  player.health = Math.max(0, player.health - amount);
  playHurt();
  spawnFloatingText(`-${Math.ceil(amount)}`, playerBody.position, 0xff4444);
  updateUI();
  flashDamage(hitPos);
  // Camera shake on hit
  const shakeStr = Math.min(0.05, amount / 200);
  if (window.__triggerShake) window.__triggerShake(shakeStr, 0.12);
  if (player.health <= 0) playerDeath();
}

function flashDamage(hitPos) {
  const el = document.getElementById('damage-flash');
  if (el) { el.classList.add('active'); setTimeout(() => el.classList.remove('active'), 300); }

  // Damage direction indicator
  if (hitPos) {
    const dx = hitPos.x - playerBody.position.x;
    const dz = hitPos.z - playerBody.position.z;
    const angle = Math.atan2(dx, dz) - (window.__aimRotY || 0);
    const deg = (angle * 180 / Math.PI + 360) % 360;
    let dir = 'top';
    if (deg > 45 && deg <= 135) dir = 'right';
    else if (deg > 135 && deg <= 225) dir = 'bottom';
    else if (deg > 225 && deg <= 315) dir = 'left';
    const indicator = document.getElementById(`dmg-dir-${dir}`);
    if (indicator) {
      indicator.classList.add('active');
      setTimeout(() => indicator.classList.remove('active'), 500);
    }
  }
}

// ── Enemy damage ──────────────────────────────────────────────────────────────
function damageEnemy(enemy, damage, isHead, hitPos) {
  if (isHead) {
    playHeadshot();
    spawnFloatingText('HEADSHOT!', hitPos || enemy.position, 0xffdd00);
    player.sessionHeadshots++;
    gs.stats.allTimeHeadshots++;
    checkAchievement('headshot10', gs.stats.allTimeHeadshots >= 10);
    checkAchievement('headshot100', gs.stats.allTimeHeadshots >= 100);
  }
  enemy.health -= damage;
  spawnFloatingText(`${Math.ceil(damage)}`, hitPos || enemy.position, isHead ? 0xff8800 : 0xff2200);
  spawnImpactParticles(hitPos || enemy.position, 0xff3300, 5);

  // Hit stagger visual
  if (enemy._staggerTimer === undefined) enemy._staggerTimer = 0;
  enemy._staggerTimer = 0.15;

  if (enemy.health <= 0) defeatEnemy(enemy);
}

export function defeatEnemy(enemy, source) {
  enemy.health = 0;
  playEnemyDeath();

  // Get kill effect from armory equipped (stored on player)
  const killEffect = window.__killEffectKey || 'default';
  spawnDeathBurst(enemy.position, killEffect);

  // Coins — doubled if coinmagnet active
  const coinMult = activeBuffs.doublecoins ? 2 : 1;
  const coinVal = (COIN_VALUES[enemy.type] || 5) * coinMult;
  const bossBonus = enemy.type === 'boss' ? BOSS_DEFEAT_COINS : 0;
  gs.coins += coinVal + bossBonus;
  gs.stats.totalCoins = (gs.stats.totalCoins || 0) + coinVal + bossBonus;
  saveCoins();
  playCoinEarn();

  if (enemy.type === 'boss') {
    playBossDefeat();
    checkAchievement('bossKill', true);
  }

  // Score with combo multiplier
  const baseScore = (enemy.scoreValue || 15) * (gs.scoreMult || 1);
  const comboMult = Math.min(10, 1 + Math.floor(gs.combo / 3));
  const finalScore = Math.round(baseScore * comboMult);
  player.score += finalScore;

  // Combo
  gs.combo++;
  gs.comboTimer = 4;
  if (gs.combo >= 2) {
    spawnComboText(enemy.position, gs.combo);
    playComboUp();
  }
  if (gs.combo >= 10) checkAchievement('combo10', true);

  // Kill streak
  gs.killStreak++;
  if (gs.killStreak > gs.stats.bestKillStreak) gs.stats.bestKillStreak = gs.killStreak;

  // Announcer call
  if (gs.combo === 2) playAnnouncer('doubleKill');
  else if (gs.combo === 3) playAnnouncer('tripleKill');
  else if (gs.combo === 5) playAnnouncer('multikill');
  else if (gs.killStreak === 10) { playAnnouncer('onfire'); checkAchievement('streak10', true); }
  else if (gs.killStreak === 20) { playAnnouncer('unstoppable'); checkAchievement('streak20', true); }
  else if (gs.killStreak > 0 && gs.killStreak % 5 === 0) playStreakMilestone();

  // Kill streak bonuses
  if (gs.killStreak === 5) {
    player.speedMultiplier = Math.max(player.speedMultiplier, 1.5);
    activeBuffs.speed = 8;
    spawnFloatingText('KILL STREAK! SPEED UP!', playerBody.position, 0x4cc9ff);
    playSpeedBuff();
  } else if (gs.killStreak === 10) {
    player.shieldTimer = 5;
    spawnShieldBurst(playerBody.position);
    spawnFloatingText('10 STREAK! SHIELD!', playerBody.position, 0x4488ff);
    playShieldUp();
  } else if (gs.killStreak === 15) {
    // Temporary infinite ammo
    player.fireRateMultiplier = Math.max(player.fireRateMultiplier, 2.5);
    activeBuffs.rapidfire = 30;
    spawnFloatingText('15 STREAK! RAPID FIRE!', playerBody.position, 0xff44ff);
    playRapidfireBuff();
  } else if (gs.killStreak === 20) {
    // Coin shower
    for (let i = 0; i < 5; i++) {
      setTimeout(() => {
        gs.coins += 100;
        saveCoins();
        spawnFloatingText('+100 COINS!', playerBody.position.add(new BABYLON.Vector3((Math.random()-0.5)*3, i*0.5, (Math.random()-0.5)*3)), 0xffd700);
        playCoinEarn();
      }, i * 200);
    }
  } else if (gs.killStreak === 25) {
    // Mini airstrike — 5 grenades spread around enemies
    spawnFloatingText('25 STREAK! AIRSTRIKE!', playerBody.position, 0xff8800);
    playNukeCharge();
    const targets = enemies.filter(e => e.health > 0).slice(0, 5);
    if (targets.length === 0) {
      // Spread around player
      for (let i = 0; i < 5; i++) {
        const ang = (i / 5) * Math.PI * 2;
        const landPos = playerBody.position.add(new BABYLON.Vector3(Math.cos(ang) * 10, 0, Math.sin(ang) * 10));
        setTimeout(() => { if (window.__throwGrenadeToTarget) window.__throwGrenadeToTarget(landPos); }, i * 300);
      }
    } else {
      targets.forEach((t, i) => {
        setTimeout(() => resolveExplosion(t.position, 8, 250), i * 300);
      });
    }
  }

  // Stats
  player.sessionKills++;
  gs.stats.allTimeKills = (gs.stats.allTimeKills || 0) + 1;

  // Source-specific kill tracking
  if (source === 'grenade') {
    player.grenadeKillCount++;
    gs.stats.grenadeKills = (gs.stats.grenadeKills || 0) + 1;
    checkAchievement('grenadier', gs.stats.grenadeKills >= 5);
  } else if (source === 'melee') {
    player.meleeKillCount++;
    gs.stats.meleeKills = (gs.stats.meleeKills || 0) + 1;
    checkAchievement('brawler', gs.stats.meleeKills >= 10);
  }

  // XP gain
  const xpGain = (enemy.type === 'boss') ? 200 : { grunt: 15, rusher: 20, heavy: 35, sniper: 25, bomber: 30, medic: 18 }[enemy.type] || 15;
  gainXP(xpGain + (comboMult - 1) * 5);

  // Achievement checks
  checkAchievement('firstKill', gs.stats.allTimeKills >= 1);
  checkAchievement('kills50', gs.stats.allTimeKills >= 50);
  checkAchievement('kills500', gs.stats.allTimeKills >= 500);
  checkAchievement('kills1000', gs.stats.allTimeKills >= 1000);
  checkAchievement('coins10k', gs.stats.totalCoins >= 10000);

  // Kill feed
  addKillFeed(enemy.type, gs.combo >= 2 ? `x${gs.combo}` : '');

  updateUI();

  // Death fall animation then remove
  if (enemy._hpBar) { enemy._hpBar.dispose(); enemy._hpBar = null; }
  if (enemy._hpFill) { enemy._hpFill = null; }
  const idx = enemies.indexOf(enemy);
  if (idx !== -1) enemies.splice(idx, 1);

  // Blood puddle — textured splatter, offset forward so hands land in it
  const puddleRadius = 0.9 + Math.random() * 0.5;
  const puddle = BABYLON.MeshBuilder.CreateDisc('puddle', { radius: puddleRadius, tessellation: 24 }, scene);
  puddle.rotation.x = Math.PI / 2;
  puddle.position.set(enemy.position.x, 0.015, enemy.position.z);
  puddle.isPickable = false;

  const puddleTex = makeCanvasTex(512, 512, (ctx) => {
    const W = 512, H = 512, cx = W / 2, cy = H / 2;
    ctx.clearRect(0, 0, W, H);
    const rng = () => Math.random();

    // Real blood palette — arterial scarlet with warm undertones
    const blood   = (a = 1) => `rgba(200, 28, 38, ${a})`;   // fresh arterial
    const bloodMid= (a = 1) => `rgba(160, 15, 22, ${a})`;   // mid-tone
    const bloodDark=(a = 1) => `rgba(100,  8, 12, ${a})`;   // pooled/venous
    const shine   = (a = 1) => `rgba(255,170,160, ${a})`;   // wet specular

    // ── Main spatter spikes ───────────────────────────────────────────────────
    const spikeCount = 22 + Math.floor(rng() * 10);
    for (let i = 0; i < spikeCount; i++) {
      const angle = (i / spikeCount) * Math.PI * 2 + rng() * 0.5;
      const len   = 60 + rng() * 130;
      const width = 4 + rng() * 22;
      const tipX  = cx + Math.cos(angle) * (28 + len);
      const tipY  = cy + Math.sin(angle) * (28 + len);
      const baseX = cx + Math.cos(angle) * 6;
      const baseY = cy + Math.sin(angle) * 6;
      const perpX = -Math.sin(angle) * width;
      const perpY =  Math.cos(angle) * width;

      // Deep gradient: bright scarlet base → dark venous tip
      const sg = ctx.createLinearGradient(baseX, baseY, tipX, tipY);
      sg.addColorStop(0,    blood(1));
      sg.addColorStop(0.35, `rgba(185, 22, 32, 1)`);
      sg.addColorStop(0.7,  bloodMid(0.92));
      sg.addColorStop(1,    bloodDark(0));
      ctx.fillStyle = sg;
      ctx.beginPath();
      ctx.moveTo(baseX + perpX, baseY + perpY);
      ctx.quadraticCurveTo(
        (baseX + tipX) / 2 + (rng() - 0.5) * width * 1.4,
        (baseY + tipY) / 2 + (rng() - 0.5) * width * 1.4,
        tipX, tipY
      );
      ctx.lineTo(baseX - perpX, baseY - perpY);
      ctx.closePath();
      ctx.fill();

      // Wet-shine streak along centre of spike
      const shineG = ctx.createLinearGradient(baseX, baseY, tipX, tipY);
      shineG.addColorStop(0,   shine(0.55));
      shineG.addColorStop(0.4, shine(0.25));
      shineG.addColorStop(1,   shine(0));
      ctx.strokeStyle = shineG;
      ctx.lineWidth = Math.max(1, width * 0.22);
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(baseX, baseY);
      ctx.lineTo(tipX, tipY);
      ctx.stroke();

      // Teardrop at tip
      if (rng() > 0.25) {
        const dr = 4 + rng() * 16;
        const dg = ctx.createRadialGradient(tipX - dr*0.2, tipY - dr*0.2, 1, tipX, tipY, dr);
        dg.addColorStop(0,    shine(0.7));
        dg.addColorStop(0.15, blood(1));
        dg.addColorStop(0.6,  bloodMid(0.95));
        dg.addColorStop(1,    bloodDark(0));
        ctx.fillStyle = dg;
        ctx.beginPath();
        ctx.arc(tipX, tipY, dr, 0, Math.PI * 2);
        ctx.fill();

        // Satellite micro-drops near tip
        const sat = 1 + Math.floor(rng() * 3);
        for (let s = 0; s < sat; s++) {
          const sa = angle + (rng() - 0.5) * 0.9;
          const sd = dr * (1.4 + rng() * 1.8);
          const sx2 = tipX + Math.cos(sa) * sd;
          const sy2 = tipY + Math.sin(sa) * sd;
          const sr2 = 1 + rng() * (dr * 0.45);
          const sg2 = ctx.createRadialGradient(sx2, sy2, 0, sx2, sy2, sr2);
          sg2.addColorStop(0,   blood(1));
          sg2.addColorStop(0.6, bloodMid(0.85));
          sg2.addColorStop(1,   bloodDark(0));
          ctx.fillStyle = sg2;
          ctx.beginPath();
          ctx.arc(sx2, sy2, sr2, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    }

    // ── Cast-off streaks (curved arcs of blood) ───────────────────────────────
    for (let i = 0; i < 8; i++) {
      const a1 = rng() * Math.PI * 2;
      const d1 = 80 + rng() * 100;
      const d2 = d1 + 60 + rng() * 80;
      const x1 = cx + Math.cos(a1) * d1;
      const y1 = cy + Math.sin(a1) * d1;
      const x2 = cx + Math.cos(a1 + 0.6 + rng() * 0.8) * d2;
      const y2 = cy + Math.sin(a1 + 0.6 + rng() * 0.8) * d2;
      const cg = ctx.createLinearGradient(x1, y1, x2, y2);
      cg.addColorStop(0,   blood(0.9));
      cg.addColorStop(0.5, bloodMid(0.7));
      cg.addColorStop(1,   bloodDark(0));
      ctx.strokeStyle = cg;
      ctx.lineWidth = 1.5 + rng() * 5;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(x1, y1);
      const mcx = cx + (rng() - 0.5) * 120;
      const mcy = cy + (rng() - 0.5) * 120;
      ctx.quadraticCurveTo(mcx, mcy, x2, y2);
      ctx.stroke();
    }

    // ── Fine scattered drops ──────────────────────────────────────────────────
    for (let i = 0; i < 70; i++) {
      const a   = rng() * Math.PI * 2;
      const d   = 100 + rng() * 160;
      const sx  = cx + Math.cos(a) * d;
      const sy  = cy + Math.sin(a) * d;
      const sr  = 1.5 + rng() * 10;
      const dg  = ctx.createRadialGradient(sx - sr*0.25, sy - sr*0.25, 0.5, sx, sy, sr);
      dg.addColorStop(0,    shine(0.6));
      dg.addColorStop(0.12, blood(1));
      dg.addColorStop(0.6,  bloodMid(0.9));
      dg.addColorStop(1,    bloodDark(0));
      ctx.fillStyle = dg;
      ctx.beginPath();
      ctx.arc(sx, sy, sr, 0, Math.PI * 2);
      ctx.fill();
    }

  });
  puddleTex.hasAlpha = true;

  const puddleMat = new BABYLON.StandardMaterial('puddleMat', scene);
  puddleMat.emissiveTexture  = puddleTex;
  puddleMat.disableLighting  = true;
  puddleMat.hasAlpha         = true;
  puddleMat.backFaceCulling  = false;
  puddle.material = puddleMat;

  const _cleanupCorpse = () => {
    // Lie on the ground for 3 seconds, then disappear with the puddle
    setTimeout(() => {
      enemy.isVisible = false;
      enemy.getChildMeshes(false).forEach(m => { m.isVisible = false; });
      if (!puddle.isDisposed()) { puddleMat.dispose(); puddle.dispose(); }
      setTimeout(() => { if (!enemy.isDisposed()) enemy.dispose(); }, 100);
    }, 3000);
  };

  if (enemy._rig && enemy._rig.playDeath) {
    // Rigged model: real death animation clip (capped concurrency for hordes)
    _concurrentDeaths++;
    if (_concurrentDeaths <= 8) {
      enemy._rig.playDeath(() => { _concurrentDeaths--; _cleanupCorpse(); });
    } else {
      _concurrentDeaths--;
      _cleanupCorpse();
    }
  } else {
    let fallTime = 0;
    const fallObs = scene.onBeforeRenderObservable.add(() => {
      fallTime += scene.getEngine().getDeltaTime() / 1000;
      const t = Math.min(fallTime / 0.55, 1);
      enemy.rotation.x = t * (Math.PI / 2);
      // Lift slightly as the body rotates so the torso thickness doesn't clip the floor
      enemy.position.y = t * 0.14;
      if (t >= 1) {
        scene.onBeforeRenderObservable.remove(fallObs);
        _cleanupCorpse();
      }
    });
  }

  // Check level clear
  if (gs.mapId !== 'lobby' && gs.gameMode !== 'endless' && enemies.every(e => e.health <= 0)) {
    if (gs.gameMode === 'speedrun') {
      const elapsed = (Date.now() - gs.speedrunStartTime) / 1000;
      showLevelClearSummary(elapsed);
    } else {
      showLevelClearSummary();
    }
    setTimeout(nextLevel, 1800);
  }
}

// ── XP / Rank ─────────────────────────────────────────────────────────────────
function gainXP(amount) {
  gs.xp += amount;
  const prevRank = gs.rank;
  for (let i = RANK_XP.length - 1; i >= 0; i--) {
    if (gs.xp >= RANK_XP[i]) { gs.rank = i; break; }
  }
  if (gs.rank > prevRank) {
    spawnRankUpText(playerBody.position, RANK_NAMES[gs.rank]);
    playRankUp();
  }
  saveXP();
  updateXPBar();
}

function updateXPBar() {
  const bar = document.getElementById('xp-bar-fill');
  const lbl = document.getElementById('rank-label');
  if (!bar || !lbl) return;
  const rank = gs.rank;
  const nextThreshold = RANK_XP[rank + 1] || RANK_XP[rank];
  const curThreshold = RANK_XP[rank];
  const pct = nextThreshold > curThreshold
    ? ((gs.xp - curThreshold) / (nextThreshold - curThreshold)) * 100
    : 100;
  bar.style.width = Math.min(100, pct) + '%';
  lbl.textContent = RANK_NAMES[rank];
}

// ── Kill feed ─────────────────────────────────────────────────────────────────
export function addKillFeed(enemyType, suffix = '') {
  const feed = document.getElementById('kill-feed');
  if (!feed) return;
  const row = document.createElement('div');
  row.className = 'kf-row';
  const typeColors = { grunt: '#e63946', rusher: '#ff8c1a', heavy: '#6677aa', boss: '#cc44ff',
                       sniper: '#ff4466', bomber: '#ff6600', medic: '#44ff88' };
  row.innerHTML = `<span style="color:${typeColors[enemyType]||'#fff'}">⚔ ${enemyType.toUpperCase()}</span>${suffix ? ` <span class="kf-combo">${suffix}</span>` : ''}`;
  feed.prepend(row);
  setTimeout(() => row.classList.add('kf-fade'), 2500);
  setTimeout(() => { if (row.parentNode) row.remove(); }, 3500);
  while (feed.children.length > 6) feed.lastChild.remove();
}

// ── Level clear summary ───────────────────────────────────────────────────────
export function showLevelClearSummary(speedrunTime) {
  const el = document.getElementById('level-clear-screen');
  if (!el) return;
  const acc = player.sessionShots > 0 ? Math.round((player.sessionHits / player.sessionShots) * 100) : 0;
  el.innerHTML = `
    <div class="lcs-title">WAVE CLEAR!</div>
    <div class="lcs-row"><span>Level</span><span>${gs.level}</span></div>
    <div class="lcs-row"><span>Kills This Wave</span><span>${player.sessionKills}</span></div>
    <div class="lcs-row"><span>Headshots</span><span>${player.sessionHeadshots}</span></div>
    <div class="lcs-row"><span>Accuracy</span><span>${acc}%</span></div>
    <div class="lcs-row"><span>Score</span><span>${player.score}</span></div>
    ${speedrunTime ? `<div class="lcs-row"><span>Time</span><span>${speedrunTime.toFixed(1)}s</span></div>` : ''}
  `;
  el.classList.remove('hidden');
  player.sessionKills = 0;
  player.sessionHeadshots = 0;
  player.sessionShots = 0;
  player.sessionHits = 0;
  setTimeout(() => el.classList.add('hidden'), 2000);
}

// ── Achievement system ────────────────────────────────────────────────────────
export function checkAchievement(key, condition) {
  if (!condition || gs.achievements[key]) return;
  gs.achievements[key] = true;
  saveAchievements();
  const def = ACHIEVEMENT_DEFS[key];
  if (!def) return;
  playAchievementUnlock();
  // Toast notification
  const toast = document.getElementById('achievement-toast');
  if (toast) {
    toast.innerHTML = `${def.icon} <strong>${def.name}</strong><br><small>${def.desc}</small>`;
    toast.classList.remove('hidden');
    clearTimeout(toast._t);
    toast._t = setTimeout(() => toast.classList.add('hidden'), 3500);
  }
}

// ── Grenade aim arc ───────────────────────────────────────────────────────────
const THROW_SPEED = 22;
const THROW_UP    = 0.38;   // upward fraction of velocity
const THROW_H     = Math.sqrt(1 - THROW_UP * THROW_UP); // horizontal fraction

let _arcMesh       = null;
let _discMesh      = null;
let _discMat       = null;
let _grenadeAiming = false;

function _simArc(origin) {
  const vx = Math.sin(_aimRot.y) * THROW_H * THROW_SPEED;
  const vy = THROW_UP * THROW_SPEED;
  const vz = Math.cos(_aimRot.y) * THROW_H * THROW_SPEED;
  const pts = [];
  let px = origin.x, py = origin.y, pz = origin.z;
  let cvx = vx, cvy = vy, cvz = vz;
  const dt = 0.04;
  let land = null;
  for (let i = 0; i < 90; i++) {
    pts.push(new BABYLON.Vector3(px, Math.max(py, 0.05), pz));
    cvy -= 18 * dt;
    px += cvx * dt; py += cvy * dt; pz += cvz * dt;
    if (py <= 0.05) {
      land = new BABYLON.Vector3(px, 0.05, pz);
      pts.push(land);
      break;
    }
  }
  return { pts, land: land || pts[pts.length - 1],
           vel: new BABYLON.Vector3(vx, vy, vz) };
}

export function startGrenadeAim() {
  _grenadeAiming = true;
}

export function updateGrenadeAim() {
  if (!_grenadeAiming || !_aimRot || !playerBody) return null;
  const origin = playerBody.position.clone().add(new BABYLON.Vector3(0, 1.5, 0));
  const { pts, land } = _simArc(origin);

  // Arc line — dispose+recreate is cheap for ~60 points
  if (_arcMesh && !_arcMesh.isDisposed()) _arcMesh.dispose();
  if (pts.length >= 2) {
    _arcMesh = BABYLON.MeshBuilder.CreateLines('grenArc', { points: pts }, scene);
    _arcMesh.color = new BABYLON.Color3(1, 0.55, 0.05);
    _arcMesh.alpha = 0.9;
    _arcMesh.isPickable = false;
  }

  // Landing zone disc (created once, repositioned each frame)
  if (!_discMat) {
    _discMat = new BABYLON.StandardMaterial('grenDiscM', scene);
    _discMat.emissiveColor = new BABYLON.Color3(1, 0.35, 0);
    _discMat.alpha = 0.38;
    _discMat.disableLighting = true;
    _discMat.backFaceCulling = false;
  }
  if (!_discMesh || _discMesh.isDisposed()) {
    _discMesh = BABYLON.MeshBuilder.CreateDisc(
      'grenDisc', { radius: 3.5, tessellation: 28 }, scene
    );
    _discMesh.rotation.x = Math.PI / 2;
    _discMesh.isPickable = false;
    _discMesh.material = _discMat;
  }
  _discMesh.position.set(land.x, 0.06, land.z);

  return land;
}

export function stopGrenadeAim() {
  _grenadeAiming = false;
  if (_arcMesh  && !_arcMesh.isDisposed())  { _arcMesh.dispose();  _arcMesh  = null; }
  if (_discMesh && !_discMesh.isDisposed()) { _discMesh.dispose(); _discMesh = null; }
}

export function throwGrenadeToTarget(landPos) {
  if (player.grenades <= 0 || player.health <= 0 || !landPos || !_aimRot) return;
  player.grenades--;
  updateAmmoDisplay();
  playGrenadeThrow();

  const origin = playerBody.position.clone().add(new BABYLON.Vector3(0, 1.5, 0));
  const { vel } = _simArc(origin);

  const mat = new BABYLON.StandardMaterial('grenMat_t', scene);
  mat.emissiveColor = new BABYLON.Color3(1, 0.55, 0.05);
  mat.disableLighting = true;

  const g = BABYLON.MeshBuilder.CreateSphere('grenade', { diameter: 0.35, segments: 6 }, scene);
  g.material = mat;
  g.position.copyFrom(origin);
  g._vel        = vel.clone();
  g._life       = 4.0;
  g._bounced    = false;
  g._targetPos  = landPos.clone();
  grenadeObjects.push(g);
}

// Keep old instant-throw for backwards compat (no longer called by controls)
export function throwGrenade() {
  if (!_aimRot) return;
  const dummyLand = playerBody.position.clone().add(
    new BABYLON.Vector3(Math.sin(_aimRot.y) * 12, 0, Math.cos(_aimRot.y) * 12)
  );
  throwGrenadeToTarget(dummyLand);
}

export function updateGrenades(dt) {
  for (let i = grenadeObjects.length - 1; i >= 0; i--) {
    const g = grenadeObjects[i];
    if (g.isDisposed()) { grenadeObjects.splice(i, 1); continue; }

    g._vel.y -= 18 * dt;
    g.position.addInPlace(g._vel.scale(dt));
    g.rotation.x += dt * 6;

    // Floor bounce (terrain-aware: bounces off the ground surface at this x/z)
    const groundY = getHeightAtXZ(g.position.x, g.position.z) + 0.3;
    if (g.position.y < groundY && !g._bounced) {
      g.position.y = groundY;
      g._vel.y = Math.abs(g._vel.y) * 0.4;
      g._vel.x *= 0.7;
      g._vel.z *= 0.7;
      g._bounced = true;
    }

    // Wall bounce
    const { x, z } = g.position;
    if (wallColliders.some(w => x > w.minX && x < w.maxX && z > w.minZ && z < w.maxZ)) {
      g._vel.x *= -0.5;
      g._vel.z *= -0.5;
    }

    // Detonate early if close to aimed target
    if (g._targetPos) {
      const td = BABYLON.Vector3.Distance(g.position, g._targetPos);
      if (td < 1.2 || (g.position.y <= 0.35 && td < 5)) g._life = 0;
    }

    // Fuse warning — flash red/orange as grenade approaches detonation
    if (g._life <= 1.5 && g.material) {
      const flash = Math.sin(g._life * 25) > 0;
      g.material.emissiveColor = flash
        ? new BABYLON.Color3(1, 0.1, 0)
        : new BABYLON.Color3(1, 0.5, 0.05);
    }

    g._life -= dt;
    if (g._life <= 0) {
      // HUGE EXPLOSION
      playExplosion();
      spawnImpactParticles(g.position, 0xffffff, 22);
      spawnImpactParticles(g.position, 0xff8800, 55);
      spawnImpactParticles(g.position, 0xff3300, 45);
      spawnImpactParticles(g.position, 0xffcc00, 30);
      spawnFloatingText('💥 BOOM! 💥', g.position.add(new BABYLON.Vector3(0, 1.5, 0)), 0xff4400);
      // Shockwave ring using a second burst slightly offset
      for (let ri = 0; ri < 3; ri++) {
        const rp = g.position.add(new BABYLON.Vector3(
          (Math.random()-0.5)*3, 0.3, (Math.random()-0.5)*3
        ));
        spawnImpactParticles(rp, 0xff6600, 18);
      }

      const RADIUS = 14;
      const BASE_DMG = 180 * player.damageMultiplier;
      let grenadeKills = 0;
      enemies.forEach(e => {
        if (e.health <= 0) return;
        const d = BABYLON.Vector3.Distance(g.position, e.position);
        if (d < RADIUS) {
          const falloff = 1 - d / RADIUS;
          const prevHealth = e.health;
          e.health -= BASE_DMG * falloff;
          spawnFloatingText(`${Math.ceil(BASE_DMG * falloff)}`, e.position, 0xff8800);
          spawnImpactParticles(e.position, 0xff3300, 5);
          if (e.health <= 0 && prevHealth > 0) {
            defeatEnemy(e, 'grenade');
            grenadeKills++;
          }
        }
      });

      // Player self-damage
      const pd = BABYLON.Vector3.Distance(g.position, playerBody.position);
      if (pd < RADIUS && player.shieldTimer <= 0) {
        takeDamage(40 * (1 - pd / RADIUS));
      }

      g.dispose();
      grenadeObjects.splice(i, 1);
    }
  }
}

// ── Melee attack ──────────────────────────────────────────────────────────────
export function performMelee() {
  if (player.meleeCooldown > 0 || player.health <= 0) return;
  player.meleeCooldown = 0.65;
  playMeleeSwing();

  const MELEE_RANGE = 3.5;
  const MELEE_DMG = 80 * player.damageMultiplier;
  let hit = false;

  enemies.forEach(e => {
    if (e.health <= 0) return;
    const d = BABYLON.Vector3.Distance(playerBody.position, e.position);
    if (d < MELEE_RANGE) {
      hit = true;
      playMeleeHit();
      spawnImpactParticles(e.position, 0xffcc00, 10);
      const prevHealth = e.health;
      e.health -= MELEE_DMG;
      spawnFloatingText(`${MELEE_DMG} MELEE!`, e.position, 0xffaa00);
      if (e.health <= 0 && prevHealth > 0) defeatEnemy(e, 'melee');
    }
  });

  if (!hit) {
    spawnFloatingText('Whoosh!', playerBody.position.add(new BABYLON.Vector3(0, 2, 0)), 0x888888);
  }
}

// ── Melee cooldown update ─────────────────────────────────────────────────────
export function updateMeleeCooldown(dt) {
  if (player.meleeCooldown > 0) player.meleeCooldown -= dt;
  if (player.shieldTimer > 0) {
    player.shieldTimer -= dt;
    if (player.shieldTimer <= 0) {
      player.shieldTimer = 0;
      playShieldBreak();
      spawnFloatingText('Shield Gone!', playerBody.position, 0x4488ff);
    }
  }
}

// ── Combo timer update ────────────────────────────────────────────────────────
export function updateCombo(dt) {
  if (gs.combo > 0) {
    gs.comboTimer -= dt;
    if (gs.comboTimer <= 0) {
      gs.combo = 0;
      gs.comboTimer = 0;
      updateComboDisplay();
    }
  }
  updateComboDisplay();
}

function updateComboDisplay() {
  const el = document.getElementById('combo-display');
  if (!el) return;
  if (gs.combo >= 2) {
    el.textContent = `x${gs.combo} COMBO`;
    el.classList.remove('hidden');
    el.style.color = ['#fff','#ffff44','#ff8844','#ff4444','#ff44ff','#44ffff'][Math.min(gs.combo-2, 5)];
  } else {
    el.classList.add('hidden');
  }
}

// ── Rocket splash ─────────────────────────────────────────────────────────────
export function resolveExplosion(position, radius, baseDamage) {
  playExplosion();
  spawnImpactParticles(position, 0xff6600, 20);
  spawnFloatingText('BOOM!', position, 0xff8800);
  if (window.__triggerShake) window.__triggerShake(0.07, 0.18);

  enemies.forEach(e => {
    if (e.health <= 0) return;
    const d = BABYLON.Vector3.Distance(position, e.position);
    if (d < radius) {
      const falloff = 1 - d / radius;
      damageEnemy(e, baseDamage * falloff, false, position);
    }
  });
  const pd = BABYLON.Vector3.Distance(position, playerBody.position);
  if (pd < radius) {
    const falloff = 1 - pd / radius;
    takeDamage(80 * falloff);
  }
}

// ── Level progression ─────────────────────────────────────────────────────────
function nextLevel() {
  gs.level++;
  saveLevel();
  playLevelUp();
  // Replenish grenade on level up
  player.grenades = Math.min(player.maxGrenades, player.grenades + 1);
  updateAmmoDisplay();
  if (window.__spawnEnemiesForLevel) window.__spawnEnemiesForLevel(gs.level);
}

function playerDeath() {
  playPlayerDeath();
  gs.started = false;

  // Save run stats
  if (player.score > (gs.stats.bestScore || 0)) gs.stats.bestScore = player.score;
  if (gs.level > (gs.stats.bestLevel || 1)) gs.stats.bestLevel = gs.level;
  saveStats();

  // Score achievement
  checkAchievement('score10k', player.score >= 10000);
  checkAchievement('level10', gs.level >= 10);
  checkAchievement('level25', gs.level >= 25);
  checkAchievement('level50', gs.level >= 50);

  // High score
  gs.highScores.push({ score: player.score, level: gs.level, map: gs.mapId, date: new Date().toLocaleDateString() });
  gs.highScores.sort((a, b) => b.score - a.score);
  if (gs.highScores.length > 10) gs.highScores.length = 10;
  saveHighScores();

  document.getElementById('overlay').style.pointerEvents = '';

  // Show death screen
  showDeathScreen();

  setTimeout(() => {
    gs.level = 1;
    saveLevel();
    player.health = PLAYER_MAX_HEALTH;
    player.score = 0;
    gs.killStreak = 0;
    gs.combo = 0;
    gs.scoreMult = 1;
    player.shieldTimer = 0;
    player.isDodging = false;
    player.sessionKills = 0;
    player.sessionHeadshots = 0;
    player.sessionShots = 0;
    player.sessionHits = 0;
    updateUI();
    const ss = document.getElementById('start-screen');
    if (ss) { ss.classList.remove('hidden'); ss.style.display = ''; }
    const ds = document.getElementById('death-screen');
    if (ds) ds.classList.add('hidden');
  }, 4000);
}

function showDeathScreen() {
  const el = document.getElementById('death-screen');
  if (!el) return;
  const hs = gs.highScores[0];
  el.innerHTML = `
    <div class="ds-title">YOU DIED</div>
    <div class="ds-grid">
      <div class="ds-row"><span>Final Level</span><span>${gs.level}</span></div>
      <div class="ds-row"><span>Score</span><span>${player.score}</span></div>
      <div class="ds-row"><span>Kill Streak</span><span>${gs.killStreak}</span></div>
      <div class="ds-row"><span>Kills</span><span>${gs.stats.allTimeKills}</span></div>
      <div class="ds-row"><span>Headshots</span><span>${gs.stats.allTimeHeadshots}</span></div>
      <div class="ds-row"><span>Best Score</span><span>${gs.stats.bestScore}</span></div>
    </div>
    <div class="ds-sub">Respawning in 4 seconds...</div>
  `;
  el.classList.remove('hidden');
}

// ── UI update ─────────────────────────────────────────────────────────────────
function updateUI() {
  const h = document.getElementById('health');
  if (h) h.textContent = `HP: ${Math.max(0, Math.ceil(player.health))} / ${player.maxHealth}`;
  const s = document.getElementById('score');
  if (s) s.textContent = `Score: ${player.score}`;
  const c = document.getElementById('coins');
  if (c) c.textContent = `Coins: ${gs.coins}`;
  const ks = document.getElementById('killstreak');
  if (ks) {
    ks.textContent = `Streak: ${gs.killStreak} 🔥`;
    ks.classList.toggle('hidden', gs.killStreak < 2);
  }
  updateXPBar();
}

// ── Powerups ──────────────────────────────────────────────────────────────────
const _pendingRespawns = {};

export function spawnPowerupsForLevel() {
  powerups.forEach(p => { if (!p.isDisposed()) p.dispose(); });
  powerups.length = 0;
  Object.keys(_pendingRespawns).forEach(k => delete _pendingRespawns[k]);

  const types = Object.keys(POWERUP_TYPES);
  const count = Math.min(3 + Math.floor(gs.level / 3), 7);
  for (let i = 0; i < count; i++) {
    let x, z;
    do {
      const angle = Math.random() * Math.PI * 2;
      const radius = 8 + Math.random() * 40;
      x = Math.round(playerBody.position.x + Math.cos(angle) * radius);
      z = Math.round(playerBody.position.z + Math.sin(angle) * radius);
    } while (gs.isInsideMapInterior(x, z));
    const type = types[Math.floor(Math.random() * types.length)];
    const m = createPowerupMesh(type);
    m.position.set(x, 1.2, z);
    powerups.push(m);
  }
}

export function updatePowerups(dt) {
  const t = gs.timeAccum;
  const coinMagnetActive = !!activeBuffs.coinmagnet;

  for (let i = powerups.length - 1; i >= 0; i--) {
    const p = powerups[i];
    if (p.isDisposed()) { powerups.splice(i, 1); continue; }
    p.position.y = 1.2 + Math.sin(t * 2 + (p._puBobPhase || 0)) * 0.18;
    p.rotation.y += dt * 1.2;

    // Coin magnet pulls ALL powerups
    if (coinMagnetActive) {
      const dx = playerBody.position.x - p.position.x;
      const dz = playerBody.position.z - p.position.z;
      const dist = Math.hypot(dx, dz);
      if (dist < 30 && dist > 0.5) {
        const pull = Math.min(20, 120 / dist);
        p.position.x += (dx / dist) * pull * dt;
        p.position.z += (dz / dist) * pull * dt;
      }
    }

    const d = BABYLON.Vector3.Distance(p.position, playerBody.position);
    if (d < 1.8) {
      applyPowerup(p._puType, p.position.clone());
      p.dispose();
      powerups.splice(i, 1);
    }
  }
}

function applyPowerup(type, spawnPos) {
  playPickup();

  if (type === 'health') {
    const gain = 150;
    player.health = Math.min(PLAYER_MAX_HEALTH, player.health + gain);
    spawnFloatingText(`+${gain} HP`, playerBody.position, 0x4cff6e);
    playHealChime();
    updateUI();
    if (spawnPos) {
      setTimeout(() => {
        const m = createPowerupMesh('health');
        m.position.copyFrom(spawnPos);
        m.position.y = 1.2;
        powerups.push(m);
      }, 15000);
    }

  } else if (type === 'speed') {
    player.speedMultiplier = 1.7;
    activeBuffs.speed = POWERUP_DURATION;
    playSpeedBuff();
    if (spawnPos) _pendingRespawns.speed = spawnPos.clone();

  } else if (type === 'damage') {
    player.damageMultiplier = Math.max(player.damageMultiplier, 2);
    activeBuffs.damage = POWERUP_DURATION;
    playDamageBuff();
    if (spawnPos) _pendingRespawns.damage = spawnPos.clone();

  } else if (type === 'rapidfire') {
    player.fireRateMultiplier = 2.2;
    activeBuffs.rapidfire = POWERUP_DURATION;
    playRapidfireBuff();
    if (spawnPos) _pendingRespawns.rapidfire = spawnPos.clone();

  } else if (type === 'shield') {
    player.shieldTimer = 15;
    spawnShieldBurst(playerBody.position);
    playShieldUp();
    activeBuffs.shield = 15;
    if (spawnPos) _pendingRespawns.shield = spawnPos.clone();

  } else if (type === 'freeze') {
    playFreeze();
    enemies.forEach(e => {
      if (e.health <= 0) return;
      e._frozen = 6.0;
      spawnFreezeEffect(e.position);
    });
    activeBuffs.freeze = 1;

  } else if (type === 'scoremult') {
    gs.scoreMult = 2;
    activeBuffs.scoremult = POWERUP_DURATION;
    if (spawnPos) _pendingRespawns.scoremult = spawnPos.clone();

  } else if (type === 'coinmagnet') {
    activeBuffs.coinmagnet = POWERUP_DURATION;
    if (spawnPos) _pendingRespawns.coinmagnet = spawnPos.clone();

  } else if (type === 'doublecoins') {
    activeBuffs.doublecoins = POWERUP_DURATION;
    if (spawnPos) _pendingRespawns.doublecoins = spawnPos.clone();

  } else if (type === 'ammobox') {
    player.ammo = player.maxAmmo;
    player.grenades = player.maxGrenades;
    player.isReloading = false;
    player.reloadTimer = 0;
    updateAmmoDisplay();

  } else if (type === 'nuke') {
    playNukeCharge();
    spawnNukeEffect(playerBody.position);
    setTimeout(() => {
      const toKill = [...enemies.filter(e => e.health > 0)];
      toKill.forEach(e => defeatEnemy(e));
      spawnFloatingText('☢️ NUKE STRIKE!', playerBody.position, 0xff8800);
    }, 5000);
  }

  const icon = POWERUP_TYPES[type]?.label || type;
  spawnFloatingText(icon, playerBody.position.add(new BABYLON.Vector3(0, 1, 0)), 0x44ffaa);
  updateBuffBar();
}

export function updateBuffTimers(dt) {
  Object.keys(activeBuffs).forEach(key => {
    activeBuffs[key] -= dt;
    if (activeBuffs[key] <= 0) {
      delete activeBuffs[key];
      playBuffExpire();
      if (key === 'speed')     { player.speedMultiplier = 1; }
      if (key === 'damage')    { player.damageMultiplier = 1; }
      if (key === 'rapidfire') { player.fireRateMultiplier = 1; }
      if (key === 'shield')    { player.shieldTimer = 0; }
      if (key === 'scoremult') { gs.scoreMult = 1; }
      if (_pendingRespawns[key]) {
        const m = createPowerupMesh(key);
        m.position.copyFrom(_pendingRespawns[key]);
        m.position.y = 1.2;
        powerups.push(m);
        delete _pendingRespawns[key];
      }
    }
  });
  // Shield timer also ticks down separately in updateMeleeCooldown
  updateBuffBar();
}

function updateBuffBar() {
  const bar = document.getElementById('powerup-bar');
  if (!bar) return;
  bar.innerHTML = Object.keys(activeBuffs).map(k => {
    const def = POWERUP_TYPES[k];
    const t = Math.ceil(activeBuffs[k]);
    return `<span class="buff-tag">${def?.icon || ''} ${def?.label || k}${t > 0 ? ` ${t}s` : ''}</span>`;
  }).join('');
}

export function updateCooldownBar() {
  const fill = document.getElementById('cooldown-fill');
  if (!fill) return;
  if (player.canShoot || !player.cooldownTotal) { fill.style.width = '100%'; return; }
  const elapsed = gs.timeAccum - player.cooldownStart;
  const progress = Math.min(1, Math.max(0, elapsed / player.cooldownTotal));
  fill.style.width = `${progress * 100}%`;
}

// ── Boss bar ──────────────────────────────────────────────────────────────────
let _bossBarPlane = null;
let _bossBarTex   = null;
let _trackedBoss  = null;

export function updateBossBar() {
  const hudBar = document.getElementById('boss-bar');
  const fill   = document.getElementById('boss-bar-fill');
  const label  = document.getElementById('boss-bar-label');
  if (!hudBar) return;

  const boss = enemies.find(e => e.type === 'boss');

  if (!boss) {
    hudBar.classList.add('hidden');
    if (_bossBarPlane) { _bossBarPlane.dispose(); _bossBarPlane = null; _bossBarTex = null; _trackedBoss = null; }
    return;
  }

  hudBar.classList.remove('hidden');
  const ratio = Math.max(0, boss.health / boss.maxHealth);
  if (fill)  fill.style.width = `${ratio * 100}%`;
  if (label) label.textContent = `BOSS — ${Math.max(0, Math.ceil(boss.health))} / ${Math.ceil(boss.maxHealth)}`;

  if (_trackedBoss !== boss) {
    if (_bossBarPlane) _bossBarPlane.dispose();
    const W = 256, H = 32;
    _bossBarTex = new BABYLON.DynamicTexture('bossHpTex', { width: W, height: H }, scene, false);
    _bossBarTex.hasAlpha = true;
    const mat = new BABYLON.StandardMaterial('bossHpMat', scene);
    mat.diffuseTexture  = _bossBarTex;
    mat.emissiveColor   = new BABYLON.Color3(1, 1, 1);
    mat.disableLighting = true;
    mat.backFaceCulling = false;
    mat.diffuseTexture.hasAlpha = true;
    _bossBarPlane = BABYLON.MeshBuilder.CreatePlane('bossHpPlane', { width: 4, height: 0.55 }, scene);
    _bossBarPlane.material  = mat;
    _bossBarPlane.billboardMode = BABYLON.Mesh.BILLBOARDMODE_ALL;
    _bossBarPlane.isPickable = false;
    _trackedBoss = boss;
  }

  const sc = boss.scaling.x || 1;
  _bossBarPlane.position.set(boss.position.x, boss.position.y + 3.6 * sc, boss.position.z);

  const ctx = _bossBarTex.getContext();
  const W = 256, H = 32;
  ctx.clearRect(0, 0, W, H);
  ctx.fillStyle = 'rgba(8,0,18,0.85)';
  ctx.fillRect(0, 0, W, H);
  const fillW = Math.round((W - 6) * ratio);
  const grad = ctx.createLinearGradient(3, 0, W - 3, 0);
  grad.addColorStop(0, '#7a00dd');
  grad.addColorStop(1, '#ee55ff');
  ctx.fillStyle = grad;
  ctx.fillRect(3, 3, fillW, H - 6);
  ctx.strokeStyle = '#cc44ff';
  ctx.lineWidth = 2;
  ctx.strokeRect(1, 1, W - 2, H - 2);
  _bossBarTex.update();
}
