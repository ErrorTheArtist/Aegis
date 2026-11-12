#!/usr/bin/env python3
"""Edo Tensei coffin: a summoned wooden coffin that rises from the earth and drops its lid (cinematic prop).
Run from the shinobi-addon folder:  python3 tools/gen_edo_coffin.py"""
import json
import random
from pathlib import Path
from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parent.parent
BP, RP = ROOT / "behavior_pack", ROOT / "resource_pack"
random.seed(7)


def w(path, obj):
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(obj, indent=2, ensure_ascii=False) + "\n")


# --- geometry (front = -Z, the side that faces the summoner) -------------------------------------------------
LID_UV, BACK_UV, SIDE_UV, CAP_UV = [0, 0], [0, 48], [56, 0], [56, 60]
geo = {"format_version": "1.12.0", "minecraft:geometry": [{
    "description": {"identifier": "geometry.aegis.edo_coffin", "texture_width": 128, "texture_height": 128,
                    "visible_bounds_width": 4, "visible_bounds_height": 5, "visible_bounds_offset": [0, 1.5, 0]},
    "bones": [
        {"name": "root", "pivot": [0, 0, 0]},
        {"name": "box", "parent": "root", "pivot": [0, 0, 0], "cubes": [
            {"origin": [-10, 0, 4], "size": [20, 42, 3], "uv": BACK_UV},          # back panel (dark inside)
            {"origin": [-10, 0, -8], "size": [2, 42, 12], "uv": SIDE_UV},         # left wall
            {"origin": [8, 0, -8], "size": [2, 42, 12], "uv": SIDE_UV},           # right wall
            {"origin": [-10, 42, -8], "size": [20, 3, 15], "uv": CAP_UV},         # roof
            {"origin": [-10, -1, -8], "size": [20, 2, 15], "uv": CAP_UV},         # floor
        ]},
        {"name": "lid", "parent": "root", "pivot": [0, 0, -9], "cubes": [
            {"origin": [-11, 0, -10], "size": [22, 45, 2], "uv": LID_UV}]},
    ]}]}
w(RP / "models" / "entity" / "edo_coffin.geo.json", geo)

# --- texture -------------------------------------------------------------------------------------------------
img = Image.new("RGBA", (128, 128), (0, 0, 0, 0))
d = ImageDraw.Draw(img)


