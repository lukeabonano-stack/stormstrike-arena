// ── maps/volcano.js  Volcano Island ──────────────────────────────────────────
import { scene, pbr, gnd, box, cyl, sph, hemi, cone, grp, addShadow, setFog } from '../engine.js';
import { gs, interactableObjects } from '../state.js';
import { registerWallCollider, registerMapGroup } from './index.js';

const basaltMat  = pbr(0x1a1210, 0.95, 0.05);
const darkRock   = pbr(0x282018, 0.92, 0.04);
const rockMat    = pbr(0x3a2a18, 0.90, 0.03);
const lavaMat    = pbr(0xff4400, 0.05, 0.0, { emissive: 0xff6600, emissiveIntensity: 2.5 });
const glowMat    = pbr(0xff2200, 0.05, 0.0, { emissive: 0xff2200, emissiveIntensity: 1.8 });
const ashMat     = pbr(0x4a4040, 0.98, 0);
const jungleMat  = pbr(0x1a6010, 0.8,  0);
const leaf1Mat   = pbr(0x2a8020, 0.7,  0);
const leaf2Mat   = pbr(0x3aaa20, 0.7,  0);
const stoneMat   = pbr(0x5a5048, 0.88, 0.04);
const ruinMat    = pbr(0x6a5840, 0.88, 0.02);
const storeMat   = pbr(0x3a2818, 0.85, 0.04);
const waterMat   = pbr(0x1a4060, 0.05, 0.4);

export function buildVolcanoMap() {
  const root = grp('volcano');
  setFog(0x1a0800, 12, 100);
  gnd(250, 250, basaltMat).parent = root;

  const rng = mulberry32(999);

  // Ocean ring (edges)
  const sea = box(250, 0.12, 35, waterMat, root);
  sea.position.set(0, -0.06, -95);

  // VOLCANO — central giant cone
  buildVolcanoCone(root);

  // Lava rivers flowing from volcano
  buildLavaRiver(root, 0, 30, 50, 4, 0);         // south
  buildLavaRiver(root, -18, 25, 38, 3.5, -0.55); // SW
  buildLavaRiver(root,  18, 25, 38, 3.5, 0.55);  // SE

  // Lava pools
  for (let i = 0; i < 8; i++) {
    const angle = (i/8)*Math.PI*2;
    const r = 40 + rng()*20;
    const lx = Math.cos(angle)*r, lz = Math.sin(angle)*r - 10;
    if (Math.hypot(lx, lz+10) < 28) continue;
    const pw = 5 + rng()*8, pd = 4 + rng()*7;
    const pool = box(pw, 0.1, pd, lavaMat, root);
    pool.position.set(lx, 0.06, lz);
  }

  // Ancient ruins (temple remnants)
  buildRuins(root, 55, 30, rng);
  buildRuins(root, -55, 25, rng);
  buildRuins(root, 20, -50, rng);

  // Jungle sections around edges
  const JUNGLE_ZONES = [[-70,50],[-70,-30],[70,50],[70,-30],[0,75],[-40,70],[40,70]];
  JUNGLE_ZONES.forEach(([jx, jz]) => {
    for (let i = 0; i < 8; i++) {
      const tx = jx + (rng()-0.5)*30, tz = jz + (rng()-0.5)*30;
      if (Math.hypot(tx, tz) < 35 || Math.hypot(tx, tz) > 105) continue;
      buildJungleTree(root, tx, tz, rng);
    }
  });

  // Volcanic rock formations (cover)
  for (let i = 0; i < 30; i++) {
    const rx = (rng()*2-1)*95, rz = (rng()*2-1)*95;
    if (Math.hypot(rx, rz) < 30) continue;
    const rw = 2 + rng()*5, rh = 2 + rng()*6, rd = 2 + rng()*5;
    const rock = box(rw, rh, rd, rng()<0.5 ? darkRock : rockMat, root);
    rock.position.set(rx, rh/2, rz);
    rock.rotation.y = rng()*Math.PI;
    addShadow(rock);
    registerWallCollider(rx - rw/2, rx + rw/2, rz - rd/2, rz + rd/2);
    // Ember glow cracks on some rocks
    if (rng() < 0.3) {
      const crack = box(rw*0.6, 0.1, 0.1, glowMat, root);
      crack.position.set(rx, rh*0.4, rz + rd/2 + 0.05);
    }
  }

  // Ash mounds
  for (let i = 0; i < 35; i++) {
    const mx = (rng()*2-1)*100, mz = (rng()*2-1)*100;
    if (Math.hypot(mx, mz) < 28) continue;
    const r = 3 + rng()*8;
    const mound = hemi(r, ashMat, root, 7);
    mound.position.set(mx, 0, mz);
    mound.scaling.y = 0.2 + rng()*0.25;
  }

  // Floating ember particles (static glowing spheres)
  for (let i = 0; i < 30; i++) {
    const ex = (rng()*2-1)*80, ez = (rng()*2-1)*80;
    const eh = 1 + rng()*5;
    const ember = sph(0.12 + rng()*0.18, rng()<0.5 ? lavaMat : glowMat, root, 4);
    ember.position.set(ex, eh, ez);
  }

  // Obsidian spires
  for (let i = 0; i < 15; i++) {
    const angle = (i/15)*Math.PI*2;
    const r = 45 + rng()*20;
    const sx = Math.cos(angle)*r, sz = Math.sin(angle)*r - 8;
    const sh = 5 + rng()*12;
    const spire = cone(1 + rng()*1.5, sh, darkRock, root, 4);
    spire.position.set(sx, sh/2, sz);
    spire.rotation.set((rng()-0.5)*0.2, rng()*Math.PI, 0);
    addShadow(spire);
    registerWallCollider(sx - 1.2, sx + 1.2, sz - 1.2, sz + 1.2);
  }

  buildVolcanoStore(root,  60, -30, 'Lava Forge');
  buildVolcanoStore(root, -60, -25, 'Ash Cache');
  buildVolcanoStore(root,   0,  75, 'Jungle Armory');
  buildVolcanoStore(root,  30,  60, 'Ruin Vault');

  registerMapGroup(root);
  gs.isInsideMapInterior = () => false;
}

