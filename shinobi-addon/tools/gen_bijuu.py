#!/usr/bin/env python3
"""Generates the nine tailed-beast bosses: BP entities, RP client entities,
geometry, animations and textures. Run from the shinobi-addon folder:
    python3 tools/gen_bijuu.py
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
    with open(path, "w") as f:
        json.dump(obj, f, indent=2)
        f.write("\n")


# UV regions in each 256x256 beast texture
MAIN, ACCENT, DARK, EYE = [0, 0], [0, 128], [0, 192], [128, 192]

# ---------------------------------------------------------------------------
# Beast definitions
# ---------------------------------------------------------------------------
BEASTS = {
    "shukaku": dict(name="Shukaku, the One-Tailed Raccoon", tails=1, main=(196, 160, 100), accent=(60, 80, 150),
                    dark=(70, 50, 30), eye=(240, 220, 60), W=30, H=30, L=36, legH=16, legW=10,
                    head=(22, 18, 18), snout=(8, 6, 6), ears=(6, 8), tail=(14, 44), egg=("#c4a064", "#3c5096")),
    "matatabi": dict(name="Matatabi, the Two-Tailed Cat", tails=2, main=(40, 90, 210), accent=(130, 200, 255),
                     dark=(15, 25, 70), eye=(250, 220, 60), W=20, H=20, L=40, legH=22, legW=7,
                     head=(18, 16, 16), snout=(8, 5, 4), ears=(5, 9), tail=(6, 40), egg=("#285ad2", "#82c8ff")),
    "isobu": dict(name="Isobu, the Three-Tailed Turtle", tails=3, main=(110, 140, 120), accent=(170, 90, 60),
                  dark=(40, 50, 45), eye=(240, 60, 40), W=34, H=18, L=40, legH=12, legW=11,
                  head=(16, 14, 16), snout=(10, 6, 4), shell=True, tail=(8, 30), egg=("#6e8c78", "#aa5a3c")),
    "son_goku": dict(name="Son Goku, the Four-Tailed Ape", tails=4, main=(170, 50, 40), accent=(230, 200, 150),
                     dark=(60, 20, 15), eye=(250, 240, 60), W=34, H=28, L=32, legH=24, legW=12,
                     head=(20, 20, 18), snout=(12, 8, 4), horns=2, tail=(7, 40), egg=("#aa3228", "#e6c896")),
    "kokuo": dict(name="Kokuo, the Five-Tailed Horse", tails=5, main=(235, 235, 230), accent=(200, 70, 60),
                  dark=(80, 80, 80), eye=(240, 60, 40), W=20, H=22, L=44, legH=28, legW=7,
                  head=(14, 14, 22), snout=(10, 9, 10), horns=5, tail=(6, 36), egg=("#ebebe6", "#c8463c")),
    "saiken": dict(name="Saiken, the Six-Tailed Slug", tails=6, main=(220, 225, 210), accent=(120, 200, 110),
                   dark=(60, 80, 60), eye=(40, 40, 40), W=26, H=18, L=56, legH=0, legW=0, legs=0,
                   head=(18, 14, 14), stalks=True, tail=(6, 22), egg=("#dce1d2", "#78c86e")),
    "chomei": dict(name="Chomei, the Seven-Tailed Beetle", tails=1, main=(80, 160, 70), accent=(150, 220, 255),
                   dark=(30, 50, 25), eye=(250, 140, 30), W=20, H=14, L=36, legH=14, legW=4, legs=6,
                   head=(14, 12, 12), horns=1, wings=6, tail=(5, 24), egg=("#50a046", "#96dcff")),
    "gyuki": dict(name="Gyuki, the Eight-Tailed Ox", tails=8, main=(140, 70, 140), accent=(220, 200, 220),
                  dark=(50, 25, 50), eye=(250, 230, 120), W=30, H=30, L=32, legH=24, legW=11,
                  head=(20, 18, 18), snout=(14, 8, 4), ox_horns=True, tail=(7, 46), egg=("#8c468c", "#dcc8dc")),
    "kurama": dict(name="Kurama, the Nine-Tailed Fox", tails=9, main=(235, 110, 20), accent=(255, 230, 190),
                   dark=(60, 20, 10), eye=(220, 30, 20), W=28, H=26, L=44, legH=26, legW=10,
                   head=(22, 18, 18), snout=(10, 8, 10), ears=(7, 14), tail=(9, 52), egg=("#eb6e14", "#ffe6be")),
}


def cube(origin, size, uv, inflate=0):
    c = {"origin": [round(v, 2) for v in origin], "size": size, "uv": uv}
    if inflate:
        c["inflate"] = inflate
    return c


# ---------------------------------------------------------------------------
# Creature kit (v2 models). Each beast is hand-built from these parts:
#   * a 256×256 atlas of 64×64 painted swatches (fur, shaded underside, markings, shell plates, ivory …) — every cube
#     face shows a random window of a swatch, so big surfaces get texture instead of a flat colour
#   * boxes whose underside automatically uses the shaded swatch
#   * jointed legs (hip → knee) with paws and claws, a hinged jaw, painted eyes
#   * tails built from chained segments that taper and curl, so they wave along their length instead of swinging
#     like planks
# Front of every beast is −Z. Bones the animations look for: body, head, jaw, leg<i> (+ leg<i>_l), tail<i>_<k>, wing<i>.
# ---------------------------------------------------------------------------
TILES = {"main": (0, 0), "under": (64, 0), "accent": (128, 0), "dark": (192, 0), "belly": (0, 64), "pattern": (64, 64),
         "ivory": (128, 64), "extra": (192, 64), "mouth": (0, 192), "glow": (64, 192)}
EYE_R, EYE_L = (0, 128), (16, 128)   # 16×12 painted eyes


def _clamp(v):
    return max(0, min(255, int(v)))


def paint_tile(img, name, base, rnd, kind="fur", second=None):
    x0, y0 = TILES[name]
    cols = [rnd.uniform(0.9, 1.08) for _ in range(64)]
    for x in range(64):
        streak = cols[x]
        for y in range(64):
            k = streak * rnd.uniform(0.93, 1.06)
            if kind == "fur" and rnd.random() < 0.12:
                k *= 0.82                                           # a darker hair
            if kind == "skin":
                k = rnd.uniform(0.95, 1.04) * (0.97 + 0.05 * math.sin(x * 0.4) * math.sin(y * 0.35))
            col = base
            if kind == "plates":                                    # shell / carapace: plates with dark seams
                px_, py_ = x % 16, (y + (8 if (x // 16) % 2 else 0)) % 16
                edge = min(px_, py_, 15 - px_, 15 - py_)
                k *= 0.55 if edge == 0 else (1.12 if edge == 1 else 1.0 - 0.02 * edge)
            if kind == "stripes" and second:                        # curved bands (Shukaku's markings, tail rings)
                if math.sin((y + 9 * math.sin(x * 0.2)) * 0.42) > 0.45:
                    col = second
            if kind == "flames" and second:                         # tongues of flame running up the fur (Matatabi)
                h = 22 + 16 * math.sin(x * 0.55) + 9 * math.sin(x * 1.7 + 1)
                if (y % 32) > 32 - h * 0.6:
                    col = second
            if kind == "suckers" and second:                        # tentacle undersides (Gyuki)
                if (x % 16 - 8) ** 2 + (y % 16 - 8) ** 2 < 20:
                    col = second
            img.putpixel((x0 + x, y0 + y), tuple(_clamp(c * k) for c in col) + (255,))


def paint_eye(img, at, iris, sclera=(245, 245, 235), pupil=(15, 10, 10), shape="slit", closed=False):
    x0, y0 = at
    for x in range(16):
        for y in range(12):
            dx, dy = (x - 7.5) / 8, (y - 5.5) / 6
            col = sclera
            if closed:
                col = (30, 25, 25) if abs(dy) < 0.22 else (0, 0, 0, 0)
            else:
                r = math.hypot(dx, dy * 1.1)
                if r < 0.62:
                    col = iris
                if shape == "slit" and abs(dx) < 0.14 and abs(dy) < 0.7:
                    col = pupil
                elif shape == "round" and r < 0.3:
                    col = pupil
                elif shape == "star" and (abs(dx) * abs(dy) < 0.035 and r < 0.75):
                    col = iris
                if y == 0 or (y == 1 and abs(dx) > 0.5):
                    col = (20, 15, 15)                              # the heavy upper lid
            if len(col) == 3:
                col = col + (255,)
            img.putpixel((x0 + x, y0 + y), col)


class Kit:
    def __init__(self, seed):
        self.bones = []
        self.rnd = random.Random(seed)
        self.legs, self.tails, self.wings = [], [], []

    def bone(self, name, parent, pivot, rot=None):
        b = {"name": name, "pivot": [round(v, 2) for v in pivot], "cubes": []}
        if parent:
            b["parent"] = parent
        if rot:
            b["rotation"] = rot
        self.bones.append(b)
        return b["cubes"]

    def face(self, sw, fw, fh):
        tx, ty = TILES[sw]
        uw, vh = min(62, fw), min(62, fh)
        u = tx + 1 + self.rnd.random() * max(0, 62 - uw)
        v = ty + 1 + self.rnd.random() * max(0, 62 - vh)
        return {"uv": [round(u, 1), round(v, 1)], "uv_size": [round(uw, 2), round(vh, 2)]}

    def box(self, o, s, sw="main", under="under", top=None, front=None, inflate=0):
        """A cube: `sw` on the sides, `top` on top (default sw), `under` beneath, `front` on the −Z face."""
        w_, h_, d_ = s
        uv = {"north": self.face(front or sw, w_, h_), "south": self.face(sw, w_, h_), "east": self.face(sw, d_, h_), "west": self.face(sw, d_, h_),
              "up": self.face(top or sw, w_, d_), "down": self.face(under or sw, w_, d_)}
        c = {"origin": [round(v, 2) for v in o], "size": [round(v, 2) for v in s], "uv": uv}
        if inflate:
            c["inflate"] = inflate
        return c

    def eye(self, cubes, x, y, z, right, w_=4, h_=3):
        at = EYE_R if right else EYE_L
        cubes.append({"origin": [round(x, 2), round(y, 2), round(z, 2)], "size": [w_, h_, 0.4],
                      "uv": {"north": {"uv": [at[0] + (16 if not right else 0), at[1]], "uv_size": [(-16 if not right else 16), 12]}}})

    def leg(self, parent, x, z, hip_y, upper, lower, paw=None, claws=3, sw="main", claw_sw="ivory", lower_sw=None, knee=0):
        """Hip bone leg<i> with the upper leg, child leg<i>_l with the lower leg, paw and claws. upper/lower = (width, length)."""
        i = len(self.legs)
        name = f"leg{i}"
        uw, ul = upper
        lw, ll = lower
        cu = self.bone(name, parent, [x, hip_y, z])
        cu.append(self.box([x - uw / 2, hip_y - ul, z - uw / 2], [uw, ul + 2, uw], sw))
        cl = self.bone(f"{name}_l", name, [x, hip_y - ul, z], [knee, 0, 0] if knee else None)
        cl.append(self.box([x - lw / 2, 0, z - lw / 2], [lw, ll, lw], lower_sw or sw))
        if paw:
            pw_, pl = paw
            cl.append(self.box([x - pw_ / 2, 0, z - lw / 2 - pl + lw * 0.3], [pw_, 3, pl], lower_sw or sw, under="dark"))
            for k in range(claws):
                cx = x - pw_ / 2 + (k + 0.5) * pw_ / claws
                cl.append(self.box([cx - 0.75, 0, z - lw / 2 - pl + lw * 0.3 - 2], [1.5, 2, 2.5], claw_sw, under=claw_sw))
        self.legs.append(name)
        return name

    def tail(self, parent, base, segs, w0, w1, seg_len, lift, yaw, sw="main", tip="accent", curl=-9, flat=1.0, ring=None):
        """A chain of `segs` tapering segments starting at `base`, raised by `lift`, turned by `yaw`, curling by `curl` per joint."""
        i = len(self.tails)
        names = []
        prev = parent
        x, y, z = base
        for k in range(segs):
            wd = w0 + (w1 - w0) * k / max(1, segs - 1)
            name = f"tail{i}_{k}"
            cubes = self.bone(name, prev, [x, y, z + k * seg_len], [lift, yaw, 0] if k == 0 else [curl, 0, 0])
            s_ = ring if ring and k % 2 else (tip if k == segs - 1 else sw)
            cubes.append(self.box([x - wd / 2, y - wd * flat / 2, z + k * seg_len - 0.5], [wd, wd * flat, seg_len + 1], s_, under="under" if s_ == sw else s_))
            if k == segs - 1 and tip:
                cubes.append(self.box([x - wd * 0.3, y - wd * flat * 0.3, z + (k + 1) * seg_len], [wd * 0.6, wd * flat * 0.6, seg_len * 0.5], tip, under=tip))
            names.append(name)
            prev = name
        self.tails.append(names)
        return names

    def fan(self, parent, base, n, spread, lift, **kw):
        """n tails fanned across `spread` degrees, alternately raised a little higher."""
        for i in range(n):
            yaw = 0 if n == 1 else (i / (n - 1) - 0.5) * spread
            self.tail(parent, base, lift=lift + (9 if i % 2 else 0), yaw=yaw, **kw)

    def horn(self, cubes, x, y, z, w0, length, steps=3, lean=(0, 0), sw="ivory"):
        """A tapering horn built from stacked cubes, drifting by `lean` (x, z) per step."""
        for k in range(steps):
            wd = w0 * (1 - 0.28 * k)
            h_ = length / steps
            cubes.append(self.box([x - wd / 2 + lean[0] * k, y + k * h_, z - wd / 2 + lean[1] * k], [wd, h_ + 0.5, wd], sw, under=sw))


def jaw(K, head_pivot_z, y, z_front, wd, length, teeth=True, sw="main"):
    """Lower jaw hinged at the back of the head, with a row of teeth."""
    cubes = K.bone("jaw", "head", [0, y + 2, head_pivot_z])
    cubes.append(K.box([-wd / 2, y, z_front], [wd, 2.5, length], sw, under="under", top="mouth"))
    if teeth:
        n = max(2, int(wd // 2.5))
        for i in range(n):
            cubes.append(K.box([-wd / 2 + 0.5 + i * (wd - 1.5) / max(1, n - 1), y + 2.5, z_front + 0.3], [1, 1.6, 1], "ivory", under="ivory"))
    return cubes


def upper_teeth(K, cubes, y, z_front, wd):
    n = max(2, int(wd // 2.5))
    for i in range(n):
        cubes.append(K.box([-wd / 2 + 0.5 + i * (wd - 1.5) / max(1, n - 1), y - 1.6, z_front + 0.3], [1, 1.8, 1], "ivory", under="ivory"))


# ---------------------------------------------------------------------------
# The nine beasts
# ---------------------------------------------------------------------------
def m_shukaku(K, b):
    """A huge, fat tanuki of sand: pot belly, stubby limbs, a grin full of teeth, cursed-seal markings, one massive tail."""
    by = 14
    body = K.bone("body", None, [0, by + 16, 0])
    body.append(K.box([-15, by, -16], [30, 28, 34], "main", under="belly"))
    body.append(K.box([-17, by - 3, -13], [34, 22, 26], "main", under="belly"))                 # the belly bulges out
    body.append(K.box([-13, by + 28, -12], [26, 5, 24], "pattern"))                             # markings over the back
    for sx in (-1, 1):
        body.append(K.box([sx * 17.2 - 0.3, by + 4, -10], [0.6, 16, 20], "pattern", under="pattern"))
    head = K.bone("head", "body", [0, by + 30, -15])
    head.append(K.box([-12, by + 22, -32], [24, 20, 18], "main", under="belly"))
    head.append(K.box([-7, by + 23, -38], [14, 9, 7], "main", under="belly"))                   # muzzle
    head.append(K.box([-2.5, by + 30, -39.5], [5, 3, 2.5], "dark", under="dark"))               # nose
    head.append(K.box([-12.3, by + 31, -32.3], [24.6, 6, 0.6], "pattern", under="pattern"))     # the mask across the eyes
    K.eye(head, -9.5, by + 31.5, -32.8, True, 6, 4.5)
    K.eye(head, 3.5, by + 31.5, -32.8, False, 6, 4.5)
    for sx in (-1, 1):                                                                         # round ears
        head.append(K.box([sx * 9 - 4, by + 41, -25], [8, 7, 4], "main"))
        head.append(K.box([sx * 9 - 2.5, by + 42, -25.5], [5, 4.5, 1], "dark", under="dark"))
    upper_teeth(K, head, by + 23, -38, 13)
    jaw(K, -22, by + 19.5, -37, 13, 14)
    for sx, sz in ((-1, -1), (1, -1), (-1, 1), (1, 1)):
        K.leg("body", sx * 12, sz * 11, by + 4, (10, 8), (11, 10), paw=(12, 13), sw="main")
    K.tail("body", [0, by + 14, 16], 6, 15, 8, 9, 38, 0, sw="main", tip="pattern", curl=-10, ring="pattern")


def m_matatabi(K, b):
    """A sleek cat wreathed in blue flame: long limbs, a long neck, tall ears, mismatched eyes, two whip-like tails."""
    by = 22
    body = K.bone("body", None, [0, by + 9, 0])
    body.append(K.box([-9, by, -20], [18, 17, 40], "pattern", under="under"))
    body.append(K.box([-10, by - 1, -21], [20, 20, 15], "pattern", under="under"))              # deep chest
    body.append(K.box([-8, by + 3, 8], [16, 13, 13], "pattern", under="under"))                 # lean haunches
    for z in range(-16, 18, 6):                                                                # flame licking off the spine
        h_ = 3 + (z * 7) % 4
        body.append(K.box([-1.5, by + 17, z], [3, h_, 4], "accent", under="accent"))
    body.append(K.box([-5, by + 12, -27], [10, 12, 10], "pattern", under="under"))              # neck
    head = K.bone("head", "body", [0, by + 22, -24])
    head.append(K.box([-8, by + 16, -39], [16, 14, 14], "pattern", under="under"))
    head.append(K.box([-4.5, by + 16, -44], [9, 6, 5.5], "main", under="under"))                # muzzle
    head.append(K.box([-1.5, by + 20.5, -45], [3, 2, 1.5], "dark", under="dark"))
    K.eye(head, -7, by + 22.5, -39.4, True, 5, 3.6)
    K.eye(head, 2, by + 22.5, -39.4, False, 5, 3.6)
    for sx in (-1, 1):                                                                         # tall pointed ears + cheek flames
        head.append(K.box([sx * 5.5 - 2.5, by + 30, -33], [5, 5, 3], "pattern"))
        head.append(K.box([sx * 5.5 - 1.5, by + 35, -32.5], [3, 4, 2], "pattern"))
        head.append(K.box([sx * 5.5 - 0.75, by + 39, -32], [1.5, 2.5, 1], "accent", under="accent"))
        head.append(K.box([sx * 9 - 1.5, by + 17, -34], [3, 6, 6], "accent", under="accent"))
    upper_teeth(K, head, by + 16, -44, 8)
    jaw(K, -30, by + 13.5, -43, 8, 12, sw="main")
    for sx, sz in ((-1, -1), (1, -1), (-1, 1), (1, 1)):
        K.leg("body", sx * 7, sz * 14, by + 4, (6.5, 11), (5, 15), paw=(6.5, 8), sw="pattern", lower_sw="main")
    for yaw in (-16, 16):
        K.tail("body", [0, by + 13, 20], 8, 6, 3, 8, 50, yaw, sw="pattern", tip="accent", curl=-11)


def m_isobu(K, b):
    """A giant armoured turtle: a spiked shell, a crested helm of a head with one eye shut, clawed arms, three paddle tails."""
    by = 10
    body = K.bone("body", None, [0, by + 9, 0])
    body.append(K.box([-17, by, -20], [34, 14, 40], "accent", under="belly"))                   # red-brown underside
    shell = K.bone("shell", "body", [0, by + 14, 0])
    for i, (wd, ln, h_) in enumerate(((40, 46, 6), (36, 42, 6), (30, 34, 5), (22, 24, 4))):   # domed shell in layers
        shell.append(K.box([-wd / 2, by + 10 + sum((6, 6, 5, 4)[:i]), -ln / 2 + 1], [wd, h_, ln], "pattern", under="dark"))
    rnd = random.Random(3)
    for ring, (rad, n, y_) in enumerate(((17, 12, by + 16), (12, 8, by + 22), (6, 5, by + 27))):   # rows of spikes
        for k in range(n):
            a = k / n * math.tau + ring * 0.4
            x, z = math.cos(a) * rad, math.sin(a) * rad * 1.15 + 1
            hh = rnd.uniform(4, 7)
            shell.append(K.box([x - 1.5, y_, z - 1.5], [3, hh, 3], "dark", under="dark"))
            shell.append(K.box([x - 0.75, y_ + hh, z - 0.75], [1.5, 2.5, 1.5], "ivory", under="ivory"))
    head = K.bone("head", "body", [0, by + 8, -19])
    head.append(K.box([-8, by + 1, -36], [16, 13, 17], "main", under="belly"))
    head.append(K.box([-9, by + 10, -37], [18, 5, 14], "pattern", under="dark"))                # helm plate
    head.append(K.box([-2.5, by + 15, -36], [5, 6, 10], "dark", under="dark"))                  # crest
    head.append(K.box([-5, by + 2, -40], [10, 7, 5], "main", under="belly"))                    # beak
    K.eye(head, -7.5, by + 7, -36.4, True, 5, 3.6)
    K.eye(head, 2.5, by + 7, -36.4, False, 5, 3.6)
    jaw(K, -24, by - 1, -39, 9, 14, teeth=False)
    for sx in (-1, 1):                                                                         # thick arms with three claws
        K.leg("body", sx * 17, -12, by + 6, (9, 5), (10, 11), paw=(11, 10), sw="main")
    for sx in (-1, 1):
        K.leg("body", sx * 15, 14, by + 5, (8, 4), (8, 11), paw=(9, 7), sw="main")
    for yaw in (-28, 0, 28):                                                                   # flat, shrimp-like tails
        K.tail("body", [0, by + 6, 19], 5, 12, 7, 8, 22, yaw, sw="main", tip="accent", curl=-7, flat=0.35)


def m_son_goku(K, b):
    """A red gorilla: huge shoulders and knuckle-walking arms, a crown of horns, tusks, four tails."""
    by = 22
    body = K.bone("body", None, [0, by + 14, 0])
    body.append(K.box([-15, by, -4], [30, 22, 22], "main", under="under"))                      # hips
    body.append(K.box([-18, by + 6, -18], [36, 28, 22], "main", under="belly"))                 # barrel chest, carried high
    body.append(K.box([-12, by + 9, -19.5], [24, 18, 2], "belly", under="belly"))               # bare chest
    body.append(K.box([-20, by + 28, -16], [40, 8, 16], "main"))                                # shoulders
    head = K.bone("head", "body", [0, by + 34, -14])
    head.append(K.box([-10, by + 30, -30], [20, 18, 16], "main", under="belly"))
    head.append(K.box([-7, by + 30, -32], [14, 13, 3], "belly", under="belly"))                 # face
    head.append(K.box([-6, by + 30, -36], [12, 8, 5], "belly", under="belly"))                  # muzzle
    head.append(K.box([-9, by + 42, -31], [18, 3, 4], "dark", under="dark"))                    # heavy brow
    K.eye(head, -7, by + 38.5, -32.4, True, 5, 3.6)
    K.eye(head, 2, by + 38.5, -32.4, False, 5, 3.6)
    for sx in (-1, 1):                                                                         # crown: two long horns, two short
        K.horn(head, sx * 6, by + 48, -22, 4, 15, lean=(sx * 1.2, -0.8), sw="accent")
        K.horn(head, sx * 2.5, by + 48, -26, 2.5, 7, steps=2, sw="accent")
        head.append(K.box([sx * 5 - 1, by + 30, -37], [2, 5, 2], "ivory", under="ivory"))       # tusks
    upper_teeth(K, head, by + 30, -36, 10)
    jaw(K, -22, by + 27, -35, 11, 13, sw="belly")
    for sx in (-1, 1):                                                                         # arms as long as the body is tall
        K.leg("body", sx * 19, -10, by + 28, (11, 22), (12, 28), paw=(13, 11), claws=4, sw="main", lower_sw="main")
    for sx in (-1, 1):
        K.leg("body", sx * 10, 12, by + 6, (10, 12), (9, 16), paw=(10, 9), sw="main")
    K.fan("body", [0, by + 12, 17], 4, 70, 46, segs=7, w0=7, w1=3.5, seg_len=7, sw="main", tip="accent", curl=-10)


def m_kokuo(K, b):
    """A white horse with a dolphin's head and five horns: long legs with tan hooves, an arched neck, five flowing tails."""
    by = 28
    body = K.bone("body", None, [0, by + 10, 0])
    body.append(K.box([-10, by, -22], [20, 20, 44], "main", under="under"))
    body.append(K.box([-11, by - 1, -23], [22, 23, 16], "main", under="under"))                 # chest
    body.append(K.box([-10.5, by + 1, 8], [21, 20, 15], "main", under="under"))                 # croup
    body.append(K.box([-6, by + 14, -30], [12, 18, 12], "main", under="under"))                 # neck rising forward
    body.append(K.box([-5.5, by + 28, -34], [11, 10, 11], "main", under="under"))
    head = K.bone("head", "body", [0, by + 36, -30])
    head.append(K.box([-7, by + 32, -45], [14, 14, 16], "main", under="under"))
    head.append(K.box([-5, by + 32, -55], [10, 9, 10], "main", under="under"))                  # the long dolphin snout
    head.append(K.box([-3.5, by + 32, -60], [7, 6, 5], "main", under="under"))
    K.eye(head, -7.4, by + 39, -44, True, 0.4, 3.4)
    head[-1] = {"origin": [-7.4, by + 39, -44], "size": [0.4, 3.4, 5], "uv": {"west": {"uv": [EYE_R[0], EYE_R[1]], "uv_size": [16, 12]}}}
    head.append({"origin": [7, by + 39, -44], "size": [0.4, 3.4, 5], "uv": {"east": {"uv": [EYE_L[0] + 16, EYE_L[1]], "uv_size": [-16, 12]}}})
    for sx in (-1, 1):                                                                         # five horns: two long, two short, one centre
        K.horn(head, sx * 5, by + 46, -34, 3.2, 18, steps=4, lean=(sx * 0.6, 1.6), sw="accent")
        K.horn(head, sx * 3, by + 46, -40, 2.6, 9, steps=3, lean=(0, 0.8), sw="accent")
    K.horn(head, 0, by + 46, -44, 2.6, 6, steps=2, sw="accent")
    jaw(K, -40, by + 29.5, -59, 6, 18, teeth=False)
    for sx, sz in ((-1, -1), (1, -1), (-1, 1), (1, 1)):
        n = K.leg("body", sx * 7, sz * 16, by + 4, (6.5, 12), (5, 20), sw="main")
        K.bones[-1]["cubes"].append(K.box([sx * 7 - 3.5, 0, sz * 16 - 3.5], [7, 5, 7], "accent", under="dark"))    # hooves
    K.fan("body", [0, by + 16, 22], 5, 80, 44, segs=8, w0=6, w1=2.5, seg_len=7, sw="main", tip="accent", curl=-12)


