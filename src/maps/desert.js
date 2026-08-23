// ── maps/desert.js  Desert / Canyon — real dune terrain ──────────────────────
import { scene, pbr, pbrTex, std, gnd, box, cyl, sph, hemi, cone, grp, addShadow, setFog,
         makeTerrain, getHeightAtXZ } from '../engine.js';
import { gs, interactableObjects } from '../state.js';
import { registerWallCollider, registerMapGroup } from './index.js';

const sandMat   = pbrTex('sand', 0xd8b878, 0.92, 0, { uv: 18, seed: 12 });
const rockMat   = pbr(0xb87040, 0.88, 0.02);
const rock2Mat  = pbr(0x9a6030, 0.88, 0.02);
const palmMat   = pbr(0x5a3010, 0.85, 0);
const palmLeafMat = pbr(0x2a6828, 0.7, 0);
const cactMat   = pbr(0x3a7030, 0.8, 0);
const waterMat  = pbr(0x1a6888, 0.1, 0.3, { alpha: 0.7 });

const OASIS_X = 0, OASIS_Z = -30;
const STORE_POS = [[-40, 40], [40, -50], [-50, -50]];

export function buildDesertMap() {
  const root = grp('desert');

  setFog(0xd4a853, 15, 95);

  // Real dune terrain: flat spawn bowl + flat oasis/store footprints so
  // buildings, water, and wall colliders (which stay 2D xz) sit correctly.
  const flatSpots = [
    { x: OASIS_X, z: OASIS_Z, r: 16 },
    ...STORE_POS.map(([x, z]) => ({ x, z, r: 9 })),
  ];
  makeTerrain({ size: 240, subdivisions: 100, seed: 77, amplitude: 5.5, flatRadius: 22, flatSpots }, sandMat);

  const rng = mulberry32(77);

  // A handful of larger dune accents on top of the terrain relief, for silhouette variety.
  for (let i = 0; i < 20; i++) {
    const dx = (rng() * 2 - 1) * 105;
    const dz = (rng() * 2 - 1) * 105;
    if (Math.hypot(dx, dz) < 24) continue;
    const r = 5 + rng() * 8;
    const h = 1.5 + rng() * 3;
    const baseY = getHeightAtXZ(dx, dz);
    const dune = hemi(r, sandMat, root, 10);
    dune.position.set(dx, baseY + h - r, dz);
    dune.scaling.y = h / r;
  }

  // Rock formations (collidable) — sit on the terrain surface.
  for (let i = 0; i < 28; i++) {
    let x, z;
    do {
      x = (rng() * 2 - 1) * 100;
      z = (rng() * 2 - 1) * 100;
    } while (Math.hypot(x, z + 30) < 10); // keep oasis clear

    const w = 3 + rng() * 5;
    const h = 2 + rng() * 6;
    const d = 3 + rng() * 5;
    const mat = rng() < 0.5 ? rockMat : rock2Mat;
    const baseY = getHeightAtXZ(x, z);
    const rock = box(w, h, d, mat, root);
    rock.position.set(x, baseY + h / 2, z);
    rock.rotation.y = rng() * Math.PI;
    addShadow(rock);
    registerWallCollider(x - w / 2 - 0.3, x + w / 2 + 0.3, z - d / 2 - 0.3, z + d / 2 + 0.3);

    // Smaller accent rocks
    for (let j = 0; j < 2; j++) {
      const ox = x + (rng() - 0.5) * w, oz = z + (rng() - 0.5) * d;
      const sr = box(w * 0.5, h * 0.4, d * 0.5, mat, root);
      sr.position.set(ox, getHeightAtXZ(ox, oz) + h * 0.2, oz);
    }
  }

  // Oasis (inside a flattened terrain spot, so the water plane sits level)
  const water = BABYLON.MeshBuilder.CreateGround('oasis', { width: 14, height: 10 }, scene);
  water.material = waterMat;
  water.parent = root;
  water.position.set(OASIS_X, 0.04, OASIS_Z);

  // Palm trees
  for (let i = 0; i < 8; i++) {
    const angle = (i / 8) * Math.PI * 2;
    const pr = 6 + rng() * 2;
    const px = OASIS_X + Math.cos(angle) * pr;
    const pz = OASIS_Z + Math.sin(angle) * pr;
    buildPalm(root, px, pz, rng);
  }

  // Cacti — sit on the terrain surface.
  for (let i = 0; i < 12; i++) {
    let cx, cz;
    do {
      cx = (rng() * 2 - 1) * 95;
      cz = (rng() * 2 - 1) * 95;
    } while (Math.hypot(cx - OASIS_X, cz - OASIS_Z) < 14);
    buildCactus(root, cx, cz, rng);
  }

  // Desert outpost stores (on flattened footprints)
  buildDesertStore(root, STORE_POS[0][0], STORE_POS[0][1], 'Desert Outpost');
  buildDesertStore(root, STORE_POS[1][0], STORE_POS[1][1], 'Dune Supply');
  buildDesertStore(root, STORE_POS[2][0], STORE_POS[2][1], 'Sand Cache');

  registerMapGroup(root);
  gs.isInsideMapInterior = () => false;
}

