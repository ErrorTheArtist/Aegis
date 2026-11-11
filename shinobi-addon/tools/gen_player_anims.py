#!/usr/bin/env python3
"""Player jutsu / sword animations (played from script with playAnimation).
Each move has anticipation → action → follow-through, and uses the legs for stances.
First-person arms are left alone (v.is_first_person) so the camera view isn't twisted.
Run from the shinobi-addon folder:  python3 tools/gen_player_anims.py
"""
import json
import math
from pathlib import Path

P = Path(__file__).resolve().parent.parent / "resource_pack" / "animations" / "aegis.animation.json"
FP = "(v.is_first_person ? 0.0 : 1.0)"


def k(v):
    return [f"{FP} * {v[0]}", f"{FP} * {v[1]}", f"{FP} * {v[2]}"]


def catmull(p0, p1, p2, p3, u):
    return 0.5 * ((2 * p1) + (-p0 + p2) * u + (2 * p0 - 5 * p1 + 4 * p2 - p3) * u * u + (-p0 + 3 * p1 - 3 * p2 + p3) * u * u * u)


def track(frames, step=0.05):
    """Smooth catmull-rom curve through the keyframes, pre-sampled into linear keyframes.
    (Bedrock's own catmull-rom only accepts constant values, and ours carry the first-person switch.)"""
    times = sorted(frames, key=float)
    ts = [float(t) for t in times]
    vs = [frames[t] for t in times]
    out = {}
    for i in range(len(ts) - 1):
        n = max(1, round((ts[i + 1] - ts[i]) / step))
        for j in range(n):
            u = j / n
            t = ts[i] + (ts[i + 1] - ts[i]) * u
            p0, p1, p2, p3 = vs[max(i - 1, 0)], vs[i], vs[i + 1], vs[min(i + 2, len(vs) - 1)]
            out[f"{t:.3f}".rstrip("0").rstrip(".") or "0"] = k([round(catmull(p0[c], p1[c], p2[c], p3[c], u), 2) for c in range(3)])
    out[f"{ts[-1]:.3f}".rstrip("0").rstrip(".") or "0"] = k(vs[-1])
    return out


def anim(length, bones, loop=False):
    a = {"animation_length": length, "bones": {}}
    if loop:
        a["loop"] = True
    for bone, chans in bones.items():
        a["bones"][bone] = {ch: track(fr) for ch, fr in chans.items()}
    return a


Z = [0, 0, 0]
A = {}

# Hand signs: three distinct seals (rat → tiger → snake) with a little body bob, then release.
A["animation.aegis.hand_signs"] = anim(0.7, {
    "rightArm": {"rotation": {"0.0": Z, "0.08": [-75, -30, 0], "0.2": [-90, -38, -10], "0.32": [-60, -45, 5], "0.44": [-95, -20, -15], "0.56": [-80, -35, 0], "0.7": Z}},
    "leftArm": {"rotation": {"0.0": Z, "0.08": [-75, 30, 0], "0.2": [-60, 45, 10], "0.32": [-92, 38, -5], "0.44": [-70, 25, 15], "0.56": [-80, 35, 0], "0.7": Z}},
    "body": {"rotation": {"0.0": Z, "0.1": [4, 0, 0], "0.3": [2, 4, 0], "0.5": [5, -4, 0], "0.7": Z}},
    "head": {"rotation": {"0.0": Z, "0.1": [8, 0, 0], "0.6": [8, 0, 0], "0.7": Z}},
    "rightLeg": {"rotation": {"0.0": Z, "0.1": [-8, 0, 4], "0.6": [-8, 0, 4], "0.7": Z}},
    "leftLeg": {"rotation": {"0.0": Z, "0.1": [8, 0, -4], "0.6": [8, 0, -4], "0.7": Z}}})

# Rasengan: crouch, cup the orb at the side, lean in.
A["animation.aegis.rasengan_hold"] = anim(0.9, {
    "rightArm": {"rotation": {"0.0": Z, "0.12": [-40, 20, 30], "0.3": [-70, -15, 10], "0.9": [-72, -12, 8]}},
    "leftArm": {"rotation": {"0.0": Z, "0.12": [-30, -10, -20], "0.3": [-65, 40, -5], "0.9": [-62, 42, -5]}},
    "body": {"rotation": {"0.0": Z, "0.3": [12, -15, 0], "0.9": [12, -15, 0]}},
    "rightLeg": {"rotation": {"0.0": Z, "0.3": [-22, 0, 6], "0.9": [-22, 0, 6]}},
    "leftLeg": {"rotation": {"0.0": Z, "0.3": [18, 0, -6], "0.9": [18, 0, -6]}}})

# Chidori: low sprinter stance, lightning hand trailing behind and down, other hand gripping the wrist.
A["animation.aegis.chidori_charge"] = anim(0.8, {
    "rightArm": {"rotation": {"0.0": Z, "0.15": [20, 0, 40], "0.8": [25, 5, 38]}},
    "leftArm": {"rotation": {"0.0": Z, "0.15": [-30, 50, 0], "0.8": [-32, 52, 0]}},
    "body": {"rotation": {"0.0": Z, "0.15": [18, -20, 0], "0.8": [20, -20, 0]}},
    "head": {"rotation": {"0.0": Z, "0.15": [-12, 15, 0], "0.8": [-12, 15, 0]}},
    "rightLeg": {"rotation": {"0.0": Z, "0.15": [25, 0, 5], "0.8": [25, 0, 5]}},
    "leftLeg": {"rotation": {"0.0": Z, "0.15": [-35, 0, -5], "0.8": [-35, 0, -5]}}})

