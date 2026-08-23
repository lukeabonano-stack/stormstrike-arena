# Visual Overhaul Plan — Rigged GLB Characters + Fortnite-Quality Worlds

This document is the complete build spec for the visual overhaul. A builder agent should be able to
start at Milestone M0 and work through M9 in order. Each milestone is independently shippable and
verifiable, and ends with the standard verification loop (§ Verification protocol).

**Confirmed decisions (do not re-ask):**
- Characters: real rigged GLB models — KayKit hero roster (CC0). Verified downloadable + parsed.
- Scope: shared engine upgrade benefits all 30 maps; deep rework of 4 flagships: metro, desert, apocalypse, lobby.
- Order: characters first (M0–M3), then world (M4–M5), then flagship maps (M6–M9).
- Permanent fallback: the primitive-box rig stays in the codebase. If assets fail to load
  (`assetsReady === false`) or `localStorage['sniperstrike-classic-rigs']` is set, the game runs
  exactly as today.

---

## 0. Hard constraints (from CLAUDE.md — violating these is a build failure)

- `src/state.js` and `src/engine.js` are dependency leaves — they import NOTHING from the game.
- New modules `src/assets.js`, `src/character.js`, `src/textures.js` may import ONLY from
  `engine.js` (and `state.js` if needed). They must NOT import game modules.
- `combat.js` never imports `enemies.js` statically and vice versa; `main.js` wires callbacks.
- Map files import only from `engine.js`, `state.js`, `maps/index.js` (and now `assets.js` for props — treat `assets.js` as a leaf-level utility like engine.js).
- All new localStorage keys use the `sniperstrike-` prefix. New keys in this plan:
  `sniperstrike-quality`, `sniperstrike-classic-rigs`.
- No build step. Vanilla ES modules + Babylon UMD globals (`BABYLON.*`).
- After EVERY edit batch: `export NVM_DIR="$HOME/.nvm"; [ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"; node --check src/<file>.js` for every touched file.
- Playwright is at `/Users/lukebonano/.npm/_npx/e41f203b7505f1fb/node_modules/playwright`.
  Use `dispatchEvent(new MouseEvent('click', {bubbles:true}))`, never `.click()`.
- Test server: `python3 -m http.server 8934` from repo root; always kill after tests
  (`lsof -ti:8934 | xargs kill -9`).

---

## 1. Assets (verified sources — the Plan phase streamed and parsed these GLBs)

### 1.1 Character models (KayKit, CC0, GitHub raw — curl works)

Heroes (Adventurers pack) — each is a single-file .glb ~3.6 MB with **76 embedded AnimationGroups**:

```
BASE=https://raw.githubusercontent.com/KayKit-Game-Assets/KayKit-Character-Pack-Adventures-1.0/main/addons/kaykit_character_pack_adventures/Characters/gltf
curl -fL -o assets/models/characters/Knight.glb        $BASE/Knight.glb
curl -fL -o assets/models/characters/Barbarian.glb     $BASE/Barbarian.glb
curl -fL -o assets/models/characters/Mage.glb          $BASE/Mage.glb
curl -fL -o assets/models/characters/Rogue.glb         $BASE/Rogue.glb
curl -fL -o assets/models/characters/Rogue_Hooded.glb  $BASE/Rogue_Hooded.glb
```

Skeletons (Skeletons pack) — same rig, **95 animations**, includes glowing-eye `Glow` material.
These are the apocalypse-map zombies:

```
SBASE=https://raw.githubusercontent.com/KayKit-Game-Assets/KayKit-Character-Pack-Skeletons-1.0/main/addons/kaykit_character_pack_skeletons/Characters/gltf
curl -fL -o assets/models/characters/Skeleton_Minion.glb   $SBASE/Skeleton_Minion.glb
curl -fL -o assets/models/characters/Skeleton_Rogue.glb    $SBASE/Skeleton_Rogue.glb
curl -fL -o assets/models/characters/Skeleton_Warrior.glb  $SBASE/Skeleton_Warrior.glb
curl -fL -o assets/models/characters/Skeleton_Mage.glb     $SBASE/Skeleton_Mage.glb
```

