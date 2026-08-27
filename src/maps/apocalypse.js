// ── maps/apocalypse.js  Zombie Apocalypse City ────────────────────────────────
import { scene, pbr, pbrTex, gnd, box, cyl, sph, hemi, cone, grp, addShadow, setFog } from '../engine.js';
import { gs, interactableObjects } from '../state.js';
import { registerWallCollider, registerMapGroup, loadProp, instantiateProp } from './index.js';

const ashMat    = pbrTex('ash', 0x2a2820, 0.97, 0, { uv: 20, seed: 66 });
const concMat   = pbrTex('concrete', 0x555548, 0.92, 0.04, { uv: 8, seed: 67 });
const ruinMat   = pbrTex('concrete', 0x444438, 0.90, 0.03, { uv: 6, seed: 68 });
const charMat   = pbrTex('ash', 0x181410, 0.95, 0.02, { uv: 24, seed: 69 });
const fireMat   = pbr(0xff4400, 0.1, 0, { emissive: 0xff2200, emissiveIntensity: 2.5 });
const emberMat  = pbr(0xff8800, 0.1, 0, { emissive: 0xff6600, emissiveIntensity: 1.8 });
const bloodMat  = pbr(0x660000, 0.4, 0);
const glassMat  = pbr(0x334422, 0.08, 0.3, { emissive: 0x226600, emissiveIntensity: 0.2 });
const rustMat   = pbr(0x5a3018, 0.9, 0.3);
const wireMat   = pbr(0x444444, 0.7, 0.5);
const storeMat  = pbr(0x3a3830, 0.85, 0.04);
const zombieSkinM = pbr(0x7a8b55, 0.85, 0.01);
const zombieRagM  = pbr(0x1a0f06, 0.95, 0);
const boneMat     = pbr(0xc8c0a0, 0.8, 0);
const greenMistM  = pbr(0x224400, 0.3, 0, { emissive: 0x113300, emissiveIntensity: 0.6 });

