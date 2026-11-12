#!/usr/bin/env python3
"""Jutsu Clash energy dome (aegis:clash_orb): a translucent voxel sphere with a white-hot core that swells around the
two jutsu as they grind together, then bursts. Tinted from script through the entity properties aegis:cr/cg/cb.
Key times are mirrored in behavior_pack/scripts/clash_shots.js.   Run from the shinobi-addon folder:  python3 tools/gen_clash_orb.py
"""
import json
import math
import random
from pathlib import Path
from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
BP, RP = ROOT / "behavior_pack", ROOT / "resource_pack"
random.seed(5)
TIMES = {"burst": 2.25, "gone": 2.55}


def w(path, obj):
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(obj, separators=(",", ":")) + "\n")


# --- texture: left 32×32 = the shell (cloudy, translucent), right 32×32 = the core (near-solid white) ---
tex = Image.new("RGBA", (64, 32), (0, 0, 0, 0))
px = tex.load()
for x in range(32):
    for y in range(32):
        n = (math.sin(x * 0.9 + math.sin(y * 0.7) * 2) + math.sin(y * 1.1 + math.cos(x * 0.5) * 2)) * 0.25 + 0.5
        vein = 1.0 if random.random() < 0.06 else 0.0
        v = int(170 + 85 * max(n, vein))
        px[x, y] = (v, v, v, int(70 + 80 * n + 90 * vein))
        c = 235 + random.randrange(20)
        px[32 + x, y] = (c, c, c, 225)
(RP / "textures" / "entity" / "aegis").mkdir(parents=True, exist_ok=True)
tex.save(RP / "textures" / "entity" / "aegis" / "clash_orb.png")


def shell(radius, voxel, u0):
    """Cubes for a voxel sphere; only the faces that touch empty space are drawn."""
    inside = set()
    r = radius
    for x in range(-r, r):
        for y in range(-r, r):
            for z in range(-r, r):
                if (x + 0.5) ** 2 + (y + 0.5) ** 2 + (z + 0.5) ** 2 <= (r - 0.3) ** 2:
                    inside.add((x, y, z))
    faces = {"north": (0, 0, -1), "south": (0, 0, 1), "east": (1, 0, 0), "west": (-1, 0, 0), "up": (0, 1, 0), "down": (0, -1, 0)}
    cubes = []
    for (x, y, z) in sorted(inside):
        uv = {}
        for f, (dx, dy, dz) in faces.items():
            if (x + dx, y + dy, z + dz) not in inside:
                uv[f] = {"uv": [u0 + random.randrange(0, 28), random.randrange(0, 28)], "uv_size": [4, 4]}
        if uv:
            cubes.append({"origin": [x * voxel, y * voxel, z * voxel], "size": [voxel, voxel, voxel], "uv": uv})
    return cubes


SHELL = shell(6, 4, 0)   # 1.5 blocks radius at scale 1
CORE = shell(3, 3, 32)   # ~0.56 blocks
w(RP / "models" / "entity" / "clash_orb.geo.json", {"format_version": "1.12.0", "minecraft:geometry": [{
    "description": {"identifier": "geometry.aegis.clash_orb", "texture_width": 64, "texture_height": 32,
                    "visible_bounds_width": 14, "visible_bounds_height": 14, "visible_bounds_offset": [0, 0, 0]},
    "bones": [{"name": "root", "pivot": [0, 0, 0]},
              {"name": "shell", "parent": "root", "pivot": [0, 0, 0], "cubes": SHELL},
              {"name": "core", "parent": "root", "pivot": [0, 0, 0], "cubes": CORE}]}]})


def keys(fn, t0, t1, fps=20):
    n = max(1, round((t1 - t0) * fps))
    return {f"{t0 + (t1 - t0) * i / n:.2f}": [round(v, 3) for v in fn(t0 + (t1 - t0) * i / n)] for i in range(n + 1)}


B, G = TIMES["burst"], TIMES["gone"]


