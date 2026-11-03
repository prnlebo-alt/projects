"""Generates the 2D illustrated sprites (SVG) for Sling Trash, styled after reference/target-keyart.webp.
Run: python3 tools/svg/make_art.py   (writes art/*.svg, art/meta.js, art/preview.html)"""
import json, os
OUT = '#2a1740'
HERE = os.path.dirname(__file__)
ART = os.path.join(HERE, '..', '..', 'art')
os.makedirs(ART, exist_ok=True)

def lg(i, a, b, vertical=True):
    x2, y2 = ('0', '1') if vertical else ('1', '0')
    return f'<linearGradient id="{i}" x1="0" y1="0" x2="{x2}" y2="{y2}"><stop offset="0" stop-color="{a}"/><stop offset="1" stop-color="{b}"/></linearGradient>'

PUFF = '''<filter id="puff" x="-4%" y="-4%" width="108%" height="108%" color-interpolation-filters="sRGB"><feGaussianBlur in="SourceAlpha" stdDeviation="5" result="blur"/><feSpecularLighting in="blur" surfaceScale="6" specularConstant="1.1" specularExponent="18" lighting-color="#ffffff" result="spec"><feDistantLight azimuth="225" elevation="52"/></feSpecularLighting><feComposite in="spec" in2="SourceAlpha" operator="in" result="specIn"/><feDiffuseLighting in="blur" surfaceScale="4" diffuseConstant="1.05" lighting-color="#ffffff" result="diff"><feDistantLight azimuth="225" elevation="48"/></feDiffuseLighting><feComposite in="SourceGraphic" in2="diff" operator="arithmetic" k1="1.2" k2="0" k3="0" k4="0" result="shaded"/><feComposite in="shaded" in2="specIn" operator="arithmetic" k1="0" k2="1" k3=".55" k4="0"/></filter>'''
DEFS = '<defs>' + PUFF + ''.join([
    lg('skin', '#f8cca6', '#e19b72'), lg('hat', '#ffbb55', '#f27a12'), lg('navy', '#50648e', '#2f4068'),
    lg('pants', '#f4811f', '#d8620c'), lg('boot', '#6a4a36', '#3b2a20'), lg('vest', '#ff9d33', '#ee6f10'),
    lg('stripe', '#ffffff', '#cdd5e0'), lg('glove', '#4a4256', '#2b2536'),
    lg('grey', '#b7bfd0', '#7f889f'), lg('greyd', '#8b94aa', '#5d6680'), lg('neck', '#7ee0b0', '#8a62d6'),
    lg('blk', '#454556', '#14141d'), lg('blue', '#4c8fd6', '#2c5da0'), lg('bluelid', '#3c78bc', '#244b82'),
    lg('green', '#46c27a', '#2a8f55'), lg('greenlid', '#3a3a46', '#1c1c26'),
    lg('purp', '#9a73e0', '#6a45b4'), lg('purpd', '#7c58c8', '#4e318c'),
    lg('fur', '#c3c9d6', '#8a92a8'), lg('mask', '#3a3a48', '#15151e'), lg('tire', '#4a4a58', '#1a1a22'),
    lg('can', '#e6ebf2', '#aab3c2'), lg('cardb', '#d9a469', '#b27c40'),
]) + '</defs>'
S = f'stroke="{OUT}" stroke-width="7" stroke-linejoin="round" stroke-linecap="round"'
def sw(n):
    return f'stroke="{OUT}" stroke-width="{n}" stroke-linejoin="round" stroke-linecap="round"'
S3 = f'stroke="{OUT}" stroke-width="5.5" stroke-linejoin="round" stroke-linecap="round"'
def glossBlob(cx, cy, rx, ry, rot=0):
    t = f' transform="rotate({rot} {cx} {cy})"' if rot else ''
    return f'<ellipse cx="{cx}" cy="{cy}" rx="{rx}" ry="{ry}" fill="#ffffff" opacity=".55"{t}/>'
META = {}

