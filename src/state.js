// ── state.js  All shared mutable game state ──────────────────────────────────

export const INVENTORY_DEFAULTS = {
  weapons: ['sniper', 'pistol', 'shotgun'],
  skins: ['default'],
  clothes: ['default'],
  armor: ['none'],
  emotes: [],
  vip: false,
};

export const EQUIPPED_DEFAULTS = {
  weapon: 'sniper',
  skin: 'default',
  clothes: 'default',
  armor: 'none',
  vipGiantMode: true,
};

export const COIN_VALUES = { grunt: 5, rusher: 6, heavy: 10, sniper: 12, bomber: 15, medic: 8 };
export const BOSS_DEFEAT_COINS = 5000;
export const PLAYER_MAX_HEALTH = 500;
export const POWERUP_DURATION = 12;
export const BASE_ENEMIES = 3;
export const ENEMIES_PER_LEVEL = 2;
export const MAP_PICKER_SECONDS = 30;
export const GIANT_SCALE = 3;
export const VIP_PRICE = 5000;

export const RANK_NAMES = ['Private', 'Corporal', 'Sergeant', 'Staff Sgt', 'Lieutenant', 'Captain', 'Major', 'Colonel', 'Brig. General', 'General'];
export const RANK_XP    = [0, 500, 1500, 3500, 7000, 12000, 20000, 32000, 50000, 75000];

export const DEFAULT_STATS = {
  allTimeKills: 0, allTimeHeadshots: 0, bestScore: 0,
  bestLevel: 1, totalPlaytime: 0, bestKillStreak: 0,
  totalCoins: 0, meleeKills: 0, grenadeKills: 0,
  shotsTotal: 0,
};

export const DEFAULT_MASTERY = {
  sniper: 0, pistol: 0, shotgun: 0, smg: 0, rocket: 0,
  burst: 0, revolver: 0, lmg: 0, crossbow: 0, minigun: 0,
};

export const ACHIEVEMENT_DEFS = {
  firstKill:   { name: 'First Blood',    desc: 'Kill your first enemy',          icon: '🩸' },
  kills50:     { name: 'Soldier',        desc: 'Kill 50 enemies',                icon: '🎖️' },
  kills500:    { name: 'Veteran',        desc: 'Kill 500 enemies',               icon: '🏅' },
  kills1000:   { name: 'Legend',         desc: 'Kill 1,000 enemies',             icon: '🌟' },
  headshot10:  { name: 'Marksman',       desc: 'Land 10 headshots',              icon: '🎯' },
  headshot100: { name: 'Sniper Elite',   desc: 'Land 100 headshots',             icon: '🔫' },
  level10:     { name: 'Survivor',       desc: 'Reach Level 10',                 icon: '💪' },
  level25:     { name: 'Endgame',        desc: 'Reach Level 25',                 icon: '🚀' },
  level50:     { name: 'Immortal',       desc: 'Reach Level 50',                 icon: '⚡' },
  streak10:    { name: 'On Fire',        desc: 'Get a 10-kill streak',           icon: '🔥' },
  streak20:    { name: 'Unstoppable',    desc: 'Get a 20-kill streak',           icon: '💫' },
  score10k:    { name: 'High Roller',    desc: 'Score 10,000 in one run',        icon: '💎' },
  bossKill:    { name: 'Boss Slayer',    desc: 'Defeat your first boss',         icon: '👑' },
  allWeapons:  { name: 'Arsenal',        desc: 'Own all 10 weapons',             icon: '🛡️' },
  coins10k:    { name: 'Millionaire',    desc: 'Collect 10,000 total coins',     icon: '🪙' },
  grenadier:   { name: 'Grenadier',      desc: 'Kill 5 enemies with grenades',   icon: '💣' },
  brawler:     { name: 'Brawler',        desc: 'Kill 10 enemies with melee',     icon: '👊' },
  speedrunner: { name: 'Speed Demon',    desc: 'Clear 10 waves in under 5 min',  icon: '⏱️' },
  vipUnlock:   { name: 'Elite Status',   desc: 'Unlock VIP mode',                icon: '⭐' },
  combo10:     { name: 'Combo King',     desc: 'Reach a 10x combo',              icon: '🎰' },
};

