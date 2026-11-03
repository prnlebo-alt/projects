import sys, os, ast
sys.path.insert(0, os.path.dirname(__file__))
from bl_common import *
OUT = sys.argv[sys.argv.index('--') + 1]
R = math.radians
# reuse helpers/builders from bl_assets without running its render calls
src = open(os.path.join(os.path.dirname(__file__), 'bl_assets.py')).read()
tree = ast.parse(src)
keep = {'torus', 'cone', 'flat', 'body_rect', 'shoot', 'bin_', 'boss', 'trash'}
ns = dict(globals()); ns.update({'OUT': OUT, 'META': {}, 'R': R})
from bpy_extras.object_utils import world_to_camera_view
ns['world_to_camera_view'] = world_to_camera_view
mod = ast.Module(body=[n for n in tree.body if isinstance(n, ast.FunctionDef) and n.name in keep] + ast.parse("G = (0.247, 0.749, 0.416); DG = (0.165, 0.561, 0.314); LG = (0.31, 0.81, 0.52); BG_ = (0.35, 0.56, 0.59); BGD = (0.24, 0.38, 0.41)").body, type_ignores=[])
exec(compile(mod, 'bl_assets_parts', 'exec'), ns)
shoot = ns['shoot']; flat = ns['flat']
def cone(name, loc, r1, r2, h, color, rot=(0, 0, 0), verts=40, scale=(1, 1, 1)):
    bpy.ops.mesh.primitive_cone_add(location=loc, rotation=rot, radius1=r1, radius2=r2, depth=h, vertices=verts)
    o = bpy.context.active_object; o.name = name; o.scale = scale; bpy.ops.object.transform_apply(scale=True)
    return finish(o, color, 0.03, True, 0.0)
ns['cone'] = cone

def hero_gus(name):
    reset('gus'); NAVY = (0.2, 0.34, 0.66); OR = (1, 0.58, 0.12); SK = (1, 0.78, 0.6)
    for sx in (-1, 1): box('boot%d' % sx, (sx * 0.34, -0.15, 0.14), (0.62, 0.85, 0.28), (0.4, 0.26, 0.14), bevel=0.12)
    for sx in (-1, 1): cyl('leg%d' % sx, (sx * 0.34, 0, 0.62), 0.22, 0.7, NAVY)
    box('torso', (0, 0, 1.45), (1.5, 1.05, 1.05), OR, bevel=0.4); box('stripe', (0, 0, 1.3), (1.56, 1.1, 0.16), (1, 0.88, 0.3), bevel=0.05, outline=0.0)
    for sx in (-1, 1):
        piv = bpy.data.objects.new('p%d' % sx, None); bpy.context.collection.objects.link(piv); piv.location = (sx * 0.95, 0, 1.75)
        bpy.ops.mesh.primitive_cylinder_add(radius=0.2, depth=0.8, vertices=32, location=(0, 0, -0.4)); a = bpy.context.active_object; bpy.ops.object.transform_apply(location=True); finish(a, OR, 0.025, True, 0.04); a.parent = piv
        h = sphere('hand%d' % sx, (0, 0, -0.85), (.24, .24, .24), SK); h.parent = piv; piv.rotation_euler = (0, R(-sx * 12), 0)
    sphere('head', (0, 0, 2.95), (1.15, 1.0, 1.05), SK)
    sphere('cap', (0, 0.03, 3.45), (1.2, 1.06, 0.7), NAVY); sphere('brim', (0, -0.85, 3.2), (0.95, 0.62, 0.12), NAVY)
    for sx in (-1, 1):
        sphere('eyeW%d' % sx, (sx * 0.42, -0.93, 3.0), (0.3, 0.16, 0.36), (1, 1, 1), outline=0.015); flat('eyeP%d' % sx, (sx * 0.4, -1.06, 2.98), (0.14, 0.07, 0.19), (0.05, 0.03, 0.12)); flat('eyeH%d' % sx, (sx * 0.36, -1.12, 3.08), (0.05, 0.03, 0.06), (1, 1, 1))
    sphere('nose', (0, -1.0, 2.7), (0.2, 0.18, 0.18), (1, 0.62, 0.48), outline=0.02)
    sphere('stache', (0, -0.98, 2.5), (0.7, 0.2, 0.17), (0.45, 0.25, 0.12), outline=0.025)
    flat('mouth', (0, -0.97, 2.22), (0.28, 0.07, 0.1), (0.5, 0.12, 0.18))
    shoot(name, 5.0, tilt=84, cz=1.85, body='torso')

