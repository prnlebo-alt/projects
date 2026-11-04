/**
 * Project Plant — content.js
 * Genetic Scorer + CSS Writer + Healer Loop
 *
 * Zero-knowledge guarantee:
 *   This file contains NO read access to .value, .innerText,
 *   .textContent, or .innerHTML on any element. Ever.
 *   The scorer identifies elements by structural metadata only.
 *
 * MV3 compliant. Runs in isolated world.
 */

'use strict';

// ─────────────────────────────────────────────────────────────
// CONFIG
// ─────────────────────────────────────────────────────────────

const PLANT_CONFIG = {
  SCORE_THRESHOLD: 70,          // below this → trigger Healer
  SELECTOR_ENDPOINT: 'https://YOUR-ENDPOINT.com/selectors.json',
  SELECTOR_TTL_MS: 1000 * 60 * 60 * 6,  // 6-hour cache
  STORAGE_KEY_SELECTORS: 'plant_selectors_cache',
  STORAGE_KEY_THEME: 'plant_theme_preference',
  STORAGE_KEY_TIMESTAMP: 'plant_selectors_ts',
  DEFAULT_SKIN: 'default',
};

// ─────────────────────────────────────────────────────────────
// WEIGHTS  (must sum to 100)
// ─────────────────────────────────────────────────────────────

const WEIGHTS = {
  ROLE:     40,
  STATE:    30,
  ARIA:     20,
  GEOMETRY: 10,
};

// ─────────────────────────────────────────────────────────────
// GENETIC SCORER
// Reads: role, tagName, contenteditable, aria-label,
//        getBoundingClientRect()
// Never reads: value, innerText, textContent, innerHTML
// ─────────────────────────────────────────────────────────────

function scoreRole(el) {
  const role = el.getAttribute('role')?.toLowerCase();
  const tag  = el.tagName?.toLowerCase();

  if (role === 'textbox' || role === 'main')              return WEIGHTS.ROLE;
  if (tag  === 'textarea')                                return WEIGHTS.ROLE;
  if (role === 'searchbox' || role === 'combobox')        return Math.round(WEIGHTS.ROLE * 0.6);
  if (role === 'input' || tag === 'input')                return Math.round(WEIGHTS.ROLE * 0.4);
  return 0;
}

function scoreState(el) {
  const tag = el.tagName?.toLowerCase();

  if (el.getAttribute('contenteditable') === 'true')      return WEIGHTS.STATE;
  if (tag === 'textarea')                                  return WEIGHTS.STATE;
  if (el.getAttribute('contenteditable') === '')          return Math.round(WEIGHTS.STATE * 0.8);
  return 0;
}

function scoreAria(el) {
  const label       = el.getAttribute('aria-label')?.toLowerCase()       ?? '';
  const placeholder = el.getAttribute('aria-placeholder')?.toLowerCase() ?? '';
  const combined    = label + ' ' + placeholder;

  const highSignal  = ['message', 'prompt', 'chat', 'ask', 'type here'];
  const midSignal   = ['input', 'search', 'query', 'write'];

  if (highSignal.some(k => combined.includes(k)))         return WEIGHTS.ARIA;
  if (midSignal.some(k => combined.includes(k)))          return Math.round(WEIGHTS.ARIA * 0.5);
  return 0;
}

function scoreGeometry(el) {
  let rect;
  try {
    rect = el.getBoundingClientRect();
  } catch {
    return 0;
  }

  const inBottomThird = rect.top > window.innerHeight * 0.7;
  const wideEnough    = rect.width > 300;

  if (wideEnough && inBottomThird)                        return WEIGHTS.GEOMETRY;
  if (wideEnough)                                         return Math.round(WEIGHTS.GEOMETRY * 0.5);
  return 0;
}

/**
 * Score a single element. Returns 0–100.
 * NO property access that touches user content.
 */
function scoreElement(el) {
  return (
    scoreRole(el)     +
    scoreState(el)    +
    scoreAria(el)     +
    scoreGeometry(el)
  );
}

/**
 * Walk candidate elements and return the best match.
 * Candidates: elements with role, contenteditable, or textarea tag.
 * Does NOT walk every node in the DOM.
 */
function findBestMatch() {
  const candidates = [
    ...document.querySelectorAll('[role]'),
    ...document.querySelectorAll('[contenteditable]'),
    ...document.querySelectorAll('textarea'),
  ];

  // Deduplicate (querySelectorAll sets can overlap)
  const unique = [...new Set(candidates)];

  let best      = null;
  let bestScore = 0;

  for (const el of unique) {
    const score = scoreElement(el);
    if (score > bestScore) {
      bestScore = score;
      best      = el;
    }
  }

  return { element: best, score: bestScore };
}

