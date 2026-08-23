// ── main.js  Game entry point — Babylon.js render loop ───────────────────────
import { engine, scene, camera, pipeline } from './engine.js';
import { gs, player, enemies, powerups, vaticanCongregants,
         fleeingNpcs, PLAYER_MAX_HEALTH, saveLevel, interactableObjects,
         inventory, equipped, RANK_NAMES, RANK_XP } from './state.js';
import { playerBody, playerArmLeft, playerArmRight,
         playerLegLeft, playerLegRight, playerGun, playerParts,
         applyPlayerArmor, setPlayerWeapon, applyPlayerClothes, applyVipState,
         getPlayerRig, upgradePlayerRigVisual } from './player.js';
import { aimRotation, handleControls } from './controls.js';
import { updateBullets, updatePowerups, updateBuffTimers,
         updateBossBar, updateCooldownBar,
         spawnEnemyBullet, takeDamage, spawnPowerupsForLevel, defeatEnemy,
         updateGrenades, updateMeleeCooldown, updateCombo, updateReload,
         resolveExplosion } from './combat.js';
import { updateEnemies, spawnEnemiesForLevel,
         registerCombatCallbacks as enemyRegisterCombat,
         registerUICallbacks, registerMapCallbacks } from './enemies.js';
import { updateFloatingTexts, updateSpeechBubbles, spawnDeathBurst } from './effects.js';
import { updateHUD, drawMinimap, showStartScreen, showMapPicker, hideMapPicker,
         hideStartScreen, showMessage, hideMessage,
         showInteractPrompt, hideInteractPrompt,
         showMapNameDisplay, showPauseScreen, hidePauseScreen,
         showStatsScreen, hideStatsScreen,
         showAchievementsScreen, hideAchievementsScreen,
         updateArmorBar, showTubeCountdown } from './ui.js';
import { loadMap } from './maps/index.js';
import { initArmory, openArmory, closeArmory } from './armory/index.js';
import { WEAPON_DEFS, getEquippedGunMaterials, rebuildGunVisual } from './armory/weapons.js';
import { startAmbientDrone, resumeAudio, playWeaponSwitch, playGameStart,
         startMusic, stopMusic, setAudioMuted } from './audio.js';
import { EMOTE_DEFS, applyEmotePose } from './armory/emotes.js';
import { initVoice } from './voice.js';
import { spawnChests, updateChests, clearChests } from './chests.js';

// ── Expose RANK_XP for ui.js (avoids circular import) ────────────────────────
window.__rankXP = { RANK_XP, RANK_NAMES };
// ── Expose spawnEnemiesForLevel for combat.js (avoids circular static dep) ───
window.__spawnEnemiesForLevel = (l) => spawnEnemiesForLevel(l);

// ── Wire callback bridges (break circular deps) ───────────────────────────────
enemyRegisterCombat({ spawnEnemyBullet, takeDamage, spawnPowerupsForLevel, defeatEnemy });
registerUICallbacks({ showMessage, hideMessage });

// ── Wire kill effect key from equipped cosmetics ──────────────────────────────
Object.defineProperty(window, '__killEffectKey', {
  get() { return inventory.killEffect || 'default'; },
  configurable: true,
});

// ── Weapon switching from controls.js ────────────────────────────────────────
window.__weaponSwitch = (key) => {
  if (!inventory.weapons.includes(key)) return;
  equipped.weapon = key;
  setPlayerWeapon(key, getEquippedGunMaterials);
  playWeaponSwitch();
};

// ── Pause toggle ──────────────────────────────────────────────────────────────
window.__togglePause = () => {
  if (!gs.started || player.health <= 0) return;
  gs.paused = !gs.paused;
  if (gs.paused) showPauseScreen();
  else hidePauseScreen();
};

// ── Camera positioning (updated every frame) ──────────────────────────────────
const CAM_OFFSET = new BABYLON.Vector3(0, 2.6, -5.5);
let _adsZoom = 0; // 0=normal, 1=fully scoped in

