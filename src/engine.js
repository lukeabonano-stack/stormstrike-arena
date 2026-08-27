// ── engine.js  Babylon.js engine bootstrap + shared mesh / material helpers ──
// BABYLON is a global loaded by the CDN <script> tag in index.html.

// Touch/mobile devices have far less GPU memory headroom than a laptop —
// used to skip non-essential upfront work (e.g. eagerly loading the armory
// preview scene's character assets before the player has even opened the
// Home Screen) on those devices specifically, without changing desktop
// behavior at all.
export const isMobile = ('ontouchstart' in window) || navigator.maxTouchPoints > 0;

const canvas = document.getElementById('renderCanvas');
export const engine = new BABYLON.Engine(canvas, true, {
  preserveDrawingBuffer: true,
  stencil: true,
  adaptToDeviceRatio: true,
});
window.addEventListener('resize', () => engine.resize());

export const scene = new BABYLON.Scene(engine);
scene.clearColor = new BABYLON.Color4(0.56, 0.78, 1.0, 1.0);
scene.gravity = new BABYLON.Vector3(0, -9.81, 0);
scene.collisionsEnabled = false; // We handle collisions manually

// ── Camera ────────────────────────────────────────────────────────────────────
export const camera = new BABYLON.UniversalCamera('camera', BABYLON.Vector3.Zero(), scene);
camera.minZ = 0.2;
camera.maxZ = 1200;
// Camera is positioned manually each frame in main.js; detach default controls.
camera.inputs.clear();

// ── Lights ────────────────────────────────────────────────────────────────────
export const ambientLight = new BABYLON.HemisphericLight('ambient', new BABYLON.Vector3(0, 1, 0), scene);
ambientLight.intensity = 0.55;
ambientLight.groundColor = new BABYLON.Color3(0.35, 0.38, 0.45);
ambientLight.diffuse = new BABYLON.Color3(0.8, 0.88, 1.0);

export const sunLight = new BABYLON.DirectionalLight('sun', new BABYLON.Vector3(-0.6, -1.2, -0.4), scene);
sunLight.position = new BABYLON.Vector3(30, 60, 20);
sunLight.intensity = 2.2;
sunLight.shadowMinZ = 1;
sunLight.shadowMaxZ = 600;

// ── Shadows ───────────────────────────────────────────────────────────────────
export const shadowGen = new BABYLON.ShadowGenerator(2048, sunLight, true);
shadowGen.useBlurExponentialShadowMap = true;
shadowGen.blurKernel = 32;
shadowGen.normalBias = 0.05;
shadowGen.depthScale = 50;

// ── Post-processing pipeline (exported so main.js can drive vignette) ────────
export const pipeline = new BABYLON.DefaultRenderingPipeline('default', true, scene, [camera]);
pipeline.bloomEnabled = true;
pipeline.bloomThreshold = 0.78;
pipeline.bloomWeight = 0.28;
pipeline.bloomKernel = 64;
pipeline.bloomScale = 0.5;
pipeline.fxaaEnabled = true;
pipeline.imageProcessingEnabled = true;
pipeline.imageProcessing.toneMappingEnabled = true;
pipeline.imageProcessing.toneMappingType = BABYLON.ImageProcessingConfiguration.TONEMAPPING_ACES;
pipeline.imageProcessing.exposure = 1.05;
pipeline.imageProcessing.vignetteEnabled = true;
pipeline.imageProcessing.vignetteWeight = 2.0;
pipeline.imageProcessing.vignetteCameraFov = 0.5;

// ── IBL environment texture ───────────────────────────────────────────────────
// Loaded asynchronously — gives PBR metals realistic reflections.
// Local copy first (assets/env/), CDN fallback.
const ENV_LOCAL = 'assets/env/environmentSpecular.env';
const ENV_CDN   = 'https://assets.babylonjs.com/environments/environmentSpecular.env';
function _applyEnv(url, onFail) {
  try {
    const et = BABYLON.CubeTexture.CreateFromPrefilteredData(url, scene);
    et.onLoadObservable?.addOnce(() => {
      scene.environmentTexture = et;
      scene.environmentIntensity = 0.6;
    });
    // If loading errors, Babylon logs it; probe readiness as a fallback signal.
    setTimeout(() => {
      if (scene.environmentTexture !== et && onFail) onFail();
    }, 4000);
  } catch (_e) { if (onFail) onFail(); }
}
_applyEnv(ENV_LOCAL, () => _applyEnv(ENV_CDN, null));

