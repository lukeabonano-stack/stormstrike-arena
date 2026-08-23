// ── player.js  Character rig, player init, VIP, armor ────────────────────────
import { scene, previewScene, box, cyl, sph, capsule, grp, cloneM, pbr, c3, addShadow } from './engine.js';
import { player, gs, equipped, inventory, GIANT_SCALE, saveEquipped } from './state.js';
import { WEAPON_DEFS, rebuildGunVisual } from './armory/weapons.js';
import { ARMOR_DEFS, buildArmorMesh } from './armory/armor.js';
import { CLOTHES_DEFS, applyClothesAccessories, applyClothesMaterialStyle } from './armory/clothes.js';

// ── Shared player materials ───────────────────────────────────────────────────
export const playerClothMat = pbr(
  (CLOTHES_DEFS[equipped.clothes] || CLOTHES_DEFS.default).color, 0.72, 0.02);
export const playerSkinMat  = pbr(0xe4e0d8, 0.28, 0.01);   // Ghost Skull: bone-white
export const playerHatMat   = pbr(0x060710, 0.55, 0.06);   // Ghost Skull: near-black cap

export const enemySkinMat   = pbr(0xe3b89c, 0.45, 0.02);   // warm skin for enemies

// ── Face helpers (shared across humanoids) ────────────────────────────────────
function addEyes(headMesh, sc) {
  const eyeMat = new BABYLON.PBRMaterial('eye', sc);
  eyeMat.albedoColor = new BABYLON.Color3(0.05, 0.05, 0.08);
  eyeMat.roughness = 0.3; eyeMat.metallic = 0.05;
  const eyeL = BABYLON.MeshBuilder.CreateSphere('eyeL', { diameter: 0.09, segments: 6 }, sc);
  eyeL.material = eyeMat; eyeL.parent = headMesh;
  eyeL.position.set(-0.065, 0.02, 0.175);
  const eyeR = eyeL.clone('eyeR'); eyeR.parent = headMesh;
  eyeR.position.x = 0.065;
}

function addMouth(headMesh, sc) {
  const mMat = new BABYLON.PBRMaterial('mouth', sc);
  mMat.albedoColor = new BABYLON.Color3(0.35, 0.12, 0.14);
  mMat.roughness = 0.6; mMat.metallic = 0.02;
  const m = BABYLON.MeshBuilder.CreateBox('mouth', { width: 0.065, height: 0.013, depth: 0.02 }, sc);
  m.material = mMat; m.parent = headMesh;
  m.position.set(0, -0.065, 0.177);
}

// ── Neon mohawk spikes (Ghost Skull) ─────────────────────────────────────────
// Returns a TransformNode parented to a head mesh (positions in head-local space)
export function buildPlayerFaceDetails(sc = scene) {
  const g = new BABYLON.TransformNode('faceDetails', sc);

  const blueSpikeM = new BABYLON.PBRMaterial('spikeBlue', sc);
  blueSpikeM.albedoColor = new BABYLON.Color3(0.05, 0.42, 1.0);
  blueSpikeM.roughness = 0.22; blueSpikeM.metallic = 0;
  blueSpikeM.emissiveColor = new BABYLON.Color3(0.0, 0.36, 1.0);

  const purpleSpikeM = new BABYLON.PBRMaterial('spikePurple', sc);
  purpleSpikeM.albedoColor = new BABYLON.Color3(0.70, 0.06, 1.0);
  purpleSpikeM.roughness = 0.22; purpleSpikeM.metallic = 0;
  purpleSpikeM.emissiveColor = new BABYLON.Color3(0.62, 0.0, 1.0);

  // [x, height, mat-idx (0=blue 1=purple), lean-z]
  const spikeDefs = [
    [0,      0.38, 0,  0.00],
    [-0.063, 0.33, 0, -0.16],
    [ 0.063, 0.31, 1,  0.16],
    [-0.112, 0.27, 1, -0.30],
    [ 0.112, 0.25, 0,  0.30],
    [-0.158, 0.21, 1, -0.48],
    [ 0.158, 0.19, 0,  0.48],
    [-0.198, 0.14, 1, -0.68],
    [ 0.198, 0.12, 1,  0.68],
  ];

  spikeDefs.forEach(([x, h, mi, lean], i) => {
    const mat = mi === 0 ? blueSpikeM : purpleSpikeM;
    const w = Math.max(0.044 - Math.abs(x) * 0.065, 0.026);
    const sp = BABYLON.MeshBuilder.CreateBox(`ghSpike${i}`, { width: w, height: h, depth: w * 0.68 }, sc);
    sp.material = mat; sp.parent = g;
    sp.position.set(x, 0.195 + h * 0.5 - 0.018, 0.01);
    sp.rotation.z = lean * 0.11;
  });

  return g;
}

