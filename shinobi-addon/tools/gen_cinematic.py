#!/usr/bin/env python3
"""Cinematic effect assets: particles + textures (ground vortex, lightning streaks, anime flames,
debris, shockwave rings), coloured sky fogs, and synthesized sound effects (.ogg).
Run from the shinobi-addon folder:  python3 tools/gen_cinematic.py   (needs numpy, scipy, ffmpeg)
"""
import json
import math
import subprocess
import tempfile
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageFilter
from scipy import signal
from scipy.io import wavfile

ROOT = Path(__file__).resolve().parent.parent
RP = ROOT / "resource_pack"
TEX = RP / "textures" / "particle" / "aegis"


def w(path, obj):
    path.parent.mkdir(parents=True, exist_ok=True)
    with open(path, "w") as f:
        json.dump(obj, f, indent=2)
        f.write("\n")


# ---------------------------------------------------------------------------
# Textures (white/grey so the script can tint them per jutsu)
# ---------------------------------------------------------------------------
def swirl():
    S = 128
    img = Image.new("RGBA", (S, S), (0, 0, 0, 0))
    px = img.load()
    for x in range(S):
        for y in range(S):
            dx, dy = x - 63.5, y - 63.5
            r = math.hypot(dx, dy) / 64
            if r > 1:
                continue
            a = math.atan2(dy, dx)
            arm = (math.sin(a * 3 + r * 9) + 1) / 2  # three spiral arms
            v = arm ** 3 * (1 - r) ** 0.6 * min(1, r * 4)
            core = max(0, 1 - r * 3) * 0.8
            alpha = min(1, v * 1.4 + core)
            shade = int(150 + 105 * arm)
            px[x, y] = (shade, shade, shade, int(alpha * 235))
    return img