def m_saiken(K, b):
    """A pale giant slug reared up on its foot: stubby arms, eye stalks, a dripping mouth, six fat tails."""
    body = K.bone("body", None, [0, 10, 0])
    body.append(K.box([-14, 0, -18], [28, 12, 46], "main", under="accent"))                     # the foot
    body.append(K.box([-16, 0, -14], [32, 5, 38], "accent", under="accent"))                    # slime skirt
    body.append(K.box([-12, 10, -22], [24, 16, 24], "main", under="under"))                     # the body rears up at the front
    body.append(K.box([-11, 24, -24], [22, 14, 18], "main", under="under"))
    for x, z, h_ in ((-9, -24.5, 7), (4, -24.5, 5), (10, -18, 6), (-12.5, -10, 8), (11.5, -2, 5)):   # slime running down
        body.append(K.box([x, 22 - h_, z], [2.5, h_, 1.5], "accent", under="accent"))
    head = K.bone("head", "body", [0, 36, -16])
    head.append(K.box([-10, 34, -27], [20, 14, 18], "main", under="under"))
    head.append(K.box([-4, 36, -28], [8, 5, 1.5], "mouth", under="mouth"))                      # round mouth
    for sx in (-1, 1):                                                                         # eye stalks
        head.append(K.box([sx * 6 - 1.5, 48, -22], [3, 9, 3], "main"))
        head.append(K.box([sx * 6 - 2.5, 57, -23], [5, 5, 5], "ivory", under="ivory"))
        head.append(K.box([sx * 6 - 1.2, 58.2, -23.4], [2.4, 2.6, 0.6], "dark", under="dark"))
        head.append(K.box([sx * 3 - 1, 48, -25], [2, 5, 2], "main"))                            # short feelers
    for sx in (-1, 1):                                                                         # stubby arms
        i = len(K.legs)
        cu = K.bone(f"leg{i}", "body", [sx * 12, 28, -18])
        cu.append(K.box([sx * 12 - (0 if sx > 0 else 7), 22, -22], [7, 7, 8], "main"))
        cl = K.bone(f"leg{i}_l", f"leg{i}", [sx * 17, 24, -20])
        cl.append(K.box([sx * 17 - (0 if sx > 0 else 6), 14, -23], [6, 10, 7], "main"))
        K.legs.append(f"leg{i}")
    K.fan("body", [0, 9, 26], 6, 110, 30, segs=5, w0=9, w1=5, seg_len=6, sw="main", tip="accent", curl=-8)


