// ── maps/egypt.js  Ancient Egypt ─────────────────────────────────────────────
import { scene, pbr, gnd, box, cyl, sph, hemi, cone, grp, addShadow, setFog } from '../engine.js';
import { gs, interactableObjects } from '../state.js';
import { registerWallCollider, registerMapGroup } from './index.js';

const sandMat      = pbr(0xe8c570, 0.98, 0);
const stoneMat     = pbr(0xc8a040, 0.92, 0.02);
const darkStoneMat = pbr(0x9a7830, 0.90, 0.02);
const goldMat      = pbr(0xffd700, 0.15, 0.95, { emissive: 0xffcc00, emissiveIntensity: 0.7 });
const waterMat     = pbr(0x1a5580, 0.08, 0.4);
const palmMat      = pbr(0x6a4020, 0.85, 0);
const palmLeafMat  = pbr(0x3a8a30, 0.7,  0);
const hieroglyphMat= pbr(0xb89040, 0.85, 0.05, { emissive: 0xd4aa50, emissiveIntensity: 0.15 });

export function buildEgyptMap() {
  const root = grp('egypt');
  setFog(0xe8c570, 20, 115);
  gnd(260, 260, sandMat).parent = root;

  const rng = mulberry32(888);

  // Nile river strip
  const nile = box(260, 0.12, 20, waterMat, root);
  nile.position.set(0, 0.05, -52);

  // Great Pyramid
  buildPyramid(root, 0, 30, 24, 18);
  buildPyramid(root, 38, 22, 16, 12);
  buildPyramid(root, 64, 18, 12, 9);
  buildPyramid(root, -50, 50, 10, 7);

  // Gold capstone on great pyramid
  const cap = cone(1.6, 2.8, goldMat, root, 4);
  cap.position.set(0, 18 + 1.4, 30);
  cap.rotation.y = Math.PI / 4;

  // Sphinx
  buildSphinx(root, 22, 4);

  // Obelisk avenue
  for (let i = 0; i < 6; i++) {
    buildObelisk(root, -50 + i * 22, -16);
  }

  // Temple colonnade
  for (let i = 0; i < 8; i++) {
    const cx = -49 + i * 14, cz = 75;
    cyl(1.3, 1.5, 8, stoneMat, root, 8).position.set(cx, 4, cz);
    const cap2 = box(3.2, 0.9, 3.2, darkStoneMat, root);
    cap2.position.set(cx, 8.4, cz);
    addShadow(cap2);
    registerWallCollider(cx - 1.6, cx + 1.6, cz - 1.6, cz + 1.6);
  }
  // Colonnade beams
  for (let i = 0; i < 7; i++) {
    const beam = box(14, 0.6, 2.2, darkStoneMat, root);
    beam.position.set(-42 + i * 14, 8.9, 75);
  }

  // Entrance pylons
  buildPylon(root, -22, 5);
  buildPylon(root, 22, -22);

  // Sand dunes (visual)
  for (let i = 0; i < 50; i++) {
    const dx = (rng() * 2 - 1) * 115, dz = (rng() * 2 - 1) * 115;
    if (Math.abs(dz + 52) < 12) continue;
    const r = 5 + rng() * 12;
    const dune = hemi(r, sandMat, root, 8);
    dune.position.set(dx, 0, dz);
    dune.scaling.y = 0.28 + rng() * 0.2;
  }

  // Palm groves along Nile banks
  for (let i = 0; i < 16; i++) {
    const px = -110 + i * 15 + rng() * 5;
    buildPalmTree(root, px, -40, rng);
    buildPalmTree(root, px + rng() * 4, -64, rng);
  }

  // Standing stelae / stone markers
  for (let i = 0; i < 24; i++) {
    const sx = (rng() * 2 - 1) * 105, sz = (rng() * 2 - 1) * 105;
    if (Math.hypot(sx, sz - 30) < 28) continue;
    const sw = 0.8 + rng() * 1.4, sh = 2 + rng() * 4;
    const stele = box(sw, sh, 0.5, darkStoneMat, root);
    stele.position.set(sx, sh / 2, sz);
    stele.rotation.y = rng() * Math.PI;
  }

  // Decorative urns / jars
  for (let i = 0; i < 20; i++) {
    const ux = (rng() * 2 - 1) * 90, uz = (rng() * 2 - 1) * 90;
    const urn = sph(0.5, hieroglyphMat, root, 6);
    urn.position.set(ux, 0.5, uz);
    urn.scaling.y = 1.5;
  }

  buildEgyptStore(root, -30, -8,  'Cairo Market');
  buildEgyptStore(root,  30, -6,  "Pharaoh's Vault");
  buildEgyptStore(root,   0, 90,  'Temple Cache');
  buildEgyptStore(root, -75, 20,  'Desert Bazaar');

  registerMapGroup(root);
  gs.isInsideMapInterior = () => false;
}

