#!/usr/bin/env python3
"""Draws all item icons at 128x128 with shading/glow, then downsamples to crisp 32x32 icons.
Run from the shinobi-addon folder:  python3 tools/gen_icons.py
(Sword and armor icons are rendered from their 3D models by gen_swords.py / gen_armor.py.)
"""
import math
from pathlib import Path
from PIL import Image, ImageDraw, ImageFilter, ImageChops

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "resource_pack" / "textures" / "items" / "aegis"
S = 128


def new():
    return Image.new("RGBA", (S, S), (0, 0, 0, 0))


def mask_of(draw_fn):
    m = Image.new("L", (S, S), 0)
    draw_fn(ImageDraw.Draw(m))
    return m


def grad(mask, c1, c2, mode="v", center=(64, 64), radius=64):
    """Fill `mask` with a gradient from c1 to c2 (vertical, horizontal or radial)."""
    g = Image.new("RGBA", (S, S))
    px = g.load()
    for x in range(S):
        for y in range(S):
            if mode == "v":
                t = y / (S - 1)
            elif mode == "h":
                t = x / (S - 1)
            else:
                t = min(1, math.hypot(x - center[0], y - center[1]) / radius)
            px[x, y] = tuple(int(c1[i] + (c2[i] - c1[i]) * t) for i in range(3)) + (255,)
    out = new()
    out.paste(g, (0, 0), mask)
    return out


def shape(img, draw_fn, c1, c2=None, mode="v", **kw):
    img.alpha_composite(grad(mask_of(draw_fn), c1, c2 or c1, mode, **kw))
    return img


def glow(img, layer, color, radius=6, strength=2):
    a = layer.split()[3].filter(ImageFilter.GaussianBlur(radius))
    a = a.point(lambda v: min(255, v * strength))
    g = Image.new("RGBA", (S, S), color + (0,))
    g.putalpha(a)
    img.alpha_composite(g)
    img.alpha_composite(layer)
    return img


def finish(img, name):
    small = img.resize((32, 32), Image.LANCZOS)
    px = small.load()
    for x in range(32):
        for y in range(32):
            r, g, b, a = px[x, y]
            if a < 100:
                px[x, y] = (0, 0, 0, 0)
            else:  # un-premultiply soft edges
                k = 255 / max(a, 1)
                px[x, y] = (min(255, int(r * min(k, 1.6))), min(255, int(g * min(k, 1.6))), min(255, int(b * min(k, 1.6))), 255)
    out = small.copy()
    po = out.load()
    for x in range(32):
        for y in range(32):
            if px[x, y][3] == 0 and any(0 <= x + dx < 32 and 0 <= y + dy < 32 and px[x + dx, y + dy][3] > 0
                                        for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1))):
                po[x, y] = (18, 14, 24, 255)
    OUT.mkdir(parents=True, exist_ok=True)
    out.save(OUT / f"{name}.png")


# ---------------------------------------------------------------------------
# Scroll base
# ---------------------------------------------------------------------------
RODS = {"red": ((170, 40, 40), (90, 15, 20)), "gold": ((240, 190, 60), (150, 100, 20)),
        "purple": ((130, 70, 190), (60, 25, 100)), "black": ((70, 60, 70), (20, 15, 25)), "blue": ((60, 110, 210), (25, 45, 120))}


def scroll(rod="red", paper=((248, 236, 205), (210, 185, 140))):
    img = new()
    # parchment
    shape(img, lambda d: d.rectangle([22, 26, 106, 102], fill=255), paper[0], paper[1])
    # faint lines on the paper
    d = ImageDraw.Draw(img)
    for y in (34, 94):
        d.line([28, y, 100, y], fill=(190, 160, 110, 255), width=2)
    # rolled ends
    c1, c2 = RODS[rod]
    for x0 in (10, 100):
        shape(img, lambda d, x0=x0: d.rounded_rectangle([x0, 18, x0 + 18, 110], radius=8, fill=255), c1, c2, "h")
        shape(img, lambda d, x0=x0: d.rounded_rectangle([x0 + 3, 12, x0 + 15, 22], radius=4, fill=255), (250, 215, 110), (170, 120, 40))
        shape(img, lambda d, x0=x0: d.rounded_rectangle([x0 + 3, 106, x0 + 15, 116], radius=4, fill=255), (250, 215, 110), (170, 120, 40))
        d = ImageDraw.Draw(img)
        d.line([x0 + 5, 24, x0 + 5, 104], fill=tuple(min(255, v + 60) for v in c1) + (255,), width=2)
    return img


