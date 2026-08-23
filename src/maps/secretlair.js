// ── maps/secretlair.js  The Secret Lair ───────────────────────────────────────
import { scene, pbr, box, cyl, sph, plane, grp, addShadow, makeCanvasTex, setFog,
         ambientLight, sunLight } from '../engine.js';
import { gs, interactableObjects } from '../state.js';
import { registerWallCollider, registerMapGroup } from './index.js';

// ── Room registry ─────────────────────────────────────────────────────────────
const WT = 0.9;

const ROOMS = [
  { name:'MAIN HUB',    sector:'H-01', x:  0, z:  0, w:52, d:52, h:13, theme:'hub',     fog:0x1a1810, fogEnd:90 },
  { name:'STORAGE',     sector:'B-04', x: 90, z:  0, w:48, d:26, h:12, theme:'storage', fog:0x1a1610, fogEnd:80 },
  { name:'ENGINE ROOM', sector:'F-12', x:-90, z:  0, w:32, d:32, h:12, theme:'engine',  fog:0x1e100a, fogEnd:70 },
  { name:'SERVER CORE', sector:'C-07', x:  0, z: 90, w:28, d:38, h:11, theme:'server',  fog:0x0e1018, fogEnd:70 },
  { name:'ARMORY BAY',  sector:'A-02', x:  0, z:-90, w:26, d:26, h:11, theme:'armory',  fog:0x1a1008, fogEnd:65 },
  { name:'LAB ALPHA',   sector:'L-01', x: 90, z: 90, w:30, d:32, h:11, theme:'lab',     fog:0x0e1810, fogEnd:70 },
  { name:'COMMAND CTR', sector:'C-01', x:-90, z: 90, w:38, d:34, h:12, theme:'command', fog:0x10101e, fogEnd:75 },
  { name:'REACTOR',     sector:'R-03', x:-90, z:-90, w:24, d:24, h:11, theme:'reactor', fog:0x1e0e08, fogEnd:62 },
];

function floorToRoom(f) { return Math.min(7, Math.floor((f - 1) / 13)); }

// ── Elevator module state ─────────────────────────────────────────────────────
let _elevs        = [];
let _panelEl      = null;
let _sceneObs     = null;
let _activeElev   = null;
let _currentFloor = 1;
let _origSun      = 2.2;
let _origAmb      = 0.55;

// ── Main build ────────────────────────────────────────────────────────────────
export function buildSecretLairMap() {
  _elevs = []; _activeElev = null; _currentFloor = 1;

  const root = grp('secretlair');

  _origSun = sunLight.intensity;
  _origAmb = ambientLight.intensity;
  sunLight.intensity     = 0.45;
  ambientLight.intensity = 0.55;

  setFog(ROOMS[0].fog, 3, ROOMS[0].fogEnd);

  // Dark void floor between rooms
  const voidFl = box(400, 0.04, 400, pbr(0x020202, 0.98, 0.04), root);
  voidFl.position.set(0, -0.1, 0);
  voidFl.isPickable = false;

  ROOMS.forEach((rd, i) => buildRoom(root, rd, i));

  _panelEl = buildElevPanelDOM();
  updatePanelCurrentFloor(1);

  _sceneObs = scene.onBeforeRenderObservable.add(tickElevators);

  root.onDisposeObservable.addOnce(() => {
    scene.onBeforeRenderObservable.remove(_sceneObs);
    _sceneObs = null;
    if (_panelEl) { _panelEl.remove(); _panelEl = null; }
    _elevs = []; _activeElev = null;
    sunLight.intensity     = _origSun;
    ambientLight.intensity = _origAmb;
  });

  registerMapGroup(root);
  gs.isInsideMapInterior = (x, z) => !ROOMS.some(rd => {
    const hw = rd.w / 2 - 1.5;
    const hd = rd.d / 2 - 1.5;
    return x > rd.x - hw && x < rd.x + hw && z > rd.z - hd && z < rd.z + hd;
  });
}

// ── Room dispatcher ───────────────────────────────────────────────────────────
function buildRoom(root, rd, idx) {
  const hw = rd.w / 2, hd = rd.d / 2;
  buildShell(root, rd);

  const D = { root, rd, hw, hd };
  if      (rd.theme === 'hub')     buildHub(D);
  else if (rd.theme === 'storage') buildStorage(D);
  else if (rd.theme === 'engine')  buildEngine(D);
  else if (rd.theme === 'server')  buildServer(D);
  else if (rd.theme === 'armory')  buildArmoryRoom(D);
  else if (rd.theme === 'lab')     buildLab(D);
  else if (rd.theme === 'command') buildCommand(D);
  else if (rd.theme === 'reactor') buildReactor(D);

  buildTrusses(root, rd);
  buildSconces(root, rd);
  if (rd.theme === 'hub') buildLightShafts(root, rd);

  const elevFaceZ = rd.z - hd + 4.6;
  buildHazardStripes(root, rd.x, elevFaceZ + 0.2, rd);
  buildNavSign(root, rd.x + hw - 0.12, elevFaceZ + 0.6, idx);
  buildElevator(root, rd.x, elevFaceZ, hw, idx);

  if (rd.theme === 'armory') {
    const t = new BABYLON.TransformNode('armt', scene);
    t.parent = root; t.position.set(rd.x, 1, rd.z + 4);
    t.label = 'Armory Bay';
    t.onInteract = () => { if (window.__openArmory) window.__openArmory(); };
    interactableObjects.push(t);
  }
}

// ── Shared shell: floor, ceiling, 4 walls ────────────────────────────────────
function buildShell(root, rd) {
  const { x: rx, z: rz, w, d, h, theme } = rd;
  const hw = w / 2, hd = d / 2;

  const flM = FLOOR_MAT[theme];
  const wlM = WALL_MAT[theme];
  const clM = CEIL_MAT[theme];

  const fl = box(w, 0.18, d, flM, root);
  fl.position.set(rx, -0.09, rz);

  const cl = box(w + WT * 2, 0.28, d + WT * 2, clM, root);
  cl.position.set(rx, h + 0.14, rz);

  // 4 walls
  [
    { x: rx,          z: rz - hd - WT/2, bw: w + WT*2, bd: WT, minX: rx-hw-WT, maxX: rx+hw+WT, minZ: rz-hd-WT, maxZ: rz-hd },
    { x: rx,          z: rz + hd + WT/2, bw: w + WT*2, bd: WT, minX: rx-hw-WT, maxX: rx+hw+WT, minZ: rz+hd,    maxZ: rz+hd+WT },
    { x: rx + hw+WT/2,z: rz,             bw: WT, bd: d,         minX: rx+hw,    maxX: rx+hw+WT, minZ: rz-hd,    maxZ: rz+hd },
    { x: rx - hw-WT/2,z: rz,             bw: WT, bd: d,         minX: rx-hw-WT, maxX: rx-hw,    minZ: rz-hd,    maxZ: rz+hd },
  ].forEach(wd => {
    const wm = box(wd.bw, h, wd.bd, wlM, root);
    wm.position.set(wd.x, h / 2, wd.z);
    addShadow(wm);
    registerWallCollider(wd.minX, wd.maxX, wd.minZ, wd.maxZ);
  });
}

// ── Per-theme materials (unified dark industrial palette) ─────────────────────
const FLOOR_MAT = {
  hub:     pbr(0x303038, 0.90, 0.06),
  storage: pbr(0x302e28, 0.88, 0.08),
  engine:  pbr(0x2a2420, 0.72, 0.28),
  server:  pbr(0x28283a, 0.82, 0.12),
  armory:  pbr(0x2e2c28, 0.88, 0.08),
  lab:     pbr(0x2e2e34, 0.78, 0.10),
  command: pbr(0x222232, 0.72, 0.42),
  reactor: pbr(0x302820, 0.84, 0.18),
};
const WALL_MAT = {
  hub:     pbr(0x282830, 0.30, 0.76),
  storage: pbr(0x2a2a28, 0.34, 0.68),
  engine:  pbr(0x282420, 0.28, 0.72),
  server:  pbr(0x26283a, 0.30, 0.70),
  armory:  pbr(0x262820, 0.32, 0.72),
  lab:     pbr(0x28282e, 0.30, 0.70),
  command: pbr(0x202030, 0.28, 0.80),
  reactor: pbr(0x2e2218, 0.30, 0.72),
};
const CEIL_MAT = {
  hub:     pbr(0x222226, 0.20, 0.88),
  storage: pbr(0x242420, 0.22, 0.85),
  engine:  pbr(0x201e1a, 0.18, 0.90),
  server:  pbr(0x20202e, 0.20, 0.88),
  armory:  pbr(0x202218, 0.22, 0.85),
  lab:     pbr(0x202022, 0.20, 0.86),
  command: pbr(0x1c1c28, 0.18, 0.92),
  reactor: pbr(0x261e18, 0.22, 0.86),
};

