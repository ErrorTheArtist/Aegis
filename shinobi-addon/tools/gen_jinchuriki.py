#!/usr/bin/env python3
"""Jinchūriki cloaks v2 — Tailed Beast Mode, remodelled.

Every beast gets its own wearable chakra shroud (the Tailed Beast Cloak, chest slot):

  * a bubbling, translucent chakra shell over the whole body with flame wisps licking off the shoulders, back, head,
    elbows and heels, chakra claws on the hands, and a beast face (slit eyes, brows, fangs; Kurama's whiskers)
  * the beast's own ears or horns: fox, tanuki, cat, ape horns, horse horns, slug eye-stalks, beetle horn, ox horns,
    and Isobu's spiked shell
  * the right number of tails, each a tapered five-joint chain that ripples like flame (Chomei: six insect wings and
    one tail)
  * a glow layer (additive, scrolling) over shell and tails, so the chakra shimmers and flows
  * a mastered variant (Tailed Beast Chakra Mode): golden shroud with black seal markings — the spiral seal on the
    belly, bands on the limbs — a flame crest and coat tails, golden tails tipped with the beast's colour

Two animations play on every cloak:
  form  — the shroud bubbles up around the body (legs → torso → arms → head), the ears pop, then the tails sprout
          one by one. It starts the moment the cloak is put on and is timed to the transformation cinematic
          (behavior_pack/scripts/jin_shots.js); it holds on its last frame.
  sway  — the tails ripple, the wisps flicker, the shroud breathes, wings flutter.

Also patches the jutsu orb with the growing Tailed Beast Bomb stages, and writes the mastered cloak items.
Preview: python3 tools/jin_preview.py.   Run from the shinobi-addon folder:  python3 tools/gen_jinchuriki.py
"""
import json
import math
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageFilter

ROOT = Path(__file__).resolve().parent.parent
BP, RP = ROOT / "behavior_pack", ROOT / "resource_pack"
ARMOR = RP / "textures" / "models" / "armor"
TW = 128  # cloak texture size
GW = 64   # glow texture size


def w(path, obj):
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(obj, indent=2, ensure_ascii=False) + "\n")


def r2(v):
    return round(float(v), 3)


# ---------------------------------------------------------------------------
# The nine beasts
# ---------------------------------------------------------------------------
# col: the chakra colour · core: its bright centre · dark: the rim · iris (iris2 = the other eye) and pupil shape
# tail: (thickness at the base, at the tip, segment lengths, base pitch, curl per joint)
BEASTS = {
    "shukaku": dict(name="Shukaku", tails=1, col=(214, 166, 88), core=(255, 238, 186), dark=(118, 76, 34), iris=(244, 210, 60),
                    pupil="star", ears="tanuki", tail=(5.0, 2.6, [5, 5, 4.5, 4.5, 4, 3.5], -6, 14), marks="rings"),
    "matatabi": dict(name="Matatabi", tails=2, col=(46, 112, 255), core=(178, 226, 255), dark=(10, 30, 120), iris=(206, 255, 84),
                     iris2=(252, 214, 60), pupil="slit", ears="cat", tail=(3.0, 1.2, [4.5, 4.5, 4.5, 4, 4, 3.5], -4, 14)),
    "isobu": dict(name="Isobu", tails=3, col=(58, 192, 172), core=(196, 255, 240), dark=(14, 82, 76), iris=(238, 60, 46),
                  pupil="round", ears="turtle", tail=(3.0, 1.3, [4, 4, 4, 3.5, 3.5, 3], -6, 13)),
    "son_goku": dict(name="Son Goku", tails=4, col=(236, 72, 30), core=(255, 204, 112), dark=(112, 20, 10), iris=(192, 236, 62),
                     pupil="round", ears="ape", tail=(2.6, 1.0, [4.5, 4.5, 4.5, 4.5, 4, 3.5], -2, 15)),
    "kokuo": dict(name="Kokuo", tails=5, col=(232, 232, 222), core=(255, 255, 255), dark=(146, 146, 136), iris=(224, 62, 62),
                  pupil="round", ears="horse", tail=(2.8, 1.2, [4.5, 4.5, 4, 4, 3.5, 3], -6, 13)),
    "saiken": dict(name="Saiken", tails=6, col=(150, 230, 120), core=(236, 255, 216), dark=(58, 118, 48), iris=(255, 230, 82),
                   pupil="round", ears="slug", tail=(2.9, 1.5, [4.5, 4, 4, 4, 3.5, 3], -6, 12)),
    "chomei": dict(name="Chomei", tails=1, wings=6, col=(112, 232, 62), core=(226, 255, 172), dark=(40, 110, 20), iris=(255, 152, 40),
                   pupil="round", ears="beetle", tail=(2.6, 1.0, [4, 4, 3.5, 3, 3, 2.5], -12, 11)),
    "gyuki": dict(name="Gyuki", tails=8, col=(162, 82, 204), core=(236, 202, 255), dark=(58, 18, 90), iris=(250, 212, 82),
                  pupil="bar", ears="ox", tail=(3.3, 1.2, [4.5, 4.5, 4.5, 4.5, 4, 3.5], -8, 19)),
    "kurama": dict(name="Kurama", tails=9, col=(255, 96, 22), core=(255, 212, 132), dark=(140, 24, 4), iris=(255, 42, 22),
                   pupil="slit", ears="fox", tail=(3.3, 1.3, [4.5, 4.5, 4.5, 4, 4, 3.5], -8, 14), whiskers=True),
}
GOLD = dict(col=(255, 194, 48), core=(255, 248, 204), dark=(186, 104, 8), mark=(24, 14, 8))

# Texture regions (x, y, w, h) in every 128x128 cloak texture
SH = (0, 0, 64, 64)        # the bubbling shroud (shared by every shell face)
FACE = (64, 0, 32, 32)     # the head's front: eyes, brows, fangs, markings
BELLY = (96, 0, 32, 48)    # the torso's front (mastered: the spiral seal and the collar)
TAIL = (64, 32, 32, 32)    # tail bands, one per joint (5 rows each), brighter (mastered: toward the beast colour) to the tip
FLAME = (0, 64, 64, 32)    # four flame wisps, 16x32 each, pointing up
TIP = (0, 96, 64, 32)      # four tail-tip bulbs (16x16) above four small flames
PART = (64, 64, 32, 32)    # ears, horns, stalks, shell plates
MARK = (64, 96, 32, 32)    # mastered limbs: gold with two black bands
WING = (96, 48, 32, 72)    # Chomei's wing membrane
NONE = (96, 120, 32, 8)    # fully transparent (thin edges of wisps and wings)

# Cinematic timing (seconds after the cloak goes on) — keep in sync with jin_shots.js
FORM = dict(legs=1.18, body=1.26, arms=1.32, head=1.38, wisps=1.5, ears=1.62, tails=2.05, tail_gap=0.13, flaps=1.46, crest=1.66)
FORM_LEN = 3.6
SWAY_LEN = 2.0


