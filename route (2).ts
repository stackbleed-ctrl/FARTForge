// ui/app/api/fart/route.ts
//
// The main fart emission API endpoint.
//
// Architecture:
//   1. If FARTFORGE_PYTHON_API is set → proxy to Python FastAPI backend (real audio, real librosa)
//   2. Else → JS implementation (DEMO MODE: deterministic math, no audio)
//
// The JS implementation is intentionally kept in sync with core.py's scoring formula.
// If you change _compute_stink_score in core.py, update computeStinkScore here too.
// The seed algorithm differs from Python's random module by design — JS handles
// frontend demo emissions; Python handles production/NFT-receipt emissions.

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

// ── Shared constants (must match core.py exactly) ────────────────────────────

const INTENSITY_MAP: Record<string, number> = {
  silent: 0.05,
  mild: 0.25,
  moderate: 0.55,
  intense: 0.80,
  nuclear: 1.00,
}

const VALID_INTENSITIES = new Set(Object.keys(INTENSITY_MAP))

const COMPOUND_DB: Record<string, {
  name: string; formula: string; color_hex: string;
  is_sulfur: boolean; descriptors: string[]; fun_fact: string; max_ppm: number;
}> = {
  H2S: {
    name: 'Hydrogen Sulfide', formula: 'H₂S', color_hex: '#FFD700', is_sulfur: true,
    descriptors: ['rotten eggs', 'volcanic sulfur', 'sewer'],
    fun_fact: 'Detectable at 0.5 ppb — your nose outperforms most lab equipment.',
    max_ppm: 12,
  },
  methanethiol: {
    name: 'Methanethiol', formula: 'CH₃SH', color_hex: '#90EE90', is_sulfur: true,
    descriptors: ['rotten cabbage', 'swamp gas', 'putrid'],
    fun_fact: 'Detectable at just 70 ppt. One of the most potent odorants known.',
    max_ppm: 4,
  },
  dimethyl_sulfide: {
    name: 'Dimethyl Sulfide', formula: '(CH₃)₂S', color_hex: '#87CEEB', is_sulfur: true,
    descriptors: ['cooked cabbage', 'marine', 'sweet rot'],
    fun_fact: 'Also responsible for the smell of the ocean. Congratulations.',
    max_ppm: 1.5,
  },
  indole: {
    name: 'Indole', formula: 'C₈H₇N', color_hex: '#9B59B6', is_sulfur: false,
    descriptors: ['fecal', 'floral paradox', 'barnyard'],
    fun_fact: 'At trace concentrations, used in luxury perfumes.',
    max_ppm: 0.5,
  },
  skatole: {
    name: 'Skatole', formula: 'C₉H₉N', color_hex: '#8B4513', is_sulfur: false,
    descriptors: ['mothballs', 'barnyard', 'fecal intense'],
    fun_fact: 'Named from the Greek skatos (dung). Your gut is an artisan parfumeur.',
    max_ppm: 0.3,
  },
  methane: {
    name: 'Methane', formula: 'CH₄', color_hex: '#B8E4FF', is_sulfur: false,
    descriptors: ['odorless', 'flammable', 'greenhouse gas'],
    fun_fact: '34× more potent greenhouse gas than CO₂ over 100 years. You are contributing.',
    max_ppm: 600,
  },
  CO2: {
    name: 'Carbon Dioxide', formula: 'CO₂', color_hex: '#D3D3D3', is_sulfur: false,
    descriptors: ['odorless', 'volume driver', 'fizzy'],
    fun_fact: 'Makes up ~20% of flatus volume. Responsible for the sound, not the smell.',
    max_ppm: 5000,
  },
}

// ── Seeded PRNG (Mulberry32 — fast, good distribution) ───────────────────────

function mulberry32(seed: number) {
  let s = seed >>> 0
  return () => {
    s += 0x6D2B79F5
    let t = s
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 0x100000000
  }
}

function clamp(v: number, lo: number, hi: number) { return Math.max(lo, Math.min(hi, v)) }

// ── Fingerprint (mirrors FartFingerprint dataclass) ───────────────────────────

