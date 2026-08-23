// ── assets.js  Quaternius rigged humans + shared animation library ────────────
// Leaf-level utility: imports ONLY from engine.js.
//
// Pipeline: Quaternius "Universal Base Characters" (realistic-proportioned,
// Fortnite-shaped humans) are rigged with an Unreal-style skeleton (hand_l,
// spine_03, thigh_l …). The Quaternius "Universal Animation Library" (46 clips
// — idle, walk, jog, sprint, pistol aim/shoot, death, dance, punch, sword) is
// authored on the SAME rig exported with Rigify DEF- names. We retarget the
// clips onto each character instance by a static DEF-→UE bone-name map (rest
// poses are identical, so no orientation correction is needed — verified).

import { scene, previewScene } from './engine.js';

// ── Manifests ─────────────────────────────────────────────────────────────────
const BASE_BODIES = {
  male:   'assets/models/quaternius/Superhero_Male_FullBody.gltf',
  female: 'assets/models/quaternius/Superhero_Female_FullBody.gltf',
};
const HAIR = {
  long:         'assets/models/quaternius/hair/Hair_Long.gltf',
  buzzed:       'assets/models/quaternius/hair/Hair_Buzzed.gltf',
  buns:         'assets/models/quaternius/hair/Hair_Buns.gltf',
  beard:        'assets/models/quaternius/hair/Hair_Beard.gltf',
  simpleParted: 'assets/models/quaternius/hair/Hair_SimpleParted.gltf',
  buzzedFemale: 'assets/models/quaternius/hair/Hair_BuzzedFemale.gltf',
};
const ANIM_LIB_URL = 'assets/models/anim/AnimationLibrary.gltf';

// Only the clips the game actually uses (keeps per-instance retarget cheap).
export const CLIPS = {
  idle:      'Idle_Loop',
  pistolIdle:'Pistol_Idle_Loop',
  walk:      'Walk_Loop',
  jog:       'Jog_Fwd_Loop',
  sprint:    'Sprint_Loop',
  death:     'Death01',
  hit:       'Hit_Chest',
  aim:       'Pistol_Aim_Neutral',
  shoot:     'Pistol_Shoot',
  reload:    'Pistol_Reload',
  dance:     'Dance_Loop',
  punch:     'Punch_Cross',
  sword:     'Sword_Attack',
};
const USED_CLIP_NAMES = new Set(Object.values(CLIPS));

// DEF- (animation library) → UE (base character) bone-name map.
const DEF_TO_UE = (() => {
  const m = {
    'root': 'root', 'DEF-hips': 'pelvis',
    'DEF-spine.001': 'spine_01', 'DEF-spine.002': 'spine_02', 'DEF-spine.003': 'spine_03',
    'DEF-neck': 'neck_01', 'DEF-head': 'Head',
    'DEF-shoulder.L': 'clavicle_l', 'DEF-upper_arm.L': 'upperarm_l',
    'DEF-forearm.L': 'lowerarm_l', 'DEF-hand.L': 'hand_l',
    'DEF-shoulder.R': 'clavicle_r', 'DEF-upper_arm.R': 'upperarm_r',
    'DEF-forearm.R': 'lowerarm_r', 'DEF-hand.R': 'hand_r',
    'DEF-thigh.L': 'thigh_l', 'DEF-shin.L': 'calf_l', 'DEF-foot.L': 'foot_l', 'DEF-toe.L': 'ball_l',
    'DEF-thigh.R': 'thigh_r', 'DEF-shin.R': 'calf_r', 'DEF-foot.R': 'foot_r', 'DEF-toe.R': 'ball_r',
  };
  for (const f of ['index', 'middle', 'pinky', 'ring'])
    for (const n of ['01', '02', '03'])
      for (const s of ['L', 'R']) m[`DEF-f_${f}.${n}.${s}`] = `${f}_${n}_${s.toLowerCase()}`;
  for (const n of ['01', '02', '03'])
    for (const s of ['L', 'R']) m[`DEF-thumb.${n}.${s}`] = `thumb_${n}_${s.toLowerCase()}`;
  return m;
})();

// Friendly node keys the rig layer consumes → UE bone name.
const NODE_KEYS = {
  head: 'Head', neck: 'neck_01', chest: 'spine_03', hips: 'pelvis',
  upperarmL: 'upperarm_l', upperarmR: 'upperarm_r',
  forearmL: 'lowerarm_l', forearmR: 'lowerarm_r',
  handL: 'hand_l', handR: 'hand_r',
  upperlegL: 'thigh_l', upperlegR: 'thigh_r',
  lowerlegL: 'calf_l', lowerlegR: 'calf_r',
  footL: 'foot_l', footR: 'foot_r',
};

const TARGET_HEIGHT = 1.95;

// Empirical hair-placement correction — see the GOTCHA note in the hair
// attachment block below for why this is needed at all.
let HAIR_OFFSET = new BABYLON.Vector3(0, -0.14, -0.03);

