# SLING TRASH: The Great Garbage Conspiracy

A pull-to-launch physics puzzle about a garbage man, a sarcastic pigeon and a sentient landfill.
This file is the project's single source of truth: what it is, why it works the way it does, what is built, and what is still open.

---

## 1. One-line pitch

You are Gus Pickett, a sanitation worker with a bungee-cord sling. The city's dumpsters keep vanishing. Pull back, let go, and fling trash into hungry dumpsters across 15 levels in 5 worlds until the thing eating the bins falls asleep.

## 2. Pillars

1. **The pull is the game.** One gesture (drag back, release) must feel good for 15 levels. Everything else supports it.
2. **Absurd satire, not gross-out.** The humour comes from bureaucracy and escalation (Form 27-B, a Raccoon Mafia, a hill with a dental plan), not from nastiness. Safe for ages 8+.
3. **One new idea per world.** Players learn a single mechanic at a time, with an easy level first.
4. **Fair and readable.** The aim preview matches the real flight; failure is quick to retry; stuck players get help.

## 3. Story (absurd satire)

**Setting:** Gloomsbury-on-Sludge. Population 40,000. Dumpsters: suspiciously fewer.

**Cast**
| Character | Role | Voice |
|---|---|---|
| **Gus Pickett** | Hero. 31 years on the truck, one remaining brain cell. | Dry, put-upon. |
| **Gerald** | Pigeon sidekick and "union rep." Hovers beside Gus with hints. | Says "Coo." Deadpan. |
| **Mayor Chadwick Sludge** | Zero Waste Initiative: if nothing is waste, nobody may pick anything up. | Cheerful bureaucrat. |
| **Don Rascal** | Raccoon Mafia boss, "the Trashfather." Steals dumpsters at night. | Mob-movie menace. |
| **Mr. Landfill** | A sentient hill fed by the stolen bins. Pays the raccoons in expired coupons. | "BURRRP. MORE." |

**Chapters**
1. **Maple Drive: Bins Gone Missing.** The bins are gone. The truck is repossessed. Gerald joins ("union rules").
2. **Skyscraper Row: Corporate Waste.** The Mayor's tower. "Zero Waste means nothing is waste! So please stop picking up my trash."
3. **Stinky Wharf: Fishy Business.** Raccoons load dumpsters onto barges. Form 9-X "says" they may steal on Tuesdays.
4. **Lucky Dumpster Casino: All In.** Everything bounces, nothing pays out. Mr. Landfill is awake.
5. **Mount Rubbish: Landfill Rising.** City code says it is "technically a hill." Feed it until it sleeps.

**Ending:** Mr. Landfill falls asleep (gentle compost smell). The mayor's garage held every bin. Don Rascal gets a municipal job and a dental plan. Gerald becomes Deputy Pigeon. There is already litter on the sidewalk. THE END?

**Running gags:** Gerald's "Coo."; forms with escalating numbers (27-B, 9-X, 27-Z); the union break; Rascal's coupons.

## 4. Core mechanic: the pull

The pull system is a reusable class (`Pull` in `index.html`):

- Press near the sling to grab; drag back; the handle follows with an elastic over-stretch past the max radius (visual only; power stays clamped).
- Release under the cancel threshold: nothing happens and no bag is spent.
- Above it: launch along (anchor minus handle). Power = (pull / max pull)^0.72.
- A 14-dot aim preview appears once the pull reaches 28 percent and uses the same integrator as the real flight, wind included (matches to 0.1 px).
- The handle springs back after release; Gus steps back with the pull and holds the pouch.

### 4.1 Where the numbers come from

Every `Pull` constant below is our own, chosen by feel and playtest against the 15 levels. An earlier prototype pass had used thresholds observed in a third-party game's shipped build; those values have since been removed and replaced outright (see `LEGAL_NOTES.md` for what changed and when). No code, art or audio from any other game is used here.

