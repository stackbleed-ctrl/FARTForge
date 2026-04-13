"""
FARTForge — Pluggable Pipeline Interfaces
==========================================
Four clean ABCs.  Implement them; plug them in.

    Generator  →  Extractor  →  Scorer  →  Validator
       ↓               ↓            ↓           ↓
   raw output      features      score      gate/reject

v2: Added version property to all components for pipeline introspection
    and debugging ("which scorer version produced this event?").
"""

from __future__ import annotations

from abc import ABC, abstractmethod
from typing import Any

from .event import Event, ScoreBreakdown


# ─────────────────────────────────────────────────────────────────────────────
# 1. Generator
# ─────────────────────────────────────────────────────────────────────────────

class Generator(ABC):
    """Produces an artifact from an input dict."""

    @abstractmethod
    def generate(self, input: dict[str, Any]) -> Any: ...

    @property
    def artifact_type(self) -> str:
        return "generic"

    @property
    def version(self) -> str:
        """Override in subclasses to track which version produced an artifact."""
        return "1.0.0"


# ─────────────────────────────────────────────────────────────────────────────
# 2. Extractor
# ─────────────────────────────────────────────────────────────────────────────

class Extractor(ABC):
    """Extracts measurable features from a raw artifact."""

    @abstractmethod
    def extract(self, artifact: Any) -> dict[str, Any]: ...

    @property
    def version(self) -> str:
        return "1.0.0"


# ─────────────────────────────────────────────────────────────────────────────
# 3. Scorer
# ─────────────────────────────────────────────────────────────────────────────

class Scorer(ABC):
    """Produces a multi-dimensional score from features."""

    @abstractmethod
    def score(self, features: dict[str, Any]) -> ScoreBreakdown: ...

    @property
    def dimensions(self) -> list[str]:
        return []

    @property
    def version(self) -> str:
        return "1.0.0"


# ─────────────────────────────────────────────────────────────────────────────
# 4. Validator
# ─────────────────────────────────────────────────────────────────────────────

class Validator(ABC):
    """Binary gate: accept or reject an Event before storage."""

    @abstractmethod
    def validate(self, event: Event) -> bool: ...

    @property
    def name(self) -> str:
        return self.__class__.__name__


# ─────────────────────────────────────────────────────────────────────────────
# Composite validator
# ─────────────────────────────────────────────────────────────────────────────

class ValidatorChain(Validator):
    """Run multiple validators in order.  All must pass."""

    def __init__(self, validators: list[Validator]):
        self._validators = validators

    def validate(self, event: Event) -> bool:
        for v in self._validators:
            if not v.validate(event):
                return False
        return True

    @property
    def name(self) -> str:
        return f"Chain({', '.join(v.name for v in self._validators)})"


# ─────────────────────────────────────────────────────────────────────────────
# Bundled validators
# ─────────────────────────────────────────────────────────────────────────────

class SchemaValidator(Validator):
    """Ensures required fields are non-empty."""

    REQUIRED = ("event_id", "agent_id", "event_type", "timestamp")

    def validate(self, event: Event) -> bool:
        return all(getattr(event, f, None) for f in self.REQUIRED)


class HashValidator(Validator):
    """Recomputes hash and checks it matches stored value."""

    def validate(self, event: Event) -> bool:
        return event.verify()


class ScoreThresholdValidator(Validator):
    """Rejects events whose final score is below a minimum."""

    def __init__(self, minimum: float = 0.0):
        self.minimum = minimum

    def validate(self, event: Event) -> bool:
        if event.score is None:
            return True
        return event.score.final >= self.minimum


class ScoreValidator(Validator):
    """
    Validates that the score's dimensions are in [0, 1] and weights sum to 1.
    Rejects events with invalid scoring configurations.
    """

    def validate(self, event: Event) -> bool:
        if event.score is None:
            return True
        try:
            event.score.validate()
            return True
        except ValueError:
            return False
