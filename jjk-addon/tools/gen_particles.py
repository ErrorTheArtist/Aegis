#!/usr/bin/env python3
"""Jujutsu Legacy particles: white textures drawn in code, tinted per use from script.

Every effect reads these Molang variables (pass them with a MolangVariableMap):
  variable.color  — setColorRGB("variable.color", {red, green, blue}), 0..1 each
  variable.size   — setFloat("variable.size", s); scales the effect (1 = normal)
Line and sphere effects also read:
  jjk:beam        variable.dx / dy / dz (unit direction) and variable.len (blocks): particles along a line in one call
  jjk:shell       variable.radius: a sphere of light (a domain's edge)
  jjk:implode     variable.radius: particles rushing inwards (Blue)
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
print("Particles:", ", ".join(sorted(p.name.split(".")[0] for p in OUT.glob("*.particle.json"))))
