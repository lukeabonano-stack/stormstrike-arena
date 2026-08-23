// ── maps/jungle.js  Amazon Rainforest ────────────────────────────────────────
import { scene, pbr, gnd, box, cyl, sph, hemi, cone, grp, addShadow, setFog } from '../engine.js';
import { gs, interactableObjects } from '../state.js';
import { registerWallCollider, registerMapGroup } from './index.js';

const groundMat  = pbr(0x1a3010, 0.98, 0);
const dirtMat    = pbr(0x3a2010, 0.98, 0);
const leaf1Mat   = pbr(0x1a6010, 0.75, 0);
const leaf2Mat   = pbr(0x2a8020, 0.72, 0);
const leaf3Mat   = pbr(0x3aaa28, 0.70, 0);
const trunkMat   = pbr(0x5a3510, 0.88, 0.01);
const vineMat    = pbr(0x2a5a10, 0.85, 0);
const riverMat   = pbr(0x1a4428, 0.05, 0.35);
const rockMat    = pbr(0x6a6058, 0.88, 0.03);
const ruinMat    = pbr(0x6a6848, 0.88, 0.02);
const mushroomMat= pbr(0xdd4422, 0.6, 0, { emissive: 0xaa2200, emissiveIntensity: 0.3 });
const glowVineMat= pbr(0x22aa44, 0.5, 0, { emissive: 0x00ff44, emissiveIntensity: 0.4 });
const storeMat   = pbr(0x4a3820, 0.85, 0.02);

export function buildJungleMap() {
  const root = grp('jungle');
  setFog(0x0a2008, 10, 90);
  gnd(240, 240, groundMat).parent = root;

  const rng = mulberry32(246);

  // River running through
  const river1 = box(18, 0.12, 220, riverMat, root);
  river1.position.set(-25, 0.05, 0);
  const river2 = box(220, 0.12, 14, riverMat, root);
  river2.position.set(0, 0.05, 30);

  // DENSE jungle canopy — lots of trees
  for (let i = 0; i < 120; i++) {
    const tx = (rng()*2-1)*108, tz = (rng()*2-1)*108;
    if (Math.abs(tx+25) < 10 || (Math.abs(tz-30) < 8 && tx > -15)) continue;
    if (Math.hypot(tx, tz) < 8) continue;
    buildJungleTree(root, tx, tz, rng);
  }

  // Giant trees (landmark)
  for (let i = 0; i < 8; i++) {
    const ang = (i/8)*Math.PI*2;
    const r = 35+rng()*20;
    buildGiantTree(root, Math.cos(ang)*r, Math.sin(ang)*r, rng);
  }

  // Undergrowth bushes
  for (let i = 0; i < 80; i++) {
    const bx = (rng()*2-1)*100, bz = (rng()*2-1)*100;
    if (Math.abs(bx+25)<9) continue;
    const r = 0.8+rng()*1.5;
    const bush = sph(r, rng()<0.5 ? leaf1Mat : leaf2Mat, root, 5);
    bush.position.set(bx, r*0.5, bz);
    bush.scaling.y = 0.6;
  }

  // Vines hanging from trees
  for (let i = 0; i < 40; i++) {
    const vx = (rng()*2-1)*90, vz = (rng()*2-1)*90;
    const vh = 3+rng()*6;
    cyl(0.06, 0.08, vh, rng()<0.3 ? glowVineMat : vineMat, root, 4)
      .position.set(vx, vh/2+2, vz);
  }

  // Ancient ruins
  buildJungleRuins(root, 40, -30);
  buildJungleRuins(root, -50, 50);
  buildJungleRuins(root, 55, 55);

  // Bamboo clusters
  for (let i = 0; i < 20; i++) {
    const bx = (rng()*2-1)*85, bz = (rng()*2-1)*85;
    for (let j = 0; j < 6; j++) {
      const h = 5+rng()*6;
      const stalk = cyl(0.15, 0.18, h, leaf2Mat, root, 5);
      stalk.position.set(bx+(rng()-0.5)*2, h/2, bz+(rng()-0.5)*2);
    }
  }

  // Giant mushrooms
  for (let i = 0; i < 18; i++) {
    const mx = (rng()*2-1)*85, mz = (rng()*2-1)*85;
    const mh = 1.5+rng()*2;
    cyl(0.2, 0.25, mh, trunkMat, root, 6).position.set(mx, mh/2, mz);
    const cap = sph(0.8+rng()*0.8, mushroomMat, root, 7);
    cap.position.set(mx, mh, mz);
    cap.scaling.set(1.2, 0.55, 1.2);
  }

  // Rocks & boulders
  for (let i = 0; i < 25; i++) {
    const rx = (rng()*2-1)*90, rz = (rng()*2-1)*90;
    if (Math.abs(rx+25)<10) continue;
    const rw = 1+rng()*3, rh = 0.8+rng()*2;
    const rock = sph(rw, rockMat, root, 6);
    rock.position.set(rx, rh*0.4, rz);
    rock.scaling.set(1, 0.55, 1);
    addShadow(rock);
    if (rw > 1.5) registerWallCollider(rx-rw, rx+rw, rz-rw, rz+rw);
  }

  // Dirt path
  const path = box(5, 0.06, 200, dirtMat, root);
  path.position.set(0, 0.04, 0);

  buildJungleStore(root,  55, -55, 'Jungle Cache');
  buildJungleStore(root, -60, -55, 'River Armory');
  buildJungleStore(root,   5,  65, 'Canopy Vault');
  buildJungleStore(root, -60,  10, 'Ruins Depot');

  registerMapGroup(root);
  gs.isInsideMapInterior = () => false;
}