export function buildApocalypseMap() {
  const root = grp('apocalypse');
  setFog(0x1a1208, 12, 100);
  gnd(240, 240, ashMat).parent = root;

  const rng = mulberry32(666);

  // Cracked roads
  for (const z of [0, 30, -30, 60, -60]) {
    box(220, 0.08, 18, charMat, root).position.set(0, 0.04, z);
  }
  for (const x of [0, 40, -40, 80, -80]) {
    box(18, 0.08, 220, charMat, root).position.set(x, 0.04, 0);
  }

  // Destroyed city blocks
  for (let bx = -90; bx <= 90; bx += 42) {
    for (let bz = -90; bz <= 90; bz += 42) {
      if (Math.abs(bx) < 12 && Math.abs(bz) < 12) continue;
      buildDestroyedBlock(root, bx, bz, rng);
    }
  }

  // Burning barricades across roads
  for (let i = 0; i < 12; i++) {
    const bx = (rng()*2-1)*80, bz2 = (rng()*2-1)*80;
    buildBarricade(root, bx, bz2, rng);
  }

  // Wrecked cars
  for (let i = 0; i < 25; i++) {
    const cx = (rng()*2-1)*90, cz = (rng()*2-1)*90;
    buildWreckedCar(root, cx, cz, rng);
  }

  // Fire & smoke columns
  for (let i = 0; i < 20; i++) {
    const fx = (rng()*2-1)*85, fz = (rng()*2-1)*85;
    const h = 1+rng()*3;
    sph(0.8+rng()*0.8, fireMat, root, 5).position.set(fx, h, fz);
    sph(0.5+rng()*0.5, emberMat, root, 4).position.set(fx+(rng()-0.5), h+1.5, fz+(rng()-0.5));
    // Smoke
    for (let s = 0; s < 4; s++) {
      const sm = sph(0.8+s*0.4, pbr(0x222222, 0.95, 0), root, 4);
      sm.position.set(fx+(rng()-0.5)*0.5, h+2+s*1.5, fz+(rng()-0.5)*0.5);
    }
  }

  // Fallen power poles
  for (let i = 0; i < 15; i++) {
    const px = (rng()*2-1)*80, pz = (rng()*2-1)*80;
    const pole = cyl(0.12, 0.15, 6+rng()*3, charMat, root, 6);
    pole.position.set(px, 0.5, pz);
    pole.rotation.z = Math.PI*0.4 + (rng()-0.5)*0.4;
    pole.rotation.y = rng()*Math.PI;
    // Wires
    box(0.05, 0.05, 5+rng()*8, wireMat, root).position.set(px, 1.5, pz);
  }

  // Bus wreck
  buildBusWreck(root, 25, 15);
  buildBusWreck(root, -30, -20);

  // Overpass / elevated rubble
  const overpass = box(22, 0.8, 120, concMat, root);
  overpass.position.set(-50, 4, 0);
  addShadow(overpass); registerWallCollider(-61, -39, -60, 60);
  for (let i = -4; i < 5; i++) {
    cyl(1.2, 1.4, 4, ruinMat, root, 8).position.set(-50, 2, i*12);
  }
  // Overpass rubble chunks
  for (let i = 0; i < 10; i++) {
    const rx = -55+(rng()*20), rz = (rng()*2-1)*55;
    const rw = 2+rng()*5;
    box(rw, 1+rng()*2, rw*0.8, ruinMat, root).position.set(rx, rng()*1.5, rz);
    const rubbleDecal = box(rw, 0.15, rw, bloodMat, root);
    rubbleDecal.position.set(rx, 0.02, rz);
    addShadow(rubbleDecal);
  }

  // Spray paint / blood splatters
  for (let i = 0; i < 15; i++) {
    const sx = (rng()*2-1)*80, sz = (rng()*2-1)*80;
    box(1.5+rng()*1.5, 0.06, 1.5+rng()*1.5, bloodMat, root).position.set(sx, 0.04, sz);
  }

  // Corpse piles scattered around the city
  for (let i = 0; i < 28; i++) {
    const cx2 = (rng()*2-1)*88, cz2 = (rng()*2-1)*88;
    buildCorpsePile(root, cx2, cz2, rng);
  }

  // Scattered zombie skulls and bones
  for (let i = 0; i < 40; i++) {
    const zx = (rng()*2-1)*85, zz = (rng()*2-1)*85;
    sph(0.18 + rng()*0.12, boneMat, root, 5).position.set(zx, 0.18, zz);
    if (rng() > 0.5) {
      // ribcage-like bone shard
      box(0.08, rng()*0.4+0.15, 0.06, boneMat, root).position.set(zx+(rng()-0.5)*0.3, 0.12, zz+(rng()-0.5)*0.3);
    }
  }

  // Green bioluminescent infection patches
  for (let i = 0; i < 15; i++) {
    const gx = (rng()*2-1)*80, gz = (rng()*2-1)*80;
    const gr = 0.6 + rng()*1.4;
    sph(gr, greenMistM, root, 5).position.set(gx, gr * 0.4, gz);
  }

  // Heavy blood splatter patches
  for (let i = 0; i < 35; i++) {
    const sx = (rng()*2-1)*88, sz = (rng()*2-1)*88;
    const sw = 0.8 + rng()*2.5;
    box(sw, 0.04, sw * (0.5 + rng()*0.8), bloodMat, root).position.set(sx, 0.03, sz);
  }

  buildApocalypseStore(root, -65, -65, 'Survivor Stash');
  buildApocalypseStore(root,  65,  65, 'Bunker Armory');
  buildApocalypseStore(root, -65,  65, 'Emergency Cache');
  buildApocalypseStore(root,  65, -65, 'Last Stand Depot');

  // Real KayKit graveyard props — async, decor-only (safe no-op if the
  // player leaves before these finish loading, matching the Metro pattern).
  spawnGraveyardProps(root);

  registerMapGroup(root);
  gs.isInsideMapInterior = () => false;
}

