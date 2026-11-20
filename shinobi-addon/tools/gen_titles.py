#!/usr/bin/env python3
"""Title gear (v1.54, v1.62): the creative-only scrolls, eyes and tools of the titles of legend
(behavior_pack/scripts/titles.js) — items and hand-drawn icons. The weapons are made by gen_swords.py, Tobi's mask
and the Orange Sage Coat by gen_armor.py (their icons are drawn here).  Run:  python3 tools/gen_titles.py
"""
import json
import math
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from PIL import Image, ImageDraw  # noqa: E402
import gen_icons as G  # noqa: E402

ROOT = Path(__file__).resolve().parent.parent
BP, RP = ROOT / "behavior_pack", ROOT / "resource_pack"


def w(path, obj):
    path.parent.mkdir(parents=True, exist_ok=True)
    with open(path, "w") as f:
        json.dump(obj, f, indent=2, ensure_ascii=False)
        f.write("\n")


def layer(fn):
    lay = G.new()
    fn(lay, ImageDraw.Draw(lay))
    return lay


def ripples(img, col=(170, 110, 240)):        # Shinra Tensei: a shockwave of rings
    lay = layer(lambda l, d: [d.ellipse([64 - r, 64 - r, 64 + r, 64 + r], outline=col + (255,), width=4) for r in (8, 17, 26, 35)])
    G.glow(img, lay, col, 5, 1.5)


def sphere(img, rock=True):                    # Chibaku Tensei: a black sphere wrapped in rock
    G.shape(img, lambda d: d.ellipse([30, 30, 98, 98], fill=255), (90, 70, 110), (20, 14, 26), "radial", center=(52, 52), radius=50)
    d = ImageDraw.Draw(img)
    if rock:
        for x, y, s in ((36, 44, 9), (78, 40, 11), (86, 76, 9), (44, 84, 10), (62, 92, 7), (28, 66, 7)):
            d.polygon([(x - s, y), (x - s * 0.3, y - s), (x + s, y - s * 0.4), (x + s * 0.6, y + s)], fill=(110, 96, 84, 255))


def red_moon(img):                             # Tsukuyomi: a red moon with the Sharingan's tomoe
    G.shape(img, lambda d: d.ellipse([28, 28, 100, 100], fill=255), (240, 50, 50), (120, 0, 0), "radial", center=(56, 54), radius=48)
    d = ImageDraw.Draw(img)
    for k in range(3):
        a = k * math.pi * 2 / 3 - math.pi / 2
        cx, cy = 64 + math.cos(a) * 20, 64 + math.sin(a) * 20
        d.ellipse([cx - 6, cy - 6, cx + 6, cy + 6], fill=(20, 8, 8, 255))
    d.ellipse([58, 58, 70, 70], fill=(20, 8, 8, 255))


def flame(img, outer, inner, glow, s=36):
    lay = G.new()
    G.shape(lay, lambda d: d.polygon(G.flame_poly(64, 62, s), fill=255), outer, tuple(int(c * 0.45) for c in outer))
    G.shape(lay, lambda d: d.polygon(G.flame_poly(64, 62 + s * 0.25, s * 0.55), fill=255), inner, outer)
    G.glow(img, lay, glow, 6, 1.6)


def black_flame(img):                          # Amaterasu: black flames with a red edge
    flame(img, (36, 26, 40), (90, 40, 70), (200, 30, 40))


def chakra_flame(img, col):                    # Susanoo (purple) / Perfect Susanoo (blue)
    flame(img, col, tuple(min(255, c + 100) for c in col), col)


def kamui(img):                                 # Kamui Shuriken: a purple spiral round a shuriken
    G.emblem_spiral(img, color=(150, 80, 230), light=(230, 200, 255))
    d = ImageDraw.Draw(img)
    for k in range(4):
        a = k * math.pi / 2
        d.polygon([(64, 64), (64 + math.cos(a - 0.35) * 10, 64 + math.sin(a - 0.35) * 10), (64 + math.cos(a) * 28, 64 + math.sin(a) * 28),
                   (64 + math.cos(a + 0.35) * 10, 64 + math.sin(a + 0.35) * 10)], fill=(60, 60, 70, 255))
    d.ellipse([60, 60, 68, 68], fill=(200, 200, 210, 255))


