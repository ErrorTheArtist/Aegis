#!/usr/bin/env python3
"""Jujutsu Legacy creatures: the cursed spirits (Grade 4 to Special Grade), the Ten Shadows' shikigami and their
effect models — geometry, painted textures, idle/walk animations, BP + RP entities, spawn rules and names.

  Grade 4   jjk:fly_head        a floating head of eyes and teeth on buzzing bug wings
  Grade 3   jjk:lanky_curse     a tall, starved thing with arms to its knees and a mouth down its belly
  Grade 2   jjk:mouth_curse     a squat blob that is mostly jaw
  Grade 1   jjk:eye_curse       a hunched brute whose head is covered in eyes
  Special   jjk:finger_bearer   the boss that swallowed one of Sukuna's fingers (it drops it)
  Shikigami jjk:divine_dog_white / jjk:divine_dog_black   (Ten Shadows: Divine Dogs — they fight curses for 30 s)
  Shikigami jjk:mahoraga   the Eight-Handled Sword Divergent Sila Divine General: a boss you exorcise to tame
            (scripts/mahoraga.js: adaptation, the wheel, its attacks). Property jjk:turn turns the wheel.
  Effects   jjk:nue (the owl that strikes from above), jjk:max_elephant (falls from the sky) — moved by script

Front is −Z, 16 px = 1 block, feet at y 0. Run from the jjk-addon folder:  python3 tools/gen_entities.py
"""
import json
import math
import random
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
BP, RP = ROOT / "behavior_pack", ROOT / "resource_pack"


def w(path, obj):
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(obj, indent=2, ensure_ascii=False) + "\n")


# 128×128 atlas of 32×32 painted tiles
TILES = {"skin": (0, 0), "dark": (32, 0), "light": (64, 0), "accent": (96, 0),
         "mouth": (0, 32), "teeth": (32, 32), "eye": (64, 32), "pupil": (96, 32),
         "wing": (0, 64), "bone": (32, 64), "mark": (64, 64), "under": (96, 64),
         "claw": (0, 96), "steel": (32, 96)}


class Kit:
    def __init__(self, seed):
        self.rnd = random.Random(seed)
        self.bones, self.idx = [], {}

    def bone(self, name, parent=None, pivot=(0, 0, 0), rot=None):
        b = {"name": name, "pivot": [round(v, 3) for v in pivot], "cubes": []}
        if parent:
            b["parent"] = parent
        if rot:
            b["rotation"] = [round(v, 3) for v in rot]
        self.bones.append(b)
        self.idx[name] = b
        return name

    def face(self, tile, fw, fh):
        tx, ty = TILES[tile]
        uw, vh = max(0.5, min(30, fw)), max(0.5, min(30, fh))
        u = tx + 1 + self.rnd.random() * max(0, 30 - uw)
        v = ty + 1 + self.rnd.random() * max(0, 30 - vh)
        return {"uv": [round(u, 2), round(v, 2)], "uv_size": [round(uw, 2), round(vh, 2)]}

    def box(self, bone, o, s, tile="skin", top=None, under=None, front=None, inflate=0, rot=None, pivot=None):
        wd, ht, dp = s
        below = under or ("under" if tile == "skin" else tile)
        uv = {"north": self.face(front or tile, wd, ht), "south": self.face(tile, wd, ht), "east": self.face(tile, dp, ht),
              "west": self.face(tile, dp, ht), "up": self.face(top or tile, wd, dp), "down": self.face(below, wd, dp)}
        c = {"origin": [round(v, 3) for v in o], "size": [round(v, 3) for v in s], "uv": uv}
        if inflate:
            c["inflate"] = inflate
        if rot:
            c["rotation"] = [round(v, 3) for v in rot]
            c["pivot"] = [round(v, 3) for v in (pivot or [o[i] + s[i] / 2 for i in range(3)])]
        self.idx[bone]["cubes"].append(c)

    def eye(self, bone, x, y, z, size=2.0, pupil=1.0):
        """An eye on a front (−Z) face whose surface is at depth z."""
        self.box(bone, (x - size / 2, y - size / 2, z - 0.3), (size, size, 0.4), "eye")
        self.box(bone, (x - pupil / 2, y - pupil / 2, z - 0.5), (pupil, pupil, 0.3), "pupil")

    def geo(self, ident, bw, bh, oy):
        return {"format_version": "1.12.0", "minecraft:geometry": [{
            "description": {"identifier": ident, "texture_width": 128, "texture_height": 128,
                            "visible_bounds_width": bw, "visible_bounds_height": bh, "visible_bounds_offset": [0, oy, 0]},
            "bones": [{k: v for k, v in b.items() if k != "cubes" or v} for b in self.bones]}]}


# ---------------------------------------------------------------------------
# Textures
# ---------------------------------------------------------------------------
def clamp(v):
    return max(0, min(255, int(v)))


def value_noise(rnd, n=32, cells=5):
    """Smooth noise 0..1 (a coarse random grid, bilinearly stretched)."""
    g = [[rnd.random() for _ in range(cells + 1)] for _ in range(cells + 1)]
    out = [[0.0] * n for _ in range(n)]
    for x in range(n):
        for y in range(n):
            fx, fy = x / n * cells, y / n * cells
            ix, iy = int(fx), int(fy)
            ux, uy = fx - ix, fy - iy
            a = g[ix][iy] * (1 - ux) + g[ix + 1][iy] * ux
            b = g[ix][iy + 1] * (1 - ux) + g[ix + 1][iy + 1] * ux
            out[x][y] = a * (1 - uy) + b * uy
    return out


def veins(rnd, count, length, n=32, from_edge=True):
    """Branching lines (random walks), as a set of pixels."""
    pts = set()
    for _ in range(count):
        if from_edge:
            side = rnd.randrange(4)
            x, y = [(0, rnd.randrange(n)), (n - 1, rnd.randrange(n)), (rnd.randrange(n), 0), (rnd.randrange(n), n - 1)][side]
        else:
            x, y = rnd.randrange(n), rnd.randrange(n)
        dx, dy = rnd.choice([(1, 0), (-1, 0), (0, 1), (0, -1)])
        for _ in range(length):
            pts.add((x % n, y % n))
            if rnd.random() < 0.35:
                dx, dy = rnd.choice([(1, 0), (-1, 0), (0, 1), (0, -1), (dx, dy), (dx, dy)])
            x, y = x + dx, y + dy
    return pts


def paint(pal, seed, curse=True):
    """Each 32x32 tile painted in its own style: mottled skin with veins, bloodshot eyes, wet mouths, cracked bone...
    (shikigami and the elephant get the clean version: no veins, clear eyes)."""
    rnd = random.Random(seed)
    img = Image.new("RGBA", (128, 128), (0, 0, 0, 0))
    px = img.load()
    for name, (tx, ty) in TILES.items():
        base = pal.get(name)
        if base is None:
            continue
        noise = value_noise(rnd, 32, 5)
        fine = value_noise(rnd, 32, 12)
        vein = set()
        if not curse and name in ("skin", "under", "light", "accent", "eye"):
            pass
        elif name in ("skin", "under", "light", "accent"):
            vein = veins(rnd, 4, 26)
        elif name == "eye":
            vein = veins(rnd, 7, 12)
        elif name == "wing":
            vein = veins(rnd, 5, 30)
        elif name == "bone":
            vein = veins(rnd, 3, 14, from_edge=False)
        for x in range(32):
            for y in range(32):
                n_ = rnd.uniform(-1, 1)
                col = base
                k = 1.0
                if name in ("skin", "under", "dark", "light", "accent"):
                    k = 0.84 + noise[x][y] * 0.3 + (fine[x][y] - 0.5) * 0.12 + n_ * 0.035 - y * 0.002
                    if (x, y) in vein:
                        k *= 0.72
                    elif rnd.random() < 0.012:
                        k *= 1.18
                elif name == "mouth":
                    k = 0.45 + (y / 32) * 0.55 + n_ * 0.04
                    if (x + y * 3) % 11 == 0 and y < 20:
                        k *= 1.45                                   # wet highlights
                elif name == "teeth":
                    col = mix(base, (210, 190, 120), max(0, y - 18) / 30)
                    k = 1.04 - y * 0.006 + n_ * 0.03
                    if x % 5 == 4:
                        k *= 0.62                                   # gaps between the teeth
                elif name == "eye":
                    d = ((x - 16) ** 2 + (y - 16) ** 2) ** 0.5
                    k = 1.08 - d * 0.012 + n_ * 0.025
                    if (x, y) in vein and d > 5:
                        col = (190, 40, 46)                         # bloodshot
                        k = 1.0
                elif name == "pupil":
                    k = 0.9 + n_ * 0.05
                    if 6 <= x <= 9 and 6 <= y <= 9:
                        col, k = (255, 255, 255), 0.95              # a glint
                elif name == "wing":
                    k = 0.92 + noise[x][y] * 0.2 + n_ * 0.03
                    if (x, y) in vein:
                        k = 0.55
                elif name == "bone":
                    k = 0.92 + noise[x][y] * 0.14 + n_ * 0.03
                    if (x, y) in vein:
                        k = 0.62
                elif name == "claw":
                    k = 0.7 + (1 - y / 32) * 0.5 + n_ * 0.04
                elif name == "mark":
                    k = 1.0 + (0.18 if (x + y) % 6 < 2 else 0) + n_ * 0.04
                elif name == "steel":                               # polished: a cool gradient, a bright edge
                    k = 0.82 + (x / 32) * 0.3 + noise[x][y] * 0.06 + n_ * 0.015
                    if x % 16 in (0, 1):
                        k = 1.32
                else:
                    k = 1 + n_ * 0.06
                px[tx + x, ty + y] = (clamp(col[0] * k), clamp(col[1] * k), clamp(col[2] * k), 255)
    return img


def mix(a, b, u):
    return tuple(int(round(a[i] + (b[i] - a[i]) * u)) for i in range(3))


