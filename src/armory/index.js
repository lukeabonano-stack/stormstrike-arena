// ── armory/index.js  Armory UI tabs, card factory, preview loop ───────────────
import { gs, player, inventory, equipped, VIP_PRICE,
         saveInventory, saveEquipped, saveCoins } from '../state.js';
import { WEAPON_DEFS, getEquippedGunMaterials, rebuildGunVisual } from './weapons.js';
import { ARMOR_DEFS, buildArmorMesh, getArmorMaterial } from './armor.js';
import { SKIN_DEFS } from './skins.js';
import { CLOTHES_DEFS } from './clothes.js';
import { EMOTE_DEFS, applyEmotePose } from './emotes.js';
import { previewRig, applyPlayerArmor, setPlayerWeapon, applyPlayerClothes } from '../player.js';
import { previewScene, previewEngine } from '../engine.js';

// ── Armory state ──────────────────────────────────────────────────────────────
let activeTab = 'weapons';
let armoryOpen = false;
let previewRaf = null;

const TABS = ['weapons', 'skins', 'clothes', 'armor', 'emotes', 'vip'];

// ── Card factory ──────────────────────────────────────────────────────────────
function createArmoryCard({ name, price, owned, equipped: isEquipped, disabled, actionText, onAction, onUnequip, onSelect }) {
  const card = document.createElement('div');
  card.className = 'armory-card' + (isEquipped ? ' equipped' : '') + (disabled ? ' disabled' : '');

  const title = document.createElement('div');
  title.className = 'card-title';
  title.textContent = name;

  const priceEl = document.createElement('div');
  priceEl.className = 'card-price';
  priceEl.textContent = price > 0 ? `${price} coins` : 'Free';

  const btn = document.createElement('button');
  btn.className = 'card-action-btn';

  if (isEquipped && onUnequip) {
    btn.textContent = 'Unequip';
    btn.disabled = false;
    btn.addEventListener('click', (e) => { e.stopPropagation(); onUnequip(); });
  } else {
    btn.textContent = isEquipped ? 'Equipped' : (owned ? 'Equip' : actionText || 'Buy');
    btn.disabled = disabled || isEquipped;
    btn.addEventListener('click', (e) => { e.stopPropagation(); if (!disabled) onAction(); });
  }

  if (onSelect) card.addEventListener('click', onSelect);

  card.append(title, priceEl, btn);
  return card;
}

// ── Tab renderers ─────────────────────────────────────────────────────────────
const ARMORY_TAB_RENDERERS = {};

ARMORY_TAB_RENDERERS.weapons = function() {
  const grid = document.getElementById('armory-grid');
  grid.innerHTML = '';
  Object.entries(WEAPON_DEFS).forEach(([key, def]) => {
    if (def.vipOnly && !inventory.vip) return;
    if (def.secretVip && !inventory.weapons.includes(key)) return;
    const owned = inventory.weapons.includes(key);
    const isEq = equipped.weapon === key;
    grid.appendChild(createArmoryCard({
      name: def.name,
      price: def.price,
      owned,
      equipped: isEq,
      disabled: !owned && !gs.infiniteCoins && gs.coins < def.price,
      actionText: owned ? 'Equip' : 'Buy',
      onAction: () => {
        if (!owned) {
          if (!gs.infiniteCoins && gs.coins < def.price) return;
          if (!gs.infiniteCoins) { gs.coins -= def.price; saveCoins(); }
          else { gs.infiniteCoins = false; saveCoins(); }
          inventory.weapons.push(key);
          saveInventory();
        }
        equipped.weapon = key;
        saveEquipped();
        setPlayerWeapon(key, getEquippedGunMaterials);
        renderTab();
      },
      onUnequip: (isEq && key !== 'sniper') ? () => {
        equipped.weapon = 'sniper';
        saveEquipped();
        setPlayerWeapon('sniper', getEquippedGunMaterials);
        renderTab();
      } : undefined,
    }));
  });
};

