// Skyn slide-in skin picker panel — content-script module.
//
// IMPORTANT: this module follows the content-script privacy constraints
// documented in the header of src/content/index.ts:
//   - No keyboard event listeners. The Cmd+Shift+S shortcut is registered
//     via chrome.commands at the manifest level; Chrome catches the
//     keystroke and dispatches to the service worker, which forwards a
//     'togglePanel' message via chrome.tabs.sendMessage. This module
//     receives the toggle from the existing onMessage handler in index.ts.
//   - No reading of page text/HTML/values. The skin picker shows extension
//     state only (SKINS, FREE_SKINS, the active skin id).
//   - No host-page cookies, localStorage, sessionStorage. We persist panel
//     open/closed state in chrome.storage.local only.
//   - The panel mounts in a Shadow DOM root attached to a host node we
//     insert into document.documentElement, so Claude's CSS can't reach in
//     and our CSS can't leak out.
//
// MOUNT LIFECYCLE: the host node is mounted ONCE on initial content-script
// load (via ensureMounted) and stays in the DOM for the lifetime of the
// page. The drawer state (open/closed) is just a data-state attribute
// flip; we never unmount. This keeps the discovery tab (the small handle
// sticking out from the right edge) permanently visible so users can find
// the panel without needing to know the keyboard shortcut.

import { applyStoredTheme } from './injector';
import { FREE_SKINS, getSkinById, SKINS } from '../shared/skins';
import { getLocalStorage, getSyncStorage, setLocalStorage, setSyncStorage } from '../shared/storage';
import type { Skin } from '../shared/types';

const HOST_ID = 'skyn-panel-host';
const DRAWER_WIDTH_PX = 320;
const SLIDE_DURATION_MS = 280;
const TAB_BG = '#c4704a';        // hardcoded terracotta per design spec
const TAB_TEXT = '#fff5e0';      // warm cream "S" on terracotta

// Module-scope cache of host + shadow root + child refs + state.
let host: HTMLElement | null = null;
let shadow: ShadowRoot | null = null;
let drawerEl: HTMLElement | null = null;
let backdropEl: HTMLElement | null = null;
let tabEl: HTMLElement | null = null;
let isOpen = false;
let lastAppliedSkinId: string | null = null;

// Entry point — toggles persisted panelOpen state. Called from
// content/index.ts when a 'togglePanel' message arrives (from the
// service-worker command handler), and also from the tab click handler.
export async function togglePanel(): Promise<void> {
  const local = await getLocalStorage();
  const next = !local.panelOpen;
  await setLocalStorage({ panelOpen: next });
  // applyPanelState will also fire via the storage.onChanged listener in
  // index.ts; calling it directly here keeps the originating tab snappy
  // without waiting for the storage event round-trip.
  await applyPanelState(next);
}

// Called when storage.onChanged reports panelOpen changed (cross-tab sync)
// or directly from togglePanel. Sets data-state on tab + drawer + backdrop;
// CSS transitions handle the slide animation.
export async function applyPanelState(open: boolean): Promise<void> {
  if (!host || !document.documentElement.contains(host)) {
    await ensureMounted();
  }
  if (open === isOpen) return;
  isOpen = open;
  const state = open ? 'open' : 'closed';
  drawerEl?.setAttribute('data-state', state);
  backdropEl?.setAttribute('data-state', state);
  tabEl?.setAttribute('data-state', state);
}

// Mount the panel host into document.documentElement and paint initial
// contents from storage. Idempotent: subsequent calls just re-paint
// contents without rebuilding the DOM. Called from content/index.ts once
// per page load so the discovery tab appears immediately.
export async function ensureMounted(): Promise<void> {
  if (host && document.documentElement.contains(host)) {
    await refreshContents();
    return;
  }
  mount();
  await refreshContents();

  // Honor persisted open state from a previous session / SPA navigation.
  // Deferred to the next animation frame so the closed→open transition
  // animates rather than snapping (the shell renders with data-state="closed"
  // by default, then we flip to open in the next frame).
  const local = await getLocalStorage();
  if (local.panelOpen) {
    requestAnimationFrame(() => {
      void applyPanelState(true);
    });
  }
}