# ---------------------------------------------------------------------------
# Painting
# ---------------------------------------------------------------------------
def tile_noise(size, seed, comps=14, kx=(-4, 4), ky=(-4, 4)):
    """Seamless smooth noise in 0..1 (a sum of integer-frequency waves)."""
    rng = np.random.default_rng(seed)
    y, x = np.mgrid[0:size, 0:size] / size
    out = np.zeros((size, size))
    for _ in range(comps):
        a, b = int(rng.integers(kx[0], kx[1] + 1)), int(rng.integers(ky[0], ky[1] + 1))
        if a == 0 and b == 0:
            a = 1
        out += rng.uniform(0.4, 1.0) / math.hypot(a, b) * np.sin(2 * math.pi * (a * x + b * y) + rng.uniform(0, 2 * math.pi))
    out -= out.min()
    return out / max(1e-9, out.max())


def tile_bubbles(size, seed, n=22, rmin=3.0, rmax=8.0):
    """Seamless bubbles: (body 0..1, rim 0..1, specular highlight 0..1)."""
    rng = np.random.default_rng(seed)
    y, x = np.mgrid[0:size, 0:size] + 0.5
    body, rim, spec = (np.zeros((size, size)) for _ in range(3))
    for _ in range(n):
        cx, cy, rad = rng.uniform(0, size), rng.uniform(0, size), rng.uniform(rmin, rmax)
        for ox in (-size, 0, size):
            for oy in (-size, 0, size):
                d = np.hypot(x - cx - ox, y - cy - oy) / rad
                body = np.maximum(body, np.clip(1 - d, 0, 1) ** 0.6)
                rim = np.maximum(rim, np.exp(-((d - 1) / 0.14) ** 2))
                ds = np.hypot(x - (cx + ox - 0.38 * rad), y - (cy + oy - 0.38 * rad)) / (0.3 * rad)
                spec = np.maximum(spec, np.clip(1 - ds, 0, 1))
    return body, rim, spec


def ramp(v, stops):
    """v (array 0..1) through colour stops [(t, (r,g,b)), …] → (h, w, 3) floats."""
    v = np.clip(v, 0, 1)
    out = np.zeros(v.shape + (3,))
    for (t0, c0), (t1, c1) in zip(stops, stops[1:]):
        m = (v >= t0) & (v <= t1)
        u = ((v - t0) / max(1e-6, t1 - t0))[..., None]
        out[m] = (np.array(c0) + (np.array(c1) - np.array(c0)) * u)[m]
    return out


def stops_of(pal):
    return [(0, pal["dark"]), (0.45, pal["col"]), (0.8, pal["core"]), (1.0, (255, 255, 250))]


def to_rgba(rgb, a):
    arr = np.dstack([np.clip(rgb, 0, 255), np.clip(a, 0, 255)]).astype(np.uint8)
    return Image.fromarray(arr, "RGBA")


def paint_shroud(pal, seed, size=64, alpha=(118, 210)):
    """Bubbling chakra: boiling noise, rising flame streaks, bubbles with bright rims and highlights."""
    n = tile_noise(size, seed)
    streak = tile_noise(size, seed + 7, comps=10, kx=(-7, 7), ky=(-1, 1))
    body, rim, spec = tile_bubbles(size, seed + 13)
    v = 0.28 + 0.34 * n + 0.16 * streak + 0.22 * body + 0.28 * spec - 0.12 * rim
    a = alpha[0] + (alpha[1] - alpha[0]) * np.clip(0.35 * n + 0.45 * rim + 0.5 * spec, 0, 1)
    return to_rgba(ramp(v, stops_of(pal)), a)


def paint_tail_bands(pal, seed, tip=None, size=32, bands=6):  # 6 bands × 5 rows
    """One 5-row band per joint, each brighter than the last; mastered tails shift toward `tip` colour."""
    n = tile_noise(size, seed, comps=10, kx=(-6, 6), ky=(-2, 2))
    body, rim, spec = tile_bubbles(size, seed + 3, n=10, rmin=2, rmax=4.5)
    rgb = np.zeros((size, size, 3))
    a = np.zeros((size, size))
    for k in range(bands):
        rows = slice(k * 5, k * 5 + 5)
        u = k / (bands - 1)
        p = dict(pal)
        if tip is not None:
            mix = lambda c0, c1: tuple(c0[i] + (c1[i] - c0[i]) * u ** 1.3 for i in range(3))
            p = dict(col=mix(pal["col"], tip["col"]), core=mix(pal["core"], tip["core"]), dark=mix(pal["dark"], tip["dark"]))
        v = 0.2 + 0.065 * k + 0.24 * n[rows] + 0.14 * body[rows] + 0.2 * spec[rows]
        rgb[rows] = ramp(v, stops_of(p))
        a[rows] = 165 + 10 * k + 45 * np.clip(rim[rows] + spec[rows], 0, 1)
    return to_rgba(rgb, a)


def flame_mask(wd, ht, seed, lean=0.0):
    """A flame silhouette (alpha 0..1) drawn at 4x and smoothed, base at the bottom."""
    S = 4
    big = Image.new("L", (wd * S, ht * S), 0)
    d = ImageDraw.Draw(big)
    rng = np.random.default_rng(seed)
    pts_l, pts_r = [], []
    steps = 24
    for i in range(steps + 1):
        u = i / steps                       # 0 = base, 1 = tip
        half = (0.46 * (1 - u) ** 0.75 + 0.02) * wd * S
        wob = math.sin(u * math.pi * (2.2 + rng.uniform(0, 0.8)) + rng.uniform(0, 6)) * 0.12 * wd * S * u
        cx = wd * S / 2 + lean * u * u * wd * S * 0.3 + wob
        y = (ht - 1) * S * (1 - u)
        pts_l.append((cx - half, y))
        pts_r.append((cx + half, y))
    d.polygon(pts_l + pts_r[::-1], fill=255)
    return np.asarray(big.filter(ImageFilter.GaussianBlur(S * 0.6)).resize((wd, ht), Image.LANCZOS), dtype=float) / 255


def paint_flame(pal, wd, ht, seed, lean=0.0):
    m = flame_mask(wd, ht, seed, lean)
    yy = np.mgrid[0:ht, 0:wd][0] / max(1, ht - 1)          # 0 at the top (tip), 1 at the base
    xx = np.abs(np.mgrid[0:ht, 0:wd][1] - (wd - 1) / 2) / (wd / 2)
    v = np.clip(0.35 + 0.55 * yy - 0.25 * xx + 0.12 * m, 0, 1)
    return to_rgba(ramp(v, stops_of(pal)), 235 * np.clip(m * 1.15, 0, 1))


def paint_bulb(pal, s=16):
    yy, xx = np.mgrid[0:s, 0:s] + 0.5
    d = np.hypot(xx - s / 2, yy - s / 2) / (s / 2)
    v = np.clip(1.05 - d * 0.75, 0, 1)
    return to_rgba(ramp(v, stops_of(pal)), np.clip(255 * (1.15 - d ** 2), 120, 240))


def paint_part(pal, seed, size=32):
    """Ears and horns: denser chakra, bright at the root and darker toward the tips."""
    n = tile_noise(size, seed, comps=8)
    yy = np.mgrid[0:size, 0:size][0] / (size - 1)
    v = 0.3 + 0.4 * yy + 0.25 * n
    return to_rgba(ramp(v, stops_of(pal)), 190 + 40 * n)


