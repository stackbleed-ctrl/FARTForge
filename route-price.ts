// ui/app/api/price/route.ts
import { NextResponse } from 'next/server'

const MINT_ADDRESS = '5Rc86umhtn3UwBqDzexhpkZkeStifJt2sBG6Aj1Spump'

export async function GET() {
  const birdeyeKey = process.env.BIRDEYE_API_KEY

  // Try Birdeye API with real mint
  if (birdeyeKey) {
    try {
      const res = await fetch(
        `https://public-api.birdeye.so/defi/token_overview?address=${MINT_ADDRESS}`,
        {
          headers: {
            'X-API-KEY': birdeyeKey,
            'x-chain': 'solana',
          },
          next: { revalidate: 30 },
        }
      )
      if (res.ok) {
        const json = await res.json()
        const d = json?.data
        if (d) {
          return NextResponse.json({
            price: d.price ?? 0,
            change24h: d.priceChange24hPercent ?? 0,
            marketCap: d.mc ?? 0,
            volume24h: d.v24hUSD ?? 0,
            source: 'birdeye',
            mint: MINT_ADDRESS,
          })
        }
      }
    } catch { /* fall through to mock */ }
  }

  // Try Jupiter price API (no key needed)
  try {
    const res = await fetch(
      `https://price.jup.ag/v6/price?ids=${MINT_ADDRESS}`,
      { next: { revalidate: 30 } }
    )
    if (res.ok) {
      const json = await res.json()
      const tokenData = json?.data?.[MINT_ADDRESS]
      if (tokenData?.price) {
        return NextResponse.json({
          price: tokenData.price,
          change24h: 0, // Jupiter price API doesn't return 24h change
          marketCap: 0,
          volume24h: 0,
          source: 'jupiter',
          mint: MINT_ADDRESS,
        })
      }
    }
  } catch { /* fall through to mock */ }

  // Mock fallback
  return NextResponse.json({
    price: 0.0000420 + (Math.random() - 0.5) * 0.000005,
    change24h: 4.2 + (Math.random() - 0.5) * 2,
    marketCap: 0,
    volume24h: 0,
    source: 'mock',
    mint: MINT_ADDRESS,
  })
}
