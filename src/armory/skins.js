// `pattern` (optional) selects a procedurally-drawn canvas texture applied to
// the primary gun material — see PATTERN_DRAWERS in weapons.js. Without one,
// a skin is just a flat PBR recolor (still supported, e.g. `default`).
export const SKIN_DEFS = {
  default: {
    name: 'Default Steel',
    price: 0,
    primary: 0x161b20,
    detail: 0x8a9ba8,
  },

  chrome: {
    name: 'Chrome',
    price: 300,
    primary: 0xc0c8d0,
    detail: 0xe8eef2,
    pattern: 'brushed',
  },

  phantom: {
    name: 'Phantom',
    price: 400,
    primary: 0x1a0a2e,
    detail: 0x6b21a8,
    emissive: 0x9b30ff,
    emissiveIntensity: 0.6,
    pattern: 'veins',
  },

  forest: {
    name: 'Forest',
    price: 250,
    primary: 0x2d4a1e,
    detail: 0x5a7c3c,
    pattern: 'camo',
  },

  obsidian: {
    name: 'Obsidian',
    price: 350,
    primary: 0x0d0d0f,
    detail: 0x2a2a30,
    pattern: 'carbon',
  },

  crimsonlite: {
    name: 'Crimson Lite',
    price: 350,
    primary: 0x4a0a0a,
    detail: 0xc0392b,
    emissive: 0xff2200,
    emissiveIntensity: 0.4,
    pattern: 'flame',
  },

  golden: {
    name: 'Gold Rush',
    price: 450,
    primary: 0xb8860b,
    detail: 0xffd700,
    emissive: 0xffa500,
    emissiveIntensity: 0.35,
    pattern: 'hex',
  },

  void: {
    name: 'Void',
    price: 500,
    primary: 0x050510,
    detail: 0x1a1a3a,
    emissive: 0x0044ff,
    emissiveIntensity: 0.5,
    pattern: 'nebula',
  },

  goldenMinigun: {
    name: 'Golden Minigun',
    price: 0,
    vipOnly: true,
    primary: 0xffd700,
    detail: 0xffaa00,
    emissive: 0xffcc00,
    emissiveIntensity: 0.5,
    pattern: 'hex',
  },

  shadowReaper: {
    name: 'Shadow Reaper',
    price: 0,
    vipOnly: true,
    secretVip: true,
    primary: 0x080010,
    detail: 0x1a0030,
    emissive: 0x8800ff,
    emissiveIntensity: 0.7,
    pattern: 'veins',
  },
};