# Palm strike: pull back, lunge forward with the legs, snap the arm out.
A["animation.aegis.palm_thrust"] = anim(0.5, {
    "rightArm": {"rotation": {"0.0": [-30, 0, 0], "0.08": [10, 20, 15], "0.16": [-100, -8, 0], "0.34": [-98, -6, 0], "0.5": Z},
                 "position": {"0.0": Z, "0.08": [0, 0, 2], "0.16": [0, 0, -3], "0.34": [0, 0, -3], "0.5": Z}},
    "leftArm": {"rotation": {"0.0": Z, "0.16": [30, 0, -20], "0.5": Z}},
    "body": {"rotation": {"0.0": Z, "0.08": [0, 25, 0], "0.16": [10, -20, 0], "0.34": [10, -20, 0], "0.5": Z}},
    "rightLeg": {"rotation": {"0.0": Z, "0.16": [-30, 0, 0], "0.34": [-30, 0, 0], "0.5": Z}},
    "leftLeg": {"rotation": {"0.0": Z, "0.16": [25, 0, 0], "0.34": [25, 0, 0], "0.5": Z}}})

# Two-handed push (Almighty Push, Rotation…): gather at the chest, explode outward.
A["animation.aegis.both_palms"] = anim(0.65, {
    "rightArm": {"rotation": {"0.0": Z, "0.12": [-50, -40, 0], "0.22": [-95, 15, -25], "0.5": [-95, 15, -25], "0.65": Z}},
    "leftArm": {"rotation": {"0.0": Z, "0.12": [-50, 40, 0], "0.22": [-95, -15, 25], "0.5": [-95, -15, 25], "0.65": Z}},
    "body": {"rotation": {"0.0": Z, "0.12": [-6, 0, 0], "0.22": [10, 0, 0], "0.5": [10, 0, 0], "0.65": Z}},
    "rightLeg": {"rotation": {"0.0": Z, "0.22": [-20, 0, 8], "0.5": [-20, 0, 8], "0.65": Z}},
    "leftLeg": {"rotation": {"0.0": Z, "0.22": [15, 0, -8], "0.5": [15, 0, -8], "0.65": Z}}})

# Ninja run: arms swept back, body leaning forward.
A["animation.aegis.ninja_run"] = {"loop": True, "bones": {
    "rightArm": {"rotation": k([80, 0, 10])}, "leftArm": {"rotation": k([80, 0, -10])},
    "body": {"rotation": k([14, 0, 0])}, "head": {"rotation": k([-14, 0, 0])}}}

# Fire breath (Fireball / Phoenix Flower): hand seal at the mouth, rear back, blow forward.
A["animation.aegis.jutsu_breath"] = anim(0.8, {
    "rightArm": {"rotation": {"0.0": Z, "0.12": [-120, -40, 0], "0.4": [-125, -45, 0], "0.55": [-90, -30, 0], "0.8": Z}},
    "leftArm": {"rotation": {"0.0": Z, "0.12": [-60, 20, 0], "0.55": [-40, 10, -20], "0.8": Z}},
    "body": {"rotation": {"0.0": Z, "0.3": [-14, 0, 0], "0.5": [14, 0, 0], "0.7": [8, 0, 0], "0.8": Z}},
    "head": {"rotation": {"0.0": Z, "0.3": [-25, 0, 0], "0.5": [10, 0, 0], "0.8": Z}},
    "rightLeg": {"rotation": {"0.0": Z, "0.5": [-18, 0, 0], "0.8": Z}},
    "leftLeg": {"rotation": {"0.0": Z, "0.5": [18, 0, 0], "0.8": Z}}})

# Earth / summoning slam: jump-crouch and slam both palms on the ground.
A["animation.aegis.earth_slam"] = anim(0.8, {
    "rightArm": {"rotation": {"0.0": Z, "0.15": [-160, 0, 15], "0.32": [-35, 0, 10], "0.65": [-35, 0, 10], "0.8": Z}},
    "leftArm": {"rotation": {"0.0": Z, "0.15": [-160, 0, -15], "0.32": [-35, 0, -10], "0.65": [-35, 0, -10], "0.8": Z}},
    "body": {"rotation": {"0.0": Z, "0.15": [-10, 0, 0], "0.32": [40, 0, 0], "0.65": [40, 0, 0], "0.8": Z}},
    "head": {"rotation": {"0.0": Z, "0.32": [-30, 0, 0], "0.65": [-30, 0, 0], "0.8": Z}},
    "rightLeg": {"rotation": {"0.0": Z, "0.32": [-50, 0, 10], "0.65": [-50, 0, 10], "0.8": Z}},
    "leftLeg": {"rotation": {"0.0": Z, "0.32": [30, 0, -10], "0.65": [30, 0, -10], "0.8": Z}}})