# ---------------------------------------------------------------------------
# Models
# ---------------------------------------------------------------------------
def m_fly_head(k):
    k.bone("root")
    k.bone("body", "root", (0, 9, 0))
    k.box("body", (-5, 4, -5), (10, 10, 10), "skin")
    k.box("body", (-4, 3, -4), (8, 1, 8), "dark")
    k.box("body", (-4, 5, -5.3), (8, 2.6, 0.4), "mouth")
    for i in range(5):
        k.box("body", (-3.6 + i * 1.6, 6.6, -5.55), (0.8, 1, 0.3), "teeth")
    for i in range(4):
        k.box("body", (-2.8 + i * 1.6, 5, -5.55), (0.8, 1, 0.3), "teeth")
    k.eye("body", 0, 10.6, -5, 3, 1.4)
    k.eye("body", -3, 11.8, -5, 1.6, 0.8)
    k.eye("body", 3, 11.8, -5, 1.6, 0.8)
    k.eye("body", -2.6, 8.8, -5, 1.1, 0.6)
    k.box("body", (-3, 14, -1), (1, 3, 1), "bone")
    k.box("body", (2, 14, -1), (1, 3, 1), "bone")
    for x in (-1.4, 1.0):                                        # antennae with bulbs
        k.box("body", (x, 14, 1.2), (0.4, 4.2, 0.4), "dark", rot=[-25, 0, x * 8], pivot=[x + 0.2, 14, 1.4])
    k.box("body", (-2.6, 17.4, 2.6), (1.0, 1.0, 1.0), "eye", rot=[-25, 0, -11], pivot=[-1.2, 14, 1.4])
    k.box("body", (1.4, 17.4, 2.6), (1.0, 1.0, 1.0), "eye", rot=[-25, 0, 8], pivot=[1.2, 14, 1.4])
    for x, ln in ((-2.2, 2.4), (1.4, 1.6), (-0.4, 3.0)):          # drool
        k.box("body", (x, 5 - ln, -5.0), (0.4, ln, 0.4), "light")
    for x in (-5.4, 4.8):                                          # small eyes on the sides
        k.box("body", (x, 10, -1.5), (0.6, 1.4, 1.4), "eye")
    for i, (x, side, z0) in enumerate(((5, 1, -2.2), (5, 1, 1.6), (-5, -1, -2.2), (-5, -1, 1.6))):
        k.bone(f"wing{i}", "body", (x, 12, z0))
        k.box(f"wing{i}", (x if side > 0 else x - 9, 12, z0 - 1.6), (9, 0.4, 3.2), "wing")
    for i in range(3):
        for side in (-1, 1):
            k.box("body", (side * 2.6 - 0.3, 0.4, -2.2 + i * 2.2), (0.6, 3.6, 0.6), "dark")


def m_lanky(k):
    k.bone("root")
    k.bone("leg0", "root", (-2, 17, 0))
    k.box("leg0", (-3.5, 0, -1.5), (3, 17, 3), "skin")
    k.box("leg0", (-3.7, 8, -1.7), (3.4, 2, 3.4), "dark")          # knobbly knees
    k.box("leg0", (-3.8, 0, -2.6), (3.6, 1.2, 4), "claw")
    k.bone("leg1", "root", (2, 17, 0))
    k.box("leg1", (0.5, 0, -1.5), (3, 17, 3), "skin")
    k.box("leg1", (0.3, 8, -1.7), (3.4, 2, 3.4), "dark")
    k.box("leg1", (0.2, 0, -2.6), (3.6, 1.2, 4), "claw")
    k.bone("body", "root", (0, 17, 0))
    k.box("body", (-4.5, 17, -2.5), (9, 13, 5), "skin")
    for y in (22.6, 24.6, 26.6):
        k.box("body", (-4.1, y, -2.75), (8.2, 0.6, 0.4), "dark")
    k.box("body", (-1.5, 18, -2.9), (3, 7.4, 0.5), "mouth")
    for i in range(4):
        k.box("body", (-1.9, 18.4 + i * 1.7, -3.15), (0.8, 0.9, 0.3), "teeth")
        k.box("body", (1.1, 19.2 + i * 1.7, -3.15), (0.8, 0.9, 0.3), "teeth")
    k.bone("arm0", "body", (-5.5, 29, 0))
    k.box("arm0", (-7, 6, -1.25), (2.5, 23, 2.5), "skin")
    k.box("arm0", (-7.3, 3.4, -1.6), (3.1, 2.8, 3.2), "claw")
    k.bone("arm1", "body", (5.5, 29, 0))
    k.box("arm1", (4.5, 6, -1.25), (2.5, 23, 2.5), "skin")
    k.box("arm1", (4.2, 3.4, -1.6), (3.1, 2.8, 3.2), "claw")
    k.box("body", (-1.2, 29.5, -1.2), (2.4, 1.6, 2.4), "skin")                        # a thin neck
    for side, name in ((-1, "arm0"), (1, "arm1")):
        x0 = -7 if side < 0 else 4.5
        for f in range(3):                                                             # long, thin fingers
            k.box(name, (x0 + 0.2 + f * 0.85, 0.4, -0.6 + (f % 2) * 0.4), (0.5, 3.4, 0.5), "claw")
    k.bone("head", "body", (0, 30, 0))
    k.box("head", (-3, 30, -3), (6, 8, 6), "skin")
    for x in (-1.8, 0, 1.8):
        for y in (35.6, 33.6):
            k.eye("head", x, y, -3, 1.4, 0.7)
    k.box("head", (-2, 31, -3.25), (4, 0.8, 0.3), "mouth")
    k.box("head", (-2, 38, -1), (1, 2.2, 1), "bone")
    k.box("head", (1, 38, -1), (1, 2.2, 1), "bone")


def m_mouth(k):
    k.bone("root")
    for i, (x, z) in enumerate(((-6, -5), (6, -5), (-6, 5), (6, 5))):
        k.bone(f"leg{i}", "root", (x, 5, z))
        k.box(f"leg{i}", (x - 2, 0, z - 2), (4, 5, 4), "skin")
        k.box(f"leg{i}", (x - 2.3, 0, z - 2.8), (4.6, 1, 1.2), "claw")
    k.bone("body", "root", (0, 5, 0))
    k.box("body", (-9, 5, -8), (18, 13, 17), "skin")
    k.box("body", (-7, 17.5, -6), (14, 3, 12), "skin")
    k.eye("body", -4, 16, -8, 2.2, 1.0)
    k.eye("body", 4, 16, -8, 2.2, 1.0)
    k.eye("body", 0, 17.6, -8, 1.6, 0.8)
    k.box("body", (-8, 6, -8.3), (16, 8, 0.4), "mouth")
    for i in range(8):
        k.box("body", (-7.6 + i * 2, 11.6, -8.65), (1.2, 2.4, 0.5), "teeth")
    for i in range(4):
        k.box("body", (-1 + (i % 2) * 2 - 3 + i * 1.4, 20.5, -4 + i * 2.6), (2, 3, 2), "bone")
    for x, rz in ((-5, -18), (4, 18)):                                                  # eyes on stalks
        k.box("body", (x, 19.5, -3), (1, 4.5, 1), "skin", rot=[10, 0, rz], pivot=[x + 0.5, 19.5, -2.5])
        k.box("body", (x - 0.7 + rz * 0.06, 23.4, -3.7), (2.4, 2.4, 2.4), "eye", rot=[10, 0, rz], pivot=[x + 0.5, 19.5, -2.5])
    for side in (-1, 1):                                                                 # stubby arms
        k.box("body", (side * 9.2 - (2 if side < 0 else 0), 8, -3), (2, 4, 3), "skin")
        k.box("body", (side * 9.2 - (2.4 if side < 0 else -0.2), 6.6, -3.6), (2.2, 1.6, 1.4), "claw")
    k.bone("jaw", "body", (0, 8, -6))
    k.box("jaw", (-8.5, 5, -9), (17, 3, 6), "skin")
    for i in range(7):
        k.box("jaw", (-7 + i * 2, 8, -8.85), (1.2, 2.2, 0.5), "teeth")
    k.box("jaw", (-2, 7.6, -7.6), (4, 1, 5), "accent")
    k.box("jaw", (-1.6, 6.4, -10.6), (3.2, 1.2, 3.4), "accent", rot=[24, 0, 0], pivot=[0, 7.6, -7.6])   # the tongue lolls out
    for i in range(6):
        k.box("jaw", (-6 + i * 2.1, 8, -7.2), (1.0, 1.6, 0.5), "teeth")                              # a second row