// ── Persistence ──────────────────────────────────────────────────────────────
export function loadInventory() {
  try {
    const saved = JSON.parse(localStorage.getItem('sniperstrike-inventory'));
    return { ...INVENTORY_DEFAULTS, ...saved };
  } catch { return { ...INVENTORY_DEFAULTS }; }
}

export function loadEquipped() {
  try {
    const saved = JSON.parse(localStorage.getItem('sniperstrike-equipped'));
    return { ...EQUIPPED_DEFAULTS, ...saved };
  } catch { return { ...EQUIPPED_DEFAULTS }; }
}

function _loadObj(key, def) {
  try {
    const v = JSON.parse(localStorage.getItem(key) || '{}');
    return (typeof v === 'object' && !Array.isArray(v)) ? { ...def, ...v } : { ...def };
  } catch { return { ...def }; }
}

function _loadArr(key) {
  try { return JSON.parse(localStorage.getItem(key) || '[]'); }
  catch { return []; }
}

export function saveInventory()    { localStorage.setItem('sniperstrike-inventory',   JSON.stringify(inventory)); }
export function saveEquipped()     { localStorage.setItem('sniperstrike-equipped',    JSON.stringify(equipped)); }
export function saveCoins()        { localStorage.setItem('sniperstrike-coins',       String(gs.coins)); }
export function saveLevel()        { localStorage.setItem('sniperstrike-level',       String(gs.level)); }
export function saveXP()           { localStorage.setItem('sniperstrike-xp',          String(gs.xp)); }
export function saveStats()        { localStorage.setItem('sniperstrike-stats',       JSON.stringify(gs.stats)); }
export function saveAchievements() { localStorage.setItem('sniperstrike-achievements',JSON.stringify(gs.achievements)); }
export function saveHighScores()   { localStorage.setItem('sniperstrike-highscores',  JSON.stringify(gs.highScores)); }
export function saveWeaponMastery(){ localStorage.setItem('sniperstrike-mastery',     JSON.stringify(gs.weaponMastery)); }
export function saveMusicVol()     { localStorage.setItem('sniperstrike-music-vol',   String(gs.musicVolume)); }
export function saveSfxVol()       { localStorage.setItem('sniperstrike-sfx-vol',     String(gs.sfxVolume)); }
export function saveMapsPlayed()   { localStorage.setItem('sniperstrike-maps-played', JSON.stringify([...gs.mapsPlayed])); }
export function saveSpeedrunBest() { localStorage.setItem('sniperstrike-speedrun-best',String(gs.speedrunBestTime)); }

