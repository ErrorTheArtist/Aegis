#!/usr/bin/env python3
"""Generates NPCs: humanoid NPC entities + 16 procedural skins, summon animals (models),
the creative-only NPC Spawner block, ramen + summon scroll items, loot tables and spawn rules.
Run from the shinobi-addon folder:  python3 tools/gen_npcs.py
"""
import json
import math
import random
from pathlib import Path
from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
BP, RP = ROOT / "behavior_pack", ROOT / "resource_pack"


def w(path, obj):
    path.parent.mkdir(parents=True, exist_ok=True)
    with open(path, "w") as f:
        json.dump(obj, f, indent=2, ensure_ascii=False)
        f.write("\n")


# ---------------------------------------------------------------------------
# Skins (64x64 standard humanoid layout)
# ---------------------------------------------------------------------------
class Skin:
    def __init__(self):
        self.img = Image.new("RGBA", (64, 64), (0, 0, 0, 0))

    def px(self, x, y, c):
        self.img.putpixel((x, y), tuple(c) + (255,))

    def rect(self, x, y, w_, h, c):
        for i in range(x, x + w_):
            for j in range(y, y + h):
                self.px(i, j, c)

    @staticmethod
    def faces(ox, oy, w_, h, d):
        return {"top": (ox + d, oy, w_, d), "bottom": (ox + d + w_, oy, w_, d), "right": (ox, oy + d, d, h),
                "front": (ox + d, oy + d, w_, h), "left": (ox + d + w_, oy + d, d, h), "back": (ox + 2 * d + w_, oy + d, w_, h)}

    def part(self, which):
        return {"head": self.faces(0, 0, 8, 8, 8), "body": self.faces(16, 16, 8, 12, 4),
                "rarm": self.faces(40, 16, 4, 12, 4), "larm": self.faces(32, 48, 4, 12, 4),
                "rleg": self.faces(0, 16, 4, 12, 4), "lleg": self.faces(16, 48, 4, 12, 4)}[which]

    def fill(self, which, c, faces=None, rows=None):
        for name, (x, y, w_, h) in self.part(which).items():
            if faces and name not in faces:
                continue
            if rows is None or name in ("top", "bottom"):
                if rows is None or (name == "top" and 0 in range(*rows)):
                    self.rect(x, y, w_, h, c)
                continue
            r0, r1 = rows
            self.rect(x, y + r0, w_, max(0, min(h, r1) - r0), c)

    def shade(self):
        random.seed(7)
        for x in range(64):
            for y in range(64):
                r, g, b, a = self.img.getpixel((x, y))
                if a:
                    k = random.uniform(0.93, 1.05)
                    self.img.putpixel((x, y), (min(255, int(r * k)), min(255, int(g * k)), min(255, int(b * k)), a))


SKINC = (225, 180, 140)
STEEL = (170, 175, 185)


def humanoid(o):
    s = Skin()
    sk = o.get("skin", SKINC)
    for p in ("head", "rarm", "larm"):
        s.fill(p, sk)
    s.fill("body", o["top"])
    for arm in ("rarm", "larm"):
        s.fill(arm, o.get("sleeve", o["top"]), rows=(0, o.get("sleeve_len", 9)))
    for leg in ("rleg", "lleg"):
        s.fill(leg, o["pants"])
        s.fill(leg, o.get("shoes", (40, 40, 50)), faces=("front", "back", "left", "right"), rows=(10, 12))
    if "vest" in o:  # flak jacket front/back
        for face in ("front", "back"):
            x, y, w_, h = s.part("body")[face]
            s.rect(x, y, 2, 10, o["vest"]); s.rect(x + 6, y, 2, 10, o["vest"])
            if face == "front":
                s.rect(x + 2, y + 2, 4, 2, o["vest"])
    if "belt" in o:
        for face in ("front", "back", "left", "right"):
            x, y, w_, h = s.part("body")[face]
            s.rect(x, y + 10, w_, 1, o["belt"])
    if "apron" in o:
        x, y, w_, h = s.part("body")["front"]
        s.rect(x + 1, y + 2, 6, 10, o["apron"])
        for leg in ("rleg", "lleg"):
            x, y, w_, h = s.part(leg)["front"]
            s.rect(x, y, w_, 6, o["apron"])
    if o.get("cloak"):  # Akatsuki: black cloak with red clouds, down to the knees, high collar
        blk = (20, 20, 25)
        s.fill("body", blk)
        for arm in ("rarm", "larm"):
            s.fill(arm, blk, rows=(0, 10))
        for leg in ("rleg", "lleg"):
            s.fill(leg, blk, faces=("front", "back", "left", "right"), rows=(0, 7))
        for (part, face, cx, cy) in (("body", "front", 1, 2), ("body", "back", 3, 5), ("body", "front", 4, 8),
                                      ("rarm", "right", 0, 3), ("larm", "left", 0, 5), ("rleg", "front", 0, 2)):
            x, y, w_, h = s.part(part)[face]
            s.rect(x + cx, y + cy, min(3, w_ - cx), 2, (235, 235, 235))
            s.rect(x + cx, y + cy + 0, min(3, w_ - cx), 1, (200, 20, 25))
        for face in ("front", "left", "right", "back"):
            x, y, w_, h = s.part("head")[face]
            s.rect(x, y + 6, w_, 2, blk)  # collar
    # head features
    hair = o.get("hair")
    head = s.part("head")
    if hair:
        s.rect(*head["top"], hair)
        s.rect(*head["back"][:2], 8, o.get("hair_back", 8), hair)
        for side in ("left", "right"):
            x, y, w_, h = head[side]
            s.rect(x, y, w_, o.get("hair_side", 3), hair)
        x, y, w_, h = head["front"]
        s.rect(x, y, 8, o.get("bangs", 2), hair)
        if o.get("long_hair"):
            for side in ("left", "right"):
                x, y, w_, h = head[side]
                s.rect(x, y, w_, 7, hair)
            s.rect(head["front"][0], head["front"][1] + 2, 1, 5, hair)
    x, y, _, _ = head["front"]
    eye = o.get("eyes", (40, 40, 60))
    white = o.get("sclera", (250, 250, 250))
    s.px(x + 1, y + 4, white); s.px(x + 2, y + 4, eye)
    s.px(x + 5, y + 4, eye); s.px(x + 6, y + 4, white)
    if o.get("edo"):  # Edo Tensei: cracked, ashen face
        crack = (95, 88, 82)
        for px_, py_ in ((0, 3), (1, 3), (1, 5), (0, 6), (6, 3), (7, 3), (6, 5), (7, 6), (2, 6), (5, 6), (4, 7)):
            s.px(x + px_, y + py_, crack)
    if o.get("marks"):  # Tobirama's red face markings
        red = (190, 35, 40)
        for px_, py_ in ((1, 5), (1, 6), (6, 5), (6, 6), (3, 7), (4, 7)):
            s.px(x + px_, y + py_, red)
    if o.get("lock"):  # a lock of hair over one eye (Madara)
        s.rect(x + 5, y + 2, 3, 3, hair)
    if not o.get("cloak") and not o.get("mask"):
        s.rect(x + 3, y + 6, 2, 1, (150, 90, 80))
    if o.get("hat"):
        hc, trim = o["hat"]
        s.rect(*head["top"], hc)
        for face in ("front", "left", "right", "back"):
            fx, fy, fw, fh = head[face]
            s.rect(fx, fy, fw, 2, hc)
            if trim:
                s.rect(fx, fy + 2, fw, 1, trim)
    if o.get("band"):
        band, plate = o["band"]
        for face in ("front", "left", "right", "back"):
            fx, fy, fw, fh = head[face]
            s.rect(fx, fy + 2, fw, 1, band)
        s.rect(x + 2, y + 2, 4, 1, plate)
        if o.get("slashed"):
            s.px(x + 3, y + 2, (40, 40, 40)); s.px(x + 4, y + 2, (40, 40, 40))
    if o.get("mask") == "lower":
        for face in ("front", "left", "right"):
            fx, fy, fw, fh = head[face]
            s.rect(fx, fy + 5, fw, 3, (30, 40, 70))
    if o.get("mask") == "anbu":
        s.rect(x + 1, y + 1, 6, 7, (240, 240, 240))
        s.px(x + 2, y + 4, (20, 20, 20)); s.px(x + 5, y + 4, (20, 20, 20))
        s.rect(x + 1, y + 2, 1, 2, (200, 30, 30)); s.rect(x + 6, y + 2, 1, 2, (200, 30, 30))
    if o.get("bandana"):
        s.rect(*head["top"], o["bandana"])
        for face in ("front", "left", "right", "back"):
            fx, fy, fw, fh = head[face]
            s.rect(fx, fy, fw, 2, o["bandana"])
    if o.get("whiskers"):  # Naruto's whisker marks
        for dy in (5, 6):
            s.px(x + 0, y + dy, (90, 60, 50)); s.px(x + 7, y + dy, (90, 60, 50))
    if o.get("diamond"):  # Tsunade's forehead seal
        s.px(x + 3, y + 3, (150, 60, 170)); s.px(x + 4, y + 3, (150, 60, 170))
    if o.get("haori"):  # long coat over the outfit (Minato / Tsunade / Hokage)
        col, hem = o["haori"]
        for face in ("left", "right", "back"):
            bx, by, bw, bh = s.part("body")[face]
            s.rect(bx, by, bw, bh, col)
        fx_, fy_, fw_, fh_ = s.part("body")["front"]
        s.rect(fx_, fy_, 2, fh_, col); s.rect(fx_ + 6, fy_, 2, fh_, col)
        for arm in ("rarm", "larm"):
            s.fill(arm, col, rows=(0, 10))
        for leg in ("rleg", "lleg"):
            s.fill(leg, col, faces=("left", "right", "back"), rows=(0, 6))
            if hem:
                for face in ("front", "left", "right", "back"):
                    lx_, ly_, lw_, lh_ = s.part(leg)[face]
                    for i in range(lw_):
                        s.px(lx_ + i, ly_ + 5 - (i % 2), hem)
    if o.get("armor"):  # Warring States samurai armour: chest plate, shoulder guards, skirt plates
        col, trim = o["armor"]
        for face in ("front", "back", "left", "right"):
            bx, by, bw, bh = s.part("body")[face]
            s.rect(bx, by + 1, bw, 8, col)
            for yy in (3, 5, 7):
                s.rect(bx, by + yy, bw, 1, trim)
        for arm in ("rarm", "larm"):
            s.fill(arm, col, rows=(0, 3))
            for face in ("front", "back", "left", "right"):
                ax, ay, aw, ah = s.part(arm)[face]
                s.rect(ax, ay + 3, aw, 1, trim)
        for leg in ("rleg", "lleg"):
            s.fill(leg, col, faces=("front", "back", "left", "right"), rows=(0, 5))
            for face in ("front", "back", "left", "right"):
                lx, ly, lw, lh = s.part(leg)[face]
                s.rect(lx, ly + 2, lw, 1, trim)
    if o.get("fur"):  # Tobirama's white fur collar
        for face in ("front", "back", "left", "right"):
            bx, by, bw, bh = s.part("body")[face]
            s.rect(bx, by, bw, 2, o["fur"])
        for arm in ("rarm", "larm"):
            s.fill(arm, o["fur"], rows=(0, 1))
    if o.get("rope"):  # Sound ninja purple rope belt
        for face in ("front", "back", "left", "right"):
            bx, by, bw, bh = s.part("body")[face]
            s.rect(bx, by + 9, bw, 2, (120, 60, 160))
    s.shade()
    return s.img