def paint_mark(pal, seed, size=32):
    img = paint_shroud(pal, seed, size, alpha=(170, 225))
    d = ImageDraw.Draw(img)
    for y0 in (5, 23):
        d.rectangle([0, y0, size, y0 + 3], fill=pal["mark"] + (235,))
    return img


def paint_wing(pal, seed, wd=32, ht=72):
    rng = np.random.default_rng(seed)
    yy, xx = np.mgrid[0:ht, 0:wd]
    n = tile_noise(max(wd, ht), seed)[:ht, :wd]
    base = ramp(0.5 + 0.35 * n, stops_of(pal))
    img = to_rgba(base, 135 + 55 * n)
    d = ImageDraw.Draw(img)
    for k in range(3):     # a bright rim around each of the three wing panels
        d.rectangle([1, 2 + 23 * k, 30, 2 + 23 * k + 19], outline=pal["core"] + (235,), width=1)
    for _ in range(12):    # veins along the wing
        y = rng.uniform(1, ht - 2)
        x0 = 0
        while x0 < wd:
            x1 = x0 + rng.uniform(4, 9)
            y1 = y + rng.uniform(-2, 2)
            d.line([(x0, y), (x1, y1)], fill=pal["dark"] + (210,), width=1)
            x0, y = x1, y1
    return img


def paint_glow(pal, seed, size=GW):
    """The additive layer: dark (adds nothing) with bright rising streaks and sparks, seamless so it can scroll."""
    s1 = tile_noise(size, seed, comps=12, kx=(-8, 8), ky=(-1, 1))
    s2 = tile_noise(size, seed + 1, comps=9)
    body, rim, spec = tile_bubbles(size, seed + 2, n=16, rmin=2, rmax=5)
    v = np.clip((s1 - 0.55) * 2.4, 0, 1) * (0.5 + 0.5 * s2) + 0.55 * spec + 0.25 * rim
    v = np.clip(v, 0, 1)
    rgb = ramp(v, [(0, (0, 0, 0)), (0.35, tuple(c * 0.45 for c in pal["col"])), (0.75, pal["col"]), (1, pal["core"])])
    return to_rgba(rgb * 0.82, np.full(v.shape, 255))


def eye_points(cx, cy, wd, ht, slant, side):
    """Almond eye outline (4x canvas): outer corner raised by `slant`."""
    pts = []
    for i in range(17):
        u = i / 16
        x = cx - wd / 2 + wd * u
        lift = slant * (u if side < 0 else 1 - u)      # the outer corner sits higher
        pts.append((x, cy - ht * math.sin(math.pi * u) ** 0.8 - lift))
    for i in range(16, -1, -1):
        u = i / 16
        x = cx - wd / 2 + wd * u
        lift = slant * (u if side < 0 else 1 - u)
        pts.append((x, cy + ht * 0.55 * math.sin(math.pi * u) ** 1.2 - lift * 0.6))
    return pts


def paint_face(pal, beast, seed, gold=False):
    """The head's front: shroud, then the beast's eyes and markings."""
    S = 4
    base = paint_shroud(pal, seed, 32, alpha=(150, 215))
    big = Image.new("RGBA", (32 * S, 32 * S), (0, 0, 0, 0))
    d = ImageDraw.Draw(big)
    ink = pal.get("mark", tuple(int(c * 0.35) for c in pal["dark"])) + (240,)
    eye_l, eye_r = (9.4 * S, 16.2 * S), (22.6 * S, 16.2 * S)
    for (cx, cy), side, iris in ((eye_l, -1, beast["iris"]), (eye_r, 1, beast.get("iris2", beast["iris"]))):
        if gold:
            iris = (255, 150, 30)
        pts = eye_points(cx, cy, 7.4 * S, 2.6 * S, 1.8 * S, side)
        d.polygon(pts, fill=iris + (255,), outline=ink, width=S)
        # pupil
        pu = beast["pupil"]
        if pu == "slit":
            d.ellipse([cx - 0.55 * S, cy - 2.4 * S, cx + 0.55 * S, cy + 1.6 * S], fill=(10, 4, 4, 255))
        elif pu == "bar":
            d.rectangle([cx - 1.9 * S, cy - 0.7 * S, cx + 1.9 * S, cy + 0.3 * S], fill=(10, 6, 4, 255))
        elif pu == "star":
            for ang in (0, 90):
                a = math.radians(ang)
                dx, dy = math.cos(a) * 1.8 * S, math.sin(a) * 1.8 * S
                d.line([(cx - dx, cy - 0.4 * S - dy), (cx + dx, cy - 0.4 * S + dy)], fill=(10, 6, 4, 255), width=S)
            d.ellipse([cx - 0.9 * S, cy - 1.3 * S, cx + 0.9 * S, cy + 0.5 * S], fill=(10, 6, 4, 255))
        else:
            d.ellipse([cx - 1.1 * S, cy - 1.6 * S, cx + 1.1 * S, cy + 0.6 * S], fill=(10, 6, 4, 255))
        d.ellipse([cx - 2.2 * S, cy - 2.2 * S, cx - 1.2 * S, cy - 1.2 * S], fill=(255, 255, 255, 210))   # glint
        # brow: slants down toward the nose
        bx0, bx1 = (cx - 4.2 * S, cx + 2.6 * S) if side < 0 else (cx - 2.6 * S, cx + 4.2 * S)
        by_out, by_in = cy - 5.4 * S, cy - 3.0 * S
        d.line([(bx0, by_out if side < 0 else by_in), (bx1, by_in if side < 0 else by_out)], fill=ink, width=int(1.4 * S))
        if beast.get("marks") == "rings" or gold:
            d.arc([cx - 4.6 * S, cy - 3.6 * S, cx + 4.6 * S, cy + 3.4 * S], 200 if side < 0 else -20, 380 if side < 0 else 160,
                  fill=ink, width=int(1.1 * S))
    if beast.get("whiskers"):
        for side in (-1, 1):
            for k in range(3):
                y = (20.6 + k * 1.9) * S
                x0, x1 = (2.0 * S, 9.4 * S) if side < 0 else (22.6 * S, 30.0 * S)
                tilt = (k - 1) * 0.9 * S
                d.line([(x0, y - tilt * side), (x1, y + tilt * side * 0.3)], fill=ink, width=int(1.15 * S))
    # mouth with fangs
    d.arc([10.5 * S, 21.5 * S, 21.5 * S, 27.8 * S], 20, 160, fill=ink, width=int(1.2 * S))
    for fx in (13.2, 18.8):
        d.polygon([(fx * S - 0.9 * S, 26.6 * S), (fx * S + 0.9 * S, 26.6 * S), (fx * S, 28.9 * S)], fill=(255, 250, 240, 255))
    marks = big.resize((32, 32), Image.LANCZOS)
    base.alpha_composite(marks)
    return base


