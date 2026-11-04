# Claude Clay — Design Bible

The product vision for Claude Clay, the first skin in the Skyn library to be built on a fully physical material interface rather than the legacy color-swap pipeline.

---

## What we're making

A Chrome extension theme for Claude.ai that makes the interface look and feel like it was sculpted from clay. Not "clay-colored." Not "earthy palette." Actual physical-clay: thick slab edges with visible sidewalls, embossed type, stamped composer indents, smooth pebble chips that wobble when idle and deform when pressed.

The goal isn't to make Claude prettier. The goal is to make Claude feel like a **place**, not an interface. A workshop you walk into, not a website you load.

---

## Stage-and-actors architecture

Claude Clay is the first Skyn theme built on the stage-and-actors model. This is load-bearing for the product strategy, not just the technical implementation.

**The stage** is a single pre-rendered image (`stage.jpg`) of a claymation environment — clay wall, surface, decorative props (mug, plant, books, bowl). Generated externally via an image model with strong art direction. Static. Doesn't change with interaction. It exists to ground the scene in a physical place.

**The actors** are the CSS-rendered interactive UI elements that sit on the stage — sidebar tablet, main slab, composer trough, chip pebbles, button pellets, asterisk. They animate, respond to hover/click, and carry the actual functionality.

This separation lets us iterate fast. The stage costs an image-generation pass to update; the actors cost a CSS edit. We can ship many themes (Claude Wood, Claude Glass, Claude Brutalist) by swapping just the stage and recalibrating the actor recipes — the architecture stays identical.

---

## Material interface engine

The deeper bet behind Claude Clay is that **the next interface paradigm is material**, not flat. After 15 years of skeuomorphism → flat → neumorphism → glassmorphism → "AI-native" zero-chrome, the field has run out of moves. Material — actual physical materials, rendered as if photographed — is the next frontier because it's the one substrate we haven't tried to fake with CSS yet.

Skyn is the platform that proves the material interface engine works. Claude Clay is the wedge skin: one platform, one material, one toggle. If users keep it after 7 days, we know the material interface engine has product-market fit. Then we expand the library.

The material interface engine isn't a framework or library — it's a design discipline plus the technical pipeline (stage + actors + PBR shaders, see [BLUEPRINT.md](BLUEPRINT.md)). Anyone shipping in this style follows the same architecture.

---

## Wedge strategy

Why we're shipping narrow.

**One platform**: Claude.ai only. ChatGPT and Gemini are V2 ambition.

**One material**: clay. Not "all the materials." We pick the one with the strongest sensory metaphor (tactile, warm, hand-made, imperfect) and commit fully.

**One theme**: Claude Clay. Not a theme browser, not a marketplace. A single ship-it.

**One toggle**: enabled or disabled. Not "customize your clay color." Not sliders. One button.

The wedge isn't a constraint, it's a forcing function. Every decision becomes "does this make Claude Clay better, or does it help us ship more themes?" The first answer wins every time until V1 ships.

After V1 lands and we have signal, the library can grow. But V1's job is to prove the engine, not to populate the catalog.

---

## V1 scope

**In:**
- Single theme: Claude Clay
- Single platform: Claude.ai (dark mode only)
- Single setting: skin enabled / disabled
- Stage image baked into the extension assets
- Actor recipes hand-tuned in `customCss`
- Framer-motion-equivalent physics (in V1.5 — pure CSS for V1)

**Out:**
- Other materials (wood, glass, brutalist, etc.)
- Other platforms (ChatGPT, Gemini)
- Light mode
- User customization (color tweaks, intensity sliders)
- Multiple stages per theme
- PBR pipeline (V2)
- Marketplace UI

**The discipline**: every feature request gets re-asked as "is this V1 critical for proving the engine, or does it block on V1?" If the latter, it goes to V2 backlog.

---

## Success metrics

Two metrics. If both pass, the engine works and we expand. If either fails, we go back to the drawing board.

### 1. Tweet test

If a user can take a single before/after screenshot — vanilla Claude on the left, Claude Clay on the right — and feel the impulse to tweet it without prompting from us, the visual is strong enough.

**Why this matters**: emotional resonance drives organic distribution. If the install moment doesn't produce a "I have to show someone this" reaction, the skin is decorative, not generative. Decorative skins die on the vine; generative ones spread.

**Measurement**: organic share volume in week 1 + qualitative analysis of social posts. Looking for unsolicited screenshots, not promo content.

### 2. Seven-day retention

If a user installs Claude Clay and is still using it 7 days later — meaning they haven't toggled it off, uninstalled, or switched themes — the experience has crossed from novelty to preference.

**Why this matters**: most theme/skin products die at the 72-hour mark. Users install for the novelty, screenshot, then revert because the theme makes daily use slightly harder (wrong contrast, wrong density, visual noise). If Claude Clay survives 7 days of actual work, it's earned its keep.

