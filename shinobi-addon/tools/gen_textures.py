#!/usr/bin/env python3
"""Generates the add-on's pixel-art textures (requires Pillow).

Run from the shinobi-addon folder:  python3 tools/gen_textures.py
Replace any PNG with your own art later — file names are what matter.
"""
from pathlib import Path
from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
RP = ROOT / "resource_pack"
ITEMS = RP / "textures" / "items" / "aegis"


def canvas(w=16, h=16):
    return Image.new("RGBA", (w, h), (0, 0, 0, 0))


def draw(img, rows, palette, ox=0, oy=0):
    """rows: list of strings; each char is a palette key ('.' = transparent)."""
    for y, row in enumerate(rows):
        for x, ch in enumerate(row):
            if ch != "." and ch != " ":
                img.putpixel((ox + x, oy + y), palette[ch])
    return img


def save(img, path):
    path.parent.mkdir(parents=True, exist_ok=True)
    img.save(path)


DARK = (40, 42, 50, 255)
STEEL = (150, 156, 170, 255)
LIGHT = (215, 220, 230, 255)
WRAP = (120, 70, 40, 255)
RING = (90, 92, 100, 255)

# --- Kunai -----------------------------------------------------------------
kunai = [
    "..............LL",
    ".............LSL",
    "............LSD.",
    "...........LSD..",
    "..........LSD...",
    ".........LSD....",
    "........DSD.....",
    ".......DDD......",
    "......WD........",
    ".....WW.........",
    "....WW..........",
    "...WW...........",
    "..RR............",
    ".R.R............",
    ".RR.............",
    "................",
]
save(draw(canvas(), kunai, {"L": LIGHT, "S": STEEL, "D": DARK, "W": WRAP, "R": RING}), ITEMS / "kunai.png")

# --- Shuriken --------------------------------------------------------------
def make_shuriken():
    """One blade drawn in the top-right quadrant, rotated 4x around the centre."""
    blade = canvas()
    pts = {
        # (x, y): colour — blade pointing up, curving clockwise
        (8, 1): LIGHT, (8, 2): LIGHT, (9, 2): STEEL, (8, 3): LIGHT, (9, 3): STEEL,
        (8, 4): STEEL, (9, 4): STEEL, (10, 4): DARK, (8, 5): STEEL, (9, 5): STEEL,
        (10, 5): DARK, (8, 6): STEEL, (9, 6): DARK, (8, 7): STEEL, (7, 7): STEEL,
        (7, 6): STEEL,
    }
    for (x, y), c in pts.items():
        blade.putpixel((x, y), c)
    img = canvas()
    for k in range(4):
        img.alpha_composite(blade.rotate(-90 * k, center=(8, 8)))
    img.putpixel((7, 8), DARK)  # centre hole
    img.putpixel((8, 8), DARK)
    img.putpixel((7, 7), DARK)
    img.putpixel((8, 7), DARK)
    return img


SHURIKEN_IMG = make_shuriken()
save(SHURIKEN_IMG, ITEMS / "shuriken.png")

# --- Headband (item) ------------------------------------------------------
BLUE = (40, 70, 160, 255)
BLUE_D = (25, 45, 110, 255)
headband = [
    "................",
    "................",
    "................",
    "................",
    "BBBBBLLLLLLBBBBB",
    "BBBBBSSSSSSBBBBB",
    "BBBBBSDSSDSBBBBB",
    "bbbbbSSDDSSbbbbb",
    "bbbbbLSSSSLbbbbb",
    "...............b",
    "..............bb",
    ".............bb.",
    "...............b",
    "................",
    "................",
    "................",
]
save(draw(canvas(), headband, {"B": BLUE, "b": BLUE_D, "L": LIGHT, "S": STEEL, "D": DARK}), ITEMS / "headband.png")

# --- Chakra pill ------------------------------------------------------------
G1, G2, G3 = (60, 140, 70, 255), (100, 190, 100, 255), (190, 240, 180, 255)
pill = [
    "................",
    "................",
    "................",
    "................",
    "......dddd......",
    ".....dGGGGd.....",
    "....dGHHGGGd....",
    "....dGHGGGGd....",
    "....dGGGGGGd....",
    "....dGGGGGGd....",
    ".....dGGGGd.....",
    "......dddd......",
    "................",
    "................",
    "................",
    "................",
]
save(draw(canvas(), pill, {"d": G1, "G": G2, "H": G3}), ITEMS / "chakra_pill.png")

