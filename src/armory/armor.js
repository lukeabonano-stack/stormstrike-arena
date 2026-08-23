// ── armor.js  Armor stat registry + Babylon.js mesh builders ─────────────────
import { box, cyl, sph, cone, torus, grp, cloneM, pbr, c3 } from '../engine.js';

const PI = Math.PI;

// ── Armor stat + build registry ───────────────────────────────────────────────
export const ARMOR_DEFS = {

  none: {
    name: 'No Armor',
    price: 0,
    reduction: 0,
    deflectChance: 0,
    color: 0x000000,
    build: null,
  },

  light: {
    name: 'Light Armor',
    price: 250,
    reduction: 0.1,
    deflectChance: 0.08,
    color: 0x4a4a4a,
    build(mat) {
      const g = grp('armor_light');

      const front = box(0.5, 0.5, 0.16, mat, g);
      front.position.set(0, 1.25, 0.2);

      const back = cloneM(front, g);
      back.position.z = -0.2;

      return g;
    },
  },

  reinforced: {
    name: 'Reinforced Armor',
    price: 380,
    reduction: 0.15,
    deflectChance: 0.12,
    color: 0x4a6b35,
    build(mat) {
      const g = grp('armor_reinforced');

      const front = box(0.52, 0.55, 0.17, mat, g);
      front.position.set(0, 1.25, 0.21);

      const frontRidge = box(0.1, 0.5, 0.06, mat, g);
      frontRidge.position.set(0, 1.25, 0.27);

      const back = cloneM(front, g);
      back.position.z = -0.21;

      const backRidge = cloneM(frontRidge, g);
      backRidge.position.z = -0.27;

      return g;
    },
  },

  medium: {
    name: 'Medium Armor',
    price: 500,
    reduction: 0.2,
    deflectChance: 0.18,
    color: 0x35506b,
    build(mat) {
      const g = grp('armor_medium');

      const front = box(0.56, 0.6, 0.18, mat, g);
      front.position.set(0, 1.25, 0.22);

      const back = cloneM(front, g);
      back.position.z = -0.22;

      const padLeft = box(0.24, 0.2, 0.24, mat, g);
      padLeft.position.set(-0.56, 1.72, 0);

      const padRight = cloneM(padLeft, g);
      padRight.position.x = 0.56;

      return g;
    },
  },

  tactical: {
    name: 'Tactical Armor',
    price: 650,
    reduction: 0.25,
    deflectChance: 0.24,
    color: 0x2b2b40,
    build(mat) {
      const g = grp('armor_tactical');

      const front = box(0.58, 0.62, 0.19, mat, g);
      front.position.set(0, 1.25, 0.22);

      const back = cloneM(front, g);
      back.position.z = -0.22;

      const padL = box(0.26, 0.22, 0.26, mat, g);
      padL.position.set(-0.58, 1.74, 0);

      const padR = cloneM(padL, g);
      padR.position.x = 0.58;

      const thighL = box(0.2, 0.3, 0.22, mat, g);
      thighL.position.set(-0.18, 0.55, 0.12);

      const thighR = cloneM(thighL, g);
      thighR.position.x = 0.18;

      const thighLB = cloneM(thighL, g);
      thighLB.position.z = -0.12;

      const thighRB = cloneM(thighLB, g);
      thighRB.position.x = 0.18;

      return g;
    },
  },

  heavy: {
    name: 'Heavy Armor',
    price: 900,
    reduction: 0.35,
    deflectChance: 0.32,
    color: 0x6b3520,
    build(mat) {
      const g = grp('armor_heavy');

      const front = box(0.64, 0.8, 0.22, mat, g);
      front.position.set(0, 1.15, 0.22);

      const back = cloneM(front, g);
      back.position.z = -0.22;

      const padL = box(0.3, 0.26, 0.3, mat, g);
      padL.position.set(-0.6, 1.78, 0);

      const padR = cloneM(padL, g);
      padR.position.x = 0.6;

      const belt = box(0.5, 0.16, 0.52, mat, g);
      belt.position.set(0, 0.82, 0);

      return g;
    },
  },

  titan: {
    name: 'Titan Armor',
    price: 1400,
    reduction: 0.45,
    deflectChance: 0.42,
    color: 0x8a8a8a,
    build(mat) {
      const g = grp('armor_titan');

      const front = box(0.66, 0.84, 0.24, mat, g);
      front.position.set(0, 1.15, 0.23);

      const back = cloneM(front, g);
      back.position.z = -0.23;

      const padL = box(0.32, 0.28, 0.32, mat, g);
      padL.position.set(-0.62, 1.8, 0);

      const padR = cloneM(padL, g);
      padR.position.x = 0.62;

      const belt = box(0.52, 0.18, 0.56, mat, g);
      belt.position.set(0, 0.8, 0);

      const helmetRing = torus(0.36, 0.05, mat, g, 16);
      helmetRing.rotation.x = PI / 2;
      helmetRing.position.set(0, 2.05, 0);

      const legL = box(0.22, 0.3, 0.24, mat, g);
      legL.position.set(-0.17, 0.45, 0.1);

      const legR = cloneM(legL, g);
      legR.position.x = 0.17;

      const legLB = cloneM(legL, g);
      legLB.position.z = -0.1;

      const legRB = cloneM(legLB, g);
      legRB.position.x = 0.17;

      return g;
    },
  },

  karat24: {
    name: '24K Gold Armor',
    price: 2500,
    reduction: 0.55,
    deflectChance: 1.0,
    vipOnly: true,
    color: 0xffd700,
    build(mat) {
      const g = grp('armor_karat24');

      const front = box(0.70, 0.88, 0.26, mat, g);
      front.position.set(0, 1.18, 0.22);

      const frontRidge = box(0.12, 0.78, 0.08, mat, g);
      frontRidge.position.set(0, 1.18, 0.34);

      const back = cloneM(front, g);
      back.position.z = -0.22;

      const backRidge = cloneM(frontRidge, g);
      backRidge.position.z = -0.34;

      for (const side of [-1, 1]) {
        const pauldron = box(0.34, 0.30, 0.34, mat, g);
        pauldron.position.set(side * 0.63, 1.82, 0);

        const pauldronLower = box(0.30, 0.20, 0.30, mat, g);
        pauldronLower.position.set(side * 0.61, 1.55, 0);

        const thigh = box(0.22, 0.32, 0.26, mat, g);
        thigh.position.set(side * 0.18, 0.52, 0.12);

        const thighBack = cloneM(thigh, g);
        thighBack.position.z = -0.12;
      }

      const belt = box(0.56, 0.20, 0.56, mat, g);
      belt.position.set(0, 0.80, 0);

      const helmetRing = torus(0.38, 0.06, mat, g, 16);
      helmetRing.rotation.x = PI / 2;
      helmetRing.position.set(0, 2.06, 0);

      const crest = box(0.08, 0.22, 0.06, mat, g);
      crest.position.set(0, 2.30, 0);

      return g;
    },
  },

  obsidian: {
    name: 'Obsidian Armor',
    price: 0,
    reduction: 0.70,
    deflectChance: 0.90,
    vipOnly: true,
    secretVip: true,
    color: 0x1a0a2e,
    build(mat) {
      const g = grp('armor_obsidian');
      const front = box(0.70, 0.90, 0.26, mat, g);
      front.position.set(0, 1.18, 0.22);
      const back = cloneM(front, g);
      back.position.z = -0.22;
      for (const side of [-1, 1]) {
        const pauldron = box(0.36, 0.34, 0.36, mat, g);
        pauldron.position.set(side * 0.63, 1.84, 0);
        const spike = box(0.10, 0.30, 0.10, mat, g);
        spike.position.set(side * 0.63, 2.12, 0);
      }
      const belt = box(0.58, 0.22, 0.58, mat, g);
      belt.position.set(0, 0.80, 0);
      const collar = box(0.60, 0.14, 0.60, mat, g);
      collar.position.set(0, 1.70, 0);
      return g;
    },
  },

};

// ── Material cache ────────────────────────────────────────────────────────────
const armorMatCache = {};

export function getArmorMaterial(key) {
  if (armorMatCache[key]) return armorMatCache[key];
  let mat;
  if (key === 'karat24') {
    mat = pbr(0xffd700, 0.08, 0.98, { emissive: 0xffaa00, emissiveIntensity: 0.35 });
  } else if (key === 'obsidian') {
    mat = pbr(0x1a0a2e, 0.04, 0.96, { emissive: 0x7700ff, emissiveIntensity: 0.45 });
  } else {
    mat = pbr(ARMOR_DEFS[key].color, 0.3, 0.6);
  }
  armorMatCache[key] = mat;
  return mat;
}

// ── Public build entry point ──────────────────────────────────────────────────
export function buildArmorMesh(key) {
  const def = ARMOR_DEFS[key];
  if (!def || !def.build) return null;
  return def.build(getArmorMaterial(key));
}
