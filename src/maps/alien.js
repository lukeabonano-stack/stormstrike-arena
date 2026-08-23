// ── maps/alien.js  Alien Planet ───────────────────────────────────────────────
import { scene, pbr, gnd, box, cyl, sph, hemi, cone, grp, addShadow, setFog } from '../engine.js';
import { gs, interactableObjects } from '../state.js';
import { registerWallCollider, registerMapGroup } from './index.js';

const groundMat  = pbr(0x2a1540, 0.92, 0.05);
const darkGround = pbr(0x150a20, 0.95, 0.05);
const rockMat    = pbr(0x5a2870, 0.88, 0.06);
const darkRock   = pbr(0x3a1850, 0.92, 0.05);
const alienStr1  = pbr(0x44ff88, 0.1, 0, { emissive: 0x22dd66, emissiveIntensity: 1.5 });
const alienStr2  = pbr(0x88ff44, 0.1, 0, { emissive: 0x66dd22, emissiveIntensity: 1.5 });
const alienStr3  = pbr(0xff44aa, 0.1, 0, { emissive: 0xdd2288, emissiveIntensity: 1.5 });
const alienStr4  = pbr(0x44aaff, 0.1, 0, { emissive: 0x2288dd, emissiveIntensity: 1.5 });
const crystalMat = pbr(0xaaff44, 0.06, 0.5, { emissive: 0x88dd22, emissiveIntensity: 1 });
const portalMat  = pbr(0x4444ff, 0.05, 0.3, { emissive: 0x2222ff, emissiveIntensity: 2 });
const metalMat   = pbr(0x4a5a70, 0.4, 0.8);
const darkMetal  = pbr(0x223344, 0.45, 0.8);
const organicMat = pbr(0x228840, 0.6, 0.1, { emissive: 0x116620, emissiveIntensity: 0.3 });
const storeMat   = pbr(0x3a2050, 0.7, 0.3);

const GLOW_MATS = [alienStr1, alienStr2, alienStr3, alienStr4];

