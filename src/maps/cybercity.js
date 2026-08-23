// ── maps/cybercity.js  Neon Cyberpunk City ────────────────────────────────────
import { scene, pbr, gnd, box, cyl, sph, grp, addShadow, setFog } from '../engine.js';
import { gs, interactableObjects } from '../state.js';
import { registerWallCollider, registerMapGroup } from './index.js';

const groundMat    = pbr(0x080812, 0.95, 0.1);
const buildMat     = pbr(0x0d0d22, 0.8,  0.3);
const build2Mat    = pbr(0x120520, 0.8,  0.3);
const roadMat      = pbr(0x111118, 0.95, 0.05);
const cyanMat      = pbr(0x00ffee, 0.1,  0.9, { emissive: 0x00ffee, emissiveIntensity: 2.2 });
const pinkMat      = pbr(0xff00bb, 0.1,  0.9, { emissive: 0xff00bb, emissiveIntensity: 2.2 });
const purpleMat    = pbr(0x9900ff, 0.1,  0.9, { emissive: 0x9900ff, emissiveIntensity: 1.8 });
const yellowMat    = pbr(0xffcc00, 0.1,  0.9, { emissive: 0xffcc00, emissiveIntensity: 1.5 });
const winBlueMat   = pbr(0x002244, 0.1,  0.2, { emissive: 0x2266ff, emissiveIntensity: 0.6 });
const winOrangeMat = pbr(0x441100, 0.1,  0.2, { emissive: 0xff6600, emissiveIntensity: 0.5 });
const glassMat     = pbr(0x003355, 0.05, 0.8, { emissive: 0x00aaff, emissiveIntensity: 0.3 });
const storeMat     = pbr(0x1a0a2e, 0.6,  0.4);
const NEON = [cyanMat, pinkMat, purpleMat, yellowMat];

export function buildCyberCityMap() {
  const root = grp('cybercity');
  setFog(0x05010f, 12, 105);
  gnd(260, 260, groundMat).parent = root;

  // Road grid
  const roadDefs = [
    [0,0,260,8],[0,30,260,5],[0,-30,260,5],[0,60,260,5],[0,-60,260,5],
    [30,0,5,260],[-30,0,5,260],[60,0,5,260],[-60,0,5,260],
  ];
  roadDefs.forEach(([x,z,w,d]) => {
    const r = box(w, 0.06, d, roadMat, root);
    r.position.set(x, 0.02, z);
  });

  const rng = mulberry32(42);

  // Neon ground strips
  for (let i = 0; i < 60; i++) {
    const x = (rng() - 0.5) * 220, z = (rng() - 0.5) * 220;
    const s = box(3 + rng() * 10, 0.07, 0.12, NEON[i % 4], root);
    s.position.set(x, 0.1, z);
    s.rotation.y = rng() * Math.PI;
  }

  // Building zones [cx, cz, count, spread]
  const zones = [
    [45,45,12,22],[-45,45,12,22],[45,-45,12,22],[-45,-45,12,22],
    [80,0,8,18],[-80,0,8,18],[0,80,8,18],[0,-80,8,18],
    [0,0,6,14],
  ];
  zones.forEach(([cx,cz,count,spread]) => {
    for (let i = 0; i < count; i++) {
      const x = cx + (rng() - 0.5) * spread * 2;
      const z = cz + (rng() - 0.5) * spread * 2;
      const w = 5 + rng() * 9, d = 5 + rng() * 9, h = 10 + rng() * 30;
      const bld = box(w, h, d, rng() < 0.5 ? buildMat : build2Mat, root);
      bld.position.set(x, h / 2, z);
      addShadow(bld);
      registerWallCollider(x - w/2, x + w/2, z - d/2, z + d/2);
      // Window rows
      const winM = rng() < 0.5 ? winBlueMat : winOrangeMat;
      const rows = Math.floor(h / 2.5);
      for (let r = 0; r < rows; r++) {
        if (rng() < 0.25) continue;
        const win = box(w + 0.05, 0.35, 0.07, winM, root);
        win.position.set(x, 1.5 + r * 2.5, z + d / 2 + 0.04);
      }
      // Rooftop neon sign
      if (rng() < 0.45) {
        const sign = box(w, 0.3, 0.18, NEON[Math.floor(rng() * 4)], root);
        sign.position.set(x, h + 0.5, z + d / 2 + 0.1);
      }
    }
  });

  // Street lights
  for (let i = 0; i < 35; i++) {
    const x = (rng() - 0.5) * 200, z = (rng() - 0.5) * 200;
    cyl(0.07, 0.07, 5.5, buildMat, root, 6).position.set(x, 2.75, z);
    sph(0.28, NEON[i % 4], root, 6).position.set(x, 5.7, z);
  }

  // Holographic billboard frames
  for (let i = 0; i < 18; i++) {
    const x = (rng() - 0.5) * 185, z = (rng() - 0.5) * 185;
    const bw = 5 + rng() * 7, bh = 3 + rng() * 3, elev = 7 + rng() * 12;
    const nm = NEON[i % 4];
    box(bw, 0.2, 0.2, nm, root).position.set(x, elev + bh, z);
    box(bw, 0.2, 0.2, nm, root).position.set(x, elev, z);
    box(0.2, bh, 0.2, nm, root).position.set(x - bw/2, elev + bh/2, z);
    box(0.2, bh, 0.2, nm, root).position.set(x + bw/2, elev + bh/2, z);
    box(bw - 0.4, bh - 0.4, 0.05, glassMat, root).position.set(x, elev + bh/2, z);
  }

  // Antenna spires
  for (let i = 0; i < 12; i++) {
    const x = (rng() - 0.5) * 160, z = (rng() - 0.5) * 160;
    const h = 15 + rng() * 20;
    cyl(0.06, 0.12, h, NEON[i % 4], root, 4).position.set(x, h / 2 + 3, z);
  }

  buildCyberStore(root, -14, 0,   'NeonArms');
  buildCyberStore(root,  16, 14,  'CyberGear');
  buildCyberStore(root, -20, -16, 'DataVault');
  buildCyberStore(root,   0, -20, 'GridCache');

  registerMapGroup(root);
  gs.isInsideMapInterior = () => false;
}

function buildCyberStore(parent, x, z, label) {
  [
    [x-5, z, 0.5, 10], [x+5, z, 0.5, 10], [x, z+5, 10, 0.5],
    [x-3, z-5, 3.5, 0.5], [x+3, z-5, 3.5, 0.5],
  ].forEach(([wx, wz, ww, wd]) => {
    box(ww, 4, wd, storeMat, parent).position.set(wx, 2, wz);
    registerWallCollider(wx - ww/2, wx + ww/2, wz - wd/2, wz + wd/2);
  });
  box(6, 0.35, 0.18, cyanMat, parent).position.set(x, 4.6, z - 5.1);
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
