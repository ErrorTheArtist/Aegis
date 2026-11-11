#!/usr/bin/env python3
"""Assets for the newer jutsu: water orb variant, Rasenshuriken model, extra particles,
and the scroll items + recipes. Run from the shinobi-addon folder:  python3 tools/gen_jutsu_fx.py
"""
import json
from pathlib import Path
from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
BP, RP = ROOT / "behavior_pack", ROOT / "resource_pack"


def w(path, obj):
    path.parent.mkdir(parents=True, exist_ok=True)
    with open(path, "w") as f:
        json.dump(obj, f, indent=2, ensure_ascii=False)
        f.write("\n")


def rj(path):
    return json.loads(Path(path).read_text())


# --- water orb = jutsu_orb variant 3 --------------------------------------------
p = BP / "entities" / "jutsu_orb.json"; d = rj(p); e = d["minecraft:entity"]
e["component_groups"]["aegis:water"] = {"minecraft:variant": {"value": 3}}
e["events"]["aegis:as_water"] = {"add": {"component_groups": ["aegis:water"]}}
w(p, d)
p = RP / "entity" / "jutsu_orb.entity.json"; d = rj(p)
d["minecraft:client_entity"]["description"]["textures"]["water"] = "textures/entity/aegis/water_orb"
w(p, d)
p = RP / "render_controllers" / "aegis.render_controllers.json"; d = rj(p)
d["render_controllers"]["controller.render.aegis.jutsu_orb"]["arrays"]["textures"]["Array.skins"] = ["Texture.rasengan", "Texture.fireball", "Texture.bijuudama", "Texture.water"]
w(p, d)
p = RP / "animations" / "aegis.animation.json"; d = rj(p)
d["animations"]["animation.aegis.orb_spin"]["bones"]["root"]["scale"] = "q.variant == 3 ? 3.2 : (q.variant == 2 ? 4.5 : (q.variant == 1 ? 2.2 : 1.0))"


def orb_tex(core, a, b):
    img = Image.new("RGBA", (32, 32), (0, 0, 0, 0))
    for x in range(32):
        for y in range(32):
            if y < 8:
                img.putpixel((x, y), core)
            elif y < 20:
                img.putpixel((x, y), a if (x * 2 + y) % 5 < 3 else b)
    return img


orb_tex((220, 240, 255, 255), (40, 120, 230, 170), (130, 200, 255, 140)).save(RP / "textures" / "entity" / "aegis" / "water_orb.png")

# --- Rasenshuriken: glowing core + four spinning blades ---------------------------
blades = []
for i, (x, z, sx, sz) in enumerate(((3, -2.5, 14, 5), (-17, -2.5, 14, 5), (-2.5, 3, 5, 14), (-2.5, -17, 5, 14))):
    blades.append({"origin": [x, 3.6, z], "size": [sx, 0.8, sz], "uv": [0, 20]})
w(RP / "models" / "entity" / "rasenshuriken.geo.json", {"format_version": "1.12.0", "minecraft:geometry": [{
    "description": {"identifier": "geometry.aegis.rasenshuriken", "texture_width": 64, "texture_height": 64,
                    "visible_bounds_width": 4, "visible_bounds_height": 3, "visible_bounds_offset": [0, 0.3, 0]},
    "bones": [{"name": "root", "pivot": [0, 4, 0]},
              {"name": "core", "parent": "root", "pivot": [0, 4, 0], "cubes": [
                  {"origin": [-3, 1, -3], "size": [6, 6, 6], "uv": [0, 0]}, {"origin": [-4, 0, -4], "size": [8, 8, 8], "uv": [24, 0], "inflate": 0.3}]},
              {"name": "blades", "parent": "root", "pivot": [0, 4, 0], "cubes": blades}]}]})
img = Image.new("RGBA", (64, 64), (0, 0, 0, 0))
for x in range(64):
    for y in range(64):
        if y < 12 and x < 24:
            img.putpixel((x, y), (235, 250, 255, 255))
        elif y < 16 and x >= 24:
            img.putpixel((x, y), (90, 170, 255, 150))
        elif 20 <= y < 40:
            img.putpixel((x, y), (230, 245, 255, 200) if (x + y) % 6 < 4 else (160, 215, 255, 160))
