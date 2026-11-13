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


def tex_ember(variants=4, s=16):
    """Tiny glowing motes: round, or stretched like a flying spark."""
    out = []
    for i in range(variants):
        X, Y = grid(s, s)
        sx, sy = (1, 1) if i < 2 else (0.45, 1.5)
        r2 = (X / sx) ** 2 + (Y / sy) ** 2
        v = np.exp(-r2 * (7 if i % 2 else 12)) + np.exp(-r2 * 2.5) * 0.35
        out.append(gray(np.ones_like(v), np.clip(v, 0, 1) * smoothstep(1.0, 0.7, np.sqrt(X ** 2 + Y ** 2))))
    return strip(out)


def tex_shock(s=128):
    """A razor-thin shockwave ring with a soft trailing edge and faint radial streaks."""
    X, Y = grid(s, s)
    r = np.sqrt(X ** 2 + Y ** 2)
    ang = np.arctan2(Y, X)
    edge = np.exp(-((r - 0.9) / 0.022) ** 2)
    trail = smoothstep(0.55, 0.9, r) * smoothstep(0.92, 0.88, r) * 0.45
    rays = (0.5 + 0.5 * np.cos(ang * 24 + noise(s, s, 6, 19, 2) * 6)) ** 6 * smoothstep(0.6, 0.88, r) * smoothstep(0.93, 0.89, r) * 0.6
    return gray(np.ones_like(r), np.clip(edge + trail + rays, 0, 1) * smoothstep(1.0, 0.95, r))


def tex_flare(s=64):
    """Lens flare: a hot core with a long horizontal streak and a short vertical one."""
    X, Y = grid(s, s)
    v = np.exp(-(X ** 2 + Y ** 2) * 16) + np.exp(-(Y / 0.05) ** 2) * np.exp(-(X / 0.75) ** 2) * 0.9 + np.exp(-(X / 0.05) ** 2) * np.exp(-(Y / 0.4) ** 2) * 0.6
    v = v + np.exp(-(X ** 2 + Y ** 2) * 3) * 0.25
    return gray(np.ones_like(v), np.clip(v, 0, 1) * smoothstep(1.0, 0.8, np.maximum(np.abs(X), np.abs(Y))))


def _poly_variants(make, variants, s, seed, shade=0.35):
    out = []
    for i in range(variants):
        r = np.random.default_rng(seed + i)
        img = Image.new("RGBA", (s * 4, s * 4), (0, 0, 0, 0))
        make(ImageDraw.Draw(img), r, s * 4)
        arr = np.asarray(img, dtype=float)
        X, Y = grid(s * 4, s * 4)
        light = 0.8 + shade * (-X - Y) * 0.5 + (noise(s * 4, s * 4, 8, seed + 50 + i, 3) - 0.5) * 0.25
        for c in range(3):
            arr[..., c] = np.clip(arr[..., c] * light, 0, 255)
        img = Image.fromarray(arr.astype(np.uint8), "RGBA").resize((s, s), Image.LANCZOS)
        a = np.asarray(img)[..., 3]
        img.putalpha(Image.fromarray(np.where(a > 110, 255, 0).astype(np.uint8)))
        out.append(img)
    return strip(out)


def tex_shard(variants=4, s=32):
    """Ice crystals: long faceted splinters, one half lit, one half in shade."""
    def make(d, r, S):
        c, L, Wd = S / 2, S * r.uniform(0.38, 0.46), S * r.uniform(0.09, 0.15)
        k = r.uniform(0.25, 0.45)
        top, bot = (c, c - L), (c, c + L)
        lft, rgt = (c - Wd, c - L * k), (c + Wd, c - L * k)
        d.polygon([top, lft, bot], fill=(235, 245, 255, 255))
        d.polygon([top, rgt, bot], fill=(150, 185, 225, 255))
        d.line([top, bot], fill=(255, 255, 255, 255), width=3)
    return _poly_variants(make, variants, s, 210, shade=0.15)


def tex_leaf(variants=4, s=32):
    def make(d, r, S):
        c = S / 2
        L, Wd = S * r.uniform(0.36, 0.44), S * r.uniform(0.16, 0.22)
        pts = []
        for k in range(24):
            a = k / 24 * 2 * math.pi
            pts.append((c + math.sin(a) * Wd * (1 - 0.35 * math.cos(a)), c - math.cos(a) * L))
        d.polygon(pts, fill=(205, 205, 205, 255))
        d.line([(c, c - L), (c, c + L * 1.15)], fill=(130, 130, 130, 255), width=4)
    return _poly_variants(make, variants, s, 240)


def tex_splinter(variants=4, s=32):
    def make(d, r, S):
        c = S / 2
        L, Wd = S * r.uniform(0.34, 0.45), S * r.uniform(0.05, 0.1)
        pts = [(c - Wd, c + L), (c - Wd * r.uniform(0.6, 1.3), c), (c - Wd * 0.3, c - L * r.uniform(0.7, 1)), (c + Wd * 0.6, c - L),
               (c + Wd * r.uniform(0.7, 1.3), c - L * 0.2), (c + Wd, c + L * r.uniform(0.7, 1))]
        d.polygon(pts, fill=(190, 190, 190, 255))
        d.line([(c, c + L * 0.8), (c, c - L * 0.7)], fill=(120, 120, 120, 255), width=3)
    return _poly_variants(make, variants, s, 270)


