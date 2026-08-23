// ── maps/factory.js  Industrial Factory ───────────────────────────────────────
import { scene, pbr, gnd, box, cyl, sph, cone, grp, addShadow, setFog } from '../engine.js';
import { gs, interactableObjects } from '../state.js';
import { registerWallCollider, registerMapGroup } from './index.js';

const concMat   = pbr(0x555550, 0.90, 0.04);
const darkConc  = pbr(0x333330, 0.92, 0.04);
const steelMat  = pbr(0x7a8090, 0.45, 0.75);
const rustMat   = pbr(0x6a3818, 0.82, 0.4);
const pipeMat   = pbr(0x556070, 0.5, 0.65);
const yellowMat = pbr(0xffcc00, 0.6, 0.1);
const hazardMat = pbr(0xff6600, 0.5, 0.1, { emissive: 0xdd4400, emissiveIntensity: 0.6 });
const smokeMat  = pbr(0x444440, 0.95, 0);
const glowGreen = pbr(0x00ff44, 0.1, 0, { emissive: 0x00dd22, emissiveIntensity: 1.5 });
const glowRed   = pbr(0xff2200, 0.1, 0, { emissive: 0xdd0000, emissiveIntensity: 1.5 });
const hotMetal  = pbr(0xff6600, 0.2, 0.5, { emissive: 0xff4400, emissiveIntensity: 0.8 });
const storeMat  = pbr(0x445055, 0.6, 0.5);

export function buildFactoryMap() {
  const root = grp('factory');
  setFog(0x1a1810, 15, 110);
  gnd(240, 240, darkConc).parent = root;

  const rng = mulberry32(999);

  // Factory floor concrete slabs
  for (let fx = -90; fx <= 90; fx += 30) {
    for (let fz = -90; fz <= 90; fz += 30) {
      box(29, 0.06, 29, concMat, root).position.set(fx, 0.03, fz);
    }
  }

  // MAIN FACTORY BUILDING — left side
  buildFactoryBuilding(root, -40, 0, 50, 20, 30, rng);
  // WAREHOUSE — right side
  buildFactoryBuilding(root, 45, 15, 40, 12, 40, rng);

  // Cooling towers
  buildCoolingTower(root, -75, -50, rng);
  buildCoolingTower(root, -75, 50, rng);

  // Smokestacks
  for (const [sx, sz] of [[-40, -25], [-40, 25], [45, -20], [45, 20]]) {
    const h = 18+rng()*10;
    const stack = cyl(1.8, 2.5, h, concMat, root, 10);
    stack.position.set(sx, h/2, sz);
    addShadow(stack);
    registerWallCollider(sx-2.6, sx+2.6, sz-2.6, sz+2.6);
    // Smoke puffs
    for (let s = 0; s < 5; s++) {
      sph(1+s*0.4, smokeMat, root, 5).position.set(sx+(rng()-0.5)*s*0.5, h+1+s*2, sz+(rng()-0.5)*s*0.5);
    }
    // Warning ring
    cyl(2.7, 2.7, 0.5, hazardMat, root, 10).position.set(sx, h-2, sz);
    sph(0.5, glowRed, root, 4).position.set(sx, h+1, sz);
  }

  // Pipeline network
  for (let i = 0; i < 18; i++) {
    const px = (rng()*2-1)*85, pz = (rng()*2-1)*85;
    const ph = 1.5+rng()*2.5;
    const pLen = 8+rng()*25;
    if (rng() < 0.5) {
      cyl(0.55, 0.55, pLen, pipeMat, root, 8).position.set(px, ph, pz);
    } else {
      const horiz = cyl(0.55, 0.55, pLen, pipeMat, root, 8);
      horiz.rotation.z = Math.PI/2; horiz.position.set(px, ph, pz);
    }
    // Pipe joint
    cyl(0.75, 0.75, 0.6, rustMat, root, 8).position.set(px, ph, pz);
  }

  // Conveyor belts
  for (let i = 0; i < 6; i++) {
    const cx = (rng()*2-1)*60, cz = (rng()*2-1)*60;
    const cLen = 12+rng()*20;
    if (Math.hypot(cx, cz) < 18) continue;
    const conv = box(cLen, 0.5, 2.5, steelMat, root);
    conv.position.set(cx, 1.25, cz);
    addShadow(conv);
    registerWallCollider(cx-cLen/2, cx+cLen/2, cz-1.3, cz+1.3);
    box(cLen, 0.2, 2.3, yellowMat, root).position.set(cx, 1.56, cz);
    // Support legs
    for (let l = 0; l < 4; l++) {
      cyl(0.25, 0.3, 1.2, steelMat, root, 5).position.set(cx-cLen/2+l*(cLen/3), 0.6, cz);
    }
  }

  // Storage tanks
  for (let i = 0; i < 10; i++) {
    const tx = (rng()*2-1)*80, tz = (rng()*2-1)*80;
    if (Math.hypot(tx, tz) < 25) continue;
    const r = 3+rng()*4, h = 6+rng()*10;
    const tank = cyl(r, r, h, steelMat, root, 12);
    tank.position.set(tx, h/2, tz);
    hemi(r+0.1, steelMat, root, 10).position.set(tx, h, tz);
    addShadow(tank);
    registerWallCollider(tx-r-0.2, tx+r+0.2, tz-r-0.2, tz+r+0.2);
    if (rng()<0.4) sph(0.4, glowRed, root, 4).position.set(tx, h+r+0.2, tz);
  }

  // Crane structure
  buildCrane(root, 10, -60);

  // Hazard barrels
  for (let i = 0; i < 30; i++) {
    const bx = (rng()*2-1)*85, bz = (rng()*2-1)*85;
    const barrel = cyl(0.45, 0.45, 1, hazardMat, root, 10);
    barrel.position.set(bx, 0.5, bz);
    addShadow(barrel);
  }

  // Catwalks
  for (let i = 0; i < 5; i++) {
    const cwx = (rng()*2-1)*60, cwz = (rng()*2-1)*60;
    const cwLen = 10+rng()*20, cwH = 4+rng()*5;
    box(cwLen, 0.3, 1.5, steelMat, root).position.set(cwx, cwH, cwz);
    cyl(0.15, 0.15, cwH, steelMat, root, 4).position.set(cwx-cwLen/2, cwH/2, cwz);
    cyl(0.15, 0.15, cwH, steelMat, root, 4).position.set(cwx+cwLen/2, cwH/2, cwz);
  }

  // Molten metal rivers
  for (let i = 0; i < 4; i++) {
    const mx = (rng()-0.5)*100, mz = (rng()-0.5)*100;
    box(20+rng()*30, 0.1, 1.5, hotMetal, root).position.set(mx, 0.05, mz);
  }

  buildFactoryStore(root, -75, 70, 'Tool Depot');
  buildFactoryStore(root,  70, 70, 'Steel Vault');
  buildFactoryStore(root, -75, -70, 'Boiler Cache');
  buildFactoryStore(root,  70, -70, 'Machine Armory');

  registerMapGroup(root);
  gs.isInsideMapInterior = () => false;
}

