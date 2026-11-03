# SLING TRASH: The Great Garbage Conspiracy - Hardened Spec

Generated with game-brief-hardener, game-studio (brief), dream-loop (target), hallmark (UI discipline), gauntlet-orchestrator (acceptance), fun-audit (review).
Defaults below were chosen by the author and can be changed; none were asked for beyond the interview (tone: absurd satire, look: chunky sticker cartoon, sound: synth SFX + music loop).

## Genre and core fantasy
Pull-to-launch slingshot physics puzzle. You are Gus Pickett, a sanitation worker with a bungee-cord sling, flinging trash into hungry dumpsters to save a city whose bins keep vanishing.

## Story (absurd satire)
Gloomsbury-on-Sludge: population 40,000, dumpsters suspiciously fewer. Mayor Chadwick Sludge's "Zero Waste Initiative" declares that nothing is waste, so nobody may pick anything up. The Raccoon Mafia, led by Don Rascal the Trashfather, steals dumpsters at night for Mr. Landfill, a sentient hill that pays them in expired coupons. Gus, with a sarcastic pigeon sidekick (Gerald, union rep), works from Maple Drive up to Mount Rubbish and feeds the hill until it falls asleep.
Ending: the mayor's garage held every bin; Don Rascal gets a municipal job; Gerald becomes Deputy Pigeon; there is already litter on the sidewalk.

## Tuning constants (THE GAME)
| Constant | Value | Unit | Source / why | How to test |
|---|---|---|---|---|
| max_pull | 130 | px | our own, tuned by feel | drag past ring: band stretches, power stays 1 |
| min_launch_fraction | 0.23 | of max | our own, tuned by feel (min_pull 30 / max_pull 130) | release at 29 px: nothing; at 31 px: launch |
| aim_dot_threshold | 0.28 | of max | our own, tuned by feel | dots hidden under 36 px |
| aim_dot_count | 14 | dots | our own, tuned by feel | count dots |
| aim_dot_step | 0.05 | s | our own, tuned by feel | dots span 0.7 s |
| response_curve | 0.72 | exponent | our own, tuned by feel | power = (pull/max)^0.72 |
| overstretch_softness | 0.22 | of max | our own, tuned by feel | handle never exceeds ~159 px |
| launch_speed_max | 760 | px/s | prototype | power 1 bag lands ~825 px at 45 deg |
| gravity | 700 | px/s^2 | prototype | |
| bag / can / tire radius | 12 / 8 / 15 | px | collision radius; sprites are drawn 1.12x | |
| bag / can / tire bounce | 0.35 / 0.55 / 0.22 | restitution | | |
| bag / can / tire speed | 1.00 / 1.12 / 0.85 | x | | |
| bounce_pad_restitution | 1.18 | | | ball rebounds higher than it fell |
| lid cycle | open 1.0-1.3 s / closed 0.9-1.2 s | s | | closed lid blocks entry |
| wind | 0 to 90 | px/s^2 | | arrow + dots both include wind |
| stars | 3 stars if bags used <= par, 2 if par+1, else 1; par per level shown on the HUD | | par from solver and bag budget | HUD shows '3 stars in N bags' |
| spare bags | +1 after 2 losses, +2 after 4 (Gerald finds them) | bags | frustration relief from fun audit | lose twice, retry, see +1 |
| skip level | offered after 3 losses on a level | | frustration relief | skip button appears on lose screen |
| sim step | 1/120 s fixed, 2 substeps per ball step | s | preview uses the same integrator | preview dots match flight to 0.1 px |

## Difficulty curve (15 levels, 5 worlds)
New mechanic each world, one at a time, with an easy level first.
| World | Levels | New mechanic | Bag budget |
|---|---|---|---|
| 1 Maple Drive | 1-3 | static bin, car, fence | 4 |
| 2 Skyscraper Row | 4-6 | tall buildings, lob shots, two bins | 4-5 |
| 3 Stinky Wharf | 7-9 | moving bins, wind | 5-6 |
| 4 Lucky Dumpster Casino | 10-12 | bounce pads, bins with lids | 5-6 |
| 5 Mount Rubbish | 13-15 | lids + moving + varying wind, boss with 4 hits | 6-9 |
Acceptance: solver finds a winning shot for every level; the share of winning shots (any bin scored) trends down across worlds; each world's first level is at least as easy as the previous world's last.

## Acceptance contract (gauntlet)
1. Solver: every level winnable (grid search through the game's own physics).
2. Zero console errors across title, map, story, play, win, lose, ending.
3. Layout works at 375 and 800 px widths with no horizontal scroll; tap targets at least 40 px.
4. All text on canvas readable (outlined, contrast against fills).
5. Independent judge (fresh agent) scores the screenshot against the target description at 7+ on the dream-loop ladder, or the blockers are listed.
6. Fun audit: no dimension under 6, or fixes listed.

## Art bible (target description, since image generation was unavailable)
Chunky sticker cartoon: every shape has a 3-4 px near-black purple outline (#20103a), flat saturated fills with one lighter highlight and one darker shade tone, a hard offset drop shadow. Big round heads, tiny legs, squash-and-stretch on everything that moves. Each world has a three-layer parallax backdrop: Maple Drive pastel suburbs with houses, trees and clouds; Skyscraper Row sunset towers with a billboard; Stinky Wharf teal sea, cranes and wooden planks; Casino purple night with neon signs; Mount Rubbish toxic green sky with junk mountains. Dumpsters have googly eyes that follow the trash, a tongue when hungry and closed eyes when the lid is shut. Trash bags have faces. Comic words (POW, CLANG, BURP) pop on events.
Palette: ink #20103a, cream #fff3d6, orange #ff8a1f, yellow #ffd23f, green #3fbf6a, teal #2fb7c9, purple #6a3fb5, pink #ff6fa5, red #e8453c.
Type: Lilita One (display) with Arial Black fallback, all outlined.

## Sound
Web Audio only: bag thump, can ping, tire boing, dumpster clang, score jingle, lid clap, boss burp, lose wah-wah, win fanfare; a 16-step chiptune loop (bass + lead) at 120 bpm; mute button persists in localStorage.

## Out of scope
Online features, ads, purchases, level editor.

## Shipped notes
- Story skip button on every story scene; keyboard Enter or Space advances; live region announces story lines and results; reduced-motion disables shake and hit-stop; zoom is not disabled.
- Boss phase 2 (after the second bite): bin moves 1.5x faster, lid shuts longer, gust grows 1.6x.
- Not built (ideas from the audit): daily seeded level, mission stars, breakable crates, overhead wires that make the 45 degree lob fail.
- Image generation was unavailable (Higgsfield HTTP 423), so the art target is the written bible above. A concept image would let the dream-loop judge compare against a picture.

- Art pipeline update: characters, bins, boss, trash, props, portraits and all world layers are pre-rendered 3D toon sprites from headless Blender (`tools/blender/`); canvas drawing remains as fallback and for water, sky, ground strips, signs and effects.
