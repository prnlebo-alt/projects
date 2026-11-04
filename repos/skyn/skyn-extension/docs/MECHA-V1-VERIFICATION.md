# MECHA V1 — SELF-VERIFICATION PROTOCOL

**Purpose:** Run the 5 acceptance checks manually against `dist/` loaded as an
unpacked extension in your daily Chrome. Each AC has a paste-into-DevTools JS
probe and an unambiguous PASS / FAIL rule against the JSON it returns.

**Prereq facts to know going in:**
- Mecha is **dark-mode only**. In light mode, Mecha CSS is scope-skipped —
  the `#skyn-theme` tag may still exist in the DOM, but Mecha rules must not
  affect computed styles.
- Root scope selector: `html[data-theme="claude"][data-mode="dark"][data-color-version="v2"]`.
- Mecha overrides `--font-claude-response` and `--font-user-message` to
  `var(--font-mono)`, where `--font-mono` resolves to
  `"Anthropic Mono", ui-monospace, monospace`.
- Stale selectors (`.font-claude-message`, `.bg-bg-200`) are pre-existing rot
  in `platforms.ts`. They do NOT block Mecha and should NOT be used as pass
  criteria.

---

## ONE-TIME SETUP

1. In Chrome: `chrome://extensions` → toggle **Developer mode** ON → **Load
   unpacked** → select `/Users/jessicasalgado/Projects/skyn/skyn-extension/dist`.
2. Confirm the Skyn extension card appears with version `1.0.0` and no errors.
   If errors, screenshot them and stop — don't run the ACs.
3. Pin the Skyn icon to the toolbar (puzzle icon → pin Skyn).
4. Open the Skyn popup → select **Mecha**. Close popup.
5. Open `https://claude.ai`. Sign in if needed. Navigate into a **real chat
   thread** (`claude.ai/chat/<id>`). Not `/new`. Not `/settings`. A thread with
   at least one user message and one AI response visible.
6. Open DevTools (⌘⌥I). Switch to **Console** tab. Clear it.

---

## THE UNIVERSAL PROBE

Paste this every time the protocol says "run the probe." Same script for all
ACs — the PASS/FAIL rules change, not the script.

```js
(() => {
  const html = document.documentElement;
  const style = id => document.getElementById(id);
  const cs = getComputedStyle(html);
  const get = v => cs.getPropertyValue(v).trim();
  const styleTag = style('skyn-theme');
  const sample = (s, n=120) => s ? s.slice(0, n).replace(/\s+/g, ' ') : null;

  const userBubble = document.querySelector('[data-user-message-bubble="true"]');
  const userBubbleCs = userBubble ? getComputedStyle(userBubble) : null;

  const aiResponse = document.querySelector('[data-testid^="message-"]:not([data-user-message-bubble])')
    || document.querySelector('[class*="font-claude-message"]')
    || document.querySelector('main article');
  const aiCs = aiResponse ? getComputedStyle(aiResponse) : null;

  return JSON.stringify({
    url: location.href,
    htmlAttrs: {
      theme: html.getAttribute('data-theme'),
      mode: html.getAttribute('data-mode'),
      colorVersion: html.getAttribute('data-color-version'),
    },
    skynStyleTag: {
      exists: !!styleTag,
      charCount: styleTag?.textContent?.length || 0,
      firstChars: sample(styleTag?.textContent),
    },
    cssVars: {
      fontClaudeResponse: get('--font-claude-response'),
      fontUserMessage: get('--font-user-message'),
      fontMono: get('--font-mono'),
      fontSerif: get('--font-serif'),
      bg100: get('--bg-100'),
      accent100: get('--accent-100'),
      brand200: get('--brand-200'),
      coatGlow: get('--coat-glow'),
    },
    htmlBg: cs.backgroundColor,
    userBubble: userBubble ? {
      found: true,
      fontFamily: userBubbleCs.fontFamily,
      backgroundColor: userBubbleCs.backgroundColor,
      borderLeft: userBubbleCs.borderLeft,
      boxShadow: userBubbleCs.boxShadow,
    } : { found: false },
    aiResponseSampleFont: aiCs ? aiCs.fontFamily : null,
    selectors: {
      userBubbleCount: document.querySelectorAll('[data-user-message-bubble="true"]').length,
      sidebarCount: document.querySelectorAll('[data-testid="sidebar-menu"]').length,
    },
    mascot: {
      inDom: !!document.querySelector('#skyn-mecha-mascot, [data-skyn-mascot], img[src*="mascot.svg"]'),
      pseudoMaybe: (() => {
        const sb = document.querySelector('[data-testid="sidebar-menu"]');
        if (!sb) return null;
        const before = getComputedStyle(sb, '::before').backgroundImage;
        const after = getComputedStyle(sb, '::after').backgroundImage;
        return { before, after };
      })(),
    },
    diagFlag: !!window.SKYN_DIAG,
  }, null, 2);
})()
```

