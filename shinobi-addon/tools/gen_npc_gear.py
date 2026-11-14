#!/usr/bin/env python3
"""NPC skins and 3D gear: the Rogue Ninja and the Travelling Merchant here, plus everything in tools/gen_npc_models.py
(the Sound Ninja, the Leaf Shinobi and Kunoichi, and the Hidden Sand NPCs), using the shared helpers below.

  Rogue Ninja (skin 9 — aegis:hostile_ninja): a scratched-out headband with its ties, a cloth face wrap, messy spiked
    hair and a scar over one eye; a red, tattered scarf whose two tails stream out behind; a cleaver strapped across the
    back on a leather strap; bandaged forearms, a thigh holster, wrapped shins and a hip pouch.
  Travelling Merchant (skin 32 — aegis:npc "Travelling Merchant"): a jolly old peddler with a grey beard and an indigo
    head-cloth, an ochre haori with a coin crest on the back, an indigo obi with a red coin purse, arm guards and white leg
    wraps; in 3D a wide woven straw kasa with a chin cord, a tall wooden pack-cabinet of drawers with brass handles on
    his back (rope straps across the chest), a green furoshiki bundle tied on top, a rolled straw mat underneath, a red
    paper lantern swinging from its side and a soroban (abacus) tucked into the obi.

The skins go to tools/skins/ (gen_npcs.py prefers hand-made skins from there) and straight into the pack. The gear is a
second geometry that the NPC client entities draw only for those skins (gen_npcs.py: client_humanoid). Its bones are
named like the body's, so the walk, look and attack animations move it too; animation.aegis.npc_gear.flutter makes the
ties, scarf tails, ponytail and the merchant's lantern sway (more when running).

  python3 tools/gen_npc_gear.py                        # skins + gear (then gen_npcs.py writes the client entities)
  python3 tools/gen_npc_gear.py --preview out.png      # every NPC with gear, front and back
  python3 tools/gen_npc_gear.py --preview out.png --only merchant
"""
import argparse
import json
import math
import random
import sys
from pathlib import Path

from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parent.parent
RP = ROOT / "resource_pack"
NPC = RP / "textures" / "entity" / "aegis" / "npc"
HAND = Path(__file__).resolve().parent / "skins"


def w(path, obj):
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(obj, indent=2, ensure_ascii=False) + "\n")


def mul(c, k):
    return tuple(max(0, min(255, int(round(v * k)))) for v in c[:3])


def mix(a, b, u):
    return tuple(int(round(a[i] + (b[i] - a[i]) * u)) for i in range(3))


# ===========================================================================
# Skins (64x64, both layers)
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


def stripes(c1, c2):
    """Bandage wraps: diagonal bands."""
    return lambda face, u, v, wd, ht: c1 if (u + v * 2) % 4 < 2 else c2


# ---------------------------------------------------------------------------
# Rogue Ninja
# ---------------------------------------------------------------------------
RG = dict(skin=(204, 158, 122), skin_d=(172, 126, 96), hair=(36, 31, 30), hair_h=(60, 50, 45), cloth=(58, 60, 68),
          cloth_d=(40, 42, 48), mask=(46, 48, 56), mask_h=(66, 68, 78), band=(42, 42, 50), plate=(170, 174, 184),
          plate_d=(118, 122, 132), slash=(34, 34, 38), sash=(132, 28, 30), sash_d=(92, 18, 20), strap=(98, 66, 40),
          strap_d=(70, 48, 28), wrap=(186, 176, 156), wrap_d=(146, 136, 120), pants=(46, 48, 56), sandal=(34, 30, 30),
          eye=(236, 230, 222), iris=(212, 148, 46), scar=(176, 98, 96))


