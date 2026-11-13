#!/usr/bin/env python3
"""Third wave of jutsu (none clan-bound): scroll icons, items, recipes, the 3D jutsu models (Water Shark, Lightning
Hound, Fire Dragon, Earth Dragon) and the mist fog. Behaviour lives in behavior_pack/scripts/jutsu3.js.
Run from the shinobi-addon folder:  python3 tools/gen_jutsu3.py
"""
import json
import math
import random
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from PIL import Image, ImageDraw  # noqa: E402
import gen_icons as G  # noqa: E402

ROOT = Path(__file__).resolve().parent.parent
BP, RP = ROOT / "behavior_pack", ROOT / "resource_pack"


def w(path, obj):
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(obj, indent=2, ensure_ascii=False) + "\n")


G.RODS["green"] = ((70, 160, 80), (25, 80, 35))
G.RODS["brown"] = ((140, 95, 55), (70, 45, 25))

# ===========================================================================
# Scroll emblems (128×128, centre 64,64)
# ===========================================================================
def lay():
    return G.new()


def e_dragon_flame(img):
    l = lay()
    d = ImageDraw.Draw(l)
    pts = [(34 + i * 1.6, 92 - i * 0.9 + math.sin(i / 4.5) * 12) for i in range(36)]
    d.line(pts, fill=(255, 120, 20, 255), width=13, joint="curve")
    d.line(pts, fill=(255, 225, 120, 255), width=5, joint="curve")
    G.shape(l, lambda d: d.ellipse([78, 26, 102, 50], fill=255), (255, 200, 80), (230, 70, 10), "radial", center=(86, 34), radius=16)
    d = ImageDraw.Draw(l)
    d.polygon([(98, 34), (114, 28), (104, 44)], fill=(230, 70, 10, 255))                     # jaw
    d.polygon([(84, 28), (78, 14), (90, 26)], fill=(255, 200, 80, 255))                      # horn
    d.ellipse([88, 32, 94, 38], fill=(255, 255, 255, 255))
    G.glow(img, l, (255, 110, 20), 6, 2)


def e_ash(img):
    l = lay()
    for cx, cy, r in ((52, 66, 20), (72, 60, 22), (88, 72, 16), (40, 78, 14), (66, 80, 18)):
        G.shape(l, lambda d, cx=cx, cy=cy, r=r: d.ellipse([cx - r, cy - r, cx + r, cy + r], fill=255), (120, 112, 110), (55, 50, 50), "radial", center=(cx - 6, cy - 8), radius=r * 1.4)
    d = ImageDraw.Draw(l)
    rnd = random.Random(4)
    for _ in range(14):
        x, y = rnd.randint(32, 98), rnd.randint(40, 96)
        d.ellipse([x, y, x + 4, y + 4], fill=(255, rnd.randint(110, 190), 30, 255))
    G.glow(img, l, (255, 120, 40), 4, 1.2)


def e_shark(img):
    l = lay()
    body = [(26, 66), (44, 52), (72, 50), (96, 58), (104, 64), (96, 70), (72, 78), (44, 76)]
    G.shape(l, lambda d: d.polygon(body, fill=255), (120, 190, 255), (30, 80, 190))
    d = ImageDraw.Draw(l)
    d.polygon([(58, 52), (66, 30), (74, 51)], fill=(40, 100, 210, 255))                      # dorsal fin
    d.polygon([(30, 66), (14, 50), (20, 66), (14, 82)], fill=(40, 100, 210, 255))            # tail
    d.polygon([(64, 76), (58, 90), (72, 77)], fill=(40, 100, 210, 255))
    d.polygon([(96, 66), (104, 64), (96, 70), (84, 70)], fill=(250, 250, 250, 255))          # mouth
    for x in range(86, 100, 4):
        d.polygon([(x, 66), (x + 2, 70), (x + 4, 66)], fill=(255, 255, 255, 255))
    d.ellipse([88, 58, 93, 63], fill=(10, 10, 20, 255))
    G.glow(img, l, (60, 150, 255), 5, 1.5)


def e_mist(img):
    l = lay()
    d = ImageDraw.Draw(l)
    for i, y in enumerate((42, 56, 70, 84)):
        x0 = 26 + (i % 2) * 10
        d.rounded_rectangle([x0, y, x0 + 70, y + 9], radius=5, fill=(225, 232, 240, 210 - i * 20))
    G.glow(img, l, (200, 220, 240), 6, 1.4)


def e_shockwave(img):
    l = lay()
    d = ImageDraw.Draw(l)
    for r, wd, col in ((40, 9, (40, 110, 220)), (29, 7, (90, 170, 250)), (18, 6, (170, 220, 255))):
        d.arc([64 - r, 70 - r, 64 + r, 70 + r], 180, 360, fill=col + (255,), width=wd)
    for x in (30, 50, 78, 98):
        d.ellipse([x, 86, x + 6, 92], fill=(150, 210, 255, 255))
    G.glow(img, l, (60, 150, 255), 6, 1.6)


