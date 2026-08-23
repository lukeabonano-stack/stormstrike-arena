// ── maps/ski.js  Ski Resort ────────────────────────────────────────────────────
import { scene, pbr, gnd, box, cyl, sph, hemi, cone, grp, addShadow, setFog } from '../engine.js';
import { gs, interactableObjects } from '../state.js';
import { registerWallCollider, registerMapGroup } from './index.js';

const snowMat    = pbr(0xeef4ff, 0.82, 0);
const iceMat     = pbr(0xddeeff, 0.08, 0.15);
const woodMat    = pbr(0x7a4820, 0.85, 0.02);
const darkWood   = pbr(0x5a3210, 0.88, 0.02);
const stoneWall  = pbr(0x8a8878, 0.88, 0.03);
const redRoof    = pbr(0xcc2200, 0.7, 0.05);
const blueMat    = pbr(0x1144cc, 0.7, 0.1);
const cableWire  = pbr(0x444444, 0.6, 0.5);
const conifMat   = pbr(0x1a5020, 0.75, 0);
const darkConif  = pbr(0x0d3010, 0.8, 0);
const logMat     = pbr(0x9a5a28, 0.82, 0.01);
const snowLight  = pbr(0xffffff, 0.1, 0, { emissive: 0xeeffff, emissiveIntensity: 2 });
const flagR      = pbr(0xdd1111, 0.6, 0);
const flagG      = pbr(0x11cc11, 0.6, 0);
const storeMat   = pbr(0x8a7860, 0.8, 0.04);

export function buildSkiMap() {
  const root = grp('ski');
  setFog(0xddeeff, 22, 130);
  gnd(250, 250, snowMat).parent = root;

  const rng = mulberry32(7777);

  // Snowy mountain slopes (bumps in ground simulated with hemispheres)
  for (let i = 0; i < 40; i++) {
    const mx = (rng()*2-1)*110, mz = (rng()*2-1)*110;
    const mr = 8+rng()*20;
    const hill = hemi(mr, snowMat, root, 10);
    hill.position.set(mx, 0, mz); hill.scaling.y = 0.3+rng()*0.2;
  }

  // Main ski lodge (base area)
  buildSkiLodge(root, 0, 0);

  // Ski lifts
  buildSkiLift(root, 0, -30, 0, -90);
  buildSkiLift(root, -20, -25, -20, -85);
  buildSkiLift(root,  25, -25,  25, -90);

  // Chalets
  for (let i = 0; i < 10; i++) {
    const hx = (rng()*2-1)*80, hz = 10+rng()*50;
    buildChalet(root, hx, hz * (rng()<0.5 ? 1 : -1), rng);
  }

  // Ski run flags
  for (let run = -1; run <= 1; run++) {
    const rx = run*20;
    for (let i = 0; i < 10; i++) {
      const fz = -30-i*6;
      const flag = box(0.8, 2, 0.08, i%2===0 ? flagR : flagG, root);
      flag.position.set(rx-1+Math.sin(i)*2, 1, fz);
      cyl(0.06, 0.06, 2.5, cableWire, root, 4).position.set(rx-1+Math.sin(i)*2, 1.25, fz);
    }
  }

  // Pine trees (lots!)
  for (let i = 0; i < 100; i++) {
    const tx = (rng()*2-1)*110, tz = (rng()*2-1)*110;
    if (Math.hypot(tx, tz) < 20) continue;
    buildPineTree(root, tx, tz, rng);
  }

  // Ski jumps
  buildSkiJump(root, 30, -50, rng);
  buildSkiJump(root, -35, -55, rng);

  // Snowcat vehicles
  for (const [vcx, vcz] of [[15, 30], [-20, -70], [50, -40]]) {
    buildSnowcat(root, vcx, vcz, rng);
  }

  // Mogul fields
  for (let i = 0; i < 60; i++) {
    const mx = (rng()-0.5)*60, mz = -40-rng()*40;
    sph(1.2+rng()*0.8, snowMat, root, 6).position.set(mx, 0.4, mz);
  }

  // Icicles hanging from lodge
  for (let i = 0; i < 20; i++) {
    const ix = (rng()-0.5)*20, iz = (rng()-0.5)*8;
    const h = 0.5+rng()*2;
    const icicle = cone(0.1+rng()*0.15, h, iceMat, root, 5);
    icicle.position.set(ix, 8-h/2, iz+9.5);
    icicle.rotation.x = Math.PI;
  }

  // Frozen lake
  cyl(18, 18, 0.2, iceMat, root, 20).position.set(50, 0.1, 40);
  // Cracks in ice
  for (let i = 0; i < 8; i++) {
    const ang = rng()*Math.PI*2;
    box(12, 0.06, 0.15, pbr(0x99bbdd, 0.2, 0.1), root)
      .position.set(50+Math.cos(ang)*5, 0.22, 40+Math.sin(ang)*5);
  }

  // Snowmen
  for (let i = 0; i < 8; i++) {
    const sx = (rng()-0.5)*100, sz = (rng()-0.5)*80;
    if (Math.hypot(sx, sz) < 22) continue;
    sph(0.9, snowMat, root, 7).position.set(sx, 0.9, sz);
    sph(0.65, snowMat, root, 7).position.set(sx, 2.1, sz);
    sph(0.45, snowMat, root, 7).position.set(sx, 2.95, sz);
    sph(0.12, pbr(0x111111,0.9,0), root, 4).position.set(sx-0.2, 3.08, sz-0.4);
    sph(0.12, pbr(0x111111,0.9,0), root, 4).position.set(sx+0.2, 3.08, sz-0.4);
    cyl(0.08, 0.05, 0.4, pbr(0xff5500,0.7,0), root, 4).position.set(sx, 2.95, sz-0.5);
    box(0.08, 0.8, 0.08, logMat, root).position.set(sx-0.8, 2.1, sz);
    box(0.08, 0.8, 0.08, logMat, root).position.set(sx+0.8, 2.1, sz);
  }

  buildSkiStore(root, -60, -80, 'Ski Patrol Cache');
  buildSkiStore(root,  60, -80, 'Summit Armory');
  buildSkiStore(root, -60,  70, 'Base Camp Depot');
  buildSkiStore(root,  60,  70, 'Powder Vault');

  registerMapGroup(root);
  gs.isInsideMapInterior = () => false;
}