function buildPalm(parent, x, z, rng) {
  const baseY = getHeightAtXZ(x, z);
  const h = 4 + rng() * 2;
  // Curved trunk — approximate with 3 tilted cylinders
  const trunkSegs = 3;
  let py = baseY, pz = z, leanX = (rng() - 0.5) * 0.3, leanZ = (rng() - 0.5) * 0.3;
  for (let s = 0; s < trunkSegs; s++) {
    const seg = cyl(0.22, 0.25, h / trunkSegs, palmMat, parent, 8);
    seg.position.set(x, py + (h / trunkSegs) / 2, pz);
    seg.rotation.set(leanX * (s / trunkSegs), 0, leanZ * (s / trunkSegs));
    py += h / trunkSegs;
  }
  // Fronds
  for (let f = 0; f < 6; f++) {
    const angle = (f / 6) * Math.PI * 2;
    const frond = box(0.15, 0.1, 2.5, palmLeafMat, parent);
    frond.position.set(x + Math.cos(angle) * 1.2, py - 0.2, pz + Math.sin(angle) * 1.2);
    frond.rotation.set(-0.4, angle, 0.15);
  }
}

function buildCactus(parent, x, z, rng) {
  const baseY = getHeightAtXZ(x, z);
  const h = 1.5 + rng() * 1.5;
  const trunk = cyl(0.18, 0.2, h, cactMat, parent, 8);
  trunk.position.set(x, baseY + h / 2, z);
  // Arms
  const armH = rng() * 0.8 + 0.4;
  const armLen = 0.6 + rng() * 0.4;
  for (const side of [-1, 1]) {
    const arm = cyl(0.12, 0.12, armLen, cactMat, parent, 8);
    arm.rotation.z = Math.PI / 2;
    arm.position.set(x + side * armLen / 2, baseY + h * 0.55, z);
    const armUp = cyl(0.12, 0.12, armH, cactMat, parent, 8);
    armUp.position.set(x + side * armLen, baseY + h * 0.55 + armH / 2, z);
  }
}

function buildDesertStore(parent, x, z, label) {
  const baseY = getHeightAtXZ(x, z);   // flatSpots keep this ≈0, but stay robust if tuned later
  const walls = [
    { wx: x - 5, wz: z, ww: 0.5, wd: 10 },
    { wx: x + 5, wz: z, ww: 0.5, wd: 10 },
    { wx: x, wz: z + 5, ww: 10, wd: 0.5 },
    { wx: x - 3, wz: z - 5, ww: 3.5, wd: 0.5 },
    { wx: x + 3, wz: z - 5, ww: 3.5, wd: 0.5 },
  ];
  walls.forEach(w => {
    const m = box(w.ww, 3.5, w.wd, rockMat, parent);
    m.position.set(w.wx, baseY + 1.75, w.wz);
    registerWallCollider(w.wx - w.ww / 2, w.wx + w.ww / 2, w.wz - w.wd / 2, w.wz + w.wd / 2);
  });
  const trigger = new BABYLON.TransformNode('t', scene);
  trigger.parent = parent;
  trigger.position.set(x, baseY + 1, z - 4);
  trigger.label = label;
  trigger.onInteract = () => { if (window.__openArmory) window.__openArmory(); };
  interactableObjects.push(trigger);
}

function mulberry32(seed) {
  return function() {
    seed += 0x6D2B79F5;
    let t = seed;
    t = Math.imul(t ^ t >>> 15, t | 1);
    t ^= t + Math.imul(t ^ t >>> 7, t | 61);
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}
