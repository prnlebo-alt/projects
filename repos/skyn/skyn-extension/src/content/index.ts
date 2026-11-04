// SECURITY CONSTRAINT — enforced for all content scripts.
// Skyn injects presentational elements ONLY: <style> and <link> for theme
// CSS/fonts, plus media elements for animated backgrounds (<video> sourced
// exclusively from chrome-extension:// bundled assets — see
// injectVideoBackground in injector.ts). Content scripts must not read,
// access, or transmit page content; access input values, textareas, or
// contenteditable content; listen for keyboard events; or access cookies/
// localStorage/sessionStorage on target domains. Any new injected element
// must (a) carry no event listeners on host-page content, (b) source media
// only from extension-bundled assets, and (c) be removable via the
// existing tear-down path. Future code that violates this must be rejected.
//
// SKYN_DIAG (below) is a debug utility for skin development. It reads CSS
// custom properties from the platform's own design tokens (Claude's styling
// metadata, not user content). Gated behind a constant — flip to false to
// disable. Kept in the codebase for future skin work.
import { applyStoredTheme, detectPlatform, injectDefaultTheme, PLATFORM_SELECTORS, revealStoredTheme } from './injector';
import { startSpaObserver } from './observer';
import { captureScreen } from './screenshot';
import { applyPanelState, ensureMounted as ensurePanelMounted, notifyActiveSkinChanged, togglePanel } from './panel';
import { getSkinById } from '../shared/skins';
import { getLocalStorage, getSyncStorage } from '../shared/storage';
import type { ContentMessage, ContentMessageResponse } from '../shared/types';

// Default OFF for shipped builds — flip to true when actively running
// skin-development diagnostics. When true, every Claude.ai page load runs
// runSkynDiagnostic(), which console.clear()s and auto-downloads a report
// to ~/Downloads/skyn-diag-*.txt. Both behaviors are intentional for
// development and intentionally disruptive for normal use.
const SKYN_DIAG = false;

if (SKYN_DIAG && /(^|\.)claude\.ai$/.test(location.hostname)) {
  scheduleSkynDiagnostic();
}

injectDefaultTheme();
setTimeout(revealStoredTheme, 800);

async function refreshTheme(): Promise<void> {
  try {
    const [sync, local] = await Promise.all([
      getSyncStorage(),
      getLocalStorage(),
    ]);
    applyStoredTheme(sync, local);
  } catch {
    revealStoredTheme();
  }
}

void refreshTheme();

// Tag-survival heartbeat. The Mecha v1.0 manual test found Skyn's
// <style id="skyn-theme"> physically absent from the DOM on Claude chat
// threads in some configurations — most likely Claude's React shell
// reconciling <head> children during hydration and stripping tags it
// doesn't own. This heartbeat detects that and re-applies the stored
// theme. Cheap (one getElementById per tick), capped retries so an
// adversarial removal can't loop us forever. Cap is per-page-load.
let survivalRetries = 0;
const SURVIVAL_MAX_RETRIES = 40;
const SURVIVAL_INTERVAL_MS = 800;

window.setInterval(() => {
  if (document.getElementById('skyn-theme')) return;
  // Cycle-and-continue: once we hit the retry cap, reset the counter and
  // keep trying indefinitely. Routes like claude.ai/new strip the theme
  // tag aggressively during the React hydration window, so giving up after
  // ~32s leaves those pages permanently unskinned. The cap still rate-
  // limits log noise (one warn per cycle) and gives applyStoredTheme its
  // re-entrance guard headroom; we just don't quit anymore.
  if (survivalRetries >= SURVIVAL_MAX_RETRIES) {
    console.warn('[skyn] tag-survival cap reached on hostile page — resetting and continuing');
    survivalRetries = 0;
  }
  survivalRetries += 1;
  void refreshTheme();
}, SURVIVAL_INTERVAL_MS);

startSpaObserver(() => {
  void refreshTheme();
});

chrome.storage.onChanged.addListener((changes, areaName) => {
  if (areaName !== 'sync' && areaName !== 'local') return;
  if (hasThemeRelevantChange(changes)) {
    void refreshTheme();
    // Repaint panel UI on any theme-relevant change so the toggle and the
    // active-skin highlight stay in sync across tabs (a coatEnabled flip in
    // tab A should update tab B's toggle; same for activeSkinId).
    if (changes.activeSkinId || changes.coatEnabled) void notifyActiveSkinChanged();
  }
  // Cross-tab panel open/closed state.
  if (areaName === 'local' && changes.panelOpen) {
    void applyPanelState(Boolean(changes.panelOpen.newValue));
  }
});

// Mount the skin picker panel host on every claude.ai page load so the
// discovery tab (small handle on the right edge) is always visible.
// ensurePanelMounted internally reads chrome.storage.local.panelOpen and
// restores the open state if the panel was open before navigation.
void ensurePanelMounted();

