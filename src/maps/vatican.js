// ── maps/vatican.js  Vatican Plaza & Cathedral ────────────────────────────────
import { scene, pbr, std, gnd, box, cyl, sph, cone, torus, grp, plane, addShadow, makeCanvasTex } from '../engine.js';
import { gs, vaticanCongregants, fleeingNpcs, interactableObjects } from '../state.js';
import { registerWallCollider, registerMapGroup } from './index.js';

const marbleMat   = pbr(0xf0ebe0, 0.25, 0.08);
const stoneMat    = pbr(0xd4c8b0, 0.75, 0.02);
const darkStoneMat= pbr(0x6a5a48, 0.75, 0.02);
const roofMat     = pbr(0xb89060, 0.65, 0.02);
const woodMat     = pbr(0x6a4520, 0.8, 0.02);

export function buildVaticanMap() {
  const root = grp('vatican');

  // Ground — marble piazza
  const g = gnd(200, 200, marbleMat);
  g.parent = root;

  // Decorative tile grid
  for (let x = -80; x <= 80; x += 8) {
    const line = box(0.1, 0.02, 160, pbr(0xc8b898, 0.4, 0.05), root);
    line.position.set(x, 0.01, 0);
  }

  // ── Cathedral ─────────────────────────────────────────────────────────────
  const cx = 0, cz = -30;
  const wallH = 8;

  // Outer walls (nave: 28 wide, 44 deep)
  const wallSegs = [
    { x: cx - 14, z: cz,     w: 0.8, d: 44 },  // west wall
    { x: cx + 14, z: cz,     w: 0.8, d: 44 },  // east wall
    { x: cx,      z: cz - 22, w: 28, d: 0.8 }, // back wall
    { x: cx - 6,  z: cz + 22, w: 8,  d: 0.8 }, // front left
    { x: cx + 6,  z: cz + 22, w: 8,  d: 0.8 }, // front right
  ];
  wallSegs.forEach(ws => {
    const m = box(ws.w, wallH, ws.d, stoneMat, root);
    m.position.set(ws.x, wallH / 2, ws.z);
    addShadow(m);
    registerWallCollider(ws.x - ws.w / 2, ws.x + ws.w / 2, ws.z - ws.d / 2, ws.z + ws.d / 2);
  });

  // Roof
  const roofFlat = box(28, 0.5, 44, roofMat, root);
  roofFlat.position.set(cx, wallH + 0.25, cz);

  // Dome above crossing
  const dome = sph(5, pbr(0xe8d8b0, 0.3, 0.05), root, 12);
  dome.position.set(cx, wallH + 5, cz - 8);
  addShadow(dome);

  // Facade towers
  for (const tx of [-13, 13]) {
    const tower = box(4, wallH + 6, 4, stoneMat, root);
    tower.position.set(cx + tx, (wallH + 6) / 2, cz + 22);
    addShadow(tower);
    // Finial
    const fin = cone(1, 3, roofMat, root, 8);
    fin.position.set(cx + tx, wallH + 6 + 1.5, cz + 22);
  }

  // Interior pillars
  for (let i = 0; i < 4; i++) {
    const pz = cz - 16 + i * 8;
    for (const px of [-9, 9]) {
      const pillar = cyl(0.55, 0.55, wallH, stoneMat, root, 10);
      pillar.position.set(cx + px, wallH / 2, pz);
      addShadow(pillar);
    }
  }

  // Stained glass windows
  const glassColors = [0xff4444, 0x4444ff, 0xffaa00, 0x44ff44, 0xaa00ff];
  for (let i = 0; i < 5; i++) {
    const gz = cz - 18 + i * 9;
    for (const gxOff of [-1, 1]) {
      const gColor = glassColors[i];
      const gMat = pbr(gColor, 0.1, 0, { alpha: 0.6, emissive: gColor, emissiveIntensity: 0.3 });
      const win = box(0.1, 3, 2, gMat, root);
      win.position.set(cx + gxOff * 13.6, wallH - 2, gz);
    }
  }

  // Altar
  const altar = box(3, 1, 2, marbleMat, root);
  altar.position.set(cx, 0.5, cz - 18);
  addShadow(altar);

  // Pope / priest NPC
  const popeGroup = buildNPC(root, 0xffffff, 0xffdd88);
  popeGroup.position.set(cx, 0, cz - 19);
  gs.vaticanPopeGroup = popeGroup;

  gs.isInsideMapInterior = (x, z) => x > cx - 14 && x < cx + 14 && z > cz - 22 && z < cz + 22;

  // ── Congregation ────────────────────────────────────────────────────────────
  for (let row = 0; row < 4; row++) {
    for (let col = 0; col < 6; col++) {
      const px = cx - 11 + col * 4;
      const pz = cz - 10 + row * 5;
      const pew = box(2.8, 0.6, 0.5, woodMat, root);
      pew.position.set(px, 0.3, pz + 0.6);

      const congregant = buildNPC(root, 0x5566aa, 0xd4a88c);
      congregant.position.set(px, 0, pz);
      congregant.phase = (row * 6 + col) * 0.28;
      congregant._fleeTarget = null;
      vaticanCongregants.push(congregant);
    }
  }

  // ── Colonnade ring ──────────────────────────────────────────────────────────
  for (let i = 0; i < 18; i++) {
    const angle = (i / 18) * Math.PI * 2;
    const r = 44;
    const col = cyl(0.7, 0.7, 7, stoneMat, root, 10);
    col.position.set(Math.cos(angle) * r, 3.5, cz + 20 + Math.sin(angle) * r * 0.5);
    addShadow(col);
    // Lintel
    const lintel = box(0.8, 0.5, 3, stoneMat, root);
    lintel.position.set(Math.cos(angle) * r, 7.25, cz + 20 + Math.sin(angle) * r * 0.5);
  }

  // Obelisk
  const obBase = box(1.6, 0.8, 1.6, marbleMat, root);
  obBase.position.set(0, 0.4, cz + 35);
  const obShaft = box(0.8, 18, 0.8, marbleMat, root);
  obShaft.position.set(0, 9.4, cz + 35);
  const obCap = cone(0.6, 2, pbr(0xffd700, 0.1, 0.9), root, 4);
  obCap.position.set(0, 19.4, cz + 35);
  addShadow(obShaft);

  // Gift shop
  buildVaticanStore(root, 35, cz + 35, 'Pilgrim Shop');

  registerMapGroup(root);
}

