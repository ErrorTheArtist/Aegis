#!/usr/bin/env python3
"""The Jujutsu Kaisen cast as NPCs: a painted 64x64 skin (both layers) plus a 3D gear model for each character (hair,
collars, hoods, extra arms, weapons on the back...), all drawn on ONE entity, jjk:sorcerer, whose int property
jjk:npc picks the character (its position in ROSTER).

  Jujutsu High (allies): Satoru Gojo, Yuji Itadori, Megumi Fushiguro, Nobara Kugisaki, Maki Zen'in, Toge Inumaki, Panda,
    Kento Nanami, Mei Mei, Aoi Todo, Yuta Okkotsu
  Villains (bosses): Ryomen Sukuna (four arms), Toji Fushiguro, Suguru Geto (Kenjaku), Mahito, Choso, Jogo

Writes: textures/entity/jjk/sorcerer/<id>.png and gear_<id>.png, models/entity/sorcerer_gear_<id>.geo.json, the client
and BP entity, render controllers, the gear sway animation, names, and behavior_pack/scripts/roster_ids.js (the
index of every character, read by sorcerers.js — never edit it by hand).

Same conventions as every model here: 16 px = 1 block, the front is -Z, the character's right is -X. Gear bones are
named like the body's (head, body, rightArm...), so the walk, look and attack animations move the gear too.

  python3 tools/gen_sorcerers.py                         # build everything
  python3 tools/gen_sorcerers.py --preview out.png       # front and back of everyone (needs ../shinobi-addon/tools)
  python3 tools/gen_sorcerers.py --preview out.png --only gojo,sukuna
"""
import argparse
import json
import math
import random
import sys
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
BP, RP = ROOT / "behavior_pack", ROOT / "resource_pack"
SK = RP / "textures" / "entity" / "jjk" / "sorcerer"


def w(path, obj):
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(obj, indent=2, ensure_ascii=False) + "\n")


def mul(c, k):
    return tuple(max(0, min(255, int(round(v * k)))) for v in c[:3])


def mix(a, b, u):
    return tuple(int(round(a[i] + (b[i] - a[i]) * u)) for i in range(3))


# ===========================================================================
# Skins (64x64, both layers) — the player skin layout
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


def palette(c):
    S = c["skin"]
    H = c.get("hair", (30, 30, 36))
    return {"H": H, "h": c.get("hair_h", mul(H, 1.3)), "d": c.get("hair_d", mul(H, 0.7)), "S": S, "s": c.get("skin_d", mul(S, 0.86)),
            "E": c.get("eye", (244, 240, 236)), "I": c.get("iris", (60, 50, 44)), "i": c.get("iris2", c.get("iris", (60, 50, 44))),
            "P": (18, 16, 22), "K": c.get("brow", mul(H, 0.8)), "B": c.get("black", (22, 20, 26)), "X": c.get("mark", (30, 22, 26)),
            "M": c.get("mouth", (120, 64, 60)), "L": c.get("lip", (196, 110, 112)), "T": (240, 236, 226), "G": c.get("frame", (30, 30, 36)),
            "g": c.get("lens", (150, 200, 190)), "C": c.get("collar", c.get("jacket", (34, 36, 58))), "c": mul(c.get("collar", c.get("jacket", (34, 36, 58))), 0.8),
            "W": c.get("white", (236, 236, 240)), "O": c.get("scar", mix(S, (150, 70, 70), 0.5)), "R": c.get("red", (190, 40, 50)),
            "Y": c.get("gold", (220, 180, 70)), "Q": (60, 20, 24)}


def head(s, c, front, side, back, front1=None, side1=None, back1=None, top_streaks=True):
    """The head: skin everywhere, the hair colour on top, then pixel-art rows for each face (side rows run back -> front)."""
    pal = palette(c)
    s.paint("head", ("top",), lambda f, u, v, wd, ht: mul(c.get("top", pal["H"]), 1 + s.rng.uniform(-0.1, 0.14)))
    s.paint("head", ("bottom",), lambda f, u, v, wd, ht: pal["s"])
    s.paint("head", SIDES, lambda f, u, v, wd, ht: s.cloth(pal["S"], f, u, v, wd, ht, 0.02))
    s.rows("head", "front", front, pal)
    s.rows("head", "right", side, pal)
    s.rows("head", "left", [r[::-1] for r in side], pal)
    s.rows("head", "back", back, pal)
    for rows_, faces in ((front1, ("front",)), (side1, ("right", "left")), (back1, ("back",))):
        if rows_:
            for fc in faces:
                s.rows("head", fc, rows_ if fc != "left" else [r[::-1] for r in rows_], pal, layer=1)
    if top_streaks:
        s.paint("head", ("top",), lambda f, u, v, wd, ht: mul(c.get("top", pal["H"]), 1.2) if (u * 5 + v * 3) % 6 == 0 else None, layer=1)


def outfit(s, c, top, sleeve, pants, shoes, hands=None, top_fn=None, arm_fn=None, leg_fn=None, sleeve_to=10, shoe_rows=1):
    """Body, arms and legs in plain shaded cloth; *_fn(face, u, v, w, h) may return a colour to override a pixel."""
    S = c["skin"]
    hands = hands or S

    def body(f, u, v, wd, ht):
        o = top_fn(f, u, v, wd, ht) if top_fn else None
        return o if o is not None else s.cloth(top, f, u, v, wd, ht, 0.04)
    s.paint("body", SIDES, body)
    s.paint("body", ("top",), lambda f, u, v, wd, ht: mul(top, 1.05))
    s.paint("body", ("bottom",), lambda f, u, v, wd, ht: mul(top, 0.85))
    for arm in ("rarm", "larm"):
        def ap(f, u, v, wd, ht, arm=arm):
            o = arm_fn(arm, f, u, v, wd, ht) if arm_fn else None
            if o is not None:
                return o
            return s.cloth(sleeve, f, u, v, wd, ht) if v < sleeve_to else s.cloth(hands, f, u, v, wd, ht, 0.02)
        s.paint(arm, SIDES, ap)
        s.paint(arm, ("top",), lambda f, u, v, wd, ht: sleeve)
        s.paint(arm, ("bottom",), lambda f, u, v, wd, ht: mul(hands, 0.86))
    for leg in ("rleg", "lleg"):
        def lp(f, u, v, wd, ht, leg=leg):
            o = leg_fn(leg, f, u, v, wd, ht) if leg_fn else None
            if o is not None:
                return o
            return s.cloth(pants, f, u, v, wd, ht) if v < 12 - shoe_rows else (mul(shoes, 1.15) if v == 12 - shoe_rows and f == "front" else shoes)
        s.paint(leg, SIDES, lp)
        s.paint(leg, ("top",), lambda f, u, v, wd, ht: pants)
        s.paint(leg, ("bottom",), lambda f, u, v, wd, ht: shoes)


def jjh_top(c, buttons=True, collar_rows=2, seam=3):
    """The Jujutsu High uniform: a dark high-collared jacket, closed down one side with gold spiral buttons."""
    J = c["jacket"]

    def fn(f, u, v, wd, ht):
        if v < collar_rows:
            return mul(J, 1.18 if v == 0 else 1.08)
        if f == "front":
            if u == seam:
                return mul(J, 0.72)
            if buttons and u == seam + 1 and v in (3, 6, 9):
                return c.get("gold", (222, 182, 76))
        if f == "back" and u in (3, 4) and v == 11:
            return mul(J, 0.8)
        return None
    return fn


# ===========================================================================
# Gear (a second geometry over the skin) and its texture
# ===========================================================================
GW = 64
NONE = (60, 60, 4, 4)    # transparent corner of every gear texture


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


BONE_PIVOT = {"head": (0, 24, 0), "body": (0, 24, 0), "rightArm": (-5, 22, 0), "leftArm": (5, 22, 0), "rightLeg": (-1.9, 12, 0),
              "leftLeg": (1.9, 12, 0)}


def spikes(g, col, items, parent="head", name="g_hair", shade=(1.3, 0.75)):
    """Spiky hair: items = [(origin, size, rotation)], each spike turned about its own base."""
    r = g.region(6, 8, lambda u, v, wd, ht: mul(col, shade[0] + (shade[1] - shade[0]) * v / ht - (0.06 if u % 3 == 0 else 0)))
    b = g.bone(name, parent, BONE_PIVOT[parent] if parent in BONE_PIVOT else (0, 32, 0))
    for o, sz, rot in items:
        g.cube(b, o, sz, uv(rest=r), rotation=rot, pivot=(o[0] + sz[0] / 2, o[1], o[2] + sz[2] / 2))
    return b


