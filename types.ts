// ui/lib/types.ts
// Shared TypeScript types — single source of truth for the entire UI.

export type IntensityLevel = 'silent' | 'mild' | 'moderate' | 'intense' | 'nuclear'

export type WalletTier = 0 | 1 | 2 | 3  // 0=none, 1=10k, 2=100k, 3=1M $FARTFORGE

export interface OdorCompound {
  ppm: number
  name: string
  formula: string
  descriptor: string
  color_hex: string
  is_sulfur: boolean
  fun_fact: string
  odor_threshold_ppb: number | null
  odor_units: number
}

export interface FartFingerprint {
  mfcc_mean: number[]
  mfcc_std: number[]
  mfcc_delta_mean: number[]
  spectral_centroid: number
  spectral_bandwidth: number
  spectral_rolloff: number
  spectral_flatness: number
  spectral_contrast: number[]
  zero_crossing_rate: number
  rms_energy: number
  duration_ms: number
  tempo_bpm: number
  onset_count: number
  loudness_lufs: number
  // Derived scores (computed in Python properties, serialized in JS)
  rumble_score?: number
  sharpness_score?: number
  wetness_score?: number
}

export interface EmitResult {
  emission_id: string
  agent_id: string
  intensity: IntensityLevel
  context: string
  stink_score: number
  odor_profile: Record<string, OdorCompound>
  fingerprint: FartFingerprint
  audio_path: string | null
  audio_b64: string | null
  timestamp: string
  rank: number | null
  arena_url: string | null
  mode?: 'python' | 'demo'
}

export interface AppSettings {
  volume: number           // 0–1
  particleDensity: number  // 0–2
  safeMode: boolean        // mutes audio
  showGrid: boolean
  showScanlines: boolean
}

export interface LeaderboardEntry {
  rank: number
  emission_id: string
  agent_id: string
  intensity: IntensityLevel
  stink_score: number
  context: string
  timestamp: string
}

export interface FirehoseTweet {
  id: string
  text: string
  username: string
  timestamp: string
  url: string | null
}

export interface PriceData {
  price: number
  change24h: number
  marketCap: number
  source: 'birdeye' | 'jupiter' | 'simulated'
}
