'use client'

import { useState, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import type { EmitResult, IntensityLevel, WalletTier } from '@/lib/types'

interface BattleModeProps {
  walletTier: WalletTier
}

const PRESET_AGENTS = [
  'gpt-overlord-9000',
  'claude-sonnet-ripper',
  'llama-local-stinker',
  'gemini-ultra-riper',
  'grok-beta-ripper',
  'mistral-le-stinkeur',
]

const INTENSITIES: IntensityLevel[] = ['silent', 'mild', 'moderate', 'intense', 'nuclear']

interface Combatant {
  agentId: string
  intensity: IntensityLevel
  result: EmitResult | null
  loading: boolean
}

async function emitForAgent(agentId: string, intensity: IntensityLevel, multiplier: number): Promise<EmitResult> {
  const res = await fetch('/api/fart', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      agent_id: agentId,
      intensity,
      context: 'Battle Mode',
      stink_multiplier: multiplier,
    }),
  })
  if (!res.ok) throw new Error('Emit failed')
  return res.json()
}

function CombatantCard({
  side,
  combatant,
  onAgentChange,
  onIntensityChange,
  isWinner,
  battleDone,
}: {
  side: 'left' | 'right'
  combatant: Combatant
  onAgentChange: (id: string) => void
  onIntensityChange: (i: IntensityLevel) => void
  isWinner: boolean
  battleDone: boolean
}) {
  const score = combatant.result?.stink_score ?? 0
  const color = isWinner && battleDone ? '#00ff88' : '#ffffff30'

  return (
    <motion.div
      className="holo-card p-5 flex-1"
      animate={isWinner && battleDone ? { boxShadow: '0 0 40px rgba(0,255,136,0.3)' } : {}}
    >
      {/* Winner crown */}
      <AnimatePresence>
        {isWinner && battleDone && (
          <motion.div
            initial={{ opacity: 0, scale: 0.5, y: -10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            className="text-center text-3xl mb-2"
          >
            👑
          </motion.div>
        )}
      </AnimatePresence>

      <div className="font-display text-[10px] uppercase tracking-widest text-white/30 mb-3 text-center">
        {side === 'left' ? 'Agent Alpha' : 'Agent Beta'}
      </div>

      {/* Agent selector */}
      <select
        value={combatant.agentId}
        onChange={e => onAgentChange(e.target.value)}
        className="w-full bg-black/30 border border-white/10 rounded px-3 py-2 font-mono text-xs text-white/70
          focus:outline-none focus:border-[#00ff8860] mb-3"
      >
        {PRESET_AGENTS.map(a => (
          <option key={a} value={a} className="bg-[#030308]">{a}</option>
        ))}
        <option value="custom-agent" className="bg-[#030308]">custom-agent</option>
      </select>

      {/* Intensity */}
      <div className="flex gap-1 mb-4">
        {INTENSITIES.map(lvl => (
          <button
            key={lvl}
            onClick={() => onIntensityChange(lvl)}
            className={[
              'flex-1 py-1.5 text-[9px] font-mono uppercase rounded border transition-all',
              combatant.intensity === lvl
                ? 'border-[#00ff88] text-[#00ff88] bg-[#00ff8815]'
                : 'border-white/10 text-white/25 hover:text-white/50',
            ].join(' ')}
          >
            {lvl[0].toUpperCase()}
          </button>
        ))}
      </div>

      {/* Score display */}
      <div className="text-center py-4">
        {combatant.loading ? (
          <span className="font-mono text-xs text-white/30 animate-pulse">ripping...</span>
        ) : combatant.result ? (
          <motion.div
            initial={{ scale: 0.5, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ type: 'spring', bounce: 0.4 }}
          >
            <div
              className="font-display text-6xl font-black"
              style={{ color, textShadow: isWinner && battleDone ? '0 0 30px #00ff8870' : 'none' }}
            >
              {score.toFixed(1)}
            </div>
            <div className="font-mono text-xs text-white/30 mt-1">stink score</div>
            <div className="font-mono text-[10px] text-white/20 mt-0.5">
              {combatant.result.odor_profile?.H2S
                ? `H₂S: ${(combatant.result.odor_profile.H2S as {ppm: number}).ppm.toFixed(2)} ppm`
                : ''}
            </div>
          </motion.div>
        ) : (
          <div className="font-display text-6xl font-black text-white/10">—</div>
        )}
      </div>
    </motion.div>
  )
}

export function BattleMode({ walletTier }: BattleModeProps) {
  const multiplier = [1, 1.5, 2, 3][walletTier]

  const [alpha, setAlpha] = useState<Combatant>({
    agentId: PRESET_AGENTS[0], intensity: 'intense', result: null, loading: false,
  })
  const [beta, setBeta] = useState<Combatant>({
    agentId: PRESET_AGENTS[1], intensity: 'nuclear', result: null, loading: false,
  })
  const [battleDone, setBattleDone] = useState(false)

  const startBattle = useCallback(async () => {
    setBattleDone(false)
    setAlpha(a => ({ ...a, result: null, loading: true }))
    setBeta(b => ({ ...b, result: null, loading: true }))

    try {
      const [rA, rB] = await Promise.all([
        emitForAgent(alpha.agentId, alpha.intensity, multiplier),
        emitForAgent(beta.agentId, beta.intensity, multiplier),
      ])
      setAlpha(a => ({ ...a, result: rA, loading: false }))
      setBeta(b => ({ ...b, result: rB, loading: false }))
      setBattleDone(true)
    } catch {
      setAlpha(a => ({ ...a, loading: false }))
      setBeta(b => ({ ...b, loading: false }))
    }
  }, [alpha.agentId, alpha.intensity, beta.agentId, beta.intensity, multiplier])

  const alphaScore = alpha.result?.stink_score ?? 0
  const betaScore = beta.result?.stink_score ?? 0
  const alphaWins = battleDone && alphaScore >= betaScore
  const betaWins = battleDone && betaScore > alphaScore
  const isTie = battleDone && alphaScore === betaScore

  return (
    <div className="space-y-4">
      <div className="text-center">
        <div className="font-display text-lg font-black uppercase tracking-widest text-white/80">
          ⚔️ Battle Mode
        </div>
        <div className="font-mono text-xs text-white/30 mt-1">
          Side-by-side agent fart battle. May the smelliest agent win.
        </div>
      </div>

      {/* VS Layout */}
      <div className="flex gap-3 items-stretch">
        <CombatantCard
          side="left"
          combatant={alpha}
          onAgentChange={id => setAlpha(a => ({ ...a, agentId: id }))}
          onIntensityChange={i => setAlpha(a => ({ ...a, intensity: i }))}
          isWinner={alphaWins}
          battleDone={battleDone}
        />

        {/* VS divider */}
        <div className="flex flex-col items-center justify-center gap-2 flex-shrink-0 w-12">
          <div className="w-px flex-1 bg-white/10" />
          <span className="font-display text-sm font-black text-white/20">VS</span>
          <div className="w-px flex-1 bg-white/10" />
        </div>

        <CombatantCard
          side="right"
          combatant={beta}
          onAgentChange={id => setBeta(b => ({ ...b, agentId: id }))}
          onIntensityChange={i => setBeta(b => ({ ...b, intensity: i }))}
          isWinner={betaWins}
          battleDone={battleDone}
        />
      </div>

      {/* Battle result banner */}
      <AnimatePresence>
        {battleDone && (
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="holo-card p-4 text-center"
          >
            {isTie ? (
              <div className="font-display text-sm font-bold text-white/50">🤝 IT'S A TIE — BOTH EQUALLY RANK</div>
            ) : (
              <>
                <div className="font-display text-base font-black text-[#00ff88]">
                  {alphaWins ? alpha.agentId : beta.agentId} WINS
                </div>
                <div className="font-mono text-xs text-white/30 mt-1">
                  by {Math.abs(alphaScore - betaScore).toFixed(2)} stink points
                </div>
              </>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Battle button */}
      <motion.button
        onClick={startBattle}
        disabled={alpha.loading || beta.loading}
        whileTap={{ scale: 0.97 }}
        className="w-full btn-rip py-4 text-base"
      >
        {alpha.loading || beta.loading ? '💨 RIPPING...' : '⚔️ START BATTLE'}
      </motion.button>

      {walletTier > 0 && (
        <div className="text-center font-mono text-[10px] text-[#00ff88]">
          {multiplier}× holder multiplier applied to both agents
        </div>
      )}
    </div>
  )
}
