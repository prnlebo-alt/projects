# SKYN — Six-Week Plan

**Owner:** Anthony (MadPugExperiment LLC)
**Drafted:** Friday, May 8, 2026
**Plan window:** May 8 – June 19, 2026
**Status of in-review v1.0:** Submitted to Chrome Web Store as Unlisted, auto-publish OFF, awaiting review. Will be replaced before publishing.

---

## 1. What we are building, in one paragraph

Skyn is a Chrome extension that applies polished, atmospheric visual themes to Claude.ai, ChatGPT, and Gemini using CSS injection. Three skins are free; the rest are paid one-time purchases at $1.99–$5.99. Revenue comes only from the marketplace — no subscriptions, no AI usage fees, no message limits. The conversation data on the host platforms is never read, stored, or transmitted by Skyn. The product is a personalization layer, not an AI tool.

The product we ship in v1 is the foundation for v2 (creator-platform: skin editor, sharing, user-generated marketplace). All v1 architecture decisions are made with v2 in mind — but v2 itself is parked until v1 is shipping and selling.

---

## 2. The decisions already made (locked, do not revisit)

These were debated extensively in the May 5–8 strategy sessions. They are settled. If a future Claude Code session, or a tired version of you at 11pm, suggests reopening any of these — push back.

1. **Marketplace-only monetization.** No subscriptions, no BYOK, no AI proxying.
2. **Chrome extension first.** Web app v2 is parked at `skyn-webapp-v2/` for later.
3. **CSS injection only.** No DOM rewriting on host pages. No reading conversation content. Privacy-first posture is non-negotiable.
4. **Three free skins (Midnight, Snow, Glass Day) stay free.** They are the on-ramp.
5. **Brand name is Skyn.** Domain is `skynapp.app`. LLC is `MadPugExperiment` (legal entity only — never customer-facing).
6. **The current in-review v1.0 will be replaced before publishing.** No incremental updates pushed to Chrome during the build. One polished update lands when v1 is launch-ready.
7. **Hero direction is Tier 2 atmospheric, not Gemini-render fantasy.** Skins look like Linear or VS Code Theme of the Year, not parchment manuscripts.

---

## 3. The thing we are NOT building (the "no" list)

These are tempting and they will come up again. They are out of scope for the next six weeks. If Claude Code suggests building any of them, the answer is no.

- Skin editor / theme creator UI for users
- Sharing system / share codes / "apply Anthony's setup" links
- User-uploaded backgrounds in v1 (curated images only)
- Creator submission portal
- Mobile app (iOS, Android, PWA)
- Web app development
- Adding more than 12 paid skins
- Subscription tier of any kind
- Stripe Connect / creator payouts
- Adding new AI platforms beyond Claude / ChatGPT / Gemini
- User accounts before purchase (account creation only at checkout)
- Internationalization
- A/B testing infrastructure
- Analytics dashboards beyond basic Chrome Web Store stats

If you want any of these, they go in a file called `SKYN_V2_PARKING_LOT.md` and get revisited after v1 ships.

---

## 4. The skin tier system (the visual quality contract)

Every skin in the catalog must clearly belong to one of three tiers. The tier determines the price, the build effort, and the maintenance burden.

### Tier 1 — Pure CSS (the floor)
- Color palette, font family, border-radius, basic gradients
- No animations beyond CSS transitions on hover
- No background images, no SVG illustration
- Build effort: 2-4 hours per skin
- Price: Free or $1.99
- Examples: Midnight, Snow, Glass Day, Brat Bubble, iMessage

### Tier 2 — Atmospheric (the target for paid skins)
- Tier 1 + animated CSS effects (scanline drift, subtle flicker, gradient shifts)
- One layer of inline SVG decoration (e.g., botanical accent, scanline overlay)
- Custom bubble shape via bubbleAiRadius / bubbleUserRadius
- Frosted glass panels via backdrop-filter
- Build effort: 8-16 hours per skin
- Price: $2.99–$3.99
- Examples: Cracked Terminal (animated), Sorbet Botanical, Liquid Chrome

### Tier 3 — Scenic flagship (one or two only)
- Multi-layer SVG scenes (city silhouettes, animated starfields, layered foliage)
- Coordinated animation across multiple layers
- Hero marketing assets — these are what go on the Chrome Web Store screenshots
- Build effort: 30-50 hours per skin
- Price: $4.99–$5.99
- Maximum two in v1. Maintenance cost scales fast.
- Examples: Neon Rain City, Tropical Canopy