# --- Scrolls -----------------------------------------------------------------
PAPER, PAPER_D = (235, 220, 180, 255), (190, 165, 120, 255)
ROD, ROD_D = (150, 40, 40, 255), (100, 25, 25, 255)
scroll = [
    "................",
    "................",
    "..rRRRRRRRRRRr..",
    "..rRRRRRRRRRRr..",
    "...PPPPPPPPPP...",
    "...PPPPPPPPPP...",
    "...PPPCCCCPPP...",
    "...PPCCCCCCPP...",
    "...PPCCCCCCPP...",
    "...PPPCCCCPPP...",
    "...PPPPPPPPPP...",
    "...pppppppppp...",
    "..rRRRRRRRRRRr..",
    "..rRRRRRRRRRRr..",
    "................",
    "................",
]
SCROLL_COLORS = {
    "blank_scroll": PAPER,
    "fireball_scroll": (230, 90, 30, 255),
    "sphere_scroll": (70, 170, 240, 255),
    "substitution_scroll": (140, 95, 50, 255),
    "clone_scroll": (240, 200, 60, 255),
    "flash_scroll": (200, 200, 255, 255),
    "wind_scroll": (120, 220, 150, 255),
}
for name, color in SCROLL_COLORS.items():
    pal = {"P": PAPER, "p": PAPER_D, "R": ROD, "r": ROD_D, "C": color}
    save(draw(canvas(), scroll, pal), ITEMS / f"{name}.png")

# --- Headband model texture (32x16, matches geometry.aegis.headband) -------
hb = canvas(32, 16)
# cloth band: box UV for an 8x2x8 cube at (0,0) -> 32x10 region
for x in range(32):
    for y in range(10):
        hb.putpixel((x, y), BLUE if (x + y) % 5 else BLUE_D)
for x in range(32):
    hb.putpixel((x, 9), BLUE_D)  # lower edge shading on the side faces
# metal plate: box UV for a 4x3x1 cube at (0,10) -> 10x4 region; front face = (1,11) 4x3
for x in range(10):
    for y in range(10, 14):
        hb.putpixel((x, y), STEEL)
for x in range(1, 5):
    hb.putpixel((x, 11), LIGHT)  # top highlight
for x, y in [(2, 12), (3, 12), (3, 13), (2, 13)]:
    hb.putpixel((x, y), DARK)  # engraved village symbol
hb.putpixel((4, 12), DARK)
# tails: box UV for a 1x4x1 cube at (12,10) -> 4x5 region
for x in range(12, 16):
    for y in range(10, 15):
        hb.putpixel((x, y), BLUE_D if y == 14 else BLUE)
save(hb, RP / "textures" / "models" / "armor" / "aegis_headband.png")

# --- Chakra clone skin (64x64, standard humanoid layout) ---------------------
SKIN, HAIR = (225, 180, 140, 255), (235, 190, 60, 255)
SUIT, SUIT_D, PANTS = (230, 120, 30, 255), (40, 40, 60, 255), (40, 40, 60, 255)
skin = canvas(64, 64)


def rect(img, x0, y0, x1, y1, color):
    for x in range(x0, x1):
        for y in range(y0, y1):
            img.putpixel((x, y), color)


# Head (0..32 x 0..16)
rect(skin, 0, 0, 32, 16, SKIN)
rect(skin, 8, 0, 16, 8, HAIR)  # top
rect(skin, 0, 8, 32, 10, HAIR)  # hairline on all side faces
rect(skin, 24, 8, 32, 16, HAIR)  # back of head
rect(skin, 0, 10, 32, 12, BLUE)  # headband
rect(skin, 10, 10, 14, 12, STEEL)  # plate
skin.putpixel((9, 13), DARK)  # eyes
skin.putpixel((14, 13), DARK)
# Body (16..40 x 16..32)
rect(skin, 16, 16, 40, 32, SUIT)
rect(skin, 20, 20, 28, 22, SUIT_D)  # collar
# Arms
rect(skin, 40, 16, 56, 32, SUIT)
rect(skin, 40, 29, 56, 32, SKIN)  # hands
rect(skin, 32, 48, 48, 64, SUIT)
rect(skin, 32, 61, 48, 64, SKIN)
# Legs
rect(skin, 0, 16, 16, 32, PANTS)
rect(skin, 16, 48, 32, 64, PANTS)
save(skin, RP / "textures" / "entity" / "aegis" / "chakra_clone.png")

