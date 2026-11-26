#!/usr/bin/env python3
"""Jujutsu Legacy particles: white textures drawn in code, tinted per use from script.

Every effect reads these Molang variables (pass them with a MolangVariableMap):
  variable.color  — setColorRGB("variable.color", {red, green, blue}), 0..1 each
  variable.size   — setFloat("variable.size", s); scales the effect (1 = normal)
Line and sphere effects also read:
  jjk:beam        variable.dx / dy / dz (unit direction) and variable.len (blocks): particles along a line in one call
  jjk:shell       variable.radius: a sphere of light (a domain's edge)
  jjk:implode     variable.radius: particles rushing inwards (Blue)
  jjk:vortex      variable.radius: motes spiralling into the centre (Hollow Purple forming)
  jjk:stars       variable.radius: twinkling stars inside a sphere (the Unlimited Void)
  jjk:streak      variable.dx / dy / dz: speed lines trailing behind a dash
Every effect is ONE emitter with a capped number of particles (cheap to spawn); scripts budget how many they spawn a
tick (core.js fx()).
It also writes the fogs (resource_pack/fogs/jjk_<name>.json, ids jjk:fog_<name>): each domain's atmosphere and the
Hollow Purple cinematic's.
Run from the jjk-addon folder:  python3 tools/gen_particles.py
"""
import json
import math
import random
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
RP = ROOT / "resource_pack"
TEX = RP / "textures" / "particle" / "jjk"
TEX.mkdir(parents=True, exist_ok=True)
OUT = RP / "particles"
OUT.mkdir(parents=True, exist_ok=True)


def save_tex(name, size, fn):
    img = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    px = img.load()
    for x in range(size):
        for y in range(size):
            a = max(0.0, min(1.0, fn((x + 0.5) / size * 2 - 1, (y + 0.5) / size * 2 - 1)))
            px[x, y] = (255, 255, 255, int(a * 255))
    img.save(TEX / f"{name}.png")


rnd = random.Random(4)
save_tex("orb", 32, lambda x, y: max(0.0, 1 - math.hypot(x, y)) ** 1.6 * 1.3)
save_tex("spark", 16, lambda x, y: (1 - abs(x) * 4) * (1 - abs(y)) * 1.4)
save_tex("ring", 64, lambda x, y: 1 - abs(math.hypot(x, y) - 0.8) * 9)
save_tex("drop", 8, lambda x, y: (1 - math.hypot(x, y)) * 3)
save_tex("smoke", 32, lambda x, y: (1 - math.hypot(x, y)) * (0.75 + 0.25 * rnd.random()) * 1.2)


def slash(x, y):   # a crescent cut: thick in the middle, thin at the tips
    r = math.hypot(x, y - 0.9)
    ang = math.atan2(x, -(y - 0.9))
    if abs(ang) > 1.0:
        return 0
    thick = 0.09 * (1 - (ang / 1.0) ** 2)
    return 1 - abs(r - 1.25) / max(0.005, thick)


save_tex("slash", 64, slash)
BOLT = [(-0.9, -0.1), (-0.45, 0.2), (-0.2, -0.25), (0.15, 0.15), (0.4, -0.2), (0.9, 0.1)]


def bolt(x, y):
    best = 9
    for (ax, ay), (bx, by) in zip(BOLT, BOLT[1:]):
        dx, dy = bx - ax, by - ay
        u = max(0, min(1, ((x - ax) * dx + (y - ay) * dy) / (dx * dx + dy * dy)))
        best = min(best, math.hypot(x - ax - dx * u, y - ay - dy * u))
    return 1 - (best - 0.04) * 12


save_tex("bolt", 32, bolt)
# a chunk of rubble (a square with a darker rim), a domain's sigil, a column of light
save_tex("chunk", 8, lambda x, y: 1.0 if max(abs(x), abs(y)) < 0.75 else (0.75 if max(abs(x), abs(y)) < 1 else 0))


def glyph(x, y):
    r = math.hypot(x, y)
    a = math.atan2(y, x)
    ring = max(1 - abs(r - 0.88) * 30, 1 - abs(r - 0.7) * 40, 0)
    ticks = 1 - abs(r - 0.79) * 14 if abs(math.sin(a * 12)) > 0.93 else 0
    spokes = 1 - abs(r - 0.42) * 18 if abs(math.sin(a * 3)) > 0.97 else 0
    star = 1 - abs(r - 0.28) * 26
    return max(ring, ticks, spokes, star, 0) * (1 if r < 0.95 else 0)


