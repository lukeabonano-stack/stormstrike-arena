import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.164.0/build/three.module.js';

// ---------------------------------------------------------------------------
// Audio — every sound is synthesized with the Web Audio API, no asset files.
// ---------------------------------------------------------------------------
const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
let audioMuted = localStorage.getItem('sniperstrike-muted') === 'true';
const masterVolume = 0.7;

function resumeAudio() {
  if (audioCtx.state === 'suspended') audioCtx.resume();
}

function playTone({ freq = 440, type = 'sine', duration = 0.15, volume = 1, freqEnd, attack = 0.005 }) {
  if (audioMuted) return;
  const t0 = audioCtx.currentTime;
  const osc = audioCtx.createOscillator();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t0);
  if (freqEnd !== undefined) osc.frequency.exponentialRampToValueAtTime(Math.max(freqEnd, 1), t0 + duration);
  const gain = audioCtx.createGain();
  gain.gain.setValueAtTime(0, t0);
  gain.gain.linearRampToValueAtTime(volume * masterVolume, t0 + attack);
  gain.gain.exponentialRampToValueAtTime(0.001, t0 + duration);
  osc.connect(gain);
  gain.connect(audioCtx.destination);
  osc.start(t0);
  osc.stop(t0 + duration + 0.02);
}

function playNoiseBurst({ duration = 0.12, volume = 1, filterFreq = 1200, filterType = 'lowpass' }) {
  if (audioMuted) return;
  const t0 = audioCtx.currentTime;
  const bufferSize = Math.max(1, Math.floor(audioCtx.sampleRate * duration));
  const buffer = audioCtx.createBuffer(1, bufferSize, audioCtx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < bufferSize; i++) data[i] = Math.random() * 2 - 1;
  const noise = audioCtx.createBufferSource();
  noise.buffer = buffer;
  const filter = audioCtx.createBiquadFilter();
  filter.type = filterType;
  filter.frequency.value = filterFreq;
  const gain = audioCtx.createGain();
  gain.gain.setValueAtTime(volume * masterVolume, t0);
  gain.gain.exponentialRampToValueAtTime(0.001, t0 + duration);
  noise.connect(filter);
  filter.connect(gain);
  gain.connect(audioCtx.destination);
  noise.start(t0);
}

function playGunshot() {
  playNoiseBurst({ duration: 0.1, volume: 0.5, filterFreq: 2200 });
  playTone({ freq: 180, freqEnd: 60, type: 'square', duration: 0.08, volume: 0.4 });
}

function playEnemyGunshot() {
  playNoiseBurst({ duration: 0.08, volume: 0.28, filterFreq: 1400 });
  playTone({ freq: 140, freqEnd: 50, type: 'square', duration: 0.07, volume: 0.22 });
}

function playHeadshot() {
  playTone({ freq: 880, type: 'sine', duration: 0.12, volume: 0.5 });
  playTone({ freq: 1320, type: 'sine', duration: 0.18, volume: 0.35, attack: 0.05 });
}

function playHurt() {
  playNoiseBurst({ duration: 0.15, volume: 0.4, filterFreq: 500 });
}

function playArmorDeflect() {
  playTone({ freq: 1600, freqEnd: 900, type: 'triangle', duration: 0.08, volume: 0.4 });
  playNoiseBurst({ duration: 0.04, volume: 0.25, filterFreq: 3200 });
}

function playEnemyDeath() {
  playTone({ freq: 220, freqEnd: 40, type: 'sawtooth', duration: 0.25, volume: 0.3 });
}

function playLevelUp() {
  [523, 659, 784, 1046].forEach((freq, i) => {
    setTimeout(() => playTone({ freq, type: 'triangle', duration: 0.18, volume: 0.4 }), i * 90);
  });
}

function playHealChime() {
  [660, 880, 990].forEach((freq, i) => {
    setTimeout(() => playTone({ freq, type: 'sine', duration: 0.5, volume: 0.25, attack: 0.05 }), i * 140);
  });
}

function playFootstep() {
  playNoiseBurst({ duration: 0.05, volume: 0.1, filterFreq: 280 });
}

function playPickup() {
  playTone({ freq: 740, freqEnd: 1180, type: 'triangle', duration: 0.14, volume: 0.4 });
}

function playWeaponSwitch() {
  playTone({ freq: 320, type: 'square', duration: 0.05, volume: 0.2 });
}

let ambientNodes = null;
function startAmbientDrone() {
  if (ambientNodes || audioMuted) return;
  const osc1 = audioCtx.createOscillator();
  osc1.type = 'sine';
  osc1.frequency.value = 55;
  const osc2 = audioCtx.createOscillator();
  osc2.type = 'sine';
  osc2.frequency.value = 82.4;
  const gain = audioCtx.createGain();
  gain.gain.value = 0.035 * masterVolume;
  osc1.connect(gain);
  osc2.connect(gain);
  gain.connect(audioCtx.destination);
  osc1.start();
  osc2.start();
  ambientNodes = { osc1, osc2, gain };
}
function stopAmbientDrone() {
  if (!ambientNodes) return;
  ambientNodes.osc1.stop();
  ambientNodes.osc2.stop();
  ambientNodes = null;
}
function setAudioMuted(muted) {
  audioMuted = muted;
  localStorage.setItem('sniperstrike-muted', String(muted));
  if (muted) stopAmbientDrone();
  else startAmbientDrone();
}

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(70, window.innerWidth / window.innerHeight, 0.1, 1000);
const renderer = new THREE.WebGLRenderer({ antialias: true });

renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
document.body.appendChild(renderer.domElement);

const DEFAULT_SKY_COLOR = new THREE.Color(0x8fc7ff);
scene.background = DEFAULT_SKY_COLOR.clone();
const ambientLight = new THREE.AmbientLight(0xffffff, 0.7);
scene.add(ambientLight);

const hemiLight = new THREE.HemisphereLight(0xa6cdfa, 0x406783, 0.6);
scene.add(hemiLight);

const directionalLight = new THREE.DirectionalLight(0xffffff, 1.0);
directionalLight.position.set(40, 80, 40);
scene.add(directionalLight);

// Shared humanoid detail pieces — built once and reused by every character/enemy/NPC.
const eyeMaterial = new THREE.MeshStandardMaterial({ color: 0x1b1b1b, roughness: 0.4 });
const eyeGeometry = new THREE.SphereGeometry(0.045, 8, 8);
const handGeometry = new THREE.SphereGeometry(0.13, 10, 8);
const footGeometry = new THREE.BoxGeometry(0.2, 0.12, 0.34);
const shoeMaterial = new THREE.MeshStandardMaterial({ color: 0x18171a, roughness: 0.55, metalness: 0.05 });
const tearMaterial = new THREE.MeshStandardMaterial({
  color: 0x29a9ff, transparent: true, opacity: 0.95, roughness: 0.05, metalness: 0.1, emissive: 0x1a8cff, emissiveIntensity: 0.9
});
const tearGeometry = new THREE.ConeGeometry(0.025, 0.08, 6);
const mouthMaterial = new THREE.MeshStandardMaterial({ color: 0x5c2a2a, roughness: 0.5 });
// A half-ring "hill" shape by default (peak in the middle) — that's a frown. Rotating the
// mesh 180° around its own depth axis flips it into a "valley" shape — a smile.
const mouthGeometry = new THREE.TorusGeometry(0.05, 0.012, 6, 10, Math.PI);

directionalLight.castShadow = true;
directionalLight.shadow.camera.left = -120;
directionalLight.shadow.camera.right = 120;
directionalLight.shadow.camera.top = 120;
directionalLight.shadow.camera.bottom = -120;
directionalLight.shadow.mapSize.set(2048, 2048);

directionalLight.shadow.bias = -0.0005;

const sun = new THREE.Mesh(
  new THREE.SphereGeometry(4, 24, 24),
  new THREE.MeshBasicMaterial({ color: 0xfff3b0, transparent: true, opacity: 0.95 })
);
sun.position.set(70, 80, -60);
scene.add(sun);

const cloudGroup = new THREE.Group();
function createCloud(x, y, z, scale) {
  const cloud = new THREE.Group();
  const cloudMat = new THREE.MeshStandardMaterial({ color: 0xffffff, transparent: true, opacity: 0.88, roughness: 0.9 });
  for (let i = 0; i < 5; i++) {
    const sphere = new THREE.Mesh(new THREE.SphereGeometry(4 + Math.random() * 3, 16, 12), cloudMat);
    sphere.position.set((Math.random() - 0.5) * 10, (Math.random() - 0.2) * 4, (Math.random() - 0.5) * 8);
    cloud.add(sphere);
  }
  cloud.position.set(x, y, z);
  cloud.scale.set(scale, scale, scale);
  cloudGroup.add(cloud);
}
createCloud(-45, 75, -20, 1.3);
createCloud(10, 82, 10, 1.5);
createCloud(45, 70, 25, 1.2);
createCloud(80, 85, 40, 1.4);
scene.add(cloudGroup);

function createFacadeTexture(mainColor, accentColor) {
  const size = 256;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d');

  const gradient = ctx.createLinearGradient(0, 0, 0, size);
  gradient.addColorStop(0, '#ffffff22');
  gradient.addColorStop(0.2, mainColor);
  gradient.addColorStop(1, '#00000012');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, size, size);

  ctx.strokeStyle = accentColor;
  ctx.lineWidth = 2;
  for (let y = 0; y < size; y += 22) {
    ctx.beginPath();
    ctx.moveTo(0, y + 1);
    ctx.lineTo(size, y + 1);
    ctx.stroke();
  }
  for (let x = 0; x < size; x += 16) {
    ctx.beginPath();
    ctx.moveTo(x + 1, 0);
    ctx.lineTo(x + 1, size);
    ctx.stroke();
  }

  ctx.fillStyle = 'rgba(255,255,255,0.14)';
  for (let y = 8; y < size; y += 16) {
    for (let x = 4; x < size; x += 18) {
      if (Math.random() < 0.45) continue;
      ctx.fillRect(x, y, 8, 10);
    }
  }

  ctx.fillStyle = 'rgba(255,255,255,0.08)';
  for (let y = 4; y < size; y += 40) {
    ctx.fillRect(0, y, size, 2);
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(1, 1);
  texture.anisotropy = renderer.capabilities.getMaxAnisotropy();
  return texture;
}

const ground = new THREE.Mesh(
  new THREE.PlaneGeometry(320, 320),
  new THREE.MeshStandardMaterial({ color: 0x1a304e, roughness: 0.96, metalness: 0.05 })
);
ground.rotation.x = -Math.PI / 2;
ground.receiveShadow = true;
scene.add(ground);

const roadMaterial = new THREE.MeshStandardMaterial({ color: 0x1d2731, roughness: 0.92, metalness: 0.02 });
roadMaterial.polygonOffset = true;
roadMaterial.polygonOffsetFactor = 1;
roadMaterial.polygonOffsetUnits = 1;
const stripeMaterial = new THREE.MeshStandardMaterial({ color: 0xc9d9e9, emissive: 0x8ab4d0, emissiveIntensity: 0.16, roughness: 0.7 });
stripeMaterial.polygonOffset = true;
stripeMaterial.polygonOffsetFactor = 1;
stripeMaterial.polygonOffsetUnits = 1;
const ROAD_LINES = [-108, -72, -36, 0, 36, 72, 108];
const ROAD_WIDTH = 10;
const ROAD_CLEARANCE = 12;

function isOnRoad(x, z) {
  return ROAD_LINES.some((line) => Math.abs(x - line) < ROAD_CLEARANCE || Math.abs(z - line) < ROAD_CLEARANCE);
}

// Builds the Metro City road grid into its own group (instead of adding tiles
// straight to the scene) so loadMap() can remove every tile in one shot via
// registerMapGroup() — see buildMetroCityMap() further below.
function buildMetroRoads() {
  const roadGroup = new THREE.Group();
  for (let i = 0; i < ROAD_LINES.length; i++) {
    const line = ROAD_LINES[i];
    const avenue = new THREE.Mesh(
      new THREE.BoxGeometry(320, 0.04, ROAD_WIDTH),
      roadMaterial
    );
    avenue.position.set(0, 0.02, line);
    avenue.receiveShadow = true;
    roadGroup.add(avenue);

    const street = new THREE.Mesh(
      new THREE.BoxGeometry(ROAD_WIDTH, 0.04, 320),
      roadMaterial
    );
    street.position.set(line, 0.02, 0);
    street.receiveShadow = true;
    roadGroup.add(street);

    for (let segment = -7; segment <= 7; segment++) {
      const crosswalkH = new THREE.Mesh(
        new THREE.BoxGeometry(6, 0.06, 0.8),
        stripeMaterial
      );
      crosswalkH.position.set(segment * 16, 0.03, line);
      roadGroup.add(crosswalkH);

      const crosswalkV = new THREE.Mesh(
        new THREE.BoxGeometry(0.8, 0.06, 6),
        stripeMaterial
      );
      crosswalkV.position.set(line, 0.03, segment * 16);
      roadGroup.add(crosswalkV);
    }
  }
  return roadGroup;
}

let cityGroup;
const churchWallMaterial = new THREE.MeshStandardMaterial({ map: createFacadeTexture('#f8f1e8', '#d0bfae'), bumpMap: createFacadeTexture('#f8f1e8', '#d0bfae'), bumpScale: 0.08, roughness: 0.32, metalness: 0.12, clearcoat: 0.24, clearcoatRoughness: 0.1, envMapIntensity: 1.3 });
const churchRoofMaterial = new THREE.MeshStandardMaterial({ color: 0x442e1f, roughness: 0.22, metalness: 0.18, clearcoat: 0.22, clearcoatRoughness: 0.08, envMapIntensity: 1.4 });
const churchCrossMaterial = new THREE.MeshStandardMaterial({ color: 0xfff9e5, emissive: 0xf8e7c9, emissiveIntensity: 0.45, roughness: 0.18, metalness: 0.6 });
const windowMaterial = new THREE.MeshStandardMaterial({ color: 0xd9ddff, emissive: 0x1c2b7a, emissiveIntensity: 0.8, roughness: 0.18, metalness: 0.05 });
const storeWindowMaterial = new THREE.MeshStandardMaterial({ color: 0xefd8b2, emissive: 0xf5e1b2, emissiveIntensity: 0.18, roughness: 0.45 });

// Themed walk-in stores — each archetype opens a different slice of the Armory
// when the player steps inside (see updateStoreTriggers()/ARMORY catalog).
const STORE_TYPES = {
  guns: {
    label: 'Gun Shop', tabs: ['weapons', 'skins'], frameColor: '#3b2727', accentColor: 0x6b2b2b,
    names: ["Joe's Arsenal", 'Liberty Firearms', 'Precision Outfitters', 'Steel & Sons'],
  },
  boutique: {
    label: 'Boutique', tabs: ['clothes'], frameColor: '#4a2b4a', accentColor: 0x6b3c6b,
    names: ['Threads NYC', 'Uptown Fits', 'Avenue Couture', 'Empire Wardrobe'],
  },
  surplus: {
    label: 'Surplus Depot', tabs: ['armor'], frameColor: '#27374a', accentColor: 0x35506b,
    names: ['Iron Surplus', 'Bastion Supply', 'City Armor Co.', 'Fortress Goods'],
  },
  lounge: {
    label: 'Lounge', tabs: ['emotes'], frameColor: '#4a3b1f', accentColor: 0x7a5a1f,
    names: ['Groove Lounge', 'The Encore', 'Spotlight Club', 'Velvet Room'],
  },
  vip: {
    label: 'VIP Club', tabs: ['vip'], frameColor: '#3a1f4a', accentColor: 0x5a1f8a,
    names: ['Olympus Club', 'The Penthouse', 'Apex Lounge', 'Titan Club'],
  },
};
const STORE_TYPE_KEYS = Object.keys(STORE_TYPES);

function createStoreSignTexture(text, frameColor = '#3b4a63', subtitle = 'OPEN 24/7') {
  const width = 512;
  const height = 128;
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');

  ctx.fillStyle = frameColor;
  ctx.fillRect(0, 0, width, height);

  ctx.fillStyle = '#f8f0c2';
  ctx.fillRect(0, 0, width, height * 0.7);
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 10;
  ctx.strokeRect(4, 4, width - 8, height - 8);

  let fontSize = 64;
  ctx.font = `bold ${fontSize}px Arial`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = '#1f2a3c';
  const maxWidth = width - 40;
  while (ctx.measureText(text.toUpperCase()).width > maxWidth && fontSize > 24) {
    fontSize -= 2;
    ctx.font = `bold ${fontSize}px Arial`;
  }
  ctx.fillText(text.toUpperCase(), width / 2, height * 0.42);

  ctx.font = '28px Arial';
  ctx.fillStyle = '#ffffff';
  ctx.fillText(subtitle, width / 2, height * 0.78);

  const texture = new THREE.CanvasTexture(canvas);
  texture.minFilter = THREE.LinearFilter;
  texture.magFilter = THREE.LinearFilter;
  return texture;
}

function createChurchSignTexture(text) {
  const width = 640;
  const height = 180;
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');

  ctx.fillStyle = '#1e2634';
  ctx.fillRect(0, 0, width, height);
  const gradient = ctx.createLinearGradient(0, 0, width, height);
  gradient.addColorStop(0, '#f7f1d6');
  gradient.addColorStop(1, '#c8ae6c');
  ctx.fillStyle = gradient;
  ctx.fillRect(16, 16, width - 32, height - 32);

  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 8;
  ctx.strokeRect(16, 16, width - 32, height - 32);

  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = '#1a1b27';

  let titleFontSize = 44;
  ctx.font = `bold ${titleFontSize}px Arial`;
  const maxWidth = width - 96;
  while (ctx.measureText(text.toUpperCase()).width > maxWidth && titleFontSize > 20) {
    titleFontSize -= 2;
    ctx.font = `bold ${titleFontSize}px Arial`;
  }
  ctx.fillText(text.toUpperCase(), width / 2, height / 2 - 12);

  ctx.font = '20px Arial';
  ctx.fillStyle = '#2f3a56';
  ctx.fillText('A Weaponstrike Sanctuary', width / 2, height / 2 + 40);

  const texture = new THREE.CanvasTexture(canvas);
  texture.minFilter = THREE.LinearFilter;
  texture.magFilter = THREE.LinearFilter;
  return texture;
}

const buildingMaterials = [
  new THREE.MeshStandardMaterial({ map: createFacadeTexture('#3d4d76', '#50619a'), bumpMap: createFacadeTexture('#3d4d76', '#50619a'), bumpScale: 0.05, roughness: 0.15, metalness: 0.34, clearcoat: 0.22, clearcoatRoughness: 0.08, envMapIntensity: 1.2 }),
  new THREE.MeshStandardMaterial({ map: createFacadeTexture('#454a5e', '#6d7db2'), bumpMap: createFacadeTexture('#454a5e', '#6d7db2'), bumpScale: 0.05, roughness: 0.18, metalness: 0.3, clearcoat: 0.18, clearcoatRoughness: 0.12, envMapIntensity: 1.1 }),
  new THREE.MeshStandardMaterial({ map: createFacadeTexture('#3b3e4f', '#45608f'), bumpMap: createFacadeTexture('#3b3e4f', '#45608f'), bumpScale: 0.05, roughness: 0.2, metalness: 0.28, clearcoat: 0.16, clearcoatRoughness: 0.14, envMapIntensity: 1.0 }),
];

const ROAD_BANDS = ROAD_LINES;
// ---------------------------------------------------------------------------
// Map switching — MAP_RADIUS/activeRoadBands/isInsideMapInterior are mutable,
// per-map state set by loadMap() (see the MAPS registry + loadMap() further
// below, after every map's build function is defined). Defaults here only
// matter before the very first loadMap() call.
// ---------------------------------------------------------------------------
let MAP_RADIUS = 160;
let activeRoadBands = ROAD_BANDS;
let isInsideMapInterior = () => false;
// Every top-level THREE.Object3D a map's build function adds to the scene gets
// pushed here, so loadMap() can remove the previous map's entire world with a
// single generic loop instead of each map needing its own teardown logic.
let activeMapGroups = [];
function registerMapGroup(obj) {
  scene.add(obj);
  activeMapGroups.push(obj);
}

function buildMetroBuildings() {
  cityGroup = new THREE.Group();
  for (let i = 0; i < 220; i++) {
    const width = 3.2 + Math.random() * 5.5;
    const depth = 3.2 + Math.random() * 5.5;
    const height = 12 + Math.random() * 58;
    const material = buildingMaterials[Math.floor(Math.random() * buildingMaterials.length)];
    const building = new THREE.Mesh(
      new THREE.BoxGeometry(width, height, depth),
      material
    );

    let x, z;
    do {
      x = Math.round((Math.random() - 0.5) * MAP_RADIUS * 1.65);
      z = Math.round((Math.random() - 0.5) * MAP_RADIUS * 1.65);
    } while (isOnRoad(x, z));

    building.position.set(x, height / 2, z);
    building.castShadow = true;
    cityGroup.add(building);

    const windowCount = 6 + Math.floor(Math.random() * 6);
    for (let j = 0; j < windowCount; j++) {
      const rows = 3 + Math.floor(Math.random() * 5);
      const cols = 2 + Math.floor(Math.random() * 5);
      for (let y = 0; y < rows; y++) {
        for (let x = 0; x < cols; x++) {
          if (Math.random() > 0.45) continue;
          const win = new THREE.Mesh(
            new THREE.BoxGeometry(width / cols * 0.76, 0.14, depth / 5),
            windowMaterial
          );
          win.position.set(
            -(width * 0.44) + (x * width) / cols + width / (cols * 2),
            -height / 2 + (y * height) / rows + height / (rows * 2) + 0.55,
            depth / 2 + 0.01
          );
          building.add(win);
        }
      }
    }
  }
}
function createChurch(x, z) {
  const church = new THREE.Group();

  const nave = new THREE.Group();

  const leftWall = new THREE.Mesh(
    new THREE.BoxGeometry(2.6, 8, 20),
    churchWallMaterial
  );
  leftWall.position.set(x - 5.7, 4, z);
  nave.add(leftWall);

  const rightWall = new THREE.Mesh(
    new THREE.BoxGeometry(2.6, 8, 20),
    churchWallMaterial
  );
  rightWall.position.set(x + 5.7, 4, z);
  nave.add(rightWall);

  const backWall = new THREE.Mesh(
    new THREE.BoxGeometry(8.8, 8, 1.6),
    churchWallMaterial
  );
  backWall.position.set(x, 4, z - 9.2);
  nave.add(backWall);

  const frontLeft = new THREE.Mesh(
    new THREE.BoxGeometry(4.1, 8, 1.6),
    churchWallMaterial
  );
  frontLeft.position.set(x - 4.5, 4, z + 9.2);
  nave.add(frontLeft);

  const frontRight = new THREE.Mesh(
    new THREE.BoxGeometry(4.1, 8, 1.6),
    churchWallMaterial
  );
  frontRight.position.set(x + 4.5, 4, z + 9.2);
  nave.add(frontRight);

  church.add(nave);

  // Sits above the roofline only (y >= 8) so it never intrudes into the interior —
  // it used to extend down to y=2, which hid anything tall standing at the altar.
  const tower = new THREE.Mesh(
    new THREE.BoxGeometry(6, 6, 6),
    churchWallMaterial
  );
  tower.position.set(x, 11, z - 6);
  church.add(tower);

  const roof = new THREE.Mesh(
    new THREE.ConeGeometry(7.5, 4, 4),
    churchRoofMaterial
  );
  roof.rotation.y = Math.PI / 4;
  roof.position.set(x, 12, z);
  church.add(roof);

  const cross = new THREE.Mesh(
    new THREE.BoxGeometry(0.4, 3.5, 0.4),
    churchCrossMaterial
  );
  cross.position.set(x, 15, z - 6);
  church.add(cross);

  const crossArm = new THREE.Mesh(
    new THREE.BoxGeometry(2.2, 0.4, 0.4),
    churchCrossMaterial
  );
  crossArm.position.set(x, 16, z - 6);
  church.add(crossArm);

  const doorMaterial = new THREE.MeshStandardMaterial({ color: 0x3b2f20, roughness: 0.58, metalness: 0.18, envMapIntensity: 1.1 });
  const door = new THREE.Mesh(
    new THREE.BoxGeometry(3, 5, 0.4),
    doorMaterial
  );
  door.position.set(x, 2.5, z + 10.2);
  church.add(door);

  const doorHandle = new THREE.Mesh(
    new THREE.SphereGeometry(0.14, 12, 12),
    new THREE.MeshStandardMaterial({ color: 0xd4b56c, roughness: 0.18, metalness: 0.95, emissive: 0x46340f, emissiveIntensity: 0.08 })
  );
  doorHandle.position.set(x + 1.05, 2.5, z + 10.4);
  church.add(doorHandle);

  const window = new THREE.Mesh(
    new THREE.BoxGeometry(1.6, 2.2, 0.2),
    windowMaterial
  );
  // smaller window above the door to avoid visual clutter
  window.position.set(x, 5.8, z + 10.45);
  // reduce z-fighting with nearby front walls/trim by nudging forward and
  // enabling polygon offset when supported
  if (window.material) {
    window.material.polygonOffset = true;
    window.material.polygonOffsetFactor = -1;
    window.material.polygonOffsetUnits = 1;
  }
  window.renderOrder = 2;
  church.add(window);

  const interiorWallMaterial = new THREE.MeshStandardMaterial({ color: 0xeddfd0, roughness: 0.4, metalness: 0.05, side: THREE.BackSide });
  const interiorNave = new THREE.Mesh(
    new THREE.BoxGeometry(13.2, 7.4, 19.2),
    interiorWallMaterial
  );
  interiorNave.position.set(x, 4, z);
  church.add(interiorNave);

  const interiorFloor = new THREE.Mesh(
    new THREE.BoxGeometry(12.6, 0.2, 18.6),
    new THREE.MeshStandardMaterial({ color: 0x4b3e32, roughness: 0.8, metalness: 0.03 })
  );
  interiorFloor.position.set(x, 0.1, z);
  church.add(interiorFloor);

  const pewMaterial = new THREE.MeshStandardMaterial({ color: 0x60472d, roughness: 0.7, metalness: 0.05 });
  const congregantSkinMaterial = new THREE.MeshStandardMaterial({ color: 0xe3b89c, roughness: 0.45, metalness: 0.02 });
  const congregantClothColors = [0x6b4a3a, 0x3c556f, 0x556b3c, 0x7a3c4a, 0x4a4a6b];

  // A simple seated congregant — torso + head + eyes + hideable tears, facing whichever
  // way it's rotated.
  function createCongregant(clothColor) {
    const person = new THREE.Group();
    const cloth = new THREE.MeshStandardMaterial({ color: clothColor, roughness: 0.55, metalness: 0.05 });

    // Broader, longer torso with a proportionally smaller head — adult proportions
    // instead of the large-head/small-body look that read as a baby.
    const torso = new THREE.Mesh(new THREE.CapsuleGeometry(0.22, 0.5, 4, 8), cloth);
    torso.scale.set(1.3, 1, 0.85);
    torso.position.set(0, 0.47, 0);
    person.add(torso);

    const head = new THREE.Mesh(new THREE.SphereGeometry(0.13, 10, 8), congregantSkinMaterial);
    head.position.set(0, 1.04, 0);
    person.add(head);

    const eyeLeft = new THREE.Mesh(eyeGeometry, eyeMaterial);
    eyeLeft.scale.setScalar(0.55);
    eyeLeft.position.set(-0.05, 0.01, 0.105);
    head.add(eyeLeft);
    const eyeRight = eyeLeft.clone();
    eyeRight.position.x = 0.05;
    head.add(eyeRight);

    const tearLeft = new THREE.Mesh(tearGeometry, tearMaterial);
    tearLeft.scale.set(1.4, 2.1, 1.4);
    tearLeft.position.set(-0.055, -0.03, 0.105);
    tearLeft.userData.baseY = tearLeft.position.y;
    tearLeft.userData.dropRange = 0.16;
    tearLeft.visible = false;
    head.add(tearLeft);
    const tearRight = tearLeft.clone();
    tearRight.position.x = 0.055;
    head.add(tearRight);

    // Starts smiling (valley shape); setCongregationCrying flips it to a frown.
    const mouth = new THREE.Mesh(mouthGeometry, mouthMaterial);
    mouth.position.set(0, -0.045, 0.105);
    mouth.rotation.z = Math.PI;
    head.add(mouth);

    return { person, tears: [tearLeft, tearRight], mouth };
  }

  const pewSeatHeight = 1.24; // top of the pew seat — where seated congregants rest
  const congregantOffsets = [-3.3, -1.1, 1.1, 3.3];
  for (let i = 0; i < 4; i++) {
    const rowZ = z + 4 - i * 2.8;
    const pew = new THREE.Mesh(new THREE.BoxGeometry(9.2, 0.28, 0.5), pewMaterial);
    pew.position.set(x, 1.1, rowZ);
    church.add(pew);
    const pewBack = new THREE.Mesh(new THREE.BoxGeometry(9.2, 0.55, 0.18), pewMaterial);
    pewBack.position.set(x, 1.45, rowZ + 0.35);
    church.add(pewBack);

    congregantOffsets.forEach((offsetX, j) => {
      const { person: congregant, tears, mouth } = createCongregant(congregantClothColors[(i + j) % congregantClothColors.length]);
      congregant.position.set(x + offsetX, pewSeatHeight, rowZ);
      // Face the altar/Obispo (-Z) — the backrest (now on the +Z side) sits behind them.
      congregant.rotation.y = Math.PI;
      church.add(congregant);
      congregants.push({ group: congregant, tears, mouth });
    });
  }

  // Raised stage at the altar end of the nave.
  const stageHeight = 0.3;
  const stage = new THREE.Mesh(
    new THREE.BoxGeometry(10.2, stageHeight, 4),
    new THREE.MeshStandardMaterial({ color: 0x7f6a54, roughness: 0.42, metalness: 0.06 })
  );
  stage.position.set(x, stageHeight / 2, z - 7.2);
  church.add(stage);

  const altar = new THREE.Mesh(
    new THREE.BoxGeometry(3.4, 0.9, 1.8),
    new THREE.MeshStandardMaterial({ color: 0x948068, roughness: 0.4, metalness: 0.1 })
  );
  altar.position.set(x, 1.05 + stageHeight, z - 7.2);
  church.add(altar);

  const altarCross = new THREE.Mesh(
    new THREE.BoxGeometry(0.18, 1.6, 0.18),
    churchCrossMaterial
  );
  altarCross.position.set(x, 2.15 + stageHeight, z - 7.2);
  church.add(altarCross);

  const altarCrossArm = new THREE.Mesh(
    new THREE.BoxGeometry(0.8, 0.18, 0.18),
    churchCrossMaterial
  );
  altarCrossArm.position.set(x, 2.65 + stageHeight, z - 7.2);
  church.add(altarCrossArm);

  const npc = new THREE.Group();
  const npcSkinMaterial = new THREE.MeshStandardMaterial({ color: 0xe3b89c, roughness: 0.45, metalness: 0.02 });
  const npcHatMaterial = new THREE.MeshStandardMaterial({ color: 0x000000, roughness: 0.45, metalness: 0.08 });
  const npcClothMaterial = new THREE.MeshStandardMaterial({ color: 0x1c3b7a, roughness: 0.45, metalness: 0.08 });
  const npcHead = new THREE.Mesh(new THREE.SphereGeometry(0.22, 12, 10), npcSkinMaterial);
  npcHead.position.set(0, 1.4, 0);
  // Counter-rotate the head so the face looks at the congregation (+Z) even though the
  // body (and the rest of npc) faces the altar (-Z).
  npcHead.rotation.y = Math.PI;
  npc.add(npcHead);
  const npcEyeLeft = new THREE.Mesh(eyeGeometry, eyeMaterial);
  npcEyeLeft.scale.setScalar(0.7);
  npcEyeLeft.position.set(-0.08, 0.02, 0.19);
  npcHead.add(npcEyeLeft);
  const npcEyeRight = npcEyeLeft.clone();
  npcEyeRight.position.x = 0.08;
  npcHead.add(npcEyeRight);
  const npcTearLeft = new THREE.Mesh(tearGeometry, tearMaterial);
  npcTearLeft.scale.set(1.3, 2, 1.3);
  npcTearLeft.position.set(-0.09, -0.05, 0.18);
  npcTearLeft.userData.baseY = npcTearLeft.position.y;
  npcTearLeft.userData.dropRange = 0.16;
  npcTearLeft.visible = false;
  npcHead.add(npcTearLeft);
  const npcTearRight = npcTearLeft.clone();
  npcTearRight.position.x = 0.09;
  npcHead.add(npcTearRight);
  // Starts smiling (valley shape); setCongregationCrying flips it to a frown.
  const npcMouth = new THREE.Mesh(mouthGeometry, mouthMaterial);
  npcMouth.scale.setScalar(1.7);
  npcMouth.position.set(0, -0.07, 0.19);
  npcMouth.rotation.z = Math.PI;
  npcHead.add(npcMouth);
  const npcBody = new THREE.Mesh(new THREE.BoxGeometry(0.6, 1.1, 0.3), npcClothMaterial);
  npcBody.position.set(0, 0.55, 0);
  npc.add(npcBody);
  const npcHat = new THREE.Mesh(new THREE.CylinderGeometry(0.26, 0.28, 0.18, 12), npcHatMaterial);
  // Sits on top of the head, above the eye line — it used to overlap the eyes and hide the face.
  npcHat.position.set(0, 1.58, 0);
  npc.add(npcHat);
  const npcArmLeft = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 0.8, 8), npcSkinMaterial);
  npcArmLeft.position.set(-0.4, 0.85, 0);
  npcArmLeft.rotation.z = 0.3;
  npc.add(npcArmLeft);
  const npcArmRight = npcArmLeft.clone();
  npcArmRight.position.set(0.4, 0.85, 0);
  npcArmRight.rotation.z = -0.3;
  npc.add(npcArmRight);
  // Stand front-and-center on the stage, in front of the altar, facing the congregation.
  // (Stage now spans z-9.2..z-5.2 and the altar z-8.1..z-6.3, so z-5.7 clears both edges
  // instead of overhanging the stage's old, too-shallow front lip.)
  npc.position.set(x, stageHeight, z - 5.7);
  npc.rotation.y = Math.PI;
  // Model is ~1.62 units (head to feet) at scale 1; scale up so he stands 10 feet (~3.05m) tall.
  npc.scale.setScalar((10 * 0.3048) / 1.62);
  npc.name = 'Obispo Bonano';
  church.add(npc);
  interactableObjects.push(npc);
  obispoTears = [npcTearLeft, npcTearRight];
  obispoMouth = npcMouth;

  const detailMaterial = new THREE.MeshStandardMaterial({ color: 0xb59f82, roughness: 0.2, metalness: 0.28, envMapIntensity: 1.2 });
  const detailHeight = 0.35;
  const detailDepth = 0.55;
  const trimLeft = new THREE.Mesh(new THREE.BoxGeometry(10.5, detailHeight, detailDepth), detailMaterial);
  trimLeft.position.set(x, 9.2, z + 10.2);
  church.add(trimLeft);

  const signTexture = createChurchSignTexture('Times Square Church');
  const churchSign = new THREE.Mesh(
    new THREE.BoxGeometry(9.8, 2.3, 0.18),
    new THREE.MeshStandardMaterial({ map: signTexture, emissive: 0x7c6b42, emissiveIntensity: 0.08, roughness: 0.3, metalness: 0.25 })
  );
  churchSign.position.set(x, 8.2, z + 10.21);
  church.add(churchSign);

  const sideWindowGeom = new THREE.BoxGeometry(1.4, 3.5, 0.2);
  for (let i = 0; i < 3; i++) {
    const sideWinLeft = new THREE.Mesh(sideWindowGeom, windowMaterial);
    sideWinLeft.position.set(x - 5.3, 4.5, z - 4 + i * 4.5);
    sideWinLeft.rotation.y = Math.PI / 2;
    church.add(sideWinLeft);

    const sideWinRight = new THREE.Mesh(sideWindowGeom, windowMaterial);
    sideWinRight.position.set(x + 5.3, 4.5, z - 4 + i * 4.5);
    sideWinRight.rotation.y = Math.PI / 2;
    church.add(sideWinRight);
  }

  const buttressMaterial = new THREE.MeshStandardMaterial({ color: 0xded2c1, roughness: 0.34, metalness: 0.14 });
  for (let i = -1; i <= 1; i += 2) {
    for (let j = 0; j < 2; j++) {
      const buttress = new THREE.Mesh(new THREE.BoxGeometry(0.8, 5.5, 0.8), buttressMaterial);
      buttress.position.set(x + i * 6.9, 3.3, z - 4.5 + j * 9);
      church.add(buttress);
    }
  }

  const stepMaterial = new THREE.MeshStandardMaterial({ color: 0x7f6a54, roughness: 0.42, metalness: 0.06 });
  const step = new THREE.Mesh(new THREE.BoxGeometry(6.2, 0.35, 1.2), stepMaterial);
  step.position.set(x, 0.2, z + 9.2);
  church.add(step);

  church.traverse((child) => { child.castShadow = true; });
  return church;
}

