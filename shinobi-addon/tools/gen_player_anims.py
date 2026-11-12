#!/usr/bin/env python3
"""Player jutsu / sword animations (played from script with playAnimation).

Pose-to-pose animation, like a hand-keyed rig:
  * every key is a full pose; bones you don't mention hold their previous pose
  * each key has its own easing into it (snap, overshoot, ease-in/out…) — strikes snap, recoveries settle
  * the hips ("waist") carry the weight: crouches, leans and twists come from the hips, not the neck
  * "root" moves the whole body (hops, steps, slides) and the feet are auto-planted: whatever the legs do,
    the model is lowered so the lowest foot touches the ground — stances and lunges never float or sink
  * sampled at 30 fps, then simplified (keys a straight line would reproduce are dropped)
Keys are plain numbers (pre-bakeable, no per-key Molang); a single blend_weight hides them in first person.
Preview any of them with tools/anim_preview.py.  Run from the shinobi-addon folder:  python3 tools/gen_player_anims.py
"""
import json
import math
from pathlib import Path

P = Path(__file__).resolve().parent.parent / "resource_pack" / "animations" / "aegis.animation.json"
FP_WEIGHT = "v.is_first_person ? 0.0 : 1.0"
FPS = 30
BONES = ["root", "waist", "body", "head", "rightArm", "leftArm", "rightLeg", "leftLeg"]
ALIAS = {"rt": "root", "w": "waist", "b": "body", "h": "head", "ra": "rightArm", "la": "leftArm", "rl": "rightLeg", "ll": "leftLeg"}
Z = [0, 0, 0]


# ---------------------------------------------------------------------------
# Easing
# ---------------------------------------------------------------------------
def _back(u, s=1.70158):
    u -= 1
    return 1 + (s + 1) * u ** 3 + s * u ** 2


EASE = {
    "lin": lambda u: u,
    "io": lambda u: 0.5 - 0.5 * math.cos(math.pi * u),                      # smooth in & out
    "in": lambda u: u ** 3,                                                  # wind-up: accelerates into the key
    "out": lambda u: 1 - (1 - u) ** 3,                                       # strike: fast, then decelerates
    "snap": lambda u: 1 if u >= 1 else 1 - 2 ** (-10 * u) * (1 - u),         # very fast snap (expo out)
    "back": _back,                                                           # overshoots slightly, then settles
    "back2": lambda u: _back(u, 2.6),                                        # bigger overshoot
    "elastic": lambda u: 1 if u >= 1 else 1 - math.cos(u * math.pi * 3.5) * math.exp(-5 * u),  # wobbly settle
}


# ---------------------------------------------------------------------------
# Foot planting (same bone maths as tools/anim_preview.py)
# ---------------------------------------------------------------------------
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
    """Lowest y of the leg cubes (root at the origin, root rotation applied)."""
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


# ---------------------------------------------------------------------------
# Pose-to-pose builder
# ---------------------------------------------------------------------------
def anim(length, keys, plant=True, loop=False):
    """keys: [(time, ease, {bone: rot | (rot, pos)})]. Bones not in a key hold their previous pose.
    A key whose pose is "rest" returns every bone to zero."""
    state = {b: {"r": list(Z), "p": list(Z)} for b in BONES}
    tracks = []  # (time, ease, full pose snapshot)
    if not keys or keys[0][0] > 0:
        tracks.append((0.0, "lin", json.loads(json.dumps(state))))
    for t, ease, pose in keys:
        if pose == "rest":
            for b in BONES:
                state[b] = {"r": list(Z), "p": list(Z)}
        else:
            for name, v in pose.items():
                b = ALIAS.get(name, name)
                if isinstance(v, tuple):
                    state[b] = {"r": list(v[0]), "p": list(v[1])}
                else:
                    state[b] = {"r": list(v), "p": state[b]["p"]}
        tracks.append((float(t), ease, json.loads(json.dumps(state))))
    if tracks[-1][0] < length:
        tracks.append((length, "lin", tracks[-1][2]))

    # sample times: 30 fps inside segments that move, endpoints only for holds
    times = []
    for (t0, _, a), (t1, _, b) in zip(tracks, tracks[1:]):
        times.append(t0)
        if a != b:
            n = max(1, round((t1 - t0) * FPS))
            times += [t0 + (t1 - t0) * i / n for i in range(1, n)]
    times.append(tracks[-1][0])

    def pose_at(t):
        for (t0, _, a), (t1, e, b) in zip(tracks, tracks[1:]):
            if t0 <= t <= t1:
                u = EASE[e](0 if t1 == t0 else (t - t0) / (t1 - t0))
                return {bn: {ch: [a[bn][ch][i] + (b[bn][ch][i] - a[bn][ch][i]) * u for i in range(3)] for ch in ("r", "p")} for bn in BONES}
        return tracks[-1][2]

    samples = []
    for t in times:
        ps = pose_at(t)
        if plant:
            ps["root"]["p"][1] -= lowest_foot(ps)
        samples.append((t, ps))

    # Hidden in first person (one Molang expression per animation instead of one per key).
    out = {"animation_length": length, "blend_weight": FP_WEIGHT, "bones": {}}
    if loop:
        out["loop"] = True
    for bn in BONES:
        for ch, chname in (("r", "rotation"), ("p", "position")):
            seq = [(t, [round(v, 2) for v in ps[bn][ch]]) for t, ps in samples]
            if all(max(abs(v) for v in val) < 0.01 for _, val in seq):
                continue
            seq = simplify(seq)
            out["bones"].setdefault(bn, {})[chname] = {fmt(t): k(val) for t, val in seq}
    return out


