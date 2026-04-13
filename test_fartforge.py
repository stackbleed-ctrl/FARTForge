"""
FARTForge — Test Suite
=======================
Covers all hardened behaviours added in v2.

Run:
    pytest tests/ -v
"""

from __future__ import annotations

import os
import pytest

# Set dev env so HMACTrustLayer doesn't raise on missing secret
os.environ.setdefault("FARTFORGE_ENV", "development")

from fartforge import (
    Event, ScoreBreakdown,
    FartAdapter,
    EventEmitter, EmitResult,
    HMACTrustLayer, TrustLayer, AuditChain,
    ValidatorChain, SchemaValidator, HashValidator, ScoreValidator,
    SQLiteStore,
    ReplayEngine,
    MetricsHook, LeaderboardHook, FirehoseHook, LoggingHook, AlertHook,
)


# ─────────────────────────────────────────────────────────────────────────────
# Fixtures
# ─────────────────────────────────────────────────────────────────────────────

@pytest.fixture
def adapter():
    return FartAdapter()


@pytest.fixture
def store(tmp_path):
    return SQLiteStore(tmp_path / "test.db")


@pytest.fixture
def emitter(store):
    adapter = FartAdapter()
    return EventEmitter(
        agent_id    = "test-agent",
        generator   = adapter,
        extractor   = adapter,
        scorer      = adapter,
        trust       = HMACTrustLayer(secret="test-secret-32-chars-minimum-ok"),
        store       = store,
        async_hooks = False,
    )


# ─────────────────────────────────────────────────────────────────────────────
# ScoreBreakdown — strict validation
# ─────────────────────────────────────────────────────────────────────────────

class TestScoreBreakdown:

    def test_valid_weights_accepted(self):
        s = ScoreBreakdown(
            dimensions={"a": 0.8, "b": 0.6},
            weights={"a": 0.6, "b": 0.4},
        )
        assert abs(s.final - (0.8 * 0.6 + 0.6 * 0.4)) < 1e-9

    def test_weights_must_sum_to_one(self):
        with pytest.raises(ValueError, match="sum to 1.0"):
            ScoreBreakdown(
                dimensions={"a": 0.5},
                weights={"a": 0.7},   # sums to 0.7, not 1.0
            )

    def test_validate_rejects_out_of_bounds_dimensions(self):
        s = ScoreBreakdown(
            dimensions={"a": 1.5},   # > 1.0
            weights={"a": 1.0},
        )
        with pytest.raises(ValueError, match="outside \\[0, 1\\]"):
            s.validate()

    def test_empty_score_returns_zero(self):
        s = ScoreBreakdown(dimensions={}, weights={})
        assert s.final == 0.0

    def test_top_dimension(self):
        s = ScoreBreakdown(
            dimensions={"a": 0.9, "b": 0.2},
            weights={"a": 0.5, "b": 0.5},
        )
        assert s.top_dimension() == "a"

    def test_to_dict_includes_top_dimension(self):
        s = ScoreBreakdown(
            dimensions={"a": 0.9, "b": 0.2},
            weights={"a": 0.5, "b": 0.5},
        )
        d = s.to_dict()
        assert "top_dimension" in d
        assert d["top_dimension"] == "a"


# ─────────────────────────────────────────────────────────────────────────────
# Event — immutability and hashing
# ─────────────────────────────────────────────────────────────────────────────

class TestEvent:

    def test_hash_is_deterministic(self):
        e = Event(agent_id="a", event_type="test", input={"x": 1})
        h1 = e.compute_hash()
        # Create identical event
        e2 = Event(
            event_id   = e.event_id,
            trace_id   = e.trace_id,
            agent_id   = "a",
            event_type = "test",
            input      = {"x": 1},
            timestamp  = e.timestamp,
        )
        h2 = e2.compute_hash()
        assert h1 == h2

    def test_locked_event_raises_on_mutation(self):
        e = Event(agent_id="a")
        e.compute_hash()
        with pytest.raises(AttributeError, match="locked"):
            e.agent_id = "tampered"

    def test_tamper_detection(self):
        e = Event(agent_id="a", input={"x": 1})
        e.compute_hash()
        assert e.verify()
        # Bypass lock and tamper
        object.__setattr__(e, "_locked", False)
        object.__setattr__(e, "agent_id", "tampered")
        object.__setattr__(e, "_locked", True)
        assert not e.verify()

    def test_json_round_trip(self):
        e = Event(agent_id="a", input={"k": "v"})
        e.compute_hash()
        d = e.to_dict()
        e2 = Event.from_dict(d)
        assert e2.event_id == e.event_id
        assert e2.event_hash == e.event_hash

    def test_trace_id_propagated(self):
        e = Event(agent_id="a")
        assert len(e.trace_id) == 36   # UUID format


