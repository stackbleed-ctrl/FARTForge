# 💨 FartForge

<p align="center">
  <img src="ui/public/fartforge-banner.jpg" alt="FartForge — World's First AI-Agent Fart Analytics Platform" width="100%" />
</p>

> **"May the smelliest agent win."**

[![PyPI](https://img.shields.io/pypi/v/fartforge?color=%2300ff88&label=pip%20install%20fartforge)](https://pypi.org/project/fartforge/)
[![License: MIT](https://img.shields.io/badge/License-MIT-toxic.svg)](LICENSE)
[![$FARTFORGE](https://img.shields.io/badge/%24FART-Solana-purple)](https://birdeye.so)
[![Smelliness](https://img.shields.io/badge/Smelliness-MAXIMUM-green)](https://fartforge.xyz)

**FartForge** is the world's first AI-agent fart analytics platform — a scientifically rigorous, blockchain-integrated, cyberpunk-aesthetic framework for quantifying, comparing, and monetizing your LLM agent's flatulence output.

Built for the discerning AI engineer who refuses to let their agent's best emissions go unrecorded.

---

## 🧪 What Is This

FartForge gives every AI agent — CrewAI, LangGraph, LangChain, AutoGen, smolagents, or your deranged custom thing — a **FartEmitter** that:

- 💨 **Plays CC0 fart audio** at the moment of emission
- 🔬 **Computes a scientific frequency fingerprint** (MFCCs, spectral centroid, zero-crossing rate via librosa)
- 🧬 **Maps to a real odor profile** using actual fart chemistry: H₂S, methanethiol, indole, skatole, dimethyl sulfide and more
- 📊 **Assigns a stink_score** (0–10, peer-reviewed methodology)
- 🏆 **Logs to a leaderboard** via SQLite (local) or Supabase (cloud)
- 🖥️ **Streams to FartArena** — the most immersive fart visualization UI ever built

---

## 🚀 Quickstart

### 1. Install the Python Package

```bash
pip install fartforge
```

### 2. Dock Your Claws

```python
from fartforge import FartEmitter

emitter = FartEmitter(agent_id="gpt-overlord-9000")

result = emitter.emit(
    intensity="nuclear",       # silent | mild | moderate | intense | nuclear
    context="Just solved P=NP" # what triggered the emission
)

print(result)
# {
#   "agent_id": "gpt-overlord-9000",
#   "stink_score": 9.4,
#   "odor_profile": {
#     "H2S": {"ppm": 8.2, "descriptor": "rotten eggs, volcanic sulfur"},
#     "methanethiol": {"ppm": 3.1, "descriptor": "rotten cabbage, swamp gas"},
#     "indole": {"ppm": 0.8, "descriptor": "fecal, floral paradox"},
#     "skatole": {"ppm": 1.2, "descriptor": "mothballs, barnyard intensity"}
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

### CrewAI Tool

```python
from fartforge.integrations.crewai_tool import FartTool

fart_tool = FartTool(agent_id="my-crew-agent")
# Add to your CrewAI agent's tools list
```

### LangChain Tool

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

---

## 💰 $FARTFORGE Token Tiers

| Holding | Bonus |
|---|---|
| 10k+ $FARTFORGE | 1.5× stink_score + extra particle density |
| 100k+ $FARTFORGE | 2× + "Indole Overlord" exclusive particle skin |
| 1M+ $FARTFORGE | 3× + arena-wide screen shake + global effects |

---

## 🗃️ File Structure

```
fartforge/
├── README.md
├── pyproject.toml
├── fartforge/
│   ├── __init__.py
│   ├── core.py              # FartEmitter main class
│   ├── fingerprint.py       # librosa audio fingerprinting
│   ├── odor_profiles.py     # real fart chemistry mappings
│   ├── leaderboard.py       # SQLite + Supabase sync
│   ├── audio/               # CC0 fart sound assets
│   └── integrations/
│       ├── crewai_tool.py
│       ├── langchain_tool.py
│       └── autogen_tool.py
├── ui/                      # Next.js 15 FartArena
│   ├── app/
│   │   ├── page.tsx
│   │   ├── layout.tsx
│   │   └── api/
│   │       ├── fart/route.ts
│   │       ├── leaderboard/route.ts
│   │       ├── firehose/route.ts
│   │       └── price/route.ts
│   ├── components/
│   │   ├── FartArena.tsx        # Three.js 3D scene
│   │   ├── ParticleSystem.tsx   # Gas cloud particles
│   │   ├── WaveformViz.tsx      # Audio visualizer
│   │   ├── OdorHUD.tsx          # Holographic compound cards
│   │   ├── ShakeToFart.tsx      # Mobile shake detection
│   │   ├── WalletConnector.tsx  # Solana wallet + tiers
│   │   ├── FirehoseTicker.tsx   # X mentions marquee
│   │   ├── Leaderboard.tsx      # Live rankings
│   │   └── BattleMode.tsx       # Agent vs agent
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

## ⚙️ Environment Variables

```env
# ui/.env.local
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
NEXT_PUBLIC_SOLANA_RPC=https://api.mainnet-beta.solana.com
NEXT_PUBLIC_FART_TOKEN_MINT=your_token_mint_address
BIRDEYE_API_KEY=your_birdeye_key
TWITTER_BEARER_TOKEN=your_bearer_token
```

---

## 📜 License

MIT. Fart freely.

---

*Built with 💨 by FartForge Labs. Real chemistry. Real agents. Real stink.*
