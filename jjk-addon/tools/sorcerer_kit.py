"""The painting and modelling kit behind tools/gen_sorcerers.py (the cast's skins and 3D gear).

Skins (64x64, both layers):
  head(s, c, front, side, back, front1, side1, back1)  pixel-art rows per face of the head (side rows run back -> front)
  outfit(s, c, top, sleeve, pants, shoes, ...)          shaded cloth over the body, arms and legs, with override hooks
  jjh_uniform(c)                                        the Jujutsu High jacket: high collar, spiral button, buttons,
                                                        seams, cuffs, hem
  sneakers(...) / sandals(...)                          leg_fn helpers for the feet
  bake(s)                                               soft baked light: tops bright, backs and undersides dark
  Face palette letters: H h d hair (base, light, dark) · S s skin (base, shade) · E eye white · I J iris (top, bottom) ·
    P pupil · L lash line · K brow · n nose shadow · b blush · M m mouth (dark, light) · T teeth · B black · X mark ·
    O scar · G g glasses (frame, lens) · W white · R red · Y gold · Q deep red · C c collar (base, shade)
Gear (a second geometry over the skin, bones named like the body's so the animations move it):
  Gear(ident)               bones, cubes and an auto-packed 64x64 texture: g.region(w, h, fn), g.flat(colour)
  spike(g, bone, ...)       a tapered spike (a thick base and a thin tip turned together about the base)
  hair_cap, fringe, sideburns, collar, spiral_button, hem, cuffs, soles, muscles, on_back
Cube origins in a geometry are ABSOLUTE model coordinates (not relative to the bone's pivot).
"""
import json
import random

from PIL import Image


def w(path, obj):
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(obj, indent=2, ensure_ascii=False) + "\n")


def mul(c, k):
    return tuple(max(0, min(255, int(round(v * k)))) for v in c[:3])


def mix(a, b, u):
    return tuple(int(round(a[i] + (b[i] - a[i]) * u)) for i in range(3))


# ===========================================================================
# Skins
# ===========================================================================
BOXES = {  # part: (base uv, overlay uv, (w, h, d))
    "head": ((0, 0), (32, 0), (8, 8, 8)),
    "body": ((16, 16), (16, 32), (8, 12, 4)),
    "rarm": ((40, 16), (40, 32), (4, 12, 4)),
    "larm": ((32, 48), (48, 48), (4, 12, 4)),
    "rleg": ((0, 16), (0, 32), (4, 12, 4)),
    "lleg": ((16, 48), (0, 48), (4, 12, 4)),
}
SIDES = ("right", "front", "left", "back")


def rects(origin, dims):
    ox, oy = origin
    wd, ht, dp = dims
    return {"top": (ox + dp, oy, wd, dp), "bottom": (ox + dp + wd, oy, wd, dp), "right": (ox, oy + dp, dp, ht),
            "front": (ox + dp, oy + dp, wd, ht), "left": (ox + dp + wd, oy + dp, dp, ht), "back": (ox + 2 * dp + wd, oy + dp, wd, ht)}


