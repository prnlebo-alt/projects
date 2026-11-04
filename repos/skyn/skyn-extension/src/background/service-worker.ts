import { getFontById } from '../shared/fonts';
import { FREE_SKINS, getSkinById, skinToVars } from '../shared/skins';
import { getLocalStorage, getSyncStorage, LOCAL_STORAGE_DEFAULTS, setSyncStorage, STORAGE_DEFAULTS } from '../shared/storage';
import { shouldValidateLicense, validateLicense } from '../shared/license';
import { createPurchaseIntent, verifyPurchase } from '../shared/payment';
import type { BackgroundMessage, BackgroundMessageResponse, ContentMessage } from '../shared/types';

chrome.runtime.onInstalled.addListener(() => {
  void initializeStorage().then(() => validateCachedLicense());
});

chrome.runtime.onStartup.addListener(() => {
  void validateCachedLicense();
});

chrome.runtime.onMessage.addListener((message: BackgroundMessage, _sender, sendResponse: (response: BackgroundMessageResponse) => void) => {
  void handleMessage(message).then(sendResponse);
  return true;
});

// Keyboard shortcut handler — Cmd+Shift+S / Ctrl+Shift+S toggles the
// content-script slide-in panel. The shortcut is registered at the manifest
// level (chrome.commands), so Chrome itself catches the keystroke; the
// content script never installs a keydown listener. Keeps the
// "no keyboard event listening" content-script invariant intact (see header
// of src/content/index.ts + scripts/check-content-security.mjs).
chrome.commands.onCommand.addListener((command) => {
  if (command !== 'toggle-panel') return;
  void sendToActiveTab({ action: 'togglePanel' });
});

async function initializeStorage(): Promise<void> {
  const syncValues = await chrome.storage.sync.get(STORAGE_DEFAULTS as unknown as Record<string, unknown>);
  const localValues = await chrome.storage.local.get(LOCAL_STORAGE_DEFAULTS as unknown as Record<string, unknown>);

  await chrome.storage.sync.set({
    ...STORAGE_DEFAULTS,
    ...syncValues,
    unlockedSkins: normalizeUnlockedSkins(syncValues.unlockedSkins),
  });

  await chrome.storage.local.set({
    ...LOCAL_STORAGE_DEFAULTS,
    ...localValues,
  });
}

async function handleMessage(message: BackgroundMessage): Promise<BackgroundMessageResponse> {
  if (message.action === 'refreshActiveTabTheme') {
    const response = await sendToActiveTab({ action: 'refreshTheme' });
    if (response.ok) return response;
    return injectThemeIntoActiveTab();
  }

  if (message.action === 'validateLicenseNow') {
    await validateCachedLicense(true);
    return { ok: true };
  }

  if (message.action === 'getActiveTabStatus') {
    const tab = await getActiveTab();
    if (!tab?.url || !isSupportedUrl(tab.url)) return { ok: true, supported: false };
    return { ok: true, supported: true };
  }

  if (message.action === 'startPurchase') {
    return startPurchase(message.itemType, message.itemId, message.userEmail);
  }

  if (message.action === 'verifyPurchase') {
    return updateLicenseFromPurchase(message.sessionId);
  }

  return { ok: false, reason: 'Unsupported background action.' };
}

async function startPurchase(itemType: 'skin' | 'pack' | 'all_access' | 'season_pass', itemId: string, userEmail: string): Promise<BackgroundMessageResponse> {
  try {
    const intent = await createPurchaseIntent({
      itemId,
      itemType,
      userEmail,
    });
    await chrome.tabs.create({ url: intent.checkoutUrl });
    return { ok: true, checkoutUrl: intent.checkoutUrl };
  } catch {
    return { ok: false, reason: 'Checkout is unavailable. Try again later.' };
  }
}

async function updateLicenseFromPurchase(sessionId: string): Promise<BackgroundMessageResponse> {
  try {
    const purchase = await verifyPurchase(sessionId);
    await setSyncStorage({
      licenseToken: purchase.token,
      plan: purchase.plan ?? 'free',
      unlockedSkins: normalizeUnlockedSkins(purchase.unlockedSkins),
      lastValidated: Date.now(),
    });
    return { ok: true };
  } catch {
    return { ok: false, reason: 'Purchase verification failed.' };
  }
}

async function validateCachedLicense(force = false): Promise<void> {
  const sync = await getSyncStorage();
  if (!sync.licenseToken) return;
  if (!force && !shouldValidateLicense(sync.lastValidated)) return;

  const validation = await validateLicense(sync.licenseToken);
  if (!validation.valid) {
    await setSyncStorage({
      plan: 'free',
      unlockedSkins: [...FREE_SKINS],
      lastValidated: Date.now(),
    });
    return;
  }

  await setSyncStorage({
    plan: validation.plan,
    unlockedSkins: normalizeUnlockedSkins(validation.unlockedSkins),
    lastValidated: Date.now(),
  });
}

async function sendToActiveTab(message: ContentMessage): Promise<BackgroundMessageResponse> {
  const tab = await getActiveTab();
  if (!tab?.id) return { ok: false, reason: 'No active tab available.' };

  try {
    await chrome.tabs.sendMessage(tab.id, message);
    return { ok: true };
  } catch {
    return { ok: false, reason: 'Active tab is not a supported Skyn page.' };
  }
}

async function getActiveTab(): Promise<chrome.tabs.Tab | undefined> {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  return tab;
}

