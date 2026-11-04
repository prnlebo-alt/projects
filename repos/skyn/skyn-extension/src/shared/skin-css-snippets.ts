/**
 * Shared CSS selectors and snippets for Skyn skins.
 *
 * All entries here are DOM-survey-verified against Claude.ai (last
 * verified 2026-05-13). Future skins should import from this file
 * instead of duplicating the patterns inline. See
 * `docs/aura-glassmorphism-v12-reference.md` for the full writeup
 * of why each pattern exists and what it solves.
 *
 * Conventions:
 *   - SELECTOR_*  exports are bare CSS selectors (caller adds scope)
 *   - SCOPED_*    exports include the dark-mode scope prefix
 *   - *_RULE      exports are complete CSS rules (selector + body),
 *                 already scope-prefixed and ready to interpolate
 *                 into a skin's customCss
 *   - build*()    helper functions return complete CSS rule strings
 *
 * If you change anything here, expect visual regressions across
 * every skin that imports it. Edit deliberately.
 */

/** The scope prefix applied to all dark-mode-only rules. */
export const SKIN_DARK_SCOPE = 'html[data-theme="claude"][data-mode="dark"]';

// ─────────────────────────────────────────────────────────────────────
// VERIFIED DOM SELECTORS
// ─────────────────────────────────────────────────────────────────────

/**
 * Selector for a user-message bubble. Claude exposes
 * data-user-message-bubble="true" as a stable semantic marker —
 * one match per user message, no nesting risk.
 */
export const SELECTOR_USER_BUBBLE = '[data-user-message-bubble="true"]';

/**
 * Selector for the OUTERMOST AI message wrapper. Uses the
 * `:not(.font-claude-response *)` filter to exclude any nested
 * font-claude-response elements (Claude renders multi-chunk
 * responses with nested wrappers; without this filter, every
 * chunk would get its own bubble — the "double bubble" bug).
 *
 * This is the pattern that broke the iteration loop on both
 * Aurora Glass and Aura Glassmorphism.
 */
export const SELECTOR_AI_BUBBLE_OUTER = '.font-claude-response:not(.font-claude-response *)';

/**
 * Selector matching descendants of the AI bubble wrapper, with
 * pre/code excluded (so Claude's code-block formatting survives).
 * Pair with the AI_DESCENDANT_STRIP_RULE below to kill any nested
 * bubble visuals.
 */
export const SELECTOR_AI_BUBBLE_DESCENDANTS =
  '.font-claude-response *:not(pre):not(code):not(pre *):not(code *)';

/**
 * Selector for the composer (the dark rectangle around the message
 * input). Targets the depth-4 element by class fingerprint
 * (bg-bg-000 + rounded-[20px] together) — works on BOTH the
 * chat-thread layout AND the new-chat layout, no ancestor required.
 *
 * The `[class~="..."]` syntax matches an exact word in the
 * space-separated class list. Brackets inside the quoted value are
 * literal characters (no CSS escaping needed).
 */
export const SELECTOR_COMPOSER = '[class~="bg-bg-000"][class~="rounded-[20px]"]';

/**
 * Comma-joined list of all known outer-turn-wrapper selectors. Most
 * of these are stale on current Claude DOM, but they're kept here
 * so any future Claude rebuild that reintroduces them gets stripped
 * back to invisible (preventing "extra lining" around bubbles).
 *
 * Apply with the OUTER_TURN_STRIP_RULE below — never give these
 * positive bubble styling, only strip them.
 */
export const SELECTOR_OUTER_TURN_WRAPPERS = `
  [data-testid="assistant-turn"],
  [data-testid="claude-response"],
  [data-testid="conversation-turn"],
  [data-message-author-role="assistant"],
  [data-message-author-role="user"],
  [data-message-role="assistant"],
  [data-message-role="user"],
  [data-test-render-count],
  main > article`;

/**
 * Comma-joined wide selector net for Claude's sidebar container.
 * The legacy [data-testid="sidebar"|"sidebar-menu"] selectors are
 * stale; current Claude DOM doesn't expose a clean semantic anchor.
 * This net combines data-testid candidates, semantic roles,
 * class-substring matches, and `:has()` shots that target an
 * aside/nav by content (presence of a "new chat" button or a
 * /chat/ link inside).
 *
 * `:has()` requires Chrome 105+; build target is Chrome 114+.
 */
export const SELECTOR_SIDEBAR_NET = `
  [data-testid="sidebar"],
  [data-testid="sidebar-menu"],
  [data-testid="navigation-sidebar"],
  [data-testid="conversation-list"],
  [data-testid="chat-history"],
  [data-testid*="sidebar" i],
  nav[aria-label*="chat" i],
  nav[aria-label*="conversation" i],
  nav[aria-label*="recent" i],
  aside[aria-label*="chat" i],
  [role="complementary"],
  [class*="sidebar" i],
  aside:has(button[aria-label*="new chat" i]),
  aside:has(a[href*="/chat/"]),
  nav:has(button[aria-label*="new chat" i]),
  nav:has(a[href*="/chat/"])`;

// ─────────────────────────────────────────────────────────────────────
// SCOPED SELECTORS (include dark-mode prefix, ready to use directly)
// ─────────────────────────────────────────────────────────────────────

export const SCOPED_USER_BUBBLE = `${SKIN_DARK_SCOPE} ${SELECTOR_USER_BUBBLE}`;
export const SCOPED_AI_BUBBLE_OUTER = `${SKIN_DARK_SCOPE} ${SELECTOR_AI_BUBBLE_OUTER}`;
export const SCOPED_COMPOSER = `${SKIN_DARK_SCOPE} ${SELECTOR_COMPOSER}`;

