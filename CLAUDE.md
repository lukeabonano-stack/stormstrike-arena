# Weaponstrike Arena — Claude Notes

## Current game state
- Browser-based Three.js shooter with a multi-map world system.
- Main character uses a sniper-style gun attached to a ragdoll-like body.
- Enemies are grouped and move toward the player while shooting.
- Health, score, level, minimap, coins, armor, and start screen UI are implemented.
- A map picker appears after pressing Start Game and after every death/restart.
- 6 playable maps: New York City (Metro), Vatican, Desert, Marble Mansion, Wild West, Space Station.

## Map system
- `const MAPS` registry (main.js ~line 1134): each entry has `label`, `build`, `mapRadius`, `roadBands`.
- `loadMap(mapId)`: tears down all previous map geometry (via `activeMapGroups`), resets `wallColliders`, `stores`, `cars`, `congregants`, then calls the new map's `build()`.
- `registerMapGroup(group)` pushes a THREE.Group into `activeMapGroups` for teardown.
- Map names in the picker:
  - `metro` → label `'New York City'`
  - `vatican` → label `'Vatican'`
  - `desert` → label `'Desert'`
  - `mansion` → label `'Marble Mansion'`
  - `westworld` → label `'Wild West'`
  - `spacestation` → label `'Space Station'`
- Map picker reappears on every restart (including after death).

## Space Station map — Rocket
- `buildSpaceRocket()` creates a large rocket next to the east wall (x≈38, z=0).
- Pad: CylinderGeometry r6; body: CylinderGeometry r2.2 h16; red stripe band; nose cone: ConeGeometry r2.2 h5; 3 fins; engine glow sphere at base.
- Wall collider registered at `registerWallCollider(35.5, 40.5, -2.7, 2.7)`.
- Called from `buildSpaceStationMap()` via `registerMapGroup(buildSpaceRocket())`.

## Armor system
- All armor tiers in `ARMOR_DEFS` have `deflectChance` and `reduction` properties.
- `applyPlayerArmor(key)` sets `player.armorReduction` and `player.armorDeflectChance`.
- In the enemy bullet hit loop: deflect fires for torso hits (non-VIP) OR all hits if `deflectChance >= 1` (VIP).
- `fullImmunity = deflectChance >= 1` bypasses the `hitTorso && !hitHead` gate so VIP deflects everything.
- Gold sparks + gold "DEFLECTED!" text for VIP; silver sparks + blue text for regular armor.
- Same pattern applied to the melee hit block.
- `playArmorDeflect()` plays a triangle+noise burst sound effect.
- Armor tiers and deflect chances:
  - `none`: 0
  - `light`: 0.08
  - `reinforced`: 0.12
  - `medium`: 0.18
  - `tactical`: 0.24
  - `heavy`: 0.32
  - `titan`: 0.42
  - `karat24` (VIP-only): 1.0 — deflects EVERY bullet, zero damage
- All armor tiers render plates on BOTH front AND back of the character (back plate is a `.clone()` of the front with negated z position).
- `karat24` is excluded from the regular armor tab via `if (def.vipOnly) return;`.

## 24K Gold Armor (VIP)
- Entry: `ARMOR_DEFS.karat24` — `name: '24K Gold Armor'`, `price: 2500`, `reduction: 0.55`, `deflectChance: 1.0`, `vipOnly: true`.
- Material: `MeshStandardMaterial { color: 0xffd700, roughness: 0.08, metalness: 0.98, emissive: 0xffaa00, emissiveIntensity: 0.35 }`.
- Full suit: front+back chest, front+back ridges, pauldrons (upper+lower both sides), front+back thighs, wrap belt, helmetRing (torus), crest.
- Displayed in the VIP tab via `renderVipTab()` before the Titan Roar emote card.

## Level persistence
- `let level` is initialized from `localStorage.getItem('sniperstrike-level')` on load.
- `saveLevel()` writes to `localStorage.setItem('sniperstrike-level', String(level))`.
- `nextLevel()` increments level then calls `saveLevel()`.
- `restartGame()` (on death) resets `level = 1` then calls `saveLevel()` — progress wipes on death.
- Closing and reopening the game resumes the saved level.

## localStorage key convention
- **CRITICAL: Never rename existing keys** — doing so wipes player progress.
- Existing keys: `sniperstrike-coins`, `sniperstrike-inventory`, `sniperstrike-equipped`, `sniperstrike-muted`, `sniperstrike-level`.
- All new keys must use the `sniperstrike-` prefix.