// ── Core character rig factory ────────────────────────────────────────────────
export function createCharacter(clothMat, skinMat, hatMat, gunOffX = 0.2, gunOffY = -0.15, gunOffZ = 0.25, sc = scene) {
  const bodyGroup = new BABYLON.TransformNode('char', sc);

  // Torso
  const torso = BABYLON.MeshBuilder.CreateBox('torso', { width: 0.44, height: 0.6, depth: 0.25 }, sc);
  torso.material = clothMat; torso.parent = bodyGroup;
  torso.position.y = 0.9; torso.receiveShadows = true;

  // Head
  const head = BABYLON.MeshBuilder.CreateSphere('head', { diameter: 0.39, segments: 10 }, sc);
  head.material = skinMat; head.parent = bodyGroup;
  head.position.y = 1.75; head.receiveShadows = true;
  addEyes(head, sc); addMouth(head, sc);

  // Hat — will be rescaled into a hair cap by applyMidasDetails
  const hatMesh = BABYLON.MeshBuilder.CreateCylinder('hat', {
    diameterTop: 0.42, diameterBottom: 0.42, height: 0.18, tessellation: 10,
  }, sc);
  hatMesh.material = hatMat; hatMesh.parent = bodyGroup;
  hatMesh.position.y = 1.945; hatMesh.receiveShadows = true;

  // Arms
  const armLeft = BABYLON.MeshBuilder.CreateCapsule('armL',
    { radius: 0.09, height: 0.64, tessellation: 8, subdivisions: 4 }, sc);
  armLeft.material = clothMat; armLeft.parent = bodyGroup;
  armLeft.position.set(-0.3, 1.4, 0);
  armLeft.rotation.x = Math.PI / 10;
  armLeft.receiveShadows = true;

  const armRight = BABYLON.MeshBuilder.CreateCapsule('armR',
    { radius: 0.09, height: 0.64, tessellation: 8, subdivisions: 4 }, sc);
  armRight.material = clothMat; armRight.parent = bodyGroup;
  armRight.position.set(0.3, 1.4, 0);
  armRight.rotation.set(-1.25, 0, 0.15);
  armRight.receiveShadows = true;

  // Legs
  const legLeft = BABYLON.MeshBuilder.CreateCapsule('legL',
    { radius: 0.1, height: 0.75, tessellation: 8, subdivisions: 4 }, sc);
  legLeft.material = clothMat; legLeft.parent = bodyGroup;
  legLeft.position.set(-0.15, 0.38, 0);
  legLeft.receiveShadows = true;

  const legRight = BABYLON.MeshBuilder.CreateCapsule('legR',
    { radius: 0.1, height: 0.75, tessellation: 8, subdivisions: 4 }, sc);
  legRight.material = clothMat; legRight.parent = bodyGroup;
  legRight.position.set(0.15, 0.38, 0);
  legRight.receiveShadows = true;

  // Shoes — slightly elongated/pointed
  const shoeMat = new BABYLON.PBRMaterial('shoe', sc);
  shoeMat.albedoColor = new BABYLON.Color3(0.07, 0.07, 0.08);
  shoeMat.roughness = 0.45; shoeMat.metallic = 0.08;
  const shoeL = BABYLON.MeshBuilder.CreateBox('shoeL', { width: 0.13, height: 0.07, depth: 0.22 }, sc);
  shoeL.material = shoeMat; shoeL.parent = bodyGroup;
  shoeL.position.set(-0.15, 0.06, 0.05); shoeL.receiveShadows = true;
  const shoeR = shoeL.clone('shoeR'); shoeR.parent = bodyGroup;
  shoeR.position.x = 0.15;

  // Gun TransformNode on right arm
  const gun = new BABYLON.TransformNode('gun', sc);
  gun.parent = armRight;
  gun.position.set(gunOffX, gunOffY, gunOffZ);
  gun.muzzle = new BABYLON.TransformNode('muzzle', sc);
  gun.muzzle.parent = gun;

  if (sc === scene) {
    [torso, head, hatMesh, armLeft, armRight, legLeft, legRight, shoeL, shoeR].forEach(m => addShadow(m));
  }

  return { bodyGroup, head, hatMesh, armLeft, armRight, gun, legLeft, legRight };
}

