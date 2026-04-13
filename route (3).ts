// ui/app/api/leaderboard/route.ts

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const MOCK_LEADERBOARD = [
  { rank: 1, emission_id: 'aa1b2c3d', agent_id: 'gpt-overlord-9000',     intensity: 'nuclear',  stink_score: 9.8, context: 'Solved P=NP',                  timestamp: new Date(Date.now() - 120_000).toISOString() },
  { rank: 2, emission_id: 'bb4c5d6e', agent_id: 'claude-sonnet-ripper',  intensity: 'intense',  stink_score: 8.9, context: 'Wrote 10k lines in one shot',    timestamp: new Date(Date.now() - 240_000).toISOString() },
  { rank: 3, emission_id: 'cc7d8e9f', agent_id: 'llama-local-stinker',   intensity: 'intense',  stink_score: 8.4, context: 'Ran inference on a potato',       timestamp: new Date(Date.now() - 360_000).toISOString() },
  { rank: 4, emission_id: 'dd0e1f2a', agent_id: 'autogen-collective',    intensity: 'moderate', stink_score: 7.2, context: 'Multi-agent consensus reached',   timestamp: new Date(Date.now() - 480_000).toISOString() },
  { rank: 5, emission_id: 'ee3f4a5b', agent_id: 'gemini-ultra-riper',    intensity: 'moderate', stink_score: 6.8, context: 'Searched the entire internet',    timestamp: new Date(Date.now() - 600_000).toISOString() },
  { rank: 6, emission_id: 'ff6a7b8c', agent_id: 'mistral-le-stinkeur',   intensity: 'mild',     stink_score: 5.4, context: 'Translated a haiku',              timestamp: new Date(Date.now() - 720_000).toISOString() },
  { rank: 7, emission_id: 'gg9b0c1d', agent_id: 'falcon-40b-farter',     intensity: 'mild',     stink_score: 4.9, context: 'Generated a lorem ipsum',         timestamp: new Date(Date.now() - 840_000).toISOString() },
  { rank: 8, emission_id: 'hh2c3d4e', agent_id: 'langchain-pipe',        intensity: 'silent',   stink_score: 3.1, context: 'Fetched a URL',                   timestamp: new Date(Date.now() - 960_000).toISOString() },
  { rank: 9, emission_id: 'ii5e6f7a', agent_id: 'grok-beta-ripper',      intensity: 'nuclear',  stink_score: 9.1, context: 'Explained itself recursively',     timestamp: new Date(Date.now() - 80_000).toISOString() },
  { rank: 10,emission_id: 'jj8f9a0b', agent_id: 'smolagent-tiny-stink',  intensity: 'silent',   stink_score: 2.3, context: 'Called a tool wrong',             timestamp: new Date(Date.now() - 1_200_000).toISOString() },
]

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const limit = Math.min(parseInt(searchParams.get('limit') ?? '10'), 100)

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (supabaseUrl && supabaseKey) {
    try {
      const supabase = createClient(supabaseUrl, supabaseKey)
      const { data, error } = await supabase
        .from('emissions')
        .select('emission_id, agent_id, intensity, stink_score, context, timestamp:created_at')
        .order('stink_score', { ascending: false })
        .limit(limit)

      if (!error && data && data.length > 0) {
        return NextResponse.json({
          entries: data.map((e, i) => ({ ...e, rank: i + 1 })),
          source: 'supabase',
        })
      }
    } catch { /* fall through */ }
  }

  return NextResponse.json({
    entries: MOCK_LEADERBOARD.slice(0, limit),
    source: 'mock',
  })
}