chrome.runtime.onMessage.addListener((message: ContentMessage, _sender, sendResponse: (response: ContentMessageResponse) => void) => {
  void handleMessage(message).then(sendResponse);
  return true;
});

async function handleMessage(message: ContentMessage): Promise<ContentMessageResponse> {
  if (message.action === 'refreshTheme') {
    await refreshTheme();
    return { ok: true };
  }

  if (message.action === 'getPlatform') {
    return { ok: true, platform: detectPlatform() };
  }

  if (message.action === 'captureScreen') {
    return captureScreen();
  }

  if (message.action === 'togglePanel') {
    await togglePanel();
    return { ok: true };
  }

  return { ok: false, reason: 'Unsupported content-script action.' };
}

function hasThemeRelevantChange(changes: Record<string, chrome.storage.StorageChange>): boolean {
  return [
    'activeSkinId',
    'activeFontId',
    'coatEnabled',
    'backgroundImage',
    'bgOpacityOverride',
  ].some((key) => key in changes);
}

function scheduleSkynDiagnostic(): void {
  const fire = () => setTimeout(() => { void runSkynDiagnostic(); }, 500);
  if (document.readyState === 'loading') {
    window.addEventListener('DOMContentLoaded', fire, { once: true });
  } else {
    fire();
  }
}