class Skin:
    def __init__(self, seed):
        self.img = Image.new("RGBA", (64, 64), (0, 0, 0, 0))
        self.p = self.img.load()
        self.rng = random.Random(seed)

    def rect(self, part, face, layer=0):
        return rects(BOXES[part][layer], BOXES[part][2])[face]

    def paint(self, part, faces, fn, layer=0):
        """fn(face, u, v, w, h) -> colour or None for every pixel of those faces."""
        for face in faces:
            x, y, wd, ht = self.rect(part, face, layer)
            for u in range(wd):
                for v in range(ht):
                    c = fn(face, u, v, wd, ht)
                    if c is not None:
                        self.p[x + u, y + v] = tuple(c[:3]) + ((c[3],) if len(c) > 3 else (255,))

    def put(self, part, face, u, v, c, layer=0):
        x, y, wd, ht = self.rect(part, face, layer)
        if 0 <= u < wd and 0 <= v < ht:
            self.p[x + u, y + v] = tuple(c[:3]) + ((c[3],) if len(c) > 3 else (255,))

    def rows(self, part, face, art, pal, layer=0):
        """Pixel art: one string per row, one char per pixel ('.' = leave as is)."""
        for v, row in enumerate(art):
            for u, ch in enumerate(row):
                if ch in pal:
                    self.put(part, face, u, v, pal[ch], layer)

    def cloth(self, base, face, u, v, wd, ht, grain=0.05, top=1.06, bottom=0.9):
        """A shaded fabric pixel: lighter at the top, darker at the bottom and toward the edges of side faces."""
        k = top + (bottom - top) * (v / max(1, ht - 1))
        if face in ("right", "left") and (u == 0 or u == wd - 1):
            k *= 0.92
        if face == "front" and (u == 0 or u == wd - 1):
            k *= 0.95
        return mul(base, k * (1 + self.rng.uniform(-grain, grain)))


FACE_LIGHT = {"top": 1.07, "front": 1.0, "left": 0.95, "right": 0.91, "back": 0.88, "bottom": 0.72}


def bake(s):
    """Soft baked light on the base layer: the game lights faces too, this adds the painted look of a good skin."""
    for part, (base, _, dims) in BOXES.items():
        for face, (x, y, wd, ht) in rects(base, dims).items():
            k = FACE_LIGHT[face]
            for u in range(wd):
                for v in range(ht):
                    r, g, b, a = s.p[x + u, y + v]
                    if a:
                        s.p[x + u, y + v] = mul((r, g, b), k) + (a,)


def palette(c):
    S = c["skin"]
    H = c.get("hair", (30, 30, 36))
    J = c.get("collar", c.get("jacket", (34, 36, 58)))
    iris = c.get("iris", (70, 60, 52))
    return {"H": H, "h": c.get("hair_h", mix(H, (255, 255, 255), 0.28)), "d": c.get("hair_d", mul(H, 0.68)),
            "S": S, "s": c.get("skin_d", mul(S, 0.86)), "E": c.get("eye", (246, 244, 240)), "I": c.get("iris_h", mix(iris, (255, 255, 255), 0.25)),
            "J": iris, "i": c.get("iris2", iris), "P": (16, 14, 20), "L": c.get("lash", (28, 22, 24)), "K": c.get("brow", mul(H, 0.78)),
            "n": mul(S, 0.8), "b": mix(S, (236, 120, 120), 0.35), "M": c.get("mouth", (110, 56, 54)), "m": c.get("lip", mix(S, (200, 90, 96), 0.55)),
            "T": (242, 238, 230), "B": c.get("black", (22, 20, 26)), "X": c.get("mark", (30, 22, 26)), "O": c.get("scar", mix(S, (160, 80, 80), 0.45)),
            "G": c.get("frame", (30, 30, 36)), "g": c.get("lens", (150, 200, 190)), "W": c.get("white", (236, 236, 240)), "R": c.get("red", (190, 40, 50)),
            "Y": c.get("gold", (226, 186, 80)), "Q": (70, 16, 22), "C": J, "c": mul(J, 0.78)}


def head(s, c, front, side, back, front1=None, side1=None, back1=None, top=None):
    """The head: skin everywhere, the hair colour on top, then pixel-art rows for each face (side rows run back -> front)."""
    pal = palette(c)
    H = c.get("top", pal["H"])
    s.paint("head", ("top",), lambda f, u, v, wd, ht: mul(H, 1.12 if (u * 3 + v * 5) % 7 == 0 else (0.88 if (u + v * 3) % 5 == 0 else 1.0)))
    s.paint("head", ("bottom",), lambda f, u, v, wd, ht: pal["s"])
    s.paint("head", SIDES, lambda f, u, v, wd, ht: s.cloth(pal["S"], f, u, v, wd, ht, 0.015, 1.03, 0.94))
    s.rows("head", "front", front, pal)
    s.rows("head", "right", side, pal)
    s.rows("head", "left", [r[::-1] for r in side], pal)
    s.rows("head", "back", back, pal)
    if top:
        s.rows("head", "top", top, pal)
    for rows_, faces in ((front1, ("front",)), (side1, ("right", "left")), (back1, ("back",))):
        if rows_:
            for fc in faces:
                s.rows("head", fc, rows_ if fc != "left" else [r[::-1] for r in rows_], pal, layer=1)