Copy the entire JSON output and save it to your scratchpad under the AC label.

---

## AC#1 — LIGHT-MODE REGRESSION

**Setup:**
1. Skyn popup → confirm Mecha is the active skin.
2. Claude.ai → Settings (gear) → Appearance → **Light**.
3. Back to a chat thread. Hard refresh (⌘⇧R).
4. Visual check first: AI text should be in Claude's normal serif/sans, NOT
   monospace. User bubble should be Claude's default (no phosphor-green stripe,
   no glow). Sidebar should look stock.
5. Run the universal probe.

**PASS rules (all must hold):**
- `htmlAttrs.mode === "light"`
- `cssVars.fontClaudeResponse` does NOT equal `cssVars.fontMono` (it should be
  Claude's serif default — typically `var(--font-serif)` or an Anthropic Serif
  family). It is OK for the resolved value to still be a `var(...)` reference;
  what matters is it isn't the mono one.
- `cssVars.fontUserMessage` does NOT equal `cssVars.fontMono`.
- `userBubble.fontFamily` does not contain `"Anthropic Mono"`.
- `userBubble.borderLeft` is a zero / `0px none rgb(...)` value, NOT a colored
  phosphor-green stripe. (If `userBubble.found === false` because you're on a
  thread without messages, that's fine — re-check on a thread with at least
  one user message.)
- `userBubble.boxShadow` does not contain a green/cyan glow (no
  `rgb(0, 255, ...)` or similar phosphor color).

**FAIL signals (any one of these = fail):**
- `htmlAttrs.mode === "light"` AND any of the font vars above resolve to mono.
- User bubble shows a colored `borderLeft` width > 0 or a phosphor-colored
  `boxShadow`.
- AI response `fontFamily` contains `"Anthropic Mono"`.

**Note:** `skynStyleTag.exists === true` in light mode is NOT a fail. The
style tag is injected unconditionally; its rules are scoped to `[data-mode="dark"]`
so they don't apply. Don't conflate "tag in DOM" with "rules applied."

---

## AC#2 — DARK-MODE RE-APPLY

