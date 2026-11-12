#!/usr/bin/env python3
"""Offline storyboard renderer for cinematics: a small perspective software renderer that draws the real models
(humanoid skins, any .geo.json with its texture) posed by the real animations, from the camera positions the script
uses — so a shot list can be checked frame by frame without starting the game.

  python3 tools/cine_preview.py edo -o storyboard.png            # contact sheet of the Edo Tensei cinematic
  python3 tools/cine_preview.py edo -o shot.png --tick 96        # one frame, large
  python3 tools/cine_preview.py edo -o cine.gif --gif            # animated preview

Scene space is the cinematic's own frame: f = blocks in front of the caster, r = blocks to the caster's right,
h = blocks above the caster's feet — the same (f, r, h) triples the script's shot list uses.
"""
import argparse
import json
import math
import subprocess
import sys
import tempfile
from pathlib import Path
from PIL import Image, ImageDraw

sys.path.insert(0, str(Path(__file__).resolve().parent))
import anim_preview as AP  # noqa: E402

ROOT = Path(__file__).resolve().parent.parent
RP = ROOT / "resource_pack"
NPC = RP / "textures" / "entity" / "aegis" / "npc"
PX = 1 / 16


# ---------------------------------------------------------------------------
# Models
# ---------------------------------------------------------------------------
class Model:
    def __init__(self, bones, texture, scale=1.0):
        self.bones = bones  # [{name, parent, pivot, rotation?, cubes:[{origin,size,uv}]}] parents first
        self.tex = texture.convert("RGBA")
        self.px = self.tex.load()
        self.scale = scale


def humanoid(skin):
    bones = []
    for name in AP.ORDER:
        parent, piv, cubes = AP.BONES[name]
        bones.append({"name": name, "parent": parent, "pivot": list(piv),
                      "cubes": [{"origin": list(o), "size": list(s), "uv": list(uv)} for o, s, uv in cubes]})
    return Model(bones, Image.open(skin), scale=0.9375)


def load_geo(path, texture):
    g = json.loads(Path(path).read_text())["minecraft:geometry"][0]
    return Model(g["bones"], Image.open(texture))


def bone_xforms(model, anim, t):
    """point(model px) -> point(model px) for every bone at time t (same conventions as anim_preview)."""
    ab = (anim or {}).get("bones", {})
    xf = {}
    for b in model.bones:
        ch = ab.get(b["name"], {})
        r = AP.sample(ch.get("rotation"), t)
        p = AP.sample(ch.get("position"), t)
        s = AP.sample(ch.get("scale"), t) if ch.get("scale") is not None else (1, 1, 1)
        bind = b.get("rotation", [0, 0, 0])
        M = AP.rot_matrix(r[0] + bind[0], r[1] + bind[1], r[2] + bind[2])
        piv = b.get("pivot", [0, 0, 0])
        off = (-p[0], p[1], p[2])

        def f(q, M=M, piv=piv, off=off, s=s, par=xf.get(b.get("parent"))):
            local = AP.apply(M, ((q[0] - piv[0]) * s[0], (q[1] - piv[1]) * s[1], (q[2] - piv[2]) * s[2]))
            q2 = (local[0] + piv[0] + off[0], local[1] + piv[1] + off[1], local[2] + piv[2] + off[2])
            return par(q2) if par else q2
        xf[b["name"]] = f
    return xf


def cube_faces(c):
    """Yields (face, corner(u01, v01) -> model point, (tex u, tex v, tex w, tex h))."""
    (ox, oy, oz), (w, h, d) = c["origin"], c["size"]
    uv = c["uv"]
    geo = {
        "north": lambda a, b: (ox + a * w, oy + h - b * h, oz),
        "south": lambda a, b: (ox + w - a * w, oy + h - b * h, oz + d),
        "west": lambda a, b: (ox, oy + h - b * h, oz + d - a * d),
        "east": lambda a, b: (ox + w, oy + h - b * h, oz + a * d),
        "up": lambda a, b: (ox + a * w, oy + h, oz + d - b * d),
        "down": lambda a, b: (ox + a * w, oy, oz + d - b * d),
    }
    if isinstance(uv, dict):
        for face, spec in uv.items():
            (u, v), (uw, vh) = spec["uv"], spec.get("uv_size", [1, 1])
            yield face, geo[face], (u, v, uw, vh)
    else:
        u, v = uv
        box = {"north": (u + d, v + d, w, h), "south": (u + 2 * d + w, v + d, w, h), "west": (u, v + d, d, h),
               "east": (u + d + w, v + d, d, h), "up": (u + d, v, w, d), "down": (u + d + w, v, w, d)}
        for face, rect in box.items():
            if rect[2] > 0 and rect[3] > 0:
                yield face, geo[face], rect


