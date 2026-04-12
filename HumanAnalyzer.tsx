'use client'

// HumanAnalyzer.tsx
// Anal-yzer™ — browser mic recording + real-time waveform + odor result display
// Drop this into your page.tsx alongside FartArena3D

import { useState, useRef, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Mic, MicOff, Upload, Zap, Wind } from 'lucide-react'

interface OdorCompound {
  ppm: number
  name: string
  formula: string
  color_hex: string
  descriptor: string
}

interface AnalysisResult {
  source: string
  archetype: string
  stink_score: number
  summary: string
  sound_profile: {
    duration_seconds: number
    spectral_centroid_hz: number
    peak_energy_rms: number
    zero_crossing_rate: number
    wetness_score: number
    avg_pitch_hz?: number
  }
  odor_profile: Record<string, OdorCompound>
  leaderboard_eligible: boolean
}

interface Props {
  walletTier: 0 | 1 | 2 | 3
  onResult?: (result: AnalysisResult) => void
}

const STINK_MULTIPLIERS = [1.0, 1.5, 2.0, 3.0]
const ARCHETYPE_EMOJI: Record<string, string> = {
  'Silent But Deadly':    '☠️',
  'Bass Cannon':          '💣',
  'Squeaky Sulfur Dart':  '💛',
  'Wet Chaos':            '🌊',
  'Micro-Rip':            '⚡',
  'Classic Trombone Toot':'🎺',
}