def m_chomei(K, b):
    """An armoured rhinoceros beetle: a plated shell, a great curved horn, six jointed legs, six wings and a tail."""
    by = 16
    body = K.bone("body", None, [0, by + 7, 0])
    body.append(K.box([-9, by, -6], [18, 12, 26], "pattern", under="dark"))                     # abdomen
    body.append(K.box([-10, by + 2, -18], [20, 13, 14], "main", under="dark"))                  # thorax
    body.append(K.box([-10.5, by + 12, -5], [21, 3, 24], "main"))                               # wing cases
    body.append(K.box([-0.4, by + 15, -5], [0.8, 0.6, 24], "dark", under="dark"))
    for z in (0, 6, 12, 17):
        body.append(K.box([-9.3, by - 0.4, z], [18.6, 0.8, 1.2], "dark", under="dark"))         # plate seams
    head = K.bone("head", "body", [0, by + 8, -17])
    head.append(K.box([-7, by + 1, -28], [14, 11, 11], "main", under="dark"))
    head.append(K.box([-8, by + 10, -27], [16, 3, 9], "pattern", under="dark"))                 # helm
    K.eye(head, -6.5, by + 5, -28.4, True, 4, 3)
    K.eye(head, 2.5, by + 5, -28.4, False, 4, 3)
    for k, (y_, z_, ln) in enumerate(((by + 6, -34, 7), (by + 9, -39, 6), (by + 13, -42, 5), (by + 18, -43, 4))):   # the horn sweeps up
        wd = 4 - k * 0.6
        head.append(K.box([-wd / 2, y_, z_], [wd, 4 + k, ln], "accent", under="accent"))
    for sx in (-1, 1):
        head.append(K.box([sx * 2 - 0.75, by + 22, -43.5], [1.5, 4, 1.5], "accent", under="accent"))   # forked tip
        head.append(K.box([sx * 4 - 1, by + 1, -32], [2, 2, 5], "dark", under="dark"))          # mandibles
    for i, sz in enumerate((-14, -4, 8)):
        for sx in (-1, 1):
            n = len(K.legs)
            cu = K.bone(f"leg{n}", "body", [sx * 9, by + 4, sz], [0, 0, sx * -38])
            cu.append(K.box([sx * 9 - (0 if sx > 0 else 10), by + 3, sz - 1.5], [10, 3, 3], "dark", under="dark"))
            cl = K.bone(f"leg{n}_l", f"leg{n}", [sx * 19, by + 4.5, sz], [0, 0, sx * 78])
            cl.append(K.box([sx * 19 - (0 if sx > 0 else 14), by + 3.5, sz - 1], [14, 2, 2], "dark", under="dark"))
            cl.append(K.box([sx * 32 - 1, by + 2.5, sz - 1.5], [2.5, 3, 3], "accent", under="accent"))
            K.legs.append(f"leg{n}")
    for i in range(6):                                                                         # six wings in three pairs
        sx = -1 if i % 2 == 0 else 1
        row = i // 2
        name = f"wing{i}"
        ln, wd = 34 - row * 5, 11 - row * 2
        cu = K.bone(name, "body", [sx * 6, by + 15, -8 + row * 7], [0, sx * (18 + row * 22), sx * -(16 + row * 4)])
        x0 = sx * 6 if sx > 0 else sx * 6 - ln
        cu.append({"origin": [x0, by + 15, -8 + row * 7 - wd / 2], "size": [ln, 0.3, wd],
                   "uv": {"up": K.face("accent", ln, wd), "down": K.face("accent", ln, wd)}})
        cu.append(K.box([x0 + (0 if sx > 0 else ln - ln), by + 15, -8 + row * 7 - wd / 2], [ln, 0.6, 1.2], "extra", under="extra"))   # the leading vein
        K.wings.append(name)
    K.tail("body", [0, by + 5, 20], 7, 6, 2.5, 6, 30, 0, sw="pattern", tip="accent", curl=-7)


