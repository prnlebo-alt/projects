# Claude Clay — Technical Blueprint

Source: Gemini analysis of the claymation UI engine, captured 2026-05-19.

This document specifies the technical architecture for the Claude Clay UI engine, from the V1 CSS prototype through the future PBR + stop-motion pipeline.

---

## 1. Architecture: Stage + Actors

The product is built on a strict separation between the **stage** (the rendered environment) and the **actors** (the interactive UI elements that sit on it).

```
┌─────────────────────────────────────────────────┐
│ APP CONTAINER (clay frame, 28px radius)         │
│ ┌─────────────────────────────────────────────┐ │
│ │ STAGE.JPG — pre-rendered claymation backdrop│ │
│ │ • clay wall + surface texture                │ │
│ │ • directional warm light from upper-left     │ │
│ │ • decorative props (mug, plant, books, etc.) │ │
│ │ • NO interactive UI elements baked in        │ │
│ │ ─────────────────────────────────────────── │ │
│ │ ACTOR LAYER (React + framer-motion)         │ │
│ │ • Sidebar tablet (dark clay slab)            │ │
│ │ • Main panel (cream clay slab)               │ │
│ │ • Composer (stamped trough)                  │ │
│ │ • Chips (smooth clay pebbles)                │ │
│ │ • Buttons (raised pellets)                   │ │
│ └─────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────┘
```

**Why this split:**
- The stage is **expensive to render** (image generator + art direction) but **cheap to deliver** (a single JPG).
- The actors are **cheap to render** (CSS/React) but **expensive to design** (every element needs its own material recipe).
- Updating one doesn't require re-rendering the other. Iterating on the actor layer is a CSS edit; iterating on the stage is an image re-generation.

---

## 2. Structural Layout

### V1 (current — CSS prototype)
- React 18 SPA mounted via `createRoot`
- Inline styles only — no Tailwind, no external CSS files
- framer-motion 11 for interaction physics
- Babel-standalone in-browser JSX compilation (no build step)
- Single self-contained HTML file at `/tmp/clay-ui/index.html`

### V1.5 (Skyn extension integration)
- The Claude Clay skin in `skyn-extension/src/shared/skins.ts` becomes the deployment vehicle
- `customCss` block uses the same shadow + border recipes as the prototype
- `stage.jpg` ships in `public/assets/skins/claude-clay/` and is loaded via the `{{asset:...}}` placeholder
- The actor layer is Claude.ai's own DOM, not React — `customCss` paints clay shadows / borders / backgrounds onto Claude's existing user bubbles, AI bubbles, composer, sidebar, etc.

### V2 (target — PBR rendering pipeline)
- WebGL/Canvas overlay for each major actor surface
- Pre-computed normal maps + roughness maps per element type (chip, button, slab, trough)
- Per-frame Fresnel-correct lighting calculation matching the stage's key light direction
- Subsurface scattering approximation for thin/translucent clay forms (the warm glow inside a pellet under raking light)
- CSS becomes the layout layer only; visual fidelity moves to GPU

---

## 3. PBR Surface Shaders

The CSS prototype fakes material response with stacked `box-shadow` recipes. The real engine uses physically-based rendering:

**Per-actor texture maps (baked once, shipped as assets):**
- `albedo.png` — base color, ~512×512
- `normal.png` — surface bumps for pore/dent/crack microgeometry
- `roughness.png` — local glossiness variation (worn corners shinier than centers)
- `ao.png` — baked ambient occlusion for edge darkening

**Shader inputs (per frame):**
- Light direction vector (extracted from stage.jpg key light, hard-coded per stage)
- Light color (warm 5500K key + cool 7000K bounce)
- View direction (from camera position to fragment)
- Surface normal (sampled from normal.png + perturbed by stop-motion boiling, see §6)

