// ── maps/cave.js  Crystal Cave ────────────────────────────────────────────────
import { scene, pbr, gnd, box, cyl, sph, hemi, cone, grp, addShadow, setFog } from '../engine.js';
import { gs, interactableObjects } from '../state.js';
import { registerWallCollider, registerMapGroup } from './index.js';

const rockMat    = pbr(0x2a2830, 0.92, 0.06);
const darkRock   = pbr(0x1a181f, 0.94, 0.05);
const wetRock    = pbr(0x222030, 0.4, 0.2);
const crystalB   = pbr(0x2244cc, 0.05, 0.6, { emissive: 0x1133aa, emissiveIntensity: 1.2 });
const crystalP   = pbr(0xaa22cc, 0.05, 0.6, { emissive: 0x8811aa, emissiveIntensity: 1.2 });
const crystalG   = pbr(0x22cc66, 0.05, 0.6, { emissive: 0x11aa44, emissiveIntensity: 1.2 });
const crystalR   = pbr(0xcc2244, 0.05, 0.6, { emissive: 0xaa1133, emissiveIntensity: 1.2 });
const crystalY   = pbr(0xccaa22, 0.05, 0.6, { emissive: 0xaa8811, emissiveIntensity: 1.2 });
const lakeMat    = pbr(0x112244, 0.06, 0.45, { emissive: 0x001133, emissiveIntensity: 0.3 });
const lavaMat    = pbr(0xff4400, 0.08, 0, { emissive: 0xff2200, emissiveIntensity: 1.5 });
const mussMat    = pbr(0x224422, 0.8, 0);
const stalMat    = pbr(0x554448, 0.85, 0.06);
const storeMat   = pbr(0x2a2830, 0.85, 0.06);

const CRYSTAL_MATS = [crystalB, crystalP, crystalG, crystalR, crystalY];