function buildSkiLodge(parent, x, z) {
  const lodge = box(30, 8, 22, stoneWall, parent);
  lodge.position.set(x, 4, z);
  addShadow(lodge);
  registerWallCollider(x-15, x+15,  z-11,   z-10.5);
  registerWallCollider(x-15, x-14.5, z-10.5, z+11);
  registerWallCollider(x+14.5, x+15, z-10.5, z+11);
  registerWallCollider(x-15, x-3,  z+10.5, z+11);
  registerWallCollider(x+3,  x+15, z+10.5, z+11);
  // Chalet roof
  for (let i = 0; i < 15; i++) {
    const rh = 8 - Math.abs(i-7)*0.8;
    box(0.4, rh, 22, woodMat, parent).position.set(x-7+i, 8+rh/2, z);
  }
  // Balcony
  box(30, 0.4, 5, woodMat, parent).position.set(x, 8.2, z-13.5);
  box(30, 2, 0.2, woodMat, parent).position.set(x, 9.2, z-16);
  // Chimney
  cyl(0.8, 1, 6, stoneWall, parent, 8).position.set(x-8, 11, z);
  sph(1.2, pbr(0x333330, 0.9, 0), parent, 5).position.set(x-8, 14.5, z);
  // Deck lights
  for (let i = -6; i <= 6; i+=3) {
    sph(0.25, snowLight, parent, 4).position.set(x+i*2, 8.5, z-15.8);
  }
  // Big windows
  for (const [dx, dz2] of [[-8,-11],[0,-11],[8,-11]]) {
    box(4, 3.5, 0.2, pbr(0xaaccee, 0.06, 0.4, {emissive:0x889aaa,emissiveIntensity:0.3}), parent)
      .position.set(x+dx, 5, z+dz2);
  }
}