> Note: before any commercial release, have an IP lawyer review mechanics, naming and assets. Mechanics are generally not copyrightable, but this is a legal question, not a technical one — see `LEGAL_NOTES.md`.

## 5. Tuning constants (this game)

| Constant | Value | Notes |
|---|---|---|
| max pull | 130 px | |
| cancel / aim threshold | 0.28 of max | our own, tuned by feel |
| response curve | 0.72 | power = t^0.72 |
| over-stretch softness | 0.22 | visual only |
| launch speed max | 760 px/s | x trash-type multiplier |
| gravity | 700 px/s^2 | |
| sim step | 1/120 s, 2 sub-steps | preview shares the integrator |
| trash: bag / can / tire | radius 12 / 8 / 15; bounce 0.35 / 0.55 / 0.22; speed 1.00 / 1.12 / 0.85 | order rotates bag, can, bag, tire, bag, can |
| bounce pad restitution | 1.18 | |
| lid cycle | open 1.0-1.6 s / closed 0.9-1.2 s | closed lid blocks entry |
| wind | 0 to 90 px/s^2 | arrow + preview both show it |
| boss phase 2 (after bite 2) | moves 1.5x, lid shuts longer, gust x1.6 | |

## 6. Levels and difficulty

15 levels, 5 worlds, one new idea per world. The solver brute-forces angle, power, trash type and moving-target timing through the game's own physics; every bin on every level has a winning shot. The share of random shots that hit the hardest bin falls from about 12% (level 1) to about 2% (level 12).

| World | Levels | New idea | Bags |
|---|---|---|---|
| 1 Maple Drive | 1-3 | static bin, car, fence | 4 |
| 2 Skyscraper Row | 4-6 | tall buildings, lob shots, two bins | 4-5 |
| 3 Stinky Wharf | 7-9 | moving bins, wind | 5-6 |
| 4 Lucky Dumpster Casino | 10-12 | bounce pads, bins with lids | 5-6 |
| 5 Mount Rubbish | 13-15 | lids + moving + varying wind; **boss** (4 hits) | 6-9 |

**Stars:** 3 if you finish within par bags, 2 at par + 1, otherwise 1. The HUD shows the par target.
**Frustration relief:** Gerald finds a spare bag after 2 losses (up to +2); after 3 losses on a level you can skip it.
**Hardest bin per level (random-shot success):** 12, 10, 6, 5, 3, 4, 10, 9, 4, 5, 2.5, 1.9, 4, 3.7, 4.9 percent.

## 7. Feel and juice

Squash-and-stretch trash, comic pop-ups (CLANG, BOING, THWACK, SCORE, BURP), screen shake and a 70-90 ms hit-stop on scores and boss bites (disabled under reduced motion), bins whose eyes follow the trash, lids that open and shut, a hovering pigeon with wing flaps, particles.

**Sound (Web Audio, no files):** launch whoosh, thump, ping, boing, clang, score jingle, boss burp, lid clap, win fanfare, lose wah-wah, and a short chiptune loop that changes key per world. Mute toggle persists.

## 8. Accessibility and platform

- Pointer events with touch capture; 40 px minimum tap targets; zoom is not disabled.
- Canvas has an accessible name; a live region announces story lines and results; Enter/Space advances.
- Reduced-motion disables shake and hit-stop.
- Layout verified at 375 px width (no horizontal scroll). A rotate-your-phone hint appears in portrait.
- Progress (stars, seen story, skipped levels, mute) saves to `localStorage`, guarded for private mode.

## 9. Technology and files

Single-file HTML5 canvas game, no build step.

```
sling-trash/
  index.html            the game (code, levels, story, audio, fallbacks)
  art/                  2D illustrated SVG sprites + meta (current art), title.webp
  assets/               Blender PNG sprites (fallback)
  tools/svg/            Python generators for the SVG art
  tools/blender/        headless Blender scripts for the fallback sprites
  reference/            the owner's target key art
  HARDENED_SPEC.md      constants, acceptance contract, art bible
  MANIFESTO.md          this file
  style-sample-clean.png  proposed new look (not yet in the game)
  .dream-loop/rounds.md   every art-judging round and score
```

