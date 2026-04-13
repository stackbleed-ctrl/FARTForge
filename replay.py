"""
FARTForge — Replay Engine
===========================
Re-run any stored event through a new scorer or extractor.

Key invariant: the ORIGINAL event is NEVER mutated.
Replay always produces a NEW event with a fresh ID + hash.

v2 hardening:
  - Explicit `require_artifact` flag: if True, raises when extractor
    is supplied but no artifact_loader is available.
  - Default: warn (not raise), so existing setups don't break.
  - replay_all() reports individual errors without aborting the batch.
  - trace_id propagation: replayed events inherit the original trace_id.
"""

from __future__ import annotations

import copy
import logging
import uuid
import warnings
from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Any, Callable, Optional

from .event import Event, ScoreBreakdown
from .pipeline import Extractor, Scorer
from .trust import TrustLayer
from .core import EventStore

_log = logging.getLogger("fartforge.replay")


# ─────────────────────────────────────────────────────────────────────────────
# ReplayResult
# ─────────────────────────────────────────────────────────────────────────────

@dataclass
class ReplayResult:
    original_event:     Event
    replayed_event:     Event
    score_delta:        Optional[float]  = None
    feature_delta:      dict[str, float] = field(default_factory=dict)
    changed_dimensions: list[str]        = field(default_factory=list)
    error:              Optional[str]    = None

    @property
    def improved(self) -> Optional[bool]:
        if self.score_delta is None:
            return None
        return self.score_delta > 0

    @property
    def ok(self) -> bool:
        return self.error is None

    def summary(self) -> str:
        lines = [
            f"Event:       {self.original_event.event_id}",
            f"Agent:       {self.original_event.agent_id}",
            f"Score (old): {self._fmt(self.original_event)}",
            f"Score (new): {self._fmt(self.replayed_event)}",
            f"Delta:       {self.score_delta:+.4f}" if self.score_delta is not None else "Delta: N/A",
        ]
        if self.changed_dimensions:
            lines.append(f"Changed:     {', '.join(self.changed_dimensions)}")
        if self.error:
            lines.append(f"Error:       {self.error}")
        return "\n".join(lines)

    @staticmethod
    def _fmt(event: Event) -> str:
        return f"{event.score.final:.4f}" if event.score else "—"


# ─────────────────────────────────────────────────────────────────────────────
# ReplayEngine
# ─────────────────────────────────────────────────────────────────────────────