def simplify(seq, tol=0.4):
    """Drop keys that linear interpolation between their neighbours already reproduces."""
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


def k(v):
    # Plain numbers: no Molang per key, so the game can pre-bake the curves (Molang in every key caused hitches).
    return [round(v[0], 2), round(v[1], 2), round(v[2], 2)]


def shake(t0, t1, amp, every=0.05, base=None, axis=2):
    """Small tremble keys between t0 and t1 (for straining / crackling chakra)."""
    out, i, t = [], 0, t0
    while t < t1 - 1e-6:
        v = list(base or Z)
        v[axis] += amp if i % 2 else -amp
        out.append((round(t, 3), v))
        t += every
        i += 1
    return out


A = {}

# ---------------------------------------------------------------------------
# Stances & building blocks
# ---------------------------------------------------------------------------
REST = "rest"
# hips: (lean/twist, drop) — leaning comes from the hips so the legs stay attached
HIPS = lambda lean=0, twist=0, side=0, drop=0, fwd=0: ([lean, twist, side], [0, -drop, -fwd])
STANCE_READY = {"w": HIPS(8, drop=1), "rl": [-12, 0, 8], "ll": [12, 0, -8]}
STANCE_WIDE = {"w": HIPS(6, drop=1.5), "rl": [0, 0, 20], "ll": [0, 0, -20]}
STANCE_LOW = {"w": HIPS(18, drop=2.5), "rl": [-32, 0, 12], "ll": [28, 0, -12]}
LUNGE_R = {"w": HIPS(22, -12, drop=2), "rl": [-48, 0, 6], "ll": [40, 0, -6]}          # right foot forward
LUNGE_L = {"w": HIPS(22, 12, drop=2), "rl": [40, 0, 6], "ll": [-48, 0, -6]}           # left foot forward
SPRINT = {"w": HIPS(34, drop=2), "rl": [-40, 0, 4], "ll": [42, 0, -4], "h": [-30, 0, 0]}

# hand seals (right arm, left arm) — the hands meet in front of the chest
SEAL = {
    "ram": ([-80, -38, 0], [-80, 38, 0]),
    "tiger": ([-100, -32, -8], [-100, 32, 8]),
    "snake": ([-72, -44, 6], [-86, 34, -6]),
    "boar": ([-64, -40, 0], [-64, 40, 0]),
    "dog": ([-90, -26, -14], [-76, 44, 12]),
    "bird": ([-108, -28, 0], [-96, 36, 0]),
    "cross": ([-96, -36, 8], [-82, 46, -24]),       # shadow clone
    "mouth": ([-125, -46, 0], [-58, 22, -8]),        # fire: hand ring at the mouth
}


def seal(name, **extra):
    r, l = SEAL[name]
    return {"ra": r, "la": l, **extra}


def seal_run(t0, names, step, bob=1.0):
    """A run of hand seals; each snaps in with a little dip of the hips."""
    out = []
    for i, n in enumerate(names):
        out.append((t0 + i * step, "snap", seal(n, h=[14, (-4, 4)[i % 2], 0], w=HIPS(8 + (i % 2) * 2, drop=1 + bob * (i % 2)))))
    return out


# ===========================================================================
# Core jutsu motions
# ===========================================================================
A["animation.aegis.hand_signs"] = anim(0.75, [
    (0.08, "out", {**STANCE_READY, **seal("ram", h=[14, 0, 0])}),
    *seal_run(0.2, ["tiger", "snake", "ram"], 0.13),
    (0.66, "io", {"w": HIPS(4, drop=0.5)}),
    (0.75, "io", REST),
])

A["animation.aegis.rasengan_hold"] = anim(0.9, [
    (0.15, "out", {**STANCE_LOW, "ra": [-62, -12, 14], "la": [-58, 46, 0], "h": [16, 8, 0], "b": [0, -16, 0]}),
    (0.45, "io", {"la": [-74, 34, -8], "ra": [-66, -10, 16]}),
    (0.75, "io", {"la": [-60, 46, 4], "ra": [-62, -12, 14]}),
    (0.9, "io", {"la": [-70, 38, -6]}),
], loop=False)

# Chidori: Sasuke's stance — crouched low, the lightning hand held down at his side, the other hand gripping the wrist.
# (Pose solved with the preview rig so the left hand really reaches the right wrist; the script spawns the lightning at
#  CHIDORI_HAND in main.js, which matches where this hand ends up.)
CHIDORI_POSE = {"w": HIPS(24, 6, drop=3), "b": [0, 12, 0], "ra": [-30, 10, 0], "la": [-25, 70, 40],
                "rl": [30, 0, 14], "ll": [-40, 0, -12], "h": [-22, -10, 0]}
A["animation.aegis.chidori_charge"] = anim(0.8, [
    (0.12, "out", CHIDORI_POSE),
    *[(round(t, 3), "lin", {"ra": v}) for t, v in shake(0.18, 0.78, 3, 0.04, [-30, 10, 0])],
    (0.8, "lin", {"ra": [-30, 10, 0]}),
])

A["animation.aegis.palm_thrust"] = anim(0.55, [
    (0.09, "in", {"w": HIPS(2, 28, drop=1), "ra": [22, 28, 18], "la": [-40, 40, 0], "rl": [10, 0, 6], "ll": [-8, 0, -6], "h": [6, -10, 0]}),
    (0.16, "snap", {**LUNGE_R, "w": HIPS(18, -24, drop=2.2), "ra": ([-98, -6, 0], [0, 0, -3]), "la": [36, 0, -24],
                    "rt": (Z, [0, 0, -2]), "h": [-6, 14, 0]}),
    (0.24, "back", {"w": HIPS(16, -20, drop=2)}),
    (0.38, "io", {"ra": ([-94, -4, 0], [0, 0, -2])}),
    (0.55, "io", REST),
])