function updateCamera() {
  const py = aimRotation.y;
  const px = aimRotation.x;
  const sinX = Math.sin(px);

  // Screen shake
  let shakeX = 0, shakeY = 0;
  if (gs.cameraShakeDuration > 0) {
    gs.cameraShakeDuration -= 0;  // decremented in render loop
    const s = gs.cameraShakeIntensity;
    shakeX = Math.sin(gs.timeAccum * 90) * s;
    shakeY = Math.cos(gs.timeAccum * 77) * s;
  }

  const headbob = 0;

  // ADS pull-in (sniper scope)
  const adsOffset = _adsZoom * 3.2;
  const zOffset = CAM_OFFSET.z + adsOffset;

  const offX = Math.sin(py) * zOffset;
  const offZ = Math.cos(py) * zOffset;

  camera.position.x = playerBody.position.x - offX + shakeX;
  camera.position.y = playerBody.position.y + CAM_OFFSET.y + sinX * 4 + headbob + shakeY;
  camera.position.z = playerBody.position.z - offZ;

  camera.setTarget(new BABYLON.Vector3(
    playerBody.position.x + Math.sin(py) * 8,
    playerBody.position.y + CAM_OFFSET.y - sinX * 3,
    playerBody.position.z + Math.cos(py) * 8,
  ));

  // ADS FOV
  const targetFov = _adsZoom > 0 ? (1.05 - _adsZoom * 0.75) : 1.05;
  camera.fov += (targetFov - camera.fov) * 0.15;
}

// Exposed for combat.js to trigger shake via window global
window.__triggerShake = (intensity, duration) => {
  gs.cameraShakeIntensity = intensity;
  gs.cameraShakeDuration  = duration;
};
// Exposed for controls.js to drive ADS
window.__setAdsZoom = (v) => { _adsZoom = v; };
// Nuketime cheat — kill all enemies with explosions
window.__nukeAllEnemies = () => {
  const ens = enemies.slice();
  ens.forEach((e, i) => {
    if (e.health > 0) {
      setTimeout(() => resolveExplosion(e.position, 12, 500), i * 120);
    }
  });
};

// ── Fleeing NPC update ────────────────────────────────────────────────────────
function updateFleeingNpcs(dt) {
  for (let i = fleeingNpcs.length - 1; i >= 0; i--) {
    const npc = fleeingNpcs[i];
    const target = npc._fleeTarget;
    if (!target) { fleeingNpcs.splice(i, 1); continue; }
    const dx = target.x - npc.position.x;
    const dz = target.z - npc.position.z;
    const dist = Math.hypot(dx, dz);
    if (dist < 1.5) {
      npc.setEnabled(false);
      fleeingNpcs.splice(i, 1);
      continue;
    }
    const spd = 4.5 * dt;
    npc.position.x += (dx / dist) * spd;
    npc.position.z += (dz / dist) * spd;
    npc.rotation.y = Math.atan2(dx, dz);
  }
}

// ── Vatican prayer animation (loaded lazily) ──────────────────────────────────
let _animateVaticanPrayer = null;

// ── Interactable proximity check ──────────────────────────────────────────────
function checkInteractables() {
  let nearest = null, nearestDist = Infinity;
  interactableObjects.forEach(obj => {
    if (!obj.position) return;
    const d = BABYLON.Vector3.Distance(obj.position, playerBody.position);
    if (d < 4 && d < nearestDist) { nearestDist = d; nearest = obj; }
  });
  if (nearest !== gs.currentInteractable) {
    gs.currentInteractable = nearest;
    if (nearest) showInteractPrompt('[F] ' + (nearest.label || 'Open Home Screen'));
    else hideInteractPrompt();
  }
}

