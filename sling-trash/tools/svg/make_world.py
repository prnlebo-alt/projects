"""World and portrait SVGs for Sling Trash (2D illustrated style, after reference/target-keyart.webp).
Names match the Blender sprites so the game swaps them automatically.  Run: python3 tools/svg/make_world.py"""
import json, os, random
OUT = '#2a1740'
HERE = os.path.dirname(__file__)
ART = os.path.join(HERE, '..', '..', 'art')
os.makedirs(ART, exist_ok=True)
S = f'stroke="{OUT}" stroke-width="5.5" stroke-linejoin="round" stroke-linecap="round"'
S3 = f'stroke="{OUT}" stroke-width="4" stroke-linejoin="round" stroke-linecap="round"'
S6 = f'stroke="{OUT}" stroke-width="6" stroke-linejoin="round" stroke-linecap="round"'
def sw(n): return f'stroke="{OUT}" stroke-width="{n}" stroke-linejoin="round" stroke-linecap="round"'
META = {}
def lg(i, a, b): return f'<linearGradient id="{i}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="{a}"/><stop offset="1" stop-color="{b}"/></linearGradient>'
def rg(i, a, b): return f'<radialGradient id="{i}" cx=".38" cy=".34" r=".75"><stop offset="0" stop-color="{a}"/><stop offset="1" stop-color="{b}"/></radialGradient>'
PUFF = '''<filter id="puff" x="-4%" y="-4%" width="108%" height="108%" color-interpolation-filters="sRGB"><feGaussianBlur in="SourceAlpha" stdDeviation="5" result="blur"/><feSpecularLighting in="blur" surfaceScale="5" specularConstant=".85" specularExponent="26" lighting-color="#ffffff" result="spec"><feDistantLight azimuth="225" elevation="50"/></feSpecularLighting><feComposite in="spec" in2="SourceAlpha" operator="in" result="specIn"/><feDiffuseLighting in="blur" surfaceScale="4" diffuseConstant="1.05" lighting-color="#ffffff" result="diff"><feDistantLight azimuth="225" elevation="48"/></feDiffuseLighting><feComposite in="SourceGraphic" in2="diff" operator="arithmetic" k1="1.2" k2="0" k3="0" k4="0" result="shaded"/><feComposite in="shaded" in2="specIn" operator="arithmetic" k1="0" k2="1" k3=".42" k4="0"/></filter>'''
BASE_DEFS = PUFF + ''.join([
    lg('cardb', '#dcab6e', '#b17c42'), lg('skin', '#f8cca6', '#e19b72'), lg('navy', '#50648e', '#2f4068'), lg('suit', '#3a5ba0', '#243a6e'), lg('red', '#f0594f', '#b72f2b'),
    lg('brick', '#c4695a', '#8f4338'), lg('wood', '#dba76c', '#b07a40'), lg('woodd', '#9a6a3a', '#6b4526'), lg('grey', '#b7bfd0', '#7f889f'), lg('greyd', '#7a8399', '#4d566e'),
    lg('metal', '#a8b2c4', '#6b7690'), lg('mastr', '#5c4a3c', '#33271e'), lg('fur', '#c3c9d6', '#8a92a8'), lg('mask', '#3a3a48', '#15151e'),
    lg('white', '#ffffff', '#d3dbe8'), lg('glass', '#cfeeff', '#8ac4ec'), lg('glassw', '#fff1b0', '#ffc95a'), lg('teal', '#3fc7c9', '#1f8f97'), lg('yellow', '#ffe27a', '#f5b92b'),
    lg('green1', '#7fdc7a', '#3d9f4f'), lg('green2', '#5ccb6a', '#2d8a44'), lg('hillg', '#92dc8c', '#5cb860'), lg('hillg2', '#83d283', '#4ea757'),
    lg('mound', '#8c6a42', '#5a4026'), lg('mound2', '#7c5c38', '#4d361f'), lg('tower1', '#9d78c6', '#684a96'), lg('tower2', '#6d44b0', '#43287e'), lg('tower3', '#c25f93', '#8a3d68'),
    lg('towerf', '#b698d8', '#8c6cb4'), lg('casino', '#43228a', '#26104f'), lg('bag', '#454556', '#14141d'), lg('car1', '#f0594f', '#b72f2b'), lg('car2', '#4aa0e8', '#2570b8'), lg('car3', '#f7c548', '#d8962a'),
    lg('hydrant', '#f0594f', '#b72f2b'), lg('cone', '#ff9a33', '#e8650f'), lg('can', '#a3acba', '#6a7484'), lg('purple', '#9a73e0', '#6a45b4'),
    rg('sun', '#fff5a8', '#ffc83a'), rg('cloud', '#ffffff', '#dfe9f5'),
    '<filter id="glow" x="-30%" y="-30%" width="160%" height="160%"><feGaussianBlur stdDeviation="5" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>',
])
def glossBlob(cx, cy, rx, ry, rot=0):
    t = f' transform="rotate({rot} {cx} {cy})"' if rot else ''
    return f'<ellipse cx="{cx}" cy="{cy}" rx="{rx}" ry="{ry}" fill="#ffffff" opacity=".5"{t}/>'