def tex_seal(s=128):
    """A sealing formula drawn flat on the ground: two rings, tick marks, script blocks and a triangle."""
    big = Image.new("L", (s * 4, s * 4), 0)
    d = ImageDraw.Draw(big)
    c, R = s * 2, s * 2
    for rad, wd in ((0.92, 10), (0.8, 4), (0.42, 6)):
        d.ellipse([c - R * rad, c - R * rad, c + R * rad, c + R * rad], outline=255, width=wd)
    r = np.random.default_rng(88)
    for k in range(24):
        a = k / 24 * 2 * math.pi
        d.line([(c + math.cos(a) * R * 0.8, c + math.sin(a) * R * 0.8), (c + math.cos(a) * R * 0.92, c + math.sin(a) * R * 0.92)], fill=255, width=5)
    for k in range(16):                                                       # script between the rings
        a = k / 16 * 2 * math.pi
        x, y = c + math.cos(a) * R * 0.61, c + math.sin(a) * R * 0.61
        for _ in range(4):
            dx, dy = r.integers(-14, 14), r.integers(-14, 14)
            d.rectangle([x + dx - 5, y + dy - 5, x + dx + 5, y + dy + 5], fill=255)
    tri = [(c + math.cos(a) * R * 0.42, c + math.sin(a) * R * 0.42) for a in (-math.pi / 2, math.pi / 6, 5 * math.pi / 6)]
    d.line(tri + [tri[0]], fill=255, width=6)
    a = np.asarray(big.filter(ImageFilter.GaussianBlur(2)).resize((s, s), Image.LANCZOS), dtype=float) / 255
    glow = np.asarray(big.filter(ImageFilter.GaussianBlur(14)).resize((s, s), Image.LANCZOS), dtype=float) / 255
    return gray(np.ones_like(a), np.clip(a + glow * 0.6, 0, 1))


def tex_scorch(s=128):
    """A burn mark for the ground: an uneven dark blotch with cracks."""
    X, Y = grid(s, s)
    r = np.sqrt(X ** 2 + Y ** 2)
    nz = noise(s, s, 4, 61, 4)
    blot = smoothstep(0.95, 0.35, r + (nz - 0.5) * 0.5)
    ang = np.arctan2(Y, X)
    cracks = (np.abs(np.sin(ang * 5 + nz * 7)) < 0.06) * smoothstep(0.9, 0.3, r) * smoothstep(0.05, 0.2, r)
    return gray(np.ones_like(r), np.clip(blot * (0.75 + 0.25 * nz) + cracks * 0.3, 0, 1))


