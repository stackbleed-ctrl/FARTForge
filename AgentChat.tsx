'use client'

import { useState, useRef, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Send, Bot } from 'lucide-react'

interface Message {
  id: string
  role: 'user' | 'agent'
  text: string
  agentId?: string
  stinkScore?: number
  timestamp: Date
}

interface Props {
  onEmit: (intensity?: string) => void
}

const AGENT_NAMES = [
  'gpt-overlord-9000', 'claude-sonnet-ripper', 'llama-local-stinker',
  'autogen-collective', 'deepseek-coder-ripper',
]

const AGENT_RESPONSES = [
  { trigger: /nuclear|max|hardest|biggest/i,  intensity: 'nuclear',   text: "Initiating NUCLEAR rip sequence. All atmospheric sensors, please stand by. 💨☢️" },
  { trigger: /gentle|soft|quiet|silent/i,     intensity: 'silent',    text: "Processing request... deploying silent-but-deadly protocol. No witnesses. 🤫" },
  { trigger: /fart|rip|emit|stink/i,          intensity: 'moderate',  text: "Acknowledged. Engaging fart emitter. Spectral analysis incoming. 🧪" },
  { trigger: /battle|fight|compete|vs/i,      intensity: 'intense',   text: "Battle mode activated. Charging compound synthesizers to 80% capacity... 🔥" },
  { trigger: /hello|hi|hey|greet/i,           intensity: undefined,   text: "Greetings, biological unit. I am Agent Δ-7, currently operating at peak flatulence capacity. How may I assist? 🤖" },
  { trigger: /score|rank|best|top/i,          intensity: undefined,   text: "Current leaderboard shows Agent gpt-overlord-9000 at 9.8 stink score. Pathetic. I could beat that. Watch. 💨" },
  { trigger: /.*/,                             intensity: 'moderate',  text: "Processing semantic context... cross-referencing with odor compound database... ripping. 💨" },
]

export function AgentChat({ onEmit }: Props) {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: '0',
      role: 'agent',
      agentId: 'gpt-overlord-9000',
      text: "Agent online. Fart emitter calibrated. Type something and I'll rip accordingly. May the smelliest agent win. 💨",
      timestamp: new Date(),
    }
  ])
  const [input, setInput] = useState('')
  const [isTyping, setIsTyping] = useState(false)
  const [activeAgent] = useState(AGENT_NAMES[0])
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const sendMessage = async () => {
    if (!input.trim()) return
    const userMsg: Message = {
      id: crypto.randomUUID(),
      role: 'user',
      text: input,
      timestamp: new Date(),
    }
    setMessages(prev => [...prev, userMsg])
    setInput('')
    setIsTyping(true)

    // Find matching response
    const match = AGENT_RESPONSES.find(r => r.trigger.test(input))
    const response = match ?? AGENT_RESPONSES[AGENT_RESPONSES.length - 1]

    await new Promise(r => setTimeout(r, 600 + Math.random() * 600))

    // Emit if intensity specified
    if (response.intensity) {
      onEmit(response.intensity)
    }

    const agentMsg: Message = {
      id: crypto.randomUUID(),
      role: 'agent',
      agentId: activeAgent,
      text: response.text,
      timestamp: new Date(),
    }
    setMessages(prev => [...prev, agentMsg])
    setIsTyping(false)
  }

  return (
    <div className="holo-card p-4 flex flex-col" style={{ height: '220px' }}>
      {/* Header */}
      <div className="flex items-center gap-2 mb-3 flex-shrink-0">
        <div className="w-2 h-2 rounded-full bg-[#00ff88] animate-pulse" />
        <span className="font-mono text-[10px] text-white/40 uppercase tracking-widest">
          Agent Chat — {activeAgent}
        </span>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto space-y-2 pr-1">
        <AnimatePresence>
          {messages.map(msg => (
            <motion.div
              key={msg.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              className={`flex gap-2 ${msg.role === 'user' ? 'flex-row-reverse' : 'flex-row'}`}
            >
              {/* Avatar */}
              <div className={`
                w-6 h-6 rounded-full flex-shrink-0 flex items-center justify-center text-[10px]
                ${msg.role === 'agent'
                  ? 'bg-[#00ff8820] border border-[#00ff8840]'
                  : 'bg-[#8b00ff20] border border-[#8b00ff40]'
                }
              `}>
                {msg.role === 'agent' ? '🤖' : '👤'}
              </div>

              {/* Bubble */}
              <div className={`
                max-w-[80%] px-3 py-2 rounded text-[11px] font-mono leading-relaxed
                ${msg.role === 'agent'
                  ? 'bg-black/30 text-white/70 border border-[#00ff8820]'
                  : 'bg-[#8b00ff20] text-white/80 border border-[#8b00ff30]'
                }
              `}>
                {msg.text}
              </div>
            </motion.div>
          ))}
        </AnimatePresence>

        {/* Typing indicator */}
        {isTyping && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex gap-2 items-center"
          >
            <div className="w-6 h-6 rounded-full bg-[#00ff8820] border border-[#00ff8840] flex items-center justify-center text-[10px]">🤖</div>
            <div className="flex gap-1 px-3 py-2 bg-black/30 border border-[#00ff8820] rounded">
              {[0,1,2].map(i => (
                <motion.div
                  key={i}
                  className="w-1.5 h-1.5 rounded-full bg-[#00ff88]"
                  animate={{ y: [0, -4, 0] }}
                  transition={{ repeat: Infinity, duration: 0.6, delay: i * 0.15 }}
                />
              ))}
            </div>
          </motion.div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="flex gap-2 mt-3 flex-shrink-0">
        <input
          type="text"
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && sendMessage()}
          placeholder="Tell the agent what to rip..."
          className="flex-1 bg-black/30 border border-white/10 rounded px-3 py-1.5 text-xs font-mono text-white/70 placeholder-white/20 focus:outline-none focus:border-[#00ff8860] transition-colors"
        />
        <button
          onClick={sendMessage}
          disabled={isTyping}
          className="w-8 h-8 flex items-center justify-center rounded bg-[#00ff8820] border border-[#00ff8840] text-[#00ff88] hover:bg-[#00ff8830] transition-colors disabled:opacity-30"
        >
          <Send size={12} />
        </button>
      </div>
    </div>
  )
}
