import bpy, math, sys, os
STYLE = os.environ.get('SLING_STYLE', 'clean')   # 'clean' glossy vinyl-toy look, or 'toon' (hard bands + grime)
from mathutils import Vector, Euler

TAG = ''
def reset(tag=''):
    global INK, TAG
    INK = None; TAG = tag
    bpy.ops.wm.read_factory_settings(use_empty=True)
    sc = bpy.context.scene
    sc.render.engine = 'BLENDER_EEVEE'
    sc.render.film_transparent = True
    sc.render.image_settings.file_format = 'PNG'
    sc.render.image_settings.color_mode = 'RGBA'
    sc.view_settings.view_transform = 'Standard'
    sc.render.use_freestyle = False
    return sc

def lin(c):
    return tuple(x ** 2.2 for x in c[:3])

def guess_tex(objname):
    t, n = TAG, objname.lower()
    if t in ('bin', 'boss'):
        if 'wheel' in n: return 'rubber'
        if 'hole' in n: return None
        return 'metal'
    if t == 'bag': return 'plastic'
    if t == 'can': return 'metal_clean'
    if t in ('tire', 'tireprop'): return 'rubber'
    if t in ('gus', 'mayor'):
        if 'boot' in n or 'shoe' in n: return 'leather'
        if any(k in n for k in ('torso', 'arm', 'leg', 'cap', 'brim', 'shirt')): return 'cloth'
        return None
    if t == 'rascal': return 'fur' if any(k in n for k in ('body', 'head', 'tail', 'ear', 'foot', 'belly')) else None
    if t == 'bird': return 'feather' if any(k in n for k in ('body', 'wing', 'head', 'tail')) else None
    if t in ('barrel', 'crate', 'fence', 'plank'): return 'wood'
    if t == 'cone': return 'rubber'
    if t in ('hydrant', 'trashcan'): return 'metal'
    if t == 'house':
        if 'roof' in n: return 'shingle'
        if 'chim' in n: return 'brick'
        if 'door' in n: return 'wood'
        return 'plaster' if 'walls' in n else None
    if t == 'tree': return 'wood' if 'trunk' in n else 'foliage'
    if t in ('tower', 'casino'): return 'concrete' if n == 'body' else None
    if t == 'hill': return 'grass'
    if t == 'mound': return 'dirt' if n == 'mound' else 'plastic'
    if t == 'car': return 'paint' if n in ('body', 'cabin') else ('rubber' if n.startswith('w') else None)
    if t == 'pad': return 'rubber' if 'base' in n else None
    if t == 'crane': return 'metal'
    if t == 'lighthouse': return 'plaster' if n == 'lh' else None
    if t == 'boat': return 'wood' if 'hull' in n else 'cloth'
    if t in ('watertower',): return 'metal'
    return None

PRESETS = {
    #            noise_scale, grime, grime_tint, bump, bump_scale, kind
    'metal':       (2.6, 0.55, (0.76, 0.74, 0.74), 0.55, 3.2, 'dents'),
    'metal_clean': (3.0, 0.25, (0.7, 0.7, 0.72), 0.3, 6.0, 'scratch'),
    'rubber':      (3.5, 0.35, (0.6, 0.6, 0.62), 0.35, 8.0, 'grain'),
    'plastic':     (2.2, 0.3, (0.7, 0.62, 0.8), 0.7, 4.0, 'wrinkle'),
    'wood':        (2.0, 0.4, (0.76, 0.68, 0.62), 0.5, 5.0, 'wood'),
    'plaster':     (2.0, 0.4, (0.84, 0.82, 0.8), 0.18, 6.0, 'dirtbottom'),
    'concrete':    (2.0, 0.45, (0.82, 0.8, 0.84), 0.22, 6.0, 'dirtbottom'),
    'shingle':     (1.6, 0.25, (0.86, 0.78, 0.74), 0.6, 3.4, 'shingle'),
    'brick':       (1.6, 0.3, (0.86, 0.78, 0.74), 0.5, 4.0, 'brick'),
    'cloth':       (3.0, 0.3, (0.7, 0.7, 0.75), 0.35, 14.0, 'weave'),
    'leather':     (3.0, 0.4, (0.6, 0.55, 0.5), 0.4, 10.0, 'grain'),
    'fur':         (4.0, 0.25, (0.7, 0.7, 0.75), 0.6, 22.0, 'grain'),
    'feather':     (3.0, 0.25, (0.75, 0.75, 0.8), 0.5, 16.0, 'grain'),
    'foliage':     (3.4, 0.45, (0.55, 0.75, 0.55), 0.6, 9.0, 'wrinkle'),
    'grass':       (2.0, 0.4, (0.7, 0.85, 0.65), 0.35, 8.0, 'grain'),
    'dirt':        (2.2, 0.55, (0.7, 0.62, 0.52), 0.8, 5.0, 'wrinkle'),
    'paint':       (2.4, 0.35, (0.65, 0.65, 0.7), 0.4, 6.0, 'dents'),
}

