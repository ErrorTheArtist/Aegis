#!/usr/bin/env python3
"""XP Shard item (v1.52): a glowing crystal of chakra dropped by bosses — right-click to absorb its XP
(behavior_pack/scripts/xpshards.js). Run from anywhere:  python3 tools/gen_xp_shard.py
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


# --- icon: a cluster of three faceted crystals, teal-green, glowing ------------------------------------------------
LIGHT, MID, DARK, EDGE = (200, 255, 236), (90, 222, 190), (34, 140, 128), (16, 70, 74)


def crystal(img, cx, base, h, wdt, tilt):
    """One crystal: a tall six-sided point, its left facets lit, the right ones in shadow."""
    top = (cx + tilt, base - h)
    left = [(cx - wdt, base - h * 0.32), (cx - wdt * 0.55, base), (cx, base + wdt * 0.15), (cx, base - h * 0.4), top]
    right = [(cx, base - h * 0.4), (cx, base + wdt * 0.15), (cx + wdt * 0.55, base), (cx + wdt, base - h * 0.32), top]
    G.shape(img, lambda d: d.polygon(left, fill=255), LIGHT, MID)
    G.shape(img, lambda d: d.polygon(right, fill=255), MID, DARK)
    d = ImageDraw.Draw(img)
    d.line(left + [left[0]], fill=EDGE + (255,), width=3)
    d.line(right + [right[0]], fill=EDGE + (255,), width=3)
    d.line([top, (cx, base - h * 0.4)], fill=(240, 255, 250, 255), width=2)


layer = G.new()
crystal(layer, 40, 112, 58, 16, -6)
crystal(layer, 90, 112, 64, 17, 6)
crystal(layer, 64, 116, 98, 22, 0)
img = G.new()
G.glow(img, layer, (120, 255, 210), 7, 1.4)
d = ImageDraw.Draw(img)
for x, y, r in ((22, 30, 4), (104, 24, 3), (110, 62, 2), (16, 70, 2)):   # sparkles
    d.line([x - r * 2, y, x + r * 2, y], fill=(230, 255, 245, 255), width=2)
    d.line([x, y - r * 2, x, y + r * 2], fill=(230, 255, 245, 255), width=2)
G.finish(img, "xp_shard")

w(BP / "items" / "xp_shard.json", {"format_version": "1.21.60", "minecraft:item": {
    "description": {"identifier": "aegis:xp_shard", "menu_category": {"category": "items"}},
    "components": {"minecraft:icon": {"textures": {"default": "aegis_xp_shard"}},
                   "minecraft:display_name": {"value": "XP Shard"},
                   "minecraft:max_stack_size": 64, "minecraft:glint": True}}})
atlas_p = RP / "textures" / "item_texture.json"
atlas = json.loads(atlas_p.read_text())
atlas["texture_data"]["aegis_xp_shard"] = {"textures": "textures/items/aegis/xp_shard"}
w(atlas_p, atlas)
print("XP Shard generated.")
