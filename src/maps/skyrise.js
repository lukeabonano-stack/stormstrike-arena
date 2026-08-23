// ── maps/skyrise.js  Skyscraper Rooftops ──────────────────────────────────────
import { scene, pbr, gnd, box, cyl, sph, cone, grp, addShadow, setFog } from '../engine.js';
import { gs, interactableObjects } from '../state.js';
import { registerWallCollider, registerMapGroup } from './index.js';

const concMat   = pbr(0x7a7a80, 0.88, 0.06);
const darkConc  = pbr(0x444450, 0.90, 0.06);
const glassMat  = pbr(0x2244aa, 0.05, 0.5, { emissive: 0x1133aa, emissiveIntensity: 0.35 });
const steelMat  = pbr(0x6678aa, 0.4, 0.75);
const acMat     = pbr(0x8899aa, 0.55, 0.5);
const skyMat    = pbr(0x050a15, 0.95, 0.02);
const neonRed   = pbr(0xff2200, 0.1, 0, { emissive: 0xff0000, emissiveIntensity: 2 });
const neonBlue  = pbr(0x2244ff, 0.1, 0, { emissive: 0x1133ff, emissiveIntensity: 2 });
const neonWhite = pbr(0xffffff, 0.1, 0, { emissive: 0xffffff, emissiveIntensity: 2.5 });
const heliMat   = pbr(0xdd2200, 0.6, 0.1);
const bridgeMat = pbr(0x556688, 0.55, 0.6);
const storeMat  = pbr(0x334455, 0.7, 0.4);

export function buildSkyRiseMap() {
  const root = grp('skyrise');
  setFog(0x050a15, 20, 140);

  // Deep city floor far below — player never reaches it
  const floor = gnd(500, 500, skyMat);
  floor.parent = root;
  floor.position.y = -65;

  const rng = mulberry32(5050);

  // ── All rooftop surfaces are at y = 0 (player ground level) ──────────────
  // Shaft depth controls how far the building extends downward (visual only)
  buildRooftop(root, 0, 0, 50, 50, 32, rng);        // central tower

  const ROOFS = [
    [-60,  0,  35, 30, 20],
    [ 60,  0,  30, 35, 26],
    [  0,-60,  40, 32, 14],
    [  0, 60,  35, 40, 28],
    [-65,-55,  28, 28, 16],
    [ 65,-55,  32, 28, 22],
    [-65, 55,  28, 32, 24],
    [ 65, 55,  30, 28, 30],
    [-30,-80,  25, 25, 10],
    [ 30,-80,  22, 25, 18],
    [-30, 80,  25, 22, 12],
    [ 30, 80,  25, 25, 26],
    [-100, 0,  22, 40, 12],
    [ 100, 0,  22, 40, 28],
  ];
  for (const [rx, rz, rw, rd, rdepth] of ROOFS) {
    buildRooftop(root, rx, rz, rw, rd, rdepth, rng);
  }

  // Flat sky-bridges connecting rooftops at y = 0
  buildSkybridges(root);

  // Helicopters sitting on the central roof and one far roof
  buildHelicopter(root, 8, 8);
  buildHelicopter(root, 68, 58);

  // Antenna spires (rise upward from y = 0)
  buildAntenna(root,   0,   0, 22);
  buildAntenna(root,  60,   0, 18);
  buildAntenna(root, -60,  55, 14);

  // Wind turbines around the perimeter
  for (let i = 0; i < 6; i++) {
    const ang = (i / 6) * Math.PI * 2;
    const r   = 85 + rng() * 15;
    buildWindTurbine(root, Math.cos(ang) * r, Math.sin(ang) * r, rng);
  }

  // Water towers on various rooftops
  for (const [wx, wz] of [[30,-60],[-30,60],[80,-20],[-80,20]]) {
    cyl(0.15, 0.15, 5, steelMat, root, 6).position.set(wx,  2.5, wz);
    cyl(0.15, 0.15, 5, steelMat, root, 6).position.set(wx+3,2.5, wz);
    cyl(0.15, 0.15, 5, steelMat, root, 6).position.set(wx-1.5,2.5,wz+2.5);
    cyl(3, 4, 6, acMat,   root, 12).position.set(wx+0.5,  6, wz);
    cone(4.2, 2.5, concMat, root, 12).position.set(wx+0.5, 9.5, wz);
  }

  // City lights far below (through glass shafts)
  for (let i = 0; i < 150; i++) {
    const lx = (rng()*2-1)*130, lz = (rng()*2-1)*130;
    const ly = -12 - rng() * 18;
    sph(0.3 + rng()*0.4, rng() < 0.5 ? neonWhite : neonBlue, root, 4)
      .position.set(lx, ly, lz);
  }

  // Rooftop stores
  buildSkyRiseStore(root, -60,  0, 'Rooftop Cache');
  buildSkyRiseStore(root,  60,  0, 'Penthouse Vault');
  buildSkyRiseStore(root,   0,-60, 'Sky Armory');
  buildSkyRiseStore(root,   0, 60, 'Cloud Depot');

  registerMapGroup(root);
  // Reject spawns in the void between rooftops — only allow positions on an actual roof surface
  const ALL_ROOFTOPS = [[0, 0, 50, 50], ...ROOFS.map(([rx, rz, rw, rd]) => [rx, rz, rw, rd])];
  gs.isInsideMapInterior = (x, z) => !ALL_ROOFTOPS.some(([rx, rz, rw, rd]) =>
    Math.abs(x - rx) < rw/2 - 1.5 && Math.abs(z - rz) < rd/2 - 1.5
  );
}