SKINS = [
    ("sensei", dict(hair=(200, 205, 210), top=(40, 50, 90), pants=(40, 50, 90), vest=(80, 110, 60), band=((40, 60, 140), STEEL), mask="lower", hair_side=4)),
    ("elder", dict(hair=(235, 235, 235), top=(215, 200, 170), sleeve=(215, 200, 170), sleeve_len=11, pants=(200, 185, 150), belt=(120, 40, 40), hair_back=6)),
    ("weaponsmith", dict(hair=(90, 60, 40), top=(110, 110, 115), pants=(70, 60, 50), apron=(120, 80, 50), band=((60, 60, 60), STEEL))),
    ("ramen_chef", dict(hair=(60, 40, 30), top=(240, 240, 240), pants=(240, 240, 240), hat=((245, 245, 245), None), apron=(230, 230, 220), shoes=(60, 60, 60))),
    ("hokage", dict(hair=(240, 220, 120), top=(240, 240, 240), sleeve_len=11, pants=(40, 50, 90), hat=((240, 240, 240), (200, 30, 30)), belt=(200, 30, 30))),
    ("proctor", dict(hair=(30, 30, 30), top=(25, 25, 30), sleeve_len=11, pants=(25, 25, 30), bandana=(30, 30, 35), band=((30, 30, 35), STEEL))),
    ("genin_orange", dict(hair=(240, 200, 60), top=(240, 120, 30), pants=(240, 120, 30), band=((40, 60, 140), STEEL), sleeve_len=11)),
    ("genin_blue", dict(hair=(25, 25, 40), top=(40, 60, 140), pants=(225, 225, 225), band=((40, 60, 140), STEEL), sleeve_len=4)),
    ("genin_pink", dict(hair=(240, 140, 180), top=(200, 40, 50), pants=(60, 60, 70), band=((200, 40, 50), STEEL), sleeve_len=2, hair_side=6)),
    ("rogue", dict(hair=(70, 60, 55), top=(90, 90, 95), pants=(60, 60, 65), band=((50, 50, 60), STEEL), slashed=True, mask="lower")),
    ("sound", dict(hair=(150, 150, 160), top=(200, 185, 150), pants=(90, 80, 100), rope=True, band=((50, 50, 60), STEEL))),
    ("anbu", dict(hair=(110, 110, 120), top=(140, 140, 145), pants=(30, 30, 35), vest=(200, 200, 205), mask="anbu", sleeve_len=2)),
    ("itachi", dict(hair=(20, 20, 25), cloak=True, top=(20, 20, 25), pants=(30, 30, 50), eyes=(200, 20, 20), band=((30, 30, 40), STEEL), slashed=True, hair_back=8)),
    ("kisame", dict(skin=(110, 140, 170), hair=(40, 60, 120), cloak=True, top=(20, 20, 25), pants=(30, 30, 50), eyes=(240, 240, 240), band=((30, 30, 40), STEEL), slashed=True)),
    ("deidara", dict(hair=(240, 210, 90), cloak=True, top=(20, 20, 25), pants=(30, 30, 50), eyes=(60, 120, 200), long_hair=True, band=((30, 30, 40), STEEL), slashed=True)),
    ("chunin", dict(hair=(80, 55, 35), top=(40, 50, 90), pants=(40, 50, 90), vest=(80, 110, 60), band=((40, 60, 140), STEEL))),
    # --- legendary bosses (NPC Spawner only) ---
    ("naruto", dict(hair=(250, 205, 50), top=(240, 120, 30), sleeve=(30, 30, 35), sleeve_len=4, pants=(240, 120, 30), eyes=(60, 120, 230),
                    band=((30, 30, 40), STEEL), whiskers=True, hair_side=4, bangs=3)),
    ("sasuke", dict(hair=(20, 20, 30), top=(235, 235, 235), sleeve_len=11, pants=(40, 40, 60), rope=True, eyes=(210, 20, 20), hair_back=8, hair_side=5, bangs=3)),
    ("tsunade", dict(hair=(245, 220, 120), top=(130, 130, 125), pants=(40, 40, 60), diamond=True, long_hair=True, haori=((80, 140, 70), None),
                     eyes=(160, 120, 60))),
    ("sarutobi", dict(hair=(150, 150, 150), top=(240, 240, 240), sleeve_len=11, pants=(240, 240, 240), hat=((240, 240, 240), (200, 30, 30)),
                      belt=(200, 30, 30), skin=(210, 170, 135))),
    ("minato", dict(hair=(250, 215, 70), top=(40, 50, 90), pants=(40, 50, 90), vest=(80, 110, 60), band=((40, 60, 140), STEEL),
                    haori=((245, 245, 245), (210, 40, 30)), eyes=(60, 120, 230), hair_side=5, bangs=3)),
    # the rest of the Akatsuki (hand-made skins in tools/skins/)
    ("pain", dict(hair=(30, 30, 30), cloak=True, top=(20, 20, 25), pants=(30, 30, 50))),
    ("konan", dict(hair=(30, 30, 30), cloak=True, top=(20, 20, 25), pants=(30, 30, 50))),
    ("hidan", dict(hair=(30, 30, 30), cloak=True, top=(20, 20, 25), pants=(30, 30, 50))),
    ("hidan_jashin", dict(hair=(30, 30, 30), cloak=True, top=(20, 20, 25), pants=(30, 30, 50))),
    ("kakuzu", dict(hair=(30, 30, 30), cloak=True, top=(20, 20, 25), pants=(30, 30, 50))),
    ("sasori", dict(hair=(30, 30, 30), cloak=True, top=(20, 20, 25), pants=(30, 30, 50))),
    ("zetsu", dict(hair=(30, 30, 30), cloak=True, top=(20, 20, 25), pants=(30, 30, 50))),
    ("tobi", dict(hair=(30, 30, 30), cloak=True, top=(20, 20, 25), pants=(30, 30, 50))),
    # Edo Tensei: the founders (reanimated — ashen, cracked skin, black sclera)
    ("madara", dict(sleeve_len=11, skin=(196, 186, 176), edo=True, sclera=(25, 22, 24), eyes=(210, 25, 30), hair=(22, 20, 26), long_hair=True, hair_back=8,
                    hair_side=7, bangs=3, lock=True, top=(40, 40, 70), pants=(40, 40, 70), armor=((150, 30, 30), (95, 15, 20)), shoes=(35, 30, 30))),
    ("hashirama", dict(sleeve_len=11, skin=(198, 186, 172), edo=True, sclera=(25, 22, 24), eyes=(90, 60, 40), hair=(55, 38, 28), long_hair=True, hair_back=8,
                       hair_side=7, top=(40, 40, 70), pants=(40, 40, 70), armor=((165, 40, 35), (100, 20, 20)), band=((40, 60, 140), STEEL))),
    ("tobirama", dict(sleeve_len=11, skin=(200, 192, 182), edo=True, sclera=(25, 22, 24), eyes=(190, 30, 40), hair=(225, 228, 232), hair_side=4, bangs=3,
                      top=(30, 30, 45), pants=(30, 30, 45), armor=((45, 75, 150), (25, 40, 90)), fur=(240, 240, 240), marks=True,
                      band=((40, 60, 140), STEEL))),
    # v1.46: the Travelling Merchant (hand-painted by tools/gen_npc_gear.py; this is only the fallback). Append new skins
    # at the end — the index is stored on every NPC (aegis:skin).
    ("merchant", dict(hair=(120, 112, 106), top=(176, 120, 52), sleeve_len=6, pants=(86, 72, 62), belt=(46, 58, 98), shoes=(198, 170, 106))),
    # v1.49 (hand-painted by tools/gen_npc_models.py; these are only fallbacks): the Leaf kunoichi, and the Hidden Sand
    ("chunin_f", dict(hair=(132, 56, 40), top=(40, 50, 92), pants=(40, 50, 92), vest=(80, 110, 60), band=((40, 60, 140), STEEL), long_hair=True)),
    ("kazekage", dict(hair=(178, 54, 44), top=(240, 240, 240), sleeve_len=11, pants=(190, 160, 110), hat=((240, 240, 240), (40, 150, 120)), belt=(40, 150, 120))),
    ("sand_shinobi", dict(hair=(228, 214, 180), top=(192, 158, 102), pants=(112, 94, 74), band=((84, 64, 48), STEEL))),
    ("sand_jonin", dict(hair=(240, 236, 224), top=(178, 150, 102), pants=(52, 58, 72), band=((52, 58, 72), STEEL))),
    ("puppeteer", dict(hair=(38, 36, 46), top=(38, 36, 46), sleeve_len=11, pants=(38, 36, 46), belt=(92, 70, 52))),
    ("sand_genin_a", dict(hair=(92, 64, 44), top=(226, 206, 166), pants=(126, 104, 78), belt=(58, 112, 138), band=((84, 64, 48), STEEL))),
    ("sand_genin_b", dict(hair=(42, 36, 42), top=(178, 194, 204), pants=(84, 92, 104), band=((84, 64, 48), STEEL))),
    # v1.50: the Mist, Cloud, Stone and Rain villages (gen_npc_models.py) — leaders, shinobi, jōnin, weaponsmiths, genin
    ("mizukage", dict(hair=(150, 64, 40), top=(240, 240, 240), sleeve_len=11, pants=(55, 45, 110), hat=((240, 240, 240), (40, 100, 210)), belt=(40, 100, 210), long_hair=True)),
    ("raikage", dict(skin=(128, 84, 58), hair=(242, 242, 238), top=(240, 240, 240), sleeve_len=2, pants=(35, 35, 40), hat=((240, 240, 240), (240, 200, 40)), belt=(240, 200, 40))),
    ("tsuchikage", dict(hair=(236, 236, 232), top=(240, 240, 240), sleeve_len=11, pants=(80, 100, 55), hat=((240, 240, 240), (125, 90, 50)), belt=(125, 90, 50))),
    ("rain_leader", dict(hair=(30, 28, 34), top=(64, 58, 78), sleeve_len=11, pants=(40, 38, 50), band=((62, 66, 78), STEEL), long_hair=True)),
    ("mist_shinobi", dict(hair=(40, 46, 62), top=(44, 54, 72), sleeve_len=7, pants=(62, 70, 84), vest=(112, 130, 142), band=((42, 50, 66), STEEL))),
    ("cloud_shinobi", dict(skin=(146, 98, 70), hair=(196, 56, 48), top=(54, 54, 62), pants=(54, 54, 62), vest=(234, 228, 210), band=((44, 44, 52), STEEL))),
    ("stone_shinobi", dict(hair=(36, 32, 36), top=(146, 48, 44), pants=(92, 70, 56), vest=(130, 94, 64), band=((118, 42, 38), STEEL))),
    ("rain_shinobi", dict(hair=(50, 48, 60), top=(90, 98, 114), sleeve_len=11, pants=(54, 58, 68), band=((62, 66, 78), STEEL))),
    ("mist_jonin", dict(hair=(64, 92, 132), top=(44, 54, 72), sleeve_len=11, pants=(62, 70, 84), vest=(96, 112, 124), mask="lower")),
    ("cloud_jonin", dict(skin=(146, 98, 70), hair=(232, 232, 236), top=(54, 54, 62), pants=(54, 54, 62), vest=(234, 228, 210), band=((44, 44, 52), STEEL))),
    ("stone_jonin", dict(hair=(70, 52, 40), top=(146, 48, 44), pants=(92, 70, 56), vest=(130, 94, 64), band=((118, 42, 38), STEEL))),
    ("rain_jonin", dict(hair=(74, 70, 92), top=(74, 70, 92), sleeve_len=11, pants=(54, 58, 68), mask="lower")),
    ("mist_swordsman", dict(hair=(34, 34, 40), top=(120, 126, 122), sleeve_len=2, pants=(98, 110, 104), mask="lower", band=((42, 50, 66), STEEL))),
    ("cloud_blademaster", dict(skin=(146, 98, 70), hair=(244, 236, 214), top=(54, 54, 62), pants=(54, 54, 62), vest=(234, 228, 210))),
    ("stone_smith", dict(skin=(206, 160, 122), hair=(206, 160, 122), top=(146, 48, 44), pants=(92, 70, 56), apron=(110, 74, 46))),
    ("rain_umbrella", dict(hair=(64, 54, 78), top=(90, 98, 114), sleeve_len=11, pants=(54, 58, 68), mask="lower", band=((62, 66, 78), STEEL))),
    ("mist_genin_a", dict(hair=(40, 46, 62), top=(120, 140, 160), pants=(62, 70, 84), band=((42, 50, 66), STEEL))),
    ("mist_genin_b", dict(hair=(70, 46, 60), top=(172, 202, 222), pants=(70, 80, 96), band=((42, 50, 66), STEEL))),
    ("cloud_genin_a", dict(skin=(146, 98, 70), hair=(236, 236, 240), top=(222, 216, 198), pants=(54, 54, 62), band=((44, 44, 52), STEEL))),
    ("cloud_genin_b", dict(hair=(240, 212, 120), top=(204, 204, 214), pants=(60, 60, 70), band=((44, 44, 52), STEEL))),
    ("stone_genin_a", dict(hair=(92, 66, 46), top=(146, 48, 44), pants=(92, 70, 56), band=((118, 42, 38), STEEL))),
    ("stone_genin_b", dict(hair=(36, 32, 36), top=(130, 94, 64), pants=(80, 62, 50), band=((118, 42, 38), STEEL))),
    ("rain_genin_a", dict(hair=(50, 48, 60), top=(110, 118, 134), pants=(54, 58, 68), band=((62, 66, 78), STEEL))),
    ("rain_genin_b", dict(hair=(92, 62, 112), top=(150, 132, 172), pants=(64, 62, 78), band=((62, 66, 78), STEEL))),
]
(RP / "textures" / "entity" / "aegis" / "npc").mkdir(parents=True, exist_ok=True)
for name, o in SKINS:
    custom = Path(__file__).parent / "skins" / f"{name}.png"  # hand-made skins override the generated ones
    (Image.open(custom).convert("RGBA") if custom.exists() else humanoid(o)).save(RP / "textures" / "entity" / "aegis" / "npc" / f"{name}.png")

