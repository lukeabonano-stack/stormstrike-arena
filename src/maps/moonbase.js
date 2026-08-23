// ── maps/moonbase.js  Moon Base ───────────────────────────────────────────────
import { scene, pbr, gnd, box, cyl, sph, hemi, cone, grp, addShadow, setFog } from '../engine.js';
import { gs, interactableObjects } from '../state.js';
import { registerWallCollider, registerMapGroup } from './index.js';

const moonMat    = pbr(0xbbbbaa, 0.96, 0);
const darkMoon   = pbr(0x888878, 0.95, 0);
const metalMat   = pbr(0x667788, 0.45, 0.75);
const darkMetal  = pbr(0x334455, 0.4, 0.8);
const glassMat   = pbr(0x224488, 0.04, 0.3, { emissive: 0x4488ff, emissiveIntensity: 0.4 });
const redLightMat= pbr(0xff2200, 0.1, 0, { emissive: 0xff0000, emissiveIntensity: 2 });
const blueLightMat= pbr(0x0044ff, 0.1, 0, { emissive: 0x2266ff, emissiveIntensity: 2 });
const whiteLightMat= pbr(0xffffff, 0.1, 0, { emissive: 0xffffff, emissiveIntensity: 2.5 });
const solarMat   = pbr(0x224488, 0.3, 0.6, { emissive: 0x1133aa, emissiveIntensity: 0.5 });
const storeMat   = pbr(0x445566, 0.5, 0.6);

export function buildMoonBaseMap() {
  const root = grp('moonbase');
  setFog(0x000008, 30, 160);
  gnd(240, 240, moonMat).parent = root;

  const rng = mulberry32(2001);

  // Moon craters (hemis)
  for (let i = 0; i < 35; i++) {
    const cx = (rng()*2-1)*105, cz = (rng()*2-1)*105;
    const r = 3+rng()*12;
    if (Math.hypot(cx, cz) < 20) continue;
    const crater = hemi(r, darkMoon, root, 10);
    crater.position.set(cx, 0, cz);
    crater.rotation.x = Math.PI;
    crater.scaling.y = 0.18+rng()*0.12;
    // Crater rim
    cyl(r+0.4, r, 0.5, moonMat, root, 16).position.set(cx, 0.2, cz);
  }

  // Central base dome
  buildBaseDome(root, 0, 0);

  // Habitat modules
  buildHabitatModule(root, -20, 0);
  buildHabitatModule(root,  20, 0);
  buildHabitatModule(root,   0, -20);
  buildHabitatModule(root,   0,  20);

  // Connecting tunnels
  const t1 = cyl(2.2, 2.2, 18, metalMat, root, 12);
  t1.rotation.z = Math.PI/2; t1.position.set(-9, 1.8, 0);
  const t2 = cyl(2.2, 2.2, 18, metalMat, root, 12);
  t2.rotation.z = Math.PI/2; t2.position.set(9, 1.8, 0);
  const t3 = cyl(2.2, 2.2, 18, metalMat, root, 12);
  t3.rotation.x = Math.PI/2; t3.position.set(0, 1.8, -9);
  const t4 = cyl(2.2, 2.2, 18, metalMat, root, 12);
  t4.rotation.x = Math.PI/2; t4.position.set(0, 1.8, 9);

  // Solar panel arrays
  for (let i = 0; i < 6; i++) {
    const ang = (i/6)*Math.PI*2;
    const r = 50+rng()*15;
    const sx = Math.cos(ang)*r, sz = Math.sin(ang)*r;
    buildSolarArray(root, sx, sz, ang);
  }

  // Landing pad
  const pad = cyl(15, 15, 0.4, darkMetal, root, 16);
  pad.position.set(55, 0.2, 0);
  addShadow(pad);
  // Landing lights
  for (let i = 0; i < 8; i++) {
    const ang = (i/8)*Math.PI*2;
    sph(0.3, blueLightMat, root, 5).position.set(55+Math.cos(ang)*13, 0.5, Math.sin(ang)*13);
  }
  // Rocket on pad
  const rocket = cyl(2, 2.5, 12, metalMat, root, 10);
  rocket.position.set(55, 6.4, 0);
  addShadow(rocket);
  registerWallCollider(52, 58, -3, 3);
  cone(2.1, 4, darkMetal, root, 10).position.set(55, 14, 0);
  // Rocket fins
  for (let f = 0; f < 3; f++) {
    const ang = (f/3)*Math.PI*2;
    const fin = box(2, 3, 0.3, darkMetal, root);
    fin.position.set(55+Math.cos(ang)*2.2, 1.5, Math.sin(ang)*2.2);
    fin.rotation.y = ang;
  }
  // Engine glow
  sph(1.8, pbr(0xff6600, 0.1, 0, { emissive: 0xff4400, emissiveIntensity: 1.5 }), root, 8)
    .position.set(55, 0.6, 0);

  // Moon rocks scattered
  for (let i = 0; i < 40; i++) {
    const rx = (rng()*2-1)*100, rz = (rng()*2-1)*100;
    if (Math.hypot(rx, rz) < 25) continue;
    const rr = 0.8+rng()*2.5;
    const rock = sph(rr, rng()<0.5 ? moonMat : darkMoon, root, 5);
    rock.position.set(rx, rr*0.35, rz);
    rock.scaling.set(1+rng()*0.5, 0.6+rng()*0.3, 1+rng()*0.5);
    addShadow(rock);
    if (rr>1.5) registerWallCollider(rx-rr, rx+rr, rz-rr, rz+rr);
  }

  // Warning signs & lights
  for (let i = 0; i < 12; i++) {
    const wx = (rng()*2-1)*85, wz = (rng()*2-1)*85;
    cyl(0.08, 0.08, 3, metalMat, root, 4).position.set(wx, 1.5, wz);
    sph(0.2, i%2===0 ? redLightMat : blueLightMat, root, 4).position.set(wx, 3.3, wz);
  }

  buildMoonStore(root, -60, -50, 'Supply Cache');
  buildMoonStore(root,  60, -50, 'Lunar Armory');
  buildMoonStore(root,  -5,  70, 'Research Depot');

  registerMapGroup(root);
  gs.isInsideMapInterior = () => false;
}

