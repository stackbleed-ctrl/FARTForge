"""
FARTForge — EventEmitter (Core Orchestrator)
=============================================
The single object every agent instantiates.

v2 hardening:
  - Hooks execute in a background ThreadPoolExecutor (non-blocking pipeline).
  - trace_id propagation for multi-event correlation.
  - Pipeline component versions stamped into event metadata.
  - Configurable max_input_bytes guard (rejects oversized payloads).
  - emit() never raises — errors captured in EmitResult.error.
"""

from __future__ import annotations

import json
import time
import traceback
from concurrent.futures import ThreadPoolExecutor
from dataclasses import dataclass, field
from typing import Any, Callable, Optional

from .event import Event, ScoreBreakdown
from .pipeline import (
    Generator, Extractor, Scorer, Validator,
    ValidatorChain, SchemaValidator, HashValidator, ScoreValidator,
)
from .trust import TrustLayer

# Max serialised JSON size of a single input payload (default: 256 KB)
DEFAULT_MAX_INPUT_BYTES = 256 * 1024

# Background thread pool for async hook execution
_hook_executor = ThreadPoolExecutor(max_workers=4, thread_name_prefix="fartforge-hook")


# ─────────────────────────────────────────────────────────────────────────────
# EmitResult
# ─────────────────────────────────────────────────────────────────────────────

@dataclass
class EmitResult:
    """Everything that came out of a single emit() call."""
    event:      Event
    artifact:   Any           = None
    accepted:   bool          = True
    error:      Optional[str] = None
    latency_ms: float         = 0.0

    @property
    def ok(self) -> bool:
        return self.accepted and self.error is None


# ─────────────────────────────────────────────────────────────────────────────
# EmitHook interface
# ─────────────────────────────────────────────────────────────────────────────

class EmitHook:
    """
    Called after every emit().  Use for:
      - metrics sinks (Prometheus, StatsD)
      - leaderboard updates
      - alert triggers
      - firehose streaming
    """

    def on_emit(self, result: EmitResult) -> None: ...
    def on_error(self, error: Exception, event: Event) -> None: ...


# ─────────────────────────────────────────────────────────────────────────────
# EventStore interface
# ─────────────────────────────────────────────────────────────────────────────

class EventStore:
    """Persist and retrieve events.  Swap for any backend."""

    def save(self, event: Event) -> None: ...

    def load(self, event_id: str) -> Optional[Event]:
        return None

    def list(
        self,
        agent_id:   Optional[str] = None,
        event_type: Optional[str] = None,
        limit:      int           = 100,
        offset:     int           = 0,
    ) -> list[Event]:
        return []

    def leaderboard(
        self,
        agent_id:  Optional[str] = None,
        dimension: str           = "final",
        limit:     int           = 50,
    ) -> list[dict]:
        return []


# ─────────────────────────────────────────────────────────────────────────────
# EventEmitter
# ─────────────────────────────────────────────────────────────────────────────

