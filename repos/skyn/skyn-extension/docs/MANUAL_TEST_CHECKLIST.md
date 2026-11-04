# MANUAL TEST CHECKLIST — Skyn extension v1

This is the human-driven sweep before submitting the v1 build to the Chrome
Web Store. It covers install, popup, free skins, Mecha (the only fully
verified personality skin in v1), the five Mecha ACs, the locked-skin
purchase flow, and a final ship gate.

The five Mecha-specific ACs in sections **E–I** are detailed step-by-step
in `docs/MECHA-V1-VERIFICATION.md` — this file links out for those, rather
than duplicating their probe JS.

**Provenance note:** This checklist was authored fresh in this session from
the current repo state (Mecha-only V1 scope, dist build, the 5 ACs). It is
not a recovery of any prior session's wording.

---

## How to use this doc

Run sections in order. Each item is a `- [ ]` checkbox — strike through or
flip to `- [x]` as you go. Each section has a **PASS** rule (the explicit
condition that makes the section a green light) and a **FAIL** rule (the
condition that blocks ship until fixed). If you hit a FAIL, write down the
observed state under the section before moving on.

Reset between sections is fine. Do not reset between AC#3 (SPA nav) and
the rest of E–I — they need continuity.

---

## A. Install + dist sanity (extension load)

Goal: confirm the production `dist/` loads cleanly into Chrome as an
unpacked extension, with no errors and the right pinned files.

Steps:
- [ ] `cd skyn-extension && npm run build` runs clean (no errors, no
      type warnings)
- [ ] In Chrome, open `chrome://extensions`
- [ ] Toggle **Developer mode** ON (top-right)
- [ ] Click **Load unpacked** → select `skyn-extension/dist/`
- [ ] Extension card appears with name **Skyn**, version **1.0.0**
- [ ] No red "Errors" badge on the extension card
- [ ] Pin the Skyn icon to the toolbar (puzzle icon → pin)
- [ ] Open `chrome://extensions` → click the extension's "Details" → scroll
      to **Permissions**. Verify these and ONLY these are present:
      - "Read your data on `claude.ai` and `skynapp.app`"
      - No mention of `chat.openai.com`, `chatgpt.com`, or
        `gemini.google.com` (those were trimmed in v1 to match verified scope)

PASS: card loads with no errors, permissions are Claude-only +
`skynapp.app`, icon pinned.

FAIL: any error in the card, missing icons, unexpected host permissions,
or load failure.

---

## B. Popup smoke test

Goal: the popup opens, renders without console errors, and the basic
catalog UI is intact.

Steps:
- [ ] Click the Skyn toolbar icon → popup opens
- [ ] Right-click the popup → "Inspect" → Console tab → confirm no red
      errors at popup load
- [ ] Popup shows a skin catalog (gallery of skin cards)
- [ ] At least the three free skins are visible: **Midnight**, **Snow**,
      **Glass Day**
- [ ] **Mecha** is visible in the catalog
- [ ] Locked/paid skins (e.g. iMessage, Cracked Terminal, Sorbet Botanical,
      Neon Rain City, Tropical Canopy) show a lock indicator or "Buy"
      affordance — not just a free Apply button
- [ ] Close popup, reopen → state persists (whatever was selected/scrolled
      restores cleanly)

PASS: popup renders, no console errors, free/locked distinction is visible.

FAIL: console errors at popup load, missing free skins, locked skins
appearing as free, popup blank or crashes.

---

## C. Free-skin apply on Claude.ai

Goal: each of the three free skins applies on Claude.ai without errors
and visibly changes the page.

Steps (repeat for each free skin):
- [ ] Open `https://claude.ai` and navigate into a real chat thread
      (`/chat/<id>`, not `/new`, not `/settings`)
- [ ] Open Skyn popup → click **Midnight** → close popup
- [ ] Claude.ai visibly changes (background, accents, or panel chrome
      shift to match the Midnight palette)
- [ ] No flash of broken page, no obvious layout breakage (sidebar still
      functions, input still focused, AI text still readable)
- [ ] DevTools Console on the Claude tab shows no red errors attributable
      to Skyn (filter for "skyn")
- [ ] Repeat for **Snow**
- [ ] Repeat for **Glass Day**

PASS: all three free skins apply, page is usable, no Skyn-attributable
console errors.

FAIL: any free skin doesn't apply, breaks layout enough to make Claude
unusable, or produces console errors.

