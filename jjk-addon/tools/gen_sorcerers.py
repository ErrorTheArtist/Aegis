#!/usr/bin/env python3
"""The Jujutsu Kaisen cast as NPCs: a painted 128x128 skin (both layers, 16x16 faces) on the cast's own body geometry,
plus a 3D gear model for each character (collars, coats, hems, props, extra arms, weapons on the back...), all drawn on
ONE entity, jjk:sorcerer, whose int property jjk:npc picks the character (its position in ROSTER). The painting and
modelling kit is tools/sorcerer_kit.py.

Hair is PLAIN: painted on the skin's two layers (the head and the outer layer just above it) — strand by strand, with a
fringe on the outer layer — never spikes or blocks of hair. Only a few small, smooth shapes stick out where a character
needs them: Maki's ponytail, Geto's and Todo's buns, Choso's pigtails, Mei Mei's braid.

  Jujutsu High (allies): Satoru Gojo, Yuji Itadori, Megumi Fushiguro, Nobara Kugisaki, Maki Zen'in, Toge Inumaki, Panda,
    Kento Nanami, Mei Mei, Aoi Todo, Yuta Okkotsu, Kinji Hakari
  Villains (bosses): Ryomen Sukuna (four arms), Toji Fushiguro, Suguru Geto (Kenjaku), Mahito, Choso, Jogo, Naoya Zen'in

Writes: textures/entity/jjk/sorcerer/<id>.png and gear_<id>.png, models/entity/sorcerer_body.geo.json and
sorcerer_gear_<id>.geo.json, the client and BP entity, render controllers, the gear sway animation, names, and
behavior_pack/scripts/roster_ids.js (the index of every character, read by sorcerers.js — never edit it by hand). New
characters go at the END of ROSTER (the index is stored on every NPC already in a world).

Same conventions as every model here: 16 px = 1 block, the front is -Z, the character's right is -X. Gear bones are
named like the body's (head, body, rightArm...), so the walk, look and attack animations move the gear too. Texture
coordinates are texels on 128x128 textures: 2 per model pixel (a face is 16 x 16, the body's front 16 x 24).

  python3 tools/gen_sorcerers.py                         # build everything
  python3 tools/gen_sorcerers.py --preview out.png       # every character: front, back and a close-up of the head
  python3 tools/gen_sorcerers.py --preview out.png --only gojo,sukuna
"""
import argparse
import json
import math
import sys
from pathlib import Path

from PIL import Image

sys.path.insert(0, str(Path(__file__).resolve().parent))
from sorcerer_kit import (  # noqa: E402
    SIDES, NONE, Skin, Gear, Hair, w, mul, mix, palette, head_base, face, hair_skin, hair_on, outfit, jjh_uniform, sneakers,
    sandals, boots, bake, body_geometry, collar, high_collar, hem, cuffs, soles, muscles, on_back, glasses, coat_skirt,
    wide_legs, lapels, earrings,
)

ROOT = Path(__file__).resolve().parent.parent
BP, RP = ROOT / "behavior_pack", ROOT / "resource_pack"
SK = RP / "textures" / "entity" / "jjk" / "sorcerer"
NAVY = (34, 37, 58)
GOLD = (226, 186, 80)


# ===========================================================================
# Shared pieces
# ===========================================================================
def band(s, rows, col, layers=(0, 1)):
    """A band round the head (Gojo's blindfold) on the given rows, on both layers."""
    for layer in layers:
        for f in SIDES:
            for u in range(16):
                for v in rows:
                    k = 1.14 if v == rows[0] else (0.78 if v == rows[-1] else 1.0)
                    s.put("head", f, u, v, mul(col, k * (0.97 + 0.06 * ((u * 3 + v) % 4 == 0))), layer)


def stitches(s, pts, col, ticks=True, layer=0):
    """A stitched scar: the line, and little cross-stitches every other texel."""
    for i, (u, v) in enumerate(pts):
        s.put("head", "front", u, v, col, layer)
        if ticks and i % 2 == 0:
            dx, dy = (0, 1) if (i + 1 < len(pts) and pts[i + 1][1] == v) else (1, 0)
            s.put("head", "front", u + dx, v + dy, mix(col, (255, 255, 255), 0.25), layer)
            s.put("head", "front", u - dx, v - dy, mix(col, (255, 255, 255), 0.25), layer)


def recolor_eye(s, c, iris2, left=True):
    """The other eye in another colour (Mahito): repaints the iris texels of one eye."""
    pal = palette(c)
    swap = {pal["J"]: iris2, pal["I"]: mix(iris2, (255, 255, 255), 0.32), pal["j"]: mul(iris2, 0.6)}
    for u in (range(9, 14) if left else range(2, 7)):
        for v in range(5, 14):
            px = s.get("head", "front", u, v)
            if px and tuple(px[:3]) in swap:
                s.put("head", "front", u, v, swap[tuple(px[:3])])


def jjh_gear(g, J, sole=(30, 30, 34), toe=None, collar_h=1.3, button=GOLD, hem_=True, cuffs_=True):
    """The Jujutsu High jacket's 3D parts: high collar (and its spiral button), flared hem, cuffs, sneaker soles."""
    collar(g, J, h=collar_h, button=button)
    if hem_:
        hem(g, J)
    if cuffs_:
        cuffs(g, J)
    soles(g, sole, toe)


def plain_tail(g, c, base, size, angle, name="g_tail", tie=(180, 40, 50)):
    """A smooth ponytail or pigtail: one block of hair hanging from `base`, tilted by `angle`, and its tie."""
    H = Hair(g, c["hair"], c.get("hair_d"), c.get("hair_h"), name=f"{name}_h")
    b = g.bone(name, "head", base, angle)
    x, y, z = base
    wd, ln, dp = size
    H.slab((x - wd / 2, y - ln, z - dp / 2), (wd, ln, dp), bone=b)
    H.slab((x - wd * 0.38, y - ln - 1.2, z - dp * 0.38), (wd * 0.76, 1.3, dp * 0.76), bone=b, tip=True)
    g.plain(f"{name}_tie", tie, 4, 4, 0.02, 1.15, 0.85)
    g.box(b, (x - wd * 0.6, y - 0.9, z - dp * 0.6), (wd * 1.2, 1.0, dp * 1.2), f"{name}_tie")
    return b


def plain_bun(g, c, center, r=1.7, name="g_bun"):
    """A smooth bun of hair (Geto, Todo)."""
    H = Hair(g, c["hair"], c.get("hair_d"), c.get("hair_h"), name=f"{name}_h")
    b = g.bone(name, "head")
    x, y, z = center
    H.slab((x - r, y - r * 0.75, z - r), (2 * r, 1.5 * r, 2 * r), bone=b)
    H.slab((x - r * 0.7, y + r * 0.75 - 0.05, z - r * 0.7), (1.4 * r, 0.5, 1.4 * r), bone=b)
    return b