def arrow(img):                                 # Indra's Arrow: a lightning arrow
    lay = layer(lambda l, d: (d.line([(26, 100), (92, 34)], fill=(200, 160, 255, 255), width=7),
                               d.polygon([(100, 26), (78, 32), (94, 48)], fill=(230, 210, 255, 255)),
                               d.line([(40, 64), (52, 74), (46, 84), (60, 92)], fill=(160, 200, 255, 255), width=4),
                               d.line([(62, 42), (74, 52), (68, 60), (82, 66)], fill=(160, 200, 255, 255), width=4)))
    G.glow(img, lay, (170, 110, 255), 6, 1.6)


def lightning_ring(img):                        # Chidori Nagashi
    def draw(l, d):
        pts = []
        for i in range(25):
            a = i / 24 * math.pi * 2
            r = 30 + (6 if i % 2 else -4)
            pts.append((64 + math.cos(a) * r, 64 + math.sin(a) * r))
        d.line(pts, fill=(170, 220, 255, 255), width=4)
        d.ellipse([52, 52, 76, 76], fill=(220, 240, 255, 255))
    G.glow(img, layer(draw), (120, 190, 255), 6, 1.6)


def rasenshuriken(img):                         # Rasenshuriken V2
    def draw(l, d):
        for k in range(4):
            a = k * math.pi / 2 + 0.4
            d.polygon([(64, 64), (64 + math.cos(a - 0.5) * 14, 64 + math.sin(a - 0.5) * 14), (64 + math.cos(a) * 42, 64 + math.sin(a) * 42),
                       (64 + math.cos(a + 0.2) * 14, 64 + math.sin(a + 0.2) * 14)], fill=(200, 235, 255, 230))
        d.ellipse([46, 46, 82, 82], fill=(120, 190, 255, 255))
        d.ellipse([56, 56, 72, 72], fill=(240, 250, 255, 255))
    G.glow(img, layer(draw), (120, 200, 255), 6, 1.5)


def beast_bomb(img):                            # Tailed Beast Bomb V2
    G.shape(img, lambda d: d.ellipse([30, 30, 98, 98], fill=255), (110, 50, 140), (20, 10, 30), "radial", center=(54, 52), radius=50)
    lay = layer(lambda l, d: d.ellipse([28, 28, 100, 100], outline=(255, 140, 40, 255), width=4))
    G.glow(img, lay, (255, 140, 40), 6, 1.4)


def six_paths(img):                             # Six Paths Sage Mode: a golden ring of truth-seeking orbs
    def draw(l, d):
        d.ellipse([30, 30, 98, 98], outline=(255, 210, 90, 255), width=5)
        for k in range(9):
            a = k / 9 * math.pi * 2 - math.pi / 2
            cx, cy = 64 + math.cos(a) * 34, 64 + math.sin(a) * 34
            d.ellipse([cx - 6, cy - 6, cx + 6, cy + 6], fill=(20, 16, 20, 255))
        d.ellipse([54, 54, 74, 74], fill=(255, 230, 140, 255))
    G.glow(img, layer(draw), (255, 200, 80), 6, 1.4)


# id → (display name, title, rod colour, emblem)
SCROLLS = {
    "adv_shinra_tensei_scroll": ("Advanced Shinra Tensei", "Pain", "purple", ripples),
    "adv_chibaku_tensei_scroll": ("Advanced Chibaku Tensei", "Pain", "purple", sphere),
    "tsukuyomi_scroll": ("Tsukuyomi", "Itachi of the Sharingan", "red", red_moon),
    "amaterasu_scroll": ("Amaterasu", "Itachi of the Sharingan", "red", black_flame),
    "susanoo_scroll": ("Susanoo", "Itachi of the Sharingan", "red", lambda i: chakra_flame(i, (150, 70, 220))),
    "kamui_shuriken_scroll": ("Kamui Shuriken", "Tobi", "black", kamui),
    "indra_arrow_scroll": ("Indra's Arrow", "Sasuke", "blue", arrow),
    "chidori_nagashi_scroll": ("Chidori Nagashi V2", "Sasuke", "blue", lightning_ring),
    "perfect_susanoo_scroll": ("Perfect Susanoo", "Sasuke", "blue", lambda i: chakra_flame(i, (70, 120, 240))),
    "rasenshuriken_v2_scroll": ("Rasenshuriken V2", "Naruto", "gold", rasenshuriken),
    "tailed_beast_bomb_scroll": ("Tailed Beast Bomb V2", "Naruto", "gold", beast_bomb),
    "six_paths_sage_scroll": ("Six Paths Sage Mode (half)", "Naruto", "gold", six_paths),
}
COLORS = {"Pain": "§5", "Itachi of the Sharingan": "§c", "Tobi": "§6", "Sasuke": "§9", "Naruto": "§6"}