// ── Singleton game-state object ───────────────────────────────────────────────
export const gs = {
  started: false,
  timeAccum: 0,
  mapId: 'metro',
  MAP_RADIUS: 140,
  activeRoadBands: [],
  isInsideMapInterior: () => false,
  coins: parseInt(localStorage.getItem('sniperstrike-coins') || '0', 10) || 0,
  level: parseInt(localStorage.getItem('sniperstrike-level') || '1', 10) || 1,
  audioMuted: localStorage.getItem('sniperstrike-muted') === 'true',
  vipGiantMode: false,
  mapPickerTimerInterval: null,
  killStreak: 0,
  vaticanPopeGroup: null,
  currentInteractable: null,

  // Progression
  xp: parseInt(localStorage.getItem('sniperstrike-xp') || '0', 10) || 0,
  rank: 0,
  combo: 0,
  comboTimer: 0,

  // Game flow
  paused: false,
  gameMode: 'normal',   // 'normal'|'endless'|'bossrush'|'speedrun'|'oneshot'|'horde'
  screenshotMode: false,
  speedrunStartTime: 0,
  speedrunBestTime: parseFloat(localStorage.getItem('sniperstrike-speedrun-best') || '0') || 0,

  // Volume
  musicVolume: parseFloat(localStorage.getItem('sniperstrike-music-vol') || '0.5'),
  sfxVolume:   parseFloat(localStorage.getItem('sniperstrike-sfx-vol')   || '0.8'),
  colorblindMode: localStorage.getItem('sniperstrike-colorblind') === 'true',

  // Persistent data
  highScores:    _loadArr('sniperstrike-highscores'),
  stats:         _loadObj('sniperstrike-stats', DEFAULT_STATS),
  achievements:  _loadObj('sniperstrike-achievements', {}),
  weaponMastery: _loadObj('sniperstrike-mastery', DEFAULT_MASTERY),
  mapsPlayed:    new Set(_loadArr('sniperstrike-maps-played')),

  // Camera effects
  cameraShakeIntensity: 0,
  cameraShakeDuration: 0,
  isMoving: false,

  // VIP chest buff
  infiniteCoins: false,

  // Daily login
  dailyLoginChecked: false,

  // Score multiplier (from powerup)
  scoreMult: 1,

  // Lobby tube system
  tubeEnemyCount: 0,
  inTubeCountdown: false,
  lobbyTubeStartZ: 130,
  lobbyTubeSpacing: 5.5,
  lobbyTubeXLeft: -21,
  lobbyTubeXRight: 21,
  lobbyConvX: 7,
  lobbyHL: 145,
  lobbyConvFwdTex: null,
  lobbyConvBwdTex: null,
};

// Compute initial rank from XP
for (let i = RANK_XP.length - 1; i >= 0; i--) {
  if (gs.xp >= RANK_XP[i]) { gs.rank = i; break; }
}

// ── Inventory / equipped (persisted) ─────────────────────────────────────────
export const inventory = loadInventory();
export const equipped = loadEquipped();

// ── Player runtime state ──────────────────────────────────────────────────────
export const player = {
  health: PLAYER_MAX_HEALTH,
  maxHealth: PLAYER_MAX_HEALTH,
  score: 0,
  weaponKey: 'sniper',
  weapon: null,
  armorKey: 'none',
  armorReduction: 0,
  armorDeflectChance: 0,
  speedMultiplier: 1,
  damageMultiplier: 1,
  fireRateMultiplier: 1,
  canShoot: true,
  cooldownStart: 0,
  cooldownTotal: 0,
  activeEmote: null,
  emoteTimer: 0,
  emoteElapsed: 0,
  speed: 7,

  // Ammo & reload
  ammo: 30,
  maxAmmo: 30,
  isReloading: false,
  reloadTimer: 0,
  reloadDuration: 1.5,

  // Grenades
  grenades: 3,
  maxGrenades: 3,
  grenadeKillCount: 0,

  // Melee
  meleeCooldown: 0,
  meleeKillCount: 0,

  // Dodge
  isDodging: false,
  dodgeTimer: 0,
  dodgeVelX: 0,
  dodgeVelZ: 0,
  dodgeCooldown: 0,

  // Session tracking
  sessionKills: 0,
  sessionHeadshots: 0,
  sessionShots: 0,
  sessionHits: 0,

  // Shield buff (from powerup)
  shieldTimer: 0,

  // VIP chest buffs
  invincibleTimer: 0,

  // Babylon.js references — populated by player.js after engine init
  bodyGroup: null,
  head: null,
  armLeft: null,
  armRight: null,
  legLeft: null,
  legRight: null,
  gun: null,
  armorMesh: null,
  clothesAccessoryState: {},
};

// ── World arrays ──────────────────────────────────────────────────────────────
export const enemies          = [];
export const bullets          = [];
export const grenadeObjects   = [];
export const wallColliders    = [];
export const activeMapGroups  = [];
export const stores           = [];
export const cars             = [];
export const powerups         = [];
export const activeBuffs      = {};
export const congregants      = [];
export const vaticanCongregants = [];
export const fleeingNpcs      = [];
export const activeFloatingTexts = [];
export const activeSpeechBubbles = [];
export const interactableObjects = [];
