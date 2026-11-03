# Sprite pipeline (Blender, headless)

All art in `assets/` is rendered by these scripts: cel-shaded 3-band lighting plus inverted-hull ink outlines, transparent PNGs.

```bash
BLENDER=/Applications/Blender.app/Contents/MacOS/Blender   # tested with Blender 5.2 LTS
$BLENDER -b --factory-startup -P tools/blender/bl_assets.py -- assets   # characters, bins, boss, trash, props, portraits
$BLENDER -b --factory-startup -P tools/blender/bl_world.py  -- assets   # houses, towers, crane, casino, mounds, cars, fence, pad
```

Each script writes `meta_raw.json` / `meta_world_raw.json` (sprite size, ortho scale, body rectangle). The game reads `assets/meta.js` (`window.SPRITE_META`), which also needs each sprite's alpha bounding box (`bbox`). Merge both with a short PIL step: for every PNG take `Image.split()[3].point(lambda v: 255 if v > 20 else 0).getbbox()`.
Two post-render touches were applied with PIL: `cloud.png` lightened 62 percent and `sun.png` lightened 18 percent with a blur on its fill.

Play via `python3 -m http.server --directory sling-trash` or open `index.html` directly. If a sprite fails to load, the game falls back to the canvas-drawn art.