def advanced_rinnegan():
    img = G.eye("rinnegan")
    d = ImageDraw.Draw(img)
    for r in (16, 26):
        for k in range(3):
            a = k * math.pi * 2 / 3 + r * 0.05
            cx, cy = 64 + math.cos(a) * r, 62 + math.sin(a) * r
            d.ellipse([cx - 3.5, cy - 3.5, cx + 3.5, cy + 3.5], fill=(30, 10, 40, 255))
    return img


def tobi_mask():
    img = G.new()
    oval = lambda d: d.ellipse([24, 8, 104, 120], fill=255)
    G.shape(img, oval, (250, 150, 50), (190, 80, 20), "radial", center=(54, 48), radius=74)
    sp = G.new()
    d = ImageDraw.Draw(sp)
    cx, cy = 50, 50
    pts = [(cx + math.cos(t) * (5 + t * 3.0), cy + math.sin(t) * (5 + t * 3.0)) for t in [i * 0.12 for i in range(150)]]
    d.line(pts, fill=(140, 60, 15, 255), width=4, joint="curve")
    m = Image.new("L", (G.S, G.S), 0)
    oval(ImageDraw.Draw(m))
    sp.putalpha(Image.composite(sp.split()[3], Image.new("L", (G.S, G.S), 0), m))
    img.alpha_composite(sp)
    ImageDraw.Draw(img).ellipse([cx - 7, cy - 7, cx + 7, cy + 7], fill=(18, 12, 12, 255))
    return img


def sage_coat():
    img = G.new()
    G.shape(img, lambda d: d.polygon([(42, 14), (86, 14), (112, 40), (100, 54), (92, 46), (96, 116), (32, 116), (36, 46), (28, 54), (16, 40)], fill=255),
            (250, 150, 50), (200, 92, 22))
    d = ImageDraw.Draw(img)
    for i in range(6):
        x = 33 + i * 10.4
        d.polygon([(x, 116), (x + 5, 98 - (i % 2) * 9), (x + 10, 116)], fill=(26, 20, 22, 255))
    d.line([64, 26, 64, 112], fill=(170, 70, 15, 255), width=3)
    d.polygon([(48, 14), (64, 32), (80, 14)], fill=(255, 196, 120, 255))
    return img


# ---- v1.62: the Toad Sage, the Slug Princess, the White Snake, the Yellow Flash, the Green Beast, the Copy Ninja,
# the Sage of Six Paths and Madara's Heir ----
G.RODS.setdefault("green", ((80, 170, 80), (30, 90, 40)))
G.RODS.setdefault("white", ((230, 230, 238), (150, 150, 165)))


def gamabunta(img):                            # Summoning: Gamabunta — the toad boss and his dosu
    lay = layer(lambda l, d: (d.polygon([(90, 98), (104, 40), (108, 42), (96, 100)], fill=(210, 215, 225, 255)),
                               d.rectangle([86, 96, 98, 104], fill=(60, 40, 30, 255))))
    img.alpha_composite(lay)
    G.emblem_toad(img)


def goemon(img):                               # Sage Art: Goemon — toad oil, fire and wind in one burning stream
    G.emblem_wind(img, color=(255, 150, 40))
    flame(img, (255, 110, 20), (255, 230, 90), (255, 140, 40), s=26)


def hundred_seal(img):                         # Strength of a Hundred Seal — the diamond on the brow and its spreading marks
    def draw(l, d):
        for k in range(8):
            a = k * math.pi / 4
            d.line([(64 + math.cos(a) * 20, 64 + math.sin(a) * 20), (64 + math.cos(a) * 38, 64 + math.sin(a) * 38)], fill=(150, 90, 220, 255), width=4)
        d.polygon([(64, 40), (82, 64), (64, 88), (46, 64)], fill=(170, 100, 240, 255))
        d.polygon([(64, 50), (74, 64), (64, 78), (54, 64)], fill=(232, 205, 255, 255))
    G.glow(img, layer(draw), (160, 90, 240), 6, 1.6)


