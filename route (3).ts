import { NextRequest, NextResponse } from 'next/server'

const INTENSITY_MAP: Record<string, number> = {
  silent: 0.05, mild: 0.25, moderate: 0.55, intense: 0.80, nuclear: 1.00,
}

// Compound color/descriptor data (mirrors Python package)
const COMPOUND_DB: Record<string, any> = {
  H2S:              { name: 'Hydrogen Sulfide',  formula: 'H₂S',    color_hex: '#FFD700', is_sulfur: true,  descriptors: ['rotten eggs','volcanic sulfur','sewer'],     fun_fact: 'Detectable at 0.5 ppb — your nose outperforms most lab equipment.', max_ppm: 12 },
  methanethiol:     { name: 'Methanethiol',       formula: 'CH₃SH',  color_hex: '#90EE90', is_sulfur: true,  descriptors: ['rotten cabbage','swamp gas','putrid'],       fun_fact: 'Detectable at just 70 ppt. One of the most potent odorants known.', max_ppm: 4 },
  dimethyl_sulfide: { name: 'Dimethyl Sulfide',   formula: '(CH₃)₂S',color_hex: '#87CEEB', is_sulfur: true,  descriptors: ['cooked cabbage','marine','sweet rot'],       fun_fact: 'Also responsible for the smell of the ocean. Congratulations.', max_ppm: 1.5 },
  indole:           { name: 'Indole',             formula: 'C₈H₇N',  color_hex: '#9B59B6', is_sulfur: false, descriptors: ['fecal','floral paradox','barnyard'],         fun_fact: 'At trace concentrations, used in luxury perfumes.', max_ppm: 0.5 },
  skatole:          { name: 'Skatole',            formula: 'C₉H₉N',  color_hex: '#8B4513', is_sulfur: false, descriptors: ['mothballs','barnyard','fecal intense'],      fun_fact: 'Named from the Greek skatos (dung). Your gut is an artisan parfumeur.', max_ppm: 0.3 },
  methane:          { name: 'Methane',            formula: 'CH₄',    color_hex: '#87CEEB', is_sulfur: false, descriptors: ['odorless','flammable','greenhouse gas'],     fun_fact: '34× more potent as greenhouse gas than CO₂ over 100 years. You are contributing.', max_ppm: 600 },
  CO2:              { name: 'Carbon Dioxide',     formula: 'CO₂',    color_hex: '#D3D3D3', is_sulfur: false, descriptors: ['odorless','volume driver','fizzy'],          fun_fact: 'Makes up ~20% of flatus volume. Responsible for the sound, not the smell.', max_ppm: 5000 },
}

function clamp(v: number, lo: number, hi: number) { return Math.max(lo, Math.min(hi, v)) }

function seededRandom(seed: number) {
  let s = seed
  return () => { s = (s * 1664525 + 1013904223) & 0xffffffff; return (s >>> 0) / 0xffffffff }
}

function generateFingerprint(energy: number, seed: number) {
  const rng = seededRandom(seed)
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
    spectral_centroid: parseFloat(centroid.toFixed(1)),
    spectral_bandwidth: parseFloat((centroid * 0.4 + rng() * 200).toFixed(1)),
    spectral_rolloff: parseFloat((centroid * 1.8).toFixed(1)),
    spectral_flatness: parseFloat(flatness.toFixed(3)),
    zero_crossing_rate: parseFloat(zcr.toFixed(4)),
    rms_energy: parseFloat(rms.toFixed(4)),
    duration_ms: durationMs,
    tempo_bpm: parseFloat((8 + energy * 15 + rng() * 4).toFixed(1)),
    onset_count: Math.floor(energy * 12 * rng()),
    loudness_lufs: parseFloat((-30 + energy * 20).toFixed(1)),
    rumble_score: parseFloat(rumble_score.toFixed(3)),
    sharpness_score: parseFloat(sharpness_score.toFixed(3)),
    wetness_score: parseFloat(wetness_score.toFixed(3)),
  }
}

