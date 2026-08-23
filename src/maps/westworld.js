// ── maps/westworld.js  Wild West Town ────────────────────────────────────────
import { scene, pbr, std, gnd, box, cyl, sph, torus, grp, cloneM, addShadow, makeCanvasTex, setFog } from '../engine.js';
import { gs, interactableObjects } from '../state.js';
import { registerWallCollider, registerMapGroup } from './index.js';

const dirtMat  = pbr(0xb87840, 0.95, 0);
const roadMat  = pbr(0x8a6830, 0.9, 0);
const woodMat  = pbr(0x7a4a20, 0.82, 0.02);
const darkWoodMat = pbr(0x5a3510, 0.85, 0.02);
const stoneMatW = pbr(0x8a7060, 0.8, 0.02);
const metalMatW = pbr(0x556644, 0.5, 0.2);
const barrelMat = pbr(0x6a3018, 0.85, 0.05);

const BUILDING_NAMES = [
  'SALOON', "SHERIFF'S\nOFFICE", 'BANK', 'GENERAL\nSTORE',
  'GUNSMITH', 'HOTEL', 'BARBER', 'STABLE',
];

export function buildWestWorldMap() {
  const root = grp('westworld');

  setFog(0xc8a058, 18, 88);

  // Ground
  const g = gnd(200, 200, dirtMat);
  g.parent = root;

  // Main street
  const street = box(200, 0.06, 12, roadMat, root);
  street.position.set(0, 0.03, 0);
  // Wheel ruts
  for (const rz of [-3.5, 3.5]) {
    for (let rx = -90; rx < 90; rx += 6) {
      const rut = box(4.5, 0.03, 0.3, pbr(0x7a5820, 0.95, 0), root);
      rut.position.set(rx, 0.04, rz);
    }
  }

  const rng = mulberry32(99);

  // Buildings on alternating sides
  for (let i = 0; i < 8; i++) {
    const side = i % 2 === 0 ? 1 : -1;
    const bx = -70 + i * 18;
    const bz = side * (9 + 5);
    const name = BUILDING_NAMES[i];
    const isStore = i === 4 || i === 3; // gunsmith and general store
    buildWesternBuilding(root, bx, bz, name, isStore, rng);
  }

  // Hitching posts
  for (let x = -80; x <= 80; x += 20) {
    for (const z of [-8, 8]) {
      const post = cyl(0.06, 0.06, 1.4, woodMat, root, 8);
      post.position.set(x, 0.7, z);
      const rail = box(3.2, 0.08, 0.08, woodMat, root);
      rail.position.set(x, 1.2, z);
    }
  }

  // Barrels
  for (let i = 0; i < 20; i++) {
    const bx = -85 + rng() * 170;
    const bz = (rng() < 0.5 ? 1 : -1) * (9 + rng() * 12);
    const barrel = cyl(0.3, 0.3, 0.5, barrelMat, root, 10);
    barrel.position.set(bx, 0.25, bz);
    barrel.rotation.y = rng() * Math.PI;
  }

  // Wagons
  for (let i = 0; i < 5; i++) {
    const wx = -60 + i * 26;
    const wz = (i % 2 === 0 ? 1 : -1) * 16;
    buildWagon(root, wx, wz, rng);
  }

  // Water tower at east end
  buildWaterTower(root, 88, -15);

  // Tumbleweed scatter (visual)
  for (let i = 0; i < 12; i++) {
    const tx = (rng() * 2 - 1) * 90;
    const tz = (rng() * 2 - 1) * 80;
    if (Math.abs(tz) < 10) continue;
    const tumble = sph(0.4 + rng() * 0.3, pbr(0x9a7840, 0.9, 0), root, 6);
    tumble.position.set(tx, 0.4, tz);
  }

  registerMapGroup(root);
  gs.isInsideMapInterior = () => false;
}