// ── Ghost Skull character details ─────────────────────────────────────────────
function applyMidasDetails(rig, sc) {
  const { bodyGroup, head, hatMesh, armLeft, armRight, legLeft, legRight } = rig;

  // Hide the hat — mohawk spikes cover the top of the skull
  hatMesh.scaling.setAll(0.001);

  // ── Materials ───────────────────────────────────────────────────────────────
  const skullHandM = new BABYLON.PBRMaterial('gsHand', sc);
  skullHandM.albedoColor = new BABYLON.Color3(0.87, 0.84, 0.82);
  skullHandM.roughness = 0.36; skullHandM.metallic = 0.03;

  const goldM = new BABYLON.PBRMaterial('gsGold', sc);
  goldM.albedoColor = new BABYLON.Color3(0.80, 0.64, 0.10);
  goldM.roughness = 0.07; goldM.metallic = 0.97;
  goldM.emissiveColor = new BABYLON.Color3(0.10, 0.07, 0);

  const whiteM = new BABYLON.PBRMaterial('gsWhite', sc);
  whiteM.albedoColor = new BABYLON.Color3(0.93, 0.91, 0.88);
  whiteM.roughness = 0.64; whiteM.metallic = 0;

  const coatM = new BABYLON.PBRMaterial('gsCoat', sc);
  coatM.albedoColor = new BABYLON.Color3(0.044, 0.046, 0.082);
  coatM.roughness = 0.58; coatM.metallic = 0.07;

  const lapM = new BABYLON.PBRMaterial('gsLap', sc);
  lapM.albedoColor = new BABYLON.Color3(0.07, 0.08, 0.13);
  lapM.roughness = 0.60; lapM.metallic = 0.06;

  const blueGlowM = new BABYLON.PBRMaterial('gsBlueG', sc);
  blueGlowM.albedoColor = new BABYLON.Color3(0.06, 0.28, 1.0);
  blueGlowM.roughness = 0.18; blueGlowM.metallic = 0;
  blueGlowM.emissiveColor = new BABYLON.Color3(0.02, 0.30, 1.0);

  const capeM = new BABYLON.PBRMaterial('gsCape', sc);
  capeM.albedoColor = new BABYLON.Color3(0.05, 0.07, 0.24);
  capeM.roughness = 0.55; capeM.metallic = 0.10;
  capeM.emissiveColor = new BABYLON.Color3(0.01, 0.02, 0.14);

  const purpleEyeM = new BABYLON.PBRMaterial('gsPurpEye', sc);
  purpleEyeM.albedoColor = new BABYLON.Color3(0.5, 0.08, 1.0);
  purpleEyeM.roughness = 0.08; purpleEyeM.metallic = 0;
  purpleEyeM.emissiveColor = new BABYLON.Color3(0.55, 0.02, 1.0);

  const socketM = new BABYLON.PBRMaterial('gsSocket', sc);
  socketM.albedoColor = new BABYLON.Color3(0.02, 0.01, 0.03);
  socketM.roughness = 0.85; socketM.metallic = 0;

  const teethM = new BABYLON.PBRMaterial('gsTeeth', sc);
  teethM.albedoColor = new BABYLON.Color3(0.92, 0.90, 0.86);
  teethM.roughness = 0.30; teethM.metallic = 0.04;

  const diamM = new BABYLON.PBRMaterial('gsDiam', sc);
  diamM.albedoColor = new BABYLON.Color3(1.0, 0.86, 0.12);
  diamM.roughness = 0.05; diamM.metallic = 0.97;
  diamM.emissiveColor = new BABYLON.Color3(0.16, 0.10, 0);

  // ── Arms → skeletal pale hands ──────────────────────────────────────────────
  armLeft.material  = skullHandM;
  armRight.material = skullHandM;

  // ── Force torso + legs to the dark coat (ignores playerClothMat) ─────────────
  const pantM = new BABYLON.PBRMaterial('gsPant', sc);
  pantM.albedoColor = new BABYLON.Color3(0.038, 0.040, 0.075);
  pantM.roughness = 0.62; pantM.metallic = 0.05;

  const torsoMesh = bodyGroup.getChildMeshes(false).find(m => m.name === 'torso');
  if (torsoMesh) torsoMesh.material = coatM;
  legLeft.material  = pantM;
  legRight.material = pantM;

  // ── Long coat front panels (open-V silhouette, left + right of centre) ───────
  // These extend from just below the belt down past the legs, dark on both sides
  const coatPanelL = BABYLON.MeshBuilder.CreateBox('gsCoatPL',
    { width: 0.185, height: 0.54, depth: 0.065 }, sc);
  coatPanelL.material = coatM; coatPanelL.parent = bodyGroup;
  coatPanelL.position.set(-0.127, 0.37, 0.022);

  const coatPanelR = BABYLON.MeshBuilder.CreateBox('gsCoatPR',
    { width: 0.185, height: 0.54, depth: 0.065 }, sc);
  coatPanelR.material = coatM; coatPanelR.parent = bodyGroup;
  coatPanelR.position.set(0.127, 0.37, 0.022);

  // Coat side panels (close the sides of the long coat)
  const coatSideL = BABYLON.MeshBuilder.CreateBox('gsCoatSL',
    { width: 0.062, height: 0.56, depth: 0.22 }, sc);
  coatSideL.material = coatM; coatSideL.parent = bodyGroup;
  coatSideL.position.set(-0.225, 0.37, -0.04);

  const coatSideR = BABYLON.MeshBuilder.CreateBox('gsCoatSR',
    { width: 0.062, height: 0.56, depth: 0.22 }, sc);
  coatSideR.material = coatM; coatSideR.parent = bodyGroup;
  coatSideR.position.set(0.225, 0.37, -0.04);

  if (sc === scene) {
    addShadow(coatPanelL); addShadow(coatPanelR);
  }

  // ── Skull face overlay ──────────────────────────────────────────────────────
  // Dark hollow eye sockets
  const sockL = BABYLON.MeshBuilder.CreateBox('gsSockL', { width: 0.108, height: 0.082, depth: 0.01 }, sc);
  sockL.material = socketM; sockL.parent = head; sockL.position.set(-0.065, 0.022, 0.176);
  const sockR = sockL.clone('gsSockR'); sockR.parent = head; sockR.position.x = 0.065;

  // Glowing purple eyes (sit in front of sockets)
  const eyeGL = BABYLON.MeshBuilder.CreateSphere('gsEyeGL', { diameter: 0.105, segments: 7 }, sc);
  eyeGL.material = purpleEyeM; eyeGL.parent = head; eyeGL.position.set(-0.065, 0.022, 0.180);
  const eyeGR = eyeGL.clone('gsEyeGR'); eyeGR.parent = head; eyeGR.position.x = 0.065;

  // Skull cheekbone ridges
  const ckM = new BABYLON.PBRMaterial('gsCheek', sc);
  ckM.albedoColor = new BABYLON.Color3(0.70, 0.67, 0.64); ckM.roughness = 0.45; ckM.metallic = 0;
  const ckL = BABYLON.MeshBuilder.CreateBox('gsCkL', { width: 0.082, height: 0.018, depth: 0.01 }, sc);
  ckL.material = ckM; ckL.parent = head; ckL.position.set(-0.090, -0.032, 0.176); ckL.rotation.z = 0.24;
  const ckR = ckL.clone('gsCkR'); ckR.parent = head; ckR.position.set(0.090, -0.032, 0.176); ckR.rotation.z = -0.24;

  // Visible teeth strip
  const teeth = BABYLON.MeshBuilder.CreateBox('gsTeeth', { width: 0.118, height: 0.022, depth: 0.01 }, sc);
  teeth.material = teethM; teeth.parent = head; teeth.position.set(0, -0.076, 0.179);

  // Dark gap above teeth
  const gumM = new BABYLON.PBRMaterial('gsGum', sc);
  gumM.albedoColor = new BABYLON.Color3(0.06, 0.02, 0.03); gumM.roughness = 0.9; gumM.metallic = 0;
  const gum = BABYLON.MeshBuilder.CreateBox('gsGum', { width: 0.118, height: 0.016, depth: 0.011 }, sc);
  gum.material = gumM; gum.parent = head; gum.position.set(0, -0.059, 0.179);

  // ── White collar / cravat at neck ───────────────────────────────────────────
  const collar = BABYLON.MeshBuilder.CreateBox('gsCollar', { width: 0.22, height: 0.10, depth: 0.032 }, sc);
  collar.material = whiteM; collar.parent = bodyGroup; collar.position.set(0, 1.235, 0.136);

  const colWingL = BABYLON.MeshBuilder.CreateBox('gsColWL', { width: 0.095, height: 0.17, depth: 0.026 }, sc);
  colWingL.material = whiteM; colWingL.parent = bodyGroup;
  colWingL.position.set(-0.055, 1.23, 0.135); colWingL.rotation.z = 0.26;
  const colWingR = colWingL.clone('gsColWR'); colWingR.parent = bodyGroup;
  colWingR.position.set(0.055, 1.23, 0.135); colWingR.rotation.z = -0.26;

  // ── White shirt front with diamond decorations ──────────────────────────────
  const shirtF = BABYLON.MeshBuilder.CreateBox('gsShirtF', { width: 0.13, height: 0.52, depth: 0.028 }, sc);
  shirtF.material = whiteM; shirtF.parent = bodyGroup; shirtF.position.set(0, 0.94, 0.138);

  // Gold diamond star decorations on shirt (×3, rotated 45°)
  [0.14, 0, -0.14].forEach((yOff, i) => {
    const d = BABYLON.MeshBuilder.CreateBox(`gsDiam${i}`, { width: 0.036, height: 0.036, depth: 0.016 }, sc);
    d.material = diamM; d.parent = bodyGroup;
    d.position.set(0, 1.02 + yOff, 0.144); d.rotation.z = Math.PI / 4;
  });

  // Gold zipper line down center
  const zip = BABYLON.MeshBuilder.CreateBox('gsZip', { width: 0.016, height: 0.46, depth: 0.017 }, sc);
  zip.material = goldM; zip.parent = bodyGroup; zip.position.set(0, 0.93, 0.141);

  // ── Dark coat lapels ────────────────────────────────────────────────────────
  const lapL = BABYLON.MeshBuilder.CreateBox('gsLapL', { width: 0.10, height: 0.30, depth: 0.027 }, sc);
  lapL.material = lapM; lapL.parent = bodyGroup; lapL.position.set(-0.095, 1.10, 0.139); lapL.rotation.z = 0.32;
  const lapR = lapL.clone('gsLapR'); lapR.parent = bodyGroup; lapR.position.set(0.095, 1.10, 0.139); lapR.rotation.z = -0.32;

  // ── Gold belt with ornate buckle ────────────────────────────────────────────
  const belt = BABYLON.MeshBuilder.CreateBox('gsBelt', { width: 0.50, height: 0.062, depth: 0.062 }, sc);
  belt.material = coatM; belt.parent = bodyGroup; belt.position.set(0, 0.635, 0.0);

  const buckle = BABYLON.MeshBuilder.CreateBox('gsBuckle', { width: 0.13, height: 0.088, depth: 0.072 }, sc);
  buckle.material = goldM; buckle.parent = bodyGroup; buckle.position.set(0, 0.635, 0.016);

  // Buckle wing flanges
  const bwL = BABYLON.MeshBuilder.CreateBox('gsBwL', { width: 0.088, height: 0.050, depth: 0.042 }, sc);
  bwL.material = goldM; bwL.parent = bodyGroup; bwL.position.set(-0.098, 0.635, 0.012); bwL.rotation.z = 0.36;
  const bwR = bwL.clone('gsBwR'); bwR.parent = bodyGroup; bwR.position.set(0.098, 0.635, 0.012); bwR.rotation.z = -0.36;

  // ── Coat tails (back, split pair) ──────────────────────────────────────────
  const tailL = BABYLON.MeshBuilder.CreateBox('gsTailL', { width: 0.155, height: 0.58, depth: 0.042 }, sc);
  tailL.material = coatM; tailL.parent = bodyGroup; tailL.position.set(-0.115, 0.31, -0.045);
  const tailR = BABYLON.MeshBuilder.CreateBox('gsTailR', { width: 0.155, height: 0.58, depth: 0.042 }, sc);
  tailR.material = coatM; tailR.parent = bodyGroup; tailR.position.set(0.115, 0.31, -0.045);

  // ── Bat-wing cape ───────────────────────────────────────────────────────────
  const capeBody = BABYLON.MeshBuilder.CreateBox('gsCapeBody', { width: 0.72, height: 0.92, depth: 0.036 }, sc);
  capeBody.material = capeM; capeBody.parent = bodyGroup; capeBody.position.set(0, 0.82, -0.19);

  const wingL = BABYLON.MeshBuilder.CreateBox('gsWingL', { width: 0.56, height: 0.68, depth: 0.028 }, sc);
  wingL.material = capeM; wingL.parent = bodyGroup; wingL.position.set(-0.50, 1.12, -0.16); wingL.rotation.set(0, -0.44, 0.19);

  const wingR = BABYLON.MeshBuilder.CreateBox('gsWingR', { width: 0.56, height: 0.68, depth: 0.028 }, sc);
  wingR.material = capeM; wingR.parent = bodyGroup; wingR.position.set(0.50, 1.12, -0.16); wingR.rotation.set(0, 0.44, -0.19);

  // Blue glowing edge strips along outer wings
  const edgeL = BABYLON.MeshBuilder.CreateBox('gsEdgeL', { width: 0.020, height: 0.68, depth: 0.030 }, sc);
  edgeL.material = blueGlowM; edgeL.parent = bodyGroup; edgeL.position.set(-0.76, 1.08, -0.15); edgeL.rotation.set(0, -0.44, 0.19);

  const edgeR = BABYLON.MeshBuilder.CreateBox('gsEdgeR', { width: 0.020, height: 0.68, depth: 0.030 }, sc);
  edgeR.material = blueGlowM; edgeR.parent = bodyGroup; edgeR.position.set(0.76, 1.08, -0.15); edgeR.rotation.set(0, 0.44, -0.19);

  // Cape bottom jagged points
  [-0.24, -0.08, 0.08, 0.24].forEach((x, i) => {
    const pt = BABYLON.MeshBuilder.CreateBox(`gsCPt${i}`, { width: 0.082, height: 0.17, depth: 0.033 }, sc);
    pt.material = capeM; pt.parent = bodyGroup; pt.position.set(x, 0.30, -0.18); pt.rotation.z = x < 0 ? 0.10 : -0.10;
  });
  [-0.24, 0.24].forEach((x, i) => {
    const tip = BABYLON.MeshBuilder.CreateBox(`gsCTip${i}`, { width: 0.028, height: 0.10, depth: 0.026 }, sc);
    tip.material = blueGlowM; tip.parent = bodyGroup; tip.position.set(x, 0.21, -0.18);
  });

  // ── Ankle crystal blade spurs ───────────────────────────────────────────────
  [-0.15, 0.15].forEach((x, i) => {
    const blade = BABYLON.MeshBuilder.CreateBox(`gsBlade${i}`, { width: 0.20, height: 0.072, depth: 0.014 }, sc);
    blade.material = blueGlowM; blade.parent = bodyGroup;
    blade.position.set(x, 0.13, -0.055); blade.rotation.set(0.22, 0, i === 0 ? 0.10 : -0.10);

    const fin = BABYLON.MeshBuilder.CreateBox(`gsFin${i}`, { width: 0.014, height: 0.13, depth: 0.11 }, sc);
    fin.material = blueGlowM; fin.parent = bodyGroup;
    fin.position.set(x, 0.14, -0.065); fin.rotation.set(-0.28, 0, 0);
  });

  if (sc === scene) {
    addShadow(shirtF); addShadow(lapL); addShadow(lapR);
    addShadow(buckle); addShadow(capeBody); addShadow(wingL); addShadow(wingR);
  }
}

