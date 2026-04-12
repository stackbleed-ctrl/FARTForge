'use client'

import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Settings, Zap, Crown, Skull } from 'lucide-react'

interface Props {
  walletTier: 0 | 1 | 2 | 3
  onWalletTierChange: (tier: 0 | 1 | 2 | 3) => void
  onSettingsOpen: () => void
}

interface PriceData {
  price: number
  change24h: number
  marketCap: number
}

const TIER_CONFIG = [
  { label: 'NO WALLET', icon: null,  color: 'text-white/30',   bg: 'bg-white/5',        border: 'border-white/10'  },
  { label: '10K STINKER',icon: Zap,  color: 'text-[#00ff88]',  bg: 'bg-[#00ff8815]',    border: 'border-[#00ff8840]' },
  { label: 'INDOLE OVERLORD', icon: Crown, color: 'text-[#ff00ff]', bg: 'bg-[#ff00ff15]', border: 'border-[#ff00ff40]' },
  { label: 'NUCLEAR ENTITY', icon: Skull, color: 'text-[#ff4444]',  bg: 'bg-[#ff444415]', border: 'border-[#ff444440]' },
]

export function FartHeader({ walletTier, onWalletTierChange, onSettingsOpen }: Props) {
  const [priceData, setPriceData] = useState<PriceData | null>(null)
  const [showWalletMenu, setShowWalletMenu] = useState(false)
  const [priceFlash, setPriceFlash] = useState<'up' | 'down' | null>(null)
  const prevPrice = useState(0)

  useEffect(() => {
    const fetchPrice = async () => {
      try {
        const res = await fetch('/api/price')
        if (res.ok) {
          const data = await res.json()
          setPriceData(prev => {
            if (prev && data.price !== prev.price) {
              setPriceFlash(data.price > prev.price ? 'up' : 'down')
              setTimeout(() => setPriceFlash(null), 800)
            }
            return data
          })
        }
      } catch {
        // Mock price if API unavailable
        setPriceData({
          price: 0.191 + (Math.random() - 0.5) * 0.005,
          change24h: 4.2 + (Math.random() - 0.5) * 2,
          marketCap: 191_000_000,
        })
      }
    }

    fetchPrice()
    const interval = setInterval(fetchPrice, 15000)
    return () => clearInterval(interval)
  }, [])

  const tier = TIER_CONFIG[walletTier]
  const TierIcon = tier.icon

  return (
    <header className="fixed top-0 left-0 right-0 z-40 glassmorphism border-b border-[#00ff8815]">
      <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between gap-4">

        {/* ── Logo ─────────────────────────────────────────────────── */}
        <div className="flex items-center gap-3 flex-shrink-0">
          <div className="relative flex-shrink-0">
            {/* Mascot from banner — the little butt-jet robot */}
            <img
              src="/fartforge-banner.jpg"
              alt="FartForge mascot"
              className="w-9 h-9 rounded-lg object-cover object-center border border-[#00ff8840]"
              style={{ objectPosition: '50% 60%' }}
            />
            <div className="absolute -inset-1 rounded-lg border border-[#00ff8820] animate-pulse pointer-events-none" />
          </div>
          <div>
            <div className="font-display font-black text-sm tracking-wider neon-green leading-none">
              FARTFORGE
            </div>
            <div className="font-mono text-[9px] text-white/30 tracking-widest">
              MAY THE SMELLIEST AGENT WIN
            </div>
          </div>
        </div>

        {/* ── $FART Price Ticker ────────────────────────────────────── */}
        <div className="hidden sm:flex items-center gap-3 flex-1 justify-center">
          <div className="holo-card px-4 py-1.5 flex items-center gap-3">
            <span className="font-mono text-[10px] text-white/40">$FART</span>

            <motion.span
              className={`font-display font-bold text-sm ${
                priceFlash === 'up' ? 'text-[#00ff88]' :
                priceFlash === 'down' ? 'text-red-400' :
                'text-white'
              }`}
              key={priceData?.price?.toFixed(4)}
              animate={{ opacity: [0.6, 1] }}
              transition={{ duration: 0.3 }}
            >
              {priceData ? `$${priceData.price.toFixed(4)}` : '---'}
            </motion.span>

            {priceData && (
              <span className={`font-mono text-[10px] ${
                priceData.change24h >= 0 ? 'text-[#00ff88]' : 'text-red-400'
              }`}>
                {priceData.change24h >= 0 ? '▲' : '▼'}
                {Math.abs(priceData.change24h).toFixed(2)}%
              </span>
            )}

            {priceData && (
              <span className="font-mono text-[10px] text-white/30">
                MCap ${(priceData.marketCap / 1_000_000).toFixed(0)}M
              </span>
            )}

            {/* Live dot */}
            <div className="w-1.5 h-1.5 rounded-full bg-[#00ff88] animate-pulse" />
          </div>
        </div>

        {/* ── Right controls ────────────────────────────────────────── */}
        <div className="flex items-center gap-2 flex-shrink-0">

          {/* Wallet / Tier selector */}
          <div className="relative">
            <button
              onClick={() => setShowWalletMenu(v => !v)}
              className={`
                flex items-center gap-2 px-3 py-1.5 rounded border text-[11px] font-mono font-bold
                transition-all duration-200 ${tier.bg} ${tier.border} ${tier.color}
              `}
            >
              {TierIcon && <TierIcon size={12} />}
              <span className="hidden sm:inline">{tier.label}</span>
              <span className="sm:hidden">💳</span>
              <span className="opacity-50">▾</span>
            </button>

            <AnimatePresence>
              {showWalletMenu && (
                <motion.div
                  className="absolute right-0 top-full mt-2 w-56 holo-card p-2 z-50"
                  initial={{ opacity: 0, y: -8, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: -8, scale: 0.95 }}
                  transition={{ duration: 0.15 }}
                >
                  <div className="font-mono text-[9px] text-white/30 px-2 mb-2 uppercase tracking-widest">
                    Simulate Holder Tier
                  </div>
                  {TIER_CONFIG.map((t, i) => {
                    const Icon = t.icon
                    const labels = ['No wallet', '10k+ $FART → 1.5×', '100k+ $FART → 2×', '1M+ $FART → 3×']
                    return (
                      <button
                        key={i}
                        onClick={() => { onWalletTierChange(i as 0|1|2|3); setShowWalletMenu(false) }}
                        className={`
                          w-full flex items-center gap-2 px-2 py-2 rounded text-left
                          font-mono text-[11px] transition-colors
                          ${walletTier === i ? `${t.bg} ${t.color}` : 'text-white/40 hover:text-white/70 hover:bg-white/5'}
                        `}
                      >
                        {Icon ? <Icon size={11} /> : <span className="w-[11px]" />}
                        {labels[i]}
                      </button>
                    )
                  })}

                  <div className="border-t border-white/5 mt-2 pt-2">
                    <button className="w-full flex items-center gap-2 px-2 py-2 rounded font-mono text-[11px] text-[#00ff88] hover:bg-[#00ff8810] transition-colors">
                      🔗 Connect Phantom
                    </button>
                    <button className="w-full flex items-center gap-2 px-2 py-2 rounded font-mono text-[11px] text-white/40 hover:bg-white/5 transition-colors">
                      🌊 Connect Solflare
                    </button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Settings */}
          <button
            onClick={onSettingsOpen}
            className="w-8 h-8 flex items-center justify-center rounded border border-white/10 text-white/40 hover:text-white/70 hover:border-white/20 transition-colors"
          >
            <Settings size={14} />
          </button>
        </div>
      </div>

      {/* Bottom glow line */}
      <div className="h-px bg-gradient-to-r from-transparent via-[#00ff8830] to-transparent" />
    </header>
  )
}