// ── Armory preview engine (separate canvas, separate scene) ───────────────────
export const previewCanvas = document.getElementById('armory-preview-canvas');
export const previewEngine = new BABYLON.Engine(previewCanvas, true, { preserveDrawingBuffer: true });
export const previewScene = new BABYLON.Scene(previewEngine);
previewScene.clearColor = new BABYLON.Color4(0.12, 0.12, 0.16, 1);

export const previewCamera = new BABYLON.ArcRotateCamera('prev', Math.PI / 2, Math.PI / 3.2, 3.8, new BABYLON.Vector3(0, 1.1, 0), previewScene);
previewCamera.minZ = 0.05;
previewCamera.inputs.clear(); // no mouse events; preview rotates via RAF in armory/index.js

const prevAmb = new BABYLON.HemisphericLight('pa', new BABYLON.Vector3(0, 1, 0), previewScene);
prevAmb.intensity = 0.6;
const prevDir = new BABYLON.DirectionalLight('pd', new BABYLON.Vector3(-1, -2, -1), previewScene);
prevDir.intensity = 1.4;

// ── ID counter ────────────────────────────────────────────────────────────────
let _eid = 0;
function uid() { return String(++_eid); }

// ── Color helpers ─────────────────────────────────────────────────────────────
export function c3(hex) {
  return new BABYLON.Color3(((hex >> 16) & 0xff) / 255, ((hex >> 8) & 0xff) / 255, (hex & 0xff) / 255);
}
export function c4(hex, a = 1) {
  return new BABYLON.Color4(((hex >> 16) & 0xff) / 255, ((hex >> 8) & 0xff) / 255, (hex & 0xff) / 255, a);
}

// ── Material factories ────────────────────────────────────────────────────────
export function pbr(hex, roughness = 0.5, metallic = 0, opts = {}) {
  const m = new BABYLON.PBRMaterial('pbr' + uid(), opts._scene || scene);
  m.albedoColor = c3(hex);
  m.roughness = roughness;
  m.metallic = metallic;
  if (opts.emissive !== undefined) {
    m.emissiveColor = c3(opts.emissive).scale(opts.emissiveIntensity || 1);
  }
  if (opts.alpha !== undefined) {
    m.alpha = opts.alpha;
    m.transparencyMode = BABYLON.PBRMaterial.PBRMATERIAL_ALPHABLEND;
  }
  if (opts.backFace) {
    m.backFaceCulling = false;
    m.sideOrientation = BABYLON.Mesh.BACKSIDE;
  }
  if (opts.twoSided) m.backFaceCulling = false;
  return m;
}

// Standard (non-PBR) material — lighter weight, good for many-instance geometry.
export function std(hex, opts = {}) {
  const m = new BABYLON.StandardMaterial('std' + uid(), opts._scene || scene);
  m.diffuseColor = c3(hex);
  if (opts.emissive !== undefined) {
    m.emissiveColor = c3(opts.emissive).scale(opts.emissiveIntensity || 1);
    m.disableLighting = !!opts.disableLighting;
  }
  if (opts.alpha !== undefined) {
    m.alpha = opts.alpha;
  }
  return m;
}

// ── Mesh factories (all auto-added to main scene) ─────────────────────────────
export function grp(name, parent, sc = scene) {
  const n = new BABYLON.TransformNode(name || 'g' + uid(), sc);
  if (parent) n.parent = parent;
  return n;
}

export function box(w, h, d, mat, parent, sc = scene) {
  const m = BABYLON.MeshBuilder.CreateBox('b' + uid(), { width: w, height: h, depth: d }, sc);
  if (mat) m.material = mat;
  if (parent) m.parent = parent;
  m.receiveShadows = true;
  return m;
}

export function cyl(rt, rb, h, mat, parent, tess = 12, sc = scene) {
  const m = BABYLON.MeshBuilder.CreateCylinder('c' + uid(), {
    diameterTop: rt * 2, diameterBottom: rb * 2, height: h, tessellation: tess,
  }, sc);
  if (mat) m.material = mat;
  if (parent) m.parent = parent;
  m.receiveShadows = true;
  return m;
}

export function sph(r, mat, parent, segs = 10, sc = scene) {
  const m = BABYLON.MeshBuilder.CreateSphere('s' + uid(), { diameter: r * 2, segments: segs }, sc);
  if (mat) m.material = mat;
  if (parent) m.parent = parent;
  m.receiveShadows = true;
  return m;
}

