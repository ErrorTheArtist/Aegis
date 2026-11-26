#!/usr/bin/env python3
"""Storyboards for the cinematics (Hollow Purple and every Domain Expansion), rendered offline from exactly what the
game plays: the shot lists in behavior_pack/scripts/cine_shots.js (read through node), the cast's real models posed
by their real animations, the domain's barrier (or Sukuna's shrine), its fog, fades, titles and a sketch of its
particles. One row per cinematic, one frame per shot.

  python3 tools/cine_board.py -o board.png                   # every cinematic
  python3 tools/cine_board.py -o board.png --only void,purple
  python3 tools/cine_board.py -o void.gif --gif void         # one cinematic, animated

It uses the software renderer from the Way of The Shinobi tools (../shinobi-addon/tools/cine_preview.py).
"""
import argparse
import json
import math
import random
import subprocess
import sys
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

TOOLS = Path(__file__).resolve().parent
ROOT = TOOLS.parent
RP = ROOT / "resource_pack"
TEX = RP / "textures" / "entity" / "jjk"
sys.path.insert(0, str(ROOT.parent / "shinobi-addon" / "tools"))
import cine_preview as CP  # noqa: E402

# who casts each one: drawn as a player (scale 0.9375, eyes 1.62 blocks up) in that character's skin and gear — in the
# game it's the player's own model (an NPC caster is the character, a little taller)
PLAYER_SCALE = 0.9375
CASTER = {"void": "gojo", "shrine": "sukuna", "garden": "megumi", "moon": "naoya", "volcano": "jogo", "perfection": "mahito",
          "jackpot": "hakari", "purple": "gojo"}
FONT_PATHS = ["/usr/share/fonts/opentype/ipafont-gothic/ipag.ttf", "/usr/share/fonts/truetype/fonts-japanese-gothic.ttf",
              "/usr/share/fonts/truetype/wqy/wqy-zenhei.ttc"]


def load_cine():
    src = (ROOT / "behavior_pack" / "scripts" / "cine_shots.js").read_text()
    out = subprocess.run(["node", "--input-type=module"], input=src + "\nconsole.log(JSON.stringify(CINE));",
                         check=True, capture_output=True, text=True).stdout
    return json.loads(out)


def font(size):
    for p in FONT_PATHS:
        if Path(p).exists():
            return ImageFont.truetype(p, size)
    return ImageFont.load_default()


def plain(text):
    """Minecraft text without its § colour codes."""
    out, skip = [], False
    for ch in text:
        if skip:
            skip = False
        elif ch == "§":
            skip = True
        else:
            out.append(ch)
    return "".join(out)


# ---------------------------------------------------------------------------
# Models
# ---------------------------------------------------------------------------
def quads(model, anim, t, place, maxdiv=None):
    """CP.model_quads, with each face cut into at most maxdiv x maxdiv cells (for the huge barrier and shrine)."""
    xf = CP.bone_xforms(model, anim, t)
    tw, th = model.tex.size
    out = []
    for b in model.bones:
        f = xf[b["name"]]
        for c in b.get("cubes", []):
            for face, at, (u, v, uw, vh) in CP.cube_faces(c):
                nu, nv = max(1, int(round(abs(uw)))), max(1, int(round(abs(vh))))
                if maxdiv:
                    nu, nv = min(nu, maxdiv), min(nv, maxdiv)
                for i in range(nu):
                    for j in range(nv):
                        tx, ty = int(u + (i + 0.5) * uw / nu), int(v + (j + 0.5) * vh / nv)
                        if not (0 <= tx < tw and 0 <= ty < th):
                            continue
                        r, g, bl, a = model.px[tx, ty]
                        if a < 40:
                            continue
                        pts = [place(f(at(a_, b_)), model.scale) for a_, b_ in
                               ((i / nu, j / nv), ((i + 1) / nu, j / nv), ((i + 1) / nu, (j + 1) / nv), (i / nu, (j + 1) / nv))]
                        out.append((pts, (r, g, bl), face, a))
    return out


