#!/usr/bin/env python3
"""Generates wearable armor/clothing: 3D attachable models (bones follow the player), palette
textures, 32x32 icons rendered from the models and items (no recipes: armour is bought, not crafted).
Run from the shinobi-addon folder:  python3 tools/gen_armor.py
"""
import json
import math
from pathlib import Path
from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parent.parent
BP, RP = ROOT / "behavior_pack", ROOT / "resource_pack"


def w(path, obj):
    path.parent.mkdir(parents=True, exist_ok=True)
    with open(path, "w") as f:
        json.dump(obj, f, indent=2, ensure_ascii=False)
        f.write("\n")


SW = ["base", "dark", "light", "accent", "accent2", "metal", "red", "white", "gold", "black"]
PIVOTS = {"head": [0, 24, 0], "body": [0, 24, 0], "rightArm": [-5, 22, 0], "leftArm": [5, 22, 0], "rightLeg": [-1.9, 12, 0], "leftLeg": [1.9, 12, 0]}


def c(o, s, sw, inflate=0, rot=None, pivot=None):
    i = SW.index(sw)
    u, v = (i % 8) * 8, (i // 8) * 8
    face = {"uv": [u + 1, v + 1], "uv_size": [6, 6]}
    d = {"origin": o, "size": s, "uv": {f: dict(face) for f in ("north", "south", "east", "west", "up", "down")}, "_sw": sw}
    if inflate:
        d["inflate"] = inflate
    if rot:
        d["rotation"], d["pivot"] = rot, pivot
    return d


BODY = lambda inf, sw: c([-4, 12, -2], [8, 12, 4], sw, inf)
RARM = lambda inf, sw, y0=12, h=12: c([-8, y0, -2], [4, h, 4], sw, inf)
LARM = lambda inf, sw, y0=12, h=12: c([4, y0, -2], [4, h, 4], sw, inf)
RLEG = lambda inf, sw, y0=0, h=12: c([-3.9, y0, -2], [4, h, 4], sw, inf)
LLEG = lambda inf, sw, y0=0, h=12: c([-0.1, y0, -2], [4, h, 4], sw, inf)


def cloud(x, y, z, front=True):
    zz = z - 0.05 if front else z + 0.05
    return [c([x - 0.3, y - 0.3, zz], [3.6, 2.6, 0.2], "white"), c([x, y, zz - (0.1 if front else -0.1)], [3, 2, 0.2], "red")]


def hat_layers(top_y, base, widths, sw_main, ring=None):
    cubes = []
    for i, wdt in enumerate(widths):
        sw = ring if ring and i == 1 else sw_main
        cubes.append(c([-wdt / 2, top_y + i, -wdt / 2], [wdt, 1, wdt], sw))
    return cubes


ARMOR = {
    # ---- Leaf shinobi ----
    "flak_jacket": dict(name="Leaf Flak Jacket", slot="chest", prot=6, dur=360, colors=dict(base=(85, 115, 60), dark=(55, 75, 40), light=(110, 145, 80), red=(200, 50, 40)),
        bones={"body": [BODY(0.6, "base"), c([-4.5, 22.3, -2.6], [9, 2, 5.2], "dark", 0.3), c([-3.6, 15, -3.05], [3, 4, 1], "light"),
                        c([0.6, 15, -3.05], [3, 4, 1], "light"), c([-0.3, 12, -2.9], [0.6, 10.5, 0.3], "dark"), c([-3.6, 19.5, -3.05], [3, 2, 1], "light")],
               "rightArm": [c([-8.6, 20.6, -2.6], [5.2, 2, 5.2], "base", 0.2)], "leftArm": [c([3.4, 20.6, -2.6], [5.2, 2, 5.2], "base", 0.2), c([8.7, 17.5, -1], [0.3, 2, 2], "red")]},
        recipe=(["L L", "GLG", "GGG"], {"L": "minecraft:leather", "G": "minecraft:green_wool"})),
    "shinobi_pants": dict(name="Shinobi Pants", slot="legs", prot=5, dur=330, colors=dict(base=(40, 50, 90), dark=(25, 30, 55), accent=(90, 60, 40), metal=(180, 185, 195), white=(230, 230, 225)),
        bones={"body": [c([-4, 11.4, -2], [8, 1.4, 4], "dark", 0.55)],
               "rightLeg": [RLEG(0.45, "base", 2, 10), c([-5.3, 6, -1.5], [1.3, 4, 3], "accent"), c([-5.5, 9.5, -0.4], [0.7, 2.5, 0.7], "metal"), RLEG(0.5, "white", 1, 2)],
               "leftLeg": [LLEG(0.45, "base", 2, 10), LLEG(0.5, "white", 1, 2)]},
        recipe=(["BBB", "B B", "B B"], {"B": "minecraft:blue_wool"})),
    "ninja_sandals": dict(name="Ninja Sandals", slot="feet", prot=2, dur=300, colors=dict(base=(40, 50, 90), dark=(30, 25, 25), white=(230, 230, 225)),
        bones={"rightLeg": [c([-4.1, -0.05, -2.9], [4.4, 0.8, 5.2], "dark"), RLEG(0.5, "base", 0.8, 1.5), RLEG(0.55, "white", 2.3, 1)],
               "leftLeg": [c([-0.3, -0.05, -2.9], [4.4, 0.8, 5.2], "dark"), LLEG(0.5, "base", 0.8, 1.5), LLEG(0.55, "white", 2.3, 1)]},
        recipe=(["S S", "B B"], {"S": "minecraft:string", "B": "minecraft:blue_wool"})),
    # ---- Anbu ----
    "anbu_mask": dict(name="Anbu Mask", slot="head", prot=2, dur=280, colors=dict(white=(242, 240, 235), red=(200, 30, 30), black=(20, 20, 25), dark=(45, 45, 50)),
        bones={"head": [c([-3.6, 24.4, -4.75], [7.2, 7.2, 0.6], "white"), c([-0.6, 24.8, -5.3], [1.2, 3.2, 0.6], "white"),
                        c([-3, 28.8, -4.95], [1, 2.6, 0.3], "red"), c([2, 28.8, -4.95], [1, 2.6, 0.3], "red"),
                        c([-2.6, 27.4, -4.98], [1.8, 1, 0.3], "black"), c([0.8, 27.4, -4.98], [1.8, 1, 0.3], "black"),
                        c([-4, 28, -4], [8, 1, 8], "dark", 0.55)]},
        recipe=(["BRB", "BBB"], {"B": "minecraft:bone", "R": "minecraft:red_dye"})),
    "anbu_armor": dict(name="Anbu Armor", slot="chest", prot=6, dur=400, colors=dict(base=(30, 30, 35), metal=(200, 200, 205), dark=(130, 130, 135), red=(150, 30, 30), black=(15, 15, 18)),
        bones={"body": [BODY(0.5, "base"), c([-4, 15, -2.65], [8, 8.5, 0.8], "metal"), c([-4, 15, 1.85], [8, 8.5, 0.8], "metal"),
                        c([-0.5, 14, 2.5], [1, 12, 1], "dark", 0, [0, 0, 35], [0, 20, 3]), c([-0.6, 23, 2.4], [1.2, 3.5, 1.2], "red", 0, [0, 0, 35], [0, 20, 3])],
               "rightArm": [RARM(0.55, "metal", 12, 5), RARM(0.4, "base", 17, 7)], "leftArm": [LARM(0.55, "metal", 12, 5), LARM(0.4, "base", 17, 7)]},
        recipe=(["I I", "IBI", "III"], {"I": "minecraft:iron_ingot", "B": "minecraft:black_wool"})),
    # ---- Akatsuki (built below by akatsuki_set()) ----
    # ---- Samurai (Land of Iron) ----
    "samurai_helmet": dict(name="Samurai Kabuto", slot="head", prot=3, dur=420, colors=dict(base=(150, 30, 30), dark=(80, 15, 15), gold=(235, 190, 60), black=(25, 20, 20)),
        bones={"head": [c([-4.6, 28, -4.6], [9.2, 4.5, 9.2], "base", 0.3), c([-5.6, 24.5, -2], [11.2, 4, 7.6], "dark", 0.1),
                        c([-4.8, 28, -5.3], [9.6, 1, 1], "gold"), c([-0.6, 32, -1], [1.2, 2, 1.2], "black"),
                        c([-1.5, 30, -5.8], [1, 7, 0.8], "gold", 0, [0, 0, 28], [-1, 30, -5.4]), c([0.5, 30, -5.8], [1, 7, 0.8], "gold", 0, [0, 0, -28], [1, 30, -5.4])]},
        recipe=(["IGI", "I I"], {"I": "minecraft:iron_ingot", "G": "minecraft:gold_ingot"})),
    "samurai_armor": dict(name="Samurai Dō", slot="chest", prot=8, dur=520, colors=dict(base=(150, 30, 30), dark=(80, 15, 15), gold=(235, 190, 60), black=(25, 20, 20)),
        bones={"body": [BODY(0.7, "base")] + [c([-4.6, y, -2.95], [9.2, 0.5, 0.3], "gold") for y in (14, 16.5, 19)] + [c([-4.6, 21.5, -2.95], [9.2, 2.5, 0.3], "black")],
               "rightArm": [c([-9.8, 16, -2.6], [2.6, 6.5, 5.2], "base", 0.2), c([-9.9, 16, -2.7], [2.8, 0.6, 5.4], "gold"), RARM(0.4, "black", 12, 4)],
               "leftArm": [c([7.2, 16, -2.6], [2.6, 6.5, 5.2], "base", 0.2), c([7.1, 16, -2.7], [2.8, 0.6, 5.4], "gold"), LARM(0.4, "black", 12, 4)]},
        recipe=(["I I", "IRI", "III"], {"I": "minecraft:iron_ingot", "R": "minecraft:red_wool"})),
    "samurai_leggings": dict(name="Samurai Haidate", slot="legs", prot=6, dur=480, colors=dict(base=(150, 30, 30), dark=(40, 35, 35), gold=(235, 190, 60)),
        bones={"body": [c([-4.6, 6.5, -2.9], [4.2, 5.5, 0.8], "base"), c([0.4, 6.5, -2.9], [4.2, 5.5, 0.8], "base"), c([-4.6, 6.5, 2.1], [9.2, 5.5, 0.8], "base"),
                        c([-4.6, 11.4, -2.9], [9.2, 0.6, 5.8], "gold")],
               "rightLeg": [RLEG(0.45, "dark", 2, 10)], "leftLeg": [LLEG(0.45, "dark", 2, 10)]},
        recipe=(["III", "R R", "I I"], {"I": "minecraft:iron_ingot", "R": "minecraft:red_wool"})),
    "samurai_boots": dict(name="Samurai Suneate", slot="feet", prot=3, dur=420, colors=dict(base=(150, 30, 30), dark=(30, 25, 25), gold=(235, 190, 60)),
        bones={"rightLeg": [RLEG(0.55, "base", 0, 6), RLEG(0.6, "gold", 5.5, 0.5), c([-4.1, -0.05, -2.9], [4.4, 0.8, 5.2], "dark")],
               "leftLeg": [LLEG(0.55, "base", 0, 6), LLEG(0.6, "gold", 5.5, 0.5), c([-0.3, -0.05, -2.9], [4.4, 0.8, 5.2], "dark")]},
        recipe=(["R R", "I I"], {"I": "minecraft:iron_ingot", "R": "minecraft:red_wool"})),
    # Kage sets (Hokage, Kazekage, Mizukage, Raikage, Tsuchikage) are added below by kage_set().
}

def red_cloud(x, y, z, front=True, scale=1.0, axis="z"):
    """The Akatsuki cloud: a red, lobed cloud with a white outline, lying flat on a surface of the cloak.
    axis "z" = on the front/back of the body, "x" = on the outside of a sleeve."""
    k = scale
    lobes = [(0, 0, 4.2, 1.5), (0.5, 1.2, 1.7, 1.0), (2.0, 1.2, 1.6, 1.4), (3.2, 0.9, 1.0, 0.9), (-0.5, 0.2, 0.8, 0.9), (1.0, -0.5, 2.4, 0.7)]
    out = []
    for (lx, ly, lw, lh) in lobes:
        for sw, grow, lift in (("white", 0.3, 0.0), ("red", 0.0, 0.12)):
            if axis == "z":
                zz = z - lift - 0.1 if front else z + lift
                out.append(c([x + (lx - grow) * k, y + (ly - grow) * k, zz], [(lw + 2 * grow) * k, (lh + 2 * grow) * k, 0.1], sw))
            else:
                xx = x - lift - 0.1 if front else x + lift
                out.append(c([xx, y + (ly - grow) * k, z + (lx - grow) * k], [0.1, (lh + 2 * grow) * k, (lw + 2 * grow) * k], sw))
    return out


def akatsuki_set():
    """Akatsuki cloak and straw hat (v2 models).
    Cloak: a long black coat to the shins, a tall standing collar that hides the mouth (red lining showing inside),
    wide sleeves that swallow the hands, a red-lined hem, a seam down the front, and red clouds on the chest, back,
    sleeves and skirt.  Hat: a round conical kasa in woven rings, a curtain of white paper strips hanging from the
    brim (open at the front), and a small bell on a red cord."""
    body = [BODY(0.85, "base"),
            c([-4.95, 10.4, -2.95], [9.9, 2.2, 5.9], "base"),                                  # the coat flares at the waist
            c([-0.2, 11, -3.02], [0.4, 10.6, 0.15], "dark"),                                   # front seam
            # standing collar: back, sides, and two front flaps with a gap for the mouth
            c([-5.2, 22.2, 1.9], [10.4, 7.6, 1.3], "base"), c([-4.6, 22.6, 1.75], [9.2, 7.0, 0.2], "red"),
            c([-5.2, 22.2, -3.0], [1.3, 6.8, 5.0], "base"), c([-3.95, 22.6, -2.6], [0.2, 6.2, 4.4], "red"),
            c([3.9, 22.2, -3.0], [1.3, 6.8, 5.0], "base"), c([3.75, 22.6, -2.6], [0.2, 6.2, 4.4], "red"),
            c([-5.2, 22.2, -4.2], [4.2, 5.6, 1.3], "base"), c([1.0, 22.2, -4.2], [4.2, 5.6, 1.3], "base"),
            c([-1.0, 22.2, -4.0], [2.0, 2.6, 0.9], "base"),
            c([-5.2, 21.6, -4.25], [10.4, 0.8, 7.5], "dark")]                                  # collar band
    body += red_cloud(-3.9, 17.6, -2.95, True, 0.8) + red_cloud(0.2, 13.4, -2.95, True, 0.8)
    body += red_cloud(-2.6, 15.6, 2.95, False, 1.15)
    sleeve = lambda sx: [c([-8.75 if sx < 0 else 3.75, 10.2, -2.75], [5, 12.6, 5.5], "base", 0.1),              # long, wide sleeve
                         c([-9.05 if sx < 0 else 3.45, 9.6, -3.05], [5.6, 2.4, 6.1], "base"),                  # flared cuff
                         c([-8.6 if sx < 0 else 3.9, 9.5, -2.6], [4.7, 0.25, 5.2], "red")]                     # lining inside the cuff
    rarm = sleeve(-1) + red_cloud(-8.9, 15.5, -1.7, True, 0.7, axis="x")
    larm = sleeve(1) + red_cloud(8.9, 13.5, -1.7, False, 0.7, axis="x")
    skirt = lambda sx: [(RLEG if sx < 0 else LLEG)(0.95, "base", 3, 9),
                        c([-4.95 if sx < 0 else 0.0, 2.2, -3.1], [4.95, 2.4, 6.2], "base"),                     # hem flares out
                        c([-4.8 if sx < 0 else 0.15, 2.05, -2.95], [4.5, 0.25, 5.9], "red")]                   # red lining at the hem
    rleg = skirt(-1) + red_cloud(-4.4, 5.6, -3.05, True, 0.75)
    lleg = skirt(1) + red_cloud(0.9, 7.6, 3.05, False, 0.75)

    hat = []
    y = 30.8
    for i, wd in enumerate([20.5, 19, 17, 14.8, 12.4, 9.8, 7.2, 4.6, 2.2]):                   # woven rings: each a square plus one turned 45°
        sw = "dark" if i in (0, 3, 6) else "base"
        for turn in (0, 22.5, 45, 67.5):                                                       # four turned squares make it round
            k = 0.94 if turn else 0.92
            hat.append(c([-wd * k / 2, y + i * 0.85, -wd * k / 2], [wd * k, 0.9, wd * k], sw, 0, [0, turn, 0] if turn else None, [0, y + i * 0.85, 0]))
    hat.append(c([-0.6, y + 7.6, -0.6], [1.2, 1.3, 1.2], "dark"))                              # the knot at the tip
    hat.append(c([-4.2, 28.3, -4.2], [8.4, 2.6, 8.4], "dark", 0.25))                           # inner band on the head
    n = 22
    for k in range(n):                                                                         # paper strips all round, open at the front
        ang = k / n * 360
        if ang < 38 or ang > 322:
            continue
        rad = math.radians(ang)
        x, z = math.sin(rad) * 9.7, -math.cos(rad) * 9.7
        ln = 7.2 + (k % 3) * 0.7
        hat.append(c([x - 0.55, y - ln + 0.2, z - 0.12], [1.1, ln, 0.24], "white", 0, [0, -ang, 0], [x, y, z]))
    hat += [c([-9.2, y - 2.2, -6.2], [0.2, 2.4, 0.2], "red"), c([-9.7, y - 3.6, -6.7], [1.3, 1.4, 1.3], "gold"), c([-9.35, y - 3.9, -6.35], [0.6, 0.4, 0.6], "black")]
    return {
        "akatsuki_cloak": dict(name="Akatsuki Cloak", slot="chest", prot=6, dur=420,
                               colors=dict(base=(20, 20, 26), red=(196, 22, 28), white=(238, 238, 238), dark=(44, 44, 54)),
                               bones={"body": body, "rightArm": rarm, "leftArm": larm, "rightLeg": rleg, "leftLeg": lleg},
                               recipe=(["B B", "BRB", "BBB"], {"B": "minecraft:black_wool", "R": "minecraft:red_dye"})),
        "akatsuki_hat": dict(name="Akatsuki Straw Hat", slot="head", prot=1, dur=200,
                             colors=dict(base=(212, 184, 116), dark=(160, 130, 72), white=(244, 244, 240), gold=(232, 192, 62), red=(196, 22, 28), black=(30, 26, 22)),
                             bones={"head": hat},
                             recipe=(["WWW", "WSW"], {"W": "minecraft:wheat", "S": "minecraft:string"})),
    }


def kage_set(vid, title, trim, trim2, under, under_dark):
    """Hat + robe + pants + sandals for one Kage. White robes with the village colour, like the anime."""
    W = (245, 245, 245)
    hem = lambda x0, i: c([x0 + i * 1.1, 2.6, -3], [1.1, 1.2 + (i % 2) * 1.2, 0.3], "red" if i % 2 else "accent")
    return {
        f"{vid}_hat": dict(name=f"{title} Hat", slot="head", prot=4, dur=900, colors=dict(base=W, red=trim, gold=(235, 190, 60), white=W),
            bones={"head": [c([-9, 31.5, -9], [18, 1, 18], "base"), c([-7.5, 32.5, -7.5], [15, 1, 15], "red"),
                            c([-6, 33.5, -6], [12, 1, 12], "base"), c([-4.5, 34.5, -4.5], [9, 1, 9], "base"),
                            c([-3, 35.5, -3], [6, 1, 6], "red"), c([-1.5, 36.5, -1.5], [3, 1, 3], "base"),
                            c([-0.4, 37.5, -0.4], [0.8, 0.8, 0.8], "gold"),
                            # village crest on the front
                            c([-2.2, 32.6, -7.9], [4.4, 3.2, 0.5], "red"), c([-0.7, 33.2, -8.2], [1.4, 2, 0.4], "white"),
                            # cloth hanging down the back and sides
                            c([-4.6, 24.5, 4.4], [9.2, 7, 0.3], "base"), c([-4.6, 24.5, 4.45], [9.2, 0.8, 0.3], "red"),
                            c([-4.9, 25.5, -3], [0.3, 6, 7.4], "base"), c([4.6, 25.5, -3], [0.3, 6, 7.4], "base")]},
            recipe=None),
        f"{vid}_robe": dict(name=f"{title} Robe", slot="chest", prot=9, dur=1100, colors=dict(base=W, red=trim, accent=trim2, dark=under),
            bones={"body": [BODY(0.8, "base"), c([-2.2, 14.5, 2.95], [4.4, 7, 0.3], "red"), c([-0.8, 15.2, 3.05], [1.6, 5.6, 0.3], "base"),
                            c([-4.6, 21.6, -2.95], [9.2, 0.6, 0.3], "red"), c([-0.4, 12, -2.95], [0.8, 9.6, 0.3], "red")],
                   "rightArm": [c([-9, 12, -2.6], [5.4, 10.5, 5.2], "base", 0.1), c([-9.1, 12, -2.7], [5.6, 1.5, 5.4], "red")],
                   "leftArm": [c([3.6, 12, -2.6], [5.4, 10.5, 5.2], "base", 0.1), c([3.5, 12, -2.7], [5.6, 1.5, 5.4], "red")],
                   "rightLeg": [RLEG(0.9, "base", 3, 9)] + [hem(-4.9, i) for i in range(5)],
                   "leftLeg": [LLEG(0.9, "base", 3, 9)] + [hem(-1.1, i) for i in range(5)]},
            recipe=None),
        f"{vid}_pants": dict(name=f"{title} Pants", slot="legs", prot=7, dur=1000, colors=dict(base=under, dark=under_dark, red=trim, white=W),
            bones={"body": [c([-4, 11.4, -2], [8, 1.4, 4], "red", 0.55)],
                   "rightLeg": [RLEG(0.45, "base", 2, 10), c([-4.45, 4, -2.45], [0.4, 7, 4.9], "red"), RLEG(0.5, "white", 1, 2)],
                   "leftLeg": [LLEG(0.45, "base", 2, 10), c([3.95, 4, -2.45], [0.4, 7, 4.9], "red"), LLEG(0.5, "white", 1, 2)]},
            recipe=None),
        f"{vid}_sandals": dict(name=f"{title} Sandals", slot="feet", prot=3, dur=900, colors=dict(base=under, dark=(30, 25, 25), red=trim, white=W),
            bones={"rightLeg": [c([-4.1, -0.05, -2.9], [4.4, 0.8, 5.2], "dark"), RLEG(0.5, "base", 0.8, 1.5), RLEG(0.55, "red", 2.3, 1)],
                   "leftLeg": [c([-0.3, -0.05, -2.9], [4.4, 0.8, 5.2], "dark"), LLEG(0.5, "base", 0.8, 1.5), LLEG(0.55, "red", 2.3, 1)]},
            recipe=None),
    }


KAGE = {
    #  id           title          trim (hat/robe)   hem accent        under-outfit      darker
    "hokage": ("Hokage", (205, 40, 30), (250, 150, 40), (40, 50, 90), (25, 30, 60)),
    "kazekage": ("Kazekage", (40, 150, 120), (200, 180, 120), (190, 160, 110), (140, 110, 70)),
    "mizukage": ("Mizukage", (40, 100, 210), (120, 200, 255), (55, 45, 110), (35, 28, 70)),
    "raikage": ("Raikage", (240, 200, 40), (255, 250, 170), (35, 35, 40), (20, 20, 22)),
    "tsuchikage": ("Tsuchikage", (125, 90, 50), (110, 140, 60), (80, 100, 55), (55, 70, 38)),
}
for _vid, _k in KAGE.items():
    ARMOR.update(kage_set(_vid, *_k))
ARMOR.update(akatsuki_set())


# ---- The Legendary Sannin (given by the server owner with /scriptevent aegis:sannin <name>) ----
def rotz(o, s_, sw, deg, piv):
    return c(o, s_, sw, 0, [0, 0, deg], piv)


SANNIN = {
    # Jiraiya — Toad Sage: horned "oil" headband, red vest over an olive kimono, big scroll on the back, wooden geta.
    "jiraiya_headband": dict(name="Toad Sage Headband", slot="head", prot=3, dur=900,
        colors=dict(base=(170, 40, 40), metal=(200, 205, 215), dark=(90, 20, 20), white=(245, 245, 240), black=(25, 25, 30)),
        bones={"head": [c([-4, 27, -4], [8, 2, 8], "base", 0.6), c([-2.6, 27, -4.95], [5.2, 2.2, 0.5], "metal"),
                        rotz([-2.5, 28.8, -5], [0.9, 2.6, 0.6], "metal", 25, [-2, 28.8, -4.7]),
                        rotz([1.6, 28.8, -5], [0.9, 2.6, 0.6], "metal", -25, [2, 28.8, -4.7]),
                        c([-0.9, 27.4, -5.15], [1.8, 1.4, 0.3], "black"),
                        c([-4.6, 22, 3.8], [3, 6, 0.6], "white"), c([1.6, 22, 3.8], [3, 6, 0.6], "white")]},
        recipe=None),
    "jiraiya_haori": dict(name="Toad Sage Haori", slot="chest", prot=8, dur=1000,
        colors=dict(base=(105, 125, 70), red=(190, 40, 35), gold=(240, 200, 60), accent=(150, 110, 70), white=(240, 235, 220), dark=(70, 85, 45)),
        bones={"body": [BODY(0.5, "base"), c([-4.7, 12, -2.9], [3.1, 10.6, 0.4], "red"), c([1.6, 12, -2.9], [3.1, 10.6, 0.4], "red"),
                        c([-4.7, 12, 2.5], [9.4, 10.6, 0.4], "red"), c([-4.7, 21.5, -2.9], [9.4, 1.1, 5.8], "red"),
                        c([-3.9, 17, -3.05], [1.2, 1.2, 0.3], "gold"), c([2.7, 17, -3.05], [1.2, 1.2, 0.3], "gold"),
                        c([-4.8, 13, -2.95], [9.6, 1, 5.9], "dark"),
                        # the giant scroll strapped across the back
                        c([-5.5, 17.5, 3], [11, 2.6, 2.6], "white"), c([-5.9, 17.3, 2.8], [1, 3, 3], "accent"), c([4.9, 17.3, 2.8], [1, 3, 3], "accent")],
               "rightArm": [RARM(0.5, "base"), RARM(0.55, "red", 21, 1)], "leftArm": [LARM(0.5, "base"), LARM(0.55, "red", 21, 1)]},
        recipe=None),
    "jiraiya_pants": dict(name="Toad Sage Pants", slot="legs", prot=6, dur=900, colors=dict(base=(105, 125, 70), dark=(70, 85, 45), white=(240, 235, 220)),
        bones={"body": [c([-4, 11.4, -2], [8, 1.4, 4], "dark", 0.55)],
               "rightLeg": [RLEG(0.45, "base", 2, 10), RLEG(0.5, "white", 1, 2)], "leftLeg": [LLEG(0.45, "base", 2, 10), LLEG(0.5, "white", 1, 2)]},
        recipe=None),
    "jiraiya_geta": dict(name="Toad Sage Geta", slot="feet", prot=3, dur=800, colors=dict(accent=(150, 105, 60), dark=(95, 65, 35), red=(190, 40, 35)),
        bones={"rightLeg": [c([-4.1, -0.9, -2.9], [4.4, 1, 5.2], "accent"), c([-3.6, -1.5, -2.4], [3.4, 0.6, 1], "dark"), c([-3.6, -1.5, 1.4], [3.4, 0.6, 1], "dark"),
                            c([-4, 0.1, -2.6], [4.2, 0.7, 0.6], "red")],
               "leftLeg": [c([-0.3, -0.9, -2.9], [4.4, 1, 5.2], "accent"), c([0.2, -1.5, -2.4], [3.4, 0.6, 1], "dark"), c([0.2, -1.5, 1.4], [3.4, 0.6, 1], "dark"),
                           c([-0.2, 0.1, -2.6], [4.2, 0.7, 0.6], "red")]},
        recipe=None),
    # Tsunade — Slug Princess: Byakugō seal + blonde pigtails, green haori with the gamble mark, grey top, navy pants.
    "tsunade_seal": dict(name="Byakugō Seal", slot="head", prot=2, dur=800, colors=dict(accent2=(150, 70, 200), gold=(245, 215, 120), dark=(40, 40, 60)),
        bones={"head": [rotz([-0.6, 28.6, -4.3], [1.2, 1.2, 0.3], "accent2", 45, [0, 29.2, -4.15]),
                        c([-3.6, 26.5, 3.9], [2.2, 1, 1.4], "dark"), c([1.4, 26.5, 3.9], [2.2, 1, 1.4], "dark"),
                        c([-3.4, 18.5, 4.1], [1.8, 8, 1.2], "gold"), c([1.6, 18.5, 4.1], [1.8, 8, 1.2], "gold")]},
        recipe=None),
    "tsunade_haori": dict(name="Slug Princess Haori", slot="chest", prot=8, dur=1000,
        colors=dict(base=(95, 160, 85), light=(175, 175, 180), red=(190, 40, 40), white=(240, 240, 240), dark=(60, 110, 55)),
        bones={"body": [BODY(0.5, "light"), c([-4.75, 9.5, 2.55], [9.5, 13, 0.4], "base"), c([-4.75, 9.5, -2.95], [2.5, 13, 0.4], "base"),
                        c([2.25, 9.5, -2.95], [2.5, 13, 0.4], "base"), c([-4.75, 22, -2.95], [9.5, 0.6, 5.9], "dark"),
                        c([-1.6, 15.5, 2.9], [3.2, 3.2, 0.3], "white"), c([-0.9, 16.2, 3.0], [1.8, 1.8, 0.3], "red")],
               "rightArm": [c([-9.2, 13, -2.8], [5.6, 9.5, 5.6], "base"), c([-9.25, 13, -2.85], [5.7, 0.8, 5.7], "dark")],
               "leftArm": [c([3.6, 13, -2.8], [5.6, 9.5, 5.6], "base"), c([3.55, 13, -2.85], [5.7, 0.8, 5.7], "dark")]},
        recipe=None),
    "tsunade_pants": dict(name="Slug Princess Pants", slot="legs", prot=6, dur=900, colors=dict(base=(45, 55, 95), dark=(30, 35, 65), light=(175, 175, 180)),
        bones={"body": [c([-4, 11.4, -2], [8, 1.4, 4], "light", 0.55)],
               "rightLeg": [RLEG(0.45, "base", 3, 9)], "leftLeg": [LLEG(0.45, "base", 3, 9)]},
        recipe=None),
    "tsunade_sandals": dict(name="Slug Princess Sandals", slot="feet", prot=3, dur=800, colors=dict(base=(40, 40, 50), dark=(25, 25, 30), light=(220, 210, 190)),
        bones={"rightLeg": [c([-4.1, -0.05, -2.9], [4.4, 0.8, 5.2], "dark"), c([-3.2, -0.8, 1], [2.4, 0.8, 1.6], "dark"), RLEG(0.5, "light", 0.8, 2.2)],
               "leftLeg": [c([-0.3, -0.05, -2.9], [4.4, 0.8, 5.2], "dark"), c([0.6, -0.8, 1], [2.4, 0.8, 1.6], "dark"), LLEG(0.5, "light", 0.8, 2.2)]},
        recipe=None),
    # Orochimaru — Snake Sage: long black hair, pale robe with the purple rope bow, dark pants.
    "orochimaru_hair": dict(name="Snake Sage Hair", slot="head", prot=2, dur=800, colors=dict(black=(22, 20, 28), accent2=(120, 60, 160), dark=(45, 40, 55)),
        bones={"head": [c([-4, 31.2, -4], [8, 1, 8], "black", 0.45), c([-4.2, 18, 3.6], [8.4, 14, 0.9], "black"),
                        c([-4.55, 22, -3.6], [0.7, 10, 6], "black"), c([3.85, 22, -3.6], [0.7, 10, 6], "black"),
                        c([-4.45, 27.4, -4.6], [8.9, 0.6, 0.4], "accent2")]},
        recipe=None),
    "orochimaru_robe": dict(name="Snake Sage Robe", slot="chest", prot=8, dur=1000,
        colors=dict(light=(215, 210, 195), accent2=(120, 60, 160), dark=(80, 40, 110), base=(190, 185, 170)),
        bones={"body": [BODY(0.7, "light"), c([-4.9, 12.6, -3.1], [9.8, 1.6, 6.2], "accent2"), c([-3.2, 11, 3], [6.4, 3, 1.6], "accent2"),
                        c([-1, 7.5, 3.2], [2, 4, 1], "dark"), c([-0.5, 12, -3.05], [1, 10, 0.3], "base")],
               "rightArm": [c([-9.2, 12.5, -2.8], [5.6, 10, 5.6], "light")], "leftArm": [c([3.6, 12.5, -2.8], [5.6, 10, 5.6], "light")],
               "rightLeg": [RLEG(0.85, "light", 4, 8)], "leftLeg": [LLEG(0.85, "light", 4, 8)]},
        recipe=None),
    "orochimaru_pants": dict(name="Snake Sage Pants", slot="legs", prot=6, dur=900, colors=dict(base=(40, 38, 50), dark=(25, 24, 32), accent2=(120, 60, 160)),
        bones={"body": [c([-4, 11.4, -2], [8, 1.4, 4], "accent2", 0.55)],
               "rightLeg": [RLEG(0.45, "base", 2, 10)], "leftLeg": [LLEG(0.45, "base", 2, 10)]},
        recipe=None),
    "orochimaru_sandals": dict(name="Snake Sage Sandals", slot="feet", prot=3, dur=800, colors=dict(base=(40, 38, 50), dark=(20, 20, 25), light=(215, 210, 195)),
        bones={"rightLeg": [c([-4.1, -0.05, -2.9], [4.4, 0.8, 5.2], "dark"), RLEG(0.5, "base", 0.8, 1.5), RLEG(0.55, "light", 2.3, 1)],
               "leftLeg": [c([-0.3, -0.05, -2.9], [4.4, 0.8, 5.2], "dark"), LLEG(0.5, "base", 0.8, 1.5), LLEG(0.55, "light", 2.3, 1)]},
        recipe=None),
}
ARMOR.update(SANNIN)


SLOT = {"head": ("slot.armor.head", "armor_head"), "chest": ("slot.armor.chest", "armor_torso"),
        "legs": ("slot.armor.legs", "armor_legs"), "feet": ("slot.armor.feet", "armor_feet")}


def palette(colors):
    img = Image.new("RGBA", (64, 64), (0, 0, 0, 0))
    default = dict(base=(128, 128, 128), dark=(60, 60, 60), light=(190, 190, 190), accent=(120, 90, 60), accent2=(90, 120, 160),
                   metal=(185, 190, 200), red=(200, 30, 30), white=(240, 240, 240), gold=(235, 190, 60), black=(20, 20, 25))
    for i, name in enumerate(SW):
        col = colors.get(name, default[name])
        u, v = (i % 8) * 8, (i // 8) * 8
        for x in range(8):
            for y in range(8):
                k = 1.08 - y * 0.035
                img.putpixel((u + x, v + y), tuple(max(0, min(255, int(ch * k))) for ch in col) + (255,))
    return img


def render_icon(bones, colors, slot, from_above=False):
    """3/4 view of the model, cropped and scaled into a 32x32 icon."""
    default = palette({})
    faces = []
    yaw, pitch = math.radians(-30), math.radians(-32 if from_above else 18)

    def proj(p):
        x, y, z = p
        x, z = x * math.cos(yaw) - z * math.sin(yaw), x * math.sin(yaw) + z * math.cos(yaw)
        y, z = y * math.cos(pitch) - z * math.sin(pitch), y * math.sin(pitch) + z * math.cos(pitch)
        return x, y, -z

    def rotz(p, piv, deg):
        a = math.radians(deg)
        x, y = p[0] - piv[0], p[1] - piv[1]
        return (piv[0] + x * math.cos(a) - y * math.sin(a), piv[1] + x * math.sin(a) + y * math.cos(a), p[2])

    full = dict(base=(128, 128, 128), dark=(60, 60, 60), light=(190, 190, 190), accent=(120, 90, 60), accent2=(90, 120, 160),
                metal=(185, 190, 200), red=(200, 30, 30), white=(240, 240, 240), gold=(235, 190, 60), black=(20, 20, 25))
    full.update(colors)
    for cubes in bones.values():
        for cu in cubes:
            o, s, inf = cu["origin"], cu["size"], cu.get("inflate", 0)
            pts = [(x, y, z) for x in (o[0] - inf, o[0] + s[0] + inf) for y in (o[1] - inf, o[1] + s[1] + inf) for z in (o[2] - inf, o[2] + s[2] + inf)]
            if "rotation" in cu:
                pts = [rotz(p, cu["pivot"], cu["rotation"][2]) for p in pts]
            col = full[cu["_sw"]]
            for f, sh in zip([(0, 1, 3, 2), (4, 5, 7, 6), (0, 1, 5, 4), (2, 3, 7, 6), (0, 2, 6, 4), (1, 3, 7, 5)], [0.72, 0.9, 0.62, 1.0, 0.85, 0.95]):
                pp = [proj(pts[i]) for i in f]
                faces.append((sum(p[2] for p in pp) / 4, pp, tuple(int(v * sh) for v in col)))
    faces.sort(key=lambda t: t[0])
    xs = [p[0] for _, pp, _ in faces for p in pp]
    ys = [p[1] for _, pp, _ in faces for p in pp]
    cx, cy = (min(xs) + max(xs)) / 2, (min(ys) + max(ys)) / 2
    scale = 440 / max(max(xs) - min(xs), max(ys) - min(ys), 1)
    big = Image.new("RGBA", (512, 512), (0, 0, 0, 0))
    d = ImageDraw.Draw(big)
    for _, pp, col in faces:
        d.polygon([(256 + (p[0] - cx) * scale, 256 - (p[1] - cy) * scale) for p in pp], fill=col + (255,), outline=(15, 12, 18, 255))
    bbox = big.getbbox()
    big = big.crop(bbox)
    side = max(big.size)
    sq = Image.new("RGBA", (side, side), (0, 0, 0, 0))
    sq.paste(big, ((side - big.size[0]) // 2, (side - big.size[1]) // 2))
    icon = sq.resize((30, 30), Image.LANCZOS)
    out = Image.new("RGBA", (32, 32), (0, 0, 0, 0))
    out.paste(icon, (1, 1))
    px = out.load()
    for x in range(32):
        for y in range(32):
            r, g, b, a = px[x, y]
            px[x, y] = (r, g, b, 255) if a > 100 else (0, 0, 0, 0)
    return out


atlas_p = RP / "textures" / "item_texture.json"
atlas = json.loads(atlas_p.read_text())
for aid, a in ARMOR.items():
    tex_dir = RP / "textures" / "models" / "armor" / "aegis"
    tex_dir.mkdir(parents=True, exist_ok=True)
    palette(a["colors"]).save(tex_dir / f"{aid}.png")
    render_icon(a["bones"], a["colors"], a["slot"], aid.endswith("_hat") or aid == "jiraiya_headband").save(RP / "textures" / "items" / "aegis" / f"{aid}.png")
    bones = [{"name": b, "pivot": PIVOTS[b], "cubes": [{k: v for k, v in cu.items() if k != "_sw"} for cu in cubes]} for b, cubes in a["bones"].items()]
    w(RP / "models" / "entity" / f"armor_{aid}.geo.json", {"format_version": "1.12.0", "minecraft:geometry": [{
        "description": {"identifier": f"geometry.aegis.armor_{aid}", "texture_width": 64, "texture_height": 64,
                        "visible_bounds_width": 4, "visible_bounds_height": 4, "visible_bounds_offset": [0, 1.5, 0]},
        "bones": bones}]})
    w(RP / "attachables" / f"armor_{aid}.json", {"format_version": "1.10.0", "minecraft:attachable": {"description": {
        "identifier": f"aegis:{aid}",
        "materials": {"default": "armor", "enchanted": "armor_enchanted"},
        "textures": {"default": f"textures/models/armor/aegis/{aid}", "enchanted": "textures/misc/enchanted_item_glint"},
        "geometry": {"default": f"geometry.aegis.armor_{aid}"},
        "render_controllers": ["controller.render.armor"]}}})
    slot, ench = SLOT[a["slot"]]
    w(BP / "items" / f"{aid}.json", {"format_version": "1.21.60", "minecraft:item": {
        "description": {"identifier": f"aegis:{aid}", "menu_category": {"category": "equipment"}},
        "components": {
            "minecraft:icon": {"textures": {"default": f"aegis_{aid}"}},
            "minecraft:display_name": {"value": a["name"]},
            "minecraft:max_stack_size": 1,
            "minecraft:wearable": {"slot": slot, "protection": a["prot"]},
            "minecraft:durability": {"max_durability": a["dur"]},
            "minecraft:enchantable": {"slot": ench, "value": 12},
            "minecraft:repairable": {"repair_items": [{"items": ["minecraft:iron_ingot", "minecraft:leather"], "repair_amount": 80}]}}}})
    # No crafting since v1.46: armour comes from the Weaponsmith and the Travelling Merchant (a["recipe"] is kept only
    # as a note of the old pattern). Remove any recipe an older build left behind.
    (BP / "recipes" / f"{aid}.json").unlink(missing_ok=True)
    atlas["texture_data"][f"aegis_{aid}"] = {"textures": f"textures/items/aegis/{aid}"}
w(atlas_p, atlas)
print("Generated", len(ARMOR), "armor pieces.")
