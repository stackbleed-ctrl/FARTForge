# fartforge/human_analyzer.py
"""
Human Anal-yzer™ — Record your human's farts. Get science.

Real librosa-based acoustic analysis → pseudo-scientific odor fingerprint.
Based on actual flatology research:
  - Fart fundamentals: 200–300 Hz (sphincter vibration, tiny trombone)
  - Odd harmonics: ~750 Hz, ~1250 Hz etc.
  - Silent-but-deadly = low energy + long duration + high sulfur proxy
  - Loud = volume/CH4/CO2 dominated, less H2S per unit volume
"""

import os
import tempfile
from typing import Any, Dict

import librosa
import numpy as np


class HumanAnalyzer:
    """
    Anal-yze a real human fart audio file.

    Record via browser MediaRecorder (Next.js) or mobile mic, upload as WAV/MP3/OGG.
    Returns full sound profile, pseudo-odor fingerprint, stink_score, and leaderboard entry.

    Usage:
        analyzer = HumanAnalyzer()
        result = analyzer.analyze_fart("my_rip.wav", intensity_boost=1)
        print(result["summary"])
    """

    # Compound database — mirrors core.py
    COMPOUND_DB = {
        "H2S":            {"name": "Hydrogen Sulfide",  "formula": "H₂S",       "color_hex": "#FFD700", "descriptor": "rotten eggs, volcanic sulfur",    "max_ppm": 12.0},
        "methanethiol":   {"name": "Methanethiol",       "formula": "CH₃SH",     "color_hex": "#90EE90", "descriptor": "rotten cabbage, swamp gas",        "max_ppm": 4.0},
        "dimethyl_sulfide":{"name": "Dimethyl Sulfide",  "formula": "(CH₃)₂S",   "color_hex": "#87CEEB", "descriptor": "cooked cabbage, marine",           "max_ppm": 1.5},
        "indole":         {"name": "Indole",              "formula": "C₈H₇N",     "color_hex": "#9B59B6", "descriptor": "fecal, paradoxically floral",      "max_ppm": 0.5},
        "skatole":        {"name": "Skatole",             "formula": "C₉H₉N",     "color_hex": "#8B4513", "descriptor": "mothballs, barnyard intensity",    "max_ppm": 0.3},
        "methane":        {"name": "Methane",             "formula": "CH₄",       "color_hex": "#87CEEB", "descriptor": "odorless but flammable",           "max_ppm": 600.0},
        "CO2":            {"name": "Carbon Dioxide",      "formula": "CO₂",       "color_hex": "#D3D3D3", "descriptor": "odorless, volume driver",          "max_ppm": 5000.0},
    }

    def analyze_fart(self, audio_path: str, intensity_boost: int = 0) -> Dict[str, Any]:
        """
        Analyze a fart audio file and return a full scientific profile.

        Args:
            audio_path: Path to WAV/MP3/OGG file.
            intensity_boost: Add 0–3 to stink_score for spicy meals, etc.

        Returns:
            Dict with sound_profile, odor_profile, stink_score, summary.
        """
        y, sr = librosa.load(audio_path, sr=None)  # keep native sample rate

        # ── Core acoustic features ────────────────────────────────────────
        duration        = librosa.get_duration(y=y, sr=sr)
        rms_energy      = float(np.mean(librosa.feature.rms(y=y)))
        spec_centroid   = float(np.mean(librosa.feature.spectral_centroid(y=y, sr=sr)))
        spec_bandwidth  = float(np.mean(librosa.feature.spectral_bandwidth(y=y, sr=sr)))
        spec_flatness   = float(np.mean(librosa.feature.spectral_flatness(y=y)))
        zcr             = float(np.mean(librosa.feature.zero_crossing_rate(y)))
        mfcc            = np.mean(librosa.feature.mfcc(y=y, sr=sr, n_mfcc=13), axis=1)

        # Fundamental pitch estimate (50–2000 Hz range covers sphincter fundamentals)
        pitch_raw = librosa.yin(y, fmin=50, fmax=2000, sr=sr)
        avg_pitch = float(np.median(pitch_raw[pitch_raw > 50])) if np.any(pitch_raw > 50) else 0.0

        # Low-frequency energy (< ~500 Hz proxy) — rumble / volume
        fft_mag   = np.abs(np.fft.rfft(y))
        fft_freqs = np.fft.rfftfreq(len(y), d=1.0 / sr)
        low_mask  = fft_freqs < 500
        high_mask = fft_freqs > 2000
        low_energy_ratio  = float(np.mean(fft_mag[low_mask]))  / (float(np.mean(fft_mag)) + 1e-9)
        high_energy_ratio = float(np.mean(fft_mag[high_mask])) / (float(np.mean(fft_mag)) + 1e-9)

        # Wetness proxy — flat spectrum + medium energy = wet/splashy
        wetness_score = min(1.0, spec_flatness * 4.0 + (0.2 if rms_energy > 0.05 else 0.0))

        # ── Odor mapping (pseudo-science, grounded in sulfur chemistry) ──
        # Silent-but-deadly: long + quiet + low centroid → concentrated sulfurs
        sbd_factor  = (duration / 3.0) * (1.0 - min(1.0, rms_energy * 10))
        # Thunderous blast: high energy + low centroid → volume/CH4 dominant
        blast_factor = min(1.0, rms_energy * 8) * low_energy_ratio

        h2s_ppm           = min(12.0,  (0.3 + sbd_factor * 4.0  + (1.0 - spec_centroid / 5000) * 2.0) * (0.8 + spec_flatness))
        methanethiol_ppm  = min(4.0,   (0.05 + sbd_factor * 2.0 + wetness_score * 0.5))
        dms_ppm           = min(1.5,   (0.02 + high_energy_ratio * 0.8))
        indole_ppm        = min(0.5,   (0.002 + wetness_score * 0.1 + zcr * 0.3))
        skatole_ppm       = min(0.3,   (0.001 + wetness_score * 0.06))
        methane_ppm       = min(600.0, (100 + blast_factor * 400))
        co2_ppm           = min(5000.0,(1000 + blast_factor * 3000))

        odor_profile = {
            "H2S":             self._compound_entry("H2S",             h2s_ppm),
            "methanethiol":    self._compound_entry("methanethiol",    methanethiol_ppm),
            "dimethyl_sulfide":self._compound_entry("dimethyl_sulfide",dms_ppm),
            "indole":          self._compound_entry("indole",          indole_ppm),
            "skatole":         self._compound_entry("skatole",         skatole_ppm),
            "methane":         self._compound_entry("methane",         methane_ppm),
            "CO2":             self._compound_entry("CO2",             co2_ppm),
        }

        # ── Stink score (0–10) ────────────────────────────────────────────
        sulfur_load  = min(10.0, (h2s_ppm * 0.6 + methanethiol_ppm * 0.8 + dms_ppm * 0.4))
        energy_score = min(10.0, rms_energy * 60)
        duration_score = min(10.0, duration * 2.5)
        centroid_score = min(10.0, (1.0 - min(1.0, spec_centroid / 4000)) * 10)

        raw_score  = (sulfur_load * 0.45 + energy_score * 0.25 + duration_score * 0.15 + centroid_score * 0.15)
        stink_score = round(min(10.0, max(0.0, raw_score + intensity_boost)), 1)

        # ── Archetype classification ───────────────────────────────────────
        if duration > 2.5 and rms_energy < 0.025:
            archetype = "Silent But Deadly"
            archetype_desc = "Low energy, long duration → concentrated sulfur profile. The deadly kind."
        elif spec_centroid < 220 and rms_energy > 0.04:
            archetype = "Bass Cannon"
            archetype_desc = "Deep sub-200Hz fundamental. Maximum rumble energy. Your furniture moved."
        elif spec_centroid > 500 and zcr > 0.12:
            archetype = "Squeaky Sulfur Dart"
            archetype_desc = "High-pitched overtone-heavy emission. Sharp H₂S attack vector."
        elif wetness_score > 0.5:
            archetype = "Wet Chaos"
            archetype_desc = "Broad flat spectrum → splashy profile. Indole/skatole elevated. God help us."
        elif duration < 0.5:
            archetype = "Micro-Rip"
            archetype_desc = "Brief but aggressive. Single-note sphincter ping. Scorpion strike."
        else:
            archetype = "Classic Trombone Toot"
            archetype_desc = "Textbook 200–300Hz fundamental with clean harmonics. A balanced emission."

        # ── Human-readable summary ────────────────────────────────────────
        summary = (
            f"{duration:.1f}s · {stink_score}/10 stink · [{archetype}] — {archetype_desc}"
        )

        return {
            "source": "human",
            "archetype": archetype,
            "stink_score": stink_score,
            "summary": summary,
            "sound_profile": {
                "duration_seconds":    round(duration, 3),
                "peak_energy_rms":     round(rms_energy, 5),
                "spectral_centroid_hz":round(spec_centroid, 1),
                "spectral_bandwidth_hz":round(spec_bandwidth, 1),
                "spectral_flatness":   round(spec_flatness, 5),
                "zero_crossing_rate":  round(zcr, 5),
                "avg_pitch_hz":        round(avg_pitch, 1),
                "low_energy_ratio":    round(low_energy_ratio, 4),
                "high_energy_ratio":   round(high_energy_ratio, 4),
                "wetness_score":       round(wetness_score, 3),
                "sample_rate_hz":      sr,
                "mfcc_mean":           [round(float(x), 3) for x in mfcc],
            },
            "odor_profile": odor_profile,
            "leaderboard_eligible": True,
        }

    def from_bytes(self, audio_bytes: bytes, suffix: str = ".wav", intensity_boost: int = 0) -> Dict[str, Any]:
        """Analyze fart audio from raw bytes (e.g. from a FastAPI upload or Next.js API route)."""
        with tempfile.NamedTemporaryFile(suffix=suffix, delete=False) as tmp:
            tmp.write(audio_bytes)
            tmp_path = tmp.name
        try:
            return self.analyze_fart(tmp_path, intensity_boost=intensity_boost)
        finally:
            os.unlink(tmp_path)

    def _compound_entry(self, key: str, ppm: float) -> Dict[str, Any]:
        db = self.COMPOUND_DB[key]
        return {
            "ppm":         round(ppm, 5),
            "name":        db["name"],
            "formula":     db["formula"],
            "color_hex":   db["color_hex"],
            "descriptor":  db["descriptor"],
        }
