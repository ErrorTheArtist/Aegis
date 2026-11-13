#!/usr/bin/env python3
"""Offline previews for Tailed Beast Mode: the player wearing each Jinchūriki cloak, and the transformation storyboard.

  python3 tools/jin_preview.py sheet -o cloaks.png                 # every beast, V1 and mastered, front and back
  python3 tools/jin_preview.py sheet -o kurama.png --beast kurama --form 2.6   # mid-transformation (tails sprouting)
  python3 tools/jin_preview.py story -o story.png --beast kurama    # the transformation cinematic, shot by shot
  python3 tools/jin_preview.py story -o frame.png --beast kurama --tick 74

Uses the renderer in tools/cine_preview.py; the cloak follows the player's bones the way an attachable does
(the player's animation on root/waist/body/head/arms/legs, the cloak's own form + sway animations on top).
"""
import argparse
import json
import math
import sys
from pathlib import Path

from PIL import Image, ImageDraw

sys.path.insert(0, str(Path(__file__).resolve().parent))
import anim_preview as AP  # noqa: E402
import cine_preview as CP  # noqa: E402

ROOT = CP.ROOT
RP = CP.RP
PLAYER_BONES = {"root", "waist", "body", "head", "rightArm", "leftArm", "rightLeg", "leftLeg"}
BEASTS = ["shukaku", "matatabi", "isobu", "son_goku", "kokuo", "saiken", "chomei", "gyuki", "kurama"]


def anims():
    out = {}
    for f in ("aegis.animation.json", "jinchuriki.animation.json"):
        out.update(json.loads((RP / "animations" / f).read_text())["animations"])
    return out


def combined(model, layers):
    """A constant 'animation' for `model`: per bone, the sum of every layer's rotation/position, product of scales.
    layers: [(anim, t, bone filter or None)]."""
    bones = {}
    for b in model.bones:
        name = b["name"]
        rot, pos, sc, any_ = [0.0, 0.0, 0.0], [0.0, 0.0, 0.0], [1.0, 1.0, 1.0], False
        for anim, t, only in layers:
            if anim is None or (only is not None and name not in only):
                continue
            ch = anim.get("bones", {}).get(name)
            if not ch:
                continue
            length = anim.get("animation_length", 0)
            tt = t
            if anim.get("loop") is True and length:
                tt = t % length
            elif length:
                tt = min(t, length)
            any_ = True
            r = AP.sample(ch.get("rotation"), tt)
            p = AP.sample(ch.get("position"), tt)
            s = AP.sample(ch.get("scale"), tt) if ch.get("scale") is not None else (1, 1, 1)
            rot = [rot[i] + r[i] for i in range(3)]
            pos = [pos[i] + p[i] for i in range(3)]
            sc = [sc[i] * s[i] for i in range(3)]
        if any_:
            bones[name] = {"rotation": rot, "position": pos, "scale": sc}
    return {"bones": bones}


def cloak_models(bid, gold):
    sfx = "_m" if gold else ""
    arm = RP / "textures" / "models" / "armor"
    base = CP.load_geo(RP / "models" / "entity" / f"jin_{bid}{sfx}.geo.json", arm / f"jin_{bid}{sfx}.png")
    glow = CP.load_geo(RP / "models" / "entity" / f"jin_{bid}_glow.geo.json", arm / f"jin_glow_{'gold' if gold else bid}.png")
    base.scale = glow.scale = 0.9375
    return base, glow


def glow_quads(glow, anim, place):
    """The additive layer, approximated: bright texels drawn as faint translucent quads."""
    out = []
    for pts, col, face, a in CP.model_quads(glow, anim, 0, place):
        lum = max(col)
        if lum < 70:
            continue
        out.append((pts, col, face, int(min(120, lum * 0.45))))
    return out


def scene(A, player, bid, gold, t_player, t_form, t_sway, panim, place):
    base, glow = cloak_models(bid, gold)
    sfx = "_m" if gold else ""
    pa = A.get(panim) if panim else None
    q = CP.model_quads(player, combined(player, [(pa, t_player, None)]), 0, place)
    layers = [(pa, t_player, PLAYER_BONES), (A[f"animation.aegis.jin_{bid}{sfx}.form"], t_form, None),
              (A[f"animation.aegis.jin_{bid}{sfx}.sway"], t_sway, None)]
    q += CP.model_quads(base, combined(base, layers), 0, place)
    q += glow_quads(glow, combined(glow, layers), place)
    return q


