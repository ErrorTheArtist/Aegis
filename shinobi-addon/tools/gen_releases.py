#!/usr/bin/env python3
"""Items and icons for the kekkei genkai releases (clan-bound scrolls) and the Yuki / Terumi / Hōzuki clan items.
Clan-bound scrolls are not craftable: the Clan Elder of that clan sells them to its members.
Run from the shinobi-addon folder:  python3 tools/gen_releases.py
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


# ---------------------------------------------------------------------------
# Emblems
# ---------------------------------------------------------------------------
def emblem_forest(img):
    lay = G.new()
    for x, h in ((38, 46), (64, 60), (90, 42)):
        G.shape(lay, lambda d, x=x, h=h: d.rectangle([x - 5, 100 - h, x + 5, 100], fill=255), (150, 100, 55), (90, 55, 25))
        G.shape(lay, lambda d, x=x, h=h: d.ellipse([x - 16, 100 - h - 22, x + 16, 100 - h + 8], fill=255), (110, 200, 90), (40, 120, 40))
    d = ImageDraw.Draw(lay)
    for x in (30, 52, 76, 98):
        d.line([x, 100, x - 6, 108], fill=(90, 55, 25, 255), width=3)
    G.glow(img, lay, (110, 220, 90), 4, 1.2)


def serpent(img, body, light, glowc, head_fill):
    lay = G.new()
    d = ImageDraw.Draw(lay)
    pts = [(24 + t * 1.5, 70 + math.sin(t / 9) * 18 - t * 0.25) for t in range(48)]
    d.line(pts, fill=body + (255,), width=16, joint="curve")
    d.line(pts, fill=light + (255,), width=5, joint="curve")
    hx, hy = pts[-1]
    d.ellipse([hx - 12, hy - 12, hx + 14, hy + 10], fill=head_fill + (255,))
    d.polygon([(hx + 10, hy - 4), (hx + 24, hy - 2), (hx + 12, hy + 6)], fill=head_fill + (255,))
    d.polygon([(hx - 6, hy - 10), (hx - 14, hy - 22), (hx, hy - 12)], fill=light + (255,))
    d.ellipse([hx + 2, hy - 6, hx + 7, hy - 1], fill=(255, 230, 60, 255))
    G.glow(img, lay, glowc, 5, 1.6)


def emblem_wood_dragon(img):
    serpent(img, (140, 95, 50), (190, 150, 90), (120, 200, 90), (120, 80, 40))


def emblem_ice_dragon(img):
    serpent(img, (60, 110, 200), (200, 235, 255), (150, 215, 255), (40, 80, 170))


def black_flame(img, cx, cy, s):
    lay = G.new()
    G.shape(lay, lambda d: d.polygon(G.flame_poly(cx, cy, s), fill=255), (40, 20, 50), (5, 0, 10))
    G.shape(lay, lambda d: d.polygon(G.flame_poly(cx, cy + s * 0.25, s * 0.5), fill=255), (120, 40, 160), (30, 5, 40))
    G.glow(img, lay, (150, 40, 200), 6, 1.8)


def emblem_blaze_spears(img):
    lay = G.new()
    d = ImageDraw.Draw(lay)
    for i, x in enumerate((40, 64, 88)):
        d.line([x - 10, 100, x + 6, 30], fill=(20, 10, 25, 255), width=7)
        d.polygon([(x + 6, 20), (x + 14, 38), (x - 2, 36)], fill=(120, 40, 160, 255))
    G.glow(img, lay, (150, 40, 200), 6, 2)
    black_flame(img, 64, 92, 14)


def emblem_blaze_barrier(img):
    for i in range(8):
        a = i / 8 * math.pi * 2
        black_flame(img, 64 + math.cos(a) * 32, 66 + math.sin(a) * 32, 11)


def emblem_lava(img):
    lay = G.new()
    for x, y, r in ((40, 52, 14), (78, 44, 16), (60, 82, 18)):
        G.shape(lay, lambda d, x=x, y=y, r=r: d.ellipse([x - r, y - r, x + r, y + r], fill=255), (255, 200, 60), (210, 50, 10), "radial", center=(x - 4, y - 4), radius=r + 4)
        G.shape(lay, lambda d, x=x, y=y, r=r: d.polygon([(x - 4, y + r - 2), (x + 4, y + r - 2), (x, y + r + 12)], fill=255), (255, 120, 20), (200, 40, 10))
    G.glow(img, lay, (255, 100, 20), 7, 2)


def emblem_boil(img):
    lay = G.new()
    d = ImageDraw.Draw(lay)
    for x, y, r in ((40, 44, 13), (56, 34, 15), (76, 38, 13), (88, 52, 11)):
        d.ellipse([x - r, y - r, x + r, y + r], fill=(235, 240, 235, 255))
    G.shape(lay, lambda d: d.rounded_rectangle([42, 62, 86, 100], radius=10, fill=255), (240, 200, 160), (190, 130, 90))
    d = ImageDraw.Draw(lay)
    for x in (52, 62, 72):
        d.line([x, 64, x, 76], fill=(160, 100, 70, 255), width=3)
    G.glow(img, lay, (220, 230, 220), 5, 1.4)


def emblem_mirrors(img):
    lay = G.new()
    for i in range(6):
        a = i / 6 * math.pi * 2
        cx, cy = 64 + math.cos(a) * 32, 64 + math.sin(a) * 32
        G.shape(lay, lambda d, cx=cx, cy=cy: d.rectangle([cx - 7, cy - 11, cx + 7, cy + 11], fill=255), (230, 248, 255), (130, 190, 240))
    d = ImageDraw.Draw(lay)
    for i in range(6):
        a = i / 6 * math.pi * 2
        d.line([64, 64, 64 + math.cos(a) * 18, 64 + math.sin(a) * 18], fill=(200, 235, 255, 255), width=4)
    G.glow(img, lay, (150, 215, 255), 6, 2)


def emblem_drop(img):
    lay = G.new()
    G.shape(lay, lambda d: d.polygon([(64, 24)] + [(64 + math.cos(t) * 26, 74 + math.sin(t) * 26) for t in [i / 30 * math.pi for i in range(31)]], fill=255),
            (150, 210, 255), (30, 90, 200), "radial", center=(56, 66), radius=40)
    d = ImageDraw.Draw(lay)
    d.arc([46, 56, 70, 90], 120, 220, fill=(240, 250, 255, 255), width=4)
    G.glow(img, lay, (60, 150, 255), 6, 1.8)


# ---------------------------------------------------------------------------
# Items
# ---------------------------------------------------------------------------
RELEASES = {
    # id: (display name, rod, emblem)
    "wood_forest_scroll": ("Wood Release: Deep Forest Emergence (Senju)", "gold", emblem_forest),
    "wood_dragon_scroll": ("Wood Release: Wood Dragon (Senju)", "gold", emblem_wood_dragon),
    "blaze_spears_scroll": ("Blaze Release: Kagutsuchi Spears (Uchiha)", "black", emblem_blaze_spears),
    "blaze_barrier_scroll": ("Blaze Release: Black Flame Barrier (Uchiha)", "black", emblem_blaze_barrier),
    "ice_needles_scroll": ("Ice Release: Thousand Needles of Death (Yuki)", "blue", G.emblem_ice_needles),
    "ice_dragon_scroll": ("Ice Release: Black Dragon Blizzard (Yuki)", "blue", emblem_ice_dragon),
    "lava_globs_scroll": ("Lava Release: Lava Globs (Terumi)", "red", emblem_lava),
    "boil_strength_scroll": ("Boil Release: Unrivalled Strength (Terumi)", "red", emblem_boil),
}
CLAN_ITEMS = {
    "ice_mirrors": ("Ice Release Scroll (Yuki)", "gold", emblem_mirrors),
    "lava_boil": ("Lava & Boil Release Scroll (Terumi)", "gold", emblem_lava),
    "hydrification": ("Hydrification Scroll (Hōzuki)", "gold", emblem_drop),
}

atlas_p = RP / "textures" / "item_texture.json"
atlas = json.loads(atlas_p.read_text())
for sid, (name, rod, emblem) in {**RELEASES, **CLAN_ITEMS}.items():
    G.make_scroll(sid, rod, emblem)
    w(BP / "items" / f"{sid}.json", {"format_version": "1.21.60", "minecraft:item": {
        "description": {"identifier": f"aegis:{sid}", "menu_category": {"category": "equipment"}},
        "components": {"minecraft:icon": {"textures": {"default": f"aegis_{sid}"}}, "minecraft:display_name": {"value": name},
                       "minecraft:max_stack_size": 1, "minecraft:glint": True}}})
    atlas["texture_data"][f"aegis_{sid}"] = {"textures": f"textures/items/aegis/{sid}"}
w(atlas_p, atlas)

# Thousand Needles of Death became a Yuki-only Ice Release: no crafting recipe any more.
(BP / "recipes" / "ice_needles_scroll.json").unlink(missing_ok=True)
print("Releases generated:", len(RELEASES), "scrolls,", len(CLAN_ITEMS), "clan items.")
