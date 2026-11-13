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

    # sample every segment at 30 fps (endpoints only for holds). A "cut" key is an instant jump: the pose before it
    # holds right up to the key, which is then written as a pre/post keyframe.
    def lerp(a, b, u):
        return {bn: {ch: [a[bn][ch][i] + (b[bn][ch][i] - a[bn][ch][i]) * u for i in range(3)] for ch in ("r", "p")} for bn in BONES}

    raw = [(tracks[0][0], tracks[0][2])]
    for (t0, _, a), (t1, e, b) in zip(tracks, tracks[1:]):
        if e == "cut":
            raw += [(t1, a), (t1, b)]
            continue
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

    # Hidden in first person (one Molang expression per animation instead of one per key).
    out = {"animation_length": length, "blend_weight": FP_WEIGHT, "bones": {}}
    if loop:
        out["loop"] = "hold_on_last_frame" if loop == "hold" else True
    for bn in BONES:
        for ch, chname in (("r", "rotation"), ("p", "position")):
            seq = [(t, [round(v, 2) for v in ps[bn][ch]]) for t, ps in samples]
            if all(max(abs(v) for v in val) < 0.01 for _, val in seq):
                continue
            # split at cuts (two samples at the same time), simplify each run, write the joins as pre/post keys
            runs, cur = [], [seq[0]]
            for a, b in zip(seq, seq[1:]):
                if b[0] == a[0]:
                    runs.append(cur)
                    cur = [b]
                else:
                    cur.append(b)
            runs.append(cur)
            keys = {}
            for i, run in enumerate(runs):
                run = simplify(run) if len(run) > 2 else run
                for j, (t, val) in enumerate(run):
                    if j == 0 and i > 0:
                        pre = keys[fmt(t)]
                        if pre != k(val):
                            keys[fmt(t)] = {"pre": pre, "post": k(val)}
                    else:
                        keys[fmt(t)] = k(val)
            out["bones"].setdefault(bn, {})[chname] = keys
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
# Jutsu choreography (v3). Every motion is: anticipation with the whole body → a strike on a fixed frame (the
# scripts launch their effects on that frame — don't move it) → a finishing pose that is HELD for a beat → recovery.
# Leaps, lunges and spins come from "rt" (root); a 360° spin is unwound with an invisible "cut" key.
# ===========================================================================
def R(y=0, f=0, pitch=0, spin=0, roll=0, x=0):
    """Root: height, forward travel, lean, spin."""
    return ([pitch, spin, roll], [x, y, -f])


WIDE = {"rl": [0, 0, 16], "ll": [0, 0, -16]}


def tremble(t0, t1, bone, base, amp=2, every=0.05, axis=2):
    return [(round(t, 3), "lin", {bone: v}) for t, v in shake(t0, t1, amp, every, base, axis)]


A["animation.aegis.hand_signs"] = anim(1.0, [
    (0.08, "out", {**WIDE, **seal("ram", h=[14, 0, 0]), "w": HIPS(10, drop=2)}),
    (0.2, "snap", seal("tiger", h=[10, -6, 0], w=HIPS(8, -8, drop=2.4))),
    (0.33, "snap", seal("snake", h=[16, 6, 0], w=HIPS(12, 8, drop=2.8))),
    (0.46, "snap", seal("ram", h=[8, 0, 0], w=HIPS(6, 0, drop=2.2))),
    (0.54, "back", {"w": HIPS(8, drop=2.5)}),
    (0.8, "io", {"w": HIPS(7, drop=2.3)}),
    (1.0, "io", REST),
])

_orbit = lambda i, r=1.0: [-72 + 16 * r * math.sin(i * 1.3), 36 + 18 * r * math.cos(i * 1.3), -12 * r * math.sin(i * 1.3)]
A["animation.aegis.rasengan_hold"] = anim(0.9, [
    (0.15, "out", {**STANCE_LOW, "ra": [-58, -8, 18], "la": [-58, 46, 0], "h": [18, 10, 0], "b": [0, -14, 0], "w": HIPS(20, -8, drop=3)}),
    *[(round(0.2 + i * 0.07, 3), "io", {"la": _orbit(i)}) for i in range(10)],
])

# Chidori: Sasuke's stance — crouched low, the lightning hand held down at his side, the other hand gripping the wrist.
# (Pose solved with the preview rig so the left hand really reaches the right wrist; the script spawns the lightning at
#  CHIDORI_HAND in main.js, which matches where this hand ends up — keep the right arm where it is.)
CHIDORI_POSE = {"w": HIPS(24, 6, drop=3), "b": [0, 12, 0], "ra": [-30, 10, 0], "la": [-25, 70, 40],
                "rl": [30, 0, 14], "ll": [-40, 0, -12], "h": [-22, -10, 0]}
A["animation.aegis.chidori_charge"] = anim(0.8, [
    (0.06, "out", {"ra": [-150, -20, 0], "la": [-120, 30, 0], "w": HIPS(-6, drop=0.5), "h": [-10, 0, 0]}),        # the arm sweeps up…
    (0.14, "snap", CHIDORI_POSE),                                                                                 # …and is driven down
    *tremble(0.18, 0.78, "ra", [-30, 10, 0], 3, 0.04),
    (0.8, "lin", {"ra": [-30, 10, 0]}),
])

A["animation.aegis.palm_thrust"] = anim(0.8, [
    (0.09, "in", {"w": HIPS(4, 32, drop=1.6), "ra": [26, 30, 22], "la": [-50, 44, 0], "rl": [12, 0, 8], "ll": [-10, 0, -8], "h": [6, -14, 0]}),
    (0.16, "snap", {**LUNGE_R, "w": HIPS(22, -28, drop=2.6), "ra": ([-98, -6, 0], [0, 0, -3.5]), "la": [42, 0, -28],
                    "rt": R(f=2.5), "h": [-12, 18, 0]}),
    (0.24, "back", {"w": HIPS(19, -24, drop=2.3), "rt": R(f=2)}),
    (0.55, "io", {"ra": ([-95, -5, 0], [0, 0, -2.5]), "w": HIPS(17, -22, drop=2.1)}),
    (0.8, "io", REST),
])

A["animation.aegis.both_palms"] = anim(0.95, [
    (0.12, "in", {"w": HIPS(4, 30, drop=2), "ra": [-30, -40, 20], "la": [-50, 62, 0], "h": [6, -22, 0], "rl": [8, 0, 12], "ll": [-8, 0, -12]}),  # coil at the hip
    (0.21, "snap", {"w": HIPS(20, 0, drop=2.8), "ra": ([-92, -8, 0], [0, 0, -2.5]), "la": ([-92, 8, 0], [0, 0, -2.5]),
                    "rl": [-36, 0, 10], "ll": [30, 0, -10], "rt": R(f=2), "h": [-14, 0, 0]}),
    (0.3, "back", {"w": HIPS(17, 0, drop=2.5), "rt": R(f=1.6)}),
    (0.7, "io", {"w": HIPS(15, drop=2.3)}),
    (0.95, "io", REST),
])

A["animation.aegis.ninja_run"] = anim(0.6, [
    (0.0, "lin", {"w": HIPS(32, drop=1), "h": [-30, 0, 0], "ra": [72, 0, 12], "la": [72, 0, -12]}),
    (0.3, "io", {"ra": [78, 0, 14], "la": [78, 0, -14], "w": HIPS(34, drop=1.3)}),
    (0.6, "io", {"ra": [72, 0, 12], "la": [72, 0, -12], "w": HIPS(32, drop=1)}),
], plant=False, loop=True)

# A breath jutsu: the chest fills as the body arches back onto the toes, then everything whips forward.
_INHALE = {"ra": [-138, -50, 0], "la": [30, 0, -34], "w": HIPS(-30, 10, drop=0.3), "h": [-38, 0, 0], "rl": [14, 0, 8], "ll": [-10, 0, -8],
           "rt": R(y=1.2, f=-1.5)}
