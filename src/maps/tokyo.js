// ── maps/tokyo.js  Tokyo Neon Streets ────────────────────────────────────────
import { scene, pbr, gnd, box, cyl, sph, cone, grp, addShadow, setFog } from '../engine.js';
import { gs, interactableObjects } from '../state.js';
import { registerWallCollider, registerMapGroup } from './index.js';

const asphaltMat = pbr(0x111118, 0.92, 0.05);
const concreteMat= pbr(0x888890, 0.88, 0.05);
const buildMat1  = pbr(0x223344, 0.7, 0.2);
const buildMat2  = pbr(0x332233, 0.7, 0.2);
const buildMat3  = pbr(0x112233, 0.7, 0.15);
const neonPink   = pbr(0xff00aa, 0.1, 0, { emissive: 0xff0088, emissiveIntensity: 2.5 });
const neonBlue   = pbr(0x00aaff, 0.1, 0, { emissive: 0x0088ff, emissiveIntensity: 2.5 });
const neonGreen  = pbr(0x00ff88, 0.1, 0, { emissive: 0x00ee66, emissiveIntensity: 2.5 });
const neonOrange = pbr(0xff8800, 0.1, 0, { emissive: 0xff6600, emissiveIntensity: 2.5 });
const neonYellow = pbr(0xffee00, 0.1, 0, { emissive: 0xddcc00, emissiveIntensity: 2 });
const lanternMat = pbr(0xff4400, 0.3, 0, { emissive: 0xff2200, emissiveIntensity: 1.5 });
const glassMat   = pbr(0x334455, 0.04, 0.3, { emissive: 0x2244aa, emissiveIntensity: 0.3 });
const storeMat   = pbr(0x112233, 0.7, 0.2);

export function buildTokyoMap() {
  const root = grp('tokyo');
  setFog(0x050815, 15, 110);
  gnd(250, 250, asphaltMat).parent = root;

  const rng = mulberry32(777);

  // Main streets — glowing ground strips
  for (const z of [0, 35, -35]) {
    const road = box(200, 0.06, 22, pbr(0x050510, 0.95, 0.05), root);
    road.position.set(0, 0.03, z);
    // Lane markers
    for (let i = -9; i < 10; i++) {
      const m = box(4, 0.08, 0.3, pbr(0xffff00, 0.5, 0, {emissive:0xaaaa00,emissiveIntensity:0.5}), root);
      m.position.set(i*10, 0.04, z);
    }
  }
  for (const x of [0, 35, -35, 70, -70]) {
    box(22, 0.06, 200, pbr(0x050510, 0.95, 0.05), root).position.set(x, 0.03, 0);
  }

  // Neon ground strips
  const neonMats = [neonPink, neonBlue, neonGreen, neonOrange];
  for (let i = 0; i < 40; i++) {
    const gx = (rng()*2-1)*100, gz = (rng()*2-1)*100;
    const len = 8+rng()*20;
    const mat = neonMats[Math.floor(rng()*4)];
    const strip = box(rng()<0.5 ? len : 0.2, 0.06, rng()<0.5 ? 0.2 : len, mat, root);
    strip.position.set(gx, 0.04, gz);
  }

  // City blocks with buildings
  const BLOCK_POSITIONS = [];
  for (let bx = -90; bx <= 90; bx += 38) {
    for (let bz = -90; bz <= 90; bz += 38) {
      if (Math.abs(bx) < 12 && Math.abs(bz) < 12) continue;
      BLOCK_POSITIONS.push([bx, bz]);
    }
  }
  for (const [bx, bz] of BLOCK_POSITIONS) {
    buildTokyoBlock(root, bx, bz, rng);
  }

  // Giant skyscrapers
  for (let i = 0; i < 6; i++) {
    const ang = (i/6)*Math.PI*2;
    const r = 55+rng()*20;
    const sx = Math.cos(ang)*r, sz = Math.sin(ang)*r;
    buildSkyscraper(root, sx, sz, rng);
  }

  // Torii gate
  buildToriiGate(root, 0, -60);

  // Japanese lanterns on wires
  for (let i = 0; i < 30; i++) {
    const lx = (rng()*2-1)*80, lz = (rng()*2-1)*80;
    const lh = 4+rng()*3;
    cyl(0.35, 0.28, 0.7, lanternMat, root, 6).position.set(lx, lh, lz);
  }

  // Vending machines
  for (let i = 0; i < 20; i++) {
    const vx = (rng()*2-1)*85, vz = (rng()*2-1)*85;
    const vm = box(0.9, 2, 0.5, neonMats[i%4], root);
    vm.position.set(vx, 1, vz);
    addShadow(vm); registerWallCollider(vx-0.5, vx+0.5, vz-0.3, vz+0.3);
  }

  // Elevated train tracks
  const track = box(200, 0.4, 3, concreteMat, root);
  track.position.set(0, 5.2, -50);
  addShadow(track); registerWallCollider(-100, 100, -51.8, -48.2);
  for (let i = -9; i < 10; i++) {
    cyl(0.6, 0.8, 5.2, concreteMat, root, 8).position.set(i*18, 2.6, -50);
  }
  // Train
  for (let i = -2; i < 3; i++) {
    const car = box(9, 2.5, 2.8, buildMat3, root);
    car.position.set(i*9.2, 6.6, -50);
    for (let w = 0; w < 4; w++) {
      sph(0.22, neonBlue, root, 4).position.set(i*9.2+(w-1.5)*2.2, 6.6, -48.7);
    }
  }

  // Billboard frames
  for (let i = 0; i < 15; i++) {
    const ang = rng()*Math.PI*2, r = 40+rng()*50;
    const bx = Math.cos(ang)*r, bz = Math.sin(ang)*r;
    const ph = 8+rng()*8;
    cyl(0.2, 0.3, ph, concreteMat, root, 5).position.set(bx, ph/2, bz);
    const nMat = neonMats[Math.floor(rng()*4)];
    box(6, 3, 0.3, nMat, root).position.set(bx, ph+1.5, bz);
  }

  buildTokyoStore(root, -60, -70, 'Akihabara Arms');
  buildTokyoStore(root,  65,  60, 'Shibuya Depot');
  buildTokyoStore(root, -65,  60, 'Shinjuku Cache');
  buildTokyoStore(root,  60, -65, 'Harajuku Gear');

  registerMapGroup(root);
  gs.isInsideMapInterior = () => false;
}

