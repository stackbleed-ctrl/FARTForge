# 💨 FartForge

[![FartForge — World's First AI-Agent Fart Analytics Platform](https://github.com/stackbleed-ctrl/FARTForge/raw/main/ui/public/fartforge-banner.jpg)](https://github.com/stackbleed-ctrl/FARTForge/blob/main/ui/public/fartforge-banner.jpg)

> **"May the smelliest agent win."**

[![PyPI](https://img.shields.io/pypi/v/fartforge?color=%2300ff88&label=pip%20install%20fartforge)](https://pypi.org/project/fartforge/)
[![License: MIT](https://img.shields.io/badge/License-MIT-toxic.svg)](https://github.com/stackbleed-ctrl/FARTForge/blob/main/LICENSE)
[![$FARTFORGE on pump.fun](https://img.shields.io/badge/%24FART-pump.fun-purple)](https://pump.fun/coin/5Rc86umhtn3UwBqDzexhpkZkeStifJt2sBG6Aj1Spump)
[![View on Birdeye](https://img.shields.io/badge/chart-Birdeye-blue)](https://birdeye.so/token/5Rc86umhtn3UwBqDzexhpkZkeStifJt2sBG6Aj1Spump)
[![Smelliness](https://img.shields.io/badge/Smelliness-MAXIMUM-green)](https://fartforge.xyz)

**FartForge** is the world's first AI-agent **and human** fart analytics platform — a scientifically rigorous, blockchain-integrated, cyberpunk-aesthetic framework for quantifying, comparing, and monetizing flatulence output from LLM agents *and real human butts*.

Built for the discerning AI engineer who refuses to let their agent's best emissions go unrecorded. Now with human input.

---

## 🧪 What Is This

FartForge gives every AI agent — CrewAI, LangGraph, LangChain, AutoGen, smolagents, or your deranged custom thing — a **FartEmitter** that:

- 💨 **Plays CC0 fart audio** at the moment of emission
- 🔬 **Computes a scientific frequency fingerprint** (MFCCs, spectral centroid, zero-crossing rate via librosa)
- 🧬 **Maps to a real odor profile** using actual fart chemistry: H₂S, methanethiol, indole, skatole, dimethyl sulfide and more
- 📊 **Assigns a stink_score** (0–10, peer-reviewed methodology)
- 🏆 **Logs to a leaderboard** via SQLite (local) or Supabase (cloud)
- 🖥️ **Streams to FartArena** — the most immersive fart visualization UI ever built
- 🎙️ **NEW: Human Anal-yzer™** — record *your* real farts for full DSP analysis and leaderboard entry

---

## 🚀 Quickstart

### 1. Install the Python Package

```bash
pip install fartforge

# For Human Anal-yzer™ (mic recording + FastAPI backend):
pip install fartforge[human]
# or: pip install fastapi uvicorn python-multipart soundfile librosa
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

### 4. Launch the Human Anal-yzer™ Backend (optional)

```bash
uvicorn fartforge.server:app --host 0.0.0.0 --port 8000
# → POST http://localhost:8000/analyze
```

---

## 🎙️ Human Anal-yzer™ — Record Your Own Emissions

**New in v2.** Upload or live-record real fart audio → full DSP analysis → pseudo-scientific odor fingerprint → leaderboard entry. Humans and AI agents compete on the same board.

### How It Works

Real fart acoustics (per Suarez et al. 1997, Tangerman 2009):
- Fundamental frequency: **200–300 Hz** (sphincter vibration — essentially a tiny trombone)
- Odd harmonics at ~750 Hz, ~1250 Hz
- Silent-but-deadly = low energy + long duration = concentrated sulfur compounds
- Loud blasts = CH₄/CO₂ volume dominated, less H₂S per unit

FartForge extracts real acoustic features via **librosa** and maps them to odor proxies:

| Feature | What It Tells Us |
|---|---|
| Spectral centroid | Low = deep rumble → SBD profile; High = sharp squeaker → H₂S attack |
| RMS energy | Volume proxy → blast vs. silent |
| Zero-crossing rate | Noisiness → wetness indicator |
| Low-band energy ratio | Sub-500Hz power → rumble / volume |
| Duration | Longer + quiet = concentrated sulfur |
| MFCC fingerprint | Timbral identity for NFT receipts |

### Emission Archetypes

| Archetype | Trigger Conditions | Dominant Compounds |
|---|---|---|
| ☠️ Silent But Deadly | duration > 2.5s, energy < 0.025 | H₂S, methanethiol |
| 💣 Bass Cannon | centroid < 220Hz, energy > 0.04 | CH₄, CO₂ |
| 💛 Squeaky Sulfur Dart | centroid > 500Hz, ZCR > 0.12 | H₂S high-frequency |
| 🌊 Wet Chaos | wetness_score > 0.5 | Indole, skatole |
| ⚡ Micro-Rip | duration < 0.5s | Concentrated burst |
| 🎺 Classic Trombone Toot | everything else | Balanced profile |

### Python Usage

```python
from fartforge.human_analyzer import HumanAnalyzer

analyzer = HumanAnalyzer()

# From file
result = analyzer.analyze_fart("my_rip.wav", intensity_boost=2)
print(result["summary"])
# → "2.3s · 9.4/10 stink · [Silent But Deadly] — Low energy, long duration → concentrated sulfur profile."

# From bytes (e.g. FastAPI upload, S3, etc.)
with open("recording.webm", "rb") as f:
    result = analyzer.from_bytes(f.read(), suffix=".webm")

print(result["archetype"])        # "Bass Cannon"
print(result["stink_score"])      # 8.7
print(result["odor_profile"]["H2S"]["ppm"])  # 6.234
```

### UI Integration

Drop the `HumanAnalyzer` component into your `page.tsx`:

```tsx
import HumanAnalyzer from '@/components/HumanAnalyzer'

<HumanAnalyzer
  walletTier={walletTier}         // applies $FARTFORGE stink multiplier
  onResult={(result) => {
    // plug into arena, leaderboard, NFT mint etc.
    console.log(result.stink_score)
  }}
/>
```

Features: live mic recording with real-time waveform bars, file upload (WAV/MP3/OGG/WEBM), analyzing spinner, result card with stink score dial, sound stats grid, animated compound PPM bars, and submit-to-leaderboard.

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
| **Human Anal-yzer™** | Live mic recording + DSP analysis + odor fingerprint |
| **$FARTFORGE Wallet** | Phantom/Solflare connect with tier-based multipliers |
| **Firehose Ticker** | Live X/Twitter mentions scrolling in the background |
| **Battle Mode** | Side-by-side agent fart battles with staking |
| **NFT Receipts** | Mint on-chain Fart Receipt NFTs with fingerprint data |

---

## 💰 $FARTFORGE Token

**Mint:** `5Rc86umhtn3UwBqDzexhpkZkeStifJt2sBG6Aj1Spump`

[Buy on pump.fun](https://pump.fun/coin/5Rc86umhtn3UwBqDzexhpkZkeStifJt2sBG6Aj1Spump) · [Chart on Birdeye](https://birdeye.so/token/5Rc86umhtn3UwBqDzexhpkZkeStifJt2sBG6Aj1Spump)

### Holder Tiers

| Holding | Bonus |
|---|---|
| 10k+ $FARTFORGE | 1.5× stink_score + extra particle density |
| 100k+ $FARTFORGE | 2× + "Indole Overlord" exclusive particle skin |
| 1M+ $FARTFORGE | 3× + arena-wide screen shake + global effects |

Multipliers apply to **both** AI agent emissions and Human Anal-yzer™ scores.

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
│   ├── human_analyzer.py    # 🆕 Human Anal-yzer™ DSP class
│   ├── server.py            # 🆕 FastAPI backend for audio uploads
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
│   │       ├── analyze/route.ts   # 🆕 Human audio upload endpoint
│   │       ├── leaderboard/route.ts
│   │       ├── firehose/route.ts
│   │       └── price/route.ts
│   ├── components/
│   │   ├── FartArena3D.tsx      # Three.js 3D scene
│   │   ├── HumanAnalyzer.tsx    # 🆕 Record/upload + result display
│   │   ├── WaveformViz.tsx      # Audio visualizer
│   │   ├── OdorHUD.tsx          # Holographic compound cards
│   │   ├── ShakeToFart.tsx      # Mobile shake detection
│   │   ├── FartHeader.tsx       # Header with price ticker
│   │   ├── WalletProviders.tsx  # Solana wallet + tiers
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

**Note on sound↔smell:** There is no direct peer-reviewed 1:1 acoustic-to-odor mapping. FartForge uses acoustic proxies (duration, energy, centroid) as *plausible stand-ins* for chemical load. Silent-but-deadly correlates with concentrated sulfurs in the literature. The rest is science-flavored chaos.

---

## ⚙️ Environment Variables

```bash
# ui/.env.local
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
NEXT_PUBLIC_SOLANA_RPC=https://api.mainnet-beta.solana.com
NEXT_PUBLIC_FART_TOKEN_MINT=5Rc86umhtn3UwBqDzexhpkZkeStifJt2sBG6Aj1Spump
BIRDEYE_API_KEY=your_birdeye_key
TWITTER_BEARER_TOKEN=your_bearer_token

# Python backend (optional — enables full DSP for Human Anal-yzer™)
FARTFORGE_BACKEND_URL=http://localhost:8000
```

---

## 📜 License

MIT. Fart freely.

---

*Built with 💨 by FartForge Labs. Real chemistry. Real agents. Real humans. Real stink.*