// Hemisphere — slice:0.5 gives top half only.
export function hemi(r, mat, parent, segs = 16, sc = scene) {
  const m = BABYLON.MeshBuilder.CreateSphere('h' + uid(), {
    diameter: r * 2, segments: segs, arc: 1.0, slice: 0.5,
  }, sc);
  if (mat) m.material = mat;
  if (parent) m.parent = parent;
  m.receiveShadows = true;
  return m;
}

export function cone(r, h, mat, parent, tess = 12, sc = scene) {
  // diameterTop:0 makes it a true cone.
  const m = BABYLON.MeshBuilder.CreateCylinder('cn' + uid(), {
    diameterTop: 0, diameterBottom: r * 2, height: h, tessellation: tess,
  }, sc);
  if (mat) m.material = mat;
  if (parent) m.parent = parent;
  m.receiveShadows = true;
  return m;
}

export function torus(r, tube, mat, parent, tess = 16, sc = scene) {
  const m = BABYLON.MeshBuilder.CreateTorus('t' + uid(), {
    diameter: r * 2, thickness: tube * 2, tessellation: tess,
  }, sc);
  if (mat) m.material = mat;
  if (parent) m.parent = parent;
  m.receiveShadows = true;
  return m;
}

// Flat horizontal ground plane.
export function gnd(w, d, mat, sc = scene) {
  const m = BABYLON.MeshBuilder.CreateGround('gd' + uid(), { width: w, height: d }, sc);
  if (mat) m.material = mat;
  m.receiveShadows = true;
  return m;
}

// Capsule — height = total including caps, so height = cylinderLength + radius*2.
export function capsule(r, cylinderLen, mat, parent, tess = 8, sc = scene) {
  const m = BABYLON.MeshBuilder.CreateCapsule('cap' + uid(), {
    radius: r, height: cylinderLen + r * 2, tessellation: tess, subdivisions: 4,
  }, sc);
  if (mat) m.material = mat;
  if (parent) m.parent = parent;
  m.receiveShadows = true;
  return m;
}

// Thin vertical plane (XY by default, useful for billboards/signs).
export function plane(w, h, mat, parent, sc = scene) {
  const m = BABYLON.MeshBuilder.CreatePlane('pl' + uid(), { width: w, height: h }, sc);
  if (mat) m.material = mat;
  if (parent) m.parent = parent;
  return m;
}

// ── Clone helper (keeps same parent as source) ────────────────────────────────
export function cloneM(src, newParent) {
  const c = src.clone('ck' + uid());
  c.parent = (newParent !== undefined) ? newParent : src.parent;
  return c;
}

// ── Shadow caster registration ────────────────────────────────────────────────
export function addShadow(node) {
  if (!shadowGen) return;
  if (node.getChildMeshes) {
    node.getChildMeshes(false).forEach(m => shadowGen.addShadowCaster(m));
  }
  if (node instanceof BABYLON.AbstractMesh) {
    shadowGen.addShadowCaster(node);
  }
}

// ── Canvas → DynamicTexture ───────────────────────────────────────────────────
export function makeCanvasTex(w, h, drawFn, sc = scene) {
  const tex = new BABYLON.DynamicTexture('dt' + uid(), { width: w, height: h }, sc, false,
    BABYLON.Texture.TRILINEAR_SAMPLINGMODE);
  tex.hasAlpha = true;
  const ctx = tex.getContext();
  drawFn(ctx, w, h);
  tex.update();
  return tex;
}

// ── Dispose helper — disposes a node and all its children ────────────────────
export function disposeNode(node) {
  if (!node || node.isDisposed()) return;
  node.getDescendants(false).slice().forEach(n => { if (!n.isDisposed()) n.dispose(); });
  node.dispose();
}

// ── Fog controls (called by maps) ─────────────────────────────────────────────
export function setFog(colorHex, start, end) {
  scene.fogMode = BABYLON.Scene.FOGMODE_LINEAR;
  scene.fogColor = c3(colorHex);
  scene.fogStart = start;
  scene.fogEnd = end;
}
export function clearFog() {
  scene.fogMode = BABYLON.Scene.FOGMODE_NONE;
}

// ── Glow layer — every emissive material blooms (neon, boss aura, zombie eyes) ─
export const glowLayer = new BABYLON.GlowLayer('glow', scene, { blurKernelSize: 24 });
glowLayer.intensity = 0.6;