def m_gyuki(K, b):
    """An ox above, an octopus below: a hulking torso on knuckled arms, four horns (one snapped), eight tentacles for legs."""
    by = 20
    body = K.bone("body", None, [0, by + 16, 0])
    body.append(K.box([-14, by - 6, -6], [28, 22, 22], "main", under="pattern"))                # where the tentacles join
    body.append(K.box([-17, by + 8, -18], [34, 28, 24], "main", under="belly"))                 # torso
    body.append(K.box([-20, by + 30, -17], [40, 10, 20], "main"))                               # the hump of the shoulders
    body.append(K.box([-11, by + 12, -19.5], [22, 16, 2], "belly", under="belly"))
    head = K.bone("head", "body", [0, by + 34, -15])
    head.append(K.box([-10, by + 28, -32], [20, 18, 17], "main", under="belly"))
    head.append(K.box([-7.5, by + 27, -39], [15, 10, 8], "belly", under="belly"))               # muzzle
    for sx in (-1, 1):
        head.append(K.box([sx * 3.5 - 1, by + 32, -39.6], [2, 2, 1], "dark", under="dark"))     # nostrils
    head.append(K.box([-9, by + 41, -33], [18, 3, 4], "dark", under="dark"))
    K.eye(head, -8, by + 37.5, -32.4, True, 5, 3.4)
    K.eye(head, 3, by + 37.5, -32.4, False, 5, 3.4)
    for sx in (-1, 1):                                                                         # great horns sweep out and forward; the left one is broken
        head.append(K.box([sx * 10 - (0 if sx > 0 else 8), by + 40, -26], [8, 5, 5], "ivory", under="ivory"))
        if sx > 0:
            head.append(K.box([sx * 16, by + 41, -32], [4.5, 4.5, 10], "ivory", under="ivory"))
            head.append(K.box([sx * 16.5, by + 43, -38], [3.5, 5, 7], "ivory", under="ivory"))
            head.append(K.box([sx * 17, by + 47, -40], [2.5, 6, 3], "ivory", under="ivory"))
        else:
            head.append(K.box([sx * 16 - 4.5, by + 41, -29], [4.5, 4.5, 6], "ivory", under="ivory"))
        K.horn(head, sx * 6, by + 46, -20, 3.2, 9, steps=3, lean=(sx * 0.8, 0.5))
    upper_teeth(K, head, by + 27, -39, 13)
    jaw(K, -23, by + 24, -38, 14, 15, sw="belly")
    for sx in (-1, 1):                                                                         # arms
        K.leg("body", sx * 20, -10, by + 30, (11, 20), (13, 30), paw=(14, 12), claws=4, sw="main")
    for i in range(8):                                                                         # eight tentacles: every other one braces on the ground
        yaw = (i / 7 - 0.5) * 230
        K.tail("body", [0, by + 2, 8], 8, 8, 3, 8, -18 if i % 2 == 0 else 34, yaw, sw="main", tip="accent",
               curl=7 if i % 2 == 0 else -12)
        for nm in K.tails[-1]:                                                                # suckers underneath
            cu = next(x for x in K.bones if x["name"] == nm)["cubes"][0]
            cu["uv"]["down"] = K.face("pattern", cu["size"][0], cu["size"][2])