# ===========================================================================
# The cast — every head: skin, face (16 x 16), plain hair on both layers; then the clothes; then the 3D gear
# ===========================================================================
def gojo():
    c = dict(skin=(242, 226, 214), hair=(236, 238, 246), hair_d=(156, 168, 206), hair_h=(255, 255, 255), jacket=(26, 28, 46),
             mouth=(150, 84, 88), lip=(214, 150, 150))
    s = Skin(1)
    head_base(s, c, 0, 0, 0)
    face(s, c, eyes="none", brows="none", mouth="small_smile", mouth_y=13)
    hair_skin(s, c, front=4, fringe=[6, 7, 6, 7, 7, 6, 7, 6, 6, 7, 6, 7, 7, 6, 7, 6],
              side=[14, 14, 14, 13, 11, 8, 7, 7, 7, 7, 7, 7, 8, 8, 8, 7], back=[14, 15, 14, 15, 14, 15, 15, 14, 15, 14, 15, 14, 15, 14, 15, 14])
    band(s, [6, 7, 8, 9, 10], (22, 22, 28))                                           # the blindfold
    J = c["jacket"]
    top, arm = jjh_uniform(c, buttons=False, collar_rows=4)
    outfit(s, c, J, J, (22, 24, 38), (18, 18, 22), top_fn=top, arm_fn=arm, leg_fn=sneakers((18, 18, 22), (40, 40, 46)), shoe_rows=2)
    bake(s)
    g = Gear("geometry.jjk.sorcerer_gear_gojo")
    collar(g, J, h=1.9)
    coat_skirt(g, J, y0=8.0)
    cuffs(g, J)
    soles(g, (40, 40, 46))
    return s.img, g


def yuji():
    c = dict(skin=(236, 202, 178), hair=(240, 154, 166), hair_d=(196, 98, 118), hair_h=(255, 202, 210), iris=(162, 102, 52),
             brow=(120, 66, 62), jacket=NAVY, red=(200, 44, 54), mouth=(140, 70, 72))
    s = Skin(3)
    head_base(s, c, 0, 0, 0)
    face(s, c, eyes="round", brows="soft", mouth="small_smile")
    hair_skin(s, c, front=2, fringe=[4, 5, 5, 4, 4, 5, 3, 2, 2, 3, 5, 4, 4, 5, 5, 4],
              side=[11, 11, 11, 11, 11, 10, 10, 10, 9, 9, 9, 8, 8, 8, 8, 8], side_hat=[7, 7, 7, 7, 7, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6],
              back=12, back_hat=8, under=(92, 66, 60), under_rows=4)
    J = c["jacket"]
    top, arm = jjh_uniform(c, collar_rows=0)

    def body(f, u, v, wd, ht):
        if v < 3:
            return mul(c["red"], 1.12 if v == 0 else 0.9)                           # the red hood's collar
        if f == "back" and v < 10 and 3 <= u <= 12:
            return s.cloth(c["red"], f, u, v, wd, ht)                               # the hood down the back
        return top(f, u, v, wd, ht)
    outfit(s, c, J, J, (28, 30, 48), (200, 46, 52), top_fn=body, arm_fn=arm,
           leg_fn=sneakers((200, 46, 52), stripe=(240, 240, 240)), shoe_rows=2)
    bake(s)
    g = Gear("geometry.jjk.sorcerer_gear_yuji")
    g.plain("hood", c["red"], 16, 16, 0.03, 1.12, 0.82)
    hb = g.bone("g_hood", "body")
    g.box(hb, (-3.6, 19.0, 2.0), (7.2, 5.0, 1.8), "hood")
    g.box(hb, (-4, 23.2, -2), (8, 1.2, 4), "hood", faces={"up": None, "down": None}, inflate=0.55)
    hem(g, J)
    cuffs(g, J)
    soles(g, (238, 236, 230), (200, 46, 52))
    return s.img, g


def megumi():
    c = dict(skin=(238, 216, 198), hair=(38, 40, 54), hair_d=(16, 16, 24), hair_h=(92, 104, 140), iris=(54, 80, 118), brow=(30, 30, 40),
             jacket=NAVY)
    s = Skin(4)
    head_base(s, c, 0, 0, 0)
    face(s, c, eyes="sharp", brows="angry", mouth="line")
    hair_skin(s, c, front=3, fringe=[6, 7, 5, 7, 8, 6, 7, 5, 6, 8, 7, 5, 7, 6, 7, 5],
              side=[12, 12, 11, 12, 11, 10, 9, 8, 8, 8, 9, 9, 10, 9, 10, 9], side_hat=[11, 12, 10, 11, 10, 9, 8, 7, 7, 7, 8, 9, 9, 8, 9, 8],
              back=[13, 14, 12, 14, 13, 14, 12, 14, 13, 14, 12, 14, 13, 14, 12, 13])
    top, arm = jjh_uniform(c)
    outfit(s, c, c["jacket"], c["jacket"], (28, 30, 48), (18, 18, 22), top_fn=top, arm_fn=arm,
           leg_fn=sneakers((18, 18, 22), (44, 44, 50)), shoe_rows=2)
    bake(s)
    g = Gear("geometry.jjk.sorcerer_gear_megumi")
    jjh_gear(g, c["jacket"], sole=(44, 44, 50))
    return s.img, g


def nobara():
    c = dict(skin=(242, 214, 196), hair=(198, 110, 56), hair_d=(140, 64, 34), hair_h=(236, 160, 96), iris=(150, 86, 40), brow=(150, 80, 44),
             jacket=NAVY, lip=(214, 110, 120), mouth=(170, 80, 90))
    s = Skin(5)
    head_base(s, c, 0, 0, 0)
    face(s, c, eyes="bright", brows="soft", mouth="smirk")
    hair_skin(s, c, front=3, fringe=[8, 8, 7, 7, 6, 6, 5, 5, 4, 4, 3, 3, 3, 3, 4, 4],
              side=[15, 15, 15, 15, 15, 15, 15, 15, 15, 15, 15, 14, 14, 13, 12, 12], side_hat=[14, 14, 14, 14, 14, 14, 14, 14, 14, 14, 14, 13, 13, 12, 11, 11],
              back=15, back_hat=14)
    J = c["jacket"]
    top, arm = jjh_uniform(c)
    belt, buckle = (96, 62, 40), (210, 178, 96)

    def body(f, u, v, wd, ht):
        if v in (19, 20):
            return buckle if (f == "front" and u in (7, 8)) else mul(belt, 1.08 if v == 19 else 0.9)
        return top(f, u, v, wd, ht)

    def legs(leg, f, u, v, wd, ht):
        if v >= 20:
            return mul((116, 74, 46), 1.12 if v == 20 else (0.7 if v == 23 else 1.0))  # loafers
        return s.cloth((32, 30, 36), f, u, v, wd, ht)                                  # black tights
    outfit(s, c, J, J, (32, 30, 36), (116, 74, 46), top_fn=body, arm_fn=arm, leg_fn=legs)
    for leg in ("rleg", "lleg"):
        s.paint(leg, SIDES, lambda f, u, v, wd, ht: s.cloth(mul(J, 1.04), f, u, v, wd, ht) if v < 8 else None, layer=1)   # the skirt
    bake(s)
    g = Gear("geometry.jjk.sorcerer_gear_nobara")
    collar(g, J, button=GOLD)
    coat_skirt(g, mul(J, 1.04), y0=8.0)
    cuffs(g, J)
    soles(g, (80, 50, 32))
    g.plain("handle", (120, 80, 46), 4, 12, 0.03, 1.1, 0.85)
    g.plain("hammer", (96, 98, 112), 8, 8, 0.03, 1.18, 0.8)
    hm = g.bone("g_hammer", "body")
    g.box(hm, (-5.5, 11.2, -1.0), (1.0, 4.6, 1.0), "handle")
    g.box(hm, (-6.2, 15.4, -1.7), (2.4, 1.7, 2.4), "hammer")
    return s.img, g


