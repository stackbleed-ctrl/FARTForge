'use client'

import { motion } from 'framer-motion'
import { X } from 'lucide-react'
import type { AppSettings } from '@/lib/types'

interface Props {
  settings: AppSettings
  onSettingsChange: (s: AppSettings) => void
  onClose: () => void
}

export function FartSettings({ settings, onSettingsChange, onClose }: Props) {
  const update = (patch: Partial<AppSettings>) =>
    onSettingsChange({ ...settings, ...patch })

  return (
    <motion.div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={onClose}
    >
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />

      <motion.div
        className="relative holo-card p-6 w-full max-w-sm"
        initial={{ scale: 0.9, opacity: 0, y: 20 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        exit={{ scale: 0.9, opacity: 0, y: 20 }}
        transition={{ type: 'spring', stiffness: 300, damping: 25 }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <h2 className="font-display font-bold text-sm tracking-widest text-white/70 uppercase">
            ⚙️ Arena Settings
          </h2>
          <button onClick={onClose} className="text-white/30 hover:text-white/70 transition-colors">
            <X size={16} />
          </button>
        </div>

        <div className="space-y-5">
          {/* Volume */}
          <div className="space-y-2">
            <div className="flex justify-between">
              <label className="font-mono text-xs text-white/50">Volume</label>
              <span className="font-mono text-xs text-[#00ff88]">{Math.round(settings.volume * 100)}%</span>
            </div>
            <input
              type="range" min={0} max={1} step={0.05}
              value={settings.volume}
              onChange={e => update({ volume: parseFloat(e.target.value) })}
              className="w-full accent-[#00ff88]"
            />
          </div>

          {/* Particle Density */}
          <div className="space-y-2">
            <div className="flex justify-between">
              <label className="font-mono text-xs text-white/50">Particle Density</label>
              <span className="font-mono text-xs text-[#00ff88]">{Math.round(settings.particleDensity * 100)}%</span>
            </div>
            <input
              type="range" min={0.1} max={2} step={0.1}
              value={settings.particleDensity}
              onChange={e => update({ particleDensity: parseFloat(e.target.value) })}
              className="w-full accent-[#00ff88]"
            />
            <div className="font-mono text-[9px] text-white/20">Higher = more particles, higher GPU load</div>
          </div>

          {/* Toggles */}
          {[
            { key: 'safeMode',      label: 'Safe Mode',      desc: 'Disables audio playback' },
            { key: 'showGrid',      label: 'Background Grid', desc: 'Toxic green grid overlay' },
            { key: 'showScanlines', label: 'Scanlines',       desc: 'CRT scanline effect' },
          ].map(({ key, label, desc }) => (
            <div key={key} className="flex items-center justify-between">
              <div>
                <div className="font-mono text-xs text-white/60">{label}</div>
                <div className="font-mono text-[9px] text-white/20">{desc}</div>
              </div>
              <button
                onClick={() => update({ [key]: !settings[key as keyof AppSettings] })}
                className={`
                  w-10 h-5 rounded-full border transition-all duration-200 relative
                  ${settings[key as keyof AppSettings]
                    ? 'bg-[#00ff8840] border-[#00ff88]'
                    : 'bg-white/5 border-white/15'
                  }
                `}
              >
                <motion.div
                  className="absolute top-0.5 w-4 h-4 rounded-full"
                  style={{
                    background: settings[key as keyof AppSettings] ? '#00ff88' : '#ffffff30',
                  }}
                  animate={{ x: settings[key as keyof AppSettings] ? 20 : 2 }}
                  transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                />
              </button>
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="mt-6 pt-4 border-t border-white/5 text-center font-mono text-[9px] text-white/20">
          FartArena v1.0.0 — May the smelliest agent win 💨
        </div>
      </motion.div>
    </motion.div>
  )
}
