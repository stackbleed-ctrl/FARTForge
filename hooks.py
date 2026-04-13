"""
FARTForge — Observability Hooks
================================
Wire into EventEmitter.hooks for automatic instrumentation.

v2 hardening:
  - AsyncHookQueue: background thread dispatches hooks without blocking the pipeline.
  - FirehoseHook: thread-safe subscriber list.
  - MetricsHook: thread-safe counters.
  - PrometheusHook: unchanged (already correct).

Included hooks:
  - LoggingHook
  - MetricsHook
  - LeaderboardHook
  - FirehoseHook
  - AlertHook
  - PrometheusHook  (requires prometheus_client)
"""

from __future__ import annotations

import json
import logging
import threading
from collections import defaultdict, deque
from typing import Any, Callable, Optional

from .core import EmitHook, EmitResult
from .event import Event

_log = logging.getLogger("fartforge.hooks")


# ─────────────────────────────────────────────────────────────────────────────
# 1. LoggingHook
# ─────────────────────────────────────────────────────────────────────────────

class LoggingHook(EmitHook):
    """One structured JSON log line per event. Drop into any log aggregator."""

    def __init__(self, logger: Optional[logging.Logger] = None, level: int = logging.INFO):
        self._log   = logger or logging.getLogger("fartforge.events")
        self._level = level

    def on_emit(self, result: EmitResult) -> None:
        self._log.log(
            self._level,
            json.dumps({
                "event_id":   result.event.event_id,
                "trace_id":   result.event.trace_id,
                "agent_id":   result.event.agent_id,
                "event_type": result.event.event_type,
                "score":      result.event.score.final if result.event.score else None,
                "accepted":   result.accepted,
                "latency_ms": result.latency_ms,
                "hash":       result.event.event_hash[:16] + "…" if result.event.event_hash else None,
            })
        )

    def on_error(self, error: Exception, event: Event) -> None:
        self._log.error(json.dumps({
            "error":      str(error),
            "event_id":   event.event_id,
            "agent_id":   event.agent_id,
            "trace_id":   event.trace_id,
        }))


# ─────────────────────────────────────────────────────────────────────────────
# 2. MetricsHook — thread-safe
# ─────────────────────────────────────────────────────────────────────────────

class MetricsHook(EmitHook):
    """In-process counters and sliding-window histograms.  Thread-safe."""

    def __init__(self, window: int = 1000):
        self._lock    = threading.Lock()
        self._window  = window
        self._total   = 0
        self._errors  = 0
        self._rejected = 0
        self._scores:    deque[float] = deque(maxlen=window)
        self._latencies: deque[float] = deque(maxlen=window)

    def on_emit(self, result: EmitResult) -> None:
        with self._lock:
            self._total += 1
            self._latencies.append(result.latency_ms)
            if not result.accepted:
                self._rejected += 1
            if result.error:
                self._errors += 1
            if result.event.score:
                self._scores.append(result.event.score.final)

    def on_error(self, error: Exception, event: Event) -> None:
        with self._lock:
            self._errors += 1

    def snapshot(self) -> dict:
        with self._lock:
            scores    = list(self._scores)
            latencies = list(self._latencies)
            total     = self._total
            errors    = self._errors
            rejected  = self._rejected
        return {
            "total_events":    total,
            "errors":          errors,
            "rejected":        rejected,
            "accept_rate":     (total - rejected) / max(total, 1),
            "score_mean":      _mean(scores),
            "score_p50":       _percentile(scores, 50),
            "score_p95":       _percentile(scores, 95),
            "latency_mean_ms": _mean(latencies),
            "latency_p95_ms":  _percentile(latencies, 95),
        }

    def reset(self) -> None:
        with self._lock:
            self._total = self._errors = self._rejected = 0
            self._scores.clear()
            self._latencies.clear()


# ─────────────────────────────────────────────────────────────────────────────
# 3. LeaderboardHook
# ─────────────────────────────────────────────────────────────────────────────

class LeaderboardHook(EmitHook):
    """Tracks top-N events per agent in memory. Thread-safe."""

    def __init__(self, top_n: int = 10):
        self._top_n  = top_n
        self._lock   = threading.Lock()
        self._boards: dict[str, list] = defaultdict(list)

    def on_emit(self, result: EmitResult) -> None:
        if not result.accepted or result.event.score is None:
            return
        entry = (
            result.event.score.final,
            result.event.event_id,
            result.event.timestamp,
        )
        with self._lock:
            board = self._boards[result.event.agent_id]
            board.append(entry)
            board.sort(key=lambda x: x[0], reverse=True)
            self._boards[result.event.agent_id] = board[: self._top_n]

    def on_error(self, error: Exception, event: Event) -> None:
        pass

    def get(self, agent_id: Optional[str] = None) -> list[dict]:
        with self._lock:
            if agent_id:
                entries = list(self._boards.get(agent_id, []))
            else:
                entries = []
                for board in self._boards.values():
                    entries.extend(board)
                entries.sort(key=lambda x: x[0], reverse=True)
                entries = entries[: self._top_n]

        return [
            {"rank": i + 1, "score": e[0], "event_id": e[1], "timestamp": e[2]}
            for i, e in enumerate(entries)
        ]