def maki():
    c = dict(skin=(238, 212, 192), hair=(44, 78, 58), hair_d=(22, 42, 32), hair_h=(84, 128, 98), iris=(158, 118, 60), brow=(34, 56, 44),
             jacket=NAVY, frame=(24, 24, 28))
    s = Skin(6)
    head_base(s, c, 0, 0, 0)
    face(s, c, eyes="sharp", brows="flat", mouth="line")
    hair_skin(s, c, front=3, fringe=[6, 7, 6, 5, 4, 3, 2, 2, 2, 2, 3, 4, 5, 6, 7, 6],
              side=[9, 9, 9, 9, 9, 8, 8, 8, 8, 8, 9, 10, 12, 13, 13, 12], side_hat=[8, 8, 8, 8, 8, 7, 7, 7, 7, 7, 8, 9, 11, 12, 12, 11],
              back=10, back_hat=9)
    J = c["jacket"]
    top, arm = jjh_uniform(c)
    outfit(s, c, J, J, (30, 32, 50), (28, 26, 30), top_fn=top, arm_fn=arm, leg_fn=boots((28, 26, 30), 3))
    bake(s)
    g = Gear("geometry.jjk.sorcerer_gear_maki")
    plain_tail(g, c, (0, 30.6, 4.7), (2.6, 7.0, 2.2), (24, 0, 0), tie=(36, 36, 40))
    glasses(g, c["frame"], None, y=26.1, h=2.7)
    jjh_gear(g, J, sole=(40, 38, 42), cuffs_=True)
    wide_legs(g, (30, 32, 50), y0=3.0)
    g.plain("shaft", (66, 48, 38), 4, 24, 0.04, 1.1, 0.85)
    g.swatch("blade", 4, 12, lambda u, v, wd, ht: (236, 240, 248) if u == 0 else (170, 176, 190))
    g.plain("wrap", (200, 40, 50), 4, 4, 0.02, 1.1, 0.85)
    on_back(g, [((-0.5, -2, -0.5), (1, 18, 1), "shaft"), ((-0.75, 16, -0.6), (1.5, 6, 1.2), "blade"),
                ((-0.6, 14.6, -0.6), (1.2, 1.4, 1.2), "wrap")], angle=-34)
    return s.img, g


def inumaki():
    c = dict(skin=(240, 220, 206), hair=(232, 226, 210), hair_d=(176, 168, 158), hair_h=(252, 250, 244), iris=(148, 116, 192),
             brow=(196, 186, 166), jacket=NAVY)
    s = Skin(7)
    head_base(s, c, 0, 0, 0)
    face(s, c, eyes="round", brows="soft", mouth="none")
    hair_skin(s, c, front=3, fringe=[5, 6, 6, 5, 6, 5, 4, 5, 6, 5, 4, 5, 6, 6, 5, 5],
              side=[10, 10, 10, 10, 9, 9, 8, 8, 8, 8, 8, 8, 9, 9, 8, 8], back=12)
    J = c["jacket"]
    top, arm = jjh_uniform(c, buttons=False)
    outfit(s, c, J, J, (28, 30, 48), (20, 20, 24), top_fn=top, arm_fn=arm, leg_fn=sneakers((20, 20, 24), (50, 50, 56)), shoe_rows=2)
    bake(s)
    g = Gear("geometry.jjk.sorcerer_gear_inumaki")
    high_collar(g, J, y_top=25.9, zipper=(214, 200, 126))                            # zipped up over the mouth
    hem(g, J)
    cuffs(g, J)
    soles(g, (50, 50, 56))
    return s.img, g


PANDA_FACE = ["WWWWWWWWWWWWWWWW",
              "WWWWWWWWWWWWWWWW",
              "WWWWWWWWWWWWWWWW",
              "WWWWWWWWWWWWWWWW",
              "WWWWWWWWWWWWWWWW",
              "WWWBBBWWWWBBBWWW",
              "WWBBBBBWWBBBBBWW",
              "WBBWPBBWWBBPWBBW",
              "WBBPPBBWWBBPPBBW",
              "WBBBBBWWWWBBBBBW",
              "WWBBBWWWWWWBBBWW",
              "WWWWWWWBBWWWWWWW",
              "WWWWWWBBBBWWWWWW",
              "WWWWWWWBBWWWWWWW",
              "WWWWWBWWWWBWWWWW",
              "WWWWWWBBBBWWWWWW"]


def panda():
    c = dict(skin=(238, 238, 234), hair=(238, 238, 234), black=(28, 28, 32), iris=(26, 26, 30), mouth=(40, 30, 30))
    s = Skin(8)
    B, Wt = c["black"], c["skin"]
    pal = {"W": Wt, "B": B, "P": (12, 12, 14)}
    s.paint("head", ("top", "bottom") + SIDES, lambda f, u, v, wd, ht: s.cloth(Wt, f, u, v, wd, ht, 0.02, 1.03, 0.95))
    s.rows("head", "front", PANDA_FACE, pal)
    s.put("head", "front", 4, 7, (255, 255, 255))
    s.put("head", "front", 11, 7, (255, 255, 255))

    def body(f, u, v, wd, ht):
        if v < 8:
            return s.cloth(B, f, u, v, wd, ht, 0.03)                                    # the black band over the shoulders
        if f == "front" and 4 <= u <= 11 and 10 <= v <= 21:
            return mul(Wt, 1.04)                                                         # belly
        return s.cloth(Wt, f, u, v, wd, ht, 0.03)
    outfit(s, c, Wt, B, B, B, hands=B, top_fn=body, sleeve_to=12, shoe_rows=1)
    bake(s)
    g = Gear("geometry.jjk.sorcerer_gear_panda")
    g.swatch("ear", 6, 6, lambda u, v, wd, ht: (58, 54, 58) if 2 <= u <= 3 and 2 <= v <= 3 else B)
    g.swatch("snout", 8, 6, lambda u, v, wd, ht: (24, 22, 26) if v <= 1 and 2 <= u <= 5 else (232, 232, 228))
    hb = g.bone("g_ears", "head")
    for x in (-4.6, 2.2):
        g.box(hb, (x, 31.0, -1.3), (2.4, 2.4, 1.5), "ear")
        g.box(hb, (x + 0.3, 33.3, -1.1), (1.8, 0.5, 1.1), "ear")
    g.box(hb, (-1.7, 25.0, -5.3), (3.4, 2.2, 1.5), "snout")
    g.plain("belly", Wt, 12, 14, 0.02, 1.06, 0.94)
    bb = g.bone("g_belly", "body")
    g.box(bb, (-3.2, 13.0, -2.9), (6.4, 7.0, 1.1), "belly")
    muscles(g, B)
    return s.img, g