// ─────────────────────────────────────────────────────────────
// CSS WRITER
// Writes to :root CSS variables only.
// Never modifies element.style directly on input elements.
// ─────────────────────────────────────────────────────────────

let _adoptedSheet = null;

function getAdoptedSheet() {
  if (!_adoptedSheet) {
    _adoptedSheet = new CSSStyleSheet();
    document.adoptedStyleSheets = [...document.adoptedStyleSheets, _adoptedSheet];
  }
  return _adoptedSheet;
}

/**
 * Apply a skin token map to :root.
 * tokenMap shape: { '--plant-bg': '#0a0a0a', '--plant-text': '#fafafa', ... }
 */
function applySkin(tokenMap) {
  if (!tokenMap || typeof tokenMap !== 'object') return;

  const declarations = Object.entries(tokenMap)
    .filter(([k]) => k.startsWith('--plant-'))   // only our namespace
    .map(([k, v]) => `  ${k}: ${v};`)
    .join('\n');

  const css = `:root {\n${declarations}\n}`;

  try {
    getAdoptedSheet().replaceSync(css);
  } catch (err) {
    console.warn('[Plant] CSS writer failed:', err);
  }
}

function clearSkin() {
  try {
    getAdoptedSheet().replaceSync('');
  } catch { /* silent */ }
}

// ─────────────────────────────────────────────────────────────
// HEALER LOOP
// Fires when best-match score < SCORE_THRESHOLD.
// GET only — no body, no user data transmitted.
// ─────────────────────────────────────────────────────────────

let _healerInFlight = false;

async function triggerHealer() {
  if (_healerInFlight) return;
  _healerInFlight = true;

  try {
    // Check cache first
    const cached = await loadCachedSelectors();
    if (cached) {
      applySelectorsAndSkin(cached);
      return;
    }

    // Fetch fresh selectors — no body, no credentials, no user data
    const response = await fetch(PLANT_CONFIG.SELECTOR_ENDPOINT, {
      method: 'GET',
      credentials: 'omit',
      headers: { 'Accept': 'application/json' },
    });

    if (!response.ok) {
      console.warn('[Plant] Healer fetch failed:', response.status);
      return;
    }

    const payload = await response.json();

    // Validate structure before trusting it
    if (!isValidPayload(payload)) {
      console.warn('[Plant] Healer payload failed validation. Discarding.');
      return;
    }

    await cacheSelectors(payload);
    applySelectorsAndSkin(payload);

  } catch (err) {
    console.warn('[Plant] Healer error:', err);
  } finally {
    _healerInFlight = false;
  }
}

/**
 * Validate the remote payload.
 * Must be data (strings, numbers, arrays) — no functions, no executable code.
 */
function isValidPayload(payload) {
  if (typeof payload !== 'object' || payload === null)    return false;
  if (typeof payload.version !== 'string')                return false;
  if (!Array.isArray(payload.selectors))                  return false;

  // Each selector must be a plain object with string values only
  for (const sel of payload.selectors) {
    if (typeof sel !== 'object')                          return false;
    for (const v of Object.values(sel)) {
      if (typeof v === 'function')                        return false;  // hard reject
    }
  }

  return true;
}

function applySelectorsAndSkin(payload) {
  // Re-score with updated selectors if provided
  // Then apply the theme token map
  if (payload.tokens) {
    applySkin(payload.tokens);
  }
}

// ─────────────────────────────────────────────────────────────
// STORAGE — chrome.storage.local only
// Keys: plant_selectors_cache, plant_theme_preference, plant_selectors_ts
// Never stores user content.
// ─────────────────────────────────────────────────────────────

async function loadCachedSelectors() {
  try {
    const result = await chrome.storage.local.get([
      PLANT_CONFIG.STORAGE_KEY_SELECTORS,
      PLANT_CONFIG.STORAGE_KEY_TIMESTAMP,
    ]);

    const ts      = result[PLANT_CONFIG.STORAGE_KEY_TIMESTAMP];
    const payload = result[PLANT_CONFIG.STORAGE_KEY_SELECTORS];

    if (!payload || !ts) return null;

    const age = Date.now() - ts;
    if (age > PLANT_CONFIG.SELECTOR_TTL_MS) return null;  // stale

    return payload;
  } catch {
    return null;
  }
}

async function cacheSelectors(payload) {
  try {
    await chrome.storage.local.set({
      [PLANT_CONFIG.STORAGE_KEY_SELECTORS]: payload,
      [PLANT_CONFIG.STORAGE_KEY_TIMESTAMP]: Date.now(),
    });
  } catch (err) {
    console.warn('[Plant] Cache write failed:', err);
  }
}

