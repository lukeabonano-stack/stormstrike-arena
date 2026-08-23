// ── maps/medieval.js  Medieval Castle ────────────────────────────────────────
import { scene, pbr, gnd, box, cyl, sph, cone, grp, addShadow, setFog } from '../engine.js';
import { gs, interactableObjects } from '../state.js';
import { registerWallCollider, registerMapGroup } from './index.js';

const stoneMat  = pbr(0x888878, 0.88, 0.04);
const darkStone = pbr(0x555548, 0.90, 0.04);
const mossStone = pbr(0x5a6a44, 0.88, 0.02);
const woodMat   = pbr(0x7a4820, 0.85, 0.02);
const thatchMat = pbr(0xb89040, 0.95, 0);
const grassMat  = pbr(0x3a6a20, 0.95, 0);
const waterMat  = pbr(0x224466, 0.06, 0.4);
const torchMat  = pbr(0xff8800, 0.1, 0, { emissive: 0xff6600, emissiveIntensity: 2 });
const bannerMat = pbr(0xcc2200, 0.7, 0);
const ironMat   = pbr(0x333330, 0.5, 0.7);
const storeMat  = pbr(0x666655, 0.8, 0.05);

export function buildMedievalMap() {
  const root = grp('medieval');
  setFog(0x88997a, 18, 115);
  gnd(250, 250, grassMat).parent = root;

  const rng = mulberry32(555);

  // Moat
  const moat = BABYLON.MeshBuilder.CreateGround('moat', { width: 250, height: 22 }, scene);
  moat.material = waterMat; moat.parent = root;
  moat.position.set(0, -0.05, 0);
  const moat2 = box(22, 0.3, 140, waterMat, root);
  moat2.position.set(0, -0.08, 0);

  // CASTLE — main keep
  buildKeep(root, 0, 0);

  // Castle outer walls
  buildCastleWall(root, -30, 0, 0.8, 50, 6);  // west
  buildCastleWall(root,  30, 0, 0.8, 50, 6);  // east
  buildCastleWall(root, 0, -25, 50, 0.8, 6);  // north
  buildCastleWall(root, 0,  25, 50, 0.8, 6);  // south

  // Corner towers
  for (const [cx, cz] of [[-30,-25],[-30,25],[30,-25],[30,25]]) {
    buildTower(root, cx, cz, 3.5, 10);
  }

  // Gatehouse
  buildGatehouse(root, 0, 25);

  // Village houses outside walls
  for (let i = 0; i < 18; i++) {
    const hx = (rng()*2-1)*90, hz = 35 + rng()*60;
    if (Math.abs(hx) < 12) continue;
    buildHouse(root, hx, hz * (rng()<0.5 ? 1 : -1), rng);
  }
  for (let i = 0; i < 10; i++) {
    const hx = 38 + rng()*55;
    const hz = (rng()*2-1)*70;
    buildHouse(root, hx * (rng()<0.5 ? 1 : -1), hz, rng);
  }

  // Torch posts
  for (let i = 0; i < 20; i++) {
    const tx = (rng()*2-1)*85, tz = (rng()*2-1)*85;
    cyl(0.08, 0.08, 3, woodMat, root, 5).position.set(tx, 1.5, tz);
    const flame = sph(0.2, torchMat, root, 5);
    flame.position.set(tx, 3.2, tz);
  }

  // Wooden carts & barrels
  for (let i = 0; i < 15; i++) {
    const cx = (rng()*2-1)*80, cz = (rng()*2-1)*80;
    if (Math.hypot(cx, cz) < 32) continue;
    box(1.2, 0.8, 2, woodMat, root).position.set(cx, 0.4, cz);
    cyl(0.4, 0.4, 1, woodMat, root, 8).position.set(cx+1.5, 0.5, cz);
  }

  // Trees around perimeter
  for (let i = 0; i < 25; i++) {
    const angle = rng()*Math.PI*2, r = 75 + rng()*25;
    buildTree(root, Math.cos(angle)*r, Math.sin(angle)*r, rng);
  }

  buildMedievalStore(root, -50, -50, 'Blacksmith');
  buildMedievalStore(root,  55,  40, 'Armory Keep');
  buildMedievalStore(root, -55,  45, 'Merchant');
  buildMedievalStore(root,  50, -45, 'Fletcher');

  registerMapGroup(root);
  // Constrain enemy spawns to the castle courtyard — reject anything outside the walls
  gs.isInsideMapInterior = (x, z) => Math.abs(x) > 28.5 || Math.abs(z) > 23.5;
}

