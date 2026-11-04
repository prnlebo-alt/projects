import { buildBackgroundCss } from './background-injector';
import { CLAUDE_SELECTORS } from './platforms/claude';
import { CHATGPT_SELECTORS } from './platforms/chatgpt';
import { GEMINI_SELECTORS } from './platforms/gemini';
import { getFontById } from '../shared/fonts';
import { getSkinById, skinToVars } from '../shared/skins';
import type { LocalStorage, PlatformId, PlatformSelectors, Skin, SkinVars, SyncStorage } from '../shared/types';

const THEME_STYLE_ID = 'skyn-theme';
const FONT_LINK_ID = 'skyn-font';
const PRELOAD_STYLE_ID = 'skyn-preload';
const VIDEO_BG_ID = 'skyn-video-bg';

// Conversation content exclusion — keeps the skin's body/sidebar/composer
// painting off the chat thread itself. Forces the message wrappers to a
// transparent background so the skin's main-area background paints once
// (on body/main) without doubling up where messages render. Appended LAST
// in every theme CSS output so source-order overrides any same-specificity
// rules upstream. Selectors include both Claude's current testid and
// historical/class hooks for resilience across DOM iterations.
//
// The second rule below pins conversation text color via a CSS custom
// property, --skyn-content-text. Skins setting body/page-shell colors
// can cascade into Claude's message-rendering nodes and inherit through
// to paragraph/list/code/heading text, sometimes making AI response text
// unreadable. The variable lets each skin declare its own conversation
// text color via :root in its customCss without us hardcoding a value
// here: dark skins set a light value (#ebebeb-ish), light skins inherit
// the #1a1a1a fallback (or set their own). Backgrounds are untouched —
// they may be intentional per skin (see the transparent rule above).
// Selector roster verified against current Claude DOM via tier-3 skin
// customCss (Aurora Glass, Aura, Pasture, Elven Village, Claude Clay all
// target these), the diagnostic in src/content/index.ts:189-199, and the
// do-not-use list in CLAUDE.md:97:
//   .font-claude-response                — AI message outer wrapper
//   [data-user-message-bubble="true"]    — user message bubble
//   [data-testid="user-message"]         — user message container
//   [data-testid*="message"]             — substring net for future variants
//   [class*="prose"]                     — markdown prose hook
// Replaces the previous selectors which were stale or speculative:
//   [data-testid="conversation-turn-2"]  — never existed (bogus -2 index)
//   .font-claude-message                 — renamed; CLAUDE.md flags it stale
const CONTENT_EXCLUSION_CSS = `
.font-claude-response,
[data-user-message-bubble="true"],
[data-testid="user-message"],
[data-testid*="message"],
[class*="prose"] {
  background: transparent !important;
  backdrop-filter: none !important;
}

:is(.font-claude-response,
    [data-user-message-bubble="true"],
    [data-testid="user-message"],
    [data-testid*="message"],
    [class*="prose"])
  :is(p, li, code, a, h1, h2, h3, h4, h5, h6, span, strong, em, blockquote, pre) {
  color: var(--skyn-content-text, #1a1a1a) !important;
}
`;

// Tracks the chrome-extension:// URL of the video the currently-active skin
// expects. Used to guard against a race where the user switches skins while
// a HEAD fetch is in flight — when the fetch resolves we compare back to
// this value and abort if the active skin no longer wants this asset.
let wantedVideoSrc: string | null = null;

export const PLATFORM_SELECTORS: Record<PlatformId, PlatformSelectors> = {
  claude: CLAUDE_SELECTORS,
  chatgpt: CHATGPT_SELECTORS,
  gemini: GEMINI_SELECTORS,
};

export function detectPlatform(hostname = window.location.hostname): PlatformId | null {
  if (hostname === 'claude.ai' || hostname.endsWith('.claude.ai')) return 'claude';
  if (hostname === 'chat.openai.com' || hostname === 'chatgpt.com' || hostname.endsWith('.chatgpt.com')) return 'chatgpt';
  if (hostname === 'gemini.google.com') return 'gemini';
  return null;
}

export function injectDefaultTheme(): void {
  const platform = detectPlatform();
  if (!platform) return;
  hideUntilStoredTheme();
  injectThemeCss(platform, getSkinById('midnight'), skinToVars(getSkinById('midnight')), 'system-ui,-apple-system,sans-serif', null);
}

let isApplying = false;