def eight_heads(img):                          # Eight Branches — eight serpents fanning out
    def draw(l, d):
        for k in range(8):
            a = math.pi + 0.35 + k / 7 * (math.pi - 0.7)
            pts = [(64 + math.cos(a) * r + math.sin(r / 5) * 2.5, 96 + math.sin(a) * r) for r in range(0, 46, 3)]
            d.line(pts, fill=(140, 80, 190, 255), width=6, joint="curve")
            ex, ey = pts[-1]
            d.ellipse([ex - 5, ey - 5, ex + 5, ey + 5], fill=(175, 115, 225, 255))
            d.ellipse([ex - 1.5, ey - 1.5, ex + 1.5, ey + 1.5], fill=(250, 210, 40, 255))
    G.glow(img, layer(draw), (140, 80, 200), 4, 1.3)


def white_snake(img):                          # White Snake Rebirth — a coiled white serpent
    G.emblem_spiral(img, color=(215, 215, 232), light=(255, 255, 255), turns=2.2, r0=28)
    d = ImageDraw.Draw(img)
    d.ellipse([84, 56, 98, 72], fill=(235, 235, 245, 255), outline=(150, 140, 180, 255), width=2)
    d.ellipse([90, 60, 95, 65], fill=(250, 210, 40, 255))


def three_prong(d, cx, cy, s, col):
    d.rectangle([cx - 2 * s, cy, cx + 2 * s, cy + 22 * s], fill=col)
    d.ellipse([cx - 5 * s, cy + 22 * s, cx + 5 * s, cy + 32 * s], outline=col, width=max(2, int(3 * s)))
    d.polygon([(cx, cy - 30 * s), (cx - 6 * s, cy - 2 * s), (cx + 6 * s, cy - 2 * s)], fill=col)
    for sg in (-1, 1):
        d.polygon([(cx + sg * 15 * s, cy - 18 * s), (cx + sg * 10 * s, cy + 2 * s), (cx + sg * 4 * s, cy - 2 * s)], fill=col)


def raijin_strike(img):                        # Flying Thunder God: Strike — the yellow flash and the marked kunai
    def draw(l, d):
        for i, y in enumerate((44, 58, 72, 86)):
            d.line([28 + i * 3, y, 60 + i * 3, y], fill=(255, 230, 120, 255), width=4)
        three_prong(d, 80, 60, 0.95, (250, 242, 205, 255))
    G.glow(img, layer(draw), (255, 210, 80), 5, 1.8)


def rasengan_barrage(img):                     # Rasengan Barrage — five spinning spheres
    def draw(l, d):
        for k in range(5):
            a = k / 5 * math.pi * 2 - math.pi / 2
            cx, cy = 64 + math.cos(a) * 23, 64 + math.sin(a) * 23
            d.ellipse([cx - 11, cy - 11, cx + 11, cy + 11], fill=(110, 180, 255, 255))
            d.arc([cx - 8, cy - 8, cx + 8, cy + 8], 20, 250, fill=(230, 245, 255, 255), width=3)
            d.ellipse([cx - 3, cy - 3, cx + 3, cy + 3], fill=(240, 250, 255, 255))
    G.glow(img, layer(draw), (110, 180, 255), 5, 1.6)


def night_guy(img):                            # Night Guy — the red dragon of the Eighth Gate
    flame(img, (230, 30, 30), (255, 140, 110), (255, 50, 40))
    d = ImageDraw.Draw(img)
    for sg in (-1, 1):
        d.polygon([(64 + sg * 16, 44), (64 + sg * 10, 26), (64 + sg * 6, 46)], fill=(120, 10, 10, 255))
        d.ellipse([64 + sg * 8 - 4, 54, 64 + sg * 8 + 4, 60], fill=(255, 240, 200, 255))