function buildBaseDome(parent, x, z) {
  const dome = sph(14, glassMat, parent, 14);
  dome.position.set(x, 0, z);
  dome.scaling.y = 0.65;
  addShadow(dome);
  // Interior glow
  sph(12, pbr(0x0033aa, 0.05, 0, { emissive: 0x2255ff, emissiveIntensity: 0.15 }), parent, 12)
    .position.set(x, 0, z);
  // Ring around base
  cyl(14.5, 14.5, 0.5, darkMetal, parent, 24).position.set(x, 0.25, z);
  // Entry hatch
  box(3, 2.5, 0.5, darkMetal, parent).position.set(x, 1.25, z+14);
  sph(0.4, blueLightMat, parent, 5).position.set(x, 2.8, z+14);
}

function buildHabitatModule(parent, x, z) {
  const hab = cyl(6, 6, 5, metalMat, parent, 14);
  hab.position.set(x, 2.5, z);
  addShadow(hab); registerWallCollider(x-6.2, x+6.2, z-6.2, z+6.2);
  // Dome top
  const top = sph(6.1, glassMat, parent, 10);
  top.position.set(x, 5.2, z); top.scaling.y = 0.4;
  // Windows glow
  for (let i = 0; i < 5; i++) {
    const ang = (i/5)*Math.PI*2;
    sph(0.5, pbr(0xffcc44, 0.1, 0, { emissive: 0xffaa22, emissiveIntensity: 1 }), parent, 4)
      .position.set(x+Math.cos(ang)*5.8, 3, z+Math.sin(ang)*5.8);
  }
}

function buildSolarArray(parent, x, z, ang) {
  cyl(0.12, 0.12, 4, metalMat, parent, 4).position.set(x, 2, z);
  for (const side of [-1, 1]) {
    const panel = box(5, 0.12, 3, solarMat, parent);
    panel.position.set(x+Math.cos(ang)*side*3.5, 3.8, z+Math.sin(ang)*side*3.5);
    panel.rotation.y = ang;
  }
}

function buildMoonStore(parent, x, z, label) {
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