// ── Emote update ──────────────────────────────────────────────────────────────
function updateEmote(dt) {
  const rig = getPlayerRig();
  if (!player.activeEmote) {
    if (player._emotePoseActive) {
      player._emotePoseActive = false;
      if (rig) rig.exitPoseMode();
    }
    return;
  }
  if (!player._emotePoseActive) {
    player._emotePoseActive = true;
    if (rig) rig.enterPoseMode();
  }
  player.emoteElapsed = (player.emoteElapsed || 0) + dt;
  player.emoteTimer -= dt;
  if (player.emoteTimer <= 0) {
    player.activeEmote = null;
    player._emotePoseActive = false;
    playerArmLeft.rotation.x  = Math.PI / 10;
    playerArmRight.rotation.set(-1.25, 0, 0.15);
    if (rig) rig.exitPoseMode();
    return;
  }
  applyEmotePose(playerParts, player.activeEmote, player.emoteElapsed);
}

// ── Daily login bonus ─────────────────────────────────────────────────────────
function checkDailyLogin() {
  if (gs.dailyLoginChecked) return;
  gs.dailyLoginChecked = true;
  const today = new Date().toDateString();
  const last = localStorage.getItem('sniperstrike-last-login');
  if (last !== today) {
    localStorage.setItem('sniperstrike-last-login', today);
    gs.coins += 100;
    import('./state.js').then(m => m.saveCoins?.());
    showMessage('🎁 Daily login bonus: +100 coins!', 3000);
  }
}

// ── Main render loop ──────────────────────────────────────────────────────────
engine.runRenderLoop(() => {
  const dtMs = engine.getDeltaTime();
  const dt   = Math.min(dtMs / 1000, 0.06);
  gs.timeAccum += dt;

  if (!gs.started) {
    scene.render();
    return;
  }

  if (gs.paused) {
    scene.render();
    return;
  }

  // Camera shake timer
  if (gs.cameraShakeDuration > 0) {
    gs.cameraShakeDuration = Math.max(0, gs.cameraShakeDuration - dt);
    if (gs.cameraShakeDuration <= 0) gs.cameraShakeIntensity = 0;
  }

  // Near-death vignette (ramps up as health drops below 30%)
  if (pipeline?.imageProcessing) {
    const hpRatio = player.health / player.maxHealth;
    const targetVig = hpRatio < 0.3 ? 2.0 + (0.3 - hpRatio) * 16 : 2.0;
    pipeline.imageProcessing.vignetteWeight += (targetVig - pipeline.imageProcessing.vignetteWeight) * 0.08;
  }

  // Core systems
  handleControls(dt);
  updateCamera();
  updateChests(dt);
  updateBullets(dt);
  updateEnemies(dt);
  updatePowerups(dt);
  updateBuffTimers(dt);
  updateGrenades(dt);
  updateMeleeCooldown(dt);
  updateCombo(dt);
  updateReload(dt);
  updateFleeingNpcs(dt);
  checkInteractables();

  // Effects
  updateFloatingTexts(dt);
  updateSpeechBubbles(dt);
  updateEmote(dt);

  // Vatican prayer animation
  if (gs.mapId === 'vatican' && vaticanCongregants.length) {
    if (!_animateVaticanPrayer) {
      import('./maps/vatican.js').then(m => { _animateVaticanPrayer = m.animateVaticanPrayer; });
    } else {
      _animateVaticanPrayer(dt);
    }
  }

  // VIP buff timers
  if (player.invincibleTimer > 0) {
    player.invincibleTimer = Math.max(0, player.invincibleTimer - dt);
    player.health = PLAYER_MAX_HEALTH; // constant regen while invincible
    if (player.invincibleTimer <= 0) showMessage('Invincibility faded.', 2000);
  }
  // HUD
  updateHUD();
  updateArmorBar();
  drawMinimap(playerBody.position);
  updateBossBar();
  updateCooldownBar();

  // ── Lobby: conveyors + tube walk-in detection ─────────────────────────────
  if (gs.mapId === 'lobby') {
    const px = playerBody.position.x;
    const pz = playerBody.position.z;

    // Scroll conveyor textures along belt length (vOffset = z direction)
    if (gs.lobbyConvFwdTex) gs.lobbyConvFwdTex.vOffset = ((gs.lobbyConvFwdTex.vOffset || 0) + dt * 0.35) % 1;
    if (gs.lobbyConvBwdTex) gs.lobbyConvBwdTex.vOffset = ((gs.lobbyConvBwdTex.vOffset || 0) - dt * 0.35 + 1) % 1;

    const txL = gs.lobbyTubeXLeft  || -21;
    const txR = gs.lobbyTubeXRight ||  21;
    const _hl = gs.lobbyHL || 145;
    const _cx = gs.lobbyConvX || 7;

    // Conveyor carry: full belt width (belt is 4 wide → half-width 2 + margin).
    // Carries along z only — x is untouched, so stepping off sideways is instant.
    if (!gs.inTubeCountdown) {
      if (Math.abs(px + _cx) < 2.4 && Math.abs(pz) < _hl - 2) {
        // Blue left belt → toward far end (50v50 / 100v100)
        playerBody.position.z = Math.max(-(_hl - 2), playerBody.position.z - 20 * dt);
      } else if (Math.abs(px - _cx) < 2.4 && Math.abs(pz) < _hl - 2) {
        // Yellow right belt → toward start end (1v1 / 51v51)
        playerBody.position.z = Math.min(_hl - 2, playerBody.position.z + 20 * dt);
      }

      // Tube walk-in detection — left wall (1v1..50v50) and right wall (51v51..100v100)
      const startZ  = gs.lobbyTubeStartZ || 130;
      const spacing = gs.lobbyTubeSpacing || 5.5;
      const i = Math.round((startZ - pz) / spacing);
      if (i >= 0 && i < 50) {
        const tubeZ = startZ - i * spacing;
        if (Math.abs(pz - tubeZ) < 2.0) {
          // Left wall tubes
          if (px < -12 && Math.abs(px - txL) < 5) {
            gs.inTubeCountdown = true;
            const count = i + 1;
            showTubeCountdown(count, () => {
              gs.inTubeCountdown = false;
              gs.tubeEnemyCount  = count;
              showMapPicker(mapId => startGame(mapId));
            });
          }
          // Right wall tubes
          else if (px > 12 && Math.abs(px - txR) < 5) {
            gs.inTubeCountdown = true;
            const count = i + 51;
            showTubeCountdown(count, () => {
              gs.inTubeCountdown = false;
              gs.tubeEnemyCount  = count;
              showMapPicker(mapId => startGame(mapId));
            });
          }
        }
      }
    }
  }

  scene.render();
});

