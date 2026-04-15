#!/usr/bin/env python3
"""Generate lightweight procedural combat SFX as 16-bit PCM WAV files."""
from __future__ import annotations

import math
import random
import subprocess
import wave
from pathlib import Path

SAMPLE_RATE = 22_050
MASTER_GAIN = 0.9


def clamp(x: float, lo: float, hi: float) -> float:
    return lo if x < lo else hi if x > hi else x


def envelope(t: float, attack: float, decay: float) -> float:
    if t < 0:
        return 0.0
    if t <= attack:
        return t / max(attack, 1e-6)
    return math.exp(-(t - attack) / max(decay, 1e-6))


def soft_clip(x: float) -> float:
    return math.tanh(x * 1.8)


def lowpass(samples: list[float], alpha: float) -> list[float]:
    out: list[float] = []
    y = 0.0
    for x in samples:
        y = y + alpha * (x - y)
        out.append(y)
    return out


def highpass(samples: list[float], alpha: float) -> list[float]:
    out: list[float] = []
    y = 0.0
    prev_x = 0.0
    for x in samples:
        y = alpha * (y + x - prev_x)
        out.append(y)
        prev_x = x
    return out


def write_wav(path: Path, samples: list[float]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    clipped = [int(clamp(soft_clip(s * MASTER_GAIN), -1.0, 1.0) * 32767) for s in samples]
    with wave.open(str(path), "wb") as wf:
        wf.setnchannels(1)
        wf.setsampwidth(2)
        wf.setframerate(SAMPLE_RATE)
        wf.writeframes(b"".join(int(v).to_bytes(2, byteorder="little", signed=True) for v in clipped))


def write_ogg_from_wav(wav_path: Path, ogg_path: Path) -> bool:
    cmd = [
        "ffmpeg",
        "-y",
        "-loglevel",
        "error",
        "-i",
        str(wav_path),
        "-ac",
        "1",
        "-ar",
        "24000",
        "-c:a",
        "libopus",
        "-b:a",
        "40k",
        str(ogg_path),
    ]
    try:
        subprocess.run(cmd, check=True)
        return True
    except FileNotFoundError:
        return False
    except subprocess.CalledProcessError:
        return False


def synth_hit(duration: float, start_freq: float, end_freq: float, noise_amt: float, seed: int) -> list[float]:
    rng = random.Random(seed)
    n = int(duration * SAMPLE_RATE)
    samples: list[float] = []

    for i in range(n):
        t = i / SAMPLE_RATE
        k = t / max(duration, 1e-6)
        freq = start_freq * ((end_freq / start_freq) ** clamp(k, 0.0, 1.0))
        tone = math.sin(2 * math.pi * freq * t) + 0.33 * math.sin(2 * math.pi * freq * 2.3 * t)
        noise = rng.uniform(-1.0, 1.0)
        amp = envelope(t, attack=0.0015, decay=duration * 0.22)
        click = 0.0
        if i < int(0.004 * SAMPLE_RATE):
            click = (1.0 - i / (0.004 * SAMPLE_RATE)) * rng.uniform(-1.0, 1.0)
        samples.append((tone * 0.65 + noise * noise_amt + click * 0.35) * amp)

    samples = highpass(samples, 0.92)
    return samples


def synth_whoosh(duration: float, band_lfo_hz: float, seed: int, brightness: float = 0.55) -> list[float]:
    rng = random.Random(seed)
    n = int(duration * SAMPLE_RATE)
    samples: list[float] = []
    for i in range(n):
        t = i / SAMPLE_RATE
        white = rng.uniform(-1.0, 1.0)
        sweep = 0.55 + 0.45 * math.sin(2 * math.pi * band_lfo_hz * t)
        amp = envelope(t, attack=0.01, decay=duration * 0.55)
        body = white * (0.25 + brightness * sweep)
        hiss = math.sin(2 * math.pi * (1400 + 600 * sweep) * t) * 0.08
        samples.append((body + hiss) * amp)

    samples = lowpass(samples, 0.18)
    samples = highpass(samples, 0.88)
    return samples


def synth_impact(duration: float, seed: int, metallic: bool = False) -> list[float]:
    rng = random.Random(seed)
    n = int(duration * SAMPLE_RATE)
    samples: list[float] = []
    for i in range(n):
        t = i / SAMPLE_RATE
        amp = envelope(t, attack=0.001, decay=duration * 0.26)
        noise = rng.uniform(-1.0, 1.0)
        low = math.sin(2 * math.pi * (90 + 35 * math.exp(-t * 22)) * t)
        mid = math.sin(2 * math.pi * (310 + 60 * math.exp(-t * 18)) * t)
        ring = 0.0
        if metallic:
            ring = (
                math.sin(2 * math.pi * 1600 * t) * 0.35
                + math.sin(2 * math.pi * 2030 * t) * 0.25
                + math.sin(2 * math.pi * 2490 * t) * 0.2
            ) * math.exp(-t * 18)
        samples.append((low * 0.5 + mid * 0.4 + noise * 0.3 + ring) * amp)

    samples = highpass(samples, 0.9)
    return samples


def main() -> None:
    out_dir = Path(__file__).resolve().parent.parent / "public" / "assets" / "audio_local" / "combat_generated"
    specs = [
        ("combat_pole_01.wav", synth_hit(0.11, 780, 260, 0.12, seed=101)),
        ("combat_pole_02.wav", synth_hit(0.12, 720, 230, 0.13, seed=102)),
        ("combat_axe_01.wav", synth_hit(0.14, 620, 170, 0.18, seed=201)),
        ("combat_axe_02.wav", synth_hit(0.145, 570, 150, 0.21, seed=202)),
        ("combat_combo_01.wav", synth_hit(0.095, 920, 380, 0.1, seed=301)),
        ("combat_combo_02.wav", synth_hit(0.10, 980, 420, 0.1, seed=302)),
        ("combat_enemy_hit_01.wav", synth_impact(0.12, seed=401, metallic=False)),
        ("combat_enemy_hit_02.wav", synth_impact(0.13, seed=402, metallic=True)),
        ("combat_whoosh_01.wav", synth_whoosh(0.20, band_lfo_hz=7.0, seed=501, brightness=0.55)),
        ("combat_whoosh_02.wav", synth_whoosh(0.22, band_lfo_hz=8.4, seed=502, brightness=0.62)),
    ]

    ogg_ok = 0
    for filename, samples in specs:
        wav_path = out_dir / filename
        write_wav(wav_path, samples)
        ogg_path = wav_path.with_suffix(".ogg")
        if write_ogg_from_wav(wav_path, ogg_path):
            ogg_ok += 1

    print(f"Generated {len(specs)} WAV files in {out_dir}")
    print(f"Generated {ogg_ok} OGG files in {out_dir}")


if __name__ == "__main__":
    main()