NOTE: Per `docs/skyn-session-state.md`, the tier-1/-2 selectors
(`.font-claude-message`, `.bg-bg-200`) in `src/content/platforms/*.ts`
are documented as stale. If a free skin looks incomplete on Claude (e.g.
AI bubble doesn't take on the skin's font/color), that is **known debt**,
not a v1 ship blocker for Mecha. Note observed gaps but do not fail this
section over them.

---

## D. Mecha activation

Goal: prime the Mecha verification suite. After this section, sections
E–I run back-to-back without resetting.

Steps:
- [ ] Open Skyn popup → click **Mecha** → close popup
- [ ] Open `https://claude.ai` in a real chat thread, **dark mode**
      (Settings → Appearance → Dark)
- [ ] Hard refresh (⌘⇧R / Ctrl+Shift+R)
- [ ] Page visibly shifts to Mecha: deep near-black background, Anthropic
      Mono on AI responses, phosphor-green stripe on user message bubbles,
      brand orange asterisk preserved
- [ ] Open DevTools (⌘⌥I) → Console. Keep DevTools open for E–I.

PASS: Mecha visibly applied, DevTools open and clean.

FAIL: Mecha doesn't render in dark mode after hard refresh → stop and
investigate before proceeding to E–I.

---

## E. AC#1 — Light-mode regression (Mecha must NOT apply in light mode)

Drive this section per `docs/MECHA-V1-VERIFICATION.md` § "AC#1 — LIGHT-MODE
REGRESSION".

Quick summary:
- [ ] Settings → Appearance → **Light**
- [ ] Hard refresh
- [ ] Page returns to vanilla Claude (no phosphor stripe, AI text in serif/
      sans, no mono)
- [ ] Paste the universal probe from MECHA-V1-VERIFICATION.md, verify the
      AC#1 PASS rules

PASS: probe JSON matches MECHA-V1-VERIFICATION.md AC#1 PASS rules.

FAIL: any Mecha rule applies in light mode (font vars mono, stripe present,
glow present).

---

## F. AC#2 — Dark-mode re-apply

Drive this section per `docs/MECHA-V1-VERIFICATION.md` § "AC#2 — DARK-MODE
RE-APPLY".

Quick summary:
- [ ] Settings → Appearance → **Dark**
- [ ] Hard refresh
- [ ] Full Mecha render (deep bg, mono AI, phosphor stripe, brand asterisk
      orange)
- [ ] Probe JSON matches AC#2 PASS rules in MECHA-V1-VERIFICATION.md

PASS: AC#2 PASS rules all hold.

FAIL: any of the dark-mode PASS rules miss.

---

## G. AC#3 — SPA navigation persistence

Drive this section per `docs/MECHA-V1-VERIFICATION.md` § "AC#3 — SPA
NAVIGATION PERSISTENCE".

Quick summary:
- [ ] Capture baseline (small probe before nav)
- [ ] Click a different conversation in the sidebar (URL changes, no full
      reload)
- [ ] No flash of vanilla Claude during transition
- [ ] Re-run baseline + full probe, AC#3 PASS rules hold

PASS: style tag persists, character count stable, no flash > ~150ms.

FAIL: style tag drops, flash of default Claude, or permanent revert.

---

## H. AC#4 — Toggle off / clean revert

Drive this section per `docs/MECHA-V1-VERIFICATION.md` § "AC#4 — TOGGLE OFF
/ CLEAN REVERT".

Quick summary (pick Path A or B from the verification doc):
- [ ] Toggle Skyn master off OR switch to a non-personality skin
- [ ] Hard refresh
- [ ] No Mecha residue (no phosphor stripe, AI text back to serif/sans,
      background back to Claude default)
- [ ] Probe JSON matches AC#4 PASS rules

PASS: AC#4 PASS rules hold for the chosen path.

FAIL: any Mecha residue remains.

---

## I. AC#5 — Mascot rendering

Drive this section per `docs/MECHA-V1-VERIFICATION.md` § "AC#5 — MASCOT
RENDERING".

Quick summary:
- [ ] Re-select Mecha
- [ ] Hard refresh in dark mode
- [ ] Look at bottom-left of Claude's sidebar for the mascot SVG
- [ ] If visible: PASS
- [ ] If sidebar selector matches but mascot absent: investigate
      `web_accessible_resources` and the mascot CSS path