def mixc(nt, fac, a, b, blend='MIX'):
    n = nt.nodes.new('ShaderNodeMix'); n.data_type = 'RGBA'; n.blend_type = blend
    if isinstance(fac, (int, float)): n.inputs[0].default_value = fac
    else: nt.links.new(fac, n.inputs[0])
    for idx, v in ((6, a), (7, b)):
        if isinstance(v, tuple): n.inputs[idx].default_value = (v[0], v[1], v[2], 1)
        else: nt.links.new(v, n.inputs[idx])
    return n

def clean_mat(name, color):
    m = bpy.data.materials.new(name); m.use_nodes = True
    nt = m.node_tree; nt.nodes.clear()
    out = nt.nodes.new('ShaderNodeOutputMaterial'); pr = nt.nodes.new('ShaderNodeBsdfPrincipled')
    pr.inputs['Base Color'].default_value = (*lin(color), 1)
    pr.inputs['Roughness'].default_value = 0.42
    for k, v in (('Coat Weight', 0.35), ('Coat Roughness', 0.18), ('Specular IOR Level', 0.55)):
        if k in pr.inputs: pr.inputs[k].default_value = v
    nt.links.new(pr.outputs[0], out.inputs[0])
    return m

def toon_mat(name, color, bands=3, tex=None):
    if STYLE == 'clean': return clean_mat(name, color)
    color = lin(color)
    m = bpy.data.materials.new(name); m.use_nodes = True
    nt = m.node_tree; nt.nodes.clear()
    out = nt.nodes.new('ShaderNodeOutputMaterial'); em = nt.nodes.new('ShaderNodeEmission')
    ramp = nt.nodes.new('ShaderNodeValToRGB'); s2r = nt.nodes.new('ShaderNodeShaderToRGB'); diff = nt.nodes.new('ShaderNodeBsdfDiffuse')
    ramp.color_ramp.interpolation = 'CONSTANT'
    els = ramp.color_ramp.elements
    els[0].position = 0.0; els[0].color = (.55, .5, .62, 1)
    els[1].position = 0.42; els[1].color = (.9, .88, .92, 1)
    e3 = els.new(0.78); e3.color = (1.12, 1.1, 1.1, 1)
    base = (color[0], color[1], color[2])
    colsock = None
    if tex and tex in PRESETS:
        ns, grime, tint, bump, bs, kind = PRESETS[tex]
        tc = nt.nodes.new('ShaderNodeTexCoord'); mp = nt.nodes.new('ShaderNodeMapping')
        nt.links.new(tc.outputs['Object'], mp.inputs['Vector'])
        if kind in ('wood',): mp.inputs['Scale'].default_value = (1.0, 0.18, 0.18)
        if kind == 'dirtbottom': mp.inputs['Scale'].default_value = (1.0, 1.0, 1.0)
        n1 = nt.nodes.new('ShaderNodeTexNoise'); n1.inputs['Scale'].default_value = ns; n1.inputs['Detail'].default_value = 5; n1.inputs['Roughness'].default_value = 0.6
        nt.links.new(mp.outputs[0], n1.inputs['Vector'])
        cr = nt.nodes.new('ShaderNodeValToRGB'); cr.color_ramp.elements[0].position = 0.40; cr.color_ramp.elements[1].position = 0.72
        nt.links.new(n1.outputs['Fac'], cr.inputs[0])
        gcol = tuple(c * t for c, t in zip(base, tint))
        varied = mixc(nt, cr.outputs[0], base, gcol)           # blotchy grime
        var_sock = varied.outputs[2]
        # extra colour detail per kind
        h = None
        if kind in ('dents', 'scratch'):
            v = nt.nodes.new('ShaderNodeTexVoronoi'); v.inputs['Scale'].default_value = bs; nt.links.new(mp.outputs[0], v.inputs['Vector'])
            h = v.outputs['Distance']
            if kind == 'dents':
                n2 = nt.nodes.new('ShaderNodeTexNoise'); n2.inputs['Scale'].default_value = 1.6; n2.inputs['Detail'].default_value = 3
                nt.links.new(mp.outputs[0], n2.inputs['Vector'])
                r2 = nt.nodes.new('ShaderNodeValToRGB'); r2.color_ramp.elements[0].position = 0.64; r2.color_ramp.elements[1].position = 0.7
                nt.links.new(n2.outputs['Fac'], r2.inputs[0])
                rust = (0.42, 0.2, 0.08)
                var_sock = mixc(nt, r2.outputs[0], var_sock, tuple(r * 1.0 for r in rust)).outputs[2]  # rust patches
        elif kind == 'wood':
            w = nt.nodes.new('ShaderNodeTexWave'); w.inputs['Scale'].default_value = bs; w.inputs['Distortion'].default_value = 3.0; w.inputs['Detail'].default_value = 2
            nt.links.new(mp.outputs[0], w.inputs['Vector']); h = w.outputs['Fac']
            gr = nt.nodes.new('ShaderNodeValToRGB'); gr.color_ramp.elements[0].position = 0.4; gr.color_ramp.elements[1].position = 0.6
            nt.links.new(w.outputs['Fac'], gr.inputs[0])
            var_sock = mixc(nt, gr.outputs[0], var_sock, tuple(c * 0.62 for c in base)).outputs[2]
        elif kind in ('shingle', 'brick'):
            br = nt.nodes.new('ShaderNodeTexBrick'); br.inputs['Scale'].default_value = bs
            br.inputs['Mortar Size'].default_value = 0.03; br.inputs['Bias'].default_value = 0.0
            nt.links.new(mp.outputs[0], br.inputs['Vector']); h = br.outputs['Fac']
            mortar = nt.nodes.new('ShaderNodeValToRGB'); mortar.color_ramp.elements[0].position = 0.0; mortar.color_ramp.elements[1].position = 0.5
            nt.links.new(br.outputs['Fac'], mortar.inputs[0])
            var_sock = mixc(nt, mortar.outputs[0], tuple(c * 0.45 for c in base), var_sock).outputs[2]
        elif kind == 'dirtbottom':
            sep = nt.nodes.new('ShaderNodeSeparateXYZ'); nt.links.new(tc.outputs['Object'], sep.inputs[0])
            mz = nt.nodes.new('ShaderNodeMapRange'); mz.inputs['From Min'].default_value = -1.0; mz.inputs['From Max'].default_value = 0.2
            nt.links.new(sep.outputs['Z'], mz.inputs['Value'])
            mz.inputs['To Min'].default_value = 1.0; mz.inputs['To Max'].default_value = 0.0
            var_sock = mixc(nt, mz.outputs[0], var_sock, tuple(c * 0.62 for c in base)).outputs[2]
            v = nt.nodes.new('ShaderNodeTexNoise'); v.inputs['Scale'].default_value = bs; h = v.outputs['Fac']
            nt.links.new(mp.outputs[0], v.inputs['Vector'])
        else:  # grain / wrinkle / weave
            v = nt.nodes.new('ShaderNodeTexNoise'); v.inputs['Scale'].default_value = bs; v.inputs['Detail'].default_value = 6
            if kind == 'wrinkle': v.inputs['Distortion'].default_value = 1.6
            nt.links.new(mp.outputs[0], v.inputs['Vector']); h = v.outputs['Fac']
        colsock = var_sock
        if h is not None:
            bp = nt.nodes.new('ShaderNodeBump'); bp.inputs['Strength'].default_value = bump; bp.inputs['Distance'].default_value = 0.08
            nt.links.new(h, bp.inputs['Height']); nt.links.new(bp.outputs['Normal'], diff.inputs['Normal'])
    nt.links.new(diff.outputs[0], s2r.inputs[0])
    nt.links.new(s2r.outputs[0], ramp.inputs[0])
    if colsock is None:
        # untextured: bake base colour into band colours (as before)
        r, g, b = base
        els[0].color = (r * .55, g * .5, b * .62, 1); els[1].color = (r * .9, g * .88, b * .92, 1); e3.color = (min(1, r * 1.15 + .05), min(1, g * 1.15 + .05), min(1, b * 1.15 + .05), 1)
        nt.links.new(ramp.outputs[0], em.inputs[0])
    else:
        lit = mixc(nt, 1.0, (1, 1, 1), (1, 1, 1), 'MULTIPLY'); nt.links.new(ramp.outputs[0], lit.inputs[6]); nt.links.new(colsock, lit.inputs[7])
        nt.links.new(lit.outputs[2], em.inputs[0])
    nt.links.new(em.outputs[0], out.inputs[0])
    return m

