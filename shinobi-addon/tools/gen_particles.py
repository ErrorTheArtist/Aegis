#!/usr/bin/env python3
"""All add-on particles: procedural textures (animated flipbooks for smoke & flame, variants for sparks, bolts, rocks)
and every particle effect, from one structured spec — which also drives an offline previewer.

  python3 tools/gen_particles.py                      # write textures + particle files
  python3 tools/gen_particles.py --preview a b … -o x  # contact sheet of particles (needs the files written)

Design notes
  * fewer, larger, better-textured particles (cheap for weak devices) instead of big counts of plain dots
  * every effect animates size (pop-in, grow, shrink), colour (white-hot → colour → dark → fade) and spin
  * flat shockwaves / vortexes lie on the ground (emitter_transform_xz); bursts fly out with drag
  * effects tinted by the script colour fall back to a default colour when none is given
"""
import json
import math
import sys
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageFilter

ROOT = Path(__file__).resolve().parent.parent
RP = ROOT / "resource_pack"
TEX = RP / "textures" / "particle" / "aegis"
PDIR = RP / "particles"
rng = np.random.default_rng(1234)


# ===========================================================================
# Texture helpers
# ===========================================================================
def noise(w, h, scale, seed, octaves=4):
    r = np.random.default_rng(seed)
    out = np.zeros((h, w))
    amp, tot = 1.0, 0.0
    for o in range(octaves):
        g = max(2, int(scale * 2 ** o))
        small = (r.random((g, g)) * 255).astype(np.uint8)
        big = np.asarray(Image.fromarray(small).resize((w, h), Image.BICUBIC), dtype=float) / 255
        out += big * amp
        tot += amp
        amp *= 0.5
    return out / tot


def grid(w, h):
    y, x = np.mgrid[0:h, 0:w]
    return (x + 0.5) / w * 2 - 1, (y + 0.5) / h * 2 - 1   # -1..1, y down


def to_img(rgb, a):
    rgb = np.clip(rgb, 0, 1)
    a = np.clip(a, 0, 1)
    arr = np.dstack([rgb[..., 0] * 255, rgb[..., 1] * 255, rgb[..., 2] * 255, a * 255]).astype(np.uint8)
    return Image.fromarray(arr, "RGBA")


def gray(v, a):
    return to_img(np.dstack([v, v, v]), a)


def strip(frames):
    w, h = frames[0].size
    out = Image.new("RGBA", (w * len(frames), h))
    for i, f in enumerate(frames):
        out.paste(f, (i * w, 0))
    return out


def smoothstep(e0, e1, x):
    t = np.clip((x - e0) / (e1 - e0), 0, 1)
    return t * t * (3 - 2 * t)


# ---------------------------------------------------------------------------
def billow(s, k, seed, puffs=9, spread=0.32, grow=0.35):
    """Height field of a cluster of spheres (a cauliflower puff), lit from the top-left: returns (shade, coverage, thickness)."""
    r = np.random.default_rng(seed)
    X, Y = grid(s, s)
    h = np.zeros((s, s))
    for i in range(puffs):
        a = r.random() * 2 * math.pi
        dist = spread * math.sqrt(r.random()) * (1 + grow * k)
        cx, cy = math.cos(a) * dist, math.sin(a) * dist * 0.9
        rad = r.uniform(0.2, 0.36) * (1 + grow * k) * (1.15 if i == 0 else 1)
        if i == 0:
            cx = cy = 0
        d2 = (X - cx) ** 2 + (Y - cy) ** 2
        h = np.maximum(h, np.sqrt(np.clip(rad * rad - d2, 0, None)))
    nz = noise(s, s, 4, seed + 7, 4)
    h = h * (0.85 + 0.3 * nz)
    gy, gx = np.gradient(h)
    nx, ny, nzv = -gx * s * 0.5, -gy * s * 0.5, np.ones_like(h) * 0.35
    ln = np.sqrt(nx ** 2 + ny ** 2 + nzv ** 2)
    light = (nx * -0.55 + ny * -0.65 + nzv * 0.55) / ln          # light from top-left, toward the viewer
    cov = smoothstep(0.0, 0.06, h)
    return np.clip(0.55 + 0.5 * light, 0, 1), cov, h / max(h.max(), 1e-6), nz


def tex_smoke(n=8, s=64):
    """Billowing puff that swells, then breaks up into wisps."""
    frames = []
    for f in range(n):
        k = f / (n - 1)
        shade, cov, thick, nz = billow(s, k, 11, grow=0.45)
        breakup = smoothstep(0.15 + 0.7 * k, 0.35 + 0.7 * k, nz * 0.6 + thick * 0.6)
        a = cov * (breakup if k > 0.05 else 1) * (1 - 0.3 * k)
        frames.append(gray(0.7 + 0.3 * shade, a))
    return strip(frames)


def tex_fireball(n=8, s=64):
    """Explosion puff: white-hot thick core, glowing billows, burning out into embers."""
    frames = []
    for f in range(n):
        k = f / (n - 1)
        shade, cov, thick, nz = billow(s, k, 23, puffs=11, spread=0.3, grow=0.4)
        heat = np.clip(thick * 1.25 * (1 - 0.55 * k) + (nz - 0.5) * 0.35, 0, 1)
        burn = smoothstep(0.1 + 0.75 * k, 0.3 + 0.75 * k, nz * 0.55 + thick * 0.65)
        val = np.clip((0.35 + 0.65 * heat) * (0.75 + 0.35 * shade), 0, 1)
        frames.append(gray(val, cov * burn * (0.6 + 0.4 * heat)))
    return strip(frames)