- [ ] If sidebar selector `[data-testid="sidebar-menu"]` has zero matches:
      mark **DEFERRED to v1.1**, document in session state, proceed

PASS or DEFERRED is acceptable for ship. Full FAIL only if mascot fails
for a reason other than the stale-sidebar-selector case.

---

## J. Locked / paid-skin purchase flow

Goal: confirm that clicking a paid skin opens checkout through the service
worker, and that the skin stays locked until a license is present.

Steps:
- [ ] Open Skyn popup → click a paid skin (e.g. **iMessage** or **Cracked
      Terminal**)
- [ ] A checkout-related action fires: either a new tab opens to a Stripe
      checkout URL (sandbox or live depending on current build config),
      OR a "buy" modal appears in the popup
- [ ] The skin does NOT apply to Claude.ai (it stays locked, since no
      license is present yet)
- [ ] DevTools on the popup shows no console errors during the click
- [ ] In `chrome://extensions` → Service worker → Inspect, the service
      worker logs a message about handling the buy intent (or at minimum
      no red errors)
- [ ] Cancel/close the checkout flow → return to popup → skin still shows
      as locked

PASS: click → checkout opens, skin stays locked, no errors in popup or
service worker.

FAIL: paid skin applies without a license, no checkout flow opens,
service-worker red errors, or popup crashes.

NOTE: A full end-to-end purchase test (real Stripe sandbox card → license
issued → skin unlocks) is **Week 5 work per SKYN_PLAN.md**, not a v1-ship
gate. This section only verifies the front-of-flow click handler.

---

## K. Final ship gate (privacy, console, storage)

Goal: prove the v1 build doesn't leak data, doesn't error in the console
during normal use, and doesn't bloat extension storage with junk.

Steps:
- [ ] On the Claude.ai tab with Skyn active, DevTools → Network tab →
      filter for `skynapp.app` and for `claude.ai`. Confirm Skyn makes no
      outbound requests during normal page load (it should NOT phone home
      unless the user clicks a paid skin)
- [ ] DevTools → Application tab → Storage → Extensions → Skyn. Confirm
      the stored values look like skin settings (activeSkinId, etc.) and
      do NOT contain user conversation text or sensitive strings
- [ ] DevTools → Console → run a 5-minute mixed-use session on Claude
      (type a message, click around, change conversations, open settings).
      Confirm NO red errors attributable to Skyn appear during that session
- [ ] On the popup: open DevTools → Console → repeat. Confirm no red
      errors from popup mount, skin switching, or popup close
- [ ] Confirm `SKYN_DIAG` is OFF — no `~/Downloads/skyn-diag-*.txt` file
      gets auto-created during any of the above. (If one appears, the
      flag is still on and the build is non-shippable.)
- [ ] Open `chrome://extensions` → Details → Site access. Confirm Skyn
      requests access only to `claude.ai` and `skynapp.app`.

PASS: zero outbound network calls during normal use, no user content in
storage, no red console errors over a 5-min session, no diag download
file, host permissions Claude+skynapp only.

FAIL: any outbound request to a non-Skyn domain not triggered by user
intent, any user-content string in storage, any sustained console error,
any unexpected file in `~/Downloads`, or unexpected host permissions.

---

## Cross-reference: 5 ACs ↔ checklist sections

| AC | Section | Detailed protocol |
|---|---|---|
| AC#1 light-mode regression | **E** | `docs/MECHA-V1-VERIFICATION.md` AC#1 |
| AC#2 dark-mode re-apply | **F** | `docs/MECHA-V1-VERIFICATION.md` AC#2 |
| AC#3 SPA nav persistence | **G** | `docs/MECHA-V1-VERIFICATION.md` AC#3 |
| AC#4 toggle off revert | **H** | `docs/MECHA-V1-VERIFICATION.md` AC#4 |
| AC#5 mascot rendering | **I** | `docs/MECHA-V1-VERIFICATION.md` AC#5 |

Sections A–D are setup. Section J covers the marketplace front-of-flow.
Section K is the privacy + console + storage gate.

---

## Ship gate summary

v1 ships when:
- All of **A, B, C, D, J, K** pass
- All of **E, F, G, H** pass
- **I** passes OR is DEFERRED to v1.1 (per session-state.md ship criteria)

If any of A, B, C, D, E, F, G, H, J, K fail: do NOT ship. Open an issue
or note in `SKYN_SESSION_LOG.md`, fix, rerun the affected section.