**Measurement**: D7 active-with-skin-enabled, per-user. Target: >40%. (Industry baseline for cosmetic skins: ~15%. We need to substantially beat that.)

---

## Monetization ladder

V1 is free. The ladder shape:

**Tier 1 — Free (V1)**
- Claude Clay only
- Claude.ai only
- No customization
- Goal: install volume + retention proof

**Tier 2 — One-time purchase (V1.5)**
- 3–5 additional themes in the Material Library (wood, glass, brutalist, etc.)
- Same engine, different stages and actor recipes
- $9.99 lifetime, or $4.99/year if subscription resonates better in testing
- Goal: monetization proof

**Tier 3 — Pro (V2+)**
- Custom stage upload (user uploads their own claymation backdrop, we calibrate actors)
- Cross-platform support (ChatGPT, Gemini, Cursor, etc.)
- Animated stages
- Material designer tool
- $29 lifetime or $9.99/month
- Goal: pro/power-user revenue

**The library** is the asset moat. Each theme that ships strengthens the catalog and locks in the engine. By Tier 3, we have a library of curated materials that no competitor can replicate without doing the equivalent design work.

---

## Art principles

These guide every art decision on Claude Clay and any future skin in the library.

1. **Materials are characters, not surfaces**. Clay isn't a texture you apply — it's the soul of the scene. Treat it like a leading role.
2. **Imperfection is more important than detail**. The asymmetry, the slight rotations, the borders that aren't perfectly aligned — these read as hand-made, which reads as warm. A perfectly symmetrical clay form reads as plastic.
3. **Light direction matters more than light quality**. One key light, one source direction, stays consistent across the entire scene. Multi-source "ambient" lighting reads as digital. Real claymation has one bulb.
4. **Decoratives have weight, even if static**. The mug in the corner isn't just visual filler — it's a placeholder for the user's day. The implicit message: "this is your workspace, sit down."
5. **Never let CSS feel like CSS**. If a user can identify a specific CSS property at a glance (the gradient, the box-shadow, the border-radius), the illusion is broken. Stack effects until they read as material.

---

## Technical principles

These guide every code decision.

1. **Stage and actors are separate**. Don't bake actors into the stage. Don't drive stage from actor state. They're loosely coupled at the visual level only.
2. **CSS is the prototype substrate, not the destination**. The V1 CSS recipes prove the visual direction. V2 PBR pipeline is the actual product.
3. **No motion is allowed to feel digital**. If it eases like a UI library default, redesign it. Springs are overdamped. Recovery is slow. Motion frequency is 12fps, not 60.
4. **Performance is part of the visual**. A janky-feeling clay UI breaks the illusion harder than a wrong color. 60fps idle, <16ms hover response, non-negotiable.
5. **Ship-blocking lessons get committed to the library**. If we discover a failure mode (see CLAY_PRINCIPLES.md), it gets documented immediately so we don't relearn it on the next skin.

---

## Craft principles

These are how the team shows up.

1. **One reviewer per ship**. Every skin gets a single design lead who has veto on every detail. No design-by-committee.
2. **Iterate in the browser, not in the spec**. Mockups are for ideating, not signing off. The skin ships when it survives 30 minutes of actual Claude use without breaking the illusion.
3. **Reference the physical world relentlessly**. When in doubt about a shadow value or a rotation, look at real clay. Get clay. Make clay forms. Photograph them. Don't invent material physics from CSS imagination.
4. **The library is a graveyard, not a portfolio**. Skins that don't pass both success metrics get pulled. The catalog is curated, not accumulated.
5. **Document the why, not the what**. Code shows what we did; the library docs show why. Future contributors need to understand the reasoning, not the implementation.

---

## What this is NOT

To make the wedge sharper, things Claude Clay is explicitly not trying to be:

- **Not a productivity tool**. It doesn't make Claude faster, smarter, or more capable. It changes how Claude feels.
- **Not a customization platform**. It doesn't expose knobs. The skin is curated; the user toggles it on or off.
- **Not a marketplace play**. Tier 2 is a curated library, not a UGC platform. We're not building Etsy for Claude themes.
- **Not a brand exercise**. It's not a "redesign" of Claude. Claude.ai's brand stays Claude.ai's brand. We just dress it up for the user who wants it.
- **Not a single-purpose download**. The strategic value is the engine, not the one skin. Claude Clay is the wedge; the library is the business.

---

## Status

**V1 in development.** Stage generated and committed. Actor layer prototyped in CSS at `/tmp/clay-ui/`. Skin definition wired into `skyn-extension/src/shared/skins.ts` as a tier-3 entry. Next: integrate the prototype's actor recipes into the extension's `customCss` block and test against live Claude.ai DOM.