def wood(x0, y0, x1, y1, base=(98, 66, 42), dark=(70, 46, 28)):
    d.rectangle([x0, y0, x1 - 1, y1 - 1], fill=base + (255,))
    for x in range(x0, x1):
        if random.random() < 0.28:
            d.line([x, y0, x, y1 - 1], fill=dark + (255,))
    for _ in range((x1 - x0) * (y1 - y0) // 60):
        d.point((random.randrange(x0, x1), random.randrange(y0, y1)), fill=(118, 82, 52, 255))


def box_uv(u, v, sx, sy, sz):  # paint a whole box-UV island with wood
    wood(u, v, u + 2 * (sx + sz), v + sz + sy)


box_uv(*LID_UV, 22, 45, 2)
box_uv(*BACK_UV, 20, 42, 3)
box_uv(*SIDE_UV, 2, 42, 12)
box_uv(*CAP_UV, 20, 3, 15)
# lid front (north face): framed planks + the sealing talisman
fx, fy, fw, fh = LID_UV[0] + 2, LID_UV[1] + 2, 22, 45
wood(fx, fy, fx + fw, fy + fh, (112, 76, 48), (84, 56, 34))
d.rectangle([fx, fy, fx + fw - 1, fy + fh - 1], outline=(52, 34, 20, 255))
d.rectangle([fx + 1, fy + 1, fx + fw - 2, fy + fh - 2], outline=(72, 48, 30, 255))
tx = fx + fw // 2 - 3
d.rectangle([tx, fy + 8, tx + 5, fy + 30], fill=(226, 214, 184, 255), outline=(150, 135, 110, 255))
for yy in (fy + 11, fy + 15, fy + 19, fy + 23, fy + 27):
    d.line([tx + 1, yy, tx + 4, yy], fill=(150, 25, 25, 255))
d.line([tx + 2, fy + 12, tx + 2, fy + 26], fill=(150, 25, 25, 255))
# inside of the coffin (front face of the back panel): deep shadow
bx, by = BACK_UV[0] + 3, BACK_UV[1] + 3
d.rectangle([bx, by, bx + 19, by + 41], fill=(30, 22, 18, 255))
for _ in range(60):
    d.point((random.randrange(bx, bx + 20), random.randrange(by, by + 42)), fill=(44, 32, 24, 255))
(RP / "textures" / "entity" / "aegis").mkdir(parents=True, exist_ok=True)
img.save(RP / "textures" / "entity" / "aegis" / "edo_coffin.png")

# --- animation: rise out of the ground (0–1.5s, shuddering), stand, the lid falls forward at 3.1s ----------------
rise = {"0.0": [0, -48, 0], "0.4": [0, -34, 0], "0.8": [0, -16, 0], "1.2": [0, -4, 0], "1.5": [0, 0, 0]}
shud = {f"{t / 10:.1f}": [0, 0, (1.5 if i % 2 else -1.5) if t < 15 else 0] for i, t in enumerate(range(0, 17, 1))}
lid = {"0.0": [0, 0, 0], "2.6": [0, 0, 0], "2.75": [-6, 0, 0], "2.9": [30, 0, 0], "3.1": [92, 0, 0], "3.2": [84, 0, 0], "3.3": [92, 0, 0]}
w(RP / "animations" / "edo.animation.json", {"format_version": "1.8.0", "animations": {
    "animation.aegis.edo_coffin": {"loop": "hold_on_last_frame", "animation_length": 3.4, "bones": {
        "root": {"position": rise, "rotation": shud}, "lid": {"rotation": lid}}}}})

w(RP / "render_controllers" / "edo.render_controllers.json", {"format_version": "1.8.0", "render_controllers": {
    "controller.render.aegis.coffin": {"geometry": "Geometry.default", "materials": [{"*": "Material.default"}],
                                       "textures": ["Texture.default"]}}})
w(RP / "entity" / "edo_coffin.entity.json", {"format_version": "1.10.0", "minecraft:client_entity": {"description": {
    "identifier": "aegis:edo_coffin", "materials": {"default": "entity_alphatest"},
    "textures": {"default": "textures/entity/aegis/edo_coffin"}, "geometry": {"default": "geometry.aegis.edo_coffin"},
    "animations": {"rise": "animation.aegis.edo_coffin"}, "scripts": {"animate": ["rise"]},
    "render_controllers": ["controller.render.aegis.coffin"]}}})
w(BP / "entities" / "edo_coffin.json", {"format_version": "1.21.0", "minecraft:entity": {
    "description": {"identifier": "aegis:edo_coffin", "is_spawnable": False, "is_summonable": True, "is_experimental": False},
    "component_groups": {"aegis:expire": {"minecraft:instant_despawn": {}}},
    "components": {
        "minecraft:type_family": {"family": ["aegis_fx", "inanimate"]},
        "minecraft:collision_box": {"width": 0.05, "height": 0.05},
        "minecraft:physics": {"has_gravity": False, "has_collision": False},
        "minecraft:pushable": {"is_pushable": False, "is_pushable_by_piston": False},
        "minecraft:damage_sensor": {"triggers": [{"cause": "all", "deals_damage": "no"}]},
        "minecraft:fire_immune": {},
        "minecraft:knockback_resistance": {"value": 1},
        "minecraft:timer": {"time": 20, "looping": False, "time_down_event": {"event": "aegis:expire", "target": "self"}}},
    "events": {"aegis:expire": {"add": {"component_groups": ["aegis:expire"]}}}}})
print("Edo coffin generated.")