export function applyStoredTheme(sync: SyncStorage, local: LocalStorage): void {
  if (isApplying) return;
  isApplying = true;
  try {
    const platform = detectPlatform();
    if (!platform) return;

    if (!sync.coatEnabled) {
      removeInjectedTheme();
      revealStoredTheme();
      return;
    }

    const skin = getSkinById(sync.activeSkinId);
    const font = getFontById(sync.activeFontId);
    injectFont(font.url);
    injectThemeCss(platform, skin, skinToVars(skin), font.family, local);
    if (skin.videoPath) {
      void injectVideoBackground(skin.videoPath);
    } else {
      removeVideoBackground();
    }
    revealStoredTheme();
  } finally {
    isApplying = false;
  }
}

export function removeInjectedTheme(): void {
  document.getElementById(THEME_STYLE_ID)?.remove();
  document.getElementById(FONT_LINK_ID)?.remove();
  removeVideoBackground();
}

// Skyn only injects <style>/<link> elements per the security constraint at
// the top of content/index.ts — this <video> is a deliberate exception for
// motion-background skins. The element never reads page content, listens for
// input events, or touches host storage; the privacy posture is intact.
//
// HEAD-fetches the asset URL first so a missing .mp4 silently falls back to
// the JPG that's already painted via the skin's customCss body background.
// On successful canplay, the JPG layer is hidden via an inline override on
// body.style.background-image so the video is visible underneath without
// the static photo competing on top.
async function injectVideoBackground(videoPath: string): Promise<void> {
  const url = chrome.runtime.getURL(videoPath);
  wantedVideoSrc = url;

  // Idempotent — if the same video is already mounted, no work to do.
  const existing = document.getElementById(VIDEO_BG_ID);
  if (existing instanceof HTMLVideoElement && existing.src === url) {
    return;
  }

  let ok: boolean;
  try {
    const res = await fetch(url, { method: 'HEAD' });
    ok = res.ok;
  } catch {
    ok = false;
  }

  // Race guard — user may have switched skins during the HEAD fetch.
  if (wantedVideoSrc !== url) return;

  if (!ok) {
    removeVideoBackground();
    return;
  }

  // Remove any prior (different-src) video before inserting the new one.
  document.getElementById(VIDEO_BG_ID)?.remove();

  const video = document.createElement('video');
  video.id = VIDEO_BG_ID;
  video.src = url;
  video.autoplay = true;
  video.muted = true;
  video.loop = true;
  video.playsInline = true;
  video.setAttribute('aria-hidden', 'true');
  Object.assign(video.style, {
    position: 'fixed',
    top: '0',
    left: '0',
    width: '100vw',
    height: '100vh',
    objectFit: 'cover',
    zIndex: '-1',
    pointerEvents: 'none',
  });

  // Reveal video only when it's actually playing — until then the JPG
  // fallback keeps the page from flashing dark. setProperty with 'important'
  // beats the skin's customCss !important rule on body background.
  video.addEventListener('canplay', () => {
    document.body?.style.setProperty('background-image', 'none', 'important');
  });
  // If the file is unplayable (codec, corruption), tear out and let the JPG
  // continue to show. Don't recurse — one error == fall back permanently
  // for this page load.
  video.addEventListener('error', () => {
    video.remove();
    document.body?.style.removeProperty('background-image');
  });

  // body may not exist yet on document_start. Defer if needed.
  if (document.body) {
    document.body.prepend(video);
  } else {
    document.addEventListener('DOMContentLoaded', () => {
      if (wantedVideoSrc !== url) return;
      document.body?.prepend(video);
    }, { once: true });
  }
}

function removeVideoBackground(): void {
  wantedVideoSrc = null;
  document.getElementById(VIDEO_BG_ID)?.remove();
  document.body?.style.removeProperty('background-image');
}

function injectThemeCss(platform: PlatformId, skin: Skin, vars: SkinVars, fontFamily: string, local: LocalStorage | null): void {
  const style = getOrCreateStyle();
  const selectors = PLATFORM_SELECTORS[platform];
  style.dataset.platform = platform;
  style.dataset.skin = skin.id;

  // Defensive: a throw inside buildThemeCss (most likely the tier-3
  // buildClaudeVariableTheme path for variableOverrides skins) would leave
  // the style tag without its content, blanking the page. Catch and try
  // again via the legacy --coat-* pipeline by stripping variableOverrides.
  // If even the legacy path throws, leave the tag's prior content untouched
  // rather than wipe it. Logging only — no user-facing surface here.
  let css: string;
  try {
    css = buildThemeCss(platform, selectors, skin, vars, fontFamily, local);
  } catch (err) {
    console.error('[skyn] buildThemeCss failed for skin', skin.id, '— falling back to legacy path:', err);
    const fallbackSkin: Skin = { ...skin, variableOverrides: undefined };
    try {
      css = buildThemeCss(platform, selectors, fallbackSkin, vars, fontFamily, local);
    } catch (fallbackErr) {
      console.error('[skyn] legacy fallback also failed:', fallbackErr);
      return;
    }
  }
  style.textContent = css;
}

