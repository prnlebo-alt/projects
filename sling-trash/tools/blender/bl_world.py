import sys, os, json, random
sys.path.insert(0, os.path.dirname(__file__))
from bl_common import *
from bpy_extras.object_utils import world_to_camera_view
OUT = sys.argv[sys.argv.index('--') + 1]
META = {}
R = math.radians

def torus(name, loc, major, minor, color, rot=(0, 0, 0)):
    bpy.ops.mesh.primitive_torus_add(location=loc, rotation=rot, major_radius=major, minor_radius=minor, major_segments=48, minor_segments=24)
    o = bpy.context.active_object; o.name = name; return finish(o, color, 0.03)
def cone(name, loc, r1, r2, h, color, rot=(0, 0, 0), verts=40, scale=(1, 1, 1)):
    bpy.ops.mesh.primitive_cone_add(location=loc, rotation=rot, radius1=r1, radius2=r2, depth=h, vertices=verts)
    o = bpy.context.active_object; o.name = name; o.scale = scale; bpy.ops.object.transform_apply(scale=True)
    return finish(o, color, 0.03, True, 0.0)
def flat(name, loc, scale, color, rot=(0, 0, 0)):
    bpy.ops.mesh.primitive_uv_sphere_add(location=loc, rotation=rot, segments=24, ring_count=12)
    o = bpy.context.active_object; o.name = name; o.scale = scale; bpy.ops.object.transform_apply(scale=True)
    return finish(o, color, 0.0)
def body_rect(obj):
    sc = bpy.context.scene; cam = sc.camera; bpy.context.view_layer.update(); xs, ys = [], []
    for c in obj.bound_box:
        v = world_to_camera_view(sc, cam, obj.matrix_world @ Vector(c)); xs.append(v.x); ys.append(v.y)
    W, H = sc.render.resolution_x, sc.render.resolution_y
    return [min(xs) * W, (1 - max(ys)) * H, max(xs) * W, (1 - min(ys)) * H]
def shoot(name, scale, tilt=82, cz=0.8, cx=0, aspect=1.0, body=None):
    setup_light(); setup_camera(scale, aspect, tilt=tilt, cz=cz, cx=cx)
    sc = bpy.context.scene
    META[name] = {'w': sc.render.resolution_x, 'h': sc.render.resolution_y, 'ortho': scale if aspect >= 1 else scale * aspect}
    if body is not None: META[name]['body'] = body_rect(bpy.data.objects[body])
    render(os.path.join(OUT, name + '.png'))

def windows(x0, y0, z0, cols, rows, dx, dz, lit_seed, w=0.3, h=0.36):
    rnd = random.Random(lit_seed)
    for r in range(rows):
        for c in range(cols):
            lit = rnd.random() > 0.45
            box('win%d_%d' % (r, c), (x0 + c * dx, y0, z0 + r * dz), (w, 0.05, h), (1, 0.85, 0.35) if lit else (0.16, 0.1, 0.35), bevel=0.04, outline=0.0)

# sun / cloud / hill
reset('sun'); sphere('sun', (0, 0, 1), (1, 1, 1), (1, 0.82, 0.25)); shoot('sun', 2.8, tilt=90, cz=1.0, body='sun')
reset()
for (x, z, r) in ((0, .9, .8), (1.0, .8, .65), (-.95, .75, .6), (.45, 1.4, .6)): sphere('c%d' % int(x * 10), (x, 0, z), (r, r, r), (0.97, 0.98, 1.0), outline=0.03)
shoot('cloud', 4.6, tilt=86, cz=1.15)
reset('hill'); sphere('hill', (0, 0, 0), (3.0, 1.6, 1.7), (0.55, 0.87, 0.5)); shoot('hill', 7.4, tilt=90, cz=0, body='hill')
reset('hill'); sphere('hill2', (0, 0, 0), (3.0, 1.6, 1.7), (0.5, 0.8, 0.46)); shoot('hill2', 7.4, tilt=90, cz=0, body='hill2')