// ── I-beam ceiling truss system ───────────────────────────────────────────────
function buildTrusses(parent, rd) {
  const { x: rx, z: rz, w, d, h } = rd;
  const beamM   = pbr(0x383848, 0.14, 0.94);
  const flangeH = 0.12, webH = 0.52, flangeW = 0.40, webT = 0.08;
  const topY    = h - 0.18;

  function iBeam(bx, bz, len, alongZ) {
    const tW = alongZ ? flangeW : len;
    const tD = alongZ ? len     : flangeW;
    const wW = alongZ ? webT    : len;
    const wD = alongZ ? len     : webT;
    const tf = box(tW, flangeH, tD, beamM, parent);
    tf.position.set(bx, topY, bz);
    const wb = box(wW, webH, wD, beamM, parent);
    wb.position.set(bx, topY - flangeH/2 - webH/2, bz);
    const bf = box(tW, flangeH, tD, beamM, parent);
    bf.position.set(bx, topY - flangeH - webH, bz);
  }

  // Cross beams (along X)
  const numX = Math.max(2, Math.round(d / 11));
  for (let i = 1; i <= numX; i++) {
    iBeam(rx, rz - d/2 + (d / (numX + 1)) * i, w + 0.6, false);
  }
  // Longitudinal beams (along Z)
  const numZ = Math.max(2, Math.round(w / 13));
  for (let i = 1; i <= numZ; i++) {
    iBeam(rx - w/2 + (w / (numZ + 1)) * i, rz, d + 0.6, true);
  }
}

// ── Wall sconces with orange point lights ─────────────────────────────────────
function buildSconces(parent, rd) {
  const { x: rx, z: rz, w, d, h } = rd;
  const scY  = Math.min(h * 0.30, 4.2);
  const hwM  = pbr(0x303040, 0.15, 0.82);
  const glwM = new BABYLON.StandardMaterial('scg_' + rd.theme + '_' + rd.x, scene);
  glwM.emissiveColor   = new BABYLON.Color3(1.0, 0.44, 0.02);
  glwM.disableLighting = true;
  const hw = w / 2, hd = d / 2;
  const sp = 8.5;

  function sconceNS(sx, sy, sz, north) {
    const hs = box(0.50, 0.22, 0.13, hwM, parent);
    hs.position.set(sx, sy + 0.11, sz + (north ? 0.10 : -0.10));
    const gs2 = sph(0.10, glwM, parent, 6);
    gs2.position.set(sx, sy - 0.06, sz + (north ? 0.20 : -0.20));
    gs2.isPickable = false;
  }
  function sconceEW(sx, sy, sz) {
    const hs = box(0.13, 0.22, 0.50, hwM, parent);
    hs.position.set(sx, sy + 0.11, sz);
    const gs2 = sph(0.10, glwM, parent, 6);
    gs2.position.set(sx + (sx > rx ? -0.20 : 0.20), sy - 0.06, sz);
    gs2.isPickable = false;
  }

  for (let ox = -hw + 4; ox < hw - 3; ox += sp) sconceNS(rx + ox, scY, rz - hd + 0.08, true);
  for (let ox = -hw + 4; ox < hw - 3; ox += sp) sconceNS(rx + ox, scY, rz + hd - 0.08, false);
  for (let oz = -hd + 4; oz < hd - 3; oz += sp) sconceEW(rx + hw - 0.08, scY, rz + oz);
  for (let oz = -hd + 4; oz < hd - 3; oz += sp) sconceEW(rx - hw + 0.08, scY, rz + oz);

  // 2-3 orange point lights for actual illumination
  const positions = [
    [rx - hw * 0.38, scY, rz - hd * 0.38],
    [rx + hw * 0.38, scY, rz + hd * 0.38],
  ];
  if (w > 40 || d > 40) positions.push([rx, scY + 0.5, rz]);

  const roomLights = positions.map(([lx, ly, lz]) => {
    const pl = new BABYLON.PointLight('rpl_' + rd.theme + lx.toFixed(0), new BABYLON.Vector3(lx, ly, lz), scene);
    pl.diffuse   = new BABYLON.Color3(1.0, 0.42, 0.04);
    pl.intensity = 55;
    pl.range     = Math.max(w, d) * 0.88;
    return pl;
  });
  parent.onDisposeObservable.addOnce(() => roomLights.forEach(l => l.dispose()));
}

// ── God-ray light shafts (hub only) ──────────────────────────────────────────
function buildLightShafts(parent, rd) {
  const { x: rx, z: rz, h: rh } = rd;
  const shM = new BABYLON.StandardMaterial('lshaft', scene);
  shM.emissiveColor   = new BABYLON.Color3(0.90, 0.80, 0.50);
  shM.disableLighting = true;
  shM.alpha           = 0.040;
  shM.backFaceCulling = false;

  [
    { ox: -13, oy: rh * 0.52, oz: -5,  rz2: -0.24, sw: 4.5, sh: rh * 1.35 },
    { ox:  -3, oy: rh * 0.52, oz:  5,  rz2: -0.16, sw: 3.2, sh: rh * 1.18 },
    { ox:  10, oy: rh * 0.50, oz: -2,  rz2: -0.30, sw: 4.0, sh: rh * 1.25 },
    { ox:  -6, oy: rh * 0.48, oz:  11, rz2: -0.20, sw: 2.8, sh: rh * 1.10 },
  ].forEach(def => {
    const p = plane(def.sw, def.sh, shM, parent);
    p.position.set(rx + def.ox, def.oy, rz + def.oz);
    p.rotation.z = def.rz2;
    p.isPickable  = false;
  });
}

