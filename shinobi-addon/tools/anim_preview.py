#!/usr/bin/env python3
"""Offline preview of the player animations: renders the humanoid model (same bones / pivots as Bedrock's
geometry.humanoid.custom, coloured from a skin) posed by an animation, as a contact sheet or an animated GIF.

  python3 tools/anim_preview.py sheet animation.aegis.fireball_jutsu [more…] -o out.png
  python3 tools/anim_preview.py gif   animation.aegis.fireball_jutsu -o out.gif
"""
import argparse
import json
import math
from pathlib import Path
from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parent.parent
ANIMS = ROOT / "resource_pack" / "animations" / "aegis.animation.json"
SKIN = ROOT / "resource_pack" / "textures" / "entity" / "aegis" / "npc" / "naruto.png"

# bone: (parent, pivot, cubes[(origin, size, uv)])
BONES = {
    "root": (None, (0, 0, 0), []),
    "waist": ("root", (0, 12, 0), []),
    "body": ("waist", (0, 24, 0), [((-4, 12, -2), (8, 12, 4), (16, 16))]),
    "head": ("body", (0, 24, 0), [((-4, 24, -4), (8, 8, 8), (0, 0))]),
    "rightArm": ("body", (-5, 22, 0), [((-8, 12, -2), (4, 12, 4), (40, 16))]),
    "leftArm": ("body", (5, 22, 0), [((4, 12, -2), (4, 12, 4), (32, 48))]),
    "rightLeg": ("root", (-1.9, 12, 0), [((-3.9, 0, -2), (4, 12, 4), (0, 16))]),
    "leftLeg": ("root", (1.9, 12, 0), [((-0.1, 0, -2), (4, 12, 4), (16, 48))]),
}
ORDER = ["root", "waist", "body", "head", "rightArm", "leftArm", "rightLeg", "leftLeg"]


def num(v):
    if isinstance(v, (int, float)):
        return float(v)
    s = str(v)
    return float(s.split("*")[-1]) if "*" in s else float(s)


def sample(chan, t):
    """Linear sample of a Bedrock channel (dict of time → [x,y,z] or {"pre","post"}, or a constant)."""
    if chan is None:
        return (0.0, 0.0, 0.0)
    if isinstance(chan, list):
        return tuple(num(c) for c in chan)
    vec = lambda v: tuple(num(c) for c in v)
    keys = sorted(((float(k), vec(v["pre"]) if isinstance(v, dict) else vec(v), vec(v["post"]) if isinstance(v, dict) else vec(v))
                   for k, v in chan.items()), key=lambda kv: kv[0])
    if t < keys[0][0]:
        return keys[0][1]
    for (t0, _, a), (t1, b, _) in zip(keys, keys[1:]):
        if t0 <= t < t1:
            u = (t - t0) / (t1 - t0)
            return tuple(x + (y - x) * u for x, y in zip(a, b))
    return keys[-1][2]


def rot_matrix(rx, ry, rz):
    # Bedrock (like Java's y-down model space) vs a right-handed y-up frame: X and Z flip, Y doesn't; applied Z·Y·X.
    # Checked against vanilla: arms x=-90 point forward, crossbow right arm y<0 swings inward, arm-bob right z>0 swings out.
    ax, ay, az = math.radians(-rx), math.radians(ry), math.radians(-rz)
    cx, sx, cy, sy, cz, sz = math.cos(ax), math.sin(ax), math.cos(ay), math.sin(ay), math.cos(az), math.sin(az)
    Rx = ((1, 0, 0), (0, cx, -sx), (0, sx, cx))
    Ry = ((cy, 0, sy), (0, 1, 0), (-sy, 0, cy))
    Rz = ((cz, -sz, 0), (sz, cz, 0), (0, 0, 1))
    mm = lambda A, B: tuple(tuple(sum(A[i][k] * B[k][j] for k in range(3)) for j in range(3)) for i in range(3))
    return mm(Rz, mm(Ry, Rx))


def apply(M, p):
    return tuple(sum(M[i][k] * p[k] for k in range(3)) for i in range(3))


def pose(anim, t):
    """World transform (function point→point) for every bone at time t."""
    bones = anim.get("bones", {})
    xf = {}
    for b in ORDER:
        parent, piv, _ = BONES[b]
        ch = bones.get(b, {})
        r = sample(ch.get("rotation"), t)
        p = sample(ch.get("position"), t)
        M = rot_matrix(*r)
        off = (-p[0], p[1], p[2])

        def f(q, M=M, piv=piv, off=off, par=xf.get(parent)):
            local = apply(M, (q[0] - piv[0], q[1] - piv[1], q[2] - piv[2]))
            q2 = (local[0] + piv[0] + off[0], local[1] + piv[1] + off[1], local[2] + piv[2] + off[2])
            return par(q2) if par else q2
        xf[b] = f
    return xf


