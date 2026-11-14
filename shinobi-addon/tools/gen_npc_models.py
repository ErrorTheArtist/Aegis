#!/usr/bin/env python3
"""NPC models v3 (built by tools/gen_npc_gear.py, which imports this file): hand-painted skins on both layers plus a
3D gear layer whose bones are named like the body's, so the walk, look and attack animations move it too.

  Leaf Shinobi (skin 15 — the chatter NPC and the Quest Giver) and Leaf Kunoichi (skin 33 — the chatter NPC picks one
    of the two at random): the chūnin flak jacket in 3D — a thick rolled collar, four raised scroll pouches with flaps,
    the vest over the shoulders, a darker hem band and the red swirl crest on the back — over the navy uniform with the
    red swirl on each sleeve; the Leaf headband with its ties; taped thigh holster, hip pouch and taped shins. He has
    spiky black hair and a bandage across his nose; she has auburn bangs and a high ponytail that swings as she walks.
  The Hidden Sand (skins 34–39), for the Sand Village NPC types:
    Kazekage — white Kage robe with teal trim over a sand-coloured suit, a teal sash and robe skirts, and the tall white
      Kage hat with its teal 風 badge and a cloth veil down the back; red hair, dark rings round pale eyes.
    Sand Shinobi — a cream desert head-wrap with the Sand headband (the hourglass mark) and a sun cloth over the neck, a
      rust-red scarf, the tan Sand flak jacket (padded ribs, high collar, big shoulder guards, a cross-strap and pouch).
    Sand Jōnin — a white head-wrap with a veil over the left half of the face, red marks under the right eye, the flak
      jacket over a dark suit.
    Puppet Master — a black hooded suit with pointed "ears", the Sand plate on the hood, purple war paint, a
      bandage-wrapped puppet strapped to his back (wooden head and hands peeking out), belt pouches.
    Sand Genin (boy / girl) — sand tunic and teal sash with messy brown hair and a satchel; a pale blue-grey outfit,
      dark bob and a red scarf. Both wear the Sand headband on the forehead.
  Sound Ninja (skin 10): a bone-white crossover tunic, the thick purple rope belt tied in a big bow at the back (its
    tails sway), the Sound headband with the music-note plate, spiky violet-grey hair, purple eye shadow and amber eyes,
    a sound-amplifier gauntlet on the right forearm, bandaged left forearm and shins.

Each model is (skin painter, gear builder); MODELS maps the skin's file name to it. FLUTTER adds the swaying bones.
"""
import math

from PIL import Image, ImageDraw

import gen_npc_gear as G
from gen_npc_gear import SIDES, Skin, mix, mul, ring, tex_fill, uv

GW = G.GW


# ===========================================================================
# Shared pieces
# ===========================================================================
def symbol(rows, ink):
    """A pixel-art emblem for a headband plate: rows of '#', centred on the plate's inner area."""
    def mark(d, r):
        x, y, wd, ht = r
        h, w_ = len(rows), max(len(row) for row in rows)
        ox, oy = x + (wd - w_) // 2, y + (ht - h) // 2
        for j, row in enumerate(rows):
            for i, ch in enumerate(row):
                if ch == "#":
                    d.point([(ox + i, oy + j)], fill=tuple(ink) + (255,))
    return mark


NOTE = ["...##..",          # the Sound village's music note
        "...#.#.",
        "...#...",
        ".###...",
        ".##...."]
LEAF = ["..####.",          # the Leaf village's swirl
        ".#....#",
        ".#.##.#",
        ".#..#..",
        "..##..."]
HOURGLASS = [".#####.",     # the Sand village's mark
             "..###..",
             "...#...",
             "..###..",
             ".#####."]


def band_plate(g, tex, band_r, plate_r, band, plate, plate_d, mark, y=29.7, plate_h=2.5, parent="head", inflate=0.55):
    """A cloth band round the head with a metal plate on the forehead (taller than the v2 plates so the emblem reads)."""
    tex_fill(tex, band_r, lambda u, v, wd, ht: mul(band, 1.08 if v == 0 else 0.92))
    tex_fill(tex, plate_r, lambda u, v, wd, ht: plate_d if (u in (0, wd - 1) or v in (0, ht - 1)) else mul(plate, 1.08 - 0.16 * v / ht))
    mark(ImageDraw.Draw(tex), plate_r)
    hb = g.bone("g_band", parent, (0, y, 0))
    g.cube(hb, (-4, y - 0.65, -4), (8, 1.35, 8), ring(band_r), inflate=inflate)
    g.cube(hb, (-2.5, y - plate_h / 2 - 0.05, -5.2), (5.0, plate_h, 0.55), uv(north=plate_r, rest=(plate_r[0], plate_r[1], 2, 2)))
    return hb


def spikes(g, tex, r, col, parent, items, name="g_hair"):
    """Spiky hair: items = [(origin, size, rotation)] each turned about its own base."""
    tex_fill(tex, r, lambda u, v, wd, ht: mul(col, 1.3 - 0.45 * v / ht))
    b = g.bone(name, parent, (0, 32, 0))
    for o, sz, rot in items:
        g.cube(b, o, sz, uv(rest=r), rotation=rot, pivot=(o[0] + sz[0] / 2, o[1], o[2] + sz[2] / 2))
    return b


def braid(c1, c2, c3):
    """A twisted rope: diagonal strands with a highlight."""
    return lambda u, v, wd, ht: (c3 if (u + v) % 4 == 0 else c1 if (u + v) % 4 in (1, 2) else c2)


# ===========================================================================
# Sound Ninja
# ===========================================================================
SN = dict(skin=(230, 204, 182), skin_d=(198, 168, 146), hair=(66, 60, 82), hair_h=(98, 90, 118), tunic=(214, 206, 186),
          tunic_d=(172, 164, 146), tunic_h=(232, 226, 210), inner=(44, 40, 54), rope=(112, 62, 152), rope_d=(76, 40, 108),
          rope_h=(158, 106, 200), pants=(54, 48, 66), pants_d=(40, 36, 50), wrap=(222, 216, 202), wrap_d=(184, 178, 164),
          band=(46, 44, 56), plate=(178, 182, 192), plate_d=(122, 126, 136), ink=(36, 34, 42), eye=(240, 234, 222),
          iris=(212, 164, 52), shadow=(118, 66, 150), mouth=(140, 84, 92), metal=(122, 126, 136), metal_d=(76, 80, 90),
          metal_h=(170, 174, 184), sandal=(40, 36, 46))


def sound_skin():
    c = SN
    s = Skin(10)
    H, h, B, S, s_, E, I, M, Q, D = (c["hair"], c["hair_h"], c["band"], c["skin"], c["skin_d"], c["eye"], c["iris"], c["shadow"],
                                     c["mouth"], c["inner"])
    pal = {"H": H, "h": h, "B": B, "S": S, "s": s_, "E": E, "I": I, "M": M, "Q": Q, "K": mul(B, 0.7)}
    s.paint("head", ("top",), lambda f, u, v, wd, ht: mul(H, 1 + s.rng.uniform(-0.12, 0.2)))
    s.paint("head", ("bottom",), lambda f, u, v, wd, ht: s_)
    s.paint("head", SIDES, lambda f, u, v, wd, ht: s.cloth(S, f, u, v, wd, ht, 0.02))
    s.rows("head", "front", ["HhHHHHhH",
                             "HSHhSHHS",
                             "BBBBBBBB",
                             "SMMSSMMS",
                             "SEISSIES",
                             "SsSssSsS",
                             "SSSSsQSS",
                             "sSSSSSSs"], pal)
    side = ["HHHHHHHH",
            "HHHHHHHS",
            "BBBBBBBB",
            "HHHHSSSS",
            "HHHsSSSS",
            "HHHsSSSS",
            "HHHSSSSS",
            "HHSSSSSS"]
    s.rows("head", "right", side, pal)
    s.rows("head", "left", [r[::-1] for r in side], pal)
    s.rows("head", "back", ["HHhHHhHH",
                            "HHHHHHHH",
                            "BBBKKBBB",
                            "HhHHHHhH",
                            "HHHHHHHH",
                            "HHhHHhHH",
                            "HHHHHHHH",
                            "hHHHHHHh"], pal)
    # hat layer: strands over the fringe and the sides, longer hair at the nape
    s.rows("head", "front", ["H.h.H..H", ".H...h.."], pal, layer=1)
    for sd in ("right", "left"):
        s.rows("head", sd, ["HhHHhHhH", "H.H.H.H."], pal, layer=1)
    s.rows("head", "back", ["HhHHhHHh", "HHHhHHHH", "........", "H.HHHH.H", "HHhHHhHH", ".HHHHHH.", ".H.HH.H."], pal, layer=1)
    s.paint("head", ("top",), lambda f, u, v, wd, ht: mul(H, 1.25) if (u * 3 + v * 5) % 6 == 0 else None, layer=1)

    # --- body: a bone-white crossover tunic over a dark shirt, the purple rope belt (3D over it)
    T, t, L, R, r = c["tunic"], c["tunic_d"], c["rope_d"], c["rope"], c["rope_d"]   # the collar is trimmed in the rope's purple
    tp = {"T": T, "t": t, "L": L, "D": D, "R": R, "r": r, "h": c["tunic_h"]}
    s.paint("body", SIDES, lambda f, u, v, wd, ht: s.cloth(T, f, u, v, wd, ht, 0.04))
    s.paint("body", ("top",), lambda f, u, v, wd, ht: c["tunic_h"])
    s.paint("body", ("bottom",), lambda f, u, v, wd, ht: t)
    s.rows("body", "front", ["hLDDDDLh",
                             "TTLDDLTT",
                             "TTTLDLTT",
                             "TTTTLTTT",
                             "TTTTTLTT",
                             "TTTTTTLT",
                             "TTTTTTTL",
                             "TTTTTTTT",
                             "RRRRRRRR",
                             "rRRRRRRr",
                             "TTTTTTTT",
                             "tTTtTTTt"], tp)
    s.rows("body", "back", ["hhhhhhhh"] + ["TTTtTTTT"] * 7 + ["RRRRRRRR", "rRRRRRRr", "TTTTTTTT", "tTTTTtTt"], tp)
    for sd in ("right", "left"):
        s.rows("body", sd, ["hhhh"] + ["TTTT"] * 7 + ["RRRR", "rRRr", "TTTT", "tTTt"], tp)
    # jacket layer: the tunic stands off the shirt and the belt
    s.rows("body", "front", ["hL....Lh", "TTL..LTT", "TTTL.LTT", "TTTTLTTT", "TTTTTLTT", "TTTTTTLT", "TTTTTTTL", "TTTTTTTT",
                             "........", "........", "TTTTTTTT", "tTTtTTTt"], tp, layer=1)
    s.paint("body", ("back", "right", "left"), lambda f, u, v, wd, ht: None if v in (8, 9) else s.cloth(T, f, u, v, wd, ht, 0.03, 1.1, 0.9),
            layer=1)

    # --- arms: wide tunic sleeves, bandaged forearms, bare hands
    for arm in ("rarm", "larm"):
        s.paint(arm, SIDES, lambda f, u, v, wd, ht: s.cloth(T, f, u, v, wd, ht) if v < 6 else
                (t if v == 6 else ((c["wrap"] if (u + v * 2) % 4 < 2 else c["wrap_d"]) if v < 11 else S)))
        s.paint(arm, ("top",), lambda f, u, v, wd, ht: T)
        s.paint(arm, ("bottom",), lambda f, u, v, wd, ht: s_)
        s.paint(arm, SIDES, lambda f, u, v, wd, ht: (t if v == 6 else s.cloth(T, f, u, v, wd, ht, 0.03)) if v <= 6 else None, layer=1)
    # --- legs: dark loose trousers, bandaged shins, sandals
    for leg in ("rleg", "lleg"):
        s.paint(leg, SIDES, lambda f, u, v, wd, ht: s.cloth(c["pants"], f, u, v, wd, ht) if v < 7 else
                ((c["wrap"] if (u + v * 2) % 4 < 2 else c["wrap_d"]) if v < 11 else c["sandal"]))
        s.paint(leg, ("top",), lambda f, u, v, wd, ht: c["pants"])
        s.paint(leg, ("bottom",), lambda f, u, v, wd, ht: c["sandal"])
        s.put(leg, "front", 1, 11, S)
        s.put(leg, "front", 2, 11, s_)
        s.paint(leg, SIDES, lambda f, u, v, wd, ht: s.cloth(c["pants_d"], f, u, v, wd, ht, 0.03) if v < 5 else None, layer=1)
    return s.img