def hair_cap(g, col, y0=29.0, inflate=0.55, back_to=24.5, name="g_hair"):
    """A shell of hair over the top and back of the head (the hair's volume), open at the face."""
    top = g.region(8, 8, lambda u, v, wd, ht: mul(col, 1.15 + (0.08 if (u + v) % 3 == 0 else 0)))
    side = g.region(8, 6, lambda u, v, wd, ht: mul(col, 1.1 - 0.3 * v / ht - (0.06 if u % 2 else 0)))
    b = g.bone(name, "head", (0, 24, 0))
    g.cube(b, (-4, y0, -4), (8, 32 - y0, 8), uv(up=top, east=side, west=side, south=side, north="none", down="none"), inflate=inflate)
    if back_to < y0:
        g.cube(b, (-4, back_to, 0.6), (8, y0 - back_to, 3.4), uv(south=side, east=side, west=side, rest="none"), inflate=inflate)
    return b


def collar(g, col, y0=24.0, h=1.6, inflate=0.75, name="g_collar"):
    """A high collar hugging the jaw."""
    r = g.region(8, 2, lambda u, v, wd, ht: mul(col, 1.18 if v == 0 else 1.0))
    b = g.bone(name, "body", (0, 24, 0))
    g.cube(b, (-4, y0, -4), (8, h, 8), ring(r), inflate=inflate)
    return b


SPINE = (0, 18, 2.6)


def on_back(g, parts, angle=-38, name="g_back"):
    """Things strapped diagonally across the back: parts = [(origin, size, region)] measured from the spine (cube
    origins in a geometry are absolute model coordinates, so they're shifted onto the back here)."""
    b = g.bone(name, "body", SPINE, (0, 0, angle))
    for o, sz, r in parts:
        g.cube(b, (o[0] + SPINE[0], o[1] + SPINE[1], o[2] + SPINE[2] + 0.4), sz, uv(rest=r))
    return b


# ===========================================================================
# The cast
# ===========================================================================
NAVY = (34, 37, 58)


def gojo():
    c = dict(skin=(238, 214, 198), hair=(236, 240, 248), hair_h=(255, 255, 255), hair_d=(196, 206, 226), jacket=(30, 32, 52),
             mouth=(176, 112, 108), black=(16, 16, 20))
    s = Skin(1)
    head(s, c, ["hHHhHHHh",
                "HhHHHhHH",
                "HSHSSHSH",
                "BBBBBBBB",
                "BBBBBBBB",
                "SSSSSSSS",
                "SSSMMSSS",
                "SSSSSSSS"],
         ["HHHHHHHH",
          "HHHHHHHH",
          "HHHHSSSS",
          "BBBBBBBB",
          "BBBBBBBB",
          "HHSSSSSS",
          "HSSSSSSS",
          "SSSSSSSS"],
         ["HHhHHHhH", "HHHHHHHH", "HhHHHHhH", "BBBBBBBB", "BBBBBBBB", "HHHHHHHH", "HHHhHHHH", "SHHHHHHS"],
         front1=["H.h..h.H", ".H....H.", "........", "B......B", "B......B"])
    J = c["jacket"]
    outfit(s, c, J, J, (26, 28, 44), (18, 18, 22), top_fn=jjh_top(c, buttons=False), sleeve_to=10)
    # the long coat flares over the thighs
    for leg in ("rleg", "lleg"):
        s.paint(leg, SIDES, lambda f, u, v, wd, ht: s.cloth(mul(J, 0.96), f, u, v, wd, ht) if v < 6 else None, layer=1)
    g = Gear("geometry.jjk.sorcerer_gear_gojo")
    hair_cap(g, c["hair"], y0=30.2, inflate=0.6, back_to=26)
    sp = []
    for i, (x, z, ln, rx, rz) in enumerate(((-3, -3, 4.5, 28, -22), (-0.6, -3.4, 5.2, 34, 4), (2, -3, 4.6, 26, 24), (-3.4, 0, 4.2, -6, -34),
                                            (3.0, 0, 4.4, -8, 34), (-1, 0.5, 5.5, -18, -8), (1.2, 1.5, 5.0, -24, 12), (-2.4, 2.6, 4.0, -36, -18),
                                            (2.2, 2.8, 4.0, -38, 20), (0, -1.5, 5.8, 10, 0))):
        sp.append(((x - 1.1, 31.2, z - 1.1), (2.2, ln, 2.2), [rx, 0, rz]))
    spikes(g, c["hair"], sp, shade=(1.08, 0.92))
    collar(g, J, h=1.7)
    return s.img, g


def sukuna():
    c = dict(skin=(232, 196, 178), hair=(232, 140, 150), hair_h=(250, 180, 186), hair_d=(150, 80, 96), iris=(200, 30, 40),
             mark=(26, 18, 22), mouth=(70, 16, 20), white=(238, 234, 226), black=(24, 22, 26))
    s = Skin(2)
    head(s, c, ["HhHHHHhH",
                "HSXXXXSH",
                "SKKSSKKS",
                "SEISSIES",
                "SXXSSXXS",
                "SIESSEIS",
                "SSMTTMSS",
                "SSSMMSSS"],
         ["HHHHHHHH",
          "HHHHHXSS",
          "HHHHSSSS",
          "HHHSSSXS",
          "HHSSSSXS",
          "HSSSSSSS",
          "SSSSSSSS",
          "SSSSSSSS"],
         ["HHHhHHHH", "HHHHHHhH", "HhHHHHHH", "HHHHHHHH", "HHHHhHHH", "dHHHHHHd", "SdHHHHdS", "SSSSSSSS"],
         front1=["h.H..H.h"])
    W, B = c["white"], (30, 28, 32)

    def kimono(f, u, v, wd, ht):
        if f == "front" and v < 5 and abs(u - 3.5) < 2.2 - v * 0.45:
            return c["skin"]                                   # the V of the collar
        if f == "front" and ((u == 1 and v < 7) or (u == 6 and v < 7)):
            return mul(W, 0.8)                                 # lapel edges
        if v in (7, 8):
            return B if v == 7 else mul(B, 1.3)                # the obi
        return None

    def tattoo_arm(arm, f, u, v, wd, ht):
        if v < 4:
            return s.cloth(W, f, u, v, wd, ht)                 # short sleeves
        if v in (6, 9):
            return c["mark"]                                   # black bands round the forearms
        return None
    outfit(s, c, W, W, (34, 32, 38), (40, 34, 30), top_fn=kimono, arm_fn=tattoo_arm, sleeve_to=4)
    for leg in ("rleg", "lleg"):                               # wide hakama
        s.paint(leg, SIDES, lambda f, u, v, wd, ht: s.cloth((40, 38, 46), f, u, v, wd, ht) if v < 10 else None, layer=1)
    g = Gear("geometry.jjk.sorcerer_gear_sukuna")
    hair_cap(g, c["hair"], y0=30.5, inflate=0.5, back_to=27)
    sp = [((x - 1, 30.8, z - 1), (2, ln, 2.2), [rx, 0, rz]) for x, z, ln, rx, rz in
          ((-2.6, -2.8, 4.2, -48, -14), (0, -3.2, 4.6, -52, 0), (2.6, -2.8, 4.2, -48, 14), (-3.2, 0, 4.0, -60, -26),
           (3.2, 0, 4.0, -60, 26), (-1.4, 1.5, 3.8, -66, -8), (1.4, 1.5, 3.8, -66, 8))]
    spikes(g, c["hair"], sp)
    # a dark scarf round the neck
    scarf = g.flat((36, 30, 36), 8, 2)
    sc = g.bone("g_scarf", "body", (0, 24, 0))
    g.cube(sc, (-4, 22.4, -2), (8, 1.8, 4), ring(scarf), inflate=0.7)
    # the second pair of arms, lower on the torso, held out
    skin = g.region(4, 12, lambda u, v, wd, ht: c["mark"] if v in (5, 8) else mul(c["skin"], 1.02 - 0.12 * v / ht))
    for side, name in ((-1, "g_arm3"), (1, "g_arm4")):
        b = g.bone(name, "body", (side * 4.4, 17, -0.5), (-50, side * 10, side * 28))
        g.cube(b, (side * 4.4 - 1.5, 7, -2), (3, 10, 3), uv(rest=skin))
    return s.img, g


