// ── controls.js  Keyboard/mouse/touch input + player movement ─────────────────
import { scene, camera, getHeightAtXZ } from './engine.js';
import { gs, player, equipped } from './state.js';
import { playerBody, playerArmLeft, playerArmRight, playerLegLeft, playerLegRight,
         playerGun, playerHead, getPlayerRig } from './player.js';
import { collidesWithWalls } from './maps/index.js';
import { spawnPlayerBullet, setAimRotation, performMelee, startReload,
         startGrenadeAim, updateGrenadeAim, stopGrenadeAim, throwGrenadeToTarget } from './combat.js';
import { playFootstep, playDodge } from './audio.js';
import { spawnShieldBurst } from './effects.js';
import { tryClickChest, isChestAtScreen } from './chests.js';

// ── Aim rotation (exported for camera + bullet direction) ─────────────────────
export const aimRotation = { x: 0, y: 0 };
setAimRotation(aimRotation);

// ── Key state ─────────────────────────────────────────────────────────────────
const keys = {};
window.addEventListener('keydown', e => {
  // Don't capture keys if typing in an input
  if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
  keys[e.code] = true;
});
window.addEventListener('keyup', e => {
  keys[e.code] = false;
  // Release G → throw grenade to aimed landing spot
  if (e.code === 'KeyG' && _gHeld) {
    _gHeld = false;
    throwGrenadeToTarget(_grenLand);
    stopGrenadeAim();
    _grenLand = null;
  }
});

// ── Double-tap detection for dodge ───────────────────────────────────────────
const _lastTap = {};
const DOUBLE_TAP_MS = 300;

function checkDoubleTap(code) {
  const now = Date.now();
  if (_lastTap[code] && now - _lastTap[code] < DOUBLE_TAP_MS) {
    _lastTap[code] = 0;
    return true;
  }
  _lastTap[code] = now;
  return false;
}

// ── Mouse shoot ───────────────────────────────────────────────────────────────
const canvas = document.getElementById('renderCanvas');

function _getAimDir(clientX, clientY) {
  const ray = scene.createPickingRay(clientX, clientY, BABYLON.Matrix.Identity(), camera, false);
  const aimY = 1.5;
  let t = Math.abs(ray.direction.y) > 0.001
    ? (aimY - ray.origin.y) / ray.direction.y
    : 80;
  if (t < 2) t = 80;
  const worldTarget = ray.origin.add(ray.direction.scale(t));
  return worldTarget.subtract(new BABYLON.Vector3(
    playerBody.position.x,
    playerBody.position.y + 1.4,
    playerBody.position.z
  )).normalize();
}

function tryShoot(e) {
  if (e.button !== 0 && e.button !== undefined) return;
  if (!gs.started || player.health <= 0 || gs.paused) return;
  const uiHit = e.target?.closest?.(
    '#hud, #elev-panel-ui, #armory-screen, #start-screen, #map-picker-screen, ' +
    '#pause-screen, #stats-screen, #achievements-screen, button, [role="button"]'
  );
  if (uiHit) return;
  // If hovering over a chest, open it instead of shooting
  if (_hoveringChest) {
    tryClickChest(e.clientX, e.clientY);
    return;
  }
  const dir = _getAimDir(e.clientX, e.clientY);
  spawnPlayerBullet(dir);
}

canvas.addEventListener('pointerdown', tryShoot, { capture: true });

// ── ADS / Right-click zoom ────────────────────────────────────────────────────
canvas.addEventListener('contextmenu', e => e.preventDefault());
canvas.addEventListener('pointerdown', e => {
  if (e.button !== 2) return;
  if (!gs.started || player.health <= 0 || gs.paused) return;
  const zoomKey = player.weaponKey;
  const zoomAmt = zoomKey === 'sniper' ? 1.0
    : zoomKey === 'revolver' ? 0.55
    : zoomKey === 'crossbow' ? 0.65
    : zoomKey === 'lmg'      ? 0.35
    : 0;
  if (window.__setAdsZoom) window.__setAdsZoom(zoomAmt);
}, { capture: true });
document.addEventListener('pointerup', e => {
  if (e.button === 2 && window.__setAdsZoom) window.__setAdsZoom(0);
});

// ── Minigun auto-fire ─────────────────────────────────────────────────────────
let _mouseHeld = false;
let _lastMouseX = window.innerWidth / 2;
let _lastMouseY = window.innerHeight / 2;

canvas.addEventListener('pointerdown', e => { if (e.button === 0) _mouseHeld = true; }, { capture: true });
document.addEventListener('pointerup',  e => { if (e.button === 0) _mouseHeld = false; });
document.addEventListener('pointermove', e => {
  _lastMouseX = e.clientX; _lastMouseY = e.clientY;
  if (!gs.started || gs.paused) { _hoveringChest = false; return; }
  _hoveringChest = isChestAtScreen(e.clientX, e.clientY);
  if (_cv) _cv.style.cursor = _hoveringChest ? 'pointer' : 'crosshair';
});

