// ── maps/lobby.js  Futuristic Arena Lobby — 100 tube stations ─────────────────
import { scene, pbr, pbrTex, gnd, box, cyl, torus, grp, addShadow, makeCanvasTex, setFog } from '../engine.js';
import { gs } from '../state.js';
import { registerWallCollider, registerMapGroup, loadProp, instantiateProp,
         createRiggedCharacter, assetsReady } from './index.js';

// Layout constants (read by main.js via gs)
const HW            = 26;    // half-width  → 52 units wide
const HL            = 145;   // half-length → 290 units long
const RH            = 18;    // ceiling height
const TUBE_X_LEFT   = -21;   // left-wall  tube centres
const TUBE_X_RIGHT  =  21;   // right-wall tube centres
const CONV_X        =   7;   // conveyor belt centres (±7)
const CONV_W        =   4;   // conveyor belt width
const START_Z       = 130;   // z of tube 1 (1v1) and tube 51 (51v51)
const SPACING       = 5.5;   // world-unit gap between tubes

// ── Shared materials ──────────────────────────────────────────────────────────
const darkFloor  = pbrTex('metalPlate', 0x14141e, 0.35, 0.7, { uv: 30, seed: 91 });
const wallMat    = pbr(0x0c0c18, 0.72, 0.4);
const ceilMat    = pbr(0x080812, 0.9,  0.1);
const pillarMat  = pbr(0x16162a, 0.45, 0.65);
const yellowGlow = pbr(0xffcc00, 0.04, 0.1, { emissive: 0xffaa00, emissiveIntensity: 3.2 });
const purpleGlow = pbr(0xbb00ff, 0.04, 0.1, { emissive: 0x9900dd, emissiveIntensity: 3.0 });
const cyanGlow   = pbr(0x00eeff, 0.04, 0.1, { emissive: 0x00ccdd, emissiveIntensity: 2.6 });
const whiteCeil  = pbr(0xddeeff, 0.18, 0,   { emissive: 0xddeeff, emissiveIntensity: 2.4 });

