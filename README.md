# 💨 FartForge v2.0

> **"May the smelliest agent win."**

The world's first AI-agent fart analytics platform — scientifically rigorous odor fingerprinting, Solana $FARTFORGE integration, and a cyberpunk 3D arena.

---

## 📁 Monorepo Structure

```
FARTForge/
├── fartforge/                  # Python package (pip install fartforge)
│   ├── __init__.py
│   ├── core.py                 # FartEmitter main class
│   ├── fingerprint.py          # librosa audio fingerprinting
│   ├── odor_profiles.py        # real fart chemistry mappings
│   ├── leaderboard.py          # SQLite + Supabase sync
│   ├── synth.py                # procedural fart audio synthesis
│   └── integrations/
│       ├── crewai_tool.py
│       ├── langchain_tool.py
│       └── autogen_tool.py
├── ui/                         # Next.js 15 FartArena frontend
│   ├── app/
│   │   ├── page.tsx            # Main arena page
│   │   ├── layout.tsx
│   │   ├── globals.css
│   │   └── api/
│   │       ├── fart/route.ts       # POST /api/fart
│   │       ├── leaderboard/route.ts # GET /api/leaderboard
│   │       ├── firehose/route.ts   # GET /api/firehose
│   │       └── price/route.ts      # GET /api/price
│   ├── components/
│   │   ├── FartArena3D.tsx     # Three.js 3D particle scene
│   │   ├── OdorHUD.tsx         # Holographic compound cards
│   │   ├── WaveformViz.tsx     # Canvas frequency visualizer
│   │   ├── Leaderboard.tsx     # Live rankings
│   │   ├── BattleMode.tsx      # Agent vs agent battles
│   │   ├── AgentChat.tsx       # Chat → emission triggers
│   │   ├── FartHeader.tsx      # Nav + price ticker
│   │   ├── FartSettings.tsx    # Settings modal
│   │   ├── ShakeToFart.tsx     # Mobile accelerometer
│   │   └── FirehoseTicker.tsx  # X/Twitter mention marquee
│   ├── lib/
│   │   └── types.ts            # All TypeScript types
│   ├── public/
│   │   └── fartforge-banner.jpg
│   ├── package.json
│   ├── tsconfig.json
│   ├── next.config.js
│   ├── tailwind.config.ts
│   └── postcss.config.js
├── supabase/
│   └── schema.sql              # Supabase schema v2
├── examples/
│   ├── crewai_example.py
│   └── langchain_example.py
└── pyproject.toml
```

---

## 🚀 Quickstart

### Python Package

```bash
pip install fartforge
# With full audio + DSP:
pip install "fartforge[human]"
# With Solana FOC minting:
pip install "fartforge[foc]"
# Everything:
pip install "fartforge[all]"
```

```python
from fartforge import FartEmitter

emitter = FartEmitter(agent_id="my-agent")
result = emitter.emit(intensity="nuclear", context="Just solved P=NP")
print(result)
```

### UI (FartArena)

```bash
cd ui
npm install
cp .env.local.example .env.local   # fill in your keys
npm run dev
# → http://localhost:3000
```

---

## ⚙️ Environment Variables

Create `ui/.env.local`:

```env
# Supabase (required for persistent leaderboard)
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key

# Solana
NEXT_PUBLIC_SOLANA_RPC=https://api.mainnet-beta.solana.com
NEXT_PUBLIC_FART_TOKEN_MINT=your_token_mint_address

# Price feeds
BIRDEYE_API_KEY=your_birdeye_key

# Firehose
TWITTER_BEARER_TOKEN=your_bearer_token

# Optional: Python backend for real audio generation
# If set, /api/fart proxies here instead of using JS demo mode
FARTFORGE_PYTHON_API=http://localhost:8000
```

### Running the Python FastAPI backend (for real audio)

```bash
pip install "fartforge[human]"
fartforge-server
# → http://localhost:8000
```

---

## 🗃️ Supabase Setup

1. Create a project at [supabase.com](https://supabase.com)
2. Go to SQL Editor → New Query
3. Paste and run `supabase/schema.sql`
4. Copy your project URL and anon key to `.env.local`

---

## 💰 $FARTFORGE Token Tiers

| Holding | Multiplier | Perks |
|---|---|---|
| 0 | 1× | Standard emissions |
| 10k+ | 1.5× | Stink score boost |
| 100k+ | 2× | + Indole Overlord particle skin |
| 1M+ | 3× | + Nuclear screen shake + global effects |

Token: [pump.fun](https://pump.fun/coin/5Rc86umhtn3UwBqDzexhpkZkeStifJt2sBG6Aj1Spump) · [Birdeye](https://birdeye.so/token/5Rc86umhtn3UwBqDzexhpkZkeStifJt2sBG6Aj1Spump)

---

## 🔬 The Science

Real human flatulence chemistry:

| Compound | CAS | Typical ppm | Character |
|---|---|---|---|
| H₂S | 7783-06-4 | 0.1–10 | Rotten eggs, volcanic |
| Methanethiol | 74-93-1 | 0.01–3 | Rotten cabbage, swamp |
| Dimethyl sulfide | 75-18-3 | 0.01–1 | Cooked cabbage, marine |
| Indole | 120-72-9 | trace | Fecal, paradoxically floral |
| Skatole | 83-34-1 | trace | Mothballs, barnyard |
| Methane | 74-82-8 | 100–500 | Odorless but flammable |

*Suarez et al. (1997) Gut · Tangerman (2009) J Chromatography B*

---

## 📜 License

MIT. Fart freely.

*Built with 💨 by FartForge Labs. Real chemistry. Real agents. Real stink.*