img.save(RP / "textures" / "entity" / "aegis" / "rasenshuriken.png")
d["animations"]["animation.aegis.rasenshuriken_spin"] = {"loop": True, "bones": {
    "root": {"scale": "1.6"},
    "blades": {"rotation": [0, "q.life_time * 1440", 0]},
    "core": {"rotation": ["q.life_time * 400", "q.life_time * 900", 0], "scale": "1 + math.sin(q.life_time * 2000) * 0.06"}}}
w(p, d)
w(RP / "entity" / "rasenshuriken.entity.json", {"format_version": "1.10.0", "minecraft:client_entity": {"description": {
    "identifier": "aegis:rasenshuriken", "materials": {"default": "entity_alphablend"},
    "textures": {"default": "textures/entity/aegis/rasenshuriken"}, "geometry": {"default": "geometry.aegis.rasenshuriken"},
    "animations": {"spin": "animation.aegis.rasenshuriken_spin"}, "scripts": {"animate": ["spin"]},
    "render_controllers": ["controller.render.aegis.glow"]}}})
orb = rj(BP / "entities" / "jutsu_orb.json")["minecraft:entity"]
w(BP / "entities" / "rasenshuriken.json", {"format_version": "1.21.0", "minecraft:entity": {
    "description": {"identifier": "aegis:rasenshuriken", "is_spawnable": False, "is_summonable": True, "is_experimental": False},
    "component_groups": {"aegis:expire": {"minecraft:instant_despawn": {}}},
    "components": {k: v for k, v in orb["components"].items() if k != "minecraft:variant"},
    "events": {"aegis:expire": {"add": {"component_groups": ["aegis:expire"]}}}}})

# --- particles ---------------------------------------------------------------------
LIFE = "v.particle_age / v.particle_lifetime"


def part(pid, tex, mat, comps, size, colors):
    base = {"minecraft:emitter_lifetime_once": {"active_time": 0.05},
            "minecraft:particle_appearance_billboard": {"size": size, "facing_camera_mode": "rotate_xyz",
                "uv": {"texture_width": 16, "texture_height": 16, "uv": [0, 0], "uv_size": [16, 16]}},
            "minecraft:particle_appearance_tinting": {"color": {"interpolant": LIFE, "gradient": colors}}}
    base.update(comps)
    w(RP / "particles" / f"{pid}.json", {"format_version": "1.10.0", "particle_effect": {
        "description": {"identifier": f"aegis:{pid}", "basic_render_parameters": {"material": mat, "texture": f"textures/particle/aegis/{tex}"}},
        "components": base}})


shrink = lambda s: [f"{s} * (1 - {LIFE})"] * 2
part("water_splash", "glow", "particles_blend", {
    "minecraft:emitter_rate_instant": {"num_particles": 24},
    "minecraft:emitter_shape_sphere": {"radius": 0.5, "direction": "outwards"},
    "minecraft:particle_lifetime_expression": {"max_lifetime": "math.random(0.5, 0.9)"},
    "minecraft:particle_initial_speed": "math.random(2, 5)",
    "minecraft:particle_motion_dynamic": {"linear_acceleration": [0, -12, 0], "linear_drag_coefficient": 1}},
    shrink("(0.18 + v.particle_random_1 * 0.15)"),
    {"0.0": [0.85, 0.95, 1, 0.95], "0.5": [0.3, 0.6, 1, 0.85], "1.0": [0.15, 0.35, 0.9, 0]})
part("dust", "smoke", "particles_blend", {
    "minecraft:emitter_rate_instant": {"num_particles": 20},
    "minecraft:emitter_shape_box": {"half_dimensions": [1.2, 0.3, 1.2], "offset": [0, 0.3, 0], "direction": "outwards"},
    "minecraft:particle_lifetime_expression": {"max_lifetime": "math.random(0.8, 1.4)"},
    "minecraft:particle_initial_speed": "math.random(0.5, 2)",
    "minecraft:particle_initial_spin": {"rotation": "math.random(0, 360)", "rotation_rate": "math.random(-30, 30)"},
    "minecraft:particle_motion_dynamic": {"linear_acceleration": [0, 0.6, 0], "linear_drag_coefficient": 2}},
    [f"0.5 + 0.7 * {LIFE}"] * 2,
    {"0.0": [0.6, 0.48, 0.35, 0.9], "1.0": [0.45, 0.36, 0.26, 0]})