def e_sickle(img):
    l = lay()
    d = ImageDraw.Draw(l)
    for k, (r, a0, a1) in enumerate(((38, 200, 330), (28, 210, 320), (18, 220, 310))):
        d.arc([64 - r, 72 - r, 64 + r, 72 + r], a0, a1, fill=(200, 255, 220, 255) if k == 0 else (110, 220, 150, 255), width=8 - k * 2)
    for x, y in ((34, 92), (64, 98), (94, 92)):
        d.line([x - 6, y, x + 6, y], fill=(170, 240, 200, 255), width=3)
    G.glow(img, l, (90, 230, 150), 5, 1.8)


def e_pressure(img):
    l = lay()
    G.shape(l, lambda d: d.ellipse([34, 34, 94, 94], fill=255), (230, 255, 240), (110, 210, 160), "radial", center=(56, 54), radius=40)
    d = ImageDraw.Draw(l)
    for i in range(10):
        a = i / 10 * math.tau
        d.line([64 + math.cos(a) * 34, 64 + math.sin(a) * 34, 64 + math.cos(a) * 48, 64 + math.sin(a) * 48], fill=(180, 250, 210, 255), width=4)
    d.arc([42, 42, 86, 86], 30, 300, fill=(255, 255, 255, 255), width=3)
    G.glow(img, l, (110, 230, 170), 6, 1.8)


def e_hound(img):
    l = lay()
    head = [(38, 82), (44, 54), (40, 32), (54, 46), (66, 44), (80, 32), (78, 54), (96, 62), (98, 72), (78, 76), (60, 90)]
    G.shape(l, lambda d: d.polygon(head, fill=255), (235, 250, 255), (90, 190, 255))
    d = ImageDraw.Draw(l)
    d.polygon([(78, 72), (98, 72), (86, 80)], fill=(255, 255, 255, 255))
    d.ellipse([64, 54, 71, 60], fill=(20, 60, 140, 255))
    d.line([(30, 96), (40, 86), (34, 84), (46, 70)], fill=(200, 240, 255, 255), width=3)
    d.line([(100, 96), (92, 84), (98, 82), (88, 70)], fill=(200, 240, 255, 255), width=3)
    G.glow(img, l, (110, 210, 255), 7, 2.4)


def e_armor(img):
    l = lay()
    torso = [(40, 40), (88, 40), (96, 56), (84, 62), (82, 96), (46, 96), (44, 62), (32, 56)]
    G.shape(l, lambda d: d.polygon(torso, fill=255), (240, 250, 255), (100, 180, 240))
    img.alpha_composite(l)
    l2 = lay()
    G.shape(l2, lambda d: d.polygon(G.bolt_pts(64, 68, 0.9), fill=255), (255, 255, 255), (250, 230, 90))
    G.glow(img, l2, (140, 220, 255), 7, 2.6)


def e_earth_dragon(img):
    l = lay()
    G.shape(l, lambda d: d.rectangle([52, 66, 76, 104], fill=255), (160, 120, 80), (95, 65, 40))
    head = [(40, 50), (60, 36), (86, 40), (100, 54), (90, 60), (98, 70), (70, 72), (48, 68)]
    G.shape(l, lambda d: d.polygon(head, fill=255), (175, 135, 90), (100, 70, 42))
    d = ImageDraw.Draw(l)
    d.polygon([(58, 38), (54, 22), (66, 36)], fill=(120, 90, 60, 255))
    d.polygon([(72, 38), (74, 20), (80, 40)], fill=(120, 90, 60, 255))
    d.ellipse([72, 46, 78, 52], fill=(255, 200, 60, 255))
    for x, y in ((100, 66), (108, 74), (112, 84)):
        d.ellipse([x - 4, y - 4, x + 4, y + 4], fill=(130, 95, 60, 255))
    d.line([30, 104, 98, 104], fill=(90, 60, 35, 255), width=4)
    img.alpha_composite(l)


def e_headhunter(img):
    l = lay()
    G.shape(l, lambda d: d.rectangle([26, 78, 102, 98], fill=255), (150, 110, 70), (90, 60, 35))
    hand = [(52, 80), (52, 54), (56, 50), (58, 60), (60, 44), (64, 42), (66, 58), (68, 44), (72, 44), (72, 60), (76, 50), (80, 52), (78, 66), (74, 80)]
    G.shape(l, lambda d: d.polygon(hand, fill=255), (240, 200, 160), (190, 140, 100))
    d = ImageDraw.Draw(l)
    for x in (34, 46, 84, 94):
        d.line([x, 78, x - 4, 70], fill=(120, 85, 50, 255), width=3)
    img.alpha_composite(l)


def e_swamp(img):
    l = lay()
    G.shape(l, lambda d: d.ellipse([22, 50, 106, 96], fill=255), (95, 75, 45), (40, 30, 20), "radial", center=(56, 64), radius=50)
    d = ImageDraw.Draw(l)
    for x, y, r in ((44, 64, 5), (70, 58, 7), (86, 74, 4), (58, 80, 4)):
        d.ellipse([x - r, y - r, x + r, y + r], outline=(160, 140, 95, 255), width=2)
    d.line([(60, 46), (62, 30), (66, 46)], fill=(70, 110, 50, 255), width=3)
    img.alpha_composite(l)