# Rasenshuriken: hold it high overhead, wind up, hurl.
A["animation.aegis.throw_overhead"] = anim(1.4, {
    "rightArm": {"rotation": {"0.0": Z, "0.2": [-175, 0, -5], "0.95": [-178, 0, -5], "1.05": [-200, 0, 0], "1.18": [-60, 10, 0], "1.4": Z}},
    "leftArm": {"rotation": {"0.0": Z, "0.2": [-40, 0, -30], "1.05": [-40, 0, -30], "1.18": [20, 0, -20], "1.4": Z}},
    "body": {"rotation": {"0.0": Z, "0.2": [-6, 10, 0], "1.05": [-14, 20, 0], "1.18": [18, -25, 0], "1.4": Z}},
    "rightLeg": {"rotation": {"0.0": Z, "1.05": [15, 0, 0], "1.18": [-30, 0, 0], "1.4": Z}},
    "leftLeg": {"rotation": {"0.0": Z, "1.05": [-15, 0, 0], "1.18": [25, 0, 0], "1.4": Z}}})

# Healing palms: both hands forward and low, gentle pulse.
A["animation.aegis.heal_palms"] = anim(1.0, {
    "rightArm": {"rotation": {"0.0": Z, "0.15": [-70, -15, 0], "0.5": [-75, -18, 0], "0.85": [-70, -15, 0], "1.0": Z}},
    "leftArm": {"rotation": {"0.0": Z, "0.15": [-70, 15, 0], "0.5": [-75, 18, 0], "0.85": [-70, 15, 0], "1.0": Z}},
    "body": {"rotation": {"0.0": Z, "0.15": [8, 0, 0], "0.85": [8, 0, 0], "1.0": Z}},
    "head": {"rotation": {"0.0": Z, "0.15": [15, 0, 0], "0.85": [15, 0, 0], "1.0": Z}}})

# Lightning burst (Chidori Current): fists clenched, then arms and chest thrown open.
A["animation.aegis.lightning_burst"] = anim(0.7, {
    "rightArm": {"rotation": {"0.0": Z, "0.15": [-40, 30, 30], "0.25": [-10, 0, 100], "0.55": [-10, 0, 100], "0.7": Z}},
    "leftArm": {"rotation": {"0.0": Z, "0.15": [-40, -30, -30], "0.25": [-10, 0, -100], "0.55": [-10, 0, -100], "0.7": Z}},
    "body": {"rotation": {"0.0": Z, "0.15": [15, 0, 0], "0.25": [-12, 0, 0], "0.55": [-12, 0, 0], "0.7": Z}},
    "head": {"rotation": {"0.0": Z, "0.15": [15, 0, 0], "0.25": [-25, 0, 0], "0.55": [-25, 0, 0], "0.7": Z}},
    "rightLeg": {"rotation": {"0.0": Z, "0.25": [0, 0, 12], "0.55": [0, 0, 12], "0.7": Z}},
    "leftLeg": {"rotation": {"0.0": Z, "0.25": [0, 0, -12], "0.55": [0, 0, -12], "0.7": Z}}})

# Transformation power-up (cinematics): crouch and gather (trembling), then burst open with a roar.
_g = {}
for i in range(9):
    t = 0.3 + i * 0.18
    j = 3 if i % 2 else -3
    _g[f"{t:.2f}"] = j
A["animation.aegis.power_up"] = anim(3.8, {
    "rightArm": {"rotation": {"0.0": Z, "0.3": [-60, -45, 0], **{t: [-60 + j, -45, j] for t, j in _g.items()}, "1.95": [-60, -45, 0],
                              "2.15": [-40, 0, 125], "3.3": [-40, 0, 120], "3.8": Z}},
    "leftArm": {"rotation": {"0.0": Z, "0.3": [-60, 45, 0], **{t: [-60 - j, 45, -j] for t, j in _g.items()}, "1.95": [-60, 45, 0],
                             "2.15": [-40, 0, -125], "3.3": [-40, 0, -120], "3.8": Z}},
    "body": {"rotation": {"0.0": Z, "0.3": [22, 0, 0], **{t: [22, 0, j * 0.6] for t, j in _g.items()}, "1.95": [22, 0, 0],
                          "2.15": [-14, 0, 0], "3.3": [-12, 0, 0], "3.8": Z}},
    "head": {"rotation": {"0.0": Z, "0.3": [25, 0, 0], "1.95": [25, 0, 0], "2.15": [-35, 0, 0], "3.3": [-30, 0, 0], "3.8": Z}},
    "rightLeg": {"rotation": {"0.0": Z, "0.3": [-25, 0, 10], "1.95": [-25, 0, 10], "2.15": [0, 0, 18], "3.3": [0, 0, 18], "3.8": Z}},
    "leftLeg": {"rotation": {"0.0": Z, "0.3": [25, 0, -10], "1.95": [25, 0, -10], "2.15": [0, 0, -18], "3.3": [0, 0, -18], "3.8": Z}}})

