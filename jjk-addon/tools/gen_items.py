#!/usr/bin/env python3
"""Jujutsu Legacy items: every technique move (right-click to use), the Heavenly Restriction cursed tools, the
Jujutsu Record, Sukuna's Finger and the Cursed Womb — 32×32 pixel-art icons drawn in code, item JSON,
item_texture.json and both pack icons.

Moves are round "seal" badges in their technique's colour; tools and keepsakes are drawn as objects.
The scripts own what each item does (costs, cooldowns, damage); this file only owns how it looks and its name.
Run from the jjk-addon folder:  python3 tools/gen_items.py
"""
import json
import math
import random
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parent.parent
BP, RP = ROOT / "behavior_pack", ROOT / "resource_pack"
ICONS = RP / "textures" / "items" / "jjk"
ICONS.mkdir(parents=True, exist_ok=True)
INK = (18, 14, 24, 255)


def w(path, obj):
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(obj, indent=2, ensure_ascii=False) + "\n")


# ---------------------------------------------------------------------------
# Drawing helpers (no anti-aliasing: every pixel is placed on purpose)
# ---------------------------------------------------------------------------
def canvas():
    img = Image.new("RGBA", (32, 32), (0, 0, 0, 0))
    return img, ImageDraw.Draw(img)


def outline(img, col=INK):
    """A 1-pixel ink border around everything drawn (the usual Minecraft icon style)."""
    px = img.load()
    edge = []
    for x in range(32):
        for y in range(32):
            if px[x, y][3] == 0 and any(0 <= x + dx < 32 and 0 <= y + dy < 32 and px[x + dx, y + dy][3] > 0
                                        for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1))):
                edge.append((x, y))
    for p in edge:
        px[p] = col
    return img


def shade(c, k):
    return tuple(max(0, min(255, int(v * k))) for v in c[:3]) + (255,)


def badge(rim, inner=(26, 22, 38)):
    """The round seal every move sits on: a coloured rim, a dark face lit from the top."""
    img, d = canvas()
    d.ellipse((1, 1, 30, 30), fill=shade(rim, 0.55))
    d.ellipse((1, 1, 29, 29), fill=rim + (255,))
    d.ellipse((3, 3, 28, 28), fill=shade(inner, 1.0))
    for i in range(6):
        d.arc((4 + i, 4 + i, 27 - i, 27 - i), 200, 340, fill=shade(inner, 1.25 + 0.05 * i))
    return img, d