function buildWesternBuilding(parent, x, z, name, isStore, rng) {
  const w = 10, d = 10, h = 4;
  const side = z > 0 ? 1 : -1;
  const frontZ = z - side * d / 2;

  // Front facade (with door gap)
  const leftW = (w - 3) / 2;
  const wLeft = box(leftW, h, 0.5, woodMat, parent);
  wLeft.position.set(x - w / 2 + leftW / 2, h / 2, frontZ);
  const wRight = box(leftW, h, 0.5, woodMat, parent);
  wRight.position.set(x + w / 2 - leftW / 2, h / 2, frontZ);
  const wTop = box(w, h * 0.35, 0.5, darkWoodMat, parent);
  wTop.position.set(x, h + h * 0.175, frontZ);
  addShadow(wTop);

  // Side and back walls
  const wSide1 = box(0.5, h, d, woodMat, parent);
  wSide1.position.set(x - w / 2, h / 2, z);
  const wSide2 = box(0.5, h, d, woodMat, parent);
  wSide2.position.set(x + w / 2, h / 2, z);
  const wBack = box(w, h, 0.5, woodMat, parent);
  wBack.position.set(x, h / 2, z + side * d / 2);

  // Flat roof + overhang
  const roof = box(w + 1, 0.3, d + 0.5, darkWoodMat, parent);
  roof.position.set(x, h + 0.15, z);
  addShadow(roof);

  // Porch overhang supports
  for (const ox of [-w / 2 + 1, w / 2 - 1]) {
    const support = cyl(0.1, 0.1, 2.5, woodMat, parent, 6);
    support.position.set(x + ox, 1.25, frontZ - side * 1.5);
  }
  const porchRoof = box(w, 0.15, 3, darkWoodMat, parent);
  porchRoof.position.set(x, h - 0.3, frontZ - side * 1.5);

  // Wall colliders
  registerWallCollider(x - w / 2 - 0.5, x - w / 2 + 0.5, z - d / 2, z + d / 2);
  registerWallCollider(x + w / 2 - 0.5, x + w / 2 + 0.5, z - d / 2, z + d / 2);
  registerWallCollider(x - w / 2, x + w / 2, z + side * d / 2 - 0.5, z + side * d / 2 + 0.5);

  // Sign
  const signTex = makeCanvasTex(256, 80, (ctx) => {
    ctx.fillStyle = '#3a1800';
    ctx.fillRect(0, 0, 256, 80);
    ctx.fillStyle = '#d4a030';
    ctx.font = 'bold 20px Arial';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const lines = name.split('\n');
    lines.forEach((line, i) => ctx.fillText(line, 128, 28 + i * 26));
  });
  const signMat = new BABYLON.StandardMaterial('wsign', scene);
  signMat.diffuseTexture = signTex;
  signMat.emissiveTexture = signTex;
  signMat.disableLighting = true;
  const sign = BABYLON.MeshBuilder.CreatePlane('wsign', { width: 3.5, height: 1.0 }, scene);
  sign.material = signMat;
  sign.parent = parent;
  sign.position.set(x, h + 0.2, frontZ + (side < 0 ? -0.3 : 0.3));

  if (isStore) {
    const trigger = new BABYLON.TransformNode('t', scene);
    trigger.parent = parent;
    trigger.position.set(x, 1, frontZ - side * 2);
    trigger.label = name.replace('\n', ' ');
    trigger.onInteract = () => { if (window.__openArmory) window.__openArmory(); };
    interactableObjects.push(trigger);
  }
}

function buildWagon(parent, x, z, rng) {
  const chassis = box(4, 0.5, 1.6, woodMat, parent);
  chassis.position.set(x, 0.9, z);
  const bed = box(3.6, 0.3, 1.4, darkWoodMat, parent);
  bed.position.set(x, 1.3, z);
  const rim = pbr(0x333333, 0.4, 0.5);
  for (const [wx, wz] of [[-1.5, -0.9], [1.5, -0.9], [-1.5, 0.9], [1.5, 0.9]]) {
    const wheel = torus(0.42, 0.08, rim, parent, 12);
    wheel.rotation.y = Math.PI / 2;
    wheel.position.set(x + wx, 0.42, z + wz);
  }
}

function buildWaterTower(parent, x, z) {
  const h = 5;
  const tank = cyl(2, 2, h, woodMat, parent, 12);
  tank.position.set(x, h * 1.5 + h, z);
  const lid = cyl(2.1, 2.1, 0.3, darkWoodMat, parent, 12);
  lid.position.set(x, h * 2 + h + 0.15, z);
  for (const [lx, lz] of [[-1.4, -1.4], [1.4, -1.4], [-1.4, 1.4], [1.4, 1.4]]) {
    const leg = cyl(0.15, 0.15, h * 1.5, darkWoodMat, parent, 6);
    leg.position.set(x + lx, h * 0.75, z + lz);
    addShadow(leg);
  }
  addShadow(tank);
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
