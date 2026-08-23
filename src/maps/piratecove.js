// ── maps/piratecove.js  Pirate Cove ──────────────────────────────────────────
import { scene, pbr, gnd, box, cyl, sph, cone, grp, addShadow, setFog } from '../engine.js';
import { gs, interactableObjects } from '../state.js';
import { registerWallCollider, registerMapGroup } from './index.js';

const sandMat    = pbr(0xd4a060, 0.98, 0);
const woodMat    = pbr(0x7a4820, 0.85, 0.02);
const darkWood   = pbr(0x4a2808, 0.88, 0.02);
const oceanMat   = pbr(0x1a3a60, 0.05, 0.4);
const ropeMat    = pbr(0xaa8840, 0.9,  0);
const sailMat    = pbr(0xeedd99, 0.85, 0);
const ironMat    = pbr(0x333330, 0.5,  0.6);
const goldMat    = pbr(0xffd700, 0.15, 0.9, { emissive: 0xffcc00, emissiveIntensity: 0.5 });
const stoneMat   = pbr(0x7a7060, 0.9,  0.02);
const rockMat    = pbr(0x504840, 0.92, 0);
const palmMat    = pbr(0x6a4020, 0.85, 0);
const palmLeafMat= pbr(0x3a8a30, 0.7,  0);
const lanternMat = pbr(0xff8800, 0.1,  0, { emissive: 0xff6600, emissiveIntensity: 1.6 });
const storeMat   = pbr(0x5a3818, 0.8,  0.05);

export function buildPirateCoveMap() {
  const root = grp('piratecove');
  setFog(0x2a4a6a, 18, 110);
  gnd(240, 240, sandMat).parent = root;

  const rng = mulberry32(1717);

  // Ocean area (far end)
  const ocean = box(240, 0.15, 80, oceanMat, root);
  ocean.position.set(0, -0.04, -70);

  // Main dock extending into ocean
  buildDock(root, 0, -30, 40, 8);
  // Side docks
  buildDock(root, -30, -35, 25, 5);
  buildDock(root, 30, -35, 25, 5);

  // Ships in harbor
  buildShip(root, -15, -58);
  buildShip(root,  20, -62);

  // Lighthouse
  buildLighthouse(root, 55, -60);

  // Cliff rocks on sides
  for (let i = 0; i < 15; i++) {
    const side = rng() < 0.5 ? -1 : 1;
    const rx = side * (65 + rng() * 25);
    const rz = (rng() * 2 - 1) * 90;
    const rw = 4 + rng() * 8, rh = 3 + rng() * 9, rd = 4 + rng() * 8;
    const rock = box(rw, rh, rd, rng() < 0.5 ? rockMat : stoneMat, root);
    rock.position.set(rx, rh/2, rz);
    addShadow(rock);
    registerWallCollider(rx - rw/2, rx + rw/2, rz - rd/2, rz + rd/2);
  }

  // Cannon emplacements
  for (let i = 0; i < 8; i++) {
    const cx = (rng()*2-1)*60, cz = (rng()-0.3)*60;
    if (cz < -40) continue;
    buildCannon(root, cx, cz, rng);
  }

  // Treasure chests
  for (let i = 0; i < 12; i++) {
    const tx = (rng()*2-1)*75, tz = (rng()*2-1)*60;
    if (tz < -38) continue;
    buildChest(root, tx, tz, rng);
  }

  // Barrels (cover)
  for (let i = 0; i < 25; i++) {
    const bx = (rng()*2-1)*70, bz = (rng()*2-1)*60;
    if (bz < -40) continue;
    const barrel = cyl(0.5, 0.5, 1.2, rng()<0.5 ? woodMat : darkWood, root, 10);
    barrel.position.set(bx, 0.6, bz);
    barrel.rotation.x = rng() < 0.25 ? Math.PI/2 : 0;
    addShadow(barrel);
    if (rng() < 0.4) registerWallCollider(bx-0.6, bx+0.6, bz-0.6, bz+0.6);
  }

  // Palm trees on the beach
  for (let i = 0; i < 18; i++) {
    const px = (rng()*2-1)*90, pz = -15 + rng()*90;
    if (Math.hypot(px, pz + 30) < 18) continue;
    buildPalmTree(root, px, pz, rng);
  }

  // Rope fences along docks
  for (let i = 0; i < 6; i++) {
    const post = cyl(0.1, 0.1, 1.5, woodMat, root, 6);
    post.position.set(-20 + i*8, 0.75, -16);
    const rope = box(8, 0.06, 0.06, ropeMat, root);
    rope.position.set(-16 + i*8, 1.0, -16);
  }

  // Lanterns on posts
  for (let i = 0; i < 14; i++) {
    const lx = (rng()*2-1)*80, lz = -30 + rng()*90;
    if (lz < -42) continue;
    cyl(0.06, 0.06, 2.5, woodMat, root, 5).position.set(lx, 1.25, lz);
    box(0.3, 0.4, 0.3, lanternMat, root).position.set(lx, 2.7, lz);
  }

  // Skull-and-crossbones flags on poles
  for (let i = 0; i < 6; i++) {
    const fx = (rng()*2-1)*60, fz = -10 + rng()*60;
    cyl(0.08, 0.08, 5, woodMat, root, 5).position.set(fx, 2.5, fz);
    const flag = box(2, 1.2, 0.06, ironMat, root);
    flag.position.set(fx + 1, 5.4, fz);
  }

  buildPirateStore(root, -50,  30, 'Smuggler\'s Cache');
  buildPirateStore(root,  50,  25, 'Pirate Armory');
  buildPirateStore(root,   0,  65, 'Cove Bazaar');
  buildPirateStore(root, -45, -10, 'Dock Weapons');

  registerMapGroup(root);
  gs.isInsideMapInterior = () => false;
}