def yuji():
    c = dict(skin=(232, 196, 170), hair=(232, 146, 156), hair_h=(248, 178, 186), hair_d=(70, 46, 44), iris=(156, 96, 50),
             jacket=NAVY, red=(196, 44, 52))
    s = Skin(3)
    head(s, c, ["HhHHhHHh",
                "hHHHHHHH",
                "dSKSSKSd",
                "dEISSIEd",
                "SSSSSSSS",
                "SSSSSSSS",
                "SSSMMSSS",
                "SSSSSSSS"],
         ["HHHHHHHH",
          "dddddHHS",
          "dddddSSS",
          "ddddSSSS",
          "dddSSSSS",
          "ddSSSSSS",
          "SSSSSSSS",
          "SSSSSSSS"],
         ["HHhHHHhH", "HHHHHHHH", "dddddddd", "dddddddd", "dddddddd", "dddddddd", "SddddddS", "SSSSSSSS"])
    J = c["jacket"]

    def top(f, u, v, wd, ht):
        if v < 2:
            return c["red"] if v == 0 else mul(c["red"], 0.8)    # the red hoodie collar
        return jjh_top(c, collar_rows=0)(f, u, v, wd, ht)
    outfit(s, c, J, J, (30, 32, 50), (200, 46, 52), top_fn=top,
           leg_fn=lambda leg, f, u, v, wd, ht: (236, 236, 236) if v == 10 else None, shoe_rows=2)
    g = Gear("geometry.jjk.sorcerer_gear_yuji")
    sp = [((x - 0.9, 31.4, z - 0.9), (1.8, ln, 1.8), [rx, 0, rz]) for x, z, ln, rx, rz in
          ((-2.6, -2.6, 2.4, 30, -14), (0, -3, 2.8, 36, 0), (2.6, -2.6, 2.4, 30, 14), (-1.4, -0.4, 2.6, -10, -10),
           (1.4, -0.4, 2.6, -10, 10), (0, 1.6, 2.4, -26, 0))]
    spikes(g, c["hair"], sp)
    hood = g.region(8, 6, lambda u, v, wd, ht: mul(c["red"], 1.1 - 0.3 * v / ht - (0.08 if u in (0, wd - 1) else 0)))
    hb = g.bone("g_hood", "body", (0, 24, 0))
    g.cube(hb, (-3.6, 19.4, 2.0), (7.2, 4.8, 1.6), uv(rest=hood))             # the hood hangs down the back
    g.cube(hb, (-4, 23.2, -2), (8, 1.3, 4), ring(hood), inflate=0.65)          # and rings the neck
    return s.img, g


def megumi():
    c = dict(skin=(228, 202, 186), hair=(26, 28, 38), hair_h=(56, 62, 84), iris=(40, 64, 96), jacket=NAVY)
    s = Skin(4)
    head(s, c, ["HHHHHHHH",
                "HHhHHhHH",
                "HKKSSKKH",
                "SEISSIES",
                "SSSSSSSS",
                "SSSSSSSS",
                "SSSMMSSS",
                "SSSSSSSS"],
         ["HHHHHHHH", "HHHHHHHH", "HHHHHHSS", "HHHHSSSS", "HHHSSSSS", "HHSSSSSS", "HSSSSSSS", "SSSSSSSS"],
         ["HHHHHHHH", "HHhHHHHH", "HHHHHhHH", "HHHHHHHH", "HhHHHHHH", "HHHHHHHH", "SHHHHHHS", "SSSSSSSS"])
    outfit(s, c, c["jacket"], c["jacket"], (30, 32, 50), (18, 18, 22), top_fn=jjh_top(c))
    g = Gear("geometry.jjk.sorcerer_gear_megumi")
    hair_cap(g, c["hair"], y0=29.5, inflate=0.6, back_to=25.5)
    sp = []
    rnd = random.Random(4)
    for x, z, ln, rx, rz in ((-3, -3, 4.0, 26, -26), (-1, -3.4, 4.6, 32, -6), (1.2, -3.4, 4.6, 32, 8), (3, -3, 4.0, 26, 26),
                             (-3.4, -0.6, 4.4, -2, -40), (3.4, -0.6, 4.4, -2, 40), (-1.8, 0.4, 5.4, -14, -16), (0.4, 0.2, 6.0, -10, 4),
                             (2.2, 0.6, 5.2, -16, 18), (-2.6, 2.6, 4.6, -40, -24), (0, 2.8, 5.0, -44, 0), (2.6, 2.6, 4.6, -40, 24)):
        sp.append(((x - 1.15, 31.0, z - 1.15), (2.3, ln + rnd.uniform(-0.4, 0.4), 2.3), [rx, 0, rz]))
    spikes(g, c["hair"], sp)
    collar(g, c["jacket"])
    return s.img, g


def nobara():
    c = dict(skin=(238, 208, 188), hair=(190, 104, 50), hair_h=(222, 140, 76), iris=(136, 84, 46), jacket=NAVY, lip=(206, 112, 120))
    s = Skin(5)
    head(s, c, ["HHHHHHHH",
                "HHhHHHHH",
                "HSKSSKSH",
                "HEISSIEH",
                "HSSSSSSH",
                "HSSSSSSH",
                "HSSLLSSH",
                "SSSSSSSS"],
         ["HHHHHHHH", "HHHHHHHH", "HHHHHHHS", "HHHHHHSS", "HHHHHSSS", "HHHHHSSS", "HHHHHSSS", "SSSSSSSS"],
         ["HHHHHHHH", "HHhHHHHH", "HHHHHhHH", "HHHHHHHH", "HHHHHHHH", "HhHHHHhH", "HHHHHHHH", "SSSSSSSS"])
    J = c["jacket"]

    def top(f, u, v, wd, ht):
        if v == 10:
            return (90, 60, 40) if not (f == "front" and u in (3, 4)) else (200, 170, 90)   # belt and buckle
        return jjh_top(c, buttons=True)(f, u, v, wd, ht)
    tights = (30, 28, 34)
    outfit(s, c, J, J, tights, (110, 70, 44), top_fn=top, shoe_rows=3)
    for leg in ("rleg", "lleg"):                                                # the skirt
        s.paint(leg, SIDES, lambda f, u, v, wd, ht: s.cloth(mul(J, 1.05), f, u, v, wd, ht) if v < 4 else None, layer=1)
    g = Gear("geometry.jjk.sorcerer_gear_nobara")
    bob = g.region(8, 8, lambda u, v, wd, ht: mul(c["hair"], 1.18 - 0.3 * v / ht - (0.06 if u % 3 == 0 else 0)))
    hb = g.bone("g_hair", "head", (0, 24, 0))
    g.cube(hb, (-4, 29.6, -4), (8, 2.4, 8), uv(up=bob, east=bob, west=bob, south=bob, rest="none"), inflate=0.6)
    for x in (-4.7, 3.9):                                                       # the bob falls to the chin
        g.cube(hb, (x, 25.2, -3.4), (0.8, 4.6, 7.2), uv(rest=bob))
    g.cube(hb, (-4.2, 25.0, 3.7), (8.4, 4.8, 0.8), uv(rest=bob))
    g.cube(hb, (-3.8, 30.3, -4.7), (4.6, 1.4, 0.7), uv(rest=bob))              # side-swept fringe
    handle = g.flat((120, 80, 46), 2, 6)
    hammer = g.flat((90, 92, 104), 4, 3)
    hm = g.bone("g_hammer", "body", (0, 24, 0))
    g.cube(hm, (-5.4, 11.6, -1.0), (1.0, 4.2, 1.0), uv(rest=handle))
    g.cube(hm, (-6.0, 15.5, -1.6), (2.2, 1.6, 2.2), uv(rest=hammer))
    return s.img, g