class ReplayEngine:
    """
    Replay stored events through new pipeline components.

    Parameters
    ----------
    store : EventStore
        Source of original events.
    trust : TrustLayer, optional
        Applied to replayed events.
    artifact_loader : callable, optional
        (event) → raw_artifact.  Required for re-extraction.
        If omitted and an extractor is passed to replay(), behaviour
        depends on `require_artifact`.
    require_artifact : bool
        If True, passing an extractor without an artifact_loader raises.
        If False (default), logs a warning and falls back to stored features.
    """

    def __init__(
        self,
        store:            EventStore,
        trust:            Optional[TrustLayer]             = None,
        artifact_loader:  Optional[Callable[[Event], Any]] = None,
        require_artifact: bool                             = False,
    ):
        self._store            = store
        self._trust            = trust or TrustLayer()
        self._loader           = artifact_loader
        self._require_artifact = require_artifact

    # ── Single replay ─────────────────────────────────────────────────────────

    def replay(
        self,
        event_id:     str,
        scorer:       Optional[Scorer]    = None,
        extractor:    Optional[Extractor] = None,
        new_metadata: Optional[dict]      = None,
    ) -> ReplayResult:
        """
        Replay a single event.

        Parameters
        ----------
        event_id : str
        scorer : Scorer, optional
            New scorer to apply.
        extractor : Extractor, optional
            New extractor.  Requires artifact_loader to be set.
        new_metadata : dict, optional

        Returns
        -------
        ReplayResult
        """
        original = self._store.load(event_id)
        if original is None:
            raise ValueError(f"Event not found: {event_id}")

        replayed = self._clone_event(original)
        if new_metadata:
            replayed.metadata.update(new_metadata)

        # Re-extract if extractor supplied
        if extractor is not None:
            artifact = self._load_artifact(original)
            if artifact is not None:
                replayed.features = extractor.extract(artifact)
            else:
                msg = (
                    f"Extractor supplied for replay of {event_id} but no artifact "
                    "could be loaded (artifact_loader not set or raw_artifact_path missing). "
                    "Falling back to stored features."
                )
                if self._require_artifact:
                    raise RuntimeError(msg)
                warnings.warn(msg, stacklevel=2)
                _log.warning(msg)

        # Re-score
        if scorer is not None:
            replayed.score = scorer.score(replayed.features)

        # Stamp — metadata must be final BEFORE stamping
        replayed.metadata["replay_of"] = original.event_id
        replayed.metadata["replay_ts"] = datetime.now(timezone.utc).isoformat()
        self._trust.stamp(replayed)
        self._store.save(replayed)

        return self._build_result(original, replayed)

    # ── Batch replay ──────────────────────────────────────────────────────────

    def replay_all(
        self,
        scorer:    Optional[Scorer]    = None,
        extractor: Optional[Extractor] = None,
        agent_id:  Optional[str]       = None,
        limit:     int                 = 1000,
    ) -> list[ReplayResult]:
        events  = self._store.list(agent_id=agent_id, limit=limit)
        results = []
        errors  = 0

        for event in events:
            if "replay_of" in event.metadata:
                continue
            try:
                r = self.replay(event.event_id, scorer=scorer, extractor=extractor)
                results.append(r)
            except Exception as exc:
                errors += 1
                _log.warning("Replay failed for %s: %s", event.event_id, exc)

        if errors:
            _log.warning("replay_all completed with %d errors out of %d events", errors, len(events))

        return results

    def compare_scorers(
        self,
        scorer_a:  Scorer,
        scorer_b:  Scorer,
        agent_id:  Optional[str] = None,
        limit:     int           = 500,
    ) -> dict:
        """Run both scorers over stored events.  Return comparison summary."""
        events = self._store.list(agent_id=agent_id, limit=limit)
        a_scores, b_scores, deltas = [], [], []

        for event in events:
            if "replay_of" in event.metadata:
                continue
            try:
                sa = scorer_a.score(event.features).final
                sb = scorer_b.score(event.features).final
                a_scores.append(sa)
                b_scores.append(sb)
                deltas.append(sb - sa)
            except Exception:
                pass

        if not deltas:
            return {"error": "no comparable events found"}

        return {
            "n":             len(deltas),
            "scorer_a_mean": _mean(a_scores),
            "scorer_b_mean": _mean(b_scores),
            "mean_delta":    _mean(deltas),
            "max_delta":     max(deltas),
            "min_delta":     min(deltas),
            "improved_pct":  sum(1 for d in deltas if d > 0) / len(deltas),
        }

    # ── Private ───────────────────────────────────────────────────────────────

    @staticmethod
    def _clone_event(original: Event) -> Event:
        """Deep-copy an event, reset identity + integrity fields, inherit trace_id."""
        clone = copy.deepcopy(original)
        object.__setattr__(clone, "event_id",   str(uuid.uuid4()))
        object.__setattr__(clone, "timestamp",  datetime.now(timezone.utc).isoformat())
        object.__setattr__(clone, "event_hash", "")
        object.__setattr__(clone, "signature",  None)
        object.__setattr__(clone, "_locked",    False)
        # trace_id is inherited so replays stay grouped with originals
        return clone

    def _load_artifact(self, event: Event) -> Optional[Any]:
        if self._loader and event.raw_artifact_path:
            try:
                return self._loader(event)
            except Exception as e:
                _log.warning("artifact_loader failed for %s: %s", event.event_id, e)
        return None

    @staticmethod
    def _build_result(original: Event, replayed: Event) -> ReplayResult:
        score_delta = None
        if original.score and replayed.score:
            score_delta = replayed.score.final - original.score.final

        feature_delta: dict[str, float] = {}
        changed: list[str] = []
        for key, new_val in replayed.features.items():
            old_val = original.features.get(key)
            if isinstance(new_val, (int, float)) and isinstance(old_val, (int, float)):
                delta = float(new_val) - float(old_val)
                feature_delta[key] = delta
                if abs(delta) > 1e-9:
                    changed.append(key)

        return ReplayResult(
            original_event     = original,
            replayed_event     = replayed,
            score_delta        = score_delta,
            feature_delta      = feature_delta,
            changed_dimensions = changed,
        )


def _mean(values: list[float]) -> float:
    return sum(values) / len(values) if values else 0.0