def e_big_rasengan(img):
    G.emblem_spiral(img, color=(70, 150, 255), light=(235, 250, 255), turns=3.2, r0=42)
    l = lay()
    ImageDraw.Draw(l).ellipse([16, 16, 112, 112], outline=(140, 210, 255, 200), width=4)
    G.glow(img, l, (90, 170, 255), 6, 1.4)


def e_leaf(img):
    l = lay()
    leaf = [(64, 28)]
    for i in range(1, 20):
        t = i / 20
        leaf.append((64 + math.sin(t * math.pi) * 22, 28 + t * 64))
    leaf.append((64, 92))
    for i in range(19, 0, -1):
        t = i / 20
        leaf.append((64 - math.sin(t * math.pi) * 22, 28 + t * 64))
    G.shape(l, lambda d: d.polygon(leaf, fill=255), (150, 230, 110), (40, 130, 50))
    d = ImageDraw.Draw(l)
    d.line([64, 30, 64, 100], fill=(30, 100, 40, 255), width=3)
    for r in (40, 48):
        d.arc([64 - r, 64 - r, 64 + r, 64 + r], 200, 320, fill=(200, 255, 200, 230), width=3)
    G.glow(img, l, (110, 220, 90), 4, 1.3)


def e_dynamic_entry(img):
    l = lay()
    leg = [(40, 92), (54, 54), (88, 40), (100, 46), (98, 56), (64, 64), (52, 96)]
    G.shape(l, lambda d: d.polygon(leg, fill=255), (90, 170, 80), (40, 100, 40))
    d = ImageDraw.Draw(l)
    d.polygon([(88, 40), (104, 36), (106, 50), (98, 56)], fill=(250, 140, 40, 255))           # orange leg warmer
    for y in (60, 72, 84):
        d.line([18, y, 40, y - 6], fill=(255, 255, 255, 230), width=3)
    G.glow(img, l, (120, 220, 90), 4, 1.3)


def e_lotus(img):
    l = lay()
    for k in range(6):
        a = math.radians(-150 + k * 24)
        cx, cy = 64 + math.cos(a) * 18, 76 + math.sin(a) * 18
        G.shape(l, lambda d, cx=cx, cy=cy: d.ellipse([cx - 11, cy - 18, cx + 11, cy + 18], fill=255), (255, 210, 230), (220, 90, 150), "radial", center=(cx, cy - 8), radius=22)
    G.shape(l, lambda d: d.ellipse([52, 64, 76, 88], fill=255), (255, 235, 140), (230, 170, 60))
    d = ImageDraw.Draw(l)
    d.line([(26, 100), (102, 96)], fill=(245, 240, 225, 255), width=5)                       # the bandage
    G.glow(img, l, (255, 150, 200), 4, 1.3)


def e_scalpel(img):
    l = lay()
    hand = [(36, 96), (40, 70), (60, 62), (72, 66), (68, 78), (56, 82), (52, 98)]
    G.shape(l, lambda d: d.polygon(hand, fill=255), (240, 200, 160), (190, 140, 100))
    blade = [(64, 64), (100, 26), (106, 30), (74, 72)]
    G.shape(l, lambda d: d.polygon(blade, fill=255), (220, 255, 235), (60, 220, 140))
    G.glow(img, l, (80, 240, 160), 6, 2.2)


def e_hell_viewing(img):
    l = lay()
    G.shape(l, lambda d: d.ellipse([28, 46, 100, 82], fill=255), (250, 240, 250), (190, 170, 200))
    d = ImageDraw.Draw(l)
    d.ellipse([50, 50, 78, 78], fill=(120, 30, 150, 255))
    pts = []
    for i in range(60):
        t = i / 59
        a = t * math.tau * 2
        r = 13 * (1 - t) + 1
        pts.append((64 + math.cos(a) * r, 64 + math.sin(a) * r))
    d.line(pts, fill=(20, 0, 30, 255), width=3)
    for k in range(5):
        a = math.radians(200 + k * 35)
        d.line([64 + math.cos(a) * 40, 64 + math.sin(a) * 26, 64 + math.cos(a) * 52, 64 + math.sin(a) * 36], fill=(150, 60, 190, 255), width=3)
    G.glow(img, l, (150, 60, 200), 6, 1.8)


def e_tags(img):
    l = lay()
    for k, (cx, rot) in enumerate(((50, -14), (64, 0), (78, 14))):
        tag = Image.new("RGBA", (128, 128), (0, 0, 0, 0))
        G.shape(tag, lambda d, cx=cx: d.rectangle([cx - 8, 34, cx + 8, 92], fill=255), (250, 240, 210), (215, 195, 150))
        dd = ImageDraw.Draw(tag)
        for y in (44, 54, 64, 74, 84):
            dd.line([cx - 4, y, cx + 4, y], fill=(170, 25, 25, 255), width=2)
        dd.line([cx, 40, cx, 88], fill=(170, 25, 25, 255), width=2)
        l.alpha_composite(tag.rotate(rot, center=(cx, 64)))
    d = ImageDraw.Draw(l)
    for x, y in ((40, 30), (88, 28), (96, 40)):
        d.line([x - 4, y, x + 4, y], fill=(255, 210, 60, 255), width=2)
        d.line([x, y - 4, x, y + 4], fill=(255, 210, 60, 255), width=2)
    G.glow(img, l, (255, 170, 60), 3, 1.0)