def maki():
    c = dict(skin=(236, 210, 190), hair=(40, 70, 52), hair_h=(66, 104, 78), iris=(150, 120, 60), jacket=NAVY, frame=(24, 24, 28),
             lens=(170, 190, 196))
    s = Skin(6)
    head(s, c, ["HHHHHHHH",
                "HhHHHHhH",
                "SKKSSKKS",
                "GgIGGIgG",
                "SGGSSGGS",
                "SSSSSSSS",
                "SSSMMSSS",
                "SSSSSSSS"],
         ["HHHHHHHH", "HHHHHHHH", "HHHHHHSS", "HHHGGGGG", "HHHSSSSS", "HHSSSSSS", "HSSSSSSS", "SSSSSSSS"],
         ["HHHHHHHH", "HHhHHHHH", "HHHHHHHH", "HHHhhHHH", "HHHHHHHH", "HHHHHHHH", "HHHHHHHH", "SSSSSSSS"])
    outfit(s, c, c["jacket"], c["jacket"], (30, 32, 50), (20, 20, 24), top_fn=jjh_top(c))
    g = Gear("geometry.jjk.sorcerer_gear_maki")
    hair_cap(g, c["hair"], y0=30.0, inflate=0.5, back_to=30)
    pt = g.region(4, 8, lambda u, v, wd, ht: mul(c["hair"], 1.2 - 0.4 * v / ht - (0.08 if u % 2 else 0)))
    tail = g.bone("g_tail", "head", (0, 30.5, 4.2), (-28, 0, 0))               # a high ponytail
    g.cube(tail, (-1.2, 23.5, 4.0), (2.4, 7.5, 2.0), uv(rest=pt))
    g.cube(tail, (-0.8, 22.0, 4.2), (1.6, 1.6, 1.6), uv(rest=pt))
    tie = g.flat((180, 40, 50), 2, 2)
    g.cube(tail, (-1.4, 30.0, 3.8), (2.8, 1.0, 2.4), uv(rest=tie))
    shaft = g.flat((60, 44, 36), 2, 8)
    blade = g.region(2, 6, lambda u, v, wd, ht: (220, 226, 236) if u == 0 else (170, 176, 190))
    on_back(g, [((-0.5, -6, -0.5), (1, 22, 1), shaft), ((-0.75, 16, -0.6), (1.5, 6, 1.2), blade)], angle=-34)
    return s.img, g


def inumaki():
    c = dict(skin=(238, 216, 200), hair=(226, 218, 196), hair_h=(248, 244, 228), iris=(120, 90, 170), jacket=NAVY)
    s = Skin(7)
    head(s, c, ["HhHHHHhH",
                "HHHHhHHH",
                "HSKSSKSH",
                "SEISSIES",
                "SSSSSSSS",
                "SSSSSSSS",
                "SSSSSSSS",
                "SSSSSSSS"],
         ["HHHHHHHH", "HHHHHHHH", "HHHHHHSS", "HHHHSSSS", "HHHSSSSS", "HHSSSSSS", "HSSSSSSS", "SSSSSSSS"],
         ["HHhHHHHH", "HHHHHhHH", "HHHHHHHH", "HHHhHHHH", "HHHHHHHH", "HHHHHHHH", "SHHHHHHS", "SSSSSSSS"],
         front1=["H.hH.H.h", ".h....H."])
    outfit(s, c, c["jacket"], c["jacket"], (30, 32, 50), (20, 20, 24), top_fn=jjh_top(c, buttons=False))
    g = Gear("geometry.jjk.sorcerer_gear_inumaki")
    hair_cap(g, c["hair"], y0=29.6, inflate=0.6, back_to=26)
    zip_ = g.region(8, 4, lambda u, v, wd, ht: (200, 190, 120) if (u == 4 and v > 0) else mul(c["jacket"], 1.15 - 0.08 * v))
    hc = g.bone("g_collar", "body", (0, 24, 0))
    g.cube(hc, (-4, 24, -4), (8, 3.6, 8), ring(zip_), inflate=0.75)            # the zipped collar over the mouth
    return s.img, g


def panda():
    c = dict(skin=(236, 236, 232), hair=(236, 236, 232), black=(30, 30, 34), iris=(30, 30, 34), mouth=(40, 30, 30))
    s = Skin(8)
    head(s, c, ["WWWWWWWW",
                "WWWWWWWW",
                "WBBWWBBW",
                "WBEWWEBW",
                "WBBWWBBW",
                "WWWWWWWW",
                "WWWBBWWW",
                "WWWWWWWW"],
         ["WWWWWWWW"] * 8, ["WWWWWWWW"] * 8, top_streaks=False)
    B, Wt = c["black"], c["skin"]

    def body(f, u, v, wd, ht):
        if v < 4:
            return s.cloth(B, f, u, v, wd, ht, 0.03)           # a black band over the shoulders
        return s.cloth(Wt, f, u, v, wd, ht, 0.03)
    outfit(s, c, Wt, B, B, B, hands=B, top_fn=body, sleeve_to=12, shoe_rows=1)
    g = Gear("geometry.jjk.sorcerer_gear_panda")
    ear = g.flat(B, 3, 3)
    snout = g.region(4, 3, lambda u, v, wd, ht: (40, 36, 38) if v == 0 and u in (1, 2) else (226, 226, 222))
    hb = g.bone("g_ears", "head", (0, 24, 0))
    for x in (-4.6, 2.2):
        g.cube(hb, (x, 31.0, -1.2), (2.4, 2.4, 1.4), uv(rest=ear))
    g.cube(hb, (-1.6, 25.0, -5.2), (3.2, 2.2, 1.4), uv(rest=snout))
    return s.img, g


def nanami():
    c = dict(skin=(236, 206, 180), hair=(222, 192, 112), hair_h=(244, 220, 150), iris=(60, 70, 60), frame=(40, 60, 50), lens=(120, 170, 130))
    s = Skin(9)
    head(s, c, ["HHHHHHHH",
                "HHhhHHHH",
                "SHHSSKKS",
                "GgggGgggG"[:8],
                "SGGSSGGS",
                "SSSSSSSS",
                "SSSMMSSS",
                "SSSSSSSS"],
         ["HHHHHHHH", "HHHHHHHH", "HHHHHHSS", "HHHGGGGG", "HHHSSSSS", "HHSSSSSS", "HSSSSSSS", "SSSSSSSS"],
         ["HHHHHHHH", "HHHHhHHH", "HHHHHHHH", "HGGGGGGH", "HHHHHHHH", "HHHHHHHH", "SHHHHHHS", "SSSSSSSS"])
    suit, shirt = (204, 186, 146), (64, 74, 96)

    def top(f, u, v, wd, ht):
        if f == "front":
            if u in (3, 4) and v < 9:
                if v == 0:
                    return shirt
                return (214, 170, 60) if (u + v) % 3 else (120, 80, 30)   # the leopard tie
            if u in (2, 5) and v < 6:
                return shirt
        return None
    outfit(s, c, suit, suit, mul(suit, 0.9), (90, 60, 40), top_fn=top)
    g = Gear("geometry.jjk.sorcerer_gear_nanami")
    hair_cap(g, c["hair"], y0=29.8, inflate=0.5, back_to=27)
    sw = g.region(4, 6, lambda u, v, wd, ht: (230, 230, 232) if (u + v * 2) % 4 else (40, 40, 50))   # polka-dot wrap
    on_back(g, [((-0.9, -4, -0.6), (1.8, 18, 1.2), sw)], angle=-40)
    gl = g.flat(c["frame"], 2, 2)
    gb = g.bone("g_glasses", "head", (0, 24, 0))
    g.cube(gb, (-4.2, 28.3, -4.35), (8.4, 1.3, 0.3), uv(rest=gl))
    return s.img, g


def mei_mei():
    c = dict(skin=(242, 222, 210), hair=(222, 222, 232), hair_h=(250, 250, 255), iris=(100, 90, 140), lip=(200, 100, 120))
    s = Skin(10)
    head(s, c, ["HHHHHHHH",
                "HHhHHHhH",
                "HHHHHHHH",
                "HSKSSKSH",
                "SSSSSSSS",
                "SSSSSSSS",
                "SSSLLSSS",
                "SSSSSSSS"],
         ["HHHHHHHH", "HHHHHHHH", "HHHHHHHH", "HHHHHHSS", "HHHHHSSS", "HHHHHSSS", "HHHHSSSS", "HHHSSSSS"],
         ["HHHHHHHH"] * 7 + ["HHHHHHHH"])
    dress = (30, 28, 34)

    def top(f, u, v, wd, ht):
        if f == "front" and u == 4 and v in (2, 5, 8):
            return (210, 172, 80)
        if v < 2:
            return mul(dress, 1.25)
        return None
    outfit(s, c, dress, dress, dress, (20, 18, 22), top_fn=top)
    for leg in ("rleg", "lleg"):
        s.paint(leg, SIDES, lambda f, u, v, wd, ht: s.cloth(mul(dress, 1.08), f, u, v, wd, ht) if v < 9 else None, layer=1)
    g = Gear("geometry.jjk.sorcerer_gear_mei_mei")
    hair_cap(g, c["hair"], y0=29.4, inflate=0.55, back_to=22)
    br = g.region(4, 8, lambda u, v, wd, ht: mul(c["hair"], 1.12 - 0.1 * ((u + v) % 3)))
    braid = g.bone("g_braid", "head", (-3.0, 25.5, -3.2), (6, 0, -6))         # the long braid over the right shoulder
    for i in range(6):
        g.cube(braid, (-4.2 + (i % 2) * 0.3, 25.5 - (i + 1) * 2.3, -4.0), (2.2, 2.4, 2.2), uv(rest=br))
    tip = g.flat((40, 40, 48), 2, 2)
    g.cube(braid, (-3.9, 10.6, -3.7), (1.6, 1.0, 1.6), uv(rest=tip))
    shaft = g.flat((54, 40, 34), 2, 8)
    axe = g.region(6, 6, lambda u, v, wd, ht: (200, 204, 214) if u < wd - 1 else (240, 244, 250))
    on_back(g, [((-0.6, -6, -0.6), (1.2, 20, 1.2), shaft), ((0.6, 9, -0.5), (5, 6, 1.0), axe)], angle=-32)
    crow = g.flat((26, 24, 30), 3, 3)
    cb = g.bone("g_crow", "body", (5, 24, 0))
    g.cube(cb, (4.2, 24.0, -1.0), (2.2, 2.0, 3.0), uv(rest=crow))
    g.cube(cb, (4.6, 25.6, -2.0), (1.4, 1.4, 1.4), uv(rest=crow))
    beak = g.flat((210, 170, 60), 2, 2)
    g.cube(cb, (4.9, 25.9, -2.8), (0.8, 0.6, 0.8), uv(rest=beak))
    return s.img, g


