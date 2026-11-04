# Clay Principles

The craft document. Why the clay illusion works when it works, why it fails when it fails, and the mental model to keep it from failing on the next skin.

---

## Why the illusion works

Three things are happening simultaneously when a viewer reads a UI as "clay" instead of "styled divs":

### 1. Material consistency

Every visible surface follows the same rules: same warm shadow palette (`rgba(90, 55, 20, X)`), same approximate roughness, same key light direction, same imperfection budget. The brain catches inconsistency faster than it catches absolute fidelity — one element that doesn't match the others breaks the whole scene.

### 2. Thickness signals

Real-world objects have **mass**. CSS divs don't. The illusion requires the brain to register that each form has a side, an edge, a thickness — even if you only see it briefly via offset shadow or border darkening. The 3-layer offset-shadow stack (`6px 8px 0`, `8px 10px 0`, `10px 14px 20px`) tells the eye: "this object is thick enough that its right and bottom sides cast a visible sidewall."

### 3. Imperfection

Hand-made objects have asymmetry. Tools, fingers, gravity — none of them produce perfect right angles, identical radii, or aligned edges. The imperfection engine (per-element rotations, asymmetric padding, varied border opacity, asymmetric corner radii) is what crosses the form from "rendered" to "made." Without it, even perfect material recipes read as digital.

If any of those three fail, the clay illusion collapses. The 8 failure modes below are the specific ways they fail.

---

## The 8 failure modes

Documented failures from the iteration log, in priority order (worst-first).

### Failure 1 — Too clean

**Symptom**: every chip is the same height. Every shadow is the same depth. Every corner radius is uniform. The interface looks "designed" — therefore digital.

**Cause**: applying material recipes without imperfection. CSS defaults to symmetric — the designer has to actively introduce asymmetry.

**Fix**: per-element variation. Rotation, padding, corner radii, border opacity, shadow blur. Each element gets a unique signature. No two elements share the same value for any parameter the eye can detect.

**Reference**: the rotation registry (`R = { logo: 0.70, newChat: -0.80, ... }`) is the imperfection engine's first move — 28 distinct angles across `[-1.15°, +1.15°]`.

### Failure 2 — Uniform shadows

**Symptom**: every raised element has the same `box-shadow` stack. Reads as if all elements were extruded by the same machine.

**Cause**: defining one shadow recipe and applying it everywhere.

**Fix**: shadow recipes take a variant object (`v`) that perturbs offsets, blurs, and alphas. No two elements end up with byte-identical shadow stacks. The `raised(v)` and `pebble(v)` recipes encode this.

**The deeper rule**: every visual property the eye can compare side-by-side must vary. The eye reads consistency as digital; it reads variation as physical.

### Failure 3 — Smooth surfaces

**Symptom**: the clay surfaces look painted, not sculpted. Like clay-colored plastic.

**Cause**: relying on solid color gradients without any per-surface texture or noise. Real clay has pores, grain, micro-imperfections at every scale.

**Fix**: at the CSS level, the prototype layered `feTurbulence` noise as `background-image` data URIs with `background-blend-mode: multiply`. This adds visible grain on every clay surface. At the V2 level, this becomes proper normal-mapped PBR shading.

**Caveat**: noise applied as a global overlay reads as a filter, not as material. The noise must be **inside** each surface (clipped to the surface bounds) for the eye to attribute it to the material rather than to the screen.

### Failure 4 — Global lighting

**Symptom**: every element has the same shadow direction but the scene as a whole feels lit by "screen light" — flat, ambient, ungrounded.

**Cause**: no scene-level light direction commitment. Each element has its own internal lighting (top highlight, bottom shadow) without reference to a unified key light position.

**Fix**: pick one key light direction (upper-left at 170°), commit to it across every element. Every top-edge highlight aligns with that direction. Every drop shadow casts away from it. The scene reads as illuminated from a specific source.

**Reference**: the stage.jpg is generated with a strong upper-left key light. All actor recipes have their bevel highlights at the top edge and drop shadows at the bottom-right, matching that source.

### Failure 5 — Perfect alignment

**Symptom**: elements snap to a pixel grid. Spacing is consistent. Margins are nice round numbers.

**Cause**: design tools and CSS defaults encourage grid alignment. It takes active effort to break out.

**Fix**: asymmetric padding (`'11px 19px 13px 17px'`), unique rotations per element, slightly offset positions for static elements (decoratives in stage.jpg corners). The eye is looking for the wonkiness that says "human."

### Failure 6 — Thin chrome

**Symptom**: the App container, sidebar, or panels look like rectangles with rounded corners. No physical thickness.

**Cause**: relying on `border` + uniform `box-shadow` blur. Real objects have offset solid shadows in the direction away from the light source — that's what reads as "the side of this thing extends beyond what I can see."

**Fix**: the offset solid shadow trick. `box-shadow: 6px 8px 0 rgba(90,55,20,0.4), 8px 10px 0 rgba(90,55,20,0.25)` — zero-blur, hard-edged, color-only. Three or four stacked at progressive depths gives the chamfered side of a thick slab. Then one final blurred ambient shadow at `10px 14px 20px` gives the floor cast.

**This is the single biggest visual upgrade** to push CSS clay past the "looks like a skeuomorph" ceiling. Without offset solid shadows, no amount of texture work makes the form feel thick.