save_tex("glyph", 64, glyph)
save_tex("pillar", 32, lambda x, y: max(0.0, 1 - abs(x) * 1.6) ** 1.4 * (1 - abs(y) ** 6))

SIZE = "(variable.size > 0 ? variable.size : 1)"
TINT = ["variable.color.r", "variable.color.g", "variable.color.b"]
FADE = "1 - v.particle_age / v.particle_lifetime"


def uv(n):
    return {"texture_width": n, "texture_height": n, "uv": [0, 0], "uv_size": [n, n]}


def effect(pid, tex, n, material, comps):
    base = {"minecraft:emitter_lifetime_once": {"active_time": 0.05}}
    base.update(comps)
    (OUT / f"{pid}.particle.json").write_text(json.dumps({"format_version": "1.10.0", "particle_effect": {
        "description": {"identifier": f"jjk:{pid}", "basic_render_parameters": {"material": material, "texture": f"textures/particle/jjk/{tex}"}},
        "components": base}}, indent=2) + "\n")


def tint(alpha=FADE):
    return {"minecraft:particle_appearance_tinting": {"color": TINT + [alpha]}}


def billboard(size, tex_n, mode="rotate_xyz", extra=None):
    b = {"size": size, "facing_camera_mode": mode, "uv": uv(tex_n)}
    if extra:
        b.update(extra)
    return {"minecraft:particle_appearance_billboard": b}


# a single glow (trails, hand glows)
effect("orb", "orb", 32, "particles_add", {
    "minecraft:emitter_rate_instant": {"num_particles": 1}, "minecraft:emitter_shape_point": {},
    "minecraft:particle_lifetime_expression": {"max_lifetime": 0.35}, "minecraft:particle_initial_speed": 0, "minecraft:particle_motion_dynamic": {},
    **billboard([f"0.45 * {SIZE} * (1 - v.particle_age / v.particle_lifetime * 0.6)"] * 2, 32), **tint()})
# an explosion of glowing motes
effect("burst", "orb", 32, "particles_add", {
    "minecraft:emitter_rate_instant": {"num_particles": f"math.min(80, 22 * {SIZE})"},
    "minecraft:emitter_shape_sphere": {"radius": f"0.3 * {SIZE}", "direction": "outwards"},
    "minecraft:particle_lifetime_expression": {"max_lifetime": "math.random(0.45, 0.8)"},
    "minecraft:particle_initial_speed": f"math.random(3, 8) * {SIZE}", "minecraft:particle_motion_dynamic": {"linear_drag_coefficient": 4},
    **billboard([f"math.random(0.15, 0.35) * {SIZE}"] * 2, 32), **tint()})
# fast streaking sparks (Black Flash, cuts landing)
effect("spark", "spark", 16, "particles_add", {
    "minecraft:emitter_rate_instant": {"num_particles": f"math.min(40, 12 * {SIZE})"},
    "minecraft:emitter_shape_sphere": {"radius": 0.2, "direction": "outwards"},
    "minecraft:particle_lifetime_expression": {"max_lifetime": "math.random(0.2, 0.4)"},
    "minecraft:particle_initial_speed": f"math.random(6, 12) * {SIZE}", "minecraft:particle_motion_dynamic": {"linear_drag_coefficient": 3},
    **billboard(["0.06", f"0.45 * {SIZE}"], 16, "lookat_direction", {"direction": {"mode": "derive_from_velocity"}}), **tint()})
# a crescent cut, spun at random (Dismantle, Cleave, the Shrine)
effect("slash", "slash", 64, "particles_add", {
    "minecraft:emitter_rate_instant": {"num_particles": 1}, "minecraft:emitter_shape_point": {},
    "minecraft:particle_lifetime_expression": {"max_lifetime": 0.28}, "minecraft:particle_initial_speed": 0, "minecraft:particle_motion_dynamic": {},
    "minecraft:particle_initial_spin": {"rotation": "math.random(0, 360)"},
    **billboard([f"(1.3 + v.particle_age * 3) * {SIZE}"] * 2, 64), **tint()})
# a flat shockwave on the ground
effect("ring", "ring", 64, "particles_add", {
    "minecraft:emitter_rate_instant": {"num_particles": 1}, "minecraft:emitter_shape_point": {},
    "minecraft:particle_lifetime_expression": {"max_lifetime": 0.5}, "minecraft:particle_initial_speed": 0, "minecraft:particle_motion_dynamic": {},
    **billboard([f"(0.4 + v.particle_age / v.particle_lifetime * 3) * {SIZE}"] * 2, 64, "emitter_transform_xz"), **tint()})
