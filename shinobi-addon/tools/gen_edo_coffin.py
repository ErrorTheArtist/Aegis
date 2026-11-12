#!/usr/bin/env python3
"""Edo Tensei cinematic props (models, textures, animations, entities):

  aegis:edo_coffin — a planked wooden coffin with iron bands and a sealing talisman. It bursts out of the ground in
                     jerks (rubble flies, the earth cracks), stands, the lid creaks and crashes forward, and at the
                     end the whole thing sinks back into the earth.
  aegis:edo_seal   — the summoning formula: ink script that races out across the ground from the caster's palms to the
                     spot where the coffin rises.

Key times (seconds after each entity spawns) are exported in TIMES and mirrored in behavior_pack/scripts/edo_shots.js.
Preview with tools/cine_preview.py.   Run from the shinobi-addon folder:  python3 tools/gen_edo_coffin.py
"""
import json
import math
import random
from pathlib import Path
from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parent.parent
BP, RP = ROOT / "behavior_pack", ROOT / "resource_pack"
random.seed(11)

TIMES = {"rise_start": 0.15, "risen": 2.3, "creak": 3.5, "fall": 4.0, "thud": 4.4, "sink": 9.0, "gone": 10.4}


def w(path, obj):
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(obj, indent=1, ensure_ascii=False) + "\n")


# ---------------------------------------------------------------------------
# Texture atlas with per-face painting
# ---------------------------------------------------------------------------
AT = 256
atlas = Image.new("RGBA", (AT, AT), (0, 0, 0, 0))
_cur = [0, 0, 0]  # x, y, shelf height


def alloc(wd, ht):
    if _cur[0] + wd > AT:
        _cur[0], _cur[1], _cur[2] = 0, _cur[1] + _cur[2] + 1, 0
    x, y = _cur[0], _cur[1]
    _cur[0] += wd + 1
    _cur[2] = max(_cur[2], ht)
    assert y + ht <= AT, "atlas full"
    return x, y


def clamp(v):
    return max(0, min(255, int(v)))


def tint(c, k):
    return tuple(clamp(v * k) for v in c)


WOOD = (124, 86, 52)
BEAM = (86, 58, 36)
INSIDE = (40, 28, 22)
IRON = (62, 62, 68)


def planks(wd, ht, base=WOOD, vertical=True, plank=6, seams=True, nails=True, ao=True):
    """A wooden face: planks with their own tone, grain streaks, knots, dark seams, nail heads and darkened edges."""
    im = Image.new("RGBA", (wd, ht))
    px = im.load()
    n_long, n_across = (ht, wd) if vertical else (wd, ht)
    offset = random.randrange(plank)
    tones = {}
    for a in range(n_across):
        pi = (a + offset) // plank
        if pi not in tones:
            tones[pi] = (random.uniform(0.86, 1.1), [random.uniform(0.9, 1.08) for _ in range(n_long)], random.random())
        k, grain, knot = tones[pi]
        streak = random.uniform(0.93, 1.05)
        for b in range(n_long):
            g = grain[b] * 0.35 + 0.65
            c = tint(base, k * streak * g)
            if seams and (a + offset) % plank == 0:
                c = tint(base, 0.5)
            x, y = (a, b) if vertical else (b, a)
            px[x, y] = c + (255,)
        if knot < 0.25 and (a + offset) % plank == plank // 2 and n_long > 10:
            b = random.randrange(3, n_long - 3)
            for db in (-1, 0, 1):
                x, y = (a, b + db) if vertical else (b + db, a)
                px[x, y] = tint(base, 0.6 if db == 0 else 0.78) + (255,)
    if nails and n_long > 12:
        for a in range(n_across):
            if (a + offset) % plank == plank // 2:
                for b in (1, n_long - 2):
                    x, y = (a, b) if vertical else (b, a)
                    px[x, y] = (46, 40, 40, 255)
    if ao:
        for x in range(wd):
            for y in range(ht):
                e = min(x, y, wd - 1 - x, ht - 1 - y)
                if e == 0:
                    px[x, y] = tint(px[x, y][:3], 0.72) + (255,)
    return im


def inside(wd, ht):
    im = planks(wd, ht, INSIDE, plank=6, nails=False, ao=False)
    px = im.load()
    for x in range(wd):          # darker toward the bottom and the corners: it reads as depth
        for y in range(ht):
            k = 1.0 - 0.35 * (y / max(1, ht - 1)) - 0.25 * (abs(x - (wd - 1) / 2) / max(1, wd / 2)) ** 2
            px[x, y] = tint(px[x, y][:3], k) + (255,)
    return im


