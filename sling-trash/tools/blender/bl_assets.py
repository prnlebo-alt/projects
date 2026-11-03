import sys, os, json
sys.path.insert(0, os.path.dirname(__file__))
from bl_common import *
from bpy_extras.object_utils import world_to_camera_view
OUT = sys.argv[sys.argv.index('--') + 1]
META = {}
R = math.radians

def torus(name, loc, major, minor, color, rot=(0, 0, 0)):
    bpy.ops.mesh.primitive_torus_add(location=loc, rotation=rot, major_radius=major, minor_radius=minor, major_segments=48, minor_segments=24)
    o = bpy.context.active_object; o.name = name
    return finish(o, color, 0.03)

def cone(name, loc, r1, r2, h, color, rot=(0, 0, 0)):
    bpy.ops.mesh.primitive_cone_add(location=loc, rotation=rot, radius1=r1, radius2=r2, depth=h, vertices=40)
    o = bpy.context.active_object; o.name = name
    return finish(o, color, 0.03, True, 0.0)

def flat(name, loc, scale, color, rot=(0, 0, 0)):
    """small unlit-ish detail sphere (eyes, dots) without outline"""
    bpy.ops.mesh.primitive_uv_sphere_add(location=loc, rotation=rot, segments=24, ring_count=12)
    o = bpy.context.active_object; o.name = name; o.scale = scale
    bpy.ops.object.transform_apply(scale=True)
    return finish(o, color, 0.0)

def body_rect(obj):
    sc = bpy.context.scene; cam = sc.camera
    bpy.context.view_layer.update()
    xs, ys = [], []
    for c in obj.bound_box:
        v = world_to_camera_view(sc, cam, obj.matrix_world @ Vector(c))
        xs.append(v.x); ys.append(v.y)
    W, H = sc.render.resolution_x, sc.render.resolution_y
    return [min(xs) * W, (1 - max(ys)) * H, max(xs) * W, (1 - min(ys)) * H]

def shoot(name, scale, tilt=80, cz=0.8, cx=0, aspect=1.0, body=None):
    setup_light(); setup_camera(scale, aspect, tilt=tilt, cz=cz, cx=cx)
    META[name] = {'w': bpy.context.scene.render.resolution_x, 'h': bpy.context.scene.render.resolution_y, 'ortho': scale}
    if body is not None: META[name]['body'] = body_rect(bpy.data.objects[body])
    render(os.path.join(OUT, name + '.png'))

G = (0.247, 0.749, 0.416); DG = (0.165, 0.561, 0.314); LG = (0.31, 0.81, 0.52)
BG_ = (0.35, 0.56, 0.59); BGD = (0.24, 0.38, 0.41)

def bin_(name, open_lid, asleep):
    reset('bin')
    col = BG_ if asleep else G; dcol = BGD if asleep else DG
    box('body', (0, 0, 0.62), (2.6, 1.5, 1.24), col, bevel=0.16)
    for i in (-0.8, 0, 0.8): box('rib%d' % int(i * 10), (i, -0.77, 0.62), (0.16, 0.06, 1.0), tuple(c * .72 for c in col), bevel=0.02, outline=0.02)
    box('rim', (0, 0, 1.28), (2.78, 1.62, 0.2), dcol, bevel=0.08)
    for x in (-0.95, 0.95): cyl('wheel%d' % int(x * 10), (x, -0.5, -0.05), 0.24, 0.24, (0.3, 0.3, 0.34), rot=(math.pi / 2, 0, 0))
    if open_lid:
        box('lid', (0, 0.85, 2.15), (2.9, 0.18, 1.7), LG, bevel=0.06, rot=(R(-12), 0, 0))
        box('lidh', (0, 0.7, 2.7), (0.8, 0.14, 0.14), (0.75, 0.95, 0.82), bevel=0.04, outline=0.02)
    else:
        box('lid', (0, 0, 1.5), (2.92, 1.72, 0.22), dcol, bevel=0.08)
        box('handle', (0, -0.05, 1.7), (0.8, 0.3, 0.16), (0.75, 0.95, 0.82), bevel=0.05)
    shoot(name, 5.4, tilt=80, cz=1.35, body='body')
bin_('bin_open', True, False); bin_('bin_closed', False, True)

