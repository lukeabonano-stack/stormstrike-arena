// ── maps/colosseum.js  Roman Colosseum Arena ──────────────────────────────────
import { scene, pbr, gnd, box, cyl, sph, cone, grp, addShadow, setFog } from '../engine.js';
import { gs, interactableObjects } from '../state.js';
import { registerWallCollider, registerMapGroup } from './index.js';

const traverMat = pbr(0xd4b878, 0.88, 0.03);
const darkTrav  = pbr(0xaa8848, 0.90, 0.03);
const sandMat   = pbr(0xd4b860, 0.98, 0);
const marbleMat = pbr(0xeeeedd, 0.3, 0.1);
const redMat    = pbr(0xcc2200, 0.6, 0.1);
const goldMat   = pbr(0xffd700, 0.15, 0.9, { emissive: 0xffcc00, emissiveIntensity: 0.5 });
const torchMat  = pbr(0xff8800, 0.1, 0, { emissive: 0xff6600, emissiveIntensity: 2 });
const ironMat   = pbr(0x333330, 0.5, 0.7);
const storeMat  = pbr(0xaa8848, 0.8, 0.04);

export function buildColosseumMap() {
  const root = grp('colosseum');
  setFog(0xd4b878, 22, 120);
  gnd(260, 260, sandMat).parent = root;

  const rng = mulberry32(123);

  // Arena floor (oval, approximated with a large flat disc)
  const arena = cyl(30, 30, 0.3, sandMat, root, 32);
  arena.position.set(0, 0.12, 0);

  // Arena walls (inner ring) — tall curved seating tiers
  const SEGS = 24;
  for (let i = 0; i < SEGS; i++) {
    const ang = (i/SEGS)*Math.PI*2;
    const nx = (i+1)/SEGS*Math.PI*2;
    const midAng = (ang+nx)/2;
    const r = 32;
    const x = Math.cos(midAng)*r, z = Math.sin(midAng)*r;
    const seg = box(8, 8, 6, traverMat, root);
    seg.position.set(x, 4, z);
    seg.rotation.y = midAng;
    addShadow(seg);
    registerWallCollider(x-4, x+4, z-4, z+4);

    // Second tier
    const seg2 = box(7.5, 5, 5, darkTrav, root);
    seg2.position.set(Math.cos(midAng)*36, 11, Math.sin(midAng)*36);
    seg2.rotation.y = midAng;
    addShadow(seg2);

    // Third tier
    const seg3 = box(7, 4, 4, traverMat, root);
    seg3.position.set(Math.cos(midAng)*39, 16, Math.sin(midAng)*39);
    seg3.rotation.y = midAng;

    // Arched openings (decorative columns)
    for (let j = 0; j < 2; j++) {
      const colAng = ang + (j+0.25)*(nx-ang)/0.5 * 0.1;
      const col = cyl(0.5, 0.6, 8, marbleMat, root, 8);
      col.position.set(Math.cos(ang+(j*0.04))*34, 4, Math.sin(ang+(j*0.04))*34);
    }
  }

  // 4 main entrances (gaps)
  // Already handled by the gap between seating segments

  // Central arena obstacles — ruined columns, statues
  for (let i = 0; i < 8; i++) {
    const ang = (i/8)*Math.PI*2 + 0.3;
    const r = 12 + rng()*10;
    const x = Math.cos(ang)*r, z = Math.sin(ang)*r;
    const h = 1+rng()*5;
    cyl(0.8, 1, h, marbleMat, root, 8).position.set(x, h/2, z);
    const cap = box(1, 0.4, 1, marbleMat, root);
    cap.position.set(x, h+0.2, z);
    addShadow(cap);
    registerWallCollider(x-1, x+1, z-1, z+1);
  }

  // Fallen column pieces
  for (let i = 0; i < 10; i++) {
    const ang = rng()*Math.PI*2, r = 8+rng()*18;
    const x = Math.cos(ang)*r, z = Math.sin(ang)*r;
    const col = cyl(0.7, 0.8, 3+rng()*4, marbleMat, root, 8);
    col.position.set(x, 0.5, z);
    col.rotation.z = Math.PI/2 + (rng()-0.5)*0.4;
    col.rotation.y = rng()*Math.PI;
  }

  // Banners on walls
  for (let i = 0; i < 12; i++) {
    const ang = (i/12)*Math.PI*2;
    const x = Math.cos(ang)*31, z = Math.sin(ang)*31;
    const banner = box(2.5, 5, 0.15, redMat, root);
    banner.position.set(x, 9, z);
    banner.rotation.y = ang;
    const pole = cyl(0.1, 0.1, 5.5, goldMat, root, 5);
    pole.position.set(x, 9.5, z);
    pole.rotation.y = ang;
  }

  // Torch stands
  for (let i = 0; i < 16; i++) {
    const ang = (i/16)*Math.PI*2;
    const x = Math.cos(ang)*29, z = Math.sin(ang)*29;
    cyl(0.1, 0.1, 2.5, ironMat, root, 5).position.set(x, 1.25, z);
    sph(0.25, torchMat, root, 5).position.set(x, 2.8, z);
  }

  // Emperor's box
  const box_throne = box(8, 4, 4, marbleMat, root);
  box_throne.position.set(0, 10, 35);
  addShadow(box_throne);
  // Throne
  box(2, 3, 1.5, goldMat, root).position.set(0, 11.5, 34.5);

  // Underground gate entrances
  for (const [gx, gz] of [[0, -30],[0, 30],[-30, 0],[30, 0]]) {
    const gate = box(5, 4, 0.5, ironMat, root);
    gate.position.set(gx, 2, gz);
    addShadow(gate);
    registerWallCollider(gx-2.5, gx+2.5, gz-0.5, gz+0.5);
  }

  // Scattered weapons/shields decorative
  for (let i = 0; i < 20; i++) {
    const ang = rng()*Math.PI*2, r = 5+rng()*22;
    const x = Math.cos(ang)*r, z = Math.sin(ang)*r;
    if (rng()<0.5) {
      box(0.1, 2.2, 0.8, ironMat, root).position.set(x, 1.1, z);
    } else {
      sph(0.7, ironMat, root, 5).position.set(x, 0.7, z);
    }
  }

  // Outer field ruins
  for (let i = 0; i < 15; i++) {
    const ang = rng()*Math.PI*2, r = 50+rng()*35;
    const rx = Math.cos(ang)*r, rz = Math.sin(ang)*r;
    const rw = 2+rng()*6, rh = 2+rng()*8;
    const ruin = box(rw, rh, 0.8, darkTrav, root);
    ruin.position.set(rx, rh/2, rz);
    ruin.rotation.y = rng()*Math.PI;
    addShadow(ruin); registerWallCollider(rx-rw/2, rx+rw/2, rz-0.6, rz+0.6);
  }

  buildColosseumStore(root, -55, -55, 'Gladiator Armory');
  buildColosseumStore(root,  55,  55, 'Tribune Cache');
  buildColosseumStore(root, -55,  55, 'Weapons Vault');

  registerMapGroup(root);
  gs.isInsideMapInterior = () => false;
}

function buildColosseumStore(parent, x, z, label) {
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
