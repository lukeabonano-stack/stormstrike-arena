// ── maps/prison.js  Maximum Security Prison ───────────────────────────────────
import { scene, pbr, gnd, box, cyl, sph, cone, grp, addShadow, setFog } from '../engine.js';
import { gs, interactableObjects } from '../state.js';
import { registerWallCollider, registerMapGroup } from './index.js';

const concMat   = pbr(0x888878, 0.90, 0.04);
const darkConc  = pbr(0x555550, 0.92, 0.04);
const barMat    = pbr(0x4a5060, 0.5, 0.75);
const wireMat   = pbr(0x666660, 0.6, 0.5);
const yardMat   = pbr(0x5a5a48, 0.95, 0.02);
const redLight  = pbr(0xff2200, 0.1, 0, { emissive: 0xff0000, emissiveIntensity: 2.5 });
const whiteLight= pbr(0xffffff, 0.1, 0, { emissive: 0xffffff, emissiveIntensity: 2.5 });
const cellMat   = pbr(0x666660, 0.88, 0.05);
const floodMat  = pbr(0xffffcc, 0.1, 0, { emissive: 0xffffaa, emissiveIntensity: 1.5 });
const orangeMat = pbr(0xff8800, 0.7, 0);
const storeMat  = pbr(0x555548, 0.85, 0.04);

export function buildPrisonMap() {
  const root = grp('prison');
  setFog(0x182010, 18, 120);
  gnd(250, 250, yardMat).parent = root;

  const rng = mulberry32(1337);

  // Outer perimeter wall
  buildPerimeterWall(root);

  // Guard towers at corners
  for (const [tx, tz] of [[-70,-70],[-70,70],[70,-70],[70,70]]) {
    buildGuardTower(root, tx, tz);
  }

  // CELL BLOCK A — main building
  buildCellBlock(root, -20, 0, 30, 40);
  // CELL BLOCK B
  buildCellBlock(root, 30, -15, 25, 35);
  // Administration building
  buildAdminBuilding(root, -30, -40);
  // Cafeteria
  buildCafeteria(root, 20, 40);

  // Prison yard (central area)
  box(50, 0.06, 50, darkConc, root).position.set(0, 0.03, 0);
  // Yard basketball court
  box(14, 0.06, 8, pbr(0x4a6a30, 0.9, 0), root).position.set(5, 0.04, 5);
  box(14.4, 0.1, 0.2, orangeMat, root).position.set(5, 0.05, 9.1);
  box(14.4, 0.1, 0.2, orangeMat, root).position.set(5, 0.05, 0.9);
  // Basketball hoops
  for (const [hx, hz] of [[-2, 5], [12, 5]]) {
    cyl(0.08, 0.08, 3, barMat, root, 5).position.set(hx, 1.5, hz);
    cyl(0.6, 0.6, 0.1, barMat, root, 10).position.set(hx, 3.1, hz);
  }

  // Exercise equipment
  for (let i = 0; i < 8; i++) {
    const ex = (rng()-0.5)*40, ez = (rng()-0.5)*40;
    if (Math.hypot(ex, ez) < 10) continue;
    box(2+rng()*2, 1.5+rng()*2, 1, concMat, root).position.set(ex, 0.75, ez);
    registerWallCollider(ex-1.5, ex+1.5, ez-0.6, ez+0.6);
  }

  // Chain-link fences dividing yard
  for (let i = 0; i < 5; i++) {
    const fz = -20+i*10;
    box(60, 4, 0.15, wireMat, root).position.set(0, 2, fz);
    registerWallCollider(-30, 30, fz-0.1, fz+0.1);
  }

  // Searchlight poles
  for (const [lx, lz] of [[-50,0],[50,0],[0,-50],[0,50],[0,0]]) {
    cyl(0.2, 0.25, 14, darkConc, root, 6).position.set(lx, 7, lz);
    box(1.5, 0.8, 2, concMat, root).position.set(lx, 14.5, lz);
    sph(0.5, floodMat, root, 5).position.set(lx, 14.8, lz);
  }

  // Alarm lights on walls
  for (let i = 0; i < 16; i++) {
    const ang = (i/16)*Math.PI*2, r = 68;
    sph(0.4, i%2===0 ? redLight : whiteLight, root, 4)
      .position.set(Math.cos(ang)*r, 7, Math.sin(ang)*r);
  }

  // Guard catwalks above cell blocks
  box(30, 0.4, 2, barMat, root).position.set(-20, 8, 0);
  box(25, 0.4, 2, barMat, root).position.set(30, 7, -15);

  // Scattered prisoner items
  for (let i = 0; i < 20; i++) {
    const ox = (rng()-0.5)*60, oz = (rng()-0.5)*60;
    if (rng()<0.5) {
      box(1, 1.8, 0.4, orangeMat, root).position.set(ox, 0.9, oz);
    } else {
      cyl(0.4, 0.4, 1, concMat, root, 8).position.set(ox, 0.5, oz);
    }
  }

  // Dumpsters
  for (let i = 0; i < 8; i++) {
    const dx = (rng()-0.5)*120, dz = (rng()-0.5)*120;
    if (Math.hypot(dx, dz) < 20) continue;
    const dumpster = box(2, 1.5, 1, darkConc, root);
    dumpster.position.set(dx, 0.75, dz);
    addShadow(dumpster);
    registerWallCollider(dx-1, dx+1, dz-0.5, dz+0.5);
  }

  buildPrisonStore(root, 55, -50, 'Contraband Cache');
  buildPrisonStore(root, -55, 50, 'Guard Armory');
  buildPrisonStore(root, 55, 50, 'Riot Vault');

  registerMapGroup(root);
  gs.isInsideMapInterior = () => false;
}