ARMORY_TAB_RENDERERS.skins = function() {
  const grid = document.getElementById('armory-grid');
  grid.innerHTML = '';
  Object.entries(SKIN_DEFS).forEach(([key, def]) => {
    if (def.vipOnly && !inventory.vip) return;
    if (def.secretVip && !inventory.skins.includes(key)) return;
    const owned = inventory.skins.includes(key);
    const isEq = equipped.skin === key;
    grid.appendChild(createArmoryCard({
      name: def.name,
      price: def.price,
      owned,
      equipped: isEq,
      disabled: !owned && !gs.infiniteCoins && gs.coins < def.price,
      onAction: () => {
        if (!owned) {
          if (!gs.infiniteCoins && gs.coins < def.price) return;
          if (!gs.infiniteCoins) { gs.coins -= def.price; saveCoins(); }
          else { gs.infiniteCoins = false; saveCoins(); }
          inventory.skins.push(key);
          saveInventory();
        }
        equipped.skin = key;
        saveEquipped();
        setPlayerWeapon(equipped.weapon || 'sniper', getEquippedGunMaterials);
        renderTab();
      },
      onUnequip: isEq ? () => {
        equipped.skin = null;
        saveEquipped();
        setPlayerWeapon(equipped.weapon || 'sniper', getEquippedGunMaterials);
        renderTab();
      } : undefined,
    }));
  });
};

ARMORY_TAB_RENDERERS.clothes = function() {
  const grid = document.getElementById('armory-grid');
  grid.innerHTML = '';
  Object.entries(CLOTHES_DEFS).forEach(([key, def]) => {
    if (def.vipOnly && !inventory.vip) return;
    if (def.secretVip && !inventory.clothes.includes(key)) return;
    const owned = inventory.clothes.includes(key);
    const isEq = equipped.clothes === key;
    grid.appendChild(createArmoryCard({
      name: def.name,
      price: def.price,
      owned,
      equipped: isEq,
      disabled: !owned && !gs.infiniteCoins && gs.coins < def.price,
      onAction: () => {
        if (!owned) {
          if (!gs.infiniteCoins && gs.coins < def.price) return;
          if (!gs.infiniteCoins) { gs.coins -= def.price; saveCoins(); }
          else { gs.infiniteCoins = false; saveCoins(); }
          inventory.clothes.push(key);
          saveInventory();
        }
        equipped.clothes = key;
        saveEquipped();
        applyPlayerClothes(key);
        renderTab();
      },
      onUnequip: isEq ? () => {
        equipped.clothes = 'default';
        saveEquipped();
        applyPlayerClothes('default');
        renderTab();
      } : undefined,
    }));
  });
};

ARMORY_TAB_RENDERERS.armor = function() {
  const grid = document.getElementById('armory-grid');
  grid.innerHTML = '';
  Object.entries(ARMOR_DEFS).forEach(([key, def]) => {
    if (def.vipOnly && !inventory.armor.includes(key)) return;
    const owned = inventory.armor.includes(key);
    const isEq = equipped.armor === key;
    grid.appendChild(createArmoryCard({
      name: def.name + (def.deflectChance > 0 ? ` (${Math.round(def.deflectChance * 100)}% deflect)` : ''),
      price: def.price,
      owned,
      equipped: isEq,
      disabled: !owned && !gs.infiniteCoins && gs.coins < def.price,
      onAction: () => {
        if (!owned) {
          if (!gs.infiniteCoins && gs.coins < def.price) return;
          if (!gs.infiniteCoins) { gs.coins -= def.price; saveCoins(); }
          else { gs.infiniteCoins = false; saveCoins(); }
          inventory.armor.push(key);
          saveInventory();
        }
        equipped.armor = key;
        saveEquipped();
        applyPlayerArmor(key);
        renderTab();
      },
      onUnequip: (isEq && key !== 'none') ? () => {
        equipped.armor = 'none';
        saveEquipped();
        applyPlayerArmor('none');
        renderTab();
      } : undefined,
    }));
  });
};

