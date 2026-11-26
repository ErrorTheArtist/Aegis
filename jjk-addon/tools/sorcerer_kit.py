"""The painting and modelling kit behind tools/gen_sorcerers.py (the cast's skins and 3D gear).

Everything is drawn at TWICE the usual texture density (D = 2 texels per model pixel): the skins are 128x128 on the
cast's own body geometry (geometry.jjk.sorcerer_body, written here), so a face is 16x16 instead of 8x8; the gear
textures are 128x128 too.

Skins (128x128, both layers):
  Skin(seed)                           paint(part, faces, fn) with fn(face, u, v, w, h) in texels; rows() for pixel art
  head_base(s, c, ...)                 skin on every side of the head (and the ears)
  face(s, c, eyes=, brows=, mouth=)    an anime face on the 16x16 front: eyes from EYES, brows, nose, mouth, marks
  hair_skin(s, c, front=, fringe=, side=, back=)   PLAIN hair, painted strand by strand on the head's two layers:
                                       per-column outlines; the fringe on the outer layer; undercuts; partings
  hair_on(s, c, part, face, rows)      the same hair on any other face (long hair down the back of the body)
  outfit(s, c, top, sleeve, pants, shoes, ...)   shaded cloth on the body, arms and legs, with override hooks
  jjh_uniform(c) / sneakers() / sandals() / boots()   the Jujutsu High jacket and footwear (fn hooks for outfit)
  bake(s)                              soft baked light: tops bright, backs and undersides dark
Gear (a second geometry over the skin; bones named like the body's, so the animations move it):
  Gear(ident)                          bones, cubes and an auto-packed 128x128 texture
  g.swatch(name, w, h, fn)             a painted patch of texture; g.box(bone, origin, size, swatch) samples a fresh
                                       window of it for every face at 2x density (nothing stretched, nothing repeated)
  Hair(g, base, shadow, light)         hair textures and slab() for the smooth shapes that stick out (tails, buns)
  collar, hem, cuffs, soles, muscles, on_back, glasses, coat_skirt, wide_legs ... (clothes and props)
Cube origins in a geometry are ABSOLUTE model coordinates (not relative to the bone's pivot).
Rotations: +rx tips a part's top forward (-Z), +rz tips it toward +X (the character's left).
"""
import json
import math
import random

from PIL import Image

D = 2          # texels per model pixel
SW = 128       # skin and gear textures are 128 x 128


def w(path, obj):
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(obj, indent=2, ensure_ascii=False) + "\n")


def mul(c, k):
    return tuple(max(0, min(255, int(round(v * k)))) for v in c[:3])


def mix(a, b, u):
    u = max(0.0, min(1.0, u))
    return tuple(int(round(a[i] + (b[i] - a[i]) * u)) for i in range(3))


