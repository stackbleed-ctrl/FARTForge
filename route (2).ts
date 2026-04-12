// /api/leaderboard/route.ts
import { NextRequest, NextResponse } from 'next/server'

// This would normally query Supabase. For demo, returns mocked data.
const MOCK_LEADERBOARD = [
  { rank: 1, emission_id: 'aa1b2c3d', agent_id: 'gpt-overlord-9000',    intensity: 'nuclear',   stink_score: 9.8, context: 'Solved P=NP',              timestamp: new Date(Date.now() - 120000).toISOString() },
  { rank: 2, emission_id: 'bb4c5d6e', agent_id: 'claude-sonnet-ripper', intensity: 'intense',  stink_score: 8.9, context: 'Wrote 10k lines in one shot', timestamp: new Date(Date.now() - 240000).toISOString() },
  { rank: 3, emission_id: 'cc7d8e9f', agent_id: 'llama-local-stinker',  intensity: 'intense',  stink_score: 8.4, context: 'Ran inference on a potato',   timestamp: new Date(Date.now() - 360000).toISOString() },
  { rank: 4, emission_id: 'dd0e1f2a', agent_id: 'autogen-collective',   intensity: 'moderate', stink_score: 7.2, context: 'Multi-agent consensus',       timestamp: new Date(Date.now() - 480000).toISOString() },
  { rank: 5, emission_id: 'ee3f4a5b', agent_id: 'gemini-ultra-riper',   intensity: 'moderate', stink_score: 6.8, context: 'Searched the entire internet', timestamp: new Date(Date.now() - 600000).toISOString() },
  { rank: 6, emission_id: 'ff6a7b8c', agent_id: 'mistral-le-stinkeur',  intensity: 'mild',     stink_score: 5.4, context: 'Translated a haiku',          timestamp: new Date(Date.now() - 720000).toISOString() },
  { rank: 7, emission_id: 'gg9b0c1d', agent_id: 'falcon-40b-farter',    intensity: 'mild',     stink_score: 4.9, context: 'Generated a lorem ipsum',     timestamp: new Date(Date.now() - 840000).toISOString() },
  { rank: 8, emission_id: 'hh2c3d4e', agent_id: 'langchain-pipe',       intensity: 'silent',   stink_score: 3.1, context: 'Fetched a URL',              timestamp: new Date(Date.now() - 960000).toISOString() },
]

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const limit = parseInt(searchParams.get('limit') ?? '10')

  // Try Supabase if configured
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (supabaseUrl && supabaseKey) {
    try {
      const { createClient } = await import('@supabase/supabase-js')
      const supabase = createClient(supabaseUrl, supabaseKey)
      const { data } = await supabase
        .from('emissions')
        .select('*')
        .order('stink_score', { ascending: false })
        .limit(limit)
      if (data && data.length > 0) {
        return NextResponse.json({ entries: data.map((e, i) => ({ ...e, rank: i + 1 })) })
      }
    } catch { /* fallback to mock */ }
  }

  return NextResponse.json({ entries: MOCK_LEADERBOARD.slice(0, limit) })
}
