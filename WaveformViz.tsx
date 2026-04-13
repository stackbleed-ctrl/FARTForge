'use client'

import { useRef, useEffect, useCallback } from 'react'
import type { EmitResult } from '@/lib/types'

interface WaveformVizProps {
  emitResult: EmitResult | null
  isActive: boolean
}

const COLORS = {
  low:   '#00ff88',
  mid:   '#facc15',
  high:  '#f97316',
  nuke:  '#ff2244',
}

function stinkColor(score: number) {
  if (score >= 9) return COLORS.nuke
  if (score >= 7) return COLORS.high
  if (score >= 4) return COLORS.mid
  return COLORS.low
}

export function WaveformViz({ emitResult, isActive }: WaveformVizProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const animRef = useRef<number>(0)
  const phaseRef = useRef(0)

  const score = emitResult?.stink_score ?? 0
  const fingerprint = emitResult?.fingerprint
  const rumble = fingerprint?.rumble_score ?? 0.3
  const sharpness = fingerprint?.sharpness_score ?? 0.3
  const wetness = fingerprint?.wetness_score ?? 0.2
  const mfccs = fingerprint?.mfcc_mean ?? []

  const draw = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const W = canvas.width
    const H = canvas.height
    const cx = H / 2

    ctx.clearRect(0, 0, W, H)

    // Background gradient
    const bg = ctx.createLinearGradient(0, 0, W, 0)
    bg.addColorStop(0, 'rgba(0,255,136,0.03)')
    bg.addColorStop(0.5, 'rgba(0,0,0,0)')
    bg.addColorStop(1, 'rgba(139,0,255,0.03)')
    ctx.fillStyle = bg
    ctx.fillRect(0, 0, W, H)

    // Center line
    ctx.strokeStyle = 'rgba(255,255,255,0.06)'
    ctx.lineWidth = 1
    ctx.beginPath()
    ctx.moveTo(0, cx)
    ctx.lineTo(W, cx)
    ctx.stroke()

    const color = stinkColor(score)
    const phase = phaseRef.current

    // Build waveform from fingerprint data
    const bars = 64
    const barW = W / bars

    for (let i = 0; i < bars; i++) {
      const t = i / bars
      const mfccIdx = Math.floor(t * mfccs.length)
      const mfccVal = mfccs[mfccIdx] ?? 0
      const normalizedMfcc = Math.abs(mfccVal) / 40

      // Composite wave: rumble (low freq) + sharpness (high freq) + wetness (noise)
      const lowFreq = Math.sin(t * Math.PI * 4 + phase * 0.5) * rumble
      const highFreq = Math.sin(t * Math.PI * 16 + phase * 3) * sharpness * 0.5
      const noise = (Math.random() - 0.5) * wetness * 0.3
      const mfccContrib = Math.sin(t * Math.PI * 8 + phase) * normalizedMfcc * 0.4

      const amplitude = isActive
        ? (lowFreq + highFreq + noise + mfccContrib) * (cx * 0.7) * (0.3 + score / 10)
        : Math.sin(t * Math.PI * 2 + phase * 0.2) * cx * 0.08

      const barH = Math.abs(amplitude)
      const y = cx - barH

      // Gradient fill for each bar
      const grad = ctx.createLinearGradient(0, y, 0, cx + barH)
      grad.addColorStop(0, color + 'cc')
      grad.addColorStop(0.5, color + '88')
      grad.addColorStop(1, color + '22')

      ctx.fillStyle = grad
      ctx.fillRect(i * barW + 1, y, barW - 2, barH * 2)

      // Top glow dot
      ctx.fillStyle = color
      ctx.beginPath()
      ctx.arc(i * barW + barW / 2, y, 1, 0, Math.PI * 2)
      ctx.fill()
    }

    // MFCC label overlay
    if (fingerprint && mfccs.length > 0) {
      ctx.font = '9px Share Tech Mono, monospace'
      ctx.fillStyle = 'rgba(255,255,255,0.15)'
      ctx.fillText(`centroid: ${fingerprint.spectral_centroid.toFixed(0)}Hz  zcr: ${fingerprint.zero_crossing_rate.toFixed(3)}  dur: ${fingerprint.duration_ms}ms`, 8, H - 6)
    }

    phaseRef.current += isActive ? 0.12 : 0.015
    animRef.current = requestAnimationFrame(draw)
  }, [isActive, score, rumble, sharpness, wetness, mfccs, fingerprint])

  useEffect(() => {
    animRef.current = requestAnimationFrame(draw)
    return () => cancelAnimationFrame(animRef.current)
  }, [draw])

  // Resize observer
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ro = new ResizeObserver(() => {
      canvas.width = canvas.offsetWidth * window.devicePixelRatio
      canvas.height = canvas.offsetHeight * window.devicePixelRatio
      canvas.style.width = `${canvas.offsetWidth}px`
      canvas.style.height = `${canvas.offsetHeight}px`
    })
    ro.observe(canvas)
    return () => ro.disconnect()
  }, [])

  return (
    <div className="relative w-full h-full flex flex-col">
      <div className="flex items-center justify-between mb-1 px-1">
        <span className="font-display text-[9px] uppercase tracking-widest text-white/30">
          Frequency Fingerprint
        </span>
        {isActive && (
          <span className="flex items-center gap-1 font-mono text-[9px] text-[#00ff88]">
            <span className="w-1.5 h-1.5 rounded-full bg-[#00ff88] animate-pulse" />
            LIVE
          </span>
        )}
      </div>
      <canvas
        ref={canvasRef}
        className="w-full flex-1 rounded"
        style={{ imageRendering: 'pixelated' }}
      />
    </div>
  )
}
