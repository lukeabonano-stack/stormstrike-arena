// ── audio.js  All synthesized sound — Web Audio API, no asset files ───────────
import { gs } from './state.js';

const audioCtx = new (window.AudioContext || window.webkitAudioContext)();

export function resumeAudio() {
  if (audioCtx.state === 'suspended') audioCtx.resume();
}

export function setAudioMuted(muted) {
  gs.audioMuted = muted;
  localStorage.setItem('sniperstrike-muted', String(muted));
  if (muted) { stopAmbientDrone(); stopMusic(); }
  else { startAmbientDrone(); startMusic(); }
}

function _sfxVol() { return gs.sfxVolume ?? 0.8; }
function _musVol() { return gs.musicVolume ?? 0.5; }

function playTone({ freq = 440, type = 'sine', duration = 0.15, volume = 1, freqEnd, attack = 0.005 }) {
  if (gs.audioMuted) return;
  const t0 = audioCtx.currentTime;
  const osc = audioCtx.createOscillator();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t0);
  if (freqEnd !== undefined) osc.frequency.exponentialRampToValueAtTime(Math.max(freqEnd, 1), t0 + duration);
  const gain = audioCtx.createGain();
  gain.gain.setValueAtTime(0, t0);
  gain.gain.linearRampToValueAtTime(volume * _sfxVol(), t0 + attack);
  gain.gain.exponentialRampToValueAtTime(0.001, t0 + duration);
  osc.connect(gain);
  gain.connect(audioCtx.destination);
  osc.start(t0);
  osc.stop(t0 + duration + 0.02);
}

function playNoiseBurst({ duration = 0.12, volume = 1, filterFreq = 1200, filterType = 'lowpass' }) {
  if (gs.audioMuted) return;
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
  gain.gain.setValueAtTime(volume * _sfxVol(), t0);
  gain.gain.exponentialRampToValueAtTime(0.001, t0 + duration);
  noise.connect(filter);
  filter.connect(gain);
  gain.connect(audioCtx.destination);
  noise.start(t0);
}

export function playGunshot(weaponKey) {
  switch (weaponKey) {
    case 'sniper':
      // Loud, high-crack sniper shot
      playNoiseBurst({ duration: 0.18, volume: 0.8, filterFreq: 3000 });
      playTone({ freq: 120, freqEnd: 40, type: 'square', duration: 0.14, volume: 0.65 });
      break;
    case 'pistol':
      playNoiseBurst({ duration: 0.07, volume: 0.45, filterFreq: 2400 });
      playTone({ freq: 200, freqEnd: 90, type: 'square', duration: 0.07, volume: 0.35 });
      break;
    case 'shotgun':
      // Multi-burst spread sound
      playNoiseBurst({ duration: 0.14, volume: 0.7, filterFreq: 1800 });
      playTone({ freq: 100, freqEnd: 35, type: 'square', duration: 0.12, volume: 0.55 });
      playNoiseBurst({ duration: 0.1, volume: 0.4, filterFreq: 900, filterType: 'bandpass' });
      break;
    case 'smg':
      playNoiseBurst({ duration: 0.05, volume: 0.3, filterFreq: 2000 });
      playTone({ freq: 220, freqEnd: 110, type: 'square', duration: 0.05, volume: 0.25 });
      break;
    case 'rocket':
      playNoiseBurst({ duration: 0.22, volume: 0.7, filterFreq: 800 });
      playTone({ freq: 80, freqEnd: 30, type: 'sawtooth', duration: 0.25, volume: 0.6 });
      break;
    case 'minigun':
      playNoiseBurst({ duration: 0.04, volume: 0.25, filterFreq: 2600 });
      break;
    case 'revolver':
      // Loud single crack
      playNoiseBurst({ duration: 0.12, volume: 0.65, filterFreq: 2800 });
      playTone({ freq: 160, freqEnd: 50, type: 'square', duration: 0.10, volume: 0.55 });
      break;
    case 'lmg':
      playNoiseBurst({ duration: 0.07, volume: 0.4, filterFreq: 2200 });
      playTone({ freq: 160, freqEnd: 70, type: 'square', duration: 0.07, volume: 0.30 });
      break;
    case 'crossbow':
      // Twang and whoosh
      playTone({ freq: 600, freqEnd: 200, type: 'triangle', duration: 0.18, volume: 0.4 });
      playNoiseBurst({ duration: 0.08, volume: 0.2, filterFreq: 600, filterType: 'bandpass' });
      break;
    default:
      playNoiseBurst({ duration: 0.1, volume: 0.5, filterFreq: 2200 });
      playTone({ freq: 180, freqEnd: 60, type: 'square', duration: 0.08, volume: 0.4 });
  }
}

