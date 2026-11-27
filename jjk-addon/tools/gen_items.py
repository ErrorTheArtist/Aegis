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
            "ratio": (206, 186, 128), "projection": (196, 222, 240), "disaster_flames": (236, 104, 30),
            "idle_transfiguration": (96, 130, 200), "idle_death_gamble": (60, 196, 104), "cursed_spirit": (150, 100, 170),
            "disaster_plants": (96, 176, 72), "disaster_tides": (40, 140, 210), "curse": (150, 30, 60)}


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


# --- Projection Sorcery: film frames ---------------------------------------
def i_fps_rush():
    img, d = badge(TECH_RIM["projection"], (20, 26, 36))
    for x, c in ((4, (70, 80, 96)), (11, (130, 142, 160)), (18, (236, 242, 252))):
        d.rectangle((x, 9, x + 8, 20), outline=c + (255,))
    d.ellipse((21, 11, 24, 14), fill=(236, 242, 252, 255))                  # a figure in the last frame
    line(d, [(22, 15), (22, 17)], (236, 242, 252))
    line(d, [(22, 17), (20, 19)], (236, 242, 252))
    line(d, [(22, 17), (24, 19)], (236, 242, 252))
    line(d, [(5, 24), (24, 24)], (150, 220, 255))
    poly(d, [(23, 22), (26, 24), (23, 26)], (150, 220, 255))
    return img


def i_frame_freeze():
    img, d = badge(TECH_RIM["projection"], (20, 26, 36))
    d.rectangle((7, 6, 24, 25), fill=(236, 242, 252, 255))
    d.rectangle((9, 8, 22, 23), fill=(40, 54, 76, 255))
    for y in (10, 14, 18, 22):                                             # sprocket holes on the frame's edges
        d.point([(8, y), (23, y)], fill=(40, 54, 76, 255))
    d.ellipse((14, 10, 17, 13), fill=(150, 200, 240, 255))                 # the one caught in the frame
    d.rectangle((14, 14, 17, 18), fill=(150, 200, 240, 255))
    line(d, [(13, 14), (11, 17)], (150, 200, 240))
    line(d, [(18, 14), (20, 17)], (150, 200, 240))
    line(d, [(15, 19), (14, 22)], (150, 200, 240))
    line(d, [(16, 19), (17, 22)], (150, 200, 240))
    d.point([(11, 10), (20, 20), (19, 11)], fill=(255, 255, 255, 255))
    return img


def i_accel_barrage():
    img, d = badge(TECH_RIM["projection"], (20, 26, 36))
    for dx, c in ((-6, (90, 100, 118)), (-3, (150, 160, 178)), (0, (240, 204, 172))):
        d.rectangle((15 + dx, 11, 23 + dx, 19), fill=c + (255,))            # the fist and its after-images
        d.rectangle((12 + dx, 13, 15 + dx, 18), fill=c + (255,))
    for y in (13, 15, 17):
        line(d, [(20, y), (23, y)], (170, 128, 106))                          # curled fingers
    line(d, [(15, 11), (15, 19)], (200, 160, 130))
    for y in (8, 22, 25):
        line(d, [(5, y), (14, y)], (236, 242, 252))
    return img


def i_moon_palace():
    img, d = badge(TECH_RIM["projection"], (12, 12, 24))
    d.ellipse((8, 5, 23, 20), fill=(226, 228, 236, 255))
    for x, y, r in ((12, 9, 2), (18, 13, 3), (13, 15, 1)):
        d.ellipse((x - r, y - r, x + r, y + r), fill=(186, 188, 200, 255))
    d.rectangle((4, 21, 27, 26), fill=(30, 30, 36, 255))                     # a strip of film under the moon
    for x in range(6, 27, 3):
        d.point([(x, 22), (x, 25)], fill=(226, 228, 236, 255))
    for x in (11, 19):
        line(d, [(x, 23), (x, 24)], (110, 112, 124))
    return img


