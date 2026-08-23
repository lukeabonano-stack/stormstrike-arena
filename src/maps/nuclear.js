// ── maps/nuclear.js  Nuclear Power Plant ──────────────────────────────────────
import { scene, pbr, gnd, box, cyl, sph, cone, grp, addShadow, setFog } from '../engine.js';
import { gs, interactableObjects } from '../state.js';
import { registerWallCollider, registerMapGroup } from './index.js';

const concMat   = pbr(0x888878, 0.90, 0.04);
const darkConc  = pbr(0x444440, 0.92, 0.04);
const steelMat  = pbr(0x7a8898, 0.45, 0.7);
const pipeMat   = pbr(0x556677, 0.5, 0.65);
const hazardY   = pbr(0xffcc00, 0.55, 0.1);
const glowGreen = pbr(0x44ff44, 0.1, 0, { emissive: 0x22ff22, emissiveIntensity: 2.5 });
const glowRed   = pbr(0xff2200, 0.1, 0, { emissive: 0xff0000, emissiveIntensity: 2.5 });
const glowOrange= pbr(0xff8800, 0.1, 0, { emissive: 0xff6600, emissiveIntensity: 2 });
const waterMat  = pbr(0x226633, 0.06, 0.4, { emissive: 0x114422, emissiveIntensity: 0.2 });
const fenceMat  = pbr(0x6a7880, 0.6, 0.4);
const rustMat   = pbr(0x5a3020, 0.85, 0.35);
const smokeMat  = pbr(0x444440, 0.96, 0);
const storeMat  = pbr(0x445566, 0.6, 0.5);

export function buildNuclearMap() {
  const root = grp('nuclear');
  setFog(0x101818, 18, 120);
  gnd(260, 260, darkConc).parent = root;

  const rng = mulberry32(3141);

  // Concrete grounds
  for (let gx = -100; gx <= 100; gx += 40) {
    for (let gz = -100; gz <= 100; gz += 40) {
      box(39, 0.06, 39, concMat, root).position.set(gx, 0.03, gz);
    }
  }

  // MAIN REACTOR BUILDING
  buildReactorBuilding(root, 0, -10);

  // 4 COOLING TOWERS (iconic)
  buildCoolingTower(root, -50, -30, rng);
  buildCoolingTower(root,  50, -30, rng);
  buildCoolingTower(root, -50,  30, rng);
  buildCoolingTower(root,  50,  30, rng);

  // Turbine hall
  buildTurbineHall(root, 0, 45);

  // Spent fuel pools
  for (const [px, pz] of [[-30, -65],[30, -65]]) {
    buildFuelPool(root, px, pz, rng);
  }

  // Perimeter fence
  buildSecurityFence(root);

  // Guard posts
  for (const [gx, gz] of [[-90,-90],[-90,90],[90,-90],[90,90]]) {
    buildGuardPost(root, gx, gz);
  }

  // Pipeline maze
  for (let i = 0; i < 20; i++) {
    const px = (rng()*2-1)*80, pz = (rng()*2-1)*80;
    const ph = 1+rng()*4, pLen = 10+rng()*30;
    if (rng()<0.5) {
      cyl(0.5, 0.5, pLen, pipeMat, root, 8).position.set(px, ph, pz);
    } else {
      const horiz = cyl(0.5, 0.5, pLen, pipeMat, root, 8);
      horiz.rotation.z = Math.PI/2; horiz.position.set(px, ph, pz);
    }
    cyl(0.7, 0.7, 0.5, steelMat, root, 8).position.set(px, ph, pz);
  }

  // Hazard barrels
  for (let i = 0; i < 35; i++) {
    const bx = (rng()*2-1)*85, bz = (rng()*2-1)*85;
    const barrel = cyl(0.45, 0.45, 1, i%3===0 ? hazardY : steelMat, root, 10);
    barrel.position.set(bx, 0.5, bz);
    addShadow(barrel);
  }

  // Warning signs
  for (let i = 0; i < 20; i++) {
    const wx = (rng()*2-1)*85, wz = (rng()*2-1)*85;
    cyl(0.06, 0.06, 3, steelMat, root, 4).position.set(wx, 1.5, wz);
    box(1.5, 1.5, 0.1, hazardY, root).position.set(wx, 3.2, wz);
    sph(0.3, glowRed, root, 4).position.set(wx, 3.8, wz);
  }

  // Radiation puddles (glowing green)
  for (let i = 0; i < 12; i++) {
    const rx = (rng()*2-1)*80, rz2 = (rng()*2-1)*80;
    const rr = 2+rng()*5;
    cyl(rr, rr, 0.15, glowGreen, root, 16).position.set(rx, 0.07, rz2);
    registerWallCollider(rx-rr, rx+rr, rz2-rr, rz2+rr);
  }

  // Power lines
  for (let i = 0; i < 8; i++) {
    const px = (rng()*2-1)*90;
    const ph = 10+rng()*8;
    cyl(0.18, 0.22, ph, concMat, root, 6).position.set(px, ph/2, (rng()*2-1)*90);
    sph(0.35, glowOrange, root, 4).position.set(px, ph+0.5, (rng()-0.5)*2);
    for (let w = 0; w < 3; w++) {
      box(15, 0.06, 0.06, fenceMat, root).position.set(px, ph-w*1.5, 0);
    }
  }

  buildNuclearStore(root, -75, 70, 'Reactor Cache');
  buildNuclearStore(root,  75, 70, 'Turbine Vault');
  buildNuclearStore(root, -75, -70, 'Control Armory');
  buildNuclearStore(root,  75, -70, 'Hazmat Depot');

  registerMapGroup(root);
  gs.isInsideMapInterior = () => false;
}