def m_kurama(K, b):
    """The Nine-Tails: a lean, deep-chested fox with long ears, black-rimmed eyes that sweep back to them, and nine tails."""
    by = 26
    body = K.bone("body", None, [0, by + 12, 0])
    body.append(K.box([-11, by + 2, -22], [22, 20, 44], "main", under="belly"))
    body.append(K.box([-14, by, -24], [28, 26, 20], "main", under="belly"))                     # chest and shoulders
    body.append(K.box([-12, by + 3, 6], [24, 20, 16], "main", under="belly"))                   # haunches
    body.append(K.box([-7, by + 16, -32], [14, 16, 12], "main", under="belly"))                 # neck
    for z in range(-28, 12, 7):                                                                # ruff along the spine
        body.append(K.box([-2, by + 26 - (2 if z > -20 else -3), z], [4, 4, 5], "main"))
    head = K.bone("head", "body", [0, by + 28, -28])
    head.append(K.box([-10, by + 20, -44], [20, 17, 17], "main", under="belly"))
    head.append(K.box([-6, by + 20, -52], [12, 9, 9], "main", under="belly"))                   # long muzzle
    head.append(K.box([-4.5, by + 20, -57], [9, 6.5, 6], "main", under="belly"))
    head.append(K.box([-2, by + 25.5, -58.5], [4, 2.5, 2.5], "dark", under="dark"))             # nose
    for sx in (-1, 1):
        head.append(K.box([sx * 6 - 4, by + 30, -44.4], [8, 5, 0.6], "dark", under="dark"))     # black around the eyes…
        head.append(K.box([sx * 8.5 - 2, by + 34, -42], [4, 3.5, 9], "dark", under="dark"))     # …sweeping back to the ears
        head.append(K.box([sx * 11 - 2, by + 20, -40], [4, 7, 8], "main"))                      # cheek ruff
        ear = K.bone(f"ear{0 if sx < 0 else 1}", "head", [sx * 7, by + 37, -31], [-12, 0, sx * -10])
        ear.append(K.box([sx * 7 - 3, by + 37, -33], [6, 9, 4], "main"))
        ear.append(K.box([sx * 7 - 2, by + 46, -32.5], [4, 8, 3], "main"))
        ear.append(K.box([sx * 7 - 1, by + 54, -32], [2, 5, 2], "dark", under="dark"))
        ear.append(K.box([sx * 7 - 1.8, by + 38.5, -33.4], [3.6, 12, 0.6], "dark", under="dark"))
    K.eye(head, -9, by + 30.6, -44.8, True, 6, 3.8)
    K.eye(head, 3, by + 30.6, -44.8, False, 6, 3.8)
    upper_teeth(K, head, by + 20, -57, 8)
    jaw(K, -38, by + 17, -56, 9, 20)
    for sx in (-1, 1):                                                                         # forelegs end in clawed hands
        K.leg("body", sx * 11, -15, by + 6, (9, 14), (7, 18), paw=(9, 11), claws=4, sw="main")
    for sx in (-1, 1):
        K.leg("body", sx * 10, 14, by + 8, (10, 14), (7, 20), paw=(8, 10), sw="main", knee=14)
    K.fan("body", [0, by + 16, 21], 9, 150, 58, segs=8, w0=9, w1=4.5, seg_len=8, sw="main", tip="under", curl=-9)