// ── Player instance ───────────────────────────────────────────────────────────
const _playerRig = createCharacter(playerClothMat, playerSkinMat, playerHatMat);
export const playerBody     = _playerRig.bodyGroup;
export const playerHead     = _playerRig.head;
export const playerArmLeft  = _playerRig.armLeft;
export const playerArmRight = _playerRig.armRight;
export const playerGun      = _playerRig.gun;
export const playerLegLeft  = _playerRig.legLeft;
export const playerLegRight = _playerRig.legRight;

player.bodyGroup = playerBody;
player.head      = playerHead;
player.armLeft   = playerArmLeft;
player.armRight  = playerArmRight;
player.legLeft   = playerLegLeft;
player.legRight  = playerLegRight;
player.gun       = playerGun;

playerBody.position.set(0, 1.4, 2);

// Midas hair details (parented to head, positions in head-local space)
const _pfd = buildPlayerFaceDetails();
_pfd.parent = playerHead;

// Apply the full Midas suit/gold-arm treatment
applyMidasDetails(_playerRig, scene);

export const playerParts = {
  armLeft: playerArmLeft, armRight: playerArmRight,
  legLeft: playerLegLeft, legRight: playerLegRight,
  head: playerHead,
};

// ── Armor ─────────────────────────────────────────────────────────────────────
export function applyPlayerArmor(key) {
  if (player.armorMesh) { player.armorMesh.dispose(); player.armorMesh = null; }
  const def = ARMOR_DEFS[key] || ARMOR_DEFS.none;
  player.armorReduction = def.reduction;
  player.armorDeflectChance = def.deflectChance || 0;
  player.armorKey = key;
  // Rigged bodies: recolour the suit to an armoured metal look (no primitive
  // plates). Stats above still apply. Primitive rig keeps its plate mesh.
  if (_riggedRig) { _applyPlayerOutfit(); return; }
  const mesh = buildArmorMesh(key);
  if (mesh) { mesh.parent = playerBody; player.armorMesh = mesh; }
}