const interactableObjects = [];
// Populated by createChurch() — used to run the once-per-level crying/healing event.
// Metro City only — kept entirely separate from the Vatican's own congregation
// (vaticanCongregants below) so the two maps' NPCs/events never cross-talk.
const congregants = [];
let obispoTears = [];
let obispoMouth = null;

// The Vatican's congregation (parallel to, not shared with, congregants above)
// and the generic "running toward an exit point" animation used by its
// round-start flee sequence — see buildVaticanCongregation()/triggerVaticanFleeSequence().
const vaticanCongregants = [];
let vaticanPopeGroup = null;
let fleeingNpcs = [];

function updateFleeingNpcs(dt) {
  if (!fleeingNpcs.length) return;
  for (let i = fleeingNpcs.length - 1; i >= 0; i--) {
    const npc = fleeingNpcs[i];
    const toTarget = npc.target.clone().sub(npc.group.position);
    toTarget.y = 0;
    const distance = toTarget.length();
    if (distance < 1.2) {
      npc.group.visible = false;
      fleeingNpcs.splice(i, 1);
      continue;
    }
    const dir = toTarget.normalize();
    npc.group.position.addScaledVector(dir, npc.speed * dt);
    npc.group.rotation.y = Math.atan2(dir.x, dir.z);
  }
}

// ---------------------------------------------------------------------------
// Wall collision — a flat list of axis-aligned boxes (store walls only; the
// rest of the city has none, unchanged). Player movement is resolved per-axis
// (see handleControls()) so the player slides along a wall instead of being
// hard-stopped by it. Declared here, before spawnStores() runs, since store
// creation registers colliders as it builds each store.
// ---------------------------------------------------------------------------
const wallColliders = [];
function registerWallCollider(minX, maxX, minZ, maxZ) {
  wallColliders.push({ minX, maxX, minZ, maxZ });
}
function collidesWithWalls(x, z, radius) {
  for (let i = 0; i < wallColliders.length; i++) {
    const box = wallColliders[i];
    if (x + radius > box.minX && x - radius < box.maxX && z + radius > box.minZ && z - radius < box.maxZ) {
      return true;
    }
  }
  return false;
}

// Reassigned fresh by each map's build function (see buildMetroCityMap() and
// loadMap() below) and added to the scene via registerMapGroup() — not a
// fixed Metro-only group, even though Metro is still the only map today.
let storeGroup;
const storeWallMaterial = new THREE.MeshStandardMaterial({ color: 0xd0a87a, roughness: 0.52, metalness: 0.06 });
const storeRoofMaterial = new THREE.MeshStandardMaterial({ color: 0x5a4632, roughness: 0.6, metalness: 0.08 });
// Registry of walk-in stores — used by updateStoreTriggers() to detect the
// player entering/leaving and to know which Armory tab(s) to open.
const stores = [];

// Bigger than the old single-box facade and genuinely hollow: 5 wall segments
// (same convention as the church nave) leave a wide double-door gap in front,
// a tinted BackSide interior shell + floor make the inside readable, and each
// wall segment's bounds are registered as a wallCollider so the player is
// blocked by the walls and can only get in/out through the doorway.
function createStore(x, z, width, depth, typeKey) {
  const type = STORE_TYPES[typeKey];
  const height = 5.5;
  const wallThickness = 0.4;
  const doorWidth = 2.6;
  const halfW = width / 2;
  const halfD = depth / 2;
  const frontSegWidth = (width - doorWidth) / 2;

  const store = new THREE.Group();

  const leftWall = new THREE.Mesh(new THREE.BoxGeometry(wallThickness, height, depth), storeWallMaterial);
  leftWall.position.set(-halfW, height / 2, 0);
  store.add(leftWall);

  const rightWall = leftWall.clone();
  rightWall.position.x = halfW;
  store.add(rightWall);

  const backWall = new THREE.Mesh(new THREE.BoxGeometry(width, height, wallThickness), storeWallMaterial);
  backWall.position.set(0, height / 2, -halfD);
  store.add(backWall);

  const frontLeft = new THREE.Mesh(new THREE.BoxGeometry(frontSegWidth, height, wallThickness), storeWallMaterial);
  frontLeft.position.set(-(doorWidth / 2 + frontSegWidth / 2), height / 2, halfD);
  store.add(frontLeft);

  const frontRight = frontLeft.clone();
  frontRight.position.x = doorWidth / 2 + frontSegWidth / 2;
  store.add(frontRight);

  const roof = new THREE.Mesh(new THREE.BoxGeometry(width + 0.3, 0.3, depth + 0.3), storeRoofMaterial);
  roof.position.set(0, height + 0.15, 0);
  store.add(roof);

  const interiorMat = new THREE.MeshStandardMaterial({ color: type.accentColor, roughness: 0.55, metalness: 0.06, side: THREE.BackSide });
  const interiorShell = new THREE.Mesh(new THREE.BoxGeometry(width, height, depth), interiorMat);
  interiorShell.position.set(0, height / 2, 0);
  store.add(interiorShell);

  const floor = new THREE.Mesh(
    new THREE.BoxGeometry(width - wallThickness, 0.2, depth - wallThickness),
    new THREE.MeshStandardMaterial({ color: 0x4b3e32, roughness: 0.8, metalness: 0.03 })
  );
  floor.position.set(0, 0.1, 0);
  store.add(floor);

  const signText = type.names[Math.floor(Math.random() * type.names.length)];
  const signTexture = createStoreSignTexture(signText, type.frameColor);
  const storeSign = new THREE.Mesh(
    new THREE.BoxGeometry(width * 0.8, 0.6, 0.15),
    new THREE.MeshStandardMaterial({ map: signTexture, emissive: 0xffd38e, emissiveIntensity: 0.12, roughness: 0.35 })
  );
  storeSign.position.set(0, height - 0.55, halfD + 0.1);
  store.add(storeSign);

  const windowLeft = new THREE.Mesh(new THREE.BoxGeometry(frontSegWidth * 0.7, 1.8, 0.18), storeWindowMaterial);
  windowLeft.position.set(-(doorWidth / 2 + frontSegWidth / 2), 1.4, halfD + 0.1);
  store.add(windowLeft);
  const windowRight = windowLeft.clone();
  windowRight.position.x = doorWidth / 2 + frontSegWidth / 2;
  store.add(windowRight);

  // Door-frame columns flanking the gap, echoing the church's "big double doors" look.
  const doorColumnLeft = new THREE.Mesh(new THREE.BoxGeometry(0.3, height * 0.6, 0.3), storeRoofMaterial);
  doorColumnLeft.position.set(-doorWidth / 2 - 0.15, height * 0.3, halfD + 0.1);
  store.add(doorColumnLeft);
  const doorColumnRight = doorColumnLeft.clone();
  doorColumnRight.position.x = doorWidth / 2 + 0.15;
  store.add(doorColumnRight);

  store.position.set(x, 0, z);
  store.castShadow = true;
  storeGroup.add(store);

  registerWallCollider(x - halfW - wallThickness / 2, x - halfW + wallThickness / 2, z - halfD, z + halfD);
  registerWallCollider(x + halfW - wallThickness / 2, x + halfW + wallThickness / 2, z - halfD, z + halfD);
  registerWallCollider(x - halfW, x + halfW, z - halfD - wallThickness / 2, z - halfD + wallThickness / 2);
  registerWallCollider(x - halfW, x - doorWidth / 2, z + halfD - wallThickness / 2, z + halfD + wallThickness / 2);
  registerWallCollider(x + doorWidth / 2, x + halfW, z + halfD - wallThickness / 2, z + halfD + wallThickness / 2);

  stores.push({
    x, z, halfW, halfD, wallThickness,
    type: typeKey, tabs: type.tabs, label: `${type.label} — ${signText}`,
  });
}

// Stores are Metro City-only — random point in bounds, rejecting roads and
// overlap with `cityGroup`'s buildings or other stores.
function spawnStores(count) {
  for (let i = 0; i < count; i++) {
    let placed = false;
    let attempts = 0;
    // Bigger footprints + the dense road grid mean a much larger attempt
    // budget is needed to reliably place every requested store (40 was
    // tuned for the old, smaller single-box stores and left most unplaced).
    while (!placed && attempts < 400) {
      attempts += 1;
      const w = 9 + Math.random() * 3;
      const d = 8 + Math.random() * 2;
      const x = Math.round((Math.random() - 0.5) * MAP_RADIUS * 1.6);
      const z = Math.round((Math.random() - 0.5) * MAP_RADIUS * 1.6);
      if (isOnRoad(x, z)) continue;
      const clearance = 0.6;
      const halfW = w / 2 + clearance;
      const halfD = d / 2 + clearance;
      let overlap = false;
      cityGroup.children.forEach((b) => {
        if (overlap) return;
        if (!b.geometry || !b.position) return;
        const bw = (b.geometry.parameters && b.geometry.parameters.width) ? b.geometry.parameters.width : 1;
        const bd = (b.geometry.parameters && b.geometry.parameters.depth) ? b.geometry.parameters.depth : 1;
        if (Math.abs(x - b.position.x) < halfW + bw / 2 && Math.abs(z - b.position.z) < halfD + bd / 2) {
          overlap = true;
        }
      });
      if (overlap) continue;
      stores.forEach((s) => {
        if (overlap) return;
        if (Math.abs(x - s.x) < halfW + s.halfW + clearance && Math.abs(z - s.z) < halfD + s.halfD + clearance) {
          overlap = true;
        }
      });
      if (overlap) continue;
      createStore(x, z, w, d, STORE_TYPE_KEYS[i % STORE_TYPE_KEYS.length]);
      placed = true;
    }
  }
}

const carMaterial = new THREE.MeshStandardMaterial({ color: 0xff4c4c, roughness: 0.35, metalness: 0.15 });
const wheelMaterial = new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.7, metalness: 0.25 });
const carWindowMaterial = new THREE.MeshStandardMaterial({ color: 0x6fb8df, transparent: true, opacity: 0.75, roughness: 0.2 });
const cars = [];

function createCar(x, z, axis, direction) {
  const car = new THREE.Group();
  const body = new THREE.Mesh(
    new THREE.BoxGeometry(1.8, 0.7, 1.2),
    carMaterial
  );
  body.position.set(0, 0.35, 0);
  car.add(body);

  const roof = new THREE.Mesh(
    new THREE.BoxGeometry(1.2, 0.3, 0.9),
    new THREE.MeshStandardMaterial({ color: 0xe4564b, roughness: 0.35, metalness: 0.15 })
  );
  roof.position.set(0, 0.7, 0);
  car.add(roof);

  const glass = new THREE.Mesh(
    new THREE.BoxGeometry(1.5, 0.5, 1.05),
    carWindowMaterial
  );
  glass.position.set(0, 0.65, 0);
  car.add(glass);

  const sideWindowLeft = new THREE.Mesh(
    new THREE.BoxGeometry(0.08, 0.4, 0.8),
    carWindowMaterial
  );
  sideWindowLeft.position.set(-0.95, 0.55, 0);
  car.add(sideWindowLeft);

  const sideWindowRight = sideWindowLeft.clone();
  sideWindowRight.position.set(0.95, 0.55, 0);
  car.add(sideWindowRight);

  const frontWindow = new THREE.Mesh(
    new THREE.BoxGeometry(1.4, 0.45, 0.05),
    carWindowMaterial
  );
  frontWindow.position.set(0, 0.55, -0.5);
  car.add(frontWindow);

  const rearWindow = new THREE.Mesh(
    new THREE.BoxGeometry(1.4, 0.35, 0.05),
    carWindowMaterial
  );
  rearWindow.position.set(0, 0.55, 0.5);
  car.add(rearWindow);

  const wheelPositions = [
    [-0.65, 0.14, -0.45],
    [0.65, 0.14, -0.45],
    [-0.65, 0.14, 0.45],
    [0.65, 0.14, 0.45],
  ];
  wheelPositions.forEach(([wx, wy, wz]) => {
    const wheel = new THREE.Mesh(
      new THREE.CylinderGeometry(0.18, 0.18, 0.22, 12),
      wheelMaterial
    );
    wheel.rotation.z = Math.PI / 2;
    wheel.position.set(wx, wy, wz);
    car.add(wheel);
  });

  car.position.set(x, 0.15, z);
  car.axis = axis;
  car.direction = direction;
  car.speed = 8 + Math.random() * 5;
  car.rotation.y = axis === 'z' ? (direction > 0 ? 0 : Math.PI) : (direction > 0 ? Math.PI / 2 : -Math.PI / 2);
  scene.add(car);
  cars.push(car);
}

function spawnCars(count) {
  for (let i = 0; i < count; i++) {
    const axis = Math.random() > 0.5 ? 'z' : 'x';
    const line = ROAD_LINES[Math.floor(Math.random() * ROAD_LINES.length)];
    const direction = Math.random() > 0.5 ? 1 : -1;
    if (axis === 'z') {
      createCar((Math.random() - 0.5) * MAP_RADIUS * 1.5, line, axis, direction);
    } else {
      createCar(line, (Math.random() - 0.5) * MAP_RADIUS * 1.5, axis, direction);
    }
  }
}

// Assembles today's original always-on world — roads, 220 buildings, the
// church + its congregation, themed stores, traffic — out of the pieces
// above. This is Map 5 ("Metro City") once the map picker exists; for now
// it's the only map, loaded once at startup via loadMap('metro') below.
function buildMetroCityMap() {
  registerMapGroup(buildMetroRoads());
  buildMetroBuildings();
  registerMapGroup(cityGroup);
  registerMapGroup(createChurch(0, 0));
  storeGroup = new THREE.Group();
  registerMapGroup(storeGroup);
  spawnStores(15);
  spawnCars(18);
  isInsideMapInterior = isPointInsideChurch;
}

const MAPS = {
  metro: { label: 'New York City', mapRadius: 160, roadBands: ROAD_BANDS, build: buildMetroCityMap },
  vatican: { label: 'The Vatican', mapRadius: 110, roadBands: [], build: buildVaticanMap },
  westworld: { label: 'Wild West', mapRadius: 150, roadBands: [0], build: buildWildWestMap },
  mansion: { label: 'Marble Maze', mapRadius: 70, roadBands: [], build: buildMansionMap },
  desert: { label: 'Desert', mapRadius: 150, roadBands: [], build: buildDesertMap },
  arctic: { label: 'Arctic Base', mapRadius: 140, roadBands: [], build: buildArcticMap },
  spacestation: { label: 'Space Station', mapRadius: 140, roadBands: [], build: buildSpaceStationMap },
  jungle: { label: 'Jungle Temple', mapRadius: 150, roadBands: [], build: buildJungleMap },
  subway: { label: 'Subway Tunnels', mapRadius: 120, roadBands: [], build: buildSubwayMap },
  volcano: { label: 'Volcano Island', mapRadius: 140, roadBands: [], build: buildVolcanoMap },
};

// Tears down whichever map is currently loaded (every group registerMapGroup()
// tracked, all traffic, every collider/store/congregant/interactable) and
// builds the requested one fresh. Safe to call repeatedly — e.g. once at
// startup, and again from the (future) map picker on every restart.
// Tracks which map is currently loaded — used to gate map-specific events
// (e.g. the divine healing event) that should only ever run on one map.
let currentMapId = null;
// Declared here (not next to startDivineHealingEvent()/updateDivineEvent()
// further below) because loadMap() references it and loadMap('metro') is
// called at module load — referencing a later `let` from that first call
// would throw a TDZ ReferenceError.
let divineEvent = null;

function loadMap(mapId) {
  currentMapId = mapId;
  if (divineEvent) {
    scene.remove(divineEvent.mesh);
    divineEvent = null;
  }
  activeMapGroups.forEach((obj) => scene.remove(obj));
  activeMapGroups.length = 0;
  cars.forEach((car) => scene.remove(car));
  cars.length = 0;
  wallColliders.length = 0;
  stores.length = 0;
  congregants.length = 0;
  vaticanCongregants.length = 0;
  vaticanPopeGroup = null;
  fleeingNpcs.length = 0;
  interactableObjects.length = 0;
  obispoTears = [];
  obispoMouth = null;
  isInsideMapInterior = () => false;
  scene.background = DEFAULT_SKY_COLOR.clone();

  const def = MAPS[mapId];
  MAP_RADIUS = def.mapRadius;
  activeRoadBands = def.roadBands;
  def.build();
}

loadMap('metro');

// ---------------------------------------------------------------------------
// Map: The Vatican — one huge cathedral + an open piazza, instead of a city of
// many small buildings. Density comes from the colonnade ring, the full
// congregation, and nave pillars/confessionals for cover rather than repeated
// city blocks. Door faces +Z; the piazza/colonnade/shops sit beyond it.
// ---------------------------------------------------------------------------
const VATICAN_NAVE_HALF_W = 14;
const VATICAN_NAVE_HALF_D = 34;
const VATICAN_DOOR_WIDTH = 5;
const VATICAN_PIAZZA_CENTER_Z = VATICAN_NAVE_HALF_D + 46;
const VATICAN_PIAZZA_RADIUS = 38;

// Plain stone color, deliberately not createFacadeTexture() — that generator
// draws a skyscraper window-grid pattern, which read as a glass office tower
// instead of cathedral stone when reused here.
const vaticanWallMaterial = new THREE.MeshStandardMaterial({ color: 0xe3d6bc, roughness: 0.55, metalness: 0.08, envMapIntensity: 1.1 });
const vaticanDomeMaterial = new THREE.MeshStandardMaterial({ color: 0x5a6b7a, roughness: 0.25, metalness: 0.4, envMapIntensity: 1.2 });
const vaticanGoldMaterial = new THREE.MeshStandardMaterial({ color: 0xd4af37, roughness: 0.25, metalness: 0.6, emissive: 0x6b5419, emissiveIntensity: 0.2 });
const vaticanFloorMaterial = new THREE.MeshStandardMaterial({ color: 0xcabf9e, roughness: 0.35, metalness: 0.1 });
const vaticanGroundMaterial = new THREE.MeshStandardMaterial({ color: 0xc4b690, roughness: 0.85, metalness: 0.02 });
const vaticanPillarMaterial = new THREE.MeshStandardMaterial({ color: 0xd9cdb0, roughness: 0.3, metalness: 0.15 });
const vaticanConfessionalMaterial = new THREE.MeshStandardMaterial({ color: 0x4a3322, roughness: 0.6, metalness: 0.08 });

const VATICAN_GLASS_COLORS = [
  ['#7a1f2b', '#c44d4d'],
  ['#1f3a7a', '#4d7ac4'],
  ['#1f6b3a', '#4dc47a'],
  ['#7a5a1f', '#c4a04d'],
];

function createStainedGlassTexture(colorA, colorB) {
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 256;
  const ctx = canvas.getContext('2d');
  const grad = ctx.createLinearGradient(0, 0, 0, 256);
  grad.addColorStop(0, colorA);
  grad.addColorStop(1, colorB);
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 128, 256);
  ctx.strokeStyle = 'rgba(20,15,5,0.55)';
  ctx.lineWidth = 4;
  for (let i = 0; i < 5; i++) {
    ctx.beginPath();
    ctx.moveTo((i + 1) * (128 / 6), 0);
    ctx.lineTo((i + 1) * (128 / 6), 256);
    ctx.stroke();
  }
  ctx.beginPath();
  ctx.arc(64, 56, 28, 0, Math.PI * 2);
  ctx.stroke();
  return new THREE.CanvasTexture(canvas);
}

function buildVaticanCathedral() {
  const cathedral = new THREE.Group();
  const height = 16;
  const wallThickness = 1.0;
  const halfW = VATICAN_NAVE_HALF_W;
  const halfD = VATICAN_NAVE_HALF_D;
  const doorWidth = VATICAN_DOOR_WIDTH;

  const leftWall = new THREE.Mesh(new THREE.BoxGeometry(wallThickness, height, halfD * 2), vaticanWallMaterial);
  leftWall.position.set(-halfW, height / 2, 0);
  cathedral.add(leftWall);
  const rightWall = leftWall.clone();
  rightWall.position.x = halfW;
  cathedral.add(rightWall);

  const backWall = new THREE.Mesh(new THREE.BoxGeometry(halfW * 2, height, wallThickness), vaticanWallMaterial);
  backWall.position.set(0, height / 2, -halfD);
  cathedral.add(backWall);

  const frontSegWidth = (halfW * 2 - doorWidth) / 2;
  const frontLeft = new THREE.Mesh(new THREE.BoxGeometry(frontSegWidth, height, wallThickness), vaticanWallMaterial);
  frontLeft.position.set(-(doorWidth / 2 + frontSegWidth / 2), height / 2, halfD);
  cathedral.add(frontLeft);
  const frontRight = frontLeft.clone();
  frontRight.position.x = doorWidth / 2 + frontSegWidth / 2;
  cathedral.add(frontRight);

  registerWallCollider(-halfW - wallThickness / 2, -halfW + wallThickness / 2, -halfD, halfD);
  registerWallCollider(halfW - wallThickness / 2, halfW + wallThickness / 2, -halfD, halfD);
  registerWallCollider(-halfW, halfW, -halfD - wallThickness / 2, -halfD + wallThickness / 2);
  registerWallCollider(-halfW, -doorWidth / 2, halfD - wallThickness / 2, halfD + wallThickness / 2);
  registerWallCollider(doorWidth / 2, halfW, halfD - wallThickness / 2, halfD + wallThickness / 2);

  // Flat main roof over the whole nave — without this the interior was open
  // to the sky between the towers and the dome. The dome/towers rise above it.
  const mainRoof = new THREE.Mesh(new THREE.BoxGeometry(halfW * 2 + 1, 0.6, halfD * 2 + 1), vaticanWallMaterial);
  mainRoof.position.set(0, height + 0.3, 0);
  cathedral.add(mainRoof);

  // Dome over the altar end
  const domeBase = new THREE.Mesh(new THREE.CylinderGeometry(9, 9, 6, 24), vaticanWallMaterial);
  domeBase.position.set(0, height + 3, -18);
  cathedral.add(domeBase);
  const dome = new THREE.Mesh(new THREE.SphereGeometry(9, 24, 16, 0, Math.PI * 2, 0, Math.PI / 2), vaticanDomeMaterial);
  dome.position.set(0, height + 6, -18);
  cathedral.add(dome);
  const lantern = new THREE.Mesh(new THREE.CylinderGeometry(1, 1, 3, 12), vaticanGoldMaterial);
  lantern.position.set(0, height + 15, -18);
  cathedral.add(lantern);
  const finial = new THREE.Mesh(new THREE.SphereGeometry(0.7, 12, 12), vaticanGoldMaterial);
  finial.position.set(0, height + 17, -18);
  cathedral.add(finial);

  // Twin facade towers flanking the front doors
  [-1, 1].forEach((side) => {
    const towerHeight = height + 10;
    const tower = new THREE.Mesh(new THREE.BoxGeometry(4, towerHeight, 4), vaticanWallMaterial);
    tower.position.set(side * (halfW - 2), towerHeight / 2, halfD - 2);
    cathedral.add(tower);
    const cap = new THREE.Mesh(new THREE.ConeGeometry(3, 4, 8), vaticanDomeMaterial);
    cap.position.set(side * (halfW - 2), towerHeight + 2, halfD - 2);
    cathedral.add(cap);
    const cross = new THREE.Mesh(new THREE.BoxGeometry(0.3, 2.2, 0.3), vaticanGoldMaterial);
    cross.position.set(side * (halfW - 2), towerHeight + 5, halfD - 2);
    cathedral.add(cross);
    const crossArm = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.3, 0.3), vaticanGoldMaterial);
    crossArm.position.set(side * (halfW - 2), towerHeight + 5.6, halfD - 2);
    cathedral.add(crossArm);
  });

  const door = new THREE.Mesh(new THREE.BoxGeometry(doorWidth, 7, 0.4), new THREE.MeshStandardMaterial({ color: 0x3b2f20, roughness: 0.5, metalness: 0.2 }));
  door.position.set(0, 3.5, halfD + 0.3);
  cathedral.add(door);

  // Seals the rest of the door's gap in the front wall above the door itself —
  // without this, the facade was open straight through to the sky up there.
  const transom = new THREE.Mesh(new THREE.BoxGeometry(doorWidth, height - 7, 0.4), vaticanWallMaterial);
  transom.position.set(0, 7 + (height - 7) / 2, halfD);
  cathedral.add(transom);

  const signTexture = createChurchSignTexture('THE VATICAN');
  const sign = new THREE.Mesh(new THREE.BoxGeometry(11, 2.4, 0.18), new THREE.MeshStandardMaterial({ map: signTexture, emissive: 0x7c6b42, emissiveIntensity: 0.1, roughness: 0.3, metalness: 0.25 }));
  sign.position.set(0, 11, halfD + 0.3);
  cathedral.add(sign);

  const floor = new THREE.Mesh(new THREE.BoxGeometry(halfW * 2 - wallThickness, 0.2, halfD * 2 - wallThickness), vaticanFloorMaterial);
  floor.position.set(0, 0.1, 0);
  cathedral.add(floor);

  // Stained-glass window panels along both side walls
  for (let i = 0; i < 7; i++) {
    const [colorA, colorB] = VATICAN_GLASS_COLORS[i % VATICAN_GLASS_COLORS.length];
    const glassTexture = createStainedGlassTexture(colorA, colorB);
    const glassMat = new THREE.MeshStandardMaterial({ map: glassTexture, emissive: 0xffffff, emissiveMap: glassTexture, emissiveIntensity: 0.55, roughness: 0.2, metalness: 0.05 });
    const zPos = -halfD + 5 + i * 9;
    const winLeft = new THREE.Mesh(new THREE.BoxGeometry(0.2, 5, 2.2), glassMat);
    winLeft.position.set(-halfW - 0.05, height / 2 + 1, zPos);
    cathedral.add(winLeft);
    const winRight = winLeft.clone();
    winRight.position.x = halfW + 0.05;
    cathedral.add(winRight);
  }

  // Nave pillars — cover running down both sides of the aisle
  for (let i = 0; i < 6; i++) {
    const zPos = -halfD + 9 + i * 9;
    [-11, 11].forEach((xPos) => {
      const pillar = new THREE.Mesh(new THREE.CylinderGeometry(0.9, 0.9, height - 1, 12), vaticanPillarMaterial);
      pillar.position.set(xPos, (height - 1) / 2, zPos);
      cathedral.add(pillar);
      registerWallCollider(xPos - 0.9, xPos + 0.9, zPos - 0.9, zPos + 0.9);
    });
  }

  // Confessional booths — extra hiding cover near the rear corners
  [-1, 1].forEach((side) => {
    for (let i = 0; i < 3; i++) {
      const w = 2.4, d = 2.0, h = 3.4;
      const x = side * (halfW - 1.6);
      const z = -halfD + 6 + i * 8;
      const booth = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), vaticanConfessionalMaterial);
      booth.position.set(x, h / 2, z);
      cathedral.add(booth);
      registerWallCollider(x - w / 2, x + w / 2, z - d / 2, z + d / 2);
    }
  });

  cathedral.traverse((child) => { child.castShadow = true; });
  return cathedral;
}

// A seated congregant, parallel to createChurch()'s local createCongregant()
// but kept separate so Metro's congregation/crying mechanic is untouched.
function createVaticanCongregant(clothColor) {
  const person = new THREE.Group();
  const cloth = new THREE.MeshStandardMaterial({ color: clothColor, roughness: 0.55, metalness: 0.05 });

  const torso = new THREE.Mesh(new THREE.CapsuleGeometry(0.22, 0.5, 4, 8), cloth);
  torso.scale.set(1.3, 1, 0.85);
  torso.position.set(0, 0.47, 0);
  person.add(torso);

  const head = new THREE.Mesh(new THREE.SphereGeometry(0.13, 10, 8), new THREE.MeshStandardMaterial({ color: 0xe3b89c, roughness: 0.45, metalness: 0.02 }));
  head.position.set(0, 1.04, 0);
  person.add(head);

  const eyeLeft = new THREE.Mesh(eyeGeometry, eyeMaterial);
  eyeLeft.scale.setScalar(0.55);
  eyeLeft.position.set(-0.05, 0.01, 0.105);
  head.add(eyeLeft);
  const eyeRight = eyeLeft.clone();
  eyeRight.position.x = 0.05;
  head.add(eyeRight);

  const mouth = new THREE.Mesh(mouthGeometry, mouthMaterial);
  mouth.position.set(0, -0.045, 0.105);
  head.add(mouth);

  return person;
}

