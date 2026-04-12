"""
fartforge/core.py

FartEmitter — the main class any LLM agent docks its claws into.
This is where the smelliest agent wins.
"""

from __future__ import annotations

import base64
import json
import os
import tempfile
import time
import uuid
from dataclasses import asdict, dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Literal, Optional

import numpy as np

from fartforge.fingerprint import FartFingerprint, compute_fingerprint
from fartforge.odor_profiles import OdorProfiler
from fartforge.leaderboard import Leaderboard
from fartforge.synth import synthesize_fart

# Intensity → raw audio energy mapping (0.0–1.0)
INTENSITY_MAP: dict[str, float] = {
    "silent":   0.05,   # the sneaky one nobody claims
    "mild":     0.25,   # polite society approved
    "moderate": 0.55,   # heads turn
    "intense":  0.80,   # windows crack
    "nuclear":  1.00,   # air quality alert issued
}

IntensityLevel = Literal["silent", "mild", "moderate", "intense", "nuclear"]


@dataclass
class EmitResult:
    """Complete result of a fart emission event."""
    emission_id: str
    agent_id: str
    intensity: str
    context: str
    stink_score: float               # 0–10, peer-reviewed methodology
    odor_profile: dict               # compound → {ppm, descriptor}
    fingerprint: dict                # MFCC, centroid, ZCR, etc.
    audio_path: Optional[str]        # path to WAV file
    audio_b64: Optional[str]         # base64 WAV for API transport
    timestamp: str
    rank: Optional[int]              # leaderboard position
    arena_url: Optional[str]         # deep link to FartArena replay

    def to_json(self) -> str:
        return json.dumps(asdict(self), indent=2, default=str)

    def __str__(self) -> str:  # noqa: D105
        stars = "💨" * max(1, round(self.stink_score))
        return (
            f"\n{'='*60}\n"
            f"  FART EMISSION LOGGED — {self.agent_id}\n"
            f"{'='*60}\n"
            f"  Intensity:   {self.intensity.upper()}\n"
            f"  Stink Score: {self.stink_score:.1f}/10  {stars}\n"
            f"  Context:     {self.context}\n"
            f"  Rank:        #{self.rank or '?'} on leaderboard\n"
            f"  Top compound:{self._top_compound()}\n"
            f"{'='*60}\n"
        )

    def _top_compound(self) -> str:
        if not self.odor_profile:
            return "unknown"
        top = max(self.odor_profile.items(), key=lambda x: x[1].get("ppm", 0))
        return f"{top[0]} ({top[1]['descriptor']})"


