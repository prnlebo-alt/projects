# SKYN SESSION STATE — HANDOFF DOC

**Purpose:** Capture exactly where Skyn / Terminal Mecha is right now, so a
fresh Claude Code session (post Chrome DevTools MCP install, post `/clear`)
can resume without re-running 6 hours of discovery.

**Date of capture:** Saturday night, session-ending handoff.
**Owner:** Anthony (MadPugExperiment LLC).
**Project root:** `~/Projects/skyn/skyn-extension/`

---

## STATUS SUMMARY

- **Engine rewrite:** ✅ Complete. Skyn now overrides Claude.ai's native CSS
  variables instead of fighting Tailwind classes. Strategy validated.
- **Terminal Mecha skin:** ✅ Painting correctly in dark mode on a real chat
  thread (`/chat/<id>`). Verified visually: deep near-black background,
  Anthropic Mono AI response font, phosphor-green user-bubble stripe with glow,
  fully usable sidebar, brand orange asterisk preserved (two-tone).
- **Light-mode leak:** ✅ Fixed in last Claude Code turn. 4 scope prefixes
  added to `skins.ts` and `injector.ts` so `customCss` rules (font, bubble,
  scanline) only apply under `html[data-theme="claude"][data-mode="dark"]`.
- **AC list run:** ⏳ Queued but not executed. Next action.
- **Mascot:** ❌ Not yet shipped. Last v1 item after AC list passes.
- **Hover/focus glow:** ❌ Slipped to v1.1 polish (documented in code).
- **MCP install:** ⏳ Planned for next session before resuming AC list.

---

## ARCHITECTURE (PRESERVED, DO NOT REWRITE)

```
index.ts → injectDefaultTheme() → refreshTheme() →
  getSyncStorage() + getLocalStorage() → applyStoredTheme(sync, local) →
  getSkinById() → injectFont() → injectThemeCss() →
  buildThemeCss() → assigns to <style id="skyn-theme">
```

Storage uses `chrome.storage.sync.activeSkinId`. The `isApplying` reentrancy
guard in `applyStoredTheme` is intact. `src/content/observer.ts` provides SPA
navigation listening (`startSpaObserver`).

---

## KEY PLATFORM FACTS (Claude.ai)

These are *verified* facts from tonight's diagnostic dumps, not inferred.

- **Root scoping selector:** `html[data-theme="claude"][data-mode="dark"][data-color-version="v2"]`
- **Mode attribute:** `data-mode="dark"` or `data-mode="light"` on `<html>`
- **Color version attribute:** `data-color-version="v2"` (versioning risk —
  Anthropic could ship `v3` and break the selector. Documented as v1.1 risk.)
- **Theming surface:** 200+ CSS variables on `<html>`. Public semantic tokens
  have no underscore prefix (`--bg-100`, `--text-000`, `--accent-100`,
  `--brand-200`, `--danger-200`, `--warning-900`, `--oncolor-100`). Private
  palette tokens prefixed with underscore (`--_blue-*`, `--_red-*` etc.) —
  do NOT override these.
