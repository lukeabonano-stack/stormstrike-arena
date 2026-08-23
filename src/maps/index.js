// ── maps/index.js  Map registry and switching ─────────────────────────────────
import { scene, setFog, clearFog, applyLightingPreset, clearTerrain } from '../engine.js';
import { gs, wallColliders, activeMapGroups, stores, cars, congregants,
         vaticanCongregants, fleeingNpcs, interactableObjects } from '../state.js';
// Re-exported so map builders (restricted to engine.js/state.js/maps/index.js
// imports) can load decor props / spawn rigged NPCs without a direct
// assets.js / character.js dependency.
export { loadProp, instantiateProp, assetsReady } from '../assets.js';
export { createRiggedCharacter } from '../character.js';

import { buildMetroMap }        from './metro.js';
import { buildVaticanMap }      from './vatican.js';
import { buildDesertMap }       from './desert.js';
import { buildMansionMap }      from './mansion.js';
import { buildWestWorldMap }    from './westworld.js';
import { buildSpaceStationMap } from './spacestation.js';
import { buildSecretLairMap }   from './secretlair.js';
import { buildCyberCityMap }    from './cybercity.js';
import { buildEgyptMap }        from './egypt.js';
import { buildGraveyardMap }    from './graveyard.js';
import { buildArcticMap }       from './arctic.js';
import { buildPirateCoveMap }   from './piratecove.js';
import { buildVolcanoMap }      from './volcano.js';
import { buildMedievalMap }     from './medieval.js';
import { buildColosseumMap }    from './colosseum.js';
import { buildJungleMap }       from './jungle.js';
import { buildMoonBaseMap }     from './moonbase.js';
import { buildTokyoMap }        from './tokyo.js';
import { buildApocalypseMap }   from './apocalypse.js';
import { buildCaveMap }         from './cave.js';
import { buildCarnivalMap }     from './carnival.js';
import { buildFactoryMap }      from './factory.js';
import { buildSkyRiseMap }      from './skyrise.js';
import { buildPrisonMap }       from './prison.js';
import { buildAlienMap }        from './alien.js';
import { buildUnderwaterMap }   from './underwater.js';
import { buildSkiMap }          from './ski.js';
import { buildCandyMap }        from './candy.js';
import { buildNuclearMap }      from './nuclear.js';
import { buildLobbyMap }        from './lobby.js';

