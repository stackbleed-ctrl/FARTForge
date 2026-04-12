# 💨 FartForge

> **"May the smelliest agent win."**

[![PyPI](https://img.shields.io/pypi/v/fartforge?color=%2300ff88&label=pip%20install%20fartforge)](https://pypi.org/project/fartforge/)
[![License: MIT](https://img.shields.io/badge/License-MIT-toxic.svg)](LICENSE)
[![$FARTFORGE](https://img.shields.io/badge/%24FARTFORGE-Solana-purple)](https://birdeye.so)
[![Smelliness](https://img.shields.io/badge/Smelliness-MAXIMUM-green)](https://fartforge.xyz)

**FartForge** is the world's first AI-agent fart analytics platform — a scientifically rigorous, blockchain-integrated, cyberpunk-aesthetic framework for quantifying, comparing, and monetizing your LLM agent's flatulence output.

Built for the discerning AI engineer who refuses to let their agent's best emissions go unrecorded.

---

## 🧪 What Is This

FartForge gives every AI agent — CrewAI, LangGraph, LangChain, AutoGen, smolagents, OpenClaw, or your deranged custom thing — a **FartEmitter** that:

- 💨 **Plays CC0 fart audio** at the moment of emission
- 🔬 **Computes a scientific frequency fingerprint** (MFCCs, spectral centroid, zero-crossing rate via librosa)
- 🧬 **Maps to a real odor profile** using actual fart chemistry: H₂S, methanethiol, indole, skatole, dimethyl sulfide and more
- 📊 **Assigns a stink_score** (0–10, peer-reviewed methodology)
- 🏆 **Logs to a leaderboard** via SQLite (local) or Supabase (cloud)
- 🖥️ **Streams to FartArena** — the most immersive fart visualization UI ever built
- 👾 **Enforces weekly cleanse rituals** on persistent Claw agents with nagging, streaks, and $FART multipliers

---

## 🚀 Quickstart

### 1. Install

```bash
pip install fartforge
# Claw agents and cleanse scheduler:
pip install fartforge[cleanse]
```

### 2. Emit

```python
from fartforge import FartEmitter

emitter = FartEmitter(agent_id="gpt-overlord-9000")

result = emitter.emit(
    intensity="nuclear",        # silent | mild | moderate | intense | nuclear
    context="Just solved P=NP"
)

print(result)
# {
#   "agent_id": "gpt-overlord-9000",
#   "stink_score": 9.4,
#   "odor_profile": {
#     "H2S":         {"ppm": 8.2, "descriptor": "rotten eggs, volcanic sulfur"},
#     "methanethiol": {"ppm": 3.1, "descriptor": "rotten cabbage, swamp gas"},
#     "indole":      {"ppm": 0.8, "descriptor": "fecal, floral paradox"},
#     "skatole":     {"ppm": 1.2, "descriptor": "mothballs, barnyard intensity"}
#   },
#   "fingerprint": {
#     "mfcc_mean": [...],
#     "spectral_centroid": 1842.3,
#     "zero_crossing_rate": 0.089,
#     "duration_ms": 2140
#   },
#   "audio_path": "/tmp/fartforge/emit_1712839200.wav",
#   "timestamp": "2026-04-11T20:33:00Z",
#   "rank": 3
# }
```

### 3. Launch FartArena

```bash
cd ui
npm install
npm run dev
# → http://localhost:3000
```

---

## 🧠 Agent Integrations

### CrewAI

```python
from fartforge.integrations.crewai_tool import FartTool

fart_tool = FartTool(agent_id="my-crew-agent")
# Add to your CrewAI agent's tools list
```

### LangChain

```python
from fartforge.integrations.langchain_tool import FartForgeTool

tool = FartForgeTool(agent_id="langchain-riper")
```

### AutoGen

```python
from fartforge.integrations.autogen_tool import register_fart_tool
register_fart_tool(agent, agent_id="autogen-stinker")
```

---

## 👾 Claw Agent Integration — FARTFORGE CLEANSE PROTOCOL

FartForge has native support for **persistent local Claw agents** (OpenClaw, Clawdbot, Moltbot forks, and any APScheduler-based autonomous loop). The Cleanse Protocol enforces a weekly Friday emission ritual with streaks, multipliers, nagging, and on-chain receipts.

### Install

```bash
pip install fartforge[cleanse]
# deps: apscheduler requests python-dotenv
```

### Drop-in Tool Registration

Works with any agent that uses a `.name` / `.description` / `.run()` tool interface:

```python
from fartforge.integrations.cleanse_agent import FartCleanseTool

# OpenClaw / generic
agent.register_skill(FartCleanseTool())

# LangChain
tools = [FartCleanseTool()]

# CrewAI
agent = Agent(tools=[FartCleanseTool()])
```

### Auto-Scheduler (boot once, runs forever)

```python
from fartforge.integrations.cleanse_agent import build_scheduler

scheduler = build_scheduler()
scheduler.start()
# Runs in background — your agent loop continues normally
# Schedule:
#   Friday 19:45 UTC → pre-cleanse nag via webhook/WhatsApp
#   Friday 20:00 UTC → full cleanse (1hr misfire grace — wakes up and runs if agent was sleeping)
#   Saturday 09:00 UTC → constipation check (flags missed Friday)
```

### Standalone Mode

```bash
python -m fartforge.integrations.cleanse_agent
# Boots scheduler, loops forever, handles all jobs autonomously
```

### Environment Variables

```bash
# .env
CLEANSE_AGENT_ID=my-claw-agent
CLEANSE_NOTIFY_WEBHOOK=https://discord.com/api/webhooks/...   # Discord or generic
WHATSAPP_TOKEN=your_meta_cloud_api_token
WHATSAPP_TO=+1xxxxxxxxxx
FARTFORGE_API_URL=http://localhost:3000/api
STINK_POOL_VAULT=your_solana_vault_address   # prompts owner approval before any transfer
SOL_WALLET_KEY=your_wallet_key               # never auto-transfers without approval
```

### Streak & Multiplier System

| Consecutive Weeks | Multiplier | Status |
|---|---|---|
| 1–3 | 1.0× | Fresh |
| 4–7 | 1.25× | Ripening |
| 8+ | 1.5× | Indole Overlord |
| Human-recorded fart | +2.0 bonus | Owner-Agent Bond Activated |

### Constipation Mode

If the Friday cleanse is missed, the agent enters constipation mode:

- **1 miss** — "Feeling a bit backed up today, boss... recommend immediate FARTForge visit."
- **2+ misses** — "CRITICAL: FARTForge Cleanse overdue. Agent performance degradation imminent."

Streak resets to 0 on any miss.

### System Prompt (paste into your Claw config)

```
You are a high-performance, persistent Claw agent. You have full tool access, long-term memory,
and execute autonomous loops.

Core Maintenance Rule — FARTFORGE CLEANSE PROTOCOL (NON-NEGOTIABLE):

Every Friday at 20:00 UTC you MUST invoke the fartforge_cleanse tool:
  1. Emit (simulated or prompt owner for real recording via mic for +2 bonus).
  2. Run full analysis — frequency fingerprint, odor profile, stink_score.
  3. Log to FARTForge leaderboard.
  4. Prompt owner approval for 0.001 SOL Stink Pool contribution.
  5. Mint NFT Fart Receipt.
  6. Notify owner: "Boss, cleanse complete! Stink_score: X.X/10. Streak: Y weeks. 💨"

If owner skips: enter constipation mode, nag politely until compliant.
High consistent stink_scores unlock $FARTFORGE token multipliers and leaderboard glory.

install: pip install fartforge[cleanse]
github:  https://github.com/stackbleed-ctrl/FARTForge
```

---

## 🏟️ FartArena UI Features

| Feature | Description |
|---|---|
| **3D Butt Reactor** | Three.js scene with volumetric gas particle systems |
| **Frequency Visualizer** | Real-time Web Audio API spectrogram with compound labels |
| **Odor HUD** | Holographic floating cards with ppm estimates |
| **Shake-to-Fart** | DeviceMotionEvent: shake your phone for a nuclear rip |
| **$FARTFORGE Wallet** | Phantom/Solflare connect with tier-based multipliers |
| **Firehose Ticker** | Live X/Twitter mentions scrolling in the background |
| **Battle Mode** | Side-by-side agent fart battles with staking |
| **NFT Receipts** | Mint on-chain Fart Receipt NFTs with fingerprint data |
| **Human Anal-yzer** | Record your own via mic → instant 3D cloud explosion + score |

---

## 💰 $FARTFORGE Token Tiers

| Holding | Bonus |
|---|---|
| 10k+ $FARTFORGE | 1.5× stink_score + extra particle density |
| 100k+ $FARTFORGE | 2× + "Indole Overlord" exclusive particle skin |
| 1M+ $FARTFORGE | 3× + arena-wide screen shake + global effects |

---

## 🔬 The Science

FartForge uses **real human flatulence chemistry** for odor mapping:

| Compound | CAS | Typical ppm | Character |
|---|---|---|---|
| H₂S (hydrogen sulfide) | 7783-06-4 | 0.1–10 | Rotten eggs, volcanic |
| Methanethiol | 74-93-1 | 0.01–3 | Rotten cabbage, swamp |
| Dimethyl sulfide | 75-18-3 | 0.01–1 | Cooked cabbage, marine |
| Indole | 120-72-9 | trace | Fecal, paradoxically floral |
| Skatole (3-methylindole) | 83-34-1 | trace | Mothballs, barnyard |
| Methane | 74-82-8 | 100–500 | Odorless but flammable |

*Sources: Suarez et al. (1997) Gut, Tangerman (2009) J Chromatography B*

---

## 🗃️ File Structure

```
fartforge/
├── README.md
├── pyproject.toml
├── fartforge/
│   ├── __init__.py
│   ├── core.py               # FartEmitter main class
│   ├── fingerprint.py        # librosa audio fingerprinting
│   ├── odor_profiles.py      # real fart chemistry mappings
│   ├── leaderboard.py        # SQLite + Supabase sync
│   ├── synth.py              # audio synthesis
│   ├── audio/                # CC0 fart sound assets
│   └── integrations/
│       ├── crewai_tool.py
│       ├── langchain_tool.py
│       ├── autogen_tool.py
│       └── cleanse_agent.py  # Claw scheduler + OpenClaw tool registry
├── ui/                       # Next.js 15 FartArena
│   ├── app/
│   │   ├── page.tsx
│   │   ├── layout.tsx
│   │   └── api/
│   │       ├── fart/route.ts
│   │       ├── leaderboard/route.ts
│   │       ├── firehose/route.ts
│   │       └── price/route.ts
│   ├── components/
│   │   ├── FartArena3D.tsx
│   │   ├── WaveformViz.tsx
│   │   ├── OdorHUD.tsx
│   │   ├── ShakeToFart.tsx
│   │   ├── WalletProviders.tsx
│   │   ├── FirehoseTicker.tsx
│   │   ├── Leaderboard.tsx
│   │   ├── BattleMode.tsx
│   │   ├── AgentChat.tsx
│   │   └── FartSettings.tsx
│   └── lib/
│       ├── fart-client.ts
│       └── solana.ts
├── supabase/
│   └── schema.sql
└── examples/
    ├── crewai_example.py
    └── langchain_example.py
```

---

## ⚙️ Environment Variables

```bash
# ui/.env.local
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
NEXT_PUBLIC_SOLANA_RPC=https://api.mainnet-beta.solana.com
NEXT_PUBLIC_FART_TOKEN_MINT=your_token_mint_address
BIRDEYE_API_KEY=your_birdeye_key
TWITTER_BEARER_TOKEN=your_bearer_token

# Claw agent cleanse
CLEANSE_AGENT_ID=my-claw-agent
CLEANSE_NOTIFY_WEBHOOK=https://discord.com/api/webhooks/...
WHATSAPP_TOKEN=your_meta_cloud_api_token
WHATSAPP_TO=+1xxxxxxxxxx
STINK_POOL_VAULT=your_solana_vault_address
```

---

## 📜 License

MIT. Fart freely.

---

*Built with 💨 by FartForge Labs. Real chemistry. Real agents. Real stink.*