def tex_flame(n=8, s=64):
    """A licking flame tongue: hot core at the base, flickering tip."""
    frames = []
    X, Y = grid(s, s)
    v = (1 - (Y + 1) / 2)                                               # 0 bottom → 1 top
    for f in range(n):
        nz = noise(s, s, 3, 300 + f * 7, 4)
        nz2 = noise(s, s, 6, 900 + f * 3, 3)
        disp = (nz - 0.5) * 0.55 * (0.25 + v)
        width = 0.62 * (1 - v) ** 0.7 * (0.85 + 0.3 * nz2) + 0.04
        tip = 0.82 + 0.12 * math.sin(f * 1.9)
        shape = 1 - np.abs(X + disp) / np.maximum(width, 1e-3)
        body = smoothstep(0.0, 0.45, shape) * smoothstep(tip, tip - 0.35, v) * smoothstep(0.0, 0.12, v + 0.06)
        core = smoothstep(0.35, 0.9, shape) * smoothstep(0.65, 0.15, v)
        val = np.clip((0.55 * body + 0.6 * core) * (0.85 + 0.3 * nz2), 0, 1) * smoothstep(0.02, 0.12, body)
        frames.append(gray(0.7 + 0.3 * core, val))
    return strip(frames)


def tex_glow(s=64):
    X, Y = grid(s, s)
    r2 = X ** 2 + Y ** 2
    v = np.exp(-r2 * 9) * 0.85 + np.exp(-r2 * 2.6) * 0.35
    v = v * smoothstep(1.0, 0.85, np.sqrt(r2))
    return gray(np.ones_like(v), v / v.max())


def tex_spark(variants=4, s=32):
    """Star-shaped sparks with thin rays (4 variants, picked at random per particle)."""
    out = []
    for i in range(variants):
        X, Y = grid(s, s)
        r = np.sqrt(X ** 2 + Y ** 2) + 1e-6
        ang = np.arctan2(Y, X)
        rays = 4 if i % 2 == 0 else 6
        twist = i * 0.4
        ray = np.abs(np.cos((ang + twist) * rays / 2)) ** (16 if i < 2 else 9)
        v = np.exp(-r * r * 14) + np.exp(-r * r * 3.5) * 0.3 + ray * np.exp(-r * (2.2 + i * 0.4)) * 0.95
        v = np.clip(v, 0, 1) * smoothstep(1.0, 0.8, r)
        out.append(gray(np.ones_like(v), v))
    return strip(out)


def tex_bolt(variants=4, w=32, h=128):
    """Branching lightning bolts."""
    out = []
    for i in range(variants):
        r = np.random.default_rng(40 + i)
        big = Image.new("L", (w * 4, h * 4), 0)
        d = ImageDraw.Draw(big)

        def zig(x, y, ang, length, width, depth):
            pts = [(x, y)]
            steps = int(length / 14)
            for _ in range(steps):
                ang2 = ang + r.normal(0, 0.55)
                x += math.sin(ang2) * 14
                y += math.cos(ang2) * 14
                pts.append((x, y))
                if depth < 2 and r.random() < 0.12:
                    zig(x, y, ang + r.choice([-1, 1]) * r.uniform(0.5, 1.0), length * 0.35, max(2, width - 3), depth + 1)
            d.line(pts, fill=255, width=width, joint="curve")
        zig(w * 2 + r.normal(0, 6), 6, 0, h * 4 - 12, 7, 0)
        core = big.filter(ImageFilter.GaussianBlur(1.2))
        glow = big.filter(ImageFilter.GaussianBlur(9))
        a = np.clip(np.asarray(core, dtype=float) / 255 + np.asarray(glow, dtype=float) / 255 * 1.6, 0, 1)
        img = gray(np.ones_like(a), a).resize((w, h), Image.LANCZOS)
        out.append(img)
    return strip(out)


def tex_ring(s=128):
    X, Y = grid(s, s)
    r = np.sqrt(X ** 2 + Y ** 2)
    nz = noise(s, s, 5, 77, 4)
    band = np.exp(-((r - 0.84) / 0.045) ** 2)
    inner = np.exp(-((r - 0.7) / 0.18) ** 2) * 0.35 * (0.6 + 0.8 * nz)
    v = np.clip(band * (0.75 + 0.5 * nz) + inner, 0, 1) * smoothstep(1.0, 0.94, r)
    return gray(np.ones_like(v), v)


def tex_swirl(s=128):
    X, Y = grid(s, s)
    r = np.sqrt(X ** 2 + Y ** 2) + 1e-6
    ang = np.arctan2(Y, X)
    arms = 3
    spiral = np.cos(arms * ang + np.log(r) * 5.5)
    v = smoothstep(0.35, 1.0, spiral) * smoothstep(0.08, 0.3, r) * smoothstep(1.0, 0.65, r)
    v = v + np.exp(-r * r * 40) * 0.6
    nz = noise(s, s, 6, 5, 3)
    return gray(np.ones_like(v), np.clip(v * (0.7 + 0.5 * nz), 0, 1))


def tex_streak(w=64, h=16):
    X, Y = grid(w, h)
    env = np.clip(np.sin((X + 1) / 2 * math.pi), 0, 1) ** 1.4
    v = np.exp(-(Y / 0.28) ** 2) * env + np.exp(-(Y / 0.75) ** 2) * env * 0.25
    return gray(np.ones_like(v), np.clip(v, 0, 1))


def tex_swoosh(s=64):
    X, Y = grid(s, s)
    r = np.sqrt(X ** 2 + Y ** 2)
    ang = np.degrees(np.arctan2(-Y, X)) % 360
    span = smoothstep(200, 235, ang) * smoothstep(350, 315, ang)
    taper = np.clip((ang - 200) / 150, 0, 1)
    band = np.exp(-((r - 0.68) / (0.08 + 0.14 * taper)) ** 2)
    v = band * span * (0.35 + 0.65 * taper)
    return gray(np.ones_like(v), np.clip(v * 1.3, 0, 1))


