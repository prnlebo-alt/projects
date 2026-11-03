# Dream-loop rounds (target: written art bible, no concept image; image generation was unavailable, Higgsfield returned HTTP 423)

| Round | Score | Tier | Headline change |
|---|---|---|---|
| 1 | 5.5 | 3 | First full cartoon pass: sticker outlines, 5 worlds, characters, bins with eyes |
| 2 | 5.5 | 3 | Bins redesigned, purple toothy boss, starbursts, map icons and padlocks, far layers |
| 3 | 5.0 | 3 | Band behind worker, bigger bags, opaque HUD, crate on the wharf, neon sign moved |
| 4 | 5.5 | 3 | Global cel-shading pass, bands recolored vs arm, bug list from round 3 |
| 5 | 6.0 | 3 | Worker steps back and holds the pouch, flying pigeon, map and HUD fixes |

Budget (5 rounds) reached. Best 6.0, Tier 3. Judge's outstanding blockers: flat backdrop and ground surfaces, bin surface character, map frame usage. Small cosmetic fixes after round 5 were not re-judged.

## Second batch (user asked for more art rounds; default bound of 5)
| Round | Score | Tier | Headline change |
|---|---|---|---|
| 6 | 6.6 | 3 | Bin ribs, deck grain, neon-trimmed casino buildings, vignette, map layout |
| 7 | 6.9 | 3 | Tilted lids, ridge shading, far ridge, ground puddles, map inner panels |
| 8 | 6.8 | 3 | Sleeping bins blue-grey, hill junk, ground props, crane stripes, pulsing next node |
| 9 | 6.9 | 3 | Per-world foreground prop sets, hooked cranes, bigger flies (structural set dressing) |
| 10 | 6.9 | 3 | Ground texture, varied hill props, water tower, bridge, foam, boss drool |

Budget reached. Best 6.9, Tier 3, plateau across rounds 7-10. Round 10's judge could not open one screenshot (wrong path from me), so boss changes went unscored. Remaining gap per the judge: flat fills with one highlight and one shade; Tier 4 needs textured, hand-painted-quality surfaces, which procedural canvas shapes are not reaching. Next lever is generated art assets (Higgsfield image generation returned HTTP 423 this session).

## Third batch (Higgsfield dropped by the user; switched to Blender headless)
| Round | Score | Tier | Headline change |
|---|---|---|---|
| 11 | 6.9 | 3 | Characters, bins, boss, trash, props, portraits re-rendered as 3D toon sprites in Blender |
| 12 | 6.9 | 3 | World layers too: houses, trees, towers, crane, casino, mounds, cars, fence, pads |

Plateau at 6.9 across rounds 7-12. The judge's remaining blockers: no material texture or wear (dents, rust, grime, tread), canvas-painted layers (water, ridge line, ground strips, signs) still flatter than the rendered ones, inconsistent ground contact shadows, sun shows dither, same saturation on every depth layer.
Scripts: tools/blender/. The art direction note in HARDENED_SPEC.md still describes the intended look.

## Fourth batch (surface textures)
| Round | Score | Tier | Headline change |
|---|---|---|---|
| 13 | 6.9 | 3 | Procedural materials in the Blender toon shader (grime, rust, dents, wood grain, shingle, brick, fur, feather, foliage, dirt); judge: textures read but too noisy and uniform |
| 14 | 7.1 | 3 | Mottle contrast halved, larger shingle and brick, shared paper-grain overlay on the whole canvas, consistent ground shadows |

Best so far: 7.1 (Tier 3). First score above the 6.9 plateau. Judge's remaining blockers: weak highlight and shade step on each prop, uneven shadows under some props (hydrant, cone), sparse scene detail (curtains, mailboxes, gulls, stains), crane rings hang from nothing, trajectory dots confusable with scenery.

## 2D pivot (target: reference/target-keyart.webp)
| Round | Score | Tier | Headline change |
|---|---|---|---|
| 2D-1 | 4.0 | 2 | First SVG redraw, title art, HUD restyle |
| 2D-2 | 5.5 | 3 | Gus/Gerald/raccoon redesign, backdrops |
| 2D-3 | 5.0 | 3 (low) | Bigger head, wood sling, raccoon piles; judge: scale, outlines, ground, HUD |
| 2D-4 | 3.5 | 1 | Gus 1.65x with bent arm, bag +17%, thicker outlines/sling, bigger piles, shrunk HUD pill; judge: composition is a wide street, not the hero close-up; Gus ~30% of height, no tan dirt, small stack |
| 2D-5 | unjudged | - | Gus 1.9x, Gerald 0.9, bubble moved off head, tan dirt ground with bag piles, Maple backdrop swapped to hazy junk mounds |
| 2D-6 | 4.0 | 1 | **Removed a copied reference-image file (`art/title.webp` was a byte-identical copy of `reference/target-keyart.webp`, blitted full-canvas as the title "art" — a rules violation, not real art) and rebuilt the title screen as genuine composed SVG/canvas art: Gus+Gerald scaled to ~55% canvas height, Y-fork sling, stacked blue/green dumpster+crate+raccoon pile at ~35% canvas width, warm-gradient desaturation wash added to worlds 2-5 backgrounds. Judge: fork/bag read as disconnected props, no bottle, flat lighting, thin shadows, stray suburb house in the junkyard scene |
| 2D-7 | 3.0 | 1 | Shortened fork-to-bag distance, visible tan bands, bottle+can, house removed, truck/Gus shadows, rim light. Judge: bands/bottle/house landed, but stack clipped top edge, warm light only on Gus not the stack/sky, no whole-stack shadow, ground props (hydrant/cone/trashcan/manhole) still present |
| 2D-8 | 5.0 | 2 | Fixed stack clipping (scaled blue dumpster down, repositioned), extended warm wash across full frame width, added one continuous shadow under the whole stack footprint, replaced all 6 remaining ground props with tan-dirt patches + bag-pile silhouettes. Also wired up `drawBlock(b)` art (wood/glass/stone/rotten-crate-TNT) once the physics worker added the hook. Judge: Tier 2 passed — lighting/shadow/atmosphere gate cleared; remaining blockers all Tier 3 (materials): cat-like raccoon ears, flat box/bin shading, oversaturated skyline competing with foreground |
| 2D-9 | 5.0 | 2 | Redesigned raccoon face in tools/svg/make_art.py (rounded ears, elongated muzzle, paw stripes) and regenerated all raccoon SVGs; added cool desaturating wash over the background skyline band to recede it; added two-tone highlight/shadow shading to every box/bin in the title stack. Judge: held at 5.0/Tier 2 for 2nd round in a row (stall per dream-loop rule) — raccoon ears overshot into "mouse ears", bins/boxes still read flat. One more targeted pass followed (shrunk ears, split eye mask in two, strengthened bin/box shading) but was not re-judged — superseded by the camera-pullback pivot below before a 5th judge round ran. |