def ink_mat():
    m = bpy.data.materials.new('ink'); m.use_nodes = True
    nt = m.node_tree; nt.nodes.clear()
    out = nt.nodes.new('ShaderNodeOutputMaterial'); em = nt.nodes.new('ShaderNodeEmission')
    em.inputs[0].default_value = (0.012, 0.004, 0.04, 1) if STYLE != 'clean' else (0.03, 0.012, 0.09, 1)
    nt.links.new(em.outputs[0], out.inputs[0])
    m.use_backface_culling = True
    return m

INK = None
def finish(obj, color, outline=0.035, smooth=True, bevel=0.0):
    global INK
    if INK is None or INK.name not in bpy.data.materials: INK = ink_mat()
    obj.data.materials.clear()
    obj.data.materials.append(toon_mat(obj.name + '_m', color, tex=guess_tex(obj.name)))
    obj.data.materials.append(INK)
    if bevel:
        bv = obj.modifiers.new('bv', 'BEVEL'); bv.width = bevel; bv.segments = 5; bv.limit_method = 'ANGLE'
    if smooth:
        for p in obj.data.polygons: p.use_smooth = True
    if outline:
        so = obj.modifiers.new('ol', 'SOLIDIFY'); so.thickness = outline * (1.0 if STYLE == 'clean' else 1.6); so.offset = 1
        so.use_flip_normals = True; so.material_offset = 1
    return obj

