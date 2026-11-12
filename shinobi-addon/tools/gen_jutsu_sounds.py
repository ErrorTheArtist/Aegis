#!/usr/bin/env python3
"""Synthesized jutsu sound effects (numpy + scipy, encoded with ffmpeg).

  Foley, cued from the animations (behavior_pack/scripts/sfx.js): handsign, swish, spin, leap, land, step, inhale, poof
  Elements and techniques, played by the jutsu themselves: water, water_burst, wind, wind_cut, earth, earth_break,
  ice, ice_shatter, wood, lava, fire_roar, thunder, heal, push, pull, eye, shadow, gates, summon, dome

Adds aegis.<name> to sound_definitions.json.   Run from the shinobi-addon folder:  python3 tools/gen_jutsu_sounds.py
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
rng = np.random.default_rng(2024)


def T(sec):
    return np.arange(int(SR * sec)) / SR


def noise(sec):
    return rng.standard_normal(int(SR * sec))


def filt(x, kind, f, order=2):
    return sosfilt(butter(order, f, btype=kind, fs=SR, output="sos"), x)


def sweep(x, f0, f1, q=0.7, chunks=48, mid=None):
    """Band-pass whose centre glides f0 → (mid →) f1."""
    out = np.zeros_like(x)
    n = len(x)
    size = n // chunks + 1
    for i in range(chunks):
        u = i / max(1, chunks - 1)
        if mid is None:
            fc = f0 * (f1 / f0) ** u
        else:
            fc = f0 * (mid / f0) ** (u * 2) if u < 0.5 else mid * (f1 / mid) ** ((u - 0.5) * 2)
        lo, hi = max(30, fc * (1 - q / 2)), min(SR / 2 - 200, fc * (1 + q / 2))
        a = i * size
        seg = filt(x[max(0, a - size):min(n, a + size)], "bandpass", [lo, hi])[min(a, size):]
        seg = seg[:min(size, n - a)]
        out[a:a + len(seg)] += seg
    return out


def hann(n, attack=0.5):
    """Smooth rise and fall; attack = where the peak sits (0–1)."""
    t = np.linspace(0, 1, n)
    return np.where(t < attack, np.sin(np.pi / 2 * t / max(attack, 1e-6)) ** 2, np.cos(np.pi / 2 * (t - attack) / max(1 - attack, 1e-6)) ** 2)


def thump(sec, f0, f1, decay):
    t = T(sec)
    f = f0 * (f1 / f0) ** (t / sec)
    return np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t * decay)


def burst(sec, lo, hi, decay):
    return filt(noise(sec), "bandpass", [lo, hi]) * np.exp(-T(sec) * decay)


def clicks(sec, count, lo, hi, tail=60, start=0.0):
    """Random little impacts (stones, crackle, droplets)."""
    n = int(SR * sec)
    x = np.zeros(n)
    idx = rng.integers(int(start * SR), n, count)
    x[idx] = rng.uniform(-1, 1, count)
    return filt(np.convolve(x, np.exp(-np.arange(tail * 6) / tail), mode="same"), "bandpass", [lo, hi])


def pings(sec, count, f_lo, f_hi, decay=30, start=0.0, end=None):
    """Random decaying sine blips (ice, glass, droplets)."""
    x = np.zeros(int(SR * sec))
    for _ in range(count):
        t0 = rng.uniform(start, end if end is not None else sec * 0.7)
        d = min(0.25, sec - t0)
        t = T(d)
        f = rng.uniform(f_lo, f_hi)
        a = int(t0 * SR)
        seg = np.sin(2 * np.pi * f * t) * np.exp(-t * decay) * rng.uniform(0.4, 1)
        x[a:a + len(seg)] += seg[:len(x) - a]
    return x


def mix(total, *parts):
    out = np.zeros(int(SR * total))
    for t0, p in parts:
        a = int(t0 * SR)
        n = min(len(p), len(out) - a)
        if n > 0:
            out[a:a + n] += p[:n]
    return out


def master(x, peak=0.9, drive=1.3):
    x = x - np.mean(x)
    x = np.tanh(x / (np.max(np.abs(x)) + 1e-9) * drive)
    x = x / (np.max(np.abs(x)) + 1e-9) * peak
    fade = int(0.015 * SR)
    x[-fade:] *= np.linspace(1, 0, fade)
    x[:64] *= np.linspace(0, 1, 64)
    return x


def turb(sec, rate):
    """Slow random wobble 0–1 (flames, water, wind)."""
    m = np.abs(filt(noise(sec), "lowpass", rate))
    return m / (np.max(m) + 1e-9)


# ---------------------------------------------------------------- foley
def s_handsign():
    return master(mix(0.2, (0, burst(0.09, 1500, 7000, 55)), (0.005, thump(0.08, 420, 180, 45) * 0.8), (0.02, burst(0.12, 600, 2500, 30) * 0.3)), 0.8)


def s_swish():
    n = noise(0.32)
    return master(sweep(n, 700, 1400, 0.9, mid=3800) * hann(len(n), 0.35), 0.7)


def s_spin():
    n = noise(0.55)
    t = T(0.55)
    return master(sweep(n, 500, 900, 0.8, mid=2600) * hann(len(n), 0.5) * (0.55 + 0.45 * np.sin(2 * np.pi * 16 * t)), 0.75)


def s_leap():
    n = noise(0.45)
    return master(mix(0.5, (0, thump(0.18, 150, 70, 22) * 0.9), (0.02, sweep(n, 350, 2800, 0.8) * hann(len(n), 0.6))), 0.8)


def s_land():
    return master(mix(0.75, (0, thump(0.5, 120, 42, 9) * 1.6), (0, burst(0.12, 200, 2200, 28)), (0.03, clicks(0.7, 40, 500, 3500, 40) * np.exp(-T(0.7) * 5) * 1.4)), 0.92)


def s_step():
    return master(mix(0.14, (0, thump(0.12, 170, 75, 40)), (0, burst(0.05, 800, 4000, 80) * 0.35)), 0.6)


def s_inhale():
    n = noise(0.42)
    t = np.linspace(0, 1, len(n))
    return master(sweep(n, 500, 2400, 0.9) * (t ** 1.3) * np.minimum(1, (1 - t) / 0.08), 0.5)


def s_poof():
    soft = filt(noise(0.55), "lowpass", 900) * np.exp(-T(0.55) * 9) * 1.4
    air = filt(noise(0.55), "bandpass", [1200, 5000]) * hann(int(SR * 0.55), 0.15) * 0.35
    return master(mix(0.6, (0, thump(0.2, 140, 60, 20) * 0.8), (0, soft), (0.01, air)), 0.8)


# ---------------------------------------------------------------- elements
def s_water():
    sec = 1.3
    body = filt(noise(sec), "bandpass", [250, 2800]) * (0.45 + 0.55 * turb(sec, 22))
    low = filt(noise(sec), "lowpass", 160) * 1.2
    spray = filt(noise(sec), "highpass", 4500) * 0.18 * turb(sec, 40)
    drops = pings(sec, 26, 900, 2600, 45) * 0.25
    e = np.minimum(1, T(sec) / 0.25) * np.minimum(1, (sec - T(sec)) / 0.4)
    return master((body + low + spray) * e + drops, 0.85)


def s_water_burst():
    return master(mix(1.0, (0, thump(0.4, 110, 45, 9) * 1.2), (0, filt(noise(0.9), "highpass", 900) * np.exp(-T(0.9) * 5.5)),
                      (0, filt(noise(0.9), "bandpass", [200, 1200]) * np.exp(-T(0.9) * 4) * 0.9), (0.08, pings(0.9, 40, 1200, 4200, 35) * 0.4)), 0.92)


def s_wind():
    n = noise(1.0)
    gust = sweep(n, 300, 520, 0.6, mid=1500) * hann(len(n), 0.3) * 1.3
    hiss = filt(noise(1.0), "highpass", 3500) * hann(len(n), 0.25) * 0.22
    low = filt(noise(1.0), "lowpass", 140) * hann(len(n), 0.2) * 0.9
    return master(gust + hiss + low, 0.88)


def s_wind_cut():
    n = noise(0.36)
    return master(mix(0.4, (0, sweep(n, 6500, 1400, 0.7) * np.exp(-T(0.36) * 9) * 1.3), (0, burst(0.03, 3000, 9000, 120) * 0.7)), 0.8)


def s_earth():
    sec = 1.15
    t = T(sec)
    rumble = filt(noise(sec), "lowpass", 110, 3) * 2.2 * (0.4 + 0.6 * turb(sec, 9))
    grind = filt(noise(sec), "bandpass", [150, 800]) * turb(sec, 16) * 0.9
    rocks = clicks(sec, 70, 400, 3200, 50) * 1.3
    e = np.minimum(1, t / 0.2) ** 0.8 * np.minimum(1, (sec - t) / 0.3)
    return master((rumble + grind + rocks) * e, 0.92)


def s_earth_break():
    return master(mix(1.0, (0, burst(0.05, 800, 6000, 70) * 1.2), (0, thump(0.6, 95, 34, 7) * 1.9), (0, burst(0.3, 150, 1500, 13) * 1.1),
                      (0.05, clicks(0.9, 55, 400, 3000, 45) * np.exp(-T(0.9) * 3.5) * 1.5)), 0.95)


def s_ice():
    sec = 0.85
    chime = pings(sec, 22, 2200, 6500, 22, end=0.5) * 0.7
    crack = clicks(sec, 45, 2500, 9000, 12) * np.exp(-T(sec) * 2) * 0.9
    breath = filt(noise(sec), "highpass", 5000) * hann(int(SR * sec), 0.2) * 0.15
    return master(chime + crack + breath, 0.8)


def s_ice_shatter():
    sec = 0.8
    return master(mix(sec, (0, filt(noise(0.25), "highpass", 2500) * np.exp(-T(0.25) * 22) * 1.5), (0, thump(0.15, 300, 120, 30) * 0.5),
                      (0, pings(sec, 60, 2500, 8500, 26, end=0.35) * 0.8), (0.04, clicks(0.7, 60, 3000, 10000, 10) * np.exp(-T(0.7) * 5))), 0.88)


def s_wood():
    sec = 1.05
    t = T(sec)
    f = 95 + 60 * np.sin(2 * np.pi * 1.3 * t + 1) + 18 * np.sin(2 * np.pi * 7 * t)
    saw = 2 * ((np.cumsum(f) / SR) % 1) - 1
    slip = filt((np.sin(2 * np.pi * np.cumsum(24 + 30 * t / sec) / SR) > 0.1).astype(float), "lowpass", 300)
    creak = (filt(saw * slip, "bandpass", [300, 1800]) + filt(saw * slip, "bandpass", [900, 3000]) * 0.4) * np.minimum(1, t / 0.08) * np.minimum(1, (sec - t) / 0.2)
    knocks = mix(sec, *[(tt, thump(0.1, 260, 120, 40) * 0.8) for tt in (0.12, 0.38, 0.6, 0.82)])
    rustle = filt(noise(sec), "highpass", 3000) * turb(sec, 18) * 0.12
    return master(creak + knocks + rustle, 0.85)


def s_lava():
    sec = 1.1
    t = T(sec)
    glug = filt(noise(sec), "lowpass", 220, 3) * 2.2 * (0.3 + 0.7 * turb(sec, 6))
    bubbles = mix(sec, *[(tt, thump(0.14, rng.uniform(90, 200), rng.uniform(220, 420), 26) * 0.8) for tt in rng.uniform(0.02, 0.9, 9)])
    sizzle = filt(noise(sec), "highpass", 3800) * (0.3 + 0.7 * turb(sec, 30)) * 0.22
    e = np.minimum(1, t / 0.1) * np.minimum(1, (sec - t) / 0.3)
    return master((glug + sizzle) * e + bubbles, 0.88)


def s_fire_roar():
    sec = 1.45
    t = T(sec)
    roar = filt(noise(sec), "bandpass", [140, 1700]) * (0.5 + 0.5 * turb(sec, 13)) * 1.5
    sub = filt(noise(sec), "lowpass", 75, 3) * 1.6
    crackle = clicks(sec, 130, 1800, 8000, 8) * 0.5
    whoosh = sweep(noise(0.35), 300, 2600, 0.9) * hann(int(SR * 0.35), 0.5) * 1.2
    e = np.minimum(1, t / 0.07) * np.minimum(1, (sec - t) / 0.55) ** 1.4
    return master(mix(sec, (0, (roar + sub + crackle) * e), (0, whoosh)), 0.93)


def s_thunder():
    sec = 2.6
    t = T(sec)
    crack = mix(sec, (0, burst(0.06, 600, 9000, 45) * 2.2), (0.05, burst(0.12, 300, 5000, 22) * 1.4), (0.13, burst(0.1, 500, 7000, 30)))
    roll = filt(noise(sec), "lowpass", 170, 3) * 2.6 * (0.35 + 0.65 * turb(sec, 5)) * np.exp(-t * 1.3)
    boom = thump(1.2, 70, 26, 2.6) * 1.8
    return master(crack + roll + mix(sec, (0.04, boom)), 0.97)


def s_heal():
    sec = 1.25
    t = T(sec)
    x = sum(a * np.sin(2 * np.pi * f * t + p) for f, a, p in ((660, 1, 0), (662.5, 0.6, 1), (990, 0.6, 2), (1320, 0.4, 0.5), (1980, 0.18, 3)))
    x *= 0.7 + 0.3 * np.sin(2 * np.pi * 6 * t)
    air = filt(noise(sec), "highpass", 5000) * 0.05
    return master((x + air) * hann(len(t), 0.3), 0.55, drive=1.0)


def s_push():
    sec = 1.25
    n = noise(0.7)
    return master(mix(sec, (0, thump(1.1, 78, 26, 3.2) * 2.2), (0, burst(0.08, 400, 6000, 40) * 1.2),
                      (0.01, sweep(n, 2600, 250, 1.0) * np.exp(-T(0.7) * 4) * 1.4), (0.05, filt(noise(1.1), "lowpass", 120, 3) * np.exp(-T(1.1) * 3) * 1.6)), 0.97)


def s_pull():
    sec = 0.95
    n = noise(0.75)
    t = np.linspace(0, 1, len(n))
    suck = sweep(n, 250, 3200, 0.9) * t ** 2.2 * 1.5
    return master(mix(sec, (0, suck), (0.75, thump(0.2, 150, 55, 18) * 1.5), (0.75, burst(0.05, 500, 5000, 60))), 0.9)


def s_eye():
    sec = 0.9
    t = T(sec)
    shing = (np.sin(2 * np.pi * (2300 + 500 * t / sec) * t) + 0.5 * np.sin(2 * np.pi * (3470 + 300 * t / sec) * t)) * np.exp(-t * 6)
    drone = (np.sin(2 * np.pi * 82 * t) + 0.6 * np.sin(2 * np.pi * 123.5 * t)) * hann(len(t), 0.25) * 0.9
    swell = filt(noise(0.2), "bandpass", [800, 4000]) * np.linspace(0, 1, int(SR * 0.2)) ** 2 * 0.5
    return master(mix(sec, (0.18, shing), (0, drone), (0, swell)), 0.8)


def s_shadow():
    sec = 1.1
    t = T(sec)
    f = 62 * (38 / 62) ** (t / sec)
    saw = filt(2 * ((np.cumsum(f) / SR) % 1) - 1, "lowpass", 380) * 1.3
    hush = sweep(noise(sec), 1600, 180, 0.9) * 0.7
    return master((saw + hush) * hann(len(t), 0.2), 0.85)


def s_gates():
    sec = 1.7
    rise_n = noise(0.74)
    tr = np.linspace(0, 1, len(rise_n))
    rise = (sweep(rise_n, 180, 1700, 0.9) + filt(noise(0.74), "lowpass", 100, 3) * 1.5) * tr ** 1.6 * (0.7 + 0.3 * np.sin(2 * np.pi * (8 + 20 * tr) * tr))
    tail = filt(noise(0.95), "bandpass", [150, 2400]) * np.exp(-T(0.95) * 3) * (0.5 + 0.5 * turb(0.95, 14)) * 1.5
    return master(mix(sec, (0, rise), (0.74, thump(0.8, 90, 30, 4) * 2.2), (0.74, burst(0.07, 500, 7000, 45) * 1.4), (0.74, tail)), 0.96)


def s_summon():
    return master(mix(1.1, (0, thump(0.9, 68, 28, 4) * 2.0), (0, burst(0.06, 300, 4000, 50)), (0.02, filt(noise(0.9), "lowpass", 1100) * np.exp(-T(0.9) * 5) * 1.5),
                      (0.05, filt(noise(0.9), "bandpass", [1500, 5000]) * hann(int(SR * 0.9), 0.12) * 0.3)), 0.95)


def s_dome():
    sec = 2.4
    t = T(sec)
    u = t / sec
    f = 55 * (190 / 55) ** u
    ph = 2 * np.pi * np.cumsum(f) / SR
    hum = filt(sum((2 * ((ph * k / (2 * np.pi)) % 1) - 1) / k for k in (1, 1.5, 2.01)), "lowpass", 1800)
    hiss = sweep(noise(sec), 300, 3600, 0.6) * u ** 1.5 * 1.2
    trem = 0.7 + 0.3 * np.sin(2 * np.pi * np.cumsum(5 + 22 * u) / SR)
    crk = clicks(sec, 500, 2000, 9000, 6) * (0.2 + u ** 2) * 0.6
    e = np.minimum(1, t / 0.12) * (0.35 + 0.65 * u)
    return master((hum * trem + hiss + crk) * e, 0.9)


# ---------------------------------------------------------------- melee and swords
def s_hit():   # a punch landing: a dull thud with a slap on top
    return master(mix(0.22, (0, thump(0.16, 190, 70, 30) * 1.6), (0, burst(0.035, 900, 5000, 90) * 0.9), (0.005, burst(0.1, 200, 1200, 35) * 0.7)), 0.85)


def s_hit_heavy():   # the finisher: deeper, with a crack and a short tail
    return master(mix(0.5, (0, thump(0.4, 150, 42, 11) * 2.0), (0, burst(0.05, 1200, 8000, 70) * 1.3), (0, burst(0.2, 150, 1500, 18) * 1.1),
                      (0.04, filt(noise(0.4), "lowpass", 300) * np.exp(-T(0.4) * 9) * 0.9)), 0.95)


def _ring(sec, f0, decay):
    t = T(sec)
    return sum(a * np.sin(2 * np.pi * f0 * k * t + ph) for k, a, ph in ((1, 1, 0), (2.76, 0.5, 1), (5.4, 0.3, 2), (8.9, 0.15, 3))) * np.exp(-t * decay)


def s_draw():   # steel sliding out of a scabbard, ending in a ring
    n = noise(0.3)
    scrape = sweep(n, 2500, 7500, 0.8) * np.linspace(0.3, 1, len(n)) ** 1.5
    return master(mix(0.75, (0, scrape * 0.8), (0.27, _ring(0.48, 2100, 7) * 0.6), (0.27, burst(0.02, 3000, 9000, 150) * 0.6)), 0.75)


def s_sheathe():   # sliding home, then the guard clicks against the scabbard
    n = noise(0.28)
    scrape = sweep(n, 6500, 2200, 0.8) * np.linspace(1, 0.4, len(n))
    return master(mix(0.45, (0, scrape * 0.7), (0.28, thump(0.08, 500, 220, 55) * 1.1), (0.28, burst(0.03, 1500, 6000, 110) * 0.8)), 0.7)


SOUNDS = {"hit": s_hit, "hit_heavy": s_hit_heavy, "draw": s_draw, "sheathe": s_sheathe, "handsign": s_handsign, "swish": s_swish, "spin": s_spin, "leap": s_leap, "land": s_land, "step": s_step, "inhale": s_inhale, "poof": s_poof,
          "water": s_water, "water_burst": s_water_burst, "wind": s_wind, "wind_cut": s_wind_cut, "earth": s_earth, "earth_break": s_earth_break,
          "ice": s_ice, "ice_shatter": s_ice_shatter, "wood": s_wood, "lava": s_lava, "fire_roar": s_fire_roar, "thunder": s_thunder, "heal": s_heal,
          "push": s_push, "pull": s_pull, "eye": s_eye, "shadow": s_shadow, "gates": s_gates, "summon": s_summon, "dome": s_dome}

if __name__ == "__main__":
    SND.mkdir(parents=True, exist_ok=True)
    report = []
    with tempfile.TemporaryDirectory() as tmp:
        for name, fn in SOUNDS.items():
            x = fn()
            assert np.isfinite(x).all() and np.max(np.abs(x)) > 0.3, name
            report.append(f"{name} {len(x) / SR:.2f}s rms {np.sqrt(np.mean(x ** 2)):.2f}")
            wav = Path(tmp) / f"{name}.wav"
            wavfile.write(wav, SR, (x * 32767).astype(np.int16))
            subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", str(wav), "-ac", "1", "-c:a", "libvorbis", "-q:a", "4", str(SND / f"{name}.ogg")], check=True)
    sd_path = ROOT / "resource_pack" / "sounds" / "sound_definitions.json"
    sd = json.loads(sd_path.read_text())
    for name in SOUNDS:
        sd["sound_definitions"][f"aegis.{name}"] = {"category": "player", "min_distance": 4, "max_distance": 40,
                                                    "sounds": [{"name": f"sounds/aegis/{name}", "volume": 1.0, "load_on_low_memory": True}]}
    sd_path.write_text(json.dumps(sd, indent=2) + "\n")
    print("Jutsu sounds:", " | ".join(report))
