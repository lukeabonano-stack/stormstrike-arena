// ── textures.js  Procedural PBR texture library ────────────────────────────────
// Leaf-level module: imports only engine.js. Canvas-drawn diffuse + a
// Sobel-derived bump map, cached by kind+options so repeated calls (many
// buildings/roads sharing a look) don't regenerate canvases.

import { scene, pbr, c3, makeCanvasTex } from './engine.js';

const _cache = new Map();

function _sobelBump(ctx, w, h) {
  // Cheap "height from luminance" normal-ish bump: reuse the diffuse canvas'
  // luminance as a greyscale bump texture (good enough for subtle PBR relief
  // at gameplay viewing distances; avoids a second expensive draw pass).
  const src = ctx.getImageData(0, 0, w, h);
  const out = ctx.createImageData(w, h);
  for (let i = 0; i < src.data.length; i += 4) {
    const l = (src.data[i] * 0.3 + src.data[i + 1] * 0.59 + src.data[i + 2] * 0.11);
    out.data[i] = out.data[i + 1] = out.data[i + 2] = l;
    out.data[i + 3] = 255;
  }
  return out;
}

const DRAWERS = {
  asphalt(ctx, W, H, rng) {
    ctx.fillStyle = '#1c1c20'; ctx.fillRect(0, 0, W, H);
    for (let i = 0; i < 900; i++) {
      const x = rng() * W, y = rng() * H, s = 1 + rng() * 2;
      ctx.fillStyle = `rgba(${20 + rng() * 30},${20 + rng() * 30},${22 + rng() * 30},0.5)`;
      ctx.fillRect(x, y, s, s);
    }
    // Lane dashes down the middle (vertical)
    ctx.fillStyle = 'rgba(230,220,190,0.85)';
    for (let y = 20; y < H; y += 70) ctx.fillRect(W / 2 - 4, y, 8, 40);
  },
  concrete(ctx, W, H, rng) {
    ctx.fillStyle = '#8f8a82'; ctx.fillRect(0, 0, W, H);
    for (let i = 0; i < 500; i++) {
      const x = rng() * W, y = rng() * H, s = 1 + rng() * 3;
      const v = 120 + rng() * 60;
      ctx.fillStyle = `rgba(${v},${v - 4},${v - 8},0.35)`;
      ctx.fillRect(x, y, s, s);
    }
    ctx.strokeStyle = 'rgba(60,55,50,0.4)'; ctx.lineWidth = 2;
    for (let x = 0; x < W; x += W / 4) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke(); }
  },
  brick(ctx, W, H, rng) {
    ctx.fillStyle = '#7a3320'; ctx.fillRect(0, 0, W, H);
    const bw = W / 8, bh = H / 16;
    for (let row = 0; row < 16; row++) {
      const offset = (row % 2) * (bw / 2);
      for (let col = -1; col < 9; col++) {
        const x = col * bw + offset, y = row * bh;
        const v = 0.85 + rng() * 0.3;
        ctx.fillStyle = `rgb(${Math.floor(130 * v)},${Math.floor(52 * v)},${Math.floor(30 * v)})`;
        ctx.fillRect(x + 1, y + 1, bw - 2, bh - 2);
      }
    }
    ctx.strokeStyle = 'rgba(40,30,25,0.5)'; ctx.lineWidth = 1;
    for (let row = 0; row <= 16; row++) { ctx.beginPath(); ctx.moveTo(0, row * bh); ctx.lineTo(W, row * bh); ctx.stroke(); }
  },
  sand(ctx, W, H, rng) {
    ctx.fillStyle = '#d8b878'; ctx.fillRect(0, 0, W, H);
    for (let i = 0; i < 2000; i++) {
      const x = rng() * W, y = rng() * H;
      const v = 190 + rng() * 50;
      ctx.fillStyle = `rgba(${v},${v * 0.82},${v * 0.5},0.25)`;
      ctx.beginPath(); ctx.arc(x, y, 1 + rng() * 2, 0, Math.PI * 2); ctx.fill();
    }
    // Ripple bands
    ctx.strokeStyle = 'rgba(150,110,60,0.15)'; ctx.lineWidth = 3;
    for (let y = 0; y < H; y += 18) {
      ctx.beginPath();
      for (let x = 0; x <= W; x += 20) ctx.lineTo(x, y + Math.sin(x * 0.05) * 6);
      ctx.stroke();
    }
  },
  metalPlate(ctx, W, H, rng) {
    ctx.fillStyle = '#4a5058'; ctx.fillRect(0, 0, W, H);
    const cell = W / 6;
    for (let gx = 0; gx < 6; gx++) for (let gy = 0; gy < 6; gy++) {
      const v = 60 + rng() * 30;
      ctx.fillStyle = `rgb(${v},${v + 4},${v + 8})`;
      ctx.fillRect(gx * cell + 1, gy * cell + 1, cell - 2, cell - 2);
      ctx.strokeStyle = 'rgba(0,0,0,0.4)'; ctx.strokeRect(gx * cell, gy * cell, cell, cell);
      ctx.fillStyle = 'rgba(20,22,26,0.9)';
      for (const [dx, dy] of [[6, 6], [cell - 6, 6], [6, cell - 6], [cell - 6, cell - 6]]) {
        ctx.beginPath(); ctx.arc(gx * cell + dx, gy * cell + dy, 2, 0, Math.PI * 2); ctx.fill();
      }
    }
  },
  ash(ctx, W, H, rng) {
    ctx.fillStyle = '#2a2420'; ctx.fillRect(0, 0, W, H);
    for (let i = 0; i < 1400; i++) {
      const x = rng() * W, y = rng() * H, v = 10 + rng() * 50;
      ctx.fillStyle = `rgba(${v},${v * 0.85},${v * 0.75},0.4)`;
      ctx.fillRect(x, y, 1 + rng() * 2, 1 + rng() * 2);
    }
    // Cracks
    ctx.strokeStyle = 'rgba(5,5,5,0.6)'; ctx.lineWidth = 1.5;
    for (let i = 0; i < 6; i++) {
      let x = rng() * W, y = rng() * H;
      ctx.beginPath(); ctx.moveTo(x, y);
      for (let s = 0; s < 8; s++) { x += (rng() - 0.5) * 60; y += (rng() - 0.5) * 60; ctx.lineTo(x, y); }
      ctx.stroke();
    }
  },
};