export function buildLobbyMap() {
  const root = grp('lobby');
  setFog(0x000814, 35, 200);

  // ── Floor & ceiling ───────────────────────────────────────────────────────
  gnd(HW * 2, HL * 2, darkFloor).parent = root;
  box(HW * 2, 0.5, HL * 2, ceilMat, root).position.set(0, RH + 0.25, 0);

  // ── Walls ─────────────────────────────────────────────────────────────────
  _wall(root,  0,      -HL, HW * 2,     0.55, true);   // north
  _wall(root,  0,       HL, HW * 2,     0.55, true);   // south (entrance)
  _wall(root, -HW,      0,  HL * 2,     0.55, false);  // left
  _wall(root,  HW,      0,  HL * 2,     0.55, false);  // right

  // ── Floor markings ────────────────────────────────────────────────────────
  // Yellow border rails
  for (const x of [-HW + 1.8, HW - 1.8]) {
    box(0.14, 0.04, HL * 2 - 4, yellowGlow, root).position.set(x, 0.05, 0);
  }
  for (const z of [-HL + 1.8, HL - 1.8]) {
    box(HW * 2 - 4, 0.04, 0.14, yellowGlow, root).position.set(0, 0.05, z);
  }

  // Centre walking lane stripes (between the two conveyors)
  box(0.16, 0.04, HL * 2, purpleGlow, root).position.set(0, 0.06, 0);

  // Conveyor edge markers on the floor
  for (const x of [-(CONV_X + CONV_W / 2 + 0.3), -(CONV_X - CONV_W / 2 - 0.3),
                    (CONV_X - CONV_W / 2 - 0.3),   (CONV_X + CONV_W / 2 + 0.3)]) {
    box(0.12, 0.04, HL * 2, yellowGlow, root).position.set(x, 0.065, 0);
  }

  // Cyan cross-ticks every 5 tubes
  for (let i = 0; i <= 50; i += 5) {
    const z = START_Z - i * SPACING;
    box(HW * 2 - 4, 0.04, 0.1, cyanGlow, root).position.set(0, 0.07, z);
  }

  // ── Ceiling light strips ──────────────────────────────────────────────────
  for (const x of [-8, -3, 0, 3, 8]) {
    box(0.3, 0.12, HL * 2 - 8, whiteCeil, root).position.set(x, RH - 0.18, 0);
  }

  // ── Structural pillars ────────────────────────────────────────────────────
  for (let z = -HL + 14; z < HL; z += 22) {
    for (const x of [-HW + 2, HW - 2]) {
      const p = box(1.8, RH, 1.8, pillarMat, root);
      p.position.set(x, RH / 2, z); addShadow(p);
      box(0.08, RH, 0.08, purpleGlow, root).position.set(x, RH / 2, z);
      box(2.0, 0.2, 2.0, cyanGlow, root).position.set(x, RH - 0.1, z);
      box(2.0, 0.2, 2.0, cyanGlow, root).position.set(x, 0.1, z);
    }
  }

  // ── Wall display screens (between tube rows) ───────────────────────────────
  for (let z = -HL + 14; z < HL; z += 22) {
    for (const x of [-HW + 0.32, HW - 0.32]) {
      _screen(root, x, 10, z);
    }
  }

  // ── Two centre conveyor belts — left pushes ←, right pushes → ─────────────
  _buildConveyors(root);

  // ── 50 tubes on each wall ─────────────────────────────────────────────────
  for (let i = 0; i < 50; i++) {
    const z = START_Z - i * SPACING;
    _buildTube(root, i,      z, TUBE_X_LEFT,  false);  // tubes  1-50
    _buildTube(root, i + 50, z, TUBE_X_RIGHT, true);   // tubes 51-100
  }

  // ── End banners ───────────────────────────────────────────────────────────
  _banner(root, 0, 10, HL - 1.5, '⚡  ARENA LOBBY  ⚡', '#00ccff',
          'STEP INTO A TUBE  |  LEFT WALL: 1v1→50v50  |  RIGHT WALL: 51v51→100v100');
  _banner(root, 0, 10, -HL + 1.5, '50v50  /  100v100  ZONE', '#ff2244',
          'THE HARDEST BATTLES');

  // ── Real KayKit space-station dressing + idle rigged NPCs (async showcase) ─
  spawnSpaceProps(root);
  spawnIdleNpcs(root);

  registerMapGroup(root);
  gs.isInsideMapInterior = (x, z2) => Math.abs(x) < HW && Math.abs(z2) < HL;

  // Expose constants for main.js via gs
  gs.lobbyTubeStartZ  = START_Z;
  gs.lobbyTubeSpacing = SPACING;
  gs.lobbyTubeXLeft   = TUBE_X_LEFT;
  gs.lobbyTubeXRight  = TUBE_X_RIGHT;
  gs.lobbyConvX       = CONV_X;
  gs.lobbyHL          = HL;
}

// ── Real KayKit space-station dressing (async, decor-only) ────────────────────
async function spawnSpaceProps(root) {
  const specs = [
    { path: 'assets/models/props/space/cargo_A_stacked.gltf', pos: [HW - 3.5, 0, HL - 20], targetH: 4.5, ry: 0.3 },
    { path: 'assets/models/props/space/cargo_B_stacked.gltf', pos: [-HW + 3.5, 0, HL - 20], targetH: 4.5, ry: -0.3 },
    { path: 'assets/models/props/space/basemodule_A.gltf',    pos: [HW - 4, 0, -HL + 22],   targetH: 5.5, ry: 1.6 },
    { path: 'assets/models/props/space/basemodule_B.gltf',    pos: [-HW + 4, 0, -HL + 22],  targetH: 5.5, ry: -1.6 },
  ];
  for (const spec of specs) {
    try {
      const container = await loadProp(spec.path);
      if (gs.mapId !== 'lobby' || root.isDisposed()) continue;
      if (!container) { console.warn('[lobby] no container for', spec.path); continue; }
      const node = instantiateProp(container);
      if (!node) { console.warn('[lobby] instantiateProp null for', spec.path); continue; }
      node.parent = root;
      const bv = node.getHierarchyBoundingVectors(true);
      const h = bv.max.y - bv.min.y;
      const scaleFactor = h > 0.01 ? spec.targetH / h : 1;
      node.scaling.setAll(scaleFactor);
      node.rotation.y = spec.ry || 0;
      node.position.set(spec.pos[0], -bv.min.y * scaleFactor, spec.pos[2]);
      node.getChildMeshes(false).forEach(m => { m.receiveShadows = true; addShadow(m); });
    } catch (e) {
      console.warn('[lobby] space prop failed:', spec.path, e && e.message);
    }
  }
}

