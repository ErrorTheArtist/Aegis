#!/usr/bin/env python3
"""Title gear (v1.54): the creative-only scrolls and eyes of the Pain, Itachi, Tobi, Sasuke and Naruto titles
(behavior_pack/scripts/titles.js) — items and hand-drawn icons. The weapons are made by gen_swords.py, Tobi's mask
and the Orange Sage Coat by gen_armor.py (their icons are drawn here).  Run:  python3 tools/gen_titles.py
"""
import json
import math
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from PIL import Image, ImageDraw  # noqa: E402
import gen_icons as G  # noqa: E402

ROOT = Path(__file__).resolve().parent.parent
BP, RP = ROOT / "behavior_pack", ROOT / "resource_pack"


def w(path, obj):
    path.parent.mkdir(parents=True, exist_ok=True)
    with open(path, "w") as f:
        json.dump(obj, f, indent=2, ensure_ascii=False)
        f.write("\n")


def layer(fn):
    lay = G.new()
    fn(lay, ImageDraw.Draw(lay))
    return lay


def ripples(img, col=(170, 110, 240)):        # Shinra Tensei: a shockwave of rings
    lay = layer(lambda l, d: [d.ellipse([64 - r, 64 - r, 64 + r, 64 + r], outline=col + (255,), width=4) for r in (8, 17, 26, 35)])
    G.glow(img, lay, col, 5, 1.5)


def sphere(img, rock=True):                    # Chibaku Tensei: a black sphere wrapped in rock
    G.shape(img, lambda d: d.ellipse([30, 30, 98, 98], fill=255), (90, 70, 110), (20, 14, 26), "radial", center=(52, 52), radius=50)
    d = ImageDraw.Draw(img)
    if rock:
        for x, y, s in ((36, 44, 9), (78, 40, 11), (86, 76, 9), (44, 84, 10), (62, 92, 7), (28, 66, 7)):
            d.polygon([(x - s, y), (x - s * 0.3, y - s), (x + s, y - s * 0.4), (x + s * 0.6, y + s)], fill=(110, 96, 84, 255))


def red_moon(img):                             # Tsukuyomi: a red moon with the Sharingan's tomoe
    G.shape(img, lambda d: d.ellipse([28, 28, 100, 100], fill=255), (240, 50, 50), (120, 0, 0), "radial", center=(56, 54), radius=48)
    d = ImageDraw.Draw(img)
    for k in range(3):
        a = k * math.pi * 2 / 3 - math.pi / 2
        cx, cy = 64 + math.cos(a) * 20, 64 + math.sin(a) * 20
        d.ellipse([cx - 6, cy - 6, cx + 6, cy + 6], fill=(20, 8, 8, 255))
    d.ellipse([58, 58, 70, 70], fill=(20, 8, 8, 255))


def flame(img, outer, inner, glow, s=36):
    lay = G.new()
    G.shape(lay, lambda d: d.polygon(G.flame_poly(64, 62, s), fill=255), outer, tuple(int(c * 0.45) for c in outer))
    G.shape(lay, lambda d: d.polygon(G.flame_poly(64, 62 + s * 0.25, s * 0.55), fill=255), inner, outer)
    G.glow(img, lay, glow, 6, 1.6)


def black_flame(img):                          # Amaterasu: black flames with a red edge
    flame(img, (36, 26, 40), (90, 40, 70), (200, 30, 40))


def chakra_flame(img, col):                    # Susanoo (purple) / Perfect Susanoo (blue)
    flame(img, col, tuple(min(255, c + 100) for c in col), col)


def kamui(img):                                 # Kamui Shuriken: a purple spiral round a shuriken
    G.emblem_spiral(img, color=(150, 80, 230), light=(230, 200, 255))
    d = ImageDraw.Draw(img)
    for k in range(4):
        a = k * math.pi / 2
        d.polygon([(64, 64), (64 + math.cos(a - 0.35) * 10, 64 + math.sin(a - 0.35) * 10), (64 + math.cos(a) * 28, 64 + math.sin(a) * 28),
                   (64 + math.cos(a + 0.35) * 10, 64 + math.sin(a + 0.35) * 10)], fill=(60, 60, 70, 255))
    d.ellipse([60, 60, 68, 68], fill=(200, 200, 210, 255))