def boss(name, open_lid):
    reset('boss')
    P_ = (0.54, 0.37, 0.82); DP = (0.36, 0.23, 0.6)
    for (x, z, r, c) in ((-1.55, 2.0, .5, (0.25, 0.75, 0.42)), (1.6, 1.5, .45, (0.78, 0.78, 0.83)), (-1.5, .7, .42, (0.18, 0.18, 0.2)), (1.55, .55, .4, (0.9, 0.27, 0.24)), (0.7, 2.95, .34, (1, .82, .25))):
        sphere('junk%d' % int(x * 10 + z), (x, -0.2, z), (r, r, r), c)
    box('body', (0, 0, 1.35), (2.9, 1.9, 2.7), P_, bevel=0.3)
    if open_lid:
        box('hole', (0, 0, 2.72), (2.5, 1.6, 0.06), (0.1, 0.05, 0.18), bevel=0.0, outline=0.0)
        box('lid', (0, 1.25, 3.55), (3.0, 0.3, 1.6), (0.6, 0.45, 0.88), bevel=0.1, rot=(R(-32), 0, 0))
        cyl('hinge', (0, 0.9, 2.78), 0.14, 3.0, DP, rot=(0, R(90), 0), outline=0.02)
    else:
        box('lid', (0, 0, 2.9), (3.1, 2.1, 0.4), DP, bevel=0.12)
    shoot(name, 6.8, tilt=80, cz=2.1, body='body')
boss('boss_open', True); boss('boss_closed', False)

def trash():
    reset('bag'); sphere('bag', (0, 0, 0.9), (1, .9, .9), (0.455, 0.384, 0.722))
    cone('knot', (0, 0, 1.95), 0.3, 0.06, 0.7, (0.455, 0.384, 0.722)); flat('hl', (-0.4, -0.7, 1.3), (.26, .1, .18), (1, .95, .8))
    shoot('bag', 3.2, tilt=82, cz=1.05, body='bag')
    reset('can'); cyl('can', (0, 0, 0.8), 0.55, 1.6, (0.84, 0.87, 0.9), bevel=0.06); cyl('band', (0, 0, 0.62), 0.575, 0.6, (0.91, 0.27, 0.24), bevel=0.02, outline=0.02); cyl('top', (0, 0, 1.62), 0.5, 0.1, (0.6, 0.65, 0.7), bevel=0.02)
    shoot('can', 2.6, tilt=82, cz=0.85, body='can')
    reset('tire'); torus('tire', (0, 0, 1.0), 0.85, 0.42, (0.23, 0.23, 0.28), rot=(R(90), 0, 0)); cyl('hub', (0, -0.1, 1.0), 0.5, 0.3, (0.77, 0.77, 0.83), rot=(R(90), 0, 0), bevel=0.04)
    shoot('tire', 3.2, tilt=90, cz=1.0, body='tire')
trash()