# ---------------------------------------------------------------------------
# Emblems (drawn in the middle of a scroll, centre 64,64)
# ---------------------------------------------------------------------------
def em_layer(fn):
    layer = new()
    fn(layer, ImageDraw.Draw(layer))
    return layer


def flame_poly(cx, cy, s):
    pts = []
    for i in range(41):
        t = i / 40 * math.pi * 2
        r = s * (0.55 + 0.45 * math.sin(t / 2) ** 3)
        x = cx + math.sin(t) * r * 0.75
        y = cy - math.cos(t) * r * 1.15 + s * 0.25
        pts.append((x, y))
    return pts


def emblem_flame(img, cx=64, cy=62, s=36, outer=(255, 110, 20), inner=(255, 230, 90)):
    lay = new()
    shape(lay, lambda d: d.polygon(flame_poly(cx, cy, s), fill=255), outer, (200, 40, 10))
    shape(lay, lambda d: d.polygon(flame_poly(cx, cy + s * 0.25, s * 0.55), fill=255), (255, 255, 200), inner)
    glow(img, lay, (255, 120, 30), 6, 2)


def emblem_spiral(img, color=(80, 170, 255), light=(220, 245, 255), turns=2.6, r0=34):
    lay = new()
    d = ImageDraw.Draw(lay)
    pts = []
    for i in range(160):
        t = i / 159
        a = t * turns * math.pi * 2
        r = r0 * (1 - t) + 2
        pts.append((64 + math.cos(a) * r, 64 + math.sin(a) * r))
    d.line(pts, fill=color + (255,), width=9, joint="curve")
    d.line(pts, fill=light + (255,), width=3, joint="curve")
    d.ellipse([56, 56, 72, 72], fill=light + (255,))
    glow(img, lay, color, 7, 2)


def bolt_pts(cx, cy, s):
    return [(cx + 4 * s, cy - 30 * s), (cx - 12 * s, cy + 2 * s), (cx + 1 * s, cy + 2 * s), (cx - 6 * s, cy + 30 * s),
            (cx + 14 * s, cy - 6 * s), (cx + 1 * s, cy - 6 * s)]


def emblem_bolt(img, color=(140, 220, 255)):
    lay = new()
    shape(lay, lambda d: d.polygon(bolt_pts(64, 64, 1.45), fill=255), (255, 255, 255), color)
    glow(img, lay, color, 7, 2.5)


def emblem_log(img):
    lay = new()
    shape(lay, lambda d: d.rounded_rectangle([34, 50, 94, 78], radius=12, fill=255), (170, 115, 60), (100, 60, 30))
    shape(lay, lambda d: d.ellipse([84, 50, 102, 78], fill=255), (230, 190, 130), (180, 130, 80), "radial", center=(93, 64), radius=14)
    d = ImageDraw.Draw(lay)
    d.ellipse([89, 59, 97, 69], outline=(140, 95, 50, 255), width=2)
    for x in (44, 58, 72):
        d.line([x, 53, x - 4, 75], fill=(90, 55, 25, 255), width=2)
    img.alpha_composite(lay)


def emblem_clones(img):
    lay = new()
    for i, (x, sc) in enumerate(((44, 0.8), (84, 0.8), (64, 1.0))):
        col = (240, 130, 40) if i == 2 else (200, 110, 40)
        shape(lay, lambda d, x=x, sc=sc: d.ellipse([x - 8 * sc, 40 - 8 * sc, x + 8 * sc, 40 + 8 * sc], fill=255), (250, 210, 150), (220, 170, 110))
        shape(lay, lambda d, x=x, sc=sc: d.rounded_rectangle([x - 11 * sc, 50, x + 11 * sc, 50 + 34 * sc], radius=5, fill=255), col, (150, 70, 20))
        ImageDraw.Draw(lay).rectangle([x - 8 * sc, 34 - 8 * sc + 3, x + 8 * sc, 34 - 8 * sc + 7], fill=(40, 70, 160, 255))
    img.alpha_composite(lay)