function buildVolcanoCone(parent) {
  // Build volcano from stacked cones
  const layers = 14;
  for (let i = 0; i < layers; i++) {
    const t = i / layers;
    const r = 28 * (1 - t * 0.88);
    const h = 4;
    const mat = i < 4 ? rockMat : (i < 9 ? darkRock : basaltMat);
    const ring = cyl(r * 0.9, r, h, mat, parent, 16);
    ring.position.set(0, i * h, 0);
    if (i === 0) {
      registerWallCollider(-28, 28,  -28,  -27);
      registerWallCollider(-28, -27, -27,   28);
      registerWallCollider( 27,  28, -27,   28);
      registerWallCollider(-28,  -3,  27,   28);
      registerWallCollider(  3,  28,  27,   28);
    }
  }
  // Crater rim
  const rimH = layers * 4;
  const craterRim = cyl(5, 8, 3, darkRock, parent, 16);
  craterRim.position.set(0, rimH + 0.5, 0);

  // Lava in crater
  const lavaPool = cyl(4.5, 4.5, 1, lavaMat, parent, 16);
  lavaPool.position.set(0, rimH + 0.2, 0);

  // Lava glow above crater
  const glow = sph(6, pbr(0xff4400, 0.05, 0, { emissive: 0xff6600, emissiveIntensity: 0.6 }), parent, 10);
  glow.position.set(0, rimH + 8, 0);
  glow.scaling.y = 0.5;

  // Smoke puffs (dark spheres)
  const smokeMat = pbr(0x303030, 0.9, 0, { emissive: 0x111111, emissiveIntensity: 0.1 });
  for (let i = 0; i < 5; i++) {
    const sp = sph(1.5 + i*0.8, smokeMat, parent, 6);
    sp.position.set((i-2)*1.5, rimH + 10 + i*4, (i%2-0.5)*2);
    sp.scaling.set(1 + i*0.3, 0.7, 1 + i*0.3);
  }
}

function buildLavaRiver(parent, x, z, length, width, angle) {
  const river = box(width, 0.12, length, lavaMat, parent);
  river.position.set(x, 0.08, z + length/2);
  river.rotation.y = angle;
  // Lava banks (dark rock on sides)
  for (const side of [-1, 1]) {
    const bank = box(0.5, 0.3, length, darkRock, parent);
    bank.position.set(x + side*(width/2 + 0.25), 0.12, z + length/2);
    bank.rotation.y = angle;
  }
}

function buildRuins(parent, x, z, rng) {
  // Fallen columns, broken walls
  const positions = [[-3,0],[3,0],[0,-3],[0,3],[-3,-3],[3,3]];
  positions.forEach(([dx, dz], i) => {
    const h = 1 + rng() * 4;
    const col = cyl(0.7, 0.8, h, ruinMat, parent, 8);
    col.position.set(x + dx*2, h/2, z + dz*2);
    col.rotation.z = (rng()-0.5)*0.4;
    addShadow(col);
    if (i < 3) registerWallCollider(x+dx*2-0.9, x+dx*2+0.9, z+dz*2-0.9, z+dz*2+0.9);
  });
  // Stone altar
  const altar = box(5, 1.5, 5, stoneMat, parent);
  altar.position.set(x, 0.75, z);
  addShadow(altar);
  registerWallCollider(x-2.6, x+2.6, z-2.6, z+2.6);
  // Broken wall section
  const wall = box(8, 2.5, 0.8, ruinMat, parent);
  wall.position.set(x, 1.25, z + 6);
  wall.rotation.y = (rng()-0.5)*0.3;
  addShadow(wall);
  registerWallCollider(x-4, x+4, z+5.5, z+6.5);
  // Lava crack through ruins
  const crack = box(6, 0.08, 0.6, lavaMat, parent);
  crack.position.set(x, 0.06, z);
}

function buildJungleTree(parent, x, z, rng) {
  const h = 6 + rng()*6;
  const trunk = cyl(0.3, 0.45, h, jungleMat, parent, 6);
  trunk.position.set(x, h/2, z);
  addShadow(trunk);
  // Canopy layers
  for (let layer = 0; layer < 3; layer++) {
    const r = (2.5 - layer*0.6) * (1 - layer*0.1);
    const leaf = sph(r, layer%2===0 ? leaf1Mat : leaf2Mat, parent, 7);
    leaf.position.set(x + (rng()-0.5)*0.8, h - layer*1.2, z + (rng()-0.5)*0.8);
    leaf.scaling.set(1, 0.65, 1);
    addShadow(leaf);
  }
}

function buildVolcanoStore(parent, x, z, label) {
  [
    [x-5, z, 0.5, 10], [x+5, z, 0.5, 10], [x, z+5, 10, 0.5],
    [x-3, z-5, 3.5, 0.5], [x+3, z-5, 3.5, 0.5],
  ].forEach(([wx, wz, ww, wd]) => {
    box(ww, 4.5, wd, storeMat, parent).position.set(wx, 2.25, wz);
    registerWallCollider(wx - ww/2, wx + ww/2, wz - wd/2, wz + wd/2);
  });
  // Lava glow marker above door
  const glowOrb = sph(0.35, lavaMat, parent, 6);
  glowOrb.position.set(x, 5, z - 5);
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
