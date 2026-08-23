// ── maps/graveyard.js  Haunted Graveyard ─────────────────────────────────────
import { scene, pbr, gnd, box, cyl, sph, cone, grp, addShadow, setFog } from '../engine.js';
import { gs, interactableObjects } from '../state.js';
import { registerWallCollider, registerMapGroup } from './index.js';

const soilMat     = pbr(0x18100a, 0.98, 0);
const stoneMat    = pbr(0x6a6a7a, 0.85, 0.05);
const darkStone   = pbr(0x44444e, 0.88, 0.05);
const treeMat     = pbr(0x281408, 0.92, 0);
const mossStone   = pbr(0x4a5a3a, 0.88, 0);
const ironMat     = pbr(0x222222, 0.6,  0.7);
const ghostMat    = pbr(0xccddff, 0.1,  0.0, { emissive: 0xaabbff, emissiveIntensity: 0.8 });
const candleMat   = pbr(0xffcc44, 0.1,  0.0, { emissive: 0xffaa22, emissiveIntensity: 1.5 });
const cryptMat    = pbr(0x383840, 0.82, 0.08);
const storeMat    = pbr(0x2a2030, 0.8,  0.1);

export function buildGraveyardMap() {
  const root = grp('graveyard');
  setFog(0x080510, 8, 90);
  gnd(220, 220, soilMat).parent = root;

  const rng = mulberry32(666);

  // Outer iron fence ring
  buildFenceRing(root, 95, rng);

  // Tombstones — lots of them
  for (let i = 0; i < 120; i++) {
    const tx = (rng() * 2 - 1) * 88;
    const tz = (rng() * 2 - 1) * 88;
    if (Math.hypot(tx, tz) < 6) continue;
    buildTombstone(root, tx, tz, rng);
  }

  // Central mausoleum
  buildMausoleum(root, 0, 0);

  // Gothic crypt buildings
  buildCrypt(root, -40, -30);
  buildCrypt(root,  40,  35);
  buildCrypt(root, -35,  40);
  buildCrypt(root,  38, -38);

  // Dead trees scattered
  for (let i = 0; i < 30; i++) {
    const tx = (rng() * 2 - 1) * 80;
    const tz = (rng() * 2 - 1) * 80;
    if (Math.hypot(tx, tz) < 8) continue;
    buildDeadTree(root, tx, tz, rng);
  }

  // Will-o-wisp orbs
  for (let i = 0; i < 20; i++) {
    const ox = (rng() * 2 - 1) * 75;
    const oz = (rng() * 2 - 1) * 75;
    const wisp = sph(0.28, ghostMat, root, 6);
    wisp.position.set(ox, 0.6 + rng() * 1.2, oz);
  }

  // Candles on some tombstones
  for (let i = 0; i < 30; i++) {
    const cx = (rng() * 2 - 1) * 80;
    const cz = (rng() * 2 - 1) * 80;
    const candle = cyl(0.06, 0.06, 0.4, candleMat, root, 5);
    candle.position.set(cx, 0.2, cz);
    const flame = sph(0.1, candleMat, root, 4);
    flame.position.set(cx, 0.45, cz);
    flame.scaling.y = 1.5;
  }

  // Broken stone walls as cover
  for (let i = 0; i < 12; i++) {
    const wx = (rng() * 2 - 1) * 75;
    const wz = (rng() * 2 - 1) * 75;
    const wl = 3 + rng() * 5;
    const wh = 1 + rng() * 1.5;
    const wall = box(wl, wh, 0.6, mossStone, root);
    wall.position.set(wx, wh/2, wz);
    wall.rotation.y = rng() * Math.PI;
    addShadow(wall);
    registerWallCollider(wx - wl/2, wx + wl/2, wz - 0.6, wz + 0.6);
  }

  buildGraveyardStore(root, -18, -60, 'Crypt Armory');
  buildGraveyardStore(root,  18,  60, "Undertaker's Cache");
  buildGraveyardStore(root, -60,  18, 'Bone Vault');

  registerMapGroup(root);
  gs.isInsideMapInterior = () => false;
}

function buildTombstone(parent, x, z, rng) {
  const style = Math.floor(rng() * 3);
  const h = 0.8 + rng() * 1.4;
  const w = 0.55 + rng() * 0.6;
  const tilt = (rng() - 0.5) * 0.25;
  const mat = rng() < 0.3 ? mossStone : stoneMat;

  if (style === 0) {
    // Rounded top
    const slab = box(w, h, 0.22, mat, parent);
    slab.position.set(x, h/2, z);
    slab.rotation.set(tilt, rng() * Math.PI * 2, 0);
    const top = sph(w * 0.52, mat, parent, 6);
    top.position.set(x, h, z);
    top.scaling.y = 0.55;
  } else if (style === 1) {
    // Cross
    const vert = box(0.22, h, 0.18, mat, parent);
    vert.position.set(x, h/2, z);
    vert.rotation.set(tilt, 0, 0);
    const horiz = box(w, 0.22, 0.18, mat, parent);
    horiz.position.set(x, h * 0.65, z);
  } else {
    // Flat slab with pointed top
    const slab = box(w, h * 0.75, 0.22, mat, parent);
    slab.position.set(x, h * 0.38, z);
    slab.rotation.set(tilt, 0, 0);
    const tip = cone(w * 0.5, h * 0.28, mat, parent, 4);
    tip.position.set(x, h * 0.87, z);
  }
}

