// ── maps/carnival.js  Carnival / Circus ───────────────────────────────────────
import { scene, pbr, gnd, box, cyl, sph, hemi, cone, grp, addShadow, setFog } from '../engine.js';
import { gs, interactableObjects } from '../state.js';
import { registerWallCollider, registerMapGroup } from './index.js';

const grassMat   = pbr(0x228833, 0.95, 0);
const dirtPath   = pbr(0x8a6a40, 0.96, 0);
const tentRed    = pbr(0xdd1111, 0.7, 0);
const tentYel    = pbr(0xffcc00, 0.6, 0);
const tentBlue   = pbr(0x1144cc, 0.7, 0);
const tentWhite  = pbr(0xeeeeff, 0.65, 0);
const woodMat    = pbr(0x7a5020, 0.85, 0.02);
const metalMat   = pbr(0x888898, 0.5, 0.6);
const lightMat   = pbr(0xffff88, 0.1, 0, { emissive: 0xffffcc, emissiveIntensity: 2 });
const redLight   = pbr(0xff4444, 0.1, 0, { emissive: 0xff2222, emissiveIntensity: 2 });
const blueLight  = pbr(0x4444ff, 0.1, 0, { emissive: 0x2222ff, emissiveIntensity: 2 });
const greenLight = pbr(0x44ff44, 0.1, 0, { emissive: 0x22ff22, emissiveIntensity: 2 });
const goldMat    = pbr(0xffd700, 0.2, 0.8, { emissive: 0xffcc00, emissiveIntensity: 0.5 });
const storeMat   = pbr(0x882211, 0.7, 0.05);

export function buildCarnivalMap() {
  const root = grp('carnival');
  setFog(0x220033, 20, 130);
  gnd(240, 240, grassMat).parent = root;

  const rng = mulberry32(314);

  // Central midway path
  box(14, 0.08, 200, dirtPath, root).position.set(0, 0.04, 0);
  box(200, 0.08, 14, dirtPath, root).position.set(0, 0.04, 0);

  // BIG TOP CIRCUS TENT (centerpiece)
  buildBigTop(root, 0, 0);

  // Ferris wheel
  buildFerrisWheel(root, 45, 0);

  // Carousel
  buildCarousel(root, -45, 0);

  // Roller coaster track
  buildRollerCoaster(root, 0, 50);

  // Game booths along the midway
  for (let i = -4; i <= 4; i++) {
    if (i === 0) continue;
    buildGameBooth(root, 14+8, i*18, rng);
    buildGameBooth(root, -(14+8), i*18, rng);
  }

  // Food stands
  for (let i = -3; i <= 3; i++) {
    if (i === 0) continue;
    buildFoodStand(root, i*22, 14+7, rng);
    buildFoodStand(root, i*22, -(14+7), rng);
  }

  // Balloon animals / decorative spheres
  const ballMats = [tentRed, tentYel, tentBlue];
  for (let i = 0; i < 40; i++) {
    const bx = (rng()*2-1)*100, bz = (rng()*2-1)*100;
    if (Math.hypot(bx, bz) < 15) continue;
    sph(0.4+rng()*0.5, ballMats[Math.floor(rng()*3)], root, 5).position.set(bx, 0.8+rng()*3, bz);
    cyl(0.04, 0.04, 0.8+rng()*3, woodMat, root, 4).position.set(bx, 0.5, bz);
  }

  // String lights between poles
  const lightColors = [lightMat, redLight, blueLight, greenLight];
  for (let i = 0; i < 30; i++) {
    const px = (rng()*2-1)*85, pz = (rng()*2-1)*85;
    const ph = 5+rng()*4;
    cyl(0.08, 0.1, ph, woodMat, root, 5).position.set(px, ph/2, pz);
    for (let l = 0; l < 4; l++) {
      sph(0.15, lightColors[l%4], root, 4).position.set(px+(rng()-0.5)*2, ph-0.3, pz+(rng()-0.5)*2);
    }
  }

  // Clown car (box car with sph top)
  buildClownCar(root, 30, -35);
  buildClownCar(root, -25, 35);

  // Funhouse mirrors (tall flat planes)
  for (let i = 0; i < 8; i++) {
    const ang = (i/8)*Math.PI*2;
    const r = 65;
    const mx = Math.cos(ang)*r, mz = Math.sin(ang)*r;
    const mirror = box(3, 6, 0.2, pbr(0xaabbcc, 0.05, 0.95, {emissive:0x8899aa,emissiveIntensity:0.2}), root);
    mirror.position.set(mx, 3, mz);
    mirror.rotation.y = ang;
    addShadow(mirror);
    registerWallCollider(mx-1.5, mx+1.5, mz-0.2, mz+0.2);
  }

  buildCarnivalStore(root, -65, -65, 'Prize Counter');
  buildCarnivalStore(root,  65,  65, 'Carnival Armory');
  buildCarnivalStore(root, -65,  65, 'Game Den');
  buildCarnivalStore(root,  65, -65, 'Midway Depot');

  registerMapGroup(root);
  gs.isInsideMapInterior = () => false;
}