skin_tex = {f"s{i}": f"textures/entity/aegis/npc/{n}" for i, (n, _) in enumerate(SKINS)}
# 3D gear worn over some skins (tools/gen_npc_gear.py + tools/gen_npc_models.py)
# (every skin that has a gear model of its own: resource_pack/models/entity/gear_<name>.geo.json)
GEAR = {n: i for i, (n, _) in enumerate(SKINS) if (RP / "models" / "entity" / f"gear_{n}.geo.json").exists()}
w(RP / "render_controllers" / "npc.render_controllers.json", {"format_version": "1.8.0", "render_controllers": {
    "controller.render.aegis.npc": {
        "arrays": {"textures": {"Array.skins": [f"Texture.s{i}" for i in range(len(SKINS))]}},
        "geometry": "Geometry.default", "materials": [{"*": "Material.default"}],
        "textures": ["Array.skins[q.property('aegis:skin')]"]},
    **{f"controller.render.aegis.npc_gear_{n}": {
        "geometry": f"Geometry.gear_{n}", "materials": [{"*": "Material.default"}], "textures": [f"Texture.gear_{n}"]} for n in GEAR}}})

HUMANOID_ANIMS = {"humanoid_base_pose": "animation.humanoid.base_pose", "look_at_target": "animation.humanoid.look_at_target.default",
                  "move": "animation.humanoid.move", "attack.rotations": "animation.humanoid.attack.rotations", "bob": "animation.humanoid.bob"}