**Setup:**
1. Settings → Appearance → **Dark**.
2. Confirm in popup that Mecha is still the active skin.
3. Hard refresh (⌘⇧R) on a real chat thread.
4. Visual check first:
   - Background is deep near-black (not Claude's default dark gray).
   - AI response text renders in Anthropic Mono.
   - User message bubble has a phosphor-green left stripe with glow.
   - Anthropic asterisk (brand orange) is preserved.
5. Run the probe.

**PASS rules (all must hold):**
- `htmlAttrs.mode === "dark"`
- `htmlAttrs.theme === "claude"`
- `htmlAttrs.colorVersion === "v2"`
- `skynStyleTag.exists === true` and `charCount > 500` (sanity floor; Mecha
  CSS is non-trivial).
- `cssVars.fontMono` contains `"Anthropic Mono"`.
- `cssVars.fontClaudeResponse` resolves to (or references) the mono token.
  Acceptable forms: `var(--font-mono)` or a resolved family string containing
  `"Anthropic Mono"`.
- `cssVars.fontUserMessage` resolves to the mono token by the same rule.
- `userBubble.fontFamily` contains `"Anthropic Mono"`.
- `userBubble.borderLeft` shows a non-zero width and a phosphor color
  (something in the green range — substring `rgb(0, ` with a high middle
  channel, or hex `#0` something). Exact value depends on the Mecha definition
  in `src/shared/skins.ts`.
- `userBubble.boxShadow` contains a glow (non-`none`).

**FAIL signals:**
- `skynStyleTag.exists === false` or `charCount < 100` → injection broke.
- `htmlAttrs.mode === "dark"` but font vars still resolve to serif → scoping
  bug or skin not active.
- User bubble has no left stripe in dark mode → Mecha customCss is not landing.

---

## AC#3 — SPA NAVIGATION PERSISTENCE

**Setup:**
1. Stay in dark mode, Mecha active, on a chat thread. Do not refresh.
2. Open a DevTools watcher first: in Console, paste:
   ```js
   (() => {
     const t = document.getElementById('skyn-theme');
     return { exists: !!t, len: t?.textContent.length || 0, urlAtCapture: location.href };
   })()
   ```
   Record this baseline.
3. In Claude's sidebar, click a **different** conversation. URL should change
   from `/chat/<id1>` to `/chat/<id2>` without a full page reload.
4. Wait ~2 seconds for SPA transition to settle. Watch for any flash of
   default Claude (white/default-gray bg) during the transition.
5. Re-run the same baseline snippet.
6. Run the full universal probe.

**PASS rules:**
- `urlAtCapture` differs between the before and after captures (proves SPA
  nav happened).
- `skynStyleTag.exists === true` after nav, `charCount` is the same or higher
  (no shrinkage).
- Visual: no flash of default Claude during transition. AI font remains mono.
  User bubble still has phosphor stripe.
- Full probe shows same dark-mode PASS criteria as AC#2.

**FAIL signals:**
- Style tag missing or character count drops to 0 after nav.
- Visible flash of default Claude (parchment beige, no stripe, serif AI text)
  during the SPA transition longer than ~150ms.
- Mecha never re-paints on the new conversation (permanent revert).

---

## AC#4 — TOGGLE OFF / CLEAN REVERT

**Setup (pick ONE of the two paths):**

Path A — master toggle off:
1. Open Skyn popup.
2. Flip the master toggle to OFF (if the popup has one).
3. Hard refresh Claude.ai (⌘⇧R).

Path B — switch to a different non-personality skin:
1. Open Skyn popup.
2. Pick any non-Mecha skin (e.g. Midnight or Snow).
3. Hard refresh.

Then:
4. Visual check: page should look like vanilla Claude.ai dark mode (or
   whichever skin you picked). No phosphor stripe on user bubbles. AI text
   back to serif/sans. No drifting scanline overlay. Background is Claude's
   default dark, not Mecha's near-black.
5. Run the universal probe.

**PASS rules:**
- For Path A: `skynStyleTag.exists === false` OR `charCount === 0`.
  For Path B: `skynStyleTag.exists === true` but `firstChars` does not mention
  Mecha-specific identifiers (no `mecha`, no scanline keyframe).
- `cssVars.fontClaudeResponse` is back to Claude's default (not mono).
- `userBubble.fontFamily` does NOT contain `"Anthropic Mono"`.
- `userBubble.borderLeft` width is 0.
- `userBubble.boxShadow` is `none` (or Claude's default, whatever that is).

**FAIL signals:**
- Any Mecha residue: phosphor stripe still present, AI text still mono,
  scanline still visible.
- Style tag still contains Mecha rules after switching skins.

---

## AC#5 — MASCOT RENDERING

**Setup:**
1. Skyn popup → re-select Mecha.
2. Dark mode confirmed.
3. Hard refresh on a chat thread.
4. **Visual check is the primary check here.** Look at the bottom-left of
   Claude's sidebar (where the workspace / user-account block sits). The
   Mecha mascot SVG should be visible.
5. Run the universal probe for the data half.

**PASS rules:**
- Visual: mascot SVG visible in expected location.
- Probe: `selectors.sidebarCount >= 1` (the anchor element exists).
- Probe: `mascot.inDom === true` OR `mascot.pseudoMaybe.before/after`
  contains a `url(...)` referencing `mascot.svg`.

**FAIL signals (any of which trigger the v1.1 deferral path):**
- `selectors.sidebarCount === 0` → `[data-testid="sidebar-menu"]` is stale,
  Claude renamed the anchor. Mascot can't render. → **Defer mascot to v1.1**,
  ship Mecha v1 without mascot, update session-state doc.
- Sidebar matches but mascot isn't visible → check `web_accessible_resources`
  in `manifest.json`, confirm `public/assets/skins/mecha/mascot.svg` exists
  and is bundled into `dist/`.

**Deferral decision rule (from session state, point 5 of V1 Ship Criteria):**
> AC#5 mascot renders OR mascot is officially deferred to v1.1 with a
> documented "coming soon" placeholder.

So an AC#5 fail does not block ship — it converts to a deferral. Document
the deferral in the session-state doc and proceed.

---

## REPORTING BACK

Paste back to me in a fresh session in this exact shape:

```
AC#1: PASS | FAIL
<paste probe JSON>

AC#2: PASS | FAIL
<paste probe JSON>

AC#3: PASS | FAIL
<paste probe JSON>
<also paste the small SPA-nav snippet before/after pair>

AC#4: PASS | FAIL (path: A or B)
<paste probe JSON>

AC#5: PASS | FAIL | DEFERRED
<paste probe JSON>
<one-line note on visual check>
```

I'll cross-check the JSON against the rules above and confirm ship readiness
or itemize blockers.

---

## POST-VERIFICATION CLEANUP

If all 5 ACs land (AC#5 may be DEFERRED), the remaining v1 ship items per
the session-state doc are:

- [ ] `SKYN_DIAG = false` in `src/content/index.ts`
- [ ] Re-run `npm run build` so dist matches
- [ ] If AC#5 deferred: add a "coming soon" placeholder note in
      `docs/skyn-session-state.md` and `SKYN_PLAN.md` parking-lot section
- [ ] Confirm dist is resubmission-ready (manifest version, web_accessible_resources)

Those are explicit follow-ups, not part of the verification itself.
