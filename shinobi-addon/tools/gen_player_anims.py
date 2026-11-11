#!/usr/bin/env python3
"""Player jutsu / sword animations (played from script with playAnimation).
Each move has anticipation → action → follow-through, and uses the legs for stances.
First-person arms are left alone (v.is_first_person) so the camera view isn't twisted.
Run from the shinobi-addon folder:  python3 tools/gen_player_anims.py
"""
import json
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
