// ── maps/metro.js  New York City — Central Park & Manhattan ──────────────────
import { scene, pbr, pbrTex, std, gnd, box, cyl, sph, grp, addShadow, makeCanvasTex, c3 } from '../engine.js';
import { gs, player, interactableObjects } from '../state.js';
import { registerWallCollider, registerMapGroup, loadProp, instantiateProp } from './index.js';

// ── Materials ─────────────────────────────────────────────────────────────────
const asphaltMat    = pbrTex('asphalt', 0x1c1c20, 0.92, 0, { uv: 20, seed: 3 });
const roadMat       = pbr(0x2a2a30, 0.88, 0);
const sidewalkMat   = pbrTex('concrete', 0x9a9490, 0.82, 0, { uv: 14, seed: 4 });
const parkGrassMat  = pbr(0x2f7a14, 0.88, 0);
const waterMat      = pbr(0x0e2038, 0.05, 0.2, { emissive: 0x081428, emissiveIntensity: 0.18 });
const sandMat       = pbr(0xc8a855, 0.90, 0);
const stoneMat      = pbr(0x7a7264, 0.82, 0.02);
const treeMats      = [
  pbr(0x1d5510, 0.92, 0),
  pbr(0x286218, 0.90, 0),
  pbr(0x1a4c0c, 0.92, 0),
  pbr(0x2e7020, 0.88, 0),
];
const trunkMat      = pbr(0x3a2010, 0.90, 0.02);
const brickMat      = pbrTex('brick', 0x8c3820, 0.84, 0.02, { uv: 3, seed: 5 });
const brick2Mat     = pbrTex('brick', 0xa04428, 0.82, 0.02, { uv: 3, seed: 6 });
const brownstoneMat = pbrTex('concrete', 0x7a4a34, 0.82, 0.02, { uv: 5, seed: 7 });
const concreteMat   = pbrTex('concrete', 0x6a6860, 0.80, 0.02, { uv: 6, seed: 8 });
// Lit window-grid: dark glass with a scatter of warm-lit windows (feeds the
// GlowLayer, giving towers a "dusk skyline" look at no extra lighting cost).
const windowTex = makeCanvasTex(256, 512, (ctx) => {
  ctx.fillStyle = '#0a1420'; ctx.fillRect(0, 0, 256, 512);
  const cols = 8, rows = 16, cw = 256 / cols, rh = 512 / rows;
  let seed = 91;
  const rng = () => { seed = (seed * 16807) % 2147483647; return (seed & 0xfffffff) / 0xfffffff; };
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
    const lit = rng() < 0.4;
    ctx.fillStyle = lit ? `rgba(255,${200 + rng() * 40 | 0},${120 + rng() * 60 | 0},0.9)` : 'rgba(20,30,45,0.5)';
    ctx.fillRect(c * cw + 2, r * rh + 2, cw - 4, rh - 4);
  }
});
windowTex.uScale = 1; windowTex.vScale = 1;
const glass1Mat     = pbr(0x3a5a80, 0.08, 0.68, { emissive: 0xffffff, emissiveIntensity: 1.0 });
glass1Mat.emissiveTexture = windowTex;
glass1Mat.albedoTexture = windowTex;
const glass2Mat     = pbr(0x4a607a, 0.10, 0.62);
const lampMat       = pbr(0x888888, 0.30, 0.60);
const carBodyMat    = pbr(0x223344, 0.40, 0.50);
const carRedMat     = pbr(0x992222, 0.40, 0.40);

// ── Zone constants ─────────────────────────────────────────────────────────────
const PARK_X1 = -24, PARK_X2 = 24;
const PARK_Z_S = -42, PARK_Z_N = -112;
const PARK_CZ  = (PARK_Z_S + PARK_Z_N) / 2;    // -77
const PARK_W   = PARK_X2 - PARK_X1;             // 48
const PARK_D   = Math.abs(PARK_Z_N - PARK_Z_S); // 70
// Reservoir: east side of park
const RESV_X1 = 2,  RESV_X2 = 22;
const RESV_Z_S = -62, RESV_Z_N = -102;
const RESV_CX  = (RESV_X1 + RESV_X2) / 2;  // 12
const RESV_CZ  = (RESV_Z_S + RESV_Z_N) / 2; // -82
const RESV_W   = RESV_X2 - RESV_X1;         // 20
const RESV_D   = Math.abs(RESV_Z_N - RESV_Z_S); // 40

