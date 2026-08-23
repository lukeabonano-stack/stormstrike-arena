// ── maps/mansion.js  Marble Mansion ──────────────────────────────────────────
import { scene, pbr, gnd, box, cyl, sph, torus, grp, addShadow, makeCanvasTex } from '../engine.js';
import { gs, interactableObjects } from '../state.js';
import { registerWallCollider, registerMapGroup } from './index.js';

const marbleMat   = pbr(0xf0ece0, 0.2, 0.08);
const marble2Mat  = pbr(0xe0d8c8, 0.25, 0.06);
const darkWoodMat = pbr(0x4a2810, 0.8, 0.05);
const goldMat     = pbr(0xffd700, 0.08, 0.95, { emissive: 0xaa8800, emissiveIntensity: 0.15 });
const ceilingMat  = pbr(0xf8f4ee, 0.3, 0.04);
const hedgeMat    = pbr(0x1e5018, 0.9, 0);
const sofaMat     = pbr(0x6a4830, 0.7, 0.02);
const tableClothMat = pbr(0xffffff, 0.6, 0);

export function buildMansionMap() {
  const root = grp('mansion');

  // Ground — marble
  const g = gnd(160, 160, marbleMat);
  g.parent = root;

  // ── Outer hedge border ────────────────────────────────────────────────────
  const HEDGE_H = 3.5;
  [
    { x: 0,   z: -37, w: 72, d: 1.2 },
    { x: 0,   z:  37, w: 72, d: 1.2 },
    { x: -37, z: 0,   w: 1.2, d: 72 },
    { x:  37, z: 0,   w: 1.2, d: 72 },
  ].forEach(h => {
    const hedge = box(h.w, HEDGE_H, h.d, hedgeMat, root);
    hedge.position.set(h.x, HEDGE_H / 2, h.z);
    addShadow(hedge);
    registerWallCollider(h.x - h.w / 2, h.x + h.w / 2, h.z - h.d / 2, h.z + h.d / 2);
  });

  // ── Room grid (3×3, each room 16×16, centered at origin) ─────────────────
  gs.isInsideMapInterior = (x, z) => x > -30 && x < 30 && z > -30 && z < 30;

  const ROOM_SIZE = 18;
  const WALL_T = 1;
  const ROOM_H = 4;

  for (let row = -1; row <= 1; row++) {
    for (let col = -1; col <= 1; col++) {
      const rx = col * ROOM_SIZE;
      const rz = row * ROOM_SIZE;
      buildRoom(root, rx, rz, ROOM_SIZE, ROOM_H, WALL_T, row, col);
    }
  }

  // Grand staircase (center room, rising from z=-2 to z=2)
  for (let s = 0; s < 6; s++) {
    const step = box(4, 0.3, 0.8, marbleMat, root);
    step.position.set(0, s * 0.3 + 0.15, -2 + s * 0.8);
    addShadow(step);
  }

  // Chandeliers in each room
  for (let row = -1; row <= 1; row++) {
    for (let col = -1; col <= 1; col++) {
      const rx = col * ROOM_SIZE;
      const rz = row * ROOM_SIZE;
      buildChandelier(root, rx, rz, ROOM_H);
    }
  }

  // Gallery stores in SE and SW rooms
  buildMansionStore(root, -ROOM_SIZE, ROOM_SIZE, 'Gallery West');
  buildMansionStore(root,  ROOM_SIZE, ROOM_SIZE, 'Gallery East');

  registerMapGroup(root);
}