def model_quads(model, anim, t, place, tint=None):
    """Every visible texel as a world-space quad: [(4 points, rgb)]."""
    xf = bone_xforms(model, anim, t)
    out = []
    tw, th = model.tex.size
    for b in model.bones:
        f = xf[b["name"]]
        for c in b.get("cubes", []):
            for face, at, (u, v, uw, vh) in cube_faces(c):
                nu, nv = max(1, int(round(abs(uw)))), max(1, int(round(abs(vh))))
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
                        if tint:
                            r, g, bl = int(r * tint[0]), int(g * tint[1]), int(bl * tint[2])
                        out.append((pts, (r, g, bl), face, a))
    return out


def placer(f, r, h, facing_caster=False):
    """Model px -> scene blocks for an entity standing at (f, r, h). Models face -Z; the caster looks along -Z."""
    def place(q, scale):
        x, y, z = q[0] * PX * scale, q[1] * PX * scale, q[2] * PX * scale
        if facing_caster:
            x, z = -x, -z
        return (x - r, y + h, z - f)
    return place


def scene_pt(f, r, h):
    return (-r, h, -f)


# ---------------------------------------------------------------------------
# Camera
# ---------------------------------------------------------------------------
def sub(a, b):
    return (a[0] - b[0], a[1] - b[1], a[2] - b[2])


def dot(a, b):
    return a[0] * b[0] + a[1] * b[1] + a[2] * b[2]


def cross(a, b):
    return (a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0])


def norm(a):
    n = math.sqrt(dot(a, a)) or 1
    return (a[0] / n, a[1] / n, a[2] / n)


class Camera:
    def __init__(self, pos, look, w=480, h=270, fov=60):
        self.pos, self.w, self.h = pos, w, h
        self.fwd = norm(sub(look, pos))
        self.right = norm(cross((0, 1, 0), self.fwd))  # mirrored (left-handed) frame, like the game
        self.up = cross(self.fwd, self.right)
        self.focal = (h / 2) / math.tan(math.radians(fov) / 2)

    def project(self, p):
        d = sub(p, self.pos)
        z = dot(d, self.fwd)
        if z < 0.08:
            return None
        return (self.w / 2 + self.focal * dot(d, self.right) / z, self.h / 2 - self.focal * dot(d, self.up) / z, z)


LIGHT = norm((0.35, 0.85, -0.4))


def render(cam, layers, sky=((16, 14, 22), (46, 40, 50)), ground=(58, 62, 52), dark=0.0):
    """layers: list of quad lists; earlier layers are always behind later ones (ground decals), the rest depth-sorted."""
    img = Image.new("RGB", (cam.w, cam.h))
    dr = ImageDraw.Draw(img, "RGBA")
    for y in range(cam.h):
        u = y / cam.h
        dr.line([(0, y), (cam.w, y)], fill=tuple(int(sky[0][i] + (sky[1][i] - sky[0][i]) * u) for i in range(3)))
    # ground: 1-block tiles around the action
    tiles = []
    for gx in range(-12, 12):
        for gz in range(-14, 10):
            pts = [(gx, 0, gz), (gx + 1, 0, gz), (gx + 1, 0, gz + 1), (gx, 0, gz + 1)]
            k = 1.0 if (gx + gz) % 2 else 0.9
            tiles.append((pts, tuple(int(c * k) for c in ground), "up", 255))
    for li, quads in enumerate([tiles] + layers):
        drawn = []
        for pts, col, face, alpha in quads:
            pp = [cam.project(p) for p in pts]
            if any(p is None for p in pp):
                continue
            if all(p[0] < 0 for p in pp) or all(p[0] > cam.w for p in pp) or all(p[1] < 0 for p in pp) or all(p[1] > cam.h for p in pp):
                continue
            n = norm(cross(sub(pts[1], pts[0]), sub(pts[3], pts[0])))
            shade = 0.62 + 0.38 * abs(dot(n, LIGHT))
            depth = sum(p[2] for p in pp) / 4
            fogk = max(0.0, min(1.0, (depth - 6) / 30)) * 0.6
            c = tuple(int((ch * shade) * (1 - dark) * (1 - fogk) + sky[1][i] * fogk) for i, ch in enumerate(col))
            if alpha >= 250:
                drawn.append((depth, [(p[0], p[1]) for p in pp], c + (255,)))
            else:   # glowing translucent things ignore the lighting
                drawn.append((depth, [(p[0], p[1]) for p in pp], tuple(col) + (alpha,)))
        drawn.sort(key=lambda d: -d[0])
        for _, pp, c in drawn:
            dr.polygon(pp, fill=c)
    return img