# ─────────────────────────────────────────────────────────────────────────────
# Trust layer
# ─────────────────────────────────────────────────────────────────────────────

class TestTrust:

    def test_hmac_stamp_and_verify(self):
        trust = HMACTrustLayer(secret="supersecret-32-chars-minimum-pad")
        e = Event(agent_id="a")
        trust.stamp(e)
        assert e.event_hash
        assert e.signature
        assert trust.verify(e)

    def test_wrong_secret_fails(self):
        trust_a = HMACTrustLayer(secret="secret-a-32-chars-padded-xxxxxxxxxxx")
        trust_b = HMACTrustLayer(secret="secret-b-32-chars-padded-xxxxxxxxxxx")
        e = Event(agent_id="a")
        trust_a.stamp(e)
        assert not trust_b.verify(e)

    def test_key_rotation(self):
        old_secret = "old-key-32-chars-padded-xxxxxxxxxx"
        new_secret = "new-key-32-chars-padded-xxxxxxxxxx"

        # Sign with old key
        old_trust = HMACTrustLayer(secret=old_secret)
        e = Event(agent_id="a")
        old_trust.stamp(e)

        # Rotated trust knows both keys
        rotated = HMACTrustLayer(secret=[new_secret, old_secret])
        assert rotated.verify(e)

        # New event signed with new key
        e2 = Event(agent_id="b")
        rotated.stamp(e2)
        assert new_secret.encode() in [rotated._secrets[0]]
        assert rotated.verify(e2)

    def test_missing_secret_raises_in_production(self):
        original = os.environ.get("FARTFORGE_ENV")
        os.environ["FARTFORGE_ENV"] = "production"
        os.environ.pop("FARTFORGE_SECRET", None)
        try:
            with pytest.raises(ValueError, match="FARTFORGE_SECRET"):
                HMACTrustLayer()
        finally:
            if original:
                os.environ["FARTFORGE_ENV"] = original
            else:
                os.environ.pop("FARTFORGE_ENV", None)

    def test_audit_chain_verify(self):
        chain = AuditChain()
        trust = HMACTrustLayer(secret="chain-test-secret-32-chars-padded")
        events = [Event(agent_id=f"a{i}") for i in range(5)]
        for e in events:
            trust.stamp(e)
            chain.append(e)
        assert chain.verify_chain()
        assert len(chain) == 5

    def test_audit_chain_detects_tamper(self):
        chain = AuditChain()
        trust = HMACTrustLayer(secret="chain-test-secret-32-chars-padded")
        e = Event(agent_id="a")
        trust.stamp(e)
        chain.append(e)
        # Tamper with the chain entry directly
        chain._entries[0]["event_hash"] = "00000000"
        assert not chain.verify_chain()


# ─────────────────────────────────────────────────────────────────────────────
# FartAdapter pipeline
# ─────────────────────────────────────────────────────────────────────────────

class TestFartAdapter:

    def test_generate_returns_dict(self, adapter):
        result = adapter.generate({"intensity": 7, "moisture": 0.4})
        assert isinstance(result, dict)
        assert "frequency_hz" in result

    def test_extract_normalised_in_bounds(self, adapter):
        artifact = adapter.generate({"intensity": 5, "moisture": 0.5})
        features = adapter.extract(artifact)
        for key in ("potency_norm", "duration_norm", "frequency_norm", "moisture_norm", "authenticity"):
            assert 0.0 <= features[key] <= 1.0, f"{key} = {features[key]} out of [0,1]"

    def test_score_breakdown_valid(self, adapter):
        artifact = adapter.generate({"intensity": 8, "moisture": 0.6})
        features = adapter.extract(artifact)
        score = adapter.score(features)
        score.validate()   # must not raise
        assert 0.0 <= score.final <= 1.0

    def test_custom_weights_must_sum_to_one(self, adapter):
        with pytest.raises(ValueError, match="sum to 1.0"):
            FartAdapter(score_weights={"potency": 0.9, "duration": 0.5})


# ─────────────────────────────────────────────────────────────────────────────
# EventEmitter — full pipeline
# ─────────────────────────────────────────────────────────────────────────────