# ─────────────────────────────────────────────────────────────────────────────
# 4. FirehoseHook — thread-safe subscriber registry
# ─────────────────────────────────────────────────────────────────────────────

class FirehoseHook(EmitHook):
    """
    Pushes every event to subscriber callbacks.
    Wire into WebSocket / SSE handlers for live streaming.

    Thread-safe: subscriber list is protected by a lock.
    """

    def __init__(self, max_buffer: int = 500):
        self._lock        = threading.Lock()
        self._subscribers: list[Callable[[dict], None]] = []
        self._buffer:      deque[dict] = deque(maxlen=max_buffer)

    def subscribe(self, callback: Callable[[dict], None]) -> None:
        with self._lock:
            self._subscribers.append(callback)

    def unsubscribe(self, callback: Callable[[dict], None]) -> None:
        with self._lock:
            if callback in self._subscribers:
                self._subscribers.remove(callback)

    def on_emit(self, result: EmitResult) -> None:
        payload = {
            "event_id":   result.event.event_id,
            "trace_id":   result.event.trace_id,
            "agent_id":   result.event.agent_id,
            "event_type": result.event.event_type,
            "score":      result.event.score.to_dict() if result.event.score else None,
            "features":   result.event.features,
            "latency_ms": result.latency_ms,
            "accepted":   result.accepted,
            "timestamp":  result.event.timestamp,
            "hash":       result.event.event_hash,
        }
        with self._lock:
            self._buffer.append(payload)
            subs = list(self._subscribers)

        for cb in subs:
            try:
                cb(payload)
            except Exception:
                pass

    def on_error(self, error: Exception, event: Event) -> None:
        pass

    def recent(self, n: int = 20) -> list[dict]:
        with self._lock:
            return list(self._buffer)[-n:]


# ─────────────────────────────────────────────────────────────────────────────
# 5. AlertHook
# ─────────────────────────────────────────────────────────────────────────────

class AlertHook(EmitHook):
    """Fires a callback when a score threshold is crossed."""

    def __init__(
        self,
        on_low_score:   Optional[Callable[[EmitResult], None]] = None,
        on_high_score:  Optional[Callable[[EmitResult], None]] = None,
        low_threshold:  float = 0.2,
        high_threshold: float = 0.9,
    ):
        self._on_low    = on_low_score
        self._on_high   = on_high_score
        self._low_thr   = low_threshold
        self._high_thr  = high_threshold

    def on_emit(self, result: EmitResult) -> None:
        if not result.event.score:
            return
        final = result.event.score.final
        if final <= self._low_thr and self._on_low:
            try:
                self._on_low(result)
            except Exception:
                pass
        if final >= self._high_thr and self._on_high:
            try:
                self._on_high(result)
            except Exception:
                pass

    def on_error(self, error: Exception, event: Event) -> None:
        pass


# ─────────────────────────────────────────────────────────────────────────────
# 6. PrometheusHook (optional)
# ─────────────────────────────────────────────────────────────────────────────

class PrometheusHook(EmitHook):
    """
    Exposes FARTForge metrics to Prometheus.
    Requires: pip install prometheus_client
    """

    def __init__(self):
        try:
            from prometheus_client import Counter, Histogram
        except ImportError as e:
            raise ImportError(
                "PrometheusHook requires prometheus_client.\n"
                "pip install prometheus_client"
            ) from e

        self._events_total = Counter(
            "fartforge_events_total", "Total events emitted",
            ["agent_id", "event_type", "accepted"],
        )
        self._score = Histogram(
            "fartforge_score", "Event score distribution",
            ["agent_id", "event_type"],
            buckets=[0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1.0],
        )
        self._latency = Histogram(
            "fartforge_latency_ms", "Emit latency in milliseconds",
            ["agent_id", "event_type"],
            buckets=[1, 5, 10, 25, 50, 100, 250, 500, 1000],
        )

    def on_emit(self, result: EmitResult) -> None:
        labels = (result.event.agent_id, result.event.event_type)
        self._events_total.labels(*labels, str(result.accepted)).inc()
        self._latency.labels(*labels).observe(result.latency_ms)
        if result.event.score:
            self._score.labels(*labels).observe(result.event.score.final)

    def on_error(self, error: Exception, event: Event) -> None:
        self._events_total.labels(event.agent_id, event.event_type, "False").inc()


# ─────────────────────────────────────────────────────────────────────────────
# Stats helpers
# ─────────────────────────────────────────────────────────────────────────────

def _mean(values: list[float]) -> float:
    return sum(values) / len(values) if values else 0.0


def _percentile(values: list[float], p: int) -> float:
    if not values:
        return 0.0
    s = sorted(values)
    idx = max(0, int(len(s) * p / 100) - 1)
    return s[idx]
