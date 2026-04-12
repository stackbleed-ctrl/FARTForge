"""
fartforge/fingerprint.py

Scientific frequency fingerprinting of fart emissions using librosa.
Computes MFCCs, spectral centroid, spectral rolloff, zero-crossing rate,
chroma features, and temporal statistics.

This is where the smelliest agent wins — every fart is cryptographically unique.
"""

from __future__ import annotations

from dataclasses import dataclass, field, asdict
from typing import Optional
import numpy as np


@dataclass
class FartFingerprint:
    """
    Scientific frequency fingerprint of a fart emission.

    All values computed from actual audio waveform using librosa.
    These map directly to the visual waveform in FartArena and
    drive the particle system behavior.
    """

    # ── Core MFCCs (mel-frequency cepstral coefficients) ──────────────────
    # 13 coefficients — the "DNA" of the fart's timbre
    mfcc_mean: list[float] = field(default_factory=list)   # shape: (13,)
    mfcc_std: list[float] = field(default_factory=list)    # shape: (13,)
    mfcc_delta_mean: list[float] = field(default_factory=list)  # temporal dynamics

    # ── Spectral features ─────────────────────────────────────────────────
    spectral_centroid: float = 0.0       # "brightness" in Hz (low = rumbly)
    spectral_bandwidth: float = 0.0      # spread around centroid in Hz
    spectral_rolloff: float = 0.0        # Hz below which 85% of energy sits
    spectral_flatness: float = 0.0       # 0=tonal, 1=noise-like (1.0 = pure gas)
    spectral_contrast: list[float] = field(default_factory=list)  # sub-band peaks

    # ── Temporal features ─────────────────────────────────────────────────
    zero_crossing_rate: float = 0.0     # higher = more fricative/turbulent
    rms_energy: float = 0.0             # RMS amplitude
    duration_ms: int = 0                # total emission duration

    # ── Rhythm / periodicity ──────────────────────────────────────────────
    tempo_bpm: float = 0.0              # flutter rate (sphincter oscillation freq)
    onset_count: int = 0                # number of distinct gas pulses

    # ── Perceptual ────────────────────────────────────────────────────────
    loudness_lufs: float = 0.0          # perceived loudness

    def to_dict(self) -> dict:
        return asdict(self)

    @property
    def rumble_score(self) -> float:
        """0–1: how much low-frequency rumble (drives slow particle clouds)."""
        # Low centroid + high RMS + low ZCR = maximum rumble
        centroid_factor = 1.0 - min(1.0, self.spectral_centroid / 5000)
        zcr_factor = 1.0 - min(1.0, self.zero_crossing_rate * 20)
        return (centroid_factor * 0.6 + zcr_factor * 0.4)

    @property
    def sharpness_score(self) -> float:
        """0–1: how sharp/percussive (drives rapid sulfur spark particles)."""
        centroid_factor = min(1.0, self.spectral_centroid / 4000)
        zcr_factor = min(1.0, self.zero_crossing_rate * 15)
        return (centroid_factor * 0.5 + zcr_factor * 0.5)

    @property
    def wetness_score(self) -> float:
        """0–1: spectral flatness proxy for the 'wet' quality."""
        return min(1.0, self.spectral_flatness * 3.0)