function generateOdorProfile(energy: number, fingerprint: any, seed: number) {
  const rng = seededRandom(seed + 1)
  const sulfurLoad = energy * 2.5
  const flatnessBoost = fingerprint.spectral_flatness * 1.5
  const durationBoost = clamp(fingerprint.duration_ms / 2000, 0, 1.5)
  const wetness = fingerprint.wetness_score

  const profile: Record<string, any> = {}

  const compounds: [string, number, number | null][] = [
    ['H2S',              clamp((0.5 + sulfurLoad * 1.8 + flatnessBoost * 0.8) * durationBoost * (0.7 + rng() * 0.6), 0.1, 12), 0.5],
    ['methanethiol',     clamp((0.1 + sulfurLoad * 0.9) * durationBoost * (0.6 + rng() * 0.8), 0.01, 4), 0.07],
    ['dimethyl_sulfide', clamp((0.02 + sulfurLoad * 0.3) * (0.5 + rng()), 0.01, 1.5), 1.0],
    ['indole',           clamp((0.002 + wetness * 0.08 + energy * 0.05) * (0.4 + rng() * 1.2), 0.001, 0.5), 140],
    ['skatole',          clamp((0.001 + wetness * 0.05) * (0.3 + rng() * 1.4), 0.001, 0.3), 83],
    ['methane',          clamp(150 + energy * 350 + (rng() - 0.5) * 60, 100, 600), null],
    ['CO2',              clamp(1500 + energy * 3000 + (rng() - 0.5) * 400, 1000, 5000), null],
  ]

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

function computeStinkScore(energy: number, fingerprint: any, odorProfile: any, multiplier: number) {
  const sulfurPpm = ['H2S', 'methanethiol', 'dimethyl_sulfide']
    .reduce((sum, k) => sum + (odorProfile[k]?.ppm ?? 0), 0)
  const sulfurScore = clamp(sulfurPpm * 0.8, 0, 10)
  const spectralScore = (fingerprint.zero_crossing_rate * 50) +
    (1 - clamp(fingerprint.spectral_centroid / 8000, 0, 1)) * 5
  const durationScore = clamp(fingerprint.duration_ms / 320, 0, 10)
  const raw = energy * 10 * 0.40 + sulfurScore * 0.30 + spectralScore * 0.20 + durationScore * 0.10
  return parseFloat(Math.min(10, raw * multiplier).toFixed(2))
}

// Simple in-memory leaderboard for demo (production: use Supabase)
const leaderboard: any[] = []
let rankCounter = 0

export async function POST(req: NextRequest) {
  const body = await req.json()
  const {
    intensity = 'moderate',
    context = 'arena press',
    stink_multiplier = 1.0,
    agent_id = 'arena-user',
  } = body

  const energy = INTENSITY_MAP[intensity] ?? 0.55
  const seed = Date.now() % 2147483647
  const emissionId = Math.random().toString(36).slice(2, 10)

  const fingerprint = generateFingerprint(energy, seed)
  const odorProfile = generateOdorProfile(energy, fingerprint, seed)
  const stinkScore = computeStinkScore(energy, fingerprint, odorProfile, stink_multiplier)

  // Record to in-memory leaderboard
  rankCounter++
  const entry = {
    emission_id: emissionId,
    agent_id,
    intensity,
    stink_score: stinkScore,
    context,
    timestamp: new Date().toISOString(),
    rank: null as number | null,
  }

  leaderboard.push(entry)
  leaderboard.sort((a, b) => b.stink_score - a.stink_score)
  const rank = leaderboard.findIndex(e => e.emission_id === emissionId) + 1
  entry.rank = rank

  const result = {
    emission_id: emissionId,
    agent_id,
    intensity,
    context,
    stink_score: stinkScore,
    odor_profile: odorProfile,
    fingerprint,
    audio_path: null,
    audio_b64: null,   // Full Python backend generates real audio
    timestamp: new Date().toISOString(),
    rank,
    arena_url: `/arena?replay=${emissionId}`,
  }

  return NextResponse.json(result)
}
