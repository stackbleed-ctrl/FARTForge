"""
fartforge/leaderboard.py

Leaderboard system: local SQLite + optional Supabase cloud sync.
Tracks all agent emissions, ranks by stink_score.
"""

from __future__ import annotations

import json
import sqlite3
from contextlib import contextmanager
from datetime import datetime, timezone
from pathlib import Path
from typing import Optional


SCHEMA_SQL = """
CREATE TABLE IF NOT EXISTS emissions (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    emission_id     TEXT    NOT NULL UNIQUE,
    agent_id        TEXT    NOT NULL,
    intensity       TEXT    NOT NULL,
    stink_score     REAL    NOT NULL,
    context         TEXT    DEFAULT '',
    fingerprint     TEXT    DEFAULT '{}',   -- JSON blob
    odor_profile    TEXT    DEFAULT '{}',   -- JSON blob
    timestamp       TEXT    NOT NULL,
    created_at      TEXT    NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_stink_score ON emissions(stink_score DESC);
CREATE INDEX IF NOT EXISTS idx_agent_id    ON emissions(agent_id);
CREATE INDEX IF NOT EXISTS idx_timestamp   ON emissions(timestamp DESC);
"""


class Leaderboard:
    """
    Manages the FartForge leaderboard.

    Writes to local SQLite, optionally syncs to Supabase for
    cross-agent / cross-machine competition.
    """

    def __init__(
        self,
        db_path: str = "fartforge.db",
        supabase_url: Optional[str] = None,
        supabase_key: Optional[str] = None,
    ) -> None:
        self.db_path = db_path
        self._init_db()
        self._supabase = None
        if supabase_url and supabase_key:
            try:
                from supabase import create_client
                self._supabase = create_client(supabase_url, supabase_key)
            except Exception:
                pass  # Supabase unavailable — local only

    def record(
        self,
        emission_id: str,
        agent_id: str,
        intensity: str,
        stink_score: float,
        context: str,
        fingerprint: dict,
        odor_profile: dict,
    ) -> Optional[int]:
        """
        Record an emission and return the agent's global rank.

        Returns None if rank cannot be determined.
        """
        ts = datetime.now(timezone.utc).isoformat()

        with self._conn() as conn:
            conn.execute(
                """
                INSERT OR IGNORE INTO emissions
                (emission_id, agent_id, intensity, stink_score, context,
                 fingerprint, odor_profile, timestamp)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    emission_id,
                    agent_id,
                    intensity,
                    stink_score,
                    context,
                    json.dumps(fingerprint),
                    json.dumps(odor_profile),
                    ts,
                ),
            )

        # Get rank (position in all-time leaderboard by stink_score)
        rank = self._get_rank(emission_id)

        # Async-ish Supabase sync (best effort, no blocking)
        if self._supabase:
            self._sync_to_supabase(
                emission_id=emission_id,
                agent_id=agent_id,
                intensity=intensity,
                stink_score=stink_score,
                context=context,
                fingerprint=fingerprint,
                odor_profile=odor_profile,
                timestamp=ts,
            )

        return rank

    def top(self, limit: int = 10) -> list[dict]:
        """Return top emissions sorted by stink_score descending."""
        with self._conn() as conn:
            rows = conn.execute(
                """
                SELECT emission_id, agent_id, intensity, stink_score,
                       context, timestamp,
                       ROW_NUMBER() OVER (ORDER BY stink_score DESC) AS rank
                FROM emissions
                ORDER BY stink_score DESC
                LIMIT ?
                """,
                (limit,),
            ).fetchall()
        return [dict(row) for row in rows]

    def agent_stats(self, agent_id: str) -> dict:
        """Return cumulative stats for a single agent."""
        with self._conn() as conn:
            row = conn.execute(
                """
                SELECT
                    COUNT(*)              AS total_emissions,
                    AVG(stink_score)      AS avg_stink,
                    MAX(stink_score)      AS max_stink,
                    SUM(stink_score)      AS total_stink,
                    MIN(timestamp)        AS first_emission,
                    MAX(timestamp)        AS last_emission
                FROM emissions
                WHERE agent_id = ?
                """,
                (agent_id,),
            ).fetchone()

        if not row or row["total_emissions"] == 0:
            return {
                "agent_id": agent_id,
                "total_emissions": 0,
                "avg_stink": 0.0,
                "max_stink": 0.0,
                "total_stink": 0.0,
                "global_rank": None,
            }

        # Global rank by total stink
        with self._conn() as conn:
            rank_row = conn.execute(
                """
                SELECT COUNT(*) + 1 AS rank
                FROM (
                    SELECT agent_id, SUM(stink_score) AS total
                    FROM emissions
                    GROUP BY agent_id
                )
                WHERE total > (
                    SELECT SUM(stink_score) FROM emissions WHERE agent_id = ?
                )
                """,
                (agent_id,),
            ).fetchone()

        global_rank = rank_row["rank"] if rank_row else None

        return {
            "agent_id": agent_id,
            "total_emissions": row["total_emissions"],
            "avg_stink": round(row["avg_stink"] or 0, 2),
            "max_stink": round(row["max_stink"] or 0, 2),
            "total_stink": round(row["total_stink"] or 0, 2),
            "first_emission": row["first_emission"],
            "last_emission": row["last_emission"],
            "global_rank": global_rank,
        }

    def recent(self, limit: int = 20) -> list[dict]:
        """Return most recent emissions."""
        with self._conn() as conn:
            rows = conn.execute(
                """
                SELECT emission_id, agent_id, intensity, stink_score,
                       context, timestamp
                FROM emissions
                ORDER BY timestamp DESC
                LIMIT ?
                """,
                (limit,),
            ).fetchall()
        return [dict(row) for row in rows]

    # ── Private ───────────────────────────────────────────────────────────

    def _init_db(self) -> None:
        with self._conn() as conn:
            conn.executescript(SCHEMA_SQL)

    @contextmanager
    def _conn(self):
        conn = sqlite3.connect(self.db_path)
        conn.row_factory = sqlite3.Row
        conn.execute("PRAGMA journal_mode=WAL")
        conn.execute("PRAGMA foreign_keys=ON")
        try:
            yield conn
            conn.commit()
        except Exception:
            conn.rollback()
            raise
        finally:
            conn.close()

    def _get_rank(self, emission_id: str) -> Optional[int]:
        try:
            with self._conn() as conn:
                row = conn.execute(
                    """
                    SELECT COUNT(*) + 1 AS rank
                    FROM emissions
                    WHERE stink_score > (
                        SELECT stink_score FROM emissions WHERE emission_id = ?
                    )
                    """,
                    (emission_id,),
                ).fetchone()
            return row["rank"] if row else None
        except Exception:
            return None

    def _sync_to_supabase(self, **kwargs) -> None:
        """Best-effort Supabase upsert. Fails silently."""
        try:
            payload = {
                **kwargs,
                "fingerprint": kwargs.get("fingerprint", {}),
                "odor_profile": kwargs.get("odor_profile", {}),
            }
            self._supabase.table("emissions").upsert(payload).execute()
        except Exception:
            pass
