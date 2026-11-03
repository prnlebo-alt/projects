# Concept render: blocky "plastic building-toy" characters + Angry-Birds-style side view (generic shapes, original design)
import bpy, math, sys, os
sys.path.insert(0, os.path.dirname(__file__))
os.environ.setdefault('SLING_STYLE', 'clean')
from bl_common import *
OUT = sys.argv[sys.argv.index('--') + 1]
sc = reset('concept'); setup_light()
sc.render.film_transparent = False
w = bpy.context.scene.world; w.node_tree.nodes['Background'].inputs[0].default_value = (0.45, 0.72, 0.95, 1); w.node_tree.nodes['Background'].inputs[1].default_value = 0.9
def C(h): h = h.lstrip('#'); return tuple(int(h[i:i+2], 16) / 255 for i in (0, 2, 4))
ORANGE, VEST, SKIN, JEANS, BLACK = C('#ff8a1f'), C('#ffd23f'), C('#f2b88a'), C('#3d5fa0'), C('#2a2538')
def person(x, z=0, flip=1):
    box('legL', (x - .22, 0, z + .5), (.38, .4, 1.0), JEANS); box('legR', (x + .22, 0, z + .5), (.38, .4, 1.0), JEANS)
    box('torso', (x, 0, z + 1.55), (1.0, .5, 1.1), C('#ff7a1a')); box('vest', (x, -.02, z + 1.55), (1.04, .52, .5), VEST)
    box('armL', (x - .72, 0, z + 1.6), (.4, .4, 1.0), SKIN); box('armR', (x + .72 * flip, -.1, z + 1.9), (.4, .4, .95), SKIN, rot=(0, math.radians(-35 * flip), 0))
    cyl('head', (x, 0, z + 2.5), .5, .8, SKIN, rot=(math.radians(90), 0, 0))
    box('hat', (x, 0, z + 2.95), (1.15, 1.0, .4), ORANGE, bevel=.12); box('brim', (x + .55 * flip, -.4, z + 2.8), (.8, .3, .1), ORANGE)
    for ex in (-.18, .18): sphere('eye', (x + ex + .1 * flip, -.52, z + 2.55), (.07, .05, .1), BLACK, outline=0)
def raccoon(x, z, s=1.0):
    cyl('rbody', (x, 0, z), .55 * s, .9 * s, C('#8a8f9c'), rot=(math.radians(90), 0, 0))
    box('mask', (x, -.38 * s, z + .05 * s), (.95 * s, .2, .35 * s), BLACK, bevel=.08)
    for ex in (-.4, .4): box('ear', (x + ex * s, 0, z + .62 * s), (.3 * s, .25, .35 * s), C('#8a8f9c'))
    for ex in (-.2, .2): sphere('reye', (x + ex * s, -.5 * s, z + .1 * s), (.1, .06, .12), C('#fff6c8'), outline=0)
def dumpster(x, z, col, w=2.6, h=1.5):
    box('dump', (x, 0, z + h / 2), (w, 1.4, h), col, bevel=.1); box('lid', (x, .1, z + h + .12), (w + .15, 1.5, .22), C('#2f3a4f'), bevel=.06)
def crate(x, z, s=1.2): box('crate', (x, 0, z + s / 2), (s, s, s), C('#c58b4a'), bevel=.08); box('band', (x, -.01, z + s / 2), (s * .1, s * 1.02, s * 1.02), C('#8a5a2b'), bevel=.02)
box('ground', (5, -.3, -4.1), (44, 5, 8.2), C('#b98a5c'), bevel=.05); box('grass', (5, 0, .02), (40, 4, .12), C('#6fc46a'), bevel=.02)
for hx, hs in ((-7, 2.2), (6, 3.6), (15, 2.6)): sphere('hill', (hx, 3, 0), (4.5 * hs / 3, 2.5, hs), C('#a7c48a'), outline=.02)
person(-6.2); box('slingA', (-4.6, 0, .9), (.2, .2, 1.8), C('#b27a3c')); box('slingL', (-4.75, 0, 1.9), (.18, .18, .8), C('#b27a3c'), rot=(0, math.radians(25), 0)); box('slingR', (-4.45, 0, 1.9), (.18, .18, .8), C('#b27a3c'), rot=(0, math.radians(-25), 0))
sphere('bag', (-5.1, -.3, 1.95), (.38, .34, .42), BLACK); sphere('bagknot', (-5.1, -.3, 2.4), (.12, .1, .14), BLACK)
dumpster(5.5, 0, C('#2e9e5b')); dumpster(9.3, 0, C('#2f6fd0'), 2.4, 1.4); crate(7.3, 1.5, 1.4); dumpster(7.4, 2.9, C('#2e9e5b'), 2.4, 1.3); crate(10.2, 1.4, 1.1); crate(5.1, 1.5, 1.1)
raccoon(5.2, 2.5); raccoon(9.2, 2.2, .9); raccoon(7.4, 4.55, 1.0); raccoon(10.3, 2.9, .7)
for bx in (-2.5, 1.2, 12.5, 14.0): sphere('pilebag', (bx, -1.0, .35), (.55, .45, .4), C('#3b3550'))
box('cone', (-1.0, -1.1, .4), (.5, .5, .8), C('#ff6a2a'), bevel=.15)
setup_camera(26, 16 / 9, tilt=88, cx=4.5, cz=3.4)
sc.render.resolution_x = 1280; sc.render.resolution_y = 720
render(OUT)
