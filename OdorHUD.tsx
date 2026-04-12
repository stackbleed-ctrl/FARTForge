'use client'

import { motion, AnimatePresence } from 'framer-motion'
import type { EmitResult } from '@/lib/types'

interface Props {
  emitResult: EmitResult | null
  stinkMultiplier: number
}

const COMPOUND_ORDER = ['H2S', 'methanethiol', 'dimethyl_sulfide', 'indole', 'skatole']

const COMPOUND_DISPLAY: Record<string, { emoji: string; shortName: string; color: string }> = {
  H2S:              { emoji: '🥚', shortName: 'H₂S',    color: '#FFD700' },
  methanethiol:     { emoji: '🥬', shortName: 'CH₃SH',  color: '#90EE90' },
  dimethyl_sulfide: { emoji: '🌊', shortName: 'DMS',    color: '#87CEEB' },
  indole:           { emoji: '💜', shortName: 'Indole', color: '#9B59B6' },
  skatole:          { emoji: '💩', shortName: 'Skatole',color: '#8B4513' },
}

export function OdorHUD({ emitResult, stinkMultiplier }: Props) {
  const compounds = emitResult?.odor_profile ?? {}
  const stinkScore = emitResult?.stink_score ?? 0
  const hasData = emitResult !== null

  return (
    <div className="holo-card p-4 space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="font-display text-xs font-bold tracking-widest text-white/50 uppercase">
          Odor Profile HUD
        </h2>
        {stinkMultiplier > 1 && (
          <span className="text-[10px] font-mono text-[#ff00ff] bg-[#ff00ff15] px-2 py-0.5 rounded border border-[#ff00ff30]">
            {stinkMultiplier}× HOLDER BOOST
          </span>
        )}
      </div>

      {/* Stink Score Meter */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <span className="font-mono text-[10px] text-white/40 uppercase tracking-wider">
            Stink Score
          </span>
          <motion.span
            className="font-display font-bold text-lg neon-green"
            key={stinkScore}
            initial={{ scale: 1.5, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ type: 'spring', stiffness: 300 }}
          >
            {hasData ? `${stinkScore.toFixed(1)}/10` : '—'}
          </motion.span>
        </div>
        <div className="h-2 bg-white/5 rounded-full overflow-hidden">
          <motion.div
            className="h-full stink-meter"
            initial={{ width: 0 }}
            animate={{ width: hasData ? `${stinkScore * 10}%` : '0%' }}
            transition={{ duration: 0.8, ease: [0.34, 1.56, 0.64, 1] }}
          />
        </div>
        {hasData && (
          <div className="flex justify-between text-[9px] font-mono text-white/20">
            <span>FRAGRANT</span>
            <span>CATASTROPHIC</span>
          </div>
        )}
      </div>

      {/* Compound Cards */}
      <div className="space-y-1.5">
        <div className="font-mono text-[10px] text-white/30 uppercase tracking-wider mb-2">
          Chemical Composition
        </div>

        <AnimatePresence>
          {hasData ? (
            COMPOUND_ORDER.filter(k => compounds[k]).map((key, i) => {
              const compound = compounds[key]
              const display = COMPOUND_DISPLAY[key]
              const maxPpm = key === 'H2S' ? 12 : key === 'methanethiol' ? 4 : 2
              const barWidth = Math.min(100, (compound.ppm / maxPpm) * 100)

              return (
                <motion.div
                  key={key}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 20 }}
                  transition={{ delay: i * 0.05 }}
                  className="group relative"
                >
                  <div
                    className="rounded p-2.5 border border-white/5 bg-black/20 hover:bg-black/40 transition-colors cursor-default"
                    style={{ borderLeftColor: display?.color + '40', borderLeftWidth: 2 }}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center gap-2">
                        <span className="text-base">{display?.emoji}</span>
                        <div>
                          <div className="font-mono text-[11px] font-bold" style={{ color: display?.color }}>
                            {display?.shortName}
                          </div>
                          <div className="font-mono text-[9px] text-white/30">
                            {compound.descriptor}
                          </div>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="font-mono text-[11px] font-bold text-white/70">
                          {compound.ppm.toFixed(3)} ppm
                        </div>
                        {compound.odor_units > 0 && (
                          <div className="font-mono text-[9px] text-white/30">
                            {compound.odor_units.toFixed(0)} OU
                          </div>
                        )}
                      </div>
                    </div>

                    {/* PPM bar */}
                    <div className="h-1 bg-white/5 rounded-full overflow-hidden">
                      <motion.div
                        className="h-full rounded-full"
                        style={{ backgroundColor: display?.color }}
                        initial={{ width: 0 }}
                        animate={{ width: `${barWidth}%` }}
                        transition={{ duration: 0.6, delay: i * 0.05 + 0.2 }}
                      />
                    </div>
                  </div>

                  {/* Tooltip with fun fact */}
                  {compound.fun_fact && (
                    <div className="
                      absolute left-0 right-0 bottom-full mb-1 z-50
                      opacity-0 group-hover:opacity-100 pointer-events-none
                      transition-opacity duration-200
                    ">
                      <div className="glassmorphism border border-white/10 rounded p-2 text-[10px] font-mono text-white/60">
                        {compound.fun_fact}
                      </div>
                    </div>
                  )}
                </motion.div>
              )
            })
          ) : (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="text-center py-8 text-white/20 font-mono text-xs"
            >
              <div className="text-4xl mb-2">💨</div>
              <div>AWAITING EMISSION</div>
              <div className="text-[10px] mt-1 text-white/10">Hit RIP ONE to begin analysis</div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Emission metadata */}
      {emitResult && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="border-t border-white/5 pt-3 space-y-1"
        >
          {[
            ['Emission ID', emitResult.emission_id],
            ['Intensity', emitResult.intensity.toUpperCase()],
            ['Duration', `${emitResult.fingerprint?.duration_ms ?? '?'}ms`],
            ['Rank', `#${emitResult.rank ?? '?'}`],
          ].map(([label, value]) => (
            <div key={label} className="flex justify-between">
              <span className="font-mono text-[10px] text-white/30">{label}</span>
              <span className="font-mono text-[10px] text-white/60">{value}</span>
            </div>
          ))}
        </motion.div>
      )}
    </div>
  )
}