function buildReactorBuilding(parent, x, z) {
  // Main containment dome
  const dome = sph(18, concMat, parent, 14);
  dome.position.set(x, 0, z);
  dome.scaling.y = 0.8;
  addShadow(dome);

  // Reactor ring
  cyl(19, 19, 1.2, steelMat, parent, 24).position.set(x, 0.6, z);

  // Containment building box
  const containment = box(35, 20, 30, concMat, parent);
  containment.position.set(x, 10, z);
  addShadow(containment);

  // Reactor core glow (top)
  sph(6, pbr(0x00ff88, 0.05, 0, {emissive:0x00dd66,emissiveIntensity:1.2}), parent, 10)
    .position.set(x, 17, z);

  // Intake/exhaust stacks
  for (const [dx, dz] of [[-20,0],[20,0],[0,-15],[0,15]]) {
    const stack = cyl(2, 2.5, 25, concMat, parent, 10);
    stack.position.set(x+dx, 12.5, z+dz);
    addShadow(stack);
    registerWallCollider(x+dx-3, x+dx+3, z+dz-3, z+dz+3);
    sph(0.6, glowRed, parent, 5).position.set(x+dx, 26, z+dz);
  }

  // Control room window
  for (let i = 0; i < 8; i++) {
    box(3, 1.5, 0.2, pbr(0x44aa66, 0.1, 0.3, {emissive:0x33aa55,emissiveIntensity:0.5}), parent)
      .position.set(x-10.5+i*3, 12, z+15.1);
  }

  // Catwalks
  box(35, 0.3, 1.5, steelMat, parent).position.set(x, 20.15, z);
  box(1.5, 0.3, 30, steelMat, parent).position.set(x, 20.15, z);
}