function buildMausoleum(parent, x, z) {
  const base = box(12, 5, 12, cryptMat, parent);
  base.position.set(x, 2.5, z);
  addShadow(base);
  registerWallCollider(x-6, x+6,  z-6,   z-5.5);
  registerWallCollider(x-6, x-5.5, z-5.5, z+6);
  registerWallCollider(x+5.5, x+6, z-5.5, z+6);
  registerWallCollider(x-6, x-1,  z+5.5, z+6);
  registerWallCollider(x+1, x+6,  z+5.5, z+6);
  // Roof
  const roof = cone(8, 5, darkStone, parent, 4);
  roof.position.set(x, 7.5, z);
  roof.rotation.y = Math.PI / 4;
  // Door arch
  const doorFrame = box(2.4, 4, 0.3, darkStone, parent);
  doorFrame.position.set(x, 2, z + 6.15);
  // Columns on corners
  for (const [cx, cz] of [[-5,-5],[-5,5],[5,-5],[5,5]]) {
    cyl(0.35, 0.35, 5, stoneMat, parent, 8).position.set(x+cx, 2.5, z+cz);
  }
  // Skull-like orbs on roof corners
  for (const [cx, cz] of [[-4,-4],[-4,4],[4,-4],[4,4]]) {
    sph(0.5, ghostMat, parent, 6).position.set(x+cx, 5.3, z+cz);
  }
}

function buildCrypt(parent, x, z) {
  const walls = [
    [x-4, z, 0.5, 8], [x+4, z, 0.5, 8], [x, z+4, 8, 0.5], [x, z-4, 8, 0.5],
  ];
  walls.forEach(([wx, wz, ww, wd]) => {
    const w = box(ww, 3, wd, cryptMat, parent);
    w.position.set(wx, 1.5, wz);
    addShadow(w);
    registerWallCollider(wx - ww/2 - 0.1, wx + ww/2 + 0.1, wz - wd/2 - 0.1, wz + wd/2 + 0.1);
  });
  // Pointed roof
  const roof = cone(5.5, 3.5, darkStone, parent, 4);
  roof.position.set(x, 4.75, z);
  roof.rotation.y = Math.PI / 4;
  // Door gap in front wall — no collider there
  const door = box(1.5, 2.5, 0.6, ironMat, parent);
  door.position.set(x, 1.25, z - 4);
}

function buildDeadTree(parent, x, z, rng) {
  const h = 4 + rng() * 4;
  const trunk = cyl(0.18, 0.28, h, treeMat, parent, 5);
  trunk.position.set(x, h/2, z);
  trunk.rotation.set((rng()-0.5)*0.15, rng()*Math.PI, 0);
  addShadow(trunk);
  // Branches
  const branches = 3 + Math.floor(rng() * 4);
  for (let b = 0; b < branches; b++) {
    const angle = (b / branches) * Math.PI * 2 + rng();
    const bh = 0.8 + rng() * 1.8;
    const branch = cyl(0.06, 0.12, bh, treeMat, parent, 4);
    const hy = h * (0.5 + rng() * 0.45);
    branch.position.set(x + Math.cos(angle) * bh/2, hy, z + Math.sin(angle) * bh/2);
    branch.rotation.set(0, angle, Math.PI/2 - 0.3 - rng() * 0.5);
  }
}

function buildFenceRing(parent, radius, rng) {
  const segments = 80;
  for (let i = 0; i < segments; i++) {
    const angle = (i / segments) * Math.PI * 2;
    const nx = (i + 1) / segments * Math.PI * 2;
    const x = Math.cos(angle) * radius, z = Math.sin(angle) * radius;
    const post = box(0.18, 2.4, 0.18, ironMat, parent);
    post.position.set(x, 1.2, z);
    const rail = box(Math.hypot(Math.cos(nx)-Math.cos(angle), Math.sin(nx)-Math.sin(angle)) * radius * 1.02,
                     0.12, 0.1, ironMat, parent);
    rail.position.set((Math.cos(angle)+Math.cos(nx))*radius/2, 1.8,
                      (Math.sin(angle)+Math.sin(nx))*radius/2);
    rail.rotation.y = angle + Math.PI/2;
    // Spike on post
    const spike = cone(0.08, 0.4, ironMat, parent, 4);
    spike.position.set(x, 2.6, z);
  }
}

function buildGraveyardStore(parent, x, z, label) {
  [
    [x-5, z, 0.5, 10], [x+5, z, 0.5, 10], [x, z+5, 10, 0.5],
    [x-3, z-5, 3.5, 0.5], [x+3, z-5, 3.5, 0.5],
  ].forEach(([wx, wz, ww, wd]) => {
    box(ww, 4, wd, storeMat, parent).position.set(wx, 2, wz);
    registerWallCollider(wx - ww/2, wx + ww/2, wz - wd/2, wz + wd/2);
  });
  sph(0.5, ghostMat, parent, 6).position.set(x, 4.8, z - 5);
  const t = new BABYLON.TransformNode('t', scene);
  t.parent = parent; t.position.set(x, 1, z - 4);
  t.label = label; t.onInteract = () => window.__openArmory?.();
  interactableObjects.push(t);
}

function mulberry32(seed) {
  return function() {
    seed += 0x6D2B79F5; let t = seed;
    t = Math.imul(t ^ t >>> 15, t | 1);
    t ^= t + Math.imul(t ^ t >>> 7, t | 61);
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}
