'use client'

import { useEffect, useState, useCallback } from 'react'
import { motion } from 'framer-motion'
import type { WalletTier, PriceData } from '@/lib/types'

interface FartHeaderProps {
  walletTier: WalletTier
  onWalletTierChange: (tier: WalletTier) => void
  onSettingsOpen: () => void
}

const TIER_LABELS: Record<WalletTier, string> = {
  0: 'NO BAG',
  1: '10K+  1.5×',
  2: '100K+ 2×',
  3: '1M+   3×',
}

const TIER_COLORS: Record<WalletTier, string> = {
  0: '#ffffff30',
  1: '#00ff88',
  2: '#aa00ff',
  3: '#ff2244',
}

export function FartHeader({ walletTier, onWalletTierChange, onSettingsOpen }: FartHeaderProps) {
  const [price, setPrice] = useState<PriceData | null>(null)
  const [showTierMenu, setShowTierMenu] = useState(false)

  const fetchPrice = useCallback(async () => {
    try {
      const res = await fetch('/api/price')
      const data: PriceData = await res.json()
      setPrice(data)
    } catch { /* ignore */ }
  }, [])

  useEffect(() => {
    fetchPrice()
    const interval = setInterval(fetchPrice, 15_000)
    return () => clearInterval(interval)
  }, [fetchPrice])

  const tierColor = TIER_COLORS[walletTier]

  return (
    <header className="fixed top-0 inset-x-0 z-50 border-b border-white/[0.06] bg-[#030308]/80 backdrop-blur-xl">
      <div className="max-w-7xl mx-auto px-4 h-14 flex items-center justify-between gap-3">

        {/* Logo */}
        <div className="flex items-center gap-2 flex-shrink-0">
          <motion.span
            className="text-xl"
            animate={{ rotate: [0, -10, 10, -10, 0] }}
            transition={{ duration: 2, repeat: Infinity, repeatDelay: 5 }}
          >
            💨
          </motion.span>
          <span className="font-display text-sm font-black uppercase tracking-wider text-white">
            Fart<span className="text-[#00ff88]">Forge</span>
          </span>
        </div>

        {/* Price ticker */}
        {price && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="hidden sm:flex items-center gap-3 font-mono text-xs"
          >
            <span className="text-white/30">$FARTFORGE</span>
            <span className="text-white/80 font-bold">${price.price.toFixed(5)}</span>
            <span className={price.change24h >= 0 ? 'text-[#00ff88]' : 'text-[#ff2244]'}>
              {price.change24h >= 0 ? '+' : ''}{price.change24h.toFixed(2)}%
            </span>
            {price.source === 'simulated' && (
              <span className="text-white/15 text-[9px]">sim</span>
            )}
          </motion.div>
        )}

        {/* Right controls */}
        <div className="flex items-center gap-2">

          {/* Wallet tier simulator */}
          <div className="relative">
            <button
              onClick={() => setShowTierMenu(v => !v)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded border font-mono text-[10px] uppercase tracking-wider transition-all"
              style={{
                borderColor: tierColor,
                color: tierColor,
                background: tierColor + '12',
              }}
            >
              <span>◈</span>
              <span>{TIER_LABELS[walletTier]}</span>
            </button>

            {showTierMenu && (
              <motion.div
                initial={{ opacity: 0, y: -8, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                className="absolute right-0 top-full mt-1 bg-[#0a0a12] border border-white/10 rounded-lg overflow-hidden z-50 min-w-[160px]"
              >
                {([0, 1, 2, 3] as WalletTier[]).map(tier => (
                  <button
                    key={tier}
                    onClick={() => { onWalletTierChange(tier); setShowTierMenu(false) }}
                    className="w-full text-left px-4 py-2.5 font-mono text-xs hover:bg-white/5 transition-colors flex items-center gap-2"
                    style={{ color: TIER_COLORS[tier] }}
                  >
                    <span className="w-1.5 h-1.5 rounded-full" style={{ background: TIER_COLORS[tier] }} />
                    {TIER_LABELS[tier]}
                  </button>
                ))}
                <div className="px-4 py-2 border-t border-white/5">
                  <p className="font-mono text-[9px] text-white/20">
                    Simulates $FARTFORGE holder tier multipliers
                  </p>
                </div>
              </motion.div>
            )}
          </div>

          {/* Settings */}
          <button
            onClick={onSettingsOpen}
            className="w-8 h-8 flex items-center justify-center rounded border border-white/10 text-white/30 hover:text-white/70 hover:border-white/20 transition-all font-mono text-sm"
          >
            ⚙
          </button>
        </div>
      </div>

      {/* Bottom glow line */}
      <div className="absolute bottom-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-[#00ff8830] to-transparent" />
    </header>
  )
}
