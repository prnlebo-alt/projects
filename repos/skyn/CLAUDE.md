# Skyn — project entry point for any Claude session

If you're a Claude session opening this workspace cold, **start here.** This file is the handoff doc. It's short on purpose: it points at the right deeper reference depending on what the user is asking for.

---

## What Skyn is

Manifest V3 Chrome extension that applies CSS-only skins to Claude.ai (dark mode only). Privacy posture: skin code never reads conversation content, never accesses cookies/storage on the host page, never listens for input events. CSS injection only.

**Owner:** Anthony (MadPugExperiment LLC).
**Strategic plan:** [`SKYN_PLAN.md`](SKYN_PLAN.md) — locked May 8 2026. Decisions to NOT relitigate: marketplace-only monetization, no BYOK, no AI proxying, web app parked at `skyn-webapp-v2/`.

---

## Workspace layout

```
~/Projects/skyn/
├── CLAUDE.md                  ← you are here
├── SKYN_PLAN.md               ← locked strategic plan
├── SKYN_SESSION_LOG.md        ← append-only running session log (read recent entries first)
├── TEST_RUN_2026-05-12.md     ← initial Mecha test sheet (locked, HOLD verdict)
├── TEST_RUN_2026-05-13.md     ← post-fix verification template
├── docs/
│   ├── aura-glassmorphism-v12-reference.md   ← LOAD-BEARING tier-3 technique writeup
│   ├── MECHA-DEBUG-SESSION-PLAN.md
│   └── aura-glass-references/                ← design mockups
├── skyn-extension/            ← active V1 product (the Chrome extension)
│   ├── manifest.json          ← Manifest V3, Claude.ai-only host_permissions
│   ├── src/shared/
│   │   ├── skins.ts           ← all skin definitions
│   │   ├── skin-css-snippets.ts  ← shared selectors / strip rules / gradient-border helper. IMPORT FROM HERE.
│   │   └── types.ts
│   ├── src/content/           ← content script + tier-3 engine
│   ├── src/background/        ← service worker
│   ├── public/assets/skins/<id>/  ← bundled skin assets
│   └── docs/                  ← extension-specific docs (older session-state, MECHA verification protocol)
├── skyn-webapp-v2/            ← PARKED. Do not touch unless explicitly asked.
└── skyn-backend/              ← also parked.
```

---

## Current state (as of 2026-05-13)

**Working tier-3 skins (signed off by Anthony):**
- `aurora-glass` — "Aurora Glass": dark cosmic galaxy bg, gold accents, EB Garamond serif. Asset: `assets/skins/aurora-glass/galaxy.jpg`.
- `aura-glass` — "Aura Glassmorphism": boot/NYC photo bg, iridescent pink/purple/blue gradient borders, system sans body + Snell Roundhand script for new-chat greeting. Asset: `assets/skins/aura-glass/boot-nyc.png`.
- `mecha-v1` — "Terminal Mecha": phosphor green terminal aesthetic. Mascot SVG ships at `assets/skins/mecha/mascot.svg` (anchor selector confirmed stale on current Claude DOM; mascot deferral TBD).

**Plus 100+ tier-1/tier-2 skins** in `src/shared/skins.ts` (color/font swaps via the legacy `--coat-*` pipeline; not all selector-verified on current Claude DOM).

---

## Where to look for what