def ball(d, cx, cy, r, edge, core, hot=(255, 255, 255)):
    for i in range(r, 0, -1):
        u = 1 - i / r
        c = tuple(int(edge[j] + (core[j] - edge[j]) * u) for j in range(3))
        d.ellipse((cx - i, cy - i, cx + i - 1, cy + i - 1), fill=c + (255,))
    d.point([(cx - r // 3, cy - r // 3), (cx - r // 3 + 1, cy - r // 3)], fill=hot + (255,))


def line(d, pts, col, wd=1):
    d.line(pts, fill=col + (255,) if len(col) == 3 else col, width=wd)


def poly(d, pts, col):
    d.polygon(pts, fill=col + (255,) if len(col) == 3 else col)


# ---------------------------------------------------------------------------
# Icons
# ---------------------------------------------------------------------------
TECH_RIM = {"limitless": (90, 200, 255), "shrine": (200, 30, 40), "ten_shadows": (120, 90, 190), "cursed_speech": (60, 190, 170),
            "blood": (150, 14, 28), "boogie": (240, 160, 40), "universal": (235, 225, 190), "straw_doll": (200, 128, 60),
            "ratio": (206, 186, 128)}


def i_blue():
    img, d = badge(TECH_RIM["limitless"])
    for r, a in ((11, 0), (8, 60), (5, 130)):
        d.arc((16 - r, 16 - r, 16 + r, 16 + r), a, a + 250, fill=(60, 140, 255, 255))
    ball(d, 16, 16, 5, (20, 60, 220), (150, 210, 255))
    return img


def i_red():
    img, d = badge(TECH_RIM["limitless"])
    for k in range(8):
        a = k * math.pi / 4
        line(d, [(16 + math.cos(a) * 7, 16 + math.sin(a) * 7), (16 + math.cos(a) * 12, 16 + math.sin(a) * 12)], (255, 90, 70))
    ball(d, 16, 16, 6, (170, 10, 20), (255, 140, 110))
    return img


def i_purple():
    img, d = badge(TECH_RIM["limitless"], (20, 10, 34))
    ball(d, 16, 16, 10, (80, 10, 160), (220, 160, 255))
    d.arc((5, 5, 27, 27), 100, 260, fill=(70, 140, 255, 255))
    d.arc((5, 5, 27, 27), 280, 80, fill=(255, 70, 70, 255))
    return img


def i_void():
    img, d = badge(TECH_RIM["limitless"], (6, 8, 22))
    rnd = random.Random(3)
    for _ in range(14):
        d.point((rnd.randint(5, 26), rnd.randint(5, 26)), fill=(220, 230, 255, 255))
    d.ellipse((7, 11, 24, 20), fill=(240, 246, 255, 255))
    d.ellipse((12, 11, 19, 20), fill=(90, 190, 255, 255))
    d.ellipse((14, 13, 17, 18), fill=(10, 20, 60, 255))
    d.point((13, 12), fill=(255, 255, 255, 255))
    return img


def i_dismantle():
    img, d = badge(TECH_RIM["shrine"])
    for off in (-6, 0, 6):
        line(d, [(7 + off, 25), (23 + off, 7)], (250, 250, 255))
        line(d, [(8 + off, 25), (24 + off, 7)], (200, 200, 220))
    return img


def i_cleave():
    img, d = badge(TECH_RIM["shrine"])
    line(d, [(7, 7), (25, 25)], (255, 240, 240), 2)
    line(d, [(25, 7), (7, 25)], (255, 240, 240), 2)
    line(d, [(9, 7), (25, 23)], (220, 40, 50))
    line(d, [(23, 7), (7, 23)], (220, 40, 50))
    return img


def i_fuga():
    img, d = badge(TECH_RIM["shrine"], (40, 14, 10))
    poly(d, [(16, 4), (22, 14), (20, 24), (16, 28), (12, 24), (10, 14)], (255, 110, 20))
    poly(d, [(16, 9), (19, 16), (18, 23), (16, 25), (14, 23), (13, 16)], (255, 200, 60))
    poly(d, [(16, 15), (17, 19), (16, 22), (15, 19)], (255, 250, 210))
    line(d, [(16, 2), (16, 9)], (255, 240, 200))
    return img


def i_shrine():
    img, d = badge(TECH_RIM["shrine"], (30, 10, 14))
    poly(d, [(5, 12), (27, 12), (24, 9), (8, 9)], (34, 26, 30))
    poly(d, [(9, 9), (23, 9), (20, 6), (12, 6)], (34, 26, 30))
    d.rectangle((8, 12, 9, 25), fill=(170, 24, 30, 255))
    d.rectangle((22, 12, 23, 25), fill=(170, 24, 30, 255))
    d.rectangle((10, 13, 21, 25), fill=(20, 6, 10, 255))
    for x in range(11, 21, 2):
        d.rectangle((x, 13, x, 15 + (x % 4 == 1)), fill=(240, 232, 210, 255))
        d.rectangle((x, 23 - (x % 4 == 3), x, 25), fill=(240, 232, 210, 255))
    d.rectangle((6, 25, 25, 26), fill=(90, 84, 90, 255))
    return img


def i_dogs():
    img, d = badge(TECH_RIM["ten_shadows"])
    for side, col, eye in ((-1, (240, 240, 245), (250, 220, 90)), (1, (40, 40, 48), (110, 180, 255))):
        cx = 16 + side * 5
        poly(d, [(cx - 5, 12), (cx - 4, 6), (cx - 1, 10), (cx + 1, 10), (cx + 4, 6), (cx + 5, 12), (cx + 4, 20), (cx + 1, 25),
                 (cx - 1, 25), (cx - 4, 20)], col)
        d.point([(cx - 2, 14), (cx + 2, 14)], fill=eye + (255,))
        d.point((cx, 23), fill=(20, 20, 20, 255) if side < 0 else (200, 200, 200, 255))
    return img


def i_nue():
    img, d = badge(TECH_RIM["ten_shadows"])
    poly(d, [(3, 13), (13, 15), (16, 19), (19, 15), (29, 13), (22, 20), (16, 22), (10, 20)], (70, 80, 120))
    d.ellipse((12, 10, 20, 22), fill=(80, 90, 130, 255))
    d.ellipse((13, 13, 19, 21), fill=(230, 230, 236, 255))
    d.point([(14, 13), (18, 13)], fill=(250, 220, 70, 255))
    poly(d, [(12, 10), (13, 7), (14, 10)], (40, 44, 64))
    poly(d, [(18, 10), (19, 7), (20, 10)], (40, 44, 64))
    line(d, [(16, 16), (16, 17)], (240, 200, 80))
    return img


def i_elephant():
    img, d = badge(TECH_RIM["ten_shadows"], (16, 26, 46))
    d.ellipse((9, 7, 23, 20), fill=(140, 150, 170, 255))
    d.ellipse((4, 8, 11, 19), fill=(120, 130, 150, 255))
    d.ellipse((21, 8, 28, 19), fill=(120, 130, 150, 255))
    d.rectangle((14, 17, 17, 25), fill=(140, 150, 170, 255))
    d.rectangle((15, 25, 18, 26), fill=(140, 150, 170, 255))
    d.point([(13, 12), (19, 12)], fill=(20, 20, 30, 255))
    line(d, [(12, 19), (11, 22)], (240, 236, 220))
    line(d, [(20, 19), (21, 22)], (240, 236, 220))
    for x, y in ((7, 23), (24, 23), (10, 27), (22, 27)):
        d.point([(x, y), (x, y + 1)], fill=(90, 170, 255, 255))
    return img


def i_garden():
    img, d = badge(TECH_RIM["ten_shadows"], (10, 6, 16))
    for r in (12, 9, 6):
        d.ellipse((16 - r, 22 - r // 3, 16 + r, 22 + r // 3), outline=(110, 70, 170, 255))
    for x, h in ((9, 8), (13, 12), (19, 11), (23, 7)):   # shadow hands rising
        d.rectangle((x, 21 - h, x + 1, 21), fill=(20, 14, 30, 255))
        d.point([(x - 1, 21 - h), (x + 2, 21 - h)], fill=(20, 14, 30, 255))
    d.point([(10, 15), (20, 12)], fill=(250, 220, 90, 255))
    return img


def speech_mouth(d):
    """Inumaki's seal: a mouth with the snake-and-fang marks at its corners."""
    poly(d, [(9, 18), (23, 18), (21, 21), (11, 21)], (120, 20, 30))
    line(d, [(9, 18), (23, 18)], (40, 10, 14))
    for x in (7, 24):
        line(d, [(x, 17), (x, 22)], (60, 190, 170))
        d.point([(x - 1, 22), (x + 1, 22)], fill=(60, 190, 170, 255))
    d.ellipse((14, 11, 17, 14), outline=(60, 190, 170, 255))


def i_dont_move():
    img, d = badge(TECH_RIM["cursed_speech"])
    speech_mouth(d)
    d.rectangle((8, 6, 23, 8), fill=(240, 240, 240, 255))
    d.rectangle((9, 7, 22, 7), fill=(200, 40, 40, 255))
    return img


def i_blast():
    img, d = badge(TECH_RIM["cursed_speech"])
    speech_mouth(d)
    for r in (4, 7, 10):
        d.arc((16 - r, 9 - r, 16 + r, 9 + r), 200, 340, fill=(220, 250, 245, 255))
    return img


def i_crush():
    img, d = badge(TECH_RIM["cursed_speech"])
    speech_mouth(d)
    poly(d, [(12, 4), (20, 4), (20, 8), (23, 8), (16, 14), (9, 8), (12, 8)], (240, 240, 245))
    return img


def i_twist():
    img, d = badge(TECH_RIM["cursed_speech"], (10, 30, 30))
    speech_mouth(d)
    for k in range(40):
        a = k * 0.42
        r = 1 + k * 0.17
        d.point((int(16 + math.cos(a) * r), int(9 + math.sin(a) * r * 0.6)), fill=(230, 255, 250, 255))
    return img


def drop(d, cx, cy, s, col=(200, 16, 30)):
    poly(d, [(cx, cy - 2 * s), (cx + s, cy), (cx + s, cy + s // 2), (cx, cy + s), (cx - s, cy + s // 2), (cx - s, cy)], col)
    d.point((cx - max(1, s // 2), cy), fill=(255, 140, 140, 255))


def i_pierce():
    img, d = badge(TECH_RIM["blood"], (30, 8, 12))
    line(d, [(5, 26), (27, 6)], (220, 20, 36), 3)
    line(d, [(6, 26), (27, 7)], (255, 120, 120))
    drop(d, 9, 13, 3)
    return img


def i_convergence():
    img, d = badge(TECH_RIM["blood"], (30, 8, 12))
    drop(d, 16, 16, 7)
    poly(d, [(16, 4), (20, 9), (12, 9)], (255, 220, 220))
    return img


def i_supernova():
    img, d = badge(TECH_RIM["blood"], (30, 8, 12))
    for k in range(8):
        a = k * math.pi / 4
        drop(d, int(16 + math.cos(a) * 9), int(16 + math.sin(a) * 9), 2)
    ball(d, 16, 16, 5, (150, 10, 20), (255, 90, 90))
    return img


def i_red_scale():
    img, d = badge(TECH_RIM["blood"], (30, 8, 12))
    for i, y in enumerate((24, 18, 12)):
        poly(d, [(8, y), (16, y - 5), (24, y), (24, y + 2), (16, y - 3), (8, y + 2)], (230, 30 + i * 30, 40 + i * 20))
    drop(d, 16, 7, 2, (255, 60, 60))
    return img


def hands(d, gap, col=(240, 200, 170)):
    for side in (-1, 1):
        x0 = 16 + side * gap
        poly(d, [(x0, 9), (x0 + side * 5, 10), (x0 + side * 6, 22), (x0 + side * 2, 25), (x0, 23)], col)
        line(d, [(x0 + side * 2, 11), (x0 + side * 2, 21)], shade(col, 0.8))


def i_swap():
    img, d = badge(TECH_RIM["boogie"])
    line(d, [(7, 12), (24, 12)], (255, 230, 150), 2)
    poly(d, [(24, 8), (28, 12), (24, 16)], (255, 230, 150))
    line(d, [(8, 20), (25, 20)], (255, 230, 150), 2)
    poly(d, [(8, 16), (4, 20), (8, 24)], (255, 230, 150))
    return img


def i_feint():
    img, d = badge(TECH_RIM["boogie"])
    hands(d, 3)
    for y in (6, 26):
        line(d, [(14, y), (18, y)], (255, 230, 150))
    return img


def i_clap():
    img, d = badge(TECH_RIM["boogie"])
    hands(d, 0)
    for k in range(-2, 3):
        a = math.pi * 1.5 + k * 0.45
        line(d, [(16 + math.cos(a) * 9, 16 + math.sin(a) * 9), (16 + math.cos(a) * 13, 16 + math.sin(a) * 13)], (255, 240, 180))
    return img


def bolt(d, pts, col, glow):
    line(d, pts, glow, 3)
    line(d, pts, col, 1)


def i_black_flash_swap():
    img, d = badge(TECH_RIM["boogie"], (40, 6, 10))
    bolt(d, [(6, 8), (14, 14), (11, 17), (20, 21), (17, 24), (26, 27)], (10, 6, 10), (220, 20, 40))
    bolt(d, [(25, 5), (19, 11), (22, 13), (15, 18)], (10, 6, 10), (220, 20, 40))
    return img


def doll(d, cx, cy, col=(214, 182, 108), dark=(150, 118, 60)):
    """A little straw doll: round head, arms out, a bound waist."""
    d.ellipse((cx - 3, cy - 9, cx + 3, cy - 3), fill=col + (255,))
    d.rectangle((cx - 7, cy - 2, cx + 7, cy), fill=col + (255,))
    poly(d, [(cx - 3, cy - 3), (cx + 3, cy - 3), (cx + 4, cy + 8), (cx - 4, cy + 8)], col)
    line(d, [(cx - 3, cy + 3), (cx + 3, cy + 3)], dark)
    for x in (cx - 6, cx + 6):
        d.point((x, cy - 1), fill=dark + (255,))


def nail(d, x0, y0, x1, y1, col=(190, 196, 206)):
    line(d, [(x0, y0), (x1, y1)], col)
    d.rectangle((x0 - 1, y0 - 1, x0 + 1, y0 + 1), fill=shade(col, 0.7))


def i_hairpin():
    img, d = badge(TECH_RIM["straw_doll"])
    for (x0, y0), (x1, y1) in (((8, 22), (14, 9)), ((11, 24), (21, 10)), ((15, 25), (25, 13))):
        nail(d, x0, y0, x1, y1)
        d.point([(x1, y1 - 1), (x1 + 1, y1)], fill=(255, 200, 90, 255))
    return img


def i_resonance():
    img, d = badge(TECH_RIM["straw_doll"], (30, 16, 12))
    for r in (11, 8):
        d.arc((16 - r, 16 - r, 16 + r, 16 + r), 0, 360, fill=(200, 40, 40, 255))
    doll(d, 16, 17)
    nail(d, 21, 9, 13, 18)
    return img


def i_nail_barrage():
    img, d = badge(TECH_RIM["straw_doll"])
    for k in range(8):
        a = k * math.pi / 4
        nail(d, int(16 + math.cos(a) * 12), int(16 + math.sin(a) * 12), int(16 + math.cos(a) * 7), int(16 + math.sin(a) * 7))
    d.rectangle((12, 11, 20, 16), fill=(60, 60, 70, 255))                     # the hammer
    d.rectangle((12, 11, 20, 12), fill=(120, 120, 130, 255))
    d.rectangle((15, 16, 17, 24), fill=(130, 84, 44, 255))
    return img


def i_cursed_doll():
    img, d = badge(TECH_RIM["straw_doll"], (36, 8, 24))
    d.ellipse((7, 7, 25, 25), fill=(90, 16, 40, 255))
    doll(d, 16, 17, (230, 170, 120), (140, 60, 40))
    for x0, y0, x1, y1 in ((22, 8, 15, 16), (9, 9, 15, 15), (24, 20, 18, 19)):
        nail(d, x0, y0, x1, y1)
    return img


def i_seven_three():
    img, d = badge(TECH_RIM["ratio"])
    d.rectangle((8, 6, 23, 25), outline=(230, 220, 190, 255))
    d.rectangle((9, 7, 22, 24), fill=(54, 48, 40, 255))
    y = 7 + int(17 * 0.7)
    line(d, [(6, y), (25, y)], (255, 210, 80))
    poly(d, [(16, y - 3), (19, y), (16, y + 3), (13, y)], (255, 240, 170))
    return img


def i_flurry():
    img, d = badge(TECH_RIM["ratio"])
    poly(d, [(8, 24), (21, 8), (24, 11), (11, 27)], (214, 206, 186))           # a blunt sword wrapped in cloth
    for x, y in ((12, 21), (16, 16), (20, 11)):
        d.point((x, y), fill=(40, 40, 50, 255))
    for k in range(3):
        line(d, [(18 + k * 3, 24), (26 + k, 18 - k * 2)], (255, 255, 255))
    return img


def i_overtime():
    img, d = badge(TECH_RIM["ratio"], (24, 20, 16))
    d.ellipse((7, 7, 24, 24), fill=(236, 230, 214, 255))
    d.ellipse((7, 7, 24, 24), outline=(90, 80, 60, 255))
    for k in range(12):
        a = k * math.pi / 6
        d.point((int(15.5 + math.cos(a) * 7), int(15.5 + math.sin(a) * 7)), fill=(90, 80, 60, 255))
    line(d, [(16, 16), (16, 10)], (40, 40, 50))
    line(d, [(16, 16), (21, 18)], (200, 30, 40))
    return img


def i_collapse():
    img, d = badge(TECH_RIM["ratio"], (34, 30, 26))
    d.rectangle((5, 17, 26, 25), fill=(120, 110, 98, 255))
    for (x0, y0), (x1, y1) in (((16, 17), (10, 25)), ((16, 17), (21, 25)), ((16, 17), (6, 19)), ((16, 17), (26, 20))):
        line(d, [(x0, y0), (x1, y1)], (40, 34, 30))
    for x, y in ((9, 12), (21, 10), (14, 8), (25, 14)):
        d.rectangle((x, y, x + 1, y + 1), fill=(150, 140, 126, 255))
    poly(d, [(14, 4), (18, 4), (17, 14), (15, 14)], (255, 220, 120))
    return img


def i_rct():
    img, d = badge(TECH_RIM["universal"], (24, 40, 30))
    poly(d, [(16, 26), (6, 15), (6, 10), (9, 7), (13, 7), (16, 10), (19, 7), (23, 7), (26, 10), (26, 15)], (250, 250, 240))
    d.rectangle((15, 11, 16, 20), fill=(60, 200, 110, 255))
    d.rectangle((11, 15, 20, 16), fill=(60, 200, 110, 255))
    return img


def i_simple_domain():
    img, d = badge(TECH_RIM["universal"], (20, 26, 40))
    d.ellipse((5, 17, 26, 26), outline=(140, 210, 255, 255))
    d.ellipse((7, 18, 24, 25), outline=(80, 150, 220, 255))
    line(d, [(16, 5), (16, 21)], (230, 230, 240))         # a sheathed blade standing in the circle
    line(d, [(13, 9), (19, 9)], (200, 170, 80))
    d.rectangle((15, 5, 16, 8), fill=(40, 40, 50, 255))
    return img


def i_playful_cloud():
    img, d = canvas()
    segs = [((4, 28), (11, 21)), ((12, 20), (19, 13)), ((20, 12), (27, 5))]
    for a, b in segs:
        line(d, [a, b], (200, 30, 40), 3)
        line(d, [(a[0] + 1, a[1] - 1), (b[0], b[1] - 1)], (250, 90, 90))
    for x, y in ((11, 21), (19, 13), (4, 28), (27, 5)):
        d.rectangle((x - 1, y - 1, x + 1, y + 1), fill=(230, 190, 70, 255))
    line(d, [(11, 20), (12, 20)], (60, 60, 60))
    return outline(img)


def i_inverted_spear():
    img, d = canvas()
    line(d, [(5, 27), (16, 16)], (40, 34, 44), 2)
    line(d, [(6, 25), (14, 17)], (90, 80, 100))
    poly(d, [(15, 15), (27, 4), (22, 15), (19, 15)], (200, 206, 220))     # the blade, wide and hooked
    poly(d, [(19, 15), (22, 15), (25, 19), (21, 18)], (170, 176, 196))
    line(d, [(16, 15), (26, 5)], (250, 252, 255))
    d.rectangle((13, 16, 16, 19), fill=(150, 40, 50, 255))
    for x, y in ((4, 28), (3, 29)):
        d.point((x, y), fill=(150, 150, 160, 255))
    return outline(img)


def i_split_soul():
    img, d = canvas()
    line(d, [(7, 25), (27, 5)], (200, 214, 236), 3)
    line(d, [(8, 25), (27, 6)], (250, 252, 255))
    line(d, [(6, 24), (26, 4)], (120, 150, 210))
    poly(d, [(5, 21), (9, 21), (11, 23), (11, 27), (7, 25)], (60, 50, 70))   # wide square guard
    line(d, [(2, 30), (7, 25)], (40, 30, 40), 3)
    line(d, [(3, 30), (7, 26)], (180, 40, 50))
    return outline(img)


def i_dragon_bone():
    img, d = canvas()
    poly(d, [(9, 22), (24, 5), (28, 4), (27, 8), (12, 25)], (70, 66, 76))          # a broad dark blade
    line(d, [(11, 23), (26, 6)], (150, 146, 160))
    for k in range(5):                                                               # bone serrations on its back
        x, y = 13 + k * 3, 20 - k * 3
        d.point([(x - 1, y - 2), (x, y - 3)], fill=(236, 228, 206, 255))
    poly(d, [(6, 20), (10, 18), (14, 22), (12, 26)], (226, 214, 186))               # bone guard
    line(d, [(3, 29), (9, 23)], (90, 60, 40), 3)
    line(d, [(4, 29), (9, 24)], (160, 120, 80))
    return outline(img)


def i_record():
    img, d = canvas()
    d.rectangle((6, 4, 25, 28), fill=(28, 34, 70, 255))
    d.rectangle((6, 4, 8, 28), fill=(16, 20, 44, 255))
    d.rectangle((24, 5, 26, 27), fill=(236, 230, 210, 255))
    d.ellipse((11, 11, 22, 20), fill=(200, 170, 70, 255))
    d.ellipse((13, 12, 20, 19), fill=(28, 34, 70, 255))
    d.ellipse((15, 14, 18, 17), fill=(200, 40, 50, 255))
    line(d, [(11, 24), (22, 24)], (200, 170, 70))
    line(d, [(11, 7), (22, 7)], (200, 170, 70))
    return outline(img)


def i_finger():
    img, d = canvas()
    pts = [(7, 27), (10, 22), (12, 17), (15, 12), (19, 8), (23, 5)]
    for i, (a, b) in enumerate(zip(pts, pts[1:])):
        line(d, [a, b], (120, 92, 80) if i % 2 else (104, 78, 68), 5)
    for x, y in pts[1:-1]:   # knuckle wrinkles and the bindings
        line(d, [(x - 2, y - 1), (x + 2, y + 1)], (60, 40, 36))
    line(d, [(9, 25), (12, 27)], (150, 30, 40), 2)
    poly(d, [(22, 3), (28, 2), (25, 7)], (20, 14, 16))           # long black nail
    line(d, [(23, 4), (26, 3)], (90, 80, 90))
    return outline(img)


def i_womb():
    img, d = canvas()
    d.ellipse((6, 4, 26, 28), fill=(110, 20, 34, 255))
    d.ellipse((8, 6, 24, 26), fill=(140, 30, 46, 255))
    for k in range(30):
        a = k * 0.38
        r = 1 + k * 0.28
        d.point((int(16 + math.cos(a) * r), int(16 + math.sin(a) * r)), fill=(70, 10, 20, 255))
    d.ellipse((13, 13, 19, 19), fill=(250, 230, 120, 255))
    d.rectangle((15, 13, 16, 18), fill=(20, 10, 10, 255))
    d.point((10, 9), fill=(230, 120, 130, 255))
    return outline(img)


# ---------------------------------------------------------------------------
# What every item is
# ---------------------------------------------------------------------------
TECH_COL = {"limitless": "§b", "shrine": "§c", "ten_shadows": "§5", "cursed_speech": "§3", "blood": "§4", "boogie": "§6",
            "heavenly": "§e", "universal": "§f", "straw_doll": "§6", "ratio": "§9"}
TECH_NAME = {"limitless": "Limitless", "shrine": "Shrine", "ten_shadows": "Ten Shadows", "cursed_speech": "Cursed Speech",
             "blood": "Blood Manipulation", "boogie": "Boogie Woogie", "heavenly": "Heavenly Restriction", "universal": "Jujutsu",
             "straw_doll": "Straw Doll", "ratio": "Ratio"}
MOVES = {  # id: (name, technique, line of lore, icon)
    "blue": ("Blue", "limitless", "Pulls everything to a point ahead and crushes it", i_blue),
    "red": ("Red", "limitless", "A blast of repulsion that hurls enemies away", i_red),
    "hollow_purple": ("Hollow Purple", "limitless", "Blue and Red collide: imaginary mass erases a path", i_purple),
    "unlimited_void": ("Domain Expansion: Unlimited Void", "limitless", "Everyone inside is frozen by infinite information", i_void),
    "dismantle": ("Dismantle", "shrine", "A flying slash that cuts everything in a line", i_dismantle),
    "cleave": ("Cleave", "shrine", "Cuts the target in front, harder the tougher they are", i_cleave),
    "fuga": ("Fuga (Open)", "shrine", "A flame arrow that explodes into a sea of fire", i_fuga),
    "malevolent_shrine": ("Domain Expansion: Malevolent Shrine", "shrine", "No barrier, no escape: endless slashes", i_shrine),
    "summon_divine_dogs": ("Divine Dogs", "ten_shadows", "Summon the white and black shikigami wolves", i_dogs),
    "summon_nue": ("Nue", "ten_shadows", "A winged shikigami that strikes from above", i_nue),
    "summon_max_elephant": ("Max Elephant", "ten_shadows", "Drop a colossal elephant from the sky", i_elephant),
    "chimera_shadow_garden": ("Domain Expansion: Chimera Shadow Garden", "ten_shadows", "Flood the ground with shadow", i_garden),
    "speech_dont_move": ("\"Don't Move\"", "cursed_speech", "Freezes everyone in front of you in place", i_dont_move),
    "speech_blast_away": ("\"Blast Away\"", "cursed_speech", "Blows enemies back with your voice", i_blast),
    "speech_crush": ("\"Crush\"", "cursed_speech", "Crushes the target with a single word", i_crush),
    "speech_twist": ("Maximum: \"Twist\"", "cursed_speech", "Everyone nearby is wrung out — costs your throat", i_twist),
    "piercing_blood": ("Piercing Blood", "blood", "A hypersonic beam of compressed blood", i_pierce),
    "convergence": ("Convergence", "blood", "Blood rushes through you: speed and strength", i_convergence),
    "supernova": ("Supernova", "blood", "Blood orbs burst in every direction", i_supernova),
    "flowing_red_scale_stack": ("Flowing Red Scale: Stack", "blood", "Push your body far beyond its limits", i_red_scale),
    "boogie_swap": ("Boogie Woogie", "boogie", "Clap: swap places with whoever you're looking at", i_swap),
    "boogie_feint": ("Feint", "boogie", "Clap without swapping — everyone around flinches", i_feint),
    "clap_barrage": ("Clap Barrage", "boogie", "Swap and strike, swap and strike", i_clap),
    "black_flash_swap": ("Vibe Swap: Black Flash", "boogie", "Swap behind them and land a sure Black Flash", i_black_flash_swap),
    "straw_hairpin": ("Hairpin", "straw_doll", "Three nails — and every one that sticks bursts", i_hairpin),
    "straw_resonance": ("Resonance", "straw_doll", "Strike the doll: the last one you hurt feels it", i_resonance),
    "straw_nail_barrage": ("Nail Barrage", "straw_doll", "Slam the hammer: nails in every direction", i_nail_barrage),
    "straw_cursed_doll": ("Resonance: Cursed Doll", "straw_doll", "Everyone you've hurt lately takes the blow", i_cursed_doll),
    "ratio_seven_three": ("7:3", "ratio", "Strike the 7:3 point for a critical hit", i_seven_three),
    "ratio_flurry": ("Blunt Sword Flurry", "ratio", "Three blows; the last one finds the weak point", i_flurry),
    "ratio_overtime": ("Overtime", "ratio", "A binding vow: after hours, you hit much harder", i_overtime),
    "ratio_collapse": ("Extension: Collapse", "ratio", "Shatter everything around the point you strike", i_collapse),
    "reverse_cursed_technique": ("Reverse Cursed Technique", "universal", "Turn cursed energy positive and heal", i_rct),
    "simple_domain": ("Simple Domain", "universal", "A small barrier that neutralises a domain's sure-hit", i_simple_domain),
}
TOOLS = {  # Heavenly Restriction: cursed tools (real melee weapons) — id: (name, damage, lore, icon)
    "playful_cloud": ("Playful Cloud", 9, "A three-section staff: pure physical force", i_playful_cloud),
    "dragon_bone": ("Dragon-Bone", 8, "Stores the impact of every blow you take", i_dragon_bone),
    "inverted_spear_of_heaven": ("Inverted Spear of Heaven", 8, "Forcibly nullifies any cursed technique it touches", i_inverted_spear),
    "split_soul_katana": ("Split Soul Katana", 11, "Cuts the soul directly, ignoring the body's toughness", i_split_soul),
}
MISC = {  # id: (display name, icon, extra components)
    "jujutsu_record": ("§dJujutsu Record§r\n§7Your clan, technique, grade and moves\n§8Jujutsu Legacy by errorlegend", i_record, {"minecraft:glint": True}),
    "sukuna_finger": ("§4Sukuna's Finger§r\n§7Eat it: more cursed energy, more power", i_finger,
                      {"minecraft:glint": True, "minecraft:max_stack_size": 20}),
    "cursed_womb": ("§5Cursed Womb§r\n§7Reawaken: a new random innate technique", i_womb, {"minecraft:glint": True}),
}

textures = {}


def item(iid, name, extra, category="equipment", icon_fn=None):
    if icon_fn:
        icon_fn().save(ICONS / f"{iid}.png")
    textures[f"jjk_{iid}"] = {"textures": f"textures/items/jjk/{iid}"}
    comps = {"minecraft:icon": {"textures": {"default": f"jjk_{iid}"}}, "minecraft:display_name": {"value": name},
             "minecraft:max_stack_size": 1, "minecraft:can_destroy_in_creative": False}
    comps.update(extra)
    w(BP / "items" / f"{iid}.json", {"format_version": "1.21.60", "minecraft:item": {
        "description": {"identifier": f"jjk:{iid}", "menu_category": {"category": category}}, "components": comps}})


USE = {"minecraft:use_modifiers": {"use_duration": 0.25, "movement_modifier": 1.0}, "minecraft:use_animation": "none"}
for iid, (name, tech, lore, fn) in MOVES.items():
    item(iid, f"{TECH_COL[tech]}{name}§r\n§8{TECH_NAME[tech]}\n§7{lore}", {**USE, "minecraft:cooldown": {"category": f"jjk_{iid}", "duration": 0.1}},
         icon_fn=fn)
for iid, (name, dmg, lore, fn) in TOOLS.items():
    item(iid, f"§e{name}§r\n§8Cursed Tool\n§7{lore}", {**USE, "minecraft:hand_equipped": True, "minecraft:damage": dmg,
                                                        "minecraft:durability": {"max_durability": 9999},
                                                        "minecraft:enchantable": {"slot": "sword", "value": 14},
                                                        "minecraft:cooldown": {"category": f"jjk_{iid}", "duration": 0.1}},
         icon_fn=fn)
for iid, (name, fn, extra) in MISC.items():
    item(iid, name, {**USE, **extra}, category="items" if iid != "jujutsu_record" else "equipment", icon_fn=fn)

w(RP / "textures" / "item_texture.json", {"resource_pack_name": "jujutsu_legacy", "texture_name": "atlas.items", "texture_data": textures})


# ---------------------------------------------------------------------------
# Pack icons: Blue and Red colliding into Hollow Purple
# ---------------------------------------------------------------------------
def pack_icon():
    S = 256
    img = Image.new("RGBA", (S, S), (12, 8, 22, 255))
    px = img.load()
    rnd = random.Random(9)
    for x in range(S):
        for y in range(S):
            def glow(cx, cy, r):
                d2 = ((x - cx) ** 2 + (y - cy) ** 2) / (r * r)
                return math.exp(-d2 * 2.2)
            b, r_, p = glow(70, 118, 60), glow(186, 118, 60), glow(128, 112, 46)
            col = [12 + 40 * b + 230 * r_ + 170 * p, 8 + 120 * b + 40 * r_ + 60 * p, 22 + 255 * b + 40 * r_ + 255 * p]
            if rnd.random() < 0.004:
                col = [200, 200, 230]
            px[x, y] = tuple(max(0, min(255, int(v))) for v in col) + (255,)
    d = ImageDraw.Draw(img)
    for (cx, cy, rr, c) in ((70, 118, 30, (120, 200, 255)), (186, 118, 30, (255, 120, 110)), (128, 112, 24, (235, 200, 255))):
        d.ellipse((cx - rr, cy - rr, cx + rr, cy + rr), fill=c + (255,))
        d.ellipse((cx - rr + 8, cy - rr + 8, cx - rr + 20, cy - rr + 20), fill=(255, 255, 255, 255))
    font = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf", 30)
    small_font = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf", 15)
    for text, y, f in (("JUJUTSU", 166, font), ("LEGACY", 197, font), ("by errorlegend", 234, small_font)):
        tw = d.textlength(text, font=f)
        d.text(((S - tw) / 2 + 2, y + 2), text, font=f, fill=(0, 0, 0, 255))
        d.text(((S - tw) / 2, y), text, font=f, fill=(236, 230, 255, 255) if f is font else (210, 160, 255, 255))
    small = img.resize((64, 64), Image.LANCZOS).resize((256, 256), Image.NEAREST)   # a crisp pixel-art finish
    small.paste(img.crop((0, 160, 256, 256)), (0, 160))
    return small


icon = pack_icon()
icon.save(BP / "pack_icon.png")
icon.save(RP / "pack_icon.png")
print(f"Items: {len(MOVES)} moves, {len(TOOLS)} cursed tools, {len(MISC)} others.")