**Total v1 catalog:** 3 free (Tier 1) + 7 paid Tier 2 + 2 paid Tier 3 = 12 skins.

Not 105. Not 30. Twelve. Each one polished. The catalog grows post-launch based on what sells.

---

## 5. The six-week schedule

### Week 0 (May 8–10): Cleanup and foundation
Goal: Workspace is fully production-ready. No build work begins until this is done.

- Rename directories (done)
- git init with proper .gitignore, initial commit landed (done)
- Push to private GitHub repo (do this Saturday morning at the latest)
- Update skyn-extension/CLAUDE.md to reflect the current product (BYOK dead, marketplace-only, Tier 1/2/3 system, "no list")
- Audit skyn-extension/.env.local and skyn-backend/.env.local — confirm marketplace Stripe Price IDs are present, not the abandoned NEXUS subscription IDs
- In Stripe Sandbox: confirm the four marketplace products exist with the right prices
- Document the live Chrome Web Store package version number so we know what we're replacing

Time budget: 4-6 hours total this weekend.

### Week 1 (May 11–17): Engine v1.5 — extending the skin contract
Goal: The skin engine can express Tier 2 atmospheric effects. No new skins yet — just engine work.

The current Skin interface handles colors, fonts, border-radius, and bubble overrides for iMessage. Tier 2 needs four additions:

1. backgroundLayer — optional. CSS gradient string OR inline SVG string OR CDN-hosted image URL. Used as full-page background.
2. overlayLayer — optional. CSS keyframe animation name + the keyframes themselves (e.g., scanline drift). Injected into the same style tag.
3. glassPanels: boolean — when true, sidebar/bubbles/input use backdrop-filter: blur() and rgba backgrounds instead of solid colors.
4. accentGlow: string | null — optional CSS text-shadow string for accent surfaces.