_BLOW = {"ra": [-120, -44, 0], "la": [44, 0, -40], "w": HIPS(34, -8, drop=3.2), "h": [-26, 0, 0], "rl": [-44, 0, 8], "ll": [34, 0, -8], "rt": R(f=2.5)}
A["animation.aegis.jutsu_breath"] = anim(1.15, [
    (0.1, "out", {**seal("mouth"), **WIDE, "w": HIPS(6, drop=1.5)}),
    (0.38, "in", _INHALE),
    (0.48, "snap", _BLOW),
    (0.56, "back", {"w": HIPS(30, -8, drop=3)}),
    *tremble(0.6, 0.86, "b", Z, 1.2, 0.05, axis=0),
    (0.9, "io", {"b": Z, "w": HIPS(26, -6, drop=2.6)}),
    (1.15, "io", REST),
])

A["animation.aegis.earth_slam"] = anim(1.15, [
    (0.08, "in", {"w": HIPS(14, drop=3.5), "ra": [30, 0, 24], "la": [30, 0, -24], "rl": [-20, 0, 10], "ll": [18, 0, -10], "h": [10, 0, 0]}),   # coil
    (0.2, "out", {"rt": R(y=9), "w": HIPS(-16), "ra": [-178, 0, -10], "la": [-178, 0, 10], "rl": [-46, 0, 8], "ll": [34, 0, -8],
                  "h": [-22, 0, 0]}),                                                                                   # leap, fists overhead
    (0.27, "io", {"rt": R(y=9.5), "w": HIPS(-20)}),
    (0.33, "in", {"rt": R(), "w": HIPS(44, drop=5.2), "ra": [-30, 0, 8], "la": [-30, 0, -8], "rl": [-58, 0, 14], "ll": [34, 0, -14],
                  "h": [-32, 0, 0]}),                                                                                   # SLAM to one knee
    (0.41, "elastic", {"w": HIPS(40, drop=4.6)}),
    (0.85, "io", {"w": HIPS(38, drop=4.4), "h": [-36, 0, 0]}),
    (1.15, "io", REST),
])

A["animation.aegis.throw_overhead"] = anim(1.65, [
    (0.2, "out", {"ra": [-176, 0, -6], "la": [-60, 30, -10], "w": HIPS(-4, 8, drop=1.5), **WIDE, "h": [-22, 0, 0]}),          # the disc held high
    *tremble(0.28, 0.8, "ra", [-176, 0, -6], 2, 0.05),
    (0.95, "in", {"ra": [-210, 0, 0], "la": [-70, 0, -40], "w": HIPS(-22, 30, drop=1.5), "rl": [20, 0, 8], "ll": [-22, 0, -8],
                  "h": [-26, -14, 0], "rt": R(y=1.5, f=-1.5)}),                                                         # wind back
    (1.07, "snap", {"ra": [-52, 14, 0], "la": [30, 0, -28], "w": HIPS(32, -30, drop=3), "rl": [-48, 0, 8], "ll": [38, 0, -8],
                    "h": [-14, 20, 0], "rt": R(f=3)}),                                                                  # hurl
    (1.16, "back", {"w": HIPS(28, -26, drop=2.6), "rt": R(f=2.5)}),
    (1.4, "io", {"w": HIPS(24, -22, drop=2.4)}),
    (1.65, "io", REST),
])

_KNEEL_HEAL = {"w": HIPS(30, drop=4.5), "rl": [-56, 0, 10], "ll": [30, 0, -10], "ra": [-48, -18, 0], "la": [-48, 18, 0], "h": [8, 0, 0]}
A["animation.aegis.heal_palms"] = anim(1.2, [
    (0.18, "out", _KNEEL_HEAL),
    (0.42, "io", {"ra": [-54, -14, 0], "la": [-54, 14, 0], "w": HIPS(32, drop=4.7)}),
    (0.66, "io", {"ra": [-46, -19, 0], "la": [-46, 19, 0], "w": HIPS(30, drop=4.5)}),
    (0.9, "io", {"ra": [-53, -15, 0], "la": [-53, 15, 0]}),
    (1.2, "io", REST),
])