window.addEventListener('resize', () => engine.resize());

// ── Game start / restart flow ─────────────────────────────────────────────────
function startGame(mapId) {
  resumeAudio();
  startAmbientDrone();
  playGameStart();
  startMusic();

  // Reset player state
  player.health = PLAYER_MAX_HEALTH;
  player.maxHealth = PLAYER_MAX_HEALTH;
  player.score = 0;
  gs.killStreak = 0;
  gs.combo = 0;
  gs.comboTimer = 0;
  gs.scoreMult = 1;
  player.canShoot = true;
  player.speedMultiplier = 1;
  player.damageMultiplier = 1;
  player.fireRateMultiplier = 1;
  player.isReloading = false;
  player.isDodging = false;
  player.shieldTimer = 0;
  player.invincibleTimer = 0;
  gs.infiniteCoins = false;
  player.ammo = player.maxAmmo;
  player.grenades = player.maxGrenades;
  player.sessionKills = 0;
  player.sessionHeadshots = 0;
  player.sessionShots = 0;
  player.sessionHits = 0;

  // Apply gameMode overrides
  if (gs.gameMode === 'oneshot') {
    player.maxHealth = 1;
    player.health = 1;
  }

  clearChests();
  loadMap(mapId);
  playerBody.position.set(0, 0, 2);
  spawnChests();

  // Import map callbacks for divine healing event
  if (mapId === 'metro') {
    import('./maps/metro.js').then(m => {
      registerMapCallbacks({ startDivineHealingEvent: m.startDivineHealingEvent });
    });
  }

  // Apply equipped items
  applyPlayerArmor(equipped.armor || 'none');
  applyPlayerClothes(equipped.clothes || 'default');
  setPlayerWeapon(equipped.weapon || 'sniper', getEquippedGunMaterials);
  if (inventory.vip) applyVipState(getEquippedGunMaterials);

  gs.started = true;
  gs.paused = false;

  // Show map name
  const mapDef = window.__MAPS_REF?.[mapId];
  if (mapDef) showMapNameDisplay(mapDef.label || mapId);

  // Speedrun timer
  if (gs.gameMode === 'speedrun') gs.speedrunStartTime = Date.now();

  // Daily login
  checkDailyLogin();

  import('./enemies.js').then(m => m.spawnEnemiesForLevel(gs.level));
}

