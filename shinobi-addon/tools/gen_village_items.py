#!/usr/bin/env python3
"""Village quest rewards: the Sand Gourd (Hidden Sand). Run from the shinobi-addon folder:  python3 tools/gen_village_items.py"""
import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from PIL import ImageDraw  # noqa: E402
import gen_icons as G  # noqa: E402

ROOT = Path(__file__).resolve().parent.parent
BP, RP = ROOT / "behavior_pack", ROOT / "resource_pack"


def w(path, obj):
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(obj, indent=2, ensure_ascii=False) + "\n")


def gourd():
    img = G.new()
    sand_hi, sand_lo = (236, 206, 150), (160, 118, 70)
    # drifting sand behind
    lay = G.new()
    d = ImageDraw.Draw(lay)
    for x, y, r in ((24, 100, 4), (104, 96, 5), (18, 70, 3), (110, 60, 3), (30, 40, 2)):
        d.ellipse([x - r, y - r, x + r, y + r], fill=(220, 190, 130, 200))
    img.alpha_composite(lay)
    # body: big lower bulb, small upper bulb, waist
    G.shape(img, lambda d: d.ellipse([22, 50, 106, 122], fill=255), sand_hi, sand_lo, "radial", center=(52, 70), radius=70)
    G.shape(img, lambda d: d.ellipse([40, 20, 88, 62], fill=255), sand_hi, sand_lo, "radial", center=(56, 30), radius=46)
    G.shape(img, lambda d: d.rectangle([52, 50, 76, 62], fill=255), (196, 158, 104))
    # cork + strap
    G.shape(img, lambda d: d.rectangle([56, 8, 72, 22], fill=255), (150, 100, 60), (100, 64, 36))
    d = ImageDraw.Draw(img)
    d.line([(26, 72), (100, 112)], fill=(150, 40, 35, 255), width=7)
    d.line([(26, 72), (100, 112)], fill=(190, 60, 50, 255), width=3)
    # the kanji-like seal (love) as a red mark
    d.rectangle([66, 78, 86, 96], outline=(170, 40, 35, 255), width=3)
    d.line([(70, 87), (82, 87)], fill=(170, 40, 35, 255), width=3)
    # outline
    d.ellipse([22, 50, 106, 122], outline=(90, 60, 30, 255), width=3)
    d.ellipse([40, 20, 88, 62], outline=(90, 60, 30, 255), width=3)
    G.finish(img, "sand_gourd")


gourd()
w(BP / "items" / "sand_gourd.json", {"format_version": "1.21.60", "minecraft:item": {
    "description": {"identifier": "aegis:sand_gourd", "menu_category": {"category": "equipment"}},
    "components": {"minecraft:icon": {"textures": {"default": "aegis_sand_gourd"}},
                   "minecraft:display_name": {"value": "§6Sand Gourd §7(right-click: Sand Coffin · sneak: Sand Shield)"},
                   "minecraft:max_stack_size": 1}}})
atlas_p = RP / "textures" / "item_texture.json"
atlas = json.loads(atlas_p.read_text())
atlas["texture_data"]["aegis_sand_gourd"] = {"textures": "textures/items/aegis/sand_gourd"}
w(atlas_p, atlas)
print("Sand Gourd generated.")