// ── Touch / mobile ────────────────────────────────────────────────────────────
// Left ~35% of the screen: tap-and-hold upper/lower half to walk forward/back
// (tracked by its own touch identifier — touchMoveId). Right side: drag to
// look/turn (tracked separately by touchAimId). Two independent fingers, two
// independent identifiers — touchend/touchcancel below only ever clears the
// state for the SPECIFIC finger that lifted, never both, so releasing the
// look-finger (e.g. to tap-shoot) can no longer stop the move-finger's input
// mid-stride, which is what made movement feel "glitchy".
let touchUp = false, touchDown = false;
let touchMoveId = null;
let touchAimId = null, touchLastX = 0, touchLastY = 0;

canvas.addEventListener('touchstart', e => {
  e.preventDefault();
  for (const t of e.changedTouches) {
    const lx = t.clientX / window.innerWidth;
    if (lx < 0.35 && touchMoveId === null) {
      const ly = t.clientY / window.innerHeight;
      touchUp = ly < 0.5;
      touchDown = !touchUp;
      touchMoveId = t.identifier;
    } else if (touchAimId === null) {
      touchAimId = t.identifier;
      touchLastX = t.clientX; touchLastY = t.clientY;
    }
  }
}, { passive: false });

canvas.addEventListener('touchmove', e => {
  e.preventDefault();
  for (const t of e.changedTouches) {
    if (t.identifier === touchAimId) {
      // Drag right → turn right (matches the established ArrowRight
      // convention: aimRotation.y += turns right, -= turns left). This was
      // previously inverted (-=), which made every mobile drag turn the
      // opposite way the player dragged — the root cause behind "moving
      // right moves left" and "forward goes backward" (once the view is
      // spun around by a few backwards corrections, the forward tap zone
      // walks you toward where you came from).
      aimRotation.y += (t.clientX - touchLastX) * 0.003;
      aimRotation.x -= (t.clientY - touchLastY) * 0.003;
      aimRotation.x = Math.max(-Math.PI / 3, Math.min(Math.PI / 4, aimRotation.x));
      touchLastX = t.clientX; touchLastY = t.clientY;
    }
  }
}, { passive: false });

function _touchRelease(e) {
  for (const t of e.changedTouches) {
    if (t.identifier === touchMoveId) { touchUp = false; touchDown = false; touchMoveId = null; }
    if (t.identifier === touchAimId)  { touchAimId = null; }
  }
}
canvas.addEventListener('touchend', _touchRelease);
// iOS fires touchcancel (not touchend) when a touch is interrupted by a
// system gesture (e.g. edge-swipe for Control Center) — without this the
// move/aim finger could get "stuck" held down forever.
canvas.addEventListener('touchcancel', _touchRelease);

// ── Footstep sound timer ──────────────────────────────────────────────────────
let footstepTimer = 0;

// ── Grenade aim state ─────────────────────────────────────────────────────────
let _gHeld     = false;
let _grenLand  = null;

// ── Chest hover state ─────────────────────────────────────────────────────────
let _hoveringChest = false;
const _cv = document.getElementById('renderCanvas');