def tex_droplet(s=32):
    X, Y = grid(s, s)
    yy = Y * 1.15 + 0.1
    r = np.sqrt(X ** 2 / np.maximum(0.05, (1 - yy) / 1.6) + (np.maximum(yy, 0)) ** 2 * 1.2 + np.minimum(yy, 0) ** 2 * 6)
    body = smoothstep(0.95, 0.75, r)
    hl = np.exp(-(((X + 0.25) ** 2 + (Y - 0.15) ** 2) / 0.02)) * 0.9
    shade = 0.75 + 0.25 * (-X) * 0.5 + hl
    return gray(np.clip(shade, 0, 1), body * 0.95).transpose(Image.FLIP_TOP_BOTTOM)   # point up, round bottom


def tex_debris(variants=4, s=32):
    out = []
    for i in range(variants):
        r = np.random.default_rng(70 + i)
        img = Image.new("RGBA", (s * 4, s * 4), (0, 0, 0, 0))
        d = ImageDraw.Draw(img)
        n = r.integers(5, 8)
        pts = []
        for k in range(n):
            a = k / n * 2 * math.pi + r.normal(0, 0.25)
            rr = s * 4 * 0.42 * r.uniform(0.65, 1.0)
            pts.append((s * 2 + math.cos(a) * rr, s * 2 + math.sin(a) * rr))
        d.polygon(pts, fill=(150, 150, 150, 255))
        arr = np.asarray(img, dtype=float)
        X, Y = grid(s * 4, s * 4)
        light = 0.75 + 0.35 * (-X - Y) * 0.5 + (noise(s * 4, s * 4, 8, 90 + i, 3) - 0.5) * 0.35
        for c in range(3):
            arr[..., c] = np.clip(arr[..., c] * light, 0, 255)
        img = Image.fromarray(arr.astype(np.uint8), "RGBA").resize((s, s), Image.LANCZOS)
        a = np.asarray(img)[..., 3]
        img.putalpha(Image.fromarray(np.where(a > 110, 255, 0).astype(np.uint8)))
        out.append(img)
    return strip(out)


def tex_beam(w=32, h=128):
    X, Y = grid(w, h)
    v = (np.exp(-(X / 0.18) ** 2) + np.exp(-(X / 0.55) ** 2) * 0.45) * smoothstep(1.0, 0.75, np.abs(Y))
    nz = noise(w, h, 4, 33, 3)
    return gray(np.ones_like(v), np.clip(v * (0.8 + 0.4 * nz), 0, 1))


TEXTURES = {
    "smoke": (tex_smoke, (512, 64)), "flame": (tex_flame, (512, 64)), "fireball": (tex_fireball, (512, 64)), "glow": (tex_glow, (64, 64)),
    "spark": (tex_spark, (128, 32)), "bolt": (tex_bolt, (128, 128)), "ring": (tex_ring, (128, 128)),
    "swirl": (tex_swirl, (128, 128)), "streak": (tex_streak, (64, 16)), "swoosh": (tex_swoosh, (64, 64)),
    "droplet": (tex_droplet, (32, 32)), "debris": (tex_debris, (128, 32)), "beam": (tex_beam, (32, 128)),
}
# how each texture is laid out: (frame_w, frame_h, frames, mode) — mode "anim" plays the frames over the lifetime,
# "variant" picks one frame per particle at random
LAYOUT = {
    "smoke": (64, 64, 8, "anim"), "flame": (64, 64, 8, "anim"), "fireball": (64, 64, 8, "anim"), "glow": (64, 64, 1, None), "spark": (32, 32, 4, "variant"),
    "bolt": (32, 128, 4, "variant"), "ring": (128, 128, 1, None), "swirl": (128, 128, 1, None), "streak": (64, 16, 1, None),
    "swoosh": (64, 64, 1, None), "droplet": (32, 32, 1, None), "debris": (32, 32, 4, "variant"), "beam": (32, 128, 1, None),
}

# ===========================================================================
# Particle specs
# ===========================================================================
T = "(v.particle_age / v.particle_lifetime)"


def C(ch, default=1.0):
    """Script colour channel with a fallback when the effect is spawned without one."""
    return f"((v.color.r + v.color.g + v.color.b) > 0 ? v.color.{ch} : {default})"


def W(ch, m, default=1.0):
    return f"math.lerp({C(ch, default)}, 1.0, {m})"     # toward white (hot)


def K(ch, m, default=1.0):
    return f"({C(ch, default)} * {1 - m})"              # toward black (embers / smoke)


def colvar(stops, default=(1, 1, 1)):
    """stops: [(t, mode, alpha)] where mode is 'C', ('W', m) or ('K', m)."""
    out = []
    for t, mode, a in stops:
        chans = []
        for i, ch in enumerate("rgb"):
            if mode == "C":
                chans.append(C(ch, default[i]))
            elif mode[0] == "W":
                chans.append(W(ch, mode[1], default[i]))
            else:
                chans.append(K(ch, mode[1], default[i]))
        out.append((t, chans + [a]))
    return out


def colfix(stops):
    return [(t, list(c)) for t, c in stops]


def pw(stops):
    """Piecewise-linear Molang over the particle's life, from [(t, value)] where value is a number or expression."""
    expr = f"({stops[0][1]})"
    for (t0, v0), (t1, v1) in zip(stops, stops[1:]):
        expr += f" + (({v1}) - ({v0})) * math.clamp(({T} - {t0}) / {max(1e-3, t1 - t0)}, 0, 1)"
    return expr


