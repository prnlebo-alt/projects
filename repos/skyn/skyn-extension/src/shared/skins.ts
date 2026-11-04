import {
  AI_DESCENDANT_STRIP_RULE,
  OUTER_TURN_STRIP_RULE,
} from './skin-css-snippets';
import type { Skin, SkinCategory, SkinId, SkinPack, SkinVars } from './types';

export const FREE_SKINS: SkinId[] = ['midnight', 'snow', 'glass-day', 'claude-clay', 'thicc', 'liquid-chrome', 'mecha-v1', 'aurora-glass', 'aura-glass', 'pasture', 'elven-village'];

type SkinSeed = {
  id: SkinId;
  name: string;
  category: SkinCategory;
  free?: boolean;
  seasonal?: boolean;
  price?: number;
  accent: string;
  accent2?: string;
  bg: string;
  font?: string;
  emoji: string;
  vibe: string;
  sidebar?: string;
  border?: string;
  text?: string;
  textMuted?: string;
  bubbleAi?: string;
  bubbleUser?: string;
  bubbleAiRadius?: string;
  bubbleUserRadius?: string;
  glassPanels?: boolean;
  mascotPath?: string;
  videoPath?: string;
  customCss?: string;
  accentGlow?: string;
  variableOverrides?: Record<string, string>;
};

const SYSTEM = 'system-ui,-apple-system,sans-serif';
const SERIF = 'Georgia,"Times New Roman",serif';
const SF = '-apple-system,BlinkMacSystemFont,"SF Pro Display",sans-serif';