def sound_gear():
    c = SN
    g = G.Gear("geometry.aegis.gear_sound")
    tex = Image.new("RGBA", (GW, GW), (0, 0, 0, 0))
    BAND, PLATE, TIES, HAIR = (0, 0, 32, 2), (0, 2, 12, 7), (12, 2, 4, 8), (16, 2, 8, 8)
    ROPE, KNOT, LOOP, TAIL = (0, 10, 32, 4), (32, 10, 4, 4), (36, 10, 8, 4), (44, 10, 4, 8)
    METAL, METAL_E, WRAP, SHIN = (0, 14, 20, 6), (20, 14, 6, 6), (0, 22, 16, 4), (16, 22, 16, 4)

    band_plate(g, tex, BAND, PLATE, c["band"], c["plate"], c["plate_d"], symbol(NOTE, c["ink"]))
    G.ties(g, tex, TIES, c["band"], 4.6)
    spikes(g, tex, HAIR, c["hair"], "head", [
        ((-3.8, 31.2, -1.8), (2.2, 2.6, 2.2), (-22, 0, 30)), ((-1.2, 31.6, -1.2), (2.2, 3.2, 2.2), (-18, 0, -4)),
        ((1.5, 31.2, -1.4), (2.2, 2.7, 2.2), (-26, 0, -32)), ((-2.6, 30.8, 1.6), (2.2, 2.8, 2.2), (-56, 0, 18)),
        ((0.4, 30.6, 2.0), (2.2, 3.0, 2.2), (-62, 0, -14)), ((-1.0, 29.4, 3.2), (2.0, 2.6, 2.0), (-84, 0, 0))])

    # the purple rope belt and its big bow at the back
    tex_fill(tex, ROPE, braid(c["rope"], c["rope_d"], c["rope_h"]))
    tex_fill(tex, KNOT, lambda u, v, wd, ht: c["rope_h"] if (u, v) in ((1, 1), (2, 1)) else (c["rope"] if (u + v) % 2 else c["rope_d"]))
    tex_fill(tex, LOOP, lambda u, v, wd, ht: c["rope_d"] if v in (0, ht - 1) else (c["rope_h"] if u % 3 == 0 else c["rope"]))
    tex_fill(tex, TAIL, braid(c["rope"], c["rope_d"], c["rope_h"]))
    belt = g.bone("g_belt", "body", (0, 13.8, 0))
    g.cube(belt, (-4, 12.7, -2), (8, 2.0, 4), ring(ROPE), inflate=0.42)
    g.cube(belt, (-1.15, 12.4, 2.25), (2.3, 2.6, 1.2), uv(rest=KNOT))
    for sx in (-1, 1):                                           # the two loops of the bow
        x0 = 0.9 if sx > 0 else -4.1
        g.cube(belt, (x0, 12.5, 2.55), (3.2, 2.2, 0.9), uv(north=LOOP, south=LOOP, rest=(LOOP[0], LOOP[1], 2, 4)),
               rotation=(0, 0, -16 * sx), pivot=(0.9 * sx, 13.6, 3.0))
    for i, x in enumerate((-0.95, 0.15)):                       # and its tails
        t = g.bone(f"g_bow_t{i}", "g_belt", (x + 0.4, 12.6, 3.0), (10, 0, (-8, 8)[i]))
        g.cube(t, (x, 7.6 + i * 0.6, 2.75), (0.85, 5.0 - i * 0.6, 0.55), uv(rest=TAIL))

    # the sound-amplifier gauntlet on the right forearm: a metal sleeve full of speaker holes
    def metal(u, v, wd, ht):
        if v == 0 or v == ht - 1:
            return c["metal_d"]
        if u % 3 == 1 and v in (2, 3):
            return (26, 24, 30)                                  # the holes
        return mul(c["metal"], 1.12 if v == 1 else 1.0)
    tex_fill(tex, METAL, metal)
    tex_fill(tex, METAL_E, lambda u, v, wd, ht: (26, 24, 30) if 1 <= u <= 4 and 1 <= v <= 4 and (u + v) % 2 else c["metal_d"])
    ga = g.bone("g_gauntlet", "rightArm", G.BONE_PIVOT["rightArm"])
    g.cube(ga, (-8.45, 12.6, -2.45), (4.9, 4.4, 4.9), uv(north=METAL, south=METAL, east=METAL, west=METAL, up=METAL_E, down=METAL_E))
    g.cube(ga, (-8.75, 15.4, -2.75), (5.5, 1.0, 5.5), uv(rest=(METAL[0], METAL[1], 6, 1)))        # the cuff rim
    g.cube(ga, (-7.2, 13.2, -3.1), (2.4, 2.4, 0.7), uv(rest=METAL_E))                              # the amplifier mouth

    G.wraps(g, tex, "g_wrap_l", "leftArm", (4, 13.0, -2), (4, 3.6, 4), WRAP, c["wrap"], c["wrap_d"], 0.16)
    G.wraps(g, tex, "g_shin_r", "rightLeg", (-3.9, 1.3, -2), (4, 3.4, 4), SHIN, c["wrap"], c["wrap_d"], 0.15)
    G.wraps(g, tex, "g_shin_l", "leftLeg", (-0.1, 1.3, -2), (4, 3.4, 4), SHIN, c["wrap"], c["wrap_d"], 0.15)
    return g, tex



# ===========================================================================
# Leaf Shinobi / Leaf Kunoichi
# ===========================================================================
LF3 = dict(skin=(234, 192, 156), skin_d=(202, 158, 124), cheek=(238, 168, 150), hair=(40, 36, 44), hair_h=(72, 66, 80),
           vest=(90, 118, 66), vest_d=(66, 90, 48), vest_h=(116, 146, 86), vest_dd=(52, 72, 38), pouch=(102, 132, 76),
           navy=(38, 48, 90), navy_d=(26, 34, 68), red=(198, 44, 40), band=(36, 54, 124), plate=(186, 190, 200),
           plate_d=(128, 132, 144), leaf=(70, 74, 86), tape=(222, 216, 202), tape_d=(186, 180, 166), sandal=(36, 44, 86),
           eye=(248, 244, 238), iris=(66, 46, 36), brow=(34, 30, 38), mouth=(170, 104, 96), lip=(204, 112, 112))
LF3_F = dict(LF3, skin=(238, 200, 170), skin_d=(206, 166, 138), hair=(132, 56, 40), hair_h=(170, 82, 58), iris=(52, 92, 70))