function buildVaticanCongregation() {
  const congregationGroup = new THREE.Group();
  const congregantClothColors = [0x6b4a3a, 0x3c556f, 0x556b3c, 0x7a3c4a, 0x4a4a6b, 0x6b6b3c];
  const pewMaterial = new THREE.MeshStandardMaterial({ color: 0x60472d, roughness: 0.7, metalness: 0.05 });
  const pewSeatHeight = 1.24;
  const congregantOffsets = [-7.5, -4.5, -1.5, 1.5, 4.5, 7.5];
  const rows = 8;

  for (let i = 0; i < rows; i++) {
    const rowZ = -22 + i * 3.4;
    const pew = new THREE.Mesh(new THREE.BoxGeometry(17.5, 0.28, 0.5), pewMaterial);
    pew.position.set(0, 1.1, rowZ);
    congregationGroup.add(pew);
    const pewBack = new THREE.Mesh(new THREE.BoxGeometry(17.5, 0.55, 0.18), pewMaterial);
    pewBack.position.set(0, 1.45, rowZ + 0.35);
    congregationGroup.add(pewBack);

    congregantOffsets.forEach((offsetX, j) => {
      const congregant = createVaticanCongregant(congregantClothColors[(i + j) % congregantClothColors.length]);
      congregant.position.set(offsetX, pewSeatHeight, rowZ);
      congregant.rotation.y = Math.PI; // face the altar (-Z)
      congregationGroup.add(congregant);
      vaticanCongregants.push({ group: congregant, phase: (i * 6 + j) * 0.28 });
    });
  }

  // Altar stage + the Pope, facing the congregation (+Z)
  const stageHeight = 0.3;
  const stage = new THREE.Mesh(new THREE.BoxGeometry(11, stageHeight, 5), new THREE.MeshStandardMaterial({ color: 0x7f6a54, roughness: 0.42, metalness: 0.06 }));
  stage.position.set(0, stageHeight / 2, -29);
  congregationGroup.add(stage);

  const popeSkin = new THREE.MeshStandardMaterial({ color: 0xe3b89c, roughness: 0.45, metalness: 0.02 });
  const popeRobe = new THREE.MeshStandardMaterial({ color: 0xf5f1e6, roughness: 0.4, metalness: 0.05 });
  const popeCap = new THREE.MeshStandardMaterial({ color: 0xf5f1e6, roughness: 0.4, metalness: 0.05 });

  const pope = new THREE.Group();
  const popeHead = new THREE.Mesh(new THREE.SphereGeometry(0.22, 12, 10), popeSkin);
  popeHead.position.set(0, 1.4, 0);
  pope.add(popeHead);
  const popeEyeLeft = new THREE.Mesh(eyeGeometry, eyeMaterial);
  popeEyeLeft.scale.setScalar(0.7);
  popeEyeLeft.position.set(-0.08, 0.02, 0.19);
  popeHead.add(popeEyeLeft);
  const popeEyeRight = popeEyeLeft.clone();
  popeEyeRight.position.x = 0.08;
  popeHead.add(popeEyeRight);
  const popeMouth = new THREE.Mesh(mouthGeometry, mouthMaterial);
  popeMouth.scale.setScalar(1.7);
  popeMouth.position.set(0, -0.07, 0.19);
  popeHead.add(popeMouth);
  const popeSkullcap = new THREE.Mesh(new THREE.SphereGeometry(0.23, 12, 10, 0, Math.PI * 2, 0, Math.PI / 2.2), popeCap);
  popeSkullcap.position.set(0, 1.43, 0);
  pope.add(popeSkullcap);
  const popeBody = new THREE.Mesh(new THREE.ConeGeometry(0.45, 1.3, 12), popeRobe);
  popeBody.position.set(0, 0.55, 0);
  pope.add(popeBody);
  const popeArmLeft = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 0.8, 8), popeRobe);
  popeArmLeft.position.set(-0.4, 0.95, 0);
  popeArmLeft.rotation.z = 0.3;
  pope.add(popeArmLeft);
  const popeArmRight = popeArmLeft.clone();
  popeArmRight.position.set(0.4, 0.95, 0);
  popeArmRight.rotation.z = -0.3;
  pope.add(popeArmRight);

  pope.position.set(0, stageHeight, -27.5);
  pope.scale.setScalar((6.5 * 0.3048) / 1.62);
  pope.name = 'The Pope';
  congregationGroup.add(pope);
  vaticanPopeGroup = pope;
  interactableObjects.push(pope);

  return congregationGroup;
}

function buildVaticanPiazza() {
  const piazza = new THREE.Group();
  const centerZ = VATICAN_PIAZZA_CENTER_Z;
  const radius = VATICAN_PIAZZA_RADIUS;

  const plazaFloor = new THREE.Mesh(new THREE.CylinderGeometry(radius + 4, radius + 4, 0.15, 48), vaticanFloorMaterial);
  plazaFloor.position.set(0, 0.075, centerZ);
  piazza.add(plazaFloor);

  const colonnadeCount = 28;
  for (let i = 0; i < colonnadeCount; i++) {
    const angle = (i / colonnadeCount) * Math.PI * 2;
    // Leave the arc nearest the cathedral door open so the piazza connects to it.
    if (Math.abs(((angle + Math.PI) % (Math.PI * 2)) - Math.PI) < 0.45) continue;
    const px = Math.sin(angle) * radius;
    const pz = centerZ + Math.cos(angle) * radius;
    const pillar = new THREE.Mesh(new THREE.CylinderGeometry(0.7, 0.7, 7, 10), vaticanPillarMaterial);
    pillar.position.set(px, 3.5, pz);
    piazza.add(pillar);
    registerWallCollider(px - 0.7, px + 0.7, pz - 0.7, pz + 0.7);
  }

  const obelisk = new THREE.Mesh(new THREE.CylinderGeometry(0.6, 1.0, 12, 4), vaticanPillarMaterial);
  obelisk.position.set(0, 6, centerZ);
  piazza.add(obelisk);
  const obeliskTip = new THREE.Mesh(new THREE.ConeGeometry(0.6, 1.6, 4), vaticanPillarMaterial);
  obeliskTip.position.set(0, 12.8, centerZ);
  piazza.add(obeliskTip);
  registerWallCollider(-1, 1, centerZ - 1, centerZ + 1);

  piazza.traverse((child) => { child.castShadow = true; });
  return piazza;
}

// Gentle forward-bow prayer loop for the Vatican congregation — each person
// rocks slowly toward the altar on their own staggered phase so the pews
// look like a wave of prayer rather than a synchronized puppet show.
// The pope on stage sways slightly on a different, slower period.
function animateVaticanPrayer(dt) {
  if (!vaticanCongregants.length) return;
  vaticanCongregants.forEach((c) => {
    c.group.rotation.x = Math.sin(timeAccum * 0.7 + c.phase) * 0.1 - 0.06;
  });
  if (vaticanPopeGroup) {
    vaticanPopeGroup.rotation.x = Math.sin(timeAccum * 0.45) * 0.07;
  }
}

function isInsideVaticanCathedral(x, z) {
  return x >= -VATICAN_NAVE_HALF_W && x <= VATICAN_NAVE_HALF_W && z >= -VATICAN_NAVE_HALF_D && z <= VATICAN_NAVE_HALF_D;
}

function buildVaticanMap() {
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(400, 400), vaticanGroundMaterial);
  ground.rotation.x = -Math.PI / 2;
  ground.position.y = 0.02;
  registerMapGroup(ground);

  registerMapGroup(buildVaticanCathedral());
  registerMapGroup(buildVaticanCongregation());
  registerMapGroup(buildVaticanPiazza());

  isInsideMapInterior = isInsideVaticanCathedral;
}

// ---------------------------------------------------------------------------
// Map: Wild West — one long frontier main street (running east-west along X,
// so it lines up with the existing Z-band road convention: activeRoadBands
// holds a single z=0 entry). Density comes from a long row of false-front
// buildings on both sides instead of a city grid.
// ---------------------------------------------------------------------------
const WILDWEST_STREET_HALF_WIDTH = 7;
const WILDWEST_STREET_HALF_LEN = 130;

const westWoodMaterial = new THREE.MeshStandardMaterial({ color: 0x8a5a36, roughness: 0.75, metalness: 0.05 });
const westWoodDarkMaterial = new THREE.MeshStandardMaterial({ color: 0x5c3b22, roughness: 0.8, metalness: 0.03 });
const westRoofMaterial = new THREE.MeshStandardMaterial({ color: 0x3d2b1a, roughness: 0.7, metalness: 0.05 });
const westGroundMaterial = new THREE.MeshStandardMaterial({ color: 0xc2a26b, roughness: 0.95, metalness: 0.02 });
const westDirtStreetMaterial = new THREE.MeshStandardMaterial({ color: 0xa9875a, roughness: 0.95, metalness: 0.02 });
const westMesaMaterial = new THREE.MeshStandardMaterial({ color: 0xb5673a, roughness: 0.9, metalness: 0.02 });

// A purely decorative false-front building — solid collider, no interior.
// streetSide: which local-Z side the visible front wall sits on (the side
// facing the street), independent of which side of the street it's built on.
function createWestFacade(x, z, streetSide, width, height) {
  const depth = 5;
  const group = new THREE.Group();
  const front = new THREE.Mesh(new THREE.BoxGeometry(width, height, 0.6), westWoodMaterial);
  front.position.set(0, height / 2, streetSide * depth / 2);
  group.add(front);
  const parapet = new THREE.Mesh(new THREE.BoxGeometry(width + 0.6, 1, 0.5), westWoodDarkMaterial);
  parapet.position.set(0, height + 0.5, streetSide * depth / 2);
  group.add(parapet);
  const sideGeo = new THREE.BoxGeometry(0.4, height * 0.75, depth);
  const sideA = new THREE.Mesh(sideGeo, westWoodDarkMaterial);
  sideA.position.set(-width / 2, height * 0.375, 0);
  group.add(sideA);
  const sideB = sideA.clone();
  sideB.position.x = width / 2;
  group.add(sideB);
  const awning = new THREE.Mesh(new THREE.BoxGeometry(width + 1, 0.2, 1.4), westRoofMaterial);
  awning.position.set(0, height * 0.55, streetSide * (depth / 2 + 0.8));
  group.add(awning);

  group.position.set(x, 0, z);
  registerWallCollider(x - width / 2 - 0.2, x + width / 2 + 0.2, z - depth / 2 - 0.2, z + depth / 2 + 0.2);
  group.traverse((child) => { child.castShadow = true; });
  return group;
}

// One pass down the street, lining both sides with decorative false-fronts.
// Stores are Metro City-only now, so every slot here is a facade.
function buildWildWestStreet() {
  const group = new THREE.Group();
  const buildingZ = WILDWEST_STREET_HALF_WIDTH + 5;
  let x = -WILDWEST_STREET_HALF_LEN + 10;
  while (x < WILDWEST_STREET_HALF_LEN - 10) {
    const width = 9 + Math.random() * 3;
    [1, -1].forEach((s) => {
      const height = 5 + Math.random() * 3;
      group.add(createWestFacade(x, s * buildingZ, -s, width, height));
    });
    x += width + 3 + Math.random() * 3;
  }
  return group;
}

function scatterWestProps() {
  const group = new THREE.Group();
  for (let i = 0; i < 40; i++) {
    const x = (Math.random() - 0.5) * (WILDWEST_STREET_HALF_LEN * 2 - 20);
    const z = (Math.random() < 0.5 ? 1 : -1) * (2.5 + Math.random() * 3);
    const kind = Math.random();
    if (kind < 0.4) {
      const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.5, 0.9, 10), westWoodDarkMaterial);
      barrel.position.set(x, 0.45, z);
      group.add(barrel);
      registerWallCollider(x - 0.5, x + 0.5, z - 0.5, z + 0.5);
    } else if (kind < 0.7) {
      const crate = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.8, 0.8), westWoodMaterial);
      crate.position.set(x, 0.4, z);
      group.add(crate);
      registerWallCollider(x - 0.4, x + 0.4, z - 0.4, z + 0.4);
    } else {
      const post = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 1.1, 6), westWoodDarkMaterial);
      post.position.set(x, 0.55, z);
      group.add(post);
    }
  }
  return group;
}

// Distant, non-collidable mesa silhouettes ringing the street for atmosphere.
function buildWestMesas() {
  const group = new THREE.Group();
  for (let i = 0; i < 12; i++) {
    const angle = (i / 12) * Math.PI * 2 + Math.random() * 0.3;
    const r = 170 + Math.random() * 60;
    const mesa = new THREE.Mesh(new THREE.CylinderGeometry(8 + Math.random() * 10, 14 + Math.random() * 10, 18 + Math.random() * 20, 6), westMesaMaterial);
    mesa.position.set(Math.cos(angle) * r, 9, Math.sin(angle) * r);
    group.add(mesa);
  }
  return group;
}

function buildWildWestMap() {
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(450, 450), westGroundMaterial);
  ground.rotation.x = -Math.PI / 2;
  ground.position.y = 0.02;
  registerMapGroup(ground);

  const dirtStreet = new THREE.Mesh(new THREE.PlaneGeometry(WILDWEST_STREET_HALF_LEN * 2 + 20, WILDWEST_STREET_HALF_WIDTH * 2), westDirtStreetMaterial);
  dirtStreet.rotation.x = -Math.PI / 2;
  dirtStreet.position.y = 0.03;
  registerMapGroup(dirtStreet);

  registerMapGroup(buildWildWestStreet());
  registerMapGroup(scatterWestProps());
  registerMapGroup(buildWestMesas());

  isInsideMapInterior = () => false;
}

// ---------------------------------------------------------------------------
// Map: Marble Maze — a 3x3 grid of marble rooms (the wall-segment +
// door-gap primitive, applied per grid-line instead of per-building so shared
// walls between rooms are only ever built once), furniture for indoor cover,
// and a hedge-ringed lawn outside.
// ---------------------------------------------------------------------------
const MANSION_GRID = 3;
const MANSION_ROOM_SIZE = 14;
const MANSION_WALL_T = 0.6;
const MANSION_DOOR_W = 3;
const MANSION_TOTAL_HALF = MANSION_GRID * MANSION_ROOM_SIZE / 2;

function createMarbleTexture(baseColor, veinColor) {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 256;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = baseColor;
  ctx.fillRect(0, 0, 256, 256);
  ctx.strokeStyle = veinColor;
  for (let i = 0; i < 14; i++) {
    ctx.lineWidth = 0.5 + Math.random() * 1.5;
    ctx.beginPath();
    let x = Math.random() * 256;
    let y = 0;
    ctx.moveTo(x, y);
    for (let j = 0; j < 6; j++) {
      x += (Math.random() - 0.5) * 80;
      y += 256 / 6;
      ctx.lineTo(x, y);
    }
    ctx.stroke();
  }
  return new THREE.CanvasTexture(canvas);
}

const mansionWallMaterial = new THREE.MeshStandardMaterial({ map: createMarbleTexture('#f0ece2', '#c9bfa8'), roughness: 0.3, metalness: 0.12 });
const mansionFloorMaterial = new THREE.MeshStandardMaterial({ map: createMarbleTexture('#e3dccb', '#a89878'), roughness: 0.18, metalness: 0.06 });
const mansionWoodMaterial = new THREE.MeshStandardMaterial({ color: 0x6b4a2f, roughness: 0.6, metalness: 0.05 });
const mansionSofaMaterial = new THREE.MeshStandardMaterial({ color: 0x7a2b3c, roughness: 0.7, metalness: 0.03 });
const mansionHedgeMaterial = new THREE.MeshStandardMaterial({ color: 0x355a2e, roughness: 0.85, metalness: 0.02 });
const mansionLawnMaterial = new THREE.MeshStandardMaterial({ color: 0x4a7a3c, roughness: 0.9, metalness: 0.02 });

// Builds every wall exactly once per grid-line (not per-room, which would
// double up every shared interior wall) — internal lines always get a door
// gap; the south exterior line gets one gap in its middle room as the
// mansion's single entrance from the lawn.
function buildMansionRooms() {
  const group = new THREE.Group();
  const n = MANSION_GRID;
  const size = MANSION_ROOM_SIZE;
  const height = 5.5;

  function addWallLine(cx, cz, isHorizontal, hasGap) {
    if (!hasGap) {
      const w = isHorizontal ? size : MANSION_WALL_T;
      const d = isHorizontal ? MANSION_WALL_T : size;
      const wall = new THREE.Mesh(new THREE.BoxGeometry(w, height, d), mansionWallMaterial);
      wall.position.set(cx, height / 2, cz);
      group.add(wall);
      registerWallCollider(cx - w / 2, cx + w / 2, cz - d / 2, cz + d / 2);
      return;
    }
    const segLen = (size - MANSION_DOOR_W) / 2;
    [-1, 1].forEach((sign) => {
      const offset = sign * (MANSION_DOOR_W / 2 + segLen / 2);
      const w = isHorizontal ? segLen : MANSION_WALL_T;
      const d = isHorizontal ? MANSION_WALL_T : segLen;
      const x = isHorizontal ? cx + offset : cx;
      const z = isHorizontal ? cz : cz + offset;
      const wall = new THREE.Mesh(new THREE.BoxGeometry(w, height, d), mansionWallMaterial);
      wall.position.set(x, height / 2, z);
      group.add(wall);
      registerWallCollider(x - w / 2, x + w / 2, z - d / 2, z + d / 2);
    });
  }

  for (let r = 0; r <= n; r++) {
    const z = -MANSION_TOTAL_HALF + r * size;
    for (let c = 0; c < n; c++) {
      const cx = -MANSION_TOTAL_HALF + size / 2 + c * size;
      const isInternal = r > 0 && r < n;
      const isEntrance = r === n && c === 1;
      addWallLine(cx, z, true, isInternal || isEntrance);
    }
  }
  for (let cLine = 0; cLine <= n; cLine++) {
    const x = -MANSION_TOTAL_HALF + cLine * size;
    for (let r = 0; r < n; r++) {
      const cz = -MANSION_TOTAL_HALF + size / 2 + r * size;
      const isInternal = cLine > 0 && cLine < n;
      addWallLine(x, cz, false, isInternal);
    }
  }

  for (let r = 0; r < n; r++) {
    for (let c = 0; c < n; c++) {
      const cx = -MANSION_TOTAL_HALF + size / 2 + c * size;
      const cz = -MANSION_TOTAL_HALF + size / 2 + r * size;
      const floor = new THREE.Mesh(new THREE.BoxGeometry(size - MANSION_WALL_T, 0.2, size - MANSION_WALL_T), mansionFloorMaterial);
      floor.position.set(cx, 0.1, cz);
      group.add(floor);
    }
  }

  group.traverse((child) => { child.castShadow = true; });
  return group;
}

// One piece of furniture per room as extra hiding cover — table, sofa, or
// bookshelf, each with its own collider.
function furnishMansionRooms() {
  const group = new THREE.Group();
  const n = MANSION_GRID;
  const size = MANSION_ROOM_SIZE;
  for (let r = 0; r < n; r++) {
    for (let c = 0; c < n; c++) {
      if (r === n - 1 && c === 1) continue; // leave the entrance room clear
      const cx = -MANSION_TOTAL_HALF + size / 2 + c * size;
      const cz = -MANSION_TOTAL_HALF + size / 2 + r * size;
      const x = cx + (Math.random() - 0.5) * size * 0.5;
      const z = cz + (Math.random() - 0.5) * size * 0.5;
      const kind = Math.floor(Math.random() * 3);
      if (kind === 0) {
        const table = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.9, 1.2), mansionWoodMaterial);
        table.position.set(x, 0.45, z);
        group.add(table);
        registerWallCollider(x - 1.1, x + 1.1, z - 0.6, z + 0.6);
      } else if (kind === 1) {
        const sofa = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.8, 1), mansionSofaMaterial);
        sofa.position.set(x, 0.4, z);
        group.add(sofa);
        registerWallCollider(x - 1.2, x + 1.2, z - 0.5, z + 0.5);
      } else {
        const shelf = new THREE.Mesh(new THREE.BoxGeometry(1.8, 2.2, 0.5), mansionWoodMaterial);
        shelf.position.set(x, 1.1, z);
        group.add(shelf);
        registerWallCollider(x - 0.9, x + 0.9, z - 0.25, z + 0.25);
      }
    }
  }
  group.traverse((child) => { child.castShadow = true; });
  return group;
}

// Non-precise (axis-aligned, ignores rotation) hedge ring around the grounds
// — close enough for a cover silhouette without per-rotation AABB math.
function buildMansionHedges() {
  const group = new THREE.Group();
  const ringRadius = MANSION_TOTAL_HALF + 25;
  const count = 40;
  for (let i = 0; i < count; i++) {
    const angle = (i / count) * Math.PI * 2;
    const x = Math.cos(angle) * ringRadius;
    const z = Math.sin(angle) * ringRadius;
    const hedge = new THREE.Mesh(new THREE.BoxGeometry(4, 1.4, 1.4), mansionHedgeMaterial);
    hedge.position.set(x, 0.7, z);
    hedge.rotation.y = angle;
    group.add(hedge);
    registerWallCollider(x - 2, x + 2, z - 2, z + 2);
  }
  group.traverse((child) => { child.castShadow = true; });
  return group;
}

function buildMansionMap() {
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(400, 400), mansionLawnMaterial);
  ground.rotation.x = -Math.PI / 2;
  ground.position.y = 0.02;
  registerMapGroup(ground);

  registerMapGroup(buildMansionRooms());
  registerMapGroup(furnishMansionRooms());
  registerMapGroup(buildMansionHedges());

  // Unlike the church (a deliberately enemy-free event space with no real
  // colliders), every mansion room is meant to be fought through — so this
  // stays the no-op default; the real wall colliders above do all the work.
  isInsideMapInterior = () => false;
}

// ---------------------------------------------------------------------------
// Map: Desert — open dune terrain instead of a city grid. Density comes from
// a large field of dunes (mostly visual, the big ones collidable) plus many
// rock-formation clusters for real cover, with one oasis landmark and
// outpost-themed shops scattered across the open ground.
// ---------------------------------------------------------------------------
const DESERT_OASIS_X = 50;
const DESERT_OASIS_Z = -50;
const DESERT_SPAN = 130;

const desertSandMaterial = new THREE.MeshStandardMaterial({ color: 0xd9b878, roughness: 0.95, metalness: 0.02 });
const desertDuneMaterial = new THREE.MeshStandardMaterial({ color: 0xcfae6e, roughness: 0.95, metalness: 0.02 });
const desertRockMaterial = new THREE.MeshStandardMaterial({ color: 0x8a7860, roughness: 0.85, metalness: 0.05 });
const desertWaterMaterial = new THREE.MeshStandardMaterial({ color: 0x3a8aa0, roughness: 0.15, metalness: 0.1, transparent: true, opacity: 0.85 });
const desertPalmTrunkMaterial = new THREE.MeshStandardMaterial({ color: 0x6b4a2f, roughness: 0.7, metalness: 0.03 });
const desertPalmLeafMaterial = new THREE.MeshStandardMaterial({ color: 0x3f7a3f, roughness: 0.6, metalness: 0.02 });

// Mostly visual terrain bumps (flattened spheres) — only the larger ones get
// a collider, so dunes read as rolling sand rather than every one blocking
// movement.
function buildDesertDunes() {
  const group = new THREE.Group();
  for (let i = 0; i < 140; i++) {
    const x = (Math.random() - 0.5) * DESERT_SPAN * 2;
    const z = (Math.random() - 0.5) * DESERT_SPAN * 2;
    if (Math.hypot(x - DESERT_OASIS_X, z - DESERT_OASIS_Z) < 22) continue;
    const radius = 3 + Math.random() * 7;
    const dune = new THREE.Mesh(new THREE.SphereGeometry(radius, 10, 8), desertDuneMaterial);
    dune.scale.y = 0.22 + Math.random() * 0.18;
    dune.position.set(x, 0, z);
    group.add(dune);
    if (radius > 7.5) {
      registerWallCollider(x - radius * 0.6, x + radius * 0.6, z - radius * 0.6, z + radius * 0.6);
    }
  }
  group.traverse((child) => { child.castShadow = true; child.receiveShadow = true; });
  return group;
}

function buildDesertRockFormations() {
  const group = new THREE.Group();
  for (let i = 0; i < 26; i++) {
    const x = (Math.random() - 0.5) * DESERT_SPAN * 1.85;
    const z = (Math.random() - 0.5) * DESERT_SPAN * 1.85;
    if (Math.hypot(x - DESERT_OASIS_X, z - DESERT_OASIS_Z) < 25) continue;
    const cluster = new THREE.Group();
    const rockCount = 2 + Math.floor(Math.random() * 3);
    let maxR = 0;
    for (let j = 0; j < rockCount; j++) {
      const r = 1 + Math.random() * 1.8;
      maxR = Math.max(maxR, r);
      const rock = new THREE.Mesh(new THREE.DodecahedronGeometry(r, 0), desertRockMaterial);
      rock.position.set((Math.random() - 0.5) * 2.5, r * 0.6, (Math.random() - 0.5) * 2.5);
      rock.rotation.set(Math.random() * Math.PI, Math.random() * Math.PI, Math.random() * Math.PI);
      cluster.add(rock);
    }
    cluster.position.set(x, 0, z);
    group.add(cluster);
    registerWallCollider(x - maxR - 1.5, x + maxR + 1.5, z - maxR - 1.5, z + maxR + 1.5);
  }
  group.traverse((child) => { child.castShadow = true; });
  return group;
}

function createDesertPalmTree(x, z) {
  const tree = new THREE.Group();
  const trunkHeight = 4 + Math.random() * 1.5;
  const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.28, trunkHeight, 8), desertPalmTrunkMaterial);
  trunk.position.set(0, trunkHeight / 2, 0);
  trunk.rotation.z = (Math.random() - 0.5) * 0.2;
  tree.add(trunk);
  for (let i = 0; i < 6; i++) {
    const leaf = new THREE.Mesh(new THREE.ConeGeometry(0.35, 2.4, 5), desertPalmLeafMaterial);
    const angle = (i / 6) * Math.PI * 2;
    leaf.position.set(Math.cos(angle) * 1.0, trunkHeight - 0.3, Math.sin(angle) * 1.0);
    leaf.rotation.z = Math.PI / 2.3;
    leaf.rotation.y = angle;
    tree.add(leaf);
  }
  tree.position.set(x, 0, z);
  return tree;
}

function buildDesertOasis() {
  const group = new THREE.Group();
  const water = new THREE.Mesh(new THREE.CircleGeometry(14, 24), desertWaterMaterial);
  water.rotation.x = -Math.PI / 2;
  water.position.set(DESERT_OASIS_X, 0.05, DESERT_OASIS_Z);
  group.add(water);

  for (let i = 0; i < 9; i++) {
    const angle = (i / 9) * Math.PI * 2;
    const r = 16 + Math.random() * 3;
    group.add(createDesertPalmTree(DESERT_OASIS_X + Math.cos(angle) * r, DESERT_OASIS_Z + Math.sin(angle) * r));
  }
  group.traverse((child) => { child.castShadow = true; });
  return group;
}

function buildDesertMap() {
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(450, 450), desertSandMaterial);
  ground.rotation.x = -Math.PI / 2;
  ground.position.y = 0.02;
  registerMapGroup(ground);

  registerMapGroup(buildDesertDunes());
  registerMapGroup(buildDesertRockFormations());
  registerMapGroup(buildDesertOasis());

  isInsideMapInterior = () => false;
}

// ---------------------------------------------------------------------------
// Map: Arctic Base — a small 3-room connected research station (same
// wall-segment + door-gap primitive as the mansion, sealed with a real roof
// this time) surrounded by open snowfield: drifts, jagged ice formations,
// and a ring of igloos for cover, plus arctic-themed shops.
// ---------------------------------------------------------------------------
const arcticSnowMaterial = new THREE.MeshStandardMaterial({ color: 0xeaf2f7, roughness: 0.85, metalness: 0.05 });
const arcticSnowDriftMaterial = new THREE.MeshStandardMaterial({ color: 0xdde8f0, roughness: 0.85, metalness: 0.05 });
const arcticIceMaterial = new THREE.MeshStandardMaterial({ color: 0xa8d8e8, roughness: 0.15, metalness: 0.25, transparent: true, opacity: 0.85 });
const arcticMetalMaterial = new THREE.MeshStandardMaterial({ color: 0x5a6b78, roughness: 0.4, metalness: 0.5 });
const arcticMetalDarkMaterial = new THREE.MeshStandardMaterial({ color: 0x3c4750, roughness: 0.5, metalness: 0.4 });
const arcticIglooMaterial = new THREE.MeshStandardMaterial({ color: 0xf0f5f8, roughness: 0.7, metalness: 0.05 });

function buildArcticStation() {
  // Sized so the player's fixed third-person camera (8.5 units behind, 4.6
  // up — see animate()'s camPos calc) never clips through these walls/roof;
  // an earlier, smaller version of this station was too tight for it.
  const group = new THREE.Group();
  const height = 7;
  const wallT = 0.5;
  const doorW = 3.5;
  const roomW = 16;
  const halfW = roomW * 1.5;
  const halfD = 9;

  const north = new THREE.Mesh(new THREE.BoxGeometry(halfW * 2, height, wallT), arcticMetalMaterial);
  north.position.set(0, height / 2, -halfD);
  group.add(north);
  registerWallCollider(-halfW, halfW, -halfD - wallT / 2, -halfD + wallT / 2);

  const southSegLen = (halfW * 2 - doorW) / 2;
  [-1, 1].forEach((sign) => {
    const x = sign * (doorW / 2 + southSegLen / 2);
    const seg = new THREE.Mesh(new THREE.BoxGeometry(southSegLen, height, wallT), arcticMetalMaterial);
    seg.position.set(x, height / 2, halfD);
    group.add(seg);
    registerWallCollider(x - southSegLen / 2, x + southSegLen / 2, halfD - wallT / 2, halfD + wallT / 2);
  });

  [-halfW, halfW].forEach((x) => {
    const wall = new THREE.Mesh(new THREE.BoxGeometry(wallT, height, halfD * 2), arcticMetalMaterial);
    wall.position.set(x, height / 2, 0);
    group.add(wall);
    registerWallCollider(x - wallT / 2, x + wallT / 2, -halfD, halfD);
  });

  [-roomW / 2, roomW / 2].forEach((x) => {
    const segLen = (halfD * 2 - doorW) / 2;
    [-1, 1].forEach((sign) => {
      const z = sign * (doorW / 2 + segLen / 2);
      const seg = new THREE.Mesh(new THREE.BoxGeometry(wallT, height, segLen), arcticMetalMaterial);
      seg.position.set(x, height / 2, z);
      group.add(seg);
      registerWallCollider(x - wallT / 2, x + wallT / 2, z - segLen / 2, z + segLen / 2);
    });
  });

  [-roomW, 0, roomW].forEach((cx) => {
    const floor = new THREE.Mesh(new THREE.BoxGeometry(roomW - wallT, 0.2, halfD * 2 - wallT), arcticMetalDarkMaterial);
    floor.position.set(cx, 0.1, 0);
    group.add(floor);
    const desk = new THREE.Mesh(new THREE.BoxGeometry(2, 0.9, 1), arcticMetalDarkMaterial);
    desk.position.set(cx + (Math.random() - 0.5) * 8, 0.45, (Math.random() - 0.5) * 4);
    group.add(desk);
    registerWallCollider(desk.position.x - 1, desk.position.x + 1, desk.position.z - 0.5, desk.position.z + 0.5);
  });
  const roof = new THREE.Mesh(new THREE.BoxGeometry(halfW * 2 + 0.6, 0.4, halfD * 2 + 0.6), arcticMetalMaterial);
  roof.position.set(0, height + 0.2, 0);
  group.add(roof);

  group.traverse((child) => { child.castShadow = true; });
  return group;
}

function buildArcticSnowdrifts() {
  const group = new THREE.Group();
  for (let i = 0; i < 120; i++) {
    const x = (Math.random() - 0.5) * 260;
    const z = (Math.random() - 0.5) * 260;
    if (Math.abs(x) < 28 && Math.abs(z) < 13) continue;
    const radius = 2.5 + Math.random() * 6;
    const drift = new THREE.Mesh(new THREE.SphereGeometry(radius, 10, 8), arcticSnowDriftMaterial);
    drift.scale.y = 0.22 + Math.random() * 0.18;
    drift.position.set(x, 0, z);
    group.add(drift);
    if (radius > 6.5) registerWallCollider(x - radius * 0.6, x + radius * 0.6, z - radius * 0.6, z + radius * 0.6);
  }
  group.traverse((child) => { child.castShadow = true; child.receiveShadow = true; });
  return group;
}

function buildArcticIceFormations() {
  const group = new THREE.Group();
  for (let i = 0; i < 22; i++) {
    const x = (Math.random() - 0.5) * 240;
    const z = (Math.random() - 0.5) * 240;
    if (Math.abs(x) < 30 && Math.abs(z) < 15) continue;
    const cluster = new THREE.Group();
    const count = 2 + Math.floor(Math.random() * 3);
    let maxR = 0;
    for (let j = 0; j < count; j++) {
      const r = 1 + Math.random() * 1.6;
      maxR = Math.max(maxR, r);
      const spike = new THREE.Mesh(new THREE.ConeGeometry(r * 0.6, r * 2.2, 6), arcticIceMaterial);
      spike.position.set((Math.random() - 0.5) * 2, r * 1.1, (Math.random() - 0.5) * 2);
      spike.rotation.y = Math.random() * Math.PI;
      cluster.add(spike);
    }
    cluster.position.set(x, 0, z);
    group.add(cluster);
    registerWallCollider(x - maxR - 1, x + maxR + 1, z - maxR - 1, z + maxR + 1);
  }
  group.traverse((child) => { child.castShadow = true; });
  return group;
}

function createIgloo(x, z) {
  const igloo = new THREE.Group();
  const dome = new THREE.Mesh(new THREE.SphereGeometry(2.2, 14, 10, 0, Math.PI * 2, 0, Math.PI / 2), arcticIglooMaterial);
  igloo.add(dome);
  const doorway = new THREE.Mesh(new THREE.CylinderGeometry(0.7, 0.7, 1.2, 8), arcticIglooMaterial);
  doorway.rotation.z = Math.PI / 2;
  doorway.position.set(2.0, 0.6, 0);
  igloo.add(doorway);
  igloo.position.set(x, 0, z);
  registerWallCollider(x - 2.2, x + 2.2, z - 2.2, z + 2.2);
  return igloo;
}