def shell_scale(t):
    if t < 0.08:
        k = 0.05 + 0.4 * (t / 0.08)                         # the flash of contact
    elif t < 0.2:
        k = 0.45 - 0.25 * ((t - 0.08) / 0.12)
    elif t < 0.75:
        k = 0.2 + 0.35 * ((t - 0.2) / 0.55) + 0.03 * math.sin(t * 30)      # a ball between their fists
    elif t < 0.9:
        k = 0.55 + 1.05 * ((t - 0.75) / 0.15) ** 0.7        # it surges out and swallows them both
    elif t < B:
        u = (t - 0.9) / (B - 0.9)
        k = 1.6 + 1.2 * u ** 1.4 + 0.05 * math.sin(t * 26) * (0.5 + u)     # swelling, shuddering
    elif t < B + 0.12:
        k = 2.8 + 1.9 * ((t - B) / 0.12)                    # bursts
    else:
        k = max(0.0, 4.7 * (1 - (t - B - 0.12) / (G - B - 0.12)))
    return [k, k, k]


def core_scale(t):
    if t >= B:
        k = max(0.0, 2.2 * (1 - (t - B) / (G - B)))
    else:
        k = 0.5 + 1.1 * (t / B) + 0.18 * math.sin(t * 40)
    return [k, k, k]


w(RP / "animations" / "clash.animation.json", {"format_version": "1.8.0", "animations": {"animation.aegis.clash_orb": {
    "loop": "hold_on_last_frame", "animation_length": G + 0.05, "bones": {
        "shell": {"scale": keys(shell_scale, 0, G), "rotation": keys(lambda t: [math.sin(t * 3) * 14, t * 240, math.cos(t * 2.3) * 10], 0, G, 10)},
        "core": {"scale": keys(core_scale, 0, G), "rotation": keys(lambda t: [t * 300, t * -420, 0], 0, G, 10)}}}}})

rc_path = RP / "render_controllers" / "clash.render_controllers.json"
rc_path.write_text(json.dumps({"format_version": "1.8.0", "render_controllers": {"controller.render.aegis.clash_orb": {
    "geometry": "Geometry.default", "materials": [{"*": "Material.default"}], "textures": ["Texture.default"], "ignore_lighting": True,
    "color": {"r": "q.property('aegis:cr')", "g": "q.property('aegis:cg')", "b": "q.property('aegis:cb')", "a": "1.0"}}}}, indent=2) + "\n")
(RP / "entity" / "clash_orb.entity.json").write_text(json.dumps({"format_version": "1.10.0", "minecraft:client_entity": {"description": {
    "identifier": "aegis:clash_orb", "materials": {"default": "entity_alphablend"},
    "textures": {"default": "textures/entity/aegis/clash_orb"}, "geometry": {"default": "geometry.aegis.clash_orb"},
    "animations": {"play": "animation.aegis.clash_orb"}, "scripts": {"animate": ["play"]},
    "render_controllers": ["controller.render.aegis.clash_orb"]}}}, indent=2) + "\n")
color = {"type": "float", "range": [0.0, 1.0], "default": 1.0, "client_sync": True}
(BP / "entities" / "clash_orb.json").write_text(json.dumps({"format_version": "1.21.0", "minecraft:entity": {
    "description": {"identifier": "aegis:clash_orb", "is_spawnable": False, "is_summonable": True, "is_experimental": False,
                    "properties": {"aegis:cr": color, "aegis:cg": color, "aegis:cb": color}},
    "component_groups": {"aegis:expire": {"minecraft:instant_despawn": {}}},
    "components": {
        "minecraft:type_family": {"family": ["aegis_fx", "inanimate"]},
        "minecraft:collision_box": {"width": 0.05, "height": 0.05},
        "minecraft:physics": {"has_gravity": False, "has_collision": False},
        "minecraft:pushable": {"is_pushable": False, "is_pushable_by_piston": False},
        "minecraft:damage_sensor": {"triggers": [{"cause": "all", "deals_damage": "no"}]},
        "minecraft:fire_immune": {},
        "minecraft:knockback_resistance": {"value": 1},
        "minecraft:timer": {"time": 6, "looping": False, "time_down_event": {"event": "aegis:expire", "target": "self"}}},
    "events": {"aegis:expire": {"add": {"component_groups": ["aegis:expire"]}}}}}, indent=2) + "\n")
print(f"Clash orb generated: {len(SHELL)} shell cubes, {len(CORE)} core cubes, times {TIMES}")