function buildDock(parent, x, z, length, width) {
  const dock = box(width, 0.5, length, woodMat, parent);
  dock.position.set(x, 0.15, z);
  addShadow(dock);
  registerWallCollider(x - width/2, x + width/2, z - length/2, z + length/2);
  // Dock planks detail
  for (let i = 0; i < Math.floor(length/1.5); i++) {
    const plank = box(width, 0.06, 0.12, darkWood, parent);
    plank.position.set(x, 0.42, z - length/2 + 0.75 + i*1.5);
  }
  // Mooring posts
  for (const side of [-1, 1]) {
    for (let i = 0; i < 3; i++) {
      const post = cyl(0.18, 0.18, 1.2, darkWood, parent, 6);
      post.position.set(x + side * (width/2 - 0.2), 0.6, z - length/3 + i * (length/3));
    }
  }
}

function buildShip(parent, x, z) {
  // Hull
  const hull = box(8, 2.5, 18, darkWood, parent);
  hull.position.set(x, 0.8, z);
  addShadow(hull);
  registerWallCollider(x-4, x+4, z-9, z+9);
  // Upper deck
  const deck = box(8, 0.5, 16, woodMat, parent);
  deck.position.set(x, 2.25, z);
  // Cabin
  const cabin = box(5, 3, 6, woodMat, parent);
  cabin.position.set(x, 4, z + 4);
  addShadow(cabin);
  // Mast
  cyl(0.22, 0.25, 14, woodMat, parent, 6).position.set(x, 9.5, z);
  cyl(0.15, 0.18, 10, woodMat, parent, 6).position.set(x, 17.5, z);
  // Sails
  const sail1 = box(6, 5, 0.08, sailMat, parent);
  sail1.position.set(x, 9, z);
  const sail2 = box(5, 4, 0.08, sailMat, parent);
  sail2.position.set(x, 16.5, z);
  // Crow's nest
  cyl(0.8, 0.8, 0.5, darkWood, parent, 8).position.set(x, 22.8, z);
  // Cannons on sides
  for (const side of [-1, 1]) {
    for (let i = 0; i < 3; i++) {
      const cannon = cyl(0.3, 0.4, 1.8, ironMat, parent, 8);
      cannon.position.set(x + side * 4.1, 2.4, z - 4 + i * 4);
      cannon.rotation.z = Math.PI/2;
    }
  }
  // Jolly Roger flag
  const flag = box(2, 1.2, 0.06, ironMat, parent);
  flag.position.set(x + 1.2, 24, z);
}