function buildPyramid(parent, x, z, base, h) {
  const layers = 10;
  for (let i = 0; i < layers; i++) {
    const t = i / layers;
    const s = base * (1 - t * 0.95);
    const layer = box(s, h / layers, s, i % 2 === 0 ? stoneMat : darkStoneMat, parent);
    layer.position.set(x, (i + 0.5) * (h / layers), z);
    if (i === 0) {
      addShadow(layer);
      registerWallCollider(x - base/2, x + base/2, z - base/2, z + base/2);
    }
  }
}

function buildSphinx(parent, x, z) {
  const body = box(12, 3.5, 4.5, stoneMat, parent);
  body.position.set(x, 1.75, z);
  addShadow(body);
  registerWallCollider(x - 6, x + 6, z - 2.3, z + 2.3);
  const head = sph(2.2, stoneMat, parent, 10);
  head.position.set(x + 6.5, 5, z);
  head.scaling.set(1, 1.15, 0.92);
  const headdress = box(2.8, 4.5, 1.2, darkStoneMat, parent);
  headdress.position.set(x + 6.5, 5.8, z);
  const paw1 = box(3.5, 1, 1.8, stoneMat, parent);
  paw1.position.set(x + 8.5, 0.5, z - 1.5);
  const paw2 = box(3.5, 1, 1.8, stoneMat, parent);
  paw2.position.set(x + 8.5, 0.5, z + 1.5);
  // Beard
  const beard = box(0.8, 2, 0.6, darkStoneMat, parent);
  beard.position.set(x + 6.5, 3, z);
}

function buildObelisk(parent, x, z) {
  const shaft = box(1.6, 14, 1.6, stoneMat, parent);
  shaft.position.set(x, 7, z);
  addShadow(shaft);
  registerWallCollider(x - 0.9, x + 0.9, z - 0.9, z + 0.9);
  const tip = cone(0.9, 2.2, goldMat, parent, 4);
  tip.position.set(x, 15.1, z);
  tip.rotation.y = Math.PI / 4;
  // Base pedestal
  const base = box(2.6, 1, 2.6, darkStoneMat, parent);
  base.position.set(x, 0.5, z);
}

function buildPylon(parent, x, z) {
  for (const side of [-5, 5]) {
    const wall = box(4, 12, 6, stoneMat, parent);
    wall.position.set(x + side, 6, z);
    addShadow(wall);
    registerWallCollider(x + side - 2, x + side + 2, z - 3, z + 3);
    const banner = box(0.2, 9, 0.5, goldMat, parent);
    banner.position.set(x + side, 6, z - 3.1);
    const flagTop = box(4.2, 0.5, 0.3, goldMat, parent);
    flagTop.position.set(x + side, 12.5, z - 3.1);
  }
}

function buildPalmTree(parent, x, z, rng) {
  const h = 5 + rng() * 3.5;
  const trunk = cyl(0.2, 0.3, h, palmMat, parent, 6);
  trunk.position.set(x, h/2, z);
  trunk.rotation.z = (rng() - 0.5) * 0.28;
  for (let f = 0; f < 7; f++) {
    const angle = (f / 7) * Math.PI * 2;
    const frond = box(0.12, 0.08, 3, palmLeafMat, parent);
    frond.position.set(x + Math.cos(angle)*1.3, h, z + Math.sin(angle)*1.3);
    frond.rotation.set(-0.45, angle, 0.1);
  }
}

function buildEgyptStore(parent, x, z, label) {
  [
    [x-5, z, 0.5, 10], [x+5, z, 0.5, 10], [x, z+5, 10, 0.5],
    [x-3, z-5, 3.5, 0.5], [x+3, z-5, 3.5, 0.5],
  ].forEach(([wx, wz, ww, wd]) => {
    box(ww, 4.5, wd, stoneMat, parent).position.set(wx, 2.25, wz);
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