# Pack icons (pack_icon.png) are custom artwork — not generated here.

print("Textures generated.")

# --- Clan items --------------------------------------------------------------
import math


def eye(iris, ring, pupil, tomoe=None, rings=False):
    img = canvas()
    cx, cy = 7.5, 7.5
    for x in range(16):
        for y in range(16):
            dx, dy = (x - cx), (y - cy) * 1.6  # almond shape
            r = math.hypot(dx, dy)
            if r < 7.6:
                img.putpixel((x, y), (240, 235, 235, 255))  # white of the eye
            r2 = math.hypot(x - cx, y - cy)
            if r2 < 4.6 and r < 7.6:
                img.putpixel((x, y), iris)
                if rings and int(r2) in (1, 3):
                    img.putpixel((x, y), ring)
                if not rings and 3.6 <= r2:
                    img.putpixel((x, y), ring)
            if r2 < 1.2 and pupil:
                img.putpixel((x, y), pupil)
            if 7.0 <= r < 7.9:
                img.putpixel((x, y), DARK)
    if tomoe:
        for k in range(3):
            a = k * 2 * math.pi / 3 - math.pi / 2
            img.putpixel((round(cx + math.cos(a) * 2.6), round(cy + math.sin(a) * 2.6)), tomoe)
    return img


save(eye((200, 20, 20, 255), (90, 0, 0, 255), (10, 10, 10, 255), tomoe=(10, 10, 10, 255)), ITEMS / "sharingan.png")
save(eye((215, 210, 235, 255), (170, 165, 200, 255), None), ITEMS / "byakugan.png")
save(eye((170, 140, 220, 255), (70, 40, 110, 255), (70, 40, 110, 255), rings=True), ITEMS / "rinnegan.png")

GOLD, GOLD_D = (230, 180, 40, 255), (160, 110, 20, 255)
CLAN_SCROLLS = {
    "wood_style": (60, 140, 50, 255),
    "sealing_chains": (230, 120, 30, 255),
    "flame_bullet": (200, 30, 30, 255),
    "shadow_possession": (40, 40, 50, 255),
    "expansion": (240, 210, 60, 255),
    "insect_swarm": (90, 160, 60, 255),
    "fang_over_fang": (120, 110, 100, 255),
    "mind_transfer": (60, 160, 200, 255),
}
for name, color in CLAN_SCROLLS.items():
    pal = {"P": PAPER, "p": PAPER_D, "R": GOLD, "r": GOLD_D, "C": color}
    save(draw(canvas(), scroll, pal), ITEMS / f"{name}.png")

print("Clan textures generated.")

# --- Chidori, Mangekyō, Reroll ------------------------------------------------
save(draw(canvas(), scroll, {"P": PAPER, "p": PAPER_D, "R": ROD, "r": ROD_D, "C": (150, 220, 255, 255)}), ITEMS / "chidori_scroll.png")
save(draw(canvas(), scroll, {"P": PAPER, "p": PAPER_D, "R": (120, 50, 170, 255), "r": (80, 30, 120, 255), "C": GOLD}), ITEMS / "reroll_scroll.png")

ms = eye((200, 20, 20, 255), (90, 0, 0, 255), (10, 10, 10, 255))
# three-bladed pinwheel pattern over the iris
for k in range(3):
    base = k * 2 * math.pi / 3
    for step in range(9):
        r = 0.8 + step * 0.42
        a = base + step * 0.22
        ms.putpixel((round(7.5 + math.cos(a) * r), round(7.5 + math.sin(a) * r)), (10, 10, 10, 255))