def outfit(s, c, top, sleeve, pants, shoes, hands=None, top_fn=None, arm_fn=None, leg_fn=None, sleeve_to=10, shoe_rows=1):
    """Body, arms and legs in shaded cloth; *_fn(...) may return a colour to override a pixel."""
    S = c["skin"]
    hands = hands or S

    def body(f, u, v, wd, ht):
        o = top_fn(f, u, v, wd, ht) if top_fn else None
        return o if o is not None else s.cloth(top, f, u, v, wd, ht, 0.035)
    s.paint("body", SIDES, body)
    s.paint("body", ("top",), lambda f, u, v, wd, ht: mul(top, 1.05))
    s.paint("body", ("bottom",), lambda f, u, v, wd, ht: mul(top, 0.85))
    for arm in ("rarm", "larm"):
        def ap(f, u, v, wd, ht, arm=arm):
            o = arm_fn(arm, f, u, v, wd, ht) if arm_fn else None
            if o is not None:
                return o
            if v < sleeve_to:
                return s.cloth(sleeve, f, u, v, wd, ht, 0.035)
            return mul(hands, 0.9 if v == ht - 1 else (0.96 if f in ("left", "right") else 1.0))
        s.paint(arm, SIDES, ap)
        s.paint(arm, ("top",), lambda f, u, v, wd, ht: sleeve)
        s.paint(arm, ("bottom",), lambda f, u, v, wd, ht: mul(hands, 0.86))
    for leg in ("rleg", "lleg"):
        def lp(f, u, v, wd, ht, leg=leg):
            o = leg_fn(leg, f, u, v, wd, ht) if leg_fn else None
            if o is not None:
                return o
            if v < 12 - shoe_rows:
                k = 1.06 if (f == "front" and u == (1 if leg == "rleg" else 2)) else 1.0          # a pressed crease
                return mul(s.cloth(pants, f, u, v, wd, ht, 0.035), k)
            return mul(shoes, 1.15) if v == 12 - shoe_rows and f == "front" else shoes
        s.paint(leg, SIDES, lp)
        s.paint(leg, ("top",), lambda f, u, v, wd, ht: pants)
        s.paint(leg, ("bottom",), lambda f, u, v, wd, ht: shoes)


def jjh_uniform(c, buttons=True, collar_rows=2, cuffs=True, hem=True):
    """The Jujutsu High jacket: a high collar with the gold spiral button, gold buttons down the front, side and back
    seams, a darker hem; returns (top_fn, arm_fn)."""
    J = c["jacket"]
    gold = c.get("gold", (226, 186, 80))

    def top(f, u, v, wd, ht):
        if v < collar_rows:
            if f == "front" and u in (3, 4):
                return mul(gold, 1.1 if v == 0 else 0.85) if collar_rows == 2 else gold      # the spiral button
            return mul(J, 1.2 if v == 0 else 1.1)
        if f == "front":
            if u == 3:
                return mul(J, 0.7)                                                          # the front closure
            if buttons and u == 4 and v in (4, 7, 10):
                return gold
            if v == 6 and u in (0, 6, 7):
                return mul(J, 0.82)                                                         # a breast pocket line
        if f == "back" and u in (3, 4) and 2 < v < 11:
            return mul(J, 0.82)                                                             # back seam
        if f in ("right", "left") and u == 1:
            return mul(J, 0.88)                                                             # side seam
        if hem and v == ht - 1:
            return mul(J, 0.72)
        return None

    def arm(a, f, u, v, wd, ht):
        if cuffs and v == 9:
            return gold if (f == ("right" if a == "rarm" else "left") and u == 1) else mul(J, 0.72)
        return None
    return top, arm