export function revealStoredTheme(): void {
  document.getElementById(PRELOAD_STYLE_ID)?.remove();
}

function hideUntilStoredTheme(): void {
  if (document.getElementById(PRELOAD_STYLE_ID)) return;

  const style = document.createElement('style');
  style.id = PRELOAD_STYLE_ID;
  style.dataset.skyn = 'preload';
  style.textContent = `
html {
  background: #0e0e11 !important;
}

body {
  opacity: 0 !important;
}
`;
  const target = document.documentElement.firstElementChild ?? document.documentElement;
  target.prepend(style);
}

function getOrCreateStyle(): HTMLStyleElement {
  const existing = document.getElementById(THEME_STYLE_ID);
  if (existing instanceof HTMLStyleElement) return existing;

  const style = document.createElement('style');
  style.id = THEME_STYLE_ID;
  style.dataset.skyn = 'true';
  const target = document.documentElement.firstElementChild ?? document.documentElement;
  target.prepend(style);
  return style;
}

function injectFont(url: string | undefined): void {
  document.getElementById(FONT_LINK_ID)?.remove();
  if (!url) return;

  const link = document.createElement('link');
  link.id = FONT_LINK_ID;
  link.rel = 'stylesheet';
  link.href = url;
  document.documentElement.firstElementChild?.append(link);
}

function buildThemeCss(platform: PlatformId, selectors: PlatformSelectors, skin: Skin, vars: SkinVars, fontFamily: string, local: LocalStorage | null): string {
  // Tier-3 path: skin overrides Claude's native CSS variables directly.
  // Skips the legacy Tailwind-fighting block — Claude's own tokens drive the
  // UI once we override them at the source. Scoped to verified attributes
  // from the DevTools dump (data-theme + data-mode + data-color-version).
  if (platform === 'claude' && skin.variableOverrides) {
    return buildClaudeVariableTheme(selectors, skin, local);
  }

  const rootVars = Object.entries({ ...vars, '--coat-font': fontFamily })
    .map(([key, value]) => `${key}: ${value};`)
    .join('\n  ');
  const backgroundCss = local ? buildBackgroundCss(local, skin.category) : '';
  const platformCss = buildPlatformCss(selectors);
  const glassCss = skin.glassPanels ? buildGlassCss(selectors) : '';
  const mascotCss = skin.mascotPath ? buildMascotCss(selectors, skin.mascotPath) : '';
  const customCss = skin.customCss ? resolveCustomCss(skin.customCss, selectors) : '';

  return `
:root {
  ${rootVars}
}

html, body, ${selectors.root} {
  background: var(--coat-bg) !important;
  background-color: var(--coat-bg) !important;
  color: var(--coat-text) !important;
  font-family: var(--coat-font) !important;
  transition: background 200ms ease, color 200ms ease !important;
}

body {
  min-height: 100vh !important;
}

[data-testid="chat-view"],
.bg-bg-000,
[class*="bg-bg"] {
  background: var(--coat-bg) !important;
  background-color: var(--coat-bg) !important;
  color: var(--coat-text) !important;
}

[data-testid="assistant-turn-content"],
.font-claude-message {
  background: var(--coat-bubble-ai) !important;
  background-color: var(--coat-bubble-ai) !important;
  color: var(--coat-text) !important;
}

[data-testid="chat-input-area"] {
  background: var(--coat-input-bg) !important;
  background-color: var(--coat-input-bg) !important;
  color: var(--coat-text) !important;
  border-color: var(--coat-border) !important;
}

${selectors.sidebar} {
  background: var(--coat-sidebar) !important;
  color: var(--coat-text) !important;
  border-color: var(--coat-border) !important;
}

${selectors.messages} {
  color: var(--coat-text) !important;
  font-family: var(--coat-font) !important;
}

${selectors.input} {
  background: var(--coat-input-bg) !important;
  color: var(--coat-text) !important;
  border-color: var(--coat-border) !important;
  caret-color: var(--coat-accent) !important;
  font-family: var(--coat-font) !important;
}

${selectors.userBubble} {
  background: var(--coat-bubble-user) !important;
  color: var(--coat-bubble-user-text, var(--coat-text)) !important;
  border-color: var(--coat-accent) !important;
  border-radius: var(--coat-bubble-user-radius) !important;
}

${selectors.aiBubble} {
  background: var(--coat-bubble-ai) !important;
  color: var(--coat-bubble-ai-text, var(--coat-text)) !important;
  border-color: var(--coat-border) !important;
  border-radius: var(--coat-bubble-ai-radius) !important;
}

a, button, [role="button"] {
  accent-color: var(--coat-accent) !important;
}

::selection {
  background: var(--coat-accent) !important;
  color: var(--coat-bg) !important;
}

${backgroundCss}
${platformCss}
${glassCss}
${mascotCss}
${customCss}
${CONTENT_EXCLUSION_CSS}
`;
}