def nanami():
    c = dict(skin=(236, 208, 184), hair=(226, 198, 126), hair_d=(170, 136, 78), hair_h=(250, 232, 172), iris=(70, 86, 70), brow=(170, 140, 80),
             frame=(46, 58, 44), lens=(120, 176, 136), mouth=(130, 70, 66))
    s = Skin(9)
    head_base(s, c, 0, 0, 0)
    face(s, c, eyes="sharp", brows="flat", mouth="line")
    hair_skin(s, c, front=3, fringe=[3, 3, 3, 3, 2, 3, 3, 4, 4, 6, 7, 5, 4, 3, 3, 3], part=4,
              side=[10, 10, 10, 9, 9, 8, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7], back=11)
    suit, shirt = (210, 192, 152), (66, 88, 122)
    leopard = lambda u, v: (122, 82, 34) if (u * 5 + v * 3) % 7 == 0 else ((92, 58, 24) if (u * 3 + v * 5) % 11 == 0 else (220, 178, 70))

    def top(f, u, v, wd, ht):
        if f == "front":
            if u in (7, 8) and v < 17:
                return shirt if v < 2 else leopard(u, v)                                  # the leopard tie
            if 5 <= u <= 10 and v < 12:
                return mul(shirt, 1.06 - 0.01 * v)                                       # the shirt, between the lapels
            if v in (15, 16) and (u <= 2 or u >= 13):
                return mul(suit, 0.84)                                                   # pockets
            if u in (4, 11) and v < 14:
                return mul(suit, 0.86)                                                   # lapel edges
        return None
    outfit(s, c, suit, suit, mul(suit, 0.92), (88, 58, 38), top_fn=top, leg_fn=sneakers((88, 58, 38), (60, 40, 26), rows=1))
    bake(s)
    g = Gear("geometry.jjk.sorcerer_gear_nanami")
    glasses(g, c["frame"], c["lens"], y=26.1, h=2.7)
    lapels(g, suit)
    g.swatch("cloth", 8, 24, lambda u, v, wd, ht: (40, 40, 52) if (u + v * 2) % 6 == 0 else (232, 232, 234))
    on_back(g, [((-0.9, -2, -0.6), (1.8, 16, 1.2), "cloth")], angle=-40)
    soles(g, (60, 40, 26))
    return s.img, g


def mei_mei():
    c = dict(skin=(244, 226, 214), hair=(234, 232, 240), hair_d=(170, 166, 186), hair_h=(255, 255, 255), iris=(110, 96, 150),
             brow=(200, 196, 210), lip=(214, 104, 124), mouth=(180, 80, 100))
    s = Skin(10)
    head_base(s, c, 0, 0, 0)
    face(s, c, eyes="closed", brows="none", mouth="small_smile")
    hair_skin(s, c, front=4, fringe=[9, 10, 9, 10, 9, 9, 8, 8, 8, 8, 9, 9, 10, 9, 10, 9], side=16, side_hat=15, back=16, back_hat=16)
    dress = (30, 28, 36)

    def top(f, u, v, wd, ht):
        if f == "front" and u in (7, 8) and v in (4, 5, 10, 11, 16, 17):
            return GOLD
        if v < 3:
            return mul(dress, 1.3)
        return None
    outfit(s, c, dress, dress, dress, (20, 18, 22), top_fn=top, leg_fn=boots((26, 24, 30), 5))
    hair_on(s, c, "body", "back", 18)                                                  # long hair down the back
    bake(s)
    g = Gear("geometry.jjk.sorcerer_gear_mei_mei")
    H = Hair(g, c["hair"], c["hair_d"], c["hair_h"], name="g_braid_h")
    braid = g.bone("g_braid", "head", (-3.0, 25.5, -3.2), (6, 0, -6))
    for i in range(7):
        H.slab((-4.3 + (i % 2) * 0.3, 25.5 - (i + 1) * 2.05, -4.15), (2.3, 2.2, 2.3), bone=braid)
    g.plain("tip", (36, 36, 44), 4, 4, 0.02, 1.1, 0.9)
    g.box(braid, (-3.95, 10.4, -3.8), (1.6, 1.0, 1.6), "tip")
    collar(g, dress)
    g.plain("shaft", (54, 40, 34), 4, 24, 0.04, 1.1, 0.85)
    g.swatch("axe", 12, 12, lambda u, v, wd, ht: (204, 208, 218) if u < wd - 2 else (244, 246, 252))
    on_back(g, [((-0.6, -2, -0.6), (1.2, 18, 1.2), "shaft"), ((0.6, 11, -0.5), (5, 6, 1.0), "axe")], angle=-32)
    g.swatch("crow", 8, 8, lambda u, v, wd, ht: (44, 40, 54) if (u + v) % 3 == 0 else (24, 22, 28))
    cb = g.bone("g_crow", "body", (5, 24, 0))
    g.box(cb, (4.2, 24.0, -1.0), (2.2, 2.0, 3.0), "crow")
    g.box(cb, (4.6, 25.6, -2.0), (1.4, 1.4, 1.4), "crow")
    g.plain("beak", (214, 172, 60), 4, 4, 0.02, 1.1, 0.85)
    g.box(cb, (4.9, 25.9, -2.8), (0.8, 0.6, 0.8), "beak")
    g.box(cb, (4.6, 23.8, 1.9), (1.4, 0.6, 1.6), "crow")
    return s.img, g


def todo():
    c = dict(skin=(212, 166, 126), hair=(40, 34, 34), hair_d=(18, 14, 16), hair_h=(84, 74, 72), iris=(56, 44, 36), brow=(36, 28, 26),
             jacket=NAVY, scar=(168, 98, 88), mouth=(110, 54, 50))
    s = Skin(11)
    head_base(s, c, 0, 0, 0)
    scar = [(11, v, "O") for v in range(4, 13)] + [(10, 6, "o"), (12, 9, "o")]
    face(s, c, eyes="sharp", brows="angry_thick", mouth="grin", extra=scar)
    hair_skin(s, c, front=2, fringe=0, side=[7, 7, 7, 7, 7, 6, 6, 6, 6, 6, 6, 7, 8, 9, 9, 8], back=9)
    tank = (232, 230, 222)
    J = c["jacket"]

    def top(f, u, v, wd, ht):
        if f == "front" and 4 <= u <= 11:
            return s.cloth(tank, f, u, v, wd, ht, 0.03)                                  # the tank top under the open jacket
        return None
    outfit(s, c, J, J, (28, 30, 48), (24, 22, 24), top_fn=top, sleeve_to=6, leg_fn=sneakers((24, 22, 24), (60, 56, 56)), shoe_rows=2)
    bake(s)
    g = Gear("geometry.jjk.sorcerer_gear_todo")
    plain_bun(g, c, (0, 33.0, 0.8), r=1.5)
    muscles(g, c["skin"])
    lapels(g, J)
    soles(g, (60, 56, 56))
    return s.img, g


