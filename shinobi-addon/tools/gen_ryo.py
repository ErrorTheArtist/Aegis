#!/usr/bin/env python3
"""Ryō note item (100 Ryō, auto-deposited into the wallet) and the switch from emerald drops to Ryō notes.
Run from the shinobi-addon folder:  python3 tools/gen_ryo.py
"""
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
    with open(path, "w") as f:
        json.dump(obj, f, indent=2, ensure_ascii=False)
        f.write("\n")


# --- icon: a small stack of banknotes with a gold seal -----------------------------
img = G.new()
for k, (dx, dy) in enumerate(((10, 30), (4, 20), (-2, 10))):
    G.shape(img, lambda d, dx=dx, dy=dy: d.rounded_rectangle([18 + dx, 30 + dy, 110 + dx, 82 + dy], radius=6, fill=255),
            (225, 210, 160) if k < 2 else (240, 228, 185), (175, 150, 95))
d = ImageDraw.Draw(img)
d.rounded_rectangle([22, 46, 104, 86], radius=4, outline=(140, 110, 60, 255), width=3)
lay = G.new()
G.shape(lay, lambda d: d.ellipse([46, 50, 80, 84], fill=255), (255, 215, 80), (200, 130, 20), "radial", center=(58, 62), radius=22)
ImageDraw.Draw(lay).rectangle([60, 60, 66, 74], fill=(150, 90, 20, 255))
G.glow(img, lay, (255, 210, 80), 4, 1.2)
for x in (30, 90):
    d.line([x, 54, x, 78], fill=(160, 60, 40, 255), width=4)
G.finish(img, "ryo")

w(BP / "items" / "ryo.json", {"format_version": "1.21.60", "minecraft:item": {
    "description": {"identifier": "aegis:ryo", "menu_category": {"category": "items"}},
    "components": {"minecraft:icon": {"textures": {"default": "aegis_ryo"}},
                   "minecraft:display_name": {"value": "Ryō Note (100 Ryō)"}, "minecraft:max_stack_size": 64}}})
atlas_p = RP / "textures" / "item_texture.json"
atlas = json.loads(atlas_p.read_text())
atlas["texture_data"]["aegis_ryo"] = {"textures": "textures/items/aegis/ryo"}
w(atlas_p, atlas)

# --- enemies drop Ryō notes instead of emeralds -------------------------------------
n = 0
for p in (BP / "loot_tables" / "entities").glob("*.json"):
    txt = p.read_text()
    if '"minecraft:emerald"' in txt:
        n += txt.count('"minecraft:emerald"')
        p.write_text(txt.replace('"minecraft:emerald"', '"aegis:ryo"'))
print("Ryō generated; replaced", n, "emerald drops.")