def gus(name, pose):
    reset('gus'); NAVY = (0.17, 0.29, 0.56); OR = (1, 0.54, 0.1); SK = (0.95, 0.73, 0.54)
    box('bootL', (-0.32, -0.12, 0.13), (0.5, 0.75, 0.26), (0.35, 0.23, 0.13), bevel=0.08); box('bootR', (0.32, -0.12, 0.13), (0.5, 0.75, 0.26), (0.35, 0.23, 0.13), bevel=0.08)
    cyl('legL', (-0.32, 0, 0.7), 0.19, 0.9, NAVY); cyl('legR', (0.32, 0, 0.7), 0.19, 0.9, NAVY)
    box('torso', (0, 0, 1.75), (1.35, 0.95, 1.3), OR, bevel=0.26); box('stripe', (0, 0, 1.6), (1.4, 0.99, 0.16), (1, .82, .25), bevel=0.04, outline=0.0)
    arms = {'idle': ((-0.85, 0, 2.2, 0, 8), (0.85, 0, 2.2, 0, -8)), 'cheer': ((-0.85, 0, 2.3, 145, 0), (0.85, 0, 2.3, -145, 0)), 'sad': ((-0.8, 0, 2.2, 0, 4), (0.8, 0, 2.2, 0, -4)), 'pull': ((0.85, 0, 2.2, 0, -8),)}[pose]
    for i, (ax, ay, az, rx, rz) in enumerate(arms):
        L = 1.0; a = R(rx if rx else 0); b = R(rz)
        # arm hangs down from shoulder; rotate about shoulder
        bpy.ops.mesh.primitive_cylinder_add(radius=0.17, depth=L, vertices=32, location=(0, 0, -L / 2)); arm = bpy.context.active_object; arm.name = 'arm%d' % i
        bpy.ops.object.transform_apply(location=True)
        arm.rotation_euler = (0, R(rz if pose != 'cheer' else 0) + (R(180 - 145) if False else 0), 0)
        finish(arm, OR, 0.03, True, 0.03)
        sph = sphere('hand%d' % i, (0, 0, -L - 0.05), (.2, .2, .2), SK)
        for o in (arm, sph):
            o.parent = None
        # build a pivot empty
        piv = bpy.data.objects.new('piv%d' % i, None); bpy.context.collection.objects.link(piv)
        piv.location = (ax, ay, az); arm.parent = piv; sph.parent = piv
        piv.rotation_euler = (0, R(-rz) if pose != 'cheer' else R(-(25 if ax < 0 else -25)), 0)
        if pose == 'cheer': piv.rotation_euler = (0, R(155) if ax < 0 else R(-155), 0)
    head_z = 3.1
    sphere('head', (0, 0, head_z), (0.86, 0.8, 0.82), SK)
    sphere('cap', (0, 0.02, head_z + 0.3), (0.9, 0.86, 0.56), (0.17, 0.29, 0.56))
    sphere('brim', (0, -0.62, head_z + 0.14), (0.7, 0.5, 0.09), (0.17, 0.29, 0.56))
    ez = head_z + (0.0 if pose != 'sad' else -0.05); es = 1.0 if pose != 'sad' else 0.45
    flat('eyeL', (-0.3, -0.72, ez), (.1, .06, .1 * es), (0.04, 0.02, 0.1)); flat('eyeR', (0.3, -0.72, ez), (.1, .06, .1 * es), (0.04, 0.02, 0.1))
    sphere('nose', (0, -0.78, head_z - 0.15), (.15, .13, .13), (0.9, 0.62, 0.45), outline=0.02)
    sphere('stache', (0, -0.76, head_z - 0.38), (.5, .17, .13), (0.42, 0.23, 0.11), outline=0.025)
    if pose == 'cheer': flat('mouth', (0, -0.74, head_z - 0.62), (.28, .08, .17), (0.2, 0.03, 0.08)); flat('teeth', (0, -0.8, head_z - 0.52), (.22, .04, .06), (1, 1, 1))
    elif pose == 'sad': flat('mouth', (0, -0.74, head_z - 0.66), (.14, .06, .08), (0.2, 0.03, 0.08))
    else: flat('mouth', (0, -0.74, head_z - 0.64), (.2, .06, .06), (0.5, 0.15, 0.2))
    shoot(name, 5.2, tilt=84, cz=1.75, body='torso')
for n, p in (('gus_idle', 'idle'), ('gus_cheer', 'cheer'), ('gus_sad', 'sad'), ('gus_pull', 'pull')): gus(n, p)

def gerald(name, wing):
    reset('bird'); GR = (0.6, 0.64, 0.72)
    sphere('body', (0, 0, 1.1), (1.0, 0.65, 0.68), GR)
    box('tail', (-1.15, 0, 1.0), (0.8, 0.3, 0.2), (0.45, 0.48, 0.58), bevel=0.06, rot=(0, R(20), 0))
    sphere('head', (0.85, 0, 1.75), (0.5, 0.45, 0.5), GR)
    sphere('neck', (0.6, 0, 1.55), (0.4, 0.4, 0.4), (0.55, 0.8, 0.62), outline=0.02)
    cone('beak', (1.45, 0, 1.7), 0.17, 0.0, 0.6, (1, 0.54, 0.1), rot=(0, R(90), 0))
    sphere('eyeW', (1.05, -0.4, 1.85), (.14, .1, .14), (1, 1, 1), outline=0.015); flat('eyeP', (1.1, -0.5, 1.85), (.07, .05, .07), (0.04, 0.02, 0.1))
    sphere('hat', (0.85, 0, 2.15), (0.55, 0.5, 0.34), (1, 0.82, 0.25)); box('hatb', (0.85, 0, 2.0), (1.1, 0.9, 0.08), (1, 0.82, 0.25), bevel=0.03, outline=0.02)
    piv = bpy.data.objects.new('wp', None); bpy.context.collection.objects.link(piv); piv.location = (-0.15, -0.55, 1.4)
    w = sphere('wing', (-0.5, 0, 0), (0.85, 0.16, 0.38), (0.45, 0.5, 0.6)); w.parent = piv
    piv.rotation_euler = (0, R(-55) if wing == 'up' else R(18), 0)
    for x in (-0.15, 0.2): cyl('leg%d' % int(x * 10), (x, 0, 0.35), 0.06, 0.7, (1, 0.54, 0.1), outline=0.02)
    shoot(name, 4.2, tilt=82, cz=1.35, body='body')