def todo():
    c = dict(skin=(214, 168, 128), hair=(40, 30, 28), iris=(50, 40, 34), jacket=NAVY, scar=(170, 100, 90))
    s = Skin(11)
    head(s, c, ["HHHHHHHH",
                "HSSSSSSH",
                "SOSOSSSS",
                "SKKSSKKS",
                "SEISSIES",
                "SSSssSSS",
                "SSMMMMSS",
                "SSSSSSSS"],
         ["HHHHHHHH", "HHHHHSSS", "HHHHSSSS", "HHHSSSSS", "HHHSSSSS", "HHSSSSSS", "HSSSSSSS", "SSSSSSSS"],
         ["HHHHHHHH", "HHHHHHHH", "HHHHHHHH", "HHHHHHHH", "HHHHHHHH", "SHHHHHHS", "SSSSSSSS", "SSSSSSSS"])
    tank = (230, 228, 220)

    def top(f, u, v, wd, ht):
        if f == "front" and 2 <= u <= 5:
            return s.cloth(tank, f, u, v, wd, ht, 0.03)       # the open jacket shows the white tank top
        return None
    outfit(s, c, c["jacket"], c["jacket"], (30, 32, 50), (26, 24, 26), top_fn=top, sleeve_to=6)
    g = Gear("geometry.jjk.sorcerer_gear_todo")
    bun = g.flat(c["hair"], 4, 4)
    tb = g.bone("g_bun", "head", (0, 24, 0))
    g.cube(tb, (-1.4, 31.8, -0.4), (2.8, 2.2, 2.8), uv(rest=bun))
    g.cube(tb, (-0.8, 33.8, 0.2), (1.6, 1.0, 1.6), uv(rest=bun))
    return s.img, g


def yuta():
    c = dict(skin=(232, 206, 190), hair=(30, 30, 38), iris=(36, 34, 44), jacket=(230, 230, 236), black=(90, 80, 100))
    s = Skin(12)
    head(s, c, ["HHHHHHHH",
                "HhHHHhHH",
                "HHSHSSHH",
                "SEISSIES",
                "SBBSSBBS",
                "SSSSSSSS",
                "SSSMMSSS",
                "SSSSSSSS"],
         ["HHHHHHHH", "HHHHHHHH", "HHHHHHHS", "HHHHSSSS", "HHHSSSSS", "HHSSSSSS", "HSSSSSSS", "SSSSSSSS"],
         ["HHHHHHHH", "HHhHHHHH", "HHHHHHHH", "HHHHhHHH", "HHHHHHHH", "HHHHHHHH", "SHHHHHHS", "SSSSSSSS"])
    J = c["jacket"]
    outfit(s, c, J, J, mul(J, 0.92), (30, 30, 34), top_fn=jjh_top(dict(c, gold=(200, 170, 80))))
    g = Gear("geometry.jjk.sorcerer_gear_yuta")
    hair_cap(g, c["hair"], y0=29.4, inflate=0.6, back_to=26)
    fr = g.flat(c["hair"], 6, 3)
    fb = g.bone("g_fringe", "head", (0, 24, 0))
    g.cube(fb, (-4.2, 29.0, -4.7), (8.4, 1.6, 0.8), uv(rest=fr))
    sheath = g.region(2, 8, lambda u, v, wd, ht: (24, 22, 28) if v > 1 else (150, 120, 60))
    hilt = g.region(2, 4, lambda u, v, wd, ht: (230, 226, 216) if (u + v) % 2 else (40, 36, 40))
    collar(g, J)
    on_back(g, [((-0.6, -6, -0.6), (1.2, 16, 1.2), sheath), ((-0.5, 10, -0.5), (1.0, 4.6, 1.0), hilt)], angle=-36)
    return s.img, g


def toji():
    c = dict(skin=(226, 192, 166), hair=(24, 24, 28), iris=(40, 50, 44), scar=(196, 150, 140))
    s = Skin(13)
    head(s, c, ["HHHHHHHH",
                "HhHHHHhH",
                "SHKSSKHS",
                "SEISSIES",
                "SSSSSSSS",
                "SSSSSSSS",
                "SSMMMOSS",
                "SSSSSOSS"],
         ["HHHHHHHH", "HHHHHHHH", "HHHHHHSS", "HHHHSSSS", "HHHSSSSS", "HHSSSSSS", "HSSSSSSS", "SSSSSSSS"],
         ["HHHHHHHH", "HHHHhHHH", "HHHHHHHH", "HHHHHHHH", "HHHHHHHH", "SHHHHHHS", "SSSSSSSS", "SSSSSSSS"])
    shirt, pants = (28, 28, 32), (220, 216, 204)  # (the scar at the corner of his mouth is painted in O)
    outfit(s, c, shirt, shirt, pants, (24, 22, 24), sleeve_to=9)
    for leg in ("rleg", "lleg"):                                               # baggy
        s.paint(leg, SIDES, lambda f, u, v, wd, ht: s.cloth(mul(pants, 0.96), f, u, v, wd, ht) if 2 < v < 10 else None, layer=1)
    g = Gear("geometry.jjk.sorcerer_gear_toji")
    hair_cap(g, c["hair"], y0=30.4, inflate=0.45, back_to=28)
    worm = g.region(4, 4, lambda u, v, wd, ht: (130, 80, 150) if (u + v) % 2 else (96, 56, 118))
    wb = g.bone("g_worm", "body", (0, 24, 0))
    for i in range(7):                                                           # the inventory curse coiled round him
        a = i / 7 * math.pi * 2
        g.cube(wb, (math.cos(a) * 4.4 - 1.1, 14.5 + i * 0.9, math.sin(a) * 2.6 - 1.1), (2.2, 1.6, 2.2), uv(rest=worm))
    eye = g.flat((230, 220, 120), 2, 2)
    g.cube(wb, (3.6, 21.0, -2.6), (1.4, 1.4, 1.0), uv(rest=eye))
    return s.img, g


def geto():
    c = dict(skin=(234, 210, 192), hair=(24, 22, 28), iris=(40, 34, 30), mark=(150, 90, 90))
    s = Skin(14)
    head(s, c, ["HHHHHHHH",
                "HHXXXXHH",
                "HHSSSSHH",
                "HKKSSKKH",
                "HEISSIEH",
                "HSSSSSSH",
                "HSSMMSSH",
                "SSSSSSSS"],
         ["HHHHHHHH", "HHHHHXXH", "HHHHHHSS", "HHHHHSSS", "HHHHHSSS", "HHHHSSSS", "HHHHSSSS", "HHHSSSSS"],
         ["HHHHHHHH"] * 8)
    robe, kesa = (30, 28, 32), (196, 120, 50)

    def top(f, u, v, wd, ht):
        if f == "front" and abs(u - (6 - v * 0.55)) < 1.1 and v < 11:
            return mul(kesa, 1.0 + (0.1 if v % 3 == 0 else 0))  # the stole from the left shoulder to the right hip
        if f == "back" and abs(u - (1 + v * 0.55)) < 1.1 and v < 11:
            return kesa
        return None
    outfit(s, c, robe, robe, robe, (60, 44, 34), top_fn=top)
    for leg in ("rleg", "lleg"):
        s.paint(leg, SIDES, lambda f, u, v, wd, ht: s.cloth(mul(robe, 1.1), f, u, v, wd, ht) if v < 10 else None, layer=1)
    g = Gear("geometry.jjk.sorcerer_gear_geto")
    hair_cap(g, c["hair"], y0=29.6, inflate=0.55, back_to=22)
    bun = g.flat(c["hair"], 4, 4)
    gb = g.bone("g_bun", "head", (0, 24, 0))
    g.cube(gb, (-1.5, 30.6, 3.0), (3.0, 2.6, 2.4), uv(rest=bun))
    ring_ = g.flat((40, 40, 46), 2, 2)
    for x in (-4.6, 4.0):
        g.cube(gb, (x, 26.2, -0.6), (0.6, 1.4, 1.4), uv(rest=ring_))            # gauge earrings
    return s.img, g