def sneakers(shoe, sole=(238, 236, 230), lace=None, rows=2):
    """leg_fn for sneakers: the shoe over the last rows, a white sole, laces on top."""
    lace = lace or mix(shoe, (255, 255, 255), 0.6)

    def fn(leg, f, u, v, wd, ht):
        if v < ht - rows:
            return None
        if v == ht - 1:
            return sole
        if f == "front" and u in (1, 2):
            return lace
        return shoe
    return fn


def sandals(skin, strap=(70, 50, 40)):
    def fn(leg, f, u, v, wd, ht):
        if v < 10:
            return None
        if v == 11:
            return mul(strap, 0.8)
        return strap if (f == "front" and u in (1, 2)) else skin
    return fn


# ===========================================================================
# Gear
# ===========================================================================
GW = 64
NONE = (60, 60, 4, 4)    # transparent corner of every gear texture
BONE_PIVOT = {"head": (0, 24, 0), "body": (0, 24, 0), "rightArm": (-5, 22, 0), "leftArm": (5, 22, 0), "rightLeg": (-1.9, 12, 0),
              "leftLeg": (1.9, 12, 0)}


class Gear:
    def __init__(self, ident):
        self.ident = ident
        self.bones, self.idx = [], {}
        self.tex = Image.new("RGBA", (GW, GW), (0, 0, 0, 0))
        self._x = self._y = self._row = 0
        for name, parent, piv in (("root", None, (0, 0, 0)), ("waist", "root", (0, 12, 0)), ("body", "waist", (0, 24, 0)),
                                  ("head", "body", (0, 24, 0)), ("rightArm", "body", (-5, 22, 0)), ("leftArm", "body", (5, 22, 0)),
                                  ("rightLeg", "root", (-1.9, 12, 0)), ("leftLeg", "root", (1.9, 12, 0))):
            self.bone(name, parent, piv)

    def bone(self, name, parent, pivot, rotation=None):
        if name in self.idx:
            return name
        b = {"name": name, "pivot": [round(v, 3) for v in pivot], "cubes": []}
        if parent:
            b["parent"] = parent
        if rotation:
            b["rotation"] = [round(v, 3) for v in rotation]
        self.bones.append(b)
        self.idx[name] = b
        return name

    def cube(self, bone, origin, size, uv, inflate=0.0, rotation=None, pivot=None):
        c = {"origin": [round(v, 3) for v in origin], "size": [round(v, 3) for v in size], "uv": uv}
        if inflate:
            c["inflate"] = round(inflate, 3)
        if rotation:
            c["rotation"] = [round(v, 3) for v in rotation]
            c["pivot"] = [round(v, 3) for v in (pivot or [origin[i] + size[i] / 2 for i in range(3)])]
        self.idx[bone]["cubes"].append(c)

    def region(self, wd, ht, fn):
        """Allocates a wd x ht area of the gear texture (shelf packing) and paints it with fn(u, v, wd, ht)."""
        if self._x + wd > GW:
            self._x, self._y, self._row = 0, self._y + self._row, 0
        r = (self._x, self._y, wd, ht)
        if self._y + ht > GW - 4 and self._x + wd > NONE[0]:
            raise ValueError(f"{self.ident}: gear texture full")
        if self._y + ht > GW:
            raise ValueError(f"{self.ident}: gear texture full")
        self._x += wd
        self._row = max(self._row, ht)
        p = self.tex.load()
        for u in range(wd):
            for v in range(ht):
                col = fn(u, v, wd, ht)
                if col is not None:
                    p[r[0] + u, r[1] + v] = tuple(col[:3]) + ((col[3],) if len(col) > 3 else (255,))
        return r

    def flat(self, col, wd=4, ht=4, k=(1.12, 0.86)):
        return self.region(wd, ht, lambda u, v, w_, h_: mul(col, k[0] + (k[1] - k[0]) * v / max(1, h_ - 1)))

    def json(self, bw=3.2, bh=3.6):
        return {"format_version": "1.12.0", "minecraft:geometry": [{
            "description": {"identifier": self.ident, "texture_width": GW, "texture_height": GW,
                            "visible_bounds_width": bw, "visible_bounds_height": bh, "visible_bounds_offset": [0, 1.4, 0]},
            "bones": [{k: v for k, v in b.items() if k != "cubes" or v} for b in self.bones]}]}