export function playChestOpen() {
  playTone({ freq: 180, freqEnd: 90, type: 'triangle', duration: 0.4, volume: 0.5 });
  playTone({ freq: 440, freqEnd: 880, type: 'sine', duration: 0.3, volume: 0.35, attack: 0.05 });
  playNoiseBurst({ duration: 0.15, volume: 0.3, filterFreq: 400, filterType: 'bandpass' });
}

export function playEnemyGunshot() {
  playNoiseBurst({ duration: 0.08, volume: 0.28, filterFreq: 1400 });
  playTone({ freq: 140, freqEnd: 50, type: 'square', duration: 0.07, volume: 0.22 });
}

export function playHeadshot() {
  playTone({ freq: 880, type: 'sine', duration: 0.12, volume: 0.5 });
  playTone({ freq: 1320, type: 'sine', duration: 0.18, volume: 0.35, attack: 0.05 });
}

export function playBulletHit() {
  playTone({ freq: 420, freqEnd: 220, type: 'triangle', duration: 0.07, volume: 0.35 });
  playNoiseBurst({ duration: 0.04, volume: 0.2, filterFreq: 800 });
}

export function playHurt() {
  playNoiseBurst({ duration: 0.15, volume: 0.4, filterFreq: 500 });
}

export function playArmorDeflect() {
  playTone({ freq: 1600, freqEnd: 900, type: 'triangle', duration: 0.08, volume: 0.4 });
  playNoiseBurst({ duration: 0.04, volume: 0.25, filterFreq: 3200 });
}

export function playEnemyDeath() {
  playTone({ freq: 220, freqEnd: 40, type: 'sawtooth', duration: 0.25, volume: 0.3 });
}

export function playLevelUp() {
  [523, 659, 784, 1046].forEach((freq, i) => {
    setTimeout(() => playTone({ freq, type: 'triangle', duration: 0.18, volume: 0.4 }), i * 90);
  });
}

export function playHealChime() {
  [660, 880, 990].forEach((freq, i) => {
    setTimeout(() => playTone({ freq, type: 'sine', duration: 0.5, volume: 0.25, attack: 0.05 }), i * 140);
  });
}

export function playFootstep() {
  playNoiseBurst({ duration: 0.05, volume: 0.1, filterFreq: 280 });
}

export function playPickup() {
  playTone({ freq: 740, freqEnd: 1180, type: 'triangle', duration: 0.14, volume: 0.4 });
}

export function playWeaponSwitch() {
  playTone({ freq: 320, type: 'square', duration: 0.05, volume: 0.2 });
}

export function playBossDefeat() {
  [880, 660, 440, 220].forEach((freq, i) => {
    setTimeout(() => playTone({ freq, type: 'sawtooth', duration: 0.35, volume: 0.5 }), i * 110);
  });
  setTimeout(() => playNoiseBurst({ duration: 0.25, volume: 0.35, filterFreq: 800 }), 50);
}

export function playPlayerDeath() {
  [440, 330, 220, 110].forEach((freq, i) => {
    setTimeout(() => playTone({ freq, type: 'sine', duration: 0.55, volume: 0.45, attack: 0.03 }), i * 160);
  });
  playNoiseBurst({ duration: 0.35, volume: 0.3, filterFreq: 280 });
}

export function playCoinEarn() {
  playTone({ freq: 1046, freqEnd: 1568, type: 'triangle', duration: 0.1, volume: 0.3 });
}