function mount(): void {
  host = document.createElement('div');
  host.id = HOST_ID;
  // Inline styles on the host so Claude can't override its positioning
  // via class-based rules. The host is just a positioning anchor; all
  // visible UI lives inside the shadow root.
  host.style.position = 'fixed';
  host.style.top = '0';
  host.style.right = '0';
  host.style.bottom = '0';
  host.style.left = '0';
  host.style.zIndex = '999999';
  host.style.pointerEvents = 'none'; // host is transparent; tab/drawer/backdrop opt in
  document.documentElement.appendChild(host);

  shadow = host.attachShadow({ mode: 'open' });
  shadow.innerHTML = renderShell(); // security-allow: writes to our own shadow root, not page DOM. Content is from renderShell() — a static template literal with no user-supplied data.
  drawerEl = shadow.querySelector('[data-role="drawer"]');
  backdropEl = shadow.querySelector('[data-role="backdrop"]');
  tabEl = shadow.querySelector('[data-role="tab"]');
  wireEvents();
}

// Re-paints panel contents from current storage. Used on initial mount
// and whenever the active skin or unlocked-skin set changes.
async function refreshContents(): Promise<void> {
  if (!shadow) return;
  const [sync] = await Promise.all([getSyncStorage()]);
  const activeSkin = getSkinById(sync.activeSkinId);
  const availableSkinIds = new Set([...FREE_SKINS, ...sync.unlockedSkins]);
  const visibleSkins = SKINS.filter((s) => availableSkinIds.has(s.id));

  applyThemeVariables(activeSkin);

  // Reflect current coatEnabled in the header toggle. The toggle's data-state
  // attribute drives both the visual style and the text label via CSS.
  const toggleEl = shadow.querySelector<HTMLElement>('[data-role="toggle"]');
  if (toggleEl) {
    toggleEl.setAttribute('data-state', sync.coatEnabled ? 'on' : 'off');
    toggleEl.setAttribute('aria-pressed', sync.coatEnabled ? 'true' : 'false');
    toggleEl.textContent = sync.coatEnabled ? 'ON' : 'OFF';
  }

  const activeNameEl = shadow.querySelector<HTMLDivElement>('[data-role="active-name"]');
  if (activeNameEl) activeNameEl.textContent = activeSkin.name;

  const activeEmojiEl = shadow.querySelector<HTMLDivElement>('[data-role="active-emoji"]');
  if (activeEmojiEl) activeEmojiEl.textContent = activeSkin.emoji || '';

  const gridEl = shadow.querySelector<HTMLDivElement>('[data-role="grid"]');
  if (gridEl) gridEl.innerHTML = visibleSkins.map((s) => renderTile(s, s.id === sync.activeSkinId)).join(''); // security-allow: writes inside our shadow root. renderTile HTML-escapes skin.name / skin.emoji / skin.vibe via escapeHtml/escapeAttr; the only un-escaped substitution is renderTile itself, which interpolates only extension-bundle data (no page input).
}

// Drives drawer surface colors from the active skin. Note that the TAB's
// background is hardcoded terracotta in CSS (per design spec) and does
// NOT follow the active skin — it's a brand-consistent affordance.
function applyThemeVariables(skin: Skin): void {
  if (!shadow || lastAppliedSkinId === skin.id) return;
  const root = shadow.host as HTMLElement;
  root.style.setProperty('--panel-bg', skin.bg);
  root.style.setProperty('--panel-text', skin.text);
  root.style.setProperty('--panel-text-muted', skin.textMuted);
  root.style.setProperty('--panel-accent', skin.accent);
  root.style.setProperty('--panel-accent2', skin.accent2);
  root.style.setProperty('--panel-border', skin.border);
  root.style.setProperty('--panel-tile-bg', skin.bubbleAi);
  root.style.setProperty('--panel-tile-active-bg', skin.bubbleUser);
  root.style.setProperty('--panel-font', skin.font);
  lastAppliedSkinId = skin.id;
}

function wireEvents(): void {
  if (!shadow) return;

  // Tab click → toggle. The tab is the always-visible discovery affordance;
  // clicking it opens/closes the drawer.
  tabEl?.addEventListener('click', () => {
    void togglePanel();
  });

  // Backdrop click → close.
  backdropEl?.addEventListener('click', () => {
    void togglePanel();
  });

  // Close button (X) in drawer header → close.
  shadow.querySelector('[data-role="close"]')?.addEventListener('click', () => {
    void togglePanel();
  });

  // Header on/off toggle → flips coatEnabled in sync storage and reapplies.
  // When off, injector tears the theme down and the page returns to default
  // Claude; when back on, the active skin re-applies immediately.
  shadow.querySelector('[data-role="toggle"]')?.addEventListener('click', () => {
    void toggleCoatEnabled();
  });

  // Skin tile click → switch active skin. Drawer stays open so the user
  // can preview multiple skins without re-opening.
  shadow.querySelector('[data-role="grid"]')?.addEventListener('click', (e) => {
    const target = e.target as HTMLElement | null;
    const tile = target?.closest<HTMLElement>('[data-skin-id]');
    if (!tile) return;
    const skinId = tile.dataset.skinId;
    if (!skinId) return;
    void selectSkin(skinId);
  });
}