def m_eye_curse(k):
    k.bone("root")
    k.bone("leg0", "root", (-3.5, 12, 1))
    k.box("leg0", (-6, 0, -1.5), (5, 12, 5), "skin")
    k.box("leg0", (-6.3, 0, -2.6), (5.6, 2, 6), "dark")
    k.bone("leg1", "root", (3.5, 12, 1))
    k.box("leg1", (1, 0, -1.5), (5, 12, 5), "skin")
    k.box("leg1", (0.7, 0, -2.6), (5.6, 2, 6), "dark")
    k.bone("body", "root", (0, 12, 0))
    k.box("body", (-7, 12, -4), (14, 13, 10), "skin")
    k.box("body", (-8, 21.5, -3), (16, 5, 9), "skin", inflate=0.3)
    for i in range(4):
        k.box("body", (-0.8, 27, -1.5 + i * 2.6), (1.6, 3 - i * 0.4, 1.6), "bone")
    k.box("body", (-5, 13, -4.4), (10, 8, 0.5), "light")
    for x in (-6.2, 4.6):                                                                  # eyes on the shoulders
        k.box("body", (x, 23.2, -3.4), (1.6, 1.6, 0.4), "eye")
        k.box("body", (x + 0.4, 23.6, -3.6), (0.8, 0.8, 0.3), "pupil")
    for i in range(5):                                                                     # spines down the back
        k.box("body", (-0.6, 15 + i * 2.4, 5.6), (1.2, 2.2, 1.6), "bone", rot=[-30, 0, 0], pivot=[0, 15 + i * 2.4, 6])
    k.box("body", (-6.5, 21, -4.6), (13, 0.6, 0.4), "dark")
    k.bone("head", "body", (0, 24, -3))
    k.box("head", (-6, 22, -12), (12, 10, 10), "skin")
    for x, y, s in ((-3.5, 29, 2.0), (0, 30, 2.6), (3.6, 28.6, 1.8), (-1.8, 26.6, 1.5), (2.0, 26.0, 1.4), (-4.6, 25.6, 1.2),
                    (4.7, 31, 1.1), (-0.2, 27.6, 1.0)):
        k.eye("head", x, y, -12, s, s * 0.48)
    k.box("head", (-4.5, 23.2, -12.3), (9, 2, 0.4), "mouth")
    for side in (-1, 1):                                                                  # curled horns
        k.box("head", (side * 4.2 - 0.8, 31, -8), (1.6, 3.4, 1.6), "bone", rot=[-20, 0, side * 30], pivot=[side * 4.2, 31, -7.2])
        k.box("head", (side * 5.6 - 0.6, 33.6, -7.0), (1.2, 2.4, 1.2), "bone", rot=[-50, 0, side * 50], pivot=[side * 5.6, 33.6, -6.4])
    for i in range(6):
        k.box("head", (-4.2 + i * 1.6, 24.4, -12.55), (0.9, 0.8, 0.3), "teeth")
    for side, x in ((-1, -8.5), (1, 8.5)):
        name = "arm0" if side < 0 else "arm1"
        k.bone(name, "body", (x, 24, -1))
        x0 = x - 2.5
        k.box(name, (x0, 4, -3.5), (5, 20, 6), "skin")
        k.box(name, (x0 - 0.3, 0, -4), (5.6, 4, 7), "dark")
        for f in range(3):
            k.box(name, (x0 + 0.4 + f * 1.7, -0.6, -5.2), (1, 1.2, 2), "claw")


def m_finger_bearer(k):
    k.bone("root")
    for name, x in (("leg0", -4.5), ("leg1", 4.5)):
        k.bone(name, "root", (x, 18, 0))
        k.box(name, (x - 3, 3, -3), (6, 15, 6), "skin")
        k.box(name, (x - 3.5, 0, -5), (7, 3, 9), "dark")
        for f in range(3):
            k.box(name, (x - 3 + f * 2.2, 0, -6.4), (1.4, 1.4, 1.6), "claw")
    k.bone("body", "root", (0, 18, 0))
    k.box("body", (-10, 18, -6), (20, 16, 12), "skin")
    k.box("body", (-9, 21, -6.4), (18, 0.6, 0.5), "dark")
    k.box("body", (-8, 25, -6.4), (16, 0.6, 0.5), "dark")
    k.box("body", (-0.4, 18.5, -6.5), (0.8, 14, 0.5), "dark")
    for i in range(4):                                                                     # ribs
        y = 22 + i * 2.6
        for x0 in (-8, 2):
            k.box("body", (x0, y, -6.7), (6, 0.8, 0.5), "bone")
    k.box("body", (-5, 33, -4), (10, 3, 8), "skin")
    for i in range(5):    # fingers growing out of its back
        x = -6 + i * 3
        k.box("body", (x, 30, 4.5), (2, 9, 2), "light", rot=[-35, 0, (i - 2) * 8], pivot=[x + 1, 30, 5.5])
        k.box("body", (x + 0.2, 38.4, 4.6), (1.6, 1.4, 1.8), "bone", rot=[-35, 0, (i - 2) * 8], pivot=[x + 1, 30, 5.5])
    k.bone("head", "body", (0, 36, -2))
    k.box("head", (-6, 36, -9), (12, 11, 11), "skin")
    k.box("head", (-1.8, 37.4, -9.3), (3.6, 9, 0.3), "dark")
    for i in range(4):
        k.eye("head", 0, 38.6 + i * 2.2, -9.3, 1.8 - (i % 2) * 0.3, 0.9)
    for i in range(6):
        k.box("head", (-5.4 + i * 2, 36.2, -9.6), (1.2, 1.8, 0.6), "teeth")
    k.box("head", (-6.5, 46.8, -5), (13, 1.6, 8), "bone")
    for i, x in enumerate((-4, -1, 2)):                                                    # a crown of fingers
        k.box("head", (x, 48.2, -3 + i % 2), (1.6, 4.2 + (i % 2), 1.6), "light", rot=[-10, 0, (i - 1) * 14], pivot=[x + 0.8, 48.2, -2.2])
        k.box("head", (x + 0.1, 52.2 + (i % 2), -2.9 + i % 2), (1.4, 1.0, 1.4), "claw", rot=[-10, 0, (i - 1) * 14], pivot=[x + 0.8, 48.2, -2.2])
    k.bone("jaw", "head", (0, 37, -4))
    k.box("jaw", (-6.5, 32, -10.5), (13, 4.6, 9), "skin")
    k.box("jaw", (-5.8, 36.2, -9.8), (11.6, 0.6, 7), "mouth")
    for i in range(6):
        k.box("jaw", (-4.6 + i * 1.9, 36.6, -10.2), (1.1, 1.6, 0.5), "teeth")
    for name, x, side in (("arm0", -11, -1), ("arm1", 11, 1)):
        k.bone(name, "body", (x, 32, 0))
        x0 = x - 3 if side > 0 else x - 3
        k.box(name, (x0, 12, -3), (6, 20, 6), "skin")
        k.box(name, (x0 - 0.5, 8, -3.5), (7, 4, 7), "dark")
        for f in range(5):
            fx = x0 - 0.2 + f * 1.4
            k.box(name, (fx, 1.5, -1.5), (1, 6.5, 1), "light")
            k.box(name, (fx, 0.4, -1.5), (1, 1.2, 1), "claw")


def m_mahoraga(k):
    """The Divine General: a pale giant like a temple statue, four little wings where its eyes should be, the
    Sword of Extermination grown out of its right arm, and the eight-handled wheel floating over its head."""
    k.bone("root")
    for name, x in (("leg0", -6), ("leg1", 6)):
        k.bone(name, "root", (x, 26, 0))
        k.box(name, (x - 4.5, 14, -4.5), (9, 12, 9), "skin")                      # thigh
        k.box(name, (x - 4, 4, -4), (8, 10.5, 8), "skin")                          # shin
        k.box(name, (x - 4.3, 12.5, -4.6), (8.6, 2.6, 0.6), "light")              # kneecap
        k.box(name, (x - 4.5, 0, -7), (9, 4, 11), "skin", top="light")            # a bare foot
        for t in range(4):
            k.box(name, (x - 4.2 + t * 2.2, 0, -7.8), (1.8, 1.8, 1.0), "light")
        k.box(name, (x - 4.6, 4, -4.6), (9.2, 1.4, 9.2), "dark")                   # ankle wrap
    k.bone("body", "root", (0, 26, 0))
    k.box("body", (-12, 22, -6.5), (24, 8, 13), "dark")                             # the loincloth's band
    k.box("body", (-6.5, 13, -7.0), (13, 9, 0.6), "dark")                           # front flap
    k.box("body", (-6.5, 13, 6.4), (13, 9, 0.6), "dark")                            # back flap
    k.box("body", (-12.4, 27.6, -6.9), (24.8, 2.2, 13.8), "mark")                   # sash
    k.box("body", (-12, 30, -6), (24, 13, 12), "skin")                              # torso
    k.box("body", (-15, 42, -6.5), (30, 6, 13), "skin")                             # shoulders
    k.box("body", (-11, 37.5, -6.7), (10.5, 6, 1), "light")                         # chest
    k.box("body", (0.5, 37.5, -6.7), (10.5, 6, 1), "light")
    for row in range(3):                                                             # abdomen
        for col in (-1, 1):
            k.box("body", (col * 2.4 - (3.2 if col < 0 else 0) + (0 if col < 0 else 0.8), 30.8 + row * 2.2, -6.5), (2.4, 1.8, 0.6), "light")
    k.box("body", (-4, 47, -4), (8, 3, 8), "skin")                                  # neck
    for side in (-1, 1):                                                             # back muscles
        k.box("body", (side * 9 - (3 if side < 0 else 0) + (0 if side < 0 else -3), 33, 5.6), (6, 12, 1), "under")
    k.bone("head", "body", (0, 49, 0))
    k.box("head", (-5, 49, -5.5), (10, 11, 10), "skin")
    k.box("head", (-4.5, 49.4, -6.0), (9, 4.6, 0.6), "light")                       # the lower face
    k.box("head", (-2.6, 50.8, -6.4), (5.2, 0.6, 0.4), "mouth")                     # a closed mouth
    k.box("head", (-4.6, 54.2, -5.95), (9.2, 3.6, 0.5), "dark")                     # the band of shadow where its eyes would be
    for side in (-1, 1):                                                             # two wings on each side of its face
        for (y, ln, ht, rz, ry) in ((55.4, 12, 3.4, 30, -22), (52.6, 8.5, 2.6, 10, -14)):
            x0 = 4.4 if side > 0 else -4.4 - ln
            piv = [side * 4.4, y + ht / 2, -5.6]
            k.box("head", (x0, y, -6.6), (ln, ht, 1.0), "wing", rot=[0, side * ry, side * rz], pivot=piv)
            k.box("head", (x0 + (0 if side > 0 else 1.5), y + ht, -6.3), (ln - 1.5, 1.2, 0.6), "light", rot=[0, side * ry, side * rz], pivot=piv)
            for f in range(4):                                                       # feather tips
                fx_ = (4.4 + ln - 1.8 - f * 2.4) if side > 0 else (-4.4 - ln + f * 2.4)
                k.box("head", (fx_, y - 1.4 - (f % 2) * 0.6, -6.4), (1.8, 1.6 + (f % 2) * 0.6, 0.7), "wing", rot=[0, side * ry, side * rz], pivot=piv)
    k.box("head", (-5.4, 59.6, -5.9), (10.8, 1.2, 10.8), "under")                   # the brow of the skull
    # the wheel: eight spokes, eight handles, turning one notch each time it adapts
    WY = 70
    k.bone("wheel", "body", (0, WY, 1))
    k.box("wheel", (-2.2, WY - 2.2, -0.2), (4.4, 4.4, 2.4), "accent")              # hub
    for i in range(8):
        a = i * 45
        k.box("wheel", (-3.5, WY + 7.4, 0), (7, 1.8, 2), "accent", rot=[0, 0, a + 22.5], pivot=[0, WY, 1])   # the rim
        k.box("wheel", (-0.6, WY + 2.2, 0.3), (1.2, 5.4, 1.4), "mark", rot=[0, 0, a], pivot=[0, WY, 1])       # a spoke
        k.box("wheel", (-0.7, WY + 9.2, 0.25), (1.4, 2.6, 1.5), "mark", rot=[0, 0, a], pivot=[0, WY, 1])      # a handle
        k.box("wheel", (-1.1, WY + 11.6, 0.0), (2.2, 1.6, 2.0), "accent", rot=[0, 0, a], pivot=[0, WY, 1])    # its knob
    for name, x, side in (("arm0", -15, -1), ("arm1", 15, 1)):
        k.bone(name, "body", (x, 46, 0))
        k.box(name, (x - 4.5, 35, -4.5), (9, 13, 9), "skin")                       # upper arm
        k.box(name, (x - 4, 22, -4), (8, 13, 8), "skin")                            # forearm
        k.box(name, (x - 4.4, 22, -4.4), (8.8, 2.4, 8.8), "dark")                  # wrist wrap
        k.box(name, (x - 4, 16.5, -4.5), (8, 5.5, 8.5), "skin", under="light")     # fist
        k.box(name, (x - 4.2, 18.6, -4.9), (8.4, 1.2, 0.6), "light")               # knuckles
    # the Sword of Extermination: a broad blade grown out of the right forearm, hanging past the fist
    k.box("arm0", (-21.2, 4, -3), (1.8, 26, 6), "steel")
    k.box("arm0", (-21.0, 1.5, -2.2), (1.4, 2.5, 4.4), "steel")
    k.box("arm0", (-20.8, -0.5, -1.2), (1.0, 2.0, 2.4), "steel")
    k.box("arm0", (-21.6, 28, -3.6), (2.6, 3, 7.2), "mark")                         # where it meets the arm


