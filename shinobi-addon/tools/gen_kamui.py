#!/usr/bin/env python3
"""Kamui eye item (only one player can hold it — claimed by whoever first defeats Tobi).
Run from the shinobi-addon folder:  python3 tools/gen_kamui.py
"""
import json
import math
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


# --- icon: a red eye with Obito's three curved blades, wrapped in a purple space-time swirl ---
img = G.new()
almond = lambda d: d.polygon([(4 + i, 64 - math.sin(i / 120 * math.pi) * 40) for i in range(121)] +
                             [(124 - i, 64 + math.sin(i / 120 * math.pi) * 34) for i in range(121)], fill=255)
G.shape(img, almond, (250, 248, 245), (205, 200, 210), "radial", center=(64, 60), radius=62)
iris = G.new()
G.shape(iris, lambda d: d.ellipse([30, 28, 98, 96], fill=255), (235, 35, 35), (110, 0, 0), "radial", center=(56, 54), radius=38)
d = ImageDraw.Draw(iris)
for k in range(3):
    base = k * 2 * math.pi / 3
    pts = []
    for s in range(26):
        u = s / 25
        a = base + u * 2.2
        r = 6 + u * 26
        pts.append((64 + math.cos(a) * r, 62 + math.sin(a) * r))
    d.line(pts, fill=(10, 8, 12, 255), width=7, joint="curve")
d.ellipse([56, 54, 72, 70], fill=(10, 8, 12, 255))
img.alpha_composite(iris)
swirl = G.new()
sd = ImageDraw.Draw(swirl)
for k in range(2):
    pts = [(64 + math.cos(k * math.pi + t / 20) * (54 - t * 0.35), 62 + math.sin(k * math.pi + t / 20) * (44 - t * 0.28)) for t in range(70)]
    sd.line(pts, fill=(170, 90, 230, 255), width=4, joint="curve")
G.glow(img, swirl, (150, 70, 220), 5, 1.4)
G.finish(img, "kamui")

w(BP / "items" / "kamui.json", {"format_version": "1.21.60", "minecraft:item": {
    "description": {"identifier": "aegis:kamui", "menu_category": {"category": "equipment"}},
    "components": {"minecraft:icon": {"textures": {"default": "aegis_kamui"}},
                   "minecraft:display_name": {"value": "§5Kamui §7(right-click: Warp · sneak: Phase)"},
                   "minecraft:max_stack_size": 1, "minecraft:glint": True}}})
atlas_p = RP / "textures" / "item_texture.json"
atlas = json.loads(atlas_p.read_text())
atlas["texture_data"]["aegis_kamui"] = {"textures": "textures/items/aegis/kamui"}
w(atlas_p, atlas)
print("Kamui item generated.")