function buildLighthouse(parent, x, z) {
  const body = cyl(2.5, 3.5, 16, stoneMat, parent, 12);
  body.position.set(x, 8, z);
  addShadow(body);
  registerWallCollider(x-2.8, x+2.8, z-2.8, z+2.8);
  const top = cyl(2.8, 2.8, 2, ironMat, parent, 12);
  top.position.set(x, 17, z);
  const light = sph(1.2, pbr(0xffffff, 0, 0, { emissive: 0xffffaa, emissiveIntensity: 3 }), parent, 8);
  light.position.set(x, 19, z);
  const cap = cone(2, 2.5, ironMat, parent, 8);
  cap.position.set(x, 20.8, z);
  // Base
  const base = box(9, 2, 9, stoneMat, parent);
  base.position.set(x, 1, z);
  addShadow(base);
  registerWallCollider(x-4.5, x+4.5, z-4.5, z+4.5);
}

function buildCannon(parent, x, z, rng) {
  const base = box(1.4, 0.7, 2, woodMat, parent);
  base.position.set(x, 0.35, z);
  addShadow(base);
  registerWallCollider(x-0.8, x+0.8, z-1.1, z+1.1);
  const barrel = cyl(0.3, 0.38, 2, ironMat, parent, 8);
  barrel.position.set(x, 0.9, z - 0.2);
  barrel.rotation.x = -0.25 - rng() * 0.2;
  const ball = sph(0.28, ironMat, parent, 6);
  ball.position.set(x, 0.9, z + 0.5);
  // Cannonballs stacked
  for (let i = 0; i < 3; i++) {
    const cb = sph(0.2, ironMat, parent, 5);
    cb.position.set(x + 0.8, 0.22 + (i>1 ? 0.4 : 0), z - 0.4 + (i%2)*0.4);
  }
}

function buildChest(parent, x, z, rng) {
  const chest = box(1, 0.8, 0.7, woodMat, parent);
  chest.position.set(x, 0.4, z);
  addShadow(chest);
  const lid = box(1, 0.35, 0.7, darkWood, parent);
  lid.position.set(x, 0.95, z);
  lid.rotation.x = rng() < 0.4 ? -0.6 : 0;
  if (rng() < 0.5) {
    const gold = box(0.6, 0.3, 0.5, goldMat, parent);
    gold.position.set(x, 0.8, z);
  }
  const latch = box(0.18, 0.18, 0.06, goldMat, parent);
  latch.position.set(x, 0.72, z + 0.38);
}

function buildPalmTree(parent, x, z, rng) {
  const h = 5 + rng() * 3.5;
  const trunk = cyl(0.2, 0.3, h, palmMat, parent, 6);
  trunk.position.set(x, h/2, z);
  trunk.rotation.z = (rng()-0.5)*0.3;
  for (let f = 0; f < 7; f++) {
    const angle = (f/7)*Math.PI*2;
    const frond = box(0.12, 0.08, 3, palmLeafMat, parent);
    frond.position.set(x + Math.cos(angle)*1.3, h, z + Math.sin(angle)*1.3);
    frond.rotation.set(-0.45, angle, 0.1);
  }
}

function buildPirateStore(parent, x, z, label) {
  [
    [x-5, z, 0.5, 10], [x+5, z, 0.5, 10], [x, z+5, 10, 0.5],
    [x-3, z-5, 3.5, 0.5], [x+3, z-5, 3.5, 0.5],
  ].forEach(([wx, wz, ww, wd]) => {
    box(ww, 4, wd, storeMat, parent).position.set(wx, 2, wz);
    registerWallCollider(wx - ww/2, wx + ww/2, wz - wd/2, wz + wd/2);
  });
  box(0.3, 0.3, 0.3, goldMat, parent).position.set(x, 4.5, z - 5);
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