def m_dog(k):
    k.bone("root")
    for i, (x, z) in enumerate(((-2, -5), (2, -5), (-2, 5), (2, 5))):
        k.bone(f"leg{i}", "root", (x, 9, z))
        k.box(f"leg{i}", (x - 1.2, 0, z - 1.2), (2.4, 9, 2.4), "skin")
    k.bone("body", "root", (0, 9, 0))
    k.box("body", (-3.5, 9, -7), (7, 7, 15), "skin")
    k.box("body", (-3, 8, -8.5), (6, 8, 3), "light")
    k.box("body", (-1, 15.8, -5), (2, 0.3, 10), "mark")
    k.bone("head", "body", (0, 14, -7))
    k.box("head", (-3.5, 12, -13), (7, 7, 6), "skin")
    k.box("head", (-2, 12, -17), (4, 3, 4), "skin")
    k.box("head", (-1, 14.2, -17.3), (2, 1, 0.5), "pupil")
    k.eye("head", -2, 16.6, -13, 1.2, 0.6)
    k.eye("head", 2, 16.6, -13, 1.2, 0.6)
    k.box("head", (-3.2, 19, -11), (1.6, 3, 1.6), "skin")
    k.box("head", (1.6, 19, -11), (1.6, 3, 1.6), "skin")
    k.box("head", (-0.5, 18.2, -13.2), (1, 0.6, 0.3), "mark")
    k.bone("tail", "body", (0, 15, 8), rot=[35, 0, 0])
    k.box("tail", (-1, 13.5, 8), (2, 2, 7), "skin")


def m_nue(k):
    k.bone("root")
    k.bone("body", "root", (0, 8, 0))
    k.box("body", (-4, 6, -4), (8, 9, 8), "skin")
    k.box("body", (-3, 6.5, -4.3), (6, 6, 0.4), "light")
    k.box("body", (-2, 5, 3.5), (4, 1, 6), "dark")
    k.box("body", (-1.6, 2, -1), (1, 4, 1), "claw")
    k.box("body", (0.6, 2, -1), (1, 4, 1), "claw")
    k.bone("head", "body", (0, 15, -1))
    k.box("head", (-4, 15, -5), (8, 6, 7), "skin")
    k.box("head", (-3.5, 15.5, -5.3), (7, 5, 0.4), "light")
    k.eye("head", -1.8, 18.2, -5.3, 1.8, 0.9)
    k.eye("head", 1.8, 18.2, -5.3, 1.8, 0.9)
    k.box("head", (-0.6, 15.8, -6.1), (1.2, 2, 1), "claw")
    k.box("head", (-3.8, 21, -3), (1.5, 2.5, 1.5), "dark")
    k.box("head", (2.3, 21, -3), (1.5, 2.5, 1.5), "dark")
    k.bone("wing0", "body", (4, 13, 0))
    k.box("wing0", (4, 13, -4), (14, 0.8, 9), "wing")
    k.box("wing0", (15, 12.8, -5), (5, 0.6, 11), "dark")
    k.bone("wing1", "body", (-4, 13, 0))
    k.box("wing1", (-18, 13, -4), (14, 0.8, 9), "wing")
    k.box("wing1", (-20, 12.8, -5), (5, 0.6, 11), "dark")


def m_elephant(k):
    k.bone("root")
    for i, (x, z) in enumerate(((-6, -8), (6, -8), (-6, 8), (6, 8))):
        k.bone(f"leg{i}", "root", (x, 14, z))
        k.box(f"leg{i}", (x - 3, 0, z - 3), (6, 14, 6), "skin")
        k.box(f"leg{i}", (x - 3.2, 0, z - 3.3), (6.4, 1.5, 1.5), "light")
    k.bone("body", "root", (0, 14, 0))
    k.box("body", (-10, 14, -13), (20, 18, 26), "skin")
    for z in (-6, 2):
        k.box("body", (-10.3, 22, z), (20.6, 1, 2), "mark")
    k.bone("head", "body", (0, 28, -13))
    k.box("head", (-7, 20, -21), (14, 14, 9), "skin")
    k.box("head", (-15, 19, -17.5), (8, 14, 1.5), "skin")
    k.box("head", (7, 19, -17.5), (8, 14, 1.5), "skin")
    k.eye("head", -4, 29, -21, 1.6, 0.8)
    k.eye("head", 4, 29, -21, 1.6, 0.8)
    k.box("head", (-1, 31.5, -21.3), (2, 2, 0.3), "mark")
    k.box("head", (-4.5, 18, -24), (1.5, 1.5, 6), "light")
    k.box("head", (3, 18, -24), (1.5, 1.5, 6), "light")
    k.bone("trunk0", "head", (0, 22, -21))
    k.box("trunk0", (-2, 14, -23), (4, 8, 4), "skin")
    k.bone("trunk1", "trunk0", (0, 14, -21.5))
    k.box("trunk1", (-1.6, 7, -22.6), (3.2, 7, 3.2), "skin")
    k.bone("trunk2", "trunk1", (0, 7, -21.5))
    k.box("trunk2", (-1.2, 1, -22.2), (2.4, 6, 2.4), "skin")
    k.box("body", (-0.6, 18, 13), (1.2, 10, 1.2), "skin")


# ---------------------------------------------------------------------------
# Animations (Molang, per model)
# ---------------------------------------------------------------------------
WALK = "math.cos(q.modified_distance_moved * 32) * 30 * math.min(1, q.modified_move_speed * 2)"
LOOK = {"rotation": ["q.target_x_rotation * 0.6", "q.target_y_rotation * 0.6", 0]}
ATTACK = "math.sin(v.attack_time * 180)"


def anim(kind, bones):
    b = {}
    has = set(bones)
    if "head" in has:
        b["head"] = LOOK
    legs = sorted(n for n in has if n.startswith("leg"))
    if len(legs) == 2:
        b["leg0"] = {"rotation": [WALK, 0, 0]}
        b["leg1"] = {"rotation": [f"-{WALK}", 0, 0]}
    elif len(legs) == 4:
        for i, n in enumerate(legs):
            b[n] = {"rotation": [f"{1 if i in (0, 3) else -1} * {WALK}", 0, 0]}
    if "arm0" in has:
        b["arm0"] = {"rotation": [f"-{WALK} * 0.8 - {ATTACK} * 80 + math.sin(q.life_time * 90) * 4", 0, 0]}
        b["arm1"] = {"rotation": [f"{WALK} * 0.8 - {ATTACK} * 80 - math.sin(q.life_time * 90) * 4", 0, 0]}
    if "jaw" in has:
        b["jaw"] = {"rotation": [f"6 + math.sin(q.life_time * 120) * 4 + {ATTACK} * 30", 0, 0]}
    if "tail" in has:
        b["tail"] = {"rotation": [0, "math.sin(q.life_time * 500) * 25", 0]}
    if kind == "fly_head":
        b["body"] = {"position": [0, "3 + math.sin(q.life_time * 200) * 1.5", 0], "rotation": [f"{ATTACK} * 20", 0, 0]}
        for i in range(4):
            side = 1 if i < 2 else -1
            b[f"wing{i}"] = {"rotation": [0, 0, f"{side} * math.sin(q.life_time * 2400 + {i * 60}) * 35"]}
    if kind == "nue":
        b["wing0"] = {"rotation": [0, 0, "math.sin(q.life_time * 700) * 35"]}
        b["wing1"] = {"rotation": [0, 0, "-math.sin(q.life_time * 700) * 35"]}
        b["body"] = {"position": [0, "math.sin(q.life_time * 350) * 1.5", 0]}
    if kind == "max_elephant":
        b["trunk0"] = {"rotation": ["math.sin(q.life_time * 140) * 8 - 10", 0, 0]}
        b["trunk1"] = {"rotation": ["math.sin(q.life_time * 140 - 40) * 10 - 10", 0, 0]}
        b["trunk2"] = {"rotation": ["math.sin(q.life_time * 140 - 80) * 12 - 12", 0, 0]}
    if kind == "mahoraga":
        b["wheel"] = {"rotation": [0, 0, "v.wheel"], "position": [0, "math.sin(q.life_time * 80) * 0.8", 0]}
        b["arm0"] = {"rotation": [f"-{WALK} * 0.6 - {ATTACK} * 110 + math.sin(q.life_time * 70) * 3", 0, f"{ATTACK} * 20"]}
        b["body"] = {"rotation": [f"{ATTACK} * 10", f"{ATTACK} * -14", 0], "position": [0, "math.sin(q.life_time * 70) * 0.3", 0]}
    if kind in ("mouth_curse", "finger_bearer", "eye_curse"):
        b["body"] = {"rotation": [f"{ATTACK} * 12", 0, 0], "position": [0, "math.sin(q.life_time * 90) * 0.4", 0]}
    return {"loop": True, "bones": {k: v for k, v in b.items() if k in has}}


