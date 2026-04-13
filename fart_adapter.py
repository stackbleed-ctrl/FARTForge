"""
FARTForge — FartAdapter
========================
Bridges your existing FartEmitter into the serious pipeline.

You don't replace your system — you level it up.

    from fartforge.adapters.fart_adapter import FartAdapter
    from fartforge.emitter.core import EventEmitter

    adapter = FartAdapter()

    emitter = EventEmitter(
        agent_id   = "fartbot-v3",
        event_type = "audio",
        generator  = adapter,
        extractor  = adapter,
        scorer     = adapter,
    )

    result = emitter.emit({"intensity": 9, "moisture": 0.3})
    print(result.event.score.final)   # → 0.73
    print(result.event.event_hash)    # → sha256 fingerprint

After this, fart mode is just one plugin. Serious mode is everything else.
"""

from __future__ import annotations

import math
from typing import Any, Optional

from ..emitter.pipeline import Generator, Extractor, Scorer
from ..emitter.event import ScoreBreakdown


# ─────────────────────────────────────────────────────────────────────────────
# Mock emitter (used when no real FartEmitter is wired in)
# ─────────────────────────────────────────────────────────────────────────────

class _MockFartEmitter:
    """Stand-in when the real FartEmitter hasn't been wired in."""

    def emit(self, **kwargs) -> dict:
        intensity  = kwargs.get("intensity", 5)
        moisture   = kwargs.get("moisture", 0.5)
        frequency  = 80 + intensity * 20
        amplitude  = intensity * 10
        duration   = 0.5 + moisture * 2.0
        stink      = intensity * 0.1 * (1 + moisture)
        return {
            "frequency_hz": frequency,
            "amplitude_db": amplitude,
            "duration_s":   duration,
            "stink_index":  stink,
            "moisture":     moisture,
            "intensity":    intensity,
            "waveform":     b"\x00" * int(frequency * duration),
        }


# ─────────────────────────────────────────────────────────────────────────────
# FartAdapter
# ─────────────────────────────────────────────────────────────────────────────

class FartAdapter(Generator, Extractor, Scorer):
    """
    Adapts FartEmitter into the three serious pipeline roles.

    Parameters
    ----------
    fart_emitter : any, optional
        Your existing FartEmitter.  Must have emit(**kwargs) → dict.
        Defaults to MockFartEmitter.
    score_weights : dict, optional
        Weights for the ScoreBreakdown.  Must sum to 1.0.
    """

    DEFAULT_WEIGHTS = {
        "potency":      0.35,
        "duration":     0.20,
        "frequency":    0.15,
        "moisture":     0.15,
        "authenticity": 0.15,
    }

    def __init__(
        self,
        fart_emitter:  Optional[Any]   = None,
        score_weights: Optional[dict]  = None,
    ):
        self._emitter = fart_emitter or _MockFartEmitter()
        self._weights = score_weights or self.DEFAULT_WEIGHTS

    @property
    def version(self) -> str:
        return "2.0.0"

    @property
    def artifact_type(self) -> str:
        return "audio"

    # ── Generator ─────────────────────────────────────────────────────────────

    def generate(self, input: dict) -> dict:
        return self._emitter.emit(**input)

    # ── Extractor ─────────────────────────────────────────────────────────────

    def extract(self, artifact: dict | Any) -> dict:
        if not isinstance(artifact, dict):
            return {}

        freq_hz   = float(artifact.get("frequency_hz", 100))
        amp_db    = float(artifact.get("amplitude_db", 50))
        duration  = float(artifact.get("duration_s", 1.0))
        stink     = float(artifact.get("stink_index", 0.5))
        moisture  = float(artifact.get("moisture", 0.5))
        intensity = float(artifact.get("intensity", 5))

        return {
            # Raw physical
            "frequency_hz": freq_hz,
            "amplitude_db": amp_db,
            "duration_s":   duration,
            "stink_index":  stink,
            "moisture":     moisture,
            "intensity":    intensity,
            # Normalised [0, 1]
            "potency_norm":      _clamp(stink / 10.0),
            "duration_norm":     _clamp(duration / 5.0),
            "frequency_norm":    _clamp((freq_hz - 20) / 980),
            "amplitude_norm":    _clamp(amp_db / 120.0),
            "moisture_norm":     _clamp(moisture),
            "authenticity":      _authenticity_score(freq_hz, amp_db, duration),
            "spectral_richness": _spectral_richness(freq_hz, amp_db),
        }

    # ── Scorer ────────────────────────────────────────────────────────────────

    @property
    def dimensions(self) -> list[str]:
        return list(self.DEFAULT_WEIGHTS.keys())

    def score(self, features: dict) -> ScoreBreakdown:
        dimensions = {
            "potency":      features.get("potency_norm", 0),
            "duration":     features.get("duration_norm", 0),
            "frequency":    features.get("frequency_norm", 0),
            "moisture":     features.get("moisture_norm", 0),
            "authenticity": features.get("authenticity", 0),
        }
        return ScoreBreakdown(dimensions=dimensions, weights=self._weights)


# ─────────────────────────────────────────────────────────────────────────────
# Helpers
# ─────────────────────────────────────────────────────────────────────────────

def _clamp(v: float, lo: float = 0.0, hi: float = 1.0) -> float:
    return max(lo, min(hi, v))


def _authenticity_score(freq_hz: float, amp_db: float, duration: float) -> float:
    freq_ok     = 1.0 if 60 <= freq_hz  <= 900 else 0.5
    amp_ok      = 1.0 if 20 <= amp_db   <= 110 else 0.5
    duration_ok = 1.0 if 0.1 <= duration <= 8   else 0.5
    return (freq_ok + amp_ok + duration_ok) / 3.0


def _spectral_richness(freq_hz: float, amp_db: float) -> float:
    return _clamp(math.log1p(freq_hz) * amp_db / 1000.0)
