#!/usr/bin/env python3
"""The v1.55 content drop: items and hand-drawn icons for the fourth wave of jutsu scrolls (behavior_pack/scripts/
jutsu4.js), the new summoning scrolls, and the new ninja tools and food (tools.js).  Run:  python3 tools/gen_content.py
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


def tint(c, k):
    return tuple(max(0, min(255, int(v * k))) for v in c)


# ===========================================================================
# Scroll emblems (centre 64,64 on the parchment)
# ===========================================================================
def toad_oil(img):                       # an oil drop catching fire
    G.shape(img, lambda d: d.polygon([(64, 40), (84, 72), (80, 92), (64, 100), (48, 92), (44, 72)], fill=255), (250, 200, 80), (170, 110, 20),
            "radial", center=(58, 74), radius=36)
    G.emblem_flame(img, 64, 46, 24)


def waterfall(img):                      # a wall of falling water and its splash
    def draw(l, d):
        for i, x in enumerate(range(34, 96, 8)):
            d.rounded_rectangle([x, 26, x + 6, 86 + (i % 2) * 6], radius=3, fill=(90, 160, 255, 255) if i % 2 else (160, 210, 255, 255))
        for k in range(5):
            cx = 38 + k * 13
            d.ellipse([cx - 7, 86, cx + 7, 100], fill=(220, 240, 255, 255))
    G.glow(img, layer(draw), (90, 160, 255), 5, 1.5)


def gale_palm(img):                      # an open palm pushing a gust
    def draw(l, d):
        d.rounded_rectangle([40, 52, 70, 96], radius=10, fill=(245, 215, 185, 255))
        for k, (x, h) in enumerate(((40, 30), (47, 36), (55, 38), (63, 34))):
            d.rounded_rectangle([x, 52 - h, x + 7, 60], radius=3, fill=(245, 215, 185, 255))
        d.rounded_rectangle([66, 62, 82, 70], radius=4, fill=(245, 215, 185, 255))
        for k in range(3):
            y = 44 + k * 16
            d.arc([74, y - 8, 108, y + 8], 270, 90, fill=(120, 230, 170, 255), width=4)
    G.glow(img, layer(draw), (90, 220, 150), 5, 1.3)


def raikiri(img):                        # the Lightning Blade: a jagged white-blue blade of lightning
    def draw(l, d):
        pts = [(30, 98), (52, 70), (46, 66), (70, 44), (64, 40), (98, 22), (76, 50), (82, 54), (60, 76), (66, 80)]
        d.polygon(pts, fill=(235, 245, 255, 255))
        for a, b in (((40, 60), (30, 50)), ((78, 70), (92, 76)), ((56, 38), (48, 26))):
            d.line([a, b], fill=(160, 210, 255, 255), width=3)
    G.glow(img, layer(draw), (120, 190, 255), 7, 2.2)


def black_panther(img):                  # a black lightning bolt with a violet edge
    lay = G.new()
    G.shape(lay, lambda d: d.polygon(G.bolt_pts(64, 64, 1.45), fill=255), (70, 50, 110), (20, 12, 30))
    G.glow(img, lay, (150, 110, 230), 7, 2.2)
    d = ImageDraw.Draw(img)
    d.ellipse([52, 40, 60, 46], fill=(250, 220, 90, 255))     # the panther's eyes
    d.ellipse([66, 40, 74, 46], fill=(250, 220, 90, 255))


def mud_river(img):                      # bands of flowing mud
    def draw(l, d):
        for k, col in enumerate(((120, 85, 50), (150, 110, 65), (100, 70, 40), (140, 100, 60))):
            y = 38 + k * 14
            pts = [(28 + i * 6, y + math.sin(i * 0.9 + k) * 5) for i in range(13)]
            d.line(pts, fill=col + (255,), width=10, joint="curve")
    G.glow(img, layer(draw), (150, 110, 60), 3, 1.0)


def planetary(img):                      # a big Rasengan with three moons on an orbit
    def draw(l, d):
        d.ellipse([20, 48, 108, 80], outline=(170, 220, 255, 220), width=3)
        d.ellipse([44, 44, 84, 84], fill=(110, 180, 255, 255))
        d.ellipse([54, 54, 74, 74], fill=(230, 245, 255, 255))
        for cx, cy in ((24, 64), (96, 58), (70, 80)):
            d.ellipse([cx - 7, cy - 7, cx + 7, cy + 7], fill=(160, 215, 255, 255))
    G.glow(img, layer(draw), (100, 170, 255), 6, 1.6)


def snakes(img):                         # three snakes lashing forward
    d = ImageDraw.Draw(img)
    for k, y0 in enumerate((40, 64, 88)):
        pts = [(28 + i * 5, y0 + math.sin(i * 0.8 + k) * 6) for i in range(12)]
        d.line(pts, fill=(130, 90, 160, 255), width=8, joint="curve")
        hx, hy = pts[-1]
        d.ellipse([hx - 7, hy - 6, hx + 9, hy + 6], fill=(110, 70, 140, 255))
        d.ellipse([hx + 2, hy - 3, hx + 5, hy], fill=(250, 210, 60, 255))
        d.line([hx + 9, hy, hx + 15, hy - 3], fill=(220, 40, 60, 255), width=2)


def clone_blast(img):                    # a shadow clone going up in a burst
    def draw(l, d):
        pts = []
        for k in range(16):
            a = k * math.pi / 8
            r = 44 if k % 2 == 0 else 22
            pts.append((64 + math.cos(a) * r, 64 + math.sin(a) * r))
        d.polygon(pts, fill=(255, 150, 40, 255))
        d.ellipse([48, 48, 80, 80], fill=(255, 235, 140, 255))
    G.glow(img, layer(draw), (255, 140, 40), 6, 1.6)
    d = ImageDraw.Draw(img)
    d.ellipse([58, 42, 70, 54], fill=(40, 34, 40, 255))           # the clone's silhouette
    d.rounded_rectangle([56, 54, 72, 80], radius=4, fill=(40, 34, 40, 255))


def raijin_kunai(img):                   # Minato's three-pronged kunai with a seal swirl
    def draw(l, d):
        d.line([(64, 104), (64, 52)], fill=(90, 70, 50, 255), width=8)
        for x0, top in ((64, 20), (46, 34), (82, 34)):
            d.polygon([(x0, top), (x0 - 7, top + 18), (x0, top + 26), (x0 + 7, top + 18)], fill=(220, 225, 240, 255))
            d.line([(x0, top + 24), (64, 52)], fill=(200, 205, 220, 255), width=5)
        d.arc([50, 82, 78, 110], 0, 300, fill=(255, 220, 90, 255), width=3)
    G.glow(img, layer(draw), (255, 210, 90), 5, 1.4)


def five_seal(img):                      # five glowing fingertips
    def draw(l, d):
        d.ellipse([40, 48, 88, 96], outline=(255, 200, 80, 255), width=4)
        for k in range(5):
            a = -math.pi * 0.95 + k * math.pi * 0.45 / 2 * 2
            cx, cy = 64 + math.cos(a) * 36, 74 + math.sin(a) * 36
            d.ellipse([cx - 6, cy - 6, cx + 6, cy + 6], fill=(255, 230, 120, 255))
        d.line([(64, 58), (64, 90)], fill=(255, 220, 110, 255), width=3)
        d.line([(48, 74), (80, 74)], fill=(255, 220, 110, 255), width=3)
    G.glow(img, layer(draw), (255, 190, 60), 5, 1.5)


def tree_binding(img):                   # a trunk whose branches wrap round
    d = ImageDraw.Draw(img)
    d.rectangle([56, 40, 72, 104], fill=(110, 76, 44, 255))
    for k, y in enumerate((48, 64, 80)):
        d.arc([36, y - 10, 92, y + 10], 200 if k % 2 else 340, 160 if k % 2 else 20, fill=(130, 92, 52, 255), width=6)
    for cx, cy in ((44, 34), (64, 26), (84, 34)):
        d.ellipse([cx - 13, cy - 11, cx + 13, cy + 11], fill=(80, 150, 70, 255))


def feathers(img):                       # white feathers drifting down
    d = ImageDraw.Draw(img)
    for cx, cy, a in ((44, 44, -0.6), (82, 52, 0.5), (60, 84, -0.2)):
        pts = []
        for i in range(21):
            t = i / 20 * math.pi * 2
            x, y = math.cos(t) * 7, math.sin(t) * 18
            pts.append((cx + x * math.cos(a) - y * math.sin(a), cy + x * math.sin(a) + y * math.cos(a)))
        d.polygon(pts, fill=(250, 250, 255, 255))
        d.line([(cx - 18 * math.sin(-a), cy - 18 * math.cos(a)), (cx + 18 * math.sin(-a), cy + 18 * math.cos(a))], fill=(190, 195, 210, 255), width=2)


def crows(img):                          # three crows in flight and a red eye
    d = ImageDraw.Draw(img)
    for cx, cy, s in ((44, 44, 1.0), (82, 56, 0.85), (56, 84, 0.9)):
        d.polygon([(cx - 18 * s, cy - 4 * s), (cx - 4 * s, cy + 2 * s), (cx, cy - 2 * s), (cx + 4 * s, cy + 2 * s), (cx + 18 * s, cy - 4 * s),
                   (cx + 6 * s, cy + 8 * s), (cx, cy + 12 * s), (cx - 6 * s, cy + 8 * s)], fill=(25, 22, 30, 255))
    d.ellipse([84, 82, 98, 96], fill=(220, 30, 30, 255))
    d.ellipse([89, 87, 93, 91], fill=(20, 8, 8, 255))


def byakugo(img):                        # Hundred Healings: the diamond seal and green light
    def draw(l, d):
        d.polygon([(64, 30), (88, 64), (64, 98), (40, 64)], fill=(150, 80, 200, 255))
        d.polygon([(64, 44), (78, 64), (64, 84), (50, 64)], fill=(210, 160, 255, 255))
        for k in range(8):
            a = k * math.pi / 4
            d.line([(64 + math.cos(a) * 38, 64 + math.sin(a) * 38), (64 + math.cos(a) * 46, 64 + math.sin(a) * 46)], fill=(120, 255, 160, 255), width=4)
    G.glow(img, layer(draw), (110, 255, 150), 6, 1.4)


def peacock(img):                        # a fan of fiery feathers with eye spots
    def draw(l, d):
        for k in range(7):
            a = math.pi + k * math.pi / 6
            cx, cy = 64 + math.cos(a) * 30, 86 + math.sin(a) * 30
            d.line([(64, 86), (cx, cy)], fill=(255, 140, 40, 255), width=6)
            d.ellipse([cx - 9, cy - 9, cx + 9, cy + 9], fill=(255, 190, 60, 255))
            d.ellipse([cx - 4, cy - 4, cx + 4, cy + 4], fill=(200, 40, 20, 255))
    G.glow(img, layer(draw), (255, 130, 40), 6, 1.5)


def tiger(img):                          # a fist driving a ring of air
    def draw(l, d):
        for r in (40, 30):
            d.ellipse([64 - r, 64 - r * 0.8, 64 + r, 64 + r * 0.8], outline=(255, 215, 120, 255), width=4)
        d.rounded_rectangle([48, 50, 80, 80], radius=8, fill=(245, 215, 185, 255))
        for k in range(4):
            d.line([(52 + k * 7, 52), (52 + k * 7, 62)], fill=(200, 160, 130, 255), width=2)
    G.glow(img, layer(draw), (255, 190, 80), 6, 1.6)


def paw(img):                            # a hound's paw print
    d = ImageDraw.Draw(img)
    d.ellipse([46, 62, 82, 96], fill=(120, 80, 50, 255))
    for cx, cy in ((42, 50), (56, 40), (72, 40), (86, 50)):
        d.ellipse([cx - 8, cy - 9, cx + 8, cy + 9], fill=(120, 80, 50, 255))


def hawk(img):                           # a hawk with spread wings
    d = ImageDraw.Draw(img)
    d.polygon([(20, 52), (46, 48), (58, 58), (64, 54), (70, 58), (82, 48), (108, 52), (88, 64), (72, 66), (68, 84), (64, 92), (60, 84),
               (56, 66), (40, 64)], fill=(120, 80, 50, 255))
    d.ellipse([58, 44, 70, 56], fill=(240, 240, 235, 255))
    d.polygon([(64, 54), (60, 58), (66, 58)], fill=(250, 200, 50, 255))
    for x in (28, 38, 90, 100):
        d.line([(x, 54), (x - 3 if x < 64 else x + 3, 62)], fill=(70, 46, 30, 255), width=2)


# id → (display name, rod colour, emblem)
SCROLLS = {
    "toad_oil_scroll": ("Jutsu Scroll: Fire Style: Toad Oil Flame Bomb", "red", toad_oil),
    "great_waterfall_scroll": ("Jutsu Scroll: Water Style: Great Waterfall", "blue", waterfall),
    "gale_palm_scroll": ("Jutsu Scroll: Wind Style: Gale Palm", "gold", gale_palm),
    "raikiri_scroll": ("Jutsu Scroll: Lightning Style: Raikiri", "blue", raikiri),
    "black_panther_scroll": ("Jutsu Scroll: Lightning Style: Black Panther", "black", black_panther),
    "mud_river_scroll": ("Jutsu Scroll: Earth Style: Mud River", "gold", mud_river),
    "planetary_rasengan_scroll": ("Jutsu Scroll: Planetary Rasengan", "blue", planetary),
    "shadow_snakes_scroll": ("Jutsu Scroll: Striking Shadow Snakes", "purple", snakes),
    "clone_explosion_scroll": ("Jutsu Scroll: Shadow Clone Explosion", "red", clone_blast),
    "flying_raijin_scroll": ("Jutsu Scroll: Flying Thunder God", "gold", raijin_kunai),
    "five_elements_seal_scroll": ("Jutsu Scroll: Sealing: Five Elements Seal", "gold", five_seal),
    "tree_binding_scroll": ("Jutsu Scroll: Genjutsu: Tree Binding Death", "purple", tree_binding),
    "nirvana_scroll": ("Jutsu Scroll: Genjutsu: Temple of Nirvana", "purple", feathers),
    "crow_genjutsu_scroll": ("Jutsu Scroll: Genjutsu: Crow Genjutsu", "black", crows),
    "hundred_healings_scroll": ("Jutsu Scroll: Medical: Hundred Healings", "purple", byakugo),
    "morning_peacock_scroll": ("Jutsu Scroll: Taijutsu: Morning Peacock", "red", peacock),
    "daytime_tiger_scroll": ("Jutsu Scroll: Taijutsu: Daytime Tiger", "gold", tiger),
    "summon_hounds_scroll": ("§dSummoning Jutsu: Ninja Hounds§r\n§7Three hounds for 45s (40 chakra)", "gold", paw),
    "summon_hawk_scroll": ("§dSummoning Jutsu: Hawk§r\n§7A hawk for 45s (40 chakra)", "gold", hawk),
}


# ===========================================================================
# Ninja tools & food icons
# ===========================================================================
def bomb(body, body_d, mark=None):
    img = G.new()
    G.shape(img, lambda d: d.ellipse([26, 34, 102, 110], fill=255), body, body_d, "radial", center=(52, 58), radius=70)
    d = ImageDraw.Draw(img)
    d.rectangle([58, 22, 70, 36], fill=(120, 110, 100, 255))
    d.line([(64, 22), (72, 12), (84, 10)], fill=(200, 170, 120, 255), width=3)
    d.ellipse([82, 4, 92, 14], fill=(255, 190, 60, 255))
    if mark:
        mark(d)
    return img


def smoke_bomb():
    return bomb((90, 90, 96), (36, 36, 42), lambda d: [d.ellipse([46 + k * 10, 58 + (k % 2) * 8, 62 + k * 10, 74 + (k % 2) * 8], fill=(170, 170, 180, 220)) for k in range(3)])


def flash_bomb():
    def star(d):
        pts = []
        for k in range(10):
            a = k * math.pi / 5 - math.pi / 2
            r = 22 if k % 2 == 0 else 9
            pts.append((64 + math.cos(a) * r, 72 + math.sin(a) * r))
        d.polygon(pts, fill=(255, 230, 90, 255))
    return bomb((235, 235, 240), (150, 150, 165), star)


def senbon():
    img = G.new()
    d = ImageDraw.Draw(img)
    for k in range(3):
        y0 = 30 + k * 18
        d.line([(18, y0 + 60), (110, y0 - 10)], fill=(220, 228, 240, 255), width=3)
        d.line([(18, y0 + 60), (30, y0 + 51)], fill=(120, 80, 60, 255), width=5)
    return img


def fuma_shuriken():
    img = G.new()
    pts = []
    for k in range(8):
        a = k * math.pi / 4 - math.pi / 2
        r = 60 if k % 2 == 0 else 14
        pts.append((64 + math.cos(a) * r, 64 + math.sin(a) * r))
    G.shape(img, lambda d: d.polygon(pts, fill=255), (215, 220, 232), (80, 84, 100), "radial", center=(52, 50), radius=84)
    d = ImageDraw.Draw(img)
    for k in range(4):
        a = k * math.pi / 2 - math.pi / 2
        d.line([(64, 64), (64 + math.cos(a + 0.25) * 52, 64 + math.sin(a + 0.25) * 52)], fill=(90, 94, 110, 255), width=3)
    d.ellipse([52, 52, 76, 76], fill=(60, 40, 30, 255))
    d.ellipse([58, 58, 70, 70], fill=(170, 130, 80, 255))
    return img


def explosive_kunai():
    img = G.kunai()
    d = ImageDraw.Draw(img)
    d.polygon([(60, 58), (84, 76), (70, 96), (46, 78)], fill=(240, 228, 196, 255))
    d.line([(56, 70), (74, 84)], fill=(200, 40, 30, 255), width=4)
    d.line([(54, 80), (66, 88)], fill=(200, 40, 30, 255), width=3)
    return img


def raijin_kunai():
    img = G.new()
    def draw(l, d):
        d.line([(30, 100), (66, 64)], fill=(70, 50, 40, 255), width=10)
        for k in range(5):
            x, y = 36 + k * 6, 94 - k * 6
            d.line([(x - 5, y - 5), (x + 5, y + 5)], fill=(150, 110, 80, 255), width=3)
        d.ellipse([18, 100, 36, 118], outline=(170, 175, 190, 255), width=5)
        for ang, ln in ((-0.9, 30), (-0.35, 46), (0.2, 30)):
            a = -math.pi / 4 + ang * 0.6
            tip = (66 + math.cos(a) * ln, 64 + math.sin(a) * ln)
            d.polygon([(66, 64), (tip[0] - 6, tip[1] + 2), tip, (tip[0] + 2, tip[1] + 6)], fill=(225, 230, 242, 255))
        d.arc([40, 70, 64, 94], 0, 300, fill=(255, 215, 80, 255), width=3)
    G.glow(img, layer(draw), (255, 210, 90), 3, 1.0)
    return img


def ninja_wire():
    img = G.new()
    d = ImageDraw.Draw(img)
    for r in (40, 32, 24, 16):
        d.ellipse([64 - r, 64 - r * 0.7, 64 + r, 64 + r * 0.7], outline=(200, 205, 215, 255), width=3)
    d.line([(104, 64), (122, 40)], fill=(200, 205, 215, 255), width=3)
    return img


def dango():
    img = G.new()
    d = ImageDraw.Draw(img)
    d.line([(18, 112), (108, 20)], fill=(190, 150, 90, 255), width=6)
    for (cx, cy), col in zip(((44, 86), (64, 66), (84, 46)), ((250, 170, 190), (250, 248, 240), (150, 210, 120))):
        G.shape(img, lambda dd, cx=cx, cy=cy: dd.ellipse([cx - 17, cy - 17, cx + 17, cy + 17], fill=255), col, tint(col, 0.75), "radial",
                center=(cx - 5, cy - 6), radius=26)
    return img


def pill_icon(col):
    img = G.new()
    G.shape(img, lambda d: d.ellipse([24, 34, 104, 96], fill=255), col, tint(col, 0.45), "radial", center=(54, 52), radius=60)
    ImageDraw.Draw(img).ellipse([42, 42, 62, 56], fill=(255, 255, 255, 150))
    return img


def curry():
    img = G.new()
    G.shape(img, lambda d: d.chord([10, 30, 118, 120], 0, 180, fill=255), (240, 240, 245), (150, 150, 165))
    G.shape(img, lambda d: d.ellipse([10, 56, 118, 86], fill=255), (196, 120, 40), (130, 70, 20))
    d = ImageDraw.Draw(img)
    d.ellipse([22, 58, 62, 80], fill=(250, 248, 240, 255))       # the rice
    for cx, cy in ((76, 66), (92, 72), (84, 62)):
        d.ellipse([cx - 5, cy - 4, cx + 5, cy + 4], fill=(150, 80, 30, 255))
    for k in range(3):                                             # steam
        d.arc([40 + k * 18, 20, 52 + k * 18, 46], 200, 340, fill=(255, 140, 60, 255), width=3)
    return img


def item(iid, name, extra=None, category="equipment", stack=1, glint=False):
    comps = {"minecraft:icon": {"textures": {"default": f"aegis_{iid}"}}, "minecraft:display_name": {"value": name},
             "minecraft:max_stack_size": stack}
    if glint:
        comps["minecraft:glint"] = True
    comps.update(extra or {})
    w(BP / "items" / f"{iid}.json", {"format_version": "1.21.60", "minecraft:item": {
        "description": {"identifier": f"aegis:{iid}", "menu_category": {"category": category}}, "components": comps}})
    atlas["texture_data"][f"aegis_{iid}"] = {"textures": f"textures/items/aegis/{iid}"}


atlas_p = RP / "textures" / "item_texture.json"
atlas = json.loads(atlas_p.read_text())

if __name__ == "__main__" or True:
    for sid, (name, rod, emblem) in SCROLLS.items():
        img = G.scroll(rod)
        emblem(img)
        G.finish(img, sid)
        item(sid, name, glint=True)
    # ninja tools (scripted in tools.js — right-click to use)
    TOOLS = {
        "smoke_bomb": ("Smoke Bomb\n§7Right-click: vanish in a cloud of smoke", 16, smoke_bomb),
        "flash_bomb": ("Flash Bomb\n§7Right-click: throw — blinds everyone near the flash", 16, flash_bomb),
        "senbon": ("Senbon\n§7Right-click: three needles (sneak: poisoned)", 32, senbon),
        "fuma_shuriken": ("§fFūma Shuriken§r\n§7Right-click: it flies out and comes back", 1, fuma_shuriken),
        "explosive_kunai": ("Explosive Kunai\n§7Right-click: a kunai with a paper bomb", 16, explosive_kunai),
        "raijin_kunai": ("§eFlying Raijin Kunai§r\n§7Marks what it hits — Flying Thunder God takes you there", 1, raijin_kunai),
        "ninja_wire": ("Ninja Wire\n§7Right-click an enemy: snare and pull them", 16, ninja_wire),
    }
    for tid, (name, stack, draw) in TOOLS.items():
        G.finish(draw(), tid)
        item(tid, name, {"minecraft:hand_equipped": True}, stack=stack)
    # food (eaten; the effects in tools.js)
    FOOD = {
        "dango": ("§dDango§r\n§7Heals a little, Speed", 6, 0.8, 1.0, dango),
        "food_pill": ("§6Food Pill§r\n§7+80 chakra and Strength — hard on the stomach", 2, 0.2, 0.8, lambda: pill_icon((140, 90, 40))),
        "blood_pill": ("§cBlood Increasing Pill§r\n§7Regeneration and Absorption", 1, 0.2, 0.8, lambda: pill_icon((200, 40, 40))),
        "ration_pill": ("§eMilitary Ration Pill§r\n§7A whole meal in one pill", 8, 1.0, 0.8, lambda: pill_icon((220, 200, 140))),
        "curry_of_life": ("§cCurry of Life§r\n§7Full heal, Regeneration and Strength — very spicy", 12, 1.2, 1.6, curry),
    }
    for fid, (name, nut, sat, dur, draw) in FOOD.items():
        G.finish(draw(), fid)
        item(fid, name, {"minecraft:food": {"nutrition": nut, "saturation_modifier": sat, "can_always_eat": True},
                         "minecraft:use_animation": "eat", "minecraft:use_modifiers": {"use_duration": dur, "movement_modifier": 0.5}},
             category="items", stack=16)
    # the Hidden Scroll (events.js): a sealed scroll with a gold seal
    hs = G.scroll("black")
    seal = G.new()
    G.shape(seal, lambda d: d.ellipse([46, 46, 82, 82], fill=255), (250, 210, 90), (190, 130, 30), "radial", center=(58, 56), radius=30)
    G.glow(hs, seal, (255, 200, 80), 6, 1.6)
    ImageDraw.Draw(hs).line([(64, 52), (64, 76)], fill=(160, 40, 30, 255), width=4)
    ImageDraw.Draw(hs).line([(52, 64), (76, 64)], fill=(160, 40, 30, 255), width=4)
    G.finish(hs, "hidden_scroll")
    item("hidden_scroll", "§eHidden Scroll§r\n§7Right-click to break the seal", stack=16, glint=True)
    w(atlas_p, atlas)
    print(f"v1.55 content: {len(SCROLLS)} scrolls, {len(TOOLS)} tools, {len(FOOD)} foods, the Hidden Scroll.")