function buildBigTop(parent, x, z) {
  // Main tent body
  const body = cyl(20, 22, 14, tentRed, parent, 16);
  body.position.set(x, 7, z);
  addShadow(body);
  registerWallCollider(x-22, x+22, z-22, z-21);
  registerWallCollider(x-22, x-21, z-21, z+22);
  registerWallCollider(x+21, x+22, z-21, z+22);
  registerWallCollider(x-22, x-3,  z+21, z+22);
  registerWallCollider(x+3,  x+22, z+21, z+22);

  // Alternating color stripes via cones
  for (let i = 0; i < 8; i++) {
    const ang = (i/8)*Math.PI*2;
    const cx = Math.cos(ang)*16, cz = Math.sin(ang)*16;
    box(4, 14, 0.5, i%2===0 ? tentYel : tentWhite, parent).position.set(x+cx, 7, z+cz);
  }

  // Top cone (big)
  const topcone = cone(22, 10, tentYel, parent, 16);
  topcone.position.set(x, 14+5, z);
  addShadow(topcone);

  // Spire
  cyl(0.4, 0.4, 6, metalMat, parent, 8).position.set(x, 24.5, z);
  sph(0.8, goldMat, parent, 6).position.set(x, 28, z);

  // Smaller side tents
  for (const [dx, dz] of [[-18, 0], [18, 0], [0, -18], [0, 18]]) {
    const mini = cyl(5, 6, 5, tentBlue, parent, 10);
    mini.position.set(x+dx, 2.5, z+dz);
    addShadow(mini);
    cone(6, 4, tentRed, parent, 10).position.set(x+dx, 5+2, z+dz);
    cyl(0.2, 0.2, 2, metalMat, parent, 6).position.set(x+dx, 10, z+dz);
    sph(0.3, goldMat, parent, 4).position.set(x+dx, 11.2, z+dz);
  }

  // Entry flag poles
  for (const dx of [-12, 12]) {
    cyl(0.2, 0.2, 8, metalMat, parent, 5).position.set(x+dx, 4, z+22);
    box(3, 2, 0.12, tentRed, parent).position.set(x+dx+2, 7.5, z+22);
  }
}

function buildFerrisWheel(parent, x, z) {
  const ferrisPost = cyl(0.5, 0.6, 18, metalMat, parent, 8);
  ferrisPost.position.set(x, 9, z);
  addShadow(ferrisPost);
  registerWallCollider(x-1, x+1, z-1, z+1);
  // Wheel ring
  cyl(12, 12, 0.5, metalMat, parent, 24).position.set(x, 17, z);
  cyl(12, 12, 0.5, metalMat, parent, 24).position.set(x, 16, z);
  // Spokes + gondolas
  for (let i = 0; i < 8; i++) {
    const ang = (i/8)*Math.PI*2;
    const gx = Math.cos(ang)*11, gy = Math.sin(ang)*11;
    box(0.2, 12, 0.2, metalMat, parent).position.set(x+gx*0.5, 17+gy*0.5, z);
    sph(1, tentRed, parent, 5).position.set(x+gx, 17+gy, z);
  }
}