gerald('gerald_up', 'up'); gerald('gerald_down', 'down')

def prop(name, builder, scale=2.4, cz=0.8, cx=0):
    reset({'hydrant':'hydrant','barrel':'barrel','cone':'cone','trashcan':'trashcan','crate':'crate'}.get(name, 'prop')); b = builder(); shoot(name, scale, tilt=82, cz=cz, cx=cx, body=b)
def hydrant():
    cyl('hb', (0, 0, 0.8), 0.5, 1.5, (0.9, 0.27, 0.24)); sphere('hcap', (0, 0, 1.6), (0.52, 0.52, 0.4), (0.9, 0.27, 0.24))
    cyl('hn', (0, 0, 1.0), 0.28, 1.5, (0.9, 0.27, 0.24), rot=(0, R(90), 0)); box('hbase', (0, 0, 0.12), (1.2, 1.2, 0.24), (0.7, 0.2, 0.18), bevel=0.05); return 'hb'
def barrel():
    cyl('bb', (0, 0, 0.8), 0.7, 1.6, (0.79, 0.5, 0.23), bevel=0.1)
    for z in (0.35, 1.25): torus('br%d' % int(z * 10), (0, 0, z), 0.7, 0.07, (0.25, 0.15, 0.1))
    return 'bb'
def conep():
    box('cb', (0, 0, 0.1), (1.5, 1.5, 0.2), (0.27, 0.27, 0.3), bevel=0.05); cone('cc', (0, 0, 0.95), 0.55, 0.1, 1.5, (1, 0.54, 0.1)); cyl('cs', (0, 0, 0.85), 0.36, 0.28, (1, 1, 1), bevel=0.02, outline=0.02); return 'cc'
def trashcan():
    cyl('tc', (0, 0, 0.85), 0.62, 1.7, (0.48, 0.54, 0.6), bevel=0.06); cyl('tl', (0, 0, 1.78), 0.7, 0.18, (0.34, 0.4, 0.45), bevel=0.04); box('th', (0, 0, 1.95), (0.5, 0.14, 0.12), (0.6, 0.65, 0.7), bevel=0.04)
    for x in (-0.25, 0, 0.25): box('tr%d' % int(x * 10), (x, -0.58, 0.85), (0.08, 0.05, 1.2), (0.3, 0.35, 0.4), bevel=0.01, outline=0.0)
    return 'tc'
def crate():
    box('cr', (0, 0, 0.75), (1.5, 1.5, 1.5), (0.85, 0.63, 0.4), bevel=0.08)
    box('x1', (0, -0.78, 0.75), (1.9, 0.08, 0.2), (0.55, 0.35, 0.17), bevel=0.02, outline=0.02, rot=(0, R(45), 0)); box('x2', (0, -0.78, 0.75), (1.9, 0.08, 0.2), (0.55, 0.35, 0.17), bevel=0.02, outline=0.02, rot=(0, R(-45), 0)); return 'cr'
def chip():
    cyl('ch', (0, 0, 1.0), 0.9, 0.35, (0.9, 0.27, 0.24), rot=(R(90), 0, 0), bevel=0.05); cyl('ci', (0, -0.2, 1.0), 0.55, 0.12, (1, 0.95, 0.85), rot=(R(90), 0, 0), bevel=0.02)
    for a in range(8): flat('cd%d' % a, (math.cos(a * math.pi / 4) * 0.78, -0.2, 1.0 + math.sin(a * math.pi / 4) * 0.78), (.1, .05, .1), (1, 0.95, 0.85))
    return 'ch'
def dice():
    box('dc', (0, 0, 0.75), (1.5, 1.5, 1.5), (1, 1, 1), bevel=0.15)
    for (x, z) in ((-0.38, 1.12), (0.38, 0.38), (0, 0.75)): flat('dd%d' % int(x * 10 + z * 100), (x, -0.78, z), (.14, .05, .14), (0.04, 0.02, 0.1))
    return 'dc'
