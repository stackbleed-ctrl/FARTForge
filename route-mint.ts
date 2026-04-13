// ui/app/api/mint/route.ts
// FOC — Fart On Chain mint endpoint
// Flow:
//   1. Frontend POSTs: { analysis, ownerAddress, audioBase64?, emissionId? }
//   2. This route calls Python FOC backend: uploads to Arweave, builds unsigned cNFT tx
//   3. Returns: { audioArweaveUrl, metadataArweaveUrl, mintTxBase64, emissionId }
//   4. Frontend signs mintTxBase64 with Phantom/Solflare and broadcasts

import { NextRequest, NextResponse } from 'next/server'

const FOC_BACKEND = process.env.FARTFORGE_BACKEND_URL ?? 'http://localhost:8000'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { analysis, ownerAddress, audioBase64, audioUrl, emissionId } = body

    if (!analysis) {
      return NextResponse.json({ error: 'analysis required' }, { status: 400 })
    }
    if (!ownerAddress) {
      return NextResponse.json({ error: 'ownerAddress required — connect wallet first' }, { status: 400 })
    }

    // ── Try Python FOC backend ──────────────────────────────────────────
    try {
      const res = await fetch(`${FOC_BACKEND}/mint`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ analysis, owner_address: ownerAddress, audio_base64: audioBase64, emission_id: emissionId }),
        signal: AbortSignal.timeout(30000),
      })
      if (res.ok) {
        const data = await res.json()
        return NextResponse.json(data)
      }
      const err = await res.text()
      console.error('[mint] Python backend error:', err)
    } catch (e) {
      console.warn('[mint] Python backend unavailable:', e)
    }

    // ── JS fallback: mock FOC result so UI still works without backend ──
    // In production this should hard-fail — but for dev/demo it shows the flow
    const mockEmissionId = emissionId ?? Math.random().toString(36).slice(2, 14)
    const mockArweaveBase = 'https://arweave.net'

    return NextResponse.json({
      emission_id: mockEmissionId,
      audio_arweave_url: audioUrl ?? `${mockArweaveBase}/MOCK_AUDIO_${mockEmissionId}`,
      metadata_arweave_url: `${mockArweaveBase}/MOCK_META_${mockEmissionId}`,
      nft_name: `Fart Receipt #${mockEmissionId.slice(0, 8).toUpperCase()}`,
      stink_score: analysis.stink_score,
      archetype: analysis.archetype,
      mint_tx_base64: null,  // null = Python backend required for real mint
      status: 'mock_no_backend',
      warning: 'Python FOC backend not running. Start with: uvicorn fartforge.server:app --port 8000',
    })

  } catch (err) {
    console.error('[mint] Route error:', err)
    return NextResponse.json({ error: 'Mint failed', details: String(err) }, { status: 500 })
  }
}