# dark smoke (curses dying, impacts)
effect("smoke", "smoke", 32, "particles_alpha", {
    "minecraft:emitter_rate_instant": {"num_particles": f"math.min(30, 8 * {SIZE})"},
    "minecraft:emitter_shape_sphere": {"radius": f"0.5 * {SIZE}", "direction": "outwards"},
    "minecraft:particle_lifetime_expression": {"max_lifetime": "math.random(0.9, 1.5)"},
    "minecraft:particle_initial_speed": "math.random(0.4, 1.2)",
    "minecraft:particle_motion_dynamic": {"linear_acceleration": [0, 0.6, 0], "linear_drag_coefficient": 1.5},
    **billboard([f"math.random(0.4, 0.8) * {SIZE}"] * 2, 32), **tint(f"0.85 * ({FADE})")})
# black lightning (Black Flash)
effect("bolt", "bolt", 32, "particles_alpha", {
    "minecraft:emitter_rate_instant": {"num_particles": 6}, "minecraft:emitter_shape_sphere": {"radius": f"0.6 * {SIZE}"},
    "minecraft:particle_lifetime_expression": {"max_lifetime": "math.random(0.18, 0.32)"}, "minecraft:particle_initial_speed": 0,
    "minecraft:particle_motion_dynamic": {}, "minecraft:particle_initial_spin": {"rotation": "math.random(0, 360)"},
    **billboard([f"math.random(0.9, 1.6) * {SIZE}"] * 2, 32), **tint("1")})
# blood droplets
effect("blood", "drop", 8, "particles_alpha", {
    "minecraft:emitter_rate_instant": {"num_particles": f"math.min(40, 12 * {SIZE})"},
    "minecraft:emitter_shape_sphere": {"radius": 0.2, "direction": [f"math.random(-1, 1)", "math.random(0.2, 1.2)", "math.random(-1, 1)"]},
    "minecraft:particle_lifetime_expression": {"max_lifetime": "math.random(0.6, 1.0)"},
    "minecraft:particle_initial_speed": "math.random(2, 4)", "minecraft:particle_motion_dynamic": {"linear_acceleration": [0, -18, 0]},
    "minecraft:particle_motion_collision": {"collision_radius": 0.05, "coefficient_of_restitution": 0, "collision_drag": 10},
    **billboard([f"math.random(0.06, 0.13) * {SIZE}"] * 2, 8), **tint("1")})
# cursed energy rising off a body
effect("aura", "orb", 32, "particles_add", {
    "minecraft:emitter_rate_instant": {"num_particles": f"math.min(24, 6 * {SIZE})"},
    "minecraft:emitter_shape_disc": {"radius": f"0.55 * {SIZE}", "plane_normal": "y", "surface_only": True},
    "minecraft:particle_lifetime_expression": {"max_lifetime": "math.random(0.5, 0.9)"},
    "minecraft:particle_initial_speed": 0, "minecraft:particle_motion_dynamic": {"linear_acceleration": [0, 4, 0], "linear_drag_coefficient": 2},
    **billboard([f"math.random(0.08, 0.18) * {SIZE}"] * 2, 32), **tint()})
# a straight beam in one call
effect("beam", "orb", 32, "particles_add", {
    "minecraft:emitter_rate_instant": {"num_particles": "math.clamp(variable.len * 4, 2, 160)"},
    "minecraft:emitter_shape_point": {"offset": ["variable.dx * math.random(0, variable.len) + math.random(-0.06, 0.06)",
                                                 "variable.dy * math.random(0, variable.len) + math.random(-0.06, 0.06)",
                                                 "variable.dz * math.random(0, variable.len) + math.random(-0.06, 0.06)"]},
    "minecraft:particle_lifetime_expression": {"max_lifetime": "math.random(0.25, 0.45)"}, "minecraft:particle_initial_speed": 0,
    "minecraft:particle_motion_dynamic": {}, **billboard([f"math.random(0.18, 0.3) * {SIZE}"] * 2, 32), **tint()})
# a sphere of light (a domain's edge)
effect("shell", "orb", 32, "particles_add", {
    "minecraft:emitter_rate_instant": {"num_particles": "math.clamp(variable.radius * variable.radius * 1.4, 20, 260)"},
    "minecraft:emitter_shape_sphere": {"radius": "variable.radius", "surface_only": True, "direction": "outwards"},
    "minecraft:particle_lifetime_expression": {"max_lifetime": "math.random(1.0, 1.6)"}, "minecraft:particle_initial_speed": 0.2,
    "minecraft:particle_motion_dynamic": {}, **billboard([f"0.35 * {SIZE}"] * 2, 32), **tint()})
