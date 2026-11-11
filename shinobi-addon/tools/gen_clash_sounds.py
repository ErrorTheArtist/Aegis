#!/usr/bin/env python3
"""Synthesized sound effects for the Jutsu Clash cinematic (numpy + scipy, encoded with ffmpeg).
Adds aegis.clash_* entries to sound_definitions.json without touching the others.
Run from the shinobi-addon folder:  python3 tools/gen_clash_sounds.py
"""
import json
import subprocess
import tempfile
from pathlib import Path

import numpy as np
from scipy.io import wavfile
from scipy.signal import butter, sosfilt

ROOT = Path(__file__).resolve().parent.parent
SND = ROOT / "resource_pack" / "sounds" / "aegis"
SR = 44100
rng = np.random.default_rng(99)


def T(sec):
    return np.arange(int(SR * sec)) / SR


def noise(sec):
    return rng.standard_normal(int(SR * sec))


def filt(x, kind, f, order=2):
    sos = butter(order, f, btype=kind, fs=SR, output="sos")
    return sosfilt(sos, x)


def sweep_bp(x, f0, f1, q=0.6, chunks=64):
    """Band-pass whose centre glides from f0 to f1 (processed in overlapping chunks)."""
    out = np.zeros_like(x)
    n = len(x)
    size = n // chunks + 1
    for i in range(chunks):
        a, b = i * size, min(n, (i + 1) * size + size // 2)
        fc = f0 * (f1 / f0) ** (i / max(1, chunks - 1))
        lo, hi = max(20, fc * (1 - q / 2)), min(SR / 2 - 100, fc * (1 + q / 2))
        seg = filt(x[max(0, a - size // 2):b], "bandpass", [lo, hi])
        seg = seg[(a - max(0, a - size // 2)):]
        w = np.hanning(len(seg) * 2)[len(seg):] if i == chunks - 1 else np.ones(len(seg))
        out[a:a + len(seg)] += seg[: n - a] * w[: n - a]
    return out


def env(n, attack, release, hold=0.0, curve=2.0):
    e = np.ones(n)
    a = max(1, int(attack * SR))
    h = int(hold * SR)
    e[:a] = np.linspace(0, 1, a) ** 1.5
    rel = n - a - h
    if rel > 0:
        e[a + h:] = np.linspace(1, 0, rel) ** curve
    return e


def tone(sec, f0, f1, kind="sine"):
    t = T(sec)
    f = f0 * (f1 / f0) ** (t / sec)
    ph = 2 * np.pi * np.cumsum(f) / SR
    if kind == "saw":
        return 2 * ((ph / (2 * np.pi)) % 1) - 1
    return np.sin(ph)


def crackle(sec, density, bright=True):
    n = int(SR * sec)
    x = np.zeros(n)
    idx = rng.integers(0, n, int(density * sec))
    x[idx] = rng.uniform(-1, 1, len(idx))
    x = np.convolve(x, np.exp(-np.arange(200) / 25), mode="same")
    return filt(x, "highpass", 1800 if bright else 400)


def thump(sec, f0, f1, decay):
    t = T(sec)
    return tone(sec, f0, f1) * np.exp(-t * decay)


def master(x, peak=0.92):
    x = x - np.mean(x)
    x = np.tanh(x / (np.max(np.abs(x)) + 1e-9) * 1.4)
    x = x / (np.max(np.abs(x)) + 1e-9) * peak
    fade = int(0.02 * SR)
    x[-fade:] *= np.linspace(1, 0, fade)
    return x


def pad(*parts):
    n = max(len(p) for p in parts)
    out = np.zeros(n)
    for p in parts:
        out[: len(p)] += p
    return out


# ---------------------------------------------------------------------------
def s_wind():
    sec = 3.0
    x = noise(sec)
    gust = 0.55 + 0.45 * np.sin(2 * np.pi * T(sec) * 0.7) ** 2
    howl = sweep_bp(x, 380, 900, q=0.35) * gust + sweep_bp(noise(sec), 1500, 700, q=0.5) * 0.4 * gust[::-1]
    low = filt(noise(sec), "lowpass", 180) * 0.6
    return master(pad(howl, low) * env(int(SR * sec), 0.6, 1.2, hold=1.0), 0.7)


def s_charge():
    sec = 3.2
    t = T(sec)
    hum = sum(tone(sec, 70 * k, 230 * k, "saw") * (0.5 / k) for k in (1, 1.5, 2.01))
    hum = filt(hum, "lowpass", 2400)
    rise = sweep_bp(noise(sec), 300, 4200, q=0.4) * (t / sec) ** 1.5 * 1.3
    crk = crackle(sec, 900) * (0.2 + (t / sec) ** 2) * 0.7
    rumble = filt(noise(sec), "lowpass", 90) * 1.4
    trem = 0.8 + 0.2 * np.sin(2 * np.pi * t * (4 + 10 * t / sec))
    x = (hum * trem + rise + crk + rumble) * env(len(t), 0.4, 0.15, hold=2.6, curve=1.0)
    return master(x)


def s_heartbeat():
    sec = 1.1
    a = thump(0.35, 75, 40, 14)
    b = thump(0.35, 65, 35, 12) * 0.75
    x = np.zeros(int(SR * sec))
    x[: len(a)] += a
    o = int(0.28 * SR)
    x[o:o + len(b)] += b
    x += filt(noise(sec), "lowpass", 60) * 0.15 * env(len(x), 0.01, 0.5)
    return master(x, 0.85)


def s_dash():
    sec = 1.3
    t = T(sec)
    w = sweep_bp(noise(sec), 5200, 280, q=0.8) * env(len(t), 0.18, 0.9, hold=0.15)
    body = filt(noise(sec), "lowpass", 400) * env(len(t), 0.1, 1.0) * 0.6
    return master(w * 1.4 + body)


def s_struggle():
    sec = 2.8
    t = T(sec)
    roar = sweep_bp(noise(sec), 200, 700, q=0.9) * 1.2
    throb = 0.6 + 0.4 * np.sign(np.sin(2 * np.pi * t * (7 + 6 * t / sec)))
    crk = crackle(sec, 2600) * 1.1
    whine = tone(sec, 420, 980) * 0.25 + tone(sec, 427, 990) * 0.25
    sub = thump(sec, 55, 40, 0.3) * 0.8
    x = (roar * throb + crk + whine + sub) * env(len(t), 0.08, 0.1, hold=2.5, curve=1.0)
    return master(x)


def s_impact():
    sec = 5.0
    t = T(sec)
    crack = filt(noise(0.06), "highpass", 1200) * np.linspace(1, 0, int(SR * 0.06)) * 0.9
    sub = thump(sec, 70, 22, 0.9) * 2.0
    roar = filt(noise(sec), "lowpass", 900) * np.exp(-t * 0.9) * 1.6
    mid = filt(noise(sec), "bandpass", [200, 2500]) * np.exp(-t * 2.5) * 1.1
    debris = crackle(sec, 220, bright=False) * np.exp(-t * 0.8) * (t > 0.3) * 0.8
    x = pad(crack, sub + roar + mid + debris)
    return master(x, 0.98)


def s_ring():
    sec = 3.0
    t = T(sec)
    ring = (np.sin(2 * np.pi * 3150 * t) * 0.5 + np.sin(2 * np.pi * 3170 * t) * 0.5) * np.exp(-t * 1.1)
    air = filt(noise(sec), "lowpass", 300) * 0.25 * np.exp(-t * 0.7)
    return master((ring + air) * env(len(t), 0.05, 1.5, hold=0.5), 0.45)


SOUNDS = {"clash_wind": s_wind, "clash_charge": s_charge, "clash_heartbeat": s_heartbeat, "clash_dash": s_dash,
          "clash_struggle": s_struggle, "clash_impact": s_impact, "clash_ring": s_ring}

SND.mkdir(parents=True, exist_ok=True)
with tempfile.TemporaryDirectory() as tmp:
    for name, fn in SOUNDS.items():
        x = fn()
        wav = Path(tmp) / f"{name}.wav"
        wavfile.write(wav, SR, (x * 32767).astype(np.int16))
        subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", str(wav), "-ac", "1", "-c:a", "libvorbis", "-q:a", "5", str(SND / f"{name}.ogg")], check=True)

sd_path = ROOT / "resource_pack" / "sounds" / "sound_definitions.json"
sd = json.loads(sd_path.read_text())
for name in SOUNDS:
    sd["sound_definitions"][f"aegis.{name}"] = {"category": "player", "min_distance": 6, "max_distance": 64,
                                                "sounds": [{"name": f"sounds/aegis/{name}", "volume": 1.0, "load_on_low_memory": True}]}
sd_path.write_text(json.dumps(sd, indent=2) + "\n")
print("Clash sounds:", ", ".join(SOUNDS))