// ── HUB — high-ceiling industrial warehouse ───────────────────────────────────
function buildHub({ root, rd }) {
  const { x: rx, z: rz } = rd;
  const concM = pbr(0x383838, 0.92, 0.04);
  const metM  = pbr(0x323240, 0.20, 0.88);
  const glwO  = pbr(0xff6200, 0.05, 0.1, { emissive: 0xff4800, emissiveIntensity: 2.6 });

  // Central briefing table (decorative only)
  const table = box(6, 0.88, 3, metM, root);
  table.position.set(rx, 0.44, rz + 8);
  addShadow(table);

  // Elevated catwalk on east side
  const catwalkY = 5.8;
  const catW = rd.w * 0.28;
  const catwalk = box(catW, 0.22, 7, concM, root);
  catwalk.position.set(rx + rd.w * 0.31, catwalkY, rz - 5);
  addShadow(catwalk);

  // Catwalk supports
  [-1, 1].forEach(side => {
    [rz - 2, rz - 8].forEach(sz => {
      const sup = box(0.26, catwalkY, 0.26, metM, root);
      sup.position.set(rx + rd.w * 0.31 + side * catW * 0.45, catwalkY / 2, sz);
    });
  });

  // Catwalk railing bar
  const rail = box(catW, 0.06, 0.06, glwO, root);
  rail.position.set(rx + rd.w * 0.31, catwalkY + 0.92, rz - 1.5);

  // Tactical display on south wall
  const scrFrame = box(9, 4.5, 0.24, metM, root);
  scrFrame.position.set(rx, 5.5, rz + rd.d / 2 - 0.24);
  addShadow(scrFrame);
  const screenTex = makeCanvasTex(440, 240, (ctx, w, h) => {
    ctx.fillStyle = '#020a0e'; ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = '#1a3322'; ctx.lineWidth = 0.5;
    for (let gx = 0; gx < w; gx += 20) { ctx.beginPath(); ctx.moveTo(gx,0); ctx.lineTo(gx,h); ctx.stroke(); }
    for (let gy = 0; gy < h; gy += 20) { ctx.beginPath(); ctx.moveTo(0,gy); ctx.lineTo(w,gy); ctx.stroke(); }
    ctx.fillStyle = '#ff6600'; ctx.font = 'bold 13px monospace'; ctx.textAlign = 'center';
    ctx.fillText('SECTOR MAP — CLASSIFIED', w/2, 22);
    [[110,90,14],[240,110,9],[360,145,16],[170,170,7],[290,65,11]].forEach(([px,py,r]) => {
      ctx.beginPath(); ctx.arc(px, py, r, 0, Math.PI*2);
      ctx.fillStyle = '#ff440033'; ctx.fill();
      ctx.strokeStyle = '#ff4400'; ctx.lineWidth = 1.5; ctx.stroke();
    });
    ctx.fillStyle = '#ff8800'; ctx.font = '10px monospace'; ctx.textAlign = 'left';
    ctx.fillText('▶ THREAT LEVEL: HIGH', 10, h - 12);
    ctx.textAlign = 'right'; ctx.fillText('LIVE FEED', w - 10, h - 12);
  });
  const scrMat = new BABYLON.StandardMaterial('hubscr', scene);
  scrMat.emissiveTexture = screenTex; scrMat.disableLighting = true;
  const scr = plane(8.4, 4.1, scrMat, root);
  scr.position.set(rx, 5.5, rz + rd.d/2 - 0.34); scr.rotation.y = Math.PI;

  // Structural columns (decorative only — no collision)
  [[-rd.w/2+2.5, -rd.d/2+2.5],[rd.w/2-2.5,-rd.d/2+2.5],[-rd.w/2+2.5,rd.d/2-2.5],[rd.w/2-2.5,rd.d/2-2.5]].forEach(([dx,dz]) => {
    const col = box(1.3, rd.h, 1.3, concM, root);
    col.position.set(rx+dx, rd.h/2, rz+dz);
    addShadow(col);
  });

  // Sandbag cover (decorative only)
  [[-12,-10],[12,-10],[-12, 5],[12, 5]].forEach(([dx,dz]) => {
    for (let i = 0; i < 5; i++) {
      const sb = box(1.0, 0.46, 0.52, concM, root);
      sb.position.set(rx+dx + (i%3)*0.72 - 0.72, 0.23 + Math.floor(i/3)*0.42, rz+dz);
    }
  });
}

// ── STORAGE — industrial shelf warehouse ──────────────────────────────────────
function buildStorage({ root, rd }) {
  const { x: rx, z: rz } = rd;
  const shelfM = pbr(0x303040, 0.20, 0.88);
  const concM  = pbr(0x383838, 0.92, 0.04);
  const boxMat = pbr(0x3a3028, 0.72, 0.12);
  const glwO   = pbr(0xff7000, 0.05, 0.1, { emissive: 0xff5200, emissiveIntensity: 2.0 });

  // Floor lane markers
  [-6, 6].forEach(dx => {
    const line = box(0.12, 0.05, rd.d - 2, pbr(0xff8800, 0.4, 0.1, { emissive: 0xff6600, emissiveIntensity: 0.32 }), root);
    line.position.set(rx + dx, 0.025, rz);
  });

  // Heavy shelving units (3 rows — decorative only)
  [-12, 0, 12].forEach(dx => {
    const frame = box(2.0, rd.h - 1.2, 16, shelfM, root);
    frame.position.set(rx+dx, (rd.h-1.2)/2, rz + 2);
    addShadow(frame);
    [1.8, 3.8, 5.8, 7.8].forEach(py => {
      const shelf = box(1.8, 0.10, 14, pbr(0x2c2c38, 0.45, 0.65), root);
      shelf.position.set(rx+dx, py, rz+2);
      for (let s = -2; s <= 2; s++) {
        const b = box(0.88, 0.68, 1.0, boxMat, root);
        b.position.set(rx+dx, py + 0.39, rz+2 + s*2.4);
      }
    });
  });

  // Barrel clusters (decorative only)
  [[rd.w/2-3.5, -5],[rd.w/2-3.5, 5],[-rd.w/2+3.5, -4]].forEach(([dx,dz]) => {
    for (let i = 0; i < 4; i++) {
      const brl = cyl(0.5, 0.5, 1.2, concM, root, 12);
      brl.position.set(rx+dx + (i%2)*1.1 - 0.6, 0.6, rz+dz + Math.floor(i/2)*1.1 - 0.6);
    }
  });

  // Overhead pendant lamps
  [-8, 0, 8].forEach(dx => {
    const cord = box(0.04, 1.4, 0.04, pbr(0x3c3c42, 0.48, 0.62), root);
    cord.position.set(rx+dx, rd.h - 0.85, rz + 2);
    const cap = box(0.38, 0.30, 0.38, pbr(0x3c3c42, 0.48, 0.62), root);
    cap.position.set(rx+dx, rd.h - 1.60, rz + 2);
    const bulb = sph(0.20, glwO, root, 6);
    bulb.position.set(rx+dx, rd.h - 1.82, rz + 2);
    bulb.isPickable = false;
  });

  // Loading dock platform
  const dock = box(rd.w - 4, 0.55, 4.5, concM, root);
  dock.position.set(rx, 0.28, rz + rd.d/2 - 3.5);
}

// ── ENGINE ROOM — turbine power chamber ───────────────────────────────────────
function buildEngine({ root, rd }) {
  const { x: rx, z: rz } = rd;
  const turbM  = pbr(0x2c3038, 0.16, 0.92);
  const pipeM  = pbr(0x3a3028, 0.60, 0.50);
  const glwHot = pbr(0xff6600, 0.05, 0.1, { emissive: 0xff4400, emissiveIntensity: 3.0 });
  const glwRed = pbr(0xff2200, 0.05, 0.1, { emissive: 0xff0000, emissiveIntensity: 2.2 });

  // Two massive turbines (decorative only — no collision)
  [[-6, 4],[6, 4]].forEach(([dx, dz]) => {
    const body = cyl(2.2, 2.2, rd.h - 1.8, turbM, root, 20);
    body.position.set(rx+dx, (rd.h-1.8)/2, rz+dz);
    addShadow(body);
    [1.4, 3.2, 5.0, 6.8, 8.4].forEach((ry, i) => {
      const ring = cyl(2.28, 2.28, 0.35, i%2===0?glwHot:glwRed, root, 20);
      ring.position.set(rx+dx, ry, rz+dz);
      ring.isPickable = false;
    });
    const cap = cyl(2.42, 2.42, 0.34, pipeM, root, 20);
    cap.position.set(rx+dx, rd.h - 1.4, rz+dz);
  });

  // Horizontal pipes on side walls
  [[-rd.w/2+0.7], [rd.w/2-0.7]].forEach(([dx]) => {
    [1.6, 3.5, 6.0, 8.5].forEach(py => {
      const pipe = cyl(0.28, 0.28, rd.d - 2, pipeM, root, 8);
      pipe.position.set(rx+dx, py, rz);
      pipe.rotation.x = Math.PI / 2;
    });
  });

  // Pressure gauges on north wall
  [-5, 0, 5].forEach(dx => {
    const gauge = box(0.9, 0.9, 0.18, pipeM, root);
    gauge.position.set(rx+dx, 3.8, rz - rd.d/2 + 0.22);
    const needle = box(0.06, 0.48, 0.07, glwHot, root);
    needle.position.set(rx+dx + 0.18, 3.95, rz - rd.d/2 + 0.32);
    needle.rotation.z = -0.45;
  });

  // Metal grate floor
  for (let gx = -rd.w/2+1; gx < rd.w/2-1; gx += 3.5) {
    const grate = box(3.2, 0.06, rd.d - 2, pbr(0x2c2c30, 0.55, 0.55), root);
    grate.position.set(rx+gx, 0.0, rz);
  }
}