ARMORY_TAB_RENDERERS.emotes = function() {
  const grid = document.getElementById('armory-grid');
  grid.innerHTML = '';
  Object.entries(EMOTE_DEFS).forEach(([key, def]) => {
    if (def.vipOnly && !inventory.vip) return;
    if (def.secretVip && !inventory.emotes.includes(key)) return;
    const owned = inventory.emotes.includes(key);
    const isEq = equipped.emote === key;
    grid.appendChild(createArmoryCard({
      name: def.name,
      price: def.price,
      owned,
      equipped: isEq,
      disabled: !owned && !gs.infiniteCoins && gs.coins < def.price,
      onAction: () => {
        if (!owned) {
          if (!gs.infiniteCoins && gs.coins < def.price) return;
          if (!gs.infiniteCoins) { gs.coins -= def.price; saveCoins(); }
          else { gs.infiniteCoins = false; saveCoins(); }
          inventory.emotes.push(key);
          saveInventory();
        }
        equipped.emote = key;
        saveEquipped();
        renderTab();
      },
      onUnequip: isEq ? () => {
        equipped.emote = null;
        saveEquipped();
        renderTab();
      } : undefined,
    }));
  });
};

ARMORY_TAB_RENDERERS.vip = function() {
  const grid = document.getElementById('armory-grid');
  grid.innerHTML = '';

  if (!inventory.vip) {
    // VIP purchase card
    const card = document.createElement('div');
    card.className = 'armory-card vip-purchase-card';
    card.innerHTML = `
      <div class="card-title">VIP Access</div>
      <div class="card-vip-desc">Unlock 24K Gold Armor, Golden Minigun, Titan Roar emote, VIP Giant Mode, and all future VIP content.</div>
      <div class="card-price">${VIP_PRICE} coins</div>
      <button class="card-action-btn vip-btn" ${!gs.infiniteCoins && gs.coins < VIP_PRICE ? 'disabled' : ''}>Become VIP</button>
    `;
    const btn = card.querySelector('button');
    btn.addEventListener('click', () => {
      if (!gs.infiniteCoins && gs.coins < VIP_PRICE) return;
      if (!gs.infiniteCoins) { gs.coins -= VIP_PRICE; saveCoins(); }
      else { gs.infiniteCoins = false; saveCoins(); }
      inventory.vip = true;
      if (!inventory.weapons.includes('minigun')) inventory.weapons.push('minigun');
      if (!inventory.armor.includes('karat24')) inventory.armor.push('karat24');
      if (!inventory.emotes.includes('titanroar')) inventory.emotes.push('titanroar');
      saveInventory();
      const vipBtn = document.getElementById('vip-toggle-button');
      if (vipBtn) vipBtn.classList.remove('hidden');
      renderTab();
    });
    grid.appendChild(card);
  } else {
    // VIP items
    const vipArmor = ARMOR_DEFS.karat24;
    const isKarat24Eq = equipped.armor === 'karat24';
    grid.appendChild(createArmoryCard({
      name: vipArmor.name,
      price: 0,
      owned: true,
      equipped: isKarat24Eq,
      onAction: () => {
        equipped.armor = 'karat24';
        saveEquipped();
        applyPlayerArmor('karat24');
        renderTab();
      },
      onUnequip: isKarat24Eq ? () => {
        equipped.armor = 'none';
        saveEquipped();
        applyPlayerArmor('none');
        renderTab();
      } : undefined,
    }));

    // Golden minigun
    if (WEAPON_DEFS.minigun) {
      const isMinigunEq = equipped.weapon === 'minigun';
      grid.appendChild(createArmoryCard({
        name: 'Golden Minigun',
        price: 0,
        owned: true,
        equipped: isMinigunEq,
        onAction: () => {
          equipped.weapon = 'minigun';
          saveEquipped();
          setPlayerWeapon('minigun', getEquippedGunMaterials);
          renderTab();
        },
        onUnequip: isMinigunEq ? () => {
          equipped.weapon = 'sniper';
          saveEquipped();
          setPlayerWeapon('sniper', getEquippedGunMaterials);
          renderTab();
        } : undefined,
      }));
    }

    // Titan Roar emote
    if (EMOTE_DEFS.titanroar) {
      const isTitanroarEq = equipped.emote === 'titanroar';
      grid.appendChild(createArmoryCard({
        name: EMOTE_DEFS.titanroar.name,
        price: 0,
        owned: true,
        equipped: isTitanroarEq,
        onAction: () => {
          equipped.emote = 'titanroar';
          saveEquipped();
          renderTab();
        },
        onUnequip: isTitanroarEq ? () => {
          equipped.emote = null;
          saveEquipped();
          renderTab();
        } : undefined,
      }));
    }

    // ── Secret VIP finds (unlocked from VIP chests) ───────────────────────────
    const secretFinds = [
      ...Object.entries(WEAPON_DEFS).filter(([k,d]) => d.secretVip && inventory.weapons.includes(k)).map(([k,d]) => ({ k, d, cat: 'weapon' })),
      ...Object.entries(ARMOR_DEFS).filter(([k,d]) => d.secretVip && inventory.armor.includes(k)).map(([k,d]) => ({ k, d, cat: 'armor' })),
      ...Object.entries(SKIN_DEFS).filter(([k,d]) => d.secretVip && inventory.skins.includes(k)).map(([k,d]) => ({ k, d, cat: 'skin' })),
      ...Object.entries(CLOTHES_DEFS).filter(([k,d]) => d.secretVip && inventory.clothes.includes(k)).map(([k,d]) => ({ k, d, cat: 'clothes' })),
      ...Object.entries(EMOTE_DEFS).filter(([k,d]) => d.secretVip && inventory.emotes.includes(k)).map(([k,d]) => ({ k, d, cat: 'emote' })),
    ];
    if (secretFinds.length) {
      const header = document.createElement('div');
      header.className = 'card-title';
      header.style.cssText = 'width:100%;text-align:center;color:#ffd700;font-size:1.1em;margin:14px 0 6px;';
      header.textContent = '⭐ Secret Finds';
      grid.appendChild(header);
      secretFinds.forEach(({ k, d, cat }) => {
        let isEq, onAction, onUnequip;
        if (cat === 'weapon') {
          isEq = equipped.weapon === k;
          onAction = () => { equipped.weapon = k; saveEquipped(); setPlayerWeapon(k, getEquippedGunMaterials); renderTab(); };
          onUnequip = isEq ? () => { equipped.weapon = 'sniper'; saveEquipped(); setPlayerWeapon('sniper', getEquippedGunMaterials); renderTab(); } : undefined;
        } else if (cat === 'armor') {
          isEq = equipped.armor === k;
          onAction = () => { equipped.armor = k; saveEquipped(); applyPlayerArmor(k); renderTab(); };
          onUnequip = isEq ? () => { equipped.armor = 'none'; saveEquipped(); applyPlayerArmor('none'); renderTab(); } : undefined;
        } else if (cat === 'skin') {
          isEq = equipped.skin === k;
          onAction = () => { equipped.skin = k; saveEquipped(); setPlayerWeapon(equipped.weapon || 'sniper', getEquippedGunMaterials); renderTab(); };
          onUnequip = isEq ? () => { equipped.skin = null; saveEquipped(); setPlayerWeapon(equipped.weapon || 'sniper', getEquippedGunMaterials); renderTab(); } : undefined;
        } else if (cat === 'clothes') {
          isEq = equipped.clothes === k;
          onAction = () => { equipped.clothes = k; saveEquipped(); applyPlayerClothes(k); renderTab(); };
          onUnequip = isEq ? () => { equipped.clothes = 'default'; saveEquipped(); applyPlayerClothes('default'); renderTab(); } : undefined;
        } else {
          isEq = equipped.emote === k;
          onAction = () => { equipped.emote = k; saveEquipped(); renderTab(); };
          onUnequip = isEq ? () => { equipped.emote = null; saveEquipped(); renderTab(); } : undefined;
        }
        grid.appendChild(createArmoryCard({ name: '⭐ ' + d.name, price: 0, owned: true, equipped: isEq, onAction, onUnequip }));
      });
    }
  }
};

