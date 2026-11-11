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
# Bars: (name, width, height, slant, fill top colour, fill bottom colour)
# ---------------------------------------------------------------------------
BARS = {
    "hp": dict(w=150, h=13, s=6, top=(240, 95, 90), bot=(170, 35, 40)),
    "ck": dict(w=132, h=12, s=6, top=(120, 210, 255), bot=(30, 100, 210)),
    "xp": dict(w=112, h=10, s=5, top=(245, 225, 100), bot=(195, 160, 30)),
}


def left_x(y, h, s):
    """x of the parallelogram's left edge on row y (top leans right)."""
    return round(s * (h - 1 - y) / (h - 1))


def bar_textures(name, b):
    w, h, s = b["w"], b["h"], b["s"]
    frame = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    bg = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    for y in range(h):
        lx = left_x(y, h, s)
        rx = lx + (w - 1 - s)  # parallelogram: the right end leans the same way
        for x in range(lx, rx + 1):
            edge = y < 2 or y >= h - 2 or x < lx + 2 or x > rx - 2
            if edge:
                frame.putpixel((x, y), (10, 10, 14, 255))
            else:
                shade = 70 if y == 2 else 48 if y == h - 3 else 58
                bg.putpixel((x, y), (shade, shade, shade + 6, 235))
    frame.save(TEX / f"{name}_frame.png")
    bg.save(TEX / f"{name}_bg.png")
    # fill piece: slanted left cap, stretched to the right (nineslice keeps the cap crisp)
    fh = h - 4
    cap = max(2, round(s * fh / h))
    fill = Image.new("RGBA", (cap + 6, fh), (0, 0, 0, 0))
    for y in range(fh):
        t = y / max(1, fh - 1)
        col = tuple(int(b["top"][i] + (b["bot"][i] - b["top"][i]) * t) for i in range(3))
        if y == 0:
            col = tuple(min(255, c + 45) for c in col)
        start = round(cap * (fh - 1 - y) / max(1, fh - 1))
        for x in range(start, cap + 6):
            fill.putpixel((x, y), col + (255,))
    fill.save(TEX / f"{name}_fill.png")
    (TEX / f"{name}_fill.json").write_text(json.dumps({"nineslice_size": [cap, 0, 1, 0], "base_size": [cap + 6, fh]}) + "\n")
    return cap


def img(tex, size, offset, layer, bindings=None):
    d = {"type": "image", "texture": tex, "size": size, "anchor_from": "top_left", "anchor_to": "top_left", "offset": offset, "layer": layer}
    if bindings:
        d["bindings"] = bindings
    return d


def text(expr, glob, offset, color=(1, 1, 1), layer=30):
    return {"type": "label", "anchor_from": "top_left", "anchor_to": "top_left", "offset": offset, "text": "#text",
            "color": list(color), "shadow": True, "layer": layer, "localize": False, "bindings": [glob, view(expr, "#text")]}


def bar(name, y, fill_check, glob, label_expr):
    b = BARS[name]
    w, h, s = b["w"], b["h"], b["s"]
    cap = bar_textures(name, b)
    max_w = w - 4 - s
    controls = [{f"{name}_bg": img(f"textures/ui/aegis/{name}_bg", [w, h], [0, y], 10)}]
    for k in range(1, BUCKETS + 1):
        fw = max(cap + 1, round(max_w * k / BUCKETS))
        controls.append({f"{name}_{k}": img(f"textures/ui/aegis/{name}_fill", [fw, h - 4], [2, y + 2], 12,
                                            [glob, view(fill_check(k), "#visible")])})
    controls.append({f"{name}_frame": img(f"textures/ui/aegis/{name}_frame", [w, h], [0, y], 14)})
    controls.append({f"{name}_text": text(label_expr, glob, [s + 6, y + (h - 9) // 2 + 1])})
    return controls


TEX.mkdir(parents=True, exist_ok=True)
IS_OURS = f"(('%.3s' * {S}) = 'AEG')"
hud_controls = [
    *bar("hp", 0, lambda k: f"(('%.5s' * {S}) = 'AEG{code(k)}')", G_T, f"('HP ' + {field(5, 9, S)})"),
    *bar("ck", 16, lambda k: f"(('%.5s' * {SUB}) = 'AEC{code(k)}')", G_S, f"('CK ' + {field(7, 9, SUB)})"),
    {"lvl_text": text(f"('Level ' + {field(14, 3, S)})", G_T, [2, 31])},
    *bar("xp", 42, lambda k: f"({field(5, 2, SUB)} = '{code(k)}')", G_S, f"({field(16, 13, SUB)})"),
    {"pts_text": text(f"('Points ' + {field(17, 4, S)})", G_T, [2, 55], (1, 0.92, 0.55))},
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
                            "offset": [6, 6], "size": [170, 70], "controls": hud_controls}},
            {"aegis_title": {
                "type": "label", "anchor_from": "center", "anchor_to": "center", "offset": [0, -45],
                "text": "#text", "font_size": "extra_large", "shadow": True, "text_alignment": "center",
                "layer": 30, "localize": False, "color": [1, 1, 1],
                "bindings": [G_T, view(f"({S} - ('%.21s' * {S}))", "#text")]}},
        ]},
    "root_panel": {"modifications": [
        {"array_name": "controls", "operation": "insert_back", "value": [{"aegis_hud@hud.aegis_hud": {}}]}]},
}
out = RP / "ui" / "hud_screen.json"
out.parent.mkdir(parents=True, exist_ok=True)
out.write_text(json.dumps(hud, indent=2, ensure_ascii=False) + "\n")
for old in ("bar_bg.png", "hp_fill.png", "chakra_fill.png"):
    p = TEX / old
    if p.exists() and old != "hp_fill.png":
        p.unlink()
print("HUD generated:", out.relative_to(ROOT))