def bolt():
    img = Image.new("RGBA", (32, 128), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    rng = np.random.default_rng(3)
    pts, x = [], 16
    for y in range(0, 129, 8):
        pts.append((x, y))
        x = int(np.clip(x + rng.integers(-7, 8), 5, 27))
    glow = Image.new("RGBA", img.size, (0, 0, 0, 0))
    ImageDraw.Draw(glow).line(pts, fill=(255, 255, 255, 160), width=7)
    glow = glow.filter(ImageFilter.GaussianBlur(2))
    d.line(pts, fill=(255, 255, 255, 255), width=3)
    for i in range(2, len(pts) - 2, 4):  # small forks
        fx, fy = pts[i]
        d.line([fx, fy, fx + rng.integers(-9, 10), fy + 10], fill=(255, 255, 255, 255), width=2)
    glow.alpha_composite(img)
    return glow


def flame():
    """Anime-style flame puff: hard-edged blob with a lighter core (tinted by the particle)."""
    S = 64
    img = Image.new("RGBA", (S, S), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    pts = []
    for i in range(48):
        t = i / 48 * math.pi * 2
        r = 26 + 6 * math.sin(t * 5) + 5 * math.sin(t * 3 + 1)
        pts.append((32 + math.cos(t) * r, 34 + math.sin(t) * r * 0.9 - (8 if math.sin(t) < -0.6 else 0)))
    d.polygon(pts, fill=(200, 200, 200, 255))
    core = [(32 + (x - 32) * 0.55, 38 + (y - 34) * 0.55) for x, y in pts]
    d.polygon(core, fill=(255, 255, 255, 255))
    d.ellipse([26, 18, 34, 24], fill=(150, 150, 150, 0))  # anime "cut" in the puff
    return img


def ring():
    S = 128
    img = Image.new("RGBA", (S, S), (0, 0, 0, 0))
    px = img.load()
    for x in range(S):
        for y in range(S):
            r = math.hypot(x - 63.5, y - 63.5) / 64
            v = math.exp(-((r - 0.85) ** 2) / 0.004)
            px[x, y] = (255, 255, 255, int(min(1, v) * 255))
    return img


TEX.mkdir(parents=True, exist_ok=True)
swirl().save(TEX / "swirl.png")
bolt().save(TEX / "bolt.png")
flame().save(TEX / "flame.png")
ring().save(TEX / "ring.png")

# ---------------------------------------------------------------------------
# Particles
# ---------------------------------------------------------------------------
LIFE = "v.particle_age / v.particle_lifetime"
TINT = lambda a: {"color": ["v.color.r", "v.color.g", "v.color.b", a]}


def part(pid, tex, tw, th, mat, comps, size, tint, facing="rotate_xyz"):
    base = {"minecraft:emitter_lifetime_once": {"active_time": 0.05},
            "minecraft:particle_appearance_billboard": {"size": size, "facing_camera_mode": facing,
                "uv": {"texture_width": tw, "texture_height": th, "uv": [0, 0], "uv_size": [tw, th]}},
            "minecraft:particle_appearance_tinting": tint}
    base.update(comps)
    w(RP / "particles" / f"{pid}.json", {"format_version": "1.10.0", "particle_effect": {
        "description": {"identifier": f"aegis:{pid}", "basic_render_parameters": {"material": mat, "texture": f"textures/particle/aegis/{tex}"}},
        "components": base}})


# spinning vortex flat on the ground
part("cine_swirl", "swirl", 128, 128, "particles_add", {
    "minecraft:emitter_rate_instant": {"num_particles": 1},
    "minecraft:emitter_shape_point": {"offset": [0, 0.08, 0]},
    "minecraft:particle_lifetime_expression": {"max_lifetime": 0.7},
    "minecraft:particle_initial_speed": 0,
    "minecraft:particle_initial_spin": {"rotation": "math.random(0, 360)", "rotation_rate": 420}},
    ["3.2 + 1.2 * " + LIFE, "3.2 + 1.2 * " + LIFE], TINT(f"0.9 * math.sin({LIFE} * 180)"), "emitter_transform_xz")
# lightning streaks flying around
part("cine_bolt", "bolt", 32, 128, "particles_add", {
    "minecraft:emitter_rate_instant": {"num_particles": 3},
    "minecraft:emitter_shape_sphere": {"radius": 2.5, "direction": "outwards"},
    "minecraft:particle_lifetime_expression": {"max_lifetime": "math.random(0.12, 0.25)"},
    "minecraft:particle_initial_speed": "math.random(2, 6)",
    "minecraft:particle_initial_spin": {"rotation": "math.random(-50, 50)", "rotation_rate": 0}},
    ["0.35 + v.particle_random_1 * 0.3", "1.6 + v.particle_random_2 * 1.4"], TINT("1"), "lookat_y")
# tall lightning pillar
part("cine_pillar", "bolt", 32, 128, "particles_add", {
    "minecraft:emitter_rate_instant": {"num_particles": 1},
    "minecraft:emitter_shape_point": {"offset": [0, 3, 0]},
    "minecraft:particle_lifetime_expression": {"max_lifetime": "math.random(0.15, 0.3)"},
    "minecraft:particle_initial_speed": 0},
    ["0.9", "7"], TINT("1"), "lookat_y")
# anime fire / chakra puffs
part("cine_flame", "flame", 64, 64, "particles_alpha", {
    "minecraft:emitter_rate_instant": {"num_particles": 14},
    "minecraft:emitter_shape_sphere": {"radius": 1.2, "direction": "outwards"},
    "minecraft:particle_lifetime_expression": {"max_lifetime": "math.random(0.5, 0.9)"},
    "minecraft:particle_initial_speed": "math.random(3, 7)",
    "minecraft:particle_motion_dynamic": {"linear_acceleration": [0, 2, 0], "linear_drag_coefficient": 3.5},
    "minecraft:particle_initial_spin": {"rotation": "math.random(0, 360)", "rotation_rate": "math.random(-120, 120)"}},
    [f"(0.8 + v.particle_random_1 * 0.7) * (1 - {LIFE} * 0.8)"] * 2, TINT("1"))
# shattered debris thrown up (vanilla blackstone texture)
w(RP / "particles" / "cine_debris.json", {"format_version": "1.10.0", "particle_effect": {
    "description": {"identifier": "aegis:cine_debris", "basic_render_parameters": {"material": "particles_alpha", "texture": "textures/blocks/blackstone"}},
    "components": {
        "minecraft:emitter_rate_instant": {"num_particles": 16},
        "minecraft:emitter_lifetime_once": {"active_time": 0.05},
        "minecraft:emitter_shape_disc": {"radius": 2.5, "plane_normal": "y", "direction": [0, 1, 0]},
        "minecraft:particle_lifetime_expression": {"max_lifetime": "math.random(0.9, 1.6)"},
        "minecraft:particle_initial_speed": "math.random(5, 11)",
        "minecraft:particle_motion_dynamic": {"linear_acceleration": [0, -18, 0], "linear_drag_coefficient": 0.6},
        "minecraft:particle_motion_collision": {"collision_radius": 0.1, "coefficient_of_restitution": 0.3, "collision_drag": 4},
        "minecraft:particle_initial_spin": {"rotation": "math.random(0, 360)", "rotation_rate": "math.random(-300, 300)"},
        "minecraft:particle_appearance_billboard": {"size": ["0.18 + v.particle_random_1 * 0.22", "0.18 + v.particle_random_1 * 0.22"],
            "facing_camera_mode": "rotate_xyz", "uv": {"texture_width": 16, "texture_height": 16, "uv": [0, 0], "uv_size": [8, 8]}},
        "minecraft:particle_appearance_lighting": {}}}})
# expanding shockwave ring on the ground
part("cine_ring", "ring", 128, 128, "particles_add", {
    "minecraft:emitter_rate_instant": {"num_particles": 1},
    "minecraft:emitter_shape_point": {"offset": [0, 0.15, 0]},
    "minecraft:particle_lifetime_expression": {"max_lifetime": 0.45},
    "minecraft:particle_initial_speed": 0},
    [f"1 + 11 * {LIFE}", f"1 + 11 * {LIFE}"], TINT(f"1 - {LIFE}"), "emitter_transform_xz")

# ---------------------------------------------------------------------------
# Sky tints (pushed with /fog during cinematics and transformations)
# ---------------------------------------------------------------------------
FOGS = {"red": "#B3122A", "orange": "#D9661A", "purple": "#6E2AA8", "green": "#3E9A40", "blue": "#2A62C9", "dark": "#1A0D18"}
for name, col in FOGS.items():
    w(RP / "fogs" / f"aegis_{name}.json", {"format_version": "1.16.100", "minecraft:fog_settings": {
        "description": {"identifier": f"aegis:fog_{name}"},
        "distance": {
            "air": {"fog_start": 6.0, "fog_end": 52.0, "fog_color": col, "render_distance_type": "fixed"},
            "weather": {"fog_start": 6.0, "fog_end": 52.0, "fog_color": col, "render_distance_type": "fixed"}}}})

# ---------------------------------------------------------------------------
# Sound effects (synthesized)
# ---------------------------------------------------------------------------
SR = 44100
rng = np.random.default_rng(7)


def t(sec):
    return np.arange(int(SR * sec)) / SR


def noise(sec):
    return rng.standard_normal(int(SR * sec))


def bp(x, lo, hi, order=2):
    return signal.sosfilt(signal.butter(order, [lo, hi], "band", fs=SR, output="sos"), x)


def lp(x, f, order=2):
    return signal.sosfilt(signal.butter(order, f, "low", fs=SR, output="sos"), x)


def hp(x, f, order=2):
    return signal.sosfilt(signal.butter(order, f, "high", fs=SR, output="sos"), x)


def sweep_filter(x, f0, f1, kind="low"):
    """Time-varying one-pole-ish filter by blocks (cheap and good enough for sweeps)."""
    out = np.zeros_like(x)
    blocks = 64
    n = len(x) // blocks + 1
    zi = None
    for i in range(blocks):
        seg = x[i * n:(i + 1) * n]
        if not len(seg):
            break
        f = f0 * (f1 / f0) ** (i / (blocks - 1))
        sos = signal.butter(2, min(f, SR / 2 - 100), kind, fs=SR, output="sos")
        if zi is None:
            zi = signal.sosfilt_zi(sos) * 0
        seg_out, zi = signal.sosfilt(sos, seg, zi=zi)
        out[i * n:i * n + len(seg)] = seg_out
    return out


def env(n, attack, decay_power=1.0, hold=0.0):
    e = np.ones(n)
    a = max(1, int(attack * SR))
    e[:a] = np.linspace(0, 1, a)
    h = int(hold * SR)
    rest = n - a - h
    if rest > 0:
        e[a + h:] = np.linspace(1, 0, rest) ** decay_power
    return e


def thump(sec, f0=90, f1=35, decay=6):
    tt = t(sec)
    freq = f1 + (f0 - f1) * np.exp(-tt * 8)
    return np.sin(2 * np.pi * np.cumsum(freq) / SR) * np.exp(-tt * decay)


def crackle(sec, density=60, bright=True):
    x = np.zeros(int(SR * sec))
    for _ in range(int(density * sec)):
        i = rng.integers(0, len(x) - 400)
        ln = rng.integers(40, 400)
        x[i:i + ln] += rng.standard_normal(ln) * np.exp(-np.arange(ln) / (ln / 4)) * rng.uniform(0.3, 1)
    return hp(x, 1800) if bright else x


def mix(*parts):
    n = max(len(p) for p in parts)
    out = np.zeros(n)
    for p in parts:
        out[:len(p)] += p
    return out


def master(x, gain=0.9):
    x = np.tanh(x * 1.6)  # glue + saturation
    x = x / (np.max(np.abs(x)) + 1e-9) * gain
    fade = int(0.01 * SR)
    x[-fade:] *= np.linspace(1, 0, fade)
    return x


def boom(sec=1.6):
    n = int(SR * sec)
    return mix(thump(sec, 110, 32, 3.2) * 1.4, lp(noise(sec), 900) * env(n, 0.002, 2.5) * 1.2,
               hp(noise(0.25), 2500) * env(int(SR * 0.25), 0.001, 3) * 0.5)


SOUNDS = {}
n = int(SR * 2.6)
SOUNDS["charge"] = master(mix(
    sweep_filter(noise(2.6), 150, 5000) * np.linspace(0.1, 1, n) ** 1.5,
    np.sin(2 * np.pi * np.cumsum(np.linspace(60, 260, n)) / SR) * np.linspace(0.2, 0.8, n),
    crackle(2.6, 30) * np.linspace(0, 0.6, n)))
SOUNDS["boom"] = master(boom())
tb = int(SR * 2.8)
SOUNDS["transform"] = master(mix(boom(2.8) * 1.2,
    bp(noise(2.8), 2500, 6000) * env(tb, 0.005, 1.6) * 0.35,
    crackle(2.8, 90) * env(tb, 0.01, 1.2) * 0.8,
    lp(noise(2.8), 160) * env(tb, 0.3, 0.8, 1.0) * 2.0))
SOUNDS["lightning"] = master(mix(crackle(1.0, 140) * env(int(SR), 0.001, 1.5), thump(0.6, 140, 60, 9) * 0.6))
ta = t(3.0)
SOUNDS["aura"] = master(lp(noise(3.0), 220) * (0.7 + 0.3 * np.sin(2 * np.pi * 1.7 * ta)) * 1.5
                        + bp(noise(3.0), 500, 1400) * (0.4 + 0.4 * np.sin(2 * np.pi * 6 * ta)) * 0.3, 0.7)
SOUNDS["slash"] = master(sweep_filter(noise(0.45), 6000, 500, "low") * env(int(SR * 0.45), 0.03, 1.8), 0.8)
tr = t(1.6)
SOUNDS["rasengan"] = master(bp(noise(1.6), 300, 2600) * (0.55 + 0.45 * np.sin(2 * np.pi * (18 + 14 * tr) * tr))
                            * np.minimum(1, tr * 3) + np.sin(2 * np.pi * np.cumsum(180 + 120 * tr) / SR) * 0.25, 0.8)
chirps = np.zeros(int(SR * 1.6))
for _ in range(70):
    i = rng.integers(0, len(chirps) - 2500)
    f = rng.uniform(2200, 5200)
    tt = np.arange(2200) / SR
    chirps[i:i + 2200] += np.sin(2 * np.pi * (f + 9000 * tt) * tt) * np.exp(-tt * 70) * rng.uniform(0.3, 1)
SOUNDS["chidori"] = master(mix(chirps, crackle(1.6, 110) * 0.7, bp(noise(1.6), 3000, 7000) * 0.25), 0.8)
tf = int(SR * 1.3)
SOUNDS["fire"] = master(mix(lp(noise(1.3), 1200) * env(tf, 0.05, 1.3) * 1.2, crackle(1.3, 50, False) * 0.5, thump(0.5, 120, 50, 8) * 0.5))
SOUNDS["impact"] = master(mix(thump(0.6, 160, 50, 9) * 1.4, lp(noise(0.35), 2500) * env(int(SR * 0.35), 0.001, 3)), 0.9)
SOUNDS["whoosh"] = master(sweep_filter(noise(1.0), 400, 4000, "low") * np.sin(np.linspace(0, np.pi, SR)) ** 2, 0.8)
tc = t(1.8)
chime = sum(np.sin(2 * np.pi * f * tc) * np.exp(-tc * d) for f, d in ((880, 2.5), (1320, 3), (1760, 3.5), (2640, 5)))
SOUNDS["seal"] = master(chime * 0.5 + bp(noise(1.8), 4000, 9000) * np.exp(-tc * 4) * 0.2, 0.7)
SOUNDS["roar"] = master(mix(lp(noise(2.2), 400) * env(int(SR * 2.2), 0.15, 1.2, 0.6) * 2,
    np.sin(2 * np.pi * np.cumsum(70 + 25 * np.sin(2 * np.pi * 9 * t(2.2))) / SR) * env(int(SR * 2.2), 0.2, 1.2, 0.6)))

snd_dir = RP / "sounds" / "aegis"
snd_dir.mkdir(parents=True, exist_ok=True)
defs = {}
with tempfile.TemporaryDirectory() as tmp:
    for name, x in SOUNDS.items():
        wav = Path(tmp) / f"{name}.wav"
        wavfile.write(wav, SR, (x * 32767).astype(np.int16))
        subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", str(wav), "-c:a", "libvorbis", "-q:a", "5", str(snd_dir / f"{name}.ogg")], check=True)
        defs[f"aegis.{name}"] = {"category": "player", "min_distance": 4, "max_distance": 48,
                                 "sounds": [{"name": f"sounds/aegis/{name}", "volume": 1.0, "load_on_low_memory": True}]}
sd_path = RP / "sounds" / "sound_definitions.json"
w(sd_path, {"format_version": "1.14.0", "sound_definitions": defs})
print("Cinematic assets:", len(SOUNDS), "sounds,", len(FOGS), "fogs.")

# Particles are owned by tools/gen_particles.py — regenerate them so they win over anything written above.
import subprocess as _sp  # noqa: E402
import sys as _sys  # noqa: E402
_sp.run([_sys.executable, str(Path(__file__).resolve().parent / "gen_particles.py")], check=True)