export default function HumanAnalyzer({ walletTier, onResult }: Props) {
  const [mode, setMode]           = useState<'idle' | 'recording' | 'uploading' | 'analyzing' | 'result'>('idle')
  const [result, setResult]       = useState<AnalysisResult | null>(null)
  const [error, setError]         = useState<string | null>(null)
  const [waveData, setWaveData]   = useState<number[]>(new Array(64).fill(0))
  const [recordSecs, setRecordSecs] = useState(0)

  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const chunksRef        = useRef<Blob[]>([])
  const analyserRef      = useRef<AnalyserNode | null>(null)
  const animFrameRef     = useRef<number>(0)
  const timerRef         = useRef<ReturnType<typeof setInterval> | null>(null)
  const fileInputRef     = useRef<HTMLInputElement | null>(null)

  // ── Waveform animation ────────────────────────────────────────────────
  const drawWave = useCallback(() => {
    if (!analyserRef.current) return
    const data = new Uint8Array(analyserRef.current.frequencyBinCount)
    analyserRef.current.getByteFrequencyData(data)
    const step = Math.floor(data.length / 64)
    setWaveData(Array.from({ length: 64 }, (_, i) => data[i * step] / 255))
    animFrameRef.current = requestAnimationFrame(drawWave)
  }, [])

  // ── Start recording ───────────────────────────────────────────────────
  const startRecording = async () => {
    setError(null)
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false })

      // Set up Web Audio analyser for waveform
      const ctx      = new AudioContext()
      const source   = ctx.createMediaStreamSource(stream)
      const analyser = ctx.createAnalyser()
      analyser.fftSize = 128
      source.connect(analyser)
      analyserRef.current = analyser

      const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
        ? 'audio/webm;codecs=opus'
        : 'audio/webm'

      const recorder = new MediaRecorder(stream, { mimeType })
      mediaRecorderRef.current = recorder
      chunksRef.current = []

      recorder.ondataavailable = e => { if (e.data.size > 0) chunksRef.current.push(e.data) }
      recorder.onstop = () => {
        stream.getTracks().forEach(t => t.stop())
        cancelAnimationFrame(animFrameRef.current)
        const blob = new Blob(chunksRef.current, { type: mimeType })
        submitAudio(blob)
      }

      recorder.start(100)
      setMode('recording')
      setRecordSecs(0)
      timerRef.current = setInterval(() => setRecordSecs(s => s + 1), 1000)
      drawWave()
    } catch (err) {
      setError('Mic access denied. Allow microphone access to anal-yze your emissions.')
    }
  }

  // ── Stop recording ────────────────────────────────────────────────────
  const stopRecording = () => {
    if (timerRef.current) clearInterval(timerRef.current)
    cancelAnimationFrame(animFrameRef.current)
    mediaRecorderRef.current?.stop()
    setMode('analyzing')
  }

  // ── File upload ───────────────────────────────────────────────────────
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setMode('analyzing')
    submitAudio(file)
  }

  // ── Submit audio to API ───────────────────────────────────────────────
  const submitAudio = async (audioBlob: Blob | File) => {
    setMode('analyzing')
    setError(null)
    try {
      const form = new FormData()
      form.append('audio', audioBlob, 'recording.webm')
      form.append('intensity_boost', String(walletTier)) // tier = spice level

      const res = await fetch('/api/analyze', { method: 'POST', body: form })
      if (!res.ok) throw new Error(`Server error ${res.status}`)
      const data: AnalysisResult = await res.json()

      // Apply wallet tier stink multiplier to display score
      const multiplier = STINK_MULTIPLIERS[walletTier]
      data.stink_score = Math.min(10, Math.round(data.stink_score * multiplier * 10) / 10)

      setResult(data)
      setMode('result')
      onResult?.(data)
    } catch (err) {
      setError('Analysis failed. Make sure your backend is running.')
      setMode('idle')
    }
  }

  const reset = () => { setMode('idle'); setResult(null); setError(null); setWaveData(new Array(64).fill(0)) }

  useEffect(() => () => {
    if (timerRef.current) clearInterval(timerRef.current)
    cancelAnimationFrame(animFrameRef.current)
  }, [])

  return (
    <div className="w-full max-w-2xl mx-auto">
      <div className="holo-card p-6 rounded-2xl border border-[#00ff8820]">

        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <div className="text-2xl">💨</div>
          <div>
            <h2 className="font-display font-black text-lg neon-green tracking-wider">HUMAN ANAL-YZER™</h2>
            <p className="font-mono text-[10px] text-white/30 tracking-widest">RECORD YOUR EMISSIONS. GET SCIENCE.</p>
          </div>
          {walletTier > 0 && (
            <span className="ml-auto font-mono text-[10px] text-[#ff00ff] border border-[#ff00ff40] px-2 py-1 rounded">
              {STINK_MULTIPLIERS[walletTier]}× MULTIPLIER
            </span>
          )}
        </div>

        {/* Idle state */}
        <AnimatePresence mode="wait">
          {mode === 'idle' && (
            <motion.div key="idle" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="flex flex-col items-center gap-4">
              <p className="font-mono text-xs text-white/40 text-center max-w-sm">
                Record live via mic or upload a WAV/MP3. Real acoustic analysis → odor fingerprint → leaderboard.
              </p>
              <div className="flex gap-3">
                <button onClick={startRecording}
                  className="flex items-center gap-2 px-6 py-3 rounded-xl bg-[#00ff8815] border border-[#00ff8840] text-[#00ff88] font-mono font-bold text-sm hover:bg-[#00ff8825] transition-all">
                  <Mic size={16} /> RECORD
                </button>
                <button onClick={() => fileInputRef.current?.click()}
                  className="flex items-center gap-2 px-6 py-3 rounded-xl bg-white/5 border border-white/10 text-white/60 font-mono font-bold text-sm hover:bg-white/10 transition-all">
                  <Upload size={16} /> UPLOAD
                </button>
              </div>
              <p className="font-mono text-[9px] text-white/20">Shake phone to start recording on mobile (add ShakeToFart integration)</p>
              <input ref={fileInputRef} type="file" accept="audio/*" className="hidden" onChange={handleFileUpload} />
            </motion.div>
          )}

          {/* Recording state */}
          {mode === 'recording' && (
            <motion.div key="recording" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="flex flex-col items-center gap-4">
              {/* Live waveform */}
              <div className="w-full h-16 flex items-end gap-[2px]">
                {waveData.map((v, i) => (
                  <motion.div key={i} className="flex-1 rounded-t bg-[#00ff88]"
                    style={{ height: `${Math.max(4, v * 100)}%`, opacity: 0.4 + v * 0.6 }}
                    animate={{ height: `${Math.max(4, v * 100)}%` }}
                    transition={{ duration: 0.05 }} />
                ))}
              </div>
              <div className="flex items-center gap-3">
                <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                <span className="font-mono text-sm text-white/60">REC {recordSecs}s</span>
              </div>
              <button onClick={stopRecording}
                className="flex items-center gap-2 px-8 py-3 rounded-xl bg-red-500/20 border border-red-500/40 text-red-400 font-mono font-bold text-sm hover:bg-red-500/30 transition-all">
                <MicOff size={16} /> STOP & ANAL-YZE
              </button>
            </motion.div>
          )}

          {/* Analyzing */}
          {mode === 'analyzing' && (
            <motion.div key="analyzing" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="flex flex-col items-center gap-4 py-6">
              <motion.div animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}>
                <Wind size={32} className="text-[#00ff88]" />
              </motion.div>
              <p className="font-mono text-sm text-white/50">Running spectral analysis...</p>
              <p className="font-mono text-[10px] text-white/20">Computing MFCC · sulfur mapping · stink_score</p>
            </motion.div>
          )}

          {/* Result */}
          {mode === 'result' && result && (
            <motion.div key="result" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
              className="flex flex-col gap-4">

              {/* Score + archetype */}
              <div className="flex items-center justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-2xl">{ARCHETYPE_EMOJI[result.archetype] ?? '💨'}</span>
                    <span className="font-display font-black text-base text-white">{result.archetype}</span>
                  </div>
                  <p className="font-mono text-[10px] text-white/30 mt-1 max-w-xs">{result.summary.split('—')[1]?.trim()}</p>
                </div>
                {/* Stink score dial */}
                <div className="flex flex-col items-center">
                  <div className="relative w-16 h-16 flex items-center justify-center rounded-full border-2 border-[#00ff8840]"
                    style={{ background: `conic-gradient(#00ff88 ${result.stink_score * 36}deg, transparent 0deg)` }}>
                    <div className="absolute inset-1 rounded-full bg-[#0a0a12] flex items-center justify-center">
                      <span className="font-display font-black text-lg neon-green">{result.stink_score}</span>
                    </div>
                  </div>
                  <span className="font-mono text-[9px] text-white/30 mt-1">STINK SCORE</span>
                </div>
              </div>

              {/* Sound stats */}
              <div className="grid grid-cols-3 gap-2">
                {[
                  { label: 'DURATION',  value: `${result.sound_profile.duration_seconds.toFixed(1)}s` },
                  { label: 'CENTROID',  value: `${Math.round(result.sound_profile.spectral_centroid_hz)}Hz` },
                  { label: 'ENERGY',    value: result.sound_profile.peak_energy_rms.toFixed(3) },
                  { label: 'ZCR',       value: result.sound_profile.zero_crossing_rate?.toFixed(3) ?? '—' },
                  { label: 'WETNESS',   value: result.sound_profile.wetness_score?.toFixed(2) ?? '—' },
                  { label: 'PITCH',     value: result.sound_profile.avg_pitch_hz ? `${Math.round(result.sound_profile.avg_pitch_hz)}Hz` : '—' },
                ].map(s => (
                  <div key={s.label} className="bg-white/5 rounded-lg p-2 text-center">
                    <div className="font-mono text-[8px] text-white/30">{s.label}</div>
                    <div className="font-mono text-xs text-white font-bold">{s.value}</div>
                  </div>
                ))}
              </div>

              {/* Odor compounds */}
              <div className="space-y-1">
                <div className="font-mono text-[9px] text-white/30 uppercase tracking-widest mb-2">Odor Fingerprint</div>
                {Object.entries(result.odor_profile)
                  .filter(([, v]) => v.ppm > 0.001)
                  .sort(([, a], [, b]) => b.ppm - a.ppm)
                  .slice(0, 5)
                  .map(([key, compound]) => (
                    <div key={key} className="flex items-center gap-2">
                      <span className="font-mono text-[10px] w-20 text-white/40">{compound.formula}</span>
                      <div className="flex-1 bg-white/5 rounded-full h-1.5 overflow-hidden">
                        <motion.div className="h-full rounded-full"
                          style={{ backgroundColor: compound.color_hex }}
                          initial={{ width: 0 }}
                          animate={{ width: `${Math.min(100, (compound.ppm / 12) * 100)}%` }}
                          transition={{ duration: 0.8, delay: 0.1 }} />
                      </div>
                      <span className="font-mono text-[9px] text-white/30 w-16 text-right">{compound.ppm.toFixed(3)} ppm</span>
                    </div>
                  ))}
              </div>

              {/* Actions */}
              <div className="flex gap-2 pt-2">
                <button onClick={reset}
                  className="flex-1 py-2 rounded-lg font-mono text-xs text-white/40 border border-white/10 hover:bg-white/5 transition-colors">
                  NEW EMISSION
                </button>
                <button
                  className="flex-1 py-2 rounded-lg font-mono text-xs text-[#00ff88] border border-[#00ff8840] bg-[#00ff8810] hover:bg-[#00ff8820] transition-colors flex items-center justify-center gap-1">
                  <Zap size={12} /> SUBMIT TO LEADERBOARD
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Error */}
        {error && (
          <div className="mt-3 p-3 rounded-lg bg-red-500/10 border border-red-500/20 font-mono text-xs text-red-400">
            {error}
          </div>
        )}
      </div>
    </div>
  )
}