function buildTokyoBlock(parent, x, z, rng) {
  const numBuildings = 2+Math.floor(rng()*3);
  const mats = [buildMat1, buildMat2, buildMat3];
  for (let i = 0; i < numBuildings; i++) {
    const bw = 5+rng()*8, bd = 5+rng()*8, bh = 8+rng()*20;
    const bx = x+(rng()-0.5)*12, bz2 = z+(rng()-0.5)*12;
    const building = box(bw, bh, bd, mats[i%3], parent);
    building.position.set(bx, bh/2, bz2);
    addShadow(building); registerWallCollider(bx-bw/2, bx+bw/2, bz2-bd/2, bz2+bd/2);
    // Window rows
    const neonMats = [neonPink, neonBlue, neonGreen, neonOrange, neonYellow];
    for (let fl = 0; fl < Math.floor(bh/2.5); fl++) {
      const wMat = neonMats[Math.floor(rng()*5)];
      if (rng()<0.6) {
        box(bw+0.04, 0.35, 0.08, wMat, parent).position.set(bx, bh/2-bh+fl*2.5+1.5, bz2-bd/2);
      }
    }
    // Rooftop antenna
    if (rng()<0.5) {
      cyl(0.08, 0.08, 3+rng()*4, pbr(0x888888,0.5,0.6), parent, 4).position.set(bx, bh+1.5, bz2);
      sph(0.18, rng()<0.5?neonPink:neonBlue, parent, 4).position.set(bx, bh+3.5, bz2);
    }
  }
}

function buildSkyscraper(parent, x, z, rng) {
  const w = 10+rng()*8, h = 40+rng()*30;
  const building = box(w, h, w, buildMat1, parent);
  building.position.set(x, h/2, z);
  addShadow(building); registerWallCollider(x-w/2, x+w/2, z-w/2, z+w/2);
  // Neon racing stripes
  const neonMats = [neonPink, neonBlue, neonGreen];
  for (let i = 0; i < 3; i++) {
    box(0.25, h, 0.25, neonMats[i], parent).position.set(x-w/2+i*w/3, h/2, z-w/2);
  }
  // Glass top
  box(w*0.8, h*0.15, w*0.8, glassMat, parent).position.set(x, h*0.93, z);
}

function buildToriiGate(parent, x, z) {
  const torii = pbr(0xcc2200, 0.6, 0.1);
  cyl(0.4, 0.5, 7, torii, parent, 8).position.set(x-4, 3.5, z);
  cyl(0.4, 0.5, 7, torii, parent, 8).position.set(x+4, 3.5, z);
  box(10, 0.7, 0.7, torii, parent).position.set(x, 7.35, z);
  box(11, 0.5, 0.5, torii, parent).position.set(x, 6.3, z);
  registerWallCollider(x-4.5, x-3.5, z-0.5, z+0.5);
  registerWallCollider(x+3.5, x+4.5, z-0.5, z+0.5);
}

function buildTokyoStore(parent, x, z, label) {
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
