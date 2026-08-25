# Weaponstrike Arena — Claude Notes

## Visual overhaul (M0–M9 COMPLETE — see VISUAL_OVERHAUL_PLAN.md in repo root)
Fortnite-quality upgrade. KayKit was tried then REPLACED with realistic Quaternius humans.

### Characters — Quaternius realistic humans (player, enemies, zombies, boss, armory)
- Assets in `assets/models/quaternius/` (Superhero_Male/Female_FullBody.gltf + hair/ + textures),
  shared animation library in `assets/models/anim/AnimationLibrary.gltf` (46 clips).
- **Two skeletons, one rig**: base bodies use Unreal bone names (`hand_r`, `spine_03`, `thigh_l`);
  the anim library uses Rigify `DEF-` names. Same rest pose → retarget by a static DEF-→UE name
  map (`DEF_TO_UE` in assets.js). Verified: identical rest pose, no orientation fix needed.
- `src/assets.js` (leaf; imports only engine.js): `preloadAssets(onProgress)`,
  `instantiateCharacter(opts, sc)` — instantiates a base body, retargets the used clips
  (`CLIPS` map: idle/pistolIdle/walk/jog/sprint/death/hit/aim/shoot/reload/dance/punch/sword)
  onto it, attaches hair to the body root (NOT the head bone — see gotcha below), applies `tint`
  (skin-tone multiply, texture-preserving; never a texture replacement — that recolors the face).
  Also `loadProp(path)`/`instantiateProp(container)` for map decor (buildings, cars, graves, cargo).
  Returns `{root, nodes(friendly UE keys), animGroups(friendly→group), bodyMeshes, skinMat, ...}`.
