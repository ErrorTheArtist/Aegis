#!/usr/bin/env python3
"""Generates the legendary swords: 3D held models (attachables), detailed 32x32 icons
(rendered from the same voxel design), items (no recipes: swords are bought or won).

Held-model placement copies Mojang's vanilla trident: the item is modelled as a pole along +y
around x=0/z=0 with the bone pivot at [0, 24, 0] and bound to the hand slot; the trident grips
its pole at y=13.5. Our swords put the grip there too, so the hand ends up on the handle.
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
SW = {"steel": 0, "edge": 1, "dark": 2, "wrap": 3, "accent": 4, "accent2": 5, "light": 6, "red": 7, "sheath": 8}


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
        recipe=None,  # Samehada is earned through the quest chain only
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

# --- Kusanagi's scabbard: dark lacquer, a metal collar at the mouth, the purple cord, a metal chape at the tip
SWORDS["kusanagi"]["sheath"] = [
    box((-1.0, -1.35, -27.6), (2.0, 3.2, 23.5), "sheath"),
    box((-1.15, -1.5, -5.4), (2.3, 3.5, 1.3), "dark"),
    box((-1.12, -1.48, -9.2), (2.24, 3.46, 1.2), "accent"),
    box((-1.12, -1.48, -11.0), (2.24, 3.46, 0.6), "accent"),
    box((-1.12, -1.48, -28.8), (2.24, 3.46, 1.3), "dark"),
]
SWORDS["kusanagi"]["colors"]["sheath"] = (38, 34, 46)

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
    random.seed(sum(sum(v) for k, v in colors.items() if k != "sheath"))
    for name, idx in SW.items():
        col = colors.get(name, colors["dark"])
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
GRIP_Y = 13.5  # where the vanilla trident is gripped along its pole


def held_cube(cu):
    """Design space (blade along -z from the grip, width along +y) -> trident pole space
    (blade along +y from the grip at y=13.5, width along +z, thickness along x)."""
    ox, oy, oz = (cu["origin"][i] - G[i] for i in range(3))
    sx, sy, sz = cu["size"]
    face = cu["uv"]["north"]
    return {"origin": [round(ox, 3), round(GRIP_Y - oz - sz, 3), round(oy, 3)], "size": [sx, sz, sy],
            "uv": {f: dict(face) for f in ("north", "south", "east", "west", "up", "down")}}


# ---------------------------------------------------------------------------
# How a sword is worn
# ---------------------------------------------------------------------------
# In the main hand: the trident's grip position, without its roll, tip tilted ~25° up (first person: the vanilla
# trident pose). Standing still for a moment, the blade is swung up to rest against the shoulder ("carry") until its
# owner moves again — players and sword-carrying NPCs alike.
# In the off hand it isn't held at all: it is slung across the back (or the back of the waist), drawn as a second
# copy of the model that follows the body bone. swords.js moves a sword there when you put it away.
import sys  # noqa: E402
sys.path.insert(0, str(Path(__file__).resolve().parent))
import anim_preview as _AP  # noqa: E402  (the same bone maths the game uses)

HOLD_ROT, HOLD_POS = 65.0, [0.71, 2.98, -9.6]
_PIVOT_TO_GRIP = 24 - GRIP_Y


def hold_pose(rot_x, roll=0.0):
    """Bone pose that keeps the grip in the hand with the blade at rot_x (90 = level, 0 = straight up, <0 = leaning back)."""
    c0, s0 = math.cos(math.radians(HOLD_ROT)), math.sin(math.radians(HOLD_ROT))
    grip = [HOLD_POS[0], 24 - _PIVOT_TO_GRIP * c0 + HOLD_POS[1], _PIVOT_TO_GRIP * s0 + HOLD_POS[2]]   # where the hand is
    c, s_ = math.cos(math.radians(rot_x)), math.sin(math.radians(rot_x))
    return {"position": [round(grip[0], 2), round(grip[1] - 24 + _PIVOT_TO_GRIP * c, 2), round(grip[2] - _PIVOT_TO_GRIP * s_, 2)],
            "rotation": [rot_x, 0.0, roll]}


w(RP / "animations" / "swords.animation.json", {"format_version": "1.10.0", "animations": {
    "animation.aegis.sword.hold_third_person": {"loop": True, "bones": {"sword": {"position": HOLD_POS, "rotation": [HOLD_ROT, 0.0, 0.0]}}},
    "animation.aegis.sword.hold_first_person": {"loop": True, "bones": {"sword": {
        "position": [-7.0, -3.0, -2.0], "rotation": [152.0, -9.0, 25.0]}}},
    "animation.aegis.sword.carry": {"loop": True, "bones": {"sword": hold_pose(-14.0)}},        # resting on the shoulder
    "animation.aegis.sword.settle": {"animation_length": 1.2, "bones": {"sword": {"rotation": [0, 0, 0]}}},  # stand still this long first
    # which copy shows: the one in the hand (main hand) or the one on the back (put away in the off hand)
    "animation.aegis.sword.hide_back": {"loop": True, "bones": {"back": {"scale": 0}}},
    "animation.aegis.sword.hide_hand": {"loop": True, "bones": {"sword": {"scale": 0}}},
    # a swing draws the blade: the scabbard is hidden while the arm swings
    "animation.aegis.sword.draw": {"loop": True, "bones": {"sheath": {"scale": 0}}},
}})
POSED = {"samehada", "kusanagi"}   # held in a carrying pose (player animations, see swords.js)
w(RP / "animation_controllers" / "swords.animation_controllers.json", {"format_version": "1.10.0", "animation_controllers": {
    "controller.animation.aegis.sword_carry": {"initial_state": "hold", "states": {
        "hold": {"animations": ["third"], "blend_transition": 0.15,
                 "transitions": [{"settle": "!query.is_moving && !query.is_sneaking"}]},
        "settle": {"animations": ["third", "settle"],
                   "transitions": [{"hold": "query.is_moving || query.is_sneaking"}, {"carry": "query.any_animation_finished"}]},
        "carry": {"animations": ["carry"], "blend_transition": 0.3,
                  "transitions": [{"hold": "query.is_moving || query.is_sneaking"}]}}}}})
(RP / "render_controllers" / "swords.render_controllers.json").unlink(missing_ok=True)   # replaced (see the attachable)

# Where each sword sits when it's put away: (grip position on the body, blade angle from straight up)
MOUNT_BACK = ([-5.0, 27.0, 3.6], 148)      # hilt over the right shoulder, blade down across the back
MOUNT_WAIST = ([-7.0, 13.2, 3.6], 96)      # level across the back of the waist, hilt to the right (Sasuke's Kusanagi)
MOUNTS = {"kusanagi": MOUNT_WAIST, "chakra_blades": MOUNT_WAIST, "nuibari": MOUNT_WAIST}


def back_bone(cubes, sid):
    grip, angle = MOUNTS.get(sid, MOUNT_BACK)
    # flat against the back (the thin side turned toward it), then swung to the angle — whichever way puts the tip
    # toward the wearer's left
    theta = next(t for t in (angle, -angle) if _AP.apply(_AP.rot_matrix(0, 90, t), (0, 1, 0))[0] > 0)
    moved = []
    for cu in cubes:
        c = dict(cu)
        c["origin"] = [round(cu["origin"][0] + grip[0], 3), round(cu["origin"][1] - GRIP_Y + grip[1], 3), round(cu["origin"][2] + grip[2], 3)]
        moved.append(c)
    return {"name": "back", "parent": "body", "pivot": grip, "rotation": [0, 90, theta], "cubes": moved}


atlas_path = RP / "textures" / "item_texture.json"
atlas = json.loads(atlas_path.read_text())

for sid, sd in SWORDS.items():
    cubes = sd["cubes"]
    cols = {k: tuple(v) for k, v in sd["colors"].items()}
    (RP / "textures" / "models" / "swords").mkdir(parents=True, exist_ok=True)
    icon(cubes, cols).save(RP / "textures" / "items" / "aegis" / f"{sid}.png")
    (RP / "textures" / "models" / "swords").mkdir(parents=True, exist_ok=True)
    palette(cols).save(RP / "textures" / "models" / "swords" / f"{sid}.png")
    sheath = sd.get("sheath", [])
    bones = [{"name": "sword", "pivot": [0, 24, 0], "binding": "q.item_slot_to_bone_name(c.item_slot)",
              "cubes": [held_cube(cu) for cu in cubes]}]
    if sheath:   # held sheathed; the scabbard is a bone of its own so a swing can hide it (the blade is drawn)
        bones.append({"name": "sheath", "parent": "sword", "pivot": [0, 24, 0], "cubes": [held_cube(cu) for cu in sheath]})
    bones += [{"name": "body", "pivot": [0, 24, 0]}, back_bone([held_cube(cu) for cu in cubes + sheath], sid)]
    w(RP / "models" / "entity" / f"sword_{sid}.geo.json", {"format_version": "1.16.0", "minecraft:geometry": [{
        "description": {"identifier": f"geometry.aegis.sword_{sid}", "texture_width": 64, "texture_height": 64,
                        "visible_bounds_width": 5, "visible_bounds_height": 5, "visible_bounds_offset": [0, 1.5, 0]},
        "bones": bones}]})
    posed = sid in POSED
    w(RP / "attachables" / f"sword_{sid}.json", {"format_version": "1.10.0", "minecraft:attachable": {"description": {
        "identifier": f"aegis:{sid}",
        "materials": {"default": "entity_alphatest", "enchanted": "entity_alphatest_glint"},
        "textures": {"default": f"textures/models/swords/{sid}", "enchanted": "textures/misc/enchanted_item_glint"},
        "geometry": {"default": f"geometry.aegis.sword_{sid}"},
        "animations": {"third": "animation.aegis.sword.hold_third_person", "first": "animation.aegis.sword.hold_first_person",
                       "carry": "animation.aegis.sword.carry", "settle": "animation.aegis.sword.settle",
                       "worn": "controller.animation.aegis.sword_carry",
                       "hide_back": "animation.aegis.sword.hide_back", "hide_hand": "animation.aegis.sword.hide_hand",
                       **({"draw": "animation.aegis.sword.draw"} if sheath else {})},
        # c.item_slot / c.is_first_person are read here (like the vanilla shield does), never in a render controller.
        # Samehada and the Kusanagi keep the plain grip: the player's carrying pose (swords.js) does the rest.
        "scripts": {"animate": [{("third" if posed else "worn"): "!c.is_first_person && c.item_slot == 'main_hand'"},
                                {"first": "c.is_first_person && c.item_slot == 'main_hand'"},
                                {"hide_back": "c.item_slot == 'main_hand' || c.is_first_person"},
                                {"hide_hand": "c.item_slot != 'main_hand'"},
                                *([{"draw": "c.item_slot == 'main_hand' && variable.attack_time > 0.0"}] if sheath else [])]},
        "render_controllers": ["controller.render.item_default"]}}})

    w(BP / "items" / f"{sid}.json", {"format_version": "1.21.60", "minecraft:item": {
        "description": {"identifier": f"aegis:{sid}", "menu_category": {"category": "equipment", "group": "minecraft:itemGroup.name.sword"}},
        "components": {
            "minecraft:icon": {"textures": {"default": f"aegis_{sid}"}},
            "minecraft:display_name": {"value": f"§b{sd['name']}§r\n§7{sd['owner']}"},
            "minecraft:max_stack_size": 1,
            "minecraft:hand_equipped": True,
            "minecraft:allow_off_hand": {"value": True},
            "minecraft:damage": sd["damage"],
            "minecraft:durability": {"max_durability": sd["durability"]},
            "minecraft:enchantable": {"slot": "sword", "value": 15},
            "minecraft:repairable": {"repair_items": [{"items": ["minecraft:diamond"], "repair_amount": 400}]},
            "minecraft:can_destroy_in_creative": False,
            # makes right-click a real "use" so the special fires (swords are otherwise not usable)
            "minecraft:use_modifiers": {"use_duration": 0.25, "movement_modifier": 1.0},
            "minecraft:use_animation": "none"}}})

    # No crafting since v1.46: swords come from the Weaponsmith, the Travelling Merchant and legendary drops.
    (BP / "recipes" / f"{sid}.json").unlink(missing_ok=True)
    atlas["texture_data"][f"aegis_{sid}"] = {"textures": f"textures/items/aegis/{sid}"}

w(atlas_path, atlas)
w(ROOT / "tools" / "sword_colors.json", {sid: sd["slash"] for sid, sd in SWORDS.items()})
print("Generated", len(SWORDS), "swords.")