function buildKeep(parent, x, z) {
  const base = box(16, 12, 16, stoneMat, parent);
  base.position.set(x, 6, z);
  addShadow(base);
  registerWallCollider(x-8, x+8,  z-8,   z-7.5);
  registerWallCollider(x-8, x-7.5, z-7.5, z+8);
  registerWallCollider(x+7.5, x+8, z-7.5, z+8);
  registerWallCollider(x-8, x-2,  z+7.5, z+8);
  registerWallCollider(x+2, x+8,  z+7.5, z+8);
  // Battlements
  for (let i = 0; i < 8; i++) {
    const ang = (i/8)*Math.PI*2;
    const bm = box(1.5, 2, 1.5, darkStone, parent);
    bm.position.set(x+Math.cos(ang)*7.5, 13.5, z+Math.sin(ang)*7.5);
  }
  // Windows
  for (const [dx,dz] of [[-8,0],[8,0],[0,-8],[0,8]]) {
    box(0.15, 2, 1.2, pbr(0xffcc88, 0.1, 0, {emissive:0xffaa44,emissiveIntensity:0.8}), parent)
      .position.set(x+dx, 8, z+dz);
  }
  // Banner poles
  for (const [dx,dz] of [[-7,0],[7,0]]) {
    cyl(0.1, 0.1, 4, ironMat, parent, 5).position.set(x+dx, 15, z+dz);
    box(2.5, 1.5, 0.08, bannerMat, parent).position.set(x+dx+1.5, 15.5, z+dz);
  }
}

function buildCastleWall(parent, x, z, w, d, h) {
  const wall = box(w, h, d, stoneMat, parent);
  wall.position.set(x, h/2, z);
  addShadow(wall); registerWallCollider(x-w/2, x+w/2, z-d/2, z+d/2);
  // Battlements along top
  const count = Math.floor(Math.max(w,d)/3);
  for (let i = 0; i < count; i++) {
    const bm = box(w>d ? 2 : 0.8, 1.5, w>d ? 0.8 : 2, darkStone, parent);
    const t = (i+0.5)/count;
    bm.position.set(w>d ? x-w/2+w*t : x, h+0.75, w>d ? z : z-d/2+d*t);
  }
}

function buildTower(parent, x, z, r, h) {
  const tower = cyl(r, r+0.3, h, stoneMat, parent, 12);
  tower.position.set(x, h/2, z);
  addShadow(tower); registerWallCollider(x-r-0.4, x+r+0.4, z-r-0.4, z+r+0.4);
  const cap = cone(r+0.8, 3.5, bannerMat, parent, 12);
  cap.position.set(x, h+1.75, z);
  for (let i = 0; i < 6; i++) {
    const ang = (i/6)*Math.PI*2;
    box(1, 2, 1, darkStone, parent).position.set(x+Math.cos(ang)*(r-0.2), h+1, z+Math.sin(ang)*(r-0.2));
  }
}

function buildGatehouse(parent, x, z) {
  for (const side of [-8, 8]) {
    const tower = box(6, 10, 5, stoneMat, parent);
    tower.position.set(x+side, 5, z);
    addShadow(tower); registerWallCollider(x+side-3, x+side+3, z-2.5, z+2.5);
  }
  const arch = box(10, 3, 5, stoneMat, parent);
  arch.position.set(x, 9, z);
  const portcullis = box(5, 5, 0.3, ironMat, parent);
  portcullis.position.set(x, 5.5, z);
}

function buildHouse(parent, x, z, rng) {
  const w = 4+rng()*3, d = 4+rng()*3, h = 2.5+rng()*1;
  const house = box(w, h, d, rng()<0.5 ? stoneMat : mossStone, parent);
  house.position.set(x, h/2, z);
  addShadow(house); registerWallCollider(x-w/2, x+w/2, z-d/2, z+d/2);
  const roof = box(w+0.6, 0.2, d+0.6, thatchMat, parent);
  roof.position.set(x, h+0.1, z);
  const ridge = box(w+0.8, 1.5, 0.4, thatchMat, parent);
  ridge.position.set(x, h+0.85, z);
}

function buildTree(parent, x, z, rng) {
  const h = 4+rng()*4;
  cyl(0.25, 0.35, h, woodMat, parent, 6).position.set(x, h/2, z);
  const top = sph(2+rng()*1.5, mossStone, parent, 7);
  top.position.set(x, h+1.2, z); top.scaling.y = 0.85;
}

function buildMedievalStore(parent, x, z, label) {
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