def sheet(args):
    A = anims()
    player = CP.humanoid(CP.NPC / f"{args.skin}.png")
    beasts = [args.beast] if args.beast else BEASTS
    forms = [False, True] if not args.only else [args.only == "mastered"]
    views = [(2.6, 2.0, 1.55, 1.15), (-2.9, -1.4, 2.0, 1.2)]   # (f, r, h, look h): front-right, back-left
    if args.view:
        views = [tuple(float(x) for x in v.split(",")) for v in args.view.split(";")]
    cw, ch = 240, 260
    cols = len(forms) * len(views)
    img = Image.new("RGB", (cw * cols, ch * len(beasts)), (20, 18, 24))
    d = ImageDraw.Draw(img)
    for row, bid in enumerate(beasts):
        for fi, gold in enumerate(forms):
            for vi, (f, r, h, lh) in enumerate(views):
                place = CP.placer(0, 0, 0)
                quads = scene(A, player, bid, gold, args.pose_t, args.form, args.sway, args.pose, place)
                cam = CP.Camera(CP.scene_pt(f, r, h), CP.scene_pt(0, 0, lh), cw, ch, fov=62)
                frame = CP.render(cam, [[q for q in quads]], sky=((26, 22, 34), (52, 46, 58)))
                img.paste(frame, ((fi * len(views) + vi) * cw, row * ch))
                d.text(((fi * len(views) + vi) * cw + 4, row * ch + 3), f"{bid} {'mastered' if gold else 'V1'}", fill=(240, 240, 240))
    img.save(args.out)
    print("wrote", args.out)


# ---------------------------------------------------------------------------
# The transformation storyboard (reads behavior_pack/scripts/jin_shots.js)
# ---------------------------------------------------------------------------
def story_frame(E, A, player, bid, gold, tick, w=480, h=270):
    key = "MASTERED" if gold else "FERAL"
    shots = E[key]["SHOTS"]
    pos, look, name = CP.camera_at(shots, tick)
    t = tick / 20
    lag = E["EQUIP_LAG"] / 20      # the cloak goes on a moment before the cinematic starts
    place = CP.placer(0, 0, 0)
    quads = scene(A, player, bid, gold, t, t + lag, t + lag, E[key]["ANIM"], place)
    img = CP.render(CP.Camera(pos, look, w, h), [quads], sky=((30, 10, 12), (70, 30, 26)) if not gold else ((40, 30, 8), (90, 70, 30)))
    d = ImageDraw.Draw(img)
    d.rectangle([0, 0, w, 13], fill=(0, 0, 0))
    d.text((4, 1), f"t={tick:3d} ({t:.2f}s)  {name}", fill=(235, 235, 235))
    return img


def story(args):
    E = CP.load_shots("jin_shots.js")
    A = anims()
    player = CP.humanoid(CP.NPC / f"{args.skin}.png")
    gold = args.only == "mastered"
    if args.tick is not None:
        story_frame(E, A, player, args.beast or "kurama", gold, args.tick, 960, 540).save(args.out)
        print("wrote", args.out)
        return
    key = "MASTERED" if gold else "FERAL"
    ticks = args.ticks or sorted({s["t"] for s in E[key]["SHOTS"] if s.get("name")} | set(E[key]["BEATS"]))
    cols = 4
    rows = math.ceil(len(ticks) / cols)
    img = Image.new("RGB", (cols * 320, rows * 180))
    for i, tk in enumerate(ticks):
        img.paste(story_frame(E, A, player, args.beast or "kurama", gold, tk, 320, 180), ((i % cols) * 320, (i // cols) * 180))
    img.save(args.out)
    print("wrote", args.out, len(ticks), "frames")


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("mode", choices=["sheet", "story"])
    ap.add_argument("-o", "--out", required=True)
    ap.add_argument("--beast")
    ap.add_argument("--only", choices=["v1", "mastered"])
    ap.add_argument("--skin", default="naruto")
    ap.add_argument("--form", type=float, default=9.0, help="seconds since the cloak went on (9 = fully formed)")
    ap.add_argument("--sway", type=float, default=0.4)
    ap.add_argument("--pose", default=None, help="a player animation to pose with")
    ap.add_argument("--pose-t", dest="pose_t", type=float, default=0.0)
    ap.add_argument("--view", help='camera views "f,r,h,lookh;f,r,h,lookh"')
    ap.add_argument("--tick", type=int)
    ap.add_argument("--ticks", type=lambda s: [int(x) for x in s.split(",")])
    args = ap.parse_args()
    (sheet if args.mode == "sheet" else story)(args)


if __name__ == "__main__":
    main()
