// ── maps/underwater.js  Underwater Research Base ──────────────────────────────
import { scene, pbr, gnd, box, cyl, sph, hemi, cone, grp, addShadow, setFog } from '../engine.js';
import { gs, interactableObjects } from '../state.js';
import { registerWallCollider, registerMapGroup } from './index.js';

const sandMat    = pbr(0xb8a870, 0.95, 0);
const coralR     = pbr(0xff5544, 0.6, 0, { emissive: 0xdd3322, emissiveIntensity: 0.4 });
const coralO     = pbr(0xff8833, 0.6, 0, { emissive: 0xdd6611, emissiveIntensity: 0.4 });
const coralP     = pbr(0xdd44cc, 0.6, 0, { emissive: 0xbb22aa, emissiveIntensity: 0.4 });
const coralY     = pbr(0xffee44, 0.55, 0, { emissive: 0xddcc22, emissiveIntensity: 0.4 });
const waterTint  = pbr(0x006688, 0.04, 0.5, { emissive: 0x004455, emissiveIntensity: 0.3 });
const seaweedMat = pbr(0x226633, 0.7, 0, { emissive: 0x114422, emissiveIntensity: 0.2 });
const metalMat   = pbr(0x445566, 0.4, 0.7);
const glassMat   = pbr(0x224466, 0.05, 0.4, { emissive: 0x113355, emissiveIntensity: 0.3 });
const darkMetal  = pbr(0x223344, 0.45, 0.8);
const glowBlue   = pbr(0x2288ff, 0.1, 0, { emissive: 0x1166ff, emissiveIntensity: 2 });
const glowGreen  = pbr(0x22ff88, 0.1, 0, { emissive: 0x11dd66, emissiveIntensity: 2 });
const ruinMat    = pbr(0x6a7060, 0.88, 0.03);
const storeMat   = pbr(0x334455, 0.6, 0.5);

const CORAL_MATS = [coralR, coralO, coralP, coralY];

export function buildUnderwaterMap() {
  const root = grp('underwater');
  setFog(0x001a2a, 10, 90);
  gnd(250, 250, sandMat).parent = root;

  const rng = mulberry32(414);

  // Water volume tint (dome over everything)
  const waterDome = sph(130, waterTint, root, 14);
  waterDome.position.set(0, 30, 0);
  waterDome.scaling.y = 0.55;

  // RESEARCH BASE COMPLEX
  buildResearchBase(root, 0, 0);

  // Submarine dock
  buildSubmarineDock(root, -50, 0);

  // Coral reef zones
  for (let i = 0; i < 10; i++) {
    const cx = (rng()*2-1)*90, cz = (rng()*2-1)*90;
    if (Math.hypot(cx, cz) < 20) continue;
    buildCoralReef(root, cx, cz, rng);
  }

  // Seaweed forests
  for (let i = 0; i < 60; i++) {
    const sx = (rng()*2-1)*100, sz = (rng()*2-1)*100;
    if (Math.hypot(sx, sz) < 15) continue;
    const h = 1+rng()*5;
    const sw = cyl(0.08+rng()*0.15, 0.12, h, seaweedMat, root, 4);
    sw.position.set(sx, h/2, sz);
    sw.rotation.x = (rng()-0.5)*0.5;
    sw.rotation.z = (rng()-0.5)*0.5;
  }

  // Bioluminescent creatures (just glowing spheres)
  for (let i = 0; i < 35; i++) {
    const bx = (rng()*2-1)*100, bz = (rng()*2-1)*100;
    const by = 0.5+rng()*5;
    const mat = rng()<0.5 ? glowBlue : glowGreen;
    const bio = sph(0.25+rng()*0.5, mat, root, 5);
    bio.position.set(bx, by, bz);
  }

  // Rocks / boulders on sea floor
  for (let i = 0; i < 40; i++) {
    const rx = (rng()*2-1)*100, rz = (rng()*2-1)*100;
    if (Math.hypot(rx, rz) < 18) continue;
    const rr = 1+rng()*5;
    const rock = sph(rr, pbr(0x4a5a6a, 0.88, 0.05), root, 6);
    rock.position.set(rx, rr*0.3, rz);
    rock.scaling.set(1+rng()*0.5, 0.55, 1+rng()*0.5);
    addShadow(rock);
    if (rr > 2) registerWallCollider(rx-rr, rx+rr, rz-rr, rz+rr);
  }

  // Sunken shipwreck
  buildShipwreck(root, 55, -40, rng);

  // Thermal vents
  for (let i = 0; i < 8; i++) {
    const vx = (rng()*2-1)*85, vz = (rng()*2-1)*85;
    if (Math.hypot(vx, vz) < 20) continue;
    const vent = cyl(0.6, 1, 3, pbr(0x334444, 0.8, 0.3), root, 8);
    vent.position.set(vx, 1.5, vz);
    // Bubble columns
    for (let b = 0; b < 6; b++) {
      sph(0.15+rng()*0.2, glowBlue, root, 4).position.set(vx+(rng()-0.5)*0.5, 3+b*1.5, vz+(rng()-0.5)*0.5);
    }
  }

  // Submarine cables
  for (let i = 0; i < 10; i++) {
    const cLen = 20+rng()*40;
    const cx = (rng()*2-1)*70, cz = (rng()*2-1)*70;
    const cable = box(cLen, 0.15, 0.15, darkMetal, root);
    cable.position.set(cx, 0.1+rng()*2, cz);
    cable.rotation.y = rng()*Math.PI;
  }

  buildUnderwaterStore(root, 55, 55, 'Deep Sea Cache');
  buildUnderwaterStore(root, -55, 55, 'Aqua Armory');
  buildUnderwaterStore(root, 55, -55, 'Reef Depot');
  buildUnderwaterStore(root, -55, -55, 'Abyss Vault');

  registerMapGroup(root);
  gs.isInsideMapInterior = () => false;
}