function buildArcticIgloos() {
  const group = new THREE.Group();
  for (let i = 0; i < 8; i++) {
    const angle = (i / 8) * Math.PI * 2;
    const r = 60 + Math.random() * 40;
    group.add(createIgloo(Math.cos(angle) * r, Math.sin(angle) * r));
  }
  group.traverse((child) => { child.castShadow = true; });
  return group;
}


function buildArcticMap() {
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(450, 450), arcticSnowMaterial);
  ground.rotation.x = -Math.PI / 2;
  ground.position.y = 0.02;
  registerMapGroup(ground);

  registerMapGroup(buildArcticStation());
  registerMapGroup(buildArcticSnowdrifts());
  registerMapGroup(buildArcticIceFormations());
  registerMapGroup(buildArcticIgloos());

  isInsideMapInterior = () => false;
}

// ---------------------------------------------------------------------------
// Map: Space Station — same 3-module connected-room shape as the arctic
// station (sized the same way, for the same camera-clearance reason), but
// metal/glow-strip paneling, a black starfield background + dome, an
// asteroid/debris field standing in for dunes, and cargo containers for
// cover instead of rock clusters.
// ---------------------------------------------------------------------------
const spaceMetalMaterial = new THREE.MeshStandardMaterial({ color: 0x4a5560, roughness: 0.35, metalness: 0.7 });
const spaceMetalDarkMaterial = new THREE.MeshStandardMaterial({ color: 0x2a3038, roughness: 0.4, metalness: 0.6 });
const spaceGlowMaterial = new THREE.MeshStandardMaterial({ color: 0x3cc7ff, emissive: 0x3cc7ff, emissiveIntensity: 1.2, roughness: 0.3, metalness: 0.2 });
const spaceGroundMaterial = new THREE.MeshStandardMaterial({ color: 0x23262d, roughness: 0.6, metalness: 0.3 });
const spaceAsteroidMaterial = new THREE.MeshStandardMaterial({ color: 0x55524a, roughness: 0.9, metalness: 0.1 });
const spaceContainerMaterials = [
  new THREE.MeshStandardMaterial({ color: 0xb5532b, roughness: 0.5, metalness: 0.4 }),
  new THREE.MeshStandardMaterial({ color: 0x2b8a5a, roughness: 0.5, metalness: 0.4 }),
  new THREE.MeshStandardMaterial({ color: 0x4a5aa0, roughness: 0.5, metalness: 0.4 }),
];

function createStarfieldTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 512;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#03040a';
  ctx.fillRect(0, 0, 512, 512);
  for (let i = 0; i < 500; i++) {
    const x = Math.random() * 512;
    const y = Math.random() * 512;
    const r = Math.random() * 1.4;
    ctx.fillStyle = `rgba(255,255,255,${0.4 + Math.random() * 0.6})`;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }
  return new THREE.CanvasTexture(canvas);
}

function buildSpaceStarfield() {
  const texture = createStarfieldTexture();
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(4, 4);
  return new THREE.Mesh(new THREE.SphereGeometry(300, 16, 12), new THREE.MeshBasicMaterial({ map: texture, side: THREE.BackSide }));
}

function buildSpaceStation() {
  const group = new THREE.Group();
  const height = 7;
  const wallT = 0.5;
  const doorW = 3.5;
  const roomW = 16;
  const halfW = roomW * 1.5;
  const halfD = 9;

  const north = new THREE.Mesh(new THREE.BoxGeometry(halfW * 2, height, wallT), spaceMetalMaterial);
  north.position.set(0, height / 2, -halfD);
  group.add(north);
  registerWallCollider(-halfW, halfW, -halfD - wallT / 2, -halfD + wallT / 2);

  const southSegLen = (halfW * 2 - doorW) / 2;
  [-1, 1].forEach((sign) => {
    const x = sign * (doorW / 2 + southSegLen / 2);
    const seg = new THREE.Mesh(new THREE.BoxGeometry(southSegLen, height, wallT), spaceMetalMaterial);
    seg.position.set(x, height / 2, halfD);
    group.add(seg);
    registerWallCollider(x - southSegLen / 2, x + southSegLen / 2, halfD - wallT / 2, halfD + wallT / 2);
  });

  [-halfW, halfW].forEach((x) => {
    const wall = new THREE.Mesh(new THREE.BoxGeometry(wallT, height, halfD * 2), spaceMetalMaterial);
    wall.position.set(x, height / 2, 0);
    group.add(wall);
    registerWallCollider(x - wallT / 2, x + wallT / 2, -halfD, halfD);
  });

  [-roomW / 2, roomW / 2].forEach((x) => {
    const segLen = (halfD * 2 - doorW) / 2;
    [-1, 1].forEach((sign) => {
      const z = sign * (doorW / 2 + segLen / 2);
      const seg = new THREE.Mesh(new THREE.BoxGeometry(wallT, height, segLen), spaceMetalMaterial);
      seg.position.set(x, height / 2, z);
      group.add(seg);
      registerWallCollider(x - wallT / 2, x + wallT / 2, z - segLen / 2, z + segLen / 2);
    });
  });

  [-roomW, 0, roomW].forEach((cx) => {
    const floor = new THREE.Mesh(new THREE.BoxGeometry(roomW - wallT, 0.2, halfD * 2 - wallT), spaceMetalDarkMaterial);
    floor.position.set(cx, 0.1, 0);
    group.add(floor);
    const strip = new THREE.Mesh(new THREE.BoxGeometry(roomW - 2, 0.08, 0.15), spaceGlowMaterial);
    strip.position.set(cx, 0.25, -halfD + 0.3);
    group.add(strip);
    const console_ = new THREE.Mesh(new THREE.BoxGeometry(1.6, 1.1, 0.8), spaceMetalDarkMaterial);
    console_.position.set(cx + (Math.random() - 0.5) * 8, 0.55, (Math.random() - 0.5) * 4);
    group.add(console_);
    registerWallCollider(console_.position.x - 0.8, console_.position.x + 0.8, console_.position.z - 0.4, console_.position.z + 0.4);
    const screen = new THREE.Mesh(new THREE.BoxGeometry(1.3, 0.5, 0.05), spaceGlowMaterial);
    screen.position.set(console_.position.x, 1.0, console_.position.z + 0.4);
    group.add(screen);
  });
  const roof = new THREE.Mesh(new THREE.BoxGeometry(halfW * 2 + 0.6, 0.4, halfD * 2 + 0.6), spaceMetalMaterial);
  roof.position.set(0, height + 0.2, 0);
  group.add(roof);

  group.traverse((child) => { child.castShadow = true; });
  return group;
}

function buildSpaceDebrisField() {
  const group = new THREE.Group();
  for (let i = 0; i < 30; i++) {
    const x = (Math.random() - 0.5) * 260;
    const z = (Math.random() - 0.5) * 260;
    if (Math.abs(x) < 30 && Math.abs(z) < 15) continue;
    const cluster = new THREE.Group();
    const count = 2 + Math.floor(Math.random() * 3);
    let maxR = 0;
    for (let j = 0; j < count; j++) {
      const r = 1 + Math.random() * 1.8;
      maxR = Math.max(maxR, r);
      const rock = new THREE.Mesh(new THREE.DodecahedronGeometry(r, 0), spaceAsteroidMaterial);
      rock.position.set((Math.random() - 0.5) * 2.5, r * 0.6, (Math.random() - 0.5) * 2.5);
      rock.rotation.set(Math.random() * Math.PI, Math.random() * Math.PI, Math.random() * Math.PI);
      cluster.add(rock);
    }
    cluster.position.set(x, 0, z);
    group.add(cluster);
    registerWallCollider(x - maxR - 1, x + maxR + 1, z - maxR - 1, z + maxR + 1);
  }
  group.traverse((child) => { child.castShadow = true; });
  return group;
}

function buildSpaceContainers() {
  const group = new THREE.Group();
  for (let i = 0; i < 24; i++) {
    const x = (Math.random() - 0.5) * 240;
    const z = (Math.random() - 0.5) * 240;
    if (Math.abs(x) < 30 && Math.abs(z) < 15) continue;
    const w = 2 + Math.random() * 1.5;
    const d = 1.4 + Math.random();
    const h = 1.4 + Math.random();
    const mat = spaceContainerMaterials[Math.floor(Math.random() * spaceContainerMaterials.length)];
    const container = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
    container.position.set(x, h / 2, z);
    container.rotation.y = Math.random() * Math.PI;
    group.add(container);
    registerWallCollider(x - w / 2 - 0.3, x + w / 2 + 0.3, z - d / 2 - 0.3, z + d / 2 + 0.3);
  }
  group.traverse((child) => { child.castShadow = true; });
  return group;
}


const rocketBodyMaterial = new THREE.MeshStandardMaterial({ color: 0xd8dce0, roughness: 0.35, metalness: 0.5 });
const rocketStripeMaterial = new THREE.MeshStandardMaterial({ color: 0xc23b2b, roughness: 0.4, metalness: 0.3 });
const rocketNoseMaterial = new THREE.MeshStandardMaterial({ color: 0xb5b8bd, roughness: 0.3, metalness: 0.6 });
const rocketFinMaterial = new THREE.MeshStandardMaterial({ color: 0x3a3e44, roughness: 0.5, metalness: 0.4 });
const rocketPadMaterial = new THREE.MeshStandardMaterial({ color: 0x36383d, roughness: 0.7, metalness: 0.3 });

// A big landmark rocket parked just outside the station's east wall, clear
// of the south entrance door — purely a visual centerpiece with one solid
// collider around its base so it still blocks movement like a building.
function buildSpaceRocket() {
  const group = new THREE.Group();
  const rocketX = 38;
  const rocketZ = 0;
  const bodyRadius = 2.2;
  const bodyHeight = 16;

  const pad = new THREE.Mesh(new THREE.CylinderGeometry(6, 6.5, 0.6, 20), rocketPadMaterial);
  pad.position.set(rocketX, 0.3, rocketZ);
  group.add(pad);

  const body = new THREE.Mesh(new THREE.CylinderGeometry(bodyRadius, bodyRadius, bodyHeight, 16), rocketBodyMaterial);
  body.position.set(rocketX, 0.6 + bodyHeight / 2, rocketZ);
  group.add(body);

  const stripe = new THREE.Mesh(new THREE.CylinderGeometry(bodyRadius + 0.02, bodyRadius + 0.02, 1.4, 16), rocketStripeMaterial);
  stripe.position.set(rocketX, 0.6 + bodyHeight * 0.32, rocketZ);
  group.add(stripe);

  const nose = new THREE.Mesh(new THREE.ConeGeometry(bodyRadius, 5, 16), rocketNoseMaterial);
  nose.position.set(rocketX, 0.6 + bodyHeight + 2.5, rocketZ);
  group.add(nose);

  for (let i = 0; i < 3; i++) {
    const angle = (i / 3) * Math.PI * 2;
    const fin = new THREE.Mesh(new THREE.BoxGeometry(0.3, 3, 2.6), rocketFinMaterial);
    fin.position.set(rocketX + Math.cos(angle) * (bodyRadius + 0.6), 1.5, rocketZ + Math.sin(angle) * (bodyRadius + 0.6));
    fin.rotation.y = -angle;
    group.add(fin);
  }

  const engineGlow = new THREE.Mesh(new THREE.CylinderGeometry(bodyRadius * 0.5, bodyRadius * 0.7, 0.8, 16), spaceGlowMaterial);
  engineGlow.position.set(rocketX, 0.2, rocketZ);
  group.add(engineGlow);

  registerWallCollider(rocketX - bodyRadius - 0.5, rocketX + bodyRadius + 0.5, rocketZ - bodyRadius - 0.5, rocketZ + bodyRadius + 0.5);
  group.traverse((child) => { child.castShadow = true; });
  return group;
}

function buildSpaceStationMap() {
  scene.background = new THREE.Color(0x05060c);
  registerMapGroup(buildSpaceStarfield());

  const ground = new THREE.Mesh(new THREE.PlaneGeometry(450, 450), spaceGroundMaterial);
  ground.rotation.x = -Math.PI / 2;
  ground.position.y = 0.02;
  registerMapGroup(ground);

  registerMapGroup(buildSpaceStation());
  registerMapGroup(buildSpaceRocket());
  registerMapGroup(buildSpaceDebrisField());
  registerMapGroup(buildSpaceContainers());

  isInsideMapInterior = () => false;
}

// ---------------------------------------------------------------------------
// Map: Jungle Temple — a stepped ziggurat landmark (one solid collidable
// mass, set well back from spawn), scattered broken-wall ruins for cover,
// and dense tree/bush foliage standing in for a city grid's density.
// ---------------------------------------------------------------------------
const JUNGLE_TEMPLE_X = 0;
const JUNGLE_TEMPLE_Z = -45;

const jungleGroundMaterial = new THREE.MeshStandardMaterial({ color: 0x3a5a2e, roughness: 0.9, metalness: 0.02 });
const jungleStoneMaterial = new THREE.MeshStandardMaterial({ color: 0x6b6b5a, roughness: 0.8, metalness: 0.05 });
const jungleStoneDarkMaterial = new THREE.MeshStandardMaterial({ color: 0x4a4a3c, roughness: 0.85, metalness: 0.05 });
const jungleTrunkMaterial = new THREE.MeshStandardMaterial({ color: 0x4a3320, roughness: 0.8, metalness: 0.02 });
const jungleLeafMaterial = new THREE.MeshStandardMaterial({ color: 0x2f6b2f, roughness: 0.7, metalness: 0.02 });
const jungleLeafMaterial2 = new THREE.MeshStandardMaterial({ color: 0x3f8a3f, roughness: 0.7, metalness: 0.02 });
const jungleBushMaterial = new THREE.MeshStandardMaterial({ color: 0x356b35, roughness: 0.8, metalness: 0.02 });

function buildZiggurat() {
  const group = new THREE.Group();
  const levels = 5;
  let size = 26;
  let y = 0;
  for (let i = 0; i < levels; i++) {
    const h = 3.2;
    const tier = new THREE.Mesh(new THREE.BoxGeometry(size, h, size), i % 2 === 0 ? jungleStoneMaterial : jungleStoneDarkMaterial);
    tier.position.set(JUNGLE_TEMPLE_X, y + h / 2, JUNGLE_TEMPLE_Z);
    group.add(tier);
    y += h;
    size -= 5;
  }
  const shrine = new THREE.Mesh(new THREE.BoxGeometry(4, 3, 4), jungleStoneDarkMaterial);
  shrine.position.set(JUNGLE_TEMPLE_X, y + 1.5, JUNGLE_TEMPLE_Z);
  group.add(shrine);
  registerWallCollider(JUNGLE_TEMPLE_X - 13, JUNGLE_TEMPLE_X + 13, JUNGLE_TEMPLE_Z - 13, JUNGLE_TEMPLE_Z + 13);
  group.traverse((child) => { child.castShadow = true; });
  return group;
}

// Broken wall fragments scattered for cover — axis-aligned colliders that
// ignore each fragment's random yaw (a loose approximation, not exact AABB).
function buildJungleRuins() {
  const group = new THREE.Group();
  for (let i = 0; i < 24; i++) {
    const x = (Math.random() - 0.5) * 220;
    const z = (Math.random() - 0.5) * 220;
    if (Math.hypot(x - JUNGLE_TEMPLE_X, z - JUNGLE_TEMPLE_Z) < 30) continue;
    const w = 3 + Math.random() * 4;
    const h = 1.5 + Math.random() * 2.5;
    const wall = new THREE.Mesh(new THREE.BoxGeometry(w, h, 0.6), jungleStoneMaterial);
    wall.position.set(x, h / 2, z);
    wall.rotation.y = Math.random() * Math.PI;
    group.add(wall);
    const half = w / 2;
    registerWallCollider(x - half, x + half, z - half, z + half);
  }
  group.traverse((child) => { child.castShadow = true; });
  return group;
}

function createJungleTree(x, z) {
  const tree = new THREE.Group();
  const trunkH = 5 + Math.random() * 3;
  const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.45, trunkH, 8), jungleTrunkMaterial);
  trunk.position.set(0, trunkH / 2, 0);
  tree.add(trunk);
  const canopyMat = Math.random() < 0.5 ? jungleLeafMaterial : jungleLeafMaterial2;
  for (let i = 0; i < 3; i++) {
    const canopy = new THREE.Mesh(new THREE.SphereGeometry(1.8 + Math.random() * 0.8, 8, 6), canopyMat);
    canopy.position.set((Math.random() - 0.5) * 1.2, trunkH + i * 0.6, (Math.random() - 0.5) * 1.2);
    canopy.scale.y = 0.7;
    tree.add(canopy);
  }
  tree.position.set(x, 0, z);
  return tree;
}

function buildJungleFoliage() {
  const group = new THREE.Group();
  for (let i = 0; i < 160; i++) {
    const x = (Math.random() - 0.5) * 260;
    const z = (Math.random() - 0.5) * 260;
    if (Math.hypot(x - JUNGLE_TEMPLE_X, z - JUNGLE_TEMPLE_Z) < 26) continue;
    if (Math.random() < 0.65) {
      group.add(createJungleTree(x, z));
      if (Math.random() < 0.3) registerWallCollider(x - 0.6, x + 0.6, z - 0.6, z + 0.6);
    } else {
      const bush = new THREE.Mesh(new THREE.SphereGeometry(0.8 + Math.random() * 0.6, 8, 6), jungleBushMaterial);
      bush.scale.y = 0.6;
      bush.position.set(x, 0.5, z);
      group.add(bush);
    }
  }
  group.traverse((child) => { child.castShadow = true; });
  return group;
}


function buildJungleMap() {
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(450, 450), jungleGroundMaterial);
  ground.rotation.x = -Math.PI / 2;
  ground.position.y = 0.02;
  registerMapGroup(ground);

  registerMapGroup(buildZiggurat());
  registerMapGroup(buildJungleRuins());
  registerMapGroup(buildJungleFoliage());

  isInsideMapInterior = () => false;
}

// ---------------------------------------------------------------------------
// Map: Subway Tunnels — one long, fully sealed underground tunnel (no
// entrance needed, unlike every other map — the tunnel itself is the whole
// arena) with parked train cars and support pillars for cover, and transit
// shops along both platform edges.
// ---------------------------------------------------------------------------
const SUBWAY_HALF_LEN = 110;
const SUBWAY_HALF_WIDTH = 16;

const subwayWallMaterial = new THREE.MeshStandardMaterial({ color: 0x3a3a3a, roughness: 0.7, metalness: 0.1 });
const subwayWallMaterial2 = new THREE.MeshStandardMaterial({ color: 0x33363d, roughness: 0.7, metalness: 0.15 });
const subwayPlatformMaterial = new THREE.MeshStandardMaterial({ color: 0x55524a, roughness: 0.6, metalness: 0.1 });
const subwayTrackMaterial = new THREE.MeshStandardMaterial({ color: 0x16161a, roughness: 0.8, metalness: 0.2 });
const subwayPillarMaterial = new THREE.MeshStandardMaterial({ color: 0x4a4a4a, roughness: 0.5, metalness: 0.3 });
const subwayTrainMaterial = new THREE.MeshStandardMaterial({ color: 0x6b2b2b, roughness: 0.4, metalness: 0.4 });
const subwayTrainMaterial2 = new THREE.MeshStandardMaterial({ color: 0x2b4a6b, roughness: 0.4, metalness: 0.4 });
const subwayCeilingGlow = new THREE.MeshStandardMaterial({ color: 0xfff2c4, emissive: 0xfff2c4, emissiveIntensity: 0.8 });

function buildSubwayTunnel() {
  const group = new THREE.Group();
  const height = 7;
  const wallT = 0.6;

  const wallGeoLong = new THREE.BoxGeometry(wallT, height, SUBWAY_HALF_LEN * 2);
  [-SUBWAY_HALF_WIDTH, SUBWAY_HALF_WIDTH].forEach((x) => {
    const wall = new THREE.Mesh(wallGeoLong, subwayWallMaterial);
    wall.position.set(x, height / 2, 0);
    group.add(wall);
    registerWallCollider(x - wallT / 2, x + wallT / 2, -SUBWAY_HALF_LEN, SUBWAY_HALF_LEN);
  });
  [-SUBWAY_HALF_LEN, SUBWAY_HALF_LEN].forEach((z) => {
    const wall = new THREE.Mesh(new THREE.BoxGeometry(SUBWAY_HALF_WIDTH * 2, height, wallT), subwayWallMaterial);
    wall.position.set(0, height / 2, z);
    group.add(wall);
    registerWallCollider(-SUBWAY_HALF_WIDTH, SUBWAY_HALF_WIDTH, z - wallT / 2, z + wallT / 2);
  });

  const floor = new THREE.Mesh(new THREE.BoxGeometry(SUBWAY_HALF_WIDTH * 2 - wallT, 0.2, SUBWAY_HALF_LEN * 2 - wallT), subwayPlatformMaterial);
  floor.position.set(0, 0.1, 0);
  group.add(floor);
  const track = new THREE.Mesh(new THREE.BoxGeometry(6, 0.15, SUBWAY_HALF_LEN * 2 - wallT), subwayTrackMaterial);
  track.position.set(0, 0.21, 0);
  group.add(track);

  const roof = new THREE.Mesh(new THREE.BoxGeometry(SUBWAY_HALF_WIDTH * 2 + 0.6, 0.4, SUBWAY_HALF_LEN * 2 + 0.6), subwayWallMaterial2);
  roof.position.set(0, height + 0.2, 0);
  group.add(roof);

  for (let z = -SUBWAY_HALF_LEN + 10; z < SUBWAY_HALF_LEN - 10; z += 20) {
    const light = new THREE.Mesh(new THREE.BoxGeometry(2, 0.1, 1), subwayCeilingGlow);
    light.position.set(0, height - 0.1, z);
    group.add(light);
  }
  for (let z = -SUBWAY_HALF_LEN + 12; z < SUBWAY_HALF_LEN - 12; z += 18) {
    [-9, 9].forEach((x) => {
      const pillar = new THREE.Mesh(new THREE.CylinderGeometry(0.6, 0.6, height, 10), subwayPillarMaterial);
      pillar.position.set(x, height / 2, z);
      group.add(pillar);
      registerWallCollider(x - 0.6, x + 0.6, z - 0.6, z + 0.6);
    });
  }
  group.traverse((child) => { child.castShadow = true; });
  return group;
}

function createTrainCar(z, material) {
  const car = new THREE.Group();
  const body = new THREE.Mesh(new THREE.BoxGeometry(5, 2.6, 12), material);
  body.position.set(0, 1.5, 0);
  car.add(body);
  const stripe = new THREE.Mesh(new THREE.BoxGeometry(5.1, 0.4, 12.1), subwayCeilingGlow);
  stripe.position.set(0, 2.0, 0);
  car.add(stripe);
  car.position.set(0, 0, z);
  registerWallCollider(-2.5, 2.5, z - 6, z + 6);
  return car;
}

// Skips any car within 10 units of the player's spawn point (z=2) so the
// player never spawns embedded inside a train's collider.
function buildSubwayTrains() {
  const group = new THREE.Group();
  let z = -SUBWAY_HALF_LEN + 20;
  let i = 0;
  while (z < SUBWAY_HALF_LEN - 20) {
    if (Math.abs(z - 2) > 10) {
      group.add(createTrainCar(z, i % 2 === 0 ? subwayTrainMaterial : subwayTrainMaterial2));
    }
    z += 13;
    i += 1;
  }
  return group;
}

function buildSubwayMap() {
  scene.background = new THREE.Color(0x0a0a0c);

  registerMapGroup(buildSubwayTunnel());
  registerMapGroup(buildSubwayTrains());

  isInsideMapInterior = () => false;
}

// ---------------------------------------------------------------------------
// Map: Volcano Island — a volcano cone landmark (set back from spawn, same
// approach as the jungle ziggurat) with glowing crater + visual lava flows,
// rock clusters and palm trees (the latter reusing the desert's palm-tree
// builder directly — it's a plain function, not desert-specific), and a
// tiki village of huts standing in for shops + extra cover.
// ---------------------------------------------------------------------------
const VOLCANO_X = 0;
const VOLCANO_Z = -55;

const volcanoGroundMaterial = new THREE.MeshStandardMaterial({ color: 0x3a2e26, roughness: 0.9, metalness: 0.05 });
const volcanoRockMaterial = new THREE.MeshStandardMaterial({ color: 0x2b2420, roughness: 0.85, metalness: 0.1 });
const volcanoLavaMaterial = new THREE.MeshStandardMaterial({ color: 0xff5a1f, emissive: 0xff3c00, emissiveIntensity: 1.1, roughness: 0.4, metalness: 0.1 });
const tikiThatchMaterial = new THREE.MeshStandardMaterial({ color: 0x8a6b3c, roughness: 0.85, metalness: 0.02 });
const tikiWoodMaterial = new THREE.MeshStandardMaterial({ color: 0x5c3b22, roughness: 0.7, metalness: 0.03 });

function buildVolcanoMountain() {
  const group = new THREE.Group();
  const cone = new THREE.Mesh(new THREE.ConeGeometry(22, 30, 10), volcanoRockMaterial);
  cone.position.set(VOLCANO_X, 15, VOLCANO_Z);
  group.add(cone);
  const crater = new THREE.Mesh(new THREE.CylinderGeometry(6, 8, 4, 10), volcanoLavaMaterial);
  crater.position.set(VOLCANO_X, 29, VOLCANO_Z);
  group.add(crater);
  registerWallCollider(VOLCANO_X - 14, VOLCANO_X + 14, VOLCANO_Z - 14, VOLCANO_Z + 14);
  group.traverse((child) => { child.castShadow = true; });
  return group;
}

// Purely visual hazard — flat glowing patches, no damage mechanic (out of
// scope for this pass), no collider so they don't block movement.
function buildLavaFlows() {
  const group = new THREE.Group();
  for (let i = 0; i < 8; i++) {
    const angle = (i / 8) * Math.PI * 2;
    const dist = 16 + Math.random() * 10;
    const x = VOLCANO_X + Math.cos(angle) * dist;
    const z = VOLCANO_Z + Math.sin(angle) * dist;
    const flow = new THREE.Mesh(new THREE.CircleGeometry(4 + Math.random() * 5, 10), volcanoLavaMaterial);
    flow.rotation.x = -Math.PI / 2;
    flow.position.set(x, 0.04, z);
    group.add(flow);
  }
  return group;
}

function buildVolcanoRocks() {
  const group = new THREE.Group();
  for (let i = 0; i < 24; i++) {
    const x = (Math.random() - 0.5) * 220;
    const z = (Math.random() - 0.5) * 220;
    if (Math.hypot(x - VOLCANO_X, z - VOLCANO_Z) < 30) continue;
    const cluster = new THREE.Group();
    const count = 2 + Math.floor(Math.random() * 3);
    let maxR = 0;
    for (let j = 0; j < count; j++) {
      const r = 1 + Math.random() * 1.8;
      maxR = Math.max(maxR, r);
      const rock = new THREE.Mesh(new THREE.DodecahedronGeometry(r, 0), volcanoRockMaterial);
      rock.position.set((Math.random() - 0.5) * 2.5, r * 0.6, (Math.random() - 0.5) * 2.5);
      rock.rotation.set(Math.random() * Math.PI, Math.random() * Math.PI, Math.random() * Math.PI);
      cluster.add(rock);
    }
    cluster.position.set(x, 0, z);
    group.add(cluster);
    registerWallCollider(x - maxR - 1, x + maxR + 1, z - maxR - 1, z + maxR + 1);
  }
  group.traverse((child) => { child.castShadow = true; });
  return group;
}

function buildVolcanoPalms() {
  const group = new THREE.Group();
  for (let i = 0; i < 26; i++) {
    const x = (Math.random() - 0.5) * 240;
    const z = (Math.random() - 0.5) * 240;
    if (Math.hypot(x - VOLCANO_X, z - VOLCANO_Z) < 28) continue;
    group.add(createDesertPalmTree(x, z));
  }
  group.traverse((child) => { child.castShadow = true; });
  return group;
}

function createTikiHut(x, z) {
  const hut = new THREE.Group();
  const postH = 1.6;
  [[-1.4, -1.4], [1.4, -1.4], [-1.4, 1.4], [1.4, 1.4]].forEach(([px, pz]) => {
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.15, postH, 6), tikiWoodMaterial);
    post.position.set(px, postH / 2, pz);
    hut.add(post);
  });
  const floor = new THREE.Mesh(new THREE.BoxGeometry(3.2, 0.2, 3.2), tikiWoodMaterial);
  floor.position.set(0, postH, 0);
  hut.add(floor);
  const roof = new THREE.Mesh(new THREE.ConeGeometry(2.6, 2.2, 8), tikiThatchMaterial);
  roof.position.set(0, postH + 1.5, 0);
  hut.add(roof);
  hut.position.set(x, 0, z);
  registerWallCollider(x - 1.6, x + 1.6, z - 1.6, z + 1.6);
  return hut;
}

function buildTikiVillage() {
  const group = new THREE.Group();
  for (let i = 0; i < 7; i++) {
    const angle = (i / 7) * Math.PI * 2;
    const r = 55 + Math.random() * 15;
    group.add(createTikiHut(Math.cos(angle) * r, Math.sin(angle) * r));
  }
  group.traverse((child) => { child.castShadow = true; });
  return group;
}


function buildVolcanoMap() {
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(450, 450), volcanoGroundMaterial);
  ground.rotation.x = -Math.PI / 2;
  ground.position.y = 0.02;
  registerMapGroup(ground);

  registerMapGroup(buildVolcanoMountain());
  registerMapGroup(buildLavaFlows());
  registerMapGroup(buildVolcanoRocks());
  registerMapGroup(buildVolcanoPalms());
  registerMapGroup(buildTikiVillage());

  isInsideMapInterior = () => false;
}

// Bounds the church occupies, used to keep cars from driving straight through it —
// the z=0 avenue and x=0 street both happen to pass right through the building.
const CHURCH_CLEAR_X = 6.5;
const CHURCH_CLEAR_Z_MIN = -9.5;
const CHURCH_CLEAR_Z_MAX = 11;

function updateCars(deltaTime) {
  cars.forEach((car) => {
    if (car.axis === 'z') {
      car.position.x += car.direction * car.speed * deltaTime;
      if (car.position.x > MAP_RADIUS) car.position.x = -MAP_RADIUS;
      if (car.position.x < -MAP_RADIUS) car.position.x = MAP_RADIUS;
    } else {
      car.position.z += car.direction * car.speed * deltaTime;
      if (car.position.z > MAP_RADIUS) car.position.z = -MAP_RADIUS;
      if (car.position.z < -MAP_RADIUS) car.position.z = MAP_RADIUS;
    }
    // Skip straight past the map's interior structure instead of driving through it.
    if (isInsideMapInterior(car.position.x, car.position.z)) {
      if (car.axis === 'z') {
        car.position.x = car.direction > 0 ? CHURCH_CLEAR_X : -CHURCH_CLEAR_X;
      } else {
        car.position.z = car.direction > 0 ? CHURCH_CLEAR_Z_MAX : CHURCH_CLEAR_Z_MIN;
      }
    }
  });
}

// ---------------------------------------------------------------------------
// Economy — coins persist across runs/sessions (unlike the in-run score),
// and back the Armory shop (weapons/skins/clothes/armor/emotes/VIP).
// ---------------------------------------------------------------------------
const INVENTORY_DEFAULTS = {
  weapons: ['sniper', 'pistol', 'shotgun'],
  skins: ['default'],
  clothes: ['default'],
  armor: ['none'],
  emotes: [],
  vip: false,
};
const EQUIPPED_DEFAULTS = {
  weapon: 'sniper',
  skin: 'default',
  clothes: 'default',
  armor: 'none',
  vipGiantMode: true,
};
const COIN_VALUES = { grunt: 5, rusher: 6, heavy: 10 };
const BOSS_DEFEAT_COINS = 5000;

let coins = parseInt(localStorage.getItem('sniperstrike-coins') || '0', 10) || 0;

function loadInventory() {
  try {
    const saved = JSON.parse(localStorage.getItem('sniperstrike-inventory'));
    return { ...INVENTORY_DEFAULTS, ...saved };
  } catch {
    return { ...INVENTORY_DEFAULTS };
  }
}

function loadEquipped() {
  try {
    const saved = JSON.parse(localStorage.getItem('sniperstrike-equipped'));
    return { ...EQUIPPED_DEFAULTS, ...saved };
  } catch {
    return { ...EQUIPPED_DEFAULTS };
  }
}

const inventory = loadInventory();
const equipped = loadEquipped();

function saveCoins() {
  localStorage.setItem('sniperstrike-coins', String(coins));
}
function saveInventory() {
  localStorage.setItem('sniperstrike-inventory', JSON.stringify(inventory));
}
function saveEquipped() {
  localStorage.setItem('sniperstrike-equipped', JSON.stringify(equipped));
}

function addCoins(amount) {
  coins += amount;
  saveCoins();
  updateCoinsUI();
  if (typeof updateArmoryCoinsUI === 'function') updateArmoryCoinsUI();
}

