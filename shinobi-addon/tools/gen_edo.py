#!/usr/bin/env python3
"""Reanimation Jutsu: Edo Tensei scroll (forbidden jutsu). Run from the shinobi-addon folder:  python3 tools/gen_edo.py"""
import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from PIL import ImageDraw  # noqa: E402
import gen_icons as G  # noqa: E402

ROOT = Path(__file__).resolve().parent.parent
BP, RP = ROOT / "behavior_pack", ROOT / "resource_pack"


def emblem_coffin(img):
    lay = G.new()
    G.shape(lay, lambda d: d.polygon([(52, 22), (76, 22), (88, 44), (80, 106), (48, 106), (40, 44)], fill=255), (120, 85, 55), (60, 38, 22))
    d = ImageDraw.Draw(lay)
    d.polygon([(52, 22), (76, 22), (88, 44), (80, 106), (48, 106), (40, 44)], outline=(30, 18, 10, 255), width=3)
    d.rectangle([60, 44, 68, 84], fill=(215, 205, 180, 255))      # the talisman on the lid
    d.line([60, 52, 68, 52], fill=(140, 20, 20, 255), width=2)
    d.line([60, 62, 68, 62], fill=(140, 20, 20, 255), width=2)
    d.line([60, 72, 68, 72], fill=(140, 20, 20, 255), width=2)
    img.alpha_composite(lay)
    for x, y in ((30, 96), (98, 92), (36, 30), (96, 28)):
        ImageDraw.Draw(img).ellipse([x - 3, y - 3, x + 3, y + 3], fill=(170, 160, 150, 255))


def w(path, obj):
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(obj, indent=2, ensure_ascii=False) + "\n")


G.make_scroll("edo_tensei_scroll", "black", emblem_coffin, paper=((70, 62, 58), (36, 30, 28)))
w(BP / "items" / "edo_tensei_scroll.json", {"format_version": "1.21.60", "minecraft:item": {
    "description": {"identifier": "aegis:edo_tensei_scroll", "menu_category": {"category": "equipment"}},
    "components": {"minecraft:icon": {"textures": {"default": "aegis_edo_tensei_scroll"}},
                   "minecraft:display_name": {"value": "§8Forbidden Scroll: §fReanimation Jutsu (Edo Tensei)"},
                   "minecraft:max_stack_size": 1, "minecraft:glint": True}}})
atlas_p = RP / "textures" / "item_texture.json"
atlas = json.loads(atlas_p.read_text())
atlas["texture_data"]["aegis_edo_tensei_scroll"] = {"textures": "textures/items/aegis/edo_tensei_scroll"}
w(atlas_p, atlas)
print("Edo Tensei scroll generated.")
