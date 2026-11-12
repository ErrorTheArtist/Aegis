#!/usr/bin/env python3
"""Synthesized sounds for the Edo Tensei cinematic (numpy + scipy, encoded with ffmpeg):
hand-seal snap, clap, a deep gong, the earth rumbling as the coffin heaves out, the lid's creak and crash, and an
eerie drone. Adds aegis.edo_* to sound_definitions.json.   Run from the shinobi-addon folder:  python3 tools/gen_edo_sounds.py
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
rng = np.random.default_rng(404)


def T(sec):
    return np.arange(int(SR * sec)) / SR


def noise(sec):
    return rng.standard_normal(int(SR * sec))


def filt(x, kind, f, order=2):
    return sosfilt(butter(order, f, btype=kind, fs=SR, output="sos"), x)


def master(x, peak=0.92, drive=1.3):
    x = x - np.mean(x)
    x = np.tanh(x / (np.max(np.abs(x)) + 1e-9) * drive)
    x = x / (np.max(np.abs(x)) + 1e-9) * peak
    fade = int(0.02 * SR)
    x[-fade:] *= np.linspace(1, 0, fade)
    return x


def place(total, *parts):
    """parts: (start seconds, samples) mixed into a buffer of `total` seconds."""
    out = np.zeros(int(SR * total))
    for t0, p in parts:
        a = int(t0 * SR)
        n = min(len(p), len(out) - a)
        if n > 0:
            out[a:a + n] += p[:n]
    return out


def thump(sec, f0, f1, decay):
    t = T(sec)
    f = f0 * (f1 / f0) ** (t / sec)
    return np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t * decay)


def burst(sec, lo, hi, decay):
    return filt(noise(sec), "bandpass", [lo, hi]) * np.exp(-T(sec) * decay)


def s_seal():  # cloth whip + a dry wooden clack
    whip = burst(0.16, 900, 5200, 30) * np.linspace(0.2, 1, int(SR * 0.16)) ** 0.5
    clack = (np.sin(2 * np.pi * 1150 * T(0.09)) + 0.5 * np.sin(2 * np.pi * 2870 * T(0.09))) * np.exp(-T(0.09) * 70)
    return master(place(0.3, (0, whip * 0.8), (0.05, clack * 1.2), (0.05, burst(0.05, 2000, 8000, 80) * 0.6)), 0.8)


def s_clap():
    crack = burst(0.05, 1200, 9000, 90) * 1.6
    body = thump(0.25, 240, 120, 22)
    tail = filt(noise(0.7), "bandpass", [300, 2600]) * np.exp(-T(0.7) * 7) * 0.35
    return master(place(0.8, (0, crack), (0, body), (0.01, tail)), 0.9)


def s_gong():
    sec = 5.0
    t = T(sec)
    x = np.zeros(len(t))
    for ratio, amp, dec in ((1, 1.0, 0.55), (1.004, 0.7, 0.6), (1.48, 0.55, 0.8), (2.02, 0.45, 1.0), (2.74, 0.3, 1.4), (3.76, 0.22, 1.9), (4.9, 0.15, 2.6)):
        x += amp * np.sin(2 * np.pi * 58 * ratio * t + rng.uniform(0, 6.28)) * np.exp(-t * dec)
    strike = burst(0.12, 150, 2400, 28) * 1.4
    shimmer = filt(noise(sec), "bandpass", [1800, 5200]) * np.exp(-t * 2.2) * 0.12 * (1 + np.sin(2 * np.pi * 5 * t))
    return master(place(sec, (0, x), (0, strike), (0, shimmer)), 0.95, drive=1.1)


def s_rumble():  # three heaves and a settle, like the coffin's rise
    sec = 3.0
    t = T(sec)
    heave = np.zeros(len(t))
    for a, b in ((0.15, 0.6), (0.8, 1.25), (1.45, 2.0)):
        m = (t >= a) & (t <= b + 0.25)
        u = np.clip((t - a) / (b - a), 0, 1)
        heave[m] += (np.sin(np.pi * np.clip((t[m] - a) / (b + 0.25 - a), 0, 1)) ** 0.6) * (0.75 + 0.25 * u[m])
    low = filt(noise(sec), "lowpass", 95, 3) * 2.4
    grind = filt(noise(sec), "bandpass", [140, 900]) * (0.5 + 0.5 * np.abs(filt(noise(sec), "lowpass", 14))) * 0.8
    stones = np.zeros(len(t))
    idx = rng.integers(int(0.15 * SR), int(2.2 * SR), 70)
    stones[idx] = rng.uniform(-1, 1, len(idx))
    stones = filt(np.convolve(stones, np.exp(-np.arange(400) / 60), mode="same"), "bandpass", [500, 3500]) * 1.5
    settle = thump(0.6, 70, 34, 7) * 1.6
    return master(place(sec, (0, (low + grind + stones) * (0.12 + heave)), (2.2, settle), (2.2, burst(0.3, 100, 1200, 12) * 0.6)), 0.95)


def s_creak():  # stick-slip wood creak
    sec = 0.75
    t = T(sec)
    f = 150 + 90 * np.sin(2 * np.pi * 1.6 * t + 0.6) + 25 * np.sin(2 * np.pi * 9 * t)
    saw = 2 * ((np.cumsum(f) / SR) % 1) - 1
    slip = (np.sin(2 * np.pi * np.cumsum(38 + 30 * t / sec) / SR) > 0.2).astype(float)
    slip = filt(slip, "lowpass", 400)
    x = filt(saw * slip, "bandpass", [500, 2800]) + filt(saw * slip, "bandpass", [1500, 4200]) * 0.5
    e = np.minimum(1, t / 0.06) * np.minimum(1, (sec - t) / 0.15)
    return master(x * e, 0.75)


def s_thud():  # the lid crashes down, bounces, rattles
    hit = place(0.7, (0, thump(0.7, 95, 38, 6) * 1.8), (0, burst(0.25, 120, 1800, 16) * 1.3), (0, burst(0.04, 1500, 7000, 80) * 0.8))
    hit2 = place(0.3, (0, thump(0.3, 110, 60, 14)), (0, burst(0.1, 200, 2500, 30))) * 0.45
    hit3 = place(0.2, (0, thump(0.2, 120, 70, 20)), (0, burst(0.06, 300, 3000, 40))) * 0.22
    dust = filt(noise(1.2), "bandpass", [700, 5000]) * np.exp(-T(1.2) * 3) * 0.12
    return master(place(1.5, (0, hit), (0.17, hit2), (0.29, hit3), (0.02, dust)), 0.97)


def s_drone():  # the air of the afterlife: low, beating, with a breath of wind
    sec = 10.0
    t = T(sec)
    x = np.zeros(len(t))
    for f, a in ((55, 1.0), (55.6, 0.9), (82.6, 0.5), (110.4, 0.35), (164.1, 0.16), (233, 0.08)):
        x += a * np.sin(2 * np.pi * f * t + rng.uniform(0, 6.28))
    x *= 0.75 + 0.25 * np.sin(2 * np.pi * 0.23 * t)
    wind = filt(noise(sec), "bandpass", [300, 900]) * (0.5 + 0.5 * np.sin(2 * np.pi * 0.11 * t + 1)) * 0.25
    whistle = np.sin(2 * np.pi * (1760 + 14 * np.sin(2 * np.pi * 0.4 * t)) * t) * 0.02 * (0.5 + 0.5 * np.sin(2 * np.pi * 0.17 * t))
    e = np.minimum(1, t / 1.5) * np.minimum(1, (sec - t) / 2.5)
    return master((x + wind + whistle) * e, 0.6, drive=1.0)


SOUNDS = {"edo_seal": s_seal, "edo_clap": s_clap, "edo_gong": s_gong, "edo_rumble": s_rumble, "edo_creak": s_creak,
          "edo_thud": s_thud, "edo_drone": s_drone}

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
    sd["sound_definitions"][f"aegis.{name}"] = {"category": "player", "min_distance": 6, "max_distance": 48,
                                                "sounds": [{"name": f"sounds/aegis/{name}", "volume": 1.0, "load_on_low_memory": True}]}
sd_path.write_text(json.dumps(sd, indent=2) + "\n")
print("Edo sounds:", ", ".join(SOUNDS))
