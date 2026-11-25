#!/usr/bin/env python3
"""The Jujutsu Kaisen cast as NPCs: a painted 64x64 skin (both layers) plus a 3D gear model for each character (hair,
collars, hoods, extra arms, weapons on the back...), all drawn on ONE entity, jjk:sorcerer, whose int property
jjk:npc picks the character (its position in ROSTER). The painting and modelling kit is tools/sorcerer_kit.py.

  Jujutsu High (allies): Satoru Gojo, Yuji Itadori, Megumi Fushiguro, Nobara Kugisaki, Maki Zen'in, Toge Inumaki, Panda,
    Kento Nanami, Mei Mei, Aoi Todo, Yuta Okkotsu, Kinji Hakari
  Villains (bosses): Ryomen Sukuna (four arms), Toji Fushiguro, Suguru Geto (Kenjaku), Mahito, Choso, Jogo, Naoya Zen'in

Writes: textures/entity/jjk/sorcerer/<id>.png and gear_<id>.png, models/entity/sorcerer_gear_<id>.geo.json, the client
and BP entity, render controllers, the gear sway animation, names, and behavior_pack/scripts/roster_ids.js (the
index of every character, read by sorcerers.js — never edit it by hand). New characters go at the END of ROSTER
(the index is stored on every NPC already in a world).

Same conventions as every model here: 16 px = 1 block, the front is -Z, the character's right is -X. Gear bones are
named like the body's (head, body, rightArm...), so the walk, look and attack animations move the gear too.

  python3 tools/gen_sorcerers.py                         # build everything
  python3 tools/gen_sorcerers.py --preview out.png       # front and back of everyone (needs ../shinobi-addon/tools)
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
    SIDES, NONE, Skin, Gear, w, mul, mix, uv, ring, head, outfit, jjh_uniform, sneakers, sandals, bake, hair_tex, spikes,
    hair_cap, fringe, sideburns, collar, hem, cuffs, soles, muscles, on_back, BONE_PIVOT,
)

ROOT = Path(__file__).resolve().parent.parent
BP, RP = ROOT / "behavior_pack", ROOT / "resource_pack"
SK = RP / "textures" / "entity" / "jjk" / "sorcerer"
NAVY = (34, 37, 58)
GOLD = (226, 186, 80)


# ===========================================================================
# Shared pieces
# ===========================================================================
def glasses(g, frame, lens=None, y=25.7, h=2.6, name="g_glasses"):
    """3D glasses: a frame plate in front of the eye rows; lens=None leaves the lenses see-through."""
    def fn(u, v, wd, ht):
        inside = 1 <= v <= ht - 2 and (1 <= u <= 2 or 5 <= u <= 6)
        if inside:
            return lens
        return frame
    r = g.region(8, 6, fn)
    b = g.bone(name, "head", (0, 24, 0))
    g.cube(b, (-4.1, y, -4.45), (8.2, h, 0.3), uv(north=r, south=r, rest=(r[0], r[1], 1, 1)))
    g.cube(b, (-4.45, y + h - 0.5, -4.3), (0.3, 0.45, 4.4), uv(rest=(r[0], r[1], 1, 1)))          # arms over the ears
    g.cube(b, (4.15, y + h - 0.5, -4.3), (0.3, 0.45, 4.4), uv(rest=(r[0], r[1], 1, 1)))
    return b


def coat_skirt(g, col, y0=5.0, name="g_skirt"):
    """A long coat or robe below the waist (it doesn't swing with the legs, like a real coat)."""
    r = g.region(8, 6, lambda u, v, wd, ht: mul(col, 0.98 - 0.18 * v / ht - (0.08 if u in (3, 4) else 0)))
    b = g.bone(name, "body", (0, 24, 0))
    g.cube(b, (-4, y0, -2), (8, 12 - y0, 4), uv(north=r, south=r, east=r, west=r, rest="none"), inflate=0.55)
    return b


def wide_legs(g, col, name="g_wide"):
    """Hakama / baggy trousers: a looser layer round each leg."""
    r = g.region(4, 6, lambda u, v, wd, ht: mul(col, 1.02 - 0.18 * v / ht - (0.07 if u == 2 else 0)))
    for leg, x in (("rightLeg", -3.9), ("leftLeg", -0.1)):
        b = g.bone(f"{name}_{leg}", leg, BONE_PIVOT[leg])
        g.cube(b, (x, 1.5, -2), (4, 10.5, 4), ring(r), inflate=0.5)


def lapels(g, col, inner=None, name="g_lapels"):
    """An open jacket's lapels: two plates forming a V down the chest."""
    r = g.region(2, 6, lambda u, v, wd, ht: mul(col, 1.12 - 0.12 * v / ht))
    b = g.bone(name, "body", (0, 24, 0))
    for side in (-1, 1):
        x = side * 1.6
        g.cube(b, (x - 0.8, 17.0, -2.55), (1.6, 6.8, 0.4), uv(rest=r), rotation=[0, 0, side * 14], pivot=(x, 23.8, -2.4))


def chain(g, col=GOLD, name="g_chain"):
    r = g.region(4, 2, lambda u, v, wd, ht: mul(col, 1.15) if (u + v) % 2 == 0 else mul(col, 0.8))
    b = g.bone(name, "body", (0, 24, 0))
    g.cube(b, (-2.6, 21.0, -2.35), (5.2, 0.6, 0.3), uv(rest=r))
    g.cube(b, (-2.9, 21.4, -2.35), (0.6, 2.6, 0.3), uv(rest=r))
    g.cube(b, (2.3, 21.4, -2.35), (0.6, 2.6, 0.3), uv(rest=r))


def earrings(g, col, big=False, name="g_earrings"):
    r = g.flat(col, 2, 2)
    b = g.bone(name, "head", (0, 24, 0))
    s_ = 1.3 if big else 0.6
    for x in (-4.5 - s_ / 2, 4.2):
        g.cube(b, (x, 26.0, -0.4), (s_ / 2 + 0.3, s_, s_), uv(rest=r))


def uniform_3d(g, J, button=True, sole=(30, 30, 34), toe=None, collar_h=1.2):
    """The Jujutsu High jacket's 3D parts: high collar (and its spiral button), flared hem, cuffs, sneaker soles."""
    collar(g, J, h=collar_h, button=GOLD if button else None)
    hem(g, J)
    cuffs(g, J)
    soles(g, sole, toe)


# ===========================================================================
# The cast
# ===========================================================================
def gojo():
    c = dict(skin=(240, 218, 204), hair=(236, 240, 250), hair_h=(255, 255, 255), hair_d=(186, 198, 222), jacket=(28, 30, 50),
             mouth=(178, 108, 104), black=(14, 14, 18))
    s = Skin(1)
    head(s, c, ["hHhHHhHh",
                "HhHdHHhH",
                "HSHSSHSd",
                "BBBBBBBB",
                "BBBBBBBB",
                "SSSSSSSS",
                "SSSMmSSS",
                "SSSSSSSS"],
         ["HHhHHHHH", "HHHHhHHH", "dHHHHHHS", "BBBBBBBB", "BBBBBBBB", "HHHsSSSS", "dHHSSSSS", "SSSSSSSS"],
         ["HhHHHHhH", "HHHdHHHH", "HhHHHhHH", "BBBBBBBB", "BBBBBBBB", "HHdHHdHH", "dHHhHHHd", "SSSSSSSS"],
         front1=["H.h..h.H", ".H.hH.d.", "h..H..H.", "B......B"], side1=["HhH.hH.H", "..H..H.."], back1=["hHHhHHhH", "H.hH.Hh."])
    J = c["jacket"]
    outfit(s, c, J, J, (24, 26, 42), (16, 16, 20), top_fn=jjh_uniform(c, buttons=False)[0],
           leg_fn=sneakers((16, 16, 20), (40, 40, 46)), shoe_rows=2)
    for leg in ("rleg", "lleg"):
        s.paint(leg, SIDES, lambda f, u, v, wd, ht: s.cloth(mul(J, 0.96), f, u, v, wd, ht) if v < 6 else None, layer=1)
    bake(s)
    g = Gear("geometry.jjk.sorcerer_gear_gojo")
    hair_cap(g, c["hair"], y0=30.0, inflate=0.6, back_to=26, light=0.1)
    spikes(g, c["hair"], [((-2.6, 31.2, -2.4), 5.0, 2.8, [28, 0, -24]), ((0.0, 31.2, -2.8), 5.6, 3.0, [32, 0, 0]), ((2.6, 31.2, -2.4), 5.0, 2.8, [28, 0, 24]), ((-3.2, 31.2, 0.2), 4.6, 2.8, [-4, 0, -38]), ((3.2, 31.2, 0.2), 4.6, 2.8, [-4, 0, 38]), ((-1.2, 31.2, 0.4), 5.8, 3.0, [-10, 0, -10]), ((1.3, 31.2, 0.6), 5.6, 3.0, [-14, 0, 12]), ((-2.2, 31.2, 2.6), 4.4, 2.8, [-34, 0, -20]), ((0.2, 31.2, 2.8), 4.6, 2.8, [-38, 0, 0]), ((2.4, 31.2, 2.6), 4.4, 2.8, [-34, 0, 20])], light=0.1)
    fringe(g, c["hair"], [(-3.8, 1.4, 2.6), (-2.0, 1.2, 2.1), (-0.4, 1.4, 2.8), (1.3, 1.2, 2.2), (2.8, 1.2, 2.5)], y=31.4)
    collar(g, J, h=1.4)
    coat_skirt(g, J, y0=5.5)
    soles(g, (40, 40, 46))
    return s.img, g


def yuji():
    c = dict(skin=(234, 198, 172), hair=(236, 150, 160), hair_h=(252, 190, 198), hair_d=(84, 54, 52), iris=(150, 92, 46),
             jacket=NAVY, red=(198, 44, 52))
    s = Skin(3)
    head(s, c, ["hHHhHHhH",
                "HhHHhHHd",
                "dKKSSKKd",
                "SLLSSLLS",
                "SEISSIES",
                "SEJSSJES",
                "SSSMMSSS",
                "SSSSSSSS"],
         ["HHhHHHHH", "ddddddHH", "dddddSSS", "ddddSSSS", "dddsSSSS", "ddSSSSSS", "SSSSSSSS", "SSSSSSSS"],
         ["HHhHHHhH", "HhHHHHHH", "dddddddd", "dddddddd", "dddddddd", "dddddddd", "SddddddS", "SSSSSSSS"],
         front1=["h.H..H.h", ".H....H."])
    J = c["jacket"]
    top, arm = jjh_uniform(c, collar_rows=0)

    def body(f, u, v, wd, ht):
        if v < 2:
            return mul(c["red"], 1.1 if v == 0 else 0.85)          # the red hoodie under the jacket
        return top(f, u, v, wd, ht)
    outfit(s, c, J, J, (28, 30, 48), (200, 46, 52), top_fn=body, arm_fn=arm, leg_fn=sneakers((200, 46, 52)), shoe_rows=2)
    bake(s)
    g = Gear("geometry.jjk.sorcerer_gear_yuji")
    spikes(g, c["hair"], [((-2.6, 31.2, -2.6), 2.6, 2.4, [30, 0, -14]), ((0, 31.2, -3), 3.0, 2.4, [36, 0, 0]), ((2.6, 31.2, -2.6), 2.6, 2.4, [30, 0, 14]), ((-1.4, 31.2, -0.4), 2.8, 2.4, [-10, 0, -10]), ((1.4, 31.2, -0.4), 2.8, 2.4, [-10, 0, 10]), ((0, 31.2, 1.6), 2.6, 2.4, [-26, 0, 0]), ((-2.8, 31.2, 1.2), 2.4, 2.2, [-20, 0, -24]), ((2.8, 31.2, 1.2), 2.4, 2.2, [-20, 0, 24])], light=0.08)
    hood = g.region(8, 6, lambda u, v, wd, ht: mul(c["red"], 1.12 - 0.3 * v / ht - (0.1 if u in (0, wd - 1) else 0)))
    hb = g.bone("g_hood", "body", (0, 24, 0))
    g.cube(hb, (-3.6, 19.2, 2.0), (7.2, 5.0, 1.8), uv(rest=hood))            # the hood down the back
    g.cube(hb, (-4, 23.2, -2), (8, 1.4, 4), ring(hood), inflate=0.68)          # its collar round the neck
    hem(g, J)
    cuffs(g, J)
    soles(g, (238, 236, 230), (200, 46, 52))
    return s.img, g


def megumi():
    c = dict(skin=(230, 204, 188), hair=(26, 28, 40), hair_h=(70, 78, 104), iris=(48, 76, 116), jacket=NAVY)
    s = Skin(4)
    head(s, c, ["HHhHHhHH",
                "HdHHHdHH",
                "HKKHSKKH",
                "SLLSSLLS",
                "SEISSIES",
                "SEJSSJES",
                "SSSMMSSS",
                "SSSSSSSS"],
         ["HHHHHHHH", "HHhHHHHH", "HHHHHHSS", "HHHHSSSS", "HHHsSSSS", "HHSSSSSS", "HSSSSSSS", "SSSSSSSS"],
         ["HHhHHHHH", "HHHHHhHH", "HhHHHHHH", "HHHHHHhH", "HHHHHHHH", "HHHhHHHH", "SHHHHHHS", "SSSSSSSS"],
         front1=["H.hH.H.h", ".H..H..H", "..H....."])
    top, arm = jjh_uniform(c)
    outfit(s, c, c["jacket"], c["jacket"], (28, 30, 48), (18, 18, 22), top_fn=top, arm_fn=arm,
           leg_fn=sneakers((18, 18, 22), (44, 44, 50)), shoe_rows=2)
    bake(s)
    g = Gear("geometry.jjk.sorcerer_gear_megumi")
    hair_cap(g, c["hair"], y0=29.5, inflate=0.6, back_to=25.5)
    spikes(g, c["hair"], [((-2.8, 31.2, -2.6), 4.4, 2.8, [24, 0, -30]), ((-0.4, 31.2, -3.0), 5.0, 3.0, [30, 0, -6]), ((2.2, 31.2, -2.8), 4.6, 2.8, [26, 0, 22]), ((-3.4, 31.2, -0.4), 5.0, 3.0, [0, 0, -46]), ((3.4, 31.2, -0.4), 5.0, 3.0, [0, 0, 46]), ((-1.6, 31.2, 0.2), 6.0, 3.2, [-12, 0, -16]), ((1.0, 31.2, 0.4), 6.2, 3.2, [-14, 0, 10]), ((-2.8, 31.2, 2.4), 5.0, 2.8, [-40, 0, -28]), ((0.0, 31.2, 2.8), 5.2, 3.0, [-46, 0, 0]), ((2.8, 31.2, 2.4), 5.0, 2.8, [-40, 0, 28]), ((-0.6, 31.2, -0.8), 5.4, 3.0, [8, 0, -2])], light=0.05)
    uniform_3d(g, c["jacket"], sole=(44, 44, 50))
    return s.img, g


def nobara():
    c = dict(skin=(240, 210, 190), hair=(192, 106, 52), hair_h=(228, 146, 80), iris=(140, 86, 46), jacket=NAVY, lip=(210, 110, 120))
    s = Skin(5)
    head(s, c, ["HHHHHHHH",
                "HhHHHHhH",
                "HHHHdSSH",
                "HLLSSLLH",
                "HEISSIEH",
                "HEJSSJEH",
                "HbSmmSbH",
                "SSSSSSSS"],
         ["HHHHHHHH", "HhHHHHHH", "HHHHHHHS", "HHHHHHSS", "HHHHHsSS", "HHHHHSSS", "HHHHHSSS", "SSSSSSSS"],
         ["HHHHHHHH", "HhHHHHhH", "HHHHHHHH", "HHHhHHHH", "HHHHHHHH", "HhHHHHhH", "HHHHHHHH", "SSSSSSSS"])
    J = c["jacket"]
    top, arm = jjh_uniform(c)

    def body(f, u, v, wd, ht):
        if v == 10:
            return (200, 170, 90) if f == "front" and u in (3, 4) else (90, 60, 40)         # belt and buckle
        return top(f, u, v, wd, ht)
    outfit(s, c, J, J, (30, 28, 34), (112, 72, 44), top_fn=body, arm_fn=arm, shoe_rows=3)
    for leg in ("rleg", "lleg"):
        s.paint(leg, SIDES, lambda f, u, v, wd, ht: s.cloth(mul(J, 1.05), f, u, v, wd, ht) if v < 4 else None, layer=1)
    bake(s)
    g = Gear("geometry.jjk.sorcerer_gear_nobara")
    bob = hair_tex(g, c["hair"], 0.05, 8, 8)
    hb = g.bone("g_hair", "head", (0, 24, 0))
    g.cube(hb, (-4, 29.6, -4), (8, 2.4, 8), uv(up=bob, east=bob, west=bob, south=bob, rest="none"), inflate=0.6)
    for x in (-4.7, 3.9):
        g.cube(hb, (x, 25.0, -3.5), (0.8, 4.8, 7.4), uv(rest=bob))                    # the bob falls to the chin
        g.cube(hb, (x + (0.2 if x < 0 else -0.2), 24.6, -3.6), (0.8, 1.0, 2.4), uv(rest=bob))   # flicked-out ends
    g.cube(hb, (-4.2, 24.8, 3.7), (8.4, 5.0, 0.8), uv(rest=bob))
    fringe(g, c["hair"], [(-3.9, 2.2, 2.0), (-1.8, 1.8, 1.5), (-0.1, 1.4, 1.0)], y=31.3)   # swept to one side
    handle = g.flat((120, 80, 46), 2, 6)
    hammer = g.flat((92, 94, 106), 4, 3)
    hm = g.bone("g_hammer", "body", (0, 24, 0))
    g.cube(hm, (-5.4, 11.4, -1.0), (1.0, 4.4, 1.0), uv(rest=handle))
    g.cube(hm, (-6.1, 15.4, -1.7), (2.4, 1.7, 2.4), uv(rest=hammer))
    uniform_3d(g, J, sole=(70, 44, 28))
    return s.img, g


def maki():
    c = dict(skin=(238, 212, 192), hair=(40, 72, 54), hair_h=(70, 110, 84), iris=(160, 124, 60), jacket=NAVY, frame=(22, 22, 26))
    s = Skin(6)
    head(s, c, ["HHHHHHHH",
                "HhHHHHhH",
                "HKKSSKKH",
                "SLLSSLLS",
                "SEISSIES",
                "SEJSSJES",
                "SSSMMSSS",
                "SSSSSSSS"],
         ["HHHHHHHH", "HHhHHHHH", "HHHHHHSS", "HHHGGGGG", "HHHsSSSS", "HHSSSSSS", "HSSSSSSS", "SSSSSSSS"],
         ["HHHHHHHH", "HHhHHHHH", "HHHHHHHH", "HHHhhHHH", "HHHHHHHH", "HHHHHHHH", "HHHHHHHH", "SSSSSSSS"])
    top, arm = jjh_uniform(c)
    outfit(s, c, c["jacket"], c["jacket"], (28, 30, 48), (20, 20, 24), top_fn=top, arm_fn=arm,
           leg_fn=sneakers((20, 20, 24), (50, 50, 56)), shoe_rows=2)
    bake(s)
    g = Gear("geometry.jjk.sorcerer_gear_maki")
    hair_cap(g, c["hair"], y0=30.0, inflate=0.5, back_to=30)
    fringe(g, c["hair"], [(-3.9, 1.6, 2.0), (-1.6, 1.4, 1.5), (2.2, 1.7, 2.1)], y=31.3)
    pt = hair_tex(g, c["hair"], 0.05, 4, 8)
    tail = g.bone("g_tail", "head", (0, 30.5, 4.2), (-28, 0, 0))
    g.cube(tail, (-1.3, 23.4, 4.0), (2.6, 7.6, 2.2), uv(rest=pt))
    g.cube(tail, (-0.9, 21.6, 4.2), (1.8, 1.9, 1.8), uv(rest=pt))
    tie = g.flat((180, 40, 50), 2, 2)
    g.cube(tail, (-1.5, 30.0, 3.8), (3.0, 1.0, 2.6), uv(rest=tie))
    glasses(g, c["frame"], None)
    shaft = g.flat((60, 44, 36), 2, 8)
    blade = g.region(2, 6, lambda u, v, wd, ht: (226, 230, 240) if u == 0 else (170, 176, 190))
    wrap = g.region(2, 2, lambda u, v, wd, ht: (200, 40, 50))
    on_back(g, [((-0.5, -2, -0.5), (1, 18, 1), shaft), ((-0.75, 16, -0.6), (1.5, 6, 1.2), blade), ((-0.6, 14.6, -0.6), (1.2, 1.4, 1.2), wrap)], angle=-34)
    uniform_3d(g, c["jacket"], sole=(50, 50, 56))
    return s.img, g


def inumaki():
    c = dict(skin=(240, 218, 202), hair=(228, 220, 198), hair_h=(250, 246, 232), iris=(128, 96, 178), jacket=NAVY)
    s = Skin(7)
    head(s, c, ["HhHHHHhH",
                "HHHHhHHH",
                "HKKSSKKH",
                "SLLSSLLS",
                "SEISSIES",
                "SEJSSJES",
                "SSSSSSSS",
                "SSSSSSSS"],
         ["HHHHHHHH", "HHhHHHHH", "HHHHHHSS", "HHHHSSSS", "HHHsSSSS", "HHSSSSSS", "HSSSSSSS", "SSSSSSSS"],
         ["HHhHHHHH", "HHHHHhHH", "HHHHHHHH", "HHHhHHHH", "HHHHHHHH", "HHHHHHHH", "SHHHHHHS", "SSSSSSSS"],
         front1=["H.hH.H.h", ".h..H.H."])
    top, arm = jjh_uniform(c, buttons=False)
    outfit(s, c, c["jacket"], c["jacket"], (28, 30, 48), (20, 20, 24), top_fn=top, arm_fn=arm,
           leg_fn=sneakers((20, 20, 24), (50, 50, 56)), shoe_rows=2)
    bake(s)
    g = Gear("geometry.jjk.sorcerer_gear_inumaki")
    hair_cap(g, c["hair"], y0=29.6, inflate=0.6, back_to=26)
    spikes(g, c["hair"], [((-2.2, 31.2, -2), 2.6, 2.6, [26, 0, -16]), ((0.4, 31.2, -2.2), 3.0, 2.8, [30, 0, 4]), ((2.6, 31.2, -1.6), 2.4, 2.4, [22, 0, 22]), ((-0.8, 31.2, 0.8), 2.6, 2.6, [-8, 0, -6]), ((1.8, 31.2, 1.0), 2.2, 2.4, [-14, 0, 14])])
    zip_ = g.region(8, 4, lambda u, v, wd, ht: (210, 196, 120) if (u == 4 and v > 0) else mul(c["jacket"], 1.18 - 0.08 * v))
    hc = g.bone("g_collar", "body", (0, 24, 0))
    g.cube(hc, (-4, 24, -4), (8, 3.7, 8), ring(zip_), inflate=0.75)            # the zipped collar over the mouth
    hem(g, c["jacket"])
    cuffs(g, c["jacket"])
    soles(g, (50, 50, 56))
    return s.img, g


def panda():
    c = dict(skin=(238, 238, 234), hair=(238, 238, 234), black=(28, 28, 32), iris=(26, 26, 30), mouth=(40, 30, 30))
    s = Skin(8)
    head(s, c, ["WWWWWWWW",
                "WWWWWWWW",
                "WWWWWWWW",
                "WBBWWBBW",
                "BBEBBEBB".replace("BBEBBEBB", "WBEWWEBW"),
                "WBBWWBBW",
                "WWWBBWWW",
                "WWWMMWWW"],
         ["WWWWWWWW"] * 8, ["WWWWWWWW"] * 8)
    B, Wt = c["black"], c["skin"]

    def body(f, u, v, wd, ht):
        if v < 4:
            return s.cloth(B, f, u, v, wd, ht, 0.03)
        if f == "front" and 2 <= u <= 5 and 5 <= v <= 10:
            return mul(Wt, 1.04)                                    # belly
        return s.cloth(Wt, f, u, v, wd, ht, 0.03)
    outfit(s, c, Wt, B, B, B, hands=B, top_fn=body, sleeve_to=12, shoe_rows=1)
    s.paint("head", ("top",), lambda f, u, v, wd, ht: mul(Wt, 1.02 - (0.04 if (u + v) % 4 == 0 else 0)))
    bake(s)
    g = Gear("geometry.jjk.sorcerer_gear_panda")
    ear = g.region(3, 3, lambda u, v, wd, ht: B if (u, v) != (1, 1) else (60, 56, 60))
    snout = g.region(4, 3, lambda u, v, wd, ht: (30, 28, 32) if v == 0 and u in (1, 2) else (230, 230, 226))
    hb = g.bone("g_ears", "head", (0, 24, 0))
    for x in (-4.7, 2.2):
        g.cube(hb, (x, 31.0, -1.3), (2.5, 2.5, 1.5), uv(rest=ear))
    g.cube(hb, (-1.7, 25.0, -5.4), (3.4, 2.4, 1.6), uv(rest=snout))
    belly = g.flat(Wt, 4, 4)
    bb = g.bone("g_belly", "body", (0, 24, 0))
    g.cube(bb, (-3.2, 13.0, -3.0), (6.4, 7.0, 1.2), uv(rest=belly))
    muscles(g, B)
    return s.img, g


def nanami():
    c = dict(skin=(238, 208, 182), hair=(226, 196, 116), hair_h=(250, 228, 160), iris=(70, 84, 70), frame=(40, 60, 50))
    s = Skin(9)
    head(s, c, ["HHHHHHHH",
                "HHhhHHHH",
                "SHHSSKKS",
                "SLLSSLLS",
                "SEISSIES",
                "SEJSSJES",
                "SSSMMSSS",
                "SSSSSSSS"],
         ["HHHHHHHH", "HHhHHHHH", "HHHHHHSS", "HHHGGGGG", "HHHsSSSS", "HHSSSSSS", "HSSSSSSS", "SSSSSSSS"],
         ["HHHHHHHH", "HHHHhHHH", "HHHHHHHH", "HGGGGGGH", "HHHHHHHH", "HHHHHHHH", "SHHHHHHS", "SSSSSSSS"])
    suit, shirt = (206, 188, 150), (60, 72, 96)

    def top(f, u, v, wd, ht):
        if f == "front":
            if u in (3, 4) and v < 9:
                if v == 0:
                    return shirt
                return (216, 172, 62) if (u + v) % 3 else (116, 78, 30)    # the leopard tie
            if u in (2, 5) and v < 6:
                return shirt
            if v in (7, 8) and u in (0, 7):
                return mul(suit, 0.85)                                 # pockets
        return None
    outfit(s, c, suit, suit, mul(suit, 0.9), (88, 58, 38), top_fn=top)
    bake(s)
    g = Gear("geometry.jjk.sorcerer_gear_nanami")
    hair_cap(g, c["hair"], y0=29.8, inflate=0.5, back_to=27)
    fringe(g, c["hair"], [(-3.9, 3.2, 1.6), (-0.9, 2.0, 1.1)], y=31.4)                 # side part
    glasses(g, c["frame"], (110, 168, 128))
    lapels(g, suit)
    sw = g.region(4, 6, lambda u, v, wd, ht: (232, 232, 234) if (u + v * 2) % 4 else (40, 40, 52))
    on_back(g, [((-0.9, -2, -0.6), (1.8, 16, 1.2), sw)], angle=-40)
    soles(g, (60, 40, 26))
    return s.img, g


def mei_mei():
    c = dict(skin=(244, 224, 212), hair=(224, 224, 234), hair_h=(252, 252, 255), iris=(110, 96, 150), lip=(206, 96, 116))
    s = Skin(10)
    head(s, c, ["HHHHHHHH",
                "HHhHHHhH",
                "HHHHHHHH",
                "HLLSSLLH",
                "SSSSSSSS",
                "SbSSSSbS",
                "SSSmmSSS",
                "SSSSSSSS"],
         ["HHHHHHHH", "HHHHHHHH", "HHHHHHHH", "HHHHHHSS", "HHHHHsSS", "HHHHHSSS", "HHHHSSSS", "HHHSSSSS"],
         ["HHHHHHHH"] * 8)
    dress = (30, 28, 36)

    def top(f, u, v, wd, ht):
        if f == "front" and u == 4 and v in (2, 5, 8):
            return GOLD
        if v < 2:
            return mul(dress, 1.3)
        return None
    outfit(s, c, dress, dress, dress, (20, 18, 22), top_fn=top)
    for leg in ("rleg", "lleg"):
        s.paint(leg, SIDES, lambda f, u, v, wd, ht: s.cloth(mul(dress, 1.08), f, u, v, wd, ht) if v < 9 else None, layer=1)
    bake(s)
    g = Gear("geometry.jjk.sorcerer_gear_mei_mei")
    hair_cap(g, c["hair"], y0=29.4, inflate=0.55, back_to=21.5, light=0.05)
    fringe(g, c["hair"], [(-3.9, 2.6, 3.0), (-1.2, 2.2, 2.4), (1.2, 2.6, 3.0)], y=31.4)   # bangs over the eyes
    br = g.region(4, 8, lambda u, v, wd, ht: mul(c["hair"], 1.14 - 0.12 * ((u + v) % 3)))
    braid = g.bone("g_braid", "head", (-3.0, 25.5, -3.2), (6, 0, -6))
    for i in range(7):
        g.cube(braid, (-4.3 + (i % 2) * 0.35, 25.5 - (i + 1) * 2.1, -4.1), (2.3, 2.3, 2.3), uv(rest=br))
    tip = g.flat((36, 36, 44), 2, 2)
    g.cube(braid, (-3.95, 9.6, -3.75), (1.6, 1.0, 1.6), uv(rest=tip))
    collar(g, dress)
    shaft = g.flat((54, 40, 34), 2, 8)
    axe = g.region(6, 6, lambda u, v, wd, ht: (204, 208, 218) if u < wd - 1 else (244, 246, 252))
    on_back(g, [((-0.6, -2, -0.6), (1.2, 18, 1.2), shaft), ((0.6, 11, -0.5), (5, 6, 1.0), axe)], angle=-32)
    crow = g.region(3, 3, lambda u, v, wd, ht: (40, 36, 48) if (u + v) % 3 == 0 else (24, 22, 28))
    cb = g.bone("g_crow", "body", (5, 24, 0))
    g.cube(cb, (4.2, 24.0, -1.0), (2.2, 2.0, 3.0), uv(rest=crow))
    g.cube(cb, (4.6, 25.6, -2.0), (1.4, 1.4, 1.4), uv(rest=crow))
    beak = g.flat((214, 172, 60), 2, 2)
    g.cube(cb, (4.9, 25.9, -2.8), (0.8, 0.6, 0.8), uv(rest=beak))
    tailr = g.flat((24, 22, 28), 2, 2)
    g.cube(cb, (4.6, 23.8, 1.9), (1.4, 0.6, 1.6), uv(rest=tailr))
    return s.img, g


def todo():
    c = dict(skin=(214, 168, 128), hair=(42, 32, 30), iris=(56, 44, 36), jacket=NAVY, scar=(172, 102, 92))
    s = Skin(11)
    head(s, c, ["HHHHHHHH",
                "HSSSSSSH",
                "SOKKSKKS",
                "SLOSSLLS",
                "SEISSIES",
                "SEJsSJES",
                "SSMMMMSS",
                "SSSSSSSS"],
         ["HHHHHHHH", "HHHHHSSS", "HHHHSSSS", "HHHsSSSS", "HHHSSSSS", "HHSSSSSS", "HSSSSSSS", "SSSSSSSS"],
         ["HHHHHHHH", "HHHHHHHH", "HHHHHHHH", "HHHhHHHH", "HHHHHHHH", "SHHHHHHS", "SSSSSSSS", "SSSSSSSS"])
    tank = (232, 230, 222)

    def top(f, u, v, wd, ht):
        if f == "front" and 2 <= u <= 5:
            return s.cloth(tank, f, u, v, wd, ht, 0.03)
        return None
    outfit(s, c, c["jacket"], c["jacket"], (28, 30, 48), (24, 22, 24), top_fn=top, sleeve_to=6,
           leg_fn=sneakers((24, 22, 24), (60, 56, 56)), shoe_rows=2)
    bake(s)
    g = Gear("geometry.jjk.sorcerer_gear_todo")
    bun = hair_tex(g, c["hair"], 0.0, 4, 4)
    tb = g.bone("g_bun", "head", (0, 24, 0))
    g.cube(tb, (-1.5, 31.8, -0.4), (3.0, 2.3, 3.0), uv(rest=bun))
    g.cube(tb, (-0.8, 34.0, 0.2), (1.6, 1.0, 1.6), uv(rest=bun))
    sideburns(g, c["hair"], 3.6)
    muscles(g, c["skin"], c["jacket"])
    lapels(g, c["jacket"])
    soles(g, (60, 56, 56))
    return s.img, g


def yuta():
    c = dict(skin=(234, 208, 192), hair=(30, 30, 40), hair_h=(70, 70, 90), iris=(40, 38, 52), jacket=(232, 232, 238))
    s = Skin(12)
    head(s, c, ["HHHHHHHH",
                "HhHHHhHH",
                "HHSHSSHH",
                "SLLSSLLS",
                "SEISSIES",
                "SEJSSJES",
                "SssMMssS",
                "SSSSSSSS"],
         ["HHHHHHHH", "HHHHHHHH", "HHHHHHHS", "HHHHSSSS", "HHHsSSSS", "HHSSSSSS", "HSSSSSSS", "SSSSSSSS"],
         ["HHHHHHHH", "HHhHHHHH", "HHHHHHHH", "HHHHhHHH", "HHHHHHHH", "HHHHHHHH", "SHHHHHHS", "SSSSSSSS"],
         front1=["H.hH..Hh", ".H...H..", "..H....H"])
    J = c["jacket"]
    top, arm = jjh_uniform(dict(c, gold=(206, 176, 86)))
    outfit(s, c, J, J, mul(J, 0.9), (30, 30, 34), top_fn=top, arm_fn=arm, leg_fn=sneakers((30, 30, 34), (70, 70, 76)), shoe_rows=2)
    bake(s)
    g = Gear("geometry.jjk.sorcerer_gear_yuta")
    hair_cap(g, c["hair"], y0=29.4, inflate=0.6, back_to=26)
    spikes(g, c["hair"], [((-2.4, 31.2, -1.6), 2.6, 2.6, [10, 0, -26]), ((0.4, 31.2, -2), 2.8, 2.6, [14, 0, 6]), ((2.6, 31.2, -1.2), 2.4, 2.6, [8, 0, 28]), ((-1.2, 31.2, 1.4), 2.6, 2.6, [-24, 0, -12]), ((1.6, 31.2, 1.6), 2.4, 2.6, [-26, 0, 16])])
    fringe(g, c["hair"], [(-3.9, 1.8, 2.6), (-1.6, 1.6, 2.0), (0.6, 1.6, 2.4), (2.6, 1.3, 1.8)], y=31.4)
    sheath = g.region(2, 8, lambda u, v, wd, ht: (24, 22, 28) if v > 1 else (156, 124, 62))
    hilt = g.region(2, 4, lambda u, v, wd, ht: (232, 228, 218) if (u + v) % 2 else (40, 36, 40))
    on_back(g, [((-0.6, -2, -0.6), (1.2, 14, 1.2), sheath), ((-0.5, 12, -0.5), (1.0, 4.6, 1.0), hilt)], angle=-36)
    uniform_3d(g, J, sole=(70, 70, 76))
    return s.img, g


def hakari():
    c = dict(skin=(232, 200, 176), hair=(200, 152, 96), hair_h=(236, 196, 140), iris=(60, 48, 40), jacket=NAVY)
    s = Skin(18)
    head(s, c, ["HHhHHhHH",
                "HhHHHHhH",
                "SKKSSKKS",
                "SLLSSLLS",
                "SEISSIES",
                "SEJSSJES",
                "SSMmmMSS",
                "SSSSSSSS"],
         ["HHHHHHHH", "HHHHHHHH", "dHHHHHSS", "ddHHSSSS", "dddsSSSS", "ddSSSSSS", "dSSSSSSS", "SSSSSSSS"],
         ["HHHHHHHH", "HhHHHHhH", "dddddddd", "dddddddd", "dddddddd", "dddddddd", "SddddddS", "SSSSSSSS"])
    J = c["jacket"]
    top, arm = jjh_uniform(c)

    def body(f, u, v, wd, ht):
        if f == "front" and v < 3 and 2 <= u <= 5:
            return (40, 120, 110)                                       # a teal shirt at the open collar
        return top(f, u, v, wd, ht)
    outfit(s, c, J, J, (28, 30, 48), (230, 228, 220), top_fn=body, arm_fn=arm, leg_fn=sneakers((230, 228, 220), (36, 36, 40)), shoe_rows=2)
    bake(s)
    g = Gear("geometry.jjk.sorcerer_gear_hakari")
    hair_cap(g, c["hair"], y0=30.6, inflate=0.5, back_to=30.6)
    # the pompadour: a quiff swept up and forward off the forehead
    spikes(g, c["hair"], [((-2.2, 31.0, -2.4), 4.0, 3.2, [50, 0, -8]), ((0.4, 31.2, -2.6), 4.8, 3.4, [54, 0, 2]),
                          ((2.6, 31.0, -2.2), 4.0, 3.2, [50, 0, 10]), ((-1.2, 31.4, -0.2), 3.6, 3.2, [40, 0, -4]),
                          ((1.4, 31.4, -0.2), 3.6, 3.2, [40, 0, 4]), ((0, 31.4, 1.8), 3.0, 3.0, [24, 0, 0])], light=0.05)
    sideburns(g, c["hair"], 3.0)
    chain(g)
    hem(g, J)
    cuffs(g, J)
    soles(g, (36, 36, 40))
    return s.img, g


def sukuna():
    c = dict(skin=(234, 198, 180), hair=(236, 142, 152), hair_h=(252, 186, 192), hair_d=(156, 82, 98), iris=(206, 30, 40),
             mark=(24, 16, 20), mouth=(70, 16, 20), white=(240, 236, 228), black=(24, 22, 26))
    s = Skin(2)
    head(s, c, ["HhHHHHhH",
                "HSXXXXSH",
                "SKKSSKKS",
                "SLLSSLLS",
                "SEISSIES",
                "SXXSSXXS",
                "SIESSEIS",
                "SSMTTMSS"],
         ["HHHHHHHH", "HHHHHXSS", "HHHHSSSS", "HHHSSSXS", "HHHsSSXS", "HSSSSSSS", "SSSSSSSS", "SSSSSSSS"],
         ["HHHhHHHH", "HHHHHHhH", "HhHHHHHH", "HHHHHHHH", "HHHHhHHH", "dHHHHHHd", "SdHHHHdS", "SSSSSSSS"],
         front1=["h.H..H.h"])
    W, B = c["white"], (30, 28, 32)

    def kimono(f, u, v, wd, ht):
        if f == "front" and v < 5 and abs(u - 3.5) < 2.2 - v * 0.45:
            return c["skin"]
        if f == "front" and ((u == 1 and v < 7) or (u == 6 and v < 7)):
            return mul(W, 0.82)
        if v in (7, 8):
            return B if v == 7 else mul(B, 1.3)
        return None

    def tattoo_arm(arm, f, u, v, wd, ht):
        if v < 4:
            return s.cloth(W, f, u, v, wd, ht)
        if v in (6, 9):
            return c["mark"]
        return None
    outfit(s, c, W, W, (34, 32, 38), (40, 34, 30), top_fn=kimono, arm_fn=tattoo_arm, sleeve_to=4, leg_fn=sandals(c["skin"]))
    bake(s)
    g = Gear("geometry.jjk.sorcerer_gear_sukuna")
    hair_cap(g, c["hair"], y0=30.4, inflate=0.5, back_to=27, light=0.05)
    spikes(g, c["hair"], [((-2.6, 31.2, -2.6), 4.4, 2.8, [-48, 0, -14]), ((0, 31.2, -3.0), 4.8, 3.0, [-52, 0, 0]), ((2.6, 31.2, -2.6), 4.4, 2.8, [-48, 0, 14]), ((-3.2, 31.2, 0), 4.2, 2.8, [-58, 0, -26]), ((3.2, 31.2, 0), 4.2, 2.8, [-58, 0, 26]), ((-1.4, 31.2, 1.2), 4.0, 2.8, [-64, 0, -8]), ((1.4, 31.2, 1.2), 4.0, 2.8, [-64, 0, 8])], light=0.05)
    scarf = g.region(8, 2, lambda u, v, wd, ht: (40, 32, 40) if v == 0 else (28, 22, 28))
    sc = g.bone("g_scarf", "body", (0, 24, 0))
    g.cube(sc, (-4, 22.4, -2), (8, 1.9, 4), ring(scarf), inflate=0.72)
    obi = g.region(8, 2, lambda u, v, wd, ht: (30, 28, 34) if v == 0 else (52, 48, 56))
    g.cube(sc, (-4, 14.6, -2), (8, 2.0, 4), ring(obi), inflate=0.4)
    skin = g.region(4, 12, lambda u, v, wd, ht: c["mark"] if v in (4, 7) else mul(c["skin"], 1.02 - 0.12 * v / ht))
    for side, name in ((-1, "g_arm3"), (1, "g_arm4")):
        b = g.bone(name, "body", (side * 4.4, 17, -0.5), (-50, side * 10, side * 28))
        g.cube(b, (side * 4.4 - 1.5, 7, -2), (3, 10, 3), uv(rest=skin))
        g.cube(b, (side * 4.4 - 1.3, 5.4, -1.8), (2.6, 1.8, 2.6), uv(rest=(skin[0], skin[1] + 9, 4, 3)))   # the fists
    wide_legs(g, (40, 38, 46))
    return s.img, g


def toji():
    c = dict(skin=(228, 194, 168), hair=(24, 24, 30), hair_h=(60, 62, 74), iris=(64, 84, 70), scar=(198, 152, 142))
    s = Skin(13)
    head(s, c, ["HHHHHHHH",
                "HhHHHHhH",
                "SHKKSKKS",
                "SLLSSLLS",
                "SEISSIES",
                "SEJSSJES",
                "SSMMMOSS",
                "SSSSSOSS"],
         ["HHHHHHHH", "HHHHHHHH", "HHHHHHSS", "HHHHSSSS", "HHHsSSSS", "HHSSSSSS", "HSSSSSSS", "SSSSSSSS"],
         ["HHHHHHHH", "HHHHhHHH", "HHHHHHHH", "HHHHHHHH", "HHHHHHHH", "SHHHHHHS", "SSSSSSSS", "SSSSSSSS"],
         front1=["H.H..H.h", ".h....H."])
    shirt, pants = (28, 28, 32), (222, 218, 206)
    outfit(s, c, shirt, shirt, pants, (24, 22, 24), sleeve_to=9, leg_fn=sneakers((24, 22, 24), (40, 40, 44)), shoe_rows=2)
    bake(s)
    g = Gear("geometry.jjk.sorcerer_gear_toji")
    hair_cap(g, c["hair"], y0=30.4, inflate=0.45, back_to=28)
    spikes(g, c["hair"], [((-2.4, 31.2, -2), 2.4, 2.6, [20, 0, -20]), ((0.4, 31.2, -2.4), 2.6, 2.6, [24, 0, 4]), ((2.6, 31.2, -1.6), 2.2, 2.4, [16, 0, 26]), ((-1, 31.2, 1), 2.4, 2.6, [-20, 0, -8]), ((1.8, 31.2, 1.2), 2.2, 2.4, [-22, 0, 14])])
    muscles(g, c["skin"], shirt)
    wide_legs(g, pants)
    worm = g.region(4, 4, lambda u, v, wd, ht: (134, 82, 154) if (u + v) % 2 else (98, 58, 120))
    wb = g.bone("g_worm", "body", (0, 24, 0))
    for i in range(9):
        a = i / 9 * math.pi * 2
        g.cube(wb, (math.cos(a) * 4.5 - 1.1, 14.0 + i * 0.8, math.sin(a) * 2.7 - 1.1), (2.2, 1.6, 2.2), uv(rest=worm))
    eye = g.region(2, 2, lambda u, v, wd, ht: (236, 226, 120) if u == 0 else (20, 16, 20))
    g.cube(wb, (3.4, 21.0, -2.9), (1.6, 1.6, 1.0), uv(rest=eye))
    soles(g, (40, 40, 44))
    return s.img, g


def geto():
    c = dict(skin=(236, 212, 194), hair=(26, 24, 30), hair_h=(66, 62, 76), iris=(44, 36, 32), mark=(150, 92, 92))
    s = Skin(14)
    head(s, c, ["HHHHHHHH",
                "HHXXXXHH",
                "HKKSSKKH",
                "HSLSSLSH",
                "HELSSLEH",
                "HSSSSSSH",
                "HSSMmSSH",
                "SSSSSSSS"],
         ["HHHHHHHH", "HHHHHXXH", "HHHHHHSS", "HHHHHSSS", "HHHHHsSS", "HHHHSSSS", "HHHHSSSS", "HHHSSSSS"],
         ["HHHHHHHH"] * 8)
    robe, kesa = (30, 28, 34), (198, 122, 50)

    def top(f, u, v, wd, ht):
        if f == "front" and abs(u - (6 - v * 0.55)) < 1.1 and v < 11:
            return mul(kesa, 1.0 + (0.1 if v % 3 == 0 else 0))
        if f == "back" and abs(u - (1 + v * 0.55)) < 1.1 and v < 11:
            return kesa
        return None
    outfit(s, c, robe, robe, robe, (60, 44, 34), top_fn=top, leg_fn=sandals(c["skin"]))
    bake(s)
    g = Gear("geometry.jjk.sorcerer_gear_geto")
    hair_cap(g, c["hair"], y0=29.6, inflate=0.55, back_to=21.5)
    fringe(g, c["hair"], [(-4.2, 1.0, 5.0), (3.4, 0.8, 3.0)], y=31.4)                     # a long lock over the right temple
    bun = hair_tex(g, c["hair"], 0.05, 4, 4)
    gb = g.bone("g_bun", "head", (0, 24, 0))
    g.cube(gb, (-1.6, 30.6, 3.0), (3.2, 2.8, 2.6), uv(rest=bun))
    earrings(g, (44, 44, 52), big=True)
    coat_skirt(g, robe, y0=4.5)
    kr = g.region(2, 8, lambda u, v, wd, ht: mul(kesa, 1.1 - 0.2 * v / ht))
    kb = g.bone("g_kesa", "body", (0, 24, 0))
    g.cube(kb, (-0.9, 12.6, -2.6), (1.8, 13.0, 0.4), uv(rest=kr), rotation=[0, 0, 30], pivot=(0, 18, -2.4))
    return s.img, g


def mahito():
    c = dict(skin=(216, 212, 216), hair=(112, 132, 164), hair_h=(156, 176, 206), iris=(96, 156, 226), iris2=(156, 176, 146),
             mark=(70, 60, 82))
    s = Skin(15)
    head(s, c, ["HHHHHHHH",
                "HXHHHhHH",
                "SXSSXSSS",
                "SLLXSLLS",
                "SEIXSiES",
                "XXJSSJXS",
                "SMMMMXSS",
                "SXSSSSSS"],
         ["HHHHHHHH", "HHHHHHHH", "HHHHHXSS", "HHHHSSXS", "HHHHXXSS", "HHHSSSSS", "HHHSSSSS", "HHHSSSSS"],
         ["HHHHHHHH"] * 7 + ["HhHHHHhH"])
    shirt, patch, pants = (198, 200, 208), (150, 162, 186), (40, 40, 54)

    def top(f, u, v, wd, ht):
        if (u * 3 + v * 7) % 11 == 0:
            return c["mark"]
        if (u // 3 + v // 4) % 3 == 0:
            return s.cloth(patch, f, u, v, wd, ht, 0.02)
        return None

    def arms(arm, f, u, v, wd, ht):
        if v >= 6 and (v == 8 or (u + v) % 5 == 0):
            return c["mark"]
        return None
    outfit(s, c, shirt, shirt, pants, (30, 28, 34), top_fn=top, arm_fn=arms, sleeve_to=6)
    bake(s)
    g = Gear("geometry.jjk.sorcerer_gear_mahito")
    hair_cap(g, c["hair"], y0=29.2, inflate=0.6, back_to=22.5, light=0.05)
    lk = hair_tex(g, c["hair"], 0.05, 3, 6)
    hb = g.bone("g_locks", "head", (0, 24, 0))
    for x in (-4.8, 3.9):
        g.cube(hb, (x, 22.4, -2.6), (0.9, 6.2, 5.4), uv(rest=lk))
    fringe(g, c["hair"], [(-3.6, 1.2, 2.2), (-1.2, 1.4, 1.6), (1.6, 1.2, 2.4)], y=31.4, name="g_locks")
    return s.img, g


def choso():
    c = dict(skin=(228, 202, 188), hair=(24, 22, 30), hair_h=(64, 60, 76), iris=(110, 40, 54), mark=(64, 30, 38))
    s = Skin(16)
    head(s, c, ["HHHHHHHH",
                "HHHhHHHH",
                "HSKSSKSH",
                "SLLSSLLS",
                "SEISSIES",
                "XXXXXXXX",
                "SSSMMSSS",
                "SSSSSSSS"],
         ["HHHHHHHH", "HHHHHHHH", "HHHHHHSS", "HHHHSSSS", "HHHsSSSS", "HHHXXXXX", "HSSSSSSS", "SSSSSSSS"],
         ["HHHHHHHH", "HHHHHHHH", "HHHHHHHH", "HHHHHHHH", "HHHHHHHH", "HHHHHHHH", "SHHHHHHS", "SSSSSSSS"])
    robe, inner = (222, 216, 208), (72, 56, 82)

    def top(f, u, v, wd, ht):
        if f == "front" and 2 <= u <= 5 and v < 10:
            return s.cloth(inner, f, u, v, wd, ht, 0.03)
        return None
    outfit(s, c, robe, robe, (60, 50, 72), (30, 28, 32), top_fn=top, leg_fn=sandals(c["skin"], (40, 34, 40)))
    bake(s)
    g = Gear("geometry.jjk.sorcerer_gear_choso")
    hair_cap(g, c["hair"], y0=30.0, inflate=0.5, back_to=27)
    spikes(g, c["hair"], [((-3.0, 31.0, 0.5), 4.6, 2.8, [-10, 0, -46]), ((-3.2, 31.0, 1.6), 3.8, 2.6, [-24, 0, -64]),
                          ((3.0, 31.0, 0.5), 4.6, 2.8, [-10, 0, 46]), ((3.2, 31.0, 1.6), 3.8, 2.6, [-24, 0, 64])])
    fringe(g, c["hair"], [(-3.6, 1.3, 1.8), (-1.0, 2.0, 1.4), (2.2, 1.4, 1.9)], y=31.4)
    wide_legs(g, (60, 50, 72))
    return s.img, g


def jogo():
    c = dict(skin=(228, 216, 194), hair=(70, 60, 56), black=(30, 26, 26), iris=(30, 26, 26), mouth=(40, 30, 30))
    s = Skin(17)
    head(s, c, ["SSSSSSSS",
                "SSSSSSSS",
                "SSSssSSS",
                "SSsEEsSS",
                "SSEIJESS",
                "SSsEEsSS",
                "STTTTTTS",
                "SMMMMMMS"],
         ["SSSSSSSS"] * 6 + ["SSSSSSTS", "SSSSSSSS"], ["SSSSSSSS"] * 8)
    robe, sash = (112, 110, 120), (40, 36, 46)

    def top(f, u, v, wd, ht):
        if v in (7, 8):
            return sash
        if f == "front" and v < 5 and abs(u - 3.5) < 2.2 - v * 0.45:
            return c["skin"]
        return None
    outfit(s, c, robe, robe, mul(robe, 0.9), (40, 36, 34), top_fn=top, leg_fn=sandals(c["skin"], (46, 40, 36)))
    bake(s)
    g = Gear("geometry.jjk.sorcerer_gear_jogo")
    rock = g.region(8, 6, lambda u, v, wd, ht: mul((84, 72, 66), 1.12 - 0.22 * v / ht + (0.12 if (u + v) % 4 == 0 else 0)))
    lava = g.region(4, 4, lambda u, v, wd, ht: (255, 150 + (u * 20) % 60, 40))
    vb = g.bone("g_volcano", "head", (0, 24, 0))
    for i, (wd, ht) in enumerate(((8.6, 1.8), (7.0, 1.8), (5.6, 1.8))):
        y = 31.4 + i * 1.8
        g.cube(vb, (-wd / 2, y, -wd / 2), (wd, ht, wd), uv(up="none", rest=rock))
    g.cube(vb, (-2.0, 36.4, -2.0), (4.0, 0.2, 4.0), uv(up=lava, rest=lava))
    for x, z in ((-2.9, -2.9), (2.1, -3.3), (-0.4, -4.0)):
        g.cube(vb, (x, 32.4, z - 0.5), (0.8, 3.2, 0.5), uv(rest=lava))
    obi = g.region(8, 2, lambda u, v, wd, ht: (40, 36, 46) if v == 0 else (60, 56, 66))
    ob = g.bone("g_obi", "body", (0, 24, 0))
    g.cube(ob, (-4, 14.6, -2), (8, 2.0, 4), ring(obi), inflate=0.4)
    coat_skirt(g, robe, y0=6.0)
    return s.img, g


def naoya():
    c = dict(skin=(236, 210, 190), hair=(236, 208, 120), hair_h=(252, 236, 170), hair_d=(40, 34, 30), iris=(110, 84, 50))
    s = Skin(19)
    head(s, c, ["HhHHHhHH",
                "HHHhHHHd",
                "dKKSSKKd",
                "SSLSSLSS",
                "SEISSIES",
                "SSJSSJSS",
                "SSSMmSSS",
                "SSSSSSSS"],
         ["HHHHHHHH", "ddddHHHH", "ddddddSS", "dddSSSSS", "dddsSSSS", "ddSSSSSS", "dSSSSSSS", "SSSSSSSS"],
         ["HHhHHHHH", "HHHHHhHH", "dddddddd", "dddddddd", "dddddddd", "dddddddd", "SddddddS", "SSSSSSSS"])
    haori, kimono, hakama = (40, 44, 46), (210, 204, 190), (54, 58, 62)

    def top(f, u, v, wd, ht):
        if f == "front" and 2 <= u <= 5 and v < 8:
            if abs(u - 3.5) < 1.6 - v * 0.15:
                return c["skin"] if v < 2 else kimono
            return kimono
        if v in (8, 9):
            return (150, 120, 70) if v == 8 else mul((150, 120, 70), 0.8)
        return None
    outfit(s, c, haori, haori, hakama, (40, 34, 30), top_fn=top, leg_fn=sandals(c["skin"], (40, 34, 30)))
    bake(s)
    g = Gear("geometry.jjk.sorcerer_gear_naoya")
    hair_cap(g, c["hair"], y0=30.4, inflate=0.5, back_to=30.4, light=0.05)
    spikes(g, c["hair"], [((-2, 31.2, -2.4), 3.0, 2.6, [-36, 0, -10]), ((0.4, 31.2, -2.6), 3.2, 2.8, [-40, 0, 2]), ((2.4, 31.2, -2), 3.0, 2.6, [-36, 0, 12]), ((-1, 31.2, 0.6), 2.8, 2.6, [-52, 0, -6]), ((1.4, 31.2, 0.8), 2.8, 2.6, [-52, 0, 8])], light=0.06)
    earrings(g, (210, 210, 220))
    sl = g.region(4, 6, lambda u, v, wd, ht: mul(haori, 1.05 - 0.2 * v / ht))
    for arm, x in (("rightArm", -8.4), ("leftArm", 4.0)):
        b = g.bone(f"g_sleeve_{arm}", arm, BONE_PIVOT[arm])
        g.cube(b, (x, 11.0, -2.4), (4.4, 6.0, 4.8), uv(rest=sl))                      # the haori's hanging sleeves
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