// Returns true if the purchase succeeded (sufficient coins), false otherwise.
function spendCoins(amount) {
  if (coins < amount) return false;
  coins -= amount;
  saveCoins();
  updateCoinsUI();
  if (typeof updateArmoryCoinsUI === 'function') updateArmoryCoinsUI();
  return true;
}

function updateCoinsUI() {
  const coinsUI = document.getElementById('coins');
  if (coinsUI) coinsUI.textContent = `Coins: ${coins}`;
}

const PLAYER_MAX_HEALTH = 200;
const ENEMY_BULLET_DAMAGE = 4; // small damage per enemy shot

const player = {
  velocity: new THREE.Vector3(),
  direction: new THREE.Vector3(),
  speed: 12,
  health: PLAYER_MAX_HEALTH,
  score: 0,
  canShoot: true,
  activeEmote: null,
  emoteTimer: 0,
  emoteElapsed: 0,
};

// Emotes — short pose-animations triggered from the HUD flyout (and previewable
// live in the Armory). Each pose() gets the same {armLeft, armRight, legLeft,
// legRight, head} shape createCharacter() returns, so it works for both the real
// player and the Armory preview rig with no special-casing.
const EMOTE_DEFS = {
  wave: {
    name: 'Wave', price: 100, duration: 2,
    pose(parts, t) {
      parts.armRight.rotation.set(-2.4 + Math.sin(t * 8) * 0.3, 0, 0.3);
      parts.armLeft.rotation.set(Math.PI / 10, 0, 0);
    },
  },
  dance: {
    name: 'Dance', price: 150, duration: 2.2,
    pose(parts, t) {
      const swing = Math.sin(t * 10);
      parts.armLeft.rotation.set(Math.PI / 10 + swing * 0.6, 0, swing * 0.3);
      parts.armRight.rotation.set(-1.25 - swing * 0.6, 0, -swing * 0.3);
      parts.legLeft.rotation.x = -swing * 0.5;
      parts.legRight.rotation.x = swing * 0.5;
      parts.head.rotation.z = swing * 0.15;
    },
  },
  taunt: {
    name: 'Taunt', price: 150, duration: 1.8,
    pose(parts, t) {
      parts.armRight.rotation.set(-1.6, 0, 0);
      parts.armLeft.rotation.set(Math.PI / 10, 0, 0);
      parts.head.rotation.y = Math.sin(t * 4) * 0.2;
    },
  },
  victory: {
    name: 'Victory Flex', price: 200, duration: 2,
    pose(parts, t) {
      const pulse = Math.sin(t * 6) * 0.4;
      parts.armLeft.rotation.set(-2.6, 0, -0.4 - pulse * 0.1);
      parts.armRight.rotation.set(-2.6, 0, 0.4 + pulse * 0.1);
    },
  },
  salute: {
    name: 'Salute', price: 120, duration: 1.6,
    pose(parts, t) {
      parts.armRight.rotation.set(-2.0, 0.3, 0.1);
      parts.armLeft.rotation.set(Math.PI / 10, 0, 0);
      parts.head.rotation.x = -0.1;
    },
  },
  windmill: {
    name: 'Windmill', price: 180, duration: 1.6,
    pose(parts, t) {
      const a = t * 12;
      parts.armLeft.rotation.set(Math.sin(a) * 1.4 - 1.0, 0, Math.cos(a) * 0.6);
      parts.armRight.rotation.set(Math.cos(a) * 1.4 - 1.0, 0, Math.sin(a) * 0.6);
    },
  },
  bow: {
    name: 'Bow', price: 140, duration: 1.8,
    pose(parts, t) {
      const bend = t < 1.2 ? Math.min(1, t * 2) : Math.max(0, 1 - (t - 1.2) * 3);
      parts.head.rotation.x = bend * 0.9;
      parts.armLeft.rotation.set(Math.PI / 10 - bend * 0.3, 0, 0);
      parts.armRight.rotation.set(-1.25 + bend * 0.3, 0, 0.15);
    },
  },
  clap: {
    name: 'Clap', price: 120, duration: 1.6,
    pose(parts, t) {
      const clap = Math.abs(Math.sin(t * 10));
      parts.armLeft.rotation.set(-1.4, 0, 0.5 - clap * 0.4);
      parts.armRight.rotation.set(-1.4, 0, -0.5 + clap * 0.4);
    },
  },
  titanroar: {
    name: 'Titan Roar', price: 1000, duration: 2.2, vipOnly: true,
    pose(parts, t) {
      const rumble = Math.sin(t * 14) * 0.06;
      parts.armLeft.rotation.set(-2.7 + rumble, 0, -0.5);
      parts.armRight.rotation.set(-2.7 - rumble, 0, 0.5);
      parts.head.rotation.x = -0.3 + rumble;
    },
  },
};
function applyEmotePose(parts, key, elapsed) {
  const def = EMOTE_DEFS[key];
  if (def) def.pose(parts, elapsed);
}

let killStreak = 0;
function registerKill() {
  killStreak += 1;
  killstreakUI.textContent = `Streak: ${killStreak}`;
  killstreakUI.classList.toggle('hidden', killStreak < 2);
}
function resetKillStreak() {
  killStreak = 0;
  killstreakUI.classList.add('hidden');
}

// Clothes — shirt recolor presets. playerCloth is a dedicated material instance
// (not shared with enemies), so recoloring it on equip is just a direct color set.
const CLOTHES_DEFS = {
  default: { name: 'Default Blue', price: 0, color: 0x3c556f },
  red: { name: 'Crimson Red', price: 150, color: 0x8a2727 },
  black: { name: 'Onyx Black', price: 150, color: 0x141414 },
  camo: { name: 'Camo Green', price: 200, color: 0x46522e },
  neon: { name: 'Neon Pink', price: 250, color: 0xff2bd6 },
  gold: { name: 'Gold Suit', price: 350, color: 0xd4af37 },
  navy: { name: 'Navy Blue', price: 150, color: 0x1a2a4a },
  emerald: { name: 'Emerald', price: 200, color: 0x1f6b4a },
  orange: { name: 'Sunset Orange', price: 200, color: 0xff7a1f },
  white: { name: 'Arctic White', price: 250, color: 0xeaeaea },
  violet: { name: 'Royal Violet', price: 300, color: 0x5a1f8a },
  maroon: { name: 'Maroon', price: 250, color: 0x5a1a2a },
};

// Gold Suit gets its own dedicated look instead of just a recolor: a polished
// metallic torso, gold buttons, a bowtie, a top hat, and a "sigma" face
// (sunglasses + furrowed brows + a smirk) — applied/removed via
// applyClothesAccessories() below for whichever rig (player or Armory preview)
// currently has it equipped.
// Kept well under metalness 1 — this scene has no environment map for metals to
// reflect, so a fully metallic material renders almost black under direct light
// alone. A moderate metalness + a real emissive glow reads as "shiny gold" instead.
const goldSuitAccentMaterial = new THREE.MeshStandardMaterial({
  color: 0xffe9a8, roughness: 0.1, metalness: 0.6, emissive: 0xd4af37, emissiveIntensity: 0.4,
});
const goldSuitBlackMaterial = new THREE.MeshStandardMaterial({ color: 0x0c0c0c, roughness: 0.25, metalness: 0.35 });

function buildGoldSuitTorsoAccessories() {
  const g = new THREE.Group();
  const buttonGeo = new THREE.SphereGeometry(0.035, 8, 8);
  for (let i = 0; i < 3; i++) {
    const button = new THREE.Mesh(buttonGeo, goldSuitAccentMaterial);
    button.position.set(0, 1.75 - i * 0.27, 0.29);
    g.add(button);
  }
  // Lowered and pushed forward of the chin/collar overlap zone, and enlarged a
  // touch, so it doesn't get swallowed in the head's shadow against the torso.
  const bowLeft = new THREE.Mesh(new THREE.ConeGeometry(0.13, 0.17, 4), goldSuitBlackMaterial);
  bowLeft.rotation.z = Math.PI / 2;
  bowLeft.position.set(-0.12, 1.76, 0.36);
  g.add(bowLeft);
  const bowRight = bowLeft.clone();
  bowRight.rotation.z = -Math.PI / 2;
  bowRight.position.x = 0.12;
  g.add(bowRight);
  const bowKnot = new THREE.Mesh(new THREE.SphereGeometry(0.06, 8, 8), goldSuitAccentMaterial);
  bowKnot.position.set(0, 1.76, 0.39);
  g.add(bowKnot);
  return g;
}

// Positioned in headGroup-local space (origin = head center) so it rides along
// with every head rotation/bob — emotes, headshot reactions, etc.
function buildGoldSuitTopHat() {
  const g = new THREE.Group();
  const brim = new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.34, 0.04, 16), goldSuitBlackMaterial);
  brim.position.set(0, 0.4, 0);
  g.add(brim);
  const band = new THREE.Mesh(new THREE.CylinderGeometry(0.225, 0.225, 0.07, 16), goldSuitAccentMaterial);
  band.position.set(0, 0.46, 0);
  g.add(band);
  const body = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.22, 0.36, 16), goldSuitBlackMaterial);
  body.position.set(0, 0.65, 0);
  g.add(body);
  const top = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.22, 0.02, 16), goldSuitBlackMaterial);
  top.position.set(0, 0.83, 0);
  g.add(top);
  return g;
}

// Also head-local — sunglasses sit right over the existing eye meshes, angled
// brows and a one-sided smirk sell the "extremely sigma" expression.
// `state` is a small object owned by the caller ({} per rig) that this function
// stashes its added groups onto, so a later call knows what to remove — needed
// because the player's body/head aren't already bundled into one persistent
// object the way the Armory preview rig is.
function applyClothesAccessories(state, bodyGroup, headGroup, key) {
  if (state.torsoGroup) {
    bodyGroup.remove(state.torsoGroup);
    state.torsoGroup = null;
  }
  if (state.headGroup) {
    headGroup.remove(state.headGroup);
    state.headGroup = null;
  }
  if (key === 'gold') {
    state.torsoGroup = buildGoldSuitTorsoAccessories();
    bodyGroup.add(state.torsoGroup);
    // No face override here anymore — the player's face (see buildPlayerFaceDetails()
    // near createCharacter()) is permanent and shown with every outfit, gold suit included.
    state.headGroup = new THREE.Group();
    state.headGroup.add(buildGoldSuitTopHat());
    headGroup.add(state.headGroup);
  }
}

function applyClothesMaterialStyle(material, key) {
  if (key === 'gold') {
    material.metalness = 0.55;
    material.roughness = 0.12;
    material.emissive.setHex(0xd4af37);
    material.emissiveIntensity = 0.45;
  } else {
    material.metalness = 0.08;
    material.roughness = 0.55;
    material.emissive.setHex(0x000000);
    material.emissiveIntensity = 1;
  }
}
const playerClothesAccessoryState = {};
const previewClothesAccessoryState = {};

// Armor — chest/shoulder plates parented onto the torso, plus a damageReduction
// percentage applied at both player-damage sites (enemy bullets, rusher melee),
// and a deflectChance: a per-hit roll (torso hits only — armor doesn't cover the
// head) to fully block the hit, no damage taken at all, with a spark burst and
// "DEFLECTED!" callout instead of the normal damage number.
const ARMOR_DEFS = {
  none: { name: 'No Armor', price: 0, reduction: 0, deflectChance: 0, color: 0x000000, build: null },
  light: {
    name: 'Light Vest', price: 250, reduction: 0.1, deflectChance: 0.08, color: 0x4a4a4a,
    build: (mat) => {
      const g = new THREE.Group();
      const front = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.5, 0.16), mat);
      front.position.set(0, 1.25, 0.2);
      g.add(front);
      const back = front.clone();
      back.position.z = -0.2;
      g.add(back);
      return g;
    },
  },
  reinforced: {
    name: 'Reinforced Vest', price: 380, reduction: 0.15, deflectChance: 0.12, color: 0x4a6b35,
    build: (mat) => {
      const g = new THREE.Group();
      const front = new THREE.Mesh(new THREE.BoxGeometry(0.52, 0.55, 0.17), mat);
      front.position.set(0, 1.25, 0.21);
      g.add(front);
      const frontRidge = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.5, 0.06), mat);
      frontRidge.position.set(0, 1.25, 0.27);
      g.add(frontRidge);
      const back = front.clone();
      back.position.z = -0.21;
      g.add(back);
      const backRidge = frontRidge.clone();
      backRidge.position.z = -0.27;
      g.add(backRidge);
      return g;
    },
  },
  medium: {
    name: 'Combat Plate', price: 500, reduction: 0.2, deflectChance: 0.18, color: 0x35506b,
    build: (mat) => {
      const g = new THREE.Group();
      const front = new THREE.Mesh(new THREE.BoxGeometry(0.56, 0.6, 0.18), mat);
      front.position.set(0, 1.25, 0.22);
      g.add(front);
      const back = front.clone();
      back.position.z = -0.22;
      g.add(back);
      const padLeft = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.2, 0.24), mat);
      padLeft.position.set(-0.56, 1.72, 0);
      g.add(padLeft);
      const padRight = padLeft.clone();
      padRight.position.x = 0.56;
      g.add(padRight);
      return g;
    },
  },
  tactical: {
    name: 'Tactical Rig', price: 650, reduction: 0.25, deflectChance: 0.24, color: 0x2b2b40,
    build: (mat) => {
      const g = new THREE.Group();
      const front = new THREE.Mesh(new THREE.BoxGeometry(0.58, 0.62, 0.19), mat);
      front.position.set(0, 1.25, 0.22);
      g.add(front);
      const back = front.clone();
      back.position.z = -0.22;
      g.add(back);
      const padLeft = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.22, 0.26), mat);
      padLeft.position.set(-0.58, 1.74, 0);
      g.add(padLeft);
      const padRight = padLeft.clone();
      padRight.position.x = 0.58;
      g.add(padRight);
      const thighLeft = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.3, 0.22), mat);
      thighLeft.position.set(-0.18, 0.55, 0.12);
      g.add(thighLeft);
      const thighRight = thighLeft.clone();
      thighRight.position.x = 0.18;
      g.add(thighRight);
      const thighLeftBack = thighLeft.clone();
      thighLeftBack.position.z = -0.12;
      g.add(thighLeftBack);
      const thighRightBack = thighLeftBack.clone();
      thighRightBack.position.x = 0.18;
      g.add(thighRightBack);
      return g;
    },
  },
  heavy: {
    name: 'Heavy Exo', price: 900, reduction: 0.35, deflectChance: 0.32, color: 0x6b3520,
    build: (mat) => {
      const g = new THREE.Group();
      const front = new THREE.Mesh(new THREE.BoxGeometry(0.64, 0.8, 0.22), mat);
      front.position.set(0, 1.15, 0.22);
      g.add(front);
      const back = front.clone();
      back.position.z = -0.22;
      g.add(back);
      const padLeft = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.26, 0.3), mat);
      padLeft.position.set(-0.6, 1.78, 0);
      g.add(padLeft);
      const padRight = padLeft.clone();
      padRight.position.x = 0.6;
      g.add(padRight);
      const belt = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.16, 0.52), mat);
      belt.position.set(0, 0.82, 0);
      g.add(belt);
      return g;
    },
  },
  titan: {
    name: 'Titan Plating', price: 1400, reduction: 0.45, deflectChance: 0.42, color: 0x8a8a8a,
    build: (mat) => {
      const g = new THREE.Group();
      const front = new THREE.Mesh(new THREE.BoxGeometry(0.66, 0.84, 0.24), mat);
      front.position.set(0, 1.15, 0.23);
      g.add(front);
      const back = front.clone();
      back.position.z = -0.23;
      g.add(back);
      const padLeft = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.28, 0.32), mat);
      padLeft.position.set(-0.62, 1.8, 0);
      g.add(padLeft);
      const padRight = padLeft.clone();
      padRight.position.x = 0.62;
      g.add(padRight);
      const belt = new THREE.Mesh(new THREE.BoxGeometry(0.52, 0.18, 0.56), mat);
      belt.position.set(0, 0.8, 0);
      g.add(belt);
      const helmetRing = new THREE.Mesh(new THREE.TorusGeometry(0.36, 0.05, 8, 16), mat);
      helmetRing.rotation.x = Math.PI / 2;
      helmetRing.position.set(0, 2.05, 0);
      g.add(helmetRing);
      const legLeft = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.3, 0.24), mat);
      legLeft.position.set(-0.17, 0.45, 0.1);
      g.add(legLeft);
      const legRight = legLeft.clone();
      legRight.position.x = 0.17;
      g.add(legRight);
      const legLeftBack = legLeft.clone();
      legLeftBack.position.z = -0.1;
      g.add(legLeftBack);
      const legRightBack = legLeftBack.clone();
      legRightBack.position.x = 0.17;
      g.add(legRightBack);
      return g;
    },
  },
  karat24: {
    name: '24K Gold Armor', price: 2500, reduction: 0.55, deflectChance: 1.0, vipOnly: true,
    color: 0xffd700,
    build: (mat) => {
      const g = new THREE.Group();
      const front = new THREE.Mesh(new THREE.BoxGeometry(0.70, 0.88, 0.26), mat);
      front.position.set(0, 1.18, 0.22);
      g.add(front);
      const frontRidge = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.78, 0.08), mat);
      frontRidge.position.set(0, 1.18, 0.34);
      g.add(frontRidge);
      const back = front.clone();
      back.position.z = -0.22;
      g.add(back);
      const backRidge = frontRidge.clone();
      backRidge.position.z = -0.34;
      g.add(backRidge);
      [-1, 1].forEach((side) => {
        const pauldron = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.30, 0.34), mat);
        pauldron.position.set(side * 0.63, 1.82, 0);
        g.add(pauldron);
        const pauldronLower = new THREE.Mesh(new THREE.BoxGeometry(0.30, 0.20, 0.30), mat);
        pauldronLower.position.set(side * 0.61, 1.55, 0);
        g.add(pauldronLower);
        const thigh = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.32, 0.26), mat);
        thigh.position.set(side * 0.18, 0.52, 0.12);
        g.add(thigh);
        const thighBack = thigh.clone();
        thighBack.position.z = -0.12;
        g.add(thighBack);
      });
      const belt = new THREE.Mesh(new THREE.BoxGeometry(0.56, 0.20, 0.56), mat);
      belt.position.set(0, 0.80, 0);
      g.add(belt);
      const helmetRing = new THREE.Mesh(new THREE.TorusGeometry(0.38, 0.06, 8, 16), mat);
      helmetRing.rotation.x = Math.PI / 2;
      helmetRing.position.set(0, 2.06, 0);
      g.add(helmetRing);
      const crest = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.22, 0.06), mat);
      crest.position.set(0, 2.30, 0);
      g.add(crest);
      return g;
    },
  },
};
const armorMaterialCache = {};
function getArmorMaterial(key) {
  if (!armorMaterialCache[key]) {
    if (key === 'karat24') {
      armorMaterialCache[key] = new THREE.MeshStandardMaterial({
        color: 0xffd700, roughness: 0.08, metalness: 0.98,
        emissive: 0xffaa00, emissiveIntensity: 0.35, envMapIntensity: 2.0,
      });
    } else {
      armorMaterialCache[key] = new THREE.MeshStandardMaterial({ color: ARMOR_DEFS[key].color, roughness: 0.3, metalness: 0.6 });
    }
  }
  return armorMaterialCache[key];
}
function buildArmorMesh(key) {
  const def = ARMOR_DEFS[key];
  if (!def || !def.build) return null;
  return def.build(getArmorMaterial(key));
}

const playerCloth = new THREE.MeshStandardMaterial({ color: 0x3c556f, roughness: 0.55, metalness: 0.08 });
const playerSkin = new THREE.MeshStandardMaterial({ color: 0xe3b89c, roughness: 0.45, metalness: 0.02 });
const playerHatMaterial = new THREE.MeshStandardMaterial({ color: 0x000000, roughness: 0.45, metalness: 0.08 });
const gunMaterial = new THREE.MeshStandardMaterial({ color: 0x161b20, roughness: 0.16, metalness: 0.85 });
const gunDetailMaterial = new THREE.MeshStandardMaterial({ color: 0x8a9ba8, roughness: 0.18, metalness: 0.95 });

// Every gun builder takes an optional { primary, detail } materials pair — default
// is the shared gunMaterial/gunDetailMaterial (what enemies always use, since enemy
// guns are built with no args), so player weapon skins can pass their own materials
// without ever recoloring enemy weapons.
function createSniperGun(materials = { primary: gunMaterial, detail: gunDetailMaterial }) {
  const gun = new THREE.Group();
  const stock = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.12, 0.36), materials.primary);
  stock.position.set(0, 0, -0.18);
  gun.add(stock);

  const body = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.08, 0.7), materials.primary);
  body.position.set(0, 0.01, 0.15);
  gun.add(body);

  const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.85, 10), materials.primary);
  barrel.rotation.x = Math.PI / 2;
  barrel.position.set(0, 0, 0.7);
  gun.add(barrel);

  const muzzle = new THREE.Object3D();
  muzzle.position.set(0, 0, 0.85);
  gun.add(muzzle);
  gun.muzzle = muzzle;

  const scope = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 0.28, 10), materials.detail);
  scope.rotation.x = Math.PI / 2;
  scope.position.set(0.12, 0.12, 0.15);
  gun.add(scope);

  const grip = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.24, 0.08), materials.detail);
  grip.position.set(0, -0.12, 0.05);
  gun.add(grip);

  return gun;
}

// Same convention as createSniperGun(): local +Z is forward, and `.muzzle` marks the tip.
function createPistol(materials = { primary: gunMaterial, detail: gunDetailMaterial }) {
  const gun = new THREE.Group();
  const body = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.14, 0.32), materials.primary);
  body.position.set(0, 0, 0.05);
  gun.add(body);

  const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.22, 8), materials.primary);
  barrel.rotation.x = Math.PI / 2;
  barrel.position.set(0, 0.02, 0.28);
  gun.add(barrel);

  const grip = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.22, 0.1), materials.detail);
  grip.position.set(0, -0.16, -0.06);
  grip.rotation.x = 0.3;
  gun.add(grip);

  const muzzle = new THREE.Object3D();
  muzzle.position.set(0, 0.02, 0.4);
  gun.add(muzzle);
  gun.muzzle = muzzle;
  return gun;
}

function createShotgun(materials = { primary: gunMaterial, detail: gunDetailMaterial }) {
  const gun = new THREE.Group();
  const stock = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.14, 0.32), materials.detail);
  stock.position.set(0, -0.01, -0.2);
  gun.add(stock);

  const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 0.95, 10), materials.primary);
  barrel.rotation.x = Math.PI / 2;
  barrel.position.set(0, 0.02, 0.35);
  gun.add(barrel);

  const pump = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.09, 0.3), materials.detail);
  pump.position.set(0, -0.06, 0.3);
  gun.add(pump);

  const muzzle = new THREE.Object3D();
  muzzle.position.set(0, 0.02, 0.85);
  gun.add(muzzle);
  gun.muzzle = muzzle;
  return gun;
}

// Compact, fast-cycling SMG — purchasable in the Armory Weapons tab.
function createSMG(materials = { primary: gunMaterial, detail: gunDetailMaterial }) {
  const gun = new THREE.Group();
  const body = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.12, 0.42), materials.primary);
  body.position.set(0, 0, 0.05);
  gun.add(body);

  const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.3, 8), materials.primary);
  barrel.rotation.x = Math.PI / 2;
  barrel.position.set(0, 0.02, 0.42);
  gun.add(barrel);

  const magazine = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.26, 0.08), materials.detail);
  magazine.position.set(0, -0.18, 0.1);
  magazine.rotation.x = -0.25;
  gun.add(magazine);

  const stock = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.08, 0.2), materials.detail);
  stock.position.set(0, 0, -0.28);
  gun.add(stock);

  const muzzle = new THREE.Object3D();
  muzzle.position.set(0, 0.02, 0.58);
  gun.add(muzzle);
  gun.muzzle = muzzle;
  return gun;
}

// Heavy splash-damage launcher — purchasable in the Armory Weapons tab.
function createRocketLauncher(materials = { primary: gunMaterial, detail: gunDetailMaterial }) {
  const gun = new THREE.Group();
  const tube = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.13, 1.1, 12), materials.primary);
  tube.rotation.x = Math.PI / 2;
  tube.position.set(0, 0.02, 0.35);
  gun.add(tube);

  const sight = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.12, 0.18), materials.detail);
  sight.position.set(0, 0.16, 0.1);
  gun.add(sight);

  const grip = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.22, 0.08), materials.detail);
  grip.position.set(0, -0.16, -0.05);
  grip.rotation.x = 0.25;
  gun.add(grip);

  const muzzle = new THREE.Object3D();
  muzzle.position.set(0, 0.02, 0.9);
  gun.add(muzzle);
  gun.muzzle = muzzle;
  return gun;
}

// Giant dual-barrel minigun — exclusive to the VIP pass.
function createMinigun(materials = { primary: gunMaterial, detail: gunDetailMaterial }) {
  const gun = new THREE.Group();
  const drum = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 0.3, 12), materials.detail);
  drum.rotation.x = Math.PI / 2;
  drum.position.set(0, -0.05, 0.05);
  gun.add(drum);

  for (let i = 0; i < 6; i++) {
    const angle = (i / 6) * Math.PI * 2;
    const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.045, 1.1, 8), materials.primary);
    barrel.rotation.x = Math.PI / 2;
    barrel.position.set(Math.cos(angle) * 0.13, Math.sin(angle) * 0.13 - 0.05, 0.55);
    gun.add(barrel);
  }

  const grip = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.32, 0.14), materials.detail);
  grip.position.set(0, -0.28, -0.05);
  grip.rotation.x = 0.25;
  gun.add(grip);

  const muzzle = new THREE.Object3D();
  muzzle.position.set(0, -0.05, 1.1);
  gun.add(muzzle);
  gun.muzzle = muzzle;
  return gun;
}

// Tight 3-pellet burst — visually a fan of near-parallel rounds fired together.
function createBurstRifle(materials = { primary: gunMaterial, detail: gunDetailMaterial }) {
  const gun = new THREE.Group();
  const body = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.1, 0.55), materials.primary);
  body.position.set(0, 0, 0.1);
  gun.add(body);

  const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.5, 8), materials.primary);
  barrel.rotation.x = Math.PI / 2;
  barrel.position.set(0, 0.01, 0.55);
  gun.add(barrel);

  const sight = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.1, 0.12), materials.detail);
  sight.position.set(0, 0.1, 0.1);
  gun.add(sight);

  const grip = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.2, 0.08), materials.detail);
  grip.position.set(0, -0.14, -0.1);
  grip.rotation.x = 0.25;
  gun.add(grip);

  const mag = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.22, 0.08), materials.detail);
  mag.position.set(0, -0.16, 0.05);
  mag.rotation.x = -0.2;
  gun.add(mag);

  const muzzle = new THREE.Object3D();
  muzzle.position.set(0, 0.01, 0.82);
  gun.add(muzzle);
  gun.muzzle = muzzle;
  return gun;
}

// Precise sidearm with a visible cylinder drum.
function createRevolver(materials = { primary: gunMaterial, detail: gunDetailMaterial }) {
  const gun = new THREE.Group();
  const body = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.12, 0.22), materials.primary);
  body.position.set(0, 0, -0.02);
  gun.add(body);

  const drum = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 0.14, 10), materials.detail);
  drum.rotation.z = Math.PI / 2;
  drum.position.set(0, 0.01, 0.05);
  gun.add(drum);

  const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.32, 8), materials.primary);
  barrel.rotation.x = Math.PI / 2;
  barrel.position.set(0, 0.01, 0.32);
  gun.add(barrel);

  const grip = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.22, 0.1), materials.detail);
  grip.position.set(0, -0.16, -0.12);
  grip.rotation.x = 0.35;
  gun.add(grip);

  const muzzle = new THREE.Object3D();
  muzzle.position.set(0, 0.01, 0.48);
  gun.add(muzzle);
  gun.muzzle = muzzle;
  return gun;
}

// Bipod-equipped light machine gun with a drum magazine.
function createLMG(materials = { primary: gunMaterial, detail: gunDetailMaterial }) {
  const gun = new THREE.Group();
  const body = new THREE.Mesh(new THREE.BoxGeometry(0.13, 0.14, 0.75), materials.primary);
  body.position.set(0, 0.02, 0.15);
  gun.add(body);

  const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.045, 0.6, 10), materials.primary);
  barrel.rotation.x = Math.PI / 2;
  barrel.position.set(0, 0.02, 0.7);
  gun.add(barrel);

  const drum = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.16, 0.12, 12), materials.detail);
  drum.position.set(0, -0.2, 0.05);
  gun.add(drum);

  const bipodLeft = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.3, 0.03), materials.detail);
  bipodLeft.position.set(-0.08, -0.15, 0.55);
  bipodLeft.rotation.z = 0.3;
  gun.add(bipodLeft);
  const bipodRight = bipodLeft.clone();
  bipodRight.position.x = 0.08;
  bipodRight.rotation.z = -0.3;
  gun.add(bipodRight);

  const grip = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.22, 0.09), materials.detail);
  grip.position.set(0, -0.18, -0.18);
  grip.rotation.x = 0.3;
  gun.add(grip);

  const muzzle = new THREE.Object3D();
  muzzle.position.set(0, 0.02, 1.0);
  gun.add(muzzle);
  gun.muzzle = muzzle;
  return gun;
}

// Slow, heavy-hitting bolt weapon with horizontal limbs.
function createCrossbow(materials = { primary: gunMaterial, detail: gunDetailMaterial }) {
  const gun = new THREE.Group();
  const body = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.08, 0.55), materials.primary);
  body.position.set(0, 0, 0.05);
  gun.add(body);

  const limb = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.05, 0.06), materials.detail);
  limb.position.set(0, 0.02, 0.25);
  gun.add(limb);

  const stringLeft = new THREE.Mesh(new THREE.CylinderGeometry(0.01, 0.01, 0.36, 6), materials.primary);
  stringLeft.rotation.z = Math.PI / 2.3;
  stringLeft.position.set(-0.17, 0.02, 0.05);
  gun.add(stringLeft);
  const stringRight = stringLeft.clone();
  stringRight.position.x = 0.17;
  stringRight.rotation.z = -Math.PI / 2.3;
  gun.add(stringRight);

  const grip = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.22, 0.09), materials.detail);
  grip.position.set(0, -0.16, -0.18);
  grip.rotation.x = 0.3;
  gun.add(grip);

  const muzzle = new THREE.Object3D();
  muzzle.position.set(0, 0.02, 0.62);
  gun.add(muzzle);
  gun.muzzle = muzzle;
  return gun;
}

const WEAPON_DEFS = {
  sniper: { name: 'Sniper Rifle', damage: 30, cooldown: 220, pellets: 1, spread: 0, speed: 40, build: createSniperGun, price: 0 },
  pistol: { name: 'Pistol', damage: 14, cooldown: 110, pellets: 1, spread: 0.012, speed: 50, build: createPistol, price: 0 },
  shotgun: { name: 'Shotgun', damage: 9, cooldown: 700, pellets: 6, spread: 0.13, speed: 34, build: createShotgun, price: 0 },
  burst: { name: 'Burst Rifle', damage: 16, cooldown: 380, pellets: 3, spread: 0.02, speed: 46, build: createBurstRifle, price: 450 },
  revolver: { name: 'Revolver', damage: 28, cooldown: 380, pellets: 1, spread: 0.004, speed: 55, build: createRevolver, price: 300 },
  lmg: { name: 'LMG', damage: 11, cooldown: 80, pellets: 1, spread: 0.06, speed: 50, build: createLMG, price: 650 },
  crossbow: { name: 'Crossbow', damage: 55, cooldown: 900, pellets: 1, spread: 0, speed: 30, build: createCrossbow, price: 600 },
  smg: { name: 'SMG', damage: 8, cooldown: 90, pellets: 1, spread: 0.05, speed: 48, build: createSMG, price: 350 },
  rocket: { name: 'Rocket Launcher', damage: 70, cooldown: 1100, pellets: 1, spread: 0, speed: 22, build: createRocketLauncher, price: 800, splashRadius: 4.5 },
  minigun: { name: 'Minigun', damage: 9, cooldown: 0, pellets: 1, spread: 0.05, speed: 55, build: createMinigun, price: 0, vipOnly: true },
};

// Clears the mount's current visual and rebuilds it from a gun builder, re-parenting the
// new muzzle marker — the mount itself stays put (it already has the arm-tilt-cancelling
// quaternion and position set up in createCharacter, so it doesn't need to be redone).
function rebuildGunVisual(mount, build) {
  while (mount.children.length) mount.remove(mount.children[0]);
  const fresh = build();
  while (fresh.children.length) mount.add(fresh.children[0]);
  mount.muzzle = fresh.muzzle;
}

