#!/usr/bin/env python3
"""Fun & games (v1.63): the Mystery Scroll, Contest Ramen, the Thousand Years of Death scroll (items + icons) and the
Treasure Toad (the summoned toad's model, gilded and shrunk, with its own behaviour: it runs from players).
Logic lives in behavior_pack/scripts/fun.js.  Run from the shinobi-addon folder:  python3 tools/gen_fun.py
"""
import json
import math
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from PIL import Image, ImageDraw, ImageFont  # noqa: E402
import gen_icons as G  # noqa: E402

ROOT = Path(__file__).resolve().parent.parent
BP, RP = ROOT / "behavior_pack", ROOT / "resource_pack"
FONT = "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf"


def w(path, obj):
    path.parent.mkdir(parents=True, exist_ok=True)
    with open(path, "w") as f:
        json.dump(obj, f, indent=2, ensure_ascii=False)
        f.write("\n")


def text_layer(txt, size, col, xy):
    lay = G.new()
    d = ImageDraw.Draw(lay)
    try:
        font = ImageFont.truetype(FONT, size)
    except OSError:
        font = ImageFont.load_default()
    d.text(xy, txt, fill=col + (255,), font=font, anchor="mm", stroke_width=3, stroke_fill=(40, 16, 50, 255))
    return lay


# ---------------------------------------------------------------------------
# Icons
# ---------------------------------------------------------------------------
def mystery():                                  # a purple scroll with a glowing golden "?"
    img = G.scroll("purple", paper=((236, 220, 250), (180, 150, 215)))
    G.glow(img, text_layer("?", 70, (255, 214, 90), (64, 66)), (255, 200, 80), 6, 1.8)
    return img


def thousand_years():                           # the prank: two fingers, a pink burst and "!!"
    img = G.scroll("red")

    def burst(l, d):
        pts = []
        for i in range(24):
            a = i / 24 * math.pi * 2
            r = 34 if i % 2 == 0 else 20
            pts.append((64 + math.cos(a) * r, 64 + math.sin(a) * r))
        d.polygon(pts, fill=(255, 140, 200, 255))
    lay = G.new()
    burst(lay, ImageDraw.Draw(lay))
    G.glow(img, lay, (255, 120, 190), 5, 1.4)
    img.alpha_composite(text_layer("!!", 44, (255, 255, 255), (64, 66)))
    return img


# ---------------------------------------------------------------------------
# Items
# ---------------------------------------------------------------------------
atlas_p = RP / "textures" / "item_texture.json"
atlas = json.loads(atlas_p.read_text())

G.finish(mystery(), "mystery_scroll")
atlas["texture_data"]["aegis_mystery_scroll"] = {"textures": "textures/items/aegis/mystery_scroll"}
w(BP / "items" / "mystery_scroll.json", {"format_version": "1.21.60", "minecraft:item": {
    "description": {"identifier": "aegis:mystery_scroll", "menu_category": {"category": "equipment"}},
    "components": {"minecraft:icon": {"textures": {"default": "aegis_mystery_scroll"}},
                   "minecraft:display_name": {"value": "§dMystery Scroll§r\n§7Right-click to unroll it: a random prize"},
                   "minecraft:max_stack_size": 16, "minecraft:glint": True}}})

G.finish(thousand_years(), "thousand_years_scroll")
atlas["texture_data"]["aegis_thousand_years_scroll"] = {"textures": "textures/items/aegis/thousand_years_scroll"}
w(BP / "items" / "thousand_years_scroll.json", {"format_version": "1.21.60", "minecraft:item": {
    "description": {"identifier": "aegis:thousand_years_scroll", "menu_category": {"category": "equipment"}},
    "components": {"minecraft:icon": {"textures": {"default": "aegis_thousand_years_scroll"}},
                   "minecraft:display_name": {"value": "Jutsu Scroll: A Thousand Years of Death§r\n§7Get behind them… and poke"},
                   "minecraft:max_stack_size": 1, "minecraft:glint": True}}})

# Contest Ramen: the Ichiraku bowl's icon; quick to eat, always edible, no buffs, no bowls left over
w(BP / "items" / "contest_ramen.json", {"format_version": "1.21.60", "minecraft:item": {
    "description": {"identifier": "aegis:contest_ramen", "menu_category": {"category": "none"}},
    "components": {"minecraft:icon": {"textures": {"default": "aegis_ramen"}},
                   "minecraft:display_name": {"value": "§eContest Ramen§r\n§7Eat! Eat! Only counts during the contest"},
                   "minecraft:max_stack_size": 64,
                   "minecraft:food": {"nutrition": 1, "saturation_modifier": 0.1, "can_always_eat": True},
                   "minecraft:use_animation": "eat",
                   "minecraft:use_modifiers": {"use_duration": 0.9, "movement_modifier": 0.6}}}})