export function playStreakMilestone() {
  [523, 659, 784, 1046, 1318].forEach((freq, i) => {
    setTimeout(() => playTone({ freq, type: 'square', duration: 0.11, volume: 0.3 }), i * 55);
  });
}

export function playSpeedBuff() {
  playTone({ freq: 220, freqEnd: 1400, type: 'sine', duration: 0.28, volume: 0.4 });
  playNoiseBurst({ duration: 0.18, volume: 0.18, filterFreq: 4000, filterType: 'highpass' });
}

export function playDamageBuff() {
  playNoiseBurst({ duration: 0.12, volume: 0.4, filterFreq: 700 });
  playTone({ freq: 160, freqEnd: 420, type: 'sawtooth', duration: 0.22, volume: 0.45 });
}

export function playRapidfireBuff() {
  for (let i = 0; i < 6; i++) {
    setTimeout(() => playNoiseBurst({ duration: 0.035, volume: 0.28, filterFreq: 2200 }), i * 38);
  }
}

export function playBuffExpire() {
  playTone({ freq: 440, freqEnd: 200, type: 'sine', duration: 0.28, volume: 0.28 });
}

export function playExplosion() {
  playNoiseBurst({ duration: 0.45, volume: 0.7, filterFreq: 700 });
  playTone({ freq: 90, freqEnd: 28, type: 'sawtooth', duration: 0.55, volume: 0.6 });
}

export function playBlockHit() {
  playTone({ freq: 750, freqEnd: 460, type: 'triangle', duration: 0.07, volume: 0.3 });
  playNoiseBurst({ duration: 0.03, volume: 0.18, filterFreq: 1800 });
}

export function playArmoryOpen() {
  playTone({ freq: 520, freqEnd: 820, type: 'triangle', duration: 0.14, volume: 0.3 });
}

export function playArmoryClose() {
  playTone({ freq: 820, freqEnd: 420, type: 'triangle', duration: 0.1, volume: 0.22 });
}

export function playGameStart() {
  [262, 330, 392, 523, 659].forEach((freq, i) => {
    setTimeout(() => playTone({ freq, type: 'triangle', duration: 0.28, volume: 0.45, attack: 0.02 }), i * 95);
  });
}

export function playReload() {
  playTone({ freq: 320, freqEnd: 180, type: 'square', duration: 0.08, volume: 0.3 });
  setTimeout(() => {
    playNoiseBurst({ duration: 0.06, volume: 0.25, filterFreq: 1600 });
    playTone({ freq: 480, freqEnd: 600, type: 'triangle', duration: 0.12, volume: 0.3 });
  }, 700);
}

export function playMeleeSwing() {
  playNoiseBurst({ duration: 0.08, volume: 0.4, filterFreq: 3500, filterType: 'highpass' });
  playTone({ freq: 280, freqEnd: 140, type: 'sawtooth', duration: 0.1, volume: 0.35 });
}

export function playMeleeHit() {
  playNoiseBurst({ duration: 0.12, volume: 0.55, filterFreq: 600 });
  playTone({ freq: 160, freqEnd: 80, type: 'square', duration: 0.15, volume: 0.4 });
}

export function playGrenadeThrow() {
  playNoiseBurst({ duration: 0.06, volume: 0.2, filterFreq: 800, filterType: 'highpass' });
}

export function playGrenadeBounce() {
  playTone({ freq: 520, freqEnd: 380, type: 'triangle', duration: 0.06, volume: 0.2 });
}

export function playShieldUp() {
  playTone({ freq: 660, freqEnd: 1320, type: 'sine', duration: 0.35, volume: 0.45 });
  for (let i = 0; i < 3; i++) {
    setTimeout(() => playTone({ freq: 880, type: 'triangle', duration: 0.12, volume: 0.2 }), i * 80);
  }
}

export function playShieldBreak() {
  playNoiseBurst({ duration: 0.3, volume: 0.5, filterFreq: 2000 });
  playTone({ freq: 440, freqEnd: 110, type: 'sawtooth', duration: 0.35, volume: 0.45 });
}

export function playFreeze() {
  playTone({ freq: 880, freqEnd: 440, type: 'sine', duration: 0.4, volume: 0.4 });
  playNoiseBurst({ duration: 0.25, volume: 0.3, filterFreq: 5000, filterType: 'highpass' });
}