# particles rushing inwards (Blue)
effect("implode", "orb", 32, "particles_add", {
    "minecraft:emitter_rate_instant": {"num_particles": 26},
    "minecraft:emitter_shape_sphere": {"radius": "variable.radius", "surface_only": True, "direction": "inwards"},
    "minecraft:particle_lifetime_expression": {"max_lifetime": 0.45}, "minecraft:particle_initial_speed": "variable.radius / 0.45",
    "minecraft:particle_motion_dynamic": {}, **billboard([f"0.22 * {SIZE}"] * 2, 32), **tint()})

# --- added for the cinematics and the low-lag VFX pass ---------------------------------------------------------------
# a quick glow that fills the view for an instant (impacts, a domain opening)
effect("flash", "orb", 32, "particles_add", {
    "minecraft:emitter_rate_instant": {"num_particles": 1}, "minecraft:emitter_shape_point": {},
    "minecraft:particle_lifetime_expression": {"max_lifetime": 0.22}, "minecraft:particle_initial_speed": 0, "minecraft:particle_motion_dynamic": {},
    **billboard([f"(2.2 + v.particle_age * 6) * {SIZE}"] * 2, 32), **tint(f"0.9 * ({FADE})")})
# rubble thrown up by an impact
effect("debris", "chunk", 8, "particles_alpha", {
    "minecraft:emitter_rate_instant": {"num_particles": f"math.min(16, 8 * {SIZE})"},
    "minecraft:emitter_shape_disc": {"radius": f"0.6 * {SIZE}", "plane_normal": "y", "direction": [f"math.random(-1, 1)", "math.random(1.5, 3)", "math.random(-1, 1)"]},
    "minecraft:particle_lifetime_expression": {"max_lifetime": "math.random(0.8, 1.3)"},
    "minecraft:particle_initial_speed": "math.random(3, 6)", "minecraft:particle_motion_dynamic": {"linear_acceleration": [0, -22, 0]},
    "minecraft:particle_motion_collision": {"collision_radius": 0.08, "coefficient_of_restitution": 0.2, "collision_drag": 6},
    "minecraft:particle_initial_spin": {"rotation": "math.random(0, 360)", "rotation_rate": "math.random(-400, 400)"},
    **billboard([f"math.random(0.1, 0.22) * {SIZE}"] * 2, 8), **tint("1")})
# speed lines trailing behind a dash
effect("streak", "spark", 16, "particles_add", {
    "minecraft:emitter_rate_instant": {"num_particles": 8},
    "minecraft:emitter_shape_sphere": {"radius": f"0.5 * {SIZE}", "direction": ["-variable.dx", "-variable.dy", "-variable.dz"]},
    "minecraft:particle_lifetime_expression": {"max_lifetime": "math.random(0.15, 0.3)"},
    "minecraft:particle_initial_speed": "math.random(8, 14)", "minecraft:particle_motion_dynamic": {"linear_drag_coefficient": 4},
    **billboard(["0.05", f"0.9 * {SIZE}"], 16, "lookat_direction", {"direction": {"mode": "derive_from_velocity"}}), **tint()})
# embers drifting up (fire)
effect("ember", "orb", 32, "particles_add", {
    "minecraft:emitter_rate_instant": {"num_particles": f"math.min(18, 10 * {SIZE})"},
    "minecraft:emitter_shape_disc": {"radius": f"1.2 * {SIZE}", "plane_normal": "y"},
    "minecraft:particle_lifetime_expression": {"max_lifetime": "math.random(1.0, 1.8)"},
    "minecraft:particle_initial_speed": "math.random(0.6, 1.4)",
    "minecraft:particle_motion_dynamic": {"linear_acceleration": ["math.sin(v.particle_age * 300) * 0.8", 1.6, "math.cos(v.particle_age * 260) * 0.8"]},
    **billboard([f"math.random(0.05, 0.11) * {SIZE}"] * 2, 32), **tint()})