**Verified facts the builder can rely on:**
- Animation names (subset we use): `Idle`, `Walking_A`, `Walking_B`, `Walking_C`, `Running_A`,
  `Running_B`, `Death_A`, `Death_B`, `Hit_A`, `Hit_B`, `1H_Ranged_Shoot`, `2H_Ranged_Shoot`,
  `2H_Ranged_Aiming`, `Unarmed_Melee_Attack_Punch_A`, `Cheer`, `T-Pose`.
- Bone/joint node names (glTF joints load as TransformNodes in Babylon):
  `root, hips, spine, chest, head, upperarm.l, upperarm.r, lowerarm.l, lowerarm.r, wrist.l,
  wrist.r, hand.l, hand.r, upperleg.l, upperleg.r, lowerleg.l, lowerleg.r, foot.l, foot.r`
  plus weapon anchors **`handslot.l` and `handslot.r`**.
- Per-body-part meshes named like `Knight_ArmLeft, Knight_ArmRight, Knight_Body, Knight_Head,
  Knight_LegLeft, Knight_LegRight` + accessory meshes (`Knight_Helmet` under head bone,
  `Knight_Cape` under chest, shields under handslot.l).
- One palette-texture material per character (e.g. `knight_texture`) — tint by cloning the
  material and multiplying `albedoColor`.

### 1.2 Prop + weapon packs (CC0). `.gltf` props have sidecar `.bin`/texture files — download each
repo's tarball and extract only the gltf dirs to keep sidecars intact:

```
# pattern per repo:
curl -fL https://api.github.com/repos/KayKit-Game-Assets/<REPO>/tarball | tar -xz -C /tmp/kaykit
# then copy the gltf folder into assets/models/props/<category>/
```

- `KayKit-City-Builder-Bits-1.0` → `assets/models/props/city/` (buildings A–H, car_sedan,
  car_police, car_hatchback, trees, bushes, benches)
- `KayKit-Halloween-Bits-1.0` → `assets/models/props/halloween/` (gravestones, crypts, coffins,
  broken fences, lanterns, bone piles)
- `KayKit-Space-Base-Bits-1.0` → `assets/models/props/space/` (base modules, cargo containers,
  landing pads)
- From the Adventurers repo: `axe_2handed.gltf` (+ sidecars) → `assets/models/weapons/`

### 1.3 Loader scripts + local IBL

`index.html` — add immediately after the existing babylon.js `<script>` (line 10):

```html
<script src="https://cdn.babylonjs.com/loaders/babylonjs.loaders.min.js"></script>
<script src="https://cdn.babylonjs.com/materialsLibrary/babylonjs.materials.min.js"></script>
```

Both verified HTTP 200, same origin as the existing tag. Also copy the IBL env locally:
`curl -fL -o assets/env/environmentSpecular.env https://assets.babylonjs.com/environments/environmentSpecular.env`
and change engine.js to try the local path first, CDN as fallback.

---

## 2. New module: `src/assets.js`

Imports only from `engine.js` (`scene`, `previewScene`). API:

```js
export const CHAR_MANIFEST = {
  knight:      { url: 'assets/models/characters/Knight.glb' },
  barbarian:   { url: 'assets/models/characters/Barbarian.glb' },
  mage:        { url: 'assets/models/characters/Mage.glb' },
  rogue:       { url: 'assets/models/characters/Rogue.glb' },
  rogueHooded: { url: 'assets/models/characters/Rogue_Hooded.glb' },
  skelMinion:  { url: 'assets/models/characters/Skeleton_Minion.glb' },
  skelRogue:   { url: 'assets/models/characters/Skeleton_Rogue.glb' },
  skelWarrior: { url: 'assets/models/characters/Skeleton_Warrior.glb' },
  skelMage:    { url: 'assets/models/characters/Skeleton_Mage.glb' },
};

export let assetsReady = false;

export async function preloadAssets(onProgress /* (0..1) => void */) { ... }
export function instantiateCharacter(key, sc = scene) { ... }
export async function loadProp(relPath, sc = scene) { ... }   // cached AssetContainer
```