def lid_front(wd, ht):
    im = planks(wd, ht, tint(WOOD, 1.06), plank=5)
    d = ImageDraw.Draw(im)
    d.rectangle([0, 0, wd - 1, ht - 1], outline=tint(BEAM, 0.75) + (255,))          # frame beam
    d.rectangle([1, 1, wd - 2, ht - 2], outline=BEAM + (255,))
    d.rectangle([2, 2, wd - 3, ht - 3], outline=tint(WOOD, 0.7) + (255,))
    for by in (8, ht - 11):                                                         # iron bands with rivets
        d.rectangle([0, by, wd - 1, by + 2], fill=IRON + (255,))
        d.line([0, by, wd - 1, by], fill=tint(IRON, 1.45) + (255,))
        d.line([0, by + 2, wd - 1, by + 2], fill=tint(IRON, 0.6) + (255,))
        for x in range(2, wd - 1, 4):
            d.point((x, by + 1), fill=(150, 150, 158, 255))
    tx, ty, tw, th_ = wd // 2 - 3, 13, 6, ht - 28                                    # the sealing talisman
    d.rectangle([tx, ty, tx + tw - 1, ty + th_ - 1], fill=(232, 222, 192, 255), outline=(176, 160, 128, 255))
    d.line([tx + tw, ty + 1, tx + tw, ty + th_], fill=tint(WOOD, 0.55) + (255,))    # its shadow
    red = (158, 28, 26, 255)
    d.line([tx + 2, ty + 2, tx + 2, ty + th_ - 3], fill=red)
    d.line([tx + 3, ty + 2, tx + 3, ty + th_ - 3], fill=red)
    for yy in range(ty + 3, ty + th_ - 3, 3):
        d.line([tx + 1, yy, tx + 4, yy], fill=red)
    d.rectangle([tx + 1, ty + th_ // 2 - 2, tx + 4, ty + th_ // 2 + 1], outline=red)
    return im


def beam(wd, ht):
    return planks(wd, ht, BEAM, vertical=False, plank=4, nails=False)


def rock(wd, ht):
    im = Image.new("RGBA", (wd, ht))
    px = im.load()
    base = random.choice([(96, 84, 70), (82, 74, 66), (110, 92, 70), (74, 62, 50)])
    for x in range(wd):
        for y in range(ht):
            px[x, y] = tint(base, random.uniform(0.78, 1.15)) + (255,)
    return im


def paint(im):
    u, v = alloc(*im.size)
    atlas.paste(im, (u, v))
    return [u, v]


def cube(origin, size, painters):
    """painters: {face: fn(w, h) -> image}; faces left out are not drawn."""
    wd, ht, dp = size
    dims = {"north": (wd, ht), "south": (wd, ht), "east": (dp, ht), "west": (dp, ht), "up": (wd, dp), "down": (wd, dp)}
    uv = {}
    for face, fn in painters.items():
        fw, fh = dims[face]
        uv[face] = {"uv": paint(fn(fw, fh)), "uv_size": [fw, fh]}
    return {"origin": origin, "size": size, "uv": uv}


def all_faces(fn, **over):
    return {**{f: fn for f in ("north", "south", "east", "west", "up", "down")}, **over}


# ---------------------------------------------------------------------------
# Coffin geometry (front = -Z, the side that faces the summoner). 16 px = 1 block.
# ---------------------------------------------------------------------------
H = 46
box_cubes = [
    cube([-13, 0, -7], [26, 2, 16], all_faces(beam)),                                                    # plinth
    cube([-13, H, -9], [26, 3, 18], all_faces(beam)),                                                    # roof cap
    cube([-11, 2, -7], [2, H - 2, 16], {"west": planks, "east": inside, "north": beam, "south": planks}),  # left wall
    cube([9, 2, -7], [2, H - 2, 16], {"east": planks, "west": inside, "north": beam, "south": planks}),    # right wall
    cube([-9, 2, 7], [18, H - 2, 2], {"north": inside, "south": planks}),                                # back
    cube([-9, 2, -7], [18, 0, 14], {"up": inside}),                                                      # floor
    cube([-9, H, -7], [18, 0, 14], {"down": inside}),                                                    # ceiling
]
lid_cubes = [cube([-11, 0, -9], [22, H, 2], {"north": lid_front, "south": inside, "east": beam, "west": beam, "up": beam, "down": beam})]

RUBBLE = []  # (bone, size, direction angle, distance, apex, start time)
bones = [
    {"name": "root", "pivot": [0, 0, 0]},
    {"name": "coffin", "parent": "root", "pivot": [0, 0, 0]},
    {"name": "box", "parent": "coffin", "pivot": [0, 0, 0], "cubes": box_cubes},
    {"name": "lid", "parent": "coffin", "pivot": [0, 0, -9], "cubes": lid_cubes},
]
for i in range(10):
    s = random.choice([2, 2, 3, 3, 4])
    ang = i / 10 * math.tau + random.uniform(-0.25, 0.25)
    dist = random.uniform(17, 30)
    RUBBLE.append((f"rubble{i}", s, ang, dist, random.uniform(9, 20), 0.12 + (i % 5) * 0.16 + random.uniform(0, 0.08)))
    bones.append({"name": f"rubble{i}", "parent": "root", "pivot": [0, s / 2, 0],
                  "cubes": [cube([-s / 2, 0, -s / 2], [s, s, s], all_faces(rock))]})


# cracked earth around the hole (flat decal)
def cracks(size=64):
    im = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    c = size / 2
    d.ellipse([c - 16, c - 12, c + 16, c + 12], fill=(24, 18, 14, 255))             # the broken earth under the coffin
    for i in range(11):
        a = i / 11 * math.tau + random.uniform(-0.2, 0.2)
        x, y, r = c + math.cos(a) * 12, c + math.sin(a) * 9, 0
        length = random.uniform(12, 24)
        width = 3
        while r < length:
            a += random.uniform(-0.5, 0.5)
            step = random.uniform(2, 4)
            nx, ny = x + math.cos(a) * step, y + math.sin(a) * step
            d.line([x, y, nx, ny], fill=(20, 15, 12, 255), width=max(1, int(width)))
            if random.random() < 0.3 and r > 4:                                      # a side branch
                b = a + random.choice([-1, 1]) * random.uniform(0.6, 1.1)
                d.line([nx, ny, nx + math.cos(b) * 5, ny + math.sin(b) * 5], fill=(20, 15, 12, 255))
            x, y, r, width = nx, ny, r + step, width - 0.45
    return im


crack_uv = paint(cracks())
bones.append({"name": "cracks", "parent": "root", "pivot": [0, 0, 0],
              "cubes": [{"origin": [-32, 0.4, -32], "size": [64, 0, 64], "uv": {"up": {"uv": crack_uv, "uv_size": [64, 64]}}}]})

w(RP / "models" / "entity" / "edo_coffin.geo.json", {"format_version": "1.12.0", "minecraft:geometry": [{
    "description": {"identifier": "geometry.aegis.edo_coffin", "texture_width": AT, "texture_height": AT,
                    "visible_bounds_width": 8, "visible_bounds_height": 6, "visible_bounds_offset": [0, 1.5, 0]},
    "bones": bones}]})
(RP / "textures" / "entity" / "aegis").mkdir(parents=True, exist_ok=True)
atlas.save(RP / "textures" / "entity" / "aegis" / "edo_coffin.png")


# ---------------------------------------------------------------------------
# Coffin animation — sampled at 20 fps from eased segments (plain numbers, no Molang)
# ---------------------------------------------------------------------------
def seg(keys, t):
    """keys: [(time, value, ease)] — value at t, easing INTO each key."""
    if t <= keys[0][0]:
        return keys[0][1]
    for (t0, a, _), (t1, b, e) in zip(keys, keys[1:]):
        if t0 <= t <= t1:
            u = (t - t0) / (t1 - t0) if t1 > t0 else 1
            u = {"lin": u, "out": 1 - (1 - u) ** 3, "in": u ** 2.4, "io": 0.5 - 0.5 * math.cos(math.pi * u)}[e]
            return a + (b - a) * u
    return keys[-1][1]


def track(fn, t0, t1, fps=20):
    n = max(1, round((t1 - t0) * fps))
    return {f"{t0 + (t1 - t0) * i / n:.2f}": [round(v, 2) for v in fn(t0 + (t1 - t0) * i / n)] for i in range(n + 1)}


T = TIMES
DEPTH = -(H + 6)
RISE = [(0, DEPTH, "lin"), (T["rise_start"], DEPTH, "lin"), (0.55, -37, "out"), (0.8, -36, "lin"),      # first heave, stall
        (1.2, -21, "out"), (1.45, -20, "lin"), (1.95, -3, "out"), (2.12, 1.4, "out"), (T["risen"], 0, "in"),   # heave, heave, settle
        (T["sink"], 0, "lin"), (T["gone"], DEPTH - 4, "in")]


def coffin_pos(t):
    return [0, seg(RISE, t), 0]


def coffin_rot(t):
    moving = (T["rise_start"] < t < T["risen"]) or (T["sink"] < t < T["gone"])
    k = 1.0 if moving else 0.0
    if T["risen"] <= t < T["risen"] + 0.3:                 # the settle wobble
        k = 0.5 * (1 - (t - T["risen"]) / 0.3)
    return [math.sin(t * 61) * 0.7 * k, 0, math.sin(t * 47) * 1.5 * k]


LID = [(0, 0, "lin"), (T["creak"], 0, "lin"), (T["creak"] + 0.1, 3.5, "out"), (T["creak"] + 0.24, 1.2, "io"),
       (T["creak"] + 0.36, 5, "out"), (T["fall"], 4, "io"), (T["thud"], 90, "in"),
       (T["thud"] + 0.08, 83, "out"), (T["thud"] + 0.17, 90, "in"), (T["thud"] + 0.23, 87.5, "out"), (T["thud"] + 0.29, 90, "in")]

anim_bones = {
    "coffin": {"position": {**track(coffin_pos, 0, T["risen"] + 0.3), **track(coffin_pos, T["sink"], T["gone"])},
               "rotation": {**track(coffin_rot, 0, T["risen"] + 0.3), **track(coffin_rot, T["sink"], T["gone"])}},
    "lid": {"rotation": track(lambda t: [seg(LID, t), 0, 0], T["creak"], T["thud"] + 0.3)},
    "cracks": {"scale": {"0.0": [0, 0, 0], "0.1": [0, 0, 0], "0.22": [0.75, 1, 0.75], "0.6": [0.9, 1, 0.9], "1.3": [1, 1, 1],
                         f"{T['gone'] - 0.5:.2f}": [1, 1, 1], f"{T['gone']:.2f}": [0, 0, 0]}},
}
for name, s, ang, dist, apex, t0 in RUBBLE:
    dx, dz = math.cos(ang) * dist, math.sin(ang) * dist
    air = 0.42 + apex / 60

    def rpos(t, dx=dx, dz=dz, apex=apex, t0=t0, air=air):
        if t <= t0:
            return [0, -8, 0]
        if t >= T["gone"] - 0.6:                                                    # swallowed again at the end
            u = min(1, (t - (T["gone"] - 0.6)) / 0.5)
            return [dx, -8 * u, dz]
        u = min(1, (t - t0) / air)
        y = 4 * apex * u * (1 - u) + (-8) * (1 - u) ** 3
        if u >= 1:                                                                  # one small bounce
            b = (t - t0 - air) / 0.16
            y = 1.6 * 4 * b * (1 - b) if b < 1 else 0
        return [dx * (1 - (1 - u) ** 2), y, dz * (1 - (1 - u) ** 2)]

    spin = random.uniform(240, 520) * random.choice([-1, 1])

    def rrot(t, t0=t0, air=air, spin=spin):
        u = max(0, min(1, (t - t0) / (air + 0.16)))
        return [spin * u, spin * 0.6 * u, 0]

    anim_bones[name] = {"position": {**track(rpos, 0, t0 + air + 0.2, 30), **track(rpos, T["gone"] - 0.6, T["gone"])},
                        "rotation": track(rrot, t0, t0 + air + 0.2, 30)}

# ---------------------------------------------------------------------------
# Ground seal: the summoning formula
# ---------------------------------------------------------------------------
SPOT_PX = 67  # the coffin stands 4.2 blocks in front of the caster
SEAL = 160
seal = Image.new("RGBA", (SEAL, SEAL), (0, 0, 0, 0))
sp = seal.load()
CX, CY = SEAL // 2, 56  # the caster's palms (image bottom = forward)
INK = (16, 12, 16, 255)


def glyph(x, y, size=3):
    """A tiny block of ink that reads as a written character."""
    pat = [[random.random() < 0.62 for _ in range(size)] for _ in range(size)]
    pat[size // 2][random.randrange(size)] = True
    for i in range(size):
        for j in range(size):
            xx, yy = int(x) + i - size // 2, int(y) + j - size // 2
            if pat[i][j] and 0 <= xx < SEAL and 0 <= yy < SEAL:
                sp[xx, yy] = INK


def ring(cx, cy, r, step=4.2, size=3):
    n = max(6, int(math.tau * r / step))
    for i in range(n):
        a = i / n * math.tau
        glyph(cx + math.cos(a) * r, cy + math.sin(a) * r, size)


def spoke(cx, cy, a, r0, r1, step=4.0, size=3):
    r = r0
    while r <= r1:
        glyph(cx + math.cos(a) * r, cy + math.sin(a) * r, size)
        r += step


sd = ImageDraw.Draw(seal)
sd.ellipse([CX - 5, CY - 5, CX + 5, CY + 5], outline=INK, width=2)
ring(CX, CY, 12)
ring(CX, CY, 27)
for i in range(16):
    a = i / 16 * math.tau + math.pi / 16
    if abs(math.sin(a) - 1) < 0.08:
        continue
    spoke(CX, CY, a, 16, 23)
    spoke(CX, CY, a, 31, 38 + (i % 3) * 7)
for off in (-5, 0, 5):                               # three lines of script race forward to the coffin's spot
    y = CY + 14
    while y < CY + SPOT_PX - 15:
        glyph(CX + off, y)
        y += 4
ring(CX, CY + SPOT_PX, 16)
ring(CX, CY + SPOT_PX, 22, step=5.5)
for a in (0, math.pi / 2, math.pi, -math.pi / 2, math.pi / 4, 3 * math.pi / 4, -math.pi / 4, -3 * math.pi / 4):
    spoke(CX, CY + SPOT_PX, a, 25, 33, step=4)
seal.save(RP / "textures" / "entity" / "aegis" / "edo_seal.png")

# rows map back(+Z) → front(-Z): row CY is the caster (z = 0)
seal_cube = {"origin": [-SEAL / 2, 0.3, -(SEAL - CY)], "size": [SEAL, 0, SEAL], "uv": {"up": {"uv": [0, 0], "uv_size": [SEAL, SEAL]}}}
w(RP / "models" / "entity" / "edo_seal.geo.json", {"format_version": "1.12.0", "minecraft:geometry": [{
    "description": {"identifier": "geometry.aegis.edo_seal", "texture_width": SEAL, "texture_height": SEAL,
                    "visible_bounds_width": 14, "visible_bounds_height": 2, "visible_bounds_offset": [0, 0, 0]},
    "bones": [{"name": "root", "pivot": [0, 0, 0]}, {"name": "seal", "parent": "root", "pivot": [0, 0, 0], "cubes": [seal_cube]}]}]})

SEAL_T = {"spread": 0.5, "fade": 8.2, "gone": 8.7}


def seal_scale(t):
    if t >= SEAL_T["fade"]:
        k = max(0.0, 1 - (t - SEAL_T["fade"]) / (SEAL_T["gone"] - SEAL_T["fade"]))
    else:
        u = min(1, t / SEAL_T["spread"])
        k = 0.03 + 0.97 * (1 - (1 - u) ** 3)
    return [k, 1, k]


w(RP / "animations" / "edo.animation.json", {"format_version": "1.8.0", "animations": {
    "animation.aegis.edo_coffin": {"loop": "hold_on_last_frame", "animation_length": T["gone"] + 0.1, "bones": anim_bones},
    "animation.aegis.edo_seal": {"loop": "hold_on_last_frame", "animation_length": SEAL_T["gone"] + 0.05, "bones": {
        "seal": {"scale": {**track(seal_scale, 0, SEAL_T["spread"], 30), **track(seal_scale, SEAL_T["fade"], SEAL_T["gone"])}}}},
}})

# ---------------------------------------------------------------------------
# Entities
# ---------------------------------------------------------------------------
w(RP / "render_controllers" / "edo.render_controllers.json", {"format_version": "1.8.0", "render_controllers": {
    "controller.render.aegis.coffin": {"geometry": "Geometry.default", "materials": [{"*": "Material.default"}],
                                       "textures": ["Texture.default"]}}})


def prop(ident, anim_name, lifetime):
    w(RP / "entity" / f"{ident}.entity.json", {"format_version": "1.10.0", "minecraft:client_entity": {"description": {
        "identifier": f"aegis:{ident}", "materials": {"default": "entity_alphatest"},
        "textures": {"default": f"textures/entity/aegis/{ident}"}, "geometry": {"default": f"geometry.aegis.{ident}"},
        "animations": {"play": anim_name}, "scripts": {"animate": ["play"]},
        "render_controllers": ["controller.render.aegis.coffin"]}}})
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
            "minecraft:timer": {"time": lifetime, "looping": False, "time_down_event": {"event": "aegis:expire", "target": "self"}}},
        "events": {"aegis:expire": {"add": {"component_groups": ["aegis:expire"]}}}}})


prop("edo_coffin", "animation.aegis.edo_coffin", 16)
prop("edo_seal", "animation.aegis.edo_seal", 14)
print("Edo coffin + seal generated:", f"atlas used to y={_cur[1] + _cur[2]}", "| times", TIMES)