// ── Idle rigged NPCs near a few tubes (instant "characters look amazing" cue) ─
function spawnIdleNpcs(root) {
  if (!assetsReady) return;
  const npcSpots = [
    { body: 'male',   z: START_Z - 2 * SPACING,  side: 'left'  },
    { body: 'female', z: START_Z - 8 * SPACING,  side: 'right' },
    { body: 'male',   z: START_Z - 20 * SPACING, side: 'left'  },
    { body: 'female', z: START_Z - 30 * SPACING, side: 'right' },
  ];
  for (const spot of npcSpots) {
    const x = (spot.side === 'left' ? TUBE_X_LEFT : TUBE_X_RIGHT) + (spot.side === 'left' ? 4.5 : -4.5);
    const rig = createRiggedCharacter({ body: spot.body, hair: 'buzzed', hairColor: 0x2a2a2a, sc: scene });
    if (!rig) continue;
    rig.bodyGroup.parent = root;
    rig.bodyGroup.position.set(x, 0, spot.z);
    rig.bodyGroup.rotation.y = spot.side === 'left' ? -Math.PI / 2 : Math.PI / 2;
    rig.playAnim(Math.random() < 0.5 ? 'idle' : 'dance', { speedRatio: 0.9 });
    // bodyGroup is disposed by root.dispose() on map teardown, but the rig's
    // per-frame observer + cloned animation groups need their own cleanup —
    // same pattern enemies.js uses for its rigged enemies.
    rig.bodyGroup.onDisposeObservable.addOnce(() => rig.disposeExtras());
  }
}

// ── Wall helper ───────────────────────────────────────────────────────────────
function _wall(parent, x, z, len, dep, isNS) {
  const m = box(isNS ? len : dep, RH, isNS ? dep : len, wallMat, parent);
  m.position.set(x, RH / 2, z); addShadow(m);
  if (isNS) registerWallCollider(x - len/2, x + len/2, z - dep/2, z + dep/2);
  else      registerWallCollider(x - dep/2, x + dep/2, z - len/2, z + len/2);
  const gx = isNS ? x : (x < 0 ? x + dep/2 + 0.02 : x - dep/2 - 0.02);
  const gz = isNS ? (z < 0 ? z + dep/2 + 0.02 : z - dep/2 - 0.02) : z;
  box(isNS?len:0.06, 0.1, isNS?0.06:len, yellowGlow, parent).position.set(gx, RH-0.05, gz);
  box(isNS?len:0.06, 0.1, isNS?0.06:len, yellowGlow, parent).position.set(gx, 0.06,    gz);
}

// ── Screen panel ──────────────────────────────────────────────────────────────
function _screen(parent, x, y, z) {
  box(0.1, 5, 7, pbr(0x001830, 0.12, 0.2, { emissive: 0x002244, emissiveIntensity: 0.5 }), parent)
    .position.set(x, y, z);
  box(0.12, 5.2, 0.12, cyanGlow, parent).position.set(x, y, z - 3.5);
  box(0.12, 5.2, 0.12, cyanGlow, parent).position.set(x, y, z + 3.5);
  box(0.12, 0.12, 7.2, cyanGlow, parent).position.set(x, y + 2.5,  z);
  box(0.12, 0.12, 7.2, cyanGlow, parent).position.set(x, y - 2.5,  z);
}

// ── Single tube station ───────────────────────────────────────────────────────
function _buildTube(parent, globalIdx, z, txCenter, flipSign) {
  const count  = globalIdx + 1;
  const label  = `${count}v${count}`;
  const hex    = _tubeHex(globalIdx);
  const hexCss = '#' + hex.toString(16).padStart(6, '0');
  const isLeft = txCenter < 0;

  const glowMat = pbr(hex, 0.08, 0.2, { emissive: hex, emissiveIntensity: 1.5 });
  const ringMat = pbr(hex, 0.04, 0.5, { emissive: hex, emissiveIntensity: 3.0 });

  // Floor pad (horizontal disc)
  cyl(2.4, 2.4, 0.08, glowMat, parent, 24).position.set(txCenter, 0.04, z);
  torus(2.0, 0.13, ringMat, parent, 32).position.set(txCenter, 0.09, z);
  cyl(0.4, 0.4, 0.06,
    pbr(hex, 0.02, 0, { emissive: hex, emissiveIntensity: 5.5 }), parent, 12)
    .position.set(txCenter, 0.09, z);

  // Transparent tube body
  const r = ((hex >> 16) & 0xff) / 255;
  const g = ((hex >>  8) & 0xff) / 255;
  const b = ( hex        & 0xff) / 255;
  const tubeMat = new BABYLON.StandardMaterial('tbm_' + globalIdx, scene);
  tubeMat.emissiveColor   = new BABYLON.Color3(r, g, b);
  tubeMat.alpha           = 0.1;
  tubeMat.backFaceCulling = false;
  const tube = cyl(2.0, 2.0, 10.0, null, parent, 22);
  tube.material = tubeMat;
  tube.position.set(txCenter, 5.08, z);

  // Rings
  torus(2.1, 0.2, ringMat, parent, 32).position.set(txCenter, 0.18, z);
  torus(2.1, 0.2, ringMat, parent, 32).position.set(txCenter, 10.1,  z);
  torus(2.15, 0.1, pbr(0xffffff, 0.1, 0.1, { emissive: 0xffffff, emissiveIntensity: 2.0 }),
    parent, 28).position.set(txCenter, 5.1, z);

  // Floating sign (offset toward room centre so it's readable)
  const signX = isLeft ? txCenter + 2.5 : txCenter - 2.5;
  _tubeSign(parent, signX, z, label, hexCss, globalIdx);
}