function buildSkiLift(parent, x1, z1, x2, z2) {
  const dx = x2-x1, dz = z2-z1;
  const len = Math.sqrt(dx*dx+dz*dz);
  const ang = Math.atan2(dz, dx);
  const POLES = Math.floor(len/15);
  for (let i = 0; i <= POLES; i++) {
    const t = i/POLES;
    const px = x1+dx*t, pz = z1+dz*t;
    const ph = 8+Math.sin(t*Math.PI)*4;
    cyl(0.25, 0.35, ph, darkWood, parent, 6).position.set(px, ph/2, pz);
    box(3.5, 0.2, 0.2, cableWire, parent).position.set(px, ph+0.1, pz);
    // Cable car gondola on some poles
    if (i%3===1) {
      box(2, 1.5, 1.2, blueMat, parent).position.set(px, ph-2, pz);
      cyl(0.06, 0.06, 2, cableWire, parent, 4).position.set(px, ph-0.5, pz);
    }
  }
  // Main cable line
  box(0.08, 0.08, len, cableWire, parent).position.set((x1+x2)/2, 12, (z1+z2)/2);
}

function buildChalet(parent, x, z, rng) {
  const w = 6+rng()*4, d = 5+rng()*3, h = 4+rng()*2;
  const chalet = box(w, h, d, logMat, parent);
  chalet.position.set(x, h/2, z);
  addShadow(chalet);
  registerWallCollider(x-w/2, x+w/2, z-d/2, z+d/2);
  // Pitched roof
  for (let i = 0; i < Math.floor(w/0.6); i++) {
    const rh = w/2 - Math.abs(i*0.6-w/2);
    box(0.5, rh, d+0.4, rng()<0.5 ? woodMat : redRoof, parent).position.set(x-w/2+i*0.6, h+rh/2, z);
  }
  // Chimney
  cyl(0.3, 0.4, 3, stoneWall, parent, 6).position.set(x+1, h+2, z);
  sph(0.5, pbr(0x222220, 0.95, 0), parent, 4).position.set(x+1, h+3.8, z);
}

function buildPineTree(parent, x, z, rng) {
  const h = 5+rng()*8;
  const pineBase = cyl(0.2, 0.3, h*0.4, logMat, parent, 6);
  pineBase.position.set(x, h*0.2, z);
  addShadow(pineBase);
  for (let tier = 0; tier < 4; tier++) {
    const tr = (3-tier)*1.5+1, th = h*0.3;
    const tree = cone(tr, th, tier%2===0 ? conifMat : darkConif, parent, 8);
    tree.position.set(x, h*0.3+tier*th*0.65, z);
    addShadow(tree);
  }
  if (rng()<0.7) registerWallCollider(x-0.6, x+0.6, z-0.6, z+0.6);
}

function buildSkiJump(parent, x, z, rng) {
  const slope = box(4, 0.4, 25, iceMat, parent);
  slope.position.set(x, 4, z);
  slope.rotation.x = 0.4;
  addShadow(slope);
  // Support structure
  for (let i = 0; i < 3; i++) {
    cyl(0.3, 0.3, 4+i*2, darkWood, parent, 5).position.set(x, 2+i, z+5-i*4);
    cyl(0.3, 0.3, 4+i*2, darkWood, parent, 5).position.set(x+2, 2+i, z+5-i*4);
    cyl(0.3, 0.3, 4+i*2, darkWood, parent, 5).position.set(x-2, 2+i, z+5-i*4);
  }
}

function buildSnowcat(parent, x, z, rng) {
  const snowcat = box(4, 2, 6, pbr(0xcc8800, 0.7, 0.1), parent);
  snowcat.position.set(x, 1, z);
  addShadow(snowcat);
  registerWallCollider(x-2, x+2, z-3, z+3);
  box(3.8, 1.5, 4, pbr(0xdd9900, 0.6, 0.1), parent).position.set(x, 2.25, z-0.5);
  sph(0.4, snowLight, parent, 4).position.set(x, 2.5, z-3.2);
}

function buildSkiStore(parent, x, z, label) {
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