def uv(**faces):
    """Per-face UVs: face=(x, y, w, h) or 'none'; rest= fills the faces not named."""
    rest = faces.pop("rest", "none")
    out = {}
    for f in ("north", "south", "east", "west", "up", "down"):
        r = faces.get(f, rest)
        if r == "none":
            r = (NONE[0] + 1, NONE[1] + 1, 2, 2)
        x, y, wd, ht = r
        out[f] = {"uv": [x, y], "uv_size": [wd, ht]}
    return out


def ring(region):
    return uv(north=region, south=region, east=region, west=region)


def hair_tex(g, col, light=0.0, wd=8, ht=8):
    """Hair: lighter roots-to-tips strands with darker gaps between them."""
    hl = mix(col, (255, 255, 255), 0.2 + light)
    return g.region(wd, ht, lambda u, v, w_, h_: mul(col, 0.88 - 0.12 * v / h_) if u % 4 == 3 and v > 1 else (
        hl if (u % 4 == 0 and v < h_ * 0.45) else mul(col, 1.06 - 0.2 * v / h_)))


def spike(g, bone, base, length, width, rot, r_base, r_tip=None):
    """A tapered spike: a thick base and a thin tip, both turned about the base point (x, y, z)."""
    x, y, z = base
    pv = (x, y, z)
    g.cube(bone, (x - width / 2, y, z - width / 2), (width, length * 0.66, width), uv(rest=r_base), rotation=rot, pivot=pv)
    tw = width * 0.64
    g.cube(bone, (x - tw / 2, y + length * 0.6, z - tw / 2), (tw, length * 0.4, tw), uv(rest=r_tip or r_base), rotation=rot, pivot=pv)


def spikes(g, col, items, parent="head", name="g_hair", light=0.0):
    """Tapered spikes: items = [(base (x, y, z), length, width, rotation)] — two-tone (light tips)."""
    rb = hair_tex(g, col, light, 6, 8)
    rt = hair_tex(g, mix(col, (255, 255, 255), 0.12), light, 4, 6)
    b = g.bone(name, parent, BONE_PIVOT.get(parent, (0, 32, 0)))
    for base, ln, wd, rot in items:
        spike(g, b, base, ln, wd, rot, rb, rt)
    return b


def hair_cap(g, col, y0=29.0, inflate=0.55, back_to=24.5, name="g_hair", light=0.0):
    """A shell of hair over the top and back of the head (the hair's volume), open at the face."""
    top = g.region(8, 8, lambda u, v, wd, ht: mul(col, 1.15 + (0.1 if (u + v) % 3 == 0 else 0) - (0.12 if (u * 2 + v) % 5 == 0 else 0)))
    side = hair_tex(g, col, light, 8, 6)
    b = g.bone(name, "head", (0, 24, 0))
    g.cube(b, (-4, y0, -4), (8, 32 - y0, 8), uv(up=top, east=side, west=side, south=side, north="none", down="none"), inflate=inflate)
    if back_to < y0:
        g.cube(b, (-4, back_to, 0.6), (8, y0 - back_to, 3.4), uv(south=side, east=side, west=side, rest="none"), inflate=inflate)
    return b


def fringe(g, col, pattern, y=31.0, z=-4.75, name="g_hair"):
    """A fringe over the forehead: pattern = [(x, width, length)] strands hanging from y."""
    r = hair_tex(g, col, 0.05, 4, 6)
    b = g.bone(name, "head", (0, 24, 0))
    for x, wd, ln in pattern:
        g.cube(b, (x, y - ln, z), (wd, ln, 0.7), uv(rest=r))
    return b


