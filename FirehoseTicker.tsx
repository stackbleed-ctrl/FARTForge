'use client'

import { useEffect, useState, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'

interface Tweet {
  id: string
  text: string
  username: string
  timestamp: string
  url?: string
}

// Fallback mock data for when X API is unavailable
const MOCK_MENTIONS: Tweet[] = [
  { id: '1', text: '$FARTFORGE just obliterated my portfolio in the best possible way 💨🚀', username: 'defi_degen', timestamp: '2m ago' },
  { id: '2', text: 'fartforge ai agent just scored 9.8/10 stink score on its first emission 🧪', username: 'ai_researcher', timestamp: '5m ago' },
  { id: '3', text: 'the smelliest agent just won battle mode with a 3x nuclear rip 💥', username: 'agentic_riper', timestamp: '8m ago' },
  { id: '4', text: '$FARTFORGE holders getting that 3x multiplier rn while you stay poor 💸', username: 'sol_maxi', timestamp: '11m ago' },
  { id: '5', text: 'fartforge leaderboard dominated by indole overlords tonight', username: 'stink_data', timestamp: '15m ago' },
  { id: '6', text: 'the science behind fartforge is actually legit — real H2S measurements', username: 'biochem_degen', timestamp: '18m ago' },
  { id: '7', text: 'shook my phone so hard for shake-to-fart i dropped it. 9.6 stink. worth it', username: 'mobile_ripper', timestamp: '22m ago' },
  { id: '8', text: 'new fart receipt NFT just dropped with 7-compound odor fingerprint embedded on chain', username: 'nft_stinker', timestamp: '27m ago' },
]

interface Props {
  onTweetClick?: (tweet: Tweet) => void
}

export function FirehoseTicker({ onTweetClick }: Props) {
  const [tweets, setTweets] = useState<Tweet[]>(MOCK_MENTIONS)
  const [selectedTweet, setSelectedTweet] = useState<Tweet | null>(null)
  const [speed, setSpeed] = useState(45) // seconds for full scroll

  // Poll for new mentions every 30s
  useEffect(() => {
    const fetchMentions = async () => {
      try {
        const res = await fetch('/api/firehose?limit=20')
        if (res.ok) {
          const data = await res.json()
          if (data.tweets?.length > 0) {
            setTweets(data.tweets)
          }
        }
      } catch {
        // Fallback to mock data — the show must go on
      }
    }

    fetchMentions()
    const interval = setInterval(fetchMentions, 30000)
    return () => clearInterval(interval)
  }, [])

  const allTweets = [...tweets, ...tweets]  // duplicate for seamless loop

  return (
    <>
      {/* Background ticker — full width, very subtle */}
      <div
        className="fixed bottom-0 left-0 right-0 z-5 pointer-events-none overflow-hidden"
        style={{ height: '28px' }}
      >
        <div
          className="flex items-center h-full border-t border-[#00ff8808]"
          style={{ background: 'linear-gradient(90deg, transparent, rgba(0,10,5,0.4), transparent)' }}
        >
          {/* Scrolling ticker */}
          <motion.div
            className="flex items-center gap-8 pointer-events-auto cursor-pointer"
            animate={{ x: [0, '-50%'] }}
            transition={{
              duration: speed,
              ease: 'linear',
              repeat: Infinity,
            }}
          >
            {allTweets.map((tweet, i) => (
              <div
                key={`${tweet.id}-${i}`}
                className="flex items-center gap-2 whitespace-nowrap flex-shrink-0"
                onClick={() => setSelectedTweet(tweet)}
              >
                {/* Particle wisp */}
                <span className="text-[#00ff88] opacity-40 text-[10px]">💨</span>

                {/* Username */}
                <span className="font-mono text-[10px] text-[#00ff88] opacity-50">
                  @{tweet.username}
                </span>

                {/* Tweet text */}
                <span className="font-mono text-[10px] text-[#00ff88] opacity-30 max-w-xs truncate">
                  {tweet.text}
                </span>

                {/* Timestamp */}
                <span className="font-mono text-[9px] text-[#00ff88] opacity-20">
                  {tweet.timestamp}
                </span>

                {/* Separator */}
                <span className="text-[#00ff88] opacity-20 mx-2">◆</span>
              </div>
            ))}
          </motion.div>
        </div>
      </div>

      {/* Tweet modal */}
      <AnimatePresence>
        {selectedTweet && (
          <motion.div
            className="fixed inset-0 z-50 flex items-end justify-center p-4 pb-12"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setSelectedTweet(null)}
          >
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />

            <motion.div
              className="relative holo-card p-5 w-full max-w-md"
              initial={{ y: 100, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 100, opacity: 0 }}
              onClick={e => e.stopPropagation()}
            >
              {/* Close */}
              <button
                className="absolute top-3 right-3 text-white/30 hover:text-white/70 text-lg"
                onClick={() => setSelectedTweet(null)}
              >
                ×
              </button>

              <div className="flex items-center gap-2 mb-3">
                <div className="w-8 h-8 rounded-full bg-[#00ff8820] border border-[#00ff8840] flex items-center justify-center font-mono text-[#00ff88] text-xs">
                  @
                </div>
                <div>
                  <div className="font-mono text-sm text-[#00ff88]">@{selectedTweet.username}</div>
                  <div className="font-mono text-[10px] text-white/30">{selectedTweet.timestamp}</div>
                </div>
              </div>

              <p className="font-body text-sm text-white/80 leading-relaxed mb-4">
                {selectedTweet.text}
              </p>

              <div className="flex gap-2">
                <button
                  className="flex-1 bg-[#00ff8815] border border-[#00ff8840] text-[#00ff88] font-mono text-xs py-2 px-3 rounded hover:bg-[#00ff8825] transition-colors"
                  onClick={() => setSelectedTweet(null)}
                >
                  💨 RIP IN RESPONSE
                </button>
                {selectedTweet.url && (
                  <a
                    href={selectedTweet.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="bg-white/5 border border-white/10 text-white/50 font-mono text-xs py-2 px-3 rounded hover:bg-white/10 transition-colors"
                  >
                    VIEW →
                  </a>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  )
}