# houses
for i, col in enumerate(((1, 0.44, 0.65), (1, 0.82, 0.25), (0.18, 0.72, 0.8), (1, 0.54, 0.12), (0.72, 0.61, 0.94))):
    reset('house')
    box('walls', (0, 0, 0.95), (2.6, 1.8, 1.9), col, bevel=0.12)
    cone('roof', (0, 0, 2.55), 2.15, 0.0, 1.3, (0.9, 0.27, 0.24), rot=(0, 0, R(45)), verts=4, scale=(1, 0.8, 1))
    box('chim', (0.85, 0.2, 3.0), (0.4, 0.4, 0.8), (0.65, 0.3, 0.25), bevel=0.04, outline=0.025)
    box('door', (0, -0.93, 0.55), (0.6, 0.08, 1.1), (0.55, 0.35, 0.17), bevel=0.04); flat('knob', (0.2, -1.0, 0.55), (.05, .04, .05), (1, 0.82, 0.25))
    for sx in (-0.85, 0.85): box('win%d' % int(sx * 10), (sx, -0.93, 1.2), (0.55, 0.08, 0.55), (1, 0.9, 0.5) if i % 2 else (0.75, 0.92, 1), bevel=0.04); box('wf%d' % int(sx * 10), (sx, -0.98, 1.2), (0.06, 0.04, 0.55), (0.9, 0.9, 0.95), bevel=0.0, outline=0.0)
    shoot('house%d' % i, 5.6, tilt=84, cz=1.55, body='walls')
# tree, water tower
reset('tree'); cyl('trunk', (0, 0, 0.7), 0.2, 1.4, (0.6, 0.38, 0.2))
for (x, z, r, c) in ((0, 2.0, 1.0, (0.3, 0.8, 0.42)), (-0.7, 1.6, 0.7, (0.25, 0.72, 0.36)), (0.7, 1.7, 0.7, (0.25, 0.72, 0.36))): sphere('cr%d' % int(x * 10), (x, 0, z), (r, r, r), c)
shoot('tree', 5.0, tilt=86, cz=1.7, body='trunk')
reset('watertower'); cyl('tank', (0, 0, 3.3), 1.0, 1.1, (0.78, 0.84, 0.92)); cone('troof', (0, 0, 4.15), 1.1, 0.0, 0.7, (0.6, 0.66, 0.78))
for (x, y) in ((-0.6, -0.4), (0.6, -0.4), (-0.6, 0.4), (0.6, 0.4)): cyl('leg%d%d' % (int(x * 10), int(y * 10)), (x, y, 1.4), 0.08, 2.8, (0.62, 0.68, 0.8), outline=0.02)
shoot('watertower', 6.6, tilt=86, cz=2.5, body='tank')
# towers (tall renders)
def tower(name, col, h, cols, rows, seed, aspect=0.6, scale=None, cz=None):
    reset('tower'); box('body', (0, 0, h / 2), (2.0, 1.5, h), col, bevel=0.1)
    box('roof', (0, 0, h + 0.15), (2.2, 1.7, 0.3), tuple(c * .7 for c in col), bevel=0.05); cyl('ant', (0.5, 0, h + 0.9), 0.05, 1.2, (0.4, 0.4, 0.45), outline=0.02)
    windows(-0.6, -0.78, 0.8, cols, rows, 0.6, (h - 1.2) / max(1, rows - 1), seed)
    scale = scale or (h + 2.4); shoot(name, scale, tilt=88, cz=cz if cz is not None else h / 2 + 0.3, aspect=aspect, body='body')
