"""
FARTForge — Canonical Event Schema
===================================
The immutable, hashable, signable unit of truth.
Every agent interaction collapses into one of these.

v2 hardening:
  - ScoreBreakdown enforces weight sum == 1.0 in __post_init__
  - ScoreBreakdown.validate() checks dimension bounds [0, 1]
  - Event.__setattr__ enforces immutability after lock
  - trace_id field for multi-event correlation
"""

from __future__ import annotations

import hashlib
import json
import uuid
import warnings
from dataclasses import dataclass, field, asdict
from datetime import datetime, timezone
from typing import Any, Optional

SCHEMA_VERSION = "2.0.0"

_WEIGHT_TOLERANCE = 1e-6


@dataclass
class ScoreBreakdown:
    """
    Multi-dimensional score.  Weights MUST sum to 1.0.

    Enforced at construction time — a misconfigured scorer will
    fail fast rather than silently corrupt leaderboard rankings.
    """

    dimensions: dict[str, float]
    weights:    dict[str, float]

    def __post_init__(self) -> None:
        if not self.weights:
            return
        total = sum(self.weights.values())
        if abs(total - 1.0) > _WEIGHT_TOLERANCE:
            raise ValueError(
                f"ScoreBreakdown weights must sum to 1.0, got {total:.6f}. "
                f"Weights: {self.weights}"
            )

    def validate(self) -> None:
        """
        Strict validation — call before persisting to a leaderboard.

        Raises
        ------
        ValueError
            If any dimension value is outside [0.0, 1.0].
        """
        self.__post_init__()  # re-check weights
        for dim, val in self.dimensions.items():
            if not (0.0 <= val <= 1.0):
                raise ValueError(
                    f"Dimension '{dim}' = {val} is outside [0, 1]. "
                    "Normalise your scorer outputs before scoring."
                )

    @property
    def final(self) -> float:
        """Weighted composite score, normalised to [0, 1]."""
        if not self.dimensions or not self.weights:
            return 0.0
        total_weight = sum(self.weights.get(k, 0) for k in self.dimensions)
        if total_weight == 0:
            return 0.0
        return sum(
            self.dimensions[k] * self.weights.get(k, 0)
            for k in self.dimensions
        ) / total_weight

    def top_dimension(self) -> Optional[str]:
        """Return the dimension with the highest weighted contribution."""
        if not self.dimensions:
            return None
        return max(
            self.dimensions,
            key=lambda k: self.dimensions[k] * self.weights.get(k, 0),
        )

    def to_dict(self) -> dict:
        return {
            "dimensions":     self.dimensions,
            "weights":        self.weights,
            "final":          self.final,
            "top_dimension":  self.top_dimension(),
        }


@dataclass
class Event:
    """
    The canonical unit of agent evaluation.

    Rules
    -----
    - Never mutate after compute_hash() is called (_locked = True).
    - raw_artifact_path should be set before long-term storage.
    - signature is optional; set it with TrustLayer.sign().
    - trace_id links related events across a single agent session.
    """

    # ── Identity ──────────────────────────────────────────────────────────────
    event_id:   str = field(default_factory=lambda: str(uuid.uuid4()))
    trace_id:   str = field(default_factory=lambda: str(uuid.uuid4()))
    agent_id:   str = ""
    event_type: str = "generic"

    # ── Data ──────────────────────────────────────────────────────────────────
    input:    dict[str, Any] = field(default_factory=dict)
    output:   dict[str, Any] = field(default_factory=dict)
    features: dict[str, Any] = field(default_factory=dict)

    # ── Scoring ───────────────────────────────────────────────────────────────
    score: Optional[ScoreBreakdown] = None

    # ── Context ───────────────────────────────────────────────────────────────
    metadata: dict[str, Any] = field(default_factory=dict)

    # ── Provenance ────────────────────────────────────────────────────────────
    timestamp:         str = field(default_factory=lambda: datetime.now(timezone.utc).isoformat())
    version:           str = SCHEMA_VERSION
    raw_artifact_path: Optional[str] = None

    # ── Integrity ─────────────────────────────────────────────────────────────
    event_hash: str           = ""
    signature:  Optional[str] = None

    # ── Internal ──────────────────────────────────────────────────────────────
    _locked: bool = field(default=False, repr=False, compare=False)

    # ─────────────────────────────────────────────────────────────────────────

    def __setattr__(self, name: str, value: Any) -> None:
        if getattr(self, "_locked", False) and name not in ("_locked", "signature"):
            raise AttributeError(
                f"Event is locked after compute_hash(). "
                f"Cannot set '{name}'. Create a new Event."
            )
        super().__setattr__(name, value)

    def compute_hash(self) -> str:
        """
        Deterministic SHA-256 over the event's immutable fields.
        Sets self.event_hash and locks the event.
        """
        payload = {
            "event_id":   self.event_id,
            "trace_id":   self.trace_id,
            "agent_id":   self.agent_id,
            "event_type": self.event_type,
            "input":      self.input,
            "output":     self.output,
            "features":   self.features,
            "score":      self.score.to_dict() if self.score else None,
            "metadata":   self.metadata,
            "timestamp":  self.timestamp,
            "version":    self.version,
        }
        h = hashlib.sha256(
            json.dumps(payload, sort_keys=True, default=str).encode()
        ).hexdigest()
        # Bypass lock to set hash + lock
        super().__setattr__("event_hash", h)
        super().__setattr__("_locked", True)
        return h

    def verify(self) -> bool:
        """Re-compute hash and compare. Returns False if tampered."""
        if not self.event_hash:
            return False
        saved = self.event_hash
        super().__setattr__("_locked", False)
        recomputed = self.compute_hash()
        return recomputed == saved

    def to_dict(self) -> dict:
        d = asdict(self)
        d.pop("_locked", None)
        if self.score:
            d["score"] = self.score.to_dict()
        return d

    def to_json(self, indent: int = 2) -> str:
        return json.dumps(self.to_dict(), indent=indent, default=str)

    @classmethod
    def from_dict(cls, data: dict) -> "Event":
        score_data = data.pop("score", None)
        data.pop("_locked", None)
        valid_fields = {k for k in cls.__dataclass_fields__ if k != "_locked"}
        event = cls(**{k: v for k, v in data.items() if k in valid_fields})
        if score_data and isinstance(score_data, dict):
            event.score = ScoreBreakdown(
                dimensions=score_data.get("dimensions", {}),
                weights=score_data.get("weights", {}),
            )
        return event