// ── Procedural sky ────────────────────────────────────────────────────────────
let _skyBox = null;
export function setSky(preset) {
  if (_skyBox) { _skyBox.material?.dispose(); _skyBox.dispose(); _skyBox = null; }
  if (!preset || preset.mode === 'none') return;
  const top = preset.top ?? 0x2b6cb0;
  const horizon = preset.horizon ?? 0xbfe0ff;
  const bottom = preset.bottom ?? horizon;
  const stars = !!preset.stars;
  const tex = new BABYLON.DynamicTexture('skytex', { width: 8, height: 512 }, scene, false);
  const ctx = tex.getContext();
  const g = ctx.createLinearGradient(0, 0, 0, 512);
  const hx = (n) => '#' + n.toString(16).padStart(6, '0');
  g.addColorStop(0, hx(top)); g.addColorStop(0.55, hx(horizon)); g.addColorStop(1, hx(bottom));
  ctx.fillStyle = g; ctx.fillRect(0, 0, 8, 512);
  if (stars) {
    ctx.fillStyle = 'rgba(255,255,255,0.9)';
    for (let i = 0; i < 60; i++) ctx.fillRect(Math.random() * 8, Math.random() * 230, 1, 1);
  }
  tex.update();
  const mat = new BABYLON.StandardMaterial('skymat', scene);
  mat.backFaceCulling = false;
  mat.disableLighting = true;
  mat.emissiveTexture = tex;
  mat.diffuseColor = new BABYLON.Color3(0, 0, 0);
  mat.reflectionTexture = null;
  const sky = BABYLON.MeshBuilder.CreateSphere('skyBox', { diameter: 1000, sideOrientation: BABYLON.Mesh.BACKSIDE, segments: 12 }, scene);
  sky.material = mat;
  sky.infiniteDistance = true;
  sky.isPickable = false;
  sky.applyFog = false;
  glowLayer.addExcludedMesh(sky);
  _skyBox = sky;
}

// ── Lighting presets (applied by loadMap before build) ───────────────────────
export const DEFAULT_LIGHTING = {
  sunDir: [-0.6, -1.2, -0.4], sunColor: 0xfff2d8, sunIntensity: 2.2,
  ambientIntensity: 0.55, ambientGround: 0x595f73, ambientSky: 0xccdcff,
  env: 0.6, clear: 0x8fc7ff, sky: null, fog: null,
};
export function applyLightingPreset(p) {
  const L = { ...DEFAULT_LIGHTING, ...(p || {}) };
  sunLight.direction = new BABYLON.Vector3(...L.sunDir).normalize();
  sunLight.diffuse = c3(L.sunColor);
  sunLight.intensity = L.sunIntensity;
  ambientLight.intensity = L.ambientIntensity;
  ambientLight.groundColor = c3(L.ambientGround);
  ambientLight.diffuse = c3(L.ambientSky);
  scene.environmentIntensity = L.env;
  scene.clearColor = c4(L.clear, 1);
  setSky(L.sky);
  if (L.fog) setFog(L.fog.color, L.fog.start, L.fog.end); else clearFog();
}