async function injectThemeIntoActiveTab(): Promise<BackgroundMessageResponse> {
  const tab = await getActiveTab();
  if (!tab?.id || !tab.url || !isSupportedUrl(tab.url)) {
    return { ok: false, reason: 'Active tab is not a supported Skyn page.' };
  }

  const sync = await getSyncStorage();
  if (!sync.coatEnabled) return { ok: true };

  const local = await getLocalStorage();
  const skin = getSkinById(sync.activeSkinId);
  const font = getFontById(sync.activeFontId);
  const vars = skinToVars(skin);
  const rootVars = Object.entries({ ...vars, '--coat-font': font.family })
    .map(([key, value]) => `${key}: ${value};`)
    .join('\n  ');

  const css = `
:root {
  ${rootVars}
}

html,
body,
body > div,
#__next,
main,
[role="main"],
[data-testid="chat-view"],
[class*="bg-"],
[class*="dark:bg-"],
[class*="bg-token"],
[class*="bg-bg"],
.bg-bg-000,
[data-testid="conversation-panel-wrapper"],
[data-testid="conversation-panel"],
[data-testid^="conversation-turn"],
[data-message-author-role],
[data-testid="sidebar"],
nav[aria-label],
aside,
/* TODO(v1.x): claude-app/gemini-app are dormant selectors. v1 ships
   Claude-only — manifest content_scripts.matches restricts injection
   to claude.ai, so the gemini-app branch is unreachable on shipped
   builds. Kept for re-activation when host_permissions expands per
   the multi-platform roadmap in SKYN_PLAN.md. */
claude-app,
gemini-app {
  background-color: var(--coat-bg) !important;
  color: var(--coat-text) !important;
  font-family: var(--coat-font) !important;
}

#sidebar,
[data-testid="sidebar"],
[data-testid="sidebar-menu"],
nav[aria-label],
aside,
side-navigation-v2,
mat-sidenav,
.bg-bg-100 {
  background-color: var(--coat-sidebar) !important;
  color: var(--coat-text) !important;
  border-color: var(--coat-border) !important;
}

[data-message-author-role="user"],
[data-testid="human-turn"],
.user-query {
  background-color: var(--coat-bubble-user) !important;
  color: var(--coat-bubble-user-text, var(--coat-text)) !important;
  border-color: var(--coat-accent) !important;
  border-radius: var(--coat-bubble-user-radius) !important;
}

[data-message-author-role="assistant"],
[data-testid="assistant-turn"],
[data-testid="assistant-turn-content"],
.font-claude-message,
.model-response,
.model-response-text,
message-content {
  background-color: var(--coat-bubble-ai) !important;
  color: var(--coat-bubble-ai-text, var(--coat-text)) !important;
  border-color: var(--coat-border) !important;
  border-radius: var(--coat-bubble-ai-radius) !important;
}

#prompt-textarea,
textarea,
[contenteditable="true"],
rich-textarea,
[data-testid="composer"],
[data-testid="chat-input-area"] {
  background-color: var(--coat-input-bg) !important;
  color: var(--coat-text) !important;
  border-color: var(--coat-border) !important;
  caret-color: var(--coat-accent) !important;
}

a,
button,
[role="button"] {
  accent-color: var(--coat-accent) !important;
}

${buildFallbackBackgroundCss(local.backgroundImage, local.bgOpacityOverride, skin.category)}
`;

  try {
    await chrome.scripting.insertCSS({
      target: { tabId: tab.id },
      css,
    });
    return { ok: true };
  } catch {
    return { ok: false, reason: 'Could not inject Skyn CSS into the active tab.' };
  }
}

// TODO(v1.x): v1 ships Claude-only. The chat.openai.com / chatgpt.com /
// gemini.google.com hostname branches below are dormant — manifest
// host_permissions restrict activation to claude.ai, so non-Claude
// branches are unreachable on shipped builds. Kept for re-activation
// when host_permissions expands per the multi-platform roadmap in
// SKYN_PLAN.md.
function isSupportedUrl(url: string): boolean {
  try {
    const { hostname } = new URL(url);
    return hostname === 'claude.ai'
      || hostname.endsWith('.claude.ai')
      || hostname === 'chat.openai.com'
      || hostname === 'chatgpt.com'
      || hostname.endsWith('.chatgpt.com')
      || hostname === 'gemini.google.com';
  } catch {
    return false;
  }
}

function buildFallbackBackgroundCss(backgroundImage: string | null, opacityOverride: number | null, category: string): string {
  if (!backgroundImage) return '';
  const defaultOpacity = category === 'vibrant' ? 0.18 : category === 'light' ? 0.08 : 0.12;
  const opacity = opacityOverride === null ? defaultOpacity : Math.max(0, Math.min(30, opacityOverride)) / 100;
  return `
body::before {
  content: "";
  position: fixed;
  inset: 0;
  background-image: url("${escapeCssUrl(backgroundImage)}");
  background-size: cover;
  background-position: center;
  opacity: ${opacity};
  pointer-events: none;
  z-index: 0;
}
`;
}

function escapeCssUrl(value: string): string {
  return value.replaceAll('"', '%22').replaceAll('\\', '%5C');
}

function normalizeUnlockedSkins(value: unknown): string[] {
  const skins = Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : [];
  return Array.from(new Set([...FREE_SKINS, ...skins]));
}