A["animation.aegis.lightning_burst"] = anim(1.05, [
    (0.15, "in", {"w": HIPS(28, drop=4), "ra": [-66, -56, 0], "la": [-66, 56, 0], "h": [24, 0, 0], "rl": [-14, 0, 14], "ll": [12, 0, -14]}),
    (0.24, "snap", {"w": HIPS(-20), "rt": R(y=3.5), "ra": [-20, 0, 112], "la": [-20, 0, -112], "h": [-34, 0, 0],
                    "rl": [8, 0, 20], "ll": [8, 0, -20]}),                                                              # burst: thrown open, off the ground
    (0.32, "back", {"rt": R(y=3)}),
    *tremble(0.36, 0.7, "b", Z, 2, 0.05),
    (0.74, "lin", {"b": Z}),
    (0.86, "in", {"rt": R(), "w": HIPS(12, drop=2.5), "ra": [-10, 0, 40], "la": [-10, 0, -40], "h": Z, "rl": [-10, 0, 12], "ll": [10, 0, -12]}),
    (1.05, "io", REST),
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
A["animation.aegis.fireball_jutsu"] = anim(1.35, [
    (0.06, "out", {**WIDE, **seal("snake", h=[12, 0, 0]), "w": HIPS(10, drop=2)}),
    (0.16, "snap", seal("ram", h=[14, -5, 0], w=HIPS(12, -6, drop=2.4))),
    (0.26, "snap", seal("tiger", h=[10, 5, 0], w=HIPS(10, 6, drop=2.2))),
    (0.36, "io", {"w": HIPS(8, drop=2)}),
    (0.5, "in", _INHALE),                                                                                               # the chest fills
    (0.58, "snap", _BLOW),                                                                                              # BLOW
    (0.66, "back", {"w": HIPS(30, -8, drop=3)}),
    *tremble(0.7, 1.0, "b", Z, 1.2, 0.05, axis=0),
    (1.05, "io", {"b": Z, "w": HIPS(26, -6, drop=2.8)}),
    (1.35, "io", REST),
])

# Phoenix Flower: leaps and spits the volley down across the field, then lands low.
A["animation.aegis.phoenix_breath"] = anim(1.3, [
    (0.1, "in", {**seal("mouth"), "w": HIPS(16, 24, drop=3.5), "rl": [-20, 0, 12], "ll": [16, 0, -12], "h": [-10, 16, 0]}),
    (0.3, "out", {"rt": R(y=7), "w": HIPS(-6, 26), "rl": [-50, 0, 10], "ll": [24, 0, -10], "h": [14, 20, 0], "la": [20, 0, -50]}),
    (0.62, "io", {"rt": R(y=8.5), "w": HIPS(8, -20), "h": [16, -22, 0], "rl": [-30, 0, 10], "ll": [40, 0, -10]}),
    (0.95, "in", {"rt": R(), "w": HIPS(26, -28, drop=4), "h": [4, -26, 0], "rl": [-40, 0, 14], "ll": [30, 0, -14], "la": [30, 0, -40]}),
    (1.03, "elastic", {"w": HIPS(22, -24, drop=3.4)}),
    (1.3, "io", REST),
])

# Rasengan: the palm held out low, the other hand whipping the chakra round faster and faster — then drawn back to strike.
A["animation.aegis.rasengan_form"] = anim(0.95, [
    (0.16, "out", {**STANCE_LOW, "w": HIPS(20, -18, drop=3.2), "ra": [-58, -8, 18], "la": [-70, 40, 0], "h": [20, 14, 0], "b": [0, -10, 0]}),
    *[(round(0.2 + i * 0.068, 3), "io", {"la": _orbit(i, 1 + i * 0.06), "ra": [-58 + (i % 2) * 3, -8, 18 - (i % 2) * 2]}) for i in range(9)],
    (0.86, "in", {"ra": [14, 10, 26], "la": [-60, 36, -6], "w": HIPS(24, 26, drop=3.4), "h": [-8, -18, 0], "b": [0, 10, 0]}),
    (0.95, "io", {"ra": [20, 12, 28]}),
])

A["animation.aegis.ram_strike"] = anim(0.95, [
    (0.0, "lin", {**SPRINT, "ra": [20, 12, 26], "la": [-50, 30, -10], "w": HIPS(32, 24, drop=2.4)}),
    (0.1, "in", {"ra": [34, 16, 30], "w": HIPS(30, 34, drop=2.6), "h": [-22, -22, 0]}),                                   # drawn right back
    (0.2, "snap", {"ra": ([-100, -12, 0], [0, 0, -5]), "la": [52, 0, -30], "w": HIPS(30, -34, drop=3), "h": [-24, 26, 0],
                   "rl": [-58, 0, 4], "ll": [46, 0, -4], "rt": R(f=5)}),                                                 # DRIVE
    (0.28, "back", {"rt": R(f=4.2), "w": HIPS(27, -30, drop=2.7)}),
    *[(round(t, 3), "lin", {"ra": (v, [0, 0, -5])}) for t, v in shake(0.32, 0.62, 2.5, 0.04, [-100, -12, 0])],             # grinding it in
    (0.66, "lin", {"ra": ([-100, -12, 0], [0, 0, -5])}),
    (0.74, "snap", {"ra": ([-96, -8, 0], [0, 0, -7]), "w": HIPS(34, -38, drop=3.2)}),                                    # the final shove
    (0.95, "io", REST),
])

A["animation.aegis.substitution"] = anim(0.5, [
    (0.07, "snap", {"ra": [-118, -34, 0], "la": [30, 0, -20], "w": HIPS(28, drop=4.2), "h": [18, 0, 0], "rl": [-34, 0, 12], "ll": [26, 0, -12]}),
    (0.32, "io", {"w": HIPS(26, drop=4.4)}),
    (0.5, "io", REST),
])

A["animation.aegis.clone_seal"] = anim(1.1, [
    (0.12, "snap", {**seal("cross"), **WIDE, "w": HIPS(10, drop=2.4), "h": [12, 0, 0]}),
    (0.2, "back", {"w": HIPS(8, drop=2)}),
    *tremble(0.25, 0.55, "b", Z, 1.5, 0.05),
    (0.62, "in", {"b": Z, "w": HIPS(16, drop=3.2), "h": [18, 0, 0]}),
    (0.7, "snap", {"ra": [-34, 0, 92], "la": [-34, 0, -92], "w": HIPS(-12, drop=0.6), "h": [-18, 0, 0], "rt": R(y=1.5)}),
    (0.78, "back", {"rt": R()}),
    (0.95, "io", {"ra": [-30, 0, 84], "la": [-30, 0, -84]}),
    (1.1, "io", REST),
])

A["animation.aegis.body_flicker"] = anim(0.5, [
    (0.07, "snap", {**SPRINT, "w": HIPS(42, drop=3.4), "ra": [-116, -34, 0], "la": [74, 0, -16], "rt": R(pitch=8, f=1)}),
    (0.38, "io", {"la": [80, 0, -18], "rt": R(pitch=10, f=2)}),
    (0.5, "io", REST),
])

# Great Breakthrough: a full spin gathers the wind, both palms release it.
A["animation.aegis.wind_palm"] = anim(0.9, [
    (0.08, "in", {"w": HIPS(6, 30, drop=2), "ra": [-30, 40, 50], "la": [-50, 40, -10], "rl": [10, 0, 12], "ll": [-10, 0, -12]}),
    (0.22, "lin", {"rt": ([0, -360, 0], [0, 1, 0]), "ra": [-60, 20, 70], "la": [-60, -20, -70], "w": HIPS(8, 0, drop=1.5)}),
    (0.22, "cut", {"rt": (Z, [0, 1, 0])}),
    (0.25, "snap", {**LUNGE_R, "w": HIPS(22, -12, drop=2.8), "ra": ([-94, 0, -18], [0, 0, -2.5]), "la": ([-94, 0, 18], [0, 0, -2.5]),
                    "h": [-12, 6, 0], "rt": R(f=2.5)}),
    (0.34, "back", {"w": HIPS(18, -10, drop=2.4)}),
    (0.7, "io", {"rt": R(f=2)}),
    (0.9, "io", REST),
])

_flow = seal_run(0.05, ["boar", "dog", "bird", "snake", "tiger", "ram"], 0.11, bob=0.8)
for i, (t, e, p) in enumerate(_flow):
    p["w"] = HIPS(8, (16, -16)[i % 2], (4, -4)[i % 2], drop=1.6)
    p.update(WIDE)
A["animation.aegis.water_seals"] = anim(0.8, [*_flow, (0.8, "io", {"ra": [-80, -30, 0], "la": [-80, 30, 0], "w": HIPS(6, drop=1.2)})])

A["animation.aegis.summon_slam"] = anim(1.3, [
    (0.14, "out", {"ra": [-150, -42, 0], "la": [-20, 0, -22], "h": [20, -20, 0], "w": HIPS(10, 10, drop=1)}),                # bite the thumb
    (0.38, "in", {"ra": [-184, 0, 12], "la": [-30, 0, -44], "w": HIPS(-16, drop=0.3), "h": [-18, 0, 0], "rt": R(y=4)}),        # rise
    (0.52, "in", {"ra": [-26, 0, 10], "la": [14, 0, -44], "w": HIPS(46, drop=5), "h": [-34, 0, 0], "rl": [-56, 0, 12], "ll": [36, 0, -12],
                  "rt": R()}),                                                                                         # SLAM
    (0.6, "elastic", {"w": HIPS(42, drop=4.4)}),
    (1.05, "io", {"w": HIPS(40, drop=4.2)}),
    (1.3, "io", REST),
])

A["animation.aegis.eye_activate"] = anim(0.9, [
    (0.12, "out", {"ra": [-142, -56, 0], "la": [8, 0, -14], "h": [30, 0, 0], "w": HIPS(16, drop=1.6)}),                      # hand over the eyes
    (0.3, "io", {"h": [34, 0, 0], "w": HIPS(18, drop=1.8)}),
    (0.4, "snap", {"ra": [-50, 24, 40], "la": [10, 0, -24], "h": [-14, 0, 0], "w": HIPS(-8, drop=0.4)}),                    # torn away: the eyes open
    (0.48, "back", {"h": [-10, 0, 0]}),
    (0.7, "io", {"ra": [-44, 22, 36]}),
    (0.9, "io", REST),
])

A["animation.aegis.almighty_push"] = anim(1.1, [
    (0.2, "in", {"w": HIPS(20, drop=3), "ra": [-62, -30, 10], "la": [-62, 30, -10], "h": [20, 0, 0], "rl": [-10, 0, 14], "ll": [10, 0, -14]}),
    (0.3, "snap", {"w": HIPS(-18, drop=0.4), "ra": [-66, 0, 116], "la": [-66, 0, -116], "h": [-26, 0, 0], "rt": R(y=2.5),
                   "rl": [4, 0, 20], "ll": [4, 0, -20]}),
    (0.4, "back", {"rt": R(y=2)}),
    (0.8, "io", {"rt": R(y=1.6), "ra": [-62, 0, 110], "la": [-62, 0, -110]}),
    (0.92, "in", {"rt": R(), "w": HIPS(8, drop=1.5)}),
    (1.1, "io", REST),
])

A["animation.aegis.pull"] = anim(0.9, [
    (0.12, "out", {"ra": [-102, -10, 0], "la": [10, 0, -20], **LUNGE_R, "rl": [-46, 0, 12], "ll": [38, 0, -12], "w": HIPS(18, -14, drop=2),
                   "rt": R(f=1)}),                                                                                     # reach
    (0.24, "io", {"ra": [-104, -8, 0]}),
    (0.36, "snap", {"ra": [-30, 34, 36], "la": [-20, -22, -32], "w": HIPS(-18, 20, drop=1.5), "rl": [24, 0, 14], "ll": [-28, 0, -14],
                    "rt": R(f=-1.5), "h": [-10, -10, 0]}),                                                             # YANK
    (0.44, "back", {"w": HIPS(-14, 18, drop=1.2)}),
    (0.7, "io", {"w": HIPS(-12, 16, drop=1.2)}),
    (0.9, "io", REST),
])

A["animation.aegis.shadow_seal"] = anim(1.2, [
    (0.12, "snap", {**seal("boar"), "w": HIPS(30, drop=4.6), "h": [-22, 0, 0], "rl": [-58, 0, 10], "ll": [30, 0, -10]}),      # kneels, rat seal
    *tremble(0.2, 1.0, "b", Z, 1, 0.07),
    (1.05, "io", {"b": Z, "w": HIPS(28, drop=4.4)}),
    (1.2, "io", REST),
])

A["animation.aegis.mind_seal"] = anim(0.9, [
    (0.15, "snap", {"ra": [-94, -16, 0], "la": [-94, 16, 0], "w": HIPS(8, drop=1.4), "h": [-8, 0, 0], "rl": [-18, 0, 8], "ll": [14, 0, -8]}),
    (0.24, "back", {"w": HIPS(6, drop=1.2)}),
    (0.6, "io", {"ra": [-96, -18, 0], "la": [-96, 18, 0]}),
    (0.75, "io", {"h": [30, 0, 0], "w": HIPS(14, drop=1.8)}),                                                              # the mind leaves: the head drops
    (0.9, "io", REST),
])

A["animation.aegis.expansion"] = anim(1.1, [
    (0.18, "in", {"w": HIPS(18, drop=3), "ra": [-30, 0, 70], "la": [-30, 0, -70], "rl": [0, 0, 16], "ll": [0, 0, -16]}),
    (0.32, "back2", {"w": HIPS(-14, drop=1), "ra": [-126, 0, 64], "la": [-126, 0, -64], "h": [-28, 0, 0], "rt": R(y=1.5),
                     "rl": [0, 0, 24], "ll": [0, 0, -24]}),
    (0.5, "in", {"rt": R(), "w": HIPS(6, drop=2.4), "ra": [-20, 0, 60], "la": [-20, 0, -60]}),                              # the stomp
    (0.58, "elastic", {"w": HIPS(4, drop=1.8)}),
    (0.9, "io", {"ra": [-24, 0, 56], "la": [-24, 0, -56]}),
    (1.1, "io", REST),
])

A["animation.aegis.insect_release"] = anim(1.0, [
    (0.15, "in", {"ra": [-42, -32, -22], "la": [-42, 32, 22], "w": HIPS(14, drop=2), "h": [14, 0, 0]}),
    (0.28, "snap", {"ra": [-82, 32, 62], "la": [-82, -32, -62], "w": HIPS(-8, drop=1), **WIDE, "h": [-8, 0, 0]}),
    (0.38, "back", {"w": HIPS(-6, drop=1.2)}),
    (0.6, "io", {"ra": [-88, 28, 56], "la": [-76, -34, -64]}),
    (0.8, "io", {"ra": [-78, 30, 58], "la": [-84, -30, -58]}),
    (1.0, "io", REST),
])

A["animation.aegis.fang_drill"] = anim(0.7, [
    (0.1, "in", {"ra": [-162, 0, 10], "la": [-162, 0, -10], "w": HIPS(30, drop=2.5), "rl": [-20, 0, 8], "ll": [20, 0, -8], "rt": (Z, [0, 0, 0])}),
    (0.16, "out", {"rt": ([28, 180, 0], [0, 5, -2]), "w": HIPS(18, drop=0), "rl": [10, 0, 4], "ll": [10, 0, -4], "h": [-20, 0, 0]}),
    (0.58, "lin", {"rt": ([32, 1260, 0], [0, 6, -3])}),                                                                     # spinning drill
    (0.58, "cut", {"rt": ([32, 180, 0], [0, 6, -3])}),
    (0.7, "out", REST),
], plant=False)

A["animation.aegis.chains_cast"] = anim(1.05, [
    (0.14, "snap", {"ra": [-96, -14, -22], "la": [-96, 14, 22], **LUNGE_R, "w": HIPS(14, drop=2.2), "rt": R(f=1.5)}),
    (0.22, "back", {"w": HIPS(12, drop=2)}),
    (0.45, "io", {"ra": [-98, -12, -20], "la": [-98, 12, 20]}),
    (0.58, "snap", {"ra": [-96, 32, 22], "la": [-96, -32, -22], "w": HIPS(10, 18, drop=2.4)}),                              # twist the seal shut
    (0.66, "back", {"w": HIPS(9, 15, drop=2.2)}),
    (0.85, "io", {"w": HIPS(8, 14, drop=2)}),
    (1.05, "io", REST),
])

# Kirin: the hand raised to the storm, held trembling — then the sky is brought down, to one knee.
A["animation.aegis.kirin_call"] = anim(2.0, [
    (0.2, "out", {"ra": [-62, 0, 22], "la": [-82, 32, 0], "w": HIPS(8, drop=1.5)}),
    (0.42, "back", {"ra": [-182, 0, 8], "la": [-20, 0, -36], "w": HIPS(-16, drop=0.5), "h": [-44, 0, 0], **WIDE}),
    *tremble(0.5, 1.2, "ra", [-182, 0, 8], 2, 0.05),
    (1.3, "in", {"ra": [-208, 0, 0], "w": HIPS(-22, drop=0.2), "h": [-48, 0, 0], "rt": R(y=2.5)}),
    (1.43, "snap", {"ra": [-40, 0, 0], "la": [-10, 0, -30], "w": HIPS(34, drop=4.4), "h": [-20, 0, 0], "rl": [-54, 0, 10], "ll": [32, 0, -10],
                    "rt": R()}),
    (1.51, "elastic", {"w": HIPS(30, drop=4)}),
    (1.8, "io", {"w": HIPS(28, drop=3.8)}),
    (2.0, "io", REST),
])

A["animation.aegis.chidori_spear"] = anim(1.2, [
    (0.15, "out", CHIDORI_POSE),
    *tremble(0.2, 0.46, "ra", [-30, 10, 0], 2.5, 0.04),
    (0.52, "snap", {"ra": ([-94, -8, 0], [0, 0, -3]), "la": [26, 0, -34], "w": HIPS(22, -24, drop=2.8), "rl": [-52, 0, 8], "ll": [42, 0, -8],
                    "h": [-18, 22, 0], "b": [0, -6, 0], "rt": R(f=3.5)}),
    (0.6, "back", {"w": HIPS(19, -22, drop=2.5), "rt": R(f=3)}),
    *[(round(t, 3), "lin", {"ra": (v, [0, 0, -3])}) for t, v in shake(0.64, 0.92, 1.5, 0.04, [-94, -8, 0])],
    (0.96, "lin", {"ra": ([-94, -8, 0], [0, 0, -3])}),
    (1.2, "io", REST),
])

A["animation.aegis.ice_seal"] = anim(1.0, [
    (0.15, "snap", {"ra": [-104, -28, 0], "la": [-30, 0, -40], "w": HIPS(6, -12, drop=1.4), "h": [8, 0, 0], "rl": [-12, 0, 8], "ll": [12, 0, -8]}),
    (0.23, "back", {"w": HIPS(5, -10, drop=1.2)}),
    (0.6, "io", {"ra": [-106, -30, 0], "w": HIPS(6, -13, drop=1.4)}),
    (0.7, "snap", {"ra": [-88, 14, 0], "la": [-40, 0, -60], "w": HIPS(10, 12, drop=1.8), "h": [-8, 0, 0]}),                  # the hand opens
    (0.78, "back", {"w": HIPS(8, 10, drop=1.6)}),
    (1.0, "io", REST),
])

A["animation.aegis.gates_release"] = anim(1.6, [
    (0.18, "in", {"ra": [-72, -42, 32], "la": [-72, 42, -32], "w": HIPS(26, drop=3.8), "h": [24, 0, 0], "rl": [-22, 0, 14], "ll": [22, 0, -14]}),
    *tremble(0.22, 0.62, "b", Z, 2.2, 0.05),
    (0.66, "in", {"ra": [-76, -46, 34], "la": [-76, 46, -34], "w": HIPS(30, drop=4.2), "b": Z}),
    (0.74, "snap", {"ra": [-22, 0, 76], "la": [-22, 0, -76], "w": HIPS(-18, drop=0.3), "h": [-38, 0, 0], "rt": R(y=3),
                    "rl": [0, 0, 20], "ll": [0, 0, -20]}),                                                              # the gates open
    (0.86, "back", {"rt": R(y=2.2)}),
    *tremble(0.9, 1.3, "b", Z, 1.6, 0.05),
    (1.34, "lin", {"b": Z}),
    (1.45, "in", {"rt": R(), "w": HIPS(10, drop=2), "ra": [-18, 0, 40], "la": [-18, 0, -40]}),
    (1.6, "io", REST),
])

# ===========================================================================
# Swords
# ===========================================================================
A["animation.aegis.sword_slash"] = anim(0.8, [
    (0.1, "in", {"ra": [-112, 80, 32], "la": [-34, 0, -30], "w": HIPS(2, 40, drop=1.8), "rl": [10, 0, 8], "ll": [-10, 0, -8], "h": [0, -18, 0]}),
    (0.2, "snap", {"ra": [-94, -86, -16], "la": [26, 0, -40], "w": HIPS(14, -46, drop=2.8), "rl": [-34, 0, 6], "ll": [26, 0, -6], "h": [0, 22, 0],
                   "rt": R(f=2)}),
    (0.3, "back", {"ra": [-80, -100, -16], "w": HIPS(12, -50, drop=2.5)}),
    (0.55, "io", {"w": HIPS(11, -46, drop=2.4)}),
    (0.8, "io", REST),
])

A["animation.aegis.sword_overhead"] = anim(0.95, [
    (0.2, "out", {"ra": [-186, 10, 0], "la": [-172, -14, 0], "w": HIPS(-14, drop=0.5), "h": [-12, 0, 0], "rl": [-30, 0, 8], "ll": [20, 0, -8],
                  "rt": R(y=5)}),                                                                                       # leaps, blade overhead
    (0.31, "in", {"ra": [-198, 10, 0], "la": [-186, -14, 0], "w": HIPS(-20), "rt": R(y=6)}),
    (0.39, "snap", {"ra": [-30, 0, 0], "la": [-36, 26, 0], "w": HIPS(32, drop=3.6), "h": [-24, 0, 0], "rl": [-44, 0, 6], "ll": [30, 0, -6],
                    "rt": R(f=2)}),                                                                                     # comes down with it
    (0.47, "elastic", {"w": HIPS(27, drop=3)}),
    (0.72, "io", {"w": HIPS(25, drop=2.8)}),
    (0.95, "io", REST),
])

A["animation.aegis.sword_thrust"] = anim(0.75, [
    (0.1, "in", {"ra": ([-60, -30, 0], [0, 0, 3]), "w": HIPS(0, 34, drop=1.4), "rl": [10, 0, 6], "ll": [-10, 0, -6], "la": [-40, 30, 0]}),
    (0.17, "snap", {"ra": ([-98, 5, 0], [0, 0, -4]), "la": [36, 0, -30], **LUNGE_R, "w": HIPS(20, -30, drop=2.8), "rt": R(f=3.5)}),
    (0.25, "back", {"w": HIPS(17, -27, drop=2.5), "rt": R(f=3)}),
    (0.52, "io", {"ra": ([-96, 5, 0], [0, 0, -3])}),
    (0.75, "io", REST),
])

A["animation.aegis.sword_spin"] = anim(0.75, [
    (0.08, "in", {"ra": [-90, 0, 76], "la": [-20, 0, -72], "w": HIPS(10, 30, drop=2.4), "rl": [0, 0, 16], "ll": [0, 0, -16]}),
    (0.5, "out", {"rt": ([0, -720, 0], [0, 1, 0]), "w": HIPS(10, 0, drop=2.4)}),                                              # two full turns
    (0.5, "cut", {"rt": (Z, [0, 1, 0])}),
    (0.58, "back", {"rt": R(), "w": HIPS(12, -20, drop=2.8), "ra": [-80, -30, 60]}),
    (0.75, "io", REST),
])

A["animation.aegis.sword_raise"] = anim(1.1, [
    (0.18, "back", {"ra": [-186, 0, 0], "la": [-20, 0, -40], "w": HIPS(-12, drop=0.5), "h": [-30, 0, 0], "rl": [0, 0, 12], "ll": [0, 0, -12]}),
    *tremble(0.24, 0.58, "ra", [-186, 0, 0], 1.5, 0.06),
    (0.68, "snap", {"ra": [-64, 0, 0], "w": HIPS(22, drop=2.8), "h": [0, 0, 0], "rl": [-30, 0, 8], "ll": [22, 0, -8], "rt": R(f=1.5)}),
    (0.76, "back", {"w": HIPS(19, drop=2.5)}),
    (0.95, "io", {"w": HIPS(18, drop=2.4)}),
    (1.1, "io", REST),
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

# ===========================================================================
# Jutsu Clash cinematic (timed against behavior_pack/scripts/clash_shots.js — check with tools/cine_preview.py clash)
# Two families: "chidori" (the jutsu held low at the side, gripped at the wrist) and "orb" (a sphere in the palm).
# ===========================================================================
A["animation.aegis.rest"] = anim(0.2, [(0.1, "io", {"h": [0.6, 0, 0]}), (0.2, "io", REST)])

_READY = {**STANCE_READY, "w": HIPS(10, 12, drop=1.5), "ra": [-40, -20, 10], "la": [-62, 30, 0], "h": [-4, -10, 0]}
A["animation.aegis.clash_ready"] = anim(1.6, [
    (0.0, "lin", _READY),
    (0.8, "io", {"w": HIPS(12, 12, drop=1.9), "ra": [-44, -20, 10], "la": [-58, 30, 0]}),
    (1.6, "io", _READY),
], loop=True)

_CH_HOLD = {**CHIDORI_POSE, "w": HIPS(28, 6, drop=3.6), "h": [-30, -10, 0]}
A["animation.aegis.clash_charge_chidori"] = anim(2.3, [
    (0.12, "out", {"ra": [-160, -10, 0], "la": [-140, 30, 0], "w": HIPS(-8, drop=0.5), "h": [-16, 0, 0], **WIDE}),            # the hand is raised…
    (0.3, "io", {"ra": [-166, -8, 0]}),
    (0.4, "snap", CHIDORI_POSE),                                                                                        # …and driven down, gripped at the wrist
    *[(round(0.46 + i * 0.05, 3), "lin", {"ra": [-30 + (1.5 + i * 0.07) * (1 if i % 2 else -1), 10, (1 + i * 0.05) * (1 if i % 2 else -1)]}) for i in range(36)],
    (2.3, "lin", _CH_HOLD),
])
A["animation.aegis.clash_hold_chidori"] = anim(0.4, [
    (0.0, "lin", _CH_HOLD),
    *tremble(0.05, 0.38, "ra", [-30, 10, 0], 3.5, 0.05),
    (0.4, "lin", _CH_HOLD),
], loop=True)

_ORB_FORM = {**STANCE_LOW, "w": HIPS(20, -18, drop=3.2), "ra": [-58, -8, 18], "la": [-70, 40, 0], "h": [20, 14, 0], "b": [0, -10, 0]}
_ORB_HOLD = {**STANCE_LOW, "w": HIPS(24, 22, drop=3.4), "ra": [14, 10, 34], "la": [-64, 30, 0], "h": [-20, -18, 0], "b": [0, 8, 0]}
A["animation.aegis.clash_charge_orb"] = anim(2.3, [
    (0.16, "out", _ORB_FORM),
    *[(round(0.22 + 1.4 * (i / 20) ** 0.8, 3), "io", {"la": _orbit(i * 1.4, 1 + i * 0.03), "ra": [-58 + (i % 2) * 3, -8, 18 - (i % 2) * 2]}) for i in range(21)],
    (1.72, "io", {"la": [-70, 40, 0]}),
    (2.0, "back", _ORB_HOLD),                                                                                           # drawn back to the hip, ready to run
    (2.3, "io", {"w": HIPS(25, 22, drop=3.5)}),
])
A["animation.aegis.clash_hold_orb"] = anim(0.5, [
    (0.0, "lin", _ORB_HOLD),
    *tremble(0.05, 0.47, "ra", [14, 10, 34], 2.5, 0.06),
    (0.5, "lin", _ORB_HOLD),
], loop=True)


def _run(arms):
    a = {"w": HIPS(40, drop=2), "h": [-36, 0, 0], **arms}
    return anim(0.4, [
        (0.0, "lin", {**a, "rl": [-52, 0, 4], "ll": [48, 0, -4]}),
        (0.2, "io", {**a, "rl": [48, 0, 4], "ll": [-52, 0, -4], "w": HIPS(42, drop=2.4)}),
        (0.4, "io", {**a, "rl": [-52, 0, 4], "ll": [48, 0, -4]}),
    ], loop=True)


A["animation.aegis.clash_run_chidori"] = _run({"ra": [34, 0, 14], "la": [70, 0, -14]})        # the lightning hand low, tearing along the ground
A["animation.aegis.clash_run_orb"] = _run({"ra": [62, 10, 26], "la": [72, 0, -12]})          # the sphere trailing behind

_COCKED = {"w": HIPS(18, 30), "ra": [50, 20, 30], "la": [-70, 20, -10], "rl": [-60, 0, 6], "ll": [40, 0, -6], "h": [-24, -26, 0],
           "rt": R(pitch=14)}
A["animation.aegis.clash_leap"] = anim(1.0, [
    (0.0, "lin", {"w": HIPS(30, drop=4), "rl": [-30, 0, 10], "ll": [26, 0, -10], "ra": [40, 10, 26], "la": [-40, 20, 0], "h": [-20, 0, 0]}),
    (0.14, "out", _COCKED),                                                                                             # launched, the strike arm cocked back
    (1.0, "io", {"w": HIPS(22, 34), "ra": [58, 22, 32]}),
], plant=False, loop="hold")

_STRIKE = {"ra": ([-152, -14, 0], [0, 0, -3]), "la": [60, 0, -34], "w": HIPS(34, -36), "h": [-56, 28, 0], "rl": [30, 0, 6], "ll": [50, 0, -6],
           "rt": R(pitch=24)}
A["animation.aegis.clash_strike"] = anim(3.0, [
    (0.0, "lin", _COCKED),
    (0.1, "snap", _STRIKE),
    (0.2, "back", {"w": HIPS(31, -33)}),
    *[(round(0.26 + i * 0.05, 3), "lin", {"ra": ([-152 + (1.2 + i * 0.05) * (1 if i % 2 else -1), -14, (1 + i * 0.04) * (1 if i % 2 else -1)], [0, 0, -3]),
                                          "w": HIPS(31 + i * 0.14, -33)}) for i in range(54)],
    (3.0, "lin", {"ra": ([-152, -14, 0], [0, 0, -3])}),
], plant=False, loop="hold")

_DOWN = {"w": HIPS(30, drop=4.6), "rl": [-58, 0, 10], "ll": [30, 0, -10], "ra": [-22, 0, 14], "la": [20, 0, -30], "h": [-8, 0, 0], "rt": R()}
def _tumble(pitch, cy=16):
    """Root transform that pitches the whole body about its centre (not its feet)."""
    q = _ap(_rot(pitch, 0, 0), (0, cy, 0))
    return ([pitch, 0, 0], [q[0], cy - q[1], -q[2]])


_HURLED = {"w": HIPS(-28), "ra": [-120, 0, 40], "la": [-120, 0, -40], "rl": [-50, 0, 10], "ll": [-30, 0, -10], "h": [20, 0, 0]}
A["animation.aegis.clash_recoil"] = anim(1.0, [
    (0.0, "lin", _HURLED),
    *[(round(0.9 * i / 12, 3), "lin", {"rt": _tumble(-390 * i / 12), "rl": [-50 - 2 * i, 0, 10], "ll": [-30 - 3 * i, 0, -10]}) for i in range(1, 13)],   # hurled back, tumbling
    (1.0, "lin", {"rt": _tumble(-400)}),
], plant=False, loop="hold")

A["animation.aegis.clash_land"] = anim(0.6, [
    (0.0, "lin", {"w": HIPS(10, drop=1), "rl": [-30, 0, 10], "ll": [10, 0, -10], "ra": [-60, 0, 30], "la": [-40, 0, -40], "h": [10, 0, 0]}),
    (0.1, "in", _DOWN),                                                                                                 # lands on one knee, a hand on the ground
    (0.18, "elastic", {"w": HIPS(26, drop=4.2)}),
    (0.6, "io", {"h": [16, 0, 0], "w": HIPS(32, drop=4.7)}),
], loop="hold")

A["animation.aegis.clash_kneel"] = anim(1.2, [
    (0.0, "lin", {**_DOWN, "h": [16, 0, 0], "w": HIPS(32, drop=4.7)}),
    (0.6, "io", {"w": HIPS(35, drop=4.9), "h": [20, 0, 0]}),
    (1.2, "io", {"w": HIPS(32, drop=4.7), "h": [16, 0, 0]}),
], loop=True)

A["animation.aegis.clash_rise"] = anim(1.2, [
    (0.0, "lin", {**_DOWN, "h": [16, 0, 0], "w": HIPS(32, drop=4.7)}),
    (0.5, "io", {"w": HIPS(20, 6, drop=2.5), "rl": [-30, 0, 8], "ll": [16, 0, -8], "ra": [-8, 0, 8], "la": [6, 0, -10], "h": [0, 0, 0]}),
    (1.0, "io", {"w": HIPS(2, 12), "rl": [0, 0, 5], "ll": [0, 0, -5], "ra": [0, 0, 7], "la": [0, 0, -7], "h": [-8, -12, 0]}),   # stands over them
    (1.2, "io", {"w": HIPS(1, 12)}),
], loop="hold")


# ===========================================================================
# M1 combos (behavior_pack/scripts/m1.js): the hit has already landed when these start, so each one snaps to its
# strike within two frames, holds it for a beat, then recovers — short enough to chain.
# Fists: jab → cross → roundhouse kick → rising uppercut.   Blades: slash → backhand → leaping chop.
# ===========================================================================
_GUARD = {"ra": [-56, -30, 0], "la": [-62, 34, 0], "w": HIPS(8, drop=1.2), "rl": [-10, 0, 6], "ll": [10, 0, -6]}
A["animation.aegis.m1_jab"] = anim(0.42, [
    (0.05, "snap", {"ra": ([-92, -10, 0], [0, 0, -3]), "la": [-56, 38, 0], "w": HIPS(10, -22, drop=1.2), "rl": [-22, 0, 6], "ll": [18, 0, -6],
                    "rt": R(f=1.2), "h": [-4, 12, 0]}),
    (0.13, "back", {"w": HIPS(8, -18, drop=1.1), "rt": R(f=0.9)}),
    (0.28, "io", {**_GUARD, "rt": R(), "h": Z}),
    (0.42, "io", REST),
])
A["animation.aegis.m1_cross"] = anim(0.45, [
    (0.05, "snap", {"la": ([-94, 10, 0], [0, 0, -3.5]), "ra": [-50, -40, 0], "w": HIPS(14, 26, drop=1.6), "rl": [20, 0, 6], "ll": [-26, 0, -6],
                    "rt": R(f=1.6), "h": [-6, -14, 0]}),
    (0.13, "back", {"w": HIPS(12, 22, drop=1.4), "rt": R(f=1.3)}),
    (0.3, "io", {**_GUARD, "rt": R(), "h": Z}),
    (0.45, "io", REST),
])
A["animation.aegis.m1_kick"] = anim(0.5, [
    (0.06, "snap", {"rl": [-84, 0, 26], "ll": [8, 0, -4], "w": HIPS(-14, -34), "ra": [34, 0, 32], "la": [-46, 30, -10], "h": [4, 18, 0],
                    "rt": ([0, -30, 0], [0, 0.6, -1])}),                                                             # roundhouse
    (0.16, "back", {"rl": [-78, 0, 22], "w": HIPS(-11, -30)}),
    (0.32, "io", {**_GUARD, "rt": R(), "h": Z}),
    (0.5, "io", REST),
])
A["animation.aegis.m1_finisher"] = anim(0.62, [
    (0.04, "in", {"w": HIPS(22, 18, drop=3), "ra": [20, 10, 20], "la": [-50, 30, 0], "rl": [-24, 0, 8], "ll": [20, 0, -8], "h": [8, 0, 0]}),   # dips
    (0.12, "snap", {"ra": [-158, -18, 0], "la": [34, 0, -34], "w": HIPS(-16, -24), "rl": [-36, 0, 8], "ll": [22, 0, -8], "h": [-24, 0, 0],
                    "rt": R(y=4.5, f=1.5)}),                                                                           # rising uppercut, off the ground
    (0.22, "back", {"rt": R(y=5, f=1.5)}),
    (0.38, "in", {"rt": R(f=1), "w": HIPS(14, drop=2.4), "ra": [-70, -20, 0], "rl": [-20, 0, 8], "ll": [16, 0, -8], "h": Z}),
    (0.46, "elastic", {"w": HIPS(10, drop=1.8)}),
    (0.62, "io", REST),
])
A["animation.aegis.m1_slash1"] = anim(0.42, [
    (0.0, "lin", {"ra": [-124, 60, 30], "w": HIPS(2, 30, drop=1.2)}),
    (0.06, "snap", {"ra": [-72, -80, -12], "la": [24, 0, -34], "w": HIPS(12, -40, drop=2.2), "rl": [-26, 0, 6], "ll": [20, 0, -6], "h": [0, 18, 0],
                    "rt": R(f=1.4)}),
    (0.15, "back", {"w": HIPS(10, -36, drop=2)}),
    (0.42, "io", REST),
])
A["animation.aegis.m1_slash2"] = anim(0.42, [
    (0.0, "lin", {"ra": [-80, -90, -10], "w": HIPS(8, -30, drop=1.6)}),
    (0.06, "snap", {"ra": [-96, 72, 30], "la": [-30, 30, -10], "w": HIPS(10, 40, drop=2), "rl": [20, 0, 6], "ll": [-24, 0, -6], "h": [0, -18, 0],
                    "rt": R(f=1.4)}),                                                                                # backhand
    (0.15, "back", {"w": HIPS(8, 36, drop=1.8)}),
    (0.42, "io", REST),
])
A["animation.aegis.m1_slash3"] = anim(0.6, [
    (0.0, "lin", {"ra": [-192, 6, 0], "la": [-170, -14, 0], "w": HIPS(-16), "rt": R(y=4), "rl": [-26, 0, 8], "ll": [18, 0, -8]}),
    (0.08, "snap", {"ra": [-34, 0, 0], "la": [-40, 26, 0], "w": HIPS(32, drop=3.4), "h": [-22, 0, 0], "rl": [-44, 0, 6], "ll": [30, 0, -6],
                    "rt": R(f=1.8)}),                                                                                # the leaping chop
    (0.16, "elastic", {"w": HIPS(27, drop=2.9)}),
    (0.4, "io", {"w": HIPS(24, drop=2.6)}),
    (0.6, "io", REST),
])

# ===========================================================================
# Taijutsu scrolls (jutsu3.js) — timed against the hits there: Leaf Hurricane hits at 0.4s, Dynamic Entry flies
# 0.1–0.6s, Front Lotus kicks at 0.15s, leaps at 0.2s, wraps at 0.6s and slams at 1.05s.
# ===========================================================================
A["animation.aegis.leaf_hurricane"] = anim(0.9, [
    (0.08, "in", {"w": HIPS(18, -30, drop=3.4), "ra": [-40, 0, 30], "la": [-40, 0, -30], "rl": [-26, 0, 10], "ll": [20, 0, -10]}),       # coil
    (0.2, "out", {"rt": ([0, 0, 0], [0, 6, 0]), "w": HIPS(-6, 0), "rl": [-14, 0, 82], "ll": [24, 0, -6], "ra": [-20, 0, 70], "la": [-20, 0, -90]}),  # up, leg out
    (0.55, "lin", {"rt": ([0, -360, 0], [0, 7, 0])}),                                                                                     # the whirl
    (0.55, "cut", {"rt": (Z, [0, 7, 0])}),
    (0.66, "in", {"rt": R(), "w": HIPS(26, drop=4), "rl": [-40, 0, 14], "ll": [30, 0, -14], "ra": [-30, 0, 40], "la": [-10, 0, -50]}),  # land low
    (0.74, "elastic", {"w": HIPS(22, drop=3.6)}),
    (0.9, "io", REST),
], plant=False)

A["animation.aegis.dynamic_entry"] = anim(0.9, [
    (0.06, "in", {"w": HIPS(26, drop=3.5), "ra": [40, 0, 20], "la": [40, 0, -20], "rl": [-30, 0, 8], "ll": [24, 0, -8]}),
    (0.16, "snap", {"rt": ([-8, 0, 0], [0, 5, -2]), "w": HIPS(-30), "rl": [-98, 0, 4], "ll": [50, 0, -4], "ra": [40, 0, 40], "la": [40, 0, -40],
                    "h": [20, 0, 0]}),                                                                                                    # the flying kick
    (0.5, "lin", {"rt": ([-10, 0, 0], [0, 4, -3])}),
    (0.62, "in", {"rt": R(), "w": HIPS(20, drop=3), "rl": [-40, 0, 10], "ll": [30, 0, -10], "ra": [-20, 0, 30], "la": [-60, 30, 0], "h": [0, 0, 0]}),
    (0.7, "back", {"w": HIPS(16, drop=2.6)}),                                                                                             # the thumbs-up landing
    (0.78, "io", {"la": [-150, 40, 20], "w": HIPS(10, drop=1.5)}),
    (0.9, "io", REST),
], plant=False)

A["animation.aegis.front_lotus"] = anim(1.4, [
    (0.08, "in", {"w": HIPS(28, drop=4), "rl": [-30, 0, 10], "ll": [26, 0, -10], "ra": [30, 0, 20], "la": [30, 0, -20]}),
    (0.15, "snap", {"w": HIPS(-26), "rl": [-176, 0, 6], "ll": [10, 0, -6], "ra": [20, 0, 50], "la": [20, 0, -50], "h": [-20, 0, 0]}),       # the kick that launches them
    (0.22, "out", {"rt": ([0, 0, 0], [0, 10, 0]), "rl": [-30, 0, 8], "ll": [20, 0, -8], "w": HIPS(10)}),                                   # leaps after them
    (0.6, "io", {"rt": ([0, 0, 0], [0, 16, 0]), "ra": [-150, -40, 0], "la": [-150, 40, 0], "w": HIPS(20)}),                                # wraps them up
    *[(round(0.6 + 0.4 * i / 8, 3), "lin", {"rt": ((lambda r, y: ([r[0][0], -720 * i / 8, 0], [r[1][0], r[1][1] + y, r[1][2]]))(
        _tumble(min(180, 180 * i / 5)), 16 - 8 * i / 8)), "rl": [0, 0, 6], "ll": [0, 0, -6], "w": HIPS(0)}) for i in range(1, 9)],   # spinning, head first
    (1.0, "cut", {"rt": ([0, 0, 0], [0, 0, 0])}),
    (1.05, "snap", {"rt": R(), "w": HIPS(40, drop=5), "rl": [-58, 0, 12], "ll": [34, 0, -12], "ra": [-30, 0, 20], "la": [-30, 0, -20],
                    "h": [-20, 0, 0]}),                                                                                                   # SLAM
    (1.15, "elastic", {"w": HIPS(36, drop=4.6)}),
    (1.4, "io", REST),
], plant=False)


# ---------------------------------------------------------------------------
# Tailed Beast Mode transformation (played by the cinematic in jinchuriki.js, timed with jin_shots.js and the cloak's
# form animation): the seal burns — ba-dum, BA-DUM — the chakra erupts, down on all fours as the shroud bubbles up,
# the tails sprout one by one, a coil, the ROAR, then a feral ready stance.
# ---------------------------------------------------------------------------
_CLUTCH = {"w": HIPS(26, drop=2), "ra": [-52, -38, 0], "la": [-52, 38, 0], "h": [32, 0, 0], "rl": [-10, 0, 6], "ll": [8, 0, -6]}
_ALL_FOURS = {"w": HIPS(72, drop=0), "ra": [-96, -6, 12], "la": [-96, 6, -12], "h": [-60, 0, 0], "rl": [-66, 0, 18], "ll": [-60, 0, -18]}
A["animation.aegis.jin_transform"] = anim(5.3, [
    (0.16, "out", _CLUTCH),                                                                                    # the seal burns
    (0.42, "snap", {"w": HIPS(34, drop=2.6), "h": [40, 0, 0], "ra": [-58, -42, 0], "la": [-58, 42, 0]}),        # ba-dum
    (0.6, "io", {"w": HIPS(28, drop=2.2), "h": [34, 0, 0], "ra": [-52, -38, 0], "la": [-52, 38, 0]}),
    (0.88, "snap", {"w": HIPS(40, drop=3.2), "h": [46, 0, 0], "ra": [-60, -46, 0], "la": [-60, 46, 0]}),        # BA-DUM
    *tremble(0.92, 1.18, "w", [38, 0, 0], 2.5),
    (1.22, "snap", {"w": HIPS(-22, drop=0), "rt": (Z, [0, 2, 0]), "ra": [-34, 0, 104], "la": [-34, 0, -104], "h": [-42, 0, 0],
                    "rl": [0, 0, 14], "ll": [0, 0, -14]}),                                                     # the chakra erupts
    (1.45, "back", {"w": HIPS(-18, drop=0.5), "rt": (Z, [0, 1, 0])}),
    (1.8, "in", {"w": HIPS(48, drop=2), "rt": (Z, Z), "ra": [-70, -10, 10], "la": [-70, 10, -10], "h": [-20, 0, 0],
                 "rl": [-34, 0, 14], "ll": [-30, 0, -14]}),
    (2.05, "out", _ALL_FOURS),                                                                                 # down on all fours
    (2.3, "io", {"w": HIPS(76, drop=0.4)}),
    *[(round(2.42 + k * 0.26, 2), "snap" if k % 2 == 0 else "io", {"w": HIPS(70 + 4 * (k % 2), drop=0.2 * (k % 2)), "h": [-60 - 6 * (k % 2), 0, 0]})
      for k in range(4)],                                                                                      # each tail jolts the body
    (3.35, "in", {"w": HIPS(80, drop=0.8), "h": [-56, 0, 0], "ra": [-100, -8, 16], "la": [-100, 8, -16]}),      # coil
    (3.62, "snap", {"w": HIPS(-20, drop=0), "rt": (Z, [0, 2.5, 0]), "ra": [-56, 0, 112], "la": [-56, 0, -112], "h": [-48, 0, 0],
                    "rl": [-6, 0, 22], "ll": [6, 0, -22]}),                                                    # ROAR
    *tremble(3.7, 4.3, "h", [-48, 0, 0], 3),
    (4.45, "io", {"w": HIPS(30, drop=2.5), "rt": (Z, Z), "ra": [-74, -18, 22], "la": [-74, 18, -22], "h": [-18, 0, 0],
                  "rl": [-30, 0, 12], "ll": [26, 0, -12]}),                                                    # feral ready stance
    (5.0, "io", {"w": HIPS(26, drop=2.2)}),
    (5.3, "io", REST),
])

# Mastered (Tailed Beast Chakra Mode): no struggle — hands in the Ram seal, a golden flash, the flames rise around a
# steady stance, a shout of power, then a confident ready stance.
A["animation.aegis.jin_transform_m"] = anim(5.3, [
    (0.2, "io", {**seal("ram"), "w": HIPS(6, drop=1), "h": [18, 0, 0]}),                                       # calm, eyes closed
    (0.95, "io", {"w": HIPS(8, drop=1.4), "h": [24, 0, 0]}),
    (1.22, "snap", {"w": HIPS(-10, drop=0), "rt": (Z, [0, 1.5, 0]), "ra": [-20, 0, 48], "la": [-20, 0, -48], "h": [-10, 0, 0], **WIDE}),  # golden flash
    (1.5, "back", {"rt": (Z, Z), "w": HIPS(-4, drop=0.6)}),
    (2.0, "io", {"w": HIPS(4, drop=1), "ra": [-10, 0, 30], "la": [-10, 0, -30], "h": [0, 0, 0]}),            # stands in the rising flames
    (3.3, "io", {"w": HIPS(6, drop=1.2), "ra": [-14, 0, 34], "la": [-14, 0, -34]}),
    (3.62, "snap", {"w": HIPS(-14, drop=0), "ra": [-30, 0, 70], "la": [-30, 0, -70], "h": [-28, 0, 0], **WIDE}),  # a shout of power
    *tremble(3.7, 4.2, "h", [-28, 0, 0], 2),
    (4.45, "back", {"w": HIPS(10, -14, drop=1.8), "ra": [-82, 6, 0], "la": [-30, 0, -24], "h": [0, 14, 0], **STANCE_READY}),  # ready
    (5.0, "io", {"w": HIPS(8, -12, drop=1.6)}),
    (5.3, "io", REST),
])


# ---------------------------------------------------------------------------
# Carrying poses for two legendary swords, played by swords.js while the sword is in the main hand (third person only;
# they fade out for every swing — v.attack_time — and swords.js stops them on each hit or sword special).
# The arm angles are solved for the held model (tools/gen_swords.py: the vanilla trident grip, plus the -18° the
# vanilla holding pose adds): Samehada rests across the back of the neck, the arm raised to its grip, like Kisame;
# the Kusanagi is held sheathed across the body from the right hip, the left hand on the scabbard, ready to draw.
# ---------------------------------------------------------------------------
SWING_FADE = "v.is_first_person ? 0.0 : 1.0 - math.clamp(v.attack_time * 6.0, 0.0, 1.0)"
A["animation.aegis.hold_samehada"] = {**anim(1.0, [(0.0, "lin", {"ra": [-183.5, 49.5, -47.5]})], plant=False, loop=True),
                                      "blend_weight": SWING_FADE}
A["animation.aegis.hold_kusanagi"] = {**anim(1.0, [(0.0, "lin", {"w": ([0, 15, 0], Z), "ra": [-23.5, -62, 51], "la": [-82.5, -50, 123.5]})],
                                             plant=False, loop=True), "blend_weight": SWING_FADE}
A["animation.aegis.sword_pose_clear"] = {"animation_length": 0.05, "bones": {"rightArm": {"rotation": [0, 0, 0]}}}


def mirrored(a):
    """The same motion for the other hand: left and right limbs swapped, turns and sideways moves reversed."""
    swap = {"rightArm": "leftArm", "leftArm": "rightArm", "rightLeg": "leftLeg", "leftLeg": "rightLeg"}
    flip = lambda v, idx: {"pre": flip(v["pre"], idx), "post": flip(v["post"], idx)} if isinstance(v, dict) else [(-x if i in idx else x) for i, x in enumerate(v)]
    out = {k: v for k, v in a.items() if k != "bones"}
    out["bones"] = {}
    for bone, chans in a["bones"].items():
        nb = {}
        for ch, keys in chans.items():
            idx = (1, 2) if ch == "rotation" else (0,)
            nb[ch] = {t: flip(v, idx) for t, v in keys.items()}
        out["bones"][swap.get(bone, bone)] = nb
    return out


for _n in [n for n in A if ".clash_" in n]:
    A[_n + "_m"] = mirrored(A[_n])

d = json.loads(P.read_text())
d["animations"].update(A)
P.write_text(json.dumps(d, indent=1) + "\n")
print("Player animations:", len(A), f"({P.stat().st_size // 1024} KB file)")