# ---------------------------------------------------------------------------
# What each creature is
# ---------------------------------------------------------------------------
CURSE_TARGETS = [{"filters": {"any_of": [{"test": "is_family", "subject": "other", "value": "player"},
                                         {"test": "is_family", "subject": "other", "value": "shikigami"},
                                         {"test": "is_family", "subject": "other", "value": "jjk_ally"}]}, "max_dist": 28}]
CREATURES = {
    "fly_head": dict(name="Fly Head (Grade 4 Curse)", model=m_fly_head, grade=4, hp=14, dmg=3, speed=0.3, box=(0.7, 0.9), bounds=(2, 2, 0.6),
                     pal=dict(skin=(122, 132, 96), dark=(60, 62, 48), light=(160, 170, 130), under=(90, 96, 70), mouth=(70, 12, 16), teeth=(232, 226, 200),
                              eye=(236, 222, 120), pupil=(22, 14, 10), wing=(150, 160, 170), bone=(220, 210, 180), claw=(50, 46, 40), accent=(150, 40, 50),
                              mark=(90, 30, 60)), egg=("#7a8460", "#46122a"), spawn=40, herd=(1, 3), xp=4),
    "lanky_curse": dict(name="Lanky Curse (Grade 3)", model=m_lanky, grade=3, hp=30, dmg=5, speed=0.28, box=(0.7, 2.4), bounds=(2.5, 3, 1.2),
                        pal=dict(skin=(178, 168, 176), dark=(90, 70, 86), light=(210, 200, 205), under=(130, 120, 128), mouth=(80, 10, 30), teeth=(238, 232, 220),
                                 eye=(200, 40, 40), pupil=(20, 10, 10), bone=(230, 220, 200), claw=(60, 40, 50), accent=(140, 40, 70), mark=(90, 30, 60)),
                        egg=("#b2a8b0", "#501020"), spawn=18, herd=(1, 2), xp=8),
    "mouth_curse": dict(name="Gaping Curse (Grade 2)", model=m_mouth, grade=2, hp=70, dmg=9, speed=0.24, box=(1.2, 1.3), bounds=(3, 2.5, 0.8),
                        pal=dict(skin=(96, 120, 150), dark=(48, 60, 80), light=(140, 160, 190), under=(70, 88, 110), mouth=(90, 8, 24), teeth=(240, 236, 210),
                                 eye=(255, 210, 60), pupil=(20, 10, 10), bone=(220, 214, 190), claw=(40, 44, 56), accent=(200, 70, 90), mark=(40, 40, 80)),
                        egg=("#607896", "#5a0818"), spawn=8, herd=(1, 1), xp=16),
    "eye_curse": dict(name="Hundred-Eyed Curse (Grade 1)", model=m_eye_curse, grade=1, hp=180, dmg=14, speed=0.27, box=(1.3, 2.3), bounds=(3.5, 3, 1.2),
                      pal=dict(skin=(112, 86, 124), dark=(50, 36, 58), light=(176, 150, 178), under=(84, 64, 94), mouth=(80, 10, 18), teeth=(236, 226, 200),
                               eye=(240, 236, 220), pupil=(150, 20, 20), bone=(226, 214, 186), claw=(36, 26, 22), accent=(150, 50, 40), mark=(80, 20, 30)),
                      egg=("#70567c", "#e0dcc8"), spawn=2, herd=(1, 1), xp=40),
    "finger_bearer": dict(name="Finger Bearer (Special Grade)", model=m_finger_bearer, grade=0, hp=1500, dmg=16, speed=0.3, box=(1.6, 3.0),
                          bounds=(5, 4.5, 1.6), boss=True,
                          pal=dict(skin=(150, 158, 140), dark=(56, 50, 52), light=(222, 196, 176), under=(110, 116, 100), mouth=(60, 6, 14),
                                   teeth=(240, 234, 214), eye=(30, 24, 26), pupil=(210, 30, 40), bone=(232, 220, 196), claw=(40, 30, 30), accent=(170, 40, 50),
                                   mark=(120, 20, 40)), egg=("#9a9e8c", "#781424"), xp=400),
    "divine_dog_white": dict(name="Divine Dog: White", model=m_dog, shikigami=True, hp=40, dmg=7, speed=0.36, box=(0.7, 0.9), bounds=(2, 2, 0.6),
                             pal=dict(skin=(236, 236, 240), dark=(150, 150, 160), light=(250, 250, 252), under=(200, 200, 208), eye=(250, 230, 120),
                                      pupil=(20, 20, 30), mark=(200, 40, 50)), egg=("#ececf0", "#c82832")),
    "divine_dog_black": dict(name="Divine Dog: Black", model=m_dog, shikigami=True, hp=40, dmg=7, speed=0.36, box=(0.7, 0.9), bounds=(2, 2, 0.6),
                             pal=dict(skin=(34, 34, 40), dark=(16, 16, 20), light=(70, 70, 80), under=(24, 24, 30), eye=(250, 230, 120),
                                      pupil=(240, 240, 240), mark=(90, 160, 240)), egg=("#222228", "#5aa0f0")),
    "mahoraga": dict(name="Divine General Mahoraga", model=m_mahoraga, mahoraga=True, hp=1600, dmg=10, speed=0.31, box=(1.6, 4.4),
                     bounds=(6, 6.5, 2.6),
                     pal=dict(skin=(212, 210, 202), dark=(46, 44, 52), light=(236, 234, 228), under=(176, 172, 164), mouth=(70, 40, 46),
                              teeth=(240, 236, 220), eye=(30, 30, 36), pupil=(240, 240, 240), wing=(240, 240, 244), bone=(220, 214, 196),
                              mark=(150, 122, 70), accent=(196, 170, 104), claw=(60, 60, 70), steel=(196, 204, 218)),
                     egg=("#d4d2ca", "#aa8a46")),
    "nue": dict(name="Nue", model=m_nue, fx=True, bounds=(4, 2.5, 0.8),
                pal=dict(skin=(62, 70, 96), dark=(34, 38, 56), light=(230, 230, 236), under=(50, 56, 80), eye=(250, 220, 80), pupil=(20, 20, 20),
                         wing=(80, 90, 120), claw=(230, 200, 90)), egg=("#3e4660", "#e6e6ec")),
    "max_elephant": dict(name="Max Elephant", model=m_elephant, fx=True, scale=2.4, bounds=(12, 10, 3),
                         pal=dict(skin=(128, 140, 160), dark=(70, 80, 96), light=(236, 232, 220), under=(100, 110, 128), eye=(250, 230, 150), pupil=(20, 20, 20),
                                  mark=(240, 240, 250)), egg=("#808ca0", "#f0f0fa")),
}


def entity_components(cid, c):
    if c.get("fx"):
        return {"minecraft:type_family": {"family": ["jjk_fx"]},
                "minecraft:collision_box": {"width": 0.1, "height": 0.1},
                "minecraft:physics": {"has_gravity": False, "has_collision": False},
                "minecraft:pushable": {"is_pushable": False, "is_pushable_by_piston": False},
                "minecraft:damage_sensor": {"triggers": [{"cause": "all", "deals_damage": "no"}]},
                "minecraft:health": {"value": 100, "max": 100},
                "minecraft:timer": {"time": 40, "looping": False, "time_down_event": {"event": "jjk:despawn", "target": "self"}},
                **({"minecraft:scale": {"value": c["scale"]}} if c.get("scale") else {})}
    comps = {
        "minecraft:health": {"value": c["hp"], "max": c["hp"]},
        "minecraft:attack": {"damage": c["dmg"]},
        "minecraft:movement": {"value": c["speed"]},
        "minecraft:movement.basic": {},
        "minecraft:jump.static": {},
        "minecraft:navigation.walk": {"can_path_over_water": True, "avoid_damage_blocks": True},
        "minecraft:physics": {},
        "minecraft:collision_box": {"width": c["box"][0], "height": c["box"][1]},
        "minecraft:pushable": {"is_pushable": True, "is_pushable_by_piston": True},
        "minecraft:breathable": {"total_supply": 15, "suffocate_time": 0},
        "minecraft:nameable": {},
        "minecraft:behavior.float": {"priority": 0},
        "minecraft:behavior.melee_attack": {"priority": 2, "speed_multiplier": 1.25, "track_target": True},
        "minecraft:behavior.random_stroll": {"priority": 6, "speed_multiplier": 0.8},
        "minecraft:behavior.look_at_player": {"priority": 7, "look_distance": 12},
        "minecraft:behavior.random_look_around": {"priority": 8},
        "minecraft:damage_sensor": {"triggers": [{"cause": "fall", "deals_damage": "no"}]},
    }
    if c.get("shikigami"):
        comps.update({
            "minecraft:type_family": {"family": ["shikigami", "mob"]},
            "minecraft:behavior.nearest_attackable_target": {"priority": 3, "must_see": False, "reselect_targets": True, "within_radius": 20,
                "entity_types": [{"filters": {"any_of": [{"test": "is_family", "subject": "other", "value": "curse"},
                                                         {"test": "is_family", "subject": "other", "value": "monster"}]}, "max_dist": 20}]},
            "minecraft:timer": {"time": 30, "looping": False, "time_down_event": {"event": "jjk:despawn", "target": "self"}},
            "minecraft:behavior.hurt_by_target": {"priority": 1, "entity_types": {"filters": {"test": "is_family", "subject": "other", "operator": "!=",
                                                                                               "value": "player"}}},
            "minecraft:tameable": {"probability": 0.0, "tame_items": "minecraft:barrier", "tame_event": {"event": "jjk:tamed", "target": "self"}},
        })
        return comps
    comps.update({
        "minecraft:tameable": {"probability": 0.0, "tame_items": "minecraft:barrier"},
        "minecraft:type_family": {"family": ["curse", f"grade{c['grade']}" if c["grade"] else "special_grade", "monster", "mob"]},
        "minecraft:behavior.hurt_by_target": {"priority": 1},
        "minecraft:behavior.nearest_attackable_target": {"priority": 3, "must_see": False, "reselect_targets": True, "within_radius": 28,
                                                         "entity_types": CURSE_TARGETS},
        "minecraft:experience_reward": {"on_death": f"q.last_hit_by_player ? {c['xp']} : 0"},
    })
    if c.get("boss"):
        comps.update({"minecraft:boss": {"hud_range": 48, "name": c["name"], "should_darken_sky": True},
                      "minecraft:knockback_resistance": {"value": 0.9}, "minecraft:persistent": {}, "minecraft:fire_immune": {},
                      "minecraft:follow_range": {"value": 48, "max": 48}})
    else:
        comps["minecraft:despawn"] = {"despawn_from_distance": {"min_distance": 40, "max_distance": 96}}
    return comps