// ── Weapon ────────────────────────────────────────────────────────────────────
export function setPlayerWeapon(key, getMatsFn) {
  const def = WEAPON_DEFS[key];
  if (!def) return;
  player.weaponKey = key;
  player.weapon = def;
  equipped.weapon = key;
  saveEquipped();
  // Apply per-weapon ammo capacity and reload time
  if (def.ammoCapacity) {
    player.maxAmmo = def.ammoCapacity;
    player.ammo = def.ammoCapacity;
  }
  if (def.reloadTime) {
    player.reloadDuration = def.reloadTime;
  }
  player.isReloading = false;
  rebuildGunVisual(playerGun, () => def.build(getMatsFn ? getMatsFn() : undefined));
  // Armory preview pane shows its own gun node — rebuild it too, or equipping
  // a weapon/skin never visibly changes what the preview character is holding.
  rebuildGunVisual(previewRig.gun, () => def.build(getMatsFn ? getMatsFn() : undefined));
}

// ── Clothes ───────────────────────────────────────────────────────────────────
export function applyPlayerClothes(key) {
  equipped.clothes = key;
  saveEquipped();
  // Rigged bodies: recolour the body suit. Primitive rig keeps material+accessories.
  if (_riggedRig) { _applyPlayerOutfit(); return; }
  const def = CLOTHES_DEFS[key] || CLOTHES_DEFS.default;
  playerClothMat.albedoColor = c3(def.color);
  applyClothesMaterialStyle(playerClothMat, key);
  applyClothesAccessories(player.clothesAccessoryState, playerBody, playerHead, key);
}

