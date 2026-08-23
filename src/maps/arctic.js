// ── maps/arctic.js  Arctic Research Station ───────────────────────────────────
import { scene, pbr, gnd, box, cyl, sph, hemi, cone, grp, addShadow, setFog } from '../engine.js';
import { gs, interactableObjects } from '../state.js';
import { registerWallCollider, registerMapGroup } from './index.js';

const snowMat    = pbr(0xddeeff, 0.95, 0);
const iceMat     = pbr(0x88ccee, 0.08, 0.25, { emissive: 0x99ddff, emissiveIntensity: 0.2 });
const deepIceMat = pbr(0x4488aa, 0.06, 0.3,  { emissive: 0x55aacc, emissiveIntensity: 0.15 });
const metalMat   = pbr(0x445566, 0.5,  0.7);
const darkMetal  = pbr(0x223344, 0.4,  0.8);
const redMat     = pbr(0xcc2200, 0.5,  0.2);
const yellowMat  = pbr(0xffcc00, 0.3,  0.1, { emissive: 0xffaa00, emissiveIntensity: 0.5 });
const frostMat   = pbr(0xaaccee, 0.3,  0.05);
const waterMat   = pbr(0x224466, 0.05, 0.5);
const storeMat   = pbr(0x334455, 0.5,  0.5);

export function buildArcticMap() {
  const root = grp('arctic');
  setFog(0xaaccdd, 10, 95);
  gnd(240, 240, snowMat).parent = root;

  const rng = mulberry32(314);

  // Frozen lake (center)
  const lake = box(50, 0.1, 40, iceMat, root);
  lake.position.set(0, 0.04, -20);

  // Cracks in ice (decorative lines)
  for (let i = 0; i < 10; i++) {
    const crack = box(8 + rng()*12, 0.06, 0.12, deepIceMat, root);
    crack.position.set((rng()-0.5)*40, 0.07, -20 + (rng()-0.5)*30);
    crack.rotation.y = rng() * Math.PI;
  }

  // Main research station complex
  buildResearchStation(root, -25, 20);

  // Radar / satellite dishes
  buildRadarDish(root, 30, 25);
  buildRadarDish(root, -40, -25);
  buildRadarDish(root, 50, -10);

  // Ice walls and icebergs (cover)
  for (let i = 0; i < 22; i++) {
    const ix = (rng()*2-1)*90, iz = (rng()*2-1)*90;
    if (Math.hypot(ix, iz + 20) < 28) continue;
    buildIceFormation(root, ix, iz, rng);
  }

  // Snow mounds
  for (let i = 0; i < 50; i++) {
    const mx = (rng()*2-1)*100, mz = (rng()*2-1)*100;
    const r = 3 + rng() * 8;
    const mound = hemi(r, snowMat, root, 8);
    mound.position.set(mx, 0, mz);
    mound.scaling.y = 0.3 + rng() * 0.3;
  }

  // Supply crates scattered
  for (let i = 0; i < 18; i++) {
    const cx = (rng()*2-1)*80, cz = (rng()*2-1)*80;
    const crate = box(1.2, 1, 1.2, rng()<0.5 ? metalMat : redMat, root);
    crate.position.set(cx, 0.5, cz);
    addShadow(crate);
    registerWallCollider(cx - 0.7, cx + 0.7, cz - 0.7, cz + 0.7);
  }

  // Warning signs on poles
  for (let i = 0; i < 12; i++) {
    const px = (rng()*2-1)*85, pz = (rng()*2-1)*85;
    cyl(0.07, 0.07, 3, metalMat, root, 4).position.set(px, 1.5, pz);
    const sign = box(0.9, 0.6, 0.08, yellowMat, root);
    sign.position.set(px, 3.2, pz);
  }

  // Fuel barrels
  for (let i = 0; i < 20; i++) {
    const bx = (rng()*2-1)*75, bz = (rng()*2-1)*75;
    const barrel = cyl(0.4, 0.4, 1, rng()<0.5 ? redMat : darkMetal, root, 8);
    barrel.position.set(bx, 0.5, bz);
    barrel.rotation.x = rng() < 0.3 ? Math.PI/2 : 0;
    addShadow(barrel);
  }

  // Icy stalagmites near lake
  for (let i = 0; i < 14; i++) {
    const angle = (i/14) * Math.PI * 2;
    const r = 26 + rng()*4;
    const sx = Math.cos(angle)*r, sz = -20 + Math.sin(angle)*r;
    const sh = 1.5 + rng()*3;
    const spike = cone(0.4, sh, iceMat, root, 5);
    spike.position.set(sx, sh/2, sz);
    spike.rotation.set((rng()-0.5)*0.3, rng()*Math.PI, 0);
  }

  buildArcticStore(root,  25, -55, 'Cold Weather Depot');
  buildArcticStore(root, -25,  60, 'Arctic Arms');
  buildArcticStore(root,  60,  30, 'Polar Cache');

  registerMapGroup(root);
  gs.isInsideMapInterior = () => false;
}