export function buildCaveMap() {
  const root = grp('cave');
  setFog(0x05030a, 8, 85);
  gnd(240, 240, darkRock).parent = root;

  const rng = mulberry32(888);

  // Ceiling stalactites (very tall, come from above)
  for (let i = 0; i < 80; i++) {
    const sx = (rng()*2-1)*100, sz = (rng()*2-1)*100;
    if (Math.hypot(sx, sz) < 8) continue;
    const h = 3+rng()*12;
    const stal = cone(0.3+rng()*0.8, h, stalMat, root, 7);
    stal.position.set(sx, h/2+8, sz);
    stal.rotation.x = Math.PI;
    if (rng() < 0.3) addShadow(stal);
  }

  // Stalagmites rising from floor
  for (let i = 0; i < 70; i++) {
    const sx = (rng()*2-1)*100, sz = (rng()*2-1)*100;
    if (Math.hypot(sx, sz) < 8) continue;
    const h = 0.8+rng()*5;
    const stag = cone(0.2+rng()*0.6, h, stalMat, root, 7);
    stag.position.set(sx, h/2, sz);
    addShadow(stag);
    if (h > 2.5) registerWallCollider(sx-0.7, sx+0.7, sz-0.7, sz+0.7);
  }

  // Crystal clusters
  for (let i = 0; i < 55; i++) {
    const cx = (rng()*2-1)*95, cz = (rng()*2-1)*95;
    if (Math.hypot(cx, cz) < 6) continue;
    buildCrystalCluster(root, cx, cz, rng);
  }

  // Central underground lake
  cyl(22, 22, 0.3, lakeMat, root, 24).position.set(0, -0.12, 0);
  // Lake crystal islands
  for (let i = 0; i < 5; i++) {
    const ang = (i/5)*Math.PI*2;
    const ix = Math.cos(ang)*10, iz = Math.sin(ang)*10;
    cyl(2, 2.5, 0.5, wetRock, root, 8).position.set(ix, 0.2, iz);
    buildCrystalCluster(root, ix, iz, rng);
  }

  // Lava pools
  for (let i = 0; i < 6; i++) {
    const lx = (rng()*2-1)*85, lz = (rng()*2-1)*85;
    if (Math.hypot(lx, lz) < 25) continue;
    const r = 4+rng()*8;
    cyl(r, r, 0.25, lavaMat, root, 16).position.set(lx, 0.1, lz);
    registerWallCollider(lx-r, lx+r, lz-r, lz+r);
    // Lava glow stalactites above
    for (let j = 0; j < 4; j++) {
      sph(0.4, pbr(0xff6600, 0.1, 0, {emissive:0xff4400,emissiveIntensity:1.5}), root, 4)
        .position.set(lx+(rng()-0.5)*r*0.5, 5+rng()*5, lz+(rng()-0.5)*r*0.5);
    }
  }

  // Rock formations
  for (let i = 0; i < 30; i++) {
    const rx = (rng()*2-1)*95, rz2 = (rng()*2-1)*95;
    if (Math.hypot(rx, rz2) < 8) continue;
    const rw = 2+rng()*5, rh = 3+rng()*7;
    const rock = sph(rw, rng()<0.5 ? rockMat : darkRock, root, 6);
    rock.position.set(rx, rh*0.3, rz2);
    rock.scaling.set(1, 0.9, 1);
    addShadow(rock); registerWallCollider(rx-rw, rx+rw, rz2-rw, rz2+rw);
  }

  // Underground mushrooms
  for (let i = 0; i < 25; i++) {
    const mx = (rng()*2-1)*85, mz = (rng()*2-1)*85;
    const mh = 0.8+rng()*2;
    cyl(0.15, 0.2, mh, mussMat, root, 6).position.set(mx, mh/2, mz);
    const cap = sph(0.6+rng()*0.6, CRYSTAL_MATS[Math.floor(rng()*5)], root, 6);
    cap.position.set(mx, mh, mz);
    cap.scaling.set(1.2, 0.5, 1.2);
  }

  // Cave walls (outer ring of large boulders to bound the space)
  const WALL_COUNT = 28;
  for (let i = 0; i < WALL_COUNT; i++) {
    const ang = (i/WALL_COUNT)*Math.PI*2;
    const r = 105;
    const wx = Math.cos(ang)*r, wz = Math.sin(ang)*r;
    const rw = 8+rng()*8;
    const rock = sph(rw, rng()<0.5 ? rockMat : darkRock, root, 6);
    rock.position.set(wx, rw*0.3, wz);
    rock.scaling.set(1, 0.7, 1);
    registerWallCollider(wx-rw, wx+rw, wz-rw, wz+rw);
  }

  // Glowing crystal veins in floor
  for (let i = 0; i < 20; i++) {
    const vx = (rng()*2-1)*80, vz = (rng()*2-1)*80;
    const len = 4+rng()*12;
    const mat = CRYSTAL_MATS[Math.floor(rng()*5)];
    box(rng()<0.5 ? len : 0.3, 0.1, rng()<0.5 ? 0.3 : len, mat, root).position.set(vx, 0.05, vz);
  }

  buildCaveStore(root, -60, -65, 'Crystal Cache');
  buildCaveStore(root,  65,  60, 'Deep Vault');
  buildCaveStore(root, -65,  60, 'Gem Armory');
  buildCaveStore(root,  60, -65, 'Lava Forge');

  registerMapGroup(root);
  gs.isInsideMapInterior = () => false;
}

function buildCrystalCluster(parent, x, z, rng) {
  const count = 3+Math.floor(rng()*5);
  const mat = CRYSTAL_MATS[Math.floor(rng()*5)];
  for (let i = 0; i < count; i++) {
    const h = 1+rng()*4;
    const cx = x+(rng()-0.5)*2, cz = z+(rng()-0.5)*2;
    const crystal = cone(0.2+rng()*0.5, h, mat, parent, 6);
    crystal.position.set(cx, h/2, cz);
    crystal.rotation.x = (rng()-0.5)*0.4;
    crystal.rotation.z = (rng()-0.5)*0.4;
    addShadow(crystal);
  }
  if (rng() < 0.6) registerWallCollider(x-1.5, x+1.5, z-1.5, z+1.5);
}

function buildCaveStore(parent, x, z, label) {
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