export let assetsReady = false;

// scene → { bodies:Map, hair:Map, animContainer }
const _stores = new Map();
let _uid = 0;

function _store(sc) {
  if (!_stores.has(sc)) _stores.set(sc, { bodies: new Map(), hair: new Map(), anim: null });
  return _stores.get(sc);
}

async function _loadInto(sc, url) {
  return BABYLON.SceneLoader.LoadAssetContainerAsync('', url, sc);
}

// ── Preload ───────────────────────────────────────────────────────────────────
export async function preloadAssets(onProgress) {
  if (!BABYLON.SceneLoader) { console.warn('[assets] loaders missing'); return false; }
  const scenes = [scene, previewScene];
  const jobs = [];
  for (const sc of scenes) {
    jobs.push({ sc, kind: 'anim', url: ANIM_LIB_URL });
    for (const [k, url] of Object.entries(BASE_BODIES)) jobs.push({ sc, kind: 'body', key: k, url });
    for (const [k, url] of Object.entries(HAIR))        jobs.push({ sc, kind: 'hair', key: k, url });
  }
  let done = 0;
  try {
    for (const j of jobs) {
      const c = await _loadInto(j.sc, j.url);
      const st = _store(j.sc);
      if (j.kind === 'anim') { c.meshes.forEach(m => m.setEnabled(false)); st.anim = c; }
      else if (j.kind === 'body') st.bodies.set(j.key, c);
      else st.hair.set(j.key, c);
      if (++done && onProgress) onProgress(done / jobs.length);
    }
  } catch (e) {
    console.warn('[assets] load failed — primitive rigs:', e && e.message);
    return false;
  }
  assetsReady = true;
  const st = _store(scene);
  console.log(`[assets] Quaternius ready: ${st.bodies.size} bodies, ${st.hair.size} hairstyles, ` +
              `${st.anim ? st.anim.animationGroups.length : 0} animations`);
  return true;
}

// Cache normalization scale per body key.
const _normScale = {};