# ---------------------------------------------------------------------------
# The Edo Tensei cinematic (reads the real shot list from behavior_pack/scripts/edo_shots.js)
# ---------------------------------------------------------------------------
def load_shots(name="edo_shots.js"):
    src = (ROOT / "behavior_pack" / "scripts" / name).read_text()
    with tempfile.TemporaryDirectory() as tmp:
        (Path(tmp) / "shots.mjs").write_text(src)
        (Path(tmp) / "dump.mjs").write_text('import * as m from "./shots.mjs"; console.log(JSON.stringify(m));')
        return json.loads(subprocess.run(["node", str(Path(tmp) / "dump.mjs")], check=True, capture_output=True, text=True).stdout)


def ease_io(u):
    return 0.5 - 0.5 * math.cos(math.pi * max(0.0, min(1.0, u)))


def camera_at(shots, tick):
    """Replays the /camera commands: a cut jumps, an eased move glides from wherever the camera was."""
    pos = look = None
    name = ""
    cmds = [s for s in shots if s["t"] <= tick]
    for i, s in enumerate(cmds):
        until = cmds[i + 1]["t"] if i + 1 < len(cmds) else tick
        tgt_p, tgt_l = scene_pt(*s["pos"]), scene_pt(*s["look"])
        if s.get("ease") and pos is not None:
            u = ease_io((until - s["t"]) / (s["ease"] * 20))
            pos = tuple(a + (b - a) * u for a, b in zip(pos, tgt_p))
            look = tuple(a + (b - a) * u for a, b in zip(look, tgt_l))
        else:
            pos, look = tgt_p, tgt_l
        name = s.get("name", name)
    return pos, look, name


def edo_frame(E, tick, assets, w=480, h=270):
    anims, caster, body, coffin, seal = assets
    pos, look, name = camera_at(E["SHOTS"], tick)
    t = tick / 20
    spot = E["SPOT"]
    solid, decals = [], []
    solid += model_quads(caster, anims["animation.aegis.edo_tensei"], t, placer(0, 0, 0))
    if tick >= E["T"]["seal"]:
        decals += model_quads(seal, anims["animation.aegis.edo_seal"], (tick - E["T"]["seal"]) / 20, placer(0, 0, 0.02))
    if tick >= E["T"]["coffin"]:
        q = model_quads(coffin, anims["animation.aegis.edo_coffin"], (tick - E["T"]["coffin"]) / 20, placer(spot, 0, 0, True))
        solid += q
    if tick >= E["T"]["body"]:
        solid += model_quads(body, anims["animation.aegis.edo_awaken"], (tick - E["T"]["body"]) / 20, placer(spot, 0, 0, True))
    # anything below the ground is hidden by it; flat things lying on it are drawn right after the ground
    solid = [q for q in solid if max(p[1] for p in q[0]) > 0.0]
    decals += [q for q in solid if max(p[1] for p in q[0]) < 0.05]
    solid = [q for q in solid if max(p[1] for p in q[0]) >= 0.05]
    img = render(Camera(pos, look, w, h), [decals, solid])
    d = ImageDraw.Draw(img)
    text = next((f'[{x["title"]} / {x["subtitle"]}]' for x in reversed(E.get("TEXT", [])) if x["t"] <= tick < x["t"] + x.get("stay", 20)), "")
    text = "".join(ch for i, ch in enumerate(text) if ch != "§" and (i == 0 or text[i - 1] != "§")).encode("ascii", "replace").decode()
    d.rectangle([0, 0, w, 13], fill=(0, 0, 0))
    d.text((4, 1), f"t={tick:3d} ({t:.2f}s)  {name}   {text}", fill=(235, 235, 235))
    return img


def edo_assets(skin="naruto", fig="madara"):
    anims = {}
    for f in ("aegis.animation.json", "edo.animation.json"):
        anims.update(json.loads((RP / "animations" / f).read_text())["animations"])
    ent = RP / "textures" / "entity" / "aegis"
    return (anims, humanoid(NPC / f"{skin}.png"), humanoid(NPC / f"{fig}.png"),
            load_geo(RP / "models" / "entity" / "edo_coffin.geo.json", ent / "edo_coffin.png"),
            load_geo(RP / "models" / "entity" / "edo_seal.geo.json", ent / "edo_seal.png"))