def hero_gerald(name):
    reset('bird'); GR = (0.62, 0.66, 0.78)
    sphere('body', (-0.1, 0, 1.05), (1.0, 0.75, 0.75), GR)
    box('tail', (-1.2, 0, 1.05), (0.9, 0.34, 0.24), (0.45, 0.5, 0.64), bevel=0.1, rot=(0, R(18), 0))
    sphere('head', (0.78, 0, 1.95), (0.8, 0.72, 0.78), GR)
    sphere('neck', (0.62, -0.15, 1.5), (0.42, 0.4, 0.42), (0.5, 0.82, 0.66), outline=0.02)
    cone('beak', (1.6, 0, 1.85), 0.2, 0.0, 0.7, (1, 0.6, 0.12), rot=(0, R(90), 0))
    sphere('eyeW', (1.05, -0.55, 2.05), (0.26, 0.14, 0.3), (1, 1, 1), outline=0.015); flat('eyeP', (1.12, -0.68, 2.03), (0.12, 0.06, 0.16), (0.05, 0.03, 0.12)); flat('eyeH', (1.08, -0.74, 2.12), (0.045, 0.03, 0.05), (1, 1, 1))
    sphere('hat', (0.78, 0, 2.6), (0.7, 0.62, 0.42), (1, 0.84, 0.28)); box('hatb', (0.78, 0, 2.38), (1.4, 1.1, 0.1), (1, 0.84, 0.28), bevel=0.04, outline=0.02)
    piv = bpy.data.objects.new('wp', None); bpy.context.collection.objects.link(piv); piv.location = (-0.2, -0.65, 1.3)
    w = sphere('wing', (-0.55, 0, 0), (0.9, 0.18, 0.42), (0.5, 0.55, 0.7)); w.parent = piv; piv.rotation_euler = (0, R(18), 0)
    for x in (-0.2, 0.25): cyl('leg%d' % int(x * 10), (x, 0, 0.3), 0.07, 0.6, (1, 0.6, 0.12), outline=0.02)
    shoot(name, 4.6, tilt=82, cz=1.5, body='body')

def hero_house(name, col):
    reset('house')
    box('walls', (0, 0, 0.95), (2.6, 1.8, 1.9), col, bevel=0.22)
    cone('roof', (0, 0, 2.6), 2.2, 0.0, 1.4, (0.92, 0.3, 0.26), rot=(0, 0, R(45)), verts=4, scale=(1, 0.8, 1))
    box('chim', (0.85, 0.2, 3.05), (0.42, 0.42, 0.8), (0.7, 0.34, 0.28), bevel=0.08)
    box('door', (0, -0.93, 0.55), (0.62, 0.08, 1.1), (0.58, 0.36, 0.18), bevel=0.08); flat('knob', (0.2, -1.0, 0.55), (.06, .05, .06), (1, 0.85, 0.3))
    for sx in (-0.85, 0.85): box('win%d' % int(sx * 10), (sx, -0.93, 1.25), (0.6, 0.08, 0.6), (0.78, 0.93, 1), bevel=0.1)
    shoot(name, 5.6, tilt=84, cz=1.55, body='walls')

hero_gus('s_gus'); hero_gerald('s_gerald')
ns['bin_']('s_bin', True, False); ns['boss']('s_boss', True)
reset('bag'); sphere('bag', (0, 0, 0.9), (1, .92, .92), (0.5, 0.42, 0.82)); cone('knot', (0, 0, 1.95), 0.32, 0.07, 0.7, (0.5, 0.42, 0.82)); flat('hl', (-0.45, -0.75, 1.3), (.3, .12, .2), (1, 0.97, 0.85)); shoot('s_bag', 3.2, tilt=82, cz=1.05, body='bag')
hero_house('s_house', (1, 0.5, 0.68))
print('SAMPLE DONE')