save(ms, ITEMS / "mangekyo.png")
print("Extra textures generated.")

# --- Particle textures (white, tinted in the particle files) -----------------
import random

PART = RP / "textures" / "particle" / "aegis"


def radial(alpha_fn):
    img = canvas()
    for x in range(16):
        for y in range(16):
            r = math.hypot(x - 7.5, y - 7.5) / 8
            a = max(0, min(255, int(alpha_fn(r, x, y) * 255)))
            img.putpixel((x, y), (255, 255, 255, a))
    return img


save(radial(lambda r, x, y: (1 - r) ** 2 if r < 1 else 0), PART / "glow.png")
save(radial(lambda r, x, y: max(0, 1 - r * 1.1) if (abs(x - 7.5) < 1.2 or abs(y - 7.5) < 1.2 or abs(abs(x - 7.5) - abs(y - 7.5)) < 1.0) else 0), PART / "spark.png")
random.seed(7)
save(radial(lambda r, x, y: max(0, (1 - r) * (0.6 + random.random() * 0.4))), PART / "smoke.png")

# --- Model textures -----------------------------------------------------------
ENT = RP / "textures" / "entity" / "aegis"


def orb_texture(core, shell_a, shell_b):
    img = canvas(32, 32)
    for x in range(32):
        for y in range(32):
            if y < 8:  # core UV region (4x4x4 box)
                img.putpixel((x, y), core)
            elif y < 20:  # shell (6x6x6 box) — swirly stripes, translucent
                img.putpixel((x, y), shell_a if (x + y) % 4 < 2 else shell_b)
    return img


save(orb_texture((235, 250, 255, 255), (90, 170, 255, 150), (170, 220, 255, 110)), ENT / "rasengan_orb.png")
save(orb_texture((255, 240, 150, 255), (255, 120, 20, 170), (255, 60, 10, 130)), ENT / "fireball_orb.png")

sus = canvas(64, 64)
for x in range(64):
    for y in range(64):
        n = (x * 7 + y * 13) % 5
        sus.putpixel((x, y), (150 + n * 10, 70 + n * 6, 230, 150))
save(sus, ENT / "susanoo.png")
print("FX textures generated.")

# --- Tailed Beast Bomb orb -----------------------------------------------------
save(orb_texture((15, 5, 25, 255), (90, 40, 160, 200), (30, 10, 60, 220)), ENT / "bijuudama_orb.png")
print("Bijuudama texture generated.")

# --- Tailed beast items ----------------------------------------------------------
save(draw(canvas(), scroll, {"P": (60, 40, 50, 255), "p": (40, 25, 35, 255), "R": (20, 20, 20, 255), "r": (10, 10, 10, 255), "C": (200, 30, 30, 255)}), ITEMS / "bijuu_scroll.png")
print("Tailed beast item textures generated.")

# --- Shinobi Record (stats book/scroll) -------------------------------------------
save(draw(canvas(), scroll, {"P": PAPER, "p": PAPER_D, "R": (40, 70, 160, 255), "r": (25, 45, 110, 255), "C": (250, 200, 40, 255)}), ITEMS / "shinobi_record.png")
print("Shinobi Record texture generated.")

# --- Eternal Mangekyō: red iris with a six-pointed black star ---------------------
ems = eye((210, 25, 25, 255), (90, 0, 0, 255), (10, 10, 10, 255))
for k in range(6):
    a = k * math.pi / 3
    for r in (1.2, 2.0, 2.8, 3.6):
        w_ = 0.9 if r < 3 else 0.4
        for off in (-w_, 0, w_):
            ems.putpixel((round(7.5 + math.cos(a + off * 0.25) * r), round(7.5 + math.sin(a + off * 0.25) * r)), (10, 10, 10, 255))
save(ems, ITEMS / "eternal_mangekyo.png")
print("Eternal Mangekyō texture generated.")

# The detailed 32x32 item icons are drawn by gen_icons.py; re-draw them so this script never
# leaves the old 16x16 placeholders behind.
import subprocess
import sys

subprocess.run([sys.executable, str(ROOT / "tools" / "gen_icons.py")], check=True)