function _tubeSign(parent, x, z, label, hexCss, idx) {
  const W = 200, H = 80;
  const fontSize = Math.min(52, Math.max(20, Math.floor(180 / label.length)));
  const tex = makeCanvasTex(W, H, ctx => {
    ctx.fillStyle = '#06061a';
    ctx.fillRect(0, 0, W, H);
    ctx.shadowBlur = 14; ctx.shadowColor = hexCss;
    ctx.strokeStyle = hexCss; ctx.lineWidth = 3;
    ctx.strokeRect(5, 5, W - 10, H - 10);
    ctx.fillStyle = '#ffffff';
    ctx.shadowBlur = 20; ctx.shadowColor = hexCss;
    ctx.font = `bold ${fontSize}px Arial`;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(label, W / 2, H / 2);
  });
  tex.hasAlpha = false;
  const mat = new BABYLON.StandardMaterial('sgm_' + idx, scene);
  mat.emissiveTexture = tex; mat.disableLighting = true; mat.backFaceCulling = false;
  const mesh = BABYLON.MeshBuilder.CreatePlane('sgn_' + idx, { width: 3.8, height: 1.5 }, scene);
  mesh.material = mat; mesh.parent = parent;
  mesh.position.set(x, 11.5, z);
  mesh.billboardMode = BABYLON.Mesh.BILLBOARDMODE_Y;
  mesh.isPickable = false;
  box(0.09, 1.4, 0.09, pbr(0x2a2a44, 0.5, 0.5), parent).position.set(x, 10.7, z);
}

// ── Conveyor belts — left (blue) toward 50/100v100, right (yellow) toward 1v1 ─
function _buildConveyors(parent) {
  gs.lobbyConvFwdTex = _conveyor(parent, -CONV_X, true);  // blue  ↓ toward far end
  _dirSign(parent, -CONV_X, 2.0,  HL - 8, '↓  TO  50v50 / 100v100',  '#2266ff');
  _dirSign(parent, -CONV_X, 2.0, -HL + 8, '↓  TO  50v50 / 100v100',  '#2266ff');

  gs.lobbyConvBwdTex = _conveyor(parent, +CONV_X, false); // yellow ↑ toward start
  _dirSign(parent, +CONV_X, 2.0,  HL - 8, '↑  TO  1v1 / 51v51',  '#ffcc00');
  _dirSign(parent, +CONV_X, 2.0, -HL + 8, '↑  TO  1v1 / 51v51',  '#ffcc00');
}