def yuta():
    c = dict(skin=(236, 214, 200), hair=(34, 34, 44), hair_d=(14, 14, 20), hair_h=(84, 86, 110), iris=(64, 62, 74), brow=(30, 30, 38),
             jacket=(234, 234, 240), bags=(204, 178, 184))
    s = Skin(12)
    head_base(s, c, 0, 0, 0)
    face(s, c, eyes="tired", brows="worried", mouth="small_smile")
    hair_skin(s, c, front=3, fringe=[7, 6, 7, 8, 6, 7, 7, 5, 6, 7, 8, 6, 7, 6, 7, 6],
              side=[12, 12, 12, 12, 11, 11, 10, 10, 10, 10, 10, 11, 11, 11, 10, 10], back=14)
    J = c["jacket"]
    top, arm = jjh_uniform(dict(c, gold=(206, 176, 86)))
    outfit(s, c, J, J, mul(J, 0.9), (30, 30, 34), top_fn=top, arm_fn=arm, leg_fn=sneakers((30, 30, 34), (70, 70, 76)), shoe_rows=2)
    bake(s)
    g = Gear("geometry.jjk.sorcerer_gear_yuta")
    jjh_gear(g, J, sole=(70, 70, 76), button=(206, 176, 86))
    g.swatch("sheath", 4, 24, lambda u, v, wd, ht: (24, 22, 28) if v > 3 else (156, 124, 62))
    g.swatch("hilt", 4, 8, lambda u, v, wd, ht: (232, 228, 218) if (u + v) % 2 else (40, 36, 40))
    on_back(g, [((-0.6, -2, -0.6), (1.2, 14, 1.2), "sheath"), ((-0.5, 12, -0.5), (1.0, 4.6, 1.0), "hilt")], angle=-36)
    return s.img, g


def hakari():
    c = dict(skin=(232, 202, 178), hair=(222, 204, 150), hair_d=(160, 140, 96), hair_h=(248, 238, 200), iris=(110, 108, 118),
             brow=(150, 130, 90), jacket=(30, 32, 40), mouth=(130, 64, 64))
    s = Skin(18)
    head_base(s, c, 0, 0, 0)
    face(s, c, eyes="sharp", brows="raised", mouth="grin")
    # slicked straight back: a high hairline, the hair combed up off the forehead, the sides shaved short and dark
    hair_skin(s, c, front=4, fringe=[3, 4, 4, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 4, 4, 3],
              side=[11, 11, 11, 11, 11, 11, 11, 11, 11, 10, 10, 10, 10, 9, 9, 9], side_hat=[4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4],
              back=12, back_hat=5, under=(74, 66, 60), under_rows=8)
    J = c["jacket"]
    shirt = (236, 234, 226)

    def top(f, u, v, wd, ht):
        if f == "front" and 5 <= u <= 10:
            return s.cloth(shirt, f, u, v, wd, ht, 0.02)                                 # the shirt under the open jacket
        if f == "front" and u in (4, 11):
            return mul(J, 1.25)
        return None
    outfit(s, c, J, J, (32, 34, 46), (232, 230, 222), top_fn=top, leg_fn=sneakers((232, 230, 222), (36, 36, 40)), shoe_rows=2)
    bake(s)
    g = Gear("geometry.jjk.sorcerer_gear_hakari")
    g.swatch("chain", 8, 4, lambda u, v, wd, ht: mul(GOLD, 1.18) if (u + v) % 2 == 0 else mul(GOLD, 0.78))
    cb = g.bone("g_chain", "body")
    g.box(cb, (-2.6, 21.0, -2.35), (5.2, 0.6, 0.3), "chain")
    g.box(cb, (-2.9, 21.4, -2.35), (0.6, 2.6, 0.3), "chain")
    g.box(cb, (2.3, 21.4, -2.35), (0.6, 2.6, 0.3), "chain")
    lapels(g, mul(J, 1.2))
    hem(g, J)
    cuffs(g, J)
    soles(g, (36, 36, 40))
    return s.img, g


def sukuna():
    c = dict(skin=(236, 200, 182), hair=(238, 146, 158), hair_d=(170, 86, 104), hair_h=(255, 190, 198), iris=(210, 30, 40),
             brow=(40, 24, 28), mark=(24, 16, 20), mouth=(80, 18, 24), black=(24, 22, 26), red=(200, 30, 40))
    s = Skin(2)
    head_base(s, c, 0, 0, 0)
    marks = []
    for x0 in (2, 11):                                                                  # the second pair of eyes, under the first
        marks += [(x0 + i, 12, "X") for i in range(3)] + [(x0 + 1, 13, "R")]
    face(s, c, eyes="fierce", brows="angry_thick", mouth="grin", mouth_y=13, extra=marks)
    hair_skin(s, c, front=2, fringe=[2, 3, 3, 2, 2, 3, 2, 1, 1, 2, 3, 2, 2, 3, 3, 2],
              side=[11, 11, 11, 11, 11, 10, 10, 10, 9, 9, 9, 8, 8, 8, 8, 8], side_hat=[7, 7, 7, 7, 7, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6],
              back=12, back_hat=8, under=(70, 44, 44), under_rows=4)
    Wt, B = (240, 236, 228), (30, 28, 32)

    def kimono(f, u, v, wd, ht):
        if f == "front" and v < 10 and abs(u - 7.5) < 4.5 - v * 0.45:
            return c["skin"]                                                             # the V of the collar
        if f == "front" and v < 14 and abs(abs(u - 7.5) - (4.5 - v * 0.45)) < 0.9:
            return mul(Wt, 0.8)
        if v in (14, 15, 16):
            return B if v != 16 else mul(B, 1.4)                                          # the obi
        return None

    def tattoo_arm(arm, f, u, v, wd, ht):
        if v < 8:
            return s.cloth(Wt, f, u, v, wd, ht)
        if v in (12, 13, 18, 19):
            return c["mark"]                                                             # the black bands round his arms
        return None
    outfit(s, c, Wt, Wt, (34, 32, 38), (40, 34, 30), top_fn=kimono, arm_fn=tattoo_arm, sleeve_to=4, leg_fn=sandals(c["skin"]))
    bake(s)
    g = Gear("geometry.jjk.sorcerer_gear_sukuna")
    g.swatch("scarf", 16, 4, lambda u, v, wd, ht: (40, 32, 40) if v < 2 else (28, 22, 28))
    sc = g.bone("g_scarf", "body")
    g.box(sc, (-4, 22.4, -2), (8, 1.5, 4), "scarf", faces={"up": None, "down": None}, inflate=0.55)
    g.swatch("obi", 16, 4, lambda u, v, wd, ht: (30, 28, 34) if v < 2 else (52, 48, 56))
    g.box(sc, (-4, 14.6, -2), (8, 2.0, 4), "obi", faces={"up": None, "down": None}, inflate=0.4)
    g.swatch("arm", 8, 24, lambda u, v, wd, ht: c["mark"] if v in (8, 9, 14, 15) else mul(c["skin"], 1.02 - 0.12 * v / ht))
    for side, name in ((-1, "g_arm3"), (1, "g_arm4")):
        b = g.bone(name, "body", (side * 4.4, 17, -0.5), (-50, side * 10, side * 28))
        g.box(b, (side * 4.4 - 1.5, 7, -2), (3, 10, 3), "arm")
        g.box(b, (side * 4.4 - 1.3, 5.4, -1.8), (2.6, 1.8, 2.6), "arm")
    wide_legs(g, (40, 38, 46))
    return s.img, g


