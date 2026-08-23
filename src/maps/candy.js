// ── maps/candy.js  Candy Land ──────────────────────────────────────────────────
import { scene, pbr, gnd, box, cyl, sph, hemi, cone, grp, addShadow, setFog } from '../engine.js';
import { gs, interactableObjects } from '../state.js';
import { registerWallCollider, registerMapGroup } from './index.js';

const groundMat  = pbr(0xffaabb, 0.7, 0);
const pinkMat    = pbr(0xff88aa, 0.5, 0);
const mintMat    = pbr(0x88ffcc, 0.4, 0);
const lavMat     = pbr(0xcc88ff, 0.45, 0);
const yellowMat  = pbr(0xffee44, 0.45, 0);
const redMat     = pbr(0xff2244, 0.5, 0);
const orangeMat  = pbr(0xff8822, 0.5, 0);
const blueMat    = pbr(0x4488ff, 0.4, 0);
const whiteMat   = pbr(0xffffff, 0.3, 0);
const chocMat    = pbr(0x6a3410, 0.7, 0);
const goldMat    = pbr(0xffd700, 0.25, 0.8, { emissive: 0xffcc00, emissiveIntensity: 0.6 });
const glowPink   = pbr(0xff44aa, 0.1, 0, { emissive: 0xff22aa, emissiveIntensity: 2 });
const glowMint   = pbr(0x44ffcc, 0.1, 0, { emissive: 0x22ffaa, emissiveIntensity: 2 });
const glowYellow = pbr(0xffff44, 0.1, 0, { emissive: 0xffff00, emissiveIntensity: 2 });
const storeMat   = pbr(0x882244, 0.6, 0);

const CANDY_MATS = [pinkMat, mintMat, lavMat, yellowMat, redMat, orangeMat, blueMat];
const GLOW_MATS  = [glowPink, glowMint, glowYellow];

export function buildCandyMap() {
  const root = grp('candy');
  setFog(0x220011, 20, 130);
  gnd(250, 250, groundMat).parent = root;

  const rng = mulberry32(2024);

  // Candy path — striped roads (purely visual, no wall colliders)
  for (let i = -4; i <= 4; i++) {
    box(200, 0.08, 4, i%2===0 ? pinkMat : whiteMat, root).position.set(0, 0.04, i*5);
  }
  for (let i = -4; i <= 4; i++) {
    box(4, 0.08, 200, i%2===0 ? mintMat : whiteMat, root).position.set(i*5, 0.04, 0);
  }

  // Giant candy castle — placed well away from player spawn (0,0)
  buildCandyCastle(root, 0, -65, rng);

  // Giant lollipops
  for (let i = 0; i < 30; i++) {
    const lx = (rng()*2-1)*100, lz = (rng()*2-1)*100;
    if (Math.hypot(lx, lz) < 18) continue;
    buildLollipop(root, lx, lz, rng);
  }

  // Giant candy canes
  for (let i = 0; i < 20; i++) {
    const cx = (rng()*2-1)*95, cz = (rng()*2-1)*95;
    if (Math.hypot(cx, cz) < 20) continue;
    buildCandyCane(root, cx, cz, rng);
  }

  // Gingerbread houses
  for (let i = 0; i < 15; i++) {
    const hx = (rng()*2-1)*90, hz = (rng()*2-1)*90;
    if (Math.hypot(hx, hz) < 22) continue;
    buildGingerbreadHouse(root, hx, hz, rng);
  }

  // Cupcake towers
  for (let i = 0; i < 10; i++) {
    const tx = (rng()*2-1)*80, tz = (rng()*2-1)*80;
    if (Math.hypot(tx, tz) < 16) continue;
    buildCupcake(root, tx, tz, rng);
  }

  // Jellybean boulders — decorative only, no wall colliders
  for (let i = 0; i < 50; i++) {
    const jx = (rng()*2-1)*100, jz = (rng()*2-1)*100;
    const r = 0.5+rng()*1.8;
    const jelly = sph(r, CANDY_MATS[Math.floor(rng()*7)], root, 6);
    jelly.position.set(jx, r*0.5, jz);
    jelly.scaling.set(0.6, 1, 0.8);
  }

  // Chocolate river (visual only)
  box(12, 0.1, 200, chocMat, root).position.set(-55, 0.05, 0);
  box(200, 0.1, 10, chocMat, root).position.set(0, 0.05, 55);

  // Cotton candy trees
  for (let i = 0; i < 25; i++) {
    const cx = (rng()*2-1)*95, cz = (rng()*2-1)*95;
    if (Math.hypot(cx, cz) < 16) continue;
    const h = 3+rng()*4;
    cyl(0.2, 0.25, h, whiteMat, root, 5).position.set(cx, h/2, cz);
    sph(2+rng()*2, CANDY_MATS[Math.floor(rng()*7)], root, 8).position.set(cx, h+1.5, cz);
  }

  // Gumball machines
  for (let i = 0; i < 12; i++) {
    const gx = (rng()*2-1)*80, gz = (rng()*2-1)*80;
    if (Math.hypot(gx, gz) < 18) continue;
    const base = cyl(0.5, 0.8, 3, chocMat, root, 8);
    base.position.set(gx, 1.5, gz);
    const globe = sph(2, GLOW_MATS[i%3], root, 10);
    globe.position.set(gx, 4.5, gz);
    addShadow(globe);
    registerWallCollider(gx-2, gx+2, gz-2, gz+2);
    for (let b = 0; b < 8; b++) {
      sph(0.25, CANDY_MATS[b%7], root, 4).position.set(gx+(rng()-0.5)*3, 3+rng()*3, gz+(rng()-0.5)*3);
    }
  }

  // Sprinkles on ground (purely visual)
  for (let i = 0; i < 100; i++) {
    const sx = (rng()*2-1)*110, sz = (rng()*2-1)*110;
    box(0.5, 0.12, 0.12, CANDY_MATS[Math.floor(rng()*7)], root).position.set(sx, 0.06, sz);
  }

  buildCandyStore(root, -70, -70, 'Sweet Armory');
  buildCandyStore(root,  70,  70, 'Sugar Cache');
  buildCandyStore(root, -70,  70, 'Gum Depot');
  buildCandyStore(root,  70, -70, 'Candy Vault');

  registerMapGroup(root);
  gs.isInsideMapInterior = () => false;
}