// ── Instantiate a character ───────────────────────────────────────────────────
// opts: { body:'male'|'female', hair, skinTint, tint, bodyScale:[x,y,z], sc }
// Returns { root, nodes, animGroups:Map(friendlyClip→group), bodyMeshes,
//           materials, hairMat, skinMat, normScale }
export function instantiateCharacter(opts = {}, sc = scene) {
  const st = _store(sc);
  const bodyKey = opts.body || 'male';
  const bodyC = st.bodies.get(bodyKey);
  if (!bodyC || !st.anim) return null;

  const suffix = '__q' + (++_uid);
  const inst = bodyC.instantiateModelsToScene(n => n + suffix, false, { doNotInstantiate: true });
  const root = inst.rootNodes[0];

  // Index nodes + collect meshes/materials
  const nodes = {};
  const byBase = {};
  for (const n of root.getDescendants()) byBase[n.name.split('__q')[0]] = n;
  for (const [key, ue] of Object.entries(NODE_KEYS)) if (byBase[ue]) nodes[key] = byBase[ue];

  const bodyMeshes = [], mats = [];
  let skinMat = null;
  const seen = new Set();
  for (const m of inst.rootNodes[0].getChildMeshes(false)) {
    bodyMeshes.push(m);
    if (m.material && !seen.has(m.material)) {
      seen.add(m.material);
      const clone = m.material.clone(m.material.name + suffix);
      mats.push({ src: m.material, clone });
    }
  }
  for (const m of bodyMeshes) {
    const f = mats.find(x => x.src === m.material);
    if (f) {
      m.material = f.clone;
      if (/Superhero/i.test(f.clone.name)) skinMat = f.clone;
      // Eyebrows share the same "hair" material slot as the imported hairstyle
      // texture (both come through named MI_Hair_1), but this is the body's
      // OWN baked eyebrow texture — never touched by hairColor. Its albedoColor
      // defaults to white (pure texture passthrough), and the baked texture
      // reads grey; multiply-tint it brown so brows match natural hair color.
      if (/Eyebrow/i.test(m.name) && f.clone.albedoColor) {
        f.clone.albedoColor = BABYLON.Color3.FromHexString('#4a2f1a');
      }
    }
  }

  // Height normalization (cache per body)
  if (!_normScale[bodyKey]) {
    const bv = root.getHierarchyBoundingVectors(true);
    const h = bv.max.y - bv.min.y;
    _normScale[bodyKey] = h > 0.01 ? TARGET_HEIGHT / h : 1;
  }
  const normScale = _normScale[bodyKey];

  // Retarget the used animation clips onto this instance's bones.
  const animGroups = new Map();
  for (const g of st.anim.animationGroups) {
    if (!USED_CLIP_NAMES.has(g.name)) continue;
    const clone = g.clone(g.name + suffix, (oldTarget) => {
      const ue = DEF_TO_UE[oldTarget.name && oldTarget.name.split('__')[0]];
      return (ue && byBase[ue]) || oldTarget;
    });
    clone.stop();
    // Friendly key lookup
    const friendly = Object.keys(CLIPS).find(k => CLIPS[k] === g.name);
    animGroups.set(friendly || g.name, clone);
  }

  // Skin tint multiplies the skin texture (keeps detail/shading) — used for
  // natural per-character skin tone and for zombie mutant skin. Clothing is
  // real geometry layered on afterward via character.js `applyOutfit`, never
  // a skin-texture replacement (which would recolor the face too).
  if (opts.tint !== undefined && skinMat && skinMat.albedoColor) {
    skinMat.albedoColor = BABYLON.Color3.FromHexString('#' + opts.tint.toString(16).padStart(6, '0'));
  }

  // Hair — the "Origin at 0" hairstyle packs are authored in the SAME absolute
  // coordinate frame as the un-normalized base body (verified: a fresh,
  // independently-rendered hair mesh's vertices sit at world Y≈1.6-1.8,
  // matching the head bone's own Y≈1.6 directly).
  //
  // GOTCHA: `instantiateModelsToScene`'s rootNodes[0] is NOT the hair mesh —
  // it's Babylon's synthetic `__root__` wrapper that every glTF load gets,
  // carrying a baked-in 180°-Y rotation + Z-flip (the generic right-handed→
  // left-handed coordinate fixup; verified via a direct node dump). The body
  // root has the IDENTICAL wrapper/correction. Parenting the hair's wrapper
  // (with its own correction) under the body's root (which ALREADY carries
  // the same correction) applies it twice — net rotate-720°/double-flip —
  // which is what sent hair flying off to hip height. Reach past the wrapper
  // to its actual mesh child (identity local transform) so only the body
  // root's correction applies, matching the standalone-render placement.
  let hairMat = null;
  if (opts.hair && st.hair.get(opts.hair)) {
    const hc = st.hair.get(opts.hair);
    const hinst = hc.instantiateModelsToScene(n => n + suffix + 'h', false, { doNotInstantiate: true });
    const hairWrapper = hinst.rootNodes[0];
    const hairRoot = hairWrapper.getChildren()[0] || hairWrapper;
    hairRoot.parent = root;
    // Empirically-tuned offset (marker-verified: bounding-box math alone put
    // hair ~0.15-0.3 units too high/back — the visible gap the head-bone
    // position doesn't fully explain). See HAIR_OFFSET tuning note below.
    hairRoot.position.copyFrom(HAIR_OFFSET);
    hairRoot.rotationQuaternion = null;
    hairRoot.rotation.set(0, 0, 0);
    hairRoot.scaling.set(1, 1, 1);
    if (hairRoot !== hairWrapper) hairWrapper.dispose();
    // The hair node is itself a mesh (verified — no further children), but
    // stay defensive in case a future hairstyle pack nests meshes deeper.
    const hairMeshes = hairRoot.getClassName?.().includes('Mesh')
      ? [hairRoot, ...hairRoot.getChildMeshes(true)]
      : hairRoot.getChildMeshes(true);
    for (const hm of hairMeshes) {
      if (hm.material) { hairMat = hm.material.clone(hm.material.name + suffix); hm.material = hairMat; }
    }
    if (opts.hairColor !== undefined && hairMat && hairMat.albedoColor) {
      hairMat.albedoColor = BABYLON.Color3.FromHexString('#' + opts.hairColor.toString(16).padStart(6, '0'));
    }
  }

  return {
    root, nodes, animGroups, bodyMeshes,
    materials: mats.map(m => m.clone), skinMat, hairMat, normScale,
    dispose() {
      for (const g of animGroups.values()) g.dispose();
      root.dispose();
    },
  };
}

// ── Map decor props (buildings, cars, street furniture) ──────────────────────
// Cached AssetContainer per path (main scene only — decor doesn't need a
// preview-scene copy). Loading is async and fire-and-forget from map builders;
// a prop that finishes after the player has already left the map is simply
// disposed unused (see the gs.mapId guard pattern used by callers).
const _propContainers = new Map();
let _propUid = 0;

export async function loadProp(relPath, sc = scene) {
  if (_propContainers.has(relPath)) return _propContainers.get(relPath);
  const p = BABYLON.SceneLoader.LoadAssetContainerAsync('', relPath, sc)
    .catch((e) => { console.warn('[assets] prop load failed:', relPath, e && e.message); return null; });
  _propContainers.set(relPath, p);
  return p;
}

export function instantiateProp(container, sc = scene) {
  if (!container) return null;
  const inst = container.instantiateModelsToScene(n => n + '__p' + (++_propUid), false, { doNotInstantiate: true });
  return inst.rootNodes[0] || null;
}