// ── VIP ───────────────────────────────────────────────────────────────────────
export function applyVipState(getMatsFn) {
  if (inventory.vip && gs.vipGiantMode) {
    playerBody.scaling.setAll(GIANT_SCALE);
    if (!inventory.weapons.includes('minigun')) inventory.weapons.push('minigun');
    setPlayerWeapon('minigun', getMatsFn);
  } else {
    playerBody.scaling.setAll(1);
    if (inventory.vip) {
      const fallback = (equipped.weapon && inventory.weapons.includes(equipped.weapon))
        ? equipped.weapon : 'sniper';
      setPlayerWeapon(fallback, getMatsFn);
    }
  }
}

export function setVipGiantMode(active, getMatsFn) {
  if (!inventory.vip || gs.vipGiantMode === active) return;
  gs.vipGiantMode = active;
  equipped.vipGiantMode = active;
  saveEquipped();
  applyVipState(getMatsFn);
}

// ── Armory preview rig ────────────────────────────────────────────────────────
const _mkPrevMat = (hex, r, m) => {
  const mat = new BABYLON.PBRMaterial('prev', previewScene);
  mat.albedoColor = new BABYLON.Color3(((hex >> 16) & 0xff) / 255, ((hex >> 8) & 0xff) / 255, (hex & 0xff) / 255);
  mat.roughness = r; mat.metallic = m;
  return mat;
};

