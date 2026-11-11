#!/usr/bin/env python3
"""Generates the custom HUD (resource_pack/ui/hud_screen.json) and its bar textures.

The script side (behavior_pack/scripts/hud.js) encodes HP, chakra, level and the current
big title into the title text; this UI reads it through #hud_title_text_string.
Run from the shinobi-addon folder:  python3 tools/gen_hud.py
"""
import json
from pathlib import Path
from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
RP = ROOT / "resource_pack"
BUCKETS = 50          # must match hud.js
FILL_W, FILL_H = 2, 7  # px per bucket, fill height -> 100 x 7 fill
BAR_W, BAR_H = BUCKETS * FILL_W + 4, FILL_H + 4

S = "#hud_title_text_string"
GLOBAL = {"binding_name": S, "binding_type": "global"}


def field(start, length):
    """JSON UI expression: `length` characters of the title string starting at `start`."""
    rest = f"({S} - ('%.{start}s' * {S}))" if start else S
    return f"('%.{length}s' * {rest})"


def view(expr, target):
    return {"binding_type": "view", "source_property_name": expr, "target_property_name": target}


IS_OURS = f"(('%.3s' * {S}) = 'AEG')"


def label(text_expr, offset, color, extra=None):
    d = {"type": "label", "anchor_from": "top_left", "anchor_to": "top_left", "offset": offset,
         "text": "#text", "color": color, "shadow": True, "layer": 20, "localize": False,
         "bindings": [GLOBAL, view(text_expr, "#text")]}
    if extra:
        d.update(extra)
    return d


def bar(name, y, start, fill_tex, text_start, icon_text, icon_color):
    controls = [
        {f"{name}_bg": {"type": "image", "texture": "textures/ui/aegis/bar_bg", "size": [BAR_W, BAR_H],
                         "anchor_from": "top_left", "anchor_to": "top_left", "offset": [14, y], "layer": 10}},
        {f"{name}_icon": {"type": "label", "text": icon_text, "color": icon_color, "shadow": True, "layer": 20,
                           "anchor_from": "top_left", "anchor_to": "top_left", "offset": [0, y + 2]}},
    ]
    for k in range(1, BUCKETS + 1):
        controls.append({f"{name}_{k}": {
            "type": "image", "texture": fill_tex, "size": [k * FILL_W, FILL_H],
            "anchor_from": "top_left", "anchor_to": "top_left", "offset": [16, y + 2], "layer": 12,
            "bindings": [GLOBAL, view(f"({field(start, 2)} = '{k:02d}')", "#visible")]}})
    controls.append({f"{name}_text": label(f"({field(text_start, 9)})", [BAR_W + 18, y + 2], [1, 1, 1])})
    return controls


hud = {
    "namespace": "hud",

    # Hide the vanilla hearts (replaced by the HP bar).
    "heart_renderer": {"ignored": True},

    # Hide the vanilla title whenever it carries our HUD data.
    "hud_title_text": {"bindings": [GLOBAL, view(f"(not {IS_OURS})", "#visible")]},

    "aegis_hud": {
        "type": "panel",
        "size": ["100%", "100%"],
        "layer": 5,
        "bindings": [GLOBAL, view(IS_OURS, "#visible")],
        "controls": [
            {"aegis_bars": {
                "type": "panel", "anchor_from": "top_left", "anchor_to": "top_left",
                "offset": [4, 4], "size": [BAR_W + 80, 40],
                "controls": [
                    {"aegis_level": label(f"('Lv ' + {field(25, 3)})", [0, 0], [1, 0.85, 0.3])},
                    *bar("hp", 11, 3, "textures/ui/aegis/hp_fill", 7, "HP", [1, 0.35, 0.35]),
                    *bar("ck", 24, 5, "textures/ui/aegis/chakra_fill", 16, "CK", [0.45, 0.8, 1]),
                ]}},
            {"aegis_title": {
                "type": "label", "anchor_from": "center", "anchor_to": "center", "offset": [0, -45],
                "text": "#text", "font_size": "extra_large", "shadow": True, "text_alignment": "center",
                "layer": 30, "localize": False, "color": [1, 1, 1],
                "bindings": [GLOBAL, view(f"({S} - ('%.28s' * {S}))", "#text")]}},
        ]},

    "root_panel": {"modifications": [
        {"array_name": "controls", "operation": "insert_back", "value": [{"aegis_hud@hud.aegis_hud": {}}]}]},
}

out = RP / "ui" / "hud_screen.json"
out.parent.mkdir(parents=True, exist_ok=True)
out.write_text(json.dumps(hud, indent=2, ensure_ascii=False) + "\n")

# --- textures ---------------------------------------------------------------------
tex = RP / "textures" / "ui" / "aegis"
tex.mkdir(parents=True, exist_ok=True)

bg = Image.new("RGBA", (BAR_W, BAR_H), (0, 0, 0, 0))
for x in range(BAR_W):
    for y in range(BAR_H):
        edge = x in (0, BAR_W - 1) or y in (0, BAR_H - 1)
        inner = x in (1, BAR_W - 2) or y in (1, BAR_H - 2)
        bg.putpixel((x, y), (20, 20, 25, 235) if edge else (70, 70, 80, 220) if inner else (30, 30, 38, 200))
bg.save(tex / "bar_bg.png")


def fill(path, top, bottom, shine):
    img = Image.new("RGBA", (16, FILL_H), (0, 0, 0, 0))
    for y in range(FILL_H):
        t = y / (FILL_H - 1)
        col = tuple(int(top[i] + (bottom[i] - top[i]) * t) for i in range(3))
        for x in range(16):
            img.putpixel((x, y), (shine if y == 1 else col) + (255,))
    img.save(path)


fill(tex / "hp_fill.png", (240, 70, 70), (150, 20, 25), (255, 150, 150))
fill(tex / "chakra_fill.png", (90, 190, 255), (30, 90, 200), (190, 235, 255))
print("HUD generated:", out.relative_to(ROOT))