# ---------------------------------------------------------------------------
# The Jutsu Clash cinematic (reads behavior_pack/scripts/clash_shots.js)
# ---------------------------------------------------------------------------
EASES = {"lin": lambda u: u, "in": lambda u: u * u, "out": lambda u: 1 - (1 - u) ** 2, "io": ease_io}


def path_at(E, tick, start, H):
    """(distance from the middle, height) of a fighter — the same interpolation clash.js does."""
    S = E["STAGE"]
    val = lambda v: {"start": start, "H": H, "air": S["air"], "back": S["back"]}.get(v, v)
    P = E["PATH"]
    if tick <= P[0]["t"]:
        return val(P[0]["d"]), val(P[0]["h"])
    for a, b in zip(P, P[1:]):
        if a["t"] <= tick <= b["t"]:
            u = (tick - a["t"]) / (b["t"] - a["t"])
            e = EASES[b.get("ease", "lin")](u)
            return (val(a["d"]) + (val(b["d"]) - val(a["d"])) * e,
                    val(a["h"]) + (val(b["h"]) - val(a["h"])) * e + b.get("arc", 0) * 4 * u * (1 - u))
    return val(P[-1]["d"]), val(P[-1]["h"])


def clash_frame(E, tick, assets, w=480, h=270, start=3.0, even=False):
    anims, models, orb = assets
    H = max(start, E["STAGE"]["half"])
    fam = {"A": "orb", "B": "chidori"}
    state, pose = {}, {}
    for who in "AB":
        d, hh = path_at(E, tick, start, H)
        key, t0 = "ready", 0
        for t, target, k in E["ANIMS"]:
            if t <= tick and (target == "both" or target == who or (target == "W" and who == "A" and not even) or (target == "L" and who == "B" and not even)):
                key, t0 = k, t
        pk = f"{key}_{fam[who]}" if key in E["FAMILY_ANIMS"] else key
        state[who] = (d, hh)
        pose[who] = (pk, (tick - t0) / 20)

    def anchor(a):
        name, f, p, hh = a[0], a[1], a[2], a[3]
        hh += (a[4] if len(a) > 4 else 0) * E["STAGE"]["air"]
        if name == "M":
            return scene_pt(f, p, hh)
        who = {"W": "A", "L": "B"}.get(name[0], name[0])
        d, fh = state[who]
        off = E["POSES"][pose[who][0]][name[1:]] if len(name) > 1 else [0, 0, 0]
        sign = 1 if who == "A" else -1
        return scene_pt(sign * (-d + f + off[0]), p + off[1], fh + hh + off[2])

    shots = [dict(s, **s["even"]) if even and s.get("even") else s for s in E["SHOTS"]]
    # camera: replay the commands (tracked shots follow their anchor every tick)
    pos = look = None
    name = ""
    cmds = [s for s in shots if s["t"] <= tick]
    for i, s in enumerate(cmds):
        until = cmds[i + 1]["t"] if i + 1 < len(cmds) else tick
        tp, tl = anchor(s["pos"]), anchor(s["look"])
        if s.get("ease") and pos is not None:
            u = ease_io((until - s["t"]) / (s["ease"] * 20))
            pos = tuple(a + (b - a) * u for a, b in zip(pos, tp))
            look = tuple(a + (b - a) * u for a, b in zip(look, tl))
        else:
            pos, look = tp, tl
        name = s.get("name", name)
    solid = []
    glow = []
    for who in "AB":
        d, fh = state[who]
        pk, t = pose[who]
        a = anims["animation.aegis.clash_" + pk + ("_m" if who == "B" else "")]
        L = a.get("animation_length", 1)
        t = t % L if a.get("loop") is True else min(t, L)
        solid += model_quads(models[who], a, t, placer(-d if who == "A" else d, 0, fh, who == "B"))
        if tick >= E["T"]["chargeA" if who == "A" else "chargeB"] + 8 and tick < E["T"]["burst"]:
            off = E["POSES"][pk]["hand"]
            sign = 1 if who == "A" else -1
            glow.append((scene_pt(sign * (-d + off[0]), off[1], fh + off[2]), (90, 190, 255) if who == "A" else (190, 230, 255)))
    if E["T"]["impact"] <= tick < E["T"]["burst"] + 8:
        c = scene_pt(0, 0, E["STAGE"]["air"] + E["STAGE"]["hit"])
        solid += model_quads(orb, anims["animation.aegis.clash_orb"], (tick - E["T"]["impact"]) / 20,
                             lambda q, s, c=c: (q[0] * PX + c[0], q[1] * PX + c[1], q[2] * PX + c[2]), tint=(0.55, 0.75, 1.0))
    cam = Camera(pos, look, w, h)
    img = render(cam, [[], solid])
    d = ImageDraw.Draw(img, "RGBA")
    for pt_, col in glow:   # where the jutsu burns in each hand
        pp = cam.project(pt_)
        if pp:
            r = max(3, cam.focal * 0.22 / pp[2])
            d.ellipse([pp[0] - r, pp[1] - r, pp[0] + r, pp[1] + r], fill=col + (150,))
            d.ellipse([pp[0] - r / 2, pp[1] - r / 2, pp[0] + r / 2, pp[1] + r / 2], fill=(255, 255, 255, 220))
    d.rectangle([0, 0, w, 13], fill=(0, 0, 0, 255))
    d.text((4, 1), f"t={tick:3d} ({tick / 20:.2f}s)  {name}", fill=(235, 235, 235, 255))
    return img