Run it: open `index.html`, or `python3 -m http.server --directory sling-trash`.
Re-render art: see `tools/blender/README.md` (Blender 5.2 LTS, headless).
Dev preview: `.claude/launch.json` has a `sling-trash` entry (port 8137).

## 10. Art direction: where it stands

**Target:** `reference/target-keyart.webp`, supplied by the owner: polished 2D cartoon illustration. Orange hard hat with a GUS badge, hi-vis vest, a sleepy-eyed pigeon on Gus's shoulder, raccoons peeking out of stacked dumpsters, glossy purple UI panels (star row, bag counter, nameplate), hazy junkyard depth. The title screen uses this image directly.

**History:** flat canvas shapes (judge 5.5 to 6.9 of 10), Blender 3D toon sprites with grime (6.9 to 7.1), then the owner said the art felt generic and shared the reference above. A judge comparing against that reference scored the first 2D pass 4 of 10 (Tier 2).

**Current pipeline (2D):**
- `tools/svg/make_art.py` and `tools/svg/make_world.py` generate every sprite as shaded SVG into `art/` (characters, bins, boss, trash, raccoons, houses, towers, crane, casino, mounds, cars, props, portraits, truck).
- Every SVG is passed through an SVG lighting filter (`puff`) that gives soft form shading and glossy edge highlights; sprites are pre-rasterized once into canvases (about 1 ms per frame).
- The old Blender sprites (`assets/`, `tools/blender/`) remain as an automatic fallback when an SVG is missing.
- Canvas code paints sky, haze, water gradient, ground strips and the glossy HUD.

**Matched to the reference:** Gus design and scale (1.4x), pigeon on the shoulder, raccoons in the bins, garbage truck behind Gus, glossy purple HUD with Gus nameplate, title art.

**Known gap versus the reference:** it is painted illustration; ours is vector with a lighting filter. Fine fabric folds, painterly backdrops and the stacked-pile target scene are not yet reproduced. A real sprite sheet in the reference style, drawn or generated by the owner, would close most of that gap; the game already loads art by name, so replacement is drop-in.

## 11. Known gaps and ideas

- Art is not at the owner's bar (section 10).
- Hand-play testing on a real phone has not been done; verification so far is scripted pointer events, a physics solver and screenshots.
- Not built (suggested by the fun audit): a daily seeded level, mission stars (e.g. "cans only"), breakable crates, overhead wires that block the 45-degree lob, boss weak points.
- Water, sky, ground strips and signs are still canvas-painted; they could be rendered in Blender for consistency.
- The mid-flight trajectory preview ignores obstacles by design.

## 12. Decisions log (why things are the way they are)

| Decision | Why |
|---|---|
| Sports idea scrapped for a garbage-man game | Owner's call; the pull system carried over unchanged. |
| Pull constants retuned to our own values | De-risk pass replaced all externally-derived thresholds with values chosen by feel and playtest; see LEGAL_NOTES.md. |
| Fixed 1/120 s timestep, preview shares the integrator | Fun audit: preview must match flight on every device. |
| Par-based stars | Fun audit: bag budget differs per level; "bags left" was unfair. |
| Spare bag and skip after losses | Fun audit: late levels hit 1.5 to 5 percent random success; frustration risk. |
| Filled bins stay solid | Competitive-player audit: ghost bins let you clear paths. |
| Boss gets a second phase | Skeptic audit: it was just a bigger bin. |
| Sprites rendered in Blender, canvas as fallback | Best available way to get consistent 3D art without image generation. |
| Textures softened, then clean style proposed | Judge called them noisy; the owner called the style generic. |

## 13. Credits

Design, code and art pipeline built collaboratively with Claude. Reverse-engineering analysis done with REA. Art judging and fun audits run by independent review agents.