// ── SERVER CORE — data center ─────────────────────────────────────────────────
function buildServer({ root, rd }) {
  const { x: rx, z: rz } = rd;
  const rackM = pbr(0x2c3040, 0.22, 0.80);
  const glwB  = pbr(0x0066ff, 0.05, 0.1, { emissive: 0x0044cc, emissiveIntensity: 1.8 });
  const glwG  = pbr(0x00ff55, 0.05, 0.1, { emissive: 0x00cc33, emissiveIntensity: 1.4 });

  [-6, 0, 6].forEach(dx => {
    for (let row = -2; row <= 2; row++) {
      const tower = box(2.0, rd.h - 1.0, 2.8, rackM, root);
      tower.position.set(rx+dx, (rd.h-1.0)/2, rz + row * 5.5);
      addShadow(tower);
      [0.8, 2.2, 3.8, 5.5].forEach((py, i) => {
        const led = sph(0.10, i%2===0?glwB:glwG, root, 4);
        led.position.set(rx+dx+0.85, py, rz+row*5.5-1.46);
        led.isPickable = false;
      });
      const bar = box(1.6, 0.07, 0.08, glwB, root);
      bar.position.set(rx+dx, 0.5, rz+row*5.5-1.47);
    }
  });

  // Overhead cable tray
  const tray = box(rd.w - 2, 0.22, 0.7, pbr(0x303038, 0.28, 0.82), root);
  tray.position.set(rx, rd.h - 0.55, rz);

  // Floor glow seams
  [-6, 0, 6].forEach(dx => {
    const seam = box(0.06, 0.04, rd.d - 2, glwB, root);
    seam.position.set(rx+dx, 0.02, rz);
  });
}

// ── ARMORY BAY — weapons vault ────────────────────────────────────────────────
function buildArmoryRoom({ root, rd }) {
  const { x: rx, z: rz } = rd;
  const rackM  = pbr(0x383840, 0.20, 0.90);
  const lkrM   = pbr(0x303038, 0.28, 0.82);
  const glwR   = pbr(0xff1100, 0.05, 0.1, { emissive: 0xcc0000, emissiveIntensity: 1.8 });
  const glwA   = pbr(0xff8800, 0.05, 0.1, { emissive: 0xcc6600, emissiveIntensity: 1.4 });

  // Weapon racks on east + west walls (decorative only)
  [-rd.w/2+0.9, rd.w/2-0.9].forEach(dx => {
    const rack = box(0.45, rd.h - 1.5, rd.d - 5, rackM, root);
    rack.position.set(rx+dx, (rd.h-1.5)/2, rz);
    for (let s = -rd.d/2+3; s < rd.d/2-3; s += 2.5) {
      const gun = box(0.12, 0.20, 1.8, pbr(0x282e28, 0.6, 0.5), root);
      gun.position.set(rx+dx + (dx>0?-0.28:0.28), 2.5, rz+s);
    }
  });

  // Ammo crates (decorative only)
  [[-3,6],[3,6],[0,8]].forEach(([dx,dz]) => {
    [0,0.8,1.6].forEach(dy => {
      const crate = box(1.4, 0.72, 1.0, pbr(0x383838, 0.92, 0.04), root);
      crate.position.set(rx+dx, 0.36+dy, rz+dz);
    });
  });

  // Lockers on south wall (decorative only)
  for (let i = -2; i <= 2; i++) {
    const locker = box(1.2, 2.6, 0.6, lkrM, root);
    locker.position.set(rx + i*2.4, 1.3, rz + rd.d/2 - 0.45);
    addShadow(locker);
    const handle = box(0.08, 0.28, 0.08, glwA, root);
    handle.position.set(rx + i*2.4 + 0.36, 1.5, rz + rd.d/2 - 0.12);
  }

  [-rd.w/2+1.5, 0, rd.w/2-1.5].forEach(dx => {
    const lt = sph(0.20, glwR, root, 6);
    lt.position.set(rx+dx, rd.h - 0.55, rz);
    lt.isPickable = false;
  });

  // Blast door decorative
  const blast = box(rd.w - 4, rd.h - 0.5, 0.55, pbr(0x2e3038, 0.28, 0.82), root);
  blast.position.set(rx, rd.h/2, rz - rd.d/2 + 0.40);
  const seamLine = box(0.10, rd.h - 0.5, 0.58, glwA, root);
  seamLine.position.set(rx, rd.h/2, rz - rd.d/2 + 0.40);
}

// ── LAB ALPHA — research facility ─────────────────────────────────────────────
function buildLab({ root, rd }) {
  const { x: rx, z: rz } = rd;
  const benchM = pbr(0x2e3232, 0.40, 0.60);
  const glwG   = pbr(0x00ff55, 0.05, 0.1, { emissive: 0x00cc33, emissiveIntensity: 2.0 });
  const glwC   = pbr(0x00ffee, 0.05, 0.1, { emissive: 0x00cccc, emissiveIntensity: 1.6 });
  const hazM   = pbr(0xffdd00, 0.5, 0.1, { emissive: 0xffaa00, emissiveIntensity: 0.35 });

  [[-6, 6],[6, 6],[-6, -4],[6, -4]].forEach(([dx,dz]) => {
    const bench = box(5.0, 0.84, 2.2, benchM, root);
    bench.position.set(rx+dx, 0.42, rz+dz);
    addShadow(bench);
    for (let fi = -1; fi <= 1; fi++) {
      const flask = cyl(0.18, 0.26, 0.72, fi%2===0?glwG:glwC, root, 8);
      flask.position.set(rx+dx + fi*1.0, 1.24, rz+dz - 0.45);
      flask.isPickable = false;
    }
    const gs2 = box(4.2, 0.06, 0.9, dx<0?glwG:glwC, root);
    gs2.position.set(rx+dx, 0.88, rz+dz);
  });

  [-8, 8].forEach(dx => {
    const barrel = cyl(0.52, 0.52, 1.4, pbr(0x383838, 0.92, 0.04), root, 10);
    barrel.position.set(rx+dx, 0.7, rz + 10);
    const sym = sph(0.11, hazM, root, 6);
    sym.position.set(rx+dx, 1.35, rz + 9.5);
    sym.isPickable = false;
  });

  const hood = box(4.5, 2.4, 1.3, benchM, root);
  hood.position.set(rx, 1.2, rz + rd.d/2 - 0.9);
  addShadow(hood);
  const hGlow = box(4.0, 1.6, 0.1, glwG, root);
  hGlow.position.set(rx, 1.1, rz + rd.d/2 - 0.26);

  const haz = box(rd.w - 4, 0.04, 0.30, hazM, root);
  haz.position.set(rx, 0.02, rz + rd.d/2 - 2.2);
}

// ── COMMAND CENTER ────────────────────────────────────────────────────────────
function buildCommand({ root, rd }) {
  const { x: rx, z: rz } = rd;
  const deskM = pbr(0x2a2a38, 0.28, 0.72);
  const glwP  = pbr(0x8844ff, 0.05, 0.1, { emissive: 0x6622dd, emissiveIntensity: 1.8 });
  const glwB  = pbr(0x2266ff, 0.05, 0.1, { emissive: 0x1144cc, emissiveIntensity: 1.6 });

  [
    { dx:0, dz:5, bw:12, bd:1.8 },
    { dx:-5.5, dz:2, bw:1.8, bd:4.5 },
    { dx:5.5, dz:2, bw:1.8, bd:4.5 },
  ].forEach(({ dx, dz, bw, bd }) => {
    const desk = box(bw, 0.92, bd, deskM, root);
    desk.position.set(rx+dx, 0.46, rz+dz);
    addShadow(desk);
    const scr = box(bw-0.4, 0.07, bd-0.4, glwB, root);
    scr.position.set(rx+dx, 0.96, rz+dz);
  });

  [-7, 0, 7].forEach(dx => {
    const mon = box(3.2, 2.0, 0.14, deskM, root);
    mon.position.set(rx+dx, 4.4, rz + 5.8); mon.rotation.x = -0.18;
    const sg = box(2.8, 1.6, 0.08, glwB, root);
    sg.position.set(rx+dx, 4.4, rz + 5.73); sg.rotation.x = -0.18;
  });

  const proj = cyl(0.5, 0.5, 0.3, deskM, root, 16);
  proj.position.set(rx, 0.15, rz);
  const holo = cyl(0.08, 1.4, 2.8, glwP, root, 16);
  holo.position.set(rx, 1.9, rz);
  const disc = cyl(1.4, 1.4, 0.07, glwP, root, 24);
  disc.position.set(rx, 3.25, rz);

  for (let gx = -rd.w/2+3.5; gx < rd.w/2-3; gx += 4) {
    const fs = box(0.06, 0.04, rd.d-2, glwP, root);
    fs.position.set(rx+gx, 0.02, rz);
  }

  [-rd.w/2+0.07, rd.w/2-0.07].forEach(dx => {
    for (let p = -3; p <= 3; p++) {
      const panel = box(0.14, 1.8, 2.2, pbr(0x28282e, 0.92, 0.06), root);
      panel.position.set(rx+dx, 3.2, rz + p * 3.5);
    }
  });
}