export function buildAlienMap() {
  const root = grp('alien');
  setFog(0x0a0515, 12, 100);
  gnd(250, 250, groundMat).parent = root;

  const rng = mulberry32(42);

  // Alien terrain: purple/teal ground patterns
  for (let i = 0; i < 30; i++) {
    const px = (rng()*2-1)*110, pz = (rng()*2-1)*110;
    const pr = 5+rng()*15;
    cyl(pr, pr, 0.12, rng()<0.5 ? darkGround : pbr(0x3a2060, 0.9, 0.03), root, 20)
      .position.set(px, 0.06, pz);
  }

  // Alien city structures
  for (let i = 0; i < 18; i++) {
    const ang = (i/18)*Math.PI*2;
    const r = 30+rng()*40;
    const ax = Math.cos(ang)*r, az = Math.sin(ang)*r;
    buildAlienStructure(root, ax, az, rng);
  }

  // Central alien mothership/temple
  buildAlienTemple(root, 0, 0);

  // Alien flora — glowing plants
  for (let i = 0; i < 80; i++) {
    const fx = (rng()*2-1)*100, fz = (rng()*2-1)*100;
    if (Math.hypot(fx, fz) < 15) continue;
    buildAlienPlant(root, fx, fz, rng);
  }

  // Crystal spires (larger versions)
  for (let i = 0; i < 25; i++) {
    const sx = (rng()*2-1)*95, sz = (rng()*2-1)*95;
    if (Math.hypot(sx, sz) < 12) continue;
    const h = 4+rng()*14;
    const crystal = cone(0.8+rng()*1.5, h, crystalMat, root, 8);
    crystal.position.set(sx, h/2, sz);
    crystal.rotation.x = (rng()-0.5)*0.3;
    crystal.rotation.z = (rng()-0.5)*0.3;
    addShadow(crystal);
    if (h > 7) registerWallCollider(sx-1.5, sx+1.5, sz-1.5, sz+1.5);
  }

  // Alien rocks / boulders
  for (let i = 0; i < 40; i++) {
    const rx = (rng()*2-1)*100, rz = (rng()*2-1)*100;
    if (Math.hypot(rx, rz) < 10) continue;
    const rr = 1.5+rng()*4;
    const rock = sph(rr, rng()<0.5 ? rockMat : darkRock, root, 6);
    rock.position.set(rx, rr*0.4, rz);
    rock.scaling.set(1+rng()*0.5, 0.7, 1+rng()*0.5);
    addShadow(rock);
    if (rr > 2.5) registerWallCollider(rx-rr, rx+rr, rz-rr, rz+rr);
  }

  // Crash-landed spacecraft (ruins)
  buildCrashedShip(root, 55, -45, rng);
  buildCrashedShip(root, -50, 55, rng);

  // Portal rings
  for (let i = 0; i < 4; i++) {
    const ang = (i/4)*Math.PI*2;
    const r = 65;
    const px = Math.cos(ang)*r, pz = Math.sin(ang)*r;
    buildPortal(root, px, pz, rng);
  }

  // Alien lava-like rivers (glowing)
  for (let i = 0; i < 5; i++) {
    const angle = rng()*Math.PI*2;
    const r = 20+rng()*40;
    const lx = Math.cos(angle)*r, lz = Math.sin(angle)*r;
    const len = 15+rng()*30;
    const gMat = GLOW_MATS[Math.floor(rng()*4)];
    box(rng()<0.5 ? len : 2, 0.1, rng()<0.5 ? 2 : len, gMat, root).position.set(lx, 0.05, lz);
  }

  // Organic growths (tentacle-like)
  for (let i = 0; i < 20; i++) {
    const ox = (rng()*2-1)*80, oz = (rng()*2-1)*80;
    for (let j = 0; j < 5; j++) {
      const h = 0.5+j*1.2+rng()*1;
      const org = cyl(0.15-j*0.02, 0.2-j*0.02, h, organicMat, root, 5);
      org.position.set(ox+(rng()-0.5)*1.5, h/2, oz+(rng()-0.5)*1.5);
      org.rotation.x = (rng()-0.5)*0.6;
      org.rotation.z = (rng()-0.5)*0.6;
    }
  }

  buildAlienStore(root, -65, -65, 'Xenon Cache');
  buildAlienStore(root,  65,  65, 'Alien Armory');
  buildAlienStore(root, -65,  65, 'Bio Vault');
  buildAlienStore(root,  65, -65, 'Pulse Depot');

  registerMapGroup(root);
  gs.isInsideMapInterior = () => false;
}

function buildAlienTemple(parent, x, z) {
  // Stacked platforms
  for (let i = 0; i < 6; i++) {
    const s = 20-i*2.5;
    const step = box(s, 2, s, i%2===0 ? rockMat : darkRock, parent);
    step.position.set(x, i*2+1, z);
    if (i===0) { addShadow(step); }
  }
  // Central obelisk
  const obelisk = cyl(1.5, 2.5, 15, alienStr1, parent, 8);
  obelisk.position.set(x, 12+7.5, z);
  addShadow(obelisk);
  cone(2.6, 5, alienStr3, parent, 8).position.set(x, 12+15+2.5, z);
  // Orbiting glow spheres
  for (let i = 0; i < 6; i++) {
    const ang = (i/6)*Math.PI*2;
    sph(0.8, GLOW_MATS[i%4], parent, 6).position.set(x+Math.cos(ang)*8, 12+15, z+Math.sin(ang)*8);
  }
  // Antenna array
  for (let i = 0; i < 4; i++) {
    const ang = (i/4)*Math.PI*2;
    const ax = x+Math.cos(ang)*9, az = z+Math.sin(ang)*9;
    cyl(0.3, 0.5, 10, metalMat, parent, 6).position.set(ax, 17, az);
    sph(0.6, GLOW_MATS[i], parent, 5).position.set(ax, 23, az);
  }
}