async function spawnGraveyardProps(root) {
  // Clustered in the open street corridor between block centers (~36 and ~78
  // on the x grid), well clear of the destroyed-block footprints.
  const specs = [
    { path: 'assets/models/props/halloween/crypt.gltf',            pos: [56, 0, 4],   targetH: 4.2, ry: 0.4 },
    { path: 'assets/models/props/halloween/grave_A.gltf',           pos: [50, 0, 10],  targetH: 1.1, ry: 0.2 },
    { path: 'assets/models/props/halloween/grave_A_destroyed.gltf', pos: [48, 0, -4],  targetH: 0.9, ry: 1.1 },
    { path: 'assets/models/props/halloween/grave_B.gltf',           pos: [60, 0, 14],  targetH: 1.1, ry: 2.0 },
    { path: 'assets/models/props/halloween/gravestone.gltf',        pos: [52, 0, 18],  targetH: 1.0, ry: 0.6 },
    { path: 'assets/models/props/halloween/gravemarker_A.gltf',     pos: [44, 0, 14],  targetH: 0.7, ry: 2.4 },
    { path: 'assets/models/props/halloween/fence_broken.gltf',      pos: [64, 0, 0],   targetH: 1.3, ry: 0.1 },
    { path: 'assets/models/props/halloween/coffin.gltf',            pos: [56, 0, -6],  targetH: 0.6, ry: 0.9 },
  ];
  // Start every fetch up front, then place them in spec order as they land.
  // Awaiting inside the loop made each prop wait a full round trip for the
  // one before it — unnoticeable on localhost, but over the wire it is why
  // the map visibly trickled in instead of appearing built. loadProp caches
  // its promise and resolves null on failure, so this stays safe to fan out.
  const pending = specs.map(spec => loadProp(spec.path));
  for (let i = 0; i < specs.length; i++) {
    const spec = specs[i];
    try {
      const container = await pending[i];
      if (gs.mapId !== 'apocalypse' || root.isDisposed()) continue;
      if (!container) { console.warn('[apocalypse] no container for', spec.path); continue; }
      const node = instantiateProp(container);
      if (!node) { console.warn('[apocalypse] instantiateProp null for', spec.path); continue; }
      node.parent = root;
      const bv = node.getHierarchyBoundingVectors(true);
      const h = bv.max.y - bv.min.y;
      const scaleFactor = h > 0.01 ? spec.targetH / h : 1;
      node.scaling.setAll(scaleFactor);
      node.rotation.y = spec.ry || 0;
      node.position.set(spec.pos[0], -bv.min.y * scaleFactor, spec.pos[2]);
      node.getChildMeshes(false).forEach(m => { m.receiveShadows = true; addShadow(m); });
    } catch (e) {
      console.warn('[apocalypse] graveyard prop failed:', spec.path, e && e.message);
    }
  }
}

function buildDestroyedBlock(parent, x, z, rng) {
  const numBuildings = 1+Math.floor(rng()*3);
  for (let i = 0; i < numBuildings; i++) {
    const bw = 6+rng()*10, bh = 5+rng()*18, bd = 6+rng()*10;
    const bx = x+(rng()-0.5)*10, bz2 = z+(rng()-0.5)*10;
    const angle = (rng()-0.5)*0.12;

    // Ruined building (cut off top, angled)
    const building = box(bw, bh, bd, rng()<0.5 ? ruinMat : concMat, parent);
    building.position.set(bx, bh/2, bz2);
    building.rotation.y = angle;
    addShadow(building); registerWallCollider(bx-bw/2, bx+bw/2, bz2-bd/2, bz2+bd/2);

    // Broken top
    if (rng() < 0.7) {
      const topH = rng()*bh*0.4;
      box(bw*0.8, topH, bd*0.8, charMat, parent)
        .position.set(bx+(rng()-0.5)*1.5, bh+topH/2-1, bz2+(rng()-0.5)*1.5);
    }

    // Dark windows
    for (let fl = 0; fl < Math.floor(bh/3); fl++) {
      if (rng()<0.4) {
        box(bw+0.04, 0.5, 0.1, glassMat, parent).position.set(bx, bh/2-bh+fl*3+1.5, bz2-bd/2);
      }
    }

    // Rubble pile at base
    for (let r2 = 0; r2 < 5; r2++) {
      sph(0.5+rng()*1.2, ruinMat, parent, 4)
        .position.set(bx+(rng()-0.5)*bw, rng()*0.8, bz2+(rng()-0.5)*bd);
    }
  }
}