A["animation.aegis.both_palms"] = anim(0.65, [
    (0.12, "in", {"w": HIPS(-4, drop=1.2), "ra": [-52, -52, 8], "la": [-52, 52, -8], "h": [8, 0, 0], **{"rl": [6, 0, 10], "ll": [-6, 0, -10]}}),
    (0.21, "snap", {"w": HIPS(16, drop=2.4), "ra": ([-92, -8, 0], [0, 0, -2]), "la": ([-92, 8, 0], [0, 0, -2]), "rl": [-30, 0, 10], "ll": [26, 0, -10],
                    "rt": (Z, [0, 0, -1.5]), "h": [-8, 0, 0]}),
    (0.3, "back", {"w": HIPS(13, drop=2)}),
    (0.5, "io", {"ra": ([-90, -6, 0], [0, 0, -1]), "la": ([-90, 6, 0], [0, 0, -1])}),
    (0.65, "io", REST),
])

A["animation.aegis.ninja_run"] = anim(0.6, [
    (0.0, "lin", {"w": HIPS(32, drop=1), "h": [-30, 0, 0], "ra": [72, 0, 12], "la": [72, 0, -12]}),
    (0.3, "io", {"ra": [78, 0, 14], "la": [78, 0, -14], "w": HIPS(34, drop=1.3)}),
    (0.6, "io", {"ra": [72, 0, 12], "la": [72, 0, -12], "w": HIPS(32, drop=1)}),
], plant=False, loop=True)

A["animation.aegis.jutsu_breath"] = anim(0.8, [
    (0.12, "out", {**seal("mouth"), "w": HIPS(2, drop=1), "rl": [-8, 0, 8], "ll": [8, 0, -8]}),
    (0.38, "in", {"w": HIPS(-16, drop=0.5), "h": [-24, 0, 0], "ra": [-132, -48, 0], "la": [-50, 20, -14]}),     # inhale
    (0.48, "snap", {"w": HIPS(18, drop=2.4), "h": [8, 0, 0], "ra": [-112, -40, 0], "la": [-20, 0, -36],
                    "rl": [-26, 0, 8], "ll": [24, 0, -8], "rt": (Z, [0, 0, -1])}),                              # blow!
    (0.62, "io", {"w": HIPS(14, drop=2)}),
    (0.8, "io", REST),
])

A["animation.aegis.earth_slam"] = anim(0.85, [
    (0.08, "in", {"w": HIPS(10, drop=2.5), "ra": [-20, 0, 20], "la": [-20, 0, -20], "rl": [-14, 0, 10], "ll": [14, 0, -10]}),  # crouch to jump
    (0.2, "out", {"rt": (Z, [0, 7, 0]), "w": HIPS(-10, drop=0), "ra": [-172, 0, -14], "la": [-172, 0, 14], "rl": [-20, 0, 6], "ll": [16, 0, -6],
                  "h": [-16, 0, 0]}),                                                                                  # leap, arms up
    (0.33, "in", {"rt": (Z, [0, 0, 0]), "w": HIPS(38, drop=4.5), "ra": [-36, 0, 12], "la": [-36, 0, -12], "rl": [-34, 0, 18], "ll": [30, 0, -18],
                  "h": [-30, 0, 0]}),                                                                                  # SLAM
    (0.42, "elastic", {"w": HIPS(34, drop=3.6)}),
    (0.68, "io", {"w": HIPS(30, drop=3.4)}),
    (0.85, "io", REST),
])

A["animation.aegis.throw_overhead"] = anim(1.4, [
    (0.2, "out", {"ra": [-176, 0, -6], "la": [-40, 0, -30], "w": HIPS(-4, 8, drop=1), "rl": [-10, 0, 8], "ll": [10, 0, -8], "h": [-18, 0, 0]}),
    (0.6, "io", {"ra": [-180, 4, -4], "w": HIPS(-6, 12, drop=1.2)}),
    (0.95, "in", {"ra": [-205, 0, 0], "la": [-50, 0, -40], "w": HIPS(-16, 24, drop=1.5), "rl": [16, 0, 8], "ll": [-18, 0, -8], "h": [-24, -10, 0]}),  # wind back
    (1.07, "snap", {"ra": [-58, 12, 0], "la": [26, 0, -24], "w": HIPS(26, -26, drop=2.4), "rl": [-40, 0, 8], "ll": [34, 0, -8], "h": [4, 18, 0],
                    "rt": (Z, [0, 0, -2])}),                                                                          # hurl
    (1.17, "back", {"w": HIPS(22, -22, drop=2)}),
    (1.4, "io", REST),
])

A["animation.aegis.heal_palms"] = anim(1.0, [
    (0.15, "out", {"w": HIPS(12, drop=2), "ra": [-62, -20, 0], "la": [-62, 20, 0], "h": [18, 0, 0], "rl": [-18, 0, 10], "ll": [14, 0, -10]}),
    (0.4, "io", {"ra": [-68, -16, 0], "la": [-68, 16, 0], "w": HIPS(13, drop=2.3)}),
    (0.65, "io", {"ra": [-60, -20, 0], "la": [-60, 20, 0], "w": HIPS(12, drop=2)}),
    (0.85, "io", {"ra": [-66, -17, 0], "la": [-66, 17, 0]}),
    (1.0, "io", REST),
])