async function runSkynDiagnostic(): Promise<void> {
  const TAG = '[SKYN-DIAG]';
  const lines: string[] = [];

  const themeAttr = document.documentElement.getAttribute('data-theme') ?? '(none)';
  const colorScheme = getComputedStyle(document.documentElement).colorScheme || '(unset)';
  const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;

  lines.push(`${TAG} === META ===`);
  lines.push(`url: ${location.href}`);
  lines.push(`data-theme attribute: ${themeAttr}`);
  lines.push(`computed color-scheme: ${colorScheme}`);
  lines.push(`prefers-color-scheme dark: ${prefersDark}`);
  lines.push(`timestamp: ${new Date().toISOString()}`);
  lines.push('');

  // Enumerate <html> attributes individually rather than dumping outerHTML.
  // outerHTML pulls in child node content too, which would put us on the wrong
  // side of the no-page-content rule in scripts/check-content-security.mjs and
  // the privacy posture in the file header. Attribute enumeration gives us
  // everything we need (data-mode, data-theme, data-color-version) without
  // touching any user content.
  lines.push(`${TAG} === HTML ATTRIBUTES ===`);
  const htmlAttrs = Array.from(document.documentElement.attributes)
    .map((attr) => `${attr.name}="${attr.value}"`) // security-allow: Attr.value is the attribute string (e.g. data-mode), not an input element value
    .join('\n');
  lines.push(htmlAttrs || '(no attributes)');
  lines.push('');

  lines.push(`${TAG} === HTML VARIABLES ===`);
  lines.push(collectCssVars(document.documentElement));
  lines.push('');

  lines.push(`${TAG} === BODY VARIABLES ===`);
  lines.push(collectCssVars(document.body));
  lines.push('');

  lines.push(`${TAG} === USER-MESSAGE TESTID VARIABLES ===`);
  const userMsg = document.querySelector('[data-testid="user-message"]');
  lines.push(userMsg
    ? collectCssVars(userMsg)
    : 'no user-message element found, scoping diagnostic to html+body only');
  lines.push('');

  lines.push(`${TAG} === USER-MESSAGE BUBBLE VARIABLES ===`);
  const userBubble = document.querySelector('[data-user-message-bubble="true"]');
  lines.push(userBubble
    ? collectCssVars(userBubble)
    : 'no [data-user-message-bubble="true"] element found');
  lines.push('');

  // Inventory of ALL <style> tags in document. Catches:
  //   - Skyn content ending up in a tag with a different/missing id
  //   - Multiple Skyn injections leaving duplicate tags
  //   - Our tag being removed or replaced by Claude or another extension
  // Heuristic: any tag whose textContent contains a known Skyn-only marker
  // (--coat-* legacy vars, or our tier-3 scope selector) is flagged.
  lines.push(`${TAG} === ALL STYLE TAGS ===`);
  const allStyleTags = document.querySelectorAll('style');
  lines.push(`total: ${allStyleTags.length}`);
  let skynMarkerCount = 0;
  allStyleTags.forEach((tag, i) => {
    const id = tag.id || '(no id)';
    const text = tag.textContent ?? '';
    const isSkyn = id.startsWith('skyn-')
      || text.includes('--coat-')
      || text.includes('data-color-version="v2"');
    if (isSkyn) skynMarkerCount += 1;
    lines.push(`--- [${i}] id="${id}" length=${text.length}${isSkyn ? ' SKYN-MARKER' : ''} ---`);
    lines.push(text.slice(0, 200));
  });
  lines.push(`(tags with skyn markers: ${skynMarkerCount})`);
  lines.push('');

  // Targeted lookup for the canonical tag — kept for backward continuity
  // so we can spot the case where the broader inventory finds our content
  // but getElementById doesn't (id stripped, dom not yet ready, etc.).
  lines.push(`${TAG} === SKYN STYLE TAG (id="skyn-theme") ===`);
  const skynStyle = document.getElementById('skyn-theme');
  if (!skynStyle) {
    lines.push('NO SKYN-THEME TAG (via getElementById)');
  } else {
    const text = skynStyle.textContent ?? '';
    lines.push(`length: ${text.length} chars`);
    lines.push(`platform attr: ${skynStyle.dataset.platform ?? '(unset)'}`);
    lines.push(`skin attr: ${skynStyle.dataset.skin ?? '(unset)'}`);
    lines.push('---');
    lines.push(text.slice(0, 1000));
  }
  lines.push('');

  // Active-skin variable overrides: walks skin.variableOverrides and prints
  // expected-vs-actual for each var. ✓ means our override won the cascade,
  // ✗ means Claude (or another rule) is still winning.
  lines.push(`${TAG} === ACTIVE SKIN VARIABLE OVERRIDES ===`);
  try {
    const sync = await getSyncStorage();
    const skin = getSkinById(sync.activeSkinId);
    lines.push(`active skin id: ${skin.id}`);
    lines.push(`active skin name: ${skin.name}`);
    lines.push(`coatEnabled: ${sync.coatEnabled}`);
    if (skin.variableOverrides) {
      const computed = getComputedStyle(document.documentElement);
      lines.push(`override count: ${Object.keys(skin.variableOverrides).length}`);
      lines.push('---');
      for (const [key, expected] of Object.entries(skin.variableOverrides)) {
        const actual = computed.getPropertyValue(key).trim();
        const won = actual === expected.trim() ? '✓' : '✗';
        lines.push(`${won} ${key}: expected="${expected}" actual="${actual}"`);
      }
    } else {
      lines.push('(active skin has no variableOverrides)');
    }
  } catch (err) {
    lines.push(`(failed to load active skin: ${err instanceof Error ? err.message : String(err)})`);
  }
  lines.push('');

  // Selector match counts — driven by PLATFORM_SELECTORS for the current
  // platform. Replaces the previous hardcoded probe list. Anything not in
  // the platform map should be added to platforms/<host>.ts, not here.
  lines.push(`${TAG} === PLATFORM SELECTOR MATCH COUNTS ===`);
  const platform = detectPlatform();
  if (!platform) {
    lines.push('platform not detected');
  } else {
    const selectors = PLATFORM_SELECTORS[platform];
    lines.push(`platform: ${platform}`);
    lines.push('---');
    for (const [field, sel] of Object.entries(selectors)) {
      const count = document.querySelectorAll(sel).length;
      lines.push(`${field}: ${count} ${count === 1 ? 'match' : 'matches'} — ${sel}`);
    }
  }
  lines.push('');

  lines.push(`${TAG} === END ===`);

  const report = lines.join('\n');

  console.clear();
  console.log(report);

  // Auto-download bypasses DevTools right-click flow entirely.
  // File lands in ~/Downloads/skyn-diag-<theme>.txt — Chrome appends (1), (2) on collision.
  triggerSkynDiagnosticDownload(report, deriveThemeLabel(themeAttr, prefersDark));
}

function deriveThemeLabel(themeAttr: string, prefersDark: boolean): string {
  if (themeAttr === 'dark' || themeAttr === 'light') return themeAttr;
  if (document.documentElement.classList.contains('dark')) return 'dark';
  if (document.documentElement.classList.contains('light')) return 'light';
  return prefersDark ? 'dark' : 'light';
}

function triggerSkynDiagnosticDownload(report: string, label: string): void {
  try {
    const blob = new Blob([report], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `skyn-diag-${label}.txt`;
    a.style.display = 'none';
    document.body.appendChild(a);
    a.click();
    setTimeout(() => {
      a.remove();
      URL.revokeObjectURL(url);
    }, 1000);
    console.log(`[SKYN-DIAG] download triggered: skyn-diag-${label}.txt`);
  } catch (err) {
    console.error('[SKYN-DIAG] download failed:', err);
  }
}

function collectCssVars(el: Element): string {
  const style = getComputedStyle(el);
  const lines: string[] = [];
  for (let i = 0; i < style.length; i++) {
    const prop = style.item(i);
    if (prop.startsWith('--')) {
      lines.push(`${prop}: ${style.getPropertyValue(prop).trim()}`);
    }
  }
  return lines.length > 0 ? lines.join('\n') : '(no custom properties found at this scope)';
}