export const previewClothMat = _mkPrevMat(
  (CLOTHES_DEFS[equipped.clothes] || CLOTHES_DEFS.default).color, 0.72, 0.02);
export const previewSkinMat  = _mkPrevMat(0xbfbcca, 0.32, 0.01);
export const previewHatMat   = _mkPrevMat(0x19100a, 0.35, 0.06);

export const previewRig = createCharacter(
  previewClothMat, previewSkinMat, previewHatMat,
  0.2, -0.15, 0.25, previewScene);

// Apply Midas look to armory preview as well
const _prevFD = buildPlayerFaceDetails(previewScene);
_prevFD.parent = previewRig.head;
applyMidasDetails(previewRig, previewScene);

// ── Rigged model upgrade (called from main.js after preloadAssets) ────────────
// Attaches the KayKit hero model inside playerBody (and the armory preview),
// hides the primitive meshes, redirects playerGun to the model's hand slot and
// remaps playerParts so emotes pose the real skeleton.
let _riggedRig = null;
let _previewRiggedRig = null;
export function getPlayerRig() { return _riggedRig; }

// Dresses the realistic body in real clothing geometry (shirt/pants, plus an
// armour plate overlay when armour is equipped) — never touches the skin
// material, so the face/skin tone are unaffected by clothes/armor. Applied to
// both the live and preview rigs. See character.js `applyOutfit`.
const DEFAULT_SHIRT = 0x27324f, DEFAULT_PANTS = 0x1c1f2a;   // navy hero suit
async function _applyPlayerOutfit() {
  const { applyOutfit } = await import('./character.js');
  const armorKey = player.armorKey || 'none';
  const armored = armorKey !== 'none';
  const clothesKey = equipped.clothes || 'default';
  const shirtColor = clothesKey !== 'default'
    ? (CLOTHES_DEFS[clothesKey] || CLOTHES_DEFS.default).color : DEFAULT_SHIRT;
  // Sleeve cuffs only show with armor equipped — a full-coverage smooth
  // bodysuit read as "already wearing armor" even with 0% deflect (No Armor
  // equipped). Bare arms + a shorter tank-top-style shirt make "no armor"
  // unmistakably casual, so the actual armor tiers are the only look that
  // reads as protective gear.
  const opts = { shirtColor, pantsColor: DEFAULT_PANTS, sleeves: armored };
  if (armored) opts.armorColor = (ARMOR_DEFS[armorKey] || ARMOR_DEFS.none).color;
  for (const rig of [_riggedRig, _previewRiggedRig]) if (rig) applyOutfit(rig, opts);
}

