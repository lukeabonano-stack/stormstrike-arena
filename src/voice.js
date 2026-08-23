// ── voice.js  Voice → WebLLM enemy response → TTS (fully local, no API key) ──
import { enemies } from './state.js';
import { playerBody } from './player.js';
import { spawnSpeechBubble } from './effects.js';

// Smallest capable chat model — ~800 MB, cached after first download
const MODEL_ID = 'Llama-3.2-1B-Instruct-q4f16_1-MLC';

const SYSTEM_PROMPT =
  'You are a battle-hardened enemy soldier in a first-person shooter game. ' +
  'The player has spoken to you. Reply with ONE short, cocky comeback (max 12 words). ' +
  'Be confident and witty — no slurs, no profanity, no personal insults, ' +
  'and never use the words "hell" or "pathetic". ' +
  'Keep it competitive banter, like rivals trash-talking in a sport. No quotation marks. No emojis.';

// ── WebLLM engine (lazy-loaded) ───────────────────────────────────────────────
let _engine   = null;
let _loading  = false;
let _ready    = false;

async function loadEngine(onProgress) {
  if (_ready || _loading) return;
  _loading = true;
  try {
    const { MLCEngine } = await import('https://esm.run/@mlc-ai/web-llm');
    _engine = new MLCEngine();
    await _engine.reload(MODEL_ID, {
      initProgressCallback: ({ progress, text }) => onProgress?.(progress, text),
    });
    _ready   = true;
    _loading = false;
  } catch (err) {
    _loading = false;
    console.error('[WebLLM] load error:', err);
    throw err;
  }
}

async function askLLM(userText) {
  if (!_ready || !_engine) return null;
  try {
    const resp = await _engine.chat.completions.create({
      messages: [
        { role: 'system',  content: SYSTEM_PROMPT },
        { role: 'user',    content: userText },
      ],
      max_tokens:  40,
      temperature: 1.0,
      stream:      false,
    });
    return resp.choices?.[0]?.message?.content?.trim() || null;
  } catch (err) {
    console.error('[WebLLM] inference error:', err);
    return null;
  }
}

// ── Fallback lines (used while model is still downloading) ────────────────────
const FALLBACK = [
  "Talk more. It helps me aim.",
  "Bold words. Back them up.",
  "I've heard scarier from a puppy.",
  "Keep chatting — it won't save you.",
  "Last one who said that didn't walk away.",
  "Nice try. Now hold still.",
  "I eat rookies like you for breakfast.",
  "Cute. Now dodge this.",
];
function fallback() { return FALLBACK[Math.floor(Math.random() * FALLBACK.length)]; }

// ── Helpers ───────────────────────────────────────────────────────────────────
function getNearestLivingEnemy() {
  let nearest = null, minDist = Infinity;
  enemies.forEach(e => {
    if (e.health <= 0) return;
    const d = BABYLON.Vector3.Distance(e.position, playerBody.position);
    if (d < minDist) { minDist = d; nearest = e; }
  });
  return nearest;
}

function showVoiceError(msg) {
  const el = document.getElementById('voice-error');
  if (!el) return;
  el.textContent = msg;
  el.classList.remove('hidden');
  setTimeout(() => el.classList.add('hidden'), 5000);
}

// ── TTS ───────────────────────────────────────────────────────────────────────
function speakLine(text) {
  if (!window.speechSynthesis) return;
  window.speechSynthesis.cancel();
  const utt = new SpeechSynthesisUtterance(text);
  utt.rate = 0.88; utt.pitch = 0.65; utt.volume = 1.0;
  const pick = () => {
    const voices = window.speechSynthesis.getVoices();
    const v = voices.find(v => /Google UK English Male|Microsoft David|Microsoft Mark/i.test(v.name))
           || voices.find(v => /en-?US|en-?GB/i.test(v.lang));
    if (v) utt.voice = v;
    window.speechSynthesis.speak(utt);
  };
  window.speechSynthesis.getVoices().length ? pick()
    : (window.speechSynthesis.onvoiceschanged = pick);
}

// ── Handle a recognised utterance ────────────────────────────────────────────
let _busy = false;

async function handleUtterance(text) {
  if (!text || _busy) return;
  _busy = true;

  spawnSpeechBubble(text, playerBody, true);

  let reply;
  if (_ready) {
    reply = (await askLLM(text)) || fallback();
  } else {
    reply = fallback();
  }

  const enemy = getNearestLivingEnemy();
  if (enemy) spawnSpeechBubble(reply, enemy, false);
  speakLine(reply);

  setTimeout(() => { _busy = false; }, 2200);
}

// ── Main voice button wiring ──────────────────────────────────────────────────
export function initVoice() {
  const btn = document.getElementById('voice-btn');
  if (!btn) return;

  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SR) {
    btn.title = 'Voice not supported — use Chrome or Edge';
    btn.style.opacity = '0.4';
    btn.style.cursor  = 'not-allowed';
    return;
  }

  // ── Start loading the model in the background right away ──────────────────
  const statusEl = document.getElementById('voice-error'); // reuse for download status
  loadEngine((pct, text) => {
    if (!statusEl) return;
    const label = pct < 1
      ? `AI loading… ${Math.round(pct * 100)}%`
      : 'AI ready!';
    statusEl.textContent = label;
    statusEl.classList.remove('hidden');
    if (pct >= 1) setTimeout(() => statusEl.classList.add('hidden'), 2000);
  }).catch(() => {
    showVoiceError('AI model failed to load — using fallback responses.');
  });

  // ── Speech recognition ────────────────────────────────────────────────────
  const rec = new SR();
  rec.lang            = 'en-US';
  rec.continuous      = true;
  rec.interimResults  = false;
  rec.maxAlternatives = 1;

  let listening = false;

  btn.addEventListener('click', (e) => {
    e.stopPropagation();
    if (listening) { rec.stop(); return; }
    try { rec.start(); } catch (_) {}
  });

  rec.addEventListener('start', () => {
    listening = true;
    btn.classList.add('listening');
    btn.textContent = '🔴';
    btn.title = 'Listening… click to stop';
  });

  rec.addEventListener('end', () => {
    listening = false;
    btn.classList.remove('listening');
    btn.textContent = '🎤';
    btn.title = 'Talk to enemy (click mic)';
  });

  rec.addEventListener('result', (e) => {
    const result = e.results[e.resultIndex];
    if (!result.isFinal) return;
    const text = result[0].transcript.trim();
    if (text) handleUtterance(text);
  });

  rec.addEventListener('error', (e) => {
    listening = false;
    btn.classList.remove('listening');
    btn.textContent = '🎤';
    if (e.error === 'no-speech') return;
    if (e.error !== 'aborted') showVoiceError(`Mic error: ${e.error}`);
  });
}