# ===========================================================================
# Skins
# ===========================================================================
BOXES = {  # part: (base uv, overlay uv, (w, h, d)) in the classic 64x64 layout (doubled when painted)
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
    r = {"top": (ox + dp, oy, wd, dp), "bottom": (ox + dp + wd, oy, wd, dp), "right": (ox, oy + dp, dp, ht),
         "front": (ox + dp, oy + dp, wd, ht), "left": (ox + dp + wd, oy + dp, dp, ht), "back": (ox + 2 * dp + wd, oy + dp, wd, ht)}
    return {k: tuple(v * D for v in val) for k, val in r.items()}


class Skin:
    def __init__(self, seed):
        self.img = Image.new("RGBA", (SW, SW), (0, 0, 0, 0))
        self.p = self.img.load()
        self.rng = random.Random(seed)

    def rect(self, part, face, layer=0):
        return rects(BOXES[part][layer], BOXES[part][2])[face]

    def paint(self, part, faces, fn, layer=0):
        """fn(face, u, v, w, h) -> colour or None for every texel of those faces (u, v, w, h in texels)."""
        for face in faces:
            x, y, wd, ht = self.rect(part, face, layer)
            for u in range(wd):
                for v in range(ht):
                    c = fn(face, u, v, wd, ht)
                    if c is not None:
                        self.p[x + u, y + v] = tuple(c[:3]) + ((c[3],) if len(c) > 3 else (255,))

    def get(self, part, face, u, v, layer=0):
        x, y, wd, ht = self.rect(part, face, layer)
        return self.p[x + u, y + v] if 0 <= u < wd and 0 <= v < ht else None

    def put(self, part, face, u, v, c, layer=0):
        x, y, wd, ht = self.rect(part, face, layer)
        if 0 <= u < wd and 0 <= v < ht and c is not None:
            self.p[x + u, y + v] = tuple(c[:3]) + ((c[3],) if len(c) > 3 else (255,))

    def rows(self, part, face, art, pal, layer=0, at=(0, 0)):
        """Pixel art: one string per row, one char per texel ('.' or a char not in pal = leave as is)."""
        for v, row in enumerate(art):
            for u, ch in enumerate(row):
                if ch in pal:
                    self.put(part, face, at[0] + u, at[1] + v, pal[ch], layer)

    def cloth(self, base, face, u, v, wd, ht, grain=0.035, top=1.06, bottom=0.9):
        """A shaded fabric texel: lighter at the top, darker at the bottom and toward the edges of the side faces."""
        k = top + (bottom - top) * (v / max(1, ht - 1))
        if face in ("right", "left") and (u <= 1 or u >= wd - 2):
            k *= 0.93
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


def body_geometry():
    """The cast's own body: the vanilla humanoid's bones and boxes (and the outer layer), with per-face UVs on the
    128x128 skins. Bone names match geometry.humanoid.custom, so the vanilla walk, look and attack animations work."""
    def faces(part, layer):
        r = rects(BOXES[part][layer], BOXES[part][2])
        out = {}
        for face, key in (("north", "front"), ("south", "back"), ("east", "left"), ("west", "right"), ("up", "top"), ("down", "bottom")):
            x, y, wd, ht = r[key]
            out[face] = {"uv": [x, y], "uv_size": [wd, ht]}
        return out

    def cube(part, origin, size, layer=0, inflate=0.0):
        c = {"origin": list(origin), "size": list(size), "uv": faces(part, layer)}
        if inflate:
            c["inflate"] = inflate
        return c
    bones = [
        {"name": "root", "pivot": [0, 0, 0]},
        {"name": "waist", "parent": "root", "pivot": [0, 12, 0]},
        {"name": "body", "parent": "waist", "pivot": [0, 24, 0],
         "cubes": [cube("body", (-4, 12, -2), (8, 12, 4)), cube("body", (-4, 12, -2), (8, 12, 4), 1, 0.25)]},
        {"name": "head", "parent": "body", "pivot": [0, 24, 0],
         "cubes": [cube("head", (-4, 24, -4), (8, 8, 8)), cube("head", (-4, 24, -4), (8, 8, 8), 1, 0.5)]},
        {"name": "rightArm", "parent": "body", "pivot": [-5, 22, 0],
         "cubes": [cube("rarm", (-8, 12, -2), (4, 12, 4)), cube("rarm", (-8, 12, -2), (4, 12, 4), 1, 0.25)]},
        {"name": "rightItem", "parent": "rightArm", "pivot": [-6, 15, 1]},
        {"name": "leftArm", "parent": "body", "pivot": [5, 22, 0],
         "cubes": [cube("larm", (4, 12, -2), (4, 12, 4)), cube("larm", (4, 12, -2), (4, 12, 4), 1, 0.25)]},
        {"name": "leftItem", "parent": "leftArm", "pivot": [6, 15, 1]},
        {"name": "rightLeg", "parent": "root", "pivot": [-1.9, 12, 0],
         "cubes": [cube("rleg", (-3.9, 0, -2), (4, 12, 4)), cube("rleg", (-3.9, 0, -2), (4, 12, 4), 1, 0.25)]},
        {"name": "leftLeg", "parent": "root", "pivot": [1.9, 12, 0],
         "cubes": [cube("lleg", (-0.1, 0, -2), (4, 12, 4)), cube("lleg", (-0.1, 0, -2), (4, 12, 4), 1, 0.25)]},
    ]
    return {"format_version": "1.12.0", "minecraft:geometry": [{
        "description": {"identifier": "geometry.jjk.sorcerer_body", "texture_width": SW, "texture_height": SW,
                        "visible_bounds_width": 2, "visible_bounds_height": 2.5, "visible_bounds_offset": [0, 1.2, 0]},
        "bones": bones}]}


def palette(c):
    S = c["skin"]
    H = c.get("hair", (30, 30, 36))
    iris = c.get("iris", (70, 60, 52))
    return {"H": H, "h": c.get("hair_h", mix(H, (255, 255, 255), 0.3)), "d": c.get("hair_d", mul(H, 0.62)),
            "S": S, "s": c.get("skin_d", mix(mul(S, 0.86), (150, 90, 100), 0.12)), "t": mix(mul(S, 0.93), (200, 120, 120), 0.08),
            "E": c.get("eye", (248, 246, 242)), "e": mix(c.get("eye", (248, 246, 242)), (170, 170, 200), 0.35),
            "I": c.get("iris_h", mix(iris, (255, 255, 255), 0.32)), "J": iris, "j": mul(iris, 0.6),
            "P": c.get("pupil", (16, 14, 22)), "L": c.get("lash", (30, 22, 28)), "l": mix(c.get("lash", (30, 22, 28)), S, 0.45),
            "K": c.get("brow", mul(H, 0.7)), "k": mix(c.get("brow", mul(H, 0.7)), S, 0.5),
            "n": mix(mul(S, 0.82), (160, 90, 90), 0.15), "b": mix(S, (238, 124, 128), 0.32),
            "M": c.get("mouth", (120, 60, 64)), "m": c.get("lip", mix(S, (206, 96, 104), 0.5)), "T": (246, 242, 236),
            "B": c.get("black", (22, 20, 26)), "X": c.get("mark", (28, 20, 26)), "O": c.get("scar", mix(S, (176, 96, 96), 0.5)),
            "o": mix(c.get("scar", mix(S, (176, 96, 96), 0.5)), S, 0.5),
            "G": c.get("frame", (30, 30, 36)), "g": c.get("lens", (150, 200, 190)), "W": (255, 255, 255), "R": c.get("red", (190, 40, 50)),
            "Y": c.get("gold", (226, 186, 80)), "Q": (80, 18, 26), "U": c.get("bags", mix(S, (120, 90, 130), 0.35))}


def head_base(s, c, hairline=4, back_hair=16, side_hair=8, sideburn=0, top=True):
    """Skin on every side of the head and the hair colour where the hair grows (the 3D hair covers most of it; this
    fills the gaps): the top, the front above `hairline` texels, the back above `back_hair`, the sides above
    `side_hair` (plus a sideburn strip in front of the ear)."""
    pal = palette(c)
    H, Hd = pal["H"], pal["d"]
    rng = s.rng

    def hair(u, v, k=1.0):
        return mul(mix(Hd, H, 0.55 + 0.45 * ((u * 7 + v * 3) % 5) / 4), k * (1 + rng.uniform(-0.03, 0.03)))

    def fn(f, u, v, wd, ht):
        if f == "top":
            return hair(u, v, 1.06) if top else pal["S"]
        if f == "bottom":
            return pal["s"]
        limit = {"front": hairline, "back": back_hair}.get(f, side_hair)
        if f in ("right", "left") and sideburn:
            near_face = u >= wd - 3 if f == "right" else u <= 2
            if near_face and v < side_hair + sideburn:
                return hair(u, v, 0.92)
        if v < limit:
            return hair(u, v, 1.0 - 0.1 * v / max(1, limit))
        if f == "front":
            return s.cloth(pal["S"], f, u, v, wd, ht, 0.012, 1.02, 0.96)
        return s.cloth(pal["S"], f, u, v, wd, ht, 0.012, 1.0, 0.94)
    s.paint("head", ("top", "bottom") + SIDES, fn)
    # the ear: a little shadow on each side
    for f, u0 in (("right", 6), ("left", 8)):
        for v in range(9, 13):
            for u in (u0, u0 + 1):
                s.put("head", f, u, v, pal["t"])
        s.put("head", f, u0 + (1 if f == "right" else 0), 10, pal["s"])


# --- plain hair, painted on the skin --------------------------------------------------------------------------------
def _prof(p, n=16):
    """A hair outline: a list of n numbers, or a short list stretched to n (each value = hair rows from the top)."""
    if p is None:
        return [0] * n
    if isinstance(p, int):
        return [p] * n
    p = list(p)
    if len(p) == n:
        return p
    return [p[min(len(p) - 1, int(i * len(p) / n))] for i in range(n)]


def hair_on(s, c, part, face, prof, layers=(0, 1), seed=11, fade=True):
    """Hair on any face of any part (long hair down the back of the body): prof = rows per column, as in hair_skin."""
    rng = random.Random(seed)
    H = c.get("hair", (30, 30, 36))
    Hd = c.get("hair_d", mix(mul(H, 0.58), (40, 40, 90), 0.12))
    Hl = c.get("hair_h", mix(H, (255, 250, 240), 0.35))
    x, y, wd, ht = s.rect(part, face)
    p = _prof(prof, wd)
    shift = [(-0.38 if r < 0.18 else (0.28 if r > 0.88 else rng.uniform(-0.1, 0.1))) for r in (rng.random() for _ in range(wd))]
    for layer in layers:
        for u in range(wd):
            n = p[u]
            for v in range(n):
                t = shift[u] + (0.14 if layer == 1 else -0.12) + (0.15 - 0.5 * v / max(1, n - 1) if fade else 0) + rng.uniform(-0.04, 0.04)
                if v == n - 1 and layer == 1:
                    t -= 0.2
                t = max(-1.0, min(1.0, t))
                col = mix(H, Hd, -t) if t < 0 else mix(H, Hl, t)
                s.put(part, face, u, v, col, layer)


def hair_skin(s, c, front=2, fringe=None, side=8, side_hat=None, back=12, back_hat=None, top=True, part=None,
              under=None, under_rows=0, sheen=True, seed=7):
    """Plain hair on the skin's two layers (the classic way: no extra 3D). Outlines are hair rows from the top, per
    column (16 columns, or a short list stretched over them):
      front     base-layer hair over the forehead          fringe  the bangs, on the outer (hat) layer
      side      the sides, from the BACK (col 0) to the front (col 15); side_hat the outer layer (default side - 1)
      back      the back of the head; back_hat the outer layer (default back - 1)
    part = the column of a parting on the front and top; under = a second colour (an undercut or dark roots) for the
    lowest `under_rows` rows of the sides and back. The hair is shaded strand by strand: lighter where it starts, darker
    toward its ends, a sheen band near the top, the outer layer brighter than the base underneath."""
    rng = random.Random(seed)
    H = c.get("hair", (30, 30, 36))
    Hd = c.get("hair_d", mix(mul(H, 0.58), (40, 40, 90), 0.12))
    Hl = c.get("hair_h", mix(H, (255, 250, 240), 0.35))
    U = under
    colshift = {}

    def strand(face, u):
        key = (face, u)
        if key not in colshift:
            r = rng.random()
            colshift[key] = -0.38 if r < 0.18 else (0.28 if r > 0.88 else rng.uniform(-0.1, 0.1))
        return colshift[key]

    def tone(t, base=H):
        return mix(base, Hd if base is H else mul(base, 0.6), -t) if t < 0 else mix(base, Hl if base is H else mix(base, (255, 255, 255), 0.3), t)

    def px(face, u, v, length, layer, base=H):
        f = v / max(1, length - 1) if length > 1 else 0.0
        t = strand(face, u) + (0.16 if layer == 1 else -0.12) + 0.2 - 0.55 * f
        if sheen and layer == 1 and 1 <= v <= 2:
            t += 0.25
        if v == length - 1 and layer == 1:
            t -= 0.22                                                       # the edge of the outer layer
        if part is not None and face in ("front", "top") and u == part:
            t -= 0.5
        return tone(max(-1.0, min(1.0, t + rng.uniform(-0.04, 0.04))), base)

    fb, fh = _prof(front), _prof(fringe)
    sb = _prof(side)
    sh = _prof(side_hat) if side_hat is not None else [max(0, v - 1) for v in sb]
    bb = _prof(back)
    bh = _prof(back_hat) if back_hat is not None else [max(0, v - 1) for v in bb]
    for face, base_p, hat_p in (("front", fb, fh), ("right", sb, sh), ("left", sb[::-1], sh[::-1]), ("back", bb, bh)):
        for u in range(16):
            for layer, p in ((0, base_p), (1, hat_p)):
                n = p[u]
                for v in range(n):
                    col = U if (U and layer == 0 and face != "front" and v >= n - under_rows) else H
                    if col is H:
                        c_ = px(face, u, v, n, layer)
                    else:
                        c_ = mul(col, (1.0 if layer == 1 else 0.9) * (1 + rng.uniform(-0.05, 0.05)) * (0.92 + 0.08 * ((u + v) % 3 == 0)))
                    s.put("head", face, u, v, c_, layer)
    if top:
        for layer in (0, 1):
            for u in range(16):
                for v in range(16):
                    t = strand("top", u) * 0.6 + (0.25 if layer == 1 else -0.05) + rng.uniform(-0.05, 0.05)
                    if sheen and layer == 1 and abs(math.hypot(u - 7.5, v - 7.5) - 4.5) < 1.1:
                        t += 0.2
                    if part is not None and u == part:
                        t -= 0.45
                    s.put("head", "top", u, v, tone(max(-1.0, min(1.0, t))), layer)


# --- faces (16 x 16 on the front of the head) -----------------------------------------------------------------------
# Eye templates for the character's RIGHT eye (on the image's left); the left eye is the mirror image. Rows top to
# bottom. L lash, l soft lash, E white, e shaded white, I iris (light), J iris, j iris (dark), P pupil, * highlight,
# U shadow under the eye, K brow, . skin (unchanged).
EYES = {
    "round": [".LLL.",
              "LLjJL",
              "EJ*PJ",
              ".IIJJ",
              "..II."],
    "bright": [".LLLL",
               "LLjJJ",
               "eJ*PJ",
               ".IJJJ",
               ".III.",
               "..ll."],
    "sharp": ["LL...",
              ".LLLL",
              "eJ*PJ",
              ".IIJl",
              "..ll."],
    "narrow": [".....",
               "LLLLL",
               "eJ*PJ",
               ".llll"],
    "squint": [".....",
               ".LLL.",
               "LJ*PL",
               ".lll."],
    "smile_closed": [".....",
                     ".LLL.",
                     "L...L"],
    "closed": [".....",
               ".....",
               "LLLLL",
               ".lll."],
    "tired": [".LLL.",
              "LLjJL",
              "eJ*PJ",
              ".IIJJ",
              ".UUU.",
              "..U.."],
    "wide": [".LLL.",
             "LEEEL",
             "EJ*JE",
             "EJPJE",
             ".EEE.",
             "..l.."],
    "none": [],
    "fierce": ["LL...",
               ".LLLL",
               "..J*P",
               "...IJ",
               "....l"],
}
BROWS = {  # the right brow (image left), 5 wide; the left brow is its mirror image
    "flat": ["KKKKk"],
    "soft": [".kKKk"],
    "raised": [".kKK.", "K...."],
    "thick": ["KKKKK", ".KKKk"],
    "angry": ["KKk..", ".kKKK"],
    "angry_thick": ["KKKk.", ".KKKK", "...kK"],
    "worried": ["..kKK", "KKk.."],
    "thin": [".kkk."],
    "none": [],
}
MOUTHS = {  # 6 wide, centred
    "neutral": ["..MM..", ".mmmm."],
    "line": [".MMMM."],
    "smile": ["M....M", ".MMMM."],
    "small_smile": [".M..M.", "..MM.."],
    "smirk": ["......", "....MM", ".MMM.."],
    "grin": ["MMMMMM", "MTTTTM", ".MMMM."],
    "evil_grin": ["M....M", "MTTTTM", ".MTTM.", "..MM.."],
    "open": [".MMMM.", "MQQQQM", ".MMMM."],
    "frown": [".MMMM.", "M....M"],
    "flat_small": ["..MM.."],
    "none": [],
}


def face(s, c, eyes="round", brows="flat", mouth="neutral", eye_y=7, gap=1, brow_y=None, brow_shift=0, mouth_y=12, nose=True,
         blush=False, extra=None, layer=0):
    """An anime face on the front of the head (16 x 16 texels): eyes from EYES `gap` texels either side of the centre,
    brows from BROWS, a nose shadow, a mouth from MOUTHS. extra = [(u, v, palette key or rgb)] marks, scars and
    stitches painted last. The left eye is the mirror image of the right one, with its highlight kept on the same side
    of the pupil (the light comes from one place)."""
    pal = dict(palette(c))
    pal["*"] = (255, 255, 255)
    art = EYES[eyes] if isinstance(eyes, str) else eyes
    ew = len(art[0]) if art else 5
    xr, xl = 8 - gap - ew, 8 + gap

    def put(u, v, ch):
        if ch in pal:
            s.put("head", "front", u, v, pal[ch], layer)
    for v, row in enumerate(art):
        mrow = row[::-1]
        if "*" in mrow and "P" in mrow and mrow.index("*") > mrow.index("P"):
            lst = list(mrow)
            i_s, i_p = mrow.index("*"), mrow.index("P")
            lst[i_s] = "J"
            if i_p > 0:
                lst[i_p - 1] = "*"
            mrow = "".join(lst)
        for u, ch in enumerate(row):
            put(xr + u, eye_y + v, ch)
        for u, ch in enumerate(mrow):
            put(xl + u, eye_y + v, ch)
    b = BROWS[brows] if isinstance(brows, str) else brows
    by = (eye_y - len(b) - 1) if brow_y is None else brow_y
    for v, row in enumerate(b):
        for u, ch in enumerate(row):
            put(xr + u - brow_shift, by + v, ch)
            put(xl + (len(row) - 1 - u) + brow_shift, by + v, ch)
    if nose:
        s.put("head", "front", 8, mouth_y - 2, pal["n"], layer)
        s.put("head", "front", 8, mouth_y - 3, mix(pal["n"], pal["S"], 0.6), layer)
    m = MOUTHS[mouth] if isinstance(mouth, str) else mouth
    for v, row in enumerate(m):
        for u, ch in enumerate(row):
            put(5 + u, mouth_y + v, ch)
    if blush:
        for u in (2, 3, 12, 13):
            s.put("head", "front", u, eye_y + len(art), pal["b"], layer)
    for u, v, col in extra or []:
        s.put("head", "front", u, v, pal[col] if isinstance(col, str) else col, layer)


# --- clothes on the skin ---------------------------------------------------------------------------------------------
def outfit(s, c, top, sleeve, pants, shoes, hands=None, top_fn=None, arm_fn=None, leg_fn=None, sleeve_to=10, shoe_rows=1):
    """Body, arms and legs in shaded cloth; *_fn(...) may return a colour to override a texel. sleeve_to and shoe_rows
    are in model pixels (12 = a whole limb)."""
    S = c["skin"]
    hands = hands or S

    def body(f, u, v, wd, ht):
        o = top_fn(f, u, v, wd, ht) if top_fn else None
        return o if o is not None else s.cloth(top, f, u, v, wd, ht)
    s.paint("body", SIDES, body)
    s.paint("body", ("top",), lambda f, u, v, wd, ht: mul(top, 1.05))
    s.paint("body", ("bottom",), lambda f, u, v, wd, ht: mul(top, 0.85))
    for arm in ("rarm", "larm"):
        def ap(f, u, v, wd, ht, arm=arm):
            o = arm_fn(arm, f, u, v, wd, ht) if arm_fn else None
            if o is not None:
                return o
            if v < sleeve_to * D:
                return s.cloth(sleeve, f, u, v, wd, ht)
            k = 0.86 if v >= ht - 2 else (0.95 if f in ("left", "right") else 1.0)
            if f == "front" and v >= ht - 4 and u in (wd // 2 - 1,):
                k *= 0.9                                                            # a hint of fingers
            return mul(hands, k)
        s.paint(arm, SIDES, ap)
        s.paint(arm, ("top",), lambda f, u, v, wd, ht: sleeve)
        s.paint(arm, ("bottom",), lambda f, u, v, wd, ht: mul(hands, 0.84))
    for leg in ("rleg", "lleg"):
        def lp(f, u, v, wd, ht, leg=leg):
            o = leg_fn(leg, f, u, v, wd, ht) if leg_fn else None
            if o is not None:
                return o
            if v < (12 - shoe_rows) * D:
                k = 1.05 if (f == "front" and u == (3 if leg == "rleg" else 4)) else 1.0       # a pressed crease
                return mul(s.cloth(pants, f, u, v, wd, ht), k)
            return mul(shoes, 1.12) if v == (12 - shoe_rows) * D and f == "front" else shoes
        s.paint(leg, SIDES, lp)
        s.paint(leg, ("top",), lambda f, u, v, wd, ht: pants)
        s.paint(leg, ("bottom",), lambda f, u, v, wd, ht: mul(shoes, 0.8))


def jjh_uniform(c, buttons=True, collar_rows=3, cuffs=True, hem=True, closure=True):
    """The Jujutsu High jacket: a high collar with the gold spiral button, gold buttons down the front, seams, cuffs and
    a darker hem; returns (top_fn, arm_fn) for outfit()."""
    J = c["jacket"]
    gold = c.get("gold", (226, 186, 80))

    def top(f, u, v, wd, ht):
        if v < collar_rows:
            if f == "front" and u in (7, 8) and collar_rows >= 2:
                return mul(gold, 1.12 if v == 0 else 0.86)                                 # the spiral button
            return mul(J, 1.22 if v == 0 else 1.1)
        if v == collar_rows and f in SIDES:
            return mul(J, 0.78)                                                             # the collar's shadow
        if f == "front":
            if closure and u == 7:
                return mul(J, 0.66)                                                         # the front closure
            if closure and u == 8:
                return mul(J, 1.08)
            if buttons and u in (9, 10) and v in (8, 9, 14, 15, 20, 21):
                return mul(gold, 1.1 if (u, v % 2) == (9, 0) else 0.86)
            if v == 12 and (u <= 2 or u >= 13):
                return mul(J, 0.8)                                                          # pocket flaps
        if f == "back" and u in (7, 8) and 4 < v < 22:
            return mul(J, 0.84)                                                             # back seam
        if f in ("right", "left") and u in (3, 4):
            return mul(J, 0.9)                                                              # side seam
        if hem and v >= ht - 2:
            return mul(J, 0.74 if v == ht - 1 else 0.84)
        return None

    def arm(a, f, u, v, wd, ht):
        if cuffs and v in (18, 19):
            if f == ("right" if a == "rarm" else "left") and u in (3, 4):
                return gold
            return mul(J, 0.72 if v == 19 else 0.82)
        if f == "front" and v == 9 and u in (2, 3, 4, 5):
            return mul(J, 0.88)                                                             # elbow crease
        return None
    return top, arm


def sneakers(shoe, sole=(238, 236, 230), lace=None, rows=2, stripe=None):
    """leg_fn for sneakers: the shoe over the last rows, a white sole, laces on top (and a stripe on the side)."""
    lace = lace or mix(shoe, (255, 255, 255), 0.6)

    def fn(leg, f, u, v, wd, ht):
        if v < ht - rows * D:
            return None
        if v >= ht - 1:
            return sole
        if f == "front" and 2 <= u <= 5 and v < ht - 2 and (v + u) % 2 == 0:
            return lace
        if stripe and f in ("left", "right") and v == ht - 3:
            return stripe
        return mul(shoe, 1.1) if v == ht - rows * D else shoe
    return fn


def sandals(skin, strap=(70, 50, 40), sole=(60, 44, 34)):
    def fn(leg, f, u, v, wd, ht):
        if v < ht - 3:
            return None
        if v == ht - 1:
            return sole
        if f == "front" and u in (3, 4):
            return strap
        return skin
    return fn


def boots(col, rows=4, cuff=None):
    def fn(leg, f, u, v, wd, ht):
        if v < ht - rows * D:
            return None
        if v == ht - rows * D and cuff:
            return cuff
        if v >= ht - 1:
            return mul(col, 0.6)
        return mul(col, 1.1 - 0.15 * (v - (ht - rows * D)) / (rows * D))
    return fn


# ===========================================================================
# Gear
# ===========================================================================
NONE = (SW - 4, SW - 4, 4, 4)    # a transparent corner of every gear texture
BONE_PIVOT = {"head": (0, 24, 0), "body": (0, 24, 0), "rightArm": (-5, 22, 0), "leftArm": (5, 22, 0), "rightLeg": (-1.9, 12, 0),
              "leftLeg": (1.9, 12, 0)}
FACE_DIMS = {"north": (0, 1), "south": (0, 1), "east": (2, 1), "west": (2, 1), "up": (0, 2), "down": (0, 2)}


class Gear:
    def __init__(self, ident, seed=0):
        self.ident = ident
        self.bones, self.idx = [], {}
        self.tex = Image.new("RGBA", (SW, SW), (0, 0, 0, 0))
        self.sw = {}
        self.rng = random.Random(seed or sum(map(ord, ident)))
        self._x = self._y = self._row = 0
        for name, parent, piv in (("root", None, (0, 0, 0)), ("waist", "root", (0, 12, 0)), ("body", "waist", (0, 24, 0)),
                                  ("head", "body", (0, 24, 0)), ("rightArm", "body", (-5, 22, 0)), ("leftArm", "body", (5, 22, 0)),
                                  ("rightLeg", "root", (-1.9, 12, 0)), ("leftLeg", "root", (1.9, 12, 0))):
            self.bone(name, parent, piv)

    def bone(self, name, parent, pivot=None, rotation=None):
        if name in self.idx:
            return name
        b = {"name": name, "pivot": [round(v, 3) for v in (pivot or BONE_PIVOT.get(parent, (0, 24, 0)))], "cubes": []}
        if parent:
            b["parent"] = parent
        if rotation:
            b["rotation"] = [round(v, 3) for v in rotation]
        self.bones.append(b)
        self.idx[name] = b
        return name

    # --- texture -----------------------------------------------------------------------------------------------------
    def region(self, wd, ht, fn):
        """Allocates a wd x ht texel area of the texture (shelf packing) and paints it with fn(u, v, wd, ht)."""
        if self._x + wd > SW:
            self._x, self._y, self._row = 0, self._y + self._row, 0
        if self._y + ht > SW or (self._y + ht > SW - 4 and self._x + wd > NONE[0]):
            raise ValueError(f"{self.ident}: gear texture full")
        r = (self._x, self._y, wd, ht)
        self._x += wd
        self._row = max(self._row, ht)
        p = self.tex.load()
        for u in range(wd):
            for v in range(ht):
                col = fn(u, v, wd, ht)
                if col is not None:
                    p[r[0] + u, r[1] + v] = tuple(col[:3]) + ((col[3],) if len(col) > 3 else (255,))
        return r

    def swatch(self, name, wd, ht, fn):
        self.sw[name] = self.region(wd, ht, fn)
        return name

    def plain(self, name, col, wd=16, ht=16, grain=0.04, top=1.08, bottom=0.88):
        """A swatch of shaded cloth (or any flat material)."""
        rng = self.rng
        return self.swatch(name, wd, ht, lambda u, v, w_, h_: mul(col, (top + (bottom - top) * v / max(1, h_ - 1)) * (1 + rng.uniform(-grain, grain))))

    def window(self, sw, fw, fh):
        """A fresh window of swatch `sw` for a face fw x fh model pixels (2x density); too big = the whole swatch."""
        if sw is None:
            return {"uv": [NONE[0] + 1, NONE[1] + 1], "uv_size": [2, 2]}
        if isinstance(sw, tuple):
            x, y, wd, ht = sw
            return {"uv": [x, y], "uv_size": [wd, ht]}
        x, y, wd, ht = self.sw[sw]
        uw, vh = min(wd, max(0.5, fw * D)), min(ht, max(0.5, fh * D))
        u = x + self.rng.random() * (wd - uw)
        v = y + self.rng.random() * (ht - vh)
        return {"uv": [round(u, 2), round(v, 2)], "uv_size": [round(uw, 2), round(vh, 2)]}

    # --- geometry ------------------------------------------------------------------------------------------------------
    def box(self, bone, origin, size, sw, faces=None, inflate=0.0, rotation=None, pivot=None):
        """A cube; every face samples its own window of swatch `sw` (faces = {face: swatch | None to hide})."""
        faces = faces or {}
        uvd = {}
        for f, (a, b) in FACE_DIMS.items():
            fsw = faces.get(f, sw) if f in faces else sw
            uvd[f] = self.window(fsw, size[a], size[b])
        c = {"origin": [round(v, 3) for v in origin], "size": [round(v, 3) for v in size], "uv": uvd}
        if inflate:
            c["inflate"] = round(inflate, 3)
        if rotation and any(abs(r) > 1e-6 for r in rotation):
            c["rotation"] = [round(v, 3) for v in rotation]
            c["pivot"] = [round(v, 3) for v in (pivot or [origin[i] + size[i] / 2 for i in range(3)])]
        self.idx[bone]["cubes"].append(c)
        return c

    def json(self, bw=3.4, bh=3.8):
        return {"format_version": "1.12.0", "minecraft:geometry": [{
            "description": {"identifier": self.ident, "texture_width": SW, "texture_height": SW,
                            "visible_bounds_width": bw, "visible_bounds_height": bh, "visible_bounds_offset": [0, 1.4, 0]},
            "bones": [{k: v for k, v in b.items() if k != "cubes" or v} for b in self.bones]}]}


# ===========================================================================
# Hair
# ===========================================================================
class Hair:
    """Hair textures for the few smooth shapes that stick out of a head (ponytails, buns, pigtails, a braid) — the hair
    itself is painted on the skin (hair_skin). slab() is one block of hair: strands along its sides (fine darker
    partings, a few bright strands, cool shadows, warm light), a shine on top, a darker underside. Each face samples its
    own window of the swatches, at 2x density."""

    def __init__(self, g, base, shadow=None, light=None, bone="head", name="g_hair", seed=1):
        self.g = g
        self.base = base
        self.shadow = shadow or mix(mul(base, 0.6), (40, 40, 90), 0.12)
        self.light = light or mix(base, (255, 250, 240), 0.35)
        self.rng = random.Random(seed)
        self.b = g.bone(name, bone, BONE_PIVOT.get(bone, (0, 24, 0)))
        tag = name
        self.S = {k: f"{tag}_{k}" for k in ("side", "tip", "under", "top")}
        g.swatch(self.S["side"], 40, 40, self._strands(0.0))
        g.swatch(self.S["tip"], 24, 24, self._strands(0.35))
        g.swatch(self.S["under"], 24, 24, self._strands(-0.55))
        g.swatch(self.S["top"], 32, 32, self._top())

    def _tone(self, t):
        """t from -1 (deep shadow) through 0 (base) to +1 (highlight)."""
        return mix(self.base, self.shadow, -t) if t < 0 else mix(self.base, self.light, t)

    def _strands(self, bias):
        rng = random.Random(self.rng.random())
        cols = {}

        def col_shift(u):
            if u not in cols:
                r = rng.random()
                cols[u] = -0.45 if r < 0.16 else (0.32 if r > 0.9 else rng.uniform(-0.12, 0.12))
            return cols[u]

        def fn(u, v, wd, ht):
            t = bias + col_shift(u) + 0.18 - 0.36 * v / max(1, ht - 1) + rng.uniform(-0.04, 0.04)
            return self._tone(max(-1.0, min(1.0, t)))
        return fn

    def _top(self):
        rng = random.Random(self.rng.random())

        def fn(u, v, wd, ht):
            ring = math.exp(-((math.hypot(u - wd / 2, v - ht / 2) - wd * 0.28) ** 2) / 10)        # the shine ring
            t = 0.12 + 0.45 * ring + (-0.3 if (u * 5 + v * 3) % 11 == 0 else 0) + rng.uniform(-0.05, 0.05)
            return self._tone(max(-1.0, min(1.0, t)))
        return fn

    def slab(self, o, s, bone=None, rotation=None, pivot=None, tip=False, inflate=0.0, hide=()):
        """One block of hair: strands on the sides, the shine on top, shadow underneath."""
        S = self.S
        faces = {"up": S["top"] if not tip else S["tip"], "down": S["under"]}
        for f in hide:
            faces[f] = None
        return self.g.box(bone or self.b, o, s, S["tip"] if tip else S["side"], faces=faces, inflate=inflate, rotation=rotation, pivot=pivot)


# --- clothes and props in 3D ---------------------------------------------------------------------------------------------
def collar(g, col, y0=23.3, h=1.3, out=0.7, name="g_collar", button=None, open_front=False):
    """A high collar round the neck (inflated past the body), with an optional gold spiral button at the front."""
    g.plain(f"{name}_c", col, 16, 8, 0.03, 1.2, 0.98)
    b = g.bone(name, "body")
    g.box(b, (-4, y0, -2), (8, h, 4), f"{name}_c", faces={"up": None, "down": None, **({"north": None} if open_front else {})}, inflate=out)
    if button:
        g.swatch(f"{name}_b", 4, 4, lambda u, v, wd, ht: mul(button, 0.55) if (u, v) in ((1, 1), (2, 2)) else mul(button, 1.1 - 0.1 * v))
        g.box(b, (-0.75, y0 + 0.08, -2.0 - out - 0.32), (1.5, 1.15, 0.35), f"{name}_b")
    return b


def high_collar(g, col, y_top=27.4, name="g_mask", zipper=None):
    """A collar zipped right up over the mouth (Inumaki, Gojo's teacher coat): a ring round the lower head."""
    g.plain(f"{name}_c", col, 16, 16, 0.03, 1.16, 0.92)
    b = g.bone(name, "body")
    g.box(b, (-4.65, 23.6, -4.65), (9.3, y_top - 23.6, 9.3), f"{name}_c", faces={"up": None, "down": None})
    if zipper:
        g.swatch(f"{name}_z", 2, 8, lambda u, v, wd, ht: mul(zipper, 1.2 if v % 2 else 0.8))
        g.box(b, (-0.3, 23.8, -4.75), (0.6, y_top - 24.2, 0.15), f"{name}_z")
    return b


def hem(g, col, name="g_hem", y=12.0, h=1.8, out=0.5):
    """A jacket's lower edge flaring out a little over the hips."""
    g.plain(f"{name}_c", col, 16, 8, 0.03, 0.98, 0.8)
    b = g.bone(name, "body")
    g.box(b, (-4, y, -2), (8, h, 4), f"{name}_c", faces={"up": None, "down": None}, inflate=out)
    return b


def cuffs(g, col, name="g_cuffs", y=14.0, h=1.6, gold=None):
    g.plain(f"{name}_c", col, 8, 8, 0.03, 1.08, 0.86)
    for arm, x in (("rightArm", -8), ("leftArm", 4)):
        b = g.bone(f"{name}_{arm}", arm)
        g.box(b, (x, y, -2), (4, h, 4), f"{name}_c", faces={"up": None, "down": None}, inflate=0.32)


def soles(g, sole=(238, 236, 230), toe=None, name="g_soles"):
    """Sneaker soles: a thin plate under each foot, a bit longer at the toe."""
    g.plain(f"{name}_s", sole, 8, 8, 0.02, 1.0, 0.86)
    if toe:
        g.plain(f"{name}_t", toe, 8, 8, 0.02, 1.08, 0.9)
    for leg, x in (("rightLeg", -3.9), ("leftLeg", -0.1)):
        b = g.bone(f"{name}_{leg}", leg)
        g.box(b, (x - 0.15, 0, -2.5), (4.3, 0.8, 4.7), f"{name}_s", faces={"up": None, "north": f"{name}_t" if toe else f"{name}_s"})


def muscles(g, col, name="g_bulk", upper=True):
    """Bulk on the arms (shoulders and biceps) for the big ones."""
    g.plain(f"{name}_m", col, 8, 12, 0.02, 1.06, 0.9)
    for arm, x in (("rightArm", -8), ("leftArm", 4)):
        b = g.bone(f"{name}_{arm}", arm)
        g.box(b, (x, 18.0 if upper else 14, -2), (4, 6, 4), f"{name}_m", faces={"down": None}, inflate=0.45)


SPINE = (0, 18, 2.6)


def on_back(g, parts, angle=-38, name="g_back"):
    """Things strapped diagonally across the back: parts = [(origin, size, swatch)] measured from the spine."""
    b = g.bone(name, "body", SPINE, (0, 0, angle))
    for o, sz, sw in parts:
        g.box(b, (o[0] + SPINE[0], o[1] + SPINE[1], o[2] + SPINE[2] + 0.4), sz, sw)
    return b


def glasses(g, frame, lens=None, y=27.0, h=2.2, name="g_glasses", wide=True, round_=False):
    """Glasses: a frame in front of the eyes, arms over the ears; lens=None leaves the lenses see-through."""
    def fn(u, v, wd, ht):
        inner = 1 <= v <= ht - 2 and ((2 <= u <= 6) or (9 <= u <= 13))
        if round_ and inner and (v in (1, ht - 2)) and u in (2, 6, 9, 13):
            return frame
        if inner:
            return lens
        if 7 <= u <= 8 and v >= 2:
            return None                                                              # the bridge sits high
        return frame
    g.swatch(f"{name}_f", 16, 6, fn)
    g.plain(f"{name}_a", frame, 4, 4, 0.02, 1.0, 0.9)
    b = g.bone(name, "head")
    g.box(b, (-4.1 if wide else -3.6, y, -4.62), (8.2 if wide else 7.2, h, 0.28), f"{name}_f",
          faces={k: (g.sw[f"{name}_f"]) for k in ("north", "south")})
    for x in (-4.55, 4.25):
        g.box(b, (x, y + h - 0.6, -4.5), (0.3, 0.45, 4.6), f"{name}_a")
    return b


def coat_skirt(g, col, y0=5.0, name="g_skirt", out=0.55, split=False):
    """A long coat or robe below the waist (it doesn't swing with the legs, like a real coat)."""
    g.plain(f"{name}_c", col, 16, 24, 0.03, 0.98, 0.78)
    b = g.bone(name, "body")
    if split:
        for sgn in (-1, 1):
            g.box(b, ((-4 if sgn < 0 else 0.15), y0, -2), (3.85, 12 - y0, 4), f"{name}_c", faces={"up": None, "down": None}, inflate=out)
    else:
        g.box(b, (-4, y0, -2), (8, 12 - y0, 4), f"{name}_c", faces={"up": None, "down": None}, inflate=out)
    return b


def wide_legs(g, col, name="g_wide", y0=1.5, out=0.5):
    """Hakama / baggy trousers: a looser layer round each leg."""
    g.plain(f"{name}_c", col, 8, 24, 0.03, 1.02, 0.82)
    for leg, x in (("rightLeg", -3.9), ("leftLeg", -0.1)):
        b = g.bone(f"{name}_{leg}", leg)
        g.box(b, (x, y0, -2), (4, 12 - y0, 4), f"{name}_c", faces={"up": None, "down": None}, inflate=out)


def lapels(g, col, name="g_lapels"):
    """An open jacket's lapels: two plates forming a V down the chest."""
    g.plain(f"{name}_c", col, 4, 16, 0.02, 1.14, 0.98)
    b = g.bone(name, "body")
    for sgn in (-1, 1):
        x = sgn * 1.7
        g.box(b, (x - 0.85, 17.0, -2.6), (1.7, 6.9, 0.4), f"{name}_c", rotation=[0, 0, sgn * 14], pivot=(x, 23.8, -2.4))


def earrings(g, col, big=False, name="g_earrings", y=26.0):
    g.plain(f"{name}_c", col, 4, 4, 0.02, 1.2, 0.8)
    b = g.bone(name, "head")
    s_ = 1.4 if big else 0.6
    for x in (-4.4 - s_ / 2, 4.1):
        g.box(b, (x, y, -0.5), (s_ / 2 + 0.3, s_, s_), f"{name}_c")
    return b