// ── REACTOR — nuclear power chamber ───────────────────────────────────────────
function buildReactor({ root, rd }) {
  const { x: rx, z: rz } = rd;
  const concM = pbr(0x383838, 0.92, 0.04);
  const pipeM = pbr(0x3c3c42, 0.48, 0.62);
  const glwR  = pbr(0xff1100, 0.05, 0.1, { emissive: 0xcc0000, emissiveIntensity: 3.0 });
  const glwO  = pbr(0xff6600, 0.05, 0.1, { emissive: 0xff4400, emissiveIntensity: 2.5 });

  const col = cyl(1.2, 1.2, rd.h, pbr(0x2a2430, 0.16, 0.92), root, 24);
  col.position.set(rx, rd.h/2, rz);
  addShadow(col);

  [0.9, 2.2, 3.5, 4.8, 6.2, 7.5, 8.8].forEach((py, i) => {
    const ring = cyl(1.28, 1.28, 0.38, i%2===0?glwR:glwO, root, 24);
    ring.position.set(rx, py, rz);
    ring.isPickable = false;
  });

  [Math.PI/4, 3*Math.PI/4, 5*Math.PI/4, 7*Math.PI/4].forEach(angle => {
    const pr = 2.6;
    const pipe = cyl(0.24, 0.24, rd.h - 1, pipeM, root, 8);
    pipe.position.set(rx + Math.cos(angle)*pr, (rd.h-1)/2, rz + Math.sin(angle)*pr);
  });

  const radM = pbr(0xffcc00, 0.4, 0.05, { emissive: 0xffaa00, emissiveIntensity: 0.65 });
  [[-6,6],[6,-6],[-6,-6],[6,6]].forEach(([dx,dz]) => {
    const rs = box(0.9, 0.04, 0.9, radM, root);
    rs.position.set(rx+dx, 0.02, rz+dz);
    const brace = box(0.28, rd.h - 0.5, 0.28, concM, root);
    brace.position.set(rx+dx, (rd.h-0.5)/2, rz+dz);
  });

  [
    { x:rx, z:rz-rd.d/2+0.14, w:rd.w-2, d:0.14 },
    { x:rx, z:rz+rd.d/2-0.14, w:rd.w-2, d:0.14 },
    { x:rx-rd.w/2+0.14, z:rz, w:0.14, d:rd.d-2 },
    { x:rx+rd.w/2-0.14, z:rz, w:0.14, d:rd.d-2 },
  ].forEach(({ x, z, w: bw, d: bd }) => {
    const str = box(bw, rd.h-0.5, bd, pbr(0xff8800,0.4,0.1,{emissive:0xff6600,emissiveIntensity:0.55}), root);
    str.position.set(x, rd.h/2, z);
  });
}

// ── Hazard stripes in front of elevator ──────────────────────────────────────
function buildHazardStripes(parent, rx, z, rd) {
  const warnA = pbr(0xff9900, 0.38, 0.10, { emissive: 0xff7700, emissiveIntensity: 0.45 });
  const warnD = pbr(0x282828, 0.88, 0.05);
  for (let i = 0; i < 7; i++) {
    const s = box(rd.w * 0.45, 0.04, 0.24, i%2===0?warnA:warnD, parent);
    s.position.set(rx, 0.02, z + i * 0.46);
  }
}

// ── Navigation sign — portrait layout matching image 2 ────────────────────────
function buildNavSign(parent, x, z, roomIdx) {
  const r1 = ROOMS[(roomIdx + 1) % ROOMS.length];
  const r2 = ROOMS[(roomIdx + 2) % ROOMS.length];

  const tex = makeCanvasTex(320, 500, (ctx, w, h) => {
    // Background
    ctx.fillStyle = '#040408'; ctx.fillRect(0, 0, w, h);

    // Subtle grid overlay
    ctx.strokeStyle = 'rgba(255,80,0,0.05)'; ctx.lineWidth = 0.5;
    for (let gx = 0; gx < w; gx += 22) { ctx.beginPath(); ctx.moveTo(gx,0); ctx.lineTo(gx,h); ctx.stroke(); }
    for (let gy = 0; gy < h; gy += 22) { ctx.beginPath(); ctx.moveTo(0,gy); ctx.lineTo(w,gy); ctx.stroke(); }

    // Outer orange border
    ctx.strokeStyle = '#c84000'; ctx.lineWidth = 2.5;
    ctx.strokeRect(4, 4, w-8, h-8);
    ctx.strokeStyle = '#3a1200'; ctx.lineWidth = 1;
    ctx.strokeRect(9, 9, w-18, h-18);

    // Header bar
    ctx.fillStyle = '#0d0400'; ctx.fillRect(11, 11, w-22, 32);
    ctx.strokeStyle = '#3a1400'; ctx.lineWidth = 0.5; ctx.strokeRect(11, 11, w-22, 32);
    ctx.fillStyle = '#663300'; ctx.font = 'bold 9px monospace'; ctx.textAlign = 'center';
    ctx.fillText('■  NAVIGATION SYSTEM  ■', w/2, 31);

    function drawDest(dy, room) {
      const secH = 130;
      ctx.fillStyle = '#06040a'; ctx.fillRect(11, dy, w-22, secH);
      ctx.strokeStyle = '#2e1200'; ctx.lineWidth = 1; ctx.strokeRect(11, dy, w-22, secH);
      // Top accent
      ctx.fillStyle = '#4a1800'; ctx.fillRect(11, dy, w-22, 3);

      // Arrow button
      const btnCX = w - 40, btnCY = dy + secH/2;
      const grad = ctx.createRadialGradient(btnCX, btnCY-6, 3, btnCX, btnCY, 24);
      grad.addColorStop(0, '#ff5800'); grad.addColorStop(1, '#7a1e00');
      ctx.fillStyle = grad;
      ctx.beginPath(); ctx.arc(btnCX, btnCY, 24, 0, Math.PI*2); ctx.fill();
      ctx.strokeStyle = '#ff6a00'; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.arc(btnCX, btnCY, 24, 0, Math.PI*2); ctx.stroke();
      ctx.fillStyle = '#ffffff'; ctx.font = 'bold 13px monospace'; ctx.textAlign = 'center';
      ctx.fillText('>>', btnCX, btnCY + 5);

      // Room name
      ctx.fillStyle = '#cccccc'; ctx.font = 'bold 14px monospace'; ctx.textAlign = 'left';
      ctx.fillText(room.name, 18, dy + 46);
      ctx.strokeStyle = '#2e1000'; ctx.lineWidth = 0.8;
      ctx.beginPath(); ctx.moveTo(18, dy+54); ctx.lineTo(w-70, dy+54); ctx.stroke();

      // Sector
      ctx.fillStyle = '#cc5500'; ctx.font = '11px monospace';
      ctx.fillText('Sector ' + room.sector, 18, dy + 70);

      // Status dots
      [0,1,2].forEach(i => {
        ctx.fillStyle = i < 2 ? '#ff6600' : '#441800';
        ctx.beginPath(); ctx.arc(18 + i*14, dy + 88, 5, 0, Math.PI*2); ctx.fill();
      });
      ctx.fillStyle = '#551a00'; ctx.font = '9px monospace';
      ctx.fillText('ACCESS PENDING', 40, dy + 92);
    }

    drawDest(48, r1);
    drawDest(192, r2);

    // Warning section
    const warnY = 338, warnH = h - warnY - 14;
    ctx.fillStyle = '#0a0100'; ctx.fillRect(11, warnY, w-22, warnH);
    ctx.strokeStyle = '#cc1e00'; ctx.lineWidth = 1.5; ctx.strokeRect(11, warnY, w-22, warnH);

    // Warning triangle
    ctx.fillStyle = '#cc1e00';
    ctx.beginPath();
    ctx.moveTo(w/2, warnY + 9);
    ctx.lineTo(w/2 - 16, warnY + 38);
    ctx.lineTo(w/2 + 16, warnY + 38);
    ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#ffffff'; ctx.font = 'bold 12px monospace'; ctx.textAlign = 'center';
    ctx.fillText('!', w/2 + 0.5, warnY + 32);

    ctx.fillStyle = '#ff3300'; ctx.font = 'bold 10px monospace'; ctx.textAlign = 'center';
    ctx.fillText('⚠  CREDENTIALS CHECKS', w/2, warnY + 58);
    ctx.fillStyle = '#882200'; ctx.font = '9px monospace';
    ctx.fillText('>> SECURE ACCESS REQUIRED', w/2, warnY + 76);
    ctx.fillText('>> VERIFY IDENTITY BEFORE ENTRY', w/2, warnY + 92);

    // Bottom strip
    ctx.fillStyle = '#3a1000'; ctx.fillRect(11, h - 28, w-22, 15);
    ctx.fillStyle = '#882200'; ctx.font = '8px monospace'; ctx.textAlign = 'center';
    ctx.fillText('▌'.repeat(22), w/2, h - 17);
  });

  const mat = new BABYLON.StandardMaterial('nsm_' + roomIdx, scene);
  mat.emissiveTexture  = tex;
  mat.disableLighting  = true;
  mat.backFaceCulling  = false;

  const p = plane(1.15, 1.80, mat, parent);
  p.position.set(x, 2.6, z);
  p.rotation.y = -Math.PI / 2;
}

