'use client'

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'

interface BattleAgent {
  id: string
  name: string
  stinkScore: number
  intensity: string
  votes: number
  stake: number
}

interface Props {
  walletTier: 0 | 1 | 2 | 3
}

const INTENSITY_EMOJI: Record<string, string> = {
  silent: '🤫', mild: '🌬️', moderate: '💨', intense: '🔥', nuclear: '☢️',
}

const PRESET_AGENTS = [
  'gpt-overlord-9000', 'claude-sonnet-ripper', 'llama-local-stinker',
  'autogen-collective', 'gemini-ultra-riper', 'mistral-le-stinkeur',
  'falcon-40b-farter', 'deepseek-coder-ripper',
]

export function BattleMode({ walletTier }: Props) {
  const [agentA, setAgentA] = useState<BattleAgent | null>(null)
  const [agentB, setAgentB] = useState<BattleAgent | null>(null)
  const [battleActive, setBattleActive] = useState(false)
  const [winner, setWinner] = useState<'A' | 'B' | null>(null)
  const [stakeAmount, setStakeAmount] = useState(1000)
  const [votedFor, setVotedFor] = useState<'A' | 'B' | null>(null)
  const [countdown, setCountdown] = useState<number | null>(null)

  const generateAgent = (): BattleAgent => ({
    id: crypto.randomUUID(),
    name: PRESET_AGENTS[Math.floor(Math.random() * PRESET_AGENTS.length)],
    stinkScore: 0,
    intensity: 'moderate',
    votes: Math.floor(Math.random() * 500),
    stake: Math.floor(Math.random() * 50000),
  })

  const startBattle = async () => {
    const a = generateAgent()
    const b = generateAgent()
    setAgentA(a)
    setAgentB(b)
    setBattleActive(true)
    setWinner(null)
    setVotedFor(null)

    // Countdown
    for (let i = 3; i >= 1; i--) {
      setCountdown(i)
      await new Promise(r => setTimeout(r, 1000))
    }
    setCountdown(null)

    // Simulate battle
    await new Promise(r => setTimeout(r, 2000))

    const scoreA = 3 + Math.random() * 7
    const scoreB = 3 + Math.random() * 7
    const intensities = ['mild', 'moderate', 'intense', 'nuclear']

    setAgentA(prev => prev ? { ...prev, stinkScore: parseFloat(scoreA.toFixed(1)), intensity: intensities[Math.floor(Math.random() * 4)] } : null)
    setAgentB(prev => prev ? { ...prev, stinkScore: parseFloat(scoreB.toFixed(1)), intensity: intensities[Math.floor(Math.random() * 4)] } : null)

    await new Promise(r => setTimeout(r, 1000))
    setWinner(scoreA >= scoreB ? 'A' : 'B')
    setBattleActive(false)
  }

  const vote = (side: 'A' | 'B') => {
    if (votedFor || winner) return
    setVotedFor(side)
    if (side === 'A') setAgentA(prev => prev ? { ...prev, votes: prev.votes + 1 } : null)
    else setAgentB(prev => prev ? { ...prev, votes: prev.votes + 1 } : null)
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="text-center">
        <h2 className="font-display font-black text-2xl tracking-widest mb-1" style={{
          background: 'linear-gradient(135deg, #00ff88, #ff00ff)',
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent',
        }}>
          ⚔️ BATTLE MODE
        </h2>
        <p className="font-mono text-xs text-white/30">
          Side-by-side agent fart battles. Stake $FART. Vote. Win.
        </p>
      </div>

      {/* Battle Arena */}
      <div className="grid grid-cols-[1fr_auto_1fr] gap-4 items-center">

        {/* Agent A */}
        <AgentCard
          agent={agentA}
          side="A"
          isWinner={winner === 'A'}
          isLoser={winner === 'B'}
          isBattling={battleActive}
          votedFor={votedFor}
          onVote={() => vote('A')}
        />

        {/* VS */}
        <div className="text-center space-y-2">
          <div className="battle-vs">VS</div>
          {countdown !== null && (
            <motion.div
              key={countdown}
              className="font-display text-4xl font-black text-white"
              initial={{ scale: 2, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0 }}
            >
              {countdown}
            </motion.div>
          )}
        </div>

        {/* Agent B */}
        <AgentCard
          agent={agentB}
          side="B"
          isWinner={winner === 'B'}
          isLoser={winner === 'A'}
          isBattling={battleActive}
          votedFor={votedFor}
          onVote={() => vote('B')}
        />
      </div>

      {/* Controls */}
      <div className="holo-card p-4 space-y-4">
        {/* Stake */}
        {walletTier > 0 && (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="font-mono text-[11px] text-white/40">Stake Amount</span>
              <span className="font-mono text-[11px] text-[#00ff88]">{stakeAmount.toLocaleString()} $FART</span>
            </div>
            <input
              type="range"
              min={100}
              max={walletTier >= 3 ? 1000000 : walletTier >= 2 ? 100000 : 10000}
              step={100}
              value={stakeAmount}
              onChange={e => setStakeAmount(Number(e.target.value))}
              className="w-full accent-[#00ff88]"
            />
            <div className="flex justify-between font-mono text-[9px] text-white/20">
              <span>100</span>
              <span>{walletTier >= 3 ? '1M' : walletTier >= 2 ? '100K' : '10K'}</span>
            </div>
          </div>
        )}

        {/* Battle button */}
        <motion.button
          className="w-full btn-rip py-3"
          onClick={startBattle}
          disabled={battleActive}
          whileTap={{ scale: 0.97 }}
        >
          {battleActive ? (
            <span className="flex items-center justify-center gap-2">
              <motion.span animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 0.8, ease: 'linear' }}>
                💨
              </motion.span>
              BATTLE IN PROGRESS...
            </span>
          ) : winner ? '🔄 NEW BATTLE' : '⚔️ START BATTLE'}
        </motion.button>

        {/* Winner announcement */}
        <AnimatePresence>
          {winner && agentA && agentB && (
            <motion.div
              className="text-center p-4 rounded border border-[#ffd70040] bg-[#ffd70008]"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0 }}
            >
              <div className="font-display text-lg font-black text-[#ffd700] mb-1">
                🏆 {winner === 'A' ? agentA.name : agentB.name} WINS!
              </div>
              <div className="font-mono text-xs text-white/40">
                {(winner === 'A' ? agentA.stinkScore : agentB.stinkScore).toFixed(1)} vs {(winner === 'A' ? agentB.stinkScore : agentA.stinkScore).toFixed(1)} stink score
              </div>
              {votedFor === winner ? (
                <div className="mt-2 font-mono text-xs text-[#00ff88]">
                  ✓ Correct vote! +{stakeAmount.toLocaleString()} $FART
                </div>
              ) : votedFor && (
                <div className="mt-2 font-mono text-xs text-red-400">
                  ✗ Wrong vote. -{Math.floor(stakeAmount * 0.5).toLocaleString()} $FART
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  )
}