export const SKINS: Skin[] = [
  s({ id:'midnight', name:'Midnight', category:'dark', free:true, price:0, accent:'#a78bfa', accent2:'#60a5fa', bg:'#0e0e11', emoji:'🌙', vibe:'Dark & nerdy', customCss:`:root { --skyn-content-text: #ebebeb; }` }),
  s({ id:'snow', name:'Snow', category:'light', free:true, price:0, accent:'#228be6', accent2:'#7950f2', bg:'#ffffff', emoji:'❄️', vibe:'Clean & bright' }),
  s({ id:'glass-day', name:'Glass Day', category:'glass', free:true, price:0, accent:'#586eff', accent2:'#a855f7', bg:'#daeeff', font:SF, emoji:'🪟', vibe:'iOS & airy', sidebar:'rgba(255,255,255,0.45)', border:'rgba(255,255,255,0.68)', text:'#1c1c3e', textMuted:'#6060a0', bubbleAi:'rgba(255,255,255,0.55)', bubbleUser:'rgba(88,110,255,0.85)' }),
  s({
    id:'thicc',
    name:'Thicc',
    category:'nature',
    free:true,
    price:0,
    // Popup preview swatches (legacy fields). Real engine uses variableOverrides + customCss.
    accent:'#c8a83a',
    accent2:'#8b5a32',
    bg:'#f7f1de',
    sidebar:'#ede2c2',
    border:'#c4cf9e',
    text:'#2a361b',
    textMuted:'#6e7a4a',
    bubbleAi:'#f0e8cf',
    bubbleUser:'#dce8c8',
    bubbleAiRadius:'18px',
    bubbleUserRadius:'18px',
    font:SERIF,
    emoji:'🐴',
    vibe:'Pastoral & lush',
    accentGlow:'0 0 12px rgba(200, 168, 58, 0.18)',
    variableOverrides:{
      // Surfaces — cream meadow base. HSL triples per Claude's format.
      '--bg-000':'45 55% 92%',
      '--bg-100':'45 50% 88%',
      '--bg-200':'45 45% 82%',
      '--bg-300':'45 40% 75%',
      '--bg-400':'80 25% 60%',
      '--bg-500':'90 30% 40%',
      // Text — deep moss/forest.
      '--text-000':'82 35% 15%',
      '--text-100':'82 30% 20%',
      '--text-200':'70 25% 35%',
      '--text-300':'70 22% 45%',
      '--text-400':'70 20% 55%',
      '--text-500':'70 18% 60%',
      // Borders — sage green.
      '--border-100':'82 22% 60%',
      '--border-200':'82 22% 55%',
      '--border-300':'82 22% 50%',
      '--border-400':'82 22% 45%',
      // Accent — buttercup goldenrod.
      '--accent-000':'48 60% 60%',
      '--accent-100':'48 55% 50%',
      '--accent-200':'48 55% 48%',
      '--accent-900':'48 60% 30%',
      // Pictograms — muted olive.
      '--pictogram-100':'82 25% 40%',
      '--pictogram-200':'82 25% 35%',
      '--pictogram-300':'82 25% 30%',
      '--pictogram-400':'82 25% 25%',
      '--coat-glow':'0 0 12px rgba(200, 168, 58, 0.18)',
      // NOTE: --brand-* intentionally NOT overridden — Claude's clay orange
      // asterisk stays as brand mark against the meadow palette.
    },
    customCss:`
/* Pastoral meadow background — SVG illustration at public/assets/skins/thicc/horses.svg.
   To upgrade to a real photo: drop a JPG at the same path (e.g. horses.jpg) and
   update the url() filename below. Extension must match content type — Chrome
   serves files by extension MIME, so SVG content must be served as .svg and
   raster content as .jpg/.png. The linear-gradient at the bottom of the stack
   paints if the asset 404s (fallback so page never goes blank). */
html[data-theme="claude"][data-mode="dark"] body {
  background:
    url('{{asset:assets/skins/thicc/horses.svg}}') center / cover no-repeat,
    linear-gradient(160deg, #f7f1de 0%, #ede2c2 45%, #c4cf9e 100%) !important;
  background-attachment: fixed !important;
}

/* Cream wash so dark text stays legible over the busiest grass/horse areas. */
html[data-theme="claude"][data-mode="dark"] body::before {
  content: '';
  position: fixed;
  inset: 0;
  pointer-events: none;
  z-index: 0;
  background: linear-gradient(180deg, rgba(247, 241, 222, 0.55) 0%, rgba(237, 226, 194, 0.65) 100%);
}

/* Font override on html so :root variable consumers pick it up.
   !important required because Claude sets these inline on <html>. */
html[data-theme="claude"][data-mode="dark"] {
  --font-claude-response: Georgia, "Times New Roman", serif !important;
  --font-user-message: Georgia, "Times New Roman", serif !important;
}

/* User bubble — cream tint, sage border, soft moss shadow. */
html[data-theme="claude"][data-mode="dark"] [data-user-message-bubble="true"] {
  background: rgba(247, 241, 222, 0.82) !important;
  backdrop-filter: blur(6px) saturate(110%) !important;
  -webkit-backdrop-filter: blur(6px) saturate(110%) !important;
  border: 1px solid rgba(110, 122, 74, 0.38) !important;
  border-radius: 18px !important;
  padding: 14px 18px !important;
  margin: 8px 0 8px auto !important;
  max-width: 75% !important;
  width: fit-content !important;
  box-shadow: 0 4px 16px rgba(110, 122, 74, 0.18) !important;
  font-family: Georgia, "Times New Roman", serif !important;
}

/* AI bubble — outermost-only selector (Aurora v10 lesson). Pale cream, goldenrod border. */
html[data-theme="claude"][data-mode="dark"] .font-claude-response:not(.font-claude-response *) {
  background: rgba(240, 232, 207, 0.88) !important;
  backdrop-filter: blur(6px) saturate(110%) !important;
  -webkit-backdrop-filter: blur(6px) saturate(110%) !important;
  border: 1px solid rgba(200, 168, 58, 0.48) !important;
  border-radius: 18px !important;
  padding: 14px 18px !important;
  margin: 8px auto 8px 0 !important;
  max-width: 75% !important;
  width: fit-content !important;
  box-shadow: 0 4px 16px rgba(110, 122, 74, 0.15) !important;
  font-family: Georgia, "Times New Roman", serif !important;
}

/* DESCENDANT STRIP + OUTER TURN STRIP — shared rules from skin-css-snippets.ts. */
${AI_DESCENDANT_STRIP_RULE}
${OUTER_TURN_STRIP_RULE}
`,
  }),
  s({
    id:'liquid-chrome',
    name:'Liquid Chrome',
    category:'vibrant',
    free:true,
    accent:'#a78bfa',
    accent2:'#67e8f9',
    bg:'linear-gradient(135deg, #c4b5fd 0%, #a5f3fc 35%, #fbcfe8 70%, #ddd6fe 100%)',
    sidebar:'rgba(255,255,255,0.22)',
    border:'rgba(255,255,255,0.35)',
    text:'#1a1a2e',
    textMuted:'#5a5a7a',
    bubbleAi:'rgba(255,255,255,0.65)',
    bubbleUser:'rgba(167,139,250,0.55)',
    bubbleAiRadius:'18px',
    bubbleUserRadius:'18px',
    font:SF,
    emoji:'✨',
    vibe:'iridescent visionOS',
    glassPanels:true,
  }),

  s({
    id:'mecha-v1',
    name:'Terminal Mecha',
    category:'personality',
    free:true,
    // Popup preview swatches (legacy fields). The real engine uses variableOverrides below.
    accent:'#7ee787',
    accent2:'#1f2a28',
    bg:'#0a0e0d',
    sidebar:'#11181a',
    border:'#1f2a28',
    text:'#d4dcd8',
    textMuted:'#6b7775',
    bubbleAi:'#11181a',
    bubbleUser:'#0a0e0d',
    bubbleAiRadius:'4px',
    bubbleUserRadius:'4px',
    font:'ui-monospace, "JetBrains Mono", "IBM Plex Mono", "SF Mono", Menlo, monospace',
    emoji:'',
    vibe:'terminal',
    accentGlow:'0 0 8px rgba(126, 231, 135, 0.25)',
    mascotPath:'assets/skins/mecha/mascot.svg',
    variableOverrides:{
      // Surfaces — deep near-black with subtle blue-green tint (HSL triples per Claude format)
      '--bg-000':'193 21% 9%',
      '--bg-100':'165 17% 5%',
      '--bg-200':'165 17% 4%',
      '--bg-300':'165 17% 4%',
      '--bg-400':'165 17% 3%',
      '--bg-500':'165 17% 3%',
      // Text — warm off-white, NOT pure white
      '--text-000':'150 10% 88%',
      '--text-100':'150 10% 85%',
      '--text-200':'168 8% 70%',
      '--text-300':'168 8% 70%',
      '--text-400':'170 5% 44%',
      '--text-500':'170 5% 44%',
      // Borders — low-contrast slate-teal
      '--border-100':'169 15% 14%',
      '--border-200':'169 15% 14%',
      '--border-300':'169 15% 14%',
      '--border-400':'169 15% 14%',
      // Accent — phosphor green, used sparingly (links, focus, stripe)
      '--accent-000':'125 69% 75%',
      '--accent-100':'125 69% 70%',
      '--accent-200':'125 69% 70%',
      '--accent-900':'125 50% 30%',
      // NOTE: --brand-* and --accent-brand intentionally NOT overridden.
      // Two-tone aesthetic — Claude's clay orange stays as a brand asterisk
      // against the green terminal field. Honest, recognizable, intentional.
      // Pictograms — desaturated icon glyphs
      '--pictogram-100':'168 8% 50%',
      '--pictogram-200':'168 8% 45%',
      '--pictogram-300':'168 8% 40%',
      '--pictogram-400':'168 8% 35%',
      // Override the system mono token so AI/user message overrides below
      // resolve to a real terminal font where available.
      '--font-mono':'ui-monospace, "JetBrains Mono", "IBM Plex Mono", "SF Mono", Menlo, monospace',
      // --coat-glow set for v1.1 hover/focus consumers. No selectors
      // currently consume this in Mecha; wiring up button/input glow is
      // a v1.1 polish item per session decision.
      '--coat-glow':'0 0 8px rgba(126, 231, 135, 0.25)',
    },
    customCss:`
/* Conversation text color override — consumed by CONTENT_EXCLUSION_CSS in
   src/content/injector.ts. Phosphor green to match Mecha's terminal aesthetic. */
:root { --skyn-content-text: #33ff33; }

/* Every rule in this block is prefixed with html[data-theme="claude"][data-mode="dark"]
   so Mecha is invisible when Claude is in light mode. Variable overrides above are
   already scoped via buildClaudeVariableTheme; customCss is emitted raw, so each
   selector must carry its own mode scope explicitly. */

/* Fonts: !important required because Claude sets these inline on <html>
   (style="--font-user-message: ...; --font-claude-response: ...;").
   Inline styles beat any external selector — !important is the only override path. */
html[data-theme="claude"][data-mode="dark"] {
  --font-claude-response: var(--font-mono) !important;
  --font-user-message: var(--font-mono) !important;
}

/* User-bubble accent stripe — refined 2px, soft phosphor glow */
html[data-theme="claude"][data-mode="dark"] [data-user-message-bubble="true"] {
  border-left: 2px solid hsl(var(--accent-100));
  box-shadow: 0 0 8px hsl(var(--accent-100) / 0.25);
}

/* CRT scanline overlay — 2.5% opacity, fixed full-viewport */
html[data-theme="claude"][data-mode="dark"] body::before {
  content: '';
  position: fixed;
  inset: 0;
  pointer-events: none;
  z-index: 9999;
  background: repeating-linear-gradient(
    180deg,
    transparent 0,
    transparent 2px,
    hsl(var(--accent-100) / 0.025) 2px,
    hsl(var(--accent-100) / 0.025) 3px
  );
}
`,
  }),

  s({
    id:'aurora-glass',
    name:'Aurora Glass',
    category:'special',
    free:true,
    // Popup preview swatches (legacy fields). The real engine uses variableOverrides below.
    accent:'#d4af6a',           // gold
    accent2:'#a48cc6',          // lavender (one of the four accent dots)
    bg:'#0e0820',               // deep cosmic
    sidebar:'#0a0518',
    border:'#d4af6a',
    text:'#f0e6d2',             // cream/parchment
    bubbleAi:'#1a1335',
    bubbleUser:'#2d1b4e',
    bubbleAiRadius:'18px',
    bubbleUserRadius:'18px',
    font:'"EB Garamond", "Cormorant Garamond", Georgia, "Times New Roman", serif',
    emoji:'✨',
    vibe:'Cosmic & airy',
    accentGlow:'0 0 12px rgba(212, 175, 106, 0.2)',
    mascotPath:'assets/skins/aurora-glass/mascot.svg',
    variableOverrides:{
      // Surfaces — deep cosmic blue-purple base. HSL triples per Claude format.
      '--bg-000':'255 60% 8%',
      '--bg-100':'252 50% 5%',
      '--bg-200':'262 47% 5%',
      '--bg-300':'262 47% 4%',
      '--bg-400':'262 37% 4%',
      '--bg-500':'262 37% 3%',
      // Text — cream/parchment, warm not cold.
      '--text-000':'42 50% 88%',
      '--text-100':'42 50% 85%',
      '--text-200':'42 30% 70%',
      '--text-300':'42 30% 65%',
      '--text-400':'42 20% 50%',
      '--text-500':'42 20% 45%',
      // Borders — dim gold for any consumer that reads --border-*.
      // Real translucent gold borders are applied per-element in customCss
      // via rgba() since variableOverrides values are HSL triples and
      // can't express alpha cleanly.
      '--border-100':'39 51% 30%',
      '--border-200':'39 51% 30%',
      '--border-300':'39 51% 25%',
      '--border-400':'39 51% 25%',
      // Accent — gold #d4af6a in HSL (~39 51% 62%). Links, focus rings, etc.
      '--accent-000':'39 51% 70%',
      '--accent-100':'39 51% 62%',
      '--accent-200':'39 51% 62%',
      '--accent-900':'39 51% 35%',
      // Pictograms — muted cream/gold for icon glyphs.
      '--pictogram-100':'42 25% 55%',
      '--pictogram-200':'42 25% 50%',
      '--pictogram-300':'42 25% 45%',
      '--pictogram-400':'42 25% 40%',
      // --coat-glow for any consumer that reads it; matches the gold
      // glow in customCss bubble/button hover states.
      '--coat-glow':'0 0 12px rgba(212, 175, 106, 0.2)',
      // NOTE: --brand-* and --accent-brand intentionally NOT overridden.
      // Claude's clay orange asterisk stays as a brand mark against the
      // gold/cosmic field — same two-tone rationale as Mecha.
    },
    customCss:`
/* Conversation text color override — consumed by CONTENT_EXCLUSION_CSS in
   src/content/injector.ts. Light value because Aurora Glass is a dark skin. */
:root { --skyn-content-text: #ebebeb; }

/* Every rule prefixed with html[data-theme="claude"][data-mode="dark"] so
   Aurora Glass is invisible when Claude is in light mode. variableOverrides
   above are already scoped via buildClaudeVariableTheme; customCss is emitted
   raw, so each selector must carry its own mode scope explicitly. */

/* Galaxy background: full-bleed galaxy.jpg from public/assets/skins/aurora-glass/.
   Resolved at runtime via the {{asset:<path>}} placeholder in resolveCustomCss
   (chrome.runtime.getURL → chrome-extension://<id>/...). If galaxy.jpg is
   missing from dist/ (404), the linear-gradient at the bottom of the
   background stack paints as a graceful fallback so the page is never blank.
   background-attachment: fixed keeps the image stable while content scrolls. */
html[data-theme="claude"][data-mode="dark"] body {
  background:
    url('{{asset:assets/skins/aurora-glass/galaxy.jpg}}') center / cover no-repeat,
    linear-gradient(135deg, #0a0518 0%, #1a1335 35%, #2d1b4e 70%, #0e0820 100%) !important;
  background-attachment: fixed !important;
}

/* Backdrop dim — soft purple-black wash over the galaxy so bubbles read
   without competing against the brightest nebula regions. */
html[data-theme="claude"][data-mode="dark"] body::before {
  content: '';
  position: fixed;
  inset: 0;
  pointer-events: none;
  z-index: 0;
  background: linear-gradient(180deg, rgba(10, 5, 24, 0.35) 0%, rgba(14, 8, 32, 0.45) 100%);
}

/* Fonts: !important required because Claude sets these inline on <html>
   (style="--font-user-message: ...; --font-claude-response: ...;").
   Inline beats any external selector — !important is the only override path. */
html[data-theme="claude"][data-mode="dark"] {
  --font-claude-response: "EB Garamond", "Cormorant Garamond", Georgia, "Times New Roman", serif !important;
  --font-user-message: "EB Garamond", "Cormorant Garamond", Georgia, "Times New Roman", serif !important;
}

/* Chat-title italic-serif treatment (ornate heading from reference).
   Tightened in v8: previous selectors header h1 and header h2 could
   match content-area headings inside AI responses (Claude sometimes
   renders h2 inline for response section labels), giving them gold
   italic serif treatment that read as a secondary bubble. Now scoped
   to specifically the conversation header — must be inside header
   element AND not inside a font-claude-response (the AI message
   wrapper). */
html[data-theme="claude"][data-mode="dark"] [data-testid="conversation-title"],
html[data-theme="claude"][data-mode="dark"] [data-testid="chat-title"],
html[data-theme="claude"][data-mode="dark"] [data-testid="conversation-header"] h1,
html[data-theme="claude"][data-mode="dark"] [data-testid="conversation-header"] button,
html[data-theme="claude"][data-mode="dark"] [data-testid*="conversation-title" i],
html[data-theme="claude"][data-mode="dark"] header > h1:not([class*="font-claude-response"] *),
html[data-theme="claude"][data-mode="dark"] header > button[aria-haspopup],
html[data-theme="claude"][data-mode="dark"] main > header h1,
html[data-theme="claude"][data-mode="dark"] main > header button[aria-haspopup] {
  font-style: italic !important;
  font-family: "EB Garamond", "Cormorant Garamond", Georgia, serif !important;
  letter-spacing: 0.02em !important;
  color: #d4af6a !important;
  font-weight: 400 !important;
}

/* User-message bubble — translucent dark, blurred backdrop, thin gold border.
   Aligned RIGHT (margin-left: auto), max-width 75% so it doesn't fill the
   whole conversation width. font-family applied explicitly here because
   Claude's --font-user-message override at <html> doesn't always propagate
   to the bubble (verified 2026-05-13 probe: bubble computed Anthropic Sans
   despite the var being EB Garamond on <html>). */
html[data-theme="claude"][data-mode="dark"] [data-user-message-bubble="true"] {
  background: rgba(14, 8, 32, 0.55) !important;
  backdrop-filter: blur(8px) saturate(140%) !important;
  -webkit-backdrop-filter: blur(8px) saturate(140%) !important;
  border: 1px solid rgba(212, 175, 106, 0.4) !important;
  border-radius: 18px !important;
  padding: 14px 18px !important;
  margin: 8px 0 8px auto !important;
  max-width: 75% !important;
  width: fit-content !important;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.3), inset 0 1px 0 rgba(255, 255, 255, 0.05) !important;
  font-family: "EB Garamond", "Cormorant Garamond", Georgia, "Times New Roman", serif !important;
  transition: box-shadow 200ms ease, border-color 200ms ease !important;
}


/* User-bubble hover — gold glow intensifies, border brightens. */
html[data-theme="claude"][data-mode="dark"] [data-user-message-bubble="true"]:hover {
  box-shadow: 0 0 16px rgba(212, 175, 106, 0.25), 0 4px 16px rgba(0, 0, 0, 0.3) !important;
  border-color: rgba(212, 175, 106, 0.6) !important;
}

/* AI bubble — Aurora Glass v10: surgical outermost-only selector.
   Previously [class*="font-claude-response" i] (substring matcher)
   could match at multiple nesting levels when Claude renders
   multi-chunk responses with nested wrappers — producing the
   double-bubble visual Anthony saw. Switched to
   .font-claude-response:not(.font-claude-response *) which matches
   ONLY elements with that exact class that are NOT descendants of
   another font-claude-response. Same surgical fix proven on Aura
   Glassmorphism v3 (see docs/aura-glassmorphism-v12-reference.md
   for the technique writeup). Descendant-strip rule below stays
   in place as belt-and-suspenders for any bubble-like visuals
   nested inside the outer wrapper. */
html[data-theme="claude"][data-mode="dark"] .font-claude-response:not(.font-claude-response *) {
  background: rgba(14, 8, 32, 0.55) !important;
  backdrop-filter: blur(8px) saturate(140%) !important;
  -webkit-backdrop-filter: blur(8px) saturate(140%) !important;
  border: 1px solid rgba(212, 175, 106, 0.4) !important;
  border-radius: 18px !important;
  padding: 14px 18px !important;
  margin: 8px auto 8px 0 !important;
  max-width: 75% !important;
  width: fit-content !important;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.3) !important;
  font-family: "EB Garamond", "Cormorant Garamond", Georgia, "Times New Roman", serif !important;
}

/* DESCENDANT STRIP — shared rule from skin-css-snippets.ts.
   See AI_DESCENDANT_STRIP_RULE there for the full writeup. Strips
   nested bubble visuals from AI wrapper descendants, preserves
   pre/code so Claude code blocks survive. */
${AI_DESCENDANT_STRIP_RULE}

/* Strip bubble/border/background from OUTER turn wrappers. Kills the
   extra lining outside both user and AI bubbles (was caused by
   data-test-render-count and main > article matching every turn
   outer wrapper, not just AI-only). The wrapper becomes an invisible
   container; the actual bubble (user-message-bubble or the inner AI
   content rule above) provides the visible frame. */
${OUTER_TURN_STRIP_RULE}


/* Composer panel — match bubble glass style (gold border + dark glass).
   Previously [data-testid="chat-input-area"] / [data-testid="composer"]
   which never matched on current Claude DOM (same staleness Aura
   Glassmorphism hit before its v7 fix). Switched to the verified
   class fingerprint [class~="bg-bg-000"][class~="rounded-[20px]"] —
   matches the dark composer rectangle on BOTH chat-thread and
   new-chat layouts, no ancestor required. See
   docs/aura-glassmorphism-v12-reference.md for the technique
   writeup. Same gold border + dark fill + backdrop-blur as the
   Aurora Glass bubbles. */
html[data-theme="claude"][data-mode="dark"] [class~="bg-bg-000"][class~="rounded-[20px]"] {
  background: rgba(14, 8, 32, 0.55) !important;
  backdrop-filter: blur(8px) saturate(140%) !important;
  -webkit-backdrop-filter: blur(8px) saturate(140%) !important;
  border: 1px solid rgba(212, 175, 106, 0.4) !important;
  border-radius: 20px !important;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.3) !important;
}

/* Sidebar — dark cosmic with gold border. The first 13 selector candidates
   from the 2026-05-13 fix did not hit (sidebarCount still 0 in probe),
   meaning Claude's current sidebar container exposes none of [data-testid=
   "sidebar"|"sidebar-menu"|"navigation-sidebar"|"conversation-list"|...]
   nor any nav/aside with chat-themed aria-labels. The expanded net here
   adds: more data-testid candidates, attribute-substring matches via the
   case-insensitive i flag, [role="navigation"] / [role="complementary"]
   semantic roles, common class-substring conventions (Sidebar, NavRail,
   LeftRail, Drawer, LeftNav), and — most importantly — :has() shots that
   target a parent <aside>/<nav>/<div> based on the presence of a
   sidebar-only landmark inside (the "New chat" button, the recents list
   heading). :has() is supported in Chrome 105+, our build target is 114+. */
html[data-theme="claude"][data-mode="dark"] [data-testid="sidebar"],
html[data-theme="claude"][data-mode="dark"] [data-testid="sidebar-menu"],
html[data-theme="claude"][data-mode="dark"] [data-testid="navigation-sidebar"],
html[data-theme="claude"][data-mode="dark"] [data-testid="conversation-list"],
html[data-theme="claude"][data-mode="dark"] [data-testid="chat-history"],
html[data-theme="claude"][data-mode="dark"] [data-testid="app-sidebar"],
html[data-theme="claude"][data-mode="dark"] [data-testid="layout-sidebar"],
html[data-theme="claude"][data-mode="dark"] [data-testid="left-rail"],
html[data-theme="claude"][data-mode="dark"] [data-testid*="sidebar" i],
html[data-theme="claude"][data-mode="dark"] [data-testid*="drawer" i],
html[data-theme="claude"][data-mode="dark"] [data-testid*="aside" i],
html[data-theme="claude"][data-mode="dark"] nav[aria-label*="chat" i],
html[data-theme="claude"][data-mode="dark"] nav[aria-label*="conversation" i],
html[data-theme="claude"][data-mode="dark"] nav[aria-label*="recent" i],
html[data-theme="claude"][data-mode="dark"] nav[aria-label*="navigation" i],
html[data-theme="claude"][data-mode="dark"] aside[aria-label*="chat" i],
html[data-theme="claude"][data-mode="dark"] aside[aria-label*="navigation" i],
html[data-theme="claude"][data-mode="dark"] aside[aria-label*="recent" i],
html[data-theme="claude"][data-mode="dark"] [role="complementary"],
html[data-theme="claude"][data-mode="dark"] [class*="sidebar" i],
html[data-theme="claude"][data-mode="dark"] [class*="leftrail" i],
html[data-theme="claude"][data-mode="dark"] [class*="left-rail" i],
html[data-theme="claude"][data-mode="dark"] [class*="navrail" i],
html[data-theme="claude"][data-mode="dark"] [class*="nav-rail" i],
html[data-theme="claude"][data-mode="dark"] [class*="leftnav" i],
html[data-theme="claude"][data-mode="dark"] aside:has(button[aria-label*="new chat" i]),
html[data-theme="claude"][data-mode="dark"] aside:has([aria-label*="new chat" i]),
html[data-theme="claude"][data-mode="dark"] aside:has(a[href*="/chat/"]),
html[data-theme="claude"][data-mode="dark"] nav:has(button[aria-label*="new chat" i]),
html[data-theme="claude"][data-mode="dark"] nav:has([aria-label*="new chat" i]),
html[data-theme="claude"][data-mode="dark"] nav:has(a[href*="/chat/"]) {
  background: rgba(10, 5, 24, 0.7) !important;
  backdrop-filter: blur(8px) !important;
  -webkit-backdrop-filter: blur(8px) !important;
  border-right: 1px solid rgba(212, 175, 106, 0.25) !important;
}

/* Sidebar entries — thin gold dividers between chat items. Same wide
   selector net as the container rule above. */
html[data-theme="claude"][data-mode="dark"] [data-testid="sidebar"] a,
html[data-theme="claude"][data-mode="dark"] [data-testid="sidebar-menu"] a,
html[data-theme="claude"][data-mode="dark"] [data-testid="conversation-list"] a,
html[data-theme="claude"][data-mode="dark"] [data-testid="chat-history"] a,
html[data-theme="claude"][data-mode="dark"] nav[aria-label*="chat" i] a,
html[data-theme="claude"][data-mode="dark"] nav[aria-label*="conversation" i] a,
html[data-theme="claude"][data-mode="dark"] nav[aria-label*="recent" i] a,
html[data-theme="claude"][data-mode="dark"] aside[aria-label*="chat" i] a,
html[data-theme="claude"][data-mode="dark"] [class*="sidebar" i] a,
html[data-theme="claude"][data-mode="dark"] [class*="Sidebar"] a {
  border-bottom: 1px solid rgba(212, 175, 106, 0.1) !important;
}

/* All text inside the sidebar inherits the EB Garamond serif. The :has()
   anchor selectors here mirror the sidebar container rule so we apply
   typography to whatever element ended up matching. The * descendant
   selector hits text nodes; SVG icons are unaffected (no font-family
   applies to SVG glyph rendering). */
html[data-theme="claude"][data-mode="dark"] aside:has(button[aria-label*="new chat" i]) *,
html[data-theme="claude"][data-mode="dark"] aside:has(a[href*="/chat/"]) *,
html[data-theme="claude"][data-mode="dark"] nav:has(button[aria-label*="new chat" i]) *,
html[data-theme="claude"][data-mode="dark"] nav:has(a[href*="/chat/"]) *,
html[data-theme="claude"][data-mode="dark"] [data-testid="sidebar"] *,
html[data-theme="claude"][data-mode="dark"] [data-testid*="sidebar" i] *,
html[data-theme="claude"][data-mode="dark"] [class*="sidebar" i] *,
html[data-theme="claude"][data-mode="dark"] [role="complementary"] * {
  font-family: "EB Garamond", "Cormorant Garamond", Georgia, "Times New Roman", serif !important;
}

/* Sidebar wordmark (the "Claude" / "CLAUDE" heading at the very top
   of the sidebar). Italic gold serif uppercase to match the reference's
   ornate brand treatment. Targets h1/h2 and any element classed/testid'd
   as a logo/brand inside the sidebar. */
html[data-theme="claude"][data-mode="dark"] aside:has(a[href*="/chat/"]) h1,
html[data-theme="claude"][data-mode="dark"] aside:has(a[href*="/chat/"]) h2,
html[data-theme="claude"][data-mode="dark"] nav:has(a[href*="/chat/"]) h1,
html[data-theme="claude"][data-mode="dark"] nav:has(a[href*="/chat/"]) h2,
html[data-theme="claude"][data-mode="dark"] [data-testid="sidebar"] h1,
html[data-theme="claude"][data-mode="dark"] [data-testid*="sidebar" i] h1,
html[data-theme="claude"][data-mode="dark"] [class*="sidebar" i] h1,
html[data-theme="claude"][data-mode="dark"] [role="complementary"] h1,
html[data-theme="claude"][data-mode="dark"] aside [class*="logo" i],
html[data-theme="claude"][data-mode="dark"] aside [class*="brand" i],
html[data-theme="claude"][data-mode="dark"] aside [class*="wordmark" i] {
  font-family: "EB Garamond", "Cormorant Garamond", Georgia, serif !important;
  font-style: italic !important;
  font-weight: 400 !important;
  color: #d4af6a !important;
  letter-spacing: 0.08em !important;
  text-transform: uppercase !important;
}

/* Sidebar section headings ("Recents", etc.) — gold serif small caps. */
html[data-theme="claude"][data-mode="dark"] aside:has(a[href*="/chat/"]) h3,
html[data-theme="claude"][data-mode="dark"] aside:has(a[href*="/chat/"]) h4,
html[data-theme="claude"][data-mode="dark"] aside:has(a[href*="/chat/"]) [class*="heading" i],
html[data-theme="claude"][data-mode="dark"] aside:has(a[href*="/chat/"]) [class*="section-title" i],
html[data-theme="claude"][data-mode="dark"] nav:has(a[href*="/chat/"]) h3,
html[data-theme="claude"][data-mode="dark"] nav:has(a[href*="/chat/"]) h4,
html[data-theme="claude"][data-mode="dark"] [data-testid="sidebar"] h3,
html[data-theme="claude"][data-mode="dark"] [data-testid*="sidebar" i] h3,
html[data-theme="claude"][data-mode="dark"] [class*="sidebar" i] h3 {
  font-family: "EB Garamond", "Cormorant Garamond", Georgia, serif !important;
  font-style: italic !important;
  color: #d4af6a !important;
  letter-spacing: 0.1em !important;
  text-transform: uppercase !important;
  font-size: 0.7em !important;
  font-weight: 500 !important;
  opacity: 0.85 !important;
}

/* Active sidebar conversation — gold left-border accent + soft gold tint. */
html[data-theme="claude"][data-mode="dark"] [data-testid="sidebar"] a[aria-current="page"],
html[data-theme="claude"][data-mode="dark"] [data-testid="sidebar"] a[data-active="true"],
html[data-theme="claude"][data-mode="dark"] [data-testid="sidebar-menu"] a[aria-current="page"],
html[data-theme="claude"][data-mode="dark"] [data-testid="conversation-list"] a[aria-current="page"],
html[data-theme="claude"][data-mode="dark"] [data-testid="chat-history"] a[aria-current="page"],
html[data-theme="claude"][data-mode="dark"] nav[aria-label*="chat" i] a[aria-current="page"],
html[data-theme="claude"][data-mode="dark"] nav[aria-label*="conversation" i] a[aria-current="page"],
html[data-theme="claude"][data-mode="dark"] nav[aria-label*="recent" i] a[aria-current="page"],
html[data-theme="claude"][data-mode="dark"] aside[aria-label*="chat" i] a[aria-current="page"],
html[data-theme="claude"][data-mode="dark"] [class*="sidebar" i] a[aria-current="page"],
html[data-theme="claude"][data-mode="dark"] [class*="Sidebar"] a[aria-current="page"] {
  background: rgba(212, 175, 106, 0.15) !important;
  border-left: 2px solid #d4af6a !important;
}

/* Send button — circular gold outline, cream arrow, gold hover glow.
   Selector net is wide because Claude's send button has used different
   labels/testids across versions: Send / Send message / Submit /
   send-button. The fire-icon variant (when streaming) is intentionally
   not styled — leave Claude's stop-button affordance visible. */
html[data-theme="claude"][data-mode="dark"] button[aria-label*="Send" i],
html[data-theme="claude"][data-mode="dark"] button[aria-label*="Submit" i],
html[data-theme="claude"][data-mode="dark"] [data-testid="send-button"],
html[data-theme="claude"][data-mode="dark"] [data-testid="send-message-button"],
html[data-theme="claude"][data-mode="dark"] [data-testid*="send" i]:not([data-testid*="setting" i]):not([data-testid*="cancel" i]),
html[data-theme="claude"][data-mode="dark"] form button[type="submit"]:not([aria-label*="cancel" i]) {
  background: transparent !important;
  border: 1px solid rgba(212, 175, 106, 0.6) !important;
  border-radius: 50% !important;
  color: #f0e6d2 !important;
  transition: box-shadow 200ms ease, background 200ms ease !important;
}

html[data-theme="claude"][data-mode="dark"] button[aria-label*="Send" i]:hover,
html[data-theme="claude"][data-mode="dark"] button[aria-label*="Submit" i]:hover,
html[data-theme="claude"][data-mode="dark"] [data-testid="send-button"]:hover,
html[data-theme="claude"][data-mode="dark"] [data-testid="send-message-button"]:hover,
html[data-theme="claude"][data-mode="dark"] [data-testid*="send" i]:not([data-testid*="setting" i]):not([data-testid*="cancel" i]):hover,
html[data-theme="claude"][data-mode="dark"] form button[type="submit"]:not([aria-label*="cancel" i]):hover {
  background: rgba(212, 175, 106, 0.15) !important;
  box-shadow: 0 0 12px rgba(212, 175, 106, 0.3) !important;
}
`,
  }),

  s({
    id:'aura-glass',
    name:'Aura Glassmorphism',
    category:'special',
    free:true,
    // Popup preview swatches (legacy fields). The real engine uses variableOverrides + customCss below.
    accent:'#a855f7',           // purple
    accent2:'#ec4899',          // pink (the iridescent gradient runs pink → purple → blue)
    bg:'#1a1a2e',               // neutral dark for swatch (real bg is the boot-nyc photo)
    sidebar:'rgba(255,255,255,0.06)',
    border:'#a855f7',
    text:'#f8fafc',             // near-white for contrast against the photo
    bubbleAi:'rgba(255,255,255,0.08)',
    bubbleUser:'rgba(255,255,255,0.08)',
    bubbleAiRadius:'20px',
    bubbleUserRadius:'20px',
    font:'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
    emoji:'🌆',
    vibe:'Iridescent urban',
    accentGlow:'0 4px 24px rgba(168, 85, 247, 0.25)',
    variableOverrides:{
      // Surfaces — neutral dark (the photo background carries the visual identity).
      // Kept moderately transparent-tolerant so backdrop-filter blurs through.
      '--bg-000':'230 25% 12%',
      '--bg-100':'230 25% 10%',
      '--bg-200':'230 25% 9%',
      '--bg-300':'230 25% 8%',
      '--bg-400':'230 25% 7%',
      '--bg-500':'230 25% 6%',
      // Text — light/near-white for contrast against the busy photo backdrop.
      '--text-000':'210 20% 96%',
      '--text-100':'210 20% 92%',
      '--text-200':'210 15% 80%',
      '--text-300':'210 15% 72%',
      '--text-400':'210 12% 60%',
      '--text-500':'210 12% 50%',
      // Borders — neutral light for any consumer; iridescent borders applied
      // per-element via the gradient-border trick in customCss.
      '--border-100':'270 25% 35%',
      '--border-200':'270 25% 35%',
      '--border-300':'270 25% 30%',
      '--border-400':'270 25% 30%',
      // Accent — purple/violet (the middle of the iridescent gradient).
      '--accent-000':'270 91% 75%',
      '--accent-100':'270 91% 65%',
      '--accent-200':'270 91% 65%',
      '--accent-900':'270 60% 35%',
      // Pictograms — soft cool grey for icon glyphs.
      '--pictogram-100':'220 15% 70%',
      '--pictogram-200':'220 15% 65%',
      '--pictogram-300':'220 15% 60%',
      '--pictogram-400':'220 15% 55%',
      '--coat-glow':'0 4px 24px rgba(168, 85, 247, 0.25)',
      // NOTE: --brand-* and --accent-brand intentionally NOT overridden.
      // Claude clay orange asterisk preserved as a brand mark — same
      // two-tone rationale as Mecha and Aurora Glass.
    },
    customCss:`
/* Conversation text color override — consumed by CONTENT_EXCLUSION_CSS in
   src/content/injector.ts. Light value because Aura Glass is a dark skin. */
:root { --skyn-content-text: #ebebeb; }

/* All rules prefixed with html[data-theme="claude"][data-mode="dark"] so
   Aura Glass is invisible in light mode. */

/* Background: NYC street photo (boot in foreground, city behind).
   Asset path resolved at runtime via the {{asset:...}} placeholder
   added to resolveCustomCss in src/content/injector.ts. Tries .jpg
   first, then .png as fallback (so Anthony doesn't have to worry
   about exact extension when saving from a browser). If both are
   missing from dist, the linear-gradient at the bottom of the stack
   paints. CSS layer order: first url paints on top, then second,
   then gradient at bottom — failed url() loads are treated as empty
   layers so subsequent ones show through. background-attachment:
   fixed keeps the photo stable while content scrolls. */
html[data-theme="claude"][data-mode="dark"] body {
  background:
    url('{{asset:assets/skins/aura-glass/boot-nyc.jpg}}') center / cover no-repeat,
    url('{{asset:assets/skins/aura-glass/boot-nyc.png}}') center / cover no-repeat,
    linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%) !important;
  background-attachment: fixed !important;
}

/* Soft dim overlay for bubble readability against the busy photo.
   Lighter than Aurora Glass overlay so the cityscape stays vibrant. */
html[data-theme="claude"][data-mode="dark"] body::before {
  content: '';
  position: fixed;
  inset: 0;
  pointer-events: none;
  z-index: 0;
  background: linear-gradient(180deg, rgba(0, 0, 0, 0.18) 0%, rgba(0, 0, 0, 0.32) 100%);
}

/* Font swap — clean modern sans for the Aura aesthetic (vs Aurora's serif).
   !important required because Claude sets these inline on <html>. */
html[data-theme="claude"][data-mode="dark"] {
  --font-claude-response: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif !important;
  --font-user-message: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif !important;
}

/* IRIDESCENT BUBBLE — v2 of the bubble technique.

   v1 used the double-gradient background-clip trick. Problem: the
   bottom gradient layer (border-box) paints in the entire border-box
   area, INCLUDING the padding region. The top gradient layer
   (padding-box) is rgba(255,255,255,0.10) — too transparent to mask
   the iridescent gradient bleeding through. Visual result: the whole
   bubble looks like a solid iridescent gradient, not a glass center
   with iridescent border.

   v2 uses the standard CSS gradient-border trick: pseudo-element
   ::before positioned over the bubble with the iridescent gradient
   as its background, then mask-composite to cut out the inner
   content area, leaving the gradient visible only in a 2px ring.
   The bubble itself has a TRULY transparent / very translucent fill,
   so backdrop-filter blurs the page background through the glass.

   Two backdrop-filter quirks to know:
   - backdrop-filter doesn't apply through pseudo-elements; it has
     to be on the bubble itself.
   - The mask technique requires both -webkit-mask-composite:xor
     and mask-composite:exclude for cross-browser. Chrome 105+
     supports both (build target Chrome 114+). */

/* User bubble — right-aligned, frosted glass with iridescent gradient border. */
html[data-theme="claude"][data-mode="dark"] [data-user-message-bubble="true"] {
  position: relative !important;
  background: rgba(255, 255, 255, 0.06) !important;
  backdrop-filter: blur(20px) saturate(180%) !important;
  -webkit-backdrop-filter: blur(20px) saturate(180%) !important;
  border: none !important;
  border-radius: 22px !important;
  padding: 14px 20px !important;
  margin: 8px 0 8px auto !important;
  max-width: 75% !important;
  width: fit-content !important;
  color: #f8fafc !important;
  box-shadow:
    0 4px 24px rgba(168, 85, 247, 0.20),
    0 0 12px rgba(236, 72, 153, 0.10) !important;
  font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif !important;
}

html[data-theme="claude"][data-mode="dark"] [data-user-message-bubble="true"]::before {
  content: '' !important;
  position: absolute !important;
  inset: 0 !important;
  border-radius: inherit !important;
  padding: 2px !important;
  background: linear-gradient(135deg, #ec4899 0%, #a855f7 50%, #3b82f6 100%) !important;
  -webkit-mask:
    linear-gradient(#fff 0 0) content-box,
    linear-gradient(#fff 0 0) !important;
  -webkit-mask-composite: xor !important;
  mask:
    linear-gradient(#fff 0 0) content-box,
    linear-gradient(#fff 0 0) !important;
  mask-composite: exclude !important;
  pointer-events: none !important;
}

/* AI bubble — left-aligned, frosted glass + iridescent border.
   v3 change: switched from [class*="font-claude-response" i] substring
   matcher to .font-claude-response:not(.font-claude-response *) which
   matches ONLY outermost font-claude-response elements (excludes any
   element that is a descendant of another font-claude-response). This
   eliminates the nested-bubble issue Anthony saw in v2 when Claude
   rendered multi-chunk responses with nested wrappers — the outer
   gets the bubble, any inner ones do not. */
html[data-theme="claude"][data-mode="dark"] .font-claude-response:not(.font-claude-response *) {
  position: relative !important;
  background: rgba(255, 255, 255, 0.06) !important;
  backdrop-filter: blur(20px) saturate(180%) !important;
  -webkit-backdrop-filter: blur(20px) saturate(180%) !important;
  border: none !important;
  border-radius: 22px !important;
  padding: 14px 20px !important;
  margin: 8px auto 8px 0 !important;
  max-width: 75% !important;
  width: fit-content !important;
  color: #f8fafc !important;
  box-shadow:
    0 4px 24px rgba(168, 85, 247, 0.20),
    0 0 12px rgba(236, 72, 153, 0.10) !important;
  font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif !important;
}

html[data-theme="claude"][data-mode="dark"] .font-claude-response:not(.font-claude-response *)::before {
  content: '' !important;
  position: absolute !important;
  inset: 0 !important;
  border-radius: inherit !important;
  padding: 2px !important;
  background: linear-gradient(135deg, #ec4899 0%, #a855f7 50%, #3b82f6 100%) !important;
  -webkit-mask:
    linear-gradient(#fff 0 0) content-box,
    linear-gradient(#fff 0 0) !important;
  -webkit-mask-composite: xor !important;
  mask:
    linear-gradient(#fff 0 0) content-box,
    linear-gradient(#fff 0 0) !important;
  mask-composite: exclude !important;
  pointer-events: none !important;
}

/* Strip rules — shared from skin-css-snippets.ts. */
${AI_DESCENDANT_STRIP_RULE}
${OUTER_TURN_STRIP_RULE}

/* New-chat greeting — v11. v10 fixed the selector (was targeting
   h1/h2 when the greeting is actually a div) but introduced two
   issues:
     1. The * descendant rule was forcing color: white on the
        Claude brand asterisk SVG too — Anthony wants it back to
        native orange.
     2. font-weight: 700 was MY override, not Claude default.
        Anthony wants the default weight.
   v11 changes:
     - Drop font-weight override (inherit Claude's native ~400).
     - font-family: Didot → Bodoni 72 → Times New Roman serif stack.
       Didot is the Vogue/magazine face (also on every Mac);
       Times New Roman is the literal NYT fallback. Both feel
       unmistakably New York and pair with the boot/cityscape photo.
     - Descendant rule excludes svg, svg children, and any element
       with "brand" or "accent-brand" in its class string. The
       Claude asterisk SVG keeps its native --brand-200 orange. */
html[data-theme="claude"][data-mode="dark"] main > div.transition-opacity.duration-300:not(:has([contenteditable])):not(:has(textarea)),
html[data-theme="claude"][data-mode="dark"] main > div.transition-opacity.duration-300:not(:has([contenteditable])):not(:has(textarea)) *:not(svg):not(svg *):not([class*="brand"]):not([class*="accent-brand"]) {
  color: #ffffff !important;
  opacity: 1 !important;
  font-family: "Snell Roundhand", "Apple Chancery", "Brush Script MT", "Lucida Handwriting", "Segoe Script", cursive !important;
  text-shadow:
    0 1px 2px rgba(0, 0, 0, 0.95),
    0 2px 8px rgba(0, 0, 0, 0.85),
    0 4px 24px rgba(0, 0, 0, 0.7),
    0 0 40px rgba(168, 85, 247, 0.7),
    0 0 60px rgba(236, 72, 153, 0.5) !important;
}

/* Composer — transparent fill + iridescent gradient border, on
   BOTH the chat-thread layout and the new-chat layout.

   v6 anchored to [data-chat-input-container="true"] .bg-bg-000 which
   only matched the chat-thread layout (the data-chat-input-container
   wrapper does not exist on the /new screen — composer there sits
   directly inside <main>). DOM survey 2026-05-13 confirmed both
   layouts use the same exact class combination on the dark rectangle:
   bg-bg-000 + rounded-[20px] together. v7 targets by that class
   combo instead, no ancestor required — works on both pages.

   [class~="..."] attribute selectors match exact words in the class
   list. The brackets inside "rounded-[20px]" are literal characters
   in the quoted value (no CSS escaping needed). */
html[data-theme="claude"][data-mode="dark"] [class~="bg-bg-000"][class~="rounded-[20px]"] {
  position: relative !important;
  background: transparent !important;
  border: none !important;
  box-shadow: none !important;
}

html[data-theme="claude"][data-mode="dark"] [class~="bg-bg-000"][class~="rounded-[20px]"]::before {
  content: '' !important;
  position: absolute !important;
  inset: 0 !important;
  border-radius: inherit !important;
  padding: 2px !important;
  background: linear-gradient(135deg, #ec4899 0%, #a855f7 50%, #3b82f6 100%) !important;
  -webkit-mask:
    linear-gradient(#fff 0 0) content-box,
    linear-gradient(#fff 0 0) !important;
  -webkit-mask-composite: xor !important;
  mask:
    linear-gradient(#fff 0 0) content-box,
    linear-gradient(#fff 0 0) !important;
  mask-composite: exclude !important;
  pointer-events: none !important;
}

/* Sidebar — heavy frosted glass with iridescent right edge.
   Wide selector net same as Aurora Glass — at least one branch
   should hit Claude current sidebar container. */
html[data-theme="claude"][data-mode="dark"] [data-testid="sidebar"],
html[data-theme="claude"][data-mode="dark"] [data-testid="sidebar-menu"],
html[data-theme="claude"][data-mode="dark"] [data-testid="navigation-sidebar"],
html[data-theme="claude"][data-mode="dark"] [data-testid="conversation-list"],
html[data-theme="claude"][data-mode="dark"] [data-testid="chat-history"],
html[data-theme="claude"][data-mode="dark"] [data-testid*="sidebar" i],
html[data-theme="claude"][data-mode="dark"] nav[aria-label*="chat" i],
html[data-theme="claude"][data-mode="dark"] nav[aria-label*="conversation" i],
html[data-theme="claude"][data-mode="dark"] nav[aria-label*="recent" i],
html[data-theme="claude"][data-mode="dark"] aside[aria-label*="chat" i],
html[data-theme="claude"][data-mode="dark"] [role="complementary"],
html[data-theme="claude"][data-mode="dark"] [class*="sidebar" i],
html[data-theme="claude"][data-mode="dark"] aside:has(button[aria-label*="new chat" i]),
html[data-theme="claude"][data-mode="dark"] aside:has(a[href*="/chat/"]),
html[data-theme="claude"][data-mode="dark"] nav:has(button[aria-label*="new chat" i]),
html[data-theme="claude"][data-mode="dark"] nav:has(a[href*="/chat/"]) {
  background: rgba(20, 20, 35, 0.45) !important;
  backdrop-filter: blur(28px) saturate(180%) !important;
  -webkit-backdrop-filter: blur(28px) saturate(180%) !important;
  border-right: 2px solid transparent !important;
  border-image: linear-gradient(180deg, #ec4899 0%, #a855f7 50%, #3b82f6 100%) 1 !important;
}

/* All sidebar text → modern sans (overrides any inherited serif). */
html[data-theme="claude"][data-mode="dark"] aside:has(a[href*="/chat/"]) *,
html[data-theme="claude"][data-mode="dark"] nav:has(a[href*="/chat/"]) *,
html[data-theme="claude"][data-mode="dark"] [data-testid="sidebar"] *,
html[data-theme="claude"][data-mode="dark"] [data-testid*="sidebar" i] *,
html[data-theme="claude"][data-mode="dark"] [class*="sidebar" i] *,
html[data-theme="claude"][data-mode="dark"] [role="complementary"] * {
  font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif !important;
}

/* Send button — circular with iridescent gradient border. */
html[data-theme="claude"][data-mode="dark"] button[aria-label*="Send" i],
html[data-theme="claude"][data-mode="dark"] button[aria-label*="Submit" i],
html[data-theme="claude"][data-mode="dark"] [data-testid="send-button"],
html[data-theme="claude"][data-mode="dark"] [data-testid="send-message-button"],
html[data-theme="claude"][data-mode="dark"] [data-testid*="send" i]:not([data-testid*="setting" i]):not([data-testid*="cancel" i]) {
  background:
    linear-gradient(rgba(255, 255, 255, 0.12), rgba(255, 255, 255, 0.12)) padding-box,
    linear-gradient(135deg, #ec4899 0%, #a855f7 50%, #3b82f6 100%) border-box !important;
  border: 2px solid transparent !important;
  border-radius: 50% !important;
  color: #f8fafc !important;
  backdrop-filter: blur(12px) !important;
  -webkit-backdrop-filter: blur(12px) !important;
}

html[data-theme="claude"][data-mode="dark"] button[aria-label*="Send" i]:hover,
html[data-theme="claude"][data-mode="dark"] [data-testid="send-button"]:hover,
html[data-theme="claude"][data-mode="dark"] [data-testid="send-message-button"]:hover {
  box-shadow: 0 0 16px rgba(168, 85, 247, 0.5) !important;
}
`,
  }),

  s({
    id:'pasture',
    name:'Pasture',
    category:'special',
    free:true,
    // Popup preview swatches (legacy fields). The real engine uses variableOverrides + customCss.
    accent:'#c8924a',           // honey amber (palomino / sun-bleached hay)
    accent2:'#7a9168',          // sage green (the meadow)
    bg:'#1f2418',               // deep forest (swatch only — real bg is the countryside photo)
    sidebar:'rgba(20, 25, 18, 0.55)',
    border:'#c8924a',
    text:'#f5ecd6',             // warm cream for contrast against the busy photo
    bubbleAi:'rgba(20, 25, 18, 0.42)',
    bubbleUser:'rgba(20, 25, 18, 0.42)',
    bubbleAiRadius:'20px',
    bubbleUserRadius:'20px',
    font:'Cochin, "Hoefler Text", "Iowan Old Style", Garamond, "Times New Roman", serif',
    emoji:'🐎',
    vibe:'Pastoral English countryside',
    accentGlow:'0 4px 24px rgba(200, 146, 74, 0.30)',
    variableOverrides:{
      // Surfaces — deep forest/loam tones. Photo carries the visual weight;
      // these darken any UI surface that the photo doesn't reach.
      '--bg-000':'85 18% 11%',
      '--bg-100':'85 18% 9%',
      '--bg-200':'85 18% 8%',
      '--bg-300':'85 18% 7%',
      '--bg-400':'85 18% 6%',
      '--bg-500':'85 18% 5%',
      // Text — warm cream / wheat. Pastoral palette demands warm whites,
      // not cool blue-whites — would clash with the honey/sage gradients.
      '--text-000':'42 50% 92%',
      '--text-100':'42 45% 88%',
      '--text-200':'42 35% 78%',
      '--text-300':'42 28% 68%',
      '--text-400':'42 22% 56%',
      '--text-500':'42 18% 46%',
      // Borders — neutral honey-tinted. Per-element gradient borders are
      // applied in customCss for the bubbles, composer, and send button.
      '--border-100':'38 35% 38%',
      '--border-200':'38 35% 35%',
      '--border-300':'38 35% 30%',
      '--border-400':'38 35% 26%',
      // Accent — honey amber. The middle of the cream-honey-sage gradient
      // and the dominant warm note in the photo (palomino, hay).
      '--accent-000':'34 55% 60%',
      '--accent-100':'34 55% 53%',
      '--accent-200':'34 55% 48%',
      '--accent-900':'34 50% 28%',
      // Pictograms — soft warm grey for icon glyphs.
      '--pictogram-100':'38 18% 70%',
      '--pictogram-200':'38 18% 65%',
      '--pictogram-300':'38 18% 60%',
      '--pictogram-400':'38 18% 55%',
      '--coat-glow':'0 4px 24px rgba(200, 146, 74, 0.30)',
      // NOTE: --brand-* and --accent-brand intentionally NOT overridden.
      // Same two-tone rationale as Aurora Glass and Aura Glassmorphism:
      // Claude's clay orange asterisk is preserved as a brand mark.
    },
    customCss:`
/* Conversation text color override — consumed by CONTENT_EXCLUSION_CSS in
   src/content/injector.ts. Light value because Pasture is a dark skin. */
:root { --skyn-content-text: #ebebeb; }

/* All rules prefixed with html[data-theme="claude"][data-mode="dark"] so
   Pasture is invisible in light mode. */

/* Background: English countryside — horses grazing, rolling hills, dry
   stone walls. Asset path resolved at runtime via {{asset:...}} which
   resolveCustomCss replaces with chrome.runtime.getURL output.
   We try .jpg first, then .png as fallback (so Anthony does not have to
   match the exact extension when saving from a browser). If both are
   missing from dist, the linear-gradient at the bottom paints. CSS
   layer order: first url paints on top, then second, then gradient at
   bottom — failed url() loads are treated as empty layers so subsequent
   ones show through. background-attachment: fixed keeps the photo
   stable while content scrolls. */
html[data-theme="claude"][data-mode="dark"] body {
  background:
    url('{{asset:assets/skins/pasture/yorkshire-pasture.jpg}}') center / cover no-repeat,
    url('{{asset:assets/skins/pasture/yorkshire-pasture.png}}') center / cover no-repeat,
    linear-gradient(180deg, #d8c98e 0%, #a8b885 40%, #5e7b4a 100%) !important;
  background-attachment: fixed !important;
}

/* Warm dim overlay for bubble readability against the bright photo.
   Heavier than Aura Glass (0.18-0.32) because the countryside shot is
   significantly brighter — pale sky and sunlit meadow eat dark text
   without help. Warm dark-olive tint instead of neutral black so the
   pastoral palette does not get muted into a dead grey. */
html[data-theme="claude"][data-mode="dark"] body::before {
  content: '';
  position: fixed;
  inset: 0;
  pointer-events: none;
  z-index: 0;
  background: linear-gradient(180deg, rgba(15, 22, 12, 0.28) 0%, rgba(15, 22, 12, 0.48) 100%);
}

/* Font swap — Cochin is the British literary serif (system-installed
   on macOS, designed by Georges Peignot 1912, common in country house
   publications and English fiction). Hoefler Text and Iowan Old Style
   as macOS fallbacks; Garamond and Times for cross-platform safety.
   !important required because Claude sets these inline on <html>. */
html[data-theme="claude"][data-mode="dark"] {
  --font-claude-response: Cochin, "Hoefler Text", "Iowan Old Style", Garamond, "Times New Roman", serif !important;
  --font-user-message: Cochin, "Hoefler Text", "Iowan Old Style", Garamond, "Times New Roman", serif !important;
}

/* PASTORAL BUBBLE — same v2 mask-composite gradient-border technique
   used by Aurora Glass and Aura Glassmorphism. The bubble itself is
   dark frosted glass (rgba 0.06 + backdrop-blur), the gradient lives
   in a ::before pseudo-element clipped to a 2px ring with mask-
   composite. Backdrop-filter does not propagate through pseudo-
   elements so it must sit on the bubble itself.

   Gradient: cream (#e8d8b0) → honey (#c8924a) → sage (#7a9168) at 135°.
   This walks the dominant photo palette — the wheat/hay highlights, the
   palomino coat, then settles into the meadow green. */

/* User bubble — right-aligned, dark frosted glass with pastoral gradient border. */
html[data-theme="claude"][data-mode="dark"] [data-user-message-bubble="true"] {
  position: relative !important;
  background: rgba(20, 25, 18, 0.42) !important;
  backdrop-filter: blur(20px) saturate(160%) !important;
  -webkit-backdrop-filter: blur(20px) saturate(160%) !important;
  border: none !important;
  border-radius: 22px !important;
  padding: 14px 20px !important;
  margin: 8px 0 8px auto !important;
  max-width: 75% !important;
  width: fit-content !important;
  color: #f5ecd6 !important;
  box-shadow:
    0 4px 24px rgba(0, 0, 0, 0.35),
    0 0 12px rgba(200, 146, 74, 0.18) !important;
  font-family: Cochin, "Hoefler Text", "Iowan Old Style", Garamond, "Times New Roman", serif !important;
}

html[data-theme="claude"][data-mode="dark"] [data-user-message-bubble="true"]::before {
  content: '' !important;
  position: absolute !important;
  inset: 0 !important;
  border-radius: inherit !important;
  padding: 2px !important;
  background: linear-gradient(135deg, #e8d8b0 0%, #c8924a 50%, #7a9168 100%) !important;
  -webkit-mask:
    linear-gradient(#fff 0 0) content-box,
    linear-gradient(#fff 0 0) !important;
  -webkit-mask-composite: xor !important;
  mask:
    linear-gradient(#fff 0 0) content-box,
    linear-gradient(#fff 0 0) !important;
  mask-composite: exclude !important;
  pointer-events: none !important;
}

/* AI bubble — left-aligned, dark frosted glass + pastoral gradient border.
   Uses .font-claude-response:not(.font-claude-response *) to match ONLY
   the outermost wrapper (excludes any nested font-claude-response
   element). Without this filter, multi-chunk responses get nested
   bubbles. Pattern verified on Aurora Glass and Aura Glassmorphism. */
html[data-theme="claude"][data-mode="dark"] .font-claude-response:not(.font-claude-response *) {
  position: relative !important;
  background: rgba(20, 25, 18, 0.42) !important;
  backdrop-filter: blur(20px) saturate(160%) !important;
  -webkit-backdrop-filter: blur(20px) saturate(160%) !important;
  border: none !important;
  border-radius: 22px !important;
  padding: 14px 20px !important;
  margin: 8px auto 8px 0 !important;
  max-width: 75% !important;
  width: fit-content !important;
  color: #f5ecd6 !important;
  box-shadow:
    0 4px 24px rgba(0, 0, 0, 0.35),
    0 0 12px rgba(122, 145, 104, 0.18) !important;
  font-family: Cochin, "Hoefler Text", "Iowan Old Style", Garamond, "Times New Roman", serif !important;
}

html[data-theme="claude"][data-mode="dark"] .font-claude-response:not(.font-claude-response *)::before {
  content: '' !important;
  position: absolute !important;
  inset: 0 !important;
  border-radius: inherit !important;
  padding: 2px !important;
  background: linear-gradient(135deg, #e8d8b0 0%, #c8924a 50%, #7a9168 100%) !important;
  -webkit-mask:
    linear-gradient(#fff 0 0) content-box,
    linear-gradient(#fff 0 0) !important;
  -webkit-mask-composite: xor !important;
  mask:
    linear-gradient(#fff 0 0) content-box,
    linear-gradient(#fff 0 0) !important;
  mask-composite: exclude !important;
  pointer-events: none !important;
}

/* Strip rules — shared from skin-css-snippets.ts. Kills nested bubble
   visuals (descendants of .font-claude-response) and any positive
   styling on outer turn wrappers. */
${AI_DESCENDANT_STRIP_RULE}
${OUTER_TURN_STRIP_RULE}

/* New-chat greeting — same selector pattern as Aura Glassmorphism v11.
   The greeting is a div with classes transition-opacity duration-300,
   not an h1/h2 (DOM survey verified). Descendant rule excludes svg,
   svg children, and any element with brand or accent-brand in its
   class string so the Claude asterisk SVG keeps native orange.

   Font: Bradley Hand — system-installed handwritten script that reads
   like a country journal entry. Falls back to Marker Felt then a
   generic cursive. Heavier text-shadow than Aura because the photo
   is brighter and the soft script weight needs more help to read. */
html[data-theme="claude"][data-mode="dark"] main > div.transition-opacity.duration-300:not(:has([contenteditable])):not(:has(textarea)),
html[data-theme="claude"][data-mode="dark"] main > div.transition-opacity.duration-300:not(:has([contenteditable])):not(:has(textarea)) *:not(svg):not(svg *):not([class*="brand"]):not([class*="accent-brand"]) {
  color: #fbf3df !important;
  opacity: 1 !important;
  font-family: "Bradley Hand", "Marker Felt", "Apple Chancery", "Snell Roundhand", cursive !important;
  text-shadow:
    0 1px 2px rgba(0, 0, 0, 0.95),
    0 2px 8px rgba(0, 0, 0, 0.85),
    0 4px 24px rgba(0, 0, 0, 0.75),
    0 0 40px rgba(200, 146, 74, 0.55),
    0 0 60px rgba(122, 145, 104, 0.40) !important;
}

/* Composer — transparent fill + pastoral gradient border, on BOTH the
   chat-thread layout AND the new-chat layout. Class-fingerprint
   selector (bg-bg-000 + rounded-[20px]) hits both layouts; no ancestor
   needed. Pattern verified on Aura Glassmorphism v7. */
html[data-theme="claude"][data-mode="dark"] [class~="bg-bg-000"][class~="rounded-[20px]"] {
  position: relative !important;
  background: transparent !important;
  border: none !important;
  box-shadow: none !important;
}

html[data-theme="claude"][data-mode="dark"] [class~="bg-bg-000"][class~="rounded-[20px]"]::before {
  content: '' !important;
  position: absolute !important;
  inset: 0 !important;
  border-radius: inherit !important;
  padding: 2px !important;
  background: linear-gradient(135deg, #e8d8b0 0%, #c8924a 50%, #7a9168 100%) !important;
  -webkit-mask:
    linear-gradient(#fff 0 0) content-box,
    linear-gradient(#fff 0 0) !important;
  -webkit-mask-composite: xor !important;
  mask:
    linear-gradient(#fff 0 0) content-box,
    linear-gradient(#fff 0 0) !important;
  mask-composite: exclude !important;
  pointer-events: none !important;
}

/* Sidebar — heavy frosted glass with sage/honey right edge.
   Wide selector net mirrors Aurora Glass and Aura Glassmorphism — at
   least one branch should hit Claude's current sidebar container. */
html[data-theme="claude"][data-mode="dark"] [data-testid="sidebar"],
html[data-theme="claude"][data-mode="dark"] [data-testid="sidebar-menu"],
html[data-theme="claude"][data-mode="dark"] [data-testid="navigation-sidebar"],
html[data-theme="claude"][data-mode="dark"] [data-testid="conversation-list"],
html[data-theme="claude"][data-mode="dark"] [data-testid="chat-history"],
html[data-theme="claude"][data-mode="dark"] [data-testid*="sidebar" i],
html[data-theme="claude"][data-mode="dark"] nav[aria-label*="chat" i],
html[data-theme="claude"][data-mode="dark"] nav[aria-label*="conversation" i],
html[data-theme="claude"][data-mode="dark"] nav[aria-label*="recent" i],
html[data-theme="claude"][data-mode="dark"] aside[aria-label*="chat" i],
html[data-theme="claude"][data-mode="dark"] [role="complementary"],
html[data-theme="claude"][data-mode="dark"] [class*="sidebar" i],
html[data-theme="claude"][data-mode="dark"] aside:has(button[aria-label*="new chat" i]),
html[data-theme="claude"][data-mode="dark"] aside:has(a[href*="/chat/"]),
html[data-theme="claude"][data-mode="dark"] nav:has(button[aria-label*="new chat" i]),
html[data-theme="claude"][data-mode="dark"] nav:has(a[href*="/chat/"]) {
  background: rgba(20, 25, 18, 0.55) !important;
  backdrop-filter: blur(28px) saturate(160%) !important;
  -webkit-backdrop-filter: blur(28px) saturate(160%) !important;
  border-right: 2px solid transparent !important;
  border-image: linear-gradient(180deg, #e8d8b0 0%, #c8924a 50%, #7a9168 100%) 1 !important;
}

/* All sidebar text → Cochin serif (overrides any inherited body font). */
html[data-theme="claude"][data-mode="dark"] aside:has(a[href*="/chat/"]) *,
html[data-theme="claude"][data-mode="dark"] nav:has(a[href*="/chat/"]) *,
html[data-theme="claude"][data-mode="dark"] [data-testid="sidebar"] *,
html[data-theme="claude"][data-mode="dark"] [data-testid*="sidebar" i] *,
html[data-theme="claude"][data-mode="dark"] [class*="sidebar" i] *,
html[data-theme="claude"][data-mode="dark"] [role="complementary"] * {
  font-family: Cochin, "Hoefler Text", "Iowan Old Style", Garamond, "Times New Roman", serif !important;
}

/* Send button — circular with pastoral gradient border. Fill is a
   warm cream-tint translucent so the button reads as warm against
   the dark composer interior. Same padding-box / border-box double-
   gradient trick used in Aura Glassmorphism. */
html[data-theme="claude"][data-mode="dark"] button[aria-label*="Send" i],
html[data-theme="claude"][data-mode="dark"] button[aria-label*="Submit" i],
html[data-theme="claude"][data-mode="dark"] [data-testid="send-button"],
html[data-theme="claude"][data-mode="dark"] [data-testid="send-message-button"],
html[data-theme="claude"][data-mode="dark"] [data-testid*="send" i]:not([data-testid*="setting" i]):not([data-testid*="cancel" i]) {
  background:
    linear-gradient(rgba(245, 236, 214, 0.14), rgba(245, 236, 214, 0.14)) padding-box,
    linear-gradient(135deg, #e8d8b0 0%, #c8924a 50%, #7a9168 100%) border-box !important;
  border: 2px solid transparent !important;
  border-radius: 50% !important;
  color: #f5ecd6 !important;
  backdrop-filter: blur(12px) !important;
  -webkit-backdrop-filter: blur(12px) !important;
}

html[data-theme="claude"][data-mode="dark"] button[aria-label*="Send" i]:hover,
html[data-theme="claude"][data-mode="dark"] [data-testid="send-button"]:hover,
html[data-theme="claude"][data-mode="dark"] [data-testid="send-message-button"]:hover {
  box-shadow: 0 0 16px rgba(200, 146, 74, 0.55) !important;
}
`,
  }),

  s({
    id:'elven-village',
    name:'Elven Village',
    category:'glass',
    free:true,
    price:0,
    // Popup preview swatches (legacy fields). Real engine uses variableOverrides + customCss.
    accent:'#e8a045',           // warm lantern gold
    accent2:'#4dd9ac',          // magical particle teal
    bg:'#0a0f0d',               // deep twilight forest
    sidebar:'#0d130f',
    border:'#3a4a3a',
    text:'#e8e2d0',
    textMuted:'#9aa89e',
    bubbleAi:'rgba(13, 24, 19, 0.62)',
    bubbleUser:'rgba(17, 26, 20, 0.55)',
    bubbleAiRadius:'18px',
    bubbleUserRadius:'18px',
    font:SERIF,
    emoji:'🏮',
    vibe:'Ancient & alive',
    glassPanels:true,
    accentGlow:'0 0 14px rgba(232, 160, 69, 0.22)',
    videoPath:'assets/skins/elven-village/dusk.mp4',
    variableOverrides:{
      // Surfaces — deep twilight forest, HSL triples per Claude's format.
      '--bg-000':'156 20% 9%',
      '--bg-100':'150 22% 7%',
      '--bg-200':'145 22% 6%',
      '--bg-300':'145 20% 5%',
      '--bg-400':'140 22% 4%',
      '--bg-500':'140 22% 3%',
      // Text — warm cream against the twilight, NOT pure white.
      '--text-000':'42 35% 88%',
      '--text-100':'42 35% 84%',
      '--text-200':'42 22% 70%',
      '--text-300':'42 22% 60%',
      '--text-400':'42 18% 48%',
      '--text-500':'42 18% 42%',
      // Borders — sage moss, low contrast for ambient feel.
      '--border-100':'145 18% 22%',
      '--border-200':'145 18% 22%',
      '--border-300':'145 18% 18%',
      '--border-400':'145 18% 18%',
      // Accent — lantern gold #e8a045.
      '--accent-000':'33 78% 66%',
      '--accent-100':'33 78% 59%',
      '--accent-200':'33 78% 59%',
      '--accent-900':'33 60% 32%',
      // Pictograms — muted sage so icon glyphs sit quietly.
      '--pictogram-100':'145 15% 60%',
      '--pictogram-200':'145 15% 55%',
      '--pictogram-300':'145 15% 50%',
      '--pictogram-400':'145 15% 45%',
      // Halo glow used by hover/focus consumers (matches box-shadow below).
      '--coat-glow':'0 0 14px rgba(232, 160, 69, 0.22)',
      // NOTE: --brand-* intentionally NOT overridden. Claude's clay-orange
      // brand asterisk sits naturally inside the lantern-gold/teal palette.
    },
    customCss:`
/* Conversation text color override — consumed by CONTENT_EXCLUSION_CSS in
   src/content/injector.ts. Light value because Elven Village is a dark skin. */
:root { --skyn-content-text: #ebebeb; }

/* Every rule prefixed with html[data-theme="claude"][data-mode="dark"] so
   Elven Village stays invisible in light mode. variableOverrides above are
   already scoped via buildClaudeVariableTheme; customCss is emitted raw,
   so each selector must carry its own mode scope explicitly. */

/* Twilight forest base. Stack (first = topmost paint):
     1. Lantern radial glows at lower corners — overlay light spill ON TOP
        of the photo so the lanterns read as in-scene light.
     2. dusk.jpg hero photo — public/assets/skins/elven-village/, resolved
        via the {{asset:...}} placeholder (chrome.runtime.getURL).
     3. Linear-gradient fallback — only visible if dusk.jpg 404s, so the
        page never goes blank. */
html[data-theme="claude"][data-mode="dark"] body {
  background:
    radial-gradient(ellipse at 15% 88%, rgba(232, 160, 69, 0.22) 0%, transparent 38%),
    radial-gradient(ellipse at 85% 92%, rgba(232, 160, 69, 0.18) 0%, transparent 42%),
    url('{{asset:assets/skins/elven-village/dusk.jpg}}') center / cover no-repeat,
    linear-gradient(160deg, #0a0f0d 0%, #111a14 50%, #0d130f 100%) !important;
  background-attachment: fixed !important;
}

/* LAYER 1 — misty wash + lantern flicker.
   body::before is a fixed full-viewport overlay with a soft dim plus a
   second pass of lantern halos. The opacity keyframes pulse irregularly
   so the lanterns feel alive (no perfect sine — staggered breakpoints). */
@keyframes elvenLanternFlicker {
  0%, 100% { opacity: 0.92; }
  35%      { opacity: 1.00; }
  55%      { opacity: 0.86; }
  75%      { opacity: 0.97; }
}

html[data-theme="claude"][data-mode="dark"] body::before {
  content: '';
  position: fixed;
  inset: 0;
  pointer-events: none;
  z-index: 0;
  background:
    radial-gradient(ellipse at 12% 85%, rgba(232, 160, 69, 0.16) 0%, transparent 28%),
    radial-gradient(ellipse at 88% 90%, rgba(232, 160, 69, 0.12) 0%, transparent 32%),
    linear-gradient(180deg, rgba(10, 15, 13, 0.35) 0%, rgba(17, 26, 20, 0.25) 100%);
  animation: elvenLanternFlicker 5.5s ease-in-out infinite;
  will-change: opacity;
}

/* LAYER 2 — floating magical particles.
   body::after tiles a repeating pattern of small teal/gold dots
   (radial-gradients painted onto a 220x220 tile) and animates transform:
   translateY only — GPU-compositor path, no layout/paint thrash. The
   pseudo extends -220px above/below the viewport so the wrap when
   translateY reaches -220px is seamless (matches background-size). */
@keyframes elvenParticles {
  from { transform: translateY(0); }
  to   { transform: translateY(-220px); }
}

html[data-theme="claude"][data-mode="dark"] body::after {
  content: '';
  position: fixed;
  left: 0;
  right: 0;
  top: -220px;
  bottom: -220px;
  pointer-events: none;
  z-index: 0;
  background-image:
    radial-gradient(circle at 12% 18%, rgba(77, 217, 172, 0.42) 0%, transparent 1.4%),
    radial-gradient(circle at 78% 62%, rgba(77, 217, 172, 0.35) 0%, transparent 1.2%),
    radial-gradient(circle at 38% 84%, rgba(232, 160, 69, 0.30) 0%, transparent 1.1%),
    radial-gradient(circle at 62% 38%, rgba(77, 217, 172, 0.28) 0%, transparent 1.0%),
    radial-gradient(circle at 92% 12%, rgba(232, 160, 69, 0.22) 0%, transparent 0.9%);
  background-size: 220px 220px;
  background-repeat: repeat;
  animation: elvenParticles 22s linear infinite;
  will-change: transform;
}

/* LAYER 3 — slow shimmer sheen.
   html::after layers above body's pseudos but stays under content. The
   sheen is a narrow diagonal band of teal+gold light translated across
   the viewport. transform: translateX → GPU-friendly. Long duration
   (28s) so the effect is ambient, not distracting. */
@keyframes elvenShimmer {
  0%   { transform: translateX(-110%); }
  100% { transform: translateX(110%); }
}

html[data-theme="claude"][data-mode="dark"]::after {
  content: '';
  position: fixed;
  inset: 0;
  pointer-events: none;
  z-index: 0;
  background: linear-gradient(115deg,
    transparent 35%,
    rgba(77, 217, 172, 0.05) 48%,
    rgba(232, 160, 69, 0.07) 52%,
    transparent 65%);
  animation: elvenShimmer 28s ease-in-out infinite;
  will-change: transform;
}

/* Fonts on html so --font-claude-response / --font-user-message consumers
   pick the serif up. !important required because Claude sets these inline. */
html[data-theme="claude"][data-mode="dark"] {
  --font-claude-response: Georgia, "Times New Roman", serif !important;
  --font-user-message: Georgia, "Times New Roman", serif !important;
}

/* User-message bubble — misty glass with warm gold lantern-lit border. */
html[data-theme="claude"][data-mode="dark"] [data-user-message-bubble="true"] {
  background: rgba(17, 26, 20, 0.55) !important;
  backdrop-filter: blur(10px) saturate(130%) !important;
  -webkit-backdrop-filter: blur(10px) saturate(130%) !important;
  border: 1px solid rgba(232, 160, 69, 0.42) !important;
  border-radius: 18px !important;
  padding: 14px 18px !important;
  margin: 8px 0 8px auto !important;
  max-width: 75% !important;
  width: fit-content !important;
  box-shadow:
    0 4px 18px rgba(0, 0, 0, 0.4),
    0 0 14px rgba(232, 160, 69, 0.12),
    inset 0 1px 0 rgba(232, 160, 69, 0.08) !important;
  font-family: Georgia, "Times New Roman", serif !important;
  color: #e8e2d0 !important;
  transition: box-shadow 200ms ease, border-color 200ms ease !important;
}

/* User-bubble hover — gold halo intensifies, border brightens. */
html[data-theme="claude"][data-mode="dark"] [data-user-message-bubble="true"]:hover {
  box-shadow:
    0 0 18px rgba(232, 160, 69, 0.28),
    0 4px 18px rgba(0, 0, 0, 0.4) !important;
  border-color: rgba(232, 160, 69, 0.62) !important;
}

/* AI bubble — outermost-only selector (Aurora v10 lesson).
   Cooler glass tone with magical teal border so the two voices read
   distinctly (gold = you, teal = the ancient one). */
html[data-theme="claude"][data-mode="dark"] .font-claude-response:not(.font-claude-response *) {
  background: rgba(13, 24, 19, 0.62) !important;
  backdrop-filter: blur(10px) saturate(130%) !important;
  -webkit-backdrop-filter: blur(10px) saturate(130%) !important;
  border: 1px solid rgba(77, 217, 172, 0.32) !important;
  border-radius: 18px !important;
  padding: 14px 18px !important;
  margin: 8px auto 8px 0 !important;
  max-width: 75% !important;
  width: fit-content !important;
  box-shadow:
    0 4px 18px rgba(0, 0, 0, 0.4),
    0 0 14px rgba(77, 217, 172, 0.10) !important;
  font-family: Georgia, "Times New Roman", serif !important;
  color: #dde6e0 !important;
}

/* DESCENDANT STRIP + OUTER TURN STRIP — shared rules from skin-css-snippets.ts. */
${AI_DESCENDANT_STRIP_RULE}
${OUTER_TURN_STRIP_RULE}

/* Composer panel — match the bubble glass treatment with gold border.
   Class-fingerprint selector verified on current Claude DOM (see
   docs/aura-glassmorphism-v12-reference.md). */
html[data-theme="claude"][data-mode="dark"] [class~="bg-bg-000"][class~="rounded-[20px]"] {
  background: rgba(17, 26, 20, 0.58) !important;
  backdrop-filter: blur(10px) saturate(130%) !important;
  -webkit-backdrop-filter: blur(10px) saturate(130%) !important;
  border: 1px solid rgba(232, 160, 69, 0.36) !important;
  border-radius: 20px !important;
  box-shadow:
    0 4px 18px rgba(0, 0, 0, 0.4),
    0 0 14px rgba(232, 160, 69, 0.10) !important;
}
`,
  }),

  s({
    id:'claude-clay',
    name:'Claude Clay',
    category:'special',
    free:true,
    price:0,
    // Popup preview swatches (legacy fields). Real engine uses variableOverrides + customCss.
    accent:'#c4704a',           // terracotta
    accent2:'#8b5e3c',          // warm brown
    bg:'#2a2420',               // dark warm brown / charcoal clay
    sidebar:'#1f1a16',
    border:'#3a2d24',
    text:'#e8dcc8',             // warm cream
    textMuted:'#a89888',
    bubbleAi:'#2e251e',
    bubbleUser:'#332921',
    bubbleAiRadius:'14px',
    bubbleUserRadius:'14px',
    font:SERIF,
    emoji:'🪨',
    vibe:'Earthy & grounded',
    accentGlow:'0 0 12px rgba(196, 112, 74, 0.22)',
    variableOverrides:{
      // Surfaces — dark warm brown clay. HSL triples per Claude format.
      '--bg-000':'24 14% 14%',
      '--bg-100':'24 16% 11%',
      '--bg-200':'24 16% 9%',
      '--bg-300':'24 16% 8%',
      '--bg-400':'24 16% 6%',
      '--bg-500':'24 16% 5%',
      // Text — warm cream against dark clay, NOT pure white.
      '--text-000':'32 30% 88%',
      '--text-100':'32 30% 84%',
      '--text-200':'32 20% 70%',
      '--text-300':'32 20% 60%',
      '--text-400':'32 15% 48%',
      '--text-500':'32 15% 42%',
      // Borders — dim warm brown.
      '--border-100':'24 18% 22%',
      '--border-200':'24 18% 22%',
      '--border-300':'24 18% 18%',
      '--border-400':'24 18% 18%',
      // Accent — terracotta #c4704a.
      '--accent-000':'19 51% 60%',
      '--accent-100':'19 51% 53%',
      '--accent-200':'19 51% 53%',
      '--accent-900':'19 51% 30%',
      // Pictograms — warm muted clay so icon glyphs sit quietly.
      '--pictogram-100':'24 20% 60%',
      '--pictogram-200':'24 20% 55%',
      '--pictogram-300':'24 20% 50%',
      '--pictogram-400':'24 20% 45%',
      // Halo glow for hover/focus consumers (matches box-shadow below).
      '--coat-glow':'0 0 12px rgba(196, 112, 74, 0.22)',
      // NOTE: --brand-* intentionally NOT overridden. Claude's clay-orange
      // brand asterisk sits naturally in the same hue family as terracotta —
      // two-tone reads aligned, not fighting.
    },
    customCss:`
/* Conversation text color override — consumed by CONTENT_EXCLUSION_CSS in
   src/content/injector.ts. Light value because Claude Clay is a dark skin. */
:root { --skyn-content-text: #ebebeb; }

/* Every rule prefixed with html[data-theme="claude"][data-mode="dark"] so
   Claude Clay stays invisible in light mode. variableOverrides above are
   already scoped via buildClaudeVariableTheme; customCss is emitted raw,
   so each selector must carry its own mode scope explicitly. */

/* Body — stage.jpg is the environment base layer. The pre-rendered
   claymation photo carries the visible texture and warm directional
   lighting; we don't paint artificial SVG noise on top because the
   image already has real material grain. background-color provides
   a warm-dark fallback if the asset 404s. All other procedural CSS
   in this skin (body::before warm wash, bubbles, composer, sidebar)
   sits on top of stage.jpg as the actor layer. */
html[data-theme="claude"][data-mode="dark"] body {
  background-image: url('{{asset:assets/skins/claude-clay/stage.jpg}}') !important;
  background-color: #2a2420 !important;
  background-size: cover !important;
  background-position: center !important;
  background-repeat: no-repeat !important;
  background-attachment: fixed !important;
}

/* Warm wash overlay — softens the busiest grain zones so body text on
   the bare canvas (rare but possible during streaming) stays readable. */
html[data-theme="claude"][data-mode="dark"] body::before {
  content: '';
  position: fixed;
  inset: 0;
  pointer-events: none;
  z-index: 0;
  background: linear-gradient(180deg, rgba(42, 36, 32, 0.25) 0%, rgba(28, 22, 18, 0.35) 100%);
}

/* Fonts on html so --font-claude-response / --font-user-message consumers
   pick the serif up. !important required because Claude sets these inline. */
html[data-theme="claude"][data-mode="dark"] {
  --font-claude-response: Georgia, "Times New Roman", serif !important;
  --font-user-message: Georgia, "Times New Roman", serif !important;
}

/* User-message bubble — embossed clay tile.
   Inset shadow pattern (light from top, dark from bottom) creates the
   raised-from-the-page look. Subtle terracotta border pins the bubble
   against the dark base; outer drop-shadow grounds it. */
html[data-theme="claude"][data-mode="dark"] [data-user-message-bubble="true"] {
  background: linear-gradient(180deg, #3a2d24 0%, #2e241d 100%) !important;
  border: 1px solid rgba(196, 112, 74, 0.32) !important;
  border-radius: 14px !important;
  padding: 14px 18px !important;
  margin: 8px 0 8px auto !important;
  max-width: 75% !important;
  width: fit-content !important;
  box-shadow:
    0 4px 14px rgba(0, 0, 0, 0.45),
    inset 0 1px 0 rgba(232, 220, 200, 0.08),
    inset 0 -1px 0 rgba(0, 0, 0, 0.35) !important;
  font-family: Georgia, "Times New Roman", serif !important;
  color: #e8dcc8 !important;
  transition: box-shadow 200ms ease, border-color 200ms ease !important;
}

/* User-bubble hover — terracotta border brightens, warm halo appears. */
html[data-theme="claude"][data-mode="dark"] [data-user-message-bubble="true"]:hover {
  border-color: rgba(196, 112, 74, 0.55) !important;
  box-shadow:
    0 0 14px rgba(196, 112, 74, 0.22),
    0 4px 14px rgba(0, 0, 0, 0.45),
    inset 0 1px 0 rgba(232, 220, 200, 0.10) !important;
}

/* AI bubble — debossed clay tile.
   Inverted inset-shadow direction from the user bubble (dark on top,
   subtle highlight on bottom) so AI text reads as pressed INTO the
   surface while user text reads as raised FROM it. The two voices
   feel distinct without needing different palettes. Outermost-only
   selector per the Aurora v10 lesson — prevents double-bubble on
   nested wrappers. */
html[data-theme="claude"][data-mode="dark"] .font-claude-response:not(.font-claude-response *) {
  background: linear-gradient(180deg, #2e251e 0%, #261d18 100%) !important;
  border: 1px solid rgba(139, 94, 60, 0.32) !important;
  border-radius: 14px !important;
  padding: 14px 18px !important;
  margin: 8px auto 8px 0 !important;
  max-width: 75% !important;
  width: fit-content !important;
  box-shadow:
    0 2px 8px rgba(0, 0, 0, 0.35),
    inset 0 1px 0 rgba(0, 0, 0, 0.40),
    inset 0 -1px 0 rgba(232, 220, 200, 0.05) !important;
  font-family: Georgia, "Times New Roman", serif !important;
  color: #dccfba !important;
}

/* DESCENDANT STRIP + OUTER TURN STRIP — shared rules from skin-css-snippets.ts. */
${AI_DESCENDANT_STRIP_RULE}
${OUTER_TURN_STRIP_RULE}

/* Composer panel — deeper embossed slot. Stronger inset shadow than the
   user bubble so the composer reads as a recessed input well. Class-
   fingerprint selector verified on current Claude DOM (see
   docs/aura-glassmorphism-v12-reference.md). */
html[data-theme="claude"][data-mode="dark"] [class~="bg-bg-000"][class~="rounded-[20px]"] {
  background: linear-gradient(180deg, #2e241d 0%, #241b15 100%) !important;
  border: 1px solid rgba(196, 112, 74, 0.28) !important;
  border-radius: 20px !important;
  box-shadow:
    0 4px 18px rgba(0, 0, 0, 0.50),
    inset 0 1px 0 rgba(232, 220, 200, 0.06),
    inset 0 -1px 0 rgba(0, 0, 0, 0.40) !important;
}
`,
  }),
];