function buildCandyCastle(parent, x, z, rng) {
  // Castle base — register only the 4 perimeter walls, not a solid block
  const base = box(22, 8, 22, pinkMat, parent);
  base.position.set(x, 4, z);
  addShadow(base);
  // 4 thin wall segments around perimeter (leaves open areas for gameplay)
  registerWallCollider(x-11, x+11, z-11, z-9);  // north wall
  registerWallCollider(x-11, x+11, z+9, z+11);  // south wall
  registerWallCollider(x-11, x-9, z-11, z+11);  // west wall
  registerWallCollider(x+9, x+11, z-11, z+11);  // east wall

  // Corner towers
  for (const [dx, dz] of [[-11,-11],[-11,11],[11,-11],[11,11]]) {
    const tower = cyl(3, 3.5, 14, lavMat, parent, 10);
    tower.position.set(x+dx, 7, z+dz);
    addShadow(tower);
    registerWallCollider(x+dx-3.5, x+dx+3.5, z+dz-3.5, z+dz+3.5);
    const cap = cone(3.8, 5, redMat, parent, 10);
    cap.position.set(x+dx, 16.5, z+dz);
    sph(0.6, goldMat, parent, 5).position.set(x+dx, 19.2, z+dz);
  }

  // Drawbridge towers
  for (const side of [-5, 5]) {
    const dt = cyl(2, 2.5, 12, mintMat, parent, 8);
    dt.position.set(x+side, 6, z+11);
    addShadow(dt);
    const dtCap = cone(2.8, 4, yellowMat, parent, 8);
    dtCap.position.set(x+side, 14, z+11);
  }

  // Candy battlements
  for (let i = 0; i < 12; i++) {
    const ang = (i/12)*Math.PI*2;
    box(1.5, 2, 1.5, CANDY_MATS[i%7], parent).position.set(x+Math.cos(ang)*10, 9, z+Math.sin(ang)*10);
  }

  // Central keep
  const keep = cyl(4, 4, 18, yellowMat, parent, 10);
  keep.position.set(x, 9, z);
  addShadow(keep);
  registerWallCollider(x-4, x+4, z-4, z+4);
  const keepCap = cone(5, 7, pinkMat, parent, 10);
  keepCap.position.set(x, 21.5, z);
  sph(1.2, goldMat, parent, 7).position.set(x, 25, z);
}

