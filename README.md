# FARTForge

**Universal agent evaluation, observability, and replay platform.**  
Built for the serious builder. Tokenized by `$FARTFORGE` on Solana.

---

## What is FARTForge?

Most systems log events. Some score them. FARTForge does all of this:

| Feature | Description |
|---|---|
| **Standardize** | Every agent interaction collapses into a canonical, versioned `Event` |
| **Score** | Multi-dimensional `ScoreBreakdown` with enforced weight integrity |
| **Verify** | SHA-256 hash + HMAC/Ed25519 signature per event — tamper-evident by design |
| **Store** | SQLite with WAL mode, migrations, and trace correlation |
| **Replay** | Re-run any stored event through a new scorer without touching the original |
| **Observe** | Metrics, leaderboard, firehose, alerts — all as pluggable hooks |
| **Anchor** | Write event hashes to Solana as Memo transactions — public, immutable proof |
| **Gate** | `$FARTFORGE` SPL token balance gates API tiers |

---

## Architecture

```
input
  │
  ▼
[Guard]           ← payload size check
  │
  ▼
[Generator]       ← raw artifact (audio, text, trade signal, …)
  │
  ▼
[Extractor]       ← feature dict from artifact
  │
  ▼
[Scorer]          ← ScoreBreakdown (multi-dimensional, weights sum to 1.0)
  │
  ▼
[TrustLayer]      ← compute_hash() + HMAC/Ed25519 signature
  │
  ▼
[Validator]       ← Schema + Hash + Score gates
  │
  ▼
[EventStore]      ← SQLite (WAL, migrations, trace index)
  │
  ▼
[Hooks]           ← async: Metrics / Leaderboard / Firehose / Alerts / Prometheus
  │
  ▼
[SolanaAnchor]    ← optional: event_hash → Memo tx on-chain
```

---

## Quick Start

```bash
pip install fartforge
# or for the full stack:
pip install "fartforge[all]"
```

```python
import os
os.environ["FARTFORGE_ENV"] = "development"

from fartforge import EventEmitter, FartAdapter, HMACTrustLayer, SQLiteStore

adapter = FartAdapter()
emitter = EventEmitter(
    agent_id   = "my-agent-v1",
    event_type = "audio",
    generator  = adapter,
    extractor  = adapter,
    scorer     = adapter,
    trust      = HMACTrustLayer(),
    store      = SQLiteStore("events.db"),
)

result = emitter.emit({"intensity": 9, "moisture": 0.3})
print(result.event.score.final)    # → 0.73
print(result.event.event_hash)     # → sha256 fingerprint
print(result.ok)                   # → True
```

---

## Building Your Own Pipeline

Implement three ABCs and plug them in:

```python
from fartforge import Generator, Extractor, Scorer, ScoreBreakdown

class MyGenerator(Generator):
    def generate(self, input: dict):
        return call_my_llm(input["prompt"])

class MyExtractor(Extractor):
    def extract(self, artifact):
        return {
            "coherence":  score_coherence(artifact),
            "relevance":  score_relevance(artifact),
            "toxicity":   detect_toxicity(artifact),
        }

class MyScorer(Scorer):
    def score(self, features: dict) -> ScoreBreakdown:
        return ScoreBreakdown(
            dimensions = {
                "coherence": features["coherence"],
                "relevance": features["relevance"],
                "safety":    1.0 - features["toxicity"],
            },
            weights = {"coherence": 0.4, "relevance": 0.4, "safety": 0.2},
        )
```

FARTForge does the rest — hashing, signing, storing, scoring, alerting.

---

## REST API

```bash
pip install "fartforge[api]"
```

```python
from fartforge.api.server import create_app

app = create_app(
    emitter     = my_emitter,
    api_key     = "your-api-key",
    cors_origins = ["https://your-frontend.com"],
)

# uvicorn fartforge.api.server:app --reload
```

### Endpoints

| Method | Path | Description |
|---|---|---|
| `POST` | `/events` | Submit an event |
| `GET` | `/events/{id}` | Get full event breakdown |
| `GET` | `/events` | List events (paginated, filterable by agent/type/trace) |
| `POST` | `/events/{id}/verify` | Integrity check |
| `GET` | `/trace/{trace_id}` | All events in a trace |
| `GET` | `/leaderboard` | Top events by score |
| `GET` | `/agents/{id}/stats` | Per-agent aggregate stats |
| `GET` | `/metrics` | Live MetricsHook snapshot |
| `GET` | `/health` | Liveness + version + uptime |