tower('tower_far', (0.7, 0.52, 0.82), 6.5, 3, 7, 3, aspect=0.6)
tower('tower_near0', (0.42, 0.25, 0.71), 5.5, 3, 7, 5, aspect=0.6)
tower('tower_near1', (0.8, 0.4, 0.6), 5.5, 3, 7, 9, aspect=0.6)
# crane, boat, lighthouse
reset('crane')
for i, (z, c) in enumerate(((1.2, (0.9, 0.27, 0.24)), (3.6, (1, 0.95, 0.85)), (6.0, (0.9, 0.27, 0.24)))): cyl('post%d' % i, (0, 0, z), 0.3, 2.4, c, bevel=0.02)
box('cab', (0, 0, 7.5), (1.1, 0.9, 0.8), (0.33, 0.33, 0.4), bevel=0.1); box('beam', (2.0, 0, 7.4), (5, 0.4, 0.4), (0.9, 0.27, 0.24), bevel=0.06); box('cw', (-1.8, 0, 7.4), (0.9, 0.8, 0.8), (0.33, 0.33, 0.4), bevel=0.08)
cyl('rope', (3.5, 0, 6.2), 0.05, 2.0, (1, 0.95, 0.85), outline=0.02, bevel=0); torus('hook', (3.5, 0, 5.0), 0.25, 0.07, (1, 0.82, 0.25), rot=(R(90), 0, 0))
shoot('crane', 10.2, tilt=88, cz=4.3, cx=1.0, aspect=0.8, body='post0')
reset('boat'); box('hull', (0, 0, 0.3), (2.2, 0.8, 0.5), (0.9, 0.27, 0.24), bevel=0.18); cyl('mast', (0.1, 0, 1.8), 0.05, 2.8, (0.4, 0.3, 0.2), outline=0.02, bevel=0)
cone('sail', (0.7, 0, 1.7), 0.95, 0.0, 2.2, (1, 1, 1), verts=3, scale=(1, 0.06, 1)); cone('sail2', (-0.35, 0, 1.4), 0.6, 0.0, 1.6, (0.95, 0.95, 1), verts=3, scale=(1, 0.06, 1))
shoot('sailboat', 4.2, tilt=86, cz=1.4, body='hull')
reset('lighthouse'); cone('lh', (0, 0, 1.9), 0.75, 0.5, 3.8, (1, 1, 1)); cyl('lhband', (0, 0, 1.9), 0.62, 0.55, (0.9, 0.27, 0.24), outline=0.02, bevel=0); cyl('lant', (0, 0, 4.1), 0.45, 0.5, (1, 0.92, 0.5), bevel=0.02); cone('lroof', (0, 0, 4.7), 0.65, 0.0, 0.7, (0.9, 0.27, 0.24))
shoot('lighthouse', 6.6, tilt=88, cz=2.7, body='lh')
# casino
for i, neon in enumerate(((1, 0.35, 0.65), (0.2, 0.85, 0.9))):
    reset('casino'); h = 5.2; box('body', (0, 0, h / 2), (2.8, 1.8, h), (0.26, 0.13, 0.53), bevel=0.1)
    for (x, z, w, hh) in ((0, h - 0.1, 2.8, 0.14), (0, 0.05, 2.8, 0.14), (-1.35, h / 2, 0.14, h), (1.35, h / 2, 0.14, h)): box('neon%d_%d' % (int(x * 10), int(z * 10)), (x, -0.95, z), (w, 0.1, hh), neon, bevel=0.03, outline=0.0)
    windows(-0.8, -0.96, 0.9, 4, 7, 0.55, 0.62, 20 + i, w=0.32, h=0.38)
    shoot('casino%d' % i, h + 1.4, tilt=88, cz=h / 2, aspect=0.75, body='body')