WALK_PRE = ["variable.tcos0 = (math.cos(query.modified_distance_moved * 38.17) * query.modified_move_speed) * 57.3;"]
SKIN_PROP = {"aegis:skin": {"type": "int", "range": [0, len(SKINS) - 1], "default": 0, "client_sync": True}}


def client_humanoid(ident, egg):
    w(RP / "entity" / f"{ident}.entity.json", {"format_version": "1.10.0", "minecraft:client_entity": {"description": {
        "identifier": f"aegis:{ident}", "materials": {"default": "entity_alphatest"},
        "textures": {**skin_tex, **{f"gear_{n}": f"textures/entity/aegis/npc/gear_{n}" for n in GEAR}},
        "geometry": {"default": "geometry.humanoid.custom", **{f"gear_{n}": f"geometry.aegis.gear_{n}" for n in GEAR}},
        "animations": {**HUMANOID_ANIMS, "gear": "animation.aegis.npc_gear.flutter"},
        # the vanilla walk cycle reads variable.tcos0 — mobs have to compute it themselves, or the legs never move
        "scripts": {"pre_animation": WALK_PRE, "animate": list(HUMANOID_ANIMS) + ["gear"]},
        "render_controllers": ["controller.render.aegis.npc",
                               *({f"controller.render.aegis.npc_gear_{n}": f"q.property('aegis:skin') == {i}"} for n, i in GEAR.items())],
        "enable_attachables": True, "spawn_egg": {"base_color": egg[0], "overlay_color": egg[1]}}}})


BASE_MOVE = {"minecraft:movement.basic": {}, "minecraft:jump.static": {}, "minecraft:can_climb": {},
             "minecraft:navigation.walk": {"can_path_over_water": True, "can_open_doors": True, "avoid_damage_blocks": True},
             "minecraft:physics": {}, "minecraft:collision_box": {"width": 0.6, "height": 1.8},
             "minecraft:breathable": {"total_supply": 15, "suffocate_time": 0},
             "minecraft:behavior.float": {"priority": 0}}
TALK = {"minecraft:interact": {"interactions": [{
    "on_interact": {"filters": {"test": "is_family", "subject": "other", "value": "player"}, "event": "aegis:talked", "target": "self"},
    "interact_text": "Talk", "swing": True}]}}
COMMON_GROUPS = {
    "aegis:stay": {"minecraft:movement": {"value": 0.0}},
    "aegis:wander": {"minecraft:behavior.random_stroll": {"priority": 8, "speed_multiplier": 0.6, "xz_dist": 6}},
    "aegis:invulnerable": {"minecraft:damage_sensor": {"triggers": [{"cause": "all", "deals_damage": "no"}]}},
    "aegis:despawnable": {"minecraft:despawn": {"despawn_from_distance": {"min_distance": 32, "max_distance": 80}}},
}
COMMON_EVENTS = {
    "aegis:stay": {"remove": {"component_groups": ["aegis:wander"]}, "add": {"component_groups": ["aegis:stay"]}},
    "aegis:wander": {"remove": {"component_groups": ["aegis:stay"]}, "add": {"component_groups": ["aegis:wander"]}},
    "aegis:invulnerable": {"add": {"component_groups": ["aegis:invulnerable"]}},
    "aegis:vulnerable": {"remove": {"component_groups": ["aegis:invulnerable"]}},
    "aegis:persist": {"remove": {"component_groups": ["aegis:despawnable"]}},
    "aegis:talked": {},
}


def entity(ident, comps, groups=None, events=None, spawnable=True, props=True):
    desc = {"identifier": f"aegis:{ident}", "is_spawnable": spawnable, "is_summonable": True, "is_experimental": False}
    if props:
        desc["properties"] = SKIN_PROP
    w(BP / "entities" / f"{ident}.json", {"format_version": "1.21.0", "minecraft:entity": {
        "description": desc, "component_groups": {**COMMON_GROUPS, **(groups or {})},
        "components": comps, "events": {**COMMON_EVENTS, **(events or {})}}})


# Friendly NPCs (shops, mission desk, proctor, clan elder)
entity("npc", {**BASE_MOVE, **TALK,
    "minecraft:type_family": {"family": ["npc_ninja", "npc"]},
    "minecraft:health": {"value": 40, "max": 40},
    "minecraft:movement": {"value": 0.25},
    "minecraft:pushable": {"is_pushable": False, "is_pushable_by_piston": False},
    "minecraft:knockback_resistance": {"value": 1.0},
    "minecraft:persistent": {},
    "minecraft:nameable": {"always_show": True, "allow_name_tag_renaming": False},
    "minecraft:behavior.look_at_player": {"priority": 7, "look_distance": 8, "probability": 0.6},
    "minecraft:behavior.random_look_around": {"priority": 9},
    "minecraft:behavior.panic": {"priority": 1, "speed_multiplier": 1.2}}, spawnable=True)
client_humanoid("npc", ("#4a6a3a", "#2a3a6a"))

