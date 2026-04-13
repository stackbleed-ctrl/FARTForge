'use client'

import { useEffect, useState, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import type { LeaderboardEntry, IntensityLevel } from '@/lib/types'

interface LeaderboardProps {
  maxRows?: number
  expanded?: boolean
}

const INTENSITY_ICONS: Record<IntensityLevel, string> = {
  silent: '🤫', mild: '🌬️', moderate: '💨', intense: '🔥', nuclear: '☢️',
}

const RANK_STYLES: Record<number, string> = {
  1: 'text-yellow-400',
  2: 'text-slate-300',
  3: 'text-amber-600',
}

function scoreColor(score: number) {
  if (score >= 9) return '#ff2244'
  if (score >= 7) return '#f97316'
  if (score >= 4) return '#facc15'
  return '#4ade80'
}

function timeAgo(ts: string) {
  const diff = Date.now() - new Date(ts).getTime()
  const mins = Math.floor(diff / 60_000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  return `${Math.floor(hrs / 24)}d ago`
}

export function Leaderboard({ maxRows = 10, expanded = false }: LeaderboardProps) {
  const [entries, setEntries] = useState<LeaderboardEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [source, setSource] = useState<string>('')

  const fetchLeaderboard = useCallback(async () => {
    try {
      const res = await fetch(`/api/leaderboard?limit=${maxRows}`)
      const data = await res.json()
      setEntries(data.entries ?? [])
      setSource(data.source ?? '')
    } catch {
      // Keep existing data on error
    } finally {
      setLoading(false)
    }
  }, [maxRows])

  useEffect(() => {
    fetchLeaderboard()
    // Poll every 15s for live updates
    const interval = setInterval(fetchLeaderboard, 15_000)
    return () => clearInterval(interval)
  }, [fetchLeaderboard])

  return (
    <div className="holo-card overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-white/5">
        <span className="font-display text-xs font-bold uppercase tracking-widest text-white/60">
          🏆 Leaderboard
        </span>
        <div className="flex items-center gap-2">
          {source === 'mock' && (
            <span className="font-mono text-[9px] text-white/20">demo data</span>
          )}
          <button
            onClick={fetchLeaderboard}
            className="font-mono text-[9px] text-white/30 hover:text-[#00ff88] transition-colors"
          >
            ↻ refresh
          </button>
        </div>
      </div>

      {/* Column headers */}
      <div className="grid grid-cols-[28px_1fr_64px_40px] gap-2 px-4 py-1.5 border-b border-white/5">
        {['#', 'Agent', 'Score', 'Time'].map(h => (
          <span key={h} className="font-display text-[9px] uppercase tracking-widest text-white/20">
            {h}
          </span>
        ))}
      </div>

      {/* Rows */}
      <div className="overflow-y-auto" style={{ maxHeight: expanded ? '70vh' : '320px' }}>
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <span className="font-mono text-xs text-white/20 animate-pulse">loading...</span>
          </div>
        ) : (
          <AnimatePresence>
            {entries.map((entry, idx) => (
              <motion.div
                key={entry.emission_id}
                initial={{ opacity: 0, x: -12 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: idx * 0.03 }}
                className="grid grid-cols-[28px_1fr_64px_40px] gap-2 px-4 py-2.5 border-b border-white/[0.03]
                  hover:bg-white/[0.02] transition-colors group"
              >
                {/* Rank */}
                <span className={`font-display text-xs font-bold ${RANK_STYLES[entry.rank] ?? 'text-white/30'}`}>
                  {entry.rank <= 3 ? ['🥇','🥈','🥉'][entry.rank - 1] : `#${entry.rank}`}
                </span>

                {/* Agent + context */}
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="text-[10px]">{INTENSITY_ICONS[entry.intensity]}</span>
                    <span className="font-mono text-xs text-white/70 truncate">{entry.agent_id}</span>
                  </div>
                  <div className="font-mono text-[9px] text-white/25 truncate mt-0.5">
                    {entry.context}
                  </div>
                </div>

                {/* Score */}
                <div className="flex items-center justify-end">
                  <span
                    className="font-display text-sm font-bold"
                    style={{ color: scoreColor(entry.stink_score) }}
                  >
                    {entry.stink_score.toFixed(1)}
                  </span>
                </div>

                {/* Time */}
                <div className="flex items-center justify-end">
                  <span className="font-mono text-[9px] text-white/20 group-hover:text-white/40 transition-colors">
                    {timeAgo(entry.timestamp)}
                  </span>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        )}
      </div>
    </div>
  )
}