// ── Render current tab ────────────────────────────────────────────────────────
function renderTab() {
  const renderer = ARMORY_TAB_RENDERERS[activeTab];
  if (renderer) renderer();
  // Update coin display
  const coinsEl = document.getElementById('armory-coins');
  if (coinsEl) coinsEl.textContent = `Coins: ${gs.coins}`;
}

// ── Open / close armory ───────────────────────────────────────────────────────
export function openArmory(focusTab) {
  if (focusTab) activeTab = focusTab;
  armoryOpen = true;
  const screen = document.getElementById('armory-screen');
  if (screen) screen.classList.remove('hidden');
  renderTab();
  startPreviewLoop();
  document.exitPointerLock?.();
  import('../audio.js').then(m => m.playArmoryOpen());
}

export function closeArmory() {
  armoryOpen = false;
  const screen = document.getElementById('armory-screen');
  if (screen) screen.classList.add('hidden');
  stopPreviewLoop();
  import('../audio.js').then(m => m.playArmoryClose());
  // If the game hasn't started, restore the start screen so the user can still launch
  if (!gs.started) {
    const ss = document.getElementById('start-screen');
    if (ss) { ss.classList.remove('hidden'); ss.style.display = ''; }
  }
}

// ── Preview render loop ───────────────────────────────────────────────────────
function startPreviewLoop() {
  stopPreviewLoop();
  function tick() {
    if (!armoryOpen) return;
    if (previewRig && previewRig.bodyGroup) {
      previewRig.bodyGroup.rotation.y += 0.012;
    }
    previewScene.render();
    previewRaf = requestAnimationFrame(tick);
  }
  previewRaf = requestAnimationFrame(tick);
}