Rate limiting is on by default: 60 req/60s per IP (configurable via env vars).

---

## Replay Engine

The replay engine is what separates FARTForge from every other eval framework:

```python
from fartforge import ReplayEngine, FartAdapter, SQLiteStore

store  = SQLiteStore("events.db")
engine = ReplayEngine(store=store)

# Re-score a single event with a new scorer
result = engine.replay("event-uuid", scorer=MyNewScorer())
print(result.summary())

# Retroactively compare two scorers over your entire history
comparison = engine.compare_scorers(
    scorer_a  = OldScorer(),
    scorer_b  = NewScorer(),
    agent_id  = "my-agent",
)
print(f"New scorer improves {comparison['improved_pct']:.0%} of events")
print(f"Mean delta: {comparison['mean_delta']:+.4f}")
```

Original events are **never mutated**. Every replay produces a new event with a fresh ID, inheriting the original trace_id.

---

## Solana Integration

### On-Chain Event Anchoring

```python
from fartforge.solana.anchor import SolanaAnchor, anchor_event_hook

anchor  = SolanaAnchor()  # reads SOLANA_RPC_URL + SOLANA_PAYER_KEYPAIR
tx_sig  = anchor.anchor_event(event)
# event.metadata["solana_tx"] is now set

# As an EmitHook (fire-and-forget, async):
emitter = EventEmitter(..., hooks=[anchor_event_hook(anchor)])

# Verify later:
assert anchor.verify_anchor(event)
```

Each anchor tx costs ~0.000005 SOL. The memo contains:
```json
{"ff":"fartforge","h":"sha256hash","a":"agent-id","ts":"2025-01-01T..."}
```

### $FARTFORGE Token Gating

```python
from fartforge.solana.token_gate import TokenGate, Tier, tier_required

gate    = TokenGate()
require = tier_required(gate)

# FastAPI route — requires ≥ 1,000 $FARTFORGE in X-Wallet header
@app.post("/events/{id}/replay")
def replay(_=Depends(require("PRO"))):
    ...
```

| Tier | $FARTFORGE Required | Features |
|---|---|---|
| FREE | 0 | Public leaderboard read |
| BASIC | 100 | Submit events (rate-limited) |
| PRO | 1,000 | Full API + higher rate limits |
| ELITE | 10,000 | Replay engine + Solana anchoring + firehose |

---

## Security Hardening (v2)

| Issue (v1) | Fix (v2) |
|---|---|
| Insecure default HMAC secret | Raises `ValueError` in production if `FARTFORGE_SECRET` is unset |
| No key rotation | `HMACTrustLayer(secret=[new_key, old_key])` — signs with `[0]`, verifies against all |
| Signature had no versioning | `v1:hex` prefix enables future algorithm rotation |
| No score weight enforcement | `ScoreBreakdown.__post_init__` raises if weights ≠ 1.0 |
| No dimension bounds check | `ScoreBreakdown.validate()` rejects values outside `[0, 1]` |
| SQLite concurrency issues | `threading.Lock` + WAL journal mode |
| No schema migrations | `_migrations` table, apply-once idempotent |
| Hook blocking pipeline | `ThreadPoolExecutor` — hooks are async by default |
| No payload size guard | `max_input_bytes` parameter (default 256 KB) |
| No rate limiting | Sliding-window per-IP rate limiter (no Redis required) |
| Wildcard CORS | Restricted origins by default |
| Replay artifact ambiguity | Explicit `require_artifact` flag + warning |
| No request tracing | `trace_id` field + `X-Request-ID` header |

---

## Environment Variables

See [`.env.example`](.env.example) for all variables.

Key ones:

```bash
FARTFORGE_ENV=production          # enables strict secret enforcement
FARTFORGE_SECRET=your-secret      # required in production
SOLANA_RPC_URL=https://...        # Solana RPC
SOLANA_PAYER_KEYPAIR=...          # base58 keypair JSON (for anchoring)
FARTFORGE_TOKEN_MINT=FART...      # $FARTFORGE SPL token mint
```

---

## Tests

```bash
pip install "fartforge[dev]"
pytest tests/ -v
```

---

## License

MIT — see [LICENSE](LICENSE).

---

> FARTForge: the only agent eval platform with on-chain integrity proofs and a meme coin.  
> Built in Sydney, Nova Scotia. Shipped by [`stackbleed-ctrl`](https://github.com/stackbleed-ctrl).