export async function upgradePlayerRigVisual() {
  if (localStorage.getItem('sniperstrike-classic-rigs')) return null;
  const { assetsReady } = await import('./assets.js');
  if (!assetsReady) return null;
  const { attachRiggedToBody } = await import('./character.js');

  // Live player rig — Quaternius hero (light skin, styled hair)
  _riggedRig = attachRiggedToBody(playerBody, {
    body: 'male', hair: 'simpleParted', hairColor: 0x3b2412,
    adoptGunNode: playerGun,
    keepNodes: [playerGun, player.armorMesh,
                player.clothesAccessoryState?.torsoGroup,
                player.clothesAccessoryState?.headGroup],
  });
  if (!_riggedRig) return null;
  _riggedRig._idleClip = 'pistolIdle';     // stand holding the gun
  _riggedRig._alwaysPose = [];             // locomotion is pure animation
  _riggedRig.playAnim('pistolIdle');       // apply immediately (controls.js only re-triggers on movement)

  // Emotes pose the real skeleton from now on
  playerParts.armLeft  = _riggedRig.armLeft;
  playerParts.armRight = _riggedRig.armRight;
  playerParts.legLeft  = _riggedRig.legLeft;
  playerParts.legRight = _riggedRig.legRight;
  playerParts.head     = _riggedRig.head;

  // Armory preview gets the same hero
  try {
    const { attachRiggedToBody: attach2 } = await import('./character.js');
    _previewRiggedRig = attach2(previewRig.bodyGroup, {
      body: 'male', hair: 'simpleParted', hairColor: 0x3b2412, sc: previewScene,
      adoptGunNode: previewRig.gun,
      keepNodes: [previewRig.gun],
    });
    if (_previewRiggedRig) {
      _previewRiggedRig._idleClip = 'pistolIdle'; _previewRiggedRig._alwaysPose = [];
      _previewRiggedRig.playAnim('pistolIdle');   // preview never runs controls.js — set the pose once here
    }
  } catch (_e) { /* preview upgrade is cosmetic-only */ }

  // Apply the currently-equipped outfit to the new rigs.
  _applyPlayerOutfit();
  return _riggedRig;
}