def evening_elephant(img):                     # Evening Elephant — five pillars of struck air
    def draw(l, d):
        for k in range(5):
            x = 32 + k * 16
            d.rounded_rectangle([x - 5, 34 + (k % 2) * 6, x + 5, 92], radius=5, fill=(215, 240, 255, 235))
            d.line([x, 40 + (k % 2) * 6, x, 88], fill=(255, 255, 255, 255), width=2)
        d.ellipse([40, 84, 88, 100], outline=(140, 230, 160, 255), width=4)
    G.glow(img, layer(draw), (150, 230, 170), 5, 1.4)


def kamui_raikiri(img):                        # Kamui Raikiri — a bolt through a purple warp
    G.emblem_spiral(img, color=(150, 80, 230), light=(230, 200, 255), turns=2.0, r0=30)
    G.emblem_bolt(img, color=(140, 220, 255))


def hounds(img):                               # Lightning Hound V2 — three hounds of lightning
    def draw(l, d):
        for y in (42, 64, 86):
            pts = [(26, y), (44, y - 8), (56, y + 6), (70, y - 6), (84, y + 4), (98, y - 2)]
            d.line(pts, fill=(150, 215, 255, 255), width=6, joint="curve")
            d.line(pts, fill=(240, 250, 255, 255), width=2)
            d.polygon([(96, y - 9), (106, y - 2), (96, y + 5)], fill=(200, 235, 255, 255))
    G.glow(img, layer(draw), (120, 190, 255), 6, 1.8)


def truth_orbs(img):                           # Truth-Seeking Orbs — six black orbs in a golden ring
    def draw(l, d):
        d.ellipse([30, 30, 98, 98], outline=(255, 210, 90, 255), width=3)
        for k in range(6):
            a = k / 6 * math.pi * 2 - math.pi / 2
            cx, cy = 64 + math.cos(a) * 28, 64 + math.sin(a) * 28
            d.ellipse([cx - 9, cy - 9, cx + 9, cy + 9], fill=(16, 12, 18, 255))
            d.ellipse([cx - 5, cy - 6, cx - 1, cy - 2], fill=(110, 100, 120, 255))
    G.glow(img, layer(draw), (200, 170, 255), 6, 1.2)


def six_paths_full(img):                       # Six Paths Sage Mode — a golden aura and six magatama
    def draw(l, d):
        d.ellipse([28, 28, 100, 100], outline=(255, 210, 90, 255), width=5)
        for k in range(6):
            a = k / 6 * math.pi * 2 - math.pi / 2
            cx, cy = 64 + math.cos(a) * 22, 64 + math.sin(a) * 22
            d.ellipse([cx - 6, cy - 6, cx + 6, cy + 6], fill=(20, 16, 20, 255))
            d.line([(cx, cy), (cx + math.cos(a + 1.6) * 9, cy + math.sin(a + 1.6) * 9)], fill=(20, 16, 20, 255), width=4)
        d.ellipse([56, 56, 72, 72], fill=(255, 235, 150, 255))
    G.glow(img, layer(draw), (255, 200, 80), 7, 1.6)


def meteor(img):                               # Tengai Shinsei — a meteor falling out of the sky
    def trail(l, d):
        for k in range(5):
            d.line([(26 + k * 3, 24 + k * 2), (72, 66)], fill=(255, 140 + k * 20, 40, 220), width=10 - k)
    G.glow(img, layer(trail), (255, 120, 30), 6, 1.4)
    G.shape(img, lambda d: d.ellipse([58, 54, 100, 96], fill=255), (160, 125, 100), (60, 45, 40), "radial", center=(72, 66), radius=34)
    d = ImageDraw.Draw(img)
    for x, y, s in ((68, 68, 5), (86, 80, 6), (76, 88, 4), (90, 64, 4)):
        d.ellipse([x - s, y - s, x + s, y + s], fill=(84, 64, 54, 255))