function AgentCard({ agent, side, isWinner, isLoser, isBattling, votedFor, onVote }: {
  agent: BattleAgent | null
  side: 'A' | 'B'
  isWinner: boolean
  isLoser: boolean
  isBattling: boolean
  votedFor: 'A' | 'B' | null
  onVote: () => void
}) {
  return (
    <motion.div
      className={`
        holo-card p-4 text-center space-y-3 transition-all duration-500
        ${isWinner ? 'border-[#ffd700] shadow-[0_0_30px_rgba(255,215,0,0.3)]' : ''}
        ${isLoser ? 'opacity-40' : ''}
      `}
      animate={isBattling ? { scale: [1, 1.02, 1] } : {}}
      transition={{ repeat: isBattling ? Infinity : 0, duration: 0.5 }}
    >
      {/* Agent avatar */}
      <div className={`
        w-16 h-16 mx-auto rounded-full border-2 flex items-center justify-center text-3xl
        ${isWinner ? 'border-[#ffd700] shadow-[0_0_20px_rgba(255,215,0,0.4)]' : 'border-[#00ff8840]'}
        ${isBattling ? 'animate-pulse' : ''}
      `}>
        🤖
      </div>

      {/* Name */}
      <div className="font-mono text-[11px] text-white/70 break-all">
        {agent ? agent.name : `Agent ${side}`}
      </div>

      {/* Stink score */}
      {agent && agent.stinkScore > 0 && (
        <motion.div
          className="font-display font-black text-2xl text-[#00ff88] neon-green"
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ type: 'spring', stiffness: 300 }}
        >
          {agent.stinkScore.toFixed(1)}
          <span className="text-sm font-normal text-white/30 ml-1">/10</span>
        </motion.div>
      )}

      {/* Intensity */}
      {agent && agent.intensity && agent.stinkScore > 0 && (
        <div className="font-mono text-xs text-white/40">
          {INTENSITY_EMOJI[agent.intensity]} {agent.intensity.toUpperCase()}
        </div>
      )}

      {/* Votes */}
      {agent && (
        <div className="font-mono text-[10px] text-white/30">
          {agent.votes.toLocaleString()} votes
        </div>
      )}

      {/* Vote button */}
      {agent && !isWinner && !isLoser && (
        <button
          onClick={onVote}
          disabled={!!votedFor}
          className={`
            w-full py-1.5 rounded border text-[11px] font-mono font-bold uppercase
            transition-all duration-150
            ${votedFor === side
              ? 'border-[#00ff88] text-[#00ff88] bg-[#00ff8820]'
              : votedFor
              ? 'border-white/10 text-white/20 cursor-not-allowed'
              : 'border-[#00ff8840] text-white/50 hover:border-[#00ff88] hover:text-[#00ff88] cursor-pointer'
            }
          `}
        >
          {votedFor === side ? '✓ VOTED' : `VOTE ${side}`}
        </button>
      )}

      {isWinner && (
        <motion.div
          className="font-display text-xs font-black text-[#ffd700]"
          animate={{ scale: [1, 1.1, 1] }}
          transition={{ repeat: Infinity, duration: 1 }}
        >
          👑 WINNER
        </motion.div>
      )}
    </motion.div>
  )
}