async function loadThemePreference() {
  try {
    const result = await chrome.storage.local.get(PLANT_CONFIG.STORAGE_KEY_THEME);
    return result[PLANT_CONFIG.STORAGE_KEY_THEME] ?? PLANT_CONFIG.DEFAULT_SKIN;
  } catch {
    return PLANT_CONFIG.DEFAULT_SKIN;
  }
}

// ─────────────────────────────────────────────────────────────
// SPA NAVIGATION INTERCEPTION
// Patches history.pushState and replaceState.
// Runs in isolated world — patches the isolated copy.
// For main-world patching, inject via manifest world: "MAIN".
// ─────────────────────────────────────────────────────────────

function interceptSPANavigation() {
  ['pushState', 'replaceState'].forEach(method => {
    const original = history[method];
    history[method] = function (...args) {
      const result = original.apply(this, args);
      window.dispatchEvent(new Event('plant:navigation'));
      return result;
    };
  });

  window.addEventListener('popstate', () => {
    window.dispatchEvent(new Event('plant:navigation'));
  });

  window.addEventListener('plant:navigation', () => {
    // Double rAF: wait for SPA router to commit DOM before re-scanning
    requestAnimationFrame(() => requestAnimationFrame(() => {
      runScorer();
    }));
  });
}

// ─────────────────────────────────────────────────────────────
// MUTATION OBSERVER
// Scoped — watches for newly added nodes that may be
// input containers (e.g. chat UI lazy-renders its composer).
// NOT a global subtree observer.
// ─────────────────────────────────────────────────────────────

let _observer = null;

function startObserver() {
  if (_observer) return;

  _observer = new MutationObserver(mutations => {
    for (const m of mutations) {
      if (m.type !== 'childList') continue;
      for (const node of m.addedNodes) {
        if (node.nodeType !== Node.ELEMENT_NODE) continue;
        // A significant subtree was added — re-run scorer
        if (node.querySelectorAll('[role],[contenteditable],textarea').length > 0) {
          runScorer();
          return;
        }
      }
    }
  });

  _observer.observe(document.body, {
    childList: true,
    subtree: true,       // node additions only — attributeFilter not set
    attributes: false,   // we do NOT watch attribute mutations globally
    characterData: false,
  });
}

function stopObserver() {
  _observer?.disconnect();
  _observer = null;
}

// ─────────────────────────────────────────────────────────────
// MAIN SCORER RUNNER
// ─────────────────────────────────────────────────────────────

async function runScorer() {
  const { element, score } = findBestMatch();

  if (!element) {
    // Nothing scoreable on this page — clear skin, stay quiet
    clearSkin();
    return;
  }

  if (score >= PLANT_CONFIG.SCORE_THRESHOLD) {
    // Confident match — apply skin to the container
    const skinId = await loadThemePreference();
    const tokens = await resolveTokensForSkin(skinId);
    applySkin(tokens);
  } else {
    // Low confidence — trigger Healer to fetch fresh selectors
    triggerHealer();
  }
}

/**
 * Resolve token map for a given skin ID.
 * In production this will pull from storage or a bundled token registry.
 * Stub returns a minimal default for development.
 */
async function resolveTokensForSkin(skinId) {
  // TODO: replace with full token registry lookup
  const stubs = {
    'default': {
      '--plant-bg':           '#ffffff',
      '--plant-surface':      '#f9f9f9',
      '--plant-text-primary': '#111111',
      '--plant-accent':       '#000000',
    },
    '90s-shop': {
      '--plant-bg':           '#1a1a2e',
      '--plant-surface':      '#16213e',
      '--plant-text-primary': '#e0e0e0',
      '--plant-accent':       '#e94560',
    },
  };
  return stubs[skinId] ?? stubs['default'];
}

// ─────────────────────────────────────────────────────────────
// CONTEXT INVALIDATION GUARD
// Handles the case where the extension reloads mid-session.
// ─────────────────────────────────────────────────────────────

function safeMessage(msg) {
  try {
    return chrome.runtime.sendMessage(msg);
  } catch (e) {
    if (e.message?.includes('context invalidated')) {
      stopObserver();
      clearSkin();
      return null;
    }
    throw e;
  }
}

// ─────────────────────────────────────────────────────────────
// INIT
// ─────────────────────────────────────────────────────────────

(function init() {
  // Stage 1: run scorer immediately on current DOM
  runScorer();

  // Stage 2: watch for dynamic content (lazy-rendered composers, etc.)
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      startObserver();
      interceptSPANavigation();
    });
  } else {
    startObserver();
    interceptSPANavigation();
  }
})();