# ===========================================================================
# Per-jutsu animations (each technique has its own motion)
# ===========================================================================
def seal_chain(t0, n, step=0.12):
    """A run of distinct hand seals starting at t0 (arms meet in front of the chest)."""
    poses = [([-75, -35, 0], [-75, 35, 0]), ([-95, -20, -15], [-60, 45, 10]), ([-60, -45, 5], [-95, 25, -10]),
             ([-85, -40, -10], [-85, 40, 10]), ([-100, -15, 0], [-70, 30, 15]), ([-65, -30, 10], [-100, 20, -5])]
    r, l = {}, {}
    for i in range(n):
        t = f"{t0 + i * step:.2f}"
        r[t], l[t] = poses[i % len(poses)]
    return r, l


# Fireball: three quick seals → deep inhale (lean back) → blow out with a hand-ring at the mouth.
_r, _l = seal_chain(0.06, 3, 0.1)
A["animation.aegis.fireball_jutsu"] = anim(1.0, {
    "rightArm": {"rotation": {"0.0": Z, **_r, "0.4": [-130, -45, 0], "0.62": [-115, -40, 0], "0.8": [-100, -30, 0], "1.0": Z}},
    "leftArm": {"rotation": {"0.0": Z, **_l, "0.4": [-70, 20, -10], "0.62": [-30, 0, -35], "0.8": [-20, 0, -30], "1.0": Z}},
    "body": {"rotation": {"0.0": Z, "0.3": [4, 0, 0], "0.45": [-22, 0, 0], "0.6": [20, 0, 0], "0.8": [15, 0, 0], "1.0": Z}},
    "head": {"rotation": {"0.0": Z, "0.3": [10, 0, 0], "0.45": [-35, 0, 0], "0.6": [12, 0, 0], "0.8": [8, 0, 0], "1.0": Z}},
    "rightLeg": {"rotation": {"0.0": Z, "0.45": [8, 0, 6], "0.6": [-30, 0, 6], "0.8": [-30, 0, 6], "1.0": Z}},
    "leftLeg": {"rotation": {"0.0": Z, "0.45": [-8, 0, -6], "0.6": [25, 0, -6], "0.8": [25, 0, -6], "1.0": Z}}})

# Phoenix Sage Fire: hand at the mouth, head sweeps left → right spraying fireballs.
A["animation.aegis.phoenix_breath"] = anim(1.1, {
    "rightArm": {"rotation": {"0.0": Z, "0.15": [-125, -45, 0], "0.95": [-125, -45, 0], "1.1": Z}},
    "leftArm": {"rotation": {"0.0": Z, "0.15": [-40, 0, -30], "0.95": [-40, 0, -30], "1.1": Z}},
    "body": {"rotation": {"0.0": Z, "0.2": [-14, 25, 0], "0.45": [14, 20, 0], "0.7": [14, -20, 0], "0.95": [10, -25, 0], "1.1": Z}},
    "head": {"rotation": {"0.0": Z, "0.2": [-25, 20, 0], "0.45": [10, 25, 0], "0.7": [10, -25, 0], "0.95": [8, -30, 0], "1.1": Z}},
    "rightLeg": {"rotation": {"0.0": Z, "0.3": [-22, 0, 6], "0.95": [-22, 0, 6], "1.1": Z}},
    "leftLeg": {"rotation": {"0.0": Z, "0.3": [20, 0, -6], "0.95": [20, 0, -6], "1.1": Z}}})

# Rasengan forming: palm out, the other hand circles over it shaping the sphere; low stance.
_circ = {f"{0.25 + i * 0.08:.2f}": [-70 + 12 * math.sin(i * 1.3), 35 + 15 * math.cos(i * 1.3), -10 * math.sin(i * 1.3)] for i in range(8)}
A["animation.aegis.rasengan_form"] = anim(0.95, {
    "rightArm": {"rotation": {"0.0": Z, "0.2": [-65, -10, 15], "0.95": [-68, -8, 15]}},
    "leftArm": {"rotation": {"0.0": Z, "0.2": [-55, 40, 0], **_circ, "0.95": [-62, 42, 0]}},
    "body": {"rotation": {"0.0": Z, "0.25": [14, -18, 0], "0.95": [16, -20, 0]}},
    "head": {"rotation": {"0.0": Z, "0.25": [18, 10, 0], "0.95": [10, 15, 0]}},
    "rightLeg": {"rotation": {"0.0": Z, "0.25": [-28, 0, 8], "0.95": [-28, 0, 8]}},
    "leftLeg": {"rotation": {"0.0": Z, "0.25": [25, 0, -8], "0.95": [25, 0, -8]}}})
# Rasengan / Chidori strike: sprint lean then drive the arm all the way through.
A["animation.aegis.ram_strike"] = anim(0.6, {
    "rightArm": {"rotation": {"0.0": [-60, 0, 10], "0.1": [20, 10, 20], "0.22": [-105, -10, 0], "0.45": [-100, -8, 0], "0.6": Z},
                 "position": {"0.0": Z, "0.1": [0, 0, 3], "0.22": [0, 0, -5], "0.45": [0, 0, -5], "0.6": Z}},
    "leftArm": {"rotation": {"0.0": Z, "0.1": [-50, 30, -10], "0.22": [45, 0, -25], "0.6": Z}},
    "body": {"rotation": {"0.0": [10, 0, 0], "0.1": [18, 30, 0], "0.22": [20, -30, 0], "0.45": [18, -28, 0], "0.6": Z}},
    "head": {"rotation": {"0.0": Z, "0.1": [-15, -20, 0], "0.22": [-18, 25, 0], "0.6": Z}},
    "rightLeg": {"rotation": {"0.0": Z, "0.1": [25, 0, 0], "0.22": [-55, 0, 0], "0.45": [-50, 0, 0], "0.6": Z}},
    "leftLeg": {"rotation": {"0.0": Z, "0.1": [-30, 0, 0], "0.22": [40, 0, 0], "0.45": [38, 0, 0], "0.6": Z}}})