w(atlas_p, atlas)

# ---------------------------------------------------------------------------
# The Treasure Toad
# ---------------------------------------------------------------------------
src = Image.open(RP / "textures" / "entity" / "aegis" / "summon_toad.png").convert("RGBA")
gold = Image.new("RGBA", src.size)
lo, hi = (120, 78, 14), (255, 236, 130)
for x in range(src.width):
    for y in range(src.height):
        r, g, b, a = src.getpixel((x, y))
        if not a:
            continue
        lum = (0.3 * r + 0.59 * g + 0.11 * b) / 255
        if lum < 0.17:                              # the dark parts (mouth, pupils) stay dark
            gold.putpixel((x, y), (64, 40, 10, a))
            continue
        t = min(1.0, 0.15 + lum * 1.1)
        gold.putpixel((x, y), tuple(int(lo[i] + (hi[i] - lo[i]) * t) for i in range(3)) + (a,))
gold.save(RP / "textures" / "entity" / "aegis" / "treasure_toad.png")

w(RP / "entity" / "treasure_toad.entity.json", {"format_version": "1.10.0", "minecraft:client_entity": {"description": {
    "identifier": "aegis:treasure_toad", "materials": {"default": "entity_alphatest"},
    "textures": {"default": "textures/entity/aegis/treasure_toad"}, "geometry": {"default": "geometry.aegis.summon_toad"},
    "animations": {"idle": "animation.aegis.summon_toad.idle"}, "scripts": {"animate": ["idle"]},
    "render_controllers": ["controller.render.default"], "spawn_egg": {"base_color": "#f0c040", "overlay_color": "#8a5a10"}}}})

w(BP / "entities" / "treasure_toad.json", {"format_version": "1.21.0", "minecraft:entity": {
    "description": {"identifier": "aegis:treasure_toad", "is_spawnable": True, "is_summonable": True, "is_experimental": False},
    "component_groups": {"aegis:escape": {"minecraft:instant_despawn": {}}},
    "components": {
        "minecraft:type_family": {"family": ["treasure_toad", "mob"]},
        "minecraft:scale": {"value": 0.6},
        "minecraft:collision_box": {"width": 0.9, "height": 0.9},
        "minecraft:health": {"value": 30, "max": 30},
        "minecraft:movement": {"value": 0.3},
        "minecraft:movement.basic": {},
        "minecraft:jump.static": {},
        "minecraft:navigation.walk": {"can_path_over_water": True, "avoid_damage_blocks": True},
        "minecraft:physics": {},
        "minecraft:pushable": {"is_pushable": True, "is_pushable_by_piston": True},
        "minecraft:knockback_resistance": {"value": 0.3},
        "minecraft:damage_sensor": {"triggers": [{"cause": "fall", "deals_damage": "no"}]},
        "minecraft:nameable": {},
        "minecraft:timer": {"time": 60, "looping": False, "time_down_event": {"event": "aegis:escape", "target": "self"}},
        "minecraft:behavior.float": {"priority": 0},
        "minecraft:behavior.panic": {"priority": 1, "speed_multiplier": 1.7},
        "minecraft:behavior.avoid_mob_type": {"priority": 2, "entity_types": [
            {"filters": {"test": "is_family", "subject": "other", "value": "player"}, "max_dist": 10, "walk_speed_multiplier": 1.3, "sprint_speed_multiplier": 1.7}]},
        "minecraft:behavior.random_stroll": {"priority": 6, "speed_multiplier": 1.1},
        "minecraft:behavior.look_at_player": {"priority": 7, "look_distance": 8}},
    "events": {"aegis:escape": {"add": {"component_groups": ["aegis:escape"]}}}}})

# names (the spawn egg too)
lang_p = RP / "texts" / "en_US.lang"
lang = lang_p.read_text()
add = ["entity.aegis:treasure_toad.name=Treasure Toad", "item.spawn_egg.entity.aegis:treasure_toad.name=Spawn Treasure Toad"]
missing = [line for line in add if line not in lang.splitlines()]
if missing:
    lang_p.write_text(lang.rstrip("\n") + "\n" + "\n".join(missing) + "\n")
print("Fun & games: Mystery Scroll, Contest Ramen, A Thousand Years of Death, the Treasure Toad.")