function buildResearchBase(parent, x, z) {
  // Main central hub dome
  const dome = sph(16, glassMat, parent, 14);
  dome.position.set(x, 0, z);
  dome.scaling.y = 0.6;
  addShadow(dome);

  // Connecting tubes to modules
  for (const [dx, dz] of [[-30,0],[30,0],[0,-30],[0,30]]) {
    const tube = cyl(3, 3, 14, metalMat, parent, 12);
    tube.position.set(x+dx*0.5, 2, z+dz*0.5);
    if (dx !== 0) { tube.rotation.z = Math.PI/2; }
    else { tube.rotation.x = Math.PI/2; }
    addShadow(tube);

    // Module at end of tube
    const mod = cyl(7, 7, 8, metalMat, parent, 14);
    mod.position.set(x+dx, 4, z+dz);
    addShadow(mod); registerWallCollider(x+dx-7, x+dx+7, z+dz-7, z+dz+7);
    const modDome = sph(7.2, glassMat, parent, 10);
    modDome.position.set(x+dx, 8.2, z+dz); modDome.scaling.y = 0.35;

    // Interior lights
    for (let i = 0; i < 4; i++) {
      const ang = (i/4)*Math.PI*2;
      sph(0.4, glowBlue, parent, 4)
        .position.set(x+dx+Math.cos(ang)*5.5, 5, z+dz+Math.sin(ang)*5.5);
    }
  }

  // Central power core
  cyl(2, 2, 8, glowBlue, parent, 10).position.set(x, 4, z);
  sph(2.5, pbr(0x2266ff, 0.05, 0.3, {emissive:0x1144ff,emissiveIntensity:0.8}), parent, 10)
    .position.set(x, 8, z);
}

function buildSubmarineDock(parent, x, z) {
  // Dock platform
  const dock = box(40, 1, 20, metalMat, parent);
  dock.position.set(x, 0.5, z);
  addShadow(dock);
  registerWallCollider(x-20, x+20, z-10, z+10);

  // Submarine hull
  const hull = cyl(4, 4, 25, darkMetal, parent, 16);
  hull.rotation.z = Math.PI/2; hull.position.set(x, 2, z);
  addShadow(hull);
  // Conning tower
  box(3, 5, 3, darkMetal, parent).position.set(x, 5, z);
  // Periscope
  cyl(0.2, 0.2, 4, metalMat, parent, 5).position.set(x+0.8, 7.5, z);
  sph(0.4, glowBlue, parent, 4).position.set(x+0.8, 10, z);
  // Propeller
  for (let i = 0; i < 4; i++) {
    const ang = (i/4)*Math.PI*2;
    box(0.3, 2, 0.3, metalMat, parent)
      .position.set(x-13+Math.cos(ang)*1.5, 2+Math.sin(ang)*1.5, z);
  }
}

function buildCoralReef(parent, x, z, rng) {
  const count = 5+Math.floor(rng()*10);
  for (let i = 0; i < count; i++) {
    const cx = x+(rng()-0.5)*8, cz = z+(rng()-0.5)*8;
    const h = 0.5+rng()*4;
    const mat = CORAL_MATS[Math.floor(rng()*4)];
    if (rng()<0.5) {
      const coral = cone(0.3+rng()*0.8, h, mat, parent, 8);
      coral.position.set(cx, h/2, cz);
      coral.rotation.x = (rng()-0.5)*0.3;
    } else {
      const branch = cyl(0.15, 0.3, h, mat, parent, 6);
      branch.position.set(cx, h/2, cz);
      branch.rotation.z = (rng()-0.5)*0.4;
      sph(0.5+rng()*0.5, mat, parent, 5).position.set(cx, h, cz);
    }
  }
  if (rng()<0.5) registerWallCollider(x-3, x+3, z-3, z+3);
}

function buildShipwreck(parent, x, z, rng) {
  const hull = box(7, 4, 25, ruinMat, parent);
  hull.position.set(x, 1, z);
  hull.rotation.z = 0.3; hull.rotation.y = 0.4;
  addShadow(hull); registerWallCollider(x-8, x+8, z-13, z+13);
  // Mast
  cyl(0.3, 0.4, 12, ruinMat, parent, 6).position.set(x+2, 5, z-5);
  // Broken boom
  box(0.3, 0.3, 8, ruinMat, parent).position.set(x+2+2, 8, z-5+1);
  // Coral on wreck
  for (let i = 0; i < 12; i++) {
    const wx = x+(rng()-0.5)*12, wz = z+(rng()-0.5)*20;
    sph(0.5+rng()*0.8, CORAL_MATS[Math.floor(rng()*4)], parent, 5).position.set(wx, rng()*3, wz);
  }
  // Treasure chest
  box(1.5, 1, 1, pbr(0x5a3810, 0.8, 0.05), parent).position.set(x-3, 0.5, z+5);
  sph(0.6, pbr(0xffd700, 0.15, 0.9, {emissive:0xffcc00,emissiveIntensity:0.5}), parent, 5)
    .position.set(x-3, 1.3, z+5);
}

function buildUnderwaterStore(parent, x, z, label) {
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
