# Aura Glassmorphism v12 — locked working reference

**Skin:** `aura-glass` (id) / "Aura Glassmorphism" (display name)
**Status:** ✅ Signed off by Anthony 2026-05-13
**Category:** `special` · **Free tier** · Dark-mode only (Claude.ai)
**Engineering pattern:** Tier-3 `variableOverrides` + `customCss`

---

## Why this doc exists

Aura Glassmorphism took 12 iterations to land. Most of the time was burned on selector guesswork — applying CSS to elements that didn't exist on current Claude DOM, then debugging why "nothing changed." This doc captures **the exact selectors and techniques that work**, so future iterations don't re-litigate the same ground.

Treat this as a load-bearing reference: if something here changes, expect visual regressions.

---

## File locations

| What | Where |
|---|---|
| Skin definition | `skyn-extension/src/shared/skins.ts` — `s({ id:'aura-glass', ... })` block |
| SkinId type | `skyn-extension/src/shared/types.ts` — `'aura-glass'` in `// Special (11)` group |
| **Shared CSS snippets / patterns** | **`skyn-extension/src/shared/skin-css-snippets.ts`** ← reusable across all skins |
| Asset placeholder support | `skyn-extension/src/content/injector.ts` — `resolveCustomCss` function |
| Background photo | `skyn-extension/public/assets/skins/aura-glass/boot-nyc.png` |
| Design reference | `docs/aura-glass-references/mockup-reference.png` |

### Shared module contents (`skin-css-snippets.ts`)

Anything in this module is project-wide reusable. Future skins should import from here instead of duplicating patterns inline.

| Export | Type | What it gives you |
|---|---|---|
| `SKIN_DARK_SCOPE` | constant | The dark-mode scope prefix string |
| `SELECTOR_USER_BUBBLE` | constant | Bare user-bubble selector |
| `SELECTOR_AI_BUBBLE_OUTER` | constant | Bare outermost-only AI bubble selector |
| `SELECTOR_AI_BUBBLE_DESCENDANTS` | constant | Bare AI descendants selector (with pre/code excluded) |
| `SELECTOR_COMPOSER` | constant | Bare composer class-fingerprint selector |
| `SELECTOR_OUTER_TURN_WRAPPERS` | constant | Bare comma-list of stale-but-strip-worthy wrapper selectors |
| `SELECTOR_SIDEBAR_NET` | constant | Bare comma-list of the wide sidebar selector net (with `:has()` shots) |
| `SCOPED_USER_BUBBLE` | constant | Above pre-scoped to dark mode |
| `SCOPED_AI_BUBBLE_OUTER` | constant | Above pre-scoped to dark mode |
| `SCOPED_COMPOSER` | constant | Above pre-scoped to dark mode |
| `AI_DESCENDANT_STRIP_RULE` | constant | Complete CSS rule — strips bubble visuals from AI descendants. Used by Aurora Glass + Aura Glassmorphism |
| `OUTER_TURN_STRIP_RULE` | constant | Complete CSS rule — strips bubble visuals from outer turn wrappers. Used by Aurora Glass + Aura Glassmorphism |
| `buildGradientBorderRule({ selector, gradientCss, borderRadius?, borderWidthPx? })` | function | Generates the pseudo-element mask gradient-border CSS pair |
| `AURA_IRIDESCENT_GRADIENT` | constant | The pink → purple → blue gradient string |
| `AURORA_GOLD_GRADIENT` | constant | A gold gradient string starter for Aurora-style variants |

**Currently consumed:** `AI_DESCENDANT_STRIP_RULE` and `OUTER_TURN_STRIP_RULE` are imported by both Aurora Glass and Aura Glassmorphism, replacing the previously-duplicated inline blocks. Other exports are AVAILABLE for future skin imports without restriction.

---

## Verified DOM selectors (DO NOT GUESS — these are confirmed)

These were established via DOM survey probes against current Claude DOM (2026-05-13). Each has been visually verified working.

| What it targets | Selector | How it was found |
|---|---|---|
| User message bubble | `[data-user-message-bubble="true"]` | Claude's semantic data attribute (always-stable) |
| AI message wrapper (outermost only) | `.font-claude-response:not(.font-claude-response *)` | DOM survey walk from `[data-test-render-count]` |
| Composer dark rectangle (chat-thread AND new-chat) | `[class~="bg-bg-000"][class~="rounded-[20px]"]` | Class fingerprint identical on both layouts |
| New-chat greeting "Hey there, Fam." | `main > div.transition-opacity.duration-300:not(:has([contenteditable])):not(:has(textarea))` | DOM survey (greeting is a `<div>`, NOT `h1`/`h2`) |