async function toggleCoatEnabled(): Promise<void> {
  const sync = await getSyncStorage();
  const next = !sync.coatEnabled;
  await setSyncStorage({ coatEnabled: next });

  // Apply directly — same belt-and-suspenders as selectSkin. applyStoredTheme
  // respects coatEnabled: when false, it removes the injected theme entirely
  // (see injector.ts:49). When true, the active skin re-injects.
  try {
    const [freshSync, local] = await Promise.all([getSyncStorage(), getLocalStorage()]);
    applyStoredTheme(freshSync, local);
  } catch (err) {
    console.warn('[skyn] panel coatEnabled apply failed:', err);
  }
  chrome.runtime.sendMessage({ action: 'refreshActiveTabTheme' }, () => {
    const lastError = chrome.runtime.lastError;
    if (lastError && !/channel closed/i.test(lastError.message ?? '')) {
      console.warn('[skyn] panel refreshActiveTabTheme:', lastError.message);
    }
  });
  await refreshContents();
}

async function selectSkin(skinId: string): Promise<void> {
  await setSyncStorage({ activeSkinId: skinId as Skin['id'] });

  // Apply the theme directly rather than waiting for the chrome.storage.onChanged
  // listener in content/index.ts to fire. Same-context onChanged dispatch has
  // observed flakiness — the popup sidesteps it by routing through the SW
  // (popup/App.tsx:updateSync). We're already IN the content script, so we
  // can call the injector directly and guarantee the page repaints.
  try {
    const [sync, local] = await Promise.all([getSyncStorage(), getLocalStorage()]);
    applyStoredTheme(sync, local);
  } catch (err) {
    console.warn('[skyn] panel direct applyStoredTheme failed:', err);
  }

  // Belt-and-suspenders: also dispatch refreshActiveTabTheme via the SW,
  // matching the popup pattern exactly. The SW sends a refreshTheme message
  // back to this tab's content script, which calls refreshTheme via the
  // existing onMessage handler in index.ts. If the direct call above somehow
  // didn't take, this round-trip path provides a second chance.
  chrome.runtime.sendMessage({ action: 'refreshActiveTabTheme' }, () => {
    const lastError = chrome.runtime.lastError;
    if (lastError && !/channel closed/i.test(lastError.message ?? '')) {
      console.warn('[skyn] panel refreshActiveTabTheme:', lastError.message);
    }
  });

  await refreshContents();
}