def arrow(img):                                 # Indra's Arrow: a lightning arrow
    lay = layer(lambda l, d: (d.line([(26, 100), (92, 34)], fill=(200, 160, 255, 255), width=7),
                               d.polygon([(100, 26), (78, 32), (94, 48)], fill=(230, 210, 255, 255)),
                               d.line([(40, 64), (52, 74), (46, 84), (60, 92)], fill=(160, 200, 255, 255), width=4),
                               d.line([(62, 42), (74, 52), (68, 60), (82, 66)], fill=(160, 200, 255, 255), width=4)))
    G.glow(img, lay, (170, 110, 255), 6, 1.6)


def lightning_ring(img):                        # Chidori Nagashi
    def draw(l, d):
        pts = []
        for i in range(25):
            a = i / 24 * math.pi * 2
            r = 30 + (6 if i % 2 else -4)
            pts.append((64 + math.cos(a) * r, 64 + math.sin(a) * r))
        d.line(pts, fill=(170, 220, 255, 255), width=4)
        d.ellipse([52, 52, 76, 76], fill=(220, 240, 255, 255))
    G.glow(img, layer(draw), (120, 190, 255), 6, 1.6)


def rasenshuriken(img):                         # Rasenshuriken V2
    def draw(l, d):
        for k in range(4):
            a = k * math.pi / 2 + 0.4
            d.polygon([(64, 64), (64 + math.cos(a - 0.5) * 14, 64 + math.sin(a - 0.5) * 14), (64 + math.cos(a) * 42, 64 + math.sin(a) * 42),
                       (64 + math.cos(a + 0.2) * 14, 64 + math.sin(a + 0.2) * 14)], fill=(200, 235, 255, 230))
        d.ellipse([46, 46, 82, 82], fill=(120, 190, 255, 255))
        d.ellipse([56, 56, 72, 72], fill=(240, 250, 255, 255))
    G.glow(img, layer(draw), (120, 200, 255), 6, 1.5)


def beast_bomb(img):                            # Tailed Beast Bomb V2
    G.shape(img, lambda d: d.ellipse([30, 30, 98, 98], fill=255), (110, 50, 140), (20, 10, 30), "radial", center=(54, 52), radius=50)
    lay = layer(lambda l, d: d.ellipse([28, 28, 100, 100], outline=(255, 140, 40, 255), width=4))
    G.glow(img, lay, (255, 140, 40), 6, 1.4)


def six_paths(img):                             # Six Paths Sage Mode: a golden ring of truth-seeking orbs
    def draw(l, d):
        d.ellipse([30, 30, 98, 98], outline=(255, 210, 90, 255), width=5)
        for k in range(9):
            a = k / 9 * math.pi * 2 - math.pi / 2
            cx, cy = 64 + math.cos(a) * 34, 64 + math.sin(a) * 34
            d.ellipse([cx - 6, cy - 6, cx + 6, cy + 6], fill=(20, 16, 20, 255))
        d.ellipse([54, 54, 74, 74], fill=(255, 230, 140, 255))
    G.glow(img, layer(draw), (255, 200, 80), 6, 1.4)


# id → (display name, title, rod colour, emblem)
SCROLLS = {
    "adv_shinra_tensei_scroll": ("Advanced Shinra Tensei", "Pain", "purple", ripples),
    "adv_chibaku_tensei_scroll": ("Advanced Chibaku Tensei", "Pain", "purple", sphere),
    "tsukuyomi_scroll": ("Tsukuyomi", "Itachi of the Sharingan", "red", red_moon),
    "amaterasu_scroll": ("Amaterasu", "Itachi of the Sharingan", "red", black_flame),
    "susanoo_scroll": ("Susanoo", "Itachi of the Sharingan", "red", lambda i: chakra_flame(i, (150, 70, 220))),
    "kamui_shuriken_scroll": ("Kamui Shuriken", "Tobi", "black", kamui),
    "indra_arrow_scroll": ("Indra's Arrow", "Sasuke", "blue", arrow),
    "chidori_nagashi_scroll": ("Chidori Nagashi V2", "Sasuke", "blue", lightning_ring),
    "perfect_susanoo_scroll": ("Perfect Susanoo", "Sasuke", "blue", lambda i: chakra_flame(i, (70, 120, 240))),
    "rasenshuriken_v2_scroll": ("Rasenshuriken V2", "Naruto", "gold", rasenshuriken),
    "tailed_beast_bomb_scroll": ("Tailed Beast Bomb V2", "Naruto", "gold", beast_bomb),
    "six_paths_sage_scroll": ("Six Paths Sage Mode (half)", "Naruto", "gold", six_paths),
}
COLORS = {"Pain": "§5", "Itachi of the Sharingan": "§c", "Tobi": "§6", "Sasuke": "§9", "Naruto": "§6"}