| You're trying to... | Read this first |
|---|---|
| Understand recent work / what just changed | [`SKYN_SESSION_LOG.md`](SKYN_SESSION_LOG.md) — append-only, scroll bottom-up |
| Build a new tier-3 skin | [`docs/aura-glassmorphism-v12-reference.md`](docs/aura-glassmorphism-v12-reference.md) — verified DOM selectors, gradient-border technique, do-not-touch list |
| Modify Aurora Glass or Aura Glassmorphism | Same reference doc + the `s({ id:'aurora-glass' })` / `s({ id:'aura-glass' })` blocks in `skyn-extension/src/shared/skins.ts` |
| Reuse a CSS pattern (selector / strip rule / gradient border) | `skyn-extension/src/shared/skin-css-snippets.ts` — import from here, do NOT re-derive |
| Debug "my CSS rule isn't taking effect" | DO NOT iterate on selector guesses. Ask user to run a DOM survey probe FIRST. Pattern is in the reference doc and in auto-memory `feedback_dom_survey_first.md`. |
| Mecha mascot rendering | [`docs/MECHA-DEBUG-SESSION-PLAN.md`](docs/MECHA-DEBUG-SESSION-PLAN.md) and `skyn-extension/docs/MECHA-V1-VERIFICATION.md` |
| Strategic decisions (scope, monetization, what's out) | [`SKYN_PLAN.md`](SKYN_PLAN.md) |
| Extension build + commit workflow | Workflow: defensive `.git/index.lock` cleanup → explicit-path `git add` → `extension:` prefixed commit → `npm run build` in `skyn-extension/`. Commits, pushes, and builds all run in-sandbox; no macOS-Terminal handoff needed. |

---

## Conventions in this repo

- **Owner preferences:** ruthless mentor mode, realistic, not a yes-man. Stress-test ideas. If something is bad, say why. Anthony rejects sycophancy.
- **Commits:** never include `Co-Authored-By` trailers. Atomic per logical change. Messages: `extension: <short summary>` for source changes, `docs:` for docs.
- **No npm install** ever (dependencies are locked).
- **No push to origin** without explicit user approval.
- **No web-store submission** without explicit user approval.
- **Cowork sandbox limitations:** `~/Downloads/` is NOT mounted (only `~/Projects/skyn/` and a scratch outputs dir). `npm run build` runs fine in-sandbox as of 2026-05-19 (the earlier darwin-arm64 / linux-arm64 native-binding mismatch is no longer a blocker) — always run the build to verify a refactor, since `tsc -b` catches dead locals that `tsc --noEmit` misses.
- **Backticks inside CSS comments INSIDE template literals will silently break the parse.** This bit me four times in one session before I learned. NO backticks in customCss comments. Use plain text.

---

## Patterns to follow vs. patterns to avoid

**Follow:**
- Tier-3 skins use `variableOverrides` + `customCss` + optional `mascotPath`.
- Import strip rules and verified selectors from `skin-css-snippets.ts` instead of duplicating inline.
- Use the pseudo-element mask-composite trick for gradient borders on rounded-corner elements (only path that works for transparent center).
- Use `:not(.font-claude-response *)` on AI bubble selectors to enforce outermost-only matching.
- DOM-survey before writing a new selector for an unfamiliar element.

**Avoid:**
- Wide selector nets ("guess and pray" approach). Two iterations max before doing a DOM survey.
- `border-image` for rounded-corner gradient borders (doesn't follow `border-radius`).
- `background-clip: padding-box, border-box` (the bottom layer bleeds through padding).
- Substring `[class*="font-claude-response" i]` for the AI bubble (matches at multiple nesting levels → double bubbles). Use exact class `.font-claude-response` instead.
- Stale selectors: `[data-testid="assistant-turn"|"composer"|"chat-input-area"|"sidebar-menu"]`, `.font-claude-message`, `main h1/h2` for the new-chat greeting. None match current Claude DOM. The reference doc has the full do-not-use list.

---

## When you finish a session

Append an entry to [`SKYN_SESSION_LOG.md`](SKYN_SESSION_LOG.md) covering: what was asked, what was done, what's still open, files modified, static-check results, and (if applicable) the commit hash and build verification. One entry per focused chunk of work — keep them scannable.

If you discovered a new repeated pattern, add it to `skin-css-snippets.ts` so the next session benefits.

If you discovered a new "do not do this" lesson, add it to the auto-memory `feedback_*.md` files under the spaces memory directory.
