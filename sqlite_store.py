"""
FARTForge — SQLite Event Store
================================
Production-ready persistence with zero external dependencies.

v2 hardening:
  - threading.Lock around all writes (safe under real concurrency).
  - WAL journal mode (concurrent reads + writes without full locks).
  - Schema migration system (migrations table; apply-once idempotent).
  - Output blob size warning: events > MAX_OUTPUT_BYTES get a flag.
  - Graceful close + context manager support.

Swap for Postgres / Redis / DynamoDB by implementing EventStore.
"""

from __future__ import annotations

import base64
import json
import logging
import sqlite3
import threading
from pathlib import Path
from typing import Optional

from ..core import EventStore
from ..event import Event, ScoreBreakdown

_log = logging.getLogger("fartforge.store")

# Warn if a single output blob exceeds this (suggests you should use artifact storage)
MAX_OUTPUT_BYTES = 512 * 1024   # 512 KB


# ─────────────────────────────────────────────────────────────────────────────
# JSON encoder
# ─────────────────────────────────────────────────────────────────────────────

class _SafeEncoder(json.JSONEncoder):
    def default(self, obj):
        if isinstance(obj, (bytes, bytearray)):
            return {"__bytes__": True, "b64": base64.b64encode(obj).decode(), "len": len(obj)}
        if isinstance(obj, set):
            return list(obj)
        try:
            return super().default(obj)
        except TypeError:
            return str(obj)


def _dumps(obj: object) -> str:
    return json.dumps(obj, cls=_SafeEncoder)


# ─────────────────────────────────────────────────────────────────────────────
# Schema
# ─────────────────────────────────────────────────────────────────────────────

_CREATE_MIGRATIONS_TABLE = """
CREATE TABLE IF NOT EXISTS _migrations (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    name       TEXT NOT NULL UNIQUE,
    applied_at TEXT NOT NULL DEFAULT (datetime('now'))
);
"""

_CREATE_EVENTS_TABLE = """
CREATE TABLE IF NOT EXISTS events (
    id            TEXT PRIMARY KEY,
    trace_id      TEXT,
    agent_id      TEXT NOT NULL,
    event_type    TEXT NOT NULL,
    score_final   REAL,
    score_json    TEXT,
    features_json TEXT,
    input_json    TEXT,
    output_json   TEXT,
    metadata_json TEXT,
    event_hash    TEXT,
    signature     TEXT,
    timestamp     TEXT,
    version       TEXT,
    artifact_path TEXT,
    output_bytes  INTEGER DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_agent    ON events(agent_id);
CREATE INDEX IF NOT EXISTS idx_type     ON events(event_type);
CREATE INDEX IF NOT EXISTS idx_ts       ON events(timestamp);
CREATE INDEX IF NOT EXISTS idx_score    ON events(score_final);
CREATE INDEX IF NOT EXISTS idx_trace    ON events(trace_id);
"""

# Each migration is a (name, sql) pair.  Add new migrations at the END only.
_MIGRATIONS: list[tuple[str, str]] = [
    ("001_initial_schema",      _CREATE_EVENTS_TABLE),
    ("002_add_trace_id_index",  "CREATE INDEX IF NOT EXISTS idx_trace ON events(trace_id);"),
    ("003_output_bytes_col",
     "ALTER TABLE events ADD COLUMN output_bytes INTEGER DEFAULT 0;"
     " -- may fail if column exists; that is handled in code"),
]


# ─────────────────────────────────────────────────────────────────────────────
# Store
# ─────────────────────────────────────────────────────────────────────────────