part("heal", "spark", "particles_add", {
    "minecraft:emitter_rate_instant": {"num_particles": 10},
    "minecraft:emitter_shape_box": {"half_dimensions": [0.4, 0.9, 0.4], "offset": [0, 0.9, 0], "direction": [0, 1, 0]},
    "minecraft:particle_lifetime_expression": {"max_lifetime": "math.random(0.6, 1.1)"},
    "minecraft:particle_initial_speed": "math.random(0.4, 1.2)",
    "minecraft:particle_initial_spin": {"rotation": "math.random(0, 360)", "rotation_rate": 90},
    "minecraft:particle_motion_dynamic": {"linear_drag_coefficient": 1}},
    shrink("0.2"),
    {"0.0": [0.9, 1, 0.9, 1], "0.5": [0.4, 1, 0.5, 0.9], "1.0": [0.2, 0.9, 0.3, 0]})

# --- scroll items + recipes -----------------------------------------------------------
SCROLLS = {
    "phoenix_scroll": ("Fire Style: Phoenix Sage Fire", "minecraft:fire_charge"),
    "water_dragon_scroll": ("Water Style: Water Dragon Bullet", "minecraft:kelp"),
    "earth_wall_scroll": ("Earth Style: Earth Wall", "minecraft:stone"),
    "chidori_current_scroll": ("Lightning Style: Chidori Current", "minecraft:copper_ingot"),
    "rasenshuriken_scroll": ("Wind Style: Rasenshuriken", "minecraft:diamond_block"),
    "mystical_palm_scroll": ("Medical: Mystical Palm Technique", "minecraft:glistering_melon_slice"),
    "great_fire_scroll": ("Fire Style: Great Fire Annihilation", "minecraft:blaze_powder"),
    "kirin_scroll": ("Lightning Style: Kirin", "minecraft:lightning_rod"),
    "water_prison_scroll": ("Water Style: Water Prison", "minecraft:water_bucket"),
    "vacuum_scroll": ("Wind Style: Vacuum Bullets", "minecraft:wind_charge"),
    "earth_spikes_scroll": ("Earth Style: Earth Spikes", "minecraft:pointed_dripstone"),
    "chidori_spear_scroll": ("Lightning Style: Chidori Sharp Spear", "minecraft:trident"),
    "eight_gates_scroll": ("Eight Inner Gates Release", "minecraft:golden_apple"),
}
atlas_p = RP / "textures" / "item_texture.json"; atlas = rj(atlas_p)
for sid, (name, cat) in SCROLLS.items():
    w(BP / "items" / f"{sid}.json", {"format_version": "1.21.60", "minecraft:item": {
        "description": {"identifier": f"aegis:{sid}", "menu_category": {"category": "equipment"}},
        "components": {"minecraft:icon": {"textures": {"default": f"aegis_{sid}"}}, "minecraft:display_name": {"value": f"Jutsu Scroll: {name}"},
                       "minecraft:max_stack_size": 1, "minecraft:glint": True}}})
    ing = [{"item": "aegis:blank_scroll"}, {"item": cat}, {"item": "minecraft:lapis_lazuli"}]
    if sid == "rasenshuriken_scroll":
        ing.append({"item": "minecraft:feather"})
    if sid in ("kirin_scroll", "eight_gates_scroll", "great_fire_scroll"):
        ing.append({"item": "minecraft:diamond"})
    w(BP / "recipes" / f"{sid}.json", {"format_version": "1.21.60", "minecraft:recipe_shapeless": {
        "description": {"identifier": f"aegis:{sid}"}, "tags": ["crafting_table"], "ingredients": ing,
        "result": {"item": f"aegis:{sid}", "count": 1}, "unlock": {"context": "AlwaysUnlocked"}}})
    atlas["texture_data"][f"aegis_{sid}"] = {"textures": f"textures/items/aegis/{sid}"}
w(atlas_p, atlas)
print("Jutsu FX generated.")

# Particles are owned by tools/gen_particles.py — regenerate them so they win over anything written above.
import subprocess as _sp  # noqa: E402
import sys as _sys  # noqa: E402
_sp.run([_sys.executable, str(Path(__file__).resolve().parent / "gen_particles.py")], check=True)
