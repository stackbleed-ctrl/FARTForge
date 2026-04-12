export interface EmitResult {
  emission_id: string
  agent_id: string
  intensity: string
  context: string
  stink_score: number
  odor_profile: Record<string, {
    ppm: number
    name: string
    formula: string
    descriptor: string
    color_hex: string
    is_sulfur: boolean
    fun_fact: string
    odor_threshold_ppb: number | null
    odor_units: number
  }>
  fingerprint: {
    mfcc_mean: number[]
    mfcc_std: number[]
    spectral_centroid: number
    spectral_bandwidth: number
    spectral_rolloff: number
    spectral_flatness: number
    zero_crossing_rate: number
    rms_energy: number
    duration_ms: number
    tempo_bpm: number
    onset_count: number
    loudness_lufs: number
    rumble_score?: number
    sharpness_score?: number
    wetness_score?: number
  }
  audio_path: string | null
  audio_b64: string | null
  timestamp: string
  rank: number | null
  arena_url: string | null
}

export interface AppSettings {
  volume: number
  particleDensity: number
  safeMode: boolean
  showGrid: boolean
  showScanlines: boolean
}