export function playNukeCharge() {
  const t0 = audioCtx.currentTime;
  if (gs.audioMuted) return;
  const osc = audioCtx.createOscillator();
  osc.type = 'sawtooth';
  osc.frequency.setValueAtTime(80, t0);
  osc.frequency.exponentialRampToValueAtTime(800, t0 + 5);
  const gain = audioCtx.createGain();
  gain.gain.setValueAtTime(0, t0);
  gain.gain.linearRampToValueAtTime(0.4 * _sfxVol(), t0 + 0.1);
  gain.gain.linearRampToValueAtTime(0, t0 + 5);
  osc.connect(gain); gain.connect(audioCtx.destination);
  osc.start(t0); osc.stop(t0 + 5);
}

export function playRankUp() {
  [523, 659, 784, 1046, 1318, 1568].forEach((freq, i) => {
    setTimeout(() => playTone({ freq, type: 'sine', duration: 0.25, volume: 0.5 }), i * 80);
  });
}

export function playAchievementUnlock() {
  [523, 784, 1046, 784, 1046, 1318].forEach((freq, i) => {
    setTimeout(() => playTone({ freq, type: 'triangle', duration: 0.2, volume: 0.4 }), i * 70);
  });
}

export function playComboUp() {
  const freq = 440 + gs.combo * 40;
  playTone({ freq, type: 'triangle', duration: 0.1, volume: 0.25 });
}

export function playDodge() {
  playNoiseBurst({ duration: 0.08, volume: 0.3, filterFreq: 2500, filterType: 'highpass' });
  playTone({ freq: 330, freqEnd: 520, type: 'sine', duration: 0.12, volume: 0.25 });
}

// ── Announcer (streak vocal indicator) ───────────────────────────────────────
export function playAnnouncer(type) {
  // Synthesized "announcer" tones — not real speech, but distinctive musical phrases
  const phrases = {
    doubleKill:    [[600, 0.12], [800, 0.12]],
    tripleKill:    [[600, 0.1], [700, 0.1], [900, 0.15]],
    multikill:     [[500, 0.09], [650, 0.09], [800, 0.09], [1050, 0.18]],
    onfire:        [[440, 0.06], [550, 0.06], [660, 0.06], [880, 0.06], [1100, 0.25]],
    unstoppable:   [[330, 0.08], [440, 0.08], [550, 0.08], [660, 0.08], [770, 0.08], [1100, 0.3]],
  };
  const p = phrases[type];
  if (!p) return;
  let t = 0;
  p.forEach(([freq, dur]) => {
    setTimeout(() => playTone({ freq, type: 'square', duration: dur, volume: 0.35 }), t * 1000);
    t += dur + 0.02;
  });
}

// ── Background music system (battle theme — E minor, 160 BPM) ────────────────
let _musicCtx = null;
let _musicNodes = [];
let _musicScheduled = false;
let _musicGain = null;

const BPM  = 160;
const BEAT = 60 / BPM;   // 0.375 s per beat

// 8-beat aggressive riff in E minor (square wave lead)
const MELODY = [
  [659,0.25],[784,0.25],[659,0.25],[587,0.25],  // E5 G5 E5 D5 (beat 1)
  [494,0.5], [587,0.5],                          // B4  D5       (beat 2)
  [523,0.25],[494,0.25],[440,0.5],               // C5  B4  A4   (beat 3)
  [392,1.0],                                     // G4 held      (beat 4)
  [330,0.25],[392,0.25],[440,0.25],[494,0.25],  // E4 G4 A4 B4  (beat 5)
  [659,0.5], [587,0.25],[523,0.25],             // E5 D5 C5     (beat 6)
  [494,0.5], [392,0.5],                          // B4 G4        (beat 7)
  [440,1.0],                                     // A4 held      (beat 8)
];