class TestEventEmitter:

    def test_emit_returns_ok_result(self, emitter):
        result = emitter.emit({"intensity": 5, "moisture": 0.3})
        assert result.ok
        assert result.accepted
        assert result.event.event_hash
        assert result.event.score is not None
        assert 0.0 <= result.event.score.final <= 1.0

    def test_emit_never_raises(self, emitter):
        # Garbage input — should not raise, should return error result
        result = emitter.emit({"__bad__": object()})
        assert isinstance(result, EmitResult)
        # May or may not error depending on adapter tolerance; just must not raise

    def test_trace_id_propagated_in_batch(self, emitter):
        results = emitter.emit_batch(
            [{"intensity": i, "moisture": 0.3} for i in range(1, 4)]
        )
        trace_ids = {r.event.trace_id for r in results}
        assert len(trace_ids) == 1   # all share the same trace_id

    def test_payload_too_large_rejected(self, store):
        adapter = FartAdapter()
        emitter = EventEmitter(
            agent_id        = "test",
            generator       = adapter,
            extractor       = adapter,
            scorer          = adapter,
            store           = store,
            max_input_bytes = 10,   # very small for testing
            async_hooks     = False,
        )
        result = emitter.emit({"intensity": 5, "moisture": 0.3})
        assert not result.ok
        assert "too large" in (result.error or "").lower()

    def test_pipeline_versions_in_metadata(self, emitter):
        result = emitter.emit({"intensity": 3, "moisture": 0.2})
        assert "pipeline" in result.event.metadata
        assert "generator" in result.event.metadata["pipeline"]

    def test_hook_called_on_emit(self, store):
        adapter = FartAdapter()
        metrics = MetricsHook()
        emitter = EventEmitter(
            agent_id    = "test",
            generator   = adapter,
            extractor   = adapter,
            scorer      = adapter,
            store       = store,
            hooks       = [metrics],
            async_hooks = False,
        )
        emitter.emit({"intensity": 5, "moisture": 0.3})
        snap = metrics.snapshot()
        assert snap["total_events"] == 1
        assert snap["errors"] == 0


# ─────────────────────────────────────────────────────────────────────────────
# SQLite store
# ─────────────────────────────────────────────────────────────────────────────

class TestSQLiteStore:

    def test_save_and_load(self, store, emitter):
        result = emitter.emit({"intensity": 7, "moisture": 0.5})
        loaded = store.load(result.event.event_id)
        assert loaded is not None
        assert loaded.event_id == result.event.event_id
        assert loaded.agent_id == result.event.agent_id

    def test_loaded_event_verifies(self, store, emitter):
        result = emitter.emit({"intensity": 4, "moisture": 0.4})
        loaded = store.load(result.event.event_id)
        assert loaded.verify()

    def test_leaderboard_ordered(self, store, emitter):
        for i in range(1, 6):
            emitter.emit({"intensity": i * 2, "moisture": 0.3})
        lb = store.leaderboard(limit=5)
        scores = [e["score_final"] for e in lb]
        assert scores == sorted(scores, reverse=True)

    def test_stats_returns_aggregates(self, store, emitter):
        for i in range(3):
            emitter.emit({"intensity": i + 3, "moisture": 0.3})
        stats = store.stats(agent_id="test-agent")
        assert stats["n"] >= 3
        assert stats["best"] >= stats["worst"]

    def test_trace_query(self, store):
        """Events in a batch share a trace_id and are queryable."""
        adapter = FartAdapter()
        e = EventEmitter(
            agent_id    = "trace-test",
            generator   = adapter,
            extractor   = adapter,
            scorer      = adapter,
            store       = store,
            async_hooks = False,
        )
        results = e.emit_batch([{"intensity": i, "moisture": 0.3} for i in range(1, 4)])
        trace_id = results[0].event.trace_id
        events = store.trace(trace_id)
        assert len(events) == 3

    def test_delete(self, store, emitter):
        result = emitter.emit({"intensity": 2, "moisture": 0.2})
        eid = result.event.event_id
        assert store.delete(eid)
        assert store.load(eid) is None


# ─────────────────────────────────────────────────────────────────────────────
# Replay engine
# ─────────────────────────────────────────────────────────────────────────────