**Output:**
- Lambertian diffuse + GGX specular
- Fresnel response at grazing angles (the clay's specular highlight rolls around the rim as the user rotates the element via interaction)
- Soft penumbra shadow casting onto the stage and onto adjacent actors

**The point** of PBR for a non-realistic clay aesthetic: claymation looks "right" because the puppet receives real photons. A digital UI element with painted shadows can never quite respond correctly to the eye's expectation of how light wraps around a curved surface. PBR gives us that response for free.

---

## 4. Physical Typography

Type isn't painted glyphs sitting above the surface — it's a physical impression in the clay.

### V1 approach (CSS prototype)
- 3-layer `text-shadow` recipe: bright top edge + dark bottom edge + soft diffuse cast
- "Surface interruption" technique on the greeting headline: an `aria-hidden` blurred duplicate sits 1px below the visible text, simulating displaced clay around the impression

### V2 approach (PBR)
- Each glyph is a subtractive mesh — cut into the surface depth buffer
- Surface normal map perturbed along the glyph edges so the depression catches light correctly
- Subtle per-glyph rotation jitter (±0.3°) and depth jitter (±0.4px stamp depth) so type feels stamped by a human hand, not laser-cut
- Heading type optionally rendered as **extruded clay letterforms** (raised, not stamped) for marquee elements like the sidebar logo

### Font choices
- Headlines: Lora (warm serif, reads as carved)
- Body: Work Sans (clean sans-serif, reads as stamped)
- Both should ship as static assets, never web-font-loaded (latency = digital-feeling)

---

## 5. Stop-Motion Behavioral Physics

This is where most digital "clay" attempts fail. Real claymation has four signature motion properties that the engine must reproduce:

### 5.1. 12 fps throttling

**The look**: stop-motion is shot at 12 fps (sometimes 24fps "doubles"). Motion samples to a 1/12s grid. Animation looks like a series of held poses, not a continuous slide.

**The implementation**:
```javascript
let lastCommitTime = 0;
const FRAME_DURATION = 1000 / 12; // ~83.33ms

function throttledRAF(callback) {
  const tick = (now) => {
    if (now - lastCommitTime >= FRAME_DURATION) {
      lastCommitTime = now;
      callback(now);
    }
    requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
}
```

All actor animations (hover, tap, idle drift, asterisk spin) go through `throttledRAF`. The browser still paints at 60Hz / display refresh; we just commit position updates 12 times per second. The result: that characteristic stutter-step.

**Subtlety**: don't throttle everything. CSS transitions on color, opacity, and text-shadow stay smooth — those don't read as physical motion. Only positional/rotational/scale updates get the 12fps treatment.

### 5.2. Boiling

**The look**: even when a clay puppet is "still," its surface and silhouette wobble imperceptibly because the puppeteer reset the pose between exposures and the resets were never exact.

**The implementation**: every actor has a continuous low-amplitude noise generator running:
```javascript
const boilNoise = (t, seed) => {
  // Pseudo-Perlin: deterministic noise per actor, ~0.3px amplitude
  return {
    x: Math.sin(t * 0.001 + seed * 7) * 0.3,
    y: Math.cos(t * 0.0013 + seed * 11) * 0.3,
    rotate: Math.sin(t * 0.0007 + seed * 13) * 0.15,
  };
};
```

Each actor's `seed` is stable per element (derived from index or label), so its boiling pattern is unique but reproducible. Applied via framer-motion's `animate` on the boiled transform values, throttled to 12fps.

**The current CSS prototype** has a coarse version of this via the "idle drift" `useAnimationControls` loops on chips and buttons. V2 generalizes to all actors.

### 5.3. Viscous recovery

**The look**: when a clay form is poked, it deforms (compresses, bulges) and slowly springs back — much slower than a digital UI's snap-back.

**The implementation**:
- Click handler triggers a deformation animation (chip compresses by ~4% on the press axis, bulges perpendicular by ~2%)
- On release, the spring back uses an **overdamped** spring: stiffness 80–120, damping 8–12
- Settling time: 600–1000ms vs. a typical UI's 200ms
- Optional: the deformation leaves a brief afterimage (fingerprint depression, see §5.4)

framer-motion config:
```javascript
transition: { type: 'spring', stiffness: 90, damping: 10, mass: 1.4 }
```

The `mass` parameter is the trick — clay forms have weight. Increase mass and the spring feels slower without changing the underlying physics.

### 5.4. Dynamic stamping

**The look**: when you press clay, you leave a mark. The mark fades as the clay slowly relaxes back — but it's visible for a beat.

**The implementation**: per-actor decay overlay layer
- On press: instantiate a small SVG/canvas patch at the press point with darkening (compressed clay reads darker)
- The patch fades over 800–1200ms via opacity + radius interpolation
- Click hover trails: light glossy streak following cursor through hover, fading at 400ms

For V1, this is unimplemented. For V2, it's a per-actor "interaction memory" canvas overlay that decays continuously and accepts new stamps additively.

---

## 6. Boiling Effect — Detailed Implementation Notes

Boiling is the single most important "tell" that something is claymation vs. digital. Without it, the scene reads as plastic.

**Decomposition of boiling into independent noise channels:**
- **Surface noise**: the normal map shifts by tiny amounts every frame, simulating the puppeteer's fingers redistributing clay. Implement as a UV offset on the normal sampler, modulated by per-pixel low-frequency Perlin noise.
- **Silhouette noise**: the actor's outline wobbles ±0.3px in random directions. Affects layout marginally — important to apply as a transform on the outermost wrapper so the actor's own internal positioning is unaffected.
- **Color noise**: the albedo color shifts ±2% lightness per region per frame, simulating pigment redistribution. Apply via a CSS filter `brightness()` on actor wrappers, modulated by per-actor noise.

All three operate independently at 12fps. The combination is what reads as "alive but still."

**Performance budget**: with ~30 actors on screen, each running 3 noise channels at 12fps, that's 1,080 transform updates per second. Trivial for any GPU; the bottleneck is React reconciliation. Solution: bypass React for the boiling layer entirely. Use framer-motion's `useMotionValue` + `useTransform` chains that update via subscription, not re-render.

---

## 7. Viscous Recovery — Spring Tuning Reference

| Actor type | Stiffness | Damping | Mass | Settling time |
|---|---|---|---|---|
| Small pellet (chip, plus button) | 110 | 11 | 1.2 | ~600ms |
| Medium pellet (model selector, address bar) | 95 | 10 | 1.4 | ~800ms |
| Large slab (main panel, sidebar) | 70 | 9 | 2.0 | ~1100ms |
| Trough (composer) | 60 | 10 | 1.6 | ~1000ms (asymmetric: top edge recovers slower than bottom) |

Larger elements have more mass and slower recovery, just like real clay.

---

## 8. Dynamic Stamping — Decay Model

```javascript
// Each stamp is { x, y, radius, depth, age }
// Per frame, age increments by frameTime/12fps
// Render: depth * (1 - age/lifetime), with radius * sqrt(age/lifetime + 0.3)

const STAMP_LIFETIME_MS = 1000;
const STAMP_INITIAL_DEPTH = 0.6;
const STAMP_INITIAL_RADIUS = 8;

function renderStamp(ctx, stamp, now) {
  const age = (now - stamp.bornAt) / STAMP_LIFETIME_MS;
  if (age >= 1) return false; // expire
  const depth = stamp.depth * (1 - age);
  const radius = stamp.radius * (Math.sqrt(age + 0.3));
  ctx.fillStyle = `rgba(90, 55, 20, ${depth})`;
  ctx.beginPath();
  ctx.arc(stamp.x, stamp.y, radius, 0, Math.PI * 2);
  ctx.fill();
  return true;
}
```

Each actor maintains its own stamp queue. Stamps render to a per-actor canvas overlay positioned above the actor's painted surface but below the actor's content (text, icons).

---

## 9. The CSS Ceiling

CSS-only clay simulation has a hard ceiling. The V1 prototype proves the concept; the V2 pipeline breaks through it.

**What CSS does well:**
- Multi-layer shadow stacks for thickness illusion
- Inset shadows for embossed/debossed surfaces
- Border styles for material seams
- `mix-blend-mode` for noise overlays
- Gradients for pigment

**What CSS cannot do:**
- Per-pixel lighting calculation matching a real light source
- Surface normal perturbation responding to interaction
- True subsurface scattering
- Frame-rate-throttled animation without losing browser-driven smoothness
- Real-time deformation of element boundaries (CSS clip-path is too crude)
- Per-actor noise textures that update at 12fps without thrashing layout

When the V1 prototype hits the ceiling, the upgrade path is V2. The interface contract (stage + actors, framer-motion gestures, asset-based stages) stays identical. Only the rendering substrate for the actor layer changes.

---

## 10. Performance Targets

| Surface | V1 (CSS) | V2 (PBR) |
|---|---|---|
| Idle frame time | <2ms | <4ms |
| Hover response | <16ms (one frame at 60Hz) | <16ms |
| Press deformation | <16ms | <16ms |
| Layout-affecting boiling | not supported | runs in worker, 12fps committed to GPU buffer |
| Stage image size | <100kb JPG | <100kb JPG (unchanged) |
| Total actor assets | 0 (CSS) | <300kb per skin (8 normal/roughness/AO maps) |

V2 must not regress on hover latency. The PBR pipeline runs in a parallel layer; CSS handles gesture state, framer-motion handles spring physics, PBR handles surface response.

---

## Open questions

- Does V2 need a fallback path for devices without `OffscreenCanvas` or WebGL2? Likely yes — fall back to V1 CSS recipes.
- Stage image versioning: do we want per-skin variations (morning Claude Clay, evening Claude Clay)? Defer to V2 if so.
- Multi-platform: this blueprint assumes Claude.ai. ChatGPT and Gemini DOM are very different — V2 should be designed so the actor layer's geometry is platform-pluggable.