export const SKIN_PACKS: SkinPack[] = [
  { id:'pack-all', name:'All-Access Lifetime', skins:'all', price:4999 },
];

export function getSkinById(id: string): Skin {
  return SKINS.find((skin) => skin.id === id) ?? SKINS[0];
}

export function skinToVars(skin: Skin): SkinVars {
  return {
    '--coat-bg': skin.bg,
    '--coat-sidebar': skin.sidebar,
    '--coat-topbar': skin.sidebar,
    '--coat-border': skin.border,
    '--coat-text': skin.text,
    '--coat-text-muted': skin.textMuted,
    '--coat-accent': skin.accent,
    '--coat-accent2': skin.accent2,
    '--coat-bubble-ai': skin.bubbleAi,
    '--coat-bubble-user': skin.bubbleUser,
    '--coat-bubble-ai-radius': skin.bubbleAiRadius,
    '--coat-bubble-user-radius': skin.bubbleUserRadius,
    '--coat-bubble-ai-text': skin.text,
    '--coat-bubble-user-text': skin.text,
    '--coat-input-bg': skin.bubbleAi,
    '--coat-font': skin.font,
    '--coat-glow': skin.accentGlow ?? 'none',
  };
}

function s(seed: SkinSeed): Skin {
  const free = seed.free ?? false;
  const seasonal = seed.seasonal ?? false;
  const price = seed.price ?? (free ? 0 : 199);
  const accent2 = seed.accent2 ?? seed.accent;
  const dark = isDark(seed.category, seed.bg);
  const sidebar = seed.sidebar ?? mix(seed.bg, dark ? '#ffffff' : '#000000', dark ? 0.08 : 0.05);
  const bubbleAi = seed.bubbleAi ?? mix(seed.bg, dark ? '#ffffff' : '#000000', dark ? 0.12 : 0.07);
  const bubbleUser = seed.bubbleUser ?? mix(seed.accent, seed.bg, dark ? 0.32 : 0.18);

  return {
    id: seed.id,
    name: seed.name,
    category: seed.category,
    free,
    seasonal,
    price,
    accent: seed.accent,
    accent2,
    bg: seed.bg,
    sidebar,
    border: seed.border ?? mix(seed.accent, seed.bg, 0.28),
    text: seed.text ?? (dark ? '#f8fafc' : '#172033'),
    textMuted: seed.textMuted ?? (dark ? mix(seed.accent, '#ffffff', 0.45) : mix(seed.accent, '#172033', 0.32)),
    bubbleAi,
    bubbleUser,
    bubbleAiRadius: seed.bubbleAiRadius ?? '4px 18px 18px 18px',
    bubbleUserRadius: seed.bubbleUserRadius ?? '18px 18px 4px 18px',
    font: seed.font ?? SYSTEM,
    emoji: seed.emoji,
    vibe: seed.vibe,
    glassPanels: seed.glassPanels ?? false,
    mascotPath: seed.mascotPath,
    videoPath: seed.videoPath,
    customCss: seed.customCss,
    accentGlow: seed.accentGlow,
    variableOverrides: seed.variableOverrides,
  };
}