def paint_belly(pal, seed, gold):
    img = paint_shroud(pal, seed, 64, alpha=(150, 215) if gold else (118, 210)).crop((0, 0, 32, 48))
    if not gold:
        return img
    S = 4
    big = Image.new("RGBA", (32 * S, 48 * S), (0, 0, 0, 0))
    d = ImageDraw.Draw(big)
    ink = pal["mark"] + (240,)
    cx, cy = 16 * S, 29 * S
    pts = []
    for i in range(160):      # the spiral seal on the belly
        a = i / 160 * 2.6 * 2 * math.pi
        rr = (0.6 + 8.6 * i / 160) * S
        pts.append((cx + math.cos(a) * rr, cy + math.sin(a) * rr * 1.05))
    d.line(pts, fill=ink, width=int(1.2 * S))
    d.ellipse([cx - 11 * S, cy - 11.5 * S, cx + 11 * S, cy + 11.5 * S], outline=ink, width=int(1.1 * S))
    for k in range(6):        # the collar: six magatama
        x = (4 + k * 4.8) * S
        d.ellipse([x - 1.3 * S, 3.2 * S, x + 1.3 * S, 5.8 * S], fill=ink)
        d.line([(x + 0.6 * S, 5.2 * S), (x + 1.8 * S, 7.2 * S)], fill=ink, width=S)
    d.line([(0, 9.5 * S), (32 * S, 9.5 * S)], fill=ink, width=int(0.9 * S))
    img.alpha_composite(big.resize((32, 48), Image.LANCZOS))
    return img


def paint_cloak(beast, bid, gold):
    pal = GOLD if gold else dict(col=beast["col"], core=beast["core"], dark=beast["dark"])
    seed = sum(map(ord, bid)) * 31 + (7 if gold else 0)
    img = Image.new("RGBA", (TW, TW), (0, 0, 0, 0))
    img.paste(paint_shroud(pal, seed), SH[:2])
    img.paste(paint_face(pal, beast, seed + 1, gold), FACE[:2])
    img.paste(paint_belly(pal, seed + 2, gold), BELLY[:2])
    tip = dict(col=beast["col"], core=beast["core"], dark=beast["dark"]) if gold else None
    img.paste(paint_tail_bands(pal, seed + 3, tip), TAIL[:2])
    for k in range(4):
        img.paste(paint_flame(pal, 16, 32, seed + 10 + k, lean=(-1, 0.5, 1, -0.4)[k]), (FLAME[0] + 16 * k, FLAME[1]))
        tp = tip if gold else pal
        img.paste(paint_bulb(tp), (TIP[0] + 16 * k, TIP[1]))
        img.paste(paint_flame(tp, 16, 16, seed + 20 + k).rotate(-90), (TIP[0] + 16 * k, TIP[1] + 16))
    img.paste(paint_part(tip or pal, seed + 4), PART[:2])
    img.paste(paint_mark(GOLD, seed + 5) if gold else paint_shroud(pal, seed + 5, 32), MARK[:2])
    img.paste(paint_wing(tip or pal, seed + 6), WING[:2])
    img.paste(Image.new("RGBA", NONE[2:], (0, 0, 0, 0)), NONE[:2])
    return img


# ---------------------------------------------------------------------------
# Geometry
# ---------------------------------------------------------------------------
class Geo:
    def __init__(self, ident, tw=TW, th=TW, seed=1):
        self.ident, self.tw, self.th = ident, tw, th
        self.bones, self.idx = [], {}
        self.rng = np.random.default_rng(seed)

    def bone(self, name, parent=None, pivot=(0, 0, 0), rotation=None):
        b = {"name": name, "pivot": [r2(v) for v in pivot]}
        if parent:
            b["parent"] = parent
        if rotation and any(abs(v) > 1e-6 for v in rotation):
            b["rotation"] = [r2(v) for v in rotation]
        b["cubes"] = []
        self.bones.append(b)
        self.idx[name] = b
        return name

    def faces(self, size, region, density=2.0, only=None, full=None):
        """Per-face UVs: every face shows a window of `region` at `density` texels per pixel; faces not in `only`
        are transparent; faces in `full` show the whole region."""
        wd, ht, dp = size
        dims = {"north": (wd, ht), "south": (wd, ht), "east": (dp, ht), "west": (dp, ht), "up": (wd, dp), "down": (wd, dp)}
        rx, ry, rw, rh = region
        out = {}
        for f, (fw, fh) in dims.items():
            if only is not None and f not in only:
                out[f] = {"uv": [NONE[0] + 1, NONE[1] + 1], "uv_size": [2, 2]}
                continue
            if full and f in full:
                out[f] = {"uv": [rx, ry], "uv_size": [rw, rh]}
                continue
            uw = int(min(rw, max(1, round(fw * density))))
            vh = int(min(rh, max(1, round(fh * density))))
            u = rx + int(self.rng.integers(0, rw - uw + 1))
            v = ry + int(self.rng.integers(0, rh - vh + 1))
            out[f] = {"uv": [u, v], "uv_size": [uw, vh]}
        return out

    def cube(self, bone, origin, size, uv, inflate=0.0, rotation=None, pivot=None):
        c = {"origin": [r2(v) for v in origin], "size": [r2(v) for v in size], "uv": uv}
        if inflate:
            c["inflate"] = r2(inflate)
        if rotation and any(abs(v) > 1e-6 for v in rotation):
            c["rotation"] = [r2(v) for v in rotation]
            c["pivot"] = [r2(v) for v in (pivot or [origin[i] + size[i] / 2 for i in range(3)])]
        self.idx[bone]["cubes"].append(c)

    def json(self):
        return {"format_version": "1.12.0", "minecraft:geometry": [{
            "description": {"identifier": self.ident, "texture_width": self.tw, "texture_height": self.th,
                            "visible_bounds_width": 6, "visible_bounds_height": 4.5, "visible_bounds_offset": [0, 1.4, 0]},
            "bones": [{k: v for k, v in b.items() if k != "cubes" or v} for b in self.bones]}]}


def skeleton(g):
    """The player's bones (the cloak follows them) plus the containers the animations scale."""
    g.bone("root")
    g.bone("waist", "root", (0, 12, 0))
    g.bone("body", "waist", (0, 24, 0))
    g.bone("head", "body", (0, 24, 0))
    g.bone("rightArm", "body", (-5, 22, 0))
    g.bone("leftArm", "body", (5, 22, 0))
    g.bone("rightLeg", "root", (-1.9, 12, 0))
    g.bone("leftLeg", "root", (1.9, 12, 0))
    for sh, par, piv in (("sh_body", "body", (0, 12, 0)), ("sh_head", "head", (0, 24, 0)), ("sh_rarm", "rightArm", (-5, 22, 0)),
                         ("sh_larm", "leftArm", (5, 22, 0)), ("sh_rleg", "rightLeg", (-1.9, 12, 0)), ("sh_lleg", "leftLeg", (1.9, 12, 0))):
        g.bone(sh, par, piv)
        g.bone(sh + "_core", sh, piv)       # the breathing layer
    g.bone("tails", "body", (0, 13.5, 2.5))