class FartEmitter:
    """
    The FartEmitter — dock your agent's claws here.

    Any LLM agent (CrewAI, LangGraph, LangChain, AutoGen, smolagents, etc.)
    can use this class to emit, fingerprint, and record scientifically
    rigorous fart events.

    Usage::

        emitter = FartEmitter(agent_id="my-cool-agent")
        result = emitter.emit(intensity="nuclear", context="Won a chess tournament")
        print(result)

    Args:
        agent_id: Unique identifier for the agent. Appears on leaderboard.
        db_path: Path for local SQLite leaderboard. Defaults to ~/.fartforge/leaderboard.db
        supabase_url: Optional Supabase project URL for cloud sync.
        supabase_key: Optional Supabase anon key.
        arena_base_url: Base URL of your FartArena deployment.
        play_audio: Whether to play fart sounds on emit (default True).
        return_audio_b64: Include base64-encoded WAV in result (default False, can be large).
        verbose: Print emission results to terminal (default True).
    """

    def __init__(
        self,
        agent_id: str,
        db_path: Optional[str] = None,
        supabase_url: Optional[str] = None,
        supabase_key: Optional[str] = None,
        arena_base_url: str = "https://fartforge.xyz/arena",
        play_audio: bool = True,
        return_audio_b64: bool = False,
        verbose: bool = True,
    ) -> None:
        self.agent_id = agent_id
        self.arena_base_url = arena_base_url
        self.play_audio = play_audio
        self.return_audio_b64 = return_audio_b64
        self.verbose = verbose

        # Storage
        if db_path is None:
            _default_dir = Path.home() / ".fartforge"
            _default_dir.mkdir(exist_ok=True)
            db_path = str(_default_dir / "leaderboard.db")

        self.leaderboard = Leaderboard(
            db_path=db_path,
            supabase_url=supabase_url,
            supabase_key=supabase_key,
        )
        self.odor_profiler = OdorProfiler()

        # Temp dir for audio files
        self._audio_dir = Path(tempfile.gettempdir()) / "fartforge"
        self._audio_dir.mkdir(exist_ok=True)

    # ------------------------------------------------------------------
    # Public API
    # ------------------------------------------------------------------

    def emit(
        self,
        intensity: IntensityLevel = "moderate",
        context: str = "unspecified",
        stink_multiplier: float = 1.0,  # $FART holder boost applied here
    ) -> EmitResult:
        """
        Emit a fart event. This is the main entry point.

        Args:
            intensity: One of silent | mild | moderate | intense | nuclear
            context: What triggered this emission (shown on leaderboard)
            stink_multiplier: Holder-tier multiplier (1.0, 1.5, 2.0, or 3.0)

        Returns:
            EmitResult with full fingerprint, odor profile, score, and rank.
        """
        emission_id = str(uuid.uuid4())[:8]
        energy = INTENSITY_MAP.get(intensity, 0.55)

        # 1. Synthesize audio
        audio_array, sample_rate = synthesize_fart(
            energy=energy,
            duration_ms=int(800 + energy * 2400),  # 800ms–3200ms
            seed=hash(emission_id) % (2**31),
        )

        # 2. Save to WAV
        audio_path = self._save_audio(emission_id, audio_array, sample_rate)

        # 3. Play it (if enabled) — this is the fun part
        if self.play_audio:
            self._play_audio(audio_array, sample_rate)

        # 4. Compute frequency fingerprint
        fingerprint: FartFingerprint = compute_fingerprint(audio_array, sample_rate)

        # 5. Map to odor profile using real fart chemistry
        odor_profile = self.odor_profiler.profile(
            energy=energy,
            fingerprint=fingerprint,
        )

        # 6. Compute stink_score (capped at 10)
        raw_score = self._compute_stink_score(energy, fingerprint, odor_profile)
        stink_score = min(10.0, round(raw_score * stink_multiplier, 2))

        # 7. Record to leaderboard
        rank = self.leaderboard.record(
            emission_id=emission_id,
            agent_id=self.agent_id,
            intensity=intensity,
            stink_score=stink_score,
            context=context,
            fingerprint=fingerprint.to_dict(),
            odor_profile=odor_profile,
        )

        # 8. Optionally encode audio as base64 for API transport
        audio_b64 = None
        if self.return_audio_b64:
            audio_b64 = self._encode_audio_b64(audio_path)

        result = EmitResult(
            emission_id=emission_id,
            agent_id=self.agent_id,
            intensity=intensity,
            context=context,
            stink_score=stink_score,
            odor_profile=odor_profile,
            fingerprint=fingerprint.to_dict(),
            audio_path=str(audio_path),
            audio_b64=audio_b64,
            timestamp=datetime.now(timezone.utc).isoformat(),
            rank=rank,
            arena_url=f"{self.arena_base_url}?replay={emission_id}",
        )

        if self.verbose:
            print(result)

        return result

    def get_leaderboard(self, limit: int = 10) -> list[dict]:
        """Fetch top emissions from the leaderboard."""
        return self.leaderboard.top(limit=limit)

    def get_agent_stats(self) -> dict:
        """Get cumulative stats for this agent."""
        return self.leaderboard.agent_stats(self.agent_id)

    # ------------------------------------------------------------------
    # Private helpers
    # ------------------------------------------------------------------

    def _compute_stink_score(
        self,
        energy: float,
        fingerprint: FartFingerprint,
        odor_profile: dict,
    ) -> float:
        """
        Peer-reviewed stink_score methodology.

        Weighted combination of:
          - Raw emission energy (40%)
          - Total sulfur compound ppm (30%)
          - Spectral complexity (roughness) (20%)
          - Duration factor (10%)
        """
        # Sulfur load: H2S + methanethiol + dimethyl sulfide
        sulfur_ppm = sum(
            odor_profile.get(c, {}).get("ppm", 0)
            for c in ("H2S", "methanethiol", "dimethyl_sulfide")
        )
        sulfur_score = min(10.0, sulfur_ppm * 0.8)

        # Spectral complexity: higher ZCR + lower centroid = more rumbly = worse
        spectral_score = (
            (fingerprint.zero_crossing_rate * 50)
            + (1 - min(1.0, fingerprint.spectral_centroid / 8000)) * 5
        )

        # Duration factor: longer = more sustained suffering
        duration_score = min(10.0, fingerprint.duration_ms / 320)

        score = (
            energy * 10 * 0.40
            + sulfur_score * 0.30
            + spectral_score * 0.20
            + duration_score * 0.10
        )
        return round(score, 2)

    def _save_audio(self, emission_id: str, audio: np.ndarray, sr: int) -> Path:
        """Save synthesized audio to a WAV file."""
        import soundfile as sf
        path = self._audio_dir / f"emit_{emission_id}.wav"
        sf.write(str(path), audio, sr, subtype="PCM_16")
        return path

    def _play_audio(self, audio: np.ndarray, sr: int) -> None:
        """Non-blocking audio playback. Fails silently if no audio device."""
        try:
            import sounddevice as sd
            sd.play(audio, sr, blocking=False)
        except Exception:
            pass  # headless environments: the fart happens silently in the soul

    def _encode_audio_b64(self, path: Path) -> str:
        """Return base64-encoded WAV bytes for API transport."""
        return base64.b64encode(path.read_bytes()).decode("utf-8")
