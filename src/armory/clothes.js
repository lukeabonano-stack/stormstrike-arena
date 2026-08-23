import { box, cyl, sph, cone, grp, cloneM, pbr, c3 } from '../engine.js';

export const CLOTHES_DEFS = {
  default: { name: 'Dark Suit',         price: 0,   color: 0x0a0c1a },
  red:     { name: 'Crimson Red',     price: 150,  color: 0x8a2727 },
  black:   { name: 'Onyx Black',      price: 150,  color: 0x141414 },
  camo:    { name: 'Camo Green',      price: 200,  color: 0x46522e },
  neon:    { name: 'Neon Pink',       price: 250,  color: 0xff2bd6 },
  gold:    { name: 'Gold Suit',       price: 350,  color: 0xd4af37 },
  navy:    { name: 'Navy Blue',       price: 150,  color: 0x1a2a4a },
  emerald: { name: 'Emerald',         price: 200,  color: 0x1f6b4a },
  orange:  { name: 'Sunset Orange',   price: 200,  color: 0xff7a1f },
  white:   { name: 'Arctic White',    price: 250,  color: 0xeaeaea },
  violet:  { name: 'Royal Violet',    price: 300,  color: 0x5a1f8a },
  maroon:    { name: 'Maroon',         price: 250,  color: 0x5a1a2a },
  royalCloak:{ name: 'Royal Cloak',   price: 0,   vipOnly: true, secretVip: true, color: 0x2a0850 },
};

export function buildGoldSuitTorsoAccessories() {
  const goldBlackMat  = pbr(0x0c0c0c, 0.25, 0.35);
  const goldAccentMat = pbr(0xffe9a8, 0.1, 0.6, {
    emissive: 0xd4af37,
    emissiveIntensity: 0.4,
  });

  const root = grp('goldTorso');

  for (let i = 0; i < 3; i++) {
    const btn = sph(0.045, goldAccentMat);
    btn.position.set(0, 1.75 - i * 0.27, 0.29);
    btn.parent = root;
  }

  const bowLeft = cone(0.13, 0.17, goldBlackMat);
  bowLeft.rotation.z = Math.PI / 2;
  bowLeft.position.set(-0.12, 1.76, 0.36);
  bowLeft.parent = root;

  const bowRight = cone(0.13, 0.17, goldBlackMat);
  bowRight.rotation.z = -Math.PI / 2;
  bowRight.position.set(0.12, 1.76, 0.36);
  bowRight.parent = root;

  const knot = sph(0.06, goldAccentMat);
  knot.position.set(0, 1.76, 0.39);
  knot.parent = root;

  return root;
}

export function buildGoldSuitTopHat() {
  const goldBlackMat  = pbr(0x0c0c0c, 0.25, 0.35);
  const goldAccentMat = pbr(0xffe9a8, 0.1, 0.6, {
    emissive: 0xd4af37,
    emissiveIntensity: 0.4,
  });

  const root = grp('goldTopHat');

  const brim = cyl(0.34, 0.34, 0.04, goldBlackMat);
  brim.position.y = 0.4;
  brim.parent = root;

  const band = cyl(0.225, 0.225, 0.07, goldAccentMat);
  band.position.y = 0.46;
  band.parent = root;

  const body = cyl(0.22, 0.22, 0.36, goldBlackMat);
  body.position.y = 0.65;
  body.parent = root;

  const top = cyl(0.22, 0.22, 0.02, goldBlackMat);
  top.position.y = 0.83;
  top.parent = root;

  return root;
}

export function applyClothesAccessories(state, bodyGroup, headGroup, key) {
  if (state.torsoGroup) {
    state.torsoGroup.parent = null;
    state.torsoGroup.dispose();
    state.torsoGroup = null;
  }
  if (state.headGroup) {
    state.headGroup.parent = null;
    state.headGroup.dispose();
    state.headGroup = null;
  }

  if (key === 'gold') {
    const torsoGroup = buildGoldSuitTorsoAccessories();
    torsoGroup.parent = bodyGroup;
    state.torsoGroup = torsoGroup;

    const hatContainer = grp('goldHatContainer');
    const hat = buildGoldSuitTopHat();
    hat.parent = hatContainer;
    hatContainer.parent = headGroup;
    state.headGroup = hatContainer;
  }
}

export function applyClothesMaterialStyle(mat, key) {
  if (key === 'gold') {
    mat.metallic = 0.55;
    mat.roughness = 0.12;
    mat.emissiveColor = new BABYLON.Color3(
      ((0xd4af37 >> 16) & 0xff) / 255,
      ((0xd4af37 >> 8) & 0xff) / 255,
      (0xd4af37 & 0xff) / 255
    ).scale(0.45);
  } else {
    mat.metallic = 0.08;
    mat.roughness = 0.55;
    mat.emissiveColor = new BABYLON.Color3(0, 0, 0);
  }
}