function buildCarousel(parent, x, z) {
  cyl(12, 12, 0.4, dirtPath, parent, 20).position.set(x, 0.2, z);
  cyl(0.5, 0.5, 10, metalMat, parent, 8).position.set(x, 5, z);
  cone(13, 3, tentRed, parent, 20).position.set(x, 10+1.5, z);
  cyl(0.3, 0.3, 2, goldMat, parent, 6).position.set(x, 12.5, z);
  for (let i = 0; i < 8; i++) {
    const ang = (i/8)*Math.PI*2;
    const cx = Math.cos(ang)*8, cz = Math.sin(ang)*8;
    cyl(0.15, 0.15, 8, goldMat, parent, 5).position.set(x+cx, 4, z+cz);
    sph(0.7, tentYel, parent, 5).position.set(x+cx, 2, z+cz);
    box(0.8, 1.5, 0.5, tentBlue, parent).position.set(x+cx, 1.75, z+cz);
  }
}

function buildRollerCoaster(parent, x, z) {
  const trackMat = metalMat;
  const points = [0, 15, 30, 45, 60, 75, 90];
  const heights = [3, 10, 3, 8, 2, 6, 3];
  for (let i = 0; i < points.length-1; i++) {
    const x1 = x+points[i]-45, x2 = x+points[i+1]-45;
    const y1 = heights[i], y2 = heights[i+1];
    const segLen = Math.sqrt((x2-x1)**2+(y2-y1)**2);
    const seg = box(15, 0.6, segLen, trackMat, parent);
    seg.position.set(x1, y1, z+i*5);
    // Support pillars
    cyl(0.3, 0.4, y1, trackMat, parent, 5).position.set(x1, y1/2, z+i*5);
    registerWallCollider(x1-7.5, x1+7.5, z+i*5-0.5, z+i*5+0.5);
  }
}

function buildGameBooth(parent, x, z, rng) {
  const booth = box(8, 3.5, 5, rng()<0.5 ? tentRed : tentBlue, parent);
  booth.position.set(x, 1.75, z);
  addShadow(booth);
  registerWallCollider(x-4, x+4, z-2.5, z+2.5);
  box(8.2, 1, 0.2, tentYel, parent).position.set(x, 3.5, z-2.4);
  for (let i = 0; i < 4; i++) {
    sph(0.25, lightMat, parent, 4).position.set(x-3+i*2, 4.3, z-2.4);
  }
}

function buildFoodStand(parent, x, z, rng) {
  const stand = box(6, 3, 4, woodMat, parent);
  stand.position.set(x, 1.5, z);
  addShadow(stand);
  registerWallCollider(x-3, x+3, z-2, z+2);
  box(7, 0.2, 0.2, rng()<0.5 ? tentRed : tentYel, parent).position.set(x, 3.1, z);
  sph(0.35, lightMat, parent, 4).position.set(x, 3.5, z);
}

function buildClownCar(parent, x, z) {
  box(3, 1.5, 5, tentRed, parent).position.set(x, 0.75, z);
  box(2.8, 1, 3.5, tentYel, parent).position.set(x, 2, z-0.3);
  sph(0.8, tentRed, parent, 5).position.set(x, 2.8, z-0.5);
  box(0.6, 0.6, 0.6, metalMat, parent).position.set(x, 0.3, z-2.3);
  box(0.6, 0.6, 0.6, metalMat, parent).position.set(x, 0.3, z+2.3);
  registerWallCollider(x-1.6, x+1.6, z-2.6, z+2.6);
}

function buildCarnivalStore(parent, x, z, label) {
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