function buildPerimeterWall(parent) {
  const wallH = 8, r = 70;
  for (const [x, z, w, d] of [
    [0, -r, r*2, 1.2],
    [0,  r, r*2, 1.2],
    [-r, 0, 1.2, r*2],
    [ r, 0, 1.2, r*2],
  ]) {
    const wall = box(w, wallH, d, concMat, parent);
    wall.position.set(x, wallH/2, z);
    addShadow(wall); registerWallCollider(x-w/2, x+w/2, z-d/2, z+d/2);
    // Barbed wire on top
    box(w, 0.15, 0.15, wireMat, parent).position.set(x, wallH+0.4, z-0.5);
    box(w, 0.15, 0.15, wireMat, parent).position.set(x, wallH+0.4, z+0.5);
  }
}

function buildGuardTower(parent, x, z) {
  const tower = cyl(3.5, 4, 12, concMat, parent, 8);
  tower.position.set(x, 6, z);
  addShadow(tower);
  registerWallCollider(x-4, x+4, z-4, z+4);
  box(9, 2, 9, darkConc, parent).position.set(x, 13, z);
  box(9.4, 0.4, 9.4, darkConc, parent).position.set(x, 14.2, z);
  // Windows all sides
  for (let i = 0; i < 4; i++) {
    const ang = (i/4)*Math.PI*2;
    box(3, 1.2, 0.2, pbr(0x334433, 0.1, 0.2, {emissive:0x223322,emissiveIntensity:0.3}), parent)
      .position.set(x+Math.cos(ang)*4.5, 13.3, z+Math.sin(ang)*4.5);
  }
  sph(0.5, redLight, parent, 5).position.set(x, 15, z);
}

function buildCellBlock(parent, x, z, w, d) {
  const h = 8;
  const building = box(w, h, d, concMat, parent);
  building.position.set(x, h/2, z);
  addShadow(building); registerWallCollider(x-w/2, x+w/2, z-d/2, z+d/2);
  // Cell bar windows
  for (let fl = 0; fl < 3; fl++) {
    for (let c = -3; c <= 3; c++) {
      box(0.08, 1.5, 1.5, barMat, parent).position.set(x-w/2, h*0.2+fl*h*0.25, z+c*(d*0.12));
      box(0.08, 1.5, 1.5, barMat, parent).position.set(x+w/2, h*0.2+fl*h*0.25, z+c*(d*0.12));
    }
  }
  // Security door
  box(3, 4, 0.3, barMat, parent).position.set(x, 2, z-d/2);
  sph(0.3, redLight, parent, 4).position.set(x, 4.2, z-d/2);
}

function buildAdminBuilding(parent, x, z) {
  const admin = box(25, 10, 18, pbr(0xaaa890, 0.8, 0.05), parent);
  admin.position.set(x, 5, z);
  addShadow(admin); registerWallCollider(x-12.5, x+12.5, z-9, z+9);
  box(5, 4, 0.3, barMat, parent).position.set(x, 2, z+9);
  box(25, 0.5, 18, concMat, parent).position.set(x, 10.25, z);
  sph(0.4, whiteLight, parent, 4).position.set(x, 11, z);
}

function buildCafeteria(parent, x, z) {
  const cafe = box(30, 6, 20, concMat, parent);
  cafe.position.set(x, 3, z);
  addShadow(cafe); registerWallCollider(x-15, x+15, z-10, z+10);
  // Tables inside (visual hint through walls)
  for (let i = 0; i < 5; i++) {
    box(5, 0.8, 2, pbr(0x888860, 0.9, 0), parent).position.set(x-8+i*4, 3.8, z);
  }
}

function buildPrisonStore(parent, x, z, label) {
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
