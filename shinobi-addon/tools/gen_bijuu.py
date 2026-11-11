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


def build_geometry(bid, b):
    W, H, L, legH, legW = b["W"], b["H"], b["L"], b["legH"], b["legW"]
    nlegs = b.get("legs", 4)
    bones = []
    body_y = legH
    bones.append({"name": "body", "pivot": [0, body_y + H / 2, 0],
                  "cubes": [cube([-W / 2, body_y, -L / 2], [W, H, L], MAIN)]})
    if b.get("shell"):
        sc = [cube([-W / 2 - 3, body_y + H - 6, -L / 2 - 2], [W + 6, 12, L + 4], ACCENT)]
        random.seed(3)
        for i in range(10):
            sx = random.uniform(-W / 2 + 2, W / 2 - 6)
            sz = random.uniform(-L / 2, L / 2 - 4)
            sc.append(cube([sx, body_y + H + 6, sz], [4, 6, 4], DARK))
        bones.append({"name": "shell", "parent": "body", "pivot": [0, body_y + H, 0], "cubes": sc})

    # head
    hw, hh, hd = b["head"]
    hz = -L / 2 - hd + 4
    hy = body_y + H - hh + 4 if legH else body_y + 2
    head_cubes = [cube([-hw / 2, hy, hz], [hw, hh, hd], MAIN)]
    front = hz
    if "snout" in b:
        sw, sh, sd = b["snout"]
        head_cubes.append(cube([-sw / 2, hy, hz - sd], [sw, sh, sd], MAIN))
        head_cubes.append(cube([-2, hy + sh - 2, hz - sd - 1], [4, 3, 2], DARK))  # nose
    for side in (-1, 1):  # eyes
        head_cubes.append(cube([side * hw / 4 - 2, hy + hh * 0.55, front - 1], [4, 3, 1], EYE))
    if "ears" in b:
        ew, eh = b["ears"]
        for side in (-1, 1):
            head_cubes.append(cube([side * (hw / 2 - ew / 2) - ew / 2, hy + hh, hz + hd / 3], [ew, eh, 3], MAIN))
            head_cubes.append(cube([side * (hw / 2 - ew / 2) - ew / 2 + 1, hy + hh, hz + hd / 3 - 0.5], [ew - 2, eh - 2, 1], DARK))
    if b.get("horns"):
        n = b["horns"]
        for i in range(n):
            x = (i - (n - 1) / 2) * (hw / max(n, 2))
            head_cubes.append(cube([x - 1.5, hy + hh, hz + 3], [3, 8 + (2 if i == n // 2 else 0), 3], ACCENT))
    if b.get("ox_horns"):
        for side in (-1, 1):
            head_cubes.append(cube([side * (hw / 2) - (0 if side > 0 else 10), hy + hh - 4, hz + 6], [10, 4, 4], ACCENT))
            head_cubes.append(cube([side * (hw / 2 + 6) - 2, hy + hh, hz + 6], [4, 10, 4], ACCENT))
    if b.get("stalks"):
        for side in (-1, 1):
            head_cubes.append(cube([side * hw / 4 - 1.5, hy + hh, hz + 2], [3, 12, 3], MAIN))
            head_cubes.append(cube([side * hw / 4 - 2.5, hy + hh + 12, hz + 1], [5, 4, 5], EYE))
    bones.append({"name": "head", "parent": "body", "pivot": [0, hy + hh / 2, -L / 2 + 2], "cubes": head_cubes})

    # legs
    leg_names = []
    if nlegs == 4:
        spots = [(-1, -1), (1, -1), (-1, 1), (1, 1)]
    elif nlegs == 6:
        spots = [(-1, -1), (1, -1), (-1, 0), (1, 0), (-1, 1), (1, 1)]
    else:
        spots = []
    for i, (sx, sz) in enumerate(spots):
        x = sx * (W / 2 - legW / 2 + (3 if nlegs == 6 else 0))
        z = sz * (L / 2 - legW - 2)
        name = f"leg{i}"
        leg_names.append(name)
        cubes = [cube([x - legW / 2, 0, z - legW / 2], [legW, legH, legW], MAIN),
                 cube([x - legW / 2 - 0.5, 0, z - legW / 2 - 1.5], [legW + 1, 3, 2], DARK)]  # claws
        bones.append({"name": name, "parent": "body", "pivot": [x, legH, z], "cubes": cubes})

    # tails
    tw, tl = b["tail"]
    n = b["tails"]
    tail_names = []
    py = body_y + H * 0.7 if legH else body_y + H * 0.5
    for i in range(n):
        spread = 0 if n == 1 else (i / (n - 1) - 0.5) * (110 if n > 4 else 70)
        lift = 40 + (8 if n > 4 and i % 2 else 0)
        name = f"tail{i}"
        tail_names.append(name)
        tip = min(12, tl // 3)
        bones.append({"name": name, "parent": "body", "pivot": [0, py, L / 2 - 2], "rotation": [lift, spread, 0],
                      "cubes": [cube([-tw / 2, py - tw / 2, L / 2 - 2], [tw, tw, tl], MAIN),
                                cube([-tw / 2 - 1, py - tw / 2 - 1, L / 2 - 2 + tl - tip], [tw + 2, tw + 2, tip], ACCENT)]})

    # wings (Chomei)
    wing_names = []
    for i in range(b.get("wings", 0)):
        side = -1 if i % 2 == 0 else 1
        row = i // 2
        name = f"wing{i}"
        wing_names.append(name)
        x0 = side * W / 2
        bones.append({"name": name, "parent": "body", "pivot": [x0, body_y + H, -L / 4 + row * 10],
                      "rotation": [0, side * (10 + row * 15), side * -15],
                      "cubes": [cube([x0 if side > 0 else x0 - 30, body_y + H, -L / 4 + row * 10 - 4], [30, 1, 8], ACCENT)]})

    height = (body_y + H + 20) / 16
    geo = {"format_version": "1.12.0", "minecraft:geometry": [{
        "description": {"identifier": f"geometry.aegis.{bid}", "texture_width": 256, "texture_height": 256,
                        "visible_bounds_width": 8, "visible_bounds_height": 8, "visible_bounds_offset": [0, height / 2, 0]},
        "bones": bones}]}
    return geo, leg_names, tail_names, wing_names


def build_animation(bid, legs, tails, wings):
    walk = "math.cos(q.modified_distance_moved * 22) * 28 * math.min(1.0, q.modified_move_speed * 2)"
    bones = {"head": {"rotation": ["q.target_x_rotation * 0.6 - math.sin(v.attack_time * 180) * 20",
                                   "q.target_y_rotation * 0.6", 0]}}
    for i, n in enumerate(legs):
        sign = 1 if (i % 2 == 0) == (i // 2 % 2 == 0) else -1
        bones[n] = {"rotation": [f"{sign} * {walk}", 0, 0]}
    for i, n in enumerate(tails):
        bones[n] = {"rotation": [f"math.sin(q.life_time * 70 + {i * 40}) * 7",
                                 f"math.cos(q.life_time * 55 + {i * 55}) * 9", 0]}
    for i, n in enumerate(wings):
        side = -1 if i % 2 == 0 else 1
        bones[n] = {"rotation": [0, 0, f"{side} * math.sin(q.life_time * 1600 + {i * 30}) * 22"]}
    return {f"animation.aegis.{bid}.idle": {"loop": True, "bones": bones}}


def texture(b):
    img = Image.new("RGBA", (256, 256), (0, 0, 0, 0))
    random.seed(hash(b["name"]) & 0xffff)

    def fill(x0, y0, x1, y1, col, var=14):
        for x in range(x0, x1):
            for y in range(y0, y1):
                d = random.randint(-var, var)
                img.putpixel((x, y), tuple(max(0, min(255, c + d)) for c in col) + (255,))
    fill(0, 0, 256, 128, b["main"])
    fill(0, 128, 256, 192, b["accent"])
    fill(0, 192, 128, 256, b["dark"], 8)
    fill(128, 192, 256, 256, b["eye"], 4)
    # darker stripes on the main region for some texture
    for y in range(0, 128, 9):
        for x in range(256):
            r, g, bl, a = img.getpixel((x, y))
            img.putpixel((x, y), (int(r * 0.88), int(g * 0.88), int(bl * 0.88), a))
    return img


# ---------------------------------------------------------------------------
# Write everything
# ---------------------------------------------------------------------------
anims = {}
roar = {"animation.aegis.bijuu_roar": {"animation_length": 1.6, "bones": {
    "head": {"rotation": {"0.0": [0, 0, 0], "0.25": [-35, 0, 0], "1.2": [-35, 0, 0], "1.6": [0, 0, 0]}},
    "body": {"rotation": {"0.0": [0, 0, 0], "0.25": [-6, 0, 0], "1.2": [-6, 0, 0], "1.6": [0, 0, 0]}}}}}
anims.update(roar)
lang = []
for bid, b in BEASTS.items():
    geo, legs, tails, wings = build_geometry(bid, b)
    w(RP / "models" / "entity" / f"{bid}.geo.json", geo)
    anims.update(build_animation(bid, legs, tails, wings))
    texture(b).save(RP / "textures" / "entity" / "aegis" / f"{bid}.png")
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


# ---------------------------------------------------------------------------
# Tailed Beast Cloaks: a wearable (chest slot) chakra shell with ears and tails
# ---------------------------------------------------------------------------
def cloak_geometry(n_tails):
    bones = [
        {"name": "body", "pivot": [0, 24, 0], "cubes": [cube([-4, 12, -2], [8, 12, 4], [16, 16], 1.1)]},
        {"name": "head", "pivot": [0, 24, 0], "cubes": [
            cube([-4, 24, -4], [8, 8, 8], [0, 0], 1.1),
            cube([-4.5, 32.5, -1], [3, 5, 2], [32, 0], 0.3),
            cube([1.5, 32.5, -1], [3, 5, 2], [32, 0], 0.3)]},
        {"name": "rightArm", "pivot": [-5, 22, 0], "cubes": [cube([-8, 12, -2], [4, 12, 4], [40, 16], 1.1)]},
        {"name": "leftArm", "pivot": [5, 22, 0], "cubes": [cube([4, 12, -2], [4, 12, 4], [40, 16], 1.1)]},
        {"name": "rightLeg", "pivot": [-1.9, 12, 0], "cubes": [cube([-3.9, 0, -2], [4, 12, 4], [0, 16], 1.1)]},
        {"name": "leftLeg", "pivot": [1.9, 12, 0], "cubes": [cube([-0.1, 0, -2], [4, 12, 4], [0, 16], 1.1)]},
    ]
    for i in range(n_tails):
        spread = 0 if n_tails == 1 else (i / (n_tails - 1) - 0.5) * (120 if n_tails > 4 else 70)
        bones.append({"name": f"tail{i}", "parent": "body", "pivot": [0, 13, 2.5], "rotation": [50 + (6 if i % 2 else 0), spread, 0],
                      "cubes": [cube([-1, 12, 2.5], [2, 2, 14], [0, 32], 0.4),
                                cube([-1.5, 11.5, 13.5], [3, 3, 4], [32, 32], 0.4)]})
    return {"format_version": "1.12.0", "minecraft:geometry": [{
        "description": {"identifier": f"geometry.aegis.cloak_{n_tails}", "texture_width": 64, "texture_height": 64,
                        "visible_bounds_width": 4, "visible_bounds_height": 4, "visible_bounds_offset": [0, 1.5, 0]},
        "bones": bones}]}


def cloak_texture(rgb):
    img = Image.new("RGBA", (64, 64), (0, 0, 0, 0))
    random.seed(sum(rgb))
    for x in range(64):
        for y in range(64):
            bright = 1.25 if (y >= 32 and x >= 32) or (y < 6 and 32 <= x < 42) else 1.0  # tail tips & ears
            k = random.uniform(0.85, 1.1) * bright
            a = random.randint(110, 170) if (x + y) % 3 else random.randint(170, 210)
            img.putpixel((x, y), tuple(min(255, int(c * k)) for c in rgb) + (a,))
    return img


cloak_anim = {}
cloak_items = {}
for bid, b in BEASTS.items():
    n = b["tails"] if bid != "chomei" else 7
    w(RP / "models" / "entity" / f"cloak_{n}.geo.json", cloak_geometry(n))
    rgb = b["main"] if bid not in ("kokuo", "saiken") else b["accent"]
    cloak_texture(rgb).save(RP / "textures" / "models" / "armor" / f"cloak_{bid}.png")
    bones = {f"tail{i}": {"rotation": [f"math.sin(q.life_time * 90 + {i * 40}) * 8", f"math.cos(q.life_time * 70 + {i * 55}) * 10", 0]}
             for i in range(n)}
    bones["head"] = {"scale": "1.0 + math.sin(q.life_time * 400) * 0.015"}
    cloak_anim[f"animation.aegis.cloak_{n}"] = {"loop": True, "bones": bones}
    w(RP / "attachables" / f"cloak_{bid}.json", {"format_version": "1.10.0", "minecraft:attachable": {"description": {
        "identifier": f"aegis:cloak_{bid}",
        "materials": {"default": "entity_alphablend", "enchanted": "armor_enchanted"},
        "textures": {"default": f"textures/models/armor/cloak_{bid}", "enchanted": "textures/misc/enchanted_item_glint"},
        "geometry": {"default": f"geometry.aegis.cloak_{n}"},
        "animations": {"sway": f"animation.aegis.cloak_{n}"}, "scripts": {"animate": ["sway"]},
        "render_controllers": ["controller.render.armor"]}}})
    w(BP / "items" / f"cloak_{bid}.json", {"format_version": "1.21.60", "minecraft:item": {
        "description": {"identifier": f"aegis:cloak_{bid}", "menu_category": {"category": "equipment"}},
        "components": {
            "minecraft:icon": {"textures": {"default": f"aegis_cloak_{bid}"}},
            "minecraft:display_name": {"value": f"Tailed Beast Cloak ({b['name'].split(',')[0]})"},
            "minecraft:max_stack_size": 1, "minecraft:glint": True,
            "minecraft:wearable": {"slot": "slot.armor.chest", "protection": 8},
            "minecraft:enchantable": {"slot": "armor_torso", "value": 15}}}})
    cloak_items[bid] = b["main"]

w(RP / "animations" / "cloak.animation.json", {"format_version": "1.8.0", "animations": cloak_anim})

# cloak item icons + atlas entries
flame = ["................", ".......O........", "......OO........", "......OYO.......", ".....OYYO...O...",
         "....OOYYOO.OO...", "...OOYYWYOOO....", "...OYYWWWYYO....", "..OOYWWWWWYOO...", "..OYYWWWWWYYO...",
         "..OYYWWWWWYYO...", "..OOYYWWWYYOO...", "...OOYYYYYOO....", "....OOOOOOO.....", "................", "................"]
atlas_path = RP / "textures" / "item_texture.json"
atlas = json.loads(atlas_path.read_text())
atlas["texture_data"].pop("aegis_bijuu_cloak", None)
for bid, rgb in cloak_items.items():
    icon = Image.new("RGBA", (16, 16), (0, 0, 0, 0))
    pal = {"O": tuple(int(c * 0.8) for c in rgb) + (255,), "Y": tuple(min(255, int(c * 1.15) + 20) for c in rgb) + (255,), "W": (255, 250, 235, 255)}
    for y, row in enumerate(flame):
        for x, ch in enumerate(row):
            if ch in pal:
                icon.putpixel((x, y), pal[ch])
    icon.save(RP / "textures" / "items" / "aegis" / f"cloak_{bid}.png")
    atlas["texture_data"][f"aegis_cloak_{bid}"] = {"textures": f"textures/items/aegis/cloak_{bid}"}
w(atlas_path, atlas)
print("Generated cloaks.")