function generateFingerprint(energy: number, seed: number) {
  const rng = mulberry32(seed)
  const centroid = clamp(3000 - energy * 2000 + rng() * 500, 200, 5000)
  const zcr = clamp(0.02 + energy * 0.15 + rng() * 0.04, 0.01, 0.25)
  const rms = clamp(0.1 + energy * 0.6, 0.05, 0.9)
  const flatness = clamp(0.3 + energy * 0.4 + rng() * 0.1, 0.1, 0.9)
  const durationMs = Math.floor(800 + energy * 2400 + rng() * 200)

  const mfcc_mean = Array.from({ length: 13 }, (_, i) => {
    const base = i === 0 ? -20 + rms * 15 : (rng() - 0.5) * 20 * energy
    return parseFloat(base.toFixed(2))
  })

  const rumble_score = clamp((1 - centroid / 5000) * 0.6 + (1 - zcr * 20) * 0.4, 0, 1)
  const sharpness_score = clamp((centroid / 4000) * 0.5 + (zcr * 15) * 0.5, 0, 1)
  const wetness_score = clamp(flatness * 3.0, 0, 1)

  return {
    mfcc_mean,
    mfcc_std: mfcc_mean.map(() => parseFloat((rng() * 5).toFixed(2))),
    mfcc_delta_mean: mfcc_mean.map(() => parseFloat(((rng() - 0.5) * 2).toFixed(2))),
    spectral_centroid: parseFloat(centroid.toFixed(1)),
    spectral_bandwidth: parseFloat((centroid * 0.4 + rng() * 200).toFixed(1)),
    spectral_rolloff: parseFloat((centroid * 1.8).toFixed(1)),
    spectral_flatness: parseFloat(flatness.toFixed(3)),
    spectral_contrast: Array.from({ length: 7 }, () => parseFloat((rng() * 10).toFixed(2))),
    zero_crossing_rate: parseFloat(zcr.toFixed(4)),
    rms_energy: parseFloat(rms.toFixed(4)),
    duration_ms: durationMs,
    tempo_bpm: parseFloat((8 + energy * 15 + rng() * 4).toFixed(1)),
    onset_count: Math.floor(energy * 12 * rng()),
    loudness_lufs: parseFloat((-30 + energy * 20).toFixed(1)),
    // Derived scores (computed properties in Python)
    rumble_score: parseFloat(rumble_score.toFixed(3)),
    sharpness_score: parseFloat(sharpness_score.toFixed(3)),
    wetness_score: parseFloat(wetness_score.toFixed(3)),
  }
}

// ── Odor profile (mirrors OdorProfiler.profile()) ────────────────────────────

function generateOdorProfile(energy: number, fingerprint: ReturnType<typeof generateFingerprint>, seed: number) {
  const rng = mulberry32(seed + 1)
  const sulfurLoad = energy * 2.5
  const flatnessBoost = fingerprint.spectral_flatness * 1.5
  const durationBoost = clamp(fingerprint.duration_ms / 2000, 0, 1.5)
  const wetness = fingerprint.wetness_score

  const compounds: [string, number, number | null][] = [
    ['H2S',             clamp((0.5 + sulfurLoad * 1.8 + flatnessBoost * 0.8) * durationBoost * (0.7 + rng() * 0.6), 0.1, 12), 0.5],
    ['methanethiol',    clamp((0.1 + sulfurLoad * 0.9) * durationBoost * (0.6 + rng() * 0.8), 0.01, 4), 0.07],
    ['dimethyl_sulfide',clamp((0.02 + sulfurLoad * 0.3) * (0.5 + rng()), 0.01, 1.5), 1.0],
    ['indole',          clamp((0.002 + wetness * 0.08 + energy * 0.05) * (0.4 + rng() * 1.2), 0.001, 0.5), 140],
    ['skatole',         clamp((0.001 + wetness * 0.05) * (0.3 + rng() * 1.4), 0.001, 0.3), 83],
    ['methane',         clamp(150 + energy * 350 + (rng() - 0.5) * 60, 100, 600), null],
    ['CO2',             clamp(1500 + energy * 3000 + (rng() - 0.5) * 400, 1000, 5000), null],
  ]

  const profile: Record<string, unknown> = {}
  for (const [key, ppm, threshold] of compounds) {
    const db = COMPOUND_DB[key]
    const descriptor = db.descriptors[Math.floor(rng() * db.descriptors.length)]
    const odorUnits = threshold ? Math.round(ppm * 1000 / threshold) : 0
    profile[key] = {
      ppm: parseFloat(ppm.toFixed(4)),
      name: db.name,
      formula: db.formula,
      descriptor,
      color_hex: db.color_hex,
      is_sulfur: db.is_sulfur,
      fun_fact: db.fun_fact,
      odor_threshold_ppb: threshold,
      odor_units: odorUnits,
    }
  }
  return profile
}

// ── Stink score (must stay in sync with core.py _compute_stink_score) ────────