def mahoraga_bp(c):
    """Mahoraga: wild (a boss with a bar, hostile to everyone) until jjk:tamed — then it fights for its master.
    jjk:turn is how far its wheel has turned (scripts/mahoraga.js turns it each time it adapts)."""
    fam = lambda v, op="==": {"test": "is_family", "subject": "other", "operator": op, "value": v}
    comps = {
        "minecraft:health": {"value": c["hp"], "max": c["hp"]},
        "minecraft:attack": {"damage": c["dmg"]},
        "minecraft:movement": {"value": c["speed"]},
        "minecraft:movement.basic": {},
        "minecraft:jump.static": {},
        "minecraft:navigation.walk": {"can_path_over_water": True, "avoid_damage_blocks": True},
        "minecraft:physics": {},
        "minecraft:collision_box": {"width": c["box"][0], "height": c["box"][1]},
        "minecraft:pushable": {"is_pushable": False, "is_pushable_by_piston": False},
        "minecraft:knockback_resistance": {"value": 1.0},
        "minecraft:breathable": {"total_supply": 15, "suffocate_time": 0},
        "minecraft:nameable": {},
        "minecraft:persistent": {},
        "minecraft:follow_range": {"value": 48, "max": 48},
        "minecraft:type_family": {"family": ["mahoraga", "mob"]},
        "minecraft:tameable": {"probability": 0.0, "tame_items": "minecraft:barrier"},
        "minecraft:behavior.float": {"priority": 0},
        "minecraft:behavior.melee_attack": {"priority": 2, "speed_multiplier": 1.3, "track_target": True},
        "minecraft:behavior.random_stroll": {"priority": 6, "speed_multiplier": 0.7},
        "minecraft:behavior.look_at_player": {"priority": 7, "look_distance": 16},
        "minecraft:behavior.random_look_around": {"priority": 8},
        "minecraft:damage_sensor": {"triggers": [{"cause": "fall", "deals_damage": "no"}]},
    }
    groups = {
        "jjk:wild": {
            "minecraft:type_family": {"family": ["mahoraga", "special_grade", "monster", "mob"]},
            "minecraft:boss": {"hud_range": 48, "name": c["name"], "should_darken_sky": True},
            "minecraft:behavior.hurt_by_target": {"priority": 1},
            "minecraft:behavior.nearest_attackable_target": {"priority": 3, "must_see": False, "reselect_targets": True, "within_radius": 32,
                "entity_types": [{"filters": {"any_of": [fam("player"), fam("shikigami")]}, "max_dist": 32}]},
        },
        "jjk:tamed": {
            "minecraft:type_family": {"family": ["mahoraga", "shikigami", "mob"]},
            "minecraft:is_tamed": {},
            "minecraft:behavior.owner_hurt_by_target": {"priority": 1},
            "minecraft:behavior.owner_hurt_target": {"priority": 2},
            "minecraft:behavior.hurt_by_target": {"priority": 1, "entity_types": {"filters": fam("player", "!=")}},
            "minecraft:behavior.nearest_attackable_target": {"priority": 3, "must_see": False, "reselect_targets": True, "within_radius": 24,
                "entity_types": [{"filters": {"all_of": [{"any_of": [fam("monster"), fam("jjk_villain")]}, fam("creeper", "!="),
                                                         fam("mahoraga", "!=")]}, "max_dist": 24}]},
            "minecraft:behavior.follow_owner": {"priority": 5, "speed_multiplier": 1.3, "start_distance": 10, "stop_distance": 4},
        },
        "jjk:despawn": {"minecraft:instant_despawn": {}},
    }
    events = {
        "minecraft:entity_spawned": {"add": {"component_groups": ["jjk:wild"]}},
        "jjk:tamed": {"remove": {"component_groups": ["jjk:wild"]}, "add": {"component_groups": ["jjk:tamed"]}},
        "jjk:despawn": {"add": {"component_groups": ["jjk:despawn"]}},
    }
    return {"format_version": "1.21.0", "minecraft:entity": {
        "description": {"identifier": "jjk:mahoraga", "is_spawnable": True, "is_summonable": True, "is_experimental": False,
                        "properties": {"jjk:turn": {"type": "int", "range": [0, 1000], "default": 0, "client_sync": True}}},
        "component_groups": groups, "components": comps, "events": events}}


anims = {}
lang = []
for cid, c in CREATURES.items():
    k = Kit(sum(map(ord, cid)))
    c["model"](k)
    geo_id = "geometry.jjk.divine_dog" if cid.startswith("divine_dog") else f"geometry.jjk.{cid}"
    bw, bh, oy = c["bounds"]
    if not cid.endswith("_black"):
        w(RP / "models" / "entity" / f"{geo_id.split('.')[-1]}.geo.json", k.geo(geo_id, bw, bh, oy))
        anims[f"animation.jjk.{geo_id.split('.')[-1]}.idle"] = anim(cid if not cid.startswith("divine_dog") else "dog", [b["name"] for b in k.bones])
    paint(c["pal"], sum(map(ord, cid)) + 3, curse="grade" in c).save(RP / "textures" / "entity" / "jjk" / f"{cid}.png")
    scripts = {"animate": ["idle"]}
    if c.get("mahoraga"):   # the wheel eases round to the next notch instead of snapping
        scripts["pre_animation"] = ["v.wheel = math.lerp(v.wheel, q.property('jjk:turn') * 45, 0.12);"]
    w(RP / "entity" / f"{cid}.entity.json", {"format_version": "1.10.0", "minecraft:client_entity": {"description": {
        "identifier": f"jjk:{cid}", "materials": {"default": "entity_alphatest"},
        "textures": {"default": f"textures/entity/jjk/{cid}"}, "geometry": {"default": geo_id},
        "animations": {"idle": f"animation.jjk.{geo_id.split('.')[-1]}.idle"}, "scripts": scripts,
        "render_controllers": ["controller.render.default"], "spawn_egg": {"base_color": c["egg"][0], "overlay_color": c["egg"][1]}}}})
    if c.get("mahoraga"):
        w(BP / "entities" / f"{cid}.json", mahoraga_bp(c))
        lang.append(f"entity.jjk:{cid}.name={c['name']}")
        lang.append(f"item.spawn_egg.entity.jjk:{cid}.name=Spawn Mahoraga")
        continue
    groups = {"jjk:despawn": {"minecraft:instant_despawn": {}}}
    events = {"jjk:despawn": {"add": {"component_groups": ["jjk:despawn"]}}}
    if c.get("grade") is not None and not c.get("boss"):   # a servant curse (Geto, Mahito): it fights for its owner (scripts/servants.js)
        fam = lambda v, op="==": {"test": "is_family", "subject": "other", "operator": op, "value": v}
        groups["jjk:servant"] = {
            "minecraft:type_family": {"family": ["shikigami", "servant", "mob"]},
            "minecraft:is_tamed": {},
            "minecraft:behavior.owner_hurt_by_target": {"priority": 1},
            "minecraft:behavior.owner_hurt_target": {"priority": 2},
            "minecraft:behavior.hurt_by_target": {"priority": 1, "entity_types": {"filters": fam("player", "!=")}},
            "minecraft:behavior.nearest_attackable_target": {"priority": 3, "must_see": False, "reselect_targets": True, "within_radius": 20,
                "entity_types": [{"filters": {"all_of": [{"any_of": [fam("monster"), fam("jjk_villain")]}, fam("creeper", "!="),
                                                         {"test": "has_tag", "subject": "other", "operator": "!=", "value": "jjk_servant"}]},
                                  "max_dist": 20}]},
            "minecraft:behavior.follow_owner": {"priority": 5, "speed_multiplier": 1.2, "start_distance": 10, "stop_distance": 3},
            "minecraft:timer": {"time": 40, "looping": False, "time_down_event": {"event": "jjk:despawn", "target": "self"}},
        }
        events["jjk:servant"] = {"add": {"component_groups": ["jjk:servant"]}}
    if c.get("shikigami"):   # tamed from script (summoner = owner): they attack what their summoner attacks and what attacks it
        groups["jjk:tamed"] = {"minecraft:is_tamed": {}, "minecraft:behavior.owner_hurt_by_target": {"priority": 1},
                               "minecraft:behavior.owner_hurt_target": {"priority": 2},
                               "minecraft:behavior.follow_owner": {"priority": 5, "speed_multiplier": 1.3, "start_distance": 8, "stop_distance": 3}}
        events["jjk:tamed"] = {"add": {"component_groups": ["jjk:tamed"]}}
    w(BP / "entities" / f"{cid}.json", {"format_version": "1.21.0", "minecraft:entity": {
        "description": {"identifier": f"jjk:{cid}", "is_spawnable": not c.get("fx"), "is_summonable": True, "is_experimental": False},
        "component_groups": groups, "components": entity_components(cid, c), "events": events}})
    if c.get("spawn"):
        w(BP / "spawn_rules" / f"{cid}.json", {"format_version": "1.8.0", "minecraft:spawn_rules": {
            "description": {"identifier": f"jjk:{cid}", "population_control": "monster"},
            "conditions": [{"minecraft:spawns_on_surface": {},
                            "minecraft:spawns_on_block_filter": ["minecraft:grass_block", "minecraft:dirt", "minecraft:stone", "minecraft:sand",
                                                                 "minecraft:podzol", "minecraft:snow", "minecraft:coarse_dirt", "minecraft:gravel"],
                            "minecraft:brightness_filter": {"min": 0, "max": 7, "adjust_for_weather": True},
                            "minecraft:weight": {"default": c["spawn"]},
                            "minecraft:herd": {"min_size": c["herd"][0], "max_size": c["herd"][1]},
                            "minecraft:biome_filter": {"test": "has_biome_tag", "value": "overworld"}}]}})
    lang.append(f"entity.jjk:{cid}.name={c['name']}")
    lang.append(f"item.spawn_egg.entity.jjk:{cid}.name=Spawn {c['name'].split(' (')[0]}")

