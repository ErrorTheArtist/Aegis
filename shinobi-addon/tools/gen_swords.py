#!/usr/bin/env python3
"""Generates the legendary swords: 3D held models (attachables), textures,
icons (rendered from the model), items and recipes.
Run from the shinobi-addon folder:  python3 tools/gen_swords.py
"""
import json
import math
import random
from pathlib import Path
from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parent.parent
BP, RP = ROOT / "behavior_pack", ROOT / "resource_pack"


def w(path, obj):
    path.parent.mkdir(parents=True, exist_ok=True)
    with open(path, "w") as f:
        json.dump(obj, f, indent=2)
        f.write("\n")


# Grip centre in player model space: the right fist (right arm spans x -8..-4, bottom at y 12).
G = (-6.0, 13.0, 0.0)
# 8x8 swatches on a 64x64 palette texture
SW = {"steel": 0, "edge": 1, "dark": 2, "wrap": 3, "accent": 4, "accent2": 5, "light": 6, "red": 7}


def box(o, s, sw):
    """Cube relative to the grip; blade points along -z (forward)."""
    idx = SW[sw]
    u, v = (idx % 8) * 8, (idx // 8) * 8
    face = {"uv": [u + 1, v + 1], "uv_size": [6, 6]}
    return {"origin": [round(G[i] + o[i], 3) for i in range(3)], "size": list(s),
            "uv": {f: dict(face) for f in ("north", "south", "east", "west", "up", "down")}, "_sw": sw}


SWORDS = {
    "kusanagi": dict(
        name="Kusanagi", damage=9, durability=2200, owner="Sasuke's chokutō",
        colors=dict(steel=(200, 205, 215), edge=(245, 248, 255), dark=(40, 40, 50), wrap=(25, 25, 30),
                    accent=(90, 70, 140), accent2=(150, 200, 255), light=(255, 255, 255), red=(160, 30, 30)),
        slash=(0.6, 0.85, 1.0),
        recipe=([" LD", " DL", "S  "], {"L": "minecraft:lightning_rod", "D": "minecraft:diamond", "S": "minecraft:stick"}),
        cubes=[box((-1, -1, -3), (2, 2, 7), "wrap"), box((-1.25, -1.25, 4), (2.5, 2.5, 1), "dark"),
               box((-1.6, -1.6, -4), (3.2, 3.2, 1), "dark"),
               box((-0.5, -1, -24), (1, 2.5, 20), "steel"), box((-0.35, -1.35, -23.5), (0.7, 0.5, 19.5), "edge"),
               box((-0.5, -0.8, -25.5), (1, 1.8, 1.5), "steel"), box((-0.4, -0.5, -26.5), (0.8, 0.9, 1), "edge"),
               box((-1.05, -0.8, -1.5), (2.1, 0.4, 3), "accent")]),
    "samehada": dict(
        name="Samehada", damage=11, durability=2600, owner="Kisame's living shark-skin sword",
        colors=dict(steel=(70, 95, 140), edge=(150, 180, 220), dark=(40, 50, 70), wrap=(120, 90, 60),
                    accent=(55, 80, 125), accent2=(200, 200, 190), light=(170, 200, 235), red=(150, 40, 40)),
        slash=(0.3, 0.5, 1.0),
        recipe=(["PDP", "PDP", "PSP"], {"P": "minecraft:prismarine_shard", "D": "minecraft:diamond", "S": "minecraft:stick"}),
        cubes=None),
    "kubikiribocho": dict(
        name="Kubikiribōchō", damage=12, durability=2000, owner="Zabuza's Executioner's Blade",
        colors=dict(steel=(185, 190, 195), edge=(240, 242, 245), dark=(45, 45, 50), wrap=(60, 40, 30),
                    accent=(150, 155, 160), accent2=(120, 30, 30), light=(255, 255, 255), red=(170, 20, 20)),
        slash=(1.0, 0.25, 0.25),
        recipe=(["III", "IDI", " S "], {"I": "minecraft:iron_block", "D": "minecraft:diamond", "S": "minecraft:stick"}),
        cubes=None),
    "hiramekarei": dict(
        name="Hiramekarei", damage=10, durability=2000, owner="the twin-handled chakra sword",
        colors=dict(steel=(170, 185, 200), edge=(220, 235, 250), dark=(40, 45, 60), wrap=(50, 60, 110),
                    accent=(80, 200, 255), accent2=(200, 240, 255), light=(255, 255, 255), red=(150, 40, 40)),
        slash=(0.3, 0.85, 1.0),
        recipe=(["LDL", "LDL", "SLS"], {"L": "minecraft:lapis_block", "D": "minecraft:diamond", "S": "minecraft:stick"}),
        cubes=None),
    "kiba": dict(
        name="Kiba", damage=9, durability=1800, owner="the Fangs of Lightning",
        colors=dict(steel=(200, 210, 230), edge=(255, 255, 220), dark=(40, 40, 55), wrap=(30, 30, 45),
                    accent=(255, 240, 140), accent2=(140, 220, 255), light=(255, 255, 255), red=(150, 40, 40)),
        slash=(1.0, 0.95, 0.5),
        recipe=([" D ", "LDL", " S "], {"L": "minecraft:lightning_rod", "D": "minecraft:diamond", "S": "minecraft:stick"}),
        cubes=None),
    "nuibari": dict(
        name="Nuibari", damage=8, durability=1800, owner="the Sewing Needle",
        colors=dict(steel=(210, 215, 225), edge=(250, 250, 255), dark=(40, 40, 50), wrap=(90, 30, 40),
                    accent=(150, 150, 160), accent2=(240, 240, 240), light=(255, 255, 255), red=(150, 40, 40)),
        slash=(0.95, 0.95, 1.0),
        recipe=(["  I", " D ", "S W"], {"I": "minecraft:iron_ingot", "D": "minecraft:diamond", "S": "minecraft:stick", "W": "minecraft:string"}),
        cubes=None),
    "shibuki": dict(
        name="Shibuki", damage=10, durability=1800, owner="the Blastsword",
        colors=dict(steel=(170, 170, 175), edge=(230, 230, 235), dark=(45, 40, 40), wrap=(40, 30, 25),
                    accent=(230, 215, 170), accent2=(255, 140, 40), light=(255, 255, 255), red=(190, 30, 30)),
        slash=(1.0, 0.55, 0.15),
        recipe=(["TDT", "TDT", " S "], {"T": "minecraft:tnt", "D": "minecraft:diamond", "S": "minecraft:stick"}),
        cubes=None),
    "chakra_blades": dict(
        name="Chakra Blades", damage=8, durability=1600, owner="Asuma's wind-infused trench knife",
        colors=dict(steel=(190, 195, 200), edge=(235, 240, 245), dark=(45, 45, 50), wrap=(70, 60, 50),
                    accent=(150, 255, 190), accent2=(200, 255, 220), light=(255, 255, 255), red=(150, 40, 40)),
        slash=(0.55, 1.0, 0.7),
        recipe=([" I ", "FIF", " S "], {"I": "minecraft:iron_ingot", "F": "minecraft:feather", "S": "minecraft:stick"}),
        cubes=None),
}

# --- Samehada: bandaged club covered in scales/spikes
c = [box((-1, -1, -3), (2, 2, 8), "wrap"), box((-1.5, -1.5, 5), (3, 3, 1.5), "dark"),
     box((-2, -3, -30), (4, 6, 27), "steel"), box((-2.5, -3.5, -33), (5, 7, 3.5), "steel")]
for z in range(-29, -4, 3):
    c += [box((-0.5, 3, z), (1, 1.8, 1.5), "light"), box((-0.5, -4.8, z + 1), (1, 1.8, 1.5), "light"),
          box((2, -1 + (z % 2), z + 0.5), (1.6, 1, 1.5), "edge"), box((-3.6, -1 + (z % 2), z + 0.5), (1.6, 1, 1.5), "edge")]
for z in (-11, -19, -26):
    c.append(box((-2.2, -3.2, z), (4.4, 6.4, 1.6), "accent2"))  # bandage wraps
SWORDS["samehada"]["cubes"] = c

# --- Kubikiribōchō: huge cleaver with the round hole near the tip
c = [box((-1, -1, -5), (2, 2, 10), "wrap"), box((-1.3, -1.3, 5), (2.6, 2.6, 1), "dark"),
     box((-0.5, -2, -30), (1, 12, 25), "steel"),
     box((-0.5, -2, -41), (1, 4, 11), "steel"), box((-0.5, 6, -41), (1, 4, 11), "steel"),
     box((-0.5, 2, -41), (1, 4, 4), "steel"), box((-0.5, 2, -33), (1, 4, 3), "steel"),
     box((-0.35, -2.5, -41), (0.7, 0.6, 36), "edge"),          # cutting edge
     box((-0.6, 9.6, -41), (1.2, 0.8, 36), "dark"),            # spine
     box((-0.6, -2, -5.6), (1.2, 12, 0.8), "dark")]            # blade heel
SWORDS["kubikiribocho"]["cubes"] = c

# --- Hiramekarei: twin handles, broad blade with glowing chakra edges
SWORDS["hiramekarei"]["cubes"] = [
    box((-1, -2.6, -3), (2, 2, 8), "wrap"), box((-1, 0.6, -3), (2, 2, 8), "wrap"),
    box((-1.4, -3, 5), (2.8, 6, 1), "dark"), box((-1.4, -3.6, -4.2), (2.8, 7.2, 1.2), "dark"),
    box((-0.5, -3.5, -28), (1, 7, 24), "steel"), box((-0.5, -2.2, -31), (1, 4.4, 3), "steel"),
    box((-0.6, -4.1, -28), (1.2, 0.6, 24), "accent"), box((-0.6, 3.5, -28), (1.2, 0.6, 24), "accent"),
    box((-0.6, -0.4, -26), (1.2, 0.8, 20), "accent2")]

# --- Kiba: jagged lightning blade
c = [box((-1, -1, -2), (2, 2, 6), "wrap"), box((-1.6, -2, -3), (3.2, 4, 1), "dark"), box((-1.2, -1.2, 4), (2.4, 2.4, 1), "dark")]
for k in range(5):
    yo = 0.6 if k % 2 else -0.6
    c.append(box((-0.5, yo - 1.1, -3 - 4 * (k + 1)), (1, 2.2, 4.8), "steel"))
    c.append(box((-0.35, yo - 1.4, -3 - 4 * (k + 1)), (0.7, 0.5, 4.8), "accent"))
c += [box((-0.5, -0.6, -26), (1, 1.2, 3), "accent"), box((-0.4, -0.3, -27.5), (0.8, 0.6, 1.5), "light")]
SWORDS["kiba"]["cubes"] = c

# --- Nuibari: long needle with its thread
SWORDS["nuibari"]["cubes"] = [
    box((-1, -1, -2), (2, 2, 6), "wrap"), box((-1.5, -1.5, -3), (3, 3, 1), "accent"), box((-1.2, -1.2, 4), (2.4, 2.4, 1), "dark"),
    box((-0.4, -0.4, -40), (0.8, 0.8, 37), "steel"), box((-0.25, -0.25, -42), (0.5, 0.5, 2), "edge"),
    box((-0.2, 0.4, -37), (0.4, 0.3, 30), "edge"),
    box((-0.2, -0.2, 5), (0.4, 0.4, 6), "accent2"), box((-0.2, -7, 10.6), (0.4, 7, 0.4), "accent2"),
    box((-0.2, -7.4, 10.6), (0.4, 0.4, 4), "accent2")]

# --- Shibuki: blade lined with explosive tag scrolls
c = [box((-1, -1, -3), (2, 2, 7), "wrap"), box((-1.6, -2, -4), (3.2, 4.4, 1), "dark"), box((-1.2, -1.2, 4), (2.4, 2.4, 1), "dark"),
     box((-0.5, -2, -27), (1, 4.6, 23), "steel"), box((-0.35, -2.4, -27), (0.7, 0.5, 23), "edge"),
     box((-0.5, -1, -29), (1, 2.6, 2), "steel")]
for z in (-9, -15, -21):
    c += [box((-1.5, 2.6, z), (3, 2.2, 4), "accent"), box((-1.6, 3.1, z + 1), (3.2, 1.2, 2), "red")]
SWORDS["shibuki"]["cubes"] = c

# --- Chakra blades: trench knife with knuckle guard and a wind-chakra edge
SWORDS["chakra_blades"]["cubes"] = [
    box((-1, -1, -2), (2, 2, 5), "wrap"),
    box((-0.7, -4.5, -2.5), (1.4, 1, 6), "dark"), box((-0.7, -4.5, -2.5), (1.4, 3.5, 1), "dark"),
    box((-0.7, -4.5, 2.6), (1.4, 3.5, 1), "dark"),
    box((-0.5, -1.4, -14), (1, 3.4, 11), "steel"), box((-0.5, -0.8, -16), (1, 2.2, 2), "steel"),
    box((-0.4, -0.4, -17), (0.8, 1, 1), "edge"),
    box((-0.6, -1.8, -14), (1.2, 0.5, 12), "accent"), box((-0.6, 1.9, -13), (1.2, 0.4, 10), "accent2")]


def palette(colors):
    img = Image.new("RGBA", (64, 64), (0, 0, 0, 0))
    random.seed(sum(sum(v) for v in colors.values()))
    for name, idx in SW.items():
        col = colors[name]
        u, v = (idx % 8) * 8, (idx // 8) * 8
        for x in range(8):
            for y in range(8):
                k = 1.08 - y * 0.03 + random.uniform(-0.03, 0.03)  # light top, darker bottom
                img.putpixel((u + x, v + y), tuple(max(0, min(255, int(ch * k))) for ch in col) + (255,))
    return img


def icon(cubes, colors):
    """Side view of the model (z/y plane), rotated 45° so the blade points to the top-right."""
    zs = [cu["origin"][2] for cu in cubes] + [cu["origin"][2] + cu["size"][2] for cu in cubes]
    ys = [cu["origin"][1] for cu in cubes] + [cu["origin"][1] + cu["size"][1] for cu in cubes]
    zmin, zmax, ymin, ymax = min(zs), max(zs), min(ys), max(ys)
    S = 8
    W, H = int((zmax - zmin) * S) + 4, int((ymax - ymin) * S) + 4
    img = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    # draw back-to-front by x so the outer details win
    for cu in sorted(cubes, key=lambda cc: cc["size"][0], reverse=True):
        z0, y0 = cu["origin"][2], cu["origin"][1]
        z1, y1 = z0 + cu["size"][2], y0 + cu["size"][1]
        col = colors[cu["_sw"]]
        d.rectangle([(zmax - z1) * S + 2, (ymax - y1) * S + 2, (zmax - z0) * S + 1, (ymax - y0) * S + 1], fill=col + (255,))
    img = img.rotate(45, expand=True, resample=Image.NEAREST)
    bbox = img.getbbox()
    img = img.crop(bbox)
    side = max(img.size)
    sq = Image.new("RGBA", (side, side), (0, 0, 0, 0))
    sq.paste(img, ((side - img.size[0]) // 2, (side - img.size[1]) // 2))
    small = sq.resize((30, 30), Image.LANCZOS)
    out = Image.new("RGBA", (32, 32), (0, 0, 0, 0))
    out.paste(small, (1, 1))
    # crisp alpha + dark outline for readability
    px = out.load()
    for x in range(32):
        for y in range(32):
            r, g, b, a = px[x, y]
            px[x, y] = (r, g, b, 255 if a > 90 else 0)
    outline = out.copy()
    po = outline.load()
    for x in range(32):
        for y in range(32):
            if px[x, y][3] == 0 and any(0 <= x + dx < 32 and 0 <= y + dy < 32 and px[x + dx, y + dy][3] > 0
                                        for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1))):
                po[x, y] = (20, 20, 25, 255)
    return outline


# ---------------------------------------------------------------------------
atlas_path = RP / "textures" / "item_texture.json"
atlas = json.loads(atlas_path.read_text())
anims = {
    # held pose: tip tilted up a little in third person
    "animation.aegis.sword.hold_third_person": {"loop": True, "bones": {"sword": {"rotation": [-25, 0, 0]}}},
    "animation.aegis.sword.hold_first_person": {"loop": True, "bones": {"sword": {"rotation": [-10, 0, 0]}}},
}
w(RP / "animations" / "swords.animation.json", {"format_version": "1.8.0", "animations": anims})

for sid, sd in SWORDS.items():
    cubes = sd["cubes"]
    cols = {k: tuple(v) for k, v in sd["colors"].items()}
    (RP / "textures" / "models" / "swords").mkdir(parents=True, exist_ok=True)
    palette(cols).save(RP / "textures" / "models" / "swords" / f"{sid}.png")
    icon(cubes, cols).save(RP / "textures" / "items" / "aegis" / f"{sid}.png")

    geo_cubes = [{k: v for k, v in cu.items() if k != "_sw"} for cu in cubes]
    w(RP / "models" / "entity" / f"sword_{sid}.geo.json", {"format_version": "1.16.0", "minecraft:geometry": [{
        "description": {"identifier": f"geometry.aegis.sword_{sid}", "texture_width": 64, "texture_height": 64,
                        "visible_bounds_width": 4, "visible_bounds_height": 4, "visible_bounds_offset": [0, 1, 0]},
        "bones": [{"name": "sword", "pivot": list(G), "binding": "q.item_slot_to_bone_name(c.item_slot)", "cubes": geo_cubes}]}]})

    w(RP / "attachables" / f"sword_{sid}.json", {"format_version": "1.10.0", "minecraft:attachable": {"description": {
        "identifier": f"aegis:{sid}",
        "materials": {"default": "entity_alphatest", "enchanted": "entity_alphatest_glint"},
        "textures": {"default": f"textures/models/swords/{sid}", "enchanted": "textures/misc/enchanted_item_glint"},
        "geometry": {"default": f"geometry.aegis.sword_{sid}"},
        "animations": {"third": "animation.aegis.sword.hold_third_person", "first": "animation.aegis.sword.hold_first_person"},
        "scripts": {"animate": [{"third": "!c.is_first_person"}, {"first": "c.is_first_person"}]},
        "render_controllers": ["controller.render.item_default"]}}})

    w(BP / "items" / f"{sid}.json", {"format_version": "1.21.60", "minecraft:item": {
        "description": {"identifier": f"aegis:{sid}", "menu_category": {"category": "equipment", "group": "minecraft:itemGroup.name.sword"}},
        "components": {
            "minecraft:icon": {"textures": {"default": f"aegis_{sid}"}},
            "minecraft:display_name": {"value": f"§b{sd['name']}§r\n§7{sd['owner']}"},
            "minecraft:max_stack_size": 1,
            "minecraft:hand_equipped": True,
            "minecraft:damage": sd["damage"],
            "minecraft:durability": {"max_durability": sd["durability"]},
            "minecraft:enchantable": {"slot": "sword", "value": 15},
            "minecraft:repairable": {"repair_items": [{"items": ["minecraft:diamond"], "repair_amount": 400}]},
            "minecraft:can_destroy_in_creative": False,
            "minecraft:tags": {"tags": ["minecraft:is_sword"]}}}})

    pattern, key = sd["recipe"]
    w(BP / "recipes" / f"{sid}.json", {"format_version": "1.21.60", "minecraft:recipe_shaped": {
        "description": {"identifier": f"aegis:{sid}"}, "tags": ["crafting_table"],
        "pattern": pattern, "key": {k: {"item": v} for k, v in key.items()},
        "result": {"item": f"aegis:{sid}", "count": 1}, "unlock": {"context": "AlwaysUnlocked"}}})
    atlas["texture_data"][f"aegis_{sid}"] = {"textures": f"textures/items/aegis/{sid}"}

w(atlas_path, atlas)
w(ROOT / "tools" / "sword_colors.json", {sid: sd["slash"] for sid, sd in SWORDS.items()})
print("Generated", len(SWORDS), "swords.")