def save(name, w, h, body, bodyrect=None, hu=2.3, anchor=None):
    open(os.path.join(ART, name + '.svg'), 'w').write(f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {w} {h}" width="{w}" height="{h}"><defs>{BASE_DEFS}</defs><g filter="url(#puff)">{body}</g></svg>')
    META[name] = {'svg': True, 'w': w, 'h': h, 'body': bodyrect or [0, 0, w, h], 'bbox': [0, 0, w, h], 'hu': hu}

def windowgrid(x0, y0, cols, rows, dx, dy, w, h, seed, lit='#ffe27a', dark='#3a2a6e', r=3):
    rnd = random.Random(seed); out = ''
    for rr in range(rows):
        for c in range(cols):
            on = rnd.random() > 0.42
            out += f'<rect x="{x0 + c * dx}" y="{y0 + rr * dy}" width="{w}" height="{h}" rx="{r}" fill="{lit if on else dark}" stroke="{OUT}" stroke-width="2"/>'
            if on: out += f'<rect x="{x0 + c * dx + 3}" y="{y0 + rr * dy + 3}" width="{w * .4}" height="{h * .28}" rx="2" fill="#fff" opacity=".5"/>'
    return out

# ---------------------------------------------------------------- sky
save('sun', 240, 240, f'<circle cx="120" cy="120" r="104" fill="url(#sun)" {S}/><path d="M52 96 Q70 56 110 46" stroke="#fff" stroke-opacity=".65" stroke-width="12" fill="none" stroke-linecap="round"/>')
save('cloud', 400, 220, f'<path d="M70 190 Q16 190 22 144 Q28 106 74 112 Q80 52 146 56 Q184 14 238 48 Q300 34 318 92 Q380 90 378 144 Q376 190 320 190z" fill="url(#cloud)" {S}/><path d="M70 160 Q120 176 200 168 Q290 176 340 160" stroke="#a9c3df" stroke-opacity=".55" stroke-width="10" fill="none" stroke-linecap="round"/>')
save('hill', 660, 240, f'<ellipse cx="330" cy="120" rx="322" ry="114" fill="url(#hillg)" {S}/><path d="M110 70 Q200 30 300 38" stroke="#fff" stroke-opacity=".28" stroke-width="14" fill="none" stroke-linecap="round"/>', bodyrect=[8, 6, 652, 234])
save('hill2', 600, 180, f'<ellipse cx="300" cy="90" rx="292" ry="84" fill="url(#hillg2)" {S}/><path d="M100 52 Q180 22 270 28" stroke="#fff" stroke-opacity=".25" stroke-width="12" fill="none" stroke-linecap="round"/>', bodyrect=[8, 6, 592, 174])

# ---------------------------------------------------------------- houses
HC = [('#ff7aa8', '#d8487e'), ('#ffd34a', '#e0a41a'), ('#38c4d2', '#1f8f9e'), ('#ff9a3a', '#e0661a'), ('#b79af0', '#8a68d0')]
for i, (c1, c2) in enumerate(HC):
    g = f'<linearGradient id="wall" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="{c1}"/><stop offset="1" stop-color="{c2}"/></linearGradient>'
    win = lambda x: f'<rect x="{x}" y="208" width="62" height="62" rx="8" fill="#fff" {S}/><rect x="{x + 7}" y="215" width="48" height="48" rx="4" fill="url(#{"glassw" if i % 2 else "glass"})" {S3}/><path d="M{x + 31} 215 V263 M{x + 7} 239 H{x + 55}" {S3}/><path d="M{x + 13} 222 L{x + 27} 222" stroke="#fff" stroke-width="6" stroke-linecap="round" opacity=".7"/><rect x="{x - 4}" y="268" width="70" height="10" rx="4" fill="#e8ecf2" {S3}/>'
    body = f'''{g}
<rect x="236" y="62" width="42" height="96" rx="4" fill="url(#brick)" {S}/><rect x="230" y="56" width="54" height="16" rx="4" fill="#b1544a" {S}/>
<rect x="40" y="170" width="260" height="190" rx="10" fill="url(#wall)" {S}/><rect x="44" y="174" width="252" height="26" rx="6" fill="#000" opacity=".2"/>
<path d="M44 300 H296" stroke="#000" stroke-opacity=".12" stroke-width="2"/><rect x="44" y="318" width="252" height="38" rx="6" fill="#000" opacity=".1"/>
<path d="M54 184 V340" stroke="#fff" stroke-opacity=".3" stroke-width="10" stroke-linecap="round"/>
{win(62)}{win(214)}
<rect x="138" y="262" width="66" height="98" rx="10" fill="url(#woodd)" {S}/><path d="M150 276 H192 M150 300 H192" stroke="#000" stroke-opacity=".25" stroke-width="3"/><circle cx="192" cy="316" r="5" fill="#ffd34a" {S3}/>
<path d="M14 190 L170 40 L326 190z" fill="url(#red)" {S}/><path d="M42 178 L170 58 L298 178" stroke="#000" stroke-opacity=".18" stroke-width="3" fill="none"/>
<path d="M68 150 Q170 120 272 150 M96 120 Q170 98 244 120" stroke="#000" stroke-opacity=".2" stroke-width="3" fill="none"/>
<path d="M60 168 L150 76" stroke="#fff" stroke-opacity=".35" stroke-width="10" stroke-linecap="round"/>'''
    save(f'house{i}', 340, 364, body, bodyrect=[40, 170, 300, 360])
save('tree', 230, 290, f'<rect x="96" y="170" width="38" height="110" rx="10" fill="url(#woodd)" {S}/><ellipse cx="62" cy="136" rx="52" ry="48" fill="url(#green2)" {S}/><ellipse cx="170" cy="140" rx="52" ry="46" fill="url(#green2)" {S}/><ellipse cx="115" cy="92" rx="88" ry="78" fill="url(#green1)" {S}/><path d="M60 80 Q80 40 120 34" stroke="#fff" stroke-opacity=".4" stroke-width="12" fill="none" stroke-linecap="round"/><circle cx="150" cy="120" r="10" fill="#2d8a44" opacity=".35"/><circle cx="84" cy="130" r="8" fill="#2d8a44" opacity=".3"/>')
save('watertower', 170, 330, f'<path d="M40 150 L28 318 M130 150 L142 318 M85 150 V318" stroke="{OUT}" stroke-width="12" stroke-linecap="round"/><path d="M40 150 L28 318 M130 150 L142 318 M85 150 V318" stroke="#9fb0cc" stroke-width="6" stroke-linecap="round"/><path d="M34 230 L136 250 M30 280 L138 270" stroke="#9fb0cc" stroke-width="5"/><rect x="22" y="56" width="126" height="100" rx="14" fill="url(#metal)" {S}/><path d="M22 90 H148 M22 124 H148" stroke="{OUT}" stroke-opacity=".5" stroke-width="3"/><path d="M14 62 L85 4 L156 62z" fill="url(#greyd)" {S}/><path d="M40 70 V148" stroke="#fff" stroke-opacity=".35" stroke-width="8" stroke-linecap="round"/>')

# ---------------------------------------------------------------- towers & casino
def tower(name, grad, seed, w=200, h=560):
    body = f'<line x1="100" y1="0" x2="100" y2="34" {S6}/><circle cx="100" cy="6" r="7" fill="#ff5a5f" {S3}/><rect x="8" y="30" width="184" height="28" rx="6" fill="#000" opacity=".22" {S}/><rect x="14" y="26" width="172" height="26" rx="6" fill="url(#{grad})" {S}/><rect x="20" y="50" width="160" height="510" fill="url(#{grad})" {S}/>' + windowgrid(36, 78, 4, 12, 36, 40, 26, 30, seed) + f'<rect x="20" y="50" width="22" height="510" fill="#fff" opacity=".16"/><rect x="150" y="50" width="30" height="510" fill="#000" opacity=".14"/>'
    save(name, w, h, body, bodyrect=[20, 50, 180, 560])
tower('tower_far', 'towerf', 3); tower('tower_near0', 'tower2', 5); tower('tower_near1', 'tower3', 9)
for i, neon in enumerate(('#ff5aa5', '#32e0e8')):
    body = f'<rect x="20" y="30" width="240" height="510" rx="8" fill="url(#casino)" {S}/><rect x="30" y="40" width="220" height="490" rx="6" fill="none" stroke="{neon}" stroke-width="7" filter="url(#glow)"/>' + windowgrid(48, 66, 5, 10, 40, 46, 28, 32, 20 + i) + f'<rect x="20" y="30" width="26" height="510" fill="#fff" opacity=".1"/>'
    save(f'casino{i}', 280, 548, body, bodyrect=[20, 30, 260, 540])

# ---------------------------------------------------------------- wharf
stripes = ''.join(f'<rect x="60" y="{210 + k * 90}" width="62" height="90" fill="{"#fff" if k % 2 else "#e8453c"}" {S}/>' for k in range(7))
save('crane', 520, 840, f'''{stripes}<rect x="52" y="824" width="78" height="14" rx="5" fill="#555" {S}/>
<rect x="0" y="150" width="86" height="72" rx="8" fill="url(#greyd)" {S}/><rect x="44" y="132" width="110" height="82" rx="10" fill="url(#metal)" {S}/><rect x="60" y="146" width="48" height="36" rx="6" fill="url(#glass)" {S3}/>
<rect x="100" y="150" width="400" height="36" rx="8" fill="url(#red)" {S}/><path d="M140 150 L170 186 M230 150 L260 186 M320 150 L350 186 M410 150 L440 186" stroke="#fff" stroke-opacity=".5" stroke-width="5"/>
<line x1="450" y1="186" x2="450" y2="340" stroke="{OUT}" stroke-width="7"/><line x1="450" y1="186" x2="450" y2="340" stroke="#f1e7cf" stroke-width="3"/>
<path d="M424 350 A26 26 0 1 0 476 350" fill="none" stroke="{OUT}" stroke-width="13" stroke-linecap="round"/><path d="M424 350 A26 26 0 1 0 476 350" fill="none" stroke="#ffd23f" stroke-width="7" stroke-linecap="round"/>''', bodyrect=[60, 210, 122, 840], hu=7.2)
save('sailboat', 310, 300, f'<path d="M148 20 L148 224" {S6}/><path d="M154 30 Q250 120 270 210 H154z" fill="url(#white)" {S}/><path d="M142 60 Q80 130 52 210 H142z" fill="url(#white)" {S}/><path d="M160 60 Q220 120 238 190" stroke="#9db8d8" stroke-width="8" fill="none" stroke-linecap="round" opacity=".6"/><path d="M148 20 L184 30 L148 42z" fill="#e8453c" {S3}/><path d="M24 218 H292 Q280 270 236 280 H78 Q36 270 24 218z" fill="url(#red)" {S}/><path d="M40 232 H276" stroke="#fff" stroke-opacity=".5" stroke-width="7" stroke-linecap="round"/>')
save('lighthouse', 150, 380, f'<path d="M30 360 L52 90 H98 L120 360z" fill="url(#white)" {S}/><path d="M42 230 L108 230 L112 276 L38 276z" fill="url(#red)" {S3}/><path d="M36 120 H114 L118 158 H32z" fill="url(#red)" {S3}/><rect x="44" y="66" width="62" height="28" rx="6" fill="#444" {S}/><rect x="52" y="30" width="46" height="40" rx="6" fill="url(#glassw)" {S}/><path d="M42 34 L75 4 L108 34z" fill="url(#red)" {S}/><path d="M56 110 L66 340" stroke="#fff" stroke-opacity=".5" stroke-width="9" stroke-linecap="round"/>')

save('truck', 560, 280, f'''<rect x="30" y="40" width="370" height="170" rx="16" fill="url(#white)" {S}/><path d="M30 120 H400" stroke="{OUT}" stroke-opacity=".25" stroke-width="3"/><rect x="48" y="58" width="334" height="30" rx="8" fill="#a8b4c8" opacity=".5"/><path d="M400 80 H470 Q500 84 520 130 L536 196 V210 H400z" fill="url(#white)" {S}/><path d="M418 96 H466 Q486 100 500 130 H418z" fill="url(#glass)" {S}/><rect x="520" y="164" width="30" height="26" rx="8" fill="url(#yellow)" {S3}/><rect x="36" y="196" width="520" height="20" rx="8" fill="#555e70" {S}/><path d="M60 60 L60 190" stroke="#fff" stroke-opacity=".5" stroke-width="12" stroke-linecap="round"/><rect x="90" y="120" width="200" height="30" rx="6" fill="#3fbf6a" {S3}/><text x="190" y="143" text-anchor="middle" font-family="Arial Black,Impact,sans-serif" font-size="22" font-weight="900" fill="#fff">GLOOMSBURY SANITATION</text><circle cx="130" cy="226" r="42" fill="#2b2b36" {S}/><circle cx="130" cy="226" r="18" fill="url(#white)" {S3}/><circle cx="440" cy="226" r="42" fill="#2b2b36" {S}/><circle cx="440" cy="226" r="18" fill="url(#white)" {S3}/>''', hu=2.6)

save('cardbox', 170, 140, f'<path d="M20 50 L4 18 L52 30 L56 50z" fill="url(#cardb)" {S}/><path d="M150 50 L166 18 L118 30 L114 50z" fill="url(#cardb)" {S}/><rect x="16" y="44" width="138" height="88" rx="12" fill="url(#cardb)" {S}/><rect x="28" y="52" width="114" height="22" rx="4" fill="#3a2a1c" opacity=".55"/><rect x="72" y="44" width="26" height="88" fill="#e8d4a8" {S3}/><path d="M32 96 H64 M106 96 H138" stroke="{OUT}" stroke-opacity=".35" stroke-width="4"/><path d="M26 84 V124" stroke="#fff" stroke-opacity=".3" stroke-width="8" stroke-linecap="round"/>{glossBlob(44, 70, 18, 11, -16)}', bodyrect=[16, 44, 154, 132], hu=1.4)
save('sheet', 90, 230, f'<path d="M14 224 L34 6 H82 L68 224z" fill="url(#metal)" {S}/>' + ''.join(f'<path d="M{24 + k * 11 - k * 1.2} {216 - k * 2} L{40 + k * 9.5} 14" stroke="{OUT}" stroke-opacity=".35" stroke-width="4"/>' for k in range(5)) + f'<path d="M30 20 L22 200" stroke="#fff" stroke-opacity=".35" stroke-width="7" stroke-linecap="round"/>', bodyrect=[14, 6, 82, 224], hu=2.0)

# ---------------------------------------------------------------- junk mounds
def mound(name, grad, seed):
    rnd = random.Random(seed)
    items = ''
    spots = [(110, 70, 'tire'), (230, 40, 'bag'), (330, 88, 'bottle'), (170, 112, 'box'), (396, 148, 'can'), (60, 150, 'bag')] if seed == 1 else [(90, 100, 'bag'), (200, 46, 'box'), (300, 60, 'tire'), (380, 110, 'bottle'), (150, 130, 'can'), (420, 160, 'box')]
    for (x, y, k) in spots:
        if k == 'tire': items += f'<circle cx="{x}" cy="{y}" r="25" fill="#2c2c38" {S}/><circle cx="{x}" cy="{y}" r="11" fill="#aab3c2" {S3}/>'
        elif k == 'bag': items += f'<path d="M{x - 6} {y - 19} L{x} {y - 34} L{x + 6} {y - 19}z" fill="#3a3a48" {S3}/><ellipse cx="{x}" cy="{y}" rx="24" ry="21" fill="url(#bag)" {S}/><ellipse cx="{x - 9}" cy="{y - 6}" rx="4" ry="8" fill="#fff" opacity=".35"/>'
        elif k == 'bottle': items += f'<g transform="rotate(24 {x} {y})"><rect x="{x - 8}" y="{y - 24}" width="16" height="44" rx="6" fill="#7fd6e8" {S3}/><rect x="{x - 4}" y="{y - 36}" width="8" height="14" rx="3" fill="#7fd6e8" {S3}/></g>'
        elif k == 'box': items += f'<rect x="{x - 26}" y="{y - 19}" width="52" height="38" rx="4" fill="url(#wood)" {S}/><path d="M{x - 26} {y - 4} H{x + 26}" stroke="{OUT}" stroke-opacity=".4" stroke-width="3"/>'
        else: items += f'<g transform="rotate(-18 {x} {y})"><rect x="{x - 13}" y="{y - 19}" width="26" height="38" rx="6" fill="url(#can)" {S3}/><rect x="{x - 13}" y="{y - 6}" width="26" height="12" fill="#e8453c" {S3}/></g>'
    body = f'<ellipse cx="230" cy="210" rx="220" ry="162" fill="url(#{grad})" {S}/><path d="M60 150 Q120 80 220 70" stroke="#fff" stroke-opacity=".16" stroke-width="16" fill="none" stroke-linecap="round"/>' + items + '<ellipse cx="230" cy="330" rx="220" ry="40" fill="#000" opacity=".12"/>'
    save(name, 460, 380, body, bodyrect=[10, 48, 450, 372])
mound('mound0', 'mound', 1); mound('mound1', 'mound2', 2)

# ---------------------------------------------------------------- obstacles
for i, g in enumerate(('car1', 'car2', 'car3')):
    body = f'''<path d="M20 120 Q20 86 52 82 L96 78 Q120 30 170 28 H246 Q282 32 300 78 L352 84 Q384 90 384 124 V150 H20z" fill="url(#{g})" {S}/>
<path d="M128 78 Q142 44 176 42 H206 V80z M222 80 V42 H248 Q272 46 284 80z" fill="url(#glass)" {S}/>
<path d="M214 40 V82" {S}/><path d="M34 104 H370" stroke="#fff" stroke-opacity=".3" stroke-width="7" stroke-linecap="round"/>
<rect x="368" y="104" width="22" height="20" rx="8" fill="url(#yellow)" {S3}/><rect x="10" y="118" width="22" height="16" rx="6" fill="#d8dde8" {S3}/>
<circle cx="104" cy="150" r="36" fill="#2b2b36" {S}/><circle cx="104" cy="150" r="16" fill="url(#white)" {S3}/><circle cx="300" cy="150" r="36" fill="#2b2b36" {S}/><circle cx="300" cy="150" r="16" fill="url(#white)" {S3}/>'''
    save(f'car{i}', 400, 192, body, bodyrect=[10, 28, 392, 188])
save('fence', 90, 340, f'<path d="M12 40 L45 6 L78 40 V334 H12z" fill="url(#wood)" {S}/><path d="M12 80 H78 M12 250 H78" stroke="{OUT}" stroke-opacity=".5" stroke-width="5"/><circle cx="26" cy="80" r="4" fill="{OUT}"/><circle cx="64" cy="250" r="4" fill="{OUT}"/><path d="M26 56 V320" stroke="#fff" stroke-opacity=".35" stroke-width="8" stroke-linecap="round"/>', bodyrect=[12, 6, 78, 334])
save('pad', 330, 100, f'<rect x="20" y="50" width="290" height="40" rx="16" fill="url(#teal)" {S}/><rect x="6" y="28" width="318" height="34" rx="14" fill="url(#yellow)" {S}/><path d="M60 52 L84 32 L108 52z M150 52 L174 32 L198 52z M240 52 L264 32 L288 52z" fill="#e8453c" {S3}/><path d="M40 70 H290" stroke="#fff" stroke-opacity=".4" stroke-width="6" stroke-linecap="round"/>', bodyrect=[6, 28, 324, 90])

# ---------------------------------------------------------------- props
save('hydrant', 150, 210, f'<rect x="20" y="100" width="110" height="38" rx="14" fill="url(#hydrant)" {S}/><rect x="38" y="52" width="74" height="146" rx="16" fill="url(#hydrant)" {S}/><path d="M40 52 Q75 -6 110 52z" fill="url(#hydrant)" {S}/><rect x="60" y="18" width="30" height="16" rx="6" fill="#ffd34a" {S3}/><rect x="28" y="190" width="94" height="16" rx="6" fill="#8a2a26" {S}/><circle cx="26" cy="119" r="12" fill="#ffd34a" {S3}/><path d="M50 70 V180" stroke="#fff" stroke-opacity=".4" stroke-width="9" stroke-linecap="round"/>', hu=1.6)
save('barrel', 150, 200, f'<path d="M24 20 Q75 4 126 20 Q146 100 126 180 Q75 196 24 180 Q4 100 24 20z" fill="url(#wood)" {S}/><path d="M12 56 Q75 74 138 56 M10 144 Q75 162 140 144" stroke="#4a3a30" stroke-width="12" fill="none" stroke-linecap="round"/><path d="M12 56 Q75 74 138 56 M10 144 Q75 162 140 144" stroke="#8a8f9c" stroke-width="5" fill="none" stroke-linecap="round"/><path d="M44 30 V170" stroke="#fff" stroke-opacity=".3" stroke-width="9" stroke-linecap="round"/>', hu=1.6)
save('cone', 150, 200, f'<rect x="12" y="170" width="126" height="22" rx="8" fill="#3a3a44" {S}/><path d="M56 22 H94 L124 172 H26z" fill="url(#cone)" {S}/><path d="M44 96 H106 L112 128 H38z" fill="#fff" {S3}/><path d="M64 36 L44 160" stroke="#fff" stroke-opacity=".4" stroke-width="9" stroke-linecap="round"/>', hu=1.6)
save('trashcan', 150, 210, f'<path d="M28 56 H122 L112 196 Q75 206 38 196z" fill="url(#can)" {S}/><rect x="16" y="38" width="118" height="22" rx="9" fill="url(#metal)" {S}/><rect x="58" y="20" width="34" height="18" rx="7" fill="url(#metal)" {S3}/><path d="M56 70 V184 M75 70 V186 M94 70 V184" stroke="{OUT}" stroke-opacity=".4" stroke-width="5"/><path d="M40 70 L46 180" stroke="#fff" stroke-opacity=".4" stroke-width="7" stroke-linecap="round"/>', hu=1.6)
save('crate', 160, 160, f'<rect x="12" y="12" width="136" height="136" rx="20" fill="url(#wood)" {S}/><path d="M22 22 L138 138 M138 22 L22 138" stroke="url(#woodd)" stroke-width="16" stroke-linecap="round"/><path d="M22 22 L138 138 M138 22 L22 138" stroke="{OUT}" stroke-opacity=".45" stroke-width="2"/><rect x="12" y="12" width="136" height="136" rx="20" fill="none" {S}/>{glossBlob(50, 46, 24, 14, -20)}', hu=1.4)
save('chip', 170, 170, f'<circle cx="85" cy="85" r="74" fill="url(#red)" {S}/><circle cx="85" cy="85" r="44" fill="#fff4e0" {S}/><circle cx="85" cy="85" r="30" fill="url(#red)" {S3}/>' + ''.join(f'<rect x="80" y="12" width="10" height="22" rx="4" fill="#fff4e0" {S3} transform="rotate({a} 85 85)"/>' for a in range(0, 360, 60)), hu=1.2)
save('dice', 150, 150, f'<rect x="12" y="12" width="126" height="126" rx="22" fill="url(#white)" {S}/>' + ''.join(f'<circle cx="{x}" cy="{y}" r="11" fill="{OUT}"/>' for x, y in ((42, 42), (75, 75), (108, 108))) + f'<path d="M30 28 H70" stroke="#fff" stroke-width="8" stroke-linecap="round" opacity=".7"/>', hu=1.3)
save('bone', 230, 100, f'<path d="M60 36 H170 M60 64 H170" stroke="{OUT}" stroke-width="30" stroke-linecap="round"/><path d="M60 36 H170 M60 64 H170" stroke="#fff4dc" stroke-width="22" stroke-linecap="round"/><circle cx="36" cy="30" r="22" fill="#fff4dc" {S}/><circle cx="36" cy="70" r="22" fill="#fff4dc" {S}/><circle cx="194" cy="30" r="22" fill="#fff4dc" {S}/><circle cx="194" cy="70" r="22" fill="#fff4dc" {S}/>', hu=0.8)
save('boot', 160, 180, f'<path d="M30 12 H84 V90 Q110 94 138 120 Q150 134 140 154 H30z" fill="url(#woodd)" {S}/><path d="M30 130 H140" stroke="{OUT}" stroke-opacity=".5" stroke-width="5"/><path d="M42 22 V120" stroke="#fff" stroke-opacity=".3" stroke-width="8" stroke-linecap="round"/><rect x="30" y="148" width="112" height="14" rx="5" fill="#33271e" {S3}/>', hu=1.4)
save('fish', 240, 130, f'<path d="M40 66 L8 22 V110z" fill="#7fc2ff" {S}/><ellipse cx="128" cy="66" rx="96" ry="46" fill="url(#glass)" {S}/><path d="M116 20 Q142 0 170 22" fill="#59a6ee" {S3}/><circle cx="186" cy="56" r="11" fill="#fff" {S3}/><circle cx="189" cy="58" r="5" fill="{OUT}"/><path d="M168 82 Q186 88 198 80" stroke="{OUT}" stroke-width="4" fill="none" stroke-linecap="round"/><path d="M80 40 Q130 24 170 42" stroke="#fff" stroke-opacity=".5" stroke-width="8" fill="none" stroke-linecap="round"/>', hu=0.9)

# ---------------------------------------------------------------- portraits
def face_brows(sad=False): return ''
save('mayor', 360, 570, f'''
<path d="M120 500 q0 -14 14 -14 h44 q14 0 14 14 v26 q0 12 -14 12 h-44 q-14 0 -14 -12z" fill="#2a2a34" {S}/><path d="M190 500 q0 -14 14 -14 h44 q14 0 14 14 v26 q0 12 -14 12 h-44 q-14 0 -14 -12z" fill="#2a2a34" {S}/>
<path d="M126 360 h58 v136 h-58z" fill="url(#suit)" {S}/><path d="M196 360 h58 v136 h-58z" fill="url(#suit)" {S}/>
<path d="M62 232 Q62 210 96 206 L264 206 Q300 210 300 232 L292 392 Q180 410 70 392z" fill="url(#suit)" {S}/>
<path d="M160 206 L180 296 L200 206 L180 206z" fill="#fff" {S3}/><path d="M168 218 L180 232 L192 218 L186 330 L174 330z" fill="url(#red)" {S3}/>
<path d="M104 210 L166 206 L170 300 L120 330z M256 210 L194 206 L190 300 L240 330z" fill="#2a4a8a" {S}/>
<path d="M66 240 L296 330 L298 372 L64 284z" fill="url(#yellow)" {S}/><text x="180" y="318" text-anchor="middle" font-family="Arial Black,Impact,sans-serif" font-size="22" font-weight="900" fill="#c33" transform="rotate(22 180 318)">ZERO WASTE</text>
<path d="M62 232 Q30 300 40 380" stroke="{OUT}" stroke-width="42" stroke-linecap="round" fill="none"/><path d="M62 232 Q30 300 40 380" stroke="#3a5ba0" stroke-width="32" stroke-linecap="round" fill="none"/><circle cx="40" cy="394" r="22" fill="url(#skin)" {S}/>
<path d="M298 232 Q330 300 320 380" stroke="{OUT}" stroke-width="42" stroke-linecap="round" fill="none"/><path d="M298 232 Q330 300 320 380" stroke="#3a5ba0" stroke-width="32" stroke-linecap="round" fill="none"/><circle cx="320" cy="394" r="22" fill="url(#skin)" {S}/>
<ellipse cx="180" cy="124" rx="100" ry="96" fill="url(#skin)" {S}/><ellipse cx="82" cy="130" rx="14" ry="22" fill="url(#skin)" {S}/><ellipse cx="278" cy="130" rx="14" ry="22" fill="url(#skin)" {S}/>
<path d="M104 62 Q180 26 256 62 Q250 40 180 34 Q110 40 104 62z" fill="#8a8f9c" {S3}/>''' + ''.join(f'<path d="M{98 + k * 22} 74 Q{130 + k * 20} 40 {150 + k * 22} 66" stroke="#8a8f9c" stroke-width="5" fill="none" stroke-linecap="round"/>' for k in range(7)) + f'''
<path d="M118 96 Q142 82 164 94" stroke="#555" stroke-width="10" fill="none" stroke-linecap="round"/><path d="M196 94 Q218 82 242 96" stroke="#555" stroke-width="10" fill="none" stroke-linecap="round"/>
<ellipse cx="144" cy="122" rx="18" ry="20" fill="#fff" {S3}/><ellipse cx="216" cy="122" rx="18" ry="20" fill="#fff" {S3}/><circle cx="146" cy="126" r="8" fill="{OUT}"/><circle cx="214" cy="126" r="8" fill="{OUT}"/><circle cx="149" cy="122" r="3" fill="#fff"/><circle cx="217" cy="122" r="3" fill="#fff"/>
<path d="M170 138 q-12 24 10 30 q18 -2 6 -28" fill="#e99c76" {S3}/>
<path d="M128 182 Q180 232 232 182z" fill="#7a1f2f" {S}/><path d="M138 184 H222 V198 H138z" fill="#fff"/><ellipse cx="180" cy="214" rx="20" ry="9" fill="#ff7b8f"/>''', hu=5.0, bodyrect=[62, 206, 300, 396])
save('rascal', 360, 590, f'''
<path d="M70 420 Q-10 380 20 300 Q40 260 80 280 Q50 330 100 380z" fill="url(#fur)" {S}/><path d="M24 322 L64 306 M20 352 L72 332 M42 384 L84 360" stroke="#3a3a48" stroke-width="14" stroke-linecap="round"/>
<ellipse cx="130" cy="560" rx="52" ry="22" fill="url(#fur)" {S}/><ellipse cx="236" cy="560" rx="52" ry="22" fill="url(#fur)" {S}/>
<path d="M92 300 Q92 250 180 250 Q272 250 272 300 L284 520 Q180 560 82 520z" fill="url(#greyd)" {S}/><ellipse cx="182" cy="410" rx="62" ry="100" fill="#d9deea" {S3}/>
<path d="M92 300 Q40 360 70 440" stroke="{OUT}" stroke-width="34" stroke-linecap="round" fill="none"/><path d="M92 300 Q40 360 70 440" stroke="url(#fur)" stroke-width="24" stroke-linecap="round" fill="none"/><ellipse cx="72" cy="452" rx="22" ry="18" fill="url(#fur)" {S}/>
<path d="M272 300 Q320 360 296 440" stroke="{OUT}" stroke-width="34" stroke-linecap="round" fill="none"/><path d="M272 300 Q320 360 296 440" stroke="url(#fur)" stroke-width="24" stroke-linecap="round" fill="none"/><ellipse cx="294" cy="452" rx="22" ry="18" fill="url(#fur)" {S}/>
<path d="M92 120 L112 40 L158 90z" fill="url(#fur)" {S}/><path d="M272 120 L252 40 L206 90z" fill="url(#fur)" {S}/><path d="M108 100 L116 62 L142 90z" fill="#f4b4b4" opacity=".8"/><path d="M256 100 L248 62 L222 90z" fill="#f4b4b4" opacity=".8"/>
<ellipse cx="182" cy="190" rx="118" ry="104" fill="url(#fur)" {S}/>
<path d="M62 168 Q182 134 302 168 Q312 220 240 224 Q182 202 124 224 Q52 220 62 168z" fill="url(#mask)" {S}/>
<ellipse cx="182" cy="234" rx="60" ry="42" fill="#f4f6fa" {S3}/>
<ellipse cx="138" cy="182" rx="22" ry="24" fill="#fff" {S3}/><ellipse cx="226" cy="182" rx="22" ry="24" fill="#fff" {S3}/><circle cx="143" cy="186" r="11" fill="{OUT}"/><circle cx="221" cy="186" r="11" fill="{OUT}"/><circle cx="147" cy="181" r="4" fill="#fff"/><circle cx="225" cy="181" r="4" fill="#fff"/>
<path d="M118 158 Q138 146 160 156" stroke="{OUT}" stroke-width="7" fill="none" stroke-linecap="round"/><path d="M204 156 Q226 146 246 158" stroke="{OUT}" stroke-width="7" fill="none" stroke-linecap="round"/>
<ellipse cx="182" cy="222" rx="16" ry="12" fill="{OUT}"/><path d="M182 234 V250 M162 254 Q182 268 202 254" stroke="{OUT}" stroke-width="4" fill="none" stroke-linecap="round"/>
<ellipse cx="182" cy="108" rx="130" ry="18" fill="#2a2a34" {S}/><path d="M112 104 Q112 22 182 22 Q252 22 252 104z" fill="#2f2f3a" {S}/><rect x="112" y="78" width="140" height="20" fill="url(#red)" {S3}/><path d="M124 56 Q140 34 170 30" stroke="#fff" stroke-opacity=".25" stroke-width="8" fill="none" stroke-linecap="round"/>''', hu=5.0, bodyrect=[92, 250, 284, 540])
save('landfill', 620, 500, f'''
<path d="M20 470 Q0 300 120 200 Q200 40 310 40 Q440 40 510 200 Q620 300 600 470 Q500 500 310 500 Q120 500 20 470z" fill="url(#mound)" {S}/>
<path d="M120 270 Q150 140 240 90" stroke="#fff" stroke-opacity=".18" stroke-width="20" fill="none" stroke-linecap="round"/>
<ellipse cx="90" cy="400" rx="40" ry="36" fill="url(#bag)" {S}/><circle cx="530" cy="380" r="40" fill="#2c2c38" {S}/><circle cx="530" cy="380" r="16" fill="#aab3c2" {S3}/><rect x="440" y="90" width="70" height="52" rx="5" fill="url(#wood)" {S} transform="rotate(14 475 116)"/><circle cx="170" cy="130" r="34" fill="#3fbf6a" {S}/><rect x="270" y="14" width="26" height="62" rx="8" fill="#7fd6e8" {S3} transform="rotate(14 283 44)"/>
<ellipse cx="220" cy="230" rx="70" ry="76" fill="#fff" {S}/><ellipse cx="400" cy="230" rx="70" ry="76" fill="#fff" {S}/><circle cx="236" cy="240" r="30" fill="{OUT}"/><circle cx="384" cy="240" r="30" fill="{OUT}"/><circle cx="246" cy="228" r="10" fill="#fff"/><circle cx="394" cy="228" r="10" fill="#fff"/>
<path d="M150 170 L270 190" stroke="#4a2f14" stroke-width="22" stroke-linecap="round"/><path d="M470 170 L350 190" stroke="#4a2f14" stroke-width="22" stroke-linecap="round"/>
<path d="M130 340 Q310 300 490 340 Q480 460 310 470 Q140 460 130 340z" fill="#3a1030" {S}/><path d="M150 342 Q310 308 470 342" fill="none"/>''' + ''.join(f'<path d="M{158 + k * 50} 336 L{182 + k * 50} 336 L{170 + k * 50} 372z" fill="#fff" {S3}/>' for k in range(7)) + f'''<ellipse cx="310" cy="440" rx="70" ry="26" fill="#ff7b8f" {S3}/>''', hu=5.0, bodyrect=[20, 40, 600, 500])

json.dump(META, open(os.path.join(ART, 'world_meta.json'), 'w'))
open(os.path.join(ART, 'world_meta.js'), 'w').write('window.WORLD_META = ' + json.dumps(META) + ';\n')
prev = '<!doctype html><meta charset=utf-8><body style="margin:0;background:#9fd6f5;display:flex;flex-wrap:wrap;gap:6px;padding:8px;font:11px sans-serif">' + ''.join(f'<div style="width:190px;text-align:center"><img src="{n}.svg" style="height:150px;max-width:186px"><br>{n}</div>' for n in META)
open(os.path.join(ART, 'preview_world.html'), 'w').write(prev)
print(len(META), 'world svgs')