function buildCoolingTower(parent, x, z, rng) {
  // Hyperbolic cooling tower shape
  for (let i = 0; i < 8; i++) {
    const t = i/7;
    const r = 10-Math.sin(t*Math.PI)*4; // narrower in middle
    const h = 2;
    cyl(r, r, h, concMat, parent, 16).position.set(x, i*h+h/2, z);
  }
  const towerBase = cyl(10, 10, 2, concMat, parent, 16);
  towerBase.position.set(x, 1, z);
  addShadow(towerBase);
  registerWallCollider(x-11, x+11, z-11, z+11);

  // Steam output
  for (let s = 0; s < 8; s++) {
    sph(2+s*0.5, smokeMat, parent, 6)
      .position.set(x+(rng()-0.5)*s, 17+s*2.5, z+(rng()-0.5)*s);
  }
  sph(0.6, glowOrange, parent, 5).position.set(x, 17.5, z);
}

function buildTurbineHall(parent, x, z) {
  const hall = box(60, 16, 25, steelMat, parent);
  hall.position.set(x, 8, z);
  addShadow(hall);
  registerWallCollider(x-30, x+30, z-12.5, z+12.5);
  // Turbine cylinders
  for (let i = -2; i <= 2; i++) {
    cyl(4, 4, 30, steelMat, parent, 12).position.set(x+i*11, 4, z);
    sph(4.2, glowOrange, parent, 10).position.set(x+i*11, 4, z-15.5);
    sph(4.2, glowOrange, parent, 10).position.set(x+i*11, 4, z+15.5);
  }
  // Exhaust pipes on roof
  for (let i = -2; i <= 2; i++) {
    cyl(1.2, 1.5, 8, pipeMat, parent, 8).position.set(x+i*11, 20, z);
    sph(0.5, glowRed, parent, 4).position.set(x+i*11, 25, z);
  }
}

function buildFuelPool(parent, x, z, rng) {
  const pool = box(14, 3, 10, concMat, parent);
  pool.position.set(x, 1.5, z);
  addShadow(pool);
  registerWallCollider(x-7, x+7, z-5, z+5);
  // Water inside
  box(12, 0.2, 8, waterMat, parent).position.set(x, 3.1, z);
  // Glow
  box(12, 0.1, 8, pbr(0x00ff88, 0.05, 0, {emissive:0x00dd66,emissiveIntensity:0.5}), parent)
    .position.set(x, 3.15, z);
  // Fuel rods
  for (let i = 0; i < 15; i++) {
    cyl(0.15, 0.15, 3, glowGreen, parent, 5).position.set(x+(rng()-0.5)*10, 1.8, z+(rng()-0.5)*6);
  }
}

function buildSecurityFence(parent) {
  for (const [fx, fz, fw, fd] of [
    [0, -95, 200, 0.5],
    [0,  95, 200, 0.5],
    [-95, 0, 0.5, 200],
    [ 95, 0, 0.5, 200],
  ]) {
    box(fw, 5, fd, fenceMat, parent).position.set(fx, 2.5, fz);
    registerWallCollider(fx-fw/2, fx+fw/2, fz-fd/2, fz+fd/2);
    // Barbed wire
    box(fw, 0.1, 0.1, steelMat, parent).position.set(fx, 5.5, fz-0.3);
    box(fw, 0.1, 0.1, steelMat, parent).position.set(fx, 5.5, fz+0.3);
  }
  // Gate
  box(10, 5, 0.5, hazardY, parent).position.set(0, 2.5, -95);
  sph(0.6, glowRed, parent, 4).position.set(-6, 5.5, -95);
  sph(0.6, glowRed, parent, 4).position.set(6, 5.5, -95);
}

function buildGuardPost(parent, x, z) {
  const post = box(5, 6, 5, concMat, parent);
  post.position.set(x, 3, z);
  addShadow(post);
  registerWallCollider(x-2.5, x+2.5, z-2.5, z+2.5);
  box(6, 0.4, 6, steelMat, parent).position.set(x, 6.2, z);
  sph(0.5, glowOrange, parent, 5).position.set(x, 7.2, z);
  box(5, 1.5, 0.2, pbr(0x33aa55, 0.1, 0.2), parent).position.set(x, 4, z-2.6);
}

function buildNuclearStore(parent, x, z, label) {
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