# Hostile ninja: rogue / sound / anbu tiers
TIER = {
    "rogue": {"minecraft:health": {"value": 40, "max": 40}, "minecraft:attack": {"damage": 5}},
    "sound": {"minecraft:health": {"value": 50, "max": 50}, "minecraft:attack": {"damage": 6}},
    "anbu": {"minecraft:health": {"value": 80, "max": 80}, "minecraft:attack": {"damage": 8}, "minecraft:movement": {"value": 0.29}},
}
entity("hostile_ninja", {**BASE_MOVE,
    "minecraft:type_family": {"family": ["ninja", "monster", "mob"]},
    "minecraft:health": {"value": 40, "max": 40},
    "minecraft:attack": {"damage": 5},
    "minecraft:movement": {"value": 0.26},
    "minecraft:pushable": {"is_pushable": True, "is_pushable_by_piston": True},
    "minecraft:nameable": {},
    "minecraft:loot": {"table": "loot_tables/entities/aegis_ninja.json"},
    "minecraft:experience_reward": {"on_death": "q.last_hit_by_player ? 12 : 0"},
    "minecraft:follow_range": {"value": 32},
    "minecraft:behavior.melee_attack": {"priority": 2, "speed_multiplier": 1.0, "track_target": True},
    "minecraft:behavior.hurt_by_target": {"priority": 1},
    "minecraft:behavior.nearest_attackable_target": {"priority": 3, "must_see": True, "reselect_targets": True, "within_radius": 24,
        "entity_types": [{"filters": {"any_of": [{"test": "is_family", "subject": "other", "value": "player"},
                                                  {"test": "is_family", "subject": "other", "value": "chakra_clone"},
                                                  {"test": "is_family", "subject": "other", "value": "ninja_companion"}]}, "max_dist": 24}]},
    "minecraft:behavior.random_stroll": {"priority": 7, "speed_multiplier": 0.8},
    "minecraft:behavior.look_at_player": {"priority": 8, "look_distance": 12}},
    groups={f"aegis:tier_{t}": c for t, c in TIER.items()},
    events={**{f"aegis:tier_{t}": {"remove": {"component_groups": [f"aegis:tier_{o}" for o in TIER if o != t]},
                                   "add": {"component_groups": [f"aegis:tier_{t}"]}} for t in TIER},
            "minecraft:entity_spawned": {"add": {"component_groups": ["aegis:despawnable"]}}})
client_humanoid("hostile_ninja", ("#5a5a5f", "#8a2020"))

def equip(name, item):
    """Component group that puts a weapon in the NPC's hand (drawn through the item's attachable); it never drops."""
    w(BP / "loot_tables" / "equipment" / f"aegis_{name}.json", {"pools": [{"rolls": 1, "entries": [{"type": "item", "name": item, "weight": 1}]}]})
    return {"minecraft:equipment": {"table": f"loot_tables/equipment/aegis_{name}.json",
                                    "slot_drop_chance": [{"slot": "slot.weapon.mainhand", "drop_chance": 0.0}]}}


# Akatsuki bosses
entity("akatsuki", {**BASE_MOVE,
    "minecraft:type_family": {"family": ["akatsuki", "ninja", "monster", "mob"]},
    "minecraft:health": {"value": 500, "max": 500},
    "minecraft:attack": {"damage": 12},
    "minecraft:movement": {"value": 0.27},
    "minecraft:boss": {"hud_range": 48, "should_darken_sky": False},
    "minecraft:knockback_resistance": {"value": 0.7},
    "minecraft:pushable": {"is_pushable": False, "is_pushable_by_piston": False},
    "minecraft:nameable": {"always_show": True},
    "minecraft:fire_immune": {},
    "minecraft:damage_sensor": {"triggers": [{"cause": "fall", "deals_damage": "no"}]},
    "minecraft:loot": {"table": "loot_tables/entities/aegis_akatsuki.json"},
    "minecraft:experience_reward": {"on_death": "q.last_hit_by_player ? 300 : 0"},
    "minecraft:follow_range": {"value": 48},
    "minecraft:behavior.melee_attack": {"priority": 2, "speed_multiplier": 1.05, "track_target": True},
    "minecraft:behavior.hurt_by_target": {"priority": 1},
    "minecraft:behavior.nearest_attackable_target": {"priority": 3, "must_see": False, "reselect_targets": True, "within_radius": 40,
        "entity_types": [{"filters": {"any_of": [{"test": "is_family", "subject": "other", "value": "player"},
                                                  {"test": "is_family", "subject": "other", "value": "ninja_companion"}]}, "max_dist": 40}]},
    "minecraft:behavior.random_stroll": {"priority": 7, "speed_multiplier": 0.7},
    "minecraft:behavior.look_at_player": {"priority": 8, "look_distance": 16}},
    groups={"aegis:persistent": {"minecraft:persistent": {}}, "aegis:equip_kisame": equip("kisame", "aegis:samehada")},
    events={"minecraft:entity_spawned": {"add": {"component_groups": ["aegis:despawnable"]}},
            "aegis:persist": {"remove": {"component_groups": ["aegis:despawnable"]}, "add": {"component_groups": ["aegis:persistent"]}},
            "aegis:equip_kisame": {"add": {"component_groups": ["aegis:equip_kisame"]}}})
client_humanoid("akatsuki", ("#141418", "#c81419"))

# Legendary bosses — only ever created by an NPC Spawner (no spawn rules).
LEGEND_HP = {"naruto": 900, "sasuke": 850, "tsunade": 950, "sarutobi": 800, "minato": 750, "madara": 1800}
entity("legend", {**BASE_MOVE,
    "minecraft:type_family": {"family": ["legend", "ninja", "monster", "mob"]},
    "minecraft:health": {"value": 800, "max": 800},
    "minecraft:attack": {"damage": 14},
    "minecraft:movement": {"value": 0.28},
    "minecraft:boss": {"hud_range": 48, "should_darken_sky": False},
    "minecraft:knockback_resistance": {"value": 0.8},
    "minecraft:pushable": {"is_pushable": False, "is_pushable_by_piston": False},
    "minecraft:nameable": {"always_show": True},
    "minecraft:persistent": {},
    "minecraft:fire_immune": {},
    "minecraft:damage_sensor": {"triggers": [{"cause": "fall", "deals_damage": "no"}]},
    "minecraft:loot": {"table": "loot_tables/entities/aegis_legend.json"},
    "minecraft:experience_reward": {"on_death": "q.last_hit_by_player ? 500 : 0"},
    "minecraft:follow_range": {"value": 48},
    "minecraft:behavior.melee_attack": {"priority": 2, "speed_multiplier": 1.05, "track_target": True},
    "minecraft:behavior.hurt_by_target": {"priority": 1},
    "minecraft:behavior.nearest_attackable_target": {"priority": 3, "must_see": False, "reselect_targets": True, "within_radius": 32,
        "entity_types": [{"filters": {"any_of": [{"test": "is_family", "subject": "other", "value": "player"},
                                                  {"test": "is_family", "subject": "other", "value": "ninja_companion"}]}, "max_dist": 32}]},
    "minecraft:behavior.random_stroll": {"priority": 7, "speed_multiplier": 0.7},
    "minecraft:behavior.look_at_player": {"priority": 8, "look_distance": 16}},
    groups={f"aegis:legend_{k}": {"minecraft:health": {"value": hp, "max": hp}, **(equip("sasuke", "aegis:kusanagi_drawn") if k == "sasuke" else {})}
            for k, hp in LEGEND_HP.items()},
    events={f"aegis:legend_{k}": {"add": {"component_groups": [f"aegis:legend_{k}"]}} for k in LEGEND_HP})
client_humanoid("legend", ("#f0782a", "#1e1e28"))