// Punchy staccato bass (sawtooth, E2/G2/A2/B2 power movement)
const BASS = [
  [82,0.75],[82,0.25],  [98,0.75],[98,0.25],   // E2 E2 G2 G2
  [110,0.75],[110,0.25],[123,0.75],[123,0.25], // A2 A2 B2 B2
  [82,0.75],[82,0.25],  [98,0.5],[110,0.5],    // E2 E2 G2 A2
  [123,0.75],[123,0.25],[82,1.0],              // B2 B2 E2 long
];

// Shared white-noise buffer for percussion
let _noiseBuffer = null;
function _getNoiseBuf() {
  if (_noiseBuffer) return _noiseBuffer;
  const len = Math.floor(audioCtx.sampleRate * 0.15);
  _noiseBuffer = audioCtx.createBuffer(1, len, audioCtx.sampleRate);
  const d = _noiseBuffer.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
  return _noiseBuffer;
}

function _kick(t) {
  const osc = audioCtx.createOscillator();
  osc.type = 'sine';
  osc.frequency.setValueAtTime(165, t);
  osc.frequency.exponentialRampToValueAtTime(38, t + 0.13);
  const g = audioCtx.createGain();
  g.gain.setValueAtTime(1.5, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + 0.19);
  osc.connect(g); g.connect(_musicGain);
  osc.start(t); osc.stop(t + 0.22);
  _musicNodes.push(osc, g);
}

function _snare(t) {
  const noise = audioCtx.createBufferSource();
  noise.buffer = _getNoiseBuf();
  const bp = audioCtx.createBiquadFilter();
  bp.type = 'bandpass'; bp.frequency.value = 1800; bp.Q.value = 0.9;
  const g = audioCtx.createGain();
  g.gain.setValueAtTime(0.65, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + 0.1);
  noise.connect(bp); bp.connect(g); g.connect(_musicGain);
  noise.start(t); noise.stop(t + 0.12);
  _musicNodes.push(noise, bp, g);
  // tonal body under snare crack
  const body = audioCtx.createOscillator();
  body.type = 'triangle'; body.frequency.value = 210;
  const bg = audioCtx.createGain();
  bg.gain.setValueAtTime(0.22, t);
  bg.gain.exponentialRampToValueAtTime(0.001, t + 0.065);
  body.connect(bg); bg.connect(_musicGain);
  body.start(t); body.stop(t + 0.08);
  _musicNodes.push(body, bg);
}

function _hihat(t, open) {
  const noise = audioCtx.createBufferSource();
  noise.buffer = _getNoiseBuf();
  const hp = audioCtx.createBiquadFilter();
  hp.type = 'highpass'; hp.frequency.value = 9000;
  const g = audioCtx.createGain();
  const dur = open ? 0.11 : 0.032;
  g.gain.setValueAtTime(0.11, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + dur);
  noise.connect(hp); hp.connect(g); g.connect(_musicGain);
  noise.start(t); noise.stop(t + dur + 0.01);
  _musicNodes.push(noise, hp, g);
}

function _schedulePercussion(t0) {
  // Driving double-kick pattern (in beats from t0, 8-beat loop)
  const kicks = [0, 0.5, 1, 1.5, 2, 3, 4, 4.5, 5, 5.5, 6, 7];
  kicks.forEach(b => _kick(t0 + b * BEAT));

  // Snare on 2 and 6 (beats 2 and 4 of each bar)
  [2, 6].forEach(b => _snare(t0 + b * BEAT));

  // Closed hi-hat on every 8th note; open on beat 3.5 and 7.5
  for (let b = 0; b < 8; b += 0.5) {
    _hihat(t0 + b * BEAT, b === 3.5 || b === 7.5);
  }

  // Power stabs on off-beats (sawtooth E2+B2 chord, short gate)
  [1, 3, 5, 7].forEach(b => {
    [[82, 123]].flat().forEach(f => {
      const o = audioCtx.createOscillator();
      o.type = 'sawtooth'; o.frequency.value = f;
      const g = audioCtx.createGain();
      const st = t0 + b * BEAT + BEAT * 0.5;
      g.gain.setValueAtTime(0.16, st);
      g.gain.exponentialRampToValueAtTime(0.001, st + 0.14);
      o.connect(g); g.connect(_musicGain);
      o.start(st); o.stop(st + 0.17);
      _musicNodes.push(o, g);
    });
  });
}