# Substitution: snap ram seal, duck — poof.
A["animation.aegis.substitution"] = anim(0.5, {
    "rightArm": {"rotation": {"0.0": Z, "0.08": [-95, -30, 0], "0.3": [-95, -30, 0], "0.5": Z}},
    "leftArm": {"rotation": {"0.0": Z, "0.08": [-95, 30, 0], "0.3": [-95, 30, 0], "0.5": Z}},
    "body": {"rotation": {"0.0": Z, "0.15": [25, 0, 0], "0.35": [25, 0, 0], "0.5": Z}},
    "head": {"rotation": {"0.0": Z, "0.15": [20, 0, 0], "0.5": Z}},
    "rightLeg": {"rotation": {"0.0": Z, "0.15": [-35, 0, 10], "0.35": [-35, 0, 10], "0.5": Z}},
    "leftLeg": {"rotation": {"0.0": Z, "0.15": [25, 0, -10], "0.35": [25, 0, -10], "0.5": Z}}})

# Shadow Clone: the cross-shaped seal held at the chest, then arms flare out.
A["animation.aegis.clone_seal"] = anim(0.9, {
    "rightArm": {"rotation": {"0.0": Z, "0.12": [-90, -40, 20], "0.55": [-92, -42, 20], "0.68": [-30, 0, 80], "0.9": Z}},
    "leftArm": {"rotation": {"0.0": Z, "0.12": [-80, 40, -30], "0.55": [-82, 42, -30], "0.68": [-30, 0, -80], "0.9": Z}},
    "body": {"rotation": {"0.0": Z, "0.12": [6, 0, 0], "0.55": [6, 0, 0], "0.68": [-10, 0, 0], "0.9": Z}},
    "head": {"rotation": {"0.0": Z, "0.12": [10, 0, 0], "0.55": [10, 0, 0], "0.68": [-15, 0, 0], "0.9": Z}},
    "rightLeg": {"rotation": {"0.0": Z, "0.12": [0, 0, 12], "0.75": [0, 0, 12], "0.9": Z}},
    "leftLeg": {"rotation": {"0.0": Z, "0.12": [0, 0, -12], "0.75": [0, 0, -12], "0.9": Z}}})

# Body Flicker: drop low, arms swept back — gone.
A["animation.aegis.body_flicker"] = anim(0.5, {
    "rightArm": {"rotation": {"0.0": Z, "0.08": [70, 0, 15], "0.38": [75, 0, 15], "0.5": Z}},
    "leftArm": {"rotation": {"0.0": Z, "0.08": [70, 0, -15], "0.38": [75, 0, -15], "0.5": Z}},
    "body": {"rotation": {"0.0": Z, "0.08": [30, 0, 0], "0.38": [30, 0, 0], "0.5": Z}},
    "head": {"rotation": {"0.0": Z, "0.08": [-25, 0, 0], "0.38": [-25, 0, 0], "0.5": Z}},
    "rightLeg": {"rotation": {"0.0": Z, "0.08": [-40, 0, 0], "0.38": [-40, 0, 0], "0.5": Z}},
    "leftLeg": {"rotation": {"0.0": Z, "0.08": [45, 0, 0], "0.38": [45, 0, 0], "0.5": Z}}})

# Wind palm (Great Breakthrough): twist back, then a huge two-handed gust push with a lunge.
A["animation.aegis.wind_palm"] = anim(0.7, {
    "rightArm": {"rotation": {"0.0": Z, "0.15": [-40, 50, 40], "0.28": [-95, 0, -20], "0.55": [-95, 0, -20], "0.7": Z}},
    "leftArm": {"rotation": {"0.0": Z, "0.15": [-60, 30, -10], "0.28": [-95, 0, 20], "0.55": [-95, 0, 20], "0.7": Z}},
    "body": {"rotation": {"0.0": Z, "0.15": [-6, 40, 0], "0.28": [14, -10, 0], "0.55": [12, -10, 0], "0.7": Z}},
    "rightLeg": {"rotation": {"0.0": Z, "0.28": [-40, 0, 0], "0.55": [-40, 0, 0], "0.7": Z}},
    "leftLeg": {"rotation": {"0.0": Z, "0.28": [30, 0, 0], "0.55": [30, 0, 0], "0.7": Z}}})

