'use client'

import { useState, useCallback, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import dynamic from 'next/dynamic'
import { FartHeader } from '@/components/FartHeader'
import { OdorHUD } from '@/components/OdorHUD'
import { Leaderboard } from '@/components/Leaderboard'
import { ShakeToFart } from '@/components/ShakeToFart'
import { FirehoseTicker } from '@/components/FirehoseTicker'
import { BattleMode } from '@/components/BattleMode'
import { AgentChat } from '@/components/AgentChat'
import { FartSettings } from '@/components/FartSettings'
import { WaveformViz } from '@/components/WaveformViz'
import type { EmitResult, AppSettings, IntensityLevel, WalletTier } from '@/lib/types'

// Three.js scene — client only (SSR would break WebGL)
const FartArena3D = dynamic(() => import('@/components/FartArena3D'), {
  ssr: false,
  loading: () => (
    <div className="flex items-center justify-center h-full">
      <div className="font-mono text-[#00ff88] animate-pulse text-sm tracking-widest">
        INITIALIZING FART REACTOR...
      </div>
    </div>
  ),
})

const DEFAULT_SETTINGS: AppSettings = {
  volume: 0.8,
  particleDensity: 1.0,
  safeMode: false,
  showGrid: true,
  showScanlines: true,
}

const TIER_MULTIPLIERS: Record<WalletTier, number> = { 0: 1, 1: 1.5, 2: 2, 3: 3 }

type Tab = 'arena' | 'battle' | 'leaderboard'

const TABS: { id: Tab; label: string; icon: string }[] = [
  { id: 'arena',       label: 'Arena',  icon: '🧪' },
  { id: 'battle',      label: 'Battle', icon: '⚔️' },
  { id: 'leaderboard', label: 'Board',  icon: '🏆' },
]

const INTENSITIES: IntensityLevel[] = ['silent', 'mild', 'moderate', 'intense', 'nuclear']

const INTENSITY_ICONS: Record<IntensityLevel, string> = {
  silent:   '🤫',
  mild:     '🌬️',
  moderate: '💨',
  intense:  '🔥',
  nuclear:  '☢️',
}

export default function FartArenaPage() {
  const [activeTab, setActiveTab]     = useState<Tab>('arena')
  const [lastEmit, setLastEmit]       = useState<EmitResult | null>(null)
  const [isEmitting, setIsEmitting]   = useState(false)
  const [settings, setSettings]       = useState<AppSettings>(DEFAULT_SETTINGS)
  const [isShaking, setIsShaking]     = useState(false)
  const [walletTier, setWalletTier]   = useState<WalletTier>(0)
  const [showSettings, setShowSettings] = useState(false)
  const [intensity, setIntensity]     = useState<IntensityLevel>('moderate')
  const [context, setContext]         = useState('')
  const [screenShake, setScreenShake] = useState(false)

  const audioCtxRef = useRef<AudioContext | null>(null)
  const stinkMultiplier = TIER_MULTIPLIERS[walletTier]

  // Memoized so it doesn't recreate on every render
  const playAudio = useCallback(async (b64: string, volume: number) => {
    try {
      if (!audioCtxRef.current || audioCtxRef.current.state === 'closed') {
        audioCtxRef.current = new AudioContext()
      }
      const ctx = audioCtxRef.current
      if (ctx.state === 'suspended') await ctx.resume()

      const bytes = Uint8Array.from(atob(b64), c => c.charCodeAt(0))
      const buffer = await ctx.decodeAudioData(bytes.buffer)
      const source = ctx.createBufferSource()
      const gainNode = ctx.createGain()
      gainNode.gain.value = Math.max(0, Math.min(1, volume))
      source.buffer = buffer
      source.connect(gainNode)
      gainNode.connect(ctx.destination)
      source.start()
    } catch {
      // Audio context unavailable (headless, permissions, etc.) — fail silently
    }
  }, [])

  const handleRipOne = useCallback(async (overrideIntensity?: IntensityLevel) => {
    if (isEmitting) return
    setIsEmitting(true)

    const chosenIntensity = overrideIntensity ?? intensity

    try {
      const res = await fetch('/api/fart', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          intensity: chosenIntensity,
          context: context.trim() || 'Arena button press',
          stink_multiplier: stinkMultiplier,
          agent_id: 'arena-user',
        }),
      })

      if (!res.ok) throw new Error(`API error ${res.status}`)
      const data: EmitResult = await res.json()
      setLastEmit(data)

      // Nuclear + 1M holder tier → screen shake
      if (chosenIntensity === 'nuclear' && walletTier >= 3) {
        setScreenShake(true)
        setTimeout(() => setScreenShake(false), 600)
      }

      if (data.audio_b64 && !settings.safeMode) {
        playAudio(data.audio_b64, settings.volume)
      }
    } catch (err) {
      console.error('Fart emission failed:', err)
    } finally {
      setIsEmitting(false)
    }
  }, [isEmitting, intensity, context, stinkMultiplier, walletTier, settings, playAudio])

  return (
    <div
      className={[
        'min-h-screen bg-[#030308] relative overflow-hidden',
        screenShake ? 'screen-shake' : '',
        settings.showScanlines ? 'scanlines' : '',
        settings.showGrid ? 'grid-bg' : '',
      ].filter(Boolean).join(' ')}
    >
      {/* Ambient background glows */}
      <div className="pointer-events-none absolute inset-0 z-0">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-[#00ff88] opacity-[0.03] rounded-full blur-[120px]" />
        <div className="absolute bottom-1/3 right-1/4 w-80 h-80 bg-[#8b00ff] opacity-[0.04] rounded-full blur-[100px]" />
        <div className="absolute top-2/3 left-1/2 w-64 h-64 bg-[#ff00ff] opacity-[0.03] rounded-full blur-[80px]" />
      </div>

      {/* Firehose Ticker */}
      <FirehoseTicker />

      {/* Header */}
      <FartHeader
        walletTier={walletTier}
        onWalletTierChange={setWalletTier}
        onSettingsOpen={() => setShowSettings(true)}
      />

      {/* Main Content */}
      <main className="relative z-10 pt-20 pb-8">

        {/* Hero Banner */}
        <motion.div
          className="relative w-full overflow-hidden mb-4"
          style={{ maxHeight: '220px' }}
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
        >
          <img
            src="/fartforge-banner.jpg"
            alt="FartForge — World's First AI-Agent Fart Analytics Platform"
            className="w-full object-cover object-center"
            style={{
              maxHeight: '220px',
              maskImage: 'linear-gradient(to bottom, black 60%, transparent 100%)',
              WebkitMaskImage: 'linear-gradient(to bottom, black 60%, transparent 100%)',
            }}
          />
          <div className="absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-[#030308] to-transparent pointer-events-none" />
        </motion.div>

        {/* Tab Navigation */}
        <div className="flex items-center justify-center gap-2 mb-6 px-4">
          {TABS.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={[
                'font-mono text-xs font-bold uppercase tracking-widest px-5 py-2 rounded',
                'border transition-all duration-200',
                activeTab === tab.id
                  ? 'border-[#00ff88] text-[#00ff88] bg-[#00ff8815] shadow-[0_0_15px_rgba(0,255,136,0.3)]'
                  : 'border-white/10 text-white/40 hover:text-white/70 hover:border-white/20',
              ].join(' ')}
            >
              {tab.icon} {tab.label}
            </button>
          ))}
        </div>

        <AnimatePresence mode="wait">

          {/* ── ARENA TAB ──────────────────────────────────────────────────── */}
          {activeTab === 'arena' && (
            <motion.div
              key="arena"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.3 }}
              className="px-4 max-w-7xl mx-auto"
            >
              <div className="grid grid-cols-1 lg:grid-cols-[1fr_380px] gap-4">

                {/* LEFT: 3D Scene + Controls */}
                <div className="space-y-4">

                  {/* 3D FartArena */}
                  <div className="holo-card relative overflow-hidden" style={{ height: '420px' }}>
                    <FartArena3D
                      emitResult={lastEmit}
                      isEmitting={isEmitting}
                      walletTier={walletTier}
                      particleDensity={settings.particleDensity}
                    />
                    <div className="absolute inset-0 pointer-events-none rounded-xl border border-[#00ff8830]" />
                    {(['top-0 left-0', 'top-0 right-0', 'bottom-0 left-0', 'bottom-0 right-0'] as const).map((pos, i) => (
                      <div
                        key={i}
                        className={`absolute ${pos} w-4 h-4 border-[#00ff88] opacity-60`}
                        style={{
                          borderTopWidth:    pos.includes('top')    ? 2 : 0,
                          borderBottomWidth: pos.includes('bottom') ? 2 : 0,
                          borderLeftWidth:   pos.includes('left')   ? 2 : 0,
                          borderRightWidth:  pos.includes('right')  ? 2 : 0,
                        }}
                      />
                    ))}
                  </div>

                  {/* Waveform */}
                  <div className="holo-card p-4" style={{ height: '120px' }}>
                    <WaveformViz emitResult={lastEmit} isActive={isEmitting} />
                  </div>

                  {/* RIP ONE Controls */}
                  <div className="holo-card p-5">
                    <div className="flex flex-col sm:flex-row gap-3 items-stretch">
                      {/* Intensity selector */}
                      <div className="flex gap-1 flex-1">
                        {INTENSITIES.map(lvl => (
                          <button
                            key={lvl}
                            onClick={() => setIntensity(lvl)}
                            className={[
                              'flex-1 py-2 text-[10px] font-mono font-bold uppercase rounded',
                              'transition-all duration-150 border',
                              intensity === lvl
                                ? 'bg-[#00ff8820] border-[#00ff88] text-[#00ff88] shadow-[0_0_10px_rgba(0,255,136,0.3)]'
                                : 'bg-transparent border-white/10 text-white/30 hover:text-white/60',
                            ].join(' ')}
                          >
                            {INTENSITY_ICONS[lvl]}<br />{lvl}
                          </button>
                        ))}
                      </div>

                      {/* RIP ONE button */}
                      <motion.button
                        className="btn-rip min-w-[140px]"
                        onClick={() => handleRipOne()}
                        disabled={isEmitting}
                        whileTap={{ scale: 0.95 }}
                      >
                        {isEmitting
                          ? <span className="flex items-center gap-2"><span className="animate-spin">💨</span> RIPPING...</span>
                          : '💨 RIP ONE'
                        }
                      </motion.button>
                    </div>

                    {/* Context input */}
                    <input
                      type="text"
                      value={context}
                      onChange={e => setContext(e.target.value)}
                      onKeyDown={e => e.key === 'Enter' && !isEmitting && handleRipOne()}
                      placeholder="What triggered this emission? (appears on leaderboard)"
                      className="mt-3 w-full bg-black/30 border border-white/10 rounded px-3 py-2
                        text-sm font-mono text-white/70 placeholder-white/20
                        focus:outline-none focus:border-[#00ff8860] focus:bg-black/50 transition-colors"
                      maxLength={120}
                    />
                  </div>

                  {/* Agent chat */}
                  <AgentChat onEmit={handleRipOne} />
                </div>

                {/* RIGHT: HUD + Leaderboard */}
                <div className="space-y-4">
                  <OdorHUD emitResult={lastEmit} stinkMultiplier={stinkMultiplier} />
                  <ShakeToFart
                    onShake={handleRipOne}
                    walletTier={walletTier}
                    isShaking={isShaking}
                    onShakingChange={setIsShaking}
                  />
                  <Leaderboard maxRows={8} />
                </div>
              </div>
            </motion.div>
          )}

          {/* ── BATTLE TAB ──────────────────────────────────────────────────── */}
          {activeTab === 'battle' && (
            <motion.div
              key="battle"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.3 }}
              className="px-4 max-w-7xl mx-auto"
            >
              <BattleMode walletTier={walletTier} />
            </motion.div>
          )}

          {/* ── LEADERBOARD TAB ─────────────────────────────────────────────── */}
          {activeTab === 'leaderboard' && (
            <motion.div
              key="leaderboard"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.3 }}
              className="px-4 max-w-4xl mx-auto"
            >
              <Leaderboard maxRows={50} expanded />
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {/* Settings modal */}
      <AnimatePresence>
        {showSettings && (
          <FartSettings
            settings={settings}
            onSettingsChange={setSettings}
            onClose={() => setShowSettings(false)}
          />
        )}
      </AnimatePresence>
    </div>
  )
}