Implementation notes:
- `BABYLON.SceneLoader.LoadAssetContainerAsync('', url, scene)` per character. Containers are
  scene-bound: load ALL 9 into the main scene; load ONLY the hero character (used by the armory
  preview) into `previewScene` as a second container.
- `instantiateCharacter` uses
  `container.instantiateModelsToScene(n => n + '_' + (++uid), false, { doNotInstantiate: true })`
  → returns `{ rootNodes, skeletons, animationGroups }` per instance. Then clone the 1–2 materials
  and assign the clones to every mesh of the instance (per-instance tinting + fixes the shared
  freeze-VFX bug).
- Return shape:
  `{ root, skeleton, animGroups: Map<name, AnimationGroup>, nodes: {hips, chest, head, handL,
  handR, handSlotL, handSlotR, upperarmL, upperarmR, ...}, partMeshes, accessoryMeshes,
  materials }`.
  Build `nodes` by walking transform nodes and matching the verified bone names.
- **Height normalization** (critical): after first load of each container, compute the hierarchy
  bounding box; store `normScale = 2.05 / height`. On instantiate, apply to the wrapper so the
  head bone lands at world y ≈ 1.75. This preserves every existing spatial assumption: enemy hit
  bands (`relY 1.4–2.2`), hp-bar offset (`y + 3.2*scale`), armor plate coords (torso y 0.9–1.25),
  camera framing.
- **Orientation**: glTF loader wraps models in `__root__` with a Z-flip. Wrap in our own
  TransformNode; if the model faces −Z visually, bake `rotation.y = Math.PI` on `__root__`.
  Verify facing in M1's first screenshot before proceeding.
- On any load failure: `console.warn`, leave `assetsReady = false`, resolve normally. The game
  must boot and play with primitive rigs in that case.

**Loading UI**: add `#loading-screen` div to index.html (full-screen dark overlay, game title,
progress bar `#loading-bar-fill`, "Loading assets…" label) + styles.css rules. main.js drives it:

```js
showLoadingScreen();
await preloadAssets(p => { document.getElementById('loading-bar-fill').style.width = (p*100)+'%'; });
hideLoadingScreen();
```

---

## 3. New module: `src/character.js` — rigged rig with the legacy contract

### 3.1 The contract (must hold exactly)

`createRiggedCharacter(opts, sc)` returns
`{ bodyGroup, head, hatMesh, armLeft, armRight, gun, legLeft, legRight }` — the same keys
`createCharacter` returns today (src/player.js:148). Consumers that must keep working unmodified:
- `enemies.js:72-79` — destructures the contract; `enemy.parts = {armLeft, armRight, legLeft, legRight, head}`
- `armory/emotes.js` — 12 pose functions write `parts.<key>.rotation.x/y/z`
- `controls.js:264-286` — walk cycle + rest resets on playerArm/Leg refs; `:245-250` minigun `playerGun.barrelGroup`
- `main.js:167-175` — emote runner rest resets
- `armory/weapons.js:34-41` — `rebuildGunVisual(gunNode, buildFn)` rebuilds children under `gun`, restores `gun.muzzle`

### 3.2 The rotationQuaternion problem and the PoseAdapter solution

glTF joints animate via `rotationQuaternion`; assigning `.rotation.x` (Euler) on such a node is
silently ignored by Babylon. All existing pose code writes Euler AND assumes the primitive rig's
rest angles (armLeft rest `π/10`, armRight rest `(-1.25, 0, 0.15)`, legs/head rest 0 — duplicated
in emotes.js, controls.js, main.js, enemies.js).

**PoseAdapter** (one per contract key, for keys head/armLeft/armRight/legLeft/legRight):