# junk mounds
for i in range(2):
    reset('mound'); sphere('mound', (0, 0, 0), (2.8, 1.8, 1.9), (0.49, 0.36, 0.2) if i == 0 else (0.43, 0.32, 0.18))
    for (x, z, kind, c) in (((-1.4, 1.2, 'tire', (1, 0.54, 0.12)), (0.9, 1.4, 'bag', (0.25, 0.75, 0.42)), (0.0, 1.8, 'bottle', (0.95, 0.9, 0.78))) if i == 0 else ((-1.0, 1.4, 'bag', (1, 0.44, 0.65)), (1.2, 1.1, 'tire', (0.9, 0.27, 0.24)), (0.1, 1.85, 'can', (0.78, 0.8, 0.85)))):
        if kind == 'tire': torus('t%d' % i, (x, -1.0, z), 0.5, 0.2, c, rot=(R(90), 0, 0))
        elif kind == 'bag': sphere('b%d' % i, (x, -1.0, z), (.55, .5, .5), c); cone('bk%d' % i, (x, -1.0, z + 0.55), 0.16, 0.03, 0.4, c)
        elif kind == 'bottle': cyl('bo%d' % i, (x, -1.0, z), 0.18, 0.7, c, rot=(0, R(25), 0)); 
        else: cyl('ca%d' % i, (x, -1.0, z), 0.22, 0.6, c, rot=(0, R(-20), 0))
    shoot('mound%d' % i, 7.6, tilt=90, cz=0.4, body='mound')
# obstacles: cars, fence, pad
for i, col in enumerate(((0.91, 0.27, 0.24), (0.25, 0.64, 0.91), (0.94, 0.71, 0.16))):
    reset('car'); box('body', (0, 0, 0.75), (3.3, 1.5, 0.9), col, bevel=0.22); box('cabin', (-0.1, 0, 1.45), (1.8, 1.4, 0.8), tuple(c * .85 for c in col), bevel=0.2)
    box('wnd1', (-0.55, -0.72, 1.5), (0.7, 0.06, 0.5), (0.75, 0.92, 1), bevel=0.05, outline=0.015); box('wnd2', (0.35, -0.72, 1.5), (0.7, 0.06, 0.5), (0.75, 0.92, 1), bevel=0.05, outline=0.015)
    for x in (-1.0, 1.05): cyl('w%d' % int(x * 10), (x, -0.78, 0.42), 0.44, 0.3, (0.17, 0.17, 0.21), rot=(R(90), 0, 0), bevel=0.03); cyl('h%d' % int(x * 10), (x, -0.95, 0.42), 0.18, 0.1, (0.75, 0.75, 0.8), rot=(R(90), 0, 0), bevel=0.01, outline=0.0)
    flat('lamp', (1.62, -0.35, 0.9), (.12, .08, .16), (1, 0.9, 0.5))
    shoot('car%d' % i, 5.4, tilt=84, cz=1.05, body='body')
reset('fence'); box('plank', (0, 0, 1.7), (1.2, 0.35, 3.4), (0.85, 0.63, 0.4), bevel=0.1); box('r1', (0, -0.2, 2.5), (1.25, 0.1, 0.18), (0.6, 0.4, 0.2), bevel=0.02, outline=0.02); box('r2', (0, -0.2, 0.9), (1.25, 0.1, 0.18), (0.6, 0.4, 0.2), bevel=0.02, outline=0.02)
flat('n1', (-0.3, -0.25, 2.5), (.05, .04, .05), (0.2, 0.15, 0.1)); flat('n2', (0.3, -0.25, 0.9), (.05, .04, .05), (0.2, 0.15, 0.1))
shoot('fence', 4.8, tilt=88, cz=1.75, body='plank')
reset('pad'); box('base', (0, 0, 0.2), (3.2, 1.3, 0.4), (0.18, 0.72, 0.8), bevel=0.14); box('top', (0, 0, 0.5), (2.8, 1.1, 0.12), (1, 0.82, 0.25), bevel=0.04, outline=0.02)
for x in (-0.9, 0, 0.9): cone('arr%d' % int(x * 10), (x, -0.4, 0.6), 0.26, 0.0, 0.3, (0.9, 0.27, 0.24), verts=3)
shoot('pad', 4.2, tilt=84, cz=0.5, body='base')

json.dump(META, open(os.path.join(OUT, 'meta_world_raw.json'), 'w'), indent=1)
print('DONE', len(META))