def compute_fingerprint(
    audio: np.ndarray,
    sample_rate: int,
    n_mfcc: int = 13,
) -> FartFingerprint:
    """
    Compute a complete scientific fingerprint from audio data.

    Args:
        audio: Float32 audio array (mono)
        sample_rate: Sample rate in Hz
        n_mfcc: Number of MFCC coefficients (default 13)

    Returns:
        FartFingerprint with all features populated.
    """
    try:
        import librosa
        import librosa.feature
        _LIBROSA_AVAILABLE = True
    except ImportError:
        _LIBROSA_AVAILABLE = False

    if not _LIBROSA_AVAILABLE:
        # Fallback: compute basic stats without librosa
        return _fallback_fingerprint(audio, sample_rate)

    # Ensure mono float32
    audio = audio.astype(np.float32)
    if audio.ndim > 1:
        audio = audio.mean(axis=1)

    duration_ms = int(len(audio) / sample_rate * 1000)

    # ── MFCCs ─────────────────────────────────────────────────────────────
    mfccs = librosa.feature.mfcc(y=audio, sr=sample_rate, n_mfcc=n_mfcc)
    mfcc_delta = librosa.feature.delta(mfccs)

    mfcc_mean = mfccs.mean(axis=1).tolist()
    mfcc_std = mfccs.std(axis=1).tolist()
    mfcc_delta_mean = mfcc_delta.mean(axis=1).tolist()

    # ── Spectral features ─────────────────────────────────────────────────
    centroid = librosa.feature.spectral_centroid(y=audio, sr=sample_rate)
    bandwidth = librosa.feature.spectral_bandwidth(y=audio, sr=sample_rate)
    rolloff = librosa.feature.spectral_rolloff(y=audio, sr=sample_rate, roll_percent=0.85)
    flatness = librosa.feature.spectral_flatness(y=audio)
    contrast = librosa.feature.spectral_contrast(y=audio, sr=sample_rate)

    # ── Temporal ──────────────────────────────────────────────────────────
    zcr = librosa.feature.zero_crossing_rate(audio)
    rms = librosa.feature.rms(y=audio)

    # ── Rhythm ────────────────────────────────────────────────────────────
    try:
        tempo, _ = librosa.beat.beat_track(y=audio, sr=sample_rate)
        tempo_bpm = float(tempo[0]) if hasattr(tempo, "__len__") else float(tempo)
    except Exception:
        tempo_bpm = 0.0

    onset_frames = librosa.onset.onset_detect(y=audio, sr=sample_rate)
    onset_count = len(onset_frames)

    # ── Loudness (A-weighted approximation) ───────────────────────────────
    rms_val = float(rms.mean())
    loudness_lufs = 20 * np.log10(rms_val + 1e-9)  # dBFS approximation

    return FartFingerprint(
        mfcc_mean=mfcc_mean,
        mfcc_std=mfcc_std,
        mfcc_delta_mean=mfcc_delta_mean,
        spectral_centroid=float(centroid.mean()),
        spectral_bandwidth=float(bandwidth.mean()),
        spectral_rolloff=float(rolloff.mean()),
        spectral_flatness=float(flatness.mean()),
        spectral_contrast=contrast.mean(axis=1).tolist(),
        zero_crossing_rate=float(zcr.mean()),
        rms_energy=rms_val,
        duration_ms=duration_ms,
        tempo_bpm=tempo_bpm,
        onset_count=onset_count,
        loudness_lufs=loudness_lufs,
    )


def _fallback_fingerprint(audio: np.ndarray, sample_rate: int) -> FartFingerprint:
    """
    Pure-numpy fingerprint when librosa is not installed.
    Less scientifically rigorous but still functional.
    """
    duration_ms = int(len(audio) / sample_rate * 1000)

    # RMS
    rms = float(np.sqrt(np.mean(audio**2)))

    # Zero crossing rate
    zcr = float(np.mean(np.abs(np.diff(np.sign(audio))) / 2))

    # FFT for spectral features
    fft = np.fft.rfft(audio)
    freqs = np.fft.rfftfreq(len(audio), d=1 / sample_rate)
    magnitude = np.abs(fft)
    total_power = magnitude.sum() + 1e-9

    # Spectral centroid
    centroid = float(np.sum(freqs * magnitude) / total_power)

    # Spectral rolloff (85%)
    cumulative = np.cumsum(magnitude)
    rolloff_idx = np.searchsorted(cumulative, 0.85 * cumulative[-1])
    rolloff = float(freqs[min(rolloff_idx, len(freqs) - 1)])

    # Spectral flatness (geometric mean / arithmetic mean of magnitude)
    log_mag = np.log(magnitude + 1e-9)
    geo_mean = np.exp(log_mag.mean())
    arith_mean = magnitude.mean() + 1e-9
    flatness = float(geo_mean / arith_mean)

    # Fake 13 MFCCs from FFT bands
    n_mfcc = 13
    band_size = len(magnitude) // n_mfcc
    mfcc_mean = [
        float(magnitude[i * band_size : (i + 1) * band_size].mean())
        for i in range(n_mfcc)
    ]

    return FartFingerprint(
        mfcc_mean=mfcc_mean,
        mfcc_std=[0.0] * n_mfcc,
        mfcc_delta_mean=[0.0] * n_mfcc,
        spectral_centroid=centroid,
        spectral_bandwidth=centroid * 0.5,
        spectral_rolloff=rolloff,
        spectral_flatness=flatness,
        spectral_contrast=[0.0] * 7,
        zero_crossing_rate=zcr,
        rms_energy=rms,
        duration_ms=duration_ms,
        tempo_bpm=0.0,
        onset_count=0,
        loudness_lufs=20 * np.log10(rms + 1e-9),
    )