// ── Elevator booth — large industrial cab ──────────────────────────────────────
function buildElevator(parent, rx, doorFaceZ, hw, roomIdx) {
  const EW = 7.0, ED = 6.0, HW = EW / 2;
  const backZ   = doorFaceZ - ED;
  const doorM   = pbr(0x2a2a38, 0.13, 0.96);
  const panelM  = pbr(0x28282e, 0.16, 0.94);
  const gOrange = pbr(0xff6600, 0.05, 0.1, { emissive: 0xff5000, emissiveIntensity: 2.8 });
  const seamM   = pbr(0x181820, 0.08, 0.98);

  // Back wall
  const bk = box(EW+WT*2, 7, WT, doorM, parent);
  bk.position.set(rx, 3.5, backZ-WT/2);
  registerWallCollider(rx-HW-WT, rx+HW+WT, backZ-WT, backZ);

  // Side walls
  const lw = box(WT, 7, ED, doorM, parent);
  lw.position.set(rx-HW-WT/2, 3.5, doorFaceZ-ED/2);
  registerWallCollider(rx-HW-WT, rx-HW, doorFaceZ-ED, doorFaceZ);

  const rw = box(WT, 7, ED, doorM, parent);
  rw.position.set(rx+HW+WT/2, 3.5, doorFaceZ-ED/2);
  registerWallCollider(rx+HW, rx+HW+WT, doorFaceZ-ED, doorFaceZ);

  // Interior ceiling + floor
  const ec = box(EW, 0.22, ED, doorM, parent);
  ec.position.set(rx, 7.11, doorFaceZ-ED/2);
  const cs = box(EW-0.6, 0.06, ED-0.6, gOrange, parent);
  cs.position.set(rx, 6.96, doorFaceZ-ED/2);
  const ef = box(EW, 0.07, ED, pbr(0x2a2a30, 0.55, 0.60), parent);
  ef.position.set(rx, 0.035, doorFaceZ-ED/2);

  // Interior button panel box on back-right wall (decorative 3D panel)
  const bp = box(0.16, 3.5, 2.8, panelM, parent);
  bp.position.set(rx+HW-0.06, 2.4, backZ+2.0);
  const indInt = sph(0.11, gOrange, parent, 8);
  indInt.position.set(rx+HW-0.06, 4.5, backZ+2.0);
  indInt.isPickable = false;

  // Orange indicator light on wall OUTSIDE beside door (right side)
  const indHousing = box(0.22, 0.22, 0.16, pbr(0x2a2a2e, 0.18, 0.82), parent);
  indHousing.position.set(rx+HW+WT*0.55, 2.0, doorFaceZ - 0.8);
  const indGlow = sph(0.08, gOrange, parent, 8);
  indGlow.position.set(rx+HW+WT*0.55, 2.0, doorFaceZ - 0.66);
  indGlow.isPickable = false;

  // Door frame: top orange accent strip
  const topStripe = box(EW+WT*2, 0.30, 0.18, gOrange, parent);
  topStripe.position.set(rx, 7.02, doorFaceZ+0.12);

  // Door frame: side accent strips
  [rx-HW-WT*0.5, rx+HW+WT*0.5].forEach(sx => {
    const side = box(0.10, 7, 0.10, gOrange, parent);
    side.position.set(sx, 3.5, doorFaceZ);
  });

  // Sliding door panels (very dark metal)
  const leftDoor  = box(HW, 7, 0.14, doorM, parent);
  leftDoor.position.set(rx-HW/2, 3.5, doorFaceZ);
  addShadow(leftDoor);

  [-HW*0.33, 0, HW*0.33].forEach(dx => {
    const vs = box(0.04, 7, 0.05, seamM, leftDoor);
    vs.position.set(dx, 0, 0.09);
  });

  const rightDoor = box(HW, 7, 0.14, doorM, parent);
  rightDoor.position.set(rx+HW/2, 3.5, doorFaceZ);
  addShadow(rightDoor);

  [-HW*0.33, 0, HW*0.33].forEach(dx => {
    const vs = box(0.04, 7, 0.05, seamM, rightDoor);
    vs.position.set(dx, 0, 0.09);
  });

  const seam = box(0.06, 7, 0.06, gOrange, parent);
  seam.position.set(rx, 3.5, doorFaceZ+0.09);

  _elevs.push({
    x: rx, interiorZ: doorFaceZ-ED/2, doorFaceZ,
    leftDoor, rightDoor, seam,
    closedLX: rx-HW/2, openLX: rx-HW-WT+0.08,
    closedRX: rx+HW/2, openRX: rx+HW+WT-0.08,
    openT: 0, isMoving: false, roomIdx,
  });
}

// ── Per-frame elevator tick ───────────────────────────────────────────────────
function tickElevators() {
  const pb = window.__playerRefs?.playerBody;
  if (!pb || !gs.started) return;
  const px = pb.position.x, pz = pb.position.z;
  const dt = Math.min(scene.getEngine().getDeltaTime() / 1000, 0.05);

  let nearElev = null, nearDist = Infinity;
  _elevs.forEach(e => {
    const d = Math.hypot(px - e.x, pz - e.doorFaceZ);
    if (d < 7.0 && d < nearDist) { nearDist = d; nearElev = e; }
  });

  _elevs.forEach(elev => {
    const shouldOpen = elev === nearElev && !elev.isMoving;
    const target = shouldOpen ? 1 : 0;
    elev.openT += (target - elev.openT) * Math.min(1, dt * (shouldOpen ? 4.2 : 5.5));
    const t = elev.openT;
    elev.leftDoor.position.x  = elev.closedLX + (elev.openLX - elev.closedLX) * t;
    elev.rightDoor.position.x = elev.closedRX + (elev.openRX - elev.closedRX) * t;
    elev.seam.isVisible = t < 0.90;
  });

  const insideElev = _elevs.find(e =>
    !e.isMoving && e.openT > 0.82 &&
    Math.abs(px - e.x) < 3.0 &&
    pz < e.doorFaceZ - 0.3 &&
    pz > e.interiorZ - 2.5
  );

  if (_panelEl) {
    if (insideElev) { _panelEl.style.display = 'flex'; _activeElev = insideElev; }
    else if (_activeElev && !_activeElev.isMoving) { _panelEl.style.display = 'none'; _activeElev = null; }
  }
}