// ─────────────────────────────────────────────────────────────────────
// COMPLETE CSS RULES (interpolate directly into customCss)
// ─────────────────────────────────────────────────────────────────────

/**
 * Strips background, border, backdrop-filter, and box-shadow from
 * every descendant of the AI bubble wrapper — except pre/code (so
 * code-block formatting survives). Pair with an AI bubble rule that
 * targets SCOPED_AI_BUBBLE_OUTER to guarantee only ONE visible
 * bubble per AI turn, no matter what Claude renders inside.
 *
 * Originally added as belt-and-suspenders to the outermost-only
 * selector. Kept because Claude periodically introduces new inner
 * elements with their own backgrounds; this rule is forward-proof.
 */
export const AI_DESCENDANT_STRIP_RULE = `
${SKIN_DARK_SCOPE} ${SELECTOR_AI_BUBBLE_DESCENDANTS} {
  background-color: transparent !important;
  background-image: none !important;
  border-color: transparent !important;
  border-width: 0 !important;
  backdrop-filter: none !important;
  -webkit-backdrop-filter: none !important;
  box-shadow: none !important;
}`;

/**
 * Strips background/border/box-shadow/border-radius from outer turn
 * wrappers. Kills the "extra lining" you'd otherwise see around
 * bubbles when [data-test-render-count] or main > article (or any
 * of the listed selectors) end up matching every turn — including
 * user turns when the rule didn't intend to.
 *
 * The wrappers become invisible containers; the actual bubble comes
 * from the user-bubble or AI-bubble rule, which provides the
 * visible frame.
 */
export const OUTER_TURN_STRIP_RULE = `
${SKIN_DARK_SCOPE} ${SELECTOR_OUTER_TURN_WRAPPERS.split(',').map(s => s.trim()).join(`,
${SKIN_DARK_SCOPE} `)} {
  background: transparent !important;
  backdrop-filter: none !important;
  -webkit-backdrop-filter: none !important;
  border: none !important;
  box-shadow: none !important;
  border-radius: 0 !important;
}`;

// ─────────────────────────────────────────────────────────────────────
// BUILDER FUNCTIONS
// ─────────────────────────────────────────────────────────────────────

/**
 * Generates a transparent-center + gradient-border CSS pair using
 * the pseudo-element mask-composite trick. This is the only path
 * to a real gradient border on a rounded-corner element with a
 * transparent (or backdrop-blurred) center; `border-image` doesn't
 * follow `border-radius`, and `background-clip` fills the entire
 * border-box (the gradient bleeds through the padding).
 *
 * Returns a complete CSS string with two rules:
 *   1. The element rule — adds position:relative, transparent
 *      border, the requested border-radius. Caller is expected to
 *      ALSO set background, backdrop-filter, padding, etc. on the
 *      same selector elsewhere if those are desired.
 *   2. The ::before pseudo rule — paints the gradient and uses
 *      mask-composite to clip it to a ring of the requested width.
 *
 * Two non-obvious quirks:
 *   - backdrop-filter does NOT propagate through pseudo-elements.
 *     The bubble itself must carry backdrop-filter (separately).
 *   - The mask requires both -webkit-mask-composite:xor and
 *     mask-composite:exclude for cross-browser. Chrome 105+ has both;
 *     build target is Chrome 114+.
 *
 * @param opts.selector       Pre-scoped CSS selector (caller adds the
 *                            html[data-theme=...][data-mode=dark] prefix).
 * @param opts.gradientCss    Full linear-gradient string, e.g.
 *                            'linear-gradient(135deg, #ec4899 0%, #a855f7 50%, #3b82f6 100%)'.
 * @param opts.borderRadius   CSS border-radius value (default '22px').
 * @param opts.borderWidthPx  Border thickness in pixels (default 2).
 */
export function buildGradientBorderRule(opts: {
  selector: string;
  gradientCss: string;
  borderRadius?: string;
  borderWidthPx?: number;
}): string {
  const borderRadius = opts.borderRadius ?? '22px';
  const borderWidth = opts.borderWidthPx ?? 2;
  return `
${opts.selector} {
  position: relative !important;
  border: none !important;
  border-radius: ${borderRadius} !important;
}

${opts.selector}::before {
  content: '' !important;
  position: absolute !important;
  inset: 0 !important;
  border-radius: inherit !important;
  padding: ${borderWidth}px !important;
  background: ${opts.gradientCss} !important;
  -webkit-mask:
    linear-gradient(#fff 0 0) content-box,
    linear-gradient(#fff 0 0) !important;
  -webkit-mask-composite: xor !important;
  mask:
    linear-gradient(#fff 0 0) content-box,
    linear-gradient(#fff 0 0) !important;
  mask-composite: exclude !important;
  pointer-events: none !important;
}`;
}

/**
 * Convenience: the iridescent pink → purple → blue gradient used
 * by Aura Glassmorphism. Exported so future variant skins can
 * reference it directly.
 */
export const AURA_IRIDESCENT_GRADIENT =
  'linear-gradient(135deg, #ec4899 0%, #a855f7 50%, #3b82f6 100%)';

/**
 * Convenience: the gold gradient that could match Aurora Glass's
 * solid gold border, expressed as a gradient for use with
 * buildGradientBorderRule. Kept here so any future skin that wants
 * a gradient gold border has a starting point.
 */
export const AURORA_GOLD_GRADIENT =
  'linear-gradient(135deg, #d4af6a 0%, #f0d088 50%, #d4af6a 100%)';
