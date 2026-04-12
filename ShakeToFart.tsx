'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'

interface Props {
  onShake: (intensity: string) => void
  walletTier: 0 | 1 | 2 | 3
  isShaking: boolean
  onShakingChange: (v: boolean) => void
}

const TIER_COOLDOWNS = [3000, 2000, 1000, 500]     // ms
const TIER_MULTIPLIERS = ['1×', '1.5×', '2×', '3×']
const TIER_NAMES = ['', 'Stinker', 'Indole Overlord', 'NUCLEAR ENTITY']

const SHAKE_THRESHOLD = 20  // m/s² — adjust for sensitivity
const SHAKE_NUCLEAR_THRESHOLD = 40

export function ShakeToFart({ onShake, walletTier, isShaking, onShakingChange }: Props) {
  const [permissionState, setPermissionState] = useState<'unknown' | 'granted' | 'denied' | 'unsupported'>('unknown')
  const [shakeForce, setShakeForce] = useState(0)
  const [cooldown, setCooldown] = useState(false)
  const [lastShakeTime, setLastShakeTime] = useState(0)
  const lastAcc = useRef({ x: 0, y: 0, z: 0 })

  const cooldownMs = TIER_COOLDOWNS[walletTier]

  const handleMotion = useCallback((event: DeviceMotionEvent) => {
    const acc = event.accelerationIncludingGravity
    if (!acc) return

    const x = acc.x ?? 0
    const y = acc.y ?? 0
    const z = acc.z ?? 0

    const delta = Math.sqrt(
      Math.pow(x - lastAcc.current.x, 2) +
      Math.pow(y - lastAcc.current.y, 2) +
      Math.pow(z - lastAcc.current.z, 2)
    )

    lastAcc.current = { x, y, z }

    if (delta > SHAKE_THRESHOLD) {
      setShakeForce(Math.min(100, (delta / SHAKE_NUCLEAR_THRESHOLD) * 100))
      onShakingChange(true)

      const now = Date.now()
      if (!cooldown && now - lastShakeTime > cooldownMs) {
        const intensity = delta > SHAKE_NUCLEAR_THRESHOLD ? 'nuclear' : 'intense'
        onShake(intensity)
        setLastShakeTime(now)
        setCooldown(true)
        setTimeout(() => {
          setCooldown(false)
          onShakingChange(false)
          setShakeForce(0)
        }, cooldownMs)
      }
    } else {
      if (!cooldown) {
        setShakeForce(prev => Math.max(0, prev - 5))
        if (shakeForce <= 5) onShakingChange(false)
      }
    }
  }, [cooldown, lastShakeTime, cooldownMs, onShake, onShakingChange, shakeForce])

  const requestPermission = useCallback(async () => {
    // iOS 13+ requires explicit permission
    if (typeof DeviceMotionEvent !== 'undefined' &&
        typeof (DeviceMotionEvent as any).requestPermission === 'function') {
      try {
        const result = await (DeviceMotionEvent as any).requestPermission()
        if (result === 'granted') {
          setPermissionState('granted')
          window.addEventListener('devicemotion', handleMotion)
        } else {
          setPermissionState('denied')
        }
      } catch {
        setPermissionState('denied')
      }
    } else if (typeof DeviceMotionEvent !== 'undefined') {
      // Android / non-iOS — permission not required
      setPermissionState('granted')
      window.addEventListener('devicemotion', handleMotion)
    } else {
      setPermissionState('unsupported')
    }
  }, [handleMotion])

  useEffect(() => {
    // Auto-detect if we're on mobile and try to set up without prompt
    const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent)
    if (!isMobile) {
      setPermissionState('unsupported')
      return
    }

    // Android doesn't need permission
    if (typeof (DeviceMotionEvent as any).requestPermission !== 'function') {
      setPermissionState('granted')
      window.addEventListener('devicemotion', handleMotion)
    }

    return () => window.removeEventListener('devicemotion', handleMotion)
  }, [handleMotion])

  if (permissionState === 'unsupported') {
    return null  // Desktop: don't show this component
  }

  return (
    <div className="holo-card p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-display text-xs font-bold tracking-widest text-white/50 uppercase">
          📱 Shake-to-Fart
        </h3>
        {walletTier > 0 && (
          <span className="text-[10px] font-mono text-[#ff00ff] bg-[#ff00ff15] px-2 py-0.5 rounded border border-[#ff00ff30]">
            {TIER_NAMES[walletTier]}
          </span>
        )}
      </div>

      {permissionState === 'unknown' && (
        <div className="text-center py-2">
          <motion.button
            className="btn-rip text-sm py-2 px-6"
            onClick={requestPermission}
            whileTap={{ scale: 0.95 }}
          >
            📱 ENABLE SHAKE
          </motion.button>
          <p className="text-[10px] font-mono text-white/30 mt-2">
            Requires motion sensor access
          </p>
        </div>
      )}

      {permissionState === 'denied' && (
        <div className="text-center py-2">
          <div className="text-[10px] font-mono text-red-400">
            Motion access denied. Enable in device settings.
          </div>
        </div>
      )}

      {permissionState === 'granted' && (
        <div className="space-y-3">
          {/* Shake prompt */}
          <AnimatePresence>
            {!isShaking && !cooldown && (
              <motion.div
                className="text-center"
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
              >
                <div className="font-display text-[11px] font-bold text-[#00ff88] tracking-wider uppercase">
                  SHAKE FOR NUCLEAR RIP 📱💨
                </div>
                <div className="text-[10px] font-mono text-white/30 mt-1">
                  {TIER_MULTIPLIERS[walletTier]} multiplier • {cooldownMs / 1000}s cooldown
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Shake force meter */}
          <div className="space-y-1">
            <div className="flex justify-between">
              <span className="font-mono text-[10px] text-white/30">Shake Force</span>
              <span className="font-mono text-[10px] text-[#00ff88]">{Math.round(shakeForce)}%</span>
            </div>
            <div className="h-2 bg-white/5 rounded-full overflow-hidden">
              <motion.div
                className="h-full rounded-full"
                style={{
                  background: shakeForce > 70
                    ? 'linear-gradient(90deg, #ff0044, #ff8800)'
                    : 'linear-gradient(90deg, #00ff88, #ffd700)',
                }}
                animate={{ width: `${shakeForce}%` }}
                transition={{ duration: 0.1 }}
              />
            </div>
          </div>

          {/* Cooldown indicator */}
          {cooldown && (
            <motion.div
              className="text-center font-mono text-[11px] text-white/40"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
            >
              ⏱ COOLDOWN... ({cooldownMs / 1000}s)
            </motion.div>
          )}

          {/* Shaking animation */}
          {isShaking && !cooldown && (
            <motion.div
              className="text-center font-display text-sm font-bold neon-green"
              animate={{ scale: [1, 1.1, 1] }}
              transition={{ repeat: Infinity, duration: 0.2 }}
            >
              💨 RIPPING! 💨
            </motion.div>
          )}
        </div>
      )}
    </div>
  )
}