def advanced_rinnegan():
    img = G.eye("rinnegan")
    d = ImageDraw.Draw(img)
    for r in (16, 26):
        for k in range(3):
            a = k * math.pi * 2 / 3 + r * 0.05
            cx, cy = 64 + math.cos(a) * r, 62 + math.sin(a) * r
            d.ellipse([cx - 3.5, cy - 3.5, cx + 3.5, cy + 3.5], fill=(30, 10, 40, 255))
    return img


def tobi_mask():
    img = G.new()
    oval = lambda d: d.ellipse([24, 8, 104, 120], fill=255)
    G.shape(img, oval, (250, 150, 50), (190, 80, 20), "radial", center=(54, 48), radius=74)
    sp = G.new()
    d = ImageDraw.Draw(sp)
    cx, cy = 50, 50
    pts = [(cx + math.cos(t) * (5 + t * 3.0), cy + math.sin(t) * (5 + t * 3.0)) for t in [i * 0.12 for i in range(150)]]
    d.line(pts, fill=(140, 60, 15, 255), width=4, joint="curve")
    m = Image.new("L", (G.S, G.S), 0)
    oval(ImageDraw.Draw(m))
    sp.putalpha(Image.composite(sp.split()[3], Image.new("L", (G.S, G.S), 0), m))
    img.alpha_composite(sp)
    ImageDraw.Draw(img).ellipse([cx - 7, cy - 7, cx + 7, cy + 7], fill=(18, 12, 12, 255))
    return img


def sage_coat():
    img = G.new()
    G.shape(img, lambda d: d.polygon([(42, 14), (86, 14), (112, 40), (100, 54), (92, 46), (96, 116), (32, 116), (36, 46), (28, 54), (16, 40)], fill=255),
            (250, 150, 50), (200, 92, 22))
    d = ImageDraw.Draw(img)
    for i in range(6):
        x = 33 + i * 10.4
        d.polygon([(x, 116), (x + 5, 98 - (i % 2) * 9), (x + 10, 116)], fill=(26, 20, 22, 255))
    d.line([64, 26, 64, 112], fill=(170, 70, 15, 255), width=3)
    d.polygon([(48, 14), (64, 32), (80, 14)], fill=(255, 196, 120, 255))
    return img


atlas_p = RP / "textures" / "item_texture.json"
atlas = json.loads(atlas_p.read_text())
for sid, (name, title, rod, emblem) in SCROLLS.items():
    img = G.scroll(rod)
    emblem(img)
    G.finish(img, sid)
    w(BP / "items" / f"{sid}.json", {"format_version": "1.21.60", "minecraft:item": {
        "description": {"identifier": f"aegis:{sid}", "menu_category": {"category": "equipment"}},
        "components": {"minecraft:icon": {"textures": {"default": f"aegis_{sid}"}},
                       "minecraft:display_name": {"value": f"{COLORS[title]}Title Scroll: {name}§r\n§7{title} title"},
                       "minecraft:max_stack_size": 1, "minecraft:glint": True}}})
    atlas["texture_data"][f"aegis_{sid}"] = {"textures": f"textures/items/aegis/{sid}"}

G.finish(advanced_rinnegan(), "advanced_rinnegan")
w(BP / "items" / "advanced_rinnegan.json", {"format_version": "1.21.60", "minecraft:item": {
    "description": {"identifier": "aegis:advanced_rinnegan", "menu_category": {"category": "equipment"}},
    "components": {"minecraft:icon": {"textures": {"default": "aegis_advanced_rinnegan"}},
                   "minecraft:display_name": {"value": "§5Advanced Rinnegan Eyes§r\n§7Pain title"},
                   "minecraft:max_stack_size": 1, "minecraft:glint": True}}})
atlas["texture_data"]["aegis_advanced_rinnegan"] = {"textures": "textures/items/aegis/advanced_rinnegan"}
# icons for the armour pieces gen_armor.py makes
G.finish(tobi_mask(), "tobi_mask")
G.finish(sage_coat(), "orange_sage_coat")
w(atlas_p, atlas)
print(f"Title gear: {len(SCROLLS)} scrolls, the Advanced Rinnegan, and the mask & coat icons.")
