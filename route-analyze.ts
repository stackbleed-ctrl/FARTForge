// ui/app/api/analyze/route.ts
// Human Anal-yzer™ API endpoint
// Accepts audio file upload (WAV/MP3/OGG/WEBM), sends to Python backend for analysis
// Falls back to pure-JS Web Audio analysis if Python backend unavailable

import { NextRequest, NextResponse } from 'next/server'

const PYTHON_BACKEND = process.env.FARTFORGE_BACKEND_URL ?? 'http://localhost:8000'

// Pure JS fallback analyzer — runs entirely in Next.js with no Python dep
// Uses the same scoring logic as the Python HumanAnalyzer
function jsFallbackAnalyze(durationSeconds: number, fileSize: number): object {
  // Rough proxies from file metadata when we can't do real DSP
  const estimatedEnergy    = Math.min(1.0, fileSize / (durationSeconds * 50000))
  const estimatedCentroid  = 200 + Math.random() * 400
  const estimatedZcr       = 0.05 + Math.random() * 0.15
  const wetness            = Math.random() * 0.4

  const sbd_factor         = (durationSeconds / 3.0) * (1 - Math.min(1, estimatedEnergy * 10))
  const h2s_ppm            = Math.min(12, 0.3 + sbd_factor * 4.0 + (1 - estimatedCentroid / 5000) * 2.0)
  const methanethiol_ppm   = Math.min(4, 0.05 + sbd_factor * 2.0)
  const sulfur_load        = h2s_ppm * 0.6 + methanethiol_ppm * 0.8
  const stink_score        = Math.round(Math.min(10, sulfur_load * 0.45 + estimatedEnergy * 6 * 0.25 + durationSeconds * 2.5 * 0.15 + (1 - estimatedCentroid / 4000) * 10 * 0.15) * 10) / 10

  let archetype = 'Classic Trombone Toot'
  if (durationSeconds > 2.5 && estimatedEnergy < 0.025) archetype = 'Silent But Deadly'
  else if (estimatedCentroid < 220) archetype = 'Bass Cannon'
  else if (estimatedZcr > 0.12) archetype = 'Squeaky Sulfur Dart'
  else if (wetness > 0.4) archetype = 'Wet Chaos'

  return {
    source: 'human_js_fallback',
    archetype,
    stink_score,
    summary: `${durationSeconds.toFixed(1)}s · ${stink_score}/10 stink · [${archetype}] — JS fallback analysis (install Python backend for full DSP)`,
    sound_profile: {
      duration_seconds: durationSeconds,
      spectral_centroid_hz: Math.round(estimatedCentroid * 10) / 10,
      peak_energy_rms: Math.round(estimatedEnergy * 1000) / 1000,
      zero_crossing_rate: Math.round(estimatedZcr * 10000) / 10000,
      wetness_score: Math.round(wetness * 1000) / 1000,
    },
    odor_profile: {
      H2S:            { ppm: Math.round(h2s_ppm * 1000) / 1000,          name: 'Hydrogen Sulfide',  formula: 'H₂S',    color_hex: '#FFD700', descriptor: 'rotten eggs, volcanic sulfur' },
      methanethiol:   { ppm: Math.round(methanethiol_ppm * 1000) / 1000, name: 'Methanethiol',       formula: 'CH₃SH',  color_hex: '#90EE90', descriptor: 'rotten cabbage, swamp gas' },
      methane:        { ppm: Math.round((150 + estimatedEnergy * 350) * 10) / 10, name: 'Methane', formula: 'CH₄', color_hex: '#87CEEB', descriptor: 'odorless but flammable' },
    },
    leaderboard_eligible: true,
  }
}

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData()
    const file = formData.get('audio') as File | null
    const intensityBoost = parseInt(formData.get('intensity_boost') as string ?? '0', 10)

    if (!file) {
      return NextResponse.json({ error: 'No audio file provided. Field name must be "audio".' }, { status: 400 })
    }

    // Validate MIME type
    const allowed = ['audio/wav', 'audio/wave', 'audio/mp3', 'audio/mpeg', 'audio/ogg', 'audio/webm', 'audio/mp4']
    if (!allowed.some(t => file.type.startsWith(t.split('/')[0]) && file.type.includes(t.split('/')[1]))) {
      // Be lenient — browsers sometimes send weird MIME types for recorded audio
      console.warn(`Unexpected MIME type: ${file.type} — proceeding anyway`)
    }

    const bytes  = await file.arrayBuffer()
    const buffer = Buffer.from(bytes)

    // ── Try Python backend first ──────────────────────────────────────
    try {
      const pyForm = new FormData()
      pyForm.append('audio', new Blob([buffer], { type: file.type }), file.name || 'recording.wav')
      pyForm.append('intensity_boost', String(intensityBoost))

      const pyRes = await fetch(`${PYTHON_BACKEND}/analyze`, {
        method: 'POST',
        body: pyForm,
        signal: AbortSignal.timeout(10000), // 10s timeout
      })

      if (pyRes.ok) {
        const result = await pyRes.json()
        return NextResponse.json({ ...result, source: 'human_python' })
      }
    } catch {
      console.warn('Python backend unavailable — using JS fallback analyzer')
    }

    // ── JS fallback ───────────────────────────────────────────────────
    const durationEstimate = buffer.byteLength / (44100 * 2) // rough estimate assuming 44.1kHz 16-bit
    const result = jsFallbackAnalyze(Math.max(0.1, durationEstimate), buffer.byteLength)

    return NextResponse.json(result)

  } catch (err) {
    console.error('Analyze route error:', err)
    return NextResponse.json({ error: 'Analysis failed', details: String(err) }, { status: 500 })
  }
}
