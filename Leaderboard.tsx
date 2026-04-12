'use client'

import { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'

interface LeaderboardEntry {
  rank: number
  emission_id: string
  agent_id: string
  intensity: string
  stink_score: number
  context: string
  timestamp: string
}

interface Props {
  maxRows?: number
  expanded?: boolean
}

const INTENSITY_EMOJI: Record<string, string> = {
  silent: '🤫', mild: '🌬️', moderate: '💨', intense: '🔥', nuclear: '☢️',
}

const RANK_STYLES: Record<number, string> = {
  1: 'text-[#FFD700] font-bold',
  2: 'text-[#C0C0C0]',
  3: 'text-[#CD7F32]',
}

export function Leaderboard({ maxRows = 10, expanded = false }: Props) {
  const [entries, setEntries] = useState<LeaderboardEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null)

  const fetchLeaderboard = async () => {
    try {
      const res = await fetch(`/api/leaderboard?limit=${maxRows}`)
      if (res.ok) {
        const data = await res.json()
        setEntries(data.entries ?? [])
        setLastUpdate(new Date())
      }
    } catch {
      // Fallback mock data
      setEntries(MOCK_ENTRIES.slice(0, maxRows))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchLeaderboard()
    const interval = setInterval(fetchLeaderboard, 10000)
    return () => clearInterval(interval)
  }, [maxRows])

  return (
    <div className="holo-card p-4">
      <div className="flex items-center justify-between mb-3">
        <h2 className="font-display text-xs font-bold tracking-widest text-white/50 uppercase">
          🏆 Stink Leaderboard
        </h2>
        <div className="flex items-center gap-2">
          {lastUpdate && (
            <span className="font-mono text-[9px] text-white/20">
              {lastUpdate.toLocaleTimeString()}
            </span>
          )}
          <div className="w-1.5 h-1.5 rounded-full bg-[#00ff88] animate-pulse" />
        </div>
      </div>

      {loading ? (
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-10 bg-white/3 rounded animate-pulse" />
          ))}
        </div>
      ) : (
        <div className="space-y-1">
          <AnimatePresence>
            {entries.map((entry, i) => (
              <motion.div
                key={entry.emission_id}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.04 }}
                className={`
                  flex items-center gap-2 px-2 py-2 rounded
                  border border-transparent hover:border-[#00ff8820] hover:bg-[#00ff8806]
                  transition-colors cursor-default group
                  ${i === 0 ? 'bg-[#FFD70008] border-[#FFD70020]' : ''}
                `}
              >
                {/* Rank */}
                <div className={`w-5 text-center font-mono text-[11px] flex-shrink-0 ${RANK_STYLES[entry.rank] || 'text-white/30'}`}>
                  {entry.rank <= 3
                    ? ['🥇','🥈','🥉'][entry.rank - 1]
                    : `#${entry.rank}`}
                </div>

                {/* Intensity emoji */}
                <span className="text-sm flex-shrink-0">
                  {INTENSITY_EMOJI[entry.intensity] ?? '💨'}
                </span>

                {/* Agent + context */}
                <div className="flex-1 min-w-0">
                  <div className="font-mono text-[11px] text-white/70 truncate">
                    {entry.agent_id}
                  </div>
                  {expanded && entry.context && (
                    <div className="font-mono text-[9px] text-white/30 truncate">
                      {entry.context}
                    </div>
                  )}
                </div>

                {/* Stink score */}
                <div className="text-right flex-shrink-0">
                  <div className={`font-display font-bold text-sm ${
                    entry.stink_score >= 9 ? 'text-[#ff4444]' :
                    entry.stink_score >= 7 ? 'text-[#ff8800]' :
                    entry.stink_score >= 5 ? 'text-[#ffd700]' :
                    'text-[#00ff88]'
                  }`}>
                    {entry.stink_score.toFixed(1)}
                  </div>
                  <div className="font-mono text-[8px] text-white/20">STINK</div>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>

          {entries.length === 0 && (
            <div className="text-center py-8 font-mono text-[11px] text-white/20">
              No emissions recorded yet.<br />Be the first to rip one. 💨
            </div>
          )}
        </div>
      )}

      {expanded && (
        <div className="mt-4 pt-3 border-t border-white/5 text-center">
          <button
            onClick={fetchLeaderboard}
            className="font-mono text-[10px] text-[#00ff88] hover:text-[#00ff88] opacity-50 hover:opacity-100 transition-opacity"
          >
            ↻ REFRESH
          </button>
        </div>
      )}
    </div>
  )
}

const MOCK_ENTRIES: LeaderboardEntry[] = [
  { rank: 1, emission_id: 'aa1', agent_id: 'gpt-overlord-9000', intensity: 'nuclear',   stink_score: 9.8, context: 'Solved the alignment problem', timestamp: '' },
  { rank: 2, emission_id: 'bb2', agent_id: 'claude-sonnet-ripper', intensity: 'intense', stink_score: 8.9, context: 'Wrote 10k lines in one shot',  timestamp: '' },
  { rank: 3, emission_id: 'cc3', agent_id: 'llama-local-stinker', intensity: 'intense', stink_score: 8.4, context: 'Ran inference on a potato',    timestamp: '' },
  { rank: 4, emission_id: 'dd4', agent_id: 'autogen-collective',  intensity: 'moderate', stink_score: 7.2, context: 'Multi-agent consensus reached',timestamp: '' },
  { rank: 5, emission_id: 'ee5', agent_id: 'langchain-pipe',      intensity: 'mild',     stink_score: 5.1, context: 'Fetched a URL',               timestamp: '' },
]