class TestReplay:

    def test_replay_preserves_original(self, store, emitter):
        result = emitter.emit({"intensity": 5, "moisture": 0.3})
        original_id = result.event.event_id

        engine  = ReplayEngine(store=store)
        adapter = FartAdapter()
        rr = engine.replay(original_id, scorer=adapter)

        assert rr.ok
        assert rr.original_event.event_id == original_id
        assert rr.replayed_event.event_id != original_id
        # Original must not be mutated
        loaded_original = store.load(original_id)
        assert loaded_original.event_hash == result.event.event_hash

    def test_replay_inherits_trace_id(self, store, emitter):
        result   = emitter.emit({"intensity": 5, "moisture": 0.3})
        engine   = ReplayEngine(store=store)
        rr       = engine.replay(result.event.event_id)
        assert rr.replayed_event.trace_id == result.event.trace_id

    def test_replay_warns_without_artifact_loader(self, store, emitter):
        from fartforge import FartAdapter as FA
        result  = emitter.emit({"intensity": 5, "moisture": 0.3})
        engine  = ReplayEngine(store=store)  # no artifact_loader

        with pytest.warns(UserWarning, match="artifact"):
            engine.replay(result.event.event_id, extractor=FartAdapter())

    def test_replay_raises_with_require_artifact(self, store, emitter):
        result = emitter.emit({"intensity": 5, "moisture": 0.3})
        engine = ReplayEngine(store=store, require_artifact=True)
        with pytest.raises(RuntimeError, match="artifact"):
            engine.replay(result.event.event_id, extractor=FartAdapter())

    def test_compare_scorers(self, store, emitter):
        for i in range(1, 6):
            emitter.emit({"intensity": i, "moisture": 0.3})

        adapter = FartAdapter()
        engine  = ReplayEngine(store=store)
        result  = engine.compare_scorers(adapter, adapter, agent_id="test-agent")
        assert "n" in result
        assert result["n"] >= 5
        assert abs(result["mean_delta"]) < 1e-9   # same scorer → zero delta


# ─────────────────────────────────────────────────────────────────────────────
# Hooks
# ─────────────────────────────────────────────────────────────────────────────

class TestHooks:

    def test_metrics_snapshot(self, store):
        metrics = MetricsHook()
        adapter = FartAdapter()
        e = EventEmitter(
            agent_id    = "hooks-test",
            generator   = adapter,
            extractor   = adapter,
            scorer      = adapter,
            store       = store,
            hooks       = [metrics],
            async_hooks = False,
        )
        for _ in range(5):
            e.emit({"intensity": 5, "moisture": 0.3})

        snap = metrics.snapshot()
        assert snap["total_events"] == 5
        assert snap["accept_rate"] == 1.0
        assert snap["score_mean"] > 0
        assert snap["latency_p95_ms"] >= 0

    def test_leaderboard_hook(self, store):
        lb_hook = LeaderboardHook(top_n=3)
        adapter = FartAdapter()
        e = EventEmitter(
            agent_id    = "lb-test",
            generator   = adapter,
            extractor   = adapter,
            scorer      = adapter,
            store       = store,
            hooks       = [lb_hook],
            async_hooks = False,
        )
        for i in range(1, 8):
            e.emit({"intensity": i, "moisture": 0.3})

        entries = lb_hook.get(agent_id="lb-test")
        assert len(entries) <= 3
        scores = [en["score"] for en in entries]
        assert scores == sorted(scores, reverse=True)

    def test_firehose_subscriber(self, store):
        received = []
        fh = FirehoseHook()
        fh.subscribe(received.append)

        adapter = FartAdapter()
        e = EventEmitter(
            agent_id    = "fh-test",
            generator   = adapter,
            extractor   = adapter,
            scorer      = adapter,
            store       = store,
            hooks       = [fh],
            async_hooks = False,
        )
        e.emit({"intensity": 5, "moisture": 0.3})
        assert len(received) == 1
        assert "event_id" in received[0]
        assert "trace_id" in received[0]

    def test_alert_hook_triggers(self, store):
        alerts = []
        alert_hook = AlertHook(
            on_low_score  = alerts.append,
            low_threshold = 1.0,   # always trigger
        )
        adapter = FartAdapter()
        e = EventEmitter(
            agent_id    = "alert-test",
            generator   = adapter,
            extractor   = adapter,
            scorer      = adapter,
            store       = store,
            hooks       = [alert_hook],
            async_hooks = False,
        )
        e.emit({"intensity": 1, "moisture": 0.1})
        assert len(alerts) == 1


# ─────────────────────────────────────────────────────────────────────────────
# Score validator
# ─────────────────────────────────────────────────────────────────────────────

class TestScoreValidator:
    from fartforge.emitter.pipeline import ScoreValidator

    def test_valid_score_passes(self):
        from fartforge.emitter.pipeline import ScoreValidator
        from fartforge.emitter.event import Event, ScoreBreakdown
        v = ScoreValidator()
        e = Event(agent_id="a")
        e.score = ScoreBreakdown(
            dimensions={"a": 0.8},
            weights={"a": 1.0},
        )
        e.compute_hash()
        assert v.validate(e)

    def test_no_score_passes(self):
        from fartforge.emitter.pipeline import ScoreValidator
        from fartforge.emitter.event import Event
        v = ScoreValidator()
        e = Event(agent_id="a")
        e.compute_hash()
        assert v.validate(e)