SCROLLS.update({
    "gamabunta_scroll": ("Summoning: Gamabunta", "The Toad Sage", "red", gamabunta),
    "goemon_scroll": ("Sage Art: Goemon", "The Toad Sage", "red", goemon),
    "hundred_seal_scroll": ("Strength of a Hundred Seal", "The Slug Princess", "green", hundred_seal),
    "katsuyu_scroll": ("Summoning: Katsuyu", "The Slug Princess", "green", G.emblem_slug),
    "eight_branches_scroll": ("Eight Branches Technique", "The White Snake", "purple", eight_heads),
    "snake_rebirth_scroll": ("White Snake Rebirth", "The White Snake", "purple", white_snake),
    "raijin_strike_scroll": ("Flying Thunder God: Strike", "The Yellow Flash", "gold", raijin_strike),
    "rasengan_barrage_scroll": ("Rasengan Barrage", "The Yellow Flash", "gold", rasengan_barrage),
    "night_guy_scroll": ("Eight Gates: Night Guy", "The Green Beast", "green", night_guy),
    "evening_elephant_scroll": ("Eight Gates: Evening Elephant", "The Green Beast", "green", evening_elephant),
    "kamui_raikiri_scroll": ("Kamui Raikiri", "The Copy Ninja", "white", kamui_raikiri),
    "lightning_hound_v2_scroll": ("Lightning Hound V2", "The Copy Ninja", "white", hounds),
    "truth_seeking_scroll": ("Truth-Seeking Orbs", "The Sage of Six Paths", "gold", truth_orbs),
    "six_paths_mode_scroll": ("Six Paths Sage Mode", "The Sage of Six Paths", "gold", six_paths_full),
    "susanoo_v2_scroll": ("Perfect Susanoo V2", "Madara's Heir", "black", lambda i: chakra_flame(i, (60, 100, 240))),
    "tengai_shinsei_scroll": ("Tengai Shinsei", "Madara's Heir", "black", meteor),
})
COLORS.update({"The Toad Sage": "§a", "The Slug Princess": "§2", "The White Snake": "§5", "The Yellow Flash": "§e",
               "The Green Beast": "§a", "The Copy Ninja": "§7", "The Sage of Six Paths": "§6", "Madara's Heir": "§4"})


def contract():                                # the Toad Summoning Contract, unrolled, signed in blood
    img = G.new()
    G.shape(img, lambda d: d.rectangle([14, 38, 114, 90], fill=255), (248, 236, 205), (210, 185, 140))
    for x0 in (4, 110):
        G.shape(img, lambda d, x0=x0: d.rounded_rectangle([x0, 30, x0 + 14, 98], radius=6, fill=255), (190, 60, 50), (100, 20, 20), "h")
    d = ImageDraw.Draw(img)
    d.rectangle([18, 40, 108, 43], fill=(175, 145, 105, 255))
    for x in range(26, 104, 12):
        d.line([x, 48, x, 70], fill=(30, 25, 25, 255), width=3)          # the names
        d.ellipse([x - 4, 74, x + 4, 84], fill=(190, 30, 30, 255))       # the fingerprints in blood
    return img


def necklace():                                # Tsunade's necklace — the First Hokage's green crystal on its cord
    img = G.new()
    d = ImageDraw.Draw(img)
    d.line([(18, 6), (34, 30), (54, 48), (62, 54)], fill=(70, 56, 44, 255), width=5, joint="curve")
    d.line([(110, 6), (94, 30), (74, 48), (66, 54)], fill=(70, 56, 44, 255), width=5, joint="curve")
    d.rounded_rectangle([56, 50, 72, 60], radius=3, fill=(220, 180, 70, 255))
    G.shape(img, lambda d: d.polygon([(64, 58), (80, 72), (75, 112), (64, 124), (53, 112), (48, 72)], fill=255), (175, 255, 195), (25, 130, 65))
    d = ImageDraw.Draw(img)
    d.line([(64, 62), (64, 120)], fill=(225, 255, 235, 255), width=3)
    d.line([(57, 72), (55, 108)], fill=(120, 225, 150, 255), width=2)
    return img


def icha_icha():                               # Icha Icha Tactics — Kakashi's green book
    img = G.new()
    G.shape(img, lambda d: d.polygon([(30, 20), (98, 14), (104, 106), (36, 112)], fill=255), (115, 205, 95), (40, 120, 40))
    d = ImageDraw.Draw(img)
    d.polygon([(36, 112), (104, 106), (106, 113), (38, 119)], fill=(245, 240, 225, 255))
    d.line([(30, 20), (36, 112)], fill=(30, 80, 30, 255), width=6)
    d.ellipse([50, 42, 86, 78], outline=(225, 40, 40, 255), width=5)
    d.ellipse([60, 52, 76, 68], fill=(250, 230, 200, 255))
    d.line([(55, 73), (81, 47)], fill=(225, 40, 40, 255), width=5)
    d.rectangle([44, 86, 92, 92], fill=(250, 245, 230, 255))
    return img