MODELS = {"shukaku": m_shukaku, "matatabi": m_matatabi, "isobu": m_isobu, "son_goku": m_son_goku, "kokuo": m_kokuo,
          "saiken": m_saiken, "chomei": m_chomei, "gyuki": m_gyuki, "kurama": m_kurama}
# per-beast swatches: (tile kind, colour[, second colour]); anything not listed falls back to the palette
LOOKS = {
    "shukaku": dict(pattern=("stripes", "main", (48, 62, 132)), belly=("fur", (214, 184, 128)), eye=dict(iris=(235, 205, 60), sclera=(20, 18, 16), shape="star")),
    "matatabi": dict(pattern=("flames", "main", (16, 30, 96)), main=("fur", (70, 130, 235)), eye=dict(iris=(250, 220, 60)), eye_l=dict(iris=(90, 220, 110))),
    "isobu": dict(pattern=("plates", (104, 112, 108)), belly=("skin", (150, 78, 56)), eye=dict(iris=(235, 190, 60), shape="round"), eye_l=dict(iris=(0, 0, 0), closed=True)),
    "son_goku": dict(belly=("skin", (96, 150, 84)), accent=("skin", (232, 212, 150)), eye=dict(iris=(250, 235, 70), shape="round")),
    "kokuo": dict(accent=("skin", (150, 96, 70)), eye=dict(iris=(60, 130, 200), shape="round")),
    "saiken": dict(main=("skin", (228, 232, 220)), accent=("skin", (150, 214, 150)), eye=dict(iris=(30, 30, 30), shape="round")),
    "chomei": dict(pattern=("plates", (56, 122, 190)), main=("skin", (40, 96, 160)), accent=("skin", (170, 226, 250)), extra=("skin", (90, 160, 210)),
                   eye=dict(iris=(250, 150, 40), sclera=(250, 150, 40), shape="round")),
    "gyuki": dict(pattern=("suckers", (120, 60, 120), (216, 190, 200)), belly=("skin", (188, 150, 170)), eye=dict(iris=(250, 240, 200), sclera=(250, 240, 200), shape="round")),
    "kurama": dict(belly=("fur", (244, 150, 60)), eye=dict(iris=(215, 30, 20), sclera=(230, 60, 40))),
}