function buildNPC(parent, clothHex, skinHex) {
  const g = grp('npc', parent);
  const torso = box(0.44, 0.6, 0.25, pbr(clothHex, 0.6, 0.05), g);
  torso.position.y = 0.9;
  const head = sph(0.195, pbr(skinHex, 0.45, 0.02), g, 8);
  head.position.y = 1.75;
  const hat = cyl(0.21, 0.21, 0.18, pbr(clothHex, 0.5, 0.05), g, 10);
  hat.position.y = 1.95;
  const legL = BABYLON.MeshBuilder.CreateCapsule('ll', { radius: 0.1, height: 0.75, tessellation: 6, subdivisions: 2 }, scene);
  legL.material = pbr(clothHex, 0.6, 0.05);
  legL.parent = g; legL.position.set(-0.15, 0.38, 0);
  const legR = legL.clone('lr'); legR.parent = g; legR.position.x = 0.15;
  return g;
}

function buildVaticanStore(parent, x, z, label) {
  const wallMat = stoneMat;
  const walls = [
    { wx: x - 5, wz: z, ww: 0.5, wd: 10 },
    { wx: x + 5, wz: z, ww: 0.5, wd: 10 },
    { wx: x, wz: z + 5, ww: 10, wd: 0.5 },
    { wx: x - 3, wz: z - 5, ww: 3.5, wd: 0.5 },
    { wx: x + 3, wz: z - 5, ww: 3.5, wd: 0.5 },
  ];
  walls.forEach(w => {
    const m = box(w.ww, 3.5, w.wd, wallMat, parent);
    m.position.set(w.wx, 1.75, w.wz);
    registerWallCollider(w.wx - w.ww / 2, w.wx + w.ww / 2, w.wz - w.wd / 2, w.wz + w.wd / 2);
  });
  const trigger = new BABYLON.TransformNode('trigger', scene);
  trigger.parent = parent;
  trigger.position.set(x, 1, z - 4);
  trigger.label = label;
  trigger.onInteract = () => { if (window.__openArmory) window.__openArmory(); };
  interactableObjects.push(trigger);
}

// ── Vatican prayer animation (called each frame while on Vatican map) ─────────
export function animateVaticanPrayer(dt) {
  vaticanCongregants.forEach(c => {
    if (!c || c.isDisposed()) return;
    c.rotation.x = Math.sin(gs.timeAccum * 0.7 + c.phase) * 0.1 - 0.06;
  });
  if (gs.vaticanPopeGroup && !gs.vaticanPopeGroup.isDisposed()) {
    gs.vaticanPopeGroup.rotation.x = Math.sin(gs.timeAccum * 0.45) * 0.07;
  }
}
