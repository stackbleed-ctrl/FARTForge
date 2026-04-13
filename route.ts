// ui/app/api/price/route.ts
//
// $FARTFORGE token price endpoint.
// Uses Next.js route segment config for edge-compatible caching
// instead of module-level mutable state (which breaks in serverless).

import { NextResponse } from 'next/server'

export const revalidate = 15 // seconds — Next.js built-in route cache

const FART_MINT = process.env.NEXT_PUBLIC_FART_TOKEN_MINT

async function fetchBirdeye(): Promise<Record<string, number> | null> {
  const key = process.env.BIRDEYE_API_KEY
  if (!key || !FART_MINT) return null
  try {
    const res = await fetch(
      `https://public-api.birdeye.so/defi/price?address=${FART_MINT}`,
      { headers: { 'X-API-KEY': key } }
    )
    if (!res.ok) return null
    const data = await res.json()
    return {
      price: data.data?.value,
      change24h: data.data?.priceChange24h,
      marketCap: data.data?.marketCap,
    }
  } catch {
    return null
  }
}

async function fetchJupiter(): Promise<Record<string, number> | null> {
  if (!FART_MINT) return null
  try {
    const res = await fetch(`https://price.jup.ag/v4/price?ids=${FART_MINT}`)
    if (!res.ok) return null
    const data = await res.json()
    const p = data.data?.[FART_MINT]
    return p ? { price: p.price } : null
  } catch {
    return null
  }
}

export async function GET() {
  const now = Date.now()

  // Try real price feeds
  const birdeye = await fetchBirdeye()
  if (birdeye?.price) {
    return NextResponse.json({
      price: birdeye.price,
      change24h: birdeye.change24h ?? 0,
      marketCap: birdeye.marketCap ?? 0,
      source: 'birdeye',
    })
  }

  const jupiter = await fetchJupiter()
  if (jupiter?.price) {
    return NextResponse.json({
      price: jupiter.price,
      change24h: 0,
      marketCap: 0,
      source: 'jupiter',
    })
  }

  // Simulated price with realistic micro-fluctuation for demo
  const base = 0.185
  const price = parseFloat((base + Math.sin(now / 30_000) * 0.01 + Math.random() * 0.002).toFixed(5))
  const change24h = parseFloat((3.5 + Math.sin(now / 120_000) * 3).toFixed(2))
  const marketCap = Math.floor(185_000_000 + Math.sin(now / 30_000) * 5_000_000)

  return NextResponse.json({ price, change24h, marketCap, source: 'simulated' })
}