// ── Global helpers used by map files ─────────────────────────────────────────
window.__openArmory = () => openArmory();
window.__playerRefs = { get playerBody() { return playerBody; } };

// ── DOM-ready wiring ──────────────────────────────────────────────────────────
window.addEventListener('load', async () => {
  // ── Asset preload (GLB characters). On failure the game runs on primitive rigs. ──
  const loadingEl = document.getElementById('loading-screen');
  const loadingFill = document.getElementById('loading-bar-fill');
  try {
    const { preloadAssets } = await import('./assets.js');
    await preloadAssets(p => { if (loadingFill) loadingFill.style.width = (p * 100).toFixed(0) + '%'; });
    await upgradePlayerRigVisual();
  } catch (e) {
    console.warn('[main] asset preload skipped:', e && e.message);
  }
  if (loadingEl) {
    loadingEl.classList.add('fade-out');
    setTimeout(() => loadingEl.remove(), 450);
  }

  initArmory();
  initVoice();

  // Expose MAPS reference for map name display
  import('./maps/index.js').then(m => { window.__MAPS_REF = m.MAPS; });

  // Game mode buttons
  const gmBtns = document.querySelectorAll('.gm-btn');
  gmBtns.forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      gmBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      gs.gameMode = btn.dataset.mode || 'normal';
    });
  });

  // Start button
  const startBtn = document.getElementById('start-button');
  if (startBtn) {
    startBtn.addEventListener('click', () => {
      hideStartScreen();
      showMapPicker((mapId) => {
        startGame(mapId);
      });
    });
  }

  // Armory open button (in-game HUD)
  const armoryBtn = document.getElementById('open-armory-btn');
  if (armoryBtn) armoryBtn.addEventListener('click', () => openArmory());

  // Armory keyboard shortcut (B)
  document.addEventListener('keydown', e => {
    if (e.code === 'KeyB') {
      if (document.getElementById('armory-screen')?.classList.contains('hidden')) {
        openArmory();
      } else {
        closeArmory();
      }
    }
  });

  // Pause screen buttons
  document.getElementById('pause-resume-btn')?.addEventListener('click', () => {
    gs.paused = false;
    hidePauseScreen();
  });
  document.getElementById('pause-stats-btn')?.addEventListener('click', () => {
    showStatsScreen();
  });
  document.getElementById('pause-ach-btn')?.addEventListener('click', () => {
    showAchievementsScreen();
  });
  document.getElementById('pause-quit-btn')?.addEventListener('click', () => {
    gs.paused = false;
    gs.started = false;
    hidePauseScreen();
    stopMusic();
    import('./state.js').then(m => { gs.level = 1; m.saveLevel?.(); });
    showStartScreen();
  });

  // Stats screen close
  document.getElementById('stats-close-btn')?.addEventListener('click', () => hideStatsScreen());
  document.getElementById('ach-close-btn')?.addEventListener('click', () => hideAchievementsScreen());

  // Mute button
  const muteBtn = document.getElementById('mute-button');
  if (muteBtn) {
    let _muted = localStorage.getItem('sniperstrike-muted') === 'true';
    setAudioMuted(_muted);
    muteBtn.textContent = _muted ? '🔇' : '🔊';
    muteBtn.addEventListener('click', () => {
      _muted = !_muted;
      setAudioMuted(_muted);
      muteBtn.textContent = _muted ? '🔇' : '🔊';
      localStorage.setItem('sniperstrike-muted', String(_muted));
    });
  }

  showStartScreen();
});