function buildClaudeVariableTheme(selectors: PlatformSelectors, skin: Skin, local: LocalStorage | null): string {
  const overrides = skin.variableOverrides ?? {};
  const varBlock = Object.entries(overrides)
    .map(([key, value]) => `  ${key}: ${value};`)
    .join('\n');

  // Three-attribute selector: (0,3,1) specificity. Higher than anything Claude
  // is observed to use on <html>, so overrides win without !important. Attributes
  // confirmed via DevTools dump on 2026-05-09: data-theme="claude",
  // data-mode="dark", data-color-version="v2".
  const variableScope = `html[data-theme="claude"][data-mode="dark"][data-color-version="v2"] {
${varBlock}
}`;

  const mascotCss = skin.mascotPath ? buildClaudeMascotCss(skin.mascotPath) : '';
  const customCss = skin.customCss ? resolveCustomCss(skin.customCss, selectors) : '';
  const backgroundCss = local ? buildBackgroundCss(local, skin.category) : '';

  return `
${variableScope}

${mascotCss}
${customCss}
${backgroundCss}
${CONTENT_EXCLUSION_CSS}
`;
}

function buildClaudeMascotCss(mascotPath: string): string {
  const url = chrome.runtime.getURL(mascotPath);
  // Scoped to data-mode="dark" so personality-skin mascots don't leak into
  // light mode. The anchor net here mirrors the broader sidebar-selector
  // list used by individual skins' customCss blocks — same data-testid
  // candidates, semantic role variants, class-substring matches, and
  // :has() shots that target an aside/nav by content (sidebar-only
  // landmarks like a "new chat" button or a /chat/ link). At least one
  // branch should match Claude's current sidebar; position: fixed means
  // duplicate matches stack at the same coords (visually one mascot).
  // Positioned 96px above viewport bottom so it sits above the user-account
  // tile that Claude renders at the very bottom of the sidebar.
  return `
html[data-theme="claude"][data-mode="dark"] [data-testid="sidebar"]::after,
html[data-theme="claude"][data-mode="dark"] [data-testid="sidebar-menu"]::after,
html[data-theme="claude"][data-mode="dark"] [data-testid="navigation-sidebar"]::after,
html[data-theme="claude"][data-mode="dark"] [data-testid="conversation-list"]::after,
html[data-theme="claude"][data-mode="dark"] [data-testid="chat-history"]::after,
html[data-theme="claude"][data-mode="dark"] [data-testid="app-sidebar"]::after,
html[data-theme="claude"][data-mode="dark"] [data-testid="layout-sidebar"]::after,
html[data-theme="claude"][data-mode="dark"] [data-testid="left-rail"]::after,
html[data-theme="claude"][data-mode="dark"] [data-testid*="sidebar" i]::after,
html[data-theme="claude"][data-mode="dark"] nav[aria-label*="chat" i]::after,
html[data-theme="claude"][data-mode="dark"] nav[aria-label*="conversation" i]::after,
html[data-theme="claude"][data-mode="dark"] nav[aria-label*="recent" i]::after,
html[data-theme="claude"][data-mode="dark"] nav[aria-label*="navigation" i]::after,
html[data-theme="claude"][data-mode="dark"] aside[aria-label*="chat" i]::after,
html[data-theme="claude"][data-mode="dark"] aside[aria-label*="navigation" i]::after,
html[data-theme="claude"][data-mode="dark"] aside[aria-label*="recent" i]::after,
html[data-theme="claude"][data-mode="dark"] [role="complementary"]::after,
html[data-theme="claude"][data-mode="dark"] [class*="sidebar" i]::after,
html[data-theme="claude"][data-mode="dark"] [class*="leftrail" i]::after,
html[data-theme="claude"][data-mode="dark"] [class*="navrail" i]::after,
html[data-theme="claude"][data-mode="dark"] aside:has(button[aria-label*="new chat" i])::after,
html[data-theme="claude"][data-mode="dark"] aside:has(a[href*="/chat/"])::after,
html[data-theme="claude"][data-mode="dark"] nav:has(button[aria-label*="new chat" i])::after,
html[data-theme="claude"][data-mode="dark"] nav:has(a[href*="/chat/"])::after {
  content: '';
  position: fixed;
  bottom: 96px;
  left: 24px;
  width: 56px;
  height: 56px;
  background-image: url('${url}');
  background-size: contain;
  background-repeat: no-repeat;
  background-position: center;
  pointer-events: none;
  z-index: 100;
  opacity: 0.9;
  filter: drop-shadow(0 0 8px rgba(212, 175, 106, 0.3));
}
`;
}

