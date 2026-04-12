"""
fartforge/synth.py

Procedural fart sound synthesis using numpy + scipy.
Generates CC0-compatible fart audio from scratch — no samples needed.
Real acoustic physics of flatulence: anal sphincter resonance + gas turbulence.
"""

from __future__ import annotations

import numpy as np
from scipy.signal import butter, lfilter, sosfilt, butter


SAMPLE_RATE = 22050  # Hz


def synthesize_fart(
    energy: float,
    duration_ms: int,
    seed: int = 42,
    sample_rate: int = SAMPLE_RATE,
) -> tuple[np.ndarray, int]:
    """
    Synthesize a realistic fart sound using procedural audio generation.

    Models three acoustic components:
    1. Low-frequency sphincter resonance (50–200 Hz) — the "base rumble"
    2. Mid-frequency turbulent gas flow (200–800 Hz) — the "texture"
    3. High-frequency air burst transients (800–3000 Hz) — the "sharpness"

    Args:
        energy: 0.0–1.0, maps to intensity (silent → nuclear)
        duration_ms: emission duration in milliseconds
        seed: random seed for reproducibility (same emission = same fart)
        sample_rate: audio sample rate in Hz

    Returns:
        Tuple of (audio_array_float32, sample_rate)
    """
    rng = np.random.default_rng(seed)
    n_samples = int(sample_rate * duration_ms / 1000)
    t = np.linspace(0, duration_ms / 1000, n_samples, endpoint=False)

    # ── Component 1: Sphincter resonance (fundamental frequency) ──────────
    # Real anal sphincter resonates at 30–150 Hz depending on tension
    fundamental_hz = 80 - energy * 50 + rng.uniform(-10, 10)  # looser = lower freq
    fundamental_hz = max(30.0, fundamental_hz)

    # AM modulation simulates sphincter flutter
    flutter_rate = 8 + energy * 15 + rng.uniform(-2, 2)  # Hz
    am_envelope = 0.5 + 0.5 * np.sin(2 * np.pi * flutter_rate * t)

    # FM modulation for pitch variation (the "brrrrr" quality)
    fm_depth = 0.15 + energy * 0.3
    fm_rate = 4 + energy * 8
    pitch_mod = fundamental_hz * (1 + fm_depth * np.sin(2 * np.pi * fm_rate * t))
    phase = 2 * np.pi * np.cumsum(pitch_mod) / sample_rate

    sphincter = am_envelope * np.sin(phase)

    # Add harmonics (2nd and 3rd — the "body" of the sound)
    sphincter += 0.4 * am_envelope * np.sin(2 * phase + rng.uniform(0, np.pi))
    sphincter += 0.2 * am_envelope * np.sin(3 * phase + rng.uniform(0, np.pi))

    # ── Component 2: Turbulent gas flow (bandpass noise) ──────────────────
    # Gaussian noise passed through bandpass filter to simulate gas turbulence
    noise = rng.standard_normal(n_samples)

    # Low band — the "wet" rumble
    low_sos = butter(4, [60, 400], btype="bandpass", fs=sample_rate, output="sos")
    low_noise = sosfilt(low_sos, noise) * (0.3 + energy * 0.5)

    # Mid band — the "airy hiss"
    mid_sos = butter(4, [400, 1200], btype="bandpass", fs=sample_rate, output="sos")
    mid_noise = sosfilt(mid_sos, noise) * (0.1 + energy * 0.3)

    turbulence = low_noise + mid_noise

    # ── Component 3: Transient air bursts (for "intense" / "nuclear") ─────
    # Sharp percussive events at random intervals simulating gas pulses
    transients = np.zeros(n_samples)
    if energy > 0.4:
        n_bursts = int(energy * 12)
        burst_positions = rng.integers(
            int(n_samples * 0.05), int(n_samples * 0.85), size=n_bursts
        )
        for pos in burst_positions:
            burst_len = int(sample_rate * 0.025)  # 25ms burst
            burst = rng.standard_normal(burst_len) * energy * 0.4
            # Exponential decay envelope
            decay = np.exp(-np.arange(burst_len) / (burst_len * 0.3))
            end = min(pos + burst_len, n_samples)
            transients[pos:end] += (burst * decay)[: end - pos]

        # Bandpass the transients (800–3000 Hz crackle)
        t_sos = butter(4, [800, 3000], btype="bandpass", fs=sample_rate, output="sos")
        transients = sosfilt(t_sos, transients)

    # ── Blend components ──────────────────────────────────────────────────
    # Weights: sphincter dominates, turbulence textures, transients accent
    raw = (
        sphincter * 0.55
        + turbulence * 0.35
        + transients * 0.10
    )

    # ── Master envelope ───────────────────────────────────────────────────
    # Attack: very fast (0–30ms) — farts don't fade in politely
    # Sustain: variable
    # Release: medium (100–400ms) — trailing off gracefully (or not)
    attack_samples = int(sample_rate * 0.02)
    release_samples = int(sample_rate * (0.1 + energy * 0.3))

    envelope = np.ones(n_samples)
    # Attack ramp
    if attack_samples > 0:
        envelope[:attack_samples] = np.linspace(0, 1, attack_samples)
    # Release ramp
    if release_samples > 0 and release_samples < n_samples:
        release_start = n_samples - release_samples
        envelope[release_start:] = np.linspace(1, 0, release_samples)

    # Random amplitude wobble (the fart is not a perfectly controlled instrument)
    wobble_freq = 3 + energy * 5
    wobble = 1.0 + 0.08 * np.sin(2 * np.pi * wobble_freq * t + rng.uniform(0, 2 * np.pi))
    envelope *= wobble

    raw *= envelope

    # ── Final normalize + soft clip ───────────────────────────────────────
    peak = np.max(np.abs(raw))
    if peak > 0:
        raw /= peak

    # Soft clip via tanh (prevents harsh digital distortion — even farts have dignity)
    target_amplitude = 0.3 + energy * 0.55
    raw = np.tanh(raw * 2.0) / np.tanh(2.0) * target_amplitude

    return raw.astype(np.float32), sample_rate