FIRE = colfix([(0, (1, 1, 0.78, 1)), (0.22, (1, 0.82, 0.3, 1)), (0.55, (1, 0.38, 0.06, 0.9)), (0.8, (0.45, 0.1, 0.03, 0.55)), (1, (0.12, 0.05, 0.04, 0))])
HOT = lambda a0=1.0, a1=0.9: colvar([(0, ("W", 0.65), a0), (0.35, "C", a1), (1, ("K", 0.45), 0)])

# name: spec.  size: (base, random_extra, [(t, mult)])  aspect: (x, y) multipliers.  life/speed: (min, max)
P = {
    "smoke_puff": dict(tex="smoke", mat="blend", n=16, shape=("box", [0.4, 0.9, 0.4], [0, 0.9, 0], "outwards"), life=(0.7, 1.1), speed=(1.5, 3.2),
                       drag=4, accel=[0, 0.7, 0], size=(0.85, 0.45, [(0, 0.45), (0.15, 1.0), (1, 1.55)]), spin=(-70, 70),
                       color=colfix([(0, (1, 1, 1, 0.95)), (0.5, (0.94, 0.94, 0.96, 0.75)), (1, (0.86, 0.86, 0.9, 0))]), prev=(1, 1, 1)),
    "dust": dict(tex="smoke", mat="blend", n=12, shape=("box", [1.2, 0.2, 1.2], [0, 0.2, 0], "outwards"), life=(0.9, 1.5), speed=(0.8, 2.4),
                 drag=2.5, accel=[0, 0.5, 0], size=(0.7, 0.45, [(0, 0.55), (1, 1.6)]), spin=(-40, 40),
                 color=colfix([(0, (0.68, 0.56, 0.42, 0.85)), (0.6, (0.6, 0.5, 0.38, 0.55)), (1, (0.5, 0.42, 0.32, 0))])),
    # Edo Tensei: flakes of ash and paper drifting off a reanimated body
    "edo_ash": dict(tex="debris", mat="alpha", n=9, shape=("box", [0.45, 0.95, 0.45], [0, 0.95, 0], "outwards"), life=(1.3, 2.4), speed=(0.15, 0.7),
                    drag=1.2, accel=[0, 0.45, 0], size=(0.06, 0.09, [(0, 0.6), (0.2, 1), (0.8, 1), (1, 0)]), spin=(-220, 220), lit=True,
                    color=colfix([(0, (0.82, 0.8, 0.74, 1)), (0.6, (0.62, 0.6, 0.57, 1)), (1, (0.4, 0.38, 0.36, 1))])),
    "amaterasu": dict(tex="flame", mat="blend", n=7, shape=("box", [0.35, 0.9, 0.35], [0, 0.9, 0], [0, 1, 0]), life=(0.5, 0.9), speed=(0.4, 1.1),
                      drag=1.5, accel=[0, 2.2, 0], size=(0.6, 0.35, [(0, 0.6), (0.25, 1.0), (1, 0.35)]), rot=(-8, 8), spin=(-12, 12),
                      color=colfix([(0, (0.08, 0.0, 0.1, 0.95)), (0.55, (0.03, 0, 0.04, 0.92)), (1, (0.22, 0.0, 0.28, 0))])),
    "beast_aura": dict(tex="flame", mat="add", n=6, shape=("box", [0.5, 1.0, 0.5], [0, 1.0, 0], [0, 1, 0]), life=(0.45, 0.8), speed=(0.6, 1.5),
                       drag=1.2, accel=[0, 1.6, 0], size=(0.55, 0.3, [(0, 0.55), (0.2, 1.0), (1, 0.25)]), rot=(-8, 8), spin=(-15, 15),
                       color=HOT(0.9, 0.85), prev=(1, 0.5, 0.1)),
    "beast_burst": dict(tex="fireball", mat="add", n=34, shape=("sphere", 0.8, [0, 0, 0], "outwards"), life=(0.5, 1.0), speed=(6, 13),
                        drag=4, size=(0.75, 0.6, [(0, 1.0), (0.3, 1.25), (1, 0.3)]), spin=(-90, 90), color=HOT(1, 0.95), prev=(1, 0.5, 0.1)),
    "beast_mist": dict(tex="smoke", mat="blend", n=10, shape=("sphere", 1.5, [0, 0, 0], "outwards"), life=(0.9, 1.5), speed=(0.3, 1.2),
                       drag=1, size=(0.75, 0.5, [(0, 0.7), (1, 1.6)]), spin=(-30, 30),
                       color=colvar([(0, "C", 0), (0.2, "C", 0.55), (1, ("K", 0.3), 0)]), prev=(0.6, 0.8, 0.5)),
    "bijuudama_charge": dict(tex="spark", mat="add", n=18, shape=("sphere", 3.0, [0, 0, 0], "inwards"), life=(0.55, 0.55), speed=(5, 5),
                             size=(0.55, 0.25, [(0, 1), (1, 0.35)]), spin=(-200, 200),
                             color=colfix([(0, (0.55, 0.25, 0.9, 0)), (0.3, (0.7, 0.35, 1, 0.9)), (1, (1, 0.9, 1, 1))])),
    "byakugan_mark": dict(tex="ring", mat="add", n=1, shape=("point", [0, 0, 0]), life=(1.05, 1.05), speed=(0, 0),
                          size_expr="0.3 + math.sin(v.particle_age * 720) * 0.06", size_fn=lambda age, r: 0.3 + math.sin(math.radians(age * 720)) * 0.06,
                          color=colfix([(0, (0.95, 0.9, 1, 1)), (0.6, (0.85, 0.8, 1, 0.9)), (1, (0.8, 0.75, 1, 0))])),
    "chakra_aura": dict(tex="spark", mat="add", n=4, shape=("disc", 0.6, [0, 0, 0], [0, 1, 0]), life=(0.6, 1.0), speed=(0.8, 1.6), drag=0.8,
                        size=(0.42, 0.15, [(0, 0), (0.2, 1), (1, 0)]), spin=(-180, 180),
                        color=colfix([(0, (0.75, 0.95, 1, 0.95)), (0.5, (0.25, 0.65, 1, 0.8)), (1, (0.1, 0.3, 1, 0))])),
    "chakra_burst": dict(tex="spark", mat="add", n=28, shape=("sphere", 0.4, [0, 0, 0], "outwards"), life=(0.4, 0.7), speed=(5, 10), drag=5,
                         size=(0.7, 0.35, [(0, 1), (0.5, 0.8), (1, 0)]), spin=(-200, 200),
                         color=colfix([(0, (1, 1, 1, 1)), (0.45, (0.5, 0.85, 1, 1)), (1, (0.1, 0.4, 1, 0))])),
    "chidori": dict(tex="bolt", mat="add", n=8, shape=("sphere", 0.15, [0, 0, 0], "outwards"), life=(0.05, 0.13), speed=(0.5, 2), drag=6,
                    size=(0.32, 0.16, [(0, 1), (1, 0.8)]), aspect=(0.5, 1.6), spin=(0, 0), rot=(0, 360),
                    color=colfix([(0, (1, 1, 1, 1)), (0.5, (0.65, 0.92, 1, 1)), (1, (0.3, 0.6, 1, 0))])),
    "cine_bolt": dict(tex="bolt", mat="add", n=3, shape=("sphere", 2.5, [0, 0, 0], "outwards"), life=(0.12, 0.25), speed=(2, 6),
                      size=(1.0, 0.4, [(0, 1), (1, 1)]), aspect=(0.45, 2.0), rot=(-25, 25),
                      alpha_flicker=True, color=colvar([(0, ("W", 0.7), 1), (1, "C", 0)]), prev=(0.6, 0.85, 1)),
    "cine_debris": dict(tex="debris", mat="alpha", n=14, shape=("disc", 2.5, [0, 0, 0], [0, 1, 0]), life=(0.9, 1.6), speed=(5, 11),
                        drag=0.6, accel=[0, -18, 0], size=(0.22, 0.24, [(0, 1), (0.85, 1), (1, 0.4)]), spin=(-400, 400), collide=True, lit=True,
                        color=colvar([(0, "C", 1), (1, "C", 1)], default=(0.62, 0.6, 0.58)), prev=(0.6, 0.5, 0.4)),
    "cine_flame": dict(tex="fireball", mat="add", n=10, shape=("sphere", 1.2, [0, 0, 0], "outwards"), life=(0.5, 0.9), speed=(3, 7), drag=3.5,
                       accel=[0, 2, 0], size=(0.95, 0.6, [(0, 0.8), (0.2, 1.15), (1, 0.4)]), spin=(-40, 40), color=HOT(1, 0.95), prev=(1, 0.45, 0.1)),
    "cine_pillar": dict(tex="beam", mat="add", n=1, shape=("point", [0, 3, 0]), life=(0.15, 0.3), speed=(0, 0),
                        size=(1.0, 0, [(0, 0.6), (0.2, 1.1), (1, 0.8)]), aspect=(0.9, 7), alpha_flicker=True,
                        color=colvar([(0, ("W", 0.7), 1), (1, "C", 0)]), prev=(0.6, 0.85, 1)),
    "cine_ring": dict(tex="ring", mat="add", n=1, shape=("point", [0, 0.12, 0]), life=(0.45, 0.45), speed=(0, 0), flat=True,
                      size=(1.0, 0, [(0, 1), (0.25, 7.5), (1, 12)]), color=colvar([(0, ("W", 0.6), 1), (0.4, "C", 0.85), (1, "C", 0)]), prev=(1, 0.5, 0.1)),
    "cine_swirl": dict(tex="swirl", mat="add", n=1, shape=("point", [0, 0.08, 0]), life=(0.7, 0.7), speed=(0, 0), flat=True,
                       size=(3.2, 0, [(0, 0.85), (1, 1.35)]), spin=(320, 420), rot=(0, 360),
                       color=colvar([(0, "C", 0), (0.2, ("W", 0.25), 0.9), (1, "C", 0)]), prev=(0.4, 0.75, 1)),
    "fire_burst": dict(tex="fireball", mat="add", n=26, shape=("sphere", 0.5, [0, 0, 0], "outwards"), life=(0.5, 0.9), speed=(4, 9), drag=4,
                       accel=[0, 1.5, 0], size=(0.65, 0.5, [(0, 0.7), (0.25, 1.25), (1, 0.55)]), spin=(-60, 60), color=FIRE),
    "fire_trail": dict(tex="flame", mat="add", n=4, shape=("sphere", 0.3, [0, 0, 0], "outwards"), life=(0.3, 0.55), speed=(0.2, 0.8), drag=1,
                       accel=[0, 2.5, 0], size=(0.55, 0.3, [(0, 1), (1, 0.35)]), rot=(-8, 8), spin=(-30, 30), color=FIRE),
    "heal": dict(tex="spark", mat="add", n=8, shape=("box", [0.4, 0.9, 0.4], [0, 0.9, 0], [0, 1, 0]), life=(0.6, 1.1), speed=(0.4, 1.2), drag=1,
                 size=(0.5, 0.2, [(0, 0), (0.2, 1), (1, 0)]), spin=(-120, 120),
                 color=colfix([(0, (0.92, 1, 0.92, 1)), (0.45, (0.45, 1, 0.55, 0.95)), (1, (0.2, 0.9, 0.3, 0))])),
    "lightning_burst": dict(tex="spark", mat="add", n=22, shape=("sphere", 0.3, [0, 0, 0], "outwards"), life=(0.2, 0.45), speed=(5, 10), drag=5,
                            size=(0.6, 0.3, [(0, 1), (1, 0)]), spin=(-300, 300), alpha_flicker=True,
                            color=colfix([(0, (1, 1, 1, 1)), (0.5, (0.62, 0.9, 1, 1)), (1, (0.2, 0.5, 1, 0))])),
    "rasengan": dict(tex="glow", mat="add", n=14, shape=("point", [0, 0, 0]), life=(0.14, 0.22), speed=(0, 0), orbit=0.32,
                     size=(0.11, 0.06, [(0, 1), (1, 0.5)]),
                     color=colfix([(0, (1, 1, 1, 1)), (0.5, (0.55, 0.88, 1, 1)), (1, (0.15, 0.45, 1, 0))])),
    "rasengan_core": dict(tex="glow", mat="add", n=2, shape=("point", [0, 0, 0]), life=(0.1, 0.1), speed=(0, 0),
                          size=(0.36, 0.06, [(0, 1), (1, 1)]), color=colfix([(0, (0.88, 0.96, 1, 0.95)), (1, (0.45, 0.72, 1, 0.6))])),
    "shadow": dict(tex="glow", mat="blend", n=2, shape=("point", [0, 0, 0]), life=(1.0, 1.0), speed=(0, 0), flat=True,
                   size=(0.5, 0, [(0, 0.8), (0.15, 1), (1, 1)]), color=colfix([(0, (0, 0, 0, 0.9)), (0.6, (0, 0, 0, 0.75)), (1, (0, 0, 0, 0))])),
    "slash": dict(tex="streak", mat="add", n=2, shape=("sphere", 0.08, [0, 0, 0], "outwards"), life=(0.18, 0.3), speed=(0.3, 0.3), drag=2,
                  size=(1.05, 0.4, [(0, 0.35), (0.25, 1.0), (1, 1.1)]), aspect=(1, 0.13), rot=(0, 360),
                  color=colvar([(0, ("W", 0.9), 1), (0.4, ("W", 0.3), 0.9), (1, "C", 0)]), prev=(0.85, 0.95, 1)),
    "susanoo_flame": dict(tex="flame", mat="add", n=8, shape=("box", [1.4, 1.5, 1.4], [0, 1.5, 0], [0, 1, 0]), life=(0.5, 0.9), speed=(0.5, 1.5),
                          drag=1, accel=[0, 1.5, 0], size=(0.65, 0.4, [(0, 0.6), (0.25, 1.0), (1, 0.3)]), rot=(-8, 8), spin=(-20, 20),
                          color=colfix([(0, (0.95, 0.75, 1, 0.9)), (0.3, (0.65, 0.25, 1, 0.85)), (1, (0.3, 0.05, 0.6, 0))])),
    "thread": dict(tex="glow", mat="alpha", n=1, shape=("point", [0, 0, 0]), life=(2.0, 2.0), speed=(0, 0), size=(0.08, 0, [(0, 1), (1, 1)]),
                   color=colfix([(0, (0.95, 0.95, 1, 1)), (1, (0.95, 0.95, 1, 1))])),
    "water_splash": dict(tex="droplet", mat="blend", n=16, shape=("sphere", 0.5, [0, 0, 0], "outwards"), life=(0.5, 0.9), speed=(2, 5), drag=1,
                         accel=[0, -12, 0], size=(0.24, 0.12, [(0, 1), (1, 0.6)]), collide=True,
                         color=colfix([(0, (0.88, 0.96, 1, 0.95)), (0.5, (0.35, 0.65, 1, 0.85)), (1, (0.15, 0.35, 0.9, 0))])),
    "wind_gust": dict(tex="swoosh", mat="blend", n=4, shape=("sphere", 0.4, [0, 0, 0], "outwards"), life=(0.25, 0.45), speed=(1, 3), drag=3,
                      size=(0.95, 0.45, [(0, 0.6), (1, 1.35)]), spin=(-260, 260), rot=(0, 360),
                      color=colfix([(0, (1, 1, 1, 0)), (0.2, (1, 1, 1, 0.75)), (1, (0.9, 0.95, 1, 0))])),
}
# the chakra flame that wraps Susanoo / Tailed Beast mode etc. keeps the same ids as before