# id: (display name, rod, emblem, recipe ingredient, extra ingredient or None)
SCROLLS = {
    "dragon_flame_scroll": ("Fire Style: Dragon Flame Bullet", "red", e_dragon_flame, "minecraft:blaze_rod", None),
    "ash_burning_scroll": ("Fire Style: Ash Pile Burning", "red", e_ash, "minecraft:gunpowder", "minecraft:charcoal"),
    "water_shark_scroll": ("Water Style: Water Shark Bomb", "blue", e_shark, "minecraft:prismarine_shard", None),
    "hiding_mist_scroll": ("Water Style: Hiding in Mist", "blue", e_mist, "minecraft:glass_bottle", None),
    "water_shockwave_scroll": ("Water Style: Exploding Water Shockwave", "blue", e_shockwave, "minecraft:nautilus_shell", "minecraft:diamond"),
    "sickle_weasel_scroll": ("Wind Style: Sickle Weasel", "green", e_sickle, "minecraft:feather", None),
    "pressure_damage_scroll": ("Wind Style: Pressure Damage", "green", e_pressure, "minecraft:breeze_rod", "minecraft:diamond"),
    "lightning_hound_scroll": ("Lightning Style: Lightning Hound", "gold", e_hound, "minecraft:bone", "minecraft:copper_ingot"),
    "lightning_armor_scroll": ("Lightning Style: Lightning Release Armour", "gold", e_armor, "minecraft:copper_block", "minecraft:diamond"),
    "earth_dragon_scroll": ("Earth Style: Earth Dragon Bullet", "brown", e_earth_dragon, "minecraft:clay_ball", None),
    "headhunter_scroll": ("Earth Style: Headhunter Jutsu", "brown", e_headhunter, "minecraft:iron_shovel", None),
    "swamp_scroll": ("Earth Style: Swamp of the Underworld", "brown", e_swamp, "minecraft:mud", "minecraft:slime_ball"),
    "big_rasengan_scroll": ("Big Ball Rasengan", "gold", e_big_rasengan, "minecraft:ender_pearl", "minecraft:diamond"),
    "leaf_hurricane_scroll": ("Taijutsu: Leaf Hurricane", "green", e_leaf, "minecraft:oak_leaves", None),
    "dynamic_entry_scroll": ("Taijutsu: Dynamic Entry", "green", e_dynamic_entry, "minecraft:leather_boots", None),
    "front_lotus_scroll": ("Taijutsu: Front Lotus", "green", e_lotus, "minecraft:string", "minecraft:pink_tulip"),
    "chakra_scalpel_scroll": ("Medical: Chakra Scalpel", "blue", e_scalpel, "minecraft:shears", None),
    "hell_viewing_scroll": ("Genjutsu: Hell Viewing", "purple", e_hell_viewing, "minecraft:fermented_spider_eye", None),
    "explosive_tags_scroll": ("Explosive Tag Barrage", "red", e_tags, "minecraft:tnt", None),
}

atlas_p = RP / "textures" / "item_texture.json"
atlas = json.loads(atlas_p.read_text())
for sid, (name, rod, emblem, ing, extra) in SCROLLS.items():
    G.make_scroll(sid, rod, emblem)
    w(BP / "items" / f"{sid}.json", {"format_version": "1.21.60", "minecraft:item": {
        "description": {"identifier": f"aegis:{sid}", "menu_category": {"category": "equipment"}},
        "components": {"minecraft:icon": {"textures": {"default": f"aegis_{sid}"}}, "minecraft:display_name": {"value": f"Jutsu Scroll: {name}"},
                       "minecraft:max_stack_size": 1, "minecraft:glint": True}}})
    ingredients = [{"item": "aegis:blank_scroll"}, {"item": ing}, {"item": "minecraft:lapis_lazuli"}] + ([{"item": extra}] if extra else [])
    w(BP / "recipes" / f"{sid}.json", {"format_version": "1.21.60", "minecraft:recipe_shapeless": {
        "description": {"identifier": f"aegis:{sid}"}, "tags": ["crafting_table"], "ingredients": ingredients,
        "result": {"item": f"aegis:{sid}", "count": 1}, "unlock": {"context": "AlwaysUnlocked"}}})
    atlas["texture_data"][f"aegis_{sid}"] = {"textures": f"textures/items/aegis/{sid}"}
w(atlas_p, atlas)