## Mid-session owner redirect (overrides the "Gus ~55% height" hero-shot target above)
Coordinator relayed: "the art is TOO ZOOMED IN... pull the camera back... whole level reads as a wider Angry-Birds-style scene" (world coords/hit radii/GROUND unchanged, visual-scale-only) **plus** "add MORE CHARACTERS": raccoon variety (foreman, bandit, boss, tiny sneaky, chef) and a friendly cast (dog sidekick, mayor, rival truck driver, sleepy cat bystander). No `older-garbage-man-style.*` reference file was present in `reference/` to consult.

Response (unjudged — the dream-loop rubric above was anchored to the now-superseded tight close-up framing, and the owner's direct word is a stronger signal than a judge comparing against a key-art image that no longer matches the intended composition):
- Reduced the shared `GS` character-scale constant in `gus()` from 1.9 → 1.25 (affects every scene that draws Gus, title and gameplay alike) and rebuilt the title composition's hand-tuned offsets (sling/bag/rim-light/shadow/Gerald) to match the new, smaller scale instead of just shrinking a wrapper transform. Fixed the in-level Gerald shoulder-perch offset, which fell off Gus's shoulder onto the ground after the GS change. Shrank the title's dumpster/crate stack ~14% for more breathing room.
- Added 4 new raccoon villain variants by parameterizing the existing SVG generator (`raccoon_foreman` — orange hard hat, `raccoon_boss` — wider head + gold chain, `raccoon_chef` — white toque + neckerchief, `raccoon_sneaky` — narrowed eyes, no pupils) plus the existing bandit (`rascal_head`) = 5 raccoon types. Added 2 new friendly bystander characters (`dog`, `cat`) as new generator functions in the same visual language. `mayor()` and `rascal()` already existed as full characters from earlier work.
- Wired the new cast into visible gameplay, not just generated-and-unused: `drawPile()`'s two cameo raccoon slots now pick randomly (seeded by dumpster position, so stable per-level) from all 5 raccoon types; the title stack's 4 raccoon cameos were assigned specific types (boss in the big dumpster, foreman in the green bin, chef and sneaky in the crates) for a deliberate "gang" read; the dog and cat appear as static bystanders near the truck and the dirt mound on the title screen.
- **Not done** (flagged honestly, not attempted this session): a "rival truck driver" character; wiring any new cast member into story scenes or as physical in-level sling *targets* (both would need story/level data-structure changes outside this worker's owned region — `drawTitle/hud/bg/gus/gerald/trash/drawBin/drawBoss/drawPile/drawPull`); re-running the solver after the visual-scale change (solver is physics-owned, not art-owned — flagging for the other worker/coordinator since the brief says a camera/zoom change requires the solver to still pass).

## Angry-Birds-quality pivot (match QUALITIES, never specific designs — see LEGAL_NOTES.md section 3)
Owner dropped the earlier "blocky/Roblox" exploration (`concepts/blocky-*.png`, kept for provenance) and asked to move toward Angry-Birds-tier casual-mobile polish: round/chunky/glossy shapes, soft vertical gradients + bright specular blob on every character/prop, thick soft dark outlines, huge expressive eyes with heavy angled brows and exaggerated cheeks/underbites, saturated sky + clouds + parallax hills, wood/ice/stone/crate blocks with progressive cracks, puffy white impact smoke + star bursts, glossy rounded-font UI — plus hard legal rules: no AB silhouette/face/color/logo, no bird ammo, no pig villains, no red/yellow/blue ball-bird lookalikes; cast stays Gus/Gerald/raccoon villains/friendly cast, ammo stays bags/cans/tires/bottles. Each round below is judged on a custom two-part rubric (quality score 0-10 + a separate legal-flag check), not the old key-art-comparison rubric.
| Round | Score | Legal flags | Headline change |
|---|---|---|---|