function buildJungleTree(parent, x, z, rng) {
  const h = 6+rng()*8;
  const trunk = cyl(0.3, 0.45, h, trunkMat, parent, 6);
  trunk.position.set(x, h/2, z);
  addShadow(trunk);
  for (let c = 0; c < 3; c++) {
    const r = 2+rng()*2;
    const mat = [leaf1Mat, leaf2Mat, leaf3Mat][c];
    const crown = sph(r, mat, parent, 7);
    crown.position.set(x+(rng()-0.5)*r, h-c*0.8, z+(rng()-0.5)*r);
    crown.scaling.y = 0.75;
    addShadow(crown);
  }
}

function buildGiantTree(parent, x, z, rng) {
  const h = 18+rng()*12;
  const trunk = cyl(1, 1.5, h, trunkMat, parent, 8);
  trunk.position.set(x, h/2, z);
  addShadow(trunk); registerWallCollider(x-1.6, x+1.6, z-1.6, z+1.6);
  // Massive canopy layers
  for (let c = 0; c < 4; c++) {
    const r = 6-c*0.8;
    const mat = c%2===0 ? leaf1Mat : leaf2Mat;
    const crown = sph(r, mat, parent, 9);
    crown.position.set(x+(rng()-0.5)*2, h-c*2.5+2, z+(rng()-0.5)*2);
    crown.scaling.y = 0.65;
    addShadow(crown);
  }
  // Buttress roots
  for (let i = 0; i < 5; i++) {
    const ang = (i/5)*Math.PI*2;
    const root2 = box(0.4, 2, 3, trunkMat, parent);
    root2.position.set(x+Math.cos(ang)*2, 1, z+Math.sin(ang)*2);
    root2.rotation.y = ang;
    root2.rotation.z = 0.3;
  }
}

function buildJungleRuins(parent, x, z) {
  // Stepped pyramid
  for (let i = 0; i < 5; i++) {
    const s = 10-i*1.8, h = 1.2;
    const step = box(s, h, s, ruinMat, parent);
    step.position.set(x, i*h+h/2, z);
    if (i===0) { addShadow(step); registerWallCollider(x-5,x+5,z-5,z+5); }
  }
  // Pillars around
  for (let i = 0; i < 4; i++) {
    const ang = (i/4)*Math.PI*2;
    cyl(0.5, 0.6, 5, ruinMat, parent, 8).position.set(x+Math.cos(ang)*7, 2.5, z+Math.sin(ang)*7);
  }
  // Overgrown vine
  const vine = box(0.15, 8, 0.15, glowVineMat, parent);
  vine.position.set(x+4, 4, z+4);
}

function buildJungleStore(parent, x, z, label) {
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