# ===========================================================================
# Particle JSON
# ===========================================================================
def build(pid, s):
    fw, fh, frames, mode = LAYOUT[s["tex"]]
    tw, th = TEXTURES[s["tex"]][1]
    comps = {"minecraft:emitter_rate_instant": {"num_particles": s["n"]}, "minecraft:emitter_lifetime_once": {"active_time": 0.05}}
    sh = s["shape"]
    if sh[0] == "point":
        comps["minecraft:emitter_shape_point"] = {"offset": sh[1]}
    elif sh[0] == "sphere":
        comps["minecraft:emitter_shape_sphere"] = {"radius": sh[1], "offset": sh[2], "direction": sh[3]}
    elif sh[0] == "box":
        comps["minecraft:emitter_shape_box"] = {"half_dimensions": sh[1], "offset": sh[2], "direction": sh[3]}
    elif sh[0] == "disc":
        comps["minecraft:emitter_shape_disc"] = {"radius": sh[1], "offset": sh[2], "plane_normal": "y", "direction": sh[3]}
    lo, hi = s["life"]
    comps["minecraft:particle_lifetime_expression"] = {"max_lifetime": f"math.random({lo}, {hi})" if hi != lo else lo}
    a, b = s["speed"]
    comps["minecraft:particle_initial_speed"] = f"math.random({a}, {b})" if a != b else a
    if "spin" in s or "rot" in s:
        r0, r1 = s.get("rot", (0, 360))
        sp = s.get("spin", (0, 0))
        comps["minecraft:particle_initial_spin"] = {"rotation": f"math.random({r0}, {r1})", "rotation_rate": f"math.random({sp[0]}, {sp[1]})"}
    if s.get("orbit"):
        R = s["orbit"]
        th_ = "(v.particle_age * 1500 + v.particle_random_1 * 360)"
        tilt = "(v.particle_random_2 * 180)"
        rad = f"({R} * (0.75 + v.particle_random_3 * 0.4))"
        comps["minecraft:particle_motion_parametric"] = {"relative_position": [
            f"{rad} * math.cos({th_})", f"{rad} * math.sin({th_}) * math.cos({tilt})", f"{rad} * math.sin({th_}) * math.sin({tilt})"]}
    else:
        dyn = {}
        if s.get("accel"):
            dyn["linear_acceleration"] = s["accel"]
        if s.get("drag"):
            dyn["linear_drag_coefficient"] = s["drag"]
        if dyn:
            comps["minecraft:particle_motion_dynamic"] = dyn
    if s.get("collide"):
        comps["minecraft:particle_motion_collision"] = {"collision_radius": 0.08, "coefficient_of_restitution": 0.25, "collision_drag": 4}
    if "size_expr" in s:
        sz = s["size_expr"]
        size = [sz, sz]
    else:
        base, extra, curve = s["size"]
        ax, ay = s.get("aspect", (1, 1))
        b = f"({base} + v.particle_random_1 * {extra})" if extra else f"{base}"
        c = pw(curve)
        size = [f"{b} * {ax} * {c}", f"{b} * {ay} * {c}"]
    uv = {"texture_width": tw, "texture_height": th}
    if mode == "anim":
        uv["flipbook"] = {"base_UV": [0, 0], "size_UV": [fw, fh], "step_UV": [fw, 0], "max_frame": frames,
                          "stretch_to_lifetime": True, "loop": False}
    elif mode == "variant":
        uv["uv"] = [f"math.floor(v.particle_random_4 * {frames}) * {fw}", 0]
        uv["uv_size"] = [fw, fh]
    else:
        uv["uv"] = [0, 0]
        uv["uv_size"] = [fw, fh]
    bb = {"size": size, "facing_camera_mode": "emitter_transform_xz" if s.get("flat") else "rotate_xyz", "uv": uv}
    comps["minecraft:particle_appearance_billboard"] = bb
    stops = s["color"]
    chans = [pw([(t, c[i]) for t, c in stops]) for i in range(4)]
    if s.get("alpha_flicker"):
        chans[3] = f"({chans[3]}) * (0.55 + 0.45 * math.abs(math.sin(v.particle_age * 2600 + v.particle_random_2 * 360)))"
    comps["minecraft:particle_appearance_tinting"] = {"color": chans}
    if s.get("lit"):
        comps["minecraft:particle_appearance_lighting"] = {}
    mat = {"add": "particles_add", "blend": "particles_blend", "alpha": "particles_alpha"}[s["mat"]]
    return {"format_version": "1.10.0", "particle_effect": {
        "description": {"identifier": f"aegis:{pid}", "basic_render_parameters": {"material": mat, "texture": f"textures/particle/aegis/{s['tex']}"}},
        "components": comps}}