function computeStinkScore(
  energy: number,
  fingerprint: ReturnType<typeof generateFingerprint>,
  odorProfile: ReturnType<typeof generateOdorProfile>,
  multiplier: number,
): number {
  const op = odorProfile as Record<string, { ppm: number }>
  const sulfurPpm = ['H2S', 'methanethiol', 'dimethyl_sulfide']
    .reduce((sum, k) => sum + (op[k]?.ppm ?? 0), 0)
  const sulfurScore = clamp(sulfurPpm * 0.8, 0, 10)
  const spectralScore =
    fingerprint.zero_crossing_rate * 50 +
    (1 - clamp(fingerprint.spectral_centroid / 8000, 0, 1)) * 5
  const durationScore = clamp(fingerprint.duration_ms / 320, 0, 10)
  const raw = energy * 10 * 0.40 + sulfurScore * 0.30 + spectralScore * 0.20 + durationScore * 0.10
  return parseFloat(Math.min(10, raw * multiplier).toFixed(2))
}

// ── In-process leaderboard (Supabase takes over when configured) ──────────────

// NOTE: This in-memory store is intentionally ephemeral — it is for UI
// demo mode only. In a serverless deployment each cold start gets a fresh
// module instance. Configure NEXT_PUBLIC_SUPABASE_* for persistent state.
const _memoryLeaderboard: { emission_id: string; stink_score: number }[] = []

async function recordToSupabase(entry: Record<string, unknown>) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!url || !key) return null
  try {
    const supabase = createClient(url, key)
    const { data, error } = await supabase
      .from('emissions')
      .insert({ ...entry, source: 'agent' })
      .select('id')
      .single()
    if (error) throw error
    return data
  } catch {
    return null
  }
}

async function getRankFromSupabase(stinkScore: number): Promise<number> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!url || !key) return -1
  try {
    const supabase = createClient(url, key)
    const { count } = await supabase
      .from('emissions')
      .select('*', { count: 'exact', head: true })
      .gt('stink_score', stinkScore)
    return (count ?? 0) + 1
  } catch {
    return -1
  }
}

// ── Route handler ─────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  let body: Record<string, unknown>
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const intensity = (typeof body.intensity === 'string' && VALID_INTENSITIES.has(body.intensity))
    ? body.intensity
    : 'moderate'
  const context = typeof body.context === 'string' ? body.context.slice(0, 200) : 'arena press'
  const stinkMultiplier = typeof body.stink_multiplier === 'number'
    ? clamp(body.stink_multiplier, 0.1, 3.0)
    : 1.0
  const agentId = typeof body.agent_id === 'string' ? body.agent_id.slice(0, 64) : 'arena-user'

  // ── Optional: proxy to Python backend for real audio ───────────────────
  const pythonApi = process.env.FARTFORGE_PYTHON_API
  if (pythonApi) {
    try {
      const res = await fetch(`${pythonApi}/emit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ intensity, context, stink_multiplier: stinkMultiplier, agent_id: agentId }),
      })
      if (res.ok) {
        const data = await res.json()
        return NextResponse.json(data)
      }
    } catch { /* fall through to JS implementation */ }
  }

  // ── JS demo implementation ──────────────────────────────────────────────
  const energy = INTENSITY_MAP[intensity]
  const seed = Date.now() % 2147483647
  const emissionId = Math.random().toString(36).slice(2, 10)

  const fingerprint = generateFingerprint(energy, seed)
  const odorProfile = generateOdorProfile(energy, fingerprint, seed)
  const stinkScore = computeStinkScore(energy, fingerprint, odorProfile, stinkMultiplier)

  // Record to Supabase (best-effort)
  const dbEntry = {
    emission_id: emissionId,
    agent_id: agentId,
    intensity,
    stink_score: stinkScore,
    context,
    fingerprint,
    odor_profile: odorProfile,
  }
  const [_inserted, rank] = await Promise.all([
    recordToSupabase(dbEntry),
    getRankFromSupabase(stinkScore),
  ])

  // Fallback: in-memory rank
  let finalRank = rank > 0 ? rank : (() => {
    _memoryLeaderboard.push({ emission_id: emissionId, stink_score: stinkScore })
    _memoryLeaderboard.sort((a, b) => b.stink_score - a.stink_score)
    return _memoryLeaderboard.findIndex(e => e.emission_id === emissionId) + 1
  })()

  return NextResponse.json({
    emission_id: emissionId,
    agent_id: agentId,
    intensity,
    context,
    stink_score: stinkScore,
    odor_profile: odorProfile,
    fingerprint,
    audio_path: null,
    audio_b64: null,
    timestamp: new Date().toISOString(),
    rank: finalRank,
    arena_url: `/arena?replay=${emissionId}`,
    mode: pythonApi ? 'python' : 'demo',
  })
}