// Weapon skins — recolor presets applied to whichever gun is equipped. These get
// their OWN material instances (never the shared gunMaterial/gunDetailMaterial),
// so recoloring the player's weapon never touches enemy guns.
const SKIN_DEFS = {
  default: { name: 'Default Gunmetal', price: 0, primary: 0x161b20, detail: 0x8a9ba8 },
  gold: { name: 'Gold Rush', price: 300, primary: 0xd4af37, detail: 0xfff1b8 },
  crimson: { name: 'Crimson', price: 300, primary: 0x8a1f1f, detail: 0x2b0a0a },
  toxic: { name: 'Toxic Green', price: 300, primary: 0x1f8a3c, detail: 0xbfff5e, emissive: 0x2bff6e },
  stealth: { name: 'Stealth Black', price: 400, primary: 0x0a0a0a, detail: 0x1c1c1c },
  royal: { name: 'Royal Purple', price: 400, primary: 0x5a1f8a, detail: 0xd9b8ff, emissive: 0x9b30ff },
  ocean: { name: 'Ocean Blue', price: 300, primary: 0x1f4f8a, detail: 0xbfe3ff },
  inferno: { name: 'Inferno', price: 400, primary: 0xff4500, detail: 0xffd24c, emissive: 0xff6a00 },
  carbon: { name: 'Carbon Fiber', price: 350, primary: 0x1a1a1a, detail: 0x3a3a3a },
  chrome: { name: 'Chrome', price: 450, primary: 0xc8d0d8, detail: 0xffffff },
  cyan: { name: 'Neon Cyan', price: 400, primary: 0x0af0ff, detail: 0x003844, emissive: 0x0af0ff },
  blood: { name: 'Blood Moon', price: 500, primary: 0x6b0000, detail: 0x1a0000, emissive: 0x8a0000 },
  goldenMinigun: { name: 'Golden Minigun Finish', price: 1200, primary: 0xffd700, detail: 0xfff8dc, emissive: 0xffae00, vipOnly: true },
};
const skinMaterialsCache = {};
function getGunMaterialsForSkin(skinKey) {
  const def = SKIN_DEFS[skinKey] || SKIN_DEFS.default;
  if (!skinMaterialsCache[skinKey]) {
    skinMaterialsCache[skinKey] = {
      primary: new THREE.MeshStandardMaterial({
        color: def.primary, roughness: 0.16, metalness: 0.85,
        emissive: def.emissive || 0x000000, emissiveIntensity: def.emissive ? 0.4 : 0,
      }),
      detail: new THREE.MeshStandardMaterial({ color: def.detail, roughness: 0.18, metalness: 0.95 }),
    };
  }
  return skinMaterialsCache[skinKey];
}
function getEquippedGunMaterials() {
  return getGunMaterialsForSkin(equipped.skin);
}

// Declared here, before setPlayerWeapon() below, since applyVipState() calls
// setPlayerWeapon() at module-init time (well before the other DOM lookups
// further down the file) and would otherwise hit this element pre-initialized.
const weaponUI = document.getElementById('weapon');

function setPlayerWeapon(key) {
  const def = WEAPON_DEFS[key];
  if (!def || player.weaponKey === key) return;
  player.weaponKey = key;
  player.weapon = def;
  rebuildGunVisual(playerGun, () => def.build(getEquippedGunMaterials()));
  weaponUI.textContent = `Weapon: ${def.name}`;
  playWeaponSwitch();
}

function createCharacter(clothMaterial, skinMaterial, headwearMaterial, gunPosition) {
  const bodyGroup = new THREE.Group();

  // Head — slightly oval, with simple eyes so it reads as a face rather than a ball.
  const headGroup = new THREE.Group();
  headGroup.position.set(0, 2.1, 0);

  const head = new THREE.Mesh(new THREE.SphereGeometry(0.35, 16, 14), skinMaterial);
  head.scale.set(1, 1.08, 0.95);
  headGroup.add(head);

  const eyeLeft = new THREE.Mesh(eyeGeometry, eyeMaterial);
  eyeLeft.position.set(-0.12, 0.03, 0.3);
  headGroup.add(eyeLeft);
  const eyeRight = eyeLeft.clone();
  eyeRight.position.x = 0.12;
  headGroup.add(eyeRight);

  const headwear = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.34, 0.25, 12), headwearMaterial);
  headwear.position.set(0, -0.15, 0);
  headGroup.add(headwear);
  bodyGroup.add(headGroup);

  // Torso — rounded capsule instead of a flat box, tapered like shoulders-to-waist.
  const torso = new THREE.Mesh(new THREE.CapsuleGeometry(0.33, 0.74, 4, 12), clothMaterial);
  torso.scale.set(1.25, 1, 0.85);
  torso.position.set(0, 1.2, 0);
  bodyGroup.add(torso);

  // Arms — rounded capsule limbs capped with a hand.
  function createArm() {
    const arm = new THREE.Mesh(new THREE.CapsuleGeometry(0.12, 0.71, 4, 8), clothMaterial);
    const hand = new THREE.Mesh(handGeometry, skinMaterial);
    hand.position.set(0, -0.475, 0);
    arm.add(hand);
    return arm;
  }

  const armLeft = createArm();
  armLeft.position.set(-0.55, 1.45, 0);
  armLeft.rotation.x = Math.PI / 10;
  bodyGroup.add(armLeft);

  const armRight = createArm();
  armRight.position.set(0.55, 1.45, 0.18);
  armRight.rotation.set(-1.25, 0, 0.15);
  bodyGroup.add(armRight);

  const gun = createSniperGun();
  // Position the gun near the hand, and cancel out the arm's own tilt (via the
  // inverse of its rotation) so the barrel — and the bullets fired from it —
  // always point straight ahead, in the body's forward direction.
  gun.position.copy(gunPosition);
  gun.quaternion.copy(armRight.quaternion).invert();
  armRight.add(gun);

  // Legs — rounded capsule limbs capped with a shoe.
  function createLeg() {
    const leg = new THREE.Mesh(new THREE.CapsuleGeometry(0.16, 0.68, 4, 8), clothMaterial);
    const foot = new THREE.Mesh(footGeometry, shoeMaterial);
    foot.position.set(0, -0.5, 0.05);
    leg.add(foot);
    return leg;
  }

  const legLeft = createLeg();
  legLeft.position.set(-0.17, 0.35, 0);
  bodyGroup.add(legLeft);

  const legRight = createLeg();
  legRight.position.set(0.17, 0.35, 0);
  bodyGroup.add(legRight);

  return { bodyGroup, head: headGroup, armLeft, armRight, gun, legLeft, legRight };
}

// Permanent face for the PLAYER specifically (not enemies/NPCs, which keep their
// plain dot eyes) — added on top of a head built by createCharacter(), in that
// head's local space. White almond "sclera" sit just behind the existing dark
// eye spheres (which become the pupils), plus asymmetric angled eyebrows and a
// one-sided smirk mouth, matching the reference face exactly. Always on, with
// every outfit — not gated by clothes the way the gold suit's accessories are.
const faceBrowMaterial = new THREE.MeshStandardMaterial({ color: 0x1b1b1b, roughness: 0.4 });
const faceScleraMaterial = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.35, metalness: 0 });
function buildPlayerFaceDetails() {
  const g = new THREE.Group();

  const scleraGeo = new THREE.SphereGeometry(0.065, 10, 8);
  const scleraLeft = new THREE.Mesh(scleraGeo, faceScleraMaterial);
  scleraLeft.scale.set(1, 0.7, 0.4);
  scleraLeft.position.set(-0.12, 0.03, 0.295);
  g.add(scleraLeft);
  const scleraRight = scleraLeft.clone();
  scleraRight.position.x = 0.12;
  g.add(scleraRight);

  const browGeo = new THREE.BoxGeometry(0.14, 0.03, 0.02);
  const browLeft = new THREE.Mesh(browGeo, faceBrowMaterial);
  browLeft.position.set(-0.12, 0.165, 0.32);
  browLeft.rotation.z = 0.35;
  g.add(browLeft);
  const browRight = new THREE.Mesh(browGeo, faceBrowMaterial);
  browRight.position.set(0.12, 0.15, 0.32);
  browRight.rotation.z = -0.12;
  g.add(browRight);

  const mouth = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.025, 0.02), faceBrowMaterial);
  mouth.position.set(0.02, -0.16, 0.33);
  mouth.rotation.z = 0.12;
  g.add(mouth);

  return g;
}

const {
  bodyGroup: playerBody,
  head: playerHead,
  armLeft: playerArmLeft,
  armRight: playerArmRight,
  gun: playerGun,
  legLeft: playerLegLeft,
  legRight: playerLegRight,
} = createCharacter(
  playerCloth,
  playerSkin,
  playerHatMaterial,
  new THREE.Vector3(0.2, -0.15, 0.25)
);
// z=2, not 0 — at z=0 the default chase camera (8.5 units behind, facing +Z) lands
// inside the church's back wall, which hid the crying/healing event that fires on spawn.
playerBody.position.set(0, 1.4, 2);
scene.add(playerBody);
player.weaponKey = (equipped.weapon && inventory.weapons.includes(equipped.weapon)) ? equipped.weapon : 'sniper';
player.weapon = WEAPON_DEFS[player.weaponKey];
rebuildGunVisual(playerGun, () => player.weapon.build(getEquippedGunMaterials()));
playerCloth.color.set((CLOTHES_DEFS[equipped.clothes] || CLOTHES_DEFS.default).color);
applyClothesMaterialStyle(playerCloth, equipped.clothes);
applyClothesAccessories(playerClothesAccessoryState, playerBody, playerHead, equipped.clothes);
playerHead.add(buildPlayerFaceDetails());
player.speedMultiplier = 1;
player.damageMultiplier = 1;
player.fireRateMultiplier = 1;

let playerArmorMesh = null;
function applyPlayerArmor(key) {
  if (playerArmorMesh) {
    playerBody.remove(playerArmorMesh);
    playerArmorMesh = null;
  }
  const mesh = buildArmorMesh(key);
  if (mesh) {
    playerBody.add(mesh);
    playerArmorMesh = mesh;
  }
  const def = ARMOR_DEFS[key] || ARMOR_DEFS.none;
  player.armorReduction = def.reduction;
  player.armorDeflectChance = def.deflectChance || 0;
}
applyPlayerArmor(equipped.armor);

// VIP — the ultimate pass. Once owned, the player can freely switch between a
// giant wielding the minigun and their normal loadout, anytime (in the shop,
// via the HUD button, or the 'G' key) — the purchase just unlocks the option.
// Declared here, before applyVipState()'s init call below, since that call
// triggers updateVipToggleButton() which needs this element already resolved.
const vipToggleButton = document.getElementById('vip-toggle-button');
function updateVipToggleButton() {
  if (!vipToggleButton) return;
  vipToggleButton.classList.toggle('hidden', !inventory.vip);
  vipToggleButton.textContent = vipGiantMode ? '🗽' : '🙂';
  vipToggleButton.title = vipGiantMode ? 'Switch to Normal (G)' : 'Switch to Giant (G)';
}
const GIANT_SCALE = 3;
const VIP_PRICE = 5000;
let vipGiantMode = inventory.vip && equipped.vipGiantMode !== false;
function applyVipState() {
  if (inventory.vip && vipGiantMode) {
    playerBody.scale.setScalar(GIANT_SCALE);
    if (!inventory.weapons.includes('minigun')) inventory.weapons.push('minigun');
    setPlayerWeapon('minigun');
  } else {
    playerBody.scale.setScalar(1);
    if (inventory.vip) {
      const fallback = (equipped.weapon && inventory.weapons.includes(equipped.weapon)) ? equipped.weapon : 'sniper';
      setPlayerWeapon(fallback);
    }
  }
  if (typeof updateVipToggleButton === 'function') updateVipToggleButton();
}
function setVipGiantMode(active) {
  if (!inventory.vip || vipGiantMode === active) return;
  vipGiantMode = active;
  equipped.vipGiantMode = active;
  saveEquipped();
  applyVipState();
  showMessage(active ? 'GIANT MODE — VIP MINIGUN ENGAGED' : 'NORMAL MODE RESTORED', 2000);
}
function toggleVipGiantMode() {
  setVipGiantMode(!vipGiantMode);
}
applyVipState();

const playerParts = {
  armLeft: playerArmLeft,
  armRight: playerArmRight,
  legLeft: playerLegLeft,
  legRight: playerLegRight,
  head: playerHead,
};

function triggerEmote(key) {
  if (!EMOTE_DEFS[key]) return;
  player.activeEmote = key;
  player.emoteTimer = EMOTE_DEFS[key].duration;
  player.emoteElapsed = 0;
}

// ---------------------------------------------------------------------------
// Armory live preview — a small second renderer/scene reusing createCharacter()
// and the weapon builders so the shop shows the real model, not a static icon.
// Only rendered while the armory screen is open (started/stopped by openArmory/
// closeArmory above).
// ---------------------------------------------------------------------------
const previewCanvas = document.getElementById('armory-preview-canvas');
const previewScene = new THREE.Scene();
const previewCamera = new THREE.PerspectiveCamera(35, 280 / 320, 0.1, 50);
previewCamera.position.set(0, 1.7, 4.4);
previewCamera.lookAt(0, 1.3, 0);

const previewRenderer = new THREE.WebGLRenderer({ canvas: previewCanvas, alpha: true, antialias: true });
previewRenderer.setSize(280, 320, false);
previewRenderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));

previewScene.add(new THREE.AmbientLight(0xffffff, 0.7));
const previewDirLight = new THREE.DirectionalLight(0xffffff, 1.1);
previewDirLight.position.set(2, 4, 3);
previewScene.add(previewDirLight);

const previewCloth = new THREE.MeshStandardMaterial({ color: playerCloth.color.getHex(), roughness: 0.55, metalness: 0.08 });
const previewSkin = new THREE.MeshStandardMaterial({ color: 0xe3b89c, roughness: 0.45, metalness: 0.02 });
const previewHat = new THREE.MeshStandardMaterial({ color: 0x000000, roughness: 0.45, metalness: 0.08 });

const previewRig = createCharacter(previewCloth, previewSkin, previewHat, new THREE.Vector3(0.2, -0.15, 0.25));
previewRig.head.add(buildPlayerFaceDetails());
previewScene.add(previewRig.bodyGroup);

let previewArmorMesh = null;
let previewActiveEmote = null;
let previewEmoteElapsed = 0;
let previewRotation = 0;
let previewLoopId = null;

function setPreviewGun(buildFn) {
  rebuildGunVisual(previewRig.gun, buildFn);
}

function setPreviewClothesStyle(key) {
  const def = CLOTHES_DEFS[key] || CLOTHES_DEFS.default;
  previewCloth.color.set(def.color);
  applyClothesMaterialStyle(previewCloth, key);
  applyClothesAccessories(previewClothesAccessoryState, previewRig.bodyGroup, previewRig.head, key);
}

function setPreviewScale(scale) {
  previewRig.bodyGroup.scale.setScalar(scale);
  // Pull the preview camera back so a giant-scale rig (VIP tab) still fits in frame.
  previewCamera.position.set(0, 1.7 * scale, 4.4 * scale);
  previewCamera.lookAt(0, 1.3 * scale, 0);
}

function setPreviewArmor(buildArmorFn) {
  if (previewArmorMesh) {
    previewRig.bodyGroup.remove(previewArmorMesh);
    previewArmorMesh = null;
  }
  const mesh = buildArmorFn ? buildArmorFn() : null;
  if (mesh) {
    previewArmorMesh = mesh;
    previewRig.bodyGroup.add(previewArmorMesh);
  }
}

function setPreviewEmote(key) {
  previewActiveEmote = key;
  previewEmoteElapsed = 0;
}

// Default view per tab — overridden live when the player hovers/selects a
// specific card (each category's renderer calls the setPreview* helpers above).
function updatePreviewForTab(tab) {
  if (tab !== 'emotes') previewActiveEmote = null;
  setPreviewScale(tab === 'vip' ? GIANT_SCALE : 1);
  if (tab === 'weapons') {
    setPreviewGun((WEAPON_DEFS[equipped.weapon] || WEAPON_DEFS.sniper).build);
  } else if (tab === 'skins') {
    const def = WEAPON_DEFS[equipped.weapon] || WEAPON_DEFS.sniper;
    setPreviewGun(() => def.build(getEquippedGunMaterials()));
  } else if (tab === 'clothes') {
    setPreviewClothesStyle(equipped.clothes);
  } else if (tab === 'armor') {
    setPreviewArmor(() => buildArmorMesh(equipped.armor));
  } else if (tab === 'emotes') {
    setPreviewArmor(() => buildArmorMesh(equipped.armor));
  } else if (tab === 'vip') {
    setPreviewGun(() => createMinigun(getEquippedGunMaterials()));
  }
}

function startPreviewLoop() {
  if (previewLoopId) return;
  const tick = () => {
    previewLoopId = requestAnimationFrame(tick);
    previewRotation += 0.012;
    previewRig.bodyGroup.rotation.y = previewRotation;
    if (previewActiveEmote && typeof applyEmotePose === 'function') {
      previewEmoteElapsed += 1 / 60;
      applyEmotePose(previewRig, previewActiveEmote, previewEmoteElapsed);
    }
    previewRenderer.render(previewScene, previewCamera);
  };
  tick();
}

function stopPreviewLoop() {
  if (previewLoopId) {
    cancelAnimationFrame(previewLoopId);
    previewLoopId = null;
  }
}

const enemies = [];
const enemyHelmetMaterial = new THREE.MeshStandardMaterial({ color: 0x331010, roughness: 0.15, metalness: 0.12 });
const enemySkinMaterial = new THREE.MeshStandardMaterial({ color: 0xe3b89c, roughness: 0.45, metalness: 0.02 });
const enemyClothMaterial = new THREE.MeshStandardMaterial({ color: 0x8a2727, roughness: 0.55, metalness: 0.07 });

// Rusher — lean melee charger, orange.
const rusherClothMaterial = new THREE.MeshStandardMaterial({ color: 0xff8c1a, roughness: 0.5, metalness: 0.08 });
const rusherHelmetMaterial = new THREE.MeshStandardMaterial({ color: 0x402000, roughness: 0.2, metalness: 0.1 });

// Heavy — bulky tank, dark olive.
const heavyClothMaterial = new THREE.MeshStandardMaterial({ color: 0x3a4a3a, roughness: 0.6, metalness: 0.15 });
const heavyHelmetMaterial = new THREE.MeshStandardMaterial({ color: 0x1a1a1a, roughness: 0.2, metalness: 0.3 });

// Boss — towering, glowing violet trim.
const bossClothMaterial = new THREE.MeshStandardMaterial({ color: 0x2a0a3a, roughness: 0.4, metalness: 0.3, emissive: 0x6a1bb0, emissiveIntensity: 0.25 });
const bossHelmetMaterial = new THREE.MeshStandardMaterial({ color: 0x120018, roughness: 0.15, metalness: 0.4, emissive: 0x9b30ff, emissiveIntensity: 0.4 });

const ENEMY_TYPES = {
  grunt: {
    cloth: enemyClothMaterial, helmet: enemyHelmetMaterial, scale: 1,
    speedMult: 1, healthMult: 1, shootRange: 45, shootInterval: [1.3, 2.5],
    scoreValue: 15,
  },
  rusher: {
    cloth: rusherClothMaterial, helmet: rusherHelmetMaterial, scale: 0.92,
    speedMult: 2.3, healthMult: 0.5, meleeOnly: true, meleeRange: 2.0,
    meleeDamage: 10, meleeInterval: 0.9, scoreValue: 22,
  },
  heavy: {
    cloth: heavyClothMaterial, helmet: heavyHelmetMaterial, scale: 1.55,
    speedMult: 0.55, healthMult: 2.4, shootRange: 40, shootInterval: [2.0, 3.0],
    bulletDamageMult: 1.8, scoreValue: 40,
  },
  boss: {
    cloth: bossClothMaterial, helmet: bossHelmetMaterial, scale: 2.6,
    speedMult: 0.7, healthMult: 9, shootRange: 60, shootInterval: [1.0, 1.6],
    pellets: 3, spreadShot: true, bulletDamageMult: 1.5, scoreValue: 250,
  },
};

function spawnEnemy(x, z, health = 40, typeKey = 'grunt') {
  const def = ENEMY_TYPES[typeKey] || ENEMY_TYPES.grunt;
  const {
    bodyGroup: enemy,
    head: enemyHead,
    armLeft: enemyArmLeft,
    armRight: enemyArmRight,
    gun: enemyGun,
    legLeft: enemyLegLeft,
    legRight: enemyLegRight,
  } = createCharacter(
    def.cloth,
    enemySkinMaterial,
    def.helmet,
    new THREE.Vector3(0.25, -0.15, 0.4)
  );
  enemy.gun = enemyGun;
  // keep references to parts for animation
  enemy.parts = {
    armLeft: enemyArmLeft,
    armRight: enemyArmRight,
    legLeft: enemyLegLeft,
    legRight: enemyLegRight,
    head: enemyHead
  };
  enemy.type = typeKey;
  enemy.scale.setScalar(def.scale);
  enemy.speed = (1.2 + Math.random() * 1.6) * def.speedMult;
  enemy.position.set(x, 0, z);
  enemy.health = health * def.healthMult;
  enemy.maxHealth = enemy.health;
  enemy.scoreValue = def.scoreValue;
  enemy.shootTimer = def.meleeOnly ? Infinity : (def.shootInterval[0] + Math.random() * (def.shootInterval[1] - def.shootInterval[0]));
  enemy.meleeTimer = def.meleeInterval || 0;
  enemy.hitRadius = 2.4 * def.scale;
  enemy.headRadius = 1.8 * def.scale;
  enemy.headRadiusAssist = 2.6 * def.scale;
  scene.add(enemy);
  enemies.push(enemy);
}

// Level system — the current level is persisted so quitting and coming back
// (closing the tab, reloading) resumes where the player left off, instead of
// dropping them back to level 1 every time. Dying still resets it to 1 (see
// restartGame()) — only quitting mid-run preserves progress.
let level = parseInt(localStorage.getItem('sniperstrike-level') || '1', 10) || 1;
function saveLevel() {
  localStorage.setItem('sniperstrike-level', String(level));
}
const BASE_ENEMIES = 3;
const ENEMIES_PER_LEVEL = 2;

function clearEnemies() {
  while (enemies.length) {
    const e = enemies.pop();
    if (e) scene.remove(e);
  }
}

function spawnEnemiesForLevel(l) {
  clearEnemies();
  const count = BASE_ENEMIES + (l - 1) * ENEMIES_PER_LEVEL;
  const health = 130 + l * 28; // tougher still — even headshots (no longer instant-kill) take several hits now
  for (let i = 0; i < count; i++) {
    let x, z;
    do {
      const angle = Math.random() * Math.PI * 2;
      const radius = 10 + Math.random() * 36;
      x = Math.round(playerBody.position.x + Math.cos(angle) * radius);
      z = Math.round(playerBody.position.z + Math.sin(angle) * radius);
    } while (
      Math.abs(z - activeRoadBands[0]) < 5 || Math.abs(z - activeRoadBands[1]) < 5 || Math.abs(z - activeRoadBands[2]) < 5 ||
      isInsideMapInterior(x, z)
    );
    let typeKey = 'grunt';
    if (l >= 3) {
      const roll = Math.random();
      if (roll < 0.18) typeKey = 'rusher';
      else if (roll < 0.32) typeKey = 'heavy';
    }
    spawnEnemy(x, z, health, typeKey);
  }

  const isBossLevel = l % 5 === 0;
  if (isBossLevel) {
    let x, z;
    do {
      const angle = Math.random() * Math.PI * 2;
      const radius = 20 + Math.random() * 14;
      x = Math.round(playerBody.position.x + Math.cos(angle) * radius);
      z = Math.round(playerBody.position.z + Math.sin(angle) * radius);
    } while (
      Math.abs(z - activeRoadBands[0]) < 5 || Math.abs(z - activeRoadBands[1]) < 5 || Math.abs(z - activeRoadBands[2]) < 5 ||
      isInsideMapInterior(x, z)
    );
    spawnEnemy(x, z, health * 2, 'boss');
  }

  const levelUI = document.getElementById('level');
  if (levelUI) levelUI.textContent = `Level: ${l}`;
  if (isBossLevel) {
    showMessage(`Level ${l} — BOSS INCOMING`, 2400);
    setTimeout(hideMessage, 2400);
  } else {
    showMessage(`Level ${l} — Clear all enemies`);
    setTimeout(hideMessage, 1400);
  }
  // God descending to heal the congregation is a Metro City-only event — the
  // church and its crying congregants only exist on that map.
  if (currentMapId === 'metro') {
    startDivineHealingEvent();
  }
  spawnPowerupsForLevel();
}

// Church interior bounds used to keep enemies out (nave centered at 0,0 size ~14x20)
function isPointInsideChurch(x, z) {
  // conservative interior bounds (smaller than model extents)
  const xMin = -6.0, xMax = 6.0;
  const zMin = -9.0, zMax = 10.5;
  return x >= xMin && x <= xMax && z >= zMin && z <= zMax;
}

// ---------------------------------------------------------------------------
// Power-ups — glowing pickups scattered around the city each level. Health is
// instant; the rest are timed multipliers applied at the point of use (movement
// speed, bullet damage, fire-rate cooldown) and decayed by updateBuffTimers().
// ---------------------------------------------------------------------------
const POWERUP_TYPES = {
  health: { color: 0x4cff6e, icon: '❤️', label: 'Health' },
  speed: { color: 0x4cc9ff, icon: '⚡', label: 'Speed Boost' },
  damage: { color: 0xff4c4c, icon: '🔥', label: 'Damage Boost' },
  rapidfire: { color: 0xffd24c, icon: '⏱️', label: 'Rapid Fire' },
};
const POWERUP_DURATION = 12;
const powerups = [];
const activeBuffs = {};

function createPowerupMesh(type) {
  const def = POWERUP_TYPES[type];
  const geometry = new THREE.OctahedronGeometry(0.45, 0);
  const material = new THREE.MeshStandardMaterial({
    color: def.color, emissive: def.color, emissiveIntensity: 0.9, roughness: 0.25, metalness: 0.3
  });
  const mesh = new THREE.Mesh(geometry, material);
  mesh.position.y = 1.2;
  mesh.userData.type = type;
  mesh.userData.bobPhase = Math.random() * Math.PI * 2;
  return mesh;
}

function spawnPowerupsForLevel() {
  powerups.forEach((p) => scene.remove(p));
  powerups.length = 0;
  const types = Object.keys(POWERUP_TYPES);
  for (let i = 0; i < 3; i++) {
    let x, z;
    do {
      const angle = Math.random() * Math.PI * 2;
      const radius = 8 + Math.random() * 40;
      x = Math.round(playerBody.position.x + Math.cos(angle) * radius);
      z = Math.round(playerBody.position.z + Math.sin(angle) * radius);
    } while (isInsideMapInterior(x, z));
    const type = types[Math.floor(Math.random() * types.length)];
    const mesh = createPowerupMesh(type);
    mesh.position.x = x;
    mesh.position.z = z;
    scene.add(mesh);
    powerups.push(mesh);
  }
}

function applyPowerup(type) {
  playPickup();
  const def = POWERUP_TYPES[type];
  if (type === 'health') {
    player.health = Math.min(PLAYER_MAX_HEALTH, player.health + 50);
    updateUI();
  } else if (type === 'speed') {
    player.speedMultiplier = 1.7;
    activeBuffs.speed = POWERUP_DURATION;
  } else if (type === 'damage') {
    player.damageMultiplier = 2;
    activeBuffs.damage = POWERUP_DURATION;
  } else if (type === 'rapidfire') {
    player.fireRateMultiplier = 2.2;
    activeBuffs.rapidfire = POWERUP_DURATION;
  }
  spawnFloatingText(def.label.toUpperCase(), playerBody.position, def.color);
  updatePowerupBar();
}

function updatePowerups(dt) {
  for (let i = powerups.length - 1; i >= 0; i--) {
    const p = powerups[i];
    p.rotation.y += dt * 1.5;
    p.position.y = 1.2 + Math.sin(timeAccum * 2 + p.userData.bobPhase) * 0.15;
    if (playerBody.position.distanceTo(p.position) < 1.8) {
      applyPowerup(p.userData.type);
      scene.remove(p);
      powerups.splice(i, 1);
    }
  }
}

function updateBuffTimers(dt) {
  Object.keys(activeBuffs).forEach((key) => {
    activeBuffs[key] -= dt;
    if (activeBuffs[key] <= 0) {
      delete activeBuffs[key];
      if (key === 'speed') player.speedMultiplier = 1;
      if (key === 'damage') player.damageMultiplier = 1;
      if (key === 'rapidfire') player.fireRateMultiplier = 1;
    }
  });
  updatePowerupBar();
}

function updatePowerupBar() {
  powerupBar.innerHTML = '';
  Object.keys(activeBuffs).forEach((key) => {
    const def = POWERUP_TYPES[key];
    const el = document.createElement('div');
    el.className = 'powerup-icon';
    el.textContent = def.icon;
    const timeEl = document.createElement('span');
    timeEl.className = 'powerup-time';
    timeEl.textContent = Math.ceil(activeBuffs[key]);
    el.appendChild(timeEl);
    powerupBar.appendChild(el);
  });
}

// Once-per-level scripted moment: the congregation cries, a divine light descends from
// the sky into the church, heals everyone (tears stop), then ascends back out of view.
function setCongregationCrying(isCrying) {
  // mouthGeometry is a "hill" (frown) by default; rotated 180° it becomes a "valley" (smile).
  const mouthRotation = isCrying ? 0 : Math.PI;
  congregants.forEach((c) => {
    c.tears.forEach((tear) => { tear.visible = isCrying; });
    c.mouth.rotation.z = mouthRotation;
  });
  obispoTears.forEach((tear) => { tear.visible = isCrying; });
  if (obispoMouth) obispoMouth.rotation.z = mouthRotation;
}

// Makes a visible tear slide down the face and loop; resets to the eye when hidden,
// so the next crying spell always starts fresh instead of mid-fall.
function dripTear(tear, dt) {
  if (!tear.visible) {
    tear.position.y = tear.userData.baseY;
    return;
  }
  tear.position.y -= dt * 0.12;
  if (tear.position.y < tear.userData.baseY - tear.userData.dropRange) {
    tear.position.y = tear.userData.baseY;
  }
}

function animateCryingTears(dt) {
  congregants.forEach((c) => c.tears.forEach((tear) => dripTear(tear, dt)));
  obispoTears.forEach((tear) => dripTear(tear, dt));
}

function createDivineLight() {
  const group = new THREE.Group();
  const core = new THREE.Mesh(
    new THREE.SphereGeometry(0.6, 16, 16),
    new THREE.MeshStandardMaterial({ color: 0xfff6d0, emissive: 0xfff2b0, emissiveIntensity: 2.4, roughness: 0.2, metalness: 0 })
  );
  group.add(core);
  const halo = new THREE.Mesh(
    new THREE.TorusGeometry(1.1, 0.06, 8, 24),
    new THREE.MeshStandardMaterial({ color: 0xfff6d0, emissive: 0xfff2b0, emissiveIntensity: 1.6, roughness: 0.3 })
  );
  group.add(halo);
  const glow = new THREE.PointLight(0xfff0c0, 6, 40, 2);
  group.add(glow);
  return group;
}

function startDivineHealingEvent() {
  if (divineEvent) {
    scene.remove(divineEvent.mesh);
  }
  setCongregationCrying(true);
  const mesh = createDivineLight();
  mesh.position.set(0, 60, -6);
  scene.add(mesh);
  divineEvent = {
    phase: 'waiting',
    timer: 0,
    mesh,
    startY: 60,
    targetY: 4.2,
    waitDuration: 1.5,
    descendDuration: 4,
    healDuration: 1.5,
    ascendDuration: 4,
  };
}

function updateDivineEvent(dt) {
  if (!divineEvent) return;
  const e = divineEvent;
  e.timer += dt;
  if (e.phase === 'waiting') {
    if (e.timer >= e.waitDuration) {
      e.phase = 'descending';
      e.timer = 0;
    }
  } else if (e.phase === 'descending') {
    const t = Math.min(e.timer / e.descendDuration, 1);
    e.mesh.position.y = THREE.MathUtils.lerp(e.startY, e.targetY, t);
    if (t >= 1) {
      setCongregationCrying(false);
      playHealChime();
      e.phase = 'healing';
      e.timer = 0;
    }
  } else if (e.phase === 'healing') {
    if (e.timer >= e.healDuration) {
      e.phase = 'ascending';
      e.timer = 0;
    }
  } else if (e.phase === 'ascending') {
    const t = Math.min(e.timer / e.ascendDuration, 1);
    e.mesh.position.y = THREE.MathUtils.lerp(e.targetY, e.startY, t);
    if (t >= 1) {
      scene.remove(e.mesh);
      divineEvent = null;
    }
  }
}

function nextLevel() {
  level += 1;
  saveLevel();
  spawnEnemiesForLevel(level);
  playLevelUp();
  addCoins(20 + level * 5);
}

const bullets = [];
const enemyBullets = [];

const bulletMaterial = new THREE.MeshBasicMaterial({ color: 0xfff57d });
const enemyBulletMaterial = new THREE.MeshBasicMaterial({ color: 0xff5e5e });
const bulletGeometry = new THREE.SphereGeometry(0.12, 8, 8);
const tracerGeometry = new THREE.CylinderGeometry(0.025, 0.06, 1.4, 6);

