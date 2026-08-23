// ── maps/spacestation.js  Space Station Interior ──────────────────────────────
import { scene, pbr, std, gnd, box, cyl, sph, cone, torus, grp, addShadow } from '../engine.js';
import { gs, interactableObjects } from '../state.js';
import { registerWallCollider, registerMapGroup } from './index.js';
import { setFog } from '../engine.js';

const metalMat  = pbr(0x1a2232, 0.25, 0.7);
const metal2Mat = pbr(0x2a3444, 0.3, 0.65);
const floorMat  = pbr(0x141e2a, 0.4, 0.5);
const panelMat  = pbr(0x0d1520, 0.35, 0.6);
const glowBlueMat = pbr(0x00aaff, 0.1, 0.3, { emissive: 0x004488, emissiveIntensity: 0.6 });
const glowGreenMat = pbr(0x00ff88, 0.1, 0.2, { emissive: 0x006633, emissiveIntensity: 0.5 });
const rocketBodyMat = pbr(0xd8d8e8, 0.25, 0.55);
const rocketRedMat  = pbr(0xff2222, 0.35, 0.3);
const engineGlowMat = pbr(0xff6600, 0.1, 0.2, { emissive: 0xff4400, emissiveIntensity: 1.0 });

export function buildSpaceStationMap() {
  const root = grp('spacestation');

  setFog(0x050a14, 3, 55);

  // Floor
  const g = gnd(100, 100, floorMat);
  g.parent = root;

  // Metal grid lines on floor
  for (let i = -24; i <= 24; i += 6) {
    const hLine = box(48, 0.04, 0.12, std(0x334455, { emissive: 0x112233, emissiveIntensity: 0.3, disableLighting: false }), root);
    hLine.position.set(0, 0.02, i);
    const vLine = box(0.12, 0.04, 48, hLine.material, root);
    vLine.position.set(i, 0.02, 0);
  }

  // Outer walls (4 sides)
  const RADIUS = 48;
  const WALL_H = 7;
  const wallDefs = [
    { x: 0,       z: -RADIUS, w: RADIUS * 2, d: 1.2 },
    { x: 0,       z:  RADIUS, w: RADIUS * 2, d: 1.2 },
    { x: -RADIUS, z: 0,       w: 1.2, d: RADIUS * 2 },
    { x:  RADIUS, z: 0,       w: 1.2, d: RADIUS * 2 },
  ];
  wallDefs.forEach((wd, i) => {
    const wall = box(wd.w, WALL_H, wd.d, metalMat, root);
    wall.position.set(wd.x, WALL_H / 2, wd.z);
    addShadow(wall);
    registerWallCollider(wd.x - wd.w / 2, wd.x + wd.w / 2, wd.z - wd.d / 2, wd.z + wd.d / 2);

    // Panel strips on walls
    for (let p = 0; p < 4; p++) {
      const panel = box(i < 2 ? 8 : 0.8, 2, i < 2 ? 0.8 : 8, panelMat, root);
      const sign = i < 2 ? (p - 1.5) * 18 : 0;
      const signZ = i >= 2 ? (p - 1.5) * 18 : 0;
      panel.position.set(wd.x + (i < 2 ? sign : 0), 4, wd.z + (i >= 2 ? signZ : 0));
    }
  });

  // Equipment pods (2×4 grid)
  for (let row = -1; row <= 1; row += 2) {
    for (let col = -2; col <= 2; col++) {
      if (col === 0) continue;
      const px = col * 15;
      const pz = row * 20;
      buildEquipmentPod(root, px, pz, row, col);
    }
  }

  // Central command platform
  const platform = cyl(6, 6, 0.4, metal2Mat, root, 16);
  platform.position.set(0, 0.2, 0);
  addShadow(platform);
  const console1 = box(8, 1.2, 1.2, panelMat, root);
  console1.position.set(0, 0.8, 2);
  const console2 = console1.clone('con2'); console2.parent = root;
  console2.position.set(0, 0.8, -2);
  const console3 = box(1.2, 1.2, 8, panelMat, root);
  console3.position.set(2.8, 0.8, 0);

  // Glowing status lights on consoles
  for (let i = 0; i < 5; i++) {
    const light = sph(0.1, i % 2 === 0 ? glowBlueMat : glowGreenMat, root, 4);
    light.position.set(-3.2 + i * 1.6, 1.6, 2);
  }

  // ── Rocket on east wall ────────────────────────────────────────────────────
  buildSpaceRocket(root);

  // Armory store
  buildSpaceStore(root, -38, 0, 'Weapons Bay');

  registerMapGroup(root);
  gs.isInsideMapInterior = (x, z) => x > -8 && x < 8 && z > -8 && z < 8;
}