def save(name, w, h, body, bodyrect=None, anchor=None):
    open(os.path.join(ART, name + '.svg'), 'w').write(f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {w} {h}" width="{w}" height="{h}">{DEFS}<g filter="url(#puff)">{body}</g></svg>')
    META[name] = {'w': w, 'h': h, 'body': bodyrect, 'anchor': anchor}

def tube(x1, y1, x2, y2, w, fill):
    return f'<line x1="{x1}" y1="{y1}" x2="{x2}" y2="{y2}" stroke="{OUT}" stroke-width="{w + 9}" stroke-linecap="round"/><line x1="{x1}" y1="{y1}" x2="{x2}" y2="{y2}" stroke="{fill}" stroke-width="{w}" stroke-linecap="round"/>'

def glove(x, y, r=22):
    return f'<circle cx="{x}" cy="{y}" r="{r}" fill="url(#glove)" {S}/><ellipse cx="{x - 6}" cy="{y - 7}" rx="{r * .35}" ry="{r * .22}" fill="#fff" opacity=".25"/>'

def gus(name, pose):
    legs = f'''
<path d="M150 360 h46 v136 q0 12 -12 12 h-22 q-12 0 -12 -12z" fill="url(#pants)" {S}/>
<path d="M204 360 h46 v136 q0 12 -12 12 h-22 q-12 0 -12 -12z" fill="url(#pants)" {S}/>
<path d="M146 496 h58 q12 0 12 16 v12 q0 8 -10 8 h-64 q-8 0 -8 -8 v-12 q0 -16 12 -16z" fill="url(#boot)" {S}/>
<path d="M204 496 h58 q12 0 12 16 v12 q0 8 -10 8 h-64 q-8 0 -8 -8 v-12 q0 -16 12 -16z" fill="url(#boot)" {S}/>
<path d="M160 376 L160 470" stroke="#fff" stroke-opacity=".18" stroke-width="8" stroke-linecap="round"/>
<path d="M214 376 L214 470" stroke="#fff" stroke-opacity=".18" stroke-width="8" stroke-linecap="round"/>'''
    shirt = f'<rect x="118" y="212" width="164" height="172" rx="38" fill="url(#navy)" {S}/>'
    if pose == 'idle' or pose == 'sad':
        arms = tube(124, 244, 118, 350, 40, '#44587f') + glove(118, 372) + tube(276, 244, 282, 350, 40, '#44587f') + glove(282, 372)
    elif pose == 'cheer':
        arms = tube(132, 244, 84, 128, 40, '#44587f') + glove(80, 104) + tube(268, 244, 316, 128, 40, '#44587f') + glove(320, 104)
    else:  # pull: front arm reaches toward the sling (holding it); pulling arm is drawn by the game
        arms = tube(270, 246, 372, 252, 40, '#44587f') + glove(390, 254)
    vest = f'''
<path d="M138 218 L178 218 L200 266 L222 218 L262 218 Q278 300 268 382 L132 382 Q122 300 138 218z" fill="url(#vest)" {S}/>
<rect x="134" y="296" width="132" height="20" fill="url(#stripe)" {S3}/>
<rect x="132" y="340" width="136" height="20" fill="url(#stripe)" {S3}/>
<path d="M152 224 L158 296" stroke="#f3f6fa" stroke-width="13" stroke-linecap="butt"/>
<path d="M248 224 L242 296" stroke="#f3f6fa" stroke-width="13" stroke-linecap="butt"/>
<path d="M146 240 Q142 300 150 372" stroke="#fff" stroke-opacity=".28" stroke-width="9" fill="none" stroke-linecap="round"/>'''
    neck = f'<rect x="180" y="190" width="40" height="36" rx="12" fill="#d89068" {S}/>'
    head = f'<ellipse cx="130" cy="140" rx="14" ry="20" fill="url(#skin)" {S}/><ellipse cx="200" cy="132" rx="76" ry="76" fill="url(#skin)" {S}/><path d="M128 122 q-10 32 6 56 q10 -24 16 -46z" fill="#6a4128" {S3}/>'
    cheeks = f'<ellipse cx="156" cy="162" rx="18" ry="12" fill="#ff8f8f" opacity=".4"/><ellipse cx="248" cy="162" rx="18" ry="12" fill="#ff8f8f" opacity=".4"/>'
    if pose == 'cheer':
        eyes = ''.join(f'<path d="M{x - 19} 138 Q{x} 112 {x + 19} 138" fill="none" {sw(9)}/>' for x in (194, 250))
        mouth = f'<path d="M202 178 Q232 238 268 178z" fill="#7a1f2f" {S}/><ellipse cx="236" cy="210" rx="15" ry="9" fill="#ff7b8f"/><path d="M210 180 L260 180" stroke="#fff" stroke-width="9"/>'
        brows = f'<path d="M172 100 Q196 82 220 96" stroke="#5a3420" stroke-width="12" fill="none" stroke-linecap="round"/><path d="M224 96 Q248 82 272 100" stroke="#5a3420" stroke-width="12" fill="none" stroke-linecap="round"/>'
    elif pose == 'sad':
        eyes = ''.join(f'<ellipse cx="{x}" cy="138" rx="20" ry="24" fill="#fff" {S3}/><circle cx="{x + 4}" cy="146" r="11" fill="{OUT}"/><circle cx="{x + 8}" cy="140" r="4" fill="#fff"/>' for x in (194, 250))
        mouth = f'<path d="M206 202 Q234 178 266 200" fill="none" {sw(7)}/>'
        brows = f'<path d="M170 110 Q196 102 222 88" stroke="#5a3420" stroke-width="12" fill="none" stroke-linecap="round"/><path d="M222 88 Q248 102 274 110" stroke="#5a3420" stroke-width="12" fill="none" stroke-linecap="round"/>'
    else:
        eyes = ''.join(f'<ellipse cx="{x}" cy="134" rx="20" ry="24" fill="#fff" {S3}/><circle cx="{x + 7}" cy="138" r="11" fill="{OUT}"/><circle cx="{x + 11}" cy="132" r="4" fill="#fff"/>' for x in (194, 250))
        mouth = f'<path d="M204 186 Q234 214 268 184" fill="none" {sw(7)}/>'
        brows = f'<path d="M170 104 Q196 90 222 102" stroke="#5a3420" stroke-width="12" fill="none" stroke-linecap="round"/><path d="M224 102 Q250 90 276 104" stroke="#5a3420" stroke-width="12" fill="none" stroke-linecap="round"/>'
    nose = f'<path d="M226 148 q16 12 2 24 q-8 4 -15 -2" fill="#e99c76" {S3}/>'
    hat = f'''
<path d="M118 114 Q118 28 202 28 Q292 28 292 114 Q204 128 118 114z" fill="url(#hat)" {S}/>
{glossBlob(168, 58, 30, 16, -24)}
<path d="M138 92 Q148 52 188 44" stroke="#fff" stroke-opacity=".55" stroke-width="11" fill="none" stroke-linecap="round"/>
<path d="M202 30 L206 120" stroke="#d9610b" stroke-opacity=".55" stroke-width="7" fill="none"/>
<path d="M98 116 Q200 136 300 114 Q336 112 342 126 Q336 138 300 136 Q200 152 98 134 Q88 124 98 116z" fill="#e8680f" {S}/>
<ellipse cx="208" cy="80" rx="34" ry="21" fill="#fff" {S3}/><text x="208" y="88" text-anchor="middle" font-family="Arial Black,Impact,sans-serif" font-size="23" font-weight="900" fill="#2b3f6e">GUS</text>'''
    save(name, 440 if pose == 'pull' else 400, 620, '<g transform="translate(0,52)">' + legs + shirt + arms + vest + neck + '<g transform="translate(200,238) scale(1.24) translate(-200,-238)"><g transform="translate(0,38)">' + head + cheeks + eyes + brows + nose + mouth + '</g><g transform="translate(0,-8)">' + hat + '</g></g></g>', bodyrect=[118, 264, 282, 436], anchor=[200, 588])
for n, p in (('gus_idle', 'idle'), ('gus_cheer', 'cheer'), ('gus_sad', 'sad'), ('gus_pull', 'pull')): gus(n, p)

def gerald(name, wing_up):
    wing = f'<g transform="rotate({-58 if wing_up else 8} 150 190)"><path d="M104 188 Q190 118 286 186 Q226 262 104 222z" fill="url(#greyd)" {S}/><path d="M150 190 Q200 170 250 190 M140 206 Q200 190 246 206" stroke="{OUT}" stroke-width="3" fill="none" stroke-opacity=".5"/></g>'
    body = f'''
<path d="M82 188 L8 214 L20 244 L96 228z" fill="url(#greyd)" {S}/>
<path d="M186 276 L186 330 M226 272 L226 330" stroke="#ee8a1d" stroke-width="8" stroke-linecap="round"/><path d="M168 334 h36 M208 334 h36" stroke="#ee8a1d" stroke-width="8" stroke-linecap="round"/>
<ellipse cx="196" cy="206" rx="124" ry="80" fill="url(#grey)" {S}/>
<ellipse cx="268" cy="180" rx="44" ry="32" fill="url(#neck)" opacity=".85"/>
<circle cx="308" cy="138" r="64" fill="url(#grey)" {S}/>
{glossBlob(272, 170, 36, 22, -20)}
<path d="M360 134 L420 150 L360 168z" fill="#f59a26" {S}/>
{wing}
<circle cx="330" cy="130" r="23" fill="#fff" {S3}/><circle cx="339" cy="136" r="10" fill="{OUT}"/><circle cx="343" cy="131" r="4" fill="#fff"/>
<path d="M307 130 A23 23 0 0 1 353 130z" fill="#8a93a8" {S3}/>
<path d="M298 96 Q332 86 356 106" stroke="{OUT}" stroke-width="7" fill="none" stroke-linecap="round"/>'''
    save(name, 430, 350, body, anchor=[210, 175])
gerald('gerald_up', True); gerald('gerald_down', False)

def bag():
    b = f'''
<rect x="170" y="52" width="20" height="54" rx="7" fill="#7fd6e8" {S3} transform="rotate(20 180 100)"/>
<rect x="104" y="58" width="26" height="42" rx="6" fill="url(#can)" {S3} transform="rotate(-22 118 100)"/>
<path d="M138 98 Q122 44 108 30 Q138 40 152 72 Q166 40 192 32 Q182 48 166 98z" fill="url(#blk)" {S}/>
<path d="M150 92 C70 92 38 160 54 222 C70 280 232 280 248 222 C264 160 232 92 150 92z" fill="url(#blk)" {S}/>
<ellipse cx="98" cy="170" rx="16" ry="40" fill="#fff" opacity=".34" transform="rotate(18 98 170)"/>
<path d="M120 255 Q150 268 190 252" stroke="#fff" stroke-opacity=".16" stroke-width="8" fill="none" stroke-linecap="round"/>'''
    save('bag', 300, 300, b, bodyrect=[50, 92, 252, 276], anchor=[150, 276])
bag()

def can():
    save('can', 160, 220, f'<rect x="34" y="30" width="92" height="160" rx="16" fill="url(#can)" {S}/><rect x="34" y="84" width="92" height="56" fill="#e8453c" {S3}/><ellipse cx="80" cy="32" rx="46" ry="12" fill="#9aa4b4" {S3}/><path d="M50 50 L50 180" stroke="#fff" stroke-opacity=".5" stroke-width="9" stroke-linecap="round"/>', bodyrect=[34, 30, 126, 190])
can()
def tire():
    save('tire', 220, 220, f'<circle cx="110" cy="110" r="94" fill="url(#tire)" {S}/><circle cx="110" cy="110" r="52" fill="url(#can)" {S}/><circle cx="110" cy="110" r="14" fill="#7d8798" {S3}/><path d="M40 70 Q60 40 100 30" stroke="#fff" stroke-opacity=".25" stroke-width="10" fill="none" stroke-linecap="round"/>', bodyrect=[16, 16, 204, 204])
tire()

def bin_(name, grad, lidgrad, open_lid):
    wheels = f'<circle cx="112" cy="282" r="22" fill="#2b2b36" {S}/><circle cx="112" cy="282" r="8" fill="#9aa0ad"/><circle cx="308" cy="282" r="22" fill="#2b2b36" {S}/><circle cx="308" cy="282" r="8" fill="#9aa0ad"/>'
    bodyp = f'<path d="M48 124 L372 124 L352 272 L68 272z" fill="url(#{grad})" {S}/>' + ''.join(f'<path d="M{58 + i * 4} {160 + i * 38} L{362 - i * 4} {160 + i * 38}" stroke="{OUT}" stroke-opacity=".35" stroke-width="5" fill="none"/>' for i in range(3)) + glossBlob(130, 175, 42, 55, -8)
    hl = '<path d="M72 138 L72 252" stroke="#fff" stroke-opacity=".28" stroke-width="12" stroke-linecap="round"/>'
    rim = f'<rect x="38" y="112" width="344" height="24" rx="10" fill="url(#{lidgrad})" {S}/>'
    if open_lid:
        lid = f'<path d="M64 26 L356 26 L332 108 L88 108z" fill="url(#{lidgrad})" {S}/><path d="M94 40 L334 40" stroke="#fff" stroke-opacity=".3" stroke-width="8" stroke-linecap="round"/>' + glossBlob(150, 58, 48, 16, -6)
        body = lid + bodyp + hl + rim + wheels
    else:
        lid = f'<path d="M36 92 L384 92 L376 134 L44 134z" fill="url(#{lidgrad})" {S}/><path d="M60 104 L360 104" stroke="#fff" stroke-opacity=".28" stroke-width="8" stroke-linecap="round"/><rect x="170" y="78" width="80" height="18" rx="8" fill="url(#{lidgrad})" {S3}/>' + glossBlob(140, 108, 46, 12, -4)
        body = bodyp + hl + lid + wheels
    save(name, 420, 310, body, bodyrect=[48, 124, 372, 272])
bin_('bin_open', 'blue', 'bluelid', True); bin_('bin_closed', 'green', 'greenlid', False)
bin_('bin_open_green', 'green', 'greenlid', True); bin_('bin_closed_blue', 'blue', 'bluelid', False)

def raccoon(name, hat=False, pupils=True, accessory=None, wide=False, sneaky=False):
    if hat and not accessory: accessory = 'bandit'
    bw, bh = (112, 96) if wide else (96, 82)
    PUP = (f'<circle cx="99" cy="125" r="14" fill="{OUT}"/><circle cx="161" cy="125" r="14" fill="{OUT}"/><circle cx="105" cy="118" r="5" fill="#fff"/><circle cx="167" cy="118" r="5" fill="#fff"/>' if pupils and not sneaky else '')
    eyes = (f'<path d="M78 122 Q96 112 114 122" stroke="{OUT}" stroke-width="7" fill="none" stroke-linecap="round"/><path d="M146 122 Q164 112 182 122" stroke="{OUT}" stroke-width="7" fill="none" stroke-linecap="round"/>' if sneaky else
            f'<ellipse cx="96" cy="126" rx="27" ry="30" fill="#fff" {S3}/><ellipse cx="164" cy="126" rx="27" ry="30" fill="#fff" {S3}/>{PUP}')
    brows = f'<path d="M68 82 Q96 62 122 84" stroke="#6b6372" stroke-width="8" fill="none" stroke-linecap="round"/><path d="M138 84 Q164 62 192 82" stroke="#6b6372" stroke-width="8" fill="none" stroke-linecap="round"/>'
    r = f'''
<ellipse cx="68" cy="56" rx="19" ry="23" fill="url(#fur)" transform="rotate(-16 68 56)" {S}/><ellipse cx="192" cy="56" rx="19" ry="23" fill="url(#fur)" transform="rotate(16 192 56)" {S}/>
<ellipse cx="70" cy="60" rx="9" ry="12" fill="#5c5a62" opacity=".7" transform="rotate(-16 70 60)"/><ellipse cx="190" cy="60" rx="9" ry="12" fill="#5c5a62" opacity=".7" transform="rotate(16 190 60)"/>
<ellipse cx="130" cy="128" rx="{bw}" ry="{bh}" fill="url(#fur)" {S}/>
{glossBlob(100, 92, 26, 15, -18)}
{brows}
<path d="M46 106 Q130 92 214 106 L214 134 Q130 148 46 134z" fill="url(#mask)" {S}/>
<ellipse cx="130" cy="170" rx="44" ry="42" fill="#f4f6fa" {S3}/>
{eyes}
<ellipse cx="130" cy="160" rx="12" ry="9" fill="{OUT}"/><path d="M130 169 L130 184 M114 186 Q130 196 146 186" stroke="{OUT}" stroke-width="4" fill="none" stroke-linecap="round"/>
<path d="M66 168 L22 160 M66 178 L24 184 M194 168 L238 160 M194 178 L236 184" stroke="{OUT}" stroke-width="3" stroke-linecap="round" opacity=".6"/>'''
    if accessory == 'bandit':
        r += f'<ellipse cx="130" cy="58" rx="112" ry="16" fill="#2a2a34" {S}/><path d="M72 56 Q72 -6 130 -6 Q188 -6 188 56z" fill="#2f2f3a" {S}/><rect x="72" y="36" width="116" height="16" fill="#e8453c" {S3}/>'
    elif accessory == 'foreman':
        r += f'<path d="M64 62 Q64 2 130 2 Q196 2 196 62 Q130 76 64 62z" fill="url(#hat)" {S}/><path d="M42 64 Q130 82 218 62 Q232 60 236 70 Q232 80 218 78 Q130 98 42 78 Q32 68 42 64z" fill="#e8680f" {S}/><ellipse cx="136" cy="40" rx="20" ry="13" fill="#fff" {S3}/>'
    elif accessory == 'chef':
        r += f'<path d="M66 54 Q58 6 92 -4 Q96 -20 118 -14 Q122 -28 140 -22 Q156 -28 160 -12 Q184 -16 184 2 Q206 4 200 50 Q130 36 66 54z" fill="#f4f6fa" {S}/><rect x="86" y="200" width="88" height="20" rx="8" fill="#e8453c" {S3}/>'
    r += f'<ellipse cx="58" cy="236" rx="26" ry="18" fill="url(#fur)" {S}/><ellipse cx="202" cy="236" rx="26" ry="18" fill="url(#fur)" {S}/>'
    r += f'<path d="M44 230 Q58 220 72 230" stroke="{OUT}" stroke-width="3" fill="none" opacity=".45"/><path d="M188 230 Q202 220 216 230" stroke="{OUT}" stroke-width="3" fill="none" opacity=".45"/>'
    if accessory == 'boss': r += f'<circle cx="104" cy="224" r="7" fill="#ffd23f" {S3}/><circle cx="130" cy="230" r="7" fill="#ffd23f" {S3}/><circle cx="156" cy="224" r="7" fill="#ffd23f" {S3}/>'
    save(name, 260, 260, r, anchor=[130, 240])
raccoon('raccoon'); raccoon('raccoon_np', pupils=False); raccoon('rascal_head', hat=True)
raccoon('raccoon_foreman', accessory='foreman'); raccoon('raccoon_boss', accessory='boss', wide=True); raccoon('raccoon_chef', accessory='chef'); raccoon('raccoon_sneaky', sneaky=True)

def dog(name):
    r = f'''
<ellipse cx="54" cy="96" rx="34" ry="56" fill="#c9924a" transform="rotate(-24 54 96)" {S}/><ellipse cx="206" cy="96" rx="34" ry="56" fill="#c9924a" transform="rotate(24 206 96)" {S}/>
<ellipse cx="130" cy="132" rx="92" ry="80" fill="#e0a85e" {S}/>
{glossBlob(96, 92, 28, 16, -20)}
<ellipse cx="130" cy="176" rx="46" ry="38" fill="#f4e4c8" {S3}/>
<path d="M70 96 Q94 82 116 96" stroke="#a9703c" stroke-width="7" fill="none" stroke-linecap="round" opacity=".7"/><path d="M144 96 Q166 82 190 96" stroke="#a9703c" stroke-width="7" fill="none" stroke-linecap="round" opacity=".7"/>
<ellipse cx="94" cy="126" rx="22" ry="25" fill="#fff" {S3}/><ellipse cx="166" cy="126" rx="22" ry="25" fill="#fff" {S3}/>
<circle cx="100" cy="131" r="12" fill="{OUT}"/><circle cx="172" cy="131" r="12" fill="{OUT}"/><circle cx="104" cy="125" r="4" fill="#fff"/><circle cx="176" cy="125" r="4" fill="#fff"/>
<ellipse cx="130" cy="166" rx="15" ry="11" fill="{OUT}"/>
<path d="M130 176 Q130 194 112 198" stroke="{OUT}" stroke-width="4" fill="none" stroke-linecap="round"/>
<path d="M112 198 Q130 212 150 196" stroke="{OUT}" stroke-width="4" fill="none" stroke-linecap="round"/>
<path d="M120 198 Q126 216 134 200" fill="#ff7b8f" {S3}/>
<ellipse cx="58" cy="236" rx="24" ry="17" fill="#e0a85e" {S}/><ellipse cx="202" cy="236" rx="24" ry="17" fill="#e0a85e" {S}/>
<path d="M78 148 Q130 168 182 148" stroke="#b27c40" stroke-width="5" fill="none" opacity=".5"/>'''
    save(name, 260, 260, r, anchor=[130, 240])
dog('dog')

def cat(name):
    r = f'''
<path d="M42 68 L68 -16 L118 54z" fill="#9aa3b0" {S}/><path d="M218 68 L192 -16 L142 54z" fill="#9aa3b0" {S}/>
<path d="M58 52 L72 16 L100 50z" fill="#f4b4b4" opacity=".85"/><path d="M202 52 L188 16 L160 50z" fill="#f4b4b4" opacity=".85"/>
<ellipse cx="130" cy="132" rx="88" ry="76" fill="#b7bfd0" {S}/>
{glossBlob(96, 92, 26, 14, -20)}
<ellipse cx="130" cy="170" rx="34" ry="30" fill="#e8ecf2" {S3}/>
<path d="M92 118 Q96 108 112 112" stroke="{OUT}" stroke-width="5" fill="none" stroke-linecap="round"/><path d="M168 118 Q164 108 148 112" stroke="{OUT}" stroke-width="5" fill="none" stroke-linecap="round"/>
<ellipse cx="96" cy="124" rx="9" ry="5" fill="{OUT}"/><ellipse cx="164" cy="124" rx="9" ry="5" fill="{OUT}"/>
<path d="M130 156 q10 8 0 14 q-10 -6 0 -14z" fill="#ff8f8f" {S3}/>
<path d="M120 176 Q130 184 140 176" stroke="{OUT}" stroke-width="4" fill="none" stroke-linecap="round"/>
<path d="M64 166 L14 156 M64 178 L16 184 M196 166 L246 156 M196 178 L244 184" stroke="{OUT}" stroke-width="3" stroke-linecap="round" opacity=".55"/>
<ellipse cx="58" cy="236" rx="24" ry="16" fill="#b7bfd0" {S}/><ellipse cx="202" cy="236" rx="24" ry="16" fill="#b7bfd0" {S}/>'''
    save(name, 260, 260, r, anchor=[130, 240])
cat('cat')

def boss(name, open_lid):
    junk = f'<circle cx="38" cy="150" r="34" fill="#3fbf6a" {S}/><circle cx="388" cy="170" r="30" fill="#c9cfdb" {S}/><circle cx="48" cy="270" r="30" fill="#2a2a34" {S}/><circle cx="392" cy="286" r="28" fill="#e8453c" {S}/><circle cx="200" cy="64" r="22" fill="#ffd23f" {S}/>'
    bodyp = f'<rect x="56" y="80" width="308" height="250" rx="40" fill="url(#purp)" {S}/><path d="M80 110 L80 300" stroke="#fff" stroke-opacity=".28" stroke-width="14" stroke-linecap="round"/><rect x="56" y="248" width="308" height="82" rx="40" fill="#4e318c" opacity=".35"/>'
    if open_lid:
        lid = f'<path d="M70 -4 L350 -4 L336 78 L84 78z" fill="url(#purpd)" {S}/>'
        save(name, 420, 350, junk + lid + bodyp, bodyrect=[56, 80, 364, 330])
    else:
        lid = f'<rect x="44" y="52" width="332" height="44" rx="18" fill="url(#purpd)" {S}/>'
        save(name, 420, 350, junk + bodyp + lid, bodyrect=[56, 80, 364, 330])
boss('boss_open', True); boss('boss_closed', False)

json.dump(META, open(os.path.join(ART, 'meta.json'), 'w'))
open(os.path.join(ART, 'meta.js'), 'w').write('window.ART_META = ' + json.dumps(META) + ';\n')
names = list(META)
html = '<!doctype html><meta charset=utf-8><body style="margin:0;background:#9fd6f5;display:flex;flex-wrap:wrap;gap:8px;padding:8px;font:12px sans-serif">' + ''.join(f'<div style="width:300px;text-align:center"><img src="{n}.svg" style="height:300px;max-width:300px"><br>{n}</div>' for n in names)
open(os.path.join(ART, 'preview.html'), 'w').write(html)
print(len(names), 'svgs')