def emblem_flash(img):
    lay = new()
    d = ImageDraw.Draw(lay)
    for i, y in enumerate((44, 58, 72, 86)):
        d.line([30 + i * 4, y, 76 + i * 4, y], fill=(150, 220, 255, 255), width=4)
    shape(lay, lambda d: d.polygon([(70, 34), (100, 64), (70, 94), (80, 64)], fill=255), (255, 255, 255), (120, 200, 255))
    glow(img, lay, (120, 200, 255), 5, 2)


def emblem_wind(img, color=(60, 200, 130)):
    lay = new()
    d = ImageDraw.Draw(lay)
    for k, y in enumerate((38, 58, 78, 96)):
        x0 = 28 + (k % 2) * 10
        pts = [(x0 + t * 1.6, y + math.sin(t / 6) * 5) for t in range(36)]
        d.line(pts, fill=color + (255,), width=7, joint="curve")
        d.line(pts, fill=(220, 255, 235, 255), width=2, joint="curve")
        ex, ey = pts[-1]
        d.arc([ex - 10, ey - 14, ex + 6, ey + 2], 270, 120, fill=color + (255,), width=6)
    glow(img, lay, color, 3, 1.0)


def emblem_phoenix(img):
    for i in range(5):
        a = math.radians(-150 + i * 30)
        emblem_flame(img, 64 + math.cos(a) * 28, 78 + math.sin(a) * 28, 13)
    emblem_flame(img, 64, 70, 17, (255, 70, 30))


def emblem_water(img):
    lay = new()
    d = ImageDraw.Draw(lay)
    pts = [(30 + i * 2, 64 + math.sin(i / 5) * 16 - i * 0.4) for i in range(30)]
    d.line(pts, fill=(40, 120, 230, 255), width=14, joint="curve")
    d.line(pts, fill=(170, 220, 255, 255), width=4, joint="curve")
    shape(lay, lambda d: d.ellipse([78, 30, 104, 54], fill=255), (110, 190, 255), (30, 90, 200), "radial", center=(88, 38), radius=16)
    d.polygon([(100, 36), (112, 30), (104, 44)], fill=(30, 90, 200, 255))
    d.ellipse([86, 36, 92, 42], fill=(255, 255, 255, 255))
    for x, y in ((40, 88), (60, 92), (78, 84)):
        d.ellipse([x, y, x + 6, y + 6], fill=(150, 210, 255, 255))
    glow(img, lay, (60, 150, 255), 5, 1.6)


def emblem_earth(img):
    lay = new()
    for row in range(4):
        for col in range(4):
            x = 30 + col * 17 + (8 if row % 2 else 0)
            y = 36 + row * 14
            if x + 15 > 100:
                continue
            shape(lay, lambda d, x=x, y=y: d.rectangle([x, y, x + 15, y + 12], fill=255), (190, 150, 105), (120, 85, 55))
    d = ImageDraw.Draw(lay)
    d.line([34, 96, 96, 96], fill=(90, 60, 35, 255), width=4)
    img.alpha_composite(lay)


def emblem_current(img):
    lay = new()
    d = ImageDraw.Draw(lay)
    d.ellipse([28, 28, 100, 100], outline=(140, 220, 255, 255), width=5)
    for i in range(6):
        a = i / 6 * math.pi * 2
        cx, cy = 64 + math.cos(a) * 30, 64 + math.sin(a) * 30
        d.line([cx, cy, cx + math.cos(a) * 10 + 4, cy + math.sin(a) * 10 - 4, cx + math.cos(a) * 16, cy + math.sin(a) * 16], fill=(255, 255, 255, 255), width=4)
    lay2 = new()
    shape(lay2, lambda d: d.polygon(bolt_pts(64, 64, 0.6), fill=255), (255, 255, 255), (140, 220, 255))
    lay.alpha_composite(lay2)
    glow(img, lay, (120, 200, 255), 6, 2.2)


def emblem_rasenshuriken(img):
    lay = new()
    for k in range(4):
        a = k * math.pi / 2
        pts = [(64, 64)]
        for t in range(0, 11):
            ang = a + t * 0.09
            r = 12 + t * 2.6
            pts.append((64 + math.cos(ang) * r, 64 + math.sin(ang) * r))
        pts.append((64 + math.cos(a + 1.2) * 14, 64 + math.sin(a + 1.2) * 14))
        shape(lay, lambda d, pts=pts: d.polygon(pts, fill=255), (240, 250, 255), (150, 210, 255))
    shape(lay, lambda d: d.ellipse([50, 50, 78, 78], fill=255), (230, 248, 255), (60, 150, 255), "radial", center=(64, 64), radius=16)
    glow(img, lay, (120, 200, 255), 7, 2)