function buildAlienStructure(parent, x, z, rng) {
  const h = 6+rng()*14;
  const mat = rng()<0.5 ? darkMetal : metalMat;
  // Alien building shape
  if (rng()<0.3) {
    const dome = sph(3+rng()*4, mat, parent, 10);
    dome.position.set(x, h, z);
    cyl(0.8, 1.2, h, mat, parent, 8).position.set(x, h/2, z);
    addShadow(dome);
  } else {
    const bw = 4+rng()*6;
    const bldg = box(bw, h, bw, mat, parent);
    bldg.position.set(x, h/2, z);
    addShadow(bldg);
    // Emissive window strips
    for (let f = 0; f < 3; f++) {
      box(bw+0.05, 0.4, 0.1, GLOW_MATS[f%4], parent).position.set(x, h*0.2+f*h*0.25, z-bw/2);
    }
  }
  registerWallCollider(x-4, x+4, z-4, z+4);
  sph(0.4, GLOW_MATS[Math.floor(rng()*4)], parent, 4).position.set(x, h+2, z);
}

function buildAlienPlant(parent, x, z, rng) {
  const ph = 0.5+rng()*2.5;
  const mat = rng()<0.5 ? alienStr1 : alienStr2;
  cyl(0.08, 0.12, ph, organicMat, parent, 5).position.set(x, ph/2, z);
  sph(0.35+rng()*0.35, mat, parent, 5).position.set(x, ph, z);
  // Leaves
  for (let l = 0; l < 3; l++) {
    const ang = (l/3)*Math.PI*2;
    box(0.08, 0.08, 0.8+rng()*0.8, mat, parent)
      .position.set(x+Math.cos(ang)*0.5, ph*0.7, z+Math.sin(ang)*0.5);
  }
}

function buildCrashedShip(parent, x, z, rng) {
  const body = cyl(5, 4, 12, darkMetal, parent, 12);
  body.position.set(x, 3, z);
  body.rotation.z = 0.5; body.rotation.x = 0.3;
  addShadow(body); registerWallCollider(x-6, x+6, z-6, z+6);
  sph(5.5, pbr(0x223344, 0.06, 0.4, {emissive:0x112244,emissiveIntensity:0.2}), parent, 12)
    .position.set(x, 5, z);
  // Wreckage
  for (let i = 0; i < 8; i++) {
    const wx = x+(rng()-0.5)*14, wz = z+(rng()-0.5)*14;
    box(2+rng()*4, 0.5+rng()*2, 1+rng()*3, metalMat, parent)
      .position.set(wx, rng()*2, wz);
  }
  // Engine glow
  sph(2, alienStr3, parent, 8).position.set(x-4, 1.5, z);
  sph(2, alienStr4, parent, 8).position.set(x, 1, z-4);
}

function buildPortal(parent, x, z, rng) {
  const r = 3+rng()*2;
  cyl(r+0.5, r+0.5, 0.5, portalMat, parent, 20).position.set(x, r+1, z);
  cyl(r, r, 3, pbr(0x6666ff, 0.05, 0.2, {emissive:0x4444ff,emissiveIntensity:0.8}), parent, 20)
    .position.set(x, r+1, z);
  // Frame
  cyl(r+0.6, r+0.6, 0.3, metalMat, parent, 20).position.set(x, r+1, z);
  cyl(r+0.6, r+0.6, 0.3, metalMat, parent, 20).position.set(x, r-0.5, z);
  cyl(0.3, 0.3, r*2, metalMat, parent, 5).position.set(x, r-r+1, z);
  registerWallCollider(x-0.4, x+0.4, z-r-0.8, z+r+0.8);
}

function buildAlienStore(parent, x, z, label) {
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