def scales():
    bp = json.loads((ROOT / "behavior_pack" / "entities" / "sorcerer.json").read_text())["minecraft:entity"]["component_groups"]
    return {k[6:]: v.get("minecraft:scale", {}).get("value", 1.0) for k, v in bp.items() if k.startswith("jjk:c_")}


class Assets:
    def __init__(self):
        self.anims = json.loads((RP / "animations" / "player.animation.json").read_text())["animations"]
        self.scale = scales()
        self.cache = {}

    def character(self, who):
        if who not in self.cache:
            body = CP.load_geo(RP / "models" / "entity" / "sorcerer_body.geo.json", TEX / "sorcerer" / f"{who}.png")
            gear = CP.load_geo(RP / "models" / "entity" / f"sorcerer_gear_{who}.geo.json", TEX / "sorcerer" / f"gear_{who}.png")
            body.scale = gear.scale = PLAYER_SCALE
            self.cache[who] = (body, gear)
        return self.cache[who]

    def geo(self, name, texture):
        key = (name, texture)
        if key not in self.cache:
            self.cache[key] = CP.load_geo(RP / "models" / "entity" / f"{name}.geo.json", TEX / f"{texture}.png")
        return self.cache[key]


def orb(assets, tex, scale, at):
    """The jjk:orb effect entity (its model is centred on its position) at (f, r, h), at its event's scale."""
    m = assets.geo("orb", tex)
    f, r, h = at
    place = lambda q, s_: (q[0] * CP.PX * scale - r, q[1] * CP.PX * scale + h, q[2] * CP.PX * scale - f)
    return quads(m, None, 0, place, maxdiv=4)


def static(assets, kind):
    """The world around the caster that doesn't move: the barrier (or the shrine behind them), the dogs."""
    key = ("static", kind)
    if key in assets.cache:
        return assets.cache[key]
    q = []
    if kind in ("void", "garden", "moon", "volcano", "perfection", "jackpot"):
        q += quads(assets.geo("domain_dome", f"dome_{kind}"), None, 0, CP.placer(0, 0, 0), maxdiv=3)
    if kind == "shrine":
        q += quads(assets.geo("shrine", "shrine"), None, 0, CP.placer(-7, 0, 0), maxdiv=4)
    if kind == "garden":  # the Divine Dogs rise beside Megumi (tech_shadows.js: 1 ahead, 1.6 to each side)
        for side, tex in ((1, "divine_dog_white"), (-1, "divine_dog_black")):
            q += quads(assets.geo("divine_dog", tex), None, 0, CP.placer(1, 1.6 * side, 0), maxdiv=6)
    assets.cache[key] = q
    return q


# ---------------------------------------------------------------------------
# A sketch of the particles (shape, colour, size and life of each effect in tools/gen_particles.py)
# ---------------------------------------------------------------------------
LIFE = {"flash": 0.22, "glyph": 1.4, "pillar": 0.6, "shell": 1.3, "stars": 1.7, "slash": 0.28, "ring": 0.5, "debris": 1.0,
        "ember": 1.4, "burst": 0.6, "spark": 0.3, "smoke": 1.2, "aura": 0.7, "vortex": 0.6, "streak": 0.25, "blood": 0.8,
        "implode": 0.45, "orb": 0.35, "bolt": 0.25, "beam": 0.35}


def octagon(c, a, b, n=8):
    """A polygon around c in the plane of vectors a, b (half-sizes)."""
    return [tuple(c[i] + a[i] * math.cos(2 * math.pi * k / n) + b[i] * math.sin(2 * math.pi * k / n) for i in range(3)) for k in range(n)]


def sprite(cam, p, s, col, alpha):
    a = tuple(x * s for x in cam.right)
    b = tuple(x * s for x in cam.up)
    return (octagon(p, a, b), tuple(int(min(255, x)) for x in col), "glow", int(alpha))


def flat(p, s, col, alpha):
    return (octagon(p, (s, 0, 0), (0, 0, s), 16), tuple(int(min(255, x)) for x in col), "glow", int(alpha))


