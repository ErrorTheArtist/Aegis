#!/usr/bin/env python3
"""Jujutsu Legacy player animations, played from script with playAnimation (no player.json needed, so this pack
works next to other add-ons).

Pose-to-pose keys, the same rig rules as the Way of The Shinobi pack:
  A["animation.jjk.<name>"] = anim(length, [(time, ease, {bone: rot | (rot, pos)}), …], plant=True)
  bones: rt root, w waist (HIPS(lean, twist, side, drop, fwd)), b body, h head, ra/la arms, rl/ll legs
  easings: lin, io, in, out, snap, back; REST returns every bone to zero
  plant=True lowers the model so a foot stays on the ground. Hidden in first person (one blend weight).
Run from the jjk-addon folder:  python3 tools/gen_anims.py
"""
import json
import math
from pathlib import Path

P = Path(__file__).resolve().parent.parent / "resource_pack" / "animations" / "player.animation.json"
FP_WEIGHT = "v.is_first_person ? 0.0 : 1.0"
FPS = 30
BONES = ["root", "waist", "body", "head", "rightArm", "leftArm", "rightLeg", "leftLeg"]
ALIAS = {"rt": "root", "w": "waist", "b": "body", "h": "head", "ra": "rightArm", "la": "leftArm", "rl": "rightLeg", "ll": "leftLeg"}
Z = [0, 0, 0]


def _back(u, s=1.70158):
    u -= 1
    return 1 + (s + 1) * u ** 3 + s * u ** 2


EASE = {
    "lin": lambda u: u,
    "io": lambda u: 0.5 - 0.5 * math.cos(math.pi * u),
    "in": lambda u: u ** 3,
    "out": lambda u: 1 - (1 - u) ** 3,
    "snap": lambda u: 1 if u >= 1 else 1 - 2 ** (-10 * u) * (1 - u),
    "back": _back,
}


def _rot(rx, ry, rz):
    ax, ay, az = math.radians(-rx), math.radians(ry), math.radians(-rz)
    cx, sx, cy, sy, cz, sz = math.cos(ax), math.sin(ax), math.cos(ay), math.sin(ay), math.cos(az), math.sin(az)
    Rx = ((1, 0, 0), (0, cx, -sx), (0, sx, cx))
    Ry = ((cy, 0, sy), (0, 1, 0), (-sy, 0, cy))
    Rz = ((cz, -sz, 0), (sz, cz, 0), (0, 0, 1))
    mm = lambda A, B: tuple(tuple(sum(A[i][k] * B[k][j] for k in range(3)) for j in range(3)) for i in range(3))
    return mm(Rz, mm(Ry, Rx))


def _ap(M, p):
    return tuple(sum(M[i][k] * p[k] for k in range(3)) for i in range(3))


LEG_BOX = {"rightLeg": ((-1.9, 12, 0), (-3.9, 0, -2)), "leftLeg": ((1.9, 12, 0), (-0.1, 0, -2))}


def lowest_foot(pose):
    Mroot = _rot(*pose["root"]["r"])
    low = 1e9
    for leg, (piv, o) in LEG_BOX.items():
        M = _rot(*pose[leg]["r"])
        lp = pose[leg]["p"]
        for x in (o[0], o[0] + 4):
            for y in (o[1], o[1] + 1):
                for z in (o[2], o[2] + 4):
                    q = _ap(M, (x - piv[0], y - piv[1], z - piv[2]))
                    q = (q[0] + piv[0] - lp[0], q[1] + piv[1] + lp[1], q[2] + piv[2] + lp[2])
                    low = min(low, _ap(Mroot, q)[1])
    return low


def simplify(seq, tol=0.4):
    keep = [seq[0]]
    for i in range(1, len(seq) - 1):
        (t0, a), (t1, b), (t2, c) = keep[-1], seq[i], seq[i + 1]
        u = (t1 - t0) / (t2 - t0) if t2 > t0 else 0
        if any(abs(a[j] + (c[j] - a[j]) * u - b[j]) > tol for j in range(3)):
            keep.append(seq[i])
    keep.append(seq[-1])
    return keep


def fmt(t):
    return f"{t:.4f}".rstrip("0").rstrip(".") or "0"