SHELLS = {   # bone: (origin, size, inflate)
    "sh_body": ((-4, 12, -2), (8, 12, 4), 1.05),
    "sh_head": ((-4, 24, -4), (8, 8, 8), 1.0),
    "sh_rarm": ((-8, 12, -2), (4, 12, 4), 0.8),
    "sh_larm": ((4, 12, -2), (4, 12, 4), 0.8),
    "sh_rleg": ((-3.9, 0, -2), (4, 12, 4), 0.72),
    "sh_lleg": ((-0.1, 0, -2), (4, 12, 4), 0.72),
}


def tail_layout(beast):
    """[(base x, yaw, pitch)] for each tail, fanned behind the body; sprout order from the middle outward."""
    n = beast["tails"]
    t0, t1, lens, pitch, curl = beast["tail"]
    spread = {1: 0, 2: 26, 3: 42, 4: 56, 5: 66, 6: 76, 7: 82, 8: 90, 9: 98}[n]
    out = []
    for i in range(n):
        u = 0.5 if n == 1 else i / (n - 1)
        yaw = (u - 0.5) * 2 * spread
        lift = 1 - abs(2 * u - 1) ** 1.5 if n > 2 else 1
        out.append(((u - 0.5) * (3.6 if n > 1 else 0), yaw, pitch + (24 if n > 2 else 8) * lift))
    order = sorted(range(n), key=lambda i: (abs(i - (n - 1) / 2), i))
    return out, order


def add_tails(g, beast, glow=False):
    t0, t1, lens, pitch, curl = beast["tail"]
    layout, _ = tail_layout(beast)
    K = len(lens)
    by, bz = 13.5, 2.4
    for i, (bx, yaw, pt) in enumerate(layout):
        g.bone(f"tail{i}", "tails", (bx, by, bz))
        z = bz
        parent = f"tail{i}"
        for k, L in enumerate(lens):
            s = t0 + (t1 - t0) * k / (K - 1)
            out_curl = 0 if abs(yaw) < 1 else math.copysign(min(6, abs(yaw) / 14), yaw)   # outer tails also bend outward
            rot = (pt, yaw, 0) if k == 0 else (curl, out_curl, 0)
            name = g.bone(f"t{i}_{k}", parent, (bx, by, z), rot)
            if glow:
                g.cube(name, (bx - s / 2, by - s / 2, z - 0.2), (s, s, L + 0.4), g.faces((s, s, L + 0.4), (0, 0, GW, GW), 2), inflate=0.45)
            else:
                band = (TAIL[0], TAIL[1] + k * 5, TAIL[2], 5)
                g.cube(name, (bx - s / 2, by - s / 2, z - 0.15), (s, s, L + 0.3), g.faces((s, s, L + 0.3), band, 1.5), inflate=0.12)
            z += L
            parent = name
        if glow:
            continue
        # the tip: two crossed flame blades continuing the tail (the flame texture points along the tail)
        tip = g.bone(f"t{i}_tip", parent, (bx, by, z), (curl * 0.6, 0, 0))
        v = int(g.rng.integers(0, 4))
        fl = [TIP[0] + 16 * v, TIP[1] + 16]
        ln, ht = 4.6 + t1, 1.6 + t1 * 1.5
        side = lambda f: {"uv": fl, "uv_size": [16, 16]} if f == "east" else {"uv": [fl[0] + 16, fl[1]], "uv_size": [-16, 16]}
        blank = {"uv": [NONE[0] + 1, NONE[1] + 1], "uv_size": [2, 2]}
        g.cube(tip, (bx - 0.2, by - ht / 2, z - 0.6), (0.4, ht, ln), {"east": side("east"), "west": side("west"),
                                                                     **{f: blank for f in ("north", "south", "up", "down")}})
        g.cube(tip, (bx - ht / 2, by - 0.2, z - 0.6), (ht, 0.4, ln),
               {"up": {"uv": [FLAME[0] + 16 * v, FLAME[1]], "uv_size": [16, 32]}, "down": {"uv": [FLAME[0] + 16 * v, FLAME[1]], "uv_size": [16, 32]},
                **{f: blank for f in ("north", "south", "east", "west")}})


def wisp(g, parent, name, base, size, rot, variant):
    """A flame wisp: a thin plate showing one of the flame textures on its two broad faces."""
    b = g.bone(name, parent, base, rot)
    fx = FLAME[0] + 16 * (variant % 4)
    uv = {"north": {"uv": [fx, FLAME[1]], "uv_size": [16, 32]}, "south": {"uv": [fx, FLAME[1]], "uv_size": [16, 32]},
          **{f: {"uv": [NONE[0] + 1, NONE[1] + 1], "uv_size": [2, 2]} for f in ("east", "west", "up", "down")}}
    g.cube(b, (base[0] - size[0] / 2, base[1], base[2] - 0.2), (size[0], size[1], 0.4), uv)
    return b


def add_wisps(g):
    names = []
    for side, sx in (("r", -1), ("l", 1)):
        names.append(wisp(g, "sh_body", f"w_sh{side}0", (sx * 4.4, 24.4, -1.0), (2.6, 4.2), (0, 0, sx * 26), 0))
        names.append(wisp(g, "sh_body", f"w_sh{side}1", (sx * 4.0, 24.4, 1.3), (2.4, 3.6), (14, 0, sx * 18), 2))
        names.append(wisp(g, "sh_rarm" if sx < 0 else "sh_larm", f"w_el{side}", (sx * 6, 15.5, 3.1), (1.8, 3.2), (78, 0, sx * 8), 1))
        names.append(wisp(g, "sh_rleg" if sx < 0 else "sh_lleg", f"w_he{side}", (sx * 1.9, 1.2, 3.0), (1.6, 2.8), (70, 0, 0), 3))
    for k, x in enumerate((-2.2, 0, 2.2)):
        names.append(wisp(g, "sh_body", f"w_bk{k}", (x, 19.5 + (k == 1) * 2.5, 3.2), (2.4, 4.4 if k == 1 else 3.6), (34, 0, -x * 5), k + 1))
        names.append(wisp(g, "sh_head", f"w_hd{k}", (x * 0.9, 32.6, 2.0 + (k != 1) * 0.6), (2.2, 3.6 if k == 1 else 3.0), (-18, 0, -x * 9), k))
    return names


def claws(g):
    for side, sx in (("r", -1), ("l", 1)):
        b = g.bone(f"claw_{side}", "sh_rarm" if sx < 0 else "sh_larm", (sx * 6, 11, 0))
        for k, z in enumerate((-1.6, -0.2, 1.2)):
            g.cube(b, (sx * 6 - 0.45 + (k - 1) * 0.15 * sx, 9.0, z - 0.45), (0.9, 2.6, 0.9), g.faces((0.9, 2.6, 0.9), PART, 2),
                   rotation=(-22, 0, 0), pivot=(sx * 6, 11.2, z))


def stack(g, bone, base, layers, region=PART):
    """Tapering stacked boxes going up from `base` (an ear, a horn)."""
    x, y, z = base
    for wd, ht, dp in layers:
        g.cube(bone, (x - wd / 2, y, z - dp / 2), (wd, ht, dp), g.faces((wd, ht, dp), region, 2), inflate=0.05)
        y += ht - 0.15