# Recruitable genin companion
COMPANION_TAMED = {
    "minecraft:is_tamed": {},
    "minecraft:behavior.follow_owner": {"priority": 4, "speed_multiplier": 1.0, "start_distance": 8, "stop_distance": 3},
    "minecraft:behavior.owner_hurt_by_target": {"priority": 1},
    "minecraft:behavior.owner_hurt_target": {"priority": 2},
}
entity("genin", {**BASE_MOVE, **TALK,
    "minecraft:type_family": {"family": ["ninja_companion", "npc", "mob"]},
    "minecraft:health": {"value": 30, "max": 30},
    "minecraft:attack": {"damage": 5},
    "minecraft:movement": {"value": 0.26},
    "minecraft:pushable": {"is_pushable": True, "is_pushable_by_piston": True},
    "minecraft:nameable": {"always_show": True},
    "minecraft:persistent": {},
    "minecraft:damage_sensor": {"triggers": [{"cause": "fall", "deals_damage": "no"}]},
    "minecraft:tameable": {"probability": 0.0, "tame_items": "minecraft:barrier", "tame_event": {"event": "aegis:tamed", "target": "self"}},
    "minecraft:behavior.melee_attack": {"priority": 3, "speed_multiplier": 1.0, "track_target": True},
    "minecraft:behavior.nearest_attackable_target": {"priority": 5, "must_see": True, "within_radius": 16,
        "entity_types": [{"filters": {"test": "is_family", "subject": "other", "value": "monster"}, "max_dist": 16}]},
    "minecraft:behavior.look_at_player": {"priority": 8, "look_distance": 8}},
    groups={"aegis:tamed": COMPANION_TAMED},
    events={"aegis:tamed": {"add": {"component_groups": ["aegis:tamed"]}}})
client_humanoid("genin", ("#f0782a", "#283c8c"))

# ---------------------------------------------------------------------------
# Summon animals: generated voxel models
# ---------------------------------------------------------------------------
MAIN, ACCENT, DARK, EYE = [0, 0], [0, 64], [0, 96], [64, 96]


def cube(o, s, uv, inflate=0):
    c = {"origin": [round(v, 2) for v in o], "size": s, "uv": uv}
    if inflate:
        c["inflate"] = inflate
    return c