def particles(cam, beat, at_scene, age, default_col):
    """Glow polygons for one particle effect `age` seconds after it was spawned."""
    pid = beat["id"]
    life = LIFE.get(pid, 0.5)
    if age < 0 or age > life:
        return []
    k = age / life
    size = beat.get("size", 1)
    col = [int(255 * x) for x in beat.get("color", default_col)]
    vars_ = beat.get("vars", {})
    p = at_scene
    rnd = random.Random(hash((pid, tuple(beat["at"]), beat["t"])) & 0xFFFF)
    out = []
    if pid == "flash":
        out.append(sprite(cam, p, (2.2 + age * 6) * size / 2, col, 200 * (1 - k)))
    elif pid == "glyph":
        r = (1.5 + min(1, age * 3) * 4.5) * size / 2
        al = 220 * min(1, (1 - k) * 2)
        out.append(flat((p[0], p[1] + 0.02, p[2]), r, col, al * 0.35))
        for n in range(12):
            th = 2 * math.pi * n / 12 + age * math.radians(40)
            out.append(flat((p[0] + math.cos(th) * r * 0.85, p[1] + 0.03, p[2] + math.sin(th) * r * 0.85), r * 0.08, col, al))
    elif pid == "ring":
        r = (0.4 + k * 3) * size / 2
        for n in range(16):
            th = 2 * math.pi * n / 16
            out.append(flat((p[0] + math.cos(th) * r, p[1] + 0.03, p[2] + math.sin(th) * r), 0.12 * size, col, 220 * (1 - k)))
    elif pid == "pillar":
        w, h = (0.6 + age) * size / 2, 3 * size
        c = (p[0], p[1] + h, p[2])
        side = CP.norm((cam.right[0], 0, cam.right[2]))
        out.append(([tuple(c[i] + side[i] * w * sx + (0, 1, 0)[i] * h * sy for i in range(3)) for sx, sy in ((-1, -1), (1, -1), (1, 1), (-1, 1))],
                    tuple(col), "glow", int(170 * (1 - k))))
    elif pid in ("shell", "stars"):
        rad = vars_.get("radius", 2)
        n = 60 if pid == "shell" else int(max(10, min(40, rad * 3)))
        for i in range(n):
            if pid == "shell":   # points on the sphere
                z = 1 - 2 * (i + 0.5) / n
                th = math.pi * (3 - math.sqrt(5)) * i
                q = (math.sqrt(1 - z * z) * math.cos(th) * rad, z * rad, math.sqrt(1 - z * z) * math.sin(th) * rad)
                out.append(sprite(cam, (p[0] + q[0], p[1] + q[1], p[2] + q[2]), 0.18 * size, col, 190 * (1 - k)))
            else:                # inside it, twinkling
                q = [rnd.uniform(-1, 1) for _ in range(3)]
                n_ = math.sqrt(sum(x * x for x in q)) or 1
                rr = rad * rnd.random() ** 0.33
                tw = math.sin(min(1, age / rnd.uniform(1.2, 2.2)) * math.pi)
                out.append(sprite(cam, (p[0] + q[0] / n_ * rr, p[1] + abs(q[1]) / n_ * rr, p[2] + q[2] / n_ * rr), 0.09 * size, (240, 245, 255), 255 * tw))
    elif pid == "slash":
        s = (1.3 + age * 3) * size / 2
        rot = rnd.uniform(0, 2 * math.pi)
        for n in range(9):
            th = rot + (n - 4) * 0.22
            q = (p[0] + (cam.right[0] * math.cos(th) + cam.up[0] * math.sin(th)) * s,
                 p[1] + (cam.right[1] * math.cos(th) + cam.up[1] * math.sin(th)) * s,
                 p[2] + (cam.right[2] * math.cos(th) + cam.up[2] * math.sin(th)) * s)
            out.append(sprite(cam, q, 0.09 * size * (1 - abs(n - 4) / 5), col, 230 * (1 - k)))
    elif pid == "vortex":
        rad = vars_.get("radius", 2)
        for n in range(18):
            th = 2 * math.pi * n / 18 + age * math.radians(720)
            rr = rad * (1 - k)
            out.append(sprite(cam, (p[0] + math.cos(th) * rr, p[1] + (rnd.random() - 0.5) * rad * 0.6 * (1 - k), p[2] + math.sin(th) * rr), 0.09 * size, col, 220))
    else:  # motes: debris, ember, burst, spark, smoke, aura, streak, blood...
        n = {"debris": 10, "ember": 12, "burst": 16, "spark": 10, "smoke": 7, "aura": 7, "streak": 8, "blood": 10}.get(pid, 8)
        for _ in range(n):
            d = CP.norm((rnd.uniform(-1, 1), rnd.uniform(-0.3, 1), rnd.uniform(-1, 1)))
            speed = {"debris": 4.5, "ember": 1.0, "burst": 5, "spark": 9, "smoke": 0.8, "aura": 0.3, "streak": 10, "blood": 3}.get(pid, 2)
            rise = {"debris": -11, "ember": 0.8, "smoke": 0.3, "aura": 2, "blood": -9}.get(pid, 0)
            q = (p[0] + d[0] * speed * age, p[1] + max(-p[1], d[1] * speed * age + rise * age * age), p[2] + d[2] * speed * age)
            c = [int(x * 0.45) for x in col] if pid in ("debris", "smoke") else col
            al = 255 if pid == "debris" else 200 * (1 - k)
            out.append(sprite(cam, q, {"debris": 0.09, "smoke": 0.35, "ember": 0.05}.get(pid, 0.08) * size, c, al))
    return out


