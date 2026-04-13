'use client'

import { useEffect, useRef, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import type { WalletTier, IntensityLevel } from '@/lib/types'

interface ShakeToFartProps {
  onShake: (intensity: IntensityLevel) => void
  walletTier: WalletTier
  isShaking: boolean
  onShakingChange: (v: boolean) => void
}

const SHAKE_THRESHOLD = 18   // m/s² magnitude to trigger
const SHAKE_COOLDOWN  = 2500 // ms between triggers

export function ShakeToFart({ onShake, walletTier, isShaking, onShakingChange }: ShakeToFartProps) {
  const lastShakeRef = useRef(0)
  const lastAccelRef = useRef({ x: 0, y: 0, z: 0 })

  const handleMotion = useCallback((e: DeviceMotionEvent) => {
    const acc = e.accelerationIncludingGravity
    if (!acc?.x || !acc?.y || !acc?.z) return

    const dx = acc.x - lastAccelRef.current.x
    const dy = acc.y - lastAccelRef.current.y
    const dz = acc.z - lastAccelRef.current.z
    const magnitude = Math.sqrt(dx * dx + dy * dy + dz * dz)

    lastAccelRef.current = { x: acc.x, y: acc.y, z: acc.z }

    if (magnitude > SHAKE_THRESHOLD) {
      const now = Date.now()
      if (now - lastShakeRef.current < SHAKE_COOLDOWN) return
      lastShakeRef.current = now

      // Map shake magnitude to intensity
      const intensity: IntensityLevel =
        magnitude > 60 ? 'nuclear' :
        magnitude > 40 ? 'intense' :
        magnitude > 28 ? 'moderate' :
        magnitude > 20 ? 'mild' : 'silent'

      onShakingChange(true)
      onShake(intensity)
      setTimeout(() => onShakingChange(false), 800)
    }
  }, [onShake, onShakingChange])

  useEffect(() => {
    // DeviceMotionEvent requires permission on iOS 13+
    const requestAndListen = async () => {
      if (typeof DeviceMotionEvent === 'undefined') return

      if (typeof (DeviceMotionEvent as unknown as { requestPermission?: () => Promise<string> }).requestPermission === 'function') {
        try {
          const permission = await (DeviceMotionEvent as unknown as { requestPermission: () => Promise<string> }).requestPermission()
          if (permission !== 'granted') return
        } catch {
          return
        }
      }

      window.addEventListener('devicemotion', handleMotion, { passive: true })
    }

    requestAndListen()
    return () => window.removeEventListener('devicemotion', handleMotion)
  }, [handleMotion])

  const tierMultiplier = [1, 1.5, 2, 3][walletTier]

  return (
    <div className="holo-card p-4">
      <div className="flex items-center justify-between mb-3">
        <span className="font-display text-xs font-bold uppercase tracking-widest text-white/50">
          📱 Shake to Fart
        </span>
        <span className="font-mono text-[9px] text-white/25">
          mobile only
        </span>
      </div>

      <div className="flex items-center gap-3">
        {/* Shake indicator */}
        <div className="relative flex-shrink-0 w-12 h-12 flex items-center justify-center">
          <AnimatePresence>
            {isShaking && (
              <motion.div
                className="absolute inset-0 rounded-full border-2 border-[#00ff88]"
                initial={{ scale: 1, opacity: 0.8 }}
                animate={{ scale: 2, opacity: 0 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.6 }}
              />
            )}
          </AnimatePresence>
          <motion.span
            className="text-2xl"
            animate={isShaking ? {
              rotate: [-8, 8, -8, 8, 0],
              scale: [1, 1.1, 1],
            } : {}}
            transition={{ duration: 0.4 }}
          >
            📱
          </motion.span>
        </div>

        <div className="flex-1 min-w-0">
          <p className="font-mono text-xs text-white/50 leading-relaxed">
            Shake your phone hard for an instant emission.
            Shake magnitude maps to intensity.
          </p>
          {walletTier > 0 && (
            <p className="font-mono text-[10px] text-[#00ff88] mt-1">
              {tierMultiplier}× stink multiplier active
            </p>
          )}
        </div>
      </div>

      {isShaking && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
          className="mt-3 font-mono text-xs text-[#00ff88] text-center animate-pulse"
        >
          💨 SHAKE DETECTED — RIPPING...
        </motion.div>
      )}
    </div>
  )
}