# ---------------------------------------------------------------------------
# Effect models: the Limitless orbs, the domain barrier and Sukuna's shrine
# ---------------------------------------------------------------------------
def fx_entity_bp(eid, variants=None, scales=None, life=40):
    """An entity that only exists to be seen: no AI, no collision, can't be hurt. Variants and sizes come from events."""
    comps = entity_components(eid, {"fx": True})
    comps["minecraft:timer"]["time"] = life
    groups = {"jjk:despawn": {"minecraft:instant_despawn": {}}}
    events = {"jjk:despawn": {"add": {"component_groups": ["jjk:despawn"]}}}
    for i, name in enumerate(variants or []):
        groups[f"jjk:v_{name}"] = {"minecraft:variant": {"value": i}}
        if scales:
            groups[f"jjk:v_{name}"]["minecraft:scale"] = {"value": scales[i]}
        events[f"jjk:as_{name}"] = {"add": {"component_groups": [f"jjk:v_{name}"]},
                                    "remove": {"component_groups": [f"jjk:v_{o}" for o in variants if o != name]}}
    w(BP / "entities" / f"{eid}.json", {"format_version": "1.21.0", "minecraft:entity": {
        "description": {"identifier": f"jjk:{eid}", "is_spawnable": False, "is_summonable": True, "is_experimental": False},
        "component_groups": groups, "components": comps, "events": events}})


def fx_entity_rp(eid, geo, textures, material="entity_alphatest", anim_ids=None, controller=None):
    desc = {"identifier": f"jjk:{eid}", "materials": {"default": material},
            "textures": {k: f"textures/entity/jjk/{v}" for k, v in textures.items()}, "geometry": {"default": geo},
            "render_controllers": [controller or "controller.render.default"]}
    if anim_ids:
        desc["animations"] = anim_ids
        desc["scripts"] = {"animate": list(anim_ids)}
    w(RP / "entity" / f"{eid}.entity.json", {"format_version": "1.10.0", "minecraft:client_entity": {"description": desc}})


def noise_img(size, fn, seed):
    rnd = random.Random(seed)
    img = Image.new("RGBA", size, (0, 0, 0, 0))
    px = img.load()
    for x in range(size[0]):
        for y in range(size[1]):
            px[x, y] = tuple(clamp(v) for v in fn(x, y, rnd))
    return img


# The orb: a rounded voxel ball (core + translucent shell), centred on the entity's position.
ORBS = {"blue": ((90, 170, 255), (30, 80, 255), (170, 225, 255)), "red": ((255, 80, 70), (200, 20, 30), (255, 190, 160)),
        "purple": ((190, 90, 255), (110, 30, 220), (240, 200, 255)), "fire": ((255, 150, 40), (220, 70, 10), (255, 230, 150))}


def orb_texture(core, deep, hot, seed):
    def fn(x, y, rnd):
        if x < 32:   # core: hot centre swirls
            d = ((x - 16) ** 2 + (y - 16) ** 2) ** 0.5 / 16
            k = 1 - d * 0.5 + rnd.uniform(-0.06, 0.06)
            mix = max(0.0, 1 - d * 1.4)
            return [(hot[i] * mix + core[i] * (1 - mix)) * k for i in range(3)] + [255]
        sw = 0.5 + 0.5 * math.sin((x + y * 0.7) * 0.55 + rnd.uniform(-0.4, 0.4))
        return [deep[i] * (0.7 + 0.5 * sw) for i in range(3)] + [90 + 70 * sw]
    return noise_img((64, 32), fn, seed)


def m_orb():
    k = Kit(7)
    k.bone("root")
    k.bone("core", "root", (0, 0, 0))
    k.bone("shell", "root", (0, 0, 0))

    def ball(bone, r, u0):
        for o, sz in (((-r * 0.66, -r * 0.66, -r * 0.66), (r * 1.32,) * 3), ((-r, -r * 0.5, -r * 0.5), (r * 2, r, r)),
                      ((-r * 0.5, -r, -r * 0.5), (r, r * 2, r)), ((-r * 0.5, -r * 0.5, -r), (r, r, r * 2))):
            face = {f: {"uv": [u0 + 4, 4], "uv_size": [24, 24]} for f in ("north", "south", "east", "west", "up", "down")}
            k.idx[bone]["cubes"].append({"origin": [round(v, 3) for v in o], "size": [round(v, 3) for v in sz], "uv": face})
    ball("core", 5, 0)
    ball("shell", 8, 32)
    g = k.geo("geometry.jjk.orb", 4, 4, -0.2)
    g["minecraft:geometry"][0]["description"].update({"texture_width": 64, "texture_height": 32})
    return g


# The domain barrier: a dome of plates, radius 12 blocks, seen from inside (both faces of every plate are drawn).
DOME_R = 192


def m_dome():
    k = Kit(11)
    k.bone("root")
    k.bone("dome", "root", (0, 0, 0))
    k.bone("floor", "root", (0, 0, 0))
    rings = 7
    dth = 90 / rings
    for i in range(rings):
        th = dth * (i + 0.5)
        segs = max(5, round(26 * math.cos(math.radians(th))))
        wd = 2 * math.pi * DOME_R * math.cos(math.radians(th)) / segs * 1.14
        ht = DOME_R * math.radians(dth) * 1.16
        for j in range(segs):
            ph = 360 / segs * (j + (0.5 if i % 2 else 0))
            k.box("dome", (-wd / 2, -ht / 2, -DOME_R - 1.5), (wd, ht, 3), "skin", rot=[-th, -ph, 0], pivot=[0, 0, 0])
    k.box("dome", (-30, DOME_R - 2, -30), (60, 3, 60), "skin")
    # the floor: bands that fill the circle without overlapping
    band = 24
    for zi in range(-8, 8):
        z0, z1 = zi * band, (zi + 1) * band
        zc = min(abs(z0), abs(z1))
        half = math.sqrt(max(0, DOME_R ** 2 - zc ** 2))
        if half > 4:
            k.box("floor", (-half, 0.05, z0), (half * 2, 0.1, band), "light", top="light")
    return k.geo("geometry.jjk.domain_dome", 28, 16, 6)


