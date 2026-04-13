'use client'

import { motion, AnimatePresence } from 'framer-motion'
import type { EmitResult, OdorCompound } from '@/lib/types'

interface OdorHUDProps {
  emitResult: EmitResult | null
  stinkMultiplier: number
}

const SULFUR_COMPOUNDS = ['H2S', 'methanethiol', 'dimethyl_sulfide']

function CompoundCard({ name, compound, index }: { name: string; compound: OdorCompound; index: number }) {
  const isSulfur = compound.is_sulfur
  const odorBar = compound.odor_threshold_ppb
    ? Math.min(100, (compound.ppm * 1000 / compound.odor_threshold_ppb) / 10)
    : Math.min(100, compound.ppm / 10 * 100)

  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: index * 0.06, duration: 0.3 }}
      className="relative rounded-lg border p-3 overflow-hidden"
      style={{
        borderColor: compound.color_hex + '44',
        background: `linear-gradient(135deg, ${compound.color_hex}08 0%, transparent 60%)`,
      }}
    >
      {/* Shimmer overlay */}
      <div className="absolute inset-0 holo-shimmer pointer-events-none" />

      <div className="flex items-start justify-between mb-1.5">
        <div>
          <div className="flex items-center gap-1.5">
            <span
              className="w-2 h-2 rounded-full flex-shrink-0"
              style={{ background: compound.color_hex, boxShadow: `0 0 6px ${compound.color_hex}` }}
            />
            <span className="font-display text-[10px] font-bold uppercase tracking-wider text-white/80">
              {compound.name}
            </span>
            {isSulfur && (
              <span className="text-[9px] px-1 rounded bg-yellow-500/20 text-yellow-400 font-mono">S</span>
            )}
          </div>
          <span className="font-mono text-[9px] text-white/30 ml-3.5">{compound.formula}</span>
        </div>
        <div className="text-right">
          <div className="font-mono text-xs font-bold" style={{ color: compound.color_hex }}>
            {compound.ppm < 0.01
              ? compound.ppm.toExponential(1)
              : compound.ppm.toFixed(compound.ppm < 1 ? 3 : 2)} ppm
          </div>
          <div className="font-mono text-[9px] text-white/30">
            {compound.descriptor}
          </div>
        </div>
      </div>

      {/* Odor intensity bar */}
      <div className="w-full h-1 rounded-full bg-white/5 overflow-hidden">
        <motion.div
          className="h-full rounded-full"
          style={{ background: compound.color_hex }}
          initial={{ width: 0 }}
          animate={{ width: `${odorBar}%` }}
          transition={{ duration: 0.8, delay: index * 0.06 + 0.2, ease: 'easeOut' }}
        />
      </div>

      {/* Fun fact */}
      <p className="mt-1.5 text-[9px] text-white/25 font-mono leading-relaxed line-clamp-2">
        {compound.fun_fact}
      </p>
    </motion.div>
  )
}

function StinkScoreMeter({ score, multiplier }: { score: number; multiplier: number }) {
  const segments = 10
  const filled = Math.round(score)

  const color = score >= 9 ? '#ff2244' : score >= 7 ? '#f97316' : score >= 4 ? '#facc15' : '#4ade80'

  return (
    <div className="holo-card p-4 mb-3">
      <div className="flex items-center justify-between mb-2">
        <span className="font-display text-xs font-bold uppercase tracking-widest text-white/50">
          Stink Score
        </span>
        {multiplier > 1 && (
          <span className="font-mono text-[10px] px-2 py-0.5 rounded bg-[#00ff8815] border border-[#00ff8830] text-[#00ff88]">
            {multiplier}× HOLDER BOOST
          </span>
        )}
      </div>
      <div className="flex items-end gap-2">
        <motion.div
          className="font-display text-5xl font-black leading-none"
          style={{ color, textShadow: `0 0 20px ${color}60` }}
          key={score}
          initial={{ scale: 1.3, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 0.4, ease: 'backOut' }}
        >
          {score.toFixed(1)}
        </motion.div>
        <div className="font-mono text-white/30 text-sm mb-1">/10</div>
      </div>
      <div className="flex gap-1 mt-2">
        {Array.from({ length: segments }).map((_, i) => (
          <motion.div
            key={i}
            className="flex-1 h-1.5 rounded-full"
            style={{ background: i < filled ? color : 'rgba(255,255,255,0.06)' }}
            initial={{ scaleY: 0 }}
            animate={{ scaleY: 1 }}
            transition={{ delay: i * 0.04, duration: 0.2 }}
          />
        ))}
      </div>
    </div>
  )
}

export function OdorHUD({ emitResult, stinkMultiplier }: OdorHUDProps) {
  if (!emitResult) {
    return (
      <div className="holo-card p-6 flex flex-col items-center justify-center text-center" style={{ minHeight: 200 }}>
        <div className="text-4xl mb-3">💨</div>
        <div className="font-display text-xs uppercase tracking-widest text-white/30">
          Awaiting Emission
        </div>
        <div className="font-mono text-[10px] text-white/15 mt-1">
          Rip one to activate the odor HUD
        </div>
      </div>
    )
  }

  const compounds = emitResult.odor_profile
  const compoundEntries = Object.entries(compounds)
  // Sort: sulfur first, then by ppm desc
  const sorted = compoundEntries.sort(([, a], [, b]) => {
    if (a.is_sulfur && !b.is_sulfur) return -1
    if (!a.is_sulfur && b.is_sulfur) return 1
    return b.ppm - a.ppm
  })

  return (
    <div className="space-y-2">
      <StinkScoreMeter score={emitResult.stink_score} multiplier={stinkMultiplier} />

      {/* Rank badge */}
      {emitResult.rank && (
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          className="holo-card px-4 py-2 flex items-center justify-between"
        >
          <span className="font-mono text-xs text-white/40">Leaderboard Rank</span>
          <span className="font-display text-sm font-bold text-[#00ff88]">
            #{emitResult.rank}
          </span>
        </motion.div>
      )}

      {/* Compound cards */}
      <div className="holo-card p-3">
        <div className="font-display text-[10px] uppercase tracking-widest text-white/30 mb-2 px-1">
          Odor Profile — {compoundEntries.length} Compounds Detected
        </div>
        <div className="space-y-2">
          <AnimatePresence>
            {sorted.map(([key, compound], i) => (
              <CompoundCard key={key} name={key} compound={compound} index={i} />
            ))}
          </AnimatePresence>
        </div>
      </div>
    </div>
  )
}