def add_ears(g, beast):
    """The beast's ears / horns / stalks under one 'ears' group that pops in after the shroud."""
    g.bone("ears", "sh_head", (0, 33, 0))
    kind = beast["ears"]
    mirror = (("r", -1), ("l", 1))
    if kind in ("fox", "cat", "tanuki"):
        spec = {"fox": ([(3.2, 2.6, 1.4), (2.2, 2.6, 1.2), (1.2, 2.4, 1.0)], 2.9, 16, -6),
                "cat": ([(3.4, 2.2, 1.3), (2.3, 2.0, 1.1), (1.2, 1.6, 0.9)], 3.0, 11, -8),
                "tanuki": ([(3.4, 2.1, 1.4), (2.4, 1.3, 1.2)], 3.3, 30, 0)}[kind]
        layers, x, tilt, lean = spec
        for side, sx in mirror:
            b = g.bone(f"ear_{side}", "ears", (sx * x, 32.8, -0.4), (lean, 0, sx * tilt))
            stack(g, b, (sx * x, 32.8, -0.4), layers)
    elif kind == "ape":
        for side, sx in mirror:
            b = g.bone(f"ear_{side}", "ears", (sx * 4.6, 30.4, -1.2), (12, 0, sx * 40))
            stack(g, b, (sx * 4.6, 30.4, -1.2), [(1.8, 3.0, 1.8), (1.3, 2.4, 1.3), (0.8, 1.6, 0.8)])
    elif kind == "horse":
        b = g.bone("ear_c", "ears", (0, 31.6, -4.6), (34, 0, 0))
        stack(g, b, (0, 31.6, -4.6), [(1.6, 3.2, 1.6), (1.1, 2.6, 1.1), (0.6, 2.0, 0.6)])
        for side, sx in mirror:
            b = g.bone(f"ear_{side}", "ears", (sx * 3.1, 32.6, -2.0), (10, 0, sx * 24))
            stack(g, b, (sx * 3.1, 32.6, -2.0), [(1.2, 2.2, 1.2), (0.7, 1.6, 0.7)])
    elif kind == "slug":
        for side, sx in mirror:
            b = g.bone(f"ear_{side}", "ears", (sx * 2.0, 32.8, -1.6), (-6, 0, sx * 14))
            g.cube(b, (sx * 2.0 - 0.45, 32.8, -2.05), (0.9, 5.0, 0.9), g.faces((0.9, 5, 0.9), PART, 2))
            g.cube(b, (sx * 2.0 - 1.0, 37.4, -2.6), (2.0, 2.0, 2.0), g.faces((2, 2, 2), TIP, 3))
    elif kind == "beetle":
        b = g.bone("ear_c", "ears", (0, 30.2, -5.0), (40, 0, 0))
        stack(g, b, (0, 30.2, -5.0), [(2.2, 3.0, 2.2), (1.6, 2.6, 1.6)])
        b2 = g.bone("ear_c1", "ear_c", (0, 35.6, -5.0), (-36, 0, 0))
        stack(g, b2, (0, 35.6, -5.0), [(1.1, 2.4, 1.1), (0.6, 1.6, 0.6)])
    elif kind == "ox":
        for side, sx in mirror:
            b = g.bone(f"ear_{side}", "ears", (sx * 4.6, 30.2, 0), (0, 0, 0))
            g.cube(b, (sx * 4.6 if sx > 0 else sx * 4.6 - 4.2, 29.1, -1.1), (4.2, 2.2, 2.2), g.faces((4.2, 2.2, 2.2), PART, 2))
            b1 = g.bone(f"ear_{side}1", b, (sx * 8.4, 30.2, 0), (0, 0, -sx * 10))
            stack(g, b1, (sx * 8.4, 30.0, 0), [(2.0, 3.2, 2.0)])
            b2 = g.bone(f"ear_{side}2", b1, (sx * 8.4, 33.0, 0), (0, 0, -sx * 34))
            stack(g, b2, (sx * 8.4, 33.0, 0), [(1.3, 2.4, 1.3), (0.7, 1.6, 0.7)])
    elif kind == "turtle":
        for k, z in enumerate((-2.2, 0.2, 2.6)):
            b = g.bone(f"ear_{k}", "ears", (0, 32.8, z), (-10, 0, 0))
            stack(g, b, (0, 32.8, z), [(1.4, 1.4, 1.4), (0.8, 1.2, 0.8)])
        # the shell on the back, with three spikes
        g.bone("shell", "sh_body", (0, 18, 3.2))
        g.cube("shell", (-4.6, 13.2, 2.9), (9.2, 10.4, 1.8), g.faces((9.2, 10.4, 1.8), PART, 2), inflate=0.2)
        for k, y in enumerate((14.6, 18.2, 21.8)):
            g.cube("shell", (-0.7, y, 4.4), (1.4, 1.4, 2.2), g.faces((1.4, 1.4, 2.2), PART, 2), rotation=(-20, 0, 0), pivot=(0, y, 4.6))
    return kind