// ── Rooftop — surface at y=0, shaft drops downward ───────────────────────────
function buildRooftop(parent, x, z, w, d, depth, rng) {
  // Glass building shaft going DOWN (purely visual)
  const shaft = box(w - 2, depth, d - 2, glassMat, parent);
  shaft.position.set(x, -depth / 2, z);

  // Roof slab flush with y=0 (player walks on top of this)
  const roof = box(w, 0.5, d, concMat, parent);
  roof.position.set(x, -0.25, z);
  addShadow(roof);
  // ⚠ NO registerWallCollider here — the slab is the floor, not a wall

  // Low parapets around the edge (visual; MAP_RADIUS keeps player contained)
  const parapets = [
    [x,      z - d/2, w + 0.4, 0.7],
    [x,      z + d/2, w + 0.4, 0.7],
    [x - w/2, z,      0.7,     d  ],
    [x + w/2, z,      0.7,     d  ],
  ];
  for (const [px, pz, pw, pd] of parapets) {
    const p = box(pw, 1.4, pd, darkConc, parent);
    p.position.set(px, 0.7, pz);
    addShadow(p);
    registerWallCollider(px - pw/2, px + pw/2, pz - pd/2, pz + pd/2);
  }

  // AC units / vent boxes on the roof surface
  const count = Math.floor((w * d) / 100);
  for (let i = 0; i < count; i++) {
    const ax = x + (rng() - 0.5) * w * 0.72;
    const az = z + (rng() - 0.5) * d * 0.72;
    const aw = 1.8 + rng() * 2, ah = 1.2 + rng() * 1.2, ad = 1.2 + rng() * 1.5;
    const ac = box(aw, ah, ad, acMat, parent);
    ac.position.set(ax, ah / 2, az);
    registerWallCollider(ax - aw/2, ax + aw/2, az - ad/2, az + ad/2);
  }

  // Helipad H marking on some rooftops
  if (rng() < 0.35) {
    box(w * 0.55, 0.06, 0.5, neonWhite, parent).position.set(x, 0.04, z);
    box(0.5, 0.06, d * 0.55, neonWhite, parent).position.set(x, 0.04, z);
  }
}