Tasks for Claude Code:
- Update skyn-extension/src/shared/types.ts to add the four optional fields to Skin
- Update skyn-extension/src/shared/skins.ts skinToVars() to map the new fields to CSS vars
- Update skyn-extension/src/content/injector.ts buildThemeCss() to inject the new layers
- Build a "test harness" page (a local HTML file mimicking Claude.ai's structure) so we can test skins without reloading the real site every time
- Update each of the 3 free skins (Midnight, Snow, Glass Day) to use the new engine — better looking without changing their identity

Deliverable end of Week 1: Three free skins look polished on Claude/ChatGPT/Gemini, the engine supports Tier 2 effects, the test harness lets us iterate without burning the host site.

Time budget: 12-18 Claude Code hours.

### Week 2 (May 18–24): Build the first three Tier 2 paid skins
Goal: Three paid skins shipped end-to-end at Tier 2 quality.

Build in this order:

1. iMessage ($2.99) — Apple Messages aesthetic. Blue user bubbles with tail, gray AI bubbles, SF Pro font, white background, pill input bar.
2. Cracked Terminal ($2.99) — phosphor green CRT, JetBrains Mono, animated scanlines, magenta labels, blinking cursor in input bar.
3. Sorbet Botanical ($3.99) — pastel sorbet gradient, single SVG botanical accent on right edge, frosted glass panels, warm coral user bubbles.

For each: apply on Claude, ChatGPT, AND Gemini, fix selectors, take final screenshot for Chrome Web Store listing.

Deliverable: 3 paid skins working on all three platforms with screenshots ready.

Time budget: 18-24 Claude Code hours.

### Week 3 (May 25–31): Build the next four Tier 2 paid skins
Goal: Catalog reaches 7 paid Tier 2 skins.

Build:

4. Liquid Chrome ($3.99) — iridescent gradient, frosted glass panels, soft purple accent.
5. Brat Bubble ($2.99) — Charli XCX brat green, all lowercase, hard black accents.
6. Newspaper ($2.99) — editorial serif, off-white background, narrow-column layout.
7. Y2K Frost ($3.99) — cold blue glassy gradients, chrome accents, pixel-style emoji decorations.

Deliverable: 7 paid Tier 2 skins, all working on all three platforms.

Time budget: 20-28 Claude Code hours.

### Week 4 (June 1–7): The two flagship Tier 3 skins
Goal: Two scenic flagship skins built. These are the hero screenshots.

Build:

8. Neon Rain City ($5.99) — multi-layer SVG cityscape, animated starfield, magenta/cyan accents, neon sign cluster, drifting rain. The hero.
9. Tropical Canopy ($4.99) — layered SVG canopy at bottom, monstera silhouettes, slow leaf-sway, warm sun glow.

Deliverable: 2 Tier 3 skins, three platform-specific stylesheets each, both running cleanly.

Time budget: 25-35 Claude Code hours.

### Week 5 (June 8–14): Marketplace UX, payment loop, polish
Goal: The actual buying flow works end-to-end with real (sandbox) Stripe.

- Test full purchase loop: click paid skin, checkout in new tab, pay test card, license token issued, skin unlocks, applied immediately
- Polish marketplace tab in popup (categories, prices, Buy buttons, Owned indicators)
- Build skin detail view — single screen with full preview, price, buy button
- Test license validation route
- Stripe webhook handling correctness
- Edge cases: what if user clears browser data? (License token re-fetchable via email lookup)

Deliverable: Working end-to-end purchase loop in sandbox. Ten test purchases run successfully.

Time budget: 18-25 Claude Code hours.

### Week 6 (June 15–19): Production prep and Chrome Web Store update
Goal: Replace in-review package with polished v1 build. Switch to live Stripe. Submit for re-review.

- Switch Stripe from sandbox to live keys
- Set up live webhook with production URL
- Run final Supabase migrations against production
- Final QA: load production-built unpacked extension, verify all 12 skins on all 3 platforms
- Generate final Chrome Web Store screenshots
- Write public-facing store listing copy
- Update skynapp.app landing page
- Build production zip, replace package in Chrome Web Store dev console
- Submit for review. Auto-publish stays OFF — manually publish only after retesting on clean machine

Deliverable: v1 ready for re-review. All systems live except public publish toggle.

Time budget: 12-18 Claude Code hours plus 4-8 hours non-Claude QA.

---

## 6. Daily Claude Code session pattern

1. Open SKYN_PLAN.md first. Read current week's section. Pick one specific deliverable.
2. State the goal in the first prompt. Be specific.
3. Don't let agent expand scope. If Claude Code suggests "while I'm in here, let me also..." — say no.
4. End each session with a commit.
5. If something feels off, stop and come to strategy chat instead of pushing through.

Recommended session length: 90 minutes max. Take real breaks.

---

## 7. The launch moment (Salesforce screen-share play)

1. Do it only after Chrome Web Store approval lands and you've manually published.
2. Subtle, not pitched. Show the skin during normal work. URL: skynapp.app
3. Have a one-page landing site at skynapp.app ready with one button: Install from Chrome Web Store.
4. Be aware of conflict-of-interest implications. Demo to colleagues you trust, not to the room.
5. Do not pitch during client-facing work. Org-internal sessions only.

Rough timing: late June or July, after Chrome approval.

---

## 8. Hard constraints

- No new skins beyond the 12 listed.
- No revisiting BYOK or subscription tiers.
- No skyn-webapp-v2 work for six weeks.
- Sunday evening 15-minute self-audit in WEEK_LOG.md. Three sentences max.
- Skip audit two weeks in a row, plan is broken, come back to strategy chat.

---

## 9. Escape valves

Justifies deviating:
- Chrome rejects v1.0 for fixable reason
- 3+ strangers ask for same feature in first month
- 50+ paid skins sold in first 30 days
- Skin breaks on platform UI update with non-trivial fix

Does NOT justify:
- "Great new skin idea" — write it down
- "What if we also..." — no
- "Codex/another AI suggested..." — no
- "Competitor did X" — competitive comparisons aren't strategy
- Boredom

---

## 10. Success at end of six weeks

On Friday June 19, 2026:
- v1 submitted to Chrome Web Store with 12 polished skins
- Purchase flow tested end-to-end in sandbox with real money
- skynapp.app has working landing page
- Clean skyn-extension/ repo with real git history
- WEEK_LOG.md with six entries
- Editor, sharing, web app NOT built
- v2 ideas list in SKYN_V2_PARKING_LOT.md

That's success. Not a viral launch. A polished v1 in the store, ready for distribution moment.

---

*Last updated: May 8, 2026. Owner reviews and edits weekly. Source of truth for v1 scope.*