// ── Elevator movement animation ───────────────────────────────────────────────
function showShaftAnimation(fromFloor, toFloor, onArrived) {
  const goingUp  = toFloor > fromFloor;
  const distance = Math.abs(toFloor - fromFloor);
  const duration = Math.min(2600, 480 + distance * 32); // ms

  const overlay = document.createElement('div');
  overlay.style.cssText = 'position:fixed;inset:0;z-index:9997;pointer-events:none;overflow:hidden;';
  const cvs = document.createElement('canvas');
  cvs.style.cssText = 'position:absolute;inset:0;';
  overlay.appendChild(cvs);
  document.body.appendChild(overlay);

  const resize = () => { cvs.width = window.innerWidth; cvs.height = window.innerHeight; };
  resize();
  window.addEventListener('resize', resize);

  const ctx = cvs.getContext('2d');
  let startTime = null;
  let shaftY = 0;
  let shakeX = 0;

  function easeIO(t) { return t < 0.5 ? 2*t*t : -1+(4-2*t)*t; }

  function frame(ts) {
    if (!startTime) startTime = ts;
    const elapsed  = ts - startTime;
    const rawT     = Math.min(1, elapsed / duration);
    const eased    = easeIO(rawT);
    const speed    = Math.sin(rawT * Math.PI) * 18; // peak 18px/frame

    const W = cvs.width, H = cvs.height;
    shaftY  += goingUp ? speed : -speed;
    shakeX   = (Math.random() - 0.5) * speed * 0.15;

    ctx.clearRect(0, 0, W, H);

    // ── Background ────────────────────────────────────────────────────────────
    ctx.fillStyle = 'rgba(5,4,8,0.93)';
    ctx.fillRect(0, 0, W, H);

    // ── Shaft wall columns (left 22%, right 22%) ──────────────────────────────
    const sideW = W * 0.22;
    [0, W - sideW].forEach((sx, side) => {
      ctx.fillStyle = '#10101a';
      ctx.fillRect(sx, 0, sideW, H);

      // Panel vertical seams
      [0.28, 0.72].forEach(fx => {
        ctx.fillStyle = '#1c1c28';
        ctx.fillRect(sx + fx * sideW - 1, 0, 2, H);
      });

      // Horizontal floor-level markers scrolling
      const spacing = 58;
      const off = ((goingUp ? shaftY : -shaftY) % spacing + spacing * 2) % spacing;
      for (let y = off - spacing; y < H + spacing; y += spacing) {
        const alpha = 0.15 + speed * 0.018;
        ctx.fillStyle = `rgba(255,80,0,${Math.min(0.45, alpha)})`;
        ctx.fillRect(sx, y, sideW, 2);
        // Sconce blobs
        ctx.fillStyle = `rgba(255,100,30,${Math.min(0.35, alpha * 0.75)})`;
        ctx.fillRect(sx + sideW * 0.45 - 5, y - 7, 10, 16);
      }

      // Vertical cable/pipe
      ctx.fillStyle = '#1a1820';
      ctx.fillRect(sx + sideW * 0.15 - 2, 0, 4, H);
    });

    // ── Speed blur streaks in center ──────────────────────────────────────────
    if (speed > 6) {
      const blurA = Math.min(0.22, (speed - 6) / 12 * 0.22);
      ctx.globalAlpha = blurA;
      for (let k = 0; k < 12; k++) {
        const lx = sideW + Math.random() * (W - sideW * 2);
        const len = speed * 5;
        ctx.fillStyle = '#ff440025';
        ctx.fillRect(lx, Math.random() * H, 1.5, goingUp ? len : -len);
      }
      ctx.globalAlpha = 1;
    }

    // ── Center floor number display ───────────────────────────────────────────
    const curFloor = Math.round(fromFloor + (toFloor - fromFloor) * eased);
    const bW = 250, bH = 95, bx = W/2 - bW/2 + shakeX, by = H/2 - bH/2;

    ctx.fillStyle = 'rgba(7,6,12,0.92)';
    ctx.fillRect(bx, by, bW, bH);
    ctx.strokeStyle = '#ff5500';
    ctx.lineWidth = 2;
    ctx.strokeRect(bx, by, bW, bH);

    ctx.fillStyle = '#ff8800';
    ctx.font = 'bold 40px monospace';
    ctx.textAlign = 'center';
    ctx.fillText('FLOOR ' + String(curFloor).padStart(2, '0'), W/2 + shakeX, H/2 + 10);

    ctx.fillStyle = '#ff4400';
    ctx.font = '13px monospace';
    ctx.fillText(goingUp ? '▲  ASCENDING  ▲' : '▼  DESCENDING  ▼', W/2 + shakeX, H/2 + 36);

    // Small progress bar
    ctx.fillStyle = '#220e00';
    ctx.fillRect(bx + 12, by + bH - 14, bW - 24, 6);
    ctx.fillStyle = '#ff6600';
    ctx.fillRect(bx + 12, by + bH - 14, (bW - 24) * rawT, 6);

    if (rawT < 1) {
      requestAnimationFrame(frame);
    } else {
      overlay.remove();
      window.removeEventListener('resize', resize);
      onArrived();
    }
  }

  requestAnimationFrame(frame);
}

// ── Teleport to floor ─────────────────────────────────────────────────────────
function teleportToFloor(floor) {
  if (!_activeElev || _activeElev.isMoving) return;
  const destRoomIdx = floorToRoom(floor);
  const destElev    = _elevs.find(e => e.roomIdx === destRoomIdx);
  const pb          = window.__playerRefs?.playerBody;
  if (!pb || !destElev) return;

  const fromFloor = _currentFloor;
  _currentFloor   = floor;
  const fromElev  = _activeElev;
  fromElev.isMoving = true;
  if (_panelEl) _panelEl.style.display = 'none';

  // Close doors first, then play shaft animation
  setTimeout(() => {
    showShaftAnimation(fromFloor, floor, () => {
      // Teleport player inside destination elevator
      pb.position.x = destElev.x;
      pb.position.z = destElev.interiorZ;

      // Change atmosphere to destination room
      const destRoom = ROOMS[destRoomIdx];
      setFog(destRoom.fog, 3, destRoom.fogEnd);

      destElev.openT   = 1;
      fromElev.isMoving = false;
      _activeElev = destElev;
      updatePanelCurrentFloor(floor);
    });
  }, 420);
}