// ── Handle controls (called every frame) ─────────────────────────────────────
export function handleControls(dt) {
  if (!gs.started || player.health <= 0 || gs.paused) return;

  // Expose aim rotation Y for damage direction indicator
  window.__aimRotY = aimRotation.y;

  const speed = player.speed * player.speedMultiplier;

  // Arrow Left/Right: turn (touch turns via the look-drag handler above)
  const TURN_SPEED = 2.4;
  if (keys['ArrowLeft'])  aimRotation.y -= TURN_SPEED * dt;
  if (keys['ArrowRight']) aimRotation.y += TURN_SPEED * dt;

  const sin = Math.sin(aimRotation.y);
  const cos = Math.cos(aimRotation.y);

  let dx = 0, dz = 0;

  const forward = keys['KeyW'] || keys['ArrowUp']   || touchUp;
  const back    = keys['KeyS'] || keys['ArrowDown']  || touchDown;
  const left    = keys['KeyA'];
  const right   = keys['KeyD'];

  if (forward) { dx += sin; dz += cos; }
  if (back)    { dx -= sin; dz -= cos; }
  if (left)    { dx -= cos; dz += sin; }
  if (right)   { dx += cos; dz -= sin; }

  // Dodge while dodging
  if (player.isDodging) {
    player.dodgeTimer -= dt;
    if (player.dodgeTimer <= 0) {
      player.isDodging = false;
      player.dodgeCooldown = 2.5;
    } else {
      const dodgeSpeed = 18;
      const nx = playerBody.position.x + player.dodgeVelX * dodgeSpeed * dt;
      const nz = playerBody.position.z + player.dodgeVelZ * dodgeSpeed * dt;
      const R = gs.MAP_RADIUS - 1;
      if (!collidesWithWalls(nx, playerBody.position.z))
        playerBody.position.x = Math.max(-R, Math.min(R, nx));
      if (!collidesWithWalls(playerBody.position.x, nz))
        playerBody.position.z = Math.max(-R, Math.min(R, nz));
    }
    if (player.dodgeCooldown > 0) player.dodgeCooldown -= dt;
    playerBody.position.y += (getHeightAtXZ(playerBody.position.x, playerBody.position.z) - playerBody.position.y) * 0.35;
    animatePlayer(dt, true);
    return;
  }

  if (player.dodgeCooldown > 0) player.dodgeCooldown -= dt;

  const moving = dx !== 0 || dz !== 0;
  gs.isMoving = moving;
  if (moving) {
    const len = Math.hypot(dx, dz);
    dx /= len; dz /= len;
    const nx = playerBody.position.x + dx * speed * dt;
    const nz = playerBody.position.z + dz * speed * dt;

    const R = gs.MAP_RADIUS - 1;
    if (!collidesWithWalls(nx, playerBody.position.z))
      playerBody.position.x = Math.max(-R, Math.min(R, nx));
    if (!collidesWithWalls(playerBody.position.x, nz))
      playerBody.position.z = Math.max(-R, Math.min(R, nz));

    footstepTimer -= dt;
    if (footstepTimer <= 0) { playFootstep(); footstepTimer = 0.32; }
  }
  // Terrain follow — no-op (lerps toward 0) on flat maps with no active heightfield.
  playerBody.position.y += (getHeightAtXZ(playerBody.position.x, playerBody.position.z) - playerBody.position.y) * 0.35;

  // Weapon switching (1–9 keys)
  const WEAPON_KEYS = { 'Digit1': 'sniper', 'Digit2': 'pistol', 'Digit3': 'shotgun',
                        'Digit4': 'smg', 'Digit5': 'rocket', 'Digit6': 'burst',
                        'Digit7': 'revolver', 'Digit8': 'lmg', 'Digit9': 'crossbow' };
  for (const [code, wkey] of Object.entries(WEAPON_KEYS)) {
    if (keys[code]) { keys[code] = false; tryEquipWeapon(wkey); break; }
  }

  // Auto-fire + minigun barrel spin
  const isMinigun = player.weaponKey === 'minigun';
  if (_mouseHeld && !gs.paused) {
    spawnPlayerBullet(_getAimDir(_lastMouseX, _lastMouseY));
    if (isMinigun && playerGun?.barrelGroup) {
      playerGun.barrelGroup.rotation.z += dt * 28;
    }
  } else if (isMinigun && playerGun?.barrelGroup && playerGun.barrelGroup.rotation.z !== 0) {
    // Decelerate when not firing
    playerGun.barrelGroup.rotation.z += dt * 8;
  }

  // Grenade aim arc update
  if (_gHeld) _grenLand = updateGrenadeAim();

  animatePlayer(dt, moving);
}

function tryEquipWeapon(key) {
  if (window.__weaponSwitch) window.__weaponSwitch(key);
}

// ── Player animation ──────────────────────────────────────────────────────────
function animatePlayer(dt, moving) {
  const t = gs.timeAccum;
  const rig = getPlayerRig();
  if (rig) {
    // Rigged model: real animation clips (skip during emotes = pose mode)
    if (rig._mode !== 'pose') {
      rig.playAnim(moving ? 'jog' : 'pistolIdle', { speedRatio: moving ? 1.1 : 1 });
    }
  } else if (moving) {
    const legSwing = Math.sin(t * 8) * 0.5;
    playerLegLeft.rotation.x  = legSwing;
    playerLegRight.rotation.x = -legSwing;
    playerArmLeft.rotation.x  = -legSwing * 0.3 + Math.PI / 10;
  } else {
    playerLegLeft.rotation.x  *= 0.85;
    playerLegRight.rotation.x *= 0.85;
    playerArmLeft.rotation.x   = playerArmLeft.rotation.x * 0.85 + (Math.PI / 10) * 0.15;
  }

  // Dodge visual roll
  if (player.isDodging) {
    playerBody.rotation.z = Math.sin(gs.timeAccum * 20) * 0.4;
  } else {
    playerBody.rotation.z *= 0.7;
    playerArmRight.rotation.set(-1.25, 0, 0.15);
  }

  playerBody.rotation.y = aimRotation.y;
}