def dome_texture(kind, seed):
    rnd = random.Random(seed)
    img = Image.new("RGBA", (128, 128), (0, 0, 0, 255))
    px = img.load()
    for x in range(128):
        for y in range(128):
            n = rnd.uniform(-1, 1)
            if kind == "void":     # the inside of infinity: deep blue-black, streams of light, stars
                band = 0.5 + 0.5 * math.sin(x * 0.11 + math.sin(y * 0.07) * 2.2)
                base = (8 + 14 * band + n * 3, 10 + 16 * band + n * 3, 26 + 40 * band + n * 5)
                if rnd.random() < 0.035:
                    v = rnd.uniform(180, 255)
                    base = (v, v, min(255, v + 20))
            elif kind == "garden":  # the shadow garden: ink-black water, purple ripples
                rip = 0.5 + 0.5 * math.sin(((x - 64) ** 2 + (y - 64) ** 2) ** 0.5 * 0.45)
                base = (10 + 18 * rip + n * 3, 6 + 8 * rip + n * 2, 18 + 34 * rip + n * 4)
                if rnd.random() < 0.01:
                    base = (120, 60, 170)
            elif kind == "moon":   # Time Cell Moon Palace: a pale grey moonscape cut into film frames
                crater = 0.5 + 0.5 * math.sin(x * 0.19 + math.cos(y * 0.13) * 1.7) * math.cos(y * 0.17 - x * 0.05)
                v = 150 + 40 * crater + n * 6
                base = (v * 0.96, v * 0.98, v * 1.04)
                fx_, fy = x % 32, y % 24
                if fx_ < 2 or fy < 2:                       # the frame lines
                    base = (40, 40, 48)
                elif fx_ < 6 and fy % 6 in (3, 4) and 4 < fy < 22:  # sprocket holes down each frame's edge
                    base = (230, 232, 240)
            elif kind == "volcano":  # Coffin of the Iron Mountain: black rock split by glowing lava
                rock = 0.5 + 0.5 * math.sin(x * 0.23 + math.sin(y * 0.11) * 3.1) * math.sin(y * 0.19 + x * 0.04)
                base = (34 + 22 * rock + n * 5, 20 + 12 * rock + n * 3, 16 + 8 * rock + n * 3)
                vein = abs(math.sin(x * 0.09 + math.sin(y * 0.21) * 1.8 + y * 0.05))
                if vein < 0.09:
                    hot = 1 - vein / 0.09
                    base = (200 + 55 * hot, 60 + 120 * hot, 10 + 40 * hot)
                elif rnd.random() < 0.012:
                    base = (255, 170, 60)
            elif kind == "perfection":  # Self-Embodiment of Perfection: a dim blue void lined with stitches
                sw = 0.5 + 0.5 * math.sin(x * 0.07 - y * 0.05 + math.sin(x * 0.03) * 2)
                base = (34 + 20 * sw + n * 4, 40 + 22 * sw + n * 4, 70 + 34 * sw + n * 5)
                if (y + x // 3) % 21 == 0 and x % 4 < 2:     # dashed stitch lines
                    base = (150, 150, 170)
                elif (y + x // 3) % 21 in (20, 1) and x % 4 == 0:
                    base = (110, 110, 130)
            else:                  # Idle Death Gamble: a pachinko parlour's green, with rows of lights
                glow = 0.5 + 0.5 * math.sin(y * 0.2 + math.sin(x * 0.09) * 1.5)
                base = (20 + 16 * glow + n * 3, 90 + 50 * glow + n * 6, 50 + 26 * glow + n * 4)
                if x % 8 in (3, 4) and y % 8 in (3, 4):
                    base = rnd.choice(((255, 216, 70), (255, 255, 220), (255, 120, 200), (120, 255, 200)))
                elif (x + y) % 32 == 0:
                    base = (210, 255, 160)
            px[x, y] = tuple(clamp(v) for v in base) + (255,)
    # Moon Palace: a pale moon ring in the middle of every plate
    if kind == "moon":
        for x in range(128):
            for y in range(128):
                r = math.hypot(x - 64, y - 60)
                if 14 < r < 17:
                    px[x, y] = (238, 238, 246, 255)
    if kind == "perfection":   # pale hands reaching out of the dark
        for _ in range(9):
            cx, cy = rnd.randint(10, 118), rnd.randint(14, 118)
            col = (196, 200, 214, 255)
            for x in range(cx - 4, cx + 5):
                for y in range(cy - 3, cy + 5):
                    if 0 <= x < 128 and 0 <= y < 128 and (x - cx) ** 2 / 16 + (y - cy - 1) ** 2 / 14 <= 1:
                        px[x, y] = col
            for f in range(4):                                  # fingers
                fxp = cx - 3 + f * 2
                for y in range(cy - 9 + (f in (0, 3)) * 2, cy - 2):
                    if 0 <= fxp < 128 and 0 <= y < 128:
                        px[fxp, y] = col
            for x in range(cx + 4, cx + 7):                     # thumb
                y = cy + 1 - (x - cx - 4)
                if 0 <= x < 128 and 0 <= y < 128:
                    px[x, y] = col
    return img


def m_shrine():
    k = Kit(23)
    k.bone("root")
    k.bone("shrine", "root", (0, 0, 0))
    b = lambda *a, **kw: k.box("shrine", *a, **kw)
    b((-52, 0, -36), (104, 8, 72), "under", top="dark")                 # stone platform
    b((-40, 0, -46), (80, 4, 10), "under")                              # steps
    b((-30, 4, -40), (60, 4, 6), "under")
    for x in (-44, 36):
        for z in (-28, 20):
            b((x, 8, z), (8, 62, 8), "skin")                            # lacquered pillars
    b((-50, 66, -32), (100, 7, 10), "mark")                             # front lintel
    b((-50, 66, 22), (100, 7, 10), "mark")
    b((-48, 8, -26), (96, 58, 4), "mouth")                              # the dark inside
    for i, (wd, dp, y) in enumerate(((124, 98, 73), (100, 78, 80), (76, 56, 86), (50, 34, 92))):
        b((-wd / 2, y, -dp / 2), (wd, 7, dp), "dark", under="accent")   # stacked roof
    b((-40, 99, -4), (80, 5, 8), "dark")                                # ridge
    for side in (-1, 1):                                                # upturned eaves
        b((side * 62 - 4, 74, -49), (8, 6, 14), "dark", rot=[0, 0, side * 28], pivot=[side * 62, 74, -42])
        b((side * 62 - 4, 74, 35), (8, 6, 14), "dark", rot=[0, 0, side * 28], pivot=[side * 62, 74, 42])
        b((side * 40 - 3, 100, -3), (6, 6, 6), "dark", rot=[0, 0, side * 35], pivot=[side * 40, 100, 0])
    for i in range(13):                                                 # the maw: fangs hang from the lintel...
        x = -42 + i * 7
        ln = 14 if i % 3 == 1 else 9
        b((x, 66 - ln, -33.5), (4, ln, 4), "teeth")
    for i in range(10):                                                 # ...and rise from the floor
        x = -38 + i * 8.4
        b((x, 8, -33.5), (4, 9 if i % 2 else 13, 4), "teeth")
    rnd = random.Random(5)
    for i in range(22):                                                 # skulls heaped around the base
        ang = math.radians(rnd.uniform(-160, -20) if i < 14 else rnd.uniform(20, 160))
        rad = rnd.uniform(50, 66)
        x, z = math.cos(ang) * rad, math.sin(ang) * rad * 0.8
        y = 0 if i % 3 else 4
        b((x - 4, y, z - 4), (8, 7, 8), "bone")
        b((x - 2.6, y + 3, z - 4.3), (2, 2, 0.5), "mouth")
        b((x + 0.6, y + 3, z - 4.3), (2, 2, 0.5), "mouth")
    for side in (-1, 1):                                                # horns over the gate
        b((side * 18 - 2, 73, -33), (4, 18, 4), "bone", rot=[-20, 0, side * 22], pivot=[side * 18, 73, -31])
    return k.geo("geometry.jjk.shrine", 10, 9, 3)


SHRINE_PAL = dict(skin=(120, 22, 26), dark=(30, 24, 26), light=(200, 190, 170), under=(70, 66, 70), mouth=(26, 6, 10), teeth=(236, 228, 206),
                  bone=(218, 206, 180), accent=(150, 30, 34), mark=(150, 26, 32), eye=(255, 255, 255), pupil=(0, 0, 0), claw=(30, 30, 30),
                  wing=(80, 80, 80))

orb_tex = {}
for name, (core, deep, hot) in ORBS.items():
    orb_texture(core, deep, hot, len(name)).save(RP / "textures" / "entity" / "jjk" / f"orb_{name}.png")
w(RP / "models" / "entity" / "orb.geo.json", m_orb())
anims["animation.jjk.orb.spin"] = {"loop": True, "bones": {
    "core": {"rotation": [0, "q.life_time * 360", "q.life_time * 200"], "scale": "1 + math.sin(q.life_time * 900) * 0.06"},
    "shell": {"rotation": ["q.life_time * -300", "q.life_time * -240", 0], "scale": "1.05 + math.sin(q.life_time * 600) * 0.08"}}}
fx_entity_bp("orb", ["blue", "red", "purple", "fire"], [1.3, 1.0, 5.0, 3.5])
fx_entity_rp("orb", "geometry.jjk.orb", {k_: f"orb_{k_}" for k_ in ORBS}, "entity_alphablend", {"spin": "animation.jjk.orb.spin"},
             "controller.render.jjk.variant4")

w(RP / "models" / "entity" / "domain_dome.geo.json", m_dome())
DOMES = ("void", "garden", "moon", "volcano", "perfection", "jackpot")
for i, kind in enumerate(DOMES):
    dome_texture(kind, 40 + i).save(RP / "textures" / "entity" / "jjk" / f"dome_{kind}.png")
fx_entity_bp("domain_dome", list(DOMES), life=20)
fx_entity_rp("domain_dome", "geometry.jjk.domain_dome", {k_: f"dome_{k_}" for k_ in DOMES}, "entity_alphatest", None,
             "controller.render.jjk.dome")

w(RP / "models" / "entity" / "shrine.geo.json", m_shrine())
paint(SHRINE_PAL, 99).save(RP / "textures" / "entity" / "jjk" / "shrine.png")
fx_entity_bp("shrine", life=20)
fx_entity_rp("shrine", "geometry.jjk.shrine", {"default": "shrine"})

w(RP / "render_controllers" / "jjk.render_controllers.json", {"format_version": "1.8.0", "render_controllers": {
    "controller.render.jjk.variant4": {"arrays": {"textures": {"Array.v": ["Texture.blue", "Texture.red", "Texture.purple", "Texture.fire"]}},
                                       "geometry": "Geometry.default", "materials": [{"*": "Material.default"}],
                                       "textures": ["Array.v[q.variant]"], "ignore_lighting": True},
    "controller.render.jjk.dome": {"arrays": {"textures": {"Array.v": [f"Texture.{k_}" for k_ in DOMES]}},
                                       "geometry": "Geometry.default", "materials": [{"*": "Material.default"}],
                                       "textures": ["Array.v[q.variant]"], "ignore_lighting": True}}})
for fx_id, fx_name in (("orb", "Cursed Technique"), ("domain_dome", "Domain Barrier"), ("shrine", "Malevolent Shrine")):
    lang.append(f"entity.jjk:{fx_id}.name={fx_name}")

w(RP / "animations" / "creatures.animation.json", {"format_version": "1.8.0", "animations": anims})
# names: this file owns the entity lines; gen_items.py owns the rest of the file
lang_p = RP / "texts" / "en_US.lang"
mine = {line.split("=", 1)[0] for line in lang}
keep = [line for line in (lang_p.read_text().splitlines() if lang_p.exists() else []) if line and line.split("=", 1)[0] not in mine
        and not (line.startswith(("entity.jjk:", "item.spawn_egg.entity.jjk:")) and "jjk:sorcerer" not in line)]   # (the cast's lines are gen_sorcerers.py's)
lang_p.write_text("\n".join(sorted(keep + lang)) + "\n")
print(f"Creatures: {len(CREATURES)} ({', '.join(CREATURES)}).")