# Water Dragon: a long flowing seal chain with the body swaying, then both palms launch.
_r, _l = seal_chain(0.05, 6, 0.11)
A["animation.aegis.water_seals"] = anim(0.8, {
    "rightArm": {"rotation": {"0.0": Z, **_r, "0.8": [-80, -30, 0]}},
    "leftArm": {"rotation": {"0.0": Z, **_l, "0.8": [-80, 30, 0]}},
    "body": {"rotation": {"0.0": Z, "0.2": [6, 12, 0], "0.4": [6, -12, 0], "0.6": [6, 12, 0], "0.8": [4, 0, 0]}},
    "head": {"rotation": {"0.0": Z, "0.2": [12, 8, 0], "0.4": [12, -8, 0], "0.6": [12, 8, 0], "0.8": [8, 0, 0]}},
    "rightLeg": {"rotation": {"0.0": Z, "0.2": [0, 0, 10], "0.8": [0, 0, 10]}},
    "leftLeg": {"rotation": {"0.0": Z, "0.2": [0, 0, -10], "0.8": [0, 0, -10]}}})

# Summoning: bite the thumb, swing the hand down and slam it into the ground.
A["animation.aegis.summon_slam"] = anim(1.0, {
    "rightArm": {"rotation": {"0.0": Z, "0.15": [-150, -40, 0], "0.35": [-150, -40, 0], "0.45": [-175, 0, 10], "0.6": [-20, 0, 10], "0.9": [-20, 0, 10], "1.0": Z}},
    "leftArm": {"rotation": {"0.0": Z, "0.15": [-20, 0, -20], "0.6": [10, 0, -40], "0.9": [10, 0, -40], "1.0": Z}},
    "body": {"rotation": {"0.0": Z, "0.15": [10, 10, 0], "0.45": [-10, 0, 0], "0.6": [45, 0, 0], "0.9": [45, 0, 0], "1.0": Z}},
    "head": {"rotation": {"0.0": Z, "0.15": [20, -20, 0], "0.45": [-10, 0, 0], "0.6": [-30, 0, 0], "0.9": [-30, 0, 0], "1.0": Z}},
    "rightLeg": {"rotation": {"0.0": Z, "0.6": [-55, 0, 10], "0.9": [-55, 0, 10], "1.0": Z}},
    "leftLeg": {"rotation": {"0.0": Z, "0.6": [35, 0, -10], "0.9": [35, 0, -10], "1.0": Z}}})

# Dōjutsu activation: hand sweeps across the eyes, head snaps up.
A["animation.aegis.eye_activate"] = anim(0.6, {
    "rightArm": {"rotation": {"0.0": Z, "0.12": [-140, -55, 0], "0.3": [-140, -55, 0], "0.42": [-60, 20, 30], "0.6": Z}},
    "leftArm": {"rotation": {"0.0": Z, "0.3": [10, 0, -15], "0.6": Z}},
    "body": {"rotation": {"0.0": Z, "0.12": [10, 0, 0], "0.42": [-6, 0, 0], "0.6": Z}},
    "head": {"rotation": {"0.0": Z, "0.12": [25, 0, 0], "0.3": [25, 0, 0], "0.42": [-15, 0, 0], "0.6": Z}}})

# Almighty Push: arms wide, explode outward, chest forward.
A["animation.aegis.almighty_push"] = anim(0.8, {
    "rightArm": {"rotation": {"0.0": Z, "0.2": [-60, 0, 30], "0.32": [-60, 0, 110], "0.65": [-60, 0, 110], "0.8": Z}},
    "leftArm": {"rotation": {"0.0": Z, "0.2": [-60, 0, -30], "0.32": [-60, 0, -110], "0.65": [-60, 0, -110], "0.8": Z}},
    "body": {"rotation": {"0.0": Z, "0.2": [12, 0, 0], "0.32": [-14, 0, 0], "0.65": [-12, 0, 0], "0.8": Z}},
    "head": {"rotation": {"0.0": Z, "0.2": [15, 0, 0], "0.32": [-20, 0, 0], "0.65": [-20, 0, 0], "0.8": Z}},
    "rightLeg": {"rotation": {"0.0": Z, "0.32": [0, 0, 15], "0.65": [0, 0, 15], "0.8": Z}},
    "leftLeg": {"rotation": {"0.0": Z, "0.32": [0, 0, -15], "0.65": [0, 0, -15], "0.8": Z}}})

# Pull (Universal Pull / chains): reach out, grab, yank back.
A["animation.aegis.pull"] = anim(0.6, {
    "rightArm": {"rotation": {"0.0": Z, "0.12": [-100, -10, 0], "0.25": [-100, -10, 0], "0.38": [-30, 30, 30], "0.6": Z}},
    "leftArm": {"rotation": {"0.0": Z, "0.12": [-90, 10, 0], "0.25": [-90, 10, 0], "0.38": [-20, -20, -30], "0.6": Z}},
    "body": {"rotation": {"0.0": Z, "0.12": [12, 0, 0], "0.38": [-14, 0, 0], "0.6": Z}},
    "rightLeg": {"rotation": {"0.0": Z, "0.12": [-25, 0, 0], "0.38": [20, 0, 0], "0.6": Z}},
    "leftLeg": {"rotation": {"0.0": Z, "0.12": [20, 0, 0], "0.38": [-25, 0, 0], "0.6": Z}}})