function renderShell(): string {
  // All styles scoped inside the shadow root — they cannot leak to or be
  // overridden by Claude's page CSS. The TAB and DRAWER are positioned
  // siblings: when the drawer slides in via translateX, the tab slides
  // in lockstep via its own translateX so it stays attached to the
  // drawer's left edge as a "drawer pull" handle.
  return `
<style>
  :host {
    /* Defaults overwritten per-skin via applyThemeVariables. */
    --panel-bg: #1a1a1f;
    --panel-text: #f5f5f0;
    --panel-text-muted: #aaa;
    --panel-accent: #c4704a;
    --panel-accent2: #8b5e3c;
    --panel-border: rgba(255, 255, 255, 0.12);
    --panel-tile-bg: rgba(255, 255, 255, 0.05);
    --panel-tile-active-bg: rgba(196, 112, 74, 0.22);
    --panel-font: system-ui, -apple-system, sans-serif;
    all: initial;
  }
  * { box-sizing: border-box; font-family: var(--panel-font); }

  /* ─── DISCOVERY TAB ──────────────────────────────────────────────
     Always-visible handle on the right viewport edge. Slides with the
     drawer when open so it stays attached to the drawer's left edge. */
  [data-role="tab"] {
    position: fixed;
    top: 50%;
    right: 0;
    width: 28px;
    height: 72px;
    border: none;
    padding: 0;
    margin: 0;
    background: ${TAB_BG};
    color: ${TAB_TEXT};
    cursor: pointer;
    pointer-events: auto;
    border-radius: 12px 0 0 12px;
    box-shadow: -2px 0 8px rgba(0, 0, 0, 0.20);
    display: flex;
    align-items: center;
    justify-content: center;
    /* Vertical centering via translateY(-50%); horizontal slide via
       translateX. Both combined on the transform property so the
       transition is GPU-accelerated. */
    transform: translateY(-50%);
    transition: transform ${SLIDE_DURATION_MS}ms cubic-bezier(0.32, 0.72, 0, 1);
    z-index: 1;
  }
  [data-role="tab"][data-state="open"] {
    transform: translateY(-50%) translateX(-${DRAWER_WIDTH_PX}px);
  }
  [data-role="tab"]:hover {
    background: #d8855a;
  }
  [data-role="tab"]:active {
    background: #a85c3a;
  }
  .tab-icon {
    display: inline-block;
    transform: rotate(-90deg);
    font-family: 'Lora', 'Georgia', serif;
    font-weight: 700;
    font-size: 20px;
    line-height: 1;
    letter-spacing: 0.02em;
    text-shadow: 0 1px 1px rgba(0, 0, 0, 0.35);
  }

  /* ─── BACKDROP ───────────────────────────────────────────────────
     Full-viewport dim layer behind the drawer. Click to close. */
  [data-role="backdrop"] {
    position: fixed;
    inset: 0;
    background: rgba(10, 6, 2, 0);
    pointer-events: none;
    transition: background ${SLIDE_DURATION_MS}ms ease-out;
    cursor: pointer;
    z-index: 2;
  }
  [data-role="backdrop"][data-state="open"] {
    background: rgba(10, 6, 2, 0.36);
    pointer-events: auto;
  }

  /* ─── DRAWER ─────────────────────────────────────────────────────
     The skin picker panel itself. Slides in from the right via translateX. */
  [data-role="drawer"] {
    position: fixed;
    top: 0;
    right: 0;
    bottom: 0;
    width: ${DRAWER_WIDTH_PX}px;
    background: var(--panel-bg);
    color: var(--panel-text);
    pointer-events: auto;
    transform: translateX(100%);
    transition: transform ${SLIDE_DURATION_MS}ms cubic-bezier(0.32, 0.72, 0, 1);
    display: flex;
    flex-direction: column;
    box-shadow:
      -1px 0 0 var(--panel-border),
      -4px 0 0 rgba(90, 55, 20, 0.18),
      -10px 0 24px rgba(0, 0, 0, 0.35),
      -20px 0 60px rgba(0, 0, 0, 0.20);
    overflow: hidden;
    z-index: 3;
  }
  [data-role="drawer"][data-state="open"] { transform: translateX(0); }

  header {
    padding: 18px 18px 14px;
    border-bottom: 1px solid var(--panel-border);
    display: flex;
    align-items: center;
    gap: 10px;
  }
  .logo {
    font-family: 'Lora', 'Georgia', serif;
    font-weight: 700;
    font-size: 22px;
    letter-spacing: 0.4px;
    color: var(--panel-accent);
    text-shadow: 0 1px 1px rgba(0, 0, 0, 0.35);
  }
  .header-spacer { flex: 1; }
  .toggle {
    height: 26px;
    min-width: 56px;
    padding: 0 12px;
    border-radius: 13px;
    border: 1px solid var(--panel-border);
    background: ${TAB_BG};
    color: ${TAB_TEXT};
    font-family: inherit;
    font-size: 11px;
    font-weight: 600;
    letter-spacing: 0.10em;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: background 200ms ease, color 200ms ease, border-color 200ms ease;
  }
  .toggle[data-state="off"] {
    background: rgba(255, 255, 255, 0.06);
    color: var(--panel-text-muted);
    border-color: var(--panel-border);
  }
  .toggle:hover { filter: brightness(1.08); }
  .toggle:active { filter: brightness(0.94); }
  .close {
    width: 28px;
    height: 28px;
    border-radius: 14px;
    border: 1px solid var(--panel-border);
    background: transparent;
    color: var(--panel-text);
    font-size: 16px;
    line-height: 1;
    cursor: pointer;
    padding: 0;
    display: flex;
    align-items: center;
    justify-content: center;
  }
  .close:hover { background: var(--panel-tile-bg); }

  .active-row {
    padding: 14px 18px;
    display: flex;
    align-items: center;
    gap: 12px;
    border-bottom: 1px solid var(--panel-border);
  }
  .active-emoji {
    font-size: 26px;
    width: 36px;
    height: 36px;
    border-radius: 18px;
    background: var(--panel-tile-active-bg);
    border: 1px solid var(--panel-border);
    display: flex;
    align-items: center;
    justify-content: center;
  }
  .active-label { display: flex; flex-direction: column; line-height: 1.2; }
  .active-eyebrow {
    font-size: 10px;
    text-transform: uppercase;
    letter-spacing: 0.14em;
    color: var(--panel-text-muted);
    margin-bottom: 2px;
  }
  .active-name { font-size: 14px; font-weight: 600; }

  .grid-scroll {
    flex: 1;
    overflow-y: auto;
    overflow-x: hidden;
    padding: 14px 18px 18px;
  }
  .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
  .tile {
    appearance: none;
    border: 1px solid var(--panel-border);
    background: var(--panel-tile-bg);
    color: var(--panel-text);
    border-radius: 14px;
    padding: 10px 10px 12px;
    cursor: pointer;
    text-align: left;
    display: flex;
    flex-direction: column;
    gap: 6px;
    font-family: inherit;
    transition: transform 120ms ease-out, border-color 120ms ease-out;
  }
  .tile:hover { transform: translateY(-1px); border-color: var(--panel-accent); }
  .tile[data-active="true"] {
    background: var(--panel-tile-active-bg);
    border-color: var(--panel-accent);
    box-shadow: inset 0 0 0 1px var(--panel-accent);
  }
  .tile .tile-emoji { font-size: 22px; line-height: 1; }
  .tile .tile-name { font-size: 12px; font-weight: 600; }
  .tile .tile-vibe { font-size: 10px; color: var(--panel-text-muted); line-height: 1.3; }

  .grid-scroll::-webkit-scrollbar { width: 6px; }
  .grid-scroll::-webkit-scrollbar-track { background: transparent; }
  .grid-scroll::-webkit-scrollbar-thumb {
    background: var(--panel-border);
    border-radius: 3px;
  }
</style>

<button data-role="tab" data-state="closed" aria-label="Open Skyn skin picker">
  <span class="tab-icon">S</span>
</button>
<div data-role="backdrop" data-state="closed"></div>
<aside data-role="drawer" data-state="closed" aria-label="Skyn skin picker">
  <header>
    <div class="logo">Skyn</div>
    <button class="toggle" data-role="toggle" data-state="on" aria-pressed="true" aria-label="Toggle Skyn on or off">ON</button>
    <div class="header-spacer"></div>
    <button class="close" data-role="close" aria-label="Close skin picker">✕</button>
  </header>
  <div class="active-row">
    <div class="active-emoji" data-role="active-emoji"></div>
    <div class="active-label">
      <div class="active-eyebrow">Current skin</div>
      <div class="active-name" data-role="active-name"></div>
    </div>
  </div>
  <div class="grid-scroll">
    <div class="grid" data-role="grid"></div>
  </div>
</aside>
`.trim();
}