// ── Action keys (keydown) ─────────────────────────────────────────────────────
window.addEventListener('keydown', e => {
  if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;

  // Emote (E)
  if (e.code === 'KeyE' && gs.started) {
    const btn = document.getElementById('emote-button');
    if (btn) btn.click();
  }

  // Interact (F)
  if (e.code === 'KeyF' && gs.started) {
    if (gs.currentInteractable?.onInteract) gs.currentInteractable.onInteract();
  }

  // Melee (Q)
  if (e.code === 'KeyQ' && gs.started && !gs.paused) {
    performMelee();
  }

  // Grenade (G) — hold to aim, release to throw
  if (e.code === 'KeyG' && gs.started && !gs.paused && !_gHeld) {
    _gHeld = true;
    startGrenadeAim();
  }

  // Reload (R)
  if (e.code === 'KeyR' && gs.started && !gs.paused) {
    startReload();
  }

  // Dodge (double-tap W/A/S/D)
  if (gs.started && !gs.paused && player.dodgeCooldown <= 0 && !player.isDodging) {
    let dodgeX = 0, dodgeZ = 0;
    const sin = Math.sin(aimRotation.y);
    const cos = Math.cos(aimRotation.y);
    if (e.code === 'KeyW' && checkDoubleTap('KeyW')) { dodgeX = sin; dodgeZ = cos; }
    if (e.code === 'KeyS' && checkDoubleTap('KeyS')) { dodgeX = -sin; dodgeZ = -cos; }
    if (e.code === 'KeyA' && checkDoubleTap('KeyA')) { dodgeX = -cos; dodgeZ = sin; }
    if (e.code === 'KeyD' && checkDoubleTap('KeyD')) { dodgeX = cos; dodgeZ = -sin; }
    if (dodgeX !== 0 || dodgeZ !== 0) {
      const len = Math.hypot(dodgeX, dodgeZ) || 1;
      player.isDodging = true;
      player.dodgeTimer = 0.25;
      player.dodgeVelX = dodgeX / len;
      player.dodgeVelZ = dodgeZ / len;
      player.dodgeCooldown = 2.5;
      playDodge();
      spawnShieldBurst(playerBody.position); // brief flash
    }
  }

  // Pause (ESC)
  if (e.code === 'Escape' && gs.started) {
    if (window.__togglePause) window.__togglePause();
    return;
  }

  // Screenshot mode (P)
  if (e.code === 'KeyP' && gs.started) {
    gs.screenshotMode = !gs.screenshotMode;
    const overlay = document.getElementById('overlay');
    if (overlay) overlay.style.opacity = gs.screenshotMode ? '0' : '1';
  }

  // Stats (Tab)
  if (e.code === 'Tab' && gs.started) {
    e.preventDefault();
    const statsScreen = document.getElementById('stats-screen');
    if (statsScreen) statsScreen.classList.toggle('hidden');
  }

  // Cheat codes (secret: type them while in-game)
  _cheatBuffer += e.key.toLowerCase();
  if (_cheatBuffer.length > 20) _cheatBuffer = _cheatBuffer.slice(-20);
  checkCheats();
});

// ── Cheat codes ───────────────────────────────────────────────────────────────
let _cheatBuffer = '';

function checkCheats() {
  const cheats = {
    'bighead':     () => { player.health = player.maxHealth; import('./effects.js').then(m => m.spawnFloatingText('BIG HEAD MODE!', playerBody.position, 0xff88ff)); },
    'godmode':     () => { player.armorDeflectChance = 1; import('./effects.js').then(m => m.spawnFloatingText('GOD MODE!', playerBody.position, 0xffd700)); },
    'minigun':     () => { if (window.__weaponSwitch) window.__weaponSwitch('minigun'); },
    'moneymoney':  () => { gs.coins += 5000; import('./state.js').then(m => m.saveCoins()); import('./effects.js').then(m => m.spawnFloatingText('+5000 COINS!', playerBody.position, 0xffd700)); },
    'fullpower':   () => { player.damageMultiplier = 5; player.speedMultiplier = 2; import('./combat.js').then(m => { m.startReload(); }); import('./effects.js').then(m => m.spawnFloatingText('FULL POWER!', playerBody.position, 0xff4400)); },
    'nuketime':    () => {
      if (!gs.started || player.health <= 0) return;
      if (window.__triggerShake) window.__triggerShake(0.9, 1.8);
      if (window.__nukeAllEnemies) window.__nukeAllEnemies();
    },
  };
  for (const [code, fn] of Object.entries(cheats)) {
    if (_cheatBuffer.endsWith(code)) {
      _cheatBuffer = '';
      fn();
      document.dispatchEvent(new CustomEvent('cheatActivated', { detail: code }));
      break;
    }
  }
}