function scheduleMusic() {
  if (!_musicGain || gs.audioMuted) return;
  const t0 = audioCtx.currentTime + 0.05;

  // Lead — square wave, fast attack, staccato
  let offset = 0;
  MELODY.forEach(([freq, beats]) => {
    const osc = audioCtx.createOscillator();
    osc.type = 'square';
    osc.frequency.value = freq;
    const g = audioCtx.createGain();
    const dur = beats * BEAT;
    const att = Math.min(0.014, dur * 0.12);
    g.gain.setValueAtTime(0, t0 + offset);
    g.gain.linearRampToValueAtTime(0.08, t0 + offset + att);
    g.gain.setValueAtTime(0.065, t0 + offset + dur * 0.55);
    g.gain.linearRampToValueAtTime(0, t0 + offset + dur - 0.01);
    osc.connect(g); g.connect(_musicGain);
    osc.start(t0 + offset); osc.stop(t0 + offset + dur + 0.02);
    _musicNodes.push(osc, g);
    offset += dur;
  });

  const totalBeats = MELODY.reduce((s, [, b]) => s + b, 0);

  // Bass — sawtooth, punchy staccato gate
  let bOff = 0;
  BASS.forEach(([freq, beats]) => {
    const osc = audioCtx.createOscillator();
    osc.type = 'sawtooth';
    osc.frequency.value = freq;
    const g = audioCtx.createGain();
    const dur = beats * BEAT;
    const gate = dur * 0.72;
    g.gain.setValueAtTime(0, t0 + bOff);
    g.gain.linearRampToValueAtTime(0.15, t0 + bOff + 0.01);
    g.gain.setValueAtTime(0.13, t0 + bOff + gate - 0.01);
    g.gain.linearRampToValueAtTime(0, t0 + bOff + gate);
    osc.connect(g); g.connect(_musicGain);
    osc.start(t0 + bOff); osc.stop(t0 + bOff + dur + 0.02);
    _musicNodes.push(osc, g);
    bOff += dur;
  });

  // Percussion
  _schedulePercussion(t0);

  const loopDuration = totalBeats * BEAT;
  _musicScheduled = true;
  setTimeout(() => {
    _musicNodes = [];
    _musicScheduled = false;
    if (_musicGain && !gs.audioMuted) scheduleMusic();
  }, loopDuration * 1000);
}

export function startMusic() {
  if (_musicGain || gs.audioMuted) return;
  _musicGain = audioCtx.createGain();
  _musicGain.gain.value = _musVol() * 0.6;
  _musicGain.connect(audioCtx.destination);
  scheduleMusic();
}

export function stopMusic() {
  if (!_musicGain) return;
  _musicNodes.forEach(n => { try { n.stop?.(); n.disconnect?.(); } catch {} });
  _musicNodes = [];
  try { _musicGain.disconnect(); } catch {}
  _musicGain = null;
  _musicScheduled = false;
}

export function setMusicVolume(v) {
  gs.musicVolume = Math.max(0, Math.min(1, v));
  if (_musicGain) _musicGain.gain.value = gs.musicVolume * 0.6;
}

export function setSfxVolume(v) {
  gs.sfxVolume = Math.max(0, Math.min(1, v));
}

// ── Ambient drone ─────────────────────────────────────────────────────────────
let ambientNodes = null;
export function startAmbientDrone() {
  if (ambientNodes || gs.audioMuted) return;
  const osc1 = audioCtx.createOscillator();
  osc1.type = 'sine'; osc1.frequency.value = 55;
  const osc2 = audioCtx.createOscillator();
  osc2.type = 'sine'; osc2.frequency.value = 82.4;
  const gain = audioCtx.createGain();
  gain.gain.value = 0.035 * _sfxVol();
  osc1.connect(gain); osc2.connect(gain); gain.connect(audioCtx.destination);
  osc1.start(); osc2.start();
  ambientNodes = { osc1, osc2, gain };
}

export function stopAmbientDrone() {
  if (!ambientNodes) return;
  ambientNodes.osc1.stop();
  ambientNodes.osc2.stop();
  ambientNodes = null;
}
