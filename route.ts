// ui/app/api/firehose/route.ts
import { NextRequest, NextResponse } from 'next/server'

const SEARCH_TERMS = ['$FART', 'fartforge', 'fart agent', 'smelliest agent', 'fartarena']

const MOCK_TWEETS = [
  { id: 't1',  text: '$FART just obliterated my portfolio in the best possible way 💨🚀',        username: 'defi_degen_420',    timestamp: '2m ago',  url: null },
  { id: 't2',  text: 'fartforge ai agent just scored 9.8/10 stink score on first emission 🧪',  username: 'ai_researcher_eth', timestamp: '5m ago',  url: null },
  { id: 't3',  text: 'the smelliest agent won battle mode with a 3x nuclear rip 💥',              username: 'agentic_riper',     timestamp: '8m ago',  url: null },
  { id: 't4',  text: '$FART holders getting that 3x multiplier rn while you stay poor 💸',       username: 'sol_maxi_real',     timestamp: '11m ago', url: null },
  { id: 't5',  text: 'fartforge leaderboard dominated by indole overlords tonight',              username: 'stink_data_xyz',    timestamp: '15m ago', url: null },
  { id: 't6',  text: 'the science behind fartforge is actually legit — real H2S measurements',   username: 'biochem_degen',     timestamp: '18m ago', url: null },
  { id: 't7',  text: 'shook my phone so hard for shake-to-fart i dropped it. 9.6 stink. worth', username: 'mobile_ripper_99',  timestamp: '22m ago', url: null },
  { id: 't8',  text: 'fart receipt NFT just dropped with 7-compound odor fingerprint on chain', username: 'nft_stinker_sol',   timestamp: '27m ago', url: null },
  { id: 't9',  text: 'just docked my crewai agent into fartforge. first emit: 8.2 stink score',  username: 'crewai_builder',    timestamp: '33m ago', url: null },
  { id: 't10', text: 'if your AI agent isnt integrated with fartforge are you even building',    username: 'based_agent_dev',   timestamp: '41m ago', url: null },
]

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const limit = parseInt(searchParams.get('limit') ?? '20')

  // Try X/Twitter API v2 if bearer token configured
  const bearerToken = process.env.TWITTER_BEARER_TOKEN
  if (bearerToken) {
    try {
      const query = SEARCH_TERMS.map(t => `"${t}"`).join(' OR ')
      const res = await fetch(
        `https://api.twitter.com/2/tweets/search/recent?query=${encodeURIComponent(query)}&max_results=${Math.min(limit, 100)}&tweet.fields=created_at,author_id&expansions=author_id&user.fields=username`,
        {
          headers: { Authorization: `Bearer ${bearerToken}` },
          next: { revalidate: 30 },
        }
      )

      if (res.ok) {
        const data = await res.json()
        const users = Object.fromEntries(
          (data.includes?.users ?? []).map((u: any) => [u.id, u.username])
        )
        const tweets = (data.data ?? []).slice(0, limit).map((t: any) => ({
          id: t.id,
          text: t.text,
          username: users[t.author_id] ?? 'unknown',
          timestamp: new Date(t.created_at).toLocaleTimeString(),
          url: `https://twitter.com/i/web/status/${t.id}`,
        }))
        return NextResponse.json({ tweets, source: 'twitter' })
      }
    } catch { /* fallback to mock */ }
  }

  // Try Supabase realtime mentions table
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (supabaseUrl && supabaseKey) {
    try {
      const { createClient } = await import('@supabase/supabase-js')
      const supabase = createClient(supabaseUrl, supabaseKey)
      const { data } = await supabase
        .from('mentions')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(limit)
      if (data && data.length > 0) {
        return NextResponse.json({ tweets: data, source: 'supabase' })
      }
    } catch { /* fallback */ }
  }

  // Return mock data with slight randomization for freshness
  const shuffled = [...MOCK_TWEETS].sort(() => Math.random() - 0.5).slice(0, limit)
  return NextResponse.json({ tweets: shuffled, source: 'mock' })
}
