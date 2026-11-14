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
MIST = ["..#..#.",          # the Mist village's slanting strokes
        ".#..#..",
        "#..#..#",
        "..#..#.",
        ".#..#.."]
CLOUD = [".##.##.",         # the Cloud village's cloud over a line
         "#######",
         "#######",
         ".......",
         "#######"]
STONE = ["...#...",         # the Stone village's mountain
         "..#.#..",
         ".#.#.#.",
         "#.#.#.#",
         "#######"]
RAIN = ["#.#.#.#",          # the Rain village's four falling lines
        "#.#.#.#",
        "#.#.#.#",
        "#.#.#.#",
        "#.#.#.#"]
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


GAARA = dict(front=["HhHHhHHh", "HSHHHSHH", "SSSSSMMS", "SRRSSRRS", "REISSIER", "SRRssRRS", "SSSQQSSS", "sSSSSSSs"],
             side=["HHHHHHHH", "HHHHHHHS", "HHHHSSSS", "HHHSSSSS", "HHHsSSSR", "HHHsSSSS", "HHSSSSSS", "HSSSSSSS"],
             back=["HHhHHhHH", "HHHHHHHH", "HhHHHHhH", "HHHHHHHH", "HHhHHhHH", "HHHHHHHH", "HHHHHHHH", "sHHHHHHs"],
             front1=["H.h.H.hH", "h..H...H"], side1=["HhHHhHHh", "H.H.HH.."], back1=None)


def kage_skin(c, face, seed, sleeveless=False):
    """A Kage in the robe of office: white with the village's trim, sash and undersuit (hat and skirts are gear)."""
    s = Skin(seed)
    H, h, S, s_ = c["hair"], c["hair_h"], c["skin"], c["skin_d"]
    pal = {"H": H, "h": h, "S": S, "s": s_, "E": c["eye"], "I": c["iris"], "R": c.get("ring", s_), "M": c.get("mark", s_),
           "Q": c.get("mouth", mul(s_, 0.85)), "G": c.get("beard", H), "g": mul(c.get("beard", H), 0.86), "N": c.get("nose", s_),
           "L": c.get("lip", c.get("mouth", s_)), "K": c.get("brow", H), "C": c.get("cheek", S)}
    s.paint("head", ("top",), lambda f, u, v, wd, ht: mul(H, 1 + s.rng.uniform(-0.1, 0.14)))
    s.paint("head", ("bottom",), lambda f, u, v, wd, ht: s_)
    s.paint("head", SIDES, lambda f, u, v, wd, ht: s.cloth(S, f, u, v, wd, ht, 0.02))
    s.rows("head", "front", face["front"], pal)
    s.rows("head", "right", face["side"], pal)
    s.rows("head", "left", [r[::-1] for r in face["side"]], pal)
    s.rows("head", "back", face["back"], pal)
    if face.get("front1"):
        s.rows("head", "front", face["front1"], pal, layer=1)
    if face.get("side1"):
        for sd in ("right", "left"):
            s.rows("head", sd, face["side1"] if sd == "right" else [r[::-1] for r in face["side1"]], pal, layer=1)
    if face.get("back1"):
        s.rows("head", "back", face["back1"], pal, layer=1)
    # --- the Kage robe
    W, w_, T, t, U, u_ = c["robe"], c["robe_d"], c["trim"], c["trim_d"], c["under"], c["under_d"]
    rp = {"W": W, "w": w_, "T": T, "t": t, "U": U, "u": u_}
    s.paint("body", SIDES, lambda f, u, v, wd, ht: s.cloth(W, f, u, v, wd, ht, 0.03))
    s.paint("body", ("top",), lambda f, u, v, wd, ht: W)
    s.paint("body", ("bottom",), lambda f, u, v, wd, ht: w_)
    s.rows("body", "front", ["WTUUUUTW", "WTUUUUTW", "WWTUUTWW", "WWTuUTWW", "WWWTTWWW", "WWWTWWWW", "WWWTWWWW", "WWWTWWWW",
                             "TTTTTTTT", "tTTTTTTt", "WWWTWWWW", "wWWTWWWw"], rp)
    s.rows("body", "back", ["WWWWWWWW"] * 8 + ["TTTTTTTT", "tTTTTTTt", "WWWWWWWW", "wWWWWWWw"], rp)
    for sd in ("right", "left"):
        s.rows("body", sd, ["WWWW"] * 8 + ["TTTT", "tTTt", "WWWW", "wWWw"], rp)
    s.paint("body", ("back", "right", "left"), lambda f, u, v, wd, ht: None if v in (8, 9) else s.cloth(W, f, u, v, wd, ht, 0.03, 1.08, 0.92), layer=1)
    for arm in ("rarm", "larm"):
        if sleeveless:   # bare, muscled arms
            s.paint(arm, SIDES, lambda f, u, v, wd, ht: (s.cloth(W, f, u, v, wd, ht) if v < 2 else s.cloth(S, f, u, v, wd, ht, 0.03)))
            s.paint(arm, ("top",), lambda f, u, v, wd, ht: W)
            s.paint(arm, SIDES, lambda f, u, v, wd, ht: mul(S, 0.9) if (f == "front" and u in (1, 2) and v in (3, 4)) else None)
        else:
            s.paint(arm, SIDES, lambda f, u, v, wd, ht: s.cloth(W, f, u, v, wd, ht) if v < 9 else (T if v < 11 else S))
            s.paint(arm, ("top",), lambda f, u, v, wd, ht: W)
            s.paint(arm, SIDES, lambda f, u, v, wd, ht: (s.cloth(W, f, u, v, wd, ht, 0.03) if v < 9 else T) if v <= 9 else None, layer=1)
        s.paint(arm, ("bottom",), lambda f, u, v, wd, ht: s_)
    for leg in ("rleg", "lleg"):
        s.paint(leg, SIDES, lambda f, u, v, wd, ht: s.cloth(W, f, u, v, wd, ht) if v < 6 else (s.cloth(U, f, u, v, wd, ht) if v < 11 else c["sandal"]))
        s.paint(leg, ("top",), lambda f, u, v, wd, ht: W)
        s.paint(leg, ("bottom",), lambda f, u, v, wd, ht: c["sandal"])
        s.put(leg, "front", 1, 11, S)
    return s.img