# ===========================================================================
# 3D jutsu models. Front = −Z (they fly / run / look that way). 16 px = 1 block.
# Texture: a 64×64 palette of 16×16 painted swatches; each cube face shows a window of one.
# ===========================================================================
class Model:
    def __init__(self, ident, swatches, seed):
        self.ident = ident
        self.rnd = random.Random(seed)
        self.tex = Image.new("RGBA", (64, 64), (0, 0, 0, 0))
        self.slots = {}
        for i, (name, painter) in enumerate(swatches.items()):
            x0, y0 = (i % 4) * 16, (i // 4) * 16
            painter(self.tex, x0, y0, self.rnd)
            self.slots[name] = (x0, y0)
        self.bones = []

    def bone(self, name, parent=None, pivot=(0, 0, 0), rot=None):
        b = {"name": name, "pivot": [round(v, 2) for v in pivot], "cubes": []}
        if parent:
            b["parent"] = parent
        if rot:
            b["rotation"] = rot
        self.bones.append(b)
        return b["cubes"]

    def face(self, sw, fw, fh):
        x0, y0 = self.slots[sw]
        uw, vh = min(14, max(1, fw)), min(14, max(1, fh))
        return {"uv": [round(x0 + 1 + self.rnd.random() * (14 - uw), 1), round(y0 + 1 + self.rnd.random() * (14 - vh), 1)], "uv_size": [round(uw, 1), round(vh, 1)]}

    def box(self, cubes, o, s, sw, under=None, rot=None, pivot=None, inflate=0):
        wd, ht, dp = s
        uv = {"north": self.face(sw, wd, ht), "south": self.face(sw, wd, ht), "east": self.face(sw, dp, ht), "west": self.face(sw, dp, ht),
              "up": self.face(sw, wd, dp), "down": self.face(under or sw, wd, dp)}
        c = {"origin": [round(v, 2) for v in o], "size": [round(v, 2) for v in s], "uv": uv}
        if rot:
            c["rotation"], c["pivot"] = rot, [round(v, 2) for v in pivot]
        if inflate:
            c["inflate"] = inflate
        cubes.append(c)

    def write(self, bounds=(4, 3)):
        w(RP / "models" / "entity" / f"{self.ident}.geo.json", {"format_version": "1.12.0", "minecraft:geometry": [{
            "description": {"identifier": f"geometry.aegis.{self.ident}", "texture_width": 64, "texture_height": 64,
                            "visible_bounds_width": bounds[0], "visible_bounds_height": bounds[1], "visible_bounds_offset": [0, bounds[1] / 2 - 0.5, 0]},
            "bones": self.bones}]})
        self.tex.save(RP / "textures" / "entity" / "aegis" / f"{self.ident}.png")


def paint(base, var=0.08, alpha=255, streak=None, glow=False):
    def p(img, x0, y0, rnd):
        for x in range(16):
            col_k = rnd.uniform(1 - var, 1 + var)
            for y in range(16):
                k = col_k * rnd.uniform(1 - var, 1 + var)
                c = base
                if streak and (x + y * 0.5) % 5 < 1.2:
                    c = streak
                if glow:
                    k *= 1 + 0.25 * math.sin((x + y) * 0.8)
                a = alpha if isinstance(alpha, int) else int(rnd.uniform(*alpha))
                img.putpixel((x0 + x, y0 + y), tuple(max(0, min(255, int(v * k))) for v in c) + (a,))
    return p


def rock(base):
    def p(img, x0, y0, rnd):
        for x in range(16):
            for y in range(16):
                k = rnd.uniform(0.82, 1.12)
                if (x * 7 + y * 3) % 11 == 0 or (x - y) % 13 == 0:
                    k *= 0.6                                                   # cracks
                img.putpixel((x0 + x, y0 + y), tuple(max(0, min(255, int(v * k))) for v in base) + (255,))
    return p


def anim_file(name, anims):
    w(RP / "animations" / f"{name}.animation.json", {"format_version": "1.8.0", "animations": anims})


# ---------------------------------------------------------------- Water Shark (Suikōdan)
m = Model("water_shark", {"body": paint((60, 140, 235), 0.06, (200, 235), streak=(110, 185, 255)), "belly": paint((215, 238, 255), 0.04, 225),
                          "dark": paint((25, 70, 160), 0.05, 235), "teeth": paint((250, 252, 255), 0.02, 255), "eye": paint((8, 12, 30), 0.02, 255),
                          "foam": paint((160, 210, 255), 0.08, (28, 70))}, 7)
body = m.bone("body", None, (0, 8, 0))
m.box(body, [-5, 3, -10], [10, 10, 20], "body", "belly")
m.box(body, [-4.5, 2.4, -9], [9, 3, 17], "belly")
m.box(body, [-4, 4, -17], [8, 8, 7], "body", "belly")
m.box(body, [-3, 5, -21], [6, 5.5, 4], "body", "belly")
for sx in (-1, 1):
    m.box(body, [sx * 4.1 - 0.2, 9, -16], [0.4, 1.6, 1.6], "eye")
    for k in range(3):
        m.box(body, [sx * 5.05 - 0.15, 5.5, -9 + k * 2], [0.3, 5, 0.5], "dark")                 # gills
    m.box(body, [sx * 5 + (0 if sx > 0 else -7), 4, -6], [7, 1, 5], "dark", rot=[0, 0, sx * -22], pivot=[sx * 5, 4.5, -3.5])   # pectoral fins
for x in (-2.5, -1, 0.5, 2):
    m.box(body, [x, 4.3, -20.8], [1, 1.4, 1], "teeth")                                          # upper teeth
m.box(body, [-1, 12, -4], [2, 8, 7], "dark", rot=[-28, 0, 0], pivot=[0, 12, -1])               # dorsal fin
jaw = m.bone("jaw", "body", (0, 5, -12))
m.box(jaw, [-3.5, 2.5, -20.5], [7, 2.5, 8.5], "belly")
for x in (-2.5, -1, 0.5, 2):
    m.box(jaw, [x, 5, -20.3], [1, 1.3, 1], "teeth")
tail = m.bone("tail", "body", (0, 8, 10))
m.box(tail, [-3, 5, 10], [6, 6, 8], "body", "belly")
m.box(tail, [-1, 8, 16], [2, 10, 5], "dark", rot=[38, 0, 0], pivot=[0, 9, 17])
m.box(tail, [-1, 0, 16], [2, 8, 5], "dark", rot=[-38, 0, 0], pivot=[0, 7, 17])
wake = m.bone("wake", "body", (0, 8, 0))
m.box(wake, [-6, 2, -11], [12, 12, 30], "foam", inflate=0.6)                                    # the water it's made of
m.write((4, 3))
anim_file("water_shark", {"animation.aegis.water_shark.swim": {"loop": True, "bones": {
    "body": {"rotation": [0, "math.sin(q.life_time * 500) * 6", "math.sin(q.life_time * 250) * 4"]},
    "tail": {"rotation": [0, "math.sin(q.life_time * 500 - 50) * 24", 0]},
    "jaw": {"rotation": ["12 + math.sin(q.life_time * 360) * 12", 0, 0]},
    "wake": {"scale": "1.0 + math.sin(q.life_time * 900) * 0.04"}}}})

# ---------------------------------------------------------------- Lightning Hound (Raijū Tsuiga)
m = Model("lightning_hound", {"body": paint((150, 220, 255), 0.06, (210, 250), glow=True), "core": paint((245, 252, 255), 0.03, 250),
                              "dark": paint((60, 150, 255), 0.05, 235), "eye": paint((255, 255, 255), 0.0, 255)}, 11)
body = m.bone("body", None, (0, 8, 0))
m.box(body, [-3, 7, -6], [6, 6, 13], "body", "dark")
m.box(body, [-3.6, 6.5, -8], [7.2, 7.5, 6], "body", "dark")                                    # deep chest
for z in range(-6, 7, 3):
    m.box(body, [-0.5, 12.6, z], [1, 2.2, 1.6], "core", rot=[-30, 0, 0], pivot=[0, 13, z + 0.8])   # crackling spines
head = m.bone("head", "body", (0, 12, -8))
m.box(head, [-3, 10, -13], [6, 6, 6], "body", "dark")
m.box(head, [-1.8, 10, -17], [3.6, 3.2, 4], "body", "dark")
m.box(head, [-1.6, 9.2, -16.6], [3.2, 1, 3.4], "core")                                          # bared teeth
for sx in (-1, 1):
    m.box(head, [sx * 1.8 - 1, 15.5, -10], [2, 4, 1.4], "body", rot=[-15, 0, sx * -12], pivot=[sx * 1.8, 15.5, -9.3])
    m.box(head, [sx * 1.6 - 0.6, 13.4, -13.2], [1.2, 0.9, 0.3], "eye")
legs = []
for i, (sx, sz) in enumerate(((-1, -1), (1, -1), (-1, 1), (1, 1))):
    x, z = sx * 1.9, sz * 4.5 - (1 if sz < 0 else 0)
    leg = m.bone(f"leg{i}", "body", (x, 8, z))
    m.box(leg, [x - 1, 0, z - 1], [2, 8.5, 2], "body", "core")
    m.box(leg, [x - 1.2, 0, z - 1.8], [2.4, 1.2, 2.6], "core")
tail = m.bone("tail", "body", (0, 12, 6.5))
m.box(tail, [-1, 11, 6.5], [2, 2, 8], "body", rot=[28, 0, 0], pivot=[0, 12, 6.5])
m.box(tail, [-0.6, 13.6, 13], [1.2, 1.2, 4], "core", rot=[45, 0, 0], pivot=[0, 14, 13])
m.write((3, 2))
gallop = "math.sin(q.life_time * 1300)"
anim_file("lightning_hound", {"animation.aegis.lightning_hound.run": {"loop": True, "bones": {
    "body": {"position": [0, f"math.abs({gallop}) * 1.2", 0], "rotation": [f"{gallop} * 5", 0, 0],
             "scale": "1.0 + math.sin(q.life_time * 3100) * 0.05"},
    "head": {"rotation": [f"-8 - {gallop} * 6", 0, 0]},
    "leg0": {"rotation": [f"{gallop} * 55", 0, 0]}, "leg1": {"rotation": [f"{gallop} * 55", 0, 0]},
    "leg2": {"rotation": [f"-{gallop} * 55", 0, 0]}, "leg3": {"rotation": [f"-{gallop} * 55", 0, 0]},
    "tail": {"rotation": [f"{gallop} * 12", "math.sin(q.life_time * 700) * 18", 0]}}}})

# ---------------------------------------------------------------- Fire Dragon (Karyū Endan)
m = Model("fire_dragon", {"fire": paint((255, 140, 30), 0.1, (215, 250), streak=(255, 210, 90), glow=True), "hot": paint((255, 235, 150), 0.05, 245),
                          "deep": paint((220, 60, 10), 0.08, (200, 240)), "eye": paint((255, 255, 230), 0.0, 255), "horn": paint((255, 190, 70), 0.06, 245)}, 13)
head = m.bone("head", None, (0, 8, 0))
m.box(head, [-6, 2, -14], [12, 11, 14], "fire", "deep")
m.box(head, [-4.5, 3, -22], [9, 7, 8], "fire", "deep")
m.box(head, [-6.5, 10.5, -13], [13, 2.5, 9], "deep")                                          # brow
for sx in (-1, 1):
    m.box(head, [sx * 4 - 1, 12, -6], [2, 2, 9], "horn", rot=[32, sx * 14, 0], pivot=[sx * 4, 13, -6])    # horns sweep back
    m.box(head, [sx * 4.6 - 1, 9, -14.4], [2, 1.6, 0.5], "eye")
    m.box(head, [sx * 4 - 0.4, 4, -21], [0.8, 0.8, 16], "hot", rot=[0, sx * 28, 0], pivot=[sx * 4, 4.4, -21])   # whiskers
for x in (-3.5, -1.5, 0.5, 2.5):
    m.box(head, [x, 2.1, -21.6], [1, 1.6, 1], "hot")
for z in (-10, -6, -2):
    m.box(head, [-0.8, 13, z], [1.6, 3, 3], "hot", rot=[-35, 0, 0], pivot=[0, 13, z + 1.5])      # mane flames
jaw = m.bone("jaw", "head", (0, 4, -8))
m.box(jaw, [-4, 0, -21], [8, 3, 12], "fire", "deep")
for x in (-3, -1, 1, 3):
    m.box(jaw, [x - 0.5, 3, -20.6], [1, 1.4, 1], "hot")
prev = "head"
for k, (wd, ln) in enumerate(((10, 12), (8.6, 12), (7, 11), (5.4, 10), (3.6, 9))):
    z0 = sum(l_ for _, l_ in ((10, 12), (8.6, 12), (7, 11), (5.4, 10), (3.6, 9))[:k])
    seg = m.bone(f"seg{k}", prev, (0, 7.5, z0))
    m.box(seg, [-wd / 2, 7.5 - wd / 2, z0], [wd, wd, ln + 1], "fire" if k % 2 == 0 else "deep", "deep")
    m.box(seg, [-0.6, 7.5 + wd / 2 - 0.5, z0 + 2], [1.2, 2.5 + wd * 0.2, 3], "hot", rot=[-30, 0, 0], pivot=[0, 7.5 + wd / 2, z0 + 3.5])
    prev = f"seg{k}"
m.write((5, 3))
seg_anims = {f"seg{k}": {"rotation": [f"math.sin(q.life_time * 300 - {k * 55}) * 7", f"math.sin(q.life_time * 400 - {k * 60}) * 16", 0]} for k in range(5)}
anim_file("fire_dragon", {"animation.aegis.fire_dragon.fly": {"loop": True, "bones": {
    "head": {"rotation": ["math.sin(q.life_time * 300) * 5", "math.sin(q.life_time * 400) * 6", 0]},
    "jaw": {"rotation": ["18 + math.sin(q.life_time * 520) * 12", 0, 0]}, **seg_anims}}})

# ---------------------------------------------------------------- Earth Dragon (Doryūdan): rises, spits three times, sinks
m = Model("earth_dragon", {"rock": rock((140, 105, 70)), "dark": rock((90, 65, 42)), "moss": rock((90, 110, 60)), "eye": paint((255, 200, 60), 0.04, 255),
                           "mouth": paint((50, 30, 20), 0.05, 255)}, 17)
root = m.bone("root", None, (0, 0, 0))
neck = m.bone("neck", "root", (0, 0, 0))
m.box(neck, [-6, 0, -4], [12, 28, 12], "rock", "dark")
m.box(neck, [-7, 0, -5], [14, 6, 14], "dark")
m.box(neck, [-1.5, 6, 7.5], [3, 22, 3], "dark")                                                 # spine ridge
for y in (10, 18):
    m.box(neck, [-6.4, y, -4.4], [12.8, 1.4, 12.8], "moss")
head = m.bone("head", "neck", (0, 28, 0))
m.box(head, [-7, 25, -14], [14, 11, 17], "rock", "dark")
m.box(head, [-5.5, 26, -24], [11, 8, 10], "rock", "dark")
m.box(head, [-4.5, 27.5, -24.4], [9, 2, 0.6], "mouth")
for sx in (-1, 1):
    m.box(head, [sx * 4.5 - 1.5, 34, -8], [3, 7, 3], "dark", rot=[-30, 0, sx * -10], pivot=[sx * 4.5, 34, -6.5])   # horns
    m.box(head, [sx * 5.5 - 1, 31, -14.4], [2, 1.6, 0.5], "eye")
jaw = m.bone("jaw", "head", (0, 27, -10))
m.box(jaw, [-5, 23, -23], [10, 3, 13], "rock", "dark")
for x in (-3.5, -1.2, 1.2, 3.5):
    m.box(jaw, [x - 0.5, 26, -22.6], [1, 1.6, 1], "eye")
m.write((4, 4))
spit = {}
for t0 in (0.8, 1.2, 1.6):
    spit.update({f"{t0 - 0.1:.2f}": [0, 0, 0], f"{t0:.2f}": [32, 0, 0], f"{t0 + 0.15:.2f}": [0, 0, 0]})
anim_file("earth_dragon", {"animation.aegis.earth_dragon.rise": {"loop": "hold_on_last_frame", "animation_length": 3.7, "bones": {
    "root": {"position": {"0.0": [0, -46, 0], "0.15": [0, -30, 0], "0.3": [0, -14, 0], "0.5": [0, 1, 0], "0.6": [0, 0, 0],
                          "3.0": [0, 0, 0], "3.6": [0, -48, 0]},
             "rotation": {"0.0": [0, 0, 3], "0.1": [0, 0, -3], "0.2": [0, 0, 3], "0.3": [0, 0, -3], "0.4": [0, 0, 2], "0.6": [0, 0, 0],
                          "3.0": [0, 0, 0], "3.1": [0, 0, -2], "3.2": [0, 0, 2], "3.3": [0, 0, -2], "3.6": [0, 0, 0]}},
    "head": {"rotation": {"0.0": [-20, 0, 0], "0.6": [8, 0, 0], "0.75": [0, 0, 0], "1.8": [0, 0, 0], "2.1": [-6, 0, 0]}},
    "jaw": {"rotation": {"0.0": [0, 0, 0], **spit, "2.0": [0, 0, 0]}}}}})

# ---------------------------------------------------------------- client + server entities
w(RP / "render_controllers" / "jutsu3.render_controllers.json", {"format_version": "1.8.0", "render_controllers": {
    "controller.render.aegis.fx_lit": {"geometry": "Geometry.default", "materials": [{"*": "Material.default"}], "textures": ["Texture.default"]},
    "controller.render.aegis.fx_glow": {"geometry": "Geometry.default", "materials": [{"*": "Material.default"}], "textures": ["Texture.default"],
                                        "ignore_lighting": True}}})
MODELS = {
    "water_shark": ("entity_alphablend", "animation.aegis.water_shark.swim", "fx_lit", 6),
    "lightning_hound": ("entity_alphablend", "animation.aegis.lightning_hound.run", "fx_glow", 6),
    "fire_dragon": ("entity_alphablend", "animation.aegis.fire_dragon.fly", "fx_glow", 6),
    "earth_dragon": ("entity_alphatest", "animation.aegis.earth_dragon.rise", "fx_lit", 6),
}
for ident, (mat, anim, rc, life) in MODELS.items():
    w(RP / "entity" / f"{ident}.entity.json", {"format_version": "1.10.0", "minecraft:client_entity": {"description": {
        "identifier": f"aegis:{ident}", "materials": {"default": mat}, "textures": {"default": f"textures/entity/aegis/{ident}"},
        "geometry": {"default": f"geometry.aegis.{ident}"}, "animations": {"play": anim}, "scripts": {"animate": ["play"]},
        "render_controllers": [f"controller.render.aegis.{rc}"]}}})
    w(BP / "entities" / f"{ident}.json", {"format_version": "1.21.0", "minecraft:entity": {
        "description": {"identifier": f"aegis:{ident}", "is_spawnable": False, "is_summonable": True, "is_experimental": False},
        "component_groups": {"aegis:expire": {"minecraft:instant_despawn": {}}},
        "components": {
            "minecraft:type_family": {"family": ["aegis_fx", "inanimate"]},
            "minecraft:collision_box": {"width": 0.05, "height": 0.05},
            "minecraft:physics": {"has_gravity": False, "has_collision": False},
            "minecraft:pushable": {"is_pushable": False, "is_pushable_by_piston": False},
            "minecraft:damage_sensor": {"triggers": [{"cause": "all", "deals_damage": "no"}]},
            "minecraft:fire_immune": {},
            "minecraft:knockback_resistance": {"value": 1},
            "minecraft:timer": {"time": life, "looping": False, "time_down_event": {"event": "aegis:expire", "target": "self"}}},
        "events": {"aegis:expire": {"add": {"component_groups": ["aegis:expire"]}}}}})

# the white-out of Hiding in Mist
w(RP / "fogs" / "aegis_mist.json", {"format_version": "1.16.100", "minecraft:fog_settings": {
    "description": {"identifier": "aegis:fog_mist"},
    "distance": {"air": {"fog_start": 0.0, "fog_end": 6.0, "fog_color": "#D8E0E6", "render_distance_type": "fixed"},
                 "weather": {"fog_start": 0.0, "fog_end": 6.0, "fog_color": "#D8E0E6", "render_distance_type": "fixed"},
                 "water": {"fog_start": 0.0, "fog_end": 4.0, "fog_color": "#B8CCDA", "render_distance_type": "fixed"}}}})
# Big Ball Rasengan: the Rasengan orb at 2.4x size (jutsu_orb variant 0 + scale). Its centre sits 0.6 above the entity.
orb_p = BP / "entities" / "jutsu_orb.json"
orb = json.loads(orb_p.read_text())
oe = orb["minecraft:entity"]
oe["component_groups"]["aegis:big_rasengan"] = {"minecraft:variant": {"value": 0}, "minecraft:scale": {"value": 2.4}}
oe["events"]["aegis:as_big_rasengan"] = {"add": {"component_groups": ["aegis:big_rasengan"]}}
w(orb_p, orb)

print(f"Jutsu wave 3: {len(SCROLLS)} scrolls, {len(MODELS)} models.")