- `src/character.js` (leaf): `createRiggedCharacter(opts)` wraps an instance in the legacy rig
  contract `{bodyGroup, head, hatMesh, armLeft, armRight, gun, legLeft, legRight}`. PoseAdapter
  converts legacy euler emote writes onto UE bones. `rig.playAnim(clipKey)`, `enterPoseMode`/
  `exitPoseMode`, `playDeath`. Gun follows the `hand_r` node each frame (rig `_observer`).
  `attachRiggedToBody(legacyGroup, opts)` hides primitive meshes and rides inside the old group.
  `applyOutfit(rig, opts)` — **real clothing GEOMETRY** (shirt/pants/armor-plate boxes), never a
  skin-material recolor (the body is one mesh/material covering the whole character including the
  face, so tinting skin recolors the face too — this bit us once, don't reintroduce it). Outfit
  boxes are parented to `rig.bodyGroup` (not individual limb bones — those carry inconsistent/
  negative-scale local axes on this rig) with positions computed by measuring `chest`/`hips`/
  `lowerlegL` bone positions in bodyGroup-local space at build time (`_boneLocalPos`), never
  hardcoded world heights (the live player's bodyGroup can sit inside an outer wrapper with its
  own offset). `ENEMY_VARIANTS`/`ZOMBIE_VARIANTS` give `shirtColor`/`armorColor` (real geometry,
  not skin tint) + `jitterVariant` for per-spawn hue/hair/body variety.
- Player: `upgradePlayerRigVisual()` in player.js (called from main.js after preload). Clothes/
  armor call `applyOutfit()` — default is a navy shirt+pants (never bare skin). Emotes drive
  PoseAdapters (main.js `updateEmote` enter/exitPoseMode). Armory PREVIEW pane has its OWN gun
  node (`previewRig.gun`) — `setPlayerWeapon` must rebuild both `playerGun` and `previewRig.gun`
  or equipping a weapon/skin never visibly changes what the preview is holding.
- **Gotcha — hair placement**: the "Origin at 0" hairstyle packs are authored in the SAME absolute
  coordinate frame as the un-normalized base body (a fresh, unparented hair mesh's vertices sit at
  world Y matching the head bone's own Y directly) — parent hair to the body ROOT at identity, NOT
  to the head bone with an inverse-world-matrix correction (tried that, sent hair flying to hip
  height). Trade-off: hair won't tilt with head-turn animation.
- **Gotcha — rigged NPCs/decor characters** (e.g. lobby idle NPCs): `rig.bodyGroup` disposal (map
  teardown) does NOT clean up the per-frame `onAfterAnimationsObservable` listener or cloned
  animation groups — call `rig.disposeExtras()` (via `bodyGroup.onDisposeObservable.addOnce(...)`)
  or they leak across map switches.
- Fallback: `assetsReady === false` or `localStorage['sniperstrike-classic-rigs']` → primitive rigs.

### Shared world systems (engine.js) — DONE
- `glowLayer` (always on, intensity 0.6): every emissive material blooms.
- `setSky(preset)`: gradient skybox sphere (`{top,horizon,bottom,stars}`), excluded from glow.
- `applyLightingPreset(p)` + `DEFAULT_LIGHTING`: sun dir/color/intensity, ambient, env, clearColor,
  sky, fog. `loadMap()` calls it before `def.build()`. MAPS entries gain optional `lighting:{}`.
  Flagship presets set: metro (warm dusk), desert (hot sky+haze), apocalypse (blood-red+moonlight),
  lobby (starfield). Maps without a preset render as before.
- `setSSAO(on)` available (guarded by IsSupported); currently opt-in, not enabled by default.
- `makeTerrain(opts, mat)` / `getHeightAtXZ(x,z)` / `clearTerrain()` — seeded value-noise
  heightfield (`CreateGround` with **`updatable: true`** — without that flag `updateVerticesData`
  silently no-ops and the mesh never visually deforms, a real bug hit once). `flatRadius`/
  `flatSpots` zero out height near spawns/buildings/oasis so 2D wall-collider AABBs stay valid.
  `clearTerrain()` wired into `maps/index.js` teardown. Movement Y-follow hooks in
  controls.js (`animatePlayer`) and enemies.js (top of `updateEnemies` forEach) lerp toward
  `getHeightAtXZ` every frame — a no-op (lerps toward 0) on flat maps with no active heightfield.
  Desert (M7) is the only map currently using real terrain (amplitude 5.5, flat combat bowl).
- `src/textures.js` (leaf; imports only engine.js) — `texPBR(kind, opts)` / `pbrTex(kind, hex,
  roughness, metallic, opts)`: procedural canvas diffuse + luminance-derived bump, cached by
  kind+seed, cloned per-material so uv scale doesn't cross-contaminate. Kinds: asphalt, concrete,
  brick, sand, metalPlate, ash. Re-exported through `engine.js` (map files may only import
  engine.js/state.js/maps/index.js — `loadProp`/`instantiateProp`/`createRiggedCharacter`/
  `assetsReady` are re-exported through `maps/index.js` for the same reason).

### Flagship map reworks (M6–M9) — DONE
- **Metro**: `pbrTex` asphalt/concrete/brick/brownstone materials; lit window-grid emissive texture
  on glass towers (`windowTex` in metro.js) for a dusk-skyline look via GlowLayer; `spawnCityProps`
  loads real KayKit buildings + police/taxi cars (async, `gs.mapId` guard so a prop that resolves
  after the player left is a no-op).
- **Desert**: real `makeTerrain` dunes (amplitude 5.5) replacing the old hemisphere-prop dunes;
  flat combat bowl (`flatRadius: 22`) + flat oasis/store footprints; all decor (rocks/cacti/palms/
  stores) grounded via `getHeightAtXZ` instead of fixed y.
- **Apocalypse**: `pbrTex` ash/concrete; `spawnGraveyardProps` loads a real KayKit crypt + graves +
  broken fence + coffin cluster (placed in the open street corridor between destroyed-block
  centers to avoid overlap — the block grid is dense, check coordinates before adding more).
- **Lobby**: `pbrTex('metalPlate')` reflective floor; `spawnSpaceProps` loads real cargo/basemodule
  props flanking the entrance/far wall; `spawnIdleNpcs` spawns 4 rigged NPCs near tubes playing
  Idle/Dance (remember `disposeExtras()` cleanup, see gotcha above). **Fixed bug**: `_conveyor()`
  had a full-width glow "cover" box sitting directly on top of the belt (y=0.17, belt top y=0.15),
  100% occluding the scrolling arrow texture — removed; kept only the two edge-rail glow strips.

## Current game state
- Browser-based Babylon.js shooter (PBR materials, real-time shadows, bloom, FXAA, ACES tone mapping).
- Multi-file ES module architecture rooted at `src/main.js`; Babylon.js loaded via CDN UMD global.
- Main character uses a sniper-style gun on a ragdoll-like humanoid rig.
- Enemies grouped by type (grunt/rusher/heavy/boss), move toward the player, shoot back.
- Health, score, level, minimap, coins, armor, start screen, map picker all implemented.
- 6 playable maps: New York City (Metro), Vatican, Desert, Marble Mansion, Wild West, Space Station.

## Architecture overview
```
index.html               → loads babylon.js CDN, then <script type="module" src="src/main.js">
src/
  main.js                → render loop, game start/restart, DOM wiring, callback bridges
  state.js               → all shared mutable arrays/objects (no game imports — dependency leaf)
  engine.js              → Babylon.js engine bootstrap + mesh/material helper API (dependency leaf)
  audio.js               → Web Audio API synthesized sounds
  player.js              → humanoid rig factory, player instance, armor/weapon/clothes apply
  controls.js            → keyboard/mouse/touch input, player movement, aimRotation
  combat.js              → bullets, hit detection, damage, powerups, boss bar
  enemies.js             → enemy types, spawning, AI (uses callbacks to avoid circular deps)
  effects.js             → floating text, particles, muzzle flash, death burst, speech bubbles
  ui.js                  → HUD, minimap, start screen, map picker, message overlay
  voice.js               → Web Speech API + Claude API + TTS enemy voice
  maps/
    index.js             → MAPS registry, loadMap(), registerWallCollider(), registerMapGroup()
    metro.js             → New York City (buildMetroMap, startDivineHealingEvent)
    vatican.js           → Vatican Cathedral (buildVaticanMap, animateVaticanPrayer)
    desert.js            → Desert Canyon (buildDesertMap)
    mansion.js           → Marble Mansion (buildMansionMap)
    westworld.js         → Wild West Town (buildWestWorldMap)
    spacestation.js      → Space Station (buildSpaceStationMap)
  armory/
    index.js             → Armory UI tabs, card factory, preview loop, initArmory()
    weapons.js           → WEAPON_DEFS, gun builder functions, rebuildGunVisual, getEquippedGunMaterials
    armor.js             → ARMOR_DEFS, buildArmorMesh, getArmorMaterial
    skins.js             → SKIN_DEFS
    clothes.js           → CLOTHES_DEFS, applyClothesAccessories, applyClothesMaterialStyle
    emotes.js            → EMOTE_DEFS, applyEmotePose
```

## Dependency rules (CRITICAL — do not break)
- `state.js` and `engine.js` are dependency leaves — they import NOTHING from the game.
- `combat.js` does NOT import `enemies.js` statically — enemies are accessed via `state.enemies[]`.
- `enemies.js` does NOT import `combat.js` statically — combat functions are registered via `registerCombatCallbacks()`.
- `main.js` is the only file allowed to wire circular callback chains at runtime.
- Map files may only import from `engine.js`, `state.js`, and `maps/index.js`.

## engine.js helper API
```js
export { scene, engine, camera, shadowGen, previewScene, previewEngine }
// Color constructors
export function c3(hex): Color3
export function c4(hex, a): Color4
// Materials
export function pbr(hex, roughness, metallic, opts?): PBRMaterial  // opts: emissive, emissiveIntensity
export function std(hex, opts?): StandardMaterial
// Scene graph
export function grp(name, parent?, sc?): TransformNode
// Mesh builders (all set mesh.parent = parent and add to shadowGen if specified)
export function box(w, h, d, mat, parent?, sc?): Mesh
export function cyl(rt, rb, h, mat, parent?, tess?, sc?): Mesh   // rt=topRadius, rb=botRadius
export function sph(r, mat, parent?, segs?, sc?): Mesh
export function hemi(r, mat, parent?, segs?, sc?): Mesh
export function cone(r, h, mat, parent?, tess?, sc?): Mesh
export function torus(r, tube, mat, parent?, tess?, sc?): Mesh
export function gnd(w, d, mat, sc?): Mesh
export function capsule(r, cylinderLen, mat, parent?, tess?, sc?): Mesh
export function plane(w, h, mat, parent?, sc?): Mesh
export function cloneM(src, newParent?): Mesh
export function addShadow(node): void
export function makeCanvasTex(w, h, drawFn, sc?): DynamicTexture
export function disposeNode(node): void
export function setFog(colorHex, start, end): void
export function clearFog(): void
```

## Map system
- `const MAPS` registry (`maps/index.js`): each entry has `label`, `build`, `mapRadius`, `roadBands`.
- `loadMap(mapId)`: tears down previous map via `activeMapGroups`, resets `wallColliders` etc., calls new map's `build()`.
- `registerMapGroup(group)` pushes root TransformNode into `activeMapGroups` for teardown.
- `registerWallCollider(minX, maxX, minZ, maxZ)` — AABB for movement collision.
- Map IDs: `metro`, `vatican`, `desert`, `mansion`, `westworld`, `spacestation`.
- Map picker reappears on every restart (including after death).

## Circular dependency resolution
- `enemies.js` → `registerCombatCallbacks({ spawnEnemyBullet, takeDamage, spawnPowerupsForLevel })` called from `main.js`.
- `enemies.js` → `registerUICallbacks({ showMessage, hideMessage })` called from `main.js`.
- `enemies.js` → `registerMapCallbacks({ startDivineHealingEvent })` called from `main.js`.
- `controls.js` → `window.__weaponSwitch = (key) => {...}` set in `main.js`.
- Map store interactables use `window.__openArmory()` global wired in `main.js`.
- Metro's healing orb uses `window.__playerRefs.playerBody` global wired in `main.js`.

## Armor system
- All armor tiers in `ARMOR_DEFS` (`armory/armor.js`) have `deflectChance` and `reduction`.
- `karat24` (VIP-only): `deflectChance: 1.0` — deflects EVERY bullet, zero damage.
- `applyPlayerArmor(key)` in `player.js` sets `player.armorReduction` and `player.armorDeflectChance`.
- Deflect logic in `combat.js` `resolvePlayerHit()` — `fullImmunity = deflectChance >= 1` checked first.
- Gold sparks + "DEFLECTED!" text for VIP; silver sparks + "BLOCKED!" for regular armor.
- `playArmorDeflect()` plays a triangle+noise burst sound effect.
- Armor tiers:
  - `none`: 0%
  - `light`: 8%
  - `reinforced`: 12%
  - `medium`: 18%
  - `tactical`: 24%
  - `heavy`: 32%
  - `titan`: 42%
  - `karat24` (VIP-only): 100% deflect, 55% reduction, price 2500

## 24K Gold Armor (VIP)
- `ARMOR_DEFS.karat24`: `name: '24K Gold Armor'`, `price: 2500`, `reduction: 0.55`, `deflectChance: 1.0`, `vipOnly: true`.
- Material: `pbr(0xffd700, 0.08, 0.98, { emissive: 0xffaa00, emissiveIntensity: 0.35 })`.

## Level persistence
- `gs.level` initialized from `localStorage.getItem('sniperstrike-level')`.
- `saveLevel()` writes `gs.level` to localStorage.
- `restartGame()` (on death) resets `gs.level = 1` and shows map picker again.
- Closing and reopening the game resumes the saved level.

## localStorage key convention (CRITICAL — NEVER RENAME)
- `sniperstrike-coins`, `sniperstrike-inventory`, `sniperstrike-equipped`,
  `sniperstrike-muted`, `sniperstrike-level`, `sniperstrike-claude-key`,
  `sniperstrike-classic-rigs` (visual overhaul fallback — forces primitive rigs when set).
- All new keys must use the `sniperstrike-` prefix.

## Vatican congregation
- `animateVaticanPrayer(dt)` exported from `maps/vatican.js`, called from `main.js` render loop when `gs.mapId === 'vatican'`.
- Each congregant: `c.rotation.x = Math.sin(gs.timeAccum * 0.7 + c.phase) * 0.1 - 0.06`.
- Pope: `gs.vaticanPopeGroup.rotation.x = Math.sin(gs.timeAccum * 0.45) * 0.07`.
- Congregants stay **seated and praying** — they do NOT flee.

## Space Station map — Rocket
- `buildSpaceRocket(parent)` in `maps/spacestation.js`: pad (r=6), body (r=2.2, h=16), red stripe, nose cone (r=2.2, h=5), 3 fins, engine glow.
- Positioned at x=38, z=0. Wall collider: `registerWallCollider(35.3, 40.7, -2.7, 2.7)`.

## Voice-to-text enemy conversation
- `#voice-btn` (🎤) in the HUD.
- Uses Web Speech API (Chrome/Edge only); falls back to error message in unsupported browsers.
- `callClaudeForEnemyResponse(text)` → `claude-haiku-4-5-20251001` API with trash-talk battle persona.
- Enemy reply plays via browser `SpeechSynthesis` (TTS) + `spawnSpeechBubble()`.
- API key stored in `localStorage` under `sniperstrike-claude-key`; prompts once if missing.
- Invalid key (401) clears stored key and shows message.

## VIP tab system
- `vipOnly: true` flag on ARMOR_DEFS / EMOTE_DEFS / SKIN_DEFS hides items from regular tabs.
- VIP-only items: `karat24` armor, `goldenMinigun` skin, `titanroar` emote.
- `renderVipTab()` in `armory/index.js` renders all vipOnly items in the VIP tab.

## Deployment / Docker (nginx at luke.chazmar.com)
`./app start` → `docker compose up -d --build`; traefik terminates TLS. The image is built
by `Dockerfile` (2 stages) and served by `nginx.conf`. Everything here exists because the
deployed build was slow while localhost was fast — an over-the-wire payload problem that a
localhost server can never surface. Measured at 20 Mbps: **43.3 MB / 21.3 s → 9.95 MB / 6.2 s**.
- **Compression**: `gzip_static on` + `gzip on` fallback in nginx.conf; the Dockerfile
  precompresses `.js/.css/.html/.gltf/.bin/.json/.env` with `gzip -9 -k` at build time.
  glTF is JSON and compresses ~27x (AnimationLibrary.gltf 2.46 MB → 92 KB); the 52 unbundled
  ES modules go 656 KB → 162 KB. **PNG is deliberately NOT gzipped** — already DEFLATE'd
  internally, so it costs CPU for ~0 bytes. `-k` keeps the plain file, which `gzip_static`
  needs for clients that send no `Accept-Encoding`.
- **Texture downscale (build stage only)**: the Quaternius pack ships 2048² PNGs (normal maps
  ~3.7 MB each) which were 91% of the download once compression was on. Stage 1 (`alpine` +
  imagemagick) runs `mogrify -resize '1024x1024>'` over PNGs >512k. The **repo keeps the
  full-res originals** — only the shipped copy shrinks. `1024x1024>` is shrink-only, so the
  256² eye textures pass through untouched. Verified visually identical in the armory preview.
  To revert: drop stage 1 and point the assets COPY back at the build context.
- **GOTCHA — Babylon rejects `../` in glTF image URIs.** The hair textures ship as byte-identical
  duplicates under both `quaternius/` and `quaternius/hair/` (~11 MB downloaded twice). The fix
  is to point the two body glTFs at the `hair/` copies — a FORWARD subdirectory path. Rewriting
  the `hair/*.gltf` to reach *up* with `../T_Hair_1_Normal.png` instead fails hard with
  `/images/0/uri: '../…' is invalid`, which sets `assetsReady = false` and silently drops the
  whole game to primitive rigs. Canonical copies must live at or below the referencing glTF.
- The now-unreferenced duplicate PNGs are kept on disk on purpose: `/assets/` is served with
  `max-age=86400`, so a returning player can hold a day-old glTF that still names the old URL.
  Safe to delete after a day has passed since the deploy.
- **Loading is fan-out, not a chain.** `preloadAssets` uses a 6-wide worker pool, and the
  `spawnCityProps`/`spawnGraveyardProps`/`spawnSpaceProps` map loaders start every `loadProp`
  up front and then place them in spec order. Awaiting inside those loops cost one full RTT
  per asset — invisible on localhost, but it is what made the map trickle in instead of
  appearing built. Keep new asset loops fanned out.
- Verify a deploy with a throttled headless run, not just a local page load — that is the only
  way this class of regression shows up. Chrome via
  `chromium.launch({channel:'chrome'})` + CDP `Network.emulateNetworkConditions`.

## Technical stack
- Babylon.js from `https://cdn.babylonjs.com/babylon.js` (UMD global `BABYLON.*`), loaded before ES modules.
- `DefaultRenderingPipeline`: bloom (threshold 0.78, weight 0.28), FXAA, ACES tone mapping, vignette.
- `ShadowGenerator`: `useBlurExponentialShadowMap = true`, kernel 32, normalBias 0.05.
- Wall collision: pure JS AABB in `wallColliders[]` (state.js). `collidesWithWalls(x, z, r=0.4)` in `maps/index.js`.
- `mesh.billboardMode = BABYLON.Mesh.BILLBOARDMODE_ALL` for floating text/speech bubbles.
- Dual engine: main `engine`/`scene` + separate `previewEngine`/`previewScene` for armory preview canvas.
- `camera.inputs.clear()` — camera manually positioned each frame in `updateCamera()`.
- Seeded RNG: `mulberry32(seed)` in map files for deterministic procedural generation.
- Syntax check: `node --check src/main.js` (NVM sourced) after EVERY edit batch.
  - NVM source: `export NVM_DIR="$HOME/.nvm"; [ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"`
- HTTP test server: `python3 -m http.server 8934`, always kill after tests.
- Playwright: `npx` cache at `/Users/lukebonano/.npm/_npx/e41f203b7505f1fb/node_modules/playwright`.
  - Use `dispatchEvent(new MouseEvent('click',{bubbles:true}))` not `.click()` for button presses.
- Debug hooks: `window.__debugGame = {...}` — always add temporarily and remove before task is done.

## UI elements (index.html)
- `#renderCanvas` — Babylon.js render target (fixed, full-screen).
- `#vip-toggle-button` — toggles VIP character (hidden until VIP unlocked).
- `#mute-button` — toggles sound.
- `#emote-button` — opens emote flyout menu.
- `#voice-btn` — voice-to-text mic button.
- `#open-armory-btn` — in-game HUD armory button (B key also works).
- `#crosshair`, `#interact-prompt`, `#voice-error`, `#armor-bar-wrap` — HUD elements.
- Armory tabs: Weapons, Skins, Clothes, Armor, Emotes, VIP — each has `id="tab-<name>"` and class `armory-tab-btn`.

## Known runtime notes
- `gs.isInsideMapInterior` is `() => false` until a map loads — enemy spawning before `loadMap` is fine (level-1 spawn happens after `startGame` calls `loadMap`).
- Vatican prayer animation is lazily imported: `import('./maps/vatican.js').then(...)` in `main.js`.
- Metro divine healing event callback registered via `import('./maps/metro.js').then(m => registerMapCallbacks(...))` in `startGame()`.
- Three.js `clearcoat`-related warnings are gone (now Babylon.js). Babylon.js console warnings about IBL env texture 404 are harmless if no env file is present.

## Files
- `src/main.js` — entry point and render loop
- `src/state.js` — all shared mutable state
- `src/engine.js` — Babylon.js bootstrap and mesh/material helpers
- `index.html` — HTML with `#renderCanvas` and Babylon CDN `<script>` before the ES module
- `styles.css` — all styling
- `CLAUDE.md` — this file