// ── Button panel DOM — rusty industrial metal plate ───────────────────────────
function buildElevPanelDOM() {
  const el = document.createElement('div');
  el.id = 'elev-panel-ui';
  el.style.cssText = [
    'display:none',
    'position:fixed','left:50%','top:50%',
    'transform:translate(-50%,-50%)',
    // Rusty iron texture via layered gradients
    'background:' + [
      'linear-gradient(180deg,rgba(60,18,4,0.55) 0%,rgba(0,0,0,0) 40%,rgba(0,0,0,0) 60%,rgba(40,12,2,0.55) 100%)',
      'linear-gradient(92deg,rgba(80,28,6,0.30) 0%,rgba(0,0,0,0) 30%,rgba(0,0,0,0) 70%,rgba(60,18,4,0.30) 100%)',
      'linear-gradient(155deg,#2e1206 0%,#1a0a04 18%,#221008 35%,#180c04 52%,#2a1108 68%,#1c0e06 82%,#241006 100%)',
    ].join(','),
    'border:4px solid #5a2808',
    'outline:2px solid #8a4010',
    'outline-offset:-8px',
    'border-radius:6px',
    'padding:14px 18px 18px',
    'box-shadow:' + [
      '0 0 0 1px #3a1804',
      '0 8px 40px rgba(0,0,0,0.95)',
      '0 0 60px rgba(120,40,0,0.25)',
      'inset 0 1px 0 rgba(180,80,20,0.18)',
      'inset 0 -1px 0 rgba(0,0,0,0.8)',
      'inset 4px 0 12px rgba(0,0,0,0.4)',
      'inset -4px 0 12px rgba(0,0,0,0.4)',
    ].join(','),
    'flex-direction:column','align-items:center','gap:10px',
    'z-index:2000',
    "font-family:'Courier New',monospace",
    'color:#cc5500',
    'max-height:92vh',
    'user-select:none',
    'min-width:540px',
  ].join(';');

  // Rivet corners (decorative)
  ['top:8px;left:8px','top:8px;right:8px','bottom:8px;left:8px','bottom:8px;right:8px'].forEach(pos => {
    const r = document.createElement('div');
    r.style.cssText = 'position:absolute;' + pos + ';width:10px;height:10px;border-radius:50%;' +
      'background:radial-gradient(circle at 35% 35%,#9a5a20,#3a1a06);' +
      'box-shadow:inset 0 1px 2px rgba(0,0,0,0.8),0 0 3px rgba(0,0,0,0.5);';
    el.style.position = 'fixed'; // ensure relative for absolute children
    el.appendChild(r);
  });
  el.style.position = 'fixed'; // re-set (rivet loop may have overridden)

  // Hazard stripe header
  const stripe = document.createElement('div');
  stripe.style.cssText = [
    'width:calc(100% + 36px)','margin:-14px -18px 0','height:28px',
    'background:repeating-linear-gradient(60deg,#ff8c00 0,#ff8c00 14px,#1a0800 14px,#1a0800 28px)',
    'border-bottom:2px solid #5a2808',
    'border-radius:3px 3px 0 0',
    'opacity:0.85',
  ].join(';');
  el.appendChild(stripe);

  // Title
  const title = document.createElement('div');
  title.style.cssText = [
    'font-size:11px','font-weight:bold','letter-spacing:5px',
    'color:#cc5500',
    'text-shadow:0 0 8px rgba(180,60,0,0.7)',
    'border-bottom:1px solid #3a1804',
    'padding-bottom:8px','width:100%','text-align:center',
    'margin-top:2px',
  ].join(';');
  title.textContent = '▲  FLOOR CONTROL SYSTEM  ▲';
  el.appendChild(title);

  // Current floor LED display
  const ledWrap = document.createElement('div');
  ledWrap.style.cssText = [
    'background:linear-gradient(180deg,#080400,#0e0600)',
    'border:2px solid #3a1804',
    'border-radius:4px','padding:6px 22px',
    'box-shadow:inset 0 2px 8px rgba(0,0,0,0.9),0 0 12px rgba(200,60,0,0.15)',
    'display:flex','align-items:center','gap:14px',
  ].join(';');

  const ledLabel = document.createElement('span');
  ledLabel.style.cssText = 'font-size:9px;letter-spacing:3px;color:#551a00;';
  ledLabel.textContent = 'FLOOR';
  ledWrap.appendChild(ledLabel);

  const indicator = document.createElement('div');
  indicator.id = 'elev-floor-num';
  indicator.style.cssText = [
    'font-size:32px','font-weight:bold',
    'color:#ff6600',
    'text-shadow:0 0 14px rgba(255,80,0,0.9),0 0 28px rgba(255,60,0,0.4)',
    'letter-spacing:8px','line-height:1','min-width:80px','text-align:center',
    'font-variant-numeric:tabular-nums',
  ].join(';');
  indicator.textContent = '01';
  ledWrap.appendChild(indicator);

  const ledLabel2 = document.createElement('span');
  ledLabel2.style.cssText = 'font-size:9px;letter-spacing:3px;color:#551a00;';
  ledLabel2.textContent = 'ACTIVE';
  ledWrap.appendChild(ledLabel2);

  el.appendChild(ledWrap);

  // Separator
  const sep = document.createElement('div');
  sep.style.cssText = 'width:100%;height:1px;background:linear-gradient(90deg,transparent,#4a2008,transparent);';
  el.appendChild(sep);

  // Floor grid label
  const gridLabel = document.createElement('div');
  gridLabel.style.cssText = 'font-size:8px;letter-spacing:4px;color:#441800;width:100%;text-align:center;';
  gridLabel.textContent = '── SELECT DESTINATION FLOOR ──';
  el.appendChild(gridLabel);

  // Button grid (10 × 10 = 100 buttons)
  const grid = document.createElement('div');
  grid.style.cssText = [
    'display:grid','grid-template-columns:repeat(10,46px)','gap:4px',
    'overflow-y:auto','max-height:52vh',
    'padding:4px 2px',
    // Custom scrollbar
    'scrollbar-width:thin','scrollbar-color:#3a1804 #0a0400',
  ].join(';');

  const btnBase = [
    'width:46px','height:46px',
    'background:linear-gradient(155deg,#1e0e06,#0e0602,#160a04)',
    'color:#883300',
    'border:1px solid #2e1206',
    'border-radius:3px',
    "font-family:'Courier New',monospace",
    'font-size:11px','font-weight:bold',
    'cursor:pointer','outline:none',
    'box-shadow:2px 2px 4px rgba(0,0,0,0.95),inset 0 1px 0 rgba(120,50,10,0.10),inset 0 -1px 0 rgba(0,0,0,0.6)',
    'transition:all 0.06s ease',
    'position:relative',
  ].join(';');

  for (let f = 1; f <= 100; f++) {
    const btn = document.createElement('button');
    btn.textContent = String(f).padStart(2, '0');
    btn.dataset.floor = f;
    btn.style.cssText = btnBase;

    btn.addEventListener('mouseenter', () => {
      if (btn.classList.contains('pressed') || btn.classList.contains('cur')) return;
      btn.style.color = '#ff8800';
      btn.style.background = 'linear-gradient(155deg,#2e1408,#1a0a04,#221008)';
      btn.style.boxShadow = '2px 2px 4px rgba(0,0,0,0.95),0 0 10px rgba(200,60,0,0.30),inset 0 1px 0 rgba(180,70,10,0.18)';
    });
    btn.addEventListener('mouseleave', () => {
      if (btn.classList.contains('pressed') || btn.classList.contains('cur')) return;
      btn.style.color = '#883300';
      btn.style.background = 'linear-gradient(155deg,#1e0e06,#0e0602,#160a04)';
      btn.style.boxShadow = '2px 2px 4px rgba(0,0,0,0.95),inset 0 1px 0 rgba(120,50,10,0.10),inset 0 -1px 0 rgba(0,0,0,0.6)';
    });
    btn.addEventListener('mousedown', () => {
      btn.classList.add('pressed');
      btn.style.transform = 'scale(0.88) translateY(2px)';
      btn.style.boxShadow = 'inset 0 3px 8px rgba(0,0,0,0.98),0 0 4px rgba(180,40,0,0.20)';
      btn.style.color = '#ff3300';
    });
    btn.addEventListener('mouseup', () => {
      setTimeout(() => {
        btn.classList.remove('pressed');
        if (!btn.classList.contains('cur')) btn.style.transform = '';
      }, 160);
    });
    btn.addEventListener('click', () => {
      const floor = parseInt(btn.dataset.floor);
      if (floor === _currentFloor) return;
      teleportToFloor(floor);
    });
    grid.appendChild(btn);
  }
  el.appendChild(grid);

  // Bottom separator
  const sep2 = document.createElement('div');
  sep2.style.cssText = 'width:100%;height:1px;background:linear-gradient(90deg,transparent,#4a2008,transparent);';
  el.appendChild(sep2);

  // Hint text
  const hint = document.createElement('div');
  hint.style.cssText = 'font-size:9px;color:#441a00;letter-spacing:3px;text-align:center;';
  hint.textContent = '≡  WALK THROUGH DOORS TO EXIT  ≡';
  el.appendChild(hint);

  // Hazard stripe footer
  const stripe2 = document.createElement('div');
  stripe2.style.cssText = [
    'width:calc(100% + 36px)','margin:0 -18px -18px','height:22px',
    'background:repeating-linear-gradient(60deg,#ff8c00 0,#ff8c00 14px,#1a0800 14px,#1a0800 28px)',
    'border-top:2px solid #5a2808',
    'border-radius:0 0 3px 3px',
    'opacity:0.85',
  ].join(';');
  el.appendChild(stripe2);

  document.body.appendChild(el);
  return el;
}

function updatePanelCurrentFloor(floor) {
  const ind = document.getElementById('elev-floor-num');
  if (ind) ind.textContent = String(floor).padStart(2, '0');
  document.querySelectorAll('#elev-panel-ui button[data-floor]').forEach(btn => {
    const f = parseInt(btn.dataset.floor);
    const isCur = f === floor;
    btn.classList.toggle('cur', isCur);
    if (isCur) {
      btn.style.color      = '#ffcc00';
      btn.style.background = 'linear-gradient(155deg,#3a1600,#220c00,#2e1200)';
      btn.style.boxShadow  = '0 0 14px rgba(255,140,0,0.55),inset 0 1px 0 rgba(255,120,0,0.22),inset 0 3px 8px rgba(0,0,0,0.7)';
      btn.style.transform  = 'translateY(2px)';
      btn.style.border     = '1px solid #6a2e00';
    } else {
      btn.style.color      = '#883300';
      btn.style.background = 'linear-gradient(155deg,#1e0e06,#0e0602,#160a04)';
      btn.style.boxShadow  = '2px 2px 4px rgba(0,0,0,0.95),inset 0 1px 0 rgba(120,50,10,0.10),inset 0 -1px 0 rgba(0,0,0,0.6)';
      btn.style.transform  = '';
      btn.style.border     = '1px solid #2e1206';
    }
  });
}