**Key invariant:** the AI bubble selector uses `:not(.font-claude-response *)` to ensure only the OUTERMOST `font-claude-response` matches. Claude renders multi-chunk responses with nested wrappers; without this `:not()` filter, every chunk gets its own bubble (the v2 nested-bubble bug).

---

## Stale/broken selectors (DO NOT USE)

These were tried during iteration and confirmed not to match on current Claude DOM:

- `[data-testid="assistant-turn"]`, `[data-testid="assistant-turn-content"]`, `[data-testid="claude-response"]`, `[data-testid="conversation-turn"]`, `[data-message-author-role="assistant"]`, `[data-message-role="assistant"]`, `[data-test-render-count]`, `main > article` — none match the AI message wrapper consistently. The v6 strip rule still references them as belt-and-suspenders to kill any "extra lining" if Claude reintroduces them, but nothing should TARGET them as primary.
- `.font-claude-message` — stale (Claude renamed to `.font-claude-response`).
- `[data-testid="composer"]`, `[data-testid="chat-input-area"]`, any `[data-testid*="composer" i]`, `form:has([contenteditable])` — none hit the composer container on current Claude.
- `[data-testid="sidebar-menu"]` — stale; the AI mascot (Mecha) couldn't anchor to this; sidebar selector net works around it via `:has()` shots.
- `main h1`, `main h2` for the new-chat greeting — wrong element type entirely.

---

## Key techniques that work

### 1. Iridescent gradient border via pseudo-element mask

The classic CSS trick for "transparent center with gradient border on a rounded corner element." Used on user bubble, AI bubble, composer, send button.

```css
.element {
  position: relative;          /* anchors the pseudo */
  background: rgba(255, 255, 255, 0.06);   /* truly translucent so backdrop-filter shows the photo */
  backdrop-filter: blur(20px) saturate(180%);
  border-radius: 22px;
  border: none;                /* DON'T set a border — pseudo provides it */
}

.element::before {
  content: '';
  position: absolute;
  inset: 0;                    /* covers the entire element */
  border-radius: inherit;
  padding: 2px;                /* the border thickness */
  background: linear-gradient(135deg, #ec4899 0%, #a855f7 50%, #3b82f6 100%);
  -webkit-mask: linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0);
  -webkit-mask-composite: xor;
  mask: linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0);
  mask-composite: exclude;
  pointer-events: none;
}
```

**Two non-obvious things:**
- `backdrop-filter` does NOT propagate through pseudo-elements. It must be on the bubble itself.
- The mask requires BOTH `-webkit-mask-composite: xor` AND `mask-composite: exclude` for cross-browser. Chrome 105+ supports both; build target is Chrome 114+.

**Why this beats `background-clip: padding-box, border-box`:** the latter fills the entire border-box with the gradient (the bottom layer paints in padding too), and a translucent top layer can't fully mask it. Result: solid gradient blob instead of gradient border. The pseudo-element approach is the only reliable path to "transparent center, gradient border" with rounded corners.

### 2. Outermost-only matching with `:not(... *)`

```css
.font-claude-response:not(.font-claude-response *) { ... }
```

Reads as: "match `.font-claude-response` elements that are NOT descendants of another `.font-claude-response`." Eliminates nested matches by construction. Use this whenever Claude (or any host) might render nested elements with the same class.

### 3. Asset placeholder for runtime URL resolution

`resolveCustomCss` in `src/content/injector.ts` supports `{{asset:<path>}}` placeholders that resolve to `chrome-extension://<id>/<path>` URLs at runtime:

```css
background: url('{{asset:assets/skins/aura-glass/boot-nyc.png}}') center / cover;
```

Lets skins reference bundled assets without needing a JS-side hook for every new asset. Path must be in `web_accessible_resources` (the manifest matcher `assets/skins/*/*` covers anything under `public/assets/skins/`).

**Background fallback chain:** when a `url()` 404s, the layer is treated as empty and subsequent layers paint. Aura Glass uses this to try `boot-nyc.jpg` first, then `boot-nyc.png`, then a `linear-gradient` fallback — so the photo doesn't have to be at one specific extension and the page is never blank.