def emblem_palm(img):
    lay = new()
    d = ImageDraw.Draw(lay)
    d.ellipse([30, 30, 98, 98], outline=(120, 255, 150, 255), width=4)
    shape(lay, lambda d: d.rounded_rectangle([56, 36, 72, 92], radius=5, fill=255), (220, 255, 220), (90, 220, 120))
    shape(lay, lambda d: d.rounded_rectangle([36, 56, 92, 72], radius=5, fill=255), (220, 255, 220), (90, 220, 120))
    glow(img, lay, (90, 255, 140), 8, 2.2)


def emblem_toad(img):
    lay = new()
    shape(lay, lambda d: d.ellipse([30, 44, 98, 96], fill=255), (240, 120, 60), (170, 50, 30), "radial", center=(64, 60), radius=40)
    for x in (36, 70):
        shape(lay, lambda d, x=x: d.ellipse([x, 30, x + 22, 52], fill=255), (240, 120, 60), (170, 50, 30))
        ImageDraw.Draw(lay).ellipse([x + 6, 35, x + 16, 47], fill=(250, 230, 70, 255))
        ImageDraw.Draw(lay).rectangle([x + 10, 37, x + 12, 45], fill=(20, 20, 20, 255))
    ImageDraw.Draw(lay).arc([42, 62, 86, 86], 10, 170, fill=(70, 20, 15, 255), width=3)
    ImageDraw.Draw(lay).line([40, 54, 52, 60], fill=(110, 60, 150, 255), width=4)
    img.alpha_composite(lay)