def mahito():
    c = dict(skin=(214, 210, 214), hair=(110, 130, 160), hair_h=(150, 170, 200), iris=(90, 150, 220), iris2=(150, 170, 140),
             mark=(70, 60, 80))
    s = Skin(15)
    head(s, c, ["HHHHHHHH",
                "HXHHHhHH",
                "SXSSXSSS",
                "SEIXSiES",
                "XXSSSXXS",
                "SSXSSSXS",
                "SSMMMXSS",
                "SXSSSSSS"],
         ["HHHHHHHH", "HHHHHHHH", "HHHHHXSS", "HHHHSSXS", "HHHHXXSS", "HHHSSSSS", "HHHSSSSS", "HHHSSSSS"],
         ["HHHHHHHH"] * 7 + ["HhHHHHhH"])
    shirt, patch, pants = (196, 198, 206), (150, 160, 184), (40, 40, 52)

    def top(f, u, v, wd, ht):
        if (u * 3 + v * 7) % 11 == 0:
            return c["mark"]                                    # stitches
        if (u // 3 + v // 4) % 3 == 0:
            return s.cloth(patch, f, u, v, wd, ht, 0.02)        # patchwork
        return None

    def arms(arm, f, u, v, wd, ht):
        if v >= 6 and (v == 8 or (u + v) % 5 == 0):
            return c["mark"]
        return None
    outfit(s, c, shirt, shirt, pants, (30, 28, 34), top_fn=top, arm_fn=arms, sleeve_to=6)
    g = Gear("geometry.jjk.sorcerer_gear_mahito")
    hair_cap(g, c["hair"], y0=29.2, inflate=0.6, back_to=22.5)
    lk = g.flat(c["hair"], 3, 6)
    hb = g.bone("g_locks", "head", (0, 24, 0))
    for x in (-4.8, 3.9):
        g.cube(hb, (x, 22.6, -2.6), (0.9, 6.0, 5.4), uv(rest=lk))
    return s.img, g


def choso():
    c = dict(skin=(226, 200, 186), hair=(24, 22, 28), iris=(90, 40, 50), mark=(60, 30, 36))
    s = Skin(16)
    head(s, c, ["HHHHHHHH",
                "HHHhHHHH",
                "HSKSSKSH",
                "SEISSIES",
                "XXXXXXXX",
                "SSSSSSSS",
                "SSSMMSSS",
                "SSSSSSSS"],
         ["HHHHHHHH", "HHHHHHHH", "HHHHHHSS", "HHHHSSSS", "HHHXXXXX", "HHSSSSSS", "HSSSSSSS", "SSSSSSSS"],
         ["HHHHHHHH", "HHHHHHHH", "HHHHHHHH", "HHHHHHHH", "HHHHHHHH", "HHHHHHHH", "SHHHHHHS", "SSSSSSSS"])
    robe, inner = (220, 214, 206), (70, 56, 80)

    def top(f, u, v, wd, ht):
        if f == "front" and 2 <= u <= 5 and v < 10:
            return s.cloth(inner, f, u, v, wd, ht, 0.03)
        return None
    outfit(s, c, robe, robe, (60, 50, 70), (30, 28, 32), top_fn=top)
    g = Gear("geometry.jjk.sorcerer_gear_choso")
    hair_cap(g, c["hair"], y0=30.0, inflate=0.5, back_to=27)
    sp = [((x - 1, 31.0, z - 1), (2, ln, 2), [rx, 0, rz]) for x, z, ln, rx, rz in
          ((-3.0, 0.5, 4.4, -10, -46), (-3.2, 1.6, 3.4, -24, -64), (3.0, 0.5, 4.4, -10, 46), (3.2, 1.6, 3.4, -24, 64))]
    spikes(g, c["hair"], sp)
    return s.img, g


def jogo():
    c = dict(skin=(226, 214, 192), hair=(70, 60, 56), black=(30, 26, 26), iris=(30, 26, 26), mouth=(40, 30, 30))
    s = Skin(17)
    head(s, c, ["SSSSSSSS",
                "SSSSSSSS",
                "SSSSSSSS",
                "SSSEESSS",
                "SSEIIESS",
                "SSSEESSS",
                "STTTTTTS",
                "SSSSSSSS"],
         ["SSSSSSSS"] * 6 + ["SSSSSSTS", "SSSSSSSS"], ["SSSSSSSS"] * 8, top_streaks=False)
    robe, sash = (110, 108, 116), (40, 36, 44)

    def top(f, u, v, wd, ht):
        if v in (7, 8):
            return sash
        if f == "front" and v < 5 and abs(u - 3.5) < 2.2 - v * 0.45:
            return c["skin"]
        return None
    outfit(s, c, robe, robe, mul(robe, 0.9), (40, 36, 34), top_fn=top)
    g = Gear("geometry.jjk.sorcerer_gear_jogo")
    rock = g.region(8, 6, lambda u, v, wd, ht: mul((80, 70, 66), 1.1 - 0.2 * v / ht + (0.1 if (u + v) % 4 == 0 else 0)))
    lava = g.region(4, 4, lambda u, v, wd, ht: (255, 150 + (u * 20) % 60, 40))
    vb = g.bone("g_volcano", "head", (0, 24, 0))
    for i, (wd, ht) in enumerate(((8.6, 1.8), (7.0, 1.8), (5.6, 1.8))):     # the cone rises from the crown of his head
        y = 31.4 + i * 1.8
        g.cube(vb, (-wd / 2, y, -wd / 2), (wd, ht, wd), uv(up="none", rest=rock))
    g.cube(vb, (-2.0, 36.4, -2.0), (4.0, 0.2, 4.0), uv(up=lava, rest=lava))      # lava glowing in the crater
    for x, z in ((-2.9, -2.9), (2.1, -3.3)):                                      # lava running down the front
        g.cube(vb, (x, 32.4, z - 0.5), (0.8, 3.2, 0.5), uv(rest=lava))
    return s.img, g


# id: (name, side, clan, look builder, scale, spawn egg colours)
ROSTER = {
    "gojo": ("Satoru Gojo", "ally", "gojo", gojo, 1.06, ("#e8ecf4", "#1e2034")),
    "yuji": ("Yuji Itadori", "ally", "clanless", yuji, 1.0, ("#e8929c", "#22253a")),
    "megumi": ("Megumi Fushiguro", "ally", "zenin", megumi, 1.0, ("#1a1c26", "#22253a")),
    "nobara": ("Nobara Kugisaki", "ally", "clanless", nobara, 0.95, ("#be6832", "#22253a")),
    "maki": ("Maki Zen'in", "ally", "zenin", maki, 0.98, ("#284634", "#22253a")),
    "inumaki": ("Toge Inumaki", "ally", "inumaki", inumaki, 0.97, ("#e2dac4", "#22253a")),
    "panda": ("Panda", "ally", "clanless", panda, 1.2, ("#ececea", "#1e1e22")),
    "nanami": ("Kento Nanami", "ally", "clanless", nanami, 1.05, ("#ccba92", "#d6aa3c")),
    "mei_mei": ("Mei Mei", "ally", "clanless", mei_mei, 1.0, ("#dedee8", "#1e1c22")),
    "todo": ("Aoi Todo", "ally", "clanless", todo, 1.15, ("#d6a880", "#22253a")),
    "yuta": ("Yuta Okkotsu", "ally", "clanless", yuta, 1.0, ("#e6e6ec", "#1e1e26")),
    "sukuna": ("Ryomen Sukuna", "villain", "clanless", sukuna, 1.12, ("#e88c96", "#1a1216")),
    "toji": ("Toji Fushiguro", "villain", "zenin", toji, 1.05, ("#1c1c20", "#dcd8cc")),
    "geto": ("Suguru Geto", "villain", "clanless", geto, 1.05, ("#1e1c20", "#c47832")),
    "mahito": ("Mahito", "villain", "clanless", mahito, 1.0, ("#6e82a0", "#c4c6ce")),
    "choso": ("Choso", "villain", "kamo", choso, 1.02, ("#dcd6ce", "#46303c")),
    "jogo": ("Jogo", "villain", "clanless", jogo, 0.92, ("#e2d6c0", "#ff9628")),
}
# health, melee damage, speed — allies are strong teammates, villains are bosses
STATS = {"gojo": (400, 12, 0.32), "yuji": (160, 9, 0.33), "megumi": (130, 6, 0.3), "nobara": (110, 6, 0.3), "maki": (160, 10, 0.34),
         "inumaki": (100, 5, 0.3), "panda": (200, 9, 0.28), "nanami": (220, 10, 0.3), "mei_mei": (200, 10, 0.3), "todo": (240, 11, 0.32),
         "yuta": (300, 11, 0.32), "sukuna": (3000, 20, 0.33), "toji": (900, 16, 0.38), "geto": (1400, 12, 0.3), "mahito": (1000, 12, 0.32),
         "choso": (800, 11, 0.3), "jogo": (1100, 12, 0.28)}
fam = lambda v, op="==": {"test": "is_family", "subject": "other", "operator": op, "value": v}


def base_components():
    return {
        "minecraft:type_family": {"family": ["sorcerer", "mob"]},
        "minecraft:health": {"value": 100, "max": 100}, "minecraft:attack": {"damage": 6}, "minecraft:movement": {"value": 0.3},
        "minecraft:movement.basic": {}, "minecraft:jump.static": {}, "minecraft:can_climb": {},
        "minecraft:navigation.walk": {"can_path_over_water": True, "can_open_doors": True, "avoid_damage_blocks": True},
        "minecraft:physics": {}, "minecraft:pushable": {"is_pushable": True, "is_pushable_by_piston": True},
        "minecraft:collision_box": {"width": 0.6, "height": 1.8}, "minecraft:breathable": {"total_supply": 15, "suffocate_time": 0},
        "minecraft:nameable": {"always_show": True, "allow_name_tag_renaming": False},
        "minecraft:behavior.float": {"priority": 0},
        "minecraft:behavior.melee_attack": {"priority": 2, "speed_multiplier": 1.2, "track_target": True},
        "minecraft:behavior.random_stroll": {"priority": 7, "speed_multiplier": 0.7},
        "minecraft:behavior.look_at_player": {"priority": 8, "look_distance": 10},
        "minecraft:behavior.random_look_around": {"priority": 9},
        "minecraft:damage_sensor": {"triggers": [{"cause": "fall", "deals_damage": "no"}]},
        "minecraft:knockback_resistance": {"value": 0.4}, "minecraft:follow_range": {"value": 32, "max": 32},
    }


def ally_group():
    """Jujutsu High: fights curses, villains and monsters (never creepers), never players on its own (the script runs
    spars); right-click to talk."""
    return {
        "minecraft:type_family": {"family": ["sorcerer", "jjk_ally", "mob"]},
        "minecraft:behavior.hurt_by_target": {"priority": 1, "entity_types": {"filters": fam("player", "!=")}},
        "minecraft:behavior.nearest_attackable_target": {"priority": 3, "must_see": False, "reselect_targets": True, "within_radius": 24,
            "entity_types": [{"filters": {"any_of": [fam("curse"), fam("jjk_villain"), {"all_of": [fam("monster"), fam("creeper", "!=")]},
                                                     {"all_of": [fam("player"), {"test": "has_tag", "subject": "other", "value": "jjk_spar"}]}]},
                              "max_dist": 24}]},
        "minecraft:interact": {"interactions": [{"on_interact": {"filters": fam("player"), "event": "jjk:talked", "target": "self"},
                                                 "interact_text": "Talk", "swing": True}]},
    }


def villain_group():
    """A villain: hunts players, Jujutsu High and shikigami; stays until it's beaten (or left alone, see sorcerers.js)."""
    return {
        "minecraft:type_family": {"family": ["sorcerer", "jjk_villain", "monster", "mob"]},
        "minecraft:behavior.hurt_by_target": {"priority": 1},
        "minecraft:behavior.nearest_attackable_target": {"priority": 3, "must_see": False, "reselect_targets": True, "within_radius": 32,
            "entity_types": [{"filters": {"any_of": [fam("player"), fam("jjk_ally"), fam("shikigami")]}, "max_dist": 32}]},
        "minecraft:persistent": {},
        "minecraft:experience_reward": {"on_death": "q.last_hit_by_player ? 120 : 0"},
    }


# swaying bones (animation.jjk.sorcerer_gear.sway)
SWAY = {
    "g_tail": {"rotation": ["math.sin(q.life_time * 200) * 5 - q.modified_move_speed * 14", 0, "math.sin(q.life_time * 150) * 4"]},
    "g_braid": {"rotation": ["math.sin(q.life_time * 160) * 3 + q.modified_move_speed * 10", 0, "math.sin(q.life_time * 120) * 3"]},
    "g_hood": {"rotation": ["q.modified_move_speed * 8", 0, 0]},
    "g_arm3": {"rotation": ["math.sin(q.life_time * 140) * 6", 0, "-math.sin(q.life_time * 100) * 4"]},
    "g_arm4": {"rotation": ["-math.sin(q.life_time * 140) * 6", 0, "math.sin(q.life_time * 100) * 4"]},
    "g_crow": {"rotation": [0, "math.sin(q.life_time * 90) * 20", 0]},
    "g_worm": {"rotation": [0, "math.sin(q.life_time * 60) * 6", 0]},
}


def build():
    SK.mkdir(parents=True, exist_ok=True)
    names = list(ROSTER)
    for i, (nid, (name, side, clan, fn, scale, egg)) in enumerate(ROSTER.items()):
        img, g = fn()
        img.save(SK / f"{nid}.png")
        g.tex.paste(Image.new("RGBA", NONE[2:], (0, 0, 0, 0)), NONE[:2])
        g.tex.save(SK / f"gear_{nid}.png")
        w(RP / "models" / "entity" / f"sorcerer_gear_{nid}.geo.json", g.json(3.4 * scale, 3.8 * scale))
    # client entity: one skin per character + its gear, picked by q.property('jjk:npc')
    textures = {f"s{i}": f"textures/entity/jjk/sorcerer/{n}" for i, n in enumerate(names)}
    textures.update({f"gear_{n}": f"textures/entity/jjk/sorcerer/gear_{n}" for n in names})
    geos = {"default": "geometry.humanoid.custom", **{f"gear_{n}": f"geometry.jjk.sorcerer_gear_{n}" for n in names}}
    anims = {"humanoid_base_pose": "animation.humanoid.base_pose", "look_at_target": "animation.humanoid.look_at_target.default",
             "move": "animation.humanoid.move", "attack.rotations": "animation.humanoid.attack.rotations", "bob": "animation.humanoid.bob",
             "sway": "animation.jjk.sorcerer_gear.sway"}
    w(RP / "entity" / "sorcerer.entity.json", {"format_version": "1.10.0", "minecraft:client_entity": {"description": {
        "identifier": "jjk:sorcerer", "materials": {"default": "entity_alphatest"}, "textures": textures, "geometry": geos,
        "animations": anims,
        # the vanilla walk cycle reads variable.tcos0 — mobs have to compute it themselves, or the legs never move
        "scripts": {"pre_animation": ["variable.tcos0 = (math.cos(query.modified_distance_moved * 38.17) * query.modified_move_speed) * 57.3;"],
                    "animate": list(anims)},
        "render_controllers": ["controller.render.jjk.sorcerer",
                               *({f"controller.render.jjk.sorcerer_gear_{n}": f"q.property('jjk:npc') == {i}"} for i, n in enumerate(names))],
        "enable_attachables": True, "spawn_egg": {"base_color": "#22253a", "overlay_color": "#e8ecf4"}}}})
    w(RP / "render_controllers" / "sorcerer.render_controllers.json", {"format_version": "1.8.0", "render_controllers": {
        "controller.render.jjk.sorcerer": {
            "arrays": {"textures": {"Array.skins": [f"Texture.s{i}" for i in range(len(names))]}},
            "geometry": "Geometry.default", "materials": [{"*": "Material.default"}], "textures": ["Array.skins[q.property('jjk:npc')]"]},
        **{f"controller.render.jjk.sorcerer_gear_{n}": {"geometry": f"Geometry.gear_{n}", "materials": [{"*": "Material.default"}],
                                                        "textures": [f"Texture.gear_{n}"]} for n in names}}})
    w(RP / "animations" / "sorcerer.animation.json", {"format_version": "1.8.0", "animations": {
        "animation.jjk.sorcerer_gear.sway": {"loop": True, "bones": SWAY}}})
    # behaviour entity: the property, one component group per character (health, size), ally / villain sides
    groups, events = {}, {}
    groups["jjk:ally"] = ally_group()
    groups["jjk:villain"] = villain_group()
    groups["jjk:despawn"] = {"minecraft:instant_despawn": {}}
    groups["jjk:wanderer"] = {"minecraft:despawn": {"despawn_from_distance": {"min_distance": 48, "max_distance": 96}}}  # came to help: leaves again
    groups["jjk:stay"] = {"minecraft:movement": {"value": 0.0}}                                                         # an admin's hub NPC
    for i, n in enumerate(names):
        name, side, clan, fn, scale, egg = ROSTER[n]
        hp, dmg, speed = STATS[n]
        grp = {"minecraft:health": {"value": hp, "max": hp}, "minecraft:attack": {"damage": dmg}, "minecraft:movement": {"value": speed},
               "minecraft:scale": {"value": scale}, "minecraft:collision_box": {"width": 0.6 * scale, "height": 1.8 * scale}}
        if side == "villain":
            grp["minecraft:boss"] = {"hud_range": 40, "name": name, "should_darken_sky": n == "sukuna"}
        groups[f"jjk:c_{n}"] = grp
        events[f"jjk:as_{n}"] = {"set_property": {"jjk:npc": i},
                                 "add": {"component_groups": [f"jjk:c_{n}", f"jjk:{side}"]},
                                 "remove": {"component_groups": [f"jjk:c_{o}" for o in names if o != n] + [f"jjk:{'ally' if side == 'villain' else 'villain'}"]}}
    events["jjk:despawn"] = {"add": {"component_groups": ["jjk:despawn"]}}
    events["jjk:talked"] = {}
    events["jjk:wanderer"] = {"add": {"component_groups": ["jjk:wanderer"]}}
    events["jjk:stay"] = {"add": {"component_groups": ["jjk:stay"]}}
    events["jjk:move"] = {"remove": {"component_groups": ["jjk:stay"]}}
    # a spawn egg makes a random member of Jujutsu High; the script dresses it up (sorcerers.js)
    allies = [i for i, n in enumerate(names) if ROSTER[n][1] == "ally"]
    events["minecraft:entity_spawned"] = {"set_property": {"jjk:npc": f"math.random_integer(0, {len(allies) - 1})"}}
    w(BP / "entities" / "sorcerer.json", {"format_version": "1.21.0", "minecraft:entity": {
        "description": {"identifier": "jjk:sorcerer", "is_spawnable": True, "is_summonable": True, "is_experimental": False,
                        "properties": {"jjk:npc": {"type": "int", "range": [0, len(names) - 1], "default": 0, "client_sync": True}}},
        "component_groups": groups, "components": base_components(), "events": events}})
    # the scripts read every character's index from here
    (BP / "scripts" / "roster_ids.js").write_text(
        "// Written by tools/gen_sorcerers.py — the jjk:npc property value of every character. Don't edit by hand.\n"
        f"export const NPC_IDS = {json.dumps(names)};\n")
    # names
    lang_p = RP / "texts" / "en_US.lang"
    keep = [l for l in lang_p.read_text().splitlines() if l and "jjk:sorcerer" not in l]
    keep += ["entity.jjk:sorcerer.name=Sorcerer", "item.spawn_egg.entity.jjk:sorcerer.name=Spawn Jujutsu High Sorcerer"]
    lang_p.write_text("\n".join(sorted(keep)) + "\n")
    print(f"Sorcerers: {len(names)} ({', '.join(names)}).")


# ===========================================================================
# Preview (uses the software renderer from the Way of The Shinobi tools)
# ===========================================================================
def preview(out, only=None, size=(230, 300)):
    sys.path.insert(0, str(ROOT.parent / "shinobi-addon" / "tools"))
    import cine_preview as CP
    from PIL import ImageDraw

    def humanoid_full(skin_png):
        bones = []
        for name, parent, piv, cubes in (
                ("root", None, (0, 0, 0), []), ("waist", "root", (0, 12, 0), []),
                ("body", "waist", (0, 24, 0), [((-4, 12, -2), (8, 12, 4), (16, 16), 0), ((-4, 12, -2), (8, 12, 4), (16, 32), 0.25)]),
                ("head", "body", (0, 24, 0), [((-4, 24, -4), (8, 8, 8), (0, 0), 0), ((-4, 24, -4), (8, 8, 8), (32, 0), 0.5)]),
                ("rightArm", "body", (-5, 22, 0), [((-8, 12, -2), (4, 12, 4), (40, 16), 0), ((-8, 12, -2), (4, 12, 4), (40, 32), 0.25)]),
                ("leftArm", "body", (5, 22, 0), [((4, 12, -2), (4, 12, 4), (32, 48), 0), ((4, 12, -2), (4, 12, 4), (48, 48), 0.25)]),
                ("rightLeg", "root", (-1.9, 12, 0), [((-3.9, 0, -2), (4, 12, 4), (0, 16), 0), ((-3.9, 0, -2), (4, 12, 4), (0, 32), 0.25)]),
                ("leftLeg", "root", (1.9, 12, 0), [((-0.1, 0, -2), (4, 12, 4), (16, 48), 0), ((-0.1, 0, -2), (4, 12, 4), (0, 48), 0.25)])):
            b = {"name": name, "pivot": list(piv), "cubes": [{"origin": list(o), "size": list(s_), "uv": list(u), **({"inflate": i} if i else {})}
                                                           for o, s_, u, i in cubes]}
            if parent:
                b["parent"] = parent
            bones.append(b)
        return CP.Model(bones, Image.open(skin_png), scale=0.9375)

    pose = {"bones": {"rightArm": {"rotation": [-18, 0, 4]}, "leftArm": {"rotation": [14, 0, -4]},
                      "rightLeg": {"rotation": [12, 0, 0]}, "leftLeg": {"rotation": [-12, 0, 0]}, "head": {"rotation": [-4, 12, 0]}}}
    names = [n for n in ROSTER if not only or n in only]
    cw, ch = size
    views = [(2.6, 1.5, 1.55, 1.1), (-2.6, -1.5, 1.7, 1.1)]
    img = Image.new("RGB", (cw * len(views) * 3, ch * math.ceil(len(names) / 3)), (24, 22, 28))
    d = ImageDraw.Draw(img)
    for k, n in enumerate(names):
        scale = ROSTER[n][4]
        for vi, (f, r, h, lh) in enumerate(views):
            place = lambda q, s_: (q[0] * CP.PX * s_ * scale, q[1] * CP.PX * s_ * scale, q[2] * CP.PX * s_ * scale)
            quads = CP.model_quads(humanoid_full(SK / f"{n}.png"), pose, 0, place)
            gm = CP.load_geo(RP / "models" / "entity" / f"sorcerer_gear_{n}.geo.json", SK / f"gear_{n}.png")
            gm.scale = 0.9375
            quads += CP.model_quads(gm, pose, 0, place)
            cam = CP.Camera(CP.scene_pt(f, r, h * scale), CP.scene_pt(0, 0, lh * scale), cw, ch, fov=52)
            frame = CP.render(cam, [quads], sky=((40, 38, 50), (70, 66, 80)))
            x = ((k % 3) * len(views) + vi) * cw
            y = (k // 3) * ch
            img.paste(frame, (x, y))
            if vi == 0:
                d.text((x + 4, y + 3), ROSTER[n][0], fill=(240, 240, 240))
    img.save(out)
    print("wrote", out)


if __name__ == "__main__":
    sys.path.insert(0, str(Path(__file__).resolve().parent))
    ap = argparse.ArgumentParser()
    ap.add_argument("--preview")
    ap.add_argument("--only", help="comma-separated ids")
    a = ap.parse_args()
    if a.preview:
        preview(a.preview, a.only.split(",") if a.only else None)
    else:
        build()