def bone():
    cyl('bn', (0, 0, 0.7), 0.17, 2.0, (1, 0.95, 0.8), rot=(0, R(90), 0))
    for x in (-1.0, 1.0):
        for z in (0.5, 0.9): sphere('bk%d%d' % (int(x), int(z * 10)), (x, 0, z), (.26, .26, .26), (1, 0.95, 0.8))
    return 'bn'
def boot():
    box('bt1', (0, 0, 0.95), (0.9, 0.9, 1.5), (0.54, 0.35, 0.17), bevel=0.15); box('bt2', (0.5, 0, 0.3), (1.6, 0.9, 0.6), (0.54, 0.35, 0.17), bevel=0.2); return 'bt1'
def fish():
    sphere('fb', (0, 0, 0.8), (1.1, 0.45, 0.6), (0.5, 0.78, 1)); cone('ft', (-1.3, 0, 0.8), 0.5, 0.05, 0.9, (0.5, 0.78, 1), rot=(0, R(90), 0)); flat('fe', (0.6, -0.4, 0.95), (.1, .05, .1), (0.04, 0.02, 0.1)); return 'fb'
for n, f in (('hydrant', hydrant), ('barrel', barrel), ('cone', conep), ('trashcan', trashcan), ('crate', crate), ('chip', chip), ('dice', dice), ('bone', bone), ('boot', boot), ('fish', fish)):
    prop(n, f, {'fish': 4.0, 'boot': 3.6, 'bone': 3.4}.get(n, 2.8), 0.85, {'fish': -0.15, 'boot': 0.3}.get(n, 0))


def mayor():
    reset('mayor'); SUIT = (0.17, 0.25, 0.5); SK = (0.95, 0.73, 0.54)
    box('shoeL', (-0.4, -0.15, 0.12), (0.65, 0.9, 0.24), (0.1, 0.08, 0.1), bevel=0.08); box('shoeR', (0.4, -0.15, 0.12), (0.65, 0.9, 0.24), (0.1, 0.08, 0.1), bevel=0.08)
    cyl('legL', (-0.4, 0, 0.75), 0.24, 1.0, SUIT); cyl('legR', (0.4, 0, 0.75), 0.24, 1.0, SUIT)
    box('torso', (0, 0, 2.0), (1.8, 1.1, 1.7), SUIT, bevel=0.3)
    box('shirt', (0, -0.58, 2.25), (0.5, 0.06, 1.0), (1, 1, 1), bevel=0.02, outline=0.0); box('tie', (0, -0.62, 2.1), (0.22, 0.06, 0.95), (0.9, 0.27, 0.24), bevel=0.02, outline=0.0)
    box('sash', (0, -0.6, 2.0), (2.2, 0.05, 0.3), (1, 0.82, 0.25), bevel=0.02, outline=0.0, rot=(0, R(35), 0))
    for sx in (-1, 1):
        cyl('arm%d' % sx, (sx * 1.1, 0, 2.0), 0.2, 1.4, SUIT); sphere('hand%d' % sx, (sx * 1.1, 0, 1.2), (.24, .24, .24), SK)
    sphere('head', (0, 0, 3.55), (1.0, 0.92, 0.98), SK)
    sphere('hair', (0.05, 0.05, 4.35), (0.85, 0.8, 0.16), (0.55, 0.55, 0.58), outline=0.02)
    for i in range(5): cyl('str%d' % i, (-0.7 + i * 0.35, -0.2, 4.28), 0.025, 1.3, (0.4, 0.4, 0.42), rot=(R(90), 0, R(12)), outline=0.0, bevel=0.0)
    for sx in (-1, 1):
        sphere('eyeW%d' % sx, (sx * 0.38, -0.82, 3.7), (.2, .1, .22), (1, 1, 1), outline=0.015); flat('eyeP%d' % sx, (sx * 0.38, -0.92, 3.7), (.09, .05, .1), (0.04, 0.02, 0.1))
        box('brow%d' % sx, (sx * 0.4, -0.88, 4.0), (0.5, 0.1, 0.12), (0.3, 0.3, 0.32), bevel=0.04, outline=0.0, rot=(0, R(sx * 12), 0))
    sphere('nose', (0, -0.95, 3.4), (.2, .16, .18), (0.9, 0.62, 0.45), outline=0.02)
    flat('mouth', (0, -0.9, 3.0), (.55, .08, .2), (0.2, 0.03, 0.08)); flat('teeth', (0, -0.96, 3.08), (.5, .04, .1), (1, 1, 1))
    shoot('mayor', 6.2, tilt=84, cz=2.35, body='torso')