def toji():
    c = dict(skin=(228, 196, 170), hair=(30, 30, 36), hair_d=(12, 12, 16), hair_h=(76, 78, 92), iris=(70, 120, 84), brow=(26, 26, 30),
             scar=(196, 150, 140), mouth=(120, 64, 64))
    s = Skin(13)
    head_base(s, c, 0, 0, 0)
    face(s, c, eyes="sharp", brows="flat", mouth="smirk", extra=[(5, 11, "O"), (5, 12, "O"), (6, 13, "O"), (6, 14, "O"), (5, 15, "o")])
    hair_skin(s, c, front=3, fringe=[6, 5, 7, 5, 6, 4, 5, 6, 4, 6, 5, 7, 5, 6, 5, 6],
              side=[9, 9, 9, 9, 8, 8, 7, 7, 7, 7, 8, 8, 8, 8, 8, 8], back=11)
    shirt, pants = (28, 28, 32), (222, 218, 206)
    outfit(s, c, shirt, shirt, pants, (24, 22, 24), sleeve_to=4, leg_fn=sneakers((24, 22, 24), (40, 40, 44)), shoe_rows=2)
    bake(s)
    g = Gear("geometry.jjk.sorcerer_gear_toji")
    muscles(g, c["skin"])
    wide_legs(g, pants)
    g.swatch("worm", 8, 8, lambda u, v, wd, ht: (134, 82, 154) if (u // 2 + v // 2) % 2 else (98, 58, 120))
    wb = g.bone("g_worm", "body")
    for i in range(9):
        a = i / 9 * math.pi * 2
        g.box(wb, (math.cos(a) * 4.5 - 1.1, 14.0 + i * 0.8, math.sin(a) * 2.7 - 1.1), (2.2, 1.6, 2.2), "worm")
    g.swatch("worm_eye", 4, 4, lambda u, v, wd, ht: (236, 226, 120) if u < 2 else (20, 16, 20))
    g.box(wb, (3.4, 21.0, -2.9), (1.6, 1.6, 1.0), "worm_eye")
    soles(g, (40, 40, 44))
    return s.img, g


def geto():
    c = dict(skin=(238, 216, 200), hair=(32, 30, 36), hair_d=(12, 12, 16), hair_h=(80, 78, 92), iris=(52, 44, 40), brow=(30, 28, 32),
             scar=(150, 104, 104), mouth=(130, 70, 72))
    s = Skin(14)
    head_base(s, c, 0, 0, 0)
    face(s, c, eyes="squint", brows="soft", mouth="smile")
    stitches(s, [(u, 4) for u in range(2, 14)], c["scar"])                              # Kenjaku's stitches across the brow
    hair_skin(s, c, front=3, fringe=[12, 11, 4, 3, 2, 1, 1, 1, 1, 1, 1, 1, 2, 2, 3, 3], side=16, side_hat=15, back=16)
    robe, kesa = (30, 28, 34), (198, 122, 50)

    def top(f, u, v, wd, ht):
        if f == "front" and abs(u - (12 - v * 0.55)) < 1.8 and v < 22:
            return mul(kesa, 1.0 + (0.1 if v % 6 < 2 else 0))                          # the kesa over one shoulder
        if f == "back" and abs(u - (3 + v * 0.55)) < 1.8 and v < 22:
            return kesa
        return None
    outfit(s, c, robe, robe, robe, (60, 44, 34), top_fn=top, leg_fn=sandals(c["skin"]))
    hair_on(s, c, "body", "back", 10)                                                  # the loose hair over the shoulders
    bake(s)
    g = Gear("geometry.jjk.sorcerer_gear_geto")
    plain_bun(g, c, (0, 31.6, 3.9), r=1.6)
    earrings(g, (44, 44, 52), big=True, y=25.6)
    coat_skirt(g, robe, y0=4.5)
    g.plain("kesa", kesa, 4, 24, 0.04, 1.1, 0.88)
    kb = g.bone("g_kesa", "body")
    g.box(kb, (-0.9, 12.6, -2.6), (1.8, 13.0, 0.4), "kesa", rotation=[0, 0, 30], pivot=(0, 18, -2.4))
    return s.img, g


def mahito():
    c = dict(skin=(220, 220, 226), hair=(148, 166, 196), hair_d=(96, 110, 142), hair_h=(198, 212, 232), iris=(96, 156, 226),
             brow=(120, 136, 168), mark=(70, 60, 84), mouth=(90, 50, 70))
    s = Skin(15)
    head_base(s, c, 0, 0, 0)
    face(s, c, eyes="wide", brows="raised", mouth="evil_grin")
    recolor_eye(s, c, (150, 172, 140), left=True)                                      # one eye of each colour
    stitches(s, [(4, v) for v in list(range(2, 7)) + list(range(12, 16))], c["mark"])  # the seam down his face (round the eye)...
    stitches(s, [(u, 11) for u in range(6, 13)], c["mark"])                             # ...and across his nose
    hair_skin(s, c, front=3, fringe=[7, 8, 6, 7, 9, 7, 5, 4, 4, 6, 8, 7, 9, 7, 8, 7], side=16, side_hat=15, back=16)
    shirt, patch, pants = (198, 200, 208), (150, 162, 186), (40, 40, 54)

    def top(f, u, v, wd, ht):
        if (u * 3 + v * 7) % 23 == 0:
            return c["mark"]                                                             # stitches
        if (u // 6 + v // 8) % 3 == 0:
            return s.cloth(patch, f, u, v, wd, ht, 0.02)                                 # patches
        return None

    def arms(arm, f, u, v, wd, ht):
        if v >= 12 and (v == 16 or (u + v) % 9 == 0):
            return c["mark"]
        return None
    outfit(s, c, shirt, shirt, pants, (30, 28, 34), top_fn=top, arm_fn=arms, sleeve_to=6)
    hair_on(s, c, "body", "back", 6)
    bake(s)
    g = Gear("geometry.jjk.sorcerer_gear_mahito")
    wide_legs(g, pants, y0=2.0)
    return s.img, g


def choso():
    c = dict(skin=(230, 206, 190), hair=(30, 28, 34), hair_d=(12, 10, 14), hair_h=(76, 70, 84), iris=(86, 40, 52), brow=(26, 24, 28),
             mark=(52, 24, 34), mouth=(120, 64, 68))
    s = Skin(16)
    head_base(s, c, 0, 0, 0)
    face(s, c, eyes="tired", brows="flat", mouth="line", mouth_y=13,
         extra=[(u, 10, "X") for u in range(0, 16)])                                     # the blood mark across his nose
    hair_skin(s, c, front=3, fringe=[7, 6, 5, 6, 4, 3, 2, 2, 2, 2, 3, 4, 6, 5, 6, 7],
              side=[10, 10, 10, 10, 9, 9, 9, 9, 9, 9, 10, 10, 11, 11, 11, 10], back=12)
    robe, inner = (222, 216, 208), (72, 56, 82)

    def top(f, u, v, wd, ht):
        if f == "front" and 4 <= u <= 11 and v < 20:
            return s.cloth(inner, f, u, v, wd, ht, 0.03)
        return None
    outfit(s, c, robe, robe, (60, 50, 72), (30, 28, 32), top_fn=top, leg_fn=sandals(c["skin"], (40, 34, 40)))
    bake(s)
    g = Gear("geometry.jjk.sorcerer_gear_choso")
    for sgn, name in ((-1, "g_pig_r"), (1, "g_pig_l")):                                  # two short pigtails
        plain_tail(g, c, (sgn * 4.4, 30.8, 2.2), (2.0, 2.8, 2.0), (20, 0, -sgn * 50), name=name, tie=(26, 24, 30))
    wide_legs(g, (60, 50, 72))
    return s.img, g


JOGO_FACE = ["................",
             "................",
             "................",
             "................",
             "......LLLL......",
             ".....LEEEEL.....",
             "....LEEIIEEL....",
             "....LEIPPIEL....",
             "....LEIPPIEL....",
             "....LEEJJEEL....",
             ".....LEEEEL.....",
             "......LLLL......",
             "................",
             "...MTMTMTMTMM...",
             "....MMMMMMMM....",
             "................"]


def jogo():
    c = dict(skin=(228, 216, 194), hair=(84, 72, 66), iris=(220, 170, 60), mouth=(40, 30, 30), lash=(50, 40, 40))
    s = Skin(17)
    head_base(s, c, 0, 0, 0, top=False)
    pal = palette(c)
    s.rows("head", "front", JOGO_FACE, pal)
    s.put("head", "front", 7, 7, (255, 255, 255))
    s.paint("head", ("top",), lambda f, u, v, wd, ht: mul(c["skin"], 0.95 + 0.06 * ((u + v) % 3 == 0)))
    robe, sash = (112, 110, 120), (40, 36, 46)

    def top(f, u, v, wd, ht):
        if v in (14, 15, 16):
            return sash
        if f == "front" and v < 10 and abs(u - 7.5) < 4.5 - v * 0.45:
            return c["skin"]
        return None
    outfit(s, c, robe, robe, mul(robe, 0.9), (40, 36, 34), top_fn=top, leg_fn=sandals(c["skin"], (46, 40, 36)))
    bake(s)
    g = Gear("geometry.jjk.sorcerer_gear_jogo")
    # the volcano is his head: his own pale skin, a dark crater rim, lava inside
    g.swatch("rock", 16, 12, lambda u, v, wd, ht: mul(c["skin"], 1.02 - 0.16 * v / ht - (0.06 if (u * 3 + v) % 7 == 0 else 0)))
    g.swatch("rim", 16, 4, lambda u, v, wd, ht: mul((70, 58, 54), 1.1 - 0.1 * v))
    g.swatch("lava", 8, 8, lambda u, v, wd, ht: (255, 150 + (u * 20) % 60, 40))
    vb = g.bone("g_volcano", "head")
    for i, (wd, ht) in enumerate(((8.6, 1.8), (7.0, 1.8), (5.6, 1.8))):
        y = 31.4 + i * 1.8
        g.box(vb, (-wd / 2, y, -wd / 2), (wd, ht, wd), "rock", faces={"up": "rim" if i == 2 else "rock"})
    g.box(vb, (-2.0, 36.4, -2.0), (4.0, 0.2, 4.0), "lava")
    for x, z in ((-2.9, -2.9), (2.1, -3.3), (-0.4, -4.0)):
        g.box(vb, (x, 32.4, z - 0.5), (0.8, 3.2, 0.5), "lava")
    g.swatch("obi", 16, 4, lambda u, v, wd, ht: (40, 36, 46) if v < 2 else (60, 56, 66))
    ob = g.bone("g_obi", "body")
    g.box(ob, (-4, 14.6, -2), (8, 2.0, 4), "obi", faces={"up": None, "down": None}, inflate=0.4)
    coat_skirt(g, robe, y0=6.0)
    return s.img, g


def naoya():
    c = dict(skin=(238, 214, 196), hair=(236, 210, 124), hair_d=(184, 150, 76), hair_h=(252, 238, 176), iris=(186, 146, 72),
             brow=(60, 50, 40), mouth=(140, 70, 72))
    s = Skin(19)
    head_base(s, c, 0, 0, 0)
    face(s, c, eyes="narrow", brows="raised", mouth="smirk")
    hair_skin(s, c, front=2, fringe=[6, 5, 4, 6, 5, 3, 4, 5, 3, 4, 6, 5, 4, 6, 5, 4],
              side=[11, 11, 11, 11, 10, 10, 10, 10, 10, 10, 9, 9, 9, 9, 9, 9], side_hat=[6, 6, 6, 6, 6, 6, 6, 5, 5, 5, 5, 5, 5, 5, 5, 5],
              back=12, back_hat=7, under=(34, 30, 28), under_rows=5)
    haori, kimono, hakama = (40, 44, 46), (210, 204, 190), (54, 58, 62)

    def top(f, u, v, wd, ht):
        if f == "front" and 4 <= u <= 11 and v < 16:
            if abs(u - 7.5) < 3.2 - v * 0.2:
                return c["skin"] if v < 4 else kimono
            return kimono
        if v in (16, 17, 18):
            return (150, 120, 70) if v < 18 else mul((150, 120, 70), 0.8)               # the obi
        return None
    outfit(s, c, haori, haori, hakama, (40, 34, 30), top_fn=top, leg_fn=sandals(c["skin"], (40, 34, 30)))
    bake(s)
    g = Gear("geometry.jjk.sorcerer_gear_naoya")
    earrings(g, (214, 214, 224))
    g.plain("sleeve", haori, 8, 12, 0.03, 1.05, 0.85)
    for arm, x in (("rightArm", -8.4), ("leftArm", 4.0)):
        b = g.bone(f"g_sleeve_{arm}", arm)
        g.box(b, (x, 11.0, -2.4), (4.4, 6.0, 4.8), "sleeve")                            # the haori's hanging sleeves
    wide_legs(g, hakama)
    return s.img, g


# id: (name, side, clan, look builder, scale, spawn egg colours) — new characters go at the end
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
    "hakari": ("Kinji Hakari", "ally", "clanless", hakari, 1.08, ("#c89860", "#22253a")),
    "naoya": ("Naoya Zen'in", "villain", "zenin", naoya, 1.02, ("#ecd078", "#282c2e")),
}


# health, melee damage, speed — allies are strong teammates, villains are bosses
STATS = {"gojo": (400, 12, 0.32), "yuji": (160, 9, 0.33), "megumi": (130, 6, 0.3), "nobara": (110, 6, 0.3), "maki": (160, 10, 0.34),
         "inumaki": (100, 5, 0.3), "panda": (200, 9, 0.28), "nanami": (220, 10, 0.3), "mei_mei": (200, 10, 0.3), "todo": (240, 11, 0.32),
         "yuta": (300, 11, 0.32), "sukuna": (3000, 20, 0.33), "toji": (900, 16, 0.38), "geto": (1400, 12, 0.3), "mahito": (1000, 12, 0.32),
         "choso": (800, 11, 0.3), "jogo": (1100, 12, 0.28), "hakari": (240, 10, 0.31), "naoya": (950, 14, 0.36)}
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


CURSE_PLAYER = {"test": "has_tag", "subject": "other", "value": "jjk_curse"}  # a player who chose the curse's path
KIN = {"mahito", "jogo", "geto", "choso"}  # villains who are curses, or on their side: they spare Cursed Spirit players


def ally_group():
    """Jujutsu High: fights curses (Cursed Spirit players too), villains and monsters (never creepers), never other players
    on its own (the script runs spars); right-click to talk."""
    return {
        "minecraft:type_family": {"family": ["sorcerer", "jjk_ally", "mob"]},
        "minecraft:behavior.hurt_by_target": {"priority": 1, "entity_types": {"filters": {"any_of": [fam("player", "!="), CURSE_PLAYER]}}},
        "minecraft:behavior.nearest_attackable_target": {"priority": 3, "must_see": False, "reselect_targets": True, "within_radius": 24,
            "entity_types": [{"filters": {"any_of": [fam("curse"), fam("jjk_villain"), {"all_of": [fam("monster"), fam("creeper", "!=")]},
                                                     {"all_of": [fam("player"), {"test": "has_tag", "subject": "other", "value": "jjk_spar"}]},
                                                     {"all_of": [fam("player"), CURSE_PLAYER]}]},
                              "max_dist": 24}]},
        "minecraft:interact": {"interactions": [{"on_interact": {"filters": fam("player"), "event": "jjk:talked", "target": "self"},
                                                 "interact_text": "Talk", "swing": True}]},
    }


def villain_group(kin=False):
    """A villain: hunts players, Jujutsu High and shikigami; stays until it's beaten (or left alone, see sorcerers.js).
    A kin villain (KIN) spares Cursed Spirit players — unless they attack it."""
    players = {"all_of": [fam("player"), {**CURSE_PLAYER, "operator": "!="}]} if kin else fam("player")
    return {
        "minecraft:type_family": {"family": ["sorcerer", "jjk_villain", "monster", "mob"]},
        "minecraft:behavior.hurt_by_target": {"priority": 1},
        "minecraft:behavior.nearest_attackable_target": {"priority": 3, "must_see": False, "reselect_targets": True, "within_radius": 32,
            "entity_types": [{"filters": {"any_of": [players, fam("jjk_ally"), fam("shikigami")]}, "max_dist": 32}]},
        "minecraft:persistent": {},
        "minecraft:experience_reward": {"on_death": "q.last_hit_by_player ? 120 : 0"},
    }


# swaying bones (animation.jjk.sorcerer_gear.sway)
SWAY = {
    "g_tail": {"rotation": ["math.sin(q.life_time * 200) * 5 - q.modified_move_speed * 14", 0, "math.sin(q.life_time * 150) * 4"]},
    "g_braid": {"rotation": ["math.sin(q.life_time * 160) * 3 + q.modified_move_speed * 10", 0, "math.sin(q.life_time * 120) * 3"]},
    "g_hood": {"rotation": ["q.modified_move_speed * 8", 0, 0]},
    "g_skirt": {"rotation": ["q.modified_move_speed * 6", 0, 0]},
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
    # the cast's own body: the vanilla humanoid's bones, with 128x128 skins
    w(RP / "models" / "entity" / "sorcerer_body.geo.json", body_geometry())
    # client entity: one skin per character + its gear, picked by q.property('jjk:npc')
    textures = {f"s{i}": f"textures/entity/jjk/sorcerer/{n}" for i, n in enumerate(names)}
    textures.update({f"gear_{n}": f"textures/entity/jjk/sorcerer/gear_{n}" for n in names})
    geos = {"default": "geometry.jjk.sorcerer_body", **{f"gear_{n}": f"geometry.jjk.sorcerer_gear_{n}" for n in names}}
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
    groups["jjk:villain_kin"] = villain_group(kin=True)
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
        side_grp = "jjk:villain_kin" if side == "villain" and n in KIN else f"jjk:{side}"
        events[f"jjk:as_{n}"] = {"set_property": {"jjk:npc": i},
                                 "add": {"component_groups": [f"jjk:c_{n}", side_grp]},
                                 "remove": {"component_groups": [f"jjk:c_{o}" for o in names if o != n]
                                            + [g for g in ("jjk:ally", "jjk:villain", "jjk:villain_kin") if g != side_grp]}}
    events["jjk:despawn"] = {"add": {"component_groups": ["jjk:despawn"]}}
    events["jjk:talked"] = {}
    events["jjk:wanderer"] = {"add": {"component_groups": ["jjk:wanderer"]}}
    events["jjk:stay"] = {"add": {"component_groups": ["jjk:stay"]}}
    events["jjk:move"] = {"remove": {"component_groups": ["jjk:stay"]}}
    # a spawn egg rolls a number; the script turns it into a random member of Jujutsu High (sorcerers.js)
    events["minecraft:entity_spawned"] = {"set_property": {"jjk:roll": "math.random_integer(1, 99)"}}
    w(BP / "entities" / "sorcerer.json", {"format_version": "1.21.0", "minecraft:entity": {
        "description": {"identifier": "jjk:sorcerer", "is_spawnable": True, "is_summonable": True, "is_experimental": False,
                        "properties": {"jjk:npc": {"type": "int", "range": [0, len(names) - 1], "default": 0, "client_sync": True},
                                       "jjk:roll": {"type": "int", "range": [0, 99], "default": 0, "client_sync": False}}},
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
def preview(out, only=None, size=(300, 380)):
    sys.path.insert(0, str(ROOT.parent / "shinobi-addon" / "tools"))
    import cine_preview as CP
    from PIL import ImageDraw

    body = body_geometry()["minecraft:geometry"][0]["bones"]
    pose = {"bones": {"rightArm": {"rotation": [-14, 0, 4]}, "leftArm": {"rotation": [10, 0, -4]},
                      "rightLeg": {"rotation": [8, 0, 0]}, "leftLeg": {"rotation": [-8, 0, 0]}, "head": {"rotation": [-2, 10, 0]}}}
    names = [n for n in ROSTER if not only or n in only]
    cw, ch = size
    # (forward, right, height) of the camera and the height it looks at, in blocks (x the character's scale)
    views = [("front", (2.9, 1.4, 1.5), 1.05, 44), ("back", (-2.9, -1.4, 1.6), 1.05, 44), ("face", (1.25, 0.45, 1.78), 1.72, 40)]
    img = Image.new("RGB", (cw * len(views), ch * len(names)), (24, 22, 28))
    d = ImageDraw.Draw(img)
    for k, n in enumerate(names):
        scale = ROSTER[n][4]
        skin, g = ROSTER[n][3]()
        place = lambda q, s_: (q[0] * CP.PX * s_ * scale, q[1] * CP.PX * s_ * scale, q[2] * CP.PX * s_ * scale)
        quads = CP.model_quads(CP.Model(body, skin), pose, 0, place)
        quads += CP.model_quads(CP.Model(g.json()["minecraft:geometry"][0]["bones"], g.tex), pose, 0, place)
        for vi, (label, (f, r, h), lh, fov) in enumerate(views):
            cam = CP.Camera(CP.scene_pt(f * scale, r * scale, h * scale), CP.scene_pt(0, 0, lh * scale), cw, ch, fov=fov)
            frame = CP.render(cam, [quads], sky=((44, 42, 54), (82, 78, 94)))
            img.paste(frame, (vi * cw, k * ch))
            d.text((vi * cw + 6, k * ch + 4), f"{ROSTER[n][0]} — {label}", fill=(255, 255, 255))
    img.save(out)
    print(f"wrote {out}")


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