def clash_assets():
    anims = {}
    for f in ("aegis.animation.json", "clash.animation.json"):
        anims.update(json.loads((RP / "animations" / f).read_text())["animations"])
    ent = RP / "textures" / "entity" / "aegis"
    return (anims, {"A": humanoid(NPC / "naruto.png"), "B": humanoid(NPC / "sasuke.png")},
            load_geo(RP / "models" / "entity" / "clash_orb.geo.json", ent / "clash_orb.png"))


def anim_sheet(names, out, frames=10, cell=170, skin="naruto", view=(2.7, 1.6, 1.5)):
    """One row per animation: `frames` evenly spaced poses, textured, from a 3/4 front view."""
    anims = json.loads((RP / "animations" / "aegis.animation.json").read_text())["animations"]
    model = humanoid(NPC / f"{skin}.png")
    sheet = Image.new("RGB", (cell * frames, (cell + 14) * len(names)), (0, 0, 0))
    d = ImageDraw.Draw(sheet)
    for row, n in enumerate(names):
        a = anims[n if n.startswith("animation.") else f"animation.aegis.{n}"]
        L = a.get("animation_length", 1.0)
        for i in range(frames):
            t = L * i / (frames - 1)
            cam = Camera(scene_pt(*view), scene_pt(0.2, 0, 1.1), cell, cell, fov=52)
            img = render(cam, [[], model_quads(model, a, t, placer(0, 0, 0))])
            sheet.paste(img, (i * cell, row * (cell + 14) + 14))
            d.text((i * cell + 3, row * (cell + 14) + 15), f"{t:.2f}", fill=(255, 255, 255))
        d.text((3, row * (cell + 14) + 1), f"{n}  ({L}s)", fill=(255, 230, 120))
    sheet.save(out)


def main():
    if len(sys.argv) > 1 and sys.argv[1] == "anim":
        ap = argparse.ArgumentParser()
        ap.add_argument("what")
        ap.add_argument("names", nargs="+")
        ap.add_argument("-o", "--out", required=True)
        ap.add_argument("--frames", type=int, default=10)
        ap.add_argument("--cell", type=int, default=170)
        a = ap.parse_args()
        anim_sheet(a.names, a.out, a.frames, a.cell)
        print("wrote", a.out)
        return
    ap = argparse.ArgumentParser()
    ap.add_argument("what", choices=["edo", "clash"])
    ap.add_argument("-o", "--out", required=True)
    ap.add_argument("--tick", type=int)
    ap.add_argument("--ticks", type=str, help="comma-separated ticks for the sheet")
    ap.add_argument("--gif", action="store_true")
    ap.add_argument("--cols", type=int, default=4)
    args = ap.parse_args()
    if args.what == "clash":
        E, assets, frame = load_shots("clash_shots.js"), clash_assets(), clash_frame
    else:
        E, assets, frame = load_shots(), edo_assets(), edo_frame
    if args.tick is not None:
        frame(E, args.tick, assets, 960, 540).save(args.out)
    elif args.gif:
        frames = [frame(E, t, assets, 384, 216) for t in range(0, E["T"]["end"] + 1, 2)]
        frames[0].save(args.out, save_all=True, append_images=frames[1:], duration=100, loop=0)
    else:
        ticks = [int(x) for x in args.ticks.split(",")] if args.ticks else E["STORYBOARD"]
        cols = args.cols
        rows = (len(ticks) + cols - 1) // cols
        sheet = Image.new("RGB", (cols * 480, rows * 270), (0, 0, 0))
        for i, t in enumerate(ticks):
            sheet.paste(frame(E, t, assets), ((i % cols) * 480, (i // cols) * 270))
        sheet.save(args.out)
    print("wrote", args.out)


if __name__ == "__main__":
    main()