function buildLollipop(parent, x, z, rng) {
  const h = 5+rng()*8;
  const mat = CANDY_MATS[Math.floor(rng()*7)];
  cyl(0.18, 0.22, h, whiteMat, parent, 5).position.set(x, h/2, z);
  const top = sph(1.8+rng()*1.5, mat, parent, 10);
  top.position.set(x, h, z);
  addShadow(top);
  // Swirl lines
  for (let i = 0; i < 4; i++) {
    const ang = (i/4)*Math.PI*2;
    box(0.15, 0.15, 2, whiteMat, parent).position.set(x+Math.cos(ang)*1.5, h, z+Math.sin(ang)*1.5);
  }
  // Only very large lollipops block movement
  if (h > 10) registerWallCollider(x-1, x+1, z-1, z+1);
}

function buildCandyCane(parent, x, z, rng) {
  const h = 4+rng()*5;
  const mat = rng()<0.5 ? redMat : orangeMat;
  const shaft = cyl(0.35, 0.4, h, whiteMat, parent, 8);
  shaft.position.set(x, h/2, z);
  addShadow(shaft);
  for (let s = 0; s < 5; s++) {
    cyl(0.37, 0.42, 0.5, mat, parent, 8).position.set(x, s*h/5+h/10, z);
  }
  // Hook top
  sph(0.8, whiteMat, parent, 6).position.set(x+0.8, h+0.4, z);
  sph(0.8, mat, parent, 6).position.set(x+0.8, h+0.4, z);
  // Only large candy canes block movement
  if (h > 7) registerWallCollider(x-0.5, x+0.5, z-0.5, z+0.5);
}

function buildGingerbreadHouse(parent, x, z, rng) {
  const w = 5+rng()*3, d = 4+rng()*3, h = 3.5+rng()*1.5;
  const house = box(w, h, d, chocMat, parent);
  house.position.set(x, h/2, z);
  addShadow(house);
  registerWallCollider(x-w/2, x+w/2, z-d/2, z+d/2);
  // Icing roof
  box(w+1, 0.3, d+1, whiteMat, parent).position.set(x, h+0.15, z);
  box(w+1.2, 1.8, 0.5, CANDY_MATS[Math.floor(rng()*7)], parent).position.set(x, h+1.05, z);
  // Candy decorations
  for (let i = 0; i < 6; i++) {
    sph(0.2, CANDY_MATS[i%7], parent, 4).position.set(x-w/2+i*w/6+w/12, h+0.4, z-d/2);
  }
  // Door
  box(0.8, 1.5, 0.15, pinkMat, parent).position.set(x, h*0.25, z-d/2);
}

function buildCupcake(parent, x, z, rng) {
  const r = 2+rng()*2;
  const base = cyl(r, r*1.2, r, chocMat, parent, 14);
  base.position.set(x, r/2, z);
  addShadow(base);
  registerWallCollider(x-r-0.3, x+r+0.3, z-r-0.3, z+r+0.3);
  const frostMat = CANDY_MATS[Math.floor(rng()*7)];
  sph(r*1.1, frostMat, parent, 10).position.set(x, r+r*0.6, z);
  sph(r*0.7, frostMat, parent, 8).position.set(x+(rng()-0.5)*r*0.5, r+r*1.3, z+(rng()-0.5)*r*0.5);
  sph(r*0.4, frostMat, parent, 6).position.set(x+(rng()-0.5)*r*0.3, r+r*1.8, z+(rng()-0.5)*r*0.3);
  cyl(0.12, 0.15, 1.5, CANDY_MATS[Math.floor(rng()*7)], parent, 6).position.set(x, r+r*2.2, z);
  sph(0.25, glowYellow, parent, 4).position.set(x, r+r*2.2+0.95, z);
}

function buildCandyStore(parent, x, z, label) {
  [[x-5,z,0.5,10],[x+5,z,0.5,10],[x,z+5,10,0.5],[x-3,z-5,3.5,0.5],[x+3,z-5,3.5,0.5]]
  .forEach(([wx,wz,ww,wd]) => {
    box(ww,4,wd,storeMat,parent).position.set(wx,2,wz);
    registerWallCollider(wx-ww/2,wx+ww/2,wz-wd/2,wz+wd/2);
  });
  const t = new BABYLON.TransformNode('t', scene);
  t.parent = parent; t.position.set(x,1,z-4);
  t.label = label; t.onInteract = () => window.__openArmory?.();
  interactableObjects.push(t);
}

function mulberry32(seed) {
  return function() {
    seed += 0x6D2B79F5; let t = seed;
    t = Math.imul(t^t>>>15,t|1); t ^= t+Math.imul(t^t>>>7,t|61);
    return ((t^t>>>14)>>>0)/4294967296;
  };
}