A["animation.aegis.lightning_burst"] = anim(0.75, [
    (0.15, "in", {"w": HIPS(22, drop=3), "ra": [-62, -52, 0], "la": [-62, 52, 0], "h": [18, 0, 0], "rl": [-10, 0, 14], "ll": [10, 0, -14]}),
    (0.24, "snap", {"w": HIPS(-14, drop=0.5), "rt": (Z, [0, 2, 0]), "ra": [-24, 0, 108], "la": [-24, 0, -108], "h": [-28, 0, 0],
                    "rl": [0, 0, 18], "ll": [0, 0, -18]}),
    (0.34, "back", {"rt": (Z, Z), "w": HIPS(-10, drop=1.5)}),
    (0.58, "io", {"ra": [-20, 0, 102], "la": [-20, 0, -102]}),
    (0.75, "io", REST),
])

_tremble = []
for i in range(10):
    j = 3 if i % 2 else -3
    _tremble.append((round(0.35 + i * 0.16, 2), "lin", {"ra": [-62 + j, -46, j], "la": [-62 - j, 46, -j], "b": [0, 0, j * 0.6]}))
A["animation.aegis.power_up"] = anim(3.8, [
    (0.3, "out", {"w": HIPS(24, drop=3.5), "ra": [-62, -46, 0], "la": [-62, 46, 0], "h": [26, 0, 0], "rl": [-24, 0, 12], "ll": [22, 0, -12]}),
    *_tremble,
    (1.95, "in", {"w": HIPS(30, drop=4), "ra": [-56, -50, 0], "la": [-56, 50, 0], "b": Z, "h": [32, 0, 0]}),               # final gather
    (2.12, "snap", {"w": HIPS(-16, drop=0), "rt": (Z, [0, 3, 0]), "ra": [-42, 0, 128], "la": [-42, 0, -128], "h": [-38, 0, 0],
                    "rl": [0, 0, 20], "ll": [0, 0, -20]}),                                                              # ROAR
    (2.35, "back", {"rt": (Z, [0, 1.5, 0]), "w": HIPS(-12, drop=0.5)}),
    (3.3, "io", {"ra": [-40, 0, 122], "la": [-40, 0, -122], "h": [-30, 0, 0], "rt": (Z, [0, 1, 0])}),
    (3.8, "io", REST),
])

# ===========================================================================
# Per-jutsu motions
# ===========================================================================
A["animation.aegis.fireball_jutsu"] = anim(1.0, [
    (0.06, "out", {**STANCE_READY}),
    *seal_run(0.06, ["snake", "ram", "tiger"], 0.1),
    (0.44, "in", {**seal("mouth"), "w": HIPS(-20, drop=0.6), "h": [-34, 0, 0], "ra": [-136, -48, 0], "la": [-64, 24, -12]}),  # deep inhale
    (0.58, "snap", {"ra": [-116, -40, 0], "la": [-24, 0, -40], "w": HIPS(22, drop=2.6), "h": [12, 0, 0],
                    "rl": [-32, 0, 6], "ll": [28, 0, -6], "rt": (Z, [0, 0, -1.5])}),                                     # BLOW
    (0.7, "back", {"w": HIPS(18, drop=2.2)}),
    (0.86, "io", {"ra": [-100, -30, 0]}),
    (1.0, "io", REST),
])

A["animation.aegis.phoenix_breath"] = anim(1.1, [
    (0.14, "out", {**seal("mouth"), **STANCE_WIDE, "w": HIPS(-10, 26, drop=1.5), "h": [-20, 18, 0]}),
    (0.45, "io", {"w": HIPS(14, 18, drop=2), "h": [10, 22, 0]}),
    (0.72, "io", {"w": HIPS(14, -20, drop=2), "h": [10, -24, 0]}),
    (0.95, "io", {"w": HIPS(10, -28, drop=1.8), "h": [8, -30, 0]}),
    (1.1, "io", REST),
])

_circle = [(round(0.24 + i * 0.065, 3), "io", {"la": [-70 + 12 * math.sin(i * 1.3), 36 + 14 * math.cos(i * 1.3), -10 * math.sin(i * 1.3)]})
           for i in range(10)]
A["animation.aegis.rasengan_form"] = anim(0.95, [
    (0.18, "out", {**STANCE_LOW, "w": HIPS(18, -16, drop=2.8), "ra": [-64, -10, 16], "la": [-56, 42, 0], "h": [18, 12, 0]}),
    *_circle,
    (0.95, "io", {"ra": [-66, -8, 16], "la": [-62, 42, 0]}),
])

A["animation.aegis.ram_strike"] = anim(0.6, [
    (0.0, "lin", {**SPRINT, "ra": [-60, 0, 10]}),
    (0.09, "in", {"ra": [24, 12, 22], "la": [-52, 30, -10], "w": HIPS(26, 28, drop=2.4), "h": [-18, -20, 0]}),             # pull back
    (0.2, "snap", {"ra": ([-104, -10, 0], [0, 0, -5]), "la": [48, 0, -26], "w": HIPS(26, -30, drop=2.8), "h": [-20, 24, 0],
                   "rl": [-56, 0, 4], "ll": [44, 0, -4], "rt": (Z, [0, 0, -4])}),                                        # DRIVE
    (0.3, "back", {"rt": (Z, [0, 0, -3]), "w": HIPS(24, -28, drop=2.4)}),
    (0.45, "io", {"ra": ([-98, -8, 0], [0, 0, -4])}),
    (0.6, "io", REST),
])