function createBullet(position, direction, material, speed) {
  const bullet = new THREE.Mesh(bulletGeometry, material);
  bullet.position.copy(position);
  bullet.direction = direction.clone();
  bullet.speed = speed;
  scene.add(bullet);

  // A short glowing streak trailing behind the bullet. It's a child of the bullet mesh,
  // so it rides along automatically and gets cleaned up the moment the bullet is removed.
  const tracer = new THREE.Mesh(tracerGeometry, new THREE.MeshBasicMaterial({
    color: material.color, transparent: true, opacity: 0.55, depthWrite: false
  }));
  tracer.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), bullet.direction);
  tracer.position.copy(bullet.direction).multiplyScalar(-0.75);
  bullet.add(tracer);

  return bullet;
}

// ---------------------------------------------------------------------------
// Combat juice — muzzle flashes, impact/death particle bursts, floating combat
// text, and camera screen-shake. All driven by updateEffects(dt) in animate().
// ---------------------------------------------------------------------------
const muzzleFlashMaterial = new THREE.SpriteMaterial({
  color: 0xfff3b0, transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false
});

function spawnMuzzleFlash(position, direction) {
  const sprite = new THREE.Sprite(muzzleFlashMaterial);
  sprite.scale.set(0.45, 0.45, 0.45);
  sprite.position.copy(position).addScaledVector(direction, 0.15);
  scene.add(sprite);
  setTimeout(() => scene.remove(sprite), 55);
}

const particleGeometry = new THREE.BoxGeometry(0.08, 0.08, 0.08);
const activeParticles = [];

function spawnImpactParticles(position, color, count) {
  const material = new THREE.MeshBasicMaterial({ color, transparent: true });
  for (let i = 0; i < count; i++) {
    const particle = new THREE.Mesh(particleGeometry, material.clone());
    particle.position.copy(position);
    const speed = 2 + Math.random() * 4;
    const velocity = new THREE.Vector3(
      (Math.random() - 0.5) * 2,
      Math.random() * 2,
      (Math.random() - 0.5) * 2
    ).normalize().multiplyScalar(speed);
    scene.add(particle);
    activeParticles.push({ mesh: particle, velocity, life: 0, maxLife: 0.35 + Math.random() * 0.15 });
  }
}

function spawnDeathBurst(position) {
  spawnImpactParticles(position.clone().add(new THREE.Vector3(0, 1.1, 0)), 0xff5a3c, 20);
}

function updateParticles(dt) {
  for (let i = activeParticles.length - 1; i >= 0; i--) {
    const p = activeParticles[i];
    p.life += dt;
    if (p.life >= p.maxLife) {
      scene.remove(p.mesh);
      activeParticles.splice(i, 1);
      continue;
    }
    p.velocity.y -= 9 * dt;
    p.mesh.position.addScaledVector(p.velocity, dt);
    p.mesh.material.opacity = 1 - p.life / p.maxLife;
  }
}

function createCombatTextTexture(text, color) {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 64;
  const ctx = canvas.getContext('2d');
  ctx.font = 'bold 40px Arial';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = color;
  ctx.fillText(text, 128, 32);
  const texture = new THREE.CanvasTexture(canvas);
  texture.minFilter = THREE.LinearFilter;
  return texture;
}

const activeFloatingTexts = [];
const activeSpeechBubbles = [];

function spawnFloatingText(text, position, color) {
  const texture = createCombatTextTexture(text, `#${color.toString(16).padStart(6, '0')}`);
  const material = new THREE.SpriteMaterial({ map: texture, transparent: true, depthWrite: false });
  const sprite = new THREE.Sprite(material);
  sprite.scale.set(1.6, 0.4, 1);
  sprite.position.copy(position).add(new THREE.Vector3(0, 0.6, 0));
  scene.add(sprite);
  activeFloatingTexts.push({ sprite, life: 0, maxLife: 1 });
}

function updateFloatingTexts(dt) {
  for (let i = activeFloatingTexts.length - 1; i >= 0; i--) {
    const f = activeFloatingTexts[i];
    f.life += dt;
    if (f.life >= f.maxLife) {
      scene.remove(f.sprite);
      f.sprite.material.map.dispose();
      activeFloatingTexts.splice(i, 1);
      continue;
    }
    f.sprite.position.y += dt * 0.8;
    f.sprite.material.opacity = 1 - f.life / f.maxLife;
  }
}

let screenShake = { timer: 0, magnitude: 0 };
function triggerScreenShake(duration, magnitude) {
  screenShake = { timer: duration, magnitude };
}
function getScreenShakeOffset(dt) {
  if (screenShake.timer <= 0) return null;
  screenShake.timer = Math.max(0, screenShake.timer - dt);
  const m = screenShake.magnitude * (screenShake.timer > 0 ? 1 : 0);
  return new THREE.Vector3((Math.random() - 0.5) * m * 0.02, (Math.random() - 0.5) * m * 0.02, 0);
}

function updateEffects(dt) {
  updateParticles(dt);
  updateFloatingTexts(dt);
  updateSpeechBubbles(dt);
  updatePowerups(dt);
  updateBuffTimers(dt);
  updateCooldownBar();
  updateBossBar();
}

// Raycaster and mouse helpers for desktop aiming
const raycaster = new THREE.Raycaster();
const mouse = new THREE.Vector2();

function getInteractableAtScreen(clientX, clientY) {
  mouse.x = (clientX / window.innerWidth) * 2 - 1;
  mouse.y = -(clientY / window.innerHeight) * 2 + 1;
  raycaster.setFromCamera(mouse, camera);
  const hits = raycaster.intersectObjects(interactableObjects, true);
  return hits.length > 0 ? hits[0] : null;
}

// Direction from the gun muzzle to wherever the player clicked on screen — used only
// for aiming the bullet itself, so it never touches aimRotation/camera/body turning.
function getBulletDirectionFromScreen(clientX, clientY) {
  mouse.x = (clientX / window.innerWidth) * 2 - 1;
  mouse.y = -(clientY / window.innerHeight) * 2 + 1;
  raycaster.setFromCamera(mouse, camera);

  const origin = playerGun?.muzzle ? playerGun.muzzle.getWorldPosition(new THREE.Vector3()) : playerBody.position;

  const hitEnemies = raycaster.intersectObjects(enemies, true);
  if (hitEnemies.length > 0) {
    return hitEnemies[0].point.clone().sub(origin).normalize();
  }

  const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
  const point = new THREE.Vector3();
  if (raycaster.ray.intersectPlane(plane, point)) {
    return point.clone().sub(origin).normalize();
  }

  return raycaster.ray.direction.clone();
}

function findAncestorWithName(object, name) {
  let current = object;
  while (current) {
    if (current.name === name) return current;
    current = current.parent;
  }
  return null;
}

const obispoBonanoFacts = [
  'I am Obispo Bonano. The arena was built from old downtown blocks.',
  'Enemy waves get faster after each level in this city shooter.',
  'Headshots restore health and are your best chance to survive.',
  'The church is a safe landmark. Come inside to read more about the game.',
  'Keep moving through the streets—standing still makes you easy prey.'
];

function talkToObispo() {
  const fact = obispoBonanoFacts[Math.floor(Math.random() * obispoBonanoFacts.length)];
  showMessage(`Obispo Bonano:\n${fact}`, 5000);
}

const keyState = {};
let pointerLocked = false;
let aimRotation = { x: 0, y: 0 };
let isMobile = false;
let gameStarted = false;
let isRestarting = false;
let isShooting = false;
// Tracks the live cursor position so every shot — the initial click AND each
// follow-up shot while the button is held for automatic weapons — aims at
// wherever the cursor actually is, not just wherever it was on mousedown.
let lastAimClientX = window.innerWidth / 2;
let lastAimClientY = window.innerHeight / 2;


const overlay = document.getElementById('overlay');
const startScreen = document.getElementById('start-screen');
const startButton = document.getElementById('start-button');
const mapPickerScreen = document.getElementById('map-picker-screen');
const mapPickerGrid = document.getElementById('map-picker-grid');
const mapPickerTimerFill = document.getElementById('map-picker-timer-fill');
const mapPickerTimerLabel = document.getElementById('map-picker-timer-label');
const healthUI = document.getElementById('health');
const scoreUI = document.getElementById('score');
const status = document.getElementById('status');
const message = document.getElementById('message');
const touchControls = document.getElementById('touch-controls');
const minimapCanvas = document.getElementById('minimap-canvas');
const minimapCtx = minimapCanvas ? minimapCanvas.getContext('2d') : null;
const muteButton = document.getElementById('mute-button');
const killstreakUI = document.getElementById('killstreak');
const powerupBar = document.getElementById('powerup-bar');
const damageFlashEl = document.getElementById('damage-flash');
const cooldownFillEl = document.getElementById('cooldown-fill');
const bossBarEl = document.getElementById('boss-bar');
const bossBarFillEl = document.getElementById('boss-bar-fill');
const bossBarLabelEl = document.getElementById('boss-bar-label');
let messageTimeoutId = null;

muteButton.textContent = audioMuted ? '🔇' : '🔊';
muteButton.addEventListener('click', () => {
  setAudioMuted(!audioMuted);
  muteButton.textContent = audioMuted ? '🔇' : '🔊';
});

vipToggleButton.addEventListener('click', () => toggleVipGiantMode());
updateVipToggleButton();

updateCoinsUI();
weaponUI.textContent = `Weapon: ${player.weapon.name}`;

const emoteButton = document.getElementById('emote-button');
const emoteFlyout = document.getElementById('emote-flyout');

function renderEmoteFlyout() {
  emoteFlyout.innerHTML = '';
  if (inventory.emotes.length === 0) {
    const empty = document.createElement('div');
    empty.className = 'emote-flyout-empty';
    empty.textContent = 'No emotes owned — buy some in the Armory.';
    emoteFlyout.appendChild(empty);
    return;
  }
  inventory.emotes.forEach((key) => {
    const def = EMOTE_DEFS[key];
    if (!def) return;
    const btn = document.createElement('button');
    btn.className = 'emote-flyout-item';
    btn.textContent = def.name;
    btn.addEventListener('click', () => {
      triggerEmote(key);
      emoteFlyout.classList.add('hidden');
    });
    emoteFlyout.appendChild(btn);
  });
}

emoteButton.addEventListener('click', (event) => {
  event.stopPropagation();
  const willShow = emoteFlyout.classList.contains('hidden');
  if (willShow) renderEmoteFlyout();
  emoteFlyout.classList.toggle('hidden', !willShow);
});
document.addEventListener('click', (event) => {
  if (!emoteFlyout.classList.contains('hidden') && !emoteFlyout.contains(event.target) && event.target !== emoteButton) {
    emoteFlyout.classList.add('hidden');
  }
});

// ---------------------------------------------------------------------------
// Armory — the home-menu shop. Each category (weapons/skins/clothes/armor/
// emotes/vip) registers a renderer into ARMORY_TAB_RENDERERS that fills
// #armory-grid with cards built via createArmoryCard().
// ---------------------------------------------------------------------------
const armoryScreen = document.getElementById('armory-screen');
const armoryButton = document.getElementById('armory-button');
const armoryCloseButton = document.getElementById('armory-close');
const armoryCoinsEl = document.getElementById('armory-coins');
const armoryTitleEl = document.getElementById('armory-title');
const armoryTabButtons = document.querySelectorAll('.armory-tab');
const armoryGrid = document.getElementById('armory-grid');

let activeArmoryTab = 'weapons';
let armoryOpen = false;
let armoryTabFilter = null; // null = show all tabs (start-screen access); array = store-restricted
let currentStore = null; // the store object that opened the Armory, if any
const ARMORY_TAB_RENDERERS = {};

// Shows only the tabs in `allowedTabs` (null/undefined shows all). Falls back
// to the first allowed tab if the currently active one isn't in the filtered set.
function setArmoryTabFilter(allowedTabs) {
  armoryTabFilter = allowedTabs || null;
  armoryTabButtons.forEach((btn) => {
    const allowed = !armoryTabFilter || armoryTabFilter.includes(btn.dataset.tab);
    btn.classList.toggle('hidden', !allowed);
  });
  if (armoryTabFilter && !armoryTabFilter.includes(activeArmoryTab)) {
    activeArmoryTab = armoryTabFilter[0];
  }
}

function updateArmoryCoinsUI() {
  if (armoryCoinsEl) armoryCoinsEl.textContent = `Coins: ${coins}`;
  updateCoinsUI();
}

function createArmoryCard({ name, price, owned, equipped, disabled, actionText, onAction, onSelect }) {
  const card = document.createElement('div');
  card.className = 'armory-card' + (equipped ? ' selected' : '');
  const nameEl = document.createElement('div');
  nameEl.className = 'armory-card-name';
  nameEl.textContent = name;
  card.appendChild(nameEl);
  const priceEl = document.createElement('div');
  priceEl.className = 'armory-card-price';
  priceEl.textContent = owned ? (equipped ? 'Equipped' : 'Owned') : `${price} coins`;
  card.appendChild(priceEl);
  const actionBtn = document.createElement('button');
  actionBtn.className = 'armory-card-action' + (equipped ? ' equipped' : owned ? ' owned' : '');
  actionBtn.textContent = actionText || (equipped ? 'Equipped' : owned ? 'Equip' : 'Buy');
  if (disabled) actionBtn.disabled = true;
  actionBtn.addEventListener('click', (event) => {
    event.stopPropagation();
    onAction();
  });
  card.appendChild(actionBtn);
  if (onSelect) card.addEventListener('click', onSelect);
  return card;
}

function renderArmoryTab(tab) {
  armoryGrid.innerHTML = '';
  const renderer = ARMORY_TAB_RENDERERS[tab];
  if (renderer) {
    renderer();
  } else {
    const empty = document.createElement('div');
    empty.textContent = 'Coming soon';
    empty.style.opacity = '0.6';
    armoryGrid.appendChild(empty);
  }
  if (typeof updatePreviewForTab === 'function') updatePreviewForTab(tab);
}

function setActiveArmoryTab(tab) {
  activeArmoryTab = tab;
  armoryTabButtons.forEach((btn) => btn.classList.toggle('active', btn.dataset.tab === tab));
  renderArmoryTab(tab);
}

// `store` is the store registry entry that triggered entry, or null when
// opened from the start screen (full, unrestricted catalog).
function openArmory(store = null) {
  currentStore = store;
  armoryOpen = true;
  player.velocity.set(0, 0, 0);
  setArmoryTabFilter(store ? store.tabs : null);
  armoryTitleEl.textContent = store ? store.label : 'Armory';
  armoryScreen.classList.remove('hidden');
  updateArmoryCoinsUI();
  setActiveArmoryTab(activeArmoryTab);
  if (typeof startPreviewLoop === 'function') startPreviewLoop();
}

function closeArmory() {
  armoryOpen = false;
  armoryScreen.classList.add('hidden');
  if (typeof stopPreviewLoop === 'function') stopPreviewLoop();
  // If the player manually closed the shop while still standing inside the
  // store, suppress re-opening until they actually step out and back in.
  if (currentStore) suppressStoreId = currentStore;
  currentStore = null;
}

armoryButton.addEventListener('click', () => openArmory(null));
armoryCloseButton.addEventListener('click', closeArmory);
armoryTabButtons.forEach((btn) => {
  btn.addEventListener('click', () => setActiveArmoryTab(btn.dataset.tab));
});

// ---------------------------------------------------------------------------
// Store entry/exit — edge-triggered so walking in opens the Armory exactly
// once per visit, and walking back out closes it automatically. Only runs
// while the Armory isn't already open (the player can't move while shopping
// anyway, so there's nothing new to detect mid-shop).
// ---------------------------------------------------------------------------
let playerInsideStore = null;
let suppressStoreId = null;

function findStoreContaining(x, z) {
  // Inset must clear the distance the player can rest at against a solid wall
  // (wall half-thickness + player radius) plus a margin, or merely bumping into
  // a windowless wall (no door) would falsely register as "stepped inside."
  const PLAYER_RADIUS = 0.6;
  for (let i = 0; i < stores.length; i++) {
    const s = stores[i];
    const inset = s.wallThickness / 2 + PLAYER_RADIUS + 0.3;
    if (
      x > s.x - s.halfW + inset && x < s.x + s.halfW - inset &&
      z > s.z - s.halfD + inset && z < s.z + s.halfD - inset
    ) {
      return s;
    }
  }
  return null;
}

function updateStoreTriggers() {
  const store = findStoreContaining(playerBody.position.x, playerBody.position.z);
  if (store !== playerInsideStore) {
    if (store === null) {
      // Walked out — clear the suppression and auto-close if this store opened the shop.
      if (suppressStoreId === playerInsideStore) suppressStoreId = null;
      if (armoryOpen && currentStore === playerInsideStore) closeArmory();
    } else if (store !== suppressStoreId) {
      openArmory(store);
    }
    playerInsideStore = store;
  }
}

ARMORY_TAB_RENDERERS.weapons = function renderWeaponsTab() {
  Object.entries(WEAPON_DEFS).forEach(([key, def]) => {
    if (def.vipOnly) return;
    const owned = inventory.weapons.includes(key);
    const isEquipped = equipped.weapon === key;
    const card = createArmoryCard({
      name: def.name,
      price: def.price,
      owned,
      equipped: isEquipped,
      disabled: isEquipped || (!owned && coins < def.price),
      onAction: () => {
        if (!owned) {
          if (!spendCoins(def.price)) return;
          inventory.weapons.push(key);
          saveInventory();
        }
        if (!inventory.vip) {
          equipped.weapon = key;
          saveEquipped();
          setPlayerWeapon(key);
        }
        renderArmoryTab('weapons');
      },
      onSelect: () => setPreviewGun(() => def.build(getEquippedGunMaterials())),
    });
    armoryGrid.appendChild(card);
  });
};

ARMORY_TAB_RENDERERS.skins = function renderSkinsTab() {
  const currentWeaponDef = WEAPON_DEFS[equipped.weapon] || WEAPON_DEFS.sniper;
  Object.entries(SKIN_DEFS).forEach(([key, def]) => {
    if (def.vipOnly) return;
    const owned = inventory.skins.includes(key);
    const isEquipped = equipped.skin === key;
    const card = createArmoryCard({
      name: def.name,
      price: def.price,
      owned,
      equipped: isEquipped,
      disabled: isEquipped || (!owned && coins < def.price),
      onAction: () => {
        if (!owned) {
          if (!spendCoins(def.price)) return;
          inventory.skins.push(key);
          saveInventory();
        }
        equipped.skin = key;
        saveEquipped();
        rebuildGunVisual(playerGun, () => currentWeaponDef.build(getEquippedGunMaterials()));
        renderArmoryTab('skins');
      },
      onSelect: () => setPreviewGun(() => currentWeaponDef.build(getGunMaterialsForSkin(key))),
    });
    armoryGrid.appendChild(card);
  });
};

ARMORY_TAB_RENDERERS.clothes = function renderClothesTab() {
  Object.entries(CLOTHES_DEFS).forEach(([key, def]) => {
    const owned = inventory.clothes.includes(key);
    const isEquipped = equipped.clothes === key;
    const card = createArmoryCard({
      name: def.name,
      price: def.price,
      owned,
      equipped: isEquipped,
      disabled: isEquipped || (!owned && coins < def.price),
      onAction: () => {
        if (!owned) {
          if (!spendCoins(def.price)) return;
          inventory.clothes.push(key);
          saveInventory();
        }
        equipped.clothes = key;
        saveEquipped();
        playerCloth.color.set(def.color);
        applyClothesMaterialStyle(playerCloth, key);
        applyClothesAccessories(playerClothesAccessoryState, playerBody, playerHead, key);
        renderArmoryTab('clothes');
      },
      onSelect: () => setPreviewClothesStyle(key),
    });
    armoryGrid.appendChild(card);
  });
};

ARMORY_TAB_RENDERERS.armor = function renderArmorTab() {
  Object.entries(ARMOR_DEFS).forEach(([key, def]) => {
    if (def.vipOnly) return;
    const owned = inventory.armor.includes(key);
    const isEquipped = equipped.armor === key;
    const card = createArmoryCard({
      name: `${def.name} (${Math.round(def.reduction * 100)}% reduction)`,
      price: def.price,
      owned,
      equipped: isEquipped,
      disabled: isEquipped || (!owned && coins < def.price),
      onAction: () => {
        if (!owned) {
          if (!spendCoins(def.price)) return;
          inventory.armor.push(key);
          saveInventory();
        }
        equipped.armor = key;
        saveEquipped();
        applyPlayerArmor(key);
        renderArmoryTab('armor');
      },
      onSelect: () => setPreviewArmor(() => buildArmorMesh(key)),
    });
    armoryGrid.appendChild(card);
  });
};

ARMORY_TAB_RENDERERS.emotes = function renderEmotesTab() {
  Object.entries(EMOTE_DEFS).forEach(([key, def]) => {
    if (def.vipOnly) return;
    const owned = inventory.emotes.includes(key);
    const card = createArmoryCard({
      name: def.name,
      price: def.price,
      owned,
      equipped: false,
      disabled: owned || coins < def.price,
      actionText: owned ? 'Owned' : 'Buy',
      onAction: () => {
        if (owned) return;
        if (!spendCoins(def.price)) return;
        inventory.emotes.push(key);
        saveInventory();
        renderArmoryTab('emotes');
      },
      onSelect: () => setPreviewEmote(key),
    });
    armoryGrid.appendChild(card);
  });
};

ARMORY_TAB_RENDERERS.vip = function renderVipTab() {
  const owned = inventory.vip;
  const card = createArmoryCard({
    name: 'Ultimate VIP Pass — Giant + Minigun',
    price: VIP_PRICE,
    owned,
    equipped: owned && vipGiantMode,
    disabled: !owned && coins < VIP_PRICE,
    actionText: owned ? (vipGiantMode ? 'Switch to Normal' : 'Switch to Giant') : 'Buy',
    onAction: () => {
      if (!owned) {
        if (!spendCoins(VIP_PRICE)) return;
        inventory.vip = true;
        saveInventory();
        setVipGiantMode(true);
        showMessage('VIP ACTIVATED — YOU ARE NOW A GIANT', 2600);
      } else {
        toggleVipGiantMode();
      }
      renderArmoryTab('vip');
    },
    onSelect: () => {},
  });
  const note = document.createElement('div');
  note.style.gridColumn = '1 / -1';
  note.style.opacity = '0.75';
  note.style.fontSize = '0.85rem';
  note.textContent = 'Permanent, one-time purchase. Once owned, switch between giant-minigun mode and your normal loadout anytime — here, with the HUD button, or by pressing G in-game.';
  armoryGrid.appendChild(card);
  armoryGrid.appendChild(note);

  // VIP-exclusive cosmetics — only purchasable once the pass itself is owned.
  const skinDef = SKIN_DEFS.goldenMinigun;
  const skinOwned = inventory.skins.includes('goldenMinigun');
  const skinEquipped = equipped.skin === 'goldenMinigun';
  const skinCard = createArmoryCard({
    name: skinDef.name,
    price: skinDef.price,
    owned: skinOwned,
    equipped: skinEquipped,
    disabled: !inventory.vip || skinEquipped || (!skinOwned && coins < skinDef.price),
    actionText: !inventory.vip ? 'Requires VIP' : undefined,
    onAction: () => {
      if (!inventory.vip) return;
      if (!skinOwned) {
        if (!spendCoins(skinDef.price)) return;
        inventory.skins.push('goldenMinigun');
        saveInventory();
      }
      equipped.skin = 'goldenMinigun';
      saveEquipped();
      rebuildGunVisual(playerGun, () => WEAPON_DEFS.minigun.build(getEquippedGunMaterials()));
      renderArmoryTab('vip');
    },
    onSelect: () => setPreviewGun(() => createMinigun(getGunMaterialsForSkin('goldenMinigun'))),
  });
  armoryGrid.appendChild(skinCard);

  const goldArmorDef = ARMOR_DEFS.karat24;
  const goldArmorOwned = inventory.armor.includes('karat24');
  const goldArmorEquipped = equipped.armor === 'karat24';
  const goldArmorCard = createArmoryCard({
    name: '24K Gold Armor — Reflects ALL Bullets',
    price: goldArmorDef.price,
    owned: goldArmorOwned,
    equipped: goldArmorEquipped,
    disabled: !inventory.vip || goldArmorEquipped || (!goldArmorOwned && coins < goldArmorDef.price),
    actionText: !inventory.vip ? 'Requires VIP' : undefined,
    onAction: () => {
      if (!inventory.vip) return;
      if (!goldArmorOwned) {
        if (!spendCoins(goldArmorDef.price)) return;
        inventory.armor.push('karat24');
        saveInventory();
      }
      equipped.armor = 'karat24';
      saveEquipped();
      applyPlayerArmor('karat24');
      renderArmoryTab('vip');
    },
    onSelect: () => setPreviewArmor(() => buildArmorMesh('karat24')),
  });
  armoryGrid.appendChild(goldArmorCard);

  const emoteDef = EMOTE_DEFS.titanroar;
  const emoteOwned = inventory.emotes.includes('titanroar');
  const emoteCard = createArmoryCard({
    name: emoteDef.name,
    price: emoteDef.price,
    owned: emoteOwned,
    equipped: false,
    disabled: !inventory.vip || emoteOwned || coins < emoteDef.price,
    actionText: !inventory.vip ? 'Requires VIP' : (emoteOwned ? 'Owned' : 'Buy'),
    onAction: () => {
      if (!inventory.vip || emoteOwned) return;
      if (!spendCoins(emoteDef.price)) return;
      inventory.emotes.push('titanroar');
      saveInventory();
      renderArmoryTab('vip');
    },
    onSelect: () => setPreviewEmote('titanroar'),
  });
  armoryGrid.appendChild(emoteCard);
};

function triggerDamageFlash() {
  damageFlashEl.classList.add('active');
  requestAnimationFrame(() => {
    damageFlashEl.classList.remove('active');
  });
}

function updateUI() {
  healthUI.textContent = `Health: ${Math.max(0, Math.round(player.health))}`;
  scoreUI.textContent = `Score: ${player.score}`;
  if (player.health <= 0 && !isRestarting) {
    status.textContent = 'Game Over';
    showMessage('Game Over\nRestarting...', 2500);
    restartGame();
  }
}

function showMessage(text, duration = 1400) {
  if (messageTimeoutId) {
    clearTimeout(messageTimeoutId);
    messageTimeoutId = null;
  }
  message.textContent = text;
  message.classList.remove('hidden');
  if (duration > 0) {
    messageTimeoutId = setTimeout(() => {
      hideMessage();
    }, duration);
  }
}

function hideMessage() {
  message.classList.add('hidden');
  if (messageTimeoutId) {
    clearTimeout(messageTimeoutId);
    messageTimeoutId = null;
  }
}

function restartGame() {
  isRestarting = true;
  gameStarted = false;
  clearEnemies();
  bullets.forEach((b) => scene.remove(b));
  bullets.length = 0;
  enemyBullets.forEach((b) => scene.remove(b));
  enemyBullets.length = 0;
  level = 1;
  saveLevel();
  player.health = PLAYER_MAX_HEALTH;
  player.score = 0;
  player.canShoot = true;
  player.direction.set(0, 0, 0);
  player.velocity.set(0, 0, 0);
  playerBody.position.set(0, 1.4, 2);
  scoreUI.textContent = `Score: ${player.score}`;
  resetKillStreak();
  player.speedMultiplier = 1;
  player.damageMultiplier = 1;
  player.fireRateMultiplier = 1;
  Object.keys(activeBuffs).forEach((key) => delete activeBuffs[key]);
  updatePowerupBar();
  applyVipState();
  weaponUI.textContent = `Weapon: ${player.weapon.name}`;
  updateUI();
  setTimeout(() => {
    isRestarting = false;
    showMapPicker();
  }, 1800);
}

// ---------------------------------------------------------------------------
// Map picker — shown both on first launch and after every restart (including
// death), per the standing requirement that the map choice is never
// remembered between rounds. A 30s countdown auto-deploys a random map if
// the player doesn't pick one in time.
// ---------------------------------------------------------------------------
const MAP_BLURBS = {
  metro: 'A dense city block with a cathedral, shops, and traffic.',
  vatican: 'A grand cathedral, full congregation, and a piazza of pilgrim shops.',
  westworld: 'A dusty frontier main street lined with saloons and false fronts.',
  mansion: 'A marble grid of interconnected rooms to get lost in, ringed by hedges.',
  desert: 'Rolling dunes, rock formations, and a palm-lined oasis.',
  arctic: 'A snowbound research station ringed by ice formations and igloos.',
  spacestation: 'A starlit station deck with cargo containers and asteroids.',
  jungle: 'An ancient stepped ziggurat lost in dense jungle ruins.',
  subway: 'A sealed underground tunnel lined with parked trains.',
  volcano: 'A smoldering volcanic island with a tiki village and lava flows.',
};

const MAP_PICKER_SECONDS = 30;
let mapPickerTimerInterval = null;

function createMapCard(mapId, def) {
  const card = document.createElement('div');
  card.className = 'map-card';

  const name = document.createElement('div');
  name.className = 'map-card-name';
  name.textContent = def.label;
  card.appendChild(name);

  const blurb = document.createElement('div');
  blurb.className = 'map-card-blurb';
  blurb.textContent = MAP_BLURBS[mapId] || '';
  card.appendChild(blurb);

  const action = document.createElement('button');
  action.className = 'map-card-action';
  action.textContent = 'Deploy';
  card.appendChild(action);

  const pick = () => selectMapAndStart(mapId);
  card.addEventListener('click', pick);
  action.addEventListener('click', (e) => { e.stopPropagation(); pick(); });
  return card;
}

function showMapPicker() {
  startScreen.classList.add('hidden');
  startScreen.style.display = 'none';

  mapPickerGrid.innerHTML = '';
  Object.keys(MAPS).forEach((mapId) => {
    mapPickerGrid.appendChild(createMapCard(mapId, MAPS[mapId]));
  });
  mapPickerScreen.classList.remove('hidden');

  mapPickerTimerLabel.textContent = String(MAP_PICKER_SECONDS);
  mapPickerTimerFill.style.width = '100%';
  mapPickerTimerFill.classList.remove('urgent');
  if (mapPickerTimerInterval) clearInterval(mapPickerTimerInterval);
  // Driven by elapsed wall-clock time (not a tick counter) so a busy main
  // thread — the render loop keeps drawing the backdrop map behind this
  // modal — can never make the 30s deadline drift later than it should;
  // whichever tick actually runs next just catches up to the real elapsed time.
  const pickerStartTime = performance.now();
  mapPickerTimerInterval = setInterval(() => {
    const elapsedSeconds = (performance.now() - pickerStartTime) / 1000;
    const secondsLeft = Math.max(0, Math.ceil(MAP_PICKER_SECONDS - elapsedSeconds));
    mapPickerTimerLabel.textContent = String(secondsLeft);
    mapPickerTimerFill.style.width = `${Math.max(0, (secondsLeft / MAP_PICKER_SECONDS) * 100)}%`;
    if (secondsLeft <= 10) mapPickerTimerFill.classList.add('urgent');
    if (elapsedSeconds >= MAP_PICKER_SECONDS) {
      clearInterval(mapPickerTimerInterval);
      mapPickerTimerInterval = null;
      const ids = Object.keys(MAPS);
      selectMapAndStart(ids[Math.floor(Math.random() * ids.length)]);
    }
  }, 250);
}

function selectMapAndStart(mapId) {
  if (mapPickerTimerInterval) {
    clearInterval(mapPickerTimerInterval);
    mapPickerTimerInterval = null;
  }
  mapPickerScreen.classList.add('hidden');
  loadMap(mapId);
  startGame();
}

function startGame() {
  if (gameStarted) return;
  gameStarted = true;
  resumeAudio();
  startAmbientDrone();
  startScreen.classList.add('hidden');
  startScreen.style.display = 'none';
  hideMessage();
  touchControls.classList.toggle('hidden', !isMobile);
  status.textContent = isMobile
    ? 'Use touch controls to move, drag to aim, and shoot with the button.'
    : 'Click and drag to aim, WASD to move, click/Space/F to shoot.';
  overlay.style.pointerEvents = 'none';
  overlay.style.opacity = '1';
  try {
    spawnEnemiesForLevel(level);
  } catch (err) {
    console.error('Error during spawnEnemiesForLevel:', err);
    showMessage('Error starting game: ' + (err && err.message ? err.message : String(err)));
    gameStarted = false;
  }
}

function onResize() {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
}

window.addEventListener('resize', onResize);

