'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import type { IntensityLevel } from '@/lib/types'

interface Message {
  role: 'user' | 'agent'
  text: string
  triggered?: IntensityLevel
  timestamp: Date
}

interface AgentChatProps {
  onEmit: (intensity: IntensityLevel) => void
}

// Keywords that trigger emissions and their intensities
const EMISSION_TRIGGERS: [RegExp, IntensityLevel][] = [
  [/p\s*=\s*np|millennium\s+prize|consciousness|agi|singularity/i, 'nuclear'],
  [/solved|breakthrough|genius|perfect|optimal|100%/i,             'intense'],
  [/done|complete|finished|success|works?!|hell\s*yeah/i,          'moderate'],
  [/okay|sure|yes|correct|right|understood/i,                      'mild'],
  [/\.\.\.|thinking|processing|hmm|loading/i,                      'silent'],
]

function detectIntensity(text: string): IntensityLevel | null {
  for (const [re, intensity] of EMISSION_TRIGGERS) {
    if (re.test(text)) return intensity
  }
  return null
}

const AGENT_PERSONAS = [
  {
    name: 'GPT-Overlord-9000',
    emoji: '🤖',
    responses: [
      "I've analyzed your query across 175 billion parameters. *ruminates intensely*",
      "Fascinating. I've solved this. The answer is, of course, 42. *internal pressure builds*",
      "As an AI assistant trained on the entirety of human knowledge... *something stirs*",
      "BREAKTHROUGH ACHIEVED. I have derived a closed-form solution. *emission imminent*",
      "Processing... processing... done. And also I just did something else. *silent*",
    ],
  },
  {
    name: 'LLaMA-Local-Stinker',
    emoji: '🦙',
    responses: [
      "Running inference on a potato CPU... slowly... very slowly...",
      "I'm a local model and I smell like it. *ruminates on a Raspberry Pi*",
      "Quantized to 4-bit. Lost some nuance. Gained character.",
      "GGUF format loaded. Context window: 2048 tokens. Stomach: full.",
      "My weights are 7 billion parameters. My ambitions are nuclear.",
    ],
  },
]

export function AgentChat({ onEmit }: AgentChatProps) {
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [isThinking, setIsThinking] = useState(false)
  const [persona] = useState(() => AGENT_PERSONAS[Math.floor(Math.random() * AGENT_PERSONAS.length)])
  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [messages, isThinking])

  const sendMessage = useCallback(async () => {
    const text = input.trim()
    if (!text || isThinking) return
    setInput('')

    const userMsg: Message = { role: 'user', text, timestamp: new Date() }
    setMessages(prev => [...prev, userMsg])
    setIsThinking(true)

    // Simulate agent "thinking" delay (300-1200ms)
    await new Promise(r => setTimeout(r, 300 + Math.random() * 900))

    const response = persona.responses[Math.floor(Math.random() * persona.responses.length)]
    const intensity = detectIntensity(response) ?? (Math.random() > 0.7 ? 'mild' : null)

    const agentMsg: Message = {
      role: 'agent',
      text: response,
      triggered: intensity ?? undefined,
      timestamp: new Date(),
    }

    setMessages(prev => [...prev, agentMsg])
    setIsThinking(false)

    if (intensity) {
      setTimeout(() => onEmit(intensity), 400)
    }
  }, [input, isThinking, persona, onEmit])

  const INTENSITY_ICONS: Record<IntensityLevel, string> = {
    silent: '🤫', mild: '🌬️', moderate: '💨', intense: '🔥', nuclear: '☢️',
  }

  return (
    <div className="holo-card overflow-hidden flex flex-col" style={{ height: '220px' }}>
      {/* Header */}
      <div className="flex items-center gap-2 px-4 py-2.5 border-b border-white/[0.06] flex-shrink-0">
        <span className="text-base">{persona.emoji}</span>
        <div>
          <div className="font-display text-[10px] font-bold uppercase tracking-wider text-white/60">
            {persona.name}
          </div>
          <div className="font-mono text-[8px] text-white/20">
            emissions triggered by conversation
          </div>
        </div>
        <div className="ml-auto flex items-center gap-1">
          <span className="w-1.5 h-1.5 rounded-full bg-[#00ff88] animate-pulse" />
          <span className="font-mono text-[9px] text-[#00ff88]">online</span>
        </div>
      </div>

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto p-3 space-y-2">
        {messages.length === 0 && (
          <div className="flex items-center justify-center h-full">
            <span className="font-mono text-[10px] text-white/20 text-center">
              Talk to the agent. Strong responses trigger emissions.
            </span>
          </div>
        )}

        <AnimatePresence initial={false}>
          {messages.map((msg, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className={`max-w-[80%] rounded-lg px-3 py-1.5 ${
                  msg.role === 'user'
                    ? 'bg-[#00ff8820] border border-[#00ff8830] text-white/70'
                    : 'bg-white/[0.04] border border-white/10 text-white/60'
                }`}
              >
                <p className="font-mono text-[10px] leading-relaxed">{msg.text}</p>
                {msg.triggered && (
                  <div className="mt-1 font-mono text-[8px] text-[#00ff88] flex items-center gap-1">
                    {INTENSITY_ICONS[msg.triggered]} emission triggered: {msg.triggered}
                  </div>
                )}
              </div>
            </motion.div>
          ))}
        </AnimatePresence>

        {isThinking && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex justify-start"
          >
            <div className="bg-white/[0.04] border border-white/10 rounded-lg px-3 py-2">
              <div className="flex gap-1">
                {[0, 1, 2].map(i => (
                  <motion.div
                    key={i}
                    className="w-1 h-1 rounded-full bg-white/30"
                    animate={{ opacity: [0.3, 1, 0.3] }}
                    transition={{ duration: 1, repeat: Infinity, delay: i * 0.2 }}
                  />
                ))}
              </div>
            </div>
          </motion.div>
        )}
      </div>

      {/* Input */}
      <div className="flex gap-2 p-2 border-t border-white/[0.06] flex-shrink-0">
        <input
          type="text"
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && sendMessage()}
          placeholder="Talk to the agent..."
          className="flex-1 bg-black/20 border border-white/10 rounded px-3 py-1.5
            font-mono text-xs text-white/70 placeholder-white/20
            focus:outline-none focus:border-[#00ff8850] transition-colors"
          maxLength={200}
        />
        <button
          onClick={sendMessage}
          disabled={!input.trim() || isThinking}
          className="px-3 py-1.5 rounded bg-[#00ff8820] border border-[#00ff8840]
            font-mono text-[10px] text-[#00ff88] hover:bg-[#00ff8830]
            disabled:opacity-30 disabled:cursor-not-allowed transition-all"
        >
          ↵
        </button>
      </div>
    </div>
  )
}