# ---------------------------------------------------------------------------
# A frame
# ---------------------------------------------------------------------------
def fog_colour(name):
    if not name:
        return None
    f = RP / "fogs" / f"jjk_{name}.json"
    if not f.exists():
        return None
    hexc = json.loads(f.read_text())["minecraft:fog_settings"]["distance"]["air"]["fog_color"]
    return tuple(int(hexc[i:i + 2], 16) for i in (1, 3, 5))


def fade_at(c, tick):
    """(colour, amount 0..1) of the camera fade at this tick."""
    best = (None, 0.0)
    for f in c.get("fades", []):
        s = (tick - f["t"]) / 20
        a_in, hold, a_out = f["in"], f["hold"], f["out"]
        if s < 0 or s > a_in + hold + a_out:
            continue
        amt = s / a_in if s < a_in else 1.0 if s < a_in + hold else 1 - (s - a_in - hold) / a_out
        if amt > best[1]:
            best = (tuple(int(255 * x) for x in f.get("color", c["color"])), amt)
    return best


def frame(c, kind, tick, assets, w=320, h=180, fade_cap=1.0):
    who = CASTER[kind]
    pos, look, name = CP.camera_at(c["shots"], tick)
    cam = CP.Camera(pos, look, w, h, fov=70)
    t = tick / 20
    anim_name = "animation.jjk.purple" if kind == "purple" else "animation.jjk.domain_sign"
    anim = assets.anims[anim_name]
    length = anim.get("animation_length", 1.5)
    pose = anim if t <= length else None   # (after it, back to standing)
    body, gear = assets.character(who)
    solid = quads(body, pose, min(t, length), CP.placer(0, 0, 0)) + quads(gear, pose, min(t, length), CP.placer(0, 0, 0))
    solid += static(assets, kind)
    glow = []
    for beat in c.get("fx", []):
        glow += particles(cam, beat, CP.scene_pt(*beat["at"]), (tick - beat["t"]) / 20, c["color"])
    if kind == "purple":   # Blue and Red closing in, then the imaginary mass tearing away (tech_limitless.js)
        if tick < 20:
            k = 1 - tick / 20
            for side, tex, sc in ((1, "orb_blue", 1.3), (-1, "orb_red", 1.0)):
                solid += orb(assets, tex, sc, (1.6, 2.2 * k * side, 1.62))
        else:
            d = 1.6 + (tick - 20) * 1.1
            if d < 1.6 + 36 * 1.1:
                solid += orb(assets, "orb_purple", 5.0, (d, 0, 1.62))
    fog = fog_colour(c.get("fog")) if tick >= c.get("fogAt", 0) else None
    sky = ((16, 14, 22), (46, 40, 50)) if fog is None else (tuple(int(x * 0.6) for x in fog), fog)
    ground = (58, 62, 52) if fog is None else tuple(int(a * 0.55 + b * 0.45) for a, b in zip((58, 62, 52), fog))
    decals = [q for q in solid if max(p[1] for p in q[0]) < 0.2]
    solid = [q for q in solid if max(p[1] for p in q[0]) >= 0.2]
    img = CP.render(cam, [decals, solid + glow], sky=sky, ground=ground)
    col, amt = fade_at(c, tick)
    if amt > 0:
        img = Image.blend(img, Image.new("RGB", img.size, col), min(fade_cap, amt))
    d = ImageDraw.Draw(img)
    for x in c.get("text", []):
        if x["t"] <= tick < x["t"] + x.get("stay", 30) + 12:
            big, small = font(max(12, int(h * 0.09))), font(max(10, int(h * 0.065)))
            tt, st = plain(x["title"]), plain(x.get("sub", ""))
            tw_ = d.textlength(tt, font=big)
            d.text(((w - tw_) / 2 + 1, h * 0.36 + 1), tt, font=big, fill=(0, 0, 0))
            d.text(((w - tw_) / 2, h * 0.36), tt, font=big, fill=(255, 255, 255))
            sw = d.textlength(st, font=small)
            d.text(((w - sw) / 2 + 1, h * 0.52 + 1), st, font=small, fill=(0, 0, 0))
            d.text(((w - sw) / 2, h * 0.52), st, font=small, fill=(225, 225, 235))
    d.rectangle([0, 0, w, 13], fill=(0, 0, 0))
    d.text((4, 1), f"{c['name']}  t={tick:2d}  {name}", font=font(10), fill=(235, 235, 235))
    return img


