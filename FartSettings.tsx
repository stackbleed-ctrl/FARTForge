'use client'

import { motion } from 'framer-motion'
import type { AppSettings } from '@/lib/types'

interface FartSettingsProps {
  settings: AppSettings
  onSettingsChange: (s: AppSettings) => void
  onClose: () => void
}

function Toggle({ label, desc, checked, onChange }: {
  label: string; desc?: string; checked: boolean; onChange: (v: boolean) => void
}) {
  return (
    <div className="flex items-center justify-between py-3 border-b border-white/[0.06]">
      <div>
        <div className="font-mono text-xs text-white/70">{label}</div>
        {desc && <div className="font-mono text-[9px] text-white/25 mt-0.5">{desc}</div>}
      </div>
      <button
        onClick={() => onChange(!checked)}
        className={`relative w-10 h-5 rounded-full transition-all duration-200 ${
          checked ? 'bg-[#00ff88]' : 'bg-white/10'
        }`}
      >
        <span
          className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-all duration-200 ${
            checked ? 'left-[calc(100%-18px)]' : 'left-0.5'
          }`}
        />
      </button>
    </div>
  )
}

function Slider({ label, desc, value, min, max, step, onChange, format }: {
  label: string; desc?: string; value: number; min: number; max: number; step: number;
  onChange: (v: number) => void; format?: (v: number) => string
}) {
  const pct = ((value - min) / (max - min)) * 100

  return (
    <div className="py-3 border-b border-white/[0.06]">
      <div className="flex items-center justify-between mb-2">
        <div>
          <div className="font-mono text-xs text-white/70">{label}</div>
          {desc && <div className="font-mono text-[9px] text-white/25 mt-0.5">{desc}</div>}
        </div>
        <span className="font-display text-xs text-[#00ff88]">
          {format ? format(value) : value.toFixed(1)}
        </span>
      </div>
      <div className="relative h-1.5 bg-white/10 rounded-full overflow-hidden">
        <div
          className="absolute left-0 top-0 h-full bg-[#00ff88] rounded-full transition-all"
          style={{ width: `${pct}%` }}
        />
        <input
          type="range"
          min={min}
          max={max}
          step={step}
          value={value}
          onChange={e => onChange(parseFloat(e.target.value))}
          className="absolute inset-0 w-full opacity-0 cursor-pointer"
        />
      </div>
    </div>
  )
}

export function FartSettings({ settings, onSettingsChange, onClose }: FartSettingsProps) {
  const set = (patch: Partial<AppSettings>) => onSettingsChange({ ...settings, ...patch })

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm"
      onClick={onClose}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.92, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.92, y: 20 }}
        transition={{ type: 'spring', bounce: 0.25 }}
        onClick={e => e.stopPropagation()}
        className="holo-card w-full max-w-sm overflow-hidden"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/[0.06]">
          <span className="font-display text-sm font-bold uppercase tracking-widest text-white/70">
            ⚙ Settings
          </span>
          <button
            onClick={onClose}
            className="w-7 h-7 flex items-center justify-center rounded border border-white/10
              font-mono text-white/30 hover:text-white/70 transition-colors text-sm"
          >
            ✕
          </button>
        </div>

        {/* Controls */}
        <div className="px-5 py-2">
          <Slider
            label="Volume"
            desc="Fart audio playback level"
            value={settings.volume}
            min={0} max={1} step={0.05}
            onChange={v => set({ volume: v })}
            format={v => `${Math.round(v * 100)}%`}
          />
          <Slider
            label="Particle Density"
            desc="Gas cloud particle count multiplier"
            value={settings.particleDensity}
            min={0.1} max={2} step={0.1}
            onChange={v => set({ particleDensity: v })}
            format={v => `${v.toFixed(1)}×`}
          />
          <Toggle
            label="Safe Mode"
            desc="Mutes audio (for stealth ripping)"
            checked={settings.safeMode}
            onChange={v => set({ safeMode: v })}
          />
          <Toggle
            label="Scanlines"
            desc="CRT scanline overlay effect"
            checked={settings.showScanlines}
            onChange={v => set({ showScanlines: v })}
          />
          <Toggle
            label="Grid Background"
            desc="Cyberpunk grid pattern"
            checked={settings.showGrid}
            onChange={v => set({ showGrid: v })}
          />
        </div>

        {/* Footer */}
        <div className="px-5 py-4 border-t border-white/[0.06]">
          <p className="font-mono text-[9px] text-white/20 text-center">
            FartForge v2.0 · MIT License · fartforge.xyz
          </p>
        </div>
      </motion.div>
    </motion.div>
  )
}