def anim(length, keys, plant=True):
    state = {b: {"r": list(Z), "p": list(Z)} for b in BONES}
    tracks = []
    if not keys or keys[0][0] > 0:
        tracks.append((0.0, "lin", json.loads(json.dumps(state))))
    for t, ease, pose in keys:
        if pose == "rest":
            for b in BONES:
                state[b] = {"r": list(Z), "p": list(Z)}
        else:
            for name, v in pose.items():
                b = ALIAS.get(name, name)
                state[b] = {"r": list(v[0]), "p": list(v[1])} if isinstance(v, tuple) else {"r": list(v), "p": state[b]["p"]}
        tracks.append((float(t), ease, json.loads(json.dumps(state))))
    if tracks[-1][0] < length:
        tracks.append((length, "lin", tracks[-1][2]))

    def lerp(a, b, u):
        return {bn: {ch: [a[bn][ch][i] + (b[bn][ch][i] - a[bn][ch][i]) * u for i in range(3)] for ch in ("r", "p")} for bn in BONES}

    raw = [(tracks[0][0], tracks[0][2])]
    for (t0, _, a), (t1, e, b) in zip(tracks, tracks[1:]):
        if a != b:
            n = max(1, round((t1 - t0) * FPS))
            raw += [(t0 + (t1 - t0) * i / n, lerp(a, b, EASE[e](i / n))) for i in range(1, n)]
        raw.append((t1, b))
    samples = []
    for t, ps in raw:
        ps = json.loads(json.dumps(ps))
        if plant:
            ps["root"]["p"][1] -= lowest_foot(ps)
        samples.append((t, ps))
    out = {"animation_length": length, "blend_weight": FP_WEIGHT, "bones": {}}
    for bn in BONES:
        for ch, chname in (("r", "rotation"), ("p", "position")):
            seq = [(t, [round(v, 2) for v in ps[bn][ch]]) for t, ps in samples]
            if all(max(abs(v) for v in val) < 0.01 for _, val in seq):
                continue
            seq = simplify(seq) if len(seq) > 2 else seq
            out["bones"].setdefault(bn, {})[chname] = {fmt(t): [round(v, 2) for v in val] for t, val in seq}
    return out


A = {}
REST = "rest"
HIPS = lambda lean=0, twist=0, side=0, drop=0, fwd=0: ([lean, twist, side], [0, -drop, -fwd])
READY = {"w": HIPS(6, drop=1), "rl": [-10, 0, 6], "ll": [10, 0, -6]}

# Blue / Red: a lazy point, two fingers forward
A["animation.jjk.point"] = anim(0.75, [
    (0.12, "out", {**READY, "ra": [-60, 20, 10], "h": [4, -8, 0]}),
    (0.22, "snap", {"ra": [-92, -6, 0], "b": [0, -12, 0], "h": [0, 6, 0], "la": [8, 0, -6]}),
    (0.55, "lin", {"ra": [-90, -6, 0]}),
    (0.75, "io", REST)])
# Hollow Purple: both hands meet at the chest, then the right hand thrusts it out
A["animation.jjk.purple"] = anim(1.5, [
    (0.25, "io", {**READY, "ra": [-70, -40, 0], "la": [-70, 40, 0], "h": [10, 0, 0]}),
    (0.8, "io", {"ra": [-76, -34, -6], "la": [-76, 34, 6], "w": HIPS(10, drop=1.6)}),
    (0.95, "snap", {"ra": [-96, -4, 0], "la": [-20, 20, -20], "b": [0, -18, 0], "w": HIPS(14, -10, drop=1.8), "rl": [-30, 0, 6], "ll": [24, 0, -6]}),
    (1.3, "lin", {"ra": [-94, -4, 0]}),
    (1.5, "io", REST)])
# Domain Expansion: the hand sign, held up in front of the face
A["animation.jjk.domain_sign"] = anim(1.6, [
    (0.3, "io", {"ra": [-110, -30, 0], "la": [-100, 30, 0], "h": [12, 0, 0], "w": HIPS(4, drop=0.6)}),
    (0.5, "snap", {"ra": [-124, -36, 0], "la": [-112, 34, 0], "h": [-8, 0, 0]}),
    (1.3, "lin", {"ra": [-124, -36, 0]}),
    (1.6, "io", REST)])
# Dismantle / Cleave: a flick of the hand across the body
A["animation.jjk.slash"] = anim(0.55, [
    (0.1, "out", {"ra": [-120, 40, 30], "b": [0, 12, 0], **READY}),
    (0.2, "snap", {"ra": [-70, -60, -20], "b": [0, -16, 0]}),
    (0.55, "io", REST)])
# Fuga: the bow of flame — left arm forward, right hand drawn back
A["animation.jjk.fuga"] = anim(1.2, [
    (0.3, "io", {"la": [-90, 10, 0], "ra": [-90, -50, 0], "b": [0, 20, 0], "w": HIPS(4, 20, drop=1), "rl": [-10, 0, 8], "ll": [16, 0, -8]}),
    (0.8, "lin", {"ra": [-88, -70, 0]}),
    (0.88, "snap", {"ra": [-40, 10, 20]}),
    (1.2, "io", REST)])
