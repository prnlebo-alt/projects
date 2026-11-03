"""Merge raw sprite metadata into assets/meta.js and lighten cloud/sun. Run after the Blender scripts: python3 tools/blender/postprocess.py"""
import json, os, sys
from PIL import Image, ImageFilter
A = os.path.join(os.path.dirname(__file__), '..', '..', 'assets') + '/'
meta = {}
for raw in ('meta_raw.json', 'meta_world_raw.json'):
    if os.path.exists(A + raw):
        meta.update(json.load(open(A + raw))); os.remove(A + raw)
def lighten(name, amt, blur=False):
    im = Image.open(A + name + '.png').convert('RGBA'); px = im.load(); w, h = im.size
    sp = (im.filter(ImageFilter.GaussianBlur(2.2)) if blur else im).load()
    for y in range(h):
        for x in range(w):
            r, g, b, a = px[x, y]
            if a > 20:
                if blur and (r * 299 + g * 587 + b * 114) / 1000 > 90: r, g, b, _ = sp[x, y]
                if (r * 299 + g * 587 + b * 114) / 1000 > 90:
                    px[x, y] = (int(r + (255 - r) * amt), int(g + (255 - g) * amt), int(b + (255 - b) * amt), a)
    im.save(A + name + '.png')
lighten('cloud', 0.62); lighten('sun', 0.18, blur=True)
for n, m in meta.items():
    im = Image.open(A + n + '.png').convert('RGBA'); a = im.split()[3].point(lambda v: 255 if v > 20 else 0)
    m['bbox'] = list(a.getbbox()); m['body'] = [round(v, 1) for v in m['body']] if m.get('body') else None
open(A + 'meta.js', 'w').write('window.SPRITE_META = ' + json.dumps(meta) + ';\n')
print('meta for', len(meta), 'sprites')