def picks(c):
    """One tick per named shot: 60% of the way through it (or just before a fade that starts during it)."""
    named = [s for s in c["shots"] if s.get("name")]
    out = []
    for i, s in enumerate(named):
        nxt = named[i + 1]["t"] if i + 1 < len(named) else c["length"]
        pick = min(c["length"], s["t"] + max(1, round((nxt - s["t"]) * 0.6)))
        for f in c.get("fades", []):
            if s["t"] + 2 < f["t"] <= pick:
                pick = f["t"] - 1
        out.append(pick)
    return out


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("-o", "--out", required=True)
    ap.add_argument("--only", help="comma-separated: void,shrine,garden,moon,volcano,perfection,jackpot,purple")
    ap.add_argument("--gif", help="one cinematic, animated")
    ap.add_argument("--size", default="320x180")
    a = ap.parse_args()
    w, h = (int(x) for x in a.size.split("x"))
    cine = load_cine()
    assets = Assets()
    if a.gif:
        c = cine[a.gif]
        frames = [frame(c, a.gif, t, assets, w, h) for t in range(0, c["length"] + 1, 2)]
        frames[0].save(a.out, save_all=True, append_images=frames[1:], duration=100, loop=0)
        print(f"wrote {a.out} ({len(frames)} frames)")
        return
    kinds = a.only.split(",") if a.only else list(cine)
    cols = max(len(picks(cine[k])) for k in kinds)
    board = Image.new("RGB", (cols * w, len(kinds) * h), (20, 18, 24))
    for row, kind in enumerate(kinds):
        for col, tick in enumerate(picks(cine[kind])):
            board.paste(frame(cine[kind], kind, tick, assets, w, h, fade_cap=0.45), (col * w, row * h))  # (see under a white-out)
        print(f"  {kind}: {len(picks(cine[kind]))} shots")
    board.save(a.out)
    print(f"wrote {a.out}")


if __name__ == "__main__":
    main()