// ── Flat sky-bridges at y = 0 ─────────────────────────────────────────────────
function buildSkybridges(root) {
  const bridges = [
    [-25, 0,  25,  0,  8],
    [  0,-25,  0, 25,  8],
    [ 25, 0,  45,  0,  4],
    [-25, 0, -47,  0,  6],
    [  0,25,   0, 47,  4],
    [ 45, 0,  82,  0,  5],
    [ 25, 0,  25,-40,  3],
  ];
  for (const [x1, z1, x2, z2, halfW] of bridges) {
    const dx = x2 - x1, dz = z2 - z1;
    const len = Math.sqrt(dx * dx + dz * dz);
    const ang = Math.atan2(dz, dx);

    const bridge = box(len, 0.4, halfW * 2, bridgeMat, root);
    bridge.position.set((x1 + x2) / 2, -0.2, (z1 + z2) / 2);
    bridge.rotation.y = -ang;
    addShadow(bridge);

    // Safety railings
    for (const side of [-1, 1]) {
      const rail = box(len, 1.1, 0.18, steelMat, root);
      rail.position.set((x1+x2)/2, 0.55, (z1+z2)/2 + side * halfW);
      rail.rotation.y = -ang;
    }
  }
}

// ── Helicopter on a rooftop (base at y = 0) ───────────────────────────────────
function buildHelicopter(parent, x, z) {
  const y = 1.0;
  box(6, 1.2, 2.2, heliMat, parent).position.set(x, y, z);
  box(2.5, 1.5, 1.8, heliMat, parent).position.set(x - 0.5, y + 1.35, z);
  box(3, 0.2, 0.2, steelMat, parent).position.set(x, y + 2.5, z);
  box(0.15, 0.15, 4.5, steelMat, parent).position.set(x + 3.5, y + 0.5, z);
  sph(0.3, neonRed,   parent, 4).position.set(x + 4.5, y + 0.6, z);
  sph(0.3, neonWhite, parent, 4).position.set(x - 3.2, y + 0.6, z);
}

// ── Antenna spire (base at y = 0) ────────────────────────────────────────────
function buildAntenna(parent, x, z, totalH) {
  const baseH = totalH * 0.5;
  cyl(0.8, 1, baseH, concMat, parent, 8).position.set(x, baseH / 2, z);
  registerWallCollider(x - 1, x + 1, z - 1, z + 1);
  cyl(0.25, 0.4, totalH * 0.5, steelMat, parent, 6).position.set(x, baseH + totalH * 0.25, z);
  sph(0.5, neonRed, parent, 5).position.set(x, totalH, z);
  for (let i = 0; i < 3; i++) {
    cyl(0.5, 0.5, 0.3, neonRed, parent, 8).position.set(x, baseH * 0.3 + i * totalH * 0.2, z);
  }
}

// ── Wind turbine (base at y = 0) ─────────────────────────────────────────────
function buildWindTurbine(parent, x, z, rng) {
  const h = 14 + rng() * 8;
  cyl(0.35, 0.5, h, steelMat, parent, 8).position.set(x, h / 2, z);
  registerWallCollider(x - 0.6, x + 0.6, z - 0.6, z + 0.6);
  for (let b = 0; b < 3; b++) {
    const ang = (b / 3) * Math.PI * 2;
    const blade = box(0.5, 0.12, 5, concMat, parent);
    blade.position.set(x + Math.cos(ang) * 2.5, h + 1, z + Math.sin(ang) * 2.5);
    blade.rotation.y = ang;
  }
}

// ── Rooftop store (at y = 0) ─────────────────────────────────────────────────
function buildSkyRiseStore(parent, x, z, label) {
  const walls = [
    [x - 5, z,     0.5, 10],
    [x + 5, z,     0.5, 10],
    [x,     z + 5, 10,  0.5],
    [x - 3, z - 5, 3.5, 0.5],
    [x + 3, z - 5, 3.5, 0.5],
  ];
  walls.forEach(([wx, wz, ww, wd]) => {
    box(ww, 4, wd, storeMat, parent).position.set(wx, 2, wz);
    registerWallCollider(wx - ww/2, wx + ww/2, wz - wd/2, wz + wd/2);
  });
  const t = new BABYLON.TransformNode('t', scene);
  t.parent = parent;
  t.position.set(x, 1, z - 4);
  t.label = label;
  t.onInteract = () => window.__openArmory?.();
  interactableObjects.push(t);
}

function mulberry32(seed) {
  return function() {
    seed += 0x6D2B79F5; let t = seed;
    t = Math.imul(t ^ t >>> 15, t | 1); t ^= t + Math.imul(t ^ t >>> 7, t | 61);
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}