# Boogie Woogie: arms open, then a sharp clap
A["animation.jjk.clap"] = anim(0.5, [
    (0.12, "out", {"ra": [-80, 50, 0], "la": [-80, -50, 0]}),
    (0.2, "snap", {"ra": [-82, -24, 0], "la": [-82, 24, 0], "h": [6, 0, 0]}),
    (0.5, "io", REST)])
# Cursed Speech: chin up, chest out, arms back
A["animation.jjk.shout"] = anim(0.8, [
    (0.15, "out", {"h": [10, 0, 0], "b": [4, 0, 0]}),
    (0.25, "snap", {"h": [-14, 0, 0], "b": [-6, 0, 0], "ra": [20, 0, 16], "la": [20, 0, -16], "w": HIPS(-4, drop=0.6)}),
    (0.6, "lin", {"h": [-12, 0, 0]}),
    (0.8, "io", REST)])
# Ten Shadows: the dog's head shadow sign, then down to the ground
A["animation.jjk.summon"] = anim(1.0, [
    (0.25, "io", {"ra": [-80, -20, 0], "la": [-76, 26, 0], "h": [10, 0, 0]}),
    (0.55, "lin", {"ra": [-82, -22, 0], "la": [-78, 28, 0]}),
    (0.7, "snap", {"ra": [-30, -10, 10], "la": [-30, 10, -10], "w": HIPS(22, drop=2.4), "h": [24, 0, 0], "rl": [-26, 0, 6], "ll": [20, 0, -6]}),
    (1.0, "io", REST)])
# Blood Manipulation: palms pressed together, then aimed
A["animation.jjk.blood"] = anim(0.9, [
    (0.25, "io", {"ra": [-84, -36, 0], "la": [-84, 36, 0], **READY}),
    (0.4, "lin", {"ra": [-86, -38, 0], "la": [-86, 38, 0]}),
    (0.48, "snap", {"ra": [-94, -10, 0], "la": [-94, 10, 0], "b": [0, -6, 0]}),
    (0.9, "io", REST)])
# Reverse Cursed Technique: open hands, head back, breathe
A["animation.jjk.heal"] = anim(1.1, [
    (0.4, "io", {"ra": [-30, 0, 30], "la": [-30, 0, -30], "h": [-16, 0, 0], "b": [-4, 0, 0]}),
    (0.8, "lin", {"ra": [-34, 0, 32], "la": [-34, 0, -32]}),
    (1.1, "io", REST)])
# Simple Domain: a low iai stance, hand on the hilt
A["animation.jjk.stance"] = anim(0.9, [
    (0.3, "out", {"w": HIPS(16, -10, drop=2.4), "rl": [-30, 0, 10], "ll": [26, 0, -10], "ra": [-40, 30, 0], "la": [-30, -10, 0], "h": [-8, 10, 0]}),
    (0.7, "lin", {"ra": [-42, 30, 0]}),
    (0.9, "io", REST)])
# Black Flash: a wound-up punch that lands with everything
A["animation.jjk.black_flash"] = anim(0.6, [
    (0.12, "in", {"ra": [30, 30, 20], "b": [0, 30, 0], "w": HIPS(6, 20, drop=1.2), "rl": [-12, 0, 8], "ll": [14, 0, -8]}),
    (0.2, "snap", {"ra": [-96, -10, 0], "b": [0, -26, 0], "w": HIPS(18, -20, drop=2, fwd=1), "rl": [-40, 0, 6], "ll": [34, 0, -6]}),
    (0.6, "io", REST)])
# Eating a finger
A["animation.jjk.eat"] = anim(0.9, [
    (0.25, "io", {"ra": [-120, 30, 0], "h": [10, 0, 0]}),
    (0.5, "lin", {"ra": [-124, 30, 0], "h": [-10, 0, 0]}),
    (0.6, "snap", {"h": [-24, 0, 0], "b": [-4, 0, 0], "ra": [10, 0, 20], "la": [10, 0, -20]}),
    (0.9, "io", REST)])
# Cursed tool special: a spinning overhead strike
A["animation.jjk.tool_spin"] = anim(0.7, [
    (0.15, "out", {"ra": [-170, 0, 10], "b": [0, 20, 0], **READY}),
    (0.3, "snap", {"ra": [-40, -40, -20], "b": [0, -30, 0], "w": HIPS(16, -16, drop=1.8)}),
    (0.7, "io", REST)])

P.parent.mkdir(parents=True, exist_ok=True)
P.write_text(json.dumps({"format_version": "1.8.0", "animations": A}, indent=1) + "\n")
print(f"Player animations: {len(A)}")