function buildBarricade(parent, x, z, rng) {
  for (let i = 0; i < 4; i++) {
    const bx = x+(i-1.5)*1.5;
    box(1, 1.5, 3.5, rustMat, parent).position.set(bx, 0.75, z);
    registerWallCollider(bx-0.5, bx+0.5, z-1.8, z+1.8);
    if (rng()<0.5) sph(0.35, fireMat, parent, 4).position.set(bx, 2, z);
  }
}

function buildWreckedCar(parent, x, z, rng) {
  const carBody = box(2.4, 1.2, 5, rustMat, parent);
  carBody.position.set(x, 0.6, z);
  carBody.rotation.y = rng()*Math.PI;
  addShadow(carBody); registerWallCollider(x-1.3, x+1.3, z-2.6, z+2.6);
  box(2.3, 0.8, 3, concMat, parent).position.set(x, 1.45, z-0.5);
  if (rng()<0.4) sph(0.4, fireMat, parent, 4).position.set(x, 1.5, z);
}

function buildBusWreck(parent, x, z) {
  box(3, 3, 10, rustMat, parent).position.set(x, 1.5, z);
  box(3, 2.5, 9.8, glassMat, parent).position.set(x, 3.25, z);
  const busFloor = box(3.2, 0.1, 10.2, concMat, parent);
  busFloor.position.set(x, 3.05, z);
  addShadow(busFloor);
  registerWallCollider(x-1.6, x+1.6, z-5.1, z+5.1);
  sph(0.6, fireMat, parent, 4).position.set(x, 1.5, z+4);
}

function buildApocalypseStore(parent, x, z, label) {
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

function buildCorpsePile(parent, x, z, rng) {
  const count = 1 + Math.floor(rng() * 3);
  for (let i = 0; i < count; i++) {
    const ox = (rng()-0.5)*1.8, oz = (rng()-0.5)*1.8;
    const angle = rng() * Math.PI * 2;
    // Torso
    const torso = box(0.42, 0.22, 0.72, zombieRagM, parent);
    torso.position.set(x + ox, 0.11, z + oz);
    torso.rotation.y = angle;
    // Head
    const head = sph(0.2, zombieSkinM, parent, 6);
    head.position.set(x + ox + Math.cos(angle)*0.45, 0.2, z + oz + Math.sin(angle)*0.45);
    // Arm
    const arm = box(0.14, 0.12, 0.55, zombieRagM, parent);
    arm.position.set(x + ox + Math.cos(angle+1.2)*0.5, 0.08, z + oz + Math.sin(angle+1.2)*0.5);
    arm.rotation.y = angle + 0.8 + (rng()-0.5)*0.6;
    // Blood puddle underneath
    const puddle = box(0.7 + rng()*0.6, 0.03, 0.5 + rng()*0.5, bloodMat, parent);
    puddle.position.set(x + ox, 0.02, z + oz);
  }
}

function mulberry32(seed) {
  return function() {
    seed += 0x6D2B79F5; let t = seed;
    t = Math.imul(t^t>>>15,t|1); t ^= t+Math.imul(t^t>>>7,t|61);
    return ((t^t>>>14)>>>0)/4294967296;
  };
}