function renderTile(skin: Skin, isActive: boolean): string {
  const name = escapeHtml(skin.name);
  const emoji = escapeHtml(skin.emoji ?? '');
  const vibe = escapeHtml(skin.vibe ?? '');
  return `
<button class="tile" data-skin-id="${escapeAttr(skin.id)}" data-active="${isActive ? 'true' : 'false'}">
  <span class="tile-emoji">${emoji}</span>
  <span class="tile-name">${name}</span>
  <span class="tile-vibe">${vibe}</span>
</button>
`.trim();
}

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function escapeAttr(value: string): string {
  return value.replaceAll('"', '&quot;').replaceAll("'", '&#39;');
}

// Survival heartbeat — re-mounts if the host disappears from documentElement
// for ANY reason (the tab is always-on, so the heartbeat watches host
// existence regardless of open state). Capped retries.
let survivalRetries = 0;
const SURVIVAL_MAX_RETRIES = 40;
const SURVIVAL_INTERVAL_MS = 800;

window.setInterval(() => {
  if (survivalRetries >= SURVIVAL_MAX_RETRIES) return;
  if (host && document.documentElement.contains(host)) return;
  survivalRetries += 1;
  // Clear cached references and re-mount. ensureMounted will re-read
  // storage and restore the previous open state.
  host = null;
  shadow = null;
  drawerEl = null;
  backdropEl = null;
  tabEl = null;
  lastAppliedSkinId = null;
  isOpen = false;
  void ensureMounted();
  if (survivalRetries === SURVIVAL_MAX_RETRIES) {
    console.warn('[skyn] panel survival heartbeat hit retry cap — host is removing the panel host faster than we can re-inject');
  }
}, SURVIVAL_INTERVAL_MS);

// Re-render contents on theme changes triggered elsewhere (popup, other tab).
export async function notifyActiveSkinChanged(): Promise<void> {
  await refreshContents();
}