function buildRoom(parent, cx, cz, size, h, wt, row, col) {
  const half = size / 2;
  const gapW = 3.5; // door opening width

  // Segments for each wall (with door gaps in the middle)
  const wallDefs = [
    // North wall (z = cz - half)
    { x1: cx - half, x2: cx - gapW / 2, z1: cz - half - wt / 2, z2: cz - half + wt / 2, dir: 'ns' },
    { x1: cx + gapW / 2, x2: cx + half, z1: cz - half - wt / 2, z2: cz - half + wt / 2, dir: 'ns' },
    // South wall (z = cz + half)
    { x1: cx - half, x2: cx - gapW / 2, z1: cz + half - wt / 2, z2: cz + half + wt / 2, dir: 'ns' },
    { x1: cx + gapW / 2, x2: cx + half, z1: cz + half - wt / 2, z2: cz + half + wt / 2, dir: 'ns' },
    // West wall (x = cx - half)
    { x1: cx - half - wt / 2, x2: cx - half + wt / 2, z1: cz - half, z2: cz - gapW / 2, dir: 'ew' },
    { x1: cx - half - wt / 2, x2: cx - half + wt / 2, z1: cz + gapW / 2, z2: cz + half, dir: 'ew' },
    // East wall (x = cx + half)
    { x1: cx + half - wt / 2, x2: cx + half + wt / 2, z1: cz - half, z2: cz - gapW / 2, dir: 'ew' },
    { x1: cx + half - wt / 2, x2: cx + half + wt / 2, z1: cz + gapW / 2, z2: cz + half, dir: 'ew' },
  ];

  wallDefs.forEach(wd => {
    const ww = wd.x2 - wd.x1;
    const wl = wd.z2 - wd.z1;
    const seg = box(ww, h, wl, marble2Mat, parent);
    seg.position.set((wd.x1 + wd.x2) / 2, h / 2, (wd.z1 + wd.z2) / 2);
    addShadow(seg);
    registerWallCollider(wd.x1, wd.x2, wd.z1, wd.z2);
  });

  // Floor tile
  const floor = box(size - wt * 2, 0.1, size - wt * 2, marbleMat, parent);
  floor.position.set(cx, 0.05, cz);

  // Ceiling
  const ceil = box(size, 0.15, size, ceilingMat, parent);
  ceil.position.set(cx, h + 0.07, cz);

  // Furniture (skip center room — used for staircase)
  if (row !== 0 || col !== 0) {
    addRoomFurniture(parent, cx, cz, h);
  }
}

function addRoomFurniture(parent, cx, cz, h) {
  // Table
  const table = box(2.4, 0.75, 1.2, darkWoodMat, parent);
  table.position.set(cx + 2, 0.37, cz - 2);
  // Table legs
  for (const [ox, oz] of [[-1, -0.5], [1, -0.5], [-1, 0.5], [1, 0.5]]) {
    const leg = cyl(0.06, 0.06, 0.75, darkWoodMat, parent, 6);
    leg.position.set(cx + 2 + ox, 0.37, cz - 2 + oz);
  }
  // Sofa
  const sofa = box(2.2, 0.65, 0.8, sofaMat, parent);
  sofa.position.set(cx - 3, 0.32, cz + 3);
  const sofaBack = box(2.2, 0.5, 0.3, sofaMat, parent);
  sofaBack.position.set(cx - 3, 0.82, cz + 3.35);
  // Bookshelf
  const shelf = box(0.3, 2.0, 1.8, darkWoodMat, parent);
  shelf.position.set(cx + 5, 1.0, cz - 5);
}

function buildChandelier(parent, cx, cz, h) {
  const ring = torus(0.8, 0.06, goldMat, parent, 16);
  ring.rotation.x = Math.PI / 2;
  ring.position.set(cx, h - 0.3, cz);
  // Candles
  for (let i = 0; i < 6; i++) {
    const angle = (i / 6) * Math.PI * 2;
    const candle = cyl(0.05, 0.05, 0.22, pbr(0xfffde8, 0.5, 0), parent, 6);
    candle.position.set(cx + Math.cos(angle) * 0.8, h - 0.42, cz + Math.sin(angle) * 0.8);
    const flame = sph(0.06, pbr(0xffaa20, 0.1, 0, { emissive: 0xffaa20, emissiveIntensity: 0.9 }), parent, 4);
    flame.position.set(cx + Math.cos(angle) * 0.8, h - 0.2, cz + Math.sin(angle) * 0.8);
  }
  // Chain to ceiling
  const chain = cyl(0.03, 0.03, 0.6, goldMat, parent, 6);
  chain.position.set(cx, h - 0.0, cz);
}

function buildMansionStore(parent, x, z, label) {
  const trigger = new BABYLON.TransformNode('t', scene);
  trigger.parent = parent;
  trigger.position.set(x, 1, z - 4);
  trigger.label = label;
  trigger.onInteract = () => { if (window.__openArmory) window.__openArmory(); };
  interactableObjects.push(trigger);
}