// ── Seeded RNG ────────────────────────────────────────────────────────────────
function mulberry32(seed) {
  return function() {
    seed += 0x6D2B79F5;
    let t = seed;
    t = Math.imul(t ^ t >>> 15, t | 1);
    t ^= t + Math.imul(t ^ t >>> 7, t | 61);
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}

// ── Tree ──────────────────────────────────────────────────────────────────────
function buildTree(parent, x, z, scale, rng) {
  const h   = (1.8 + rng() * 2.0) * scale;
  const r   = (0.9 + rng() * 1.0) * scale;
  const mat = treeMats[Math.floor(rng() * treeMats.length)];
  const trunk = cyl(0.13 * scale, 0.18 * scale, h, trunkMat, parent, 6);
  trunk.position.set(x, h / 2, z);
  const c1 = sph(r, mat, parent, 7);
  c1.position.set(x, h + r * 0.55, z);
  addShadow(c1);
  const r2 = r * (0.5 + rng() * 0.3);
  const c2 = sph(r2, mat, parent, 6);
  c2.position.set(x + (rng() - 0.5) * r, h + r * 0.2, z + (rng() - 0.5) * r);
}

// ── Building material picker ──────────────────────────────────────────────────
function pickBldgMat(h, rng) {
  if (h > 16) return rng() < 0.55 ? glass1Mat : glass2Mat;
  const r = rng();
  if (r < 0.32) return brickMat;
  if (r < 0.60) return brick2Mat;
  if (r < 0.78) return brownstoneMat;
  return concreteMat;
}

// ── Real KayKit city props (async, decor-only) ────────────────────────────────
async function spawnCityProps(root) {
  const specs = [
    { path: 'assets/models/props/city/building_A.gltf', pos: [135, 0, 60],  targetH: 22 },
    { path: 'assets/models/props/city/building_D.gltf', pos: [-135, 0, 60], targetH: 20 },
    { path: 'assets/models/props/city/building_F.gltf', pos: [135, 0, -60], targetH: 24 },
    { path: 'assets/models/props/city/car_police.gltf', pos: [6, 0, 100],   targetH: 1.6 },
    { path: 'assets/models/props/city/car_taxi.gltf',   pos: [-6, 0, 100],  targetH: 1.6 },
  ];
  // Start every fetch up front, then place them in spec order as they land.
  // Awaiting inside the loop made each prop wait a full round trip for the
  // one before it — unnoticeable on localhost, but over the wire it is why
  // the map visibly trickled in instead of appearing built. loadProp caches
  // its promise and resolves null on failure, so this stays safe to fan out.
  const pending = specs.map(spec => loadProp(spec.path));
  for (let i = 0; i < specs.length; i++) {
    const spec = specs[i];
    try {
      const container = await pending[i];
      if (gs.mapId !== 'metro' || root.isDisposed()) continue;
      if (!container) { console.warn('[metro] no container for', spec.path); continue; }
      const node = instantiateProp(container);
      if (!node) { console.warn('[metro] instantiateProp returned null for', spec.path); continue; }
      node.parent = root;
      const bv = node.getHierarchyBoundingVectors(true);
      const h = bv.max.y - bv.min.y;
      const scaleFactor = h > 0.01 ? spec.targetH / h : 1;
      node.scaling.setAll(scaleFactor);
      node.position.set(spec.pos[0], -bv.min.y * scaleFactor, spec.pos[2]);
      node.getChildMeshes(false).forEach(m => { m.receiveShadows = true; addShadow(m); });
    } catch (e) {
      console.warn('[metro] city prop failed:', spec.path, e && e.message);
    }
  }
}

// ── City block ────────────────────────────────────────────────────────────────
function buildCityBlock(parent, cx, cz, bw, bd, rng) {
  if (rng() < 0.35 && bw >= 15) {
    for (const side of [-1, 1]) {
      const w = (bw / 2) * (0.72 + rng() * 0.22);
      const h = 4 + Math.pow(rng(), 1.6) * 24;
      const d = bd * (0.76 + rng() * 0.20);
      const mat = pickBldgMat(h, rng);
      const ox = cx + side * bw * 0.22;
      const b = box(w, h, d, mat, parent);
      b.position.set(ox, h / 2, cz);
      addShadow(b);
      registerWallCollider(ox - w / 2, ox + w / 2, cz - d / 2, cz + d / 2);
    }
  } else {
    const w = bw * (0.76 + rng() * 0.20);
    const h = 4 + Math.pow(rng(), 1.6) * 24;
    const d = bd * (0.76 + rng() * 0.20);
    const mat = pickBldgMat(h, rng);
    const b = box(w, h, d, mat, parent);
    b.position.set(cx, h / 2, cz);
    addShadow(b);
    registerWallCollider(cx - w / 2, cx + w / 2, cz - d / 2, cz + d / 2);
  }
}

// ── Road band ─────────────────────────────────────────────────────────────────
function buildRoadBand(parent, rz) {
  const road = box(300, 0.05, 12, roadMat, parent);
  road.position.set(0, 0.02, rz);
  for (let x = -140; x < 140; x += 10) {
    const dash = box(5, 0.06, 0.2, std(0xffffff, { disableLighting: true }), parent);
    dash.position.set(x, 0.03, rz);
  }
  const sw1 = box(300, 0.10, 2.5, sidewalkMat, parent);
  sw1.position.set(0, 0.04, rz + 7);
  const sw2 = box(300, 0.10, 2.5, sidewalkMat, parent);
  sw2.position.set(0, 0.04, rz - 7);
}

// ── Main map builder ──────────────────────────────────────────────────────────
export function buildMetroMap() {
  const root = grp('metro');
  const rng  = mulberry32(42);

  // Dark asphalt base
  const g = gnd(300, 300, asphaltMat);
  g.parent = root;

  // City road bands south of park
  [0, 26, 52, -28].forEach(rz => buildRoadBand(root, rz));

  // ── Central Park grass overlay ───────────────────────────────────────────────
  const parkFloor = box(PARK_W, 0.10, PARK_D, parkGrassMat, root);
  parkFloor.position.set(0, 0.05, PARK_CZ);

  // Low stone curbs around park perimeter
  [
    [0,       PARK_Z_S, PARK_W, 0.5],
    [0,       PARK_Z_N, PARK_W, 0.5],
    [PARK_X1, PARK_CZ,  0.5, PARK_D],
    [PARK_X2, PARK_CZ,  0.5, PARK_D],
  ].forEach(([px, pz, pw, pd]) => {
    const curb = box(pw, 0.30, pd, stoneMat, root);
    curb.position.set(px, 0.25, pz);
  });

  // ── Reservoir (east side of park, oval shape) ────────────────────────────────
  const reservoir = cyl(RESV_W / 2, RESV_W / 2, 0.22, waterMat, root, 32);
  reservoir.scaling.z = RESV_D / RESV_W;  // 40/20 = 2.0 → oval
  reservoir.position.set(RESV_CX, 0.14, RESV_CZ);

  const resvRim = cyl(RESV_W / 2 + 0.9, RESV_W / 2 + 0.9, 0.16, stoneMat, root, 32);
  resvRim.scaling.z = RESV_D / RESV_W;
  resvRim.position.set(RESV_CX, 0.11, RESV_CZ);

  registerWallCollider(RESV_X1, RESV_X2, RESV_Z_N, RESV_Z_S);

  // ── Baseball diamonds (SW quadrant) ──────────────────────────────────────────
  [[-17, -55], [-7, -59], [-17, -68], [-7, -72], [-17, -81], [-7, -84]]
    .forEach(([dx, dz]) => {
      const infield = cyl(4.2, 4.2, 0.12, sandMat, root, 14);
      infield.scaling.z = 1.18;
      infield.position.set(dx, 0.08, dz);
      const diamond = box(4.6, 0.14, 4.6, sandMat, root);
      diamond.rotation.y = Math.PI / 4;
      diamond.position.set(dx, 0.09, dz);
    });

  // ── Park trees (dense canopy grid) ───────────────────────────────────────────
  for (let tx = PARK_X1 + 3; tx <= PARK_X2 - 3; tx += 4) {
    for (let tz = PARK_Z_S - 3; tz >= PARK_Z_N + 3; tz -= 4) {
      const inRes    = tx >= RESV_X1 - 1 && tx <= RESV_X2 + 1 &&
                       tz <= RESV_Z_S + 1 && tz >= RESV_Z_N - 1;
      const inBase   = tx >= -22 && tx <= -2 && tz <= -44 && tz >= -88;
      const atChurch = Math.abs(tx) < 10 && tz > -57 && tz < -35;
      if (inRes || inBase || atChurch) continue;
      if (rng() < 0.70) {
        buildTree(root, tx + (rng() - 0.5) * 3, tz + (rng() - 0.5) * 3,
          0.65 + rng() * 0.75, rng);
      }
    }
  }

  // Dense tree ring around reservoir shoreline
  for (let i = 0; i < 40; i++) {
    const angle = (i / 40) * Math.PI * 2;
    const rx = RESV_CX + Math.cos(angle) * (RESV_W / 2 + 2.0 + rng() * 2.5);
    const rz = RESV_CZ + Math.sin(angle) * (RESV_D / 2 + 2.0 + rng() * 2.5);
    if (rx > PARK_X1 + 1 && rx < PARK_X2 - 1) {
      buildTree(root, rx, rz, 0.8 + rng() * 0.6, rng);
    }
  }

  // ── Manhattan city grid: block=18, street=6, step=24 ─────────────────────────
  const BLOCK = 18, STEP = 24;

  // Central Park West (west side, leaving ~16-unit avenue gap to park)
  for (let gx = -132; gx <= -60; gx += STEP) {
    for (let gz = -108; gz < 108; gz += STEP) {
      buildCityBlock(root, gx + BLOCK / 2, gz + BLOCK / 2, BLOCK, BLOCK, rng);
    }
  }

  // 5th Avenue (east side, leaving ~6-unit gap to park)
  for (let gx = 30; gx < 126; gx += STEP) {
    for (let gz = -108; gz < 108; gz += STEP) {
      buildCityBlock(root, gx + BLOCK / 2, gz + BLOCK / 2, BLOCK, BLOCK, rng);
    }
  }

  // City south (between player start and park)
  for (let gx = -24; gx < 24; gx += STEP) {
    for (let gz = 8; gz < 128; gz += STEP) {
      buildCityBlock(root, gx + BLOCK / 2, gz + BLOCK / 2, BLOCK, BLOCK, rng);
    }
  }

  // North strip above park
  for (let gx = -132; gx < 132; gx += STEP) {
    buildCityBlock(root, gx + BLOCK / 2, -121, BLOCK, 14, rng);
  }

  // ── Street lamps ──────────────────────────────────────────────────────────────
  for (let lx = -120; lx <= 120; lx += 28) {
    for (const lz of [0, 26, 52, -28]) {
      const post = cyl(0.08, 0.08, 5, lampMat, root, 8);
      post.position.set(lx, 2.5, lz + 8);
      const bulb = sph(0.18, std(0xffeecc, { emissive: 0xffeecc,
        emissiveIntensity: 0.8, disableLighting: true }), root);
      bulb.position.set(lx, 5.4, lz + 8);
      addShadow(post);
    }
  }

  // Park lantern posts (south promenade)
  for (let lx = -20; lx <= 20; lx += 10) {
    const pp = cyl(0.06, 0.06, 4.2, lampMat, root, 6);
    pp.position.set(lx, 2.1, -44);
    const pb = sph(0.15, std(0xfff0dd, { emissive: 0xfff0dd,
      emissiveIntensity: 0.7, disableLighting: true }), root);
    pb.position.set(lx, 4.4, -44);
  }

  // ── Parked cars ───────────────────────────────────────────────────────────────
  let ci = 0;
  [[-100,8],[-74,8],[-48,8],[-22,8],[22,8],[48,8],[74,8],[100,8],
   [-88,34],[-62,34],[62,34],[88,34]]
    .forEach(([cx, cz]) => {
      spawnCar(root, cx, cz, (ci++ % 3 === 0) ? carRedMat : carBodyMat);
    });

  // ── City sidewalk trees ───────────────────────────────────────────────────────
  for (let stx = -110; stx <= 110; stx += 12) {
    for (const stz of [9, 35, -36]) {
      if (rng() < 0.50) {
        buildTree(root, stx + (rng() - 0.5) * 2, stz, 0.45 + rng() * 0.30, rng);
      }
    }
  }

  // ── Church (park entrance chapel) ────────────────────────────────────────────
  buildChurch(root);

  // ── Stores ────────────────────────────────────────────────────────────────────
  buildMetroStore(root, -50,  9, 'Armory Shop');
  buildMetroStore(root,  50,  9, 'Weapons Cache');
  buildMetroStore(root,  -3, 57, 'Supply Drop');

  // ── Real KayKit city props (async decor — safe no-op if the player leaves
  // the map before these finish loading) ────────────────────────────────────
  spawnCityProps(root);

  registerMapGroup(root);
  gs.isInsideMapInterior = (x, z) => x > -9 && x < 9 && z > -56 && z < -36;
}

// ── Car ───────────────────────────────────────────────────────────────────────
function spawnCar(parent, x, z, mat) {
  const body = box(2.4, 1.0, 4.8, mat, parent);
  body.position.set(x, 0.5, z);
  const roof = box(1.6, 0.8, 2.4, mat, parent);
  roof.position.set(x, 1.3, z);
  const wheelMat = pbr(0x111111, 0.9, 0);
  for (const [wx, wz] of [[-1.3, -1.6], [1.3, -1.6], [-1.3, 1.6], [1.3, 1.6]]) {
    const w = cyl(0.36, 0.36, 0.25, wheelMat, parent, 12);
    w.rotation.z = Math.PI / 2;
    w.position.set(x + wx, 0.36, z + wz);
  }
  addShadow(body);
}

// ── Church ────────────────────────────────────────────────────────────────────
function buildChurch(parent) {
  const x = 0, z = -46;
  const wallMat = pbr(0xc8b89a, 0.7, 0.02);
  const roofMat2 = pbr(0x884444, 0.6, 0.02);

  const walls = [
    { wx: x - 8,  wz: z,      ww: 0.5, wd: 20 },
    { wx: x + 8,  wz: z,      ww: 0.5, wd: 20 },
    { wx: x,      wz: z - 10, ww: 16,  wd: 0.5 },
    { wx: x - 4,  wz: z + 10, ww: 5.5, wd: 0.5 },
    { wx: x + 4,  wz: z + 10, ww: 5.5, wd: 0.5 },
  ];
  walls.forEach(w => {
    const m = box(w.ww, 4, w.wd, wallMat, parent);
    m.position.set(w.wx, 2, w.wz);
    addShadow(m);
    registerWallCollider(w.wx - w.ww / 2, w.wx + w.ww / 2, w.wz - w.wd / 2, w.wz + w.wd / 2);
  });

  const roof = box(16, 0.4, 20, roofMat2, parent);
  roof.position.set(x, 4.2, z);

  const tower = cyl(0.8, 0.8, 6, wallMat, parent, 8);
  tower.position.set(x, 3, z - 9.5);
  const cross1 = box(1.8, 0.2, 0.2, pbr(0x888888, 0.4, 0.3), parent);
  cross1.position.set(x, 6.5, z - 9.5);
  const cross2 = box(0.2, 1.2, 0.2, pbr(0x888888, 0.4, 0.3), parent);
  cross2.position.set(x, 6.5, z - 9.5);
  addShadow(tower);

  registerWallCollider(x - 8, x + 8, z - 10.5, z - 9.8);
  registerWallCollider(x - 8.5, x - 7.8, z - 10, z + 10);
  registerWallCollider(x + 7.8, x + 8.5, z - 10, z + 10);
}

// ── Store ─────────────────────────────────────────────────────────────────────
function buildMetroStore(parent, x, z, label) {
  const wallMat = pbr(0x664422, 0.7, 0.02);
  const walls = [
    { wx: x - 5,   wz: z,     ww: 0.5, wd: 10 },
    { wx: x + 5,   wz: z,     ww: 0.5, wd: 10 },
    { wx: x,       wz: z + 5, ww: 10,  wd: 0.5 },
    { wx: x - 2.5, wz: z - 5, ww: 4,   wd: 0.5 },
    { wx: x + 2.5, wz: z - 5, ww: 4,   wd: 0.5 },
  ];
  walls.forEach(w => {
    const m = box(w.ww, 3.5, w.wd, wallMat, parent);
    m.position.set(w.wx, 1.75, w.wz);
    registerWallCollider(w.wx - w.ww / 2, w.wx + w.ww / 2, w.wz - w.wd / 2, w.wz + w.wd / 2);
  });
  const roof = box(10, 0.3, 10, pbr(0x443322, 0.8, 0), parent);
  roof.position.set(x, 3.65, z);

  const signTex = makeCanvasTex(256, 64, (ctx) => {
    ctx.fillStyle = '#222';
    ctx.fillRect(0, 0, 256, 64);
    ctx.fillStyle = '#ffd700';
    ctx.font = 'bold 22px Arial';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(label, 128, 32);
  });
  const signMat = new BABYLON.StandardMaterial('sign', scene);
  signMat.diffuseTexture = signTex;
  signMat.emissiveTexture = signTex;
  signMat.disableLighting = true;
  const sign = BABYLON.MeshBuilder.CreatePlane('sign', { width: 3, height: 0.7 }, scene);
  sign.material = signMat;
  sign.parent = parent;
  sign.position.set(x, 4.0, z - 5.3);
  sign.renderingGroupId = 1;

  const trigger = new BABYLON.TransformNode('trigger', scene);
  trigger.parent = parent;
  trigger.position.set(x, 1, z - 4);
  trigger.label = label;
  trigger.onInteract = () => { if (window.__openArmory) window.__openArmory(); };
  interactableObjects.push(trigger);
}

// ── Divine healing event (called by main.js on metro level start) ─────────────
let _healOrb = null;

export function startDivineHealingEvent() {
  if (_healOrb && !_healOrb.isDisposed()) _healOrb.dispose();
  const orbMat = new BABYLON.PBRMaterial('horb', scene);
  orbMat.albedoColor = new BABYLON.Color3(1, 0.9, 0.4);
  orbMat.emissiveColor = new BABYLON.Color3(0.9, 0.8, 0.2);
  orbMat.roughness = 0.1; orbMat.metallic = 0.5;
  _healOrb = BABYLON.MeshBuilder.CreateSphere('healorb', { diameter: 0.7, segments: 8 }, scene);
  _healOrb.material = orbMat;
  _healOrb.position.set(0, 2, -46);
  _healOrb._bobT = 0;
  _healOrb._healed = false;

  const obs = scene.onBeforeRenderObservable.add(() => {
    if (!_healOrb || _healOrb.isDisposed()) { scene.onBeforeRenderObservable.remove(obs); return; }
    const dt = scene.getEngine().getDeltaTime() / 1000;
    _healOrb._bobT = (_healOrb._bobT || 0) + dt;
    _healOrb.position.y = 2 + Math.sin(_healOrb._bobT * 2) * 0.3;
    _healOrb.rotation.y += dt;

    const { playerBody } = /** @type {any} */(window.__playerRefs || {});
    if (!playerBody) return;
    const d = BABYLON.Vector3.Distance(_healOrb.position, playerBody.position);
    if (d < 2.5 && !_healOrb._healed) {
      _healOrb._healed = true;
      player.health = Math.min(player.maxHealth, player.health + 25);
      import('../effects.js').then(m => m.spawnFloatingText('+25 HOLY HEAL', _healOrb.position, 0xffd700));
      import('../audio.js').then(m => m.playHealChime());
      setTimeout(() => { if (_healOrb && !_healOrb.isDisposed()) _healOrb.dispose(); }, 300);
    }
  });
}
