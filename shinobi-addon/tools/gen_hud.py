#!/usr/bin/env python3
"""Generates the custom HUD (resource_pack/ui/hud_screen.json) and its textures.

Style: slanted bars with thick black outlines and the value written inside —
  HP bar · Chakra bar · "Level N" · XP bar · "Points N"
The script side (behavior_pack/scripts/hud.js) encodes the data into the title / subtitle text;
this UI reads it through #hud_title_text_string / #hud_subtitle_text_string.
Run from the shinobi-addon folder:  python3 tools/gen_hud.py
"""
import json
from pathlib import Path
from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
RP = ROOT / "resource_pack"
TEX = RP / "textures" / "ui" / "aegis"
BUCKETS = 50  # must match hud.js

S = "#hud_title_text_string"
SUB = "#hud_subtitle_text_string"
G_T = {"binding_name": S, "binding_type": "global"}
G_S = {"binding_name": SUB, "binding_type": "global"}


def code(b):
    """Fill level 0..50 -> two lowercase letters (never parsed as a number by JSON UI)."""
    return chr(97 + b // 26) + chr(97 + b % 26)


def field(start, length, src):
    rest = f"({src} - ('%.{start}s' * {src}))" if start else src
    return f"('%.{length}s' * {rest})"


def view(expr, target):
    return {"binding_type": "view", "source_property_name": expr, "target_property_name": target}


# ---------------------------------------------------------------------------
# Bars. Each bar has a black "tab" at its left end: the label's leading code characters are drawn
# in black on top of it (invisible), and the visible text continues in white over the bar.
# ---------------------------------------------------------------------------
LH = 10      # label line height (subtitle lines 2-4 land on the Level / XP / Points rows)
TEXT_X = 5   # labels start here; Minecraft's font is ~6px per character
# cap = black tab width: must cover the hidden code prefix (title 7 chars ≈ 42px, subtitle 5 chars ≈ 30px)
BARS = {
    "hp": dict(w=184, h=13, s=6, cap=50, top=(240, 95, 90), bot=(170, 35, 40)),
    "ck": dict(w=160, h=12, s=6, cap=38, top=(120, 210, 255), bot=(30, 100, 210)),
    "xp": dict(w=130, h=11, s=5, cap=3, top=(245, 225, 100), bot=(195, 160, 30)),
}


def left_x(y, h, s):
    """x of the parallelogram's left edge on row y (top leans right)."""
    return round(s * (h - 1 - y) / (h - 1))


def bar_textures(name, b):
    w, h, s, CAP = b["w"], b["h"], b["s"], b["cap"]
    frame = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    bg = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    for y in range(h):
        lx = left_x(y, h, s)
        rx = lx + (w - 1 - s)
        for x in range(lx, rx + 1):
            edge = y < 2 or y >= h - 2 or x < lx + 2 or x > rx - 2
            tab = x < lx + CAP
            if edge or tab:
                frame.putpixel((x, y), (10, 10, 14, 255))
            else:
                shade = 70 if y == 2 else 48 if y == h - 3 else 58
                bg.putpixel((x, y), (shade, shade, shade + 6, 235))
    frame.save(TEX / f"{name}_frame.png")
    bg.save(TEX / f"{name}_bg.png")
    fh = h - 4
    fill = Image.new("RGBA", (8, fh), (0, 0, 0, 0))
    for y in range(fh):
        t = y / max(1, fh - 1)
        col = tuple(int(b["top"][i] + (b["bot"][i] - b["top"][i]) * t) for i in range(3))
        if y == 0:
            col = tuple(min(255, c + 45) for c in col)
        for x in range(8):
            fill.putpixel((x, y), col + (255,))
    fill.save(TEX / f"{name}_fill.png")
    j = TEX / f"{name}_fill.json"
    if j.exists():
        j.unlink()


def img(tex, size, offset, layer, bindings=None):
    d = {"type": "image", "texture": tex, "size": size, "anchor_from": "top_left", "anchor_to": "top_left", "offset": offset, "layer": layer}
    if bindings:
        d["bindings"] = bindings
    return d


def whole_label(glob, src, offset):
    """Shows the whole title/subtitle string — no string operations at all."""
    return {"type": "label", "anchor_from": "top_left", "anchor_to": "top_left", "offset": offset, "text": "#text",
            "color": [0, 0, 0], "shadow": True, "layer": 30, "localize": False,
            "bindings": [{"binding_name": src, "binding_name_override": "#text", "binding_type": "global"}]}


def bar(name, y, fill_check, glob):
    b = BARS[name]
    w, h, s, cap = b["w"], b["h"], b["s"], b["cap"]
    bar_textures(name, b)
    x0 = cap + 2
    max_w = w - cap - 4 - s
    controls = [{f"{name}_bg": img(f"textures/ui/aegis/{name}_bg", [w, h], [0, y], 10)}]
    for k in range(1, BUCKETS + 1):
        fw = max(1, round(max_w * k / BUCKETS))
        controls.append({f"{name}_{k}": img(f"textures/ui/aegis/{name}_fill", [fw, h - 4], [x0, y + 2], 12,
                                            [glob, view(fill_check(k), "#visible")])})
    controls.append({f"{name}_frame": img(f"textures/ui/aegis/{name}_frame", [w, h], [0, y], 14)})
    return controls


TEX.mkdir(parents=True, exist_ok=True)
IS_OURS = f"(('%.3s' * {S}) = 'AEG')"
HP_Y, CK_Y = 0, 16
XP_Y = CK_Y + 2 * LH
hp_codes = [code(i) for i in range(BUCKETS + 1)]
hud_controls = [
    # HP fill: first 5 characters of the title = "AEG" + HP code
    *bar("hp", HP_Y, lambda k: f"(('%.5s' * {S}) = 'AEG{code(k)}')", G_T),
    # chakra fill: first 5 characters of the subtitle = "AEC" + chakra code
    *bar("ck", CK_Y, lambda k: f"(('%.5s' * {SUB}) = 'AEC{code(k)}')", G_S),
    # XP fill: first 7 characters of the title = "AEG" + (any HP code) + XP code
    *bar("xp", XP_Y, lambda k: "(" + " or ".join(f"(('%.7s' * {S}) = 'AEG{h}{code(k)}')" for h in hp_codes) + ")", G_T),
    {"hp_text": whole_label(G_T, S, [TEXT_X, HP_Y + 3])},
    {"ck_text": whole_label(G_S, SUB, [TEXT_X, CK_Y + 2])},
]

hud = {
    "namespace": "hud",
    # Hide the vanilla hearts (replaced by the HP bar).
    "heart_renderer": {"ignored": True},
    # Hide the vanilla title whenever it carries our HUD data.
    "hud_title_text": {"bindings": [G_T, view(f"(not {IS_OURS})", "#visible")]},
    "aegis_hud": {
        "type": "panel", "size": ["100%", "100%"], "layer": 5,
        "bindings": [G_T, view(IS_OURS, "#visible")],
        "controls": [
            {"aegis_bars": {"type": "panel", "anchor_from": "top_left", "anchor_to": "top_left",
                            "offset": [6, 6], "size": [200, 80], "controls": hud_controls}},
        ]},
    "root_panel": {"modifications": [
        {"array_name": "controls", "operation": "insert_back", "value": [{"aegis_hud@hud.aegis_hud": {}}]}]},
}
out = RP / "ui" / "hud_screen.json"
out.parent.mkdir(parents=True, exist_ok=True)
out.write_text(json.dumps(hud, indent=2, ensure_ascii=False) + "\n")
print("HUD generated:", out.relative_to(ROOT), f"({out.stat().st_size // 1024} KB)")