def sideburns(g, col, length=3.2, name="g_hair"):
    r = hair_tex(g, col, 0.0, 2, 4)
    b = g.bone(name, "head", (0, 24, 0))
    for x in (-4.75, 4.05):
        g.cube(b, (x, 29.6 - length, -2.4), (0.7, length, 1.6), uv(rest=r))
    return b


def collar(g, col, y0=23.2, h=1.2, inflate=0.75, name="g_collar", button=None):
    """A high collar up to the chin (the mouth stays visible), with an optional gold spiral button at the front."""
    r = g.region(8, 2, lambda u, v, wd, ht: mul(col, 1.2 if v == 0 else 1.02))
    b = g.bone(name, "body", (0, 24, 0))
    g.cube(b, (-4, y0, -4), (8, h, 8), ring(r), inflate=inflate)
    if button:
        br = g.region(2, 2, lambda u, v, wd, ht: mul(button, 0.6) if (u, v) == (1, 1) else button)
        g.cube(b, (-0.7, y0 + 0.05, -4.95), (1.4, 1.1, 0.35), uv(rest=br))
    return b


def hem(g, col, name="g_hem"):
    """The jacket's lower edge flaring out a little over the hips."""
    r = g.region(8, 2, lambda u, v, wd, ht: mul(col, 0.95 - 0.12 * v))
    b = g.bone(name, "body", (0, 24, 0))
    g.cube(b, (-4, 12.0, -2), (8, 1.6, 4), ring(r), inflate=0.5)
    return b


def cuffs(g, col, name="g_cuffs"):
    """Turned-back sleeve cuffs just above the hands."""
    r = g.region(4, 2, lambda u, v, wd, ht: mul(col, 1.08 - 0.15 * v))
    for arm, x in (("rightArm", -8), ("leftArm", 4)):
        b = g.bone(f"{name}_{arm}", arm, BONE_PIVOT[arm])
        g.cube(b, (x, 14.2, -2), (4, 1.4, 4), ring(r), inflate=0.32)


def soles(g, sole=(238, 236, 230), toe=None, name="g_soles"):
    """Sneaker soles: a thin plate under each foot, longer at the toe."""
    r = g.region(4, 2, lambda u, v, wd, ht: mul(sole, 1.0 - 0.1 * v))
    t = g.region(4, 2, lambda u, v, wd, ht: toe or mul(sole, 0.95))
    for leg, x in (("rightLeg", -3.9), ("leftLeg", -0.1)):
        b = g.bone(f"{name}_{leg}", leg, BONE_PIVOT[leg])
        g.cube(b, (x - 0.15, 0, -2.45), (4.3, 0.75, 4.6), uv(north=t, south=r, east=r, west=r, up="none", down=r))


def muscles(g, skin, sleeve=None, upper=True):
    """Bulk on the arms (shoulders and biceps) for the big ones."""
    r = g.region(4, 6, lambda u, v, wd, ht: mul(sleeve or skin, 1.08 - 0.2 * v / ht))
    for arm, x in (("rightArm", -8), ("leftArm", 4)):
        b = g.bone(f"g_bulk_{arm}", arm, BONE_PIVOT[arm])
        g.cube(b, (x, 18.0 if upper else 14, -2), (4, 6, 4), uv(rest=r), inflate=0.45)


SPINE = (0, 18, 2.6)


def on_back(g, parts, angle=-38, name="g_back"):
    """Things strapped diagonally across the back: parts = [(origin, size, region)] measured from the spine."""
    b = g.bone(name, "body", SPINE, (0, 0, angle))
    for o, sz, r in parts:
        g.cube(b, (o[0] + SPINE[0], o[1] + SPINE[1], o[2] + SPINE[2] + 0.4), sz, uv(rest=r))
    return b