### 4. Descendant-strip pattern (kill nested bubble visuals)

```css
.font-claude-response *:not(pre):not(code):not(pre *):not(code *) {
  background-color: transparent !important;
  background-image: none !important;
  border-color: transparent !important;
  border-width: 0 !important;
  backdrop-filter: none !important;
  -webkit-backdrop-filter: none !important;
  box-shadow: none !important;
}
```

Strips bubble-like styling from every descendant of the AI wrapper. The `:not(pre):not(code)` exceptions preserve Claude's code-block formatting. This is the brute-force pattern that ended a 4-iteration debug loop where the per-paragraph nested bubbles wouldn't go away no matter which selector I trimmed.

### 5. Brand asterisk preservation

Aura Glass's `variableOverrides` block intentionally does NOT override `--brand-*` or `--accent-brand`. The Claude clay-orange asterisk shows through unchanged.

The new-chat greeting rule's descendant `*` selector also explicitly excludes SVGs and brand-classed elements:
```css
... *:not(svg):not(svg *):not([class*="brand"]):not([class*="accent-brand"])
```

So the asterisk SVG keeps its native `--brand-200` color even when the surrounding heading text is forced to white.

### 6. Class-fingerprint matching with `[class~="..."]`

When Claude exposes no semantic markers (no `data-testid`, no role, no obvious aria), match by combination of generic Tailwind utility classes:

```css
[class~="bg-bg-000"][class~="rounded-[20px]"] { ... }
```

`[class~="value"]` matches an EXACT word in the class list (space-separated). The brackets inside `"rounded-[20px]"` are literal characters in the quoted value — no CSS escaping needed. The combination of `bg-bg-000 + rounded-[20px]` is the composer's unique fingerprint on both chat-thread AND new-chat layouts.

---

## variableOverrides (HSL triples per Claude format)

```ts
{
  // Surfaces — neutral dark; the photo carries the visual identity.
  '--bg-000':'230 25% 12%',
  '--bg-100':'230 25% 10%',
  '--bg-200':'230 25% 9%',
  '--bg-300':'230 25% 8%',
  '--bg-400':'230 25% 7%',
  '--bg-500':'230 25% 6%',
  // Text — light/near-white for contrast against the photo.
  '--text-000':'210 20% 96%',
  '--text-100':'210 20% 92%',
  '--text-200':'210 15% 80%',
  '--text-300':'210 15% 72%',
  '--text-400':'210 12% 60%',
  '--text-500':'210 12% 50%',
  // Borders — neutral; iridescent borders applied per-element via gradient trick.
  '--border-100':'270 25% 35%',
  '--border-200':'270 25% 35%',
  '--border-300':'270 25% 30%',
  '--border-400':'270 25% 30%',
  // Accent — purple/violet (middle of the iridescent gradient).
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
}
```

---

## Iridescent gradient values (used everywhere)

```css
linear-gradient(135deg, #ec4899 0%, #a855f7 50%, #3b82f6 100%)
```

- `#ec4899` — pink (rose 500)
- `#a855f7` — purple (violet 500)
- `#3b82f6` — blue (blue 500)

Used on every gradient border in the skin. Don't change unless you mean to shift the entire palette.

---

## Glow stack (used on bubbles)

```css
box-shadow:
  0 4px 24px rgba(168, 85, 247, 0.20),   /* purple drop glow */
  0 0 12px rgba(236, 72, 153, 0.10);      /* pink halo */
```

---

## Greeting brightness stack (5-layer text-shadow on /new heading)

```css
text-shadow:
  0 1px 2px rgba(0, 0, 0, 0.95),         /* tight dark contour */
  0 2px 8px rgba(0, 0, 0, 0.85),         /* close shadow */
  0 4px 24px rgba(0, 0, 0, 0.7),         /* wider dark halo */
  0 0 40px rgba(168, 85, 247, 0.7),      /* purple inner glow */
  0 0 60px rgba(236, 72, 153, 0.5);      /* pink outer aura */
```

The dark layers are for legibility against any photo region (sky, buildings, asphalt all have different luminance). The colored layers tie the heading to the Aura palette.

---

## Greeting font stack (current)

```css
font-family: "Snell Roundhand", "Apple Chancery", "Brush Script MT",
             "Lucida Handwriting", "Segoe Script", cursive;
```