function buildFactoryBuilding(parent, x, z, w, h, d, rng) {
  const b = box(w, h, d, steelMat, parent);
  b.position.set(x, h/2, z);
  addShadow(b); registerWallCollider(x-w/2, x+w/2, z-d/2, z+d/2);
  // Window rows
  for (let fl = 0; fl < 3; fl++) {
    for (let wi = -2; wi <= 2; wi++) {
      box(w+0.04, 1.2, 0.12, pbr(0x445566, 0.1, 0.3, {emissive:0x334455,emissiveIntensity:0.3}), parent)
        .position.set(x, h*0.3+fl*h*0.2, z-d/2);
    }
  }
  // Roof equipment
  for (let i = 0; i < 4; i++) {
    box(3, 1.5, 3, darkConc, parent).position.set(x+(rng()-0.5)*w*0.6, h+0.75, z+(rng()-0.5)*d*0.6);
  }
  // Entry door markers
  box(5, h*0.4, 0.3, pipeMat, parent).position.set(x, h*0.2, z-d/2);
  sph(0.4, glowGreen, parent, 4).position.set(x, h*0.45, z-d/2);
}

function buildCoolingTower(parent, x, z, rng) {
  const tower = cyl(8, 12, 25, concMat, parent, 16);
  tower.position.set(x, 12.5, z);
  addShadow(tower);
  registerWallCollider(x-12, x+12, z-12, z+12);
  // Top ring
  cyl(9, 9, 1.2, darkConc, parent, 16).position.set(x, 25.6, z);
  // Steam clouds
  for (let s = 0; s < 6; s++) {
    sph(3+s*0.5, smokeMat, parent, 6).position.set(x+(rng()-0.5)*3, 27+s*2.5, z+(rng()-0.5)*3);
  }
}

function buildCrane(parent, x, z) {
  const mast = cyl(0.8, 1, 22, steelMat, parent, 6);
  mast.position.set(x, 11, z);
  addShadow(mast);
  registerWallCollider(x-1, x+1, z-1, z+1);
  box(25, 0.8, 0.8, steelMat, parent).position.set(x+5, 22, z);
  cyl(0.15, 0.15, 12, steelMat, parent, 4).position.set(x+10, 16, z);
  box(2, 2, 2, rustMat, parent).position.set(x+10, 9.5, z);
  sph(0.5, glowRed, parent, 4).position.set(x+12.5, 22.6, z);
}

function hemi(r, mat, parent, segs) {
  const h2 = BABYLON.MeshBuilder.CreateSphere('hemi', { diameter: r*2, segments: segs||8, arc:1, slice:0.5 }, scene);
  h2.material = mat; h2.parent = parent; return h2;
}

function buildFactoryStore(parent, x, z, label) {
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