# --- Disaster Flames ---------------------------------------------------------
def flame(d, cx, cy, s, outer=(236, 80, 20), mid_=(255, 150, 40), core=(255, 232, 150)):
    poly(d, [(cx - s, cy + s), (cx, cy - 2 * s), (cx + s, cy + s)], outer)
    d.ellipse((cx - s, cy - s // 2, cx + s, cy + s + 1), fill=outer + (255,))
    d.ellipse((cx - s + 1, cy, cx + s - 1, cy + s), fill=mid_ + (255,))
    d.point((cx, cy + s // 2), fill=core + (255,))


def i_ember_insects():
    img, d = badge(TECH_RIM["disaster_flames"], (36, 14, 8))
    for cx, cy in ((10, 21), (17, 11), (23, 20)):
        line(d, [(cx - 5, cy + 4), (cx - 1, cy + 1)], (180, 40, 20))          # their burning trails
        d.ellipse((cx - 2, cy - 2, cx + 3, cy + 2), fill=(255, 150, 40, 255))
        d.point([(cx, cy), (cx + 1, cy)], fill=(255, 236, 160, 255))
        d.point([(cx - 2, cy - 3), (cx + 3, cy - 3)], fill=(255, 210, 120, 255))  # little wings of flame
    return img


def i_fire_stream():
    img, d = badge(TECH_RIM["disaster_flames"], (36, 14, 8))
    poly(d, [(5, 15), (26, 6), (28, 25), (5, 17)], (226, 70, 20))
    poly(d, [(6, 15), (24, 10), (25, 22), (6, 17)], (255, 150, 40))
    poly(d, [(7, 16), (20, 13), (21, 19)], (255, 232, 150))
    for x, y in ((24, 8), (27, 15), (25, 23)):
        d.point((x, y), fill=(255, 210, 120, 255))
    return img


def i_meteor():
    img, d = badge(TECH_RIM["disaster_flames"], (30, 12, 10))
    poly(d, [(9, 15), (25, 4), (28, 7), (17, 23)], (226, 80, 20))           # the flaming tail
    poly(d, [(11, 16), (24, 7), (26, 9), (16, 21)], (255, 170, 60))
    d.ellipse((6, 14, 18, 26), fill=(80, 56, 44, 255))                       # the burning mountain
    d.ellipse((7, 15, 15, 22), fill=(110, 80, 60, 255))
    line(d, [(9, 19), (12, 21), (15, 19)], (255, 140, 40))
    line(d, [(12, 16), (11, 18)], (255, 140, 40))
    return img


def i_iron_mountain():
    img, d = badge(TECH_RIM["disaster_flames"], (40, 14, 8))
    poly(d, [(4, 26), (12, 13), (20, 13), (28, 26)], (70, 56, 52))
    poly(d, [(12, 13), (20, 13), (18, 15), (14, 15)], (255, 140, 40))
    line(d, [(15, 15), (12, 21), (13, 26)], (255, 120, 30))                  # lava running down
    line(d, [(18, 15), (21, 20), (23, 26)], (255, 120, 30))
    for x, y in ((14, 9), (17, 6), (19, 10), (12, 5), (21, 7)):
        d.rectangle((x, y, x + 1, y + 1), fill=(255, 190, 70, 255))
    return img


# --- Idle Transfiguration ----------------------------------------------------
def i_soul_touch():
    img, d = badge(TECH_RIM["idle_transfiguration"], (14, 18, 38))
    d.arc((4, 4, 27, 27), 0, 360, fill=(90, 170, 255, 255))
    d.rectangle((11, 14, 20, 23), fill=(200, 206, 220, 255))                   # an open hand
    for x, top in ((11, 9), (13, 7), (16, 7), (19, 9)):
        d.rectangle((x, top, x + 1, 14), fill=(200, 206, 220, 255))
    poly(d, [(20, 17), (24, 13), (25, 15), (21, 20)], (200, 206, 220))
    line(d, [(11, 19), (20, 19)], (60, 60, 80))                                # stitches across the palm
    for x in (12, 15, 18):
        line(d, [(x, 18), (x, 20)], (60, 60, 80))
    return img


def i_body_repel():
    img, d = badge(TECH_RIM["idle_transfiguration"], (14, 18, 38))
    for k in range(8):
        a = k * math.pi / 4 + 0.39
        poly(d, [(16 + math.cos(a - 0.35) * 5, 16 + math.sin(a - 0.35) * 5), (16 + math.cos(a) * 13, 16 + math.sin(a) * 13),
                 (16 + math.cos(a + 0.35) * 5, 16 + math.sin(a + 0.35) * 5)], (226, 230, 240))
    d.ellipse((11, 11, 20, 20), fill=(190, 196, 214, 255))
    line(d, [(12, 15), (19, 16)], (60, 60, 80))
    return img


def i_isomer():
    img, d = badge(TECH_RIM["idle_transfiguration"], (14, 18, 38))
    body = (170, 176, 200)
    d.ellipse((6, 6, 12, 12), fill=body + (255,))                               # a tall one with a lopsided head
    poly(d, [(7, 12), (12, 12), (13, 24), (6, 24)], body)
    line(d, [(6, 13), (3, 21)], body)
    line(d, [(12, 13), (15, 18)], body)
    d.point([(8, 9), (11, 8)], fill=(20, 20, 30, 255))
    d.ellipse((18, 11, 26, 18), fill=shade(body, 0.85))                          # a squat one, all mouth
    poly(d, [(19, 18), (26, 18), (25, 25), (20, 25)], shade(body, 0.85))
    line(d, [(19, 15), (25, 15)], (30, 10, 20))
    d.point([(20, 16), (22, 16), (24, 16)], fill=(240, 236, 220, 255))
    return img


def i_perfection():
    img, d = badge(TECH_RIM["idle_transfiguration"], (12, 14, 34))
    for k in range(6):                                                           # hands reaching in from every side
        a = k * math.pi / 3 - math.pi / 2
        cx, cy = 16 + math.cos(a) * 9, 16 + math.sin(a) * 9
        d.ellipse((cx - 2, cy - 2, cx + 2, cy + 2), fill=(200, 206, 222, 255))
        for s in (-0.4, 0, 0.4):
            line(d, [(cx, cy), (cx + math.cos(a + s) * 4, cy + math.sin(a + s) * 4)], (200, 206, 222))
    d.ellipse((12, 12, 19, 19), fill=(110, 140, 210, 255))
    line(d, [(12, 16), (19, 15)], (30, 30, 50))
    return img


# --- Idle Death Gamble --------------------------------------------------------
def i_rough_energy():
    img, d = badge(TECH_RIM["idle_death_gamble"], (10, 30, 20))
    pts, inner = [], []
    for k in range(16):
        a = k * math.pi / 8
        r = 12 if k % 2 == 0 else 5
        pts.append((16 + math.cos(a) * r, 16 + math.sin(a) * r))
        inner.append((16 + math.cos(a) * r * 0.55, 16 + math.sin(a) * r * 0.55))
    poly(d, pts, (110, 236, 150))
    poly(d, inner, (226, 255, 226))
    return img


def i_shutter_doors():
    img, d = badge(TECH_RIM["idle_death_gamble"], (10, 30, 20))
    d.rectangle((5, 6, 26, 7), fill=(90, 96, 106, 255))
    for x0, x1 in ((5, 14), (17, 26)):
        d.rectangle((x0, 8, x1, 25), fill=(184, 190, 200, 255))
        for y in range(10, 25, 3):
            line(d, [(x0, y), (x1, y)], (120, 126, 136))
    line(d, [(15, 8), (15, 25)], (130, 255, 170))
    line(d, [(16, 8), (16, 25)], (60, 200, 110))
    return img


def i_pachinko():
    img, d = badge(TECH_RIM["idle_death_gamble"], (10, 30, 20))
    for cx, cy in ((10, 10), (19, 8), (23, 16), (13, 18), (8, 24), (20, 24), (26, 23)):
        line(d, [(cx - 4, cy - 2), (cx - 2, cy - 1)], (100, 200, 140))
        ball(d, cx, cy, 3, (110, 116, 130), (232, 236, 244))
    return img


def i_jackpot():
    img, d = badge(TECH_RIM["idle_death_gamble"], (12, 36, 22))
    d.rectangle((4, 8, 27, 23), fill=(255, 210, 70, 255))
    for x0 in (5, 13, 21):
        d.rectangle((x0, 10, x0 + 5, 21), fill=(244, 242, 232, 255))
        line(d, [(x0 + 1, 12), (x0 + 4, 12)], (220, 30, 40))                    # a 7 on every reel
        line(d, [(x0 + 4, 12), (x0 + 2, 19)], (220, 30, 40))
    for x in range(6, 27, 4):
        d.point([(x, 25), (x + 2, 6)], fill=(255, 255, 200, 255))
    return img


# --- Cursed Spirit Manipulation -------------------------------------------------
def i_spirit_release():
    img, d = badge(TECH_RIM["cursed_spirit"], (14, 10, 20))
    ball(d, 16, 17, 9, (20, 12, 28), (70, 44, 96), (150, 110, 190))
    for k in range(22):                                                         # the swirl it unrolls from
        a = k * 0.5
        r = 2 + k * 0.32
        d.point((int(16 + math.cos(a) * r), int(17 + math.sin(a) * r)), fill=(150, 100, 200, 255))
    d.ellipse((12, 13, 20, 19), fill=(250, 220, 80, 255))
    line(d, [(16, 13), (16, 19)], (20, 10, 10))
    for x, y in ((6, 9), (25, 8), (26, 21)):
        line(d, [(x, y), (16 + (x - 16) // 2, 17 + (y - 17) // 2)], (90, 60, 120))
    return img


def i_spirit_absorb():
    img, d = badge(TECH_RIM["cursed_spirit"], (14, 10, 20))
    ball(d, 16, 9, 5, (16, 10, 22), (70, 44, 96), (160, 120, 200))
    for y in (16, 18):
        line(d, [(12, y), (16, y + 2), (20, y)], (170, 120, 220))
    poly(d, [(6, 21), (26, 21), (23, 26), (9, 26)], (236, 200, 170))          # a cupped hand
    line(d, [(6, 21), (26, 21)], (200, 160, 130))
    for x in (10, 14, 18, 22):
        d.point((x, 22), fill=(190, 150, 120, 255))
    return img


def i_spirit_swarm():
    img, d = badge(TECH_RIM["cursed_spirit"], (14, 10, 20))
    for (cx, cy), c in (((10, 10), (70, 40, 80)), ((22, 10), (40, 60, 44)), ((10, 21), (60, 50, 34)), ((22, 21), (80, 30, 40))):
        d.ellipse((cx - 4, cy - 3, cx + 4, cy + 4), fill=c + (255,))
        poly(d, [(cx - 4, cy - 1), (cx - 3, cy - 6), (cx - 1, cy - 2)], c)
        poly(d, [(cx + 4, cy - 1), (cx + 3, cy - 6), (cx + 1, cy - 2)], c)
        d.point([(cx - 2, cy), (cx + 2, cy)], fill=(250, 220, 80, 255))
        line(d, [(cx - 2, cy + 2), (cx + 2, cy + 2)], (20, 10, 10))
    return img


def i_uzumaki():
    img, d = badge(TECH_RIM["cursed_spirit"], (10, 6, 16))
    prev = None
    for k in range(60):
        a = k * 0.33
        r = 12 - k * 0.19
        pt = (16 + math.cos(a) * r, 16 + math.sin(a) * r)
        if prev:
            u = k / 60
            line(d, [prev, pt], (int(60 + 180 * u), int(30 + 130 * u), int(90 + 160 * u)), 2)
        prev = pt
    d.ellipse((14, 14, 18, 18), fill=(250, 236, 255, 255))
    return img


def i_mahoraga():
    """The eight-handled wheel over the Divine General's head."""
    img, d = badge(TECH_RIM["ten_shadows"], (10, 6, 16))
    brass, dark = (214, 182, 102), (120, 92, 44)
    for k in range(8):
        a = k * math.pi / 4
        line(d, [(16, 16), (16 + math.cos(a) * 8, 16 + math.sin(a) * 8)], dark)                  # spokes
        hx, hy = 16 + math.cos(a) * 11, 16 + math.sin(a) * 11
        line(d, [(16 + math.cos(a) * 8, 16 + math.sin(a) * 8), (hx, hy)], brass, 2)              # handles
        d.rectangle((hx - 1, hy - 1, hx + 1, hy + 1), fill=brass + (255,))
    d.ellipse((8, 8, 24, 24), outline=brass + (255,), width=2)                                   # the rim
    d.ellipse((13, 13, 19, 19), fill=brass + (255,))                                             # the hub
    d.ellipse((15, 15, 17, 17), fill=dark + (255,))
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


# --- Disaster Plants (Cursed Spirits) ------------------------------------------
def i_cursed_buds():
    img, d = badge(TECH_RIM["disaster_plants"], (14, 30, 14))
    for cx, cy in ((10, 19), (16, 11), (22, 19)):                                  # three buds on short stems
        line(d, [(cx, cy + 3), (cx, cy + 7)], (70, 130, 50))
        d.ellipse((cx - 3, cy - 3, cx + 3, cy + 3), fill=(150, 210, 90, 255))
        d.ellipse((cx - 1, cy - 4, cx + 1, cy - 1), fill=(255, 150, 200, 255))        # a pink tip about to open
        poly(d, [(cx, cy + 5), (cx + 4, cy + 3), (cx + 1, cy + 6)], (90, 170, 60))   # a leaf
    return img


def i_wooden_roots():
    img, d = badge(TECH_RIM["disaster_plants"], (26, 20, 12))
    for x0, lean in ((9, -2), (16, 0), (23, 2)):                                   # roots bursting up out of the ground
        line(d, [(x0, 27), (x0 + lean, 17), (x0 + lean * 2, 8)], (120, 82, 46), 3)
        line(d, [(x0 + lean, 17), (x0 + lean + 3, 13)], (120, 82, 46), 2)
        d.point((x0 + lean * 2, 7), fill=(140, 220, 90, 255))
    poly(d, [(4, 25), (28, 25), (27, 28), (5, 28)], (70, 52, 34))                    # the ground cracking
    return img


def i_flower_field():
    img, d = badge(TECH_RIM["disaster_plants"], (18, 34, 18))
    for cx, cy, col in ((10, 12, (255, 170, 210)), (20, 10, (255, 240, 240)), (15, 19, (255, 200, 90)), (23, 20, (255, 170, 210)), (9, 22, (255, 240, 240))):
        for a in range(5):                                                         # five petals round a yellow heart
            ang = a * 2 * math.pi / 5
            px_, py = cx + math.cos(ang) * 2.4, cy + math.sin(ang) * 2.4
            d.ellipse((px_ - 1.6, py - 1.6, px_ + 1.6, py + 1.6), fill=col + (255,))
        d.point((cx, cy), fill=(255, 220, 60, 255))
    return img


def i_sea_of_light():
    img, d = badge(TECH_RIM["disaster_plants"], (20, 26, 12))
    poly(d, [(7, 24), (27, 6), (29, 9), (10, 27)], (255, 236, 150))                   # the beam
    poly(d, [(9, 24), (27, 8), (28, 9), (10, 25)], (255, 255, 230))
    for a in range(6):                                                             # the flower it grows from
        ang = a * math.pi / 3
        d.ellipse((8 + math.cos(ang) * 3 - 2, 24 + math.sin(ang) * 3 - 2, 8 + math.cos(ang) * 3 + 2, 24 + math.sin(ang) * 3 + 2), fill=(255, 170, 210, 255))
    d.ellipse((6, 22, 10, 26), fill=(255, 220, 60, 255))
    return img


# --- Disaster Tides (Cursed Spirits) -------------------------------------------
def fish_shape(d, cx, cy, s, col):
    d.ellipse((cx - 3 * s, cy - 1.6 * s, cx + 2 * s, cy + 1.6 * s), fill=col + (255,))
    poly(d, [(cx + 1.5 * s, cy), (cx + 4 * s, cy - 2 * s), (cx + 4 * s, cy + 2 * s)], col)
    d.point((round(cx - 2 * s), round(cy - 0.5 * s)), fill=(240, 250, 255, 255))


def i_death_swarm():
    img, d = badge(TECH_RIM["disaster_tides"], (10, 26, 44))
    for cx, cy, s in ((11, 10, 1.3), (20, 15, 1.6), (10, 21, 1.2), (22, 24, 1.0)):
        fish_shape(d, cx, cy, s, (120, 200, 240))
    return img


def i_tidal_wave():
    img, d = badge(TECH_RIM["disaster_tides"], (10, 26, 44))
    d.pieslice((6, 6, 28, 28), 180, 360, fill=(50, 130, 210, 255))                  # the wave curling over
    d.pieslice((10, 10, 24, 24), 180, 360, fill=(10, 26, 44, 255))
    d.chord((4, 5, 28, 29), 0, 180, fill=(50, 130, 210, 255))                       # the sea (inside the seal)
    line(d, [(5, 17), (10, 15), (16, 17), (22, 15), (27, 17)], (225, 245, 255))       # foam
    d.ellipse((22, 8, 26, 12), fill=(225, 245, 255, 255))
    return img


def i_undertow():
    img, d = badge(TECH_RIM["disaster_tides"], (8, 22, 40))
    pts = []
    for k in range(60):                                                            # a whirlpool spiral
        a = k * 0.33
        r = 12 - k * 0.19
        pts.append((16 + math.cos(a) * r, 16 + math.sin(a) * r))
    line(d, pts, (120, 200, 240), 2)
    d.ellipse((14, 14, 18, 18), fill=(10, 30, 60, 255))
    return img


def i_skandha():
    img, d = badge(TECH_RIM["disaster_tides"], (120, 190, 235))
    d.pieslice((3, 3, 29, 29), 0, 180, fill=(40, 120, 200, 255))                   # the sea below the horizon
    line(d, [(4, 16), (28, 16)], (230, 245, 255))
    d.ellipse((18, 6, 24, 12), fill=(255, 236, 150, 255))                           # a summer sun
    fish_shape(d, 11, 21, 1.1, (20, 60, 110))
    fish_shape(d, 19, 24, 0.9, (20, 60, 110))
    return img


# --- a Cursed Spirit's own powers ----------------------------------------------
def i_devour():
    img, d = badge(TECH_RIM["curse"], (24, 6, 12))
    d.ellipse((6, 9, 26, 25), fill=(90, 10, 30, 255))                               # a gaping maw
    for x in range(8, 25, 3):                                                      # teeth, top and bottom
        poly(d, [(x, 10), (x + 2, 10), (x + 1, 14)], (236, 226, 200))
        poly(d, [(x, 24), (x + 2, 24), (x + 1, 20)], (236, 226, 200))
    d.ellipse((12, 15, 20, 19), fill=(30, 2, 8, 255))
    return img


def i_terror():
    img, d = badge(TECH_RIM["curse"], (20, 6, 10))
    d.ellipse((5, 10, 27, 22), fill=(236, 226, 210, 255))                           # a staring eye
    for a in (0.3, 1.2, 2.2, 3.5, 4.4, 5.6):                                       # bloodshot
        line(d, [(16 + math.cos(a) * 10, 16 + math.sin(a) * 5), (16 + math.cos(a) * 6, 16 + math.sin(a) * 3)], (200, 40, 50))
    d.ellipse((12, 12, 20, 20), fill=(160, 20, 40, 255))
    d.ellipse((14, 14, 18, 18), fill=(10, 0, 4, 255))
    return img


def i_unleash():
    img, d = badge(TECH_RIM["curse"], (16, 4, 10))
    poly(d, [(16, 4), (22, 13), (26, 10), (24, 22), (16, 28), (8, 22), (6, 10), (10, 13)], (120, 20, 60))   # dark flame
    poly(d, [(16, 9), (20, 16), (22, 14), (21, 22), (16, 25), (11, 22), (10, 14), (12, 16)], (200, 40, 90))
    poly(d, [(16, 15), (18, 20), (16, 23), (14, 20)], (255, 140, 180))
    return img


# ---------------------------------------------------------------------------
# What every item is
# ---------------------------------------------------------------------------
TECH_COL = {"limitless": "§b", "shrine": "§c", "ten_shadows": "§5", "cursed_speech": "§3", "blood": "§4", "boogie": "§6",
            "heavenly": "§e", "universal": "§f", "straw_doll": "§6", "ratio": "§9", "projection": "§f", "disaster_flames": "§6",
            "idle_transfiguration": "§9", "idle_death_gamble": "§a", "cursed_spirit": "§d", "disaster_plants": "§2", "disaster_tides": "§3",
            "curse": "§4"}
TECH_NAME = {"limitless": "Limitless", "shrine": "Shrine", "ten_shadows": "Ten Shadows", "cursed_speech": "Cursed Speech",
             "blood": "Blood Manipulation", "boogie": "Boogie Woogie", "heavenly": "Heavenly Restriction", "universal": "Jujutsu",
             "straw_doll": "Straw Doll", "ratio": "Ratio", "projection": "Projection Sorcery", "disaster_flames": "Disaster Flames",
             "idle_transfiguration": "Idle Transfiguration", "idle_death_gamble": "Idle Death Gamble",
             "cursed_spirit": "Cursed Spirit Manipulation", "disaster_plants": "Disaster Plants", "disaster_tides": "Disaster Tides",
             "curse": "Cursed Spirit"}
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
    "summon_mahoraga": ("Eight-Handled Sword Divergent Sila Divine General Mahoraga", "ten_shadows",
                        "The ritual: beat it alone and it's yours", i_mahoraga),
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
    "projection_rush": ("24 FPS Rush", "projection", "Four frames forward in a blink: all you pass are frozen", i_fps_rush),
    "projection_freeze": ("Frame Freeze", "projection", "Trap the one in front of you inside a frame", i_frame_freeze),
    "projection_barrage": ("Accelerated Barrage", "projection", "Speed III and harder blows for 6 s", i_accel_barrage),
    "time_cell_moon_palace": ("Domain Expansion: Time Cell Moon Palace", "projection", "Whoever moves inside is torn apart", i_moon_palace),
    "disaster_ember": ("Ember Insects", "disaster_flames", "Three burning insects that burst on contact", i_ember_insects),
    "disaster_stream": ("Fire Stream", "disaster_flames", "A cone of fire in front of you", i_fire_stream),
    "disaster_meteor": ("Maximum: Meteor", "disaster_flames", "A burning mountain falls on your enemy", i_meteor),
    "iron_mountain": ("Domain Expansion: Coffin of the Iron Mountain", "disaster_flames", "The inside of a volcano: everyone burns",
                      i_iron_mountain),
    "idle_soul_touch": ("Soul Touch", "idle_transfiguration", "Touch someone and twist the shape of their soul", i_soul_touch),
    "idle_body_repel": ("Body Repel", "idle_transfiguration", "Spikes burst out of your body", i_body_repel),
    "idle_isomer": ("Polymorphic Soul Isomer", "idle_transfiguration", "Two transfigured humans fight for you", i_isomer),
    "self_embodiment": ("Domain Expansion: Self-Embodiment of Perfection", "idle_transfiguration", "Every soul inside is touched",
                        i_perfection),
    "gamble_rough": ("Rough Energy", "idle_death_gamble", "Rough cursed energy — and maybe a little luck", i_rough_energy),
    "gamble_shutter": ("Shutter Doors", "idle_death_gamble", "Two doors slam shut on your target", i_shutter_doors),
    "gamble_pachinko": ("Pachinko Rush", "idle_death_gamble", "A spray of pachinko balls", i_pachinko),
    "idle_death_gamble_domain": ("Domain Expansion: Idle Death Gamble", "idle_death_gamble", "Spin for a JACKPOT: 20 s you can't lose",
                                 i_jackpot),
    "spirit_release": ("Release", "cursed_spirit", "Release your strongest stored curse to fight", i_spirit_release),
    "spirit_absorb": ("Absorb", "cursed_spirit", "Swallow a weakened curse on the spot", i_spirit_absorb),
    "spirit_swarm": ("Cursed Swarm", "cursed_spirit", "Release four stored curses at once", i_spirit_swarm),
    "uzumaki": ("Maximum: Uzumaki", "cursed_spirit", "Every stored curse in one spiralling blast", i_uzumaki),
    "reverse_cursed_technique": ("Reverse Cursed Technique", "universal", "Turn cursed energy positive and heal", i_rct),
    "simple_domain": ("Simple Domain", "universal", "A small barrier that neutralises a domain's sure-hit", i_simple_domain),
    "plant_buds": ("Cursed Buds", "disaster_plants", "Seeds that take root and drain whoever they hit", i_cursed_buds),
    "plant_roots": ("Wooden Roots", "disaster_plants", "Roots burst from the ground and hold them", i_wooden_roots),
    "plant_field": ("Flower Field", "disaster_plants", "Flowers that take away the will to fight", i_flower_field),
    "sea_of_light": ("Maximum: Ceremonial Sea of Light", "disaster_plants", "The flowers' life, as a beam of light", i_sea_of_light),
    "tide_swarm": ("Death Swarm", "disaster_tides", "A school of shikigami fish surges at your enemy", i_death_swarm),
    "tide_wave": ("Tidal Wave", "disaster_tides", "A wave that sweeps them away", i_tidal_wave),
    "tide_undertow": ("Undertow", "disaster_tides", "The tide drags everyone near to you", i_undertow),
    "horizon_skandha": ("Domain Expansion: Horizon of the Captivating Skandha", "disaster_tides", "A beach without end, and its fish",
                        i_skandha),
    "curse_devour": ("Devour", "curse", "Eat a weakened curse and grow", i_devour),
    "curse_terror": ("Terror", "curse", "Let loose the fear you're made of", i_terror),
    "curse_unleash": ("Curse Unleashed", "curse", "Strength, speed and a body of cursed energy", i_unleash),
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
