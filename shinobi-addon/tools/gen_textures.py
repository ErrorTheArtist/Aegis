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

# --- Headband armor layer (64x32 armor texture) ------------------------------
armor = canvas(64, 32)
# Helmet geometry uses the same UV as the head (0,0 .. 32,16). Paint a band on the
# side faces (rows 10-12 of the 8px-tall side faces => y = 8+2 .. 8+4).
for x in range(0, 32):
    for y in range(10, 13):
        armor.putpixel((x, y), BLUE if y < 12 else BLUE_D)
# Metal plate on the front face (front face spans x=8..15, y=8..15).
for x in range(9, 15):
    for y in range(9, 14):
        armor.putpixel((x, y), STEEL)
for x, y in [(10, 11), (11, 12), (12, 12), (13, 11), (11, 10), (12, 10)]:
    armor.putpixel((x, y), DARK)
save(armor, RP / "textures" / "models" / "armor" / "aegis_headband.png")

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

# --- Pack icons --------------------------------------------------------------
icon = SHURIKEN_IMG
bg = Image.new("RGBA", (16, 16), (230, 120, 30, 255))
bg.alpha_composite(icon)
bg = bg.resize((128, 128), Image.NEAREST)
save(bg, RP / "pack_icon.png")
save(bg, ROOT / "behavior_pack" / "pack_icon.png")

print("Textures generated.")