A["animation.aegis.substitution"] = anim(0.5, [
    (0.07, "snap", {**seal("ram"), "w": HIPS(26, drop=4), "h": [22, 0, 0], "rl": [-30, 0, 12], "ll": [24, 0, -12]}),
    (0.32, "io", {"w": HIPS(24, drop=4.2)}),
    (0.5, "io", REST),
])

A["animation.aegis.clone_seal"] = anim(0.9, [
    (0.12, "snap", {**seal("cross"), **STANCE_WIDE, "h": [10, 0, 0]}),
    (0.5, "io", {"w": HIPS(8, drop=1.8)}),
    (0.62, "in", {"w": HIPS(10, drop=2.2), "ra": [-98, -38, 8]}),
    (0.7, "snap", {"ra": [-30, 0, 84], "la": [-30, 0, -84], "w": HIPS(-10, drop=0.8), "h": [-16, 0, 0], "rt": (Z, [0, 1.2, 0])}),
    (0.78, "back", {"rt": (Z, Z)}),
    (0.9, "io", REST),
])

A["animation.aegis.body_flicker"] = anim(0.5, [
    (0.07, "snap", {**SPRINT, "w": HIPS(40, drop=3.2), "ra": [72, 0, 16], "la": [72, 0, -16], "rt": ([8, 0, 0], [0, 0, -1])}),
    (0.38, "io", {"ra": [78, 0, 18], "la": [78, 0, -18], "rt": ([10, 0, 0], [0, 0, -2])}),
    (0.5, "io", REST),
])

A["animation.aegis.wind_palm"] = anim(0.7, [
    (0.15, "in", {"w": HIPS(-4, 42, drop=1.5), "ra": [-40, 52, 42], "la": [-62, 32, -10], "rl": [12, 0, 10], "ll": [-12, 0, -10], "h": [0, -24, 0]}),
    (0.25, "snap", {**LUNGE_R, "w": HIPS(18, -12, drop=2.4), "ra": ([-94, 0, -18], [0, 0, -2]), "la": ([-94, 0, 18], [0, 0, -2]),
                    "h": [-6, 6, 0], "rt": (Z, [0, 0, -2])}),
    (0.34, "back", {"w": HIPS(15, -10, drop=2)}),
    (0.55, "io", {"rt": (Z, [0, 0, -1.5])}),
    (0.7, "io", REST),
])

_flow = seal_run(0.05, ["boar", "dog", "bird", "snake", "tiger", "ram"], 0.11, bob=0.6)
for i, (t, e, p) in enumerate(_flow):
    p["w"] = HIPS(6, (12, -12)[i % 2], drop=1.2)
A["animation.aegis.water_seals"] = anim(0.8, [*_flow, (0.8, "io", {"ra": [-80, -30, 0], "la": [-80, 30, 0], "w": HIPS(6, drop=1.2)})])

A["animation.aegis.summon_slam"] = anim(1.0, [
    (0.14, "out", {"ra": [-150, -42, 0], "la": [-20, 0, -22], "h": [20, -20, 0], "w": HIPS(10, 10, drop=1)}),                # bite the thumb
    (0.38, "in", {"ra": [-180, 0, 12], "la": [-30, 0, -40], "w": HIPS(-12, drop=0.5), "h": [-14, 0, 0], "rt": (Z, [0, 3, 0])}),  # rise
    (0.52, "in", {"ra": [-26, 0, 10], "la": [14, 0, -44], "w": HIPS(46, drop=5), "h": [-34, 0, 0], "rl": [-56, 0, 12], "ll": [36, 0, -12],
                  "rt": (Z, Z)}),                                                                                          # SLAM
    (0.6, "elastic", {"w": HIPS(42, drop=4.4)}),
    (0.88, "io", {"w": HIPS(40, drop=4.2)}),
    (1.0, "io", REST),
])

A["animation.aegis.eye_activate"] = anim(0.6, [
    (0.12, "out", {"ra": [-142, -56, 0], "la": [8, 0, -14], "h": [26, 0, 0], "w": HIPS(12, drop=1.2)}),                      # hand over the eyes
    (0.3, "io", {"h": [28, 0, 0]}),
    (0.4, "snap", {"ra": [-56, 22, 34], "h": [-16, 0, 0], "w": HIPS(-6, drop=0.4)}),                                       # snap open
    (0.48, "back", {"h": [-12, 0, 0]}),
    (0.6, "io", REST),
])

A["animation.aegis.almighty_push"] = anim(0.8, [
    (0.2, "in", {"w": HIPS(16, drop=2.5), "ra": [-58, 0, 26], "la": [-58, 0, -26], "h": [16, 0, 0], "rl": [-8, 0, 14], "ll": [8, 0, -14]}),
    (0.3, "snap", {"w": HIPS(-16, drop=0.6), "ra": [-62, 0, 114], "la": [-62, 0, -114], "h": [-22, 0, 0], "rt": (Z, [0, 1.5, 0]),
                   "rl": [0, 0, 18], "ll": [0, 0, -18]}),
    (0.42, "back", {"rt": (Z, Z), "w": HIPS(-12, drop=1)}),
    (0.65, "io", {"ra": [-60, 0, 108], "la": [-60, 0, -108]}),
    (0.8, "io", REST),
])