def face_colors(skin):
    """Average colour of each cube face from the skin texture."""
    px = skin.convert("RGBA").load()

    def avg(x0, y0, w, h):
        cs = [px[x, y] for x in range(x0, x0 + w) for y in range(y0, y0 + h) if px[x, y][3] > 0]
        if not cs:
            return (128, 128, 128)
        return tuple(sum(c[i] for c in cs) // len(cs) for i in range(3))
    return avg


def render(anim, t, skin, size=220, yaw=-35, pitch=12, scale=5.2, ground=True):
    avg = face_colors(skin)
    xf = pose(anim, t)
    ya, pa = math.radians(yaw), math.radians(pitch)
    faces = []
    for b in ORDER:
        for (o, s, (u, v)) in BONES[b][2]:
            w, h, d = s
            corners = {}
            for i, x in enumerate((o[0], o[0] + w)):
                for j, y in enumerate((o[1], o[1] + h)):
                    for k, z in enumerate((o[2], o[2] + d)):
                        corners[(i, j, k)] = xf[b]((x, y, z))
            # faces: north(front, z min), south, east(+x), west(-x), up, down — with skin UV for the colour
            uvs = {"north": (u + d, v + d, w, h), "south": (u + 2 * d + w, v + d, w, h), "west": (u, v + d, d, h),
                   "east": (u + d + w, v + d, d, h), "up": (u + d, v, w, d), "down": (u + d + w, v, w, d)}
            quads = {"north": [(0, 0, 0), (1, 0, 0), (1, 1, 0), (0, 1, 0)], "south": [(0, 0, 1), (1, 0, 1), (1, 1, 1), (0, 1, 1)],
                     "west": [(0, 0, 0), (0, 0, 1), (0, 1, 1), (0, 1, 0)], "east": [(1, 0, 0), (1, 0, 1), (1, 1, 1), (1, 1, 0)],
                     "up": [(0, 1, 0), (1, 1, 0), (1, 1, 1), (0, 1, 1)], "down": [(0, 0, 0), (1, 0, 0), (1, 0, 1), (0, 0, 1)]}
            shade = {"north": 1.0, "south": 0.7, "west": 0.8, "east": 0.85, "up": 1.1, "down": 0.6}
            for fn, q in quads.items():
                pts = [corners[c] for c in q]
                col = avg(*uvs[fn]) if uvs[fn][0] + uvs[fn][2] <= 64 else (150, 150, 150)
                faces.append((pts, tuple(min(255, int(c * shade[fn])) for c in col)))
    img = Image.new("RGB", (size, size), (34, 36, 46))
    dr = ImageDraw.Draw(img)

    def proj(p):
        x, y, z = p
        x, z = x * math.cos(ya) - z * math.sin(ya), x * math.sin(ya) + z * math.cos(ya)
        y, z = y * math.cos(pa) - z * math.sin(pa), y * math.sin(pa) + z * math.cos(pa)
        return size / 2 + x * scale, size * 0.83 - y * scale, z

    if ground:
        g = [proj(p) for p in ((-16, 0, -16), (16, 0, -16), (16, 0, 16), (-16, 0, 16))]
        dr.polygon([(x, y) for x, y, _ in g], fill=(52, 58, 52))
    drawn = []
    for pts, col in faces:
        pp = [proj(p) for p in pts]
        depth = sum(p[2] for p in pp) / 4
        drawn.append((depth, pp, col))
    drawn.sort(key=lambda d: -d[0])
    for _, pp, col in drawn:
        dr.polygon([(x, y) for x, y, _ in pp], fill=col, outline=(12, 12, 16))
    return img


def load(name):
    return json.loads(ANIMS.read_text())["animations"][name]


def sheet(names, out, frames=8, yaw=-35):
    skin = Image.open(SKIN)
    cell = 170
    rows = []
    for n in names:
        a = load(n)
        L = a.get("animation_length", 1.0)
        imgs = [render(a, L * i / (frames - 1), skin, size=cell, yaw=yaw, scale=4.2) for i in range(frames)]
        row = Image.new("RGB", (cell * frames, cell + 16), (20, 20, 26))
        for i, im in enumerate(imgs):
            row.paste(im, (i * cell, 16))
        ImageDraw.Draw(row).text((4, 2), f"{n.replace('animation.aegis.', '')}  ({L}s)", fill=(230, 230, 230))
        rows.append(row)
    out_img = Image.new("RGB", (cell * frames, sum(r.height for r in rows)), (20, 20, 26))
    y = 0
    for r in rows:
        out_img.paste(r, (0, y))
        y += r.height
    out_img.save(out)


def gif(name, out, fps=20, yaw=-35, size=240):
    skin = Image.open(SKIN)
    a = load(name)
    L = a.get("animation_length", 1.0)
    n = max(2, int(L * fps) + 1)
    frames = [render(a, min(L, i / fps), skin, size=size, yaw=yaw) for i in range(n)]
    frames += [frames[-1]] * int(fps * 0.4)  # short pause before looping
    frames[0].save(out, save_all=True, append_images=frames[1:], duration=int(1000 / fps), loop=0)


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("mode", choices=["sheet", "gif"])
    ap.add_argument("names", nargs="+")
    ap.add_argument("-o", "--out", required=True)
    ap.add_argument("--yaw", type=float, default=-35)
    ap.add_argument("--frames", type=int, default=8)
    args = ap.parse_args()
    names = [n if n.startswith("animation.") else f"animation.aegis.{n}" for n in args.names]
    if args.mode == "sheet":
        sheet(names, args.out, args.frames, args.yaw)
    else:
        gif(names[0], args.out, yaw=args.yaw)
    print("wrote", args.out)