function buildEquipmentPod(parent, x, z, row, col) {
  const POD_W = 8, POD_D = 8, POD_H = 4;
  const sideSign = col > 0 ? 1 : -1;
  const backZ = z + (row > 0 ? POD_D / 2 : -POD_D / 2);
  const frontZ = z - (row > 0 ? POD_D / 2 : -POD_D / 2);

  // Walls with door gap on one side
  const walls = [
    { wx: x, wz: backZ, w: POD_W, d: 0.5 },
    { wx: x - sideSign * POD_W / 2, wz: z, w: 0.5, d: POD_D },
    { wx: x + sideSign * POD_W / 2, wz: z, w: 0.5, d: POD_D },
    { wx: x - 1.5 * sideSign, wz: frontZ, w: POD_W / 2 - 1, d: 0.5 },
    { wx: x + 2.5 * sideSign, wz: frontZ, w: POD_W / 2 - 2, d: 0.5 },
  ];
  walls.forEach(w => {
    const seg = box(w.w, POD_H, w.d, metal2Mat, parent);
    seg.position.set(w.wx, POD_H / 2, w.wz);
    registerWallCollider(w.wx - w.w / 2, w.wx + w.w / 2, w.wz - w.d / 2, w.wz + w.d / 2);
  });

  // Ceiling
  const ceil = box(POD_W, 0.2, POD_D, panelMat, parent);
  ceil.position.set(x, POD_H + 0.1, z);

  // Interior glow strip
  const strip = box(POD_W - 1, 0.1, 0.2, glowBlueMat, parent);
  strip.position.set(x, POD_H - 0.05, z);
}

function buildSpaceRocket(parent) {
  const rx = 38, rz = 0;

  // Launch pad
  const pad = cyl(6, 6, 0.4, pbr(0x222233, 0.4, 0.4), parent, 12);
  pad.position.set(rx, 0.2, rz);
  addShadow(pad);

  // Rocket body
  const body = cyl(2.2, 2.2, 16, rocketBodyMat, parent, 16);
  body.position.set(rx, 8.4, rz);
  addShadow(body);

  // Red stripe
  const stripe = cyl(2.25, 2.25, 1.5, rocketRedMat, parent, 16);
  stripe.position.set(rx, 10, rz);

  // Nose cone
  const nose = cone(2.2, 5, rocketBodyMat, parent, 16);
  nose.position.set(rx, 18.9, rz);
  addShadow(nose);

  // Fins (3)
  for (let i = 0; i < 3; i++) {
    const angle = (i / 3) * Math.PI * 2;
    const fin = box(0.2, 3, 2.5, rocketBodyMat, parent);
    fin.position.set(rx + Math.cos(angle) * 2.6, 1.5, rz + Math.sin(angle) * 2.6);
    fin.rotation.y = -angle;
    addShadow(fin);
  }

  // Engine glow
  const glow = sph(1.4, engineGlowMat, parent, 8);
  glow.position.set(rx, 0.5, rz);

  registerWallCollider(rx - 2.7, rx + 2.7, rz - 2.7, rz + 2.7);
}

function buildSpaceStore(parent, x, z, label) {
  const trigger = new BABYLON.TransformNode('t', scene);
  trigger.parent = parent;
  trigger.position.set(x, 1, z);
  trigger.label = label;
  trigger.onInteract = () => { if (window.__openArmory) window.__openArmory(); };
  interactableObjects.push(trigger);
}