def animal_texture(main, accent, dark, eye, stripes=None):
    img = Image.new("RGBA", (128, 128), (0, 0, 0, 0))
    random.seed(sum(main))

    def fill(x0, y0, x1, y1, col, var=12):
        for x in range(x0, x1):
            for y in range(y0, y1):
                d = random.randint(-var, var)
                img.putpixel((x, y), tuple(max(0, min(255, c + d)) for c in col) + (255,))
    fill(0, 0, 128, 64, main)
    if stripes:
        for y in range(0, 64, 8):
            for x in range(128):
                if (x // 6) % 3 == 0:
                    img.putpixel((x, y), stripes + (255,))
                    img.putpixel((x, y + 1), stripes + (255,))
    fill(0, 64, 128, 96, accent)
    fill(0, 96, 64, 128, dark, 6)
    fill(64, 96, 128, 128, eye, 3)
    return img


def toad():
    b = [{"name": "body", "pivot": [0, 10, 0], "cubes": [cube([-12, 6, -12], [24, 16, 26], MAIN), cube([-11, 5, -11], [22, 3, 22], ACCENT)]},
         {"name": "head", "parent": "body", "pivot": [0, 18, -12], "cubes": [
             cube([-13, 14, -20], [26, 10, 12], MAIN), cube([-12, 13, -21], [24, 2, 2], DARK),
             cube([-10, 24, -16], [6, 5, 6], MAIN), cube([4, 24, -16], [6, 5, 6], MAIN),
             cube([-9, 25, -16.5], [4, 3, 1], EYE), cube([5, 25, -16.5], [4, 3, 1], EYE)]}]
    legs = []
    for i, (x, z, w_, h) in enumerate([(-14, -10, 6, 8), (8, -10, 6, 8), (-15, 8, 8, 7), (7, 8, 8, 7)]):
        legs.append(f"leg{i}")
        b.append({"name": f"leg{i}", "parent": "body", "pivot": [x + w_ / 2, h, z + 3], "cubes": [cube([x, 0, z], [w_, h, 6], ACCENT)]})
    return b, legs, []


def slug():
    b = [{"name": "body", "pivot": [0, 6, 0], "cubes": [cube([-8, 0, -14], [16, 11, 34], MAIN), cube([-9, 0, -12], [18, 3, 30], ACCENT)]},
         {"name": "head", "parent": "body", "pivot": [0, 8, -14], "cubes": [
             cube([-7, 0, -24], [14, 15, 10], MAIN),
             cube([-5, 15, -20], [2, 8, 2], MAIN), cube([3, 15, -20], [2, 8, 2], MAIN),
             cube([-6, 23, -21], [4, 3, 4], EYE), cube([2, 23, -21], [4, 3, 4], EYE)]}]
    return b, [], []


def snake():
    b = [{"name": "root", "pivot": [0, 0, 0]}]
    segs = []
    parent = "root"
    for i in range(7):
        w_ = 9 - i // 2
        name = f"seg{i}"
        segs.append(name)
        z0 = -4 + i * 9
        b.append({"name": name, "parent": parent, "pivot": [0, w_ / 2, z0], "cubes": [
            cube([-w_ / 2, 0, z0], [w_, w_, 10], MAIN), cube([-w_ / 2 + 1, -0.01, z0], [w_ - 2, 1, 10], ACCENT)]})
        parent = name
    b.append({"name": "head", "parent": "root", "pivot": [0, 5, -4], "cubes": [
        cube([-6, 0, -16], [12, 9, 12], MAIN), cube([-5, 0, -18], [10, 3, 2], ACCENT),
        cube([-6.5, 6, -13], [2, 2, 3], EYE), cube([4.5, 6, -13], [2, 2, 3], EYE),
        cube([-3, -2, -17], [1, 2, 1], DARK), cube([2, -2, -17], [1, 2, 1], DARK)]})
    return b, [], segs


ANIMALS = {
    "summon_toad": dict(name="Summoned Toad", build=toad, tex=((200, 70, 40), (110, 60, 140), (60, 20, 15), (250, 220, 60)), stripes=(120, 50, 150),
                        hp=120, dmg=10, speed=0.28, box=(1.6, 1.7), egg=("#c84628", "#6e3c8c")),
    "summon_slug": dict(name="Summoned Slug", build=slug, tex=((235, 240, 245), (90, 150, 230), (60, 70, 90), (40, 40, 40)), stripes=(110, 160, 235),
                        hp=90, dmg=4, speed=0.18, box=(1.2, 1.2), egg=("#ebf0f5", "#5a96e6")),
    "summon_snake": dict(name="Summoned Snake", build=snake, tex=((110, 60, 150), (230, 220, 200), (30, 20, 40), (250, 200, 40)), stripes=(80, 40, 110),
                         hp=70, dmg=7, speed=0.4, box=(1.0, 0.8), egg=("#6e3c96", "#e6dcc8")),
}
anim_all = {}
for aid, a in ANIMALS.items():
    bones, legs, segs = a["build"]()
    w(RP / "models" / "entity" / f"{aid}.geo.json", {"format_version": "1.12.0", "minecraft:geometry": [{
        "description": {"identifier": f"geometry.aegis.{aid}", "texture_width": 128, "texture_height": 128,
                        "visible_bounds_width": 5, "visible_bounds_height": 4, "visible_bounds_offset": [0, 1, 0]},
        "bones": bones}]})
    animal_texture(*a["tex"], stripes=a["stripes"]).save(RP / "textures" / "entity" / "aegis" / f"{aid}.png")
    walk = "math.cos(q.modified_distance_moved * 30) * 30 * math.min(1, q.modified_move_speed * 2)"
    ab = {"head": {"rotation": ["q.target_x_rotation * 0.5", "q.target_y_rotation * 0.5", 0]}}
    for i, n in enumerate(legs):
        ab[n] = {"rotation": [f"{1 if i in (0, 3) else -1} * {walk}", 0, 0]}
    for i, n in enumerate(segs):
        ab[n] = {"rotation": [0, f"math.sin(q.life_time * 300 + {i * 50}) * 14", 0]}
    if aid == "summon_slug":
        ab["body"] = {"scale": [1, "1 + math.sin(q.life_time * 200) * 0.05", "1 - math.sin(q.life_time * 200) * 0.03"]}
    if aid == "summon_toad":
        ab["body"] = {"scale": [f"1 + math.sin(q.life_time * 120) * 0.03", 1, f"1 + math.sin(q.life_time * 120) * 0.03"]}
    anim_all[f"animation.aegis.{aid}.idle"] = {"loop": True, "bones": ab}
    w(RP / "entity" / f"{aid}.entity.json", {"format_version": "1.10.0", "minecraft:client_entity": {"description": {
        "identifier": f"aegis:{aid}", "materials": {"default": "entity_alphatest"},
        "textures": {"default": f"textures/entity/aegis/{aid}"}, "geometry": {"default": f"geometry.aegis.{aid}"},
        "animations": {"idle": f"animation.aegis.{aid}.idle"}, "scripts": {"animate": ["idle"]},
        "render_controllers": ["controller.render.default"], "spawn_egg": {"base_color": a["egg"][0], "overlay_color": a["egg"][1]}}}})
    comps = {**BASE_MOVE,
        "minecraft:collision_box": {"width": a["box"][0], "height": a["box"][1]},
        "minecraft:type_family": {"family": ["ninja_companion", "summon", "mob"]},
        "minecraft:health": {"value": a["hp"], "max": a["hp"]},
        "minecraft:attack": {"damage": a["dmg"]},
        "minecraft:movement": {"value": a["speed"]},
        "minecraft:pushable": {"is_pushable": False, "is_pushable_by_piston": False},
        "minecraft:nameable": {},
        "minecraft:persistent": {},
        "minecraft:damage_sensor": {"triggers": [{"cause": "fall", "deals_damage": "no"}]},
        "minecraft:tameable": {"probability": 0.0, "tame_items": "minecraft:barrier", "tame_event": {"event": "aegis:tamed", "target": "self"}},
        "minecraft:timer": {"time": 45, "looping": False, "time_down_event": {"event": "aegis:expire", "target": "self"}},
        "minecraft:behavior.melee_attack": {"priority": 3, "speed_multiplier": 1.3, "track_target": True},
        "minecraft:behavior.nearest_attackable_target": {"priority": 5, "must_see": False, "within_radius": 20,
            "entity_types": [{"filters": {"test": "is_family", "subject": "other", "value": "monster"}, "max_dist": 20}]},
        "minecraft:behavior.random_stroll": {"priority": 8}}
    w(BP / "entities" / f"{aid}.json", {"format_version": "1.21.0", "minecraft:entity": {
        "description": {"identifier": f"aegis:{aid}", "is_spawnable": True, "is_summonable": True, "is_experimental": False},
        "component_groups": {"aegis:tamed": COMPANION_TAMED, "aegis:expire": {"minecraft:instant_despawn": {}}},
        "components": comps,
        "events": {"aegis:tamed": {"add": {"component_groups": ["aegis:tamed"]}},
                   "aegis:expire": {"add": {"component_groups": ["aegis:expire"]}}}}})
w(RP / "animations" / "summons.animation.json", {"format_version": "1.8.0", "animations": anim_all})

# ---------------------------------------------------------------------------
# Loot tables + natural spawning
# ---------------------------------------------------------------------------
def cnt(lo, hi):
    return [{"function": "set_count", "count": {"min": lo, "max": hi}}]


w(BP / "loot_tables" / "entities" / "aegis_ninja.json", {"pools": [
    {"rolls": 1, "entries": [{"type": "item", "name": "aegis:ryo", "weight": 1, "functions": cnt(1, 3)}]},
    {"rolls": 1, "entries": [{"type": "item", "name": "aegis:kunai", "weight": 1, "functions": cnt(1, 4)}, {"type": "empty", "weight": 1}]},
    # (blank scrolls dropped here until v1.46 — with crafting gone they had no use; their share went to "nothing")
    {"rolls": 1, "entries": [{"type": "item", "name": "aegis:chakra_pill", "weight": 3},
                             {"type": "item", "name": "aegis:shuriken", "weight": 2, "functions": cnt(2, 6)}, {"type": "empty", "weight": 8}]}]})
w(BP / "loot_tables" / "entities" / "aegis_legend.json", {"pools": [
    {"rolls": 1, "entries": [{"type": "item", "name": "aegis:ryo", "weight": 1, "functions": cnt(16, 32)}]},
    {"rolls": 1, "entries": [{"type": "item", "name": "minecraft:diamond", "weight": 1, "functions": cnt(3, 8)}]},
    {"rolls": 1, "entries": [{"type": "item", "name": "aegis:chakra_pill", "weight": 1, "functions": cnt(4, 8)}]}]})
w(BP / "loot_tables" / "entities" / "aegis_akatsuki.json", {"pools": [
    {"rolls": 1, "entries": [{"type": "item", "name": "aegis:ryo", "weight": 1, "functions": cnt(10, 20)}]},
    {"rolls": 1, "entries": [{"type": "item", "name": "minecraft:diamond", "weight": 1, "functions": cnt(2, 5)}]},
    {"rolls": 1, "entries": [{"type": "item", "name": "aegis:reroll_scroll", "weight": 1}, {"type": "item", "name": "aegis:bijuu_scroll", "weight": 1},
                             {"type": "item", "name": "aegis:shibuki", "weight": 1},
                             {"type": "empty", "weight": 4}]},
    {"rolls": 1, "entries": [{"type": "item", "name": "aegis:akatsuki_cloak", "weight": 1}, {"type": "item", "name": "aegis:akatsuki_hat", "weight": 1},
                             {"type": "empty", "weight": 2}]}]})
# Rogue / Sound / Anbu ninja wander the overworld day and night (faction picked by script).
w(BP / "spawn_rules" / "hostile_ninja.json", {"format_version": "1.8.0", "minecraft:spawn_rules": {
    "description": {"identifier": "aegis:hostile_ninja", "population_control": "monster"},
    "conditions": [
        {"minecraft:spawns_on_surface": {}, "minecraft:spawns_on_block_filter": ["minecraft:grass_block", "minecraft:dirt", "minecraft:sand",
                                                                                 "minecraft:podzol", "minecraft:snow", "minecraft:coarse_dirt", "minecraft:stone"],
         "minecraft:brightness_filter": {"min": 0, "max": 15, "adjust_for_weather": False},
         "minecraft:difficulty_filter": {"min": "easy", "max": "hard"},
         "minecraft:weight": {"default": 30},
         "minecraft:herd": {"min_size": 1, "max_size": 3},
         "minecraft:density_limit": {"surface": 6},
         "minecraft:biome_filter": {"test": "has_biome_tag", "operator": "==", "value": "overworld"}},
        {"minecraft:spawns_underground": {},
         "minecraft:brightness_filter": {"min": 0, "max": 7, "adjust_for_weather": True},
         "minecraft:difficulty_filter": {"min": "easy", "max": "hard"},
         "minecraft:weight": {"default": 8},
         "minecraft:herd": {"min_size": 1, "max_size": 2},
         "minecraft:density_limit": {"underground": 2},
         "minecraft:biome_filter": {"test": "has_biome_tag", "operator": "==", "value": "overworld"}}]}})
# Rare Akatsuki (Itachi / Kisame / Deidara, picked by script) roaming the surface.
w(BP / "spawn_rules" / "akatsuki.json", {"format_version": "1.8.0", "minecraft:spawn_rules": {
    "description": {"identifier": "aegis:akatsuki", "population_control": "monster"},
    "conditions": [{
        "minecraft:spawns_on_surface": {}, "minecraft:spawns_on_block_filter": ["minecraft:grass_block", "minecraft:dirt", "minecraft:sand", "minecraft:snow"],
        "minecraft:brightness_filter": {"min": 0, "max": 15, "adjust_for_weather": False},
        "minecraft:difficulty_filter": {"min": "normal", "max": "hard"},
        "minecraft:weight": {"default": 1},
        "minecraft:herd": {"min_size": 1, "max_size": 1},
        "minecraft:density_limit": {"surface": 1},
        "minecraft:biome_filter": {"test": "has_biome_tag", "operator": "==", "value": "overworld"}}]}})

# ---------------------------------------------------------------------------
# NPC Spawner block (creative only: no recipe, drops nothing)
# ---------------------------------------------------------------------------
w(BP / "blocks" / "npc_spawner.json", {"format_version": "1.21.60", "minecraft:block": {
    "description": {"identifier": "aegis:npc_spawner", "menu_category": {"category": "items"}},
    "components": {
        "minecraft:geometry": "minecraft:geometry.full_block",
        "minecraft:material_instances": {"*": {"texture": "aegis_npc_spawner", "render_method": "opaque"}},
        "minecraft:destructible_by_mining": {"seconds_to_destroy": 60},
        "minecraft:destructible_by_explosion": False,
        "minecraft:loot": "loot_tables/empty.json",
        "minecraft:display_name": "NPC Spawner",
        "minecraft:map_color": "#2a1a3a"}}})
w(BP / "loot_tables" / "empty.json", {"pools": []})
tt_path = RP / "textures" / "terrain_texture.json"
tt = json.loads(tt_path.read_text()) if tt_path.exists() else {"resource_pack_name": "shinobi_way", "texture_name": "atlas.terrain", "padding": 8, "num_mip_levels": 4, "texture_data": {}}
tt["texture_data"]["aegis_npc_spawner"] = {"textures": "textures/blocks/aegis/npc_spawner"}
w(tt_path, tt)
blk = Image.new("RGBA", (16, 16), (0, 0, 0, 255))
for x in range(16):
    for y in range(16):
        edge = x in (0, 15) or y in (0, 15)
        grid = x % 5 == 0 or y % 5 == 0
        blk.putpixel((x, y), (90, 60, 130, 255) if edge else (55, 40, 75, 255) if grid else (30, 22, 42, 255))
for x, y in [(7, 5), (8, 5), (6, 6), (9, 6), (6, 7), (9, 7), (7, 8), (8, 8), (7, 9), (8, 9), (6, 10), (9, 10)]:
    blk.putpixel((x, y), (255, 170, 40, 255))
(RP / "textures" / "blocks" / "aegis").mkdir(parents=True, exist_ok=True)
blk.save(RP / "textures" / "blocks" / "aegis" / "npc_spawner.png")

# ---------------------------------------------------------------------------
# Items: ramen + summoning scrolls
# ---------------------------------------------------------------------------
def item(ident, name, comps, category="items"):
    w(BP / "items" / f"{ident}.json", {"format_version": "1.21.60", "minecraft:item": {
        "description": {"identifier": f"aegis:{ident}", "menu_category": {"category": category}},
        "components": {"minecraft:icon": {"textures": {"default": f"aegis_{ident}"}}, "minecraft:display_name": {"value": name}, **comps}}})


food = lambda n, sat: {"minecraft:max_stack_size": 16, "minecraft:food": {"nutrition": n, "saturation_modifier": sat, "can_always_eat": True, "using_converts_to": "minecraft:bowl"},
                       "minecraft:use_animation": "eat", "minecraft:use_modifiers": {"use_duration": 1.4, "movement_modifier": 0.4}}
item("ramen", "§6Ichiraku Ramen§r\n§7Heals, restores 60 chakra, Regeneration", food(10, 1.2))
item("miso_ramen", "§eMiso Ramen§r\n§7Restores 30 chakra, Speed", food(8, 0.9))
for s_, n in (("toad", "Toad"), ("slug", "Slug"), ("snake", "Snake")):
    item(f"summon_{s_}_scroll", f"§dSummoning Jutsu: {n}§r\n§7Summons an ally for 45s (40 chakra)", {"minecraft:max_stack_size": 1, "minecraft:glint": True}, "equipment")

ICONS = RP / "textures" / "items" / "aegis"


def bowl(broth, topping):
    img = Image.new("RGBA", (16, 16), (0, 0, 0, 0))
    for x in range(16):
        for y in range(16):
            dx, dy = x - 7.5, (y - 9) * 1.4
            if 7 <= y <= 13 and abs(dx) <= 7 - (y - 7) * 0.6:
                img.putpixel((x, y), (200, 40, 40, 255) if y > 8 else (230, 230, 230, 255))
            if y in (6, 7) and abs(dx) <= 7:
                img.putpixel((x, y), broth + (255,))
    for x, y in [(4, 6), (6, 5), (9, 6), (11, 5)]:
        img.putpixel((x, y), topping + (255,))
    for y in range(1, 6):
        img.putpixel((12, y), (120, 80, 40, 255)); img.putpixel((13, y - 1), (120, 80, 40, 255))
    return img


bowl((230, 190, 110), (250, 240, 200)).save(ICONS / "ramen.png")
bowl((200, 150, 80), (90, 140, 60)).save(ICONS / "miso_ramen.png")
scroll_rows = ["................", "................", "..rRRRRRRRRRRr..", "..rRRRRRRRRRRr..", "...PPPPPPPPPP...", "...PPPPPPPPPP...",
               "...PPPCCCCPPP...", "...PPCCCCCCPP...", "...PPCCCCCCPP...", "...PPPCCCCPPP...", "...PPPPPPPPPP...", "...pppppppppp...",
               "..rRRRRRRRRRRr..", "..rRRRRRRRRRRr..", "................", "................"]
for s_, col in (("toad", (220, 90, 40)), ("slug", (120, 170, 240)), ("snake", (130, 70, 170))):
    img = Image.new("RGBA", (16, 16), (0, 0, 0, 0))
    pal = {"P": (235, 220, 180), "p": (190, 165, 120), "R": (60, 40, 90), "r": (40, 25, 60), "C": col}
    for y, row in enumerate(scroll_rows):
        for x, ch in enumerate(row):
            if ch in pal:
                img.putpixel((x, y), pal[ch] + (255,))
    img.save(ICONS / f"summon_{s_}_scroll.png")

atlas_path = RP / "textures" / "item_texture.json"
atlas = json.loads(atlas_path.read_text())
for i in ["ramen", "miso_ramen", "summon_toad_scroll", "summon_slug_scroll", "summon_snake_scroll"]:
    atlas["texture_data"][f"aegis_{i}"] = {"textures": f"textures/items/aegis/{i}"}
w(atlas_path, atlas)

lang_path = RP / "texts" / "en_US.lang"
lines = [l for l in lang_path.read_text().splitlines() if not any(k in l for k in ("aegis:npc", "aegis:hostile_ninja", "aegis:akatsuki", "aegis:genin", "aegis:legend", "aegis:summon_", "tile.aegis:"))]
lines += ["entity.aegis:npc.name=Shinobi", "item.spawn_egg.entity.aegis:npc.name=Spawn Shinobi NPC",
          "entity.aegis:hostile_ninja.name=Rogue Ninja", "item.spawn_egg.entity.aegis:hostile_ninja.name=Spawn Rogue Ninja",
          "entity.aegis:akatsuki.name=Akatsuki", "item.spawn_egg.entity.aegis:akatsuki.name=Spawn Akatsuki",
          "entity.aegis:genin.name=Genin", "item.spawn_egg.entity.aegis:genin.name=Spawn Genin",
          "entity.aegis:legend.name=Legendary Shinobi", "item.spawn_egg.entity.aegis:legend.name=Spawn Legendary Shinobi",
          "tile.aegis:npc_spawner.name=NPC Spawner"]
for aid, a in ANIMALS.items():
    lines += [f"entity.aegis:{aid}.name={a['name']}", f"item.spawn_egg.entity.aegis:{aid}.name=Spawn {a['name']}"]
lang_path.write_text("\n".join(lines) + "\n")
print("Generated NPCs:", len(SKINS), "skins,", len(ANIMALS), "summon animals, spawner block.")
print("SKIN ORDER:", [n for n, _ in SKINS])

# Detailed 32x32 icons (ramen, summon scrolls…) are drawn by gen_icons.py — re-draw them last.
import subprocess
import sys

subprocess.run([sys.executable, str(ROOT / "tools" / "gen_icons.py")], check=True)
