"""
FARTForge — REST API
======================
FastAPI application exposing the EventEmitter over HTTP.

v2 hardening:
  - In-memory sliding-window rate limiter (per-IP, no Redis required).
  - Payload size guard (MAX_BODY_BYTES).
  - CORS origins restricted by default (not wildcard).
  - X-Request-ID response header for tracing.
  - API key auth unchanged (X-API-Key header).
  - /health now includes version + uptime.

Endpoints
---------
POST /events                 — submit an event
GET  /events/{event_id}      — full event breakdown
GET  /events                 — list events (paginated)
POST /events/{id}/verify     — integrity check
POST /events/{id}/replay     — re-score with stored scorer
GET  /trace/{trace_id}       — all events in a trace
GET  /leaderboard            — ranked by score
GET  /agents/{id}/stats      — per-agent aggregate stats
GET  /metrics                — MetricsHook snapshot
GET  /health                 — liveness + version

Usage
-----
    uvicorn fartforge.api.server:app --reload
"""

from __future__ import annotations

import os
import time
import uuid
from collections import defaultdict, deque
from typing import Optional

try:
    from fastapi import FastAPI, HTTPException, Depends, Query, Header, Request, Response
    from fastapi.middleware.cors import CORSMiddleware
    from pydantic import BaseModel, Field
    FASTAPI_AVAILABLE = True
except ImportError:
    FASTAPI_AVAILABLE = False

# Max request body size (bytes). Default: 256 KB.
MAX_BODY_BYTES = int(os.environ.get("FARTFORGE_MAX_BODY_BYTES", 256 * 1024))

# Rate limit: max N requests per window_seconds per IP
RATE_LIMIT_MAX    = int(os.environ.get("FARTFORGE_RATE_LIMIT_MAX",     60))
RATE_LIMIT_WINDOW = int(os.environ.get("FARTFORGE_RATE_LIMIT_WINDOW",  60))  # seconds