**Snell Roundhand** is Mac-native copperplate — Manhattan invitation/jazz-club script. **Apple Chancery** is Mac calligraphic. **Brush Script MT** / **Lucida Handwriting** / **Segoe Script** are cross-platform fallbacks.

---

## Iteration history (so future sessions don't repeat mistakes)

| Version | Change | Reason |
|---|---|---|
| v1 | Initial skin with double-gradient `background-clip` border | Failed: bottom layer bled through padding → solid gradient bubble |
| v2 | Switched to `::before` pseudo + mask-composite gradient border | Worked for bubble shape; boot photo not in place yet |
| v3 | Outermost-only AI selector via `:not(.font-claude-response *)` | Fixed nested bubbles when Claude renders multi-chunk responses |
| v4 | Composer surgical selector via `[data-chat-input-container="true"] .bg-bg-000` | DOM-survey informed; matched chat-thread layout only |
| v5 | Composer fully transparent (no border) | Anthony asked to just kill the dark fill |
| v6 | Re-added iridescent border via `::before` mask | Anthony wanted the border back |
| v7 | Composer selector → `[class~="bg-bg-000"][class~="rounded-[20px]"]` | Works on BOTH chat-thread AND new-chat layouts (no ancestor required) |
| v8 | Added new-chat greeting brightening via `main h1, main h2` | NEVER MATCHED — greeting is a `<div>` |
| v9 | Pushed brightness harder on h1/h2 selectors | Still never matched (same selector mistake) |
| v10 | DOM survey revealed greeting is `<div>`, not h1/h2 | Switched to `main > div.transition-opacity.duration-300` selector |
| v11 | Excluded SVG/brand from `*` color rule | Restored Claude orange asterisk; dropped `font-weight: 700` override |
| v12 | Snell Roundhand script font for greeting | Final aesthetic per Anthony's "scrif typeface" request |

**Lesson learned:** every "X is broken on Claude" debug should start with a 30-second DOM survey of the actual element, not 2-3 iterations of selector guessing. The probe pattern is in this repo's session log — reuse it.

---

## Asset requirements

| File | Purpose | Where |
|---|---|---|
| `boot-nyc.png` | Background photo (Timberland boot + NYC street + skyline) | `skyn-extension/public/assets/skins/aura-glass/boot-nyc.png` |
| _(optional)_ `boot-nyc.jpg` | Same image as `.jpg` — CSS tries both extensions | Same folder |

After `npm run build`, Vite copies these to `dist/assets/skins/aura-glass/`.

---

## What NOT to touch

These were settled and are working correctly. Avoid changing without strong reason:

- The pseudo-element mask trick (technique #1 above) — DO NOT switch back to `background-clip` or `border-image` (neither works for transparent-center + gradient-border + rounded-corners)
- The outermost-only AI selector pattern — this is the only thing that prevents nested bubble regressions
- The `--brand-*` non-override — ensures the Claude asterisk is visible regardless of skin
- The descendant-strip rule on `.font-claude-response *` — kills any future nested bubble surprises Claude introduces
- The `[class~="bg-bg-000"][class~="rounded-[20px]"]` composer selector — works on both layouts; replacing with anything narrower breaks new-chat
- The `:not(svg):not(svg *):not([class*="brand"])` exclusions on the greeting `*` rule — preserves the asterisk

---

## How to extend (e.g., new color variant of Aura Glass)

The cheapest path to a new variant skin (e.g., "Aura Glass Sunset" with orange/red gradients): copy this entire skin definition, change the id and name, update the iridescent gradient hex values in 4 places (user bubble, AI bubble, composer, send button — all use `linear-gradient(135deg, #ec4899 0%, #a855f7 50%, #3b82f6 100%)`), update the boot-nyc asset reference if using a different photo, update `accent` / `accent2` / `accentGlow` swatches, update `variableOverrides` `--accent-*` and `--coat-glow` to match. Everything else (selectors, masking technique, descendant strip, etc.) stays identical.

---

## Verification commands

After any change, before committing:

```bash
cd ~/Projects/skyn/skyn-extension
npx tsc -b                              # type check
npx eslint .                            # lint
node scripts/check-content-security.mjs # privacy posture check
npm run build                           # production build
ls dist/assets/skins/aura-glass/        # confirm boot-nyc.* copied through
```

All should be silent / clean. If any error: revert the change.

---

_Locked 2026-05-13 at v12. Anthony signed off on this state._