class SQLiteStore(EventStore):
    """
    SQLite-backed EventStore.

    Parameters
    ----------
    path : str | Path
        Path to the SQLite file.  Use ":memory:" for testing.
    """

    def __init__(self, path: str | Path = "fartforge_events.db"):
        self._path  = str(path)
        self._lock  = threading.Lock()
        self._conn  = sqlite3.connect(self._path, check_same_thread=False)
        self._conn.row_factory = sqlite3.Row
        self._conn.execute("PRAGMA journal_mode=WAL")
        self._conn.execute("PRAGMA synchronous=NORMAL")
        self._conn.execute("PRAGMA foreign_keys=ON")
        self._init_schema()

    # ── Init / migrations ─────────────────────────────────────────────────────

    def _init_schema(self) -> None:
        with self._lock:
            self._conn.executescript(_CREATE_MIGRATIONS_TABLE)
            self._conn.commit()
            self._apply_migrations()

    def _apply_migrations(self) -> None:
        applied = {
            row[0]
            for row in self._conn.execute("SELECT name FROM _migrations").fetchall()
        }
        for name, sql in _MIGRATIONS:
            if name in applied:
                continue
            try:
                self._conn.executescript(sql)
                self._conn.execute(
                    "INSERT INTO _migrations (name) VALUES (?)", (name,)
                )
                self._conn.commit()
                _log.debug("Applied migration: %s", name)
            except sqlite3.OperationalError as e:
                # Column already exists from a previous partial run — safe to skip
                if "duplicate column name" in str(e).lower():
                    self._conn.execute(
                        "INSERT OR IGNORE INTO _migrations (name) VALUES (?)", (name,)
                    )
                    self._conn.commit()
                else:
                    _log.warning("Migration %s failed: %s", name, e)

    # ── Write ─────────────────────────────────────────────────────────────────

    def save(self, event: Event) -> None:
        score_json  = _dumps(event.score.to_dict()) if event.score else None
        score_final = event.score.final if event.score else None
        output_json = _dumps(event.output)
        output_bytes = len(output_json.encode())

        if output_bytes > MAX_OUTPUT_BYTES:
            _log.warning(
                "Event %s has a large output blob (%d bytes). "
                "Consider storing the artifact externally and setting raw_artifact_path.",
                event.event_id, output_bytes,
            )

        with self._lock:
            self._conn.execute(
                """
                INSERT OR REPLACE INTO events VALUES (
                    :id, :trace_id, :agent_id, :event_type,
                    :score_final, :score_json,
                    :features_json, :input_json, :output_json, :metadata_json,
                    :event_hash, :signature,
                    :timestamp, :version, :artifact_path, :output_bytes
                )
                """,
                {
                    "id":            event.event_id,
                    "trace_id":      event.trace_id,
                    "agent_id":      event.agent_id,
                    "event_type":    event.event_type,
                    "score_final":   score_final,
                    "score_json":    score_json,
                    "features_json": _dumps(event.features),
                    "input_json":    _dumps(event.input),
                    "output_json":   output_json,
                    "metadata_json": _dumps(event.metadata),
                    "event_hash":    event.event_hash,
                    "signature":     event.signature,
                    "timestamp":     event.timestamp,
                    "version":       event.version,
                    "artifact_path": event.raw_artifact_path,
                    "output_bytes":  output_bytes,
                },
            )
            self._conn.commit()

    # ── Read ──────────────────────────────────────────────────────────────────

    def load(self, event_id: str) -> Optional[Event]:
        row = self._conn.execute(
            "SELECT * FROM events WHERE id = ?", (event_id,)
        ).fetchone()
        return self._row_to_event(row) if row else None

    def list(
        self,
        agent_id:   Optional[str] = None,
        event_type: Optional[str] = None,
        trace_id:   Optional[str] = None,
        limit:      int           = 100,
        offset:     int           = 0,
    ) -> list[Event]:
        query  = "SELECT * FROM events WHERE 1=1"
        params: list = []
        if agent_id:
            query += " AND agent_id = ?"
            params.append(agent_id)
        if event_type:
            query += " AND event_type = ?"
            params.append(event_type)
        if trace_id:
            query += " AND trace_id = ?"
            params.append(trace_id)
        query += " ORDER BY timestamp DESC LIMIT ? OFFSET ?"
        params += [limit, offset]
        rows = self._conn.execute(query, params).fetchall()
        return [self._row_to_event(r) for r in rows]

    def leaderboard(
        self,
        agent_id:  Optional[str] = None,
        dimension: str           = "final",
        limit:     int           = 50,
    ) -> list[dict]:
        query  = "SELECT id, agent_id, event_type, score_final, timestamp FROM events WHERE score_final IS NOT NULL"
        params: list = []
        if agent_id:
            query += " AND agent_id = ?"
            params.append(agent_id)
        query += " ORDER BY score_final DESC LIMIT ?"
        params.append(limit)
        rows = self._conn.execute(query, params).fetchall()
        return [dict(r) for r in rows]

    def stats(self, agent_id: Optional[str] = None) -> dict:
        query  = "SELECT COUNT(*) as n, AVG(score_final) as mean, MAX(score_final) as best, MIN(score_final) as worst FROM events WHERE score_final IS NOT NULL"
        params: list = []
        if agent_id:
            query += " AND agent_id = ?"
            params.append(agent_id)
        row = self._conn.execute(query, params).fetchone()
        return dict(row) if row else {}

    def trace(self, trace_id: str) -> list[Event]:
        """Return all events belonging to a trace (session)."""
        return self.list(trace_id=trace_id, limit=1000)

    def delete(self, event_id: str) -> bool:
        with self._lock:
            cursor = self._conn.execute("DELETE FROM events WHERE id = ?", (event_id,))
            self._conn.commit()
        return cursor.rowcount > 0

    # ── Private ───────────────────────────────────────────────────────────────

    @staticmethod
    def _row_to_event(row: sqlite3.Row) -> Event:
        score_data = json.loads(row["score_json"]) if row["score_json"] else None
        score = None
        if score_data:
            score = ScoreBreakdown(
                dimensions=score_data.get("dimensions", {}),
                weights=score_data.get("weights", {}),
            )

        keys = row.keys()
        return Event(
            event_id          = row["id"],
            trace_id          = row["trace_id"] if "trace_id" in keys and row["trace_id"] else "",
            agent_id          = row["agent_id"],
            event_type        = row["event_type"],
            input             = json.loads(row["input_json"] or "{}"),
            output            = json.loads(row["output_json"] or "{}"),
            features          = json.loads(row["features_json"] or "{}"),
            score             = score,
            metadata          = json.loads(row["metadata_json"] or "{}"),
            timestamp         = row["timestamp"],
            version           = row["version"] or "1.0.0",
            raw_artifact_path = row["artifact_path"],
            event_hash        = row["event_hash"] or "",
            signature         = row["signature"],
        )

    def close(self) -> None:
        self._conn.close()

    def __enter__(self):
        return self

    def __exit__(self, *_):
        self.close()
