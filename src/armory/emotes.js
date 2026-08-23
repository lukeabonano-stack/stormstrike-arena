const { PI, sin, cos, abs, min, max } = Math;

export const EMOTE_DEFS = {
  wave: {
    name: 'Wave',
    price: 100,
    duration: 1.4,
    pose(parts, t) {
      parts.armRight.rotation.x = -1.25 - sin(t * 5) * 0.8;
      parts.armLeft.rotation.x = PI / 10;
    },
  },

  shoot: {
    name: 'Quick Draw',
    price: 120,
    duration: 1.2,
    pose(parts, t) {
      parts.armRight.rotation.x = -2.1 + sin(t * 8) * 0.3;
      parts.armRight.rotation.y = 0;
      parts.armRight.rotation.z = 0;
      parts.armLeft.rotation.x = PI / 10;
      parts.armLeft.rotation.y = 0;
      parts.armLeft.rotation.z = 0;
      parts.head.rotation.x = -0.3;
      parts.head.rotation.y = 0;
      parts.head.rotation.z = 0;
    },
  },

  dance: {
    name: 'Dance',
    price: 150,
    duration: 2.2,
    pose(parts, t) {
      const swing = sin(t * 10);
      parts.armLeft.rotation.x = PI / 10 + swing * 0.6;
      parts.armLeft.rotation.y = 0;
      parts.armLeft.rotation.z = swing * 0.3;
      parts.armRight.rotation.x = -1.25 - swing * 0.6;
      parts.armRight.rotation.y = 0;
      parts.armRight.rotation.z = -swing * 0.3;
      parts.legLeft.rotation.x = swing * 0.5;
      parts.legRight.rotation.x = -swing * 0.5;
      parts.head.rotation.z = swing * 0.15;
    },
  },

  taunt: {
    name: 'Taunt',
    price: 150,
    duration: 1.8,
    pose(parts, t) {
      parts.armRight.rotation.x = -1.6;
      parts.armRight.rotation.y = 0;
      parts.armRight.rotation.z = 0;
      parts.armLeft.rotation.x = PI / 10;
      parts.armLeft.rotation.y = 0;
      parts.armLeft.rotation.z = 0;
      parts.head.rotation.y = sin(t * 4) * 0.2;
    },
  },

  victory: {
    name: 'Victory Flex',
    price: 200,
    duration: 2.0,
    pose(parts, t) {
      const pulse = sin(t * 6) * 0.4;
      parts.armLeft.rotation.x = -2.6;
      parts.armLeft.rotation.y = 0;
      parts.armLeft.rotation.z = -0.4 - pulse * 0.1;
      parts.armRight.rotation.x = -2.6;
      parts.armRight.rotation.y = 0;
      parts.armRight.rotation.z = 0.4 + pulse * 0.1;
    },
  },

  salute: {
    name: 'Salute',
    price: 120,
    duration: 1.6,
    pose(parts, t) {
      parts.armRight.rotation.x = -2.0;
      parts.armRight.rotation.y = 0.3;
      parts.armRight.rotation.z = 0.1;
      parts.armLeft.rotation.x = PI / 10;
      parts.armLeft.rotation.y = 0;
      parts.armLeft.rotation.z = 0;
      parts.head.rotation.x = -0.1;
    },
  },

  windmill: {
    name: 'Windmill',
    price: 180,
    duration: 1.6,
    pose(parts, t) {
      const a = t * 12;
      parts.armLeft.rotation.x = sin(a) * 1.4 - 1.0;
      parts.armLeft.rotation.y = 0;
      parts.armLeft.rotation.z = cos(a) * 0.6;
      parts.armRight.rotation.x = cos(a) * 1.4 - 1.0;
      parts.armRight.rotation.y = 0;
      parts.armRight.rotation.z = sin(a) * 0.6;
    },
  },

  bow: {
    name: 'Bow',
    price: 140,
    duration: 1.8,
    pose(parts, t) {
      const bend = t < 1.2 ? min(1, t * 2) : max(0, 1 - (t - 1.2) * 3);
      parts.head.rotation.x = bend * 0.9;
      parts.armLeft.rotation.x = PI / 10 - bend * 0.3;
      parts.armLeft.rotation.y = 0;
      parts.armLeft.rotation.z = 0;
      parts.armRight.rotation.x = -1.25 + bend * 0.3;
      parts.armRight.rotation.y = 0;
      parts.armRight.rotation.z = 0.15;
    },
  },

  clap: {
    name: 'Clap',
    price: 120,
    duration: 1.6,
    pose(parts, t) {
      const clap = abs(sin(t * 10));
      parts.armLeft.rotation.x = -1.4;
      parts.armLeft.rotation.y = 0;
      parts.armLeft.rotation.z = 0.5 - clap * 0.4;
      parts.armRight.rotation.x = -1.4;
      parts.armRight.rotation.y = 0;
      parts.armRight.rotation.z = -0.5 + clap * 0.4;
    },
  },

  vipSalute: {
    name: 'VIP Salute',
    price: 0,
    duration: 1.8,
    vipOnly: true,
    secretVip: true,
    pose(parts, t) {
      parts.armRight.rotation.x = -2.85;
      parts.armRight.rotation.y = 0.5;
      parts.armRight.rotation.z = -0.8 + sin(t * 3) * 0.05;
      parts.armLeft.rotation.x  = PI / 10;
      parts.head.rotation.x     = -0.18;
    },
  },

  titanroar: {
    name: 'Titan Roar',
    price: 1000,
    duration: 2.2,
    vipOnly: true,
    pose(parts, t) {
      const rumble = sin(t * 14) * 0.06;
      parts.armLeft.rotation.x = -2.7 + rumble;
      parts.armLeft.rotation.y = 0;
      parts.armLeft.rotation.z = -0.5;
      parts.armRight.rotation.x = -2.7 - rumble;
      parts.armRight.rotation.y = 0;
      parts.armRight.rotation.z = 0.5;
      parts.head.rotation.x = -0.3 + rumble;
    },
  },
};

export function applyEmotePose(parts, key, elapsed) {
  EMOTE_DEFS[key]?.pose(parts, elapsed);
}