def kakashi_mask_icon():                       # Kakashi's mask: the cloth over nose and mouth, the headband slanted over one eye
    img = G.new()
    G.shape(img, lambda d: d.polygon([(26, 60), (64, 52), (102, 60), (100, 96), (82, 116), (46, 116), (28, 96)], fill=255), (74, 84, 118), (34, 38, 58))
    d = ImageDraw.Draw(img)
    d.line([(64, 55), (64, 78)], fill=(98, 108, 142, 255), width=3)
    G.shape(img, lambda d: d.polygon([(16, 20), (112, 33), (112, 52), (16, 39)], fill=255), (54, 60, 86), (30, 34, 50))
    G.shape(img, lambda d: d.polygon([(44, 22), (84, 27), (84, 47), (44, 42)], fill=255), (228, 232, 240), (150, 156, 170))
    d = ImageDraw.Draw(img)
    d.arc([57, 28, 71, 42], 40, 330, fill=(40, 40, 52, 255), width=3)
    d.line([(70, 31), (77, 27)], fill=(40, 40, 52, 255), width=3)
    return img


TOOLS = {"toad_contract": ("Toad Summoning Contract", "The Toad Sage", contract),
         "tsunade_necklace": ("Tsunade's Necklace", "The Slug Princess", necklace),
         "icha_icha": ("Icha Icha Tactics", "The Copy Ninja", icha_icha)}


atlas_p = RP / "textures" / "item_texture.json"
atlas = json.loads(atlas_p.read_text())
for sid, (name, title, rod, emblem) in SCROLLS.items():
    img = G.scroll(rod)
    emblem(img)
    G.finish(img, sid)
    w(BP / "items" / f"{sid}.json", {"format_version": "1.21.60", "minecraft:item": {
        "description": {"identifier": f"aegis:{sid}", "menu_category": {"category": "equipment"}},
        "components": {"minecraft:icon": {"textures": {"default": f"aegis_{sid}"}},
                       "minecraft:display_name": {"value": f"{COLORS[title]}Title Scroll: {name}§r\n§7{title} title"},
                       "minecraft:max_stack_size": 1, "minecraft:glint": True}}})
    atlas["texture_data"][f"aegis_{sid}"] = {"textures": f"textures/items/aegis/{sid}"}

G.finish(advanced_rinnegan(), "advanced_rinnegan")
w(BP / "items" / "advanced_rinnegan.json", {"format_version": "1.21.60", "minecraft:item": {
    "description": {"identifier": "aegis:advanced_rinnegan", "menu_category": {"category": "equipment"}},
    "components": {"minecraft:icon": {"textures": {"default": "aegis_advanced_rinnegan"}},
                   "minecraft:display_name": {"value": "§5Advanced Rinnegan Eyes§r\n§7Pain title"},
                   "minecraft:max_stack_size": 1, "minecraft:glint": True}}})
atlas["texture_data"]["aegis_advanced_rinnegan"] = {"textures": "textures/items/aegis/advanced_rinnegan"}
for tid, (name, title, draw) in TOOLS.items():
    G.finish(draw(), tid)
    w(BP / "items" / f"{tid}.json", {"format_version": "1.21.60", "minecraft:item": {
        "description": {"identifier": f"aegis:{tid}", "menu_category": {"category": "equipment"}},
        "components": {"minecraft:icon": {"textures": {"default": f"aegis_{tid}"}},
                       "minecraft:display_name": {"value": f"{COLORS[title]}{name}§r\n§7{title} title"},
                       "minecraft:max_stack_size": 1, "minecraft:glint": True}}})
    atlas["texture_data"][f"aegis_{tid}"] = {"textures": f"textures/items/aegis/{tid}"}
# icons for the armour pieces gen_armor.py makes
G.finish(tobi_mask(), "tobi_mask")
G.finish(kakashi_mask_icon(), "kakashi_mask")
G.finish(sage_coat(), "orange_sage_coat")
w(atlas_p, atlas)
print(f"Title gear: {len(SCROLLS)} scrolls, {len(TOOLS)} tools, the Advanced Rinnegan, and the mask & coat icons.")