export function texPBR(kind, opts = {}) {
  const seed = opts.seed ?? 7;
  const key = kind + '|' + seed;
  if (_cache.has(key)) return _cache.get(key);
  const drawer = DRAWERS[kind] || DRAWERS.concrete;
  let rngState = seed;
  const rng = () => { rngState = (rngState * 16807) % 2147483647; return (rngState & 0xfffffff) / 0xfffffff; };

  const W = 512, H = 512;
  const albedoTex = makeCanvasTex(W, H, (ctx) => drawer(ctx, W, H, rng));
  const bumpTex = makeCanvasTex(W, H, (ctx) => {
    drawer(ctx, W, H, (() => { let s = seed; return () => { s = (s * 16807) % 2147483647; return (s & 0xfffffff) / 0xfffffff; }; })());
    const imgData = _sobelBump(ctx, W, H);
    ctx.putImageData(imgData, 0, 0);
  });
  const result = { albedoTexture: albedoTex, bumpTexture: bumpTex };
  _cache.set(key, result);
  return result;
}

// pbr() + texture assignment + uv tiling, matching engine.js's pbr(hex, roughness, metallic, opts) signature.
// Each call gets its own cloned texture instances so per-material uv scale
// doesn't fight other materials sharing the same cached source canvas.
export function pbrTex(kind, hex, roughness, metallic, opts = {}) {
  const mat = pbr(hex, roughness, metallic, opts);
  const { albedoTexture: srcAlbedo, bumpTexture: srcBump } = texPBR(kind, opts);
  const uv = opts.uv ?? 4;
  const albedoTexture = srcAlbedo.clone();
  const bumpTexture = srcBump.clone();
  albedoTexture.uScale = albedoTexture.vScale = uv;
  bumpTexture.uScale = bumpTexture.vScale = uv;
  mat.albedoTexture = albedoTexture;
  mat.bumpTexture = bumpTexture;
  mat.bumpTexture.level = opts.bumpLevel ?? 0.5;
  return mat;
}