A["animation.aegis.pull"] = anim(0.6, [
    (0.12, "out", {"ra": [-102, -10, 0], "la": [-92, 10, 0], **LUNGE_R, "rl": [-46, 0, 12], "ll": [38, 0, -12], "w": HIPS(18, drop=2),
                   "rt": (Z, [0, 0, -1])}),   # reach
    (0.24, "io", {"ra": [-104, -8, 0]}),
    (0.36, "snap", {"ra": [-26, 32, 34], "la": [-18, -22, -32], "w": HIPS(-16, drop=1.5), "rl": [24, 0, 14], "ll": [-28, 0, -14],
                    "rt": (Z, [0, 0, 1.5]), "h": [-10, 0, 0]}),                                                            # YANK
    (0.44, "back", {"w": HIPS(-12, drop=1.2)}),
    (0.6, "io", REST),
])

A["animation.aegis.shadow_seal"] = anim(1.2, [
    (0.12, "snap", {**seal("boar"), "w": HIPS(22, drop=3), "h": [-12, 0, 0], "rl": [-30, 0, 16], "ll": [22, 0, -16]}),
    (0.6, "io", {"w": HIPS(24, drop=3.3), "ra": [-74, -40, 0], "la": [-74, 40, 0]}),
    (1.05, "io", {"w": HIPS(22, drop=3)}),
    (1.2, "io", REST),
])

A["animation.aegis.mind_seal"] = anim(0.9, [
    (0.15, "snap", {"ra": [-96, -24, 0], "la": [-96, 24, 0], "w": HIPS(6, drop=1), "h": [-6, 0, 0], **{"rl": [-14, 0, 6], "ll": [10, 0, -6]}}),
    (0.5, "io", {"ra": [-98, -26, 0], "la": [-98, 26, 0]}),
    (0.75, "io", {"ra": [-96, -24, 0], "la": [-96, 24, 0]}),
    (0.9, "io", REST),
])

A["animation.aegis.expansion"] = anim(0.9, [
    (0.18, "in", {"w": HIPS(16, drop=2.5), "ra": [-30, 0, 70], "la": [-30, 0, -70], "rl": [0, 0, 16], "ll": [0, 0, -16]}),
    (0.32, "back2", {"w": HIPS(-12, drop=1.2), "ra": [-122, 0, 62], "la": [-122, 0, -62], "h": [-26, 0, 0], "rt": (Z, [0, 1, 0]),
                     "rl": [0, 0, 22], "ll": [0, 0, -22]}),
    (0.75, "io", {"ra": [-118, 0, 58], "la": [-118, 0, -58], "rt": (Z, Z)}),
    (0.9, "io", REST),
])

A["animation.aegis.insect_release"] = anim(0.8, [
    (0.15, "in", {"ra": [-42, -32, -22], "la": [-42, 32, 22], "w": HIPS(12, drop=1.5)}),
    (0.28, "snap", {"ra": [-82, 32, 62], "la": [-82, -32, -62], "w": HIPS(-8, drop=1), **STANCE_WIDE}),
    (0.38, "back", {"w": HIPS(-6, drop=1.2)}),
    (0.65, "io", {"ra": [-78, 30, 58], "la": [-78, -30, -58]}),
    (0.8, "io", REST),
])

A["animation.aegis.fang_drill"] = anim(0.7, [
    (0.1, "in", {"ra": [-162, 0, 10], "la": [-162, 0, -10], "w": HIPS(30, drop=2.5), "rl": [-20, 0, 8], "ll": [20, 0, -8], "rt": (Z, [0, 0, 0])}),
    (0.16, "out", {"rt": ([28, 180, 0], [0, 5, -2]), "w": HIPS(18, drop=0), "rl": [10, 0, 4], "ll": [10, 0, -4], "h": [-20, 0, 0]}),
    (0.58, "lin", {"rt": ([32, 1260, 0], [0, 6, -3])}),                                                                     # spinning drill
    (0.7, "out", REST),
], plant=False)

A["animation.aegis.chains_cast"] = anim(0.9, [
    (0.14, "snap", {"ra": [-96, -14, -22], "la": [-96, 14, 22], **LUNGE_R, "w": HIPS(12, drop=2)}),
    (0.45, "io", {"ra": [-98, -12, -20], "la": [-98, 12, 20]}),
    (0.58, "snap", {"ra": [-96, 32, 22], "la": [-96, -32, -22], "w": HIPS(8, 16, drop=2)}),                                 # twist the seal
    (0.66, "back", {"w": HIPS(8, 14, drop=2)}),
    (0.9, "io", REST),
])

A["animation.aegis.kirin_call"] = anim(1.6, [
    (0.2, "out", {"ra": [-62, 0, 22], "la": [-82, 32, 0], "w": HIPS(4, drop=1)}),
    (0.42, "back", {"ra": [-182, 0, 10], "la": [-20, 0, -36], "w": HIPS(-14, drop=0.5), "h": [-42, 0, 0], "rl": [0, 0, 14], "ll": [0, 0, -14]}),
    *[(round(t, 3), "lin", {"ra": v}) for t, v in shake(0.5, 1.2, 2, 0.05, [-182, 0, 10])],
    (1.3, "in", {"ra": [-206, 0, 0], "w": HIPS(-18, drop=0.3), "h": [-46, 0, 0]}),
    (1.43, "snap", {"ra": [-48, 0, 0], "la": [-10, 0, -22], "w": HIPS(24, drop=3), "h": [10, 0, 0], "rl": [-30, 0, 8], "ll": [24, 0, -8]}),  # bring it down
    (1.5, "back", {"w": HIPS(20, drop=2.6)}),
    (1.6, "io", REST),
])