def add_wings(g, beast):
    if not beast.get("wings"):
        return []
    g.bone("wings", "sh_body", (0, 21, 3))
    out = []
    for k in range(beast["wings"] // 2):
        for side, sx in (("r", -1), ("l", 1)):
            piv = (sx * 1.4, 22.6 - k * 2.2, 3.0)
            b = g.bone(f"wing_{side}{k}", "wings", piv, (20 - k * 17, sx * (46 + k * 20), sx * (-22 - k * 10)))
            ln, ht = 15 - k * 2.5, 4.8 - k * 0.6
            uv = {"uv": [WING[0] + 1, WING[1] + 2 + 23 * k], "uv_size": [int(min(30, ln * 2)), int(min(20, ht * 4))]}
            g.cube(b, (piv[0] - 0.2, piv[1] - ht / 2, piv[2]), (0.4, ht, ln),
                   {"east": uv, "west": uv, **{f: {"uv": [NONE[0] + 1, NONE[1] + 1], "uv_size": [2, 2]} for f in ("north", "south", "up", "down")}})
            out.append(b)
    return out


def add_mastered(g):
    """Tailed Beast Chakra Mode: a flame crest on the head and two coat tails at the back."""
    g.bone("crest", "sh_head", (0, 33, 0))
    crest = [wisp(g, "crest", "cr_r", (-2.4, 32.6, -0.6), (2.8, 6.0), (-8, 0, -16), 1),
             wisp(g, "crest", "cr_l", (2.4, 32.6, -0.6), (2.8, 6.0), (-8, 0, 16), 2),
             wisp(g, "crest", "cr_c", (0, 32.8, 0.8), (2.2, 4.4), (-20, 0, 0), 0)]
    g.bone("flaps", "sh_body", (0, 12.5, 2.4))
    flaps = []
    for side, sx in (("r", -1), ("l", 1)):
        b = g.bone(f"flap_{side}", "flaps", (sx * 2.2, 12.6, 2.6), (16, 0, sx * 6))
        g.cube(b, (sx * 2.2 - 1.7, 3.6, 2.4), (3.4, 9.0, 0.5), g.faces((3.4, 9, 0.5), MARK, 2, only=("north", "south")))
        flaps.append(b)
    return crest, flaps


def build_cloak(bid, beast, gold):
    g = Geo(f"geometry.aegis.jin_{bid}{'_m' if gold else ''}", seed=sum(map(ord, bid)) + (5 if gold else 0))
    skeleton(g)
    for bone, (o, s, inf) in SHELLS.items():
        if bone == "sh_body":
            uv = g.faces(s, SH, 2.2)
            uv["north"] = {"uv": [BELLY[0], BELLY[1]], "uv_size": [BELLY[2], BELLY[3]]}
        elif bone == "sh_head":
            uv = g.faces(s, SH, 2.2)
            uv["north"] = {"uv": [FACE[0], FACE[1]], "uv_size": [FACE[2], FACE[3]]}
        elif gold and bone in ("sh_rarm", "sh_larm"):
            uv = g.faces(s, MARK, 2.0)
            for f in ("north", "south", "east", "west"):
                uv[f] = {"uv": [MARK[0] + (0 if f in ("north", "south") else 8), MARK[1]], "uv_size": [8, 32]}
        else:
            uv = g.faces(s, SH, 2.2)
        g.cube(bone + "_core", o, s, uv, inflate=inf)
    claws(g)
    wisps = add_wisps(g)
    add_ears(g, beast)
    wings = add_wings(g, beast)
    add_tails(g, beast)
    crest, flaps = add_mastered(g) if gold else ([], [])
    return g, wisps, wings, crest, flaps


def build_glow(bid, beast):
    """The additive glow layer: the mastered cloak's whole skeleton (so both cloaks' animations find every bone),
    with slightly bigger shells and tails whose faces show windows of the scrolling glow texture."""
    full = build_cloak(bid, beast, True)[0]
    tails = Geo("tmp", tw=GW, th=GW, seed=sum(map(ord, bid)) + 9)
    skeleton(tails)
    add_tails(tails, beast, glow=True)
    g = Geo(f"geometry.aegis.jin_{bid}_glow", tw=GW, th=GW, seed=sum(map(ord, bid)) + 9)
    for b in full.bones:
        g.bone(b["name"], b.get("parent"), b["pivot"], b.get("rotation"))
        if b["name"] in tails.idx:
            g.idx[b["name"]]["cubes"] = tails.idx[b["name"]]["cubes"]
    for bone, (o, s, inf) in SHELLS.items():
        g.cube(bone + "_core", o, s, g.faces(s, (0, 0, GW, GW), 2.4), inflate=inf + 0.35)
    return g


# ---------------------------------------------------------------------------
# Animations
# ---------------------------------------------------------------------------
def kf(t):
    return f"{t:.3f}".rstrip("0").rstrip(".") or "0"


def pop(t, peak=1.22, grow=0.16, settle=0.12, start=0.01):
    """Scale keys: hidden until t, overshoot, settle at 1."""
    s = lambda v: [v, v, v]
    keys = {"0": s(start)}
    if t > 0.02:
        keys[kf(t)] = s(start)
    keys[kf(t + grow)] = s(peak)
    keys[kf(t + grow + settle)] = s(1.0)
    return {"scale": keys}


def form_anim(beast, wings, gold):
    bones = {"sh_rleg": pop(FORM["legs"]), "sh_lleg": pop(FORM["legs"] + 0.03), "sh_body": pop(FORM["body"], 1.16),
             "sh_rarm": pop(FORM["arms"]), "sh_larm": pop(FORM["arms"] + 0.03), "sh_head": pop(FORM["head"], 1.18),
             "ears": pop(FORM["ears"], 1.3, 0.12, 0.1)}
    _, order = tail_layout(beast)
    for rank, i in enumerate(order):
        bones[f"tail{i}"] = pop(FORM["tails"] + rank * FORM["tail_gap"], 1.28, 0.16, 0.14)
    if wings:
        bones["wings"] = pop(FORM["tails"] + 0.18, 1.2, 0.18, 0.12)
    if gold:
        bones["crest"] = pop(FORM["crest"], 1.3, 0.12, 0.1)
        bones["flaps"] = pop(FORM["flaps"], 1.15, 0.16, 0.12)
    return {"loop": "hold_on_last_frame", "animation_length": FORM_LEN, "bones": bones}


def wave(amp, phase, freq=1, n=16, axis=0, base=(0, 0, 0)):
    """Keyframes for one sine over the loop (freq whole cycles per loop) on one rotation axis."""
    keys = {}
    for i in range(n + 1):
        t = SWAY_LEN * i / n
        v = list(base)
        v[axis] += amp * math.sin(2 * math.pi * freq * t / SWAY_LEN + phase)
        keys[kf(t)] = [round(x, 2) for x in v]
    return keys


def sway_anim(beast, wisps, wings, crest, flaps):
    rng = np.random.default_rng(len(beast["name"]) * 17 + beast["tails"])
    bones = {}
    lens = beast["tail"][2]
    tent = 1.7 if beast["ears"] == "ox" else 1.0          # Gyuki's tentacles curl harder
    for i in range(beast["tails"]):
        ph, ph2 = rng.uniform(0, 2 * math.pi), rng.uniform(0, 2 * math.pi)
        for k in range(len(lens)):
            ax = (3 + 2.4 * k) * tent
            ay = (4 + 3.0 * k) * tent
            rx = wave(ax, ph - 0.85 * k, 1)
            ry = wave(ay, ph2 - 0.85 * k, 1, axis=1)
            bones[f"t{i}_{k}"] = {"rotation": {t: [rx[t][0], ry[t][1], 0] for t in rx}}
    for name in wisps + [c for c in crest]:
        ph = rng.uniform(0, 2 * math.pi)
        keys = {}
        for j in range(17):
            t = SWAY_LEN * j / 16
            sy = 1 + 0.2 * math.sin(4 * math.pi * t / SWAY_LEN + ph) + 0.08 * math.sin(10 * math.pi * t / SWAY_LEN + ph * 2)
            keys[kf(t)] = [round(1 - (sy - 1) * 0.4, 3), round(sy, 3), 1]
        bones[name] = {"scale": keys}
    for bone in ("sh_body_core", "sh_head_core", "sh_rarm_core", "sh_larm_core", "sh_rleg_core", "sh_lleg_core"):
        ph = rng.uniform(0, 2 * math.pi)
        keys = {}
        for j in range(9):
            t = SWAY_LEN * j / 8
            s = 1 + 0.028 * math.sin(4 * math.pi * t / SWAY_LEN + ph)
            keys[kf(t)] = [round(s, 4)] * 3
        bones[bone] = {"scale": keys}
    for side in ("r", "l"):
        if beast["ears"] in ("fox", "cat", "tanuki"):
            bones[f"ear_{side}"] = {"rotation": wave(3, rng.uniform(0, 6), 2, axis=2)}
    for wname in wings:
        sx = -1 if "_r" in wname else 1
        keys = {}
        for j in range(33):   # fast insect flutter: 8 beats per loop
            t = SWAY_LEN * j / 32
            keys[kf(t)] = [0, round(sx * 16 * math.sin(16 * math.pi * t / SWAY_LEN), 2), round(sx * 6 * math.sin(16 * math.pi * t / SWAY_LEN + 1), 2)]
        bones[wname] = {"rotation": keys}
    for k, fl in enumerate(flaps):
        bones[fl] = {"rotation": wave(7, k * 1.7, 1)}
    return {"loop": True, "animation_length": SWAY_LEN, "bones": bones}


# ---------------------------------------------------------------------------
# Icons
# ---------------------------------------------------------------------------
FLAME_ICON = ["................", ".......O........", "......OO........", "......OYO.......", ".....OYYO...O...",
              "....OOYYOO.OO...", "...OOYYWYOOO....", "...OYYWWWYYO....", "..OOYWWWWWYOO...", "..OYYWWWWWYYO...",
              "..OYYWWWWWYYO...", "..OOYYWWWYYOO...", "...OOYYYYYOO....", "....OOOOOOO.....", "................", "................"]


def icon(rgb, core=None):
    img = Image.new("RGBA", (16, 16), (0, 0, 0, 0))
    pal = {"O": tuple(int(c * 0.8) for c in rgb) + (255,), "Y": tuple(min(255, int(c * 1.15) + 20) for c in rgb) + (255,),
           "W": (core or (255, 250, 235)) + (255,)}
    for y, row in enumerate(FLAME_ICON):
        for x, ch in enumerate(row):
            if ch in pal:
                img.putpixel((x, y), pal[ch])
    return img


# ---------------------------------------------------------------------------
# Write everything
# ---------------------------------------------------------------------------
def main():
    ARMOR.mkdir(parents=True, exist_ok=True)
    anims = {}
    atlas_p = RP / "textures" / "item_texture.json"
    atlas = json.loads(atlas_p.read_text())
    atlas["texture_data"].pop("aegis_bijuu_cloak", None)
    paint_glow(GOLD, 99).save(ARMOR / "jin_glow_gold.png")
    for bid, beast in BEASTS.items():
        pal = dict(col=beast["col"], core=beast["core"], dark=beast["dark"])
        paint_glow(pal, sum(map(ord, bid))).save(ARMOR / f"jin_glow_{bid}.png")
        w(RP / "models" / "entity" / f"jin_{bid}_glow.geo.json", build_glow(bid, beast).json())
        for gold in (False, True):
            sfx = "_m" if gold else ""
            g, wisps, wings, crest, flaps = build_cloak(bid, beast, gold)
            w(RP / "models" / "entity" / f"jin_{bid}{sfx}.geo.json", g.json())
            paint_cloak(beast, bid, gold).save(ARMOR / f"jin_{bid}{sfx}.png")
            anims[f"animation.aegis.jin_{bid}{sfx}.form"] = form_anim(beast, wings, gold)
            anims[f"animation.aegis.jin_{bid}{sfx}.sway"] = sway_anim(beast, wisps, wings, crest, flaps)
            item = f"aegis:cloak_{bid}{sfx}"
            w(RP / "attachables" / f"cloak_{bid}{sfx}.json", {"format_version": "1.10.0", "minecraft:attachable": {"description": {
                "identifier": item,
                "materials": {"default": "entity_alphablend", "glow": "charged_creeper"},
                "textures": {"default": f"textures/models/armor/jin_{bid}{sfx}",
                             "glow": f"textures/models/armor/jin_glow_{'gold' if gold else bid}"},
                "geometry": {"default": f"geometry.aegis.jin_{bid}{sfx}", "glow": f"geometry.aegis.jin_{bid}_glow"},
                "animations": {"form": f"animation.aegis.jin_{bid}{sfx}.form", "sway": f"animation.aegis.jin_{bid}{sfx}.sway"},
                "scripts": {"animate": ["form", "sway"]},
                "render_controllers": ["controller.render.aegis.jin_cloak", "controller.render.aegis.jin_glow"]}}})
            label = f"Tailed Beast Cloak ({beast['name']})" if not gold else f"Tailed Beast Chakra Mode ({beast['name']})"
            w(BP / "items" / f"cloak_{bid}{sfx}.json", {"format_version": "1.21.60", "minecraft:item": {
                "description": {"identifier": item, "menu_category": {"category": "equipment"}},
                "components": {
                    "minecraft:icon": {"textures": {"default": f"aegis_cloak_{bid}{sfx}"}},
                    "minecraft:display_name": {"value": label},
                    "minecraft:max_stack_size": 1, "minecraft:glint": True,
                    "minecraft:wearable": {"slot": "slot.armor.chest", "protection": 10 if gold else 8},
                    "minecraft:enchantable": {"slot": "armor_torso", "value": 15}}}})
            (icon(GOLD["col"], beast["core"]) if gold else icon(beast["col"])).save(RP / "textures" / "items" / "aegis" / f"cloak_{bid}{sfx}.png")
            atlas["texture_data"][f"aegis_cloak_{bid}{sfx}"] = {"textures": f"textures/items/aegis/cloak_{bid}{sfx}"}
    w(atlas_p, atlas)
    w(RP / "animations" / "jinchuriki.animation.json", {"format_version": "1.8.0", "animations": anims})
    w(RP / "render_controllers" / "jinchuriki.render_controllers.json", {"format_version": "1.8.0", "render_controllers": {
        "controller.render.aegis.jin_cloak": {
            "geometry": "Geometry.default", "materials": [{"*": "Material.default"}], "textures": ["Texture.default"],
            "ignore_lighting": True},
        "controller.render.aegis.jin_glow": {
            "geometry": "Geometry.glow", "materials": [{"*": "Material.glow"}], "textures": ["Texture.glow"],
            "ignore_lighting": True,
            "uv_anim": {"offset": [0.0, "math.mod(q.life_time * 0.35, 1.0)"], "scale": [1.0, 1.0]}}}})

    # the old v1 cloak assets are replaced
    for old in [*(RP / "models" / "entity").glob("cloak_*.geo.json"), RP / "animations" / "cloak.animation.json",
                *ARMOR.glob("cloak_*.png")]:
        old.unlink(missing_ok=True)

    # Tailed Beast Bomb: the charging orb grows in three stages; the mastered bomb flies bigger
    orb_p = BP / "entities" / "jutsu_orb.json"
    orb = json.loads(orb_p.read_text())
    e = orb["minecraft:entity"]
    stages = {"aegis:bomb_1": 0.55, "aegis:bomb_2": 1.0, "aegis:bomb_3": 1.6, "aegis:bomb_big": 2.1}
    for grp, sc in stages.items():
        e["component_groups"][grp] = {"minecraft:variant": {"value": 2}, "minecraft:scale": {"value": sc}}
    others = lambda keep: [g for g in [*stages, "aegis:bijuudama"] if g != keep]
    for k in (1, 2, 3):
        e["events"][f"aegis:bomb_grow_{k}"] = {"add": {"component_groups": [f"aegis:bomb_{k}"]},
                                               "remove": {"component_groups": others(f"aegis:bomb_{k}")}}
    e["events"]["aegis:as_bijuudama_big"] = {"add": {"component_groups": ["aegis:bomb_big"]}}
    w(orb_p, orb)
    print(f"Jinchūriki cloaks: {len(BEASTS)} beasts × 2 forms, {len(anims)} animations.")


if __name__ == "__main__":
    main()