def leaf_skin_v3(female=False):
    c = LF3_F if female else LF3
    s = Skin(33 if female else 15)
    H, h, B, S, s_, E, I, K, Q, T, C, L = (c["hair"], c["hair_h"], c["band"], c["skin"], c["skin_d"], c["eye"], c["iris"], c["brow"],
                                           c["mouth"], c["tape"], c["cheek"], c["lip"])
    pal = {"H": H, "h": h, "B": B, "S": S, "s": s_, "E": E, "I": I, "K": K, "Q": Q, "T": T, "C": C, "L": L, "D": mul(B, 0.7)}
    s.paint("head", ("top",), lambda f, u, v, wd, ht: mul(H, 1 + s.rng.uniform(-0.1, 0.16)))
    s.paint("head", ("bottom",), lambda f, u, v, wd, ht: s_)
    s.paint("head", SIDES, lambda f, u, v, wd, ht: s.cloth(S, f, u, v, wd, ht, 0.02))
    if female:
        s.rows("head", "front", ["HHhHHhHH",
                                 "HHSHHSHH",
                                 "BBBBBBBB",
                                 "SKKSSKKS",
                                 "SEISSIES",
                                 "SCSssSCS",
                                 "SSSLLSSS",
                                 "sSSSSSSs"], pal)
        side = ["HHHHHHHH", "HHHHHHHH", "BBBBBBBB", "HHHHHSSS", "HHHHsSSS", "HHHHsSSS", "HHHHSSSS", "HHHHSSSS"]
    else:
        s.rows("head", "front", ["HHhHHhHH",
                                 "HSHHHSHH",
                                 "BBBBBBBB",
                                 "SKKSSKKS",
                                 "SEISSIES",
                                 "SsSTTSsS",
                                 "SSsQQsSS",
                                 "sSSSSSSs"], pal)
        side = ["HHHHHHHH", "HHHHHHHS", "BBBBBBBB", "HHHSSSSS", "HHHsSSSS", "HHSsSSSS", "HHSSSSSS", "HSSSSSSS"]
    s.rows("head", "right", side, pal)
    s.rows("head", "left", [r[::-1] for r in side], pal)
    s.rows("head", "back", ["HHhHHhHH", "HHHHHHHH", "BBBDDBBB", "HhHHHHhH", "HHHHHHHH", "HHhHHhHH", "HHHHHHHH",
                            "HHHHHHHH" if female else "sHHHHHHs"], pal)
    # hat layer: hair volume
    if female:
        s.rows("head", "front", ["HhHHHHhH", "H..H...H"], pal, layer=1)
        for sd in ("right", "left"):
            s.rows("head", sd, ["HhHHhHHh", "HHHHHHH.", "........", "HHHH....", "HHH.....", "HHH.....", "HH......", "H......."], pal, layer=1)
        s.rows("head", "back", ["HhHHhHHh", "HHHHHHHH", "........", "HHhHHhHH", "HHHHHHHH", "HhHHHHhH", "HHHHHHHH", "HHHHHHHH"], pal, layer=1)
    else:
        s.rows("head", "front", ["H.h..H.h", "h......H"], pal, layer=1)
        for sd in ("right", "left"):
            s.rows("head", sd, ["HhH.hH.H", ".H..H..h"], pal, layer=1)
        s.rows("head", "back", ["HhHHhHHh", "H.hH.Hh."], pal, layer=1)
    s.paint("head", ("top",), lambda f, u, v, wd, ht: mul(H, 1.22) if (u * 5 + v * 3) % 6 == 0 else None, layer=1)

    # --- body: navy shirt under the green flak jacket (the 3D vest goes over it)
    def vest(f, u, v, wd, ht):
        if v >= 11:
            return s.cloth(c["navy"], f, u, v, wd, ht)
        if v == 10:
            return c["vest_dd"]
        base = c["vest_h"] if v == 0 else c["vest"]
        if f == "front" and u in (3, 4) and v >= 1:
            base = c["vest_d"]
        return s.cloth(base, f, u, v, wd, ht, 0.04)
    s.paint("body", SIDES, vest)
    s.paint("body", ("top",), lambda f, u, v, wd, ht: c["vest"])
    s.paint("body", ("bottom",), lambda f, u, v, wd, ht: c["navy_d"])
    # --- arms: navy sleeves with the red swirl on the shoulder, hands
    for arm in ("rarm", "larm"):
        s.paint(arm, SIDES, lambda f, u, v, wd, ht: s.cloth(c["navy"], f, u, v, wd, ht) if v < 11 else S)
        s.paint(arm, ("top",), lambda f, u, v, wd, ht: c["navy"])
        s.paint(arm, ("bottom",), lambda f, u, v, wd, ht: s_)
        outer = "right" if arm == "rarm" else "left"
        s.rows(arm, outer, ["....", "....", "....", ".RR.", "R.rR", ".RR."], {"R": c["red"], "r": mul(c["red"], 0.7)})   # below the vest's shoulder
        s.paint(arm, SIDES, lambda f, u, v, wd, ht: c["navy_d"] if v == 10 else None)
        s.paint(arm, SIDES, lambda f, u, v, wd, ht: s.cloth(c["navy_h"] if "navy_h" in c else mul(c["navy"], 1.15), f, u, v, wd, ht, 0.03)
                if v == 9 else None, layer=1)                                         # rolled-up cuffs
    # --- legs: navy trousers, taped right thigh and shins, sandals
    for leg in ("rleg", "lleg"):
        s.paint(leg, SIDES, lambda f, u, v, wd, ht: s.cloth(c["navy"], f, u, v, wd, ht) if v < 8 else
                ((c["tape"] if v % 2 == 0 else c["tape_d"]) if v < 11 else c["sandal"]))
        s.paint(leg, ("top",), lambda f, u, v, wd, ht: c["navy"])
        s.paint(leg, ("bottom",), lambda f, u, v, wd, ht: c["sandal"])
        s.put(leg, "front", 1, 11, S)
        s.put(leg, "front", 2, 11, s_)
    s.paint("rleg", SIDES, lambda f, u, v, wd, ht: c["tape"] if v in (3, 4) else None)
    return s.img