export const MAPS = {
  lobby: {
    label: 'Arena Lobby',
    desc: '⚡ 100 tube stations — step inside any tube to choose your fight size.',
    build: buildLobbyMap,
    mapRadius: 320,
    roadBands: [],
    noEnemies: true,
    lighting: {
      sunDir: [-0.3, -1.0, -0.4], sunColor: 0xafc4ff, sunIntensity: 1.1,
      ambientIntensity: 0.5, ambientGround: 0x0a0a18, ambientSky: 0x1a2444, env: 0.9,
      clear: 0x02030a, sky: { top: 0x01020a, horizon: 0x081226, bottom: 0x02030a, stars: true },
    },
  },
  metro: {
    label: 'New York City',
    desc: 'Dense urban streets — use buildings for cover and watch the intersections.',
    build: buildMetroMap,
    mapRadius: 140,
    roadBands: [0, 26, 52, -28],
    lighting: {
      sunDir: [-0.5, -1.1, -0.35], sunColor: 0xffe0b0, sunIntensity: 2.5,
      ambientIntensity: 0.5, ambientGround: 0x4a4a5a, ambientSky: 0xcfe2ff, env: 0.7,
      clear: 0x9ec9f5, sky: { top: 0x3f7fc0, horizon: 0xdcecff, bottom: 0xf2e8d8 },
    },
  },
  vatican: {
    label: 'Vatican',
    desc: 'Sacred halls and marble pillars. The congregation will scatter — clear the nave.',
    build: buildVaticanMap,
    mapRadius: 100,
    roadBands: [],
  },
  desert: {
    label: 'Desert',
    desc: 'Open dunes and rocky outcrops. Long sightlines — bring a sniper.',
    build: buildDesertMap,
    mapRadius: 120,
    roadBands: [],
    lighting: {
      sunDir: [-0.4, -1.0, -0.5], sunColor: 0xffe6b0, sunIntensity: 2.8,
      ambientIntensity: 0.6, ambientGround: 0x8a7048, ambientSky: 0xffe8c0, env: 0.75,
      clear: 0xd8b878, sky: { top: 0x6aa0d8, horizon: 0xf0dcb0, bottom: 0xe8cf9a },
      fog: { color: 0xe0c088, start: 40, end: 150 },
    },
  },
  mansion: {
    label: 'Marble Mansion',
    desc: 'Opulent rooms and tight corridors. Room-clearing at its finest.',
    build: buildMansionMap,
    mapRadius: 80,
    roadBands: [],
  },
  westworld: {
    label: 'Wild West',
    desc: 'A dusty frontier town. High noon showdowns on the main street.',
    build: buildWestWorldMap,
    mapRadius: 100,
    roadBands: [0],
  },
  spacestation: {
    label: 'Space Station',
    desc: 'Zero-gravity corridors and a launchpad. The final frontier.',
    build: buildSpaceStationMap,
    mapRadius: 50,
    roadBands: [],
  },
  secretlair: {
    label: 'The Secret Lair',
    desc: 'A villain\'s underground hideout. Traps and tight corners everywhere.',
    build: buildSecretLairMap,
    mapRadius: 130,
    roadBands: [],
  },
  cybercity: {
    label: 'Cyber City',
    desc: 'Neon-soaked streets in a hacker\'s paradise. Fast, chaotic, electric.',
    build: buildCyberCityMap,
    mapRadius: 120,
    roadBands: [0, 30, -30, 60, -60],
  },
  egypt: {
    label: 'Ancient Egypt',
    desc: 'Sand-swept pyramids and hidden chambers. Danger lurks in every shadow.',
    build: buildEgyptMap,
    mapRadius: 120,
    roadBands: [],
  },
  graveyard: {
    label: 'Haunted Graveyard',
    desc: 'Tombstones and fog. The dead don\'t stay buried here.',
    build: buildGraveyardMap,
    mapRadius: 100,
    roadBands: [],
  },
  arctic: {
    label: 'Arctic Base',
    desc: 'A frozen research outpost. Slippery ground and deadly crevasses.',
    build: buildArcticMap,
    mapRadius: 110,
    roadBands: [],
  },
  piratecove: {
    label: 'Pirate Cove',
    desc: 'Ships, docks, and sea spray. Plunder awaits the last one standing.',
    build: buildPirateCoveMap,
    mapRadius: 115,
    roadBands: [],
  },
  volcano: {
    label: 'Volcano Island',
    desc: 'Ancient ruins on a live volcano. Don\'t fall in the lava.',
    build: buildVolcanoMap,
    mapRadius: 110,
    roadBands: [],
  },
  medieval: {
    label: 'Medieval Castle',
    desc: 'Thick stone walls and battlements. A siege within a siege.',
    build: buildMedievalMap,
    mapRadius: 120,
    roadBands: [],
  },
  colosseum: {
    label: 'Roman Colosseum',
    desc: 'Fight for the crowd in the greatest arena ever built.',
    build: buildColosseumMap,
    mapRadius: 100,
    roadBands: [],
  },
  jungle: {
    label: 'Amazon Jungle',
    desc: 'Dense canopy and ancient ruins. Enemies can strike from any direction.',
    build: buildJungleMap,
    mapRadius: 115,
    roadBands: [],
  },
  moonbase: {
    label: 'Moon Base',
    desc: 'Low gravity, high stakes. Combat on the lunar surface.',
    build: buildMoonBaseMap,
    mapRadius: 120,
    roadBands: [],
  },
  tokyo: {
    label: 'Tokyo Neon',
    desc: 'Blazing neon signs and rain-slicked streets. Urban Japan at night.',
    build: buildTokyoMap,
    mapRadius: 120,
    roadBands: [0, 35, -35],
  },
  apocalypse: {
    label: 'Zombie Apocalypse',
    desc: 'Ruined city, endless undead. Survive as long as you can.',
    build: buildApocalypseMap,
    mapRadius: 115,
    roadBands: [0, 30, -30, 60, -60],
    lighting: {
      sunDir: [-0.3, -0.9, -0.5], sunColor: 0x9fb0d8, sunIntensity: 1.3,
      ambientIntensity: 0.42, ambientGround: 0x2a2620, ambientSky: 0x50404a, env: 0.4,
      clear: 0x3a2828, sky: { top: 0x3a1818, horizon: 0x7a3a28, bottom: 0x2a1a1a },
      fog: { color: 0x3a2420, start: 20, end: 110 },
    },
  },
  cave: {
    label: 'Crystal Cave',
    desc: 'Glittering crystal formations in a pitch-dark cavern. Watch your step.',
    build: buildCaveMap,
    mapRadius: 110,
    roadBands: [],
  },
  carnival: {
    label: 'Carnival',
    desc: 'Bright lights and wild rides. The carnival never sleeps.',
    build: buildCarnivalMap,
    mapRadius: 115,
    roadBands: [0],
  },
  factory: {
    label: 'Industrial Factory',
    desc: 'Machinery, catwalks, and steam vents. An industrial kill-box.',
    build: buildFactoryMap,
    mapRadius: 115,
    roadBands: [],
  },
  skyrise: {
    label: 'Skyscraper Rooftops',
    desc: 'Leap between skyscraper rooftops hundreds of feet above the city.',
    build: buildSkyRiseMap,
    mapRadius: 120,
    roadBands: [],
  },
  prison: {
    label: 'Maximum Security',
    desc: 'Cell blocks and guard towers. No one\'s getting out alive.',
    build: buildPrisonMap,
    mapRadius: 110,
    roadBands: [],
  },
  alien: {
    label: 'Alien Planet',
    desc: 'A crashed ship on a hostile world. Otherworldly terrain and dangers.',
    build: buildAlienMap,
    mapRadius: 115,
    roadBands: [],
  },
  underwater: {
    label: 'Underwater Base',
    desc: 'Submerged corridors and flooded halls. The pressure is on.',
    build: buildUnderwaterMap,
    mapRadius: 110,
    roadBands: [],
  },
  ski: {
    label: 'Ski Resort',
    desc: 'Snow-capped slopes and ski lodges. The mountain is your arena.',
    build: buildSkiMap,
    mapRadius: 120,
    roadBands: [],
  },
  candy: {
    label: 'Candy Land',
    desc: 'Sugary sweet and deadly. Don\'t let the colors fool you.',
    build: buildCandyMap,
    mapRadius: 115,
    roadBands: [0],
  },
  nuclear: {
    label: 'Nuclear Plant',
    desc: 'A meltdown in progress. Survive the radiation and the enemies.',
    build: buildNuclearMap,
    mapRadius: 120,
    roadBands: [],
  },
};