mayor()

def rascal():
    reset('rascal'); G1 = (0.55, 0.55, 0.62); G2 = (0.3, 0.3, 0.36)
    for i in range(5):
        a = i * 0.32; sphere('tail%d' % i, (-1.2 - math.sin(a) * 0.9, 0.5, 0.7 + math.cos(a) * 0.6 + i * 0.28), (0.4, 0.4, 0.4), G2 if i % 2 else (0.75, 0.75, 0.8))
    sphere('body', (0, 0, 1.5), (1.0, 0.8, 1.15), G2)
    box('footL', (-0.4, -0.2, 0.15), (0.55, 0.8, 0.3), G1, bevel=0.1); box('footR', (0.4, -0.2, 0.15), (0.55, 0.8, 0.3), G1, bevel=0.1)
    sphere('belly', (0, -0.55, 1.4), (0.6, 0.3, 0.8), (0.75, 0.75, 0.8), outline=0.02)
    sphere('head', (0, 0, 3.15), (1.1, 0.95, 0.95), G1)
    sphere('earL', (-0.75, 0, 4.0), (0.35, 0.25, 0.4), G1); sphere('earR', (0.75, 0, 4.0), (0.35, 0.25, 0.4), G1)
    sphere('mask', (0, -0.78, 3.25), (1.0, 0.25, 0.4), (0.1, 0.1, 0.14), outline=0.02)
    for sx in (-1, 1):
        sphere('eyeW%d' % sx, (sx * 0.4, -0.95, 3.3), (.2, .1, .2), (1, 1, 1), outline=0.015); flat('eyeP%d' % sx, (sx * 0.4, -1.04, 3.3), (.09, .05, .1), (0.04, 0.02, 0.1))
    sphere('nose', (0, -1.02, 2.85), (.2, .15, .15), (0.08, 0.06, 0.1), outline=0.02)
    cyl('brim', (0, 0, 3.95), 1.4, 0.1, (0.18, 0.18, 0.22), outline=0.03, bevel=0.02); cyl('crown', (0, 0, 4.35), 0.82, 0.8, (0.18, 0.18, 0.22)); cyl('band', (0, 0, 4.12), 0.85, 0.22, (0.9, 0.27, 0.24), outline=0.02, bevel=0.01)
    shoot('rascal', 6.6, tilt=84, cz=2.5, body='body')
rascal()

def landfill():
    reset('mound'); BR = (0.49, 0.36, 0.2)
    sphere('mound', (0, 0, 2.0), (2.5, 1.9, 2.1), BR)
    for (x, z, r, c) in ((-1.8, 1.0, .5, (0.25, 0.75, 0.42)), (1.9, 1.3, .45, (0.78, 0.78, 0.83)), (1.2, 3.2, .4, (0.9, 0.27, 0.24)), (-1.2, 3.0, .45, (0.18, 0.18, 0.2)), (0.1, 4.05, .38, (1, .82, .25))):
        sphere('junk%d' % int(x * 10 + z * 3), (x, -0.9, z), (r, r, r), c)
    for sx in (-1, 1):
        sphere('eyeW%d' % sx, (sx * 0.95, -1.5, 3.0), (.6, .3, .62), (1, 1, 1), outline=0.02); flat('eyeP%d' % sx, (sx * 0.95, -1.78, 3.0), (.22, .1, .24), (0.04, 0.02, 0.1))
        box('brow%d' % sx, (sx * 0.95, -1.7, 3.75), (1.0, 0.16, 0.2), (0.2, 0.12, 0.06), bevel=0.06, outline=0.0, rot=(0, R(sx * 18), 0))
    flat('mouth', (0, -1.75, 1.5), (1.3, 0.25, 0.7), (0.2, 0.04, 0.08)); flat('tongue', (0, -1.88, 1.2), (.55, .1, .22), (0.95, 0.4, 0.55))
    for i in range(6): cone('tu%d' % i, (-1.05 + i * 0.42, -1.92, 1.95), 0.17, 0.0, 0.4, (1, 1, 1), rot=(R(180), 0, 0))
    shoot('landfill', 7.2, tilt=84, cz=2.2, body='mound')
landfill()

json.dump(META, open(os.path.join(OUT, 'meta_raw.json'), 'w'), indent=1)
print('DONE', len(META))