A["animation.aegis.chidori_spear"] = anim(0.95, [
    (0.15, "out", CHIDORI_POSE),
    *[(round(t, 3), "lin", {"ra": v}) for t, v in shake(0.2, 0.46, 2.5, 0.04, [-30, 10, 0])],
    (0.52, "snap", {"ra": ([-94, -8, 0], [0, 0, -3]), "la": [22, 0, -30], "w": HIPS(18, -20, drop=2.4), "rl": [-48, 0, 8], "ll": [38, 0, -8],
                    "h": [-14, 20, 0], "b": [0, -6, 0], "rt": (Z, [0, 0, -3])}),
    (0.6, "back", {"w": HIPS(16, -20, drop=2.2)}),
    (0.82, "io", {"ra": ([-90, -6, 0], [0, 0, -2])}),
    (0.95, "io", REST),
])

A["animation.aegis.ice_seal"] = anim(1.0, [
    (0.15, "snap", {"ra": [-102, -26, 0], "la": [-20, 0, -16], "w": HIPS(4, -10, drop=1), "h": [6, 0, 0], "rl": [-10, 0, 6], "ll": [10, 0, -6]}),
    (0.6, "io", {"ra": [-104, -28, 0], "w": HIPS(5, -12, drop=1.2)}),
    (0.7, "snap", {"ra": [-86, 12, 0], "w": HIPS(8, 10, drop=1.5), "h": [-6, 0, 0]}),                                     # open the hand
    (0.78, "back", {"w": HIPS(7, 8, drop=1.4)}),
    (1.0, "io", REST),
])

_strain = [(round(t, 3), "lin", {"b": v}) for t, v in shake(0.22, 0.62, 2, 0.05)]
A["animation.aegis.gates_release"] = anim(1.2, [
    (0.18, "in", {"ra": [-72, -42, 32], "la": [-72, 42, -32], "w": HIPS(24, drop=3.5), "h": [22, 0, 0], "rl": [-22, 0, 14], "ll": [22, 0, -14]}),
    *_strain,
    (0.66, "in", {"ra": [-76, -46, 34], "la": [-76, 46, -34], "w": HIPS(28, drop=4), "b": Z}),
    (0.74, "snap", {"ra": [-22, 0, 72], "la": [-22, 0, -72], "w": HIPS(-16, drop=0.5), "h": [-36, 0, 0], "rt": (Z, [0, 2.5, 0]),
                    "rl": [0, 0, 18], "ll": [0, 0, -18]}),
    (0.86, "back", {"rt": (Z, Z), "w": HIPS(-12, drop=1)}),
    (1.05, "io", {"ra": [-18, 0, 66], "la": [-18, 0, -66]}),
    (1.2, "io", REST),
])

# ===========================================================================
# Swords
# ===========================================================================
A["animation.aegis.sword_slash"] = anim(0.55, [
    (0.1, "in", {"ra": [-112, 80, 32], "la": [-34, 0, -30], "w": HIPS(2, 36, drop=1.5), "rl": [10, 0, 8], "ll": [-10, 0, -8], "h": [0, -16, 0]}),
    (0.2, "snap", {"ra": [-94, -86, -16], "la": [22, 0, -36], "w": HIPS(12, -42, drop=2.4), "rl": [-28, 0, 6], "ll": [22, 0, -6], "h": [0, 20, 0],
                   "rt": (Z, [0, 0, -1.5])}),
    (0.3, "back", {"ra": [-80, -100, -16], "w": HIPS(10, -46, drop=2.2)}),
    (0.55, "io", REST),
])

A["animation.aegis.sword_overhead"] = anim(0.65, [
    (0.2, "out", {"ra": [-186, 10, 0], "la": [-172, -14, 0], "w": HIPS(-14, drop=0.5), "h": [-12, 0, 0], "rl": [-6, 0, 8], "ll": [6, 0, -8]}),
    (0.31, "in", {"ra": [-196, 10, 0], "la": [-184, -14, 0], "w": HIPS(-18, drop=0.3)}),
    (0.39, "snap", {"ra": [-30, 0, 0], "la": [-36, 26, 0], "w": HIPS(28, drop=3), "h": [-22, 0, 0], "rl": [-38, 0, 6], "ll": [28, 0, -6],
                    "rt": (Z, [0, 0, -2])}),
    (0.47, "elastic", {"w": HIPS(24, drop=2.6)}),
    (0.65, "io", REST),
])

A["animation.aegis.sword_thrust"] = anim(0.5, [
    (0.1, "in", {"ra": ([-60, -30, 0], [0, 0, 3]), "w": HIPS(0, 30, drop=1.2), "rl": [8, 0, 6], "ll": [-8, 0, -6]}),
    (0.17, "snap", {"ra": ([-98, 5, 0], [0, 0, -4]), "la": [32, 0, -26], **LUNGE_R, "w": HIPS(16, -26, drop=2.4), "rt": (Z, [0, 0, -3])}),
    (0.25, "back", {"w": HIPS(14, -24, drop=2.2)}),
    (0.36, "io", {"ra": ([-96, 5, 0], [0, 0, -3])}),
    (0.5, "io", REST),
])

A["animation.aegis.sword_spin"] = anim(0.6, [
    (0.08, "in", {"ra": [-90, 0, 72], "la": [-20, 0, -72], "w": HIPS(8, 30, drop=2), "rl": [0, 0, 14], "ll": [0, 0, -14]}),
    (0.5, "out", {"rt": ([0, -360, 0], [0, 0.8, 0]), "w": HIPS(8, 0, drop=2)}),                                              # whole-body spin
    (0.6, "io", REST),
])