def box(name, loc, size, color, bevel=0.08, outline=0.035, rot=(0,0,0)):
    bpy.ops.mesh.primitive_cube_add(location=loc, rotation=rot)
    o = bpy.context.active_object; o.name = name; o.scale = (size[0]/2, size[1]/2, size[2]/2)
    bpy.ops.object.transform_apply(scale=True)
    return finish(o, color, outline, True, bevel)

def sphere(name, loc, scale, color, outline=0.035, rot=(0,0,0)):
    bpy.ops.mesh.primitive_uv_sphere_add(location=loc, rotation=rot, segments=40, ring_count=24)
    o = bpy.context.active_object; o.name = name; o.scale = scale
    bpy.ops.object.transform_apply(scale=True)
    return finish(o, color, outline)

def cyl(name, loc, r, h, color, rot=(0,0,0), outline=0.03, bevel=0.03):
    bpy.ops.mesh.primitive_cylinder_add(location=loc, rotation=rot, radius=r, depth=h, vertices=40)
    o = bpy.context.active_object; o.name = name
    return finish(o, color, outline, True, bevel)

def setup_camera(width_units, aspect, tilt=78, cx=0, cz=0):
    cam = bpy.data.cameras.new('cam'); cam.type = 'ORTHO'; cam.ortho_scale = width_units
    co = bpy.data.objects.new('cam', cam); bpy.context.collection.objects.link(co)
    t = math.radians(tilt)
    co.location = (cx, -20 * math.sin(t), cz + 20 * math.cos(t) * 0.0 + 20 * math.cos(math.radians(90 - tilt)) * 0)
    # place camera on a sphere around the target looking at it
    d = 30
    co.location = (cx, -d * math.sin(t), cz + d * math.cos(t))
    direction = Vector((cx, 0, cz)) - co.location
    co.rotation_euler = direction.to_track_quat('-Z', 'Y').to_euler()
    bpy.context.scene.camera = co
    sc = bpy.context.scene
    sc.render.resolution_x = int(512 * aspect) if aspect >= 1 else 512
    sc.render.resolution_y = 512 if aspect >= 1 else int(512 / aspect)

def setup_light():
    def sun(name, energy, rot, col=(1, 1, 1)):
        ld = bpy.data.lights.new(name, 'SUN'); ld.energy = energy; ld.color = col
        lo = bpy.data.objects.new(name, ld); bpy.context.collection.objects.link(lo); lo.rotation_euler = rot
    if STYLE == 'clean':
        sun('key', 3.4, (math.radians(52), math.radians(6), math.radians(-32)), (1, 0.97, 0.9))
        sun('fill', 1.1, (math.radians(70), 0, math.radians(60)), (0.85, 0.9, 1))
        sun('rim', 2.2, (math.radians(-55), 0, math.radians(150)), (1, 0.95, 0.85))
        amb = 0.7
    else:
        sun('sun', 3.0, (math.radians(50), math.radians(8), math.radians(-35))); amb = 0.35
    w = bpy.data.worlds.new('w'); w.use_nodes = True
    w.node_tree.nodes['Background'].inputs[0].default_value = (1, 1, 1, 1)
    w.node_tree.nodes['Background'].inputs[1].default_value = amb
    bpy.context.scene.world = w

def render(path):
    bpy.context.scene.render.filepath = path
    bpy.ops.render.render(write_still=True)