## Vatican map — congregation behavior
- Congregants stay **seated and praying** — they do NOT flee.
- `animateVaticanPrayer(dt)` runs every frame from `animate()` after `updateFleeingNpcs(deltaTime)`.
- Each congregant has a `phase` offset: `(i * 6 + j) * 0.28` to stagger the bow animation.
- `c.group.rotation.x = Math.sin(timeAccum * 0.7 + c.phase) * 0.1 - 0.06` (gentle forward bow).
- `vaticanPopeGroup` sways: `rotation.x = Math.sin(timeAccum * 0.45) * 0.07`.
- `triggerVaticanFleeSequence()` was removed; the New York City church event is untouched.

## Start screen subtitle
- Located in `index.html` line 43.
- Current text: `"Press Start Game to enter A detailed, texture, and super fun battle world."`

## VIP tab system
- Pattern: `ARMORY_TAB_RENDERERS.vip = function renderVipTab() { ... }`.
- `vipOnly: true` flag on ARMOR_DEFS (or EMOTE_DEFS/SKIN_DEFS) hides items from regular tabs.
- Examples of other VIP-only items: `goldenMinigun` skin, `titanroar` emote.

## UI elements (index.html)
- `#vip-toggle-button` — toggles between default and VIP character (hidden until VIP unlocked).
- `#mute-button` — toggles sound.
- `#emote-button` — opens emote flyout menu.
- Armory tabs: Weapons, Skins, Clothes, Armor, Emotes, VIP.

## Pending feature: Voice-to-text enemy conversation
- **NOT YET IMPLEMENTED** — this is the next task.
- A microphone button (`#voice-btn`) should appear next to `#vip-toggle-button` in the HUD.
- When pressed: activates Web Speech API (`SpeechRecognition`) for voice-to-text.
- Player speech is displayed as floating text above the player.
- Text is sent to Claude API (`claude-haiku-4-5-20251001` for speed) with a system prompt establishing "battle enemy trash-talk" persona.
- Enemy response is displayed as a floating speech bubble above the nearest living enemy.
- The conversation should be dynamic — if player says "you won't beat me", enemy responds with a comeback.
- Button toggles listening on/off with visual feedback (e.g., red pulsing when active).
- Requires a Claude API key — likely needs to be configurable or prompted.

## Technical stack and patterns
- Three.js r164 via ESM CDN import.
- `spawnFloatingText(text, position, color)` — floating combat text system.
- `spawnImpactParticles(position, color, count)` — particle burst.
- `playTone(opts)` / `playNoiseBurst(opts)` — Web Audio API synthesized sounds.
- `createArmoryCard({name, price, owned, equipped, disabled, actionText, onAction, onSelect})` — Armory card factory.
- `node --check main.js` (with NVM sourced) after EVERY edit batch to catch syntax errors.
  - NVM source line: `export NVM_DIR="$HOME/.nvm"; [ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"`
- Playwright testing: `npx` cache at `/Users/lukebonano/.npm/_npx/e41f203b7505f1fb/node_modules/playwright`.
  - Use `dispatchEvent(new MouseEvent('click',{bubbles:true}))` not `.click()` for button presses.
- HTTP test server: `python3 -m http.server 8934` from project dir, always killed after tests.
- Debug hooks: `window.__debugGame = {...}` — always add temporarily and remove before task is done.

## Known issues / harmless warnings
- Three.js warnings about `clearcoat` properties not being valid on `MeshStandardMaterial` — harmless, ignore.
- Camera uses `aimRotation.y` (not `playerBody.rotation.y`) for direction — do not override `playerBody.rotation` directly as it is overwritten each frame.

## Visual and gameplay fixes applied (historical)
- Created readable store signage and shinier city facades.
- Added a sniper gun model and fixed the gun to the player arm.
- Ensured the main character arm faces forward while leaving the gun pose stable.
- Fixed the gun barrel direction so it points forward correctly.
- Corrected bullet direction to use `playerGun.muzzle.getWorldDirection(...)`.
- Main character appearance aligned to enemy model: blue shirt and black cap.

## Files
- `main.js` — all game logic
- `index.html` — HTML structure and UI elements
- `styles.css` — all styling
- `CLAUDE.md` — this file
