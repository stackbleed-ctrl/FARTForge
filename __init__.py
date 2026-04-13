"""
FARTForge
=========
Universal, high-integrity, pluggable agent evaluation & observability platform.

Quick start
-----------
    from fartforge import EventEmitter, FartAdapter, HMACTrustLayer, SQLiteStore

    adapter = FartAdapter()
    emitter = EventEmitter(
        agent_id   = "my-agent",
        event_type = "audio",
        generator  = adapter,
        extractor  = adapter,
        scorer     = adapter,
        trust      = HMACTrustLayer(),
        store      = SQLiteStore("events.db"),
    )

    result = emitter.emit({"intensity": 9, "moisture": 0.3})
    print(result.event.score.final)   # → 0.73
    print(result.event.event_hash)    # → sha256 fingerprint
    print(result.ok)                  # → True
"""

from .emitter.event    import Event, ScoreBreakdown
from .emitter.pipeline import (
    Generator, Extractor, Scorer, Validator,
    ValidatorChain, SchemaValidator, HashValidator,
    ScoreThresholdValidator, ScoreValidator,
)
from .emitter.trust    import TrustLayer, HMACTrustLayer, Ed25519TrustLayer, AuditChain
from .emitter.core     import EventEmitter, EventStore, EmitHook, EmitResult
from .emitter.replay   import ReplayEngine, ReplayResult
from .emitter.hooks    import (
    MetricsHook, LeaderboardHook, FirehoseHook,
    LoggingHook, AlertHook, PrometheusHook,
)
from .emitter.storage.sqlite_store import SQLiteStore
from .adapters.fart_adapter        import FartAdapter

__version__ = "2.0.0"

__all__ = [
    "Event", "ScoreBreakdown",
    "Generator", "Extractor", "Scorer", "Validator",
    "ValidatorChain", "SchemaValidator", "HashValidator",
    "ScoreThresholdValidator", "ScoreValidator",
    "TrustLayer", "HMACTrustLayer", "Ed25519TrustLayer", "AuditChain",
    "EventEmitter", "EventStore", "EmitHook", "EmitResult",
    "ReplayEngine", "ReplayResult",
    "MetricsHook", "LeaderboardHook", "FirehoseHook",
    "LoggingHook", "AlertHook", "PrometheusHook",
    "SQLiteStore",
    "FartAdapter",
]