function buildResearchStation(parent, x, z) {
  // Main lab building
  const lab = box(16, 4.5, 10, metalMat, parent);
  lab.position.set(x, 2.25, z);
  addShadow(lab);
  registerWallCollider(x-8, x+8, z-5, z+5);

  // Roof details
  const roof = box(17, 0.4, 11, darkMetal, parent);
  roof.position.set(x, 4.7, z);

  // Windows - lit warm orange
  const winMat = pbr(0x443300, 0.1, 0.1, { emissive: 0xffaa44, emissiveIntensity: 0.8 });
  for (let i = 0; i < 4; i++) {
    const win = box(1.8, 1.4, 0.08, winMat, parent);
    win.position.set(x - 5 + i * 3.5, 2.5, z + 5.05);
  }

  // Connecting tunnel to annex
  const tunnel = box(6, 2.5, 3, metalMat, parent);
  tunnel.position.set(x + 11, 1.25, z);
  registerWallCollider(x+8, x+14, z-1.6, z+1.6);

  // Annex building
  const annex = box(6, 3.5, 7, darkMetal, parent);
  annex.position.set(x + 17, 1.75, z);
  addShadow(annex);
  registerWallCollider(x+14, x+20, z-3.6, z+3.6);

  // Chimney / exhaust stack
  cyl(0.4, 0.5, 6, darkMetal, parent, 8).position.set(x+3, 7, z-3);

  // Antenna mast
  cyl(0.08, 0.08, 10, metalMat, parent, 4).position.set(x-5, 9.5, z);
  // Cross arms
  box(3, 0.1, 0.1, metalMat, parent).position.set(x-5, 13, z);
  box(3, 0.1, 0.1, metalMat, parent).position.set(x-5, 11.5, z);

  // Red warning light on mast top
  sph(0.2, pbr(0xff2200, 0.1, 0, { emissive: 0xff0000, emissiveIntensity: 2 }), parent, 5)
    .position.set(x-5, 14.5, z);
}

function buildRadarDish(parent, x, z) {
  cyl(0.2, 0.2, 3, metalMat, parent, 6).position.set(x, 1.5, z);
  const dish = sph(2, frostMat, parent, 10);
  dish.position.set(x, 3.5, z);
  dish.scaling.set(1, 0.3, 1);
  dish.rotation.x = 0.6;
  registerWallCollider(x-0.5, x+0.5, z-0.5, z+0.5);
}

function buildIceFormation(parent, x, z, rng) {
  const w = 1.5 + rng()*3.5, h = 2 + rng()*5, d = 1.5 + rng()*3;
  const ice = box(w, h, d, rng()<0.6 ? iceMat : deepIceMat, parent);
  ice.position.set(x, h/2, z);
  ice.rotation.y = rng() * Math.PI;
  addShadow(ice);
  registerWallCollider(x - w/2, x + w/2, z - d/2, z + d/2);
  // Smaller accent shard
  if (rng() < 0.5) {
    const sw = w*0.5, sh = h*0.6, sd = d*0.5;
    const shard = box(sw, sh, sd, iceMat, parent);
    shard.position.set(x + (rng()-0.5)*w, sh/2, z + (rng()-0.5)*d);
    shard.rotation.y = rng() * Math.PI;
    shard.rotation.z = (rng()-0.5) * 0.4;
  }
}

function buildArcticStore(parent, x, z, label) {
  [
    [x-5, z, 0.5, 10], [x+5, z, 0.5, 10], [x, z+5, 10, 0.5],
    [x-3, z-5, 3.5, 0.5], [x+3, z-5, 3.5, 0.5],
  ].forEach(([wx, wz, ww, wd]) => {
    box(ww, 4, wd, storeMat, parent).position.set(wx, 2, wz);
    registerWallCollider(wx - ww/2, wx + ww/2, wz - wd/2, wz + wd/2);
  });
  const t = new BABYLON.TransformNode('t', scene);
  t.parent = parent; t.position.set(x, 1, z - 4);
  t.label = label; t.onInteract = () => window.__openArmory?.();
  interactableObjects.push(t);
}

function mulberry32(seed) {
  return function() {
    seed += 0x6D2B79F5; let t = seed;
    t = Math.imul(t ^ t >>> 15, t | 1);
    t ^= t + Math.imul(t ^ t >>> 7, t | 61);
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}
