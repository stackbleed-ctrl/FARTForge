'use client'

import { useEffect, useRef, useMemo } from 'react'
import { motion } from 'framer-motion'
import type { EmitResult } from '@/lib/types'

interface Props {
  emitResult: EmitResult | null
  isActive: boolean
}

const COMPOUND_FREQ_LABELS: { hz: number; label: string; color: string }[] = [
  { hz: 80,   label: 'Sphincter Fund.',  color: '#ffd700' },
  { hz: 250,  label: 'H₂S',             color: '#ffd700' },
  { hz: 600,  label: 'CH₃SH',           color: '#90EE90' },
  { hz: 1200, label: 'DMS',             color: '#87CEEB' },
  { hz: 3000, label: 'Indole',          color: '#9B59B6' },
  { hz: 6000, label: 'Skatole',         color: '#8B4513' },
]

export function WaveformViz({ emitResult, isActive }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const animRef = useRef<number>(0)
  const phaseRef = useRef(0)
  const intensityRef = useRef(0)

  // Generate waveform from fingerprint data
  const mfccs = useMemo(() => emitResult?.fingerprint?.mfcc_mean ?? [], [emitResult])
  const centroid = emitResult?.fingerprint?.spectral_centroid ?? 800
  const zcr = emitResult?.fingerprint?.zero_crossing_rate ?? 0.05
  const stinkScore = emitResult?.stink_score ?? 0

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')!

    const draw = () => {
      const W = canvas.width
      const H = canvas.height

      // Clear
      ctx.clearRect(0, 0, W, H)

      // Background
      ctx.fillStyle = 'rgba(3,3,8,0)'
      ctx.fillRect(0, 0, W, H)

      const phase = phaseRef.current
      const intensity = intensityRef.current

      if (!emitResult && !isActive) {
        // Idle flatline with gentle breathing
        ctx.beginPath()
        ctx.strokeStyle = 'rgba(0,255,136,0.15)'
        ctx.lineWidth = 1
        for (let x = 0; x < W; x++) {
          const y = H / 2 + Math.sin(x * 0.05 + phase * 0.5) * 2
          x === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y)
        }
        ctx.stroke()

        phaseRef.current += 0.02
        animRef.current = requestAnimationFrame(draw)
        return
      }

      // ── Main waveform ────────────────────────────────────────────
      // Synthesize a displayable waveform from fingerprint data
      const nBands = Math.max(mfccs.length, 8)
      const amplitude = isActive ? 0.35 : 0.22

      // Primary waveform (fundamental + harmonics based on MFCCs)
      ctx.beginPath()
      ctx.strokeStyle = `rgba(0,255,136,${isActive ? 0.9 : 0.6})`
      ctx.lineWidth = isActive ? 2 : 1.5
      ctx.shadowBlur = isActive ? 12 : 6
      ctx.shadowColor = '#00ff88'

      for (let x = 0; x < W; x++) {
        const t = x / W
        let y = H / 2

        // Sum of harmonic components weighted by MFCC coefficients
        for (let n = 0; n < Math.min(nBands, 8); n++) {
          const coeff = mfccs[n] ?? 0
          const normCoeff = Math.tanh(coeff / 20) // normalize to -1..1
          const freq = (n + 1) * (1 + zcr * 5)
          const amp = amplitude * (1 / (n + 1)) * Math.abs(normCoeff)
          y += Math.sin(2 * Math.PI * freq * t + phase + n * 0.5) * H * amp
        }

        // Add intensity-driven noise bursts
        if (isActive) {
          y += (Math.random() - 0.5) * H * intensity * 0.05
        }

        x === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y)
      }
      ctx.stroke()
      ctx.shadowBlur = 0

      // ── Frequency bars (mini spectrogram) ────────────────────────
      const barCount = 48
      const barW = (W / barCount) - 1
      const maxBarH = H * 0.6

      for (let i = 0; i < barCount; i++) {
        const t = i / barCount
        // Shape from fingerprint: centroid drives peak position
        const peakPos = Math.min(0.9, centroid / 8000)
        const distFromPeak = Math.abs(t - peakPos)
        const baseH = Math.exp(-distFromPeak * distFromPeak * 12)

        // Add MFCC texture
        const mfccIdx = Math.floor(t * mfccs.length)
        const mfccVal = Math.abs(mfccs[mfccIdx] ?? 0) / 40
        const barH = (baseH * 0.7 + mfccVal * 0.3) * maxBarH

        // Animate
        const animH = barH * (0.6 + Math.sin(phase * 3 + i * 0.4) * 0.4) * (isActive ? 1 : 0.4)

        // Color: green → yellow → magenta as freq increases
        const hue = 150 - t * 270  // 150=green, -120=magenta
        const sat = 80 + stinkScore * 2
        const alpha = 0.5 + (isActive ? 0.4 : 0)

        ctx.fillStyle = `hsla(${hue}, ${sat}%, 60%, ${alpha})`
        ctx.fillRect(
          i * (barW + 1),
          H - animH,
          barW,
          animH
        )

        // Bar glow
        if (isActive && animH > 20) {
          ctx.fillStyle = `hsla(${hue}, ${sat}%, 80%, 0.15)`
          ctx.fillRect(i * (barW + 1), H - animH - 3, barW, 3)
        }
      }

      // ── Compound frequency labels ─────────────────────────────────
      COMPOUND_FREQ_LABELS.forEach(({ hz, label, color }) => {
        const xPos = Math.min(W - 50, (Math.log10(hz) - Math.log10(20)) / (Math.log10(20000) - Math.log10(20)) * W)
        ctx.beginPath()
        ctx.strokeStyle = color + '40'
        ctx.lineWidth = 1
        ctx.setLineDash([2, 4])
        ctx.moveTo(xPos, 0)
        ctx.lineTo(xPos, H - 16)
        ctx.stroke()
        ctx.setLineDash([])

        ctx.fillStyle = color + '80'
        ctx.font = '8px "Share Tech Mono", monospace'
        ctx.fillText(label, xPos + 2, H - 4)
      })

      // Advance phase
      phaseRef.current += isActive ? 0.15 : 0.03
      if (isActive) intensityRef.current = Math.min(1, intensityRef.current + 0.1)
      else intensityRef.current = Math.max(0, intensityRef.current - 0.05)

      animRef.current = requestAnimationFrame(draw)
    }

    animRef.current = requestAnimationFrame(draw)
    return () => cancelAnimationFrame(animRef.current)
  }, [emitResult, isActive, mfccs, centroid, zcr, stinkScore])

  // Resize canvas to container
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const resize = () => {
      canvas.width = canvas.offsetWidth * window.devicePixelRatio
      canvas.height = canvas.offsetHeight * window.devicePixelRatio
      const ctx = canvas.getContext('2d')!
      ctx.scale(window.devicePixelRatio, window.devicePixelRatio)
    }
    resize()
    const observer = new ResizeObserver(resize)
    observer.observe(canvas)
    return () => observer.disconnect()
  }, [])

  return (
    <div className="w-full h-full relative">
      {/* Label */}
      <div className="absolute top-0 left-0 right-0 flex items-center justify-between px-1 z-10">
        <span className="font-mono text-[9px] text-white/25 uppercase tracking-widest">
          Frequency Spectrogram
        </span>
        {isActive && (
          <motion.span
            className="font-mono text-[9px] text-[#ff0044]"
            animate={{ opacity: [1, 0] }}
            transition={{ repeat: Infinity, duration: 0.6 }}
          >
            ● REC
          </motion.span>
        )}
      </div>

      <canvas
        ref={canvasRef}
        className="w-full h-full"
        style={{ imageRendering: 'pixelated' }}
      />
    </div>
  )
}