def build_geometry(bid, b):
    K = Kit(sum(map(ord, bid)))
    MODELS[bid](K, b)
    top = max(c["origin"][1] + c["size"][1] for bn in K.bones for c in bn["cubes"])
    geo = {"format_version": "1.12.0", "minecraft:geometry": [{
        "description": {"identifier": f"geometry.aegis.{bid}", "texture_width": 256, "texture_height": 256,
                        "visible_bounds_width": 14, "visible_bounds_height": 10, "visible_bounds_offset": [0, top / 32, 0]},
        "bones": K.bones}]}
    return geo, K.legs, K.tails, K.wings


def build_animation(bid, legs, tails, wings):
    walk = "math.cos(q.modified_distance_moved * 22) * 26 * math.min(1.0, q.modified_move_speed * 2)"
    bones = {"head": {"rotation": ["q.target_x_rotation * 0.6 - math.sin(v.attack_time * 180) * 20", "q.target_y_rotation * 0.6", 0]},
             "body": {"position": [0, "math.sin(q.life_time * 90) * 0.5", 0]},
             "jaw": {"rotation": ["4 + math.sin(q.life_time * 90) * 3 + math.sin(v.attack_time * 180) * 28", 0, 0]},
             "ear0": {"rotation": [0, 0, "math.sin(q.life_time * 37) > 0.96 ? 14 : 0"]},
             "ear1": {"rotation": [0, 0, "math.sin(q.life_time * 41 + 60) > 0.96 ? -14 : 0"]}}
    six = len(legs) == 6
    for i, n in enumerate(legs):
        sign = 1 if (i % 2 == 0) == (i // 2 % 2 == 0) else -1
        if six:   # beetle legs scuttle sideways
            bones[n] = {"rotation": [0, f"{sign} * {walk} * 0.6", 0]}
        else:
            bones[n] = {"rotation": [f"{sign} * {walk}", 0, 0]}
            bones[f"{n}_l"] = {"rotation": [f"math.max(0, {-sign} * {walk}) * 0.7", 0, 0]}     # the knee folds on the back swing
    for i, chain in enumerate(tails):      # a wave that travels down each tail, a little out of step with its neighbours
        for k, n in enumerate(chain):
            amp = 3 + k * 1.6
            bones[n] = {"rotation": [f"math.sin(q.life_time * 80 + {i * 47} - {k * 38}) * {amp:.1f}",
                                     f"math.cos(q.life_time * 62 + {i * 61} - {k * 33}) * {amp * 1.2:.1f}", 0]}
    for i, n in enumerate(wings):
        side = -1 if i % 2 == 0 else 1
        bones[n] = {"rotation": [0, 0, f"{side} * math.sin(q.life_time * 1600 + {i * 30}) * 24"]}
    return {f"animation.aegis.{bid}.idle": {"loop": True, "bones": bones}}


def texture(bid, b):
    img = Image.new("RGBA", (256, 256), (0, 0, 0, 0))
    rnd = random.Random(sum(map(ord, bid)) + 7)
    look = LOOKS.get(bid, {})
    pal = {"main": b["main"], "under": tuple(int(c * 0.66) for c in b["main"]), "accent": b["accent"], "dark": b["dark"],
           "belly": tuple(min(255, int(c * 1.12) + 10) for c in b["main"]), "pattern": b["main"], "ivory": (236, 228, 200),
           "extra": b["accent"], "mouth": (110, 24, 28), "glow": b["eye"]}
    for name in TILES:
        spec = look.get(name)
        if spec:
            kind, col = spec[0], spec[1]
            col = pal[col] if isinstance(col, str) else col
            paint_tile(img, name, col, rnd, kind, spec[2] if len(spec) > 2 else None)
        else:
            paint_tile(img, name, pal[name], rnd, "skin" if name in ("ivory", "mouth", "dark", "glow") else "fur")
    e = look.get("eye", dict(iris=b["eye"]))
    paint_eye(img, EYE_R, **e)
    paint_eye(img, EYE_L, **look.get("eye_l", e))
    return img


# ---------------------------------------------------------------------------
# Write everything
# ---------------------------------------------------------------------------
anims = {}
roar = {"animation.aegis.bijuu_roar": {"animation_length": 1.6, "bones": {
    "head": {"rotation": {"0.0": [0, 0, 0], "0.25": [-35, 0, 0], "1.2": [-35, 0, 0], "1.6": [0, 0, 0]}},
    "jaw": {"rotation": {"0.0": [0, 0, 0], "0.2": [34, 0, 0], "0.5": [30, 0, 0], "0.8": [34, 0, 0], "1.2": [32, 0, 0], "1.6": [0, 0, 0]}},
    "body": {"rotation": {"0.0": [0, 0, 0], "0.25": [-6, 0, 0], "1.2": [-6, 0, 0], "1.6": [0, 0, 0]}}}}}
anims.update(roar)
lang = []
for bid, b in BEASTS.items():
    geo, legs, tails, wings = build_geometry(bid, b)
    w(RP / "models" / "entity" / f"{bid}.geo.json", geo)
    _have = {bn["name"] for bn in geo["minecraft:geometry"][0]["bones"]}
    for _name, _an in build_animation(bid, legs, tails, wings).items():       # only the bones this beast has
        _an["bones"] = {k: v for k, v in _an["bones"].items() if k in _have}
        anims[_name] = _an
    texture(bid, b).save(RP / "textures" / "entity" / "aegis" / f"{bid}.png")
    w(RP / "entity" / f"{bid}.entity.json", {"format_version": "1.10.0", "minecraft:client_entity": {"description": {
        "identifier": f"aegis:{bid}", "materials": {"default": "entity_alphatest"},
        "textures": {"default": f"textures/entity/aegis/{bid}"},
        "geometry": {"default": f"geometry.aegis.{bid}"},
        "animations": {"idle": f"animation.aegis.{bid}.idle"}, "scripts": {"animate": ["idle"]},
        "render_controllers": ["controller.render.default"],
        "spawn_egg": {"base_color": b["egg"][0], "overlay_color": b["egg"][1]}}}})

    tails = b["tails"] if bid != "chomei" else 7
    hp = 500 + tails * 250
    width = round(max(b["W"], 24) / 16 + 0.6, 2)
    height = round((b["legH"] + b["H"]) / 16 + 0.6, 2)
    comps = {
        "minecraft:type_family": {"family": ["tailed_beast", "monster", "mob"]},
        "minecraft:health": {"value": hp, "max": hp},
        "minecraft:boss": {"hud_range": 60, "name": b["name"], "should_darken_sky": True},
        "minecraft:collision_box": {"width": width, "height": height},
        "minecraft:movement": {"value": 0.31},
        "minecraft:movement.basic": {},
        "minecraft:navigation.walk": {"can_path_over_water": True, "avoid_water": False, "can_swim": True,
                                      "can_break_doors": True},
        "minecraft:jump.static": {},
        "minecraft:physics": {},
        "minecraft:pushable": {"is_pushable": False, "is_pushable_by_piston": False},
        "minecraft:knockback_resistance": {"value": 1.0},
        "minecraft:attack": {"damage": int(10 + tails * 2)},
        "minecraft:follow_range": {"value": 64, "max": 64},
        "minecraft:persistent": {},
        "minecraft:nameable": {},
        "minecraft:fire_immune": {},
        "minecraft:damage_sensor": {"triggers": [{"cause": "fall", "deals_damage": "no"},
                                                 {"cause": "suffocation", "deals_damage": "no"},
                                                 {"cause": "drowning", "deals_damage": "no"}]},
        "minecraft:breathable": {"total_supply": 15, "suffocate_time": 0, "breathes_water": True},
        "minecraft:experience_reward": {"on_death": "q.last_hit_by_player ? 200 + 50 * " + str(tails) + " : 0"},
        "minecraft:loot": {"table": "loot_tables/entities/aegis_bijuu.json"},
        "minecraft:behavior.float": {"priority": 0},
        "minecraft:behavior.melee_attack": {"priority": 2, "speed_multiplier": 1.35, "track_target": True, "reach_multiplier": 1.4},
        "minecraft:behavior.hurt_by_target": {"priority": 1},
        "minecraft:behavior.nearest_attackable_target": {"priority": 3, "must_see": False, "reselect_targets": True,
            "within_radius": 48, "entity_types": [
                {"filters": {"any_of": [{"test": "is_family", "subject": "other", "value": "player"},
                                        {"test": "is_family", "subject": "other", "value": "chakra_clone"}]},
                 "max_dist": 48}]},
        "minecraft:behavior.random_stroll": {"priority": 6, "speed_multiplier": 0.8},
        "minecraft:behavior.look_at_player": {"priority": 7, "look_distance": 16},
        "minecraft:behavior.random_look_around": {"priority": 8},
    }
    w(BP / "entities" / f"{bid}.json", {"format_version": "1.21.0", "minecraft:entity": {
        "description": {"identifier": f"aegis:{bid}", "is_spawnable": True, "is_summonable": True,
                        "is_experimental": False},
        "components": comps}})
    lang.append(f"entity.aegis:{bid}.name={b['name']}")
    lang.append(f"item.spawn_egg.entity.aegis:{bid}.name=Spawn {b['name'].split(',')[0]}")

w(RP / "animations" / "bijuu.animation.json", {"format_version": "1.8.0", "animations": anims})

w(BP / "loot_tables" / "entities" / "aegis_bijuu.json", {"pools": [
    {"rolls": 1, "entries": [{"type": "item", "name": "aegis:ryo", "weight": 1,
                              "functions": [{"function": "set_count", "count": {"min": 20, "max": 40}}]}]},
    {"rolls": 1, "entries": [{"type": "item", "name": "minecraft:diamond", "weight": 1,
                              "functions": [{"function": "set_count", "count": {"min": 3, "max": 8}}]}]},
    {"rolls": 1, "entries": [{"type": "item", "name": "minecraft:golden_apple", "weight": 1,
                              "functions": [{"function": "set_count", "count": {"min": 1, "max": 3}}]}]},
    {"rolls": 1, "entries": [{"type": "item", "name": "aegis:chakra_pill", "weight": 1,
                              "functions": [{"function": "set_count", "count": {"min": 4, "max": 10}}]}]},
    {"rolls": 1, "entries": [{"type": "item", "name": "aegis:reroll_scroll", "weight": 1},
                             {"type": "empty", "weight": 3}]},
]})

lang_path = RP / "texts" / "en_US.lang"
existing = [l for l in lang_path.read_text().splitlines() if "aegis:" not in l or not any(b in l for b in BEASTS)]
lang_path.write_text("\n".join(existing + lang) + "\n")
print("Generated", len(BEASTS), "tailed beasts.")

# The Tailed Beast Cloaks (Jinchūriki mode) are generated by tools/gen_jinchuriki.py.