class EventEmitter:
    """
    Orchestrates the full pipeline for a single agent.

    Pipeline
    --------
    input → Guard → Generator → Extractor → Scorer → Event
          → TrustLayer → Validator → Store → Hooks (async)

    Parameters
    ----------
    agent_id : str
        Unique identifier for this agent instance.
    generator : Generator
    extractor : Extractor
    scorer : Scorer
    event_type : str
    validator : Validator, optional
        Defaults to Schema + Hash + Score validation chain.
    trust : TrustLayer, optional
    store : EventStore, optional
    hooks : list[EmitHook], optional
    metadata_fn : callable, optional
        (input, artifact) → dict of extra metadata per emit.
    max_input_bytes : int
        Reject inputs whose JSON serialisation exceeds this size.
        Default: 256 KB.
    async_hooks : bool
        If True (default), hooks run in background threads.
        If False, hooks block the pipeline (useful for testing).
    """

    def __init__(
        self,
        agent_id:        str,
        generator:       Generator,
        extractor:       Extractor,
        scorer:          Scorer,
        event_type:      str                      = "generic",
        validator:       Optional[Validator]      = None,
        trust:           Optional[TrustLayer]     = None,
        store:           Optional[EventStore]     = None,
        hooks:           Optional[list[EmitHook]] = None,
        metadata_fn:     Optional[Callable]       = None,
        max_input_bytes: int                      = DEFAULT_MAX_INPUT_BYTES,
        async_hooks:     bool                     = True,
    ):
        self.agent_id        = agent_id
        self.event_type      = event_type
        self._generator      = generator
        self._extractor      = extractor
        self._scorer         = scorer
        self._validator      = validator or ValidatorChain([
            SchemaValidator(), HashValidator(), ScoreValidator(),
        ])
        self._trust          = trust or TrustLayer()
        self._store          = store or EventStore()
        self._hooks          = hooks or []
        self._metadata_fn    = metadata_fn
        self._max_input_bytes = max_input_bytes
        self._async_hooks    = async_hooks

    # ── Public API ────────────────────────────────────────────────────────────

    def emit(self, input: dict[str, Any], trace_id: Optional[str] = None) -> EmitResult:
        """
        Run the full pipeline for one agent interaction.
        Never raises — errors are captured in result.error.
        """
        t0 = time.perf_counter()
        event = Event(
            agent_id   = self.agent_id,
            event_type = self.event_type,
            input      = input,
        )
        if trace_id:
            # Use caller-supplied trace_id for session correlation
            object.__setattr__(event, "trace_id", trace_id)

        artifact: Any = None

        try:
            # 0. Guard: payload size
            self._check_payload_size(input)

            # 1. Stamp pipeline versions into metadata
            event.metadata["pipeline"] = {
                "generator":  f"{type(self._generator).__name__}@{self._generator.version}",
                "extractor":  f"{type(self._extractor).__name__}@{self._extractor.version}",
                "scorer":     f"{type(self._scorer).__name__}@{self._scorer.version}",
            }

            # 2. Generate
            artifact = self._generator.generate(input)
            event.output = self._artifact_to_dict(artifact)

            # 3. Extract
            event.features = self._extractor.extract(artifact)

            # 4. Score
            event.score = self._scorer.score(event.features)

            # 5. User-supplied metadata
            if self._metadata_fn:
                event.metadata.update(self._metadata_fn(input, artifact) or {})
            event.metadata["latency_ms"] = round((time.perf_counter() - t0) * 1000, 2)

            # 6. Trust stamp (hash + optional signature)
            self._trust.stamp(event)

            # 7. Validate
            accepted = self._validator.validate(event)

            # 8. Persist (only accepted events)
            if accepted:
                self._store.save(event)

            result = EmitResult(
                event      = event,
                artifact   = artifact,
                accepted   = accepted,
                latency_ms = (time.perf_counter() - t0) * 1000,
            )

        except Exception as exc:
            result = EmitResult(
                event      = event,
                artifact   = artifact,
                accepted   = False,
                error      = traceback.format_exc(),
                latency_ms = (time.perf_counter() - t0) * 1000,
            )
            self._fire_error_hooks(exc, event)

        # 9. Fire hooks (async or sync)
        self._fire_hooks(result)
        return result

    def emit_batch(
        self,
        inputs:   list[dict[str, Any]],
        trace_id: Optional[str] = None,
    ) -> list[EmitResult]:
        """
        Emit multiple events under a shared trace_id.
        All events in the batch share the same trace_id for correlation.
        """
        import uuid
        tid = trace_id or str(uuid.uuid4())
        return [self.emit(inp, trace_id=tid) for inp in inputs]

    def add_hook(self, hook: EmitHook) -> None:
        self._hooks.append(hook)

    def set_store(self, store: EventStore) -> None:
        self._store = store

    # ── Private ───────────────────────────────────────────────────────────────

    def _check_payload_size(self, input: dict) -> None:
        try:
            size = len(json.dumps(input, default=str).encode())
        except Exception:
            size = 0
        if size > self._max_input_bytes:
            raise ValueError(
                f"Input payload too large: {size} bytes "
                f"(max {self._max_input_bytes} bytes). "
                "Store large artifacts externally and pass a reference."
            )

    def _fire_hooks(self, result: EmitResult) -> None:
        for hook in self._hooks:
            if self._async_hooks:
                _hook_executor.submit(self._safe_hook, hook, result)
            else:
                self._safe_hook(hook, result)

    def _fire_error_hooks(self, exc: Exception, event: Event) -> None:
        for hook in self._hooks:
            try:
                hook.on_error(exc, event)
            except Exception:
                pass

    @staticmethod
    def _safe_hook(hook: EmitHook, result: EmitResult) -> None:
        try:
            hook.on_emit(result)
        except Exception:
            pass

    @staticmethod
    def _artifact_to_dict(artifact: Any) -> dict:
        if isinstance(artifact, dict):
            return artifact
        if isinstance(artifact, (bytes, bytearray)):
            return {"bytes_len": len(artifact), "type": "binary"}
        if hasattr(artifact, "__dict__"):
            return vars(artifact)
        return {"value": str(artifact)}