- **Font tokens (verified):**
  - `--font-system: system-ui, sans-serif`
  - `--font-mono: "Anthropic Mono", ui-monospace, monospace` ← used by Mecha
  - `--font-ui: "Anthropic Sans", system-ui, ...`
  - `--font-sans-serif: "Anthropic Sans", ...`
  - `--font-ui-serif: "Anthropic Serif", ...`
  - `--font-claude-response: var(--font-serif)` ← Mecha overrides to `var(--font-mono)`
  - `--font-user-message: var(--font-sans-serif)` ← Mecha overrides to `var(--font-mono)`
  - `--font-dyslexia: "OpenDyslexic", ...` (accessibility token, don't touch)
- **Bubble selector:** `[data-user-message-bubble="true"]` (verified in
  diagnostic, match count > 0 on chat threads)
- **User message inner element:** `[data-testid="user-message"]`
- **Sidebar selector:** still uses `[data-testid="sidebar-menu"]` per
  platforms.ts — mascot anchors here, but selector match count is
  **unverified** in current Claude build. Mascot rendering blocked until
  Claude Code re-verifies via MCP.
- **AI bubble selectors:** `.font-claude-message` and `.bg-bg-200` are
  STALE in current Claude build (match count 0). Pre-existing rot, not
  Mecha-blocking. Mecha's AI mono font comes from `--font-claude-response`
  override, not from any class selector.

---

## SCOPE DECISIONS LOCKED (don't relitigate)

1. **Mecha is dark-only.** Scope is `[data-mode="dark"]`. If Claude.ai is in
   light mode, Mecha does NOT apply. This is correct product behavior.
2. **Two-tone palette.** Brand orange (Anthropic asterisk) stays orange.
   Phosphor green is the accent. No "everything goes green" override.
3. **Anthropic Mono everywhere.** Use Claude's native `--font-mono` rather
   than Google Fonts. Native typography, no licensing, no font loading.
4. **No `!important` salting.** Only two legitimate uses, on inline-styled
   font vars on `<html>`. Both commented with rationale. Anywhere else =
   smell.
5. **Native CSS variable override strategy.** Don't fight Tailwind classes.
   Override `:root` variables under the scoped selector. Variable map lives
   in `Skin.variableOverrides`. Anything not variable-controllable (mascot
   pseudo-element, scanline overlay) lives in `Skin.customCss`, scope-prefixed.

---

## DIAGNOSTIC TOOLING (in codebase)

`SKYN_DIAG = true` flag in `src/content/index.ts` enables:
- Auto-download of `skyn-diag-<mode>.txt` on every Claude.ai page load
- Logs HTML opening tag, `<html>` CSS vars, `<body>` CSS vars, bubble element
  vars, SKYN style tag content, platform selector match counts, all `<style>`
  tag inventory (id + first 200 chars)
- Save to `~/Downloads/skyn-diag-*.txt`

Toggle off (`SKYN_DIAG = false`) after v1 ships. Keep code in repo as
debug utility for future skin development.

---

## OPEN AC LIST (NEXT ACTION)

Five-step verification, run in dark mode on a real chat thread
(`claude.ai/chat/<id>`, NOT `/new` and NOT `/settings`):

1. **Light-mode regression check.** With Mecha selected, Claude.ai in light
   mode, hard-refresh. Expected: ZERO Mecha visible (no mono, no stripe, no
   scanline). If any Mecha residue → leak fix incomplete.
2. **Dark mode re-apply.** Switch Claude.ai to dark, hard-refresh. Expected:
   full Mecha render returns intact.
3. **SPA navigation persistence.** In dark mode with Mecha active, click a
   different conversation in the sidebar (no page refresh). Expected: Mecha
   stays applied, no flash of default Claude, no permanent revert.
4. **Toggle off / clean revert.** Open Skyn popup, flip master toggle OFF
   OR pick a different non-personality skin. Hard-refresh. Expected: clean
   default Claude.ai, no leftover phosphor green, no leftover stripe, AI
   font back to serif.
5. **Mascot rendering.** Re-activate Mecha, dark mode, hard-refresh. Look
   at bottom-left of sidebar. Expected: SVG mecha mascot visible. If absent:
   verify `[data-testid="sidebar-menu"]` still matches via diagnostic dump.

---

## KNOWN DEBT (don't fix tonight, document for later)

- `messages` and `.font-claude-message` selectors in `platforms.ts` are
  stale. Affects tier-1/tier-2 skins, not Mecha.
- `data-color-version="v2"` is a versioning attribute Anthropic may bump.
  Scope strategy needs decision: lock to v2, or drop the version constraint
  and let variable overrides apply across versions.
- `observer.ts` may have double-patched `pushState`/`replaceState` from a
  prior Claude Code session. Unconfirmed, low risk for now.
- Original `fix-dist-manifest.mjs` line 44 (unconditional WAR strip) was
  removed. Original purpose unknown. Two crxjs auto-injected JS chunks
  appear in dist `web_accessible_resources`. Likely benign. Address
  before Web Store resubmission.
- **Skyn popup audit owed.** Anthony does not currently know what the
  Background mode, Intensity slider, Share setup, or the unlock-more flow
  do at runtime. They are pre-existing (May 6 mtime), not scope creep, but
  must be understood end-to-end before Web Store listing.
- Single-platform support only (Claude.ai). Gemini and ChatGPT support is
  V2 ambition, not V1 scope. Each platform requires its own diagnostic
  discovery cycle.

---

## V1 SHIP CRITERIA

Mecha v1 is shippable when ALL true:

- [ ] AC#1 light-mode regression passes
- [ ] AC#2 dark-mode render passes
- [ ] AC#3 SPA nav passes
- [ ] AC#4 toggle-off clean revert passes
- [ ] AC#5 mascot renders OR mascot is officially deferred to v1.1 with
      a documented "coming soon" placeholder
- [ ] `SKYN_DIAG = false` set
- [ ] Build clean, dist resubmission-ready

Hover/focus glow on Mecha: NOT required for v1. Variable is set
(`--coat-glow` in `variableOverrides`), selector rules slipped to v1.1.

---

## FILES TOUCHED THIS SESSION

Per `find -newer` audit on May 10:

- `src/shared/skins.ts` — Mecha skin definition with `variableOverrides` +
  scoped `customCss`
- `src/shared/types.ts` — Skin interface updated for `variableOverrides`
- `src/content/index.ts` — diagnostic v2 (auto-download, style-tag inventory)
- `src/content/injector.ts` — `buildClaudeMechaCss` + `buildClaudeMascotCss`
  rewrites, scope-prefix fixes for light-mode leak
- `src/shared/platforms.ts` (or equivalent platform selector files) — refined
  `CLAUDE_SELECTORS` map
- `public/assets/skins/mecha/mascot.svg` — SVG mascot asset (placeholder,
  Option A in original brief)
- `manifest.json` — `web_accessible_resources` for skin assets

Popup files (App.tsx, popup.css, components/*.tsx) NOT touched this session
— mtime May 6.

---

## RESUME PROTOCOL FOR NEXT CLAUDE CODE SESSION

After Chrome DevTools MCP installs and verifies, fresh session prompt:

> Read `docs/skyn-session-state.md` end to end. Then resume the AC list
> defined under OPEN AC LIST. Use Chrome DevTools MCP to drive the
> verification yourself — do not ask me to paste console output or take
> screenshots unless visual judgment is genuinely needed (e.g., "does the
> mascot look right" is visual; "does data-mode equal dark" is not).
>
> Report each AC pass/fail with one-line evidence. After all 5 pass,
> propose final ship decisions: SKYN_DIAG toggle, mascot ship/defer,
> any final cleanup.

---

End of state capture.
