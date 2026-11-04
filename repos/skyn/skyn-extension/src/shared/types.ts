export type SkinId =
  | 'midnight' | 'snow' | 'glass-day' | 'claude-clay'
  | 'thicc' | 'liquid-chrome' | 'mecha-v1'
  | 'aurora-glass' | 'aura-glass' | 'pasture' | 'elven-village';

export type SkinCategory =
  | 'dark' | 'light' | 'vibrant' | 'glass'
  | 'holiday' | 'sports' | 'abstract' | 'attitude'
  | 'pretty' | 'nature' | 'scifi' | 'special'
  | 'personality';

export interface Skin {
  id: SkinId;
  name: string;
  category: SkinCategory;
  free: boolean;
  seasonal: boolean;
  price: number;
  accent: string;
  accent2: string;
  bg: string;
  sidebar: string;
  border: string;
  text: string;
  textMuted: string;
  bubbleAi: string;
  bubbleUser: string;
  bubbleAiRadius: string;
  bubbleUserRadius: string;
  font: string;
  emoji: string;
  vibe: string;
  glassPanels?: boolean;
  mascotPath?: string;
  videoPath?: string;
  customCss?: string;
  accentGlow?: string;
  /**
   * Map of CSS variable name → value, scoped to the platform's verified
   * root selector. Variable names MUST match the platform's actual
   * variables (verified via DevTools), not inferred names. Used by the
   * tier-3 variable-override engine path; tier-1/2 skins ignore this.
   */
  variableOverrides?: Record<string, string>;
}

export interface SkinPack {
  id: string;
  name: string;
  skins: SkinId[] | 'all';
  price: number;
}

export type PlatformId = 'claude' | 'chatgpt' | 'gemini';

export interface SkinVars {
  '--coat-bg': string;
  '--coat-sidebar': string;
  '--coat-topbar': string;
  '--coat-border': string;
  '--coat-text': string;
  '--coat-text-muted': string;
  '--coat-accent': string;
  '--coat-accent2': string;
  '--coat-bubble-ai': string;
  '--coat-bubble-user': string;
  '--coat-bubble-ai-radius': string;
  '--coat-bubble-user-radius': string;
  '--coat-bubble-ai-text': string;
  '--coat-bubble-user-text': string;
  '--coat-input-bg': string;
  '--coat-font': string;
  '--coat-glow'?: string;
}

export interface PlatformSelectors {
  root: string;
  sidebar: string;
  messages: string;
  input: string;
  userBubble: string;
  aiBubble: string;
}

export type Plan = 'free' | 'season_pass' | 'lifetime';

export interface SyncStorage {
  activeSkinId: SkinId;
  activeFontId: string;
  coatEnabled: boolean;
  unlockedSkins: string[];
  licenseToken: string | null;
  userEmail: string;
  plan: Plan;
  lastValidated: number;
  hasSeenOnboarding: boolean;
}

export interface LocalStorage {
  backgroundImage: string | null;
  bgOpacityOverride: number | null;
  customSkins: CustomSkin[];
  /**
   * Whether the keyboard-triggered slide-in skin picker panel is currently
   * open. Persisted in chrome.storage.local so the state survives SPA route
   * changes within Claude.ai and stays in sync across tabs.
   */
  panelOpen: boolean;
}

export interface CustomSkin {
  id: string;
  name: string;
  vars: SkinVars;
  createdAt: number;
}

export type ContentMessage =
  | { action: 'refreshTheme' }
  | { action: 'getPlatform' }
  | { action: 'captureScreen' }
  | { action: 'togglePanel' };

export type ContentMessageResponse =
  | { ok: true }
  | { ok: true; platform: PlatformId | null }
  | { ok: false; reason: string };

export type BackgroundMessage =
  | { action: 'refreshActiveTabTheme' }
  | { action: 'validateLicenseNow' }
  | { action: 'getActiveTabStatus' }
  | { action: 'startPurchase'; itemId: string; itemType: 'skin' | 'pack' | 'all_access' | 'season_pass'; userEmail: string }
  | { action: 'verifyPurchase'; sessionId: string };

export type BackgroundMessageResponse =
  | { ok: true; checkoutUrl?: string }
  | { ok: true; supported: boolean }
  | { ok: false; reason: string };