def kage_gear(c, kanji, ident, extra=None):
    """The Kage hat (woven rings rising to a point, the village's badge on the front, a veil down the back), the robe's
    standing collar, sash and skirts. extra(g, tex) adds the Kage's own pieces in the texture's free corner (x ≥ 48)."""
    g = G.Gear(ident)
    tex = Image.new("RGBA", (GW, GW), (0, 0, 0, 0))
    TOP, UNDER, EDGE, TEDGE, PANEL = (0, 0, 16, 16), (16, 0, 16, 16), (0, 16, 16, 2), (0, 18, 16, 2), (32, 0, 9, 9)
    CLOTH, SASH, SKIRT, SKIRT_S, COLLAR = (0, 20, 16, 8), (16, 20, 32, 4), (0, 28, 10, 14), (10, 28, 5, 14), (16, 24, 32, 3)
    weave = lambda base: (lambda u, v, wd, ht: mul(base, (1.03 if (u + v) % 2 else 0.97) * (0.93 if int(math.hypot(u - wd / 2, v - ht / 2)) % 3 == 0 else 1)))
    tex_fill(tex, TOP, weave(c["robe"]))
    tex_fill(tex, UNDER, lambda u, v, wd, ht: mul(c["robe_d"], 0.86))
    tex_fill(tex, EDGE, lambda u, v, wd, ht: mul(c["robe"], 0.95 if u % 3 == 0 else 1.0))
    tex_fill(tex, TEDGE, lambda u, v, wd, ht: c["trim"] if v == 0 else c["trim_d"])
    tex_fill(tex, PANEL, lambda u, v, wd, ht: c["trim_d"] if (u in (0, wd - 1) or v in (0, ht - 1)) else c["trim"])
    symbol(kanji, c.get("ink", c["robe"]))(ImageDraw.Draw(tex), PANEL)
    tex_fill(tex, CLOTH, lambda u, v, wd, ht: c["trim"] if v == ht - 1 else mul(c["robe"], 1.0 - 0.1 * v / ht - (0.04 if u % 4 == 0 else 0)))
    tex_fill(tex, SASH, lambda u, v, wd, ht: mul(c.get("sash", c["trim"]), 1.1 if v == 0 else (0.9 if v == ht - 1 else 1.0)))
    tex_fill(tex, SKIRT, lambda u, v, wd, ht: c["trim"] if v >= ht - 2 else mul(c["robe"], 1.0 - 0.1 * v / ht - (0.05 if u == wd // 2 else 0)))
    tex_fill(tex, SKIRT_S, lambda u, v, wd, ht: c["trim"] if v >= ht - 2 else mul(c["robe_d"], 1.02 - 0.08 * v / ht))
    tex_fill(tex, COLLAR, lambda u, v, wd, ht: c["trim"] if v == 0 else c["robe"])
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
    robe = g.bone("g_robe", "body", (0, 24, 0))
    g.cube(robe, (-4.1, 22.6, -2.3), (8.2, 1.6, 4.6), ring(COLLAR), inflate=0.4)
    g.cube(robe, (-4, 13.4, -2), (8, 2.0, 4), ring(SASH), inflate=0.42)
    for leg, x in (("rightLeg", -3.9), ("leftLeg", -0.1)):
        sk = g.bone(f"g_skirt_{leg[0]}", leg, G.BONE_PIVOT[leg])
        g.cube(sk, (x, 4.6, -2), (4, 7.4, 4), uv(north=SKIRT, south=SKIRT, east=SKIRT_S, west=SKIRT_S, rest=(SKIRT[0], SKIRT[1], 1, 1)), inflate=0.55)
    if extra:
        extra(g, tex)
    return g, tex


def kazekage_skin():
    return kage_skin(KZ, GAARA, 34)


def kazekage_gear():
    return kage_gear(KZ, WIND, "geometry.aegis.gear_kazekage")


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
# Generic village shinobi: faces, bodies, the five villages' flak jackets and their accessories
# ===========================================================================
WATER = ["...#...",         # 水
         "#..#..#",
         ".#.#.#.",
         "..###..",
         ".#.#.#.",
         "#..#..#",
         "...#..."]
THUNDER = ["#######",       # 雷
           "#.#.#.#",
           "#######",
           "#..#..#",
           "#######",
           "#..#..#",
           "#######"]
EARTH = ["...#...",         # 土
         "...#...",
         ".#####.",
         "...#...",
         "...#...",
         "...#...",
         "#######"]

# faces: H hair · h hair light · S skin · s shade · E eye white · I iris · K brow · Q mouth · L lips · C cheek · B headband
# D mask · X bandage · G beard · N nose · O dark glasses · W head-wrap · R eye ring
FACE_M = dict(front=["HhHHhHHh", "HSHhSHHS", "BBBBBBBB", "SKKSSKKS", "SEISSIES", "SSSssSSS", "SSsQQsSS", "sSSSSSSs"],
              side=["HHHHHHHH", "HHHHHHHS", "BBBBBBBB", "HHHSSSSS", "HHHsSSSS", "HHHsSSSS", "HHSSSSSS", "HSSSSSSS"],
              back=["HHhHHhHH", "HHHHHHHH", "BBBBBBBB", "HhHHHHhH", "HHHHHHHH", "HHhHHhHH", "HHHHHHHH", "sHHHHHHs"],
              front1=["H.hH.h.H", ".H..H..h"], side1=["HhH.hH.H", ".H..H..h"], back1=["HhHHhHHh", "H.hH.Hh."])
FACE_F = dict(front=["HhHHhHHh", "HHSHHHSH", "BBBBBBBB", "SKKSSKKS", "SEISSIES", "SCSssSCS", "SSSLLSSS", "sSSSSSSs"],
              side=["HHHHHHHH", "HHHHHHHH", "BBBBBBBB", "HHHHHSSS", "HHHHsSSS", "HHHHSSSS", "HHHHSSSS", "HHHSSSSS"],
              back=["HHhHHhHH", "HHHHHHHH", "BBBBBBBB", "HhHHHHhH", "HHHHHHHH", "HHhHHhHH", "HHHHHHHH", "HHHHHHHH"],
              front1=["HhHHHHhH", "H..H...H"], side1=["HhHHhHHh", "HHHHHHH.", "........", "HHHH....", "HHH.....", "HH......"],
              back1=["HhHHhHHh", "HHHHHHHH", "........", "HHhHHhHH", "HHHHHHHH", "HhHHHHhH", "HHHHHHHH"])


def masked(face, rows=(5, 6, 7), ch="D", from_u=0):
    """A face with its lower rows covered (a mask, a bandage wrap)."""
    out = dict(face)
    out["front"] = [("S" * from_u + ch * (8 - from_u)) if i in rows else r for i, r in enumerate(face["front"])]
    out["side"] = [(r[:4] + ch * 4) if i in rows else r for i, r in enumerate(face["side"])]
    return out


def paint_head(s, c, face):
    H, S, s_ = c["hair"], c["skin"], c["skin_d"]
    pal = {"H": H, "h": c.get("hair_h", mul(H, 1.25)), "S": S, "s": s_, "E": c.get("eye", (244, 238, 228)), "I": c["iris"],
           "K": c.get("brow", mul(H, 0.9)), "Q": c.get("mouth", (156, 96, 88)), "L": c.get("lip", (196, 108, 108)), "C": c.get("cheek", S),
           "B": c.get("band", (60, 60, 70)), "D": c.get("mask", (44, 44, 52)), "X": c.get("cloth", (214, 206, 190)),
           "G": c.get("beard", H), "N": c.get("nose", s_), "O": (24, 24, 30), "W": c.get("wrap", H), "R": c.get("ring", s_)}
    s.paint("head", ("top",), lambda f, u, v, wd, ht: mul(c.get("top", H), 1 + s.rng.uniform(-0.1, 0.15)))
    s.paint("head", ("bottom",), lambda f, u, v, wd, ht: s_)
    s.paint("head", SIDES, lambda f, u, v, wd, ht: s.cloth(S, f, u, v, wd, ht, 0.02))
    s.rows("head", "front", face["front"], pal)
    s.rows("head", "right", face["side"], pal)
    s.rows("head", "left", [r[::-1] for r in face["side"]], pal)
    s.rows("head", "back", face["back"], pal)
    for key, faces in (("front1", ("front",)), ("side1", ("right", "left")), ("back1", ("back",))):
        if face.get(key):
            for fc in faces:
                s.rows("head", fc, face[key] if fc != "left" else [r[::-1] for r in face[key]], pal, layer=1)
    s.paint("head", ("top",), lambda f, u, v, wd, ht: mul(c.get("top", H), 1.2) if (u * 5 + v * 3) % 6 == 0 else None, layer=1)


def ninja_skin(c, face, seed):
    """A village shinobi: the shirt under a (3D) flak jacket, sleeves, wrapped or gloved forearms, trousers and sandals.
    c keys: torso (the jacket's colour painted under it), belt, shirt, sleeve(s), sleeve_to, forearm ('wrap'|'glove'|'skin'),
    bare_left (a single sleeve), pants, cloth, sandal."""
    s = Skin(seed)
    paint_head(s, c, face)
    S, s_ = c["skin"], c["skin_d"]

    def torso(f, u, v, wd, ht):
        if v >= 10:
            return c.get("belt", c["shirt"]) if v == 10 else s.cloth(c["shirt"], f, u, v, wd, ht)
        return s.cloth(c["torso"], f, u, v, wd, ht, 0.04)
    s.paint("body", SIDES, torso)
    s.paint("body", ("top",), lambda f, u, v, wd, ht: c["torso"])
    s.paint("body", ("bottom",), lambda f, u, v, wd, ht: c["shirt"])
    for arm in ("rarm", "larm"):
        bare = arm == "larm" and c.get("bare_left")
        to = 2 if bare else c.get("sleeve_to", 7)
        fore = c.get("forearm", "wrap")
        sleeve = c.get("sleeve", c["shirt"])

        def paint(f, u, v, wd, ht, to=to, fore=fore, sleeve=sleeve):
            if v < to:
                return s.cloth(sleeve, f, u, v, wd, ht)
            if v >= 11:
                return c.get("glove", S) if fore == "glove" else S
            if fore == "wrap" and v >= 8:
                return c["cloth"] if (u + v * 2) % 4 < 2 else c.get("cloth_d", mul(c["cloth"], 0.84))
            if fore == "glove" and v >= 8:
                return s.cloth(c.get("glove", (40, 40, 46)), f, u, v, wd, ht)
            return s.cloth(S, f, u, v, wd, ht, 0.02)
        s.paint(arm, SIDES, paint)
        s.paint(arm, ("top",), lambda f, u, v, wd, ht, sleeve=sleeve: sleeve)
        s.paint(arm, ("bottom",), lambda f, u, v, wd, ht: s_)
    for leg in ("rleg", "lleg"):
        s.paint(leg, SIDES, lambda f, u, v, wd, ht: s.cloth(c["pants"], f, u, v, wd, ht) if v < 7 else
                ((c["cloth"] if (u + v * 2) % 4 < 2 else c.get("cloth_d", mul(c["cloth"], 0.84))) if v < 11 else c["sandal"]))
        s.paint(leg, ("top",), lambda f, u, v, wd, ht: c["pants"])
        s.paint(leg, ("bottom",), lambda f, u, v, wd, ht: c["sandal"])
        s.put(leg, "front", 1, 11, S)
        s.paint(leg, SIDES, lambda f, u, v, wd, ht: s.cloth(mul(c["pants"], 0.86), f, u, v, wd, ht, 0.03) if v < 5 else None, layer=1)
    return s.img


# regions of every ninja gear texture (64x64)
NR = dict(BAND=(0, 0, 32, 2), PLATE=(0, 2, 12, 7), TIES=(12, 2, 4, 8), HAIR=(16, 2, 8, 8), HAIR2=(24, 2, 8, 8), WRAP_S=(32, 2, 16, 8),
          WRAP_T=(48, 2, 8, 8), NECK=(56, 2, 8, 8), VF=(0, 12, 16, 22), VB=(16, 12, 16, 22), VS=(32, 12, 8, 22), COLLAR=(40, 12, 16, 4),
          GUARD=(40, 16, 8, 6), VBAND=(40, 22, 16, 2), STRAP=(48, 16, 2, 6), SPOUCH=(50, 16, 4, 5), MASK=(54, 16, 10, 6),
          SCARF=(0, 34, 32, 8), WRAPS=(32, 34, 16, 4), SHIN=(32, 38, 16, 4), X1=(48, 34, 16, 12), X2=(0, 42, 32, 12),
          X3=(32, 42, 16, 12), X4=(48, 46, 12, 12))


def shell(g, tex, c, R, bone, y0=13.0, h=11.0, inflate=0.55, front=None, back=None, side=None):
    """The body of a flak jacket / cloak: one cube round the torso with its own front, back and side paint."""
    tex_fill(tex, R["VF"], front)
    tex_fill(tex, R["VB"], back or front)
    tex_fill(tex, R["VS"], side or (lambda u, v, wd, ht: mul(c["vest"], 0.98 - 0.14 * v / ht)))
    g.cube(bone, (-4, y0, -2), (8, h, 4), uv(north=R["VF"], south=R["VB"], east=R["VS"], west=R["VS"],
                                            up=(R["VS"][0], R["VS"][1], 8, 4), down=(R["VS"][0], R["VS"][1], 8, 4)), inflate=inflate)


def kiri_vest(g, tex, c, R):
    """The Mist flak jacket: quilted in vertical ribs, a tall collar, a dark sash knotted at the hip."""
    def front(u, v, wd, ht):
        k = 1.06 - 0.14 * v / ht
        if u % 3 == 2 or u in (7, 8):
            return mul(c["vest_d"], k)
        return mul(c["vest"], k * (0.96 if (u + v * 3) % 7 == 0 else 1))
    vest = g.bone("g_vest", "body", (0, 24, 0))
    shell(g, tex, c, R, vest, front=front)
    tex_fill(tex, R["COLLAR"], lambda u, v, wd, ht: mul(c["vest_h"], 1.04 - 0.08 * v))
    tex_fill(tex, R["VBAND"], lambda u, v, wd, ht: mul(c["sash"], 1.0 if (u // 2) % 2 else 0.88))
    tex_fill(tex, R["GUARD"], lambda u, v, wd, ht: mul(c["sash"], 1.1 - 0.06 * v))
    g.cube(vest, (-4.0, 23.0, -2.3), (8.0, 2.9, 4.6), ring(R["COLLAR"]), inflate=0.48)
    g.cube(vest, (-4, 12.3, -2), (8, 1.6, 4), ring(R["VBAND"]), inflate=0.7)                              # the sash
    g.cube(vest, (3.4, 9.6, -2.9), (1.4, 3.6, 0.6), uv(rest=R["GUARD"]), rotation=(0, 0, 8), pivot=(4.1, 13, -2.6))   # its knot's tail


def kumo_vest(g, tex, c, R):
    """The Cloud flak jacket: one-shouldered, a broad strap over the left shoulder, a guard on that shoulder only."""
    def front(u, v, wd, ht):
        k = 1.05 - 0.12 * v / ht
        if v % 6 == 5:
            return mul(c["vest_d"], k)
        return mul(c["vest"], k * (0.96 if (u * 3 + v) % 7 == 0 else 1))
    vest = g.bone("g_vest", "body", (0, 24, 0))
    shell(g, tex, c, R, vest, y0=13.0, h=10.0, front=front)
    tex_fill(tex, R["STRAP"], lambda u, v, wd, ht: c["vest_h"] if u else c["vest_d"])
    tex_fill(tex, R["GUARD"], lambda u, v, wd, ht: mul(c["vest_h"], 1.06 - 0.05 * v) if v < ht - 1 else c["vest_dd"])
    tex_fill(tex, R["VBAND"], lambda u, v, wd, ht: mul(c.get("belt_c", c["vest_dd"]), 1.0 if (u // 2) % 2 else 0.9))
    for z in (-2.85, 2.55):                                                                               # the strap over the left shoulder
        g.cube(vest, (1.2, 13.0, z), (2.4, 11.6, 0.3), uv(rest=R["STRAP"]))
    g.cube(vest, (1.2, 23.9, -2.85), (2.4, 0.7, 5.7), uv(rest=R["STRAP"]))
    g.cube(vest, (-4, 12.4, -2), (8, 1.2, 4), ring(R["VBAND"]), inflate=0.66)
    gd = g.bone("g_guard_l", "leftArm", G.BONE_PIVOT["leftArm"])
    g.cube(gd, (3.6, 21.4, -2.45), (4.9, 3.2, 4.9), uv(rest=R["GUARD"]), inflate=0.08)


def iwa_vest(g, tex, c, R):
    """The Stone flak jacket: a tall flared collar, a guard on the right shoulder, a wide sash with a hanging end."""
    def front(u, v, wd, ht):
        k = 1.05 - 0.14 * v / ht
        if u in (7, 8) or v in (7, 14):
            return mul(c["vest_d"], k)
        return mul(c["vest"], k * (0.95 if (u * 3 + v) % 7 == 0 else 1))
    vest = g.bone("g_vest", "body", (0, 24, 0))
    shell(g, tex, c, R, vest, front=front)
    tex_fill(tex, R["COLLAR"], lambda u, v, wd, ht: mul(c["vest_h"], 1.04 - 0.08 * v))
    tex_fill(tex, R["GUARD"], lambda u, v, wd, ht: mul(c["vest_h"], 1.05 - 0.05 * v) if v < ht - 1 else c["vest_dd"])
    tex_fill(tex, R["VBAND"], lambda u, v, wd, ht: mul(c["sash"], 1.0 if (u // 2) % 2 else 0.88))
    tex_fill(tex, R["SPOUCH"], lambda u, v, wd, ht: mul(c["sash"], 1.0 - 0.06 * v))
    g.cube(vest, (-4.0, 23.0, -2.3), (8.0, 2.2, 4.6), ring(R["COLLAR"]), inflate=0.5)
    g.cube(vest, (-4.6, 24.6, -2.9), (9.2, 1.4, 5.8), ring(R["COLLAR"]), inflate=0.25)                 # the flare
    g.cube(vest, (-4, 12.2, -2), (8, 1.8, 4), ring(R["VBAND"]), inflate=0.7)
    g.cube(vest, (-3.6, 8.2, -2.95), (2.0, 4.4, 0.4), uv(rest=R["SPOUCH"]))                               # the sash's end
    gd = g.bone("g_guard_r", "rightArm", G.BONE_PIVOT["rightArm"])
    g.cube(gd, (-8.5, 21.4, -2.45), (4.9, 3.2, 4.9), uv(rest=R["GUARD"]), inflate=0.08)


def ame_cloak(g, tex, c, R):
    """The Rain cloak: a long poncho over the shoulders to the hips, its front closed down the middle, a high collar."""
    def front(u, v, wd, ht):
        k = 1.04 - 0.14 * v / ht
        if u in (7, 8):
            return mul(c["vest_dd"], k)
        if v % 5 == 4:
            return mul(c["vest_d"], k)
        return mul(c["vest"], k * (0.95 if (u * 3 + v) % 7 == 0 else 1))
    vest = g.bone("g_vest", "body", (0, 24, 0))
    shell(g, tex, c, R, vest, y0=10.4, h=13.6, inflate=0.72, front=front)
    tex_fill(tex, R["COLLAR"], lambda u, v, wd, ht: mul(c["vest_h"], 1.04 - 0.08 * v))
    tex_fill(tex, R["GUARD"], lambda u, v, wd, ht: mul(c["vest"], 1.04 - 0.08 * v) if v < ht - 1 else c["vest_dd"])
    g.cube(vest, (-4.0, 23.2, -2.3), (8.0, 2.7, 4.6), ring(R["COLLAR"]), inflate=0.52)
    for arm, x in (("rightArm", -8.55), ("leftArm", 3.55)):                                              # the cape over the shoulders
        cp = g.bone(f"g_cape_{arm[0]}", arm, G.BONE_PIVOT[arm])
        g.cube(cp, (x, 18.6, -2.55), (5.0, 5.8, 5.1), uv(rest=R["GUARD"]), inflate=0.05)


def head_band(g, tex, c, R, mark, style="band"):
    """The village headband: on the forehead ('band'), tied over the hair as a bandana ('bandana'), slanted ('tilt')."""
    if style == "bandana":
        tex_fill(tex, R["WRAP_S"], lambda u, v, wd, ht: mul(c["band"], 1.04 if v < 2 else 0.94))
        tex_fill(tex, R["WRAP_T"], lambda u, v, wd, ht: mul(c["band"], 1.02 if (u + v) % 3 else 0.92))
        hw = g.bone("g_wrap", "head", (0, 30, 0))
        g.cube(hw, (-4, 29.2, -4), (8, 3.0, 8), uv(north=R["WRAP_S"], south=R["WRAP_S"], east=R["WRAP_S"], west=R["WRAP_S"], up=R["WRAP_T"]), inflate=0.58)
        band_plate(g, tex, R["BAND"], R["PLATE"], c["band"], c["plate"], c["plate_d"], symbol(mark, c["mark"]), y=30.0, inflate=0.8)
    else:
        hb = band_plate(g, tex, R["BAND"], R["PLATE"], c["band"], c["plate"], c["plate_d"], symbol(mark, c["mark"]))
        if style == "tilt":
            g.idx[hb]["rotation"] = [0, 0, -12]
    G.ties(g, tex, R["TIES"], c["band"], 3.4)


def long_hair(g, tex, c, R, length=9.0, bangs=False, one_eye=False):
    tex_fill(tex, R["HAIR2"], lambda u, v, wd, ht: mul(c["hair"], 1.18 - 0.36 * v / ht - (0.06 if u % 3 == 0 else 0)))
    lh = g.bone("g_longhair", "head", (0, 29, 3.8))
    g.cube(lh, (-4.4, 31.5 - length - 1.5, 3.7), (8.8, length + 1.5, 1.0), uv(rest=R["HAIR2"]))
    for x in (-4.75, 3.85):
        g.cube(lh, (x, 31.5 - length * 0.55, -3.6), (0.9, length * 0.55 - 0.5, 7.4), uv(rest=R["HAIR2"]))
    if one_eye:                                                                                     # a lock falling over the right eye
        g.cube(lh, (-3.9, 26.4, -4.75), (3.0, 4.6, 0.7), uv(rest=R["HAIR2"]))
    if bangs:
        g.cube(lh, (-4.2, 30.0, -4.7), (8.4, 1.6, 0.7), uv(rest=R["HAIR2"]))


def respirator(g, tex, c, R):
    """A rebreather over the mouth with a filter on each cheek."""
    m = c.get("metal", (128, 132, 140))
    tex_fill(tex, R["MASK"], lambda u, v, wd, ht: mul(m, 0.7) if v in (0, ht - 1) else ((30, 30, 36) if (u % 2 and 2 <= v <= 3) else mul(m, 1.05 - 0.05 * v)))
    rb = g.bone("g_mask", "head", (0, 26, 0))
    g.cube(rb, (-2.4, 24.3, -5.15), (4.8, 3.0, 1.3), uv(rest=R["MASK"]))
    for x in (-4.4, 2.8):
        g.cube(rb, (x, 24.6, -4.6), (1.6, 1.8, 1.6), uv(rest=R["MASK"]), rotation=(0, 45, 0), pivot=(x + 0.8, 25.5, -3.8))
    g.cube(rb, (-4.25, 26.2, -4.25), (8.5, 0.5, 8.5), ring((R["MASK"][0], R["MASK"][1], 10, 1)))


def lower_wrap(g, tex, c, R, col):
    """Cloth wrapped round the lower face (and neck)."""
    tex_fill(tex, R["MASK"], lambda u, v, wd, ht: col if (u + v * 2) % 4 < 2 else mul(col, 0.86))
    lw = g.bone("g_facewrap", "head", (0, 26, 0))
    g.cube(lw, (-4, 23.6, -4), (8, 3.6, 8), ring(R["MASK"]), inflate=0.3)


def hood(g, tex, c, R, col):
    tex_fill(tex, R["WRAP_S"], lambda u, v, wd, ht: mul(col, 1.0 + (0.1 if (u + v * 3) % 7 == 0 else 0) - 0.08 * v / ht))
    tex_fill(tex, R["WRAP_T"], lambda u, v, wd, ht: mul(col, 1.06 if (u + v) % 3 == 0 else 1.0))
    hd = g.bone("g_hood", "head", (0, 28, 0))
    for o, sz in (((-4.55, 31.0, -4.55), (9.1, 1.8, 9.1)), ((-4.55, 23.4, 4.05), (9.1, 7.6, 0.5)),
                  ((-4.55, 23.4, -4.55), (0.5, 7.6, 8.6)), ((4.05, 23.4, -4.55), (0.5, 7.6, 8.6)), ((-4.55, 29.8, -4.6), (9.1, 1.3, 0.55))):
        g.cube(hd, o, sz, uv(rest=R["WRAP_S"], up=R["WRAP_T"]))
    return hd


def back_blade(g, tex, c, R, length=16, width=3.4, angle=-34, hole=True, name="g_sword"):
    """A big blade strapped across the back (hilt over the right shoulder)."""
    steel, steel_d = c.get("steel", (178, 184, 194)), c.get("steel_d", (120, 126, 138))
    br = R["X2"]

    def blade(u, v, wd, ht):
        if hole and 3 <= v <= 6 and 1 <= u <= 3 and (u - 2) ** 2 + (v - 4.5) ** 2 <= 2.2:
            return None
        return mul(steel, 1.18) if u == 0 else (steel_d if u == wd - 1 else mul(steel, 1.0 - 0.04 * (u % 2)))
    tex_fill(tex, (br[0], br[1], 6, 12), blade)
    tex_fill(tex, (br[0] + 6, br[1], 3, 8), lambda u, v, wd, ht: (40, 34, 30) if (u + v) % 2 else c.get("grip", (96, 70, 46)))
    tex_fill(tex, (br[0] + 9, br[1], 4, 2), lambda u, v, wd, ht: (92, 92, 100))
    sw = g.bone(name, "body", (0, 18.5, 3.4), (0, 0, angle))
    g.cube(sw, (-width / 2, 24.0 - length, 2.95), (width, length, 0.6), uv(north=(br[0], br[1], 6, 12), south=(br[0], br[1], 6, 12),
                                                                          rest=(br[0], br[1], 1, 12)))
    g.cube(sw, (-width / 2 - 0.3, 24.0, 2.8), (width + 0.6, 0.9, 0.95), uv(rest=(br[0] + 9, br[1], 4, 2)))
    g.cube(sw, (-0.65, 24.9, 2.9), (1.3, 5.0, 0.8), uv(rest=(br[0] + 6, br[1], 3, 8)))


def ninja_gear(c, ident, mark, vest=None, band="band", extras=(), hair=None):
    g = G.Gear(ident)
    tex = Image.new("RGBA", (GW, GW), (0, 0, 0, 0))
    R = NR
    if band:
        head_band(g, tex, c, R, mark, band)
    if hair:
        spikes(g, tex, R["HAIR"], c["hair"], "head", hair)
    if vest:
        vest(g, tex, c, R)
    for x in extras:
        x(g, tex, c, R)
    if c.get("forearm", "wrap") == "wrap":
        G.wraps(g, tex, "g_wrap_r", "rightArm", (-8, 12.6, -2), (4, 3.6, 4), R["WRAPS"], c["cloth"], c.get("cloth_d", mul(c["cloth"], 0.84)), 0.16)
        G.wraps(g, tex, "g_wrap_l", "leftArm", (4, 12.6, -2), (4, 3.6, 4), R["WRAPS"], c["cloth"], c.get("cloth_d", mul(c["cloth"], 0.84)), 0.16)
    G.wraps(g, tex, "g_shin_r", "rightLeg", (-3.9, 1.3, -2), (4, 3.4, 4), R["SHIN"], c["cloth"], c.get("cloth_d", mul(c["cloth"], 0.84)), 0.15)
    G.wraps(g, tex, "g_shin_l", "leftLeg", (-0.1, 1.3, -2), (4, 3.4, 4), R["SHIN"], c["cloth"], c.get("cloth_d", mul(c["cloth"], 0.84)), 0.15)
    return g, tex


SPIKY = [((-3.7, 31.3, -1.6), (2.3, 2.4, 2.3), (-16, 0, 26)), ((-1.2, 31.7, -1.0), (2.3, 2.9, 2.3), (-10, 0, -2)),
         ((1.4, 31.3, -1.2), (2.3, 2.5, 2.3), (-20, 0, -26)), ((-2.4, 31.0, 1.4), (2.3, 2.6, 2.3), (-48, 0, 14)),
         ((0.2, 30.8, 1.8), (2.3, 2.7, 2.3), (-54, 0, -12)), ((-1.0, 29.6, 3.0), (2.1, 2.3, 2.1), (-80, 0, 0))]
SHORT_SPIKY = [((-3.6, 31.2, -1.4), (2.2, 2.0, 2.2), (-20, 0, 30)), ((-1.1, 31.5, -0.8), (2.2, 2.2, 2.2), (-14, 0, 6)),
               ((1.4, 31.2, -1.0), (2.2, 2.0, 2.2), (-24, 0, -30)), ((-1.0, 30.7, 2.0), (2.2, 2.0, 2.2), (-58, 0, 0))]


def genin_skin(c, seed, girl=False, mark_band=True):
    """A genin of any village (the Sand genin's look, re-coloured)."""
    s = Skin(seed)
    paint_head(s, c, FACE_F if girl else dict(FACE_M, front1=["H.hH.h.H", ".H..H..h"], back1=None))
    T, t, X, x = c["top"], c["top_d"], c["sash"], c["sash_d"]
    s.paint("body", SIDES, lambda f, u, v, wd, ht: (X if v == 8 else x) if v in (8, 9) else s.cloth(T, f, u, v, wd, ht, 0.04))
    s.paint("body", ("top",), lambda f, u, v, wd, ht: T)
    s.paint("body", ("bottom",), lambda f, u, v, wd, ht: t)
    s.rows("body", "front", ["tTTTTTTt", ".tTTTTt.", "..tTTt.."], {"T": mul(T, 0.9), "t": t})
    S, s_ = c["skin"], c["skin_d"]
    for arm in ("rarm", "larm"):
        s.paint(arm, SIDES, lambda f, u, v, wd, ht: s.cloth(T, f, u, v, wd, ht) if v < 5 else
                ((c["cloth"] if (u + v * 2) % 4 < 2 else c["cloth_d"]) if v in (8, 9, 10) and not girl else S))
        s.paint(arm, ("top",), lambda f, u, v, wd, ht: T)
        s.paint(arm, ("bottom",), lambda f, u, v, wd, ht: s_)
    for leg in ("rleg", "lleg"):
        s.paint(leg, SIDES, lambda f, u, v, wd, ht: s.cloth(c["pants"], f, u, v, wd, ht) if v < 7 else
                ((c["cloth"] if (u + v * 2) % 4 < 2 else c["cloth_d"]) if v < 11 else c["sandal"]))
        s.paint(leg, ("top",), lambda f, u, v, wd, ht: c["pants"])
        s.paint(leg, ("bottom",), lambda f, u, v, wd, ht: c["sandal"])
        s.put(leg, "front", 1, 11, S)
    if girl:
        s.paint("body", ("front", "back", "right", "left"), lambda f, u, v, wd, ht: mul(c["top_d"], 0.95) if v in (10, 11) else None, layer=1)
        for leg in ("rleg", "lleg"):
            s.paint(leg, SIDES, lambda f, u, v, wd, ht: s.cloth(c["top_d"], f, u, v, wd, ht, 0.03) if v < 3 else None, layer=1)
    return s.img


def genin_gear(c, ident, mark, girl=False):
    g = G.Gear(ident)
    tex = Image.new("RGBA", (GW, GW), (0, 0, 0, 0))
    BAND, PLATE, TIES, HAIR = (0, 0, 32, 2), (0, 2, 12, 7), (12, 2, 4, 8), (16, 2, 8, 8)
    SCARF, BAGS, BAG, SHIN = (0, 12, 32, 8), (32, 12, 2, 16), (34, 12, 6, 6), (0, 22, 16, 4)
    band_plate(g, tex, BAND, PLATE, c["band"], c["plate"], c["plate_d"], symbol(mark, c["mark"]))
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
# Accessories for the villages' NPCs (each takes its own texture region r)
# ===========================================================================
def plate_on(g, tex, c, r, bone, y=30.4, z=-5.2):
    """The village plate on a hood or helmet front (no band)."""
    tex_fill(tex, r, lambda u, v, wd, ht: c["plate_d"] if (u in (0, wd - 1) or v in (0, ht - 1)) else mul(c["plate"], 1.08 - 0.16 * v / ht))
    symbol(c["_mark"], c["mark"])(ImageDraw.Draw(tex), r)
    g.cube(bone, (-2.5, y - 1.15, z), (5.0, 2.3, 0.55), uv(north=r, rest=(r[0], r[1], 2, 2)))


def sword_fan(g, tex, c, r):
    """Several sword hilts fanned out behind the shoulders."""
    tex_fill(tex, (r[0], r[1], 2, 8), lambda u, v, wd, ht: (36, 32, 30) if (u + v) % 2 else c.get("grip", (150, 40, 40)))
    tex_fill(tex, (r[0] + 2, r[1], 4, 2), lambda u, v, wd, ht: (200, 170, 70) if v == 0 else (150, 120, 40))
    tex_fill(tex, (r[0] + 6, r[1], 2, 8), lambda u, v, wd, ht: (190, 196, 206) if u == 0 else (140, 146, 158))
    fan = g.bone("g_swords", "body", (0, 19.5, 3.2))
    for i, ang in enumerate((-48, -20, 8, 36)):
        piv = (0, 19.5, 3.0 + i * 0.05)
        g.cube(fan, (-0.45, 19.5, 2.75 + i * 0.05), (0.9, 7.2, 0.6), uv(rest=(r[0] + 6, r[1], 2, 8)), rotation=(0, 0, ang), pivot=piv)  # blade
        g.cube(fan, (-1.1, 26.7, 2.65 + i * 0.05), (2.2, 0.5, 0.8), uv(rest=(r[0] + 2, r[1], 4, 2)), rotation=(0, 0, ang), pivot=piv)  # guard
        g.cube(fan, (-0.5, 27.2, 2.7 + i * 0.05), (1.0, 3.4, 0.7), uv(rest=(r[0], r[1], 2, 8)), rotation=(0, 0, ang), pivot=piv)    # grip


def hammer(g, tex, c, r):
    """A great stone-headed hammer slung on the back."""
    tex_fill(tex, (r[0], r[1], 2, 12), lambda u, v, wd, ht: (110, 80, 52) if u else (84, 60, 38))
    tex_fill(tex, (r[0] + 2, r[1], 8, 6), lambda u, v, wd, ht: mul((128, 124, 118), 1.08 - 0.08 * v + (0.06 if (u * 3 + v) % 5 == 0 else 0)))
    tex_fill(tex, (r[0] + 2, r[1] + 6, 8, 2), lambda u, v, wd, ht: (92, 96, 104))
    hm = g.bone("g_hammer", "body", (0, 18, 3.4), (0, 0, 32))
    g.cube(hm, (-0.55, 8.0, 3.0), (1.1, 19.0, 1.1), uv(rest=(r[0], r[1], 2, 12)))
    g.cube(hm, (-3.0, 25.4, 2.0), (6.0, 4.2, 3.2), uv(rest=(r[0] + 2, r[1], 8, 6)))
    for y in (25.2, 29.4):
        g.cube(hm, (-3.2, y, 1.8), (6.4, 0.5, 3.6), uv(rest=(r[0] + 2, r[1] + 6, 8, 2)))


def umbrella(g, tex, c, r):
    """A closed oiled-paper umbrella strapped diagonally on the back."""
    col = c.get("umbrella", (150, 54, 70))
    tex_fill(tex, (r[0], r[1], 6, 12), lambda u, v, wd, ht: mul(col, 1.1 if u % 3 == 0 else (0.82 if u % 3 == 2 else 1.0)) if v % 5 else mul(col, 0.7))
    tex_fill(tex, (r[0] + 6, r[1], 2, 12), lambda u, v, wd, ht: (70, 52, 38) if u else (50, 36, 26))
    um = g.bone("g_umbrella", "body", (0, 18, 3.4), (0, 0, -28))
    g.cube(um, (-0.35, 6.4, 3.1), (0.7, 25.0, 0.7), uv(rest=(r[0] + 6, r[1], 2, 12)))                 # the shaft
    for i, (w_, y0, h_) in enumerate(((3.0, 13.0, 6.0), (2.3, 19.0, 6.0), (1.5, 25.0, 4.2))):        # the folded canopy, tapering
        for turn in (0, 45):
            g.cube(um, (-w_ / 2, y0, 3.45 - w_ / 2), (w_, h_, w_), uv(rest=(r[0], r[1], 6, 12)), rotation=(0, turn, 0) if turn else None,
                   pivot=(0, y0, 3.45))
    g.cube(um, (-0.6, 5.2, 2.85), (1.2, 1.4, 1.2), uv(rest=(r[0] + 6, r[1], 2, 2)))                  # the handle


def apron(g, tex, c, r):
    """A heavy leather smith's apron."""
    lc = c.get("leather", (112, 76, 48))
    tex_fill(tex, r, lambda u, v, wd, ht: mul(lc, 0.75) if u in (0, wd - 1) else mul(lc, 1.05 - 0.12 * v / ht + (0.05 if (u + v * 3) % 7 == 0 else 0)))
    ap = g.bone("g_apron", "body", (0, 22, -2.6))
    g.cube(ap, (-3.4, 8.4, -2.95), (6.8, 14.4, 0.4), uv(north=r, south=r, rest=(r[0], r[1], 1, 1)))
    g.cube(ap, (-3.4, 22.6, -2.9), (0.5, 1.6, 4.8), uv(rest=(r[0], r[1], 1, 1)))
    g.cube(ap, (2.9, 22.6, -2.9), (0.5, 1.6, 4.8), uv(rest=(r[0], r[1], 1, 1)))


def goggles(g, tex, c, r):
    """Work goggles pushed up on the forehead."""
    tex_fill(tex, (r[0], r[1], 8, 2), lambda u, v, wd, ht: (60, 44, 32) if v else (80, 60, 44))
    tex_fill(tex, (r[0], r[1] + 2, 4, 4), lambda u, v, wd, ht: (180, 140, 60) if (u in (0, 3) or v in (0, 3)) else (120, 170, 190))
    gg = g.bone("g_goggles", "head", (0, 30, 0))
    g.cube(gg, (-4, 29.6, -4), (8, 1.0, 8), ring((r[0], r[1], 8, 2)), inflate=0.5)
    for x in (-3.4, 0.6):
        g.cube(gg, (x, 29.2, -5.0), (2.8, 2.0, 0.9), uv(rest=(r[0], r[1] + 2, 4, 4)))


def sunglasses(g, tex, c, r):
    tex_fill(tex, r, lambda u, v, wd, ht: (20, 20, 26) if v else (60, 60, 70))
    sg = g.bone("g_shades", "head", (0, 27.5, 0))
    g.cube(sg, (-3.9, 26.9, -4.45), (7.8, 1.3, 0.35), uv(rest=r))
    for x in (-4.45, 4.1):
        g.cube(sg, (x, 27.6, -4.3), (0.35, 0.4, 3.6), uv(rest=r))


def bracelets(g, tex, c, r):
    """Heavy gold bracelets on both forearms."""
    gold = (226, 186, 64)
    tex_fill(tex, r, lambda u, v, wd, ht: mul(gold, 1.15) if v == 0 else (mul(gold, 0.75) if v == ht - 1 else gold))
    for arm, x in (("rightArm", -8), ("leftArm", 4)):
        b = g.bone(f"g_bracelet_{arm[0]}", arm, G.BONE_PIVOT[arm])
        for y in (12.6, 14.4):
            g.cube(b, (x, y, -2), (4, 1.2, 4), ring(r), inflate=0.32)


def big_nose(g, tex, c, r):
    tex_fill(tex, r, lambda u, v, wd, ht: mul(c.get("nose", (214, 110, 100)), 1.1 if v == 0 else 1.0))
    nz = g.bone("g_nose", "head", (0, 26.6, -4))
    g.cube(nz, (-0.9, 25.6, -5.1), (1.8, 1.7, 1.3), uv(rest=r))


def rope_belt(g, tex, c, r):
    tex_fill(tex, r, braid(c.get("rope", (110, 96, 120)), mul(c.get("rope", (110, 96, 120)), 0.72), mul(c.get("rope", (110, 96, 120)), 1.3)))
    rb = g.bone("g_belt", "body", (0, 13.8, 0))
    g.cube(rb, (-4, 12.6, -2), (8, 2.0, 4), ring(r), inflate=0.78)
    g.cube(rb, (-1.2, 12.3, -3.3), (2.4, 2.6, 1.0), uv(rest=r))


def shoulder_plates(g, tex, c, r):
    m = c.get("armor", (78, 74, 90))
    tex_fill(tex, r, lambda u, v, wd, ht: mul(m, 1.2) if v == 0 else (mul(m, 0.7) if v == ht - 1 else mul(m, 1.0 - 0.04 * (u % 2))))
    for arm, x in (("rightArm", -8.8), ("leftArm", 3.4)):
        b = g.bone(f"g_plate_{arm[0]}", arm, G.BONE_PIVOT[arm])
        g.cube(b, (x, 20.6, -2.7), (5.4, 3.8, 5.4), uv(rest=r))
        g.cube(b, (x + 0.4, 24.4, -2.2), (4.6, 0.8, 4.4), uv(rest=r))


# ===========================================================================
# The Hidden Mist · the Hidden Cloud · the Hidden Stone · the Hidden Rain
# ===========================================================================
PLATE_C = dict(plate=(186, 190, 200), plate_d=(128, 132, 144), mark=(70, 74, 86))
MI = dict(PLATE_C, skin=(234, 210, 192), skin_d=(204, 178, 158), iris=(56, 70, 90), hair=(40, 46, 62), vest=(112, 130, 142), vest_d=(86, 102, 114),
          vest_h=(140, 158, 170), vest_dd=(66, 78, 90), sash=(34, 40, 54), torso=(112, 130, 142), shirt=(44, 54, 72), sleeve=(44, 54, 72),
          pants=(62, 70, 84), cloth=(198, 206, 212), cloth_d=(160, 168, 176), sandal=(40, 46, 58), band=(42, 50, 66), _mark=MIST)
CL = dict(PLATE_C, skin=(146, 98, 70), skin_d=(118, 76, 52), iris=(52, 38, 30), hair=(236, 236, 240), vest=(234, 228, 210), vest_d=(198, 190, 168),
          vest_h=(248, 244, 230), vest_dd=(170, 162, 140), belt_c=(120, 100, 70), torso=(234, 228, 210), shirt=(54, 54, 62), sleeve=(54, 54, 62),
          pants=(54, 54, 62), cloth=(220, 214, 196), cloth_d=(182, 176, 158), sandal=(40, 40, 48), band=(44, 44, 52), _mark=CLOUD,
          mouth=(110, 62, 52), eye=(240, 234, 224))
ST = dict(PLATE_C, skin=(222, 182, 146), skin_d=(190, 148, 114), iris=(56, 40, 30), hair=(36, 32, 36), vest=(130, 94, 64), vest_d=(100, 70, 46),
          vest_h=(158, 118, 84), vest_dd=(80, 56, 36), sash=(150, 50, 44), torso=(130, 94, 64), shirt=(146, 48, 44), sleeve=(146, 48, 44),
          pants=(92, 70, 56), cloth=(206, 190, 162), cloth_d=(170, 154, 126), sandal=(70, 52, 40), band=(118, 42, 38), bare_left=True, _mark=STONE)
RA = dict(PLATE_C, skin=(224, 206, 194), skin_d=(194, 174, 162), iris=(70, 70, 92), hair=(50, 48, 60), vest=(90, 98, 114), vest_d=(66, 72, 86),
          vest_h=(114, 124, 142), vest_dd=(50, 54, 66), torso=(90, 98, 114), shirt=(60, 56, 74), sleeve=(60, 56, 74), pants=(54, 58, 68),
          cloth=(176, 180, 190), cloth_d=(140, 144, 154), sandal=(44, 46, 54), band=(62, 66, 78), metal=(130, 134, 142), mask=(70, 74, 84),
          rope=(112, 98, 128), _mark=RAIN)

# --- shinobi and jōnin --------------------------------------------------------------------------------------------------
MIST_SHINOBI = dict(MI)
MIST_JONIN = dict(MI, hair=(64, 92, 132), mask=(30, 34, 44), vest=(96, 112, 124), vest_d=(72, 86, 98), torso=(96, 112, 124))
CLOUD_SHINOBI = dict(CL, hair=(196, 56, 48), iris=(190, 140, 40), lip=(140, 70, 64), cheek=(160, 102, 76))
CLOUD_JONIN = dict(CL, hair=(232, 232, 236))
STONE_SHINOBI = dict(ST)
STONE_JONIN = dict(ST, hair=(70, 52, 40), beard=(70, 52, 40))
RAIN_SHINOBI = dict(RA)
RAIN_JONIN = dict(RA, vest=(74, 70, 92), vest_d=(54, 52, 70), vest_h=(96, 92, 116), vest_dd=(40, 38, 52), torso=(74, 70, 92))

CLOUD_JONIN_FACE = dict(FACE_M, front=["HHHHHHHH", "HHHHHSHH", "HHHBBBBB", "HHHSSKKS", "HHHSSIES", "HHSssSSS", "SSsQQsSS", "sSSSSSSs"],
                        front1=["HHhHHHH.", "HHHH....", "HHH.....", "HHH.....", "HH......"])
STONE_JONIN_FACE = dict(FACE_M, front=["HhHHhHHh", "HSHhSHHS", "BBBBBBBB", "SKKSSKKS", "SEISSIES", "GSSssSSG", "GGGQQGGG", "GGGGGGGG"],
                        side=["HHHHHHHH", "HHHHHHHS", "BBBBBBBB", "HHHSSSSS", "HHHsSSSS", "HHHsGSSG", "HHGGGGGG", "HGGGGGGG"])


def mist_swordsman_skin():
    c = dict(MI, hair=(34, 34, 40), torso=(120, 126, 122), shirt=(120, 126, 122), sleeve=(120, 126, 122), sleeve_to=2, forearm="glove",
             glove=(92, 108, 102), pants=(98, 110, 104), cloth=(206, 210, 206), cloth_d=(170, 176, 172))
    img = ninja_skin(c, masked(FACE_M, (5, 6, 7), "X"), 52)
    return img


def mist_swordsman_gear():
    c = dict(MI, steel=(184, 190, 198), grip=(70, 54, 40), forearm="glove", cloth=(206, 210, 206), cloth_d=(170, 176, 172))
    return ninja_gear(c, "geometry.aegis.gear_mist_swordsman", MIST, band="tilt", hair=SHORT_SPIKY,
                      extras=(lambda g, t, c_, R: lower_wrap(g, t, c_, R, (214, 214, 206)),
                              lambda g, t, c_, R: back_blade(g, t, c_, R, length=21, width=5.2, angle=-30, hole=True)))


def blademaster_skin():
    c = dict(CL, hair=(244, 236, 214), forearm="wrap")
    face = dict(FACE_M, front=["HhHHhHHh", "HSHhSHHS", "BBBBBBBB", "SKKSSKKS", "SOOSSOOS", "SSSssSSS", "SSsQQsSS", "sGGGGGGs"])
    return ninja_skin(c, face, 53)


def blademaster_gear():
    c = dict(CL, hair=(244, 236, 214), scarf=(240, 236, 228), scarf_d=(200, 196, 188), grip=(170, 44, 40))
    return ninja_gear(c, "geometry.aegis.gear_cloud_blademaster", CLOUD, vest=kumo_vest, hair=SHORT_SPIKY,
                      extras=(lambda g, t, c_, R: sunglasses(g, t, c_, R["X1"]), lambda g, t, c_, R: sword_fan(g, t, c_, R["X2"]),
                              lambda g, t, c_, R: scarf_ring(g, t, R["SCARF"], c_["scarf"], c_["scarf_d"], tails=((0.4, 5.4),))))


def stone_smith_skin():
    c = dict(ST, hair=(40, 32, 30), top=(214, 172, 136), skin=(206, 160, 122), skin_d=(176, 132, 98), beard=(40, 32, 30), torso=(146, 48, 44))
    face = dict(FACE_M, front=["SSSSSSSS", "SSSSSSSS", "SSSSSSSS", "SKKSSKKS", "SEISSIES", "GSSssSSG", "GGGQQGGG", "GGGGGGGG"],
                side=["SSSSSSSS", "SSSSSSSS", "SSSSSSSS", "HHSSSSSS", "HHSsSSSS", "HHSsGSSG", "HHGGGGGG", "HGGGGGGG"],
                back=["SSSSSSSS", "SSSSSSSS", "SSSSSSSS", "HHHHHHHH", "HHHHHHHH", "HHHHHHHH", "HHHHHHHH", "sHHHHHHs"],
                front1=None, side1=None, back1=None)
    return ninja_skin(c, face, 54)


def stone_smith_gear():
    c = dict(ST, leather=(110, 74, 46))
    return ninja_gear(c, "geometry.aegis.gear_stone_smith", STONE, band=None,
                      extras=(lambda g, t, c_, R: goggles(g, t, c_, R["X1"]), lambda g, t, c_, R: apron(g, t, c_, R["X3"]),
                              lambda g, t, c_, R: hammer(g, t, c_, R["X2"])))


def umbrella_master_skin():
    return ninja_skin(dict(RA, hair=(64, 54, 78)), masked(FACE_M, (5, 6, 7), "D"), 55)


def umbrella_master_gear():
    c = dict(RA, umbrella=(146, 52, 80))
    return ninja_gear(c, "geometry.aegis.gear_rain_umbrella", RAIN, vest=ame_cloak, hair=SHORT_SPIKY,
                      extras=(respirator, lambda g, t, c_, R: umbrella(g, t, c_, R["X2"])))


# --- the leaders -------------------------------------------------------------------------------------------------------
MZ = dict(skin=(240, 212, 194), skin_d=(210, 180, 160), hair=(150, 64, 40), hair_h=(186, 90, 60), eye=(246, 240, 232), iris=(70, 140, 90),
          lip=(204, 96, 100), mouth=(204, 96, 100), cheek=(240, 186, 172), brow=(120, 50, 32), robe=(242, 240, 234), robe_d=(208, 206, 200),
          trim=(40, 100, 210), trim_d=(28, 72, 160), under=(55, 45, 110), under_d=(35, 28, 70), sandal=(60, 50, 90))
MEI = dict(front=["HhHHhHHh", "HHHHHSHH", "HHHSSSSS", "HHHSSKKS", "HHHSSIES", "HHSssSCS", "SSSLLSSS", "sSSSSSSs"],
           side=["HHHHHHHH", "HHHHHHHH", "HHHHHSSS", "HHHHSSSS", "HHHHsSSS", "HHHHSSSS", "HHHHSSSS", "HHHHSSSS"],
           back=["HHhHHhHH"] + ["HHHHHHHH"] * 7, front1=["HhHHHHhH", "HH.H...H", "HH......", "HH......", "HH......"],
           side1=["HhHHhHHh", "HHHHHHHH", "HHHHH...", "HHHH....", "HHHH....", "HHH.....", "HHH.....", "HH......"],
           back1=["HhHHhHHh"] + ["HHHHHHHH"] * 7)
RK = dict(skin=(128, 84, 58), skin_d=(102, 64, 42), hair=(242, 242, 238), hair_h=(255, 255, 255), eye=(238, 232, 222), iris=(54, 40, 30),
          brow=(242, 242, 238), beard=(242, 242, 238), mouth=(90, 50, 40), robe=(242, 240, 234), robe_d=(208, 206, 200), trim=(240, 200, 40),
          trim_d=(190, 150, 20), under=(35, 35, 40), under_d=(20, 20, 22), sandal=(40, 40, 48), ink=(242, 240, 234))
RAI = dict(front=["HHHHHHHH", "HhHHHHhH", "SSSSSSSS", "SKKSSKKS", "SEISSIES", "SSSssSSS", "SGGQQGGS", "sSSGGSSs"],
           side=["HHHHHHHH", "HHHHHHHH", "HHHHSSSS", "HHHSSSSS", "HHHsSSSS", "HHHsSSSS", "HHSSSSGS", "HSSSSSSS"],
           back=["HHhHHhHH", "HHHHHHHH", "HhHHHHhH", "HHHHHHHH", "HHHHHHHH", "HHHHHHHH", "sHHHHHHs", "ssssssss"], front1=None, side1=None)
TK = dict(skin=(232, 198, 170), skin_d=(204, 166, 138), hair=(236, 236, 232), hair_h=(250, 250, 248), eye=(240, 234, 224), iris=(60, 46, 36),
          brow=(240, 240, 236), beard=(236, 236, 232), nose=(220, 120, 108), mouth=(150, 96, 88), robe=(242, 240, 234), robe_d=(208, 206, 200),
          trim=(125, 90, 50), trim_d=(92, 64, 34), under=(80, 100, 55), under_d=(55, 70, 38), sandal=(80, 62, 44))
ONOKI = dict(front=["SSSSSSSS", "HSSSSSSH", "KKKSSKKK", "SKISSIKS", "SSSNNSSS", "GGGNNGGG", "GGGQQGGG", "GGGGGGGG"],
             side=["SSSSSSSS", "HHSSSSSS", "HHHSSSSS", "HHHSSSSS", "HHHsSSSS", "HHHGGGGG", "HHGGGGGG", "HGGGGGGG"],
             back=["SSSSSSSS", "SSSSSSSS", "HHHHHHHH", "HhHHHHhH", "HHHHHHHH", "HHHHHHHH", "HHHHHHHH", "sHHHHHHs"],
             front1=[".......", ".......", "KKK..KKK", "........", "........", "GG....GG", "GG....GG", ".GGGGGG."], side1=None)


def mizukage_gear():
    def extra(g, tex):
        r = (48, 0, 8, 16)
        tex_fill(tex, r, lambda u, v, wd, ht: mul(MZ["hair"], 1.16 - 0.3 * v / ht - (0.06 if u % 3 == 0 else 0)))
        lh = g.bone("g_longhair", "head", (0, 29, 3.8))
        g.cube(lh, (-4.4, 15.6, 3.7), (8.8, 14.2, 1.0), uv(rest=r))                                   # down to the waist
        for x in (-4.75, 3.85):
            g.cube(lh, (x, 23.4, -3.6), (0.9, 6.0, 7.4), uv(rest=r))
        g.cube(lh, (-4.3, 25.8, -4.75), (3.4, 4.4, 0.7), uv(rest=r))                                 # over the right eye
    return kage_gear(MZ, WATER, "geometry.aegis.gear_mizukage", extra)


def raikage_gear():
    return kage_gear(RK, THUNDER, "geometry.aegis.gear_raikage", lambda g, tex: bracelets(g, tex, RK, (48, 0, 8, 3)))


def tsuchikage_gear():
    return kage_gear(TK, EARTH, "geometry.aegis.gear_tsuchikage", lambda g, tex: big_nose(g, tex, TK, (48, 0, 4, 4)))


RL = dict(RA, hair=(30, 28, 34), vest=(64, 58, 78), vest_d=(48, 44, 60), vest_h=(86, 80, 102), vest_dd=(36, 32, 46), torso=(64, 58, 78),
          shirt=(40, 38, 50), sleeve=(40, 38, 50), pants=(40, 38, 50), armor=(92, 88, 104), rope=(150, 138, 120))


def rain_leader_skin():
    face = masked(dict(FACE_M, back=["HHhHHhHH", "HHHHHHHH", "BBBBBBBB", "HhHHHHhH", "HHHHHHHH", "HHhHHhHH", "HHHHHHHH", "HHHHHHHH"]), (5, 6, 7), "D")
    return ninja_skin(dict(RL, forearm="glove", glove=(40, 38, 50)), face, 43)


def rain_leader_gear():
    c = dict(RL, forearm="glove")
    return ninja_gear(c, "geometry.aegis.gear_rain_leader", RAIN, vest=ame_cloak,
                      extras=(respirator, lambda g, t, c_, R: long_hair(g, t, c_, R, length=11.0),
                              lambda g, t, c_, R: shoulder_plates(g, t, c_, R["X1"]), lambda g, t, c_, R: rope_belt(g, t, c_, R["X3"])))


def rain_jonin_gear():
    c = dict(RAIN_JONIN)

    def hooded(g, t, c_, R):
        hd = hood(g, t, c_, R, c_["vest"])
        plate_on(g, t, c_, R["PLATE"], hd)
    return ninja_gear(c, "geometry.aegis.gear_rain_jonin", RAIN, vest=ame_cloak, band=None, extras=(hooded, respirator))


# --- genin ---------------------------------------------------------------------------------------------------------------
GENIN_BASE = dict(PLATE_C, eye=(244, 238, 228), brow=(70, 50, 36), mouth=(160, 100, 86), cloth=(212, 196, 160), cloth_d=(176, 160, 124),
                  sandal=(80, 66, 52), bag=(120, 86, 56), lip=(196, 112, 112), cheek=(232, 170, 150))
VG = {
    "mist_genin_a": dict(GENIN_BASE, skin=(234, 210, 192), skin_d=(204, 178, 158), hair=(40, 46, 62), iris=(56, 70, 90), top=(120, 140, 160),
                         top_d=(92, 110, 128), sash=(44, 54, 72), sash_d=(32, 40, 54), pants=(62, 70, 84), band=(42, 50, 66), _mark=MIST),
    "mist_genin_b": dict(GENIN_BASE, skin=(238, 214, 198), skin_d=(208, 182, 166), hair=(70, 46, 60), iris=(60, 90, 110), top=(172, 202, 222),
                         top_d=(136, 166, 186), sash=(90, 110, 130), sash_d=(68, 86, 104), pants=(70, 80, 96), band=(42, 50, 66),
                         scarf=(60, 150, 160), scarf_d=(40, 112, 122), _mark=MIST),
    "cloud_genin_a": dict(GENIN_BASE, skin=(146, 98, 70), skin_d=(118, 76, 52), hair=(236, 236, 240), iris=(52, 38, 30), top=(222, 216, 198),
                          top_d=(186, 180, 162), sash=(60, 60, 70), sash_d=(44, 44, 52), pants=(54, 54, 62), band=(44, 44, 52),
                          mouth=(110, 62, 52), brow=(210, 210, 214), _mark=CLOUD),
    "cloud_genin_b": dict(GENIN_BASE, skin=(240, 212, 184), skin_d=(210, 180, 152), hair=(240, 212, 120), iris=(60, 110, 160), top=(204, 204, 214),
                          top_d=(166, 166, 178), sash=(70, 70, 82), sash_d=(52, 52, 62), pants=(60, 60, 70), band=(44, 44, 52),
                          scarf=(240, 200, 60), scarf_d=(196, 158, 40), brow=(200, 170, 90), _mark=CLOUD),
    "stone_genin_a": dict(GENIN_BASE, skin=(222, 182, 146), skin_d=(190, 148, 114), hair=(92, 66, 46), iris=(56, 40, 30), top=(146, 48, 44),
                          top_d=(112, 34, 32), sash=(92, 70, 56), sash_d=(70, 52, 40), pants=(92, 70, 56), band=(118, 42, 38), _mark=STONE),
    "stone_genin_b": dict(GENIN_BASE, skin=(228, 190, 158), skin_d=(198, 156, 126), hair=(36, 32, 36), iris=(70, 50, 40), top=(130, 94, 64),
                          top_d=(100, 70, 46), sash=(150, 50, 44), sash_d=(112, 36, 32), pants=(80, 62, 50), band=(118, 42, 38),
                          scarf=(150, 50, 44), scarf_d=(112, 36, 32), _mark=STONE),
    "rain_genin_a": dict(GENIN_BASE, skin=(224, 206, 194), skin_d=(194, 174, 162), hair=(50, 48, 60), iris=(70, 70, 92), top=(110, 118, 134),
                         top_d=(84, 90, 104), sash=(60, 56, 74), sash_d=(44, 40, 56), pants=(54, 58, 68), band=(62, 66, 78), _mark=RAIN),
    "rain_genin_b": dict(GENIN_BASE, skin=(230, 212, 202), skin_d=(200, 180, 170), hair=(92, 62, 112), iris=(90, 70, 120), top=(150, 132, 172),
                         top_d=(118, 102, 138), sash=(70, 74, 90), sash_d=(52, 56, 70), pants=(64, 62, 78), band=(62, 66, 78),
                         scarf=(80, 84, 100), scarf_d=(60, 64, 78), _mark=RAIN),
}

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
    # v1.50: the other villages (skin numbers 40-63, in this order — tools/gen_npcs.py SKINS)
    "mizukage": (lambda: kage_skin(MZ, MEI, 40), mizukage_gear),
    "raikage": (lambda: kage_skin(RK, RAI, 41, sleeveless=True), raikage_gear),
    "tsuchikage": (lambda: kage_skin(TK, ONOKI, 42), tsuchikage_gear),
    "rain_leader": (rain_leader_skin, rain_leader_gear),
    "mist_shinobi": (lambda: ninja_skin(MIST_SHINOBI, FACE_M, 44),
                     lambda: ninja_gear(MIST_SHINOBI, "geometry.aegis.gear_mist_shinobi", MIST, vest=kiri_vest, hair=SPIKY)),
    "cloud_shinobi": (lambda: ninja_skin(CLOUD_SHINOBI, FACE_F, 45),
                      lambda: ninja_gear(CLOUD_SHINOBI, "geometry.aegis.gear_cloud_shinobi", CLOUD, vest=kumo_vest)),
    "stone_shinobi": (lambda: ninja_skin(STONE_SHINOBI, FACE_F, 46),
                      lambda: ninja_gear(STONE_SHINOBI, "geometry.aegis.gear_stone_shinobi", STONE, vest=iwa_vest)),
    "rain_shinobi": (lambda: ninja_skin(RAIN_SHINOBI, masked(FACE_M), 47),
                     lambda: ninja_gear(RAIN_SHINOBI, "geometry.aegis.gear_rain_shinobi", RAIN, vest=ame_cloak, hair=SHORT_SPIKY, extras=(respirator,))),
    "mist_jonin": (lambda: ninja_skin(MIST_JONIN, masked(FACE_M), 48),
                   lambda: ninja_gear(MIST_JONIN, "geometry.aegis.gear_mist_jonin", MIST, vest=kiri_vest, band="bandana",
                                      extras=(lambda g, t, c_, R: back_blade(g, t, c_, R, length=10, width=1.5, angle=-40, hole=False),))),
    "cloud_jonin": (lambda: ninja_skin(CLOUD_JONIN, CLOUD_JONIN_FACE, 49),
                    lambda: ninja_gear(CLOUD_JONIN, "geometry.aegis.gear_cloud_jonin", CLOUD, vest=kumo_vest, hair=SPIKY,
                                       extras=(lambda g, t, c_, R: back_blade(g, t, c_, R, length=17, width=3.0, angle=-36, hole=False),))),
    "stone_jonin": (lambda: ninja_skin(STONE_JONIN, STONE_JONIN_FACE, 50),
                    lambda: ninja_gear(STONE_JONIN, "geometry.aegis.gear_stone_jonin", STONE, vest=iwa_vest, hair=SHORT_SPIKY)),
    "rain_jonin": (lambda: ninja_skin(RAIN_JONIN, masked(FACE_M), 51), rain_jonin_gear),
    "mist_swordsman": (mist_swordsman_skin, mist_swordsman_gear),
    "cloud_blademaster": (blademaster_skin, blademaster_gear),
    "stone_smith": (stone_smith_skin, stone_smith_gear),
    "rain_umbrella": (umbrella_master_skin, umbrella_master_gear),
    **{n: ((lambda n=n, i=i: genin_skin(VG[n], 56 + i, girl=n.endswith("_b"))),
           (lambda n=n: genin_gear(VG[n], f"geometry.aegis.gear_{n}", VG[n]["_mark"], girl=n.endswith("_b"))))
       for i, n in enumerate(VG)},
}

FLUTTER = {
    "g_longhair": {"rotation": ["math.sin(q.life_time * 120) * 2 + q.modified_move_speed * 10", 0, 0]},
    "g_neckcloth": {"rotation": ["math.sin(q.life_time * 160) * 4 + q.modified_move_speed * 30", 0, 0]},
    "g_veil": {"rotation": ["math.sin(q.life_time * 150) * 3 - q.modified_move_speed * 6", 0, "math.sin(q.life_time * 110) * 2"]},
    "g_hatcloth": {"rotation": ["math.sin(q.life_time * 140) * 3 + q.modified_move_speed * 22", 0, 0]},
    "g_ponytail": {"rotation": ["math.sin(q.life_time * 190) * 5 + q.modified_move_speed * 26", 0, "math.sin(q.life_time * 140) * 5"]},
    "g_bow_t0": {"rotation": ["math.sin(q.life_time * 230) * 6 + q.modified_move_speed * 34", 0, "math.sin(q.life_time * 170) * 5"]},
    "g_bow_t1": {"rotation": ["math.sin(q.life_time * 210 + 50) * 6 + q.modified_move_speed * 30", 0, "math.sin(q.life_time * 190 + 30) * 5"]},
}