TEXTURES = {
    "ember": (tex_ember, (64, 16)), "shock": (tex_shock, (128, 128)), "flare": (tex_flare, (64, 64)), "shard": (tex_shard, (128, 32)),
    "leaf": (tex_leaf, (128, 32)), "splinter": (tex_splinter, (128, 32)), "seal": (tex_seal, (128, 128)), "scorch": (tex_scorch, (128, 128)),
    "smoke": (tex_smoke, (512, 64)), "flame": (tex_flame, (512, 64)), "fireball": (tex_fireball, (512, 64)), "glow": (tex_glow, (64, 64)),
    "spark": (tex_spark, (128, 32)), "bolt": (tex_bolt, (128, 128)), "ring": (tex_ring, (128, 128)),
    "swirl": (tex_swirl, (128, 128)), "streak": (tex_streak, (64, 16)), "swoosh": (tex_swoosh, (64, 64)),
    "droplet": (tex_droplet, (32, 32)), "debris": (tex_debris, (128, 32)), "beam": (tex_beam, (32, 128)),
}
# how each texture is laid out: (frame_w, frame_h, frames, mode) — mode "anim" plays the frames over the lifetime,
# "variant" picks one frame per particle at random
LAYOUT = {
    "ember": (16, 16, 4, "variant"), "shock": (128, 128, 1, None), "flare": (64, 64, 1, None), "shard": (32, 32, 4, "variant"),
    "leaf": (32, 32, 4, "variant"), "splinter": (32, 32, 4, "variant"), "seal": (128, 128, 1, None), "scorch": (128, 128, 1, None),
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
# ===========================================================================
# Layers (v2). Every effect the scripts ask for is now a stack: the scripts spawn the base effect and, with it, the
# layers listed in its "layers" — a flash that pops for a few frames, embers or sparks that arc away and bounce,
# speed lines stretched along their flight, smoke that hangs behind, a shockwave skimming the ground.
# The layers get the same colour as the base, so tinted effects stay tinted all the way through.
# ===========================================================================
PT = ("point", [0, 0, 0])
TINT = lambda a0=1.0: colvar([(0, ("W", 0.8), a0), (0.3, ("W", 0.25), a0), (1, "C", 0)])
FIXED = lambda hot, mid, end, a=1.0: colfix([(0, hot + (a,)), (0.4, mid + (a,)), (1, end + (0,))])
BLUE = FIXED((1, 1, 1), (0.55, 0.88, 1), (0.15, 0.45, 1))
ICE = FIXED((1, 1, 1), (0.75, 0.93, 1), (0.5, 0.8, 1))


def flash(color, size=2.2, life=0.14, y=0.0):
    return dict(tex="glow", mat="add", n=1, shape=("point", [0, y, 0]), life=(life, life), speed=(0, 0),
                size=(size, 0, [(0, 0.35), (0.3, 1), (1, 1.35)]), color=color)


def flare(color, size=1.6, life=0.18):
    return dict(tex="flare", mat="add", n=1, shape=PT, life=(life, life), speed=(0, 0), size=(size, 0, [(0, 0.3), (0.25, 1), (1, 0.7)]),
                aspect=(1.6, 1), rot=(0, 0), spin=(0, 0), color=color)


def embers(color, n=18, speed=(3, 8), life=(0.6, 1.3), grav=-9.0, size=0.11, radius=0.3, drag=1.2, collide=True):
    return dict(tex="ember", mat="add", n=n, shape=("sphere", radius, [0, 0, 0], "outwards"), life=life, speed=speed, drag=drag,
                accel=[0, grav, 0], size=(size, size, [(0, 1), (0.7, 0.85), (1, 0)]), color=color, collide=collide, alpha_flicker=True)


def rising(color, n=4, box=(0.4, 0.9, 0.4), speed=(0.8, 2.2), life=(0.5, 1.0), size=0.07):
    return dict(tex="ember", mat="add", n=n, shape=("box", list(box), [0, box[1], 0], [0, 1, 0]), life=life, speed=speed, drag=0.6,
                accel=[0, 1.2, 0], size=(size, size, [(0, 0), (0.2, 1), (1, 0)]), color=color, alpha_flicker=True)


def shock(color, size=5.0, life=0.32, y=0.1):
    return dict(tex="shock", mat="add", n=1, shape=("point", [0, y, 0]), life=(life, life), speed=(0, 0), flat=True,
                size=(1.0, 0, [(0, 0.3), (0.35, size * 0.75), (1, size)]), color=color)


def lines(color, n=10, speed=(9, 16), life=(0.12, 0.26), radius=0.4, length=0.9, inward=False, drag=3):
    return dict(tex="streak", mat="add", n=n, shape=("sphere", radius, [0, 0, 0], "inwards" if inward else "outwards"), life=life, speed=speed,
                drag=0 if inward else drag, size=(length, length * 0.5, [(0, 0.5), (0.3, 1), (1, 0.6)]), aspect=(1, 0.07), facing="lookat_direction",
                color=color)


def haze(color, n=6, size=0.75, life=(0.9, 1.6), rise=0.9, radius=0.6, emit=None, speed=(0.3, 1.2)):
    d = dict(tex="smoke", mat="blend", n=n, shape=("sphere", radius, [0, 0.2, 0], "outwards"), life=life, speed=speed, drag=1.5,
             accel=[0, rise, 0], size=(size, size * 0.6, [(0, 0.5), (0.3, 1), (1, 1.7)]), spin=(-35, 35), color=color)
    if emit:
        d["emit"] = emit
    return d


def chips(tex, color, n=10, speed=(4, 9), size=0.16, grav=-16.0, radius=0.5, up=False, life=(0.8, 1.5)):
    return dict(tex=tex, mat="alpha", n=n, shape=("disc", radius, [0, 0.1, 0], [0, 1, 0]) if up else ("sphere", radius, [0, 0.2, 0], "outwards"),
                life=life, speed=speed, drag=0.5, accel=[0, grav, 0], size=(size, size * 0.9, [(0, 1), (0.85, 1), (1, 0.3)]), spin=(-420, 420),
                collide=True, lit=True, color=color)


SMOKE_DARK = colfix([(0, (0.12, 0.1, 0.1, 0)), (0.25, (0.14, 0.12, 0.12, 0.7)), (1, (0.22, 0.2, 0.2, 0))])
SMOKE_TINT = colvar([(0, ("K", 0.2), 0), (0.25, ("K", 0.35), 0.45), (1, ("K", 0.6), 0)])
DUSTY = colfix([(0, (0.7, 0.6, 0.46, 0.75)), (0.5, (0.62, 0.52, 0.4, 0.5)), (1, (0.5, 0.42, 0.32, 0))])
ROCK = colfix([(0, (0.55, 0.5, 0.45, 1)), (1, (0.5, 0.46, 0.42, 1))])
EMBER_FIRE = colfix([(0, (1, 0.95, 0.6, 1)), (0.4, (1, 0.6, 0.15, 1)), (1, (0.8, 0.15, 0.02, 0))])
EMBER_BLUE = colfix([(0, (1, 1, 1, 1)), (0.5, (0.6, 0.9, 1, 1)), (1, (0.2, 0.5, 1, 0))])

L = {}
# --- fire ---
L["fire_burst_flash"] = flash(colfix([(0, (1, 1, 0.9, 1)), (0.4, (1, 0.7, 0.25, 0.9)), (1, (1, 0.35, 0.05, 0))]), 2.6, 0.16)
L["fire_burst_embers"] = embers(EMBER_FIRE, n=24, speed=(4, 11))
L["fire_burst_smoke"] = haze(SMOKE_DARK, n=8, size=0.9, life=(1.1, 1.9), rise=1.4, emit=0.3)
L["fire_burst_shock"] = shock(colfix([(0, (1, 0.9, 0.6, 0.9)), (0.4, (1, 0.5, 0.1, 0.6)), (1, (1, 0.3, 0.05, 0))]), 4.2)
L["fire_trail_embers"] = embers(EMBER_FIRE, n=3, speed=(0.8, 2.5), life=(0.4, 0.9), grav=-4, radius=0.2, collide=False)
L["fire_trail_glow"] = flash(colfix([(0, (1, 0.75, 0.3, 0.55)), (1, (1, 0.35, 0.05, 0))]), 0.9, 0.18)
L["cine_flame_embers"] = embers(TINT(), n=14, speed=(3, 9), grav=-6)
L["cine_flame_flash"] = flash(TINT(0.9), 2.4, 0.14)
L["amaterasu_embers"] = rising(colfix([(0, (0.75, 0.3, 1, 1)), (0.5, (0.45, 0.1, 0.7, 1)), (1, (0.2, 0, 0.3, 0))]), n=6, box=(0.4, 0.8, 0.4))
L["amaterasu_smoke"] = haze(colfix([(0, (0, 0, 0, 0)), (0.3, (0.02, 0, 0.03, 0.6)), (1, (0.1, 0, 0.13, 0))]), n=3, size=0.7, rise=1.6, radius=0.35)
L["amaterasu_scorch"] = dict(tex="scorch", mat="blend", n=1, shape=("point", [0, 0.06, 0]), life=(1.4, 1.4), speed=(0, 0), flat=True, rot=(0, 360),
                             size=(0.9, 0.3, [(0, 0.6), (0.2, 1), (1, 1.05)]), color=colfix([(0, (0, 0, 0, 0)), (0.2, (0, 0, 0, 0.7)), (1, (0.05, 0, 0.07, 0))]))
L["susanoo_flame_sparks"] = rising(colfix([(0, (1, 0.85, 1, 1)), (0.5, (0.7, 0.35, 1, 1)), (1, (0.35, 0.1, 0.7, 0))]), n=5, box=(1.4, 1.5, 1.4), speed=(1, 3))
# --- tailed-beast / coloured chakra ---
L["beast_aura_sparks"] = rising(TINT(), n=4, box=(0.5, 1.0, 0.5), speed=(1.2, 3))
L["beast_aura_ground"] = dict(tex="glow", mat="add", n=1, shape=("point", [0, 0.07, 0]), life=(0.5, 0.5), speed=(0, 0), flat=True,
                              size=(1.5, 0, [(0, 0.7), (0.5, 1), (1, 1.15)]), color=colvar([(0, "C", 0), (0.3, "C", 0.4), (1, "C", 0)]))
L["beast_burst_flash"] = flash(TINT(), 3.4, 0.16)
L["beast_burst_shock"] = shock(TINT(0.9), 7.0, 0.36)
L["beast_burst_embers"] = embers(TINT(), n=26, speed=(5, 13))
L["beast_burst_lines"] = lines(TINT(0.9), n=14, speed=(12, 20), length=1.3)
L["beast_burst_smoke"] = haze(SMOKE_TINT, n=7, size=1.0, life=(1.0, 1.8), radius=0.9, emit=0.25)
L["bijuudama_charge_lines"] = lines(colfix([(0, (0.5, 0.2, 0.9, 0)), (0.4, (0.75, 0.4, 1, 0.9)), (1, (1, 0.9, 1, 0.9))]), n=10, speed=(6, 6), life=(0.5, 0.5), radius=3.0,
                                    length=0.8, inward=True)
L["bijuudama_charge_core"] = dict(tex="glow", mat="add", n=1, shape=PT, life=(0.55, 0.55), speed=(0, 0),
                                  size=(0.8, 0, [(0, 0.6), (0.5, 1.1), (1, 0.8)]), color=colfix([(0, (0.3, 0.1, 0.5, 0)), (0.5, (0.45, 0.15, 0.75, 0.75)), (1, (0.7, 0.4, 1, 0))]))
# --- chakra ---
L["chakra_aura_lines"] = dict(tex="beam", mat="add", n=3, shape=("disc", 0.55, [0, 0.1, 0], [0, 1, 0]), life=(0.35, 0.6), speed=(2.5, 4.5),
                              size=(0.5, 0.3, [(0, 0.4), (0.3, 1), (1, 0.7)]), aspect=(0.09, 1.3),
                              color=colfix([(0, (0.8, 0.97, 1, 0)), (0.3, (0.45, 0.8, 1, 0.8)), (1, (0.15, 0.4, 1, 0))]))
L["chakra_aura_ground"] = dict(tex="ring", mat="add", n=1, shape=("point", [0, 0.06, 0]), life=(0.6, 0.6), speed=(0, 0), flat=True,
                               size=(1.0, 0, [(0, 0.5), (1, 1.5)]), color=colfix([(0, (0.5, 0.85, 1, 0.5)), (1, (0.15, 0.4, 1, 0))]))
L["chakra_burst_flash"] = flare(BLUE, 1.9, 0.2)
L["chakra_burst_shock"] = shock(colfix([(0, (0.9, 1, 1, 0.9)), (0.4, (0.4, 0.8, 1, 0.6)), (1, (0.15, 0.45, 1, 0))]), 4.5)
L["chakra_burst_lines"] = lines(BLUE, n=12)
# --- lightning ---
L["chidori_core"] = dict(tex="glow", mat="add", n=1, shape=PT, life=(0.08, 0.1), speed=(0, 0), size=(0.42, 0.14, [(0, 1), (1, 0.8)]),
                         color=colfix([(0, (1, 1, 1, 0.95)), (1, (0.5, 0.8, 1, 0.5))]))
L["chidori_sparks"] = embers(EMBER_BLUE, n=3, speed=(2, 5), life=(0.25, 0.6), grav=-10, size=0.05, radius=0.12)
L["chidori_arc"] = dict(tex="bolt", mat="add", n=1, shape=("sphere", 0.2, [0, 0, 0], "outwards"), life=(0.06, 0.1), speed=(0.5, 1.5),
                        size=(0.62, 0.3, [(0, 1), (1, 0.9)]), aspect=(0.42, 1.9), spin=(0, 0), rot=(0, 360), alpha_flicker=True,
                        color=colfix([(0, (1, 1, 1, 1)), (1, (0.5, 0.82, 1, 0.3))]))
L["lightning_burst_flash"] = flare(BLUE, 2.4, 0.16)
L["lightning_burst_bolts"] = dict(tex="bolt", mat="add", n=7, shape=("sphere", 0.7, [0, 0, 0], "outwards"), life=(0.1, 0.22), speed=(1, 3),
                                  size=(1.0, 0.5, [(0, 1), (1, 1)]), aspect=(0.42, 1.9), spin=(0, 0), rot=(0, 360), alpha_flicker=True,
                                  color=colfix([(0, (1, 1, 1, 1)), (0.5, (0.65, 0.9, 1, 1)), (1, (0.3, 0.6, 1, 0))]))
L["lightning_burst_shock"] = shock(colfix([(0, (1, 1, 1, 0.9)), (0.4, (0.55, 0.85, 1, 0.6)), (1, (0.2, 0.5, 1, 0))]), 4.5, 0.28)
L["cine_bolt_flash"] = flash(TINT(0.8), 1.9, 0.1)
L["cine_bolt_sparks"] = embers(TINT(), n=5, speed=(3, 7), life=(0.25, 0.6), size=0.06, radius=1.2)
L["cine_pillar_base"] = shock(TINT(0.9), 2.6, 0.25, y=0.1)
L["cine_pillar_sparks"] = dict(tex="ember", mat="add", n=7, shape=("box", [0.25, 3, 0.25], [0, 3, 0], [0, 1, 0]), life=(0.3, 0.6), speed=(4, 9),
                               size=(0.08, 0.06, [(0, 1), (1, 0)]), color=TINT(), alpha_flicker=True)
# --- rasengan ---
L["rasengan_swirl"] = dict(tex="swirl", mat="add", n=1, shape=PT, life=(0.14, 0.18), speed=(0, 0), size=(0.36, 0.06, [(0, 0.9), (1, 1.1)]),
                           spin=(900, 1300), rot=(0, 360), color=colfix([(0, (1, 1, 1, 0.9)), (1, (0.5, 0.85, 1, 0.4))]))
L["rasengan_wind"] = dict(tex="swoosh", mat="add", n=1, shape=PT, life=(0.18, 0.24), speed=(0, 0), size=(0.5, 0.15, [(0, 0.7), (1, 1.3)]),
                          spin=(500, 800), rot=(0, 360), color=colfix([(0, (0.8, 0.95, 1, 0)), (0.3, (0.6, 0.88, 1, 0.5)), (1, (0.3, 0.6, 1, 0))]))
# --- smoke, dust, rock ---
L["smoke_puff_ring"] = dict(tex="smoke", mat="blend", n=10, shape=("disc", 0.3, [0, 0.15, 0], "outwards"), life=(0.5, 0.9), speed=(3, 6), drag=4.5,
                            size=(0.5, 0.3, [(0, 0.5), (0.3, 1), (1, 1.5)]), spin=(-60, 60),
                            color=colfix([(0, (1, 1, 1, 0.8)), (0.5, (0.95, 0.95, 0.97, 0.55)), (1, (0.88, 0.88, 0.92, 0))]))
L["smoke_puff_lines"] = lines(colfix([(0, (1, 1, 1, 0.85)), (1, (0.9, 0.92, 1, 0))]), n=8, speed=(6, 11), length=0.7)
L["dust_pebbles"] = chips("debris", ROCK, n=5, speed=(2, 5), size=0.07, radius=0.8, up=True, life=(0.5, 1.0))
L["cine_debris_dust"] = dict(tex="smoke", mat="blend", n=8, shape=("disc", 1.6, [0, 0.2, 0], "outwards"), life=(0.9, 1.5), speed=(1.5, 4), drag=2.5,
                             accel=[0, 0.5, 0], size=(0.8, 0.5, [(0, 0.5), (0.3, 1), (1, 1.7)]), spin=(-40, 40), color=DUSTY)
L["cine_debris_pebbles"] = chips("debris", colvar([(0, "C", 1), (1, "C", 1)], default=(0.62, 0.6, 0.58)), n=12, speed=(6, 14), size=0.08, radius=2.0, up=True)
L["cine_ring_inner"] = shock(TINT(0.9), 9.0, 0.3, y=0.14)
L["cine_ring_dust"] = dict(tex="smoke", mat="blend", n=14, shape=("disc", 0.8, [0, 0.2, 0], "outwards"), life=(0.6, 1.0), speed=(7, 12), drag=3.2,
                           size=(0.7, 0.4, [(0, 0.5), (0.3, 1), (1, 1.6)]), spin=(-50, 50), color=DUSTY)
L["cine_swirl_inner"] = dict(tex="swirl", mat="add", n=1, shape=("point", [0, 0.1, 0]), life=(0.7, 0.7), speed=(0, 0), flat=True,
                             size=(1.7, 0, [(0, 1.2), (1, 0.8)]), spin=(-560, -460), rot=(0, 360),
                             color=colvar([(0, "C", 0), (0.25, ("W", 0.5), 0.8), (1, "C", 0)]))
L["cine_swirl_glow"] = dict(tex="glow", mat="add", n=1, shape=("point", [0, 0.09, 0]), life=(0.7, 0.7), speed=(0, 0), flat=True,
                            size=(2.6, 0, [(0, 0.8), (1, 1.1)]), color=colvar([(0, "C", 0), (0.3, "C", 0.35), (1, "C", 0)]))
L["shadow_wisps"] = haze(colfix([(0, (0, 0, 0, 0)), (0.3, (0, 0, 0, 0.5)), (1, (0.05, 0.05, 0.08, 0))]), n=2, size=0.3, life=(0.6, 1.0), rise=1.2, radius=0.25)
# --- water, wind ---
WATER = colfix([(0, (0.92, 0.98, 1, 0.9)), (0.4, (0.45, 0.72, 1, 0.7)), (1, (0.2, 0.4, 0.9, 0))])
L["water_splash_crown"] = dict(tex="ring", mat="blend", n=1, shape=("point", [0, 0.08, 0]), life=(0.45, 0.45), speed=(0, 0), flat=True,
                               size=(1.0, 0, [(0, 0.4), (0.4, 2.4), (1, 3.2)]), color=WATER)
L["water_splash_mist"] = haze(colfix([(0, (0.85, 0.94, 1, 0)), (0.25, (0.7, 0.86, 1, 0.5)), (1, (0.55, 0.75, 1, 0))]), n=5, size=0.6, life=(0.6, 1.1), rise=0.5)
L["water_splash_foam"] = flash(colfix([(0, (1, 1, 1, 0.6)), (1, (0.6, 0.85, 1, 0))]), 1.2, 0.14)
L["water_splash_jets"] = lines(WATER, n=8, speed=(6, 11), life=(0.15, 0.3), length=0.6)
L["wind_gust_lines"] = lines(colfix([(0, (1, 1, 1, 0)), (0.3, (1, 1, 1, 0.7)), (1, (0.9, 0.96, 1, 0))]), n=7, speed=(7, 12), life=(0.18, 0.34), length=1.1, drag=2)
L["wind_gust_leaves"] = dict(tex="leaf", mat="alpha", n=3, shape=("sphere", 0.5, [0, 0, 0], "outwards"), life=(0.8, 1.4), speed=(2, 5), drag=1.5,
                             accel=[0, -2.5, 0], size=(0.1, 0.05, [(0, 1), (0.85, 1), (1, 0)]), spin=(-500, 500), lit=True,
                             color=colfix([(0, (0.45, 0.75, 0.3, 1)), (1, (0.55, 0.7, 0.25, 1))]))
# --- healing, blades ---
GREEN = colfix([(0, (0.92, 1, 0.92, 0.9)), (0.45, (0.45, 1, 0.55, 0.8)), (1, (0.2, 0.9, 0.3, 0))])
L["heal_seal"] = dict(tex="seal", mat="add", n=1, shape=("point", [0, 0.07, 0]), life=(1.1, 1.1), speed=(0, 0), flat=True, spin=(70, 70), rot=(0, 360),
                      size=(1.2, 0, [(0, 0.6), (0.2, 1), (1, 1.1)]), color=colfix([(0, (0.5, 1, 0.6, 0)), (0.2, (0.5, 1, 0.6, 0.75)), (0.8, (0.4, 1, 0.5, 0.6)), (1, (0.3, 0.9, 0.4, 0))]))
L["heal_glow"] = flash(colfix([(0, (0.6, 1, 0.65, 0)), (0.3, (0.5, 1, 0.6, 0.35)), (1, (0.3, 0.9, 0.4, 0))]), 1.5, 0.8, y=0.9)
L["heal_lines"] = dict(tex="beam", mat="add", n=4, shape=("disc", 0.6, [0, 0.1, 0], [0, 1, 0]), life=(0.5, 0.9), speed=(1.5, 3),
                       size=(0.45, 0.25, [(0, 0.4), (0.3, 1), (1, 0.6)]), aspect=(0.08, 1.2), color=GREEN)
L["slash_sparks"] = embers(TINT(), n=3, speed=(2.5, 6), life=(0.2, 0.45), grav=-8, size=0.05, radius=0.1, collide=False)

# ---- jutsu wave 3 (jutsu3.js) ----
P["ash_cloud"] = dict(tex="smoke", mat="blend", n=3, shape=("sphere", 0.8, [0, 0, 0], "outwards"), life=(1.4, 2.2), speed=(0.2, 0.7), drag=1.4,
                      accel=[0, 0.25, 0], size=(1.5, 0.8, [(0, 0.5), (0.25, 1), (1, 1.4)]), spin=(-25, 25),
                      color=colfix([(0, (0.2, 0.18, 0.18, 0)), (0.2, (0.24, 0.22, 0.21, 0.85)), (0.8, (0.3, 0.28, 0.27, 0.7)), (1, (0.35, 0.33, 0.32, 0))]),
                      layers=["ash_cloud_embers"])
L["ash_cloud_embers"] = dict(tex="ember", mat="add", n=4, shape=("sphere", 1.0, [0, 0, 0], "outwards"), life=(0.6, 1.4), speed=(0.1, 0.5), drag=0.8,
                             accel=[0, 0.6, 0], size=(0.06, 0.05, [(0, 0), (0.2, 1), (1, 0)]), alpha_flicker=True,
                             color=colfix([(0, (1, 0.8, 0.3, 1)), (0.5, (1, 0.45, 0.1, 1)), (1, (0.6, 0.15, 0.05, 0))]))
P["mist_cloud"] = dict(tex="smoke", mat="blend", n=3, shape=("box", [3.5, 0.8, 3.5], [0, 0.9, 0], "outwards"), life=(1.8, 2.8), speed=(0.05, 0.3), drag=1,
                       size=(2.4, 1.2, [(0, 0.6), (0.3, 1), (1, 1.3)]), spin=(-10, 10),
                       color=colfix([(0, (0.86, 0.9, 0.94, 0)), (0.25, (0.88, 0.91, 0.95, 0.6)), (0.8, (0.9, 0.92, 0.95, 0.5)), (1, (0.92, 0.94, 0.96, 0))]))
P["swamp_mud"] = dict(tex="scorch", mat="blend", n=1, shape=("point", [0, 0.05, 0]), life=(1.2, 1.2), speed=(0, 0), flat=True, rot=(0, 360),
                      size=(2.2, 0.6, [(0, 0.95), (0.5, 1.02), (1, 1)]),
                      color=colfix([(0, (0.2, 0.15, 0.09, 0)), (0.15, (0.22, 0.16, 0.1, 0.8)), (0.85, (0.22, 0.16, 0.1, 0.8)), (1, (0.22, 0.16, 0.1, 0))]))
P["swamp_bubble"] = dict(tex="droplet", mat="blend", n=3, shape=("disc", 1.2, [0, 0.05, 0], [0, 1, 0]), life=(0.5, 0.9), speed=(0.3, 0.8), drag=1,
                         size=(0.12, 0.1, [(0, 0.4), (0.7, 1.1), (1, 1.4)]),
                         color=colfix([(0, (0.45, 0.36, 0.22, 0.9)), (0.8, (0.5, 0.42, 0.28, 0.8)), (1, (0.55, 0.45, 0.3, 0))]))

# ---- dedicated effects for the releases that used to borrow generic ones ----
P["ice_burst"] = chips("shard", colfix([(0, (0.95, 0.99, 1, 1)), (1, (0.7, 0.9, 1, 1))]), n=16, speed=(4, 10), size=0.2, grav=-13, radius=0.3)
P["ice_burst"]["layers"] = ["ice_burst_flash", "ice_burst_mist", "ice_burst_sparkle", "ice_burst_shock"]
L["ice_burst_flash"] = flare(ICE, 1.8, 0.2)
L["ice_burst_mist"] = haze(colfix([(0, (0.92, 0.98, 1, 0)), (0.25, (0.85, 0.95, 1, 0.55)), (1, (0.7, 0.88, 1, 0))]), n=7, size=0.8, life=(0.8, 1.4), rise=0.3)
L["ice_burst_sparkle"] = dict(tex="spark", mat="add", n=12, shape=("sphere", 1.2, [0, 0.3, 0], "outwards"), life=(0.4, 0.9), speed=(0.2, 1.2),
                              size=(0.22, 0.14, [(0, 0), (0.3, 1), (1, 0)]), spin=(-90, 90), alpha_flicker=True, color=ICE)
L["ice_burst_shock"] = shock(colfix([(0, (1, 1, 1, 0.8)), (1, (0.6, 0.85, 1, 0))]), 3.6, 0.3)
P["ice_trail"] = chips("shard", colfix([(0, (0.95, 0.99, 1, 1)), (1, (0.7, 0.9, 1, 1))]), n=2, speed=(0.5, 2), size=0.1, grav=-6, radius=0.15, life=(0.4, 0.8))
P["ice_trail"]["layers"] = ["ice_trail_sparkle"]   # spawned by the dozen: keep it to two emitters
L["ice_trail_sparkle"] = dict(tex="spark", mat="add", n=2, shape=("sphere", 0.3, [0, 0, 0], "outwards"), life=(0.3, 0.6), speed=(0.1, 0.6),
                              size=(0.18, 0.1, [(0, 0), (0.3, 1), (1, 0)]), spin=(-90, 90), alpha_flicker=True, color=ICE)
L["ice_trail_mist"] = haze(colfix([(0, (0.92, 0.98, 1, 0)), (0.3, (0.85, 0.95, 1, 0.4)), (1, (0.7, 0.88, 1, 0))]), n=1, size=0.4, life=(0.4, 0.8), rise=0.2, radius=0.15)

P["earth_burst"] = chips("debris", colfix([(0, (0.52, 0.42, 0.3, 1)), (1, (0.46, 0.38, 0.28, 1))]), n=16, speed=(5, 11), size=0.24, radius=1.0, up=True)
P["earth_burst"]["layers"] = ["earth_burst_dust", "earth_burst_pebbles", "earth_burst_shock"]
L["earth_burst_dust"] = dict(tex="smoke", mat="blend", n=12, shape=("disc", 1.0, [0, 0.2, 0], "outwards"), life=(0.9, 1.6), speed=(2, 5), drag=2.5,
                             accel=[0, 0.7, 0], size=(0.9, 0.5, [(0, 0.5), (0.3, 1), (1, 1.7)]), spin=(-40, 40), color=DUSTY)
L["earth_burst_pebbles"] = chips("debris", ROCK, n=14, speed=(4, 12), size=0.07, radius=1.2, up=True)
L["earth_burst_shock"] = shock(colfix([(0, (0.9, 0.8, 0.6, 0.6)), (1, (0.6, 0.5, 0.35, 0))]), 4.5, 0.35)

WOODC = colfix([(0, (0.55, 0.38, 0.2, 1)), (1, (0.45, 0.3, 0.16, 1))])
P["wood_burst"] = chips("splinter", WOODC, n=18, speed=(4, 10), size=0.28, radius=0.7, up=True)
P["wood_burst"]["layers"] = ["wood_burst_leaves", "wood_burst_dust"]
L["wood_burst_leaves"] = dict(tex="leaf", mat="alpha", n=14, shape=("sphere", 0.8, [0, 0.6, 0], "outwards"), life=(1.0, 1.8), speed=(2, 7), drag=1.6,
                              accel=[0, -3, 0], size=(0.15, 0.08, [(0, 1), (0.85, 1), (1, 0)]), spin=(-500, 500), lit=True,
                              color=colfix([(0, (0.35, 0.7, 0.25, 1)), (1, (0.5, 0.68, 0.22, 1))]))
L["wood_burst_dust"] = haze(DUSTY, n=8, size=0.8, life=(0.7, 1.3), rise=0.5, radius=0.9)

LAVA = colfix([(0, (1, 0.95, 0.6, 1)), (0.25, (1, 0.6, 0.12, 1)), (0.6, (0.95, 0.25, 0.03, 0.9)), (1, (0.25, 0.05, 0.02, 0))])
P["lava_burst"] = dict(tex="fireball", mat="add", n=14, shape=("sphere", 0.4, [0, 0, 0], "outwards"), life=(0.5, 0.9), speed=(2.5, 6), drag=3.5,
                       accel=[0, 1.2, 0], size=(0.6, 0.45, [(0, 0.7), (0.25, 1.2), (1, 0.5)]), spin=(-50, 50), color=LAVA,
                       layers=["lava_burst_globs", "lava_burst_embers", "lava_burst_smoke", "lava_burst_flash"])
L["lava_burst_globs"] = dict(tex="droplet", mat="add", n=9, shape=("sphere", 0.3, [0, 0.2, 0], "outwards"), life=(0.7, 1.2), speed=(3, 7), drag=0.6,
                             accel=[0, -14, 0], size=(0.2, 0.1, [(0, 1), (1, 0.6)]), collide=True,
                             color=colfix([(0, (1, 0.85, 0.4, 1)), (0.6, (1, 0.4, 0.05, 1)), (1, (0.5, 0.1, 0.02, 0))]))
L["lava_burst_embers"] = embers(EMBER_FIRE, n=18, speed=(3, 9))
L["lava_burst_smoke"] = haze(SMOKE_DARK, n=6, size=0.8, life=(1.0, 1.7), rise=1.3, emit=0.3)
L["lava_burst_flash"] = flash(colfix([(0, (1, 0.9, 0.6, 0.9)), (1, (1, 0.3, 0.05, 0))]), 2.0, 0.15)

# ---- attach the layers to the existing effects (and beef a few of them up) ----
for base, layers in {
    "fire_burst": ["fire_burst_flash", "fire_burst_embers", "fire_burst_smoke", "fire_burst_shock"],
    "fire_trail": ["fire_trail_embers", "fire_trail_glow"],
    "cine_flame": ["cine_flame_embers", "cine_flame_flash"],
    "amaterasu": ["amaterasu_embers", "amaterasu_smoke", "amaterasu_scorch"],
    "susanoo_flame": ["susanoo_flame_sparks"],
    "beast_aura": ["beast_aura_sparks", "beast_aura_ground"],
    "beast_burst": ["beast_burst_flash", "beast_burst_shock", "beast_burst_embers", "beast_burst_lines", "beast_burst_smoke"],
    "bijuudama_charge": ["bijuudama_charge_lines", "bijuudama_charge_core"],
    "chakra_aura": ["chakra_aura_lines", "chakra_aura_ground"],
    "chakra_burst": ["chakra_burst_flash", "chakra_burst_shock", "chakra_burst_lines"],
    "chidori": ["chidori_core", "chidori_sparks", "chidori_arc"],
    "lightning_burst": ["lightning_burst_flash", "lightning_burst_bolts", "lightning_burst_shock"],
    "cine_bolt": ["cine_bolt_flash", "cine_bolt_sparks"],
    "cine_pillar": ["cine_pillar_base", "cine_pillar_sparks"],
    "rasengan": ["rasengan_swirl", "rasengan_wind"],
    "smoke_puff": ["smoke_puff_ring", "smoke_puff_lines"],
    "dust": ["dust_pebbles"],
    "cine_debris": ["cine_debris_dust", "cine_debris_pebbles"],
    "cine_ring": ["cine_ring_inner", "cine_ring_dust"],
    "cine_swirl": ["cine_swirl_inner", "cine_swirl_glow"],
    "shadow": ["shadow_wisps"],
    "water_splash": ["water_splash_crown", "water_splash_mist", "water_splash_foam", "water_splash_jets"],
    "wind_gust": ["wind_gust_lines", "wind_gust_leaves"],
    "heal": ["heal_seal", "heal_glow", "heal_lines"],
    "slash": ["slash_sparks"],
}.items():
    P[base]["layers"] = layers
P.update(L)
P["fire_burst"].update(n=30, size=(0.75, 0.55, [(0, 0.7), (0.25, 1.3), (1, 0.55)]))
P["beast_burst"].update(n=38)
P["chakra_burst"].update(n=32, color=BLUE)
P["lightning_burst"].update(n=26)
P["smoke_puff"].update(n=18, size=(0.95, 0.5, [(0, 0.45), (0.15, 1.0), (1, 1.6)]))
P["water_splash"].update(n=22, speed=(2.5, 7), size=(0.32, 0.16, [(0, 1), (1, 0.6)]))
P["heal"].update(n=10)
P["chidori"].update(n=9)

# the chakra flame that wraps Susanoo / Tailed Beast mode etc. keeps the same ids as before


# ===========================================================================
# Particle JSON
# ===========================================================================
def build(pid, s):
    fw, fh, frames, mode = LAYOUT[s["tex"]]
    tw, th = TEXTURES[s["tex"]][1]
    if s.get("emit"):   # emitted over a short time instead of all at once (lingering smoke, pouring embers)
        comps = {"minecraft:emitter_rate_steady": {"spawn_rate": round(s["n"] / s["emit"], 2), "max_particles": s["n"] * 2},
                 "minecraft:emitter_lifetime_once": {"active_time": s["emit"]}}
    else:
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
    bb = {"size": size, "facing_camera_mode": "emitter_transform_xz" if s.get("flat") else s.get("facing", "rotate_xyz"), "uv": uv}
    if s.get("facing") == "lookat_direction":   # stretched along the way it flies (speed lines, flying sparks)
        bb["direction"] = {"mode": "derive_from_velocity", "min_speed_threshold": 0.01}
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
    # which extra layers the scripts spawn together with each effect
    layers = {f"aegis:{pid}": [f"aegis:{x}" for x in s["layers"]] for pid, s in P.items() if s.get("layers")}
    for pid, s in P.items():
        for x in s.get("layers", []):
            assert x in P and not P[x].get("layers"), (pid, x)
    (ROOT / "behavior_pack" / "scripts" / "particle_layers.js").write_text(
        "// Generated by tools/gen_particles.py — the extra layers spawned with each particle effect (flash, embers, smoke,\n"
        "// shockwave …). Edit the specs there, not this file.\n"
        "export const LAYERS = " + json.dumps(layers, indent=2) + ";\n")
    print(f"Particles: {len(P)} effects ({len(layers)} layered), {len(TEXTURES)} textures")


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


def simulate(pid, s, t_view, color, seed=3, canvas=None):
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
            d = np.array([math.cos(a), 0, math.sin(a)]) if sh[3] == "outwards" else np.array(sh[3], float)
        life = r.uniform(*s["life"])
        spd = r.uniform(*s["speed"])
        rnd = r.random(4)
        rot0 = r.uniform(*s.get("rot", (0, 360))) if ("spin" in s or "rot" in s) else 0
        rate = r.uniform(*s.get("spin", (0, 0)))
        parts.append(dict(p=pos, v=d * spd, life=life, rnd=rnd, rot=rot0, rate=rate, born=r.random() * s["emit"] if s.get("emit") else 0.0))
    dt = 1 / 60
    t = 0
    while t < t_view:
        for q in parts:
            if t < q["born"]:
                continue
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
    if canvas is None:
        img = np.zeros((S, S, 3))
        img[:] = (0.13, 0.14, 0.18)
        img[int(S * 0.62):] = (0.17, 0.19, 0.17)          # the ground
    else:
        img = canvas
    yaw, pitch = math.radians(-30), math.radians(18)
    order = []
    for q in parts:
        age = t_view - q["born"]
        if age < 0 or age > q["life"]:
            continue
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
    return img


def preview(names, out, steps=6):
    """One row per effect, drawn with all of its layers, at `steps` moments of its life."""
    rows = []
    for n in names:
        s = P[n]
        color = s.get("prev", (0.4, 0.75, 1))
        stack = [n] + list(s.get("layers", []))
        L = max(P[x]["life"][1] + P[x].get("emit", 0) for x in stack) * 0.8
        cells = []
        for i in range(steps):
            canvas = None
            for k, x in enumerate(stack):
                canvas = simulate(x, P[x], L * (i + 0.35) / steps, color, seed=3 + k, canvas=canvas)
            cells.append(Image.fromarray((np.clip(canvas, 0, 1) * 255).astype(np.uint8)))
        row = Image.new("RGB", (260 * steps, 276), (20, 20, 26))
        for i, c in enumerate(cells):
            row.paste(c, (i * 260, 16))
        ImageDraw.Draw(row).text((4, 2), f"aegis:{n}  ({sum(P[x]['n'] for x in stack)} particles in {len(stack)} layers, {L:.2f}s shown)", fill=(230, 230, 230))
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