function handleControls() {
  player.direction.set(0, 0, 0);
  if (keyState['KeyW'] || keyState['ArrowUp'] || keyState['moveForward']) {
    player.direction.z += 1;
  }
  if (keyState['KeyS'] || keyState['ArrowDown'] || keyState['moveBack']) {
    player.direction.z -= 1;
  }
  // Left/Right keys rotate the player's facing instead of strafing
  const turnSpeed = 3.2; // radians per second
  if (keyState['KeyA'] || keyState['ArrowLeft'] || keyState['moveLeft']) {
    aimRotation.y += turnSpeed * deltaTime;
  }
  if (keyState['KeyD'] || keyState['ArrowRight'] || keyState['moveRight']) {
    aimRotation.y -= turnSpeed * deltaTime;
  }
  player.direction.normalize();
  // Use the player's facing (aimRotation.y) as forward so movement turns with the player
  const forward = new THREE.Vector3(Math.sin(aimRotation.y), 0, Math.cos(aimRotation.y)).normalize();
  const right = new THREE.Vector3().crossVectors(new THREE.Vector3(0, 1, 0), forward);

  player.velocity.copy(forward).multiplyScalar(player.direction.z * player.speed * player.speedMultiplier);

  const playerRadius = 0.6;
  const moveX = player.velocity.x * deltaTime;
  const moveZ = player.velocity.z * deltaTime;
  // Sub-step the movement so a slow/hitched frame (large deltaTime) can't move the
  // player further than a wall's thickness in one go and tunnel straight through it.
  const moveDist = Math.hypot(moveX, moveZ);
  const maxStep = 0.15;
  const steps = Math.max(1, Math.ceil(moveDist / maxStep));
  const stepX = moveX / steps;
  const stepZ = moveZ / steps;
  for (let i = 0; i < steps; i++) {
    if (!collidesWithWalls(playerBody.position.x + stepX, playerBody.position.z, playerRadius)) {
      playerBody.position.x += stepX;
    }
    if (!collidesWithWalls(playerBody.position.x, playerBody.position.z + stepZ, playerRadius)) {
      playerBody.position.z += stepZ;
    }
  }

  playerBody.position.x = THREE.MathUtils.clamp(playerBody.position.x, -MAP_RADIUS + 4, MAP_RADIUS - 4);
  playerBody.position.z = THREE.MathUtils.clamp(playerBody.position.z, -MAP_RADIUS + 4, MAP_RADIUS - 4);
}

function applySpread(direction, spread) {
  if (!spread) return direction.clone();
  return direction.clone().add(new THREE.Vector3(
    (Math.random() - 0.5) * spread,
    (Math.random() - 0.5) * spread,
    (Math.random() - 0.5) * spread
  )).normalize();
}

function spawnPlayerBullet(directionOverride = null) {
  if (!player.canShoot || player.health <= 0) return;
  const weapon = player.weapon;
  let baseDirection;
  if (directionOverride) {
    baseDirection = directionOverride.clone().normalize();
  } else if (playerGun?.muzzle) {
    baseDirection = playerGun.muzzle.getWorldDirection(new THREE.Vector3()).normalize();
  } else {
    baseDirection = new THREE.Vector3(
      Math.sin(aimRotation.y),
      Math.sin(aimRotation.x),
      Math.cos(aimRotation.y)
    ).normalize();
  }
  const origin = playerGun.muzzle ? playerGun.muzzle.getWorldPosition(new THREE.Vector3()) : playerBody.position.clone().add(baseDirection.clone().multiplyScalar(1.2));
  for (let i = 0; i < weapon.pellets; i++) {
    const direction = applySpread(baseDirection, weapon.spread);
    const bullet = createBullet(origin, direction, bulletMaterial, weapon.speed);
    bullet.damage = weapon.damage * player.damageMultiplier;
    bullet.splashRadius = weapon.splashRadius || 0;
    bullets.push(bullet);
  }
  player.canShoot = false;
  playGunshot();
  spawnMuzzleFlash(origin, baseDirection);
  const cooldownSeconds = weapon.cooldown / player.fireRateMultiplier / 1000;
  player.cooldownStart = timeAccum;
  player.cooldownTotal = cooldownSeconds;
  setTimeout(() => { player.canShoot = true; }, weapon.cooldown / player.fireRateMultiplier);
}

function updateCooldownBar() {
  if (!cooldownFillEl) return;
  if (player.canShoot || !player.cooldownTotal) {
    cooldownFillEl.style.width = '100%';
    return;
  }
  const elapsed = timeAccum - player.cooldownStart;
  const progress = THREE.MathUtils.clamp(elapsed / player.cooldownTotal, 0, 1);
  cooldownFillEl.style.width = `${progress * 100}%`;
}

function updateBossBar() {
  if (!bossBarEl) return;
  const boss = enemies.find((e) => e.type === 'boss');
  if (!boss) {
    bossBarEl.classList.add('hidden');
    return;
  }
  bossBarEl.classList.remove('hidden');
  const ratio = THREE.MathUtils.clamp(boss.health / boss.maxHealth, 0, 1);
  bossBarFillEl.style.width = `${ratio * 100}%`;
  if (bossBarLabelEl) {
    bossBarLabelEl.textContent = `BOSS — ${Math.max(0, Math.ceil(boss.health))} / ${boss.maxHealth}`;
  }
}

// Shared by both a direct kill and a rocket splash kill so coin/score/level
// progression stays in exactly one place.
function defeatEnemy(enemy, index, hitPosition, wasHeadshot) {
  spawnDeathBurst(enemy.position);
  playEnemyDeath();
  scene.remove(enemy);
  enemies.splice(index, 1);
  player.score += enemy.scoreValue || 15;
  scoreUI.textContent = `Score: ${player.score}`;
  registerKill();
  if (enemy.type === 'boss') {
    showMessage('BOSS DEFEATED!', 2200);
    spawnFloatingText(`BOSS DOWN +${BOSS_DEFEAT_COINS} COINS`, hitPosition, 0xff66ff);
    addCoins(BOSS_DEFEAT_COINS);
  } else {
    addCoins(COIN_VALUES[enemy.type] || 5);
  }
  if (gameStarted && enemies.length === 0) {
    if (!wasHeadshot && enemy.type !== 'boss') {
      showMessage('Level cleared! Preparing next level...', 1800);
    }
    setTimeout(() => { nextLevel(); }, 1000);
  }
}

// Rocket impact — damages every enemy within radius (falloff by distance)
// instead of the single target the bullet directly touched.
function resolveExplosion(center, radius, baseDamage) {
  spawnImpactParticles(center, 0xff7a3c, 22);
  triggerScreenShake(0.25, 9);
  for (let k = enemies.length - 1; k >= 0; k--) {
    const enemy = enemies[k];
    const dist = enemy.position.distanceTo(center);
    if (dist < radius) {
      const falloff = 1 - dist / radius;
      const dmg = baseDamage * Math.max(0.25, falloff);
      enemy.health -= dmg;
      spawnFloatingText(`-${Math.round(dmg)}`, enemy.position.clone().add(new THREE.Vector3(0, 1.2, 0)), 0xffa552);
      if (enemy.health <= 0) {
        defeatEnemy(enemy, k, center, false);
      }
    }
  }
}

function handleShooting() {
  const playerPosition = playerBody.position;
  const headWorldPos = new THREE.Vector3();
  for (let i = bullets.length - 1; i >= 0; i--) {
    const bullet = bullets[i];
    bullet.position.addScaledVector(bullet.direction, bullet.speed * deltaTime);
    if (isInsideMapInterior(bullet.position.x, bullet.position.z)) {
      scene.remove(bullet);
      bullets.splice(i, 1);
      continue;
    }
    if (bullet.position.length() > 150) {
      scene.remove(bullet);
      bullets.splice(i, 1);
      continue;
    }
    for (let j = enemies.length - 1; j >= 0; j--) {
      const enemy = enemies[j];
      if (enemy) {
        const enemyScale = enemy.scale?.y || 1;
        const enemyCenter = enemy.position.clone();
        enemyCenter.y += 1.2 * enemyScale;
        if (bullet.position.distanceTo(enemyCenter) < (enemy.hitRadius || 2.4)) {
          scene.remove(bullet);
          bullets.splice(i, 1);
          if (bullet.splashRadius) {
            resolveExplosion(bullet.position, bullet.splashRadius, bullet.damage ?? 30);
            break;
          }
          const wasHeadshot = enemy.parts?.head && (() => {
            enemy.parts.head.getWorldPosition(headWorldPos);
            const distToHead = bullet.position.distanceTo(headWorldPos);
            // generous direct radius
            if (distToHead < (enemy.headRadius || 1.8)) return true;
            // small aim-assist: if bullet is roughly pointed at the head and fairly close
            const toHead = headWorldPos.clone().sub(bullet.position).normalize();
            const aimDot = bullet.direction.clone().dot(toHead);
            if (distToHead < (enemy.headRadiusAssist || 2.6) && aimDot > 0.88) return true;
            return false;
          })();
          spawnImpactParticles(bullet.position, wasHeadshot ? 0xffd24c : 0xffa552, wasHeadshot ? 14 : 7);
          if (wasHeadshot) {
            // No flat instant-kill on any enemy type, boss or otherwise — that let a single
            // lucky headshot delete an enemy's whole health pool regardless of how tough it's
            // supposed to be. Heavy bonus damage instead, so actual health always governs the kill.
            const headshotDamage = (bullet.damage ?? 30) * 4;
            enemy.health -= headshotDamage;
            player.health += 100;
            showMessage('headshot!', 2200);
            updateUI();
            playHeadshot();
            spawnFloatingText(`HEADSHOT -${Math.round(headshotDamage)}`, bullet.position, 0xffd24c);
          } else {
            const damage = bullet.damage ?? 30;
            enemy.health -= damage;
            spawnFloatingText(`-${damage}`, bullet.position, 0xffffff);
          }
          if (enemy.health <= 0) {
            defeatEnemy(enemy, j, bullet.position, wasHeadshot);
          }
          break;
        }
      }
    }
  }

  const playerHeadPosition = playerHead.getWorldPosition(new THREE.Vector3());
  const playerTorsoPosition = playerBody.position.clone().add(new THREE.Vector3(0, 1.2 * (playerBody.scale.y || 1), 0));
  for (let i = enemyBullets.length - 1; i >= 0; i--) {
    const bullet = enemyBullets[i];
    bullet.position.addScaledVector(bullet.direction, bullet.speed * deltaTime);
    if (isInsideMapInterior(bullet.position.x, bullet.position.z)) {
      scene.remove(bullet);
      enemyBullets.splice(i, 1);
      continue;
    }
    const playerScale = playerBody.scale.y || 1;
    const hitHead = bullet.position.distanceTo(playerHeadPosition) < 1.05 * playerScale;
    const hitTorso = bullet.position.distanceTo(playerTorsoPosition) < 1.25 * playerScale;
    if (hitHead || hitTorso) {
      scene.remove(bullet);
      enemyBullets.splice(i, 1);
      // deflectChance >= 1 means full immunity (e.g. 24K Gold Armor) — deflect
      // every hit including head shots and apply zero damage. Lower values only
      // get a partial roll on torso hits (armor doesn't cover an unhelmeted head).
      const deflectChance = player.armorDeflectChance || 0;
      const fullImmunity = deflectChance >= 1;
      if ((fullImmunity || (hitTorso && !hitHead)) && Math.random() < deflectChance) {
        spawnImpactParticles(bullet.position, fullImmunity ? 0xffd700 : 0xd9e6ef, fullImmunity ? 16 : 12);
        spawnFloatingText('DEFLECTED!', bullet.position, fullImmunity ? 0xffd700 : 0x8ad4ff);
        playArmorDeflect();
        continue;
      }
      player.health = Math.max(0, player.health - (bullet.damage ?? ENEMY_BULLET_DAMAGE) * (1 - (player.armorReduction || 0)));
      updateUI();
      playHurt();
      triggerDamageFlash();
      triggerScreenShake(0.18, 6);
      resetKillStreak();
      continue;
    }
    if (bullet.position.length() > 150) {
      scene.remove(bullet);
      enemyBullets.splice(i, 1);
    }
  }
}

function enemyAI(dt) {
  enemies.forEach((enemy, idx) => {
    const def = ENEMY_TYPES[enemy.type] || ENEMY_TYPES.grunt;
    const toPlayer = playerBody.position.clone().sub(enemy.position);
    toPlayer.y = 0;
    const distance = toPlayer.length();

    // Face player on the horizontal plane only using yaw rotation
    const yaw = Math.atan2(toPlayer.x, toPlayer.z);
    enemy.rotation.set(0, yaw, 0);

    // Move toward player if not too close
    const stopDistance = def.meleeOnly ? 1.0 : 1.6;
    const moveSpeed = (enemy.speed || 1.5) + (level * 0.12);
    if (distance > stopDistance) {
      const dir = toPlayer.normalize();
      // compute next position and avoid entering the church interior
      const nextPos = enemy.position.clone().addScaledVector(dir, moveSpeed * dt);
      if (!isInsideMapInterior(nextPos.x, nextPos.z)) {
        enemy.position.addScaledVector(dir, moveSpeed * dt);
      } else {
        // if the straight path would enter the map's interior structure, stop at boundary (no movement)
      }
    }

    // Keep enemy arms steady while still animating legs
    if (enemy.parts) {
      const phase = timeAccum * 8 + idx * 0.7;
      const walkFactor = Math.min(1, (distance > stopDistance ? 1 : 0));
      const legSwing = Math.sin(phase) * 0.9 * walkFactor;
      enemy.parts.armLeft.rotation.x = Math.PI / 10;
      enemy.parts.armRight.rotation.x = -1.25;
      enemy.parts.legLeft.rotation.x = legSwing;
      enemy.parts.legRight.rotation.x = -legSwing;
    }

    if (def.meleeOnly) {
      enemy.meleeTimer -= dt;
      if (distance < (def.meleeRange || 2.0) && enemy.meleeTimer <= 0) {
        enemy.meleeTimer = def.meleeInterval;
        const torsoHitPos = playerBody.position.clone().add(new THREE.Vector3(0, 1.2, 0));
        const meleeDeflectChance = player.armorDeflectChance || 0;
        const meleeFullImmunity = meleeDeflectChance >= 1;
        if (Math.random() < meleeDeflectChance) {
          spawnImpactParticles(torsoHitPos, meleeFullImmunity ? 0xffd700 : 0xd9e6ef, meleeFullImmunity ? 16 : 12);
          spawnFloatingText('DEFLECTED!', torsoHitPos, meleeFullImmunity ? 0xffd700 : 0x8ad4ff);
          playArmorDeflect();
        } else {
          player.health = Math.max(0, player.health - def.meleeDamage * (1 - (player.armorReduction || 0)));
          updateUI();
          playHurt();
          triggerDamageFlash();
          triggerScreenShake(0.22, 8);
          resetKillStreak();
          spawnImpactParticles(torsoHitPos, 0xff8c1a, 8);
        }
      }
      return;
    }

    // Shooting behavior — grunts fire one shot, boss fans out a spread.
    enemy.shootTimer -= dt;
    if (enemy.shootTimer <= 0 && distance < def.shootRange) {
      enemy.shootTimer = def.shootInterval[0] + Math.random() * (def.shootInterval[1] - def.shootInterval[0]);
      const muzzlePos = enemy.gun?.muzzle ? enemy.gun.muzzle.getWorldPosition(new THREE.Vector3()) : enemy.position.clone().add(new THREE.Vector3(0, 1.4, 0));
      const targetPos = playerHead.getWorldPosition(new THREE.Vector3());
      const baseDirection = targetPos.sub(muzzlePos).normalize();
      const pellets = def.pellets || 1;
      for (let p = 0; p < pellets; p++) {
        const direction = baseDirection.clone();
        if (def.spreadShot && pellets > 1) {
          const spreadAngle = (p - (pellets - 1) / 2) * 0.12;
          direction.applyAxisAngle(new THREE.Vector3(0, 1, 0), spreadAngle);
        }
        const bullet = createBullet(muzzlePos, direction, enemyBulletMaterial, 26);
        bullet.damage = ENEMY_BULLET_DAMAGE * (def.bulletDamageMult || 1);
        enemyBullets.push(bullet);
      }
      playEnemyGunshot();
      spawnMuzzleFlash(muzzlePos, baseDirection);
    }
  });
}

let deltaTime = 0;
let previousTime = performance.now();
let timeAccum = 0;
let lastFootstepLegSign = 0;

function drawMinimap() {
  if (!minimapCtx) return;
  const size = minimapCanvas.width;
  minimapCtx.clearRect(0, 0, size, size);
  minimapCtx.fillStyle = '#08101f';
  minimapCtx.fillRect(0, 0, size, size);

  const toMap = (value) => ((value + MAP_RADIUS) / (MAP_RADIUS * 2)) * size;

  minimapCtx.strokeStyle = 'rgba(255,255,255,0.08)';
  minimapCtx.lineWidth = 1;
  minimapCtx.strokeRect(0, 0, size, size);

  // Draw roads
  minimapCtx.fillStyle = 'rgba(255,255,255,0.1)';
  activeRoadBands.forEach((zBand) => {
    const y = toMap(zBand);
    minimapCtx.fillRect(0, y - 5, size, 10);
  });

  // Draw enemies, colored and sized by archetype
  const MINIMAP_ENEMY_COLOR = { grunt: '#ff4c4c', rusher: '#ff8c1a', heavy: '#7a9b7a', boss: '#ff66ff' };
  enemies.forEach((enemy) => {
    minimapCtx.fillStyle = MINIMAP_ENEMY_COLOR[enemy.type] || '#ff4c4c';
    minimapCtx.beginPath();
    minimapCtx.arc(toMap(enemy.position.x), toMap(enemy.position.z), enemy.type === 'boss' ? 7 : 4, 0, Math.PI * 2);
    minimapCtx.fill();
  });

  // Draw player
  minimapCtx.fillStyle = '#7df9ff';
  minimapCtx.beginPath();
  minimapCtx.arc(toMap(playerBody.position.x), toMap(playerBody.position.z), 5, 0, Math.PI * 2);
  minimapCtx.fill();
}

function animate() {
  requestAnimationFrame(animate);
  const currentTime = performance.now();
  deltaTime = (currentTime - previousTime) / 1000;
  previousTime = currentTime;
  timeAccum += deltaTime;

  // Shopping pauses the world — enemies/bullets/timers freeze the instant a
  // store opens the Armory, and resume the instant it closes.
  if (!armoryOpen) {
    updateStoreTriggers();
  }

  if (!armoryOpen) {
    const isEmoting = player.emoteTimer > 0;

    if (player.health > 0) {
      if (isEmoting) {
        player.velocity.set(0, 0, 0);
      } else {
        handleControls();
      }
      handleShooting();
      enemyAI(deltaTime);
      // Continuous firing while mouse/touch is held. spawnPlayerBullet enforces cooldown.
      // Re-aim at the live cursor position every shot (not just the initial click) so
      // automatic weapons keep tracking wherever the cursor currently is.
      if (isShooting && !isEmoting) {
        spawnPlayerBullet(!isMobile ? getBulletDirectionFromScreen(lastAimClientX, lastAimClientY) : null);
      }
    }

    if (isEmoting) {
      player.emoteTimer -= deltaTime;
      player.emoteElapsed += deltaTime;
      applyEmotePose(playerParts, player.activeEmote, player.emoteElapsed);
      if (player.emoteTimer <= 0) player.activeEmote = null;
    } else {
      // Neutral pose — also undoes whatever an emote last left the arms/head in.
      playerArmLeft.rotation.set(Math.PI / 10, 0, 0);
      playerArmRight.rotation.set(-1.25, 0, 0.15);
      playerHead.rotation.set(0, 0, 0);

      // Player limb animation based on movement
      const walkSpeed = player.velocity.length();
      const walkFactor = THREE.MathUtils.clamp(walkSpeed / player.speed, 0, 1);
      const legAngle = Math.sin(timeAccum * 8) * 0.9 * walkFactor;
      playerLegLeft.rotation.x = legAngle;
      playerLegRight.rotation.x = -legAngle;

      // A footstep each time the leg swing crosses center while actually walking.
      if (walkFactor > 0.15) {
        const legSign = Math.sign(legAngle);
        if (legSign !== 0 && legSign !== lastFootstepLegSign) {
          playFootstep();
          lastFootstepLegSign = legSign;
        }
      }
    }

    // Turn the whole body (head, arms, legs, gun all ride along as one rigid unit)
    // to face the aim direction, the way a person pivots to face where they're looking.
    // While shooting, hold the body still instead of turning.
    if (!isShooting) {
      playerBody.rotation.y = aimRotation.y;
    }

    updateCars(deltaTime);
    updateDivineEvent(deltaTime);
    animateCryingTears(deltaTime);
    updateFleeingNpcs(deltaTime);
    animateVaticanPrayer(deltaTime);
    updateEffects(deltaTime);
  }

  // Camera follows directly behind the player's facing direction, so the turn is
  // visible on the character and the world appears to swing into view around them.
  // Scaled by the player's body scale so VIP giant mode doesn't fill/clip the screen.
  const giantFactor = playerBody.scale.y || 1;
  const camDistance = 8.5 * giantFactor;
  const camHeight = 4.6 * giantFactor;
  const facing = new THREE.Vector3(Math.sin(aimRotation.y), 0, Math.cos(aimRotation.y)).normalize();
  const camPos = playerBody.position.clone().add(new THREE.Vector3(-facing.x * camDistance, camHeight, -facing.z * camDistance));
  const shakeOffset = getScreenShakeOffset(deltaTime);
  if (shakeOffset) camPos.add(shakeOffset);
  camera.position.copy(camPos);
  camera.lookAt(playerBody.position.clone().add(new THREE.Vector3(0, 1.4 * giantFactor, 0)));

  renderer.render(scene, camera);
  drawMinimap();
}

animate();

window.addEventListener('keydown', (event) => {
  keyState[event.code] = true;
  if (event.code === 'Space' || event.code === 'KeyF') {
    spawnPlayerBullet();
  }
  if (event.code === 'KeyG' && inventory.vip && !armoryOpen) {
    toggleVipGiantMode();
  }
  const WEAPON_KEY_SLOTS = {
    Digit1: 'sniper', Digit2: 'pistol', Digit3: 'shotgun', Digit4: 'smg', Digit5: 'rocket',
    Digit6: 'burst', Digit7: 'revolver', Digit8: 'lmg', Digit9: 'crossbow',
  };
  const slotWeapon = WEAPON_KEY_SLOTS[event.code];
  if (slotWeapon && !vipGiantMode && inventory.weapons.includes(slotWeapon)) {
    setPlayerWeapon(slotWeapon);
    equipped.weapon = slotWeapon;
    saveEquipped();
  }
});

window.addEventListener('keyup', (event) => {
  keyState[event.code] = false;
});

window.addEventListener('mousedown', (event) => {
  if (!gameStarted) {
    // Only the Start Game button may begin the game — clicking elsewhere does nothing.
    return;
  }
  if (event.button === 0) {
    isShooting = true;
    lastAimClientX = event.clientX;
    lastAimClientY = event.clientY;
    if (!isMobile) {
      const interact = getInteractableAtScreen(event.clientX, event.clientY);
      if (interact && interact.object) {
        const clicked = findAncestorWithName(interact.object, 'Obispo Bonano');
        if (clicked) {
          talkToObispo();
          return;
        }
      }
      spawnPlayerBullet(getBulletDirectionFromScreen(event.clientX, event.clientY));
      return;
    }
    spawnPlayerBullet();
  }
});

window.addEventListener('mouseup', (event) => {
  if (event.button === 0) isShooting = false;
});

window.addEventListener('touchstart', (event) => {
  if (!gameStarted) {
    // Only the Start Game button may begin the game — tapping elsewhere does nothing.
    return;
  }
  if (!touchControls.classList.contains('hidden')) {
    event.preventDefault();
  }
});

window.addEventListener('mousemove', (event) => {
  lastAimClientX = event.clientX;
  lastAimClientY = event.clientY;
  if (window.innerWidth > 880 && event.buttons === 1) {
    aimRotation.y -= event.movementX * 0.0025;
    aimRotation.x -= event.movementY * 0.0025;
    aimRotation.x = THREE.MathUtils.clamp(aimRotation.x, -0.6, 0.6);
  }
});

['mousedown', 'touchstart'].forEach((eventName) => {
  window.addEventListener(eventName, () => {
    if (!pointerLocked && gameStarted) {
      hideMessage();
      touchControls.classList.toggle('hidden', window.innerWidth > 880);
      pointerLocked = true;
    }
  });
});

[
  { id: 'moveForward', key: 'moveForward', label: '#move-forward' },
  { id: 'moveLeft', key: 'moveLeft', label: '#move-left' },
  { id: 'moveBack', key: 'moveBack', label: '#move-back' },
  { id: 'moveRight', key: 'moveRight', label: '#move-right' }
].forEach((button) => {
  const element = document.querySelector(button.label);
  element.addEventListener('touchstart', (event) => {
    event.preventDefault();
    keyState[button.key] = true;
  });
  element.addEventListener('touchend', (event) => {
    event.preventDefault();
    keyState[button.key] = false;
  });
});

const shootButton = document.getElementById('shoot-button');
shootButton.addEventListener('touchstart', (event) => {
  event.preventDefault();
  isShooting = true;
  spawnPlayerBullet();
});
shootButton.addEventListener('touchend', (event) => {
  event.preventDefault();
  isShooting = false;
});

const systemTouch = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
if (systemTouch) {
  isMobile = true;
  status.textContent = 'Tap the start button to enter the New York City arena.';
  showMessage('Tap anywhere on the screen to start the game.');
} else {
  status.textContent = 'Click the start button to enter the New York City arena.';
  showMessage('Click anywhere to start and use WASD + mouse.');
}

startButton.addEventListener('click', showMapPicker);

updateUI();

// --- Voice-to-text enemy conversation ---

const voiceBtn = document.getElementById('voice-btn');
let voiceListening = false;
let voiceRecognition = null;
let voiceBusy = false;

function getClaudeApiKey() {
  let key = localStorage.getItem('sniperstrike-claude-key');
  if (!key) {
    key = window.prompt('Enter your Anthropic API key to enable enemy conversations:\n(saved locally, only sent to Anthropic)');
    if (key && key.trim()) {
      localStorage.setItem('sniperstrike-claude-key', key.trim());
    }
  }
  return key ? key.trim() : null;
}

function createSpeechBubbleTexture(text, isPlayer) {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 152;
  const ctx = canvas.getContext('2d');

  const bgColor = isPlayer ? 'rgba(20, 70, 190, 0.88)' : 'rgba(170, 25, 25, 0.88)';
  const borderColor = isPlayer ? 'rgba(120, 180, 255, 0.95)' : 'rgba(255, 110, 80, 0.95)';
  const rx = 16;
  const bh = canvas.height - 22;

  ctx.fillStyle = bgColor;
  ctx.beginPath();
  ctx.moveTo(rx, 8); ctx.lineTo(canvas.width - rx, 8);
  ctx.quadraticCurveTo(canvas.width - 8, 8, canvas.width - 8, rx);
  ctx.lineTo(canvas.width - 8, bh - rx);
  ctx.quadraticCurveTo(canvas.width - 8, bh, canvas.width - rx, bh);
  const tailX = isPlayer ? 72 : canvas.width - 72;
  ctx.lineTo(tailX + 20, bh);
  ctx.lineTo(tailX, canvas.height - 4);
  ctx.lineTo(tailX - 20, bh);
  ctx.lineTo(rx, bh);
  ctx.quadraticCurveTo(8, bh, 8, bh - rx);
  ctx.lineTo(8, rx);
  ctx.quadraticCurveTo(8, 8, rx, 8);
  ctx.closePath();
  ctx.fill();

  ctx.strokeStyle = borderColor;
  ctx.lineWidth = 3;
  ctx.stroke();

  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 26px Arial';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  const maxW = canvas.width - 48;
  const words = text.split(' ');
  const lines = [];
  let cur = '';
  for (const word of words) {
    const test = cur ? cur + ' ' + word : word;
    if (ctx.measureText(test).width > maxW && cur) { lines.push(cur); cur = word; }
    else cur = test;
  }
  if (cur) lines.push(cur);
  const lineH = 32;
  const startY = (bh + 8) / 2 - (lines.length * lineH) / 2 + lineH / 2;
  lines.forEach((line, i) => ctx.fillText(line, canvas.width / 2, startY + i * lineH));

  const tex = new THREE.CanvasTexture(canvas);
  tex.minFilter = THREE.LinearFilter;
  return tex;
}

function spawnSpeechBubble(text, position, isPlayer, duration = 5) {
  const tex = createSpeechBubbleTexture(text, isPlayer);
  const mat = new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false });
  const sprite = new THREE.Sprite(mat);
  sprite.scale.set(4.2, 1.25, 1);
  sprite.position.copy(position).add(new THREE.Vector3(0, 2.8, 0));
  scene.add(sprite);
  activeSpeechBubbles.push({ sprite, life: 0, maxLife: duration });
}

function updateSpeechBubbles(dt) {
  for (let i = activeSpeechBubbles.length - 1; i >= 0; i--) {
    const b = activeSpeechBubbles[i];
    b.life += dt;
    if (b.life >= b.maxLife) {
      scene.remove(b.sprite);
      b.sprite.material.map.dispose();
      activeSpeechBubbles.splice(i, 1);
      continue;
    }
    const fadeStart = b.maxLife - 1.0;
    if (b.life > fadeStart) {
      b.sprite.material.opacity = 1 - (b.life - fadeStart);
    }
  }
}

async function callClaudeForEnemyResponse(playerText) {
  const key = getClaudeApiKey();
  if (!key) return null;
  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': key,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
        'anthropic-dangerous-direct-browser-access': 'true',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 60,
        system: 'You are a battle enemy in a 3D action shooter game. The player is fighting you. Respond to what they say with a short, cocky, trash-talking comeback — the kind of banter rivals exchange mid-fight. Keep it under 12 words. Be bold, funny, and confident. No profanity.',
        messages: [{ role: 'user', content: playerText }],
      }),
    });
    if (!res.ok) {
      if (res.status === 401) {
        localStorage.removeItem('sniperstrike-claude-key');
        showMessage('Invalid API key — cleared. Press 🎤 again to re-enter.');
      }
      return null;
    }
    const data = await res.json();
    return data.content?.[0]?.text?.trim() || null;
  } catch (e) {
    console.warn('Voice API error:', e);
    return null;
  }
}

function speakEnemyResponse(text) {
  return new Promise((resolve) => {
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.pitch = 0.5;   // deep, menacing
    utterance.rate = 1.05;   // confident, slightly fast
    utterance.volume = 1.0;

    // Pick a deep English male voice if available
    const voices = window.speechSynthesis.getVoices();
    const preferred = voices.find(v =>
      /david|mark|daniel|fred|albert|james|rishi/i.test(v.name) && v.lang.startsWith('en')
    ) || voices.find(v => v.lang.startsWith('en-'));
    if (preferred) utterance.voice = preferred;

    utterance.onend = () => resolve();
    utterance.onerror = () => resolve();

    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(utterance);
  });
}

function getNearestLivingEnemy() {
  let nearest = null;
  let nearestDist = Infinity;
  for (const e of enemies) {
    if (e.health <= 0) continue;
    const d = e.position.distanceTo(playerBody.position);
    if (d < nearestDist) { nearestDist = d; nearest = e; }
  }
  return nearest;
}

function setupVoiceRecognition() {
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SR) {
    showMessage('Voice not supported — try Chrome or Edge.');
    return null;
  }
  const rec = new SR();
  rec.continuous = false;
  rec.interimResults = false;
  rec.lang = 'en-US';

  rec.onresult = async (event) => {
    const transcript = event.results[0][0].transcript.trim();
    if (!transcript || voiceBusy) return;
    voiceBusy = true;
    voiceBtn.classList.remove('voice-active');
    voiceBtn.classList.add('voice-thinking');

    spawnSpeechBubble(transcript, playerBody.position.clone(), true, 5);

    const reply = await callClaudeForEnemyResponse(transcript);

    voiceBtn.classList.remove('voice-thinking');
    if (voiceListening) voiceBtn.classList.add('voice-active');
    voiceBusy = false;

    if (reply) {
      const target = getNearestLivingEnemy();
      const pos = target ? target.position.clone() : playerBody.position.clone().add(new THREE.Vector3(3, 0, -3));
      spawnSpeechBubble(reply, pos, false, 5);
      await speakEnemyResponse(reply); // wait for enemy to finish talking before listening again
    }

    if (voiceListening) {
      try { rec.start(); } catch (e) {}
    }
  };

  rec.onerror = (e) => {
    if (e.error !== 'no-speech') {
      console.warn('Speech recognition error:', e.error);
      voiceBtn.classList.remove('voice-active', 'voice-thinking');
      voiceListening = false;
      voiceBusy = false;
    }
  };

  rec.onend = () => {
    if (voiceListening && !voiceBusy) {
      try { rec.start(); } catch (e) {}
    }
  };

  return rec;
}

voiceBtn.addEventListener('click', () => {
  if (!voiceListening) {
    const key = getClaudeApiKey();
    if (!key) return;
    if (!voiceRecognition) {
      voiceRecognition = setupVoiceRecognition();
      if (!voiceRecognition) return;
    }
    voiceListening = true;
    voiceBtn.classList.add('voice-active');
    voiceBtn.title = 'Stop talking (click to stop)';
    try { voiceRecognition.start(); } catch (e) {}
  } else {
    voiceListening = false;
    voiceBtn.classList.remove('voice-active', 'voice-thinking');
    voiceBtn.title = 'Talk to enemies';
    window.speechSynthesis.cancel();
    try { voiceRecognition.stop(); } catch (e) {}
  }
});

// Global error handlers to surface runtime exceptions in the overlay for debugging
window.addEventListener('error', (e) => {
  console.error('Global error:', e.error || e.message || e);
  showMessage('Runtime error: ' + (e.error && e.error.message ? e.error.message : (e.message || String(e))));
});
window.addEventListener('unhandledrejection', (ev) => {
  console.error('Unhandled rejection:', ev.reason);
  showMessage('Unhandled promise rejection: ' + (ev.reason && ev.reason.message ? ev.reason.message : String(ev.reason)));
});