A["animation.aegis.sword_raise"] = anim(0.9, [
    (0.18, "back", {"ra": [-186, 0, 0], "la": [-20, 0, -40], "w": HIPS(-12, drop=0.5), "h": [-30, 0, 0], "rl": [0, 0, 10], "ll": [0, 0, -10]}),
    *[(round(t, 3), "lin", {"ra": v}) for t, v in shake(0.24, 0.58, 1.5, 0.06, [-186, 0, 0])],
    (0.68, "snap", {"ra": [-68, 0, 0], "w": HIPS(18, drop=2.2), "h": [4, 0, 0], "rl": [-24, 0, 8], "ll": [18, 0, -8]}),
    (0.76, "back", {"w": HIPS(15, drop=2)}),
    (0.9, "io", REST),
])

# ===========================================================================
# Edo Tensei cinematic (timed against behavior_pack/scripts/edo_shots.js — check with tools/cine_preview.py)
# ===========================================================================
_KNEEL = {"ra": [-26, 0, 10], "la": [-26, 0, -10], "w": HIPS(46, drop=5), "h": [-30, 0, 0], "rl": [-56, 0, 12], "ll": [36, 0, -12]}
A["animation.aegis.edo_tensei"] = anim(9.7, [
    (0.25, "out", {**STANCE_WIDE, "ra": [-60, -30, 0], "la": [-60, 30, 0], "h": [10, 0, 0]}),                               # hands come up
    (0.55, "io", {"ra": [-84, -38, 0], "la": [-84, 38, 0]}),
    (0.65, "snap", {"ra": [-112, -30, -6], "la": [-112, 30, 6], "h": [6, 0, 0], "w": HIPS(4, drop=1.5)}),                   # TIGER: high, at the face
    (0.74, "back", {"w": HIPS(6, drop=1.9)}),
    (1.05, "snap", {"ra": [-70, -48, 8], "la": [-70, 48, -8], "h": [18, -5, 0], "w": HIPS(10, -7, drop=2.5)}),              # SERPENT: low, elbows wide
    (1.14, "back", {"w": HIPS(11, -7, drop=2.8)}),
    (1.45, "snap", {"ra": [-78, -36, 0], "la": [-100, 40, 10], "h": [14, 6, 0], "w": HIPS(8, 8, drop=1.8)}),                # DOG: palm over fist
    (1.54, "back", {"w": HIPS(9, 8, drop=2.1)}),
    (1.85, "snap", {"ra": ([-92, -20, 0], [0, 0, -1.5]), "la": ([-92, 20, 0], [0, 0, -1.5]), "h": [2, 0, 0], "w": HIPS(15, 0, drop=2.3)}),  # DRAGON: thrust forward
    (2.2, "io", {"w": HIPS(13, drop=2)}),
    (2.48, "out", {"ra": ([-152, -60, 0], Z), "la": ([-152, 60, 0], Z), "w": HIPS(-12, drop=0.4), "h": [-18, 0, 0]}),       # arms thrown wide
    (2.6, "snap", {"ra": [-96, -36, 0], "la": [-96, 36, 0], "w": HIPS(6, drop=1.2), "h": [8, 0, 0]}),                       # CLAP
    (2.76, "io", {"ra": [-100, -36, 0], "la": [-100, 36, 0], "w": HIPS(0, drop=0.6)}),
    (2.9, "in", _KNEEL),                                                                                                   # SLAM: both palms on the ground
    (2.98, "elastic", {"w": HIPS(42, drop=4.4)}),
    *[(round(t, 3), "lin", {"ra": v, "la": [v[0], 0, -v[2]]}) for t, v in shake(3.1, 5.2, 1.6, 0.07, [-26, 0, 10], axis=0)],   # straining
    (5.3, "lin", {"ra": [-26, 0, 10], "la": [-26, 0, -10]}),
    (5.9, "io", {"h": [-46, 0, 0]}),                                                                                        # looks up at the coffin
    (8.7, "io", {"w": HIPS(40, drop=4.2), "h": [-42, 0, 0]}),
    (9.4, "io", {"w": HIPS(4, drop=0.5), "ra": [-8, 0, 4], "la": [-8, 0, -4], "h": [-4, 0, 0], "rl": [0, 0, 6], "ll": [0, 0, -6]}),   # stands
    (9.7, "io", REST),
])

# The reanimated body in its coffin: dead still, head bowed — a twitch, the head lifts (tilted), then snaps straight.
A["animation.aegis.edo_awaken"] = anim(3.0, [
    (0.0, "lin", {"h": [44, 0, 0], "ra": [4, 0, 3], "la": [4, 0, -3], "w": HIPS(-3)}),
    (0.85, "lin", {"h": [44, 0, 0]}),
    (0.92, "snap", {"h": [38, 0, 10], "ra": [0, 0, 7]}),
    (1.0, "io", {"ra": [4, 0, 3]}),
    (1.6, "io", {"h": [4, 0, 12]}),
    (1.72, "lin", {"h": [4, 0, 12]}),
    (1.78, "snap", {"h": [-2, 0, 0]}),
    (2.3, "io", {"h": [-7, 0, 0], "ra": [-6, 0, 4], "la": [-6, 0, -4], "w": HIPS(0)}),
    (3.0, "io", REST),
])

d = json.loads(P.read_text())
d["animations"].update(A)
P.write_text(json.dumps(d, indent=1) + "\n")
print("Player animations:", len(A), f"({P.stat().st_size // 1024} KB file)")