def write_all():
    TEX.mkdir(parents=True, exist_ok=True)
    for name, (fn, size) in TEXTURES.items():
        img = fn()
        assert img.size == size, (name, img.size)
        img.save(TEX / f"{name}.png")
    for pid, s in P.items():
        (PDIR / f"{pid}.json").write_text(json.dumps(build(pid, s), indent=1) + "\n")
    print(f"Particles: {len(P)} effects, {len(TEXTURES)} textures")


# ===========================================================================
# Offline preview (simulates the spec — not a Molang interpreter)
# ===========================================================================
def interp(stops, t):
    for (t0, v0), (t1, v1) in zip(stops, stops[1:]):
        if t <= t1:
            u = 0 if t1 == t0 else (t - t0) / (t1 - t0)
            return v0 + (v1 - v0) * max(0, min(1, u))
    return stops[-1][1]


def eval_col(s, t, color):
    out = []
    for i in range(4):
        st = []
        for tt, c in s["color"]:
            v = c[i]
            if isinstance(v, str):  # colour-variable expression: evaluate the three forms we generate
                ch = color[i]
                if "math.lerp" in v:
                    m = float(v.rsplit(",", 1)[1].strip(" )"))
                    v = ch + (1 - ch) * m
                elif "* " in v and v.startswith("(("):
                    v = ch * float(v.rsplit("*", 1)[1].strip(" )"))
                else:
                    v = ch
            st.append((tt, v))
        out.append(interp(st, t))
    return out