// ── Wall collider helpers ─────────────────────────────────────────────────────
export function registerWallCollider(minX, maxX, minZ, maxZ) {
  wallColliders.push({ minX, maxX, minZ, maxZ });
}

export function collidesWithWalls(x, z, r = 0.4) {
  return wallColliders.some(w =>
    x + r > w.minX && x - r < w.maxX && z + r > w.minZ && z - r < w.maxZ
  );
}

export function registerMapGroup(group) {
  activeMapGroups.push(group);
}

// ── Clear everything from the previous map ────────────────────────────────────
function teardownMap() {
  activeMapGroups.forEach(g => { if (g && !g.isDisposed()) g.dispose(); });
  activeMapGroups.length = 0;
  wallColliders.length = 0;
  stores.length = 0;
  cars.length = 0;
  congregants.length = 0;
  vaticanCongregants.length = 0;
  fleeingNpcs.length = 0;
  interactableObjects.length = 0;
  gs.vaticanPopeGroup = null;
  gs.isInsideMapInterior = () => false;
  clearFog();
  clearTerrain();
}

// ── Load a map by id ──────────────────────────────────────────────────────────
export function loadMap(mapId) {
  const def = MAPS[mapId];
  if (!def) { console.error('Unknown mapId:', mapId); return; }

  teardownMap();
  gs.mapId = mapId;
  gs.MAP_RADIUS = def.mapRadius;
  gs.activeRoadBands = [...(def.roadBands || [])];
  // Apply the map's lighting/sky/fog preset (default ≈ prior look); a builder's
  // own setFog() call runs afterward and wins for maps not yet migrated.
  applyLightingPreset(def.lighting);
  def.build();
}