```js
class PoseAdapter {
  constructor(joint, restQuat, legacyRestEuler, axisRemap) {
    this.rotation = legacyRestEuler.clone();   // a REAL Vector3 — callers mutate it like before
    this.position = joint.position;            // pass-through for any position reads
    ...
  }
  apply() {  // called from the rig's onBeforeRenderObservable, only while pose mode is active
    const d = this.rotation.subtract(this.legacyRestEuler);           // rest write ⇒ zero delta
    this.joint.rotationQuaternion = this.restQuat.multiply(
      BABYLON.Quaternion.FromEulerAngles(...this.axisRemap(d)));
  }
}
```

- `restQuat` captured from the model's `Idle` first frame at instantiate time.
- `axisRemap` is a per-bone-axis mapping function/matrix (KayKit limb bones point down the limb —
  the legacy rig's `rotation.x` "swing forward" must map to the equivalent bone axis). Tune ONCE
  visually in M1 with a pose test page (set each adapter axis to ±0.8 and screenshot).
- Writing the legacy rest values produces the model's natural rest pose ⇒ the rest-reset lines in
  controls.js:282 / main.js:171-172 become no-ops, exactly as intended.

### 3.3 ANIM vs POSE mode (per rig)

```js
rig.playAnim(name, { loop = true, speedRatio = 1 })  // stops others, plays clone's group
rig.enterPoseMode(keys = ['armLeft','armRight','legLeft','legRight','head'])
rig.exitPoseMode()                                   // resume Idle
rig.playDeath(onDone)                                // Death_A|B once, then onDone()
```

- Set once globally: `scene.animationPropertiesOverride = { enableBlending: true, blendingSpeed: 0.1 }`.
- **Player right arm exception**: when cloning the player's `Idle`/`Walking_A` groups, filter OUT
  `targetedAnimations` whose target node name is `upperarm.r`, `lowerarm.r`, `hand.r`, or
  `handslot.r` (build a filtered AnimationGroup from the remainder). The right arm is then
  permanently adapter-driven, so aiming and recoil code work untouched while legs/torso animate.
- Emotes: main.js emote start → `rig.enterPoseMode()`; emote end → `rig.exitPoseMode()`.
  emotes.js itself is untouched (adapters absorb everything).
- Zombie-boss axe swing (enemies.js:439-455) writes arm rotations — works via adapters in pose
  mode; put zombies in pose mode for arms only, let legs run `Walking_C`.

### 3.4 Contract key details

- `bodyGroup` — our own TransformNode wrapper (contains normalized `__root__`). Position,
  `rotation.y`, `scaling` manipulated by AI/death/VIP-giant code all work. Non-uniform pink-boss
  scaling `(4.0, 2.2, 4.0)` applies to the wrapper; if skinned distortion looks broken in M2,
  reduce to `(2.6, 2.0, 2.6)`.
- `gun` — TransformNode parented to `nodes.handSlotR` with corrective rotation so +Z = forward,
  offsets ≈ 0 (the slot already sits in the palm). Child `muzzle` TransformNode recreated exactly
  as today. Weapon builders/skins need zero changes.
- `hatMesh` — the model's helmet/hood accessory mesh if present, else a tiny hidden stub mesh
  (so `hatMesh.scaling.setAll(0.001)` in applyMidasDetails-adjacent code and the material
  assignment at enemies.js:75-76 don't crash; for rigged enemies skip the helmet material swap).
- `head` — PoseAdapter; also expose `head.node = nodes.head` (bone TransformNode) for parenting
  (medic cross at enemies.js:114-120 reparents to `head.node`; speech bubbles use bodyGroup and
  are unaffected).

### 3.5 `ENEMY_VARIANTS` table (in character.js)

```js
export const ENEMY_VARIANTS = {
  grunt:  { model:'knight',      tint:0xa03030, acc:{helmet:.7, cape:0},  body:[1,1,1] },
  rusher: { model:'rogue',       tint:0xff8c1a, acc:{hood:.8},            body:[0.92,0.96,0.92] },
  heavy:  { model:'barbarian',   tint:0x3a4a3a, acc:{shield:.5},          body:[1.35,1.15,1.35] },
  boss:   { model:'barbarian',   tint:0x6a1bb0, emissive:0x6a1bb0, acc:{cape:1}, body:[1.2,1.2,1.2] },
  sniper: { model:'rogueHooded', tint:0x225522 },
  bomber: { model:'rogue',       tint:0xcc4400, emissive:0xff3300 },   // emissiveIntensity ramps with fuse
  medic:  { model:'mage',        tint:0xeeeeee, crossDecal:true },
};
export const ZOMBIE_VARIANTS = { grunt:'skelMinion', rusher:'skelRogue', heavy:'skelWarrior',
                                 sniper:'skelRogue', bomber:'skelMinion', medic:'skelMage', boss:'skelWarrior' };
```

Per-spawn randomization: tint hue jitter ±8°, accessory dice-rolls (`acc` values are
probabilities), body jitter ±5% x/z ±3% y multiplied under the type profile. Per-part material
treatment where the palette allows: leather (rough 0.75, metal 0.05), cloth (0.85, 0), metal
plates (0.25, 0.85).

---

## 4. Integration changes (existing files)

### 4.1 `src/player.js`
- Rename internal `createCharacter` → keep exported name (it IS the fallback path).
- New `buildPlayerRig()`: if `assetsReady && !localStorage.getItem('sniperstrike-classic-rigs')`
  → `createRiggedCharacter({ model:'knight', hero:true })` — gold-tinted material, cape on,
  SKIP `buildPlayerFaceDetails` + `applyMidasDetails` (they're the old look; primitive path keeps
  them). Else → current primitive path, unchanged.
- All exports keep identical names (`playerBody`, `playerArmLeft`, …, `playerParts`).
- `applyVipState`/giant mode: unchanged (wrapper scaling).
- Preview rig (player.js:468-487): rigged instance from the previewScene container, `Idle` loop.

### 4.2 `src/enemies.js`
- `spawnEnemy`: if rigged mode → `createRiggedCharacter({ ...ENEMY_VARIANTS[type] })` (or
  `ZOMBIE_VARIANTS` when `gs.mapId === 'apocalypse'`); else current path. Contract destructure
  line stays identical.
- Delete the sine walk block (enemies.js:655-663) in rigged mode → speed-based clip selection:
  `speed < 0.2` Idle, `< 2.6` Walking_A, else Running_A; `group.speedRatio = enemy.speed / 2.0`.
- `applyZombieLook`: rigged mode = just uses skeleton models (no material-identity swapping);
  keep `_isZombie`, melee AI, `shootTimer = Infinity`. Skeleton eye `Glow` material →
  `glowLayer.referenceMeshToUseItsOwnMaterial(eyeMesh)` + boosted emissive.
- Pink boss: skelWarrior + pink tint (0xff88aa), wrapper scale as today, 300 HP unchanged,
  `buildZombieBossAxe(enemy)` unchanged (builds into `enemy.gun` which now rides handslot.r) —
  optional upgrade to the real `axe_2handed.gltf` prop via `loadProp`.
- Freeze VFX (enemies.js:369-383): works as-is but now mutates per-instance clones (bug fixed
  structurally). Keep the code identical.
- Distance-tier animation throttling in `updateEnemies` (see §6 Perf).

### 4.3 `src/combat.js`
- `defeatEnemy` / death-fall observable (~:621-638): rigged → `enemy.playDeath(() => {...existing
  puddle + linger + dispose...})`; primitive → existing rotation-fall. combat.js still never
  imports enemies.js — `playDeath` is a method ON the entity.
- Hit detection: NO CHANGES (pure distance math vs positions + radii — survives by design).

### 4.4 `src/controls.js`
- `animatePlayer()`: rigged branch — `playerRig.playAnim(moving ? 'Walking_A' : 'Idle')`;
  keep dodge-roll body-tilt code (wrapper rotation.z — fine). Legacy sine path behind the flag.
- Minigun barrelGroup spin: unchanged.

### 4.5 `src/main.js`
- Loading screen + `await preloadAssets()` before `initArmory()`/start-screen reveal.
- Emote runner (:167-175): add `enterPoseMode()` on emote start, `exitPoseMode()` on end.
  Keep the rest-reset lines (they're harmless no-ops through adapters).

### 4.6 `src/armory/*`
- `armor.js`: `buildArmorMesh(key, anchors?)` — optional anchors `{chest, upperarmL, upperarmR}`;
  when provided, parent chest plates to chest bone, pauldrons to upperarm bones (they ride
  animation). Without anchors: current bodyGroup-local behavior (positions still valid thanks to
  height normalization).
- `clothes.js`: `applyClothesAccessories` — pass bone nodes (head/chest) as parents in rigged mode.
  `applyClothesMaterialStyle` targets the player's cloned primary material; keep the
  `playerClothMat` export name as an alias to it.
- `weapons.js`, `skins.js`: zero changes.
- `emotes.js`: zero changes.
- `index.js` preview loop: unchanged (rotates `previewRig.bodyGroup`).

---

## 5. World upgrade — `src/engine.js`, new `src/textures.js`, `src/maps/index.js`

### 5.1 Sky — `setSky(preset)` in engine.js
- `{ mode:'gradient', top, horizon, stars?, clouds? }` → 512² canvas gradient → skybox
  (inverted 800-unit box, `infiniteDistance = true`, excluded from fog), OR
- `{ mode:'skymat', turbidity, luminance, inclination }` → `BABYLON.SkyMaterial` (materials lib), OR
- `'none'` → current clearColor behavior.
- Disposed + rebuilt on every `loadMap`.

### 5.2 Lighting presets — maps/index.js
Each MAPS entry MAY have:

```js
lighting: {
  sunDir: [-0.6,-1.2,-0.4], sunColor: 0xfff2d8, sunIntensity: 2.2,
  ambientIntensity: 0.55, ambientGround: 0x595f73, env: 0.6,
  sky: {...} | 'none', fog: { color, start, end } | null,
}
```

`loadMap()` calls `applyLightingPreset(def.lighting || DEFAULT_LIGHTING)` after teardown, before
`build()`. DEFAULT_LIGHTING = exactly today's values, so the 26 non-flagship maps look identical
(their internal `setFog` calls run later and win — leave them).

### 5.3 GlowLayer + SSAO2 — engine.js
- `export const glowLayer = new BABYLON.GlowLayer('glow', scene, { blurKernelSize: 32 });`
  `glowLayer.intensity = 0.55;` — automatic for all emissive materials.
- `setSSAO(on)` → `SSAO2RenderingPipeline('ssao', scene, { ssaoRatio: 0.5, blurRatio: 0.5 },
  [camera])`, `radius 1.8`, `totalStrength 0.9`; guarded by
  `BABYLON.SSAO2RenderingPipeline.IsSupported`.
- Quality setting `sniperstrike-quality` ∈ high|medium|low:
  high = SSAO + glow + shadow 2048; medium = glow only; low = neither + shadow 1024.
  Auto-step-down once if 3s rolling FPS < 40 (check in main.js render loop, throttled).

### 5.4 Procedural texture library — new `src/textures.js` (leaf; re-export via engine.js if convenient)

```js
export function texPBR(kind, opts = {})   // → cached { albedoTexture, bumpTexture }
export function pbrTex(kind, hex, roughness, metallic, opts = {})  // pbr() + textures + uv scale
```

Kinds: `brick, asphalt, concrete, sand, metalPlate, wood, ash, marble, snow`. 512² seeded canvases
(diffuse + grayscale-height-derived normal map — canvas Sobel pass). Cache by
`kind + JSON.stringify(opts)`. Maps migrate surface-by-surface:
`pbr(0x8a7a6a,.8,0)` → `pbrTex('brick', 0x8a7a6a, .8, 0, { uv: 4 })`.

### 5.5 Terrain — engine.js (or textures.js)

```js
export function makeTerrain({ size, subdivisions = 96, seed, amplitude,
                              flatRadius = 0, flatSpots = [] }, mat)  // → ground mesh
export function getHeightAtXZ(x, z)   // bilinear sample of active heightfield; 0 if none
export function clearTerrain()        // wired into loadMap teardown
```

- Implementation: `CreateGround` + `updateVerticesData(PositionKind)` with seeded value-noise
  (2 octaves, `mulberry32` seed — same convention as maps), then `createNormals`.
- `flatSpots: [{x, z, r}]` and `flatRadius` (around origin) lerp height→0 so spawns, roads, store
  interiors, and 2D wall-collider AABBs stay valid.
- Movement hooks (only active when a terrain exists):
  - controls.js after x/z resolution (~:227): `playerBody.position.y += (getHeightAtXZ(px,pz) + BASE_Y - playerBody.position.y) * 0.35;`
  - enemies.js move block: same one-liner per enemy.
  - combat.js: grenade bounce + bullet ground-hit checks compare vs `getHeightAtXZ` instead of 0
    (2 call sites).

### 5.6 Static optimization — maps/index.js
`finalizeMapStatics()` at the end of `loadMap()`: for every mesh under `activeMapGroups` —
`freezeWorldMatrix()`, `doNotSyncBoundingInfo = true`, `isPickable = false`, and
`material.freeze()` unless `material._noFreeze` (set that flag on all DynamicTexture-bearing
materials: conveyors, signs, screens). Instancing helper for decor repetition
(trees/cacti/graves): `createInstance` from a template — safe because colliders are separate AABBs.

---

## 6. Performance budget (horde mode = up to ~105 concurrent skeletal enemies)

1. GPU skinning is Babylon default (`computeBonesUsingShaders`) — keep it.
2. `alwaysSelectAsActiveMesh = true` on enemy meshes (skip frustum churn for many small meshes).
3. Distance-tiered animation in `updateEnemies`:
   - dist < 35: animate every frame.
   - 35–75: pause the group; accumulate per-enemy timer; `goToFrame` manually at 15 Hz.
   - > 75: frozen pose (paused group); resume on approach.
4. Death animations: cap 8 concurrent; beyond → instant blood puddle + hide (current behavior).
5. M2 acceptance gate: Playwright FPS probe in horde mode ≥ 45 fps. If missed: tier-1 radius → 25,
   tier-2 rate → 10 Hz, re-measure.

---

## 7. Flagship map specs (M6–M9)

### M6 metro.js — New York City
- Building walls → `pbrTex('brick'|'concrete')` + emissive window-grid canvas texture (lit windows).
- Roads → asphalt texture with painted lane dashes + crosswalks (1024² canvas, uv-tiled); curb strips.
- KayKit city buildings at key intersections; `car_sedan/police/hatchback` replace primitive cars
  (instanced; keep existing car colliders).
- Preset: late-afternoon warm sun (0xffd9a8, 2.6), gradient sky with clouds, light haze fog;
  streetlamp emissive bulbs (GlowLayer picks up).
- Church: stained-glass emissive canvas windows + god-ray cones (additive alpha) for the divine
  healing event.

### M7 desert.js
- `makeTerrain({ size: 240, amplitude: 3.5, flatRadius: 45, flatSpots: [oasis, 3 stores] })` +
  `texPBR('sand')` ripple bump. Combat bowl near-flat.
- SkyMaterial daytime sky, low sun; fog moved to preset, end pushed to 140 (sniper sightlines).
- Mesas: layered sandstone canvas texture; instanced cacti + palms.
- Oasis: scrolling-bump fresnel water plane.

### M8 apocalypse.js
- Zombies = skeleton models (ZOMBIE_VARIANTS) with GlowLayer eyes; pink boss + real 2H axe model.
- Halloween-Bits graves/crypts/broken fences/coffins replace `buildCorpsePile` primitives (instanced).
- Cracked-asphalt + ash textures; burnt shells + rubble; ember particles; 2–3 flickering emissive
  fires (animated emissiveIntensity).
- Preset: blood-red gradient sky, cold moonlight sun (0x8899cc, 1.2), heavy smoke fog (moves
  current 0x1a1208 fog into registry). Terrain rubble amplitude 0.6, flat under roads/buildings.

### M9 lobby.js
- Space-Base props framing the hall outside play bounds (no collider changes).
- Floor → glossy `texPBR('metalPlate')`, high env reflectivity; tube rings + conveyor strips into
  GlowLayer.
- 4–6 idle rigged NPC characters near tubes cycling `Idle`/`Cheer`/emotes — instant showcase.
- Night starfield skybox; animated jumbotron canvas screens on the existing `_screen` hook points.
- **Bug to fix while here**: the conveyor arrow texture is hidden — `_conveyor()` in maps/lobby.js
  places a glow cover box (`CONV_W + 0.2` wide) at y=0.17 ON TOP of the textured belt (top surface
  y=0.15). Remove that cover box or make it a thin border frame so the scrolling arrows show.

---

## 8. Milestones — build order

| M | Scope | Risk | Key acceptance |
|---|-------|------|----------------|
| M0 | Download all assets into `assets/`; script tags; `src/assets.js`; loading screen; CLAUDE.md update | Low | Console lists 9 chars × anim counts; game plays unchanged; lobby renders |
| M1 | `src/character.js` (PoseAdapter + modes); player rig swap; controls branch; emote hooks; armory preview | **Highest** (axis remap, facing, arm filter) | Screenshots: idle/walk/aim + every emote in armory AND in-game; gun in hand; minigun spin; giant mode |
| M2 | Rigged enemies + variants + per-instance materials; anim state machine; death anims; zombie skeletons + boss; throttle tiers | High (perf) | Normal map + apocalypse screenshots; horde FPS ≥ 45; boss axe swing works |
| M3 | Armory deep-compat: bone anchoring for armor/clothes; 11-weapon × skin regression | Med | Per-tab armory screenshots; every weapon/skin/armor/clothes/emote equips clean |
| M4 | Sky, lighting presets, GlowLayer, SSAO2 + quality setting, texture library, finalizeMapStatics | Med (SSAO perf, freeze on dynamic tex) | 8-map screenshot sweep; before/after FPS; no map regresses |
| M5 | Terrain system + movement hooks (dormant until opt-in) | Med | Test dunes: player+enemies walk slopes; grenades/bullets land correctly |
| M6 | Metro rework | Low | Screenshots + level-1 playthrough + divine healing event |
| M7 | Desert rework (first terrain consumer) | Med | Screenshots + playthrough on dunes |
| M8 | Apocalypse rework | Low | Screenshots + zombie wave + pink boss fight |
| M9 | Lobby rework (+ conveyor arrow fix) | Low | Screenshots + tube countdown → map picker flow |

Every milestone is git-commit-sized. Recommended: one commit per milestone.

## 9. Verification protocol (every milestone)

1. `export NVM_DIR="$HOME/.nvm"; [ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"; node --check <every touched src file>`
2. `lsof -ti:8934 | xargs kill -9 2>/dev/null; python3 -m http.server 8934 &` (repo root)
3. Playwright (path in §0): load page, assert no `pageerror`, drive the flow for the milestone's
   acceptance items, screenshot to the session scratchpad, read the screenshots and LOOK at them.
4. FPS probe where required: `scene.getEngine().getFps()` sampled over 3s via `page.evaluate`.
5. `lsof -ti:8934 | xargs kill -9` — always kill the server.
6. Remove any temporary `window.__debugGame` hooks before finishing the milestone.

## 10. Rollback strategy

- `assetsReady === false` (load failure) → automatic primitive-rig fallback, zero code changes needed.
- `localStorage.setItem('sniperstrike-classic-rigs', '1')` → manual fallback for A/B comparison.
- World: maps without a `lighting` preset render exactly as today; terrain is opt-in per map;
  quality setting can disable SSAO/glow independently.
- CLAUDE.md must be updated in M0 (assets dir, loader scripts, new modules) and at the end of M9
  (final architecture notes).