function isDark(category: SkinCategory, bg: string): boolean {
  if (category === 'light' || category === 'pretty') return false;
  if (category === 'glass') return bg !== '#daeeff' && bg !== '#ffd4f0' && bg !== '#fff0d8' && bg !== '#d8fff0' && bg !== '#ffe8f0';
  const { r, g, b } = parseHex(bg);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b < 150;
}

function mix(a: string, b: string, weightB: number): string {
  const ca = parseHex(a);
  const cb = parseHex(b);
  const weightA = 1 - weightB;
  return `rgb(${Math.round(ca.r * weightA + cb.r * weightB)}, ${Math.round(ca.g * weightA + cb.g * weightB)}, ${Math.round(ca.b * weightA + cb.b * weightB)})`;
}

function parseHex(hex: string): { r: number; g: number; b: number } {
  if (hex.startsWith('rgba') || hex.startsWith('linear-gradient') || hex.startsWith('radial-gradient') || hex.startsWith('conic-gradient')) {
    return { r: 255, g: 255, b: 255 };
  }
  const cleaned = hex.replace('#', '');
  const value = Number.parseInt(cleaned.length === 3 ? cleaned.split('').map((c) => c + c).join('') : cleaned, 16);
  return {
    r: (value >> 16) & 255,
    g: (value >> 8) & 255,
    b: value & 255,
  };
}