# Nara: the rat seal, held low and steady while the shadow stretches.
A["animation.aegis.shadow_seal"] = anim(1.2, {
    "rightArm": {"rotation": {"0.0": Z, "0.12": [-70, -40, 0], "1.05": [-72, -40, 0], "1.2": Z}},
    "leftArm": {"rotation": {"0.0": Z, "0.12": [-70, 40, 0], "1.05": [-72, 40, 0], "1.2": Z}},
    "body": {"rotation": {"0.0": Z, "0.12": [20, 0, 0], "1.05": [20, 0, 0], "1.2": Z}},
    "head": {"rotation": {"0.0": Z, "0.12": [-10, 0, 0], "1.05": [-10, 0, 0], "1.2": Z}},
    "rightLeg": {"rotation": {"0.0": Z, "0.12": [-30, 0, 15], "1.05": [-30, 0, 15], "1.2": Z}},
    "leftLeg": {"rotation": {"0.0": Z, "0.12": [20, 0, -15], "1.05": [20, 0, -15], "1.2": Z}}})

# Yamanaka: hands form a diamond and aim at the target.
A["animation.aegis.mind_seal"] = anim(0.9, {
    "rightArm": {"rotation": {"0.0": Z, "0.15": [-95, -25, 0], "0.75": [-97, -25, 0], "0.9": Z}},
    "leftArm": {"rotation": {"0.0": Z, "0.15": [-95, 25, 0], "0.75": [-97, 25, 0], "0.9": Z}},
    "body": {"rotation": {"0.0": Z, "0.15": [6, 0, 0], "0.75": [6, 0, 0], "0.9": Z}},
    "head": {"rotation": {"0.0": Z, "0.15": [-5, 0, 0], "0.75": [-5, 0, 0], "0.9": Z}}})

# Akimichi Expansion: flex and swell.
A["animation.aegis.expansion"] = anim(0.9, {
    "rightArm": {"rotation": {"0.0": Z, "0.2": [-30, 0, 70], "0.35": [-120, 0, 60], "0.75": [-120, 0, 60], "0.9": Z}},
    "leftArm": {"rotation": {"0.0": Z, "0.2": [-30, 0, -70], "0.35": [-120, 0, -60], "0.75": [-120, 0, -60], "0.9": Z}},
    "body": {"rotation": {"0.0": Z, "0.2": [15, 0, 0], "0.35": [-10, 0, 0], "0.75": [-10, 0, 0], "0.9": Z}},
    "head": {"rotation": {"0.0": Z, "0.35": [-25, 0, 0], "0.75": [-25, 0, 0], "0.9": Z}},
    "rightLeg": {"rotation": {"0.0": Z, "0.35": [0, 0, 18], "0.75": [0, 0, 18], "0.9": Z}},
    "leftLeg": {"rotation": {"0.0": Z, "0.35": [0, 0, -18], "0.75": [0, 0, -18], "0.9": Z}}})

# Aburame: arms thrown open, sleeves release the swarm.
A["animation.aegis.insect_release"] = anim(0.8, {
    "rightArm": {"rotation": {"0.0": Z, "0.15": [-40, -30, -20], "0.3": [-80, 30, 60], "0.65": [-80, 30, 60], "0.8": Z}},
    "leftArm": {"rotation": {"0.0": Z, "0.15": [-40, 30, 20], "0.3": [-80, -30, -60], "0.65": [-80, -30, -60], "0.8": Z}},
    "body": {"rotation": {"0.0": Z, "0.15": [10, 0, 0], "0.3": [-6, 0, 0], "0.65": [-6, 0, 0], "0.8": Z}}})

# Inuzuka Fang Over Fang: dive forward into a drill.
A["animation.aegis.fang_drill"] = anim(0.7, {
    "rightArm": {"rotation": {"0.0": Z, "0.1": [-160, 0, 10], "0.6": [-160, 0, 10], "0.7": Z}},
    "leftArm": {"rotation": {"0.0": Z, "0.1": [-160, 0, -10], "0.6": [-160, 0, -10], "0.7": Z}},
    "body": {"rotation": {"0.0": Z, "0.1": [40, 0, 0], "0.6": [40, 720, 0], "0.7": [0, 720, 0]}},
    "rightLeg": {"rotation": {"0.0": Z, "0.1": [40, 0, 0], "0.6": [40, 0, 0], "0.7": Z}},
    "leftLeg": {"rotation": {"0.0": Z, "0.1": [40, 0, 0], "0.6": [40, 0, 0], "0.7": Z}}})

# Sealing chains / Four Symbols: hands thrust forward, fingers spread, then twist the seal.
A["animation.aegis.chains_cast"] = anim(0.9, {
    "rightArm": {"rotation": {"0.0": Z, "0.15": [-95, -15, -20], "0.45": [-95, -15, -20], "0.6": [-95, 30, 20], "0.8": [-95, 30, 20], "0.9": Z}},
    "leftArm": {"rotation": {"0.0": Z, "0.15": [-95, 15, 20], "0.45": [-95, 15, 20], "0.6": [-95, -30, -20], "0.8": [-95, -30, -20], "0.9": Z}},
    "body": {"rotation": {"0.0": Z, "0.15": [10, 0, 0], "0.6": [6, 15, 0], "0.8": [6, 15, 0], "0.9": Z}},
    "rightLeg": {"rotation": {"0.0": Z, "0.15": [-25, 0, 8], "0.8": [-25, 0, 8], "0.9": Z}},
    "leftLeg": {"rotation": {"0.0": Z, "0.15": [20, 0, -8], "0.8": [20, 0, -8], "0.9": Z}}})