### Failure 7 — Floating typography

**Symptom**: text sits above the surface like a print-on label, not pressed into the clay.

**Cause**: text-shadows that only push the text up (highlight below) or only push down (shadow above). One direction = floating.

**Fix**: pair-of-shadows. Bright top edge AND dark bottom edge. The eye reads the bright top as light catching a stamped depression's upper lip, and the dark bottom as the depression itself. Three-layer recipe (top bright, bottom dark, soft diffuse cast below for the surrounding compressed clay) is even better.

**Reference recipe**: `TEXT_CHIP = '0 1px 0 rgba(255, 225, 170, 0.55), 0 -1px 1px rgba(90, 55, 20, 0.22), 0 2px 4px rgba(90, 55, 20, 0.08)'`

**Advanced**: for marquee headlines, add a blurred duplicate of the text positioned 1px below the visible text, with low-opacity dark color. Simulates the compressed clay surrounding a deep stamp.

### Failure 8 — Consistent material

**Symptom**: the entire UI reads as one homogeneous material. No hierarchy.

**Cause**: every surface gets the same gradient, the same shadow, the same border. Without material differentiation, the eye can't tell which elements are interactive vs. structural vs. decorative.

**Fix**: at least three material categories visible on screen:
- **Slabs** (main panel, sidebar): cream or dark clay, thick offset shadows, structural
- **Pellets** (chips, buttons, asterisk): raised clay forms with bevel highlights, interactive
- **Troughs** (composer, address bar): inset shadows, stamped depth, debossed

Each category has its own shadow recipe family. The viewer's eye gets to scan and triage: "that's the panel, that's clickable, that's where I type."

---

## The prop artist mental model

This is the single most useful framing for clay design decisions.

You are not a CSS developer. You are a **stop-motion prop artist** hired to make the tabletop scene for a 90-second commercial that's about to be filmed.

A prop artist asks different questions than a designer:
- "Will this read on camera?" not "does this look good in the design tool?"
- "Does it have weight?" not "is the shadow correct?"
- "Does it feel like the same clay as the next prop?" not "are the colors in the palette?"
- "Would I be embarrassed if the director picked it up and turned it over?" not "does it pass the accessibility audit?"

Every decision goes through this filter. When in doubt, ask: **"If I made this out of real clay and put it on a table, would it look like this?"** If no, redesign.

---

## The "would I keep this in the studio" test

When you finish a clay element, mentally place it on a worktable surrounded by real clay props. The other props are made of actual clay — pinched, smoothed, fingerprint-marked.

Does your new element belong on that table? Or does it look like the one digital print-out that someone dropped on the table by mistake?

If the latter, the element fails. Go back to the failure modes above and find which one applies.

---

## The CSS ceiling

CSS-only clay simulation has a hard ceiling. Hitting that ceiling is fine — the V1 prototype is allowed to be a prototype. But knowing where the ceiling is helps avoid wasted effort.

### Things CSS does to "good enough" fidelity

- Multi-layer shadow stacks (thickness, depth, ambient occlusion)
- Embossed/debossed text (bright/dark text-shadow pairs)
- Material seams (border + offset solid shadow)
- Pigment variation (multi-stop gradients)
- Basic surface texture (SVG noise overlays via blend modes)
- Imperfection at the layout level (asymmetric padding/rotation)
- Idle motion (framer-motion with throttled animations)

### Things CSS cannot do

- **Surface response to interaction.** A real clay form gets compressed where you press it. CSS can scale or translate, but it can't deform the geometry.
- **Light wrap around curves.** Real specular highlights move as the surface curves and as the viewer moves. CSS shadows are static relative to the form.
- **Subsurface scattering.** Thin clay forms glow slightly from within when backlit. CSS can fake this with a glow shadow, but only at one orientation.
- **Frame-rate-throttled motion that holds up.** CSS animations sample at the browser's frame rate (60–120Hz). Stop-motion needs 12fps committed updates with a specific stutter character. CSS keyframes can approximate, but not reproduce, the look.
- **Per-pixel surface noise that updates.** Boiling effect requires the surface texture to shift every frame. CSS noise overlays are static SVG data URIs — no per-frame perturbation.
- **True ambient occlusion.** AO requires raytracing or screen-space approximations. CSS approximates with darker corner gradients, but the result is generic rather than scene-specific.

### When to push past the ceiling

When V1 ships and we have signal from the success metrics:
- Tweet test passing? Material direction is right. Push to V2 to scale fidelity.
- Tweet test failing? Material direction is wrong. Iterate at V1 level before investing in PBR.
- D7 retention passing? Users tolerate the V1 fidelity for real work. V2 will only deepen, not save.
- D7 retention failing? Something is friction in actual use. Fix at the UX level, not the rendering level.

---

## Final note

Clay is the wedge material, not the only material. The principles in this document generalize to any tactile interface (wood, glass, brutalism, ceramic, fabric). When the second skin in the library starts, this document gets a sibling — `WOOD_PRINCIPLES.md`, `GLASS_PRINCIPLES.md`, etc. — covering the same 8 failure modes through that material's specific lens.

The library is the asset moat. Every principle that survives ships strengthens the moat.