function _conveyor(parent, cx, towardFar) {
  // towardFar=true  → carries toward -z (50v50 / 100v100 end) — left belt, blue
  // towardFar=false → carries toward +z (1v1 / 51v51 end)    — right belt, yellow
  const isLeft = cx < 0;
  const col    = isLeft ? '#0066ff' : '#ffcc00';
  const bg     = isLeft ? '#030318' : '#181200';

  // Vertical arrows: ↓ for toward-far belt, ↑ for toward-start belt
  const tex = makeCanvasTex(128, 256, ctx => {
    ctx.fillStyle = bg; ctx.fillRect(0, 0, 128, 256);
    for (let row = 0; row < 4; row++) {
      const cy = row * 64 + 32;
      ctx.shadowBlur = 12; ctx.shadowColor = col; ctx.fillStyle = col;
      ctx.beginPath();
      if (towardFar) {
        // ↓ arrow — pointing toward far end (-z)
        ctx.moveTo(20, cy - 20); ctx.lineTo(108, cy - 20);
        ctx.lineTo(108, cy - 4); ctx.lineTo(64,  cy + 24);
        ctx.lineTo(20, cy - 4);
      } else {
        // ↑ arrow — pointing toward start (+z)
        ctx.moveTo(20, cy + 20); ctx.lineTo(108, cy + 20);
        ctx.lineTo(108, cy + 4); ctx.lineTo(64,  cy - 24);
        ctx.lineTo(20, cy + 4);
      }
      ctx.closePath(); ctx.fill();
    }
  });
  tex.hasAlpha = false; tex.vScale = 55;

  const mat = new BABYLON.StandardMaterial('conv_' + cx, scene);
  mat.emissiveTexture = tex; mat.disableLighting = true;

  box(CONV_W, 0.15, HL * 2, mat, parent).position.set(cx, 0.075, 0);

  // Side rail glows — kept clear of the belt's top surface (was a full-width
  // cover box sitting right on top of it, hiding the scrolling arrow texture).
  const glow = isLeft ? cyanGlow : yellowGlow;
  box(0.14, 0.25, HL * 2, glow, parent).position.set(cx - CONV_W / 2 - 0.07, 0.13, 0);
  box(0.14, 0.25, HL * 2, glow, parent).position.set(cx + CONV_W / 2 + 0.07, 0.13, 0);

  return tex;
}

function _dirSign(parent, x, y, z, text, color) {
  const tex = makeCanvasTex(280, 56, ctx => {
    ctx.fillStyle = '#000010'; ctx.fillRect(0, 0, 280, 56);
    ctx.fillStyle = color; ctx.shadowBlur = 12; ctx.shadowColor = color;
    ctx.font = 'bold 22px Arial'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(text, 140, 28);
  });
  tex.hasAlpha = false;
  const mat = new BABYLON.StandardMaterial('ds_' + z + x, scene);
  mat.emissiveTexture = tex; mat.disableLighting = true; mat.backFaceCulling = false;
  const m = BABYLON.MeshBuilder.CreatePlane('ds', { width: 5, height: 1.1 }, scene);
  m.material = mat; m.parent = parent;
  m.position.set(x, y, z);
  m.billboardMode = BABYLON.Mesh.BILLBOARDMODE_Y;
  m.isPickable = false;
}

function _banner(parent, x, y, z, title, color, sub) {
  const tex = makeCanvasTex(860, 150, ctx => {
    ctx.fillStyle = '#000a18'; ctx.fillRect(0, 0, 860, 150);
    ctx.strokeStyle = color; ctx.lineWidth = 5;
    ctx.shadowBlur = 20; ctx.shadowColor = color;
    ctx.strokeRect(7, 7, 846, 136);
    ctx.fillStyle = '#ffffff';
    ctx.shadowBlur = 28; ctx.shadowColor = color;
    ctx.font = 'bold 60px Arial'; ctx.textAlign = 'center'; ctx.textBaseline = 'top';
    ctx.fillText(title, 430, 14);
    ctx.shadowBlur = 10; ctx.fillStyle = color;
    ctx.font = 'bold 20px Arial'; ctx.textBaseline = 'bottom';
    ctx.fillText(sub, 430, 140);
  });
  tex.hasAlpha = false;
  const mat = new BABYLON.StandardMaterial('bnr_' + z, scene);
  mat.emissiveTexture = tex; mat.disableLighting = true; mat.backFaceCulling = false;
  const m = BABYLON.MeshBuilder.CreatePlane('bnr', { width: 22, height: 3.8 }, scene);
  m.material = mat; m.parent = parent;
  m.position.set(x, y, z); m.isPickable = false;
}

// ── Hue gradient: cyan(0) → green → yellow → orange → red(99) ────────────────
function _tubeHex(i) {
  const h = 180 - (i / 99) * 180;
  const s = 1, v = 0.97, c = v * s;
  const xv = c * (1 - Math.abs((h / 60) % 2 - 1)), m = v - c;
  let r = 0, g = 0, b = 0;
  if      (h < 60)  { r = c;  g = xv; b = 0;  }
  else if (h < 120) { r = xv; g = c;  b = 0;  }
  else if (h < 180) { r = 0;  g = c;  b = xv; }
  return (Math.round((r+m)*255) << 16) | (Math.round((g+m)*255) << 8) | Math.round((b+m)*255);
}