function buildMascotCss(selectors: PlatformSelectors, mascotPath: string): string {
  const url = chrome.runtime.getURL(mascotPath);
  return `
${selectors.sidebar}::after {
  content: '' !important;
  position: fixed !important;
  bottom: 24px !important;
  left: 24px !important;
  width: 80px !important;
  height: 80px !important;
  background-image: url('${url}') !important;
  background-size: contain !important;
  background-repeat: no-repeat !important;
  background-position: center !important;
  pointer-events: none !important;
  z-index: 10 !important;
}
`;
}

function resolveCustomCss(template: string, selectors: PlatformSelectors): string {
  return template
    .replaceAll('{{userBubble}}', selectors.userBubble)
    .replaceAll('{{aiBubble}}', selectors.aiBubble)
    .replaceAll('{{sidebar}}', selectors.sidebar)
    .replaceAll('{{input}}', selectors.input)
    .replaceAll('{{pageBg}}', `html, body, ${selectors.root}`)
    // {{asset:<path>}} → chrome-extension://<id>/<path>. Lets skins reference
    // bundled assets (galaxy.jpg, etc.) from inside customCss without needing
    // a JS-side hook for every new asset. Path is whatever's in WAR resources.
    .replace(/\{\{asset:([^}]+)\}\}/g, (_, path: string) => chrome.runtime.getURL(path.trim()));
}

function buildGlassCss(selectors: PlatformSelectors): string {
  return `
${selectors.userBubble},
${selectors.aiBubble} {
  backdrop-filter: blur(20px) saturate(160%) !important;
  -webkit-backdrop-filter: blur(20px) saturate(160%) !important;
  box-shadow: inset 0 0 0 1px rgba(255,255,255,0.18) !important;
}
`;
}

function buildPlatformCss(selectors: PlatformSelectors): string {
  return `
[class*="bg-"],
[class*="dark:bg-"],
[class*="bg-token"],
[class*="text-token"],
main,
[role="main"],
.main,
.conversation,
.chat-container {
  background-color: transparent !important;
  color: var(--coat-text) !important;
}

#__next,
[id="__next"],
[class*="__next"],
[data-testid="conversation-panel-wrapper"],
[data-testid="conversation-panel"],
[data-testid="conversation-turn"],
[data-testid="composer"],
[data-testid="composer-footer"],
[data-testid="thread"],
[data-testid="chat-history"],
[data-testid="sidebar"],
[data-testid="modal"],
.group\\/conversation-turn,
.composer-parent,
.composer,
.dark\\:bg-token-main-surface-primary,
.bg-token-main-surface-primary,
.bg-token-main-surface-secondary,
.bg-token-sidebar-surface-primary,
.bg-token-sidebar-surface-secondary,
.dark,
.light {
  background: transparent !important;
  background-color: transparent !important;
  color: var(--coat-text) !important;
}

#__next,
body > div,
main,
[role="main"] {
  background: var(--coat-bg) !important;
  background-color: var(--coat-bg) !important;
}

header, [role="banner"], [data-testid="top-bar"], .sticky, .mat-toolbar {
  background: var(--coat-topbar) !important;
  color: var(--coat-text) !important;
  border-color: var(--coat-border) !important;
}

${selectors.sidebar} a,
${selectors.sidebar} button,
${selectors.sidebar} [role="button"] {
  color: var(--coat-text) !important;
  border-color: transparent !important;
}

${selectors.sidebar} a:hover,
${selectors.sidebar} button:hover,
${selectors.sidebar} [role="button"]:hover {
  background: var(--coat-bubble-ai) !important;
}

[data-message-author-role],
[data-testid="message-content"],
message-content,
.model-response-text {
  color: var(--coat-text) !important;
}

pre, code {
  background: color-mix(in srgb, var(--coat-bg) 82%, var(--coat-accent) 18%) !important;
  color: var(--coat-text) !important;
  border-color: var(--coat-border) !important;
}

textarea,
[contenteditable="true"],
#prompt-textarea,
rich-textarea {
  outline-color: var(--coat-accent) !important;
}

html.dark body,
html[data-theme="dark"] body {
  background: var(--coat-bg) !important;
  color: var(--coat-text) !important;
}
`;
}