# a domain's sigil spreading on the ground, turning as it fades
effect("glyph", "glyph", 64, "particles_add", {
    "minecraft:emitter_rate_instant": {"num_particles": 1}, "minecraft:emitter_shape_point": {},
    "minecraft:particle_lifetime_expression": {"max_lifetime": 1.4}, "minecraft:particle_initial_speed": 0, "minecraft:particle_motion_dynamic": {},
    "minecraft:particle_initial_spin": {"rotation": 0, "rotation_rate": 40},
    **billboard([f"(1.5 + math.min(1, v.particle_age * 3) * 4.5) * {SIZE}"] * 2, 64, "emitter_transform_xz"), **tint(f"math.min(1, (1 - v.particle_age / v.particle_lifetime) * 2)")})
# a column of light (a domain forming, a promotion)
effect("pillar", "pillar", 32, "particles_add", {
    "minecraft:emitter_rate_instant": {"num_particles": 1}, "minecraft:emitter_shape_point": {"offset": [0, f"3 * {SIZE}", 0]},
    "minecraft:particle_lifetime_expression": {"max_lifetime": 0.6}, "minecraft:particle_initial_speed": 0, "minecraft:particle_motion_dynamic": {},
    **billboard([f"(0.6 + v.particle_age) * {SIZE}", f"6 * {SIZE}"], 32, "lookat_y"), **tint()})
# motes spiralling into the centre (Hollow Purple forming)
effect("vortex", "orb", 32, "particles_add", {
    "minecraft:emitter_rate_instant": {"num_particles": 18}, "minecraft:emitter_shape_point": {},
    "minecraft:particle_lifetime_expression": {"max_lifetime": 0.6}, "minecraft:particle_initial_speed": 0,
    "minecraft:particle_motion_parametric": {"relative_position": [
        "math.cos(v.particle_random_1 * 360 + v.particle_age * 720) * variable.radius * (1 - v.particle_age / v.particle_lifetime)",
        "(v.particle_random_2 - 0.5) * variable.radius * 0.6 * (1 - v.particle_age / v.particle_lifetime)",
        "math.sin(v.particle_random_1 * 360 + v.particle_age * 720) * variable.radius * (1 - v.particle_age / v.particle_lifetime)"]},
    **billboard([f"0.18 * {SIZE}"] * 2, 32), **tint()})
# twinkling stars inside a sphere (the Unlimited Void)
effect("stars", "spark", 16, "particles_add", {
    "minecraft:emitter_rate_instant": {"num_particles": "math.clamp(variable.radius * 3, 10, 40)"},
    "minecraft:emitter_shape_sphere": {"radius": "variable.radius"},
    "minecraft:particle_lifetime_expression": {"max_lifetime": "math.random(1.2, 2.2)"}, "minecraft:particle_initial_speed": 0,
    "minecraft:particle_motion_dynamic": {}, "minecraft:particle_initial_spin": {"rotation": 45},
    **billboard([f"0.12 * {SIZE}", f"0.12 * {SIZE}"], 16), **tint("math.sin(v.particle_age / v.particle_lifetime * 180)")})

# --- fogs: each domain's atmosphere (everyone inside sees it from the reveal) and Hollow Purple's cinematic ----------
# name: (colour, where the fog starts, where it is total), in blocks
FOGS = {
    "void": ("#0E1638", 5, 30),         # the Unlimited Void: deep space, stars everywhere
    "shrine": ("#4A0808", 6, 40),       # the Malevolent Shrine: a red haze
    "garden": ("#120A1C", 3, 26),       # the Chimera Shadow Garden: ink
    "moon": ("#C9D2E6", 8, 44),         # the Time Cell Moon Palace: pale moonlight
    "volcano": ("#7A2406", 4, 30),      # the Coffin of the Iron Mountain: smoke and heat
    "perfection": ("#181440", 4, 28),   # the Self-Embodiment of Perfection: indigo dark
    "jackpot": ("#1C5A2C", 8, 42),      # Idle Death Gamble: the parlour's green glow
    "purple": ("#2C0C50", 10, 64),      # Hollow Purple's cinematic
}
FOG_DIR = RP / "fogs"
FOG_DIR.mkdir(parents=True, exist_ok=True)
for name, (col, start, end) in FOGS.items():
    band = {"fog_start": float(start), "fog_end": float(end), "fog_color": col, "render_distance_type": "fixed"}
    (FOG_DIR / f"jjk_{name}.json").write_text(json.dumps({"format_version": "1.16.100", "minecraft:fog_settings": {
        "description": {"identifier": f"jjk:fog_{name}"}, "distance": {"air": band, "weather": band}}}, indent=2) + "\n")

print("Particles:", ", ".join(sorted(p.name.split(".")[0] for p in OUT.glob("*.particle.json"))))
print("Fogs:", ", ".join(FOGS))