def rogue_skin():
    c = RG
    s = Skin(9)
    # --- head: hair, headband, scarred eyes, face wrap
    s.paint("head", ("top",), lambda f, u, v, wd, ht: mul(c["hair"], 1 + s.rng.uniform(-0.12, 0.18)))
    s.paint("head", ("bottom",), lambda f, u, v, wd, ht: c["mask"])
    s.paint("head", SIDES, lambda f, u, v, wd, ht: s.cloth(c["skin"], f, u, v, wd, ht, 0.03))
    H, h, B, P, p, K, S, s_, E, I, X, M, m, Y = (c["hair"], c["hair_h"], c["band"], c["plate"], c["plate_d"], c["slash"], c["skin"],
                                                c["skin_d"], c["eye"], c["iris"], c["scar"], c["mask"], c["mask_h"], (24, 22, 22))
    pal = {"H": H, "h": h, "B": B, "P": P, "p": p, "K": K, "S": S, "s": s_, "E": E, "I": I, "X": X, "M": M, "m": m, "Y": Y}
    s.rows("head", "front", ["HHhHHHhH",
                             "HSHHSHHH",
                             "BpPKKPpB",
                             "SYSSSXYS",
                             "SEISSIES",
                             "MMMmmMMM",
                             "MMmmmmMM",
                             "MMMMMMMM"], pal)
    for side in ("right", "left"):
        s.rows("head", side, ["HHhHHHhH",
                              "HHHHHHHH",
                              "BBBBBBBB",
                              "HSSSSSSS" if side == "right" else "SSSSSSSH",
                              "HSSsSSSS" if side == "right" else "SSSSsSSH",
                              "MMMMMMMM",
                              "MMMmMMMM",
                              "MMMMMMMM"], pal)
    s.rows("head", "back", ["HHhHHhHH",
                            "HHHHHHHH",
                            "BBBYYBBB",
                            "HHHYYHHH",
                            "HhHHHHhH",
                            "MMMMMMMM",
                            "MMMMMMMM",
                            "HMMMMMMH"], pal)
    # hat layer: wild strands over the fringe and a thicker wrap over the mouth
    s.rows("head", "front", ["H.h..H.h",
                             "h..H....",
                             "........",
                             "........",
                             "........",
                             "M.mmmm.M",
                             "........",
                             "........"], pal, layer=1)
    for side in ("right", "left"):
        s.rows("head", side, ["HhH.hH.H", ".H..H..h"], pal, layer=1)
    s.rows("head", "back", ["HhHHhHHh", "H.hH.Hh.", "...BB...", "...BB..."], pal, layer=1)
    s.paint("head", ("top",), lambda f, u, v, wd, ht: mul(H, 1.25) if (u * 3 + v * 5) % 7 == 0 else None, layer=1)

    # --- body: dark shirt, crimson sash, the sword strap across the chest
    s.paint("body", SIDES, lambda f, u, v, wd, ht: s.cloth(c["cloth"], f, u, v, wd, ht))
    s.paint("body", ("top", "bottom"), lambda f, u, v, wd, ht: c["cloth_d"])
    s.paint("body", SIDES, lambda f, u, v, wd, ht: (c["sash"] if v == 9 else c["sash_d"]) if v in (9, 10) else None)
    s.put("body", "front", 5, 9, mul(c["sash"], 1.2)); s.put("body", "front", 5, 10, c["sash"]); s.put("body", "front", 6, 11, c["sash_d"])
    for v in range(0, 9):        # the strap: right shoulder → left hip, front and back
        u = int(round(v * 0.82))
        s.put("body", "front", u, v, c["strap"]); s.put("body", "front", u + 1, v, c["strap_d"])
        s.put("body", "back", 7 - u, v, c["strap"]); s.put("body", "back", 6 - u, v, c["strap_d"])
    s.put("body", "front", 1, 1, (150, 150, 155))     # buckle
    for v in range(0, 12, 3):    # worn seams
        s.put("body", "front", 3 + (v // 3) % 2, v + 1, c["cloth_d"])
    s.paint("body", ("back",), lambda f, u, v, wd, ht: c["strap_d"] if (v == 8 and 2 <= u <= 5) else None)   # hip pouch strap
    # jacket layer: a ragged short cape over the shoulders and back
    s.paint("body", ("back",), lambda f, u, v, wd, ht: (mul(c["cloth_d"], 0.9 + 0.1 * ((u + v) % 2)) if v < 6 + (u * 7 % 3) else None), layer=1)
    s.paint("body", ("right", "left"), lambda f, u, v, wd, ht: (mul(c["cloth_d"], 0.92) if v < 3 + (u % 2) else None), layer=1)
    s.paint("body", ("front",), lambda f, u, v, wd, ht: (mul(c["cloth_d"], 0.9) if v < 1 + (u in (0, 7)) * 2 else None), layer=1)

    # --- arms: torn sleeves to the elbow, bandaged forearms, fingerless gloves
    for arm in ("rarm", "larm"):
        s.paint(arm, SIDES, lambda f, u, v, wd, ht: s.cloth(c["cloth"], f, u, v, wd, ht) if v < 5 else
                (stripes(c["wrap"], c["wrap_d"])(f, u, v, wd, ht) if v < 10 else (c["mask"] if v == 10 else c["skin"])))
        s.paint(arm, ("top",), lambda f, u, v, wd, ht: c["cloth"])
        s.paint(arm, ("bottom",), lambda f, u, v, wd, ht: c["skin_d"])
        s.paint(arm, SIDES, lambda f, u, v, wd, ht: (c["cloth_d"] if v == 5 and (u + (f == "front")) % 2 == 0 else None), layer=1)   # ragged cuff
    # --- legs: dark trousers, shin wraps, sandals
    for leg in ("rleg", "lleg"):
        s.paint(leg, SIDES, lambda f, u, v, wd, ht: s.cloth(c["pants"], f, u, v, wd, ht) if v < 7 else
                (stripes(c["wrap"], c["wrap_d"])(f, u, v, wd, ht) if v < 11 else c["sandal"]))
        s.paint(leg, ("top",), lambda f, u, v, wd, ht: c["pants"])
        s.paint(leg, ("bottom",), lambda f, u, v, wd, ht: c["sandal"])
        s.put(leg, "front", 1, 11, c["skin"]); s.put(leg, "front", 2, 11, c["skin_d"])   # toes
    return s.img


# ---------------------------------------------------------------------------
# Travelling Merchant
# ---------------------------------------------------------------------------
MC = dict(skin=(214, 168, 128), skin_d=(182, 136, 100), cheek=(222, 146, 118), beard=(168, 160, 152), beard_d=(130, 122, 116),
          hair=(120, 112, 106), brow=(150, 142, 136), eye=(46, 34, 30), mouth=(120, 58, 52), teeth=(236, 228, 214),
          cloth=(52, 74, 128), cloth_d=(36, 52, 94), fleck=(214, 222, 236),
          coat=(176, 120, 52), coat_d=(132, 86, 34), coat_h=(204, 150, 74), crest=(236, 220, 172),
          kimono=(228, 216, 192), kimono_d=(194, 182, 158), obi=(46, 58, 98), obi_d=(32, 42, 74), purse=(160, 44, 38),
          cord=(226, 186, 72), guard=(52, 66, 104), guard_d=(36, 46, 76), pants=(86, 72, 62), pants_d=(64, 52, 44),
          legwrap=(226, 218, 200), legwrap_d=(190, 182, 166), straw=(214, 186, 118), straw_d=(170, 140, 80),
          straw_h=(232, 208, 148), sandal=(198, 170, 106), strap=(90, 56, 38), wood=(126, 86, 52), wood_d=(84, 56, 32),
          wood_h=(152, 108, 68), brass=(222, 182, 76), brass_d=(150, 112, 40), green=(58, 124, 74), green_d=(40, 92, 54),
          lantern=(198, 42, 36), lantern_d=(150, 26, 24), black=(34, 30, 28), rope=(186, 160, 112), rope_d=(146, 122, 82))


def merchant_skin():
    c = MC
    s = Skin(32)
    W, w_, H, b, K, S, s_, C, G, g, M, Q, T = (c["cloth"], c["fleck"], c["hair"], c["brow"], c["eye"], c["skin"], c["skin_d"],
                                               c["cheek"], c["beard"], c["beard_d"], c["beard"], c["mouth"], c["teeth"])
    pal = {"W": W, "w": w_, "H": H, "b": b, "K": K, "S": S, "s": s_, "C": C, "G": G, "g": g, "M": M, "Q": Q, "T": T,
           "D": c["cloth_d"], "E": (240, 236, 228)}
    # --- head: indigo head-cloth under the hat, grey hair and beard, a big grin and happy squinting eyes
    s.paint("head", ("top",), lambda f, u, v, wd, ht: W if (u * 3 + v * 5) % 7 else w_)
    s.paint("head", ("bottom",), lambda f, u, v, wd, ht: g)
    s.paint("head", SIDES, lambda f, u, v, wd, ht: s.cloth(S, f, u, v, wd, ht, 0.02))
    s.rows("head", "front", ["WWwWWWwW",
                             "HSSSSSSH",
                             "bbbSSbbb",
                             "SEKSSKES",
                             "CSSssSSC",
                             "GMMssMMG",
                             "GgQTTQgG",
                             "gGGGGGGg"], pal)
    for side in ("right", "left"):
        art = ["WWWWWWWW",
               "HHHHHSSS",
               "HHHHSSSS",
               "HHHsSSSS",
               "HHHssSSS",
               "HHGGSSSG",
               "HGGGGGGG",
               "GGGGGGGG"]
        s.rows("head", side, art if side == "right" else [r[::-1] for r in art], pal)
    s.rows("head", "back", ["WWWDDWWW",
                            "HHHDDHHH",
                            "HHHHHHHH",
                            "HhHHHHhH".replace("h", "b"),
                            "HHHHHHHH",
                            "HHbHHbHH",
                            "HHHHHHHH",
                            "gHHHHHHg"], pal)
    # hat layer: the head-cloth's knot and its two tails at the back, beard volume
    s.rows("head", "back", ["...DD...", "..W..W..", "..W..W..", "..w..W.."], pal, layer=1)
    s.rows("head", "front", ["........", "........", "........", "........", "........", "........", "G......G", ".GGGGGG."], pal, layer=1)

    # --- body: an ochre haori open over a cream kimono, an indigo obi with a coin purse, a coin crest on the back
    body = {"C": c["coat"], "L": c["coat_d"], "K": c["kimono"], "k": c["kimono_d"], "O": c["obi"], "o": c["obi_d"],
            "Y": c["cord"], "P": c["purse"], "Z": c["crest"], "h": c["coat_h"]}
    s.paint("body", SIDES, lambda f, u, v, wd, ht: s.cloth(c["coat"], f, u, v, wd, ht, 0.04))
    s.paint("body", ("top",), lambda f, u, v, wd, ht: c["coat"])
    s.paint("body", ("bottom",), lambda f, u, v, wd, ht: c["coat_d"])
    s.rows("body", "front", ["hLKKKKLh",
                             "CLKkkKLC",
                             "CCLKKLCC",
                             "CCLKKLCC",
                             "CCLKKLCC",
                             "CCLKkLCC",
                             "CCLKKLCC",
                             "CCLKKLCC",
                             "OOOOOOOO",
                             "OYOOOoOO",
                             "CPPLKKLC",
                             "CPPLKkLC"], body)
    s.rows("body", "back", ["hhhhhhhh",
                            "CCCCCCCC",
                            "CCZZZZCC",
                            "CZZCCZZC",
                            "CZCCCCZC",
                            "CZCCCCZC",
                            "CZZCCZZC",
                            "CCZZZZCC",
                            "OOOOOOOO",
                            "OOOoOOOO",
                            "CCCCCCCC",
                            "LCCCCCCL"], body)
    for side in ("right", "left"):
        s.rows("body", side, ["hhhh"] + ["CCCC"] * 7 + ["OOOO", "OoOO", "CCCC", "LCCL"], body)
    # jacket layer: the haori stands out from the kimono and the obi (lapels, shoulders, hem)
    s.rows("body", "front", ["hL....Lh",
                             "CL....LC",
                             "CCL..LCC",
                             "CCL..LCC",
                             "CCL..LCC",
                             "CCL..LCC",
                             "CCL..LCC",
                             "CCL..LCC",
                             "........",
                             "........",
                             "C..L..LC",
                             "L..L..LL"], body, layer=1)
    s.paint("body", ("back", "right", "left"), lambda f, u, v, wd, ht: None if v in (8, 9) else
            (c["crest"] if f == "back" and (u, v) in {(2, 2), (3, 2), (4, 2), (5, 2), (2, 7), (3, 7), (4, 7), (5, 7), (1, 3), (1, 4), (1, 5),
                                                       (1, 6), (6, 3), (6, 4), (6, 5), (6, 6), (2, 3), (5, 3), (2, 6), (5, 6)}
             else s.cloth(c["coat"], f, u, v, wd, ht, 0.03, 1.1, 0.92)), layer=1)

    # --- arms: wide haori sleeves to the elbow, indigo arm guards, hands
    for arm in ("rarm", "larm"):
        s.paint(arm, SIDES, lambda f, u, v, wd, ht: s.cloth(c["coat"], f, u, v, wd, ht) if v < 6 else
                ((c["guard"] if v % 3 else c["guard_d"]) if v < 11 else c["skin"]))
        s.paint(arm, ("top",), lambda f, u, v, wd, ht: c["coat"])
        s.paint(arm, ("bottom",), lambda f, u, v, wd, ht: c["skin_d"])
        s.paint(arm, SIDES, lambda f, u, v, wd, ht: (c["coat_d"] if v == 6 else s.cloth(c["coat"], f, u, v, wd, ht, 0.03)) if v <= 6 else None,
                layer=1)
    # --- legs: dark hakama trousers, white leg wraps tied with indigo, straw sandals
    for leg in ("rleg", "lleg"):
        s.paint(leg, SIDES, lambda f, u, v, wd, ht: s.cloth(c["pants"], f, u, v, wd, ht) if v < 6 else
                ((c["cloth"] if v == 6 else (c["legwrap"] if v % 2 else c["legwrap_d"])) if v < 11 else c["sandal"]))
        s.paint(leg, ("top",), lambda f, u, v, wd, ht: c["pants"])
        s.paint(leg, ("bottom",), lambda f, u, v, wd, ht: c["sandal"])
        s.put(leg, "front", 1, 11, c["skin"]); s.put(leg, "front", 2, 11, c["strap"])
        s.paint(leg, SIDES, lambda f, u, v, wd, ht: s.cloth(c["pants_d"], f, u, v, wd, ht, 0.03) if v < 5 else None, layer=1)
    return s.img


# ===========================================================================
# Gear (3D): a second geometry with the body's bone names
# ===========================================================================
GW = 64


class Gear:
    def __init__(self, ident):
        self.ident = ident
        self.bones, self.idx = [], {}
        for name, parent, piv in (("root", None, (0, 0, 0)), ("waist", "root", (0, 12, 0)), ("body", "waist", (0, 24, 0)),
                                  ("head", "body", (0, 24, 0)), ("rightArm", "body", (-5, 22, 0)), ("leftArm", "body", (5, 22, 0)),
                                  ("rightLeg", "root", (-1.9, 12, 0)), ("leftLeg", "root", (1.9, 12, 0))):
            self.bone(name, parent, piv)

    def bone(self, name, parent, pivot, rotation=None):
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

    def json(self):
        return {"format_version": "1.12.0", "minecraft:geometry": [{
            "description": {"identifier": self.ident, "texture_width": GW, "texture_height": GW,
                            "visible_bounds_width": 3, "visible_bounds_height": 3.5, "visible_bounds_offset": [0, 1.5, 0]},
            "bones": [{k: v for k, v in b.items() if k != "cubes" or v} for b in self.bones]}]}


NONE = (60, 60, 4, 4)    # transparent corner of every gear texture


def uv(**faces):
    """Per-face UVs. faces: face=(x, y, w, h) or 'none'; 'rest' fills the faces not named."""
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
    """A band around a box: the four sides show `region`, top and bottom are open."""
    return uv(north=region, south=region, east=region, west=region)


def tex_fill(img, r, fn):
    x0, y0, wd, ht = r
    p = img.load()
    for u in range(wd):
        for v in range(ht):
            c = fn(u, v, wd, ht)
            if c is not None:
                p[x0 + u, y0 + v] = tuple(c[:3]) + ((c[3],) if len(c) > 3 else (255,))


def headband(g, tex, band_r, plate_r, band, plate, plate_d, mark):
    """A cloth band around the head and a metal plate on the forehead (mark(draw, box) engraves its symbol)."""
    tex_fill(tex, band_r, lambda u, v, wd, ht: mul(band, 1.08 if v == 0 else 0.92))
    tex_fill(tex, plate_r, lambda u, v, wd, ht: plate_d if (u in (0, wd - 1) or v in (0, ht - 1)) else mul(plate, 1.06 - 0.12 * v / ht))
    d = ImageDraw.Draw(tex)
    mark(d, plate_r)
    hb = g.bone("g_band", "head", (0, 29.7, 0))
    g.cube(hb, (-4, 29.05, -4), (8, 1.35, 8), ring(band_r), inflate=0.55)
    g.cube(hb, (-2.4, 28.85, -5.15), (4.8, 1.95, 0.5), uv(north=plate_r, rest=(plate_r[0], plate_r[1], 2, 2)))


def ties(g, tex, r, col, length):
    tex_fill(tex, r, lambda u, v, wd, ht: mul(col, 1.05 if u % 3 else 0.85))
    t = g.bone("g_ties", "head", (0, 29.7, 4.6), (18, 0, 0))
    for x, ln in ((-1.3, length), (0.2, length * 0.8)):
        g.cube(t, (x, 29.7 - ln, 4.55), (1.1, ln, 0.3), uv(north=r, south=r))


def wraps(g, tex, bone, parent, origin, size, r, c1, c2, inflate=0.3):
    tex_fill(tex, r, lambda u, v, wd, ht: c1 if (u + v * 2) % 4 < 2 else c2)
    b = g.bone(bone, parent, BONE_PIVOT[parent])
    g.cube(b, origin, size, ring(r), inflate=inflate)
    return b


BONE_PIVOT = {"head": (0, 24, 0), "body": (0, 24, 0), "rightArm": (-5, 22, 0), "leftArm": (5, 22, 0), "rightLeg": (-1.9, 12, 0),
              "leftLeg": (1.9, 12, 0)}


def holster(g, tex, strap_r, box_r, strap, leather):
    tex_fill(tex, strap_r, lambda u, v, wd, ht: strap if v else mul(strap, 1.1))
    tex_fill(tex, box_r, lambda u, v, wd, ht: mul(leather, 0.8) if (u in (0, wd - 1) or v == 0) else mul(leather, 1.0 - 0.1 * v / ht))
    b = g.bone("g_holster", "rightLeg", BONE_PIVOT["rightLeg"])
    g.cube(b, (-3.9, 7.3, -2), (4, 1.1, 4), ring(strap_r), inflate=0.32)
    g.cube(b, (-4.75, 5.4, -1.3), (1.0, 3.6, 2.6), uv(rest=box_r))
    # a kunai handle sticking out of the holster
    g.cube(b, (-4.55, 9.0, -0.3), (0.6, 1.4, 0.6), uv(rest=(box_r[0], box_r[1], 1, 1)))


def pouch(g, tex, bone, parent, origin, size, r, col):
    tex_fill(tex, r, lambda u, v, wd, ht: mul(col, 1.15) if v < ht * 0.4 else (mul(col, 0.75) if v == int(ht * 0.4) else col))
    if bone not in g.idx:
        g.bone(bone, parent, BONE_PIVOT[parent])
    g.cube(bone, origin, size, uv(rest=r))


def rogue_gear():
    c = RG
    g = Gear("geometry.aegis.gear_rogue")
    tex = Image.new("RGBA", (GW, GW), (0, 0, 0, 0))

    def slashed(d, r):
        x, y, wd, ht = r
        d.line([(x + 2, y + ht // 2), (x + wd - 3, y + ht // 2 - 1)], fill=c["slash"] + (255,), width=1)
        d.point([(x + wd // 2, y + 1), (x + wd // 2 - 1, y + ht - 2)], fill=c["plate_d"] + (255,))
    headband(g, tex, (0, 0, 32, 2), (0, 2, 10, 5), c["band"], c["plate"], c["plate_d"], slashed)
    ties(g, tex, (10, 2, 4, 8), c["band"], 4.2)
    # messy spiked hair
    tex_fill(tex, (14, 2, 8, 8), lambda u, v, wd, ht: mul(c["hair"], 1.25 - 0.4 * v / ht))
    hair = g.bone("g_hair", "head", (0, 32, 0))
    for o, sz, rot in (((-3.6, 31.4, -1.6), (2, 2.4, 2), (-18, 0, 28)), ((-1, 31.8, -0.8), (2, 3.0, 2), (-14, 0, -6)),
                       ((1.6, 31.4, -0.2), (2, 2.5, 2), (-26, 0, -30)), ((-2.2, 30.6, 2.2), (2, 2.6, 2), (-58, 0, 14)),
                       ((0.6, 30.4, 2.6), (2, 2.4, 2), (-64, 0, -16))):
        g.cube(hair, o, sz, uv(rest=(14, 2, 8, 8)), rotation=rot, pivot=(o[0] + 1, o[1], o[2] + 1))
    # the scarf around the neck and its two tails
    tex_fill(tex, (0, 10, 32, 8), lambda u, v, wd, ht: (None if (v == ht - 1 and u % 3 == 0) else
                                                        mul(c["sash"], (1.08 if v < 2 else 0.95) * (0.88 if (u + v) % 5 == 0 else 1))))
    sc = g.bone("g_scarf", "body", (0, 23.5, 0))
    g.cube(sc, (-4, 22.3, -2), (8, 2.2, 4), ring((0, 10, 32, 4)), inflate=0.62)
    for i, (x, ln) in enumerate(((0.6, 8.0), (-2.2, 6.4))):
        t = g.bone(f"g_scarf_t{i}", "g_scarf", (x + 0.8, 23.2, 2.65), (24 + i * 8, 0, (-6, 8)[i]))
        g.cube(t, (x, 23.2 - ln, 2.5), (1.6, ln, 0.32), uv(north=(i * 6, 10, 4, 8), south=(i * 6, 10, 4, 8)))
        t2 = g.bone(f"g_scarf_t{i}b", t, (x + 0.8, 23.2 - ln, 2.65), (12, 0, 0))
        g.cube(t2, (x + 0.1, 23.2 - ln - 4.5, 2.52), (1.4, 4.5, 0.3), uv(north=(16 + i * 6, 10, 4, 8), south=(16 + i * 6, 10, 4, 8)))
    # the cleaver across the back (hilt over the right shoulder)
    blade_r, hilt_r, guard_r = (32, 0, 8, 32), (40, 0, 4, 12), (44, 0, 8, 3)
    steel, steel_d = (176, 182, 192), (118, 124, 136)

    def blade(u, v, wd, ht):
        if v > ht - 6 and u > wd - 1 - (v - (ht - 6)):
            return None                        # the slanted tip
        if 6 < v < 10 and 2 <= u <= 4 and (u - 3) ** 2 + (v - 8) ** 2 <= 2:
            return None                        # a hole near the spine
        edge = u == 0
        return mul(steel, 1.18) if edge else (steel_d if u == wd - 1 else mul(steel, 1.0 - 0.05 * (u % 2)))
    tex_fill(tex, blade_r, blade)
    tex_fill(tex, hilt_r, lambda u, v, wd, ht: (c["strap_d"] if (u + v) % 2 else (40, 34, 30)))
    tex_fill(tex, guard_r, lambda u, v, wd, ht: (96, 96, 104))
    sw = g.bone("g_sword", "body", (0, 18.5, 3.4), (0, 0, -34))
    g.cube(sw, (-1.7, 8.5, 2.95), (3.4, 15.5, 0.6), uv(north=blade_r, south=blade_r, east=(32, 0, 1, 32), west=(39, 0, 1, 32),
                                                      up=(32, 0, 8, 1), down=(32, 31, 8, 1)))
    g.cube(sw, (-2.1, 24.0, 2.8), (4.2, 0.9, 0.95), uv(rest=guard_r))
    g.cube(sw, (-0.65, 24.9, 2.9), (1.3, 5.2, 0.8), uv(rest=hilt_r))
    g.cube(sw, (-0.85, 30.1, 2.85), (1.7, 0.8, 0.95), uv(rest=guard_r))
    # the strap across the chest (front) — a thin band over the shoulder
    tex_fill(tex, (48, 12, 12, 2), lambda u, v, wd, ht: c["strap"] if v == 0 else c["strap_d"])
    st = g.bone("g_strap", "body", (0, 18, 0), (0, 0, 39))
    g.cube(st, (-0.6, 10.5, -2.45), (1.2, 15, 0.3), uv(north=(48, 12, 2, 12), south=(48, 12, 2, 12)))
    # bandaged forearms, wrapped shins, holster, hip pouch
    wraps(g, tex, "g_wrap_r", "rightArm", (-8, 13.2, -2), (4, 3.2, 4), (0, 18, 16, 4), c["wrap"], c["wrap_d"], 0.16)
    wraps(g, tex, "g_wrap_l", "leftArm", (4, 13.2, -2), (4, 3.2, 4), (0, 18, 16, 4), c["wrap"], c["wrap_d"], 0.16)
    wraps(g, tex, "g_shin_r", "rightLeg", (-3.9, 1.4, -2), (4, 2.8, 4), (16, 18, 16, 4), c["wrap"], c["wrap_d"], 0.15)
    wraps(g, tex, "g_shin_l", "leftLeg", (-0.1, 1.4, -2), (4, 2.8, 4), (16, 18, 16, 4), c["wrap"], c["wrap_d"], 0.15)
    holster(g, tex, (0, 22, 16, 2), (16, 22, 6, 6), c["strap_d"], (60, 44, 32))
    pouch(g, tex, "g_pouch", "body", (-1.6, 11.6, 2.2), (3.2, 2.2, 1.3), (22, 22, 6, 4), (92, 66, 42))
    return g, tex


def merchant_gear():
    c = MC
    g = Gear("geometry.aegis.gear_merchant")
    tex = Image.new("RGBA", (GW, GW), (0, 0, 0, 0))
    KASA_TOP, KASA_UNDER, KASA_EDGE, KASA_RIM = (0, 0, 16, 16), (16, 0, 16, 16), (0, 16, 16, 2), (0, 18, 16, 2)
    CAB_BACK, CAB_SIDE, CAB_TOP, CAB_DARK = (32, 0, 10, 16), (42, 0, 5, 16), (47, 0, 10, 5), (47, 5, 10, 5)
    FURO_FRONT, FURO_SIDE, FURO_TOP, KNOT = (32, 16, 8, 4), (40, 16, 4, 4), (44, 16, 8, 4), (52, 16, 4, 4)
    LANTERN, LANT_CAP = (56, 16, 4, 6), (60, 16, 3, 3)
    MAT_SIDE, MAT_END, STRAP, ABACUS, CORD, SHIN = (0, 20, 12, 4), (12, 20, 4, 4), (16, 20, 2, 12), (18, 20, 6, 5), (28, 20, 2, 6), (0, 24, 16, 4)

    # --- textures
    def kasa_top(u, v, wd, ht):
        r = math.hypot(u - wd / 2 + 0.5, v - ht / 2 + 0.5)
        ang = math.degrees(math.atan2(v - ht / 2 + 0.5, u - wd / 2 + 0.5)) % 30
        k = 1.06 if int(r) % 2 == 0 else 0.9
        if ang < 3:
            k *= 0.86                                  # the radial ribs of the weave
        return mul(c["straw"], k)
    tex_fill(tex, KASA_TOP, kasa_top)
    tex_fill(tex, KASA_UNDER, lambda u, v, wd, ht: mul(c["straw_d"], 0.82 + 0.1 * ((u + v) % 2)))
    tex_fill(tex, KASA_EDGE, lambda u, v, wd, ht: mul(c["straw_h"] if v == 0 else c["straw"], 0.88 if u % 3 == 0 else 1.0))
    tex_fill(tex, KASA_RIM, lambda u, v, wd, ht: mul(c["straw_d"], 0.9 if u % 2 else 1.0))

    def cab_back(u, v, wd, ht):
        frame = u in (0, wd - 1) or v in (0, ht - 1)
        if frame:
            return c["wood_d"]
        if v in (4, 8, 12) or (v in (9, 10, 11) and u == wd // 2):
            return mul(c["wood_d"], 1.1)               # drawer seams (the third row is two half drawers)
        if (v in (2, 6, 14) and u in (wd // 2 - 1, wd // 2)) or (v == 10 and u in (2, wd - 3)):
            return c["brass"]                          # ring handles
        if (v in (3, 7, 15 - 1) and u in (wd // 2 - 1, wd // 2) and v != 14) or (v == 11 and u in (2, wd - 3)):
            return c["brass_d"]
        return mul(c["wood"], (1.08 if v % 4 == 1 else 1.0) * (0.95 if (u * 7 + v * 3) % 5 == 0 else 1.0))
    tex_fill(tex, CAB_BACK, cab_back)
    tex_fill(tex, CAB_SIDE, lambda u, v, wd, ht: c["brass"] if (v in (0, ht - 1) and u in (0, wd - 1)) else
             (c["wood_d"] if (u in (0, wd - 1) or v in (0, ht - 1)) else mul(c["wood"], 0.92 if u % 2 else 1.02)))
    tex_fill(tex, CAB_TOP, lambda u, v, wd, ht: c["wood_d"] if (u in (0, wd - 1) or v in (0, ht - 1)) else mul(c["wood_h"], 0.95 if v % 2 else 1.0))
    tex_fill(tex, CAB_DARK, lambda u, v, wd, ht: mul(c["wood_d"], 0.9 if (u + v) % 2 else 1.0))

    def furoshiki(u, v, wd, ht):
        if (u * 2 + v * 3) % 7 == 0 or (u * 3 + v) % 11 == 5:
            return mix(c["green"], (226, 236, 226), 0.8)   # the white karakusa swirls
        return mul(c["green"], 1.06 - 0.12 * v / ht)
    for r in (FURO_FRONT, FURO_SIDE, FURO_TOP):
        tex_fill(tex, r, furoshiki)
    tex_fill(tex, KNOT, lambda u, v, wd, ht: mul(c["green_d"], 1.1 if (u + v) % 3 == 0 else 1.0))
    tex_fill(tex, LANTERN, lambda u, v, wd, ht: c["black"] if v in (0, ht - 1) else
             ((246, 214, 120) if (v in (2, 3) and u in (1, 2)) else (c["lantern"] if v % 2 else mix(c["lantern"], (240, 120, 70), 0.35))))
    tex_fill(tex, LANT_CAP, lambda u, v, wd, ht: c["black"])
    tex_fill(tex, MAT_SIDE, lambda u, v, wd, ht: mul(c["straw"], 1.05 if v % 2 else 0.9) if u not in (2, 9) else c["rope_d"])
    tex_fill(tex, MAT_END, lambda u, v, wd, ht: mul(c["straw_d"], 0.8 + 0.12 * (int(math.hypot(u - 1.5, v - 1.5) * 2) % 2)))
    tex_fill(tex, STRAP, lambda u, v, wd, ht: c["rope"] if (u + v) % 2 else c["rope_d"])
    tex_fill(tex, ABACUS, lambda u, v, wd, ht: c["wood_d"] if (u in (0, wd - 1) or v in (0, ht - 1) or v == 2) else
             ((128, 64, 40) if (u + v) % 2 else (176, 104, 62)))
    tex_fill(tex, CORD, lambda u, v, wd, ht: c["purse"] if v % 2 else mul(c["purse"], 0.8))
    tex_fill(tex, SHIN, lambda u, v, wd, ht: c["cloth"] if v == 0 else (c["legwrap"] if (u + v) % 4 else c["legwrap_d"]))

    # --- the kasa: woven rings, each a square plus three turned copies so it reads as round
    hat = g.bone("g_kasa", "head", (0, 31, 0))
    y = 31.2
    for i, wd in enumerate([13.8, 12.8, 11.2, 9.2, 6.8, 4.2, 1.8]):
        side = KASA_RIM if i in (0, 3) else KASA_EDGE
        for turn in (0, 22.5, 45, 67.5):
            k = 0.94 if turn else 0.92
            g.cube(hat, (-wd * k / 2, y + i * 0.75, -wd * k / 2), (wd * k, 0.8, wd * k),
                   uv(up=KASA_TOP, down=KASA_UNDER, rest=side), rotation=(0, turn, 0) if turn else None, pivot=(0, y + i * 0.75, 0))
    g.cube(hat, (-0.6, y + 5.2, -0.6), (1.2, 0.9, 1.2), uv(rest=KASA_RIM))                    # the knot at the tip
    for x in (-4.75, 4.45):                                                                    # the chin cord
        g.cube(hat, (x, 25.4, -0.4), (0.3, 5.9, 0.3), uv(rest=CORD))
    g.cube(hat, (-4.6, 25.1, -0.4), (9.2, 0.3, 0.3), uv(rest=CORD))

    # --- the pack-cabinet on his back, its lid, the furoshiki bundle on top and the rolled mat under it
    cab = g.bone("g_pack", "body", (0, 24, 2.3))
    g.cube(cab, (-4.3, 11.6, 2.35), (8.6, 14.2, 5.0), uv(south=CAB_BACK, north=CAB_SIDE, east=CAB_SIDE, west=CAB_SIDE, up=CAB_TOP, down=CAB_DARK))
    g.cube(cab, (-4.65, 25.8, 2.1), (9.3, 0.7, 5.6), uv(up=CAB_TOP, rest=CAB_DARK))                     # the lid
    g.cube(cab, (-3.6, 26.5, 2.9), (7.2, 3.0, 4.2), uv(north=FURO_FRONT, south=FURO_FRONT, east=FURO_SIDE, west=FURO_SIDE,
                                                       up=FURO_TOP, down=FURO_TOP), inflate=0.12)
    g.cube(cab, (-1.0, 29.4, 4.1), (2.0, 1.1, 1.8), uv(rest=KNOT))                                     # the knot and its ears
    g.cube(cab, (-2.5, 29.3, 4.4), (1.6, 0.9, 1.2), uv(rest=KNOT), rotation=(0, 0, 28), pivot=(-1.0, 29.6, 5.0))
    g.cube(cab, (0.9, 29.3, 4.4), (1.6, 0.9, 1.2), uv(rest=KNOT), rotation=(0, 0, -28), pivot=(1.0, 29.6, 5.0))
    g.cube(cab, (-4.1, 9.2, 3.8), (8.2, 2.4, 2.4), uv(north=MAT_SIDE, south=MAT_SIDE, up=MAT_SIDE, down=MAT_SIDE, east=MAT_END, west=MAT_END))
    g.cube(cab, (-4.05, 9.2, 3.8), (8.1, 2.4, 2.4), uv(north=MAT_SIDE, south=MAT_SIDE, up=MAT_SIDE, down=MAT_SIDE, east=MAT_END, west=MAT_END),
           rotation=(45, 0, 0), pivot=(0, 10.4, 5.0))
    for x in (-2.9, 2.3):                                                                               # rope ties round the mat
        g.cube(cab, (x, 8.95, 3.55), (0.6, 2.9, 2.9), ring(STRAP))
    # rope straps over the shoulders and down the chest, and a cross strap
    st = g.bone("g_straps", "body", (0, 24, 0))
    for x in (-3.2, 2.0):
        g.cube(st, (x, 14.2, -2.62), (1.2, 9.8, 0.32), uv(north=STRAP, south=STRAP, rest=(STRAP[0], STRAP[1], 1, 1)))
    g.cube(st, (-2.0, 19.0, -2.6), (4.0, 0.9, 0.28), uv(north=(STRAP[0], STRAP[1], 2, 4), rest=(STRAP[0], STRAP[1], 1, 1)))
    # the red paper lantern, swinging from the cabinet's side
    lt = g.bone("g_lantern", "body", (6.2, 24.6, 5.2))
    g.cube(lt, (6.05, 22.6, 5.05), (0.3, 2.0, 0.3), uv(rest=CORD))
    g.cube(lt, (4.85, 22.0, 3.85), (2.7, 0.6, 2.7), uv(rest=LANT_CAP))
    g.cube(lt, (4.5, 17.9, 3.5), (3.4, 4.1, 3.4), uv(north=LANTERN, south=LANTERN, east=LANTERN, west=LANTERN, up=LANT_CAP, down=LANT_CAP))
    g.cube(lt, (4.85, 17.3, 3.85), (2.7, 0.6, 2.7), uv(rest=LANT_CAP))
    g.cube(cab, (4.3, 24.2, 4.95), (2.05, 0.4, 0.5), uv(rest=CAB_DARK))                                  # the hook it hangs from
    # the soroban tucked into the obi
    ab = g.bone("g_abacus", "body", (2.5, 13.8, -2.5), (0, 0, -12))
    g.cube(ab, (0.9, 12.3, -2.78), (3.3, 2.9, 0.42), uv(north=ABACUS, south=ABACUS, rest=(ABACUS[0], ABACUS[1], 1, 1)))
    # leg wraps (kyahan)
    for name, leg, x in (("g_shin_r", "rightLeg", -3.9), ("g_shin_l", "leftLeg", -0.1)):
        b = g.bone(name, leg, BONE_PIVOT[leg])
        g.cube(b, (x, 1.3, -2), (4, 4.3, 4), ring(SHIN), inflate=0.18)
    return g, tex


FLUTTER = {
    "loop": True,
    "bones": {
        "g_ties": {"rotation": ["math.sin(q.life_time * 300) * 7 + q.modified_move_speed * 30", 0, "math.sin(q.life_time * 220) * 6"]},
        "g_scarf_t0": {"rotation": ["math.sin(q.life_time * 260) * 8 + q.modified_move_speed * 48", 0, "math.sin(q.life_time * 180) * 6"]},
        "g_scarf_t0b": {"rotation": ["math.sin(q.life_time * 260 - 70) * 12 + q.modified_move_speed * 20", 0, 0]},
        "g_scarf_t1": {"rotation": ["math.sin(q.life_time * 240 + 40) * 8 + q.modified_move_speed * 42", 0, "math.sin(q.life_time * 200 + 60) * 6"]},
        "g_scarf_t1b": {"rotation": ["math.sin(q.life_time * 240 - 30) * 12 + q.modified_move_speed * 18", 0, 0]},
        "g_tail": {"rotation": ["math.sin(q.life_time * 200) * 4 - q.modified_move_speed * 12", 0, "math.sin(q.life_time * 150) * 4"]},
        "g_lantern": {"rotation": ["math.sin(q.life_time * 170) * 5 + q.modified_move_speed * 30", 0, "math.sin(q.life_time * 130) * 6"]},
    },
}


def all_models():
    """name -> (skin painter, gear builder). The v3 models (tools/gen_npc_models.py) replace any older one of the same name."""
    import gen_npc_models as M
    return {"rogue": (rogue_skin, rogue_gear), "merchant": (merchant_skin, merchant_gear), **M.MODELS}


def build():
    import gen_npc_models as M
    NPC.mkdir(parents=True, exist_ok=True)
    HAND.mkdir(parents=True, exist_ok=True)
    models = all_models()
    for name, (skin_fn, gear_fn) in models.items():
        img = skin_fn()
        img.save(HAND / f"{name}.png")
        img.save(NPC / f"{name}.png")
        g, tex = gear_fn()
        tex.paste(Image.new("RGBA", NONE[2:], (0, 0, 0, 0)), NONE[:2])
        tex.save(NPC / f"gear_{name}.png")
        w(RP / "models" / "entity" / f"gear_{name}.geo.json", g.json())
    flutter = {**FLUTTER, "bones": {**FLUTTER["bones"], **M.FLUTTER}}
    w(RP / "animations" / "npc_gear.animation.json", {"format_version": "1.8.0", "animations": {"animation.aegis.npc_gear.flutter": flutter}})
    print(f"NPC gear: {len(models)} skins and gear models ({', '.join(models)}).")


# ===========================================================================
# Preview
# ===========================================================================
def preview(out, compare=None, views=None, size=(260, 300), fov=55, only=None):
    sys.path.insert(0, str(Path(__file__).resolve().parent))
    import cine_preview as CP

    def molang(expr, t, speed):
        if isinstance(expr, (int, float)):
            return float(expr)
        e = expr.replace("q.life_time", str(t)).replace("q.modified_move_speed", str(speed))
        return float(eval(e.replace("math.sin", "_sin"), {"_sin": lambda d: math.sin(math.radians(d))}))

    def humanoid_full(skin_png):
        """The player model with its outer layer (hat 0.5, the rest 0.25)."""
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

    pose = {"bones": {"rightArm": {"rotation": [-22, 0, 4]}, "leftArm": {"rotation": [18, 0, -4]},
                      "rightLeg": {"rotation": [16, 0, 0]}, "leftLeg": {"rotation": [-16, 0, 0]}, "head": {"rotation": [-4, 14, 0]}}}
    views = views or [(2.6, 1.6, 1.5, 1.05), (-2.6, -1.6, 1.6, 1.05)]
    cw, chh = size
    rows = [(n, n) for n in all_models() if not only or n in only]
    cols = (len(views) if compare else 0) + len(views)
    img = Image.new("RGB", (cw * cols, chh * len(rows)), (24, 22, 28))
    d = ImageDraw.Draw(img)
    for ri, (name, label) in enumerate(rows):
        variants = []
        if compare and (Path(compare) / f"{name}.png").exists():
            variants.append(("before", Path(compare) / f"{name}.png", None))
        variants.append(("now", NPC / f"{name}.png", RP / "models" / "entity" / f"gear_{name}.geo.json"))
        col = 0
        for tag, skin_png, gear_geo in variants:
            for vi, (f, r, h, lh) in enumerate(views if (tag == "now" or compare) else views):
                place = CP.placer(0, 0, 0)
                quads = CP.model_quads(humanoid_full(skin_png), pose, 0, place)
                if gear_geo:
                    gm = CP.load_geo(gear_geo, NPC / f"gear_{name}.png")
                    gm.scale = 0.9375
                    an = {"bones": dict(pose["bones"])}
                    import gen_npc_models as M
                    for bn, ch in {**FLUTTER["bones"], **M.FLUTTER}.items():
                        an["bones"][bn] = {"rotation": [molang(x, 0.7, 0.4) for x in ch["rotation"]]}
                    quads += CP.model_quads(gm, an, 0, place)
                cam = CP.Camera(CP.scene_pt(f, r, h), CP.scene_pt(0, 0, lh), cw, chh, fov=fov)
                frame = CP.render(cam, [quads], sky=((32, 30, 38), (60, 58, 66)))
                img.paste(frame, (col * cw, ri * chh))
                d.text((col * cw + 4, ri * chh + 3), f"{label} — {tag}", fill=(240, 240, 240))
                col += 1
                if col >= cols:
                    break
    img.save(out)
    print("wrote", out)


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("--preview")
    ap.add_argument("--compare", help="folder with the old rogue.png / chunin.png to show side by side")
    ap.add_argument("--view", help='"f,r,h,lookh;…" camera views')
    ap.add_argument("--fov", type=float, default=55)
    ap.add_argument("--only", help="comma-separated: rogue,chunin,merchant")
    a = ap.parse_args()
    if a.preview:
        vs = [tuple(float(x) for x in v.split(",")) for v in a.view.split(";")] if a.view else None
        preview(a.preview, a.compare, vs, fov=a.fov, only=a.only.split(",") if a.only else None)
    else:
        build()