def leaf_vest(g, tex, c, VF, VB, VS, COLLAR, POUCH, CAP, VBAND):
    """The Leaf flak jacket in 3D: the shell, a thick rolled collar, four raised pouches, shoulder caps and a hem band."""
    def front(u, v, wd, ht):
        k = 1.08 - 0.16 * v / ht
        if u in (7, 8):
            return mul(c["vest_d"], k)                         # the zip
        return mul(c["vest"], k * (0.95 if (u * 3 + v) % 7 == 0 else 1))

    def back(u, v, wd, ht):
        k = 1.06 - 0.14 * v / ht
        dx, dy = u - wd / 2 + 0.5, v - ht * 0.36
        rr = math.hypot(dx, dy)
        ang = (math.degrees(math.atan2(dy, dx)) + 360) % 360
        if 4.6 <= rr <= 5.6:
            return c["red"]                                    # the crest's ring
        if 1.6 <= rr <= 4.0 and (ang + rr * 62) % 360 < 210:
            return c["red"]                                    # its swirl
        if rr < 1.2:
            return c["red"]
        return mul(c["vest"], k * (0.95 if (u + v * 3) % 7 == 0 else 1))
    tex_fill(tex, VF, front)
    tex_fill(tex, VB, back)
    tex_fill(tex, VS, lambda u, v, wd, ht: mul(c["vest"], 0.98 - 0.16 * v / ht))
    tex_fill(tex, COLLAR, lambda u, v, wd, ht: mul(c["vest_h"], 1.04 - 0.1 * v))
    tex_fill(tex, POUCH, lambda u, v, wd, ht: (mul(c["pouch"], 0.72) if u in (0, wd - 1) else mul(c["pouch"], 1.18)) if v < 2 else
             (mul(c["pouch"], 0.7) if v == 2 else (mul(c["pouch"], 0.86) if u in (0, wd - 1) else c["pouch"])))
    tex_fill(tex, CAP, lambda u, v, wd, ht: mul(c["vest"], 1.06 - 0.08 * v))
    tex_fill(tex, VBAND, lambda u, v, wd, ht: mul(c["vest_dd"], 1.0 if (u // 2) % 2 else 0.9))
    vest = g.bone("g_vest", "body", (0, 24, 0))
    g.cube(vest, (-4, 13.0, -2), (8, 11.0, 4), uv(north=VF, south=VB, east=VS, west=VS, up=(VS[0], VS[1], 8, 4)), inflate=0.55)
    g.cube(vest, (-4.0, 23.3, -2.3), (8.0, 2.0, 4.6), ring(COLLAR), inflate=0.55)           # the thick rolled collar
    g.cube(vest, (-4, 12.3, -2), (8, 1.1, 4), ring(VBAND), inflate=0.66)                   # the hem band
    for x in (-3.9, 1.3):                                                                  # four raised pouches
        for y in (15.6, 18.9):
            g.cube(vest, (x, y, -3.35), (2.6, 2.7, 0.95), uv(north=POUCH, up=(POUCH[0], POUCH[1], 6, 1),
                                                              rest=(POUCH[0], POUCH[1] + 3, 6, 3)))
    for arm, x in (("rightArm", -8.3), ("leftArm", 3.7)):                                  # the vest over the shoulders
        cap = g.bone(f"g_cap_{arm[0]}", arm, G.BONE_PIVOT[arm])
        g.cube(cap, (x, 22.3, -2.3), (4.6, 2.3, 4.6), uv(rest=CAP), inflate=0.12)        # over the arm's top


def leaf_gear_v3(female=False):
    c = LF3_F if female else LF3
    g = G.Gear("geometry.aegis.gear_chunin_f" if female else "geometry.aegis.gear_chunin")
    tex = Image.new("RGBA", (GW, GW), (0, 0, 0, 0))
    BAND, PLATE, TIES, HAIR, HAIR2 = (0, 0, 32, 2), (0, 2, 12, 7), (12, 2, 4, 8), (16, 2, 8, 8), (24, 2, 8, 8)
    VF, VB, VS = (0, 12, 16, 22), (16, 12, 16, 22), (32, 12, 8, 22)
    COLLAR, POUCH, CAP, VBAND = (40, 12, 16, 4), (40, 16, 6, 6), (46, 16, 8, 6), (40, 22, 16, 2)
    STRAP, HBOX, SHIN, HIP = (0, 34, 16, 2), (16, 34, 6, 6), (0, 40, 16, 4), (22, 34, 6, 4)

    band_plate(g, tex, BAND, PLATE, c["band"], c["plate"], c["plate_d"], symbol(LEAF, c["leaf"]))
    G.ties(g, tex, TIES, c["band"], 3.2 if female else 2.8)
    if female:
        # bangs over the band's edge and a high ponytail that swings
        tex_fill(tex, HAIR, lambda u, v, wd, ht: mul(c["hair"], 1.22 - 0.4 * v / ht))
        tex_fill(tex, HAIR2, lambda u, v, wd, ht: c["band"] if v < 2 else mul(c["hair"], 1.1 - 0.3 * v / ht))
        pt = g.bone("g_ponytail", "head", (0, 31.0, 3.8), (16, 0, 0))
        g.cube(pt, (-1.1, 30.4, 3.6), (2.2, 1.4, 1.4), uv(rest=(HAIR2[0], HAIR2[1], 8, 2)))     # the tie
        g.cube(pt, (-1.5, 25.0, 4.4), (3.0, 6.0, 2.2), uv(rest=HAIR))
        g.cube(pt, (-1.1, 20.6, 4.8), (2.2, 4.6, 1.6), uv(rest=HAIR))
        g.cube(pt, (-0.6, 18.4, 5.1), (1.2, 2.4, 1.0), uv(rest=HAIR))
        locks = g.bone("g_locks", "head", (0, 28, 0))
        for x in (-4.6, 3.8):                                                                    # side locks framing the face
            g.cube(locks, (x, 24.2, -4.4), (0.8, 4.4, 2.2), uv(rest=HAIR))
    else:
        spikes(g, tex, HAIR, c["hair"], "head", [
            ((-3.7, 31.3, -1.6), (2.3, 2.4, 2.3), (-16, 0, 26)), ((-1.2, 31.7, -1.0), (2.3, 2.9, 2.3), (-10, 0, -2)),
            ((1.4, 31.3, -1.2), (2.3, 2.5, 2.3), (-20, 0, -26)), ((-2.4, 31.0, 1.4), (2.3, 2.6, 2.3), (-48, 0, 14)),
            ((0.2, 30.8, 1.8), (2.3, 2.7, 2.3), (-54, 0, -12)), ((-1.0, 29.6, 3.0), (2.1, 2.3, 2.1), (-80, 0, 0))])
    leaf_vest(g, tex, c, VF, VB, VS, COLLAR, POUCH, CAP, VBAND)
    G.holster(g, tex, STRAP, HBOX, c["tape"], (34, 38, 52))
    G.wraps(g, tex, "g_shin_r", "rightLeg", (-3.9, 1.4, -2), (4, 2.8, 4), SHIN, c["tape"], c["tape_d"], 0.14)
    G.wraps(g, tex, "g_shin_l", "leftLeg", (-0.1, 1.4, -2), (4, 2.8, 4), SHIN, c["tape"], c["tape_d"], 0.14)
    G.pouch(g, tex, "g_pouch", "body", (-1.5, 11.6, 2.25), (3.0, 2.0, 1.3), HIP, (188, 168, 128))
    return g, tex



# ===========================================================================
# The Hidden Sand
# ===========================================================================
WIND = [".#####.",          # 風 (the Kazekage's hat badge), simplified
        ".#...#.",
        ".#.#.#.",
        ".#.###.",
        ".#.#.#.",
        ".#...#.",
        "#.....#"]


def folds(c1, c2):
    """Wrapped cloth: diagonal folds."""
    return lambda u, v, wd, ht: mul(c1, 1.06 - 0.1 * ((u + 2 * v) % 5) / 4) if (u + 2 * v) % 5 else c2


def head_wrap(g, tex, r_side, r_top, col, col_d, low=29.0):
    """A desert head-wrap over the top of the head (down to just above the eyes)."""
    tex_fill(tex, r_side, folds(col, col_d))
    tex_fill(tex, r_top, lambda u, v, wd, ht: mul(col, 1.04 if (u + v) % 3 else 0.94))
    hw = g.bone("g_wrap", "head", (0, 30, 0))
    g.cube(hw, (-4, low, -4), (8, 32 - low + 0.3, 8), uv(north=r_side, south=r_side, east=r_side, west=r_side, up=r_top), inflate=0.62)
    g.cube(hw, (-1.6, low + 0.6, 4.3), (3.2, 2.2, 1.2), uv(rest=r_top))                       # the knot at the back
    return hw


def neck_cloth(g, tex, r, col, col_d, width=7.6, length=5.2):
    """A sun cloth hanging from the back of the head over the neck."""
    tex_fill(tex, r, lambda u, v, wd, ht: None if (v == ht - 1 and u % 3 == 1) else mul(col if u % 4 else col_d, 1.04 - 0.12 * v / ht))
    nc = g.bone("g_neckcloth", "head", (0, 29.2, 4.4))
    g.cube(nc, (-width / 2, 29.2 - length, 4.35), (width, length, 0.4), uv(north=r, south=r, rest=(r[0], r[1], 1, 1)))


def suna_vest(g, tex, c, VF, VB, VS, COLLAR, GUARD, VBAND, STRAP, SPOUCH):
    """The Sand flak jacket: padded ribs, a high collar, big shoulder guards, a cross-strap with a pouch."""
    def front(u, v, wd, ht):
        k = 1.06 - 0.14 * v / ht
        if v % 5 == 4:
            return mul(c["vest_d"], k)                         # the seams between the padded ribs
        if u in (7, 8):
            return mul(c["vest_d"], k * 1.06)
        return mul(c["vest"], k * (0.95 if (u * 3 + v) % 7 == 0 else 1) * (1.05 if v % 5 == 0 else 1))

    def back(u, v, wd, ht):
        k = 1.04 - 0.12 * v / ht
        if v % 5 == 4 or u in (7, 8):
            return mul(c["vest_d"], k)
        return mul(c["vest"], k * (0.95 if (u + v * 3) % 7 == 0 else 1))
    tex_fill(tex, VF, front)
    tex_fill(tex, VB, back)
    tex_fill(tex, VS, lambda u, v, wd, ht: mul(c["vest_d"] if v % 5 == 4 else c["vest"], 0.98 - 0.14 * v / ht))
    tex_fill(tex, COLLAR, lambda u, v, wd, ht: mul(c["vest_h"], 1.04 - 0.08 * v))
    tex_fill(tex, GUARD, lambda u, v, wd, ht: mul(c["vest_h"], 1.08 - 0.05 * v) if v < ht - 1 else c["vest_dd"])
    tex_fill(tex, VBAND, lambda u, v, wd, ht: mul(c["vest_dd"], 1.0 if (u // 2) % 2 else 0.9))
    tex_fill(tex, STRAP, lambda u, v, wd, ht: c["strap"] if u else c["strap_d"])
    tex_fill(tex, SPOUCH, lambda u, v, wd, ht: mul(c["strap"], 1.2) if v < 2 else (mul(c["strap"], 0.8) if v == 2 else c["strap"]))
    vest = g.bone("g_vest", "body", (0, 24, 0))
    g.cube(vest, (-4, 13.0, -2), (8, 11.0, 4), uv(north=VF, south=VB, east=VS, west=VS, up=(VS[0], VS[1], 8, 4)), inflate=0.55)
    g.cube(vest, (-4.0, 23.2, -2.3), (8.0, 2.4, 4.6), ring(COLLAR), inflate=0.5)              # the high collar
    g.cube(vest, (-4, 12.3, -2), (8, 1.1, 4), ring(VBAND), inflate=0.66)
    st = g.bone("g_vstrap", "g_vest", (0, 18.5, -2.9), (0, 0, -38))                           # left shoulder → right hip
    g.cube(st, (-0.6, 11.4, -3.25), (1.2, 14.2, 0.4), uv(north=STRAP, south=STRAP, rest=(STRAP[0], STRAP[1], 1, 1)))
    g.cube(st, (-1.3, 15.2, -3.75), (2.6, 2.4, 0.7), uv(north=SPOUCH, rest=(SPOUCH[0], SPOUCH[1] + 3, 4, 2)))
    for arm, x in (("rightArm", -8.5), ("leftArm", 3.5)):                                    # big shoulder guards
        gd = g.bone(f"g_guard_{arm[0]}", arm, G.BONE_PIVOT[arm])
        g.cube(gd, (x, 21.0, -2.5), (5.0, 3.6, 5.0), uv(rest=GUARD), inflate=0.1)
        g.cube(gd, (x + 0.5, 24.6, -2.0), (4.0, 0.6, 4.0), uv(rest=(GUARD[0], GUARD[1], 4, 2)))


def scarf_ring(g, tex, r, col, col_d, tails=((0.6, 7.0),), y=22.6):
    """A scarf round the neck with tails behind (they stream out when running)."""
    tex_fill(tex, r, lambda u, v, wd, ht: None if (v == ht - 1 and u % 3 == 0) else mul(col, (1.08 if v < 2 else 0.95) * (0.88 if (u + v) % 5 == 0 else 1)))
    sc = g.bone("g_scarf", "body", (0, y + 1, 0))
    g.cube(sc, (-4, y, -2), (8, 2.2, 4), ring((r[0], r[1], 32, 4)), inflate=0.62)
    for i, (x, ln) in enumerate(tails):
        t = g.bone(f"g_scarf_t{i}", "g_scarf", (x + 0.8, y + 0.9, 2.65), (22 + i * 8, 0, (-6, 8)[i % 2]))
        g.cube(t, (x, y + 0.9 - ln, 2.5), (1.6, ln, 0.32), uv(north=(r[0] + i * 6, r[1], 4, 8), south=(r[0] + i * 6, r[1], 4, 8)))


# --- Kazekage --------------------------------------------------------------
KZ = dict(skin=(232, 198, 172), skin_d=(200, 164, 138), hair=(178, 54, 44), hair_h=(212, 84, 66), eye=(228, 238, 236),
          iris=(100, 166, 154), ring=(58, 42, 50), mark=(196, 52, 48), robe=(242, 240, 234), robe_d=(208, 206, 200),
          trim=(40, 150, 120), trim_d=(28, 108, 86), under=(190, 160, 110), under_d=(142, 112, 72), sandal=(120, 96, 66))


def kazekage_skin():
    c = KZ
    s = Skin(34)
    H, h, S, s_, E, I, R, M, Q = c["hair"], c["hair_h"], c["skin"], c["skin_d"], c["eye"], c["iris"], c["ring"], c["mark"], mul(c["skin_d"], 0.85)
    pal = {"H": H, "h": h, "S": S, "s": s_, "E": E, "I": I, "R": R, "M": M, "Q": Q}
    s.paint("head", ("top",), lambda f, u, v, wd, ht: mul(H, 1 + s.rng.uniform(-0.1, 0.14)))
    s.paint("head", ("bottom",), lambda f, u, v, wd, ht: s_)
    s.paint("head", SIDES, lambda f, u, v, wd, ht: s.cloth(S, f, u, v, wd, ht, 0.02))
    s.rows("head", "front", ["HhHHhHHh",
                             "HSHHHSHH",
                             "SSSSSMMS",
                             "SRRSSRRS",
                             "REISSIER",
                             "SRRssRRS",
                             "SSSQQSSS",
                             "sSSSSSSs"], pal)
    side = ["HHHHHHHH", "HHHHHHHS", "HHHHSSSS", "HHHSSSSS", "HHHsSSSR", "HHHsSSSS", "HHSSSSSS", "HSSSSSSS"]
    s.rows("head", "right", side, pal)
    s.rows("head", "left", [r[::-1] for r in side], pal)
    s.rows("head", "back", ["HHhHHhHH", "HHHHHHHH", "HhHHHHhH", "HHHHHHHH", "HHhHHhHH", "HHHHHHHH", "HHHHHHHH", "sHHHHHHs"], pal)
    s.rows("head", "front", ["H.h.H.hH", "h..H...H"], pal, layer=1)
    for sd in ("right", "left"):
        s.rows("head", sd, ["HhHHhHHh", "H.H.HH.."], pal, layer=1)
    # --- the Kage robe
    W, w_, T, t, U, u_ = c["robe"], c["robe_d"], c["trim"], c["trim_d"], c["under"], c["under_d"]
    rp = {"W": W, "w": w_, "T": T, "t": t, "U": U, "u": u_}
    s.paint("body", SIDES, lambda f, u, v, wd, ht: s.cloth(W, f, u, v, wd, ht, 0.03))
    s.paint("body", ("top",), lambda f, u, v, wd, ht: W)
    s.paint("body", ("bottom",), lambda f, u, v, wd, ht: w_)
    s.rows("body", "front", ["WTUUUUTW",
                             "WTUUUUTW",
                             "WWTUUTWW",
                             "WWTuUTWW",
                             "WWWTTWWW",
                             "WWWTWWWW",
                             "WWWTWWWW",
                             "WWWTWWWW",
                             "TTTTTTTT",
                             "tTTTTTTt",
                             "WWWTWWWW",
                             "wWWTWWWw"], rp)
    s.rows("body", "back", ["WWWWWWWW"] * 8 + ["TTTTTTTT", "tTTTTTTt", "WWWWWWWW", "wWWWWWWw"], rp)
    for sd in ("right", "left"):
        s.rows("body", sd, ["WWWW"] * 8 + ["TTTT", "tTTt", "WWWW", "wWWw"], rp)
    s.paint("body", ("back", "right", "left"), lambda f, u, v, wd, ht: None if v in (8, 9) else s.cloth(W, f, u, v, wd, ht, 0.03, 1.08, 0.92), layer=1)
    for arm in ("rarm", "larm"):
        s.paint(arm, SIDES, lambda f, u, v, wd, ht: s.cloth(W, f, u, v, wd, ht) if v < 9 else (T if v < 11 else S))
        s.paint(arm, ("top",), lambda f, u, v, wd, ht: W)
        s.paint(arm, ("bottom",), lambda f, u, v, wd, ht: s_)
        s.paint(arm, SIDES, lambda f, u, v, wd, ht: (s.cloth(W, f, u, v, wd, ht, 0.03) if v < 9 else T) if v <= 9 else None, layer=1)   # wide sleeves
    for leg in ("rleg", "lleg"):
        s.paint(leg, SIDES, lambda f, u, v, wd, ht: s.cloth(W, f, u, v, wd, ht) if v < 6 else (s.cloth(U, f, u, v, wd, ht) if v < 11 else c["sandal"]))
        s.paint(leg, ("top",), lambda f, u, v, wd, ht: W)
        s.paint(leg, ("bottom",), lambda f, u, v, wd, ht: c["sandal"])
        s.put(leg, "front", 1, 11, S)
    return s.img


def kazekage_gear():
    c = KZ
    g = G.Gear("geometry.aegis.gear_kazekage")
    tex = Image.new("RGBA", (GW, GW), (0, 0, 0, 0))
    TOP, UNDER, EDGE, TEDGE, PANEL = (0, 0, 16, 16), (16, 0, 16, 16), (0, 16, 16, 2), (0, 18, 16, 2), (32, 0, 9, 9)
    CLOTH, SASH, SKIRT, SKIRT_S, COLLAR = (0, 20, 16, 8), (16, 20, 32, 4), (0, 28, 10, 14), (10, 28, 5, 14), (16, 24, 32, 3)
    weave = lambda base: (lambda u, v, wd, ht: mul(base, (1.03 if (u + v) % 2 else 0.97) * (0.93 if int(math.hypot(u - wd / 2, v - ht / 2)) % 3 == 0 else 1)))
    tex_fill(tex, TOP, weave(c["robe"]))
    tex_fill(tex, UNDER, lambda u, v, wd, ht: mul(c["robe_d"], 0.86))
    tex_fill(tex, EDGE, lambda u, v, wd, ht: mul(c["robe"], 0.95 if u % 3 == 0 else 1.0))
    tex_fill(tex, TEDGE, lambda u, v, wd, ht: c["trim"] if v == 0 else c["trim_d"])
    tex_fill(tex, PANEL, lambda u, v, wd, ht: c["trim_d"] if (u in (0, wd - 1) or v in (0, ht - 1)) else c["trim"])
    symbol(WIND, c["robe"])(ImageDraw.Draw(tex), PANEL)
    tex_fill(tex, CLOTH, lambda u, v, wd, ht: c["trim"] if v == ht - 1 else mul(c["robe"], 1.0 - 0.1 * v / ht - (0.04 if u % 4 == 0 else 0)))
    tex_fill(tex, SASH, lambda u, v, wd, ht: mul(c["trim"], 1.1 if v == 0 else (0.9 if v == ht - 1 else 1.0)))
    tex_fill(tex, SKIRT, lambda u, v, wd, ht: c["trim"] if v >= ht - 2 else mul(c["robe"], 1.0 - 0.1 * v / ht - (0.05 if u == wd // 2 else 0)))
    tex_fill(tex, SKIRT_S, lambda u, v, wd, ht: c["trim"] if v >= ht - 2 else mul(c["robe_d"], 1.02 - 0.08 * v / ht))
    tex_fill(tex, COLLAR, lambda u, v, wd, ht: c["trim"] if v == 0 else c["robe"])
    # the Kage hat: woven rings rising to a point, the teal 風 badge on the front, a veil down the back
    hat = g.bone("g_kasa", "head", (0, 31, 0))
    y = 31.0
    for i, wd in enumerate([15.6, 14.4, 12.6, 10.4, 8.0, 5.4, 2.8]):
        side = TEDGE if i in (0, 4) else EDGE
        for turn in (0, 22.5, 45, 67.5):
            k = 0.94 if turn else 0.92
            g.cube(hat, (-wd * k / 2, y + i * 1.0, -wd * k / 2), (wd * k, 1.05, wd * k),
                   uv(up=TOP, down=UNDER, rest=side), rotation=(0, turn, 0) if turn else None, pivot=(0, y + i * 1.0, 0))
    g.cube(hat, (-0.7, y + 6.8, -0.7), (1.4, 1.2, 1.4), uv(rest=TEDGE))
    g.cube(hat, (-2.6, y + 1.1, -7.6), (5.2, 4.6, 0.5), uv(north=PANEL, rest=(PANEL[0], PANEL[1], 1, 1)),
           rotation=(-28, 0, 0), pivot=(0, y + 1.1, -7.35))                                   # the badge
    for (o, sz, rot, pv) in (((-4.8, 24.2, 4.5), (9.6, 6.8, 0.35), None, None),
                             ((-4.85, 24.6, -0.6), (0.35, 6.4, 5.4), (0, -8, 0), (-4.7, 31, 4.5)),
                             ((4.5, 24.6, -0.6), (0.35, 6.4, 5.4), (0, 8, 0), (4.7, 31, 4.5))):
        cl = g.bone("g_hatcloth", "g_kasa", (0, 31, 4.5)) if "g_hatcloth" not in g.idx else "g_hatcloth"
        g.cube(cl, o, sz, uv(north=CLOTH, south=CLOTH, east=CLOTH, west=CLOTH, rest=(CLOTH[0], CLOTH[1], 1, 1)),
               rotation=rot, pivot=pv)
    # the robe: standing collar, teal sash, skirts over the legs
    robe = g.bone("g_robe", "body", (0, 24, 0))
    g.cube(robe, (-4.1, 22.6, -2.3), (8.2, 1.6, 4.6), ring(COLLAR), inflate=0.4)
    g.cube(robe, (-4, 13.4, -2), (8, 2.0, 4), ring(SASH), inflate=0.42)
    for leg, x in (("rightLeg", -3.9), ("leftLeg", -0.1)):
        sk = g.bone(f"g_skirt_{leg[0]}", leg, G.BONE_PIVOT[leg])
        g.cube(sk, (x, 4.6, -2), (4, 7.4, 4), uv(north=SKIRT, south=SKIRT, east=SKIRT_S, west=SKIRT_S, rest=(SKIRT[0], SKIRT[1], 1, 1)), inflate=0.55)
    return g, tex


# --- Sand Shinobi / Sand Jōnin --------------------------------------------
SS = dict(skin=(214, 170, 128), skin_d=(182, 138, 100), wrap=(228, 214, 180), wrap_d=(190, 174, 138), eye=(244, 238, 228),
          iris=(60, 44, 32), brow=(56, 42, 34), vest=(192, 158, 102), vest_d=(150, 118, 72), vest_h=(216, 186, 130), vest_dd=(122, 94, 56),
          shirt=(88, 98, 112), shirt_d=(64, 72, 84), pants=(112, 94, 74), pants_d=(86, 72, 56), strap=(98, 68, 44), strap_d=(70, 48, 30),
          scarf=(164, 78, 52), scarf_d=(126, 56, 36), band=(84, 64, 48), plate=(186, 190, 200), plate_d=(128, 132, 144),
          mark=(70, 74, 86), cloth=(214, 198, 162), cloth_d=(178, 162, 126), sandal=(96, 74, 52), mouth=(150, 98, 84), tattoo=(180, 44, 40))
SJ = dict(SS, skin=(206, 160, 118), skin_d=(174, 128, 90), wrap=(240, 236, 224), wrap_d=(206, 200, 186), vest=(178, 150, 102),
          vest_d=(138, 112, 72), vest_h=(204, 178, 128), vest_dd=(112, 88, 56), shirt=(52, 58, 72), shirt_d=(38, 42, 54),
          pants=(52, 58, 72), pants_d=(38, 42, 54), band=(52, 58, 72), cloth=(196, 190, 176), cloth_d=(160, 154, 140), sandal=(60, 52, 46))


def sand_skin(jonin=False):
    c = SJ if jonin else SS
    s = Skin(36 if jonin else 35)
    W, S, s_, E, I, K, Q, R = c["wrap"], c["skin"], c["skin_d"], c["eye"], c["iris"], c["brow"], c["mouth"], c["tattoo"]
    pal = {"W": W, "w": c["wrap_d"], "S": S, "s": s_, "E": E, "I": I, "K": K, "Q": Q, "R": R}
    s.paint("head", ("top",), lambda f, u, v, wd, ht: W)
    s.paint("head", ("bottom",), lambda f, u, v, wd, ht: s_)
    s.paint("head", SIDES, lambda f, u, v, wd, ht: s.cloth(S, f, u, v, wd, ht, 0.02))
    s.rows("head", "front", ["WWWWWWWW",
                             "WwWWWWwW",
                             "WWWWWWWW",
                             "SKKSSKKS",
                             "SEISSIES",
                             "SRSssSSS" if jonin else "SSSssSSS",
                             "SRSQQSSS" if jonin else "SSsQQsSS",
                             "sSSSSSSs"], pal)
    for sd in ("right", "left", "back"):
        s.rows("head", sd, ["WWWWWWWW", "WwWWWWwW", "WWWWWWWW", "WWWWWWWW" if sd == "back" else "WWWWSSSS"[::(1 if sd == "right" else -1)]], pal)
    # --- body: the shirt under the vest, a belt
    def under(f, u, v, wd, ht):
        if v >= 10:
            return c["strap_d"] if v == 10 else s.cloth(c["shirt"], f, u, v, wd, ht)
        return s.cloth(c["vest"], f, u, v, wd, ht, 0.04)
    s.paint("body", SIDES, under)
    s.paint("body", ("top",), lambda f, u, v, wd, ht: c["vest"])
    s.paint("body", ("bottom",), lambda f, u, v, wd, ht: c["shirt_d"])
    for arm in ("rarm", "larm"):
        s.paint(arm, SIDES, lambda f, u, v, wd, ht: s.cloth(c["shirt"], f, u, v, wd, ht) if v < 7 else
                ((c["cloth"] if (u + v * 2) % 4 < 2 else c["cloth_d"]) if v < 11 else S))
        s.paint(arm, ("top",), lambda f, u, v, wd, ht: c["shirt"])
        s.paint(arm, ("bottom",), lambda f, u, v, wd, ht: s_)
    for leg in ("rleg", "lleg"):
        s.paint(leg, SIDES, lambda f, u, v, wd, ht: s.cloth(c["pants"], f, u, v, wd, ht) if v < 7 else
                ((c["cloth"] if (u + v * 2) % 4 < 2 else c["cloth_d"]) if v < 11 else c["sandal"]))
        s.paint(leg, ("top",), lambda f, u, v, wd, ht: c["pants"])
        s.paint(leg, ("bottom",), lambda f, u, v, wd, ht: c["sandal"])
        s.put(leg, "front", 1, 11, S)
        s.paint(leg, SIDES, lambda f, u, v, wd, ht: s.cloth(c["pants_d"], f, u, v, wd, ht, 0.03) if v < 5 else None, layer=1)
    return s.img


def sand_gear(jonin=False):
    c = SJ if jonin else SS
    g = G.Gear("geometry.aegis.gear_sand_jonin" if jonin else "geometry.aegis.gear_sand_shinobi")
    tex = Image.new("RGBA", (GW, GW), (0, 0, 0, 0))
    BAND, PLATE, WRAP_S, WRAP_T, NECK = (0, 0, 32, 2), (0, 2, 12, 7), (12, 2, 16, 8), (28, 2, 8, 8), (36, 2, 8, 6)
    VF, VB, VS = (0, 12, 16, 22), (16, 12, 16, 22), (32, 12, 8, 22)
    COLLAR, GUARD, VBAND, STRAP, SPOUCH = (40, 12, 16, 4), (40, 16, 8, 6), (40, 22, 16, 2), (48, 16, 2, 6), (50, 16, 4, 5)
    SCARF, WRAPS, SHIN, VEIL = (0, 34, 32, 8), (32, 34, 16, 4), (32, 38, 16, 4), (48, 34, 6, 12)
    head_wrap(g, tex, WRAP_S, WRAP_T, c["wrap"], c["wrap_d"])
    band_plate(g, tex, BAND, PLATE, c["band"], c["plate"], c["plate_d"], symbol(HOURGLASS, c["mark"]), y=30.0, inflate=0.85)
    neck_cloth(g, tex, NECK, c["wrap"], c["wrap_d"])
    suna_vest(g, tex, c, VF, VB, VS, COLLAR, GUARD, VBAND, STRAP, SPOUCH)
    if jonin:
        # the veil over the left half of the face
        tex_fill(tex, VEIL, lambda u, v, wd, ht: mul(c["wrap"], 1.02 - 0.12 * v / ht - (0.05 if u == 0 else 0)) if not (v == ht - 1 and u % 2) else None)
        vl = g.bone("g_veil", "head", (2.3, 29.3, -4.7))
        g.cube(vl, (0.1, 23.2, -4.85), (4.5, 6.1, 0.3), uv(north=VEIL, south=VEIL, rest=(VEIL[0], VEIL[1], 1, 1)))
    else:
        scarf_ring(g, tex, SCARF, c["scarf"], c["scarf_d"], tails=((0.4, 6.4),))
    G.wraps(g, tex, "g_wrap_r", "rightArm", (-8, 12.6, -2), (4, 3.6, 4), WRAPS, c["cloth"], c["cloth_d"], 0.16)
    G.wraps(g, tex, "g_wrap_l", "leftArm", (4, 12.6, -2), (4, 3.6, 4), WRAPS, c["cloth"], c["cloth_d"], 0.16)
    G.wraps(g, tex, "g_shin_r", "rightLeg", (-3.9, 1.3, -2), (4, 3.4, 4), SHIN, c["cloth"], c["cloth_d"], 0.15)
    G.wraps(g, tex, "g_shin_l", "leftLeg", (-0.1, 1.3, -2), (4, 3.4, 4), SHIN, c["cloth"], c["cloth_d"], 0.15)
    return g, tex


# --- Puppet Master ---------------------------------------------------------
PP = dict(skin=(232, 196, 166), skin_d=(200, 162, 134), paint=(122, 64, 156), suit=(38, 36, 46), suit_h=(62, 60, 74),
          suit_d=(26, 24, 32), eye=(244, 238, 228), iris=(58, 42, 32), belt=(92, 70, 52), belt_d=(66, 50, 36), wrap=(210, 198, 172),
          wrap_d=(170, 158, 134), strap=(84, 62, 44), wood=(132, 94, 62), wood_d=(96, 66, 42), plate=(186, 190, 200),
          plate_d=(128, 132, 144), mark=(70, 74, 86), mouth=(150, 96, 92))


def puppeteer_skin():
    c = PP
    s = Skin(37)
    D, S, s_, P, E, I, Q = c["suit"], c["skin"], c["skin_d"], c["paint"], c["eye"], c["iris"], c["mouth"]
    pal = {"D": D, "d": c["suit_d"], "S": S, "s": s_, "P": P, "E": E, "I": I, "Q": Q}
    s.paint("head", ("top", "bottom"), lambda f, u, v, wd, ht: D)
    s.paint("head", SIDES, lambda f, u, v, wd, ht: s.cloth(D, f, u, v, wd, ht, 0.04))
    s.rows("head", "front", ["DDDDDDDD",
                             "DDDDDDDD",
                             "DSSSSSSD",
                             "DSPSSPSD",
                             "DEIPPIED",
                             "DSPSSPSD",
                             "DSPQQPSD",
                             "DSSSSSSD"], pal)
    # --- the black suit, a belt
    s.paint("body", SIDES, lambda f, u, v, wd, ht: c["belt"] if v in (9, 10) else s.cloth(D, f, u, v, wd, ht, 0.05))
    s.paint("body", ("top", "bottom"), lambda f, u, v, wd, ht: D)
    s.paint("body", ("front",), lambda f, u, v, wd, ht: mul(c["suit_h"], 0.95) if (u in (3, 4) and v < 9) else None)   # the front seam
    s.put("body", "front", 3, 9, (196, 180, 110))
    s.put("body", "front", 4, 9, (196, 180, 110))                                                                         # the buckle
    for arm in ("rarm", "larm"):
        s.paint(arm, SIDES, lambda f, u, v, wd, ht: s.cloth(D, f, u, v, wd, ht, 0.05) if v < 11 else S)
        s.paint(arm, ("top",), lambda f, u, v, wd, ht: D)
        s.paint(arm, ("bottom",), lambda f, u, v, wd, ht: s_)
        s.paint(arm, SIDES, lambda f, u, v, wd, ht: c["suit_h"] if v == 10 else None)
    for leg in ("rleg", "lleg"):
        s.paint(leg, SIDES, lambda f, u, v, wd, ht: s.cloth(D, f, u, v, wd, ht, 0.05) if v < 8 else
                ((c["wrap"] if (u + v * 2) % 4 < 2 else c["wrap_d"]) if v < 11 else c["suit_d"]))
        s.paint(leg, ("top", "bottom"), lambda f, u, v, wd, ht: D)
    return s.img


def puppeteer_gear():
    c = PP
    g = G.Gear("geometry.aegis.gear_puppeteer")
    tex = Image.new("RGBA", (GW, GW), (0, 0, 0, 0))
    HOOD, HOOD_T, PLATE, EAR = (0, 0, 16, 8), (16, 0, 8, 8), (24, 0, 12, 7), (36, 0, 4, 4)
    BUNDLE, BUNDLE_S, BUNDLE_T, STRAP, WOOD = (0, 8, 16, 20), (16, 8, 8, 20), (24, 8, 8, 8), (32, 8, 2, 16), (34, 8, 6, 6)
    BELT, BPOUCH, SHIN = (0, 28, 32, 2), (32, 28, 5, 4), (0, 32, 16, 4)
    tex_fill(tex, HOOD, lambda u, v, wd, ht: mul(c["suit"], 1.0 + (0.12 if (u + v * 3) % 7 == 0 else 0) - 0.08 * v / ht))
    tex_fill(tex, HOOD_T, lambda u, v, wd, ht: mul(c["suit"], 1.08 if (u + v) % 3 == 0 else 1.0))
    tex_fill(tex, PLATE, lambda u, v, wd, ht: c["plate_d"] if (u in (0, wd - 1) or v in (0, ht - 1)) else mul(c["plate"], 1.08 - 0.16 * v / ht))
    symbol(HOURGLASS, c["mark"])(ImageDraw.Draw(tex), PLATE)
    tex_fill(tex, EAR, lambda u, v, wd, ht: c["suit_h"] if (u + v) % 3 == 0 else c["suit"])
    # the hood: top, back and sides — the face stays open
    hd = g.bone("g_hood", "head", (0, 28, 0))
    for o, sz in (((-4.55, 31.0, -4.55), (9.1, 1.8, 9.1)), ((-4.55, 23.6, 4.05), (9.1, 7.4, 0.5)),
                  ((-4.55, 23.6, -4.55), (0.5, 7.4, 8.6)), ((4.05, 23.6, -4.55), (0.5, 7.4, 8.6)),
                  ((-4.55, 29.9, -4.6), (9.1, 1.2, 0.55))):
        g.cube(hd, o, sz, uv(rest=HOOD, up=HOOD_T))
    g.cube(hd, (-2.5, 29.95, -5.2), (5.0, 2.3, 0.55), uv(north=PLATE, rest=(PLATE[0], PLATE[1], 2, 2)))           # the Sand plate
    for x in (-3.9, 1.7):                                                                                           # the pointed "ears"
        g.cube(hd, (x, 32.0, -0.9), (2.2, 2.2, 1.8), uv(rest=EAR), rotation=(0, 0, 45), pivot=(x + 1.1, 32.8, 0))
    # the puppet on his back, wrapped in bandages and strapped on
    tex_fill(tex, BUNDLE, lambda u, v, wd, ht: mul(c["wrap"] if (v + u // 4) % 3 else c["wrap_d"], 1.04 - 0.1 * v / ht))
    tex_fill(tex, BUNDLE_S, lambda u, v, wd, ht: mul(c["wrap_d"] if (v + u // 3) % 3 == 0 else c["wrap"], 0.96))
    tex_fill(tex, BUNDLE_T, lambda u, v, wd, ht: c["wrap_d"] if (u + v) % 2 else c["wrap"])
    tex_fill(tex, STRAP, lambda u, v, wd, ht: c["strap"] if u else mul(c["strap"], 0.75))
    tex_fill(tex, WOOD, lambda u, v, wd, ht: c["wood_d"] if (u in (0, wd - 1) or v == ht - 1) else mul(c["wood"], 1.06 if (u + v) % 3 else 0.94))
    pk = g.bone("g_puppet", "body", (0, 24, 2.3))
    g.cube(pk, (-3.6, 10.6, 2.35), (7.2, 14.4, 4.0), uv(north=BUNDLE_S, south=BUNDLE, east=BUNDLE_S, west=BUNDLE_S, up=BUNDLE_T, down=BUNDLE_T))
    g.cube(pk, (-1.7, 24.8, 3.0), (3.4, 3.0, 3.0), uv(rest=WOOD))                                     # its wooden head peeking out
    g.cube(pk, (-1.0, 26.9, 2.8), (2.0, 0.9, 0.7), uv(rest=(WOOD[0], WOOD[1], 2, 2)))                 # (a horn)
    for x in (-2.9, 1.7):
        g.cube(pk, (x, 9.0, 3.2), (1.2, 1.8, 1.4), uv(rest=WOOD))                                     # and its hands below
    for rot in (32, -32):                                                                              # straps across the bundle
        g.cube(pk, (-0.6, 11.6, 6.4), (1.2, 12.8, 0.3), uv(north=STRAP, south=STRAP, rest=(STRAP[0], STRAP[1], 1, 1)),
               rotation=(0, 0, rot), pivot=(0, 18, 6.55))
    sf = g.bone("g_straps", "body", (0, 24, 0))
    for x in (-3.0, 1.8):
        g.cube(sf, (x, 14.0, -2.62), (1.2, 10.0, 0.32), uv(north=STRAP, south=STRAP, rest=(STRAP[0], STRAP[1], 1, 1)))
    # belt pouches, bandaged shins
    tex_fill(tex, BELT, lambda u, v, wd, ht: c["belt"] if v == 0 else c["belt_d"])
    tex_fill(tex, BPOUCH, lambda u, v, wd, ht: mul(c["belt"], 1.18) if v < 1 else c["belt"])
    bl = g.bone("g_belt", "body", (0, 14, 0))
    g.cube(bl, (-4, 13.0, -2), (8, 1.6, 4), ring(BELT), inflate=0.4)
    for x in (-4.6, 2.2):
        g.cube(bl, (x, 12.0, -2.9), (2.4, 2.4, 1.3), uv(rest=BPOUCH))
    G.wraps(g, tex, "g_shin_r", "rightLeg", (-3.9, 1.3, -2), (4, 3.4, 4), SHIN, c["wrap"], c["wrap_d"], 0.15)
    G.wraps(g, tex, "g_shin_l", "leftLeg", (-0.1, 1.3, -2), (4, 3.4, 4), SHIN, c["wrap"], c["wrap_d"], 0.15)
    return g, tex


# --- Sand Genin --------------------------------------------------------------
GA = dict(skin=(214, 172, 132), skin_d=(182, 140, 102), hair=(92, 64, 44), hair_h=(124, 90, 62), top=(226, 206, 166),
          top_d=(190, 170, 130), sash=(58, 112, 138), sash_d=(40, 82, 104), pants=(126, 104, 78), pants_d=(98, 80, 58),
          cloth=(212, 196, 160), cloth_d=(176, 160, 124), band=(84, 64, 48), plate=(186, 190, 200), plate_d=(128, 132, 144),
          mark=(70, 74, 86), eye=(244, 238, 228), iris=(70, 50, 34), brow=(70, 50, 36), mouth=(160, 100, 86), sandal=(96, 74, 52),
          scarf=(170, 62, 54), scarf_d=(130, 44, 38), bag=(120, 86, 56))
GB = dict(GA, skin=(228, 192, 160), skin_d=(196, 158, 128), hair=(42, 36, 42), hair_h=(70, 62, 72), top=(178, 194, 204),
          top_d=(140, 156, 168), sash=(92, 102, 116), sash_d=(68, 76, 88), pants=(84, 92, 104), pants_d=(62, 68, 80), iris=(54, 62, 80),
          brow=(42, 36, 42), mouth=(196, 112, 112))


def sand_genin_skin(girl=False):
    c = GB if girl else GA
    s = Skin(39 if girl else 38)
    H, h, S, s_, E, I, K, Q = c["hair"], c["hair_h"], c["skin"], c["skin_d"], c["eye"], c["iris"], c["brow"], c["mouth"]
    pal = {"H": H, "h": h, "S": S, "s": s_, "E": E, "I": I, "K": K, "Q": Q, "B": c["band"], "C": (232, 170, 150)}
    s.paint("head", ("top",), lambda f, u, v, wd, ht: mul(H, 1 + s.rng.uniform(-0.1, 0.16)))
    s.paint("head", ("bottom",), lambda f, u, v, wd, ht: s_)
    s.paint("head", SIDES, lambda f, u, v, wd, ht: s.cloth(S, f, u, v, wd, ht, 0.02))
    s.rows("head", "front", ["HhHHhHHh",
                             "HHSHHHSH" if girl else "HSHhSHHS",
                             "BBBBBBBB",
                             "SKKSSKKS",
                             "SEISSIES",
                             "SCSssSCS" if girl else "SSSssSSS",
                             "SSSQQSSS" if girl else "SSsQQsSS",
                             "sSSSSSSs"], pal)
    side = (["HHHHHHHH", "HHHHHHHH", "BBBBBBBB", "HHHHHSSS", "HHHHsSSS", "HHHHSSSS", "HHHHSSSS", "HHHSSSSS"] if girl else
            ["HHHHHHHH", "HHHHHHHS", "BBBBBBBB", "HHHSSSSS", "HHHsSSSS", "HHHsSSSS", "HHSSSSSS", "HSSSSSSS"])
    s.rows("head", "right", side, pal)
    s.rows("head", "left", [r[::-1] for r in side], pal)
    s.rows("head", "back", ["HHhHHhHH", "HHHHHHHH", "BBBBBBBB", "HhHHHHhH", "HHHHHHHH", "HHhHHhHH",
                            "HHHHHHHH", "HHHHHHHH" if girl else "sHHHHHHs"], pal)
    if girl:
        for sd in ("right", "left"):
            s.rows("head", sd, ["HhHHhHHh", "HHHHHHH.", "........", "HHHH....", "HHH.....", "HH......"], pal, layer=1)
        s.rows("head", "back", ["HhHHhHHh", "HHHHHHHH", "........", "HHhHHhHH", "HHHHHHHH", "HhHHHHhH", "HHHHHHHH"], pal, layer=1)
        s.rows("head", "front", ["HhHHHHhH", "H..H...H"], pal, layer=1)
    else:
        s.rows("head", "front", ["H.hH.h.H", ".H..H..h"], pal, layer=1)
        for sd in ("right", "left"):
            s.rows("head", sd, ["HhH.hH.H", ".H..H..h"], pal, layer=1)
    T, t, X, x = c["top"], c["top_d"], c["sash"], c["sash_d"]
    s.paint("body", SIDES, lambda f, u, v, wd, ht: (X if v == 8 else x) if v in (8, 9) else s.cloth(T, f, u, v, wd, ht, 0.04))
    s.paint("body", ("top",), lambda f, u, v, wd, ht: T)
    s.paint("body", ("bottom",), lambda f, u, v, wd, ht: t)
    s.rows("body", "front", ["tTTTTTTt", ".tTTTTt.", "..tTTt.."], {"T": mul(T, 0.9), "t": t})                 # the tunic's collar
    for arm in ("rarm", "larm"):
        s.paint(arm, SIDES, lambda f, u, v, wd, ht: s.cloth(T, f, u, v, wd, ht) if v < 5 else
                ((c["cloth"] if (u + v * 2) % 4 < 2 else c["cloth_d"]) if v in (8, 9, 10) and not girl else (S if v >= 5 else T)))
        s.paint(arm, ("top",), lambda f, u, v, wd, ht: T)
        s.paint(arm, ("bottom",), lambda f, u, v, wd, ht: s_)
    for leg in ("rleg", "lleg"):
        s.paint(leg, SIDES, lambda f, u, v, wd, ht: s.cloth(c["pants"], f, u, v, wd, ht) if v < 7 else
                ((c["cloth"] if (u + v * 2) % 4 < 2 else c["cloth_d"]) if v < 11 else c["sandal"]))
        s.paint(leg, ("top",), lambda f, u, v, wd, ht: c["pants"])
        s.paint(leg, ("bottom",), lambda f, u, v, wd, ht: c["sandal"])
        s.put(leg, "front", 1, 11, S)
    if girl:   # a short wrap skirt over the trousers
        s.paint("body", ("front", "back", "right", "left"), lambda f, u, v, wd, ht: mul(c["top_d"], 0.95) if v in (10, 11) else None, layer=1)
        for leg in ("rleg", "lleg"):
            s.paint(leg, SIDES, lambda f, u, v, wd, ht: s.cloth(c["top_d"], f, u, v, wd, ht, 0.03) if v < 3 else None, layer=1)
    return s.img


def sand_genin_gear(girl=False):
    c = GB if girl else GA
    g = G.Gear("geometry.aegis.gear_sand_genin_b" if girl else "geometry.aegis.gear_sand_genin_a")
    tex = Image.new("RGBA", (GW, GW), (0, 0, 0, 0))
    BAND, PLATE, TIES, HAIR = (0, 0, 32, 2), (0, 2, 12, 7), (12, 2, 4, 8), (16, 2, 8, 8)
    SCARF, BAGS, BAG, SHIN = (0, 12, 32, 8), (32, 12, 2, 16), (34, 12, 6, 6), (0, 22, 16, 4)
    band_plate(g, tex, BAND, PLATE, c["band"], c["plate"], c["plate_d"], symbol(HOURGLASS, c["mark"]))
    G.ties(g, tex, TIES, c["band"], 3.0)
    if girl:
        scarf_ring(g, tex, SCARF, c["scarf"], c["scarf_d"], tails=((0.5, 6.2), (-2.1, 5.0)))
        tex_fill(tex, HAIR, lambda u, v, wd, ht: mul(c["hair"], 1.2 - 0.35 * v / ht))
        hb = g.bone("g_bob", "head", (0, 28, 0))
        for o, sz in (((-4.75, 24.6, -4.3), (0.9, 4.6, 3.0)), ((3.85, 24.6, -4.3), (0.9, 4.6, 3.0)), ((-4.6, 24.4, 3.6), (9.2, 5.6, 1.0))):
            g.cube(hb, o, sz, uv(rest=HAIR))
    else:
        spikes(g, tex, HAIR, c["hair"], "head", [
            ((-3.6, 31.2, -1.4), (2.2, 2.2, 2.2), (-20, 0, 30)), ((-1.1, 31.6, -0.8), (2.2, 2.6, 2.2), (-14, 0, 6)),
            ((1.4, 31.2, -1.0), (2.2, 2.2, 2.2), (-24, 0, -30)), ((-1.8, 30.8, 1.8), (2.2, 2.4, 2.2), (-56, 0, 10)),
            ((0.6, 30.6, 2.2), (2.0, 2.2, 2.0), (-60, 0, -18))])
        tex_fill(tex, BAGS, lambda u, v, wd, ht: c["bag"] if u else mul(c["bag"], 0.75))
        tex_fill(tex, BAG, lambda u, v, wd, ht: mul(c["bag"], 1.15) if v < 2 else (mul(c["bag"], 0.8) if v == 2 else c["bag"]))
        st = g.bone("g_bagstrap", "body", (0, 18, 0), (0, 0, 40))
        g.cube(st, (-0.6, 10.6, -2.5), (1.2, 15, 0.3), uv(north=BAGS, south=BAGS, rest=(BAGS[0], BAGS[1], 1, 1)))
        g.cube(st, (-0.6, 10.6, 2.2), (1.2, 15, 0.3), uv(north=BAGS, south=BAGS, rest=(BAGS[0], BAGS[1], 1, 1)))
        bag = g.bone("g_bag", "body", (3, 13, 0))
        g.cube(bag, (4.0, 11.4, -1.6), (1.6, 3.4, 3.2), uv(rest=BAG))
    G.wraps(g, tex, "g_shin_r", "rightLeg", (-3.9, 1.3, -2), (4, 3.4, 4), SHIN, c["cloth"], c["cloth_d"], 0.15)
    G.wraps(g, tex, "g_shin_l", "leftLeg", (-0.1, 1.3, -2), (4, 3.4, 4), SHIN, c["cloth"], c["cloth_d"], 0.15)
    return g, tex


# ===========================================================================
# Registry
# ===========================================================================
MODELS = {
    "sound": (sound_skin, sound_gear),
    "chunin": (leaf_skin_v3, leaf_gear_v3),
    "chunin_f": (lambda: leaf_skin_v3(True), lambda: leaf_gear_v3(True)),
    "kazekage": (kazekage_skin, kazekage_gear),
    "sand_shinobi": (sand_skin, sand_gear),
    "sand_jonin": (lambda: sand_skin(True), lambda: sand_gear(True)),
    "puppeteer": (puppeteer_skin, puppeteer_gear),
    "sand_genin_a": (sand_genin_skin, sand_genin_gear),
    "sand_genin_b": (lambda: sand_genin_skin(True), lambda: sand_genin_gear(True)),
}

FLUTTER = {
    "g_neckcloth": {"rotation": ["math.sin(q.life_time * 160) * 4 + q.modified_move_speed * 30", 0, 0]},
    "g_veil": {"rotation": ["math.sin(q.life_time * 150) * 3 - q.modified_move_speed * 6", 0, "math.sin(q.life_time * 110) * 2"]},
    "g_hatcloth": {"rotation": ["math.sin(q.life_time * 140) * 3 + q.modified_move_speed * 22", 0, 0]},
    "g_ponytail": {"rotation": ["math.sin(q.life_time * 190) * 5 + q.modified_move_speed * 26", 0, "math.sin(q.life_time * 140) * 5"]},
    "g_bow_t0": {"rotation": ["math.sin(q.life_time * 230) * 6 + q.modified_move_speed * 34", 0, "math.sin(q.life_time * 170) * 5"]},
    "g_bow_t1": {"rotation": ["math.sin(q.life_time * 210 + 50) * 6 + q.modified_move_speed * 30", 0, "math.sin(q.life_time * 190 + 30) * 5"]},
}