if FASTAPI_AVAILABLE:

    from ..emitter.core import EventEmitter, EventStore
    from ..emitter.event import Event
    from ..emitter.hooks import MetricsHook, LeaderboardHook, FirehoseHook
    from ..emitter.storage.sqlite_store import SQLiteStore

    # ── Rate limiter ──────────────────────────────────────────────────────────

    class _SlidingWindowRateLimiter:
        """
        Per-key (IP) sliding-window rate limiter.
        No Redis required.  Suitable for single-process deployments.
        """
        def __init__(self, max_requests: int, window_seconds: int):
            self._max  = max_requests
            self._win  = window_seconds
            self._log: dict[str, deque] = defaultdict(deque)

        def is_allowed(self, key: str) -> bool:
            now = time.monotonic()
            window_start = now - self._win
            dq = self._log[key]
            while dq and dq[0] < window_start:
                dq.popleft()
            if len(dq) >= self._max:
                return False
            dq.append(now)
            return True

    _limiter = _SlidingWindowRateLimiter(RATE_LIMIT_MAX, RATE_LIMIT_WINDOW)

    # ── Request / Response models ─────────────────────────────────────────────

    class EmitRequest(BaseModel):
        agent_id:   str  = Field(..., min_length=1, max_length=128)
        event_type: str  = Field("generic", max_length=64)
        input:      dict = Field(default_factory=dict)
        metadata:   dict = Field(default_factory=dict)

    class EmitResponse(BaseModel):
        event_id:    str
        trace_id:    str
        agent_id:    str
        score:       Optional[dict]
        features:    dict
        event_hash:  str
        accepted:    bool
        latency_ms:  float
        timestamp:   str

    class ReplayRequest(BaseModel):
        scorer_id:    str = "default"
        new_metadata: dict = Field(default_factory=dict)

    class LeaderboardEntry(BaseModel):
        rank:      int
        score:     float
        event_id:  str
        timestamp: str

    # ── App factory ──────────────────────────────────────────────────────────

    _start_time = time.time()
    _VERSION    = "2.0.0"

    def create_app(
        emitter:       Optional[EventEmitter]    = None,
        store:         Optional[EventStore]      = None,
        metrics_hook:  Optional[MetricsHook]     = None,
        leaderboard:   Optional[LeaderboardHook] = None,
        api_key:       Optional[str]             = None,
        cors_origins:  Optional[list[str]]       = None,
        enable_rate_limit: bool                  = True,
    ) -> "FastAPI":
        """
        Build the FastAPI app.

        Parameters
        ----------
        emitter : EventEmitter, optional
        store : EventStore, optional
        api_key : str, optional
            Requires X-API-Key: <key> on all routes except /health.
        cors_origins : list[str], optional
            Allowed CORS origins.  Defaults to ["http://localhost:3000"].
            Pass ["*"] explicitly if you need open CORS (not recommended for prod).
        enable_rate_limit : bool
            Enable the sliding-window rate limiter (default: True).
        """

        _store       = store or SQLiteStore()
        _metrics     = metrics_hook or MetricsHook()
        _leaderboard = leaderboard or LeaderboardHook()

        app = FastAPI(
            title       = "FARTForge API",
            description = "Universal agent evaluation & observability platform",
            version     = _VERSION,
            docs_url    = "/docs",
            redoc_url   = "/redoc",
        )

        # CORS — restricted by default
        allowed_origins = cors_origins or ["http://localhost:3000", "http://localhost:8080"]
        app.add_middleware(
            CORSMiddleware,
            allow_origins     = allowed_origins,
            allow_credentials = True,
            allow_methods     = ["GET", "POST"],
            allow_headers     = ["Content-Type", "X-API-Key", "X-Request-ID"],
        )

        # ── Middleware: request ID + rate limit ───────────────────────────────

        @app.middleware("http")
        async def add_request_id(request: Request, call_next):
            request_id = request.headers.get("X-Request-ID", str(uuid.uuid4()))

            # Rate limit
            if enable_rate_limit:
                client_ip = request.client.host if request.client else "unknown"
                if not _limiter.is_allowed(client_ip):
                    from fastapi.responses import JSONResponse
                    return JSONResponse(
                        status_code=429,
                        content={"detail": "Rate limit exceeded. Try again shortly."},
                        headers={"X-Request-ID": request_id, "Retry-After": str(RATE_LIMIT_WINDOW)},
                    )

            response: Response = await call_next(request)
            response.headers["X-Request-ID"] = request_id
            return response

        # ── Auth dependency ───────────────────────────────────────────────────

        def auth(x_api_key: Optional[str] = Header(None)):
            if api_key and x_api_key != api_key:
                raise HTTPException(status_code=401, detail="Invalid or missing API key")

        # ── Routes ────────────────────────────────────────────────────────────

        @app.get("/health")
        def health():
            return {
                "status":   "ok",
                "service":  "fartforge",
                "version":  _VERSION,
                "uptime_s": round(time.time() - _start_time, 1),
            }

        @app.get("/metrics")
        def get_metrics(_auth=Depends(auth)):
            return _metrics.snapshot()

        @app.post("/events", response_model=EmitResponse)
        async def submit_event(request: Request, req: EmitRequest, _auth=Depends(auth)):
            # Payload size guard
            body_len = int(request.headers.get("content-length", 0))
            if body_len > MAX_BODY_BYTES:
                raise HTTPException(
                    status_code=413,
                    detail=f"Payload too large. Max {MAX_BODY_BYTES} bytes.",
                )

            if emitter is None:
                raise HTTPException(
                    status_code=503,
                    detail="No emitter configured. Pass emitter= to create_app().",
                )

            result = emitter.emit(req.input)
            if result.error:
                raise HTTPException(status_code=500, detail=result.error)

            return EmitResponse(
                event_id   = result.event.event_id,
                trace_id   = result.event.trace_id,
                agent_id   = result.event.agent_id,
                score      = result.event.score.to_dict() if result.event.score else None,
                features   = result.event.features,
                event_hash = result.event.event_hash,
                accepted   = result.accepted,
                latency_ms = result.latency_ms,
                timestamp  = result.event.timestamp,
            )

        @app.get("/events/{event_id}")
        def get_event(event_id: str, _auth=Depends(auth)):
            event = _store.load(event_id)
            if not event:
                raise HTTPException(status_code=404, detail="Event not found")
            return event.to_dict()

        @app.get("/events")
        def list_events(
            agent_id:   Optional[str] = Query(None, max_length=128),
            event_type: Optional[str] = Query(None, max_length=64),
            trace_id:   Optional[str] = Query(None),
            limit:      int           = Query(50, ge=1, le=500),
            offset:     int           = Query(0, ge=0),
            _auth=Depends(auth),
        ):
            events = _store.list(
                agent_id=agent_id,
                event_type=event_type,
                trace_id=trace_id,
                limit=limit,
                offset=offset,
            )
            return {
                "events": [e.to_dict() for e in events],
                "count":  len(events),
                "offset": offset,
            }

        @app.post("/events/{event_id}/verify")
        def verify_event(event_id: str, _auth=Depends(auth)):
            event = _store.load(event_id)
            if not event:
                raise HTTPException(status_code=404, detail="Event not found")
            return {
                "event_id": event_id,
                "verified": event.verify(),
                "hash":     event.event_hash,
            }

        @app.get("/trace/{trace_id}")
        def get_trace(trace_id: str, _auth=Depends(auth)):
            """All events belonging to a trace (agent session)."""
            events = _store.trace(trace_id)
            return {
                "trace_id": trace_id,
                "events":   [e.to_dict() for e in events],
                "count":    len(events),
            }

        @app.get("/leaderboard", response_model=list[LeaderboardEntry])
        def get_leaderboard(
            agent_id: Optional[str] = Query(None, max_length=128),
            limit:    int           = Query(20, ge=1, le=100),
            _auth=Depends(auth),
        ):
            entries = _store.leaderboard(agent_id=agent_id, limit=limit)
            return [
                LeaderboardEntry(
                    rank      = i + 1,
                    score     = e.get("score_final", 0),
                    event_id  = e.get("id", ""),
                    timestamp = e.get("timestamp", ""),
                )
                for i, e in enumerate(entries)
            ]

        @app.get("/agents/{agent_id}/stats")
        def agent_stats(agent_id: str, _auth=Depends(auth)):
            return _store.stats(agent_id=agent_id)

        return app

else:
    def create_app(*args, **kwargs):
        raise ImportError(
            "FastAPI required. pip install fastapi uvicorn"
        )