# --- Swords ---------------------------------------------------------------------
A["animation.aegis.sword_slash"] = anim(0.55, {
    "rightArm": {"rotation": {"0.0": [-40, 0, 0], "0.1": [-110, 80, 30], "0.22": [-95, -85, -15], "0.34": [-80, -100, -15], "0.55": Z}},
    "leftArm": {"rotation": {"0.0": Z, "0.1": [-30, 0, -30], "0.22": [20, 0, -35], "0.55": Z}},
    "body": {"rotation": {"0.0": Z, "0.1": [0, 35, 0], "0.22": [6, -40, 0], "0.34": [6, -45, 0], "0.55": Z}},
    "rightLeg": {"rotation": {"0.0": Z, "0.22": [-25, 0, 5], "0.4": [-25, 0, 5], "0.55": Z}},
    "leftLeg": {"rotation": {"0.0": Z, "0.22": [20, 0, -5], "0.4": [20, 0, -5], "0.55": Z}}})
A["animation.aegis.sword_overhead"] = anim(0.65, {
    "rightArm": {"rotation": {"0.0": [-40, 0, 0], "0.2": [-185, 10, 0], "0.32": [-185, 10, 0], "0.4": [-30, 0, 0], "0.65": Z}},
    "leftArm": {"rotation": {"0.0": Z, "0.2": [-170, -15, 0], "0.32": [-170, -15, 0], "0.4": [-35, 25, 0], "0.65": Z}},
    "body": {"rotation": {"0.0": Z, "0.2": [-12, 0, 0], "0.4": [22, 0, 0], "0.55": [20, 0, 0], "0.65": Z}},
    "head": {"rotation": {"0.0": Z, "0.2": [10, 0, 0], "0.4": [-20, 0, 0], "0.65": Z}},
    "rightLeg": {"rotation": {"0.0": Z, "0.4": [-35, 0, 5], "0.55": [-35, 0, 5], "0.65": Z}},
    "leftLeg": {"rotation": {"0.0": Z, "0.4": [25, 0, -5], "0.55": [25, 0, -5], "0.65": Z}}})
A["animation.aegis.sword_thrust"] = anim(0.5, {
    "rightArm": {"rotation": {"0.0": [-40, 0, 0], "0.1": [-60, -30, 0], "0.18": [-98, 5, 0], "0.36": [-96, 5, 0], "0.5": Z},
                 "position": {"0.0": Z, "0.1": [0, 0, 3], "0.18": [0, 0, -4], "0.36": [0, 0, -4], "0.5": Z}},
    "leftArm": {"rotation": {"0.0": Z, "0.18": [30, 0, -25], "0.5": Z}},
    "body": {"rotation": {"0.0": Z, "0.1": [0, 30, 0], "0.18": [12, -25, 0], "0.36": [12, -25, 0], "0.5": Z}},
    "rightLeg": {"rotation": {"0.0": Z, "0.18": [-40, 0, 0], "0.36": [-40, 0, 0], "0.5": Z}},
    "leftLeg": {"rotation": {"0.0": Z, "0.18": [30, 0, 0], "0.36": [30, 0, 0], "0.5": Z}}})
A["animation.aegis.sword_spin"] = anim(0.6, {
    "rightArm": {"rotation": {"0.0": [-40, 0, 0], "0.08": [-90, 0, -70], "0.5": [-90, 0, -70], "0.6": Z}},
    "leftArm": {"rotation": {"0.0": Z, "0.08": [-20, 0, 70], "0.5": [-20, 0, 70], "0.6": Z}},
    "body": {"rotation": {"0.0": Z, "0.08": [10, 30, 0], "0.5": [10, -390, 0], "0.6": [0, -360, 0]}},
    "rightLeg": {"rotation": {"0.0": Z, "0.08": [-20, 0, 15], "0.5": [-20, 0, 15], "0.6": Z}},
    "leftLeg": {"rotation": {"0.0": Z, "0.08": [20, 0, -15], "0.5": [20, 0, -15], "0.6": Z}}})
A["animation.aegis.sword_raise"] = anim(0.9, {
    "rightArm": {"rotation": {"0.0": [-40, 0, 0], "0.18": [-185, 0, 0], "0.6": [-185, 0, 0], "0.68": [-70, 0, 0], "0.9": Z}},
    "leftArm": {"rotation": {"0.0": Z, "0.18": [-20, 0, -40], "0.6": [-20, 0, -40], "0.9": Z}},
    "body": {"rotation": {"0.0": Z, "0.18": [-12, 0, 0], "0.68": [16, 0, 0], "0.9": Z}},
    "head": {"rotation": {"0.0": Z, "0.18": [-30, 0, 0], "0.6": [-30, 0, 0], "0.9": Z}},
    "rightLeg": {"rotation": {"0.0": Z, "0.18": [0, 0, 10], "0.6": [0, 0, 10], "0.9": Z}},
    "leftLeg": {"rotation": {"0.0": Z, "0.18": [0, 0, -10], "0.6": [0, 0, -10], "0.9": Z}}})

d = json.loads(P.read_text())
d["animations"].update(A)
P.write_text(json.dumps(d, indent=2) + "\n")
print("Player animations:", len(A))