function stopPreviewLoop() {
  if (previewRaf) { cancelAnimationFrame(previewRaf); previewRaf = null; }
}

// ── Init — wire tabs and close button ────────────────────────────────────────
export function initArmory() {
  // Tab buttons
  TABS.forEach(tab => {
    const btn = document.getElementById(`tab-${tab}`);
    if (!btn) return;
    btn.addEventListener('click', () => {
      activeTab = tab;
      document.querySelectorAll('.armory-tab-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      renderTab();
    });
  });

  // Close button
  const closeBtn = document.getElementById('armory-close');
  if (closeBtn) closeBtn.addEventListener('click', closeArmory);

  // ESC to close
  document.addEventListener('keydown', e => {
    if (e.code === 'Escape' && armoryOpen) closeArmory();
  });

  // Emote button → play equipped emote
  const emoteBtn = document.getElementById('emote-button');
  if (emoteBtn) {
    emoteBtn.addEventListener('click', () => {
      if (!gs.started || player.health <= 0) return;
      const key = equipped.emote;
      if (key && EMOTE_DEFS[key]) {
        player.activeEmote = key;
        player.emoteTimer = EMOTE_DEFS[key].duration || 2;
        player.emoteElapsed = 0;
      }
    });
  }

  // Armory button on start screen
  const startArmoryBtn = document.getElementById('armory-button');
  if (startArmoryBtn) {
    startArmoryBtn.addEventListener('click', () => {
      document.getElementById('start-screen')?.classList.add('hidden');
      openArmory();
    });
  }

  // VIP toggle button
  const vipBtn = document.getElementById('vip-toggle-button');
  if (vipBtn) {
    if (!inventory.vip) vipBtn.classList.add('hidden');
    vipBtn.addEventListener('click', () => {
      import('../player.js').then(m => m.setVipGiantMode(!gs.vipGiantMode, getEquippedGunMaterials));
    });
  }
}