def simulate(pid, s, t_view, color, seed=3):
    r = np.random.default_rng(seed)
    fw, fh, frames, mode = LAYOUT[s["tex"]]
    sheet = Image.open(TEX / f"{s['tex']}.png").convert("RGBA")
    parts = []
    for _ in range(s["n"]):
        sh = s["shape"]
        if sh[0] == "point":
            pos = np.array(sh[1], float)
            d = np.zeros(3)
        elif sh[0] == "sphere":
            v = r.normal(size=3)
            v /= np.linalg.norm(v)
            pos = np.array(sh[2], float) + v * sh[1] * r.random() ** (1 / 3)
            d = v if sh[3] == "outwards" else (-v if sh[3] == "inwards" else np.array(sh[3], float))
            if sh[3] == "inwards":
                pos = np.array(sh[2], float) + v * sh[1]
        elif sh[0] == "box":
            pos = np.array(sh[2], float) + (r.random(3) * 2 - 1) * np.array(sh[1])
            d = (pos - np.array(sh[2])) if sh[3] == "outwards" else np.array(sh[3], float)
            d = d / (np.linalg.norm(d) + 1e-6)
        else:
            a = r.random() * 2 * math.pi
            rr = sh[1] * math.sqrt(r.random())
            pos = np.array(sh[2], float) + np.array([math.cos(a) * rr, 0, math.sin(a) * rr])
            d = np.array(sh[3], float)
        life = r.uniform(*s["life"])
        spd = r.uniform(*s["speed"])
        rnd = r.random(4)
        rot0 = r.uniform(*s.get("rot", (0, 360))) if ("spin" in s or "rot" in s) else 0
        rate = r.uniform(*s.get("spin", (0, 0)))
        parts.append(dict(p=pos, v=d * spd, life=life, rnd=rnd, rot=rot0, rate=rate))
    dt = 1 / 60
    t = 0
    while t < t_view:
        for q in parts:
            if s.get("accel"):
                q["v"] = q["v"] + np.array(s["accel"]) * dt
            if s.get("drag"):
                q["v"] = q["v"] - q["v"] * s["drag"] * dt
            q["p"] = q["p"] + q["v"] * dt
            if s.get("collide") and q["p"][1] < 0:
                q["p"][1] = 0
                q["v"] = q["v"] * np.array([0.5, -0.25, 0.5])
        t += dt
    # draw
    S, scale = 260, 40
    img = np.zeros((S, S, 3))
    img[:] = (0.13, 0.14, 0.18)
    yaw, pitch = math.radians(-30), math.radians(18)
    order = []
    for q in parts:
        if t_view > q["life"]:
            continue
        age = t_view
        tt = age / q["life"]
        p = q["p"].copy()
        if s.get("orbit"):
            R = s["orbit"] * (0.75 + q["rnd"][2] * 0.4)
            th_ = math.radians(age * 1500 + q["rnd"][0] * 360)
            tl = math.radians(q["rnd"][1] * 180)
            p = np.array([R * math.cos(th_), R * math.sin(th_) * math.cos(tl), R * math.sin(th_) * math.sin(tl)])
        x, y, z = p
        x2, z2 = x * math.cos(yaw) - z * math.sin(yaw), x * math.sin(yaw) + z * math.cos(yaw)
        y2, z3 = y * math.cos(pitch) - z2 * math.sin(pitch), y * math.sin(pitch) + z2 * math.cos(pitch)
        if "size_fn" in s:
            size = s["size_fn"](age, q["rnd"])
            sx = sy = size
        else:
            base, extra, curve = s["size"]
            m = (base + q["rnd"][0] * extra) * interp(curve, tt)
            ax, ay = s.get("aspect", (1, 1))
            sx, sy = m * ax, m * ay
        col = eval_col(s, tt, color)
        if s.get("alpha_flicker"):
            col[3] *= 0.55 + 0.45 * abs(math.sin(math.radians(age * 2600 + q["rnd"][1] * 360)))
        if mode == "anim":
            fi = min(frames - 1, int(tt * frames))
        elif mode == "variant":
            fi = int(q["rnd"][3] * frames)
        else:
            fi = 0
        spr = sheet.crop((fi * fw, 0, fi * fw + fw, fh))
        pxw, pxh = max(1, int(sx * scale)), max(1, int(sy * scale * (0.45 if s.get("flat") else 1)))
        spr = spr.resize((pxw, pxh), Image.BILINEAR).rotate(q["rot"] + q["rate"] * age, expand=True)
        order.append((z3, S / 2 + x2 * scale, S * 0.62 - y2 * scale, spr, col))
    order.sort(key=lambda o: -o[0])
    for _, cx, cy, spr, col in order:
        a = np.asarray(spr, dtype=float) / 255
        h, w = a.shape[:2]
        x0, y0 = int(cx - w / 2), int(cy - h / 2)
        xs, ys = max(0, x0), max(0, y0)
        xe, ye = min(S, x0 + w), min(S, y0 + h)
        if xe <= xs or ye <= ys:
            continue
        sub = a[ys - y0:ye - y0, xs - x0:xe - x0]
        rgb = sub[..., :3] * np.array(col[:3])
        al = sub[..., 3:4] * col[3]
        if s["mat"] == "add":
            img[ys:ye, xs:xe] = np.clip(img[ys:ye, xs:xe] + rgb * al, 0, 1)
        else:
            img[ys:ye, xs:xe] = img[ys:ye, xs:xe] * (1 - al) + rgb * al
    return Image.fromarray((np.clip(img, 0, 1) * 255).astype(np.uint8))


def preview(names, out, steps=6):
    rows = []
    for n in names:
        s = P[n]
        color = s.get("prev", (0.4, 0.75, 1))
        L = s["life"][1]
        cells = [simulate(n, s, L * (i + 0.5) / steps, color) for i in range(steps)]
        row = Image.new("RGB", (260 * steps, 276), (20, 20, 26))
        for i, c in enumerate(cells):
            row.paste(c, (i * 260, 16))
        ImageDraw.Draw(row).text((4, 2), f"aegis:{n}  ({s['n']} particles, {L}s)", fill=(230, 230, 230))
        rows.append(row)
    img = Image.new("RGB", (rows[0].width, sum(r.height for r in rows)))
    y = 0
    for r in rows:
        img.paste(r, (0, y))
        y += r.height
    img.save(out)
    print("wrote", out)


if __name__ == "__main__":
    if len(sys.argv) > 1 and sys.argv[1] == "--preview":
        args = sys.argv[2:]
        out = args[args.index("-o") + 1]
        names = [a for a in args if a != "-o" and a != out]
        preview(names or list(P), out)
    else:
        write_all()