// ── Terrain (seeded value-noise heightfield) ──────────────────────────────────
// Movement/collision stay 2D (wallColliders are xz AABBs) — terrain only
// affects visual ground height and the y-follow hooks in controls.js/enemies.js.
function _mulberry32(seed) {
  return function () {
    seed += 0x6D2B79F5; let t = seed;
    t = Math.imul(t ^ t >>> 15, t | 1);
    t ^= t + Math.imul(t ^ t >>> 7, t | 61);
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}

let _terrain = null;   // { mesh, size, subdivisions, heights: Float32Array((subdivisions+1)^2) }

export function makeTerrain(opts, mat) {
  const { size, subdivisions = 96, seed = 1, amplitude = 3,
          flatRadius = 0, flatSpots = [] } = opts;
  const rng = _mulberry32(seed);
  // 2-octave value noise on a coarse grid, bilinearly sampled up to the mesh grid.
  const noiseRes = 12;
  const noiseGrid = [];
  for (let i = 0; i <= noiseRes; i++) {
    const row = [];
    for (let j = 0; j <= noiseRes; j++) row.push(rng() * 2 - 1);
    noiseGrid.push(row);
  }
  const noiseRes2 = 5;
  const noiseGrid2 = [];
  for (let i = 0; i <= noiseRes2; i++) {
    const row = [];
    for (let j = 0; j <= noiseRes2; j++) row.push(rng() * 2 - 1);
    noiseGrid2.push(row);
  }
  const sampleNoise = (grid, res, u, v) => {
    const gx = u * res, gy = v * res;
    const x0 = Math.floor(gx), y0 = Math.floor(gy);
    const x1 = Math.min(res, x0 + 1), y1 = Math.min(res, y0 + 1);
    const fx = gx - x0, fy = gy - y0;
    const a = grid[x0][y0], b = grid[x1][y0], c = grid[x0][y1], d = grid[x1][y1];
    return (a * (1 - fx) + b * fx) * (1 - fy) + (c * (1 - fx) + d * fx) * fy;
  };

  const heightAt = (x, z) => {
    const u = (x / size) + 0.5, v = (z / size) + 0.5;
    if (u < 0 || u > 1 || v < 0 || v > 1) return 0;
    let h = sampleNoise(noiseGrid, noiseRes, u, v) * 0.6 + sampleNoise(noiseGrid2, noiseRes2, u, v) * 0.4;
    h *= amplitude;
    // Flatten near origin and any named flat spots so spawns/colliders/roads stay valid.
    const distOrigin = Math.hypot(x, z);
    if (flatRadius > 0 && distOrigin < flatRadius) {
      h *= Math.min(1, (distOrigin / flatRadius));
    }
    for (const spot of flatSpots) {
      const d2 = Math.hypot(x - spot.x, z - spot.z);
      if (d2 < spot.r) h *= Math.min(1, d2 / spot.r);
    }
    return h;
  };

  // updatable:true is required — without it, updateVerticesData silently no-ops
  // (mesh keeps its original flat bounding box and never visually deforms).
  const ground = BABYLON.MeshBuilder.CreateGround('terrain', { width: size, height: size, subdivisions, updatable: true }, scene);
  if (mat) ground.material = mat;
  ground.receiveShadows = true;

  const positions = ground.getVerticesData(BABYLON.VertexBuffer.PositionKind);
  const heights = new Float32Array((subdivisions + 1) * (subdivisions + 1));
  for (let i = 0; i < positions.length; i += 3) {
    const x = positions[i], z = positions[i + 2];
    const h = heightAt(x, z);
    positions[i + 1] = h;
    heights[i / 3] = h;
  }
  ground.updateVerticesData(BABYLON.VertexBuffer.PositionKind, positions);
  const normals = [];
  BABYLON.VertexData.ComputeNormals(positions, ground.getIndices(), normals);
  ground.updateVerticesData(BABYLON.VertexBuffer.NormalKind, normals);
  ground.refreshBoundingInfo();

  _terrain = { mesh: ground, size, subdivisions, heights };
  return ground;
}

export function getHeightAtXZ(x, z) {
  if (!_terrain) return 0;
  const { size, subdivisions, heights } = _terrain;
  const u = (x / size) + 0.5, v = (z / size) + 0.5;
  if (u < 0 || u > 1 || v < 0 || v > 1) return 0;
  const gx = u * subdivisions, gz = v * subdivisions;
  const x0 = Math.max(0, Math.min(subdivisions, Math.floor(gx)));
  const z0 = Math.max(0, Math.min(subdivisions, Math.floor(gz)));
  const x1 = Math.min(subdivisions, x0 + 1), z1 = Math.min(subdivisions, z0 + 1);
  const fx = gx - x0, fz = gz - z0;
  const n = subdivisions + 1;
  const a = heights[z0 * n + x0], b = heights[z0 * n + x1];
  const c = heights[z1 * n + x0], d = heights[z1 * n + x1];
  return (a * (1 - fx) + b * fx) * (1 - fz) + (c * (1 - fx) + d * fx) * fz;
}

export function clearTerrain() {
  if (_terrain) { _terrain.mesh.dispose(); _terrain = null; }
}

// ── SSAO (quality-gated) ──────────────────────────────────────────────────────
let _ssao = null;
export function setSSAO(on) {
  if (on && !_ssao && BABYLON.SSAO2RenderingPipeline && BABYLON.SSAO2RenderingPipeline.IsSupported) {
    _ssao = new BABYLON.SSAO2RenderingPipeline('ssao', scene, { ssaoRatio: 0.5, blurRatio: 1 }, [camera]);
    _ssao.radius = 1.6; _ssao.totalStrength = 0.9; _ssao.expensiveBlur = true; _ssao.samples = 16;
  } else if (!on && _ssao) {
    scene.postProcessRenderPipelineManager.detachCamerasFromRenderPipeline('ssao', camera);
    _ssao.dispose(); _ssao = null;
  }
}

// ── Procedural texture library re-export (src/textures.js) ───────────────────
// Re-exported here so map files (restricted to importing only engine.js/
// state.js/maps/index.js) can reach it without a direct dependency.
export { texPBR, pbrTex } from './textures.js';