def emblem_slug(img):
    lay = new()
    shape(lay, lambda d: d.ellipse([28, 54, 100, 92], fill=255), (250, 250, 255), (170, 200, 240))
    shape(lay, lambda d: d.ellipse([70, 40, 100, 80], fill=255), (250, 250, 255), (170, 200, 240))
    d = ImageDraw.Draw(lay)
    for x in (78, 92):
        d.line([x, 46, x - 2 + (x - 85) // 2, 26], fill=(200, 215, 240, 255), width=4)
        d.ellipse([x - 6 + (x - 85) // 2, 20, x + 2 + (x - 85) // 2, 28], fill=(40, 40, 40, 255))
    d.line([34, 74, 90, 74], fill=(90, 150, 230, 255), width=4)
    img.alpha_composite(lay)


def emblem_snake(img):
    lay = new()
    d = ImageDraw.Draw(lay)
    pts = [(36 + i * 1.9, 64 + math.sin(i / 4.2) * 18) for i in range(30)]
    d.line(pts, fill=(110, 60, 160, 255), width=13, joint="curve")
    d.line(pts, fill=(220, 210, 190, 255), width=3, joint="curve")
    shape(lay, lambda d: d.ellipse([86, 40, 108, 60], fill=255), (150, 90, 200), (90, 40, 140))
    d.ellipse([96, 44, 102, 50], fill=(250, 210, 40, 255))
    d.line([108, 52, 116, 50, 118, 54], fill=(220, 40, 40, 255), width=2)
    img.alpha_composite(lay)


def emblem_crest(img, kind):
    lay = new()
    d = ImageDraw.Draw(lay)
    if kind == "uzumaki":
        emblem_spiral(img, (230, 60, 50), (255, 200, 190), 2.2, 26)
        return
    if kind == "senju":
        shape(lay, lambda d: d.polygon([(64, 28), (92, 64), (64, 100), (36, 64)], fill=255), (110, 200, 90), (40, 120, 40))
        d = ImageDraw.Draw(lay)
        d.line([64, 34, 64, 94], fill=(30, 90, 30, 255), width=3)
        for k in range(3):
            d.line([64, 48 + k * 14, 50, 40 + k * 14], fill=(30, 90, 30, 255), width=2)
            d.line([64, 48 + k * 14, 78, 40 + k * 14], fill=(30, 90, 30, 255), width=2)
    elif kind == "sarutobi":
        d.ellipse([30, 30, 98, 98], outline=(200, 40, 30, 255), width=6)
        img.alpha_composite(lay)
        emblem_flame(img, 64, 64, 22)
        return
    elif kind == "nara":
        for side in (-1, 1):
            d.line([64, 92, 64 + side * 8, 64, 64 + side * 26, 40], fill=(60, 50, 40, 255), width=6)
            d.line([64 + side * 8, 64, 64 + side * 30, 62], fill=(60, 50, 40, 255), width=5)
            d.line([64 + side * 18, 50, 64 + side * 16, 32], fill=(60, 50, 40, 255), width=5)
    elif kind == "akimichi":
        for side in (-1, 1):
            shape(lay, lambda d, side=side: d.ellipse([64 + side * 4 - (30 if side < 0 else 0), 36, 64 + side * 4 + (30 if side > 0 else 0), 66], fill=255), (255, 220, 70), (220, 140, 30))
            shape(lay, lambda d, side=side: d.ellipse([64 + side * 4 - (22 if side < 0 else 0), 64, 64 + side * 4 + (22 if side > 0 else 0), 90], fill=255), (255, 200, 60), (200, 120, 20))
        ImageDraw.Draw(lay).rectangle([61, 38, 67, 92], fill=(80, 50, 20, 255))
    elif kind == "aburame":
        shape(lay, lambda d: d.ellipse([46, 40, 82, 94], fill=255), (110, 160, 80), (40, 70, 30))
        shape(lay, lambda d: d.ellipse([54, 28, 74, 46], fill=255), (70, 100, 50), (30, 50, 20))
        d = ImageDraw.Draw(lay)
        for k in range(3):
            y = 54 + k * 12
            d.line([48, y, 32, y - 6], fill=(30, 40, 20, 255), width=3)
            d.line([80, y, 96, y - 6], fill=(30, 40, 20, 255), width=3)
        d.line([64, 46, 64, 92], fill=(30, 50, 20, 255), width=2)
    elif kind == "inuzuka":
        for side in (-1, 1):
            shape(lay, lambda d, side=side: d.polygon([(64 + side * 6, 34), (64 + side * 28, 34), (64 + side * 14, 96)], fill=255), (240, 60, 60), (150, 20, 20))
    elif kind == "yamanaka":
        for k in range(5):
            a = k / 5 * math.pi * 2 - math.pi / 2
            cx, cy = 64 + math.cos(a) * 18, 64 + math.sin(a) * 18
            shape(lay, lambda d, cx=cx, cy=cy: d.ellipse([cx - 13, cy - 13, cx + 13, cy + 13], fill=255), (150, 200, 255), (60, 120, 220), "radial", center=(int(cx), int(cy)), radius=14)
        ImageDraw.Draw(lay).ellipse([56, 56, 72, 72], fill=(255, 230, 90, 255))
    glow(img, lay, (255, 255, 255), 3, 0.6)


# ---------------------------------------------------------------------------
# Eyes
# ---------------------------------------------------------------------------
def eye(kind):
    img = new()
    almond = lambda d: d.polygon([(4 + i, 64 - math.sin(i / 120 * math.pi) * 40) for i in range(121)] +
                                  [(124 - i, 64 + math.sin(i / 120 * math.pi) * 34) for i in range(121)], fill=255)
    shape(img, almond, (250, 248, 245), (205, 200, 210), "radial", center=(64, 60), radius=62)
    iris = new()
    if kind in ("sharingan", "mangekyo", "eternal"):
        shape(iris, lambda d: d.ellipse([32, 30, 96, 94], fill=255), (240, 40, 40), (120, 0, 0), "radial", center=(58, 56), radius=36)
        d = ImageDraw.Draw(iris)
        d.ellipse([34, 32, 94, 92], outline=(60, 0, 0, 255), width=3)
        d.ellipse([44, 44, 84, 84], outline=(90, 10, 10, 255), width=2)
        if kind == "sharingan":
            d.ellipse([57, 55, 71, 69], fill=(15, 10, 10, 255))
            for k in range(3):
                a = k * math.pi * 2 / 3 - math.pi / 2
                cx, cy = 64 + math.cos(a) * 20, 62 + math.sin(a) * 20
                d.ellipse([cx - 6, cy - 6, cx + 6, cy + 6], fill=(15, 10, 10, 255))
                d.line([cx, cy, cx + math.cos(a + 1.8) * 10, cy + math.sin(a + 1.8) * 10], fill=(15, 10, 10, 255), width=4)
        elif kind == "mangekyo":
            for k in range(3):
                a = k * math.pi * 2 / 3
                pts = [(64 + math.cos(a + t * 0.05) * (6 + t * 0.9), 62 + math.sin(a + t * 0.05) * (6 + t * 0.9)) for t in range(28)]
                d.line(pts, fill=(15, 10, 10, 255), width=7, joint="curve")
            d.ellipse([56, 54, 72, 70], fill=(15, 10, 10, 255))
        else:  # eternal: six-pointed star
            for k in range(6):
                a = k * math.pi / 3
                d.polygon([(64, 62), (64 + math.cos(a - 0.25) * 14, 62 + math.sin(a - 0.25) * 14),
                           (64 + math.cos(a) * 31, 62 + math.sin(a) * 31), (64 + math.cos(a + 0.25) * 14, 62 + math.sin(a + 0.25) * 14)], fill=(15, 10, 10, 255))
            d.ellipse([58, 56, 70, 68], fill=(200, 30, 30, 255))
    elif kind == "byakugan":
        shape(iris, lambda d: d.ellipse([34, 32, 94, 92], fill=255), (250, 248, 255), (200, 195, 230), "radial", center=(60, 58), radius=34)
        d = ImageDraw.Draw(iris)
        d.ellipse([36, 34, 92, 90], outline=(180, 170, 220, 255), width=2)
        for k in range(8):
            a = k / 8 * math.pi * 2
            d.line([64 + math.cos(a) * 34, 62 + math.sin(a) * 34, 64 + math.cos(a + 0.4) * 52, 62 + math.sin(a + 0.4) * 48], fill=(170, 160, 210, 255), width=2)
    elif kind == "rinnegan":
        shape(iris, lambda d: d.ellipse([28, 26, 100, 98], fill=255), (210, 190, 250), (130, 100, 200), "radial", center=(60, 56), radius=40)
        d = ImageDraw.Draw(iris)
        for r in (34, 26, 18, 10):
            d.ellipse([64 - r, 62 - r, 64 + r, 62 + r], outline=(60, 30, 110, 255), width=3)
        d.ellipse([60, 58, 68, 66], fill=(60, 30, 110, 255))
    iris_mask = mask_of(almond)
    clipped = new()
    clipped.paste(iris, (0, 0), ImageChops.multiply(iris.split()[3], iris_mask))
    img.alpha_composite(clipped)
    d = ImageDraw.Draw(img)
    d.ellipse([44, 40, 54, 50], fill=(255, 255, 255, 200))  # shine
    d.line([(4 + i, 64 - math.sin(i / 120 * math.pi) * 40) for i in range(121)], fill=(25, 15, 20, 255), width=6)
    d.line([(4 + i, 64 + math.sin(i / 120 * math.pi) * 34) for i in range(121)], fill=(25, 15, 20, 255), width=4)
    if kind in ("mangekyo", "eternal", "rinnegan"):
        glow_l = new()
        glow_l.alpha_composite(img)
        img = new()
        glow(img, glow_l, (200, 30, 30) if kind != "rinnegan" else (150, 90, 230), 6, 1.2)
    return img


# ---------------------------------------------------------------------------
# Other items
# ---------------------------------------------------------------------------
def kunai():
    img = new()
    shape(img, lambda d: d.polygon([(112, 14), (66, 40), (56, 50), (78, 72), (88, 62)], fill=255), (240, 245, 255), (110, 120, 140), "h")
    ImageDraw.Draw(img).line([110, 16, 70, 56], fill=(255, 255, 255, 255), width=3)
    shape(img, lambda d: d.line([66, 62, 32, 96], fill=255, width=14), (80, 60, 50), (40, 25, 20))
    d = ImageDraw.Draw(img)
    for k in range(5):
        x, y = 62 - k * 7, 66 + k * 7
        d.line([x - 6, y - 6, x + 6, y + 6], fill=(150, 110, 80, 255), width=3)
    d.ellipse([10, 96, 36, 122], outline=(150, 155, 170, 255), width=6)
    return img


def shuriken():
    img = new()
    pts = []
    for k in range(8):
        a = k * math.pi / 4 - math.pi / 2 + 0.25
        r = 58 if k % 2 == 0 else 15
        pts.append((64 + math.cos(a) * r, 64 + math.sin(a) * r))
    shape(img, lambda d: d.polygon(pts, fill=255), (235, 240, 250), (90, 95, 115), "radial", center=(50, 46), radius=80)
    d = ImageDraw.Draw(img)
    for k in range(4):
        a = k * math.pi / 2 - math.pi / 2 + 0.25
        d.line([64, 64, 64 + math.cos(a) * 54, 64 + math.sin(a) * 54], fill=(255, 255, 255, 200), width=2)
    d.ellipse([54, 54, 74, 74], fill=(30, 30, 40, 255))
    d.ellipse([58, 58, 70, 70], fill=(0, 0, 0, 0))
    return img


def headband():
    img = new()
    shape(img, lambda d: d.polygon([(4, 50), (124, 46), (124, 80), (4, 84)], fill=255), (60, 100, 200), (25, 45, 120))
    shape(img, lambda d: d.polygon([(100, 70), (118, 76), (110, 118), (96, 112)], fill=255), (50, 85, 180), (25, 45, 120))
    shape(img, lambda d: d.rounded_rectangle([36, 40, 92, 88], radius=6, fill=255), (230, 235, 245), (120, 125, 140))
    d = ImageDraw.Draw(img)
    for x, y in ((42, 46), (86, 46), (42, 82), (86, 82)):
        d.ellipse([x - 3, y - 3, x + 3, y + 3], fill=(90, 90, 100, 255))
    # leaf symbol
    d.arc([48, 48, 80, 80], 200, 520, fill=(50, 50, 60, 255), width=4)
    d.line([64, 64, 82, 50], fill=(50, 50, 60, 255), width=4)
    d.polygon([(76, 44), (86, 48), (80, 56)], fill=(50, 50, 60, 255))
    return img


def pill():
    img = new()
    shape(img, lambda d: d.ellipse([22, 30, 106, 98], fill=255), (130, 220, 120), (30, 110, 40), "radial", center=(54, 50), radius=60)
    d = ImageDraw.Draw(img)
    d.ellipse([40, 40, 62, 56], fill=(230, 255, 220, 230))
    d.arc([22, 30, 106, 98], 20, 160, fill=(20, 80, 30, 255), width=3)
    return img


def ramen(broth=(240, 200, 120), topping=(250, 240, 210)):
    img = new()
    shape(img, lambda d: d.chord([10, 30, 118, 120], 0, 180, fill=255), (230, 60, 50), (130, 20, 20))
    d = ImageDraw.Draw(img)
    d.line([18, 82, 110, 82], fill=(255, 255, 255, 255), width=4)
    for k in range(6):
        d.arc([20 + k * 14, 86, 34 + k * 14, 100], 0, 180, fill=(255, 230, 120, 255), width=2)
    shape(img, lambda d: d.ellipse([10, 58, 118, 84], fill=255), broth, tuple(int(c * 0.8) for c in broth))
    d = ImageDraw.Draw(img)
    for k in range(5):
        d.arc([20 + k * 16, 62, 44 + k * 16, 80], 180, 360, fill=(255, 235, 160, 255), width=3)
    d.ellipse([28, 60, 48, 74], fill=topping + (255,))
    d.ellipse([70, 58, 94, 76], fill=(250, 250, 250, 255))
    d.arc([76, 62, 88, 72], 0, 300, fill=(240, 120, 160, 255), width=2)  # narutomaki
    d.line([60, 64, 116, 8], fill=(150, 100, 50, 255), width=5)
    d.line([70, 66, 124, 16], fill=(170, 120, 60, 255), width=5)
    return img


def book():
    img = new()
    shape(img, lambda d: d.rounded_rectangle([24, 14, 110, 116], radius=6, fill=255), (60, 110, 210), (25, 50, 120))
    shape(img, lambda d: d.rectangle([24, 14, 38, 116], fill=255), (40, 80, 170), (20, 40, 100))
    shape(img, lambda d: d.rectangle([104, 20, 112, 110], fill=255), (250, 240, 220), (200, 185, 150))
    d = ImageDraw.Draw(img)
    d.arc([52, 42, 92, 82], 200, 520, fill=(250, 210, 60, 255), width=5)
    d.line([72, 62, 96, 44], fill=(250, 210, 60, 255), width=5)
    d.rectangle([44, 92, 100, 98], fill=(250, 210, 60, 255))
    return img


def aura(color):
    img = new()
    c = color
    hi = tuple(min(255, int(v * 1.2) + 30) for v in c)
    lo = tuple(int(v * 0.55) for v in c)
    for cx, cy, sz in ((36, 78, 34), (92, 78, 34), (64, 66, 52)):
        shape(img, lambda d, cx=cx, cy=cy, sz=sz: d.polygon(flame_poly(cx, cy, sz), fill=255), hi, lo)
    lay = new()
    shape(lay, lambda d: d.polygon(flame_poly(64, 80, 30), fill=255), (255, 250, 230), tuple(min(255, v + 60) for v in c))
    glow(img, lay, c, 6, 1.5)
    d = ImageDraw.Draw(img)
    d.polygon([(42, 58), (60, 64), (44, 68)], fill=(30, 10, 10, 255))
    d.polygon([(86, 58), (68, 64), (84, 68)], fill=(30, 10, 10, 255))
    return img


def make_scroll(name, rod, emblem, paper=None):
    img = scroll(rod) if paper is None else scroll(rod, paper)
    if emblem:
        emblem(img)
    finish(img, name)


if __name__ == "__main__":
    # jutsu scrolls
    make_scroll("fireball_scroll", "red", emblem_flame)
    make_scroll("sphere_scroll", "red", lambda i: emblem_spiral(i))
    make_scroll("substitution_scroll", "red", emblem_log)
    make_scroll("clone_scroll", "red", emblem_clones)
    make_scroll("flash_scroll", "red", emblem_flash)
    make_scroll("wind_scroll", "red", lambda i: emblem_wind(i))
    make_scroll("chidori_scroll", "red", lambda i: emblem_bolt(i))
    make_scroll("phoenix_scroll", "red", emblem_phoenix)
    make_scroll("water_dragon_scroll", "blue", emblem_water)
    make_scroll("earth_wall_scroll", "red", emblem_earth)
    make_scroll("chidori_current_scroll", "blue", emblem_current)
    make_scroll("rasenshuriken_scroll", "gold", emblem_rasenshuriken)
    make_scroll("mystical_palm_scroll", "red", emblem_palm)
    make_scroll("blank_scroll", "red", None)
    # summoning
    make_scroll("summon_toad_scroll", "purple", emblem_toad)
    make_scroll("summon_slug_scroll", "purple", emblem_slug)
    make_scroll("summon_snake_scroll", "purple", emblem_snake)
    # clan scrolls (gold rods + crest)
    for item, crest in (("wood_style", "senju"), ("sealing_chains", "uzumaki"), ("flame_bullet", "sarutobi"),
                        ("shadow_possession", "nara"), ("expansion", "akimichi"), ("insect_swarm", "aburame"),
                        ("fang_over_fang", "inuzuka"), ("mind_transfer", "yamanaka")):
        make_scroll(item, "gold", lambda i, c=crest: emblem_crest(i, c))
    # special scrolls
    make_scroll("reroll_scroll", "purple", lambda i: emblem_spiral(i, (190, 120, 255), (250, 230, 255), 3, 24))
    make_scroll("bijuu_scroll", "black", lambda i: (ImageDraw.Draw(i).ellipse([30, 30, 98, 98], outline=(200, 20, 20, 255), width=6), emblem_spiral(i, (200, 20, 20), (255, 140, 140), 2, 20)),
                paper=((60, 45, 55), (30, 20, 28)))
    # eyes
    for k in ("sharingan", "mangekyo", "eternal", "byakugan", "rinnegan"):
        finish(eye(k), {"eternal": "eternal_mangekyo"}.get(k, k))
    finish(kunai(), "kunai")
    finish(shuriken(), "shuriken")
    finish(headband(), "headband")
    finish(pill(), "chakra_pill")
    finish(ramen(), "ramen")
    finish(ramen((200, 150, 80), (120, 170, 80)), "miso_ramen")
    finish(book(), "shinobi_record")
    for beast, col in (("shukaku", (210, 170, 100)), ("matatabi", (60, 120, 240)), ("isobu", (110, 170, 150)), ("son_goku", (200, 60, 40)),
                       ("kokuo", (235, 235, 230)), ("saiken", (150, 220, 120)), ("chomei", (110, 200, 90)), ("gyuki", (160, 90, 170)), ("kurama", (245, 120, 20))):
        finish(aura(col), f"cloak_{beast}")
    print("Icons drawn.")
